/**
 * PARTIDO MODELO: QUIÉN YA LE HIZO DAÑO ROBÁNDOLE ALTO (19/11/2026, idea de X).
 *
 * Con el evento a evento de Opta (`opta:directo:<partido>`) de todos los
 * partidos de la temporada del rival, se mira lo que hizo el equipo que tuvo
 * enfrente:
 *
 * - Robo alto: recuperación («BallRecovery») o intercepción («Interception»)
 *   en el último tercio (x ≥ 66,7 de Opta, la misma raya de PosWonA3rd).
 * - Remate tras robo alto: remate de ese equipo (gol, fuera, parado o al
 *   palo) en la misma parte y en los 10 s siguientes a un robo alto. Cada
 *   remate cuenta una vez aunque haya dos robos antes.
 * - Partido modelo: el de más remates tras robo alto; a igualdad, más goles
 *   así y luego más robos altos. Con 0 remates no hay modelo.
 *
 * La referencia de la liga es PosWonA3rd de `opta:partidos` (balones ganados
 * en el último tercio por equipo y partido): la media de todos los partidos
 * del archivo y la que le hicieron al rival sus oponentes.
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import type { EventoDirecto } from "@/lib/opta-directo-mapas";

export const X_ALTO = 66.7;
export const VENTANA_S = 10;
const TIROS = new Set(["Goal", "Miss", "AttemptSaved", "Post"]);

export const esRoboAlto = (e: EventoDirecto) => (e.tipo === "BallRecovery" || e.tipo === "Interception") && e.x >= X_ALTO;

export type DanoRoboAlto = { robos: number; remates: number; goles: number };

/** Robos altos de `teamId` y los remates (y goles) suyos en los 10 s siguientes. */
export function danoRoboAlto(ev: EventoDirecto[], teamId: string): DanoRoboAlto {
  const robos = ev.filter((e) => e.teamId === teamId && esRoboAlto(e));
  let remates = 0;
  let goles = 0;
  for (const t of ev) {
    if (t.teamId !== teamId || !TIROS.has(t.tipo)) continue;
    const tras = robos.some((r) => r.parte === t.parte && t.segundo >= r.segundo && t.segundo - r.segundo <= VENTANA_S);
    if (!tras) continue;
    remates++;
    if (t.tipo === "Goal") goles++;
  }
  return { robos: robos.length, remates, goles };
}

export type FilaRoboAlto = DanoRoboAlto & {
  partido: string;
  fecha: string;
  /** El que tuvo enfrente el rival. */
  oponente: string;
  oponenteId: string;
  /** Goles del oponente y del rival en ese partido (null si el archivo no los trae). */
  golesOponente: number | null;
  golesRival: number | null;
  /** PosWonA3rd del oponente en ese partido (opta:partidos), si lo hay. */
  posWonA3rd: number | null;
};

export function resultado(f: FilaRoboAlto): { texto: string; signo: "G" | "E" | "P" } | null {
  if (f.golesOponente == null || f.golesRival == null) return null;
  const signo = f.golesOponente > f.golesRival ? "G" : f.golesOponente < f.golesRival ? "P" : "E";
  return { texto: `${f.golesOponente}-${f.golesRival}`, signo };
}

/** Ordenadas por remates tras robo alto (luego goles así, robos y fecha). */
export function ordena(filas: FilaRoboAlto[]): FilaRoboAlto[] {
  return [...filas].sort(
    (a, b) => b.remates - a.remates || b.goles - a.goles || b.robos - a.robos || b.fecha.localeCompare(a.fecha),
  );
}

export const modeloDe = (ordenadas: FilaRoboAlto[]) => (ordenadas[0] && ordenadas[0].remates > 0 ? ordenadas[0] : null);

export type Referencia = {
  /** Media de PosWonA3rd por equipo y partido en todo el archivo. */
  liga: number | null;
  /** La de los oponentes del rival en sus partidos. */
  contraRival: number | null;
  /** Robos altos por partido (evento a evento) de sus oponentes. */
  robosPorPartido: number | null;
};

const media = (v: number[]) => (v.length ? v.reduce((s, n) => s + n, 0) / v.length : null);

export function referencia(filas: FilaRoboAlto[], ligaPosWon: number[]): Referencia {
  return {
    liga: media(ligaPosWon),
    contraRival: media(filas.map((f) => f.posWonA3rd).filter((n): n is number => n != null)),
    robosPorPartido: media(filas.map((f) => f.robos)),
  };
}

/** La lectura de debajo de la tabla. */
export function lectura(rival: string, filas: FilaRoboAlto[], ref: Referencia): string | null {
  if (!filas.length) return null;
  const orden = ordena(filas);
  const modelo = modeloDe(orden);
  const totalRem = filas.reduce((s, f) => s + f.remates, 0);
  const conDano = filas.filter((f) => f.remates > 0).length;
  const uno = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const partes: string[] = [];

  if (!modelo) {
    partes.push(`En ${filas.length} partidos nadie ha rematado a ${rival} en los ${VENTANA_S} s siguientes a robarle en el último tercio`);
  } else {
    const r = resultado(modelo);
    partes.push(
      `${conDano} de sus ${filas.length} rivales le remataron tras robarle arriba (${totalRem} remates en total). Quien más daño le hizo así fue ${modelo.oponente}: ${modelo.robos} robos altos, ${modelo.remates} ${modelo.remates === 1 ? "remate" : "remates"}${modelo.goles ? ` y ${modelo.goles} ${modelo.goles === 1 ? "gol" : "goles"}` : ""}${r ? ` (${r.texto})` : ""}`,
    );
  }

  if (ref.contraRival != null && ref.liga != null && ref.liga > 0) {
    const d = ref.contraRival / ref.liga - 1;
    const como = Math.abs(d) < 0.1 ? "como la media" : d > 0 ? `un ${Math.round(d * 100)} % más que la media` : `un ${Math.round(-d * 100)} % menos que la media`;
    partes.push(
      `Sus rivales le ganan ${uno(ref.contraRival)} balones por partido en el último tercio, ${como} de la liga (${uno(ref.liga)})${d > 0.1 ? ": se le puede apretar arriba" : d < -0.1 ? ": sale bien de la presión" : ""}`,
    );
  }
  return `${partes.join(". ")}.`;
}
