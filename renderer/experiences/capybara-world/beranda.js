/* Capybara World Beranda presentation. Productivity state remains in JF.app/store. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host, refs = {}, selectedTaskId = null;
  var pickFilter = null, pickDate = '', pickNone = false;   // filter tanggal daftar tugas sesi

  var pokeCount = 0;

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
    var cr = JF.capyrafi;
    var info = cr.compute(app.rawState());
    var ctx = heroContext(info);
    var mood = cr.moodOf(ctx);
    var hour = new Date().getHours();
    var hero = ui.el('section.cw-hero');
    refs.companion = ui.el('p.cw-companion', { 'aria-live': 'polite' }, cr.say(mood, ctx, pokeCount));
    var intro = ui.el('div.cw-hero-copy',
      ui.el('span.cw-eyebrow', 'RUMAH CAPYRAFI · LV.' + info.level + ' ' + info.name.toUpperCase()),
      ui.el('h2.cw-greeting', greeting() + ', semangat hari ini!'),
      ui.el('p.cw-date', ui.fmt.dateLong(JF.dates.startOfDay(app.today()))),
      refs.companion);
    hero.appendChild(intro);
    var art = ui.el('div.cw-room-art.cr-stage', {
      role: 'button', tabindex: '0', title: 'Colek CapyRafi',
      'aria-label': 'Colek CapyRafi untuk mendengar celotehnya',
      html: cr.room({ stage: info.stage, mood: mood, night: hour >= 18 || hour < 5 })
    });
    refs.art = art;
    art.addEventListener('click', poke);
    art.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); poke(); } });
    hero.appendChild(art);
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

    rootEl.appendChild(journeyCard(info));

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


  function heroContext(info) {
    var state = app.rawState(), day = app.today();
    var session = app.currentSession();
    var today = state.tasks.filter(function (t) { return !t.archived && t.targetDate === day; });
    return {
      dayKey: day, info: info,
      running: !!(session && session.state === 'running'),
      paused: !!(session && session.state === 'paused'),
      onBreak: !!app.breakInfo(),
      overdue: app.todayStats().overdue || 0,
      todayTotal: today.length,
      todayDone: today.filter(function (t) { return t.done; }).length
    };
  }

  function poke() {
    if (!refs.art || !refs.companion) return;
    pokeCount += 1;
    var cr = JF.capyrafi;
    var info = cr.compute(app.rawState());
    var ctx = heroContext(info);
    refs.companion.textContent = cr.say(cr.moodOf(ctx), ctx, pokeCount);
    var svg = refs.art.querySelector('svg.cr-main');
    if (svg) {
      svg.classList.remove('is-poked');
      void svg.getBoundingClientRect();
      svg.classList.add('is-poked');
    }
  }

  function journeyCard(info) {
    var cr = JF.capyrafi;
    var card = ui.el('section.cw-card.cw-journey');
    card.appendChild(ui.el('div.cw-section-head',
      ui.el('div', ui.el('span.cw-eyebrow', 'CAPYRAFI TUMBUH DARI KERJA KERASMU'), ui.el('h2', 'Perjalanan CapyRafi'))));
    var track = ui.el('div.cw-journey-track', { role: 'list' });
    cr.STAGES.forEach(function (stage, i) {
      var step = ui.el('div.cw-journey-step' + (i === info.stage ? '.is-current' : '') + (i > info.stage ? '.is-locked' : ''),
        { role: 'listitem', title: stage.hint, html: cr.svg({ stage: i, mood: 'happy', cls: 'cr-mini' }) });
      step.appendChild(ui.el('b', stage.name));
      step.appendChild(ui.el('small', i === 0 ? 'mulai' : stage.at + ' XP'));
      track.appendChild(step);
    });
    card.appendChild(track);
    card.appendChild(progressBar(info.pct, 'Progres XP menuju tahap berikutnya'));
    card.appendChild(ui.el('div.cw-journey-meta',
      ui.el('span', ui.el('strong', info.xp + ' XP'), info.max ? ' · tahap tertinggi, hormat!' : ' · ' + info.toNext + ' XP lagi menuju ' + info.next.name),
      ui.el('span', info.doneTasks + ' tugas × ' + cr.XP.task),
      ui.el('span', info.milestones + ' milestone × ' + cr.XP.milestone),
      ui.el('span', info.goalsDone + ' goal × ' + cr.XP.goal)));
    card.appendChild(ui.el('p.cw-journey-hint', 'XP dihitung ulang dari data tugas dan goals. Membuka kembali tugas akan mengurangi XP, jadi Original dan Capybara selalu sama.'));
    return card;
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
    var todayKey = app.today(), tomorrowKey = JF.dates.addDays(todayKey, 1);
    var PF = {
      all: function () { return true; },
      late: function (t) { return t.targetDate < todayKey; },
      today: function (t) { return t.targetDate === todayKey; },
      tomorrow: function (t) { return t.targetDate === tomorrowKey; },
      date: function (t) { return !pickDate || t.targetDate === pickDate; }
    };
    function countOf(f) { return available.filter(PF[f]).length; }
    var eff = pickFilter || (countOf('today') ? 'today' : 'all');
    var priority = { high: 0, normal: 1, low: 2 };
    var list = available.filter(PF[eff]).sort(function (a, b) {
      return a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 :
        (priority[a.priority] - priority[b.priority]) || a.title.localeCompare(b.title, 'id');
    });
    if (selectedTaskId != null && !list.some(function (t) { return t.id === selectedTaskId; })) selectedTaskId = null;
    if (!pickNone) {
      if (selectedTaskId == null && list.some(function (t) { return t.id === app.selectedTaskId; })) selectedTaskId = app.selectedTaskId;
      if (selectedTaskId == null && list.length) selectedTaskId = list[0].id;
    }

    // Filter tanggal: sebaris dengan judul "Pilih tugas untuk sesi ini" (kanan)
    var picker = ui.el('div.cw-picker');
    var phead = ui.el('div.cw-pick-head', ui.el('span.cw-pick-label', 'Pilih tugas untuk sesi ini'));
    var pfil = ui.el('div.cw-pick-filters');
    var fsel = ui.el('select.cw-fsel', { 'aria-label': 'Filter tanggal tugas' });
    [['today', 'Hari ini'], ['tomorrow', 'Besok'], ['late', 'Terlambat'], ['all', 'Semua']].forEach(function (o) {
      var op = ui.el('option', { value: o[0] }, o[1] + ' (' + countOf(o[0]) + ')');
      if (eff === o[0]) op.selected = true;
      fsel.appendChild(op);
    });
    var odt = ui.el('option', { value: 'date' }, 'Pilih tanggal…');
    if (eff === 'date') odt.selected = true;
    fsel.appendChild(odt);
    fsel.addEventListener('change', function () {
      pickFilter = fsel.value; if (pickFilter !== 'date') pickDate = '';
      pickNone = false; renderFocus();
    });
    pfil.appendChild(fsel);
    if (eff === 'date') {
      var pdate = ui.el('input.cw-fdate', { type: 'date', 'aria-label': 'Pilih tanggal tertentu', value: pickDate });
      pdate.addEventListener('change', function () { pickDate = JF.dates.isDayKey(pdate.value) ? pdate.value : ''; pickNone = false; renderFocus(); });
      pfil.appendChild(pdate);
    }
    phead.appendChild(pfil);
    picker.appendChild(phead);
    // Label opsi dipotong di tengah agar kartu tidak melebar: judul dipendekkan, tanggal tetap terlihat.
    function fitLabel(title, dateText, max) {
      var tail = dateText ? ' · ' + dateText : '';
      var room = max - tail.length;
      if (title.length <= room) return title + tail;
      return title.slice(0, Math.max(8, room - 1)).replace(/\s+$/, '') + '…' + tail;
    }
    var select = ui.el('select', {
      'aria-label': 'Pilih tugas untuk sesi fokus',
      onchange: function () { selectedTaskId = this.value || null; pickNone = !this.value; app.selectedTaskId = selectedTaskId; renderFocus(); }
    });
    select.appendChild(ui.el('option', { value: '' }, list.length ? 'Fokus umum tanpa tugas' : 'Tidak ada tugas di filter ini · fokus umum'));
    function addOpt(parent, task) {
      var option = ui.el('option', { value: task.id, title: task.title },
        fitLabel(task.title, task.targetDate !== todayKey ? ui.fmt.dateShort(task.targetDate) : '', 36));
      if (task.id === selectedTaskId) option.selected = true;
      parent.appendChild(option);
    }
    if (eff === 'all') {
      [['Terlambat', PF.late],
       ['Hari ini', PF.today],
       ['Besok', PF.tomorrow],
       ['Mendatang', function (t) { return t.targetDate > tomorrowKey; }]].forEach(function (g) {
        var items = list.filter(g[1]);
        if (!items.length) return;
        var og = ui.el('optgroup', { label: g[0] + ' (' + items.length + ')' });
        items.forEach(function (t) { addOpt(og, t); });
        select.appendChild(og);
      });
    } else {
      list.forEach(function (t) { addOpt(select, t); });
    }
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
      var sid = selectedTaskId; pickNone = false;
      app.startTask(sid, { standalone: !sid });
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
      if (JF.completion) row.appendChild(ui.btn('Selesai + ringkasan', function () { JF.completion.start(task.id); }, {
        sm: true, ghost: true, title: 'Tandai selesai dengan ringkasan dan lampiran'
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
        ui.el('div', ui.el('strong', 'Belum ada tugas untuk hari ini'), ui.el('p', 'Tambahkan satu langkah kecil, lalu CapyRafi akan menemanimu fokus.')),
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
    frame: frame,
    poke: poke,
    context: heroContext
  };
})(typeof self !== 'undefined' ? self : this);
