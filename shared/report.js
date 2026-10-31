/* Jam Fokus — Laporan Excel (Analitik). Turns an analytics result + saved
   data into a workbook model for shared/xlsx.js. Read-only: it never mutates
   state. Same numbers as the dashboard; unavailable data stays empty
   (never a fake zero). Attachment names come from Library relations.
   UMD: browser -> window.JF.report, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./dates.js'), require('./goals.js'), require('./library.js'), require('./analytics.js'), require('./store.js'));
  } else {
    root.JF = root.JF || {};
    root.JF.report = factory(root.JF.dates, root.JF.goals, root.JF.library, root.JF.analytics, root.JF.store);
  }
})(typeof self !== 'undefined' ? self : this, function (dates, goals, library, A, store) {
  'use strict';

  /* ── palette (Jam Fokus mint) ─────────────────────────────────── */
  var C = { dark: '#14503C', mint: '#1F7253', soft: '#E1F1EA', zebra: '#F4F9F7', muted: '#5B6F6A', white: '#FFFFFF' };
  var TONE = {
    good: { bg: '#D5F0DF', color: '#14532D' }, bad: { bg: '#FAD7D2', color: '#9B1C1C' },
    warn: { bg: '#FFEFC2', color: '#7A4F00' }, info: { bg: '#D9E8F9', color: '#1D4E89' },
    neutral: { bg: '#ECEFEE', color: '#44524F' }
  };
  var TYPE_TONE = { pdf: 'bad', document: 'info', spreadsheet: 'good', presentation: 'warn', image: 'neutral', other: 'neutral', link: 'info', note: 'neutral' };
  var DOW_LONG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  function tone(name, extra) { var t = TONE[name] || TONE.neutral; return Object.assign({ bg: t.bg, color: t.color, bold: true, align: 'center', border: true, wrap: true }, extra || {}); }
  var S = {
    title: { bold: true, size: 18, color: C.white, bg: C.dark, indent: 1 },
    subtitle: { italic: true, size: 10, color: C.muted, indent: 1 },
    section: { bold: true, size: 12, color: C.white, bg: C.mint, indent: 1 },
    th: { bold: true, color: C.white, bg: C.dark, align: 'center', wrap: true, border: true },
    label: { bold: true, bg: C.soft, border: true, indent: 1, valign: 'top' },
    note: { italic: true, size: 10, color: C.muted, wrap: true, indent: 1 }
  };
  function td(i, extra) { return Object.assign({ border: true, valign: 'center', bg: i % 2 ? C.zebra : null }, extra || {}); }

  function minutes(sec) { return sec == null ? null : Math.round(sec / 60); }
  function fmtDay(k) { if (!k) return ''; var p = dates.parseDay(k); return p.d + ' ' + A.MON[p.m - 1] + ' ' + p.y; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtTs(ms) { if (ms == null) return ''; var d = new Date(ms); return fmtDay(dates.dayKey(ms)) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtSize(n) {
    if (!(n >= 0)) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function sign(n) { return (n > 0 ? '+' : '') + n; }
  function uniq(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = true; return true; }); }
  function lines(a) { return a.length ? a.join('\n') : '—'; }
  function lineCount(text) { return String(text).split('\n').length; }

  /* ── tiny sheet builder ───────────────────────────────────────── */
  function Sheet(name, tab, cols) { this.name = name; this.tabColor = tab; this.cols = cols; this.rows = []; this.merges = []; this.heights = {}; this.dataBars = []; }
  Sheet.prototype.add = function (cells, h) { this.rows.push(cells); var n = this.rows.length; if (h) this.heights[n] = h; return n; };
  Sheet.prototype.blank = function () { return this.add([]); };
  Sheet.prototype.span = function (text, style, from, to, h) {
    var cells = []; for (var i = 0; i < from; i++) cells.push(null);
    cells.push({ v: text, s: style }); for (var j = from + 1; j <= to; j++) cells.push({ v: '', s: style });
    var n = this.add(cells, h);
    if (to > from) this.merges.push(colRef(from) + n + ':' + colRef(to) + n);
    return n;
  };
  Sheet.prototype.mergeCols = function (n, from, to) { this.merges.push(colRef(from) + n + ':' + colRef(to) + n); };
  function colRef(i) { var s = '', x = i + 1; while (x > 0) { var m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = Math.floor((x - 1) / 26); } return s; }

  function banner(sh, title, sub, ncols) {
    sh.span(title, S.title, 0, ncols - 1, 34);
    sh.span(sub, S.subtitle, 0, ncols - 1, 20);
    sh.blank();
  }

  /* ── data gathering ───────────────────────────────────────────── */
  function docStatus(it, fileStatus) {
    if (!fileStatus) return 'unknown';
    var s = fileStatus[it.fileName];
    if (!s) return 'unknown';
    return s.exists === true ? 'ok' : 'missing';
  }
  function fileLabel(it) { return it.originalName || it.title || it.fileName; }

  function gather(state, res, keep, fileStatus) {
    var per = res.period, today = res.today;
    var startTs = dates.startOfDay(per.from), endTs = dates.startOfDay(dates.addDays(per.to, 1));
    var allGoals = goals.list(state).filter(function (g) { return !g.archived; });
    var goalId = res.filters && res.filters.goalId;
    var shownGoals = allGoals.filter(function (g) { return !goalId || g.id === goalId; });

    // documents (files only), with live Goal → Milestone → Task paths
    var docs = library.query(state, { sort: 'date' }, null).filter(function (it) { return it.type === 'file'; }).map(function (it) {
      return { it: it, paths: library.contextPaths(state, it), status: docStatus(it, fileStatus) };
    }).filter(function (d) { return !goalId || d.paths.some(function (p) { return p.goal && p.goal.id === goalId; }); });

    // focus per task inside the period (completed sessions only, same rule as the dashboard)
    var focusByTask = {};
    (state.sessions || []).forEach(function (s) {
      if (s.state !== 'completed' || !s.contributesToOfficial || !s.taskId) return;
      var at = s.completedAt != null ? s.completedAt : s.endedAt;
      if (at == null || at < startTs || at >= endTs) return;
      focusByTask[s.taskId] = (focusByTask[s.taskId] || 0) + s.plannedSec;
    });

    var tasks = (state.tasks || []).filter(function (t) {
      if (t.archived || (keep && !keep(t.id))) return false;
      var doneIn = t.firstCompletedAt != null && t.firstCompletedAt >= startTs && t.firstCompletedAt < endTs;
      var dueIn = t.targetDate && dates.diffDays(per.from, t.targetDate) >= 0 && dates.diffDays(t.targetDate, per.to) >= 0;
      var late = !t.done && t.targetDate && dates.diffDays(t.targetDate, today) > 0;
      return doneIn || dueIn || late || focusByTask[t.id] > 0;
    });
    var rank = { high: 0, normal: 1, low: 2 };
    tasks.sort(function (a, b) {
      var sa = a.done ? 2 : 0, sb = b.done ? 2 : 0;
      return sa - sb || (rank[a.priority] - rank[b.priority]) || String(a.targetDate).localeCompare(String(b.targetDate));
    });
    return { docs: docs, tasks: tasks, focusByTask: focusByTask, allGoals: allGoals, shownGoals: shownGoals, startTs: startTs, endTs: endTs };
  }

  function taskPlaces(state, t) {
    var gs = [], ms = [];
    goals.list(state).forEach(function (g) {
      if (g.archived) return;
      var loc = goals.locationOf(g, t.id);
      if (loc === undefined) return;
      gs.push(g.title);
      var m = loc ? goals.findMilestone(g, loc) : null;
      ms.push(m ? m.title : '—');
    });
    return { goals: gs, milestones: ms };
  }

  /* ── sheet 1: Ringkasan ───────────────────────────────────────── */
  function summarySheet(state, res, data, ctx) {
    var sh = new Sheet('Ringkasan', '#1F7253', [38, 18, 18, 18, 16, 26]);
    var c = res.current, p = res.previous, per = res.period;
    banner(sh, 'LAPORAN PRODUKTIVITAS — JAM FOKUS', 'Periode ' + A.label(per) + ' · dibuat ' + fmtTs(ctx.now), 6);

    sh.span('INFORMASI LAPORAN', S.section, 0, 5, 24);
    var kindLabel = { day: 'Harian', week: 'Mingguan', month: 'Bulanan', year: 'Tahunan', custom: 'Kustom' }[per.kind] || per.kind;
    var goalName = 'Semua goal';
    if (res.filters && res.filters.goalId) { var g = goals.find(state, res.filters.goalId); goalName = g ? g.title : res.filters.goalId; }
    var pri = res.filters && res.filters.priority && res.filters.priority !== 'all' ? { high: 'Tinggi', normal: 'Normal', low: 'Rendah' }[res.filters.priority] : 'Semua prioritas';
    [
      ['Jenis periode', kindLabel],
      ['Rentang tanggal', fmtDay(per.from) + ' s/d ' + fmtDay(per.to) + ' (' + per.days + ' hari)'],
      ['Status periode', per.incomplete ? 'Periode berjalan (belum lengkap)' : per.future ? 'Periode mendatang' : 'Periode lengkap'],
      ['Filter goal', goalName],
      ['Filter prioritas', pri],
      ['Catatan data', 'Tanda "–" atau sel kosong berarti data tidak tersedia, bukan nol.']
    ].forEach(function (r) {
      var n = sh.add([{ v: r[0], s: S.label }, { v: r[1], s: td(0, { wrap: true, indent: 1 }) }, { v: '', s: td(0) }, { v: '', s: td(0) }, { v: '', s: td(0) }, { v: '', s: td(0) }], 20);
      sh.mergeCols(n, 1, 5);
    });
    sh.blank();

    /* KPI */
    sh.span('RINGKASAN KPI', S.section, 0, 5, 24);
    sh.add(['Metrik', 'Periode Ini', 'Periode Lalu', 'Perubahan', 'Satuan', 'Penilaian'].map(function (h) { return { v: h, s: S.th }; }), 24);
    var kpiRow = 0;
    function kpi(name, cur, prev, unit, o) {
      o = o || {};
      var i = kpiRow++, curCell, prevCell, change = '', verdict, vt = 'neutral';
      var numFmt = o.numFmt || null;
      curCell = { v: cur == null ? '–' : cur, s: td(i, { align: 'center', bold: true, numFmt: typeof cur === 'number' ? numFmt : null }) };
      if (o.valueTone && cur != null) curCell.s = tone(o.valueTone);
      prevCell = { v: prev == null ? '–' : prev, s: td(i, { align: 'center', numFmt: typeof prev === 'number' ? numFmt : null, color: C.muted }) };
      if (cur == null) { verdict = 'Belum ada data'; }
      else if (prev == null || typeof cur !== 'number' || typeof prev !== 'number') { verdict = o.verdict || 'Tanpa pembanding'; vt = o.verdictTone || 'neutral'; }
      else {
        var d = Math.round((cur - prev) * 10) / 10;
        change = d === 0 ? '0' : sign(d);
        var better = o.lower ? d < 0 : d > 0;
        if (d === 0) { verdict = '▬ Tetap'; vt = 'neutral'; }
        else if (better) { verdict = '▲ Membaik'; vt = 'good'; }
        else { verdict = '▼ Memburuk'; vt = 'bad'; }
        if (o.lower && d !== 0) verdict = better ? '▼ Membaik (turun)' : '▲ Memburuk (naik)';
      }
      sh.add([{ v: name, s: td(i, { bold: true, indent: 1, wrap: true }) }, curCell, prevCell,
        { v: change === '' ? '–' : change, s: td(i, { align: 'center' }) }, { v: unit, s: td(i, { align: 'center', color: C.muted }) },
        { v: verdict, s: tone(vt) }], 22);
    }
    var curRate = c.rate && c.rate.rate != null ? Math.round(c.rate.rate * 100) : null;
    var prevRate = p.rate && p.rate.rate != null ? Math.round(p.rate.rate * 100) : null;
    kpi('Tugas selesai (unik)', c.tasksCompleted, p.tasksCompleted, 'tugas');
    kpi('Tingkat penyelesaian', curRate, prevRate, '%', { valueTone: curRate == null ? null : curRate >= 80 ? 'good' : curRate >= 50 ? 'warn' : 'bad' });
    kpi('Fokus tercatat', minutes(c.focusSec), minutes(p.focusSec), 'menit');
    kpi('Rata-rata fokus per hari', minutes(c.avgFocusPerDay), minutes(p.avgFocusPerDay), 'menit');
    kpi('Rata-rata durasi sesi', c.avgSessionSec == null ? null : Math.round(c.avgSessionSec / 6) / 10, p.avgSessionSec == null ? null : Math.round(p.avgSessionSec / 6) / 10, 'menit', { numFmt: '0.0' });
    kpi('Sesi selesai', c.sessionsDone, p.sessionsDone, 'sesi');
    kpi('Sesi terputus', c.sessionsCut, p.sessionsCut, 'sesi', { lower: true });
    kpi('Fokus dari sesi terputus (tidak dihitung)', minutes(c.interruptedSec), minutes(p.interruptedSec), 'menit', { lower: true });
    var tgRatio = c.targetDays > 0 ? c.targetMet / c.targetDays : null;
    kpi('Hari target fokus tercapai', c.targetDays > 0 ? c.targetMet + ' dari ' + c.targetDays : null, null, 'hari', { valueTone: tgRatio == null ? null : tgRatio >= 0.8 ? 'good' : tgRatio >= 0.5 ? 'warn' : 'bad', verdict: tgRatio == null ? '' : Math.round(tgRatio * 100) + '% hari', verdictTone: tgRatio == null ? 'neutral' : tgRatio >= 0.8 ? 'good' : tgRatio >= 0.5 ? 'warn' : 'bad' });
    kpi('Milestone selesai', res.goals.milestonesDoneInPeriod, res.goals.milestonesDonePrev, 'milestone');
    kpi('Goal selesai pada periode ini', res.goals.goalsDoneInPeriod, null, 'goal');
    kpi('Goal aktif / selesai (total)', res.goals.active + ' aktif / ' + res.goals.completed + ' selesai', null, 'goal');
    kpi('Tugas terlambat saat ini', res.overdueNow, null, 'tugas', { valueTone: res.overdueNow === 0 ? 'good' : 'bad', verdict: res.overdueNow === 0 ? '✔ Tidak ada' : '✖ Perlu ditindak', verdictTone: res.overdueNow === 0 ? 'good' : 'bad' });
    var jr = res.journal;
    kpi('Hari jurnal terisi', jr && jr.eligibleDays ? jr.entries + ' dari ' + jr.eligibleDays : null, null, 'hari', { verdict: jr && jr.rate != null ? Math.round(jr.rate * 100) + '% hari' : '' });
    var missing = data.docs.filter(function (d) { return d.status === 'missing'; }).length;
    var withOut = data.tasks.filter(function (t) { return library.attachmentsForTask(state, t.id).length; }).length;
    kpi('File lampiran di Library', data.docs.length, null, 'file', { verdict: withOut + ' tugas punya output', verdictTone: 'info' });
    kpi('File lampiran hilang', ctx.fileStatus ? missing : null, null, 'file', { valueTone: !ctx.fileStatus ? null : missing ? 'bad' : 'good', verdict: !ctx.fileStatus ? '' : missing ? '✖ Periksa Library' : '✔ Semua tersedia', verdictTone: missing ? 'bad' : 'good' });
    sh.blank();

    /* insights */
    sh.span('INSIGHT OTOMATIS', S.section, 0, 5, 24);
    var kinds = { up: ['▲ Naik', 'good'], down: ['▼ Turun', 'bad'], warn: ['⚠ Perhatian', 'warn'], info: ['ℹ Info', 'info'] };
    (res.insights || []).forEach(function (ins, i) {
      var k = kinds[ins.kind] || kinds.info;
      var text = ins.text + (ins.basis ? '\nDasar: ' + ins.basis : '');
      var n = sh.add([{ v: k[0], s: tone(k[1]) }, { v: text, s: td(i, { wrap: true, indent: 1, valign: 'center' }) }, { v: '', s: td(i) }, { v: '', s: td(i) }, { v: '', s: td(i) }, { v: '', s: td(i) }], Math.max(24, 16 * lineCount(text) + 8));
      sh.mergeCols(n, 1, 5);
    });
    if (!(res.insights || []).length) sh.span('Belum ada insight untuk periode ini.', S.note, 0, 5, 20);
    sh.blank();

    /* focus by category */
    sh.span('FOKUS PER KATEGORI GOAL', S.section, 0, 5, 24);
    sh.add(['Kategori', 'Fokus (menit)', 'Porsi dari total fokus'].map(function (h) { return { v: h, s: S.th }; }), 22);
    var cats = res.focusByCategory || [], catStart = sh.rows.length + 1;
    cats.forEach(function (k, i) {
      sh.add([{ v: k.category, s: td(i, { bold: true, indent: 1 }) }, { v: minutes(k.sec), s: td(i, { align: 'center', numFmt: '0' }) },
        { v: c.focusSec ? k.sec / c.focusSec : null, s: td(i, { align: 'center', numFmt: '0%' }) }], 20);
    });
    if (cats.length) sh.dataBars.push({ ref: 'B' + catStart + ':B' + (catStart + cats.length - 1), color: '#63BE9B' });
    else sh.span('Tidak ada sesi selesai pada tugas yang ditautkan ke goal berkategori.', S.note, 0, 5, 20);
    sh.blank();

    /* time pattern */
    sh.span('POLA WAKTU FOKUS (SESI SELESAI & TERPUTUS SESUAI FILTER)', S.section, 0, 5, 24);
    sh.add(['Hari', 'Fokus (menit)'].map(function (h) { return { v: h, s: S.th }; }), 22);
    var dow = res.distribution.dow, dStart = sh.rows.length + 1;
    dow.forEach(function (sec, i) {
      sh.add([{ v: DOW_LONG[i], s: td(i, { bold: true, indent: 1 }) }, { v: minutes(sec), s: td(i, { align: 'center', numFmt: '0' }) }], 20);
    });
    sh.dataBars.push({ ref: 'B' + dStart + ':B' + (dStart + 6), color: '#6BA8E0' });
    var hrs = res.distribution.hours.map(function (sec, h) { return { h: h, sec: sec }; }).filter(function (x) { return x.sec > 0; }).sort(function (a, b) { return b.sec - a.sec; }).slice(0, 3);
    var n2 = sh.add([{ v: 'Jam tersibuk', s: S.label }, { v: hrs.length ? hrs.map(function (x) { return pad(x.h) + ':00–' + pad(x.h) + ':59 (' + minutes(x.sec) + ' mnt)'; }).join('   ·   ') : 'Belum ada data sesi', s: td(0, { indent: 1, wrap: true }) }, { v: '', s: td(0) }, { v: '', s: td(0) }, { v: '', s: td(0) }, { v: '', s: td(0) }], 22);
    sh.mergeCols(n2, 1, 5);
    sh.blank();
    sh.span('Lembar lain: Rincian Harian · Tugas (beserta nama file lampiran) · Goals · Milestone · Lampiran (semua file di Library).', S.note, 0, 5, 20);
    sh.freeze = { row: 3, col: 0 };
    return sh;
  }

  /* ── sheet 2: Rincian Harian ──────────────────────────────────── */
  function dailySheet(res) {
    var sh = new Sheet('Rincian Harian', '#2F8F6B', [20, 16, 12, 12, 14, 14, 14, 12, 12, 16]);
    banner(sh, 'RINCIAN ' + (res.period.bucket === 'month' ? 'BULANAN' : 'HARIAN'), 'Periode ' + A.label(res.period) + ' · fokus dari sesi selesai; sesi terputus dipisah', 10);
    var head = sh.add(['Periode', 'Status Data', 'Tugas Selesai', 'Belum Selesai', 'Fokus (menit)', 'Target (menit)', 'Capaian Target', 'Sesi Selesai', 'Sesi Terputus', 'Fokus Terputus (menit)'].map(function (h) { return { v: h, s: S.th }; }), 36);
    var first = head + 1, labels = { final: ['Lengkap', 'good'], incomplete: ['Tidak lengkap', 'warn'], live: ['Hari ini', 'info'], nodata: ['Tidak ada data', 'neutral'], future: ['Mendatang', 'neutral'] };
    var sums = { c: 0, u: 0, f: 0, t: 0, sd: 0, sc: 0, it: 0 }, hasF = false;
    (res.buckets || []).forEach(function (b, i) {
      var f = minutes(b.focusSec), tg = b.targetMin == null ? null : b.targetMin;
      var cap = f != null && tg ? f / tg : null;
      var capTone = cap == null ? null : cap >= 1 ? 'good' : cap >= 0.5 ? 'warn' : 'bad';
      var lab = labels[b.status] || [b.status, 'neutral'];
      var lbl = res.period.bucket === 'month' ? b.label : fmtDay(b.date || b.key);
      if (res.period.bucket !== 'month') { var pp = dates.parseDay(b.date || b.key); lbl = DOW_LONG[(new Date(pp.y, pp.m - 1, pp.d).getDay() + 6) % 7] + ', ' + fmtDay(b.date || b.key); }
      var num = function (v, extra) { return { v: v == null ? '' : v, s: td(i, Object.assign({ align: 'center', numFmt: '0' }, extra || {})) }; };
      sh.add([{ v: lbl, s: td(i, { bold: true, indent: 1 }) }, { v: lab[0], s: tone(lab[1]) }, num(b.completed), num(b.unfinished), num(f, { bold: true }), num(tg),
        cap == null ? { v: '', s: td(i, { align: 'center' }) } : { v: cap, s: tone(capTone, { numFmt: '0%' }) },
        num(b.sessionsDone), num(b.sessionsCut), num(minutes(b.interruptedSec))], 21);
      if (b.completed != null) sums.c += b.completed;
      if (f != null) { sums.f += f; hasF = true; }
      if (tg != null) sums.t += tg;
      if (b.sessionsDone != null) sums.sd += b.sessionsDone;
      if (b.sessionsCut != null) sums.sc += b.sessionsCut;
      if (b.interruptedSec != null) sums.it += minutes(b.interruptedSec);
    });
    var last = sh.rows.length;
    if (!(res.buckets || []).length) sh.span('Tidak ada data pada periode ini.', S.note, 0, 9, 22);
    else {
      var tot = { bold: true, bg: '#CFE6DC', border: true, align: 'center', numFmt: '0', topBorder: 'medium', borderColor: '#14503C' };
      var capAll = hasF && sums.t ? sums.f / sums.t : null;
      sh.add([{ v: 'TOTAL', s: Object.assign({}, tot, { align: 'left', indent: 1 }) }, { v: '', s: tot },
        { v: sums.c, f: 'SUM(C' + first + ':C' + last + ')', s: tot }, { v: '', s: tot },
        { v: hasF ? sums.f : '', f: 'SUM(E' + first + ':E' + last + ')', s: tot }, { v: sums.t || '', f: 'SUM(F' + first + ':F' + last + ')', s: tot },
        { v: capAll == null ? '' : capAll, f: 'IF(F' + (last + 1) + '>0,E' + (last + 1) + '/F' + (last + 1) + ',"")', s: Object.assign({}, tot, { numFmt: '0%' }) },
        { v: sums.sd, f: 'SUM(H' + first + ':H' + last + ')', s: tot }, { v: sums.sc, f: 'SUM(I' + first + ':I' + last + ')', s: tot }, { v: sums.it, f: 'SUM(J' + first + ':J' + last + ')', s: tot }], 24);
      sh.autoFilter = 'A' + head + ':J' + last;
      sh.dataBars.push({ ref: 'E' + first + ':E' + last, color: '#63BE9B' });
    }
    sh.freeze = { row: head, col: 1 };
    return sh;
  }

  /* ── sheet 3: Tugas ───────────────────────────────────────────── */
  function tasksSheet(state, res, data, ctx) {
    var sh = new Sheet('Tugas', '#3B82C4', [5, 36, 12, 24, 24, 15, 13, 20, 12, 12, 10, 44, 18]);
    banner(sh, 'DAFTAR TUGAS & FILE LAMPIRAN', 'Tugas yang selesai, jatuh tempo, terlambat, atau punya sesi fokus pada ' + A.label(res.period), 13);
    var head = sh.add(['No', 'Tugas', 'Prioritas', 'Goal', 'Milestone', 'Target', 'Status', 'Selesai Pada', 'Fokus (menit)', 'Wajib Output', 'Jumlah File', 'Nama File Lampiran', 'Status File'].map(function (h) { return { v: h, s: S.th }; }), 36);
    var priLabel = { high: ['Tinggi', 'bad'], normal: ['Normal', 'info'], low: ['Rendah', 'neutral'] };
    data.tasks.forEach(function (t, i) {
      var pl = taskPlaces(state, t), files = library.attachmentsForTask(state, t.id);
      var late = !t.done && t.targetDate && dates.diffDays(t.targetDate, res.today) > 0;
      var status = t.done ? ['Selesai', 'good'] : late ? ['Terlambat', 'bad'] : ['Aktif', 'info'];
      var names = files.map(function (f) { return '• ' + fileLabel(f); });
      var stats = files.map(function (f) { return docStatus(f, ctx.fileStatus); });
      var fileStatus;
      if (!files.length) fileStatus = t.requiresOutput && !t.done ? ['✖ Belum ada output', 'bad'] : t.requiresOutput ? ['✖ Output tidak ada', 'bad'] : ['—', 'neutral'];
      else if (stats.indexOf('missing') >= 0) fileStatus = ['✖ ' + stats.filter(function (x) { return x === 'missing'; }).length + ' file hilang', 'bad'];
      else if (stats.indexOf('unknown') >= 0) fileStatus = ['Belum dicek', 'neutral'];
      else fileStatus = ['✔ Tersedia', 'good'];
      var pr = priLabel[t.priority] || priLabel.normal;
      var fileText = lines(names), gt = lines(pl.goals), mt = lines(pl.milestones);
      var h = Math.max(22, 16 * Math.max(lineCount(fileText), lineCount(gt), lineCount(mt), Math.ceil(t.title.length / 34)) + 6);
      sh.add([{ v: i + 1, s: td(i, { align: 'center', color: C.muted }) }, { v: t.title, s: td(i, { bold: true, wrap: true, indent: 1 }) }, { v: pr[0], s: tone(pr[1]) },
        { v: gt, s: td(i, { wrap: true }) }, { v: mt, s: td(i, { wrap: true }) }, { v: fmtDay(t.targetDate), s: td(i, { align: 'center' }) },
        { v: status[0], s: tone(status[1]) }, { v: t.done ? fmtTs(t.completedAt) : '', s: td(i, { align: 'center', wrap: true }) },
        { v: data.focusByTask[t.id] ? minutes(data.focusByTask[t.id]) : '', s: td(i, { align: 'center', numFmt: '0' }) },
        t.requiresOutput ? { v: 'Ya', s: tone('warn') } : { v: 'Tidak', s: td(i, { align: 'center', color: C.muted }) },
        { v: files.length, s: td(i, { align: 'center', numFmt: '0', bold: !!files.length }) }, { v: fileText, s: td(i, { wrap: true, valign: 'center' }) }, { v: fileStatus[0], s: tone(fileStatus[1]) }], h);
    });
    if (!data.tasks.length) sh.span('Tidak ada tugas pada periode dan filter ini.', S.note, 0, 12, 22);
    else {
      sh.autoFilter = 'A' + head + ':M' + sh.rows.length;
    }
    sh.freeze = { row: head, col: 2 };
    return sh;
  }

  /* ── sheet 4: Goals ───────────────────────────────────────────── */
  function goalsSheet(state, res, data, ctx) {
    var sh = new Sheet('Goals', '#C98A1B', [32, 16, 13, 14, 16, 11, 13, 16, 11, 44]);
    banner(sh, 'GOALS & PROGRES', 'Status goal per ' + fmtDay(res.today) + ' · progres sama dengan halaman Goals', 10);
    var head = sh.add(['Goal', 'Kategori', 'Status', 'Progres', 'Deadline', 'Sisa Hari', 'Milestone Terbuka', 'Risiko', 'Jumlah File', 'Nama File Lampiran'].map(function (h) { return { v: h, s: S.th }; }), 36);
    var byId = {}; res.goals.list.forEach(function (g) { byId[g.id] = g; });
    var first = head + 1, n = 0;
    data.shownGoals.forEach(function (g, i) {
      var st = byId[g.id] || {};
      var gd = data.docs.filter(function (d) { return d.paths.some(function (p) { return p.goal && p.goal.id === g.id; }); });
      var status = g.status === 'completed' ? ['Selesai', 'good'] : ['Aktif', 'info'];
      var risk = g.status === 'completed' ? ['—', 'neutral'] : st.deadlineInfo && st.deadlineInfo.overdue ? ['Lewat tenggat', 'bad'] : st.atRisk ? ['Berisiko', 'warn'] : st.stale ? ['Stagnan', 'warn'] : ['Aman', 'good'];
      var names = gd.map(function (d) { return '• ' + fileLabel(d.it) + (d.status === 'missing' ? ' (hilang)' : ''); });
      var txt = lines(names);
      sh.add([{ v: g.title, s: td(i, { bold: true, wrap: true, indent: 1 }) }, { v: g.category || '—', s: td(i, { align: 'center' }) }, { v: status[0], s: tone(status[1]) },
        { v: st.pct == null ? '' : st.pct / 100, s: td(i, { align: 'center', numFmt: '0%', bold: true }) },
        { v: g.deadline ? fmtDay(g.deadline) : '—', s: td(i, { align: 'center' }) },
        { v: st.deadlineInfo ? st.deadlineInfo.days : '', s: td(i, { align: 'center', numFmt: '0' }) },
        { v: st.openMilestones == null ? '' : st.openMilestones, s: td(i, { align: 'center', numFmt: '0' }) }, { v: risk[0], s: tone(risk[1]) },
        { v: gd.length, s: td(i, { align: 'center', numFmt: '0', bold: !!gd.length }) }, { v: txt, s: td(i, { wrap: true }) }], Math.max(22, 16 * lineCount(txt) + 6));
      n++;
    });
    if (!n) sh.span('Belum ada goal.', S.note, 0, 9, 22);
    else { sh.dataBars.push({ ref: 'D' + first + ':D' + (first + n - 1), color: '#63BE9B' }); sh.autoFilter = 'A' + head + ':J' + (first + n - 1); }
    sh.freeze = { row: head, col: 1 };
    return sh;
  }

  /* ── sheet 5: Milestone ───────────────────────────────────────── */
  function milestoneSheet(state, res, data) {
    var sh = new Sheet('Milestone', '#8A5CC9', [30, 32, 13, 20, 11, 12, 13, 11, 44]);
    banner(sh, 'MILESTONE PER GOAL', 'Progres dihitung dari tugas yang tertaut; milestone yang sudah ditandai selesai = 100%', 9);
    var head = sh.add(['Goal', 'Milestone', 'Status', 'Selesai Pada', 'Jumlah Tugas', 'Tugas Selesai', 'Progres', 'Jumlah File', 'Nama File Lampiran'].map(function (h) { return { v: h, s: S.th }; }), 36);
    var first = head + 1, i = 0;
    data.shownGoals.forEach(function (g) {
      g.milestones.forEach(function (m) {
        var tasks = m.taskIds.map(function (id) { return store.find(state, id); }).filter(Boolean);
        var done = tasks.filter(function (t) { return t.done; }).length;
        var pct = m.done ? 1 : tasks.length ? done / tasks.length : 0;
        var md = data.docs.filter(function (d) { return d.paths.some(function (p) { return p.milestone && p.milestone.id === m.id; }); });
        var txt = lines(md.map(function (d) { return '• ' + fileLabel(d.it) + (d.status === 'missing' ? ' (hilang)' : ''); }));
        var st = m.done ? ['Selesai', 'good'] : ['Berjalan', 'info'];
        sh.add([{ v: g.title, s: td(i, { wrap: true, indent: 1, color: C.muted }) }, { v: m.title, s: td(i, { bold: true, wrap: true, indent: 1 }) }, { v: st[0], s: tone(st[1]) },
          { v: m.done ? fmtTs(m.completedAt) : '', s: td(i, { align: 'center', wrap: true }) }, { v: tasks.length, s: td(i, { align: 'center', numFmt: '0' }) },
          { v: done, s: td(i, { align: 'center', numFmt: '0' }) }, { v: pct, s: td(i, { align: 'center', numFmt: '0%', bold: true }) },
          { v: md.length, s: td(i, { align: 'center', numFmt: '0', bold: !!md.length }) }, { v: txt, s: td(i, { wrap: true }) }], Math.max(22, 16 * lineCount(txt) + 6));
        i++;
      });
    });
    if (!i) sh.span('Belum ada milestone.', S.note, 0, 8, 22);
    else { sh.dataBars.push({ ref: 'G' + first + ':G' + (first + i - 1), color: '#B59AE0' }); sh.autoFilter = 'A' + head + ':I' + (first + i - 1); }
    sh.freeze = { row: head, col: 2 };
    return sh;
  }

  /* ── sheet 6: Lampiran ────────────────────────────────────────── */
  function filesSheet(state, res, data) {
    var sh = new Sheet('Lampiran', '#C0504D', [5, 38, 15, 11, 15, 26, 26, 30, 20, 14, 34]);
    banner(sh, 'LAMPIRAN & DOKUMEN LIBRARY', 'Semua file di Library beserta asalnya (Goal → Milestone → Tugas)', 11);
    var head = sh.add(['No', 'Nama File', 'Jenis', 'Ukuran', 'Sumber', 'Goal', 'Milestone', 'Tugas', 'Ditambahkan', 'Status File', 'Deskripsi'].map(function (h) { return { v: h, s: S.th }; }), 36);
    data.docs.forEach(function (d, i) {
      var it = d.it, g = library.typeGroup(it);
      var gs = uniq(d.paths.filter(function (p) { return p.goal; }).map(function (p) { return p.goal.title; }));
      var ms = uniq(d.paths.filter(function (p) { return p.milestone; }).map(function (p) { return p.milestone.title; }));
      var ts = uniq(d.paths.filter(function (p) { return p.task; }).map(function (p) { return p.task.title; }));
      var st = d.status === 'ok' ? ['✔ Tersedia', 'good'] : d.status === 'missing' ? ['✖ Hilang', 'bad'] : ['Belum dicek', 'neutral'];
      var h = Math.max(22, 16 * Math.max(lineCount(lines(gs)), lineCount(lines(ms)), lineCount(lines(ts)), Math.ceil(fileLabel(it).length / 36)) + 6);
      sh.add([{ v: i + 1, s: td(i, { align: 'center', color: C.muted }) }, { v: fileLabel(it), s: td(i, { bold: true, wrap: true, indent: 1 }) },
        { v: library.TYPE_GROUP_LABEL[g], s: tone(TYPE_TONE[g]) }, { v: fmtSize(it.size), s: td(i, { align: 'center' }) },
        { v: library.moduleLabel(it.source.module), s: td(i, { align: 'center' }) }, { v: gs.length ? lines(gs) : 'Dokumen mandiri', s: td(i, { wrap: true, color: gs.length ? null : C.muted }) },
        { v: lines(ms), s: td(i, { wrap: true }) }, { v: lines(ts), s: td(i, { wrap: true }) }, { v: fmtTs(it.createdAt), s: td(i, { align: 'center', wrap: true }) },
        { v: st[0], s: tone(st[1]) }, { v: it.description || '', s: td(i, { wrap: true }) }], h);
    });
    if (!data.docs.length) sh.span('Belum ada file di Library.', S.note, 0, 10, 22);
    else sh.autoFilter = 'A' + head + ':K' + sh.rows.length;
    sh.freeze = { row: head, col: 2 };
    return sh;
  }

  /**
   * state, res = analytics.compute(...), opts = { now?, fileStatus? (fileName -> {exists}) }.
   * Returns the workbook model for JF.xlsx.build().
   */
  function buildReport(state, res, opts) {
    opts = opts || {};
    var ctx = { now: opts.now != null ? opts.now : Date.now(), fileStatus: opts.fileStatus || null };
    var keep = A.taskFilter(state, res.filters);
    var data = gather(state, res, keep, ctx.fileStatus);
    var sheets = [summarySheet(state, res, data, ctx), dailySheet(res), tasksSheet(state, res, data, ctx), goalsSheet(state, res, data, ctx), milestoneSheet(state, res, data), filesSheet(state, res, data)];
    return {
      title: 'Laporan Jam Fokus — ' + A.label(res.period), creator: 'Jam Fokus',
      sheets: sheets.map(function (s) { return { name: s.name, tabColor: s.tabColor, cols: s.cols, rows: s.rows, merges: s.merges, heights: s.heights, freeze: s.freeze, autoFilter: s.autoFilter, dataBars: s.dataBars, landscape: true }; })
    };
  }
  function fileName(res) { return 'jam-fokus-laporan-' + res.period.from + '_' + res.period.to + '.xlsx'; }

  return { buildReport: buildReport, fileName: fileName };
});
