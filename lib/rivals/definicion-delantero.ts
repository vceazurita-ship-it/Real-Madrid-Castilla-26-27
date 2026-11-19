/**
 * CÓMO DEFINE UN DELANTERO RIVAL (19/11/2026, idea de X).
 *
 * Para delanteros y mediapuntas de la ficha de /rivals: dónde cae en la nube
 * de goles/90 frente a xG/90 de los delanteros de la categoría, su xG medio
 * por remate y qué parte de sus remates sale de fuera del área. Distingue al
 * que hay que dejar sin espacio DENTRO del área del que hace daño también
 * desde fuera.
 *
 * Todo sale de Opta y de una sola fuente para que la nube y el punto se
 * puedan comparar:
 * - `opta:remates` (cada remate de la categoría, con x/y y xG): goles, xG,
 *   remates y los de fuera del área, por tirador (`tiradorId`). SIN PENALTIS:
 *   un penalti vale 0,76 de xG y lo tira quien lo tira, no dice cómo define.
 * - `opta:jugadores`: minutos y puesto (el más repetido, `gameDetailedPosition`).
 *
 * «Fuera del área» = el remate no está en el rectángulo del área de Opta
 * (`enArea`: x ≥ 83 y entre 21,1 y 78,9 de ancho).
 */

import { num, type Celda } from "@/lib/opta";
import { enArea, type Remate } from "@/lib/opta-eventos";
import { puestoOpta } from "@/lib/opta-ficha";

type Fila = Record<string, Celda>;

/** En la nube entran los delanteros con al menos esto (cinco partidos enteros). */
export const MINUTOS_NUBE = 450;
/** Para leer al jugador, tres partidos enteros, como el resto de la ficha. */
export const MINUTOS_LEER = 270;
/** Con menos remates, la etiqueta no se pone: dos tiros de lejos no son un hábito. */
export const REMATES_ETIQUETA = 8;
/** Para las referencias de la categoría (mediana de xG por remate y de % de fuera). */
const REMATES_REFERENCIA = 10;

export type Etiqueta = "define" | "ocasiones" | "lejos" | "esperado";

export const ETIQUETAS: Record<Etiqueta, { texto: string; orden: string }> = {
  define: {
    texto: "Define por encima de lo esperado",
    orden: "Una ocasión le basta: ni medio metro de ventaja dentro del área.",
  },
  ocasiones: {
    texto: "Necesita ocasiones claras",
    orden: "Dejarle sin espacio dentro del área: desde fuera apenas hace daño.",
  },
  lejos: {
    texto: "Tira de lejos",
    orden: "No basta con cerrar el área: salirle al borde y que no se perfile.",
  },
  esperado: {
    texto: "Marca lo que dicen sus ocasiones",
    orden: "Ni las falla ni las inventa: el peligro es el que se le deje.",
  },
};

export type PuntoDelantero = {
  playerId: string;
  jugador: string;
  equipo: string;
  minutos: number;
  goles: number;
  xg: number;
  goles90: number;
  xg90: number;
  remates: number;
  fuera: number;
};

export type DefinicionDelantero = {
  yo: PuntoDelantero;
  /** El texto de su puesto en Opta («Delantero», «Mediapunta»). */
  puesto: string;
  /** Los delanteros de la categoría con 450′ o más (sin él). */
  nube: PuntoDelantero[];
  xgPorRemate: number | null;
  pctFuera: number | null;
  /** Medianas de los delanteros de la nube con 10 remates o más. */
  medianaXgPorRemate: number | null;
  medianaPctFuera: number | null;
  /** Cuartil alto del % de fuera: desde aquí «tira de lejos». */
  p75PctFuera: number | null;
  etiqueta: Etiqueta | null;
  /** Por qué esa etiqueta, con su cifra. */
  porque: string;
  muestraCorta: boolean;
};

const esPenalti = (r: Remate) => r.tipo === "PenaltyGoal" || r.situacion === "Penalty";

const mediana = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const cuantil = (v: number[], q: number) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

/** Delantero o mediapunta (no un extremo): para ellos sale el bloque. */
export function esDelanteroOMediapunta(puesto: Celda | undefined) {
  const p = String(puesto ?? "");
  return puestoOpta(p) === "DEL" || /attacking midfielder|second striker/i.test(p);
}

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

/** Los tiros sin penaltis de toda la categoría, por tirador. */
export function rematesPorTirador(remates: Remate[]) {
  const por = new Map<string, { goles: number; xg: number; remates: number; fuera: number }>();
  for (const r of remates) {
    if (!r.tiradorId || esPenalti(r)) continue;
    const a = por.get(r.tiradorId) ?? { goles: 0, xg: 0, remates: 0, fuera: 0 };
    a.remates += 1;
    a.xg += r.xG;
    if (r.gol) a.goles += 1;
    if (!enArea(r.x, r.y)) a.fuera += 1;
    por.set(r.tiradorId, a);
  }
  return por;
}

function punto(f: Fila, tiros: ReturnType<typeof rematesPorTirador>): PuntoDelantero | null {
  const playerId = String(f.playerId ?? "");
  const minutos = num(f.Min) ?? 0;
  if (!playerId || !(minutos > 0)) return null;
  const t = tiros.get(playerId) ?? { goles: 0, xg: 0, remates: 0, fuera: 0 };
  return {
    playerId,
    jugador: String(f.jugador ?? ""),
    equipo: String(f.equipo ?? ""),
    minutos: Math.round(minutos),
    goles: t.goles,
    xg: t.xg,
    goles90: (t.goles / minutos) * 90,
    xg90: (t.xg / minutos) * 90,
    remates: t.remates,
    fuera: t.fuera,
  };
}

/**
 * La lectura de un jugador (`fila`, su entrada de `opta:jugadores`) contra los
 * delanteros de la categoría. `null` si no es delantero ni mediapunta.
 */
export function definicionDelantero(
  fila: Fila,
  jugadores: Fila[],
  tiros: ReturnType<typeof rematesPorTirador>,
  puestoTexto: (p: string) => string = (p) => p,
): DefinicionDelantero | null {
  if (!esDelanteroOMediapunta(fila.puesto)) return null;
  const yo = punto(fila, tiros);
  if (!yo) return null;

  const nube = jugadores
    .filter((f) => String(f.playerId ?? "") !== yo.playerId && puestoOpta(f.puesto) === "DEL" && (num(f.Min) ?? 0) >= MINUTOS_NUBE)
    .map((f) => punto(f, tiros))
    .filter((p): p is PuntoDelantero => p != null);

  const conTiros = nube.filter((p) => p.remates >= REMATES_REFERENCIA);
  const medianaXgPorRemate = mediana(conTiros.map((p) => p.xg / p.remates));
  const pctsFuera = conTiros.map((p) => (p.fuera / p.remates) * 100);
  const medianaPctFuera = mediana(pctsFuera);
  const p75PctFuera = cuantil(pctsFuera, 0.75);

  const xgPorRemate = yo.remates ? yo.xg / yo.remates : null;
  const pctFuera = yo.remates ? (yo.fuera / yo.remates) * 100 : null;
  const muestraCorta = yo.minutos < MINUTOS_LEER;

  let etiqueta: Etiqueta | null = null;
  let porque = "";
  const dif = yo.goles - yo.xg;

  if (muestraCorta) {
    porque = `Lleva ${yo.minutos}′: con menos de ${MINUTOS_LEER} no se le etiqueta.`;
  } else if (yo.remates < REMATES_ETIQUETA || xgPorRemate == null || pctFuera == null) {
    porque = `${yo.remates} ${yo.remates === 1 ? "remate" : "remates"} sin penaltis: con menos de ${REMATES_ETIQUETA} no se le etiqueta.`;
  } else if (pctFuera >= 40 && p75PctFuera != null && pctFuera >= p75PctFuera) {
    etiqueta = "lejos";
    porque = `${Math.round(pctFuera)} % de sus remates, de fuera del área (la mitad de los delanteros, ${Math.round(medianaPctFuera ?? 0)} % o menos).`;
  } else if (yo.goles >= 3 && dif >= 1 && yo.goles >= yo.xg * 1.3) {
    etiqueta = "define";
    porque = `${yo.goles} goles con ${coma(yo.xg, 1)} de xG: ${coma(dif, 1)} más de lo que daban sus ocasiones.`;
  } else if (medianaXgPorRemate != null && xgPorRemate >= medianaXgPorRemate && (medianaPctFuera == null || pctFuera <= medianaPctFuera)) {
    etiqueta = "ocasiones";
    porque = `${coma(xgPorRemate)} de xG por remate (mediana de los delanteros, ${coma(medianaXgPorRemate)}) y sólo el ${Math.round(pctFuera)} % desde fuera.`;
  } else {
    etiqueta = "esperado";
    porque = `${yo.goles} ${yo.goles === 1 ? "gol" : "goles"} con ${coma(yo.xg, 1)} de xG y ${coma(xgPorRemate)} por remate: ni muy por encima ni muy por debajo de lo que valen sus tiros.`;
  }

  return {
    yo,
    puesto: puestoTexto(String(fila.puesto ?? "")),
    nube,
    xgPorRemate,
    pctFuera,
    medianaXgPorRemate,
    medianaPctFuera,
    p75PctFuera,
    etiqueta,
    porque,
    muestraCorta,
  };
}
