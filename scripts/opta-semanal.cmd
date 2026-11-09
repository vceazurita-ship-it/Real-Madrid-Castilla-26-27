@echo off
rem ===================================================================
rem  OPTA CADA LUNES  (09/11/2026)
rem ===================================================================
rem
rem  Pide al vigia el encargo «opta» (lo mismo que el boton de Ajustes):
rem  el vigia lanza scripts\opta-liga.mjs con la sesion del Chrome de Opta
rem  (perfil rmcf-opta) y lo sube a Supabase. Se ve en Ajustes.
rem
rem  Lo programa scripts\instalar-tarea-opta.ps1. A mano: doble clic.
rem ===================================================================

cd /d "%~dp0.."
if not exist ".cache\opta" mkdir ".cache\opta"
node scripts\opta-pide.cjs >> ".cache\opta\tarea-lunes.log" 2>&1
exit /b %ERRORLEVEL%
