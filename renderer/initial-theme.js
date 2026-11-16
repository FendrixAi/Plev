/* Terapkan tema dan experience sebelum CSS dimuat untuk menghindari kilatan warna.
   File terpisah agar CSP tidak perlu mengizinkan script inline. */
(function () {
  'use strict';
  try {
    var stored = localStorage.getItem('jamfokus.theme');
    var mode = stored === 'dark' || stored === 'light'
      ? stored
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var exp = localStorage.getItem('jamfokus.homeExperience');
    exp = exp === 'capybara-world' || exp === 'mola-world' || exp === 'fast-food' ? exp : 'original';
    var root = document.documentElement;
    root.setAttribute('data-experience', exp);
    root.setAttribute('data-theme', exp === 'mola-world' ? 'light' : mode);
  } catch (e) {
    document.documentElement.setAttribute('data-experience', 'original');
  }
})();
