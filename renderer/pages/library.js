(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host;
  var filterType = 'all';
  var search = '';
  var fileStatus = {};

  function state() { return app.rawState(); }
  function items() { return (state().library || []).slice(); }
  function parseIds(v) { return JF.library.uniqIds(String(v || '').split(',')); }
  async function recoverDeletions() {
    try {
      var r = await window.desk.libraryRecoverDeletions();
    } catch (e) { return; }
    var deleted = (r && r.deleted) || [];
    if (!deleted.length) return;
    state().library = state().library.filter(function (it) {
      return !(it.type === 'file' && deleted.indexOf(it.fileName) >= 0);
    });
    saveState();
  }
  async function loadFileStatus() {
    fileStatus = {};
    var files = items().filter(function (it) { return it.type === 'file'; }).map(function (it) { return it.fileName; }).filter(Boolean);
    if (!files.length) return;
    try {
      var r = await window.desk.libraryCheckFiles({ fileNames: files });
    } catch (e) { return; }
    if (r && r.ok && r.files) fileStatus = r.files;
  }
  function fileStatusFor(it) { return fileStatus[it.fileName] || { exists: null, reason: 'unchecked' }; }
  function fileAvailable(it) { var s = fileStatusFor(it); return s.exists === true && s.regular !== false; }

  async function mount(container) {
    ui = JF.ui; app = JF.app; host = container;
    var head = ui.el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' } });
    var addFile = ui.btn('Impor file', importFile, { primary: true });
    var addLink = ui.btn('Tambah tautan', addLinkModal, { ghost: true });
    var addNote = ui.btn('Tambah catatan', addNoteModal, { ghost: true });
    head.appendChild(addFile); head.appendChild(addLink); head.appendChild(addNote);
    container.appendChild(head);

    var controls = ui.el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' } });
    var tabs = ui.el('div.tabs');
    [['all','Semua'],['file','File'],['link','Tautan'],['note','Catatan']].forEach(function (p) {
      var b = ui.btn(p[1], function () { filterType = p[0]; render(); });
      b.dataset.f = p[0]; tabs.appendChild(b);
    });
    controls.appendChild(tabs);
    var inp = ui.el('input', { placeholder: 'Cari...', style: { flex: 1, minWidth: '180px' }, oninput: function (e) { search = e.target.value || ''; render(); } });
    controls.appendChild(inp);
    container.appendChild(controls);

    container.appendChild(ui.el('div', { id: 'lib-list' }));

    await recoverDeletions();
    await loadFileStatus();
    render();
  }

  function filtered() {
    var q = search.trim().toLowerCase();
    return items().filter(function (it) {
      if (filterType !== 'all' && it.type !== filterType) return false;
      if (q && (it.title + ' ' + (it.description || '') + ' ' + (it.noteText || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function render() {
    if (!host) return;
    Array.prototype.forEach.call(document.querySelectorAll('#page-library .tabs button'), function (b) {
      b.classList.toggle('on', b.dataset.f === filterType);
    });
    var list = ui.$('lib-list'); if (!list) return; ui.clear(list);
    var shown = filtered();
    if (!shown.length) { list.appendChild(ui.el('div.empty', ui.el('span.big', 'Library kosong'), 'Impor file, tautan, atau catatan untuk mulai.')); return; }
    shown.forEach(function (it) {
      var card = ui.el('div.card', { style: { marginBottom: '10px' } });
      card.appendChild(ui.el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } },
        ui.el('strong', it.title), ui.el('span.chip', it.type)));
      if (it.description) card.appendChild(ui.el('div.hint', it.description));
      if (it.type === 'file') {
        var st = fileStatusFor(it);
        var statusText = st.exists === true ? 'Tersedia' : st.exists === false ? 'File hilang' : 'Tidak diketahui';
        card.appendChild(ui.el('div.hint', 'File: ' + it.fileName + ' · ' + statusText));
      }
      if (it.type === 'link') card.appendChild(ui.el('div.hint', it.url));
      if (it.type === 'note') card.appendChild(ui.el('div.hint', (it.noteText || '').slice(0, 120)));
      var assoc = [];
      var missingRefs = new Set();
      JF.library.validateReferences(state()).forEach(function (p) { missingRefs.add(p.itemId + '|' + p.refId); });
      function refLabel(id, label) {
        if (missingRefs.has(it.id + '|' + id)) label += ' (ref hilang)';
        return label;
      }
      (it.taskIds || []).forEach(function (id) {
        var t = app.findTask(id);
        assoc.push('Tugas: ' + refLabel(id, t ? t.title : id));
      });
      (it.goalIds || []).forEach(function (id) {
        var g = state().goals.find(function (gg) { return gg.id === id; });
        assoc.push('Goal: ' + refLabel(id, g ? g.title : id));
      });
      (it.milestoneRefs || []).forEach(function (r) {
        var key = (r && r.goalId || '') + '/' + (r && r.milestoneId || '');
        var g = state().goals.find(function (gg) { return gg.id === r.goalId; });
        var m = g ? g.milestones.find(function (mm) { return mm.id === r.milestoneId; }) : null;
        var label = m ? g.title + '/' + m.title : (g ? g.title + '/' + key.split('/')[1] : key);
        if (missingRefs.has(it.id + '|' + key)) label += ' (ref hilang)';
        assoc.push('Milestone: ' + label);
      });
      if (assoc.length) card.appendChild(ui.el('div.hint', assoc.join(' · ')));
      var actions = ui.el('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } });
      if (it.type === 'file') actions.appendChild(ui.btn('Buka', function () { openFile(it); }, { sm: true, disabled: !fileAvailable(it) }));
      if (it.type === 'link') actions.appendChild(ui.btn('Buka tautan', function () { window.open(it.url); }, { sm: true }));
      actions.appendChild(ui.btn('Edit', function () { editItem(it); }, { ghost: true, sm: true }));
      actions.appendChild(ui.btn('Hapus', function () { removeItem(it); }, { danger: true, sm: true }));
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function saveState() { app.save(); render(); }

  async function importFile() {
    try {
      var pick = await window.desk.libraryPick();
      if (pick.canceled) return;
      if (pick.error) { ui.toast('Gagal memilih file: ' + pick.error, { kind: 'err' }); return; }
      var imp = await window.desk.libraryImport({ token: pick.token });
      if (!imp.ok) { ui.toast('Impor gagal: ' + imp.reason, { kind: 'err' }); return; }
      var item = JF.library.createItem({ type: 'file', title: imp.originalName, fileName: imp.fileName, originalName: imp.originalName, size: imp.size }, Date.now());
      state().library.push(item); JF.library.normalize(state(), Date.now());
      fileStatus[imp.fileName] = { exists: true, regular: true };
      saveState();
      ui.toast('File diimpor.', { kind: 'ok' });
    } catch (e) { ui.toast('Impor gagal.', { kind: 'err' }); }
  }

  function addLinkModal() {
    var title = '', url = '', desc = '', linkTaskIds = '', linkGoalIds = '';
    ui.modal({
      title: 'Tambah tautan',
      body: [
        ui.el('label.field', 'Judul', ui.el('input', { value: title, oninput: function (e) { title = e.target.value; } })),
        ui.el('label.field', 'URL', ui.el('input', { value: url, oninput: function (e) { url = e.target.value; } })),
        ui.el('label.field', 'Deskripsi', ui.el('textarea', { oninput: function (e) { desc = e.target.value; } })),
        ui.el('label.field', 'ID tugas (pisahkan koma)', ui.el('input', { placeholder: 'task_abc,task_def', oninput: function (e) { linkTaskIds = e.target.value; } })),
        ui.el('label.field', 'ID goal (pisahkan koma)', ui.el('input', { placeholder: 'goal_xyz', oninput: function (e) { linkGoalIds = e.target.value; } }))
      ],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan', primary: true, onClick: function () {
          try {
            var item = JF.library.createItem({ type: 'link', title: title, url: url, description: desc, taskIds: parseIds(linkTaskIds), goalIds: parseIds(linkGoalIds) }, Date.now());
            state().library.push(item); JF.library.normalize(state(), Date.now()); saveState();
          } catch (e) { ui.toast('URL atau ID tidak valid.', { kind: 'err' }); }
        } }
      ]
    });
  }

  function addNoteModal() {
    var title = '', text = '', noteTaskIds = '', noteGoalIds = '';
    ui.modal({
      title: 'Tambah catatan',
      body: [
        ui.el('label.field', 'Judul', ui.el('input', { oninput: function (e) { title = e.target.value; } })),
        ui.el('label.field', 'Isi', ui.el('textarea', { oninput: function (e) { text = e.target.value; } })),
        ui.el('label.field', 'ID tugas (pisahkan koma)', ui.el('input', { placeholder: 'task_abc,task_def', oninput: function (e) { noteTaskIds = e.target.value; } })),
        ui.el('label.field', 'ID goal (pisahkan koma)', ui.el('input', { placeholder: 'goal_xyz', oninput: function (e) { noteGoalIds = e.target.value; } }))
      ],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan', primary: true, onClick: function () {
          var item = JF.library.createItem({ type: 'note', title: title, noteText: text, taskIds: parseIds(noteTaskIds), goalIds: parseIds(noteGoalIds) }, Date.now());
          state().library.push(item); JF.library.normalize(state(), Date.now()); saveState();
        } }
      ]
    });
  }

  function editItem(it) {
    var title = it.title, desc = it.description || '', editTaskIds = (it.taskIds || []).join(','), editGoalIds = (it.goalIds || []).join(',');
    ui.modal({
      title: 'Edit item',
      body: [
        ui.el('label.field', 'Judul', ui.el('input', { value: title, oninput: function (e) { title = e.target.value; } })),
        ui.el('label.field', 'Deskripsi', ui.el('textarea', { oninput: function (e) { desc = e.target.value; } }, desc)),
        ui.el('label.field', 'ID tugas (pisahkan koma)', ui.el('input', { value: editTaskIds, oninput: function (e) { editTaskIds = e.target.value; } })),
        ui.el('label.field', 'ID goal (pisahkan koma)', ui.el('input', { value: editGoalIds, oninput: function (e) { editGoalIds = e.target.value; } }))
      ],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan', primary: true, onClick: function () {
          it.title = title; it.description = desc; it.taskIds = parseIds(editTaskIds); it.goalIds = parseIds(editGoalIds); it.updatedAt = Date.now();
          JF.library.normalize(state(), Date.now()); saveState();
        } }
      ]
    });
  }

  async function openFile(it) {
    var r = await window.desk.libraryOpen({ fileName: it.fileName });
    if (!r.ok) { fileStatus[it.fileName] = { exists: false, reason: 'open-failed', message: r.message }; render(); ui.toast('Gagal membuka file: ' + (r.message || r.reason), { kind: 'err' }); }
  }

  async function removeItem(it) {
    if (it.type === 'file') {
      var r = await window.desk.libraryDeleteFile({ fileName: it.fileName });
      if (!r.ok) { ui.toast('Gagal menghapus file: ' + r.reason, { kind: 'err' }); return; }
      if (r.alreadyMissing) ui.toast('File sudah tidak ada; metadata dihapus.', { kind: 'ok' });
      delete fileStatus[it.fileName];
    }
    state().library = state().library.filter(function (x) { return x.id !== it.id; });
    saveState();
    ui.toast('Item dihapus.', { kind: 'ok' });
  }

  JF.pages.register({ id: 'library', title: 'Library', sub: function () { return items().length + ' item'; }, mount: mount, render: render });
})(typeof self !== 'undefined' ? self : this);
