/* Jam Fokus - Goals & milestones (data layer).
   Goals live in state.goals (array). Each goal owns its milestones and only
   REFERENCES existing tasks by id (goal.taskIds / milestone.taskIds); task
   records are never copied, created, completed, or deleted here.
   Progress is always derived on read from the saved data, never stored.
   UMD: browser -> window.JF.goals, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./dates.js'), require('./model.js'), require('./store.js'));
  } else {
    root.JF = root.JF || {};
    root.JF.goals = factory(root.JF.dates, root.JF.model, root.JF.store);
  }
})(typeof self !== 'undefined' ? self : this, function (dates, model, store) {
  'use strict';

  var STATUSES = ['not_started', 'in_progress', 'on_hold', 'completed'];
  var STATUS_LABEL = {
    not_started: 'Belum dimulai', in_progress: 'Berjalan', on_hold: 'Ditunda', completed: 'Selesai'
  };
  var METHODS = ['milestones', 'tasks', 'target'];
  var METHOD_LABEL = { milestones: 'Berdasarkan milestone', tasks: 'Berdasarkan tugas', target: 'Berdasarkan target angka' };
  var SOON_DAYS = 7;
  var LIMITS = { title: 120, description: 2000, category: 40, criteria: 600, unit: 24 };
  var MAX_TARGET = 1e9;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v, max) { return v == null ? '' : String(v).slice(0, max); }
  function trimmed(v, max) { return v == null ? '' : String(v).trim().slice(0, max); }
  function optDay(v) { return dates.isDayKey(v) ? v : null; }
  function num(v) {
    if (v === '' || v == null || typeof v === 'boolean') return NaN;
    var n = Number(v);
    return isFinite(n) ? n : NaN;
  }
  function idOf(v) { return (typeof v === 'string' && v) ? v : (typeof v === 'number' && isFinite(v) ? String(v) : null); }
  function uniqIds(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (v) {
      var id = idOf(v);
      if (id && !seen[id]) { seen[id] = true; out.push(id); }
    });
    return out;
  }
  function ev(state, now, kind, data) {
    if (!Array.isArray(state.events)) state.events = [];
    store.ev(state, now, kind, null, data);
  }

  /* ── normalization (older states / imported backups) ─────────────── */
  function normTarget(t) {
    if (!isObj(t)) return null;
    var value = num(t.value), current = num(t.current);
    return {
      value: value > 0 ? Math.min(value, MAX_TARGET) : null,
      current: current >= 0 ? Math.min(current, MAX_TARGET) : 0,
      unit: trimmed(t.unit, LIMITS.unit)
    };
  }

  function normMilestone(m, goalId, now, usedIds) {
    if (!isObj(m)) return null;
    var id = idOf(m.id);
    if (!id || usedIds[id]) id = model.uid('ms');
    usedIds[id] = true;
    var done = !!m.done;
    return {
      id: id,
      goalId: goalId,
      title: trimmed(m.title, LIMITS.title) || 'Milestone tanpa judul',
      description: str(m.description, LIMITS.description),
      criteria: str(m.criteria, LIMITS.criteria),
      deadline: optDay(m.deadline),
      done: done,
      completedAt: done ? (num(m.completedAt) > 0 ? num(m.completedAt) : now) : null,
      taskIds: uniqIds(m.taskIds),
      createdAt: num(m.createdAt) > 0 ? num(m.createdAt) : now,
      updatedAt: num(m.updatedAt) > 0 ? num(m.updatedAt) : now
    };
  }

  function normGoal(g, now, usedGoalIds) {
    if (!isObj(g)) return null;
    var id = idOf(g.id);
    if (!id || usedGoalIds[id]) id = model.uid('goal');
    usedGoalIds[id] = true;
    var status = STATUSES.indexOf(g.status) >= 0 ? g.status : 'not_started';
    var createdAt = num(g.createdAt) > 0 ? num(g.createdAt) : now;
    var start = optDay(g.startDate) || dates.dayKey(createdAt);
    var deadline = optDay(g.deadline);
    if (deadline && dates.diffDays(start, deadline) < 0) deadline = null;
    var usedMs = {};
    var milestones = (Array.isArray(g.milestones) ? g.milestones : [])
      .map(function (m) { return normMilestone(m, id, now, usedMs); })
      .filter(Boolean);
    var out = {
      id: id,
      title: trimmed(g.title, LIMITS.title) || 'Goal tanpa judul',
      description: str(g.description, LIMITS.description),
      category: trimmed(g.category, LIMITS.category),
      startDate: start,
      deadline: deadline,
      status: status,
      progressMethod: METHODS.indexOf(g.progressMethod) >= 0 ? g.progressMethod : 'milestones',
      target: normTarget(g.target),
      taskIds: uniqIds(g.taskIds),
      milestones: milestones,
      archived: !!g.archived,
      archivedAt: g.archived && num(g.archivedAt) > 0 ? num(g.archivedAt) : (g.archived ? now : null),
      completedAt: status === 'completed' ? (num(g.completedAt) > 0 ? num(g.completedAt) : now) : null,
      createdAt: createdAt,
      updatedAt: num(g.updatedAt) > 0 ? num(g.updatedAt) : createdAt
    };
    dedupeTaskLinks(out);
    return out;
  }

  /** A task may sit in only ONE place inside a goal (goal level or one milestone). */
  function dedupeTaskLinks(goal) {
    var seen = {};
    goal.milestones.forEach(function (m) {
      m.taskIds = m.taskIds.filter(function (id) { if (seen[id]) return false; seen[id] = true; return true; });
    });
    goal.taskIds = goal.taskIds.filter(function (id) { if (seen[id]) return false; seen[id] = true; return true; });
  }

  /** Older states simply get an empty goal list (no schema bump). */
  function normalize(state, now) {
    if (!state || typeof state !== 'object') return [];
    now = now == null ? Date.now() : now;
    var used = {};
    state.goals = (Array.isArray(state.goals) ? state.goals : [])
      .map(function (g) { return normGoal(g, now, used); })
      .filter(Boolean);
    if (isObj(state.journals)) {
      Object.keys(state.journals).forEach(function (day) {
        var e = state.journals[day];
        if (isObj(e) && e.goal !== undefined) {
          var link = cleanJournalLink(e.goal);
          if (link) e.goal = link; else delete e.goal;
        }
      });
    }
    return state.goals;
  }

  function cleanJournalLink(link) {
    if (!isObj(link)) return null;
    var goalId = idOf(link.goalId);
    if (!goalId) return null;
    return { goalId: goalId, milestoneId: idOf(link.milestoneId) };
  }

  function list(state) { return Array.isArray(state && state.goals) ? state.goals : []; }
  function find(state, id) {
    var all = list(state);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function findMilestone(goal, mid) {
    if (!goal) return null;
    for (var i = 0; i < goal.milestones.length; i++) if (goal.milestones[i].id === mid) return goal.milestones[i];
    return null;
  }

  /* ── validation ─────────────────────────────────────────────────── */
  /**
   * Validate goal form input. Returns {ok, errors:{field:msg}, value}.
   * `base` (existing goal) fills fields missing from a partial patch.
   */
  function validateGoal(input, base) {
    input = input || {};
    base = base || {};
    function pick(k) { return input[k] !== undefined ? input[k] : base[k]; }
    var errors = {};
    var title = trimmed(pick('title'), 10000);
    if (!title) errors.title = 'Judul goal wajib diisi.';
    else if (title.length > LIMITS.title) errors.title = 'Judul maksimal ' + LIMITS.title + ' karakter.';
    var startDate = pick('startDate');
    if (!dates.isDayKey(startDate)) errors.startDate = 'Tanggal mulai wajib diisi dengan tanggal yang valid.';
    var deadline = pick('deadline');
    if (deadline === '' || deadline == null) deadline = null;
    else if (!dates.isDayKey(deadline)) errors.deadline = 'Tenggat tidak valid.';
    else if (!errors.startDate && dates.diffDays(startDate, deadline) < 0) errors.deadline = 'Tenggat tidak boleh sebelum tanggal mulai.';
    var status = pick('status') == null ? 'not_started' : pick('status');
    if (STATUSES.indexOf(status) < 0) errors.status = 'Status tidak dikenal.';
    var method = pick('progressMethod') == null ? 'milestones' : pick('progressMethod');
    if (METHODS.indexOf(method) < 0) errors.progressMethod = 'Metode progres tidak dikenal.';

    var target = null;
    var rawTarget = input.target !== undefined ? input.target : base.target;
    if (method === 'target') {
      var t = isObj(rawTarget) ? rawTarget : {};
      var value = num(t.value), current = t.current === '' || t.current == null ? 0 : num(t.current);
      if (!(value > 0)) errors.targetValue = 'Nilai target harus angka lebih dari 0.';
      else if (value > MAX_TARGET) errors.targetValue = 'Nilai target terlalu besar.';
      if (!(current >= 0)) errors.targetCurrent = 'Nilai saat ini harus angka 0 atau lebih.';
      else if (current > MAX_TARGET) errors.targetCurrent = 'Nilai saat ini terlalu besar.';
      target = { value: value, current: current, unit: trimmed(t.unit, LIMITS.unit) };
    } else if (isObj(rawTarget)) {
      target = normTarget(rawTarget);   // kept so switching methods back does not lose it
    }

    var ok = Object.keys(errors).length === 0;
    return {
      ok: ok,
      errors: errors,
      value: ok ? {
        title: title,
        description: str(pick('description'), LIMITS.description),
        category: trimmed(pick('category'), LIMITS.category),
        startDate: startDate,
        deadline: deadline,
        status: status,
        progressMethod: method,
        target: target
      } : null
    };
  }

  function validateMilestone(input, base) {
    input = input || {};
    base = base || {};
    function pick(k) { return input[k] !== undefined ? input[k] : base[k]; }
    var errors = {};
    var title = trimmed(pick('title'), 10000);
    if (!title) errors.title = 'Judul milestone wajib diisi.';
    else if (title.length > LIMITS.title) errors.title = 'Judul maksimal ' + LIMITS.title + ' karakter.';
    var deadline = pick('deadline');
    if (deadline === '' || deadline == null) deadline = null;
    else if (!dates.isDayKey(deadline)) errors.deadline = 'Tenggat tidak valid.';
    var ok = Object.keys(errors).length === 0;
    return {
      ok: ok, errors: errors,
      value: ok ? {
        title: title,
        description: str(pick('description'), LIMITS.description),
        criteria: str(pick('criteria'), LIMITS.criteria),
        deadline: deadline
      } : null
    };
  }

  /* ── goal CRUD ──────────────────────────────────────────────────── */
  function createGoal(state, input, now) {
    now = now == null ? Date.now() : now;
    if (!Array.isArray(state.goals)) state.goals = [];
    var v = validateGoal(Object.assign({ startDate: dates.dayKey(now) }, input || {}));
    if (!v.ok) return { ok: false, reason: 'invalid', errors: v.errors };
    var g = Object.assign({ id: model.uid('goal') }, v.value, {
      taskIds: [], milestones: [],
      archived: false, archivedAt: null,
      completedAt: v.value.status === 'completed' ? now : null,
      createdAt: now, updatedAt: now
    });
    state.goals.push(g);
    ev(state, now, 'goal.created', { goalId: g.id });
    return { ok: true, goal: g };
  }

  function updateGoal(state, id, patch, now) {
    now = now == null ? Date.now() : now;
    var g = find(state, id);
    if (!g) return { ok: false, reason: 'not-found' };
    if (g.archived) return { ok: false, reason: 'archived' };
    var v = validateGoal(patch, g);
    if (!v.ok) return { ok: false, reason: 'invalid', errors: v.errors };
    var before = JSON.stringify([g.title, g.description, g.category, g.startDate, g.deadline, g.status, g.progressMethod, g.target]);
    var prevStatus = g.status;
    Object.keys(v.value).forEach(function (k) { g[k] = v.value[k]; });
    var after = JSON.stringify([g.title, g.description, g.category, g.startDate, g.deadline, g.status, g.progressMethod, g.target]);
    if (before === after) return { ok: true, goal: g, changed: false };
    if (g.status === 'completed' && prevStatus !== 'completed') g.completedAt = now;
    if (g.status !== 'completed') g.completedAt = null;
    g.updatedAt = now;
    ev(state, now, 'goal.updated', { goalId: g.id });
    return { ok: true, goal: g, changed: true };
  }

  function setStatus(state, id, status, now) {
    return updateGoal(state, id, { status: status }, now);
  }

  /** Manual completion. Never touches linked tasks or milestones. */
  function completeGoal(state, id, now) {
    var g = find(state, id);
    if (!g) return { ok: false, reason: 'not-found' };
    if (g.status === 'completed') return { ok: true, goal: g, changed: false };
    return setStatus(state, id, 'completed', now);
  }

  function reopenGoal(state, id, now) {
    var g = find(state, id);
    if (!g) return { ok: false, reason: 'not-found' };
    if (g.status !== 'completed') return { ok: true, goal: g, changed: false };
    return setStatus(state, id, 'in_progress', now);
  }

  /** Archiving is reversible and keeps every milestone and task link. */
  function archiveGoal(state, id, now) {
    now = now == null ? Date.now() : now;
    var g = find(state, id);
    if (!g) return { ok: false, reason: 'not-found' };
    if (g.archived) return { ok: true, goal: g, changed: false };
    g.archived = true; g.archivedAt = now; g.updatedAt = now;
    ev(state, now, 'goal.archived', { goalId: g.id });
    return { ok: true, goal: g, changed: true };
  }

  function restoreGoal(state, id, now) {
    now = now == null ? Date.now() : now;
    var g = find(state, id);
    if (!g) return { ok: false, reason: 'not-found' };
    if (!g.archived) return { ok: true, goal: g, changed: false };
    g.archived = false; g.archivedAt = null; g.updatedAt = now;
    ev(state, now, 'goal.restored', { goalId: g.id });
    return { ok: true, goal: g, changed: true };
  }

  /* ── milestones ─────────────────────────────────────────────────── */
  function editableGoal(state, goalId) {
    var g = find(state, goalId);
    if (!g) return { error: { ok: false, reason: 'not-found' } };
    if (g.archived) return { error: { ok: false, reason: 'archived' } };
    return { goal: g };
  }

  function addMilestone(state, goalId, input, now) {
    now = now == null ? Date.now() : now;
    var r = editableGoal(state, goalId);
    if (r.error) return r.error;
    var v = validateMilestone(input);
    if (!v.ok) return { ok: false, reason: 'invalid', errors: v.errors };
    var m = Object.assign({ id: model.uid('ms'), goalId: goalId }, v.value, {
      done: false, completedAt: null, taskIds: [], createdAt: now, updatedAt: now
    });
    r.goal.milestones.push(m);
    r.goal.updatedAt = now;
    ev(state, now, 'goal.milestone.created', { goalId: goalId, milestoneId: m.id });
    return { ok: true, goal: r.goal, milestone: m };
  }

  function updateMilestone(state, goalId, mid, patch, now) {
    now = now == null ? Date.now() : now;
    var r = editableGoal(state, goalId);
    if (r.error) return r.error;
    var m = findMilestone(r.goal, mid);
    if (!m) return { ok: false, reason: 'milestone-not-found' };
    var v = validateMilestone(patch, m);
    if (!v.ok) return { ok: false, reason: 'invalid', errors: v.errors };
    var changed = Object.keys(v.value).some(function (k) { return m[k] !== v.value[k]; });
    if (!changed) return { ok: true, goal: r.goal, milestone: m, changed: false };
    Object.keys(v.value).forEach(function (k) { m[k] = v.value[k]; });
    m.updatedAt = now; r.goal.updatedAt = now;
    ev(state, now, 'goal.milestone.updated', { goalId: goalId, milestoneId: mid });
    return { ok: true, goal: r.goal, milestone: m, changed: true };
  }

  function setMilestoneDone(state, goalId, mid, done, now) {
    now = now == null ? Date.now() : now;
    var r = editableGoal(state, goalId);
    if (r.error) return r.error;
    var m = findMilestone(r.goal, mid);
    if (!m) return { ok: false, reason: 'milestone-not-found' };
    if (m.done === !!done) return { ok: true, goal: r.goal, milestone: m, changed: false };
    m.done = !!done;
    m.completedAt = done ? now : null;
    m.updatedAt = now; r.goal.updatedAt = now;
    ev(state, now, done ? 'goal.milestone.completed' : 'goal.milestone.reopened', { goalId: goalId, milestoneId: mid });
    return { ok: true, goal: r.goal, milestone: m, changed: true };
  }
  function completeMilestone(state, goalId, mid, now) { return setMilestoneDone(state, goalId, mid, true, now); }
  function reopenMilestone(state, goalId, mid, now) { return setMilestoneDone(state, goalId, mid, false, now); }

  /** Move a milestone by `delta` positions (array order IS the milestone order). */
  function moveMilestone(state, goalId, mid, delta, now) {
    now = now == null ? Date.now() : now;
    var r = editableGoal(state, goalId);
    if (r.error) return r.error;
    var ms = r.goal.milestones;
    var from = -1;
    for (var i = 0; i < ms.length; i++) if (ms[i].id === mid) from = i;
    if (from < 0) return { ok: false, reason: 'milestone-not-found' };
    var to = Math.max(0, Math.min(ms.length - 1, from + Math.round(Number(delta) || 0)));
    if (to === from) return { ok: true, goal: r.goal, changed: false, index: from };
    var m = ms.splice(from, 1)[0];
    ms.splice(to, 0, m);
    r.goal.updatedAt = now;
    ev(state, now, 'goal.milestone.moved', { goalId: goalId, milestoneId: mid, from: from, to: to });
    return { ok: true, goal: r.goal, changed: true, index: to };
  }

  /** Deleting a milestone drops only the milestone and its links; tasks are untouched. */
  function removeMilestone(state, goalId, mid, now) {
    now = now == null ? Date.now() : now;
    var r = editableGoal(state, goalId);
    if (r.error) return r.error;
    var before = r.goal.milestones.length;
    r.goal.milestones = r.goal.milestones.filter(function (m) { return m.id !== mid; });
    if (r.goal.milestones.length === before) return { ok: false, reason: 'milestone-not-found' };
    r.goal.updatedAt = now;
    ev(state, now, 'goal.milestone.removed', { goalId: goalId, milestoneId: mid });
    return { ok: true, goal: r.goal, changed: true };
  }

  /* ── task links (references only) ───────────────────────────────── */
  function locationOf(goal, taskId) {
    if (!goal) return undefined;
    if (goal.taskIds.indexOf(taskId) >= 0) return null;
    for (var i = 0; i < goal.milestones.length; i++) {
      if (goal.milestones[i].taskIds.indexOf(taskId) >= 0) return goal.milestones[i].id;
    }
    return undefined;   // not linked
  }

  function stripTask(goal, taskId) {
    goal.taskIds = goal.taskIds.filter(function (id) { return id !== taskId; });
    goal.milestones.forEach(function (m) { m.taskIds = m.taskIds.filter(function (id) { return id !== taskId; }); });
  }

  /**
   * Link an existing task to the goal (milestoneId null) or to one milestone.
   * Linking it somewhere else in the same goal MOVES it, so one task never
   * counts twice towards the same goal.
   */
  function linkTask(state, goalId, taskId, milestoneId, now) {
    now = now == null ? Date.now() : now;
    var r = editableGoal(state, goalId);
    if (r.error) return r.error;
    taskId = idOf(taskId);
    var task = taskId ? store.find(state, taskId) : null;
    if (!task) return { ok: false, reason: 'task-not-found' };
    if (task.archived) return { ok: false, reason: 'task-archived' };
    var dest = milestoneId == null ? null : findMilestone(r.goal, milestoneId);
    if (milestoneId != null && !dest) return { ok: false, reason: 'milestone-not-found' };
    var from = locationOf(r.goal, taskId);
    var to = dest ? dest.id : null;
    if (from === to) return { ok: true, goal: r.goal, changed: false };
    stripTask(r.goal, taskId);
    (dest ? dest.taskIds : r.goal.taskIds).push(taskId);
    r.goal.updatedAt = now;
    ev(state, now, 'goal.task.linked', { goalId: goalId, milestoneId: to, taskId: taskId });
    return { ok: true, goal: r.goal, changed: true, moved: from !== undefined, from: from, to: to };
  }

  /** Unlinking only removes the reference (works for missing tasks too). */
  function unlinkTask(state, goalId, taskId, now) {
    now = now == null ? Date.now() : now;
    var r = editableGoal(state, goalId);
    if (r.error) return r.error;
    taskId = idOf(taskId);
    if (locationOf(r.goal, taskId) === undefined) return { ok: true, goal: r.goal, changed: false };
    stripTask(r.goal, taskId);
    r.goal.updatedAt = now;
    ev(state, now, 'goal.task.unlinked', { goalId: goalId, taskId: taskId });
    return { ok: true, goal: r.goal, changed: true };
  }

  /** Every linked task once, with its location and current status. */
  function taskRefs(state, goal, milestoneId) {
    if (!goal) return [];
    var out = [];
    function add(ids, mid) {
      ids.forEach(function (id) {
        var t = store.find(state, id);
        var status = !t ? 'missing' : t.archived ? 'archived' : t.done ? 'done' : 'open';
        out.push({ taskId: id, task: t, milestoneId: mid, status: status });
      });
    }
    if (milestoneId === undefined || milestoneId === null) add(goal.taskIds, null);
    goal.milestones.forEach(function (m) {
      if (milestoneId === undefined || milestoneId === m.id) add(m.taskIds, m.id);
    });
    return out;
  }

  function taskCounts(refs) {
    var c = { eligible: 0, done: 0, missing: 0, archived: 0 };
    refs.forEach(function (r) {
      if (r.status === 'missing') c.missing++;
      else if (r.status === 'archived') c.archived++;
      else { c.eligible++; if (r.status === 'done') c.done++; }
    });
    return c;
  }

  function pctOf(done, total) {
    if (!(total > 0)) return null;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }

  /**
   * Progress formulas (pct is null when the denominator is zero):
   * - milestones: completed milestones / all milestones
   * - tasks:      completed eligible linked tasks / eligible linked tasks
   *               (eligible = exists and not archived; each task counted once)
   * - target:     current value / target value, capped at 100 (overTarget flags more)
   * Goal status (e.g. manually "completed") never changes these numbers.
   */
  function progress(state, goal) {
    if (!goal) return null;
    var method = METHODS.indexOf(goal.progressMethod) >= 0 ? goal.progressMethod : 'milestones';
    var out = { method: method, pct: null, done: 0, total: 0, overTarget: false, missing: 0, archived: 0, unit: '' };
    if (method === 'milestones') {
      out.total = goal.milestones.length;
      out.done = goal.milestones.filter(function (m) { return m.done; }).length;
    } else if (method === 'tasks') {
      var c = taskCounts(taskRefs(state, goal));
      out.total = c.eligible; out.done = c.done; out.missing = c.missing; out.archived = c.archived;
    } else {
      var t = goal.target || {};
      out.total = t.value > 0 ? t.value : 0;
      out.done = t.current >= 0 ? t.current : 0;
      out.unit = t.unit || '';
      out.overTarget = out.total > 0 && out.done > out.total;
    }
    out.pct = pctOf(out.done, out.total);
    out.manualComplete = goal.status === 'completed';
    return out;
  }

  /** Milestone progress from its own linked tasks (null when it has none). */
  function milestoneProgress(state, goal, milestone) {
    var c = taskCounts(taskRefs(state, goal, milestone.id));
    return { done: c.done, total: c.eligible, missing: c.missing, archived: c.archived, pct: milestone.done ? 100 : pctOf(c.done, c.eligible) };
  }

  function nextMilestone(goal) {
    if (!goal) return null;
    for (var i = 0; i < goal.milestones.length; i++) if (!goal.milestones[i].done) return goal.milestones[i];
    return null;
  }

  /** days > 0 = still ahead, 0 = today, < 0 = overdue. */
  function deadlineInfo(deadline, today) {
    if (!dates.isDayKey(deadline) || !dates.isDayKey(today)) return null;
    var days = dates.diffDays(today, deadline);
    return { deadline: deadline, days: days, overdue: days < 0, soon: days >= 0 && days <= SOON_DAYS };
  }

  /** Open deadlines (goal + milestones) of non-archived, non-completed goals, soonest first. */
  function upcomingDeadlines(state, today, goal) {
    var out = [];
    (goal ? [goal] : list(state)).forEach(function (g) {
      if (g.archived || g.status === 'completed') return;
      var gi = deadlineInfo(g.deadline, today);
      if (gi) out.push(Object.assign({ kind: 'goal', goalId: g.id, title: g.title }, gi));
      g.milestones.forEach(function (m) {
        if (m.done) return;
        var mi = deadlineInfo(m.deadline, today);
        if (mi) out.push(Object.assign({ kind: 'milestone', goalId: g.id, milestoneId: m.id, title: m.title, goalTitle: g.title }, mi));
      });
    });
    return out.sort(function (a, b) { return a.days - b.days; });
  }

  /** Overview metrics, derived only from saved goals. */
  function overview(state, today) {
    var o = { total: 0, active: 0, completed: 0, archived: 0, milestonesDone: 0, milestonesTotal: 0, dueSoon: 0, overdue: 0 };
    list(state).forEach(function (g) {
      if (g.archived) { o.archived++; return; }
      o.total++;
      if (g.status === 'completed') o.completed++; else o.active++;
      o.milestonesTotal += g.milestones.length;
      o.milestonesDone += g.milestones.filter(function (m) { return m.done; }).length;
    });
    upcomingDeadlines(state, today).forEach(function (d) {
      if (d.overdue) o.overdue++;
      else if (d.soon) o.dueSoon++;
    });
    return o;
  }

  function categories(state) {
    var seen = {}, out = [];
    list(state).forEach(function (g) {
      var c = g.category;
      if (c && !seen[c.toLowerCase()]) { seen[c.toLowerCase()] = true; out.push(c); }
    });
    return out.sort();
  }

  /** Goals (non-archived) that reference a task — used to show context elsewhere. */
  function goalsForTask(state, taskId) {
    return list(state).filter(function (g) { return !g.archived && locationOf(g, taskId) !== undefined; });
  }

  /** Journal days linked to a goal, newest first. */
  function journalDays(state, goalId) {
    var map = isObj(state && state.journals) ? state.journals : {};
    return Object.keys(map).filter(function (day) {
      var e = map[day];
      return isObj(e) && isObj(e.goal) && e.goal.goalId === goalId;
    }).sort().reverse().map(function (day) {
      return { day: day, milestoneId: map[day].goal.milestoneId || null };
    });
  }

  return {
    STATUSES: STATUSES, STATUS_LABEL: STATUS_LABEL, METHODS: METHODS, METHOD_LABEL: METHOD_LABEL,
    SOON_DAYS: SOON_DAYS, LIMITS: LIMITS,
    normalize: normalize, cleanJournalLink: cleanJournalLink,
    list: list, find: find, findMilestone: findMilestone,
    validateGoal: validateGoal, validateMilestone: validateMilestone,
    createGoal: createGoal, updateGoal: updateGoal, setStatus: setStatus,
    completeGoal: completeGoal, reopenGoal: reopenGoal,
    archiveGoal: archiveGoal, restoreGoal: restoreGoal,
    addMilestone: addMilestone, updateMilestone: updateMilestone,
    completeMilestone: completeMilestone, reopenMilestone: reopenMilestone,
    moveMilestone: moveMilestone, removeMilestone: removeMilestone,
    linkTask: linkTask, unlinkTask: unlinkTask, locationOf: locationOf,
    taskRefs: taskRefs, progress: progress, milestoneProgress: milestoneProgress,
    nextMilestone: nextMilestone, deadlineInfo: deadlineInfo,
    upcomingDeadlines: upcomingDeadlines, overview: overview,
    categories: categories, goalsForTask: goalsForTask, journalDays: journalDays
  };
});
