/**
 * POST DEL PARTIDO (10/11/2026): el mismo partido del Castilla en Opta y en
 * Wyscout, para que un solo selector mande sobre la puerta entera
 * (`components/data/PanelPostPartido.tsx`).
 *
 * Las dos fuentes no comparten clave. Opta da el partido por su id y su
 * fecha; Wyscout, por la fecha y el nombre del rival («Real Madrid Castilla -
 * Hércules 2:2»). Se ata por el RIVAL (el nombre de Wyscout pasado por
 * `casaEquipo`, que lo convierte en el teamId de Opta) y la FECHA más
 * cercana, a 4 días como mucho, igual que `partidoOptaDe` en
 * `lib/opta-laboratorio.ts`: en la segunda vuelta habrá dos contra el mismo
 * rival y por eso manda la fecha.
 *
 * Un partido que sólo está en una fuente se queda en la lista con la otra a
 * `null`: Opta se descarga el lunes y Wyscout publica el martes, y «Wyscout
 * aún no tiene este partido» es información, no un hueco. Lo de Wyscout que
 * no es liga (Copa) no entra: Opta no lo va a tener nunca.
 *
 * Funciones puras (ni fetch ni estado) para poder probarlas en Node.
 */

import type { FilaPartido } from "@/lib/data-analisis/leer";
import { temporadaDe } from "@/lib/data-analisis/metricas";
import { CASTILLA_OPTA } from "@/lib/opta";
import { partidosDe, type Fila, type PartidoEquipo } from "@/lib/opta-analisis";
import { casaEquipo } from "@/lib/opta-eventos";

/** Cómo llama Wyscout al Castilla. */
export const CASTILLA_WYSCOUT = "Real Madrid Castilla";

/** Días de diferencia que se toleran entre las fechas de las dos fuentes. */
export const DIAS_TOLERANCIA = 4;

export type PartidoPost = {
  /** Clave estable del selector: el id de Opta o, si no lo hay, `w|fecha|rival`. */
  clave: string;
  /** `2026-11-08`. */
  fecha: string;
  /** El rival como se enseña (el de Opta si está; si no, el de Wyscout). */
  rival: string;
  gf: number | null;
  gc: number | null;
  opta: PartidoEquipo | null;
  /** Nuestra fila de Wyscout de ese partido. */
  wyscout: FilaPartido | null;
  /** La fila del rival en ese mismo informe de Wyscout (las cifras «en contra»). */
  wyscoutContra: FilaPartido | null;
};

const dia = (fecha: string) => Date.parse(`${fecha.slice(0, 10)}T12:00:00Z`);
const distancia = (a: string, b: string) => Math.abs(dia(a) - dia(b)) / 86_400_000;

/** Nuestras filas de Wyscout de liga de una temporada, de la más antigua a la más reciente. */
export function castillaWyscout(filas: FilaPartido[], temporada: string): FilaPartido[] {
  return filas
    .filter((f) => f.equipo === CASTILLA_WYSCOUT && temporadaDe(f.fecha) === temporada && /primera/i.test(f.competicion))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Los partidos del Castilla de la temporada, cada uno con su lado de Opta y
 * su lado de Wyscout, del más reciente al más antiguo.
 */
export function emparejaPartidos(
  optaPartidos: Fila[],
  optaEquipos: Fila[],
  wyscout: FilaPartido[],
  temporada: string,
): PartidoPost[] {
  const lista = optaEquipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
  const nuestros = castillaWyscout(wyscout, temporada);
  const rivalOpta = new Map(nuestros.map((w) => [w, casaEquipo(w.rival, lista)] as const));
  const usados = new Set<FilaPartido>();
  const contraDe = (w: FilaPartido) => wyscout.find((c) => c.rival === CASTILLA_WYSCOUT && c.fecha === w.fecha && c.partido === w.partido) ?? null;

  const salida: PartidoPost[] = [];
  const opta = partidosDe(optaPartidos, CASTILLA_OPTA).filter((p) => p.otra && temporadaDe(p.fecha.slice(0, 10)) === temporada);
  for (const p of opta) {
    let mejor: { w: FilaPartido; d: number } | null = null;
    for (const w of nuestros) {
      if (usados.has(w) || rivalOpta.get(w) !== p.rivalId) continue;
      const d = distancia(w.fecha, p.fecha);
      if (d <= DIAS_TOLERANCIA && (!mejor || d < mejor.d)) mejor = { w, d };
    }
    if (mejor) usados.add(mejor.w);
    salida.push({
      clave: String(p.fila.partido),
      fecha: p.fecha.slice(0, 10),
      rival: p.rival,
      gf: p.gf,
      gc: p.gc,
      opta: p,
      wyscout: mejor?.w ?? null,
      wyscoutContra: mejor ? contraDe(mejor.w) : null,
    });
  }
  for (const w of nuestros) {
    if (usados.has(w)) continue;
    salida.push({
      clave: `w|${w.fecha}|${w.rival}`,
      fecha: w.fecha,
      rival: w.rival,
      gf: w.golesFavor,
      gc: w.golesContra,
      opta: null,
      wyscout: w,
      wyscoutContra: contraDe(w),
    });
  }
  return salida.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** La temporada del partido más reciente de cualquiera de las dos fuentes («2026/27»). */
export function temporadaVigente(optaPartidos: Fila[], wyscout: FilaPartido[]): string {
  let ultima = "";
  for (const f of optaPartidos) if (f.teamId === CASTILLA_OPTA && String(f.fecha ?? "") > ultima) ultima = String(f.fecha ?? "");
  for (const w of wyscout) if (w.equipo === CASTILLA_WYSCOUT && w.fecha > ultima) ultima = w.fecha;
  return ultima ? temporadaDe(ultima.slice(0, 10)) : "";
}

/**
 * Enlace a una pantalla del laboratorio con ese partido abierto: la pantalla
 * lo resuelve con `partidoEnlazado` (`lib/partido-enlazado.ts`).
 */
export function enlaceConPartido(ruta: string, p: Pick<PartidoPost, "fecha" | "rival">): string {
  const q = new URLSearchParams({ fecha: p.fecha, rival: p.rival });
  return `${ruta}?${q.toString()}`;
}
