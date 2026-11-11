/**
 * BACKBLAZE B2 DESDE EL SERVIDOR (11/11/2026).
 *
 * La misma cuenta que `scripts/b2.cjs` (bucket privado, llaves B2_KEY_ID,
 * B2_APP_KEY y B2_BUCKET en el entorno), para lo que hace la web: guardar por
 * trozos un vídeo que YouTube no ha admitido hoy y leerlo después para subirlo.
 * Con `fetch`, sin dependencias. La sesión se guarda en memoria 20 h.
 */

import { createHash } from "node:crypto";

type Sesion = { apiUrl: string; descarga: string; token: string; bucketId: string; bucket: string; hasta: number };

let sesion: Sesion | null = null;

export const hayB2 = () => Boolean(process.env.B2_KEY_ID && process.env.B2_APP_KEY && process.env.B2_BUCKET);

const codifica = (ruta: string) => ruta.split("/").map(encodeURIComponent).join("/");

async function autoriza(): Promise<Sesion> {
  if (sesion && sesion.hasta > Date.now()) return sesion;

  const id = process.env.B2_KEY_ID;
  const clave = process.env.B2_APP_KEY;
  const bucket = process.env.B2_BUCKET;

  if (!id || !clave || !bucket) throw new Error("Faltan las llaves de Backblaze en el servidor");

  const r = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${clave}`).toString("base64")}` },
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`Backblaze no acepta la llave (${r.status})`);

  const j = await r.json();
  const api = j.apiInfo.storageApi;
  let bucketId: string | null = api.bucketName === bucket ? api.bucketId : null;

  if (!bucketId) {
    const lista = await llamaCon({ apiUrl: api.apiUrl, token: j.authorizationToken }, "b2_list_buckets", { accountId: j.accountId, bucketName: bucket });

    bucketId = lista.buckets?.[0]?.bucketId ?? null;
  }

  if (!bucketId) throw new Error(`No existe el bucket ${bucket}`);

  sesion = { apiUrl: api.apiUrl, descarga: api.downloadUrl, token: j.authorizationToken, bucketId, bucket, hasta: Date.now() + 20 * 3600 * 1000 };

  return sesion;
}

async function llamaCon(s: { apiUrl: string; token: string }, metodo: string, cuerpo: unknown) {
  const r = await fetch(`${s.apiUrl}/b2api/v3/${metodo}`, {
    method: "POST",
    headers: { Authorization: s.token, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));

  if (!r.ok) throw new Error(`${metodo}: ${j.message ?? r.status}`);

  return j;
}

const llama = async (metodo: string, cuerpo: Record<string, unknown>) => llamaCon(await autoriza(), metodo, cuerpo);

/** Un fichero pequeño de una vez. Devuelve su fileId. */
export async function subeEntero(ruta: string, datos: Buffer, tipo: string) {
  const s = await autoriza();
  const subida = await llama("b2_get_upload_url", { bucketId: s.bucketId });
  const r = await fetch(subida.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: subida.authorizationToken,
      "X-Bz-File-Name": codifica(ruta),
      "Content-Type": tipo,
      "Content-Length": String(datos.length),
      "X-Bz-Content-Sha1": createHash("sha1").update(datos).digest("hex"),
    },
    body: new Uint8Array(datos),
  });
  const j = await r.json().catch(() => ({}));

  if (!r.ok) throw new Error(`Backblaze no guarda el vídeo: ${j.message ?? r.status}`);

  return String(j.fileId);
}

/** Abre un fichero grande (por trozos de ≥ 5 MB). Devuelve su fileId. */
export async function empiezaGrande(ruta: string, tipo: string) {
  const s = await autoriza();
  const j = await llama("b2_start_large_file", { bucketId: s.bucketId, fileName: ruta, contentType: tipo });

  return String(j.fileId);
}

/** Sube el trozo `n` (desde 1). Devuelve su sha1, que hace falta para cerrar. */
export async function subeTrozo(fileId: string, n: number, datos: Buffer) {
  const sha1 = createHash("sha1").update(datos).digest("hex");

  for (let intento = 0; intento < 3; intento += 1) {
    const subida = await llama("b2_get_upload_part_url", { fileId });
    const r = await fetch(subida.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: subida.authorizationToken,
        "X-Bz-Part-Number": String(n),
        "Content-Length": String(datos.length),
        "X-Bz-Content-Sha1": sha1,
      },
      body: new Uint8Array(datos),
    });

    if (r.ok) return sha1;

    const j = await r.json().catch(() => ({}));

    if (intento === 2 || (r.status < 500 && r.status !== 401 && r.status !== 408)) {
      throw new Error(`Backblaze no guarda el trozo ${n}: ${j.message ?? r.status}`);
    }
  }

  throw new Error(`Backblaze no guarda el trozo ${n}`);
}

export async function acabaGrande(fileId: string, sha1s: string[]) {
  await llama("b2_finish_large_file", { fileId, partSha1Array: sha1s });
}

/** Lee el fichero entero como corriente, con su tamaño. */
export async function lee(ruta: string) {
  const s = await autoriza();
  const r = await fetch(`${s.descarga}/file/${s.bucket}/${codifica(ruta)}`, { headers: { Authorization: s.token }, cache: "no-store" });

  if (!r.ok || !r.body) throw new Error(`Backblaze no da el vídeo (${r.status})`);

  return { cuerpo: r.body, bytes: Number(r.headers.get("content-length") ?? 0) };
}

/** Borra la versión guardada (y una grande a medias, si no se cerró). */
export async function borra(ruta: string, fileId: string) {
  try {
    await llama("b2_delete_file_version", { fileName: ruta, fileId });
  } catch {
    await llama("b2_cancel_large_file", { fileId }).catch(() => null);
  }
}
