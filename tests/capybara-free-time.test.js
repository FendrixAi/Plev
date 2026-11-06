'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const cr = require('../renderer/experiences/capybara-world/capyrafi.js');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const CW = ['renderer', 'experiences', 'capybara-world'];

test('teman fokus: tahap naik sesuai lama fokus', () => {
  assert.strictEqual(cr.companion(0).label, 'Pemanasan');
  assert.strictEqual(cr.companion(599).tier, 0);
  assert.strictEqual(cr.companion(600).label, 'Mulai mengalir');
  assert.strictEqual(cr.companion(1800).label, 'Dalam flow');
  assert.strictEqual(cr.companion(3600).label, 'Fokus dalam');
  assert.strictEqual(cr.companion(5400).label, 'Maraton');
  assert.strictEqual(cr.companion(99999).tier, 4);
  assert.ok(cr.companion(5400).line.length > 10);
});

test('teman fokus: satu jejak kaki per 15 menit, maksimal 8', () => {
  assert.strictEqual(cr.companion(0).paws, 0);
  assert.strictEqual(cr.companion(899).paws, 0);
  assert.strictEqual(cr.companion(900).paws, 1);
  assert.strictEqual(cr.companion(2700).paws, 3);
  assert.strictEqual(cr.companion(7200).paws, 8);
  assert.strictEqual(cr.companion(60 * 60 * 10).paws, 8);
  assert.strictEqual(cr.companion(1).maxPaws, 8);
});

test('teman fokus: input aneh tidak merusak', () => {
  assert.strictEqual(cr.companion(-50).paws, 0);
  assert.strictEqual(cr.companion(undefined).tier, 0);
  assert.strictEqual(cr.companion('abc').paws, 0);
});

test('core: Lanjut fokus = waktu bebas di semua tampilan (tanpa pengaman per mode)', () => {
  const core = read('renderer', 'core.js');
  assert.doesNotMatch(core, /freeTimeAvailable/);
  assert.match(core, /open: true/);
  assert.doesNotMatch(core, /Capybara World belum punya/);
});

test('Capybara Beranda: kartu fokus waktu bebas (hitung maju, Selesai sesi, teman fokus)', () => {
  const home = read(...CW, 'beranda.js');
  assert.match(home, /JF\.sessions\.isOpen\(session\)/);
  assert.match(home, /'Waktu bebas'/);
  assert.match(home, /'Waktu bebas dijeda'/);
  assert.match(home, /'\+' \+ ui\.fmt\.mmss\(JF\.sessions\.activeSeconds\(session, Date\.now\(\)\)\)/);
  assert.strictEqual((home.match(/'Selesai sesi'/g) || []).length, 1);
  assert.match(home, /app\.finishOpen\(\)/);
  assert.match(home, /tanpa batas waktu/);
  assert.match(home, /cr\.companion\(/);
  // jam dan teman fokus ikut di-update tiap frame tanpa render ulang kartu
  assert.match(home, /paintCompanion\(box, JF\.capyrafi\.companion\(/);
  // konfirmasi Hentikan mengingatkan soal Selesai sesi, sama seperti Original
  assert.match(home, /pilih "Selesai sesi" saja/);
});

test('Capybara HUD: pil timer menghitung maju untuk waktu bebas', () => {
  const exp = read(...CW, 'experience.js');
  assert.match(exp, /JF\.sessions\.isOpen\(s\)/);
  assert.match(exp, /'\+' \+ JF\.ui\.fmt\.mmss\(JF\.sessions\.activeSeconds\(s, Date\.now\(\)\)\)/);
});

test('Capybara Riwayat: sesi waktu bebas ditandai', () => {
  assert.match(read(...CW, 'pages.js'), /session\.openEnded \? ' · waktu bebas'/);
});

test('CSS teman fokus ada dan hormati reduced-motion', () => {
  const css = read(...CW, 'beranda.css');
  assert.match(css, /\.capy-home \.cw-companion\s*\{/);
  assert.match(css, /\.capy-home \.cw-paw\.is-on\s*\{/);
  assert.match(css, /prefers-reduced-motion/);
});
