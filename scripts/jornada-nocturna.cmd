@echo off
setlocal

rem ===================================================================
rem  ACTUALIZACION NOCTURNA DE LA JORNADA
rem ===================================================================
rem
rem  Baja de BeSoccer lo que cambia con una jornada y lo sube a Supabase:
rem  resultados, goleadores con su asistente, alineaciones con cambios y
rem  tarjetas, clasificacion, las fichas de los jugadores rivales y las de
rem  los nuestros.
rem
rem  Corre en ESTE ordenador y no en GitHub a proposito: BeSoccer bloquea
rem  las IP de centro de datos y al runner le contesta 406 con cero bytes,
rem  comprobado el 01/09/2026. Desde una conexion normal funciona.
rem
rem  Lo programa `scripts/instalar-tarea-nocturna.ps1`. Tambien se puede
rem  ejecutar a mano con doble clic cuando se acaba de jugar.
rem
rem  Deja el registro en `.cache/jornada-nocturna/`, un fichero por noche.
rem ===================================================================

rem La raiz del proyecto es la carpeta de arriba, venga de donde venga la
rem llamada: el Programador de tareas arranca en System32 si no se le dice.
cd /d "%~dp0.."

set "REGISTRO=.cache\jornada-nocturna"
if not exist "%REGISTRO%" mkdir "%REGISTRO%"

rem Fecha en formato ordenable, independiente de la configuracion regional.
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "SELLO=%%i"

set "LOG=%REGISTRO%\%SELLO%.log"

echo ================================================= >> "%LOG%"
echo Jornada nocturna · %DATE% %TIME% >> "%LOG%"
echo ================================================= >> "%LOG%"

rem --- 1. resultados, goleadores y alineaciones de los rivales ---
echo. >> "%LOG%"
echo --- Informe de rivales --- >> "%LOG%"
call node scripts\rivals-informe.mjs --refrescar >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FALLO en rivals-informe ^(codigo %errorlevel%^) >> "%LOG%"
  set "HUBO_FALLO=1"
)

rem --- 2. estadisticas de los jugadores rivales ---
echo. >> "%LOG%"
echo --- Estadisticas de rivales --- >> "%LOG%"
call node scripts\rivals-stats.mjs --refrescar >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FALLO en rivals-stats ^(codigo %errorlevel%^) >> "%LOG%"
  set "HUBO_FALLO=1"
)

rem --- 3. nuestra plantilla contra BeSoccer ---
echo. >> "%LOG%"
echo --- Nuestra plantilla --- >> "%LOG%"
call node scripts\castilla-besoccer.mjs --refrescar >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FALLO en castilla-besoccer ^(codigo %errorlevel%^) >> "%LOG%"
  set "HUBO_FALLO=1"
)

echo. >> "%LOG%"
if defined HUBO_FALLO (
  echo TERMINADO CON FALLOS · %DATE% %TIME% >> "%LOG%"
) else (
  echo Terminado sin incidencias · %DATE% %TIME% >> "%LOG%"
)

rem Se guardan los treinta ultimos registros: uno por noche es un mes.
powershell -NoProfile -Command ^
  "Get-ChildItem '%REGISTRO%\*.log' | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue"

endlocal
