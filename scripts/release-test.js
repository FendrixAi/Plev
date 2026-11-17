'use strict';
/* Rilis UJI tanpa code signing.
   Tujuan: membuat installer unsigned untuk pengujian, lalu mengunggahnya
   sebagai GitHub pre-release. Rilis stabil tetap wajib memakai
   scripts/release.js dan certificate code-signing.

   Wajib set:
   - JF_ALLOW_UNSIGNED_RELEASE=1  (izin eksplisit)
   - GH_TOKEN atau GITHUB_TOKEN   (kecuali mode --dry-run)

   Contoh PowerShell:
     $env:JF_ALLOW_UNSIGNED_RELEASE = "1"
     $env:GH_TOKEN = "token"
     npm run release:test
*/
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
const dryRun = process.argv.includes('--dry-run');

function fail(message) {
  console.error('\n[Rilis uji diblokir] ' + message + '\n');
  process.exit(1);
}

if (process.env.JF_ALLOW_UNSIGNED_RELEASE !== '1') {
  fail(
    'Set JF_ALLOW_UNSIGNED_RELEASE=1 untuk mengizinkan rilis uji unsigned. ' +
    'Jalur ini hanya membuat pre-release dan tidak boleh dipakai untuk rilis stabil.'
  );
}

if (!dryRun) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    fail('GH_TOKEN atau GITHUB_TOKEN belum diset. Rilis uji tidak dijalankan tanpa token.');
  }
}

if (!fs.existsSync(cli)) {
  fail('electron-builder tidak ditemukan. Jalankan npm install terlebih dahulu.');
}

const args = [
  cli,
  '--win', 'nsis',
  '--publish', dryRun ? 'never' : 'always',
  // Build uji tidak memakai certificate; jangan paksa signing.
  '--config.win.forceCodeSigning=false',
  // Tanpa certificate tidak ada publisherName yang bisa diverifikasi.
  '--config.win.verifyUpdateCodeSignature=false'
];

const env = { ...process.env, EP_PRE_RELEASE: 'true' };
delete env.EP_DRAFT;

console.log(
  dryRun
    ? '[Jam Fokus] Build uji unsigned (dry-run, tidak publish)...'
    : '[Jam Fokus] Build uji unsigned dan publish sebagai GitHub pre-release...'
);
console.log('[Jam Fokus] Jangan jadikan pre-release ini sebagai rilis stabil.');

const result = spawnSync(process.execPath, args, {
  cwd: root,
  env,
  stdio: 'inherit'
});

if (result.error) fail('Gagal menjalankan electron-builder: ' + result.error.message);
if (result.status !== 0) process.exit(result.status == null ? 1 : result.status);

console.log(
  dryRun
    ? '[Jam Fokus] Build uji selesai. Tidak ada yang dipublikasikan.'
    : '[Jam Fokus] Pre-release uji selesai. Periksa GitHub Releases sebelum dibagikan.'
);
