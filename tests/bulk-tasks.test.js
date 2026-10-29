'use strict';
const test = require('node:test');
const assert = require('node:assert');
const bulk = require('../shared/bulkTasks.js');
const store = require('../shared/store.js');
const sessions = require('../shared/sessions.js');

test('1. Format Baru: Semua contoh format dari spesifikasi terurai dengan benar', () => {
  // Contoh 1: 4 kolom lengkap (nama_waktu_prioritas_deskripsi)
  const r1 = bulk.parseLine('Belajar PSAK 216_60_normal_Mempelajari pengakuan dan pengukuran aset tetap', 1);
  assert.strictEqual(r1.valid, true);
  assert.strictEqual(r1.taskName, 'Belajar PSAK 216');
  assert.strictEqual(r1.durationMin, 60);
  assert.strictEqual(r1.durationSec, 3600);
  assert.strictEqual(r1.priority, 'normal');
  assert.strictEqual(r1.priorityLabel, 'Normal');
  assert.strictEqual(r1.description, 'Mempelajari pengakuan dan pengukuran aset tetap');
  assert.strictEqual(r1.error, null);

  // Contoh 2: Prioritas tinggi dengan deskripsi
  const r2 = bulk.parseLine('Latihan Excel SUMIFS_20_tinggi_Latihan rekap transaksi', 2);
  assert.strictEqual(r2.valid, true);
  assert.strictEqual(r2.taskName, 'Latihan Excel SUMIFS');
  assert.strictEqual(r2.durationMin, 20);
  assert.strictEqual(r2.durationSec, 1200);
  assert.strictEqual(r2.priority, 'high');
  assert.strictEqual(r2.priorityLabel, 'Tinggi');
  assert.strictEqual(r2.description, 'Latihan rekap transaksi');

  // Contoh 3: Deskripsi kosong dengan trailing underscore (4 kolom)
  const r3 = bulk.parseLine('Baca materi audit internal_30_normal_', 3);
  assert.strictEqual(r3.valid, true);
  assert.strictEqual(r3.taskName, 'Baca materi audit internal');
  assert.strictEqual(r3.durationMin, 30);
  assert.strictEqual(r3.durationSec, 1800);
  assert.strictEqual(r3.priority, 'normal');
  assert.strictEqual(r3.priorityLabel, 'Normal');
  assert.strictEqual(r3.description, '');

  // Contoh 4: Deskripsi tidak diisi / diabaikan tanpa trailing underscore (3 kolom)
  const r4 = bulk.parseLine('Apply lowongan kerja_45_tinggi', 4);
  assert.strictEqual(r4.valid, true);
  assert.strictEqual(r4.taskName, 'Apply lowongan kerja');
  assert.strictEqual(r4.durationMin, 45);
  assert.strictEqual(r4.durationSec, 2700);
  assert.strictEqual(r4.priority, 'high');
  assert.strictEqual(r4.priorityLabel, 'Tinggi');
  assert.strictEqual(r4.description, '');

  // Contoh 5: Prioritas rendah
  const r5 = bulk.parseLine('Olahraga_15_rendah_Peregangan ringan', 5);
  assert.strictEqual(r5.valid, true);
  assert.strictEqual(r5.taskName, 'Olahraga');
  assert.strictEqual(r5.durationMin, 15);
  assert.strictEqual(r5.durationSec, 900);
  assert.strictEqual(r5.priority, 'low');
  assert.strictEqual(r5.priorityLabel, 'Rendah');
  assert.strictEqual(r5.description, 'Peregangan ringan');
});

test('2. Prioritas: validasi ketiga nilai prioritas dan variasi huruf besar-kecil', () => {
  // rendah
  const rRendah = bulk.parseLine('Tugas Santai_10_rendah_Opsional');
  assert.strictEqual(rRendah.valid, true);
  assert.strictEqual(rRendah.priority, 'low');
  assert.strictEqual(rRendah.priorityLabel, 'Rendah');

  // normal
  const rNormal = bulk.parseLine('Tugas Harian_25_normal_Opsional');
  assert.strictEqual(rNormal.valid, true);
  assert.strictEqual(rNormal.priority, 'normal');
  assert.strictEqual(rNormal.priorityLabel, 'Normal');

  // tinggi
  const rTinggi = bulk.parseLine('Tugas Mendesak_40_tinggi_Opsional');
  assert.strictEqual(rTinggi.valid, true);
  assert.strictEqual(rTinggi.priority, 'high');
  assert.strictEqual(rTinggi.priorityLabel, 'Tinggi');

  // Case-insensitivity
  const rUpper = bulk.parseLine('Tugas Caps_30_TINGGI');
  assert.strictEqual(rUpper.valid, true);
  assert.strictEqual(rUpper.priority, 'high');

  const rMixed = bulk.parseLine('Tugas Mixed_30_Normal');
  assert.strictEqual(rMixed.valid, true);
  assert.strictEqual(rMixed.priority, 'normal');

  // English aliases
  const rLow = bulk.parseLine('Tugas Low_20_low');
  assert.strictEqual(rLow.valid, true);
  assert.strictEqual(rLow.priority, 'low');

  // Nilai prioritas tidak valid ditolak
  const rBad1 = bulk.parseLine('Tugas Salah_30_urgent_Catatan');
  assert.strictEqual(rBad1.valid, false);
  assert.match(rBad1.error, /prioritas tidak didukung/i);

  const rBad2 = bulk.parseLine('Tugas Salah_30_sedang_Catatan');
  assert.strictEqual(rBad2.valid, false);
  assert.match(rBad2.error, /prioritas tidak didukung/i);

  const rBad3 = bulk.parseLine('Tugas Salah_30__Catatan');
  assert.strictEqual(rBad3.valid, false);
  assert.match(rBad3.error, /prioritas wajib diisi/i);
});

test('3. Waktu/Durasi: validasi angka positif dan penolakan nilai tidak valid', () => {
  // Angka 0
  const rZero = bulk.parseLine('Tugas Nol_0_normal_Catatan');
  assert.strictEqual(rZero.valid, false);
  assert.match(rZero.error, /waktu harus berupa angka menit positif/i);

  // Angka negatif
  const rNeg = bulk.parseLine('Tugas Negatif_-15_normal_Catatan');
  assert.strictEqual(rNeg.valid, false);
  assert.match(rNeg.error, /waktu harus berupa angka menit positif/i);

  // Non-numerik
  const rAlpha = bulk.parseLine('Tugas Huruf_duaPuluh_normal_Catatan');
  assert.strictEqual(rAlpha.valid, false);
  assert.match(rAlpha.error, /waktu harus berupa angka menit positif/i);

  // Durasi kosong
  const rEmpty = bulk.parseLine('Tugas Kosong__normal_Catatan');
  assert.strictEqual(rEmpty.valid, false);
  assert.match(rEmpty.error, /waktu.*wajib diisi/i);

  // Lebih dari batas 24 jam (1440 menit)
  const rTooLong = bulk.parseLine('Tugas Lama_1500_normal_Catatan');
  assert.strictEqual(rTooLong.valid, false);
  assert.match(rTooLong.error, /maksimal 1440 menit/i);
});

test('4. Nama tugas: wajib diisi dan tidak boleh hanya spasi', () => {
  const rEmpty = bulk.parseLine('_30_normal_Deskripsi');
  assert.strictEqual(rEmpty.valid, false);
  assert.match(rEmpty.error, /nama tugas wajib diisi/i);

  const rSpaces = bulk.parseLine('   _30_normal_Deskripsi');
  assert.strictEqual(rSpaces.valid, false);
  assert.match(rSpaces.error, /nama tugas wajib diisi/i);
});

test('5. Ambiguitas & Pergeseran kolom akibat underscore ditangani secara aman', () => {
  // Ambiguitas: lebih dari 3 tanda pemisah (_)
  const rAmbiguous1 = bulk.parseLine('Belajar_PSAK_216_60_normal_Mempelajari aset tetap');
  assert.strictEqual(rAmbiguous1.valid, false);
  assert.match(rAmbiguous1.error, /pemisah kolom ambigu/i);

  const rAmbiguous2 = bulk.parseLine('Tugas 1_30_normal_bab_1_pendahuluan');
  assert.strictEqual(rAmbiguous2.valid, false);
  assert.match(rAmbiguous2.error, /pemisah kolom ambigu/i);

  // Deteksi kolom tergeser karena nama tugas mengandung underscore (misal: Tugas_A_30_normal)
  const rShifted = bulk.parseLine('Tugas_A_30_normal');
  assert.strictEqual(rShifted.valid, false);
  assert.match(rShifted.error, /pemisah tergeser.*nama tugas kemungkinan mengandung underscore/i);
});

test('6. Format malformed: kolom kurang dari 3 ditolak', () => {
  const r1 = bulk.parseLine('Hanya Nama Tugas Saja');
  assert.strictEqual(r1.valid, false);
  assert.match(r1.error, /format tidak lengkap/i);

  const r2 = bulk.parseLine('Nama Tugas_60');
  assert.strictEqual(r2.valid, false);
  assert.match(r2.error, /format tidak lengkap/i);
});

test('7. Baris kosong diabaikan dalam multiline input', () => {
  const multiline = `
Belajar PSAK 216_60_normal_Mempelajari pengakuan aset
   
Latihan Excel SUMIFS_20_tinggi_Rekap transaksi

Apply lowongan kerja_45_tinggi
`;

  const parsed = bulk.parseBulkInput(multiline);
  assert.strictEqual(parsed.totalLines, 3);
  assert.strictEqual(parsed.totalValid, 3);
  assert.strictEqual(parsed.totalInvalid, 0);
  assert.strictEqual(parsed.validRows.length, 3);
  assert.strictEqual(parsed.validRows[0].taskName, 'Belajar PSAK 216');
  assert.strictEqual(parsed.validRows[1].taskName, 'Latihan Excel SUMIFS');
  assert.strictEqual(parsed.validRows[2].taskName, 'Apply lowongan kerja');

  // parseLine tunggal untuk baris kosong
  const empty = bulk.parseLine('   ');
  assert.strictEqual(empty.valid, false);
  assert.strictEqual(empty.isEmpty, true);
  assert.strictEqual(empty.error, 'Baris kosong');
});

test('8. Campuran baris valid dan tidak valid dipisahkan dan dihitung akurat', () => {
  const input = [
    'Belajar PSAK 216_60_normal_Aset tetap',
    'Tugas Rusak_bukanAngka_normal_Deskripsi',
    'Apply lowongan kerja_45_tinggi',
    'Tugas_Ambigu_Dengan_Banyak_Underscore_normal',
    '_30_rendah_Tanpa nama'
  ].join('\n');

  const res = bulk.parseBulkInput(input);
  assert.strictEqual(res.totalLines, 5);
  assert.strictEqual(res.totalValid, 2);
  assert.strictEqual(res.totalInvalid, 3);
  assert.strictEqual(res.validRows[0].taskName, 'Belajar PSAK 216');
  assert.strictEqual(res.validRows[1].taskName, 'Apply lowongan kerja');
  assert.strictEqual(res.invalidRows.length, 3);
});

test('9. Penyimpanan ke state: ID unik, metadata, dan event task.created', () => {
  const state = store.createState();
  const input = [
    'Belajar PSAK 216_60_normal_Mempelajari aset',
    'Apply lowongan kerja_45_tinggi',
    'Olahraga_15_rendah_Peregangan'
  ].join('\n');

  const parsed = bulk.parseBulkInput(input);
  const now = 1700000000000;
  const created = bulk.addBulkTasks(state, parsed.validRows, '2026-10-29', now);

  assert.strictEqual(created.length, 3);
  assert.strictEqual(state.tasks.length, 3);

  // Task 1
  const t1 = state.tasks[0];
  assert.ok(t1.id.startsWith('task_'));
  assert.strictEqual(t1.title, 'Belajar PSAK 216');
  assert.strictEqual(t1.targetDate, '2026-10-29');
  assert.strictEqual(t1.durationSec, 3600);
  assert.strictEqual(t1.left, 3600);
  assert.strictEqual(t1.priority, 'normal');
  assert.strictEqual(t1.description, 'Mempelajari aset');
  assert.strictEqual(t1.done, false);
  assert.strictEqual(t1.archived, false);

  // Task 2
  const t2 = state.tasks[1];
  assert.ok(t2.id.startsWith('task_'));
  assert.notStrictEqual(t1.id, t2.id);
  assert.strictEqual(t2.title, 'Apply lowongan kerja');
  assert.strictEqual(t2.durationSec, 2700);
  assert.strictEqual(t2.left, 2700);
  assert.strictEqual(t2.priority, 'high');
  assert.strictEqual(t2.description, '');

  // Task 3
  const t3 = state.tasks[2];
  assert.strictEqual(t3.title, 'Olahraga');
  assert.strictEqual(t3.priority, 'low');
  assert.strictEqual(t3.durationSec, 900);

  // Event audit
  const createEvents = state.events.filter((e) => e.kind === 'task.created');
  assert.strictEqual(createEvents.length, 3);
  assert.strictEqual(createEvents[0].taskId, t1.id);
  assert.strictEqual(createEvents[1].taskId, t2.id);
  assert.strictEqual(createEvents[2].taskId, t3.id);
});

test('10. Rollback jika penyimpanan gagal: removeCreated membersihkan state', () => {
  const state = store.createState();
  const parsed = bulk.parseBulkInput('Tugas Uji_20_normal_Uji rollback');
  const created = bulk.addBulkTasks(state, parsed.validRows, '2026-10-29');

  assert.strictEqual(state.tasks.length, 1);
  assert.strictEqual(state.events.filter((e) => e.kind === 'task.created').length, 1);

  // Simulasikan rollback
  bulk.removeCreated(state, created);
  assert.strictEqual(state.tasks.length, 0);
  assert.strictEqual(state.events.filter((e) => e.kind === 'task.created').length, 0);
});

test('11. Persistensi: serialisasi JSON dan reload menjaga data tugas', () => {
  const state = store.createState();
  const parsed = bulk.parseBulkInput('Tugas A_30_normal_Deskripsi\nTugas B_15_tinggi');
  bulk.addBulkTasks(state, parsed.validRows, '2026-10-29');

  const serialized = JSON.stringify(state);
  const reloaded = JSON.parse(serialized);

  assert.strictEqual(reloaded.tasks.length, 2);
  assert.strictEqual(reloaded.tasks[0].title, 'Tugas A');
  assert.strictEqual(reloaded.tasks[0].durationSec, 1800);
  assert.strictEqual(reloaded.tasks[0].left, 1800);
  assert.strictEqual(reloaded.tasks[0].priority, 'normal');

  assert.strictEqual(reloaded.tasks[1].title, 'Tugas B');
  assert.strictEqual(reloaded.tasks[1].durationSec, 900);
  assert.strictEqual(reloaded.tasks[1].left, 900);
  assert.strictEqual(reloaded.tasks[1].priority, 'high');
});

test('12. Keamanan timer: penambahan banyak tugas tidak mengganggu sesi timer aktif', () => {
  const state = store.createState();
  const existingTask = store.addTask(state, { title: 'Sesi aktif', targetDate: '2026-10-29', durationSec: 1500 }, 1000);
  const ses = sessions.createSession(state, { taskId: existingTask.id, taskName: existingTask.title, plannedSec: 1500 }, 2000);
  assert.strictEqual(ses.state, 'running');

  // Tambah tugas massal
  const parsed = bulk.parseBulkInput('Tugas Tambahan_30_normal_Desc\nTugas Baru_45_tinggi');
  bulk.addBulkTasks(state, parsed.validRows, '2026-10-29', 3000);

  // Sesi timer tidak boleh terpengaruh
  assert.strictEqual(state.sessions.length, 1);
  assert.strictEqual(state.sessions[0].id, ses.id);
  assert.strictEqual(state.sessions[0].state, 'running');
  assert.strictEqual(state.sessions[0].taskId, existingTask.id);
  assert.strictEqual(state.sessions[0].plannedSec, 1500);
});

test('13. Tambah tugas tunggal biasa tetap berfungsi tanpa regresi', () => {
  const state = store.createState();
  const t = store.addTask(state, {
    title: 'Single Task',
    targetDate: '2026-10-29',
    description: 'Manual',
    priority: 'normal',
    durationSec: 1500
  }, 4000);

  assert.ok(t);
  assert.strictEqual(t.title, 'Single Task');
  assert.strictEqual(t.durationSec, 1500);
  assert.strictEqual(state.tasks.length, 1);
});

test('14. Integrasi UI: struktur modal, kolom tabel format baru, dan script terdaftar', () => {
  const fs = require('fs');
  const path = require('path');
  const tugasSrc = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'pages', 'tugas.js'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'theme.css'), 'utf8');

  // Script tag di index.html
  assert.match(indexSrc, /<script src="shared\/bulkTasks\.js"><\/script>/);

  // Tombol tambah banyak tugas
  assert.match(tugasSrc, /btn-bulk-tasks/);
  assert.match(tugasSrc, /Tambah Banyak Tugas/);

  // Format baru di petunjuk UI
  assert.match(tugasSrc, /nama tugas_waktu_prioritas_deskripsi/);

  // Urutan kolom tabel pratinjau: Nama Tugas, Durasi, Prioritas, Deskripsi, Tanggal, Status
  assert.match(tugasSrc, /ui\.el\('th', 'Nama Tugas'\)/);
  assert.match(tugasSrc, /ui\.el\('th\.num', 'Durasi'\)/);
  assert.match(tugasSrc, /ui\.el\('th', 'Prioritas'\)/);
  assert.match(tugasSrc, /ui\.el\('th', 'Deskripsi'\)/);
  assert.match(tugasSrc, /ui\.el\('th', 'Tanggal'\)/);
  assert.match(tugasSrc, /ui\.el\('th', 'Status'\)/);

  // Aksi modal
  assert.match(tugasSrc, /'Batal'/);
  assert.match(tugasSrc, /'Pratinjau Tugas'/);
  assert.match(tugasSrc, /'Tambah Semua Tugas'/);

  // Proteksi double click & submit lock
  assert.match(tugasSrc, /isSubmitting/);

  // CSS kelas
  assert.match(cssSrc, /\.modal\.modal-bulk/);
  assert.match(cssSrc, /\.bulk-table/);
  assert.match(cssSrc, /\.bulk-help/);
});
