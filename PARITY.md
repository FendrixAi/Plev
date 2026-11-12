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
| `app.emit` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.removeLegacyCopies` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.replaceState` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.save` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.storageUsage` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `backup.MAX_CHARS` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `backup.validate` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `completion.chip` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `completion.summaryBlock` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `dates.buildDay` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `dates.dayKey` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `dates.isDayKey` | ported | |
| `dates.parseDay` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.attachToTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.availLabel` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.availability` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.ensureFresh` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.fmtSize` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.message` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.open` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.refreshStatus` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.removeFromTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.statusMap` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `goals.METHOD_LABEL` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `goals.STATUS_LABEL` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `goals.list` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `homeExperience.get` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.count` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.createAutosave` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.entryFor` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.save` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.setGoalLink` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.summary` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `library.attachmentsForTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `library.query` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `model.PRIORITIES` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `report.buildReport` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `report.fileName` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `sessions.officialSeconds` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `sessions.summary` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.addTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.archiveTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.archivedTasks` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.clearFocusTargetOverride` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.deleteArchivedTasks` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.editTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.ev` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.find` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.focusTargetFor` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.rescheduleTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.restoreTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.setFocusTargetDefault` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.setFocusTargetOverride` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.setRequiresOutput` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `taskUI.openEdit` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `taskUI.prefillAdd` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `updateUI.mount` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `xlsx.build` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.reopenTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `homeExperience.set` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `model.PRIORITY_LABEL` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `model.isOverdue` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |

### B. Fitur per halaman

| Fitur | Original | mola-world | Status |
|---|---|---|---|


## Tampilan: fast-food

### A. Simbol logika (dipindai otomatis)

| Simbol | Status | Catatan |
|---|---|---|
| `app.breakInfo` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.currentSession` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.emit` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.findTask` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.finishOpen` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.music` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.on` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.pause` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.rawState` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.removeLegacyCopies` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.reopenTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.replaceState` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.resume` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.save` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.selectedTaskId` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.skipBreak` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.startTask` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.stopPermanent` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.storageUsage` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `app.today` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `app.todayStats` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `backup.MAX_CHARS` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `backup.validate` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `completion.chip` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `completion.start` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `completion.summaryBlock` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `dates.addDays` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `dates.buildDay` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `dates.dayKey` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `dates.isDayKey` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `dates.parseDay` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `dates.startOfDay` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `documents.attachToTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.availLabel` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.availability` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.ensureFresh` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.fmtSize` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.message` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.open` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.refreshStatus` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.removeFromTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `documents.statusMap` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `goals.METHOD_LABEL` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `goals.STATUS_LABEL` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `goals.list` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `homeExperience.get` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `homeExperience.set` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.count` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.createAutosave` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.entryFor` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.save` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.setGoalLink` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `journal.summary` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `library.attachmentsForTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `library.query` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `model.PRIORITIES` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `model.PRIORITY_LABEL` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `model.isOverdue` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `report.buildReport` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `report.fileName` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `sessions.activeSeconds` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `sessions.isOpen` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `sessions.officialSeconds` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `sessions.remainingSeconds` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `sessions.summary` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.activeTasks` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `store.addTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.archiveTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.archivedTasks` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.clearFocusTargetOverride` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.deleteArchivedTasks` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.editTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.ev` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.find` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.focusTargetFor` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.overdueTasks` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `store.rescheduleTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.restoreTask` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.setFocusTargetDefault` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.setFocusTargetOverride` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.setRequiresOutput` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `store.upcomingTasks` | ported | dipakai langsung oleh kode Fast Food (beranda.js / experience.js) |
| `taskUI.openEdit` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `taskUI.prefillAdd` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `updateUI.mount` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |
| `xlsx.build` | na | dipakai lewat halaman Original yang dipasang langsung di Mola (JF.pages), bukan kode Mola sendiri |

### B. Fitur per halaman

| Fitur | Original | fast-food | Status |
|---|---|---|---|
