/* Mola World: efek laut yang bereaksi pada fitur nyata di semua halaman.
   Tidak mengubah data atau logika: hanya mendengarkan JF.app ('change', 'session-complete') dan membandingkan
   hitungan sebelum-sesudah (tugas selesai, tugas baru, goal, milestone, jurnal, library). */
(function (root) {
  'use strict';
  var JF = root.JF;
  var shell, layer, talk, stage, content;
  var active = false, wired = false, snap = null, ambientT = null, talkT = null, liveB = 0, liveC = 0, page = 'beranda';
  var tipIdx = {}, last = { x: 0, y: 0, t: 0 }, lastFire = {};

  var FUN = ['Bintang laut bisa menumbuhkan lengannya lagi. Kamu juga boleh mulai lagi.', 'Kepiting berjalan menyamping, tapi tetap sampai. Jalan pelan itu sah.', 'Penyu laut mengembara jauh dengan langkah kecil yang konsisten.'];
  var CALM = ['Tarik napas dalam, hembuskan pelan, lalu mulai sesi berikutnya.', 'Ubur-ubur tidak berenang melawan arus. Pilih satu tugas, ikuti alurnya.', 'Minum air dulu. Laut juga butuh jeda.'];

  function reduce() { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function say(text) {
    if (!talk) return;
    talk.textContent = text;
    talk.classList.add('on');
    clearTimeout(talkT);
    talkT = setTimeout(function () { talk.classList.remove('on'); }, 7000);
  }

  function box() { return layer ? layer.getBoundingClientRect() : { left: 0, top: 0, width: 600, height: 400 }; }
  function local(x, y) {
    var r = box();
    return { x: Math.max(8, Math.min(r.width - 8, x - r.left)), y: Math.max(8, Math.min(r.height - 8, y - r.top)) };
  }
  function origin() {
    var r = box();
    if (Date.now() - last.t < 2500) return local(last.x, last.y);
    return { x: r.width / 2, y: r.height * 0.4 };
  }

  function spawn(html, cls, vars, ms) {
    var isB = cls.indexOf('mw-fx-bub') >= 0;   // gelembung dan makhluk dibatasi terpisah agar gelembung tidak menutup efek besar
    if (!layer || (isB ? liveB > 36 : liveC > 14)) return null;
    var el = document.createElement('div');
    el.className = 'mw-fx-item ' + cls;
    el.innerHTML = html;
    if (vars) Object.keys(vars).forEach(function (k) { el.style.setProperty(k, vars[k]); });
    layer.appendChild(el);
    if (isB) liveB++; else liveC++;
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); if (isB) liveB--; else liveC--; }, ms);
    return el;
  }

  /* ── efek ─────────────────────────────────────────────── */
  function bubbles(x, y, n) {
    if (reduce()) return;
    for (var i = 0; i < n; i++) {
      spawn('', 'mw-fx-bub', { '--x': x + 'px', '--y': y + 'px', '--s': rand(7, 20) + 'px', '--dx': rand(-50, 50) + 'px', '--dur': rand(1.2, 2.2) + 's', '--d': rand(0, 0.3) + 's' }, 3000);
    }
  }
  function fish(color, y, delay, dir) {
    var w = box().width;
    spawn('<svg viewBox="0 0 44 26" width="44" height="26"><path d="M3 13l10-7v14zM11 13q10-12 24-2l9-6v16l-9-6q-14 10-24 0z" fill="' + color + '" stroke="#1d2f55" stroke-width="1.6" stroke-linejoin="round"/><circle cx="31" cy="10" r="1.7" fill="#1d2f55"/></svg>',
      'mw-fx-fish' + (dir < 0 ? ' rtl' : ''), { '--w': w + 'px', '--y': y + 'px', '--dur': rand(5, 7) + 's', '--d': delay + 's' }, 8200);
  }
  function school() {
    if (reduce()) return;
    var h = box().height, cols = ['#4aa3d6', '#f4923f', '#7a8fd6', '#f08c7a', '#5fae6a'], dir = Math.random() < .5 ? 1 : -1;
    for (var i = 0; i < 5; i++) fish(cols[i], h * rand(.25, .75), i * 0.25, dir);
  }
  function crabWalk(label) {
    if (reduce()) return;
    var w = box().width, dir = Math.random() < .5 ? 1 : -1;
    spawn('<span class="mw-fx-flag"' + (label ? '' : ' hidden') + '>' + (label || '') + '</span>' + JF.molaCritters.svg('crab', 'walk'),
      'mw-fx-crab' + (dir < 0 ? ' rtl' : ''), { '--w': w + 'px', '--dur': rand(6, 8) + 's' }, 9000);
  }
  function molaLeap() {
    if (reduce()) return;
    var info = JF.mola.compute(JF.app.rawState()), w = box().width, h = box().height;
    spawn(JF.mola.svg({ stage: info.stage, mood: 'party', width: 150 }), 'mw-fx-leap', { '--w': w + 'px', '--h': h + 'px', '--dur': '3.2s' }, 3400);
    var o = origin();
    bubbles(o.x, o.y, 8);
  }
  function chest() {
    if (reduce()) return;
    var r = box();
    spawn(JF.molaCritters.svg('chest', 'big'), 'mw-fx-chest', { '--x': (r.width / 2 - 70) + 'px' }, 4200);
    bubbles(r.width / 2, r.height - 120, 10);
    confetti();
  }
  function star(x, y) {
    if (reduce()) return;
    spawn(JF.molaCritters.svg('star', 'pop'), 'mw-fx-star', { '--x': (x - 28) + 'px', '--y': (y - 28) + 'px' }, 1800);
    bubbles(x, y, 4);
  }
  function pearl(x, y) {
    if (reduce()) return;
    spawn(JF.molaCritters.svg('shell', 'glow'), 'mw-fx-shell', { '--x': (x - 34) + 'px', '--y': (y - 34) + 'px' }, 2400);
  }
  function octoPeek() {
    if (reduce()) return;
    spawn(JF.molaCritters.svg('octopus', 'peek'), 'mw-fx-octo', {}, 3600);
  }
  function confetti() {
    var c = shell && shell.querySelector('.mw-confetti');
    if (!c || reduce()) return;
    var colors = ['#f7b84a', '#e8744a', '#5aa6d6', '#8fd3e8', '#f08c7a'];
    c.innerHTML = '';
    for (var i = 0; i < 26; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%'; p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.4) + 's'; p.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      c.appendChild(p);
    }
    setTimeout(function () { c.innerHTML = ''; }, 2800);
  }

  /* ── pemicu dari fitur nyata ───────────────────────────── */
  function sig() {
    var st = JF.app.rawState(), tasks = st.tasks || [], ms = 0;
    (st.goals || []).forEach(function (g) { (g.milestones || []).forEach(function (m) { if (m && m.done) ms++; }); });
    return {
      done: tasks.filter(function (t) { return t.done && !t.archived; }).length,
      total: tasks.filter(function (t) { return !t.archived; }).length,
      goals: (st.goals || []).filter(function (g) { return g.status === 'completed'; }).length,
      ms: ms, journals: Object.keys(st.journals || {}).length, lib: (st.library || []).length
    };
  }
  function once(key, ms) {
    var n = Date.now();
    if (lastFire[key] && n - lastFire[key] < ms) return false;
    lastFire[key] = n; return true;
  }
  function onChange() {
    if (!active) return;
    var s = sig(), p = snap;
    snap = s;
    if (!p) return;
    var big = Math.abs(s.total - p.total) > 20 || Math.abs(s.done - p.done) > 20 || Math.abs(s.lib - p.lib) > 20; // impor/ganti data: tanpa perayaan
    if (big) return;
    var o = origin();
    if (s.goals > p.goals && once('goal', 1500)) { chest(); say('Goal tercapai! Peti hartanya terbuka.'); }
    if (s.ms > p.ms && once('ms', 800)) { star(o.x, o.y); say('Milestone selesai. Bintang laut ikut senang.'); }
    if (s.done > p.done && once('done', 800)) { bubbles(o.x, o.y, 9); crabWalk('Beres!'); say('Tugas selesai. Kepiting membawa bendera kemenangan.'); }
    if (s.total > p.total && s.done <= p.done && once('add', 800)) { bubbles(o.x, o.y, 5); say('Tugas baru masuk ke laut. Pilih yang paling kecil untuk mulai.'); }
    if (s.journals > p.journals && once('jr', 800)) { pearl(o.x, o.y); say('Jurnal tersimpan. Satu mutiara lagi di kerang.'); }
    if (s.lib > p.lib && once('lib', 800)) { octoPeek(); say('Dokumen masuk Library. Gurita menyimpannya.'); }
  }
  function onSession() {
    if (!active || !once('sess', 1500)) return;
    molaLeap(); say('Sesi fokus selesai. Mola melompat kegirangan!');
  }

  /* ── hidup sendiri: kehidupan laut acak ───────────────── */
  function ambientTick() {
    clearTimeout(ambientT);
    ambientT = setTimeout(function () {
      if (active && !document.hidden && !reduce() && page !== 'beranda') {
        var r = Math.random();
        if (r < .5) fish(pick(['#4aa3d6', '#f4923f', '#7a8fd6']), box().height * rand(.55, .9), 0, Math.random() < .5 ? 1 : -1);
        else if (r < .8) crabWalk('');
        else {
          var x = rand(40, box().width - 60);
          spawn(JF.molaCritters.svg('jelly', 'drift'), 'mw-fx-jelly', { '--x': x + 'px', '--h': box().height + 'px' }, 11000);
        }
      }
      ambientTick();
    }, rand(14000, 26000));
  }

  /* ── interaksi ────────────────────────────────────────── */
  function nextTip(id) {
    var p = JF.molaCritters.PAGE[id] || JF.molaCritters.PAGE.beranda;
    tipIdx[id] = ((tipIdx[id] == null ? -1 : tipIdx[id]) + 1) % p.tips.length;
    return p.tips[tipIdx[id]];
  }
  function react(btn) {
    btn.classList.remove('is-react'); void btn.offsetWidth; btn.classList.add('is-react');
    var r = btn.getBoundingClientRect(), o = local(r.left + r.width / 2, r.top + r.height / 2);
    bubbles(o.x, o.y, 4);
  }
  function setPage(id) {
    page = id;
    var btn = shell && shell.querySelector('.mw-critter');
    if (!btn) return;
    var def = JF.molaCritters.PAGE[id];
    btn.hidden = id === 'beranda' || !def;
    if (!def) return;
    btn.innerHTML = JF.molaCritters.svg(def.art, 'hdr');
    btn.dataset.art = def.art;
    btn.title = def.name + ' · klik untuk tips';
    btn.setAttribute('aria-label', 'Teman halaman ini: ' + def.name + '. Tekan untuk mendengar tips.');
  }
  function mount(sh) {
    shell = sh;
    stage = shell.querySelector('.mw-stage'); content = shell.querySelector('.mw-content');
    talk = shell.querySelector('.mw-talk');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'mw-fx'; layer.setAttribute('aria-hidden', 'true');
      stage.appendChild(layer);
    }
    if (wired) return;
    wired = true;
    shell.querySelectorAll('.mw-reef [data-critter]').forEach(function (b) {
      var kind = b.dataset.critter;
      b.innerHTML = JF.molaCritters.svg(kind === 'crab' ? 'crab' : kind === 'star' ? 'star' : 'jelly', 'rail');
      b.addEventListener('click', function () {
        react(b);
        say(kind === 'crab' ? nextTip(page) : kind === 'star' ? pick(FUN) : pick(CALM));
      });
    });
    var hb = shell.querySelector('.mw-critter');
    if (hb) hb.addEventListener('click', function () { react(hb); say(nextTip(page)); });
    content.addEventListener('pointerdown', function (e) {
      if (!active || e.target.closest('button, a, input, select, textarea, label, summary, canvas, table, .card, .mw-card, [role="button"]')) return;
      var o = local(e.clientX, e.clientY); bubbles(o.x, o.y, 3);
    });
    if (JF.app && JF.app.on) { JF.app.on('change', onChange); JF.app.on('session-complete', onSession); }
  }
  function track(e) { last.x = e.clientX; last.y = e.clientY; last.t = Date.now(); }
  function setActive(v) {
    v = !!v;
    if (v === active) return;
    active = v;
    if (v) { snap = null; try { snap = sig(); } catch (e) { snap = null; } root.addEventListener('pointerdown', track, true); ambientTick(); }
    else { root.removeEventListener('pointerdown', track, true); clearTimeout(ambientT); if (layer) layer.innerHTML = ''; liveB = 0; liveC = 0; }
  }

  JF.molaFx = { mount: mount, setActive: setActive, setPage: setPage, say: say, _test: { bubbles: bubbles, school: school, crabWalk: crabWalk, molaLeap: molaLeap, chest: chest, star: star, pearl: pearl, octoPeek: octoPeek, sig: sig } };
})(typeof self !== 'undefined' ? self : this);
