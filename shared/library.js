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
  /* Source modules. Any module id matching MODULE_ID_RE is accepted so future
     features can register documents without touching this file; labels are
     only for display and fall back to the id. */
  var MODULE_ID_RE = /^[a-z][a-z0-9-]{0,31}$/;
  var MODULE_LABEL = { library: 'Impor langsung', goals: 'Goals', analitik: 'Analitik' };
  var TYPE_GROUPS = ['pdf', 'document', 'spreadsheet', 'presentation', 'image', 'other'];
  var TYPE_GROUP_LABEL = {
    pdf: 'PDF', document: 'Dokumen', spreadsheet: 'Spreadsheet', presentation: 'Presentasi',
    image: 'Gambar', other: 'Lainnya', link: 'Tautan', note: 'Catatan'
  };
  var EXT_GROUP = {
    pdf: 'pdf',
    doc: 'document', docx: 'document', odt: 'document', rtf: 'document', txt: 'document', md: 'document',
    xls: 'spreadsheet', xlsx: 'spreadsheet', ods: 'spreadsheet', csv: 'spreadsheet',
    ppt: 'presentation', pptx: 'presentation', odp: 'presentation',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image'
  };

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
  /* Legacy items have no source: they were imported directly into Library. */
  function normSource(src) {
    var mod = isObj(src) && typeof src.module === 'string' && MODULE_ID_RE.test(src.module) ? src.module : 'library';
    var entityId = isObj(src) ? idOf(src.entityId) : null;
    return { module: mod, entityId: entityId };
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
      source: normSource(it.source),
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
      if (typeof it.contentHash === 'string' && /^[0-9a-f]{64}$/.test(it.contentHash)) base.contentHash = it.contentHash;
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
      milestoneRefs: input && input.milestoneRefs,
      source: input && input.source
    };
    if (input && input.type === 'file') {
      item.fileName = input.fileName;
      ['originalName', 'mimeType', 'size', 'contentHash'].forEach(function (k) { if (input[k] != null) item[k] = input[k]; });
    }
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

  /* ── automatic integration layer ──────────────────────────────────────
     Feature -> registerFile() -> Library item (metadata) -> source relations.
     Library owns document metadata; other modules only hold item ids or are
     found through item.taskIds. Context (goal/milestone) is DERIVED from the
     live goal links so it stays correct when a task is moved. */
  function list(state) { return state && Array.isArray(state.library) ? state.library : []; }
  function extOf(name) {
    var m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }
  function typeGroup(it) {
    if (!it) return 'other';
    if (it.type === 'link' || it.type === 'note') return it.type;
    var g = EXT_GROUP[extOf(it.originalName) || extOf(it.fileName)];
    if (!g && typeof it.mimeType === 'string') {
      if (it.mimeType === 'application/pdf') g = 'pdf';
      else if (/^image\//.test(it.mimeType)) g = 'image';
    }
    return g || 'other';
  }
  function moduleLabel(id) { return MODULE_LABEL[id] || id || MODULE_LABEL.library; }
  function registerModule(id, label) {
    if (typeof id === 'string' && MODULE_ID_RE.test(id) && !MODULE_LABEL[id]) MODULE_LABEL[id] = trimmed(label, 40) || id;
  }
  function fileItems(state) { return list(state).filter(function (it) { return it.type === 'file'; }); }
  function findById(state, id) {
    var r = list(state).filter(function (it) { return it.id === id; });
    return r.length ? r[0] : null;
  }
  function findByHash(state, hash) {
    if (!hash) return null;
    var r = fileItems(state).filter(function (it) { return it.contentHash === hash; });
    return r.length ? r[0] : null;
  }
  function findByFileName(state, fileName) {
    var r = fileItems(state).filter(function (it) { return it.fileName === fileName; });
    return r.length ? r[0] : null;
  }
  /** Documents attached to one task (the task never stores file records itself). */
  function attachmentsForTask(state, taskId) {
    taskId = idOf(taskId);
    if (!taskId) return [];
    return fileItems(state).filter(function (it) { return it.taskIds.indexOf(taskId) >= 0; });
  }
  /** Where a task sits right now: [{goal, milestone|null}] from live goal links. */
  function locateTask(state, taskId) {
    var out = [];
    (Array.isArray(state && state.goals) ? state.goals : []).forEach(function (g) {
      if (!g) return;
      if ((g.taskIds || []).indexOf(taskId) >= 0) out.push({ goal: g, milestone: null });
      (g.milestones || []).forEach(function (m) {
        if (m && (m.taskIds || []).indexOf(taskId) >= 0) out.push({ goal: g, milestone: m });
      });
    });
    return out;
  }
  /** Context a new attachment inherits from its task (ids only). */
  function taskContext(state, taskId) {
    var ctx = { taskIds: [], goalIds: [], milestoneRefs: [] };
    taskId = idOf(taskId);
    if (!taskId) return ctx;
    ctx.taskIds.push(taskId);
    locateTask(state, taskId).forEach(function (loc) {
      if (ctx.goalIds.indexOf(loc.goal.id) < 0) ctx.goalIds.push(loc.goal.id);
      if (loc.milestone) ctx.milestoneRefs.push({ goalId: loc.goal.id, milestoneId: loc.milestone.id });
    });
    return ctx;
  }
  function mergeContext(item, ctx) {
    var before = JSON.stringify([item.taskIds, item.goalIds, item.milestoneRefs]);
    item.taskIds = uniqIds(item.taskIds.concat(ctx.taskIds || []));
    item.goalIds = uniqIds(item.goalIds.concat(ctx.goalIds || []));
    var seen = {};
    item.milestoneRefs = item.milestoneRefs.concat((ctx.milestoneRefs || []).map(normMilestoneRef).filter(Boolean))
      .filter(function (r) { var k = r.goalId + '/' + r.milestoneId; if (seen[k]) return false; seen[k] = true; return true; });
    return before !== JSON.stringify([item.taskIds, item.goalIds, item.milestoneRefs]);
  }
  function ev(state, now, kind, taskId, data) {
    if (!Array.isArray(state.events)) return;
    var e = { at: now, kind: kind, taskId: taskId || null };
    if (data) e.data = data;
    state.events.push(e);
    if (state.events.length > 5000) state.events.splice(0, state.events.length - 5000);
  }
  /**
   * Register a managed file. input: { fileName, originalName, size, mimeType,
   * contentHash, source:{module, entityId}, taskId?, title?, description? }.
   * Never creates a second record for bytes already in Library (same hash or
   * same managed file name): the existing document just gains the new context.
   * Returns { ok, item, existing, changed } or { ok:false, reason }.
   */
  function registerFile(state, input, now) {
    if (!state || typeof state !== 'object' || !isObj(input)) return { ok: false, reason: 'bad-input' };
    now = now == null ? Date.now() : now;
    if (!Array.isArray(state.library)) state.library = [];
    var fileName = safeFileName(input.fileName);
    if (!fileName) return { ok: false, reason: 'bad-file-name' };
    var ctx = input.taskId != null ? taskContext(state, input.taskId) : { taskIds: [], goalIds: [], milestoneRefs: [] };
    var existing = findByHash(state, input.contentHash) || findByFileName(state, fileName);
    if (existing) {
      var changed = mergeContext(existing, ctx);
      if (changed) existing.updatedAt = now;
      if (!existing.contentHash && input.contentHash) { existing.contentHash = input.contentHash; changed = true; }
      if (changed) ev(state, now, 'library.document.linked', ctx.taskIds[0] || null, { documentId: existing.id });
      return { ok: true, item: existing, existing: true, changed: changed };
    }
    var item;
    try {
      item = createItem({
        type: 'file', title: input.title || input.originalName || fileName, description: input.description,
        fileName: fileName, originalName: input.originalName, mimeType: input.mimeType, size: input.size,
        contentHash: input.contentHash, source: input.source,
        taskIds: ctx.taskIds, goalIds: ctx.goalIds, milestoneRefs: ctx.milestoneRefs
      }, now);
    } catch (e) { return { ok: false, reason: 'invalid-item' }; }
    state.library.push(item);
    ev(state, now, 'library.document.added', ctx.taskIds[0] || null, { documentId: item.id, module: item.source.module });
    return { ok: true, item: item, existing: false, changed: true };
  }
  /** Other documents using the same managed file (so a shared file is never deleted early). */
  function fileRefCount(state, fileName, exceptId) {
    return fileItems(state).filter(function (it) { return it.fileName === fileName && it.id !== exceptId; }).length;
  }
  /**
   * Remove a document from Library metadata. Completed tasks keep their own
   * deliverable snapshot, so history is never erased here.
   * Returns { ok, item, orphanFile } - orphanFile is the managed file name the
   * caller should delete, or null when another document still uses the file.
   */
  function removeDocument(state, id, now) {
    now = now == null ? Date.now() : now;
    var item = findById(state, id);
    if (!item) return { ok: false, reason: 'not-found' };
    state.library = state.library.filter(function (it) { return it.id !== id; });
    var orphan = item.type === 'file' && !fileRefCount(state, item.fileName, id) ? item.fileName : null;
    ev(state, now, 'library.document.removed', item.taskIds[0] || null, { documentId: id, title: item.title });
    return { ok: true, item: item, orphanFile: orphan };
  }
  /**
   * Detach a document from one task. If the task was the document's only
   * origin and nothing else references it, the document is removed too.
   */
  function detachFromTask(state, id, taskId, now) {
    now = now == null ? Date.now() : now;
    var item = findById(state, id);
    taskId = idOf(taskId);
    if (!item || !taskId) return { ok: false, reason: 'not-found' };
    if (item.taskIds.indexOf(taskId) < 0) return { ok: true, item: item, changed: false, removed: false, orphanFile: null };
    item.taskIds = item.taskIds.filter(function (t) { return t !== taskId; });
    item.updatedAt = now;
    ev(state, now, 'library.document.detached', taskId, { documentId: id });
    var ownOrigin = item.source.module === 'goals' && item.source.entityId === taskId;
    if (ownOrigin && !item.taskIds.length) {
      var r = removeDocument(state, id, now);
      return { ok: true, item: item, changed: true, removed: true, orphanFile: r.orphanFile };
    }
    return { ok: true, item: item, changed: true, removed: false, orphanFile: null };
  }
  /**
   * Deliverable check for a task that requires output.
   * availableFileNames = managed files verified to exist by the main process;
   * when omitted nothing is considered verified.
   */
  function deliverableCheck(state, taskId, availableFileNames) {
    var docs = attachmentsForTask(state, taskId);
    if (!docs.length) return { ok: false, reason: 'output-required', attached: 0, available: 0 };
    var avail = {};
    (Array.isArray(availableFileNames) ? availableFileNames : []).forEach(function (n) { avail[n] = true; });
    var ok = docs.filter(function (d) { return avail[d.fileName] === true; });
    if (!ok.length) return { ok: false, reason: 'output-missing', attached: docs.length, available: 0 };
    return { ok: true, attached: docs.length, available: ok.length, documents: ok };
  }
  /** Compact history of what was attached when a task was completed. */
  function deliverableSnapshot(state, taskId, now) {
    return attachmentsForTask(state, taskId).map(function (d) {
      return { id: d.id, title: d.title, fileName: d.fileName, at: now };
    });
  }
  /**
   * Human-readable context paths for one item, derived from live relations:
   * [{ goal, milestone, task, label }] ("Goal → Milestone → Task").
   * Falls back to stored refs for legacy/orphaned relations; empty = standalone.
   */
  function contextPaths(state, it) {
    var out = [], seen = {};
    function push(goal, ms, task) {
      var parts = [];
      if (goal) parts.push(goal.title || goal.id);
      if (ms) parts.push(ms.title || ms.id);
      if (task) parts.push(task.title || task.id);
      var label = parts.join(' → ');
      if (!label || seen[label]) return;
      seen[label] = true;
      out.push({
        goal: goal ? { id: goal.id, title: goal.title } : null,
        milestone: ms ? { id: ms.id, title: ms.title } : null,
        task: task ? { id: task.id, title: task.title } : null,
        label: label
      });
    }
    if (!it) return out;
    var tasks = Array.isArray(state && state.tasks) ? state.tasks : [];
    var goals = Array.isArray(state && state.goals) ? state.goals : [];
    it.taskIds.forEach(function (tid) {
      var task = tasks.filter(function (t) { return t && t.id === tid; })[0] || { id: tid, title: 'Tugas tidak ditemukan' };
      var locs = locateTask(state, tid);
      if (locs.length) locs.forEach(function (l) { push(l.goal, l.milestone, task); });
      else push(null, null, task);
    });
    if (!it.taskIds.length || !out.length) {
      it.milestoneRefs.forEach(function (r) {
        var g = goals.filter(function (x) { return x && x.id === r.goalId; })[0];
        var m = g ? (g.milestones || []).filter(function (x) { return x && x.id === r.milestoneId; })[0] : null;
        if (g) push(g, m || { id: r.milestoneId, title: r.milestoneId }, null);
      });
      it.goalIds.forEach(function (gid) {
        var g = goals.filter(function (x) { return x && x.id === gid; })[0];
        if (g && !out.some(function (p) { return p.goal && p.goal.id === gid; })) push(g, null, null);
      });
    }
    return out;
  }
  /** Overview numbers for the Library header. statusMap: fileName -> {exists}. */
  function overview(state, statusMap, now, recentMs) {
    now = now == null ? Date.now() : now;
    recentMs = recentMs || 7 * 86400000;
    var o = { total: 0, recent: 0, missing: 0, byType: {} };
    list(state).forEach(function (it) {
      o.total++;
      if (it.createdAt >= now - recentMs) o.recent++;
      var g = typeGroup(it);
      o.byType[g] = (o.byType[g] || 0) + 1;
      if (it.type === 'file' && statusMap && statusMap[it.fileName] && statusMap[it.fileName].exists === false) o.missing++;
    });
    return o;
  }
  /** Pure search/filter/sort used by the Library page. */
  /* Hari (zona waktu perangkat) saat dokumen ditambahkan, format YYYY-MM-DD. */
  function addedDay(ms) {
    var d = new Date(ms), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function query(state, opts, statusMap) {
    opts = opts || {};
    var q = String(opts.search || '').trim().toLowerCase();
    var rows = list(state).filter(function (it) {
      if (opts.date && addedDay(it.createdAt) !== opts.date) return false;
      if (opts.type && opts.type !== 'all' && typeGroup(it) !== opts.type) return false;
      if (opts.module && opts.module !== 'all' && it.source.module !== opts.module) return false;
      if (opts.goalId && opts.goalId !== 'all') {
        var inGoal = it.goalIds.indexOf(opts.goalId) >= 0 || it.milestoneRefs.some(function (r) { return r.goalId === opts.goalId; }) ||
          contextPaths(state, it).some(function (p) { return p.goal && p.goal.id === opts.goalId; });
        if (!inGoal) return false;
      }
      if (opts.milestoneId && opts.milestoneId !== 'all') {
        var inMs = it.milestoneRefs.some(function (r) { return r.milestoneId === opts.milestoneId; }) ||
          contextPaths(state, it).some(function (p) { return p.milestone && p.milestone.id === opts.milestoneId; });
        if (!inMs) return false;
      }
      if (opts.context === 'standalone' && contextPaths(state, it).length) return false;
      if (opts.context === 'task' && !it.taskIds.length) return false;
      if (opts.missingOnly && !(it.type === 'file' && statusMap && statusMap[it.fileName] && statusMap[it.fileName].exists === false)) return false;
      if (q) {
        var hay = (it.title + ' ' + (it.originalName || '') + ' ' + (it.description || '') + ' ' + (it.noteText || '') + ' ' + (it.url || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var by = opts.sort || 'date';
    rows.sort(function (a, b) {
      if (by === 'name') return a.title.localeCompare(b.title, 'id');
      if (by === 'type') return typeGroup(a).localeCompare(typeGroup(b)) || a.title.localeCompare(b.title, 'id');
      return b.createdAt - a.createdAt;
    });
    return rows;
  }
  return {
    TYPES: TYPES, LIMITS: LIMITS,
    TYPE_GROUPS: TYPE_GROUPS, TYPE_GROUP_LABEL: TYPE_GROUP_LABEL,
    typeGroup: typeGroup, moduleLabel: moduleLabel, registerModule: registerModule, addedDay: addedDay,
    findById: findById, findByHash: findByHash, findByFileName: findByFileName,
    attachmentsForTask: attachmentsForTask, taskContext: taskContext, registerFile: registerFile,
    fileRefCount: fileRefCount, removeDocument: removeDocument, detachFromTask: detachFromTask,
    deliverableCheck: deliverableCheck, deliverableSnapshot: deliverableSnapshot,
    contextPaths: contextPaths, overview: overview, query: query,
    normalize: normalize, createItem: createItem,
    validUrl: validUrl, safeFileName: safeFileName, uniqIds: uniqIds,
    validateReferences: validateReferences
  };
});
