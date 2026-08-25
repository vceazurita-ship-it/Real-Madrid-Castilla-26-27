/*
|--------------------------------------------------------------------------
| ONCE TITULAR PROBABLE DEL RIVAL
|--------------------------------------------------------------------------
|
| Marcar quién sale de inicio y de quién se duda es trabajo de análisis, no un
| dato del club: cambia el jueves y otra vez el sábado por la mañana. No cabe
| en la hoja de Google —escribe por nombre de columna y no se pueden añadir
| columnas desde aquí— así que vive en `app_documents`, un documento por
| equipo, y se guarda solo.
|
| La clave del jugador **no** es su `ID_JUGADOR`: la hoja los renumera cuando
| se dan altas y bajas, y el once entero se descolocaría. Se usa la misma
| identidad que las estadísticas: el id de resfu escondido en la URL de la
| foto y, para las filas sin foto, equipo + nombre.
*/

import { slugClave } from "@/lib/rivals/media";
import { nameKey, resfuId } from "@/lib/rivals/stats";

export type OnceEstado = "titular" | "duda" | null;

export interface RivalOnceDoc {
  /** Claves de jugador que salen de inicio. */
  titulares: string[];
  /** Claves de jugador en duda para el once. */
  dudas: string[];
}

export const ONCE_VACIO: RivalOnceDoc = { titulares: [], dudas: [] };

export const RIVAL_ONCE_KIND = "rival-once";

/** Un once por equipo: la clave sale del nombre, que es lo estable aquí. */
export function rivalOnceKey(equipo: unknown): string {
  return `rival-once:${slugClave(equipo)}`;
}

/** Identidad estable de un jugador rival entre recargas de la hoja. */
export function playerKey(player: {
  FOTO?: unknown;
  NOMBRE_EQUIPO?: unknown;
  JUGADOR?: unknown;
}): string {
  const porFoto = resfuId(player.FOTO);

  if (porFoto) return `bs:${porFoto}`;

  return `nm:${nameKey(player.NOMBRE_EQUIPO, player.JUGADOR)}`;
}

export function normalizarOnce(data: unknown): RivalOnceDoc {
  const bruto = (data ?? {}) as Partial<RivalOnceDoc>;

  const lista = (valor: unknown): string[] =>
    Array.isArray(valor)
      ? valor.filter((item): item is string => typeof item === "string")
      : [];

  const titulares = lista(bruto.titulares);

  /* Un jugador no puede ser titular y duda a la vez; si el documento llega
     así (dos pestañas a la vez), manda titular. */
  const dudas = lista(bruto.dudas).filter((key) => !titulares.includes(key));

  return { titulares, dudas };
}

export function estadoDe(doc: RivalOnceDoc, key: string): OnceEstado {
  if (doc.titulares.includes(key)) return "titular";
  if (doc.dudas.includes(key)) return "duda";

  return null;
}

/** Sin balón que malinterpretar: titular → duda → fuera → titular. */
export function siguienteEstado(actual: OnceEstado): OnceEstado {
  if (actual === null) return "titular";
  if (actual === "titular") return "duda";

  return null;
}

export function conEstado(
  doc: RivalOnceDoc,
  key: string,
  estado: OnceEstado
): RivalOnceDoc {
  const titulares = doc.titulares.filter((item) => item !== key);
  const dudas = doc.dudas.filter((item) => item !== key);

  if (estado === "titular") titulares.push(key);
  if (estado === "duda") dudas.push(key);

  return { titulares, dudas };
}

/** Cuántos hay marcados, para el contador del campograma. */
export function resumenOnce(doc: RivalOnceDoc) {
  return { titulares: doc.titulares.length, dudas: doc.dudas.length };
}

export const ONCE_COLOR: Record<"titular" | "duda", string> = {
  titular: "#34D399",
  duda: "#FBBF24",
};

export const ONCE_ETIQUETA: Record<"titular" | "duda", string> = {
  titular: "Titular",
  duda: "Duda",
};
