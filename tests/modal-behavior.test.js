'use strict';
/* Regresi dialog: Escape/backdrop harus menghormati dismiss:false, fokus
   terkurung di dalam dialog, dan fokus kembali ke pemicu setelah ditutup. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ui = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'ui.js'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'core.js'), 'utf8');

test('Escape dan backdrop hanya menutup dialog yang boleh ditutup', () => {
  assert.match(ui, /var dismissible = opts\.dismiss !== false/);
  assert.match(ui, /var backdropDismiss = dismissible && opts\.backdropDismiss !== false/);
  assert.match(ui, /if \(e\.key === 'Escape'\) \{\s*if \(dismissible\)/);
  assert.match(ui, /e\.target === veil && backdropDismiss/);
});

test('dialog pilihan setelah timer tidak tertutup oleh klik latar', () => {
  const start = core.indexOf('function showCompletionChoices');
  assert.ok(start >= 0);
  const dialog = core.slice(start, core.indexOf('pushState();', start));
  assert.match(dialog, /title: 'Sesi fokus selesai'/);
  assert.match(dialog, /backdropDismiss: false/);
  assert.doesNotMatch(dialog, /dismiss: false/, 'tombol X harus tetap tersedia');
});

test('dialog non-dismissible tidak menyediakan tombol tutup destruktif', () => {
  assert.match(ui, /if \(dismissible\) \{\s*var closeBtn/);
});

test('hanya dialog teratas yang merespons keyboard (dialog bersarang aman)', () => {
  assert.match(ui, /modalStack\[modalStack\.length - 1\] !== api/);
});

test('fokus terkurung saat Tab dan dikembalikan ke pemicu', () => {
  assert.match(ui, /e\.key === 'Tab'/);
  assert.match(ui, /box\.contains\(active\)/);
  assert.match(ui, /document\.contains\(trigger\)/);
  assert.match(ui, /trigger\.focus\(\)/);
});

test('dialog pemulihan tetap non-dismissible', () => {
  assert.match(core, /title: 'Sesi fokus terputus',\s*dismiss: false/);
});
