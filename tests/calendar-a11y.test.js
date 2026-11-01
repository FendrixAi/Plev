'use strict';
/* Regresi aksesibilitas: tombol panah kalender harus punya nama aksesibel. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'renderer', 'ui.js'), 'utf8');
const kal = fs.readFileSync(path.join(root, 'renderer', 'pages', 'kalender.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'renderer', 'theme.css'), 'utf8');

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

test('grid dan chip kalender dapat menyusut tanpa mendorong konten keluar sel', () => {
  assert.match(css, /\.cal-grid\.week,\s*\.cal-grid\.month\s*\{\s*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.cal-cell\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.cal-chip\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.cal-chip \.cn\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s);
  assert.match(css, /\.cal-more\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s);
});

test('calendar detail panel and narrow grid remain within available width', () => {
  assert.match(css, /\.cal-layout\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.cal-layout\.with-panel\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*340px\)/s);
  assert.doesNotMatch(css, /#page-kalender \.cal-grid\.(?:week|month)\s*\{\s*min-width:\s*600px/);
});
