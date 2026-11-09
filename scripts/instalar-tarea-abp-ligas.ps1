# Programa el balon parado de las otras ligas TODOS LOS LUNES a las 07:00.
#
#   Se ejecuta UNA VEZ:
#
#     powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-abp-ligas.ps1
#
# Crea la tarea «RMCF Castilla - ABP de las ligas», que lanza
# `scripts\abp-ligas-semanal.cmd`: baja de Wyscout los «Team Stats» de Primera
# RFEF Group 1 y Premier League, compacta `public/data/abp-ligas.json` y lo
# publica (solo ese fichero). Pedido por el analista el 09/11/2026.
#
# No choca con nada: el ABP diario es a las 08:30, la liga de Wyscout los
# martes y la jornada nocturna a las 00:00. Si coincidiera con algo que use el
# Chrome de Wyscout, `wyscout-liga.mjs` espera su turno (`chrome-turno.mjs`).
#
# Para quitarla:
#   Unregister-ScheduledTask -TaskName "RMCF Castilla - ABP de las ligas" -Confirm:$false

$ErrorActionPreference = "Stop"

$nombre = "RMCF Castilla - ABP de las ligas"

$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lote = Join-Path $raiz "scripts\abp-ligas-semanal.cmd"

if (-not (Test-Path $lote)) {
    throw "No encuentro $lote. Ejecuta el script desde la carpeta del proyecto."
}

$previa = Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue

if ($previa) {
    Write-Host "Ya existia: se reemplaza."
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
}

$accion = New-ScheduledTaskAction -Execute "cmd.exe" `
    -Argument "/c `"$lote`"" `
    -WorkingDirectory $raiz

$disparador = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "07:00"

# Con el ordenador apagado a las 07:00, se lanza al encenderlo.
$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 60) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nombre `
    -Action $accion `
    -Trigger $disparador `
    -Settings $opciones `
    -Description "Balon parado de Primera RFEF G1 y Premier (Wyscout) cada lunes a las 07:00; publica public/data/abp-ligas.json." | Out-Null

$info = Get-ScheduledTask -TaskName $nombre | Get-ScheduledTaskInfo
Write-Host "Tarea creada: $nombre"
Write-Host "Proxima vez:  $($info.NextRunTime)"
