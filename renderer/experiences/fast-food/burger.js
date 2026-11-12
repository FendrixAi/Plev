/* Fast Food: Burger Builder. XP tetap dihitung dari state lewat JF.capyrafi.compute, jadi semua tampilan selalu sinkron
   dan tidak ada penyimpanan baru. Tahap 0-5 menumpuk bahan: bun, patty, keju, tomat, selada, lalu bun atas + topi koki. */
(function (root) {
  'use strict';
  var JF = root.JF = root.JF || {};

  var NAMES = [
    ['Bun Polos', 'Baru roti kosong. Isinya menyusul, satu tugas satu bahan.'],
    ['Patty Perdana', 'Patty sudah mendarat. Mulai mengenyangkan.'],
    ['Cheese Lover', 'Kejunya meleleh, konsistensimu juga.'],
    ['Tomat Segar', 'Segar dan rapi, jadwal makin padat berisi.'],
    ['Selada Renyah', 'Tinggal tutup bun. Sedikit lagi jadi.'],
    ['Raja Burger', 'Burger paripurna, lengkap dengan topi koki.']
  ];
  var LAYERS = ['bunBottom', 'patty', 'cheese', 'tomato', 'lettuce'];

  function compute(state) {
    var base = JF.capyrafi.compute(state), i = base.stage, info = {}, k;
    for (k in base) info[k] = base[k];
    info.name = NAMES[i][0];
    info.hint = NAMES[i][1];
    info.next = base.next ? { name: NAMES[i + 1][0], at: base.next.at } : null;
    return info;
  }

  var QUOTES = {
    happy: ['Hari ini kita rakit pelan-pelan. Satu tugas, satu lapis.', 'Dapur buka! Pilih satu order dan mulai.'],
    focus: ['Ssst, lagi masak. Biarkan api tetap kecil dan stabil.', 'Order sedang dipanggang. Jangan dibalik-balik dulu.'],
    rest: ['Waktunya ngemil. Minum dulu, regangkan badan.', 'Istirahat itu bagian dari resep, bukan malas.'],
    party: ['Semua order hari ini terlayani! Tutup kasir dengan senyum.', 'Pesanan tuntas. Burger terbaik hari ini buatanmu.'],
    worried: ['Ada beberapa order basi di rel. Pilih satu, kita bereskan.', 'Tiketnya menumpuk, tapi satu burger kecil bisa jadi awal.'],
    sleepy: ['Rel tiket kosong. Tambah order, atau santai sebentar?', 'Sepi... kompor kumatikan dulu ya.']
  };
  function say(mood, ctx, bump) {
    var list = QUOTES[mood] || QUOTES.happy;
    return list[(bump || 0) % list.length];
  }

  function img(key, cls) {
    return '<img class="ff-l ' + cls + '" src="' + JF.ffArt.src[key] + '" alt="" draggable="false">';
  }

  /** opts: {stage, mood, cls}. Hasilnya string HTML berisi tumpukan sprite. */
  function stack(opts) {
    opts = opts || {};
    var stage = Math.max(0, Math.min(5, opts.stage | 0)), mood = opts.mood || 'happy', h = '', i;
    if (stage >= 5) {
      h = img('hat', 'l-hat') + img('burger', 'l-full');
    } else {
      for (i = stage; i >= 0; i--) h += img(LAYERS[i], 'l-' + LAYERS[i]);
    }
    return '<span class="ff-stack mood-' + mood + ' st-' + stage + ' ' + (opts.cls || '') + '" role="img" aria-label="Burger, ' + NAMES[stage][0] + ', suasana ' + mood + '">' + h + '</span>';
  }

  JF.burger = { NAMES: NAMES, compute: compute, say: say, stack: stack, img: img };
})(typeof self !== 'undefined' ? self : this);
