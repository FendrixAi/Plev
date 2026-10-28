'use strict';
/* Goals & milestones: data layer, progress formulas, task links, persistence, backup. */
const test = require('node:test');
const assert = require('node:assert/strict');
const dates = require('../shared/dates.js');
const store = require('../shared/store.js');
const goals = require('../shared/goals.js');
const journal = require('../shared/journal.js');
const backup = require('../shared/backup.js');

function T(day, h = 12) { const p = dates.parseDay(day); return new Date(p.y, p.m - 1, p.d, h, 0, 0, 0).getTime(); }
const DAY = '2026-10-27';
function fresh() { return store.createState(); }
function mkGoal(s, over) {
  const r = goals.createGoal(s, Object.assign({ title: 'Lulus sertifikasi', startDate: DAY }, over || {}), T(DAY, 9));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.goal;
}
function mkTask(s, title, day) { return store.addTask(s, { title, targetDate: day || DAY }, T(day || DAY, 8)); }
const reload = (s) => { const back = JSON.parse(JSON.stringify(s)); goals.normalize(back, T(DAY, 23)); return back; };

/* ── goals ─────────────────────────────────────────────────────────── */
test('state baru punya daftar goal kosong; state lama dinormalisasi tanpa merusak data lain', () => {
  assert.deepEqual(fresh().goals, []);
  const legacy = fresh(); delete legacy.goals;
  mkTask(legacy, 'Tugas lama');
  goals.normalize(legacy);
  assert.deepEqual(legacy.goals, []);
  assert.equal(legacy.tasks.length, 1);
});

test('membuat goal: id stabil, timestamp, default status dan metode', () => {
  const s = fresh();
  const g = mkGoal(s, { description: 'Data analyst', category: 'Karier', deadline: '2026-12-31' });
  assert.match(g.id, /^goal_/);
  assert.equal(g.status, 'not_started');
  assert.equal(g.progressMethod, 'milestones');
  assert.equal(g.createdAt, T(DAY, 9));
  assert.equal(g.updatedAt, T(DAY, 9));
  assert.equal(g.category, 'Karier');
  assert.deepEqual(g.milestones, []);
  assert.equal(goals.find(s, g.id), g);
  assert.ok(s.events.some((e) => e.kind === 'goal.created'));
});

test('validasi: judul wajib, tanggal valid, tenggat tidak sebelum mulai, status/metode dikenal', () => {
  const s = fresh();
  let r = goals.createGoal(s, { title: '  ', startDate: DAY });
  assert.equal(r.ok, false); assert.ok(r.errors.title);
  r = goals.createGoal(s, { title: 'A', startDate: '2026-02-30' });
  assert.ok(r.errors.startDate);
  r = goals.createGoal(s, { title: 'A', startDate: DAY, deadline: '2026-10-01' });
  assert.match(r.errors.deadline, /sebelum tanggal mulai/);
  r = goals.createGoal(s, { title: 'A', startDate: DAY, deadline: 'besok' });
  assert.ok(r.errors.deadline);
  r = goals.createGoal(s, { title: 'A', startDate: DAY, status: 'done' });
  assert.ok(r.errors.status);
  r = goals.createGoal(s, { title: 'A', startDate: DAY, progressMethod: 'focus-time' });
  assert.ok(r.errors.progressMethod);
  r = goals.createGoal(s, { title: 'x'.repeat(121), startDate: DAY });
  assert.ok(r.errors.title);
  assert.equal(s.goals.length, 0, 'input tidak valid tidak boleh menyimpan apa pun');
  assert.equal(goals.createGoal(s, { title: 'A', startDate: DAY, deadline: DAY }).ok, true, 'tenggat = mulai boleh');
});

test('mengedit goal memperbarui updatedAt dan tidak mengubah createdAt; edit kosong bukan perubahan', () => {
  const s = fresh();
  const g = mkGoal(s);
  let r = goals.updateGoal(s, g.id, { title: 'Judul baru', status: 'in_progress' }, T(DAY, 15));
  assert.equal(r.changed, true);
  assert.equal(g.title, 'Judul baru');
  assert.equal(g.createdAt, T(DAY, 9));
  assert.equal(g.updatedAt, T(DAY, 15));
  r = goals.updateGoal(s, g.id, { title: 'Judul baru' }, T(DAY, 16));
  assert.equal(r.changed, false);
  assert.equal(g.updatedAt, T(DAY, 15));
  r = goals.updateGoal(s, g.id, { deadline: '2020-01-01' }, T(DAY, 16));
  assert.equal(r.ok, false);
  assert.equal(g.deadline, null, 'perubahan tidak valid tidak diterapkan sebagian');
});

test('menyelesaikan dan membuka kembali goal tidak menyentuh tugas maupun milestone', () => {
  const s = fresh();
  const g = mkGoal(s);
  const t = mkTask(s, 'Latihan soal');
  goals.addMilestone(s, g.id, { title: 'Modul 1' }, T(DAY, 10));
  goals.linkTask(s, g.id, t.id, null, T(DAY, 10));
  const r = goals.completeGoal(s, g.id, T(DAY, 18));
  assert.equal(r.changed, true);
  assert.equal(g.status, 'completed');
  assert.equal(g.completedAt, T(DAY, 18));
  assert.equal(t.done, false, 'tugas tidak boleh ikut selesai');
  assert.equal(g.milestones[0].done, false, 'milestone tidak boleh ikut selesai');
  assert.equal(goals.completeGoal(s, g.id, T(DAY, 19)).changed, false);
  goals.reopenGoal(s, g.id, T(DAY, 20));
  assert.equal(g.status, 'in_progress');
  assert.equal(g.completedAt, null);
});

test('arsip goal dapat dipulihkan, menyimpan milestone/tautan, dan mengunci perubahan', () => {
  const s = fresh();
  const g = mkGoal(s);
  const t = mkTask(s, 'Baca bab 1');
  const m = goals.addMilestone(s, g.id, { title: 'Bab 1' }, T(DAY, 10)).milestone;
  goals.linkTask(s, g.id, t.id, m.id, T(DAY, 10));
  goals.archiveGoal(s, g.id, T(DAY, 11));
  assert.equal(g.archived, true);
  assert.equal(s.goals.length, 1, 'arsip bukan hapus');
  assert.deepEqual(g.milestones[0].taskIds, [t.id]);
  assert.ok(store.find(s, t.id), 'tugas tetap ada');
  assert.equal(goals.addMilestone(s, g.id, { title: 'X' }).reason, 'archived');
  assert.equal(goals.updateGoal(s, g.id, { title: 'X' }).reason, 'archived');
  assert.equal(goals.overview(s, DAY).archived, 1);
  assert.equal(goals.overview(s, DAY).active, 0);
  goals.restoreGoal(s, g.id, T(DAY, 12));
  assert.equal(g.archived, false);
  assert.equal(goals.overview(s, DAY).active, 1);
});

/* ── milestones ────────────────────────────────────────────────────── */
test('milestone: buat, ubah, selesaikan, buka kembali, urutkan, hapus', () => {
  const s = fresh();
  const g = mkGoal(s);
  const a = goals.addMilestone(s, g.id, { title: 'A', criteria: 'Skor >= 80', deadline: '2026-11-10' }, T(DAY, 10)).milestone;
  const b = goals.addMilestone(s, g.id, { title: 'B' }, T(DAY, 10)).milestone;
  const c = goals.addMilestone(s, g.id, { title: 'C' }, T(DAY, 10)).milestone;
  assert.equal(a.goalId, g.id);
  assert.equal(a.criteria, 'Skor >= 80');
  assert.equal(b.deadline, null, 'tenggat milestone opsional');
  assert.notEqual(a.id, b.id);

  assert.equal(goals.addMilestone(s, g.id, { title: '' }).ok, false);
  assert.equal(goals.addMilestone(s, g.id, { title: 'D', deadline: '31-12-2026' }).ok, false);

  goals.updateMilestone(s, g.id, b.id, { title: 'B2', description: 'detail' }, T(DAY, 11));
  assert.equal(b.title, 'B2');
  assert.equal(b.description, 'detail');

  assert.equal(goals.nextMilestone(g).id, a.id);
  goals.completeMilestone(s, g.id, a.id, T(DAY, 12));
  assert.equal(a.done, true);
  assert.equal(a.completedAt, T(DAY, 12));
  assert.equal(goals.nextMilestone(g).id, b.id);
  goals.reopenMilestone(s, g.id, a.id, T(DAY, 13));
  assert.equal(a.done, false);
  assert.equal(a.completedAt, null);

  goals.moveMilestone(s, g.id, c.id, -2, T(DAY, 14));
  assert.deepEqual(g.milestones.map((m) => m.title), ['C', 'A', 'B2']);
  assert.equal(goals.moveMilestone(s, g.id, c.id, -1).changed, false, 'tidak bisa naik melewati awal');
  goals.moveMilestone(s, g.id, c.id, 1, T(DAY, 14));
  assert.deepEqual(g.milestones.map((m) => m.title), ['A', 'C', 'B2']);

  const t = mkTask(s, 'Terkait C');
  goals.linkTask(s, g.id, t.id, c.id);
  goals.removeMilestone(s, g.id, c.id, T(DAY, 15));
  assert.deepEqual(g.milestones.map((m) => m.title), ['A', 'B2']);
  assert.ok(store.find(s, t.id), 'menghapus milestone tidak menghapus tugas');
  assert.equal(goals.locationOf(g, t.id), undefined);
});

/* ── progress ──────────────────────────────────────────────────────── */
test('progres milestone = selesai / total; nol milestone menghasilkan null', () => {
  const s = fresh();
  const g = mkGoal(s);
  let p = goals.progress(s, g);
  assert.equal(p.pct, null);
  assert.equal(p.total, 0);
  const ids = ['A', 'B', 'C'].map((t) => goals.addMilestone(s, g.id, { title: t }).milestone.id);
  assert.equal(goals.progress(s, g).pct, 0);
  goals.completeMilestone(s, g.id, ids[0]);
  p = goals.progress(s, g);
  assert.deepEqual([p.done, p.total, p.pct], [1, 3, 33]);
  ids.forEach((id) => goals.completeMilestone(s, g.id, id));
  assert.equal(goals.progress(s, g).pct, 100);
});

test('progres tugas memakai status tugas asli, tanpa hitung ganda, mengabaikan arsip/hilang', () => {
  const s = fresh();
  const g = mkGoal(s, { progressMethod: 'tasks' });
  assert.equal(goals.progress(s, g).pct, null, 'tanpa tugas = null, bukan 0 atau NaN');
  const m = goals.addMilestone(s, g.id, { title: 'M' }).milestone;
  const t1 = mkTask(s, 'T1'), t2 = mkTask(s, 'T2'), t3 = mkTask(s, 'T3');
  goals.linkTask(s, g.id, t1.id, null);
  goals.linkTask(s, g.id, t2.id, m.id);
  goals.linkTask(s, g.id, t3.id, m.id);
  assert.equal(goals.progress(s, g).pct, 0);
  store.completeTask(s, t1.id, T(DAY, 13));
  let p = goals.progress(s, g);
  assert.deepEqual([p.done, p.total, p.pct], [1, 3, 33]);
  store.reopenTask(s, t1.id, T(DAY, 14));
  assert.equal(goals.progress(s, g).done, 0, 'membuka kembali tugas langsung tercermin');
  store.completeTask(s, t1.id, T(DAY, 15));
  store.archiveTask(s, t3.id, T(DAY, 15));
  p = goals.progress(s, g);
  assert.deepEqual([p.done, p.total, p.archived], [1, 2, 1]);
  s.tasks = s.tasks.filter((t) => t.id !== t2.id);       // e.g. restored from an older backup
  p = goals.progress(s, g);
  assert.deepEqual([p.done, p.total, p.missing, p.pct], [1, 1, 1, 100]);
  const refs = goals.taskRefs(s, g);
  assert.equal(refs.find((r) => r.taskId === t2.id).status, 'missing');
  assert.equal(refs.find((r) => r.taskId === t2.id).task, null);
});

test('progres target: validasi angka, batas 100%, denominator nol', () => {
  const s = fresh();
  let r = goals.createGoal(s, { title: 'Latihan', startDate: DAY, progressMethod: 'target', target: { value: 0 } });
  assert.ok(r.errors.targetValue);
  r = goals.createGoal(s, { title: 'Latihan', startDate: DAY, progressMethod: 'target', target: { value: 'abc' } });
  assert.ok(r.errors.targetValue);
  r = goals.createGoal(s, { title: 'Latihan', startDate: DAY, progressMethod: 'target', target: { value: 20, current: -1 } });
  assert.ok(r.errors.targetCurrent);
  const g = mkGoal(s, { progressMethod: 'target', target: { value: '20', current: '5', unit: 'latihan' } });
  let p = goals.progress(s, g);
  assert.deepEqual([p.done, p.total, p.pct, p.unit], [5, 20, 25, 'latihan']);
  goals.updateGoal(s, g.id, { target: { value: 20, current: 26, unit: 'latihan' } });
  p = goals.progress(s, g);
  assert.equal(p.pct, 100, 'tidak boleh melewati 100%');
  assert.equal(p.overTarget, true);
  g.target = null;   // corrupted / missing target
  p = goals.progress(s, g);
  assert.equal(p.pct, null);
});

test('status manual "Selesai" dibedakan dari progres terhitung', () => {
  const s = fresh();
  const g = mkGoal(s);
  goals.addMilestone(s, g.id, { title: 'A' });
  goals.completeGoal(s, g.id);
  const p = goals.progress(s, g);
  assert.equal(p.manualComplete, true);
  assert.equal(p.pct, 0, 'menandai selesai tidak memalsukan progres');
});

/* ── task links ────────────────────────────────────────────────────── */
test('menautkan tugas hanya menyimpan referensi id dan tidak menggandakan tugas', () => {
  const s = fresh();
  const g = mkGoal(s);
  const t = mkTask(s, 'Kerjakan latihan');
  const before = JSON.stringify(s.tasks);
  const r = goals.linkTask(s, g.id, t.id, null, T(DAY, 10));
  assert.equal(r.ok, true);
  assert.deepEqual(g.taskIds, [t.id]);
  assert.equal(s.tasks.length, 1);
  assert.equal(JSON.stringify(s.tasks), before, 'record tugas tidak berubah');
  assert.equal(goals.linkTask(s, g.id, t.id, null).changed, false);
  assert.equal(goals.linkTask(s, g.id, 'task_tidak_ada', null).reason, 'task-not-found');
  store.archiveTask(s, mkTask(s, 'Lama').id);
  assert.equal(goals.linkTask(s, g.id, s.tasks[1].id, null).reason, 'task-archived');
  assert.equal(goals.linkTask(s, g.id, t.id, 'ms_x').reason, 'milestone-not-found');
});

test('tugas yang ditautkan ke milestone lain dalam goal yang sama dipindah, bukan digandakan', () => {
  const s = fresh();
  const g = mkGoal(s, { progressMethod: 'tasks' });
  const a = goals.addMilestone(s, g.id, { title: 'A' }).milestone;
  const b = goals.addMilestone(s, g.id, { title: 'B' }).milestone;
  const t = mkTask(s, 'Dipakai bersama');
  goals.linkTask(s, g.id, t.id, a.id);
  const r = goals.linkTask(s, g.id, t.id, b.id);
  assert.equal(r.moved, true);
  assert.deepEqual(a.taskIds, []);
  assert.deepEqual(b.taskIds, [t.id]);
  assert.equal(goals.progress(s, g).total, 1);
  // Another goal may reference the same task independently.
  const g2 = mkGoal(s, { title: 'Goal lain', progressMethod: 'tasks' });
  goals.linkTask(s, g2.id, t.id, null);
  assert.equal(goals.goalsForTask(s, t.id).length, 2);
});

test('melepas tautan tidak menyentuh tugas dan bisa membersihkan referensi yang hilang', () => {
  const s = fresh();
  const g = mkGoal(s);
  const t = mkTask(s, 'X');
  goals.linkTask(s, g.id, t.id, null);
  store.completeTask(s, t.id);
  goals.unlinkTask(s, g.id, t.id);
  assert.deepEqual(g.taskIds, []);
  assert.equal(store.find(s, t.id).done, true);
  g.taskIds.push('task_hilang');
  assert.equal(goals.unlinkTask(s, g.id, 'task_hilang').changed, true);
  assert.deepEqual(g.taskIds, []);
});

/* ── deadlines & overview ──────────────────────────────────────────── */
test('tenggat dekat/terlambat dan metrik ringkasan berasal dari data tersimpan', () => {
  const s = fresh();
  assert.deepEqual(goals.overview(s, DAY), { total: 0, active: 0, completed: 0, archived: 0, milestonesDone: 0, milestonesTotal: 0, dueSoon: 0, overdue: 0 });
  const g = mkGoal(s, { startDate: '2026-10-01', deadline: '2026-11-01' });
  const late = goals.addMilestone(s, g.id, { title: 'Lewat', deadline: '2026-10-20' }).milestone;
  goals.addMilestone(s, g.id, { title: 'Jauh', deadline: '2026-12-20' });
  const doneMs = goals.addMilestone(s, g.id, { title: 'Sudah', deadline: '2026-10-28' }).milestone;
  goals.completeMilestone(s, g.id, doneMs.id);
  const g2 = mkGoal(s, { title: 'Selesai', deadline: '2026-10-28' });
  goals.completeGoal(s, g2.id);
  const o = goals.overview(s, DAY);
  assert.deepEqual([o.active, o.completed, o.milestonesDone, o.milestonesTotal], [1, 1, 1, 3]);
  assert.equal(o.overdue, 1);
  assert.equal(o.dueSoon, 1, 'tenggat goal 5 hari lagi');
  const list = goals.upcomingDeadlines(s, DAY);
  assert.equal(list[0].milestoneId, late.id);
  assert.equal(list[0].overdue, true);
  assert.ok(!list.some((d) => d.milestoneId === doneMs.id), 'milestone selesai tidak dihitung');
  assert.ok(!list.some((d) => d.goalId === g2.id), 'goal selesai tidak dihitung');
  assert.deepEqual(goals.deadlineInfo('2026-10-27', DAY), { deadline: DAY, days: 0, overdue: false, soon: true });
  assert.equal(goals.deadlineInfo(null, DAY), null);
});

/* ── persistence ───────────────────────────────────────────────────── */
test('goal, milestone, dan tautan bertahan setelah serialisasi ulang (muat ulang/restart)', () => {
  const s = fresh();
  const g = mkGoal(s, { progressMethod: 'tasks', category: 'Belajar' });
  const m = goals.addMilestone(s, g.id, { title: 'M', deadline: '2026-11-02' }).milestone;
  const t = mkTask(s, 'T');
  goals.linkTask(s, g.id, t.id, m.id);
  store.completeTask(s, t.id);
  const back = reload(s);
  const g2 = goals.find(back, g.id);
  assert.deepEqual(g2, g);
  assert.equal(goals.progress(back, g2).pct, 100);
  assert.deepEqual(reload(back).goals, back.goals, 'normalisasi idempoten');
});

test('normalisasi memperbaiki data goal yang tidak lengkap tanpa membuang data valid', () => {
  const s = fresh();
  s.goals = [
    null, 'rusak',
    { id: 'g1', title: 'Valid', startDate: DAY, status: 'aneh', progressMethod: 'x', milestones: [{ title: 'M1', taskIds: [5, 5, 'a'] }, 7], taskIds: ['a', 'b'] },
    { id: 'g1', title: '', deadline: '1999-01-01' }
  ];
  goals.normalize(s, T(DAY, 9));
  assert.equal(s.goals.length, 2);
  const [a, b] = s.goals;
  assert.equal(a.status, 'not_started');
  assert.equal(a.progressMethod, 'milestones');
  assert.equal(a.milestones.length, 1);
  assert.equal(a.milestones[0].goalId, 'g1');
  assert.deepEqual(a.milestones[0].taskIds, ['5', 'a']);
  assert.deepEqual(a.taskIds, ['b'], 'tugas tidak boleh tercatat di dua lokasi dalam satu goal');
  assert.notEqual(b.id, 'g1', 'id ganda diberi id baru');
  assert.equal(b.title, 'Goal tanpa judul');
  assert.equal(b.deadline, null);
});

/* ── backup ────────────────────────────────────────────────────────── */
const wrap = (state) => JSON.stringify({ app: 'jam-fokus', exportedAt: '2026-10-27T02:00:00.000Z', state });

test('ekspor/impor cadangan menyertakan goals', () => {
  const s = fresh();
  const g = mkGoal(s);
  goals.addMilestone(s, g.id, { title: 'M' });
  const r = backup.validate(wrap(s));
  assert.equal(r.ok, true, r.error);
  assert.equal(r.summary.goals, 1);
  goals.normalize(r.state);
  assert.deepEqual(r.state.goals, s.goals);
});

test('cadangan lama tanpa goals tetap diterima dan dinormalisasi menjadi daftar kosong', () => {
  const s = fresh();
  delete s.goals;
  const r = backup.validate(wrap(s));
  assert.equal(r.ok, true);
  assert.equal(r.summary.goals, 0);
  goals.normalize(r.state);
  assert.deepEqual(r.state.goals, []);
});

test('cadangan dengan goals rusak ditolak sebelum mengganti data', () => {
  const bad = [
    { goals: {} },
    { goals: ['x'] },
    { goals: [{ id: 'g', title: 5 }] },
    { goals: [{ id: 7, title: 'A' }] },
    { goals: [{ id: 'g', title: 'A', milestones: 'x' }] },
    { goals: [{ id: 'g', title: 'A', milestones: [{ title: 'M', taskIds: 'x' }] }] },
    { goals: [{ id: 'g', title: 'A', taskIds: {} }] }
  ];
  bad.forEach((over) => {
    const s = Object.assign(fresh(), over);
    const r = backup.validate(wrap(s));
    assert.equal(r.ok, false, JSON.stringify(over));
    assert.match(r.error, /goal|milestone|Tautan/i);
  });
});

/* ── journal link ──────────────────────────────────────────────────── */
test('jurnal dapat ditautkan ke goal/milestone secara opsional tanpa mengubah isi atau autosave', () => {
  const s = fresh();
  const g = mkGoal(s);
  const m = goals.addMilestone(s, g.id, { title: 'M' }).milestone;
  assert.equal(journal.setGoalLink(s, DAY, { goalId: g.id }).reason, 'no-entry');
  journal.save(s, DAY, { wins: 'Belajar 2 jam' }, T(DAY, 20));
  const r = journal.setGoalLink(s, DAY, { goalId: g.id, milestoneId: m.id }, T(DAY, 21));
  assert.equal(r.changed, true);
  assert.deepEqual(journal.goalLinkOf(s, DAY), { goalId: g.id, milestoneId: m.id });
  // Editing text keeps the link and does not complete anything.
  journal.save(s, DAY, { wins: 'Belajar 3 jam' }, T(DAY, 22));
  assert.deepEqual(journal.goalLinkOf(s, DAY), { goalId: g.id, milestoneId: m.id });
  assert.equal(journal.entryFor(s, DAY).wins, 'Belajar 3 jam');
  assert.equal(m.done, false);
  assert.equal(goals.progress(s, g).pct, 0, 'teks jurnal bukan bukti progres');
  assert.deepEqual(goals.journalDays(s, g.id), [{ day: DAY, milestoneId: m.id }]);
  assert.equal(journal.setGoalLink(s, DAY, { goalId: '' }).reason, 'invalid-link');
  journal.setGoalLink(s, DAY, null);
  assert.equal(journal.goalLinkOf(s, DAY), null);
  assert.equal(journal.count(s), 1);
});

test('normalisasi membuang tautan jurnal yang rusak tetapi mempertahankan teks jurnal', () => {
  const s = fresh();
  journal.save(s, DAY, { wins: 'A' }, T(DAY, 20));
  s.journals[DAY].goal = 'rusak';
  goals.normalize(s);
  assert.equal(s.journals[DAY].goal, undefined);
  assert.equal(s.journals[DAY].wins, 'A');
});
