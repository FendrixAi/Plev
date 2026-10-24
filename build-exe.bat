@echo off
cd /d "%~dp0"
call npm install
call npm run build
echo.
echo Selesai. File .exe ada di folder dist
pause
