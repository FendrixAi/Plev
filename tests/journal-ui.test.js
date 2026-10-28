'use strict';
/* Regresi integrasi UI Journaling: sidebar, rute tanggal, editor, kalender. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const index = read('index.html');
const boot = read('renderer/boot.js');
const page = read('renderer/pages/jurnal.js');
const kalender = read('renderer/pages/kalender.js');
const css = read('renderer/theme.css');
const core = read('renderer/core.js');
const storeSrc = read('shared/store.js');
const settings = read('renderer/pages/pengaturan.js');

test('menu Journaling berada tepat di atas Pengaturan dengan ikon yang konsisten', () => {
  const journalAt = index.indexOf('data-page="jurnal"');
  const settingsAt = index.indexOf('data-page="pengaturan"');
  assert.ok(journalAt > 0, 'menu jurnal harus ada');
  assert.ok(journalAt < settingsAt, 'menu jurnal harus sebelum pengaturan');
  assert.ok(index.indexOf('data-page="laporan"') < journalAt, 'menu jurnal harus setelah laporan');
  const block = index.slice(journalAt, settingsAt);
  assert.match(block, /<span>Journaling<\/span>/);
  assert.match(block, /<svg[^>]*width="18" height="18"[^>]*stroke-width="1\.8"/);
  assert.match(block, /<rect x="4\.5" y="3\.5" width="15" height="17" rx="2\.5"\/>/);
});

test('halaman, skrip, dan rute hash tanggal terpasang', () => {
  assert.ok(index.indexOf('id="page-jurnal"') > index.indexOf('id="page-laporan"'));
  assert.ok(index.indexOf('id="page-jurnal"') < index.indexOf('id="page-pengaturan"'));
  assert.match(index, /<script src="shared\/journal\.js"><\/script>/);
  assert.match(index, /<script src="renderer\/pages\/jurnal\.js"><\/script>/);
  assert.match(boot, /\.split\('\?'\)\[0\]/);
  assert.match(page, /id:\s*'jurnal'/);
  assert.match(page, /title:\s*'Journaling'/);
  assert.match(page, /dayFromHash/);
  assert.match(page, /#jurnal\?date=/);
});

test('editor punya empat bagian, label aksesibel, dan status simpan', () => {
  ['wins', 'challenges', 'learned', 'priorities'].forEach((key) => {
    assert.match(page, new RegExp("key: '" + key + "'"));
  });
  assert.match(page, /label\.jr-label', \{ for: 'jr-' \+ f\.key \}/);
  assert.match(page, /textarea\.jr-textarea/);
  assert.match(page, /aria-describedby/);
  assert.match(page, /role: 'status', 'aria-live': 'polite'/);
  assert.match(page, /Menyimpan\.\.\./);
  assert.match(page, /Tersimpan/);
  assert.match(page, /Gagal menyimpan/);
  ['Hari sebelumnya', 'Hari berikutnya'].forEach((label) => assert.ok(page.includes(label), label));
  assert.match(page, /'Hari ini'/);
});

test('autosave memakai antrean tersimpan dan menulis lewat app.save', () => {
  assert.match(page, /JF\.journal\.createAutosave/);
  assert.match(page, /JF\.journal\.save\(app\.rawState\(\)/);
  assert.match(page, /app\.save\(\)/);
  assert.doesNotMatch(page, /localStorage/);
  assert.match(page, /saver\.flush\(\)/);
  assert.match(page, /beforeunload/);
  assert.match(page, /hashchange/);
});

test('layout Journaling memakai token desain dan responsif', () => {
  ['.jr-head', '.jr-stats', '.jr-grid', '.jr-block:focus-within', '.jr-save.error', '.jr-textarea'].forEach((rule) => {
    assert.ok(css.includes(rule), rule);
  });
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.jr-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.jr-stats \{ grid-template-columns: 1fr; \}/);
  assert.doesNotMatch(css, /\.jr-[^{]+\{[^}]*gradient/);
});

test('kalender menambahkan tautan See journaling setelah bagian selesai', () => {
  const doneAt = kalender.indexOf("ui.el('h3', 'Selesai tanggal ini (");
  const linkAt = kalender.indexOf("'See journaling'");
  assert.ok(doneAt > 0 && linkAt > doneAt, 'tautan harus setelah bagian selesai');
  const between = kalender.slice(doneAt, linkAt);
  assert.match(between, /p\.appendChild\(sec3\);/);
  assert.match(kalender, /#jurnal\?date=' \+ selectedDay/);
  assert.match(css, /\.cal-journal-link/);
  assert.match(css, /\.dp-journal-link-wrap/);
});

test('penyimpanan jurnal terpisah dari tugas dan tetap kompatibel', () => {
  assert.match(storeSrc, /journals: \{\}/);
  assert.match(core, /state\.journals = \{\}/);
  assert.match(settings, /JF\.journal\.count\(s\)/);
  assert.match(settings, /catatan jurnal/);
});
