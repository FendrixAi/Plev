'use strict';
/* Pemindai paritas Original ↔ Capybara World (bukan tes; dipakai oleh parity.test.js).
   Jalankan `node tests/parity-scan.js` untuk melihat, per tampilan, fitur Original yang belum dipakai.
   `node tests/parity-scan.js --init <nama>` mencetak kerangka bagian PARITY.md untuk tampilan baru.

   Cara kerja: kumpulkan "simbol logika" (JF.<modul>.<fungsi>, termasuk lewat alias `var x = JF.modul`
   dan `app.<fungsi>` = JF.app.<fungsi>) yang dipanggil oleh halaman Original dan oleh Capybara World.
   Logika fitur ada di shared/ + core.js; kedua tampilan hanya boleh memanggilnya. Simbol yang dipakai
   Original tapi tidak dipakai Capybara harus dicatat di PARITY.md (pending atau na). */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
// Modul tampilan murni (bukan fitur): tidak dihitung.
const IGNORE_MODULES = ['ui', 'pages', 'charts', 'clock', 'theme', 'experiences', 'capybaraHome', 'capybaraPages', 'capyrafi'];

const originalDir = path.join(root, 'renderer', 'pages');
const experiencesDir = path.join(root, 'renderer', 'experiences');

/* Tampilan = setiap folder di renderer/experiences/<nama>/ (Original = acuan, di renderer/pages/).
   Menambah tampilan baru cukup membuat foldernya; tes langsung menuntut bagian di PARITY.md. */
function viewNames() {
  if (!fs.existsSync(experiencesDir)) return [];
  return fs.readdirSync(experiencesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}

function symbolsOf(src) {
  const out = new Set();
  const aliases = { app: 'app' };                       // `app.x` selalu JF.app.x
  const decl = /(?:var|const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:root\.|window\.|self\.)?JF\.([A-Za-z_$][\w$]*)\s*[;,]/g;
  const mods = {};                                      // nama alias -> daftar modul JF yang ia tunjuk
  let m;
  while ((m = decl.exec(src))) (mods[m[1]] = mods[m[1]] || []).push(m[2]);
  Object.keys(mods).forEach((name) => {
    // Alias dipakai bila SEMUA deklarasi namanya menunjuk modul JF yang sama dan tidak jadi parameter fungsi.
    // Nama yang juga dipakai sebagai variabel/parameter lain di berkas yang sama dilewati (ambigu).
    const n = name.replace(/\$/g, '\\$');
    const declared = (src.match(new RegExp('(?:var|let|const)\\s+' + n + '\\b', 'g')) || []).length;
    const params = (src.match(new RegExp('function\\s*[\\w$]*\\s*\\([^)]*(?<![\\w$.])' + n + '(?![\\w$])[^)]*\\)', 'g')) || []).length;
    const sameMod = mods[name].every((x) => x === mods[name][0]);
    if (sameMod && declared === mods[name].length && params === 0) aliases[name] = mods[name][0];
  });
  const direct = /\bJF\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g;
  while ((m = direct.exec(src))) out.add(m[1] + '.' + m[2]);
  Object.keys(aliases).forEach((alias) => {
    const re = new RegExp('(?<![\\w$.])' + alias.replace(/\$/g, '\\$') + '\\.([A-Za-z_$][\\w$]*)', 'g');
    while ((m = re.exec(src))) out.add(aliases[alias] + '.' + m[1]);
  });
  return out;
}

function scanDir(dir) {
  const all = new Set();
  fs.readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => {
    symbolsOf(fs.readFileSync(path.join(dir, f), 'utf8')).forEach((s) => all.add(s));
  });
  return all;
}

function scan() {
  const original = scanDir(originalDir);
  const keep = (sym) => IGNORE_MODULES.indexOf(sym.split('.')[0]) < 0;
  const views = {};
  viewNames().forEach((name) => {
    const symbols = scanDir(path.join(experiencesDir, name));
    views[name] = { symbols: symbols, missing: [...original].filter(keep).filter((sym) => !symbols.has(sym)).sort() };
  });
  return { original: original, views: views };
}

/* Kerangka bagian PARITY.md untuk tampilan baru: semua fitur Original yang belum dipakai tampilan itu. */
function skeleton(name) {
  const original = scanDir(originalDir);
  const keep = (sym) => IGNORE_MODULES.indexOf(sym.split('.')[0]) < 0;
  const symbols = fs.existsSync(path.join(experiencesDir, name)) ? scanDir(path.join(experiencesDir, name)) : new Set();
  const rows = [...original].filter(keep).filter((sym) => !symbols.has(sym)).sort()
    .map((sym) => '| `' + sym + '` | pending | belum dibuat |');
  return ['## Tampilan: ' + name, '', '### A. Simbol logika (dipindai otomatis)', '',
    '| Simbol | Status | Catatan |', '|---|---|---|'].concat(rows).concat(['',
    '### B. Fitur per halaman', '', '| Fitur | Original | ' + name + ' | Status |', '|---|---|---|---|', '']).join('\n');
}

if (require.main === module) {
  const arg = process.argv.slice(2);
  if (arg[0] === '--init') {
    if (!arg[1]) { console.error('Pakai: node tests/parity-scan.js --init <nama-tampilan>'); process.exit(1); }
    console.log(skeleton(arg[1]));
  } else {
    const r = scan();
    Object.keys(r.views).forEach((name) => {
      console.log('[' + name + '] dipakai Original tapi belum dipakai tampilan ini (' + r.views[name].missing.length + '):');
      r.views[name].missing.forEach((sym) => console.log('  ' + sym));
    });
  }
}

module.exports = { scan, symbolsOf, viewNames, skeleton };
