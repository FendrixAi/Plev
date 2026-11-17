/* Jam Fokus — Job applications (data layer).
   Applications live in state.jobApps (array). Each application owns its
   status history and its link list (links only — no file bytes, no Library
   duplication). Library surfaces these links as a virtual read-only view.
   History is append-only: every real status change adds one entry, repeated
   events never duplicate. Analytics count UNIQUE applications, not events.
   UMD: browser -> window.JF.jobApps, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./dates.js'), require('./model.js'), require('./store.js'), require('./library.js'));
  } else {
    root.JF = root.JF || {};
    root.JF.jobApps = factory(root.JF.dates, root.JF.model, root.JF.store, root.JF.library);
  }
})(typeof self !== 'undefined' ? self : this, function (dates, model, store, library) {
  'use strict';

  var STATUSES = ['applied', 'psikotest', 'interview', 'offering', 'mcu', 'diterima', 'ditolak', 'withdrawn', 'no_response'];
  var STATUS_LABEL = {
    applied: 'Applied', psikotest: 'Psikotest', interview: 'Interview', offering: 'Offering', mcu: 'MCU',
    diterima: 'Diterima', ditolak: 'Ditolak', withdrawn: 'Withdrawn', no_response: 'No Response'
  };
  /* Chip tone per status (Original theme classes). */
  var STATUS_TONE = {
    applied: 'accent', psikotest: 'lilac', interview: 'accent', offering: 'warn', mcu: 'lilac',
    diterima: 'ok', ditolak: 'danger', withdrawn: 'outline', no_response: 'warn'
  };
  /* Closed outcomes: no more schedule/follow-up reminders for these. */
  var TERMINAL = ['diterima', 'ditolak', 'withdrawn'];
  var SOURCES = ['linkedin', 'jobstreet', 'website', 'referral', 'lainnya'];
  var SOURCE_LABEL = { linkedin: 'LinkedIn', jobstreet: 'Jobstreet', website: 'Website perusahaan', referral: 'Referral', lainnya: 'Lainnya' };
  var SOON_DAYS = 7;
  var LIMITS = {
    position: 120, company: 120, notes: 2000, email: 254, url: 2000,
    linkLabel: 120, linkNotes: 500, historyNotes: 500
  };
  var MODULE_ID = 'lamaran';
  var MODULE_LABEL = 'Lamaran Kerja';
  if (library && library.registerModule) library.registerModule(MODULE_ID, MODULE_LABEL);

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v, max) { return v == null ? '' : String(v).slice(0, max); }
  function trimmed(v, max) { return v == null ? '' : String(v).trim().slice(0, max); }
  function optDay(v) { return dates.isDayKey(v) ? v : null; }
  function num(v) {
    if (v === '' || v == null || typeof v === 'boolean') return NaN;
    var n = Number(v);
    return isFinite(n) ? n : NaN;
  }
  function idOf(v) { return (typeof v === 'string' && v) ? v : (typeof v === 'number' && isFinite(v) ? String(v) : null); }
  function ev(state, now, kind, data) {
    if (!Array.isArray(state.events)) state.events = [];
    store.ev(state, now, kind, null, data);
  }
  /* http/https only, and never URLs with embedded credentials (user:pass@). */
  function validUrl(v) {
    if (typeof v !== 'string') return false;
    var s = v.trim();
    if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s)) return false;
    var authority = s.replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
    return authority.indexOf('@') < 0;
  }
  function validEmail(v) { return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
  function optUrl(v) {
    if (v === '' || v == null) return '';
    return validUrl(v) ? String(v).trim().slice(0, LIMITS.url) : null;
  }

  /* ── normalization (older states / imported backups) ─────────────── */
  function normHistory(h, appId, now, usedIds) {
    if (!isObj(h)) return null;
    if (STATUSES.indexOf(h.newStatus) < 0) return null;
    var id = idOf(h.id);
    if (!id || usedIds[id]) id = model.uid('jhist');
    usedIds[id] = true;
    return {
      id: id,
      applicationId: appId,
      previousStatus: STATUSES.indexOf(h.previousStatus) >= 0 ? h.previousStatus : null,
      newStatus: h.newStatus,
      changedAt: num(h.changedAt) > 0 ? num(h.changedAt) : now,
      notes: str(h.notes, LIMITS.historyNotes)
    };
  }
  function normLink(l, appId, now, usedIds) {
    if (!isObj(l)) return null;
    var url = typeof l.url === 'string' ? l.url.trim() : '';
    if (!validUrl(url)) return null;
    var id = idOf(l.id);
    if (!id || usedIds[id]) id = model.uid('jlink');
    usedIds[id] = true;
    var createdAt = num(l.createdAt) > 0 ? num(l.createdAt) : now;
    return {
      id: id,
      applicationId: appId,
      label: trimmed(l.label, LIMITS.linkLabel) || 'Tautan',
      url: url.slice(0, LIMITS.url),
      notes: str(l.notes, LIMITS.linkNotes),
      createdAt: createdAt,
      updatedAt: num(l.updatedAt) > 0 ? num(l.updatedAt) : createdAt
    };
  }
  function normApp(a, now, usedIds) {
    if (!isObj(a)) return null;
    var id = idOf(a.id);
    if (!id || usedIds[id]) id = model.uid('japp');
    usedIds[id] = true;
    var status = STATUSES.indexOf(a.status) >= 0 ? a.status : 'applied';
    var createdAt = num(a.createdAt) > 0 ? num(a.createdAt) : now;
    var applicationDate = optDay(a.applicationDate) || dates.dayKey(createdAt);
    var usedH = {}, usedL = {};
    var history = (Array.isArray(a.history) ? a.history : [])
      .map(function (h) { return normHistory(h, id, now, usedH); })
      .filter(Boolean)
      .sort(function (x, y) { return x.changedAt - y.changedAt; });
    /* Drop exact consecutive duplicates (same transition at the same time). */
    history = history.filter(function (h, i) {
      if (!i) return true;
      var p = history[i - 1];
      return !(p.previousStatus === h.previousStatus && p.newStatus === h.newStatus && p.changedAt === h.changedAt);
    });
    if (!history.length) {
      history.push({
        id: model.uid('jhist'), applicationId: id, previousStatus: null,
        newStatus: status, changedAt: createdAt, notes: ''
      });
    }
    var links = (Array.isArray(a.links) ? a.links : [])
      .map(function (l) { return normLink(l, id, now, usedL); })
      .filter(Boolean);
    return {
      id: id,
      position: trimmed(a.position, LIMITS.position) || 'Posisi tanpa judul',
      company: trimmed(a.company, LIMITS.company) || 'Perusahaan tanpa nama',
      status: status,
      applicationDate: applicationDate,
      jobUrl: optUrl(a.jobUrl) || '',
      gmailUrl: optUrl(a.gmailUrl) || '',
      recruiterEmail: validEmail(a.recruiterEmail) ? String(a.recruiterEmail).trim().slice(0, LIMITS.email) : '',
      source: SOURCES.indexOf(a.source) >= 0 ? a.source : '',
      nextSchedule: optDay(a.nextSchedule),
      followUpDate: optDay(a.followUpDate),
      notes: str(a.notes, LIMITS.notes),
      history: history,
      links: links,
      createdAt: createdAt,
      updatedAt: num(a.updatedAt) > 0 ? num(a.updatedAt) : createdAt
    };
  }
  /** Older states simply get an empty application list (no schema bump). */
  function normalize(state, now) {
    if (!state || typeof state !== 'object') return [];
    now = now == null ? Date.now() : now;
    var used = {};
    state.jobApps = (Array.isArray(state.jobApps) ? state.jobApps : [])
      .map(function (a) { return normApp(a, now, used); })
      .filter(Boolean);
    return state.jobApps;
  }

  function list(state) { return Array.isArray(state && state.jobApps) ? state.jobApps : []; }
  function find(state, id) {
    var all = list(state);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function findLink(app, linkId) {
    if (!app) return null;
    for (var i = 0; i < app.links.length; i++) if (app.links[i].id === linkId) return app.links[i];
    return null;
  }

  /* ── validation ─────────────────────────────────────────────────── */
  /**
   * Validate application form input. Returns {ok, errors:{field:msg}, value}.
   * `base` (existing application) fills fields missing from a partial patch.
   */
  function validateApplication(input, base) {
    input = input || {};
    base = base || {};
    function pick(k) { return input[k] !== undefined ? input[k] : base[k]; }
    var errors = {};
    var position = trimmed(pick('position'), 10000);
    if (!position) errors.position = 'Posisi wajib diisi.';
    else if (position.length > LIMITS.position) errors.position = 'Posisi maksimal ' + LIMITS.position + ' karakter.';
    var company = trimmed(pick('company'), 10000);
    if (!company) errors.company = 'Nama perusahaan wajib diisi.';
    else if (company.length > LIMITS.company) errors.company = 'Nama perusahaan maksimal ' + LIMITS.company + ' karakter.';
    var status = pick('status') == null ? 'applied' : pick('status');
    if (STATUSES.indexOf(status) < 0) errors.status = 'Status tidak dikenal.';
    var applicationDate = pick('applicationDate');
    if (!dates.isDayKey(applicationDate)) errors.applicationDate = 'Tanggal melamar wajib diisi dengan tanggal yang valid.';
    var jobUrl = pick('jobUrl');
    if (jobUrl !== '' && jobUrl != null && optUrl(jobUrl) === null) errors.jobUrl = 'Link lowongan harus URL http/https yang valid (tanpa kredensial).';
    var gmailUrl = pick('gmailUrl');
    if (gmailUrl !== '' && gmailUrl != null && optUrl(gmailUrl) === null) errors.gmailUrl = 'Link Gmail harus URL http/https yang valid (tanpa kredensial).';
    var email = pick('recruiterEmail');
    if (email !== '' && email != null && !validEmail(email)) errors.recruiterEmail = 'Email recruiter tidak valid.';
    var source = pick('source');
    if (source !== '' && source != null && SOURCES.indexOf(source) < 0) errors.source = 'Sumber lamaran tidak dikenal.';
    var nextSchedule = pick('nextSchedule');
    if (nextSchedule !== '' && nextSchedule != null && !dates.isDayKey(nextSchedule)) errors.nextSchedule = 'Tanggal jadwal tidak valid.';
    var followUpDate = pick('followUpDate');
    if (followUpDate !== '' && followUpDate != null && !dates.isDayKey(followUpDate)) errors.followUpDate = 'Tanggal follow-up tidak valid.';
    var ok = Object.keys(errors).length === 0;
    return {
      ok: ok,
      errors: errors,
      value: ok ? {
        position: position,
        company: company,
        status: status,
        applicationDate: applicationDate,
        jobUrl: optUrl(jobUrl) || '',
        gmailUrl: optUrl(gmailUrl) || '',
        recruiterEmail: email ? String(email).trim().slice(0, LIMITS.email) : '',
        source: source || '',
        nextSchedule: optDay(nextSchedule),
        followUpDate: optDay(followUpDate),
        notes: str(pick('notes'), LIMITS.notes)
      } : null
    };
  }

  function validateLink(input, base) {
    input = input || {};
    base = base || {};
    function pick(k) { return input[k] !== undefined ? input[k] : base[k]; }
    var errors = {};
    var label = trimmed(pick('label'), 10000);
    if (!label) errors.label = 'Label tautan wajib diisi.';
    else if (label.length > LIMITS.linkLabel) errors.label = 'Label maksimal ' + LIMITS.linkLabel + ' karakter.';
    var url = pick('url');
    if (!validUrl(url)) errors.url = 'URL harus http/https yang valid (tanpa kredensial).';
    var ok = Object.keys(errors).length === 0;
    return {
      ok: ok, errors: errors,
      value: ok ? {
        label: label,
        url: String(url).trim().slice(0, LIMITS.url),
        notes: str(pick('notes'), LIMITS.linkNotes)
      } : null
    };
  }

  /* ── application CRUD ───────────────────────────────────────────── */
  function historyEntry(appId, previousStatus, newStatus, now, notes) {
    return {
      id: model.uid('jhist'), applicationId: appId,
      previousStatus: previousStatus, newStatus: newStatus,
      changedAt: now, notes: str(notes, LIMITS.historyNotes)
    };
  }

  function createApplication(state, input, now) {
    now = now == null ? Date.now() : now;
    if (!Array.isArray(state.jobApps)) state.jobApps = [];
    var v = validateApplication(Object.assign({ applicationDate: dates.dayKey(now), status: 'applied' }, input || {}));
    if (!v.ok) return { ok: false, reason: 'invalid', errors: v.errors };
    var a = Object.assign({ id: model.uid('japp') }, v.value, {
      history: [], links: [], createdAt: now, updatedAt: now
    });
    a.history.push(historyEntry(a.id, null, a.status, now, ''));
    state.jobApps.push(a);
    ev(state, now, 'jobapp.created', { applicationId: a.id });
    return { ok: true, app: a };
  }

  var FIELD_KEYS = ['position', 'company', 'status', 'applicationDate', 'jobUrl', 'gmailUrl',
    'recruiterEmail', 'source', 'nextSchedule', 'followUpDate', 'notes'];

  function updateApplication(state, id, patch, now) {
    now = now == null ? Date.now() : now;
    var a = find(state, id);
    if (!a) return { ok: false, reason: 'not-found' };
    var v = validateApplication(patch, a);
    if (!v.ok) return { ok: false, reason: 'invalid', errors: v.errors };
    var before = JSON.stringify(FIELD_KEYS.map(function (k) { return a[k]; }));
    var prevStatus = a.status;
    FIELD_KEYS.forEach(function (k) { a[k] = v.value[k]; });
    var after = JSON.stringify(FIELD_KEYS.map(function (k) { return a[k]; }));
    if (before === after) return { ok: true, app: a, changed: false, statusChanged: false };
    var statusChanged = a.status !== prevStatus;
    if (statusChanged) {
      a.history.push(historyEntry(a.id, prevStatus, a.status, now, patch && patch.statusNote));
    }
    a.updatedAt = now;
    ev(state, now, statusChanged ? 'jobapp.status.changed' : 'jobapp.updated',
      { applicationId: a.id, from: statusChanged ? prevStatus : undefined, to: statusChanged ? a.status : undefined });
    return { ok: true, app: a, changed: true, statusChanged: statusChanged };
  }

  /** Manual status change; same status again is a no-op (no duplicate history). */
  function setStatus(state, id, status, note, now) {
    return updateApplication(state, id, { status: status, statusNote: note }, now);
  }

  /** Deleting an application removes only its own record, history and links.
      Library files are never touched. */
  function deleteApplication(state, id, now) {
    now = now == null ? Date.now() : now;
    var a = find(state, id);
    if (!a) return { ok: false, reason: 'not-found' };
    state.jobApps = state.jobApps.filter(function (x) { return x.id !== id; });
    ev(state, now, 'jobapp.deleted', { applicationId: id, position: a.position, company: a.company });
    return { ok: true, app: a };
  }

  /* ── links (per application; links only, never file copies) ─────── */
  function addLink(state, appId, input, now) {
    now = now == null ? Date.now() : now;
    var a = find(state, appId);
    if (!a) return { ok: false, reason: 'not-found' };
    var v = validateLink(input);
    if (!v.ok) return { ok: false, reason: 'invalid', errors: v.errors };
    var l = Object.assign({ id: model.uid('jlink'), applicationId: appId }, v.value, { createdAt: now, updatedAt: now });
    a.links.push(l);
    a.updatedAt = now;
    ev(state, now, 'jobapp.link.added', { applicationId: appId, linkId: l.id });
    return { ok: true, app: a, link: l };
  }
  function updateLink(state, appId, linkId, patch, now) {
    now = now == null ? Date.now() : now;
    var a = find(state, appId);
    if (!a) return { ok: false, reason: 'not-found' };
    var l = findLink(a, linkId);
    if (!l) return { ok: false, reason: 'link-not-found' };
    var v = validateLink(patch, l);
    if (!v.ok) return { ok: false, reason: 'invalid', errors: v.errors };
    var changed = Object.keys(v.value).some(function (k) { return l[k] !== v.value[k]; });
    if (!changed) return { ok: true, app: a, link: l, changed: false };
    Object.keys(v.value).forEach(function (k) { l[k] = v.value[k]; });
    l.updatedAt = now; a.updatedAt = now;
    ev(state, now, 'jobapp.link.updated', { applicationId: appId, linkId: linkId });
    return { ok: true, app: a, link: l, changed: true };
  }
  function removeLink(state, appId, linkId, now) {
    now = now == null ? Date.now() : now;
    var a = find(state, appId);
    if (!a) return { ok: false, reason: 'not-found' };
    var before = a.links.length;
    a.links = a.links.filter(function (l) { return l.id !== linkId; });
    if (a.links.length === before) return { ok: false, reason: 'link-not-found' };
    a.updatedAt = now;
    ev(state, now, 'jobapp.link.removed', { applicationId: appId, linkId: linkId });
    return { ok: true, app: a, changed: true };
  }

  /* ── search / filter / sort (table) ─────────────────────────────── */
  function query(state, opts) {
    opts = opts || {};
    var q = String(opts.search || '').trim().toLowerCase();
    var rows = list(state).filter(function (a) {
      if (opts.status && opts.status !== 'all' && a.status !== opts.status) return false;
      if (q && (a.position + ' ' + a.company).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var by = opts.sort || 'date';
    rows.sort(function (a, b) {
      if (by === 'updated') return b.updatedAt - a.updatedAt || b.createdAt - a.createdAt;
      if (by === 'date-asc') return a.applicationDate < b.applicationDate ? -1 : a.applicationDate > b.applicationDate ? 1 : a.createdAt - b.createdAt;
      return a.applicationDate > b.applicationDate ? -1 : a.applicationDate < b.applicationDate ? 1 : b.createdAt - a.createdAt;
    });
    return rows;
  }

  /* ── reminders (in-app; there is no persistent notification scheduler) ── */
  function dateInfo(day, today) {
    if (!dates.isDayKey(day) || !dates.isDayKey(today)) return null;
    var days = dates.diffDays(today, day);
    return { day: day, days: days, overdue: days < 0, soon: days >= 0 && days <= SOON_DAYS };
  }
  /** Upcoming schedules + follow-ups of open applications, soonest first.
      Overdue follow-ups are flagged; closed outcomes are skipped. */
  function reminders(state, today) {
    var out = [];
    list(state).forEach(function (a) {
      if (TERMINAL.indexOf(a.status) >= 0) return;
      var si = dateInfo(a.nextSchedule, today);
      if (si) out.push(Object.assign({ kind: 'schedule', appId: a.id, position: a.position, company: a.company, status: a.status }, si));
      var fi = dateInfo(a.followUpDate, today);
      if (fi) out.push(Object.assign({ kind: 'followup', appId: a.id, position: a.position, company: a.company, status: a.status }, fi));
    });
    return out.sort(function (a, b) { return a.days - b.days || (a.kind === 'followup' ? -1 : 1); });
  }

  /* ── analytics (unique applications, never history-event counts) ── */
  function everReached(a, status) {
    if (a.status === status) return true;
    for (var i = 0; i < a.history.length; i++) if (a.history[i].newStatus === status) return true;
    return false;
  }
  function pctOf(n, d) {
    if (!(d > 0)) return null;
    return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
  }
  function ratio(n, d) { return { num: n, den: d, pct: pctOf(n, d) }; }

  /**
   * Summary for a date range on applicationDate (inclusive day keys).
   * opts: {from, to} — omit both for all applications.
   * Conversions count unique applications that EVER reached a stage
   * (current status or any history entry), so moving backwards never
   * erases progress and repeated events never inflate numbers.
   */
  function summary(state, opts) {
    opts = opts || {};
    var from = dates.isDayKey(opts.from) ? opts.from : null;
    var to = dates.isDayKey(opts.to) ? opts.to : null;
    var apps = list(state).filter(function (a) {
      if (from && a.applicationDate < from) return false;
      if (to && a.applicationDate > to) return false;
      return true;
    });
    var byStatus = {};
    STATUSES.forEach(function (s) { byStatus[s] = 0; });
    var reached = { interview: 0, offering: 0, diterima: 0 };
    var months = {};
    apps.forEach(function (a) {
      byStatus[a.status]++;
      if (everReached(a, 'interview')) reached.interview++;
      if (everReached(a, 'offering')) reached.offering++;
      if (everReached(a, 'diterima')) reached.diterima++;
      var m = a.applicationDate.slice(0, 7);
      if (!months[m]) months[m] = { month: m, total: 0, accepted: 0, rejected: 0 };
      months[m].total++;
      if (a.status === 'diterima') months[m].accepted++;
      if (a.status === 'ditolak') months[m].rejected++;
    });
    var total = apps.length;
    return {
      total: total,
      byStatus: byStatus,
      closed: byStatus.diterima + byStatus.ditolak + byStatus.withdrawn,
      active: total - (byStatus.diterima + byStatus.ditolak + byStatus.withdrawn),
      reached: reached,
      conversions: {
        appliedToInterview: ratio(reached.interview, total),
        interviewToOffering: ratio(reached.offering, reached.interview),
        offeringToAccepted: ratio(reached.diterima, reached.offering),
        overallAcceptance: ratio(reached.diterima, total)
      },
      months: Object.keys(months).sort().map(function (k) { return months[k]; }),
      linkCount: apps.reduce(function (n, a) { return n + a.links.length; }, 0)
    };
  }

  /* ── Library virtual view (reference-based, no duplicated records) ── */
  /** Derived link items for the Library page; ids are namespaced so they can
      never collide with real state.library ids. Read-only: manage them in
      the Lamaran section. */
  function libraryLinks(state) {
    var out = [];
    list(state).forEach(function (a) {
      a.links.forEach(function (l) {
        out.push({
          id: MODULE_ID + ':' + a.id + ':' + l.id,
          virtual: true,
          type: 'link',
          source: { module: MODULE_ID, entityId: a.id },
          title: l.label,
          description: l.notes,
          url: l.url,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
          taskIds: [], goalIds: [], milestoneRefs: [],
          application: { id: a.id, position: a.position, company: a.company, status: a.status, linkId: l.id }
        });
      });
    });
    return out;
  }

  /* Same filter semantics as library.query, applied to the virtual link items
     (type is always 'link'; they belong to no goal and can never be "missing"). */
  function libraryQuery(state, opts) {
    opts = opts || {};
    var q = String(opts.search || '').trim().toLowerCase();
    return libraryLinks(state).filter(function (it) {
      if (opts.date && library.addedDay(it.createdAt) !== opts.date) return false;
      if (opts.type && opts.type !== 'all' && opts.type !== 'link') return false;
      if (opts.module && opts.module !== 'all' && opts.module !== MODULE_ID) return false;
      if (opts.goalId && opts.goalId !== 'all') return false;
      if (opts.missingOnly) return false;
      if (q && (it.title + ' ' + (it.description || '') + ' ' + it.url).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  return {
    STATUSES: STATUSES, STATUS_LABEL: STATUS_LABEL, STATUS_TONE: STATUS_TONE, TERMINAL: TERMINAL,
    SOURCES: SOURCES, SOURCE_LABEL: SOURCE_LABEL, SOON_DAYS: SOON_DAYS, LIMITS: LIMITS,
    MODULE_ID: MODULE_ID, MODULE_LABEL: MODULE_LABEL,
    normalize: normalize, list: list, find: find, findLink: findLink,
    validUrl: validUrl, validEmail: validEmail,
    validateApplication: validateApplication, validateLink: validateLink,
    createApplication: createApplication, updateApplication: updateApplication,
    setStatus: setStatus, deleteApplication: deleteApplication,
    addLink: addLink, updateLink: updateLink, removeLink: removeLink,
    query: query, dateInfo: dateInfo, reminders: reminders,
    everReached: everReached, summary: summary, libraryLinks: libraryLinks, libraryQuery: libraryQuery
  };
});