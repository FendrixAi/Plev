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

test('istilah "resmi" tidak dipakai di teks aplikasi', () => {
  ['renderer/core.js', 'renderer/pages/beranda.js', 'renderer/pages/analitik.js', 'renderer/pages/riwayat.js',
   'renderer/pages/laporan.js', 'renderer/pages/kalender.js', 'renderer/pages/pengaturan.js'].forEach((f) => {
    const src = read(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.ok(!/['"`][^'"`\n]*\b[Rr]esmi\b[^'"`\n]*['"`]/.test(src), 'kata "resmi" masih ada di ' + f);
  });
});

test('logo jam sidebar dihapus dan teks kredit benar', () => {
  assert.ok(!/class="mark"/.test(read('index.html')));
  assert.ok(!/\.brand \.mark/.test(read('renderer/theme.css')));
  assert.match(read('index.html'), /MM<\/span> - <span class="author">Built by Iqbal Rafi/);
});

test('sidebar otomatis terlipat di jendela sempit lewat JS, bukan menyembunyikan tombol', () => {
  const boot = read('renderer/boot.js');
  assert.match(boot, /matchMedia\('\(max-width: 900px\)'\)/);
  assert.match(boot, /if \(!narrow\.matches\)/);
});

test('IPC dibatasi ke jendela aplikasi dan navigasi dikunci', () => {
  const m = read('main.js');
  assert.ok(!/ipcMain\.(on|handle)\(/.test(m.replace(/const onTrusted[^\n]*\n/, '').replace(/const handleTrusted[^\n]*\n/, '')), 'semua IPC harus lewat onTrusted/handleTrusted');
  assert.match(m, /setWindowOpenHandler/);
  assert.match(m, /sandbox: true/);
});

test('nama berkas installer dan portable berbeda', () => {
  const j = JSON.parse(read('package.json'));
  assert.notStrictEqual(j.build.nsis.artifactName, j.build.portable.artifactName);
});

test('berkas lama yang menyesatkan tidak ada lagi', () => {
  const fs2 = require('fs');
  ['cek.bat', 'REDESIGN_SUMMARY.md', 'TIMER_FIX_SUMMARY.md'].forEach((f) => assert.ok(!fs2.existsSync(path.join(root, f)), f));
});
