/* Capybara World owns its shell and route rendering; Original pages are never mounted here.
   Layout: HUD di atas (CapyRafi, judul, timer, musik) + dock melayang di bawah. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var active = false;
  var shell;
  var content;
  var currentId = 'beranda';
  var hudSig = '';
  var timerSig = '';
  var renderedOnce = false;

  var routes = [
    ['beranda', 'Beranda', 'M4 10.5 12 4l8 6.5V20H4z', 'M9 20v-6h6v6'],
    ['tugas', 'Tugas', 'M5 4h14v16H5z', 'm8 12 2.5 2.5L16 9'],
    ['kalender', 'Kalender', 'M4 6h16v15H4z', 'M8 3v6M16 3v6M4 10h16'],
    ['analitik', 'Analitik', 'M4 20V4M4 20h17', 'm7 15 4-5 3 2 5-7'],
    ['riwayat', 'Riwayat fokus', 'M20 12a8 8 0 1 1-2.4-5.7', 'M12 7v5l3 2'],
    ['laporan', 'Laporan harian', 'M6 3h9l4 4v14H6z', 'M9 12h7M9 16h7'],
    ['goals', 'Goals', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 7v10m-5-5h10'],
    ['jurnal', 'Journaling', 'M5 3h14v18H5z', 'M8 8h8M8 12h8M8 16h5'],
    ['pengaturan', 'Pengaturan', 'M4 7h16M4 17h16', 'M9 7a2 2 0 1 0 0 .1M15 17a2 2 0 1 0 0 .1'],
    ['library', 'Library', 'M4 4h7v16H4zM13 4h7v16h-7z', 'M6 8h3m6 0h3']
  ];

  function ctxNow() {
    var app = JF.app, st = app.rawState(), day = app.today();
    var session = app.currentSession();
    var today = JF.store.tasksTargeting(st, day);
    var ts = app.todayStats();
    return {
      dayKey: day,
      running: !!(session && session.state === 'running'),
      paused: !!(session && session.state === 'paused'),
      onBreak: !!app.breakInfo(),
      overdue: ts.overdue || 0,
      todayTotal: today.length,
      todayDone: today.filter(function (t) { return t.done; }).length
    };
  }

  function makeShell() {
    if (shell) return;
    shell = document.createElement('div');
    shell.className = 'cw-app-shell';
    shell.innerHTML =
      '<header class="cw-hud">' +
        '<button class="cw-pet" type="button" aria-label="Buka Beranda, rumah CapyRafi"><span class="cw-pet-art"></span></button>' +
        '<div class="cw-pet-info"><b>CapyRafi</b><small class="cw-pet-level"></small>' +
          '<span class="cw-xp" role="progressbar" aria-label="XP menuju tahap berikutnya" aria-valuemin="0" aria-valuemax="100"><i></i></span></div>' +
        '<div class="cw-hud-title"><span class="cw-date-line"></span><h1 class="cw-page-title"></h1></div>' +
        '<div class="cw-hud-tools">' +
          '<button class="cw-timer-pill" type="button" hidden aria-live="off"></button>' +
          '<div class="cw-music" hidden></div>' +
          '<button class="cw-mini" type="button" title="Buka kartu mini" aria-label="Buka kartu mini">▭</button>' +
          '<button class="cw-theme" type="button" aria-label="Ganti tema warna"></button>' +
        '</div>' +
      '</header>' +
      '<main class="cw-content"></main>' +
      '<nav class="cw-dock" aria-label="Navigasi produktivitas"></nav>' +
      '<div class="cw-confetti" aria-hidden="true"></div>';

    var nav = shell.querySelector('.cw-dock');
    routes.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cw-route';
      button.dataset.page = item[0];
      button.title = item[1];
      button.setAttribute('aria-label', item[1]);
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + item[2] +
        '"/><path d="' + item[3] + '"/></svg><span class="cw-route-label">' + item[1] + '</span>' +
        (item[0] === 'tugas' ? '<span class="cw-badge-dot" hidden></span>' : '');
      button.addEventListener('click', function () { root.location.hash = '#' + item[0]; });
      nav.appendChild(button);
    });

    shell.querySelector('.cw-pet').addEventListener('click', function () {
      if (currentId !== 'beranda') root.location.hash = '#beranda';
      else if (JF.capybaraHome && JF.capybaraHome.poke) JF.capybaraHome.poke();
    });
    shell.querySelector('.cw-mini').addEventListener('click', function () {
      if (root.desk && root.desk.mini) root.desk.mini(true);
    });
    shell.querySelector('.cw-theme').addEventListener('click', function () { JF.theme.toggle(); });
    shell.querySelector('.cw-timer-pill').addEventListener('click', function () { root.location.hash = '#beranda'; });
    content = shell.querySelector('.cw-content');
    content.addEventListener('focusout', function () {
      setTimeout(function () {
        if (pendingRefresh && !editingInside()) { pendingRefresh = false; render(currentId); }
      }, 0);
    });
    document.getElementById('app').appendChild(shell);
    if (JF.app && JF.app.on) JF.app.on('music', renderMusic);
    renderMusic();
  }

  function setActive(value) {
    active = !!value;
    var app = document.getElementById('app');
    var originalStyles = document.getElementById('original-theme');
    app.classList.toggle('capybara-world-active', active);
    document.documentElement.setAttribute('data-experience', active ? 'capybara-world' : 'original');
    if (originalStyles) originalStyles.disabled = active;
    if (active) makeShell();
    if (shell) shell.hidden = !active;
  }

  function updateHeader(id) {
    var route = routes.filter(function (item) { return item[0] === id; })[0];
    if (!route) return;
    shell.querySelector('.cw-page-title').textContent = route[1];
    shell.querySelector('.cw-date-line').textContent = JF.ui.fmt.dateLong(JF.dates.startOfDay(JF.app.today()));
    shell.querySelectorAll('.cw-route').forEach(function (button) {
      var selected = button.dataset.page === id;
      button.classList.toggle('is-current', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
    });
    var dot = shell.querySelector('.cw-badge-dot');
    if (dot) {
      var n = JF.app.todayStats().overdue || 0;
      dot.hidden = !n;
      dot.textContent = n > 99 ? '99+' : String(n);
    }
  }

  /* ── CapyRafi di HUD + naik tahap ──────────────────────────────── */
  var STAGE_KEY = 'jamfokus.capyrafi.stage';
  function updatePet() {
    var cr = JF.capyrafi;
    if (!cr || !shell) return;
    var info = cr.compute(JF.app.rawState());
    var mood = cr.moodOf(ctxNow());
    var sig = info.stage + '|' + mood;
    if (sig !== hudSig) {
      hudSig = sig;
      shell.querySelector('.cw-pet-art').innerHTML = cr.svg({ stage: info.stage, mood: mood, crop: 'head' });
    }
    shell.querySelector('.cw-pet-level').textContent = 'Lv.' + info.level + ' · ' + info.name;
    var bar = shell.querySelector('.cw-xp');
    bar.setAttribute('aria-valuenow', String(info.pct));
    bar.title = info.max ? info.xp + ' XP · tahap tertinggi' : info.xp + ' XP · ' + info.toNext + ' XP lagi menuju ' + info.next.name;
    bar.firstChild.style.width = info.pct + '%';

    var seen = null;
    try { seen = localStorage.getItem(STAGE_KEY); } catch (e) { /* preferensi tampilan saja */ }
    if (seen == null) { try { localStorage.setItem(STAGE_KEY, String(info.stage)); } catch (e) {} return; }
    if (Number(seen) !== info.stage) {
      var up = info.stage > Number(seen);
      try { localStorage.setItem(STAGE_KEY, String(info.stage)); } catch (e) {}
      if (up) {
        celebrate();
        JF.ui.toast('CapyRafi naik jadi ' + info.name + '! Kerja bagus.', { kind: 'ok', timeout: 6000 });
      }
    }
  }

  function celebrate() {
    var box = shell && shell.querySelector('.cw-confetti');
    if (!box) return;
    var colors = ['#f2c24b', '#e8744a', '#6fa56a', '#f08fb0', '#5aa6d6'];
    box.innerHTML = '';
    for (var i = 0; i < 28; i++) {
      var piece = document.createElement('i');
      piece.style.left = (Math.random() * 100) + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      piece.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      box.appendChild(piece);
    }
    setTimeout(function () { box.innerHTML = ''; }, 2600);
  }

  /* ── musik global ──────────────────────────────────────────────── */
  function renderMusic() {
    if (!shell) return;
    var box = shell.querySelector('.cw-music');
    var m = JF.app && JF.app.music;
    var st = m && m.status;
    box.textContent = '';
    if (!st || !st.active) { box.hidden = true; return; }
    box.hidden = false;
    var title = document.createElement('span');
    title.className = 'cw-music-title';
    title.textContent = '♪ ' + (st.track ? st.track.name : '—');
    title.title = (st.paused ? 'Musik dijeda' : 'Sedang diputar') + (st.count > 1 ? ' · lagu ' + (st.index + 1) + ' dari ' + st.count : '');
    box.appendChild(title);
    [[st.paused ? '▶' : '❚❚', st.paused ? 'Lanjutkan musik' : 'Jeda musik', function () { m.togglePause(); }],
     ['⏭', 'Lagu berikutnya', function () { m.next(); }],
     ['■', 'Hentikan musik', function () { m.stopAllMusic(); }]].forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = item[0]; b.title = item[1]; b.setAttribute('aria-label', item[1]);
      b.addEventListener('click', item[2]);
      box.appendChild(b);
    });
  }

  /* ── pil timer global (dipanggil tiap frame, hanya menyentuh DOM saat teks berubah) ── */
  function updateTimer() {
    if (!shell) return;
    var app = JF.app, pill = shell.querySelector('.cw-timer-pill');
    var brk = app.breakInfo(), s = app.currentSession(), text = '', cls = '';
    if (brk) {
      text = JF.ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000))) + ' · Istirahat'; cls = 'is-break';
    } else if (s && (s.state === 'running' || s.state === 'paused')) {
      // Waktu bebas menghitung maju (+mm:ss); sesi biasa menghitung mundur.
      var clock = JF.sessions.isOpen(s)
        ? '+' + JF.ui.fmt.mmss(JF.sessions.activeSeconds(s, Date.now()))
        : JF.ui.fmt.mmss(JF.sessions.remainingSeconds(s, Date.now()));
      if (s.state === 'running') { text = clock + ' · ' + (s.taskName || 'Fokus'); cls = 'is-run'; }
      else { text = clock + ' · dijeda'; cls = 'is-paused'; }
    }
    var sig = cls + '|' + text;
    if (sig === timerSig) return;
    timerSig = sig;
    pill.hidden = !text;
    pill.className = 'cw-timer-pill ' + cls;
    pill.textContent = text;
    pill.title = 'Kembali ke timer fokus';
  }

  function render(id) {
    if (!active) return;
    var pageChanged = currentId !== id || !renderedOnce;
    renderedOnce = true;
    currentId = id;
    makeShell();
    updateHeader(id);
    updatePet();
    JF.capybaraPages.render(id, content);
    if (pageChanged) content.scrollTop = 0;
    shell.hidden = false;
    timerSig = '';
    updateTimer();
  }

  /* Refresh dari perubahan data: jangan hancurkan kolom yang sedang diketik. */
  var pendingRefresh = false;
  function editingInside() {
    var a = document.activeElement;
    if (!a || !content || !content.contains(a)) return false;
    if (a.tagName === 'TEXTAREA') return true;
    return a.tagName === 'INPUT' && !/^(button|checkbox|radio|submit|range|file|color)$/.test(a.type);
  }
  function refresh(id) {
    if (!active) return;
    if (editingInside()) {
      pendingRefresh = true;
      if (shell) { updateHeader(currentId); updatePet(); }
      return;
    }
    render(id);
  }

  function frame(ts) {
    if (!active) return;
    updateTimer();
    if (JF.capybaraPages && JF.capybaraPages.frame) JF.capybaraPages.frame(currentId, ts);
  }

  JF.experiences = JF.experiences || {};
  JF.experiences.capybaraWorld = {
    setActive: setActive,
    render: render,
    refresh: refresh,
    frame: frame
  };
})(window);
