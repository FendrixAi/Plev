'use strict';
/* Pembaruan otomatis (electron-updater) dengan status yang dikirim ke jendela aplikasi.
   Alur: cek → unduh (ada progres) → tunggu sesi fokus selesai → hitung mundur →
   cadangkan data → pasang & buka ulang otomatis.
   Hanya aktif di versi yang DIPASANG lewat Setup; mode dev dan portable dilewati.
   Data pengguna (userData) tidak disentuh installer; cadangan tambahan disimpan
   di <userData>/backups sebelum pemasangan. */

const nodeFs = require('fs');
const nodePath = require('path');

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;   // cek ulang tiap 6 jam
const FIRST_CHECK_MS = 15 * 1000;            // cek pertama 15 detik setelah app jalan
const COUNTDOWN_S = 10;                      // hitung mundur sebelum restart otomatis
const BUSY_POLL_MS = 5 * 1000;               // cek apakah sesi fokus sudah selesai
const PREPARE_TIMEOUT_MS = 8 * 1000;         // batas waktu menunggu data dari jendela
const PROGRESS_THROTTLE_MS = 200;
const KEEP_BACKUPS = 3;
const MAX_BACKUP_CHARS = 60 * 1024 * 1024;

function pad(n) { return String(n).padStart(2, '0'); }
function stamp(d) {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}
function msg(e) { return e && e.message ? e.message : String(e); }

function initUpdater(deps) {
  const app = deps.app;
  const fs = deps.fs || nodeFs;
  const path = deps.path || nodePath;
  const broadcast = deps.broadcast || function () {};
  const isBusy = deps.isBusy || function () { return false; };
  const timers = deps.timers || { setTimeout: setTimeout, setInterval: setInterval, clearTimeout: clearTimeout };
  const backupDir = deps.backupDir || null;
  const now = deps.now || function () { return new Date(); };
  const unsupported = !app.isPackaged || !!process.env.PORTABLE_EXECUTABLE_FILE;

  let au = null, wired = false, downloaded = null;
  let timer = null, cancelled = false, pendingBackup = null, lastProgressAt = 0;

  let status = {
    phase: unsupported ? 'unsupported' : 'idle',
    current: app.getVersion(), version: null,
    percent: 0, transferred: 0, total: 0, speed: 0,
    countdown: null, countdownTotal: COUNTDOWN_S, waiting: false, cancelled: false,
    manual: false, error: null, backupName: null
  };
  function set(patch) { status = Object.assign({}, status, patch); broadcast('update:status', status); }
  function clearTimer() { if (timer !== null) { timers.clearTimeout(timer); timer = null; } }

  function load() {
    if (au) return au;
    au = (deps.loadUpdater || function () { return require('electron-updater').autoUpdater; })();
    au.autoDownload = true;
    au.autoInstallOnAppQuit = true;   // cadangan: kalau tidak sempat restart, terpasang saat Keluar dari tray
    return au;
  }

  /* ── cadangan data sebelum pemasangan ─────────────────────────────── */
  function prune() {
    try {
      const files = fs.readdirSync(backupDir).filter(function (f) { return /^pre-update-.*\.json$/.test(f); }).sort();
      files.slice(0, Math.max(0, files.length - KEEP_BACKUPS)).forEach(function (f) {
        try { fs.unlinkSync(path.join(backupDir, f)); } catch (e) { /* biarkan */ }
      });
    } catch (e) { /* biarkan */ }
  }
  function writeBackup(json) {
    try {
      if (typeof json !== 'string' || !json || json.length > MAX_BACKUP_CHARS) return { ok: false, error: 'data tidak terbaca' };
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || !parsed.state || typeof parsed.state !== 'object') return { ok: false, error: 'data tidak valid' };
      fs.mkdirSync(backupDir, { recursive: true });
      const name = 'pre-update-' + stamp(now()) + '-v' + status.current + '.json';
      const file = path.join(backupDir, name), tmp = file + '.tmp';
      fs.writeFileSync(tmp, json, 'utf8');
      if (fs.statSync(tmp).size !== Buffer.byteLength(json, 'utf8')) throw new Error('ukuran berkas tidak cocok');
      fs.renameSync(tmp, file);
      prune();
      return { ok: true, name: name };
    } catch (e) { return { ok: false, error: msg(e) }; }
  }
  function requestBackup() {
    return new Promise(function (resolve) {
      if (!backupDir) { resolve({ ok: false, error: 'folder cadangan tidak tersedia' }); return; }
      const t = timers.setTimeout(function () {
        if (pendingBackup) { pendingBackup = null; resolve({ ok: false, error: 'aplikasi tidak menjawab' }); }
      }, PREPARE_TIMEOUT_MS);
      pendingBackup = { resolve: function (r) { timers.clearTimeout(t); resolve(r); } };
      broadcast('update:prepare');
    });
  }
  /** Dipanggil saat jendela mengirim isi data (JSON) untuk dicadangkan. */
  function receiveBackup(json) {
    if (!pendingBackup) return false;
    const p = pendingBackup; pendingBackup = null;
    p.resolve(writeBackup(json));
    return true;
  }

  /* ── pasang & restart ─────────────────────────────────────────────── */
  async function doInstall() {
    clearTimer();
    if (!downloaded || !au || status.phase === 'installing') return;
    set({ phase: 'installing', countdown: null, waiting: false, error: null });
    const b = await requestBackup();
    if (!b.ok) {
      set({ phase: 'ready', cancelled: true, backupName: null,
        error: 'Cadangan otomatis gagal (' + b.error + '), jadi pembaruan belum dipasang. Datamu tidak berubah. Coba lagi, atau ekspor cadangan manual dulu.' });
      return;
    }
    set({ backupName: b.name });
    if (deps.beforeInstall) { try { deps.beforeInstall(); } catch (e) { /* lanjut */ } }
    timers.setTimeout(function () {   // beri waktu layar "Memasang…" tampil
      try { au.quitAndInstall(true, true); }
      catch (e) { set({ phase: 'ready', cancelled: true, error: 'Gagal memulai pemasangan: ' + msg(e) }); }
    }, 800);
  }

  function waitIdleThenCount() {
    clearTimer();
    if (cancelled || !downloaded) return;
    if (isBusy()) {   // jangan putus timer fokus/istirahat yang sedang jalan
      set({ waiting: true, countdown: null });
      timer = timers.setTimeout(waitIdleThenCount, BUSY_POLL_MS);
      return;
    }
    let n = COUNTDOWN_S;
    set({ waiting: false, countdown: n });
    const step = function () {
      if (cancelled) return;
      if (isBusy()) { waitIdleThenCount(); return; }   // sesi baru dimulai: tunda lagi
      n -= 1;
      if (n <= 0) { doInstall(); return; }
      set({ countdown: n });
      timer = timers.setTimeout(step, 1000);
    };
    timer = timers.setTimeout(step, 1000);
  }

  function cancelAuto() {
    cancelled = true; clearTimer();
    if (status.phase === 'ready') set({ countdown: null, waiting: false, cancelled: true });
    return status;
  }
  function installNow() {
    if (!downloaded) return status;
    cancelled = false;
    doInstall();
    return status;
  }

  /* ── event dari electron-updater ──────────────────────────────────── */
  function wire(u) {
    if (wired) return;
    wired = true;
    u.on('checking-for-update', function () { /* status 'checking' sudah diset di check() */ });
    u.on('update-available', function (info) { set({ phase: 'available', version: info.version, percent: 0 }); });
    u.on('update-not-available', function () { set({ phase: 'uptodate', error: null }); });
    u.on('download-progress', function (p) {
      const t = Date.now();
      if (p.percent < 100 && t - lastProgressAt < PROGRESS_THROTTLE_MS) return;
      lastProgressAt = t;
      set({ phase: 'downloading', percent: Math.max(0, Math.min(100, Math.round(p.percent * 10) / 10)),
        transferred: p.transferred || 0, total: p.total || 0, speed: p.bytesPerSecond || 0 });
    });
    u.on('update-downloaded', function (info) {
      downloaded = info; cancelled = false;
      set({ phase: 'ready', version: info.version, percent: 100, error: null, cancelled: false, backupName: null });
      waitIdleThenCount();
    });
    u.on('error', function (e) {
      console.error('[Jam Fokus] updater:', msg(e));
      if (status.phase === 'downloading' || status.phase === 'available' || status.phase === 'checking') {
        // Pengecekan otomatis yang gagal (misalnya offline) tidak perlu mengganggu pengguna.
        set(status.manual ? { phase: 'error', error: msg(e) } : { phase: 'idle', error: null });
      }
    });
  }

  function check(isManual) {
    const busyPhase = status.phase === 'checking' || status.phase === 'available' || status.phase === 'downloading' ||
      status.phase === 'ready' || status.phase === 'installing';
    if (unsupported) { set({ phase: 'unsupported', manual: !!isManual }); return Promise.resolve(status); }
    if (busyPhase) { if (isManual) set({ manual: true }); return Promise.resolve(status); }
    try { wire(load()); } catch (e) {
      console.error('[Jam Fokus] updater gagal dimuat:', e);
      set(isManual ? { phase: 'error', manual: true, error: 'Modul pembaruan gagal dimuat.' } : { phase: 'idle' });
      return Promise.resolve(status);
    }
    set({ phase: 'checking', manual: !!isManual, error: null });
    return au.checkForUpdates().then(function () { return status; }, function (e) {
      set(isManual ? { phase: 'error', error: 'Gagal memeriksa pembaruan. Pastikan internet aktif. (' + msg(e) + ')' } : { phase: 'idle', error: null });
      return status;
    });
  }

  function start() {
    if (unsupported) return;
    timers.setTimeout(function () { check(false); }, FIRST_CHECK_MS);
    timers.setInterval(function () { check(false); }, CHECK_EVERY_MS);
  }

  return { start: start, check: check, getStatus: function () { return status; },
    cancelAuto: cancelAuto, installNow: installNow, receiveBackup: receiveBackup };
}

module.exports = { initUpdater };
