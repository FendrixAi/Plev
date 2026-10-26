/* Jam Fokus — Kalender: weekly default view with optional monthly overview,
   distinct target/completion markers per task (no duplicate rows), "+N lainnya"
   and a date-detail panel (tasks, overdue, completions, focus, target override). */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host;
  var view = 'minggu';          // weekly is the default (spec)
  var anchor = null;            // any day inside the displayed period
  var selected = null;          // day opened in the detail panel

  function mount(container) {
    ui = JF.ui; app = JF.app;
    host = container;
    anchor = app.today();
    container.appendChild(ui.el('div.cal-head', { id: 'cal-head' }));
    container.appendChild(ui.el('div.cal-layout', { id: 'cal-layout' },
      ui.el('div', { id: 'cal-gridwrap' }),
      ui.el('div', { id: 'cal-panel' })));
    container.appendChild(ui.el('div.cal-legend',
      ui.el('span', ui.el('i', { style: { background: 'var(--accent)' } }), 'Target tugas'),
      ui.el('span', ui.el('i', { style: { background: 'var(--ok)' } }), 'Selesai'),
      ui.el('span', ui.el('i', { style: { background: 'var(--surface-3)', border: '1px solid var(--line-2)' } }), 'Nama tugas'),
      ui.el('span', 'Angka jam = fokus resmi hari itu')));
  }

  function startOfWeek(day) {
    var p = JF.dates.parseDay(day);
    var js = new Date(p.y, p.m - 1, p.d);
    var dow = (js.getDay() + 6) % 7;             // 0 = Monday
    return JF.dates.addDays(day, -dow);
  }
  function startOfMonth(day) {
    var p = JF.dates.parseDay(day);
    return JF.dates.buildDay(p.y, p.m, 1);
  }

  /* ── per-date markers ─────────────────────────────────────────────── */
  function cellItems(d) {
    var state = app.rawState();
    var items = {};
    function put(t, kind) {
      var it = items[t.id];
      if (!it) items[t.id] = it = { t: t, target: false, done: false };
      if (kind === 'target') it.target = true;
      else it.done = true;
    }
    state.tasks.forEach(function (t) {
      if (t.targetDate === d) put(t, 'target');
      if (t.firstCompletedAt != null && JF.dates.dayKey(t.firstCompletedAt) === d) put(t, 'done');
      else if (t.completedAt != null && JF.dates.dayKey(t.completedAt) === d) put(t, 'done'); // re-completion
    });
    return Object.keys(items).map(function (k) { return items[k]; }).sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;   // pending work first
      return a.t.title.localeCompare(b.t.title, 'id');
    });
  }

  function focusFor(d) {
    if (d === app.today()) return { sec: app.todayStats().officialSec, live: true };
    var snap = null;
    var ss = app.rawState().snapshots;
    for (var i = 0; i < ss.length; i++) if (ss[i].date === d) { snap = ss[i]; break; }
    return snap ? { sec: snap.officialFocusSec, live: false, complete: snap.complete } : null;
  }

  function chip(it) {
    var cls = 'div.cal-chip' + (it.target ? '.target' : '') + (it.done ? '.completed' : '');
    var c = ui.el(cls, ui.el('span.cn', it.t.title));
    if (it.done) c.appendChild(ui.el('span.cm', { title: 'Selesai' }, '✓'));
    return c;
  }

  function cellFor(d, dimmed) {
    var cell = ui.el('div.cal-cell' + (dimmed ? '.out' : '') + (d === app.today() ? '.today' : ''), {
      onclick: function () { selected = d; render(); }
    });
    var items = cellItems(d);
    var head = ui.el('div.dnum', { dataset: { day: d } });
    var p = JF.dates.parseDay(d);
    head.appendChild(ui.el('span', String(p.d)));
    if (d === app.today()) head.appendChild(ui.el('span.tmark', 'hari ini'));
    cell.appendChild(head);

    items.slice(0, 3).forEach(function (it) { cell.appendChild(chip(it)); });
    if (items.length > 3) {
      var more = ui.el('button.cal-more', {
        type: 'button',
        onclick: function (e) { e.stopPropagation(); selected = d; render(); }
      }, '+ ' + (items.length - 3) + ' lainnya');
      cell.appendChild(more);
    }

    var f = focusFor(d);
    if (f && f.sec > 0) cell.appendChild(ui.el('div.cal-focus', '⏱ ' + ui.fmt.durShort(f.sec)));
    else if (f && f.live) cell.appendChild(ui.el('div.cal-focus', { style: { opacity: 0.55 } }, '⏱ —'));
    return cell;
  }

  /* ── detail panel ─────────────────────────────────────────────────── */
  function taskLine(t, d, withActions) {
    var r = ui.el('div.dp-item');
    var nm = ui.el('div.di-name', t.title);
    if (JF.model.isOverdue(t, d)) nm.appendChild(ui.el('span.chip.danger', { style: { marginLeft: '6px' } }, 'terlambat'));
    r.appendChild(nm);
    if (withActions) {
      if (t.done) {
        r.appendChild(ui.btn('Urungkan', function () { app.reopenTask(t.id); }, { sm: true, ghost: true }));
      } else {
        r.appendChild(ui.btn('Selesai', function () { app.completeTask(t.id); }, { sm: true }));
      }
      r.appendChild(ui.btn('Ubah', function () { JF.taskUI.openEdit(t); }, { sm: true, ghost: true }));
    }
    return r;
  }

  function panel(selectedDay) {
    var state = app.rawState();
    var p = ui.el('div.card.day-panel');
    var head = ui.el('div.dp-head');
    head.appendChild(ui.el('h2', ui.fmt.date(selectedDay)));
    head.appendChild(ui.btn('‹', function () { selected = JF.dates.addDays(selectedDay, -1); render(); }, { sm: true, ghost: true, title: 'Hari sebelumnya' }));
    head.appendChild(ui.btn('›', function () { selected = JF.dates.addDays(selectedDay, 1); render(); }, { sm: true, ghost: true, title: 'Hari berikutnya' }));
    head.appendChild(ui.el('button.icb', {
      type: 'button', title: 'Tutup panel', 'aria-label': 'Tutup panel',
      onclick: function () { selected = null; render(); }
    }, ui.svg(ui.ICON.x, 15)));
    p.appendChild(head);
    p.appendChild(ui.el('div.hint', ui.dayRel(selectedDay)));

    // Target tasks for this date
    var targets = state.tasks.filter(function (t) { return !t.archived && t.targetDate === selectedDay; });
    var sec1 = ui.el('div.dp-sec', ui.el('h3', 'Target tanggal ini (' + targets.length + ')'));
    if (targets.length) targets.forEach(function (t) { sec1.appendChild(taskLine(t, selectedDay, true)); });
    else sec1.appendChild(ui.el('div.hint', 'Tidak ada tugas yang dijadwalkan.'));
    p.appendChild(sec1);

    // Overdue relative to this date
    var late = state.tasks.filter(function (t) { return !t.archived && !t.done && t.targetDate < selectedDay; })
      .sort(function (a, b) { return a.targetDate < b.targetDate ? -1 : 1; });
    if (late.length) {
      var sec2 = ui.el('div.dp-sec', ui.el('h3', 'Terlambat per tanggal ini (' + late.length + ')'));
      late.slice(0, 8).forEach(function (t) { sec2.appendChild(taskLine(t, selectedDay, true)); });
      if (late.length > 8) sec2.appendChild(ui.el('div.hint', '+ ' + (late.length - 8) + ' lainnya'));
      p.appendChild(sec2);
    }

    // Completed on this date (first or repeated completion)
    var doneHere = state.tasks.filter(function (t) {
      if (t.firstCompletedAt != null && JF.dates.dayKey(t.firstCompletedAt) === selectedDay) return true;
      if (t.completedAt != null && JF.dates.dayKey(t.completedAt) === selectedDay) return true;
      return false;
    });
    var sec3 = ui.el('div.dp-sec', ui.el('h3', 'Selesai tanggal ini (' + doneHere.length + ')'));
    if (doneHere.length) {
      doneHere.forEach(function (t) {
        var r = ui.el('div.dp-item');
        r.appendChild(ui.el('div.di-name', t.title));
        r.appendChild(ui.el('span.chip.ok', '✓'));
        r.appendChild(ui.btn('Ubah', function () { JF.taskUI.openEdit(t); }, { sm: true, ghost: true }));
        sec3.appendChild(r);
      });
    } else sec3.appendChild(ui.el('div.hint', 'Belum ada penyelesaian pada tanggal ini.'));
    p.appendChild(sec3);

    // Focus summary for the date
    var f = focusFor(selectedDay);
    var t = JF.store.focusTargetFor(state, selectedDay);
    var sec4 = ui.el('div.dp-sec', ui.el('h3', 'Fokus'));
    var g = ui.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } });
    g.appendChild(ui.el('span.chip.accent', 'Resmi: ' + (f ? ui.fmt.dur(f.sec) : '—')));
    g.appendChild(ui.el('span.chip', 'Target: ' + (t.min ? ui.fmt.min(t.min) : 'tidak diketahui')));
    if (f && !f.live) g.appendChild(ui.el('span.chip' + (f.complete ? '.ok' : '.warn'), f.complete ? 'Lengkap' : 'Data tidak lengkap'));
    if (f && f.live) g.appendChild(ui.el('span.chip.lilac', 'berjalan'));
    sec4.appendChild(g);
    p.appendChild(sec4);

    // Per-date target override (does not touch historical finalized targets)
    var curOvr = state.settings.targetOverrides[selectedDay];
    var row = ui.el('div', { style: { display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'flex-end', flexWrap: 'wrap' } });
    var ovrInput = ui.el('input', { type: 'number', min: 1, max: 1440, value: curOvr || t.min || '', style: { width: '110px' }, placeholder: 'menit' });
    row.appendChild(ui.el('label.field', 'Target fokus tanggal ini (menit)', ovrInput));
    row.appendChild(ui.btn('Simpan target', function () {
      var v = Math.round(Number(ovrInput.value));
      var r2 = JF.store.setFocusTargetOverride(state, selectedDay, v, Date.now());
      if (!r2.ok) { ui.toast('Nilai tidak valid.', { kind: 'err' }); return; }
      app.save();
      ui.toast('Target ' + ui.fmt.dateShort(selectedDay) + ' = ' + ui.fmt.min(r2.min) + ' (laporan lama tidak berubah).', { kind: 'ok' });
    }, { primary: true, sm: true }));
    if (curOvr != null) {
      row.appendChild(ui.btn('Hapus target khusus', function () {
        JF.store.clearFocusTargetOverride(state, selectedDay, Date.now());
        app.save(); render();
      }, { sm: true, ghost: true }));
    }
    sec4.appendChild(row);

    var add = ui.btn('+ Tambah tugas pada tanggal ini', function () { JF.taskUI.prefillAdd(selectedDay); }, { ghost: true, block: true });
    add.style.marginTop = '14px';
    p.appendChild(add);
    return p;
  }

  /* ── header & grid ────────────────────────────────────────────────── */
  function renderHead() {
    var head = ui.clear(ui.$('cal-head'));
    var label;
    if (view === 'minggu') {
      var s = startOfWeek(anchor), e = JF.dates.addDays(s, 6);
      label = JF.dates.parseDay(s).d + ' – ' + JF.dates.parseDay(e).d + ' ' + ui.MON_SHORT[JF.dates.parseDay(e).m - 1] + ' ' + JF.dates.parseDay(e).y;
    } else {
      label = ui.monthLabel(anchor);
    }
    head.appendChild(ui.btn('‹', function () {
      if (view === 'minggu') anchor = JF.dates.addDays(anchor, -7);
      else { var p = JF.dates.parseDay(anchor); anchor = JF.dates.buildDay(p.m === 1 ? p.y - 1 : p.y, p.m === 1 ? 12 : p.m - 1, 1); }
      render();
    }, { ghost: true, sm: true, title: 'Sebelumnya' }));
    head.appendChild(ui.el('div.range', label));
    head.appendChild(ui.btn('›', function () {
      if (view === 'minggu') anchor = JF.dates.addDays(anchor, 7);
      else { var p = JF.dates.parseDay(anchor); anchor = JF.dates.buildDay(p.m === 12 ? p.y + 1 : p.y, p.m === 12 ? 1 : p.m + 1, 1); }
      render();
    }, { ghost: true, sm: true, title: 'Berikutnya' }));
    head.appendChild(ui.btn('Hari ini', function () { anchor = app.today(); render(); }, { ghost: true, sm: true }));
    head.appendChild(ui.el('span.sp'));

    var seg = ui.el('div.seg');
    seg.appendChild(ui.el('button' + (view === 'minggu' ? '.on' : ''), { type: 'button', onclick: function () { view = 'minggu'; render(); } }, 'Mingguan'));
    seg.appendChild(ui.el('button' + (view === 'bulan' ? '.on' : ''), { type: 'button', onclick: function () { view = 'bulan'; render(); } }, 'Bulanan'));
    head.appendChild(seg);
  }

  function renderGrid() {
    var wrap = ui.clear(ui.$('cal-gridwrap'));
    var grid = ui.el('div.cal-grid' + (view === 'bulan' ? '.month' : '.week'));
    ui.DOW_SHORT.forEach(function (d) { grid.appendChild(ui.el('div.cal-dow', d)); });

    if (view === 'minggu') {
      var s = startOfWeek(anchor);
      for (var i = 0; i < 7; i++) grid.appendChild(cellFor(JF.dates.addDays(s, i), false));
    } else {
      var ms = startOfMonth(anchor);
      var ws = startOfWeek(ms);
      var mp = JF.dates.parseDay(ms);
      for (var w = 0; w < 6; w++) {
        for (var dd = 0; dd < 7; dd++) {
          var day = JF.dates.addDays(ws, w * 7 + dd);
          var pp = JF.dates.parseDay(day);
          grid.appendChild(cellFor(day, pp.m !== mp.m || pp.y !== mp.y));
        }
      }
    }
    wrap.appendChild(grid);
  }

  function renderPanel() {
    var slot = ui.clear(ui.$('cal-panel'));
    if (selected) slot.appendChild(panel(selected));
    var layout = ui.$('cal-layout');
    if (layout) layout.classList.toggle('with-panel', !!selected);
  }

  function render() {
    if (!host) return;
    renderHead();
    renderGrid();
    renderPanel();
  }

  JF.pages.register({
    id: 'kalender',
    title: 'Kalender',
    sub: function () { return view === 'minggu' ? 'Tampilan mingguan' : 'Tampilan bulanan'; },
    mount: mount,
    render: render
  });
})(typeof self !== 'undefined' ? self : this);
