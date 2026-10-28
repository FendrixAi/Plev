'use strict';
/* Regresi copy: tidak ada jargon Inggris berulang, label aksi konsisten,
   dan nilai kosong tidak ditampilkan sebagai nol yang menyesatkan. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, 'renderer', 'pages', p), 'utf8');

test('jargon "streak" diganti dengan istilah Indonesia', () => {
  assert.match(read('beranda.js'), /'Rentetan hari'/);
  const set = read('pengaturan.js');
  assert.match(set, /Target tugas per hari \(rentetan\)/);
  assert.doesNotMatch(set, /\(streak\)|streak di Beranda/);
});

test('label aksi dan judul konsisten', () => {
  assert.doesNotMatch(read('beranda.js'), /Berhenti permanen/);
  assert.match(read('beranda.js'), /Hentikan permanen/);
  assert.doesNotMatch(read('pengaturan.js'), /Sesi & timer/);
  assert.match(read('pengaturan.js'), /Sesi & pengatur waktu/);
});

test('tidak ada label perkiraan yang berulang', () => {
  assert.doesNotMatch(read('analitik.js'), /Perkiraan \(perkiraan/);
  assert.match(read('analitik.js'), /Perkiraan \(bukan hasil\)/);
});

test('nilai kosong memakai — dan bukan 0 detik', () => {
  assert.match(read('beranda.js'), /st\.officialSec \? ui\.fmt\.dur\(st\.officialSec\) : '—'/);
  assert.match(read('analitik.js'), /offSec > 0 \? ui\.fmt\.dur\(offSec\) : '—'/);
  assert.match(read('riwayat.js'), /belum ada fokus tercatat/);
});
