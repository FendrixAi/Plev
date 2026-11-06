/* Mola World: pengarah halaman. Halaman yang belum dibuat menampilkan kartu pengganti dengan jalan pulang. */
(function (root) {
  'use strict';
  var JF = root.JF;

  var LABEL = { tugas: 'Tugas', kalender: 'Kalender', analitik: 'Analitik', riwayat: 'Riwayat fokus', laporan: 'Laporan harian', goals: 'Goals', jurnal: 'Journaling', pengaturan: 'Pengaturan', library: 'Library' };

  function pending(id, host) {
    var ui = JF.ui;
    var card = ui.el('section.mw-card.mw-pending',
      ui.el('span.mw-eyebrow', 'SEGERA HADIR DI MOLA WORLD'),
      ui.el('h2', (LABEL[id] || 'Halaman') + ' sedang dibangun'),
      ui.el('p', 'Halaman ini belum punya tampilan Mola. Datamu aman dan tetap satu, jadi kamu bisa membukanya dulu lewat tampilan lain lalu kembali ke sini kapan saja.'));
    var row = ui.el('div.mw-actions');
    row.appendChild(ui.btn('Buka di Capybara World', function () { JF.homeExperience.set('capybara-world'); }, { primary: true }));
    row.appendChild(ui.btn('Buka di Original', function () { JF.homeExperience.set('original'); }, { ghost: true }));
    card.appendChild(row);
    host.appendChild(card);
  }

  function render(id, host) {
    JF.ui.clear(host);
    host.dataset.page = id;
    if (id === 'beranda') JF.molaHome.render(host);
    else pending(id, host);
  }

  function frame(id) {
    if (id === 'beranda' && JF.molaHome) JF.molaHome.frame();
  }

  JF.molaPages = { render: render, frame: frame };
})(typeof self !== 'undefined' ? self : this);
