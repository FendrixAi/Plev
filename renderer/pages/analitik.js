/* Jam Fokus — Analitik: one dashboard for tasks, focus sessions, targets,
   goals & milestones, and journaling, over daily/weekly/monthly/yearly or a
   custom range. All numbers come from JF.analytics (read-only, tested);
   this file only renders. Unknown/incomplete data is shown as such, never as zero. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host, body;
  var kind = 'week', anchor = null, custom = { from: null, to: null };
  var filters = { goalId: '', priority: 'all', sessionStatus: 'completed' };
  var res = null, charts = [];
  var els = {};

  var KIND_LABEL = [['day', 'Harian'], ['week', 'Mingguan'], ['month', 'Bulanan'], ['year', 'Tahunan'], ['custom', 'Kustom']];
  var PRI = [['all', 'Semua prioritas'], ['high', 'Tinggi'], ['normal', 'Normal'], ['low', 'Rendah']];
  var SES = [['completed', 'Sesi selesai'], ['interrupted', 'Sesi terputus'], ['all', 'Semua sesi']];

  function A() { return JF.analytics; }
  function C(name) { return JF.theme.css(name); }

  function currentPeriod() { return A().period(kind, anchor, app.today(), custom); }

  /* ── toolbar (built once; values refreshed each render) ──────────── */
  function select(opts, value, label, onChange) {
    var s = ui.el('select', { 'aria-label': label });
    opts.forEach(function (o) { var op = ui.el('option', { value: o[0] }, o[1]); if (o[0] === value) op.selected = true; s.appendChild(op); });
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }

  function mount(container) {
    ui = JF.ui; app = JF.app; host = container;
    anchor = app.today();
    var bar = ui.el('div.an-toolbar', { role: 'region', 'aria-label': 'Pengaturan periode dan filter' });

    var r1 = ui.el('div.an-row');
    els.seg = ui.el('div.seg', { id: 'an-seg', role: 'group', 'aria-label': 'Jenis periode' });
    KIND_LABEL.forEach(function (k) {
      els.seg.appendChild(ui.el('button', { type: 'button', dataset: { k: k[0] }, 'aria-pressed': 'false',
        onclick: function () { kind = k[0]; if (kind !== 'custom') anchor = app.today(); render(); } }, k[1]));
    });
    r1.appendChild(els.seg);
    els.nav = ui.el('div.an-nav');
    els.prev = ui.btn(ui.svg(ui.ICON.chevL, 16), function () { anchor = A().shift(kind, anchor, -1); render(); }, { ghost: true, sm: true, title: 'Periode sebelumnya' });
    els.prev.setAttribute('aria-label', 'Periode sebelumnya');
    els.next = ui.btn(ui.svg(ui.ICON.chevR, 16), function () { anchor = A().shift(kind, anchor, 1); render(); }, { ghost: true, sm: true, title: 'Periode berikutnya' });
    els.next.setAttribute('aria-label', 'Periode berikutnya');
    els.now = ui.btn('Saat ini', function () { anchor = app.today(); render(); }, { ghost: true, sm: true });
    els.nav.appendChild(els.prev); els.nav.appendChild(els.now); els.nav.appendChild(els.next);
    r1.appendChild(els.nav);
    els.custom = ui.el('div.an-custom');
    els.from = ui.el('input', { type: 'date', 'aria-label': 'Tanggal awal' });
    els.to = ui.el('input', { type: 'date', 'aria-label': 'Tanggal akhir' });
    function onCustom() { if (JF.dates.isDayKey(els.from.value) && JF.dates.isDayKey(els.to.value)) { custom = { from: els.from.value, to: els.to.value }; render(); } }
    els.from.addEventListener('change', onCustom); els.to.addEventListener('change', onCustom);
    els.custom.appendChild(els.from); els.custom.appendChild(ui.el('span.hint', 's/d')); els.custom.appendChild(els.to);
    r1.appendChild(els.custom);
    bar.appendChild(r1);

    var r2 = ui.el('div.an-row');
    els.label = ui.el('h2.an-label', { id: 'an-label', 'aria-live': 'polite' });
    els.chip = ui.el('span.chip.warn', 'Periode berjalan');
    els.fchip = ui.el('span.chip.accent', 'Filter aktif');
    r2.appendChild(els.label); r2.appendChild(els.chip); r2.appendChild(els.fchip);
    bar.appendChild(r2);

    var r3 = ui.el('div.an-filters');
    els.goalSel = select([['', 'Semua goal']], '', 'Filter goal', function (v) { filters.goalId = v; render(); });
    r3.appendChild(ui.el('label', 'Goal', els.goalSel));
    r3.appendChild(ui.el('label', 'Prioritas', select(PRI, filters.priority, 'Filter prioritas', function (v) { filters.priority = v; render(); })));
    r3.appendChild(ui.el('label', 'Sebaran sesi', select(SES, filters.sessionStatus, 'Status sesi untuk grafik sebaran', function (v) { filters.sessionStatus = v; render(); })));
    var exp = ui.btn('Ekspor CSV', exportCSV, { ghost: true, sm: true });
    exp.appendChild(ui.svg(ui.ICON.down, 14));
    r3.appendChild(exp);
    bar.appendChild(r3);
    container.appendChild(bar);

    body = ui.el('div', { id: 'an-body' });
    container.appendChild(body);
  }

  function refreshToolbar(per) {
    Array.prototype.forEach.call(els.seg.querySelectorAll('button'), function (b) {
      var on = b.dataset.k === kind; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    });
    els.nav.hidden = kind === 'custom';
    els.custom.hidden = kind !== 'custom';
    els.from.value = per.from; els.to.value = per.to;
    els.next.disabled = per.incomplete || per.future;
    els.now.disabled = per.incomplete;
    els.label.textContent = A().label(per) + ' · ' + per.days + ' hari';
    els.chip.hidden = !per.incomplete;
    els.fchip.hidden = !(filters.goalId || filters.priority !== 'all');
    // goal options follow saved goals; a deleted/archived selection falls back to "all".
    var list = JF.goals.list(app.rawState()).filter(function (g) { return !g.archived; });
    if (filters.goalId && !list.some(function (g) { return g.id === filters.goalId; })) filters.goalId = '';
    var sig = JSON.stringify(list.map(function (g) { return [g.id, g.title]; }));
    if (els.goalSel.dataset.sig !== sig) {
      ui.clear(els.goalSel);
      els.goalSel.appendChild(ui.el('option', { value: '' }, 'Semua goal'));
      list.forEach(function (g) { els.goalSel.appendChild(ui.el('option', { value: g.id }, g.title)); });
      els.goalSel.dataset.sig = sig;
    }
    els.goalSel.value = filters.goalId;
  }

  /* ── formatting helpers ─────────────────────────────────────────── */
  function fmtDur(sec) { return sec == null ? '—' : ui.fmt.dur(sec); }
  function pct(r) { return r == null ? '—' : Math.round(r * 100) + '%'; }
  function bucketLabel(b) {
    if (res.period.bucket === 'month') { var p = b.key.split('-'); return A().MON[+p[1] - 1] + ' ' + p[0].slice(2); }
    var d = JF.dates.parseDay(b.date); return d.d + ' ' + A().MON[d.m - 1];
  }
  function deltaEl(d, unit, invert) {
    if (!d) return null;
    if (d.abs === 0) return ui.el('span.an-delta', '= periode lalu');
    var up = d.abs > 0;
    var txt = (up ? '▲ ' : '▼ ') + (unit === 'dur' ? ui.fmt.durShort(Math.abs(d.abs)) : Math.abs(d.abs) + (unit || '')) + ' vs periode lalu';
    return ui.el('span.an-delta.' + ((up !== !!invert) ? 'up' : 'down'), { title: 'Dibanding ' + res.period.prev.from + ' s/d ' + res.period.prev.to }, txt);
  }
  function kpi(k, v, u, def, d) {
    var box = ui.el('div.stat.an-kpi', { title: def });
    box.appendChild(ui.el('div.k', k));
    var vv = ui.el('div.v', v);
    if (d) vv.appendChild(d);
    box.appendChild(vv);
    box.appendChild(ui.el('div.u', u));
    return box;
  }

  /* ── sections ───────────────────────────────────────────────────── */
  function renderKpis() {
    var c = res.current, g = res.goals;
    var strip = ui.el('section.an-kpis', { 'aria-label': 'Ringkasan periode' });
    if (!c.eligibleDays) {
      body.appendChild(ui.el('div.empty', ui.el('span.big', 'Belum ada data pada periode ini'),
        res.period.future ? 'Periode ini belum dimulai.' : 'Tidak ada catatan sebelum hari pertama aplikasi dipakai. Ini bukan nol, melainkan belum ada data.'));
    }
    strip.appendChild(kpi('Tugas selesai', c.tasksCompleted == null ? '—' : String(c.tasksCompleted),
      'tugas unik yang pertama kali selesai', 'Tugas (tidak diarsipkan) yang penyelesaian pertamanya jatuh di periode ini. Penyelesaian ulang tidak dihitung ganda.',
      deltaEl(res.deltas.tasksCompleted)));
    strip.appendChild(kpi('Tingkat penyelesaian', pct(c.rate.rate),
      c.rate.eligible ? c.rate.done + ' dari ' + c.rate.eligible + ' tugas yang jatuh tempo' : 'Belum ada tugas yang jatuh tempo',
      'Tugas bertanggal target di periode ini (sampai hari ini) yang sudah selesai. Tugas yang jatuh tempo nanti dan belum selesai tidak dihitung gagal.',
      res.deltas.rate ? deltaEl(res.deltas.rate, ' poin') : null));
    var offSec = c.focusSec;
    strip.appendChild(kpi('Fokus tercatat', offSec > 0 ? ui.fmt.dur(offSec) : '—',
      (c.sessionsDone || 0) + ' sesi selesai' + (c.interruptedSec ? ' · ' + ui.fmt.durShort(c.interruptedSec) + ' terputus tidak dihitung' : ''),
      'Durasi sesi berstatus selesai, dihitung pada tanggal selesainya (aturan yang sama dengan Riwayat fokus).',
      deltaEl(res.deltas.focusSec, 'dur')));
    strip.appendChild(kpi('Rata-rata fokus/hari', c.avgFocusPerDay != null ? ui.fmt.dur(c.avgFocusPerDay) : '—',
      c.eligibleDays ? 'dibagi ' + c.eligibleDays + ' hari bercatatan' : 'Belum ada hari bercatatan',
      'Fokus tercatat ÷ hari sejak catatan pertama sampai hari ini dalam periode. Hari sebelum ada data tidak dihitung.'));
    strip.appendChild(kpi('Hari target tercapai', c.targetDays ? c.targetMet + '/' + c.targetDays : '—',
      c.targetDays ? 'hari dengan target tercatat' : 'Target tidak tercatat (bukan nol)',
      'Hari dengan target diketahui (laporan harian, atau pengaturan saat ini untuk hari ini) yang fokusnya ≥ target.'));
    strip.appendChild(kpi('Milestone selesai', String(g.milestonesDoneInPeriod),
      g.active + ' goal aktif · ' + g.overdue.length + ' tenggat terlambat',
      'Milestone yang ditandai selesai pada periode ini (goal yang diarsipkan tidak dihitung).',
      deltaEl({ abs: g.milestonesDoneInPeriod - res.goals.milestonesDonePrev })));
    body.appendChild(strip);
  }

  function renderInsights() {
    var card = ui.el('section.card', { 'aria-labelledby': 'an-ins-h' });
    card.appendChild(ui.el('h2', { id: 'an-ins-h' }, 'Pengamatan'));
    card.appendChild(ui.el('div.sub', 'Disusun dari data tersimpan dengan aturan tetap. Tidak ada klaim sebab-akibat.'));
    var ul = ui.el('ul.an-insights');
    res.insights.forEach(function (it) {
      var li = ui.el('li.an-ins.' + it.kind, ui.el('i', { 'aria-hidden': 'true' }), ui.el('div', ui.el('div.t', it.text), ui.el('div.b', 'Dasar: ' + it.basis)));
      if (it.goalId) li.appendChild(ui.btn('Buka goal', function () { location.hash = '#goals?id=' + encodeURIComponent(it.goalId); }, { ghost: true, sm: true }));
      else li.appendChild(ui.el('span'));
      ul.appendChild(li);
    });
    card.appendChild(ul);
    body.appendChild(card);
  }

  function chartCard(parent, title, sub, legend, specFn, summary, wide) {
    var c = ui.el('section.card.chart-card' + (wide ? '.an-wide' : ''));
    c.appendChild(ui.el('h2', title));
    c.appendChild(ui.el('div.sub', sub));
    var canvas = ui.el('canvas');
    c.appendChild(ui.el('div.chart-wrap', canvas));
    c.appendChild(ui.el('p.sr-only', summary));
    var leg = ui.el('div.chart-legend');
    legend.forEach(function (L) {
      var sw = ui.el('span.sw' + (L.box ? '.box' : '') + (L.dashed ? '.dashed' : ''), { style: { color: L.color } });
      if (!L.dashed) sw.style.background = L.color;
      leg.appendChild(ui.el('span.li', sw, L.name));
    });
    c.appendChild(leg);
    parent.appendChild(c);
    charts.push({ canvas: canvas, spec: function () { var s = specFn(); s.summary = summary; return s; } });
  }

  function notesFor(rows) {
    var n = {};
    rows.forEach(function (b, i) {
      if (b.status === 'incomplete') n[i] = 'Data tidak lengkap — ditampilkan apa adanya, bukan nol.';
      else if (b.status === 'live') n[i] = 'Masih berjalan.';
      else if (b.status === 'nodata') n[i] = 'Belum ada catatan.';
    });
    return n;
  }
  function todayIdx() {
    var key = res.period.bucket === 'month' ? res.today.slice(0, 7) : res.today;
    for (var i = 0; i < res.buckets.length; i++) if (res.buckets[i].key === key) return i;
    return null;
  }

  function renderCharts() {
    var grid = ui.el('div.an-grid');
    var B = res.buckets, labels = B.map(bucketLabel), notes = notesFor(B), mt = todayIdx();
    var c = res.current;
    var countTip = function (v) { return v + ''; };
    chartCard(grid, 'Tugas', 'Tugas selesai per ' + (res.period.bucket === 'month' ? 'bulan' : 'hari') + ' dan tugas yang masih terbuka di akhir hari.', [
      { name: 'Selesai', color: C('--chart-ok'), box: true }, { name: 'Belum selesai (akhir hari)', color: C('--chart-warn') }
    ], function () {
      return { labels: labels, markToday: mt, pointNotes: notes, tipFormat: function (v) { return v + ' tugas'; },
        series: [{ type: 'bar', name: 'Selesai', color: C('--chart-ok'), values: B.map(function (b) { return b.completed; }) },
          { type: 'line', name: 'Belum selesai', color: C('--chart-warn'), values: B.map(function (b) { return b.unfinished; }) }] };
    }, (c.tasksCompleted || 0) + ' tugas selesai pada periode ini.');

    chartCard(grid, 'Fokus vs target', 'Fokus dari sesi selesai dibanding target harian. Hari tanpa target tidak digambar.', [
      { name: 'Fokus', color: C('--chart-bar'), box: true }, { name: 'Target', color: C('--chart-ok') }
    ], function () {
      return { labels: labels, markToday: mt, pointNotes: notes, yFormat: function (v) { return ui.fmt.durShort(v); }, tipFormat: function (v) { return ui.fmt.dur(v); },
        series: [{ type: 'bar', name: 'Fokus', color: C('--chart-bar'), hatch: true, values: B.map(function (b) { return b.focusSec; }) },
          { type: 'line', name: 'Target', color: C('--chart-ok'), dots: false, values: B.map(function (b) { return b.targetMin != null ? b.targetMin * 60 : null; }) }] };
    }, 'Fokus tercatat ' + fmtDur(c.focusSec) + '; target tercapai ' + c.targetMet + ' dari ' + c.targetDays + ' hari bertarget.');

    chartCard(grid, 'Sesi selesai vs terputus', 'Jumlah sesi. Sesi terputus tidak masuk total fokus.', [
      { name: 'Selesai', color: C('--chart-ok'), box: true }, { name: 'Terputus', color: C('--chart-warn'), box: true }
    ], function () {
      return { labels: labels, markToday: mt, pointNotes: notes, tipFormat: function (v) { return v + ' sesi'; },
        series: [{ type: 'bar', name: 'Selesai', color: C('--chart-ok'), values: B.map(function (b) { return b.sessionsDone; }) },
          { type: 'bar', name: 'Terputus', color: C('--chart-warn'), values: B.map(function (b) { return b.sessionsCut; }) }] };
    }, (c.sessionsDone || 0) + ' sesi selesai dan ' + (c.sessionsCut || 0) + ' sesi terputus' + (c.avgSessionSec ? '; rata-rata sesi selesai ' + ui.fmt.dur(c.avgSessionSec) : '') + '.');

    chartCard(grid, 'Milestone selesai', 'Milestone yang ditandai selesai, dari goal yang tidak diarsipkan.', [
      { name: 'Milestone', color: C('--chart-info'), box: true }
    ], function () {
      return { labels: labels, markToday: mt, tipFormat: function (v) { return v + ' milestone'; },
        series: [{ type: 'bar', name: 'Milestone', color: C('--chart-info'), values: res.milestoneTrend }] };
    }, res.goals.milestonesDoneInPeriod + ' milestone selesai pada periode ini.');

    var D = res.distribution, stName = { completed: 'sesi selesai', interrupted: 'sesi terputus (waktu fokus nyata)', all: 'semua sesi' }[filters.sessionStatus];
    var hourLabels = []; for (var h = 0; h < 24; h++) hourLabels.push(String(h).padStart(2, '0'));
    chartCard(grid, 'Fokus per jam', 'Total durasi ' + stName + ' menurut jam selesai.', [{ name: 'Durasi', color: C('--chart-bar'), box: true }], function () {
      return { labels: hourLabels, yFormat: function (v) { return ui.fmt.durShort(v); }, tipFormat: function (v) { return ui.fmt.dur(v); },
        series: [{ type: 'bar', name: 'Durasi', color: C('--chart-bar'), values: D.sessions ? D.hours : hourLabels.map(function () { return null; }) }], emptyText: 'Belum ada sesi' };
    }, D.sessions ? 'Sebaran ' + D.sessions + ' sesi menurut jam.' : 'Belum ada sesi pada periode ini.');
    chartCard(grid, 'Fokus per hari dalam minggu', 'Total durasi ' + stName + ' menurut hari.', [{ name: 'Durasi', color: C('--chart-bar'), box: true }], function () {
      return { labels: A().DOW, yFormat: function (v) { return ui.fmt.durShort(v); }, tipFormat: function (v) { return ui.fmt.dur(v); },
        series: [{ type: 'bar', name: 'Durasi', color: C('--chart-bar'), values: D.sessions ? D.dow : A().DOW.map(function () { return null; }) }] };
    }, D.sessions ? 'Sebaran ' + D.sessions + ' sesi menurut hari dalam minggu.' : 'Belum ada sesi pada periode ini.');
    body.appendChild(grid);
  }

  function renderBreakdowns() {
    var grid = ui.el('div.an-grid');
    // Goals
    var gc = ui.el('section.card.an-wide', { 'aria-labelledby': 'an-goals-h' });
    gc.appendChild(ui.el('div.card-head', ui.el('h2', { id: 'an-goals-h' }, 'Goals'), ui.el('span.grow'),
      ui.btn('Buka Goals', function () { location.hash = '#goals'; }, { ghost: true, sm: true })));
    var G = res.goals;
    if (!G.list.length) gc.appendChild(ui.el('div.hint', 'Belum ada goal aktif. Progres goal dihitung dengan metode masing-masing goal (milestone, tugas, atau target angka).'));
    else {
      var t = ui.el('table.an-table');
      t.appendChild(ui.el('thead', ui.el('tr', ui.el('th', 'Goal'), ui.el('th', 'Progres'), ui.el('th', 'Status'), ui.el('th', 'Tenggat'), ui.el('th', 'Progres terakhir'))));
      var tb = ui.el('tbody');
      G.list.forEach(function (g) {
        var prog = ui.el('td', ui.el('span.an-minibar', { 'aria-hidden': 'true' }, ui.el('i', { style: { width: (g.pct || 0) + '%' } })), g.pct == null ? '—' : g.pct + '%',
          ui.el('div.hint', JF.goals.METHOD_LABEL[g.method]));
        var status = JF.goals.STATUS_LABEL[g.status] + (g.manualComplete ? ' (manual)' : '');
        var dl = g.deadlineInfo ? (g.deadlineInfo.overdue ? 'Terlambat ' + Math.abs(g.deadlineInfo.days) + ' hari' : g.deadlineInfo.days + ' hari lagi') : '—';
        var last = g.method === 'target' ? 'Tidak terlacak (target angka)' : g.lastProgressAt ? ui.fmt.dateShort(JF.dates.dayKey(g.lastProgressAt)) + (g.stale ? ' · tanpa progres ≥ ' + A().STALE_DAYS + ' hari' : '') : (g.stale === null ? 'Belum cukup riwayat' : 'Belum ada');
        tb.appendChild(ui.el('tr',
          ui.el('td', ui.el('button.an-link', { type: 'button', onclick: function () { location.hash = '#goals?id=' + encodeURIComponent(g.id); } }, g.title), g.category ? ui.el('div.hint', g.category) : null),
          prog, ui.el('td', status), ui.el('td', dl), ui.el('td', last)));
      });
      t.appendChild(tb);
      gc.appendChild(ui.el('div.an-table-wrap', t));
    }
    if (G.overdue.length || G.dueSoon.length) {
      gc.appendChild(ui.el('div.hint', { style: { marginTop: '10px' } }, 'Tenggat: ' + G.overdue.length + ' terlambat · ' + G.dueSoon.length + ' dalam 7 hari (goal dan milestone yang belum selesai).'));
    }
    grid.appendChild(gc);

    // Priority
    var pc = ui.el('section.card', { 'aria-labelledby': 'an-pri-h' });
    pc.appendChild(ui.el('h2', { id: 'an-pri-h' }, 'Penyelesaian per prioritas'));
    pc.appendChild(ui.el('div.sub', 'Tugas yang jatuh tempo pada periode ini. Aplikasi tidak menyimpan kategori tugas, jadi rincian kategori tidak tersedia.'));
    var bp = res.current.rate.byPriority, keys = ['high', 'normal', 'low'].filter(function (k) { return bp[k]; });
    if (!keys.length) pc.appendChild(ui.el('div.hint', 'Belum ada tugas yang jatuh tempo.'));
    else {
      var pt = ui.el('table.an-table');
      pt.appendChild(ui.el('thead', ui.el('tr', ui.el('th', 'Prioritas'), ui.el('th.num', 'Selesai'), ui.el('th.num', 'Jatuh tempo'), ui.el('th.num', 'Tingkat'))));
      var pb = ui.el('tbody');
      keys.forEach(function (k) { pb.appendChild(ui.el('tr', ui.el('td', JF.model.PRIORITY_LABEL[k]), ui.el('td.num', String(bp[k].done)), ui.el('td.num', String(bp[k].eligible)), ui.el('td.num', pct(bp[k].rate)))); });
      pt.appendChild(pb);
      pc.appendChild(pt);
    }
    pc.appendChild(ui.el('div.hint', { style: { marginTop: '10px' } }, 'Terlambat saat ini: ' + res.overdueNow + ' tugas. ',
      ui.el('button.an-link', { type: 'button', onclick: function () { location.hash = '#tugas'; } }, 'Buka Tugas')));
    grid.appendChild(pc);

    // Journal
    var J = res.journal;
    var jc = ui.el('section.card', { 'aria-labelledby': 'an-jr-h' });
    jc.appendChild(ui.el('h2', { id: 'an-jr-h' }, 'Konsistensi journaling'));
    jc.appendChild(ui.el('div.sub', 'Hanya keberadaan catatan yang dihitung. Isi jurnal tidak dibaca atau diringkas.'));
    jc.appendChild(ui.el('div', { style: { fontSize: '15px', fontWeight: '600' } },
      J.eligibleDays ? J.entries + ' dari ' + J.eligibleDays + ' hari punya catatan (' + pct(J.rate) + ')' : 'Belum ada hari bercatatan'));
    if (J.linked) jc.appendChild(ui.el('div.hint', J.linked + ' catatan ditautkan ke goal (konteks saja, bukan bukti progres).'));
    if (J.days.length) {
      var dd = ui.el('div.an-days');
      J.days.slice(0, 12).forEach(function (d) {
        dd.appendChild(ui.btn(ui.fmt.dateShort(d.day), function () { location.hash = '#jurnal?date=' + d.day; }, { ghost: true, sm: true, title: 'Buka jurnal ' + d.day }));
      });
      jc.appendChild(dd);
    }
    grid.appendChild(jc);

    // Trend (replaces the old point ETA)
    var tr = res.trend;
    var fc = ui.el('section.card.an-wide', { 'aria-labelledby': 'an-fc-h' });
    fc.appendChild(ui.el('h2', { id: 'an-fc-h' }, 'Perkiraan (bukan hasil)'));
    if (!tr.ready) {
      fc.appendChild(ui.el('div.hint', 'Belum cukup data: butuh minimal ' + tr.min + ' hari dengan laporan lengkap, saat ini ' + tr.observations + '. Hari yang datanya tidak lengkap tidak dihitung sebagai hari tanpa hasil.'));
    } else {
      fc.appendChild(ui.el('div', { style: { fontSize: '16px', fontWeight: '600', margin: '4px 0 6px' } },
        '7 hari ke depan: kira-kira ' + String(tr.next7Low).replace('.', ',') + '–' + String(tr.next7High).replace('.', ',') + ' tugas selesai'));
      fc.appendChild(ui.el('div.hint', 'Rentang = (rata-rata ± simpangan baku) × 7 dari ' + tr.observations + ' hari berlaporan lengkap (' + tr.from + ' s/d ' + tr.to +
        '): rata-rata ' + String(tr.mean).replace('.', ',') + ' tugas/hari, simpangan ' + String(tr.sd).replace('.', ',') + '. Ini gambaran pola masa lalu, bukan janji hasil.'));
    }
    grid.appendChild(fc);
    body.appendChild(grid);
  }

  function renderDefinitions() {
    var d = ui.el('details.card.an-defs');
    d.appendChild(ui.el('summary', 'Definisi metrik dan batasan data'));
    var dl = ui.el('dl');
    [['Rentang tanggal', 'Tanggal lokal perangkat; hari dimulai pukul 00.00. Minggu = Senin–Minggu. Perbandingan memakai periode setara tepat sebelumnya.'],
     ['Tugas selesai', 'Penyelesaian pertama tugas yang tidak diarsipkan. Laporan harian yang sudah final dipakai apa adanya untuk harinya.'],
     ['Tingkat penyelesaian', 'Selesai ÷ tugas bertanggal target di periode (sampai hari ini). Tugas yang jatuh tempo nanti dan belum selesai tidak dihitung.'],
     ['Fokus tercatat', 'Durasi sesi selesai pada tanggal selesainya. Sesi terputus ditampilkan terpisah memakai waktu fokus nyatanya.'],
     ['Target', 'Target dari laporan harian untuk hari yang sudah lewat; pengaturan saat ini hanya untuk hari ini. Target masa lalu tanpa laporan tidak diketahui.'],
     ['Hari bercatatan', 'Hari sejak catatan pertama sampai hari ini. Hari sebelumnya = belum ada data (bukan nol). Hari dengan laporan tidak lengkap ditandai.'],
     ['Goals', 'Progres memakai perhitungan halaman Goals. Status Selesai manual dibedakan dari progres terhitung. Waktu fokus tidak dipakai sebagai bukti capaian.'],
     ['Filter', 'Filter goal = tugas yang ditautkan ke goal itu (dan sesinya). Filter prioritas berlaku untuk tugas dan sesinya. Sesi tanpa tugas tidak ikut saat filter aktif.'],
     ['Estimasi vs aktual', 'Tidak ditampilkan: sesi selesai selalu sama dengan durasi rencananya, sehingga perbandingan itu tidak bermakna.']].forEach(function (x) {
      dl.appendChild(ui.el('dt', x[0])); dl.appendChild(ui.el('dd', x[1]));
    });
    d.appendChild(dl);
    body.appendChild(d);
  }

  function exportCSV() {
    if (!res) return;
    try {
      var blob = new Blob(['\uFEFF' + A().toCSV(res)], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'jam-fokus-analitik-' + res.period.from + '_' + res.period.to + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      ui.toast('CSV analitik diunduh.', { kind: 'ok' });
    } catch (e) { ui.toast('Gagal mengekspor: ' + e.message, { kind: 'err' }); }
  }

  function render() {
    if (!host) return;
    var per = currentPeriod();
    refreshToolbar(per);
    res = A().compute(app.rawState(), { today: app.today(), period: per, filters: { goalId: filters.goalId || null, priority: filters.priority, sessionStatus: filters.sessionStatus } });
    var content = document.getElementById('content'), y = content ? content.scrollTop : 0;
    charts.forEach(function (c) { if (c.chart) c.chart.destroy(); });
    charts = [];
    ui.clear(body);
    renderKpis();
    renderInsights();
    renderCharts();
    renderBreakdowns();
    renderDefinitions();
    charts.forEach(function (c) { c.chart = JF.charts.render(c.canvas, c.spec); c.chart.redraw(); });
    if (content) content.scrollTop = y;
  }

  JF.pages.register({
    id: 'analitik',
    title: 'Analitik',
    sub: function () { return res ? A().label(res.period) + (res.period.incomplete ? ' · periode berjalan' : '') : 'Ringkasan tugas, fokus, goals, dan journaling'; },
    mount: mount,
    render: render
  });
})(typeof self !== 'undefined' ? self : this);
