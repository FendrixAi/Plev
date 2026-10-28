'use strict';
/* Regresi sidebar: aturan responsif tidak boleh menimpa lebar sidebar atau
   menyembunyikan satu-satunya tombol buka/tutup. Target klik >= 32px. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'theme.css'), 'utf8');

test('media query sempit tidak menimpa lebar sidebar', () => {
  const media = css.slice(css.indexOf('@media (max-width: 880px)'), css.indexOf('@media (max-width: 640px)'));
  assert.ok(media.length > 0);
  assert.doesNotMatch(media, /\.sidebar\s*\{\s*width:/, 'lebar sidebar tidak boleh dipaksa di media query');
  assert.doesNotMatch(media, /#navToggle\s*\{[^}]*display:\s*none/, 'tombol sidebar tidak boleh disembunyikan');
});

test('tombol sidebar tetap terlihat dan berukuran 32px', () => {
  assert.doesNotMatch(css, /#navToggle\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.brand \.ic \{[^}]*width:\s*32px;[^}]*height:\s*32px;/);
  assert.match(css, /\.app\.collapsed #navToggle \{ display: grid;/);
});

test('sidebar terlipat memusatkan tombol tunggal di brand (bukan kolom)', () => {
  assert.doesNotMatch(css, /\.app\.collapsed \.sidebar \.brand \{[^}]*flex-direction:\s*column/);
  assert.match(css, /\.app\.collapsed \.sidebar \.brand \{[^}]*justify-content:\s*center/);
});

test('lebar minimum sidebar cukup untuk brand 34px + tombol 32px', () => {
  const m = css.match(/--sb-min:\s*(\d+)px/);
  assert.ok(m, 'token --sb-min harus ada');
  assert.ok(Number(m[1]) >= 88, 'lebar minimum minimal 88px agar kontrol tidak bertumpuk');
});
