/* Jam Fokus — Library: central document layer. Documents arrive automatically
   from Goals task attachments, direct imports and other modules (JF.documents);
   this page only lets people find, inspect and manage them. Relationships are
   derived from stable ids, never typed in by hand. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host;
  var F = { search: '', type: 'all', module: 'all', goalId: 'all', sort: 'date', missingOnly: false, date: '' };
  var lastHashDate = '';   // tanggal dari tautan #library?date=... yang terakhir dibaca
  var selectedId = null;
  var listBox, overviewBox, detailBox, filterBox;

  function state() { return app.rawState(); }
  function L() { return JF.library; }
  function D() { return JF.documents; }

  async function recoverDeletions() {
    var r;
    try { r = await window.desk.libraryRecoverDeletions(); } catch (e) { return; }
    var deleted = (r && r.deleted) || [];
    if (!deleted.length) return;
    state().library = state().library.filter(function (it) { return !(it.type === 'file' && deleted.indexOf(it.fileName) >= 0); });
    app.save();
  }

  async function mount(container) {
    ui = JF.ui; app = JF.app; host = container;
    ui.clear(host);
    host.classList.add('lib-page');
    var head = ui.el('div.lib-head');
    head.appendChild(ui.el('p.hint', 'Semua dokumen dari Goals dan impor langsung terkumpul di sini secara otomatis, lengkap dengan asalnya.'));
    var acts = ui.el('div.lib-actions');
    acts.appendChild(ui.btn('Impor dokumen', importDocs, { primary: true }));
    acts.appendChild(ui.btn('Tambah tautan', addLinkModal, { ghost: true }));
    acts.appendChild(ui.btn('Tambah catatan', addNoteModal, { ghost: true }));
    head.appendChild(acts);
    host.appendChild(head);
    overviewBox = ui.el('div.lib-overview');
    filterBox = ui.el('div.lib-filters');
    host.appendChild(overviewBox);
    host.appendChild(filterBox);
    var split = ui.el('div.lib-split');
    listBox = ui.el('div.lib-list', { id: 'lib-list' });
    detailBox = ui.el('aside.lib-detail');
    split.appendChild(listBox); split.appendChild(detailBox);
    host.appendChild(split);
    buildFilters();
    render();
    await recoverDeletions();
    await D().refreshStatus();
    render();
  }

  /* ── filters ─────────────────────────────────────────────────────── */
  /* Tautan dari Kalender: #library?date=YYYY-MM-DD menyaring dokumen yang ditambahkan pada hari itu. */
  function hashDate() {
    var h = location.hash || '';
    if (h.replace(/^#/, '').split('?')[0] !== 'library') return '';
    var m = /[?&]date=(\d{4}-\d{2}-\d{2})/.exec(h);
    return m && JF.dates.isDayKey(m[1]) ? m[1] : '';
  }
  function syncDateFromHash() {
    var hd = hashDate();
    if (hd !== lastHashDate) { lastHashDate = hd; if (hd) F.date = hd; }
  }
  function setDate(day) {
    F.date = day || '';
    lastHashDate = F.date;
    var next = '#library' + (F.date ? '?date=' + F.date : '');
    if (location.hash !== next) { try { history.replaceState(null, '', next); } catch (e) { location.hash = next; } }
    render();
  }

  function sel(label, key, options) {
    var s = ui.el('select', { 'aria-label': label, onchange: function (e) { F[key] = e.target.value; render(); } });
    options.forEach(function (o) { s.appendChild(ui.el('option', { value: o[0], selected: F[key] === o[0] }, o[1])); });
    return s;
  }
  function buildFilters() {
    ui.clear(filterBox);
    filterBox.appendChild(ui.el('input', { type: 'search', placeholder: 'Cari nama dokumen…', 'aria-label': 'Cari dokumen', value: F.search, oninput: function (e) { F.search = e.target.value || ''; render(true); } }));
    var types = [['all', 'Semua jenis']].concat(L().TYPE_GROUPS.map(function (g) { return [g, L().TYPE_GROUP_LABEL[g]]; })).concat([['link', 'Tautan'], ['note', 'Catatan']]);
    filterBox.appendChild(sel('Jenis dokumen', 'type', types));
    var mods = {};
    state().library.forEach(function (it) { mods[it.source.module] = true; });
    filterBox.appendChild(sel('Sumber', 'module', [['all', 'Semua sumber']].concat(Object.keys(mods).sort().map(function (m) { return [m, L().moduleLabel(m)]; }))));
    var goals = (state().goals || []).map(function (g) { return [g.id, g.title]; });
    filterBox.appendChild(sel('Goal', 'goalId', [['all', 'Semua goal']].concat(goals)));
    filterBox.appendChild(sel('Urutkan', 'sort', [['date', 'Terbaru'], ['name', 'Nama'], ['type', 'Jenis']]));
    filterBox.appendChild(ui.el('input', { type: 'date', 'aria-label': 'Tanggal ditambahkan', title: 'Tanggal ditambahkan', value: F.date,
      onchange: function (e) { setDate(JF.dates.isDayKey(e.target.value) ? e.target.value : ''); } }));
    if (F.date) filterBox.appendChild(ui.btn('Semua tanggal', function () { setDate(''); }, { sm: true, ghost: true }));
  }

  /* ── overview ────────────────────────────────────────────────────── */
  function renderOverview() {
    ui.clear(overviewBox);
    var o = L().overview(state(), D().statusMap(), Date.now());
    function stat(label, value, cls, onclick) {
      var c = ui.el((onclick ? 'button.lib-stat.' : 'div.lib-stat.') + (cls || 'plain'), onclick ? { type: 'button', onclick: onclick } : null,
        ui.el('strong', String(value)), ui.el('span', label));
      overviewBox.appendChild(c);
    }
    stat('Dokumen', o.total);
    stat('Baru (7 hari)', o.recent);
    var types = Object.keys(o.byType).filter(function (k) { return k !== 'link' && k !== 'note'; });
    stat('Jenis file', types.length);
    if (o.missing) stat('File hilang', o.missing, 'bad', function () { F.missingOnly = !F.missingOnly; render(); });
    else if (F.missingOnly) { F.missingOnly = false; }
    if (F.missingOnly) overviewBox.appendChild(ui.el('span.chip.warn', 'Menampilkan file hilang'));
  }

  /* ── list ────────────────────────────────────────────────────────── */
  var TYPE_ICON = { pdf: 'PDF', document: 'DOC', spreadsheet: 'XLS', presentation: 'PPT', image: 'IMG', other: 'FILE', link: 'URL', note: 'TXT' };

  function rowFor(it) {
    var g = L().typeGroup(it);
    var av = D().availability(it);
    var paths = L().contextPaths(state(), it);
    var row = ui.el('button.lib-row' + (it.id === selectedId ? '.on' : ''), { type: 'button', onclick: function () { selectedId = it.id; render(true); } });
    row.appendChild(ui.el('span.lib-ico.t-' + g, TYPE_ICON[g] || 'FILE'));
    var main = ui.el('span.lib-main');
    main.appendChild(ui.el('span.lib-title', it.title));
    var ctx = paths.length ? paths[0].label + (paths.length > 1 ? ' (+' + (paths.length - 1) + ')' : '') : 'Dokumen mandiri';
    main.appendChild(ui.el('span.lib-ctx', ctx));
    row.appendChild(main);
    var side = ui.el('span.lib-side');
    side.appendChild(ui.el('span.lib-date', ui.fmt.dateShort(JF.dates.dayKey(it.createdAt))));
    if (av === 'missing') side.appendChild(ui.el('span.chip.danger', 'File hilang'));
    else side.appendChild(ui.el('span.chip.outline', L().moduleLabel(it.source.module)));
    row.appendChild(side);
    return row;
  }

  function renderList() {
    ui.clear(listBox);
    var rows = L().query(state(), F, D().statusMap());
    if (!state().library.length) {
      listBox.appendChild(ui.el('div.empty', ui.el('span.big', 'Library masih kosong'),
        'Lampirkan file ke tugas di Goals atau impor dokumen langsung. Semuanya akan muncul di sini otomatis.'));
      return rows;
    }
    if (!rows.length) {
      listBox.appendChild(F.date
        ? ui.el('div.empty', ui.el('span.big', 'Tidak ada dokumen pada tanggal ini'), 'Belum ada yang ditambahkan pada ' + ui.fmt.date(F.date) + ' (dengan filter yang aktif).')
        : ui.el('div.empty', ui.el('span.big', 'Tidak ada yang cocok'), 'Ubah kata kunci atau filter.'));
      return rows;
    }
    rows.forEach(function (it) { listBox.appendChild(rowFor(it)); });
    return rows;
  }

  /* ── details ─────────────────────────────────────────────────────── */
  function kv(box, k, v) { if (v) box.appendChild(ui.el('div.lib-kv', ui.el('span', k), ui.el('b', v))); }

  function revealPath(p) {
    if (p.goal) { location.hash = '#goals?id=' + encodeURIComponent(p.goal.id); }
  }

  function renderDetail() {
    ui.clear(detailBox);
    var it = selectedId ? L().findById(state(), selectedId) : null;
    if (!it) { selectedId = null; detailBox.appendChild(ui.el('div.hint', 'Pilih dokumen untuk melihat detail dan asalnya.')); return; }
    detailBox.appendChild(ui.el('h3', it.title));
    var av = D().availability(it);
    if (it.type === 'file') {
      var chip = ui.el('span.chip' + (av === 'ok' ? '.ok' : av === 'missing' ? '.danger' : '.outline'), D().availLabel(it));
      detailBox.appendChild(ui.el('div', chip));
      if (av === 'missing') detailBox.appendChild(ui.el('div.gl-out-warn', 'File fisiknya tidak ditemukan. Riwayat dan relasinya tetap tersimpan; hapus entri ini atau impor ulang filenya.'));
    }
    var paths = L().contextPaths(state(), it);
    var ctx = ui.el('div.lib-sec');
    ctx.appendChild(ui.el('div.lib-sec-h', 'Asal dokumen'));
    if (!paths.length) ctx.appendChild(ui.el('div.hint', 'Dokumen mandiri — tidak terkait goal atau tugas.'));
    paths.forEach(function (p) {
      var line = ui.el('div.lib-path', ui.el('span', p.label));
      if (p.goal) line.appendChild(ui.btn('Lihat di Goals', function () { revealPath(p); }, { sm: true, ghost: true }));
      ctx.appendChild(line);
    });
    detailBox.appendChild(ctx);
    var info = ui.el('div.lib-sec');
    info.appendChild(ui.el('div.lib-sec-h', 'Informasi'));
    kv(info, 'Sumber', L().moduleLabel(it.source.module));
    kv(info, 'Jenis', L().TYPE_GROUP_LABEL[L().typeGroup(it)]);
    if (it.type === 'file') { kv(info, 'Nama asli', it.originalName); kv(info, 'Ukuran', D().fmtSize(it.size)); }
    if (it.type === 'link') kv(info, 'URL', it.url);
    kv(info, 'Ditambahkan', ui.fmt.dateTime(it.createdAt));
    kv(info, 'ID', it.id);
    detailBox.appendChild(info);
    if (it.description) detailBox.appendChild(ui.el('div.hint', it.description));
    if (it.type === 'note' && it.noteText) detailBox.appendChild(ui.el('div.lib-note', it.noteText));
    var acts = ui.el('div.lib-actions');
    if (it.type === 'file') acts.appendChild(ui.btn('Buka', function () { openFile(it); }, { sm: true, disabled: av === 'missing' }));
    if (it.type === 'link') acts.appendChild(ui.btn('Buka tautan', function () { window.open(it.url); }, { sm: true }));
    acts.appendChild(ui.btn('Edit', function () { editItem(it); }, { ghost: true, sm: true }));
    acts.appendChild(ui.btn('Hapus', function () { removeItem(it); }, { danger: true, sm: true }));
    detailBox.appendChild(acts);
  }

  function render(listOnly) {
    if (!host || !listBox) return;
    syncDateFromHash();
    if (!listOnly) buildFilters();
    renderOverview();
    renderList();
    renderDetail();
  }

  /* ── actions ─────────────────────────────────────────────────────── */
  async function importDocs() {
    try {
      var out = await D().importStandalone();
      if (out.canceled) return;
      var n = out.added.length + out.linked.length;
      if (n) ui.toast(n === 1 ? 'Dokumen diimpor.' : n + ' dokumen diimpor.', { kind: 'ok' });
      if (out.failed.length) ui.toast(out.failed.map(function (f) { return (f.name ? f.name + ': ' : '') + D().message(f.reason); }).join(' '), { kind: 'err', timeout: 8000 });
      if (out.added.length) selectedId = out.added[0].id;
      await D().refreshStatus();
      render();
    } catch (e) { ui.toast('Impor gagal.', { kind: 'err' }); }
  }

  function save() { app.save(); render(); }

  function addLinkModal() {
    var title = '', url = '', desc = '';
    ui.modal({
      title: 'Tambah tautan',
      body: [
        ui.el('label.field', 'Judul', ui.el('input', { oninput: function (e) { title = e.target.value; } })),
        ui.el('label.field', 'URL', ui.el('input', { placeholder: 'https://', oninput: function (e) { url = e.target.value; } })),
        ui.el('label.field', 'Deskripsi', ui.el('textarea', { oninput: function (e) { desc = e.target.value; } }))
      ],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan', primary: true, onClick: function () {
          try {
            var item = L().createItem({ type: 'link', title: title, url: url, description: desc, source: { module: 'library' } }, Date.now());
            state().library.push(item); selectedId = item.id; save();
          } catch (e) { ui.toast('URL tidak valid. Gunakan alamat http:// atau https://.', { kind: 'err' }); return false; }
        } }
      ]
    });
  }

  function addNoteModal() {
    var title = '', text = '';
    ui.modal({
      title: 'Tambah catatan',
      body: [
        ui.el('label.field', 'Judul', ui.el('input', { oninput: function (e) { title = e.target.value; } })),
        ui.el('label.field', 'Isi', ui.el('textarea', { oninput: function (e) { text = e.target.value; } }))
      ],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan', primary: true, onClick: function () {
          var item = L().createItem({ type: 'note', title: title, noteText: text, source: { module: 'library' } }, Date.now());
          state().library.push(item); selectedId = item.id; save();
        } }
      ]
    });
  }

  /* Edit changes only what the user owns (title, description); relations stay automatic. */
  function editItem(it) {
    var title = it.title, desc = it.description || '';
    ui.modal({
      title: 'Edit dokumen',
      body: [
        ui.el('label.field', 'Judul', ui.el('input', { value: title, oninput: function (e) { title = e.target.value; } })),
        ui.el('label.field', 'Deskripsi', ui.el('textarea', { oninput: function (e) { desc = e.target.value; } }, desc))
      ],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan', primary: true, onClick: function () {
          it.title = title; it.description = desc; it.updatedAt = Date.now();
          L().normalize(state(), Date.now()); save();
        } }
      ]
    });
  }

  async function openFile(it) {
    var r = await D().open(it);
    if (!r.ok) ui.toast('Gagal membuka file: ' + D().message(r.message || r.reason), { kind: 'err' });
    render();
  }

  async function removeItem(it) {
    var linked = it.taskIds.length;
    var yes = await ui.confirm({
      title: 'Hapus dokumen?',
      body: linked
        ? '"' + it.title + '" dilampirkan pada ' + linked + ' tugas. Dokumen dihapus dari Library, tetapi status selesai dan riwayat tugas tidak berubah.'
        : '"' + it.title + '" akan dihapus dari Library.',
      okLabel: 'Hapus', danger: true
    });
    if (!yes) return;
    var r = await D().removeDocument(it);
    if (!r.ok) { ui.toast('Gagal menghapus dokumen.', { kind: 'err' }); return; }
    if (selectedId === it.id) selectedId = null;
    ui.toast('Dokumen dihapus.', { kind: 'ok' });
    render();
  }

  JF.pages.register({ id: 'library', title: 'Library', sub: function () { return (app ? state().library.length : 0) + ' dokumen'; }, mount: mount, render: function () { render(); if (app) D().ensureFresh(function () { render(); }); } });
})(typeof self !== 'undefined' ? self : this);
