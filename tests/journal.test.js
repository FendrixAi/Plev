'use strict';
const test = require('node:test');
const assert = require('node:assert');
const journal = require('../shared/journal.js');
const store = require('../shared/store.js');
const backup = require('../shared/backup.js');

const DAY = '2026-10-27';
const OTHER = '2026-10-28';
const at = (day, hour) => {
  const p = day.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], hour || 10, 0, 0, 0).getTime();
};
const body = (over) => Object.assign({
  wins: 'Menyelesaikan laporan',
  challenges: 'Notifikasi mengganggu',
  learned: 'Mulai lebih awal membantu',
  priorities: 'Siapkan kerangka besok'
}, over || {});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('jurnal baru tersimpan dengan tanggal sebagai kunci dan timestamp', () => {
  const state = store.createState();
  assert.deepStrictEqual(state.journals, {});
  const now = at(DAY, 20);
  const r = journal.save(state, DAY, body(), now);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.changed, true);
  assert.strictEqual(r.entry.date, DAY);
  assert.strictEqual(r.entry.createdAt, now);
  assert.strictEqual(r.entry.updatedAt, now);
  assert.strictEqual(journal.entryFor(state, DAY).wins, 'Menyelesaikan laporan');
  assert.strictEqual(journal.count(state), 1);
});

test('edit mempertahankan createdAt dan memisahkan isi antar tanggal', () => {
  const state = store.createState();
  const first = at(DAY, 20);
  const second = at(DAY, 21);
  journal.save(state, DAY, body(), first);
  const r = journal.save(state, DAY, body({ wins: 'Revisi pencapaian' }), second);
  assert.strictEqual(r.changed, true);
  assert.strictEqual(r.entry.createdAt, first);
  assert.strictEqual(r.entry.updatedAt, second);
  assert.strictEqual(journal.entryFor(state, DAY).wins, 'Revisi pencapaian');

  journal.save(state, OTHER, body({ wins: 'Hari kedua' }), at(OTHER, 8));
  assert.strictEqual(journal.entryFor(state, DAY).wins, 'Revisi pencapaian');
  assert.strictEqual(journal.entryFor(state, OTHER).wins, 'Hari kedua');
  assert.strictEqual(journal.count(state), 2);
});

test('tidak ada perubahan tidak membuat event atau timestamp palsu', () => {
  const state = store.createState();
  const now = at(DAY, 20);
  journal.save(state, DAY, body(), now);
  const before = state.events.length;
  const r = journal.save(state, DAY, body(), now + 5000);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.changed, false);
  assert.strictEqual(state.events.length, before);
  assert.strictEqual(journal.entryFor(state, DAY).updatedAt, now);
});

test('jurnal kosong dihapus dan tanggal tidak valid ditolak', () => {
  const state = store.createState();
  journal.save(state, DAY, body(), at(DAY, 20));
  const r = journal.save(state, DAY, { wins: '  ', challenges: '', learned: '', priorities: '' }, at(DAY, 21));
  assert.strictEqual(r.removed, true);
  assert.strictEqual(journal.entryFor(state, DAY), null);
  assert.strictEqual(journal.count(state), 0);
  assert.strictEqual(journal.save(state, '2026-02-31', body(), Date.now()).ok, false);
});

test('isi bertahan setelah serialisasi JSON (restart) dan state lama dinormalisasi', () => {
  const state = store.createState();
  journal.save(state, DAY, body({ learned: 'Baris satu\nBaris dua' }), at(DAY, 20));
  const restarted = JSON.parse(JSON.stringify(state));
  assert.strictEqual(journal.entryFor(restarted, DAY).learned, 'Baris satu\nBaris dua');

  const oldState = { version: store.SCHEMA_VERSION, tasks: [], sessions: [], snapshots: [] };
  assert.doesNotThrow(() => journal.entryFor(oldState, DAY));
  journal.save(oldState, DAY, body(), at(DAY, 20));
  assert.ok(oldState.journals && oldState.journals[DAY]);
});

test('ringkasan hari memakai data tugas dan sesi yang sudah ada', () => {
  const state = store.createState();
  const now = at(DAY, 9);
  const task = store.addTask(state, { title: 'Tugas selesai', targetDate: DAY, durationSec: 1500 }, now);
  store.completeTask(state, task.id, at(DAY, 10));
  state.sessions.push({
    id: 's1', state: 'completed', contributesToOfficial: true,
    plannedSec: 1500, activeSec: 1500, completedAt: at(DAY, 11), endedAt: at(DAY, 11)
  });
  state.sessions.push({
    id: 's2', state: 'interrupted', contributesToOfficial: false,
    plannedSec: 1500, activeSec: 300, endedAt: at(DAY, 12)
  });
  const s = journal.summary(state, DAY);
  assert.strictEqual(s.completed, 1);
  assert.strictEqual(s.focusSec, 1500);
  assert.strictEqual(s.sessions, 1);
  assert.strictEqual(s.hasSnapshot, false);
});

test('ringkasan memakai snapshot final bila tersedia', () => {
  const state = store.createState();
  state.snapshots.push({
    date: DAY, officialFocusSec: 3600, completedTaskIds: ['a', 'b'], complete: true
  });
  const s = journal.summary(state, DAY);
  assert.strictEqual(s.completed, 2);
  assert.strictEqual(s.focusSec, 3600);
  assert.strictEqual(s.hasSnapshot, true);
  assert.strictEqual(s.complete, true);
});

test('autosave debounce menyimpan versi terbaru saja', async () => {
  const calls = [];
  const statuses = [];
  const saver = journal.createAutosave({
    delay: 10,
    save: (day, content) => { calls.push({ day, content }); return true; },
    onStatus: (status) => statuses.push(status)
  });
  saver.schedule(DAY, body({ wins: 'A' }));
  saver.schedule(DAY, body({ wins: 'B' }));
  await sleep(35);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].content.wins, 'B');
  assert.strictEqual(saver.isDirty(), false);
  assert.strictEqual(statuses[statuses.length - 1], 'saved');
});

test('autosave serial: hasil lama tidak menimpa antrean yang lebih baru', async () => {
  const calls = [];
  const statuses = [];
  let release;
  const firstWrite = new Promise((resolve) => { release = resolve; });
  const saver = journal.createAutosave({
    delay: 1000,
    save: (day, content) => {
      calls.push(content.wins);
      if (calls.length === 1) return firstWrite;
      return true;
    },
    onStatus: (status) => statuses.push(status)
  });
  saver.schedule(DAY, body({ wins: 'A' }));
  const pending = saver.flush();
  saver.schedule(DAY, body({ wins: 'B' }));
  release(true);
  const ok = await pending;
  assert.strictEqual(ok, true);
  assert.deepStrictEqual(calls, ['A', 'B']);
  assert.strictEqual(saver.isDirty(), false);
  assert.strictEqual(statuses[statuses.length - 1], 'saved');
});

test('autosave menyimpan ulang setelah gagal dan tidak melaporkan tersimpan palsu', async () => {
  let fail = true;
  let calls = 0;
  const statuses = [];
  const saver = journal.createAutosave({
    delay: 1000,
    save: () => { calls++; return !fail; },
    onStatus: (status) => statuses.push(status)
  });
  saver.schedule(DAY, body());
  const first = await saver.flush();
  assert.strictEqual(first, false);
  assert.strictEqual(saver.isDirty(), true);
  assert.strictEqual(statuses[statuses.length - 1], 'error');

  fail = false;
  const second = await saver.flush();
  assert.strictEqual(second, true);
  assert.strictEqual(calls, 2);
  assert.strictEqual(saver.isDirty(), false);
  assert.strictEqual(statuses[statuses.length - 1], 'saved');
});

test('cadangan menyertakan jurnal, tetap kompatibel tanpa jurnal, dan menolak bentuk rusak', () => {
  const state = store.createState();
  journal.save(state, DAY, body(), at(DAY, 20));
  const text = JSON.stringify({ app: 'jam-fokus', state: state });
  const r = backup.validate(text);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.summary.journals, 1);
  assert.strictEqual(r.state.journals[DAY].wins, 'Menyelesaikan laporan');

  const old = JSON.parse(text);
  delete old.state.journals;
  assert.strictEqual(backup.validate(JSON.stringify(old)).ok, true);

  const broken = JSON.parse(text);
  broken.state.journals = [];
  assert.strictEqual(backup.validate(JSON.stringify(broken)).ok, false);
});
