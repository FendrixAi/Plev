/* Jam Fokus — data-layer tests (deterministic clock, no wall-time reliance).
   Covers the required scenarios for migration, task lifecycle, sessions,
   snapshots, targets, forecast. Run: npm test */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const dates = require('../shared/dates.js');
const model = require('../shared/model.js');
const store = require('../shared/store.js');
const sessions = require('../shared/sessions.js');
const snapshots = require('../shared/snapshots.js');
const forecast = require('../shared/forecast.js');
const migrate = require('../shared/migrate.js');

/* Deterministic clock: timestamp at local noon of a day key. */
function T(day, h = 12, m = 0) {
  const p = dates.parseDay(day);
  return new Date(p.y, p.m - 1, p.d, h, m, 0, 0).getTime();
}
function freshState() { return store.createState(); }
function addTask(s, title, targetDate, now) {
  return store.addTask(s, { title, targetDate }, now == null ? T(targetDate, 9) : now);
}

/* ───────────────────────── Migration ───────────────────────── */
test('1. Existing v1 task data survives migration (ids, names, done flags, history)', () => {
  const v1 = {
    tasks: [
      { id: 1700000000001, name: 'Task lama A', total: 1500, left: 900, endAt: null, done: false },
      { id: 1700000000002, name: 'Task lama B', total: 3000, left: 0, endAt: null, done: true }
    ],
    hist: [
      { at: T('2026-10-20', 10), tid: 1700000000002, name: 'Task lama B', type: 'selesai', total: 3000, left: 0, worked: 3000 }
    ]
  };
  const now = T('2026-10-24', 8);
  const r = migrate.migrate({ v1, pomo: { on: true, brk: 7, lbrk: 20, lbrkN: 3, tar: 5, warn: false } }, now);

  assert.equal(r.migrated, true);
  assert.equal(r.state.tasks.length, 2);
  assert.equal(r.state.tasks[0].id, '1700000000001');           // stable id preserved
  assert.equal(r.state.tasks[0].title, 'Task lama A');
  assert.equal(r.state.tasks[0].done, false);
  assert.equal(r.state.tasks[1].done, true);
  assert.equal(dates.dayKey(r.state.tasks[1].firstCompletedAt), '2026-10-20'); // from real history
  assert.equal(r.state.legacyHist.length, 1);                    // history preserved verbatim
  assert.equal(r.backup.v1.tasks.length, 2);                    // backup handed to caller
  // Pomodoro settings preserved 1:1
  assert.equal(r.state.settings.pomoOn, true);
  assert.equal(r.state.settings.shortBreakMin, 7);
  assert.equal(r.state.settings.longBreakEvery, 3);
  assert.equal(r.state.settings.tasksPerDay, 5);
  assert.equal(r.state.settings.warn8, false);
  // Legacy completed session derived from recorded 'worked' only
  const legacyCompleted = r.state.sessions.filter((s) => s.legacy && s.state === 'completed');
  assert.equal(legacyCompleted.length, 1);
  assert.equal(legacyCompleted[0].activeSec, 3000);
  assert.equal(legacyCompleted[0].contributesToOfficial, true);
});

test('migration is idempotent (re-run does not duplicate or destroy)', () => {
  const v1 = { tasks: [{ id: 1, name: 'A', total: 60, left: 60, endAt: null, done: false }], hist: [] };
  const a = migrate.migrate({ v1 }, T('2026-10-24', 8));
  const b = migrate.migrate({ v1: a.state }, T('2026-10-24', 9)); // pass v2 through again
  assert.equal(b.migrated, false);
  assert.equal(b.state.tasks.length, 1);
});

/* ───────────────────────── Task lifecycle ───────────────────────── */
test('2. A task retains its ID when rescheduled', () => {
  const s = freshState();
  const t = addTask(s, 'Kertas proposal', '2026-10-26');
  const before = t.id;
  const r = store.rescheduleTask(s, t.id, '2026-10-28', T('2026-10-26', 9));
  assert.equal(r.ok, true);
  assert.equal(store.find(s, before).id, before);
  assert.equal(store.find(s, before).targetDate, '2026-10-28');
  assert.ok(t.targetDateHistory.some((h) => h.from === '2026-10-26' && h.to === '2026-10-28'));
});

test('3. A task is not overdue before its CURRENT target date has passed', () => {
  const s = freshState();
  const t = addTask(s, 'Tugas Senin', '2026-10-26');
  // Moved Monday -> Wednesday
  store.rescheduleTask(s, t.id, '2026-10-28', T('2026-10-26', 9));
  assert.equal(store.overdueTasks(s, '2026-10-26').length, 0);  // Monday: not overdue
  assert.equal(store.overdueTasks(s, '2026-10-27').length, 0);  // Tuesday: not overdue
  assert.equal(store.overdueTasks(s, '2026-10-28').length, 0);  // target day itself: not overdue
  assert.equal(store.overdueTasks(s, '2026-10-29').length, 1);  // after target: overdue
});

test('4. Finalized snapshots remain unchanged after a task is rescheduled', () => {
  const s = freshState();
  const t = addTask(s, 'Riset', '2026-10-26');
  snapshots.backfill(s, '2026-10-27', T('2026-10-27', 1));      // finalize 26 Oct
  const snapBefore = JSON.stringify(snapshots.findSnapshot(s, '2026-10-26'));
  store.rescheduleTask(s, t.id, '2026-10-30', T('2026-10-27', 9));
  const snapAfter = JSON.stringify(snapshots.findSnapshot(s, '2026-10-26'));
  assert.equal(snapAfter, snapBefore);                          // byte-identical
});

test('5. Restoring an archived task REQUIRES a selected target date', () => {
  const s = freshState();
  const t = addTask(s, 'Arsipkan dulu', '2026-10-24');
  store.archiveTask(s, t.id, T('2026-10-24', 10));
  const denied = store.restoreTask(s, t.id, null, T('2026-10-25', 9));
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'target-date-required');
  assert.equal(store.find(s, t.id).archived, true);
  const ok = store.restoreTask(s, t.id, '2026-10-29', T('2026-10-25', 9));
  assert.equal(ok.ok, true);
  assert.equal(store.find(s, t.id).archived, false);
  assert.equal(store.find(s, t.id).targetDate, '2026-10-29');   // user-chosen, not the old date
  assert.equal(store.find(s, t.id).id, t.id);                   // same id reactivated
});

test('6. Archived tasks are excluded from active counts and forecasts', () => {
  const s = freshState();
  addTask(s, 'Aktif satu', '2026-10-24');
  const b = addTask(s, 'Diarsipkan', '2026-10-24');
  store.archiveTask(s, b.id, T('2026-10-24', 10));
  assert.equal(store.activeTasks(s, '2026-10-24').length, 1);
  const f = forecast.compute(s, '2026-10-24');
  assert.equal(f.remainingCount, 1);                            // archived not counted
  assert.equal(s.tasks.length, 2);                              // nothing hard-deleted
});

test('7. Reopening a task preserves its previous completion event', () => {
  const s = freshState();
  const t = addTask(s, 'Selesai lalu buka lagi', '2026-10-24');
  store.completeTask(s, t.id, T('2026-10-24', 11));
  store.reopenTask(s, t.id, T('2026-10-24', 12));
  const x = store.find(s, t.id);
  assert.equal(x.done, false);
  assert.equal(x.completionEvents.length, 1);                   // preserved
  assert.equal(x.reopenEvents.length, 1);
  assert.equal(x.firstCompletedAt, T('2026-10-24', 11));        // still recorded
  assert.equal(x.completedAt, null);                            // no longer "completed now"
  assert.ok(store.activeTasks(s, '2026-10-24').some((k) => k.id === t.id)); // back in active list
});

test('8. Re-completion does not inflate the first-completion metric', () => {
  const s = freshState();
  const t = addTask(s, 'Bolak-balik', '2026-10-24');
  store.completeTask(s, t.id, T('2026-10-24', 11));
  store.reopenTask(s, t.id, T('2026-10-24', 12));
  store.completeTask(s, t.id, T('2026-10-24', 13));
  assert.equal(store.find(s, t.id).completionEvents.length, 2); // history kept
  assert.equal(dates.dayKey(store.find(s, t.id).firstCompletedAt), '2026-10-24');
  assert.equal(store.completedCountOn(s, '2026-10-24'), 1);      // counted ONCE
  snapshots.backfill(s, '2026-10-25', T('2026-10-25', 1));
  const snap = snapshots.findSnapshot(s, '2026-10-24');
  assert.equal(snap.completedTaskIds.filter((id) => id === t.id).length, 1);
});

test('9. Editing a completed task does not create a completion event or reopen it', () => {
  const s = freshState();
  const t = addTask(s, 'Judul awal', '2026-10-24');
  store.completeTask(s, t.id, T('2026-10-24', 11));
  const r = store.editTask(s, t.id, { title: 'Judul baru', description: 'deskripsi' }, T('2026-10-24', 12));
  assert.equal(r.ok, true);
  const x = store.find(s, t.id);
  assert.equal(x.done, true);                                   // still completed
  assert.equal(x.completionEvents.length, 1);                   // no new completion event
  assert.equal(x.reopenEvents.length, 0);
  assert.equal(x.title, 'Judul baru');
});

/* ───────────────────────── Sessions ───────────────────────── */
test('10-12. Pause excluded; only completed sessions are official; interrupted retained', () => {
  const s = freshState();
  const task = addTask(s, 'Sesi panjang', '2026-10-24');
  // Run 10m, pause 5m, run 8m, then permanently stop.
  let ses = sessions.createSession(s, { taskId: task.id, plannedSec: 25 * 60, taskName: task.title }, T('2026-10-24', 9, 0));
  sessions.pauseSession(s, ses, T('2026-10-24', 9, 10));
  assert.equal(Math.round(sessions.activeSeconds(ses, T('2026-10-24', 9, 15))), 600); // pause adds 0
  sessions.resumeSession(s, ses, T('2026-10-24', 9, 15));
  sessions.stopSession(s, ses, T('2026-10-24', 9, 23));
  assert.equal(Math.round(ses.activeSec), 18 * 60);             // 18 min actual focus
  assert.equal(Math.round(ses.pausedSec), 5 * 60);              // 5 min paused
  assert.equal(ses.state, 'interrupted');
  assert.equal(ses.contributesToOfficial, false);
  assert.ok(sessions.findSession(s, ses.id));                   // retained, not deleted
  assert.equal(sessions.officialSeconds(s.sessions), 0);        // excluded from official total
  assert.equal(sessions.interruptedSeconds(s.sessions), 18 * 60);
  assert.equal(store.find(s, task.id).done, false);             // task NOT auto-completed
});

test('14-16. Completion recorded once; no auto task-completion; no auto next session', () => {
  const s = freshState();
  const task = addTask(s, 'Sesi tunggal', '2026-10-24');
  const ses = sessions.createSession(s, { taskId: task.id, plannedSec: 600, taskName: task.title }, T('2026-10-24', 9));
  const done = sessions.completeSession(s, ses, T('2026-10-24', 9, 10));
  assert.equal(done.changed, true);
  const again = sessions.completeSession(s, ses, T('2026-10-24', 9, 11));
  assert.equal(again.changed, false);                           // second completion is a no-op
  const completedEvents = s.events.filter((e) => e.kind === 'session.completed' && e.data.sessionId === ses.id);
  assert.equal(completedEvents.length, 1);                      // exactly one record
  assert.equal(sessions.officialSeconds(s.sessions, T('2026-10-24', 0), T('2026-10-25', 0)), 600);
  assert.equal(store.find(s, task.id).done, false);             // 15: focus ≠ task completion
  assert.equal(sessions.currentSession(s), null);               // 16: nothing auto-started
});

test('13. A running session is recovered as PAUSED; downtime is never counted as focus', () => {
  const s = freshState();
  const ses = sessions.createSession(s, { plannedSec: 1500, taskName: 'Tanpa task' }, T('2026-10-24', 9));
  sessions.checkpoint(ses, T('2026-10-24', 9, 10));             // 10 min accounted before "crash"
  // Machine off for 3 hours...
  const recovered = sessions.recover(s, T('2026-10-24', 12, 10));
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].state, 'paused');
  assert.equal(Math.round(sessions.activeSeconds(recovered[0], T('2026-10-24', 12, 10))), 600); // still 10 min
  assert.equal(recovered[0].recoveredAt, T('2026-10-24', 12, 10));
});

test('official totals attribute by completion timestamp and ignore interrupted', () => {
  const s = freshState();
  const a = sessions.createSession(s, { plannedSec: 600, taskName: 'A' }, T('2026-10-23', 9));
  sessions.completeSession(s, a, T('2026-10-23', 9, 10));
  const b = sessions.createSession(s, { plannedSec: 600, taskName: 'B' }, T('2026-10-23', 14));
  sessions.stopSession(s, b, T('2026-10-23', 14, 5));
  assert.equal(sessions.officialSeconds(s.sessions, T('2026-10-23', 0), T('2026-10-24', 0)), 600);
  assert.equal(sessions.officialSeconds(s.sessions, T('2026-10-24', 0), T('2026-10-25', 0)), 0);
});

/* ───────────────────────── Snapshots & targets ───────────────────────── */
test('17. Daily snapshots are not duplicated at rollover (idempotent backfill)', () => {
  const s = freshState();
  addTask(s, 'Hari satu', '2026-10-22');
  snapshots.backfill(s, '2026-10-24', T('2026-10-24', 1));
  const count = s.snapshots.length;
  snapshots.backfill(s, '2026-10-24', T('2026-10-24', 2));
  snapshots.backfill(s, '2026-10-24', T('2026-10-24', 3));
  assert.equal(s.snapshots.length, count);                      // no duplicates
  const datesSeen = s.snapshots.map((x) => x.date);
  assert.equal(new Set(datesSeen).size, datesSeen.length);
});

test('18. Incomplete (legacy) snapshots are not treated as zero-productivity days', () => {
  const s = freshState();
  s.migratedAt = T('2026-10-24', 8);
  s.legacyHist.push({ at: T('2026-10-20', 10), tid: 1, name: 'Lama', type: 'selesai', total: 1200, left: 0, worked: 1200 });
  snapshots.backfill(s, '2026-10-24', T('2026-10-24', 8));
  const legacy = snapshots.findSnapshot(s, '2026-10-20');
  assert.ok(legacy, 'snapshot exists');
  assert.equal(legacy.complete, false);                         // marked incomplete
  assert.ok(legacy.incompleteReasons.includes('legacy'));
  const days = forecast.activeDays(s);
  assert.equal(days.some((d) => d.date === '2026-10-20'), false); // excluded from forecast base
});

test('24. A complete day with no completed focus session reports exactly zero official minutes', () => {
  const s = freshState();
  addTask(s, 'Aktivitas tanpa sesi selesai', '2026-10-23');
  const ses = sessions.createSession(s, { plannedSec: 600, taskName: 'x' }, T('2026-10-23', 9));
  sessions.stopSession(s, ses, T('2026-10-23', 9, 3));          // interrupted only
  snapshots.backfill(s, '2026-10-24', T('2026-10-24', 1));
  const snap = snapshots.findSnapshot(s, '2026-10-23');
  assert.equal(snap.complete, true);
  assert.equal(snap.officialFocusSec, 0);                       // real zero, not "unknown"
});

test('19. Historical target overrides survive editing the default target', () => {
  const s = freshState();
  addTask(s, 'Catatan hari itu', '2026-10-20');                 // gives the day a real record
  store.setFocusTargetDefault(s, 120, T('2026-10-20', 9));
  store.setFocusTargetOverride(s, '2026-10-21', 90, T('2026-10-21', 9));
  snapshots.backfill(s, '2026-10-24', T('2026-10-24', 1));
  store.setFocusTargetDefault(s, 180, T('2026-10-24', 9));      // change default later
  const snap = snapshots.findSnapshot(s, '2026-10-21');
  assert.equal(snap.targetMin, 90);                             // historical override intact
  assert.equal(snap.targetSource, 'override');
  const past = snapshots.findSnapshot(s, '2026-10-22');
  assert.equal(past.targetMin, 120);                            // day used the OLD default
  assert.equal(store.focusTargetFor(s, '2026-10-21').min, 90);
});

test('zero/invalid focus targets are rejected', () => {
  const s = freshState();
  assert.equal(store.setFocusTargetDefault(s, 0).ok, false);
  assert.equal(store.setFocusTargetDefault(s, -5).ok, false);
  assert.equal(store.setFocusTargetDefault(s, NaN).ok, false);
  assert.equal(store.setFocusTargetOverride(s, '2026-10-24', 0).ok, false);
});

test('20. Calendar target and completion markers reference one task without duplicates', () => {
  const s = freshState();
  const t = addTask(s, 'Target Senin, selesai Selasa', '2026-10-26');
  store.completeTask(s, t.id, T('2026-10-27', 10));
  const monday = store.tasksTargeting(s, '2026-10-26');
  const tuesday = store.tasksCompletedOn(s, '2026-10-27');
  assert.equal(monday.length, 1);
  assert.equal(tuesday.length, 1);
  assert.equal(monday[0].id, tuesday[0].id);                    // same task id in both markers
  assert.equal(s.tasks.length, 1);                              // no duplicate record created
});

/* ───────────────────────── Forecast ───────────────────────── */
function stateWithCompleteDays(nCompletionsPerDay, nDays, endDay) {
  const s = freshState();
  for (let i = nDays - 1; i >= 0; i--) {
    const day = dates.addDays(endDay, -i);
    for (let k = 0; k < nCompletionsPerDay; k++) {
      const t = addTask(s, 'Selesai ' + day + '-' + k, day, T(day, 8));
      store.completeTask(s, t.id, T(day, 10));
    }
    snapshots.backfill(s, dates.addDays(day, 1), T(dates.addDays(day, 1), 1));
  }
  return s;
}

test('21. Forecast requires at least 5 adequate active days', () => {
  const s = stateWithCompleteDays(1, 4, '2026-10-23');          // only 4 days
  const f = forecast.compute(s, '2026-10-24');
  assert.equal(f.ready, false);
  assert.equal(f.reason, 'insufficient-history');
  assert.equal(f.forecast7, null);
  assert.equal(f.etaDate, null);
  const d = forecast.describe(f);
  assert.equal(d.title, 'Belum cukup data');
  assert.ok(d.body.includes('5'));
});

test('forecast computes a 7-day projection and ETA from real completion rates', () => {
  const s = stateWithCompleteDays(2, 6, '2026-10-23');          // 2 completions/day over 6 days
  addTask(s, 'Sisa A', '2026-10-24');
  addTask(s, 'Sisa B', '2026-10-24');
  addTask(s, 'Sisa C', '2026-10-25');
  const f = forecast.compute(s, '2026-10-24');
  assert.equal(f.ready, true);
  assert.equal(f.ratePerDay, 2);
  assert.equal(f.forecast7, 14);
  assert.equal(f.remainingCount, 3);
  assert.equal(f.etaDays, 2);                                   // ceil(3/2)
  assert.equal(f.etaDate, '2026-10-26');
});

test('22. Archived tasks and repeated daily appearances do not inflate forecast counts', () => {
  const s = stateWithCompleteDays(1, 5, '2026-10-23');
  const keep = addTask(s, 'Tetap aktif', '2026-10-20');
  const gone = addTask(s, 'Diarsipkan', '2026-10-20');
  store.archiveTask(s, gone.id, T('2026-10-21', 9));
  // The active task "appears" on several days because it was carried over.
  snapshots.backfill(s, '2026-10-24', T('2026-10-24', 1));
  const f = forecast.compute(s, '2026-10-24');
  assert.equal(f.remainingCount, 1);                            // unique tasks only
  assert.equal(f.activeCount, 1);
  assert.equal(store.find(s, keep.id).archived, false);
});

test('23. Zero completion rate never produces invalid forecast values', () => {
  const s = freshState();
  // 5 complete active days, but nobody completes anything.
  for (let i = 0; i < 5; i++) {
    const day = dates.addDays('2026-10-19', i);
    addTask(s, 'Terbuka ' + day, day, T(day, 8));
    snapshots.backfill(s, dates.addDays(day, 1), T(dates.addDays(day, 1), 1));
  }
  addTask(s, 'Belum selesai', '2026-10-24');
  const f = forecast.compute(s, '2026-10-24');
  assert.equal(f.ready, true);
  assert.equal(f.ratePerDay, 0);
  assert.equal(f.forecast7, 0);
  assert.equal(f.etaDate, null);
  assert.equal(f.reason, 'zero-rate');
  assert.ok(!Number.isNaN(f.etaDays) && f.etaDays !== Infinity);
});

test('no active tasks: forecast states completion instead of inventing a date', () => {
  const s = stateWithCompleteDays(1, 5, '2026-10-23');
  const f = forecast.compute(s, '2026-10-24');
  assert.equal(f.allDone, true);
  assert.equal(f.etaDate, null);
  assert.equal(forecast.describe(f).title, 'Semua task aktif selesai');
});

/* ───────────────────────── Corrections & misc ───────────────────────── */
test('corrections after finalization are reported separately, originals intact', () => {
  const s = freshState();
  const t = addTask(s, 'Nanti dibuka lagi', '2026-10-24');
  store.completeTask(s, t.id, T('2026-10-24', 11));
  snapshots.backfill(s, '2026-10-25', T('2026-10-25', 1));
  const snap = snapshots.findSnapshot(s, '2026-10-24');
  const before = JSON.stringify(snap);
  store.reopenTask(s, t.id, T('2026-10-25', 9));
  assert.equal(JSON.stringify(snapshots.findSnapshot(s, '2026-10-24')), before); // original untouched
  const corr = snapshots.correctionsFor(s, snap);
  assert.equal(corr.length, 1);
  assert.equal(corr[0].kind, 'reopened-later');
  const re = snapshots.reinterpretation(s, snap);
  assert.equal(re.firstCompleted, 1);
  assert.equal(re.reopenedLater, 1);
  assert.equal(re.stillValid, 0);
  assert.equal(re.differs, true);
});

test('new tasks require a title and a valid target date', () => {
  const s = freshState();
  assert.throws(() => store.addTask(s, { title: '', targetDate: '2026-10-24' }));
  assert.throws(() => store.addTask(s, { title: 'OK', targetDate: '24-10-2026' }));
  assert.throws(() => store.addTask(s, { title: 'OK', targetDate: '2026-02-30' })); // invalid calendar day
});

test('migration resolves v1 running timers exactly like the v1 loader did', () => {
  const now = T('2026-10-24', 10, 0);
  const v1 = {
    tasks: [
      // Still running: 5 minutes remaining at migration time.
      { id: 'a1', name: 'Masih jalan', total: 1500, left: 600, segLeft: 900, endAt: now + 5 * 60000, done: false },
      // Would have finished while the app was closed.
      { id: 'a2', name: 'Sudah lewat', total: 600, left: 600, segLeft: 600, endAt: now - 60000, done: false }
    ],
    hist: []
  };
  const r = migrate.migrate({ v1 }, now);
  const t1 = r.state.tasks.find((t) => t.id === 'a1');
  const t2 = r.state.tasks.find((t) => t.id === 'a2');
  assert.equal(t1.done, false);
  assert.equal(t1.left, 300);                                   // 5 min remaining, not counted as downtime
  assert.equal(t2.done, true);
  assert.equal(dates.dayKey(t2.firstCompletedAt), '2026-10-24'); // completed at its endAt
  assert.equal(r.state.legacyHist.filter((e) => e.type === 'tertutup').length, 1);
  assert.equal(r.state.legacyHist.filter((e) => e.type === 'selesai').length, 1);
  const off = r.state.sessions.filter((s) => s.contributesToOfficial);
  assert.equal(off.length, 1);
  assert.equal(off[0].activeSec, 600);
  assert.equal(r.state.tasks[0].durationSec, 1500);
  assert.equal(r.state.tasks[1].left, 0);
});

test('new tasks get the default focus duration and full remaining time', () => {
  const s = freshState();
  const t = addTask(s, 'Biasa', '2026-10-24');
  assert.equal(t.durationSec, 25 * 60);                         // settings.defaultFocusSec
  assert.equal(t.left, 25 * 60);
  const t2 = store.addTask(s, { title: 'Durasi custom', targetDate: '2026-10-24', durationSec: 600 }, T('2026-10-24', 9));
  assert.equal(t2.durationSec, 600);
  assert.equal(t2.left, 600);
});

test('date helpers use local calendar dates without UTC drift', () => {
  assert.equal(dates.dayKey(T('2026-10-24', 0, 1)), '2026-10-24'); // just after local midnight
  assert.equal(dates.dayKey(T('2026-10-24', 23, 59)), '2026-10-24');
  assert.equal(dates.addDays('2026-02-28', 1), '2026-03-01');      // 2026 is not a leap year
  assert.equal(dates.addDays('2024-02-28', 1), '2024-02-29');      // leap year
  assert.equal(dates.diffDays('2026-10-20', '2026-10-27'), 7);
  assert.equal(dates.isDayKey('2026-13-01'), false);
});
