/* Jam Fokus — playlist controller for focus-end / break music.
   Owns ONE audio element and ONE playback session. It knows nothing about
   dialogs, pages or timers: the timer only calls start / bindBreak / endBreak,
   so closing a dialog or switching screens can never touch playback.
   Audio, object URLs and blob lookup are injected so the whole thing is
   testable in Node with a fake audio element.
   UMD: browser -> window.JF.musicPlayer, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JF = root.JF || {}, root.JF.musicPlayer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba', 'webm'];
  var MAX_TRACKS = 50;
  var MAX_BYTES = 150 * 1024 * 1024;

  function extOf(name) { var m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; }
  function signature(f) { return [f.name, f.size, f.lastModified || 0].join('|'); }

  /** Pure: which of the picked files may join the playlist. Never mutates `existing`. */
  function planAdd(existing, files, uid) {
    var added = [], rejected = [];
    var seen = {};
    (existing || []).forEach(function (t) { seen[t.sig] = true; seen['n|' + t.name + '|' + t.size] = true; });
    var room = MAX_TRACKS - (existing || []).length;
    Array.prototype.forEach.call(files || [], function (f) {
      var name = f && f.name ? String(f.name) : '';
      if (!name || !(f.size > 0)) { rejected.push({ name: name || '(tanpa nama)', reason: 'kosong' }); return; }
      var isAudio = (typeof f.type === 'string' && f.type.indexOf('audio/') === 0) || AUDIO_EXT.indexOf(extOf(name)) >= 0;
      if (!isAudio) { rejected.push({ name: name, reason: 'bukan-audio' }); return; }
      if (f.size > MAX_BYTES) { rejected.push({ name: name, reason: 'terlalu-besar' }); return; }
      var sig = signature(f), nsig = 'n|' + name + '|' + f.size;
      if (seen[sig] || seen[nsig]) { rejected.push({ name: name, reason: 'duplikat' }); return; }
      if (added.length >= room) { rejected.push({ name: name, reason: 'penuh' }); return; }
      seen[sig] = true; seen[nsig] = true;
      added.push({ id: uid(), name: name, size: f.size, sig: sig, file: f });
    });
    return { added: added, rejected: rejected };
  }

  /**
   * deps: { audio, createURL(blob), revokeURL(url), getBlob(id), isLoop(), onChange() }
   * `audio` needs: src, currentTime, play() -> promise, pause(), removeAttribute('src'), onended, onerror.
   */
  function createPlayer(deps) {
    var audio = deps.audio;
    var tracks = [];            // [{id, name, size, sig, missing?}]
    var session = null;         // { currentId, index, breakBound, paused, failed:{} }
    var token = 0;              // invalidates stale async play() results
    var url = null;

    function emit() { if (deps.onChange) { try { deps.onChange(); } catch (e) { /* UI must never break audio */ } } }
    function releaseURL() { if (url) { try { deps.revokeURL(url); } catch (e) { /* */ } url = null; }
    }
    function indexOf(id) { for (var i = 0; i < tracks.length; i++) if (tracks[i].id === id) return i; return -1; }
    function playableAt(i) {
      var t = tracks[i];
      if (!t || t.missing || !deps.getBlob(t.id)) return false;
      return !(session && session.failed[t.id]);
    }
    /** Next playable index after `from`; with wrap it may come back around (even to `from`). */
    function nextPlayable(from, wrap) {
      var n = tracks.length;
      for (var k = 1; k <= n; k++) {
        var j = from + k;
        if (j >= n) { if (!wrap) return -1; j = j % n; }
        if (playableAt(j)) return j;
      }
      return -1;
    }
    function hasPlayable() {
      for (var i = 0; i < tracks.length; i++) {
        var t = tracks[i];
        if (t && !t.missing && deps.getBlob(t.id)) return true;
      }
      return false;
    }

    function stop() {
      var was = !!session || !!url;
      token++;
      session = null;           // cleared FIRST so late media events are ignored
      try { audio.pause(); } catch (e) { /* */ }
      try { audio.currentTime = 0; } catch (e) { /* */ }
      releaseURL();
      try { if (audio.removeAttribute) audio.removeAttribute('src'); } catch (e) { /* */ }
      if (was) emit();
      return was;
    }

    function loadAndPlay(idx) {
      var t = tracks[idx];
      var blob = t && deps.getBlob(t.id);
      if (!blob) { fail(idx); return; }
      var tok = ++token;
      releaseURL();
      url = deps.createURL(blob);
      audio.src = url;
      try { audio.currentTime = 0; } catch (e) { /* */ }
      session.index = idx; session.currentId = t.id; session.paused = false;
      var p;
      try { p = audio.play(); } catch (e) { p = Promise.reject(e); }
      if (p && typeof p.then === 'function') p.then(null, function () { if (tok === token && session) fail(idx); });
      emit();
    }

    /** A track could not play: skip it for this session; stop when nothing playable is left. */
    function fail(idx) {
      if (!session) return;
      var t = tracks[idx];
      if (t) session.failed[t.id] = true;
      var n = nextPlayable(idx, true);
      if (n < 0) { stop(); return; }
      loadAndPlay(n);
    }

    function advance() {
      if (!session) return;
      var wrap = session.breakBound || (deps.isLoop ? !!deps.isLoop() : false);
      var n = nextPlayable(session.index, wrap);
      if (n < 0) { stop(); return; }
      loadAndPlay(n);
    }

    // Registered exactly once per player: repeated timer transitions cannot stack listeners.
    audio.onended = function () { advance(); };
    audio.onerror = function () { if (session) fail(session.index); };

    /**
     * opts: { id?, ifIdle?, breakBound? }
     * ifIdle: leave an already running session untouched (only apply breakBound).
     */
    function start(opts) {
      opts = opts || {};
      if (session) {
        if (opts.breakBound) session.breakBound = true;
        if (opts.ifIdle) { emit(); return false; }
        var i = opts.id ? indexOf(opts.id) : -1;
        if (i < 0) { emit(); return false; }
        delete session.failed[opts.id];
        if (!playableAt(i)) return false;
        loadAndPlay(i);
        return true;
      }
      if (!hasPlayable()) return false;
      session = { currentId: null, index: -1, breakBound: !!opts.breakBound, paused: false, failed: {} };
      var idx = opts.id ? indexOf(opts.id) : -1;
      if (idx < 0 || !playableAt(idx)) idx = nextPlayable(-1, false);
      if (idx < 0) { session = null; return false; }
      loadAndPlay(idx);
      return true;
    }

    function next() {
      if (!session) return false;
      var n = nextPlayable(session.index, true);
      if (n < 0) { stop(); return false; }
      loadAndPlay(n);
      return true;
    }
    function pause() {
      if (!session || session.paused) return false;
      try { audio.pause(); } catch (e) { /* */ }
      session.paused = true; emit(); return true;
    }
    function resume() {
      if (!session || !session.paused) return false;
      session.paused = false;
      var tok = token, idx = session.index, p;
      try { p = audio.play(); } catch (e) { p = Promise.reject(e); }
      if (p && typeof p.then === 'function') p.then(null, function () { if (tok === token && session) fail(idx); });
      emit(); return true;
    }
    function bindBreak(on) { if (!session) return false; session.breakBound = !!on; return true; }
    /** Break lifecycle ended: stop break-bound music and clear the temporary session. */
    function endBreak() {
      if (session && session.breakBound) { stop(); return true; }
      return false;
    }

    /** Replace the track list (add / remove / load). Keeps playing the current track when it still exists. */
    function setTracks(list) {
      var oldIndex = session ? session.index : -1;
      tracks = (list || []).map(function (t) { return t; });
      if (!session) { emit(); return; }
      var i = indexOf(session.currentId);
      if (i >= 0) { session.index = i; emit(); return; }
      var n = nextPlayable(Math.min(oldIndex, tracks.length) - 1, true);
      if (n < 0) { stop(); return; }
      loadAndPlay(n);
    }

    function status() {
      var cur = session ? tracks[indexOf(session.currentId)] || null : null;
      return {
        active: !!session, paused: !!(session && session.paused), breakBound: !!(session && session.breakBound),
        index: session ? indexOf(session.currentId) : -1, trackId: session ? session.currentId : null,
        track: cur, count: tracks.length
      };
    }

    return {
      start: start, next: next, pause: pause, resume: resume, stop: stop,
      bindBreak: bindBreak, endBreak: endBreak, setTracks: setTracks, hasPlayable: hasPlayable,
      status: status, tracks: function () { return tracks.slice(); }
    };
  }

  return { createPlayer: createPlayer, planAdd: planAdd, AUDIO_EXT: AUDIO_EXT, MAX_TRACKS: MAX_TRACKS, MAX_BYTES: MAX_BYTES };
});
