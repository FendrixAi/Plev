'use strict';
/* Regresi aksesibilitas: tombol panah kalender harus punya nama aksesibel. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'renderer', 'ui.js'), 'utf8');
const kal = fs.readFileSync(path.join(root, 'renderer', 'pages', 'kalender.js'), 'utf8');

test('ui.btn meneruskan aria-label', () => {
  assert.match(ui, /'aria-label': opts\.ariaLabel \|\| null/);
});

test('panah hari dan periode punya nama aksesibel', () => {
  ['Hari sebelumnya', 'Hari berikutnya', 'Periode sebelumnya', 'Periode berikutnya'].forEach((label) => {
    assert.match(kal, new RegExp("ariaLabel: '" + label + "'"), label);
  });
  assert.match(kal, /ui\.btn\('‹'/);
  assert.match(kal, /ui\.btn\('›'/);
});

test('aksi navigasi tidak berubah', () => {
  assert.match(kal, /selected = JF\.dates\.addDays\(selectedDay, -1\)/);
  assert.match(kal, /selected = JF\.dates\.addDays\(selectedDay, 1\)/);
  assert.match(kal, /anchor = JF\.dates\.addDays\(anchor, -7\)/);
  assert.match(kal, /anchor = JF\.dates\.addDays\(anchor, 7\)/);
});
