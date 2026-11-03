/* Jam Fokus — task lifecycle operations on the v2 state object.
   Pure/deterministic given (state, inputs, now). Mutates state in place and
   returns a small descriptor for callers/tests.
   UMD: browser -> window.JF.store, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'), require('./model.js'));
  else root.JF = root.JF || {}, root.JF.store = factory(root.JF.dates, root.JF.model);
})(typeof self !== 'undefined' ? self : this, function (dates, model) {
  'use strict';

  var SCHEMA_VERSION = 2;

  function createState() {
    return {
      version: SCHEMA_VERSION,
      createdAt: Date.now(),
      migratedAt: null,
      tasks: [],
      sessions: [],
      snapshots: [],
      legacyHist: [],      // preserved verbatim from v1 (never mutated)
       journals: {},       // 'YYYY-MM-DD' -> daily journal entry
       goals: [],           // long-term goals with milestones (see shared/goals.js)
       library: [],         // centralized Library metadata (files/links/notes)
      settings: defaultSettings(),
      events: []           // global audit trail: {at, kind, taskId, data}
    };
  }

  function defaultSettings() {
    return {
      // Existing v1 pomodoro settings preserved 1:1.
      pomoOn: false, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4,
      tasksPerDay: 4, warn8: true,
      // New: duration-based daily focus target (minutes). Zero is invalid.
      defaultFocusTargetMin: 120,
      targetOverrides: {},      // 'YYYY-MM-DD' -> minutes
      defaultFocusSec: 25 * 60, // planned length of a standalone focus session
      lastDay: null             // last observed local day key (rollover detection)
    };
  }

  function ev(state, now, kind, taskId, data) {
    var e = { at: now, kind: kind, taskId: taskId || null };
    if (data) e.data = data;
    state.events.push(e);
    if (state.events.length > 5000) state.events.splice(0, state.events.length - 5000);
    return e;
  }

  function find(state, id) {
    for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].id === id) return state.tasks[i];
    return null;
  }

  /** True when a running/paused session currently owns this task's timer. */
  function hasLiveSession(state, taskId) {
    for (var i = 0; i < state.sessions.length; i++) {
      var s = state.sessions[i];
      if (s.taskId === taskId && (s.state === 'running' || s.state === 'paused')) return true;
    }
    return false;
  }

  /* ── create ─────────────────────────────────────────────────────────── */
  function addTask(state, input, now) {
    now = now == null ? Date.now() : now;
    var t = model.newTask(input, now);
    if (!(t.durationSec > 0)) t.durationSec = state.settings.defaultFocusSec;
    t.left = t.durationSec;
    state.tasks.push(t);
    ev(state, now, 'task.created', t.id, { targetDate: t.targetDate });
    return t;
  }

  /* ── edit ───────────────────────────────────────────────────────────── */
  /* Editing a completed task's title/description must NOT create another
     completion event and must NOT reopen it. */
  function editTask(state, id, patch, now) {
    now = now == null ? Date.now() : now;
    var t = find(state, id);
    if (!t) return { ok: false, reason: 'not-found' };
    var changed = false;
    if (patch.title != null && String(patch.title).trim() && patch.title !== t.title) {
      t.title = String(patch.title).trim().slice(0, 120); changed = true;
    }
    if (patch.description != null && patch.description !== t.description) {
      t.description = String(patch.description).slice(0, 2000); changed = true;
    }
    if (patch.priority != null && model.PRIORITIES.indexOf(patch.priority) >= 0 && patch.priority !== t.priority) {
      t.priority = patch.priority; changed = true;
    }
    if (patch.durationSec != null) {
      var d = Math.min(24 * 3600, Math.max(60, Math.round(Number(patch.durationSec))));
      if (isFinite(d) && d !== t.durationSec) {
        t.durationSec = d;
        // `left` is only a resume point. Without a live session it must follow
        // the new duration, otherwise a stale remainder would override it when
        // the timer starts. A running/paused session keeps its own plannedSec
        // and remaining time; the new duration applies to the next session.
        if (!hasLiveSession(state, id)) t.left = d;
        changed = true;
      }
    }
    if (changed) { model.touch(t, now); ev(state, now, 'task.edited', t.id, { done: !!t.done }); }
    return { ok: true, task: t, changed: changed };
  }

  /* ── reschedule ─────────────────────────────────────────────────────── */
  /* Keeps the SAME id, records the change, never touches finalized snapshots. */
  function rescheduleTask(state, id, newDate, now) {
    now = now == null ? Date.now() : now;
    var t = find(state, id);
    if (!t) return { ok: false, reason: 'not-found' };
    if (!dates.isDayKey(newDate)) return { ok: false, reason: 'bad-date' };
    if (t.targetDate === newDate) return { ok: true, task: t, changed: false };
    var from = t.targetDate;
    t.targetDate = newDate;
    t.targetDateHistory.push({ at: now, from: from, to: newDate, source: 'rescheduled' });
    model.touch(t, now);
    ev(state, now, 'task.rescheduled', t.id, { from: from, to: newDate });
    return { ok: true, task: t, changed: true, from: from, to: newDate };
  }

  /* ── complete ───────────────────────────────────────────────────────── */
  /* First completion stamps completedAt + firstCompletedAt. Re-completion
     (after a reopen) records an event but does NOT change firstCompletedAt,
     so the analytics "first completion" metric cannot be inflated. */
  /* Library is resolved lazily: store.js loads before library.js in the browser. */
  function libraryDep() {
    if (typeof module === 'object' && module.exports) return require('./library.js');
    return (typeof self !== 'undefined' && self.JF && self.JF.library) || null;
  }

  /** Mark a task as needing an output file before it can be completed (default: not required). */
  function setRequiresOutput(state, id, required, now) {
    now = now == null ? Date.now() : now;
    var t = find(state, id);
    if (!t) return { ok: false, reason: 'not-found' };
    required = !!required;
    if (!!t.requiresOutput === required) return { ok: true, task: t, changed: false };
    t.requiresOutput = required;
    model.touch(t, now);
    ev(state, now, required ? 'task.output.required' : 'task.output.optional', t.id);
    return { ok: true, task: t, changed: true };
  }

  /**
   * opts.availableFileNames: managed files the caller verified on disk. A task
   * with requiresOutput can only complete when at least one of its attached
   * documents is in that list. Ordinary tasks are unaffected.
   */
  function completeTask(state, id, now, by, opts) {
    now = now == null ? Date.now() : now;
    var t = find(state, id);
    if (!t) return { ok: false, reason: 'not-found' };
    if (t.archived) return { ok: false, reason: 'archived' };
    if (t.done) return { ok: true, task: t, changed: false, reason: 'already-completed' };
    var lib = libraryDep();
    if (t.requiresOutput) {
      var chk = lib ? lib.deliverableCheck(state, id, opts && opts.availableFileNames) : { ok: false, reason: 'output-required' };
      if (!chk.ok) return { ok: false, reason: chk.reason, attached: chk.attached, available: chk.available };
    }
    if (lib) {
      var snap = lib.deliverableSnapshot(state, id, now);
      if (snap.length || t.requiresOutput) t.deliverables = snap;
    }
    t.done = true;
    t.completedAt = now;
    if (t.firstCompletedAt == null) t.firstCompletedAt = now;
    t.completionEvents.push({ at: now, by: by || 'user' });
    model.touch(t, now);
    ev(state, now, 'task.completed', t.id, { first: t.completionEvents.length === 1 });
    return { ok: true, task: t, changed: true, first: t.completionEvents.length === 1 };
  }

  /* ── reopen ─────────────────────────────────────────────────────────── */
  /* Keeps the previous completion event; returns the task to the active list
     with its SAME target date (no forced reset). */
  function reopenTask(state, id, now) {
    now = now == null ? Date.now() : now;
    var t = find(state, id);
    if (!t) return { ok: false, reason: 'not-found' };
    if (!t.done) return { ok: true, task: t, changed: false, reason: 'not-completed' };
    t.done = false;
    t.completedAt = null;
    t.reopenEvents.push({ at: now });
    model.touch(t, now);
    ev(state, now, 'task.reopened', t.id);
    return { ok: true, task: t, changed: true };
  }

  /* ── archive / restore ──────────────────────────────────────────────── */
  /* Archiving is reversible; no hard delete. Archived tasks keep history and
     are excluded from active lists, overdue lists and forecasts, and are NOT
     counted as completed merely by being archived. */
  function archiveTask(state, id, now) {
    now = now == null ? Date.now() : now;
    var t = find(state, id);
    if (!t) return { ok: false, reason: 'not-found' };
    if (t.archived) return { ok: true, task: t, changed: false };
    t.archived = true;
    t.archivedAt = now;
    model.touch(t, now);
    ev(state, now, 'task.archived', t.id, { wasDone: !!t.done });
    return { ok: true, task: t, changed: true };
  }

  /* Restoring REQUIRES a user-selected target date; the old date is only a
     reference and is never applied automatically. */
  function restoreTask(state, id, targetDate, now) {
    now = now == null ? Date.now() : now;
    var t = find(state, id);
    if (!t) return { ok: false, reason: 'not-found' };
    if (!t.archived) return { ok: true, task: t, changed: false, reason: 'not-archived' };
    if (!dates.isDayKey(targetDate)) return { ok: false, reason: 'target-date-required' };
    var from = t.targetDate;
    t.archived = false;
    t.archivedAt = null;
    t.restoredAt = now;
    t.targetDate = targetDate;
    t.targetDateHistory.push({ at: now, from: from, to: targetDate, source: 'restored' });
    model.touch(t, now);
    ev(state, now, 'task.restored', t.id, { from: from, to: targetDate });
    return { ok: true, task: t, changed: true };
  }


  /* Hard delete — ONLY for tasks that are already archived (the Arsip tab).
     Active/done tasks can never be deleted this way, and a task that still
     owns a running/paused session is skipped. References to the task are
     stripped from goals/milestones and Library items so no dangling ids are
     left behind. Past focus sessions and the audit trail are kept (their
     history/analytics must not change); sessions already store the task name. */
  function deleteArchivedTasks(state, ids, now) {
    now = now == null ? Date.now() : now;
    var want = {};
    (ids || []).forEach(function (id) { if (id) want[id] = true; });
    var removed = [], skipped = [];
    Object.keys(want).forEach(function (id) {
      var t = find(state, id);
      if (!t) return;
      if (!t.archived || hasLiveSession(state, id)) { skipped.push(id); return; }
      removed.push(id);
    });
    if (!removed.length) return { ok: true, removed: [], skipped: skipped, changed: false };
    var gone = {};
    removed.forEach(function (id) { gone[id] = true; });
    function keep(id) { return !gone[id]; }
    state.tasks = state.tasks.filter(function (t) { return keep(t.id); });
    (Array.isArray(state.goals) ? state.goals : []).forEach(function (g) {
      if (Array.isArray(g.taskIds)) g.taskIds = g.taskIds.filter(keep);
      (g.milestones || []).forEach(function (m) { if (Array.isArray(m.taskIds)) m.taskIds = m.taskIds.filter(keep); });
    });
    (Array.isArray(state.library) ? state.library : []).forEach(function (it) {
      if (Array.isArray(it.taskIds)) it.taskIds = it.taskIds.filter(keep);
    });
    ev(state, now, 'tasks.deleted', null, { count: removed.length });
    return { ok: true, removed: removed, skipped: skipped, changed: true };
  }

  /* ── queries ────────────────────────────────────────────────────────── */
  /* diffDays(targetDate, today) > 0 means the target is in the PAST. */
  function activeTasks(state, today) {
    return state.tasks.filter(function (t) { return model.isActive(t) && dates.diffDays(t.targetDate, today) >= 0; });
  }
  function upcomingTasks(state, today) {
    return state.tasks.filter(function (t) { return model.isActive(t) && dates.diffDays(t.targetDate, today) < 0; });
  }
  function overdueTasks(state, today) {
    return state.tasks.filter(function (t) { return model.isOverdue(t, today); });
  }
  function tasksTargeting(state, day) {
    return state.tasks.filter(function (t) { return !t.archived && t.targetDate === day; });
  }
  function tasksCompletedOn(state, day) {
    return state.tasks.filter(function (t) { return !t.archived && t.firstCompletedAt != null && dates.dayKey(t.firstCompletedAt) === day; });
  }
  function completedCountOn(state, day) { return tasksCompletedOn(state, day).length; }
  function archivedTasks(state) { return state.tasks.filter(function (t) { return t.archived; }); }

  /* ── settings / daily focus targets ─────────────────────────────────── */
  function setFocusTargetDefault(state, minutes, now) {
    var m = Math.round(Number(minutes));
    if (!isFinite(m) || m <= 0) return { ok: false, reason: 'target-must-be-positive' };
    state.settings.defaultFocusTargetMin = Math.min(24 * 60, m);
    ev(state, now == null ? Date.now() : now, 'settings.focusTargetDefault', null, { min: state.settings.defaultFocusTargetMin });
    return { ok: true, min: state.settings.defaultFocusTargetMin };
  }
  function setFocusTargetOverride(state, day, minutes, now) {
    if (!dates.isDayKey(day)) return { ok: false, reason: 'bad-date' };
    var m = Math.round(Number(minutes));
    if (!isFinite(m) || m <= 0) return { ok: false, reason: 'target-must-be-positive' };
    state.settings.targetOverrides[day] = Math.min(24 * 60, m);
    ev(state, now == null ? Date.now() : now, 'settings.focusTargetOverride', null, { day: day, min: state.settings.targetOverrides[day] });
    return { ok: true, min: state.settings.targetOverrides[day] };
  }
  function clearFocusTargetOverride(state, day, now) {
    if (state.settings.targetOverrides[day] == null) return { ok: false, reason: 'no-override' };
    delete state.settings.targetOverrides[day];
    ev(state, now == null ? Date.now() : now, 'settings.focusTargetOverrideCleared', null, { day: day });
    return { ok: true };
  }
  /** Target that applies to a day: explicit override, else default, else null (unknown). */
  function focusTargetFor(state, day) {
    if (state.settings.targetOverrides[day] != null) {
      return { min: state.settings.targetOverrides[day], source: 'override' };
    }
    var d = state.settings.defaultFocusTargetMin;
    return (d > 0) ? { min: d, source: 'default' } : { min: null, source: 'unknown' };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    createState: createState, defaultSettings: defaultSettings,
    find: find, ev: ev,
    addTask: addTask, editTask: editTask, rescheduleTask: rescheduleTask,
    completeTask: completeTask, reopenTask: reopenTask, setRequiresOutput: setRequiresOutput,
    archiveTask: archiveTask, restoreTask: restoreTask, deleteArchivedTasks: deleteArchivedTasks,
    activeTasks: activeTasks, upcomingTasks: upcomingTasks, overdueTasks: overdueTasks,
    tasksTargeting: tasksTargeting, tasksCompletedOn: tasksCompletedOn,
    completedCountOn: completedCountOn, archivedTasks: archivedTasks,
    setFocusTargetDefault: setFocusTargetDefault,
    setFocusTargetOverride: setFocusTargetOverride,
    clearFocusTargetOverride: clearFocusTargetOverride,
    focusTargetFor: focusTargetFor
  };
});
