'use strict';
/* Wiring UI Manajemen Lamaran Kerja (Original): tab di Goals, tabel, formulir,
   detail, riwayat, tautan, dan pengingat. Pemeriksaan sumber seperti tes wiring lain. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('goals.js memasang tab Lamaran tanpa mengubah alur goal yang ada', () => {
  const goals = read('renderer', 'pages', 'goals.js');
  assert.ok(goals.includes('renderViewSwitch'));
  assert.ok(goals.includes('JF.lamaran.viewFromHash'));
  assert.ok(goals.includes('JF.lamaran.renderList'));
  assert.ok(goals.includes('JF.lamaran.renderDetail'));
  assert.ok(goals.includes('Tambah Lamaran'));
  // fungsi lama tetap ada
  ['goalIdFromHash', 'openGoalForm', 'renderOverview', 'renderDetail', 'milestonesCard'].forEach((f) => assert.ok(goals.includes('function ' + f), f));
});

test('lamaran.js: tabel dengan kolom wajib, pencarian, filter, sort, dan state kosong', () => {
  const lm = read('renderer', 'pages', 'lamaran.js');
  ['No.', 'Posisi', 'Nama Perusahaan', 'Status', 'Tanggal Melamar', 'Link/Gmail', 'Aksi'].forEach((h) => assert.ok(lm.includes("'" + h + "'"), h));
  assert.ok(lm.includes('JA().query'));
  assert.ok(lm.includes('Belum ada lamaran kerja'));
  assert.ok(lm.includes('Tidak ada lamaran yang cocok'));
  assert.ok(lm.includes('filters.search') && lm.includes('filters.status') && lm.includes('filters.sort'));
});

test('lamaran.js: aksi detail lengkap dan tautan eksternal lewat mekanisme aman', () => {
  const lm = read('renderer', 'pages', 'lamaran.js');
  ['openStatusForm', 'openLinkForm', 'doDelete', 'Riwayat status', 'ui.confirm'].forEach((s) => assert.ok(lm.includes(s), s));
  // hanya root.open (window.open) — main process mengarahkan ke shell.openExternal http/https
  assert.ok(lm.includes('root.open(url)'));
  assert.doesNotMatch(lm, /require\(['"]|nodeIntegration|innerHTML\s*=|shell\.openExternal\(/);
  // pengingat jujur: bukan notifikasi terjadwal
  assert.ok(lm.includes('bukan notifikasi terjadwal'));
  assert.doesNotMatch(lm, /Notification\(|new Notification/);
});

test('index.html memuat lamaran.js setelah goals.js; tema punya gaya .lm khusus Original', () => {
  const idx = read('index.html');
  assert.ok(idx.indexOf('renderer/pages/lamaran.js') > idx.indexOf('renderer/pages/goals.js'));
  assert.ok(idx.indexOf('renderer/pages/lamaran.js') < idx.indexOf('renderer/boot.js'));
  const css = read('renderer', 'theme.css');
  ['.lm-table', '.lm-toolbar', '.lm-history', '.lm-rem-row', '.lm-view-switch'].forEach((c) => assert.ok(css.includes(c), c));
  assert.doesNotMatch(css, /\.lm-[a-z-]*\s*\{[^}]*capybara/i);
});

test('Capybara World tidak tersentuh oleh fitur lamaran', () => {
  const dir = path.join(root, 'renderer', 'experiences', 'capybara-world');
  fs.readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.css')).forEach((f) => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /jobApps|lamaran/i, f);
  });
});

test('Analitik: bagian Lamaran Kerja memakai periode halaman dan metrik unik', () => {
  const an = read('renderer', 'pages', 'analitik.js');
  assert.ok(an.includes('function renderJobApps'));
  assert.ok(an.includes('JF.jobApps.summary(app.rawState(), { from: res.period.from, to: res.period.to })'));
  ['Applied → Interview', 'Interview → Offering', 'Offering → Diterima', 'Penerimaan keseluruhan', 'Lamaran per bulan', 'Status saat ini', 'Hasil lamaran'].forEach((s) => assert.ok(an.includes(s), s));
  assert.ok(an.includes('renderJobApps();'));
  // analitik produktivitas lama tidak diubah
  ['renderKpis', 'renderInsights', 'renderCharts', 'renderBreakdowns', 'renderDefinitions'].forEach((f) => assert.ok(an.includes('function ' + f), f));
  // penyebut nol bukan 0%
  assert.ok(an.includes("r.den > 0 ? r.num + ' dari ' + r.den + ' · ' + r.pct + '%' : '—'"));
});