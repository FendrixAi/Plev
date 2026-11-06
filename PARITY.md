# Paritas tampilan (Original = acuan)

**Prinsip:** logika fitur hanya ada satu (di `shared/` dan `renderer/core.js`). Setiap tampilan boleh punya tata letak,
alur, dan pengalaman sendiri, tapi hanya memanggil logika yang sama, dan datanya tetap satu. **Original**
(`renderer/pages/`) adalah acuan daftar fitur. Fitur baru dibangun di Original dulu (untuk uji), lalu dibuatkan
tampilannya di tiap tampilan lain. Tampilan lain = setiap folder di `renderer/experiences/<nama>/`.

**Aturan logika:** aturan bisnis (filter tugas, total fokus, terlambat, arsip, dan sebagainya) ditaruh di `shared/` dan
dipanggil dari tampilan. Jangan menulis ulang di dalam tampilan. Contoh yang sudah dirapikan:
`JF.store.tasksTargeting`, `JF.model.isOverdue`, `JF.store.archivedTasks`, `JF.sessions.summary`, `JF.sessions.focusByDay`.

**Cara pakai:**
1. Bangun fitur baru di Original, lalu jalankan `npm test`. Kalau ada fitur Original yang belum dicatat untuk sebuah tampilan, tes `parity` gagal dan menyebut apa yang kurang.
2. Tambahkan baris di bagian tampilan itu: `pending` (belum), `na` (sengaja beda, wajib beralasan), atau `ported` (sudah ada). Tes memastikan status jujur terhadap kode.
3. `node tests/parity-scan.js` menampilkan daftar mentah per tampilan.

**Menambah tampilan baru:**
1. Buat folder `renderer/experiences/<nama>/` dan daftarkan seperti Capybara World.
2. Jalankan `node tests/parity-scan.js --init <nama>` dan tempel hasilnya di bawah (kerangka berisi semua fitur Original yang belum dibuat, berstatus `pending`).
3. Kerjakan satu per satu; ubah ke `ported` (atau `na` + alasan) setelah selesai. Tanpa bagian di sini, `npm test` gagal.

**Batas deteksi:** lapis A hanya melihat fungsi logika yang dipanggil Original. Fitur yang memakai ulang fungsi lama di
halaman lain tidak terdeteksi otomatis, jadi catat di lapis B. Alias lokal bernama ambigu (mis. `D` untuk dua hal di satu berkas) dilewati.

Status: `ported` = sudah ada, `pending` = belum, `na` = sengaja tidak dibuat / berbeda desain.

## Tampilan: capybara-world

### A. Simbol logika (dipindai otomatis)

| Simbol | Status | Catatan |
|---|---|---|
| `app.finishOpen` | ported | Tombol Selesai sesi di kartu fokus Capybara |
| `sessions.isOpen` | ported | Membedakan sesi waktu bebas di HUD, kartu fokus, dan Riwayat |
| `sessions.activeSeconds` | ported | Jam hitung maju (+mm:ss) |
| `sessions.summary` | ported | Total riwayat dihitung satu kali di `shared/`, dipakai kedua tampilan |
| `completion.start` | ported | Selesai + ringkasan dari Beranda dan Tugas Capybara |
| `model.isOverdue` | ported | Aturan terlambat sama di semua tampilan |
| `store.archivedTasks` | ported | Daftar arsip dari `shared/` |
| `app.emit` | na | Bus event internal Original; Capybara me-render ulang lewat experience.js |
| `sessions.officialSeconds` | na | Dipakai Original untuk chip total per minggu; Riwayat Capybara memakai `sessions.summary` dan `focusByDay` |
| `taskUI.openEdit` | na | Capybara punya dialog ubah tugas sendiri (`editTask` di pages.js) |
| `app.removeLegacyCopies` | ported | Tombol Hapus salinan data lama di panel Data |
| `app.storageUsage` | ported | Kartu Penyimpanan di panel Data |
| `journal.count` | ported | Jumlah catatan jurnal di panel Data |
| `library.attachmentsForTask` | ported | Chip file dan dialog Output tugas di Kebun Cita-cita |
| `store.ev` | ported | Pengaturan timer mencatat `settings.changed` lewat `setSetting` |
| `taskUI.prefillAdd` | na | Padanan sendiri: tombol Tambah tugas pada tanggal ini di Kalender membawa tanggal ke formulir Tugas (`cwQuickDate`) |

### B. Fitur per halaman (penanda dicek di berkas, dan di dalam fungsi bila ada `#fungsi`)

Format sel: `berkas#fungsi: penanda` (jalur relatif ke `renderer/`).

| Fitur | Original | capybara-world | Status |
|---|---|---|---|
| Waktu bebas: tombol Selesai sesi | `pages/beranda.js: app.finishOpen` | `experiences/capybara-world/beranda.js: app.finishOpen` | ported |
| Waktu bebas: jam hitung maju di HUD | `core.js: activeSeconds` | `experiences/capybara-world/experience.js#updateTimer: activeSeconds` | ported |
| Waktu bebas: teman fokus CapyRafi (jejak kaki 15 menit) | `pages/beranda.js: tanpa batas waktu` | `experiences/capybara-world/beranda.js: cw-companion` | ported |
| Waktu bebas: ditandai di Riwayat | `pages/riwayat.js: s.openEnded` | `experiences/capybara-world/pages.js#renderHistory: session.openEnded` | ported |
| Ringkasan: dibaca lagi di kartu tugas selesai | `pages/tugas.js: JF.completion.summaryBlock` | `experiences/capybara-world/pages.js: JF.completion.summaryBlock` | ported |
| Ringkasan: chip di Riwayat | `pages/riwayat.js: JF.completion.chip` | `experiences/capybara-world/pages.js#renderHistory: JF.completion.chip` | ported |
| Ringkasan: tugas selesai di rincian Laporan harian | `pages/laporan.js: JF.completion.summaryBlock` | `experiences/capybara-world/pages.js#reportDetail: JF.completion.summaryBlock` | ported |
| Laporan: tugas selesai hari ini (kartu berjalan) | `pages/laporan.js: detailBlock(todayDone` | `experiences/capybara-world/pages.js#renderReports: reportDetail(todayDoneIds` | ported |
| Kalender: tambah tugas pada tanggal terpilih | `pages/kalender.js: JF.taskUI.prefillAdd` | `experiences/capybara-world/pages.js#renderCalendar: Tambah tugas pada tanggal ini` | ported |
| Goals: kelola output tugas (lampirkan, ganti, hapus) | `pages/goals.js: Hapus output?` | `experiences/capybara-world/pages.js#openOutput: Hapus output?` | ported |
| Goals: chip output (Butuh output, file hilang) | `pages/goals.js: Butuh output` | `experiences/capybara-world/pages.js#outputChips: Butuh output` | ported |
| Data: penyimpanan terpakai dan hapus salinan lama | `pages/pengaturan.js: Hapus salinan data lama` | `experiences/capybara-world/pages.js#renderSettings: Hapus salinan data lama` | ported |
| Pengaturan: catat perubahan (`settings.changed`) | `pages/pengaturan.js: settings.changed` | `experiences/capybara-world/pages.js#setSetting: settings.changed` | ported |

## Tampilan: mola-world

### A. Simbol logika (dipindai otomatis)

| Simbol | Status | Catatan |
|---|---|---|
| `app.emit` | pending | belum dibuat |
| `app.removeLegacyCopies` | pending | belum dibuat |
| `app.replaceState` | pending | belum dibuat |
| `app.save` | pending | belum dibuat |
| `app.storageUsage` | pending | belum dibuat |
| `backup.MAX_CHARS` | pending | belum dibuat |
| `backup.validate` | pending | belum dibuat |
| `completion.chip` | pending | belum dibuat |
| `completion.summaryBlock` | pending | belum dibuat |
| `dates.buildDay` | pending | belum dibuat |
| `dates.dayKey` | pending | belum dibuat |
| `dates.isDayKey` | pending | belum dibuat |
| `dates.parseDay` | pending | belum dibuat |
| `documents.attachToTask` | pending | belum dibuat |
| `documents.availLabel` | pending | belum dibuat |
| `documents.availability` | pending | belum dibuat |
| `documents.ensureFresh` | pending | belum dibuat |
| `documents.fmtSize` | pending | belum dibuat |
| `documents.message` | pending | belum dibuat |
| `documents.open` | pending | belum dibuat |
| `documents.refreshStatus` | pending | belum dibuat |
| `documents.removeFromTask` | pending | belum dibuat |
| `documents.statusMap` | pending | belum dibuat |
| `goals.METHOD_LABEL` | pending | belum dibuat |
| `goals.STATUS_LABEL` | pending | belum dibuat |
| `goals.list` | pending | belum dibuat |
| `homeExperience.get` | pending | belum dibuat |
| `journal.count` | pending | belum dibuat |
| `journal.createAutosave` | pending | belum dibuat |
| `journal.entryFor` | pending | belum dibuat |
| `journal.save` | pending | belum dibuat |
| `journal.setGoalLink` | pending | belum dibuat |
| `journal.summary` | pending | belum dibuat |
| `library.attachmentsForTask` | pending | belum dibuat |
| `library.query` | pending | belum dibuat |
| `model.PRIORITIES` | pending | belum dibuat |
| `report.buildReport` | pending | belum dibuat |
| `report.fileName` | pending | belum dibuat |
| `sessions.officialSeconds` | pending | belum dibuat |
| `sessions.summary` | pending | belum dibuat |
| `store.addTask` | pending | belum dibuat |
| `store.archiveTask` | pending | belum dibuat |
| `store.archivedTasks` | pending | belum dibuat |
| `store.clearFocusTargetOverride` | pending | belum dibuat |
| `store.deleteArchivedTasks` | pending | belum dibuat |
| `store.editTask` | pending | belum dibuat |
| `store.ev` | pending | belum dibuat |
| `store.find` | pending | belum dibuat |
| `store.focusTargetFor` | pending | belum dibuat |
| `store.rescheduleTask` | pending | belum dibuat |
| `store.restoreTask` | pending | belum dibuat |
| `store.setFocusTargetDefault` | pending | belum dibuat |
| `store.setFocusTargetOverride` | pending | belum dibuat |
| `store.setRequiresOutput` | pending | belum dibuat |
| `taskUI.openEdit` | pending | belum dibuat |
| `taskUI.prefillAdd` | pending | belum dibuat |
| `updateUI.mount` | pending | belum dibuat |
| `xlsx.build` | pending | belum dibuat |

### B. Fitur per halaman

| Fitur | Original | mola-world | Status |
|---|---|---|---|

