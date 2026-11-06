/* Mola World: Beranda. Semua logika (sesi, tugas, statistik) dipanggil dari JF.app / JF.store / JF.sessions. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host, refs = {}, pokeCount = 0;
  var selectedTaskId = null, pickFilter = null, pickNone = false;

  function greeting() {
    var h = new Date().getHours();
    return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Halo';
  }

  function ctxNow() {
    var st = app.rawState(), day = app.today(), s = app.currentSession();
    var today = JF.store.tasksTargeting(st, day);
    return {
      running: !!(s && s.state === 'running'), paused: !!(s && s.state === 'paused'), onBreak: !!app.breakInfo(),
      overdue: app.todayStats().overdue || 0, todayTotal: today.length,
      todayDone: today.filter(function (t) { return t.done; }).length
    };
  }

  function bar(pct, label) {
    var t = ui.el('div.mw-bar', { role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) });
    t.appendChild(ui.el('span', { style: { width: pct + '%' } }));
    return t;
  }

  function clockText(s, brk) {
    if (brk) return ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000)));
    if (!s || (s.state !== 'running' && s.state !== 'paused')) return null;
    return JF.sessions.isOpen(s) ? '+' + ui.fmt.mmss(JF.sessions.activeSeconds(s, Date.now()))
      : ui.fmt.mmss(JF.sessions.remainingSeconds(s, Date.now()));
  }

  function stopSession() {
    var cs = app.currentSession();
    ui.confirm({
      title: 'Hentikan sesi ini?',
      body: 'Sesi berhenti total dan tidak bisa dilanjutkan. Waktu yang sudah berjalan tersimpan sebagai sesi terputus, tetapi tidak dihitung ke total fokus.' +
        (cs && JF.sessions.isOpen(cs) ? ' Untuk memasukkan waktu ini ke total, pilih "Selesai sesi" saja.' : ''),
      okLabel: 'Ya, hentikan', danger: true
    }).then(function (ok) { if (ok) app.stopPermanent(); });
    return false;
  }

  function hero(info) {
    var M = JF.mola, ctx = ctxNow(), mood = JF.capyrafi.moodOf(ctx);
    var card = ui.el('section.mw-card.mw-hero');
    refs.say = ui.el('p.mw-say', { 'aria-live': 'polite' }, M.say(mood, ctx, pokeCount));
    card.appendChild(ui.el('div.mw-hero-copy',
      ui.el('span.mw-eyebrow', 'LAUTAN MOLA · LV.' + info.level + ' ' + info.name.toUpperCase()),
      ui.el('h2', greeting() + ', ayo berenang bareng!'),
      ui.el('p.mw-date', ui.fmt.dateLong(JF.dates.startOfDay(app.today()))),
      refs.say));
    var art = ui.el('div.mw-hero-art', { role: 'button', tabindex: '0', title: 'Colek Mola', 'aria-label': 'Colek Mola untuk mendengar celotehnya', html: M.scene({ stage: info.stage, mood: mood }) });
    function poke() {
      pokeCount += 1;
      var c = ctxNow();
      refs.say.textContent = M.say(JF.capyrafi.moodOf(c), c, pokeCount);
      var g = art.querySelector('.mw-hero-mola');
      art.classList.remove('is-poked'); void art.offsetWidth; art.classList.add('is-poked');
    }
    art.addEventListener('click', poke);
    art.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } });
    card.appendChild(art);
    return card;
  }

  function focusCard() {
    var s = app.currentSession(), brk = app.breakInfo();
    var card = ui.el('section.mw-card.mw-focus');
    var state = brk ? 'break' : s && s.state === 'running' ? 'running' : s && s.state === 'paused' ? 'paused' : 'idle';
    var open = !!(s && JF.sessions.isOpen(s));
    var title = brk ? 'Waktu istirahat' : state === 'running' ? (open ? 'Waktu bebas' : 'Sedang fokus')
      : state === 'paused' ? (open ? 'Waktu bebas dijeda' : 'Sesi dijeda') : 'Siap untuk fokus';
    card.appendChild(ui.el('div.mw-card-head', ui.el('div', ui.el('span.mw-eyebrow', 'TIMER FOKUS'), ui.el('h2', title)), ui.el('span.mw-dot.' + state, { 'aria-hidden': 'true' })));

    if (brk) {
      card.appendChild(ui.el('p.mw-task-now', 'Istirahat' + (brk.isLong ? ' panjang' : ' singkat')));
      card.appendChild(ui.el('div.mw-clock', { id: 'mw-clock', 'aria-label': 'Sisa waktu istirahat' }, clockText(null, brk)));
      card.appendChild(ui.btn('Lewati istirahat', function () { app.skipBreak(); }, { primary: true, block: true }));
      return card;
    }
    if (s && (s.state === 'running' || s.state === 'paused')) {
      card.appendChild(ui.el('p.mw-task-now', s.taskName || 'Fokus tanpa tugas'));
      card.appendChild(ui.el('div.mw-clock' + (s.state === 'running' ? '.active' : ''), { id: 'mw-clock', 'aria-label': open ? 'Waktu fokus berjalan' : 'Sisa waktu sesi fokus' }, clockText(s, null)));
      card.appendChild(ui.el('p.mw-note', (s.state === 'running' ? 'Dimulai ' : 'Dijeda · ') + ui.fmt.time(s.startedAt) +
        (open ? ' · tanpa batas waktu. Masuk total fokus saat kamu pilih Selesai sesi.' : ' · target ' + ui.fmt.dur(s.plannedSec))));
      var row = ui.el('div.mw-actions');
      row.appendChild(ui.btn(s.state === 'running' ? 'Jeda fokus' : 'Lanjutkan fokus', function () { s.state === 'running' ? app.pause() : app.resume(); }, { primary: true }));
      if (open) row.appendChild(ui.btn('Selesai sesi', function () { app.finishOpen(); }, {}));
      row.appendChild(ui.btn('Hentikan', stopSession, { ghost: true }));
      card.appendChild(row);
      return card;
    }

    var st = app.rawState(), todayKey = app.today(), tomorrowKey = JF.dates.addDays(todayKey, 1);
    var avail = JF.store.activeTasks(st, todayKey).concat(JF.store.upcomingTasks(st, todayKey));
    var F = {
      all: function () { return true; },
      late: function (t) { return JF.model.isOverdue(t, todayKey); },
      today: function (t) { return t.targetDate === todayKey; },
      tomorrow: function (t) { return t.targetDate === tomorrowKey; }
    };
    function count(f) { return avail.filter(F[f]).length; }
    var eff = pickFilter || (count('today') ? 'today' : 'all');
    var pr = { high: 0, normal: 1, low: 2 };
    var list = avail.filter(F[eff]).sort(function (a, b) {
      return a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : (pr[a.priority] - pr[b.priority]) || a.title.localeCompare(b.title, 'id');
    });
    if (selectedTaskId != null && !list.some(function (t) { return t.id === selectedTaskId; })) selectedTaskId = null;
    if (!pickNone) {
      if (selectedTaskId == null && list.some(function (t) { return t.id === app.selectedTaskId; })) selectedTaskId = app.selectedTaskId;
      if (selectedTaskId == null && list.length) selectedTaskId = list[0].id;
    }
    var fsel = ui.el('select.mw-select', { 'aria-label': 'Filter tanggal tugas' });
    [['today', 'Hari ini'], ['tomorrow', 'Besok'], ['late', 'Terlambat'], ['all', 'Semua']].forEach(function (o) {
      var op = ui.el('option', { value: o[0] }, o[1] + ' (' + count(o[0]) + ')');
      if (eff === o[0]) op.selected = true;
      fsel.appendChild(op);
    });
    fsel.addEventListener('change', function () { pickFilter = fsel.value; pickNone = false; render(host); });
    var sel = ui.el('select.mw-select', {
      'aria-label': 'Pilih tugas untuk sesi fokus',
      onchange: function () { selectedTaskId = this.value || null; pickNone = !this.value; app.selectedTaskId = selectedTaskId; render(host); }
    });
    sel.appendChild(ui.el('option', { value: '' }, list.length ? 'Fokus umum tanpa tugas' : 'Tidak ada tugas di filter ini · fokus umum'));
    list.forEach(function (t) {
      var o = ui.el('option', { value: t.id, title: t.title }, t.title.length > 38 ? t.title.slice(0, 37) + '…' : t.title);
      if (t.id === selectedTaskId) o.selected = true;
      sel.appendChild(o);
    });
    card.appendChild(ui.el('div.mw-picker', ui.el('span.mw-pick-label', 'Pilih tugas untuk sesi ini'), fsel, sel));

    var task = selectedTaskId ? app.findTask(selectedTaskId) : null;
    var planned = task ? task.left : st.settings.defaultFocusSec;
    if (!(planned > 0)) planned = task && task.durationSec > 0 ? task.durationSec : st.settings.defaultFocusSec;
    if (!(planned > 0)) planned = 1500;
    card.appendChild(ui.el('div.mw-clock', { id: 'mw-clock' }, ui.fmt.mmss(planned)));
    card.appendChild(ui.el('p.mw-note', task
      ? 'Target tugas ' + ui.fmt.dur(task.durationSec) + (task.left < task.durationSec ? ' · sisa ' + ui.fmt.mmss(task.left) : '')
      : 'Sesi fokus mandiri · ' + ui.fmt.dur(st.settings.defaultFocusSec)));
    card.appendChild(ui.btn(task ? 'Mulai fokus' : 'Mulai fokus mandiri', function () {
      var id = selectedTaskId; pickNone = false; app.startTask(id, { standalone: !id });
    }, { primary: true, block: true }));
    return card;
  }

  function progressCard() {
    var st = app.rawState(), stats = app.todayStats();
    var tasks = JF.store.tasksTargeting(st, app.today());
    var done = tasks.filter(function (t) { return t.done; }).length;
    var tPct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    var target = stats.target.min * 60;
    var fPct = target ? Math.min(100, Math.round(stats.officialSec / target * 100)) : 0;
    var card = ui.el('section.mw-card.mw-progress');
    card.appendChild(ui.el('div.mw-card-head', ui.el('div', ui.el('span.mw-eyebrow', 'PROGRES HARI INI'), ui.el('h2', 'Gelombang demi gelombang')), ui.el('span.mw-shell-ico', { 'aria-hidden': 'true' }, '🐚')));
    card.appendChild(ui.el('div.mw-block', ui.el('div.mw-label', ui.el('span', 'Tugas selesai'), ui.el('strong', tasks.length ? done + ' dari ' + tasks.length : 'Belum ada target')), bar(tPct, 'Progres penyelesaian tugas')));
    card.appendChild(ui.el('div.mw-block', ui.el('div.mw-label', ui.el('span', 'Waktu fokus tercatat'), ui.el('strong', ui.fmt.dur(stats.officialSec))), bar(fPct, 'Progres waktu fokus menuju target harian'),
      ui.el('p.mw-note', target ? fPct + '% dari target ' + ui.fmt.min(stats.target.min) : 'Target fokus harian belum diatur.')));
    card.appendChild(ui.el('div.mw-foot', ui.el('span', 'Rentetan'), ui.el('strong', stats.streak + ' hari')));
    return card;
  }

  function taskRow(task, overdue) {
    var row = ui.el('article.mw-task' + (task.done ? '.done' : '') + (overdue ? '.late' : ''));
    row.appendChild(ui.el('button.mw-check' + (task.done ? '.on' : ''), {
      type: 'button', 'aria-pressed': String(!!task.done),
      'aria-label': (task.done ? 'Tandai belum selesai: ' : 'Tandai selesai: ') + task.title,
      onclick: function () { task.done ? app.reopenTask(task.id) : app.completeTask(task.id); }
    }, task.done ? '✓' : ''));
    row.appendChild(ui.el('div.mw-task-body', ui.el('div.mw-task-title', task.title),
      ui.el('div.mw-task-meta', ui.el('span.mw-prio.' + task.priority, 'Prioritas ' + (JF.model.PRIORITY_LABEL[task.priority] || JF.model.PRIORITY_LABEL.normal)),
        ui.el('span' + (overdue ? '.late' : ''), overdue ? 'Terlambat · ' + ui.fmt.dateShort(task.targetDate) : 'Tenggat hari ini'))));
    if (!task.done) {
      var s = app.currentSession();
      var other = s && (s.state === 'running' || s.state === 'paused') && s.taskId !== task.id;
      row.appendChild(ui.btn('Fokus', function () { app.startTask(task.id); }, { sm: true, ghost: true, disabled: !!other, title: other ? 'Selesaikan sesi yang sedang berjalan terlebih dahulu' : 'Mulai fokus pada tugas ini' }));
      if (JF.completion) row.appendChild(ui.btn('Selesai + ringkasan', function () { JF.completion.start(task.id); }, { sm: true, ghost: true, title: 'Tandai selesai dengan ringkasan dan lampiran' }));
    }
    return row;
  }

  function tasksCard() {
    var st = app.rawState(), day = app.today();
    var od = JF.store.overdueTasks(st, day), td = JF.store.tasksTargeting(st, day);
    var o = { high: 0, normal: 1, low: 2 };
    function by(a, b) { return o[a.priority] - o[b.priority] || a.title.localeCompare(b.title, 'id'); }
    od.sort(by); td.sort(by);
    var card = ui.el('section.mw-card.mw-tasks');
    card.appendChild(ui.el('div.mw-card-head', ui.el('div', ui.el('span.mw-eyebrow', 'LANGKAH KECIL, HASIL BERARTI'), ui.el('h2', 'Tugas hari ini')),
      ui.btn('Semua tugas', function () { location.hash = '#tugas'; }, { ghost: true, sm: true })));
    if (od.length) {
      card.appendChild(ui.el('h3.mw-sub.late', 'Terlambat (' + od.length + ')'));
      od.forEach(function (t) { card.appendChild(taskRow(t, true)); });
    }
    if (!td.length && !od.length) card.appendChild(ui.el('p.mw-empty', 'Belum ada tugas untuk hari ini. Lautnya tenang. Tambah tugas dari halaman Tugas kalau perlu.'));
    td.forEach(function (t) { card.appendChild(taskRow(t, false)); });
    return card;
  }

  function journeyCard(info) {
    var M = JF.mola, cr = JF.capyrafi;
    var card = ui.el('section.mw-card.mw-journey');
    card.appendChild(ui.el('div.mw-card-head', ui.el('div', ui.el('span.mw-eyebrow', 'MOLA TUMBUH DARI KERJA KERASMU'), ui.el('h2', 'Perjalanan Mola'))));
    var track = ui.el('div.mw-track', { role: 'list' });
    M.NAMES.forEach(function (n, i) {
      var step = ui.el('div.mw-step' + (i === info.stage ? '.cur' : '') + (i > info.stage ? '.lock' : ''), { role: 'listitem', title: n[1], html: M.svg({ stage: i, mood: 'happy', cls: 'mw-mini' }) });
      step.appendChild(ui.el('b', n[0]));
      step.appendChild(ui.el('small', i === 0 ? 'mulai' : cr.STAGES[i].at + ' XP'));
      track.appendChild(step);
    });
    card.appendChild(track);
    card.appendChild(bar(info.pct, 'Progres XP menuju tahap berikutnya'));
    card.appendChild(ui.el('p.mw-note', ui.el('strong', info.xp + ' XP'), info.max ? ' · tahap tertinggi, hormat!' : ' · ' + info.toNext + ' XP lagi menuju ' + info.next.name));
    card.appendChild(ui.el('p.mw-note', 'XP dihitung ulang dari data tugas dan goals, jadi semua tampilan selalu sama.'));
    return card;
  }

  function render(container) {
    ui = JF.ui; app = JF.app; host = container; refs = {};
    var info = JF.mola.compute(app.rawState());
    var page = ui.el('div.mw-home');
    page.appendChild(hero(info));
    var row = ui.el('div.mw-duo');
    row.appendChild(focusCard());
    row.appendChild(progressCard());
    page.appendChild(row);
    page.appendChild(tasksCard());
    page.appendChild(journeyCard(info));
    ui.clear(container);
    container.appendChild(page);
  }

  var lastClock = '';
  function frame() {
    if (!app) return;
    var el = document.getElementById('mw-clock');
    if (!el) return;
    var t = clockText(app.currentSession(), app.breakInfo());
    if (t && t !== lastClock) { lastClock = t; el.textContent = t; }
  }

  JF.molaHome = { render: render, frame: frame };
})(typeof self !== 'undefined' ? self : this);
