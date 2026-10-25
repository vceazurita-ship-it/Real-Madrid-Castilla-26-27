@echo off
setlocal enabledelayedexpansion

rem ===================================================================
rem  LO MEJOR A BALON PARADO DE CADA JORNADA, CADA MANANA  (25/10/2026)
rem ===================================================================
rem
rem  Lo lanza cada dia la tarea "RMCF Castilla - ABP de cada jornada"
rem  (scripts\instalar-tarea-abp-acciones.ps1). A mano, doble clic.
rem
rem    1. Baja de Wyscout los partidos nuevos de Primera RFEF (los dos
rem       grupos), Segunda, Premier y Champions: scripts\wyscout-abp-acciones.mjs
rem       (mismo Chrome, perfil y cuenta que la descarga de los martes).
rem    2. Compacta: scripts\abp-acciones.cjs -> public/data/abp-acciones.json
rem    3. Publica SOLO ese fichero (commit + push a main).
rem
rem  EL CODIGO DE SALIDA (como wyscout-semanal.cmd):
rem    0 publicado        3 nada nuevo           2 la sesion ha caducado
rem    1 fallo al bajar   4 fallo al subir       7 Chrome ocupado o colgado
rem    8 incompleto: se publica lo que bajo y el dia NO queda hecho
rem    9 hay commits locales que no son de datos: no se sube nada
rem
rem  Con "--forzar" se hace aunque hoy ya este hecho.
rem  El registro queda en .cache\wyscout\abp-acciones\registro\.
rem ===================================================================

cd /d "%~dp0.."

set "REGISTRO=.cache\wyscout\abp-acciones\registro"
if not exist "%REGISTRO%" mkdir "%REGISTRO%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "SELLO=%%i"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "HOY=%%i"

set "LOG=%REGISTRO%\%SELLO%.log"
set "HECHO=%REGISTRO%\hecho-%HOY%.txt"
set "FICHERO=public/data/abp-acciones.json"
set "CODIGO=1"
set "INCOMPLETO=0"

if /I "%~1"=="--forzar" goto :adelante

if exist "%HECHO%" (
  echo Ya se hizo hoy ^(%HOY%^). Nada que hacer.
  set "CODIGO=3"
  goto :limpieza
)

:adelante

echo ================================================= >> "%LOG%"
echo ABP de cada jornada · %DATE% %TIME% >> "%LOG%"
echo ================================================= >> "%LOG%"

rem ------------------------------------------------------------------
rem  1. Bajar lo nuevo
rem ------------------------------------------------------------------

call node scripts\wyscout-abp-acciones.mjs --desatendido >> "%LOG%" 2>&1
set "SALIDA=%errorlevel%"

if "%SALIDA%"=="2" (
  echo LA SESION DE WYSCOUT HA CADUCADO y la cuenta guardada no entra. >> "%LOG%"
  echo   Guarda otra vez la cuenta con doble clic en scripts\guardar-clave-wys.cmd. >> "%LOG%"
  echo LA SESION DE WYSCOUT HA CADUCADO. Guarda la cuenta con scripts\guardar-clave-wys.cmd.
  set "CODIGO=2"
  goto :limpieza
)

if "%SALIDA%"=="7" (
  echo CHROME OCUPADO O COLGADO: no se ha bajado nada. Se reintenta. >> "%LOG%"
  set "CODIGO=7"
  goto :limpieza
)

if "%SALIDA%"=="8" (
  echo INCOMPLETO: algun partido o competicion no bajo. Se publica lo que hay. >> "%LOG%"
  set "INCOMPLETO=1"
  set "SALIDA=0"
)

rem  3 = nada nuevo en Wyscout: se compacta igual (no cuesta nada) y se mira si hay algo que subir.
if "%SALIDA%"=="3" set "SALIDA=0"

if not "%SALIDA%"=="0" (
  echo FALLO en la descarga ^(codigo %SALIDA%^). Se reintenta en la siguiente pasada. >> "%LOG%"
  set "CODIGO=1"
  goto :limpieza
)

rem ------------------------------------------------------------------
rem  2. Compactar
rem ------------------------------------------------------------------

echo. >> "%LOG%"
call node scripts\abp-acciones.cjs >> "%LOG%" 2>&1

rem ------------------------------------------------------------------
rem  3. Publicar SOLO el JSON
rem ------------------------------------------------------------------
rem  Nunca codigo ni otros datos: el commit lleva la ruta detras, asi que
rem  aunque hubiera otra cosa preparada con "git add", aqui solo entra esto.

echo. >> "%LOG%"
echo --- Publicando --- >> "%LOG%"

rem  Si hay commits locales sin subir que no son de datos, no se sube nada:
rem  publicar el trabajo de otro no lo decide esta tarea.
set "AJENOS=0"
for /f %%n in ('git log "@{u}..HEAD" "--format=%%s" 2^>NUL ^| findstr /v /b /c:"Los datos de Wyscout" ^| findstr /v /c:"lisis del partido: " ^| findstr /v /b /c:"ABP de cada jornada" ^| find /c /v ""') do set "AJENOS=%%n"

if not "%AJENOS%"=="0" (
  echo HAY COMMITS SIN SUBIR QUE NO SON DE DATOS: no se publica. Un "git push" a mano cuando se haya mirado. >> "%LOG%"
  echo Hay commits locales que no son de datos: no se publica.
  set "CODIGO=9"
  goto :limpieza
)

git add "%FICHERO%" >> "%LOG%" 2>&1

set "HAYCAMBIOS=0"
git diff --cached --quiet -- "%FICHERO%" || set "HAYCAMBIOS=1"

if "%HAYCAMBIOS%"=="1" (
  git commit -m "ABP de cada jornada: lo mejor a balon parado (Wyscout, %HOY%)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "%FICHERO%" >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo EL COMMIT HA FALLADO: no se publica. >> "%LOG%"
    set "CODIGO=4"
    goto :limpieza
  )
)

set "PENDIENTES=0"
for /f %%n in ('git rev-list --count "@{u}..HEAD" 2^>NUL') do set "PENDIENTES=%%n"

if "%PENDIENTES%"=="0" (
  echo No habia nada nuevo que publicar. >> "%LOG%"
  echo No habia nada nuevo que publicar.
  if "%INCOMPLETO%"=="0" echo %DATE% %TIME% · sin cambios > "%HECHO%"
  set "CODIGO=3"
  if "%INCOMPLETO%"=="1" set "CODIGO=8"
  goto :limpieza
)

rem  Si main ha avanzado en GitHub, se trae antes (solo datos nuestros encima).
git pull --rebase --autostash >> "%LOG%" 2>&1
git push >> "%LOG%" 2>&1

if errorlevel 1 (
  echo EL COMMIT ESTA HECHO PERO EL PUSH HA FALLADO: queda sin publicar. Con red, "git push". >> "%LOG%"
  echo El push ha fallado: queda en local, sin publicar.
  set "CODIGO=4"
  goto :limpieza
)

echo Publicado · %DATE% %TIME% >> "%LOG%"
echo Publicado. Vercel tarda un par de minutos.

set "CODIGO=0"
if "%INCOMPLETO%"=="1" (
  set "CODIGO=8"
) else (
  echo %DATE% %TIME% > "%HECHO%"
)

:limpieza

findstr /b /c:"  RESUMEN:" "%LOG%" 2>NUL

powershell -NoProfile -Command ^
  "Get-ChildItem '%REGISTRO%\*.log' | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue; Get-ChildItem '%REGISTRO%\hecho-*.txt' | Sort-Object Name -Descending | Select-Object -Skip 10 | Remove-Item -Force -ErrorAction SilentlyContinue"

endlocal & exit /b %CODIGO%
