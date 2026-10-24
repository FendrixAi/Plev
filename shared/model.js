/* Jam Fokus — task model helpers (schema v2).
   UMD: browser -> window.JF.model, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'));
  else root.JF = root.JF || {}, root.JF.model = factory(root.JF.dates);
})(typeof self !== 'undefined' ? self : this, function (dates) {
  'use strict';

  var PRIORITIES = ['low', 'normal', 'high'];
  var PRIORITY_LABEL = { low: 'Rendah', normal: 'Normal', high: 'Tinggi' };

  var _seq = 0;
  /** Stable, unique task id (time + counter + randomness; collision-safe within a session). */
  function uid(prefix) {
    _seq = (_seq + 1) % 100000;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + _seq.toString(36) + '_' +
      Math.floor(Math.random() * 1296).toString(36);
  }

  function nowMs() { return Date.now(); }

  /** Create a v2 task. targetDate is required for active tasks. */
  function newTask(input, now) {
    now = now == null ? nowMs() : now;
    var title = String(input.title || '').trim();
    if (!title) throw new Error('Judul task wajib diisi');
    var target = input.targetDate;
    if (!dates.isDayKey(target)) throw new Error('Target tanggal wajib berformat YYYY-MM-DD');
    return {
      id: input.id || uid('task'),
      title: title.slice(0, 120),
      description: (input.description || '').toString().slice(0, 2000),
      targetDate: target,
      priority: PRIORITIES.indexOf(input.priority) >= 0 ? input.priority : 'normal',
      durationSec: input.durationSec > 0 ? Math.round(input.durationSec) : null, // fixed up by store
      left: 0,                       // remaining focus seconds when not running
      createdAt: now,
      updatedAt: now,
      completedAt: null,        // completion of CURRENT state (null when reopened/active)
      firstCompletedAt: null,   // first-ever completion (analytics metric, never erased)
      completionEvents: [],     // every completion event: {at, by}
      reopenEvents: [],         // every reopen event: {at}
      archived: false,
      archivedAt: null,
      restoredAt: null,
      targetDateHistory: [{ at: now, from: null, to: target, source: 'created' }],
      migrated: !!input.migrated,
      done: false
    };
  }

  /** Active = not completed, not archived (the list the user works through). */
  function isActive(t) { return !t.done && !t.archived; }

  /** Overdue is DERIVED: active, has a target date, and that date is strictly before today. */
  function isOverdue(t, today) {
    return isActive(t) && !!t.targetDate && dates.diffDays(t.targetDate, today) > 0;
  }

  /** Archived tasks are never "overdue" and never active. */
  function isCompleted(t) { return !!t.done && !t.archived; }

  function touch(t, now) { t.updatedAt = now == null ? nowMs() : now; return t; }

  return {
    PRIORITIES: PRIORITIES, PRIORITY_LABEL: PRIORITY_LABEL,
    uid: uid, newTask: newTask, isActive: isActive, isOverdue: isOverdue,
    isCompleted: isCompleted, touch: touch
  };
});
