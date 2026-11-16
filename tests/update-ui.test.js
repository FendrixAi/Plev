'use strict';
/* Regresi temuan F-03 audit 2026-11-16: teks status "Tunda" pada pembaruan.
   Catatan: F-03 di tests/security-fixes.test.js berasal dari audit 2026-11-11
   (Library/script import) dan merupakan temuan yang berbeda. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'renderer', 'update-ui.js'), 'utf8');

test('F-03 pembaruan: status Tunda tidak menjanjikan pemasangan otomatis saat keluar', () => {
  assert.doesNotMatch(src, /Akan terpasang otomatis saat kamu Keluar dari menu tray/);
  assert.doesNotMatch(src, /Keluar dari menu tray/);
  assert.match(src, /Pemasangan ditunda\. Klik Pasang sekarang saat kamu siap\./);
});

test('F-03 pembaruan: status siap menunggu tombol Pasang sekarang, tanpa hitung mundur', () => {
  assert.doesNotMatch(src, /Memasang dalam/);
  assert.doesNotMatch(src, /\b(countdown|countdownTotal|waiting)\b/);
  assert.match(src, /Pemasangan hanya dimulai setelah kamu menekan Pasang sekarang\./);
  assert.match(src, /button\('Pasang sekarang'/);
});
