'use strict';
/* Analitik: periods, comparisons, inclusion rules, filters, goals, journal, trend, UI wiring. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const dates = require('../shared/dates.js');
const store = require('../shared/store.js');
const sessions = require('../shared/sessions.js');
const snapshots = require('../shared/snapshots.js');
const goals = require('../shared/goals.js');
const journal = require('../shared/journal.js');
const A = require('../shared/analytics.js');

const TODAY = '2026-10-28'; // Wednesday
function T(day, h = 12, m = 0) { const p = dates.parseDay(day); return new Date(p.y, p.m - 1, p.d, h, m, 0, 0).getTime(); }
function task(s, title, due, created, extra) { const t = store.addTask(s, Object.assign({ title, targetDate: due }, extra || {}), created == null ? T(due, 8) : created); return t; }
function done(s, t, at) { store.completeTask(s, t.id, at); }
function session(s, t, startAt, sec, complete) {
  const x = sessions.createSession(s, { taskId: t ? t.id : null, taskName: t ? t.title : 'x', plannedSec: sec }, startAt);
  if (complete) sessions.completeSession(s, x, startAt + sec * 1000); else sessions.stopSession(s, x, startAt + (sec / 2) * 1000);
  return x;
}
const per = (kind, anchor, custom) => A.period(kind, anchor || TODAY, TODAY, custom);
const run = (s, p, filters) => A.compute(s, { today: TODAY, period: p, filters });

test('batas periode harian, mingguan (Senin-Minggu), bulanan, tahunan, kustom, dan pembandingnya', () => {
  let p = per('day');
  assert.deepEqual([p.from, p.to, p.prev.from, p.prev.to, p.incomplete], [TODAY, TODAY, '2026-10-27', '2026-10-27', true]);
  p = per('week');
  assert.deepEqual([p.from, p.to, p.prev.from, p.prev.to], ['2026-10-26', '2026-11-01', '2026-10-19', '2026-10-25']);
  p = per('week', '2026-11-01');
  assert.equal(p.from, '2026-10-26', 'Minggu masih minggu yang sama');
  p = per('month', '2026-03-15');
  assert.deepEqual([p.from, p.to, p.prev.from, p.prev.to, p.days], ['2026-03-01', '2026-03-31', '2026-02-01', '2026-02-28', 31]);
  p = per('month', '2026-01-10');
  assert.deepEqual([p.prev.from, p.prev.to], ['2025-12-01', '2025-12-31']);
  p = per('year');
  assert.deepEqual([p.from, p.to, p.prev.from, p.bucket], ['2026-01-01', '2026-12-31', '2025-01-01', 'month']);
  p = per('custom', null, { from: '2026-10-20', to: '2026-10-10' });
  assert.deepEqual([p.from, p.to, p.days, p.prev.from, p.prev.to], ['2026-10-10', '2026-10-20', 11, '2026-09-29', '2026-10-09'], 'urutan dibalik otomatis');
  assert.equal(per('custom', null, { from: '2026-01-01', to: '2026-12-31' }).bucket, 'month');
  assert.equal(per('week', '2026-10-12').incomplete, false);
  assert.equal(A.shift('month', '2026-01-31', -1), '2025-12-01');
  assert.equal(A.shift('week', TODAY, 1), '2026-11-04');
  assert.equal(A.shift('year', TODAY, -1), '2025-01-01');
});

test('data kosong: tidak ada nol palsu; hari sebelum catatan = tidak ada data', () => {
  const r = run(store.createState(), per('week'));
  assert.equal(r.current.eligibleDays, 0);
  assert.equal(r.current.tasksCompleted, null);
  assert.equal(r.current.focusSec, null);
  assert.equal(r.current.rate.rate, null);
  assert.equal(r.current.avgFocusPerDay, null);
  assert.ok(r.buckets.every((b) => b.status === 'nodata' || b.status === 'future'));
  assert.match(r.insights[0].text, /Belum ada catatan/);
  assert.equal(r.insights.length, 1);
});

test('batas tengah malam lokal: sesi/penyelesaian 23.59 dan 00.00 masuk hari yang benar', () => {
  const s = store.createState();
  const t1 = task(s, 'A', '2026-10-26', T('2026-10-20'));
  const t2 = task(s, 'B', '2026-10-26', T('2026-10-20'));
  done(s, t1, T('2026-10-25', 23, 59));
  done(s, t2, T('2026-10-26', 0, 0));
  const ses = sessions.createSession(s, { taskId: t1.id, taskName: 'A', plannedSec: 600 }, T('2026-10-25', 23, 50));
  sessions.completeSession(s, ses, T('2026-10-26', 0, 0) + 1000);
  const r = run(s, per('week'));
  const mon = r.buckets.find((b) => b.key === '2026-10-26');
  assert.equal(mon.completed, 1);
  assert.equal(mon.focusSec, 600, 'fokus dihitung pada tanggal selesai');
  assert.equal(r.previous.tasksCompleted, 1, 'penyelesaian 23.59 masuk minggu sebelumnya');
});

test('tingkat penyelesaian: tugas jatuh tempo nanti tidak dianggap gagal, arsip dikecualikan, ulang tidak ganda', () => {
  const s = store.createState();
  const past = task(s, 'Lewat', '2026-10-26', T('2026-10-20'));
  task(s, 'Lewat terbuka', '2026-10-27', T('2026-10-20'));
  task(s, 'Nanti terbuka', '2026-10-31', T('2026-10-20'));
  const later = task(s, 'Nanti selesai', '2026-10-30', T('2026-10-20'));
  const arch = task(s, 'Arsip', '2026-10-26', T('2026-10-20'));
  done(s, past, T('2026-10-26', 10)); store.reopenTask(s, past.id, T('2026-10-26', 11)); done(s, past, T('2026-10-27', 10));
  done(s, later, T(TODAY, 9));
  done(s, arch, T('2026-10-26', 9)); store.archiveTask(s, arch.id, T('2026-10-27', 9));
  const r = run(s, per('week'));
  assert.deepEqual([r.current.rate.done, r.current.rate.eligible], [2, 3]);
  assert.equal(r.current.tasksCompleted, 2, 'penyelesaian ulang & arsip tidak dihitung');
  assert.equal(r.current.rate.byPriority.normal.eligible, 3);
});

test('fokus: hanya sesi selesai masuk total; sesi terputus terpisah; target dari laporan/pengaturan', () => {
  const s = store.createState();
  const t = task(s, 'Fokus', '2026-10-26', T('2026-10-26', 7));
  session(s, t, T('2026-10-26', 9), 1500, true);
  session(s, t, T('2026-10-26', 10), 1200, false);
  session(s, t, T(TODAY, 9), 3000, true);
  snapshots.backfill(s, TODAY, T(TODAY, 8));
  store.setFocusTargetDefault(s, 30);
  const r = run(s, per('week'));
  assert.equal(r.current.focusSec, 4500);
  assert.equal(r.current.interruptedSec, 600);
  assert.deepEqual([r.current.sessionsDone, r.current.sessionsCut], [2, 1]);
  assert.equal(r.current.avgSessionSec, 2250);
  const mon = r.buckets.find((b) => b.key === '2026-10-26');
  assert.equal(mon.targetMin, 120, 'target hari lalu dari laporan harian, bukan pengaturan saat ini');
  const wed = r.buckets.find((b) => b.key === TODAY);
  assert.deepEqual([wed.targetMin, wed.status], [30, 'live']);
  assert.deepEqual([r.current.targetMet, r.current.targetDays], [1, 3]);
});

test('sebaran jam/hari mengikuti filter status sesi', () => {
  const s = store.createState();
  const t = task(s, 'X', TODAY, T(TODAY, 6));
  session(s, t, T(TODAY, 9), 1800, true);    // completes 09:30
  session(s, t, T(TODAY, 14), 1200, false);  // interrupted at 14:10 with 600s active
  let r = run(s, per('day'), { sessionStatus: 'completed' });
  assert.equal(r.distribution.hours[9], 1800);
  assert.equal(r.distribution.hours[14], 0);
  r = run(s, per('day'), { sessionStatus: 'interrupted' });
  assert.equal(r.distribution.hours[14], 600);
  r = run(s, per('day'), { sessionStatus: 'all' });
  assert.equal(r.distribution.sessions, 2);
  assert.equal(r.distribution.dow[2], 2400, 'Rabu');
});

test('perbandingan periode menghasilkan delta yang konsisten', () => {
  const s = store.createState();
  for (let i = 0; i < 3; i++) done(s, task(s, 'p' + i, '2026-10-20', T('2026-10-19')), T('2026-10-20', 10 + i));
  done(s, task(s, 'c', '2026-10-26', T('2026-10-19')), T('2026-10-26', 10));
  const r = run(s, per('week'));
  assert.deepEqual([r.current.tasksCompleted, r.previous.tasksCompleted], [1, 3]);
  assert.deepEqual(r.deltas.tasksCompleted, { abs: -2, pct: -67 });
});

test('filter goal dan prioritas membatasi tugas serta sesinya; referensi hilang aman', () => {
  const s = store.createState();
  const a = task(s, 'A', '2026-10-26', T('2026-10-20'), { priority: 'high' });
  const b = task(s, 'B', '2026-10-26', T('2026-10-20'));
  done(s, a, T('2026-10-26', 10)); done(s, b, T('2026-10-26', 11));
  session(s, a, T('2026-10-26', 8), 600, true); session(s, b, T('2026-10-26', 9), 900, true); session(s, null, T('2026-10-26', 13), 300, true);
  const g = goals.createGoal(s, { title: 'G', startDate: '2026-10-20' }).goal;
  goals.linkTask(s, g.id, a.id, null);
  g.taskIds.push('task_hilang');
  let r = run(s, per('week'), { goalId: g.id });
  assert.deepEqual([r.current.tasksCompleted, r.current.focusSec, r.filtered], [1, 600, true]);
  r = run(s, per('week'), { priority: 'normal' });
  assert.deepEqual([r.current.tasksCompleted, r.current.focusSec], [1, 900]);
  r = run(s, per('week'));
  assert.deepEqual([r.current.tasksCompleted, r.current.focusSec], [2, 1800], 'tanpa filter: sesi tanpa tugas ikut');
  r = run(s, per('week'), { goalId: 'goal_tidak_ada' });
  assert.equal(r.current.tasksCompleted, 0);
});

test('goals: memakai progres Goals, manual dibedakan, milestone per periode, tenggat, tanpa progres', () => {
  const s = store.createState();
  const g = goals.createGoal(s, { title: 'Sertifikasi', startDate: '2026-09-01', deadline: '2026-11-05', category: 'Karier' }, T('2026-09-01')).goal;
  const m1 = goals.addMilestone(s, g.id, { title: 'M1' }).milestone;
  goals.addMilestone(s, g.id, { title: 'M2', deadline: '2026-10-20' });
  goals.completeMilestone(s, g.id, m1.id, T('2026-10-27', 9));
  const old = goals.createGoal(s, { title: 'Lama', startDate: '2026-09-01' }, T('2026-09-01')).goal;
  goals.addMilestone(s, old.id, { title: 'X' });
  const man = goals.createGoal(s, { title: 'Manual', startDate: '2026-10-01' }, T('2026-10-01')).goal;
  goals.completeGoal(s, man.id, T('2026-10-27', 10));
  const r = run(s, per('week'));
  const G = r.goals;
  assert.equal(G.milestonesDoneInPeriod, 1);
  assert.equal(G.goalsDoneInPeriod, 1);
  assert.equal(G.overdue.length, 1, 'M2 terlambat');
  const row = G.list.find((x) => x.id === g.id);
  assert.equal(row.pct, goals.progress(s, g).pct);
  assert.equal(row.atRisk, true);
  assert.equal(G.list.find((x) => x.id === man.id).manualComplete, true);
  assert.equal(G.list.find((x) => x.id === man.id).pct, null);
  assert.equal(G.list.find((x) => x.id === old.id).stale, true);
  assert.ok(r.insights.some((i) => i.goalId === g.id && /mendekati tenggat/.test(i.text)));
  assert.ok(r.insights.some((i) => i.goalId === old.id && /belum mencatat progres/.test(i.text)));
  assert.equal(r.milestoneTrend[r.buckets.findIndex((b) => b.key === '2026-10-27')], 1);
});

test('journaling: hanya keberadaan catatan, tautan goal, tanpa membaca isi', () => {
  const s = store.createState();
  task(s, 'x', '2026-10-26', T('2026-10-26', 7));
  journal.save(s, '2026-10-26', { wins: 'rahasia' }, T('2026-10-26', 20));
  journal.save(s, '2026-10-27', { wins: 'b' }, T('2026-10-27', 20));
  const g = goals.createGoal(s, { title: 'G', startDate: '2026-10-20' }).goal;
  journal.setGoalLink(s, '2026-10-27', { goalId: g.id });
  const r = run(s, per('week'));
  assert.deepEqual([r.journal.entries, r.journal.eligibleDays, r.journal.linked], [2, 3, 1]);
  assert.ok(!JSON.stringify(r.journal).includes('rahasia'), 'isi jurnal tidak masuk hasil analitik');
  assert.equal(run(s, per('week'), { goalId: g.id }).journal.entries, 1);
});

test('tren butuh minimal 5 hari laporan lengkap dan menampilkan rentang, bukan angka pasti', () => {
  const s = store.createState();
  s.snapshots = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d, i) => ({ date: d, complete: true, completedTaskIds: Array(i + 1).fill('t'), unfinishedTaskIds: [], officialFocusSec: 0, interruptedFocusSec: 0 }));
  assert.equal(A.trend(s, TODAY).ready, false);
  s.snapshots.push({ date: '2026-10-21', complete: false, completedTaskIds: ['a'], unfinishedTaskIds: [] });
  assert.equal(A.trend(s, TODAY).ready, false, 'hari tidak lengkap tidak dihitung');
  s.snapshots.push({ date: '2026-10-26', complete: true, completedTaskIds: ['a', 'b', 'c', 'd', 'e'], unfinishedTaskIds: [] });
  const t = A.trend(s, TODAY);
  assert.equal(t.ready, true);
  assert.equal(t.observations, 5);
  assert.equal(t.mean, 3);
  assert.ok(t.next7Low < t.next7High);
});

test('analitik tidak mengubah state', () => {
  const s = store.createState();
  const t = task(s, 'x', '2026-10-26', T('2026-10-20'));
  done(s, t, T('2026-10-26', 10));
  session(s, t, T('2026-10-26', 9), 600, true);
  goals.createGoal(s, { title: 'G', startDate: '2026-10-20' });
  const before = JSON.stringify(s);
  ['day', 'week', 'month', 'year'].forEach((k) => A.compute(s, { today: TODAY, period: per(k) }));
  assert.equal(JSON.stringify(s), before);
});

test('UI Analitik memakai modul analitik, kontrol periode/filter, ekspor, dan tetap aksesibel', () => {
  const root = path.join(__dirname, '..');
  const page = fs.readFileSync(path.join(root, 'renderer/pages/analitik.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'renderer/theme.css'), 'utf8');
  const sa = index.indexOf('<script src="shared/analytics.js">');
  assert.ok(sa > index.indexOf('<script src="shared/goals.js">') && sa < index.indexOf('<script src="renderer/core.js">'));
  assert.match(page, /A\(\)\.compute\(app\.rawState\(\)/);
  ['Harian', 'Mingguan', 'Bulanan', 'Tahunan', 'Kustom', 'Periode berjalan', 'Ekspor Excel', 'Perkiraan (bukan hasil)', 'Definisi metrik'].forEach((t) => assert.ok(page.includes(t), t));
  assert.match(page, /#goals\?id=/); assert.match(page, /#jurnal\?date=/); assert.match(page, /#tugas/);
  assert.match(page, /p\.sr-only/); assert.match(page, /'aria-pressed'/); assert.match(page, /'aria-label': 'Periode sebelumnya'|aria-label', 'Periode sebelumnya'/);
  assert.doesNotMatch(page, /localStorage|JF\.store\.(add|complete|archive|edit)|app\.save\(/, 'analitik hanya membaca');
  const an = css.slice(css.indexOf('/* Analitik */'));
  assert.doesNotMatch(an, /gradient|#[0-9a-fA-F]{3,8}\b/);
  assert.match(an, /@media \(max-width: 1040px\)[\s\S]*?\.an-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(an, /\.sr-only/);
  assert.match(fs.readFileSync(path.join(root, 'renderer/charts.js'), 'utf8'), /setAttribute\('role', 'img'\)/);
});
