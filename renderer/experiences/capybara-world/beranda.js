/* Capybara World Beranda presentation. Productivity state remains in JF.app/store. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host, refs = {}, selectedTaskId = null;

  var ROOM_ART = `<svg viewBox="0 0 640 360" role="img" aria-label="Kamar tidur nyaman dengan kapibara menemani sesi fokus" xmlns="http://www.w3.org/2000/svg">
    <rect width="640" height="360" rx="24" fill="#F2DCC2"/>
    <path d="M0 279h640v81H0z" fill="#D6B38F"/>
    <path d="M0 287h640" stroke="#BD9876" stroke-width="4"/>
    <rect x="44" y="44" width="172" height="134" rx="14" fill="#FFF8EC" stroke="#A96D4E" stroke-width="7"/>
    <rect x="56" y="56" width="148" height="110" rx="8" fill="#BDD8D4"/>
    <path d="M130 57v109M57 111h146" stroke="#FFF8EC" stroke-width="7"/>
    <circle cx="174" cy="82" r="13" fill="#F4C879"/>
    <path d="M70 154c16-25 34-23 51 0m20-1c15-30 34-29 53 0" fill="none" stroke="#89AE9A" stroke-width="9" stroke-linecap="round"/>
    <path d="M37 39h188l-17 153H54z" fill="#E8B69A" opacity=".8"/>
    <path d="M264 244h301v42H264z" rx="12" fill="#9A684E"/>
    <path d="M286 190h271q18 0 18 18v48H269v-48q0-18 17-18z" fill="#FFF2DC"/>
    <path d="M294 204h116v44H279v-29q0-15 15-15z" fill="#D8E5D6"/>
    <path d="M410 204h132q15 0 15 15v29H410z" fill="#E8C3A6"/>
    <path d="M273 246h287v18H273z" fill="#CB8C68"/>
    <path d="M279 286v36m266-36v36" stroke="#754C3C" stroke-width="11" stroke-linecap="round"/>
    <rect x="490" y="131" width="92" height="14" rx="7" fill="#825941"/>
    <rect x="500" y="145" width="72" height="70" rx="8" fill="#D49A68"/>
    <path d="M516 161h40m-40 16h40m-40 16h40" stroke="#F3D0A8" stroke-width="5" stroke-linecap="round"/>
    <path d="M450 286h156v11H450z" fill="#9A684E"/>
    <path d="M462 296v31m132-31v31" stroke="#754C3C" stroke-width="8" stroke-linecap="round"/>
    <path d="M493 124c-2-26 13-38 27-44-3 15-2 23 0 31 5-23 22-33 40-35-9 13-12 25-11 38 8-17 22-23 39-23-8 12-10 23-8 34" fill="#719879" stroke="#54785F" stroke-width="4" stroke-linejoin="round"/>
    <path d="M95 282c3-29 27-47 60-47 34 0 55 18 59 47" fill="#D99552"/>
    <ellipse cx="153" cy="255" rx="49" ry="38" fill="#DB9858"/>
    <ellipse cx="127" cy="230" rx="12" ry="16" fill="#B97949"/>
    <ellipse cx="179" cy="230" rx="12" ry="16" fill="#B97949"/>
    <ellipse cx="127" cy="231" rx="6" ry="9" fill="#E9B67F"/>
    <ellipse cx="179" cy="231" rx="6" ry="9" fill="#E9B67F"/>
    <ellipse cx="153" cy="264" rx="30" ry="23" fill="#E8B67E"/>
    <circle cx="140" cy="250" r="3.5" fill="#49352D"/>
    <circle cx="166" cy="250" r="3.5" fill="#49352D"/>
    <ellipse cx="153" cy="261" rx="6" ry="4" fill="#49352D"/>
    <path d="M146 269q7 6 14 0" fill="none" stroke="#70483A" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="128" cy="263" r="6" fill="#E58D78" opacity=".75"/>
    <circle cx="178" cy="263" r="6" fill="#E58D78" opacity=".75"/>
    <path d="M107 285q-23 5-28-10-2-8 7-10 13-2 23 9m89 11q21 5 27-10 2-8-7-10-13-2-23 9" fill="#DB9858"/>
    <path d="M119 290h68" stroke="#A96D4E" stroke-width="5" stroke-linecap="round"/>
    <path d="M74 244q-14-12-11-28 3-17 17-21" fill="none" stroke="#6D9272" stroke-width="6" stroke-linecap="round"/>
    <path d="M60 220q-17-15-28-7 4 17 23 19m29-25q15-18 29-11-2 17-20 24" fill="#8BAE83"/>
    <path d="M43 280h58v7H43z" fill="#A87958"/>
    <path d="M70 280v-32" stroke="#A87958" stroke-width="5"/>
    <path d="M63 249q7-15 14 0" fill="#E6AD62"/>
    <path d="M352 152c0-15 12-27 27-27s27 12 27 27" fill="none" stroke="#9A684E" stroke-width="7"/>
    <path d="M379 152v33" stroke="#9A684E" stroke-width="6"/>
    <path d="M355 184q24-18 48 0l-7 12h-34z" fill="#E9B96F"/>
    <circle cx="378" cy="191" r="5" fill="#FFF1C7"/>
    <path d="M353 282v-17m20 17v-17m20 17v-17" stroke="#A96D4E" stroke-width="4" stroke-linecap="round"/>
    <path d="M596 82l5 11 12 2-9 8 2 12-10-6-10 6 2-12-9-8 12-2z" fill="#FFF3D1"/>
    <circle cx="259" cy="85" r="4" fill="#FFF3D1"/>
    <circle cx="238" cy="120" r="3" fill="#FFF3D1"/>
  </svg>`;

  function greeting() {
    var h = new Date().getHours();
    return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  }

  function mount(container) {
    ui = JF.ui;
    app = JF.app;
    host = container;
    refs = {};

    var rootEl = ui.el('div.capy-home');
    var hero = ui.el('section.cw-hero');
    var intro = ui.el('div.cw-hero-copy',
      ui.el('span.cw-eyebrow', 'RUANG FOKUSMU'),
      ui.el('h2.cw-greeting', greeting() + ', semangat hari ini!'),
      ui.el('p.cw-date', ui.fmt.dateLong(JF.dates.startOfDay(app.today()))),
      ui.el('p.cw-companion', 'Mochi siap menemani satu sesi fokusmu.'));
    hero.appendChild(intro);
    hero.appendChild(ui.el('div.cw-room-art', { html: ROOM_ART }));
    rootEl.appendChild(hero);

    var overview = ui.el('section.cw-overview', { 'aria-label': 'Timer fokus dan progres harian' });
    refs.focus = ui.el('article.cw-card.cw-focus-card');
    refs.progress = ui.el('article.cw-card.cw-progress-card');
    overview.appendChild(refs.focus);
    overview.appendChild(refs.progress);
    rootEl.appendChild(overview);

    var tasks = ui.el('section.cw-card.cw-tasks');
    var taskHead = ui.el('div.cw-section-head',
      ui.el('div', ui.el('span.cw-eyebrow', 'LANGKAH KECIL, HASIL BERARTI'), ui.el('h2', 'Tugas hari ini')),
      ui.btn('Semua tugas', function () { location.hash = '#tugas'; }, { ghost: true, sm: true }));
    tasks.appendChild(taskHead);
    refs.overdue = ui.el('div.cw-overdue');
    refs.taskList = ui.el('div.cw-task-list', { 'aria-label': 'Daftar tugas berdasarkan tenggat' });
    tasks.appendChild(refs.overdue);
    tasks.appendChild(refs.taskList);
    rootEl.appendChild(tasks);

    var shortcuts = ui.el('nav.cw-shortcuts', { 'aria-label': 'Akses cepat' });
    shortcuts.appendChild(ui.el('span.cw-shortcuts-label', 'Lanjutkan ke'));
    shortcuts.appendChild(quickLink('Kalender', '#kalender'));
    shortcuts.appendChild(quickLink('Goals', '#goals'));
    shortcuts.appendChild(quickLink('Journaling', '#jurnal'));
    rootEl.appendChild(shortcuts);

    ui.clear(container);
    container.appendChild(rootEl);
    render();
  }

  function quickLink(label, route) {
    return ui.el('a.cw-quick-link', { href: route }, label);
  }

  function stateText(session, breakState) {
    if (breakState) return 'Waktu istirahat';
    if (session && session.state === 'running') return 'Sedang fokus';
    if (session && session.state === 'paused') return 'Sesi dijeda';
    return 'Siap untuk fokus';
  }

  function remaining(session, breakState) {
    if (breakState) return Math.max(0, Math.ceil((breakState.endAt - Date.now()) / 1000));
    if (session && (session.state === 'running' || session.state === 'paused')) {
      return JF.sessions.remainingSeconds(session, Date.now());
    }
    return null;
  }

  function stopSession() {
    ui.confirm({
      title: 'Hentikan sesi ini?',
      body: 'Sesi berhenti total dan tidak bisa dilanjutkan. Waktu fokus yang sudah berjalan tetap tersimpan sebagai sesi terputus, tetapi tidak dihitung ke total fokus.',
      okLabel: 'Ya, hentikan',
      danger: true
    }).then(function (ok) { if (ok) app.stopPermanent(); });
    return false;
  }

  function renderFocus() {
    var session = app.currentSession();
    var breakState = app.breakInfo();
    var card = ui.clear(refs.focus);
    var cssState = breakState ? 'break' : session && session.state === 'running' ? 'running' : session && session.state === 'paused' ? 'paused' : 'idle';

    card.appendChild(ui.el('div.cw-card-heading',
      ui.el('div', ui.el('span.cw-eyebrow', 'FOCUS TIMER'), ui.el('h2', stateText(session, breakState))),
      ui.el('span.cw-status-dot.' + cssState, { 'aria-hidden': 'true' })));

    if (breakState) {
      card.appendChild(ui.el('p.cw-current-task', 'Istirahat' + (breakState.isLong ? ' panjang' : ' singkat')));
      card.appendChild(ui.el('div.cw-timer-value', { id: 'cw-timer-value', 'aria-label': 'Sisa waktu istirahat' }, ui.fmt.mmss(remaining(session, breakState))));
      card.appendChild(ui.el('p.cw-timer-note', breakState.nextTaskId ? 'Berikutnya: ' + ((app.findTask(breakState.nextTaskId) || {}).title || 'tugas fokus') : 'Ambil jeda sejenak sebelum kembali.'));
      card.appendChild(ui.btn('Lewati istirahat', function () { app.skipBreak(); }, { primary: true, block: true }));
      return;
    }

    if (session && (session.state === 'running' || session.state === 'paused')) {
      card.appendChild(ui.el('p.cw-current-task', session.taskName || 'Fokus tanpa tugas'));
      card.appendChild(ui.el('div.cw-timer-value' + (session.state === 'running' ? '.active' : ''), {
        id: 'cw-timer-value', 'aria-label': 'Sisa waktu sesi fokus'
      }, ui.fmt.mmss(remaining(session, null))));
      card.appendChild(ui.el('p.cw-timer-note',
        (session.state === 'running' ? 'Dimulai ' : 'Dijeda · ') + ui.fmt.time(session.startedAt) + ' · target ' + ui.fmt.dur(session.plannedSec)));
      var controls = ui.el('div.cw-focus-actions');
      controls.appendChild(ui.btn(session.state === 'running' ? 'Jeda fokus' : 'Lanjutkan fokus',
        function () { session.state === 'running' ? app.pause() : app.resume(); }, { primary: true }));
      controls.appendChild(ui.btn('Hentikan', stopSession, { ghost: true }));
      card.appendChild(controls);
      return;
    }

    var state = app.rawState();
    var available = JF.store.activeTasks(state, app.today()).concat(JF.store.upcomingTasks(state, app.today()));
    available.sort(function (a, b) {
      var priority = { high: 0, normal: 1, low: 2 };
      return priority[a.priority] - priority[b.priority] ||
        (a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : a.title.localeCompare(b.title, 'id'));
    });
    if (selectedTaskId == null && available.some(function (t) { return t.id === app.selectedTaskId; })) selectedTaskId = app.selectedTaskId;
    if (!available.some(function (t) { return t.id === selectedTaskId; })) selectedTaskId = available.length ? available[0].id : null;

    var picker = ui.el('label.cw-picker', 'Pilih tugas untuk sesi ini');
    var select = ui.el('select', {
      'aria-label': 'Pilih tugas untuk sesi fokus',
      onchange: function () { selectedTaskId = this.value || null; app.selectedTaskId = selectedTaskId; renderFocus(); }
    });
    select.appendChild(ui.el('option', { value: '' }, 'Fokus umum tanpa tugas'));
    available.forEach(function (task) {
      var option = ui.el('option', { value: task.id },
        task.title + (task.targetDate !== app.today() ? ' · ' + ui.fmt.dateShort(task.targetDate) : ''));
      if (task.id === selectedTaskId) option.selected = true;
      select.appendChild(option);
    });
    picker.appendChild(select);
    card.appendChild(picker);

    var selectedTask = selectedTaskId ? app.findTask(selectedTaskId) : null;
    var planned = selectedTask ? selectedTask.left : state.settings.defaultFocusSec;
    if (!(planned > 0)) planned = selectedTask && selectedTask.durationSec > 0 ? selectedTask.durationSec : state.settings.defaultFocusSec;
    if (!(planned > 0)) planned = 1500;
    card.appendChild(ui.el('div.cw-timer-value', { id: 'cw-timer-value' }, ui.fmt.mmss(planned)));
    card.appendChild(ui.el('p.cw-timer-note', selectedTask
      ? 'Target tugas ' + ui.fmt.dur(selectedTask.durationSec) + (selectedTask.left < selectedTask.durationSec ? ' · sisa ' + ui.fmt.mmss(selectedTask.left) : '')
      : 'Sesi fokus mandiri · ' + ui.fmt.dur(state.settings.defaultFocusSec)));
    card.appendChild(ui.btn(selectedTask ? 'Mulai fokus' : 'Mulai fokus mandiri', function () {
      app.startTask(selectedTaskId, { standalone: !selectedTaskId });
    }, { primary: true, block: true }));
  }

  function renderProgress() {
    var state = app.rawState();
    var stats = app.todayStats();
    var todayTasks = state.tasks.filter(function (task) { return !task.archived && task.targetDate === app.today(); });
    var completed = todayTasks.filter(function (task) { return task.done; }).length;
    var taskPercent = todayTasks.length ? Math.round(completed / todayTasks.length * 100) : 0;
    var focusTargetSec = stats.target.min * 60;
    var focusPercent = focusTargetSec ? Math.min(100, Math.round(stats.officialSec / focusTargetSec * 100)) : 0;
    var card = ui.clear(refs.progress);
    card.appendChild(ui.el('div.cw-card-heading',
      ui.el('div', ui.el('span.cw-eyebrow', 'PROGRES HARI INI'), ui.el('h2', 'Setiap langkah berarti')),
      ui.el('span.cw-progress-leaf', { 'aria-hidden': 'true' }, '✦')));

    var taskProgress = ui.el('div.cw-progress-block');
    taskProgress.appendChild(ui.el('div.cw-progress-label',
      ui.el('span', 'Tugas selesai'),
      ui.el('strong', todayTasks.length ? completed + ' dari ' + todayTasks.length : 'Belum ada target')));
    taskProgress.appendChild(progressBar(taskPercent, 'Progres penyelesaian tugas'));
    card.appendChild(taskProgress);

    var focusProgress = ui.el('div.cw-progress-block');
    focusProgress.appendChild(ui.el('div.cw-progress-label',
      ui.el('span', 'Waktu fokus tercatat'),
      ui.el('strong', ui.fmt.dur(stats.officialSec))));
    focusProgress.appendChild(progressBar(focusPercent, 'Progres waktu fokus menuju target harian'));
    focusProgress.appendChild(ui.el('p.cw-progress-note', focusTargetSec
      ? focusPercent + '% dari target ' + ui.fmt.min(stats.target.min)
      : 'Target fokus harian belum diatur.'));
    card.appendChild(focusProgress);

    card.appendChild(ui.el('div.cw-today-foot',
      ui.el('span', 'Rentetan'),
      ui.el('strong', stats.streak + ' hari'),
      ui.el('span.cw-today-focus', 'Hari ini: ' + ui.fmt.dateShort(app.today()))));
  }

  function progressBar(percent, label) {
    var track = ui.el('div.cw-progress-track', { role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(percent) });
    track.appendChild(ui.el('span', { style: { width: percent + '%' } }));
    return track;
  }

  function priorityLabel(task) {
    return JF.model.PRIORITY_LABEL[task.priority] || JF.model.PRIORITY_LABEL.normal;
  }

  function makeTaskRow(task, overdue) {
    var row = ui.el('article.cw-task-row' + (task.done ? '.completed' : '') + (overdue ? '.overdue' : ''));
    var check = ui.el('button.cw-task-check' + (task.done ? '.checked' : ''), {
      type: 'button',
      'aria-pressed': String(!!task.done),
      'aria-label': task.done ? 'Tandai belum selesai: ' + task.title : 'Tandai selesai: ' + task.title,
      title: task.done ? 'Kembalikan ke tugas aktif' : 'Tandai selesai',
      onclick: function () { task.done ? app.reopenTask(task.id) : app.completeTask(task.id); }
    }, task.done ? '✓' : '');
    row.appendChild(check);

    var detail = ui.el('div.cw-task-detail',
      ui.el('div.cw-task-title', task.title),
      ui.el('div.cw-task-meta',
        ui.el('span.cw-priority.' + task.priority, 'Prioritas ' + priorityLabel(task)),
        ui.el('span.cw-task-deadline' + (overdue ? '.late' : ''), overdue
          ? 'Terlambat · ' + ui.fmt.dateShort(task.targetDate)
          : 'Tenggat hari ini')));
    row.appendChild(detail);

    if (!task.done) {
      var session = app.currentSession();
      var anotherSession = session && (session.state === 'running' || session.state === 'paused') && session.taskId !== task.id;
      row.appendChild(ui.btn('Fokus', function () { app.startTask(task.id); }, {
        sm: true, ghost: true, disabled: !!anotherSession,
        title: anotherSession ? 'Selesaikan sesi yang sedang berjalan terlebih dahulu' : 'Mulai fokus pada tugas ini'
      }));
    }
    return row;
  }

  function renderTasks() {
    var state = app.rawState();
    var day = app.today();
    var overdueTasks = JF.store.overdueTasks(state, day).filter(function (task) { return !task.archived; });
    var todayTasks = state.tasks.filter(function (task) { return !task.archived && task.targetDate === day; });
    var order = { high: 0, normal: 1, low: 2 };
    function sortTasks(a, b) {
      return order[a.priority] - order[b.priority] || a.title.localeCompare(b.title, 'id');
    }
    overdueTasks.sort(sortTasks);
    todayTasks.sort(sortTasks);

    ui.clear(refs.overdue);
    ui.clear(refs.taskList);
    if (overdueTasks.length) {
      refs.overdue.appendChild(ui.el('div.cw-subheading',
        ui.el('span', 'Perlu perhatian'),
        ui.el('span.cw-overdue-count', overdueTasks.length + ' terlambat')));
      overdueTasks.slice(0, 3).forEach(function (task) { refs.overdue.appendChild(makeTaskRow(task, true)); });
      if (overdueTasks.length > 3) refs.overdue.appendChild(ui.el('p.cw-more-tasks', '+' + (overdueTasks.length - 3) + ' tugas terlambat lainnya'));
    }
    if (todayTasks.length) {
      todayTasks.slice(0, 6).forEach(function (task) { refs.taskList.appendChild(makeTaskRow(task, false)); });
      if (todayTasks.length > 6) refs.taskList.appendChild(ui.el('p.cw-more-tasks', '+' + (todayTasks.length - 6) + ' tugas lainnya'));
    }
    if (!todayTasks.length && !overdueTasks.length) {
      refs.taskList.appendChild(ui.el('div.cw-empty',
        ui.el('span.cw-empty-icon', '☁'),
        ui.el('div', ui.el('strong', 'Belum ada tugas untuk hari ini'), ui.el('p', 'Tambahkan satu langkah kecil, lalu Mochi akan menemanimu fokus.')),
        ui.btn('Tambah tugas', function () { location.hash = '#tugas'; }, { primary: true, sm: true })));
    }
  }

  function render() {
    if (!host) return;
    renderFocus();
    renderProgress();
    renderTasks();
  }

  function frame() {
    if (!host || host.hidden) return;
    var label = document.getElementById('cw-timer-value');
    if (!label) return;
    var current = app.currentSession();
    var breakState = app.breakInfo();
    var seconds = remaining(current, breakState);
    if (seconds != null) label.textContent = ui.fmt.mmss(seconds);
  }

  JF.capybaraHome = {
    mount: mount,
    render: render,
    frame: frame
  };
})(typeof self !== 'undefined' ? self : this);
