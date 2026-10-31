@echo off
setlocal

rem ===================================================================
rem  CORREO DE LAS 7:00 CON LAS TAREAS SIN HACER  (31/10/2026)
rem ===================================================================
rem
rem  Lo lanza cada manana la tarea "RMCF Castilla - Tareas pendientes"
rem  (scripts\instalar-tarea-tareas-pendientes.cmd). A mano, doble clic.
rem
rem  Mira "Mis tareas" y, si queda algo sin hacer de dias anteriores, manda
rem  el correo desde la cuenta del club (scripts\aviso-correo.mjs). Solo lee:
rem  no escribe nada en Supabase ni en la hoja. Un sello por dia evita que
rem  salga dos veces.
rem
rem  Con "--seco" imprime el correo sin mandarlo.
rem  El registro queda en .cache\tareas-pendientes\registro\.
rem ===================================================================

cd /d "%~dp0.."

set "REGISTRO=.cache\tareas-pendientes\registro"
if not exist "%REGISTRO%" mkdir "%REGISTRO%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "SELLO=%%i"

set "LOG=%REGISTRO%\%SELLO%.log"

echo ================================================= >> "%LOG%"
echo Tareas pendientes · %DATE% %TIME% >> "%LOG%"
echo ================================================= >> "%LOG%"

call node scripts\tareas-pendientes-correo.mjs %* >> "%LOG%" 2>&1
set "CODIGO=%errorlevel%"

findstr /b /c:"  RESUMEN:" "%LOG%" 2>NUL

powershell -NoProfile -Command ^
  "Get-ChildItem '%REGISTRO%\*.log' | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue"

endlocal & exit /b %CODIGO%
