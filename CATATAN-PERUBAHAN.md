# Catatan perubahan

## Fast Food fase 1: fondasi, shell "Diner Counter", Beranda, siang dan malam
- Experience baru **Fast Food (siang & malam)** di Pengaturan, di folder `renderer/experiences/fast-food/`. Mengikuti toggle tema (tidak dipaksa terang seperti Mola). Logika tetap dari Original (JF.app / JF.store / JF.sessions / JF.completion); XP burger dihitung dari `JF.capyrafi.compute`, tanpa penyimpanan baru.
- **Layout**: satu layar fokus tanpa sidebar. Bilah atas tipis (merek, level burger, timer mini saat di halaman lain, musik, kartu mini, tombol siang/malam), **dock bawah** (Statistics | Settings | Menu) dan **Menu Board** chalkboard yang naik dari dock berisi 10 halaman. Halaman selain Beranda memakai kepala "neon sign".
- **Beranda "Counter"**: timer besar, chip Focus Time, burger/fries/cup/lampu gantung, lantai kotak-kotak berperspektif; picker tugas (filter tanggal), Mulai/Pause/Lanjutkan/Hentikan/Selesai sesi/Selesai + ringkasan/Lewati istirahat; di bawahnya Papan skor, Order hari ini, Order terlambat, dan **Burger Builder** (bun, patty, keju, tomat, selada, bun atas + topi koki sesuai XP; konfeti dan toast saat naik tahap).
- **Transisi**: pindah halaman memakai tirai kotak-kotak; siang <-> malam memakai bukaan melingkar bermata lembut dari tombol tema (View Transitions), disusul neon berkedip dan lampu menyala (malam) atau lampu berayun dan papan memantul (siang). Menghormati `prefers-reduced-motion`; tanpa View Transitions langsung berganti.
- Aset: 20 sprite dari lembar ilustrasi + irisan bun dipotong jadi WebP transparan dan **ditanam sebagai data URI** di `sprites.js` (CSP hanya mengizinkan `img-src data:`, dan build hanya menyertakan js/css/font).
- Halaman selain Beranda sementara memakai halaman Original di dalam panggung diner (kulit warna dan kartu berhias strip kotak-kotak). Didesain ulang per halaman di fase 2-4.
- `theme.js`: hook `JF.themeTransition` (hanya aktif untuk perubahan tema oleh pengguna dan hanya saat Fast Food aktif). `boot.js`, `index.html`, `pengaturan.js`, `beranda.js`: pendaftaran experience ketiga.
- Tes: `tests/fast-food.test.js` (6 tes), bagian Fast Food di `PARITY.md`. Smoke test jsdom: 10 halaman terender, sesi mulai/jeda/lanjut, ganti tema, menu board, 0 error.
- Sisa: fase 2 (Tugas, Kalender), fase 3 (Riwayat, Laporan, Analitik), fase 4 (Goals, Jurnal, Library, Pengaturan, responsif), modal dan kartu mini.

## Perbaikan Kalender Mola: nama tugas tidak tampil
- Penyebab: panel tanggal di samping grid membuat kolom hari hanya ±30–70px, dan aturan sel sempit (fase 1) mengubah penanda tugas jadi titik.
- Perbaikan: panel tanggal kini selalu di bawah grid (kolom hari tetap lebar), nama tugas selalu tampil (maks. 2 baris, font kecil di sel sempit), dan setelah memilih hari halaman otomatis menggulir ke panelnya (`mola-world/pages.js`).

## Mola World fase 5: Library dan Pengaturan (rencana selesai)
- Gaya baru ada di `renderer/experiences/mola-world/pages.css` (bagian "FASE 5"). Hanya tampilan; markup dan logika tetap dari Original.
- **Library**: kepala berkertas dengan tombol kapsul; statistik berbentuk mutiara; bilah filter satu kapsul panjang; tiap dokumen jadi baris "botol" dengan lencana bulat berwarna per jenis (tautan, catatan, PDF, spreadsheet); panel detail berupa peti kertas bergaris ombak dan menempel saat digulir.
- **Pengaturan**: kartu tersusun dua kolom (Experience selebar penuh bermatahari), tiap kartu punya ikon bulat (kompas, jam pasir, target, tomat, musik, jendela, pelampung, kotak), input berbentuk kapsul, opsi centang berupa pil, peringatan berupa catatan kuning.
- Dengan ini semua halaman Mola (Beranda sampai Pengaturan) sudah punya tampilan sendiri. Modal (edit tugas, tambah banyak, dll.) masih memakai tampilan Original.

## Mola World fase 3 dan 4: Analitik, Goals, Jurnal
- Gaya baru ada di `renderer/experiences/mola-world/pages.css` (bagian "FASE 3 dan 4"). Hanya tampilan; markup dan logika tetap dari Original.
- **Analitik**: toolbar jadi panel "sonar" dengan tombol segmen kapsul; enam kartu KPI berbentuk gelembung dengan aksen warna dan hewan laut berbeda; pengamatan jadi balon bicara; kartu grafik berhias garis ombak; tabel berkepala kapsul.
- **Goals**: statistik berbentuk pulau kecil dengan ikon (jangkar, pulau, bendera, kompas); kartu goal jadi "pulau"; bar progres jadi rute kapal layar (berubah jadi pulau saat selesai); detail goal berpapan kapten dengan jangkar dan matahari; milestone berupa titik-titik rute bergelembung, milestone berikutnya menyala kuning.
- **Jurnal**: kepala halaman dan editor berkertas hangat; empat blok punya aksen warna dan ikon (matahari terbit, ombak, kerang, kompas); kolom tulis bergaris seperti buku catatan; statistik harian berikon.
- Sisa: fase 5 (Library dan Pengaturan).

## Mola World fase 2: Riwayat fokus dan Laporan harian
- Gaya baru ada di `renderer/experiences/mola-world/pages.css` (bagian "FASE 2"). Hanya tampilan; logika tetap dari Original.
- **Riwayat**: sesi tampil sebagai "jejak renang": tiap hari berupa pulau berbentuk kapsul, garis putus-putus vertikal dengan titik gelembung per sesi (hijau = terhitung, koral = terputus), angka Fokus/Jeda/Target berupa kapsul kecil, catatan pengantar berupa gulungan pesan.
- **Laporan**: kartu jadi "gulungan dalam botol" berhias garis ombak, dua kolom di layar lebar, kartu hari ini bermatahari dan selebar penuh, angka ringkasan berupa kapsul, "Lihat selengkapnya" berupa tombol kapsul, koreksi berupa catatan kuning, label "Catatan asli" bergembok.
- **Perbaikan kecil di Original** (`pages/riwayat.js`): penanda tab aktif kini dicari di dalam halaman itu sendiri (`host.querySelectorAll`), bukan lewat `#page-riwayat`. Sebelumnya tab aktif tidak tersorot di Mola karena host Mola tidak memakai id itu. Perilaku di Original tidak berubah.

## Mola World fase 1: Tugas dan Kalender punya tampilan sendiri
- Berkas baru `renderer/experiences/mola-world/pages.css` (dipasang di `index.html` setelah `fx.css`). Hanya tampilan: markup dan logika tetap dari Original, jadi fitur baru Original otomatis ikut dan tidak ada yang disalin dari Capybara World.
- **Tugas**: kartu tambah jadi "botol pesan" (form kapsul), tab Aktif/Arsip jadi pelampung, judul kelompok bergaris ombak (Terlambat = pusaran koral), daftar jadi dua kolom gelembung tugas dengan tombol di bawah, status terlambat/berjalan/selesai punya gaya sendiri, kondisi kosong jadi kolam karang.
- **Kalender**: header kapsul, hari berupa pelampung, sel mingguan membentuk ombak (kolom genap turun), hari ini bermatahari, penanda tugas berupa gelembung (jadi titik di sel sempit lewat container query), panel tanggal jadi "gua laut". Layar sempit: efek ombak dimatikan.
- Fase berikutnya: Riwayat + Laporan, Analitik, Goals + Jurnal, Library + Pengaturan.

## Mola World: tampilan penuh ketiga (baru)
- **Aturan:** fitur dan fungsi mengikuti Original. Tampilan dan animasi bebas per tema.
- **Tema ikan mola-mola (sunfish), hanya mode siang.** Tidak ada mode malam: `data-theme` dikunci `light` selama Mola aktif (juga saat sistem gelap atau `JF.theme.set('dark')`).
- **Chrome baru**: kartu maskot Mola di rel kiri (XP, pil timer, musik, kartu mini), panggung di tengah, rel pelampung di kanan sebagai navigasi. Layar sempit: rel kiri jadi strip atas, pelampung ke bawah.
- **Maskot Mola** digambar sebagai SVG (`mola-world/mola.js`), tumbuh 6 tahap dari XP yang sama dengan CapyRafi, tanpa penyimpanan baru.
- **Beranda Mola** mengikuti daftar fitur Beranda Original: timer fokus (mulai, jeda, lanjut, Selesai sesi, hentikan sesi, lewati istirahat, Selesai + ringkasan, filter tanggal termasuk Pilih tanggal), empat angka ringkasan, Rencana hari ini, dan Tugas terlambat. Ditambah hero laut animasi (mercusuar, ubur-ubur, ikan badut, penyu, kepiting, terumbu, harta karun) dan Perjalanan Mola.
- **Halaman lain** (Tugas, Kalender, Analitik, Riwayat, Laporan, Goals, Jurnal, Pengaturan, Library) memakai halaman Original langsung (`JF.pages.get(id)`) di panggung Mola dengan palet dan kartu laut. Fitur baru Original otomatis ikut. Tata letak dalam halamannya masih Original; desain khusus Mola dibuat bertahap (lihat `PARITY.md`, lapis B).
- **Efek laut interaktif** (`mola-world/fx.js`, `critters.js`, `fx.css`): tiap halaman punya hewan maskot di header yang bisa diklik untuk tips sesuai fiturnya (Tugas: kepiting, Kalender: penyu, Analitik: kawanan ikan, Riwayat: kuda laut, Laporan: gurita, Goals: peti harta, Jurnal: kerang mutiara, Pengaturan: ikan buntal, Library: paus). Tiga teman laut di rel kiri (kepiting, bintang laut, ubur-ubur) memberi tips dan fakta singkat. Efek bereaksi pada fitur nyata lewat perbandingan data sebelum-sesudah: tugas selesai (kepiting membawa bendera), tugas baru (gelembung), milestone (bintang laut), goal tercapai (peti harta terbuka), jurnal tersimpan (mutiara), dokumen masuk Library (gurita mengintip), sesi fokus selesai (Mola melompat). Ikan, kepiting, dan ubur-ubur lewat sesekali di halaman selain Beranda; klik area kosong memunculkan gelembung. Tidak menyentuh data. Dimatikan oleh `prefers-reduced-motion`; impor atau ganti data tidak memicu perayaan.
- **Wiring**: opsi "Mola World (siang)" di Pengaturan; `JF.homeExperience` menerima `mola-world`; `boot.js` memilih tampilan dari satu nama; `theme.css` Original tetap aktif untuk Mola (hanya variabel warna yang diganti).
- `cek.bat` (berkas diagnosa) dihapus karena dilarang `ui-integrity.test.js`.

## Capybara World: 8 fitur yang tertinggal sudah dibuatkan (baru)
- **Riwayat**: chip ringkasan tugas (dan penanda "Data lama") di tiap sesi.
- **Album harian**: rincian foto sekarang menampilkan tugas selesai beserta ringkasannya dan daftar yang belum selesai; kartu "hari ini" punya rincian yang sama.
- **Kalender Stiker**: tombol "＋ Tambah tugas pada tanggal ini" membawa tanggal ke formulir Tugas dan langsung fokus ke kolom nama.
- **Kebun Cita-cita**: chip output (jumlah file, Butuh output, file/output hilang) dan dialog **Kelola output** (wajib output, lampirkan, buka, ganti, hapus); status file dicek ulang saat halaman dibuka.
- **Pengaturan > Data**: kartu Sesi, Laporan, Jurnal, dan Penyimpanan terpakai, serta tombol Hapus salinan data lama.
- **Pengaturan timer** mencatat event `settings.changed` hanya bila nilainya berubah, sama seperti Original.
- Scanner paritas: alias yang dideklarasikan beberapa kali ke modul yang sama tidak lagi dianggap ambigu.

## Fondasi multi-tampilan (baru)
- **Logika duplikat di Capybara dipindah ke `shared/`**: "tugas hari ini" (`JF.store.tasksTargeting`), terlambat (`JF.model.isOverdue`), arsip (`JF.store.archivedTasks`), serta total riwayat (`JF.sessions.summary`, `focusByDay`, `endTime`) sekarang dipanggil dari kode bersama. Riwayat Original ikut memakai `sessions.summary`. Hasil angkanya sama; bedanya aturan hanya ada satu tempat.
- **Paritas multi-tampilan**: setiap folder di `renderer/experiences/<nama>/` otomatis dianggap tampilan dan wajib punya bagian di `PARITY.md`. `node tests/parity-scan.js --init <nama>` mencetak kerangka berisi semua fitur Original yang belum dibuat. `npm test` gagal kalau ada tampilan tanpa bagian, atau fitur Original baru yang belum dicatat di salah satu tampilan.

## Paritas Original ↔ Capybara World (baru)
- **Waktu bebas sekarang juga di Capybara World**: "Lanjut fokus" setelah timer habis memulai sesi hitung maju di kedua tampilan (pengaman khusus mode di `core.js` dihapus). Kartu fokus Capybara menampilkan **+mm:ss**, label "Waktu bebas", tombol **Selesai sesi**, dan **teman fokus**: CapyRafi berganti tahap makin lama kamu fokus (Pemanasan, Mulai mengalir, Dalam flow, Fokus dalam, Maraton) dengan satu **jejak kaki tiap 15 menit** (maksimal 8). Pil timer di HUD ikut hitung maju (+mm:ss), konfirmasi Hentikan mengingatkan soal Selesai sesi, dan Riwayat menandai sesi "waktu bebas". Tata letaknya khas Capybara, logikanya memakai `app.finishOpen` dan `JF.sessions` yang sama dengan Original.
- **`PARITY.md` + tes `parity`**: daftar fitur Original yang belum ada di Capybara. Dua lapis: (A) simbol logika yang dipindai otomatis (`node tests/parity-scan.js`) dan (B) fitur per halaman dengan penanda di berkas. `npm test` gagal kalau ada fitur Original baru yang belum dicatat, atau kalau status `ported`/`pending` tidak sesuai kode. Daftar yang masih pending tampil sebagai ringkasan di keluaran tes.
- **Dibersihkan**: `cek.bat` yang tertinggal di folder dihapus (menyelesaikan tes `ui-integrity` yang gagal).

## Perbaikan terbaru
- **Suara penyelesaian**: pilihan eksplisit per kanal (sesi fokus selesai, istirahat selesai): *Pakai beep*, *Pakai lagu*, atau *Tanpa suara*, lengkap dengan tombol Tes. Mode Tanpa suara tidak pernah jatuh ke beep. Pengguna lama tetap seperti sebelumnya (ada lagu = lagu, tidak ada = beep). Peringatan 8 detik terpisah dan tetap berbunyi. Tersedia di Pengaturan (Original) dan tab Musik (Capybara World).
- **Dialog setelah timer selesai**: "Kembali ke tugas" diganti **Tandai selesai**. Tombol ini membuka form berisi ringkasan pekerjaan dan lampiran (file apa pun atau tautan). Simpan menandai tugas selesai; Batal kembali ke pilihan langkah. Ringkasan, tautan, dan file disimpan di Library dan terhubung ke tugas (sumber: "Ringkasan tugas"), jadi tidak ada penyimpanan baru. Berlaku untuk Original dan Capybara World.
- **Selesai + ringkasan dari mana saja**: tombol "Selesai + ringkasan" ada di Tugas (Original dan Capybara World), kartu sesi di Beranda (saat siap, berjalan, atau dijeda), dan daftar tugas Beranda Capybara. Jalurnya sama dengan dialog setelah timer. Centang cepat tetap ada. Kalau sesi sedang berjalan pada tugas itu, form memberi tahu bahwa sesinya akan dihentikan.
- **Ringkasan bisa dibaca lagi**: tugas selesai menampilkan cuplikan ringkasan, jumlah file/tautan, dan tombol "Lihat ringkasan" (pembaca lengkap + buka file/tautan + ubah). Tugas selesai tanpa ringkasan punya "Tambah ringkasan". Chip "Ringkasan" muncul di Riwayat fokus, dan Laporan harian (hari ini dan laporan final) punya bagian "Ringkasan tugas selesai" (dibaca dari catatan terbaru; angka laporan tetap final).
- **Perbaikan**: tombol "Buka tautan" (Library dan lampiran) tidak berfungsi karena jendela baru diblokir. Sekarang tautan http/https dibuka di browser bawaan lewat `shell.openExternal`, jendela baru di dalam aplikasi tetap ditolak.
- **Kalender, panel tanggal**: "See journaling" sekarang berupa kotak berwarna kuning (subjudul menunjukkan ada/tidaknya catatan jurnal), dan ada kotak hijau baru **See library** (subjudul: jumlah dokumen yang ditambahkan pada tanggal itu). See library membuka Library yang sudah tersaring ke tanggal tersebut (`#library?date=`).
- **Library**: filter baru "Tanggal ditambahkan" (input tanggal + tombol "Semua tanggal"), bisa juga dibuka lewat tautan dari Kalender.
- **Bug ikon tanggal di dark mode**: ikon kalender di samping dd/mm/yyyy tadinya hitam di tema gelap. Sekarang warnanya mengikuti warna tulisan input (terang maupun gelap), di Original maupun Capybara World; popup kalender bawaan juga ikut gelap.
- **Lanjut fokus = waktu bebas (Original)**: di dialog setelah timer selesai, "Lanjut fokus" sekarang memulai sesi tanpa batas yang menghitung maju (+mm:ss) di Beranda, jendela mini, tray, judul jendela, dan status sidebar. Akhiri dengan tombol baru **Selesai sesi**: waktu berjalan (tanpa jeda) dihitung ke total fokus, lalu muncul lagi pilihan Tandai selesai / Istirahat / Lanjut fokus. "Hentikan sesi" tetap membuang waktunya (terputus), dan dialog konfirmasinya mengingatkan soal Selesai sesi. Pindah ke tugas lain atau menandai tugas selesai saat waktu bebas berjalan otomatis menyimpan waktunya. Pengaman: dijeda otomatis bila berjalan 3 jam tanpa jeda. Riwayat menampilkan "Bebas" pada kolom Target. Capybara World belum punya tombol Selesai sesi, jadi di sana "Lanjut fokus" tetap sesi berdurasi tetap.
- **Tugas (Original)**: centang cepat "tandai selesai" dihapus. Menandai selesai kini lewat **Selesai + ringkasan** (atau dialog setelah timer). Tugas selesai menampilkan tanda status centang (bukan tombol) dan dikembalikan lewat tombol **Urungkan**.
- **Laporan harian (Original) kembali ringkas**: kartu kembali berukuran seperti semula (header, angka, koreksi, catatan asli). Rincian tugas (daftar tugas selesai dengan ringkasan/lampiran, dan tugas belum selesai) disembunyikan di balik tombol **Lihat selengkapnya** (panah bawah), ditutup lagi dengan **Tutup** (panah atas). Status buka/tutup bertahan saat halaman menyegarkan diri. Kartu tanpa rincian tidak punya tombol.
- **Jalur "selesai" seragam**: tombol Selesai di panel tanggal Kalender dan centang tugas di Goals sekarang membuka form **Selesai + ringkasan** (mengembalikan tugas selesai tetap lewat Urungkan/centang).
- **Jendela mini**: setelah sesi fokus selesai, tombol Jeda/Lanjut yang tadinya tersembunyi berubah menjadi tombol ikon **Lanjut fokus** (dua panah, warna aksen, tooltip "Lanjut fokus") dan label "Sesi selesai". Tombolnya hanya ada selama dialog "Sesi fokus selesai" menunggu, lalu memulai waktu bebas seperti tombol di dialog (dialog di jendela utama otomatis tertutup). Ukuran jendela dan pill mini tidak berubah.
- **Perbaikan waktu bebas**: setelah **Selesai sesi**, memilih **Lanjut fokus** di dialog kini melanjutkan sesi yang sama (hitungan lanjut dari waktu terakhir, mis. +12:34, bukan kembali ke +00:00). Selama berjalan lagi, sesi itu belum masuk total dan masuk kembali saat diakhiri. Kalau tugasnya sudah selesai atau ada sesi lain berjalan, otomatis memulai sesi baru. Setelah timer biasa habis, Lanjut fokus tetap memulai sesi waktu bebas baru dari 0.
- **Keamanan**: pengalihan (redirect) jendela juga diblokir; IPC `popup`, `mini-ready`, dan `theme` aman saat jendela utama sudah hancur.
- **Teks**: "Target tugas per hari (rentetan)", "Sesi & pengatur waktu", tombol konfirmasi "Hentikan permanen", nilai kosong tampil "—" (Beranda) dan "belum ada fokus tercatat" (Riwayat).
- **Dibersihkan**: `cek.bat`, `REDESIGN_SUMMARY.md`, `TIMER_FIX_SUMMARY.md` benar-benar dihapus dari folder.
- **Tes**: urutan menu di tes Goals ditambah Library; tes keamanan disesuaikan dengan `lockNavigation` dan `onTrusted`.

## Perbaikan
- **Sidebar**: logo jam dihapus; teks kredit diganti menjadi "MM - Built by Iqbal Rafi"; teks brand dan kredit
  sejajar ikon menu, tombol lipat sejajar tepi menu, dan saat terlipat berada tepat di tengah kolom ikon.
- **Jendela sempit**: sidebar terlipat otomatis di bawah 900 px (pilihan tersimpan tidak berubah), sehingga isi tidak meluber.
- **Kata-kata**: "resmi" dihapus ("Fokus hari ini", "Terhitung / Tidak terhitung"); "Tugas" dipakai konsisten;
  "terlambat" menggantikan "tertunda"; "istirahat" untuk jeda pomodoro; istilah teknis diganti bahasa sehari-hari.
- **Cadangan**: ditambah *Pulihkan dari cadangan* (dengan validasi dan salinan pengaman otomatis) dan
  *Hapus salinan data lama*; penggunaan penyimpanan ditampilkan.
- **Aksesibilitas**: kolom judul, tanggal, dan durasi tugas punya label.
- **Keamanan**: IPC hanya diterima dari jendela aplikasi sendiri, jendela baru dan navigasi diblokir, jendela memakai sandbox.
- **Build**: nama installer dan portable dibedakan (`Jam Fokus Setup`, `Jam Fokus Portable`).

## Dibersihkan
- Dihapus: `cek.bat`, `REDESIGN_SUMMARY.md`, `TIMER_FIX_SUMMARY.md`, catatan lama yang usang.

## Capybara World: CapyRafi (baru)
- **Tata letak baru**: sidebar kiri diganti HUD di atas (CapyRafi + XP, judul, timer, musik) dan dock navigasi melayang di bawah.
- **CapyRafi tumbuh**: 6 tahap (Bayi Capy sampai Raja Capy) dari data asli: tugas selesai (10 XP), milestone (30 XP), goal tercapai (120 XP). XP dihitung ulang dari state, tanpa penyimpanan baru, jadi Original dan Capybara selalu sinkron. Ekspresi berubah: fokus, istirahat, pesta, cemas, ngantuk. Colek CapyRafi di Beranda untuk celotehnya.
- **Diperbaiki**: pemutar musik global, pil timer global, lencana tugas terlambat, autosave Jurnal, ekspor Excel di Analitik, pengaturan kartu mini, target fokus bawaan lewat store.
- **Aman saat mengetik**: halaman Capybara tidak lagi di-render ulang saat kamu sedang mengetik di kolom isian.

## Capybara World: halaman dalam didesain ulang
- **Tugas, Kebun Tugas**: papan kolom Terlambat / Hari ini / Mendatang / Selesai berisi catatan tempel. Seret catatan antar kolom untuk menjadwalkan ulang (hari ini atau besok) atau menyelesaikannya. Bar tambah cepat satu baris, dan ada tab Arsip.
- **Kalender Stiker**: hari yang semua tugasnya selesai mendapat stiker CapyRafi, titik menandai tugas, dan penanda merah untuk hari yang tertinggal. Tata letak dua kolom (peta bulan di kiri, agenda dan jejak fokus di kanan).
- **Goals, Kebun Cita-cita**: setiap goal menjadi pohon yang tumbuh dari benih sampai berbuah. Milestone selesai jadi buah, sisanya kuncup, dan milestone tampil sebagai jalan setapak dengan menu "Atur".
- Semua logika data (store, goals, app) tetap sama dengan Original.

## Capybara World: Jurnal dan Analitik
- **Buku Harian**: halaman buku bergaris dengan binding, navigasi hari, dan empat bagian bertab warna (☀ ⛈ 💡 🎯). Sisi kanan: pertanyaan harian dari CapyRafi, strip minggu (titik hijau = ada catatan), hari menulis berturut-turut, ringkasan hari, dan relasi goal. Autosave tetap aktif dan pindah hari tidak kehilangan tulisan.
- **Rapor CapyRafi** (Analitik): hero dengan ekspresi CapyRafi sesuai tingkat selesai, kartu statistik dengan perubahan dibanding periode lalu, grafik fokus dengan garis target (batang hijau = target tercapai), peta jam produktif, hari paling fokus, fokus per kategori goal, kebiasaan menulis, dan celoteh insight.

## Capybara World: Riwayat dan Laporan harian
- **Jejak Kaki Fokus** (Riwayat): peta 4 minggu (makin pekat, makin lama fokus selesai), statistik sesi terpanjang dan rata-rata, filter Semua/Selesai/Terputus, serta linimasa per hari dengan simpul, rentang jam, dan batang durasi. "Muat lebih banyak" untuk sesi lama.
- **Album Harian** (Laporan harian): hero hari ini dengan cincin progres terhadap target dan CapyRafi; laporan yang sudah dikunci tampil sebagai foto polaroid per bulan (bintang kalau target tercapai, garis putus-putus kalau data tidak lengkap). Rincian, koreksi setelah laporan, dan alasan data tidak lengkap tetap ada di "Lihat rincian".

## Capybara World: Pengaturan dan Library
- **Pengaturan jadi ruang kontrol bertab**: Tampilan, Ritme fokus, Kartu mini, Musik, dan Data. Pilihan experience berupa dua kartu besar, mode warna berupa segmented control, dan kartu CapyRafi menampilkan level dan aturan XP. Pengaturan timer memakai kolom dua lajur dan saklar untuk opsi hidup/mati.
- **Rak Pengetahuan (Library)**: dokumen tampil sebagai buku dengan punggung berwarna per jenis (file, tautan, catatan), filter jenis, dan pencarian langsung yang tidak lagi merender ulang halaman atau kehilangan fokus saat mengetik.
- **Perbaikan visual dari tinjauan tangkapan layar**: stempel BERES tidak lagi menimpa judul, agenda kalender tidak sempit, kontrol Analitik rapi, tombol di Beranda memakai gaya Capybara, dan kartu tertaut di Goals lebih ringkas.

## 2026-11-11 — Perbaikan audit keamanan (F-03, F-01a, F-02)
- **F-03:** Library tidak lagi menerima `.js`, `.ts`, `.html`, `.css`. File lama bertipe script/HTML/executable yang sudah ada di Library tidak akan dibuka lewat OS; foldernya ditampilkan (`blocked-type`).
- **F-01a:** `autoInstallOnAppQuit = false`. Update hanya terpasang lewat alur resmi (cadangan data dulu, hitung mundur yang bisa dibatalkan, atau "Pasang sekarang").
- **F-02:** Electron 33.2.1 -> 45.3.0; `package-lock.json` disinkronkan (juga versi aplikasi 1.1.0).
- Test baru: `tests/security-fixes.test.js`.
