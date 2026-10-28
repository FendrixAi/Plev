'use strict';
const test = require('node:test');
const assert = require('node:assert');
const backup = require('../shared/backup.js');
const store = require('../shared/store.js');

const good = () => ({
  app: 'jam-fokus', exportedAt: '2026-10-26T02:00:00.000Z',
  state: { version: store.SCHEMA_VERSION, tasks: [{ id: 't1', title: 'Belajar' }], sessions: [{ id: 's1' }], snapshots: [{ date: '2026-10-25' }], settings: {} }
});
const text = (o) => JSON.stringify(o);

test('cadangan valid diterima dan diringkas', () => {
  const r = backup.validate(text(good()));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual([r.summary.tasks, r.summary.sessions, r.summary.snapshots], [1, 1, 1]);
});

test('berkas kosong, bukan JSON, atau bukan cadangan Jam Fokus ditolak', () => {
  assert.strictEqual(backup.validate('').ok, false);
  assert.match(backup.validate('{bukan json').error, /JSON/);
  assert.match(backup.validate('{"a":1}').error, /bukan berkas cadangan/);
  const other = good(); other.app = 'aplikasi-lain';
  assert.strictEqual(backup.validate(text(other)).ok, false);
});

test('versi data yang tidak cocok ditolak dengan pesan jelas', () => {
  const g = good(); g.state.version = 1;
  const r = backup.validate(text(g));
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /Versi data/);
});

test('bagian rusak ditolak (tugas, sesi, laporan)', () => {
  let g = good(); g.state.tasks = 'bukan array'; assert.strictEqual(backup.validate(text(g)).ok, false);
  g = good(); g.state.tasks = [{ id: 1 }]; assert.match(backup.validate(text(g)).error, /tugas yang rusak/);
  g = good(); g.state.sessions = [5]; assert.match(backup.validate(text(g)).error, /sesi yang rusak/);
  g = good(); g.state.snapshots = [null]; assert.match(backup.validate(text(g)).error, /laporan harian yang rusak/);
});

test('kunci berbahaya (prototype pollution) ditolak', () => {
  const raw = '{"app":"jam-fokus","state":{"version":' + store.SCHEMA_VERSION + ',"tasks":[],"sessions":[],"snapshots":[],"settings":{"__proto__":{"x":1}}}}';
  assert.match(backup.validate(raw).error, /tidak aman/);
  assert.strictEqual({}.x, undefined);
});

test('BOM di awal berkas tidak jadi masalah; settings hilang diisi objek kosong', () => {
  const g = good(); delete g.state.settings;
  const r = backup.validate('\uFEFF' + text(g));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.state.settings, {});
});

test('berkas terlalu besar ditolak', () => {
  assert.match(backup.validate('x'.repeat(backup.MAX_CHARS + 1)).error, /terlalu besar/);
});
