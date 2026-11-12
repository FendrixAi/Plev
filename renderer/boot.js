/* Jam Fokus — boot: initialise the app, wire navigation, run the frame loop. */
(function (root) {
  'use strict';
  var JF = root.JF, ui = JF.ui, app = JF.app;
  var mounted = {};
  var currentId = null;
  var activeExperience = null;

  function isCapybaraWorld() {
    return JF.homeExperience && JF.homeExperience.get() === 'capybara-world';
  }

  function isMolaWorld() {
    return JF.homeExperience && JF.homeExperience.get() === 'mola-world';
  }

  function isFastFood() {
    return JF.homeExperience && JF.homeExperience.get() === 'fast-food';
  }

  function selectedExperienceId() {
    return isCapybaraWorld() ? 'capybara-world' : isMolaWorld() ? 'mola-world' : isFastFood() ? 'fast-food' : 'original';
  }

  function pageIdFromHash() {
    var h = (location.hash || '').replace(/^#/, '').split('?')[0];
    if (h && JF.pages.get(h)) return h;
    return 'beranda';
  }

  function showPage(id) {
    var p = JF.pages.get(id);
    if (!p) id = 'beranda', p = JF.pages.get('beranda');
    if (!p) return;
    currentId = id;

    var capybaraWorld = isCapybaraWorld();
    var molaWorld = isMolaWorld();
    var fastFood = isFastFood();
    activeExperience = selectedExperienceId();
    if (JF.experiences && JF.experiences.capybaraWorld) {
      JF.experiences.capybaraWorld.setActive(capybaraWorld);
    }
    if (JF.experiences && JF.experiences.molaWorld) {
      JF.experiences.molaWorld.setActive(molaWorld);
    }
    if (JF.experiences && JF.experiences.fastFood) {
      JF.experiences.fastFood.setActive(fastFood);
    }
    if (capybaraWorld) {
      JF.experiences.capybaraWorld.render(id);
      return;
    }
    if (molaWorld) {
      JF.experiences.molaWorld.render(id);
      return;
    }
    if (fastFood) {
      JF.experiences.fastFood.render(id);
      return;
    }

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
    var pref = false;                      // pilihan yang disimpan pengguna
    try { pref = localStorage.getItem('jamfokus.ui.collapsed') === '1'; } catch (e) {}
    var appEl = document.getElementById('app');
    var tog = document.getElementById('navToggle');
    var narrow = window.matchMedia ? window.matchMedia('(max-width: 900px)') : { matches: false };

    function paintToggle(on) {
      var label = on ? 'Buka navigasi (Ctrl+B)' : 'Ciutkan navigasi (Ctrl+B)';
      tog.setAttribute('aria-expanded', String(!on));
      tog.setAttribute('aria-label', label);
      tog.title = label;
    }
    function setCollapsed(on) {
      appEl.classList.toggle('collapsed', on);
      paintToggle(on);
    }
    // Di jendela sempit sidebar otomatis terlipat agar isi tidak meluber.
    // Pilihan tersimpan baru dipakai lagi saat jendela cukup lebar.
    setCollapsed(narrow.matches ? true : pref);
    if (narrow.addEventListener) narrow.addEventListener('change', function () { setCollapsed(narrow.matches ? true : pref); });

    function toggleSidebar() {
      var on = !appEl.classList.contains('collapsed');
      setCollapsed(on);
      if (!narrow.matches) {
        pref = on;
        try { localStorage.setItem('jamfokus.ui.collapsed', on ? '1' : '0'); } catch (e) {}
      }
    }
    tog.addEventListener('click', toggleSidebar);
    // Pintasan keyboard Ctrl+B (seperti di VS Code) selalu tersedia
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && !ev.altKey && (ev.key === 'b' || ev.key === 'B')) {
        ev.preventDefault(); toggleSidebar();
      }
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
    if (activeExperience === 'capybara-world') {
      if (JF.experiences && JF.experiences.capybaraWorld) JF.experiences.capybaraWorld.frame(ts);
    } else if (activeExperience === 'mola-world') {
      if (JF.experiences && JF.experiences.molaWorld) JF.experiences.molaWorld.frame(ts);
    } else if (activeExperience === 'fast-food') {
      if (JF.experiences && JF.experiences.fastFood) JF.experiences.fastFood.frame(ts);
    } else if (cur && cur.frame) { try { cur.frame(ts); } catch (e) { /* don't kill the loop */ } }
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
      var selectedExperience = selectedExperienceId();
      if (selectedExperience !== activeExperience) {
        showPage(currentId || pageIdFromHash());
        return;
      }
      if (selectedExperience === 'capybara-world') {
        JF.experiences.capybaraWorld.refresh(currentId || pageIdFromHash());
        return;
      }
      if (selectedExperience === 'mola-world') {
        JF.experiences.molaWorld.refresh(currentId || pageIdFromHash());
        return;
      }
      if (selectedExperience === 'fast-food') {
        JF.experiences.fastFood.refresh(currentId || pageIdFromHash());
        return;
      }
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
      ui.toast('Data lama berhasil dipindahkan ke format baru' + (info.backupWritten ? '. Salinan cadangan disimpan otomatis.' : '.'), { timeout: 9000 });
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
