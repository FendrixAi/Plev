/* Independent Capybara World page compositions backed by the shared JF services. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var C = JF.capybaraUI;
  var ui = JF.ui;
  var selectedDay = JF.app.today();
  var calendarMonth = JF.app.today().slice(0, 7) + '-01';
  var taskView = 'active';
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
      host.appendChild(C.button('Mulai fokus', function () { JF.app.startTask(task.id); }, 'primary'));
      host.appendChild(C.button('Tandai selesai', function () { JF.app.completeTask(task.id); }, 'quiet'));
    } else if (task.done && !task.archived) {
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

  function renderTasks(host) {
    heading(host, 'PAPAN LANGKAH', 'Tugas yang terasa ringan', 'Atur prioritas, tanggal, dan sesi fokus dalam satu papan yang mudah dipindai.');
    var quick = panel('Tambah langkah baru', 'Tanggal target diperlukan agar rencana dan kalender tetap akurat.');
    var form = C.el('form.cw-task-form');
    var title = C.input('text', '', { placeholder: 'Apa yang ingin kamu selesaikan?', maxlength: '120', required: '' });
    var date = C.input('date', JF.app.today(), { required: '' });
    var priority = C.select(JF.model.PRIORITIES.map(function (p) { return { value: p, label: JF.model.PRIORITY_LABEL[p] }; }), 'normal');
    var details = C.el('textarea.cw-input', { placeholder: 'Catatan kecil (opsional)', rows: '2', maxlength: '2000' });
    form.appendChild(fieldInput('Nama tugas', title));
    form.appendChild(fieldInput('Tenggat', date));
    form.appendChild(fieldInput('Prioritas', priority));
    form.appendChild(fieldInput('Catatan', details));
    var add = C.button('Tambahkan ke rencana', function () {}, 'primary');
    add.type = 'submit';
    form.appendChild(add);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      try {
        JF.store.addTask(state(), { title: title.value, targetDate: date.value, priority: priority.value, description: details.value }, Date.now());
        save();
      } catch (error) { ui.toast(error.message, { kind: 'err' }); }
    });
    quick.appendChild(form);
    host.appendChild(quick);

    var tabs = C.el('div.cw-filter-tabs', { role: 'tablist', 'aria-label': 'Filter tugas' });
    [['active', 'Aktif'], ['completed', 'Selesai'], ['archived', 'Arsip']].forEach(function (item) {
      var b = C.button(item[1], function () { taskView = item[0]; renderTasks(host); }, taskView === item[0] ? 'primary' : 'quiet');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(taskView === item[0])); tabs.appendChild(b);
    });
    host.appendChild(tabs);
    var list = C.el('div.cw-task-board');
    var tasks = state().tasks.filter(function (task) {
      if (taskView === 'archived') return task.archived;
      if (task.archived) return false;
      return taskView === 'completed' ? task.done : !task.done;
    }).sort(function (a, b) { return a.targetDate.localeCompare(b.targetDate) || a.title.localeCompare(b.title, 'id'); });
    if (!tasks.length) {
      list.appendChild(C.empty(taskView === 'active' ? 'Papanmu masih lengang' : 'Belum ada tugas di sini',
        taskView === 'active' ? 'Tambahkan satu langkah kecil untuk memulai.' : 'Tugas pada kategori ini akan muncul di sini.'));
    } else tasks.forEach(function (task) {
      list.appendChild(taskCard(task, { edit: true, archive: taskView !== 'archived', restore: taskView === 'archived' }));
    });
    host.appendChild(list);
  }

  function renderCalendar(host) {
    heading(host, 'KALENDER KAMAR', 'Lihat ritme waktumu', 'Pilih hari untuk melihat tugas dan sesi yang terkait dengan tanggal itu.');
    var p = JF.dates.parseDay(calendarMonth);
    var monthStart = JF.dates.buildDay(p.y, p.m, 1);
    var firstOffset = ui.dowIndex(monthStart);
    var monthTitle = ui.monthLabel(monthStart);
    var controls = C.el('div.cw-calendar-controls');
    controls.appendChild(C.button('‹ Sebelumnya', function () { calendarMonth = JF.dates.addDays(monthStart, -1).slice(0, 7) + '-01'; renderCalendar(host); }, 'quiet'));
    controls.appendChild(C.el('strong', monthTitle));
    controls.appendChild(C.button('Berikutnya ›', function () { calendarMonth = JF.dates.addDays(JF.dates.addDays(monthStart, 32), -1).slice(0, 7) + '-01'; renderCalendar(host); }, 'quiet'));
    var box = panel('Peta bulanan', 'Titik kecil menandai hari yang memiliki tugas tersimpan.', controls);
    var grid = C.el('div.cw-calendar-grid', { role: 'grid', 'aria-label': monthTitle });
    ui.DOW_SHORT.forEach(function (d) { grid.appendChild(C.el('span.cw-weekday', { role: 'columnheader' }, d)); });
    var start = JF.dates.addDays(monthStart, -firstOffset);
    for (var i = 0; i < 42; i++) {
      var day = JF.dates.addDays(start, i);
      var tasks = dayTasks(day);
      var cell = C.el('button.cw-day' + (day.slice(0, 7) !== monthStart.slice(0, 7) ? '.is-outside' : '') +
        (day === selectedDay ? '.is-selected' : '') + (day === JF.app.today() ? '.is-today' : ''),
      { type: 'button', role: 'gridcell', 'aria-label': ui.fmt.date(day), 'aria-selected': String(day === selectedDay),
        onclick: function (selected) { return function () { selectedDay = selected; renderCalendar(host); }; }(day) },
      C.el('span', String(JF.dates.parseDay(day).d)));
      if (tasks.length) cell.appendChild(C.el('small.cw-day-count', String(tasks.length)));
      grid.appendChild(cell);
    }
    box.appendChild(grid);
    host.appendChild(box);
    var agenda = panel(ui.fmt.date(selectedDay), 'Agenda tanggal terpilih');
    var dayList = dayTasks(selectedDay);
    if (!dayList.length) agenda.appendChild(C.empty('Belum ada agenda', 'Tambahkan tugas dengan tanggal ini dari halaman Tugas.'));
    else dayList.forEach(function (task) { agenda.appendChild(taskCard(task, { edit: true })); });
    host.appendChild(agenda);
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
    host.appendChild(focus);
  }

  function renderAnalytics(host) {
    heading(host, 'JEJAK PRODUKTIVITAS', 'Kenali pola fokusmu', 'Ringkasan ini dihitung dari tugas, sesi, jurnal, dan goal yang benar-benar tersimpan.');
    var controls = C.el('div.cw-filter-tabs');
    var kind = C.select(['day', 'week', 'month', 'year'].map(function (value) {
      return { value: value, label: { day: 'Harian', week: 'Mingguan', month: 'Bulanan', year: 'Tahunan' }[value] };
    }), analyticsKind, { 'aria-label': 'Periode analitik', onchange: function () { analyticsKind = this.value; renderAnalytics(host); } });
    controls.appendChild(fieldInput('Periode', kind));
    controls.appendChild(C.button('‹', function () { analyticsAnchor = JF.analytics.shift(analyticsKind, analyticsAnchor, -1); renderAnalytics(host); }, 'quiet'));
    controls.appendChild(C.button('Hari ini', function () { analyticsAnchor = JF.app.today(); renderAnalytics(host); }, 'quiet'));
    controls.appendChild(C.button('›', function () { analyticsAnchor = JF.analytics.shift(analyticsKind, analyticsAnchor, 1); renderAnalytics(host); }, 'quiet'));
    var stateNow = state();
    var period = JF.analytics.period(analyticsKind, analyticsAnchor, JF.app.today());
    var result = JF.analytics.compute(stateNow, { today: JF.app.today(), period: period });
    var stats = result.current;
    var summary = panel(JF.analytics.label(period), 'Periode pembanding sebelumnya digunakan untuk menghitung perubahan.');
    var rate = stats.rate.rate == null ? 'Belum cukup data' : Math.round(stats.rate.rate * 100) + '%';
    var statGrid = C.el('div.cw-stat-grid',
      C.stat('Tugas selesai', String(stats.tasksCompleted), 'dalam periode'),
      C.stat('Fokus tercatat', ui.fmt.dur(stats.focusSec), stats.sessionsDone + ' sesi selesai'),
      C.stat('Tingkat selesai', rate, stats.rate.eligible + ' tugas memenuhi syarat'),
      C.stat('Fokus terputus', ui.fmt.dur(stats.interruptedSec), stats.sessionsCut + ' sesi'));
    summary.appendChild(statGrid);
    summary.appendChild(C.heading('Hari demi hari', 'Grafik menggunakan data yang tersedia; periode tanpa data tidak diperlakukan sebagai nol.'));
    var bars = C.el('div.cw-analytics-bars');
    var maxFocus = Math.max.apply(null, stats.rows.map(function (row) { return row.focusSec || 0; }).concat([1]));
    stats.rows.slice(-14).forEach(function (row) {
      var item = C.el('div.cw-bar-item', C.el('span.cw-bar-value', row.focusSec == null ? '—' : ui.fmt.durShort(row.focusSec)));
      item.appendChild(C.el('div.cw-bar-track', C.el('span', { style: { height: (row.focusSec == null ? 0 : Math.max(4, row.focusSec / maxFocus * 100)) + '%' } })));
      item.appendChild(C.el('small', row.date.slice(-2)));
      bars.appendChild(item);
    });
    summary.appendChild(bars);
    host.appendChild(controls);
    host.appendChild(summary);
    var insight = panel('Pola tersimpan', 'Turunan dari catatan produktivitas, tanpa membuat data baru.');
    if (result.insights && result.insights.length) result.insights.forEach(function (text) { insight.appendChild(C.el('p.cw-insight', text.text || text)); });
    else insight.appendChild(C.empty('Belum ada pola yang cukup kuat', 'Lanjutkan aktivitas seperti biasa; insight akan muncul saat data mencukupi.'));
    host.appendChild(insight);
  }

  function renderHistory(host) {
    heading(host, 'JURNAL FOKUS', 'Sesi yang sudah kamu jalani', 'Sesi selesai dan sesi terputus disajikan terpisah sesuai catatan timer.');
    var sessions = state().sessions.slice().sort(function (a, b) {
      return (b.completedAt || b.endedAt || b.startedAt) - (a.completedAt || a.endedAt || a.startedAt);
    });
    var totals = sessions.reduce(function (acc, session) {
      if (session.state === 'completed') { acc.done++; acc.focus += session.plannedSec || 0; }
      if (session.state === 'interrupted') { acc.cut++; acc.interrupted += session.activeSec || 0; }
      return acc;
    }, { done: 0, cut: 0, focus: 0, interrupted: 0 });
    host.appendChild(C.el('div.cw-stat-grid',
      C.stat('Sesi selesai', String(totals.done), ui.fmt.dur(totals.focus) + ' fokus resmi'),
      C.stat('Sesi terputus', String(totals.cut), ui.fmt.dur(totals.interrupted) + ' fokus aktif')));
    var list = panel('Linimasa sesi', 'Urutan terbaru lebih dulu.');
    if (!sessions.length) list.appendChild(C.empty('Belum ada sesi fokus', 'Mulai timer dari Beranda atau Tugas untuk membangun jejak fokusmu.'));
    sessions.slice(0, 100).forEach(function (session) {
      var end = session.completedAt || session.endedAt || session.startedAt;
      var complete = session.state === 'completed';
      list.appendChild(C.el('article.cw-history-row',
        C.el('span.cw-history-mark' + (complete ? '.is-done' : '.is-cut'), complete ? '✓' : '–'),
        C.el('div', C.el('h3', session.taskName || 'Fokus mandiri'), C.el('p', ui.fmt.dateTime(end) + ' · mulai ' + ui.fmt.time(session.startedAt))),
        C.el('div.cw-history-time', C.badge(complete ? 'Selesai' : session.state === 'interrupted' ? 'Terputus' : 'Status: ' + session.state, complete ? 'good' : 'warn'),
          C.el('strong', ui.fmt.dur(complete ? session.plannedSec : session.activeSec)))));
    });
    host.appendChild(list);
  }

  function renderReports(host) {
    heading(host, 'ALBUM HARIAN', 'Kilas balik produktivitas', 'Laporan final tidak berubah; koreksi status yang terjadi kemudian ditampilkan terpisah.');
    var todayStats = JF.app.todayStats();
    var current = panel('Hari ini · masih berjalan', 'Angka akan berubah hingga pergantian hari.');
    current.appendChild(C.el('div.cw-stat-grid',
      C.stat('Target fokus', todayStats.target.min ? ui.fmt.min(todayStats.target.min) : 'Tidak diketahui'),
      C.stat('Fokus tercatat', ui.fmt.dur(todayStats.officialSec)),
      C.stat('Tugas selesai', String(todayStats.doneToday)),
      C.stat('Tugas terlambat', String(todayStats.overdue))));
    host.appendChild(current);
    var snapshots = state().snapshots.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var list = panel('Catatan yang sudah dikunci', snapshots.length + ' hari tersimpan');
    if (!snapshots.length) list.appendChild(C.empty('Belum ada laporan final', 'Laporan pertama dirangkum otomatis setelah hari berganti.'));
    snapshots.slice(0, 80).forEach(function (snapshot) {
      var completedNames = (snapshot.completedTaskIds || []).map(function (id) { return JF.store.find(state(), id); }).filter(Boolean);
      var corrections = JF.snapshots.correctionsFor(state(), snapshot);
      var row = C.el('article.cw-report-card',
        C.el('div.cw-report-top', C.el('h3', ui.fmt.date(snapshot.date)), C.badge(snapshot.complete ? 'Lengkap' : 'Tidak lengkap', snapshot.complete ? 'good' : 'warn')),
        C.el('div.cw-report-metrics',
          C.stat('Fokus', ui.fmt.dur(snapshot.officialFocusSec)),
          C.stat('Tugas selesai', String((snapshot.completedTaskIds || []).length)),
          C.stat('Belum selesai', String((snapshot.unfinishedTaskIds || []).length))));
      if (completedNames.length) row.appendChild(C.el('p.cw-report-note', 'Selesai: ' + completedNames.map(function (task) { return task.title; }).join(', ')));
      if (corrections.length) row.appendChild(C.el('p.cw-report-correction', 'Perubahan setelah laporan: ' + corrections.map(function (item) { return item.title + ' dibuka kembali'; }).join('; ')));
      if (!snapshot.complete) row.appendChild(C.el('p.cw-report-note', 'Sebagian data hari ini tidak lengkap: ' + (snapshot.incompleteReasons || []).join(', ')));
      list.appendChild(row);
    });
    host.appendChild(list);
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

  function renderGoals(host) {
    heading(host, 'POHON CITA-CITA', 'Tujuan besar, langkah kecil', 'Goals menghubungkan milestone, tugas, dan bahan kerja tanpa memindahkan data produktivitas.');
    var actions = C.button('＋ Goal baru', createGoal, 'primary');
    var list = panel('Goals aktif', 'Progres berasal dari milestone atau target terukur.', actions);
    var goals = JF.goals.list(state());
    if (!goals.length) list.appendChild(C.empty('Belum ada goal', 'Pilih satu tujuan jangka panjang lalu pecah menjadi milestone.'));
    goals.forEach(function (goal) {
      if (goal.archived) return;
      var progress = JF.goals.progress(state(), goal);
      var item = C.el('article.cw-goal-card');
      var top = C.el('div.cw-goal-top', C.el('div', C.el('span.cw-eyebrow', goal.category || 'GOAL'), C.el('h3', goal.title)),
        C.badge(JF.goals.STATUS_LABEL[goal.status] || goal.status, goal.status === 'completed' ? 'good' : 'soft'));
      item.appendChild(top);
      if (goal.description) item.appendChild(C.el('p', goal.description));
      item.appendChild(C.progress(progress.pct, 'Progres ' + goal.title));
      item.appendChild(C.el('small.cw-hint', progress.label || (progress.done + ' dari ' + progress.total + ' langkah selesai')));
      var milestoneArea = C.el('div.cw-milestone-list');
      goal.milestones.forEach(function (milestone) {
        var mProgress = JF.goals.milestoneProgress(state(), goal, milestone);
        var row = C.el('div.cw-milestone-row',
          C.el('button.cw-check' + (milestone.done ? '.is-checked' : ''), {
            type: 'button', 'aria-label': (milestone.done ? 'Buka kembali ' : 'Selesaikan ') + milestone.title,
            onclick: function () { (milestone.done ? JF.goals.reopenMilestone : JF.goals.completeMilestone)(state(), goal.id, milestone.id, Date.now()); save(); }
          }, milestone.done ? '✓' : ''),
          C.el('div', C.el('strong', milestone.title), C.el('small.cw-hint', mProgress.done + ' / ' + mProgress.total + ' tugas · ' + (milestone.deadline ? ui.fmt.dateShort(milestone.deadline) : 'tanpa tenggat'))));
        row.appendChild(C.button('Ubah', function () { editMilestone(goal, milestone); }, 'quiet'));
        row.appendChild(C.button('Hubungkan tugas', function () { linkTaskToGoal(goal, milestone); }, 'quiet'));
        row.appendChild(C.button('Naik', function () { JF.goals.moveMilestone(state(), goal.id, milestone.id, -1, Date.now()); save(); }, 'quiet'));
        row.appendChild(C.button('Turun', function () { JF.goals.moveMilestone(state(), goal.id, milestone.id, 1, Date.now()); save(); }, 'quiet'));
        row.appendChild(C.button('Hapus', function () {
          ui.confirm({ title: 'Hapus milestone?', body: 'Tugas tetap tersimpan; hanya relasi milestone ini yang dilepas.', okLabel: 'Hapus', danger: true })
            .then(function (yes) { if (yes) { JF.goals.removeMilestone(state(), goal.id, milestone.id, Date.now()); save(); } });
        }, 'danger'));
        milestoneArea.appendChild(row);
        var refs = JF.goals.taskRefs(state(), goal).filter(function (ref) { return ref.milestoneId === milestone.id; });
        refs.forEach(function (ref) {
          var task = JF.store.find(state(), ref.taskId);
          if (!task) return;
          milestoneArea.appendChild(linkedTaskRow(goal, task, milestone));
        });
      });
      item.appendChild(milestoneArea);
      var foot = C.el('div.cw-goal-actions',
        C.button('＋ Milestone', function () { createMilestone(goal); }, 'quiet'),
        C.button('Hubungkan tugas goal', function () { linkTaskToGoal(goal, null); }, 'quiet'),
        C.button('Ubah goal', function () { editGoal(goal); }, 'quiet'),
        C.button(goal.status === 'completed' ? 'Aktifkan kembali' : 'Tandai selesai', function () {
          (goal.status === 'completed' ? JF.goals.reopenGoal : JF.goals.completeGoal)(state(), goal.id, Date.now()); save();
        }, 'quiet'),
        C.button('Arsipkan', function () {
          ui.confirm({ title: 'Arsipkan goal?', body: goal.title + ' akan disimpan di arsip.', okLabel: 'Arsipkan' })
            .then(function (yes) { if (yes) { JF.goals.archiveGoal(state(), goal.id, Date.now()); save(); } });
        }, 'quiet'));
      item.appendChild(foot);
      var linkedTasks = JF.goals.taskRefs(state(), goal).filter(function (ref) { return !ref.milestoneId; });
      linkedTasks.forEach(function (ref) {
        var task = JF.store.find(state(), ref.taskId);
        if (task) item.appendChild(linkedTaskRow(goal, task, null));
      });
      list.appendChild(item);
    });
    var archived = goals.filter(function (goal) { return goal.archived; });
    if (archived.length) {
      var archiveBox = panel('Goal diarsipkan', 'Goal tetap tersimpan dan dapat dipulihkan.');
      archived.forEach(function (goal) {
        archiveBox.appendChild(C.el('div.cw-linked-task', C.el('span', goal.title),
          C.button('Pulihkan', function () { JF.goals.restoreGoal(state(), goal.id, Date.now()); save(); }, 'quiet')));
      });
      host.appendChild(archiveBox);
    }
    host.appendChild(list);
  }

  function renderJournal(host) {
    heading(host, 'SUDUT MENULIS', 'Beri ruang untuk refleksi', 'Catatan harian memakai tanggal dan relasi goal yang sama dengan experience Original.');
    var entry = JF.journal.entryFor(state(), journalDay) || {};
    var summary = JF.journal.summary(state(), journalDay);
    var box = panel(ui.fmt.date(journalDay), summary ? (summary.completed + ' tugas · ' + ui.fmt.dur(summary.focusSec) + ' fokus') : 'Belum ada ringkasan tersimpan untuk hari ini.');
    var date = C.input('date', journalDay, { onchange: function () { journalDay = this.value || JF.app.today(); renderJournal(host); } });
    box.appendChild(fieldInput('Tanggal catatan', date));
    var fields = [
      ['wins', 'Hal yang berjalan baik', 'Tuliskan kemenangan kecil hari ini.'],
      ['challenges', 'Tantangan', 'Apa yang terasa sulit?'],
      ['learned', 'Hal yang dipelajari', 'Catat satu hal yang ingin kamu ingat.'],
      ['priorities', 'Prioritas berikutnya', 'Langkah kecil apa yang akan kamu ambil?']
    ];
    var editors = {};
    fields.forEach(function (item) {
      editors[item[0]] = C.el('textarea.cw-input', { rows: '3', placeholder: item[2], maxlength: '10000' }, entry[item[0]] || '');
      box.appendChild(fieldInput(item[1], editors[item[0]]));
    });
    var goals = JF.goals.list(state()).filter(function (goal) { return !goal.archived; });
    var existingLink = JF.journal.goalLinkOf(state(), journalDay);
    var link = C.select([{ value: '', label: 'Tanpa goal' }].concat(goals.map(function (goal) { return { value: goal.id, label: goal.title }; })),
      existingLink ? existingLink.goalId : '');
    box.appendChild(fieldInput('Konteks goal (opsional)', link));
    box.appendChild(C.button('Simpan refleksi', function () {
      var patch = {};
      fields.forEach(function (item) { patch[item[0]] = editors[item[0]].value; });
      var result = JF.journal.save(state(), journalDay, patch, Date.now());
      if (!result.ok) { ui.toast('Catatan tidak dapat disimpan: ' + result.reason, { kind: 'err' }); return; }
      if (link.value && result.entry) JF.journal.setGoalLink(state(), journalDay, { goalId: link.value }, Date.now());
      else if (!link.value && result.entry && existingLink) JF.journal.setGoalLink(state(), journalDay, null, Date.now());
      save();
      ui.toast('Refleksi tersimpan.', { kind: 'ok' });
    }, 'primary'));
    host.appendChild(box);
  }

  function renderSettings(host) {
    heading(host, 'PENGATUR RUANG', 'Sesuaikan sesi dan suasana', 'Preferensi experience, timer, dan target disimpan melalui sumber state aplikasi yang sama.');
    var stateNow = state();
    var settings = stateNow.settings;
    var display = panel('Tampilan', 'Pilih pengalaman visual dan mode warna.');
    var experience = C.select([{ value: 'original', label: 'Original' }, { value: 'capybara-world', label: 'Capybara World' }],
      JF.homeExperience.get(), { onchange: function () {
        try { JF.homeExperience.set(this.value); ui.toast('Experience tersimpan.', { kind: 'ok' }); }
        catch (error) { ui.toast('Experience tidak dapat disimpan: ' + error.message, { kind: 'err' }); }
      } });
    display.appendChild(fieldInput('Experience aplikasi', experience));
    display.appendChild(C.button('Ganti mode terang/gelap', function () { JF.theme.toggle(); }, 'quiet'));
    host.appendChild(display);

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
    fields.forEach(function (item) {
      controls[item[0]] = C.input('number', item[2], { min: String(item[3]), max: String(item[4]) });
      formPanel.appendChild(fieldInput(item[1], controls[item[0]]));
    });
    var pomo = C.input('checkbox', '', { checked: !!settings.pomoOn });
    var warn = C.input('checkbox', '', { checked: !!settings.warn8 });
    formPanel.appendChild(fieldInput('Aktifkan istirahat Pomodoro otomatis', pomo));
    formPanel.appendChild(fieldInput('Peringatan sebelum timer selesai', warn));
    formPanel.appendChild(C.button('Simpan pengaturan timer', function () {
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i], value = Number(controls[f[0]].value);
        if (!isFinite(value) || value < f[3] || value > f[4]) {
          ui.toast(f[1] + ' di luar batas yang diizinkan.', { kind: 'err' }); return;
        }
        settings[f[0]] = Math.round(value) * f[5];
      }
      settings.pomoOn = pomo.checked;
      settings.warn8 = warn.checked;
      save();
      ui.toast('Pengaturan timer tersimpan.', { kind: 'ok' });
    }, 'primary'));
    host.appendChild(formPanel);

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
    host.appendChild(targets);

    var music = panel('Musik sesi dan alarm istirahat', 'Playlist memakai penyimpanan media aplikasi yang sudah ada.');
    var musicState = JF.app.music;
    var playlistFiles = C.input('file', '', { accept: 'audio/*', multiple: '', hidden: '' });
    var breakFile = C.input('file', '', { accept: 'audio/*', hidden: '' });
    music.appendChild(C.el('p.cw-hint', musicState.loaded ? musicState.tracks.length + ' lagu di playlist · ' + musicState.breakName : 'Memuat playlist tersimpan…'));
    music.appendChild(C.button('Tambah lagu', function () { playlistFiles.click(); }, 'quiet'));
    music.appendChild(C.button('Pilih alarm akhir istirahat', function () { breakFile.click(); }, 'quiet'));
    music.appendChild(C.button('Tes alarm', function () { musicState.testBreak(); }, 'quiet'));
    music.appendChild(C.button(musicState.loop ? 'Matikan pengulangan playlist' : 'Ulangi playlist di luar istirahat', function () {
      musicState.setLoop(!musicState.loop); renderSettings(host);
    }, 'quiet'));
    playlistFiles.addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (!files.length) return;
      musicState.addTracks(files).then(function (result) {
        if (result.rejected.length) ui.toast('Sebagian lagu tidak dapat ditambahkan: ' + result.rejected.map(function (item) { return item.name; }).join(', '), { kind: 'err' });
        if (result.added.length) { ui.toast(result.added.length + ' lagu ditambahkan.', { kind: 'ok' }); renderSettings(host); }
      });
    });
    breakFile.addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (file) { musicState.pickBreak(file, file.name); renderSettings(host); }
    });
    musicState.tracks.forEach(function (track) {
      music.appendChild(C.el('div.cw-linked-task', C.el('span', track.name + (track.missing ? ' · file hilang' : '')),
        C.button(musicState.status && musicState.status.trackId === track.id ? 'Jeda musik' : 'Putar', function () {
          var isCurrent = musicState.status && musicState.status.trackId === track.id;
          if (isCurrent) musicState.togglePause(); else musicState.play(track.id);
        }, 'quiet'),
        C.button('Hapus dari playlist', function () {
          musicState.removeTrack(track.id).then(function () { renderSettings(host); });
        }, 'quiet')));
    });
    if (musicState.tracks.length) {
      music.appendChild(C.button('Hentikan musik', function () { musicState.stopAllMusic(); }, 'quiet'));
      music.appendChild(C.button('Kosongkan playlist', function () {
        ui.confirm({ title: 'Kosongkan playlist?', body: 'Hanya salinan playlist aplikasi yang dihapus; file asli tidak disentuh.', okLabel: 'Kosongkan', danger: true })
          .then(function (yes) { if (yes) musicState.clearPlaylist().then(function () { renderSettings(host); }); });
      }, 'danger'));
    }
    host.appendChild(music);

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
    host.appendChild(data);
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

  function renderLibrary(host) {
    heading(host, 'RAK PENGETAHUAN', 'Bahan penting di satu tempat', 'Dokumen tetap terhubung ke Goal, Milestone, dan Task melalui Library bersama.');
    var actions = C.el('div.cw-inline-actions');
    actions.appendChild(C.button('Impor berkas', function () {
      JF.documents.importStandalone().then(function (out) {
        if (out.failed.length) ui.toast('Impor gagal: ' + out.failed.map(function (item) { return item.name + ' (' + JF.documents.message(item.reason) + ')'; }).join('; '), { kind: 'err', timeout: 8000 });
        if (out.added.length || out.linked.length) ui.toast('Dokumen tersimpan di Library.', { kind: 'ok' });
      });
    }, 'primary'));
    actions.appendChild(C.button('Tambah tautan', function () { createLibraryItem('link'); }, 'quiet'));
    actions.appendChild(C.button('Tambah catatan', function () { createLibraryItem('note'); }, 'quiet'));
    var box = panel('Koleksi produktivitas', 'Cari file, tautan, atau catatan tersimpan.', actions);
    var search = C.input('search', librarySearch, { placeholder: 'Cari judul, deskripsi, atau URL…', oninput: function () { librarySearch = this.value; renderLibrary(host); } });
    box.appendChild(fieldInput('Pencarian', search));
    var rows = JF.library.query(state(), { search: librarySearch, sort: 'date' }, JF.documents.statusMap());
    if (!rows.length) box.appendChild(C.empty(state().library.length ? 'Tidak ada hasil' : 'Rak masih kosong',
      state().library.length ? 'Coba ubah kata pencarian.' : 'Impor dokumen atau tambahkan catatan dan tautan.'));
    rows.forEach(function (item) {
      var row = C.el('article.cw-library-row' + (selectedLibraryId === item.id ? '.is-selected' : ''),
        C.el('div.cw-library-kind', JF.library.typeGroup(item).toUpperCase()),
        C.el('div.cw-library-info', C.el('h3', item.title), C.el('p', item.description || item.originalName || item.url || JF.library.moduleLabel(item.source.module))),
        C.el('div.cw-inline-actions'));
      var rowActions = row.lastChild;
      rowActions.appendChild(C.button('Detail', function () { selectedLibraryId = selectedLibraryId === item.id ? null : item.id; renderLibrary(host); }, 'quiet'));
      if (item.type === 'file') rowActions.appendChild(C.button('Buka', function () {
        JF.documents.open(item).then(function (result) { if (!result.ok) ui.toast('File tidak dapat dibuka: ' + JF.documents.message(result.reason), { kind: 'err' }); });
      }, 'quiet'));
      rowActions.appendChild(C.button('Hapus', function () {
        ui.confirm({ title: 'Hapus dokumen?', body: '"' + item.title + '" akan dihapus dari Library. Relasi tugas yang sudah selesai tetap disimpan.', okLabel: 'Hapus', danger: true })
          .then(function (yes) { if (yes) JF.documents.removeDocument(item).then(function (result) {
            if (!result.ok) { ui.toast('Dokumen gagal dihapus.', { kind: 'err' }); return; }
            selectedLibraryId = null;
          }); });
      }, 'quiet'));
      if (selectedLibraryId === item.id) {
        var paths = JF.library.contextPaths(state(), item);
        row.appendChild(C.el('p.cw-library-context', paths.length ? 'Konteks: ' + paths.map(function (path) { return path.label; }).join(' · ') : 'Dokumen mandiri'));
        if (item.type === 'note' && item.noteText) row.appendChild(C.el('p.cw-library-context', item.noteText));
      }
      box.appendChild(row);
    });
    host.appendChild(box);
    JF.documents.ensureFresh(function () { if (renderedPage === 'library') renderLibrary(host); });
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
