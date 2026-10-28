'use strict';
/* Regresi: semua token warna yang dipakai halaman kalender harus terdefinisi
   di theme.css (legenda sebelumnya memakai --accent/--ok yang tidak ada). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const kalender = fs.readFileSync(path.join(root, 'renderer', 'pages', 'kalender.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'renderer', 'theme.css'), 'utf8');

test('legenda kalender memakai token yang terdefinisi', () => {
  assert.doesNotMatch(kalender, /var\(--accent\)|var\(--ok\)/);
  const used = [...kalender.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
  const unique = [...new Set(used)];
  assert.ok(unique.length > 0);
  unique.forEach((t) => assert.match(css, new RegExp(t.replace(/-/g, '\\-') + '\\s*:'), 'token tidak terdefinisi: ' + t));
});

test('warna legenda target/selesai kontras di kedua tema', () => {
  assert.match(kalender, /var\(--coral\)/);
  assert.match(kalender, /var\(--mint\)/);
  const dark = css.slice(css.indexOf(':root[data-theme="dark"] {'));
  assert.match(dark, /--coral:/);
  assert.match(dark, /--mint:/);
});
