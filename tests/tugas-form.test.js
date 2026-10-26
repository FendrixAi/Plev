'use strict';
/* Regresi form tambah cepat: panel detail tidak boleh menghapus nilai yang
   sudah diketik saat dibuka/ditutup. Perilaku runtime diverifikasi terpisah
   lewat Electron; tes ini menjaga struktur yang mencegah data hilang. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'pages', 'tugas.js'), 'utf8');

test('panel detail selalu ter-mount dan hanya disembunyikan', () => {
  assert.match(src, /id: 'ta-details'/, 'panel detail harus punya id stabil');
  assert.match(src, /add\.appendChild\(det\)/, 'panel detail harus selalu ditambahkan ke kartu');
  assert.match(src, /det\.hidden = !showDetails/, 'visibilitas panel memakai hidden, bukan mount ulang');
  assert.doesNotMatch(src, /if \(showDetails\) \{\s*var det/, 'panel detail tidak boleh dibuat kondisional');
});

test('toggle detail mempertahankan nilai dan memperbarui label/aria', () => {
  const toggle = src.slice(src.indexOf('var tog = ui.btn'), src.indexOf('form.appendChild(tog)'));
  assert.ok(toggle.length > 0, 'handler toggle harus ada');
  assert.doesNotMatch(toggle, /mount\(|ui\.clear\(/, 'toggle tidak boleh me-remount form (nilai akan hilang)');
  assert.match(toggle, /det\.hidden = !showDetails/);
  assert.match(src, /showDetails \? '− Detail' : '\+ Detail'/);
  assert.match(src, /setAttribute\('aria-expanded', String\(showDetails\)\)/);
  assert.match(src, /setAttribute\('aria-controls', 'ta-details'\)/);
});

test('submit membaca seluruh field detail dan memetakan durasi ke detik', () => {
  assert.match(src, /getElementById\('ta-desc'\)/);
  assert.match(src, /getElementById\('ta-pri'\)/);
  assert.match(src, /getElementById\('ta-min'\)/);
  assert.match(src, /durationSec: formState\.min > 0 \? formState\.min \* 60 : null/);
});

test('validasi dan default tidak berubah', () => {
  assert.match(src, /if \(!title\) \{ ui\.toast\('Judul tugas wajib diisi\.'/);
  assert.match(src, /if \(!JF\.dates\.isDayKey\(date\)\)/);
  assert.match(src, /formState = \{ title: '', date: date, desc: '', priority: 'normal', min: null \}/);
});
