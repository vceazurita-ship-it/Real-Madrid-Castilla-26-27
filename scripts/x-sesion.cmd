@echo off
rem ===================================================================
rem  X: INICIAR SESION UNA VEZ  (12/11/2026)
rem ===================================================================
rem
rem  Abre el Chrome propio de X del ordenador del club (perfil rmcf-x,
rem  puerto 9336) en la pagina de entrada de X. Entra con tu cuenta, a
rem  mano, y cierra la ventana: la sesion se queda en el perfil y
rem  scripts\x-ideas.mjs la usa cada manana. Ninguna contrasena se guarda
rem  en ningun sitio fuera de Chrome.
rem
rem  Si X pide comprobar que no eres un robot, se hace aqui tambien.
rem ===================================================================

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo No encuentro Chrome en Program Files.
  pause
  exit /b 1
)

start "" "%CHROME%" --remote-debugging-port=9336 --user-data-dir="%LOCALAPPDATA%\rmcf-x" --no-first-run --no-default-browser-check "https://x.com/login"
exit /b 0
