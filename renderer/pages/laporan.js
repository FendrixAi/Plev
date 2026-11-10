/* Jam Fokus — Laporan Harian: finalized daily snapshots (immutable),
   with corrections shown SEPARATELY from the original record. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host;
  var limit = 40;

  /* Cari elemen di wadah halaman yang sedang render (Original atau Mola). */
  function byId(id) { return host ? host.querySelector('#' + id) : null; }

  function mount(container) {
    ui = JF.ui; app = JF.app; host = container;
    container.appendChild(ui.el('div.hint', { style: { marginBottom: '14px' } },
      'Laporan dirangkum otomatis saat hari berganti (pukul 00.00 waktu perangkat) dan bersifat final — ' +
      'catatan hari lama tidak pernah dihitung ulang. Jika ada data terhapus di kemudian hari, ' +
      'koreksi ditampilkan terpisah di bawah laporan, bukan menimpa angka aslinya.'));
    container.appendChild(ui.el('div', { id: 'lp-list' }));
    container.appendChild(ui.el('div', { id: 'lp-more', style: { marginTop: '6px', textAlign: 'center' } }));
  }

  /* Kartu tetap ringkas; rincian tugas (selesai + ringkasan, belum selesai) dibuka dengan "Lihat selengkapnya". */
  var openCards = {};   // kunci kartu -> terbuka; bertahan antar render

  function chevron(open) {
    return ui.svg(open ? '<path d="M6 15l6-6 6 6"/>' : '<path d="M6 9l6 6 6-6"/>', 14, 2.2);
  }

  function detailBlock(completedIds, unfinishedIds, state) {
    var done = (completedIds || []).map(function (id) { return JF.store.find(state, id); })
      .filter(function (t) { return t && t.done; });
    var open = (unfinishedIds || []).map(function (id) { return JF.store.find(state, id); }).filter(Boolean);
    if (!done.length && !open.length) return null;
    var box = ui.el('div.rep-detail');
    if (done.length) {
      box.appendChild(ui.el('div.rep-sub', 'Tugas selesai (' + done.length + ')'));
      done.forEach(function (t) {
        var r = ui.el('div.rep-item', ui.el('div.rep-title', t.title));
        var sb = JF.completion ? JF.completion.summaryBlock(t) : null;
        if (sb) r.appendChild(sb);
        box.appendChild(r);
      });
    }
    if (open.length) {
      box.appendChild(ui.el('div.rep-sub', 'Belum selesai (' + open.length + ')'));
      open.forEach(function (t) { box.appendChild(ui.el('div.rep-item.muted', ui.el('div.rep-title', t.title))); });
    }
    box.appendChild(ui.el('div.hint', { style: { marginTop: '4px' } }, 'Ringkasan ditampilkan dari catatan terbaru; angka laporan tetap final.'));
    return box;
  }

  function attachDetail(card, key, detail) {
    if (!detail) return;
    var label = ui.el('span', ''), arrow = ui.el('span.rep-arrow');
    var btn = ui.el('button.rep-toggle', { type: 'button' }, label, arrow);
    function paint() {
      var isOpen = !!openCards[key];
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      label.textContent = isOpen ? 'Tutup' : 'Lihat selengkapnya';
      ui.clear(arrow); arrow.appendChild(chevron(isOpen));
      detail.style.display = isOpen ? '' : 'none';
    }
    btn.onclick = function () { openCards[key] = !openCards[key]; paint(); };
    paint();
    card.appendChild(btn);
    card.appendChild(detail);
  }

  function kv(k, v, cls) {
    var n = ui.el('div.kv', ui.el('div.k', k), ui.el('div.v' + (cls ? '.' + cls : ''), v));
    return n;
  }

  function todayCard() {
    var st = app.todayStats();
    var c = ui.el('div.report');
    var head = ui.el('div.rh');
    head.appendChild(ui.el('div.rd', ui.fmt.date(st.day)));
    head.appendChild(ui.el('span.chip.accent', 'Hari ini — berjalan'));
    c.appendChild(head);
    c.appendChild(ui.el('div.hint', { style: { marginTop: '4px' } },
      'Angka hari ini masih berubah sampai pukul 00.00 dan belum dikunci.'));
    var g = ui.el('div.rgrid');
    g.appendChild(kv('Target fokus', st.target.min ? ui.fmt.min(st.target.min) : '—', st.target.min ? '' : 'muted'));
    g.appendChild(kv('Fokus', ui.fmt.dur(st.officialSec)));
    g.appendChild(kv('Tugas selesai', String(st.doneToday)));
    g.appendChild(kv('Tugas terlambat', String(st.overdue), st.overdue ? '' : 'muted'));
    c.appendChild(g);
    var todayState = app.rawState();
    var todayDone = todayState.tasks.filter(function (t) { return t.done && t.completedAt && JF.dates.dayKey(t.completedAt) === st.day; })
      .map(function (t) { return t.id; });
    attachDetail(c, 'today', detailBlock(todayDone, [], todayState));
    return c;
  }

  function reportCard(snap, state) {
    var c = ui.el('div.report');
    var head = ui.el('div.rh');
    head.appendChild(ui.el('div.rd', ui.fmt.date(snap.date)));
    if (snap.complete) head.appendChild(ui.el('span.chip.ok', 'Lengkap'));
    else head.appendChild(ui.el('span.chip.warn', 'Data tidak lengkap'));
    if (snap.legacy) head.appendChild(ui.el('span.chip.outline', 'Catatan lama'));
    c.appendChild(head);

    if (!snap.complete) {
      c.appendChild(ui.el('div.hint', { style: { marginTop: '6px' } },
        'Hari ini dirangkum dari catatan yang tersedia (bukan diisi nol). ' +
        'Sebagian data hari itu tidak ikut tercatat, jadi angkanya adalah batas bawah.'));
    }

    var g = ui.el('div.rgrid');
    g.appendChild(kv('Target fokus', snap.targetMin != null ? ui.fmt.min(snap.targetMin) : 'Tidak diketahui', snap.targetMin != null ? '' : 'muted'));
    g.appendChild(kv('Fokus', ui.fmt.dur(snap.officialFocusSec)));
    g.appendChild(kv('Fokus terputus', snap.interruptedFocusSec > 0 ? ui.fmt.dur(snap.interruptedFocusSec) : 'Tidak ada',
      snap.interruptedFocusSec > 0 ? '' : 'muted'));
    g.appendChild(kv('Tugas selesai', String(snap.completedTaskIds.length)));
    g.appendChild(kv('Tugas belum selesai', String(snap.unfinishedTaskIds.length),
      snap.unfinishedTaskIds.length ? '' : 'muted'));
    c.appendChild(g);

    attachDetail(c, snap.date, detailBlock(snap.completedTaskIds, snap.unfinishedTaskIds, state));

    // Corrections are derived and shown separately — the original is untouched.
    var notes = [];
    (snap.completedTaskIds || []).forEach(function (id) {
      var t = JF.store.find(state, id);
      if (!t) return;
      if (!t.done) {
        notes.push('"' + t.title + '" pernah tercatat selesai pada laporan ini, lalu dibuka kembali — ' +
          'status sekarang: belum selesai. Catatan asli tidak diubah.');
      }
    });
    if (notes.length) {
      var box = ui.el('div.corrections');
      box.appendChild(ui.el('div.ch', 'Perubahan sejak laporan dibuat'));
      notes.forEach(function (n) { box.appendChild(ui.el('div.ci', n)); });
      c.appendChild(box);
    }

    c.appendChild(ui.el('div.orig',
      'Catatan asli · dikunci ' + (snap.finalizedAt ? ui.fmt.dateTime(snap.finalizedAt) : '—') +
      (snap.targetSource ? ' · target: ' + (snap.targetSource === 'override' ? 'target khusus per tanggal' :
        snap.targetSource === 'default' ? 'target bawaan' : 'tidak diketahui') : '')));
    return c;
  }

  function render(container) {
    if (container) host = container;
    if (!host) return;
    var list = byId('lp-list'), more = byId('lp-more');
    if (!list) return;
    ui.clear(list); ui.clear(more);

    list.appendChild(todayCard());

    var state = app.rawState();
    var snaps = state.snapshots.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

    if (!snaps.length) {
      list.appendChild(ui.el('div.empty',
        ui.el('span.big', 'Belum ada laporan harian'),
        'Laporan pertama dibuat otomatis setelah hari berganti sejak versi ini mulai dipakai.'));
      return;
    }

    list.appendChild(ui.el('div.section-label', 'Laporan final'));
    snaps.slice(0, limit).forEach(function (s) { list.appendChild(reportCard(s, state)); });

    if (snaps.length > limit) {
      more.appendChild(ui.btn('Muat laporan lebih lama (' + (snaps.length - limit) + ' lagi)', function () {
        limit += 40; render();
      }, { ghost: true }));
    }
  }

  JF.pages.register({
    id: 'laporan',
    title: 'Laporan harian',
    sub: function () {
      var n = app ? app.rawState().snapshots.length : 0;
      return n + ' hari tercatat';
    },
    mount: mount,
    render: render
  });
})(typeof self !== 'undefined' ? self : this);
