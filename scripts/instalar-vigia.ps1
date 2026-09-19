# Programa el vigía de los encargos en este ordenador.
#
#   Se ejecuta UNA VEZ. Botón derecho sobre el fichero → «Ejecutar con
#   PowerShell», o desde una terminal en la carpeta del proyecto:
#
#     powershell -ExecutionPolicy Bypass -File scripts\instalar-vigia.ps1
#
# Crea una tarea llamada «RMCF Castilla - Vigia» que arranca
# `scripts\vigia.cjs` sin ventana al entrar en Windows. El vigía mira cada diez
# segundos si alguien ha pulsado un botón de Ajustes en la plataforma —poner
# los resultados de la quiniela, bajar la jornada de BeSoccer, traer lo nuevo
# de Wyscout— y lo hace en el momento, desde aquí, que es donde se puede.
#
# Va con la sesión abierta (interactiva) porque Wyscout se baja manejando un
# Chrome de verdad. Y además de al entrar, la tarea se dispara cada quince
# minutos: si el vigía se hubiera caído, vuelve; si está vivo, no pasa nada
# (no se arranca uno encima del otro).
#
# Para quitarla:
#   Unregister-ScheduledTask -TaskName "RMCF Castilla - Vigia" -Confirm:$false

$ErrorActionPreference = "Stop"

# Sin acentos a propósito: PowerShell 5.1 y los nombres de tarea no se llevan
# bien con ellos (ver instalar-tarea-nocturna.ps1).
$nombre = "RMCF Castilla - Vigia"

$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lanzador = Join-Path $raiz "scripts\vigia.vbs"

if (-not (Test-Path $lanzador)) {
    throw "No encuentro $lanzador. Ejecuta el script desde la carpeta del proyecto."
}

Write-Host "Proyecto: $raiz"
Write-Host "Vigía:    $lanzador"
Write-Host ""

$previa = Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue

if ($previa) {
    Write-Host "Ya existía: se reemplaza."
    Stop-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
}

$accion = New-ScheduledTaskAction -Execute "wscript.exe" `
    -Argument "`"$lanzador`"" `
    -WorkingDirectory $raiz

$usuario = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$alEntrar = New-ScheduledTaskTrigger -AtLogOn -User $usuario

# Cada quince minutos, todo el día: es la red por si el vigía se cae.
$cadaRato = New-ScheduledTaskTrigger -Daily -At "00:00"

$cadaRato.Repetition = (New-ScheduledTaskTrigger -Once -At "00:00" `
    -RepetitionInterval (New-TimeSpan -Minutes 15) `
    -RepetitionDuration (New-TimeSpan -Hours 24)).Repetition

# Sin plazo (0 = sin límite): el vigía vive todo el día. `IgnoreNew` hace que
# la repetición no arranque un segundo vigía mientras el primero sigue vivo.
$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -MultipleInstances IgnoreNew

$quien = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $nombre `
    -Action $accion `
    -Trigger @($alEntrar, $cadaRato) `
    -Settings $opciones `
    -Principal $quien `
    -Description "Atiende al momento los botones de Ajustes de la plataforma: resultados de la quiniela, jornada de BeSoccer y datos de Wyscout. El registro queda en .cache\vigia del proyecto." | Out-Null

Start-ScheduledTask -TaskName $nombre

Write-Host "Programado y en marcha: arranca al entrar en Windows y se vigila cada 15 min." -ForegroundColor Green
Write-Host ""
Write-Host "Comprobar      : Get-ScheduledTask -TaskName '$nombre'"
Write-Host "Ver el registro: la carpeta .cache\vigia del proyecto"
Write-Host "Quitar         : Unregister-ScheduledTask -TaskName '$nombre' -Confirm:`$false"
