@echo off
setlocal

rem ===================================================================
rem  YOUTUBE - INICIAR SESION  (04/11/2026)
rem ===================================================================
rem
rem  Abre un Chrome APARTE (su propio perfil en .cache\chrome-youtube, fuera
rem  de git) en youtube.com para que el analista entre UNA vez con su
rem  cuenta. Con esa sesion, scripts\abp-videos-youtube.mjs lee de noche los
rem  subtitulos automaticos de los resumenes y "Ver el video" salta al
rem  segundo de cada accion a balon parado.
rem
rem  Que hacer: entrar con la cuenta (boton "Acceder" arriba a la derecha),
rem  comprobar que sale la foto de la cuenta y CERRAR la ventana. Mientras
rem  esta ventana esta abierta, la pasada de la noche no puede leer nada.
rem
rem  Ningun script mete aqui contrasenas ni resuelve comprobaciones: si
rem  YouTube pide demostrar que no es un robot, se hace a mano en esta
rem  ventana. Si en Ajustes sale "La sesion de YouTube ha caducado", otra vez
rem  doble clic aqui (o en el acceso directo del escritorio).
rem
rem  La primera vez deja en el escritorio el acceso directo
rem  "YouTube - iniciar sesion".
rem ===================================================================

cd /d "%~dp0.."

set "PERFIL=%CD%\.cache\chrome-youtube"
if not exist "%PERFIL%" mkdir "%PERFIL%"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo No encuentro Chrome en este ordenador.
  pause
  exit /b 1
)

rem  El acceso directo del escritorio, si aun no esta.
powershell -NoProfile -Command "$e=[Environment]::GetFolderPath('Desktop'); $l=Join-Path $e ('YouTube ' + [char]0xB7 + ' iniciar sesi' + [char]0xF3 + 'n.lnk'); if (-not (Test-Path $l)) { $s=(New-Object -ComObject WScript.Shell).CreateShortcut($l); $s.TargetPath='%~f0'; $s.WorkingDirectory='%CD%'; $s.IconLocation='%CHROME%,0'; $s.Description='Entrar en YouTube para los videos de ABP'; $s.Save() }"

start "" "%CHROME%" --user-data-dir="%PERFIL%" --no-first-run --no-default-browser-check "https://www.youtube.com/"

echo Se ha abierto YouTube en un Chrome aparte. Entra con tu cuenta y cierra la ventana.
endlocal
