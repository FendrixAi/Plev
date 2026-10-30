const test = require('node:test');
const assert = require('node:assert/strict');
const library = require('../shared/library.js');

test('library.validateReferences returns empty for valid refs', () => {
  const state = {
    tasks: [{ id: 'task-1', title: 'Tugas 1' }],
    goals: [{ id: 'goal-1', title: 'Goal 1', milestones: [{ id: 'ms-1', title: 'Milestone 1' }] }],
    library: [{
      id: 'lib-1', type: 'note', title: 'Catatan', noteText: 'isi',
      taskIds: ['task-1'], goalIds: ['goal-1'], milestoneRefs: [{ goalId: 'goal-1', milestoneId: 'ms-1' }]
    }]
  };
  assert.deepStrictEqual(library.validateReferences(state), []);
});

test('library.validateReferences reports missing refs without removing them', () => {
  const state = {
    tasks: [], goals: [], library: [{
      id: 'lib-1', type: 'note', title: 'Yatim', noteText: 'isi',
      taskIds: ['task-hilang'], goalIds: ['goal-hilang'],
      milestoneRefs: [{ goalId: 'goal-hilang', milestoneId: 'ms-hilang' }]
    }]
  };
  const before = JSON.stringify(state);
  const problems = library.validateReferences(state);
  assert.equal(problems.length, 3);
  assert.ok(problems.some(p => p.kind === 'task' && p.refId === 'task-hilang'));
  assert.ok(problems.some(p => p.kind === 'goal' && p.refId === 'goal-hilang'));
  assert.ok(problems.some(p => p.kind === 'milestone'));
  // Tidak boleh menghapus referensi lama secara diam-diam.
  assert.equal(JSON.stringify(state), before);
});

test('library.normalize preserves stale references and loads old data', () => {
  const state = { library: [
    { id: 'lib-1', type: 'link', title: 'L', url: 'https://example.com', taskIds: ['task-hilang'], goalIds: [], milestoneRefs: [] },
    { id: 'lib-2', type: 'bogus', title: 'Invalid' },
    { id: 'lib-1', type: 'note', title: 'Duplicate id', noteText: 'isi' }
  ] };
  library.normalize(state, 1000);
  assert.equal(state.library.length, 2);
  assert.equal(state.library[0].type, 'link');
  assert.equal(state.library[0].taskIds.length, 1);
  assert.equal(state.library[0].taskIds[0], 'task-hilang');
  assert.equal(state.library[1].type, 'note');
  assert.notEqual(state.library[1].id, 'lib-1');
});

test('library.createItem validates required fields', () => {
  assert.throws(() => library.createItem({ type: 'link', title: 'L', url: 'not-a-url' }, 1000));
  assert.throws(() => library.createItem({ type: 'file', title: 'F' }, 1000));
  const it = library.createItem({ type: 'note', title: 'Catatan', noteText: 'isi' }, 1000);
  assert.equal(it.type, 'note');
  assert.equal(it.title, 'Catatan');
});

test('library.safeFileName blocks traversal', () => {
  assert.strictEqual(library.safeFileName('../evil.txt'), null);
  assert.strictEqual(library.safeFileName('evil/../x.txt'), null);
  assert.strictEqual(library.safeFileName('safe.txt'), 'safe.txt');
});

test('library.validUrl allows only http/https', () => {
  assert.strictEqual(library.validUrl('https://example.com'), true);
  assert.strictEqual(library.validUrl('http://example.com'), true);
  assert.strictEqual(library.validUrl('ftp://example.com'), false);
  assert.strictEqual(library.validUrl('javascript:alert(1)'), false);
});
