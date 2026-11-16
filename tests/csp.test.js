'use strict';
/* F-05: halaman tidak boleh bergantung pada script/style inline atau skema file:
   untuk mengeksekusi kode dari lokasi sembarang. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('F-05: CSP production tidak memakai unsafe-inline, unsafe-eval, atau file:', () => {
  ['index.html', 'mini.html'].forEach((file) => {
    const html = read(file);
    assert.match(html, /script-src 'self'/, file + ': script-src harus self');
    assert.match(html, /style-src 'self'/, file + ': style-src harus self');
    assert.doesNotMatch(html, /'unsafe-inline'/, file + ': unsafe-inline masih ada');
    assert.doesNotMatch(html, /'unsafe-eval'/, file + ': unsafe-eval masih ada');
    assert.doesNotMatch(html, /\bfile:/, file + ': skema file: masih diizinkan');
  });
});

test('F-05: tidak ada script atau style inline di halaman', () => {
  ['index.html', 'mini.html'].forEach((file) => {
    const html = read(file);
    assert.doesNotMatch(html, /<style\b/i, file + ': masih ada <style> inline');
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, file + ': masih ada <script> inline');
  });
});

test('F-05: bootstrap tema dan mini dieksternalkan serta ikut dipaketkan', () => {
  const index = read('index.html');
  const mini = read('mini.html');
  assert.match(index, /<script src="renderer\/initial-theme\.js"><\/script>/);
  assert.match(index, /<script src="renderer\/initial-experience\.js"><\/script>/);
  assert.match(mini, /<link rel="stylesheet" href="mini.css">/);
  assert.match(mini, /<script src="mini.js"><\/script>/);

  ['mini.css', 'mini.js', 'renderer/initial-theme.js', 'renderer/initial-experience.js']
    .forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), 'aset hilang: ' + file));

  const pkg = JSON.parse(read('package.json'));
  ['mini.css', 'mini.js'].forEach((file) => {
    assert.ok(pkg.build.files.includes(file), file + ' tidak masuk build.files');
  });
});

test('F-05: tooltip grafik tidak membuat atribut style inline', () => {
  const charts = read('renderer/charts.js');
  assert.doesNotMatch(charts, /<[^>]+style=/);
  assert.match(charts, /sw\.style\.background = x2\.color/);
});
