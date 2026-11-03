/* Jam Fokus — UI pembaruan aplikasi: kartu di Pengaturan + banner kecil.
   Status dikirim proses utama lewat window.desk (lihat updater.js). Sebelum
   memasang, proses utama minta isi data untuk dicadangkan ke disk. */
(function (root) {
  'use strict';
  var JF = root.JF = root.JF || {};
  var desk = root.desk;
  var status = null;
  var views = [];            // { el, compact }
  var banner = null, bannerTimer = null, bannerHiddenFor = null;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmtMB(n) { return (n / 1048576).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MB'; }
  function button(label, onClick, kind) {
    var b = h('button', 'jf-upd-btn' + (kind ? ' ' + kind : ''), label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function bar(pct, ok, drain) {
    var track = h('div', 'jf-upd-bar' + (pct == null ? ' is-indet' : '') + (ok ? ' is-ok' : ''));
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    if (pct != null) track.setAttribute('aria-valuenow', String(Math.round(pct)));
    var fill = h('span', 'jf-upd-fill' + (drain ? ' is-drain' : ''));
    if (pct != null) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    track.appendChild(fill);
    return track;
  }
  function call(name) { try { var r = desk && desk[name] && desk[name](); if (r && r.catch) r.catch(function () {}); } catch (e) {} }

  /** Bangun isi tampilan sesuai status. */
  function fill(el, s, compact) {
    el.textContent = '';
    el.classList.toggle('is-compact', !!compact);
    var live = h('div', 'jf-upd-live');
    live.setAttribute('aria-live', 'polite');
    el.appendChild(live);
    var ver = 'v' + (s.current || '');

    function head(title, sub, icon) {
      var row = h('div', 'jf-upd-head');
      row.appendChild(h('span', 'jf-upd-ico' + (icon ? ' ' + icon : ''), icon === 'is-ok' ? '✓' : icon === 'is-warn' ? '!' : ''));
      var txt = h('div', 'jf-upd-txt');
      txt.appendChild(h('div', 'jf-upd-title', title));
      if (sub) txt.appendChild(h('div', 'jf-upd-sub', sub));
      row.appendChild(txt);
      if (!compact) row.appendChild(h('span', 'jf-upd-chip', ver));
      live.appendChild(row);
    }
    function actions() { var a = h('div', 'jf-upd-actions'); Array.prototype.forEach.call(arguments, function (b) { if (b) a.appendChild(b); }); live.appendChild(a); }
    function safe() {
      if (compact) return;
      live.appendChild(h('div', 'jf-upd-safe', 'Datamu aman: dicadangkan otomatis sebelum pemasangan, dan tidak terhapus saat pembaruan.'));
    }

    switch (s.phase) {
      case 'unsupported':
        head('Pembaruan otomatis tidak aktif', 'Hanya jalan di Jam Fokus yang dipasang lewat file Setup (bukan portable atau mode pengembangan).', 'is-warn');
        break;
      case 'checking':
        head('Memeriksa pembaruan…', 'Menghubungi server rilis.', 'is-spin');
        live.appendChild(bar(null));
        break;
      case 'available':
        head('Versi ' + s.version + ' ditemukan', 'Menyiapkan unduhan…', 'is-spin');
        live.appendChild(bar(null));
        break;
      case 'downloading':
        head('Mengunduh versi ' + s.version, 'Kamu bisa tetap memakai aplikasi seperti biasa.', 'is-spin');
        live.appendChild(bar(s.percent));
        var meta = h('div', 'jf-upd-meta');
        meta.appendChild(h('span', null, Math.round(s.percent) + '%'));
        if (s.total) meta.appendChild(h('span', null, fmtMB(s.transferred) + ' / ' + fmtMB(s.total)));
        if (s.speed) meta.appendChild(h('span', null, fmtMB(s.speed) + '/dtk'));
        live.appendChild(meta);
        break;
      case 'ready':
        if (s.error) {
          head('Pemasangan ditunda', s.error, 'is-warn');
          live.appendChild(bar(100, true));
          actions(button('Coba pasang lagi', function () { call('updateInstall'); }, 'is-primary'));
        } else if (s.waiting) {
          head('Versi ' + s.version + ' siap dipasang', 'Menunggu sesi fokus atau istirahat selesai supaya timermu tidak terputus.', 'is-ok');
          live.appendChild(bar(100, true));
          actions(button('Tunda', function () { call('updateCancel'); }), button('Pasang sekarang', function () { call('updateInstall'); }, 'is-primary'));
        } else if (s.cancelled) {
          head('Versi ' + s.version + ' siap dipasang', 'Pemasangan ditunda. Akan terpasang otomatis saat kamu Keluar dari menu tray.', 'is-ok');
          live.appendChild(bar(100, true));
          actions(button('Pasang sekarang', function () { call('updateInstall'); }, 'is-primary'));
        } else {
          head('Memasang dalam ' + s.countdown + ' detik', 'Aplikasi akan restart sendiri dan data dicadangkan dulu.', 'is-ok');
          live.appendChild(bar(((s.countdown || 0) / (s.countdownTotal || 10)) * 100, true, true));
          actions(button('Batalkan', function () { call('updateCancel'); }), button('Pasang sekarang', function () { call('updateInstall'); }, 'is-primary'));
        }
        break;
      case 'installing':
        head('Memasang versi ' + s.version + '…', s.backupName ? 'Data sudah dicadangkan. Jam Fokus akan terbuka lagi sendiri.' : 'Mencadangkan datamu dulu…', 'is-spin');
        live.appendChild(bar(null, true));
        break;
      case 'uptodate':
        head('Kamu sudah memakai versi terbaru', 'Jam Fokus ' + ver + '. Pembaruan dicek otomatis secara berkala.', 'is-ok');
        actions(button('Cek lagi', function () { call('updateCheck'); }));
        break;
      case 'error':
        head('Gagal memeriksa pembaruan', s.error || 'Coba lagi nanti.', 'is-warn');
        actions(button('Coba lagi', function () { call('updateCheck'); }, 'is-primary'));
        break;
      default:
        head('Jam Fokus ' + ver, 'Pembaruan dicek otomatis tiap beberapa jam, diunduh sendiri, lalu dipasang saat tidak ada sesi berjalan.');
        actions(button('Cek pembaruan', function () { call('updateCheck'); }, 'is-primary'));
    }
    safe();
  }

  /* ── banner kecil (muncul di halaman mana pun saat pembaruan penting) ── */
  function bannerWanted(s) {
    if (!s) return false;
    if (s.phase === 'ready' || s.phase === 'installing') return true;
    return !!s.manual && ['checking', 'available', 'downloading', 'uptodate', 'error'].indexOf(s.phase) >= 0;
  }
  function cardVisible() {
    return views.some(function (v) { return !v.compact && v.el.isConnected; });
  }
  function updateBanner() {
    var key = status && (status.phase + ':' + (status.version || ''));
    var show = bannerWanted(status) && !cardVisible() && bannerHiddenFor !== key;
    clearTimeout(bannerTimer);
    if (!show) { if (banner) banner.hidden = true; return; }
    if (!banner) {
      banner = h('div', 'jf-upd-banner');
      banner.setAttribute('role', 'status');
      document.body.appendChild(banner);
    }
    banner.hidden = false;
    var body = h('div', 'jf-upd is-compact');
    fill(body, status, true);
    banner.textContent = '';
    banner.appendChild(body);
    if (status.phase === 'uptodate' || status.phase === 'error') {
      banner.appendChild(button('Tutup', function () { bannerHiddenFor = key; updateBanner(); }, 'jf-upd-close'));
      bannerTimer = setTimeout(function () { bannerHiddenFor = key; updateBanner(); }, 6000);
    }
  }

  function apply(s) {
    if (!s) return;
    status = s;
    views = views.filter(function (v) { return v.el.isConnected || v.fresh; });
    views.forEach(function (v) { v.fresh = false; fill(v.el, s, v.compact); });
    updateBanner();
  }

  /** Buat tampilan untuk ditempel ke halaman Pengaturan. */
  function mount(compact) {
    var el = h('div', 'jf-upd');
    var view = { el: el, compact: !!compact, fresh: true };
    views.push(view);
    if (!desk || !desk.updateStatus) {
      el.appendChild(h('div', 'jf-upd-sub', 'Pembaruan otomatis hanya tersedia di aplikasi desktop Jam Fokus.'));
      return el;
    }
    if (status) fill(el, status, view.compact);
    else el.appendChild(h('div', 'jf-upd-sub', 'Memuat status pembaruan…'));
    // Status pada saat halaman dibuka (event sebelumnya mungkin sudah lewat).
    try { desk.updateStatus().then(apply).catch(function () {}); } catch (e) {}
    setTimeout(updateBanner, 0);
    return el;
  }

  if (desk && desk.onUpdate) {
    desk.onUpdate(apply);
    if (desk.updateStatus) { try { desk.updateStatus().then(apply).catch(function () {}); } catch (e) {} }
    if (desk.onUpdateOpen) desk.onUpdateOpen(function () { try { root.location.hash = '#pengaturan'; } catch (e) {} });
    if (desk.onUpdatePrepare) {
      desk.onUpdatePrepare(function () {
        var app = JF.app;
        if (!app || !app.rawState) return null;
        return JSON.stringify({ app: 'jam-fokus', exportedAt: new Date().toISOString(), state: app.rawState() });
      });
    }
  }

  JF.updateUI = { mount: mount, _fill: fill };
})(typeof window !== 'undefined' ? window : globalThis);
