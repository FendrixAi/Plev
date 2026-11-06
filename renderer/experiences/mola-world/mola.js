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
      '<g class="mw-body"><g transform="translate(100 95) scale(' + SCALE[stage] + ') translate(-100 -95)">' +
      '<path class="mw-fin-top" d="M92 42L122 4q8 20 4 46z" fill="#7f95bd" stroke="#1d2f55" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path class="mw-fin-bot" d="M96 140L118 184q-18-2-32-30z" fill="#7f95bd" stroke="#1d2f55" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<g fill="#6f86b2" stroke="#1d2f55" stroke-width="2.2">' + scallop + '</g>' +
      '<ellipse cx="96" cy="95" rx="66" ry="54" fill="#8ea4c8" stroke="#1d2f55" stroke-width="3"/>' +
      '<path d="M32 98q10 48 66 50 46 0 62-38-30 26-70 18-30-6-58-30z" fill="#f4eee3"/>' +
      '<g fill="#a9bbd8" opacity=".75"><circle cx="92" cy="62" r="4"/><circle cx="108" cy="72" r="3"/><circle cx="80" cy="54" r="2.6"/><circle cx="118" cy="56" r="2.6"/></g>' +
      '<path class="mw-fin-side" d="M82 100q24-12 40 4-8 22-34 20z" fill="#7f95bd" stroke="#1d2f55" stroke-width="2.4" stroke-linejoin="round"/>' +
      eyes(mood) + mouth(mood) + gear(stage) +
      '</g></g></svg>';
  }

  /** Pemandangan hero: laut siang penuh biota (mercusuar, ubur-ubur, ikan badut, penyu, kepiting, terumbu, harta karun). */
  function scene(opts) {
    var stage = (opts && opts.stage) || 0, mood = (opts && opts.mood) || 'happy';
    var mola = svg({ stage: stage, mood: mood, cls: 'mw-hero-mola' }).replace(/^<svg[^>]*>/, '<svg class="mw-hero-mola-wrap" x="118" y="64" width="190" height="180" viewBox="0 0 200 190">');
    var rays = '';
    for (var i = 0; i < 8; i++) {
      var ang = i * Math.PI / 4;
      rays += '<line x1="' + (338 + Math.cos(ang) * 36).toFixed(1) + '" y1="' + (46 + Math.sin(ang) * 36).toFixed(1) + '" x2="' + (338 + Math.cos(ang) * 50).toFixed(1) + '" y2="' + (46 + Math.sin(ang) * 50).toFixed(1) + '"/>';
    }
    var O = ' stroke="#1d2f55" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"';
    return '<svg class="mw-scene" viewBox="0 0 420 290" role="img" aria-label="Mola berenang di laut siang bersama jeli, ikan badut, penyu, dan kepiting">' +
      '<defs><linearGradient id="mwSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc6ea"/><stop offset=".55" stop-color="#3f95cc"/><stop offset="1" stop-color="#2a78b3"/></linearGradient>' +
      '<radialGradient id="mwGlow"><stop offset="0" stop-color="#fff4c2" stop-opacity=".95"/><stop offset="1" stop-color="#fff4c2" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="420" height="290" rx="26" fill="#dff3fb"/>' +
      '<circle cx="338" cy="46" r="62" fill="url(#mwGlow)"/><g class="mw-rays" stroke="#f7b84a" stroke-width="4" stroke-linecap="round">' + rays + '</g>' +
      '<circle cx="338" cy="46" r="26" fill="#f7b84a"/><circle cx="338" cy="46" r="16" fill="#fbcf6e"/>' +
      '<g class="mw-cloud c1" fill="#fff" opacity=".95"><ellipse cx="96" cy="40" rx="30" ry="12"/><ellipse cx="116" cy="34" rx="20" ry="12"/><ellipse cx="78" cy="36" rx="16" ry="9"/></g>' +
      '<g class="mw-cloud c2" fill="#ffe9c9" opacity=".95"><ellipse cx="270" cy="30" rx="28" ry="10"/><ellipse cx="288" cy="25" rx="16" ry="10"/></g>' +
      '<g class="mw-gull" fill="none" stroke="#6b7a99" stroke-width="2" stroke-linecap="round"><path d="M182 36q7-8 14 0q7-8 14 0"/><path d="M214 54q5-6 10 0q5-6 10 0"/></g>' +
      /* mercusuar di batu */
      '<path d="M0 118q20-36 66-32l22 36v14H0z" fill="#9a97ae"' + O + '/><path d="M6 106q18-16 46-12 10 6 6 14-30-8-52 4z" fill="#6fa86a"/>' +
      '<g' + O + '><path d="M38 90l4-44h12l4 44z" fill="#fff"/><path d="M40.5 70h15l1.3 -10h-17.6z" fill="#e8744a"/><rect x="36" y="38" width="24" height="9" rx="2" fill="#e8744a"/><path d="M38 38l10-14 10 14z" fill="#e8744a"/></g>' +
      '<circle class="mw-lamp" cx="48" cy="42.5" r="4" fill="#fff0a8"/>' +
      /* air */
      '<path d="M0 100q35-14 70 0t70 0 70 0 70 0 70 0 70 0v190H0z" fill="url(#mwSea)"/>' +
      '<path class="mw-foam" d="M0 100q35-14 70 0t70 0 70 0 70 0 70 0 70 0" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="3"/>' +
      '<path class="mw-swell" d="M0 150q35-12 70 0t70 0 70 0 70 0 70 0 70 0" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3"/>' +
      /* batu + kepiting */
      '<path d="M318 112q18-26 52-16 22 8 26 16z" fill="#8c8aa3"' + O + '/>' +
      '<g class="mw-crab" transform="translate(356 92)"' + O + '><ellipse cx="0" cy="0" rx="13" ry="9" fill="#ea6a43"/><g class="mw-claw l"><path d="M-12 -4q-10-8-7-16 7 0 9 8z" fill="#ea6a43"/></g><g class="mw-claw r"><path d="M12 -4q10-8 7-16-7 0-9 8z" fill="#ea6a43"/></g><circle cx="-4" cy="-4" r="2.4" fill="#1d2f55" stroke="none"/><circle cx="4" cy="-4" r="2.4" fill="#1d2f55" stroke="none"/><path d="M-4 3q4 3 8 0" fill="none"/></g>' +
      /* ubur-ubur */
      '<g class="mw-jelly" transform="translate(48 132)"><path d="M-20 0q0-26 20-26t20 26q-20 6-40 0z" fill="#c9c6f2" fill-opacity=".92"' + O + '/><g fill="none" stroke="#a9a4e6" stroke-width="2.6" stroke-linecap="round"><path d="M-14 2q-6 14 0 26t0 22"/><path d="M-5 4q-4 16 1 28"/><path d="M5 4q5 16 0 30"/><path d="M14 2q6 14 0 24t2 20"/></g></g>' +
      /* ikan badut */
      '<g class="mw-clown" transform="translate(44 214)"' + O + '><path d="M16 0l16-9v18z" fill="#f08a3c"/><ellipse cx="0" cy="0" rx="19" ry="12" fill="#f4923f"/><path d="M-4 -11q5 11 0 22" fill="none" stroke="#fff" stroke-width="5"/><path d="M8 -9q3 9 0 18" fill="none" stroke="#fff" stroke-width="4"/><circle cx="-11" cy="-2" r="2.6" fill="#1d2f55" stroke="none"/></g>' +
      /* penyu */
      '<g class="mw-turtle" transform="translate(352 168)"' + O + '><path d="M-6 8q-10 14-22 12 6-12 14-16z" fill="#9fb46a"/><path d="M12 8q10 14 22 10-6-12-14-14z" fill="#9fb46a"/><ellipse cx="0" cy="0" rx="26" ry="16" fill="#a98f4e"/><path d="M-14 -8l8-4h12l8 4M-18 2h36M-12 10l8 3h8l8-3" fill="none" stroke="#7b6a35" stroke-width="1.6"/><path d="M-24 -6q-12-2-14 6 2 6 12 2z" fill="#9fb46a"/><circle cx="-33" cy="-1" r="1.8" fill="#1d2f55" stroke="none"/></g>' +
      /* Mola */ mola +
      /* dasar laut */
      '<path d="M0 246q40-14 90-6t100 2 100-6 130 8v46H0z" fill="#efd9a6"/>' +
      '<g' + O + '><g class="mw-weed w1"><path d="M22 250q-12-24 0-44 8 18 0 44z" fill="#4f9a5a"/></g><g class="mw-weed w2"><path d="M40 252q-8-18 2-34 6 14 0 34z" fill="#5fae6a"/></g><g class="mw-weed w3"><path d="M392 252q-10-28 2-48 8 20 0 48z" fill="#4f9a5a"/></g>' +
      '<path d="M70 252q-4-18 4-30 2 10 8 14 4-12 12-14-2 18-6 30z" fill="#f08c7a"/><path d="M296 252q-2-22 6-36 2 12 9 16 5-14 13-16-2 22-6 36z" fill="#f4a07a"/><path d="M340 252q0-18 8-28 2 10 8 12 2-12 10-14 0 18-4 30z" fill="#9b7bd1"/>' +
      '<path d="M120 262q-18-2-20-18 12-10 22-4 10-6 20 4-2 16-22 18z" fill="#f7e6cf"/><path d="M122 262l-2-22M112 258l2-18M132 258l-2-18" fill="none" stroke="#e5c9a6" stroke-width="1.4"/>' +
      '<path class="mw-star" d="M182 258l4-10-9-6 11 0 3-11 3 11 11 0-9 6 4 10-9-6z" fill="#f4923f" transform="translate(-6 0)"/>' +
      '<g><rect x="356" y="236" width="40" height="24" rx="3" fill="#a76d3a"/><path d="M354 238q2-14 22-14t22 14z" fill="#c78a4c"/><rect x="371" y="240" width="9" height="9" rx="2" fill="#f6c556"/><circle cx="362" cy="236" r="3" fill="#f6c556" stroke="none"/><circle cx="390" cy="236" r="3" fill="#f6c556" stroke="none"/></g></g>' +
      '<g class="mw-glit" fill="#fff6c9"><path d="M376 220l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></g>' +
      '<g fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2"><circle class="mw-b b1" cx="96" cy="190" r="6"/><circle class="mw-b b2" cx="110" cy="160" r="3.5"/><circle class="mw-b b3" cx="318" cy="200" r="5"/><circle class="mw-b b4" cx="302" cy="150" r="3"/><circle class="mw-b b5" cx="230" cy="130" r="4"/></g>' +
      '</svg>';
  }

  JF.mola = { NAMES: NAMES, compute: compute, say: say, svg: svg, scene: scene };
})(typeof self !== 'undefined' ? self : this);
