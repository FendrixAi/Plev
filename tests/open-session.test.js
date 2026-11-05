'use strict';
/* "Lanjut fokus" sebagai waktu bebas: sesi tanpa batas yang menghitung maju dan
   masuk total fokus saat diakhiri dengan "Selesai sesi". */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sess = require('../shared/sessions.js');
const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const MIN = 60000;

function fresh() { return { sessions: [], events: [] }; }

test('sesi biasa tidak berubah: tidak ada penanda waktu bebas', () => {
  const st = fresh();
  const s = sess.createSession(st, { taskId: 't', taskName: 'A', plannedSec: 2700 }, 0);
  assert.ok(!('openEnded' in s));
  assert.strictEqual(sess.isOpen(s), false);
  assert.strictEqual(sess.clockSeconds(s, 10 * MIN), 2700 - 600);
  assert.deepStrictEqual(sess.finishOpenSession(st, s, 10 * MIN), { ok: false, reason: 'not-open' });
  assert.strictEqual(s.state, 'running');
});

test('waktu bebas menghitung maju dan jeda tidak ikut terhitung', () => {
  const st = fresh();
  const s = sess.createSession(st, { taskId: 't', taskName: 'A', plannedSec: 1, openEnded: true }, 0);
  assert.strictEqual(sess.isOpen(s), true);
  assert.strictEqual(Math.round(sess.clockSeconds(s, 10 * MIN)), 600);
  sess.pauseSession(st, s, 10 * MIN);
  assert.strictEqual(Math.round(sess.clockSeconds(s, 40 * MIN)), 600);     // jeda 30 menit tidak dihitung
  sess.resumeSession(st, s, 40 * MIN);
  assert.strictEqual(Math.round(sess.clockSeconds(s, 55 * MIN)), 1500);
});

test('Selesai sesi: durasi sebenarnya masuk total resmi, sesi jadi selesai', () => {
  const st = fresh();
  const s = sess.createSession(st, { taskId: 't', taskName: 'A', plannedSec: 1, openEnded: true }, 0);
  sess.pauseSession(st, s, 10 * MIN);
  sess.resumeSession(st, s, 25 * MIN);
  const r = sess.finishOpenSession(st, s, 35 * MIN);        // 10 + 10 menit fokus, 15 menit jeda
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.state, 'completed');
  assert.strictEqual(s.contributesToOfficial, true);
  assert.strictEqual(s.plannedSec, 1200);
  assert.strictEqual(s.activeSec, 1200);
  assert.strictEqual(sess.officialSeconds(st.sessions), 1200);
  // idempotent
  assert.strictEqual(sess.finishOpenSession(st, s, 40 * MIN).changed, false);
  assert.strictEqual(sess.officialSeconds(st.sessions), 1200);
});

test('Selesai sesi dari kondisi dijeda tetap benar', () => {
  const st = fresh();
  const s = sess.createSession(st, { taskId: 't', taskName: 'A', plannedSec: 1, openEnded: true }, 0);
  sess.pauseSession(st, s, 30 * MIN);
  assert.strictEqual(sess.finishOpenSession(st, s, 90 * MIN).ok, true);
  assert.strictEqual(sess.officialSeconds(st.sessions), 1800);
  assert.strictEqual(s.pauseStartedAt, null);
});

test('Hentikan sesi pada waktu bebas tetap terputus dan tidak masuk total', () => {
  const st = fresh();
  const s = sess.createSession(st, { taskId: 't', taskName: 'A', plannedSec: 1, openEnded: true }, 0);
  sess.stopSession(st, s, 20 * MIN);
  assert.strictEqual(s.state, 'interrupted');
  assert.strictEqual(sess.officialSeconds(st.sessions), 0);
  assert.strictEqual(sess.interruptedSeconds(st.sessions), 1200);
  assert.strictEqual(sess.finishOpenSession(st, s, 30 * MIN).ok, false);
});

test('sesi waktu bebas yang berjalan saat aplikasi mati dipulihkan sebagai dijeda tanpa waktu hilang-masuk', () => {
  const st = fresh();
  const s = sess.createSession(st, { taskId: 't', taskName: 'A', plannedSec: 1, openEnded: true }, 0);
  sess.checkpoint(s, 5 * MIN);
  sess.recover(st, 500 * MIN);
  assert.strictEqual(s.state, 'paused');
  assert.strictEqual(Math.round(s.activeSec), 300);         // hanya sampai checkpoint terakhir
  sess.finishOpenSession(st, s, 501 * MIN);
  assert.strictEqual(sess.officialSeconds(st.sessions), 300);
});

test('wiring: Lanjut fokus = waktu bebas (Original), Selesai sesi, pengaman 3 jam', () => {
  const core = read('renderer', 'core.js');
  assert.match(core, /open: freeTime/);
  assert.match(core, /function freeTimeAvailable\(\)/);
  assert.match(core, /capybara-world/);
  assert.match(core, /app\.finishOpen = function/);
  assert.match(core, /function endLive\(s, now\)/);
  assert.match(core, /OPEN_RUN_CAP_MS = 3 \* 3600 \* 1000/);
  assert.match(core, /if \(s && s\.state === 'running' && !sess\.isOpen\(s\)\) \{/);   // sesi waktu bebas tidak selesai sendiri
  assert.match(core, /openEnded: openRun/);
  // pindah tugas / tandai selesai tidak membuang waktu bebas
  assert.match(core, /var wasOpen = sess\.isOpen\(cur\);\s*endLive\(cur, now\);/);
  assert.match(core, /endLive\(s, Date\.now\(\)\);/);
  const ber = read('renderer', 'pages', 'beranda.js');
  assert.strictEqual((ber.match(/'Selesai sesi'/g) || []).length, 2);
  assert.match(ber, /'Waktu bebas'/);
  assert.match(ber, /'\+' \+ ui\.fmt\.mmss\(JF\.sessions\.activeSeconds/);
  assert.match(read('renderer', 'pages', 'riwayat.js'), /s\.openEnded \? 'Bebas'/);
  assert.match(read('mini.html'), /st\.mode==="run"&&st\.open/);
  assert.match(read('main.js'), /s\.mode === 'run' && s\.open/);
});

test('Selesai sesi lalu Lanjut fokus: sesi yang sama dilanjutkan, hitungan tidak kembali ke nol', () => {
  const st = fresh();
  const s = sess.createSession(st, { taskId: 't', taskName: 'A', plannedSec: 1, openEnded: true }, 0);
  sess.finishOpenSession(st, s, 10 * MIN);
  assert.strictEqual(sess.officialSeconds(st.sessions), 600);
  const r = sess.reopenOpenSession(st, s, 11 * MIN);                 // 1 menit jeda di dialog tidak dihitung
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.state, 'running');
  assert.strictEqual(s.contributesToOfficial, false);
  assert.strictEqual(sess.officialSeconds(st.sessions), 0);          // selama berjalan belum masuk total
  assert.strictEqual(Math.round(sess.clockSeconds(s, 16 * MIN)), 900); // 10 menit + 5 menit, bukan 5 menit
  assert.strictEqual(sess.currentSession(st).id, s.id);
  sess.finishOpenSession(st, s, 16 * MIN);
  assert.strictEqual(sess.officialSeconds(st.sessions), 900);
  assert.strictEqual(st.sessions.length, 1);                         // tetap satu sesi, tidak ada sesi baru
});

test('reopenOpenSession hanya untuk sesi waktu bebas yang sudah selesai', () => {
  const st = fresh();
  const fixed = sess.createSession(st, { taskId: 't', taskName: 'A', plannedSec: 600 }, 0);
  sess.completeSession(st, fixed, 10 * MIN);
  assert.deepStrictEqual(sess.reopenOpenSession(st, fixed, 11 * MIN), { ok: false, reason: 'not-open' });
  const open = sess.createSession(st, { taskId: 't', taskName: 'B', plannedSec: 1, openEnded: true }, 20 * MIN);
  assert.deepStrictEqual(sess.reopenOpenSession(st, open, 21 * MIN), { ok: false, reason: 'not-completed' });
  sess.stopSession(st, open, 25 * MIN);
  assert.strictEqual(sess.reopenOpenSession(st, open, 26 * MIN).ok, false);   // terputus tidak bisa dibuka lagi
});

test('wiring: Lanjut fokus setelah Selesai sesi melanjutkan sesi yang sama', () => {
  const core = read('renderer', 'core.js');
  assert.match(core, /function resumeFinished\(id\)/);
  assert.match(core, /sess\.reopenOpenSession\(state, s, now\)/);
  assert.match(core, /showCompletionChoices\(s, t, \{ resumeOpen: true \}\)/);
  assert.match(core, /onClick: function \(\) \{ continueFrom\(ctx\); \}/);
  assert.match(core, /hitungan tidak mulai dari nol/);
});
