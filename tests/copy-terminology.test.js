'use strict';
/* Regresi copy: istilah "resmi" diganti dengan status yang jelas, tanpa
   mengubah klasifikasi sesi maupun perhitungan total fokus. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const store = require('../shared/store.js');
const sessions = require('../shared/sessions.js');

const root = path.join(__dirname, '..');
const files = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(e.name)) files.push(p);
  });
})(path.join(root, 'renderer'));
files.push(path.join(root, 'index.html'));

test('tidak ada istilah "resmi" yang tersisa di UI', () => {
  files.forEach((f) => {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /\bresmi\b/i, path.relative(root, f));
  });
});

test('riwayat membedakan sesi yang masuk total dari yang tidak', () => {
  const src = fs.readFileSync(path.join(root, 'renderer', 'pages', 'riwayat.js'), 'utf8');
  assert.match(src, /total fokus/);
  assert.match(src, /'Terhitung'/);
  assert.match(src, /'Tidak terhitung'/);
  assert.match(src, /sesi tercatat/);
});

test('klasifikasi sesi selesai vs terputus tidak berubah', () => {
  const s = store.createState();
  const t = store.addTask(s, { title: 'Uji klasifikasi', targetDate: '2026-10-25', durationSec: 600 }, 1000);
  const done = sessions.createSession(s, { taskId: t.id, taskName: t.title, plannedSec: 600 }, 2000);
  sessions.completeSession(s, done, 602000);
  const cut = sessions.createSession(s, { taskId: null, taskName: 'Terputus', plannedSec: 600 }, 700000);
  sessions.stopSession(s, cut, 900000);

  assert.equal(done.state, 'completed');
  assert.equal(done.contributesToOfficial, true);
  assert.equal(cut.state, 'interrupted');
  assert.equal(cut.contributesToOfficial, false);
  assert.equal(sessions.officialSeconds(s.sessions), 600, 'hanya sesi selesai yang masuk total');
});
