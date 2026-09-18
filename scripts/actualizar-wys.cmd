@echo off
setlocal enabledelayedexpansion

rem ===================================================================
rem  ACTUALIZAR LOS DATOS DE WYSCOUT  (doble clic, una vez por semana)
rem ===================================================================
rem
rem  Hace de una sentada las tres cosas que antes se hacian a mano:
rem
rem    1. Baja el informe de los veinte equipos del grupo, con MOSTRAR = ALL.
rem    2. Baja los jugadores de la categoria desde "Advanced Search", por
rem       lotes de equipos (Wyscout corta cada exportacion en 500 filas).
rem    3. Relee la carpeta y deja el indice en public/data/analisis.json,
rem       que es de donde come la pantalla de DATA una vez desplegada.
rem
rem  Y al final pregunta si se publica. Publicar es "git push": Vercel se
rem  encarga del resto y en un par de minutos la plataforma tiene la jornada.
rem
rem  LA PRIMERA VEZ se abre una ventana de Chrome con la pantalla de Hudl y
rem  se para a esperar a que entres TU. La contrasena la escribes en esa
rem  ventana: este proceso no la pide, no la ve y no la guarda. La sesion
rem  queda en un perfil aparte (%LOCALAPPDATA%\rmcf-wyscout) y las semanas
rem  siguientes arranca ya dentro. El dia que caduque, se vuelve a parar.
rem
rem  Tarda entre cinco y diez minutos. La ventana de Chrome se mueve sola:
rem  no la toques mientras trabaja.
rem
rem  Se le pueden pasar los mismos argumentos que al script:
rem    --solo-jugadores   solo el buscador de jugadores
rem    --sin-jugadores    solo los equipos
rem    --equipo=a,b       nada mas esos
rem    --desde=Huesca     retomar donde se quedo
rem    --lote=5           menos equipos por exportacion de jugadores
rem    --ver              deja Chrome abierto al terminar
rem ===================================================================

rem La raiz es la carpeta de arriba, venga de donde venga la llamada.
cd /d "%~dp0.."

echo.
echo  ===============================================
echo   DATOS DE WYSCOUT DE TODA LA CATEGORIA
echo  ===============================================
echo.

call node scripts\wyscout-liga.mjs %*

if errorlevel 1 (
  echo.
  echo  La descarga ha fallado. No se toca el indice ni se publica nada.
  echo.
  pause
  exit /b 1
)

rem ------------------------------------------------------------------
rem  El indice
rem ------------------------------------------------------------------
rem  public/ lo sirve el CDN pero la funcion de Vercel no tiene esa carpeta
rem  en su disco: sin este fichero la pantalla de DATA sale vacia una vez
rem  desplegada. En local no hace falta, pero cuesta dos segundos.

echo.
echo  --- Releyendo la carpeta ---
echo.

call node scripts\data-analisis-indice.cjs

if errorlevel 1 (
  echo.
  echo  No se ha podido releer la carpeta. Los .xlsx estan bajados, pero
  echo  el indice se ha quedado como estaba: miralo antes de publicar.
  echo.
  pause
  exit /b 1
)

rem ------------------------------------------------------------------
rem  La foto de la jornada
rem ------------------------------------------------------------------
rem
rem  La descarga individual de Wyscout es acumulada: una fila por jugador con
rem  la temporada entera. Guardando una foto cada semana, la resta entre dos
rem  fotos es lo que paso en medio -la jornada-, que es lo que esa descarga
rem  no da. La resta la hace sola la pantalla del once.
rem
rem  Si falla no se para nada: bajar los datos es lo importante, y la foto se
rem  puede tomar otro dia a mano.

echo.
echo  --- Guardando la foto de la jornada ---
echo.

call node scripts\wyscout-instantanea.cjs

if errorlevel 1 (
  echo.
  echo  No se ha podido guardar la foto. Los datos siguen bien; tomala cuando
  echo  puedas con:  node scripts\wyscout-instantanea.cjs
  echo.
)

rem ------------------------------------------------------------------
rem  Publicar
rem ------------------------------------------------------------------
rem  Se pregunta a proposito. Bajar datos no rompe nada; publicarlos cambia
rem  lo que ve todo el cuerpo tecnico, y eso lo decide una persona.

echo.
git status --short public/data/wys public/data/analisis.json

echo.
set "PUBLICA="
set /p "PUBLICA=  Publicar esto en la plataforma? (s/N): "

if /I not "%PUBLICA%"=="s" (
  echo.
  echo  Queda bajado sin publicar. Cuando quieras:
  echo     git add public/data/wys public/data/analisis.json
  echo     git commit -m "Los datos de Wyscout de la jornada"
  echo     git push
  echo.
  pause
  exit /b 0
)

git add public/data/wys public/data/analisis.json

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format dd/MM/yyyy"') do set "HOY=%%i"

git commit -m "Los datos de Wyscout al %HOY%"

if errorlevel 1 (
  echo.
  echo  No habia nada que publicar: los datos ya estaban al dia.
  echo.
  pause
  exit /b 0
)

git push

echo.
echo  Publicado. Vercel tarda un par de minutos en tenerlo arriba.
echo.
pause
