@echo off
setlocal enabledelayedexpansion

rem ===================================================================
rem  CLIPS AL DIA (26/11/2026)
rem ===================================================================
rem
rem  El analista: «que la preparacion de estos videos se haga la noche tras
rem  el partido jugado, nuestro o del rival, y si no por la manana a las 6:00».
rem
rem  1. Los clips de los nuestros del ultimo partido del Castilla en Opta
rem     (scripts/opta-clips-castilla.mjs): si ya estan, no hace nada; si
rem     Opta aun no tiene el evento a evento, se vuelve a mirar en la
rem     siguiente pasada.
rem  2. El video de cada jugador del proximo rival (scripts/opta-clips-jugador.mjs):
rem     sus ultimos partidos se preguntan a Opta, y solo se rehace el de quien
rem     tiene cortes nuevos (el rival ha jugado) o si cambia el rival.
rem
rem  Lo llama la jornada nocturna (paso 12, a las 00:00) y la tarea de las
rem  6:00 (scripts/instalar-tarea-clips.ps1). Necesita el Chrome de Opta del
rem  club con su sesion (puerto 9335): sin el, codigo 8 y sigue en la
rem  siguiente pasada. Lo nuevo se ve en la app sin publicar nada.
rem
rem  Registro en .cache/clips-al-dia/, un fichero por pasada.
rem ===================================================================

cd /d "%~dp0.."
set "REGISTRO=.cache\clips-al-dia"
if not exist "%REGISTRO%" mkdir "%REGISTRO%"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "SELLO=%%i"
set "LOG=%REGISTRO%\%SELLO%.log"

echo --- Clips de los nuestros (Opta) · %DATE% %TIME% --- >> "%LOG%"
call node scripts\opta-clips-castilla.mjs >> "%LOG%" 2>&1
if errorlevel 1 echo AVISO: los clips de los nuestros no han terminado ^(codigo !errorlevel!^); sigue en la siguiente pasada >> "%LOG%"

echo. >> "%LOG%"
echo --- Video de los jugadores del proximo rival (Opta) · %DATE% %TIME% --- >> "%LOG%"
call node scripts\opta-clips-jugador.mjs >> "%LOG%" 2>&1
if errorlevel 1 echo AVISO: el video de los jugadores rivales no ha terminado ^(codigo !errorlevel!^); sigue en la siguiente pasada >> "%LOG%"

echo TERMINADO · %DATE% %TIME% >> "%LOG%"

rem Los registros de mas de 30 dias, fuera.
forfiles /p "%REGISTRO%" /m *.log /d -30 /c "cmd /c del @path" >nul 2>&1
exit /b 0
