/* Jam Fokus — focus session lifecycle & integrity.
   Timing is timestamp-based (never tick-count based).
   Only sessions in state 'completed' contribute to official focus totals.
   UMD: browser -> window.JF.sessions, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'), require('./model.js'));
  else root.JF = root.JF || {}, root.JF.sessions = factory(root.JF.dates, root.JF.model);
})(typeof self !== 'undefined' ? self : this, function (dates, model) {
  'use strict';

  var STATES = ['running', 'paused', 'completed', 'interrupted'];

  function createSession(state, input, now) {
    now = now == null ? Date.now() : now;
    var planned = Math.max(1, Math.round(Number(input.plannedSec) || 0));
    var s = {
      id: model.uid('ses'),
      taskId: input.taskId || null,
      taskName: input.taskName || '(Tanpa task)',
      plannedSec: planned,
      startedAt: now,
      runStartedAt: now,
      pauseStartedAt: null,
      state: 'running',
      activeSec: 0,          // accumulated FOCUS time (excludes pauses)
      pausedSec: 0,          // accumulated pause time
      checkpointAt: now,     // last time activeSec was reconciled with the clock
      endedAt: null,
      completedAt: null,
      legacy: false,
      contributesToOfficial: false
    };
    // Waktu bebas: tanpa batas durasi (hitung maju). Hanya ditulis bila true agar sesi biasa tidak berubah.
    if (input.openEnded) s.openEnded = true;
    state.sessions.push(s);
    storeEv(state, now, 'session.started', s);
    return s;
  }

  function isOpen(s) { return !!(s && s.openEnded); }

  function storeEv(state, now, kind, s) {
    state.events.push({ at: now, kind: kind, taskId: s.taskId, data: { sessionId: s.id, state: s.state } });
    if (state.events.length > 5000) state.events.splice(0, state.events.length - 5000);
  }

  /** Fold elapsed running time into activeSec (idempotent; safe to call often). */
  function checkpoint(s, now) {
    now = now == null ? Date.now() : now;
    if (s.state === 'running' && s.runStartedAt != null) {
      var delta = Math.max(0, (now - s.runStartedAt) / 1000);
      s.activeSec += delta;
      s.runStartedAt = now;
    }
    s.checkpointAt = now;
    return s;
  }

  /** Actual focus seconds at a point in time (excludes any pause). */
  function activeSeconds(s, now) {
    now = now == null ? Date.now() : now;
    var v = s.activeSec;
    if (s.state === 'running' && s.runStartedAt != null) v += Math.max(0, (now - s.runStartedAt) / 1000);
    return v;
  }

  /** Remaining planned seconds at a point in time (pause does not consume it). */
  function remainingSeconds(s, now) {
    now = now == null ? Date.now() : now;
    return Math.max(0, s.plannedSec - activeSeconds(s, now));
  }

  /** Detik yang ditampilkan di jam: waktu berjalan untuk sesi bebas, sisa waktu untuk sesi biasa. */
  function clockSeconds(s, now) {
    return isOpen(s) ? activeSeconds(s, now) : remainingSeconds(s, now);
  }

  function pauseSession(state, s, now) {
    now = now == null ? Date.now() : now;
    if (s.state !== 'running') return { ok: false, reason: 'not-running' };
    checkpoint(s, now);
    s.state = 'paused';
    s.pauseStartedAt = now;
    storeEv(state, now, 'session.paused', s);
    return { ok: true, session: s };
  }

  function resumeSession(state, s, now) {
    now = now == null ? Date.now() : now;
    if (s.state !== 'paused') return { ok: false, reason: 'not-paused' };
    if (s.pauseStartedAt != null) {
      s.pausedSec += Math.max(0, (now - s.pauseStartedAt) / 1000);
      s.pauseStartedAt = null;
    }
    s.state = 'running';
    s.runStartedAt = now;
    storeEv(state, now, 'session.resumed', s);
    return { ok: true, session: s };
  }

  /** Permanent stop: retained with real elapsed focus, but NOT official. */
  function stopSession(state, s, now) {
    now = now == null ? Date.now() : now;
    if (s.state === 'completed' || s.state === 'interrupted') return { ok: false, reason: 'already-ended' };
    checkpoint(s, now);
    if (s.pauseStartedAt != null) { s.pausedSec += Math.max(0, (now - s.pauseStartedAt) / 1000); s.pauseStartedAt = null; }
    s.state = 'interrupted';
    s.endedAt = now;
    s.contributesToOfficial = false;
    storeEv(state, now, 'session.interrupted', s);
    return { ok: true, session: s };
  }

  /** Completion happens exactly once; guarded against repeated events. */
  function completeSession(state, s, now) {
    now = now == null ? Date.now() : now;
    if (s.state === 'completed') return { ok: true, session: s, changed: false, reason: 'already-completed' };
    if (s.state === 'interrupted') return { ok: false, reason: 'already-ended' };
    checkpoint(s, now);
    s.activeSec = s.plannedSec;   // a completed session equals its planned duration
    s.state = 'completed';
    s.completedAt = now;
    s.endedAt = now;
    s.contributesToOfficial = true;
    storeEv(state, now, 'session.completed', s);
    return { ok: true, session: s, changed: true };
  }

  /* ── official totals ────────────────────────────────────────────────── */
  /** Mengakhiri sesi biasa lebih awal dengan kredit waktu aktual:
      dipakai saat tugas ditandai selesai sebelum timer habis (mis. "Selesai + ringkasan").
      Waktu fokus nyata (activeSec saat ini) menjadi plannedSec dan masuk total resmi.
      Sesi waktu bebas tidak boleh menggunakan fungsi ini — gunakan finishOpenSession. */
  function finishEarlySession(state, s, now) {
    now = now == null ? Date.now() : now;
    if (isOpen(s)) return { ok: false, reason: 'use-finishOpenSession' };
    if (s.state === 'completed') return { ok: true, session: s, changed: false, reason: 'already-completed' };
    if (s.state === 'interrupted') return { ok: false, reason: 'already-ended' };
    checkpoint(s, now);
    if (s.pauseStartedAt != null) { s.pausedSec += Math.max(0, (now - s.pauseStartedAt) / 1000); s.pauseStartedAt = null; }
    // Waktu aktual (tanpa jeda) menjadi durasi resmi sesi ini.
    s.plannedSec = Math.max(1, Math.round(s.activeSec));
    return completeSession(state, s, now);
  }

  /** Mengakhiri sesi waktu bebas: durasi sebenarnya (tanpa jeda) menjadi durasi sesi dan masuk total resmi.
      Sesi biasa tidak bisa diakhiri lewat sini; gunakan finishEarlySession untuk selesai lebih awal. */
  function finishOpenSession(state, s, now) {
    now = now == null ? Date.now() : now;
    if (!isOpen(s)) return { ok: false, reason: 'not-open' };
    if (s.state === 'completed') return { ok: true, session: s, changed: false, reason: 'already-completed' };
    if (s.state === 'interrupted') return { ok: false, reason: 'already-ended' };
    checkpoint(s, now);
    if (s.pauseStartedAt != null) { s.pausedSec += Math.max(0, (now - s.pauseStartedAt) / 1000); s.pauseStartedAt = null; }
    s.plannedSec = Math.max(1, Math.round(s.activeSec));
    return completeSession(state, s, now);
  }

  /** Membuka kembali sesi waktu bebas yang baru diakhiri ("Selesai sesi" lalu "Lanjut fokus"): hitungan berlanjut dari
      waktu terakhir, bukan dari nol. Selama berjalan sesi ini belum masuk total; masuk lagi saat diakhiri. */
  function reopenOpenSession(state, s, now) {
    now = now == null ? Date.now() : now;
    if (!isOpen(s)) return { ok: false, reason: 'not-open' };
    if (s.state !== 'completed') return { ok: false, reason: 'not-completed' };
    s.state = 'running';
    s.plannedSec = 1;                 // kembali ke penanda waktu bebas; waktu berjalan tetap di activeSec
    s.completedAt = null;
    s.endedAt = null;
    s.contributesToOfficial = false;
    s.pauseStartedAt = null;
    s.runStartedAt = now;
    s.checkpointAt = now;
    storeEv(state, now, 'session.reopened', s);
    return { ok: true, session: s };
  }

  /** Official focus seconds: completed sessions only, optionally filtered by
      a [from,to) timestamp window (used for daily attribution by completedAt). */
  function officialSeconds(sessions, from, to) {
    var total = 0;
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      if (!s.contributesToOfficial || s.state !== 'completed') continue;
      var at = s.completedAt != null ? s.completedAt : s.endedAt;
      if (at == null) continue;
      if (from != null && at < from) continue;
      if (to != null && at >= to) continue;
      total += s.plannedSec;
    }
    return Math.round(total);
  }

  /** Interrupted (non-official) focus seconds, optionally within [from,to). */
  function interruptedSeconds(sessions, from, to) {
    var total = 0;
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      if (s.state !== 'interrupted') continue;
      var at = s.endedAt != null ? s.endedAt : s.startedAt;
      if (from != null && at < from) continue;
      if (to != null && at >= to) continue;
      total += s.activeSec;
    }
    return Math.round(total);
  }

  function findSession(state, id) {
    for (var i = 0; i < state.sessions.length; i++) if (state.sessions[i].id === id) return state.sessions[i];
    return null;
  }
  function currentSession(state) {
    for (var i = state.sessions.length - 1; i >= 0; i--) {
      var s = state.sessions[i];
      if (s.state === 'running' || s.state === 'paused') return s;
    }
    return null;
  }

  /* ── crash / restart recovery ───────────────────────────────────────── */
  /* A session that was RUNNING when the app disappeared is restored as PAUSED.
     Focus time that elapsed while the app was unavailable is NEVER counted. */
  function recover(state, now) {
    now = now == null ? Date.now() : now;
    var recovered = [];
    for (var i = 0; i < state.sessions.length; i++) {
      var s = state.sessions[i];
      if (s.state !== 'running') continue;
      // Reconcile only up to the last trustworthy point: the checkpoint.
      // activeSec already contains everything accounted for before shutdown.
      s.state = 'paused';
      s.pauseStartedAt = now;
      s.runStartedAt = null;
      s.recoveredAt = now;
      s.checkpointAt = now;
      storeEv(state, now, 'session.recovered-paused', s);
      recovered.push(s);
    }
    return recovered;
  }

  /** Ringkasan riwayat sesi untuk SEMUA tampilan (satu aturan, bukan dihitung ulang di tiap UI):
      done/focusSec/longestSec = sesi selesai (plannedSec); cut/cutSec = sesi terputus (activeSec). */
  function summary(sessions) {
    var r = { done: 0, focusSec: 0, longestSec: 0, cut: 0, cutSec: 0 };
    (sessions || []).forEach(function (s) {
      if (s.state === 'completed') { r.done++; r.focusSec += s.plannedSec || 0; r.longestSec = Math.max(r.longestSec, s.plannedSec || 0); }
      else if (s.state === 'interrupted') { r.cut++; r.cutSec += s.activeSec || 0; }
    });
    return r;
  }
  /** Waktu akhir sesi untuk pengelompokan per hari. */
  function endTime(s) { return s.completedAt || s.endedAt || s.startedAt; }
  /** Total fokus selesai per hari: { 'YYYY-MM-DD': detik }. */
  function focusByDay(sessions) {
    var out = {};
    (sessions || []).forEach(function (s) {
      if (s.state !== 'completed') return;
      var k = dates.dayKey(endTime(s));
      out[k] = (out[k] || 0) + (s.plannedSec || 0);
    });
    return out;
  }

  return {
    STATES: STATES,
    summary: summary, endTime: endTime, focusByDay: focusByDay,
    createSession: createSession, checkpoint: checkpoint,
    activeSeconds: activeSeconds, remainingSeconds: remainingSeconds,
    isOpen: isOpen, clockSeconds: clockSeconds, finishOpenSession: finishOpenSession, finishEarlySession: finishEarlySession, reopenOpenSession: reopenOpenSession,
    pauseSession: pauseSession, resumeSession: resumeSession,
    stopSession: stopSession, completeSession: completeSession,
    officialSeconds: officialSeconds, interruptedSeconds: interruptedSeconds,
    findSession: findSession, currentSession: currentSession, recover: recover
  };
});
