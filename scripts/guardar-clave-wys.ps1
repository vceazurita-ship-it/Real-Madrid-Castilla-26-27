# ===================================================================
#  GUARDAR LA CUENTA DE WYSCOUT PARA QUE EL ORDENADOR DEL CLUB ENTRE SOLO
#  (05/10/2026)
# ===================================================================
#  La sesion de Hudl caduca en pocas horas: guardar y reponer las cookies
#  sirve el mismo dia, no de un dia para otro, y el boton de Ajustes y la
#  tarea de los martes se encontraban la pagina de "Iniciar sesion". Con esto
#  el script escribe el correo y la contrasena el solo cuando Hudl los pide.
#
#  La contrasena NO se guarda en claro: se cifra con DPAPI de Windows
#  (ConvertFrom-SecureString), que solo puede descifrar ESTE usuario en ESTE
#  ordenador. Va a .cache\wyscout\credencial.json, que esta fuera de git.
#  Para cambiarla, se vuelve a ejecutar; para quitarla, se borra ese fichero.
# ===================================================================

$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$carpeta = Join-Path $raiz ".cache\wyscout"
$fichero = Join-Path $carpeta "credencial.json"

New-Item -ItemType Directory -Force -Path $carpeta | Out-Null

Write-Host ""
Write-Host "  Cuenta de Wyscout del Castilla (la que tiene el layout ALL)." -ForegroundColor Yellow
Write-Host "  La contrasena se guarda cifrada para este usuario de Windows."
Write-Host ""

$correo = Read-Host "  Correo"
$clave = Read-Host "  Contrasena" -AsSecureString

if (-not $correo -or $clave.Length -eq 0) {
  Write-Host "  Falta el correo o la contrasena. No se guarda nada." -ForegroundColor Red
  exit 1
}

$cifrada = ConvertFrom-SecureString -SecureString $clave

[pscustomobject]@{
  correo     = $correo.Trim()
  clave      = $cifrada
  guardadaEn = (Get-Date).ToString("s")
} | ConvertTo-Json | Set-Content -Path $fichero -Encoding UTF8

Write-Host ""
Write-Host "  Guardada. A partir de ahora Wyscout entra solo cuando Hudl lo pida." -ForegroundColor Green
Write-Host ""
