'use strict';
/* Tes paritas Original ↔ Capybara World. Sumber kebenaran: PARITY.md.
   Gagal bila ada fitur baru di Original yang belum dicatat, atau status di PARITY.md tidak jujur. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { scan } = require('./parity-scan.js');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'PARITY.md'), 'utf8');
const STATUSES = ['ported', 'pending', 'na'];

function cells(line) { return line.split('|').slice(1, -1).map((c) => c.trim()); }
const unq = (s) => s.replace(/^`|`$/g, '');

const byView = {};   // nama tampilan -> { symbolRows, featureRows }
let currentView = null;
md.split(/\r?\n/).forEach((line) => {
  const h = /^##\s+Tampilan:\s*(\S+)/.exec(line);
  if (h) { currentView = h[1]; byView[currentView] = { symbolRows: [], featureRows: [] }; return; }
  if (!currentView || !/^\|/.test(line) || /^\|\s*-/.test(line)) return;
  const c = cells(line);
  if (c.length === 3 && STATUSES.indexOf(c[1]) >= 0) byView[currentView].symbolRows.push({ symbol: unq(c[0]), status: c[1], note: c[2] });
  else if (c.length === 4 && STATUSES.indexOf(c[3]) >= 0) byView[currentView].featureRows.push({ name: c[0], orig: unq(c[1]), capy: unq(c[2]), status: c[3] });
});

function fnBody(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let j = src.indexOf('{', src.indexOf(')', i)), depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(j, k + 1);
  }
  return null;
}
function has(spec) {
  const m = /^([^#:]+?)(?:#([\w$]+))?:\s*(.+)$/.exec(spec);
  assert.ok(m, 'format spesifikasi salah: ' + spec);
  const file = path.join(root, 'renderer', m[1].trim());
  assert.ok(fs.existsSync(file), 'berkas tidak ada: ' + m[1]);
  let src = fs.readFileSync(file, 'utf8');
  if (m[2]) {
    src = fnBody(src, m[2]);
    assert.ok(src != null, 'fungsi tidak ditemukan: ' + m[1] + '#' + m[2]);
  }
  return src.indexOf(m[3]) >= 0;
}

const { viewNames } = require('./parity-scan.js');

test('setiap tampilan di renderer/experiences punya bagian di PARITY.md (dan sebaliknya)', () => {
  const names = viewNames();
  assert.ok(names.length > 0, 'tidak ada tampilan terdeteksi');
  names.forEach((n) => assert.ok(byView[n],
    'Tampilan baru "' + n + '" belum punya bagian di PARITY.md. Jalankan: node tests/parity-scan.js --init ' + n));
  Object.keys(byView).forEach((n) => assert.ok(names.indexOf(n) >= 0, 'PARITY.md menyebut tampilan "' + n + '" yang foldernya tidak ada'));
});

viewNames().forEach((view) => {
  const sec = byView[view] || { symbolRows: [], featureRows: [] };

  test('[' + view + '] PARITY.md punya tabel simbol (tabel fitur per halaman boleh menyusul)', () => {
    assert.ok(sec.symbolRows.length > 0, 'tabel simbol kosong');
  });

  test('[' + view + '] lapis A: semua fitur Original yang belum dipakai tampilan ini sudah dicatat', () => {
    const listed = new Set(sec.symbolRows.map((r) => r.symbol));
    const missing = scan().views[view].missing.filter((s) => !listed.has(s));
    assert.deepStrictEqual(missing, [],
      'Fitur Original belum dicatat untuk ' + view + ' di PARITY.md (pending atau na): ' + missing.join(', '));
  });

  test('[' + view + '] lapis A: status jujur terhadap kode', () => {
    const r = scan(), used = r.views[view].symbols;
    sec.symbolRows.forEach((row) => {
      if (row.status === 'ported') {
        assert.ok(r.original.has(row.symbol) && used.has(row.symbol), row.symbol + ' ditandai ported tapi tidak dipakai di kedua tampilan');
      } else if (row.status === 'pending') {
        assert.ok(r.original.has(row.symbol), row.symbol + ' pending tapi Original tidak memakainya lagi: hapus barisnya');
        assert.ok(!used.has(row.symbol), row.symbol + ' sudah dipakai ' + view + ': ubah status jadi ported');
      } else {
        assert.ok(row.note.length > 8, row.symbol + ' (na) wajib punya alasan');
        assert.ok(r.original.has(row.symbol) || used.has(row.symbol), row.symbol + ' (na) tidak ditemukan di kode: hapus barisnya');
      }
    });
  });

  test('[' + view + '] lapis B: penanda fitur per halaman sesuai statusnya', () => {
    sec.featureRows.forEach((row) => {
      assert.ok(has(row.orig), '[' + row.name + '] penanda Original tidak ditemukan: ' + row.orig);
      if (row.status === 'ported') assert.ok(has(row.capy), '[' + row.name + '] ditandai ported tapi penanda ' + view + ' tidak ada: ' + row.capy);
      if (row.status === 'pending') assert.ok(!has(row.capy), '[' + row.name + '] sudah ada di ' + view + ': ubah status jadi ported');
    });
  });

  test('[' + view + '] ringkasan: fitur yang masih pending', (t) => {
    const pend = sec.symbolRows.filter((r) => r.status === 'pending').map((r) => r.symbol)
      .concat(sec.featureRows.filter((r) => r.status === 'pending').map((r) => r.name));
    t.diagnostic('Belum diport ke ' + view + ' (' + pend.length + '): ' + pend.join('; '));
    assert.ok(true);
  });
});
