/**
 * SUBIDAS A YOUTUBE APLAZADAS POR LA CUOTA (11/11/2026).
 *
 * La cuota diaria de la API de YouTube es del proyecto de Google y se va en
 * unas pocas subidas (unificado + cortes sueltos). Cuando se acaba, YouTube no
 * abre la subida («exceeded your quota»). Antes el vídeo se quedaba sólo en la
 * descarga del analista; ahora:
 *
 *   1. El navegador manda el vídeo por trozos de 16 MB a `/api/youtube/aplazada`
 *      y el servidor lo guarda en Backblaze (`youtube-aplazadas/<id>.<ext>`).
 *   2. Queda en el documento `secreto:youtube-aplazadas` con su título,
 *      descripción, privacidad, lista y, si es de un jugador del rival, a qué
 *      ficha va el enlace.
 *   3. Cada 10 min (los visionados que llama la web despierta) el servidor
 *      prueba UNO: abre la subida en YouTube y le pasa el vídeo leído de
 *      Backblaze sin cargarlo en memoria. Si no hay cuota, espera una hora.
 *      Al subir: lo mete en su lista, pone el enlace en la ficha y borra la
 *      copia de Backblaze.
 *
 * Google renueva la cuota a medianoche del Pacífico (las 9:00 en Madrid).
 */

import { readDoc, writeDoc } from "@/lib/docStore";
import { acabaGrande, borra, empiezaGrande, lee, subeEntero, subeTrozo } from "@/lib/almacen/b2-servidor";
import {
  abreSubida,
  apuntaPendienteLista,
  dameAcceso,
  esCuotaAgotada,
  leeAjustes,
  meteEnLista,
  type PrivacidadYoutube,
} from "@/lib/coding/youtube";

export const CLAVE_APLAZADAS = "secreto:youtube-aplazadas";
export const TROZO_BYTES = 16 * 1024 * 1024;

export type Aplazada = {
  id: string;
  ruta: string;
  fileId: string;
  grande: boolean;
  sha1s: string[];
  bytes: number;
  tipo: string;
  titulo: string;
  descripcion: string;
  privacidad: PrivacidadYoutube;
  listaId: string;
  listaNombre: string;
  estado: "subiendo" | "guardado" | "subido";
  creado: string;
  intentos: number;
  proximoIntento?: string;
  ultimoError?: string;
  url?: string;
  subidoEn?: string;
  ficha?: { jugadorId: string; nombre: string };
};

type Doc = { videos: Aplazada[]; enCurso?: { id: string; desde: string } };

async function leeDoc(): Promise<Doc> {
  const { data } = await readDoc<Doc>(CLAVE_APLAZADAS);

  return { videos: data?.videos ?? [], enCurso: data?.enCurso };
}

async function cambia(id: string, cambio: (v: Aplazada) => Aplazada | null, extra?: Partial<Doc>) {
  const doc = await leeDoc();
  const videos = doc.videos.flatMap((v) => {
    if (v.id !== id) return [v];

    const nuevo = cambio(v);

    return nuevo ? [nuevo] : [];
  });

  await writeDoc(CLAVE_APLAZADAS, "coding", { ...doc, ...extra, videos });

  return videos.find((v) => v.id === id) ?? null;
}

/** Lo que ve el panel: cuántos esperan y cuáles se subieron hace poco. */
export async function resumenAplazadas() {
  const { videos } = await leeDoc();

  return {
    esperando: videos.filter((v) => v.estado === "guardado").length,
    subidos: videos.filter((v) => v.estado === "subido").slice(-5).map((v) => ({ titulo: v.titulo, url: v.url ?? "", subidoEn: v.subidoEn ?? "" })),
  };
}

/** Paso 1: abre la copia. */
export async function empiezaAplazada(o: { bytes: number; tipo: string; titulo: string; descripcion: string }) {
  const ajustes = await leeAjustes();
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const extension = /webm/i.test(o.tipo) ? "webm" : /quicktime/i.test(o.tipo) ? "mov" : "mp4";
  const ruta = `youtube-aplazadas/${id}.${extension}`;
  const grande = o.bytes > TROZO_BYTES;
  const fileId = grande ? await empiezaGrande(ruta, o.tipo) : "";

  const nueva: Aplazada = {
    id,
    ruta,
    fileId,
    grande,
    sha1s: [],
    bytes: o.bytes,
    tipo: o.tipo,
    titulo: o.titulo,
    descripcion: o.descripcion,
    privacidad: ajustes.privacidad,
    listaId: ajustes.listaId,
    listaNombre: ajustes.listaNombre,
    estado: "subiendo",
    creado: new Date().toISOString(),
    intentos: 0,
  };
  const doc = await leeDoc();

  /* Las a medias de hace más de un día se olvidan (y se borran de Backblaze). */
  const viejas = doc.videos.filter((v) => v.estado === "subiendo" && Date.now() - Date.parse(v.creado) > 24 * 3600 * 1000);

  for (const v of viejas) await borra(v.ruta, v.fileId).catch(() => null);

  await writeDoc(CLAVE_APLAZADAS, "coding", {
    ...doc,
    videos: [...doc.videos.filter((v) => !viejas.includes(v)), nueva],
  });

  return { id, trozo: TROZO_BYTES };
}

/** Paso 2: un trozo (n desde 1). Con un solo trozo se guarda entero. */
export async function trozoAplazada(id: string, n: number, datos: Buffer) {
  const { videos } = await leeDoc();
  const v = videos.find((x) => x.id === id);

  if (!v || v.estado !== "subiendo") throw new Error("Esa copia ya no está abierta");

  if (!v.grande) {
    const fileId = await subeEntero(v.ruta, datos, v.tipo);

    await cambia(id, (x) => ({ ...x, fileId, sha1s: ["entero"] }));

    return;
  }

  const sha1 = await subeTrozo(v.fileId, n, datos);

  await cambia(id, (x) => {
    const sha1s = [...x.sha1s];

    sha1s[n - 1] = sha1;

    return { ...x, sha1s };
  });
}

/** Paso 3: se cierra y queda esperando cuota. `ficha` es a quién va el enlace. */
export async function acabaAplazada(id: string, ficha?: Aplazada["ficha"]) {
  const { videos } = await leeDoc();
  const v = videos.find((x) => x.id === id);

  if (!v) throw new Error("Esa copia no existe");

  if (v.grande) {
    const partes = Math.ceil(v.bytes / TROZO_BYTES);

    if (v.sha1s.length !== partes || v.sha1s.some((s) => !s)) throw new Error("Faltan trozos del vídeo");

    await acabaGrande(v.fileId, v.sha1s);
  }

  await cambia(id, (x) => ({ ...x, estado: "guardado", ...(ficha ? { ficha } : {}) }));
}

const ORIGEN = (process.env.RENDER_EXTERNAL_URL || "https://rmcf-castilla.onrender.com").replace(/\/$/, "");

/** El enlace en la ficha del jugador del rival, como hace el coding al subir. */
async function ponEnFicha(ficha: NonNullable<Aplazada["ficha"]>, url: string) {
  const fila = await fetch(`${ORIGEN}/api/rivals?action=rivalesPlantillas&jugador=${encodeURIComponent(ficha.jugadorId)}&fresco=1`, { cache: "no-store" }).then((r) =>
    r.ok ? r.json() : null,
  );

  if (!fila || typeof fila !== "object" || Array.isArray(fila)) return;

  await fetch(`${ORIGEN}/api/rivals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "guardarRivalJugador", player: { ...fila, VIDEO: url } }),
  });
}

const enUnaHora = () => new Date(Date.now() + 3600 * 1000).toISOString();

/**
 * Sube a YouTube la primera que espera. Una por llamada; nunca dos a la vez
 * (el candado vale 3 h por si el servidor se reinicia a mitad).
 */
export async function procesaAplazadas() {
  const doc = await leeDoc();

  if (doc.enCurso && Date.now() - Date.parse(doc.enCurso.desde) < 3 * 3600 * 1000) return;

  const ahora = Date.now();
  const v = doc.videos.find((x) => x.estado === "guardado" && (!x.proximoIntento || Date.parse(x.proximoIntento) <= ahora));

  if (!v) return;

  await writeDoc(CLAVE_APLAZADAS, "coding", { ...doc, enCurso: { id: v.id, desde: new Date().toISOString() } });

  try {
    const ajustes = await leeAjustes();
    const acceso = await dameAcceso(ajustes);
    const sesion = await abreSubida({ acceso, titulo: v.titulo, descripcion: v.descripcion, privacidad: v.privacidad, bytes: v.bytes, tipo: v.tipo });
    const { cuerpo } = await lee(v.ruta);

    const respuesta = await fetch(sesion, {
      method: "PUT",
      headers: { "Content-Type": v.tipo, "Content-Length": String(v.bytes) },
      body: cuerpo,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const datos = (await respuesta.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;

    if (!respuesta.ok || !datos?.id) throw new Error(datos?.error?.message ?? `YouTube respondió ${respuesta.status}`);

    const url = `https://youtu.be/${datos.id}`;

    if (v.listaId) {
      try {
        await meteEnLista(acceso, v.listaId, datos.id);
      } catch (error) {
        if (esCuotaAgotada(error instanceof Error ? error.message : "")) {
          await apuntaPendienteLista({ videoId: datos.id, listaId: v.listaId, listaNombre: v.listaNombre });
        }
      }
    }

    if (v.ficha) await ponEnFicha(v.ficha, url).catch(() => null);

    await borra(v.ruta, v.fileId).catch(() => null);

    const fin = await leeDoc();
    const subidos = fin.videos.filter((x) => x.estado === "subido" && x.id !== v.id);

    await writeDoc(CLAVE_APLAZADAS, "coding", {
      videos: [
        ...fin.videos.filter((x) => x.estado !== "subido" && x.id !== v.id),
        ...subidos.slice(-19),
        { ...v, estado: "subido", url, subidoEn: new Date().toISOString(), proximoIntento: undefined, ultimoError: undefined },
      ],
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Fallo al subir";

    await cambia(
      v.id,
      (x) => ({
        ...x,
        intentos: x.intentos + 1,
        ultimoError: mensaje,
        /* Sin cuota, dentro de una hora; otro fallo, en 30 min. */
        proximoIntento: esCuotaAgotada(mensaje) ? enUnaHora() : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
      { enCurso: undefined },
    );
  }
}
