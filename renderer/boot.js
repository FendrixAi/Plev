/* Jam Fokus — boot: initialise the app, wire navigation, run the frame loop. */
(function (root) {
  'use strict';
  var JF = root.JF, ui = JF.ui, app = JF.app;
  var mounted = {};
  var currentId = null;

  function pageIdFromHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (h && JF.pages.get(h)) return h;
    return 'beranda';
  }

  function showPage(id) {
    var p = JF.pages.get(id);
    if (!p) id = 'beranda', p = JF.pages.get('beranda');
    if (!p) return;
    currentId = id;

    JF.pages.list.forEach(function (x) {
      var sec = document.getElementById('page-' + x.id);
      if (sec) sec.hidden = x.id !== id;
    });
    document.querySelectorAll('#nav button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-page') === id);
      b.setAttribute('aria-current', b.getAttribute('data-page') === id ? 'page' : 'false');
    });

    var sec = document.getElementById('page-' + id);
    if (sec && !mounted[id]) { p.mount && p.mount(sec); mounted[id] = true; }
    refreshTopbar(p);
    if (sec && p.render) { try { p.render(sec); } catch (e) { console.error('[render:' + id + ']', e); showError(sec, e); } }
    sec && (sec.scrollTop = 0);
    document.getElementById('content').scrollTop = 0;
  }

  function refreshTopbar(p) {
    p = p || JF.pages.get(currentId);
    if (!p) return;
    document.getElementById('pageTitle').textContent = p.title || '';
    var sub = typeof p.sub === 'function' ? p.sub() : (p.sub || '');
    document.getElementById('pageSub').textContent = sub;
    var ta = ui.clear(document.getElementById('topActions'));
    if (p.actions) { try { p.actions(ta); } catch (e) { console.error('[actions]', e); } }
  }

  function showError(sec, e) {
    var box = ui.el('div.error-box');
    box.appendChild(ui.el('div', 'Terjadi kesalahan saat menampilkan halaman ini.'));
    box.appendChild(ui.el('div.hint', { style: { color: 'inherit', marginTop: '6px' } }, String((e && e.stack) || e)));
    sec.insertBefore(box, sec.firstChild);
  }

  function refreshBadges() {
    var b = document.getElementById('badge-tugas');
    if (!b) return;
    var n = app.todayStats().overdue;
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n);
  }

  /* ── sidebar collapse ─────────────────────────────────────────── */
  function initSidebar() {
    var collapsed = false;
    try { collapsed = localStorage.getItem('jamfokus.ui.collapsed') === '1'; } catch (e) {}
    var appEl = document.getElementById('app');
    appEl.classList.toggle('collapsed', collapsed);
    var tog = document.getElementById('navToggle');
    tog.setAttribute('aria-expanded', String(!collapsed));
    tog.addEventListener('click', function () {
      var on = appEl.classList.toggle('collapsed');
      try { localStorage.setItem('jamfokus.ui.collapsed', on ? '1' : '0'); } catch (e) {}
      tog.setAttribute('aria-expanded', String(!on));
    });
    document.querySelectorAll('#nav button').forEach(function (b) {
      b.addEventListener('click', function () { location.hash = '#' + b.getAttribute('data-page'); });
    });
    document.getElementById('miniBtn').addEventListener('click', function () {
      if (root.desk && root.desk.mini) root.desk.mini(true);
    });
  }

  /* ── frame loop: clock hands + live countdown on the active page ── */
  function frame(ts) {
    var p = JF.pages.current && JF.pages.current;
    var cur = JF.pages.get(currentId);
    if (cur && cur.frame) { try { cur.frame(ts); } catch (e) { /* don't kill the loop */ } }
    requestAnimationFrame(frame);
  }

  /* ── init ─────────────────────────────────────────────────────── */
  function start() {
    initSidebar();

    var info;
    try { info = app.init(); }
    catch (e) {
      console.error('[init]', e);
      document.getElementById('content').appendChild(ui.el('div.error-box',
        'Gagal memuat data aplikasi: ' + String((e && e.message) || e)));
      return;
    }

    window.addEventListener('hashchange', function () { showPage(pageIdFromHash()); });
    showPage(pageIdFromHash());

    app.on('change', function () {
      refreshBadges();
      refreshTopbar();
      // Re-render the visible page (pages render on show + on data changes).
      var p = JF.pages.get(currentId);
      var sec = currentId && document.getElementById('page-' + currentId);
      if (p && sec && !sec.hidden && p.render && mounted[currentId]) {
        try { p.render(sec); } catch (e) { console.error('[rerender:' + currentId + ']', e); }
      }
    });
    refreshBadges();

    if (info && info.migrated) {
      ui.toast('Data lama dimigrasi ke skema baru' + (info.backupWritten ? ' — cadangan tersimpan di kunci jamfokus.v1.backup.' : '.'), { timeout: 9000 });
    }
    if (info && info.backfilled && info.backfilled.length) {
      ui.toast(info.backfilled.length + ' laporan harian lama dirangkum dari catatan yang ada.', { timeout: 8000 });
    }

    requestAnimationFrame(frame);
    setInterval(function () { refreshTopbar(); }, 5000);

    // Crash/shutdown recovery question (paused first — never auto-running).
    if (info && info.recovered && info.recovered.length) {
      setTimeout(function () { app.recoverPrompt(info.recovered); }, 450);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof self !== 'undefined' ? self : this);
