/* Jam Fokus — Beranda: analog focus clock, session controls, daily summary,
   "Rencana hari ini" and "Tugas terlambat" previews. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app;

  var host, clock, els = {}, selected = null;
  var pickFilter = null;   // null = otomatis (Hari ini jika ada, kalau tidak Semua)
  var pickDate = '';
  var pickNone = false;    // true = pengguna sengaja memilih "Tanpa tugas"

  function mountOriginal(container) {
    ui = JF.ui; app = JF.app;
    host = container;

    var wrap = ui.el('div.beranda-top');

    var clkCard = ui.el('div.card.clock-card');
    var clkHost = ui.el('div.clock-holder');
    clkCard.appendChild(clkHost);
    var dig = ui.el('div.digt', '—');
    clkCard.appendChild(dig);
    wrap.appendChild(clkCard);

    var right = ui.el('div.session-panel');
    var sesCard = ui.el('div.card');
    right.appendChild(sesCard);
    wrap.appendChild(right);
    container.appendChild(wrap);

    container.appendChild(ui.el('div.section-label', 'Ringkasan hari ini'));
    var strip = ui.el('div.stat-strip');
    container.appendChild(strip);

    var cols = ui.el('div.grid.cols-2', { style: { marginTop: '14px' } });
    var c1 = ui.el('div.card');
    var h1 = ui.el('div.card-head', ui.el('h2', 'Rencana hari ini'), ui.el('span.chip', { id: 'bq-count' }), ui.el('span.grow'));
    var allBtn = ui.btn('Lihat semua', function () { location.hash = '#tugas'; }, { ghost: true, sm: true });
    h1.appendChild(allBtn);
    c1.appendChild(h1);
    c1.appendChild(ui.el('div', { id: 'bq-list' }));
    var c2 = ui.el('div.card');
    c2.appendChild(ui.el('div.card-head', ui.el('h2', 'Tugas terlambat'), ui.el('span.chip.danger', { id: 'td-count' }), ui.el('span.grow')));
    c2.appendChild(ui.el('div', { id: 'td-list' }));
    cols.appendChild(c1); cols.appendChild(c2);
    container.appendChild(cols);

    clock = JF.clock.mount(clkHost);
    host._dig = dig;
    els.sesCard = sesCard;
    els.strip = strip;
  }

  function storedExperience() {
    try { return localStorage.getItem('jamfokus.homeExperience') === 'capybara-world' ? 'capybara-world' : 'original'; }
    catch (e) { return 'original'; }
  }

  function setStoredExperience(experience) {
    if (experience !== 'original' && experience !== 'capybara-world') {
      throw new Error('Pilihan tema Beranda tidak dikenal.');
    }
    localStorage.setItem('jamfokus.homeExperience', experience);
    if (JF.app && JF.app.emit) JF.app.emit('change');
    return experience;
  }

  function mount(container) {
    host = container;
    mountOriginal(container);
  }

  /* ── session card ─────────────────────────────────────────────── */
  function renderSession() {
    var card = els.sesCard;
    ui.clear(card);
    var s = app.currentSession();
    var brk = app.breakInfo();

    if (brk) {
      card.appendChild(stateLine('ISTIRAHAT', ''));
      card.appendChild(ui.el('div.session-task', 'Istirahat ' + ui.fmt.min(Math.round(brk.total / 60)) + (brk.isLong ? ' (panjang)' : '')));
      card.appendChild(ui.el('div.session-clock.run', { id: 'ses-clock' }, ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000)))));
      card.appendChild(ui.el('div.session-sub', brk.nextTaskId ? 'Berikutnya: ' + (app.findTask(brk.nextTaskId) || {}).title : 'Kembali ke tugas setelah selesai'));
      card.appendChild(ui.el('div.progress', ui.el('i', { id: 'ses-bar', style: { width: progressPct(brk.total, Math.max(0, (brk.total - (brk.endAt - Date.now()) / 1000)) / brk.total) } })));
      var ctl = ui.el('div.session-controls');
      ctl.appendChild(ui.btn('Lewati istirahat', function () { try { app.skipBreak(); } catch(e) {} }, { primary: true }));
      card.appendChild(ctl);
      return;
    }

    if (s && s.state === 'running') {
      var open1 = JF.sessions.isOpen(s);
      card.appendChild(stateLine(open1 ? 'Waktu bebas' : 'Sedang berjalan', 'run'));
      card.appendChild(taskLine(s));
      card.appendChild(ui.el('div.session-clock.run', { id: 'ses-clock' }, clockLabel(s)));
      card.appendChild(ui.el('div.session-sub', { id: 'ses-sub' },
        'Mulai ' + ui.fmt.time(s.startedAt) + (open1 ? ' · tanpa batas waktu' : ' · target ' + ui.fmt.dur(s.plannedSec))));
      if (!open1) card.appendChild(ui.el('div.progress', ui.el('i', { id: 'ses-bar' })));
      var c1 = ui.el('div.session-controls');
      c1.appendChild(ui.btn('Jeda', function () { app.pause(); }, { primary: true }));
      if (open1) c1.appendChild(ui.btn('Selesai sesi', function () { app.finishOpen(); }, {}));
      c1.appendChild(ui.btn('Hentikan sesi', confirmStop, { danger: true }));
      if (s.taskId && JF.completion) c1.appendChild(ui.btn('Selesai + ringkasan', function () { JF.completion.start(s.taskId); }, { ghost: true }));
      card.appendChild(c1);
      return;
    }

    if (s && s.state === 'paused') {
      var open2 = JF.sessions.isOpen(s);
      card.appendChild(stateLine('DIJEDA', 'paused'));
      card.appendChild(taskLine(s));
      card.appendChild(ui.el('div.session-clock', { id: 'ses-clock' }, clockLabel(s)));
      card.appendChild(ui.el('div.session-sub', { id: 'ses-sub' },
        'Fokus terkumpul ' + ui.fmt.dur(s.activeSec) + ' · jeda ' + ui.fmt.dur(s.pausedSec)));
      if (!open2) card.appendChild(ui.el('div.progress', ui.el('i', { id: 'ses-bar' })));
      var c2 = ui.el('div.session-controls');
      c2.appendChild(ui.btn('Lanjutkan', function () { app.resume(); }, { primary: true }));
      if (open2) c2.appendChild(ui.btn('Selesai sesi', function () { app.finishOpen(); }, {}));
      c2.appendChild(ui.btn('Hentikan sesi', confirmStop, { danger: true }));
      if (s.taskId && JF.completion) c2.appendChild(ui.btn('Selesai + ringkasan', function () { JF.completion.start(s.taskId); }, { ghost: true }));
      card.appendChild(c2);
      return;
    }

    // Idle — choose a task (or a standalone session) and start.
    card.appendChild(stateLine('Siap fokus', ''));
    var active = JF.store.activeTasks(app.rawState(), app.today());
    var upcoming = JF.store.upcomingTasks(app.rawState(), app.today());
    var all = active.concat(upcoming);
    var todayKey = app.today(), tomorrowKey = JF.dates.addDays(todayKey, 1);
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
      return a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 :
        (W[a.priority] - W[b.priority]) || a.title.localeCompare(b.title, 'id');
    });

    if (selected != null && !app.findTask(selected)) selected = null;
    if (selected != null && !list.some(function (x) { return x.id === selected; })) selected = null;
    if (!pickNone) {
      if (selected == null && app.selectedTaskId && list.some(function (x) { return x.id === app.selectedTaskId; })) selected = app.selectedTaskId;
      if (selected == null && list.length) selected = list[0].id;
    }

    // Filter tanggal: sebaris dengan label "Tugas untuk sesi ini" (kanan), bukan di dalam kolom pilihan tugas
    var pickWrap = ui.el('div.pick-wrap');
    var phead = ui.el('div.pick-head');
    phead.appendChild(ui.el('label.pick-label', { for: 'ses-pick' }, 'Tugas untuk sesi ini'));
    var pfil = ui.el('div.pick-filters');
    var fsel = ui.el('select#ses-fsel', { 'aria-label': 'Filter tanggal tugas' });
    fsel.className = 'fsel';
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
      pickNone = false; render();
    });
    pfil.appendChild(fsel);
    if (eff === 'date') {
      var pdate = ui.el('input#ses-fdate', { type: 'date', 'aria-label': 'Pilih tanggal tertentu', value: pickDate });
      pdate.className = 'fdate';
      pdate.addEventListener('change', function () { pickDate = JF.dates.isDayKey(pdate.value) ? pdate.value : ''; pickNone = false; render(); });
      pfil.appendChild(pdate);
    }
    phead.appendChild(pfil);
    pickWrap.appendChild(phead);
    // Label opsi dipotong di tengah agar kartu tidak melebar: judul dipendekkan, tanggal tetap terlihat.
    function fitLabel(title, dateText, max) {
      var tail = dateText ? ' · ' + dateText : '';
      var room = max - tail.length;
      if (title.length <= room) return title + tail;
      return title.slice(0, Math.max(8, room - 1)).replace(/\s+$/, '') + '…' + tail;
    }
    var sel = ui.el('select', {
      id: 'ses-pick',
      onchange: function () { selected = this.value || null; pickNone = !this.value; app.selectedTaskId = selected; render(); }
    });
    sel.appendChild(ui.el('option', { value: '' }, list.length ? 'Tanpa tugas (fokus umum)' : 'Tidak ada tugas di filter ini · fokus umum'));
    function addOpt(parent, x) {
      var o = ui.el('option', { value: x.id, title: x.title }, fitLabel(x.title, x.targetDate !== todayKey ? ui.fmt.dateShort(x.targetDate) : '', 36));
      if (x.id === selected) o.selected = true;
      parent.appendChild(o);
    }
    if (eff === 'all') {
      [['Terlambat', function (x) { return x.targetDate < todayKey; }],
       ['Hari ini', function (x) { return x.targetDate === todayKey; }],
       ['Besok', function (x) { return x.targetDate === tomorrowKey; }],
       ['Mendatang', function (x) { return x.targetDate > tomorrowKey; }]].forEach(function (g) {
        var items = list.filter(g[1]);
        if (!items.length) return;
        var og = ui.el('optgroup', { label: g[0] + ' (' + items.length + ')' });
        items.forEach(function (x) { addOpt(og, x); });
        sel.appendChild(og);
      });
    } else {
      list.forEach(function (x) { addOpt(sel, x); });
    }
    pickWrap.appendChild(sel);
    card.appendChild(pickWrap);

    var t = selected ? app.findTask(selected) : null;
    var planned = t ? t.left : app.rawState().settings.defaultFocusSec;
    if (!(planned > 0)) planned = (t && t.durationSec > 0) ? t.durationSec : app.rawState().settings.defaultFocusSec;
    if (!(planned > 0)) planned = 1500;
    card.appendChild(ui.el('div.session-clock', ui.fmt.mmss(planned)));
    card.appendChild(ui.el('div.session-sub',
      t ? 'Target tugas ' + ui.fmt.dur(t.durationSec) + (t.left < t.durationSec ? ' · sisa ' + ui.fmt.mmss(t.left) : '')
        : 'Sesi tanpa tugas · ' + ui.fmt.dur(app.rawState().settings.defaultFocusSec)));

    var c3 = ui.el('div.session-controls');
    c3.appendChild(ui.btn(t ? 'Mulai fokus' : 'Mulai fokus tanpa tugas', function () {
      var sid = selected; pickNone = false;
      app.startTask(sid, { standalone: !sid });
    }, { primary: true }));
    if (t && JF.completion) c3.appendChild(ui.btn('Selesai + ringkasan', function () { JF.completion.start(t.id); }, { ghost: true }));
    card.appendChild(c3);
  }


  function stateLine(label, cls) {
    return ui.el('div.session-state' + (cls ? '.' + cls : ''), ui.el('span.dot'), label);
  }
  function taskLine(s) {
    return ui.el('div.session-task', s.taskId ? s.taskName : ui.el('span.standalone', s.taskName));
  }
  function progressPct(total, p) {
    if (!(total > 0)) return '0%';
    return Math.max(0, Math.min(100, p * 100)).toFixed(2) + '%';
  }
  function sessRem(s) { return JF.sessions.remainingSeconds(s, Date.now()); }
  /* Teks jam sesi: sisa waktu, atau "+waktu berjalan" untuk sesi waktu bebas. */
  function clockLabel(s) {
    return JF.sessions.isOpen(s) ? '+' + ui.fmt.mmss(JF.sessions.activeSeconds(s, Date.now())) : ui.fmt.mmss(sessRem(s));
  }

  function confirmStop() {
    var cs = app.currentSession();
    ui.confirm({
      title: 'Hentikan sesi ini?',
      body: 'Sesi berhenti total dan tidak bisa dilanjutkan. Waktu fokus yang sudah berjalan tetap tersimpan ' +
        'sebagai sesi terputus, tetapi tidak dihitung ke total fokus.' +
        (cs && JF.sessions.isOpen(cs) ? ' Untuk memasukkan waktu ini ke total, pilih "Selesai sesi" saja.' : ''),
      okLabel: 'Hentikan permanen', danger: true
    }).then(function (ok) { if (ok) app.stopPermanent(); });
    return false; // keep modal open until confirm resolves
  }

  /* ── summaries ────────────────────────────────────────────────── */
  function stat(k, v, cls, u) {
    var s = ui.el('div.stat', ui.el('div.k', k), ui.el('div.v' + (cls ? '.' + cls : ''), v));
    if (u) s.appendChild(ui.el('div.u', u));
    return s;
  }
  function renderStrip() {
    var st = app.todayStats();
    ui.clear(els.strip);
    els.strip.appendChild(stat('Fokus hari ini', st.officialSec ? ui.fmt.dur(st.officialSec) : '—', 'accent', st.officialSec ? 'dari sesi selesai' : 'belum ada sesi selesai'));
    els.strip.appendChild(stat('Target harian', st.target.min ? ui.fmt.min(st.target.min) : '—', st.target.min ? '' : 'small',
      st.target.source === 'override' ? 'target khusus tanggal ini' : st.target.source === 'default' ? 'target bawaan' : 'belum diatur'));
    els.strip.appendChild(stat('Tugas selesai hari ini', st.doneToday + ' / ' + st.tasksGoal, 'ok', st.goalDone >= st.tasksGoal ? 'target tugas tercapai' : 'target ' + st.tasksGoal + ' tugas'));
    els.strip.appendChild(stat('Rentetan hari', st.streak + ' hari', '', st.streak > 0 ? 'berturut-turut' : 'mulai hari ini'));
  }

  function taskRowPreview(t, opts) {
    var row = ui.el('div.mini-task' + (opts && opts.overdue ? '.od' : '') + (t.done ? '.done' : ''));
    row.appendChild(ui.el('span.mt-name', t.title));
    if (t.done) row.appendChild(ui.el('span.chip.ok', 'Selesai'));
    else row.appendChild(ui.el('span.mt-date', ui.dayRel(t.targetDate) + ' · ' + ui.fmt.dateShort(t.targetDate)));
    return row;
  }

  function renderLists() {
    var st = app.todayStats();
    var state = app.rawState(), d = app.today();
    var bq = ui.$('bq-list'), td = ui.$('td-list');
    var plan = state.tasks.filter(function (t) { return !t.archived && t.targetDate === d; });
    var late = JF.store.overdueTasks(state, d);

    ui.$('bq-count').textContent = plan.length ? plan.filter(function (t) { return !t.done; }).length + ' aktif · ' + plan.length : '0';
    ui.$('bq-count').className = 'chip' + (plan.length && plan.some(function (t) { return !t.done; }) ? '.accent' : '');
    ui.clear(bq);
    if (!plan.length) {
      bq.appendChild(ui.el('div.empty', ui.el('span.big', 'Belum ada rencana hari ini'), 'Tambahkan tugas di halaman Tugas.'));
    } else {
      plan.slice(0, 6).forEach(function (t) { bq.appendChild(taskRowPreview(t)); });
      if (plan.length > 6) bq.appendChild(ui.el('div.hint', { style: { marginTop: '8px' } }, '+ ' + (plan.length - 6) + ' lainnya'));
    }

    ui.$('td-count').textContent = late.length ? late.length + ' terlambat' : '0';
    ui.clear(td);
    if (!late.length) {
      td.appendChild(ui.el('div.empty', ui.el('span.big', 'Tidak ada tugas terlambat'), 'Semua target sudah tercapai atau maju.'));
    } else {
      late.slice(0, 6).forEach(function (t) { td.appendChild(taskRowPreview(t, { overdue: true })); });
      if (late.length > 6) td.appendChild(ui.el('div.hint', { style: { marginTop: '8px' } }, '+ ' + (late.length - 6) + ' lainnya'));
    }
  }

  function renderOriginal() {
    if (!host) return;
    renderSession();
    renderStrip();
    renderLists();
  }

  /* per-frame: hands, digital time, live countdown/progress */
  function frameOriginal() {
    if (!host || host.hidden) return;
    var now = new Date();
    clock.hands(now);
    if (host._dig) host._dig.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');

    var brk = app.breakInfo(), s = app.currentSession();
    var clk = document.getElementById('ses-clock');
    var bar = document.getElementById('ses-bar');

    if (brk && clk) {
      var brem = Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000));
      clk.textContent = ui.fmt.mmss(brem);
      if (bar) bar.style.width = progressPct(brk.total, 1 - brem / brk.total);
      clock.setProgress(1 - brem / (brk.total || 1));
      clock.setRunning(true);
      return;
    }
    if (s && (s.state === 'running' || s.state === 'paused') && clk) {
      if (JF.sessions.isOpen(s)) {
        clk.textContent = clockLabel(s);
        clock.setProgress(null);          // waktu bebas: tidak ada target, tidak ada progres
        clock.setRunning(s.state === 'running');
        return;
      }
      var rem = sessRem(s);
      clk.textContent = ui.fmt.mmss(rem);
      if (bar) bar.style.width = progressPct(s.plannedSec, 1 - rem / (s.plannedSec || 1));
      clock.setProgress(s.plannedSec ? 1 - rem / s.plannedSec : null);
      clock.setRunning(s.state === 'running');
      return;
    }
    clock.setProgress(null);
    clock.setRunning(false);
  }

  function render() {
    renderOriginal();
  }

  function frame() {
    frameOriginal();
  }

  JF.pages.register({
    id: 'beranda',
    title: 'Beranda',
    sub: 'Ringkasan & sesi fokus',
    mount: mount,
    render: render,
    frame: frame
  });
  JF.homeExperience = {
    get: storedExperience,
    set: setStoredExperience
  };
})(typeof self !== 'undefined' ? self : this);
