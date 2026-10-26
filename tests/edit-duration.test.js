'use strict';
/* Regresi: mengubah durasi tugas harus konsisten dengan sisa waktu (`left`).
   Tanpa sesi aktif, `left` mengikuti durasi baru. Saat sesi berjalan/dijeda,
   sesi tersebut tidak boleh direset atau diperpanjang diam-diam. */
const test = require('node:test');
const assert = require('node:assert');
const store = require('../shared/store.js');
const sessions = require('../shared/sessions.js');

function T(d, h, m) {
  const [y, mo, day] = d.split('-');
  return new Date(y, mo - 1, day, h || 0, m || 0).getTime();
}

function plannedFor(state, task) {
  let planned = task.left > 0 ? task.left : (task.durationSec > 0 ? task.durationSec : state.settings.defaultFocusSec);
  if (!(planned > 0)) planned = 1500;
  return planned;
}

test('menurunkan durasi tugas idle mengatur ulang sisa waktu yang basi', () => {
  const s = store.createState();
  const t = store.addTask(s, { title: 'Turunkan', targetDate: '2026-10-25', durationSec: 1500 }, T('2026-10-25', 9));
  t.left = 1200; // sisa lama dari sesi sebelumnya

  const r = store.editTask(s, t.id, { durationSec: 60 }, T('2026-10-25', 9, 5));

  assert.equal(r.ok, true);
  assert.equal(t.durationSec, 60);
  assert.equal(t.left, 60, 'sisa waktu harus mengikuti durasi baru, bukan 1200');
  assert.equal(plannedFor(s, t), 60, 'timer harus memakai 60 detik');
});

test('menaikkan durasi tugas idle mengatur ulang sisa waktu', () => {
  const s = store.createState();
  const t = store.addTask(s, { title: 'Naikkan', targetDate: '2026-10-25', durationSec: 900 }, T('2026-10-25', 9));
  t.left = 120;

  store.editTask(s, t.id, { durationSec: 1800 }, T('2026-10-25', 9, 5));

  assert.equal(t.durationSec, 1800);
  assert.equal(t.left, 1800);
  assert.equal(plannedFor(s, t), 1800);
});

test('durasi tugas dengan sesi berjalan tidak mereset sesi yang sedang berjalan', () => {
  const s = store.createState();
  const t = store.addTask(s, { title: 'Berjalan', targetDate: '2026-10-25', durationSec: 900 }, T('2026-10-25', 9));
  const ses = sessions.createSession(s, { taskId: t.id, taskName: t.title, plannedSec: 900 }, T('2026-10-25', 9, 10));
  t.left = 300; // snapshot sisa terakhir

  store.editTask(s, t.id, { durationSec: 60 }, T('2026-10-25', 9, 15));

  assert.equal(t.durationSec, 60, 'durasi tersimpan untuk sesi berikutnya');
  assert.equal(t.left, 300, 'sisa waktu milik sesi berjalan tidak boleh direset');
  assert.equal(ses.plannedSec, 900, 'sesi berjalan mempertahankan durasi yang sudah dimulai');
  assert.equal(ses.state, 'running');
});

test('durasi tugas dengan sesi dijeda tidak mengubah sisa maupun status', () => {
  const s = store.createState();
  const t = store.addTask(s, { title: 'Dijeda', targetDate: '2026-10-25', durationSec: 900 }, T('2026-10-25', 9));
  const ses = sessions.createSession(s, { taskId: t.id, taskName: t.title, plannedSec: 900 }, T('2026-10-25', 9, 10));
  sessions.pauseSession(s, ses, T('2026-10-25', 9, 20));
  t.left = 840;

  store.editTask(s, t.id, { durationSec: 60 }, T('2026-10-25', 9, 25));

  assert.equal(t.durationSec, 60);
  assert.equal(t.left, 840);
  assert.equal(ses.plannedSec, 900);
  assert.equal(ses.state, 'paused');
});

test('perubahan durasi dan sisa waktu bertahan setelah serialisasi state', () => {
  const s = store.createState();
  const t = store.addTask(s, { title: 'Persisten', targetDate: '2026-10-25', durationSec: 1500 }, T('2026-10-25', 9));
  t.left = 900;

  store.editTask(s, t.id, { durationSec: 600 }, T('2026-10-25', 9, 5));
  const reloaded = JSON.parse(JSON.stringify(s));
  const t2 = reloaded.tasks.find((x) => x.id === t.id);

  assert.equal(t2.durationSec, 600);
  assert.equal(t2.left, 600);
});

test('tugas selesai (sisa 0) mendapat sisa penuh saat durasi diubah', () => {
  const s = store.createState();
  const t = store.addTask(s, { title: 'Selesai', targetDate: '2026-10-25', durationSec: 900 }, T('2026-10-25', 9));
  t.done = true;
  t.left = 0;

  store.editTask(s, t.id, { durationSec: 600 }, T('2026-10-25', 9, 5));

  assert.equal(t.durationSec, 600);
  assert.equal(t.left, 600);
  assert.equal(t.done, true, 'mengubah durasi tidak boleh membuka kembali tugas');
});

test('durasi tidak berubah jika nilai di luar batas dinormalisasi ke nilai yang sama', () => {
  const s = store.createState();
  const t = store.addTask(s, { title: 'Batas', targetDate: '2026-10-25', durationSec: 60 }, T('2026-10-25', 9));
  t.left = 30; // lebih kecil dari minimum yang diizinkan (mis. sisa tak lazim)

  const r = store.editTask(s, t.id, { durationSec: 30 }, T('2026-10-25', 9, 5));

  assert.equal(r.ok, true);
  assert.equal(t.durationSec, 60, 'durasi tetap pada minimum 60 detik');
  assert.equal(t.left, 30, 'tidak ada perubahan durasi, jadi sisa tidak disentuh');
});
