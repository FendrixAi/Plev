'use strict';

const test = require('node:test');
const assert = require('node:assert');
const sess = require('../shared/sessions.js');
const dates = require('../shared/dates.js');

const T = (y, m, d, h) => new Date(y, m - 1, d, h || 12, 0, 0).getTime();
const done = (plannedSec, at) => ({ state: 'completed', plannedSec, activeSec: plannedSec, completedAt: at, endedAt: at, startedAt: at - plannedSec * 1000 });
const cut = (activeSec, at) => ({ state: 'interrupted', plannedSec: 1500, activeSec, endedAt: at, startedAt: at - activeSec * 1000 });

test('summary: hitung selesai, terputus, total, dan terpanjang', () => {
  const list = [done(1500, T(2026, 11, 5)), done(2700, T(2026, 11, 5, 15)), cut(400, T(2026, 11, 4)), { state: 'running', plannedSec: 1, activeSec: 90, startedAt: 1 }];
  const r = sess.summary(list);
  assert.deepStrictEqual(r, { done: 2, focusSec: 4200, longestSec: 2700, cut: 1, cutSec: 400 });
});

test('summary: kosong / null aman', () => {
  const zero = { done: 0, focusSec: 0, longestSec: 0, cut: 0, cutSec: 0 };
  assert.deepStrictEqual(sess.summary([]), zero);
  assert.deepStrictEqual(sess.summary(null), zero);
});

test('summary: sesi berjalan/dijeda tidak ikut total', () => {
  const r = sess.summary([{ state: 'paused', plannedSec: 1500, activeSec: 600 }, { state: 'running', plannedSec: 1, activeSec: 5 }]);
  assert.strictEqual(r.done + r.cut, 0);
  assert.strictEqual(r.focusSec, 0);
});

test('summary: sesi waktu bebas yang selesai dihitung dengan durasi aktualnya', () => {
  // finishOpenSession menyetel plannedSec = waktu aktual saat diakhiri
  assert.strictEqual(sess.summary([done(1234, T(2026, 11, 5))]).focusSec, 1234);
});

test('focusByDay: dikelompokkan per hari akhir sesi, hanya yang selesai', () => {
  const list = [done(1500, T(2026, 11, 5, 9)), done(600, T(2026, 11, 5, 20)), done(900, T(2026, 11, 4)), cut(300, T(2026, 11, 5))];
  const r = sess.focusByDay(list);
  assert.strictEqual(r['2026-11-05'], 2100);
  assert.strictEqual(r['2026-11-04'], 900);
  assert.strictEqual(Object.keys(r).length, 2);
  assert.strictEqual(dates.dayKey(T(2026, 11, 5)), '2026-11-05');
});

test('endTime: completedAt, lalu endedAt, lalu startedAt', () => {
  assert.strictEqual(sess.endTime({ completedAt: 3, endedAt: 2, startedAt: 1 }), 3);
  assert.strictEqual(sess.endTime({ endedAt: 2, startedAt: 1 }), 2);
  assert.strictEqual(sess.endTime({ startedAt: 1 }), 1);
});
