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

  /* ── music ───────────────────────────────────────────────────────────
     Focus-end slot = PLAYLIST (shared/musicPlayer.js, one Audio element).
     Break-end slot = single alert track (unchanged). Playback state lives
     here, never in a dialog or page; the timer only calls
     start / bindBreak / endBreak. Storage: same IndexedDB ('jamfokus-music'),
     one record per track ('trk:<id>') + ordered list ('plist'). The legacy
     'foc' record is migrated into the playlist but never deleted. */
  var DEFAULT_NAME = 'Bawaan (bunyi pendek)';
  var auR = new Audio(), musRURL = null;
  var au = new Audio();
  var blobs = {};                       // track id -> Blob (file-backed, cheap)
  var music = {
    focusName: DEFAULT_NAME, breakName: DEFAULT_NAME,
    focusMode: 'beep', breakMode: 'beep',   // per channel: 'beep' | 'custom' (songs) | 'none' (silent)
    loop: lsGet('jamfokus.loop') === '1',   // repeat outside a break; during a break the playlist always repeats
    playingFocus: false, playingBreak: false, tracks: [], loaded: false
  };
  var player = JF.musicPlayer.createPlayer({
    audio: au,
    createURL: function (b) { return URL.createObjectURL(b); },
    revokeURL: function (u) { URL.revokeObjectURL(u); },
    getBlob: function (id) { return blobs[id] || null; },
    isLoop: function () { return music.loop; },
    onChange: syncMusicState
  });
  function syncMusicState() {
    var st = player.status();
    music.tracks = player.tracks();
    music.status = st;
    music.playingFocus = st.active && !st.paused;
    var n = music.tracks.length;
    music.focusName = !n ? DEFAULT_NAME : (n === 1 ? music.tracks[0].name : n + ' lagu di playlist');
    app.emit('music');
  }

  /* Completion-sound mode per channel ('foc' = focus end, 'rst' = break end).
     Stored under jamfokus.audio.foc / jamfokus.audio.rst. Older installs have no
     stored value: they keep their behaviour (songs if any exist, otherwise beep). */
  var audioReady = { foc: false, rst: false };
  function initAudioMode(slot, hasBlob) {
    var stored = lsGet('jamfokus.audio.' + slot);
    var mode = stored === 'none' ? 'none' : stored === 'beep' ? 'beep' : (hasBlob ? 'custom' : 'beep');
    if (slot === 'foc') music.focusMode = mode; else music.breakMode = mode;
    audioReady[slot] = true;
    app.emit('music');
  }
  function setAudioMode(slot, mode) {
    if (mode !== 'none' && mode !== 'beep' && mode !== 'custom') return;
    if (slot === 'foc') music.focusMode = mode; else music.breakMode = mode;
    audioReady[slot] = true;
    try { lsSet('jamfokus.audio.' + slot, mode); } catch (e) {}
    app.emit('music');
  }

  function idbSet(obj, key) {
    return new Promise(function (resolve) {
      idb(function (db) {
        if (!db) return resolve(false);
        try {
          var tx = db.transaction('m', 'readwrite');
          tx.objectStore('m').put(obj, key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }
  function idbRemove(key) {
    return new Promise(function (resolve) {
      idb(function (db) {
        if (!db) return resolve(false);
        try {
          var tx = db.transaction('m', 'readwrite');
          tx.objectStore('m').delete(key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }
  function idbRead(key) { return new Promise(function (resolve) { idbGet(key, resolve); }); }
  function savePlaylistMeta() {
    return idbSet({ v: 1, tracks: player.tracks().map(function (t) { return { id: t.id, name: t.name, size: t.size, sig: t.sig }; }) }, 'plist');
  }

  /** Add one or more audio files. Resolves { added, rejected, persisted }. */
  music.addTracks = function (files) {
    var plan = JF.musicPlayer.planAdd(player.tracks(), files, function () { return JF.model.uid('trk'); });
    if (!plan.added.length) return Promise.resolve({ added: [], rejected: plan.rejected, persisted: true });
    plan.added.forEach(function (t) { blobs[t.id] = t.file; });
    var list = player.tracks().concat(plan.added.map(function (t) { return { id: t.id, name: t.name, size: t.size, sig: t.sig }; }));
    player.setTracks(list);
    if (music.focusMode === 'beep' && lsGet('jamfokus.audio.foc') === null) setAudioMode('foc', 'custom');
    var writes = plan.added.map(function (t) { return idbSet({ blob: t.file, name: t.name }, 'trk:' + t.id); });
    return Promise.all(writes).then(function (r) {
      var ok = r.every(Boolean);
      return savePlaylistMeta().then(function (m) { return { added: plan.added, rejected: plan.rejected, persisted: ok && m }; });
    });
  };
  /** User-initiated removal of one saved track (the user's original file is never touched). */
  music.removeTrack = function (id) {
    var list = player.tracks().filter(function (t) { return t.id !== id; });
    delete blobs[id];
    player.setTracks(list);
    return savePlaylistMeta().then(function () { return idbRemove('trk:' + id); });
  };
  music.clearPlaylist = function () {
    var ids = player.tracks().map(function (t) { return t.id; });
    player.stop();
    ids.forEach(function (id) { delete blobs[id]; });
    player.setTracks([]);
    return savePlaylistMeta().then(function () { return Promise.all(ids.map(function (id) { return idbRemove('trk:' + id); })); });
  };
  /** Play a chosen track (or the first one). During a break the session is automatically break-bound. */
  music.play = function (id) { return player.start({ id: id || null, breakBound: !!brk }); };
  music.next = function () { return player.next(); };
  music.pause = function () { return player.pause(); };
  music.resume = function () { return player.resume(); };
  music.togglePause = function () { return player.status().paused ? player.resume() : player.pause(); };
  /** Silent focus-end: stop whatever the focus-end slot is playing. Never makes a sound itself. */
  music.silenceFocus = function () { player.stop(); syncMusicState(); };
  music.setFocusMode = function (mode) {
    setAudioMode('foc', mode);
    if (mode === 'none') music.silenceFocus();
  };
  music.testFocus = function () {
    if (music.focusMode === 'none') return false;
    if (music.focusMode === 'custom' && player.hasPlayable()) { player.start({ ifIdle: true, breakBound: !!brk }); return true; }
    beep();
    return true;
  };
  music.hasTracks = function () { return player.hasPlayable(); };
  music.setLoop = function (on) { music.loop = !!on; try { lsSet('jamfokus.loop', on ? '1' : '0'); } catch (e) {} };

  /* break-end alert slot (single track, as before) */
  function setMusR(blob, name) {
    if (musRURL) URL.revokeObjectURL(musRURL);
    musRURL = blob ? URL.createObjectURL(blob) : null;
    if (musRURL) auR.src = musRURL; else auR.removeAttribute('src');
    music.breakName = blob ? name : DEFAULT_NAME;
    app.emit('music');
  }
  function stopAlert() {
    try { auR.pause(); auR.currentTime = 0; } catch (e) {}
    music.playingBreak = false;
  }
  function playAlert() {
    if (music.breakMode === 'none') return;
    if (music.breakMode === 'beep' || !musRURL || !auR.src) return beep();
    auR.currentTime = 0;
    var p = auR.play();
    music.playingBreak = true; app.emit('music');
    if (p && p.catch) p.catch(function () { beep(); music.playingBreak = false; app.emit('music'); });
  }
  /** Explicit stop (Hentikan Musik): stops the playlist and any alert at once. */
  function stopAllMusic() { stopAlert(); player.stop(); syncMusicState(); }
  music.stopAllMusic = stopAllMusic;
  music.pickBreak = function (file, name) {
    stopAlert(); setMusR(file, name); idbPut(file, name, 'rst');
    if (music.breakMode !== 'none') setAudioMode('rst', 'custom');   // choosing a song means using it; silent stays silent
  };
  music.clearBreak = function () {
    stopAlert(); setMusR(null, null); idbDel('rst');
    if (music.breakMode === 'custom') setAudioMode('rst', 'beep');
  };
  music.hasBreakTrack = function () { return !!musRURL; };
  music.setBreakMode = function (mode) {
    setAudioMode('rst', mode);
    if (mode === 'none') stopAlert();
  };
  music.testBreak = function () {
    if (music.breakMode === 'none') return false;
    playAlert();
    return true;
  };
  auR.onended = function () { music.playingBreak = false; app.emit('music'); };

  // Load saved playlist (migrating the legacy single "cur"/"foc" track once).
  // The completion-sound mode is initialised from what was found: saved choice wins,
  // otherwise songs present -> songs, nothing -> beep (same as before this setting existed).
  (function loadPlaylist() {
    function legacyCur() { return new Promise(function (resolve) { idbGet('cur', resolve); }); }
    idbRead('plist').then(function (meta) {
      if (meta && Array.isArray(meta.tracks)) {
        var list = meta.tracks.filter(function (t) { return t && typeof t.id === 'string'; });
        return Promise.all(list.map(function (t) { return idbRead('trk:' + t.id); })).then(function (recs) {
          list.forEach(function (t, i) {
            if (recs[i] && recs[i].blob) blobs[t.id] = recs[i].blob; else t.missing = true;   // kept, flagged, never auto-deleted
          });
          player.setTracks(list);
          initAudioMode('foc', player.hasPlayable());
        });
      }
      return legacyCur().then(function (old) {
        if (old && old.blob) { idbSet({ blob: old.blob, name: old.name }, 'foc'); idbRemove('cur'); return old; }
        return idbRead('foc');
      }).then(function (v) {
        if (!v || !v.blob) { initAudioMode('foc', false); return; }
        initAudioMode('foc', true);
        var t = { id: JF.model.uid('trk'), name: v.name || 'Lagu', size: v.blob.size || 0, sig: 'legacy|' + (v.name || '') + '|' + (v.blob.size || 0) };
        blobs[t.id] = v.blob;
        player.setTracks([t]);
        return idbSet({ blob: v.blob, name: v.name }, 'trk:' + t.id).then(savePlaylistMeta);   // legacy 'foc' record stays
      });
    }).then(function () { music.loaded = true; syncMusicState(); }, function () {
      if (!audioReady.foc) initAudioMode('foc', false);
      music.loaded = true;
    });
  })();
  idbGet('rst', function (v) {
    if (v && v.blob) setMusR(v.blob, v.name);
    initAudioMode('rst', !!(v && v.blob));
  });

  /** Focus finished: start the playlist unless it is already playing (never a second instance). */
  function alarmFocus() {
    if (root.desk) root.desk.popup();
    if (music.focusMode === 'none') return;   // silent: the window still comes forward, but no sound at all
    if (music.focusMode === 'custom' && player.hasPlayable()) { player.start({ ifIdle: true, breakBound: !!brk }); return; }
    beep();
  }
  function alarmBreak() {
    if (root.desk) root.desk.popup();
    if (music.breakMode === 'none') return;
    playAlert();
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
    } else if (s && s.state === 'running' && sess.isOpen(s)) {
      // Waktu bebas: jendela mini menghitung maju dari 'since'.
      out = { mode: 'run', open: true, name: s.taskName, since: Date.now() - Math.floor(sess.activeSeconds(s, Date.now())) * 1000, total: 0 };
    } else if (s && s.state === 'paused' && sess.isOpen(s)) {
      out = { mode: 'pause', open: true, name: s.taskName, left: Math.floor(sess.activeSeconds(s, Date.now())), total: 0 };
    } else if (s && s.state === 'running') {
      var rem = Math.max(0, Math.ceil(sess.remainingSeconds(s, Date.now())));
      out = { mode: 'run', name: s.taskName, endAt: Date.now() + rem * 1000, total: s.plannedSec };
    } else if (s && s.state === 'paused') {
      out = { mode: 'pause', name: s.taskName, left: Math.max(0, Math.ceil(sess.remainingSeconds(s, Date.now()))), total: s.plannedSec };
    } else if (completionDialog && completionCtx) {
      // Sesi baru selesai dan dialog pilihan langkah menunggu: mini menampilkan tombol "Lanjut fokus".
      out = { mode: 'idle', name: completionCtx.name, left: 0, total: 0, canContinue: true };
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
  // Dialog "Sesi fokus selesai" yang sedang terbuka (null bila tidak ada). Selama terbuka, jendela mini menawarkan "Lanjut fokus".
  var completionDialog = null, completionCtx = null;
  function closeCompletionDialog() {
    var d = completionDialog;
    completionDialog = null; completionCtx = null;
    if (d) { try { d.close(false); } catch (e) {} }
  }
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
    if (t && !sess.isOpen(s)) t.left = Math.max(0, Math.round(sess.remainingSeconds(s, Date.now())));   // waktu bebas tidak punya sisa waktu
    return t;
  }

  /** Mengakhiri sesi yang masih hidup tanpa kehilangan waktu secara tidak adil:
      sesi waktu bebas tidak punya target, jadi waktu berjalannya adalah hasilnya (dihitung);
      sesi biasa yang belum habis tetap terputus dan tidak dihitung. */
  function endLive(s, now) {
    if (sess.isOpen(s)) {
      var r = sess.finishOpenSession(state, s, now);
      var t = s.taskId ? findTask(s.taskId) : null;
      if (t && r.ok) t.left = 0;
      return r;
    }
    var r2 = sess.stopSession(state, s, now);
    syncTaskLeft(s);
    return r2;
  }
  // Waktu bebas yang berjalan terus-menerus tanpa jeda lebih dari ini dijeda otomatis (mis. laptop ditinggal).
  var OPEN_RUN_CAP_MS = 3 * 3600 * 1000;
  var openSeg = { id: null, since: 0 };

  /** Start (or resume) focus. v1-equivalent: only one session runs at a time. */
  app.startTask = function (id, opts) {
    opts = opts || {};
    var t = id ? findTask(id) : null;
    if (id && (!t || t.done || t.archived)) return null;
    closeCompletionDialog();   // memulai fokus dari mana pun menutup dialog "Sesi fokus selesai" yang menggantung
    if (!t && !opts.standalone) {
      // pick first active task when caller passes null without standalone flag
      var act = store.activeTasks(state, today());
      t = act[0] || null;
    }
    ctx();
    var now = Date.now();

    // Leaving a break cancels it. Starting (or resuming) a focus session always ends music:
    // music may play during a break or while back on the task list, never during focus.
    if (brk) { brk = null; saveBrk(); }
    stopAllMusic();

    var cur = current();
    if (cur) {
      if (cur.state === 'paused' && t && cur.taskId === t.id) {
        sess.resumeSession(state, cur, now);
        warn8Fired = false; askNotif();
        save(); app.lastTaskId = t.id; app.selectedTaskId = t.id;
        app.emit('change'); pushState();
        return cur;
      }
      // Another (or same but fresh) run: end the previous one, honestly.
      var wasOpen = sess.isOpen(cur);
      endLive(cur, now);
      if (!opts.quiet) {
        if (wasOpen) JF.ui && JF.ui.toast('Sesi waktu bebas disimpan: ' + fmtDur(cur.plannedSec) + ' masuk total fokus.', { kind: 'ok' });
        else JF.ui && JF.ui.toast('Sesi sebelumnya dihentikan (terputus, tidak dihitung ke total fokus).', { kind: 'ok' });
      }
    }

    var planned = t ? t.left : state.settings.defaultFocusSec;
    if (!(planned > 0)) planned = (t && t.durationSec > 0) ? t.durationSec : state.settings.defaultFocusSec;
    if (!(planned > 0)) planned = 1500;
    var openRun = !!opts.open;   // waktu bebas: hitung maju sampai "Selesai sesi"
    var s = sess.createSession(state, {
      taskId: t ? t.id : null,
      taskName: t ? t.title : 'Fokus tanpa tugas',
      plannedSec: openRun ? 1 : planned,
      openEnded: openRun
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

  /** Akhiri sesi waktu bebas: waktu berjalan (tanpa jeda) dihitung ke total fokus, lalu tampilkan pilihan langkah berikutnya. */
  app.finishOpen = function () {
    var s = current();
    if (!s || !sess.isOpen(s) || (s.state !== 'running' && s.state !== 'paused')) return false;
    var r = endLive(s, Date.now());
    if (!r.ok) return false;
    var t = s.taskId ? findTask(s.taskId) : null;
    save(); pushState();
    app.emit('session-complete', s, t);
    app.emit('change');
    showCompletionChoices(s, t, { resumeOpen: true });
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

  /** Manual task completion. A session running on it ends as interrupted.
      Tasks that require an output are verified against the managed files on
      disk first; that check is asynchronous, so those return false right away
      and finish (or explain why not) through toast + 'change'. */
  app.completeTask = function (id) {
    var t = findTask(id);
    if (!t) return false;
    if (t.done || t.archived) return false;
    if (t.requiresOutput && JF.documents) {
      JF.documents.verifiedFileNames(id).then(function (names) {
        finishComplete(id, { availableFileNames: names });
      });
      return false;
    }
    return finishComplete(id, null);
  };

  var OUTPUT_MSG = {
    'output-required': 'Tugas ini butuh file output. Buka Goals, pilih tugasnya, lalu lampirkan file lewat tombol Output.',
    'output-missing': 'File output tugas ini tidak ditemukan di penyimpanan. Lampirkan ulang file outputnya.'
  };
  function finishComplete(id, opts) {
    var t = findTask(id);
    if (!t) return false;
    if (t.requiresOutput && JF.library) {
      var chk = JF.library.deliverableCheck(state, id, opts && opts.availableFileNames);
      if (!chk.ok) { JF.ui && JF.ui.toast(OUTPUT_MSG[chk.reason], { kind: 'err', timeout: 7000 }); return false; }
    }
    var s = current();
    if (s && s.taskId === id && (s.state === 'running' || s.state === 'paused')) {
      var now = Date.now();
      if (sess.isOpen(s)) {
        // Waktu bebas: hitung seluruh waktu aktual yang sudah berjalan.
        var ro = sess.finishOpenSession(state, s, now);
        var tt = s.taskId ? findTask(s.taskId) : null;
        if (tt && ro.ok) tt.left = 0;
      } else {
        // Sesi biasa selesai lebih awal: waktu fokus nyata tetap dihitung ke total.
        var re = sess.finishEarlySession(state, s, now);
        if (re.ok) {
          var tf = s.taskId ? findTask(s.taskId) : null;
          if (tf) tf.left = 0;
        }
      }
    }
    var r = store.completeTask(state, id, Date.now(), 'user', opts || undefined);
    if (r.ok && r.changed) {
      save(); app.emit('change');
      JF.ui && JF.ui.toast('Tugas ditandai selesai: ' + t.title, {
        action: { label: 'Urungkan', onClick: function () { app.reopenTask(id); } }, timeout: 7000
      });
    }
    return r.ok && r.changed;
  }

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

  /* Sesi waktu bebas yang baru diakhiri bisa dilanjutkan sebagai sesi yang sama (hitungan tidak kembali ke nol). */
  function resumeFinished(id) {
    var s = sess.findSession(state, id);
    if (!s || !sess.isOpen(s) || s.state !== 'completed' || current()) return null;
    var t = s.taskId ? findTask(s.taskId) : null;
    if (s.taskId && (!t || t.done || t.archived)) return null;   // tugasnya sudah selesai: mulai sesi baru saja
    var now = Date.now();
    closeCompletionDialog();
    if (brk) { brk = null; saveBrk(); }
    stopAllMusic();
    sess.reopenOpenSession(state, s, now);
    warn8Fired = false; askNotif();
    if (t) { app.lastTaskId = t.id; app.selectedTaskId = t.id; }
    save(); app.emit('change'); pushState();
    return s;
  }
  function continueFrom(c) {
    if (c.resumeId) { var r = resumeFinished(c.resumeId); if (r) return r; }
    return app.startTask(c.taskId, { standalone: c.standalone, open: true });
  }
  function showCompletionChoices(s, t, copts) {
    var canMarkDone = !!(t && !t.done && !t.archived && JF.completion);
    var resumeId = copts && copts.resumeOpen && sess.isOpen(s) ? s.id : null;
    closeCompletionDialog();
    var ctx = { taskId: t ? t.id : null, standalone: !t, name: s.taskName, resumeId: resumeId };
    completionCtx = ctx;
    completionDialog = JF.ui.modal({
      title: 'Sesi fokus selesai',
      /* Klik latar tidak boleh menutup kartu ini. Pengguna harus memilih
         langkah berikutnya, atau menutupnya dengan sengaja lewat tombol X. */
      backdropDismiss: false,
      body: [
        JF.ui.el('div', JF.ui.el('strong', s.taskName)),
        JF.ui.el('div.hint', { style: { marginTop: '4px' } },
          'Fokus ' + JF.ui.fmt.dur(s.plannedSec) + ' · tanpa waktu jeda.'),
        JF.ui.el('p.hint', { style: { marginTop: '10px' } },
          'Tugas tidak ditandai selesai otomatis dan sesi baru tidak dimulai otomatis. Pilih langkah berikutnya:')
      ].concat(resumeId ? [JF.ui.el('p.hint', { style: { marginTop: '6px' } },
        'Lanjut fokus melanjutkan sesi ini dari ' + JF.ui.fmt.dur(s.plannedSec) + ' (hitungan tidak mulai dari nol). Akhiri lagi dengan "Selesai sesi".')]
        : [JF.ui.el('p.hint', { style: { marginTop: '6px' } },
        'Lanjut fokus berjalan tanpa batas waktu. Akhiri dengan "Selesai sesi" supaya waktunya masuk total fokus.')]),
      actions: (canMarkDone ? [{ label: 'Tandai selesai', ghost: true, onClick: function () {
        // Form ringkasan + lampiran. Batal -> kembali ke pilihan langkah ini.
        JF.completion.open(t, s, { onCancel: function () { showCompletionChoices(s, t, copts); } });
      } }] : []).concat([
        { label: 'Istirahat', ghost: true, onClick: function () { startBreak(state.settings.shortBreakMin, null, false); } },
        { label: 'Lanjut fokus', primary: true, onClick: function () { continueFrom(ctx); } }
      ]),
      onClose: function () { completionDialog = null; completionCtx = null; app.emit('change'); pushState(); }
    });
    pushState();
  }

  /** "Lanjut fokus" dari jendela mini: sama dengan tombol di dialog (waktu bebas di Original). */
  app.continueFocus = function () {
    if (!completionDialog || !completionCtx) return false;
    var r = continueFrom(completionCtx);
    return !!r;
  };

  /* ── breaks ──────────────────────────────────────────────────────── */
  function startBreak(mins, nextTaskId, isLong) {
    // The playlist keeps playing into the break (or starts if idle) and becomes break-bound.
    stopAlert();
    brk = {
      endAt: Date.now() + mins * 60000, total: mins * 60,
      nextTaskId: nextTaskId || null, isLong: !!isLong
    };
    saveBrk();
    if (player.hasPlayable()) player.start({ ifIdle: true, breakBound: true });
    else player.bindBreak(true);
    app.emit('change'); pushState();
  }
  app.startBreak = function (mins) { startBreak(mins || state.settings.shortBreakMin, null, false); };

  function endBreak(autoStart) {
    var nextId = brk && brk.nextTaskId;
    // The break timer owns break music: stop it and clear the temporary session (saved playlist untouched).
    player.endBreak();
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
    endBreak(false); 
    JF.ui && JF.ui.toast('Istirahat dilewati.'); 
  } };

  /* ── per-second check (v1's setInterval(check,500) semantics) ────── */
  var lastPush = 0;
  function check() {
    var now = Date.now();
    var s = current();
    if (s && s.state === 'running' && sess.isOpen(s)) {
      // Waktu bebas tidak pernah selesai sendiri. Pengaman: jeda otomatis bila terus berjalan terlalu lama
      // (mis. laptop ditinggal). Dihitung dari awal/lanjut terakhir, bukan dari checkpoint.
      if (openSeg.id !== s.id) { openSeg.id = s.id; openSeg.since = s.runStartedAt != null ? s.runStartedAt : now; }
      if (now - openSeg.since >= OPEN_RUN_CAP_MS) {
        openSeg.id = null;
        sess.pauseSession(state, s, now);
        save(); app.emit('change'); pushState();
        notify('Waktu bebas dijeda', 'Sudah 3 jam berjalan tanpa jeda. Lanjutkan bila masih fokus, atau pilih Selesai sesi.');
        JF.ui && JF.ui.toast('Waktu bebas dijeda otomatis setelah 3 jam. Lanjutkan atau pilih Selesai sesi.', { kind: 'ok', timeout: 9000 });
        s = current();
      }
    } else {
      openSeg.id = null;
    }
    if (s && s.state === 'running' && !sess.isOpen(s)) {
      var rem = sess.remainingSeconds(s, now);
      var settings = state.settings;
      if (settings.warn8 && !warn8Fired && rem > 0 && rem <= 8 && s.plannedSec >= 30) {
        warn8Fired = true;
        beepWarn();
        if (root.desk && root.desk.warn8) root.desk.warn8();
      }
      if (rem <= 0) { onNaturalComplete(s); s = current(); }
    }
    // Periodic checkpoint: crash recovery only loses 10 s of focus time.
    if (s && s.state === 'running' && now - s.checkpointAt >= 10000) {
      sess.checkpoint(s, now);
      save();
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
  /* Jam sesi: sisa waktu (sesi biasa) atau "+waktu berjalan" (waktu bebas). */
  function clockText(s) {
    return sess.isOpen(s) ? '+' + JF.ui.fmt.mmss(sess.activeSeconds(s, Date.now())) : JF.ui.fmt.mmss(sess.remainingSeconds(s, Date.now()));
  }
  function updateChrome() {
    var s = current(), el2 = JF.ui.$('sideStatus');
    if (el2) {
      if (brk) {
        el2.className = 'side-status run';
        el2.textContent = JF.ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000))) + ' · Istirahat';
      } else if (s && s.state === 'running') {
        el2.className = 'side-status run';
        el2.textContent = clockText(s) + ' · ' + s.taskName;
      } else if (s && s.state === 'paused') {
        el2.className = 'side-status';
        el2.textContent = clockText(s) + ' · dijeda';
      } else {
        el2.className = 'side-status';
        el2.textContent = JF.dates.dayKey ? JF.ui.fmt.dateShort(today()) : '';
      }
    }
    if (brk) document.title = JF.ui.fmt.mmss(Math.max(0, Math.ceil((brk.endAt - Date.now()) / 1000))) + ' · Istirahat';
    else if (s && s.state === 'running') document.title = clockText(s) + ' · ' + s.taskName;
    else document.title = 'Jam Fokus';
  }

  /* ── command channel from the Mini Widget (unchanged v1 handling) ── */
  function attachCmd() {
    if (!root.desk || !root.desk.onCmd) return;
    root.desk.onCmd(function (c) {
      if (c === 'push') { pushState(); return; }
      if (c === 'continue') { app.continueFocus(); return; }
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
