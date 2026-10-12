@echo off
rem Reintenta el vídeo del partido CON VOZ y lo manda por correo (12/10/2026).
rem Lo lanza la tarea programada «RMCF Castilla - Video J%1» cada hora: mientras
rem la cuota gratuita del TTS de Gemini (10 al día) esté agotada, el script sale
rem con código 7 sin mandar nada; cuando hay voz, manda el correo y deja
rem video\enviado.json, y las siguientes pasadas no hacen nada.
rem   video-informe-reintento.cmd <jornada> <correo>
setlocal
cd /d "%~dp0..\.."
set CLAUDECODE=
set CLAUDE_CODE_ENTRYPOINT=
echo [%date% %time%] reintento jornada %1 >> "%~dp0video-informe-reintento.log"
"C:\Program Files\nodejs\node.exe" scripts\partido\video-informe.mjs --jornada %1 --cortes-de-cache --si-no-enviado --correo %2 >> "%~dp0video-informe-reintento.log" 2>&1
echo [%date% %time%] codigo %errorlevel% >> "%~dp0video-informe-reintento.log"
endlocal
