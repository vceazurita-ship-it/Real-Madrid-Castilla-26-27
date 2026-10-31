# Programa el CORREO DE LAS 7:00 con las tareas sin hacer de "Mis tareas".
#
#   Se ejecuta UNA VEZ en el ordenador del club: doble clic en
#   scripts\instalar-tarea-tareas-pendientes.cmd, o:
#
#     powershell -ExecutionPolicy Bypass -File scripts\instalar-tarea-tareas-pendientes.ps1
#
# Crea la tarea "RMCF Castilla - Tareas pendientes", que lanza
# `scripts\tareas-pendientes-correo.cmd` todos los dias a las 07:00: si en
# "Mis tareas" queda algo sin hacer de dias anteriores, manda un correo desde
# la cuenta del club. Solo lee; no escribe nada.
#
# No choca con nada: la jornada nocturna es a las 00:00, lo de ABP a las 08:30
# y la descarga de la liga los martes a las 10:00. No abre navegador.
#
# Para quitarla:
#   Unregister-ScheduledTask -TaskName "RMCF Castilla - Tareas pendientes" -Confirm:$false

$ErrorActionPreference = "Stop"

$nombre = "RMCF Castilla - Tareas pendientes"

$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lote = Join-Path $raiz "scripts\tareas-pendientes-correo.cmd"

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

# Todos los dias a las 07:00. Con el ordenador apagado a esa hora, sale al
# encenderlo (StartWhenAvailable); el sello del dia evita que salga dos veces.
$disparador = New-ScheduledTaskTrigger -Daily -At "07:00"

$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew

# Sin ventana: no necesita escritorio. S4U deja que corra sin sesion abierta
# y sin guardar la contrasena; si la politica del equipo no lo permite, se
# queda como interactiva (corre solo con la sesion iniciada).
$usuario = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$comunes = @{
    TaskName    = $nombre
    Action      = $accion
    Trigger     = $disparador
    Settings    = $opciones
    Description = "Cada manana a las 07:00: si en Mis tareas queda algo sin hacer de dias anteriores, manda un correo desde la cuenta del club. Registro en .cache\tareas-pendientes\registro."
}

try {
    $quien = New-ScheduledTaskPrincipal -UserId $usuario -LogonType S4U -RunLevel Limited
    Register-ScheduledTask @comunes -Principal $quien -ErrorAction Stop | Out-Null
    Write-Host "Programada sin necesidad de sesion abierta." -ForegroundColor Green
} catch {
    $quien = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask @comunes -Principal $quien | Out-Null
    Write-Host "Programada (solo corre con la sesion de Windows iniciada)." -ForegroundColor Yellow
}

Write-Host "Todos los dias a las 07:00." -ForegroundColor Green
Write-Host ""
Write-Host "Probar en seco : scripts\tareas-pendientes-correo.cmd --seco"
Write-Host "Comprobar      : Get-ScheduledTask -TaskName '$nombre'"
Write-Host "Lanzar ahora   : Start-ScheduledTask -TaskName '$nombre'"
Write-Host "Ver el registro: .cache\tareas-pendientes\registro del proyecto"
Write-Host "Quitar         : Unregister-ScheduledTask -TaskName '$nombre' -Confirm:`$false"
