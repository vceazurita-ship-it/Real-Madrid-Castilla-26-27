/**
 * SU SALIDA DE BALÓN: ¿BAJA EL PIVOTE A LA LÍNEA DE CENTRALES?
 * (Scout colectivo, 25/11/2026, idea de X).
 *
 * Con el evento a evento de Opta (`opta:directo:<partido>`) de los últimos
 * partidos del rival:
 *
 * - Papeles de cada partido (Opta sólo da Goalkeeper / Defender / Midfielder /
 *   Forward en el directo): portero, el Goalkeeper; de los Defender con toques
 *   bastantes, lateral derecho si su y media < 33,3 (la y de Opta tiene el 0 en
 *   la banda DERECHA del que ataca), lateral izquierdo si > 66,7, y central el
 *   resto; mediocentro, el Midfielder que juega por dentro (y media 30-70) y no
 *   arriba (x media < 55).
 * - Posesión: eventos seguidos del rival en la misma parte, hasta que el
 *   contrario se queda el balón (pase, recuperación, intercepción, despeje,
 *   blocaje o entrada ganada) o pasan 30 s sin que toque. Nace del portero o
 *   de un central si su primer toque es de uno de ellos y en su primer tercio
 *   (x < 33,3).
 * - En esas posesiones: los toques de cada mediocentro en su primer tercio, la
 *   altura media de los centrales ahí y la altura media de TODOS los toques de
 *   cada lateral en la posesión (vaya hasta donde vaya).
 * - Pivote incrustado: toques del mediocentro a la altura de los centrales
 *   (x ≤ su media + 6) y abierto a un lado (y 15-35, su derecha; 65-85, su
 *   izquierda). Si son al menos 8 y al menos el 30 % de sus toques del primer
 *   tercio en la salida, «salida de 3 con pivote incrustado»; el lado, el que
 *   más tiene.
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esToque, type EventoDirecto, type JugadorDirecto } from "@/lib/opta-directo-mapas";

export const MAX_PARTIDOS = 8;
export const X_PRIMER_TERCIO = 33.3;
/** Franjas «abierto a un lado» (y de Opta, 0 = su banda derecha). */
export const Y_DERECHA: [number, number] = [15, 35];
export const Y_IZQUIERDA: [number, number] = [65, 85];
/** «A la altura de los centrales»: hasta esto por delante de su x media. */
export const MARGEN_ALTURA = 6;
export const MIN_INCRUSTADO = 8;
export const PARTE_INCRUSTADO = 0.3;
export const CORTE_POSESION_S = 30;
/** Toques mínimos en el partido para fiarse de su sitio medio. */
const MIN_TOQUES = 8;
/** Altura del lateral (Opta 0-100): se proyecta / se queda. */
export const X_PROYECTA = 50;
export const X_SE_QUEDA = 38;

export type Lado = "derecha" | "izquierda";
type Papel = "portero" | "central" | "mediocentro" | `lateral-${Lado}`;

/** El contrario se queda el balón: corta la posesión. */
const CORTA = new Set(["Pass", "BallRecovery", "Interception", "Clearance", "Claim", "KeeperPickup", "Punch", "BlockedPass"]);
const NO_TOCA = new Set(["Foul", "Challenge", "AttemptedTackle", "Card", "SubstitutionOn", "SubstitutionOff"]);
const toca = (e: EventoDirecto) => !!e.jugadorId && esToque(e) && !NO_TOCA.has(e.tipo);

export type PartidoSalida = { partido: string; eventos: EventoDirecto[]; jugadores: JugadorDirecto[] };

export type MediocentroSalida = {
  id: string;
  /** Sus toques en su primer tercio en esas posesiones. */
  toques: { x: number; y: number }[];
  /** De ellos, a la altura de los centrales y abierto a cada lado. */
  zona: Record<Lado, number>;
};

export type LateralSalida = { ids: string[]; toques: number; xMedia: number | null };

export type SalidaPivote = {
  partidos: number;
  /** Posesiones que nacen del portero o de un central. */
  posesiones: number;
  delPortero: number;
  /** x media de los toques de sus centrales en su primer tercio. */
  xCentrales: number;
  yCentrales: number[];
  mediocentros: MediocentroSalida[];
  incrustado: { id: string; lado: Lado; n: number; parte: number } | null;
  laterales: Record<Lado, LateralSalida>;
};

const enFranja = (y: number, [a, b]: [number, number]) => y >= a && y <= b;

function papeles(p: PartidoSalida, teamId: string): Map<string, Papel> {
  const suma = new Map<string, { sx: number; sy: number; n: number }>();
  for (const e of p.eventos) {
    if (e.teamId !== teamId || !toca(e)) continue;
    const a = suma.get(e.jugadorId) ?? { sx: 0, sy: 0, n: 0 };
    a.sx += e.x;
    a.sy += e.y;
    a.n += 1;
    suma.set(e.jugadorId, a);
  }
  const salida = new Map<string, Papel>();
  for (const j of p.jugadores) {
    if (j.teamId !== teamId || !j.id) continue;
    if (j.puesto === "Goalkeeper") {
      salida.set(j.id, "portero");
      continue;
    }
    const a = suma.get(j.id);
    if (!a || a.n < MIN_TOQUES) continue;
    const x = a.sx / a.n;
    const y = a.sy / a.n;
    if (j.puesto === "Defender") salida.set(j.id, y < 100 / 3 ? "lateral-derecha" : y > 200 / 3 ? "lateral-izquierda" : "central");
    else if (j.puesto === "Midfielder" && y >= 30 && y <= 70 && x < 55) salida.set(j.id, "mediocentro");
  }
  return salida;
}

export function salidaPivote(partidos: PartidoSalida[], teamId: string): SalidaPivote | null {
  const medios = new Map<string, MediocentroSalida>();
  const lat: Record<Lado, { ids: Set<string>; sx: number; n: number }> = {
    derecha: { ids: new Set(), sx: 0, n: 0 },
    izquierda: { ids: new Set(), sx: 0, n: 0 },
  };
  let cx = 0;
  let cn = 0;
  const yCentrales: number[] = [];
  let posesiones = 0;
  let delPortero = 0;
  let leidos = 0;

  for (const p of partidos) {
    const ev = p.eventos;
    if (!ev.some((e) => e.teamId === teamId)) continue;
    leidos += 1;
    const papel = papeles(p, teamId);

    let abierta: EventoDirecto[] = [];
    const cierra = () => {
      const pos = abierta;
      abierta = [];
      if (!pos.length) return;
      const origen = papel.get(pos[0].jugadorId);
      if ((origen !== "portero" && origen !== "central") || pos[0].x >= X_PRIMER_TERCIO) return;
      posesiones += 1;
      if (origen === "portero") delPortero += 1;
      for (const e of pos) {
        const r = papel.get(e.jugadorId);
        if (r === "central" && e.x < X_PRIMER_TERCIO) {
          cx += e.x;
          cn += 1;
          yCentrales.push(e.y);
        } else if (r === "mediocentro" && e.x < X_PRIMER_TERCIO) {
          const m = medios.get(e.jugadorId) ?? { id: e.jugadorId, toques: [], zona: { derecha: 0, izquierda: 0 } };
          m.toques.push({ x: e.x, y: e.y });
          medios.set(e.jugadorId, m);
        } else if (r === "lateral-derecha" || r === "lateral-izquierda") {
          const l = lat[r === "lateral-derecha" ? "derecha" : "izquierda"];
          l.ids.add(e.jugadorId);
          l.sx += e.x;
          l.n += 1;
        }
      }
    };

    for (const e of ev) {
      const ultimo = abierta[abierta.length - 1];
      if (ultimo && (e.parte !== ultimo.parte || e.segundo - ultimo.segundo > CORTE_POSESION_S)) cierra();
      if (e.teamId !== teamId) {
        if (abierta.length && (CORTA.has(e.tipo) || (e.tipo === "Tackle" && e.ok))) cierra();
        continue;
      }
      if (toca(e)) abierta.push(e);
    }
    cierra();
  }
  if (!leidos || !posesiones || !cn) return null;

  const xCentrales = cx / cn;
  const tope = xCentrales + MARGEN_ALTURA;
  for (const m of medios.values())
    for (const t of m.toques) {
      if (t.x > tope) continue;
      if (enFranja(t.y, Y_DERECHA)) m.zona.derecha += 1;
      else if (enFranja(t.y, Y_IZQUIERDA)) m.zona.izquierda += 1;
    }
  const mediocentros = [...medios.values()].sort((a, b) => b.toques.length - a.toques.length);

  let incrustado: SalidaPivote["incrustado"] = null;
  for (const m of mediocentros) {
    const lado: Lado = m.zona.izquierda > m.zona.derecha ? "izquierda" : "derecha";
    const n = m.zona[lado];
    const parte = m.toques.length ? n / m.toques.length : 0;
    if (n < MIN_INCRUSTADO || parte < PARTE_INCRUSTADO) continue;
    if (!incrustado || n > incrustado.n) incrustado = { id: m.id, lado, n, parte };
  }

  const lateral = (l: Lado): LateralSalida => ({ ids: [...lat[l].ids], toques: lat[l].n, xMedia: lat[l].n ? lat[l].sx / lat[l].n : null });

  return {
    partidos: leidos,
    posesiones,
    delPortero,
    xCentrales,
    yCentrales,
    mediocentros,
    incrustado,
    laterales: { derecha: lateral("derecha"), izquierda: lateral("izquierda") },
  };
}

/** Qué hace el lateral: se proyecta, se queda o a media altura. */
export const queHaceLateral = (x: number | null) => (x == null ? null : x >= X_PROYECTA ? "se proyecta" : x <= X_SE_QUEDA ? "se queda" : "a media altura");
