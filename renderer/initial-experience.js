/* Matikan stylesheet Original sebelum paint bila Capybara World aktif.
   File terpisah agar CSP tidak perlu mengizinkan script inline. */
(function () {
  'use strict';
  if (document.documentElement.getAttribute('data-experience') !== 'capybara-world') return;
  var link = document.getElementById('original-theme');
  if (link) link.disabled = true;
})();
