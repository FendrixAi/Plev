/* Fast Food memiliki shell dan rute sendiri; halaman Original tidak pernah dipasang di sini.
   Layout "Diner Counter": satu layar fokus, bilah atas tipis, dock di bawah, dan Menu Board (papan menu) yang naik dari dock.
   Mendukung mode siang dan malam (mengikuti JF.theme). Transisi: tirai kotak-kotak antarhalaman, dan bukaan melingkar
   siang <-> malam lewat View Transitions API (JF.themeTransition, dipakai oleh theme.js). */
(function (root) {
  'use strict';
  var JF = root.JF;
  var active = false, shell, content, wipe, board, boardOpen = false, currentId = 'beranda', petSig = '', timerSig = '';
  var renderedOnce = false, pendingRefresh = false, navTimer = 0, navToken = 0, lastMode = null;

  var routes = [
    ['beranda', 'Beranda', '🍔', 'Counter'], ['tugas', 'Tugas', '🧾', 'Tiket order'], ['kalender', 'Kalender', '🗓️', 'Papan menu'],
    ['analitik', 'Analitik', '📊', 'Papan penjualan'], ['riwayat', 'Riwayat fokus', '🕘', 'Gulungan struk'], ['laporan', 'Laporan harian', '📋', 'Closing shift'],
    ['goals', 'Goals', '⭐', 'Kartu stempel'], ['jurnal', 'Journaling', '📝', 'Napkin notes'], ['pengaturan', 'Pengaturan', '⚙️', 'Back office'], ['library', 'Library', '🗄️', 'Pantry']
  ];
  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function ctxNow() {
    var app = JF.app, st = app.rawState(), day = app.today(), s = app.currentSession();
    var today = JF.store.tasksTargeting(st, day);
    return {
      running: !!(s && s.state === 'running'), paused: !!(s && s.state === 'paused'), onBreak: !!app.breakInfo(),
      overdue: app.todayStats().overdue || 0, todayTotal: today.length,
      todayDone: today.filter(function (t) { return t.done; }).length
    };
  }

  var SUN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z"/></svg>';

  function makeShell() {
    if (shell) return;
    var A = JF.ffArt.src;
    shell = document.createElement('div');
    shell.className = 'ff-shell';
    shell.innerHTML =
      '<div class="ff-bg" aria-hidden="true"><i class="ff-glow"></i><i class="ff-bricks"></i></div>' +
      '<header class="ff-top">' +
        '<button class="ff-brand" type="button" aria-label="Buka Beranda"><img src="' + A.badge + '" alt="" draggable="false"><span>Jam Fokus</span></button>' +
        '<div class="ff-level" title=""><b class="ff-level-name"></b><span class="ff-xp" role="progressbar" aria-label="XP menuju tahap berikutnya" aria-valuemin="0" aria-valuemax="100"><i></i></span></div>' +
        '<button class="ff-timer-pill" type="button" hidden aria-live="off"></button>' +
        '<div class="ff-music" hidden></div>' +
        '<span class="ff-grow"></span>' +
        '<button class="ff-ico ff-mini" type="button" title="Buka kartu mini" aria-label="Buka kartu mini">▭</button>' +
        '<button class="ff-ico ff-theme" type="button"><span class="ff-theme-sun">' + SUN + '</span><span class="ff-theme-moon">' + MOON + '</span></button>' +
      '</header>' +
      '<section class="ff-stage">' +
        '<header class="ff-sign" hidden><div class="ff-sign-text"><span class="ff-date-line"></span><h1 class="ff-page-title"></h1><span class="ff-sub-line"></span></div><div class="ff-head-actions"></div></header>' +
        '<main class="ff-content"></main>' +
      '</section>' +
      '<footer class="ff-dock" role="navigation" aria-label="Navigasi cepat">' +
        '<button class="ff-dock-btn" type="button" data-go="analitik"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="4" y="11" width="3.6" height="9" rx="1"/><rect x="10.2" y="5" width="3.6" height="15" rx="1"/><rect x="16.4" y="9" width="3.6" height="11" rx="1"/></svg><span>Statistics</span></button>' +
        '<i class="ff-dock-sep"></i>' +
        '<button class="ff-dock-btn" type="button" data-go="pengaturan"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1"/></svg><span>Settings</span></button>' +
        '<span class="ff-grow"></span>' +
        '<button class="ff-dock-more" type="button" aria-expanded="false" aria-controls="ff-board" aria-label="Buka menu board"><span>Menu</span><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>' +
      '</footer>' +
      '<div class="ff-board" id="ff-board" hidden role="dialog" aria-label="Menu board"><div class="ff-board-in"><div class="ff-board-title"><span>MENU</span><small>Pilih halaman, seperti memesan di kiosk</small></div><div class="ff-board-grid"></div></div></div>' +
      '<div class="ff-wipe" aria-hidden="true"><i></i></div>' +
      '<div class="ff-confetti" aria-hidden="true"></div>';

    wipe = shell.querySelector('.ff-wipe');
    board = shell.querySelector('.ff-board');
    var grid = shell.querySelector('.ff-board-grid');
    routes.forEach(function (r, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ff-item'; b.dataset.page = r[0]; b.title = r[1];
      b.style.setProperty('--i', i);
      b.innerHTML = '<span class="ff-item-ico" aria-hidden="true">' + r[2] + '</span><span class="ff-item-text"><b>' + r[1] + '</b><small>' + r[3] + '</small></span>' +
        '<span class="ff-item-dots" aria-hidden="true"></span>' + (r[0] === 'tugas' ? '<span class="ff-badge" hidden></span>' : '');
      b.addEventListener('click', function () { setBoard(false); go(r[0]); });
      grid.appendChild(b);
    });
    shell.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { setBoard(false); go(b.dataset.go); }); });
    shell.querySelector('.ff-brand').addEventListener('click', function () { setBoard(false); go('beranda'); });
    shell.querySelector('.ff-mini').addEventListener('click', function () { if (root.desk && root.desk.mini) root.desk.mini(true); });
    shell.querySelector('.ff-timer-pill').addEventListener('click', function () { go('beranda'); });
    shell.querySelector('.ff-dock-more').addEventListener('click', function () { setBoard(!boardOpen); });
    board.addEventListener('click', function (e) { if (e.target === board) setBoard(false); });
    document.addEventListener('keydown', function (e) { if (active && boardOpen && e.key === 'Escape') setBoard(false); });
    var themeBtn = shell.querySelector('.ff-theme');
    themeBtn.addEventListener('click', function () {
      var r = themeBtn.getBoundingClientRect();
      if (JF.themeTransition) JF.themeTransition.origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      JF.theme.toggle();
    });
    content = shell.querySelector('.ff-content');
    content.addEventListener('focusout', function () {
      setTimeout(function () { if (pendingRefresh && !editingInside()) { pendingRefresh = false; render(currentId, true); } }, 0);
    });
    document.getElementById('app').appendChild(shell);
    if (JF.app && JF.app.on) JF.app.on('music', renderMusic);
    renderMusic();
  }

  function go(id) { if (id === currentId) { setBoard(false); return; } root.location.hash = '#' + id; }

  function setBoard(open) {
    open = !!open;
    if (!board || open === boardOpen) return;
    boardOpen = open;
    shell.querySelector('.ff-dock-more').setAttribute('aria-expanded', String(open));
    shell.classList.toggle('board-open', open);
    if (open) { board.hidden = false; void board.offsetWidth; board.classList.add('is-open'); var cur = board.querySelector('.ff-item.is-current'); if (cur) cur.focus({ preventScroll: true }); }
    else { board.classList.remove('is-open'); setTimeout(function () { if (!boardOpen) board.hidden = true; }, reduced() ? 0 : 320); }
  }

  /* Hanya aktif saat experience ini terpilih. Mode siang/malam mengikuti pengaturan tema, bukan dipaksa. */
  function setActive(value) {
    value = !!value;
    var app = document.getElementById('app');
    if (value) {
      active = true;
      app.classList.add('fast-food-active');
      document.documentElement.setAttribute('data-experience', 'fast-food');
      document.documentElement.setAttribute('data-theme', JF.theme.get());
      lastMode = JF.theme.get();
      makeShell();
      shell.hidden = false;
    } else {
      active = false;
      app.classList.remove('fast-food-active');
      if (shell) { shell.hidden = true; setBoard(false); }
    }
  }

  function updateHeader(id) {
    var r = routes.filter(function (x) { return x[0] === id; })[0];
    if (!r) return;
    var home = id === 'beranda';
    shell.classList.toggle('is-home', home);
    shell.dataset.page = id;
    var sign = shell.querySelector('.ff-sign');
    sign.hidden = home;
    shell.querySelector('.ff-page-title').textContent = r[1];
    shell.querySelector('.ff-date-line').textContent = r[3].toUpperCase() + ' · ' + JF.ui.fmt.dateLong(JF.dates.startOfDay(JF.app.today()));
    shell.querySelectorAll('.ff-item').forEach(function (b) {
      var on = b.dataset.page === id;
      b.classList.toggle('is-current', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    shell.querySelectorAll('.ff-dock-btn').forEach(function (b) { b.classList.toggle('is-current', b.dataset.go === id); });
    var dot = shell.querySelector('.ff-badge');
    if (dot) {
      var n = JF.app.todayStats().overdue || 0;
      dot.hidden = !n;
      dot.textContent = n > 99 ? '99+' : String(n);
    }
    var tb = shell.querySelector('.ff-theme'), dark = JF.theme.get() === 'dark';
    tb.setAttribute('aria-pressed', String(dark));
    tb.setAttribute('aria-label', dark ? 'Ganti ke mode siang' : 'Ganti ke mode malam');
    tb.title = dark ? 'Ganti ke mode siang' : 'Ganti ke mode malam';
  }

  var STAGE_KEY = 'jamfokus.fastfood.stage';
  function updatePet() {
    var B = JF.burger;
    if (!B || !shell) return;
    var info = B.compute(JF.app.rawState());
    var sig = info.stage + '|' + info.xp;
    shell.querySelector('.ff-level-name').textContent = 'Lv.' + info.level + ' · ' + info.name;
    var bar = shell.querySelector('.ff-xp');
    bar.setAttribute('aria-valuenow', String(info.pct));
    bar.title = info.max ? info.xp + ' XP · tahap tertinggi' : info.xp + ' XP · ' + info.toNext + ' XP lagi menuju ' + info.next.name;
    bar.firstChild.style.width = info.pct + '%';
    if (sig === petSig) return;
    petSig = sig;
    var seen = null;
    try { seen = localStorage.getItem(STAGE_KEY); } catch (e) { /* preferensi tampilan saja */ }
    if (seen == null) { try { localStorage.setItem(STAGE_KEY, String(info.stage)); } catch (e) {} return; }
    if (Number(seen) !== info.stage) {
      var up = info.stage > Number(seen);
      try { localStorage.setItem(STAGE_KEY, String(info.stage)); } catch (e) {}
      if (up) { celebrate(); JF.ui.toast('Burger naik jadi ' + info.name + '! Kerja bagus.', { kind: 'ok', timeout: 6000 }); }
    }
  }

  function celebrate() {
    var box = shell && shell.querySelector('.ff-confetti');
    if (!box || reduced()) return;
    var colors = ['#e5483b', '#ffc247', '#fff1de', '#8bbf3f', '#f28a2e'];
    box.innerHTML = '';
    for (var i = 0; i < 30; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.4) + 's';
      p.style.setProperty('--dx', (Math.random() * 140 - 70) + 'px');
      box.appendChild(p);
    }
    setTimeout(function () { box.innerHTML = ''; }, 2900);
  }

  function renderMusic() {
    if (!shell) return;
    var box = shell.querySelector('.ff-music'), m = JF.app && JF.app.music, st = m && m.status;
    box.textContent = '';
    if (!st || !st.active) { box.hidden = true; return; }
    box.hidden = false;
    var t = document.createElement('span');
    t.className = 'ff-music-title';
    t.textContent = '♪ ' + (st.track ? st.track.name : '—');
    t.title = (st.paused ? 'Musik dijeda' : 'Sedang diputar') + (st.count > 1 ? ' · lagu ' + (st.index + 1) + ' dari ' + st.count : '');
    box.appendChild(t);
    [[st.paused ? '▶' : '❚❚', st.paused ? 'Lanjutkan musik' : 'Jeda musik', function () { m.togglePause(); }],
     ['⏭', 'Lagu berikutnya', function () { m.next(); }],
     ['■', 'Hentikan musik', function () { m.stopAllMusic(); }]].forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = it[0]; b.title = it[1]; b.setAttribute('aria-label', it[1]);
      b.addEventListener('click', it[2]);
      box.appendChild(b);
    });
  }

  function updateTimer() {
    if (!shell) return;
    var app = JF.app, pill = shell.querySelector('.ff-timer-pill');
    var brk = app.breakInfo(), s = app.currentSession(), text = '', cls = '';
    if (brk) { text = JF.ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000))) + ' · Istirahat'; cls = 'is-break'; }
    else if (s && (s.state === 'running' || s.state === 'paused')) {
      var clock = JF.sessions.isOpen(s) ? '+' + JF.ui.fmt.mmss(JF.sessions.activeSeconds(s, Date.now())) : JF.ui.fmt.mmss(JF.sessions.remainingSeconds(s, Date.now()));
      if (s.state === 'running') { text = clock + ' · ' + (s.taskName || 'Fokus'); cls = 'is-run'; }
      else { text = clock + ' · dijeda'; cls = 'is-paused'; }
    }
    if (currentId === 'beranda') { text = ''; cls = ''; }
    var sig = cls + '|' + text;
    if (sig === timerSig) return;
    timerSig = sig;
    pill.hidden = !text;
    pill.className = 'ff-timer-pill ' + cls;
    pill.textContent = text;
    pill.title = 'Kembali ke timer fokus';
  }

  /* Isi halaman diganti saat tirai kotak-kotak menutup layar; tanpa tirai bila refresh data biasa. */
  function paint(id) {
    makeShell(); updateHeader(id); updatePet();
    JF.ffPages.render(id, content);
    shell.hidden = false;
    timerSig = ''; updateTimer();
  }

  function render(id, instant) {
    if (!active) return;
    var changed = currentId !== id || !renderedOnce;
    var first = !renderedOnce;
    makeShell();
    clearTimeout(navTimer); navToken += 1;
    if (!changed || instant || first || reduced()) {
      renderedOnce = true; currentId = id;
      paint(id);
      if (changed) { content.scrollTop = 0; enter(first); }
      return;
    }
    var token = navToken;
    wipe.classList.remove('go'); void wipe.offsetWidth; wipe.classList.add('go');
    navTimer = setTimeout(function () {
      if (token !== navToken) return;
      currentId = id;
      paint(id);
      content.scrollTop = 0;
      content.classList.remove('ff-in'); void content.offsetWidth; content.classList.add('ff-in');
    }, 300);
    setTimeout(function () { if (token === navToken) wipe.classList.remove('go'); }, 760);
  }
  function enter() {
    if (reduced()) return;
    content.classList.remove('ff-in'); void content.offsetWidth; content.classList.add('ff-in');
  }

  function editingInside() {
    var a = document.activeElement;
    if (!a || !content || !content.contains(a)) return false;
    if (a.tagName === 'TEXTAREA') return true;
    return a.tagName === 'INPUT' && !/^(button|checkbox|radio|submit|range|file|color)$/.test(a.type);
  }
  function refresh(id) {
    if (!active) return;
    if (editingInside()) { pendingRefresh = true; if (shell) { updateHeader(currentId); updatePet(); } return; }
    render(id, true);
  }

  function frame(ts) {
    if (!active) return;
    updateTimer();
    if (JF.ffPages && JF.ffPages.frame) JF.ffPages.frame(currentId, ts);
  }

  /* ── transisi siang <-> malam: bukaan melingkar dari tombol tema + cincin cahaya + lampu neon berkedip ── */
  var busy = false;
  JF.themeTransition = {
    origin: null,
    run: function (apply) {
      var h = document.documentElement;
      if (!active || busy || reduced() || !shell || !document.startViewTransition) { apply(); if (active && shell) afterSwitch(); return; }
      var o = JF.themeTransition.origin || { x: innerWidth - 40, y: 36 };
      JF.themeTransition.origin = null;
      var toDark = JF.theme.get() !== 'dark';
      var far = Math.hypot(Math.max(o.x, innerWidth - o.x), Math.max(o.y, innerHeight - o.y));
      busy = true;
      h.classList.add('ff-vt');
      h.style.setProperty('--ff-x', o.x + 'px'); h.style.setProperty('--ff-y', o.y + 'px');
      var t;
      try { t = document.startViewTransition(apply); } catch (e) { apply(); busy = false; h.classList.remove('ff-vt'); return; }
      t.ready.then(function () {
        var dur = 1050, ease = 'cubic-bezier(.65, 0, .25, 1)';
        try {
          h.animate({ '--ff-r': ['0px', Math.ceil(far + 130) + 'px'] }, { duration: dur, easing: ease, fill: 'forwards', pseudoElement: '::view-transition-new(root)' });
          h.animate({ filter: [toDark ? 'brightness(1.5) saturate(1.35)' : 'brightness(1.12) saturate(1.2)', 'none'] }, { duration: dur, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' });
        } catch (e) { /* tanpa animasi: perpindahan langsung */ }
      }).catch(function () { /* transisi dibatalkan: tidak apa-apa */ });
      t.finished.then(function () { cleanup(); afterSwitch(); }, function () { cleanup(); afterSwitch(); });
      function cleanup() { busy = false; h.classList.remove('ff-vt'); h.style.removeProperty('--ff-x'); h.style.removeProperty('--ff-y'); }
    }
  };
  function afterSwitch() {
    var mode = JF.theme.get();
    if (mode === lastMode) return;
    lastMode = mode;
    if (!shell || reduced()) return;
    shell.classList.remove('fx-night', 'fx-day'); void shell.offsetWidth;
    shell.classList.add(mode === 'dark' ? 'fx-night' : 'fx-day');
    setTimeout(function () { if (shell) shell.classList.remove('fx-night', 'fx-day'); }, 2200);
  }

  JF.experiences = JF.experiences || {};
  JF.experiences.fastFood = { setActive: setActive, render: render, refresh: refresh, frame: frame };
})(typeof self !== 'undefined' ? self : this);
