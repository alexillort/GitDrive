@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22 o posterior y vuelve a abrir este archivo.
  pause
  exit /b 1
)
where git >nul 2>nul
if errorlevel 1 (
  echo Instala Git for Windows y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist dist\index.html (
  call npm.cmd install
  if errorlevel 1 exit /b 1
  call npm.cmd run build
  if errorlevel 1 exit /b 1
)
echo Abre http://127.0.0.1:4317 en tu navegador.
call npm.cmd start
pause
