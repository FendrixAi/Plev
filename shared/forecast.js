/* Jam Fokus — simple, explainable forecast.
   - Uses unique active (incomplete, non-archived) tasks only.
   - Rate = first-completions per ACTIVE day, where an active day is a
     FINALIZED, COMPLETE snapshot with any recorded activity.
   - Incomplete or missing days are never treated as zero-productivity days.
   - Requires >= 5 active days before showing any number.
   UMD: browser -> window.JF.forecast, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'), require('./store.js'));
  else root.JF = root.JF || {}, root.JF.forecast = factory(root.JF.dates, root.JF.store);
})(typeof self !== 'undefined' ? self : this, function (dates, store) {
  'use strict';

  var MIN_ACTIVE_DAYS = 5;

  function hasActivity(snap) {
    return snap.completedTaskIds.length > 0 || snap.unfinishedTaskIds.length > 0 ||
      snap.officialFocusSec > 0 || snap.interruptedFocusSec > 0;
  }

  /** Active days = finalized, complete snapshots with real activity. */
  function activeDays(state) {
    return state.snapshots.filter(function (s) { return s.complete && hasActivity(s); });
  }

  /**
   * Returns a fully-described forecast object (never throws, no NaN/Infinity):
   * { ready, reason, minDays, activeDays, ratePerDay, forecast7, etaDate,
   *   etaDays, activeCount, allDone }
   */
  function compute(state, today, opts) {
    opts = opts || {};
    var minDays = opts.minActiveDays || MIN_ACTIVE_DAYS;
    var days = activeDays(state);
    var active = store.activeTasks(state, today);   // due today or overdue
    var upcoming = store.upcomingTasks(state, today);
    var remainingCount = active.length + upcoming.length;

    var base = {
      ready: false, reason: null, minDays: minDays,
      activeDays: days.length, ratePerDay: null,
      forecast7: null, etaDate: null, etaDays: null,
      activeCount: active.length, upcomingCount: upcoming.length,
      remainingCount: remainingCount, allDone: remainingCount === 0
    };

    if (days.length < minDays) {
      base.reason = 'insufficient-history';
      return base;
    }

    var completions = 0;
    days.forEach(function (s) { completions += s.completedTaskIds.length; });
    var rate = completions / days.length;          // may legitimately be 0
    base.ratePerDay = Math.round(rate * 100) / 100;
    base.ready = true;

    if (remainingCount === 0) {
      base.reason = 'no-active-tasks';             // do not invent a date
      base.forecast7 = 0;
      return base;
    }

    // 7-day forecast of expected completions (approximate, not a promise).
    base.forecast7 = Math.round(rate * 7 * 10) / 10;

    if (rate <= 0) {
      base.reason = 'zero-rate';                   // guard: no division by zero
      return base;
    }

    var daysNeeded = Math.ceil(remainingCount / rate);
    base.etaDays = daysNeeded;
    base.etaDate = dates.addDays(today, daysNeeded);
    return base;
  }

  /** Human-readable Indonesian summary for the UI. */
  function describe(f) {
    if (!f.ready) {
      return {
        title: 'Belum cukup data',
        body: 'Perkiraan membutuhkan minimal ' + f.minDays +
          ' hari aktif dengan catatan lengkap agar angkanya bisa dipercaya. ' +
          'Hari tanpa catatan lengkap tidak dihitung sebagai hari tanpa produktivitas.'
      };
    }
    if (f.allDone) {
      return { title: 'Semua task aktif selesai', body: 'Tidak ada task aktif tersisa, jadi tidak ada perkiraan tanggal selesai.' };
    }
    if (f.reason === 'zero-rate') {
      return {
        title: 'Belum ada laju penyelesaian',
        body: 'Rata-rata penyelesaian 0 task/hari dari ' + f.activeDays +
          ' hari aktif, sehingga tanggal selesai tidak bisa diperkirakan.'
      };
    }
    return {
      title: 'Perkiraan 7 hari ke depan: ± ' + f.forecast7 + ' task',
      body: 'Berdasar laju rata-rata ' + f.ratePerDay + ' task/hari dari ' + f.activeDays +
        ' hari aktif. Sisa ' + f.remainingCount + ' task aktif diperkirakan selesai sekitar ' +
        f.etaDate + ' (± ' + f.etaDays + ' hari). Ini perkiraan, bukan hasil aktual.'
    };
  }

  return {
    MIN_ACTIVE_DAYS: MIN_ACTIVE_DAYS,
    activeDays: activeDays, compute: compute, describe: describe, hasActivity: hasActivity
  };
});
