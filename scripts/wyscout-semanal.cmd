@echo off
setlocal enabledelayedexpansion

rem ===================================================================
rem  LOS DATOS DE WYSCOUT, SOLOS Y SIN NADIE DELANTE
rem ===================================================================
rem
rem  Esto es lo que lanza el Programador de tareas una vez por semana. Hace lo
rem  mismo que `actualizar-wys.cmd` pero sin preguntar nada:
rem
rem    1. Baja la ficha de los veinte equipos del grupo (el Castilla incluido).
rem    2. Baja los jugadores de toda la categoria (los nuestros incluidos).
rem    3. Relee la carpeta y escribe public/data/analisis.json.
rem    4. Toma la foto de la jornada (la resta entre dos fotos es la jornada).
rem    5. PUBLICA: commit de los datos y push. Vercel hace el resto.
rem
rem  Lo programa `scripts\instalar-tarea-wyscout.ps1` y lo lanza tambien el
rem  vigia (`scripts\vigia.cjs`) cuando alguien pulsa «Traer lo nuevo de
rem  Wyscout» en Ajustes. A mano, mejor `actualizar-wys.cmd`, que ensena lo
rem  que hace y pregunta antes de publicar.
rem
rem  EL CODIGO DE SALIDA DICE COMO HA IDO (lo lee el vigia):
rem    0 publicado        3 no habia nada nuevo     2 la sesion ha caducado
rem    1 fallo al bajar   5 fallo al releer         4 fallo al subir (push)
rem
rem  LO UNICO QUE NO PUEDE HACER SOLO
rem
rem  Entrar en Wyscout. La sesion vive en un perfil de Chrome aparte y dura
rem  semanas, pero el dia que caduca no hay quien escriba la contrasena: la
rem  pasada se sale en seco, lo deja escrito en el registro y NO marca la
rem  semana como hecha, asi que la repeticion de dentro de dos horas lo vuelve
rem  a intentar. Para arreglarlo basta con abrir `actualizar-wys.cmd` a mano
rem  una vez y entrar en la ventana que sale.
rem
rem  El registro queda en `.cache\wyscout\`, un fichero por pasada.
rem ===================================================================

rem La raiz del proyecto es la carpeta de arriba, venga de donde venga la
rem llamada: el Programador de tareas arranca en System32 si no se le dice.
cd /d "%~dp0.."

set "REGISTRO=.cache\wyscout"
if not exist "%REGISTRO%" mkdir "%REGISTRO%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "SELLO=%%i"

rem La semana ISO, para no repetir el trabajo dentro de la misma jornada.
for /f %%i in ('powershell -NoProfile -Command "$c=(Get-Culture).Calendar; '{0}-S{1:00}' -f (Get-Date).Year, $c.GetWeekOfYear((Get-Date),[System.Globalization.CalendarWeekRule]::FirstFourDayWeek,[System.DayOfWeek]::Monday)"') do set "SEMANA=%%i"

set "LOG=%REGISTRO%\%SELLO%.log"
set "CODIGO=1"
set "HECHO=%REGISTRO%\hecho-%SEMANA%.txt"

rem ------------------------------------------------------------------
rem  Ya se hizo esta semana?
rem ------------------------------------------------------------------
rem  La tarea se repite durante el dia para recuperar una pasada perdida —el
rem  portatil apagado, la sesion caducada, la wifi del club—, asi que lo
rem  primero es no bajarse la liga dos veces. Con "--forzar" se hace igual:
rem  es lo que se quiere despues de un partido entre semana.

if /I "%~1"=="--forzar" goto :adelante

if exist "%HECHO%" (
  echo Ya se actualizo esta semana ^(%SEMANA%^). Nada que hacer.
  echo Ya se actualizo esta semana ^(%SEMANA%^) · %DATE% %TIME% >> "%LOG%"
  set "CODIGO=3"
  goto :limpieza
)

:adelante

echo ================================================= >> "%LOG%"
echo Datos de Wyscout · %DATE% %TIME% >> "%LOG%"
echo ================================================= >> "%LOG%"

rem ------------------------------------------------------------------
rem  1 y 2. Los equipos y los jugadores
rem ------------------------------------------------------------------

echo. >> "%LOG%"
echo --- Descarga --- >> "%LOG%"

call node scripts\wyscout-liga.mjs --desatendido >> "%LOG%" 2>&1

set "SALIDA=%errorlevel%"

if "%SALIDA%"=="2" (
  echo. >> "%LOG%"
  echo LA SESION DE WYSCOUT HA CADUCADO: hay que entrar una vez a mano. >> "%LOG%"
  echo   Abre scripts\actualizar-wys.cmd, entra en la ventana que sale, y >> "%LOG%"
  echo   la tarea vuelve sola la proxima vez. >> "%LOG%"
  echo LA SESION DE WYSCOUT HA CADUCADO. Abre scripts\actualizar-wys.cmd y entra.
  set "CODIGO=2"
  goto :limpieza
)

if not "%SALIDA%"=="0" (
  echo. >> "%LOG%"
  echo FALLO en la descarga ^(codigo %SALIDA%^). Se reintenta en la siguiente pasada. >> "%LOG%"
  echo Fallo en la descarga. Se reintentara.
  set "CODIGO=1"
  goto :limpieza
)

rem ------------------------------------------------------------------
rem  3. El indice
rem ------------------------------------------------------------------
rem  public/ lo sirve el CDN pero la funcion de Vercel no tiene esa carpeta en
rem  su disco: sin este fichero la pantalla de DATA sale vacia desplegada.

echo. >> "%LOG%"
echo --- Releyendo la carpeta --- >> "%LOG%"

call node scripts\data-analisis-indice.cjs >> "%LOG%" 2>&1

if errorlevel 1 (
  echo. >> "%LOG%"
  echo FALLO al releer la carpeta. Los .xlsx estan bajados pero NO se publica. >> "%LOG%"
  echo Fallo al releer la carpeta. No se publica.
  set "CODIGO=5"
  goto :limpieza
)

rem ------------------------------------------------------------------
rem  4. La foto de la jornada
rem ------------------------------------------------------------------
rem  La descarga individual es acumulada; restando dos fotos sale lo que
rem  paso en medio. Si falla no se para nada: se puede tomar otro dia.

echo. >> "%LOG%"
echo --- Foto de la jornada --- >> "%LOG%"

call node scripts\wyscout-instantanea.cjs >> "%LOG%" 2>&1

if errorlevel 1 echo No se ha podido guardar la foto; los datos siguen bien. >> "%LOG%"

rem ------------------------------------------------------------------
rem  5. Publicar
rem ------------------------------------------------------------------
rem  Solo los datos. Nunca codigo: si alguien esta a media faena con un
rem  componente abierto, esta tarea no se lo lleva por delante. Por eso el
rem  commit lleva las rutas detras: aunque hubiera otra cosa preparada con
rem  "git add", en este commit solo entran los datos.

echo. >> "%LOG%"
echo --- Publicando --- >> "%LOG%"

git add "public/data/wys" "public/data/analisis.json" >> "%LOG%" 2>&1

git commit -m "Los datos de Wyscout de la semana %SEMANA%" -- "public/data/wys" "public/data/analisis.json" >> "%LOG%" 2>&1

if errorlevel 1 (
  echo No habia nada nuevo que publicar. >> "%LOG%"
  echo No habia nada nuevo que publicar.
  echo %DATE% %TIME% · sin cambios > "%HECHO%"
  set "CODIGO=3"
  goto :limpieza
)

git push >> "%LOG%" 2>&1

if errorlevel 1 (
  echo. >> "%LOG%"
  echo EL COMMIT ESTA HECHO PERO EL PUSH HA FALLADO: queda sin publicar. >> "%LOG%"
  echo   Con red, un "git push" a mano lo resuelve. >> "%LOG%"
  echo El push ha fallado: los datos estan en local, sin publicar.
  set "CODIGO=4"
  goto :limpieza
)

echo. >> "%LOG%"
echo Publicado · %DATE% %TIME% >> "%LOG%"
echo Publicado. Vercel tarda un par de minutos.

rem La semana queda marcada: las repeticiones de hoy ya no haran nada.
echo %DATE% %TIME% > "%HECHO%"
set "CODIGO=0"

:limpieza

rem Se guardan los treinta ultimos registros y las marcas de las ocho ultimas
rem semanas, que es de sobra para mirar atras sin llenar la carpeta.
powershell -NoProfile -Command ^
  "Get-ChildItem '%REGISTRO%\*.log' | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue; Get-ChildItem '%REGISTRO%\hecho-*.txt' | Sort-Object Name -Descending | Select-Object -Skip 8 | Remove-Item -Force -ErrorAction SilentlyContinue"

rem El codigo sale del setlocal: es lo que lee el vigia para contar como ha ido.
endlocal & exit /b %CODIGO%
