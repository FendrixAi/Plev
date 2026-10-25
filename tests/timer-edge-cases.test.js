/* Test edge case: task with invalid durationSec should fall back correctly */
const assert = require('node:assert');
const { test } = require('node:test');
const store = require('../shared/store.js');

function T(d, h, m) {
  const [y, mo, day] = d.split('-');
  return new Date(y, mo - 1, day, h || 0, m || 0).getTime();
}

test('edge case: manually corrupted task with durationSec=null gets default', () => {
  const s = store.createState();
  const task = store.addTask(s, {
    title: 'Task normal',
    targetDate: '2026-10-25',
    durationSec: 30 * 60
  }, T('2026-10-25', 9));

  // Simulate corruption or incomplete data
  task.durationSec = null;
  task.left = null;

  // Display logic from beranda.js line 124-126 (AFTER fix)
  let planned_display = task ? task.left : s.settings.defaultFocusSec;
  if (!(planned_display > 0)) planned_display = (task && task.durationSec > 0) ? task.durationSec : s.settings.defaultFocusSec;
  if (!(planned_display > 0)) planned_display = 1500;
  
  // Session logic from core.js line 366-368 (AFTER fix)
  let planned_session = task ? task.left : s.settings.defaultFocusSec;
  if (!(planned_session > 0)) planned_session = (task && task.durationSec > 0) ? task.durationSec : s.settings.defaultFocusSec;
  if (!(planned_session > 0)) planned_session = 1500;

  // Both should fall back to 1500 (defaultFocusSec)
  assert.equal(planned_display, 1500, 'display should fall back to 1500 when task duration is invalid');
  assert.equal(planned_session, 1500, 'session should fall back to 1500 when task duration is invalid');
});

test('edge case: task created without durationSec gets defaultFocusSec applied by store', () => {
  const s = store.createState();
  // Simulate form submission with no duration (null)
  const task = store.addTask(s, {
    title: 'Task tanpa durasi',
    targetDate: '2026-10-25',
    durationSec: null  // explicitly null
  }, T('2026-10-25', 9));

  // store.addTask should apply defaultFocusSec
  assert.equal(task.durationSec, 1500, 'store should apply defaultFocusSec=1500 when durationSec is null');
  assert.equal(task.left, 1500, 'left should also be 1500');
});

test('edge case: check what parseInt returns for empty string', () => {
  // Simulating tugas.js line 240: parseInt(document.getElementById('ed-min').value, 10) * 60
  const emptyValue = '';
  const result = parseInt(emptyValue, 10) * 60;
  assert.ok(isNaN(result), 'parseInt of empty string * 60 should be NaN');
  
  // When durationSec is NaN, it's falsy
  const durationSec = result;
  const isValid = durationSec > 0;
  assert.equal(isValid, false, 'NaN > 0 should be false');
});
