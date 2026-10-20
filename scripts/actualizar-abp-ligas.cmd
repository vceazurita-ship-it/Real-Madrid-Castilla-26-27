@echo off
setlocal enabledelayedexpansion

rem ===================================================================
rem  EL BALON PARADO DE OTRAS LIGAS  (doble clic; laboratorio de ABP)
rem ===================================================================
rem
rem  Baja los "Team Stats" de Wyscout de las ligas que no son la nuestra
rem  (solo equipos, sin jugadores) y deja public/data/abp-ligas.json, que
rem  es lo que lee /laboratorio/abp/datos:
rem
rem    1. Primera RFEF, Group 1  -> public/data/wys-ligas/primera-rfef-g1
rem    2. Premier League         -> public/data/wys-ligas/premier-league
rem    3. Compacta las tres ligas (el Group 2 sale de public/data/wys, la
rem       carpeta de siempre) en public/data/abp-ligas.json.
rem
rem  Los .xlsx de estas ligas NO se publican (van en .gitignore): solo el
rem  JSON, unos KB. Usa el mismo Chrome y la misma cuenta que
rem  actualizar-wys.cmd. Tarda unos cinco minutos por liga.
rem
rem  Se le puede pasar "g1" o "premier" para bajar solo una:
rem    actualizar-abp-ligas.cmd premier
rem ===================================================================

cd /d "%~dp0.."

set "QUE=%~1"
set "FALLOS=0"

if /I not "%QUE%"=="premier" (
  echo.
  echo  --- Primera RFEF, Group 1 ---
  echo.
  call node scripts\wyscout-liga.mjs --grupo="Group 1" --solo-equipos --carpeta=public/data/wys-ligas/primera-rfef-g1
  if errorlevel 1 if not errorlevel 8 set "FALLOS=1"
)

if /I not "%QUE%"=="g1" (
  echo.
  echo  --- Premier League ---
  echo.
  call node scripts\wyscout-liga.mjs --pais=Inglaterra --competicion="Premier League" --solo-equipos --carpeta=public/data/wys-ligas/premier-league
  if errorlevel 1 if not errorlevel 8 set "FALLOS=1"
)

echo.
echo  --- Compactando las ligas ---
echo.
call node scripts\abp-ligas.cjs

if "%FALLOS%"=="1" (
  echo.
  echo  OJO: alguna liga no ha bajado ^(mira los mensajes de arriba^). El JSON
  echo  lleva lo que haya; lo que no bajo conserva lo de la vez anterior.
  echo.
)

echo.
git status --short public/data/abp-ligas.json

echo.
set "PUBLICA="
set /p "PUBLICA=  Publicar el balon parado de las ligas? (s/N): "

if /I not "%PUBLICA%"=="s" (
  echo.
  echo  Queda sin publicar. Cuando quieras:
  echo     git commit -m "El balon parado de las ligas" -- public/data/abp-ligas.json
  echo     git push
  echo.
  pause
  exit /b 0
)

git add public/data/abp-ligas.json
git diff --cached --quiet -- public/data/abp-ligas.json && (
  echo.
  echo  No habia nada nuevo que publicar.
  echo.
  pause
  exit /b 0
)

git commit -m "El balon parado de las ligas (Wyscout)" -- public/data/abp-ligas.json
if errorlevel 1 (
  echo  EL COMMIT HA FALLADO: no se ha publicado.
  pause
  exit /b 4
)

git push
if errorlevel 1 (
  echo  EL PUSH HA FALLADO: guardado aqui pero NO publicado. Con red, "git push".
  pause
  exit /b 4
)

echo.
echo  Publicado. Vercel tarda un par de minutos en tenerlo arriba.
echo.
pause
