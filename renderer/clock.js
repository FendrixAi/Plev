/* Jam Fokus — analog focus clock.
   Face with numbers 1–12, functional hands, and a circular progress ring
   drawn OUTSIDE the dial so it never obscures numbers or hands.
   Exposed as window.JF.clock */
(function (root) {
  'use strict';
  var JF = root.JF = root.JF || {};
  var NS = 'http://www.w3.org/2000/svg';
  var C = 2 * Math.PI * 94;   // ring circumference (r=94, outside the r=86 face)

  function n(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function build() {
    var svg = n('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': 'Jam analog' });

    // Progress ring (outside everything else)
    svg.appendChild(n('circle', { cx: 100, cy: 100, r: 94, fill: 'none', stroke: '#242836', 'stroke-width': 7 }));
    var ring = n('circle', {
      cx: 100, cy: 100, r: 94, fill: 'none', stroke: '#E58B96', 'stroke-width': 7,
      'stroke-linecap': 'round', 'stroke-dasharray': C.toFixed(1), 'stroke-dashoffset': C.toFixed(1),
      transform: 'rotate(-90 100 100)', id: 'ringProgress'
    });
    svg.appendChild(ring);

    // Dial
    svg.appendChild(n('circle', { cx: 100, cy: 100, r: 86, fill: '#1E212C', stroke: '#313648', 'stroke-width': 1.5 }));

    // Ticks
    var g = n('g', { id: 'ticks' });
    for (var i = 0; i < 60; i++) {
      var a = i * 6 * Math.PI / 180, big = i % 5 === 0;
      var r1 = big ? 74 : 79, r2 = 83;
      g.appendChild(n('line', {
        x1: (100 + r1 * Math.sin(a)).toFixed(2), y1: (100 - r1 * Math.cos(a)).toFixed(2),
        x2: (100 + r2 * Math.sin(a)).toFixed(2), y2: (100 - r2 * Math.cos(a)).toFixed(2),
        stroke: big ? '#A5A9B7' : '#767B8B', 'stroke-width': big ? 2.6 : 1,
        opacity: big ? 1 : 0.4
      }));
    }
    svg.appendChild(g);

    // Numbers 1–12 (required to stay visible)
    for (var num = 1; num <= 12; num++) {
      var b = num * 30 * Math.PI / 180;
      var t = n('text', {
        x: (100 + 58 * Math.sin(b)).toFixed(2), y: (100 - 58 * Math.cos(b)).toFixed(2),
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 17, 'font-weight': 650, fill: num % 3 === 0 ? '#F2F2F5' : '#C9CCD6',
        'font-family': 'inherit'
      });
      t.textContent = num;
      svg.appendChild(t);
    }

    // Hands
    var hh = n('line', { x1: 100, y1: 100, x2: 100, y2: 56, stroke: '#F2F2F5', 'stroke-width': 6, 'stroke-linecap': 'round', id: 'hh' });
    var mh = n('line', { x1: 100, y1: 100, x2: 100, y2: 34, stroke: '#A5A9B7', 'stroke-width': 4, 'stroke-linecap': 'round', id: 'mh' });
    var sh = n('line', { x1: 100, y1: 112, x2: 100, y2: 26, stroke: '#E58B96', 'stroke-width': 2, 'stroke-linecap': 'round', id: 'sh' });
    svg.appendChild(hh); svg.appendChild(mh); svg.appendChild(sh);
    svg.appendChild(n('circle', { cx: 100, cy: 100, r: 5.5, fill: '#E58B96' }));
    svg.appendChild(n('circle', { cx: 100, cy: 100, r: 2, fill: '#1E212C' }));

    return { svg: svg, ring: ring, hh: hh, mh: mh, sh: sh };
  }

  function mount(container) {
    var parts = build();
    container.appendChild(parts.svg);
    return {
      svg: parts.svg,
      /** progress01: elapsed portion of the current session (null = idle). */
      setProgress: function (p) {
        if (p == null || !isFinite(p)) { parts.ring.setAttribute('stroke-dashoffset', C.toFixed(1)); return; }
        p = Math.max(0, Math.min(1, p));
        parts.ring.setAttribute('stroke-dashoffset', (C * (1 - p)).toFixed(1));
      },
      setRunning: function (on) { parts.ring.setAttribute('stroke', on ? '#E58B96' : '#3B4157'); },
      /** Wall-clock hands; called every animation frame. */
      hands: function (d) {
        d = d || new Date();
        var sec = d.getSeconds() + d.getMilliseconds() / 1000;
        var min = d.getMinutes() + sec / 60;
        var hr = (d.getHours() % 12) + min / 60;
        parts.sh.setAttribute('transform', 'rotate(' + (sec * 6) + ' 100 100)');
        parts.mh.setAttribute('transform', 'rotate(' + (min * 6) + ' 100 100)');
        parts.hh.setAttribute('transform', 'rotate(' + (hr * 30) + ' 100 100)');
      }
    };
  }

  JF.clock = { mount: mount };
})(typeof self !== 'undefined' ? self : this);
