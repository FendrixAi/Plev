'use strict';
/* Rilis publik Jam Fokus.
   Script ini sengaja menolak berjalan tanpa code-signing. Installer yang tidak
   ditandatangani tidak boleh dipublikasikan karena electron-updater tidak bisa
   memverifikasi penerbitnya (lihat F-01 pada audit keamanan).

   Variabel yang diperlukan:
   - WIN_CSC_LINK atau CSC_LINK: path/URL/base64 certificate .pfx
   - WIN_CSC_KEY_PASSWORD atau CSC_KEY_PASSWORD: password certificate (opsional)
   - GH_TOKEN atau GITHUB_TOKEN: token untuk publish ke GitHub Releases

   Contoh (PowerShell, jangan commit nilainya):
     $env:WIN_CSC_LINK = "C:\sertifikat\jam-fokus.pfx"
     $env:WIN_CSC_KEY_PASSWORD = "***"
     $env:GH_TOKEN = "***"
     npm run release
*/
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');

function fail(message) {
  console.error('\n[Rilis diblokir] ' + message + '\n');
  process.exit(1);
}

const signing = process.env.WIN_CSC_LINK || process.env.CSC_LINK;
if (!signing) {
  fail(
    'Code signing belum dikonfigurasi. Set WIN_CSC_LINK atau CSC_LINK ke certificate .pfx. ' +
    'Tanpa signature, installer tidak boleh dipublikasikan (F-01).'
  );
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  fail('GH_TOKEN atau GITHUB_TOKEN belum diset. Rilis tidak dijalankan tanpa token publish.');
}

if (!fs.existsSync(cli)) {
  fail('electron-builder tidak ditemukan. Jalankan npm install terlebih dahulu.');
}

const args = [
  cli,
  '--win', 'nsis',
  '--publish', 'always',
  // Gagal jika certificate tidak bisa dipakai, alih-alih menghasilkan installer unsigned.
  '--config.win.forceCodeSigning=true',
  '--config.win.verifyUpdateCodeSignature=true'
];

console.log('[Jam Fokus] Membangun installer bertanda tangan dan mempublikasikan rilis...');
const result = spawnSync(process.execPath, args, {
  cwd: root,
  env: process.env,
  stdio: 'inherit'
});

if (result.error) fail('Gagal menjalankan electron-builder: ' + result.error.message);
if (result.status !== 0) process.exit(result.status == null ? 1 : result.status);

// Pastikan metadata updater memuat publisherName. Tanpa ini electron-updater
// akan melewati verifikasi signature (lihat F-01).
const updateYml = path.join(root, 'dist', 'win-unpacked', 'resources', 'app-update.yml');
if (!fs.existsSync(updateYml)) {
  fail('Build selesai, tetapi app-update.yml tidak ditemukan. Rilis dibatalkan.');
}
const meta = fs.readFileSync(updateYml, 'utf8');
if (!/^\s*publisherName\s*:/m.test(meta)) {
  fail('Build selesai, tetapi app-update.yml tidak berisi publisherName. Rilis dibatalkan.');
}

console.log('[Jam Fokus] Rilis bertanda tangan selesai dan publisherName terverifikasi.');
