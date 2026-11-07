'use strict';
/* Mola World memasang modul halaman Original di wadah kedua. Karena id halaman
   juga ada di salinan Original, render tidak boleh mencari elemen lewat id global:
   kalau tidak, Mola menggambar ke halaman Original yang sedang tersembunyi. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const PAGE_IDS = {
  'kalender.js': ['cal-head', 'cal-gridwrap', 'cal-panel', 'cal-layout'],
  'riwayat.js': ['rh-list', 'rh-sum', 'rh-more'],
  'laporan.js': ['lp-list', 'lp-more'],
  'tugas.js': ['ta-title', 'ta-date', 'ta-desc', 'ta-pri', 'ta-min', 'ta-list', 'ta-filter', 'ta-fdate', 'tab-aktif', 'tab-arsip']
};

test('halaman bersama mencari elemen di wadah render, bukan lewat id global', () => {
  Object.keys(PAGE_IDS).forEach((file) => {
    const src = read('renderer/pages/' + file);
    assert.match(src, /function byId\(id\)\s*\{/, file + ': helper byId hilang');
    assert.match(src, /function render\(container\)/, file + ': render harus menerima wadah aktif');
    PAGE_IDS[file].forEach((id) => {
      assert.ok(!src.includes("document.getElementById('" + id + "')"),
        file + ': id halaman ' + id + ' masih dicari secara global');
      assert.ok(!src.includes("ui.$('" + id + "')"),
        file + ': id halaman ' + id + ' masih dicari secara global');
    });
  });
});
