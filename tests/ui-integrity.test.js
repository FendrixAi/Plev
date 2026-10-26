'use strict';
/* Menjaga hal-hal yang pernah rusak: font lokal, CSP, sisa kode diagnosa, tema. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('theme.css tidak memuat sumber dari internet dan font lokal tersedia', () => {
  const css = read('renderer/theme.css');
  assert.ok(!/@import|https?:\/\//.test(css), 'tidak boleh ada @import / URL http');
  const files = [...css.matchAll(/url\("fonts\/([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(files.length >= 7);
  files.forEach((f) => assert.ok(fs.existsSync(path.join(root, 'renderer/fonts', f)), 'font hilang: ' + f));
});

test('CSP mengizinkan font lokal dan melarang koneksi', () => {
  const html = read('index.html');
  assert.match(html, /font-src 'self' file:/);
  assert.match(html, /connect-src 'none'/);
});

test('mode gelap mendefinisikan token yang sama dengan mode terang', () => {
  const css = read('renderer/theme.css');
  const marker = '\n:root[data-theme="dark"] {';
  assert.ok(css.includes(marker), 'blok mode gelap tidak ditemukan');
  const light = css.split(marker)[0];
  const dark = css.split(marker)[1].split('\n}')[0];
  const need = ['--cream', '--surface', '--ink', '--muted', '--line', '--coral', '--on-coral', '--mint', '--red', '--chart-ok', '--chart-bar'];
  need.forEach((t) => { assert.ok(light.includes(t + ':'), 'terang: ' + t); assert.ok(dark.includes(t + ':'), 'gelap: ' + t); });
});

test('tidak ada sisa kode diagnosa maupun tulisan tidak profesional', () => {
  ['renderer/pages/tugas.js', 'index.html'].forEach((f) => assert.ok(!/Diagnosa|ta-debug|Yahh/.test(read(f)), f));
  assert.match(read('index.html'), /MM<\/span> - <span class="author">Built by Iqbal Rafi/);
});

test('tombol Tambah adalah tombol submit', () => {
  assert.match(read('renderer/pages/tugas.js'), /addBtn\.type = 'submit'/);
});

test('tombol buka sidebar tidak disembunyikan saat sidebar terlipat', () => {
  const css = read('renderer/theme.css');
  assert.ok(!/\.app\.collapsed #navToggle \{ display: none; \}/.test(css), 'toggle tidak boleh hilang saat terlipat');
  assert.match(css, /\.app\.collapsed #navToggle \{ display: grid/);
  assert.match(read('renderer/boot.js'), /Ctrl\+B/);
});
