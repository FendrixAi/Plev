/* Mola World: koleksi hewan laut kecil (SVG) untuk maskot halaman, teman di rel kiri, dan efek.
   Semuanya murni gambar; perilakunya ada di fx.js. */
(function (root) {
  'use strict';
  var JF = root.JF = root.JF || {};
  var O = ' stroke="#1d2f55" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';

  var ART = {
    crab: '<g' + O + '><g class="mw-claw l"><path d="M18 30q-12-4-10-16 8 0 12 8z" fill="#ea6a43"/></g><g class="mw-claw r"><path d="M62 30q12-4 10-16-8 0-12 8z" fill="#ea6a43"/></g>' +
      '<path d="M22 46l-8 8M30 50l-4 8M50 50l4 8M58 46l8 8" fill="none"/><ellipse cx="40" cy="38" rx="21" ry="14" fill="#ea6a43"/>' +
      '<path d="M32 26v-6M48 26v-6" fill="none"/><circle cx="32" cy="18" r="3.4" fill="#fff"/><circle cx="48" cy="18" r="3.4" fill="#fff"/><circle cx="33" cy="18" r="1.4" fill="#1d2f55" stroke="none"/><circle cx="49" cy="18" r="1.4" fill="#1d2f55" stroke="none"/>' +
      '<path d="M34 41q6 5 12 0" fill="none"/></g>',
    turtle: '<g' + O + '><path d="M20 38q-8 12-18 10 4-10 12-14z" fill="#9fb46a"/><path d="M52 38q8 12 18 10-4-10-12-14z" fill="#9fb46a"/>' +
      '<path d="M62 26q12-6 14 2-2 8-12 6z" fill="#9fb46a"/><ellipse cx="38" cy="30" rx="24" ry="17" fill="#a98f4e"/>' +
      '<path d="M24 22l8-5h12l8 5M18 32h40M26 41l6 4h12l6-4" fill="none" stroke="#7b6a35" stroke-width="1.6"/><circle cx="71" cy="27" r="1.7" fill="#1d2f55" stroke="none"/></g>',
    school: '<g' + O + '><path class="mw-sf s1" d="M6 40l8-5v10zM14 40q8-9 18 0-10 9-18 0z" fill="#4aa3d6"/><path class="mw-sf s2" d="M30 22l8-5v10zM38 22q8-9 18 0-10 9-18 0z" fill="#f4923f"/><path class="mw-sf s3" d="M42 48l8-5v10zM50 48q8-9 18 0-10 9-18 0z" fill="#7a8fd6"/></g>',
    seahorse: '<g' + O + '><path d="M44 8q12 0 12 12 0 8-8 12-4 3-2 8 2 8-6 12-6 4-12-1 6 0 8-5 2-6-4-8-8-4-8-14 0-12 12-16z" fill="#f5b04c"/>' +
      '<path d="M44 8l-10-2M46 12l6 4" fill="none"/><path class="mw-fin" d="M30 28q-8 4-6 12 8-2 10-10z" fill="#fbd27a"/><circle cx="46" cy="14" r="2" fill="#1d2f55" stroke="none"/><path d="M34 22q4 4 8 0" fill="none"/></g>',
    octopus: '<g' + O + '><path class="mw-tent t1" d="M20 40q-10 8-8 18 6-4 8-12z" fill="#b57bd1"/><path class="mw-tent t2" d="M30 44q-4 10 0 16 6-6 4-14z" fill="#b57bd1"/><path class="mw-tent t3" d="M50 44q4 10 0 16-6-6-4-14z" fill="#b57bd1"/><path class="mw-tent t4" d="M60 40q10 8 8 18-6-4-8-12z" fill="#b57bd1"/>' +
      '<path d="M16 34q0-26 24-26t24 26q0 14-24 14T16 34z" fill="#c68be0"/><circle cx="32" cy="28" r="4.5" fill="#fff"/><circle cx="48" cy="28" r="4.5" fill="#fff"/><circle cx="33" cy="29" r="2" fill="#1d2f55" stroke="none"/><circle cx="49" cy="29" r="2" fill="#1d2f55" stroke="none"/><path d="M35 38q5 4 10 0" fill="none"/>' +
      '<rect x="58" y="26" width="14" height="18" rx="2" fill="#fff" transform="rotate(14 65 35)"/></g>',
    chest: '<g' + O + '><rect x="12" y="30" width="56" height="26" rx="4" fill="#a76d3a"/><g class="mw-lid"><path d="M10 32q2-20 30-20t30 20z" fill="#c78a4c"/></g><rect x="35" y="34" width="10" height="11" rx="2" fill="#f6c556"/>' +
      '<circle class="mw-gold" cx="24" cy="30" r="3.4" fill="#f6c556"/><circle class="mw-gold" cx="40" cy="28" r="3.4" fill="#f6c556"/><circle class="mw-gold" cx="56" cy="30" r="3.4" fill="#f6c556"/></g>',
    shell: '<g' + O + '><path d="M8 48q-2-26 32-34 34 8 32 34-32 12-64 0z" fill="#f7e6cf"/><path d="M40 14v42M26 20l6 36M54 20l-6 36M16 30l14 26M64 30L50 56" fill="none" stroke="#e5c9a6" stroke-width="1.6"/>' +
      '<circle class="mw-pearl" cx="40" cy="38" r="8" fill="#fff" stroke="#9fb7d9"/><circle cx="37" cy="35" r="2.2" fill="#dff1ff" stroke="none"/></g>',
    puffer: '<g' + O + '><path d="M60 28l12-8v22z" fill="#f2c14e"/><g class="mw-puff"><circle cx="36" cy="32" r="22" fill="#f6d36a"/>' +
      '<path d="M36 6v-6M54 14l5-4M18 14l-5-4M60 32h6M12 32H6M54 50l5 4M18 50l-5 4" fill="none"/><circle cx="26" cy="26" r="3.6" fill="#fff"/><circle cx="27" cy="27" r="1.6" fill="#1d2f55" stroke="none"/><path d="M18 40q6 5 12 0" fill="none"/><path d="M36 26q8 4 8 12" fill="none" opacity=".4"/></g></g>',
    whale: '<g' + O + '><path class="mw-spout" d="M30 12q-4-8 2-10M30 12q4-8-2-10" fill="none" stroke="#7cc6ea"/><path d="M6 36q2-20 28-20t36 14q6 4 8-4 2 12-8 18-10 6-36 6T6 36z" fill="#6e8fc4"/>' +
      '<path d="M12 40q20 10 50 0" fill="#e8f1fa" stroke="none"/><circle cx="20" cy="32" r="2.6" fill="#1d2f55" stroke="none"/><path d="M14 38q4 3 8 0" fill="none"/></g>',
    star: '<g' + O + '><path d="M40 6l9 18 20 3-14 14 3 20-18-9-18 9 3-20L11 27l20-3z" fill="#f4923f"/><circle cx="40" cy="30" r="2" fill="#f9c78d" stroke="none"/><circle cx="32" cy="36" r="1.6" fill="#f9c78d" stroke="none"/><circle cx="48" cy="36" r="1.6" fill="#f9c78d" stroke="none"/></g>',
    jelly: '<g' + O + '><path d="M16 34q0-26 24-26t24 26q-24 6-48 0z" fill="#c9c6f2" fill-opacity=".95"/><g fill="none" stroke="#a9a4e6" stroke-width="3"><path class="mw-jt a" d="M22 36q-6 10 0 18t0 8"/><path class="mw-jt b" d="M34 38q-4 12 1 20"/><path class="mw-jt c" d="M46 38q5 12 0 22"/><path class="mw-jt d" d="M58 36q6 10 0 16t2 10"/></g><circle cx="32" cy="24" r="2" fill="#1d2f55" stroke="none"/><circle cx="48" cy="24" r="2" fill="#1d2f55" stroke="none"/></g>'
  };

  /* maskot per halaman: hewan, nama, dan tips yang cocok dengan fitur halamannya */
  var PAGE = {
    tugas: { art: 'crab', name: 'Kepiting', tips: ['Pilih satu tugas kecil dulu, capit satu per satu.', 'Setiap tugas butuh tanggal target. Kepiting suka yang pasti.', 'Selesaikan dengan ringkasan supaya hasilnya tidak hanyut ombak.'] },
    kalender: { art: 'turtle', name: 'Penyu', tips: ['Lihat dulu minggu ini, baru rencanakan yang jauh.', 'Penyu berjalan pelan tapi sampai. Sebar tugas supaya tidak menumpuk.'] },
    analitik: { art: 'school', name: 'Kawanan ikan', tips: ['Cari pola fokusmu, bukan cuma angka hari ini.', 'Kawanan ikan bergerak bersama. Tugas, fokus, dan goals saling terkait.'] },
    riwayat: { art: 'seahorse', name: 'Kuda laut', tips: ['Tiap sesi tercatat di sini. Sesi yang dihentikan tidak masuk total fokus.', 'Tengok riwayat untuk melihat jam fokus terbaikmu.'] },
    laporan: { art: 'octopus', name: 'Gurita', tips: ['Gurita mencatat tiap hari dengan delapan tangan. Pilih hari yang mau ditinjau.', 'Laporan harian merangkum tugas dan fokus per hari.'] },
    goals: { art: 'chest', name: 'Peti harta', tips: ['Pecah goal besar jadi milestone kecil.', 'Hubungkan tugas ke goal supaya progresnya terasa.'] },
    jurnal: { art: 'shell', name: 'Kerang mutiara', tips: ['Tulis satu pencapaian dan satu tantangan hari ini.', 'Jurnal singkat tiap hari lebih awet daripada sesekali panjang.'] },
    pengaturan: { art: 'puffer', name: 'Ikan buntal', tips: ['Semua pengaturan tersimpan otomatis di perangkat.', 'Atur target harian supaya progresmu punya patokan.'] },
    library: { art: 'whale', name: 'Paus', tips: ['Lampirkan dokumen ke tugas supaya mudah dibuka lagi.', 'Paus muat banyak. Kumpulkan referensimu di sini.'] },
    beranda: { art: 'crab', name: 'Kepiting', tips: ['Mulai dari satu sesi fokus pendek.'] }
  };

  function svg(name, cls) {
    return '<svg class="mw-critter-svg ' + (cls || '') + '" viewBox="0 0 80 62" aria-hidden="true" focusable="false">' + (ART[name] || '') + '</svg>';
  }

  JF.molaCritters = { ART: ART, PAGE: PAGE, svg: svg };
})(typeof self !== 'undefined' ? self : this);
