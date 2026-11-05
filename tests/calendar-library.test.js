'use strict';
/* Panel tanggal Kalender: kotak berwarna "See journaling" dan "See library",
   filter tanggal di Library, dan ikon input tanggal yang mengikuti warna teks. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const L = require('../shared/library.js');

test('query Library menyaring dokumen berdasarkan hari ditambahkan', () => {
  const day = (y, m, d, h) => new Date(y, m - 1, d, h || 12).getTime();
  const state = { tasks: [], goals: [], library: [
    L.createItem({ type: 'note', title: 'a', noteText: 'x' }, day(2026, 11, 3, 0)),
    L.createItem({ type: 'link', title: 'b', url: 'https://b.id' }, day(2026, 11, 3, 23)),
    L.createItem({ type: 'note', title: 'c', noteText: 'y' }, day(2026, 11, 4, 8))
  ] };
  assert.strictEqual(L.query(state, { date: '2026-11-03' }, null).length, 2);
  assert.strictEqual(L.query(state, { date: '2026-11-04' }, null).length, 1);
  assert.strictEqual(L.query(state, { date: '2026-11-05' }, null).length, 0);
  assert.strictEqual(L.query(state, {}, null).length, 3);
  assert.strictEqual(L.query(state, { date: '2026-11-03', type: 'link' }, null).length, 1);
  assert.strictEqual(L.addedDay(day(2026, 1, 9)), '2026-01-09');
});

test('Kalender: See journaling dan See library tampil sebagai kotak berwarna', () => {
  const js = read('renderer', 'pages', 'kalender.js');
  assert.match(js, /cal-journal-link\.cal-link-box\.journal/);
  assert.match(js, /cal-library-link\.cal-link-box\.library/);
  assert.match(js, /'See journaling'/);
  assert.match(js, /'See library'/);
  assert.match(js, /#library\?date=' \+ selectedDay/);
  assert.match(js, /#jurnal\?date=' \+ selectedDay/);
  const css = read('renderer', 'theme.css');
  assert.match(css, /\.cal-link-box\.journal\s*\{[^}]*var\(--yellow\)/);
  assert.match(css, /\.cal-link-box\.library\s*\{[^}]*var\(--mint\)/);
  assert.match(css, /\.cal-journal-link/);
  assert.match(css, /\.dp-journal-link-wrap/);
});

test('Library membaca #library?date= dan punya filter tanggal yang bisa dihapus', () => {
  const js = read('renderer', 'pages', 'library.js');
  assert.match(js, /function hashDate\(\)/);
  assert.match(js, /\[\?&\]date=/);
  assert.match(js, /type: 'date', 'aria-label': 'Tanggal ditambahkan'/);
  assert.match(js, /'Semua tanggal'/);
  assert.match(js, /syncDateFromHash\(\);/);
  assert.match(js, /Tidak ada dokumen pada tanggal ini/);
});

test('ikon kalender input tanggal memakai warna teks (currentColor) di Original dan Capybara', () => {
  ['theme.css', path.join('experiences', 'capybara-world', 'experience.css')].forEach((f) => {
    const css = read('renderer', f);
    const m = css.match(/input\[type="date"\]::-webkit-calendar-picker-indicator[\s\S]*?\{([^}]*)\}/);
    assert.ok(m, f + ' harus menata ikon tanggal');
    assert.match(m[1], /background-color:\s*currentColor/);
    assert.match(m[1], /mask:/);
    assert.match(m[1], /background-image:\s*none/);
  });
  assert.match(read('renderer', 'theme.css'), /:root\[data-theme="dark"\] input\[type="date"\] \{ color-scheme: dark; \}/);
  // CSP harus mengizinkan gambar data: untuk mask ikon
  assert.match(read('index.html'), /img-src data:/);
});
