@echo off
rem ===================================================================
rem  IDEAS DESDE X CADA MANANA  (12/11/2026)
rem ===================================================================
rem
rem  Pide al vigia el encargo «x» (lo mismo que «Leer ahora» en Ajustes):
rem  el vigia lanza scripts\x-ideas.mjs, que lee @fernandosb9 con el
rem  Chrome de X (perfil rmcf-x, puerto 9336) y saca ideas para la app.
rem  Se ve en Ajustes - Actualizaciones.
rem
rem  Lo programa scripts\instalar-tarea-x.ps1. A mano: doble clic.
rem ===================================================================

cd /d "%~dp0.."
if not exist ".cache\x-ideas" mkdir ".cache\x-ideas"
node scripts\x-pide.cjs >> ".cache\x-ideas\tarea-mananas.log" 2>&1
exit /b %ERRORLEVEL%
