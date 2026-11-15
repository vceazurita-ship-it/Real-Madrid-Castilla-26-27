/**
 * LOS PENALTIS DE CADA LANZADOR DEL RIVAL, PARA NUESTRO PORTERO (15/11/2026).
 *
 * Sale de `opta:penaltis` (ya de uno en uno y con su equipo por
 * `penaltisDe`): cada penalti que ha tirado alguien del rival, colocado en
 * una portería de seis zonas (izquierda, centro y derecha del LANZADOR × raso
 * o arriba) con GoalmouthY/Z. Los de fuera o al palo se ponen en la zona a la
 * que iban (el lado y la altura por donde cruzaron la línea de gol).
 *
 * La línea de cada ficha: el lado más repetido (si se repite: al menos dos y
 * más que los otros, `resumenPenaltis`) y si el último fue a otro sitio.
 * Separa esta temporada (desde el 1 de julio) de las anteriores.
 *
 * Sin datos aquí (el repo es público): sólo cuentas.
 */

import { aObjetos, DOCS_OPTA, traeOpta, type TablaOpta } from "@/lib/opta";
import {
  casaEquipo,
  LARGUERO,
  ladoDe,
  penaltisDe,
  pistaDe,
  resumenPenaltis,
  type Lado,
  type Penalti,
  type ResumenPenaltis,
} from "@/lib/opta-eventos";

/** La temporada en curso empieza aquí (la misma frontera que la proyección). */
export const DESDE_TEMPORADA_PENALTIS = "2026-07-01";

export type AlturaZona = "arriba" | "raso";

/** Una de las seis zonas: columna 0-2 de izquierda a derecha DEL LANZADOR, fila 0 arriba y 1 raso. */
export type ZonaPenalti = { col: 0 | 1 | 2; fila: 0 | 1 };

const COL: Record<Lado, 0 | 1 | 2> = { izquierda: 0, centro: 1, derecha: 2 };

export function zonaDe(p: Penalti): ZonaPenalti | null {
  const lado = ladoDe(p.gmY);
  if (!lado || p.gmZ == null) return null;
  return { col: COL[lado], fila: p.gmZ < LARGUERO / 2 ? 1 : 0 };
}

export const resultadoDe = (p: Penalti): "gol" | "parado" | "fuera" => (p.gol ? "gol" : p.parado ? "parado" : "fuera");

export type FichaLanzador = {
  tirador: string;
  tiradorId: string;
  /** «Diestro», «Zurdo» o vacío. */
  pie: string;
  /** Del más reciente al más antiguo. */
  esta: Penalti[];
  antes: Penalti[];
  resumen: ResumenPenaltis;
  /** El lado del último penalti (con sitio). */
  ultimo: Lado | null;
  /** true si el último fue a otro lado que el más repetido; null si no hay lado repetido. */
  cambio: boolean | null;
  /** La línea para el portero: lado más repetido y qué hizo en el último. */
  linea: string;
};

/** Visto por el LANZADOR y, entre paréntesis, por nuestro portero (que lo tiene enfrente). */
export const LADO_LANZADOR: Record<Lado, string> = { izquierda: "a su izquierda", centro: "al centro", derecha: "a su derecha" };
export const LADO_PORTERO: Record<Lado, string> = { izquierda: "tu derecha", centro: "al centro", derecha: "tu izquierda" };

const ambos = (l: Lado) => (l === "centro" ? "al centro" : `${LADO_LANZADOR[l]} (${LADO_PORTERO[l]})`);

function lineaDe(r: ResumenPenaltis, ultimo: Lado | null, n: number): string {
  if (!n) return "";
  if (n === 1) return ultimo ? `Un penalti: ${ambos(ultimo)}.` : "Un penalti.";
  const base = r.preferido ? `Lado más repetido: ${ambos(r.preferido)}, ${r.lados[r.preferido]} de ${n}.` : `${n} penaltis y no repite lado.`;
  if (!ultimo) return base;
  if (!r.preferido) return `${base} El último, ${ambos(ultimo)}.`;
  return ultimo === r.preferido ? `${base} El último, también.` : `${base} En el último cambió: ${ambos(ultimo)}.`;
}

const PIE: Record<string, string> = { "Right Foot": "Diestro", "Left Foot": "Zurdo" };

/** Las fichas de los lanzadores de `teamId`, de más a menos penaltis. */
export function fichasLanzadores(penaltis: Penalti[], teamId: string): FichaLanzador[] {
  const por = new Map<string, Penalti[]>();
  for (const p of penaltis) {
    if (p.teamId !== teamId || !p.tirador) continue;
    const k = p.tiradorId || p.tirador;
    por.set(k, [...(por.get(k) ?? []), p]);
  }
  return [...por.values()]
    .map((ps): FichaLanzador => {
      const orden = [...ps].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.minuto - a.minuto);
      const resumen = resumenPenaltis(orden);
      const ultimo = ladoDe(orden.find((p) => p.gmY != null)?.gmY ?? null);
      const pies = [...new Set(orden.map((p) => PIE[p.pie]).filter(Boolean))];
      return {
        tirador: orden[0].tirador,
        tiradorId: orden[0].tiradorId,
        pie: pies.join(" y "),
        esta: orden.filter((p) => p.fecha.slice(0, 10) >= DESDE_TEMPORADA_PENALTIS),
        antes: orden.filter((p) => p.fecha.slice(0, 10) < DESDE_TEMPORADA_PENALTIS),
        resumen,
        ultimo,
        cambio: resumen.preferido && ultimo ? ultimo !== resumen.preferido : null,
        linea: lineaDe(resumen, ultimo, orden.length),
      };
    })
    .sort((a, b) => b.resumen.n - a.resumen.n || (b.esta[0]?.fecha ?? "").localeCompare(a.esta[0]?.fecha ?? ""));
}

/** El equipo de Opta del rival (nombre de la hoja o de BeSoccer). */
export function equipoOptaDe(nombre: string, equipos: Record<string, unknown>[]): { teamId: string; equipo: string } | null {
  const lista = equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") })).filter((e) => e.teamId);
  const id = casaEquipo(nombre, lista);
  return id ? (lista.find((e) => e.teamId === id) ?? null) : null;
}

/** De los tres documentos de Opta a las fichas del rival. */
export function fichasDeDocs(nombre: string, docs: { penaltis: TablaOpta | null; equipos: TablaOpta | null; jugadores: TablaOpta | null }) {
  const equipos = aObjetos(docs.equipos);
  const equipo = equipoOptaDe(nombre, equipos);
  if (!equipo || !docs.penaltis) return { equipo, fichas: [] as FichaLanzador[] };
  const penaltis = penaltisDe(docs.penaltis, pistaDe(aObjetos(docs.jugadores), equipos));
  return { equipo, fichas: fichasLanzadores(penaltis, equipo.teamId) };
}

/** Para quien no monta la pantalla (el PDF del portero de la pizarra de ABP). */
export async function cargaFichasPenaltis(nombre: string): Promise<FichaLanzador[]> {
  const [penaltis, equipos, jugadores] = await Promise.all([
    traeOpta(DOCS_OPTA.penaltis),
    traeOpta(DOCS_OPTA.equipos),
    traeOpta(DOCS_OPTA.jugadores),
  ]);
  return fichasDeDocs(nombre, { penaltis, equipos, jugadores }).fichas;
}
