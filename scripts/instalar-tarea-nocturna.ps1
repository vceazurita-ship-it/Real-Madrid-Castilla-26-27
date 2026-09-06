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

# A las 00:00 y, si esa no sale, cada dos horas hasta completar el día.
#
# No es por desconfianza: en la wifi del club hay un portal cautivo que se
# mete en medio de las conexiones seguras, y con él no se puede bajar nada
# (el registro del 05/09/2026 acabó en «script.google.com no está en los
# altnames del certificado: DNS:wlc.realmadrid.es»). Con la repetición, una
# noche perdida se recupera en cuanto el portátil está en otra red, y el
# propio .cmd se sale en seco si el día ya está hecho.
$disparador = New-ScheduledTaskTrigger -Daily -At "00:00"

$disparador.Repetition = (New-ScheduledTaskTrigger -Once -At "00:00" `
    -RepetitionInterval (New-TimeSpan -Hours 2) `
    -RepetitionDuration (New-TimeSpan -Hours 22)).Repetition

# `StartWhenAvailable` es lo que hace esto práctico: si a las 00:00 el
# ordenador está apagado, la descarga se lanza en cuanto se enciende, en vez
# de perderse esa noche. `DontStopIfGoingOnBatteries` para que no la corte al
# desenchufar el portátil a media descarga —son unos cuarenta minutos—.
#
# El plazo es de **hora y media**, no de dos horas: si fuera de dos, una
# pasada colgada moriría en el mismo instante en que arranca la repetición
# siguiente, y con `IgnoreNew` esa repetición se perdería. Media hora de
# holgura basta para que el hueco esté siempre libre.
$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 90) `
    -MultipleInstances IgnoreNew

# Fuera de la consola.
#
# Por omisión el Programador engancha la tarea a la sesión interactiva y le
# da la misma consola que tienen los terminales abiertos. Entonces cualquier
# Ctrl+C que ocurra en cualquier terminal se la lleva por delante: el
# 06/09/2026 se cayó tres veces seguidas así, siempre con el mismo código
# (0xC000013A, que es exactamente «salida por Ctrl+C»), una de ellas a los
# cinco segundos de arrancar.
#
# Con `S4U` corre como el mismo usuario pero **sin sesión interactiva y sin
# consola**, que es lo que hace falta para algo que trabaja cuarenta minutos
# de madrugada. No necesita contraseña guardada ni escritorio: sólo baja
# páginas y escribe ficheros.
#
# **Pero registrarla así pide permisos de administrador.** Si no los hay se
# registra como siempre y se avisa en una línea, porque una tarea corriente
# que funciona es infinitamente mejor que ninguna: esto se intenta, no se
# exige. El 06/09/2026 se aprendió por las malas —el registro falló y la
# tarea se quedó sin existir hasta que se volvió a poner a mano—.
$comunes = @{
    TaskName    = $nombre
    Action      = $accion
    Trigger     = $disparador
    Settings    = $opciones
    Description = "Baja de BeSoccer los resultados de la jornada, las alineaciones y las fichas de jugador, y los sube a Supabase. El registro queda en la carpeta .cache del proyecto."
}

$sinConsola = $false

try {
    $quien = New-ScheduledTaskPrincipal `
        -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
        -LogonType S4U `
        -RunLevel Limited

    Register-ScheduledTask @comunes -Principal $quien -ErrorAction Stop | Out-Null

    $sinConsola = $true
} catch {
    Register-ScheduledTask @comunes | Out-Null
}

Write-Host "Programada: todos los días a las 00:00, y cada 2 h si esa falla." -ForegroundColor Green

if ($sinConsola) {
    Write-Host "Corre fuera de la consola: ningun Ctrl+C de un terminal la corta." -ForegroundColor Green
} else {
    Write-Host "Aviso: corre pegada a la sesion interactiva, asi que un Ctrl+C en un" -ForegroundColor Yellow
    Write-Host "       terminal puede cortarla a media descarga. Para evitarlo, vuelve" -ForegroundColor Yellow
    Write-Host "       a ejecutar este script como administrador." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Comprobar     : Get-ScheduledTask -TaskName '$nombre'"
Write-Host "Lanzar ahora  : Start-ScheduledTask -TaskName '$nombre'"
Write-Host "Ver el registro: la carpeta .cache\jornada-nocturna del proyecto"
Write-Host "Quitar        : Unregister-ScheduledTask -TaskName '$nombre' -Confirm:`$false"
