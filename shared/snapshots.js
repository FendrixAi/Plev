/* Jam Fokus — daily snapshots: finalize once, immutable afterwards.
   Missing historical days are reconstructed only from real records and are
   marked incomplete when values cannot be trusted. Never invented zeroes.
   UMD: browser -> window.JF.snapshots, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'), require('./store.js'), require('./sessions.js'));
  else root.JF = root.JF || {}, root.JF.snapshots = factory(root.JF.dates, root.JF.store, root.JF.sessions);
})(typeof self !== 'undefined' ? self : this, function (dates, store, sessions) {
  'use strict';

  function findSnapshot(state, day) {
    for (var i = 0; i < state.snapshots.length; i++) if (state.snapshots[i].date === day) return state.snapshots[i];
    return null;
  }

  /** Earliest timestamp of any real record (tasks, sessions, legacy hist). */
  function firstRecordedAt(state) {
    var min = null;
    function consider(v) { if (v != null && (min == null || v < min)) min = v; }
    state.tasks.forEach(function (t) { consider(t.createdAt); });
    state.sessions.forEach(function (s) { consider(s.startedAt); });
    state.legacyHist.forEach(function (e) { consider(e.at); });
    if (state.migratedAt != null) consider(state.migratedAt);
    return min;
  }

  /** Build (but do not store) the snapshot for a day, from real records. */
  function buildSnapshot(state, day, now, opts) {
    opts = opts || {};
    var start = dates.startOfDay(day);
    var end = dates.startOfDay(dates.addDays(day, 1));
    var target = store.focusTargetFor(state, day);

    var completedIds = [];
    state.tasks.forEach(function (t) {
      if (t.archived) return;
      if (t.firstCompletedAt != null && t.firstCompletedAt >= start && t.firstCompletedAt < end) completedIds.push(t.id);
    });

    var unfinishedIds = [];
    state.tasks.forEach(function (t) {
      if (t.archived) return;
      if (t.done) return;
      if (t.createdAt >= end) return;             // did not exist yet on that day
      if (t.firstCompletedAt != null && t.firstCompletedAt < end) return; // completed before that day
      unfinishedIds.push(t.id);                   // still open when the day ended
    });

    var officialSec = sessions.officialSeconds(state.sessions, start, end);
    var interruptedSec = sessions.interruptedSeconds(state.sessions, start, end);

    var complete = true, reasons = [];
    if (opts.legacy) { complete = false; reasons.push('legacy'); }
    if (opts.incompleteReasons && opts.incompleteReasons.length) {
      complete = false; reasons = reasons.concat(opts.incompleteReasons);
    }

    return {
      date: day,
      finalizedAt: now == null ? Date.now() : now,
      targetMin: target.min,           // null when unknown (never invented)
      targetSource: target.source,
      officialFocusSec: officialSec,
      interruptedFocusSec: interruptedSec,
      completedTaskIds: completedIds.slice().sort(),
      unfinishedTaskIds: unfinishedIds.slice().sort(),
      complete: complete,
      incompleteReasons: reasons,
      legacy: !!opts.legacy
    };
  }

  /** Finalize one day. Idempotent: an existing snapshot is NEVER overwritten. */
  function finalizeDay(state, day, now, opts) {
    if (findSnapshot(state, day)) return { ok: true, created: false, snapshot: findSnapshot(state, day) };
    var snap = buildSnapshot(state, day, now, opts);
    state.snapshots.push(snap);
    state.snapshots.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    store.ev(state, now == null ? Date.now() : now, 'snapshot.finalized', null,
      { date: day, complete: snap.complete });
    return { ok: true, created: true, snapshot: snap };
  }

  /* Roll over: finalize every elapsed day that has records but no snapshot.
     Used on startup and whenever the local day changes. */
  function backfill(state, today, now) {
    now = now == null ? Date.now() : now;
    var created = [];
    var first = firstRecordedAt(state);
    if (first == null) return created;
    var firstDay = dates.dayKey(first);
    // Days strictly BEFORE the v1->v2 migration moment are legacy-derived and
    // cannot be fully trusted (hist is capped at 1000, no target data).
    // With no migration at all (fresh v2 install) no day is "legacy".
    var legacyBoundary = state.migratedAt != null ? dates.dayKey(state.migratedAt) : null;
    var days = dates.dayRange(firstDay, dates.addDays(today, -1));
    for (var i = 0; i < days.length; i++) {
      var d = days[i];
      if (findSnapshot(state, d)) continue;
      var isLegacyDay = legacyBoundary != null && dates.diffDays(d, legacyBoundary) > 0;
      var r = finalizeDay(state, d, now, { legacy: isLegacyDay });
      if (r.created) created.push(r.snapshot);
    }
    return created;
  }

  /* ── corrections (displayed separately, originals untouched) ─────────── */
  /* A task whose FIRST completion fell inside a finalized day, but which was
     reopened afterwards, is a "later correction" for that day. */
  function correctionsFor(state, snap) {
    var out = [];
    var start = dates.startOfDay(snap.date);
    var end = dates.startOfDay(dates.addDays(snap.date, 1));
    snap.completedTaskIds.forEach(function (id) {
      var t = store.find(state, id);
      if (!t) return;
      for (var i = 0; i < t.reopenEvents.length; i++) {
        if (t.reopenEvents[i].at >= end) {
          out.push({
            taskId: t.id, title: t.title, kind: 'reopened-later',
            at: t.reopenEvents[i].at,
            note: 'Task ini dibuka kembali setelah hari tersebut.'
          });
          break;
        }
      }
    });
    return out;
  }

  /** Recomputed "current interpretation" of a finalized day (shown SEPARATELY). */
  function reinterpretation(state, snap) {
    var start = dates.startOfDay(snap.date);
    var end = dates.startOfDay(dates.addDays(snap.date, 1));
    var stillValid = 0, reopened = 0;
    snap.completedTaskIds.forEach(function (id) {
      var t = store.find(state, id);
      if (!t) return;
      var reopenedAfter = t.reopenEvents.some(function (e) { return e.at >= end; });
      if (reopenedAfter) reopened++; else stillValid++;
    });
    return {
      firstCompleted: snap.completedTaskIds.length,
      stillValid: stillValid,
      reopenedLater: reopened,
      differs: reopened > 0
    };
  }

  return {
    findSnapshot: findSnapshot, buildSnapshot: buildSnapshot,
    finalizeDay: finalizeDay, backfill: backfill,
    correctionsFor: correctionsFor, reinterpretation: reinterpretation,
    firstRecordedAt: firstRecordedAt
  };
});
