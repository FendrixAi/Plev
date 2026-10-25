@echo off
echo ===== CEK FOLDER JAM FOKUS =====
echo Folder saat ini: %cd%
echo.
if exist renderer\pages\tugas.js (echo [OK] renderer\pages\tugas.js ada) else (echo [X] renderer\pages\tugas.js TIDAK ADA, ini bukan folder Plev)
findstr /C:"addBtn.type" renderer\pages\tugas.js >nul 2>&1 && echo [OK] tugas.js sudah versi perbaikan || echo [X] tugas.js BELUM versi perbaikan
findstr /C:"ta-debug" renderer\pages\tugas.js >nul 2>&1 && echo [OK] tugas.js versi diagnosa || echo [-] tugas.js bukan versi diagnosa
echo.
node -v
node --check main.js && echo [OK] main.js sintaks valid || echo [X] main.js ERROR sintaks
echo.
echo Isi folder:
dir /b
echo.
echo ===== SELESAI. Salin semua tulisan di atas ke chat =====
pause
