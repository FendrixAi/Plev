'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('F-09: README documents current versions, commands, and release signing', () => {
  assert.match(readme, new RegExp('Electron\\s+' + escape(pkg.devDependencies.electron)));
  assert.match(readme, new RegExp('electron-builder\\s+' + escape(pkg.devDependencies['electron-builder'])));
  assert.match(readme, new RegExp('electron-updater\\s+' + escape(pkg.dependencies['electron-updater'].replace(/^\^/, ''))));

  assert.match(readme, /npm start/);
  assert.match(readme, /npm test/);
  assert.match(readme, /npm run build/);
  assert.match(readme, /npm run build:installer/);
  assert.match(readme, /npm run release/);
  assert.match(readme, /npm run release:test/);
  assert.match(readme, /JF_ALLOW_UNSIGNED_RELEASE/);
  assert.match(readme, /WIN_CSC_LINK/);
  assert.match(readme, /GH_TOKEN/);

  assert.doesNotMatch(readme, /Electron 45\.3\.0/);
  assert.doesNotMatch(readme, /electron-builder 25\.1\.8/);
});

test('F-09: panduan singkat memakai alur update manual dan signing', () => {
  const guide = fs.readFileSync(path.join(root, 'BACA-DULU.txt'), 'utf8');
  assert.match(guide, /WIN_CSC_LINK/);
  assert.match(guide, /release:test/);
  assert.match(guide, /Pasang sekarang/);
  assert.doesNotMatch(guide, /hitung mundur 10 detik/i);
  assert.doesNotMatch(guide, /membuka ulang otomatis/i);
});
