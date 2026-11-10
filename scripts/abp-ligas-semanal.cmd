@echo off
setlocal enabledelayedexpansion

rem ===================================================================
rem  EL BALON PARADO DE OTRAS LIGAS, CADA LUNES  (09/11/2026)
rem ===================================================================
rem
rem  Lo pidio el analista: que «Goles a balon parado de las ligas» se ponga
rem  al dia solo, todos los lunes a las 7:00. Es lo mismo que el doble clic
rem  de actualizar-abp-ligas.cmd pero SIN NADIE DELANTE: no pregunta, no
rem  hace pausas, deja registro y publica solo public/data/abp-ligas.json.
rem
rem    1. Primera RFEF Group 1 y Premier League («Team Stats» de Wyscout,
rem       solo equipos), con scripts\wyscout-liga.mjs --desatendido.
rem    2. Compacta las tres ligas: scripts\abp-ligas.cjs.
rem    3. Publica solo ese JSON (commit + push a main), con las mismas
rem       guardas que la tarea diaria de ABP.
rem
rem  Lo programa scripts\instalar-tarea-abp-ligas.ps1. A mano: doble clic.
rem
rem  EL CODIGO DE SALIDA:
rem    0 publicado     3 nada nuevo     2 la sesion de Wyscout ha caducado
rem    4 fallo al subir   8 alguna liga no bajo (se publica lo que hay)
rem    9 hay commits locales que no son de datos: no se sube nada
rem
rem  El registro queda en .cache\wyscout\abp-ligas\registro\.
rem ===================================================================

cd /d "%~dp0.."

set "REGISTRO=.cache\wyscout\abp-ligas\registro"
if not exist "%REGISTRO%" mkdir "%REGISTRO%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "SELLO=%%i"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "HOY=%%i"

set "LOG=%REGISTRO%\%SELLO%.log"
set "FICHERO=public/data/abp-ligas.json"
set "CODIGO=1"
set "INCOMPLETO=0"
set "CADUCADA=0"

echo ================================================= >> "%LOG%"
echo Balon parado de las ligas · %DATE% %TIME% >> "%LOG%"
echo ================================================= >> "%LOG%"

echo. >> "%LOG%"
echo --- Primera RFEF, Group 1 --- >> "%LOG%"
call node scripts\wyscout-liga.mjs --grupo="Group 1" --solo-equipos --carpeta=public/data/wys-ligas/primera-rfef-g1 --desatendido >> "%LOG%" 2>&1
rem  Cualquier salida distinta de 0 es liga a medias. Antes ponia
rem  "if not errorlevel 8" y se escapaba justo el 8, el de INCOMPLETO.
if errorlevel 1 set "INCOMPLETO=1"
findstr /c:"HA CADUCADO" "%LOG%" >NUL 2>&1 && set "CADUCADA=1"

if "%CADUCADA%"=="0" (
  echo. >> "%LOG%"
  echo --- Premier League --- >> "%LOG%"
  call node scripts\wyscout-liga.mjs --pais=Inglaterra --competicion="Premier League" --solo-equipos --carpeta=public/data/wys-ligas/premier-league --desatendido >> "%LOG%" 2>&1
  if errorlevel 1 set "INCOMPLETO=1"
  findstr /c:"HA CADUCADO" "%LOG%" >NUL 2>&1 && set "CADUCADA=1"
)

if "%CADUCADA%"=="1" (
  echo   RESUMEN: la sesion de Wyscout ha caducado; no se ha bajado nada. >> "%LOG%"
  set "CODIGO=2"
  goto :limpieza
)

echo. >> "%LOG%"
echo --- Compactando las ligas --- >> "%LOG%"
call node scripts\abp-ligas.cjs >> "%LOG%" 2>&1

rem ------------------------------------------------------------------
rem  Publicar SOLO el JSON (mismas guardas que abp-acciones-diario.cmd)
rem ------------------------------------------------------------------

echo. >> "%LOG%"
echo --- Publicando --- >> "%LOG%"

set "AJENOS=0"
for /f %%n in ('git log "@{u}..HEAD" "--format=%%s" 2^>NUL ^| findstr /v /b /c:"Los datos de Wyscout" ^| findstr /v /c:"lisis del partido: " ^| findstr /v /b /c:"ABP de cada jornada" ^| findstr /v /b /c:"El balon parado de las ligas" ^| find /c /v ""') do set "AJENOS=%%n"

if not "%AJENOS%"=="0" (
  echo HAY COMMITS SIN SUBIR QUE NO SON DE DATOS: no se publica. Un "git push" a mano cuando se haya mirado. >> "%LOG%"
  echo   RESUMEN: hay commits locales que no son de datos; no se publica. >> "%LOG%"
  set "CODIGO=9"
  goto :limpieza
)

git add "%FICHERO%" >> "%LOG%" 2>&1

set "HAYCAMBIOS=0"
git diff --cached --quiet -- "%FICHERO%" || set "HAYCAMBIOS=1"

if "%HAYCAMBIOS%"=="1" (
  git commit -m "El balon parado de las ligas (Wyscout, %HOY%)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "%FICHERO%" >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo   RESUMEN: el commit ha fallado; no se publica. >> "%LOG%"
    set "CODIGO=4"
    goto :limpieza
  )
)

set "PENDIENTES=0"
for /f %%n in ('git rev-list --count "@{u}..HEAD" 2^>NUL') do set "PENDIENTES=%%n"

if "%PENDIENTES%"=="0" (
  echo   RESUMEN: no habia nada nuevo que publicar. >> "%LOG%"
  set "CODIGO=3"
  if "%INCOMPLETO%"=="1" set "CODIGO=8"
  goto :limpieza
)

git pull --rebase --autostash >> "%LOG%" 2>&1
git push >> "%LOG%" 2>&1

if errorlevel 1 (
  echo   RESUMEN: el commit esta hecho pero el push ha fallado; queda sin publicar. >> "%LOG%"
  set "CODIGO=4"
  goto :limpieza
)

echo   RESUMEN: balon parado de las ligas publicado (%HOY%). >> "%LOG%"
set "CODIGO=0"
if "%INCOMPLETO%"=="1" set "CODIGO=8"

:limpieza

findstr /b /c:"  RESUMEN:" "%LOG%" 2>NUL

powershell -NoProfile -Command ^
  "Get-ChildItem '%REGISTRO%\*.log' | Sort-Object Name -Descending | Select-Object -Skip 20 | Remove-Item -Force -ErrorAction SilentlyContinue"

endlocal & exit /b %CODIGO%
