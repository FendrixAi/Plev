'use strict';
/* Manajemen Lamaran Kerja — data layer (shared/jobApps.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const dates = require('../shared/dates.js');
const store = require('../shared/store.js');
const library = require('../shared/library.js');
const backup = require('../shared/backup.js');
const J = require('../shared/jobApps.js');

const TODAY = '2026-11-17';
const T = (day, h = 12) => { const p = dates.parseDay(day); return new Date(p.y, p.m - 1, p.d, h, 0).getTime(); };
const base = () => ({ position: 'Frontend Engineer', company: 'PT Maju Jaya', status: 'applied', applicationDate: '2026-11-10' });

test('normalize: state lama mendapat daftar kosong; data lain tidak tersentuh', () => {
  const s = store.createState();
  store.addTask(s, { title: 'Tugas lama', targetDate: TODAY }, T(TODAY));
  assert.deepEqual(J.normalize(s, T(TODAY)), []);
  assert.equal(s.tasks.length, 1);
  assert.equal(s.version, store.SCHEMA_VERSION);
});

test('create: field wajib divalidasi, entri riwayat awal dibuat, createdAt/updatedAt otomatis', () => {
  const s = store.createState(); J.normalize(s);
  const bad = J.createApplication(s, { position: '', company: 'X', applicationDate: '2026-13-40' }, T(TODAY));
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.position && bad.errors.applicationDate && bad.errors.status === undefined);
  const r = J.createApplication(s, base(), T(TODAY, 9));
  assert.equal(r.ok, true);
  const a = r.app;
  assert.equal(a.createdAt, T(TODAY, 9));
  assert.equal(a.updatedAt, T(TODAY, 9));
  assert.equal(a.history.length, 1);
  assert.deepEqual([a.history[0].previousStatus, a.history[0].newStatus, a.history[0].changedAt], [null, 'applied', T(TODAY, 9)]);
  assert.ok(s.events.some((e) => e.kind === 'jobapp.created'));
});

test('create: URL hanya http/https dan tanpa kredensial; email opsional divalidasi', () => {
  const s = store.createState(); J.normalize(s);
  const cases = [
    ['jobUrl', 'javascript:alert(1)'], ['jobUrl', 'ftp://x.com/a'], ['gmailUrl', 'https://user:pass@mail.google.com/'],
    ['jobUrl', 'bukan url'], ['recruiterEmail', 'bukan-email']
  ];
  cases.forEach(([k, v]) => {
    const r = J.createApplication(s, Object.assign(base(), { [k]: v }), T(TODAY));
    assert.equal(r.ok, false, k + '=' + v);
    assert.ok(r.errors[k], k);
  });
  const ok = J.createApplication(s, Object.assign(base(), {
    jobUrl: 'https://linkedin.com/jobs/1', gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/abc',
    recruiterEmail: 'hr@maju.co.id', source: 'linkedin'
  }), T(TODAY));
  assert.equal(ok.ok, true);
  assert.equal(J.createApplication(s, Object.assign(base(), { source: 'tiktok' }), T(TODAY)).ok, false);
});

test('status: perubahan manual apa pun diizinkan, riwayat append-only, event berulang tidak duplikat', () => {
  const s = store.createState(); J.normalize(s);
  const a = J.createApplication(s, base(), T(TODAY, 9)).app;
  // bukan urutan kaku: langsung ke MCU lalu mundur ke interview
  assert.equal(J.setStatus(s, a.id, 'mcu', 'Jadwal MCU', T(TODAY, 10)).statusChanged, true);
  assert.equal(J.setStatus(s, a.id, 'interview', '', T(TODAY, 11)).statusChanged, true);
  assert.equal(J.setStatus(s, a.id, 'interview', 'klik ganda', T(TODAY, 12)).changed, false);
  assert.equal(a.history.length, 3);
  assert.deepEqual(a.history.map((h) => h.newStatus), ['applied', 'mcu', 'interview']);
  assert.equal(a.history[1].previousStatus, 'applied');
  assert.equal(a.history[1].notes, 'Jadwal MCU');
  assert.equal(a.history[2].previousStatus, 'mcu');
  assert.equal(a.status, 'interview');
});

test('update: edit field non-status tidak menambah riwayat; updatedAt berubah', () => {
  const s = store.createState(); J.normalize(s);
  const a = J.createApplication(s, base(), T(TODAY, 9)).app;
  const r = J.updateApplication(s, a.id, { company: 'PT Lain', notes: 'catatan' }, T(TODAY, 10));
  assert.equal(r.changed, true);
  assert.equal(r.statusChanged, false);
  assert.equal(a.history.length, 1);
  assert.equal(a.updatedAt, T(TODAY, 10));
  assert.equal(J.updateApplication(s, a.id, { company: 'PT Lain', notes: 'catatan' }, T(TODAY, 11)).changed, false);
  assert.equal(J.updateApplication(s, 'tidak-ada', { company: 'X' }, T(TODAY)).reason, 'not-found');
  // patch parsial mempertahankan field lain
  assert.equal(a.position, 'Frontend Engineer');
});

test('delete: hanya record lamaran yang hilang; file Library tidak tersentuh', () => {
  const s = store.createState(); J.normalize(s); library.normalize(s);
  const a = J.createApplication(s, base(), T(TODAY)).app;
  library.registerFile(s, { fileName: 'libfile_aa_CV.pdf', originalName: 'CV.pdf', size: 10, contentHash: 'a'.repeat(64), source: { module: 'library', entityId: null } }, T(TODAY));
  J.addLink(s, a.id, { label: 'Lowongan', url: 'https://jobstreet.co.id/x' }, T(TODAY));
  const r = J.deleteApplication(s, a.id, T(TODAY, 13));
  assert.equal(r.ok, true);
  assert.equal(J.list(s).length, 0);
  assert.equal(s.library.length, 1);
  assert.equal(J.deleteApplication(s, a.id, T(TODAY)).reason, 'not-found');
});

test('links: CRUD per lamaran, validasi URL, banyak tautan, updatedAt induk ikut', () => {
  const s = store.createState(); J.normalize(s);
  const a = J.createApplication(s, base(), T(TODAY, 9)).app;
  assert.equal(J.addLink(s, a.id, { label: '', url: 'https://x.com' }, T(TODAY)).ok, false);
  assert.equal(J.addLink(s, a.id, { label: 'X', url: 'https://u:p@x.com' }, T(TODAY)).ok, false);
  const l1 = J.addLink(s, a.id, { label: 'Lowongan', url: 'https://linkedin.com/jobs/1', notes: 'via LinkedIn' }, T(TODAY, 10)).link;
  const l2 = J.addLink(s, a.id, { label: 'Gmail HR', url: 'https://mail.google.com/x' }, T(TODAY, 10)).link;
  assert.equal(a.links.length, 2);
  assert.equal(a.updatedAt, T(TODAY, 10));
  assert.equal(J.updateLink(s, a.id, l1.id, { label: 'Lowongan resmi' }, T(TODAY, 11)).changed, true);
  assert.equal(l1.label, 'Lowongan resmi');
  assert.equal(J.updateLink(s, a.id, l1.id, { label: 'Lowongan resmi' }, T(TODAY, 12)).changed, false);
  assert.equal(J.removeLink(s, a.id, l2.id, T(TODAY, 13)).ok, true);
  assert.equal(a.links.length, 1);
  assert.equal(J.removeLink(s, a.id, l2.id, T(TODAY)).reason, 'link-not-found');
  assert.equal(J.addLink(s, 'x', { label: 'a', url: 'https://x.com' }, T(TODAY)).reason, 'not-found');
});

test('query: pencarian posisi/perusahaan, filter status, urut tanggal & terbaru', () => {
  const s = store.createState(); J.normalize(s);
  const a = J.createApplication(s, Object.assign(base(), { applicationDate: '2026-11-01' }), T('2026-11-01')).app;
  const b = J.createApplication(s, { position: 'Backend Engineer', company: 'CV Mundur', applicationDate: '2026-11-10', status: 'interview' }, T('2026-11-10')).app;
  const c = J.createApplication(s, { position: 'Data Analyst', company: 'PT Maju Jaya', applicationDate: '2026-11-05' }, T('2026-11-05')).app;
  assert.deepEqual(J.query(s, { search: 'maju' }).map((x) => x.id), [c.id, a.id]);
  assert.deepEqual(J.query(s, { search: 'backend' }).map((x) => x.id), [b.id]);
  assert.deepEqual(J.query(s, { status: 'interview' }).map((x) => x.id), [b.id]);
  assert.deepEqual(J.query(s, { sort: 'date' }).map((x) => x.id), [b.id, c.id, a.id]);
  assert.deepEqual(J.query(s, { sort: 'date-asc' }).map((x) => x.id), [a.id, c.id, b.id]);
  J.setStatus(s, a.id, 'psikotest', '', T(TODAY, 15));
  assert.deepEqual(J.query(s, { sort: 'updated' }).map((x) => x.id), [a.id, b.id, c.id]);
});

test('reminders: jadwal mendatang + follow-up lewat ditandai; hasil akhir dilewati', () => {
  const s = store.createState(); J.normalize(s);
  const a = J.createApplication(s, Object.assign(base(), { nextSchedule: '2026-11-20', followUpDate: '2026-11-15' }), T(TODAY)).app;
  const b = J.createApplication(s, { position: 'X', company: 'Y', applicationDate: '2026-11-01', status: 'ditolak', followUpDate: '2026-11-01' }, T(TODAY)).app;
  const r = J.reminders(s, TODAY);
  assert.equal(r.length, 2);
  assert.equal(r[0].kind, 'followup');
  assert.equal(r[0].overdue, true);
  assert.equal(r[0].days, -2);
  assert.equal(r[1].kind, 'schedule');
  assert.equal(r[1].soon, true);
  assert.equal(r[1].days, 3);
  assert.ok(!r.some((x) => x.appId === b.id));
  J.setStatus(s, a.id, 'diterima', '', T(TODAY));
  assert.equal(J.reminders(s, TODAY).length, 0);
});

test('summary: hitung lamaran UNIK, konversi dari tahap yang pernah dicapai, nol aman', () => {
  const s = store.createState(); J.normalize(s);
  const empty = J.summary(s, {});
  assert.equal(empty.total, 0);
  assert.equal(empty.conversions.appliedToInterview.pct, null);
  assert.equal(empty.conversions.interviewToOffering.pct, null);
  const a = J.createApplication(s, Object.assign(base(), { applicationDate: '2026-10-05' }), T('2026-10-05')).app;
  const b = J.createApplication(s, { position: 'B', company: 'Y', applicationDate: '2026-11-02' }, T('2026-11-02')).app;
  const c = J.createApplication(s, { position: 'C', company: 'Z', applicationDate: '2026-11-03' }, T('2026-11-03')).app;
  J.setStatus(s, a.id, 'interview', '', T('2026-10-10'));
  J.setStatus(s, a.id, 'offering', '', T('2026-10-15'));
  J.setStatus(s, a.id, 'diterima', '', T('2026-10-20'));
  J.setStatus(s, b.id, 'interview', '', T('2026-11-05'));
  J.setStatus(s, b.id, 'ditolak', '', T('2026-11-08'));
  J.setStatus(s, c.id, 'no_response', '', T('2026-11-10'));
  const sum = J.summary(s, {});
  assert.equal(sum.total, 3);
  assert.equal(sum.byStatus.diterima, 1);
  assert.equal(sum.byStatus.ditolak, 1);
  assert.equal(sum.byStatus.no_response, 1);
  // a pernah interview→offering→diterima; b pernah interview. Unik, bukan event.
  assert.deepEqual(sum.conversions.appliedToInterview, { num: 2, den: 3, pct: 67 });
  assert.deepEqual(sum.conversions.interviewToOffering, { num: 1, den: 2, pct: 50 });
  assert.deepEqual(sum.conversions.offeringToAccepted, { num: 1, den: 1, pct: 100 });
  assert.deepEqual(sum.conversions.overallAcceptance, { num: 1, den: 3, pct: 33 });
  assert.deepEqual(sum.months.map((m) => m.month), ['2026-10', '2026-11']);
  assert.equal(sum.months[0].accepted, 1);
  // rentang tanggal pada applicationDate
  const nov = J.summary(s, { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(nov.total, 2);
  assert.equal(nov.byStatus.diterima, 0);
  assert.equal(nov.conversions.overallAcceptance.pct, 0);
});

test('everReached tetap true walau status mundur (riwayat tidak dihapus)', () => {
  const s = store.createState(); J.normalize(s);
  const a = J.createApplication(s, base(), T(TODAY)).app;
  J.setStatus(s, a.id, 'offering', '', T(TODAY, 10));
  J.setStatus(s, a.id, 'applied', 'salah klik, balik', T(TODAY, 11));
  assert.equal(J.everReached(a, 'offering'), true);
  assert.equal(J.summary(s, {}).conversions.interviewToOffering.den, 0);
});

test('libraryLinks: tampilan virtual berbasis referensi, id tidak bentrok dengan Library asli', () => {
  const s = store.createState(); J.normalize(s); library.normalize(s);
  const a = J.createApplication(s, base(), T(TODAY)).app;
  const l = J.addLink(s, a.id, { label: 'Lowongan', url: 'https://linkedin.com/jobs/1' }, T(TODAY)).link;
  const items = J.libraryLinks(s);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'lamaran:' + a.id + ':' + l.id);
  assert.equal(items[0].virtual, true);
  assert.equal(items[0].type, 'link');
  assert.equal(items[0].source.module, 'lamaran');
  assert.equal(items[0].url, l.url);
  assert.equal(s.library.length, 0); // tidak ada duplikasi record
  assert.equal(library.moduleLabel('lamaran'), 'Lamaran Kerja');
});

test('normalize: memperbaiki data rusak, mensintesis riwayat awal, membuang duplikat berurutan', () => {
  const s = store.createState();
  s.jobApps = [
    { id: 'a1', position: 'P', company: 'C', status: 'interview', applicationDate: '2026-11-01', createdAt: T('2026-11-01'), history: [], links: [{ label: 'x', url: 'https://x.com' }, { label: 'bad', url: 'javascript:x' }] },
    { id: 'a1', position: 'Dup', company: 'C', applicationDate: '2026-11-02' },
    { id: 'a2', position: 'Q', company: 'D', status: 'offering', applicationDate: '2026-11-03', history: [
      { previousStatus: 'applied', newStatus: 'interview', changedAt: T('2026-11-04') },
      { previousStatus: 'applied', newStatus: 'interview', changedAt: T('2026-11-04') },
      { previousStatus: 'interview', newStatus: 'offering', changedAt: T('2026-11-05') }
    ] },
    null, 'rusak'
  ];
  J.normalize(s, T(TODAY));
  assert.equal(s.jobApps.length, 3);
  assert.notEqual(s.jobApps[0].id, s.jobApps[1].id);
  assert.equal(s.jobApps[0].history.length, 1);
  assert.equal(s.jobApps[0].history[0].newStatus, 'interview');
  assert.equal(s.jobApps[0].links.length, 1);
  assert.equal(s.jobApps[2].history.length, 2);
});

test('backup: cadangan dengan jobApps valid diterima; bagian rusak ditolak', () => {
  const s = store.createState(); J.normalize(s);
  J.createApplication(s, base(), T(TODAY));
  const text = JSON.stringify({ app: 'jam-fokus', exportedAt: new Date(T(TODAY)).toISOString(), state: s });
  const r = backup.validate(text);
  assert.equal(r.ok, true);
  assert.equal(r.summary.jobApps, 1);
  const bad = JSON.parse(text);
  bad.state.jobApps = [{ position: 123, company: 'C' }];
  assert.equal(backup.validate(JSON.stringify(bad)).ok, false);
  bad.state.jobApps = 'bukan array';
  assert.equal(backup.validate(JSON.stringify(bad)).ok, false);
});

test('wiring: jobApps dinormalisasi di core.js dan dimuat setelah library di index.html', () => {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  const core = fs.readFileSync(path.join(root, 'renderer/core.js'), 'utf8');
  assert.equal((core.match(/JF\.jobApps\.normalize\(state\)/g) || []).length, 2);
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(idx.indexOf('shared/jobApps.js') > idx.indexOf('shared/library.js'));
  assert.ok(idx.indexOf('shared/jobApps.js') < idx.indexOf('renderer/core.js'));
});