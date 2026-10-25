/**
 * EL PASO DE MANO ENTRE LA PIZARRA Y EL LABORATORIO (25/10/2026).
 *
 * Ninguna de las dos pantallas escribe en el documento de la otra:
 *
 * - La pizarra (`abp-pizarra`, vía `useRemoteDoc` con su cola y su CAS) sólo
 *   la escribe la propia pizarra. El laboratorio le DEJA la diapositiva aquí
 *   y abre `/abp-pizarra?desdeLab=<token>`; es la pizarra la que, cuando el
 *   entrenador elige «nueva» o «sustituir», la mete con su `mutaTablero` de
 *   siempre (y así se deshace con Ctrl+Z como cualquier cambio).
 * - El laboratorio (`abp-laboratorio`, por `/api/abp-lab/guardar`) sólo lo
 *   escribe el laboratorio. La pizarra le deja la diapositiva y abre
 *   `/laboratorio/abp?desdePizarra=<token>&partido=…&diapositiva=…`.
 *
 * El recado va en `localStorage` (mismo origen, sobrevive a la pestaña nueva)
 * y se borra al recogerlo. Si no está —otro aparato, almacenamiento bloqueado—,
 * el laboratorio relee la diapositiva del documento de la pizarra por
 * `partido` y `diapositiva`, que van en la dirección.
 */

import type { SlidePizarra } from "@/lib/abp/pizarra";

const PREFIJO = "rmcf-puente-abp:";

/** Un recado de más de un día ya no lo va a recoger nadie. */
const CADUCA_MS = 24 * 60 * 60 * 1000;

/** De la pizarra al laboratorio. */
export type TraidaDePizarra = {
  tipo: "traida";
  creado: string;
  partidoId: string;
  rival: string;
  jornada?: string;
  fecha?: string;
  slide: SlidePizarra;
  /** Nombre y dorsal de cada jugador de la diapositiva. */
  jugadores: [string, { nombre: string; dorsal?: number }][];
};

/** Del laboratorio a la pizarra. */
export type EnvioAPizarra = {
  tipo: "envio";
  creado: string;
  rutinaId?: string;
  nombre: string;
  slide: SlidePizarra;
  /** La diapositiva de la que salió la rutina, si salió de una: es la que se propone sustituir. */
  destino?: { partidoId: string; slideId: string };
  /** La huella de esa diapositiva al traerla: si ya no coincide, alguien la ha cambiado en la pizarra. */
  huellaOrigen?: string;
  /** Es una variante: se propone añadirla como nueva, no sustituir la madre. */
  variante?: boolean;
  /** Papeles sin jugador: en la pizarra sólo van sus flechas. */
  sinJugador: number;
};

export type Recado = TraidaDePizarra | EnvioAPizarra;

function almacen(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Limpia los recados viejos que nadie recogió. */
function poda(s: Storage, ahora: number) {
  try {
    for (let i = s.length - 1; i >= 0; i -= 1) {
      const clave = s.key(i);

      if (!clave?.startsWith(PREFIJO)) continue;

      const creado = Date.parse((JSON.parse(s.getItem(clave) ?? "{}") as { creado?: string }).creado ?? "");

      if (!Number.isFinite(creado) || ahora - creado > CADUCA_MS) s.removeItem(clave);
    }
  } catch {
    /* Un recado ilegible no impide dejar otro. */
  }
}

/** Deja un recado y devuelve su token, o null si el navegador no deja guardar. */
export function dejaRecado(recado: Recado): string | null {
  const s = almacen();

  if (!s) return null;

  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  try {
    poda(s, Date.now());
    s.setItem(PREFIJO + token, JSON.stringify(recado));

    return token;
  } catch {
    return null;
  }
}

/** Lee un recado sin borrarlo (React puede montar dos veces en desarrollo). */
export function leeRecado<T extends Recado["tipo"]>(token: string, tipo: T): Extract<Recado, { tipo: T }> | null {
  const s = almacen();

  if (!s || !/^[a-z0-9]{6,30}$/.test(token)) return null;

  try {
    const r = JSON.parse(s.getItem(PREFIJO + token) ?? "null") as Recado | null;

    return r && r.tipo === tipo && r.slide && Array.isArray(r.slide.fichas) ? (r as Extract<Recado, { tipo: T }>) : null;
  } catch {
    return null;
  }
}

export function borraRecado(token: string) {
  try {
    almacen()?.removeItem(PREFIJO + token);
  } catch {
    /* Ya caducará. */
  }
}
