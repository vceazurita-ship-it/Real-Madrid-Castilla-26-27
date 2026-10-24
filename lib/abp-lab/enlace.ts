/**
 * COMPARTIR UNA RUTINA CON UN ENLACE (laboratorio de ABP, 24/10/2026).
 *
 * La rutina viaja entera en el propio enlace, detrás de la almohadilla
 * (`/laboratorio/abp#rutina=…`): no se guarda en ningún sitio ni pasa por el
 * servidor, y quien lo abre la ve en el taller como borrador, sin guardar.
 * Va comprimida (deflate) cuando el navegador sabe; si no, en claro. Al
 * leerla pasa por `rutinaDe`, el mismo filtro que la API del laboratorio.
 * El enlace sólo se abre con sesión de administrador, como el laboratorio.
 */

import { rutinaDe, type Rutina } from "@/lib/abp-lab/modelo";

export const CLAVE_ENLACE = "rutina";

/** Lo que viaja: el dibujo y la idea, no el progreso ni los usos (son de nuestra biblioteca). */
const CAMPOS = ["nombre", "tipo", "lado", "contra", "senal", "idea", "roles", "variantes", "balon", "envio", "inspiracion"] as const;

const aBase64 = (bytes: Uint8Array) => {
  let bin = "";

  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));

  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const deBase64 = (texto: string) => {
  const bin = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));

  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const pasaPor = async (bytes: Uint8Array, flujo: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(flujo)).arrayBuffer());

/** El enlace que abre esta rutina en el taller de quien lo reciba. */
export async function enlaceDe(r: Partial<Rutina> & Pick<Rutina, "nombre">, origen: string): Promise<string> {
  const datos = Object.fromEntries(CAMPOS.filter((k) => r[k] !== undefined && r[k] !== "").map((k) => [k, r[k]]));

  const bytes = new TextEncoder().encode(JSON.stringify(datos));

  const carga = typeof CompressionStream !== "undefined" ? `z${aBase64(await pasaPor(bytes, new CompressionStream("deflate-raw")))}` : `j${aBase64(bytes)}`;

  return `${origen}/laboratorio/abp#${CLAVE_ENLACE}=${carga}`;
}

/** La rutina de un enlace (el `hash` de la dirección), ya filtrada; null si no trae ninguna o no se entiende. */
export async function rutinaDeEnlace(hash: string): Promise<Rutina | null> {
  const carga = new URLSearchParams(hash.replace(/^#/, "")).get(CLAVE_ENLACE);

  if (!carga || carga.length > 60_000) return null;

  try {
    const bytes = carga[0] === "z" ? await pasaPor(deBase64(carga.slice(1)), new DecompressionStream("deflate-raw")) : deBase64(carga.slice(1));

    const datos = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;

    /* Llega como idea nueva: sin id, sin progreso, sin usos. */
    return rutinaDe({ ...datos, id: undefined, estado: "idea", progreso: [], usos: [] }, new Date().toISOString());
  } catch {
    return null;
  }
}
