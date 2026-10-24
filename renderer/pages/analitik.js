/* Jam Fokus — Analitik: two large graphs (task performance + dashed lilac
   forecast, official focus duration vs per-day target), then statistics.
   Default period: last 7 days, always including today (live data).
   Days with incomplete snapshots are flagged, never treated as zero. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host;
  var days = 7;                       // period selector (default: last 7 days)
  var chartTask = null, chartFocus = null;

  function mount(container) {
    ui = JF.ui; app = JF.app; host = container;

    var head = ui.el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' } });
    var seg = ui.el('div.seg', { id: 'an-seg' });
    [[7, '7 hari'], [14, '14 hari'], [30, '30 hari']].forEach(function (p) {
      seg.appendChild(ui.el('button' + (p[0] === days ? '.on' : ''), {
        type: 'button', dataset: { d: String(p[0]) },
        onclick: function () { days = p[0]; render(); }
      }, p[1]));
    });
    head.appendChild(seg);
    head.appendChild(ui.el('span', { id: 'an-scope', style: { color: 'var(--text-3)', fontSize: '12.5px' } }));
    container.appendChild(head);

    container.appendChild(chartCard('Performa task',
      'Task selesai vs belum selesai per hari. Garis putus-putus lilac = perkiraan laju ke depan.',
      'an-c1', [
        { name: 'Task selesai', color: '#7FBFA3' },
        { name: 'Belum selesai', color: '#E0B56B' },
        { name: 'Perkiraan (perkiraan, bukan hasil)', color: '#B4A5D8', dashed: true },
        { name: 'Data tidak lengkap', color: '#E0B56B', kind: '.box' }
      ]));

    container.appendChild(chartCard('Fokus resmi vs target',
      'Durasi fokus resmi per hari (batang) dibanding target harian (garis). Hari diarsir = datanya tidak lengkap.',
      'an-c2', [
        { name: 'Fokus resmi', color: '#E58B96', kind: '.box' },
        { name: 'Target harian', color: '#7FBFA3' },
        { name: 'Batang diarsir = data tidak lengkap', color: '#E0B56B', kind: '.box' }
      ]));

    container.appendChild(ui.el('div.stat-strip', { id: 'an-stats' }));
    container.appendChild(ui.el('div.card', { id: 'an-fc' }));

    chartTask = JF.charts.render(ui.$('an-c1'), specTask);
    chartFocus = JF.charts.render(ui.$('an-c2'), specFocus);
    render();
  }

  function chartCard(title, sub, id, legendSpec) {
    var c = ui.el('div.card.chart-card');
    c.appendChild(ui.el('h2', title));
    c.appendChild(ui.el('div.sub', sub));
    c.appendChild(ui.el('div.chart-wrap', ui.el('canvas', { id: id })));
    var leg = ui.el('div.chart-legend');
    legendSpec.forEach(function (L) {
      var sw = ui.el('span.sw' + (L.kind || ''), { style: { color: L.color || null } });
      if (!L.dashed) sw.style.background = L.color;
      leg.appendChild(ui.el('span.li', sw, L.name));
    });
    c.appendChild(leg);
    return c;
  }

  /* ── data assembly (finalized snapshots + live today; never invented) ── */
  function snapshotFor(d) {
    var ss = app.rawState().snapshots;
    for (var i = 0; i < ss.length; i++) if (ss[i].date === d) return ss[i];
    return null;
  }
  function periodDays() {
    var t = app.today(), out = [];
    for (var i = days - 1; i >= 0; i--) out.push(JF.dates.addDays(t, -i));
    return out;
  }
  function dayData(d) {
    var snap = snapshotFor(d);
    if (snap) return {
      date: d, completed: snap.completedTaskIds.length, unfinished: snap.unfinishedTaskIds.length,
      official: snap.officialFocusSec, target: snap.targetMin,
      complete: snap.complete, legacy: !!snap.legacy, live: false
    };
    if (d === app.today()) {
      var now = Date.now();
      var open = 0;
      app.rawState().tasks.forEach(function (t) { if (!t.archived && !t.done && t.createdAt <= now) open++; });
      var ts = app.todayStats();
      return { date: d, completed: app.dailyCompletions(d), unfinished: open, official: ts.officialSec, target: ts.target.min, complete: false, live: true };
    }
    return { date: d, unknown: true };        // before any data existed
  }
  function shortLabel(d) {
    var p = JF.dates.parseDay(d);
    return p.d + ' ' + ui.MON_SHORT[p.m - 1];
  }
  function labelsAndRows(withFuture) {
    var f = JF.forecast.compute(app.rawState(), app.today());
    var labels = [], rows = [], todayIdx = -1;
    periodDays().forEach(function (d) {
      labels.push(shortLabel(d));
      rows.push(dayData(d));
      if (d === app.today()) todayIdx = labels.length - 1;
    });
    if (withFuture && f.ready) {
      for (var i = 1; i <= 7; i++) {
        var d2 = JF.dates.addDays(app.today(), i);
        labels.push(shortLabel(d2));
        rows.push({ date: d2, future: true });
      }
    }
    return { labels: labels, rows: rows, todayIdx: todayIdx, forecast: f };
  }
  function incompleteNotes(rows) {
    var notes = {};
    rows.forEach(function (x, i) {
      if (!x.future && !x.live && !x.unknown && x.complete === false) {
        notes[i] = 'Data tidak lengkap — berasal dari catatan yang tersisa, bukan nol.';
      }
    });
    return notes;
  }

  /* ── chart specs ──────────────────────────────────────────────────── */
  function specTask() {
    var lr = labelsAndRows(true);
    var today = app.today();
    var projRate = null;
    if (lr.forecast.ready) projRate = lr.forecast.allDone ? 0 : lr.forecast.ratePerDay;
    var selesai = [], belum = [], proj = [];
    lr.rows.forEach(function (x) {
      selesai.push(x.future ? null : x.completed);
      belum.push(x.future ? null : x.unfinished);
      proj.push(projRate != null && x.date >= today ? projRate : null);
    });
    return {
      labels: lr.labels,
      markToday: lr.todayIdx,
      pointNotes: incompleteNotes(lr.rows),
      tipFormat: function (v) { var r = Math.round(v * 10) / 10; return (r % 1 === 0 ? r : String(r).replace('.', ',')) + ' task'; },
      emptyText: 'Belum ada data',
      series: [
        { type: 'line', name: 'Task selesai', color: '#7FBFA3', values: selesai },
        { type: 'line', name: 'Belum selesai', color: '#E0B56B', values: belum },
        { type: 'line', name: 'Perkiraan', color: '#B4A5D8', values: proj, dashed: true, dots: false }
      ]
    };
  }
  function specFocus() {
    var lr = labelsAndRows(false);
    var bars = [], target = [];
    lr.rows.forEach(function (x) {
      bars.push(x.future ? null : x.official);
      target.push(x.target != null ? x.target * 60 : null);   // no target -> null (not zero)
    });
    return {
      labels: lr.labels,
      markToday: lr.todayIdx,
      pointNotes: incompleteNotes(lr.rows),
      yFormat: function (v) { return ui.fmt.durShort(v); },
      tipFormat: function (v) { return ui.fmt.dur(v); },
      emptyText: 'Belum ada data',
      series: [
        { type: 'bar', name: 'Fokus resmi', color: '#E58B96', values: bars, hatch: true },
        { type: 'line', name: 'Target harian', color: '#7FBFA3', values: target, width: 2, dots: false }
      ]
    };
  }

  /* ── statistics ───────────────────────────────────────────────────── */
  function windowRange() {
    var ds = periodDays();
    return { start: JF.dates.startOfDay(ds[0]), end: JF.dates.startOfDay(app.today()) + 86400000 };
  }
  function firstCompletionsInWindow() {
    var w = windowRange(), n = 0;
    app.rawState().tasks.forEach(function (t) {
      if (t.firstCompletedAt != null && t.firstCompletedAt >= w.start && t.firstCompletedAt < w.end) n++;
    });
    return n;                                   // unique tasks: re-completions never double-count
  }
  function achievement() {
    var sumTar = 0, noTarget = 0;
    periodDays().forEach(function (d) {
      var x = dayData(d);
      if (x.unknown) return;
      if (x.target != null) sumTar += x.target * 60;
      else noTarget++;
    });
    var off = JF.sessions.officialSeconds(app.rawState().sessions, windowRange().start, windowRange().end);
    return { off: off, tar: sumTar, noTarget: noTarget, pct: sumTar > 0 ? Math.round(off / sumTar * 100) : null };
  }

  function stat(k, v, u, cls) {
    var n = ui.el('div.stat');
    n.appendChild(ui.el('div.k', k));
    n.appendChild(ui.el('div.v' + (cls ? '.' + cls : ''), v));
    if (u) n.appendChild(ui.el('div.u', u));
    return n;
  }

  function renderStats() {
    var box = ui.clear(ui.$('an-stats'));
    var state = app.rawState();
    var w = windowRange();
    var periodNote = days + ' hari terakhir';

    // 1. unique first completions in period
    box.appendChild(stat('Task pertama kali selesai', String(firstCompletionsInWindow()),
      periodNote + ' · task unik; penyelesaian ulang tidak dihitung ganda', 'ok'));

    // 2. currently open work (live, not period-bound)
    var active = JF.store.activeTasks(state, app.today());
    var upcoming = JF.store.upcomingTasks(state, app.today());
    var overdue = JF.store.overdueTasks(state, app.today());
    box.appendChild(stat('Task aktif saat ini', String(active.length),
      'terlambat: ' + overdue.length + ' · mendatang: ' + upcoming.length, active.length ? 'accent' : ''));

    // 3. official focus in period (completed sessions only)
    var offSec = JF.sessions.officialSeconds(state.sessions, w.start, w.end);
    box.appendChild(stat('Total fokus resmi', ui.fmt.dur(offSec),
      periodNote + ' · rata-rata ' + ui.fmt.dur(Math.round(offSec / days)) + '/hari'));

    // 4. target achievement (days without a target are excluded, not zeroed)
    var a = achievement();
    box.appendChild(stat('Pencapaian target', a.pct != null ? a.pct + '%' : '—',
      a.pct != null
        ? ui.fmt.dur(a.off) + ' dari ' + ui.fmt.dur(a.tar) + ' target' + (a.noTarget ? ' · ' + a.noTarget + ' hari tanpa target tidak dihitung' : '')
        : 'Tidak ada target tercatat pada periode ini — target tidak diketahui, bukan nol',
      a.pct != null ? (a.pct >= 100 ? 'ok' : '') : ''));
  }

  function renderForecast() {
    var box = ui.clear(ui.$('an-fc'));
    var f = JF.forecast.compute(app.rawState(), app.today());
    var d = JF.forecast.describe(f);
    box.appendChild(ui.el('h2', 'Perkiraan'));
    box.appendChild(ui.el('div', { style: { fontSize: '15px', fontWeight: '700', margin: '4px 0 6px' } }, d.title));
    box.appendChild(ui.el('div', d.body));
    var meta = ui.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } });
    meta.appendChild(ui.el('span.chip', 'Hari aktif: ' + f.activeDays + ' (min ' + f.minDays + ')'));
    meta.appendChild(ui.el('span.chip' + (f.ratePerDay != null ? '.accent' : ''),
      'Laju: ' + (f.ratePerDay != null ? f.ratePerDay + ' task/hari' : '—')));
    meta.appendChild(ui.el('span.chip', 'Sisa task: ' + f.remainingCount));
    if (f.etaDate) meta.appendChild(ui.el('span.chip.ok', 'Perkiraan selesai: ' + ui.fmt.date(f.etaDate)));
    box.appendChild(meta);
    box.appendChild(ui.el('div.hint', { style: { marginTop: '10px' } },
      'Perkiraan hanya memakai hari yang datanya lengkap. Hari dengan data tidak lengkap tidak dianggap ' +
      '"hari tanpa produktivitas", dan angka di sini adalah perkiraan, bukan hasil aktual.'));
  }

  function render() {
    if (!host) return;
    Array.prototype.forEach.call(host.querySelectorAll('#an-seg button'), function (b) {
      b.classList.toggle('on', +b.dataset.d === days);
    });
    var scope = ui.$('an-scope');
    if (scope) {
      var f = JF.forecast.compute(app.rawState(), app.today());
      scope.textContent = days + ' hari terakhir' + (f.ready ? ' + 7 hari ke depan (perkiraan)' : '');
    }
    if (chartTask) chartTask.redraw();
    if (chartFocus) chartFocus.redraw();
    renderStats();
    renderForecast();
  }

  JF.pages.register({
    id: 'analitik',
    title: 'Analitik',
    sub: function () {
      var f = app ? JF.forecast.compute(app.rawState(), app.today()) : null;
      return f ? (f.ready ? 'Perkiraan: laju ' + (f.ratePerDay != null ? f.ratePerDay : 0) + ' task/hari' : 'Belum cukup data untuk perkiraan') : '';
    },
    mount: mount,
    render: render
  });
})(typeof self !== 'undefined' ? self : this);
