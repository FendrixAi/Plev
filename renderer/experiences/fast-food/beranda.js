/* Fast Food: Beranda ("Counter"). Semua logika (sesi, tugas, statistik) dipanggil dari JF.app / JF.store / JF.sessions /
   JF.completion; tidak ada aturan bisnis baru di sini. Acuan fitur: renderer/pages/beranda.js (Original). */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host, refs = {}, pokeCount = 0, lastClock = '';
  var selectedTaskId = null, pickFilter = null, pickDate = '', pickNone = false;

  function ctxNow() {
    var st = app.rawState(), day = app.today(), s = app.currentSession();
    var today = JF.store.tasksTargeting(st, day);
    return {
      running: !!(s && s.state === 'running'), paused: !!(s && s.state === 'paused'), onBreak: !!app.breakInfo(),
      overdue: app.todayStats().overdue || 0, todayTotal: today.length,
      todayDone: today.filter(function (t) { return t.done; }).length
    };
  }
  function art(key, cls) { return ui.el('img.ff-art.' + cls, { src: JF.ffArt.src[key], alt: '', draggable: 'false' }); }

  function clockText(s, brk) {
    if (brk) return ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000)));
    if (!s || (s.state !== 'running' && s.state !== 'paused')) return null;
    return JF.sessions.isOpen(s) ? '+' + ui.fmt.mmss(JF.sessions.activeSeconds(s, Date.now()))
      : ui.fmt.mmss(JF.sessions.remainingSeconds(s, Date.now()));
  }
  function progressPct(total, p) { return !(total > 0) ? '0%' : Math.max(0, Math.min(100, p * 100)).toFixed(2) + '%'; }

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

  function pill(label, cls) { return ui.el('div.ff-pill.' + cls, ui.el('i', { 'aria-hidden': 'true' }), ui.el('span', label)); }
  function roundBtn(glyph, label, fn, cls) {
    var b = ui.el('button.ff-round' + (cls ? '.' + cls : ''), { type: 'button', title: label, 'aria-label': label }, glyph);
    b.addEventListener('click', fn);
    return b;
  }
  function bigBtn(icon, label, fn) {
    var b = ui.el('button.ff-big', { type: 'button' }, ui.el('span.ff-big-ico', { 'aria-hidden': 'true' }, icon), ui.el('span', label));
    b.addEventListener('click', fn);
    return b;
  }

  /* Picker tugas: filter tanggal + daftar tugas, sama fiturnya dengan Beranda Original. */
  function picker(st) {
    var todayKey = app.today(), tomorrowKey = JF.dates.addDays(todayKey, 1);
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
    var fsel = ui.el('select.ff-select', { 'aria-label': 'Filter tanggal tugas' });
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
    var pfil = ui.el('div.ff-pick-filters', fsel);
    if (eff === 'date') {
      var pdate = ui.el('input.ff-select', { type: 'date', 'aria-label': 'Pilih tanggal tertentu', value: pickDate });
      pdate.addEventListener('change', function () { pickDate = JF.dates.isDayKey(pdate.value) ? pdate.value : ''; pickNone = false; render(host); });
      pfil.appendChild(pdate);
    }
    function fitLabel(title, dateText, max) {
      var tail = dateText ? ' · ' + dateText : '', room = max - tail.length;
      if (title.length <= room) return title + tail;
      return title.slice(0, Math.max(8, room - 1)).replace(/\s+$/, '') + '…' + tail;
    }
    var sel = ui.el('select.ff-select', {
      id: 'ff-ses-pick', 'aria-label': 'Tugas untuk sesi ini',
      onchange: function () { selectedTaskId = this.value || null; pickNone = !this.value; app.selectedTaskId = selectedTaskId; render(host); }
    });
    sel.appendChild(ui.el('option', { value: '' }, list.length ? 'Tanpa tugas (fokus umum)' : 'Tidak ada tugas di filter ini · fokus umum'));
    function addOpt(parent, x) {
      var o = ui.el('option', { value: x.id, title: x.title }, fitLabel(x.title, x.targetDate !== todayKey ? ui.fmt.dateShort(x.targetDate) : '', 34));
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
    var slip = ui.el('div.ff-slip', ui.el('div.ff-slip-head', ui.el('label', { for: 'ff-ses-pick' }, 'ORDER UNTUK SESI INI'), pfil), sel);
    return { el: slip, task: selectedTaskId ? app.findTask(selectedTaskId) : null };
  }

  function hero(info) {
    var ctx = ctxNow(), mood = JF.capyrafi.moodOf(ctx);
    var s = app.currentSession(), brk = app.breakInfo(), st = app.rawState();
    var sec = ui.el('section.ff-hero');

    /* dekorasi panggung */
    var set = ui.el('div.ff-set', { 'aria-hidden': 'true' });
    set.appendChild(ui.el('i.ff-corner.l')); set.appendChild(ui.el('i.ff-corner.r'));
    set.appendChild(ui.el('i.ff-floor'));
    set.appendChild(ui.el('i.ff-window'));
    set.appendChild(art('board', 'ff-d-board')); set.appendChild(art('neon', 'ff-d-neon'));
    set.appendChild(ui.el('span.ff-cord'));
    set.appendChild(art('lamp', 'ff-d-lamp'));
    set.appendChild(art('fries', 'ff-d-fries')); set.appendChild(art('cup', 'ff-d-cup'));
    ['a', 'b', 'c'].forEach(function (k) { set.appendChild(ui.el('i.ff-spark.' + k)); });
    sec.appendChild(set);

    var mascot = ui.el('button.ff-mascot', { type: 'button', title: 'Colek burger', 'aria-label': 'Colek burger untuk mendengar celotehnya', html: JF.burger.stack({ stage: info.stage, mood: mood }) });
    sec.appendChild(mascot);

    var core = ui.el('div.ff-core');
    var main = null, side = null;
    refs.clock = null; refs.meter = null;

    if (brk) {
      core.appendChild(pill('Istirahat', 'break'));
      core.appendChild(ui.el('div.ff-clock.live', { id: 'ff-clock', 'aria-label': 'Sisa waktu istirahat' }, clockText(null, brk)));
      core.appendChild(ui.el('p.ff-tag', brk.nextTaskId ? 'Berikutnya: ' + (app.findTask(brk.nextTaskId) || {}).title : 'Istirahat ' + ui.fmt.min(Math.round(brk.total / 60)) + (brk.isLong ? ' (panjang)' : '')));
      core.appendChild(ui.el('div.ff-meter', { id: 'ff-meter' }, ui.el('span')));
      core.appendChild(ui.el('div.ff-actions', bigBtn('⏭', 'Lewati istirahat', function () { try { app.skipBreak(); } catch (e) { /* tidak ada istirahat */ } })));
    } else if (s && (s.state === 'running' || s.state === 'paused')) {
      var run = s.state === 'running', open = JF.sessions.isOpen(s);
      core.appendChild(pill(run ? (open ? 'Waktu Bebas' : 'Focus Time') : 'Dijeda', run ? 'run' : 'pause'));
      core.appendChild(ui.el('div.ff-clock' + (run ? '.live' : ''), { id: 'ff-clock', 'aria-label': open ? 'Waktu fokus berjalan' : 'Sisa waktu sesi fokus' }, clockText(s, null)));
      core.appendChild(ui.el('p.ff-tag', s.taskId ? s.taskName : ui.el('span', s.taskName)));
      if (!open) core.appendChild(ui.el('div.ff-meter', { id: 'ff-meter' }, ui.el('span')));
      core.appendChild(ui.el('p.ff-note', run
        ? 'Mulai ' + ui.fmt.time(s.startedAt) + (open ? ' · tanpa batas waktu' : ' · target ' + ui.fmt.dur(s.plannedSec))
        : 'Fokus terkumpul ' + ui.fmt.dur(s.activeSec) + ' · jeda ' + ui.fmt.dur(s.pausedSec)));
      var row = ui.el('div.ff-actions');
      row.appendChild(bigBtn(run ? '❚❚' : '▶', run ? 'Pause' : 'Lanjutkan', function () { run ? app.pause() : app.resume(); }));
      if (open) row.appendChild(ui.btn('Selesai sesi', function () { app.finishOpen(); }, {}));
      row.appendChild(roundBtn('■', 'Hentikan sesi', stopSession, 'danger'));
      core.appendChild(row);
      if (s.taskId && JF.completion) core.appendChild(ui.el('div.ff-sub', ui.btn('Selesai + ringkasan', function () { JF.completion.start(s.taskId); }, { ghost: true })));
    } else {
      core.appendChild(pill('Siap Fokus', 'idle'));
      var pk = picker(st), t = pk.task;
      var planned = t ? t.left : st.settings.defaultFocusSec;
      if (!(planned > 0)) planned = (t && t.durationSec > 0) ? t.durationSec : st.settings.defaultFocusSec;
      if (!(planned > 0)) planned = 1500;
      core.appendChild(ui.el('div.ff-clock', { id: 'ff-clock' }, ui.fmt.mmss(planned)));
      core.appendChild(ui.el('p.ff-tag', t
        ? 'Target tugas ' + ui.fmt.dur(t.durationSec) + (t.left < t.durationSec ? ' · sisa ' + ui.fmt.mmss(t.left) : '')
        : 'Sesi tanpa tugas · ' + ui.fmt.dur(st.settings.defaultFocusSec)));
      core.appendChild(pk.el);
      /* Target sesi sudah habis: lanjutkan sebagai waktu bebas (hitung maju). */
      var canContinue = !!(t && t.left === 0);
      var ctl = ui.el('div.ff-actions');
      ctl.appendChild(bigBtn('▶', t ? (canContinue ? 'Lanjut fokus' : 'Mulai fokus') : 'Mulai fokus tanpa tugas', function () {
        var id = selectedTaskId; pickNone = false; app.startTask(id, { standalone: !id, open: canContinue });
      }));
      if (t && JF.completion) ctl.appendChild(roundBtn('✓', 'Selesai + ringkasan', function () { JF.completion.start(t.id); }, 'ok'));
      core.appendChild(ctl);
    }
    var say = ui.el('p.ff-say', { 'aria-live': 'polite' }, JF.burger.say(mood, ctx, pokeCount));
    core.appendChild(say);
    sec.appendChild(core);

    function poke() {
      pokeCount += 1;
      var c = ctxNow();
      say.textContent = JF.burger.say(JF.capyrafi.moodOf(c), c, pokeCount);
      mascot.classList.remove('is-poked'); void mascot.offsetWidth; mascot.classList.add('is-poked');
    }
    mascot.addEventListener('click', poke);
    return sec;
  }

  /* Papan skor: empat angka yang sama dengan strip Original. */
  function scoreboard() {
    var st = app.todayStats();
    function tile(k, v, u) { return ui.el('div.ff-tile', ui.el('span.ff-tile-k', k), ui.el('strong.ff-tile-v', v), ui.el('small', u)); }
    var card = ui.el('section.ff-card.ff-score');
    card.appendChild(ui.el('div.ff-card-head', ui.el('div', ui.el('span.ff-eyebrow', 'PAPAN SKOR HARI INI'), ui.el('h2', 'Penjualan hari ini'))));
    var grid = ui.el('div.ff-tiles');
    grid.appendChild(tile('Fokus hari ini', st.officialSec ? ui.fmt.dur(st.officialSec) : '—', st.officialSec ? 'dari sesi selesai' : 'belum ada sesi selesai'));
    grid.appendChild(tile('Target harian', st.target.min ? ui.fmt.min(st.target.min) : '—',
      st.target.source === 'override' ? 'target khusus tanggal ini' : st.target.source === 'default' ? 'target bawaan' : 'belum diatur'));
    grid.appendChild(tile('Tugas selesai hari ini', st.doneToday + ' / ' + st.tasksGoal, st.goalDone >= st.tasksGoal ? 'target tugas tercapai' : 'target ' + st.tasksGoal + ' tugas'));
    grid.appendChild(tile('Rentetan hari', st.streak + ' hari', st.streak > 0 ? 'berturut-turut' : 'mulai hari ini'));
    card.appendChild(grid);
    return card;
  }

  function ticket(t, late) {
    var row = ui.el('div.ff-ticket' + (late ? '.late' : '') + (t.done ? '.done' : ''));
    row.appendChild(ui.el('span.ff-t-name', t.title));
    row.appendChild(t.done ? ui.el('span.ff-chip.ok', 'Served') : ui.el('span.ff-t-date', ui.dayRel(t.targetDate) + ' · ' + ui.fmt.dateShort(t.targetDate)));
    return row;
  }
  function rail(title, chip, rows, emptyBig, emptySmall, extra) {
    var card = ui.el('section.ff-card.ff-rail');
    var head = ui.el('div.ff-card-head', ui.el('div', ui.el('h2', title), ui.el('span.ff-chip' + (extra && extra.cls ? '.' + extra.cls : ''), chip)));
    if (extra && extra.action) head.appendChild(extra.action);
    card.appendChild(head);
    if (!rows.length) card.appendChild(ui.el('div.ff-empty', ui.el('strong', emptyBig), ui.el('span', emptySmall)));
    else {
      rows.slice(0, 6).forEach(function (r) { card.appendChild(r); });
      if (rows.length > 6) card.appendChild(ui.el('p.ff-note', '+ ' + (rows.length - 6) + ' lainnya'));
    }
    return card;
  }
  function rails() {
    var state = app.rawState(), d = app.today();
    var plan = state.tasks.filter(function (t) { return !t.archived && t.targetDate === d; });
    var late = JF.store.overdueTasks(state, d);
    var active = plan.filter(function (t) { return !t.done; }).length;
    var wrap = ui.el('div.ff-duo');
    wrap.appendChild(rail('Order hari ini', plan.length ? active + ' aktif · ' + plan.length : '0',
      plan.map(function (t) { return ticket(t, false); }), 'Belum ada order hari ini', 'Tambahkan tugas di halaman Tugas.',
      { cls: plan.length && active ? 'accent' : '', action: ui.btn('Lihat semua', function () { location.hash = '#tugas'; }, { ghost: true, sm: true }) }));
    wrap.appendChild(rail('Order terlambat', late.length ? late.length + ' terlambat' : '0',
      late.map(function (t) { return ticket(t, true); }), 'Tidak ada order basi', 'Semua target sudah tercapai atau maju.', { cls: late.length ? 'danger' : '' }));
    return wrap;
  }

  function journey(info) {
    var B = JF.burger, cr = JF.capyrafi;
    var card = ui.el('section.ff-card.ff-journey');
    card.appendChild(ui.el('div.ff-card-head', ui.el('div', ui.el('span.ff-eyebrow', 'BURGER TUMBUH DARI KERJA KERASMU'), ui.el('h2', 'Burger Builder'))));
    var track = ui.el('div.ff-track', { role: 'list' });
    B.NAMES.forEach(function (n, i) {
      var step = ui.el('div.ff-step' + (i === info.stage ? '.cur' : '') + (i > info.stage ? '.lock' : ''), { role: 'listitem', title: n[1], html: B.stack({ stage: i, mood: 'happy', cls: 'ff-mini' }) });
      step.appendChild(ui.el('b', n[0]));
      step.appendChild(ui.el('small', i === 0 ? 'mulai' : cr.STAGES[i].at + ' XP'));
      track.appendChild(step);
    });
    card.appendChild(track);
    var bar = ui.el('div.ff-xpbar', { role: 'progressbar', 'aria-label': 'Progres XP menuju tahap berikutnya', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(info.pct) }, ui.el('span', { style: { width: info.pct + '%' } }));
    card.appendChild(bar);
    card.appendChild(ui.el('p.ff-note', ui.el('strong', info.xp + ' XP'), info.max ? ' · tahap tertinggi, hormat!' : ' · ' + info.toNext + ' XP lagi menuju ' + info.next.name));
    card.appendChild(ui.el('p.ff-note', 'XP dihitung ulang dari data tugas dan goals, jadi semua tampilan selalu sama.'));
    return card;
  }

  function render(container) {
    ui = JF.ui; app = JF.app; host = container; refs = {}; lastClock = '';
    var info = JF.burger.compute(app.rawState());
    var page = ui.el('div.ff-home');
    page.appendChild(hero(info));
    var below = ui.el('div.ff-below');
    below.appendChild(scoreboard());
    below.appendChild(rails());
    below.appendChild(journey(info));
    page.appendChild(below);
    ui.clear(container);
    container.appendChild(page);
  }

  function frame() {
    if (!app) return;
    var el = document.getElementById('ff-clock');
    if (!el) return;
    var cs = app.currentSession(), brk = app.breakInfo();
    var t = clockText(cs, brk);
    if (t && t !== lastClock) { lastClock = t; el.textContent = t; }
    var sb = document.querySelector('#ff-meter span');
    if (!sb) return;
    if (brk) { var rem = Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000)); sb.style.width = progressPct(brk.total, 1 - rem / (brk.total || 1)); }
    else if (cs && !JF.sessions.isOpen(cs)) { var r2 = JF.sessions.remainingSeconds(cs, Date.now()); sb.style.width = progressPct(cs.plannedSec, 1 - r2 / (cs.plannedSec || 1)); }
  }

  JF.ffHome = { render: render, frame: frame };
})(typeof self !== 'undefined' ? self : this);
