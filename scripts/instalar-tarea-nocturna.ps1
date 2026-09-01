# Programa la actualización nocturna de la jornada en este ordenador.
#
#   Se ejecuta UNA VEZ. Botón derecho sobre el fichero → «Ejecutar con
#   PowerShell», o desde una terminal en la carpeta del proyecto:
#
#     powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-nocturna.ps1
#
# Crea una tarea llamada «RMCF Castilla - Jornada nocturna» que lanza
# `scripts\jornada-nocturna.cmd` todos los días a las 00:00.
#
# ¿Por qué aquí y no en GitHub? Porque BeSoccer bloquea las IP de centro de
# datos: al runner de GitHub le contesta 406 con cero bytes (comprobado el
# 01/09/2026). Desde una conexión doméstica funciona, así que la descarga
# tiene que salir de este ordenador.
#
# Para quitarla:
#   Unregister-ScheduledTask -TaskName "RMCF Castilla - Jornada nocturna" -Confirm:$false

$ErrorActionPreference = "Stop"

# El nombre va sin acentos ni signos raros a propósito: PowerShell 5.1 lee los
# .ps1 como ANSI cuando no llevan BOM, y un punto medio en el nombre se
# registraba como «RMCF Castilla Â· Jornada nocturna» — la tarea existía pero
# no se encontraba buscándola por su nombre.
$nombre = "RMCF Castilla - Jornada nocturna"

# La raíz del proyecto es la carpeta de arriba de este script.
$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lote = Join-Path $raiz "scripts\jornada-nocturna.cmd"

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

$disparador = New-ScheduledTaskTrigger -Daily -At "00:00"

# `StartWhenAvailable` es lo que hace esto práctico: si a las 00:00 el
# ordenador está apagado, la descarga se lanza en cuanto se enciende, en vez
# de perderse esa noche. `DontStopIfGoingOnBatteries` para que no la corte al
# desenchufar el portátil a media descarga —son unos cuarenta minutos—.
$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nombre `
    -Action $accion `
    -Trigger $disparador `
    -Settings $opciones `
    -Description "Baja de BeSoccer los resultados de la jornada, las alineaciones y las fichas de jugador, y los sube a Supabase. Registro en .cache\jornada-nocturna." | Out-Null

Write-Host "Programada: todos los días a las 00:00." -ForegroundColor Green
Write-Host ""
Write-Host "Comprobar     : Get-ScheduledTask -TaskName '$nombre'"
Write-Host "Lanzar ahora  : Start-ScheduledTask -TaskName '$nombre'"
Write-Host "Ver el registro: la carpeta .cache\jornada-nocturna del proyecto"
Write-Host "Quitar        : Unregister-ScheduledTask -TaskName '$nombre' -Confirm:`$false"
