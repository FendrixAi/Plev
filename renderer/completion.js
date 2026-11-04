/* Jam Fokus — Form "Tandai selesai".
   Dibuka dari dialog "Sesi fokus selesai". Isinya ringkasan pekerjaan dan
   lampiran (file apa pun atau tautan). Semuanya disimpan sebagai dokumen
   Library yang terhubung ke tugas, jadi tidak ada penyimpanan baru:
   - ringkasan  -> catatan Library
   - tautan     -> tautan Library
   - file       -> JF.documents.attachToTask (salinan terkelola + metadata)
   Tugas baru ditandai selesai saat "Simpan dan tandai selesai" ditekan. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var MODULE = 'tugas';
  var SUMMARY_MAX = 5000;

  // Label sumber di Library (didaftarkan sekali saat dimuat).
  if (JF.library && JF.library.registerModule) JF.library.registerModule(MODULE, 'Ringkasan tugas');

  function open(task, session, opts) {
    opts = opts || {};
    var ui = JF.ui, app = JF.app, L = JF.library, D = JF.documents;
    if (!task || !ui || !app || !L) return null;

    var taskId = task.id;
    var preexisting = {};
    L.attachmentsForTask(app.rawState(), taskId).forEach(function (d) { preexisting[d.id] = true; });
    var files = [];      // { item, fresh }
    var links = [];      // library items not yet pushed to state
    var summary = '';
    var finished = false;

    var listBox = ui.el('div.cmp-list');
    var linkUrl = ui.el('input', { type: 'url', placeholder: 'https://', 'aria-label': 'Alamat tautan' });
    var linkTitle = ui.el('input', { type: 'text', placeholder: 'Judul tautan (opsional)', 'aria-label': 'Judul tautan' });

    function row(label, meta, onRemove) {
      var r = ui.el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderTop: '1px solid var(--line)' } });
      r.appendChild(ui.el('span', { style: { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: label }, label));
      if (meta) r.appendChild(ui.el('span.chip', meta));
      if (onRemove) r.appendChild(ui.btn('Hapus', onRemove, { sm: true, ghost: true }));
      return r;
    }

    function renderList() {
      ui.clear(listBox);
      if (!files.length && !links.length) {
        listBox.appendChild(ui.el('div.hint', 'Belum ada lampiran. Boleh dikosongkan.'));
        return;
      }
      files.forEach(function (f) {
        var it = f.item;
        listBox.appendChild(row(it.title || it.originalName || it.fileName, f.fresh ? D.fmtSize(it.size) : 'sudah terlampir',
          f.fresh ? function () { removeFile(f); } : null));
      });
      links.forEach(function (it) {
        listBox.appendChild(row(it.title + ' · ' + it.url, 'tautan', function () {
          links = links.filter(function (x) { return x !== it; });
          renderList();
        }));
      });
    }

    function removeFile(f) {
      files = files.filter(function (x) { return x !== f; });
      renderList();
      var p = f.how === 'linked' ? D.removeFromTask(f.item, taskId) : D.removeDocument(f.item);
      return p.then(function () {}, function () {});
    }

    function pickFiles() {
      if (!D) return;
      D.attachToTask(taskId, MODULE).then(function (out) {
        if (out.canceled) return;
        out.added.forEach(function (it) { files.push({ item: it, fresh: true, how: 'added' }); });
        out.linked.forEach(function (it) {
          var fresh = !preexisting[it.id];
          if (!files.some(function (f) { return f.item.id === it.id; })) files.push({ item: it, fresh: fresh, how: 'linked' });
        });
        if (out.failed.length) {
          ui.toast(out.failed.map(function (x) { return (x.name ? x.name + ': ' : '') + D.message(x.reason); }).join(' '), { kind: 'err', timeout: 8000 });
        }
        renderList();
      }, function () { ui.toast('Gagal melampirkan file.', { kind: 'err' }); });
    }

    function addLink() {
      var url = String(linkUrl.value || '').trim();
      if (!url) return;
      var title = String(linkTitle.value || '').trim() || url.replace(/^https?:\/\//i, '').slice(0, 80);
      var ctx = L.taskContext(app.rawState(), taskId);
      var item;
      try {
        item = L.createItem({
          type: 'link', title: title, url: url,
          taskIds: ctx.taskIds, goalIds: ctx.goalIds, milestoneRefs: ctx.milestoneRefs,
          source: { module: MODULE, entityId: taskId }
        }, Date.now());
      } catch (e) {
        ui.toast('Alamat tidak valid. Gunakan http:// atau https://.', { kind: 'err' });
        return;
      }
      links.push(item);
      linkUrl.value = ''; linkTitle.value = '';
      renderList();
    }

    /* Berkas yang diimpor selama form terbuka dibatalkan bila form tidak disimpan. */
    function discardFiles() {
      var todo = files.filter(function (f) { return f.fresh; });
      files = []; links = [];
      return Promise.all(todo.map(function (f) {
        var p = f.how === 'linked' ? D.removeFromTask(f.item, taskId) : D.removeDocument(f.item);
        return p.then(function () {}, function () {});
      }));
    }

    function save() {
      var state = app.rawState(), now = Date.now();
      var ctx = L.taskContext(state, taskId);
      var text = String(summary || '').trim();
      if (text) {
        try {
          state.library.push(L.createItem({
            type: 'note', title: ('Ringkasan: ' + task.title).slice(0, 120), noteText: text,
            taskIds: ctx.taskIds, goalIds: ctx.goalIds, milestoneRefs: ctx.milestoneRefs,
            source: { module: MODULE, entityId: taskId }
          }, now));
        } catch (e) { ui.toast('Ringkasan gagal disimpan.', { kind: 'err' }); return false; }
      }
      links.forEach(function (it) { state.library.push(it); });
      links = [];
      app.save();
      finished = true;
      app.completeTask(taskId);
      if (typeof opts.onDone === 'function') opts.onDone();
    }

    var sub = session && session.plannedSec
      ? 'Fokus ' + ui.fmt.dur(session.plannedSec) + ' tercatat.' : 'Tulis ringkasan singkat dan lampirkan hasilnya bila ada.';

    var ta = ui.el('textarea', {
      rows: 5, maxlength: String(SUMMARY_MAX), placeholder: 'Apa yang sudah dikerjakan? Hasil, temuan, atau hal yang perlu diingat.',
      'aria-label': 'Ringkasan pekerjaan', style: { width: '100%' },
      oninput: function (e) { summary = e.target.value; }
    });

    var body = [
      ui.el('div', ui.el('strong', task.title)),
      ui.el('div.hint', { style: { marginTop: '2px' } }, sub),
      ui.el('label.field', { style: { marginTop: '12px' } }, 'Ringkasan', ta)
    ];
    var attach = ui.el('div', { style: { marginTop: '12px' } });
    attach.appendChild(ui.el('div.k', { style: { fontSize: '12px', color: 'var(--muted)', fontWeight: '600', marginBottom: '6px' } }, 'Lampiran (file apa pun atau tautan)'));
    if (task.requiresOutput) attach.appendChild(ui.el('div.hint', { style: { marginBottom: '6px' } }, 'Tugas ini butuh file output: lampirkan minimal satu file.'));
    var pickRow = ui.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' } });
    pickRow.appendChild(ui.btn('Lampirkan file', pickFiles, { sm: true }));
    attach.appendChild(pickRow);
    var linkRow = ui.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' } });
    linkUrl.style.flex = '2 1 180px'; linkTitle.style.flex = '1 1 120px';
    linkUrl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addLink(); } });
    linkRow.appendChild(linkUrl); linkRow.appendChild(linkTitle);
    linkRow.appendChild(ui.btn('Tambah tautan', addLink, { sm: true, ghost: true }));
    attach.appendChild(linkRow);
    attach.appendChild(listBox);
    body.push(attach);
    renderList();

    return ui.modal({
      title: 'Tandai selesai', wide: true, dismiss: false, body: body,
      actions: [
        { label: 'Batal', ghost: true, onClick: function () {
          discardFiles().then(function () { if (typeof opts.onCancel === 'function') opts.onCancel(); });
        } },
        { label: 'Simpan dan tandai selesai', primary: true, onClick: function () { return save(); } }
      ],
      onClose: function () { if (!finished) discardFiles(); }
    });
  }

  JF.completion = { open: open };
})(typeof self !== 'undefined' ? self : this);
