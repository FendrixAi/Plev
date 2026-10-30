const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme, screen, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('xyz.levia.jamfokus');

let win, tray, miniWin = null, quitting = false, pinned = false, popTimer = null;
const alive = (w) => w && !w.isDestroyed();

// Hanya jendela milik aplikasi ini (utama dan kartu mini) yang boleh memanggil IPC.
const trusted = (e) => !!e && !!e.sender &&
  ((alive(win) && e.sender === win.webContents) || (alive(miniWin) && e.sender === miniWin.webContents));
const onTrusted = (channel, fn) => ipcMain.on(channel, (e, ...args) => { if (trusted(e)) fn(e, ...args); });
const handleTrusted = (channel, fn) => ipcMain.handle(channel, (e, ...args) => (trusted(e) ? fn(e, ...args) : null));
// Aplikasi ini tidak pernah membuka halaman luar: tolak jendela baru dan perpindahan alamat.
const lockNavigation = (w) => {
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (ev) => ev.preventDefault());
};

// ── Simpan/baca posisi & pengaturan kartu mini dari userData ─────────────────
const settingsPath = () => path.join(app.getPath('userData'), 'mini-settings.json');
let miniSettings = { x: null, y: null, opacity: 1.0, solidOnHover: false };
function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const s = JSON.parse(raw);
    if (s && typeof s === 'object') {
      if (typeof s.x === 'number') miniSettings.x = s.x;
      if (typeof s.y === 'number') miniSettings.y = s.y;
      if (typeof s.opacity === 'number') miniSettings.opacity = Math.min(1, Math.max(0.4, s.opacity));
      if (typeof s.solidOnHover === 'boolean') miniSettings.solidOnHover = s.solidOnHover;
    }
  } catch (e) { /* file belum ada, pakai default */ }
}
function saveSettings() {
  try { fs.writeFileSync(settingsPath(), JSON.stringify(miniSettings)); } catch (e) {}
}

// Pastikan posisi masih di dalam layar yang tersedia
function clampToScreen(x, y, w, h) {
  const displays = screen.getAllDisplays();
  for (const d of displays) {
    const wa = d.workArea;
    if (x >= wa.x - w + 50 && x < wa.x + wa.width - 50 &&
        y >= wa.y - h + 50 && y < wa.y + wa.height - 50) {
      return { x: Math.max(wa.x, Math.min(x, wa.x + wa.width - w)), y: Math.max(wa.y, Math.min(y, wa.y + wa.height - h)) };
    }
  }
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - w - 8, y: wa.y + wa.height - h - 8 };
}

function closeMini() {
  if (alive(miniWin)) miniWin.close();
  miniWin = null;
}

function showWin() {
  closeMini();
  if (!alive(win)) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// Jendela mini terpisah: kecil, tanpa bingkai, selalu di atas, bisa digeser
function createMini() {
  if (alive(miniWin)) { miniWin.show(); return; }
  const w = 296, h = 104;
  let pos;
  if (miniSettings.x !== null && miniSettings.y !== null) {
    pos = clampToScreen(miniSettings.x, miniSettings.y, w, h);
  } else {
    const wa = screen.getPrimaryDisplay().workArea;
    pos = { x: wa.x + wa.width - w - 8, y: wa.y + wa.height - h - 8 };
  }
  miniWin = new BrowserWindow({
    width: w, height: h, x: pos.x, y: pos.y,
    frame: false, transparent: true, resizable: false, maximizable: false,
    fullscreenable: false, skipTaskbar: true, hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'mini-preload.js'),
      contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      backgroundThrottling: false
    }
  });
  miniWin.setAlwaysOnTop(true, 'floating');
  miniWin.setOpacity(miniSettings.opacity);
  miniWin.loadFile('mini.html');
  lockNavigation(miniWin);
  miniWin.on('moved', () => {
    const b = miniWin.getBounds();
    miniSettings.x = b.x; miniSettings.y = b.y;
    saveSettings();
  });
  miniWin.on('closed', () => { miniWin = null; });
}

// ── Tooltip tray dengan sisa waktu ──────────────────────────────────────────
let _trayState = null;
function fmtTip(s) {
  if (!s) return 'Jam Fokus';
  if (s.mode === 'run') {
    const rem = Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000));
    return String(Math.floor(rem / 60)).padStart(2, '0') + ':' + String(rem % 60).padStart(2, '0') + ' · ' + (s.name || 'Tugas');
  }
  if (s.mode === 'pause') return 'Dijeda · ' + (s.name || 'Tugas');
  if (s.mode === 'brk') {
    const rem = Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000));
    return String(Math.floor(rem / 60)).padStart(2, '0') + ':' + String(rem % 60).padStart(2, '0') + ' · Istirahat';
  }
  return 'Jam Fokus';
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWin);
  app.whenReady().then(() => {
    loadSettings();

    win = new BrowserWindow({
      width: 1120, height: 760, minWidth: 640, minHeight: 480,
      title: 'Jam Fokus', autoHideMenuBar: true, backgroundColor: '#FBF8F1', show: false,
      icon: path.join(__dirname, 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    });
    win.setMenuBarVisibility(false);
    win.loadFile('index.html');
    lockNavigation(win);
    // Tampilkan setelah frame pertama selesai digambar (tema sudah diterapkan, tanpa kedip putih)
    win.once('ready-to-show', () => { if (win) win.show(); });

    // Tombol X = sembunyi ke tray, timer tetap jalan
    win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
    // Bersihkan referensi saat jendela benar-benar dihancurkan (quit/crash),
    // agar showWin() tidak memanggil method pada objek yang sudah hancur.
    win.on('closed', () => { win = null; });
    // Saat jendela utama di-restore dari taskbar (klik ikon taskbar / restore),
    // tutup widget mini supaya tidak ada dua UI tampil bersamaan.
    win.on('restore', () => closeMini());

    // System tray dicoba dulu di sini, tapi kegagalannya TIDAK boleh menggagalkan
    // registrasi IPC di bawah (mode Mini, alarm, state, settings, dll).
    try {
      const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 });
      tray = new Tray(icon);
      tray.setToolTip('Jam Fokus');
      tray.on('click', showWin);
      const menu = () => Menu.buildFromTemplate([
        { label: 'Buka Jam Fokus', click: showWin },
        { label: 'Selalu di atas', type: 'checkbox', checked: pinned, click: (i) => { pinned = i.checked; win.setAlwaysOnTop(pinned, 'floating'); } },
        { label: 'Buka saat Windows menyala', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
          click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
        { type: 'separator' },
        { label: 'Keluar', click: () => { quitting = true; app.quit(); } }
      ]);
      tray.setContextMenu(menu());
      tray.on('right-click', () => tray.setContextMenu(menu()));
    } catch (err) {
      // Laporkan, jangan diamkan: tanpa tray, jalan kembali setelah tombol X
      // hanya lewat peluncuran aplikasi lagi (event second-instance).
      console.error('[Jam Fokus] Gagal inisialisasi system tray:', err);
      tray = null;
      try {
        dialog.showErrorBox('Jam Fokus — ikon tray tidak tersedia',
          'Ikon di area notifikasi (tray) gagal dibuat, sehingga jendela yang disembunyikan tidak bisa dikembalikan lewat tray.\n\n'
          + 'Untuk membuka aplikasi kembali, jalankan Jam Fokus sekali lagi (jendela akan muncul kembali).\n\n'
          + 'Detail: ' + (err && err.message ? err.message : String(err)));
      } catch (e) { /* dialog juga bisa gagal; log di atas sudah cukup */ }
    }

    // Update tooltip tray tiap detik
    setInterval(() => {
      if (tray && !tray.isDestroyed()) {
        try { tray.setToolTip(fmtTip(_trayState)); } catch (e) {}
      }
    }, 1000);

    // Timer selesai: kalau mode mini aktif, mini berkedip; kalau tidak, jendela utama muncul di atas
    // Mode terang/gelap dari halaman utama: samakan tema sistem agar kartu mini ikut berubah
    onTrusted('theme', (e, mode) => {
      const dark = mode === 'dark';
      nativeTheme.themeSource = dark ? 'dark' : 'light';
      if (win) win.setBackgroundColor(dark ? '#141414' : '#FBF8F1');
    });

    onTrusted('popup', () => {
      if (alive(miniWin)) {
        miniWin.webContents.send('alarm');
        return;
      }
      showWin();
      win.setAlwaysOnTop(true, 'floating');
      win.flashFrame(true);
      clearTimeout(popTimer);
      popTimer = setTimeout(() => { win.flashFrame(false); if (!pinned) win.setAlwaysOnTop(false); }, 10000);
    });

    // Peringatan 8 detik: kirim ke mini jika aktif, untuk denyut halus
    onTrusted('warn8', () => {
      if (alive(miniWin)) miniWin.webContents.send('warn8');
    });

    // Mini mode: jendela utama di-minimize (bukan hide) supaya ikon taskbar
    // tetap ada; klik ikon taskbar akan me-restore dan menutup widget (lihat
    // win.on('restore') di atas). Widget sendiri tetap skipTaskbar.
    onTrusted('mini', (e, on) => { if (on) { createMini(); if (alive(win)) win.minimize(); } else showWin(); });
    onTrusted('state', (e, s) => {
      _trayState = s;
      if (alive(miniWin)) miniWin.webContents.send('state', s);
    });
    onTrusted('mini-ready', () => {
      win.webContents.send('cmd', 'push');
      // Kirim settings ke mini setelah ready
      if (alive(miniWin)) miniWin.webContents.send('mini-settings', miniSettings);
    });
    onTrusted('mini-cmd', (e, c) => {
      if (c === 'expand') showWin();
      else if (c === 'toggle' && alive(win)) win.webContents.send('cmd', c);   // perintah lain diabaikan
    });

    // Opacity & hover dari mini.html
    onTrusted('mini-hover', (e, hovering) => {
      if (!alive(miniWin)) return;
      if (miniSettings.solidOnHover) {
        miniWin.setOpacity(hovering ? 1.0 : miniSettings.opacity);
      }
    });

    // Simpan pengaturan mini dari index.html (opacity, solidOnHover)
    onTrusted('save-mini-settings', (e, s) => {
      if (!s || typeof s !== 'object') return;
      if (typeof s.opacity === 'number') miniSettings.opacity = Math.min(1, Math.max(0.4, s.opacity));
      if (typeof s.solidOnHover === 'boolean') miniSettings.solidOnHover = s.solidOnHover;
      saveSettings();
      if (alive(miniWin)) {
        miniWin.setOpacity(miniSettings.opacity);
        miniWin.webContents.send('mini-settings', miniSettings);
      }
    });

    // Renderer minta settings saat ini (invoke = dengan return value)
    handleTrusted('get-mini-settings', () => miniSettings);
  });

  // ── Library storage (managed copies only) ─────────────────────────────
  const crypto = require('crypto');
  const LIB_MAX_BYTES = 25 * 1024 * 1024;
  const LIB_ALLOWED_EXT = new Set(['.docx','.xlsx','.pdf','.png','.jpg','.jpeg','.gif','.webp','.txt','.md','.js','.ts','.json','.csv','.html','.css']);
  const libTokens = new Map();
  function libDir() { const d = path.join(app.getPath('userData'), 'library', 'files'); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); return d; }
  function libSafeName(name) { return String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file'; }
  function libResolve(rel) {
    if (typeof rel !== 'string' || !rel || path.isAbsolute(rel)) return null;
    const base = path.resolve(libDir());
    const full = path.resolve(base, rel);
    if (full !== base && !full.startsWith(base + path.sep)) return null;
    try {
      const realBase = fs.realpathSync(base);
      const realFull = fs.realpathSync(full);
      if (realFull !== realBase && !realFull.startsWith(realBase + path.sep)) return null;
    } catch (e) { /* file may not exist yet */ }
    try { const st = fs.lstatSync(full); if (st.isSymbolicLink()) return null; } catch (e) {}
    return full;
  }
  handleTrusted('library:pick', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], title: 'Pilih file untuk Library' });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return { canceled: true };
    const src = r.filePaths[0];
    let st;
    try { st = fs.lstatSync(src); } catch (err) { return { canceled: false, error: 'source-missing' }; }
    if (!st.isFile()) return { canceled: false, error: 'not-file' };
    if (st.size > LIB_MAX_BYTES) return { canceled: false, error: 'too-large' };
    const ext = path.extname(src).toLowerCase();
    if (!LIB_ALLOWED_EXT.has(ext)) return { canceled: false, error: 'unsupported-type' };
    const token = crypto.randomBytes(16).toString('hex');
    libTokens.set(token, { sourcePath: src, originalName: path.basename(src), size: st.size, ext: ext, expiresAt: Date.now() + 60000 });
    return { canceled: false, token: token, originalName: path.basename(src), size: st.size, ext: ext };
  });
  handleTrusted('library:import', async (e, req) => {
    req = req || {};
    const token = req.token;
    const entry = libTokens.get(token);
    if (!entry) return { ok: false, reason: 'bad-token' };
    libTokens.delete(token);
    if (entry.expiresAt < Date.now()) return { ok: false, reason: 'token-expired' };
    const src = entry.sourcePath;
    let st;
    try { st = fs.lstatSync(src); } catch (err) { return { ok: false, reason: 'source-missing' }; }
    if (!st.isFile()) return { ok: false, reason: 'not-file' };
    if (st.size > LIB_MAX_BYTES) return { ok: false, reason: 'too-large' };
    const ext = path.extname(src).toLowerCase();
    if (!LIB_ALLOWED_EXT.has(ext)) return { ok: false, reason: 'unsupported-type' };
    const id = 'libfile_' + crypto.randomBytes(8).toString('hex');
    const managedName = id + '_' + libSafeName(path.basename(src));
    const dest = path.join(libDir(), managedName);
    const tmp = dest + '.tmp';
    try {
      const srcFd = fs.openSync(src, 'r');
      const tmpFd = fs.openSync(tmp, 'wx');
      const buf = Buffer.alloc(64 * 1024);
      let pos = 0;
      while (true) {
        const b = fs.readSync(srcFd, buf, 0, buf.length, pos);
        if (b === 0) break;
        fs.writeSync(tmpFd, buf, 0, b);
        pos += b;
      }
      fs.closeSync(srcFd);
      fs.closeSync(tmpFd);
      const tst = fs.statSync(tmp);
      if (!tst.isFile() || tst.size !== st.size) { try { fs.unlinkSync(tmp); } catch (x) {} return { ok: false, reason: 'copy-failed' }; }
      fs.renameSync(tmp, dest);
    } catch (err) { try { fs.unlinkSync(tmp); } catch (x) {} return { ok: false, reason: 'copy-failed' }; }
    return { ok: true, id: id, fileName: managedName, originalName: entry.originalName, size: st.size, ext: ext };
  });
  handleTrusted('library:open', async (e, req) => {
    req = req || {};
    const full = libResolve(req.fileName);
    if (!full) return { ok: false, reason: 'bad-path' };
    let st;
    try { st = fs.lstatSync(full); } catch (err) { return { ok: false, reason: 'missing' }; }
    if (st.isSymbolicLink() || !st.isFile()) return { ok: false, reason: 'not-file' };
    const err = await shell.openPath(full);
    if (err) return { ok: false, reason: 'open-failed', message: err };
    return { ok: true };
  });
  handleTrusted('library:delete-file', async (e, req) => {
    req = req || {};
    const full = libResolve(req.fileName);
    if (!full) return { ok: false, reason: 'bad-path' };
    try {
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink() || !st.isFile()) return { ok: false, reason: 'not-file' };
    } catch (err) { return { ok: true, alreadyMissing: true }; }
    const pending = readPending();
    if (!pending.includes(req.fileName)) { pending.push(req.fileName); writePending(pending); }
    try { fs.unlinkSync(full); } catch (err) { return { ok: false, reason: 'delete-failed' }; }
    const after = readPending().filter(n => n !== req.fileName);
    writePending(after);
    return { ok: true };
  });
  const libPendingPath = () => path.join(app.getPath('userData'), 'library', 'pending-deletions.json');
  function readPending() { try { const raw = fs.readFileSync(libPendingPath(), 'utf8'); const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function writePending(list) { try { fs.writeFileSync(libPendingPath(), JSON.stringify(list)); } catch (e) {} }
  function recoverPending() {
    const list = readPending();
    const remaining = [];
    const deleted = [];
    for (const name of list) {
      const full = libResolve(name);
      if (!full) continue;
      try {
        const st = fs.lstatSync(full);
        if (st.isSymbolicLink() || !st.isFile()) { remaining.push(name); continue; }
      } catch (e) { continue; } // already gone
      try { fs.unlinkSync(full); deleted.push(name); } catch (e) { remaining.push(name); }
    }
    writePending(remaining);
    return { processed: list.length, remaining: remaining.length, deleted: deleted };
  }
  // Run recovery once app is ready, before window load? after libDir exists.
  app.whenReady().then(() => { try { recoverPending(); } catch (e) {} });
  handleTrusted('library:cleanup-pending', async (e, req) => {
    const list = Array.isArray(req && req.fileNames) ? req.fileNames : [];
    const out = [];
    for (const name of list) {
      const full = libResolve(name);
      if (!full) { out.push({ fileName: name, ok: false, reason: 'bad-path' }); continue; }
      try {
        const st = fs.lstatSync(full);
        if (st.isSymbolicLink() || !st.isFile()) { out.push({ fileName: name, ok: false, reason: 'not-file' }); continue; }
      } catch (err) { out.push({ fileName: name, ok: true, alreadyMissing: true }); continue; }
      try { fs.unlinkSync(full); out.push({ fileName: name, ok: true }); } catch (err) { out.push({ fileName: name, ok: false, reason: 'delete-failed' }); }
    }
    return { ok: true, results: out };
  });
  handleTrusted('library:recover-deletions', async () => {
    return recoverPending();
  });
  handleTrusted('library:check-files', async (e, req) => {
    req = req || {};
    const list = Array.isArray(req.fileNames) ? req.fileNames : [];
    const out = {};
    for (const name of list) {
      const full = libResolve(name);
      if (!full) { out[name] = { exists: false, reason: 'bad-path' }; continue; }
      try {
        const st = fs.lstatSync(full);
        if (st.isSymbolicLink()) { out[name] = { exists: false, reason: 'symlink' }; continue; }
        out[name] = { exists: st.isFile(), regular: st.isFile() };
      } catch (err) { out[name] = { exists: false, reason: 'missing' }; }
    }
    return { ok: true, files: out };
  });
  app.on('before-quit', () => { quitting = true; });
  // Sengaja TIDAK keluar otomatis saat semua jendela tertutup: aplikasi tetap
  // hidup di system tray agar timer berjalan terus. Keluar hanya lewat perintah
  // eksplisit "Keluar" pada menu tray (app.quit()).
  app.on('window-all-closed', () => {});
}
