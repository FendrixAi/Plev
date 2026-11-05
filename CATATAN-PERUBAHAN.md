# Catatan perubahan

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
