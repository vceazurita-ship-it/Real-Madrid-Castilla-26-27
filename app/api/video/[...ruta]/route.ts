/*
|--------------------------------------------------------------------------
| /api/video/<ruta>: LOS VÍDEOS DE BACKBLAZE B2 (11/11/2026)
|--------------------------------------------------------------------------
|
| Los vídeos (cortes, vídeo del informe, ABP para jugadores, entrenos) viven en
| un bucket PRIVADO de Backblaze B2: el público pide pagar 1 $ y la cuenta es
| 100 % gratis (scripts/b2.cjs). Esta ruta pide a B2 un permiso de descarga
| para todo el bucket (vale un día; se guarda en memoria y se renueva) y
| redirige al fichero con él: los bytes van de B2 al navegador, no pasan por
| Render. El enlace guardado en los documentos es siempre esta ruta, que no
| caduca.
|
| Llaves en el entorno de Render: B2_KEY_ID, B2_APP_KEY, B2_BUCKET.
| Sólo sirve vídeos: no es un redireccionador abierto.
*/

import { cookies } from "next/headers";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";

export const dynamic = "force-dynamic";

/* 24/11/2026: la carpeta `privado/` (el vídeo de los jugadores rivales, scripts/opta-clips-jugador.mjs) sólo para el administrador. */
const PRIVADO = /^privado\//;

/* 14/11/2026: también PDF, imágenes y presentaciones, por si los ficheros van a la reserva (lib/datos/cliente.cjs). */
const VIDEO = /\.(mp4|mov|webm|m4v|pdf|png|jpe?g|webp|gif|svg|pptx?|docx?|xlsx?|csv|json|txt|zip)$/i;
const VALE_SEGUNDOS = 24 * 3600;
const RENUEVA_MS = 20 * 3600 * 1000;
const VALE_PRIVADO_SEGUNDOS = 600;

/*
| Revisión 24/11/2026 (seguridad): el permiso de descarga ya NO vale para todo
| el bucket. Antes era uno solo con prefijo "" y la redirección de cualquier
| vídeo lo enseñaba: con él se podía abrir también `privado/`. Ahora:
| - un vídeo normal lleva un permiso de SU carpeta de arriba («opta/», «abp/»…),
|   que no abre `privado/`; se guarda en memoria por carpeta y se renueva;
| - uno de `privado/` (sólo el administrador) lleva un permiso de ESE fichero,
|   de 10 minutos, y la respuesta no se guarda en el navegador.
*/
type Cuenta = { api: string; descarga: string; bucket: string; bucketId: string; token: string; hasta: number };
type Permiso = { token: string; hasta: number };

let cuenta: Cuenta | null = null;
let pidiendoCuenta: Promise<Cuenta> | null = null;
const permisos = new Map<string, Permiso>();
const pidiendo = new Map<string, Promise<Permiso>>();

const codifica = (ruta: string) => ruta.split("/").map(encodeURIComponent).join("/");

async function pideCuenta(): Promise<Cuenta> {
  const id = process.env.B2_KEY_ID;
  const clave = process.env.B2_APP_KEY;
  const bucket = process.env.B2_BUCKET;

  if (!id || !clave || !bucket) throw new Error("Faltan B2_KEY_ID, B2_APP_KEY o B2_BUCKET");

  const auth = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${clave}`).toString("base64")}` },
    cache: "no-store",
  });

  if (!auth.ok) throw new Error(`Backblaze no acepta la llave (${auth.status})`);

  const c = await auth.json();
  const api = c.apiInfo.storageApi;
  let bucketId: string | null = api.bucketName === bucket ? api.bucketId : null;

  if (!bucketId) {
    const r = await fetch(`${api.apiUrl}/b2api/v3/b2_list_buckets`, {
      method: "POST",
      headers: { Authorization: c.authorizationToken, "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: c.accountId, bucketName: bucket }),
      cache: "no-store",
    });

    bucketId = (await r.json()).buckets?.[0]?.bucketId ?? null;
  }

  if (!bucketId) throw new Error(`No existe el bucket ${bucket}`);

  /* El token de la cuenta dura 24 h; se renueva a las 20. */
  return { api: api.apiUrl, descarga: api.downloadUrl, bucket, bucketId, token: c.authorizationToken, hasta: Date.now() + RENUEVA_MS };
}

async function cuentaVigente() {
  if (cuenta && cuenta.hasta > Date.now()) return cuenta;

  pidiendoCuenta ??= pideCuenta().finally(() => {
    pidiendoCuenta = null;
  });
  cuenta = await pidiendoCuenta;

  return cuenta;
}

async function pidePermiso(c: Cuenta, prefijo: string, segundos: number): Promise<Permiso> {
  const r = await fetch(`${c.api}/b2api/v3/b2_get_download_authorization`, {
    method: "POST",
    headers: { Authorization: c.token, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: c.bucketId, fileNamePrefix: prefijo, validDurationInSeconds: segundos }),
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`Backblaze no da permiso de descarga (${r.status})`);

  const { authorizationToken } = await r.json();

  return { token: authorizationToken, hasta: Date.now() + Math.min(RENUEVA_MS, segundos * 1000 * 0.8) };
}

/** El permiso de la carpeta de arriba de `ruta` (o del propio fichero si está suelto en la raíz). */
async function permisoDeCarpeta(c: Cuenta, ruta: string) {
  const barra = ruta.indexOf("/");
  const prefijo = barra > 0 ? ruta.slice(0, barra + 1) : ruta;
  const ya = permisos.get(prefijo);

  if (ya && ya.hasta > Date.now()) return ya;

  if (!pidiendo.has(prefijo)) {
    pidiendo.set(
      prefijo,
      pidePermiso(c, prefijo, VALE_SEGUNDOS).finally(() => pidiendo.delete(prefijo)),
    );
  }
  const nuevo = await pidiendo.get(prefijo)!;
  permisos.set(prefijo, nuevo);

  return nuevo;
}

async function responde(params: Promise<{ ruta: string[] }>) {
  let ruta: string;

  try {
    ruta = (await params).ruta.map(decodeURIComponent).join("/");
  } catch {
    return new Response("No encontrado", { status: 404 });
  }

  if (!VIDEO.test(ruta) || ruta.split("/").some((t) => !t || t === "." || t === "..")) {
    return new Response("No encontrado", { status: 404 });
  }

  const privado = PRIVADO.test(ruta);

  if (privado && !esAdmin((await cookies()).get(COOKIE_ADMIN)?.value)) {
    return new Response("No encontrado", { status: 404 });
  }

  try {
    const c = await cuentaVigente();
    const p = privado ? await pidePermiso(c, ruta, VALE_PRIVADO_SEGUNDOS) : await permisoDeCarpeta(c, ruta);
    const destino = `${c.descarga}/file/${c.bucket}/${codifica(ruta)}?Authorization=${encodeURIComponent(p.token)}`;

    return new Response(null, {
      status: 302,
      headers: { Location: destino, "Cache-Control": privado ? "no-store" : "private, max-age=3600" },
    });
  } catch (error) {
    console.error("[video]", error instanceof Error ? error.message : error);

    return new Response("El vídeo no está disponible ahora", { status: 503 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  return responde(params);
}

export async function HEAD(_request: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  return responde(params);
}
