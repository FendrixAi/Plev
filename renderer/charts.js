/* Jam Fokus — dependency-free canvas charts (line + dashed forecast + bars).
   The project ships no chart library, so this is the lightest compatible
   solution: it renders dashed series natively, with hover tooltips.
   Exposed as window.JF.charts */
(function (root) {
  'use strict';
  var JF = root.JF = root.JF || {};
  function T(name) { return JF.theme ? JF.theme.css(name) : ''; }
  function bodyFont() { return JF.theme ? JF.theme.bodyFont() : 'sans-serif'; }

  var PAD = { l: 46, r: 14, t: 14, b: 30 };

  function niceMax(v) {
    if (!(v > 0)) return 10;
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    var step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return step * exp;
  }

  function render(canvas, spec) {
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var wrap = canvas.parentElement;
    function size() {
      var w = wrap.clientWidth || 600, h = wrap.clientHeight || 250;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      return { w: w, h: h };
    }
    var ctx = canvas.getContext('2d');
    var tip = null;
    var geom = null;

    function draw() {
      var dim = size();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, dim.w, dim.h);
      var s = spec();
      var labels = s.labels || [];
      var n = labels.length;
      if (!n) {
        ctx.fillStyle = T('--chart-label'); ctx.font = '13px ' + bodyFont(); ctx.textAlign = 'center';
        ctx.fillText(s.emptyText || 'Belum ada data', dim.w / 2, dim.h / 2);
        geom = null; return;
      }
      var series = s.series.filter(function (x) { return x.type !== 'line' || x.values && x.values.some(function (v) { return v != null; }); });
      var maxV = 0;
      series.forEach(function (x) { (x.values || []).forEach(function (v) { if (v != null && v > maxV) maxV = v; }); });
      var yMax = niceMax(Math.max(maxV, s.minMax || 0) * 1.12);

      var iw = dim.w - PAD.l - PAD.r, ih = dim.h - PAD.t - PAD.b;
      var xAt = function (i) { return PAD.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1)); };
      var yAt = function (v) { return PAD.t + ih - (v / yMax) * ih; };

      // gridlines + y labels
      var ticks = 4;
      ctx.strokeStyle = T('--chart-grid'); ctx.lineWidth = 1;
      ctx.fillStyle = T('--chart-label'); ctx.font = '11px ' + bodyFont(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var g = 0; g <= ticks; g++) {
        var v = (yMax / ticks) * g;
        var y = Math.round(yAt(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(dim.w - PAD.r, y); ctx.stroke();
        ctx.fillText(s.yFormat ? s.yFormat(v) : String(Math.round(v)), PAD.l - 8, y);
      }

      // x labels (skip when crowded)
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var stepLbl = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 62))));
      for (var i = 0; i < n; i++) {
        if (i % stepLbl !== 0 && i !== n - 1) continue;
        ctx.fillStyle = (s.markToday != null && i === s.markToday) ? T('--chart-bar') : T('--chart-label');
        ctx.fillText(labels[i], xAt(i), dim.h - PAD.b + 9);
      }

      // "incomplete day" marks (honest data-quality flags)
      if (s.pointNotes) {
        ctx.fillStyle = T('--chart-warn');
        Object.keys(s.pointNotes).forEach(function (k) {
          var i2 = +k; if (!(i2 >= 0 && i2 < n)) return;
          ctx.beginPath(); ctx.arc(xAt(i2), dim.h - PAD.b + 20, 2.5, 0, Math.PI * 2); ctx.fill();
        });
      }

      // today marker
      if (s.markToday != null && s.markToday >= 0 && s.markToday < n) {
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = T('--chart-bar-soft');
        ctx.beginPath(); ctx.moveTo(xAt(s.markToday), PAD.t); ctx.lineTo(xAt(s.markToday), PAD.t + ih); ctx.stroke(); ctx.restore();
      }

      // bar series
      series.filter(function (x) { return x.type === 'bar'; }).forEach(function (x) {
        var bw = Math.min(30, (iw / n) * 0.5);
        (x.values || []).forEach(function (v, i) {
          if (v == null) return;
          var y = yAt(v), y0 = yAt(0);
          ctx.fillStyle = x.color;
          var xi = xAt(i) - bw / 2;
          if (x.hatch && s.pointNotes && s.pointNotes[i]) {
            ctx.save(); ctx.globalAlpha = 0.55;
            ctx.fillRect(xi, y, bw, y0 - y);
            ctx.restore();
          } else {
            ctx.fillRect(xi, y, bw, Math.max(1, y0 - y));
          }
          if (v > 0 && x.showValues && n <= 10) {
            ctx.fillStyle = T('--chart-value'); ctx.font = '11px ' + bodyFont(); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(String(v), xAt(i), y - 4);
          }
        });
      });

      // line series
      series.filter(function (x) { return x.type === 'line'; }).forEach(function (x) {
        var pts = [];
        (x.values || []).forEach(function (v, i) { if (v != null) pts.push([xAt(i), yAt(v)]); });
        if (pts.length > 1) {
          ctx.save();
          ctx.strokeStyle = x.color; ctx.lineWidth = x.width || 2.2;
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          if (x.dashed) ctx.setLineDash([7, 6]);
          ctx.beginPath();
          pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
          ctx.stroke();
          if (x.fill) {
            ctx.lineTo(pts[pts.length - 1][0], yAt(0)); ctx.lineTo(pts[0][0], yAt(0)); ctx.closePath();
            ctx.fillStyle = x.fill; ctx.fill();
          }
          ctx.restore();
        }
        if (x.dots !== false && pts.length && n <= 16) {
          ctx.fillStyle = x.color;
          pts.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill(); });
        }
      });

      geom = { n: n, xAt: xAt, yAt: yAt, labels: labels, spec: s, w: dim.w, h: dim.h };
    }

    function onMove(e) {
      if (!geom) return;
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left;
      var best = 0, bd = Infinity;
      for (var i = 0; i < geom.n; i++) { var d = Math.abs(geom.xAt(i) - mx); if (d < bd) { bd = d; best = i; } }
      var s = geom.spec;
      if (s.onHover && s.onHover(best, geom.xAt(best), e)) return;
      showTip(best, geom.xAt(best));
    }
    function showTip(i, x) {
      var s = geom.spec;
      if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; wrap.appendChild(tip); }
      var rows = s.series.filter(function (x2) { return x2.values && x2.values[i] != null; }).map(function (x2) {
        return '<div class="r"><span class="sw" style="background:' + x2.color + '"></span>' +
          x2.name + '<span class="vv">' + (s.tipFormat ? s.tipFormat(x2.values[i], x2) : x2.values[i]) + '</span></div>';
      }).join('');
      var note = (s.pointNotes && s.pointNotes[i]) ? '<div class="note">' + s.pointNotes[i] + '</div>' : '';
      tip.innerHTML = '<div class="t">' + geom.labels[i] + '</div>' + rows + note;
      tip.style.left = Math.max(80, Math.min(geom.w - 80, x)) + 'px';
      tip.style.top = Math.max(60, (s.tipTop ? s.tipTop(i, geom) : 40)) + 'px';
      tip.style.display = 'block';
    }
    function hideTip() { if (tip) tip.style.display = 'none'; }

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', hideTip);

    var ro = null;
    if (root.ResizeObserver) { ro = new ResizeObserver(function () { draw(); }); ro.observe(wrap); }

    return {
      redraw: draw,
      destroy: function () {
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('mouseleave', hideTip);
        if (ro) ro.disconnect();
        if (tip) tip.remove();
      }
    };
  }

  JF.charts = { render: render, niceMax: niceMax };
})(typeof self !== 'undefined' ? self : this);
