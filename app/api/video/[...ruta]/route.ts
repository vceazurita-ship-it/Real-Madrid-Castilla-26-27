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

export const dynamic = "force-dynamic";

/* 14/11/2026: también PDF, imágenes y presentaciones, por si los ficheros van a la reserva (lib/datos/cliente.cjs). */
const VIDEO = /\.(mp4|mov|webm|m4v|pdf|png|jpe?g|webp|gif|svg|pptx?|docx?|xlsx?|csv|json|txt|zip)$/i;
const VALE_SEGUNDOS = 24 * 3600;
const RENUEVA_MS = 20 * 3600 * 1000;

type Permiso = { descarga: string; bucket: string; token: string; hasta: number };

let permiso: Permiso | null = null;
let pidiendo: Promise<Permiso> | null = null;

const codifica = (ruta: string) => ruta.split("/").map(encodeURIComponent).join("/");

async function pidePermiso(): Promise<Permiso> {
  const id = process.env.B2_KEY_ID;
  const clave = process.env.B2_APP_KEY;
  const bucket = process.env.B2_BUCKET;

  if (!id || !clave || !bucket) throw new Error("Faltan B2_KEY_ID, B2_APP_KEY o B2_BUCKET");

  const auth = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${clave}`).toString("base64")}` },
    cache: "no-store",
  });

  if (!auth.ok) throw new Error(`Backblaze no acepta la llave (${auth.status})`);

  const cuenta = await auth.json();
  const api = cuenta.apiInfo.storageApi;
  let bucketId: string | null = api.bucketName === bucket ? api.bucketId : null;

  if (!bucketId) {
    const r = await fetch(`${api.apiUrl}/b2api/v3/b2_list_buckets`, {
      method: "POST",
      headers: { Authorization: cuenta.authorizationToken, "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: cuenta.accountId, bucketName: bucket }),
      cache: "no-store",
    });

    bucketId = (await r.json()).buckets?.[0]?.bucketId ?? null;
  }

  if (!bucketId) throw new Error(`No existe el bucket ${bucket}`);

  const r = await fetch(`${api.apiUrl}/b2api/v3/b2_get_download_authorization`, {
    method: "POST",
    headers: { Authorization: cuenta.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId, fileNamePrefix: "", validDurationInSeconds: VALE_SEGUNDOS }),
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`Backblaze no da permiso de descarga (${r.status})`);

  const { authorizationToken } = await r.json();

  return { descarga: api.downloadUrl, bucket, token: authorizationToken, hasta: Date.now() + RENUEVA_MS };
}

async function permisoVigente() {
  if (permiso && permiso.hasta > Date.now()) return permiso;

  pidiendo ??= pidePermiso().finally(() => {
    pidiendo = null;
  });
  permiso = await pidiendo;

  return permiso;
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

  try {
    const p = await permisoVigente();
    const destino = `${p.descarga}/file/${p.bucket}/${codifica(ruta)}?Authorization=${encodeURIComponent(p.token)}`;

    return new Response(null, {
      status: 302,
      headers: { Location: destino, "Cache-Control": "private, max-age=3600" },
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
