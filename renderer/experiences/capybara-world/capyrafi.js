/* CapyRafi — karakter pendamping Capybara World.
   Tumbuh dari data asli (tugas selesai, milestone, goal tercapai). Tidak menyimpan state sendiri:
   XP selalu dihitung ulang dari state aplikasi, jadi Original dan Capybara selalu sinkron. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JF = root.JF || {}; root.JF.capyrafi = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var XP = { task: 10, milestone: 30, goal: 120 };
  var STAGES = [
    { name: 'Bayi Capy', at: 0, scale: 0.70, hint: 'Baru menetas dari daun. Lapar semangat.' },
    { name: 'Capy Cilik', at: 40, scale: 0.80, hint: 'Mulai berani jalan sendiri.' },
    { name: 'Capy Rajin', at: 120, scale: 0.88, hint: 'Sudah punya syal dan jadwal.' },
    { name: 'Capy Jagoan', at: 260, scale: 0.95, hint: 'Kacamata terpasang, to-do list gemetar.' },
    { name: 'Capy Bijak', at: 480, scale: 1.02, hint: 'Mahkota bunga dari hasil kerja keras.' },
    { name: 'Raja Capy', at: 800, scale: 1.10, hint: 'Penguasa kali. Deadline tunduk padanya.' }
  ];

  function compute(state) {
    var tasks = (state && state.tasks) || [];
    var goals = (state && state.goals) || [];
    var doneTasks = 0, milestones = 0, goalsDone = 0, i;
    for (i = 0; i < tasks.length; i++) if (tasks[i] && tasks[i].done) doneTasks++;
    for (i = 0; i < goals.length; i++) {
      var g = goals[i];
      if (!g) continue;
      if (g.status === 'completed') goalsDone++;
      var ms = g.milestones || [];
      for (var j = 0; j < ms.length; j++) if (ms[j] && ms[j].done) milestones++;
    }
    var xp = doneTasks * XP.task + milestones * XP.milestone + goalsDone * XP.goal;
    var idx = 0;
    for (i = 0; i < STAGES.length; i++) if (xp >= STAGES[i].at) idx = i;
    var cur = STAGES[idx], next = STAGES[idx + 1] || null;
    return {
      xp: xp, doneTasks: doneTasks, milestones: milestones, goalsDone: goalsDone,
      stage: idx, level: idx + 1, name: cur.name, scale: cur.scale, next: next,
      toNext: next ? next.at - xp : 0,
      pct: next ? Math.max(0, Math.min(100, Math.round((xp - cur.at) / (next.at - cur.at) * 100))) : 100,
      max: !next
    };
  }

  /** ctx: {running, paused, onBreak, overdue, todayTotal, todayDone} */
  function moodOf(ctx) {
    ctx = ctx || {};
    if (ctx.onBreak) return 'rest';
    if (ctx.running) return 'focus';
    if (ctx.todayTotal > 0 && ctx.todayDone >= ctx.todayTotal) return 'party';
    if (ctx.overdue >= 3) return 'worried';
    if (!ctx.todayTotal && !ctx.paused) return 'sleepy';
    return 'happy';
  }

  var QUOTES = {
    happy: [
      'Hari ini ada {n} tugas. Kita cicil satu-satu, kayak makan semangka.',
      'Aku capybara, bukan mesin. Tapi aku percaya kamu bisa!',
      'Mulai dari yang paling kecil. Kapibara aja pelan-pelan sampai ke sungai.',
      'Klik "Fokus" dulu, mikirnya belakangan.'
    ],
    focus: [
      'Ssst… lagi fokus. Aku ikut diam kayak batu di kali.',
      'Headphone aku pasang. Dunia luar bisa nunggu 25 menit.',
      'Satu sesi lagi, satu langkah lebih dekat ke mahkota.'
    ],
    rest: [
      'Istirahat! Berendam dulu, air hangat, pikiran adem.',
      'Minum air. Regangkan badan. Jangan buka medsos, nanti 3 jam.',
      'Zzz… eh, aku nggak tidur. Aku "mengisi baterai".'
    ],
    party: [
      'SEMUA SELESAI! Aku mau joget di tepi kali!',
      'Tugas hari ini tamat. Boleh minta semangka sebagai bonus?',
      'Kamu keren banget hari ini. Aku bangga (dan sedikit ngantuk).'
    ],
    worried: [
      'Ada {o} tugas telat. Aku nggak marah, cuma kecewa pelan-pelan.',
      'Tugas telat numpuk… tarik napas, kerjakan satu aja dulu.',
      'Aku keringetan nih. Yuk bereskan yang paling gampang dulu.'
    ],
    sleepy: [
      'Belum ada tugas hari ini. Aku tidur dulu ya… atau kita bikin rencana?',
      'Papan kosong. Isi satu langkah kecil, aku langsung melek.',
      'Zzz… tambahin tugas dong, biar aku ada kerjaan nemenin.'
    ]
  };

  function say(mood, ctx, bump) {
    ctx = ctx || {};
    var list = QUOTES[mood] || QUOTES.happy;
    var seed = (ctx.dayKey || '').split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0) + (bump || 0);
    var text = list[seed % list.length];
    var left = ctx.info && !ctx.info.max && ctx.info.toNext > 0 && ctx.info.toNext <= 30 && mood === 'happy' && !(bump % 2)
      ? 'Tinggal ' + ctx.info.toNext + ' XP lagi, aku mau naik jadi ' + ctx.info.next.name + '!' : null;
    return (left || text).replace('{n}', String(ctx.todayTotal || 0)).replace('{o}', String(ctx.overdue || 0));
  }

  /* ── SVG ───────────────────────────────────────────────────────── */
  function eyes(mood) {
    if (mood === 'sleepy' || mood === 'rest') {
      return '<path class="cr-eye-closed" d="M82 79q6 6 12 0M126 79q6 6 12 0" fill="none" stroke="#49352d" stroke-width="3" stroke-linecap="round"/>';
    }
    var base = '<g class="cr-eyes"><circle cx="88" cy="78" r="4.4" fill="#49352d"/><circle cx="132" cy="78" r="4.4" fill="#49352d"/>' +
      '<circle cx="89.5" cy="76.5" r="1.3" fill="#fff"/><circle cx="133.5" cy="76.5" r="1.3" fill="#fff"/></g>';
    if (mood === 'focus') return base + '<path d="M80 69l16 3M140 69l-16 3" stroke="#49352d" stroke-width="3" stroke-linecap="round"/>';
    if (mood === 'worried') return base + '<path d="M80 71l14-5M140 71l-14-5" stroke="#49352d" stroke-width="3" stroke-linecap="round"/>';
    if (mood === 'party') return '<g class="cr-eyes"><path d="M88 71l2 5 5 .5-4 3.5 1.2 5-4.2-2.8-4.2 2.8 1.2-5-4-3.5 5-.5z" fill="#f2c24b"/><path d="M132 71l2 5 5 .5-4 3.5 1.2 5-4.2-2.8-4.2 2.8 1.2-5-4-3.5 5-.5z" fill="#f2c24b"/></g>';
    return base;
  }

  function mouth(mood) {
    if (mood === 'party') return '<path d="M101 106q9 11 18 0z" fill="#8a3b34"/>';
    if (mood === 'worried') return '<path d="M102 109q8-6 16 0" fill="none" stroke="#70483a" stroke-width="2.6" stroke-linecap="round"/>';
    if (mood === 'rest' || mood === 'sleepy') return '<path d="M104 106q6 4 12 0" fill="none" stroke="#70483a" stroke-width="2.4" stroke-linecap="round"/>';
    return '<path d="M101 104q9 9 18 0" fill="none" stroke="#70483a" stroke-width="2.6" stroke-linecap="round"/>';
  }

  function gear(stage, mood) {
    var s = '';
    if (stage >= 5) s += '<path d="M62 118q-22 18-18 52l34-22z" fill="#c8483c"/><path d="M158 118q22 18 18 52l-34-22z" fill="#c8483c"/>';
    return s;
  }
  function topGear(stage, mood) {
    var s = '';
    if (mood === 'party') s += '<path d="M92 50l18-34 18 34z" fill="#e8744a" stroke="#c4552f" stroke-width="2"/><circle cx="110" cy="16" r="4.5" fill="#f2c24b"/><path d="M99 42h22M104 31h12" stroke="#fff3d1" stroke-width="3" stroke-linecap="round"/>';
    else if (stage >= 5) s += '<path d="M82 52l7-24 13 15 8-20 8 20 13-15 7 24z" fill="#f2c24b" stroke="#c8962a" stroke-width="2.5" stroke-linejoin="round"/><circle cx="110" cy="40" r="3.4" fill="#e8504a"/><circle cx="92" cy="44" r="2.6" fill="#5aa6d6"/><circle cx="128" cy="44" r="2.6" fill="#5aa6d6"/>';
    else if (stage === 4) s += '<g class="cr-flowers"><path d="M74 54q36-26 72 0" fill="none" stroke="#6fa56a" stroke-width="4" stroke-linecap="round"/><circle cx="79" cy="50" r="7" fill="#f08fb0"/><circle cx="94" cy="39" r="7.5" fill="#fff3d1"/><circle cx="110" cy="35" r="8.5" fill="#f2c24b"/><circle cx="126" cy="39" r="7.5" fill="#fff3d1"/><circle cx="141" cy="50" r="7" fill="#f08fb0"/><circle cx="110" cy="35" r="3" fill="#c8962a"/><circle cx="94" cy="39" r="2.4" fill="#f2c24b"/><circle cx="126" cy="39" r="2.4" fill="#f2c24b"/></g>';
    else s += '<path class="cr-leaf" d="M108 50q-4-17 14-22 2 17-14 22z" fill="#6fa56a"/><path d="M108 50q4-10 10-16" fill="none" stroke="#4d8350" stroke-width="1.6"/>';
    if (mood === 'focus') s += '<path d="M64 80q0-46 46-46t46 46" fill="none" stroke="#3b4a5a" stroke-width="7" stroke-linecap="round"/><rect x="55" y="70" width="16" height="28" rx="7" fill="#e9654f"/><rect x="149" y="70" width="16" height="28" rx="7" fill="#e9654f"/>';
    return s;
  }
  function faceGear(stage) {
    var s = '';
    if (stage >= 3) s += '<g fill="rgba(255,255,255,.28)" stroke="#49352d" stroke-width="3"><circle cx="88" cy="78" r="12"/><circle cx="132" cy="78" r="12"/></g><path d="M100 78h20" stroke="#49352d" stroke-width="3"/>';
    return s;
  }
  function neckGear(stage) {
    if (stage < 2) return '';
    return '<path d="M70 112q40 22 80 0l-4 15q-36 17-72 0z" fill="#d9604a"/><path d="M132 124l13 26-15 3z" fill="#c24b37"/><path d="M80 118q30 12 60 0" fill="none" stroke="#f1a58f" stroke-width="2" stroke-dasharray="4 5"/>';
  }
  function extras(mood, stage) {
    var s = '';
    if (mood === 'worried') s += '<path class="cr-sweat" d="M152 56q7 11 0 17-7-6 0-17z" fill="#8fd0e8"/>';
    if (mood === 'rest') s += '<text class="cr-z" x="150" y="52" font-size="17" font-weight="800" fill="#7a8fb8">z</text><text class="cr-z cr-z2" x="162" y="36" font-size="13" font-weight="800" fill="#7a8fb8">z</text>';
    if (mood === 'sleepy') s += '<text class="cr-z" x="150" y="52" font-size="17" font-weight="800" fill="#7a8fb8">z</text><text class="cr-z cr-z2" x="162" y="36" font-size="13" font-weight="800" fill="#7a8fb8">Z</text>';
    if (stage >= 5) s += '<path class="cr-spark" d="M30 60l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#f2c24b"/><path class="cr-spark cr-spark2" d="M190 90l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#f2c24b"/>';
    return s;
  }

  /** opts: {stage, mood, width, crop:'head'|'full', cls} */
  function svg(opts) {
    opts = opts || {};
    var stage = Math.max(0, Math.min(STAGES.length - 1, opts.stage | 0));
    var mood = opts.mood || 'happy';
    var scale = STAGES[stage].scale;
    var head = opts.crop === 'head';
    var viewBox = head ? '48 14 124 118' : '0 0 220 190';
    var w = opts.width ? ' width="' + opts.width + '"' : '';
    var body = '';
    if (!head) {
      body += '<ellipse cx="110" cy="176" rx="64" ry="8" fill="#000" opacity=".12"/>';
    }
    var char = gear(stage, mood) +
      '<g class="cr-body">' +
      '<ellipse cx="110" cy="134" rx="58" ry="40" fill="#c98b52"/>' +
      '<ellipse cx="110" cy="144" rx="34" ry="24" fill="#e5b57d"/>' +
      '<ellipse cx="68" cy="146" rx="11" ry="16" fill="#b87b46" transform="rotate(14 68 146)"/>' +
      '<ellipse cx="152" cy="146" rx="11" ry="16" fill="#b87b46" transform="rotate(-14 152 146)"/>' +
      '<ellipse cx="80" cy="168" rx="15" ry="8" fill="#a9693a"/><ellipse cx="140" cy="168" rx="15" ry="8" fill="#a9693a"/>' +
      '</g>' +
      neckGear(stage) +
      '<g class="cr-head">' +
      '<ellipse class="cr-ear" cx="76" cy="52" rx="9" ry="11" fill="#b87b46"/><ellipse class="cr-ear cr-ear2" cx="144" cy="52" rx="9" ry="11" fill="#b87b46"/>' +
      '<ellipse cx="76" cy="53" rx="4.5" ry="6.5" fill="#f0be89"/><ellipse cx="144" cy="53" rx="4.5" ry="6.5" fill="#f0be89"/>' +
      '<ellipse cx="110" cy="84" rx="47" ry="39" fill="#d49a5c"/>' +
      '<rect x="80" y="86" width="60" height="36" rx="22" fill="#e8b67e"/>' +
      '<ellipse cx="110" cy="94" rx="10" ry="5.5" fill="#49352d"/>' +
      '<circle cx="76" cy="98" r="6.5" fill="#e58d78" opacity=".55"/><circle cx="144" cy="98" r="6.5" fill="#e58d78" opacity=".55"/>' +
      eyes(mood) + faceGear(stage) + mouth(mood) +
      topGear(stage, mood) +
      '</g>' + extras(mood, stage);
    if (head) body += char;
    else body += '<g transform="translate(110 176) scale(' + scale + ') translate(-110 -176)">' + char + '</g>';
    return '<svg class="capyrafi ' + (opts.cls || '') + ' cr-' + mood + '" viewBox="' + viewBox + '"' + w +
      ' role="img" aria-label="CapyRafi, ' + STAGES[stage].name + '" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
  }

  /** Adegan ruang untuk Beranda. Warna latar memakai variabel CSS agar ikut mode terang/gelap. */
  function room(opts) {
    opts = opts || {};
    var night = !!opts.night;
    var sky = night
      ? '<circle cx="86" cy="64" r="18" fill="#f6efd0"/><circle cx="96" cy="58" r="16" fill="var(--cw-sky)"/><circle cx="130" cy="48" r="2" fill="#fff3d1"/><circle cx="60" cy="96" r="1.6" fill="#fff3d1"/><circle cx="140" cy="100" r="1.8" fill="#fff3d1"/>'
      : '<circle cx="104" cy="70" r="20" fill="#f4c879"/><path d="M60 118c14-18 30-18 44 0m18 0c12-14 26-14 38 0" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".85"/>';
    return '<svg class="cr-room" viewBox="0 0 640 330" role="img" aria-label="Ruang CapyRafi" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="640" height="330" rx="26" class="cr-wall"/>' +
      '<path d="M0 250h640v80H0z" class="cr-floor"/><path d="M0 252h640" stroke="var(--cw-line)" stroke-width="4"/>' +
      '<rect x="46" y="38" width="176" height="150" rx="16" class="cr-window"/>' +
      '<rect x="58" y="50" width="152" height="126" rx="9" fill="var(--cw-sky)"/>' + sky +
      '<path d="M134 51v125M59 113h150" stroke="var(--cw-card)" stroke-width="7"/>' +
      '<ellipse cx="350" cy="274" rx="190" ry="26" class="cr-rug"/>' +
      svg({ stage: opts.stage, mood: opts.mood, cls: 'cr-main' }).replace('<svg class="capyrafi', '<svg x="215" y="14" width="330" height="285" class="capyrafi') +
      '<g class="cr-plant"><rect x="540" y="214" width="46" height="40" rx="10" fill="#b8734d"/>' +
      '<path d="M563 214c-30-10-34-44-24-64 22 8 30 32 24 64zm0 0c10-26 32-40 54-38-2 24-22 40-54 38z" fill="#6fa56a" stroke="#4d8350" stroke-width="3" stroke-linejoin="round"/></g>' +
      '<g class="cr-melon"><path d="M470 250a30 30 0 0 0 60 0z" fill="#e8504a"/><path d="M470 250a30 30 0 0 0 60 0" fill="none" stroke="#6fa56a" stroke-width="6"/>' +
      '<circle cx="486" cy="260" r="2.4" fill="#2b1b17"/><circle cx="500" cy="266" r="2.4" fill="#2b1b17"/><circle cx="514" cy="260" r="2.4" fill="#2b1b17"/></g>' +
      '</svg>';
  }

  /* ── Teman fokus: CapyRafi menemani sesi waktu bebas (hitung maju) ──
     Murni dari detik fokus aktif: tahap berubah makin lama kamu fokus, dan satu jejak kaki
     menyala tiap 15 menit (maksimal 8 jejak = 2 jam). */
  var COMPANION_PAWS = 8;
  var COMPANION_TIERS = [
    { at: 0,    label: 'Pemanasan',      line: 'Pemanasan dulu. Aku temenin sampai selesai.' },
    { at: 600,  label: 'Mulai mengalir', line: 'Mulai ngalir nih, kayak capybara di sungai.' },
    { at: 1800, label: 'Dalam flow',     line: 'Lagi dalam flow. Jangan diganggu, ya.' },
    { at: 3600, label: 'Fokus dalam',    line: 'Sudah lebih dari sejam. Jangan lupa minum air.' },
    { at: 5400, label: 'Maraton',        line: 'Maraton! Kalau mata mulai pegal, pilih Selesai sesi lalu berendam sebentar.' }
  ];
  function companion(sec) {
    sec = Math.max(0, Number(sec) || 0);
    var tier = 0;
    COMPANION_TIERS.forEach(function (t, i) { if (sec >= t.at) tier = i; });
    return {
      tier: tier,
      label: COMPANION_TIERS[tier].label,
      line: COMPANION_TIERS[tier].line,
      paws: Math.min(COMPANION_PAWS, Math.floor(sec / 900)),
      maxPaws: COMPANION_PAWS
    };
  }

  return {
    XP: XP, STAGES: STAGES, compute: compute, moodOf: moodOf, say: say, svg: svg, room: room,
    companion: companion
  };
});
