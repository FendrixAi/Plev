/* Jam Fokus — date helpers (local calendar dates, no UTC drift).
   UMD: browser -> window.JF.dates, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JF = root.JF || {}, root.JF.dates = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Local calendar day key 'YYYY-MM-DD' for a timestamp. */
  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** Parse 'YYYY-MM-DD' -> {y,m,d} or null when invalid. */
  function parseDay(k) {
    if (typeof k !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var probe = new Date(y, mo - 1, d);
    if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
    return { y: y, m: mo, d: d };
  }

  function isDayKey(k) { return parseDay(k) !== null; }

  /** Add n days to a day key (local, DST-safe via Date arithmetic). */
  function addDays(k, n) {
    var p = parseDay(k);
    if (!p) return null;
    var d = new Date(p.y, p.m - 1, p.d + n);
    return dayKey(d.getTime());
  }

  /** Today's local day key. */
  function todayKey() { return dayKey(Date.now()); }

  /** Whole-day difference b - a for two day keys. */
  function diffDays(a, b) {
    var pa = parseDay(a), pb = parseDay(b);
    if (!pa || !pb) return NaN;
    var ta = new Date(pa.y, pa.m - 1, pa.d).getTime();
    var tb = new Date(pb.y, pb.m - 1, pb.d).getTime();
    return Math.round((tb - ta) / 86400000);
  }

  /** Timestamp at local midnight of a day key (+ optional ms). */
  function startOfDay(k) {
    var p = parseDay(k);
    if (!p) return NaN;
    return new Date(p.y, p.m - 1, p.d).getTime();
  }

  /** Inclusive list of day keys from a to b. */
  function dayRange(a, b) {
    var out = [], cur = a, guard = 0;
    while (isDayKey(cur) && diffDays(cur, b) >= 0 && guard++ < 4000) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }

  /** Build a local calendar day key from y/m/d; null for impossible dates. */
  function buildDay(y, m, d) {
    var y2 = Number(y), m2 = Number(m), d2 = Number(d);
    if (!isFinite(y2) || !isFinite(m2) || !isFinite(d2)) return null;
    var dt = new Date(y2, m2 - 1, d2);
    if (dt.getFullYear() !== y2 || dt.getMonth() !== m2 - 1 || dt.getDate() !== d2) return null;
    return dayKey(dt.getTime());
  }

  return {
    dayKey: dayKey, parseDay: parseDay, isDayKey: isDayKey, addDays: addDays,
    todayKey: todayKey, diffDays: diffDays, startOfDay: startOfDay, dayRange: dayRange, pad: pad,
    buildDay: buildDay
  };
});
