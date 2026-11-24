@echo off
rem DIRECTO DE OPTA DEL PRIMER EQUIPO (24/11/2026).
rem Uso: scripts\opta-directo-rm.cmd "UEFA Champions League" [minutos]
rem Sigue cada minuto el partido de hoy del Real Madrid en esa competicion con el
rem Chrome de Opta del club y lo deja en opta:rm (no en el archivo de Primera RFEF).
cd /d "%~dp0.."
set "LIGA=%~1"
if "%LIGA%"=="" set "LIGA=Primera Division"
set "DURACION_MIN=%~2"
if "%DURACION_MIN%"=="" set "DURACION_MIN=165"
set "EQUIPO=Real Madrid"
set "CLAVE=opta:rm"
set "INTERVALO_S=60"
if not exist ".cache\opta-directo-vigia" mkdir ".cache\opta-directo-vigia"
node --env-file=.env.local scripts\opta-directo.mjs --chrome >> ".cache\opta-directo-vigia\rm-%date:~-4%%date:~3,2%%date:~0,2%.log" 2>&1
