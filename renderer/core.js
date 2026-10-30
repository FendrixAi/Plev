/* ════════════════════════════════════════════════════════════════════
   Jam Fokus — renderer core
   • persistence (v1 -> v2 migration with backup, idempotent)
   • focus session engine (timestamp-based, pause-aware, crash recovery)
   • break/pomodoro flow, alarms & music (legacy behaviour preserved)
   • Mini Widget state contract (window.desk.state) — unchanged shapes
   Exposed as window.JF.app
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var JF = root.JF = root.JF || {};
  var K_V2 = 'jamfokus.v2', K_V1 = 'jamfokus.v1', K_POMO = 'jamfokus.pomo', K_BACKUP = 'jamfokus.v1.backup';

  var dates = JF.dates, store = JF.store, sess = JF.sessions, snapshots = JF.snapshots;

  /* ── tiny event bus ──────────────────────────────────────────────── */
  function createBus() {
    var map = {};
    return {
      on: function (k, fn) { (map[k] = map[k] || []).push(fn); return fn; },
      off: function (k, fn) { map[k] = (map[k] || []).filter(function (f) { return f !== fn; }); },
      emit: function (k, a, b) { (map[k] || []).slice().forEach(function (f) { try { f(a, b); } catch (e) { console.error('[bus:' + k + ']', e); } }); }
    };
  }

  /* ── persistence ─────────────────────────────────────────────────── */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { localStorage.setItem(k, v); }
  function parse(raw) { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

  var quotaWarned = false;
  function save() {
    var payload = JSON.stringify(state);
    try {
      lsSet(K_V2, payload);
    } catch (e) {
      if (!quotaWarned) {
        quotaWarned = true;
        JF.ui && JF.ui.toast('Penyimpanan lokal hampir penuh — data terbaru gagal disimpan. Ekspor cadangan di Pengaturan.', { kind: 'err', timeout: 12000 });
      }
      console.error('[save]', e);
      return false;
    }
    // Compatibility mirror: the old build keeps reading these keys.
    try {
      lsSet(K_POMO, JSON.stringify({
        on: state.settings.pomoOn, brk: state.settings.shortBreakMin, lbrk: state.settings.longBreakMin,
        lbrkN: state.settings.longBreakEvery, tar: state.settings.tasksPerDay, warn: state.settings.warn8,
        sessCount: state.settings.pomoSessCount || 0
      }));
      if (state.settings.lastDay) lsSet('jamfokus.sessDay', state.settings.lastDay);
    } catch (e) { /* mirror is best-effort */ }
    return true;
  }

  function normalizeSettings(s) {
    var d = store.defaultSettings();
    Object.keys(d).forEach(function (k) {
      if (s[k] === undefined || s[k] === null) s[k] = d[k];
    });
    if (!(s.defaultFocusTargetMin > 0)) s.defaultFocusTargetMin = d.defaultFocusTargetMin;
    if (!(s.defaultFocusSec > 0)) s.defaultFocusSec = d.defaultFocusSec;
    if (!s.targetOverrides || typeof s.targetOverrides !== 'object') s.targetOverrides = {};
    return s;
  }

  function load() {
    var v2 = parse(lsGet(K_V2));
    var migrated = false, backupWritten = false;
    if (v2 && typeof v2 === 'object' && v2.version >= store.SCHEMA_VERSION) {
      state = v2;
      state.sessions = state.sessions || [];
      state.snapshots = state.snapshots || [];
      state.legacyHist = state.legacyHist || [];
      state.events = state.events || [];
       state.tasks = state.tasks || [];
       if (!state.library || !Array.isArray(state.library)) state.library = [];
      if (!state.journals || typeof state.journals !== 'object' || Array.isArray(state.journals)) state.journals = {};
    } else {
      var v1 = parse(lsGet(K_V1));
      var pomo = parse(lsGet(K_POMO));
      // 1) Back up BEFORE the first v2 write (never overwritten afterwards).
      if (v1 && !lsGet(K_BACKUP)) {
        try { lsSet(K_BACKUP, JSON.stringify({ at: Date.now(), v1: v1, pomo: pomo })); backupWritten = true; } catch (e) {}
      }
      // 2) Deterministic migration (v1's own load-time timer recovery included).
      var r = JF.migrate.migrate({ v1: v1, pomo: pomo }, Date.now());
      state = r.state;
      migrated = r.migrated;
    }
     normalizeSettings(state.settings);
     if (JF.goals) JF.goals.normalize(state);
     if (JF.library) JF.library.normalize(state);
    app.state = state;
    return { migrated: migrated, backupWritten: backupWritten };
  }

  var state = null;

  /* ── boot: load + recover + rollover ─────────────────────────────── */
  function boot() {
    var info = load();
    var now = Date.now();
    var recovered = sess.recover(state, now);           // running -> paused, downtime not counted
    state.settings.lastDay = state.settings.lastDay || null;
    var today = dates.todayKey();
    var created = snapshots.backfill(state, today, now);
    state.settings.lastDay = today;
    save();
    return {
      migrated: info.migrated, backupWritten: info.backupWritten,
      recovered: recovered, backfilled: created
    };
  }

  /* ── queries ─────────────────────────────────────────────────────── */
  function today() { return dates.todayKey(); }
  function findTask(id) { return store.find(state, id); }
  function current() { return sess.currentSession(state); }

  function currentTask() {
    var s = current();
    if (s && s.taskId) return findTask(s.taskId);
    if (s) return null;
    return null;
  }

  /** Task whose state drives the idle/paused display (v1 activeId analogue). */
  function contextTask() {
    var s = current();
    if (s && s.taskId) return findTask(s.taskId);
    if (app.lastTaskId) return findTask(app.lastTaskId);
    return null;
  }

  /** Today's official completions: legacy hist (migrated data) + v2 first-completions.
      Migrated tasks are excluded from the second source because their completion
      already lives in legacyHist — no double counting. */
  function dailyCompletions(day) {
    var start = dates.startOfDay(day), end = dates.startOfDay(dates.addDays(day, 1)), n = 0;
    state.legacyHist.forEach(function (e) {
      if (!e || (e.type !== 'selesai' && e.type !== 'selesai-manual')) return;
      if (e.at >= start && e.at < end) n++;
    });
    state.tasks.forEach(function (t) {
      if (t.migrated || t.firstCompletedAt == null) return;
      if (t.firstCompletedAt >= start && t.firstCompletedAt < end) n++;
    });
    return n;
  }

  function todayStats() {
    var d = today(), start = dates.startOfDay(d), end = start + 86400000;
    var target = store.focusTargetFor(state, d);
    var official = sess.officialSeconds(state.sessions, start, end);
    var doneToday = store.tasksCompletedOn(state, d).length + state.tasks.filter(function (t) {
      if (!t.migrated || t.firstCompletedAt == null) return false;
      if (t.firstCompletedAt < start || t.firstCompletedAt >= end) return false;
      return !state.legacyHist.some(function (e) { return e && (e.type === 'selesai' || e.type === 'selesai-manual') && e.tid != null && String(e.tid) === t.id && e.at === t.firstCompletedAt; });
    }).length;
    var overdue = store.overdueTasks(state, d).length;
    var active = store.activeTasks(state, d).length;
    var upcoming = store.upcomingTasks(state, d).length;
    // Streak (legacy goal semantics: >= tasksPerDay completions per day)
    var streak = 0, cur = d, tar = state.settings.tasksPerDay;
    if ((dailyCompletions(d) || 0) < tar) cur = dates.addDays(d, -1);
    for (var i = 0; i < 400; i++) {
      if ((dailyCompletions(cur) || 0) >= tar) { streak++; cur = dates.addDays(cur, -1); } else break;
    }
    return {
      day: d, target: target, officialSec: official, doneToday: doneToday,
      overdue: overdue, active: active, upcoming: upcoming,
      tasksGoal: tar, goalDone: dailyCompletions(d), streak: streak
    };
  }

  /* ── break (pomodoro) state — persisted so it survives reload ───── */
  var brk = null;
  function saveBrk() {
    try { brk ? lsSet('jamfokus.brk', JSON.stringify(brk)) : localStorage.removeItem('jamfokus.brk'); } catch (e) {}
  }
  function loadBrk() {
    var b = parse(lsGet('jamfokus.brk'));
    if (b && b.endAt > Date.now() && b.total > 0) { brk = b; return; }
    if (b) { saveBrkTransientClear(); }
    function saveBrkTransientClear() { try { localStorage.removeItem('jamfokus.brk'); } catch (e) {} }
    brk = null;
  }

  /* ── audio: alarm + music (ported verbatim in behaviour) ────────── */
  var actx = null;
  function ctx() { try { actx = actx || new (root.AudioContext || root.webkitAudioContext)(); return actx; } catch (e) { return null; } }
  function beep() {
    var c = ctx(); if (!c) return;
    [0, 0.25, 0.5].forEach(function (d) {
      var o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + d); o.stop(c.currentTime + d + 0.15);
    });
  }
  function beepWarn() {
    var c = ctx(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.frequency.value = 660; g.gain.value = 0.06;
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime); o.stop(c.currentTime + 0.12);
  }

  function idb(cb) {
    try {
      var r = indexedDB.open('jamfokus-music', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('m'); };
      r.onsuccess = function () { cb(r.result); };
      r.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  }
  function idbPut(blob, name, key) { idb(function (db) { if (!db) return; try { db.transaction('m', 'readwrite').objectStore('m').put({ blob: blob, name: name }, key); } catch (e) {} }); }
  function idbDel(key) { idb(function (db) { if (!db) return; try { db.transaction('m', 'readwrite').objectStore('m').delete(key); } catch (e) {} }); }
  function idbGet(key, cb) { idb(function (db) { if (!db) return cb(null); try { var q = db.transaction('m').objectStore('m').get(key); q.onsuccess = function () { cb(q.result || null); }; q.onerror = function () { cb(null); }; } catch (e) { cb(null); } }); }

  var au = new Audio(), auR = new Audio(), musURL = null, musRURL = null;
  var music = {
    focusName: 'Bawaan (bunyi pendek)', breakName: 'Bawaan (bunyi pendek)',
    loop: lsGet('jamfokus.loop') === '1',
    playingFocus: false, playingBreak: false
  };
  au.loop = music.loop;
  function setMus(blob, name) {
    if (musURL) URL.revokeObjectURL(musURL);
    musURL = blob ? URL.createObjectURL(blob) : null;
    if (musURL) au.src = musURL; else au.removeAttribute('src');
    music.focusName = blob ? name : 'Bawaan (bunyi pendek)';
    app.emit('music');
  }
  function setMusR(blob, name) {
    if (musRURL) URL.revokeObjectURL(musRURL);
    musRURL = blob ? URL.createObjectURL(blob) : null;
    if (musRURL) auR.src = musRURL; else auR.removeAttribute('src');
    music.breakName = blob ? name : 'Bawaan (bunyi pendek)';
    app.emit('music');
  }
  function playTrack(au2, key) {
    if (!musURL && key === 'foc') return beep();
    if (!musRURL && key === 'rst') return beep();
    if (!au2.src) return beep();
    au2.currentTime = 0;
    var p = au2.play();
    if (key === 'foc') { music.playingFocus = true; app.emit('music'); }
    else { music.playingBreak = true; app.emit('music'); }
    if (p && p.catch) p.catch(function () { beep(); if (key === 'foc') music.playingFocus = false; else music.playingBreak = false; app.emit('music'); });
  }
  function stopAllMusic() {
    try { au.pause(); au.currentTime = 0; } catch (e) {}
    try { auR.pause(); auR.currentTime = 0; } catch (e) {}
    music.playingFocus = music.playingBreak = false;
    app.emit('music');
  }
  music.stopAllMusic = stopAllMusic;
  music.pickFocus = function (file, name) { stopAllMusic(); setMus(file, name); idbPut(file, name, 'foc'); };
  music.pickBreak = function (file, name) { stopAllMusic(); setMusR(file, name); idbPut(file, name, 'rst'); };
  music.clearFocus = function () { stopAllMusic(); setMus(null, null); idbDel('foc'); };
  music.clearBreak = function () { stopAllMusic(); setMusR(null, null); idbDel('rst'); };
  music.testFocus = function () { if (musURL) playTrack(au, 'foc'); else beep(); };
  music.testBreak = function () { if (musRURL) playTrack(auR, 'rst'); else beep(); };
  music.setLoop = function (on) { music.loop = !!on; au.loop = !!on; try { lsSet('jamfokus.loop', on ? '1' : '0'); } catch (e) {} };
  au.onended = function () { music.playingFocus = false; app.emit('music'); };
  auR.onended = function () { music.playingBreak = false; app.emit('music'); };

  // Load stored tracks (with the legacy "cur" -> "foc" migration).
  idbGet('cur', function (old) {
    if (old && old.blob) {
      idbPut(old.blob, old.name, 'foc');
      setMus(old.blob, old.name);
      idbDel('cur');
      return;
    }
    idbGet('foc', function (v) { if (v && v.blob) setMus(v.blob, v.name); });
  });
  idbGet('rst', function (v) { if (v && v.blob) setMusR(v.blob, v.name); });

  function alarmFocus() { 
    if (root.desk) root.desk.popup(); 
    // Completion alarms should not loop - play once then stop
    var wasLoop = au.loop;
    au.loop = false;
    playTrack(au, 'foc');
    // Restore loop setting after playback ends
    au.onended = function () { 
      music.playingFocus = false; 
      au.loop = wasLoop; 
      app.emit('music'); 
    };
  }
  function alarmBreak() { 
    if (root.desk) root.desk.popup(); 
    var wasLoop = auR.loop;
    auR.loop = false;
    playTrack(auR, 'rst'); 
    auR.onended = function () { 
      music.playingBreak = false; 
      auR.loop = wasLoop; 
      app.emit('music'); 
    };
  }
  function notify(title, body) {
    try { if (root.Notification && Notification.permission === 'granted') new Notification(title, { body: body }); } catch (e) {}
  }
  function askNotif() {
    try { if (root.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
  }

  /* ── Mini Widget state contract (shapes identical to v1) ────────── */
  function pushState() {
    if (!root.desk || !root.desk.state) return;
    var s = current(), t = null, out;
    if (brk) {
      var nx = brk.nextTaskId ? findTask(brk.nextTaskId) : null;
      out = { mode: 'brk', name: nx ? 'Berikutnya: ' + nx.title : 'Istirahat', endAt: brk.endAt, total: brk.total };
    } else if (s && s.state === 'running') {
      var rem = Math.max(0, Math.ceil(sess.remainingSeconds(s, Date.now())));
      out = { mode: 'run', name: s.taskName, endAt: Date.now() + rem * 1000, total: s.plannedSec };
    } else if (s && s.state === 'paused') {
      out = { mode: 'pause', name: s.taskName, left: Math.max(0, Math.ceil(sess.remainingSeconds(s, Date.now()))), total: s.plannedSec };
    } else {
      t = contextTask();
      var partial = t && !t.done && t.left < t.durationSec;
      if (t && partial) out = { mode: 'pause', name: t.title, left: t.left, total: t.durationSec };
      else out = { mode: 'idle', name: t ? t.title : '', left: t ? (t.left || 0) : 0, total: t ? (t.durationSec || 0) : 0, done: !!(t && t.done) };
    }
    root.desk.state(out);
  }

  /* ── timer engine ────────────────────────────────────────────────── */
  var warn8Fired = false;
  var app = {
    state: null,
    bus: createBus(),
    lastTaskId: null,
    selectedTaskId: null,
    breakInfo: function () { return brk; },
    music: music
  };
  app.on = app.bus.on.bind(app.bus);
  app.emit = app.bus.emit;
  app.save = function () { var ok = save(); app.emit('change'); return ok; };
  app.today = today;
  app.findTask = findTask;
  app.currentSession = current;
  app.contextTask = contextTask;
  app.dailyCompletions = dailyCompletions;
  app.todayStats = todayStats;
  app.pushState = pushState;

  function syncTaskLeft(s) {
    var t = s.taskId ? findTask(s.taskId) : null;
    if (t) t.left = Math.max(0, Math.round(sess.remainingSeconds(s, Date.now())));
    return t;
  }

  /** Start (or resume) focus. v1-equivalent: only one session runs at a time. */
  app.startTask = function (id, opts) {
    opts = opts || {};
    var t = id ? findTask(id) : null;
    if (id && (!t || t.done || t.archived)) return null;
    if (!t && !opts.standalone) {
      // pick first active task when caller passes null without standalone flag
      var act = store.activeTasks(state, today());
      t = act[0] || null;
    }
    ctx();
    var now = Date.now();

    // Leaving a break: cancel it (v1 start() set brk=null).
    if (brk) { brk = null; saveBrk(); }
    // Stop any playing alarm/music when starting a focus session
    try {
      if (JF && JF.app && JF.app.music && typeof JF.app.music.stopAllMusic === 'function') {
        JF.app.music.stopAllMusic();
      } else if (music && typeof music.stopAllMusic === 'function') {
        music.stopAllMusic();
      }
    } catch (e) {}

    var cur = current();
    if (cur) {
      if (cur.state === 'paused' && t && cur.taskId === t.id) {
        sess.resumeSession(state, cur, now);
        warn8Fired = false; askNotif();
        save(); app.lastTaskId = t.id; app.selectedTaskId = t.id;
        app.emit('change'); pushState();
        return cur;
      }
      // Another (or same but fresh) run: stop the previous one, honestly.
      sess.stopSession(state, cur, now);
      syncTaskLeft(cur);
      if (!opts.quiet) JF.ui && JF.ui.toast('Sesi sebelumnya dihentikan (terputus, tidak dihitung ke total fokus).', { kind: 'ok' });
    }

    var planned = t ? t.left : state.settings.defaultFocusSec;
    if (!(planned > 0)) planned = (t && t.durationSec > 0) ? t.durationSec : state.settings.defaultFocusSec;
    if (!(planned > 0)) planned = 1500;
    var s = sess.createSession(state, {
      taskId: t ? t.id : null,
      taskName: t ? t.title : 'Fokus tanpa tugas',
      plannedSec: planned
    }, now);
    warn8Fired = false;
    askNotif();
    if (t) { app.lastTaskId = t.id; app.selectedTaskId = t.id; }
    save(); app.emit('change'); pushState();
    return s;
  };

  app.pause = function () {
    var s = current();
    if (!s || s.state !== 'running') return false;
    sess.pauseSession(state, s, Date.now());
    syncTaskLeft(s);
    save(); app.emit('change'); pushState();
    return true;
  };

  app.resume = function () {
    var s = current();
    if (!s || s.state !== 'paused') return false;
    sess.resumeSession(state, s, Date.now());
    warn8Fired = false;
    save(); app.emit('change'); pushState();
    return true;
  };

  /** Permanent stop (with confirmation in UI): retained, never official. */
  app.stopPermanent = function () {
    var s = current();
    if (!s || (s.state !== 'running' && s.state !== 'paused')) return false;
    sess.stopSession(state, s, Date.now());
    syncTaskLeft(s);
    save(); app.emit('change'); pushState();
    JF.ui && JF.ui.toast('Sesi dihentikan — ' + fmtDur(s.activeSec) + ' tersimpan sebagai sesi terputus.', { kind: 'ok' });
    return true;
  };

  /** Manual task completion. A session running on it ends as interrupted. */
  app.completeTask = function (id) {
    var t = findTask(id);
    if (!t) return false;
    var s = current();
    if (s && s.taskId === id && (s.state === 'running' || s.state === 'paused')) {
      sess.stopSession(state, s, Date.now());
      syncTaskLeft(s);
    }
    var r = store.completeTask(state, id, Date.now(), 'user');
    if (r.ok && r.changed) {
      save(); app.emit('change');
      JF.ui && JF.ui.toast('Tugas ditandai selesai: ' + t.title, {
        action: { label: 'Urungkan', onClick: function () { app.reopenTask(id); } }, timeout: 7000
      });
    }
    return r.ok && r.changed;
  };

  app.reopenTask = function (id) {
    var r = store.reopenTask(state, id, Date.now());
    if (r.ok && r.changed) { save(); app.emit('change'); JF.ui && JF.ui.toast('Tugas dikembalikan ke daftar aktif.'); }
    return r.ok;
  };

  /** "Ulang": reset remaining time (and reopen a completed task). */
  app.resetTask = function (id) {
    var t = findTask(id);
    if (!t) return false;
    var s = current();
    if (s && s.taskId === id && (s.state === 'running' || s.state === 'paused')) {
      sess.stopSession(state, s, Date.now());
      syncTaskLeft(s);
    }
    if (t.done) { store.reopenTask(state, id, Date.now()); }
    t.left = t.durationSec;
    save(); app.emit('change');
    return true;
  };

  /* ── natural completion ──────────────────────────────────────────── */
  function onNaturalComplete(s) {
    sess.completeSession(state, s, Date.now());   // exactly once (guarded inside)
    var t = s.taskId ? findTask(s.taskId) : null;
    if (t) t.left = 0;                            // the timer consumed its remaining
    save();
    alarmFocus();
    app.emit('session-complete', s, t);
    app.emit('change');
    notify('Sesi selesai: ' + s.taskName, 'Fokus ' + fmtDur(s.plannedSec) + ' tercatat.');

    var settings = state.settings;
    if (settings.pomoOn) {
      // Legacy pomodoro behaviour, user-opted: auto break then next task.
      var next = null;
      for (var i = 0; i < state.tasks.length; i++) {
        var x = state.tasks[i];
        if (!x.done && !x.archived && x.id !== s.taskId) { next = x; break; }
      }
      settings.pomoSessCount = (settings.pomoSessCount || 0) + 1;
      if (next) {
        var isLong = settings.pomoSessCount >= settings.longBreakEvery;
        if (isLong) settings.pomoSessCount = 0;
        startBreak(isLong ? settings.longBreakMin : settings.shortBreakMin, next.id, isLong);
        save();
        JF.ui && JF.ui.toast('Sesi ' + fmtDur(s.plannedSec) + ' selesai · ' + (isLong ? 'Istirahat panjang' : 'Istirahat') + ' ' + (isLong ? settings.longBreakMin : settings.shortBreakMin) + ' menit, lalu ' + next.title, { timeout: 8000 });
      } else {
        save();
        JF.ui && JF.ui.toast('Sesi selesai — tidak ada tugas berikutnya.', { kind: 'ok' });
      }
      return;
    }
    // Default: summary + explicit next-step choices (never auto-starts).
    showCompletionChoices(s, t);
  }

  function showCompletionChoices(s, t) {
    JF.ui.modal({
      title: 'Sesi fokus selesai',
      body: [
        JF.ui.el('div', JF.ui.el('strong', s.taskName)),
        JF.ui.el('div.hint', { style: { marginTop: '4px' } },
          'Fokus ' + JF.ui.fmt.dur(s.plannedSec) + ' · tanpa waktu jeda.'),
        JF.ui.el('p.hint', { style: { marginTop: '10px' } },
          'Tugas tidak ditandai selesai otomatis dan sesi baru tidak dimulai otomatis. Pilih langkah berikutnya:')
      ],
      actions: [
        { label: 'Kembali ke tugas', ghost: true, onClick: function () { if (t) app.selectedTaskId = t.id; app.emit('change'); } },
        { label: 'Istirahat', ghost: true, onClick: function () { startBreak(state.settings.shortBreakMin, null, false); } },
        { label: 'Lanjut fokus', primary: true, onClick: function () { app.startTask(t ? t.id : null, { standalone: !t }); } }
      ],
      onClose: function () { app.emit('change'); }
    });
  }

  /* ── breaks ──────────────────────────────────────────────────────── */
  function startBreak(mins, nextTaskId, isLong) {
    // Stop any playing alarm/music when entering break mode
    try {
      if (JF && JF.app && JF.app.music && typeof JF.app.music.stopAllMusic === 'function') {
        JF.app.music.stopAllMusic();
      } else if (music && typeof music.stopAllMusic === 'function') {
        music.stopAllMusic();
      }
    } catch (e) {}
    brk = {
      endAt: Date.now() + mins * 60000, total: mins * 60,
      nextTaskId: nextTaskId || null, isLong: !!isLong
    };
    saveBrk();
    app.emit('change'); pushState();
  }
  app.startBreak = function (mins) { startBreak(mins || state.settings.shortBreakMin, null, false); };

  function endBreak(autoStart) {
    var nextId = brk && brk.nextTaskId;
    // Stop alarm/music when break ends/continues
    try {
      if (JF && JF.app && JF.app.music && typeof JF.app.music.stopAllMusic === 'function') {
        JF.app.music.stopAllMusic();
      } else if (music && typeof music.stopAllMusic === 'function') {
        music.stopAllMusic();
      }
    } catch (e) {}
    brk = null; saveBrk();
    state.events.push({ at: Date.now(), kind: 'break.ended', taskId: nextId || null });
    var nt = autoStart && nextId ? findTask(nextId) : null;
    if (nt && !nt.done && !nt.archived) {
      app.startTask(nt.id, { quiet: true });
      notify('Istirahat selesai', 'Lanjut: ' + nt.title);
    } else {
      save(); app.emit('change'); pushState();
    }
    if (autoStart) {
      alarmBreak();
    }
  }
  app.skipBreak = function () { if (brk) { 
    // Stop alarm/music when skipping break/continuing to task
    try {
      if (JF && JF.app && JF.app.music && typeof JF.app.music.stopAllMusic === 'function') {
        JF.app.music.stopAllMusic();
      } else if (music && typeof music.stopAllMusic === 'function') {
        music.stopAllMusic();
      }
    } catch (e) {}
    endBreak(false); 
    JF.ui && JF.ui.toast('Istirahat dilewati.'); 
  } };

  /* ── per-second check (v1's setInterval(check,500) semantics) ────── */
  var lastPush = 0;
  function check() {
    var now = Date.now();
    var s = current();
    if (s && s.state === 'running') {
      var rem = sess.remainingSeconds(s, now);
      var settings = state.settings;
      if (settings.warn8 && !warn8Fired && rem > 0 && rem <= 8 && s.plannedSec >= 30) {
        warn8Fired = true;
        beepWarn();
        if (root.desk && root.desk.warn8) root.desk.warn8();
      }
      if (rem <= 0) { onNaturalComplete(s); s = current(); }
      // Periodic checkpoint: crash recovery only loses ≤10 s of focus time.
      if (s && s.state === 'running' && now - s.checkpointAt >= 10000) {
        sess.checkpoint(s, now);
        save();
      }
    }
    if (brk && now >= brk.endAt) { endBreak(true); }

    // Local-midnight rollover: finalize elapsed days exactly once.
    var d = dates.todayKey();
    if (state.settings.lastDay !== d) {
      var created = snapshots.backfill(state, d, now);
      state.settings.lastDay = d;
      save(); app.emit('change');
      if (created.length) JF.ui && JF.ui.toast('Laporan harian ' + created.length + ' hari dirangkum otomatis.', { kind: 'ok' });
    }

    if (now - lastPush >= 500) { lastPush = now; pushState(); updateChrome(); }
  }

  function fmtDur(sec) { return JF.ui.fmt.dur(sec); }

  /** Sidebar status + document title (v1 updated the title the same way). */
  function updateChrome() {
    var s = current(), el2 = JF.ui.$('sideStatus');
    if (el2) {
      if (brk) {
        el2.className = 'side-status run';
        el2.textContent = JF.ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000))) + ' · Istirahat';
      } else if (s && s.state === 'running') {
        el2.className = 'side-status run';
        el2.textContent = JF.ui.fmt.mmss(sess.remainingSeconds(s, Date.now())) + ' · ' + s.taskName;
      } else if (s && s.state === 'paused') {
        el2.className = 'side-status';
        el2.textContent = JF.ui.fmt.mmss(sess.remainingSeconds(s, Date.now())) + ' · dijeda';
      } else {
        el2.className = 'side-status';
        el2.textContent = JF.dates.dayKey ? JF.ui.fmt.dateShort(today()) : '';
      }
    }
    if (brk) document.title = JF.ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000))) + ' · Istirahat';
    else if (s && s.state === 'running') document.title = JF.ui.fmt.mmss(sess.remainingSeconds(s, Date.now())) + ' · ' + s.taskName;
    else document.title = 'Jam Fokus';
  }

  /* ── command channel from the Mini Widget (unchanged v1 handling) ── */
  function attachCmd() {
    if (!root.desk || !root.desk.onCmd) return;
    root.desk.onCmd(function (c) {
      if (c === 'push') { pushState(); return; }
      if (c === 'toggle') {
        var s = current();
        if (s && s.state === 'running') app.pause();
        else if (s && s.state === 'paused') app.resume();
        else if (!brk && app.lastTaskId) {
          var t = findTask(app.lastTaskId);
          if (t && !t.done && !t.archived) app.startTask(t.id);
        }
      }
    });
  }

  /* ── public start ────────────────────────────────────────────────── */
  app.init = function () {
    var info = boot();
    loadBrk();
    attachCmd();
    setInterval(check, 500);
    // Force a checkpoint save as soon as the window unloads (quit path),
    // so recovery after a crash never over-counts focus time.
    root.addEventListener('beforeunload', function () {
      var s = current();
      if (s && s.state === 'running') { sess.checkpoint(s, Date.now()); try { lsSet(K_V2, JSON.stringify(state)); } catch (e) {} }
    });
    return info;
  };
  app.recoverPrompt = function (recovered, opts) {
    if (!recovered || !recovered.length) return;
    var s = recovered[0];
    JF.ui.modal({
      title: 'Sesi fokus terputus',
      dismiss: false,
      body: [
        JF.ui.el('p', 'Aplikasi tertutup saat sesi "',
          JF.ui.el('strong', s.taskName), '" sedang berjalan. Sesi dipulihkan dalam kondisi ',
          JF.ui.el('strong', 'dijeda'), '.'),
        JF.ui.el('p.hint', { style: { marginTop: '8px' } },
          'Waktu ketika aplikasi tidak berjalan tidak dihitung sebagai fokus. Fokus tercatat sejauh ' +
          JF.ui.fmt.dur(s.activeSec) + ' dari target ' + JF.ui.fmt.dur(s.plannedSec) + '.'),
        JF.ui.el('p.hint', { style: { marginTop: '8px' } }, 'Lanjutkan sesi ini atau hentikan?')
      ],
      actions: [
        { label: 'Hentikan sesi', danger: true, onClick: function () { stopRecovered(recovered); } },
        { label: 'Lanjutkan', primary: true, onClick: function () { continueRecovered(recovered); } }
      ],
      onClose: function (confirmed) {
        if (!confirmed) stopRecovered(recovered); // closing = do not count as running
      }
    });
  };
  function stopRecovered(list) {
    var now = Date.now();
    list.forEach(function (s) { if (s.state === 'paused') { sess.stopSession(state, s, now); syncTaskLeft(s); } });
    save(); app.emit('change');
    JF.ui.toast('Sesi dihentikan — fokus tercatat tidak dihitung ke total fokus.', { kind: 'ok' });
  }
  function continueRecovered(list) {
    var now = Date.now();
    // Only ONE session may run; resume the first, stop the rest honestly.
    list.forEach(function (s, i) {
      if (i === 0) sess.resumeSession(state, s, now);
      else { sess.stopSession(state, s, now); syncTaskLeft(s); }
    });
    warn8Fired = false;
    save(); app.emit('change');
    JF.ui.toast('Sesi dilanjutkan.', { kind: 'ok' });
  }

  app.rawState = function () { return state; };

  /* ── pemulihan cadangan & pembersihan salinan lama ── */
  /** Ganti seluruh data dengan state hasil validasi JF.backup (sudah diperiksa pemanggil). */
  app.replaceState = function (s) {
    state = s;
    state.sessions = state.sessions || [];
    state.snapshots = state.snapshots || [];
    state.legacyHist = state.legacyHist || [];
    state.events = state.events || [];
    state.tasks = state.tasks || [];
    if (!state.journals || typeof state.journals !== 'object' || Array.isArray(state.journals)) state.journals = {};
     normalizeSettings(state.settings);
     if (JF.goals) JF.goals.normalize(state);
     if (JF.library) JF.library.normalize(state);
    app.state = state;
    var now = Date.now();
    sess.recover(state, now);
    var today = dates.todayKey();
    snapshots.backfill(state, today, now);
    state.settings.lastDay = today;
    save();
    app.emit('change');
    return state;
  };
  function lsSize(k) { var v = lsGet(k); return v ? (k.length + v.length) : 0; }
  /** Ukuran (karakter ≈ byte) penyimpanan lokal: terpakai, salinan lama, dan batas perkiraan. */
  app.storageUsage = function () {
    var total = 0;
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); total += k.length + (localStorage.getItem(k) || '').length; } } catch (e) {}
    return { total: total, legacy: lsSize(K_V1) + lsSize(K_BACKUP), hasLegacy: !!(lsGet(K_V1) || lsGet(K_BACKUP)), limit: 5 * 1024 * 1024 };
  };
  /** Hapus salinan data versi lama (v1 dan cadangannya). Data aktif (v2) tidak disentuh. */
  app.removeLegacyCopies = function () {
    if (!lsGet(K_V2)) return 0;                      // jangan hapus kalau data aktif belum tersimpan
    var freed = lsSize(K_V1) + lsSize(K_BACKUP);
    try { localStorage.removeItem(K_V1); localStorage.removeItem(K_BACKUP); } catch (e) {}
    return freed;
  };

  JF.app = app;
})(typeof self !== 'undefined' ? self : this);
