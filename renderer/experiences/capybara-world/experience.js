/* Capybara World owns its shell and route rendering; Original pages are never mounted here. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var active = false;
  var shell;
  var content;
  var currentId = 'beranda';

  var routes = [
    ['beranda', 'Beranda', 'M4 10.5 12 4l8 6.5V20H4z', 'M9 20v-6h6v6'],
    ['tugas', 'Tugas', 'M5 4h14v16H5z', 'm8 12 2.5 2.5L16 9'],
    ['kalender', 'Kalender', 'M4 6h16v15H4z', 'M8 3v6M16 3v6M4 10h16'],
    ['analitik', 'Analitik', 'M4 20V4M4 20h17', 'm7 15 4-5 3 2 5-7'],
    ['riwayat', 'Riwayat fokus', 'M20 12a8 8 0 1 1-2.4-5.7', 'M12 7v5l3 2'],
    ['laporan', 'Laporan harian', 'M6 3h9l4 4v14H6z', 'M9 12h7M9 16h7'],
    ['goals', 'Goals', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 7v10m-5-5h10'],
    ['jurnal', 'Journaling', 'M5 3h14v18H5z', 'M8 8h8M8 12h8M8 16h5'],
    ['pengaturan', 'Pengaturan', 'M4 7h16M4 17h16', 'M9 7a2 2 0 1 0 0 .1M15 17a2 2 0 1 0 0 .1'],
    ['library', 'Library', 'M4 4h7v16H4zM13 4h7v16h-7z', 'M6 8h3m6 0h3']
  ];

  function capyArt() {
    return '<svg viewBox="0 0 120 100" role="img" aria-label="Kapibara menemani sesi produktif" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M7 86q24-13 48 0 25-13 58 0v9H7z" fill="#ead1ad"/>' +
      '<path d="M32 77q0-30 28-31 28 1 29 31v9H32z" fill="#c77d48"/>' +
      '<ellipse cx="43" cy="48" rx="8" ry="12" fill="#b56b3e"/><ellipse cx="77" cy="48" rx="8" ry="12" fill="#b56b3e"/>' +
      '<ellipse cx="43" cy="49" rx="4" ry="7" fill="#f0be89"/><ellipse cx="77" cy="49" rx="4" ry="7" fill="#f0be89"/>' +
      '<ellipse cx="60" cy="70" rx="27" ry="21" fill="#e8b67e"/><circle cx="50" cy="64" r="2" fill="#49352d"/>' +
      '<circle cx="70" cy="64" r="2" fill="#49352d"/><ellipse cx="60" cy="70" rx="5" ry="3.5" fill="#49352d"/>' +
      '<path d="M55 77q5 4 10 0" fill="none" stroke="#75543e" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="42" cy="74" r="4" fill="#e58d78"/><circle cx="78" cy="74" r="4" fill="#e58d78"/>' +
      '<path d="m18 26 4 9 10 2-8 6 2 10-8-6-9 5 3-10-8-6 10-2z" fill="#f2c56e"/></svg>';
  }

  function makeShell() {
    if (shell) return;
    shell = document.createElement('div');
    shell.className = 'cw-app-shell';
    shell.innerHTML = '<aside class="cw-rail"><div class="cw-brand"><span class="cw-brand-art">' + capyArt() +
      '</span><span><b>Capybara<br>World</b><small>ruang kecil, fokus besar</small></span></div>' +
      '<nav class="cw-route-list" aria-label="Navigasi produktivitas"></nav>' +
      '<div class="cw-rail-foot"><button class="cw-mini" type="button">Buka kartu mini</button><span>Pelan-pelan, tetap maju.</span></div></aside>' +
      '<section class="cw-main"><header class="cw-top"><div><span class="cw-date-line"></span><h1 class="cw-page-title"></h1></div>' +
      '<div class="cw-top-actions"><button class="cw-theme" type="button" aria-label="Ganti tema warna"></button></div></header>' +
      '<main class="cw-content"></main></section>';
    var nav = shell.querySelector('.cw-route-list');
    routes.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cw-route';
      button.dataset.page = item[0];
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + item[2] +
        '"/><path d="' + item[3] + '"/></svg><span>' + item[1] + '</span>';
      button.addEventListener('click', function () { root.location.hash = '#' + item[0]; });
      nav.appendChild(button);
    });
    shell.querySelector('.cw-mini').addEventListener('click', function () {
      if (root.desk && root.desk.mini) root.desk.mini(true);
    });
    shell.querySelector('.cw-theme').addEventListener('click', function () { JF.theme.toggle(); });
    content = shell.querySelector('.cw-content');
    document.getElementById('app').appendChild(shell);
  }

  function setActive(value) {
    active = !!value;
    var app = document.getElementById('app');
    var originalStyles = document.getElementById('original-theme');
    app.classList.toggle('capybara-world-active', active);
    document.documentElement.setAttribute('data-experience', active ? 'capybara-world' : 'original');
    if (originalStyles) originalStyles.disabled = active;
    if (active) makeShell();
    if (shell) shell.hidden = !active;
  }

  function updateHeader(id) {
    var route = routes.filter(function (item) { return item[0] === id; })[0];
    if (!route) return;
    shell.querySelector('.cw-page-title').textContent = route[1];
    shell.querySelector('.cw-date-line').textContent = JF.ui.fmt.dateLong(JF.dates.startOfDay(JF.app.today()));
    shell.querySelectorAll('.cw-route').forEach(function (button) {
      var selected = button.dataset.page === id;
      button.classList.toggle('is-current', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
    });
  }

  function render(id) {
    if (!active) return;
    currentId = id;
    makeShell();
    updateHeader(id);
    JF.capybaraPages.render(id, content);
    shell.hidden = false;
  }

  function frame(ts) {
    if (active && JF.capybaraPages && JF.capybaraPages.frame) JF.capybaraPages.frame(currentId, ts);
  }

  JF.experiences = JF.experiences || {};
  JF.experiences.capybaraWorld = {
    setActive: setActive,
    render: render,
    frame: frame
  };
})(window);
