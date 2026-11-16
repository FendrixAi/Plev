'use strict';
/* Regression tests for the 2026-11-11 security audit (F-01a, F-02, F-03). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { EventEmitter } = require('events');
const { createLibraryService, ALLOWED_EXT, BLOCKED_OPEN_EXT } = require('../library-service');
const { initUpdater } = require('../updater');

const root = path.join(__dirname, '..');

function svc(pickedNames) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jf-sec-'));
  const src = path.join(dir, 'src'); fs.mkdirSync(src);
  const opened = [], shown = [];
  const paths = pickedNames.map((n) => { const p = path.join(src, n); fs.writeFileSync(p, 'x'); return p; });
  const s = createLibraryService({
    userDataDir: path.join(dir, 'ud'),
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: paths }) },
    shell: { openPath: async (p) => { opened.push(p); return ''; }, showItemInFolder: (p) => { shown.push(p); } },
    getWindow: () => null
  });
  return { s, dir, src, opened, shown };
}

/* ── F-03 ─────────────────────────────────────────────────────────── */
test('F-03: script/HTML types are not importable', async () => {
  ['.js', '.ts', '.html', '.css', '.htm', '.vbs', '.bat', '.exe', '.ps1'].forEach((e) => {
    assert.ok(!ALLOWED_EXT.has(e), e + ' must not be allowed');
  });
  ['.pdf', '.png', '.txt', '.md', '.docx', '.xlsx', '.csv', '.json'].forEach((e) => {
    assert.ok(ALLOWED_EXT.has(e), e + ' should still be allowed');
  });
  const t = svc(['laporan.js', 'laporan.html', 'catatan.txt']);
  const r = await t.s.pick({ multiple: true });
  assert.deepStrictEqual(r.errors.map((x) => x.error), ['unsupported-type', 'unsupported-type']);
  assert.strictEqual(r.files.length, 1);
  const single = svc(['x.js']);
  assert.strictEqual((await single.s.pick({})).error, 'unsupported-type');
});

test('F-03: legacy .js/.html files already in the Library are never launched', async () => {
  const t = svc(['a.txt']);
  const filesDir = path.join(t.dir, 'ud', 'library', 'files');
  fs.mkdirSync(filesDir, { recursive: true });
  const legacy = ['libfile_1_old.js', 'libfile_2_old.html', 'libfile_3_old.css'];
  legacy.forEach((n) => fs.writeFileSync(path.join(filesDir, n), 'x'));
  for (const n of legacy) {
    const r = await t.s.open({ fileName: n });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'blocked-type');
  }
  assert.strictEqual(t.opened.length, 0, 'shell.openPath must not be called');
  assert.strictEqual(t.shown.length, 3, 'folder is revealed instead');
  assert.ok(BLOCKED_OPEN_EXT.has('.js') && BLOCKED_OPEN_EXT.has('.html'));
});

test('F-03: safe types still open', async () => {
  const t = svc(['a.txt']);
  const p = await t.s.pick({});
  const imp = await t.s.importFile({ token: p.token });
  assert.strictEqual((await t.s.open({ fileName: imp.fileName })).ok, true);
  assert.strictEqual(t.opened.length, 1);
});

/* ── F-01a ────────────────────────────────────────────────────────── */
test('F-01a: updater never installs silently on app quit', async () => {
  const au = new EventEmitter();
  au.checkForUpdates = () => Promise.resolve();
  const u = initUpdater({
    app: { isPackaged: true, getVersion: () => '1.0.1' },
    loadUpdater: () => au,
    backupDir: path.join(os.tmpdir(), 'jf-upd-sec'),
    timers: { setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {} }
  });
  await u.check(true);
  assert.strictEqual(au.autoInstallOnAppQuit, false);
  assert.ok(!/autoInstallOnAppQuit\s*=\s*true/.test(fs.readFileSync(path.join(root, 'updater.js'), 'utf8')));
});

test('F-01b: rilis tanpa code signing ditolak sebelum publish', () => {
  const env = { ...process.env };
  ['WIN_CSC_LINK', 'CSC_LINK', 'GH_TOKEN', 'GITHUB_TOKEN'].forEach((k) => delete env[k]);
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'release.js')], {
    cwd: root, env, encoding: 'utf8'
  });
  assert.strictEqual(r.status, 1);
  assert.match((r.stderr || '') + (r.stdout || ''), /Code signing belum dikonfigurasi/i);
  const src = fs.readFileSync(path.join(root, 'scripts', 'release.js'), 'utf8');
  assert.match(src, /forceCodeSigning=true/);
  assert.match(src, /verifyUpdateCodeSignature=true/);
  assert.match(src, /publisherName/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.release, /scripts[\\/]release\.js/);
});

test('F-01c: update yang sudah diunduh tidak dipasang otomatis', async () => {
  const au = new EventEmitter();
  au.checkForUpdates = () => {
    au.emit('update-available', { version: '1.0.2' });
    au.emit('update-downloaded', { version: '1.0.2' });
    return Promise.resolve();
  };
  const queue = [];
  const u = initUpdater({
    app: { isPackaged: true, getVersion: () => '1.0.1' },
    loadUpdater: () => au,
    backupDir: path.join(os.tmpdir(), 'jf-upd-sec'),
    timers: { setTimeout: (fn) => { queue.push(fn); return fn; }, setInterval: () => {}, clearTimeout: () => {} }
  });
  await u.check(true);
  assert.strictEqual(u.getStatus().phase, 'ready');
  assert.strictEqual(queue.length, 0, 'tidak boleh ada timer install otomatis');
  assert.strictEqual(au.autoInstallOnAppQuit, false);
});

/* ── F-02 ─────────────────────────────────────────────────────────── */
test('F-02: Electron runtime is a supported major (>= 43) and the lockfile matches', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const major = parseInt(String(pkg.devDependencies.electron).split('.')[0], 10);
  assert.ok(major >= 43, 'electron major ' + major);
  assert.strictEqual(lock.packages['node_modules/electron'].version, pkg.devDependencies.electron);
  assert.strictEqual(lock.version, pkg.version);
});

test('F-02: preload scripts only require electron (sandbox shims removed in Electron 45)', () => {
  ['preload.js', 'mini-preload.js'].forEach((f) => {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const mods = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    assert.ok(mods.every((m) => m === 'electron'), f + ' requires ' + mods.join(','));
    assert.ok(!/\b(Buffer|setImmediate|clearImmediate)\b/.test(src), f + ' uses a removed global');
  });
});

/* ── F-08 ─────────────────────────────────────────────────────────── */
test('F-08: build dependencies and lockfile no longer use known vulnerable versions', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const builder = lock.packages['node_modules/electron-builder'];
  assert.ok(builder, 'electron-builder ada di lockfile');
  assert.strictEqual(builder.version, pkg.devDependencies['electron-builder']);
  assert.ok(parseFloat(builder.version) >= 26, 'electron-builder >= 26, dapat ' + builder.version);

  const vulnerable = Object.entries(lock.packages)
    .filter(([key]) => /(^|\/)minimatch$/.test(key))
    .map(([key, entry]) => ({ key, version: entry.version }))
    .filter(({ version }) => {
      const [major, minor, patch] = version.split('.').map(Number);
      if (major < 7) return false;
      if (major < 11) return true;
      return major === 11 && minor === 0 && patch < 1;
    });
  assert.deepStrictEqual(vulnerable, [], 'minimatch rentan tersisa: ' + JSON.stringify(vulnerable));
});
