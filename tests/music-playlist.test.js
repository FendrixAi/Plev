'use strict';
/* Playlist controller: add/validate, Next, auto-advance, loop, errors, break
   lifecycle, no duplicate players/listeners. Uses a fake audio element, so
   actual audibility still needs manual verification in Electron. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const MP = require('../shared/musicPlayer.js');

class FakeAudio {
  constructor() { this.src = ''; this.currentTime = 0; this.paused = true; this.plays = []; this.pauses = 0; this.failFor = new Set(); this.onended = null; this.onerror = null; }
  play() {
    this.paused = false; this.plays.push(this.src);
    if (this.failFor.has(this.src)) return Promise.reject(new Error('NotSupported'));
    return Promise.resolve();
  }
  pause() { this.paused = true; this.pauses++; }
  removeAttribute(a) { if (a === 'src') this.src = ''; }
  end() { this.onended && this.onended(); }
}
const flush = () => new Promise((r) => setImmediate(r));

function setup(names, opts) {
  opts = opts || {};
  const audio = new FakeAudio();
  const blobs = {}, urls = new Set(); let n = 0, changes = 0;
  const tracks = names.map((nm, i) => { const id = 't' + i; blobs[id] = { nm }; return { id, name: nm, size: 10 + i, sig: nm }; });
  const player = MP.createPlayer({
    audio, getBlob: (id) => blobs[id] || null, isLoop: () => !!opts.loop,
    createURL: (b) => { const u = 'blob:' + b.nm + '#' + (++n); urls.add(u); return u; },
    revokeURL: (u) => urls.delete(u), onChange: () => { changes++; }
  });
  player.setTracks(tracks);
  const nameNow = () => (player.status().track || {}).name;
  return { audio, player, blobs, urls, tracks, nameNow, changes: () => changes };
}

test('3+ music files can be added; duplicates, non-audio, empty and over-limit are rejected', () => {
  let i = 0; const uid = () => 'id' + (++i);
  const f = (name, size, type) => ({ name, size, type: type || '', lastModified: 1 });
  const r = MP.planAdd([], [f('a.mp3', 5), f('b.wav', 5), f('c.m4a', 5, 'audio/mp4'), f('a.mp3', 5), f('notes.txt', 5), f('empty.mp3', 0)], uid);
  assert.deepEqual(r.added.map((x) => x.name), ['a.mp3', 'b.wav', 'c.m4a']);
  assert.deepEqual(r.rejected.map((x) => x.reason), ['duplikat', 'bukan-audio', 'kosong']);
  const again = MP.planAdd(r.added, [f('b.wav', 5)], uid);
  assert.equal(again.added.length, 0); assert.equal(again.rejected[0].reason, 'duplikat');
  const full = MP.planAdd(new Array(MP.MAX_TRACKS).fill(0).map((_, k) => ({ id: 'x' + k, name: 'n' + k, size: 1, sig: 's' + k })), [f('z.mp3', 3)], uid);
  assert.equal(full.rejected[0].reason, 'penuh');
});

test('start plays the first track; Next moves to the next one immediately', () => {
  const t = setup(['A', 'B', 'C']);
  assert.equal(t.player.start({ breakBound: true }), true);
  assert.equal(t.nameNow(), 'A'); assert.equal(t.audio.paused, false);
  t.player.next(); assert.equal(t.nameNow(), 'B');
  t.player.next(); assert.equal(t.nameNow(), 'C');
  t.player.next(); assert.equal(t.nameNow(), 'A');        // Next also wraps
});

test('track ending auto-starts the next; the last wraps to the first (break-bound)', () => {
  const t = setup(['A', 'B', 'C']);
  t.player.start({ breakBound: true });
  const order = [t.nameNow()];
  for (let k = 0; k < 4; k++) { t.audio.end(); order.push(t.nameNow()); }
  assert.deepEqual(order, ['A', 'B', 'C', 'A', 'B']);
});

test('a long break keeps looping across many playlist cycles without interaction', () => {
  const t = setup(['A', 'B', 'C']);
  t.player.start({ breakBound: true });
  for (let k = 0; k < 30; k++) t.audio.end();              // 10 full loops
  assert.equal(t.player.status().active, true);
  assert.equal(t.nameNow(), 'A');
  assert.equal(t.audio.paused, false);
  assert.equal(t.urls.size, 1);                            // one live object URL, no leak
});

test('outside a break the playlist plays through once, or loops when the repeat option is on', () => {
  const once = setup(['A', 'B']);
  once.player.start({});
  once.audio.end(); assert.equal(once.nameNow(), 'B');
  once.audio.end(); assert.equal(once.player.status().active, false);
  const loop = setup(['A', 'B'], { loop: true });
  loop.player.start({});
  loop.audio.end(); loop.audio.end(); assert.equal(loop.nameNow(), 'A');
});

test('Hentikan Musik stops immediately and releases audio + URL', () => {
  const t = setup(['A', 'B']);
  t.player.start({ breakBound: true });
  t.player.stop();
  assert.equal(t.player.status().active, false);
  assert.equal(t.audio.paused, true); assert.equal(t.audio.src, ''); assert.equal(t.urls.size, 0);
  t.audio.end(); t.audio.onerror();                         // late media events are ignored
  assert.equal(t.player.status().active, false);
});

test('break end stops break-bound music, clears the session, keeps saved tracks; next break starts fresh', () => {
  const t = setup(['A', 'B', 'C']);
  const before = JSON.stringify(t.player.tracks());
  t.player.start({}); t.player.next();                      // playing B, started outside a break
  t.player.bindBreak(true);                                 // break begins: music continues
  assert.equal(t.nameNow(), 'B'); assert.equal(t.audio.paused, false);
  assert.equal(t.player.endBreak(), true);                  // break timer reached zero
  assert.equal(t.player.status().active, false); assert.equal(t.audio.paused, true); assert.equal(t.urls.size, 0);
  assert.equal(JSON.stringify(t.player.tracks()), before);  // playlist configuration intact
  assert.ok(t.blobs.t0 && t.blobs.t1 && t.blobs.t2);        // files intact
  assert.equal(t.player.endBreak(), false);                 // idempotent: no duplicate cleanup
  t.player.start({ breakBound: true });
  assert.equal(t.nameNow(), 'A');                           // clean session starts at the first track
});

test('break end does not touch music the user started outside any break', () => {
  const t = setup(['A', 'B']);
  t.player.start({});
  assert.equal(t.player.endBreak(), false);
  assert.equal(t.player.status().active, true);
});

test('ifIdle never restarts or duplicates a running session; it only binds it to the break', () => {
  const t = setup(['A', 'B', 'C']);
  t.player.start({}); t.player.next();
  const playsBefore = t.audio.plays.length;
  for (let k = 0; k < 20; k++) t.player.start({ ifIdle: true, breakBound: true });
  assert.equal(t.audio.plays.length, playsBefore);          // no extra play() calls
  assert.equal(t.nameNow(), 'B');
  assert.equal(t.player.status().breakBound, true);
});

test('repeated transitions keep a single set of listeners and a single audio element', () => {
  const t = setup(['A', 'B']);
  const ended = t.audio.onended, errored = t.audio.onerror;
  for (let k = 0; k < 15; k++) { t.player.start({ breakBound: true }); t.player.next(); t.player.endBreak(); }
  assert.equal(t.audio.onended, ended); assert.equal(t.audio.onerror, errored);
  t.player.start({ breakBound: true });
  const before = t.audio.plays.length;
  t.audio.end();
  assert.equal(t.audio.plays.length, before + 1);           // exactly one advance per ended event
});

test('an unplayable track is skipped; if every track fails it stops instead of looping forever', async () => {
  const t = setup(['A', 'B', 'C']);
  t.audio.failFor.add('blob:B#2');
  t.player.start({ breakBound: true });                      // A plays (#1)
  t.audio.end();                                             // B (#2) rejects -> C
  await flush();
  assert.equal(t.nameNow(), 'C');
  t.audio.end(); assert.equal(t.nameNow(), 'A');             // B stays skipped for this session
  const bad = setup(['A', 'B']);
  bad.audio.play = function () { this.paused = false; this.plays.push(this.src); return Promise.reject(new Error('x')); };
  bad.player.start({ breakBound: true });
  await flush(); await flush(); await flush();
  assert.equal(bad.player.status().active, false);
  assert.ok(bad.audio.plays.length <= 4, 'bounded attempts: ' + bad.audio.plays.length);
});

test('a media error event skips to the next valid track', () => {
  const t = setup(['A', 'B', 'C']);
  t.player.start({ breakBound: true });
  t.audio.onerror();
  assert.equal(t.nameNow(), 'B');
});

test('missing files are never played but stay in the list', () => {
  const t = setup(['A', 'B', 'C']);
  const list = t.player.tracks(); list[1].missing = true; t.player.setTracks(list);
  t.player.start({ breakBound: true });
  t.audio.end(); assert.equal(t.nameNow(), 'C');
  assert.equal(t.player.tracks().length, 3);
  const none = setup(['A']); const l = none.player.tracks(); l[0].missing = true; none.player.setTracks(l);
  assert.equal(none.player.start({}), false);
  assert.equal(none.player.hasPlayable(), false);
});

test('removing the playing track moves on; removing the others keeps playing', () => {
  const t = setup(['A', 'B', 'C']);
  t.player.start({ breakBound: true }); t.player.next();     // B
  t.player.setTracks(t.tracks.filter((x) => x.name !== 'A'));
  assert.equal(t.nameNow(), 'B'); assert.equal(t.player.status().index, 0);
  t.player.setTracks(t.tracks.filter((x) => x.name === 'C'));
  assert.equal(t.nameNow(), 'C');
  t.player.setTracks([]);
  assert.equal(t.player.status().active, false);
});

test('pause / resume keep the session; a stale play() rejection after switching is ignored', async () => {
  const t = setup(['A', 'B']);
  t.player.start({ breakBound: true });
  t.player.pause(); assert.equal(t.player.status().paused, true);
  t.player.resume(); assert.equal(t.player.status().paused, false); assert.equal(t.audio.paused, false);
  t.audio.failFor.add('blob:B#2');
  t.player.next();                                           // B will reject...
  t.player.next();                                           // ...but we already moved on to A
  await flush();
  assert.equal(t.nameNow(), 'A');
});

test('wiring: starting focus stops music; Istirahat keeps it; break end clears it', () => {
  const root = path.join(__dirname, '..');
  const core = fs.readFileSync(path.join(root, 'renderer', 'core.js'), 'utf8');
  const start = core.slice(core.indexOf('app.startTask = function'), core.indexOf('app.pause = function'));
  const sb = core.slice(core.indexOf('function startBreak('), core.indexOf('app.startBreak'));
  const eb = core.slice(core.indexOf('function endBreak('), core.indexOf('app.skipBreak'));
  assert.match(start, /stopAllMusic\(\)/);          // Lanjut fokus / any focus start ends music
  assert.doesNotMatch(sb, /stopAllMusic|player\.stop\(/);
  assert.match(sb, /breakBound: true/);
  assert.match(eb, /player\.endBreak\(\)/);
  assert.equal((core.match(/createPlayer\(/g) || []).length, 1);
  assert.equal((core.match(/new Audio\(\)/g) || []).length, 2);   // playlist + break-end alert only
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(idx.indexOf('shared/musicPlayer.js') < idx.indexOf('renderer/core.js'));
  const bar = fs.readFileSync(path.join(root, 'renderer', 'musicbar.js'), 'utf8');
  ['Berikutnya', 'Hentikan Musik'].forEach((l) => assert.ok(bar.includes(l), l));
  const set = fs.readFileSync(path.join(root, 'renderer', 'pages', 'pengaturan.js'), 'utf8');
  assert.ok(set.includes('Tambah Musik'));
});
