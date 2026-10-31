@echo off
rem  Da de alta (una vez) la tarea de Windows "RMCF Castilla - Tareas pendientes":
rem  el correo de las 07:00 con lo que quedo sin hacer en "Mis tareas".
rem  Doble clic en el ordenador del club. Ver instalar-tarea-tareas-pendientes.ps1.

cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\instalar-tarea-tareas-pendientes.ps1"
echo.
pause
