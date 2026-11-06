/* Mola World: Beranda. Semua logika (sesi, tugas, statistik) dipanggil dari JF.app / JF.store / JF.sessions. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host, refs = {}, pokeCount = 0;
  var selectedTaskId = null, pickFilter = null, pickDate = '', pickNone = false;

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

  /* Acuan fitur: renderer/pages/beranda.js (Original). Tata letak khas Mola, logika dan daftar fitur sama. */
  function stopSession() {
    var cs = app.currentSession();
    ui.confirm({
      title: 'Hentikan sesi ini?',
      body: 'Sesi berhenti total dan tidak bisa dilanjutkan. Waktu fokus yang sudah berjalan tetap tersimpan ' +
        'sebagai sesi terputus, tetapi tidak dihitung ke total fokus.' +
        (cs && JF.sessions.isOpen(cs) ? ' Untuk memasukkan waktu ini ke total, pilih "Selesai sesi" saja.' : ''),
      okLabel: 'Hentikan permanen', danger: true
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
      art.classList.remove('is-poked'); void art.offsetWidth; art.classList.add('is-poked');
    }
    art.addEventListener('click', poke);
    art.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } });
    card.appendChild(art);
    return card;
  }

  function stateHead(label, cls) {
    return ui.el('div.mw-card-head', ui.el('div', ui.el('span.mw-eyebrow', 'TIMER FOKUS'), ui.el('h2', label)), ui.el('span.mw-dot.' + cls, { 'aria-hidden': 'true' }));
  }
  function taskLine(s) { return ui.el('p.mw-task-now', s.taskId ? s.taskName : ui.el('span.mw-standalone', s.taskName)); }
  function progressPct(total, p) { return !(total > 0) ? '0%' : Math.max(0, Math.min(100, p * 100)).toFixed(2) + '%'; }

  function focusCard() {
    var s = app.currentSession(), brk = app.breakInfo();
    var card = ui.el('section.mw-card.mw-focus');

    if (brk) {
      card.appendChild(stateHead('Istirahat', 'break'));
      card.appendChild(ui.el('p.mw-task-now', 'Istirahat ' + ui.fmt.min(Math.round(brk.total / 60)) + (brk.isLong ? ' (panjang)' : '')));
      card.appendChild(ui.el('div.mw-clock.active', { id: 'mw-clock', 'aria-label': 'Sisa waktu istirahat' }, clockText(null, brk)));
      card.appendChild(ui.el('p.mw-note', brk.nextTaskId ? 'Berikutnya: ' + (app.findTask(brk.nextTaskId) || {}).title : 'Kembali ke tugas setelah selesai'));
      var bb = bar(0, 'Progres istirahat'); bb.id = 'mw-sbar'; card.appendChild(bb);
      card.appendChild(ui.el('div.mw-actions', ui.btn('Lewati istirahat', function () { try { app.skipBreak(); } catch (e) {} }, { primary: true })));
      return card;
    }

    if (s && (s.state === 'running' || s.state === 'paused')) {
      var run = s.state === 'running', open = JF.sessions.isOpen(s);
      card.appendChild(stateHead(run ? (open ? 'Waktu bebas' : 'Sedang berjalan') : 'Dijeda', run ? 'running' : 'paused'));
      card.appendChild(taskLine(s));
      card.appendChild(ui.el('div.mw-clock' + (run ? '.active' : ''), { id: 'mw-clock', 'aria-label': open ? 'Waktu fokus berjalan' : 'Sisa waktu sesi fokus' }, clockText(s, null)));
      card.appendChild(ui.el('p.mw-note', run
        ? 'Mulai ' + ui.fmt.time(s.startedAt) + (open ? ' · tanpa batas waktu' : ' · target ' + ui.fmt.dur(s.plannedSec))
        : 'Fokus terkumpul ' + ui.fmt.dur(s.activeSec) + ' · jeda ' + ui.fmt.dur(s.pausedSec)));
      if (!open) { var sb = bar(0, 'Progres sesi'); sb.id = 'mw-sbar'; card.appendChild(sb); }
      var row = ui.el('div.mw-actions');
      row.appendChild(ui.btn(run ? 'Jeda' : 'Lanjutkan', function () { run ? app.pause() : app.resume(); }, { primary: true }));
      if (open) row.appendChild(ui.btn('Selesai sesi', function () { app.finishOpen(); }, {}));
      row.appendChild(ui.btn('Hentikan sesi', stopSession, { danger: true }));
      if (s.taskId && JF.completion) row.appendChild(ui.btn('Selesai + ringkasan', function () { JF.completion.start(s.taskId); }, { ghost: true }));
      card.appendChild(row);
      return card;
    }

    card.appendChild(stateHead('Siap fokus', 'idle'));
    var st = app.rawState(), todayKey = app.today(), tomorrowKey = JF.dates.addDays(todayKey, 1);
    var all = JF.store.activeTasks(st, todayKey).concat(JF.store.upcomingTasks(st, todayKey));
    var PF = {
      all: function () { return true; },
      late: function (x) { return x.targetDate < todayKey; },
      today: function (x) { return x.targetDate === todayKey; },
      tomorrow: function (x) { return x.targetDate === tomorrowKey; },
      date: function (x) { return !pickDate || x.targetDate === pickDate; }
    };
    function countOf(f) { return all.filter(PF[f]).length; }
    var eff = pickFilter || (countOf('today') ? 'today' : 'all');
    var W = { high: 0, normal: 1, low: 2 };
    var list = all.filter(PF[eff]).sort(function (a, b) {
      return a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : (W[a.priority] - W[b.priority]) || a.title.localeCompare(b.title, 'id');
    });
    if (selectedTaskId != null && !app.findTask(selectedTaskId)) selectedTaskId = null;
    if (selectedTaskId != null && !list.some(function (x) { return x.id === selectedTaskId; })) selectedTaskId = null;
    if (!pickNone) {
      if (selectedTaskId == null && app.selectedTaskId && list.some(function (x) { return x.id === app.selectedTaskId; })) selectedTaskId = app.selectedTaskId;
      if (selectedTaskId == null && list.length) selectedTaskId = list[0].id;
    }

    var fsel = ui.el('select.mw-select', { 'aria-label': 'Filter tanggal tugas' });
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
      pickNone = false; render(host);
    });
    var pfil = ui.el('div.mw-pick-filters', fsel);
    if (eff === 'date') {
      var pdate = ui.el('input.mw-select', { type: 'date', 'aria-label': 'Pilih tanggal tertentu', value: pickDate });
      pdate.addEventListener('change', function () { pickDate = JF.dates.isDayKey(pdate.value) ? pdate.value : ''; pickNone = false; render(host); });
      pfil.appendChild(pdate);
    }
    function fitLabel(title, dateText, max) {
      var tail = dateText ? ' · ' + dateText : '', room = max - tail.length;
      if (title.length <= room) return title + tail;
      return title.slice(0, Math.max(8, room - 1)).replace(/\s+$/, '') + '…' + tail;
    }
    var sel = ui.el('select.mw-select', {
      id: 'mw-ses-pick', 'aria-label': 'Tugas untuk sesi ini',
      onchange: function () { selectedTaskId = this.value || null; pickNone = !this.value; app.selectedTaskId = selectedTaskId; render(host); }
    });
    sel.appendChild(ui.el('option', { value: '' }, list.length ? 'Tanpa tugas (fokus umum)' : 'Tidak ada tugas di filter ini · fokus umum'));
    function addOpt(parent, x) {
      var o = ui.el('option', { value: x.id, title: x.title }, fitLabel(x.title, x.targetDate !== todayKey ? ui.fmt.dateShort(x.targetDate) : '', 36));
      if (x.id === selectedTaskId) o.selected = true;
      parent.appendChild(o);
    }
    if (eff === 'all') {
      [['Terlambat', PF.late], ['Hari ini', PF.today], ['Besok', PF.tomorrow], ['Mendatang', function (x) { return x.targetDate > tomorrowKey; }]].forEach(function (g) {
        var items = list.filter(g[1]);
        if (!items.length) return;
        var og = ui.el('optgroup', { label: g[0] + ' (' + items.length + ')' });
        items.forEach(function (x) { addOpt(og, x); });
        sel.appendChild(og);
      });
    } else { list.forEach(function (x) { addOpt(sel, x); }); }
    card.appendChild(ui.el('div.mw-picker', ui.el('div.mw-pick-head', ui.el('label.mw-pick-label', { for: 'mw-ses-pick' }, 'Tugas untuk sesi ini'), pfil), sel));

    var t = selectedTaskId ? app.findTask(selectedTaskId) : null;
    var planned = t ? t.left : st.settings.defaultFocusSec;
    if (!(planned > 0)) planned = (t && t.durationSec > 0) ? t.durationSec : st.settings.defaultFocusSec;
    if (!(planned > 0)) planned = 1500;
    card.appendChild(ui.el('div.mw-clock', { id: 'mw-clock' }, ui.fmt.mmss(planned)));
    card.appendChild(ui.el('p.mw-note', t
      ? 'Target tugas ' + ui.fmt.dur(t.durationSec) + (t.left < t.durationSec ? ' · sisa ' + ui.fmt.mmss(t.left) : '')
      : 'Sesi tanpa tugas · ' + ui.fmt.dur(st.settings.defaultFocusSec)));
    var ctl = ui.el('div.mw-actions');
    ctl.appendChild(ui.btn(t ? 'Mulai fokus' : 'Mulai fokus tanpa tugas', function () {
      var id = selectedTaskId; pickNone = false; app.startTask(id, { standalone: !id });
    }, { primary: true }));
    if (t && JF.completion) ctl.appendChild(ui.btn('Selesai + ringkasan', function () { JF.completion.start(t.id); }, { ghost: true }));
    card.appendChild(ctl);
    return card;
  }

  /* Ringkasan hari ini: empat angka yang sama dengan strip Original. */
  function statsCard() {
    var st = app.todayStats();
    function tile(k, v, u) { return ui.el('div.mw-stat', ui.el('span.mw-stat-k', k), ui.el('strong.mw-stat-v', v), ui.el('small', u)); }
    var card = ui.el('section.mw-card.mw-progress');
    card.appendChild(ui.el('div.mw-card-head', ui.el('div', ui.el('span.mw-eyebrow', 'HARI INI'), ui.el('h2', 'Gelombang demi gelombang')), ui.el('span.mw-shell-ico', { 'aria-hidden': 'true' }, '🐚')));
    var grid = ui.el('div.mw-stats');
    grid.appendChild(tile('Fokus hari ini', st.officialSec ? ui.fmt.dur(st.officialSec) : '—', st.officialSec ? 'dari sesi selesai' : 'belum ada sesi selesai'));
    grid.appendChild(tile('Target harian', st.target.min ? ui.fmt.min(st.target.min) : '—',
      st.target.source === 'override' ? 'target khusus tanggal ini' : st.target.source === 'default' ? 'target bawaan' : 'belum diatur'));
    grid.appendChild(tile('Tugas selesai hari ini', st.doneToday + ' / ' + st.tasksGoal, st.goalDone >= st.tasksGoal ? 'target tugas tercapai' : 'target ' + st.tasksGoal + ' tugas'));
    grid.appendChild(tile('Rentetan hari', st.streak + ' hari', st.streak > 0 ? 'berturut-turut' : 'mulai hari ini'));
    card.appendChild(grid);
    return card;
  }

  function miniTask(t, overdue) {
    var row = ui.el('div.mw-mini-task' + (overdue ? '.late' : '') + (t.done ? '.done' : ''));
    row.appendChild(ui.el('span.mw-mt-name', t.title));
    if (t.done) row.appendChild(ui.el('span.mw-chip.ok', 'Selesai'));
    else row.appendChild(ui.el('span.mw-mt-date', ui.dayRel(t.targetDate) + ' · ' + ui.fmt.dateShort(t.targetDate)));
    return row;
  }

  function listCard(title, chip, rows, emptyBig, emptySmall, extra) {
    var card = ui.el('section.mw-card.mw-list');
    var head = ui.el('div.mw-card-head', ui.el('div', ui.el('h2', title), ui.el('span.mw-chip' + (extra && extra.chipCls ? '.' + extra.chipCls : ''), chip)));
    if (extra && extra.action) head.appendChild(extra.action);
    card.appendChild(head);
    if (!rows.length) card.appendChild(ui.el('div.mw-empty', ui.el('strong', emptyBig), ui.el('span', emptySmall)));
    else {
      rows.slice(0, 6).forEach(function (r) { card.appendChild(r); });
      if (rows.length > 6) card.appendChild(ui.el('p.mw-note', { style: { textAlign: 'left' } }, '+ ' + (rows.length - 6) + ' lainnya'));
    }
    return card;
  }

  function listsRow() {
    var state = app.rawState(), d = app.today();
    var plan = state.tasks.filter(function (t) { return !t.archived && t.targetDate === d; });
    var late = JF.store.overdueTasks(state, d);
    var active = plan.filter(function (t) { return !t.done; }).length;
    var wrap = ui.el('div.mw-duo');
    wrap.appendChild(listCard('Rencana hari ini', plan.length ? active + ' aktif · ' + plan.length : '0',
      plan.map(function (t) { return miniTask(t, false); }), 'Belum ada rencana hari ini', 'Tambahkan tugas di halaman Tugas.',
      { chipCls: plan.length && active ? 'accent' : '', action: ui.btn('Lihat semua', function () { location.hash = '#tugas'; }, { ghost: true, sm: true }) }));
    wrap.appendChild(listCard('Tugas terlambat', late.length ? late.length + ' terlambat' : '0',
      late.map(function (t) { return miniTask(t, true); }), 'Tidak ada tugas terlambat', 'Semua target sudah tercapai atau maju.', { chipCls: late.length ? 'danger' : '' }));
    return wrap;
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
    row.appendChild(statsCard());
    page.appendChild(row);
    page.appendChild(listsRow());
    page.appendChild(journeyCard(info));
    ui.clear(container);
    container.appendChild(page);
  }

  var lastClock = '';
  function frame() {
    if (!app) return;
    var el = document.getElementById('mw-clock');
    if (!el) return;
    var cs = app.currentSession(), brk = app.breakInfo();
    var t = clockText(cs, brk);
    if (t && t !== lastClock) { lastClock = t; el.textContent = t; }
    var sb = document.querySelector('#mw-sbar span');
    if (!sb) return;
    if (brk) { var rem = Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000)); sb.style.width = progressPct(brk.total, 1 - rem / (brk.total || 1)); }
    else if (cs && !JF.sessions.isOpen(cs)) { var r2 = JF.sessions.remainingSeconds(cs, Date.now()); sb.style.width = progressPct(cs.plannedSec, 1 - r2 / (cs.plannedSec || 1)); }
  }

  JF.molaHome = { render: render, frame: frame };
})(typeof self !== 'undefined' ? self : this);
