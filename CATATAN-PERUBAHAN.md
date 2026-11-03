# Catatan perubahan

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
