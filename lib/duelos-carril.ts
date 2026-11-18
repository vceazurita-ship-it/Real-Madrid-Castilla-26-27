/**
 * ¿EXTREMO DE BANDA O FALSO EXTREMO? (18/11/2026, idea de X).
 *
 * En el duelo de nuestro lateral contra su extremo: por qué carril toca el
 * balón su extremo en campo rival, con el evento a evento de Opta
 * (`opta:directo:<partido>`) de los partidos en los que fue titular.
 *
 * Tres carriles, en el ancho de Opta (0-100):
 *
 * - pasillo exterior: y < 21 o y > 79;
 * - carril intermedio: de 21 a 37 y de 63 a 79;
 * - pasillo central: de 37 a 63.
 *
 * «Campo rival» = x > 50 (Opta tiene siempre al que ataca hacia la x alta).
 * Toque = la regla del directo (`esToque`: sin faltas, córners ni entradas
 * fallidas). Si más de la mitad de sus toques caen DENTRO (intermedio +
 * central), es un falso extremo: se va hacia dentro y quien se lo encuentra
 * es nuestro pivote de ese lado. Si no, el duelo es 1c1 con el lateral.
 *
 * Funciones puras: ni una cifra aquí (el repositorio es público).
 */

import { esToque, type EventoDirecto, type JugadorDirecto } from "@/lib/opta-directo-mapas";
import { mismaPersona, nombreCanonico } from "@/lib/data-analisis/nombres";

export const Y_EXTERIOR = 21;
export const Y_INTERMEDIO = 37;
export const X_CAMPO_RIVAL = 50;
/** Si más de esta parte de sus toques cae dentro, se va hacia dentro. */
export const UMBRAL_DENTRO = 0.5;
/** Con menos toques en campo rival no se dice nada. */
export const MIN_TOQUES = 30;
/** Partidos más recientes del rival que se leen (cada uno pesa ~0,3 MB). */
export const MAX_PARTIDOS = 8;

export type Carril = "exterior" | "intermedio" | "central";

export const ROTULO_CARRIL: Record<Carril, string> = {
  exterior: "Pasillo exterior",
  intermedio: "Carril intermedio",
  central: "Pasillo central",
};

export const carrilDe = (y: number): Carril => {
  const d = Math.min(y, 100 - y);
  return d < Y_EXTERIOR ? "exterior" : d < Y_INTERMEDIO ? "intermedio" : "central";
};

export type PartidoCarril = { partido: string; eventos: EventoDirecto[]; jugadores: JugadorDirecto[] };

export type CarrilExtremo = {
  nombreOpta: string;
  /** Partidos como titular con toques en campo rival. */
  partidos: number;
  total: number;
  cuenta: Record<Carril, number>;
  /** Partes del total (0-1). */
  parte: Record<Carril, number>;
  /** Intermedio + central. */
  dentro: number;
  falsoExtremo: boolean;
};

const limpio = (s: string) =>
  nombreCanonico(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Su id de Opta en esos partidos: un solo jugador del equipo que case con alguno de sus nombres. */
function idDe(partidos: PartidoCarril[], teamId: string, nombres: string[]): { id: string; nombre: string } | null {
  const vistos = new Map<string, string>();
  for (const p of partidos) for (const j of p.jugadores) if (j.teamId === teamId && j.id) vistos.set(j.id, j.nombre);
  const candidatos = [...vistos].filter(([, n]) => nombres.some((m) => mismaPersona(n, m)));
  const fila =
    candidatos.length === 1 ? candidatos[0] : candidatos.find(([, n]) => nombres.some((m) => limpio(n) === limpio(m)));
  return fila ? { id: fila[0], nombre: fila[1] } : null;
}

export function carrilDelExtremo(partidos: PartidoCarril[], teamId: string, nombres: string[]): CarrilExtremo | null {
  const quien = idDe(partidos, teamId, nombres.filter(Boolean));
  if (!quien) return null;
  const cuenta: Record<Carril, number> = { exterior: 0, intermedio: 0, central: 0 };
  let conToques = 0;
  for (const p of partidos) {
    const titular = p.jugadores.some((j) => j.id === quien.id && j.teamId === teamId && j.titular);
    if (!titular) continue;
    let alguno = false;
    for (const e of p.eventos) {
      if (e.teamId !== teamId || e.jugadorId !== quien.id || !esToque(e) || e.x <= X_CAMPO_RIVAL) continue;
      cuenta[carrilDe(e.y)] += 1;
      alguno = true;
    }
    if (alguno) conToques += 1;
  }
  const total = cuenta.exterior + cuenta.intermedio + cuenta.central;
  if (total < MIN_TOQUES) return null;
  const parte = { exterior: cuenta.exterior / total, intermedio: cuenta.intermedio / total, central: cuenta.central / total };
  const dentro = parte.intermedio + parte.central;
  return { nombreOpta: quien.nombre, partidos: conToques, total, cuenta, parte, dentro, falsoExtremo: dentro > UMBRAL_DENTRO };
}
