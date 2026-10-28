'use strict';
/* Regresi keamanan: tidak ada jendela baru/navigasi keluar, preload tetap
   terisolasi dan sandbox aktif, serta IPC tahan terhadap jendela yang sudah
   dihancurkan. Perilaku runtime diverifikasi terpisah di Electron. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

test('navigasi dan jendela baru dibatasi', () => {
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  assert.match(main, /will-navigate', \(e, url\) => \{\s*if \(url !== wc\.getURL\(\)\) e\.preventDefault\(\);/);
  assert.match(main, /will-redirect', \(e\) => e\.preventDefault\(\)/);
  assert.match(main, /hardenWebContents\(win\.webContents\)/);
  assert.match(main, /hardenWebContents\(miniWin\.webContents\)/);
});

test('kedua jendela memakai sandbox dan tanpa Node di renderer', () => {
  const blocks = main.match(/webPreferences: \{[\s\S]*?\}/g) || [];
  assert.equal(blocks.length, 2);
  blocks.forEach((b) => {
    assert.match(b, /contextIsolation: true/);
    assert.match(b, /sandbox: true/);
    assert.match(b, /nodeIntegration: false/);
  });
});

test('IPC aman saat jendela sudah hancur atau payload kosong', () => {
  const popup = main.slice(main.indexOf("ipcMain.on('popup'"), main.indexOf("ipcMain.on('warn8'"));
  assert.match(popup, /if \(!alive\(win\)\) return;/);
  const ready = main.slice(main.indexOf("ipcMain.on('mini-ready'"), main.indexOf("ipcMain.on('mini-cmd'"));
  assert.match(ready, /if \(alive\(win\)\) win\.webContents\.send\('cmd', 'push'\)/);
  const save = main.slice(main.indexOf("ipcMain.on('save-mini-settings'"), main.indexOf("ipcMain.handle('get-mini-settings'"));
  assert.match(save, /if \(!s \|\| typeof s !== 'object'\) return;/);
});

test('preload tidak mengekspos ipcRenderer mentah', () => {
  const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  const mini = fs.readFileSync(path.join(root, 'mini-preload.js'), 'utf8');
  assert.doesNotMatch(preload, /exposeInMainWorld\([^,]+,\s*ipcRenderer/);
  assert.doesNotMatch(mini, /exposeInMainWorld\([^,]+,\s*ipcRenderer/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('desk'/);
  assert.match(mini, /contextBridge\.exposeInMainWorld\('mini'/);
});
