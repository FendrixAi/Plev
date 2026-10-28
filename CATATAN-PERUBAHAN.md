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
