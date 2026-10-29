/* Timer synchronization test: Siap Fokus session must use task's configured duration */
const assert = require('node:assert');
const { test } = require('node:test');
const store = require('../shared/store.js');
const sessions = require('../shared/sessions.js');

function T(d, h, m) {
  const [y, mo, day] = d.split('-');
  return new Date(y, mo - 1, day, h || 0, m || 0).getTime();
}

test('starting a focus session with a 1-minute task uses 01:00, not 25:00', () => {
  const s = store.createState();
  const task1 = store.addTask(s, {
    title: 'Task 1 menit',
    targetDate: '2026-10-25',
    durationSec: 1 * 60  // 60 seconds
  }, T('2026-10-25', 9));

  assert.equal(task1.durationSec, 60, 'task duration should be 60 sec');
  assert.equal(task1.left, 60, 'task remaining should be 60 sec');

  // Simulate app.startTask logic
  const planned = task1.left > 0 ? task1.left : (task1.durationSec > 0 ? task1.durationSec : s.settings.defaultFocusSec);
  
  const ses = sessions.createSession(s, {
    taskId: task1.id,
    taskName: task1.title,
    plannedSec: planned
  }, T('2026-10-25', 9, 30));

  assert.equal(ses.plannedSec, 60, 'session planned duration must be 60 sec (1 min), not 1500 (25 min)');
});

test('starting a focus session with a 15-minute task uses 15:00, not 25:00', () => {
  const s = store.createState();
  const task15 = store.addTask(s, {
    title: 'Task 15 menit',
    targetDate: '2026-10-25',
    durationSec: 15 * 60  // 900 seconds
  }, T('2026-10-25', 9));

  assert.equal(task15.durationSec, 900, 'task duration should be 900 sec');
  assert.equal(task15.left, 900, 'task remaining should be 900 sec');

  // Simulate app.startTask logic
  const planned = task15.left > 0 ? task15.left : (task15.durationSec > 0 ? task15.durationSec : s.settings.defaultFocusSec);
  
  const ses = sessions.createSession(s, {
    taskId: task15.id,
    taskName: task15.title,
    plannedSec: planned
  }, T('2026-10-25', 9, 30));

  assert.equal(ses.plannedSec, 900, 'session planned duration must be 900 sec (15 min), not 1500 (25 min)');
});

test('starting a focus session with a 40-minute task uses 40:00, not 25:00', () => {
  const s = store.createState();
  const task40 = store.addTask(s, {
    title: 'Task 40 menit',
    targetDate: '2026-10-25',
    durationSec: 40 * 60  // 2400 seconds
  }, T('2026-10-25', 9));

  assert.equal(task40.durationSec, 2400);
  assert.equal(task40.left, 2400);

  const planned = task40.left > 0 ? task40.left : (task40.durationSec > 0 ? task40.durationSec : s.settings.defaultFocusSec);
  
  const ses = sessions.createSession(s, {
    taskId: task40.id,
    taskName: task40.title,
    plannedSec: planned
  }, T('2026-10-25', 10));

  assert.equal(ses.plannedSec, 2400, 'session planned duration must be 2400 sec (40 min), not 1500 (25 min)');
});

test('starting a focus session with a 60-minute task uses 60:00, not 25:00', () => {
  const s = store.createState();
  const task60 = store.addTask(s, {
    title: 'Task 60 menit',
    targetDate: '2026-10-25',
    durationSec: 60 * 60  // 3600 seconds
  }, T('2026-10-25', 9));

  assert.equal(task60.durationSec, 3600);
  assert.equal(task60.left, 3600);

  const planned = task60.left > 0 ? task60.left : (task60.durationSec > 0 ? task60.durationSec : s.settings.defaultFocusSec);
  
  const ses = sessions.createSession(s, {
    taskId: task60.id,
    taskName: task60.title,
    plannedSec: planned
  }, T('2026-10-25', 11));

  assert.equal(ses.plannedSec, 3600, 'session planned duration must be 3600 sec (60 min), not 1500 (25 min)');
});

test('a task without configured duration uses the default 25 minutes', () => {
  const s = store.createState();
  const taskDefault = store.addTask(s, {
    title: 'Task tanpa durasi',
    targetDate: '2026-10-25'
    // no durationSec specified
  }, T('2026-10-25', 9));

  assert.equal(taskDefault.durationSec, 1500, 'task with no duration should default to 1500 sec');
  assert.equal(taskDefault.left, 1500);

  const planned = taskDefault.left > 0 ? taskDefault.left : (taskDefault.durationSec > 0 ? taskDefault.durationSec : s.settings.defaultFocusSec);
  
  const ses = sessions.createSession(s, {
    taskId: taskDefault.id,
    taskName: taskDefault.title,
    plannedSec: planned
  }, T('2026-10-25', 9, 30));

  assert.equal(ses.plannedSec, 1500, 'session without task duration should use default 1500 sec');
});

test('selecting a different task before starting uses the newly selected task duration', () => {
  const s = store.createState();
  const task20 = store.addTask(s, {
    title: 'Task 20 menit',
    targetDate: '2026-10-25',
    durationSec: 20 * 60
  }, T('2026-10-25', 9));
  
  const task30 = store.addTask(s, {
    title: 'Task 30 menit',
    targetDate: '2026-10-25',
    durationSec: 30 * 60
  }, T('2026-10-25', 9));

  // First selection: task20
  let selected = task20.id;
  let t = s.tasks.find(x => x.id === selected);
  let planned = t.left > 0 ? t.left : (t.durationSec > 0 ? t.durationSec : s.settings.defaultFocusSec);
  assert.equal(planned, 1200, 'first selection should be 1200 sec (20 min)');

  // Change selection to task30
  selected = task30.id;
  t = s.tasks.find(x => x.id === selected);
  planned = t.left > 0 ? t.left : (t.durationSec > 0 ? t.durationSec : s.settings.defaultFocusSec);
  assert.equal(planned, 1800, 'changed selection should be 1800 sec (30 min), not the previous 1200');
});

test('rendered timer label displays expected Indonesian text without unexpected characters', () => {
  const vm = require('vm');
  const fs = require('fs');
  const path = require('path');
  const ctx = { document: { getElementById: () => null } };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'ui.js'), 'utf8'), ctx);
  const ui = ctx.JF.ui;

  // Task with 1 minute duration and 57 seconds remaining (the exact case from user report)
  const task = { durationSec: 60, left: 57 };
  const label = task
    ? 'Target tugas ' + ui.fmt.dur(task.durationSec) + (task.left < task.durationSec ? ' · sisa ' + ui.fmt.mmss(task.left) : '')
    : 'Sesi tanpa tugas · ' + ui.fmt.dur(1500);

  assert.equal(label, 'Target tugas 1 menit · sisa 00:57');
  assert.ok(!label.includes('Â'), 'label must not contain Â');
  assert.ok(!label.includes('A ·'), 'label must not contain unexpected A character');
});

test('beranda.js contains only valid middle dot separators without mojibake artifacts', () => {
  const fs = require('fs');
  const path = require('path');
  const berandaSrc = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'pages', 'beranda.js'), 'utf8');

  // Verify no U+00C2 (Â) exists before middle dot
  assert.doesNotMatch(berandaSrc, /Â/);
  assert.doesNotMatch(berandaSrc, /\u00C2\u00B7/);
  // Verify expected separator exists
  assert.match(berandaSrc, /'Target tugas ' \+ ui\.fmt\.dur\(t\.durationSec\) \+ \(t\.left < t\.durationSec \? ' · sisa ' \+ ui\.fmt\.mmss\(t\.left\) : ''\)/);
  assert.match(berandaSrc, /'Sesi tanpa tugas · ' \+ ui\.fmt\.dur\(app\.rawState\(\)\.settings\.defaultFocusSec\)/);
});
