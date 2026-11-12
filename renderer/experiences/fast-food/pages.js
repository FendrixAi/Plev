/* Fast Food: pengarah halaman.
   Beranda dibuat khusus (beranda.js). Halaman lain (fase 1) memakai logika dan markup Original langsung
   (JF.pages.get(id).mount/render/frame) di dalam panggung diner, jadi fitur selalu sama dengan Original dan fitur baru
   Original otomatis ikut. Kulitnya diatur di fastfood.css; fase berikutnya mendesain ulang halaman satu per satu. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var hosts = {}, mounted = {};

  function hostFor(id, parent) {
    if (hosts[id] && hosts[id].parentNode === parent) return hosts[id];
    var h = document.createElement(id === 'beranda' ? 'div' : 'section');
    h.className = id === 'beranda' ? 'ff-page-host ff-home-host' : 'page ff-page-host ff-orig-host';
    h.dataset.page = id; h.hidden = true;
    parent.appendChild(h);
    hosts[id] = h;
    if (id === 'kalender') {
      h.addEventListener('click', function (e) {
        if (!e.target.closest || !e.target.closest('.cal-cell')) return;
        setTimeout(function () {
          var p = h.querySelector('.day-panel');
          if (p && p.scrollIntoView) { try { p.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (err) { /* no-op */ } }
        }, 80);
      });
    }
    return h;
  }

  function headExtras(p) {
    var sub = document.querySelector('.ff-sub-line'), act = document.querySelector('.ff-head-actions');
    if (sub) sub.textContent = !p ? '' : (typeof p.sub === 'function' ? p.sub() : (p.sub || ''));
    if (act) {
      JF.ui.clear(act);
      if (p && p.actions) { try { p.actions(act); } catch (e) { console.error('[ff actions]', e); } }
    }
  }

  function render(id, parent) {
    var ui = JF.ui;
    Object.keys(hosts).forEach(function (k) { hosts[k].hidden = k !== id; });
    var host = hostFor(id, parent);
    host.hidden = false;
    if (id === 'beranda') { headExtras(null); JF.ffHome.render(host); return; }
    var p = JF.pages.get(id);
    if (!p) { host.textContent = 'Halaman tidak ditemukan.'; return; }
    try {
      if (!mounted[id]) { p.mount && p.mount(host); mounted[id] = true; }
      headExtras(p);
      if (p.render) p.render(host);
    } catch (e) {
      console.error('[ff render:' + id + ']', e);
      ui.clear(host);
      host.appendChild(ui.el('div.error-box', ui.el('strong', 'Halaman gagal dimuat'), ui.el('p', String(e && e.message || e))));
    }
    parent.scrollTop = 0;
  }

  function frame(id, ts) {
    if (id === 'beranda') { if (JF.ffHome) JF.ffHome.frame(); return; }
    var p = JF.pages.get(id);
    if (p && p.frame && mounted[id]) { try { p.frame(ts); } catch (e) { /* frame tidak boleh menjatuhkan loop */ } }
  }

  JF.ffPages = { render: render, frame: frame };
})(typeof self !== 'undefined' ? self : this);
