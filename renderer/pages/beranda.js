/* Jam Fokus — Beranda: analog focus clock, session controls, daily summary,
   "Rencana hari ini" and "Tugas terlambat" previews. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app;

  var host, clock, els = {}, selected = null;

  function mount(container) {
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
      ctl.appendChild(ui.btn('Lewati istirahat', function () { app.skipBreak(); }, { primary: true }));
      card.appendChild(ctl);
      return;
    }

    if (s && s.state === 'running') {
      card.appendChild(stateLine('Sedang berjalan', 'run'));
      card.appendChild(taskLine(s));
      card.appendChild(ui.el('div.session-clock.run', { id: 'ses-clock' }, ui.fmt.mmss(sessRem(s))));
      card.appendChild(ui.el('div.session-sub', { id: 'ses-sub' },
        'Mulai ' + ui.fmt.time(s.startedAt) + ' · target ' + ui.fmt.dur(s.plannedSec)));
      card.appendChild(ui.el('div.progress', ui.el('i', { id: 'ses-bar' })));
      var c1 = ui.el('div.session-controls');
      c1.appendChild(ui.btn('Jeda', function () { app.pause(); }, { primary: true }));
      c1.appendChild(ui.btn('Hentikan sesi', confirmStop, { danger: true }));
      card.appendChild(c1);
      if (app.music.playingFocus) card.appendChild(musicStopRow());
      return;
    }

    if (s && s.state === 'paused') {
      card.appendChild(stateLine('DIJEDA', 'paused'));
      card.appendChild(taskLine(s));
      card.appendChild(ui.el('div.session-clock', { id: 'ses-clock' }, ui.fmt.mmss(sessRem(s))));
      card.appendChild(ui.el('div.session-sub', { id: 'ses-sub' },
        'Fokus terkumpul ' + ui.fmt.dur(s.activeSec) + ' · jeda ' + ui.fmt.dur(s.pausedSec)));
      card.appendChild(ui.el('div.progress', ui.el('i', { id: 'ses-bar' })));
      var c2 = ui.el('div.session-controls');
      c2.appendChild(ui.btn('Lanjutkan', function () { app.resume(); }, { primary: true }));
      c2.appendChild(ui.btn('Hentikan sesi', confirmStop, { danger: true }));
      card.appendChild(c2);
      return;
    }

    // Idle — choose a task (or a standalone session) and start.
    card.appendChild(stateLine('Siap fokus', ''));
    var active = JF.store.activeTasks(app.rawState(), app.today());
    var upcoming = JF.store.upcomingTasks(app.rawState(), app.today());
    var all = active.concat(upcoming);
    if (selected == null && app.selectedTaskId && app.findTask(app.selectedTaskId)) selected = app.selectedTaskId;
    if (selected != null && !app.findTask(selected)) selected = null;
    if (selected == null && all.length) selected = all[0].id;

    var pickWrap = ui.el('label.field', { style: { marginTop: '4px' } }, 'Tugas untuk sesi ini');
    var sel = ui.el('select', {
      id: 'ses-pick',
      onchange: function () { selected = this.value || null; app.selectedTaskId = selected; render(); }
    });
    sel.appendChild(ui.el('option', { value: '' }, 'Tanpa tugas (fokus umum)'));
    all.forEach(function (t) {
      var o = ui.el('option', { value: t.id }, t.title + (t.targetDate !== app.today() ? ' · ' + ui.fmt.dateShort(t.targetDate) : ''));
      if (t.id === selected) o.selected = true;
      sel.appendChild(o);
    });
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
      app.startTask(selected, { standalone: !selected });
    }, { primary: true }));
    card.appendChild(c3);
    if (app.music.playingFocus || app.music.playingBreak) card.appendChild(musicStopRow());
  }

  function musicStopRow() {
    var r = ui.el('div.session-controls');
    r.appendChild(ui.btn('Hentikan musik', function () { app.music.stopAllMusic ? app.music.stopAllMusic() : null; }, { ghost: true, sm: true }));
    return r;
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

  function confirmStop() {
    ui.confirm({
      title: 'Hentikan sesi ini?',
      body: 'Sesi berhenti total dan tidak bisa dilanjutkan. Waktu fokus yang sudah berjalan tetap tersimpan ' +
        'sebagai sesi terputus, tetapi tidak dihitung ke total fokus.',
      okLabel: 'Ya, hentikan', danger: true
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
    els.strip.appendChild(stat('Fokus hari ini', ui.fmt.dur(st.officialSec), 'accent', st.officialSec ? 'dari sesi selesai' : 'belum ada sesi selesai'));
    els.strip.appendChild(stat('Target harian', st.target.min ? ui.fmt.min(st.target.min) : '—', st.target.min ? '' : 'small',
      st.target.source === 'override' ? 'target khusus tanggal ini' : st.target.source === 'default' ? 'target bawaan' : 'belum diatur'));
    els.strip.appendChild(stat('Tugas selesai hari ini', st.doneToday + ' / ' + st.tasksGoal, 'ok', st.goalDone >= st.tasksGoal ? 'target tugas tercapai' : 'target ' + st.tasksGoal + ' tugas'));
    els.strip.appendChild(stat('Streak', st.streak + ' hari', '', st.streak > 0 ? 'berturut-turut' : 'mulai hari ini'));
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

  function render() {
    if (!host) return;
    renderSession();
    renderStrip();
    renderLists();
  }

  /* per-frame: hands, digital time, live countdown/progress */
  function frame() {
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

  JF.pages.register({
    id: 'beranda',
    title: 'Beranda',
    sub: function () { return 'Ringkasan & sesi fokus'; },
    mount: mount,
    render: render,
    frame: frame
  });
})(typeof self !== 'undefined' ? self : this);
