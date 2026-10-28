/* Jam Fokus — validasi berkas cadangan (JSON) sebelum dipulihkan.
   Murni (tanpa DOM) supaya bisa diuji di Node.
   UMD: browser -> window.JF.backup, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./store.js'));
  else root.JF = root.JF || {}, root.JF.backup = factory(root.JF.store);
})(typeof self !== 'undefined' ? self : this, function (store) {
  'use strict';

  var MAX_CHARS = 20 * 1024 * 1024;
  var BAD_KEYS = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function fail(msg) { return { ok: false, error: msg }; }

  /** Cari kunci berbahaya (prototype pollution) tanpa rekursi dalam. */
  function hasBadKey(root) {
    var stack = [root], n = 0;
    while (stack.length) {
      var cur = stack.pop();
      if (++n > 400000) return true;                 // terlalu besar/aneh
      if (Array.isArray(cur)) { for (var i = 0; i < cur.length; i++) if (cur[i] && typeof cur[i] === 'object') stack.push(cur[i]); }
      else if (cur && typeof cur === 'object') {
        var ks = Object.keys(cur);
        for (var j = 0; j < ks.length; j++) {
          if (BAD_KEYS[ks[j]]) return true;
          var v = cur[ks[j]];
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    }
    return false;
  }

  /**
   * @param {string} text  isi berkas
   * @returns {{ok:boolean, error?:string, state?:object, summary?:object}}
   */
  function validate(text) {
    if (typeof text !== 'string' || !text.trim()) return fail('Berkas kosong atau tidak bisa dibaca.');
    if (text.length > MAX_CHARS) return fail('Berkas terlalu besar untuk dipulihkan.');
    var data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { return fail('Berkas bukan JSON yang valid.'); }
    if (!isObj(data) || data.app !== 'jam-fokus' || !isObj(data.state)) return fail('Ini bukan berkas cadangan Jam Fokus.');
    if (hasBadKey(data)) return fail('Berkas berisi data yang tidak aman dan ditolak.');
    var s = data.state;
    if (s.version !== store.SCHEMA_VERSION) return fail('Versi data cadangan (' + s.version + ') tidak didukung. Dibutuhkan versi ' + store.SCHEMA_VERSION + '.');
    var need = ['tasks', 'sessions', 'snapshots'];
    for (var i = 0; i < need.length; i++) if (!Array.isArray(s[need[i]])) return fail('Bagian "' + need[i] + '" pada cadangan rusak.');
    ['events', 'legacyHist'].forEach(function (k) { if (s[k] !== undefined && !Array.isArray(s[k])) s[k] = []; });
    if (s.journals !== undefined && !isObj(s.journals)) return fail('Bagian "journals" pada cadangan rusak.');
    if (isObj(s.journals)) {
      var days = Object.keys(s.journals);
      for (var j = 0; j < days.length; j++) {
        if (!isObj(s.journals[days[j]])) return fail('Ada catatan jurnal yang rusak pada cadangan.');
      }
    }
    if (s.goals !== undefined && !Array.isArray(s.goals)) return fail('Bagian "goals" pada cadangan rusak.');
    if (Array.isArray(s.goals)) {
      for (var g = 0; g < s.goals.length; g++) {
        var gl = s.goals[g];
        if (!isObj(gl) || typeof gl.title !== 'string' || (gl.id !== undefined && typeof gl.id !== 'string')) return fail('Ada goal yang rusak pada cadangan (urutan ke-' + (g + 1) + ').');
        if (gl.milestones !== undefined && !Array.isArray(gl.milestones)) return fail('Milestone pada goal urutan ke-' + (g + 1) + ' rusak.');
        if (gl.taskIds !== undefined && !Array.isArray(gl.taskIds)) return fail('Tautan tugas pada goal urutan ke-' + (g + 1) + ' rusak.');
        var ms = gl.milestones || [];
        for (var mi = 0; mi < ms.length; mi++) {
          if (!isObj(ms[mi]) || typeof ms[mi].title !== 'string' || (ms[mi].taskIds !== undefined && !Array.isArray(ms[mi].taskIds))) {
            return fail('Ada milestone yang rusak pada goal urutan ke-' + (g + 1) + '.');
          }
        }
      }
    }
    for (var t = 0; t < s.tasks.length; t++) {
      var tk = s.tasks[t];
      if (!isObj(tk) || tk.id === undefined || tk.id === null || typeof tk.title !== 'string') return fail('Ada tugas yang rusak pada cadangan (urutan ke-' + (t + 1) + ').');
    }
    for (var q = 0; q < s.sessions.length; q++) if (!isObj(s.sessions[q])) return fail('Ada sesi yang rusak pada cadangan (urutan ke-' + (q + 1) + ').');
    for (var r = 0; r < s.snapshots.length; r++) if (!isObj(s.snapshots[r])) return fail('Ada laporan harian yang rusak pada cadangan (urutan ke-' + (r + 1) + ').');
    if (s.settings !== undefined && !isObj(s.settings)) return fail('Bagian "settings" pada cadangan rusak.');
    if (!isObj(s.settings)) s.settings = {};
    return {
      ok: true, state: s,
      summary: {
        tasks: s.tasks.length, sessions: s.sessions.length, snapshots: s.snapshots.length,
        journals: isObj(s.journals) ? Object.keys(s.journals).length : 0,
        goals: Array.isArray(s.goals) ? s.goals.length : 0,
        exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null
      }
    };
  }

  return { validate: validate, MAX_CHARS: MAX_CHARS };
});
