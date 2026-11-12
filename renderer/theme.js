/* Jam Fokus — mode terang/gelap. Tema disimpan di localStorage ('jamfokus.theme');
   bila belum pernah dipilih, mengikuti pengaturan sistem. Exposed as JF.theme */
(function (root) {
  'use strict';
  var JF = root.JF = root.JF || {};
  var KEY = 'jamfokus.theme';
  var mode = 'light';

  function stored() {
    try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (e) { return null; }
  }
  function system() {
    return root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function paintToggle() {
    var b = document.getElementById('themeToggle');
    if (!b) return;
    var dark = mode === 'dark';
    b.setAttribute('aria-pressed', String(dark));
    var label = dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap';
    b.setAttribute('aria-label', label);
    b.title = label;
  }
  function apply(m, persist, notify) {
    var run = function () {
      mode = m === 'dark' ? 'dark' : 'light';
      // Mola World hanya punya mode siang: atribut tetap 'light' walau pilihan/sistem gelap.
      document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-experience') === 'mola-world' ? 'light' : mode);
      if (persist) { try { localStorage.setItem(KEY, mode); } catch (e) {} }
      if (root.desk && root.desk.setTheme) { try { root.desk.setTheme(mode); } catch (e) {} }
      paintToggle();
      // Grafik (canvas) membaca warna saat digambar: render ulang halaman aktif.
      if (notify && JF.app && JF.app.emit) { try { JF.app.emit('change'); } catch (e) {} }
    };
    // Fast Food menganimasikan perpindahan siang/malam (View Transitions); experience lain langsung berganti.
    if (notify && JF.themeTransition && JF.themeTransition.run) JF.themeTransition.run(run); else run();
  }

  JF.theme = {
    get: function () { return mode; },
    set: function (m) { apply(m, true, true); },
    toggle: function () { apply(mode === 'dark' ? 'light' : 'dark', true, true); },
    /** Nilai variabel CSS saat ini, mis. css('--chart-ok'). */
    css: function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); },
    bodyFont: function () { return getComputedStyle(document.body).fontFamily || 'sans-serif'; }
  };

  apply(stored() || system(), false, false);
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('themeToggle');
    if (b) b.addEventListener('click', function () { JF.theme.toggle(); });
    paintToggle();
  });
  // Ikuti perubahan tema sistem selama pengguna belum memilih sendiri.
  if (root.matchMedia) {
    var mq = root.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!stored()) apply(system(), false, true); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }
})(window);
