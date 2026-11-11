/*
|--------------------------------------------------------------------------
| BACKBLAZE B2: DONDE VIVEN LOS VÍDEOS (11/11/2026)
|--------------------------------------------------------------------------
|
| Supabase gratis da 1 GB de ficheros y los cortes de vídeo ocupaban casi 2,2.
| Los vídeos (cortes, vídeo del informe, ABP para jugadores, entrenos) van a
| un bucket PRIVADO de Backblaze B2 (10 GB gratis, sin tarjeta: si se pasa
| del uso gratis, corta en vez de cobrar). Supabase se queda con documentos,
| fotos, PDF y presentaciones.
|
| Llaves en `.env.local` (o en el entorno):
|   B2_KEY_ID, B2_APP_KEY   la «Application Key» del bucket (lectura y escritura)
|   B2_BUCKET               el nombre del bucket
|
| API nativa de B2 con fetch (sin dependencias):
|   const b2 = require("./b2.cjs");
|   if (b2.configurado()) { const url = await b2.sube(ruta, buffer, "video/mp4"); }
| El bucket es PRIVADO (el público pide pagar 1 $): el enlace que se guarda es
| `https://rmcf-castilla.onrender.com/api/video/<ruta>`, que pide permiso a B2
| y redirige (app/api/video/[...ruta]/route.ts).
*/

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

function llaves() {
  const env = {};
  const fichero = path.join(RAIZ, ".env.local");

  if (fs.existsSync(fichero)) {
    for (const linea of fs.readFileSync(fichero, "utf8").split("\r").join("").split("\n")) {
      const trozo = linea.match(/^(B2_[A-Z_]+)=(.*)$/);

      if (trozo) env[trozo[1]] = trozo[2].trim();
    }
  }

  for (const clave of ["B2_KEY_ID", "B2_APP_KEY", "B2_BUCKET"]) {
    if (process.env[clave]) env[clave] = process.env[clave];
  }

  return env;
}

const configurado = () => {
  const k = llaves();

  return Boolean(k.B2_KEY_ID && k.B2_APP_KEY && k.B2_BUCKET);
};

/** Los vídeos son los que van a B2. */
const esVideo = (ruta) => /\.(mp4|mov|webm|m4v)$/i.test(ruta);

/* La ruta en la URL: cada trozo codificado, las barras tal cual. */
const codifica = (ruta) => ruta.split("/").map(encodeURIComponent).join("/");

let sesion = null;

async function autoriza() {
  if (sesion) return sesion;

  const k = llaves();

  if (!k.B2_KEY_ID || !k.B2_APP_KEY || !k.B2_BUCKET) throw new Error("Faltan B2_KEY_ID, B2_APP_KEY o B2_BUCKET en .env.local");

  const r = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${Buffer.from(`${k.B2_KEY_ID}:${k.B2_APP_KEY}`).toString("base64")}` },
  });

  if (!r.ok) throw new Error(`Backblaze no acepta la llave (${r.status})`);

  const j = await r.json();
  const api = j.apiInfo.storageApi;
  let bucketId = api.bucketId ?? null;

  if (!bucketId || api.bucketName !== k.B2_BUCKET) {
    const lista = await llama({ apiUrl: api.apiUrl, token: j.authorizationToken }, "b2_list_buckets", { accountId: j.accountId, bucketName: k.B2_BUCKET });

    bucketId = lista.buckets?.[0]?.bucketId ?? null;
  }

  if (!bucketId) throw new Error(`No existe el bucket ${k.B2_BUCKET} (o la llave no llega a él)`);

  sesion = { apiUrl: api.apiUrl, downloadUrl: api.downloadUrl, token: j.authorizationToken, bucketId, bucket: k.B2_BUCKET };


  return sesion;
}

async function llama(s, metodo, cuerpo) {
  const r = await fetch(`${s.apiUrl}/b2api/v3/${metodo}`, {
    method: "POST",
    headers: { Authorization: s.token, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const j = await r.json().catch(() => ({}));

  if (!r.ok) throw new Error(`${metodo}: ${j.message ?? r.status}`);

  return j;
}

/** El enlace que se guarda: la ruta de la web, que redirige al bucket privado con permiso (app/api/video). */
async function urlPublica(ruta) {
  return urlPublicaYa(ruta);
}

/** Comprueba la copia directamente en B2 (con la llave): existe y pesa `bytes`. */
async function comprueba(ruta, bytes) {
  const s = await autoriza();
  const r = await fetch(`${s.downloadUrl}/file/${s.bucket}/${codifica(ruta)}`, { method: "HEAD", headers: { Authorization: s.token } });

  return r.ok && Number(r.headers.get("content-length")) === bytes;
}

const SITIO = (process.env.SITIO_PUBLICO || "https://rmcf-castilla.onrender.com").replace(/\/$/, "");

/** El enlace sin esperar a Backblaze. */
function urlPublicaYa(ruta) {
  return `${SITIO}/api/video/${codifica(ruta)}`;
}

/** Esconde la ruta (la regla del bucket «sólo la última versión» la borra al día siguiente). */
async function oculta(ruta) {
  const s = await autoriza();

  try {
    await llama(s, "b2_hide_file", { bucketId: s.bucketId, fileName: ruta });
  } catch (error) {
    if (!/not.?found|no such file/i.test(error.message)) throw error;
  }
}

let subida = null;

/** Sube `datos` (Buffer) a `ruta`; devuelve la URL pública. Reintenta con otra dirección de subida. */
async function sube(ruta, datos, tipo = "video/mp4") {
  const s = await autoriza();
  const sha1 = crypto.createHash("sha1").update(datos).digest("hex");

  for (let intento = 0; intento < 4; intento += 1) {
    if (!subida) subida = await llama(s, "b2_get_upload_url", { bucketId: s.bucketId });

    try {
      const r = await fetch(subida.uploadUrl, {
        method: "POST",
        headers: {
          Authorization: subida.authorizationToken,
          "X-Bz-File-Name": codifica(ruta),
          "Content-Type": tipo,
          "Content-Length": String(datos.length),
          "X-Bz-Content-Sha1": sha1,
        },
        body: datos,
      });

      if (r.ok) return urlPublica(ruta);

      const j = await r.json().catch(() => ({}));

      if (r.status === 401 || r.status === 503 || r.status === 408 || r.status >= 500) {
        subida = null;
        continue;
      }

      throw new Error(`b2_upload_file: ${j.message ?? r.status}`);
    } catch (error) {
      if (intento === 3) throw error;
      subida = null;
    }
  }

  throw new Error("Backblaze no ha dejado subir");
}

/** Todos los ficheros del bucket: Map ruta → bytes. */
async function lista(prefijo = "") {
  const s = await autoriza();
  const salida = new Map();
  let siguiente = null;

  do {
    const j = await llama(s, "b2_list_file_names", { bucketId: s.bucketId, prefix: prefijo, maxFileCount: 10000, ...(siguiente ? { startFileName: siguiente } : {}) });

    for (const f of j.files ?? []) salida.set(f.fileName, f.contentLength);
    siguiente = j.nextFileName;
  } while (siguiente);

  return salida;
}

module.exports = { configurado, esVideo, sube, urlPublica, urlPublicaYa, comprueba, lista, oculta, autoriza };
