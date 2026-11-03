'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { initUpdater } = require('../updater');

const STATE_JSON = JSON.stringify({ app: 'jam-fokus', exportedAt: '2026-11-03T00:00:00Z', state: { tasks: [1, 2], sessions: [] } });

function rig(opts) {
  opts = opts || {};
  const au = new EventEmitter();
  au.installed = null;
  au.quitAndInstall = (silent, run) => { au.installed = [silent, run]; };
  au.checkForUpdates = () => {
    au.emit('update-available', { version: '1.0.2' });
    au.emit('download-progress', { percent: 40, transferred: 4, total: 10, bytesPerSecond: 2 });
    au.emit('update-downloaded', { version: '1.0.2' });
    return Promise.resolve();
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jf-upd-'));
  const sent = [], queue = [];
  let busy = !!opts.busy, clock = 0;
  const r = {
    au, dir, sent, queue,
    setBusy: (b) => { busy = b; },
    // jalankan timer terdekat (urut pendaftaran)
    tick: () => { const t = queue.shift(); if (t) t.fn(); return !!t; },
    phases: () => sent.filter((m) => m[0] === 'update:status').map((m) => m[1].phase)
  };
  r.u = initUpdater({
    app: { isPackaged: opts.packaged !== false, getVersion: () => '1.0.1' },
    broadcast: (ch, p) => { sent.push([ch, p]); },
    isBusy: () => busy,
    loadUpdater: () => au,
    backupDir: path.join(dir, 'backups'),
    now: () => new Date(2026, 10, 3, 10, 0, clock++),
    beforeInstall: () => { r.before = true; },
    timers: { setTimeout: (fn) => { const t = { fn }; queue.push(t); return t; }, setInterval: () => {}, clearTimeout: (t) => { const i = queue.indexOf(t); if (i >= 0) queue.splice(i, 1); } }
  });
  return r;
}
const flush = () => new Promise((res) => setImmediate(res));

test('mode dev/portable: status unsupported, tidak memuat updater', async () => {
  const r = rig({ packaged: false });
  const s = await r.u.check(true);
  assert.strictEqual(s.phase, 'unsupported');
  assert.strictEqual(r.au.installed, null);
});

test('alur penuh: unduh → tunggu sesi selesai → hitung mundur → cadangan → pasang', async () => {
  const r = rig({ busy: true });
  await r.u.check(true);
  assert.deepStrictEqual(r.phases().slice(0, 4), ['checking', 'available', 'downloading', 'ready']);
  assert.strictEqual(r.u.getStatus().waiting, true);          // sesi berjalan: belum menghitung mundur
  assert.strictEqual(r.u.getStatus().countdown, null);
  r.setBusy(false);
  r.tick();                                                    // poll berikutnya → mulai hitung mundur
  assert.strictEqual(r.u.getStatus().countdown, 10);
  for (let i = 0; i < 9; i++) r.tick();
  assert.strictEqual(r.u.getStatus().countdown, 1);
  r.tick();                                                    // 0 → mulai pasang
  assert.strictEqual(r.u.getStatus().phase, 'installing');
  assert.ok(r.sent.some((m) => m[0] === 'update:prepare'));    // minta isi data dari jendela
  assert.strictEqual(r.u.receiveBackup(STATE_JSON), true);
  await flush();
  const files = fs.readdirSync(path.join(r.dir, 'backups'));
  assert.strictEqual(files.length, 1);
  assert.match(files[0], /^pre-update-\d{8}-\d{6}-v1\.0\.1\.json$/);
  assert.strictEqual(fs.readFileSync(path.join(r.dir, 'backups', files[0]), 'utf8'), STATE_JSON);
  assert.strictEqual(r.au.installed, null);                    // menunggu jeda 800 ms
  r.tick();
  assert.deepStrictEqual(r.au.installed, [true, true]);
  assert.strictEqual(r.before, true);
});

test('sesi baru dimulai saat hitung mundur: pemasangan ditunda lagi', async () => {
  const r = rig();
  await r.u.check(true);
  assert.strictEqual(r.u.getStatus().countdown, 10);
  r.setBusy(true);
  r.tick();
  assert.strictEqual(r.u.getStatus().waiting, true);
  assert.strictEqual(r.u.getStatus().countdown, null);
});

test('Batalkan menghentikan pemasangan otomatis; Pasang sekarang tetap bisa', async () => {
  const r = rig();
  await r.u.check(true);
  r.u.cancelAuto();
  assert.strictEqual(r.u.getStatus().cancelled, true);
  assert.strictEqual(r.queue.length, 0);
  r.u.installNow();
  await flush();
  assert.strictEqual(r.u.getStatus().phase, 'installing');
  r.u.receiveBackup(STATE_JSON);
  await flush();
  r.tick();
  assert.deepStrictEqual(r.au.installed, [true, true]);
});

test('cadangan gagal: pembaruan TIDAK dipasang dan data tidak disentuh', async () => {
  const r = rig();
  await r.u.check(true);
  r.u.installNow();
  await flush();
  r.u.receiveBackup('bukan json');
  await flush();
  const s = r.u.getStatus();
  assert.strictEqual(s.phase, 'ready');
  assert.match(s.error, /Cadangan otomatis gagal/);
  assert.strictEqual(r.au.installed, null);
});

test('hanya 3 cadangan terbaru yang disimpan', async () => {
  const r = rig();
  await r.u.check(true);
  for (let i = 0; i < 5; i++) {
    r.u.installNow();
    await flush();
    r.u.receiveBackup(STATE_JSON);
    await flush();
    r.u.getStatus();
    // kembalikan ke 'ready' agar bisa diulang
    r.au.emit('update-downloaded', { version: '1.0.2' });
    while (r.queue.length) r.queue.shift();
  }
  assert.strictEqual(fs.readdirSync(path.join(r.dir, 'backups')).length, 3);
});

test('cek otomatis yang gagal (offline) tidak memunculkan error', async () => {
  const r = rig();
  r.au.checkForUpdates = () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'));
  const s = await r.u.check(false);
  assert.strictEqual(s.phase, 'idle');
  const m = await r.u.check(true);
  assert.strictEqual(m.phase, 'error');
});
