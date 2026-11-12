# Programa las ideas desde X TODAS LAS MANANAS a las 07:45 (12/11/2026).
#
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-x.ps1
#
# Crea la tarea «RMCF Castilla - Ideas desde X», que lanza
# scripts\x-ideas-diario.cmd: pide el encargo «x» al vigia (como «Leer ahora»
# en Ajustes). Usa su propio Chrome (puerto 9336): no choca con el ABP de las
# 07:00 ni con Opta de los lunes a las 07:30 ni con el ABP diario de las 08:30.
#
# Lo mismo con schtasks, desde la carpeta del proyecto:
#   schtasks /Create /TN "RMCF Castilla - Ideas desde X" /SC DAILY /ST 07:45 /TR "cmd.exe /c \"%CD%\scripts\x-ideas-diario.cmd\"" /F
#
# Para quitarla:
#   Unregister-ScheduledTask -TaskName "RMCF Castilla - Ideas desde X" -Confirm:$false

$ErrorActionPreference = "Stop"

$nombre = "RMCF Castilla - Ideas desde X"
$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lote = Join-Path $raiz "scripts\x-ideas-diario.cmd"

if (-not (Test-Path $lote)) { throw "No encuentro $lote." }

if (Get-ScheduledTask -TaskName $nombre -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
}

$accion = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$lote`"" -WorkingDirectory $raiz
$disparador = New-ScheduledTaskTrigger -Daily -At "07:45"
$opciones = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Settings $opciones `
    -Description "Pide al vigia leer @fernandosb9 en X y sacar ideas para la app cada manana a las 07:45." | Out-Null

$info = Get-ScheduledTask -TaskName $nombre | Get-ScheduledTaskInfo
Write-Host "Tarea creada: $nombre"
Write-Host "Proxima vez:  $($info.NextRunTime)"
