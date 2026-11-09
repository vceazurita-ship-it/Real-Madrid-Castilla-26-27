# Programa Opta TODOS LOS LUNES a las 07:30 (09/11/2026).
#
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-opta.ps1
#
# Crea la tarea «RMCF Castilla - Opta», que lanza scripts\opta-semanal.cmd:
# pide el encargo «opta» al vigia (como el boton de Ajustes). No choca con
# nada: el ABP de las ligas es a las 07:00 (Wyscout, otro Chrome), el ABP
# diario a las 08:30 y Wyscout los martes.
#
# Para quitarla:
#   Unregister-ScheduledTask -TaskName "RMCF Castilla - Opta" -Confirm:$false

$ErrorActionPreference = "Stop"

$nombre = "RMCF Castilla - Opta"
$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lote = Join-Path $raiz "scripts\opta-semanal.cmd"

if (-not (Test-Path $lote)) { throw "No encuentro $lote." }

if (Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
}

$accion = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$lote`"" -WorkingDirectory $raiz
$disparador = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "07:30"
$opciones = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Settings $opciones `
    -Description "Pide al vigia la descarga de Opta (Primera RFEF) cada lunes a las 07:30." | Out-Null

$info = Get-ScheduledTask -TaskName $nombre | Get-ScheduledTaskInfo
Write-Host "Tarea creada: $nombre"
Write-Host "Proxima vez:  $($info.NextRunTime)"
