/* Independent Capybara World page compositions backed by the shared JF services. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var C = JF.capybaraUI;
  var ui = JF.ui;
  var selectedDay = JF.app.today();
  var calendarMonth = JF.app.today().slice(0, 7) + '-01';
  var analyticsKind = 'week';
  var analyticsAnchor = JF.app.today();
  var journalDay = JF.app.today();
  var librarySearch = '';
  var selectedLibraryId = null;
  var renderedPage = null;

  function state() { return JF.app.rawState(); }
  function save() { JF.app.save(); }
  function heading(host, eyebrow, title, description) {
    host.appendChild(C.el('div.cw-page-lead', C.el('span.cw-eyebrow', eyebrow), C.el('h2', title), C.el('p', description)));
  }
  function panel(title, description, actions) {
    var box = C.card();
    box.appendChild(C.heading(title, description, actions));
    return box;
  }
  function dayTasks(day) {
    return state().tasks.filter(function (task) { return !task.archived && task.targetDate === day; })
      .sort(function (a, b) { return Number(a.done) - Number(b.done) || ({ high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority]); });
  }
  function taskActions(task, host, options) {
    options = options || {};
    if (!task.done && !task.archived) {
      host.appendChild(C.button(options.compact ? 'Fokus' : 'Mulai fokus', function () { JF.app.startTask(task.id); }, 'primary'));
      if (!options.compact) host.appendChild(C.button('Tandai selesai', function () { JF.app.completeTask(task.id); }, 'quiet'));
    } else if (task.done && !task.archived && !options.compact) {
      host.appendChild(C.button('Buka kembali', function () { JF.app.reopenTask(task.id); }, 'quiet'));
    }
    if (options.edit) host.appendChild(C.button('Ubah', function () { editTask(task); }, 'quiet'));
    if (options.archive && !task.archived) host.appendChild(C.button('Arsipkan', function () {
      JF.ui.confirm({ title: 'Arsipkan tugas?', body: task.title + ' akan dipindahkan ke arsip.', okLabel: 'Arsipkan' })
        .then(function (yes) { if (yes) { JF.store.archiveTask(state(), task.id, Date.now()); save(); } });
    }, 'quiet'));
    if (options.restore && task.archived) host.appendChild(C.button('Pulihkan', function () { restoreTask(task); }, 'quiet'));
  }
  function taskCard(task, options) {
    var box = C.el('article.cw-task-card' + (task.done ? '.is-done' : '') + (task.archived ? '.is-archived' : ''));
    if (options && options.select) box.appendChild(options.select.box(task));
    var check = C.el('button.cw-check' + (task.done ? '.is-checked' : ''), {
      type: 'button',
      'aria-label': task.done ? 'Buka kembali ' + task.title : 'Tandai selesai ' + task.title,
      'aria-pressed': String(!!task.done),
      onclick: function () { task.done ? JF.app.reopenTask(task.id) : JF.app.completeTask(task.id); }
    }, task.done ? '✓' : '');
    box.appendChild(check);
    var main = C.el('div.cw-task-main', C.el('h3', task.title));
    if (task.description) main.appendChild(C.el('p', task.description));
    main.appendChild(C.el('div.cw-task-meta',
      C.badge('Prioritas ' + (JF.model.PRIORITY_LABEL[task.priority] || 'Normal'), task.priority),
      C.badge('Tenggat ' + ui.fmt.dateShort(task.targetDate), JF.dates.diffDays(task.targetDate, JF.app.today()) > 0 && !task.done ? 'warn' : 'soft'),
      task.requiresOutput ? C.badge('Perlu output', 'soft') : null));
    box.appendChild(main);
    var actions = C.el('div.cw-task-actions');
    taskActions(task, actions, options);
    box.appendChild(actions);
    return box;
  }
  function fieldInput(label, control, hint) { return C.field(label, control, hint); }
  function modalInput(label, type, value, attrs) {
    var control = C.input(type, value, attrs);
    return { node: fieldInput(label, control), input: control };
  }
  function editTask(task) {
    var title = modalInput('Judul', 'text', task.title, { maxlength: 120 });
    var date = modalInput('Tanggal target', 'date', task.targetDate);
    var priority = C.select(JF.model.PRIORITIES.map(function (p) { return { value: p, label: JF.model.PRIORITY_LABEL[p] }; }), task.priority);
    var desc = C.el('textarea.cw-input', { rows: '3', maxlength: '2000' }, task.description || '');
    var duration = C.input('number', Math.round((task.durationSec || 1500) / 60), { min: '1', max: '1440' });
    ui.modal({
      title: 'Ubah rincian tugas',
      body: [title.node, date.node, fieldInput('Deskripsi', desc), fieldInput('Prioritas', priority), fieldInput('Durasi fokus (menit)', duration)],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan', primary: true, onClick: function () {
          if (!title.input.value.trim() || !JF.dates.isDayKey(date.input.value)) {
            ui.toast('Judul dan tanggal target wajib valid.', { kind: 'err' }); return false;
          }
          var store = JF.store;
          store.editTask(state(), task.id, {
            title: title.input.value, description: desc.value, priority: priority.value,
            durationSec: Math.max(1, Number(duration.value)) * 60
          }, Date.now());
          store.rescheduleTask(state(), task.id, date.input.value, Date.now());
          save();
        } }
      ]
    });
  }
  function restoreTask(task) {
    var date = C.input('date', JF.app.today());
    ui.modal({
      title: 'Pulihkan tugas',
      body: [C.el('p', 'Pilih tanggal target baru untuk "' + task.title + '".'), fieldInput('Tanggal target baru', date)],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Pulihkan', primary: true, onClick: function () {
          var result = JF.store.restoreTask(state(), task.id, date.value, Date.now());
          if (!result.ok) { ui.toast('Pilih tanggal target yang valid.', { kind: 'err' }); return false; }
          save();
        } }
      ]
    });
  }

  function renderHome(host) {
    JF.capybaraHome.mount(host);
  }

  var taskSeg = 'board';
  var cwFilter = 'all';     // 'all' | 'late' | 'today' | 'tomorrow' | 'date'
  var cwPicked = '';
  var cwSel = {};
  function hashOf(text) { var h = 0; for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return Math.abs(h); }
  var PRIO_ORDER = { high: 0, normal: 1, low: 2 };
  function byPriority(a, b) { return (PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority]) || a.title.localeCompare(b.title, 'id'); }

  function noteCard(task) {
    var today = JF.app.today();
    var late = !task.done && task.targetDate < today;
    var box = C.el('article.cw-note.cw-prio-' + task.priority + (task.done ? '.is-done' : '') + (late ? '.is-late' : ''), { draggable: 'true' });
    box.style.setProperty('--tilt', ((hashOf(task.id) % 5) - 2) * 0.35 + 'deg');
    box.addEventListener('dragstart', function (ev) {
      ev.dataTransfer.setData('text/plain', task.id);
      ev.dataTransfer.effectAllowed = 'move';
      box.classList.add('is-dragging');
    });
    box.addEventListener('dragend', function () { box.classList.remove('is-dragging'); });
    var top = C.el('div.cw-note-top');
    top.appendChild(C.el('button.cw-check' + (task.done ? '.is-checked' : ''), {
      type: 'button',
      'aria-label': task.done ? 'Buka kembali ' + task.title : 'Tandai selesai ' + task.title,
      'aria-pressed': String(!!task.done),
      onclick: function () { task.done ? JF.app.reopenTask(task.id) : JF.app.completeTask(task.id); }
    }, task.done ? '✓' : ''));
    top.appendChild(C.el('h3', task.title));
    box.appendChild(top);
    if (task.description) box.appendChild(C.el('p.cw-note-desc', task.description));
    box.appendChild(C.el('div.cw-note-meta',
      C.el('span.cw-chip', ui.fmt.dateShort(task.targetDate)),
      C.el('span.cw-chip.cw-chip-prio', JF.model.PRIORITY_LABEL[task.priority] || 'Normal'),
      task.requiresOutput ? C.el('span.cw-chip', 'Perlu output') : null));
    var actions = C.el('div.cw-note-actions');
    taskActions(task, actions, { edit: true, archive: true, compact: true });
    box.appendChild(actions);
    if (task.done) box.appendChild(C.el('span.cw-stamp', { 'aria-hidden': 'true' }, 'BERES'));
    return box;
  }

  function moveTask(id, target) {
    var task = state().tasks.filter(function (t) { return t.id === id; })[0];
    if (!task || task.archived) return;
    var today = JF.app.today();
    if (target === 'done') { if (!task.done) JF.app.completeTask(id); return; }
    var day = target === 'today' ? today : JF.dates.addDays(today, 1);
    if (task.done) JF.app.reopenTask(id);
    JF.store.rescheduleTask(state(), id, day, Date.now());
    save();
    ui.toast(target === 'today' ? 'Dipindah ke hari ini.' : 'Dijadwalkan besok.', { kind: 'ok', timeout: 1800 });
  }

  function boardColumn(spec, host) {
    var col = C.el('section.cw-col.cw-col-' + spec.id);
    col.appendChild(C.el('header.cw-col-head', C.el('span.cw-col-icon', { 'aria-hidden': 'true' }, spec.icon), C.el('h3', spec.title), C.el('span.cw-col-count', String(spec.tasks.length))));
    var body = C.el('div.cw-col-body');
    if (!spec.tasks.length) body.appendChild(C.el('p.cw-col-empty', spec.empty));
    spec.tasks.slice(0, spec.limit || 50).forEach(function (task) { body.appendChild(noteCard(task)); });
    if (spec.limit && spec.tasks.length > spec.limit) body.appendChild(C.el('p.cw-col-empty', '+' + (spec.tasks.length - spec.limit) + ' lainnya'));
    col.appendChild(body);
    if (spec.drop) {
      col.addEventListener('dragover', function (ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; col.classList.add('is-over'); });
      col.addEventListener('dragleave', function (ev) { if (!col.contains(ev.relatedTarget)) col.classList.remove('is-over'); });
      col.addEventListener('drop', function (ev) {
        ev.preventDefault();
        col.classList.remove('is-over');
        moveTask(ev.dataTransfer.getData('text/plain'), spec.id);
      });
    }
    return col;
  }


  /* ── pilih banyak, aksi massal, filter tanggal (Kebun Tugas) ────── */
  function cwGroup(items) {
    var g = { items: items, boxes: [], onSync: null };
    g.box = function (t) {
      var cb = C.el('input.cw-sel-box', { type: 'checkbox', 'aria-label': 'Pilih ' + t.title });
      cb.checked = !!cwSel[t.id];
      cb.addEventListener('change', function () { if (cb.checked) cwSel[t.id] = true; else delete cwSel[t.id]; g.sync(); });
      g.boxes.push({ t: t, cb: cb });
      return cb;
    };
    g.selected = function () { return items.filter(function (t) { return cwSel[t.id]; }); };
    g.setAll = function (v) {
      items.forEach(function (t) { if (v) cwSel[t.id] = true; else delete cwSel[t.id]; });
      g.boxes.forEach(function (b) { b.cb.checked = !!cwSel[b.t.id]; });
      g.sync();
    };
    g.sync = function () { if (g.onSync) g.onSync(g.selected().length, items.length); };
    return g;
  }
  function cwBar(g, specs) {
    var all = C.el('input.cw-sel-box', { type: 'checkbox', 'aria-label': 'Pilih semua tugas di daftar ini' });
    var info = C.el('span.cw-sel-info');
    var act = C.el('select.cw-sel-act', { 'aria-label': 'Aksi untuk tugas terpilih' });
    act.appendChild(C.el('option', { value: '' }, 'Aksi…'));
    var opts = specs.map(function (sp, i) { var o = C.el('option', { value: String(i) }, ''); act.appendChild(o); return { node: o, spec: sp }; });
    act.addEventListener('change', function () {
      var i = act.value; act.value = '';
      if (i === '') return;
      var c = g.selected(); if (c.length) specs[+i].onClick(c);
    });
    all.addEventListener('change', function () { g.setAll(all.checked); });
    g.onSync = function (n, total) {
      all.checked = total > 0 && n === total;
      all.indeterminate = n > 0 && n < total;
      info.textContent = n + ' dipilih';
      info.hidden = act.hidden = n === 0;
      opts.forEach(function (o) { var lb = o.spec.label; o.node.textContent = typeof lb === 'function' ? lb(n) : lb; });
    };
    g.sync();
    return C.el('div.cw-sel-bar', C.el('label.cw-sel-all', all, 'Pilih semua'), info, act);
  }
  function cwPickDate(title, hint, okLabel, onPick) {
    var date = C.input('date', '');
    ui.modal({
      title: title,
      body: [C.el('p', hint), fieldInput('Tanggal target baru (wajib)', date)],
      actions: [
        { label: 'Batal', ghost: true },
        { label: okLabel, primary: true, onClick: function () {
          if (!JF.dates.isDayKey(date.value)) { ui.toast('Pilih tanggal target yang valid.', { kind: 'err' }); return false; }
          return onPick(date.value) !== false;
        } }
      ]
    });
  }
  function cwReschedule(tasks, date, label) {
    var prev = [];
    tasks.forEach(function (t) {
      var from = t.targetDate;
      var r = JF.store.rescheduleTask(state(), t.id, date, Date.now());
      if (r.ok && r.changed) prev.push({ id: t.id, from: from });
    });
    cwSel = {};
    save();
    ui.toast(prev.length + ' tugas dipindah ke ' + label + '.', { kind: 'ok', timeout: 7000, action: { label: 'Batal', onClick: function () {
      prev.forEach(function (p) { JF.store.rescheduleTask(state(), p.id, p.from, Date.now()); });
      save();
    } } });
  }
  function cwArchive(tasks) {
    var prev = tasks.map(function (t) { return { id: t.id, date: t.targetDate }; });
    tasks.forEach(function (t) { JF.store.archiveTask(state(), t.id, Date.now()); });
    cwSel = {};
    save();
    ui.toast(prev.length + ' tugas diarsipkan.', { kind: 'ok', timeout: 7000, action: { label: 'Batal', onClick: function () {
      prev.forEach(function (p) { JF.store.restoreTask(state(), p.id, p.date, Date.now()); });
      save();
    } } });
  }
  function cwRestore(tasks) {
    cwPickDate('Pulihkan ' + tasks.length + ' tugas', 'Semua tugas yang dipilih diaktifkan lagi dengan tanggal target yang sama.', 'Pulihkan', function (date) {
      var n = 0;
      tasks.forEach(function (t) { if (JF.store.restoreTask(state(), t.id, date, Date.now()).ok) n++; });
      cwSel = {}; taskSeg = 'board';
      save();
      ui.toast(n + ' tugas dipulihkan ke ' + ui.fmt.dateShort(date) + '.', { kind: 'ok' });
    });
  }
  function cwDelete(tasks) {
    var ids = tasks.map(function (t) { return t.id; });
    ui.confirm({
      title: 'Hapus permanen ' + ids.length + ' tugas?',
      body: 'Tugas yang dihapus TIDAK bisa dipulihkan. Riwayat sesi fokus dan laporan harian tetap tersimpan; hanya tautan tugas ke Goal/Library yang dilepas.',
      okLabel: 'Hapus permanen', danger: true
    }).then(function (yes) {
      if (!yes) return;
      var r = JF.store.deleteArchivedTasks(state(), ids, Date.now());
      cwSel = {};
      var saved = JF.app.save();
      if (!saved) ui.toast('Tugas terhapus di layar, tapi gagal disimpan ke penyimpanan lokal. Periksa Pengaturan › Data & cadangan.', { kind: 'err', timeout: 9000 });
      else ui.toast(r.removed.length + ' tugas dihapus permanen.' + (r.skipped.length ? ' ' + r.skipped.length + ' dilewati (sedang dipakai timer).' : ''), { kind: 'ok' });
    });
  }
  function cwMatch(t, today) {
    if (cwFilter === 'late') return !t.done && t.targetDate < today;
    if (cwFilter === 'today') return t.targetDate === today;
    if (cwFilter === 'tomorrow') return t.targetDate === JF.dates.addDays(today, 1);
    if (cwFilter === 'date') return !cwPicked || t.targetDate === cwPicked;
    return true;
  }
  function cwFilterBar(box, host, today) {
    var open = state().tasks.filter(function (t) { return !t.archived && !t.done; });
    function count(f) {
      var keep = cwFilter; cwFilter = f;
      var n = open.filter(function (t) { return cwMatch(t, today); }).length;
      cwFilter = keep; return n;
    }
    var fs = C.el('select.cw-fsel', { 'aria-label': 'Filter tanggal tugas' });
    [['all', 'Semua'], ['late', 'Terlambat'], ['today', 'Hari ini'], ['tomorrow', 'Besok']].forEach(function (o) {
      var op = C.el('option', { value: o[0] }, o[1] + ' (' + count(o[0]) + ')');
      if (cwFilter === o[0]) op.selected = true;
      fs.appendChild(op);
    });
    var od = C.el('option', { value: 'date' }, 'Pilih tanggal…');
    if (cwFilter === 'date') od.selected = true;
    fs.appendChild(od);
    fs.addEventListener('change', function () {
      cwFilter = fs.value; if (cwFilter !== 'date') cwPicked = '';
      cwSel = {}; renderTasks(ui.clear(host));
    });
    box.appendChild(fs);
    if (cwFilter === 'date') {
      var pick = C.input('date', cwPicked, { 'aria-label': 'Pilih tanggal tertentu' });
      pick.className += ' cw-fdate';
      pick.addEventListener('change', function () { cwPicked = JF.dates.isDayKey(pick.value) ? pick.value : ''; cwSel = {}; renderTasks(ui.clear(host)); });
      box.appendChild(pick);
    }
    var late = open.filter(function (t) { return t.targetDate < today; });
    if (late.length > 1) box.appendChild(C.button('Rapikan terlambat (' + late.length + ')', function () { openLateTidy(late, today); }, 'quiet'));
  }
  function openLateTidy(late, today) {
    cwSel = {};
    var g = cwGroup(late), m = null;
    var body = C.el('div.cw-late-tidy');
    body.appendChild(cwBar(g, [
      { label: 'Pindah ke hari ini', onClick: function (c) { cwReschedule(c, today, 'hari ini'); m.close(); } },
      { label: 'Pindah ke besok', onClick: function (c) { cwReschedule(c, JF.dates.addDays(today, 1), 'besok'); m.close(); } },
      { label: 'Pilih tanggal…', onClick: function (c) {
        cwPickDate('Jadwalkan ulang ' + c.length + ' tugas', 'Tanggal baru berlaku untuk semua tugas yang dipilih.', 'Jadwalkan', function (date) {
          cwReschedule(c, date, ui.fmt.dateShort(date)); m.close();
        });
      } },
      { label: function (n) { return 'Arsipkan' + (n ? ' (' + n + ')' : ''); }, onClick: function (c) { cwArchive(c); m.close(); } }
    ]));
    var list = C.el('div.cw-late-list');
    late.slice().sort(function (a, b) { return a.targetDate.localeCompare(b.targetDate) || byPriority(a, b); }).forEach(function (t) {
      list.appendChild(C.el('label.cw-late-item', g.box(t), C.el('span.cw-late-title', t.title), C.badge('Tenggat ' + ui.fmt.dateShort(t.targetDate), 'warn')));
    });
    body.appendChild(list);
    m = ui.modal({ title: 'Rapikan tugas terlambat', body: body, wide: true, actions: [{ label: 'Tutup', ghost: true }] });
  }

  function renderTasks(host) {
    heading(host, 'KEBUN TUGAS', 'Tempel, geser, selesaikan', 'Seret catatan antar kolom untuk menjadwalkan ulang atau menyelesaikannya. Setiap tugas selesai memberi CapyRafi 10 XP.');

    var form = C.el('form.cw-quick');
    var title = C.input('text', '', { placeholder: 'Apa langkah kecil berikutnya? (Enter untuk menambah)', maxlength: '120', required: '', 'aria-label': 'Nama tugas' });
    var date = C.input('date', JF.app.today(), { required: '', 'aria-label': 'Tenggat' });
    var priority = C.select(JF.model.PRIORITIES.map(function (p) { return { value: p, label: JF.model.PRIORITY_LABEL[p] }; }), 'normal', { 'aria-label': 'Prioritas' });
    var details = C.el('textarea.cw-input', { placeholder: 'Catatan kecil (opsional)', rows: '2', maxlength: '2000', 'aria-label': 'Catatan' });
    var add = C.button('＋ Tempel', function () {}, 'primary');
    add.type = 'submit';
    form.appendChild(C.el('div.cw-quick-row', title, date, priority, add));
    form.appendChild(C.el('details.cw-more', C.el('summary', 'Tambah catatan'), details));
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      try {
        JF.store.addTask(state(), { title: title.value, targetDate: date.value, priority: priority.value, description: details.value }, Date.now());
        save();
      } catch (error) { ui.toast(error.message, { kind: 'err' }); }
    });
    host.appendChild(form);

    var seg = C.el('div.cw-filter-tabs', { role: 'tablist', 'aria-label': 'Tampilan tugas' });
    [['board', 'Papan'], ['archive', 'Arsip']].forEach(function (item) {
      var b = C.button(item[1], function () { taskSeg = item[0]; cwSel = {}; renderTasks(ui.clear(host)); }, taskSeg === item[0] ? 'primary' : 'quiet');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(taskSeg === item[0])); seg.appendChild(b);
    });
    if (taskSeg === 'board') cwFilterBar(seg, host, JF.app.today());
    host.appendChild(seg);

    if (taskSeg === 'archive') {
      var archived = state().tasks.filter(function (t) { return t.archived; }).sort(byPriority);
      var list = C.el('div.cw-task-board');
      if (!archived.length) list.appendChild(C.empty('Arsip masih kosong', 'Tugas yang kamu arsipkan akan disimpan di sini.'));
      var ag = cwGroup(archived);
      if (archived.length) host.appendChild(cwBar(ag, [
        { label: function (n) { return 'Pulihkan' + (n ? ' (' + n + ')' : ''); }, onClick: cwRestore },
        { label: function (n) { return 'Hapus permanen' + (n ? ' (' + n + ')' : ''); }, onClick: cwDelete, danger: true }
      ]));
      archived.forEach(function (task) { list.appendChild(taskCard(task, { edit: true, restore: true, select: ag })); });
      host.appendChild(list);
      return;
    }

    var today = JF.app.today();
    var live = state().tasks.filter(function (t) { return !t.archived && cwMatch(t, today); });
    var overdue = live.filter(function (t) { return !t.done && t.targetDate < today; }).sort(byPriority);
    var now = live.filter(function (t) { return !t.done && t.targetDate === today; }).sort(byPriority);
    var later = live.filter(function (t) { return !t.done && t.targetDate > today; }).sort(function (a, b) { return a.targetDate.localeCompare(b.targetDate) || byPriority(a, b); });
    var done = live.filter(function (t) { return t.done; }).sort(function (a, b) { return (b.completedAt || 0) - (a.completedAt || 0); });
    var cols = [];
    if (overdue.length) cols.push({ id: 'overdue', icon: '🌧', title: 'Terlambat', tasks: overdue, drop: false, empty: '' });
    cols.push({ id: 'today', icon: '☀', title: 'Hari ini', tasks: now, drop: true, empty: 'Kosong melompong. CapyRafi lagi leyeh-leyeh.' });
    cols.push({ id: 'upcoming', icon: '🌱', title: 'Mendatang', tasks: later, drop: true, empty: 'Belum ada rencana. Seret catatan ke sini untuk menunda ke besok.' });
    cols.push({ id: 'done', icon: '🎉', title: 'Selesai', tasks: done, drop: true, limit: 12, empty: 'Belum ada yang beres. Semangat!' });
    var board = C.el('div.cw-board' + (overdue.length ? '.has-late' : ''));
    cols.forEach(function (spec) { board.appendChild(boardColumn(spec, host)); });
    host.appendChild(board);
  }

  function renderCalendar(host) {
    heading(host, 'KALENDER STIKER', 'Kumpulkan hari-hari sempurna', 'Hari yang semua tugasnya selesai mendapat stiker CapyRafi. Pilih tanggal untuk melihat agenda dan jejak fokusnya.');
    var cr = JF.capyrafi;
    var info = cr.compute(state());
    var sticker = cr.svg({ stage: info.stage, mood: 'party', crop: 'head', cls: 'cr-still' });
    var today = JF.app.today();
    var p = JF.dates.parseDay(calendarMonth);
    var monthStart = JF.dates.buildDay(p.y, p.m, 1);
    var firstOffset = ui.dowIndex(monthStart);
    var monthTitle = ui.monthLabel(monthStart);
    var monthKey = monthStart.slice(0, 7);

    var perfect = 0, doneCount = 0, lateDays = 0;
    var cells = [];
    var start = JF.dates.addDays(monthStart, -firstOffset);
    for (var i = 0; i < 42; i++) {
      var day = JF.dates.addDays(start, i);
      var tasks = dayTasks(day);
      var done = tasks.filter(function (t) { return t.done; }).length;
      var inMonth = day.slice(0, 7) === monthKey;
      var isPerfect = tasks.length > 0 && done === tasks.length && day <= today;
      var isLate = day < today && tasks.length > done;
      if (inMonth) { if (isPerfect) perfect++; if (isLate) lateDays++; doneCount += done; }
      cells.push({ day: day, tasks: tasks, inMonth: inMonth, perfect: isPerfect, late: isLate });
    }

    var layout = C.el('div.cw-cal-layout');
    var controls = C.el('div.cw-calendar-controls');
    controls.appendChild(C.button('‹', function () { calendarMonth = JF.dates.addDays(monthStart, -1).slice(0, 7) + '-01'; renderCalendar(ui.clear(host)); }, 'quiet'));
    controls.appendChild(C.el('strong', monthTitle));
    controls.appendChild(C.button('›', function () { calendarMonth = JF.dates.addDays(JF.dates.addDays(monthStart, 32), -1).slice(0, 7) + '-01'; renderCalendar(ui.clear(host)); }, 'quiet'));
    controls.appendChild(C.button('Hari ini', function () { calendarMonth = today.slice(0, 7) + '-01'; selectedDay = today; renderCalendar(ui.clear(host)); }, 'quiet'));
    var box = panel('Peta stiker', null, controls);
    box.appendChild(C.el('div.cw-cal-stats',
      C.el('span.cw-chip.cw-chip-good', '★ ' + perfect + ' hari sempurna'),
      C.el('span.cw-chip', doneCount + ' tugas selesai bulan ini'),
      lateDays ? C.el('span.cw-chip.cw-chip-late', lateDays + ' hari ada yang tertinggal') : null));
    var grid = C.el('div.cw-calendar-grid', { role: 'grid', 'aria-label': monthTitle });
    ui.DOW_SHORT.forEach(function (d) { grid.appendChild(C.el('span.cw-weekday', { role: 'columnheader' }, d)); });
    cells.forEach(function (c) {
      var cell = C.el('button.cw-day' + (!c.inMonth ? '.is-outside' : '') + (c.day === selectedDay ? '.is-selected' : '') +
        (c.day === today ? '.is-today' : '') + (c.perfect ? '.is-perfect' : '') + (c.late ? '.is-late' : ''),
      { type: 'button', role: 'gridcell', 'aria-selected': String(c.day === selectedDay),
        'aria-label': ui.fmt.date(c.day) + (c.tasks.length ? ', ' + c.tasks.length + ' tugas' : '') + (c.perfect ? ', hari sempurna' : ''),
        onclick: function (selected) { return function () { selectedDay = selected; renderCalendar(ui.clear(host)); }; }(c.day) },
      C.el('span.cw-day-num', String(JF.dates.parseDay(c.day).d)));
      if (c.perfect) cell.appendChild(C.el('span.cw-sticker', { 'aria-hidden': 'true', html: sticker }));
      else if (c.tasks.length) {
        var dots = C.el('span.cw-dots', { 'aria-hidden': 'true' });
        c.tasks.slice(0, 4).forEach(function (t) { dots.appendChild(C.el('i.cw-dot' + (t.done ? '.is-done' : '') + '.cw-prio-' + t.priority)); });
        cell.appendChild(dots);
      }
      grid.appendChild(cell);
    });
    box.appendChild(grid);
    box.appendChild(C.el('p.cw-hint', 'Titik = tugas (hijau sudah selesai). Stiker = semua tugas hari itu beres.'));
    layout.appendChild(box);

    var side = C.el('div.cw-cal-side');
    var agenda = panel(ui.fmt.date(selectedDay), 'Agenda tanggal terpilih');
    var dayList = dayTasks(selectedDay);
    if (!dayList.length) agenda.appendChild(C.empty('Belum ada agenda', 'Tambahkan tugas dengan tanggal ini dari halaman Tugas.'));
    else dayList.forEach(function (task) { agenda.appendChild(taskCard(task, { edit: true })); });
    side.appendChild(agenda);
    var target = JF.store.focusTargetFor(state(), selectedDay);
    var sessions = state().sessions.filter(function (session) {
      var end = session.completedAt != null ? session.completedAt : session.endedAt != null ? session.endedAt : session.startedAt;
      return end != null && JF.dates.dayKey(end) === selectedDay;
    }).sort(function (a, b) { return a.startedAt - b.startedAt; });
    var focus = panel('Jejak fokus hari itu', target.min ? 'Target harian: ' + ui.fmt.min(target.min) : 'Target fokus belum ditentukan.');
    if (!sessions.length) focus.appendChild(C.empty('Belum ada sesi fokus', 'Sesi yang terkait dengan tanggal ini akan muncul di sini.'));
    sessions.forEach(function (session) {
      focus.appendChild(C.el('div.cw-history-row',
        C.el('span.cw-history-mark' + (session.state === 'completed' ? '.is-done' : '.is-cut'), session.state === 'completed' ? '✓' : '–'),
        C.el('div', C.el('h3', session.taskName || 'Fokus mandiri'), C.el('p', ui.fmt.time(session.startedAt))),
        C.el('strong', ui.fmt.dur(session.state === 'completed' ? session.plannedSec : session.activeSec))));
    });
    side.appendChild(focus);
    layout.appendChild(side);
    host.appendChild(layout);
  }

  var lastAnalytics = null;
  function exportAnalyticsXlsx(res) {
    if (!res) return;
    var D = JF.documents;
    var ready = D && D.refreshStatus ? D.refreshStatus().then(function () { return D.statusMap(); }, function () { return null; }) : Promise.resolve(null);
    ready.then(function (status) {
      try {
        var wb = JF.report.buildReport(JF.app.rawState(), res, { now: Date.now(), fileStatus: status && Object.keys(status).length ? status : null });
        var bytes = JF.xlsx.build(wb);
        var name = JF.report.fileName(res);
        var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        ui.toast('Laporan Excel diunduh.', { kind: 'ok' });
        if (D && D.registerGenerated) D.registerGenerated({ module: 'analitik', name: name, bytes: bytes, title: 'Laporan Analitik ' + res.period.from + ' s/d ' + res.period.to });
      } catch (e) { ui.toast('Gagal membuat laporan: ' + e.message, { kind: 'err' }); }
    });
  }

  var MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function deltaChip(d, kind) {
    if (!d) return null;
    var tone = d.abs > 0 ? 'is-up' : d.abs < 0 ? 'is-down' : 'is-same';
    var text;
    if (d.abs === 0) text = '＝ sama seperti sebelumnya';
    else if (kind === 'pp') text = (d.abs > 0 ? '▲ ' : '▼ ') + Math.abs(d.abs) + ' poin';
    else if (kind === 'dur') text = (d.abs > 0 ? '▲ ' : '▼ ') + (d.pct != null ? Math.abs(d.pct) + '%' : ui.fmt.dur(Math.abs(d.abs)));
    else text = (d.abs > 0 ? '▲ ' : '▼ ') + (d.pct != null ? Math.abs(d.pct) + '%' : Math.abs(d.abs));
    return C.el('span.cw-delta.' + tone, text);
  }

  function statCard(label, value, detail, chip) {
    return C.el('article.cw-stat.cw-stat-rich', C.el('span', label), C.el('strong', value), chip, detail ? C.el('small', detail) : null);
  }

  function focusChart(res) {
    var rows = res.buckets || [];
    var isMonth = res.period.bucket === 'month';
    var maxSec = 1;
    rows.forEach(function (r) { maxSec = Math.max(maxSec, r.focusSec || 0, r.targetMin ? r.targetMin * 60 : 0); });
    var compact = rows.length > 16;
    var wrap = C.el('div.cw-fchart' + (compact ? '.is-compact' : ''), { role: 'img', 'aria-label': 'Grafik fokus per ' + (isMonth ? 'bulan' : 'hari') });
    rows.forEach(function (r) {
      var empty = r.status === 'future' || r.status === 'nodata' || r.focusSec == null;
      var target = r.targetMin ? r.targetMin * 60 : null;
      var met = !empty && target != null && r.focusSec >= target;
      var col = C.el('div.cw-fcol' + (empty ? '.is-empty' : '') + (met ? '.is-met' : '') + (r.status === 'live' ? '.is-live' : ''));
      var label = isMonth ? MONTH_SHORT[Number(String(r.key).slice(5, 7)) - 1] : String(JF.dates.parseDay(r.date).d);
      col.title = (isMonth ? label + ' ' + String(r.key).slice(0, 4) : ui.fmt.date(r.date)) + ': ' +
        (r.focusSec == null ? 'belum ada data' : ui.fmt.dur(r.focusSec) + ' fokus') + (r.completed != null ? ' · ' + r.completed + ' tugas selesai' : '') +
        (target ? ' · target ' + ui.fmt.min(r.targetMin) : '');
      col.appendChild(C.el('span.cw-fval', r.focusSec ? ui.fmt.durShort(r.focusSec) : ''));
      var track = C.el('div.cw-ftrack');
      var fill = C.el('span.cw-ffill');
      fill.style.height = (empty ? 0 : Math.max(r.focusSec ? 5 : 0, Math.round((r.focusSec || 0) / maxSec * 100))) + '%';
      track.appendChild(fill);
      if (target && !empty) { var tick = C.el('i.cw-ftarget'); tick.style.bottom = Math.min(100, Math.round(target / maxSec * 100)) + '%'; track.appendChild(tick); }
      col.appendChild(track);
      col.appendChild(C.el('small', label));
      if (!isMonth && res.period.kind === 'week') col.appendChild(C.el('small.cw-fdow', ui.DOW_SHORT[ui.dowIndex(r.date)]));
      wrap.appendChild(col);
    });
    return wrap;
  }

  function hoursStrip(dist) {
    var max = Math.max.apply(null, dist.hours.concat([1]));
    var peak = dist.hours.indexOf(Math.max.apply(null, dist.hours));
    var strip = C.el('div.cw-hours', { role: 'img', 'aria-label': 'Sebaran fokus per jam' });
    dist.hours.forEach(function (sec, h) {
      var cell = C.el('span.cw-hour' + (sec ? '' : '.is-zero'), { title: String(h).padStart(2, '0') + '.00 · ' + (sec ? ui.fmt.dur(sec) : 'belum ada fokus') });
      cell.style.setProperty('--heat', String(sec ? 0.18 + 0.82 * sec / max : 0));
      strip.appendChild(cell);
    });
    var box = C.el('div', strip, C.el('div.cw-hours-axis', C.el('span', '00'), C.el('span', '06'), C.el('span', '12'), C.el('span', '18'), C.el('span', '23')));
    box.appendChild(C.el('p.cw-hint', dist.sessions
      ? 'Jam paling produktif: ' + String(peak).padStart(2, '0') + '.00–' + String((peak + 1) % 24).padStart(2, '0') + '.00 (dari ' + dist.sessions + ' sesi).'
      : 'Belum ada sesi di periode ini untuk dibaca polanya.'));
    return box;
  }

  function dowBars(dist) {
    var max = Math.max.apply(null, dist.dow.concat([1]));
    var peak = dist.dow.indexOf(Math.max.apply(null, dist.dow));
    var wrap = C.el('div.cw-dow');
    dist.dow.forEach(function (sec, i) {
      var bar = C.el('div.cw-dow-item' + (sec && i === peak ? '.is-peak' : ''), { title: ui.DOW_SHORT[i] + ': ' + (sec ? ui.fmt.dur(sec) : 'belum ada fokus') },
        C.el('div.cw-dow-track', C.el('span', { style: { height: (sec ? Math.max(6, Math.round(sec / max * 100)) : 0) + '%' } })), C.el('small', ui.DOW_SHORT[i]));
      wrap.appendChild(bar);
    });
    return wrap;
  }

  function renderAnalytics(host) {
    heading(host, 'RAPOR CAPYRAFI', 'Kenali pola fokusmu', 'Ringkasan dihitung dari tugas, sesi, jurnal, dan goal yang benar-benar tersimpan.');
    var again = function () { renderAnalytics(ui.clear(host)); };
    var controls = C.el('div.cw-filter-tabs.cw-toolbar');
    var kind = C.select(['day', 'week', 'month', 'year'].map(function (value) {
      return { value: value, label: { day: 'Harian', week: 'Mingguan', month: 'Bulanan', year: 'Tahunan' }[value] };
    }), analyticsKind, { 'aria-label': 'Periode analitik', onchange: function () { analyticsKind = this.value; again(); } });
    controls.appendChild(kind);
    controls.appendChild(C.button('‹', function () { analyticsAnchor = JF.analytics.shift(analyticsKind, analyticsAnchor, -1); again(); }, 'quiet'));
    controls.appendChild(C.button('Hari ini', function () { analyticsAnchor = JF.app.today(); again(); }, 'quiet'));
    controls.appendChild(C.button('›', function () { analyticsAnchor = JF.analytics.shift(analyticsKind, analyticsAnchor, 1); again(); }, 'quiet'));
    controls.appendChild(C.button('Unduh laporan Excel', function () { exportAnalyticsXlsx(lastAnalytics); }, 'quiet'));
    host.appendChild(controls);

    var period = JF.analytics.period(analyticsKind, analyticsAnchor, JF.app.today());
    var result = JF.analytics.compute(state(), { today: JF.app.today(), period: period });
    lastAnalytics = result;
    var stats = result.current;
    var cr = JF.capyrafi;
    var info = cr.compute(state());
    var hasData = stats.tasksCompleted != null || stats.focusSec != null;
    var rateVal = stats.rate.rate;
    var mood = !hasData ? 'sleepy' : rateVal != null && rateVal >= 0.85 ? 'party' : rateVal != null && rateVal < 0.3 && stats.rate.eligible >= 3 ? 'worried' : 'happy';

    var headline = JF.analytics.label(period) + ': ' + (hasData
      ? (stats.tasksCompleted == null ? 'belum ada catatan tugas' : stats.tasksCompleted + ' tugas selesai') + ' dan ' + (!stats.focusSec ? 'belum ada fokus tercatat' : ui.fmt.dur(stats.focusSec) + ' fokus') + '.'
      : 'belum ada data untuk dibaca. Mulai satu sesi fokus dan aku mulai mencatat!');
    var fd = result.deltas && result.deltas.focusSec;
    var trendLine = fd && fd.pct != null
      ? (fd.abs > 0 ? 'Fokusmu naik ' + fd.pct + '% dari periode sebelumnya.' : fd.abs < 0 ? 'Fokusmu turun ' + Math.abs(fd.pct) + '% dari periode sebelumnya. Tidak apa-apa, kita atur ulang pelan-pelan.' : 'Fokusmu sama dengan periode sebelumnya.')
      : 'Periode pembanding belum punya cukup data untuk dibandingkan.';
    host.appendChild(C.el('section.cw-report-hero',
      C.el('div.cw-report-art', { html: cr.svg({ stage: info.stage, mood: mood, width: 150 }) }),
      C.el('div.cw-report-copy', C.el('span.cw-eyebrow', 'RAPOR · LV.' + info.level + ' ' + info.name.toUpperCase()), C.el('h3', headline), C.el('p', hasData ? trendLine : 'Data muncul setelah ada tugas selesai atau sesi fokus.'))));

    var rate = rateVal == null ? 'Belum cukup data' : Math.round(rateVal * 100) + '%';
    host.appendChild(C.el('div.cw-stat-grid',
      statCard('Tugas selesai', stats.tasksCompleted == null ? '—' : String(stats.tasksCompleted), 'dalam periode', deltaChip(result.deltas && result.deltas.tasksCompleted, 'count')),
      statCard('Fokus tercatat', !stats.focusSec ? '—' : ui.fmt.dur(stats.focusSec), stats.sessionsDone + ' sesi selesai', deltaChip(fd, 'dur')),
      statCard('Tingkat selesai', rate, stats.rate.eligible + ' tugas memenuhi syarat', deltaChip(result.deltas && result.deltas.rate, 'pp')),
      statCard('Fokus terputus', !stats.interruptedSec ? '—' : ui.fmt.dur(stats.interruptedSec), stats.sessionsCut + ' sesi', null)));

    var chartBox = panel('Grafik fokus', 'Batang hijau = target harian tercapai. Garis putus-putus = target. Periode tanpa data tidak dianggap nol.');
    chartBox.appendChild(focusChart(result));
    chartBox.appendChild(C.el('div.cw-legend', C.el('span', C.el('i.cw-lg-fill'), ' fokus'), C.el('span', C.el('i.cw-lg-met'), ' target tercapai'), C.el('span', C.el('i.cw-lg-target'), ' target')));
    host.appendChild(chartBox);

    var pair = C.el('div.cw-report-pair');
    var hoursBox = panel('Jam produktif', 'Sebaran fokus selesai per jam.');
    hoursBox.appendChild(hoursStrip(result.distribution));
    pair.appendChild(hoursBox);
    var dowBox = panel('Hari paling fokus', 'Total fokus per hari dalam seminggu.');
    dowBox.appendChild(dowBars(result.distribution));
    pair.appendChild(dowBox);
    host.appendChild(pair);

    var extra = C.el('div.cw-report-pair');
    var cats = result.focusByCategory || [];
    var catBox = panel('Fokus per kategori goal', 'Dari tugas yang terhubung ke goal.');
    if (!cats.length) catBox.appendChild(C.el('p.cw-hint', 'Hubungkan tugas ke goal berkategori untuk melihat ke mana fokusmu pergi.'));
    var catMax = Math.max.apply(null, cats.map(function (c) { return c.sec; }).concat([1]));
    cats.slice(0, 6).forEach(function (c) {
      var bar = C.el('div.cw-cat-row', C.el('span', c.category), C.el('div.cw-cat-track', C.el('i', { style: { width: Math.max(4, Math.round(c.sec / catMax * 100)) + '%' } })), C.el('strong', ui.fmt.dur(c.sec)));
      catBox.appendChild(bar);
    });
    extra.appendChild(catBox);
    var jr = result.journal;
    var careBox = panel('Kebiasaan menulis', 'Jurnal di periode ini.');
    careBox.appendChild(C.el('p.cw-big-num', jr && jr.eligibleDays ? jr.entries + ' dari ' + jr.eligibleDays + ' hari' : 'Belum ada data'));
    careBox.appendChild(C.el('p.cw-hint', jr && jr.eligibleDays ? 'Kamu menulis jurnal pada ' + Math.round((jr.rate || 0) * 100) + '% hari, ' + jr.linked + ' di antaranya terhubung ke goal.' : 'Tulis satu catatan di halaman Journaling untuk mulai terhitung.'));
    careBox.appendChild(C.el('p.cw-hint', result.overdueNow ? result.overdueNow + ' tugas masih terlambat saat ini.' : 'Tidak ada tugas terlambat saat ini.'));
    extra.appendChild(careBox);
    host.appendChild(extra);

    var insight = panel('Celoteh CapyRafi', 'Pola yang terbaca dari catatan produktivitasmu, tanpa membuat data baru.');
    if (result.insights && result.insights.length) result.insights.forEach(function (text) {
      insight.appendChild(C.el('div.cw-bubble-row', C.el('span.cw-bubble-art', { html: cr.svg({ stage: info.stage, mood: 'happy', crop: 'head', cls: 'cr-still' }) }), C.el('p.cw-insight', text.text || text)));
    });
    else insight.appendChild(C.empty('Belum ada pola yang cukup kuat', 'Lanjutkan aktivitas seperti biasa; insight akan muncul saat data mencukupi.'));
    host.appendChild(insight);
  }

  var historyFilter = 'all';
  var historyLimit = 60;

  function dayLabel(day) {
    var today = JF.app.today();
    if (day === today) return 'Hari ini';
    if (day === JF.dates.addDays(today, -1)) return 'Kemarin';
    return ui.fmt.date(day);
  }
  function sessionEnd(session) { return session.completedAt || session.endedAt || session.startedAt; }

  function renderHistory(host) {
    heading(host, 'JEJAK KAKI FOKUS', 'Sesi yang sudah kamu jalani', 'Sesi selesai dan sesi terputus disajikan terpisah sesuai catatan timer. Setiap sesi yang selesai ikut membentuk jejakmu.');
    var again = function () { renderHistory(ui.clear(host)); };
    var all = state().sessions.slice().sort(function (a, b) { return sessionEnd(b) - sessionEnd(a); });
    var totals = all.reduce(function (acc, session) {
      if (session.state === 'completed') { acc.done++; acc.focus += session.plannedSec || 0; acc.longest = Math.max(acc.longest, session.plannedSec || 0); }
      if (session.state === 'interrupted') { acc.cut++; acc.interrupted += session.activeSec || 0; }
      return acc;
    }, { done: 0, cut: 0, focus: 0, interrupted: 0, longest: 0 });
    host.appendChild(C.el('div.cw-stat-grid',
      C.stat('Sesi selesai', String(totals.done), ui.fmt.dur(totals.focus) + ' total fokus'),
      C.stat('Sesi terputus', String(totals.cut), ui.fmt.dur(totals.interrupted) + ' fokus aktif'),
      C.stat('Sesi terpanjang', totals.longest ? ui.fmt.dur(totals.longest) : '—', 'di antara sesi selesai'),
      C.stat('Rata-rata sesi', totals.done ? ui.fmt.dur(Math.round(totals.focus / totals.done)) : '—', 'per sesi selesai')));

    /* peta jejak 4 minggu */
    var today = JF.app.today();
    var focusByDay = {};
    all.forEach(function (s) { if (s.state === 'completed') { var k = JF.dates.dayKey(sessionEnd(s)); focusByDay[k] = (focusByDay[k] || 0) + (s.plannedSec || 0); } });
    var start = JF.dates.addDays(JF.dates.addDays(today, -ui.dowIndex(today)), -21);
    var cells = [], maxDay = 1, i;
    for (i = 0; i < 28; i++) { var d = JF.dates.addDays(start, i); cells.push(d); maxDay = Math.max(maxDay, focusByDay[d] || 0); }
    var trail = panel('Jejak 4 minggu terakhir', 'Makin pekat, makin lama fokus selesai di hari itu.');
    var heat = C.el('div.cw-trail', { role: 'img', 'aria-label': 'Peta fokus 4 minggu terakhir' });
    ui.DOW_SHORT.forEach(function (n) { heat.appendChild(C.el('small.cw-trail-dow', n)); });
    cells.forEach(function (d) {
      var sec = focusByDay[d] || 0;
      var future = d > today;
      var cell = C.el('span.cw-trail-cell' + (future ? '.is-future' : '') + (d === today ? '.is-today' : '') + (sec ? '.has-focus' : ''), {
        title: ui.fmt.date(d) + ': ' + (future ? 'belum tiba' : sec ? ui.fmt.dur(sec) + ' fokus selesai' : 'belum ada fokus selesai') });
      cell.style.setProperty('--heat', String(sec ? 0.2 + 0.8 * sec / maxDay : 0));
      cell.appendChild(C.el('i', String(JF.dates.parseDay(d).d)));
      heat.appendChild(cell);
    });
    trail.appendChild(heat);
    var activeDays = cells.filter(function (d) { return focusByDay[d]; }).length;
    trail.appendChild(C.el('p.cw-hint', activeDays ? activeDays + ' dari ' + cells.filter(function (d) { return d <= today; }).length + ' hari terakhir punya fokus selesai.' : 'Belum ada fokus selesai dalam 4 minggu ini.'));
    host.appendChild(trail);

    /* linimasa per hari */
    var tabs = C.el('div.cw-filter-tabs', { role: 'tablist', 'aria-label': 'Filter sesi' });
    [['all', 'Semua'], ['completed', 'Selesai'], ['interrupted', 'Terputus']].forEach(function (item) {
      var b = C.button(item[1], function () { historyFilter = item[0]; historyLimit = 60; again(); }, historyFilter === item[0] ? 'primary' : 'quiet');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(historyFilter === item[0])); tabs.appendChild(b);
    });
    host.appendChild(tabs);
    var sessions = all.filter(function (s) { return historyFilter === 'all' || s.state === historyFilter; });
    var list = C.el('div.cw-timeline');
    if (!sessions.length) list.appendChild(C.empty('Belum ada sesi fokus', 'Mulai timer dari Beranda atau Tugas untuk membangun jejak fokusmu.'));
    var longest = Math.max.apply(null, sessions.map(function (s) { return s.state === 'completed' ? s.plannedSec || 0 : s.activeSec || 0; }).concat([1]));
    var groups = [], current = null;
    sessions.slice(0, historyLimit).forEach(function (session) {
      var key = JF.dates.dayKey(sessionEnd(session));
      if (!current || current.day !== key) { current = { day: key, items: [] }; groups.push(current); }
      current.items.push(session);
    });
    groups.forEach(function (group) {
      var dayFocus = group.items.reduce(function (n, s) { return n + (s.state === 'completed' ? s.plannedSec || 0 : 0); }, 0);
      var section = C.el('section.cw-tl-day');
      section.appendChild(C.el('header.cw-tl-head', C.el('h3', dayLabel(group.day)),
        C.el('span.cw-chip' + (dayFocus ? '.cw-chip-good' : ''), dayFocus ? ui.fmt.dur(dayFocus) + ' fokus selesai' : 'tanpa sesi selesai'),
        C.el('span.cw-chip', group.items.length + ' sesi')));
      group.items.forEach(function (session) {
        var complete = session.state === 'completed';
        var dur = complete ? session.plannedSec : session.activeSec;
        var card = C.el('article.cw-tl-item' + (complete ? '.is-done' : '.is-cut'),
          C.el('span.cw-tl-node', { 'aria-hidden': 'true' }, complete ? '✓' : '–'),
          C.el('div.cw-tl-card',
            C.el('div.cw-tl-top', C.el('h4', session.taskName || 'Fokus mandiri'),
              C.badge(complete ? 'Selesai' : session.state === 'interrupted' ? 'Terputus' : 'Status: ' + session.state, complete ? 'good' : 'warn')),
            C.el('p', ui.fmt.time(session.startedAt) + ' – ' + ui.fmt.time(sessionEnd(session)) + ' · ' + ui.fmt.dur(dur)),
            C.el('div.cw-tl-bar', C.el('i', { style: { width: Math.max(4, Math.round((dur || 0) / longest * 100)) + '%' } }))));
        section.appendChild(card);
      });
      list.appendChild(section);
    });
    host.appendChild(list);
    if (sessions.length > historyLimit) host.appendChild(C.el('div.cw-more-row', C.button('Muat ' + Math.min(60, sessions.length - historyLimit) + ' sesi lagi', function () { historyLimit += 60; again(); }, 'quiet')));
  }

  function ringSvg(pct, label) {
    var r = 46, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<svg class="cw-ring" viewBox="0 0 120 120" role="img" aria-label="' + label + '"><circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--cw-soft)" stroke-width="12"/>' +
      '<circle class="cw-ring-arc" cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--cw-green)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg>';
  }

  function polaroid(snapshot) {
    var cr = JF.capyrafi;
    var info = cr.compute(state());
    var done = (snapshot.completedTaskIds || []).length;
    var left = (snapshot.unfinishedTaskIds || []).length;
    var metTarget = snapshot.targetMin != null && snapshot.officialFocusSec != null && snapshot.officialFocusSec >= snapshot.targetMin * 60;
    var mood = !snapshot.complete ? 'sleepy' : done && !left ? 'party' : done ? 'happy' : 'sleepy';
    var card = C.el('article.cw-polaroid' + (snapshot.complete ? '' : '.is-partial') + (metTarget ? '.is-met' : ''));
    card.style.setProperty('--tilt', ((hashOf(snapshot.date) % 5) - 2) * 0.5 + 'deg');
    card.appendChild(C.el('div.cw-pola-photo',
      C.el('span.cw-pola-day', String(JF.dates.parseDay(snapshot.date).d)),
      C.el('span.cw-pola-art', { 'aria-hidden': 'true', html: cr.svg({ stage: info.stage, mood: mood, crop: 'head', cls: 'cr-still' }) }),
      metTarget ? C.el('span.cw-pola-star', { title: 'Target fokus tercapai' }, '★') : null));
    card.appendChild(C.el('div.cw-pola-caption',
      C.el('h3', ui.fmt.date(snapshot.date)),
      C.badge(snapshot.complete ? 'Lengkap' : 'Tidak lengkap', snapshot.complete ? 'good' : 'warn'),
      C.el('div.cw-pola-stats',
        C.el('span', C.el('strong', snapshot.officialFocusSec ? ui.fmt.dur(snapshot.officialFocusSec) : '—'), ' fokus'),
        C.el('span', C.el('strong', String(done)), ' selesai'),
        C.el('span', C.el('strong', String(left)), ' belum'))));
    var completedNames = (snapshot.completedTaskIds || []).map(function (id) { return JF.store.find(state(), id); }).filter(Boolean);
    var corrections = JF.snapshots.correctionsFor(state(), snapshot);
    var detail = C.el('details.cw-more.cw-pola-more', C.el('summary', 'Lihat rincian'));
    if (snapshot.targetMin != null) detail.appendChild(C.el('p.cw-report-note', 'Target hari itu: ' + ui.fmt.min(snapshot.targetMin) + (metTarget ? ' (tercapai)' : ' (belum tercapai)')));
    if (completedNames.length) detail.appendChild(C.el('p.cw-report-note', 'Selesai: ' + completedNames.map(function (task) { return task.title; }).join(', ')));
    else detail.appendChild(C.el('p.cw-report-note', 'Tidak ada tugas yang tercatat selesai.'));
    if (corrections.length) detail.appendChild(C.el('p.cw-report-correction', 'Perubahan setelah laporan: ' + corrections.map(function (item) { return item.title + ' dibuka kembali'; }).join('; ')));
    if (!snapshot.complete) detail.appendChild(C.el('p.cw-report-note', 'Sebagian data hari ini tidak lengkap: ' + (snapshot.incompleteReasons || []).join(', ')));
    card.appendChild(detail);
    return card;
  }

  function renderReports(host) {
    heading(host, 'ALBUM HARIAN', 'Kilas balik produktivitas', 'Laporan final tidak berubah; koreksi status yang terjadi kemudian ditampilkan terpisah. Tiap hari jadi satu foto di albummu.');
    var cr = JF.capyrafi;
    var info = cr.compute(state());
    var todayStats = JF.app.todayStats();
    var targetSec = todayStats.target && todayStats.target.min ? todayStats.target.min * 60 : 0;
    var pct = targetSec ? Math.min(100, Math.round((todayStats.officialSec || 0) / targetSec * 100)) : 0;
    var ctx = JF.capybaraHome.context(info);
    var mood = cr.moodOf(ctx);
    var hero = C.el('section.cw-today-hero');
    hero.appendChild(C.el('div.cw-today-ring',
      C.el('span', { html: ringSvg(pct, targetSec ? 'Fokus hari ini ' + pct + ' persen dari target' : 'Target fokus belum ditentukan') }),
      C.el('div.cw-ring-center', C.el('strong', targetSec ? pct + '%' : '—'), C.el('small', targetSec ? 'dari target' : 'tanpa target'))));
    hero.appendChild(C.el('div.cw-today-body',
      C.el('span.cw-eyebrow', 'HARI INI · MASIH BERJALAN'),
      C.el('h3', cr.say(mood, ctx, 0)),
      C.el('p', 'Angka akan berubah hingga pergantian hari, lalu dikunci menjadi satu foto di album.'),
      C.el('div.cw-today-stats',
        C.stat('Target fokus', todayStats.target && todayStats.target.min ? ui.fmt.min(todayStats.target.min) : 'Tidak diketahui'),
        C.stat('Fokus tercatat', todayStats.officialSec ? ui.fmt.dur(todayStats.officialSec) : '—'),
        C.stat('Tugas selesai', String(todayStats.doneToday)),
        C.stat('Tugas terlambat', String(todayStats.overdue)))));
    hero.appendChild(C.el('div.cw-today-art', { html: cr.svg({ stage: info.stage, mood: mood, width: 130 }) }));
    host.appendChild(hero);

    var snapshots = state().snapshots.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var withTarget = snapshots.filter(function (s) { return s.targetMin != null && s.officialFocusSec != null; });
    var metDays = withTarget.filter(function (s) { return s.officialFocusSec >= s.targetMin * 60; }).length;
    var album = panel('Album yang sudah dikunci', snapshots.length + ' hari tersimpan');
    if (snapshots.length) album.appendChild(C.el('div.cw-cal-stats',
      C.el('span.cw-chip.cw-chip-good', '★ ' + metDays + ' dari ' + withTarget.length + ' hari memenuhi target'),
      C.el('span.cw-chip', snapshots.filter(function (s) { return s.complete; }).length + ' laporan lengkap')));
    if (!snapshots.length) album.appendChild(C.empty('Belum ada laporan final', 'Laporan pertama dirangkum otomatis setelah hari berganti.'));
    var shown = snapshots.slice(0, 80), lastMonth = null, grid = null;
    shown.forEach(function (snapshot) {
      var month = snapshot.date.slice(0, 7);
      if (month !== lastMonth) {
        lastMonth = month;
        var p = JF.dates.parseDay(snapshot.date);
        album.appendChild(C.el('h4.cw-album-month', ui.monthLabel(JF.dates.buildDay(p.y, p.m, 1))));
        grid = C.el('div.cw-album');
        album.appendChild(grid);
      }
      grid.appendChild(polaroid(snapshot));
    });
    host.appendChild(album);
  }

  function createGoal() {
    var title = C.input('text', '', { maxlength: String(JF.goals.LIMITS.title), required: '' });
    var category = C.input('text', '', { maxlength: String(JF.goals.LIMITS.category) });
    var start = C.input('date', JF.app.today());
    var deadline = C.input('date', '');
    var desc = C.el('textarea.cw-input', { rows: '3', maxlength: String(JF.goals.LIMITS.description) });
    ui.modal({
      title: 'Tanam goal baru',
      body: [fieldInput('Nama goal', title), fieldInput('Kategori', category), fieldInput('Tanggal mulai', start),
        fieldInput('Tenggat (opsional)', deadline), fieldInput('Deskripsi', desc)],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Buat goal', primary: true, onClick: function () {
          var result = JF.goals.createGoal(state(), { title: title.value, category: category.value, startDate: start.value, deadline: deadline.value, description: desc.value }, Date.now());
          if (!result.ok) { ui.toast(Object.keys(result.errors || {}).map(function (key) { return result.errors[key]; }).join(' '), { kind: 'err' }); return false; }
          save();
        } }
      ]
    });
  }

  function editGoal(goal) {
    var title = C.input('text', goal.title, { maxlength: String(JF.goals.LIMITS.title) });
    var category = C.input('text', goal.category, { maxlength: String(JF.goals.LIMITS.category) });
    var start = C.input('date', goal.startDate);
    var deadline = C.input('date', goal.deadline || '');
    var description = C.el('textarea.cw-input', { rows: '3', maxlength: String(JF.goals.LIMITS.description) }, goal.description || '');
    var method = C.select(JF.goals.METHODS.map(function (value) { return { value: value, label: JF.goals.METHOD_LABEL[value] }; }), goal.progressMethod);
    var targetValue = C.input('number', goal.target ? goal.target.value : '', { min: '1' });
    var targetCurrent = C.input('number', goal.target ? goal.target.current : '0', { min: '0' });
    var targetUnit = C.input('text', goal.target ? goal.target.unit : '', { maxlength: String(JF.goals.LIMITS.unit) });
    ui.modal({
      title: 'Ubah goal',
      body: [
        fieldInput('Nama goal', title), fieldInput('Kategori', category), fieldInput('Tanggal mulai', start),
        fieldInput('Tenggat (opsional)', deadline), fieldInput('Deskripsi', description), fieldInput('Metode progres', method),
        fieldInput('Target angka', targetValue), fieldInput('Nilai saat ini', targetCurrent), fieldInput('Satuan target', targetUnit)
      ],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan perubahan', primary: true, onClick: function () {
          var result = JF.goals.updateGoal(state(), goal.id, {
            title: title.value, category: category.value, startDate: start.value, deadline: deadline.value,
            description: description.value, progressMethod: method.value,
            target: { value: targetValue.value, current: targetCurrent.value, unit: targetUnit.value }
          }, Date.now());
          if (!result.ok) { ui.toast(Object.keys(result.errors || {}).map(function (key) { return result.errors[key]; }).join(' '), { kind: 'err' }); return false; }
          save();
        } }
      ]
    });
  }

  function createMilestone(goal) {
    var title = C.input('text', '', { maxlength: String(JF.goals.LIMITS.title) });
    var deadline = C.input('date', '');
    var criteria = C.el('textarea.cw-input', { rows: '3', maxlength: String(JF.goals.LIMITS.criteria) });
    ui.modal({
      title: 'Tambah milestone · ' + goal.title,
      body: [fieldInput('Nama milestone', title), fieldInput('Tenggat (opsional)', deadline), fieldInput('Kriteria selesai', criteria)],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan milestone', primary: true, onClick: function () {
          var result = JF.goals.addMilestone(state(), goal.id, { title: title.value, deadline: deadline.value, criteria: criteria.value }, Date.now());
          if (!result.ok) { ui.toast('Nama milestone wajib diisi.', { kind: 'err' }); return false; }
          save();
        } }
      ]
    });
  }

  function editMilestone(goal, milestone) {
    var title = C.input('text', milestone.title, { maxlength: String(JF.goals.LIMITS.title) });
    var deadline = C.input('date', milestone.deadline || '');
    var description = C.el('textarea.cw-input', { rows: '2', maxlength: String(JF.goals.LIMITS.description) }, milestone.description || '');
    var criteria = C.el('textarea.cw-input', { rows: '3', maxlength: String(JF.goals.LIMITS.criteria) }, milestone.criteria || '');
    ui.modal({
      title: 'Ubah milestone',
      body: [fieldInput('Nama milestone', title), fieldInput('Tenggat (opsional)', deadline),
        fieldInput('Deskripsi', description), fieldInput('Kriteria selesai', criteria)],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan', primary: true, onClick: function () {
          var result = JF.goals.updateMilestone(state(), goal.id, milestone.id, {
            title: title.value, deadline: deadline.value, description: description.value, criteria: criteria.value
          }, Date.now());
          if (!result.ok) { ui.toast('Milestone tidak valid.', { kind: 'err' }); return false; }
          save();
        } }
      ]
    });
  }

  function linkedTaskRow(goal, task, milestone) {
    var row = C.el('div.cw-linked-task',
      C.el('span', task.title),
      C.button(task.requiresOutput ? 'Output wajib' : 'Output opsional', function () {
        JF.store.setRequiresOutput(state(), task.id, !task.requiresOutput, Date.now()); save();
      }, task.requiresOutput ? 'primary' : 'quiet'),
      C.button('Lampirkan file', function () {
        JF.documents.attachToTask(task.id).then(function (out) {
          if (out.failed.length) ui.toast('Sebagian file gagal dilampirkan: ' + out.failed.map(function (f) { return f.name || f.reason; }).join(', '), { kind: 'err' });
          if (out.added.length || out.linked.length) ui.toast('Lampiran tersimpan di Library.', { kind: 'ok' });
        });
      }, 'quiet'),
      C.button('Lepas', function () {
        JF.goals.unlinkTask(state(), goal.id, task.id, Date.now()); save();
      }, 'quiet'));
    if (milestone) row.setAttribute('data-milestone-id', milestone.id);
    return row;
  }

  function linkTaskToGoal(goal, milestone) {
    var eligible = state().tasks.filter(function (task) { return !task.archived; });
    if (!eligible.length) { ui.toast('Tambahkan tugas terlebih dahulu.', { kind: 'err' }); return; }
    var select = C.select(eligible.map(function (task) { return { value: task.id, label: task.title }; }), eligible[0].id);
    ui.modal({
      title: 'Hubungkan tugas ke ' + goal.title,
      body: [fieldInput('Tugas', select)],
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Hubungkan', primary: true, onClick: function () {
          var result = JF.goals.linkTask(state(), goal.id, select.value, milestone ? milestone.id : null, Date.now());
          if (!result.ok) { ui.toast('Tugas tidak dapat dihubungkan: ' + result.reason, { kind: 'err' }); return false; }
          save();
        } }
      ]
    });
  }

  /* Pohon goal: tumbuh dari progres; buah = milestone selesai, kuncup = milestone tersisa. */
  function treeSvg(pct, doneM, totalM, completed) {
    pct = Math.max(0, Math.min(100, Math.round(pct || 0)));
    var cx = 70, ground = 142, s = '';
    s += '<ellipse cx="70" cy="146" rx="52" ry="9" fill="#000" opacity=".1"/>';
    s += '<path d="M22 146c8-14 24-18 48-18s40 4 48 18z" fill="#8c6a4a"/>';
    if (pct === 0 && !doneM) {
      s += '<ellipse cx="70" cy="127" rx="7" ry="4.5" fill="#5b3f2a"/><path d="M70 123q-1-6 1-9" fill="none" stroke="#6fa56a" stroke-width="2" stroke-linecap="round" opacity=".7"/>';
    } else if (pct < 12) {
      s += '<path d="M70 130v-22" stroke="#7a9b4c" stroke-width="4" stroke-linecap="round"/><path d="M70 114q-20-2-22-18 18 0 22 18zM70 108q18-4 22-20-18 2-22 20z" fill="#6fa56a" stroke="#4d8350" stroke-width="2" stroke-linejoin="round"/>';
    } else {
      var h = 20 + pct * 0.4, w = 7 + pct * 0.08, r = 13 + pct * 0.28;
      var top = ground - 14 - h, cy = top - r * 0.2;
      s += '<path d="M' + (cx - w / 2) + ' ' + (ground - 12) + 'q' + (w / 6) + ' ' + (-h / 2) + ' 0 ' + (-h) + 'h' + w + 'q' + (-w / 6) + ' ' + (h / 2) + ' 0 ' + h + 'z" fill="#9a684e"/>';
      s += '<g class="cw-tree-canopy"><circle cx="' + (cx - r * 0.55) + '" cy="' + (cy + r * 0.28) + '" r="' + (r * 0.72) + '" fill="#5f9760"/><circle cx="' + (cx + r * 0.55) + '" cy="' + (cy + r * 0.28) + '" r="' + (r * 0.72) + '" fill="#5f9760"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#6fa56a"/><circle cx="' + (cx - r * 0.25) + '" cy="' + (cy - r * 0.3) + '" r="' + (r * 0.45) + '" fill="#7bb774" opacity=".8"/>';
      var n = Math.min(totalM || 0, 10), i, a, rad;
      for (i = 0; i < n; i++) {
        a = i * 2.4 + 0.6; rad = r * 0.68 * Math.sqrt((i + 1) / (n + 1));
        var fx = cx + Math.cos(a) * rad, fy = cy + Math.sin(a) * rad * 0.9;
        if (i < doneM) s += '<circle cx="' + fx.toFixed(1) + '" cy="' + fy.toFixed(1) + '" r="4.6" fill="#e8504a"/><circle cx="' + (fx - 1.2).toFixed(1) + '" cy="' + (fy - 1.4).toFixed(1) + '" r="1.3" fill="#fff" opacity=".8"/>';
        else s += '<circle cx="' + fx.toFixed(1) + '" cy="' + fy.toFixed(1) + '" r="3" fill="#f6c6d4" stroke="#e58ba6" stroke-width="1.2"/>';
      }
      s += '</g>';
      if (completed) s += '<path d="M' + cx + ' ' + (cy - r - 14) + 'l3.4 8 8.6.8-6.5 5.6 2 8.4-7.5-4.6-7.5 4.6 2-8.4-6.5-5.6 8.6-.8z" fill="#f2c24b" stroke="#c8962a" stroke-width="1.5" stroke-linejoin="round"/>';
    }
    return '<svg class="cw-tree" viewBox="0 0 140 160" role="img" aria-label="Pohon goal, progres ' + pct + ' persen" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
  }

  function milestoneStone(goal, milestone) {
    var mProgress = JF.goals.milestoneProgress(state(), goal, milestone);
    var wrap = C.el('li.cw-stone' + (milestone.done ? '.is-done' : ''));
    var row = C.el('div.cw-stone-row');
    row.appendChild(C.el('button.cw-check' + (milestone.done ? '.is-checked' : ''), {
      type: 'button', 'aria-label': (milestone.done ? 'Buka kembali ' : 'Selesaikan ') + milestone.title,
      onclick: function () { (milestone.done ? JF.goals.reopenMilestone : JF.goals.completeMilestone)(state(), goal.id, milestone.id, Date.now()); save(); }
    }, milestone.done ? '✓' : ''));
    row.appendChild(C.el('div.cw-stone-text', C.el('strong', milestone.title),
      C.el('small.cw-hint', mProgress.done + ' / ' + mProgress.total + ' tugas · ' + (milestone.deadline ? ui.fmt.dateShort(milestone.deadline) : 'tanpa tenggat'))));
    var more = C.el('details.cw-more.cw-stone-more', C.el('summary', 'Atur'));
    var menu = C.el('div.cw-inline-actions');
    menu.appendChild(C.button('Ubah', function () { editMilestone(goal, milestone); }, 'quiet'));
    menu.appendChild(C.button('Hubungkan tugas', function () { linkTaskToGoal(goal, milestone); }, 'quiet'));
    menu.appendChild(C.button('Naik', function () { JF.goals.moveMilestone(state(), goal.id, milestone.id, -1, Date.now()); save(); }, 'quiet'));
    menu.appendChild(C.button('Turun', function () { JF.goals.moveMilestone(state(), goal.id, milestone.id, 1, Date.now()); save(); }, 'quiet'));
    menu.appendChild(C.button('Hapus', function () {
      ui.confirm({ title: 'Hapus milestone?', body: 'Tugas tetap tersimpan; hanya relasi milestone ini yang dilepas.', okLabel: 'Hapus', danger: true })
        .then(function (yes) { if (yes) { JF.goals.removeMilestone(state(), goal.id, milestone.id, Date.now()); save(); } });
    }, 'danger'));
    more.appendChild(menu);
    row.appendChild(more);
    wrap.appendChild(row);
    JF.goals.taskRefs(state(), goal).filter(function (ref) { return ref.milestoneId === milestone.id; }).forEach(function (ref) {
      var task = JF.store.find(state(), ref.taskId);
      if (task) wrap.appendChild(linkedTaskRow(goal, task, milestone));
    });
    return wrap;
  }

  function renderGoals(host) {
    heading(host, 'KEBUN CITA-CITA', 'Tanam tujuan, panen langkah kecil', 'Setiap goal tumbuh jadi pohon. Milestone selesai menjadi buah, sisanya masih kuncup. Setiap goal tercapai memberi CapyRafi 120 XP.');
    var goals = JF.goals.list(state());
    var live = goals.filter(function (g) { return !g.archived; });
    var grown = live.filter(function (g) { return g.status === 'completed'; }).length;
    var bar = C.el('div.cw-garden-bar',
      C.el('span.cw-chip', live.length + ' pohon di kebun'),
      C.el('span.cw-chip.cw-chip-good', '★ ' + grown + ' sudah berbuah penuh'),
      C.button('＋ Tanam goal baru', createGoal, 'primary'));
    host.appendChild(bar);
    if (!live.length) {
      var emptyBox = panel('Kebun masih kosong', 'Pilih satu tujuan jangka panjang lalu pecah menjadi milestone.');
      emptyBox.appendChild(C.empty('Belum ada goal', 'Tekan "Tanam goal baru" untuk menanam benih pertamamu.'));
      host.appendChild(emptyBox);
    }
    var gardenGrid = C.el('div.cw-garden');
    live.forEach(function (goal) {
      var progress = JF.goals.progress(state(), goal);
      var doneM = goal.milestones.filter(function (m) { return m.done; }).length;
      var item = C.el('article.cw-goal-card' + (goal.status === 'completed' ? '.is-complete' : ''));
      item.appendChild(C.el('div.cw-goal-tree', { html: treeSvg(progress.pct, doneM, goal.milestones.length, goal.status === 'completed') }));
      var body = C.el('div.cw-goal-body');
      body.appendChild(C.el('div.cw-goal-top', C.el('div', C.el('span.cw-eyebrow', goal.category || 'GOAL'), C.el('h3', goal.title)),
        C.badge(JF.goals.STATUS_LABEL[goal.status] || goal.status, goal.status === 'completed' ? 'good' : 'soft')));
      if (goal.description) body.appendChild(C.el('p.cw-goal-desc', goal.description));
      body.appendChild(C.progress(progress.pct, 'Progres ' + goal.title));
      body.appendChild(C.el('small.cw-hint', (progress.label || (progress.done + ' dari ' + progress.total + ' langkah selesai')) + (goal.deadline ? ' · tenggat ' + ui.fmt.dateShort(goal.deadline) : '')));
      var path = C.el('ol.cw-path');
      if (!goal.milestones.length) path.appendChild(C.el('li.cw-stone-empty', 'Belum ada milestone. Tambahkan batu pijakan pertama.'));
      goal.milestones.forEach(function (milestone) { path.appendChild(milestoneStone(goal, milestone)); });
      body.appendChild(path);
      var foot = C.el('div.cw-goal-actions',
        C.button('＋ Milestone', function () { createMilestone(goal); }, 'quiet'),
        C.button('Hubungkan tugas', function () { linkTaskToGoal(goal, null); }, 'quiet'),
        C.button(goal.status === 'completed' ? 'Aktifkan kembali' : 'Tandai selesai', function () {
          (goal.status === 'completed' ? JF.goals.reopenGoal : JF.goals.completeGoal)(state(), goal.id, Date.now()); save();
        }, goal.status === 'completed' ? 'quiet' : 'primary'));
      var more = C.el('details.cw-more', C.el('summary', 'Lainnya'));
      more.appendChild(C.el('div.cw-inline-actions',
        C.button('Ubah goal', function () { editGoal(goal); }, 'quiet'),
        C.button('Arsipkan', function () {
          ui.confirm({ title: 'Arsipkan goal?', body: goal.title + ' akan disimpan di arsip.', okLabel: 'Arsipkan' })
            .then(function (yes) { if (yes) { JF.goals.archiveGoal(state(), goal.id, Date.now()); save(); } });
        }, 'quiet')));
      foot.appendChild(more);
      body.appendChild(foot);
      JF.goals.taskRefs(state(), goal).filter(function (ref) { return !ref.milestoneId; }).forEach(function (ref) {
        var task = JF.store.find(state(), ref.taskId);
        if (task) body.appendChild(linkedTaskRow(goal, task, null));
      });
      item.appendChild(body);
      gardenGrid.appendChild(item);
    });
    host.appendChild(gardenGrid);
    var archived = goals.filter(function (goal) { return goal.archived; });
    if (archived.length) {
      var archiveBox = panel('Goal diarsipkan', 'Goal tetap tersimpan dan dapat dipulihkan.');
      archived.forEach(function (goal) {
        archiveBox.appendChild(C.el('div.cw-linked-task', C.el('span', goal.title),
          C.button('Pulihkan', function () { JF.goals.restoreGoal(state(), goal.id, Date.now()); save(); }, 'quiet')));
      });
      host.appendChild(archiveBox);
    }
  }

  var settingsTab = 'tampilan';
  var journalSaver = null;
  var journalSavedAt = 0;
  function flushJournal() { if (journalSaver && journalSaver.isDirty()) journalSaver.flush(); }

  var JOURNAL_PROMPTS = [
    'Apa satu hal kecil yang bikin kamu bangga hari ini?',
    'Kalau hari ini sebuah cuaca, cuaca apa? Kenapa?',
    'Siapa atau apa yang paling membantumu hari ini?',
    'Apa yang ingin kamu lepaskan sebelum tidur?',
    'Satu hal apa yang kamu syukuri hari ini?',
    'Kalau hari ini bisa diulang, apa yang kamu ubah?',
    'Langkah paling kecil apa yang bisa bikin besok lebih ringan?'
  ];
  var JOURNAL_FIELDS = [
    ['wins', '☀', 'Hal yang berjalan baik', 'Tuliskan kemenangan kecil hari ini.'],
    ['challenges', '⛈', 'Tantangan', 'Apa yang terasa sulit?'],
    ['learned', '💡', 'Hal yang dipelajari', 'Catat satu hal yang ingin kamu ingat.'],
    ['priorities', '🎯', 'Prioritas berikutnya', 'Langkah kecil apa yang akan kamu ambil?']
  ];

  function journalWeek(day) {
    var start = JF.dates.addDays(day, -ui.dowIndex(day));
    var out = [];
    for (var i = 0; i < 7; i++) out.push(JF.dates.addDays(start, i));
    return out;
  }
  function writingRun() {
    var d = JF.app.today();
    if (!JF.journal.entryFor(state(), d)) d = JF.dates.addDays(d, -1);
    var n = 0;
    while (n < 400 && JF.journal.entryFor(state(), d)) { n++; d = JF.dates.addDays(d, -1); }
    return n;
  }

  function renderJournal(host) {
    flushJournal();
    heading(host, 'BUKU HARIAN', 'Tulis pelan-pelan, CapyRafi menemani', 'Catatan memakai tanggal dan relasi goal yang sama dengan Original, dan tersimpan otomatis saat kamu mengetik.');
    var day = journalDay;
    var entry = JF.journal.entryFor(state(), day) || {};
    var summary = JF.journal.summary(state(), day);
    var cr = JF.capyrafi;
    var info = cr.compute(state());
    var p = JF.dates.parseDay(day);
    var layout = C.el('div.cw-journal-layout');

    /* ── halaman buku ── */
    var book = C.el('section.cw-notebook');
    var nav = C.el('div.cw-notebook-head');
    var date = C.input('date', day, { 'aria-label': 'Tanggal catatan', onchange: function () { flushJournal(); journalDay = this.value || JF.app.today(); renderJournal(ui.clear(host)); } });
    function go(delta) { flushJournal(); journalDay = JF.dates.addDays(day, delta); renderJournal(ui.clear(host)); }
    nav.appendChild(C.el('div.cw-notebook-date', C.el('strong', String(p.d)), C.el('span', ui.monthLabel(JF.dates.buildDay(p.y, p.m, 1))),
      C.el('small', ui.DOW_SHORT[ui.dowIndex(day)] + (day === JF.app.today() ? ' · hari ini' : ''))));
    nav.appendChild(C.el('div.cw-notebook-nav', C.button('‹', function () { go(-1); }, 'quiet'), date, C.button('›', function () { go(1); }, 'quiet'),
      C.button('Hari ini', function () { flushJournal(); journalDay = JF.app.today(); renderJournal(ui.clear(host)); }, 'quiet')));
    book.appendChild(nav);

    var status = C.el('span.cw-save-status', journalSavedAt ? 'Tersimpan · ' + ui.fmt.time(journalSavedAt) : 'Tersimpan otomatis saat kamu mengetik');
    var editors = {};
    function readAll() {
      var patch = {};
      JOURNAL_FIELDS.forEach(function (item) { patch[item[0]] = editors[item[0]].value; });
      return patch;
    }
    journalSaver = JF.journal.createAutosave({
      delay: 650,
      save: function (d, content) {
        var r = JF.journal.save(state(), d, content, Date.now());
        if (!r.ok) return false;
        var ok = JF.app.save();
        if (ok) journalSavedAt = Date.now();
        return ok;
      },
      onStatus: function (st) {
        if (!status.isConnected) return;
        status.textContent = st === 'saving' ? 'Menyimpan…' : st === 'saved' ? 'Tersimpan · ' + ui.fmt.time(journalSavedAt || Date.now()) : 'Gagal menyimpan, coba lagi';
        status.classList.toggle('is-error', st === 'error');
      }
    });
    JOURNAL_FIELDS.forEach(function (item) {
      var sec = C.el('div.cw-jsec.cw-jsec-' + item[0]);
      sec.appendChild(C.el('label.cw-jtab', { for: 'jr-' + item[0] }, C.el('span', { 'aria-hidden': 'true' }, item[1]), ' ' + item[2]));
      var area = C.el('textarea.cw-input.cw-lined', { id: 'jr-' + item[0], rows: '4', placeholder: item[3], maxlength: '10000' }, entry[item[0]] || '');
      area.addEventListener('input', function () { journalSaver.schedule(day, readAll()); });
      editors[item[0]] = area;
      sec.appendChild(area);
      book.appendChild(sec);
    });
    var existingLink = JF.journal.goalLinkOf(state(), day);
    function saveNow() {
      var result = JF.journal.save(state(), day, readAll(), Date.now());
      if (!result.ok) { ui.toast('Catatan tidak dapat disimpan: ' + result.reason, { kind: 'err' }); return false; }
      if (link.value && result.entry) JF.journal.setGoalLink(state(), day, { goalId: link.value }, Date.now());
      else if (!link.value && result.entry && existingLink) JF.journal.setGoalLink(state(), day, null, Date.now());
      if (journalSaver) journalSaver.cancel();
      journalSavedAt = Date.now();
      save();
      return true;
    }
    var foot = C.el('div.cw-save-row', status);
    foot.appendChild(C.button('Simpan sekarang', function () { if (saveNow()) ui.toast('Refleksi tersimpan.', { kind: 'ok' }); }, 'primary'));
    book.appendChild(foot);
    layout.appendChild(book);

    /* ── sisi kanan ── */
    var side = C.el('aside.cw-journal-side');
    var hasEntry = !!JF.journal.entryFor(state(), day);
    var mood = hasEntry ? 'happy' : 'sleepy';
    var prompt = JOURNAL_PROMPTS[(hashOf(day) % JOURNAL_PROMPTS.length)];
    side.appendChild(C.el('div.cw-prompt-card',
      C.el('div.cw-prompt-art', { html: cr.svg({ stage: info.stage, mood: mood, crop: 'head', cls: 'cr-still' }) }),
      C.el('div', C.el('small', 'Pertanyaan CapyRafi'), C.el('p', prompt))));

    var week = C.el('div.cw-card-lite', C.el('h3', 'Minggu ini'));
    var strip = C.el('div.cw-week-strip', { role: 'list' });
    journalWeek(day).forEach(function (d) {
      var written = !!JF.journal.entryFor(state(), d);
      strip.appendChild(C.el('button.cw-week-day' + (d === day ? '.is-selected' : '') + (written ? '.is-written' : '') + (d === JF.app.today() ? '.is-today' : ''), {
        type: 'button', role: 'listitem', title: ui.fmt.date(d) + (written ? ' · ada catatan' : ''),
        'aria-label': ui.fmt.date(d) + (written ? ', ada catatan' : ', belum ada catatan'),
        onclick: function () { flushJournal(); journalDay = d; renderJournal(ui.clear(host)); }
      }, C.el('small', ui.DOW_SHORT[ui.dowIndex(d)]), C.el('strong', String(JF.dates.parseDay(d).d)), C.el('i')));
    });
    week.appendChild(strip);
    var run = writingRun();
    week.appendChild(C.el('p.cw-hint', run ? run + ' hari berturut-turut kamu menulis. Pertahankan!' : 'Tulis satu kalimat hari ini untuk memulai rangkaian hari menulis.'));
    side.appendChild(week);

    var daySum = C.el('div.cw-card-lite', C.el('h3', 'Hari ini dalam angka'));
    daySum.appendChild(summary
      ? C.el('div.cw-mini-stats', C.el('span', C.el('strong', String(summary.completed)), ' tugas selesai'), C.el('span', C.el('strong', ui.fmt.dur(summary.focusSec)), ' fokus'))
      : C.el('p.cw-hint', 'Belum ada ringkasan tersimpan untuk tanggal ini.'));
    var goals = JF.goals.list(state()).filter(function (goal) { return !goal.archived; });
    var link = C.select([{ value: '', label: 'Tanpa goal' }].concat(goals.map(function (goal) { return { value: goal.id, label: goal.title }; })),
      existingLink ? existingLink.goalId : '', { 'aria-label': 'Konteks goal' });
    link.addEventListener('change', saveNow);
    daySum.appendChild(fieldInput('Konteks goal (opsional)', link));
    side.appendChild(daySum);
    layout.appendChild(side);
    host.appendChild(layout);
  }

  function renderSettings(host) {
    heading(host, 'PENGATUR RUANG', 'Sesuaikan sesi dan suasana', 'Preferensi experience, timer, dan target disimpan melalui sumber state aplikasi yang sama.');
    var stateNow = state();
    var settings = stateNow.settings;
    var sections = { tampilan: [], ritme: [], mini: [], musik: [], data: [], pembaruan: [] };
    var display = panel('Experience aplikasi', 'Pilih pengalaman visual. Datanya tetap satu, jadi pindah kapan saja aman.');
    var current = JF.homeExperience.get();
    var tiles = C.el('div.cw-exp-tiles', { role: 'radiogroup', 'aria-label': 'Experience aplikasi' });
    var crNow = JF.capyrafi.compute(state());
    var tileSpecs = [
      ['original', 'Original', 'Sidebar klasik dan halaman standar.',
        '<svg viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" rx="10" fill="var(--cw-soft)"/><rect x="6" y="6" width="26" height="68" rx="6" fill="var(--cw-line)"/><rect x="38" y="8" width="74" height="12" rx="4" fill="var(--cw-card)"/><rect x="38" y="26" width="74" height="22" rx="5" fill="var(--cw-card)"/><rect x="38" y="52" width="74" height="22" rx="5" fill="var(--cw-card)"/></svg>'],
      ['capybara-world', 'Capybara World', 'Rumah CapyRafi, papan tugas, kebun goal.',
        JF.capyrafi.svg({ stage: crNow.stage, mood: 'happy', crop: 'head', cls: 'cr-still' })]
    ];
    tileSpecs.forEach(function (spec) {
      var tile = C.el('button.cw-exp-tile' + (current === spec[0] ? '.is-current' : ''), {
        type: 'button', role: 'radio', 'aria-checked': String(current === spec[0]),
        onclick: function () {
          try {
            JF.homeExperience.set(spec[0]);
            ui.toast('Experience tersimpan.', { kind: 'ok' });
            tiles.querySelectorAll('.cw-exp-tile').forEach(function (node) {
              var on = node === tile;
              node.classList.toggle('is-current', on);
              node.setAttribute('aria-checked', String(on));
            });
          } catch (error) { ui.toast('Experience tidak dapat disimpan: ' + error.message, { kind: 'err' }); }
        }
      }, C.el('span.cw-exp-art', { html: spec[3] }), C.el('strong', spec[1]), C.el('small', spec[2]));
      tiles.appendChild(tile);
    });
    display.appendChild(tiles);
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var seg = C.el('div.cw-seg', { role: 'group', 'aria-label': 'Mode warna' });
    [['☼ Terang', false], ['☾ Gelap', true]].forEach(function (item) {
      seg.appendChild(C.el('button.cw-seg-btn' + (isDark === item[1] ? '.is-current' : ''), {
        type: 'button', 'aria-pressed': String(isDark === item[1]),
        onclick: function () { if (isDark !== item[1]) JF.theme.toggle(); }
      }, item[0]));
    });
    display.appendChild(fieldInput('Mode warna', seg));
    sections.tampilan.push(display);
    var pet = panel('CapyRafi', 'Karakter pendamping yang tumbuh dari tugas dan goal yang kamu selesaikan.');
    pet.appendChild(C.el('div.cw-pet-card',
      C.el('div.cw-pet-card-art', { html: JF.capyrafi.svg({ stage: crNow.stage, mood: 'happy', width: 120, cls: 'cr-still' }) }),
      C.el('div', C.el('h3', 'Lv.' + crNow.level + ' · ' + crNow.name), C.el('p.cw-hint', crNow.xp + ' XP' + (crNow.max ? ' · tahap tertinggi' : ' · ' + crNow.toNext + ' XP lagi menuju ' + crNow.next.name)),
        C.progress(crNow.pct, 'Progres CapyRafi'),
        C.el('div.cw-note-meta', C.el('span.cw-chip', 'Tugas selesai +' + JF.capyrafi.XP.task + ' XP'), C.el('span.cw-chip', 'Milestone +' + JF.capyrafi.XP.milestone + ' XP'), C.el('span.cw-chip', 'Goal tercapai +' + JF.capyrafi.XP.goal + ' XP')))));
    sections.tampilan.push(pet);

    var formPanel = panel('Ritme fokus', 'Nilai disimpan ke pengaturan aplikasi yang sudah ada.');
    var fields = [
      ['defaultFocusSec', 'Durasi fokus bawaan (menit)', Math.round((settings.defaultFocusSec || 1500) / 60), 1, 600, 60],
      ['defaultFocusTargetMin', 'Target fokus harian (menit)', settings.defaultFocusTargetMin || 120, 1, 1440, 1],
      ['shortBreakMin', 'Istirahat pendek (menit)', settings.shortBreakMin, 1, 60, 1],
      ['longBreakMin', 'Istirahat panjang (menit)', settings.longBreakMin, 1, 120, 1],
      ['longBreakEvery', 'Istirahat panjang tiap sesi', settings.longBreakEvery, 2, 12, 1],
      ['tasksPerDay', 'Target tugas untuk rentetan', settings.tasksPerDay, 1, 50, 1]
    ];
    var controls = {};
    var fieldGrid = C.el('div.cw-form-grid');
    formPanel.appendChild(fieldGrid);
    fields.forEach(function (item) {
      controls[item[0]] = C.input('number', item[2], { min: String(item[3]), max: String(item[4]) });
      fieldGrid.appendChild(fieldInput(item[1], controls[item[0]]));
    });
    var pomo = C.input('checkbox', '', { checked: !!settings.pomoOn });
    var warn = C.input('checkbox', '', { checked: !!settings.warn8 });
    formPanel.appendChild(switchField('Aktifkan istirahat Pomodoro otomatis', pomo, 'Istirahat mulai otomatis setelah sesi fokus selesai.'));
    formPanel.appendChild(switchField('Peringatan sebelum timer selesai', warn, 'Bunyi singkat beberapa detik sebelum waktu habis.'));
    formPanel.appendChild(C.button('Simpan pengaturan timer', function () {
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i], value = Number(controls[f[0]].value);
        if (!isFinite(value) || value < f[3] || value > f[4]) {
          ui.toast(f[1] + ' di luar batas yang diizinkan.', { kind: 'err' }); return;
        }
        if (f[0] !== 'defaultFocusTargetMin') settings[f[0]] = Math.round(value) * f[5];
      }
      JF.store.setFocusTargetDefault(state(), controls.defaultFocusTargetMin.value, Date.now());
      settings.pomoOn = pomo.checked;
      settings.warn8 = warn.checked;
      save();
      ui.toast('Pengaturan timer tersimpan.', { kind: 'ok' });
    }, 'primary'));
    sections.ritme.push(formPanel);

    var targets = panel('Target fokus per tanggal', 'Target khusus menggantikan target bawaan hanya pada tanggal yang dipilih.');
    var targetDate = C.input('date', JF.app.today());
    var targetMin = C.input('number', settings.defaultFocusTargetMin || 120, { min: '1', max: '1440' });
    targets.appendChild(fieldInput('Tanggal', targetDate));
    targets.appendChild(fieldInput('Target (menit)', targetMin));
    targets.appendChild(C.button('Simpan target tanggal', function () {
      var result = JF.store.setFocusTargetOverride(state(), targetDate.value, targetMin.value, Date.now());
      if (!result.ok) { ui.toast('Tanggal atau target tidak valid.', { kind: 'err' }); return; }
      save();
      ui.toast('Target khusus tersimpan.', { kind: 'ok' });
    }, 'quiet'));
    Object.keys(settings.targetOverrides || {}).sort().reverse().forEach(function (day) {
      var row = C.el('div.cw-linked-task', C.el('span', ui.fmt.date(day) + ' · ' + ui.fmt.min(settings.targetOverrides[day])),
        C.button('Hapus target khusus', function () {
          JF.store.clearFocusTargetOverride(state(), day, Date.now());
          save();
        }, 'quiet'));
      targets.appendChild(row);
    });
    sections.ritme.push(targets);

    var mini = panel('Kartu mini', 'Transparansi dan perilaku kartu saat kursor di atasnya.');
    if (!root.desk || !root.desk.getMiniSettings) {
      mini.appendChild(C.el('p.cw-hint', 'Kontrol kartu mini tidak tersedia di lingkungan ini.'));
    } else {
      var opacity = C.input('range', 100, { min: '40', max: '100', 'aria-label': 'Transparansi kartu mini' });
      var opacityValue = C.el('span.cw-hint', '100%');
      var solid = C.input('checkbox', '', {});
      mini.appendChild(fieldInput('Transparansi', C.el('div.cw-inline', opacity, opacityValue)));
      mini.appendChild(switchField('Solid saat kursor di atas kartu', solid));
      root.desk.getMiniSettings().then(function (cfg) {
        cfg = cfg || {};
        var pct = Math.round((cfg.opacity != null ? cfg.opacity : 1) * 100);
        opacity.value = pct; opacityValue.textContent = pct + '%';
        solid.checked = !!cfg.solidOnHover;
      }).catch(function () {});
      opacity.addEventListener('input', function () { opacityValue.textContent = opacity.value + '%'; });
      opacity.addEventListener('change', function () { root.desk.saveMiniSettings({ opacity: Number(opacity.value) / 100 }); });
      solid.addEventListener('change', function () { root.desk.saveMiniSettings({ solidOnHover: solid.checked }); });
    }
    sections.mini.push(mini);

    var music = panel('Musik sesi dan alarm istirahat', 'Playlist memakai penyimpanan media aplikasi yang sudah ada.');
    var musicState = JF.app.music;
    var playlistFiles = C.input('file', '', { accept: 'audio/*', multiple: '', hidden: '' });
    var breakFile = C.input('file', '', { accept: 'audio/*', hidden: '' });
    music.appendChild(C.el('p.cw-hint', musicState.loaded ? musicState.tracks.length + ' lagu di playlist · ' + musicState.breakName : 'Memuat playlist tersimpan…'));
    music.appendChild(C.button('Tambah lagu', function () { playlistFiles.click(); }, 'quiet'));
    music.appendChild(C.button('Pilih alarm akhir istirahat', function () { breakFile.click(); }, 'quiet'));
    music.appendChild(C.button('Tes alarm', function () { musicState.testBreak(); }, 'quiet'));
    music.appendChild(C.button(musicState.loop ? 'Matikan pengulangan playlist' : 'Ulangi playlist di luar istirahat', function () {
      musicState.setLoop(!musicState.loop); renderSettings(ui.clear(host));
    }, 'quiet'));
    playlistFiles.addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (!files.length) return;
      musicState.addTracks(files).then(function (result) {
        if (result.rejected.length) ui.toast('Sebagian lagu tidak dapat ditambahkan: ' + result.rejected.map(function (item) { return item.name; }).join(', '), { kind: 'err' });
        if (result.added.length) { ui.toast(result.added.length + ' lagu ditambahkan.', { kind: 'ok' }); renderSettings(ui.clear(host)); }
      });
    });
    breakFile.addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (file) { musicState.pickBreak(file, file.name); renderSettings(ui.clear(host)); }
    });
    musicState.tracks.forEach(function (track) {
      music.appendChild(C.el('div.cw-linked-task', C.el('span', track.name + (track.missing ? ' · file hilang' : '')),
        C.button(musicState.status && musicState.status.trackId === track.id ? 'Jeda musik' : 'Putar', function () {
          var isCurrent = musicState.status && musicState.status.trackId === track.id;
          if (isCurrent) musicState.togglePause(); else musicState.play(track.id);
        }, 'quiet'),
        C.button('Hapus dari playlist', function () {
          musicState.removeTrack(track.id).then(function () { renderSettings(ui.clear(host)); });
        }, 'quiet')));
    });
    if (musicState.tracks.length) {
      music.appendChild(C.button('Hentikan musik', function () { musicState.stopAllMusic(); }, 'quiet'));
      music.appendChild(C.button('Kosongkan playlist', function () {
        ui.confirm({ title: 'Kosongkan playlist?', body: 'Hanya salinan playlist aplikasi yang dihapus; file asli tidak disentuh.', okLabel: 'Kosongkan', danger: true })
          .then(function (yes) { if (yes) musicState.clearPlaylist().then(function () { renderSettings(ui.clear(host)); }); });
      }, 'danger'));
    }
    sections.musik.push(music);

    var data = panel('Data lokal', 'Tidak ada database atau sistem penyimpanan kedua untuk Capybara World.');
    data.appendChild(C.el('div.cw-stat-grid',
      C.stat('Tugas', String(stateNow.tasks.length)),
      C.stat('Goal', String(stateNow.goals.length)),
      C.stat('Dokumen', String(stateNow.library.length))));
    data.appendChild(C.button('Buka kartu mini', function () { if (root.desk && root.desk.mini) root.desk.mini(true); }, 'quiet'));
    data.appendChild(C.button('Ekspor cadangan JSON', exportBackup, 'quiet'));
    var backupFile = C.input('file', '', { accept: '.json,application/json', hidden: '' });
    data.appendChild(C.button('Pulihkan cadangan', function () { backupFile.click(); }, 'quiet'));
    backupFile.addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      if (file.size > JF.backup.MAX_CHARS) { ui.toast('Berkas terlalu besar untuk dipulihkan.', { kind: 'err' }); return; }
      file.text().then(function (text) {
        var result = JF.backup.validate(text);
        if (!result.ok) { ui.toast(result.error, { kind: 'err' }); return; }
        ui.confirm({
          title: 'Ganti data dengan cadangan?',
          body: 'Cadangan berisi ' + result.summary.tasks + ' tugas dan ' + result.summary.sessions + ' sesi. Data saat ini akan diekspor sebagai pengaman sebelum diganti.',
          okLabel: 'Pulihkan', danger: true
        }).then(function (yes) {
          if (!yes) return;
          exportBackup('jam-fokus-sebelum-pemulihan-');
          JF.app.replaceState(result.state);
          ui.toast('Data berhasil dipulihkan.', { kind: 'ok' });
        });
      }).catch(function () { ui.toast('Berkas cadangan tidak dapat dibaca.', { kind: 'err' }); });
    });
    sections.data.push(data);

    var upd = panel('Pembaruan aplikasi', 'Unduh, pasang, dan restart otomatis. Datamu dicadangkan lebih dulu.');
    if (JF.updateUI) upd.appendChild(JF.updateUI.mount());
    sections.pembaruan.push(upd);

    var tabs = [['tampilan', 'Tampilan', '🎨'], ['ritme', 'Ritme fokus', '⏱'], ['mini', 'Kartu mini', '▭'], ['musik', 'Musik', '♪'], ['data', 'Data', '🗂'], ['pembaruan', 'Pembaruan', '⬆']];
    var layout = C.el('div.cw-settings-layout');
    var nav = C.el('nav.cw-settings-nav', { 'aria-label': 'Bagian pengaturan' });
    tabs.forEach(function (tab) {
      nav.appendChild(C.el('button.cw-set-tab' + (settingsTab === tab[0] ? '.is-current' : ''), {
        type: 'button', 'aria-current': settingsTab === tab[0] ? 'page' : 'false',
        onclick: function () { settingsTab = tab[0]; renderSettings(ui.clear(host)); }
      }, C.el('span', { 'aria-hidden': 'true' }, tab[2]), C.el('span', tab[1])));
    });
    var pane = C.el('div.cw-settings-pane');
    (sections[settingsTab] || sections.tampilan).forEach(function (node) { pane.appendChild(node); });
    layout.appendChild(nav);
    layout.appendChild(pane);
    host.appendChild(layout);
  }

  function switchField(label, input, hint) {
    var node = C.el('label.cw-switch', input, C.el('span.cw-switch-ui', { 'aria-hidden': 'true' }),
      C.el('span.cw-switch-text', C.el('strong', label), hint ? C.el('small', hint) : null));
    return node;
  }


  function exportBackup(prefix) {
    try {
      var payload = JSON.stringify({ app: 'jam-fokus', exportedAt: new Date().toISOString(), state: state() }, null, 2);
      var url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      var link = document.createElement('a');
      link.href = url;
      link.download = (prefix || 'jam-fokus-cadangan-') + JF.app.today() + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      ui.toast('Cadangan diunduh.', { kind: 'ok' });
    } catch (error) {
      ui.toast('Gagal mengekspor cadangan: ' + error.message, { kind: 'err' });
    }
  }

  var libraryType = 'all';
  var LIB_KIND = { file: ['📄', 'File'], link: ['🔗', 'Tautan'], note: ['📝', 'Catatan'] };

  function libraryCard(item, host, listRefresh) {
    var kind = LIB_KIND[item.type] || ['📄', 'Item'];
    var selected = selectedLibraryId === item.id;
    var card = C.el('article.cw-book.cw-book-' + item.type + (selected ? '.is-selected' : ''));
    card.appendChild(C.el('div.cw-book-spine', { 'aria-hidden': 'true' }, kind[0]));
    var body = C.el('div.cw-book-body');
    body.appendChild(C.el('div.cw-book-top', C.el('h3', item.title), C.el('span.cw-chip', kind[1] + (item.type === 'file' ? ' · ' + JF.library.typeGroup(item).toUpperCase() : ''))));
    body.appendChild(C.el('p.cw-book-desc', item.description || item.originalName || item.url || JF.library.moduleLabel(item.source.module)));
    var meta = C.el('div.cw-note-meta', C.el('span.cw-chip', JF.library.moduleLabel(item.source.module)));
    if (item.createdAt) meta.appendChild(C.el('span.cw-chip', ui.fmt.dateShort(JF.dates.dayKey(item.createdAt))));
    body.appendChild(meta);
    var actions = C.el('div.cw-note-actions');
    if (item.type === 'file') actions.appendChild(C.button('Buka', function () {
      JF.documents.open(item).then(function (result) { if (!result.ok) ui.toast('File tidak dapat dibuka: ' + JF.documents.message(result.reason), { kind: 'err' }); });
    }, 'primary'));
    actions.appendChild(C.button(selected ? 'Tutup detail' : 'Detail', function () { selectedLibraryId = selected ? null : item.id; listRefresh(); }, 'quiet'));
    actions.appendChild(C.button('Hapus', function () {
      ui.confirm({ title: 'Hapus dokumen?', body: '"' + item.title + '" akan dihapus dari Library. Relasi tugas yang sudah selesai tetap disimpan.', okLabel: 'Hapus', danger: true })
        .then(function (yes) { if (yes) JF.documents.removeDocument(item).then(function (result) {
          if (!result.ok) { ui.toast('Dokumen gagal dihapus.', { kind: 'err' }); return; }
          selectedLibraryId = null;
        }); });
    }, 'quiet'));
    body.appendChild(actions);
    if (selected) {
      var paths = JF.library.contextPaths(state(), item);
      body.appendChild(C.el('p.cw-library-context', paths.length ? 'Konteks: ' + paths.map(function (path) { return path.label; }).join(' · ') : 'Dokumen mandiri'));
      if (item.type === 'note' && item.noteText) body.appendChild(C.el('p.cw-library-context', item.noteText));
    }
    card.appendChild(body);
    return card;
  }

  function renderLibrary(host) {
    heading(host, 'RAK PENGETAHUAN', 'Bahan penting di satu tempat', 'Dokumen tetap terhubung ke Goal, Milestone, dan Task melalui Library bersama.');
    var all = state().library;
    var counts = { file: 0, link: 0, note: 0 };
    all.forEach(function (item) { if (counts[item.type] != null) counts[item.type]++; });
    var actions = C.el('div.cw-inline-actions');
    actions.appendChild(C.button('＋ Impor berkas', function () {
      JF.documents.importStandalone().then(function (out) {
        if (out.failed.length) ui.toast('Impor gagal: ' + out.failed.map(function (item) { return item.name + ' (' + JF.documents.message(item.reason) + ')'; }).join('; '), { kind: 'err', timeout: 8000 });
        if (out.added.length || out.linked.length) ui.toast('Dokumen tersimpan di Library.', { kind: 'ok' });
      });
    }, 'primary'));
    actions.appendChild(C.button('Tambah tautan', function () { createLibraryItem('link'); }, 'quiet'));
    actions.appendChild(C.button('Tambah catatan', function () { createLibraryItem('note'); }, 'quiet'));

    var bar = C.el('section.cw-shelf-bar');
    var search = C.input('search', librarySearch, { placeholder: 'Cari judul, deskripsi, atau URL…', 'aria-label': 'Cari di Library' });
    var chips = C.el('div.cw-filter-tabs', { role: 'tablist', 'aria-label': 'Jenis dokumen' });
    var results = C.el('div.cw-shelf');
    function refresh() {
      chips.textContent = '';
      [['all', 'Semua', all.length], ['file', 'File', counts.file], ['link', 'Tautan', counts.link], ['note', 'Catatan', counts.note]].forEach(function (item) {
        var b = C.button(item[1] + ' · ' + item[2], function () { libraryType = item[0]; refresh(); }, libraryType === item[0] ? 'primary' : 'quiet');
        b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(libraryType === item[0])); chips.appendChild(b);
      });
      results.textContent = '';
      var rows = JF.library.query(state(), { search: librarySearch, sort: 'date' }, JF.documents.statusMap())
        .filter(function (item) { return libraryType === 'all' || item.type === libraryType; });
      if (!rows.length) results.appendChild(C.empty(all.length ? 'Tidak ada hasil' : 'Rak masih kosong',
        all.length ? 'Coba ubah kata pencarian atau jenisnya.' : 'Impor dokumen atau tambahkan catatan dan tautan.'));
      rows.forEach(function (item) { results.appendChild(libraryCard(item, host, refresh)); });
    }
    search.addEventListener('input', function () { librarySearch = search.value; refresh(); });
    bar.appendChild(C.el('div.cw-shelf-search', search, actions));
    bar.appendChild(chips);
    host.appendChild(bar);
    host.appendChild(results);
    refresh();
    JF.documents.ensureFresh(function () { if (renderedPage === 'library') renderLibrary(ui.clear(host)); });
  }

  function createLibraryItem(type) {
    var title = C.input('text', '', { maxlength: String(JF.library.LIMITS.title) });
    var description = C.el('textarea.cw-input', { rows: '2', maxlength: String(JF.library.LIMITS.description) });
    var url = type === 'link' ? C.input('url', '', { placeholder: 'https://' }) : null;
    var body = [fieldInput('Judul', title), fieldInput('Deskripsi', description)];
    var noteText = type === 'note' ? C.el('textarea.cw-input', { rows: '5' }) : null;
    if (url) body.push(fieldInput('Alamat tautan', url));
    if (noteText) body.push(fieldInput('Isi catatan', noteText));
    ui.modal({
      title: type === 'link' ? 'Simpan tautan' : 'Buat catatan',
      body: body,
      actions: [
        { label: 'Batal', ghost: true },
        { label: 'Simpan', primary: true, onClick: function () {
          try {
            var item = JF.library.createItem({
              type: type, title: title.value, description: description.value, url: url && url.value,
              noteText: noteText && noteText.value, source: { module: 'library' }
            }, Date.now());
            state().library.push(item);
            save();
          } catch (error) { ui.toast(error.message || 'Tautan tidak valid.', { kind: 'err' }); return false; }
        } }
      ]
    });
  }

  function render(id, host) {
    if (renderedPage === 'jurnal' && id !== 'jurnal') flushJournal();
    renderedPage = id;
    ui.clear(host);
    host.dataset.page = id;
    switch (id) {
      case 'beranda': renderHome(host); break;
      case 'tugas': renderTasks(host); break;
      case 'kalender': renderCalendar(host); break;
      case 'analitik': renderAnalytics(host); break;
      case 'riwayat': renderHistory(host); break;
      case 'laporan': renderReports(host); break;
      case 'goals': renderGoals(host); break;
      case 'jurnal': renderJournal(host); break;
      case 'pengaturan': renderSettings(host); break;
      case 'library': renderLibrary(host); break;
      default: renderHome(host);
    }
  }

  function frame(id) {
    if (id === 'beranda' && JF.capybaraHome) JF.capybaraHome.frame();
  }

  JF.capybaraPages = { render: render, frame: frame };
})(window);
