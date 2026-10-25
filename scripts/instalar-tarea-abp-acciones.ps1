# Programa la descarga DIARIA de lo mejor a balon parado de cada jornada.
#
#   Se ejecuta UNA VEZ. Boton derecho -> «Ejecutar con PowerShell», o:
#
#     powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-abp-acciones.ps1
#
# Crea la tarea «RMCF Castilla - ABP de cada jornada», que lanza
# `scripts\abp-acciones-diario.cmd` todos los dias a las 08:30 (y cada 2 h
# hasta las 20:30 si esa no sale): baja de Wyscout los partidos nuevos de
# Primera RFEF (los dos grupos), Segunda, Premier y Champions, compacta
# `public/data/abp-acciones.json` y lo publica (solo ese fichero).
#
# La hora no choca con nada: la descarga de la liga es los martes a las
# 10:00 y la jornada nocturna a las 00:00. Si coincidiera con otra cosa que use
# el Chrome de Wyscout, el script espera su turno (`chrome-turno.mjs`).
#
# Para quitarla:
#   Unregister-ScheduledTask -TaskName "RMCF Castilla - ABP de cada jornada" -Confirm:$false

$ErrorActionPreference = "Stop"

$nombre = "RMCF Castilla - ABP de cada jornada"

$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lote = Join-Path $raiz "scripts\abp-acciones-diario.cmd"

if (-not (Test-Path $lote)) {
    throw "No encuentro $lote. Ejecuta el script desde la carpeta del proyecto."
}

Write-Host "Proyecto: $raiz"
Write-Host "Tarea:    $lote"
Write-Host ""

$previa = Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue

if ($previa) {
    Write-Host "Ya existia: se reemplaza."
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
}

$accion = New-ScheduledTaskAction -Execute "cmd.exe" `
    -Argument "/c `"$lote`"" `
    -WorkingDirectory $raiz

# Todos los dias a las 08:30, y cada dos horas hasta las 20:30 si esa falla.
# El .cmd se sale en seco si el dia ya esta hecho: repetir no cuesta nada.
$disparador = New-ScheduledTaskTrigger -Daily -At "08:30"

$disparador.Repetition = (New-ScheduledTaskTrigger -Once -At "08:30" `
    -RepetitionInterval (New-TimeSpan -Hours 2) `
    -RepetitionDuration (New-TimeSpan -Hours 12)).Repetition

# Con el ordenador apagado a las 08:30, se lanza al encenderlo. Una pasada
# diaria son uno o dos minutos; la primera de la temporada, unos quince.
$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 60) `
    -MultipleInstances IgnoreNew

# Interactiva, como la de los martes: abre un Chrome de verdad (el de Wyscout)
# y sin escritorio no hay navegador. Veras su ventana un par de minutos.
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
    -Description "Baja de Wyscout las acciones a balon parado de cada jornada (Primera RFEF G1 y G2, Segunda, Premier, Champions), compacta public/data/abp-acciones.json y lo publica. Registro en .cache\wyscout\abp-acciones\registro." | Out-Null

Write-Host "Programada: todos los dias a las 08:30, y cada 2 h hasta las 20:30 si esa falla." -ForegroundColor Green
Write-Host ""
Write-Host "Comprobar      : Get-ScheduledTask -TaskName '$nombre'"
Write-Host "Lanzar ahora   : Start-ScheduledTask -TaskName '$nombre'"
Write-Host "Ver el registro: .cache\wyscout\abp-acciones\registro del proyecto"
Write-Host "Quitar         : Unregister-ScheduledTask -TaskName '$nombre' -Confirm:`$false"
