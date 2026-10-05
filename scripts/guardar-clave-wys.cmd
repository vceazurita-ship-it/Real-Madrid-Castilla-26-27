@echo off
rem ===================================================================
rem  Doble clic: guarda la cuenta de Wyscout (cifrada para este usuario de
rem  Windows) para que el boton de Ajustes y la tarea de los martes entren
rem  solos cuando la sesion de Hudl caduque. Ver guardar-clave-wys.ps1.
rem ===================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0guardar-clave-wys.ps1"
pause
