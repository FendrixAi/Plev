/* Jam Fokus — Riwayat Fokus: every session (running/paused/terminated/
   completed) with real durations, pauses and official contribution.
   Legacy sessions imported from v1 are clearly marked. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host;
  var filt = 'semua';
  var limit = 120;

  function mount(container) {
    ui = JF.ui; app = JF.app; host = container;

    var head = ui.el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' } });
    var tabs = ui.el('div.tabs');
    [['semua', 'Semua'], ['selesai', 'Selesai'], ['putus', 'Terputus']].forEach(function (p) {
      var b = ui.btn(p[1], function () { filt = p[0]; limit = 120; render(); });
      b.dataset.f = p[0];
      tabs.appendChild(b);
    });
    head.appendChild(tabs);
    head.appendChild(ui.el('span.grow', { style: { flex: 1 } }));
    head.appendChild(ui.el('div', { id: 'rh-sum', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }));
    container.appendChild(head);

    container.appendChild(ui.el('div.hint', { style: { marginBottom: '12px' } },
      'Hanya sesi yang benar-benar mencapai target waktunya yang dihitung ke total fokus. ' +
      'Waktu jeda dan sesi terputus tetap tersimpan, tetapi tidak masuk total fokus. ' +
      'Sesi dari data lama ditandai "Data lama".'));

    container.appendChild(ui.el('div', { id: 'rh-list' }));
    container.appendChild(ui.el('div', { id: 'rh-more', style: { marginTop: '12px', textAlign: 'center' } }));
  }

  function stateChip(s) {
    if (s.state === 'completed') return ui.el('span.chip.ok', 'Selesai');
    if (s.state === 'interrupted') return ui.el('span.chip.danger', 'Terputus');
    if (s.state === 'paused') return ui.el('span.chip.warn', 'Dijeda');
    return ui.el('span.chip.accent', 'Berjalan');
  }

  function row(s) {
    var r = ui.el('div.hist-row');
    var name = ui.el('div.hname');
    name.appendChild(ui.el('div.hn', s.taskName || '(Tanpa tugas)'));
    var range = ui.fmt.time(s.startedAt) + ' – ' + (s.endedAt ? ui.fmt.time(s.endedAt) : '·');
    if (s.completedAt) range += ' · selesai ' + ui.fmt.time(s.completedAt);
    name.appendChild(ui.el('div.ht', range));
    if (s.taskId && app.findTask(s.taskId)) name.appendChild(ui.el('div.ht', 'target: ' + ui.fmt.dateShort(app.findTask(s.taskId).targetDate)));
    r.appendChild(name);

    var nums = ui.el('div.hnums');
    var f = ui.el('div.hn2', ui.el('div.k', 'Fokus'), ui.el('div.v' + (s.contributesToOfficial ? '.ok' : ''), ui.fmt.durShort(s.activeSec)));
    var p = ui.el('div.hn2', ui.el('div.k', 'Jeda'), ui.el('div.v' + (s.pausedSec > 0 ? '' : '.muted'), ui.fmt.durShort(s.pausedSec)));
    var t = ui.el('div.hn2', ui.el('div.k', 'Target'), ui.el('div.v.muted', ui.fmt.durShort(s.plannedSec)));
    nums.appendChild(f); nums.appendChild(p); nums.appendChild(t);
    var chips = ui.el('div.hn2', { style: { display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' } });
    if (s.legacy) chips.appendChild(ui.el('span.chip.outline', { title: 'Dipindahkan dari riwayat lama' }, 'Data lama'));
    if (s.state === 'completed') chips.appendChild(ui.el('span.chip.ok', 'Terhitung'));
    else if (s.state === 'interrupted') chips.appendChild(ui.el('span.chip.danger', 'Tidak terhitung'));
    else chips.appendChild(stateChip(s));
    nums.appendChild(chips);
    r.appendChild(nums);
    return r;
  }

  function render() {
    if (!host) return;
    var list = ui.$('rh-list'), sum = ui.$('rh-sum'), more = ui.$('rh-more');
    if (!list) return;
    ui.clear(list); ui.clear(sum); ui.clear(more);

    Array.prototype.forEach.call(document.querySelectorAll('#page-riwayat .tabs button'), function (b) {
      b.classList.toggle('on', b.dataset.f === filt);
    });

    var state = app.rawState();
    var all = state.sessions.slice().sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
    var totalSec = 0, totalDone = 0, totalPutus = 0;
    all.forEach(function (s) {
      if (s.state === 'completed') { totalDone++; totalSec += s.plannedSec; }
      if (s.state === 'interrupted') totalPutus++;
    });
    [
      [totalDone + ' sesi selesai', 'ok'],
      [ui.fmt.dur(totalSec) + ' total fokus', 'accent'],
      [totalPutus + ' terputus', 'danger']
    ].forEach(function (p) { sum.appendChild(ui.el('span.chip.' + p[1], p[0])); });

    var shown = all.filter(function (s) {
      if (filt === 'selesai') return s.state === 'completed';
      if (filt === 'putus') return s.state === 'interrupted';
      return true;
    });

    if (!shown.length) {
      list.appendChild(ui.el('div.empty',
        ui.el('span.big', filt === 'semua' ? 'Belum ada sesi fokus' : 'Tidak ada sesi pada filter ini'),
        filt === 'semua' ? 'Mulai dari Beranda — setiap sesi akan tercatat di sini dengan durasi sebenarnya.' : 'Ganti filter untuk melihat sesi lain.'));
      return;
    }

    var visible = shown.slice(0, limit);
    var curDay = null, dayBox = null;
    var windowCache = {};

    visible.forEach(function (s) {
      var d = JF.dates.dayKey(s.startedAt);
      if (d !== curDay) {
        curDay = d;
        if (windowCache[d] == null) {
          var st = JF.dates.startOfDay(d), en = st + 86400000;
          windowCache[d] = JF.sessions.officialSeconds(state.sessions, st, en);
        }
        var dayOfficial = windowCache[d];
        var head = ui.el('div.day-head');
        head.appendChild(ui.el('h3', ui.fmt.date(d)));
        head.appendChild(ui.el('span.ds', ui.dayRel(d) + ' · fokus ' + ui.fmt.dur(dayOfficial)));
        list.appendChild(head);
        dayBox = ui.el('div');
        list.appendChild(dayBox);
      }
      dayBox.appendChild(row(s));
    });

    if (shown.length > visible.length) {
      var b = ui.btn('Tampilkan lebih banyak (' + (shown.length - visible.length) + ' tersisa)', function () {
        limit += 120; render();
      }, { ghost: true, block: true });
      more.appendChild(b);
    }
  }

  JF.pages.register({
    id: 'riwayat',
    title: 'Riwayat fokus',
    sub: function () {
      var n = app ? app.rawState().sessions.length : 0;
      return n + ' sesi tercatat';
    },
    mount: mount,
    render: render
  });
})(typeof self !== 'undefined' ? self : this);
