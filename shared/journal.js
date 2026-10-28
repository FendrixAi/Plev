/* Jam Fokus - daily journal storage and autosave queue.
   Journal entries live in state.journals, keyed by the local day key
   ('YYYY-MM-DD'). Pure data helpers are usable from Node tests.
   UMD: browser -> window.JF.journal, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./dates.js'), require('./store.js'), require('./sessions.js'), require('./snapshots.js'));
  } else {
    root.JF = root.JF || {};
    root.JF.journal = factory(root.JF.dates, root.JF.store, root.JF.sessions, root.JF.snapshots);
  }
})(typeof self !== 'undefined' ? self : this, function (dates, store, sessions, snapshots) {
  'use strict';

  var SECTIONS = ['wins', 'challenges', 'learned', 'priorities'];

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function validDay(day) { return typeof day === 'string' && dates.isDayKey(day); }
  function text(v) { return v == null ? '' : String(v); }

  /** Older state objects simply get an empty journal map (no schema bump). */
  function normalize(state) {
    if (!state || typeof state !== 'object') return {};
    if (!isObj(state.journals)) state.journals = {};
    return state.journals;
  }

  function entryFor(state, day) {
    if (!validDay(day)) return null;
    var map = normalize(state);
    return isObj(map[day]) ? map[day] : null;
  }

  function contentOf(entry) {
    var out = {};
    SECTIONS.forEach(function (key) { out[key] = text(entry && entry[key]); });
    return out;
  }

  function hasContent(content) {
    return SECTIONS.some(function (key) { return text(content && content[key]).trim().length > 0; });
  }

  /**
   * Create/update a day's entry. An all-empty entry is removed so empty
   * journals never leave noise behind. Missing fields keep their old value;
   * sending '' clears a field. Returns a descriptor for the UI/tests.
   */
  function save(state, day, patch, now) {
    if (!validDay(day)) return { ok: false, reason: 'invalid-day' };
    if (!state || typeof state !== 'object') return { ok: false, reason: 'invalid-state' };
    now = now == null ? Date.now() : now;
    var map = normalize(state);
    if (!Array.isArray(state.events)) state.events = [];
    var current = isObj(map[day]) ? map[day] : null;
    var next = {};
    SECTIONS.forEach(function (key) {
      next[key] = text(patch && patch[key] != null ? patch[key] : (current ? current[key] : ''));
    });

    if (!hasContent(next)) {
      if (!current) return { ok: true, changed: false, removed: false, entry: null };
      delete map[day];
      store.ev(state, now, 'journal.removed', null, { day: day });
      return { ok: true, changed: true, removed: true, entry: null };
    }

    var unchanged = current && SECTIONS.every(function (key) { return text(current[key]) === next[key]; });
    if (unchanged) return { ok: true, changed: false, removed: false, entry: current };

    var entry = { date: day };
    SECTIONS.forEach(function (key) { entry[key] = next[key]; });
    if (current && isObj(current.goal)) entry.goal = current.goal;   // optional goal context survives edits
    entry.createdAt = current && current.createdAt != null ? current.createdAt : now;
    entry.updatedAt = now;
    map[day] = entry;
    store.ev(state, now, current ? 'journal.updated' : 'journal.created', null, { day: day });
    return { ok: true, changed: true, removed: false, entry: entry };
  }

  /** Optional goal/milestone context of a day's entry ({goalId, milestoneId} or null). */
  function goalLinkOf(state, day) {
    var entry = entryFor(state, day);
    return entry && isObj(entry.goal) ? entry.goal : null;
  }

  /**
   * Attach (or clear with null) a goal/milestone link on an EXISTING entry.
   * Purely contextual: never edits text and never counts as goal progress.
   */
  function setGoalLink(state, day, link, now) {
    if (!validDay(day)) return { ok: false, reason: 'invalid-day' };
    var entry = entryFor(state, day);
    if (!entry) return { ok: false, reason: 'no-entry' };
    now = now == null ? Date.now() : now;
    var next = null;
    if (link != null) {
      var gid = isObj(link) && typeof link.goalId === 'string' && link.goalId ? link.goalId : null;
      if (!gid) return { ok: false, reason: 'invalid-link' };
      var mid = typeof link.milestoneId === 'string' && link.milestoneId ? link.milestoneId : null;
      next = { goalId: gid, milestoneId: mid };
    }
    var cur = isObj(entry.goal) ? entry.goal : null;
    if ((!cur && !next) || (cur && next && cur.goalId === next.goalId && (cur.milestoneId || null) === next.milestoneId)) {
      return { ok: true, changed: false, link: cur };
    }
    if (next) entry.goal = next; else delete entry.goal;
    if (!Array.isArray(state.events)) state.events = [];
    store.ev(state, now, 'journal.goalLinked', null, { day: day, goalId: next ? next.goalId : null });
    return { ok: true, changed: true, link: next };
  }

  function count(state) {
    var map = normalize(state);
    return Object.keys(map).filter(function (day) { return isObj(map[day]) && hasContent(map[day]); }).length;
  }

  /**
   * Compact daily summary from the canonical records: finalized snapshots
   * when available, otherwise the live task/session data. Never invents data.
   */
  function summary(state, day) {
    if (!validDay(day) || !state) return null;
    var start = dates.startOfDay(day);
    var end = dates.startOfDay(dates.addDays(day, 1));
    var snap = snapshots.findSnapshot(state, day);
    var done = snap && Array.isArray(snap.completedTaskIds)
      ? snap.completedTaskIds.length
      : store.tasksCompletedOn(state, day).length;
    var focusSec = snap && snap.officialFocusSec != null
      ? snap.officialFocusSec
      : sessions.officialSeconds(state.sessions || [], start, end);
    var sessionCount = 0;
    (state.sessions || []).forEach(function (s) {
      if (!s || s.state !== 'completed' || !s.contributesToOfficial) return;
      var at = s.completedAt != null ? s.completedAt : s.endedAt;
      if (at != null && at >= start && at < end) sessionCount++;
    });
    return {
      day: day,
      completed: Math.max(0, done || 0),
      focusSec: Math.max(0, Math.round(focusSec || 0)),
      sessions: sessionCount,
      targetMin: store.focusTargetFor(state, day).min,
      hasSnapshot: !!snap,
      complete: snap ? !!snap.complete : null,
      hasJournal: !!entryFor(state, day)
    };
  }

  /**
   * Debounced, serialized autosave queue.
   * - Rapid edits collapse to the latest content.
   * - Saves never overlap; a newer edit queued during a save runs afterwards.
   * - On failure the latest job is kept so date/page switching can retry and
   *   block instead of silently losing text.
   * opts.save(day, content) may return a boolean or a Promise<boolean>.
   */
  function createAutosave(opts) {
    opts = opts || {};
    var delay = opts.delay == null ? 650 : opts.delay;
    var timer = null, pending = null, seq = 0, writing = false, followUp = false;
    var chain = Promise.resolve(true);

    function notify(status, meta) {
      if (opts.onStatus) { try { opts.onStatus(status, meta); } catch (e) { /* UI status must not break saving */ } }
    }

    function schedule(day, content) {
      seq++;
      pending = { day: day, content: content, seq: seq };
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { timer = null; flush(); }, delay);
      notify('saving', { seq: seq, day: day });
      return seq;
    }

    function flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (writing) { followUp = true; return chain; }
      if (!pending) return Promise.resolve(true);

      var job = pending;
      pending = null;
      writing = true;
      var result;
      try { result = opts.save(job.day, job.content); }
      catch (e) { result = false; }

      chain = Promise.resolve(result).then(function (ok) {
        writing = false;
        if (ok === false) {
          if (pending) { followUp = false; return flush(); } // a newer edit supersedes this failure
          pending = job;                                     // keep latest text for an explicit retry
          notify('error', { seq: job.seq, day: job.day });
          return false;
        }
        var newest = job.seq === seq && !pending;
        if (newest) notify('saved', { seq: job.seq, day: job.day });
        if (followUp || pending) { followUp = false; return flush(); }
        return newest || !pending;
      }, function () {
        writing = false;
        if (pending) { followUp = false; return flush(); }
        pending = job;
        notify('error', { seq: job.seq, day: job.day });
        return false;
      });
      return chain;
    }

    function isDirty() { return !!pending || writing; }

    function cancel() {
      if (timer) { clearTimeout(timer); timer = null; }
      pending = null;
    }

    return { schedule: schedule, flush: flush, isDirty: isDirty, cancel: cancel };
  }

  return {
    SECTIONS: SECTIONS,
    normalize: normalize,
    validDay: validDay,
    entryFor: entryFor,
    contentOf: contentOf,
    save: save,
    count: count,
    goalLinkOf: goalLinkOf,
    setGoalLink: setGoalLink,
    summary: summary,
    createAutosave: createAutosave
  };
});
