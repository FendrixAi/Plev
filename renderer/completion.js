/* Jam Fokus — Form "Tandai selesai".
   Dibuka dari dialog "Sesi fokus selesai". Isinya ringkasan pekerjaan dan
   lampiran (file apa pun atau tautan). Semuanya disimpan sebagai dokumen
   Library yang terhubung ke tugas, jadi tidak ada penyimpanan baru:
   - ringkasan  -> catatan Library
   - tautan     -> tautan Library
   - file       -> JF.documents.attachToTask (salinan terkelola + metadata)
   Tugas baru ditandai selesai saat "Simpan dan tandai selesai" ditekan.
   Mode 'edit' (tugas sudah selesai) hanya menyimpan ringkasan dan lampiran.
   Juga menyediakan pembaca ringkasan (view / summaryBlock / chip / reportSection)
   untuk Tugas, Riwayat, Laporan harian, dan Capybara World. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var MODULE = 'tugas';
  var SUMMARY_MAX = 5000;

  // Label sumber di Library (didaftarkan sekali saat dimuat).
  if (JF.library && JF.library.registerModule) JF.library.registerModule(MODULE, 'Ringkasan tugas');


  /* ── membaca ringkasan & lampiran sebuah tugas ─────────────────────── */
  function forTask(taskId) {
    var state = JF.app.rawState(), L = JF.library;
    var items = (state.library || []).filter(function (it) { return it.taskIds && it.taskIds.indexOf(taskId) >= 0; });
    var notes = items.filter(function (it) { return it.type === 'note' && it.source && it.source.module === MODULE; })
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    var links = items.filter(function (it) { return it.type === 'link'; });
    var files = items.filter(function (it) { return it.type === 'file'; });
    return { summary: notes[0] || null, links: links, files: files, count: links.length + files.length,
      any: !!notes[0] || links.length + files.length > 0 };
  }
  function preview(text, max) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1).replace(/\s+$/, '') + '…' : t;
  }
  function openLink(url) { try { window.open(url); } catch (e) {} }

  function openFileItem(it) {
    var ui = JF.ui, D = JF.documents;
    D.open(it).then(function (r) {
      if (!r.ok) ui.toast('Gagal membuka file: ' + D.message(r.message || r.reason), { kind: 'err' });
    });
  }

  /** Pembaca: ringkasan penuh, tautan, dan file. Dari sini ringkasan bisa diubah. */
  function view(taskId) {
    var ui = JF.ui, app = JF.app;
    var t = app.findTask(taskId);
    if (!t) return null;
    var info = forTask(taskId);
    var body = [ui.el('div', ui.el('strong', t.title))];
    body.push(info.summary && info.summary.noteText
      ? ui.el('div', { style: { whiteSpace: 'pre-wrap', margin: '10px 0', lineHeight: '1.5' } }, info.summary.noteText)
      : ui.el('div.hint', { style: { margin: '10px 0' } }, 'Belum ada ringkasan untuk tugas ini.'));
    function line(label, meta, onOpen) {
      var r = ui.el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderTop: '1px solid var(--line)' } });
      r.appendChild(ui.el('span', { style: { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: label }, label));
      if (meta) r.appendChild(ui.el('span.chip', meta));
      r.appendChild(ui.btn('Buka', onOpen, { sm: true, ghost: true }));
      return r;
    }
    if (info.count) {
      body.push(ui.el('div.k', { style: { fontSize: '12px', color: 'var(--muted)', fontWeight: '600', margin: '8px 0 2px' } }, 'Lampiran'));
      info.files.forEach(function (it) { body.push(line(it.title || it.originalName || it.fileName, 'file', function () { openFileItem(it); })); });
      info.links.forEach(function (it) { body.push(line(it.title + ' · ' + it.url, 'tautan', function () { openLink(it.url); })); });
    }
    return ui.modal({
      title: 'Ringkasan tugas', wide: true, body: body,
      actions: [
        { label: 'Tutup', ghost: true },
        { label: info.summary ? 'Ubah ringkasan' : 'Tambah ringkasan', primary: true, onClick: function () { open(t, null, { mode: 'edit' }); } }
      ]
    });
  }

  /** Blok ringkas untuk kartu tugas selesai. opts: { chip, hint, button(label, fn) } agar cocok di tiap tampilan. */
  function summaryBlock(task, opts) {
    var ui = JF.ui;
    if (!task || !task.done) return null;
    opts = opts || {};
    var info = forTask(task.id);
    var box = ui.el('div', { style: { marginTop: '6px' } });
    function btn(label) {
      var fn = function () { if (info.any) view(task.id); else open(task, null, { mode: 'edit' }); };
      return opts.button ? opts.button(label, fn) : ui.btn(label, fn, { sm: true, ghost: true });
    }
    if (info.summary && info.summary.noteText) {
      box.appendChild(ui.el(opts.hint || 'div.hint', { style: { margin: '0 0 4px', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' } },
        preview(info.summary.noteText, 220)));
    }
    var row = ui.el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } });
    if (info.files.length) row.appendChild(ui.el(opts.chip || 'span.chip.outline', info.files.length + ' file'));
    if (info.links.length) row.appendChild(ui.el(opts.chip || 'span.chip.outline', info.links.length + ' tautan'));
    row.appendChild(btn(info.any ? 'Lihat ringkasan' : 'Tambah ringkasan'));
    box.appendChild(row);
    return box;
  }

  /** Chip kecil "Ringkasan" bila tugas punya ringkasan atau lampiran (null bila tidak). */
  function chip(taskId, opts) {
    var ui = JF.ui;
    var t = JF.app.findTask(taskId);
    if (!t || !forTask(taskId).any) return null;
    opts = opts || {};
    var b = ui.el('button', { type: 'button', class: opts.cls || 'chip outline', title: 'Lihat ringkasan tugas',
      style: { cursor: 'pointer', font: 'inherit' }, onclick: function () { view(taskId); } }, 'Ringkasan');
    return b;
  }

  /** Bagian "Ringkasan tugas selesai" untuk Laporan harian (null bila tidak ada satu pun). */
  function reportSection(taskIds) {
    var ui = JF.ui, app = JF.app;
    var rows = [];
    (taskIds || []).forEach(function (id) {
      var t = app.findTask(id);
      if (!t || !t.done) return;
      var info = forTask(id);
      if (info.any) rows.push({ t: t, info: info });
    });
    if (!rows.length) return null;
    var box = ui.el('div', { style: { marginTop: '10px' } });
    box.appendChild(ui.el('div.k', { style: { fontSize: '12px', color: 'var(--muted)', fontWeight: '600', marginBottom: '4px' } }, 'Ringkasan tugas selesai'));
    rows.forEach(function (x) {
      var r = ui.el('div', { style: { padding: '6px 0', borderTop: '1px solid var(--line)' } });
      r.appendChild(ui.el('div', ui.el('strong', x.t.title)));
      var blk = summaryBlock(x.t);
      if (blk) r.appendChild(blk);
      box.appendChild(r);
    });
    box.appendChild(ui.el('div.hint', { style: { marginTop: '4px' } }, 'Ditampilkan dari catatan terbaru; angka laporan di atas tetap final.'));
    return box;
  }

  /** Mulai alur "Selesai + ringkasan" untuk satu tugas dari halaman mana pun. */
  function start(taskId) {
    var t = JF.app.findTask(taskId);
    if (!t || t.done || t.archived) return false;
    open(t, null, {});
    return true;
  }

  function open(task, session, opts) {
    opts = opts || {};
    var ui = JF.ui, app = JF.app, L = JF.library, D = JF.documents;
    if (!task || !ui || !app || !L) return null;

    var taskId = task.id;
    var edit = opts.mode === 'edit';
    var existing = forTask(taskId);
    var preexisting = {};
    L.attachmentsForTask(app.rawState(), taskId).forEach(function (d) { preexisting[d.id] = true; });
    var files = [];      // { item, fresh }
    var links = [];      // library items not yet pushed to state
    var summary = existing.summary ? String(existing.summary.noteText || '') : '';
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
      var had = edit ? existing.files.concat(existing.links) : [];
      if (!files.length && !links.length && !had.length) {
        listBox.appendChild(ui.el('div.hint', 'Belum ada lampiran. Boleh dikosongkan.'));
        return;
      }
      if (edit) {
        had.forEach(function (it) {
          if (files.some(function (f) { return f.item.id === it.id; })) return;
          listBox.appendChild(row(it.type === 'link' ? it.title + ' · ' + it.url : (it.title || it.originalName || it.fileName), 'sudah terlampir', null));
        });
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
      var prev = existing.summary && state.library.indexOf(existing.summary) >= 0 ? existing.summary : null;
      if (prev) {
        if (text) { prev.noteText = text.slice(0, 50000); prev.updatedAt = now; }
        else state.library = state.library.filter(function (it) { return it !== prev; });
      } else if (text) {
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
      if (!edit) app.completeTask(taskId);
      if (app.emit) app.emit('change');
      if (edit) ui.toast('Ringkasan disimpan.', { kind: 'ok' });
      if (typeof opts.onDone === 'function') opts.onDone();
    }

    var running = app.currentSession && app.currentSession();
    var runningHere = !edit && running && running.taskId === taskId && (running.state === 'running' || running.state === 'paused');
    var sub = session && session.plannedSec
      ? 'Fokus ' + ui.fmt.dur(session.plannedSec) + ' tercatat.' : 'Tulis ringkasan singkat dan lampirkan hasilnya bila ada.';

    var ta = ui.el('textarea', {
      rows: 5, maxlength: String(SUMMARY_MAX), placeholder: 'Apa yang sudah dikerjakan? Hasil, temuan, atau hal yang perlu diingat.',
      'aria-label': 'Ringkasan pekerjaan', style: { width: '100%' },
      oninput: function (e) { summary = e.target.value; }
    }, summary);

    var body = [
      ui.el('div', ui.el('strong', task.title)),
      ui.el('div.hint', { style: { marginTop: '2px' } }, sub),
      ui.el('label.field', { style: { marginTop: '12px' } }, 'Ringkasan', ta)
    ];
    if (runningHere) body.splice(2, 0, ui.el('div.hint', { style: { marginTop: '6px' } },
      running.openEnded
        ? 'Waktu bebas yang sedang berjalan pada tugas ini akan diakhiri dan dihitung ke total fokus.'
        : 'Sesi yang sedang berjalan akan diakhiri dan waktu fokus yang sudah berjalan dihitung ke total.'));
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
      title: edit ? 'Ringkasan tugas' : 'Tandai selesai', wide: true, dismiss: false, body: body,
      actions: [
        { label: 'Batal', ghost: true, onClick: function () {
          discardFiles().then(function () { if (typeof opts.onCancel === 'function') opts.onCancel(); });
        } },
        { label: edit ? 'Simpan' : 'Simpan dan tandai selesai', primary: true, onClick: function () { return save(); } }
      ],
      onClose: function () { if (!finished) discardFiles(); }
    });
  }

  JF.completion = { open: open, start: start, view: view, forTask: forTask, summaryBlock: summaryBlock, chip: chip, reportSection: reportSection };
})(typeof self !== 'undefined' ? self : this);
