/* Jam Fokus - analytics (read-only). Every number shown on the Analitik page
   is computed here from saved records; nothing is stored or mutated.
   Definitions (all dates are LOCAL day keys, ranges inclusive):
   - Completed task: non-archived task whose FIRST completion falls in range
     (finalized snapshots are authoritative for their day). Re-completions never count twice.
   - Completion rate: completed / eligible, eligible = non-archived tasks with a
     target date in [from, min(to, today)], plus tasks due later in range that are already done.
   - Recorded focus: plannedSec of sessions in state 'completed', by completedAt (existing rule).
     Interrupted sessions are reported separately (their real activeSec), never added to focus.
   - Target: snapshot.targetMin for finalized days, current setting for today; unknown -> null.
   - Eligible day: from the first recorded day up to today. Days before records are "no data", not zero.
   UMD: browser -> window.JF.analytics, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./dates.js'), require('./store.js'), require('./sessions.js'),
      require('./snapshots.js'), require('./goals.js'));
  } else {
    root.JF = root.JF || {};
    root.JF.analytics = factory(root.JF.dates, root.JF.store, root.JF.sessions, root.JF.snapshots, root.JF.goals);
  }
})(typeof self !== 'undefined' ? self : this, function (dates, store, sessions, snapshots, goals) {
  'use strict';

  var KINDS = ['day', 'week', 'month', 'year', 'custom'];
  var MAX_CUSTOM_DAYS = 3660;
  var MIN_TREND_DAYS = 5;
  var STALE_DAYS = 14;
  var DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function dowIndex(day) { var p = dates.parseDay(day); return (new Date(p.y, p.m - 1, p.d).getDay() + 6) % 7; }
  function minDay(a, b) { return dates.diffDays(a, b) < 0 ? b : a; }
  function maxDay(a, b) { return dates.diffDays(a, b) > 0 ? b : a; }
  function inRange(day, from, to) { return dates.diffDays(from, day) >= 0 && dates.diffDays(day, to) >= 0; }

  /* ── periods ────────────────────────────────────────────────────── */
  /** Resolve a period. kind: day|week(Mon-Sun)|month|year|custom({from,to}). */
  function period(kind, anchor, today, custom) {
    if (KINDS.indexOf(kind) < 0) kind = 'week';
    if (!dates.isDayKey(anchor)) anchor = today;
    var p = dates.parseDay(anchor), from, to, prevFrom, prevTo;
    if (kind === 'day') { from = to = anchor; prevFrom = prevTo = dates.addDays(anchor, -1); }
    else if (kind === 'week') {
      from = dates.addDays(anchor, -dowIndex(anchor)); to = dates.addDays(from, 6);
      prevFrom = dates.addDays(from, -7); prevTo = dates.addDays(from, -1);
    } else if (kind === 'month') {
      from = dates.buildDay(p.y, p.m, 1); to = dates.addDays(dates.buildDay(p.m === 12 ? p.y + 1 : p.y, p.m === 12 ? 1 : p.m + 1, 1), -1);
      prevTo = dates.addDays(from, -1); var pp = dates.parseDay(prevTo); prevFrom = dates.buildDay(pp.y, pp.m, 1);
    } else if (kind === 'year') {
      from = dates.buildDay(p.y, 1, 1); to = dates.buildDay(p.y, 12, 31);
      prevFrom = dates.buildDay(p.y - 1, 1, 1); prevTo = dates.buildDay(p.y - 1, 12, 31);
    } else {
      var a = custom && dates.isDayKey(custom.from) ? custom.from : dates.addDays(today, -29);
      var b = custom && dates.isDayKey(custom.to) ? custom.to : today;
      if (dates.diffDays(a, b) < 0) { var x = a; a = b; b = x; }
      if (dates.diffDays(a, b) + 1 > MAX_CUSTOM_DAYS) a = dates.addDays(b, -(MAX_CUSTOM_DAYS - 1));
      from = a; to = b;
      var len = dates.diffDays(from, to) + 1;
      prevTo = dates.addDays(from, -1); prevFrom = dates.addDays(from, -len);
    }
    var len2 = dates.diffDays(from, to) + 1;
    return {
      kind: kind, from: from, to: to, days: len2,
      prev: { from: prevFrom, to: prevTo },
      incomplete: inRange(today, from, to),          // current period still running
      future: dates.diffDays(today, from) > 0,
      bucket: (kind === 'year' || len2 > 62) ? 'month' : 'day'
    };
  }

  /** Anchor for the next/previous period of the same kind. */
  function shift(kind, anchor, dir) {
    var p = dates.parseDay(anchor);
    if (kind === 'day') return dates.addDays(anchor, dir);
    if (kind === 'week') return dates.addDays(anchor, 7 * dir);
    if (kind === 'month') { var m = p.m - 1 + dir; var y = p.y + Math.floor(m / 12); m = ((m % 12) + 12) % 12; return dates.buildDay(y, m + 1, 1); }
    if (kind === 'year') return dates.buildDay(p.y + dir, 1, 1);
    return anchor;
  }

  function label(per) {
    function d(k) { var p = dates.parseDay(k); return p.d + ' ' + MON[p.m - 1] + ' ' + p.y; }
    if (per.kind === 'day') return d(per.from);
    if (per.kind === 'month') { var p = dates.parseDay(per.from); return ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][p.m - 1] + ' ' + p.y; }
    if (per.kind === 'year') return String(dates.parseDay(per.from).y);
    return d(per.from) + ' – ' + d(per.to);
  }

  /* ── filters ─────────────────────────────────────────────────────── */
  /** Returns a predicate over task ids, or null when no task filter applies. */
  function taskFilter(state, f) {
    f = f || {};
    var goalSet = null;
    if (f.goalId) {
      var g = goals.find(state, f.goalId);
      goalSet = {};
      if (g) goals.taskRefs(state, g).forEach(function (r) { goalSet[r.taskId] = true; });
    }
    var pri = f.priority && f.priority !== 'all' ? f.priority : null;
    if (!goalSet && !pri) return null;
    return function (id) {
      if (goalSet && !goalSet[id]) return false;
      if (pri) { var t = store.find(state, id); if (!t || t.priority !== pri) return false; }
      return true;
    };
  }

  /* ── indexes (built once per compute; read-only) ─────────────────── */
  function buildIndex(state, keep) {
    var idx = { completedByDay: {}, sessionsByDay: {}, snapByDay: {}, firstDay: null };
    (state.tasks || []).forEach(function (t) {
      if (t.archived || t.firstCompletedAt == null) return;
      if (keep && !keep(t.id)) return;
      var k = dates.dayKey(t.firstCompletedAt);
      (idx.completedByDay[k] = idx.completedByDay[k] || []).push(t.id);
    });
    (state.sessions || []).forEach(function (s) {
      if (s.state !== 'completed' && s.state !== 'interrupted') return;
      if (keep && !(s.taskId && keep(s.taskId))) return;
      var at = s.state === 'completed' ? (s.completedAt != null ? s.completedAt : s.endedAt) : (s.endedAt != null ? s.endedAt : s.startedAt);
      if (at == null) return;
      var k = dates.dayKey(at);
      (idx.sessionsByDay[k] = idx.sessionsByDay[k] || []).push({ s: s, at: at });
    });
    (state.snapshots || []).forEach(function (sn) { if (sn && sn.date) idx.snapByDay[sn.date] = sn; });
    var first = snapshots.firstRecordedAt(state);
    idx.firstDay = first != null ? dates.dayKey(first) : null;
    return idx;
  }

  /** One day of data. status: live|final|incomplete|nodata|future */
  function dayRow(state, idx, day, today, keep) {
    var row = { date: day, status: 'final', completed: null, unfinished: null, focusSec: null, interruptedSec: null,
      sessionsDone: null, sessionsCut: null, targetMin: null, targetSource: null };
    if (dates.diffDays(today, day) > 0) { row.status = 'future'; return row; }
    if (!idx.firstDay || dates.diffDays(idx.firstDay, day) < 0) { row.status = 'nodata'; return row; }
    var snap = idx.snapByDay[day];
    if (day === today) row.status = 'live';
    else if (!snap || !snap.complete) row.status = 'incomplete';
    var ids = snap && day !== today ? snap.completedTaskIds : (idx.completedByDay[day] || []);
    if (snap && day !== today && keep) ids = ids.filter(keep);
    row.completed = ids.length;
    if (snap && day !== today) row.unfinished = (keep ? snap.unfinishedTaskIds.filter(keep) : snap.unfinishedTaskIds).length;
    else if (day === today) {
      var end = dates.startOfDay(dates.addDays(day, 1));
      row.unfinished = (state.tasks || []).filter(function (t) { return !t.archived && !t.done && t.createdAt < end && (!keep || keep(t.id)); }).length;
    }
    var f = 0, cut = 0, nd = 0, nc = 0;
    (idx.sessionsByDay[day] || []).forEach(function (e) {
      if (e.s.state === 'completed' && e.s.contributesToOfficial) { f += e.s.plannedSec; nd++; }
      else if (e.s.state === 'interrupted') { cut += e.s.activeSec || 0; nc++; }
    });
    row.focusSec = Math.round(f); row.interruptedSec = Math.round(cut); row.sessionsDone = nd; row.sessionsCut = nc;
    if (snap && day !== today) { row.targetMin = snap.targetMin; row.targetSource = snap.targetMin != null ? 'snapshot' : 'unknown'; }
    else if (day === today) { var tg = store.focusTargetFor(state, day); row.targetMin = tg.min; row.targetSource = tg.min != null ? 'current' : 'unknown'; }
    return row;
  }

  function known(rows) { return rows.filter(function (r) { return r.status !== 'future' && r.status !== 'nodata'; }); }
  function sum(rows, k) { var n = 0, any = false; rows.forEach(function (r) { if (r[k] != null) { n += r[k]; any = true; } }); return any ? n : null; }

  /* ── task metrics ────────────────────────────────────────────────── */
  function completionRate(state, from, to, today, keep) {
    var lastDue = minDay(to, today);
    var endTs = dates.startOfDay(dates.addDays(to, 1));
    var eligible = 0, done = 0, byPriority = {};
    (state.tasks || []).forEach(function (t) {
      if (t.archived || !dates.isDayKey(t.targetDate) || !inRange(t.targetDate, from, to)) return;
      if (keep && !keep(t.id)) return;
      var completed = t.firstCompletedAt != null && t.firstCompletedAt < endTs;
      var dueElapsed = dates.diffDays(t.targetDate, lastDue) >= 0;
      if (!dueElapsed && !completed) return;   // due later and still open: not a failure (yet)
      eligible++; if (completed) done++;
      var b = byPriority[t.priority] = byPriority[t.priority] || { eligible: 0, done: 0 };
      b.eligible++; if (completed) b.done++;
    });
    Object.keys(byPriority).forEach(function (k) { var b = byPriority[k]; b.rate = b.eligible ? b.done / b.eligible : null; });
    return { eligible: eligible, done: done, rate: eligible ? done / eligible : null, byPriority: byPriority };
  }

  /* ── aggregate one range ─────────────────────────────────────────── */
  function summarize(state, idx, from, to, today, keep) {
    var rows = dates.dayRange(from, to).map(function (d) { return dayRow(state, idx, d, today, keep); });
    var k = known(rows);
    var withTarget = k.filter(function (r) { return r.targetMin != null; });
    var focus = sum(k, 'focusSec');
    var done = sum(k, 'sessionsDone');
    return {
      rows: rows,
      eligibleDays: k.length,
      incompleteDays: k.filter(function (r) { return r.status === 'incomplete'; }).length,
      tasksCompleted: sum(k, 'completed'),
      focusSec: focus,
      interruptedSec: sum(k, 'interruptedSec'),
      sessionsDone: done,
      sessionsCut: sum(k, 'sessionsCut'),
      avgFocusPerDay: k.length ? Math.round((focus || 0) / k.length) : null,
      avgSessionSec: done ? Math.round(focus / done) : null,
      targetDays: withTarget.length,
      targetMet: withTarget.filter(function (r) { return (r.focusSec || 0) >= r.targetMin * 60; }).length,
      rate: completionRate(state, from, to, today, keep)
    };
  }

  function delta(cur, prev) {
    if (cur == null || prev == null) return null;
    return { abs: cur - prev, pct: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null };
  }

  /** Bucket day rows into months for long ranges (sums; null when no known day). */
  function buckets(rows, mode) {
    if (mode !== 'month') return rows.map(function (r) { return Object.assign({ key: r.date, label: r.date }, r); });
    var out = [], cur = null;
    rows.forEach(function (r) {
      var key = r.date.slice(0, 7);
      if (!cur || cur.key !== key) { cur = { key: key, days: [] }; out.push(cur); }
      cur.days.push(r);
    });
    return out.map(function (b) {
      var k = known(b.days);
      var tg = k.filter(function (r) { return r.targetMin != null; });
      var last = k.length ? k[k.length - 1] : null;
      return {
        key: b.key, label: b.key, date: b.days[0].date,
        status: !k.length ? (b.days[0].status === 'future' ? 'future' : 'nodata') : k.some(function (r) { return r.status === 'live'; }) ? 'live' : k.some(function (r) { return r.status === 'incomplete'; }) ? 'incomplete' : 'final',
        completed: sum(k, 'completed'), unfinished: last ? last.unfinished : null,
        focusSec: sum(k, 'focusSec'), interruptedSec: sum(k, 'interruptedSec'),
        sessionsDone: sum(k, 'sessionsDone'), sessionsCut: sum(k, 'sessionsCut'),
        targetMin: tg.length ? tg.reduce(function (n, r) { return n + r.targetMin; }, 0) : null,
        targetDays: tg.length, knownDays: k.length
      };
    });
  }

  /** Distribution by hour (0-23) and weekday (0=Mon). status: completed|interrupted|all */
  function distribution(state, idx, from, to, status) {
    var hours = [], dow = [];
    for (var i = 0; i < 24; i++) hours.push(0);
    for (var j = 0; j < 7; j++) dow.push(0);
    var n = 0;
    dates.dayRange(from, to).forEach(function (d) {
      (idx.sessionsByDay[d] || []).forEach(function (e) {
        var ok = e.s.state === 'completed' ? (status !== 'interrupted' && e.s.contributesToOfficial) : status !== 'completed';
        if (!ok) return;
        var sec = e.s.state === 'completed' ? e.s.plannedSec : (e.s.activeSec || 0);
        hours[new Date(e.at).getHours()] += sec;
        dow[dowIndex(d)] += sec;
        n++;
      });
    });
    return { hours: hours.map(Math.round), dow: dow.map(Math.round), sessions: n };
  }

  /* ── goals ───────────────────────────────────────────────────────── */
  function goalStats(state, from, to, today, goalId) {
    var startTs = dates.startOfDay(from), endTs = dates.startOfDay(dates.addDays(to, 1));
    var all = goals.list(state).filter(function (g) { return !g.archived && (!goalId || g.id === goalId); });
    var msDone = 0, goalsDone = 0;
    var list = all.map(function (g) {
      g.milestones.forEach(function (m) { if (m.done && m.completedAt >= startTs && m.completedAt < endTs) msDone++; });
      if (g.status === 'completed' && g.completedAt >= startTs && g.completedAt < endTs) goalsDone++;
      var p = goals.progress(state, g);
      // Last recorded progress evidence: milestone completions and linked-task first completions.
      var last = null;
      g.milestones.forEach(function (m) { if (m.done && m.completedAt != null && (last == null || m.completedAt > last)) last = m.completedAt; });
      goals.taskRefs(state, g).forEach(function (r) { var t = r.task; if (t && !t.archived && t.firstCompletedAt != null && (last == null || t.firstCompletedAt > last)) last = t.firstCompletedAt; });
      var ageDays = dates.diffDays(dates.dayKey(g.createdAt), today);
      var stale = null;   // null = cannot be determined
      if (g.status !== 'completed' && p.method !== 'target' && ageDays >= STALE_DAYS) {
        stale = last == null || dates.diffDays(dates.dayKey(last), today) > STALE_DAYS;
      }
      var dl = goals.deadlineInfo(g.deadline, today);
      var openMs = g.milestones.filter(function (m) { return !m.done; }).length;
      return {
        id: g.id, title: g.title, category: g.category, status: g.status, method: p.method,
        pct: p.pct, manualComplete: p.manualComplete, deadline: g.deadline, deadlineInfo: dl,
        openMilestones: openMs, lastProgressAt: last, stale: stale,
        atRisk: g.status !== 'completed' && !!dl && !dl.overdue && dl.days <= 14 && (openMs > 0 || (p.pct != null && p.pct < 100))
      };
    });
    var ov = goals.overview(state, today);
    var dlList = goals.upcomingDeadlines(state, today).filter(function (d) { return !goalId || d.goalId === goalId; });
    return {
      active: goalId ? list.filter(function (g) { return g.status !== 'completed'; }).length : ov.active,
      completed: goalId ? list.filter(function (g) { return g.status === 'completed'; }).length : ov.completed,
      milestonesDoneInPeriod: msDone, goalsDoneInPeriod: goalsDone,
      overdue: dlList.filter(function (d) { return d.overdue; }),
      dueSoon: dlList.filter(function (d) { return d.soon; }),
      list: list
    };
  }

  function milestoneTrend(state, bucketRows, mode, goalId) {
    var counts = {};
    goals.list(state).forEach(function (g) {
      if (g.archived || (goalId && g.id !== goalId)) return;
      g.milestones.forEach(function (m) {
        if (!m.done || m.completedAt == null) return;
        var k = dates.dayKey(m.completedAt); if (mode === 'month') k = k.slice(0, 7);
        counts[k] = (counts[k] || 0) + 1;
      });
    });
    return bucketRows.map(function (b) { return b.status === 'future' ? null : (counts[b.key] || 0); });   // milestones are their own records
  }

  /* ── journaling (presence only; text is never read) ──────────────── */
  function journalStats(state, from, to, today, idx, goalId) {
    var map = state.journals && typeof state.journals === 'object' ? state.journals : {};
    var lastDay = minDay(to, today);
    var firstDay = idx.firstDay ? maxDay(from, idx.firstDay) : null;
    var days = [], linked = 0;
    Object.keys(map).forEach(function (d) {
      if (!dates.isDayKey(d) || !inRange(d, from, to)) return;
      var e = map[d];
      if (!e || typeof e !== 'object') return;
      var link = e.goal && e.goal.goalId ? e.goal : null;
      if (goalId && (!link || link.goalId !== goalId)) return;
      if (link) linked++;
      days.push({ day: d, goalId: link ? link.goalId : null, milestoneId: link ? link.milestoneId || null : null });
    });
    days.sort(function (a, b) { return a.day < b.day ? 1 : -1; });
    var eligible = firstDay && dates.diffDays(firstDay, lastDay) >= 0 ? dates.diffDays(firstDay, lastDay) + 1 : 0;
    return { entries: days.length, eligibleDays: eligible, linked: linked, days: days, rate: eligible ? days.length / eligible : null };
  }

  /* ── trend (replaces the bare ETA): mean ± spread over complete days ── */
  function trend(state, today, keep) {
    var days = (state.snapshots || []).filter(function (s) { return s.complete && dates.diffDays(s.date, today) > 0; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(-28);
    var vals = days.map(function (s) { return (keep ? s.completedTaskIds.filter(keep) : s.completedTaskIds).length; });
    if (vals.length < MIN_TREND_DAYS) return { ready: false, observations: vals.length, min: MIN_TREND_DAYS };
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var sd = Math.sqrt(vals.reduce(function (a, v) { return a + (v - mean) * (v - mean); }, 0) / (vals.length - 1 || 1));
    var r = function (x) { return Math.round(x * 10) / 10; };
    return { ready: true, observations: vals.length, from: days[0].date, to: days[days.length - 1].date,
      mean: r(mean), sd: r(sd), next7Low: r(Math.max(0, mean - sd) * 7), next7High: r((mean + sd) * 7) };
  }

  /* ── insights: rule-based, each with basis + metric ──────────────── */
  function insights(res) {
    var out = [], c = res.current, p = res.previous;
    if (c.eligibleDays === 0) {
      out.push({ kind: 'info', text: 'Belum ada catatan tugas atau sesi pada periode ini.', basis: 'Tidak ada hari dengan data antara awal catatan dan hari ini.' });
    } else taskAndFocusInsights(res, out);
    goalInsights(res, out);
    return out;
  }

  function taskAndFocusInsights(res, out) {
    var c = res.current, p = res.previous;
    if (c.tasksCompleted != null && p.tasksCompleted != null && (c.tasksCompleted + p.tasksCompleted) >= 6 && p.eligibleDays > 0) {
      var d = c.tasksCompleted - p.tasksCompleted;
      if (d !== 0) out.push({ kind: d > 0 ? 'up' : 'down', text: 'Tugas selesai ' + (d > 0 ? 'naik' : 'turun') + ' ' + Math.abs(d) + ' dibanding periode sebelumnya.',
        basis: c.tasksCompleted + ' vs ' + p.tasksCompleted + ' tugas unik yang pertama kali selesai.' + (res.period.incomplete ? ' Periode ini masih berjalan.' : '') });
    } else {
      out.push({ kind: 'info', text: 'Data penyelesaian tugas belum cukup untuk membandingkan tren.', basis: 'Butuh minimal 6 penyelesaian di dua periode; saat ini ' + ((c.tasksCompleted || 0) + (p.tasksCompleted || 0)) + '.' });
    }
    var missed = c.targetDays - c.targetMet;
    var elapsedTarget = c.rows.filter(function (r) { return r.targetMin != null && r.status !== 'live' && r.status !== 'future'; });
    var missedFinal = elapsedTarget.filter(function (r) { return (r.focusSec || 0) < r.targetMin * 60; }).length;
    if (elapsedTarget.length >= 3 && missedFinal > 0) {
      out.push({ kind: 'warn', text: 'Fokus tercatat di bawah target pada ' + missedFinal + ' dari ' + elapsedTarget.length + ' hari yang sudah lewat.',
        basis: 'Fokus dari sesi selesai dibanding target harian yang tercatat (hari tanpa target tidak dihitung).' });
    } else if (missed === 0 && c.targetDays >= 3) {
      out.push({ kind: 'up', text: 'Target fokus tercapai di semua ' + c.targetDays + ' hari bertarget.', basis: 'Fokus dari sesi selesai ≥ target harian.' });
    }
    if (c.sessionsCut != null && c.sessionsDone != null && c.sessionsCut + c.sessionsDone >= 5 && c.sessionsCut > c.sessionsDone) {
      out.push({ kind: 'warn', text: 'Sesi terputus lebih banyak daripada sesi selesai (' + c.sessionsCut + ' vs ' + c.sessionsDone + ').',
        basis: 'Sesi terputus tidak masuk total fokus; waktu fokusnya ditampilkan terpisah.' });
    }
    if (res.focusByCategory && res.focusByCategory.length && c.focusSec >= 3600) {
      var top = res.focusByCategory[0];
      var share = Math.round((top.sec / c.focusSec) * 100);
      if (share >= 50) out.push({ kind: 'info', text: 'Kategori goal "' + top.category + '" menyumbang ' + share + '% fokus tercatat.', basis: 'Sesi selesai pada tugas yang ditautkan ke goal berkategori ini.' });
    }
    if (c.incompleteDays) out.push({ kind: 'info', text: c.incompleteDays + ' hari pada periode ini datanya tidak lengkap.', basis: 'Hari tersebut ditampilkan apa adanya dan tidak dianggap nol.' });
  }

  function goalInsights(res, out) {
    res.goals.list.filter(function (g) { return g.atRisk; }).slice(0, 2).forEach(function (g) {
      out.push({ kind: 'warn', text: 'Goal "' + g.title + '" mendekati tenggat (' + g.deadlineInfo.days + ' hari lagi) dengan ' + g.openMilestones + ' milestone belum selesai.',
        basis: 'Tenggat goal dan status milestone tersimpan; progres ' + (g.pct == null ? 'belum bisa dihitung' : g.pct + '%') + '.', goalId: g.id });
    });
    res.goals.list.filter(function (g) { return g.stale; }).slice(0, 2).forEach(function (g) {
      out.push({ kind: 'info', text: 'Goal "' + g.title + '" belum mencatat progres dalam ' + STALE_DAYS + ' hari terakhir.',
        basis: 'Tidak ada milestone atau tugas terkait yang selesai sejak ' + (g.lastProgressAt ? dates.dayKey(g.lastProgressAt) : 'goal dibuat') + '.', goalId: g.id });
    });
  }

  function focusByCategory(state, idx, from, to, keep) {
    var catOf = {};
    goals.list(state).forEach(function (g) {
      if (g.archived || !g.category) return;
      goals.taskRefs(state, g).forEach(function (r) { if (!catOf[r.taskId]) catOf[r.taskId] = g.category; });  // first goal wins: no double count
    });
    var acc = {};
    dates.dayRange(from, to).forEach(function (d) {
      (idx.sessionsByDay[d] || []).forEach(function (e) {
        if (e.s.state !== 'completed' || !e.s.contributesToOfficial) return;
        var c = e.s.taskId && catOf[e.s.taskId];
        if (c) acc[c] = (acc[c] || 0) + e.s.plannedSec;
      });
    });
    return Object.keys(acc).map(function (k) { return { category: k, sec: Math.round(acc[k]) }; }).sort(function (a, b) { return b.sec - a.sec; });
  }

  /** Full analytics result for a period + filters. Pure and read-only. */
  function compute(state, opts) {
    opts = opts || {};
    var today = opts.today || dates.todayKey();
    var per = opts.period || period('week', today, today);
    var filters = opts.filters || {};
    var keep = taskFilter(state, filters);
    var idx = buildIndex(state, keep);
    var cur = summarize(state, idx, per.from, per.to, today, keep);
    var prev = summarize(state, idx, per.prev.from, per.prev.to, today, keep);
    var b = buckets(cur.rows, per.bucket);
    var res = {
      period: per, today: today, filters: filters, filtered: !!keep,
      current: cur, previous: prev,
      deltas: { tasksCompleted: delta(cur.tasksCompleted, prev.tasksCompleted), focusSec: delta(cur.focusSec, prev.focusSec),
        rate: cur.rate.rate != null && prev.rate.rate != null ? { abs: Math.round((cur.rate.rate - prev.rate.rate) * 100) } : null },
      buckets: b,
      distribution: distribution(state, idx, per.from, minDay(per.to, today), filters.sessionStatus || 'completed'),
      goals: goalStats(state, per.from, per.to, today, filters.goalId),
      milestoneTrend: milestoneTrend(state, b, per.bucket, filters.goalId),
      journal: journalStats(state, per.from, per.to, today, idx, filters.goalId),
      focusByCategory: focusByCategory(state, idx, per.from, minDay(per.to, today), keep),
      overdueNow: (state.tasks || []).filter(function (t) { return (!keep || keep(t.id)) && (t.archived ? false : !t.done && dates.diffDays(t.targetDate, today) > 0); }).length,
      trend: trend(state, today, keep)
    };
    res.goals.milestonesDonePrev = goalStats(state, per.prev.from, per.prev.to, today, filters.goalId).milestonesDoneInPeriod;
    res.insights = insights(res);
    return res;
  }

  /* ── CSV export: same numbers as the dashboard; unavailable = empty ── */
  function isNumericString(s) {
    if (typeof s !== 'string') return false;
    return /^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s.trim());
  }

  function csvCell(v) {
    if (v == null) return '';
    // Don't apply formula injection protection to numbers to avoid corrupting legitimate numeric values
    if (typeof v === 'number') {
      if (isNaN(v)) return '';
      var ns = String(v);
      if (/[",;\n\r]/.test(ns)) {
        return '"' + ns.replace(/"/g, '""') + '"';
      }
      return ns;
    }
    var s = String(v);
    // Prevent CSV formula injection for user-controlled text fields beginning with =, +, -, @
    // Do not corrupt legitimate numeric values (even if passed as strings)
    if (s.length > 0) {
      var first = s.charAt(0);
      if (isNumericString(s)) {
        // It's a numeric string - don't add formula injection protection
      } else if (first === '=' || first === '+' || first === '-' || first === '@') {
        s = "'" + s;
      }
    }
    // Use valid CSV escaping: quote fields containing commas, quotes, or line breaks
    if (/[",;\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function formatChange(cur, prev, unit) {
    if (cur == null || prev == null) return '';
    var diff = cur - prev;
    if (diff === 0) return '0' + (unit || '');
    var sign = diff > 0 ? '+' : '';
    if (unit === '%') {
      // For rates stored as decimals in calculations, but in our summary we report percentages differently
      // For count/other units
      return sign + diff + (unit || '');
    }
    return sign + diff + (unit || '');
  }

  function toCSV(res) {
    var c = res.current, lines = [];
    var row = function (a) { lines.push(a.map(csvCell).join(',')); };

    // 1. Report information
    row(['Informasi Laporan']);
    row(['Nama Aplikasi', 'Jam Fokus']);
    try {
      var exportTs = new Date().toISOString();
      row(['Waktu Ekspor', exportTs]);
    } catch (e) {
      row(['Waktu Ekspor', '']);
    }
    var periodLabel = res.period.kind === 'day' ? 'Harian' : res.period.kind === 'week' ? 'Mingguan' : res.period.kind === 'month' ? 'Bulanan' : res.period.kind === 'year' ? 'Tahunan' : 'Kustom';
    row(['Periode', periodLabel]);
    row(['Rentang Tanggal', res.period.from + ' s/d ' + res.period.to]);
    if (res.period.incomplete) {
      row(['Status Periode', 'Periode berjalan']);
    } else {
      row(['Status Periode', res.period.future ? 'Periode mendatang' : 'Periode lengkap']);
    }
    // Active goal and priority filters
    var goalFilter = 'Semua';
    if (res.filters && res.filters.goalId) {
      if (res.goals && res.goals.list) {
        for (var gi = 0; gi < res.goals.list.length; gi++) {
          if (res.goals.list[gi].id === res.filters.goalId) {
            goalFilter = res.goals.list[gi].title || res.filters.goalId;
            break;
          }
        }
        if (goalFilter === 'Semua') goalFilter = res.filters.goalId;
      } else {
        goalFilter = res.filters.goalId;
      }
    }
    row(['Filter Goal Aktif', goalFilter]);
    var priFilter = (res.filters && res.filters.priority && res.filters.priority !== 'all') ? res.filters.priority : 'Semua';
    if (priFilter === 'high') priFilter = 'Tinggi';
    else if (priFilter === 'normal') priFilter = 'Normal';
    else if (priFilter === 'low') priFilter = 'Rendah';
    row(['Filter Prioritas Aktif', priFilter]);
    row(['Catatan', 'Sel kosong = data tidak tersedia (bukan nol)']);
    row([]);

    // 2. KPI summary
    row(['Ringkasan KPI']);
    row(['Nama Metrik', 'Nilai Saat Ini', 'Satuan', 'Nilai Periode Sebelumnya', 'Perubahan']);

    // Tugas selesai (unik)
    var curTasks = c.tasksCompleted;
    var prevTasks = res.previous.tasksCompleted;
    var chTasks = '';
    if (curTasks != null && prevTasks != null) {
      var dTasks = curTasks - prevTasks;
      chTasks = (dTasks > 0 ? '+' : '') + dTasks;
    }
    row(['Tugas selesai (unik)', curTasks, 'tugas', prevTasks, chTasks]);

    // Tingkat penyelesaian
    var curRatePct = c.rate && c.rate.rate != null ? Math.round(c.rate.rate * 100) : null;
    var prevRatePct = res.previous && res.previous.rate && res.previous.rate.rate != null ? Math.round(res.previous.rate.rate * 100) : null;
    var chRate = '';
    if (curRatePct != null && prevRatePct != null) {
      var dRate = curRatePct - prevRatePct;
      chRate = (dRate > 0 ? '+' : '') + dRate + ' poin';
    }
    row(['Tingkat penyelesaian', curRatePct, '%', prevRatePct, chRate]);

    // Fokus tercatat
    var curFocusMin = c.focusSec == null ? null : Math.round(c.focusSec / 60);
    var prevFocusMin = res.previous && res.previous.focusSec == null ? null : Math.round(res.previous.focusSec / 60);
    var chFocus = '';
    if (curFocusMin != null && prevFocusMin != null) {
      var dFocus = curFocusMin - prevFocusMin;
      chFocus = (dFocus > 0 ? '+' : '') + dFocus + ' menit';
    }
    row(['Fokus tercatat', curFocusMin, 'menit', prevFocusMin, chFocus]);

    // Rata-rata fokus per hari
    var curAvgFocus = c.avgFocusPerDay == null ? null : Math.round(c.avgFocusPerDay / 60);
    var prevAvgFocus = null;
    if (res.previous && res.previous.avgFocusPerDay != null) {
      prevAvgFocus = Math.round(res.previous.avgFocusPerDay / 60);
    }
    var chAvg = '';
    if (curAvgFocus != null && prevAvgFocus != null) {
      var dAvg = curAvgFocus - prevAvgFocus;
      chAvg = (dAvg > 0 ? '+' : '') + dAvg + ' menit';
    }
    row(['Rata-rata fokus per hari', curAvgFocus, 'menit', prevAvgFocus, chAvg]);

    // Sesi selesai
    var curSessDone = c.sessionsDone;
    var prevSessDone = res.previous && res.previous.sessionsDone;
    var chSess = '';
    if (curSessDone != null && prevSessDone != null) {
      var dSess = curSessDone - prevSessDone;
      chSess = (dSess > 0 ? '+' : '') + dSess;
    }
    row(['Sesi selesai', curSessDone, 'sesi', prevSessDone, chSess]);

    // Sesi terputus
    row(['Sesi terputus', c.sessionsCut, 'sesi', res.previous && res.previous.sessionsCut != null ? res.previous.sessionsCut : '', '']);

    // Fokus sesi terputus (tidak dihitung)
    var curIntMin = c.interruptedSec == null ? null : Math.round(c.interruptedSec / 60);
    var prevIntMin = res.previous && res.previous.interruptedSec == null ? null : Math.round(res.previous.interruptedSec / 60);
    row(['Fokus sesi terputus (tidak dihitung)', curIntMin, 'menit', prevIntMin, '']);

    // Hari target tercapai
    var curTarget = (c.targetDays && c.targetDays > 0) ? (c.targetMet + '/' + c.targetDays) : null;
    row(['Hari target tercapai', curTarget, c.targetDays && c.targetDays > 0 ? 'hari bertarget' : '', '', '']);

    // Milestone selesai
    var curMs = res.goals ? res.goals.milestonesDoneInPeriod : null;
    var prevMs = res.goals ? res.goals.milestonesDonePrev : null;
    var chMs = '';
    if (curMs != null && prevMs != null) {
      var dMs = curMs - prevMs;
      chMs = (dMs > 0 ? '+' : '') + dMs;
    }
    row(['Milestone selesai', curMs, 'milestone', prevMs, chMs]);

    row([]);

    // 3. Daily details
    row(['Rincian Harian']);
    row(['Tanggal', 'Status Data', 'Tugas Selesai', 'Tugas Belum Selesai', 'Waktu Fokus Tercatat (menit)', 'Target Fokus (menit)', 'Sesi Selesai', 'Sesi Terputus', 'Waktu Fokus Terputus (menit)']);
    if (res.buckets && res.buckets.length) {
      res.buckets.forEach(function (b) {
        var m = function (v) { return v == null ? null : Math.round(v / 60); };
        // Map status to Indonesian labels for clarity
        var statusLabel = b.status;
        if (b.status === 'final') statusLabel = 'Lengkap';
        else if (b.status === 'incomplete') statusLabel = 'Tidak lengkap';
        else if (b.status === 'live') statusLabel = 'Hari ini';
        else if (b.status === 'nodata') statusLabel = 'Tidak ada data';
        else if (b.status === 'future') statusLabel = 'Mendatang';
        var dateLabel = b.label || b.date || b.key;
        row([dateLabel, statusLabel, b.completed, b.unfinished, m(b.focusSec), b.targetMin, b.sessionsDone, b.sessionsCut, m(b.interruptedSec)]);
      });
    }
    return '\ufeff' + lines.join('\n') + '\n';
  }

  return {
    KINDS: KINDS, MIN_TREND_DAYS: MIN_TREND_DAYS, STALE_DAYS: STALE_DAYS, DOW: DOW, MON: MON,
    period: period, shift: shift, label: label, taskFilter: taskFilter,
    completionRate: completionRate, compute: compute, toCSV: toCSV, trend: trend
  };
});
