/* Jam Fokus — deterministic, idempotent v1 -> v2 migration.
   Preserves the original v1 payload (caller keeps it as a backup key).
   v1 tasks that still carry endAt are resolved exactly the way v1's own
   load-time recovery did (same numbers, same event types) — nothing invented.
   UMD: browser -> window.JF.migrate, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'), require('./store.js'), require('./model.js'));
  else root.JF = root.JF || {}, root.JF.migrate = factory(root.JF.dates, root.JF.store, root.JF.model);
})(typeof self !== 'undefined' ? self : this, function (dates, store, model) {
  'use strict';

  var DONE_TYPES = { selesai: 1, 'selesai-manual': 1 };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Resolve a v1 running timer (endAt) exactly like v1's loader did,
     appending the same history event v1 would have written. */
  function resolveEndAt(t, now, hist) {
    var endAt = t.endAt;
    if (!endAt) return { left: t.left != null ? t.left : (t.total || 0), done: !!t.done };
    var l = Math.round((endAt - now) / 1000);
    var sl = t.segLeft != null ? t.segLeft : (t.left != null ? t.left : (t.total || 0));
    if (l <= 0) {
      hist.push({ at: endAt, tid: t.id, name: t.name, type: 'selesai', total: t.total, left: 0, worked: Math.max(0, sl) });
      return { left: 0, done: true, doneAt: endAt };
    }
    hist.push({ at: now, tid: t.id, name: t.name, type: 'tertutup', total: t.total, left: l, worked: Math.max(0, sl - l) });
    return { left: l, done: false };
  }

  function migratedTask(v1t, res, now) {
    var done = !!res.done;
    return {
      id: v1t.id != null ? String(v1t.id) : model.uid('task'),
      title: String(v1t.name || '(Tanpa judul)').slice(0, 120),
      description: '',
      // v1 had no scheduling concept at all: active tasks keep appearing
      // "today" exactly like they do in v1 today. Marked source:'migrated'.
      targetDate: dates.dayKey(now),
      priority: 'normal',
      durationSec: v1t.total > 0 ? Math.round(v1t.total) : null, // fixed up below
      left: res.done ? 0 : Math.max(0, Math.round(res.left || 0)),
      createdAt: now,
      updatedAt: now,
      completedAt: done ? (res.doneAt != null ? res.doneAt : (res.lastDoneAt != null ? res.lastDoneAt : null)) : null,
      firstCompletedAt: done ? (res.doneAt != null ? res.doneAt : (res.firstDoneAt != null ? res.firstDoneAt : null)) : null,
      completionEvents: done && (res.doneAt != null || res.firstDoneAt != null)
        ? [{ at: res.doneAt != null ? res.doneAt : res.firstDoneAt, by: 'migration' }] : [],
      reopenEvents: [],
      archived: false,
      archivedAt: null,
      restoredAt: null,
      targetDateHistory: [{ at: now, from: null, to: dates.dayKey(now), source: 'migrated' }],
      migrated: true,
      done: done
    };
  }

  /** Convert a legacy hist event into a legacy session record (marked, honest). */
  function legacySession(e) {
    var completed = !!DONE_TYPES[e.type];
    var worked = Math.max(0, Math.round(e.worked || 0));
    if (!worked && !completed) return null;         // nothing meaningful to record
    if (!worked && completed) worked = Math.max(0, Math.round(e.total || 0));
    if (!worked) return null;
    return {
      id: model.uid('les'),
      taskId: e.tid != null ? String(e.tid) : null,
      taskName: e.name || '(Tanpa task)',
      plannedSec: Math.max(worked, Math.round(e.total || worked)),
      startedAt: e.at,
      runStartedAt: null,
      pauseStartedAt: null,
      state: completed ? 'completed' : 'interrupted',
      activeSec: worked,
      pausedSec: 0,
      checkpointAt: e.at,
      endedAt: e.at,
      completedAt: completed ? e.at : null,
      legacy: true,
      contributesToOfficial: completed
    };
  }

  /**
   * input = { v1: {tasks,hist} | null, pomo: {...} | null }
   * Returns { state, backup, migrated } — safe to re-run (idempotent).
   */
  function migrate(input, now) {
    now = now == null ? Date.now() : now;
    input = input || {};
    var v1 = input.v1;
    var pomo = input.pomo || null;

    // Already v2 (idempotent re-run): return the state untouched.
    if (v1 && typeof v1 === 'object' && v1.version >= store.SCHEMA_VERSION) {
      return { state: v1, backup: null, migrated: false };
    }
    // Nothing to migrate: build a fresh state.
    if (!v1 || typeof v1 !== 'object' || !Array.isArray(v1.tasks)) {
      var fresh = store.createState();
      if (pomo) applyPomo(fresh.settings, pomo);
      return { state: fresh, backup: null, migrated: false };
    }

    var backup = { v1: clone(v1), pomo: pomo ? clone(pomo) : null };
    var state = store.createState();
    state.migratedAt = now;

    var hist = Array.isArray(v1.hist) ? v1.hist.slice() : [];

    // 1) Resolve still-running v1 timers (appends v1-equivalent events first).
    var resolved = {};
    v1.tasks.forEach(function (t) {
      if (!t) return;
      resolved[String(t.id)] = resolveEndAt(t, now, hist);
    });

    // 2) Completion timestamps per task id from real recorded history only.
    var firstBy = {}, lastBy = {};
    hist.forEach(function (e) {
      if (!e || !DONE_TYPES[e.type] || e.tid == null) return;
      var k = String(e.tid);
      if (firstBy[k] == null || e.at < firstBy[k]) firstBy[k] = e.at;
      if (lastBy[k] == null || e.at > lastBy[k]) lastBy[k] = e.at;
    });

    // 3) Tasks (stable ids, real data only).
    v1.tasks.forEach(function (t) {
      if (!t) return;
      var k = String(t.id);
      var res = resolved[k] || { left: t.left || 0, done: !!t.done };
      res.firstDoneAt = firstBy[k] != null ? firstBy[k] : null;
      res.lastDoneAt = lastBy[k] != null ? lastBy[k] : null;
      state.tasks.push(migratedTask(t, res, now));
    });

    // 4) History preserved verbatim, then converted to marked legacy sessions.
    state.legacyHist = hist.map(function (e) { return clone(e); });
    hist.forEach(function (e) {
      if (!e) return;
      var s = legacySession(e);
      if (s) state.sessions.push(s);
    });
    state.sessions.sort(function (a, b) { return (a.startedAt || 0) - (b.startedAt || 0); });

    // 5) Settings + per-task timer length fallback.
    if (pomo) applyPomo(state.settings, pomo);
    state.tasks.forEach(function (t) {
      if (!(t.durationSec > 0)) t.durationSec = state.settings.defaultFocusSec;
      if (!t.done && !(t.left > 0)) t.left = t.durationSec;
    });

    store.ev(state, now, 'migration.v1-to-v2', null, {
      tasks: state.tasks.length, sessions: state.sessions.length, hist: state.legacyHist.length
    });

    return { state: state, backup: backup, migrated: true };
  }

  function applyPomo(settings, p) {
    // Existing pomodoro semantics preserved 1:1 (valid legacy values).
    if (typeof p.on === 'boolean') settings.pomoOn = p.on;
    if (p.brk > 0) settings.shortBreakMin = p.brk;
    if (p.lbrk > 0) settings.longBreakMin = p.lbrk;
    if (p.lbrkN > 0) settings.longBreakEvery = p.lbrkN;
    if (p.tar > 0) settings.tasksPerDay = p.tar;
    if (typeof p.warn === 'boolean') settings.warn8 = p.warn;
    if (p.sessCount > 0) settings.pomoSessCount = Math.round(p.sessCount);
  }

  return { migrate: migrate, applyPomo: applyPomo, legacySession: legacySession, resolveEndAt: resolveEndAt };
});
