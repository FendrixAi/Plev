/* Integration test: full startTask flow with task duration */
const assert = require('node:assert');
const { test } = require('node:test');
const store = require('../shared/store.js');
const sessions = require('../shared/sessions.js');

function T(d, h, m) {
  const [y, mo, day] = d.split('-');
  return new Date(y, mo - 1, day, h || 0, m || 0).getTime();
}

// Simulate the actual app.startTask logic from renderer/core.js
function simulateStartTask(state, taskId, now) {
  const t = taskId ? store.find(state, taskId) : null;
  
  // Lines 366-368 from renderer/core.js
  let planned = t ? t.left : state.settings.defaultFocusSec;
  if (!(planned > 0)) planned = t ? t.durationSec : state.settings.defaultFocusSec;
  if (!(planned > 0)) planned = 1500;
  
  const ses = sessions.createSession(state, {
    taskId: t ? t.id : null,
    taskName: t ? t.title : 'Fokus tanpa task',
    plannedSec: planned
  }, now);
  
  return { session: ses, planned };
}

test('integration: 15-minute task starts with 15:00 via full startTask flow', () => {
  const s = store.createState();
  const task15 = store.addTask(s, {
    title: 'Task 15 menit',
    targetDate: '2026-10-25',
    durationSec: 15 * 60
  }, T('2026-10-25', 9));

  const result = simulateStartTask(s, task15.id, T('2026-10-25', 10));
  
  assert.equal(result.planned, 900, 'planned should be 900 (15 min)');
  assert.equal(result.session.plannedSec, 900, 'session plannedSec should be 900 (15 min), not 1500 (25 min)');
});

test('integration: 40-minute task starts with 40:00 via full startTask flow', () => {
  const s = store.createState();
  const task40 = store.addTask(s, {
    title: 'Task 40 menit',
    targetDate: '2026-10-25',
    durationSec: 40 * 60
  }, T('2026-10-25', 9));

  const result = simulateStartTask(s, task40.id, T('2026-10-25', 10));
  
  assert.equal(result.planned, 2400, 'planned should be 2400 (40 min)');
  assert.equal(result.session.plannedSec, 2400, 'session plannedSec should be 2400 (40 min), not 1500');
});

test('integration: reopened task with left=0 uses durationSec', () => {
  const s = store.createState();
  const task = store.addTask(s, {
    title: 'Task 30 menit',
    targetDate: '2026-10-25',
    durationSec: 30 * 60
  }, T('2026-10-25', 9));

  // Simulate completion (left becomes 0)
  task.left = 0;
  store.completeTask(s, task.id, T('2026-10-25', 10), 'timer');
  
  // Reopen
  store.reopenTask(s, task.id, T('2026-10-25', 11));
  
  // left is still 0 after reopen
  assert.equal(task.left, 0, 'left should be 0 after reopen');
  assert.equal(task.durationSec, 1800, 'durationSec should still be 1800');
  
  const result = simulateStartTask(s, task.id, T('2026-10-25', 12));
  
  assert.equal(result.planned, 1800, 'planned should use durationSec=1800 when left=0');
  assert.equal(result.session.plannedSec, 1800, 'session should start with 1800, not 1500');
});
