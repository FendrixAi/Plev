/* Mola World: maskot Mola (ikan bulan / sunfish) sebagai SVG. XP tetap dihitung dari state lewat
   JF.capyrafi.compute, jadi semua tampilan selalu sinkron dan tidak ada penyimpanan baru. */
(function (root) {
  'use strict';
  var JF = root.JF = root.JF || {};

  var NAMES = [
    ['Bayi Mola', 'Baru menetas, masih suka ngambang santai.'],
    ['Mola Kecil', 'Mulai berani berenang ke permukaan.'],
    ['Mola Berjemur', 'Rajin berjemur di bawah matahari fokus.'],
    ['Mola Penyelam', 'Menyelam dalam, tahan lama di zona fokus.'],
    ['Mola Raksasa', 'Besar, tenang, dan konsisten.'],
    ['Raja Samudra', 'Penguasa laut produktivitas.']
  ];
  var SCALE = [0.62, 0.74, 0.84, 0.94, 1.04, 1.14];

  function compute(state) {
    var base = JF.capyrafi.compute(state);
    var i = base.stage;
    var info = {};
    for (var k in base) info[k] = base[k];
    info.name = NAMES[i][0];
    info.hint = NAMES[i][1];
    info.scale = SCALE[i];
    info.next = base.next ? { name: NAMES[i + 1][0], at: base.next.at } : null;
    return info;
  }

  var QUOTES = {
    happy: ['Hai! Hari ini kita berenang pelan-pelan tapi pasti.', 'Air tenang, kerjaan beres. Mulai dari yang kecil dulu.'],
    focus: ['Ssst... lagi dalam arus fokus. Aku temani.', 'Gelembung notifikasi biarin lewat, kamu tetap di jalur.'],
    rest: ['Waktunya mengapung. Tarik napas, minum air.', 'Istirahat itu bagian dari rencana, bukan kemalasan.'],
    party: ['Semua tugas hari ini beres! Aku mau berjemur dulu.', 'Mantap! Laut hari ini milik kamu.'],
    worried: ['Ada beberapa tugas terlambat. Pilih satu, kita mulai.', 'Ombaknya agak tinggi, tapi satu tugas kecil bisa jadi awal.'],
    sleepy: ['Belum ada tugas hari ini. Mau tambah satu, atau santai?', 'Sepi... aku ngambang dulu ya.']
  };
  function say(mood, ctx, bump) {
    var list = QUOTES[mood] || QUOTES.happy;
    return list[(bump || 0) % list.length];
  }

  function eyes(mood) {
    if (mood === 'sleepy') return '<path d="M52 82q7 5 14 0" fill="none" stroke="#1d2f55" stroke-width="3" stroke-linecap="round"/>';
    if (mood === 'party') return '<path d="M52 84q7-9 14 0" fill="none" stroke="#1d2f55" stroke-width="3" stroke-linecap="round"/>';
    var r = mood === 'focus' ? 4.5 : 5.5;
    return '<circle cx="59" cy="82" r="' + r + '" fill="#1d2f55"/><circle cx="61" cy="80" r="1.6" fill="#fff"/>' +
      (mood === 'worried' ? '<path d="M50 70l16 4" stroke="#1d2f55" stroke-width="2.4" stroke-linecap="round"/>' : '');
  }
  function mouth(mood) {
    if (mood === 'party') return '<ellipse cx="34" cy="98" rx="6" ry="7" fill="#f08c7a" stroke="#1d2f55" stroke-width="2.4"/>';
    if (mood === 'rest' || mood === 'sleepy') return '<ellipse cx="34" cy="97" rx="3.5" ry="3" fill="#f08c7a" stroke="#1d2f55" stroke-width="2"/>';
    if (mood === 'worried') return '<path d="M28 100q6-5 12 0" fill="none" stroke="#1d2f55" stroke-width="2.6" stroke-linecap="round"/>';
    return '<ellipse cx="34" cy="97" rx="5" ry="6" fill="#f08c7a" stroke="#1d2f55" stroke-width="2.4"/>';
  }
  function gear(stage) {
    var g = '';
    if (stage >= 2) g += '<path d="M62 52q18-22 44-10l-6 12q-18-8-38 8z" fill="#f6c556" stroke="#1d2f55" stroke-width="2.2" stroke-linejoin="round"/>';
    if (stage >= 3) g += '<rect x="44" y="74" width="34" height="16" rx="8" fill="#9fd8ee" fill-opacity=".55" stroke="#1d2f55" stroke-width="2.4"/><path d="M78 82h30" stroke="#1d2f55" stroke-width="2.4"/>';
    if (stage >= 4) g += '<path d="M96 126q10 10 22 0" fill="none" stroke="#f08c7a" stroke-width="3" stroke-linecap="round"/>';
    if (stage >= 5) g += '<path d="M78 44l8-16 8 10 8-12 8 12 8-10 8 16z" fill="#f6c556" stroke="#1d2f55" stroke-width="2.4" stroke-linejoin="round"/><circle cx="94" cy="30" r="2.6" fill="#e8744a"/><circle cx="110" cy="27" r="2.6" fill="#5aa6d6"/>';
    return g;
  }

  /** opts: {stage, mood, width, cls}. Hasilnya string SVG. */
  function svg(opts) {
    opts = opts || {};
    var stage = Math.max(0, Math.min(5, opts.stage | 0));
    var mood = opts.mood || 'happy';
    var w = opts.width ? ' width="' + opts.width + '"' : '';
    var scallop = '';
    for (var i = 0; i < 7; i++) scallop += '<circle cx="' + (150 + Math.sin(i / 6 * Math.PI) * 8) + '" cy="' + (52 + i * 12) + '" r="9"/>';
    return '<svg class="mw-mola ' + (opts.cls || '') + '" viewBox="0 0 200 190"' + w + ' role="img" aria-label="Mola, ikan bulan, suasana ' + mood + '">' +
      '<g class="mw-body" transform="translate(100 95) scale(' + SCALE[stage] + ') translate(-100 -95)">' +
      '<path class="mw-fin-top" d="M92 42L122 4q8 20 4 46z" fill="#7f95bd" stroke="#1d2f55" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path class="mw-fin-bot" d="M96 140L118 184q-18-2-32-30z" fill="#7f95bd" stroke="#1d2f55" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<g fill="#6f86b2" stroke="#1d2f55" stroke-width="2.2">' + scallop + '</g>' +
      '<ellipse cx="96" cy="95" rx="66" ry="54" fill="#8ea4c8" stroke="#1d2f55" stroke-width="3"/>' +
      '<path d="M32 98q10 48 66 50 46 0 62-38-30 26-70 18-30-6-58-30z" fill="#f4eee3"/>' +
      '<g fill="#a9bbd8" opacity=".75"><circle cx="92" cy="62" r="4"/><circle cx="108" cy="72" r="3"/><circle cx="80" cy="54" r="2.6"/><circle cx="118" cy="56" r="2.6"/></g>' +
      '<path class="mw-fin-side" d="M82 100q24-12 40 4-8 22-34 20z" fill="#7f95bd" stroke="#1d2f55" stroke-width="2.4" stroke-linejoin="round"/>' +
      eyes(mood) + mouth(mood) + gear(stage) +
      '</g></svg>';
  }

  /** Pemandangan hero: Mola + gelembung + matahari + dasar laut. Selalu siang. */
  function scene(opts) {
    var bubbles = '<g fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2"><circle class="mw-b b1" cx="40" cy="150" r="7"/><circle class="mw-b b2" cx="62" cy="120" r="4"/><circle class="mw-b b3" cx="300" cy="140" r="6"/><circle class="mw-b b4" cx="330" cy="100" r="3.5"/></g>';
    return '<svg class="mw-scene" viewBox="0 0 360 240" role="img" aria-label="Mola berenang di laut siang hari">' +
      '<circle cx="300" cy="38" r="26" fill="#f7b84a"/><circle cx="300" cy="38" r="38" fill="#f7b84a" opacity=".25"/>' +
      '<path d="M0 70q30-14 60 0t60 0 60 0 60 0 60 0 60 0v170H0z" fill="#5aa6d6" opacity=".55"/>' +
      '<path d="M0 100q30-12 60 0t60 0 60 0 60 0 60 0 60 0v140H0z" fill="#3f8fc4" opacity=".6"/>' +
      '<path d="M0 205q40-16 80-4t90 2 90-6 100 6v37H0z" fill="#ecd8a8"/>' +
      '<g stroke="#1d2f55" stroke-width="2" stroke-linejoin="round"><path d="M34 214q-6-26 4-40 4 16 4 40z" fill="#f08c7a"/><path d="M52 216q0-22 10-34 0 14-2 34z" fill="#e8744a"/><path d="M318 216q-4-28 8-44 2 18 0 44z" fill="#9b7bd1"/></g>' +
      bubbles +
      '<g transform="translate(70 22) scale(.95)">' + svg({ stage: (opts && opts.stage) || 0, mood: (opts && opts.mood) || 'happy', cls: 'mw-hero-mola' }).replace(/^<svg[^>]*>/, '<g>').replace(/<\/svg>$/, '</g>') + '</g></svg>';
  }

  JF.mola = { NAMES: NAMES, compute: compute, say: say, svg: svg, scene: scene };
})(typeof self !== 'undefined' ? self : this);
