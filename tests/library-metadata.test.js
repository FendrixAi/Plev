const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const model = require(path.join(root, 'shared', 'model.js'));
const store = require(path.join(root, 'shared', 'store.js'));
const library = require(path.join(root, 'shared', 'library.js'));

test('default state has empty library', () => {
  const s = store.createState();
  assert.deepEqual(s.library, []);
});

test('normalize filters malformed and duplicate ids', () => {
  const now = 1000;
  const s = { library: [
    { id: 'a', type: 'note', title: 'N1', noteText: 'hi', createdAt: now, updatedAt: now, taskIds: ['t1'], goalIds: [], milestoneRefs: [] },
    { id: 'a', type: 'note', title: 'N2', noteText: 'ho', createdAt: now, updatedAt: now },
    { id: 'b', type: 'link', title: 'L', url: 'https://example.com', createdAt: now, updatedAt: now },
    { id: 'c', type: 'file', title: 'F', fileName: 'x.txt', createdAt: now, updatedAt: now },
    { id: 'd', type: 'bogus', title: 'X' },
    { id: 'e', type: 'link', title: 'Bad', url: 'not-a-url' },
    { id: 'f', type: 'file', title: 'BadFile' }
  ] };
  library.normalize(s, now);
  assert.equal(s.library.length, 4);
  assert.equal(s.library.filter(x => x.id === 'a').length, 1);
  assert.equal(s.library.find(x => x.id === 'a').title, 'N1');
});

test('legacy state without library becomes empty array', () => {
  const s = { tasks: [], sessions: [] };
  library.normalize(s, 1000);
  assert.deepEqual(s.library, []);
});

test('stale refs preserved', () => {
  const now = 1000;
  const s = { library: [
    { id: 'a', type: 'note', title: 'N', noteText: 'hi', taskIds: ['missing'], goalIds: ['g'], milestoneRefs: [{goalId:'g',milestoneId:'m'}], createdAt: now, updatedAt: now }
  ] };
  library.normalize(s, now);
  assert.deepEqual(s.library[0].taskIds, ['missing']);
  assert.deepEqual(s.library[0].goalIds, ['g']);
  assert.deepEqual(s.library[0].milestoneRefs, [{goalId:'g',milestoneId:'m'}]);
});

test('createItem validates', () => {
  const it = library.createItem({ type: 'note', title: 'X', noteText: 'text' }, 1000);
  assert.equal(it.type, 'note');
  assert.throws(() => library.createItem({ type: 'link', title: 'X', url: 'bad' }, 1000));
});
