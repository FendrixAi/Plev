/* Jam Fokus — Attachment/Import service (renderer).
   Feature -> JF.documents -> managed file (main process) -> Library metadata.
   Every module that produces or attaches a file calls ONE of these functions
   and never touches Library records or IPC directly, so registration, dedupe,
   context inheritance and cleanup behave identically everywhere.
   Future modules: JF.documents.registerGenerated({ module: 'xyz', ... }). */
(function (root) {
  'use strict';
  var JF = root.JF;
  var status = {};          // managed fileName -> { exists, regular, reason }
  var MESSAGES = {
    'source-missing': 'File sumber tidak ditemukan.', 'not-file': 'Itu bukan file biasa.',
    'too-large': 'File terlalu besar (maksimal 25 MB).', 'unsupported-type': 'Jenis file ini belum didukung.',
    'copy-failed': 'Gagal menyalin file.', 'bad-token': 'Pilihan file kedaluwarsa, coba lagi.',
    'token-expired': 'Pilihan file kedaluwarsa, coba lagi.', 'too-many': 'Maksimal 10 file sekaligus.',
    'invalid-item': 'Data file tidak valid.', 'bad-file-name': 'Nama file tidak valid.'
  };
  function msg(reason) { return MESSAGES[reason] || ('Gagal (' + reason + ')'); }
  function st() { return JF.app.rawState(); }
  function desk() { return root.desk; }

  function reuseHints() {
    return st().library.filter(function (it) { return it.type === 'file' && it.contentHash; })
      .map(function (it) { return { hash: it.contentHash, fileName: it.fileName }; });
  }

  /* ── availability ───────────────────────────────────────────────── */
  function refreshStatus(extraNames) {
    var names = st().library.filter(function (it) { return it.type === 'file'; }).map(function (it) { return it.fileName; });
    (extraNames || []).forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
    if (!names.length || !desk()) { status = {}; return Promise.resolve(status); }
    return desk().libraryCheckFiles({ fileNames: names }).then(function (r) {
      status = (r && r.ok && r.files) ? r.files : {};
      return status;
    }, function () { return status; });
  }
  /* Re-check availability when a page is shown, at most every 2s, and only
     re-render when something actually changed (so it can never loop). */
  var lastCheck = 0, checking = false;
  function ensureFresh(onChange) {
    if (checking || Date.now() - lastCheck < 2000) return;
    checking = true;
    var before = JSON.stringify(status);
    refreshStatus().then(function () {
      lastCheck = Date.now(); checking = false;
      if (JSON.stringify(status) !== before && onChange) onChange();
    }, function () { checking = false; });
  }
  function availability(it) {
    if (!it || it.type !== 'file') return 'n/a';
    var s = status[it.fileName];
    if (!s) return 'unknown';
    return s.exists === true && s.regular !== false ? 'ok' : 'missing';
  }
  function statusMap() { return status; }

  /* ── register one imported file (shared by every entry point) ───── */
  function registerImported(imp, source, taskId) {
    var r = JF.library.registerFile(st(), {
      fileName: imp.fileName, originalName: imp.originalName, size: imp.size, mimeType: imp.mimeType,
      contentHash: imp.hash, source: source, taskId: taskId
    }, Date.now());
    if (r.ok) status[imp.fileName] = { exists: true, regular: true };
    return r;
  }

  /** Reverse a copy that never got registered (never touches files other documents use). */
  function discardUnregistered(imp) {
    if (!imp || imp.reused || !desk()) return Promise.resolve();
    if (JF.library.findByFileName(st(), imp.fileName)) return Promise.resolve();
    return desk().libraryDeleteFile({ fileName: imp.fileName }).catch(function () {});
  }

  function importPicked(files, source, taskId) {
    var out = { added: [], linked: [], failed: [] };
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        return desk().libraryImport({ token: f.token, reuse: reuseHints() }).then(function (imp) {
          if (!imp || !imp.ok) { out.failed.push({ name: f.originalName, reason: imp && imp.reason || 'copy-failed' }); return; }
          var r = registerImported(imp, source, taskId);
          if (!r.ok) { out.failed.push({ name: f.originalName, reason: r.reason }); return discardUnregistered(imp); }
          (r.existing ? out.linked : out.added).push(r.item);
        }, function () { out.failed.push({ name: f.originalName, reason: 'copy-failed' }); });
      });
    });
    return chain.then(function () {
      if (out.added.length || out.linked.length) JF.app.save();
      return out;
    });
  }

  function pickAndImport(source, taskId) {
    if (!desk()) return Promise.resolve({ canceled: true, added: [], linked: [], failed: [] });
    return desk().libraryPick({ multiple: true }).then(function (p) {
      if (!p || p.canceled) return { canceled: true, added: [], linked: [], failed: [] };
      var errs = (p.errors || []).map(function (e) { return { name: e.name, reason: e.error }; });
      return importPicked(p.files || [], source, taskId).then(function (out) {
        out.failed = errs.concat(out.failed);
        return out;
      });
    });
  }

  /** Task attachment: context (task -> milestone -> goal) is inherited automatically. */
  function attachToTask(taskId, moduleId) {
    if (!JF.app.findTask(taskId)) return Promise.resolve({ canceled: false, added: [], linked: [], failed: [{ name: '', reason: 'task-not-found' }] });
    return pickAndImport({ module: moduleId || 'goals', entityId: taskId }, taskId);
  }
  /** Direct import: no goal or task needed. */
  function importStandalone() { return pickAndImport({ module: 'library', entityId: null }, null); }

  /**
   * Generic entry point for any module that generates a text file.
   * opts: { module, name, text | bytes, taskId?, entityId?, title?, description? }
   */
  function registerGenerated(opts) {
    opts = opts || {};
    if (!desk()) return Promise.resolve({ ok: false, reason: 'unavailable' });
    return desk().libraryStoreGenerated({ name: opts.name, text: opts.text, bytes: opts.bytes, reuse: reuseHints() }).then(function (imp) {
      if (!imp || !imp.ok) return { ok: false, reason: imp && imp.reason || 'copy-failed' };
      var r = JF.library.registerFile(st(), {
        fileName: imp.fileName, originalName: imp.originalName, size: imp.size, mimeType: imp.mimeType, contentHash: imp.hash,
        source: { module: opts.module, entityId: opts.entityId || null }, taskId: opts.taskId, title: opts.title, description: opts.description
      }, Date.now());
      if (!r.ok) return discardUnregistered(imp).then(function () { return { ok: false, reason: r.reason }; });
      status[imp.fileName] = { exists: true, regular: true };
      JF.app.save();
      return { ok: true, item: r.item, existing: r.existing };
    }, function () { return { ok: false, reason: 'copy-failed' }; });
  }

  /* ── open / remove ──────────────────────────────────────────────── */
  function open(it) {
    return desk().libraryOpen({ fileName: it.fileName }).then(function (r) {
      if (!r || !r.ok) {
        if (r && r.reason === 'missing') status[it.fileName] = { exists: false, reason: 'missing' };
        JF.app.emit('change');
        return { ok: false, reason: r && r.reason, message: r && r.message };
      }
      return { ok: true };
    });
  }
  function deleteOrphan(fileName) {
    if (!fileName) return Promise.resolve({ ok: true });
    return desk().libraryDeleteFile({ fileName: fileName }).then(function (r) {
      delete status[fileName];
      return r;
    });
  }
  /** Remove a document everywhere. Completed tasks keep their own deliverable history. */
  function removeDocument(it) {
    var r = JF.library.removeDocument(st(), it.id, Date.now());
    if (!r.ok) return Promise.resolve(r);
    JF.app.save();
    return deleteOrphan(r.orphanFile).then(function () { return r; }, function () { return r; });
  }
  /** Remove a document from one task; drops it entirely only if nothing else uses it. */
  function removeFromTask(it, taskId) {
    var r = JF.library.detachFromTask(st(), it.id, taskId, Date.now());
    if (!r.ok) return Promise.resolve(r);
    JF.app.save();
    return deleteOrphan(r.orphanFile).then(function () { return r; }, function () { return r; });
  }

  /** Names of this task's managed files that really exist on disk right now. */
  function verifiedFileNames(taskId) {
    var names = JF.library.attachmentsForTask(st(), taskId).map(function (d) { return d.fileName; });
    if (!names.length || !desk()) return Promise.resolve([]);
    return desk().libraryCheckFiles({ fileNames: names }).then(function (r) {
      var out = [];
      if (r && r.ok && r.files) names.forEach(function (n) { if (r.files[n] && r.files[n].exists === true && r.files[n].regular !== false) out.push(n); });
      return out;
    }, function () { return []; });
  }

  function fmtSize(n) {
    if (!(n >= 0)) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  var AVAIL_LABEL = { ok: 'Tersedia', missing: 'File hilang', unknown: 'Belum dicek', 'n/a': '' };

  JF.documents = {
    fmtSize: fmtSize, availLabel: function (it) { return AVAIL_LABEL[availability(it)]; },
    message: msg, refreshStatus: refreshStatus, ensureFresh: ensureFresh, availability: availability, statusMap: statusMap,
    attachToTask: attachToTask, importStandalone: importStandalone, registerGenerated: registerGenerated,
    open: open, removeDocument: removeDocument, removeFromTask: removeFromTask, verifiedFileNames: verifiedFileNames
  };
})(typeof self !== 'undefined' ? self : this);
