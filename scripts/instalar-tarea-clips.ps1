# Programa los clips de las 6:00 en este ordenador (26/11/2026).
#
#   Se ejecuta UNA VEZ:
#     powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-clips.ps1
#
# Crea la tarea "RMCF Castilla - Clips 6h", que lanza scripts\clips-al-dia.cmd
# todos los días a las 6:00 (si el ordenador estaba apagado, en cuanto se
# encienda). La pasada de la noche la hace la jornada nocturna (paso 12).
#
# Para quitarla:
#   Unregister-ScheduledTask -TaskName "RMCF Castilla - Clips 6h" -Confirm:$false

$ErrorActionPreference = "Stop"
$nombre = "RMCF Castilla - Clips 6h"
$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lote = Join-Path $raiz "scripts\clips-al-dia.cmd"
if (-not (Test-Path $lote)) { throw "No encuentro $lote." }

if (Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
}

$accion = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$lote`"" -WorkingDirectory $raiz
$disparador = New-ScheduledTaskTrigger -Daily -At "06:00"
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 3)
Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Settings $ajustes -Description "Clips de Opta de los nuestros y del proximo rival (scripts\clips-al-dia.cmd)" | Out-Null
Write-Host "Tarea '$nombre' programada a las 6:00."
