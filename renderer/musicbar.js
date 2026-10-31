/* Jam Fokus — global music bar. Shown on every page while a playlist session
   exists, so the player stays reachable on the break timer and anywhere else.
   It only reads JF.app.music and calls its methods; it owns no audio. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var box = null, built = false;

  function btn(label, onClick, cls) {
    return JF.ui.btn(label, onClick, { sm: true, ghost: cls !== 'primary', primary: cls === 'primary' });
  }
  function render() {
    if (!box) return;
    var m = JF.app && JF.app.music, st = m && m.status;
    JF.ui.clear(box);
    if (!st || !st.active) { box.hidden = true; return; }
    box.hidden = false;
    var t = st.track;
    var info = JF.ui.el('div.mb-info');
    info.appendChild(JF.ui.el('span.mb-ico', { 'aria-hidden': 'true' }, '♪'));
    var txt = JF.ui.el('div.mb-text');
    txt.appendChild(JF.ui.el('div.mb-state', st.paused ? 'Musik dijeda' : 'Sedang diputar'));
    txt.appendChild(JF.ui.el('div.mb-title', t ? t.name : '—'));
    if (st.count > 1) txt.appendChild(JF.ui.el('div.mb-sub', 'Lagu ' + (st.index + 1) + ' dari ' + st.count));
    info.appendChild(txt);
    box.appendChild(info);
    var acts = JF.ui.el('div.mb-acts');
    acts.appendChild(btn(st.paused ? 'Lanjutkan' : 'Jeda', function () { m.togglePause(); }));
    var nx = btn('Berikutnya', function () { m.next(); });
    nx.dataset.act = 'next';
    acts.appendChild(nx);
    var stop = JF.ui.btn('Hentikan Musik', function () { m.stopAllMusic(); }, { sm: true, danger: true });
    stop.dataset.act = 'stop';
    acts.appendChild(stop);
    box.appendChild(acts);
  }
  function init() {
    if (built) return; built = true;
    box = document.getElementById('musicBar');
    if (!box || !JF.app) return;
    JF.app.on('music', render);          // registered once
    render();
  }
  JF.musicBar = { init: init, render: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof self !== 'undefined' ? self : this);
