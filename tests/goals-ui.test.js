'use strict';
/* Integrasi UI Goals: sidebar, rute, halaman, tema, responsif, dan regresi Journaling. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const index = read('index.html');
const page = read('renderer/pages/goals.js');
const jurnal = read('renderer/pages/jurnal.js');
const css = read('renderer/theme.css');
const core = read('renderer/core.js');
const settings = read('renderer/pages/pengaturan.js');

test('menu Goals berada tepat di atas Journaling dengan ikon target yang konsisten', () => {
  const nav = index.slice(index.indexOf('<nav class="nav"'), index.indexOf('</nav>'));
  const order = [...nav.matchAll(/data-page="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(order, ['beranda', 'tugas', 'kalender', 'analitik', 'riwayat', 'laporan', 'goals', 'jurnal', 'pengaturan', 'library']);
  const block = nav.slice(nav.indexOf('data-page="goals"'), nav.indexOf('data-page="jurnal"'));
  assert.match(block, /<span>Goals<\/span>/);
  assert.match(block, /<svg[^>]*width="18" height="18"[^>]*stroke-width="1\.8"/);
  assert.match(block, /<circle cx="12" cy="12" r="8\.5"\/><circle cx="12" cy="12" r="5"\/>/);
  assert.match(block, /type="button"/);
});

test('halaman dan skrip Goals terdaftar dalam urutan yang benar', () => {
  assert.ok(index.indexOf('id="page-goals"') > index.indexOf('id="page-laporan"'));
  assert.ok(index.indexOf('id="page-goals"') < index.indexOf('id="page-jurnal"'));
  const sg = index.indexOf('<script src="shared/goals.js">');
  assert.ok(sg > index.indexOf('<script src="shared/store.js">') && sg < index.indexOf('<script src="renderer/core.js">'));
  const pg = index.indexOf('<script src="renderer/pages/goals.js">');
  assert.ok(pg > index.indexOf('<script src="renderer/ui.js">') && pg < index.indexOf('<script src="renderer/boot.js">'));
  assert.match(page, /JF\.pages\.register\(\{\s*id: 'goals',\s*title: 'Goals'/);
});

test('rute detail memakai #goals?id= dan dapat dibuka ulang setelah refresh', () => {
  assert.match(page, /#goals\?id=' \+ encodeURIComponent/);
  assert.match(page, /function goalIdFromHash/);
  assert.match(page, /decodeURIComponent/);
  assert.match(page, /Goal tidak ditemukan/);
  assert.match(read('renderer/boot.js'), /\.split\('\?'\)\[0\]/);
});

test('halaman memakai lapisan data bersama dan app.save, tanpa penyimpanan terpisah', () => {
  assert.doesNotMatch(page, /localStorage|indexedDB|fetch\(|XMLHttpRequest/);
  assert.match(page, /app\.save\(\)/);
  ['createGoal', 'updateGoal', 'completeGoal', 'reopenGoal', 'archiveGoal', 'restoreGoal', 'addMilestone', 'updateMilestone',
    'completeMilestone', 'reopenMilestone', 'moveMilestone', 'removeMilestone', 'linkTask', 'unlinkTask', 'progress', 'overview'].forEach((fn) => {
    assert.ok(page.includes('G().' + fn + '('), fn);
  });
  // Task completion reuses the existing task functions.
  assert.match(page, /app\.completeTask\(t\.id\)/);
  assert.match(page, /app\.reopenTask\(t\.id\)/);
  assert.doesNotMatch(page, /store\.addTask|JF\.store\.completeTask/);
});

test('aksi destruktif memakai konfirmasi dan tombol ikon punya nama aksesibel', () => {
  ['Arsipkan goal ini?', 'Hapus milestone?', 'Tandai goal selesai?'].forEach((t) => assert.ok(page.includes(t), t));
  assert.match(page, /'aria-label': label/);
  assert.match(page, /role: 'progressbar'/);
  assert.match(page, /aria-valuenow/);
  assert.match(page, /role: 'alert'/);
  assert.match(page, /aria-invalid/);
  assert.match(page, /role: 'tab'/);
});

test('status dilokalkan dan metode progres dijelaskan', () => {
  const goals = require('../shared/goals.js');
  assert.deepStrictEqual(goals.STATUSES, ['not_started', 'in_progress', 'on_hold', 'completed']);
  assert.deepStrictEqual(Object.values(goals.STATUS_LABEL), ['Belum dimulai', 'Berjalan', 'Ditunda', 'Selesai']);
  assert.match(page, /Progres = milestone selesai ÷ semua milestone/);
  assert.match(page, /Progres = tugas terkait yang selesai/);
  assert.match(page, /Progres = nilai saat ini ÷ nilai target, maksimal 100%/);
  assert.match(page, /ditandai selesai secara manual/);
});

test('gaya Goals memakai token tema, tanpa gradient, dan responsif', () => {
  const gl = css.slice(css.indexOf('/* Goals */'));
  assert.ok(gl.length > 1000);
  ['.gl-metrics', '.gl-grid', '.gl-card', '.gl-bar', '.gl-detail', '.gl-ms.next', '.gl-err', '.gl-pick'].forEach((r) => assert.ok(gl.includes(r), r));
  assert.doesNotMatch(gl, /gradient/);
  assert.doesNotMatch(gl, /#[0-9a-fA-F]{3,8}\b/, 'warna harus lewat token agar mode gelap konsisten');
  assert.match(gl, /@media \(max-width: 1100px\)[\s\S]*?\.gl-detail \{ grid-template-columns: 1fr; \}/);
  assert.match(gl, /@media \(max-width: 880px\)[\s\S]*?\.gl-metrics \{ grid-template-columns: repeat\(2/);
  assert.match(gl, /@media \(max-width: 560px\)[\s\S]*?\.gl-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(gl, /prefers-reduced-motion/);
  assert.match(gl, /:root\[data-theme="dark"\] \.gl-form input\[type="date"\]/);
});

test('data goals dinormalisasi saat memuat dan memulihkan, serta tampil di Pengaturan', () => {
  assert.strictEqual((core.match(/JF\.goals\.normalize\(state\)/g) || []).length, 2);
  assert.match(read('shared/store.js'), /goals: \[\]/);
  assert.match(settings, /JF\.goals\.list\(s\)\.length/);
  assert.match(settings, /sm\.goals/);
});

test('Journaling: tautan goal opsional tanpa merusak editor dan autosave', () => {
  assert.match(jurnal, /Terkait goal \(opsional\)/);
  assert.match(jurnal, /JF\.journal\.setGoalLink\(app\.rawState\(\)/);
  assert.match(jurnal, /saver\.flush\(\)\.then/);
  assert.match(jurnal, /tidak mengubah progres goal/);
  assert.match(jurnal, /label\.jr-goal-label', \{ for: 'jr-goal' \}/);
  assert.doesNotMatch(jurnal, /localStorage/);
  assert.match(css, /\.jr-goal-link/);
});
