@echo off
cd /d "%~dp0"
echo Membuat installer Jam Fokus...
call npm install
call npm run build:installer
echo.
echo Selesai. Installer ada di folder dist: "Jam Fokus Setup x.y.z.exe"
echo Jalankan file itu untuk memasang, lalu pin dari Start Menu.
pause
