/**
 * OPTA EN EL LABORATORIO DE PARTIDO Y EN LA PORTADA (10/11/2026).
 *
 * Robos, pérdidas y faltas se cuentan a mano partido a partido (vídeo y
 * timeline de Hudl). Opta añade lo que el vídeo no da: **cómo está el
 * Castilla frente a su grupo** (puesto y percentil, por partido) y, del
 * partido elegido, sus cifras.
 *
 * LO QUE ES LA MISMA COSA Y LO QUE NO (comprobado con las copias de
 * `.cache/opta` el 10/11/2026, jornadas 2-11):
 *
 * - **Faltas: sí.** `FoulCom` / `FoulSuf` de `opta:partidos` son las faltas
 *   pitadas, igual que las etiquetadas: en 9 partidos difieren de 0 a 3
 *   (Águilas 16/4 y 16/4; Alcorcón 19/9 a mano, 16/8 en Opta).
 * - **Robos: no.** `Recovery` de Opta es SÓLO el evento «BallRecovery» (un
 *   balón suelto o que el rival nos da); las intercepciones y las entradas
 *   ganadas van aparte. `PosWonD3rd + PosWonM3rd + PosWonA3rd = Recovery` en
 *   todos los partidos, por tercios (33,3 / 66,7). El robo contado a mano es
 *   el activo (entrada, intercepción o balón ganado apretando).
 * - **Pérdidas: no.** `PossLost` (≈110 por partido) cuenta cada pase que no
 *   llega, cada regate perdido y cada balón robado, salga o no el balón del
 *   campo; a mano (≈60) sólo el balón que pasa a ser del rival en juego.
 *   `PsLostD3 + PsLostM3 + PsLostA3 = PossLost`.
 *
 * Funciones puras (ni fetch ni estado) para poder probarlas en Node.
 */

import { CASTILLA_OPTA, num, type MetaOpta, type MetricaOpta } from "@/lib/opta";
import { enAmbito, fechaCorta, partidosDe, posicionEn, valorEquipo, type Fila, type PartidoEquipo, type Posicion } from "@/lib/opta-analisis";
import { casaEquipo } from "@/lib/opta-eventos";
import { defMetrica } from "@/lib/opta-nombres";

export type ModoLab = "robos" | "perdidas" | "faltas";

export type MetricaLab = { a: string; nombre: string; comoLeer: string };

/** Las métricas de equipo de cada pantalla del laboratorio, todas por partido. */
export const METRICAS_LAB: Record<ModoLab, MetricaLab[]> = {
  robos: [
    {
      a: "Recovery",
      nombre: "Recuperaciones",
      comoLeer: "Balones sueltos, o que el rival nos da, que nos quedamos (la «recuperación» de Opta). Las intercepciones y las entradas ganadas no van aquí.",
    },
    { a: "PosWonA3rd", nombre: "Recuperaciones en el último tercio", comoLeer: "Las mismas recuperaciones, sólo las del tercio de campo más cercano a la portería rival." },
    { a: "PosWonM3rd", nombre: "Recuperaciones en el tercio medio", comoLeer: "Las recuperaciones del tercio del medio." },
    { a: "PosWonD3rd", nombre: "Recuperaciones en el propio tercio", comoLeer: "Las recuperaciones de nuestro tercio. Es estilo: quien defiende más abajo recupera más aquí." },
    { a: "Int", nombre: "Intercepciones", comoLeer: "Pases del rival cortados." },
    { a: "PPDA", nombre: "PPDA", comoLeer: "Pases que se le dejan dar al rival por cada acción defensiva nuestra: cuanto más bajo, más se presiona." },
  ],
  perdidas: [
    {
      a: "PossLost",
      nombre: "Pérdidas",
      comoLeer: "Cada pase que no llega a un compañero, regate perdido o balón robado, salga o no el balón del campo (la «pérdida» de Opta).",
    },
    { a: "PsLostD3", nombre: "Pérdidas en el propio tercio", comoLeer: "Las mismas pérdidas, sólo las de nuestro tercio, las de más riesgo." },
    { a: "PsLostM3", nombre: "Pérdidas en el tercio medio", comoLeer: "Las pérdidas del tercio del medio." },
    { a: "PsLostA3", nombre: "Pérdidas en el último tercio", comoLeer: "Las pérdidas cerca del área rival. Es estilo: quien más ataca más pierde aquí." },
    { a: "Disposs", nombre: "Balones robados en conducción", comoLeer: "Veces que nos quitan el balón cuando lo llevamos." },
  ],
  faltas: [
    { a: "FoulCom", nombre: "Faltas cometidas", comoLeer: "Faltas que nos pitan (las «en contra» de la pantalla)." },
    { a: "FoulSuf", nombre: "Faltas recibidas", comoLeer: "Faltas que nos hacen (las «a favor» de la pantalla)." },
    { a: "Yellow", nombre: "Amarillas", comoLeer: "Tarjetas amarillas por partido." },
  ],
};

export type FilaLab = MetricaLab & { mejor: boolean | null; pos: Posicion };

/**
 * Un equipo frente a SU grupo (los 20 con los que juega), por partido.
 * Sin dato del equipo, la métrica no sale.
 */
export function contextoGrupo(
  equipos: Fila[],
  grupos: Map<string, number>,
  teamId: string,
  metricas: MetricaLab[],
  catalogo?: Map<string, MetricaOpta>,
): FilaLab[] {
  const grupoDel = grupos.get(teamId);
  /* El grupo del propio equipo (el del Castilla es el 1, el otro, el otro). */
  const delGrupo = equipos.filter((f) =>
    grupoDel === undefined ? enAmbito(f.teamId, grupos, "todos") : grupos.get(String(f.teamId ?? "")) === grupoDel,
  );
  const fila = delGrupo.find((f) => f.teamId === teamId);
  if (!fila) return [];
  const salida: FilaLab[] = [];
  for (const m of metricas) {
    const mejor = defMetrica(m.a, catalogo).mejor;
    const valor = valorEquipo(fila, m.a, "partido", catalogo);
    if (valor == null) continue;
    const pos = posicionEn(valor, delGrupo.map((f) => valorEquipo(f, m.a, "partido", catalogo)), mejor);
    salida.push({ ...m, mejor, pos });
  }
  return salida;
}

const dia = (fecha: string) => Date.parse(`${fecha.slice(0, 10)}T12:00:00Z`);

/**
 * El partido del Castilla en Opta que es el de la pantalla: mismo rival (por
 * nombre, con `casaEquipo`) y la fecha más cercana, a 4 días como mucho (el
 * etiquetado apunta a veces la fecha prevista y no la jugada: Sant Andreu,
 * 21/09 a mano y 23/09 en Opta). En la segunda vuelta habrá dos contra el
 * mismo rival: por eso la fecha.
 */
export function partidoOptaDe(partidos: Fila[], equipos: Fila[], rival: string, fecha: string): PartidoEquipo | null {
  const lista = equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
  const id = casaEquipo(rival, lista);
  if (!id || !fecha) return null;
  const objetivo = dia(fecha);
  if (!Number.isFinite(objetivo)) return null;
  let mejor: { p: PartidoEquipo; d: number } | null = null;
  for (const p of partidosDe(partidos, CASTILLA_OPTA)) {
    if (p.rivalId !== id) continue;
    const d = Math.abs(dia(p.fecha) - objetivo) / 86_400_000;
    if (d <= 4 && (!mejor || d < mejor.d)) mejor = { p, d };
  }
  return mejor?.p ?? null;
}

/** El teamId de Opta de un nombre de otra fuente (BeSoccer, el etiquetado). */
export function equipoOptaDe(nombre: string, equipos: Fila[]): string | null {
  if (!nombre) return null;
  return casaEquipo(
    nombre,
    equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") })),
  );
}

/** «8 nov»: hasta qué partido llegan los datos (el último de la descarga). */
export function hastaElPartido(meta: MetaOpta | null, partidos: Fila[]): string {
  const ultimo = meta?.temporada?.ultimoPartido || partidos.reduce((m, f) => (String(f.fecha ?? "") > m ? String(f.fecha ?? "") : m), "");
  return ultimo ? fechaCorta(ultimo) : "";
}

/** Una cifra de una fila de partido (null si no está). */
export const cifra = (f: Fila | null | undefined, a: string): number | null => (f ? num(f[a]) : null);
