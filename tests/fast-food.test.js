'use strict';
/* Fast Food: pagar pengaman. Gaya terkunci ke experience ini, aset tertanam (CSP hanya img-src data:), pendaftaran lengkap,
   dan hook transisi tema aman untuk experience lain. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const dir = 'renderer/experiences/fast-food/';

function strip(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }
function selectors(css) {
  const out = [], stack = []; let pre = '';
  for (const ch of strip(css)) {
    if (ch === '{') { stack.push(pre.trim()); pre = ''; }
    else if (ch === '}') { const s = stack.pop(); if (s && !s.startsWith('@')) out.push(s); pre = ''; }
    else if (ch === ';' && stack.length === 0) pre = '';
    else pre += ch;
  }
  return out;
}

test('semua aturan CSS Fast Food terkunci ke experience ini', () => {
  const bad = [];
  selectors(read(dir + 'fastfood.css')).forEach((group) => {
    group.split(',').forEach((raw) => {
      const sel = raw.trim();
      if (!sel || /^(from|to|\d+%)/.test(sel) || /^\d/.test(sel)) return;
      const ok = /\.ff-/.test(sel) || /fast-food/.test(sel) || /^html\.ff-vt/.test(sel) || /^\.app\.fast-food-active/.test(sel);
      if (!ok) bad.push(sel);
    });
  });
  assert.deepStrictEqual(bad, [], 'selektor tanpa kunci Fast Food: ' + bad.join(' | '));
});

test('sprite tertanam sebagai data URI WebP dan lengkap untuk Burger Builder', () => {
  const ctx = { self: {} }; ctx.self = ctx; vm.createContext(ctx);
  vm.runInContext(read(dir + 'sprites.js'), ctx);
  const art = ctx.JF.ffArt;
  ['burger', 'bunTop', 'bunBottom', 'patty', 'cheese', 'tomato', 'lettuce', 'hat', 'fries', 'cup', 'lamp', 'neon', 'board', 'badge'].forEach((k) => {
    assert.match(art.src[k], /^data:image\/webp;base64,/, 'sprite ' + k + ' tidak tertanam');
    assert.ok(art.size[k][0] > 0 && art.size[k][1] > 0, 'ukuran ' + k);
  });
  assert.ok(/img-src[^;"]*data:/.test(read('index.html')), 'CSP index.html harus mengizinkan img-src data:');
});

test('Burger Builder punya satu nama untuk setiap tahap XP dan tidak membuat penyimpanan baru', () => {
  const ctx = { self: {} }; ctx.self = ctx; vm.createContext(ctx);
  ctx.JF = {};
  vm.runInContext(read('renderer/experiences/capybara-world/capyrafi.js'), ctx);
  vm.runInContext(read(dir + 'sprites.js'), ctx);
  vm.runInContext(read(dir + 'burger.js'), ctx);
  assert.strictEqual(ctx.JF.burger.NAMES.length, ctx.JF.capyrafi.STAGES.length);
  assert.strictEqual(typeof ctx.JF.burger.compute, 'function');
  const html = ctx.JF.burger.stack({ stage: 5, mood: 'party' });
  assert.match(html, /l-hat/); assert.match(html, /l-full/);
  assert.match(ctx.JF.burger.stack({ stage: 0 }), /l-bunBottom/);
  const src = read(dir + 'burger.js') + read(dir + 'beranda.js') + read(dir + 'pages.js');
  assert.ok(!/localStorage\.setItem/.test(src), 'progres burger harus dihitung dari state, bukan disimpan');
});

test('Fast Food terdaftar di index, boot, Pengaturan, whitelist Beranda, dan CSS dimuat', () => {
  const idx = read('index.html');
  ['fastfood.css', 'sprites.js', 'burger.js', 'beranda.js', 'pages.js', 'experience.js'].forEach((f) => assert.ok(idx.includes(dir + f), f + ' belum dimuat di index.html'));
  assert.ok(idx.indexOf(dir + 'sprites.js') < idx.indexOf(dir + 'burger.js'), 'sprites.js harus dimuat sebelum burger.js');
  assert.ok(idx.indexOf(dir + 'pages.js') < idx.indexOf(dir + 'experience.js'), 'pages.js harus sebelum experience.js');
  assert.match(read('renderer/boot.js'), /fastFood\.render\(id\)/);
  assert.match(read('renderer/boot.js'), /fastFood\.refresh\(/);
  assert.match(read('renderer/pages/pengaturan.js'), /value: 'fast-food'/);
  assert.match(read('renderer/pages/beranda.js'), /'fast-food'/);
});

test('Fast Food mengikuti tema (tidak dipaksa terang) dan hook transisi tidak mengubah experience lain', () => {
  const exp = read(dir + 'experience.js');
  assert.match(exp, /JF\.theme\.get\(\)/);
  assert.ok(!/setAttribute\('data-theme',\s*'light'\)/.test(exp), 'Fast Food tidak boleh memaksa mode terang');
  const theme = read('renderer/theme.js');
  assert.match(theme, /JF\.themeTransition/);
  assert.match(theme, /notify && JF\.themeTransition/, 'transisi hanya untuk perubahan yang dipicu pengguna');
  assert.match(exp, /reduced\(\)/, 'transisi harus menghormati prefers-reduced-motion');
  assert.match(read(dir + 'fastfood.css'), /prefers-reduced-motion: reduce/);
});

test('semua halaman di menu board punya rute nyata di JF.pages', () => {
  const exp = read(dir + 'experience.js');
  const ids = [...exp.matchAll(/\['(\w+)', '[^']+', '[^']+', '[^']+'\]/g)].map((m) => m[1]);
  assert.ok(ids.length >= 10, 'menu board kurang dari 10 halaman');
  const pages = fs.readdirSync(path.join(root, 'renderer/pages')).map((f) => f.replace(/\.js$/, ''));
  ids.forEach((id) => assert.ok(pages.indexOf(id) >= 0, 'halaman ' + id + ' tidak ada di renderer/pages'));
});
