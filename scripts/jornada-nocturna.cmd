@echo off
setlocal enabledelayedexpansion

rem ===================================================================
rem  ACTUALIZACION DIARIA DE LA JORNADA
rem ===================================================================
rem
rem  Baja de BeSoccer lo que cambia con una jornada y lo sube a Supabase:
rem  resultados, goleadores con su asistente, alineaciones con cambios y
rem  tarjetas, clasificacion, las fichas de los jugadores rivales y las de
rem  los nuestros. De ahi comen las plantillas rivales, los informes y las
rem  fichas individuales y colectivas.
rem
rem  Ademas repasa las plantillas rivales: quien ha llegado, quien se ha ido
rem  y que dorsales han cambiado (eso solo se informa, no se toca la hoja) y
rem  rellena las caras que falten, que esas si se pueden poner solas.
rem
rem  Corre en ESTE ordenador y no en GitHub a proposito: BeSoccer bloquea
rem  las IP de centro de datos y al runner le contesta 406 con cero bytes,
rem  comprobado el 01/09/2026. Desde una conexion normal funciona.
rem
rem  Lo programa `scripts/instalar-tarea-nocturna.ps1`: a las 00:00 y, si esa
rem  no sale, cada dos horas durante el dia hasta que una salga bien. Tambien
rem  se puede ejecutar a mano con doble clic cuando se acaba de jugar.
rem
rem  Deja el registro en `.cache/jornada-nocturna/`, un fichero por pasada.
rem ===================================================================

rem La raiz del proyecto es la carpeta de arriba, venga de donde venga la
rem llamada: el Programador de tareas arranca en System32 si no se le dice.
cd /d "%~dp0.."

set "REGISTRO=.cache\jornada-nocturna"
if not exist "%REGISTRO%" mkdir "%REGISTRO%"

rem Fechas en formato ordenable, independientes de la configuracion regional.
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "SELLO=%%i"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "HOY=%%i"

set "LOG=%REGISTRO%\%SELLO%.log"
set "HECHO=%REGISTRO%\hecho-%HOY%.txt"

rem ------------------------------------------------------------------
rem  ¿Ya se hizo hoy?
rem ------------------------------------------------------------------
rem  La tarea se repite durante el dia para recuperar una noche perdida, asi
rem  que lo primero es no repetir el trabajo. Con "--forzar" se hace igual:
rem  es lo que se quiere despues de un partido de la tarde.

if /I "%~1"=="--forzar" goto :adelante

if exist "%HECHO%" (
  echo Ya se actualizo hoy ^(%HOY%^). Nada que hacer.
  echo Ya se actualizo hoy ^(%HOY%^) · %DATE% %TIME% >> "%LOG%"
  goto :limpieza
)

:adelante

echo ================================================= >> "%LOG%"
echo Jornada del dia · %DATE% %TIME% >> "%LOG%"
echo ================================================= >> "%LOG%"

rem ------------------------------------------------------------------
rem  ¿Hay red de verdad?
rem ------------------------------------------------------------------
rem  En la wifi del club hay un portal cautivo que se mete en medio de las
rem  conexiones seguras: el 05/09/2026 el registro acabo con paginas y paginas
rem  de certificado y un "Host: script.google.com no esta en los altnames del
rem  certificado: DNS:wlc.realmadrid.es". Con eso no se puede bajar nada, y
rem  descubrirlo despues de cuarenta minutos de intentos no ayuda a nadie.
rem
rem  Se comprueban los dos sitios de los que se come antes de empezar. Si no
rem  se puede, se dice en una linea y **no se marca el dia como hecho**: la
rem  repeticion de dentro de dos horas lo volvera a intentar, que para
rem  entonces el portatil suele estar en otra red.

echo. >> "%LOG%"
echo --- Comprobando la red --- >> "%LOG%"

set "UA=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

for /f %%c in ('curl -s -o NUL -w "%%{http_code}" --max-time 20 -H "User-Agent: %UA%" -H "Accept: text/html,application/xhtml+xml" -H "Accept-Language: es-ES,es;q=0.9" https://es.besoccer.com/equipo/plantilla/rm-castilla 2^>NUL') do set "CODIGO_BESOCCER=%%c"

set "SALIDA_CURL=%errorlevel%"

if "%SALIDA_CURL%"=="60" (
  echo LA RED NO DEJA PASAR: hay algo interceptando las conexiones seguras >> "%LOG%"
  echo   ^(en la wifi del club es el portal cautivo, wlc.realmadrid.es^). >> "%LOG%"
  echo   Se reintenta en la siguiente pasada. >> "%LOG%"
  echo LA RED NO DEJA PASAR: certificado interceptado. Se reintentara.
  goto :limpieza
)

if not "%CODIGO_BESOCCER%"=="200" (
  echo BESOCCER NO CONTESTA BIEN ^(HTTP %CODIGO_BESOCCER%^). Se reintenta en la siguiente pasada. >> "%LOG%"
  echo BESOCCER NO CONTESTA BIEN ^(HTTP %CODIGO_BESOCCER%^). Se reintentara.
  goto :limpieza
)

curl -s -o NUL --max-time 20 https://script.google.com/ 2>NUL

if errorlevel 60 (
  echo NO SE LLEGA A LA HOJA ^(script.google.com^): conexion interceptada. >> "%LOG%"
  echo   Se reintenta en la siguiente pasada. >> "%LOG%"
  echo NO SE LLEGA A LA HOJA: conexion interceptada. Se reintentara.
  goto :limpieza
)

echo Red correcta: BeSoccer responde 200 y la hoja es alcanzable. >> "%LOG%"

rem --- 1. resultados, goleadores y alineaciones de los rivales ---
echo. >> "%LOG%"
echo --- Informe de rivales --- >> "%LOG%"
call node scripts\rivals-informe.mjs --refrescar >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FALLO en rivals-informe ^(codigo !errorlevel!^) >> "%LOG%"
  set "HUBO_FALLO=1"
)

rem --- 2. estadisticas de los jugadores rivales ---
echo. >> "%LOG%"
echo --- Estadisticas de rivales --- >> "%LOG%"
call node scripts\rivals-stats.mjs --refrescar >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FALLO en rivals-stats ^(codigo !errorlevel!^) >> "%LOG%"
  set "HUBO_FALLO=1"
)

rem --- 3. nuestra plantilla contra BeSoccer ---
echo. >> "%LOG%"
echo --- Nuestra plantilla --- >> "%LOG%"
call node scripts\castilla-besoccer.mjs --refrescar >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FALLO en castilla-besoccer ^(codigo !errorlevel!^) >> "%LOG%"
  set "HUBO_FALLO=1"
)

rem --- 4. las plantillas rivales: altas, bajas y dorsales ---
rem
rem  Los dos SOLO INFORMAN. Escribir las altas y las bajas en la hoja sin que
rem  nadie lo mire no puede hacerse todas las noches: una baja mal emparejada
rem  tacha a un jugador que sigue en el equipo, y BeSoccer publica la plantilla
rem  a medias durante el mercado. El informe sale aqui cada noche y quien lo
rem  lee decide; para escribirlo esta "rivals-altas-bajas.mjs".
echo. >> "%LOG%"
echo --- Altas y bajas de las plantillas rivales --- >> "%LOG%"
call node scripts\rivals-cotejo.mjs --refrescar >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FALLO en rivals-cotejo ^(codigo !errorlevel!^) >> "%LOG%"
  set "HUBO_FALLO=1"
)

echo. >> "%LOG%"
echo --- Dorsales de las plantillas rivales --- >> "%LOG%"
call node scripts\rivals-dorsales.mjs >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FALLO en rivals-dorsales ^(codigo !errorlevel!^) >> "%LOG%"
  set "HUBO_FALLO=1"
)

rem --- 5. las caras que falten ---
rem
rem  Esta SI escribe, y puede: solo rellena la columna FOTO donde esta vacia,
rem  nunca cambia una que ya hay. Una ficha sin cara se lee peor en la pizarra
rem  y deja la portada del analisis individual con la silueta.
echo. >> "%LOG%"
echo --- Fotos que faltan --- >> "%LOG%"
call node scripts\rivals-fotos.mjs --todos --escribir >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FALLO en rivals-fotos ^(codigo !errorlevel!^) >> "%LOG%"
  set "HUBO_FALLO=1"
)

echo. >> "%LOG%"
if defined HUBO_FALLO (
  echo TERMINADO CON FALLOS · %DATE% %TIME% >> "%LOG%"
  echo Terminado con fallos. Se reintentara en la siguiente pasada.
) else (
  echo Terminado sin incidencias · %DATE% %TIME% >> "%LOG%"
  echo Terminado sin incidencias.

  rem El dia queda marcado: las repeticiones de hoy ya no haran nada.
  echo %DATE% %TIME% > "%HECHO%"
)

:limpieza

rem Se guardan los treinta ultimos registros y las marcas de la ultima semana.
powershell -NoProfile -Command ^
  "Get-ChildItem '%REGISTRO%\*.log' | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue; Get-ChildItem '%REGISTRO%\hecho-*.txt' | Sort-Object Name -Descending | Select-Object -Skip 7 | Remove-Item -Force -ErrorAction SilentlyContinue"

endlocal
