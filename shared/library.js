/* Jam Fokus — Library metadata (data layer).
   Library items live in state.library (array). They only REFERENCE existing
   tasks, goals, and milestones by id; those records are never duplicated.
   Only metadata is stored here; file bytes live in a managed user-data dir.
   UMD: browser -> window.JF.library, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model.js'));
  else root.JF = root.JF || {}, root.JF.library = factory(root.JF.model);
})(typeof self !== 'undefined' ? self : this, function (model) {
  'use strict';

  var TYPES = ['file', 'link', 'note'];
  var LIMITS = { title: 120, description: 2000, noteText: 50000, fileName: 260 };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v, max) { return v == null ? '' : String(v).slice(0, max); }
  function trimmed(v, max) { return v == null ? '' : String(v).trim().slice(0, max); }
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
  function validUrl(v) {
    if (typeof v !== 'string') return false;
    var s = v.trim();
    return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s);
  }
  function safeFileName(v) {
    if (typeof v !== 'string' || !v.trim()) return null;
    var s = v.trim();
    if (s.indexOf('/') >= 0 || s.indexOf('\\') >= 0 || s.indexOf('..') >= 0) return null;
    return s.slice(0, LIMITS.fileName);
  }
  function normMilestoneRef(r) {
    if (!isObj(r)) return null;
    var goalId = idOf(r.goalId), milestoneId = idOf(r.milestoneId);
    if (!goalId || !milestoneId) return null;
    return { goalId: goalId, milestoneId: milestoneId };
  }
  function normItem(it, now, usedIds) {
    if (!isObj(it)) return null;
    var type = TYPES.indexOf(it.type) >= 0 ? it.type : null;
    if (!type) return null;
    var id = idOf(it.id);
    if (!id || usedIds[id]) id = model.uid('lib');
    usedIds[id] = true;
    var createdAt = num(it.createdAt) > 0 ? num(it.createdAt) : now;
    var updatedAt = num(it.updatedAt) > 0 ? num(it.updatedAt) : createdAt;
    var base = {
      id: id,
      type: type,
      title: trimmed(it.title, LIMITS.title) || 'Tanpa judul',
      description: str(it.description, LIMITS.description),
      createdAt: createdAt,
      updatedAt: updatedAt,
      taskIds: uniqIds(it.taskIds),
      goalIds: uniqIds(it.goalIds),
      milestoneRefs: (Array.isArray(it.milestoneRefs) ? it.milestoneRefs : [])
        .map(normMilestoneRef).filter(Boolean)
    };
    if (type === 'file') {
      var fn = safeFileName(it.fileName || it.managedFileName);
      if (!fn) return null;
      base.fileName = fn;
      if (it.originalName != null) base.originalName = str(it.originalName, LIMITS.fileName);
      if (it.mimeType != null) base.mimeType = str(it.mimeType, 120);
      if (num(it.size) >= 0) base.size = num(it.size);
    } else if (type === 'link') {
      var url = typeof it.url === 'string' ? it.url.trim() : '';
      if (!validUrl(url)) return null;
      base.url = url;
    } else {
      base.noteText = str(it.noteText || it.text, LIMITS.noteText);
    }
    return base;
  }
  function normalize(state, now) {
    if (!state || typeof state !== 'object') return [];
    now = now == null ? Date.now() : now;
    var used = {};
    state.library = (Array.isArray(state.library) ? state.library : [])
      .map(function (it) { return normItem(it, now, used); })
      .filter(Boolean);
    return state.library;
  }
  function createItem(input, now) {
    now = now == null ? Date.now() : now;
    var item = {
      id: input && input.id ? input.id : model.uid('lib'),
      type: input && input.type,
      title: input && input.title,
      description: input && input.description,
      createdAt: now,
      updatedAt: now,
      taskIds: input && input.taskIds,
      goalIds: input && input.goalIds,
      milestoneRefs: input && input.milestoneRefs
    };
    if (input && input.type === 'file') item.fileName = input.fileName;
    if (input && input.type === 'link') item.url = input.url;
    if (input && input.type === 'note') item.noteText = input.noteText;
    var used = {};
    var n = normItem(item, now, used);
    if (!n) throw new Error('Invalid library item');
    return n;
  }
  function validateReferences(state) {
    const problems = [];
    if (!state || typeof state !== 'object') return problems;
    const taskIds = new Set();
    const goalIds = new Set();
    const milestoneIds = new Set();
    (Array.isArray(state.tasks) ? state.tasks : []).forEach(function (t) { if (t && t.id) taskIds.add(t.id); });
    (Array.isArray(state.goals) ? state.goals : []).forEach(function (g) {
      if (g && g.id) goalIds.add(g.id);
      (Array.isArray(g.milestones) ? g.milestones : []).forEach(function (m) { if (m && m.id) milestoneIds.add(m.id); });
    });
    (Array.isArray(state.library) ? state.library : []).forEach(function (it) {
      if (!it || !it.id) return;
      (it.taskIds || []).forEach(function (id) { if (!taskIds.has(id)) problems.push({ itemId: it.id, itemTitle: it.title, kind: 'task', refId: id }); });
      (it.goalIds || []).forEach(function (id) { if (!goalIds.has(id)) problems.push({ itemId: it.id, itemTitle: it.title, kind: 'goal', refId: id }); });
      (it.milestoneRefs || []).forEach(function (r) {
        if (!r || !r.goalId || !r.milestoneId || !goalIds.has(r.goalId) || !milestoneIds.has(r.milestoneId)) {
          problems.push({ itemId: it.id, itemTitle: it.title, kind: 'milestone', refId: String(r && r.goalId ? r.goalId : '') + ':' + String(r && r.milestoneId ? r.milestoneId : '') });
        }
      });
    });
    return problems;
  }
  return {
    TYPES: TYPES, LIMITS: LIMITS,
    normalize: normalize, createItem: createItem,
    validUrl: validUrl, safeFileName: safeFileName, uniqIds: uniqIds,
    validateReferences: validateReferences
  };
});
