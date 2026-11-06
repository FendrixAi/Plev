/* Mola World memiliki shell dan rute sendiri; halaman Original tidak pernah dipasang di sini.
   Layout: kartu maskot di rel kiri, panggung konten di tengah, rel pelampung (navigasi) di kanan.
   Tampilan ini hanya punya mode siang: tidak ada mode malam. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var active = false, shell, content, currentId = 'beranda', petSig = '', timerSig = '', renderedOnce = false, pendingRefresh = false;

  var routes = [
    ['beranda', 'Beranda', '🏝️'], ['tugas', 'Tugas', '🐚'], ['kalender', 'Kalender', '🌊'],
    ['analitik', 'Analitik', '🐠'], ['riwayat', 'Riwayat fokus', '🧭'], ['laporan', 'Laporan harian', '🪸'],
    ['goals', 'Goals', '⚓'], ['jurnal', 'Journaling', '🫧'], ['pengaturan', 'Pengaturan', '⚙️'], ['library', 'Library', '💎']
  ];

  function ctxNow() {
    var app = JF.app, st = app.rawState(), day = app.today(), s = app.currentSession();
    var today = JF.store.tasksTargeting(st, day);
    return {
      running: !!(s && s.state === 'running'), paused: !!(s && s.state === 'paused'), onBreak: !!app.breakInfo(),
      overdue: app.todayStats().overdue || 0, todayTotal: today.length,
      todayDone: today.filter(function (t) { return t.done; }).length
    };
  }

  function makeShell() {
    if (shell) return;
    shell = document.createElement('div');
    shell.className = 'mw-shell';
    shell.innerHTML =
      '<div class="mw-sea" aria-hidden="true"><i class="mw-sun"></i><i class="mw-wave w1"></i><i class="mw-wave w2"></i>' +
        '<i class="mw-bub b1"></i><i class="mw-bub b2"></i><i class="mw-bub b3"></i><i class="mw-bub b4"></i><i class="mw-bub b5"></i></div>' +
      '<aside class="mw-side" aria-label="Mola dan alat cepat">' +
        '<button class="mw-pet" type="button" aria-label="Buka Beranda, rumah Mola"><span class="mw-pet-art"></span></button>' +
        '<div class="mw-pet-info"><b>Mola</b><small class="mw-pet-level"></small>' +
          '<span class="mw-xp" role="progressbar" aria-label="XP menuju tahap berikutnya" aria-valuemin="0" aria-valuemax="100"><i></i></span></div>' +
        '<button class="mw-timer-pill" type="button" hidden aria-live="off"></button>' +
        '<div class="mw-music" hidden></div>' +
        '<div class="mw-reef" role="group" aria-label="Teman laut"><button type="button" data-critter="crab" aria-label="Kepiting: tips halaman ini" title="Kepiting"></button><button type="button" data-critter="star" aria-label="Bintang laut: fakta singkat" title="Bintang laut"></button><button type="button" data-critter="jelly" aria-label="Ubur-ubur: tarik napas" title="Ubur-ubur"></button><p class="mw-talk" role="status" aria-live="polite"></p></div>' +
        '<button class="mw-mini" type="button" title="Buka kartu mini" aria-label="Buka kartu mini">▭ Kartu mini</button>' +
      '</aside>' +
      '<section class="mw-stage">' +
        '<header class="mw-head"><button class="mw-critter" type="button" hidden></button><div class="mw-head-text"><span class="mw-date-line"></span><h1 class="mw-page-title"></h1><span class="mw-sub-line"></span></div><div class="mw-head-actions"></div></header>' +
        '<main class="mw-content"></main>' +
      '</section>' +
      '<nav class="mw-buoys" aria-label="Navigasi produktivitas"></nav>' +
      '<div class="mw-confetti" aria-hidden="true"></div>';

    var nav = shell.querySelector('.mw-buoys');
    routes.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'mw-buoy'; b.dataset.page = r[0]; b.title = r[1];
      b.setAttribute('aria-label', r[1]);
      b.innerHTML = '<span class="mw-buoy-ico" aria-hidden="true">' + r[2] + '</span><span class="mw-buoy-label">' + r[1] + '</span>' +
        (r[0] === 'tugas' ? '<span class="mw-badge" hidden></span>' : '');
      b.addEventListener('click', function () { root.location.hash = '#' + r[0]; });
      nav.appendChild(b);
    });
    shell.querySelector('.mw-pet').addEventListener('click', function () { if (currentId !== 'beranda') root.location.hash = '#beranda'; });
    shell.querySelector('.mw-mini').addEventListener('click', function () { if (root.desk && root.desk.mini) root.desk.mini(true); });
    shell.querySelector('.mw-timer-pill').addEventListener('click', function () { root.location.hash = '#beranda'; });
    content = shell.querySelector('.mw-content');
    if (JF.molaFx) JF.molaFx.mount(shell);
    content.addEventListener('focusout', function () {
      setTimeout(function () { if (pendingRefresh && !editingInside()) { pendingRefresh = false; render(currentId); } }, 0);
    });
    document.getElementById('app').appendChild(shell);
    if (JF.app && JF.app.on) JF.app.on('music', renderMusic);
    renderMusic();
  }

  /* Mola hanya siang: paksa terang, apa pun pilihan tema Original atau pengaturan sistem. */
  function setActive(value) {
    value = !!value;
    var app = document.getElementById('app');
    if (value) {
      active = true;
      app.classList.add('mola-world-active');
      document.documentElement.setAttribute('data-experience', 'mola-world');
      document.documentElement.setAttribute('data-theme', 'light');
      makeShell();
      shell.hidden = false;
      if (JF.molaFx) JF.molaFx.setActive(true);
    } else {
      active = false;
      if (JF.molaFx) JF.molaFx.setActive(false);
      app.classList.remove('mola-world-active');
      if (shell) shell.hidden = true;
    }
  }

  function updateHeader(id) {
    var r = routes.filter(function (x) { return x[0] === id; })[0];
    if (!r) return;
    shell.querySelector('.mw-page-title').textContent = r[1];
    shell.querySelector('.mw-date-line').textContent = JF.ui.fmt.dateLong(JF.dates.startOfDay(JF.app.today()));
    shell.querySelectorAll('.mw-buoy').forEach(function (b) {
      var on = b.dataset.page === id;
      b.classList.toggle('is-current', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    var dot = shell.querySelector('.mw-badge');
    if (dot) {
      var n = JF.app.todayStats().overdue || 0;
      dot.hidden = !n;
      dot.textContent = n > 99 ? '99+' : String(n);
    }
  }

  var STAGE_KEY = 'jamfokus.mola.stage';
  function updatePet() {
    var M = JF.mola;
    if (!M || !shell) return;
    var info = M.compute(JF.app.rawState());
    var mood = JF.capyrafi.moodOf(ctxNow());
    var sig = info.stage + '|' + mood;
    if (sig !== petSig) { petSig = sig; shell.querySelector('.mw-pet-art').innerHTML = M.svg({ stage: info.stage, mood: mood }); }
    shell.querySelector('.mw-pet-level').textContent = 'Lv.' + info.level + ' · ' + info.name;
    var bar = shell.querySelector('.mw-xp');
    bar.setAttribute('aria-valuenow', String(info.pct));
    bar.title = info.max ? info.xp + ' XP · tahap tertinggi' : info.xp + ' XP · ' + info.toNext + ' XP lagi menuju ' + info.next.name;
    bar.firstChild.style.width = info.pct + '%';
    var seen = null;
    try { seen = localStorage.getItem(STAGE_KEY); } catch (e) { /* preferensi tampilan saja */ }
    if (seen == null) { try { localStorage.setItem(STAGE_KEY, String(info.stage)); } catch (e) {} return; }
    if (Number(seen) !== info.stage) {
      var up = info.stage > Number(seen);
      try { localStorage.setItem(STAGE_KEY, String(info.stage)); } catch (e) {}
      if (up) { celebrate(); JF.ui.toast('Mola naik jadi ' + info.name + '! Kerja bagus.', { kind: 'ok', timeout: 6000 }); }
    }
  }

  function celebrate() {
    var box = shell && shell.querySelector('.mw-confetti');
    if (!box) return;
    var colors = ['#f7b84a', '#e8744a', '#5aa6d6', '#8fd3e8', '#f08c7a'];
    box.innerHTML = '';
    for (var i = 0; i < 26; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.4) + 's';
      p.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      box.appendChild(p);
    }
    setTimeout(function () { box.innerHTML = ''; }, 2800);
  }

  function renderMusic() {
    if (!shell) return;
    var box = shell.querySelector('.mw-music'), m = JF.app && JF.app.music, st = m && m.status;
    box.textContent = '';
    if (!st || !st.active) { box.hidden = true; return; }
    box.hidden = false;
    var t = document.createElement('span');
    t.className = 'mw-music-title';
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
    var app = JF.app, pill = shell.querySelector('.mw-timer-pill');
    var brk = app.breakInfo(), s = app.currentSession(), text = '', cls = '';
    if (brk) { text = JF.ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000))) + ' · Istirahat'; cls = 'is-break'; }
    else if (s && (s.state === 'running' || s.state === 'paused')) {
      var clock = JF.sessions.isOpen(s) ? '+' + JF.ui.fmt.mmss(JF.sessions.activeSeconds(s, Date.now())) : JF.ui.fmt.mmss(JF.sessions.remainingSeconds(s, Date.now()));
      if (s.state === 'running') { text = clock + ' · ' + (s.taskName || 'Fokus'); cls = 'is-run'; }
      else { text = clock + ' · dijeda'; cls = 'is-paused'; }
    }
    var sig = cls + '|' + text;
    if (sig === timerSig) return;
    timerSig = sig;
    pill.hidden = !text;
    pill.className = 'mw-timer-pill ' + cls;
    pill.textContent = text;
    pill.title = 'Kembali ke timer fokus';
  }

  function render(id) {
    if (!active) return;
    var changed = currentId !== id || !renderedOnce;
    renderedOnce = true; currentId = id;
    makeShell(); updateHeader(id); updatePet();
    if (JF.molaFx) JF.molaFx.setPage(id);
    JF.molaPages.render(id, content);
    if (changed) content.scrollTop = 0;
    shell.hidden = false;
    timerSig = ''; updateTimer();
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
    render(id);
  }

  function frame(ts) {
    if (!active) return;
    updateTimer();
    if (JF.molaPages && JF.molaPages.frame) JF.molaPages.frame(currentId, ts);
  }

  JF.experiences = JF.experiences || {};
  JF.experiences.molaWorld = { setActive: setActive, render: render, refresh: refresh, frame: frame };
})(typeof self !== 'undefined' ? self : this);
