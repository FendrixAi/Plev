'use strict';
const test = require('node:test');
const assert = require('node:assert');
const store = require('../shared/store.js');

function mk() {
  const st = store.createState();
  const a = store.addTask(st, { title: 'A', targetDate: '2026-11-01' }, 1);
  const b = store.addTask(st, { title: 'B', targetDate: '2026-11-02' }, 2);
  const c = store.addTask(st, { title: 'C', targetDate: '2026-11-03' }, 3);
  return { st, a, b, c };
}

test('deleteArchivedTasks hanya menghapus tugas yang sudah diarsipkan', () => {
  const { st, a, b, c } = mk();
  store.archiveTask(st, a.id, 10);
  store.archiveTask(st, b.id, 10);
  const r = store.deleteArchivedTasks(st, [a.id, b.id, c.id], 20);
  assert.deepStrictEqual(r.removed.sort(), [a.id, b.id].sort());
  assert.deepStrictEqual(r.skipped, [c.id]);
  assert.strictEqual(st.tasks.length, 1);
  assert.strictEqual(st.tasks[0].id, c.id);
});

test('deleteArchivedTasks melepas tautan goal, milestone, dan library', () => {
  const { st, a, b } = mk();
  st.goals = [{ id: 'g1', taskIds: [a.id, b.id], milestones: [{ id: 'm1', taskIds: [a.id] }] }];
  st.library = [{ id: 'l1', taskIds: [a.id, b.id] }];
  store.archiveTask(st, a.id, 10);
  store.deleteArchivedTasks(st, [a.id], 20);
  assert.deepStrictEqual(st.goals[0].taskIds, [b.id]);
  assert.deepStrictEqual(st.goals[0].milestones[0].taskIds, []);
  assert.deepStrictEqual(st.library[0].taskIds, [b.id]);
});

test('deleteArchivedTasks melewati tugas yang masih punya sesi timer aktif & mempertahankan riwayat sesi', () => {
  const { st, a, b } = mk();
  st.sessions.push({ id: 's1', taskId: a.id, state: 'paused' }, { id: 's2', taskId: b.id, state: 'completed' });
  store.archiveTask(st, a.id, 10);
  store.archiveTask(st, b.id, 10);
  const r = store.deleteArchivedTasks(st, [a.id, b.id], 20);
  assert.deepStrictEqual(r.removed, [b.id]);
  assert.deepStrictEqual(r.skipped, [a.id]);
  assert.strictEqual(st.sessions.length, 2);
});

test('deleteArchivedTasks tanpa id valid tidak mengubah apa pun', () => {
  const { st } = mk();
  const r = store.deleteArchivedTasks(st, ['tidak-ada', null], 20);
  assert.strictEqual(r.changed, false);
  assert.strictEqual(st.tasks.length, 3);
});
