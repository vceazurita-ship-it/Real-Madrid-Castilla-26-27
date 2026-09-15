# Programa la actualización semanal de los datos de Wyscout en este ordenador.
#
#   Se ejecuta UNA VEZ. Botón derecho sobre el fichero → «Ejecutar con
#   PowerShell», o desde una terminal en la carpeta del proyecto:
#
#     powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-wyscout.ps1
#
# Crea una tarea llamada «RMCF Castilla - Datos de Wyscout» que lanza
# `scripts\wyscout-semanal.cmd` los martes por la mañana: baja la ficha de los
# veinte equipos del grupo y los jugadores de toda la categoría —el Castilla y
# los nuestros incluidos— y lo publica.
#
# ANTES DE PROGRAMARLA, ENTRA UNA VEZ A MANO
#
# Abre `scripts\actualizar-wys.cmd` con doble clic y entra en Wyscout en la
# ventana que sale. La sesión se queda en un perfil de Chrome aparte y dura
# semanas; sin ella, la tarea no puede hacer nada (lo dirá en el registro).
#
# Para quitarla:
#   Unregister-ScheduledTask -TaskName "RMCF Castilla - Datos de Wyscout" -Confirm:$false

$ErrorActionPreference = "Stop"

# El nombre va sin acentos ni signos raros a propósito: PowerShell 5.1 lee los
# .ps1 como ANSI cuando no llevan BOM, y un carácter suelto en el nombre deja
# la tarea registrada con otro nombre del que se busca.
$nombre = "RMCF Castilla - Datos de Wyscout"

# La raíz del proyecto es la carpeta de arriba de este script.
$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lote = Join-Path $raiz "scripts\wyscout-semanal.cmd"

if (-not (Test-Path $lote)) {
    throw "No encuentro $lote. Ejecuta el script desde la carpeta del proyecto."
}

Write-Host "Proyecto: $raiz"
Write-Host "Tarea:    $lote"
Write-Host ""

# Si ya estaba, se quita y se vuelve a crear: así reinstalar actualiza la
# configuración en vez de fallar diciendo que ya existe.
$previa = Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue

if ($previa) {
    Write-Host "Ya existía: se reemplaza."
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
}

$accion = New-ScheduledTaskAction -Execute "cmd.exe" `
    -Argument "/c `"$lote`"" `
    -WorkingDirectory $raiz

# Los martes a las 10:00, y cada dos horas hasta las 20:00 si esa no sale.
#
# El martes porque la liga juega el fin de semana y Wyscout tarda un día o dos
# en publicar los informes de la jornada. La repetición es para lo de siempre:
# el portátil apagado, la sesión caducada, la wifi del club con su portal
# cautivo. El propio .cmd se sale en seco si la semana ya está hecha, así que
# repetir no cuesta nada.
#
# ¿Y un partido entre semana? Doble clic en `actualizar-wys.cmd` y listo: eso
# no espera al martes.
$disparador = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Tuesday -At "10:00"

$disparador.Repetition = (New-ScheduledTaskTrigger -Once -At "10:00" `
    -RepetitionInterval (New-TimeSpan -Hours 2) `
    -RepetitionDuration (New-TimeSpan -Hours 10)).Repetition

# `StartWhenAvailable` es lo que hace esto práctico: si el martes a las 10:00
# el ordenador está apagado, la descarga se lanza en cuanto se enciende, en
# vez de perderse la semana.
#
# El plazo es de 40 minutos: la descarga entera son unos diez, y con eso hay
# holgura de sobra para una pasada lenta sin que se solape con la repetición
# siguiente.
$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 40) `
    -MultipleInstances IgnoreNew

# AQUÍ SÍ HACE FALTA SESIÓN ABIERTA, Y NO ES UN DESCUIDO
#
# La tarea de la jornada nocturna corre con `S4U` —sin sesión interactiva—
# porque sólo baja páginas y escribe ficheros. Ésta no puede: **abre un Chrome
# de verdad y lo maneja a golpe de ratón**, y un navegador sin escritorio no
# pinta nada que clicar. Así que va como tarea interactiva y sólo trabaja con
# el usuario dentro. En un portátil que se usa a diario eso es todos los días;
# y si el martes no se enciende, `StartWhenAvailable` la lanza al encenderlo.
#
# El precio conocido de ser interactiva: comparte consola con los terminales
# abiertos, así que un Ctrl+C en cualquiera de ellos puede cortarla. Para diez
# minutos a media mañana es asumible, y la repetición de dos horas lo recoge.
#
# Y sí, verás la ventana de Chrome moverse sola durante unos minutos. No la
# toques mientras trabaja.
$quien = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $nombre `
    -Action $accion `
    -Trigger $disparador `
    -Settings $opciones `
    -Principal $quien `
    -Description "Baja de Wyscout la ficha de los 20 equipos del grupo y los jugadores de toda la categoria, relee la carpeta y lo publica. El registro queda en .cache\wyscout del proyecto." | Out-Null

Write-Host "Programada: los martes a las 10:00, y cada 2 h hasta las 20:00 si esa falla." -ForegroundColor Green
Write-Host "Corre con tu sesion abierta: veras la ventana de Chrome moverse sola." -ForegroundColor Green
Write-Host ""
Write-Host "ANTES DE NADA: abre scripts\actualizar-wys.cmd una vez y entra en Wyscout." -ForegroundColor Yellow
Write-Host "               Sin esa sesion la tarea no puede bajar nada." -ForegroundColor Yellow
Write-Host ""
Write-Host "Comprobar      : Get-ScheduledTask -TaskName '$nombre'"
Write-Host "Lanzar ahora   : Start-ScheduledTask -TaskName '$nombre'"
Write-Host "Ver el registro: la carpeta .cache\wyscout del proyecto"
Write-Host "Quitar         : Unregister-ScheduledTask -TaskName '$nombre' -Confirm:`$false"
