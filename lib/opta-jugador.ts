/**
 * OPTA EN LA PESTAÑA «OPTA» DE LA FICHA INDIVIDUAL (10/11/2026).
 *
 * Lo que la pestaña cuenta y no estaba en la ficha (el percentil frente al
 * puesto vive en «Área de mejora» —`OptaPuesto`— y la curva de una métrica
 * en «Tendencia» —`OptaTendencia`—):
 *
 * - **Partido a partido** con titular o suplente (`opta:jugadores-partidos`,
 *   GS = 1 titular) y las métricas de su familia de puesto en cada partido
 *   (`opta:castilla-partidos`), con su temporada por 90′ y la mediana por 90′
 *   de los de su familia en la categoría (`opta:jugadores`, con un mínimo de
 *   minutos).
 * - **En el campo** (`opta:castilla-eventos`): sus pases progresivos, sus
 *   intercepciones y entradas ganadas y sus pérdidas, por altura. Opta no pone
 *   nombre a las recuperaciones sueltas (BallRecovery), así que las de un
 *   jugador son sólo intercepciones y entradas ganadas; y los «pases» de los
 *   eventos incluyen los saques de banda.
 *
 * Funciones puras: se prueban en Node con las copias de `.cache/opta`.
 */

import { num } from "@/lib/opta";
import { familiaDe, valorJugador, valorPartido, type Fila } from "@/lib/opta-analisis";
import { alturaAccion, esPerdida, esProgresivo, esRecuperacion, type AccionCastilla, type Altura3 } from "@/lib/opta-eventos";

/** Minutos para entrar en la mediana del puesto (los mismos que en «Área de mejora»). */
export const MINUTOS_REFERENCIA = 270;

/** Las columnas del partido a partido de cada familia (todas existen en `opta:castilla-partidos` y en `opta:jugadores`). */
export const COLUMNAS_FAMILIA: Record<string, string[]> = {
  Porteros: ["Saves", "GAg", "PsAtt", "Pass%", "LgBall", "Recovery"],
  Centrales: ["PsAtt", "Pass%", "Int", "Clrnce", "Recovery", "AerialWon", "Duel%", "PossLost"],
  Laterales: ["PsAtt", "Pass%", "Crosses", "Chance", "xA", "Recovery", "Duel%", "PossLost"],
  Mediocentros: ["Touches", "PsAtt", "Pass%", "Chance", "xA", "Recovery", "Duel%", "PossLost"],
  Mediapuntas: ["Goal", "ExpG", "ShtIncBl", "Chance", "xA", "TouchOpBox", "Recovery", "PossLost"],
  Bandas: ["Goal", "ExpG", "ShtIncBl", "Chance", "xA", "TouchOpBox", "1v1InBox", "PossLost"],
  Delanteros: ["Goal", "ExpG", "ShtIncBl", "SOG", "TouchOpBox", "Chance", "xA", "AerialWon"],
};

export const columnasDe = (familia: string) => COLUMNAS_FAMILIA[familia] ?? COLUMNAS_FAMILIA.Mediocentros;

export type PartidoJugador = {
  partido: string;
  fecha: string;
  rival: string;
  min: number;
  /** true titular, false suplente, null si Opta no lo dice. */
  titular: boolean | null;
  fila: Fila;
};

/**
 * Los partidos que jugó (minutos > 0), por fecha, con titular o suplente de
 * `opta:jugadores-partidos` si llega (cruzando partido y jugador).
 */
export function partidosJugador(castillaPartidos: Fila[], playerId: string, jugadoresPartidos: Fila[] | null): PartidoJugador[] {
  const gs = new Map<string, number | null>();
  for (const f of jugadoresPartidos ?? []) if (f.playerId === playerId) gs.set(String(f.partido ?? ""), num(f.GS));
  return castillaPartidos
    .filter((f) => f.playerId === playerId && (num(f.Min) ?? 0) > 0)
    .map((f) => {
      const partido = String(f.partido ?? "");
      const g = gs.get(partido);
      return {
        partido,
        fecha: String(f.fecha ?? ""),
        rival: String(f.rival ?? ""),
        min: num(f.Min) ?? 0,
        titular: g == null ? null : g === 1,
        fila: f,
      };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** El valor de un partido para la tabla (porcentajes en tanto por cien). */
export const valorEnPartido = (p: PartidoJugador, a: string) => valorPartido(p.fila, a);

/** Su temporada: por 90′ (o el porcentaje), de su fila de `opta:jugadores`. */
export const suTemporada = (yo: Fila, a: string) => valorJugador(yo, a, 1);

/**
 * La mediana de los de su familia en toda la categoría con `minimo` minutos o
 * más (sin él): por 90′, o el porcentaje. Null con menos de 10 comparables.
 */
export function medianaFamilia(jugadores: Fila[], yo: Fila, a: string, minimo = MINUTOS_REFERENCIA): { mediana: number; n: number } | null {
  const familia = familiaDe(yo);
  if (!familia) return null;
  const xs = jugadores
    .filter((f) => f.playerId !== yo.playerId && familiaDe(f) === familia && (num(f.Min) ?? 0) >= minimo)
    .map((f) => valorJugador(f, a, minimo))
    .filter((v): v is number => v != null && Number.isFinite(v))
    .sort((x, y) => x - y);
  if (xs.length < 10) return null;
  const k = Math.floor(xs.length / 2);
  return { mediana: xs.length % 2 ? xs[k] : (xs[k - 1] + xs[k]) / 2, n: xs.length };
}

/* ------------------------------------------------------------------ */
/*  EN EL CAMPO                                                        */
/* ------------------------------------------------------------------ */

export type ModoCampo = "progresivos" | "defensivas" | "perdidas";

export const MODOS_CAMPO: { clave: ModoCampo; nombre: string; que: string }[] = [
  {
    clave: "progresivos",
    nombre: "Pases progresivos",
    que: "Completados y que acercan el balón a la portería rival al menos un 25 % de lo que faltaba (sin los que se quedan en campo propio). Misma definición que en /opta.",
  },
  {
    clave: "defensivas",
    nombre: "Intercepciones y entradas ganadas",
    que: "Las acciones defensivas que Opta atribuye al jugador. Las recuperaciones sueltas vienen sin nombre en el evento a evento: no están aquí.",
  },
  {
    clave: "perdidas",
    nombre: "Pérdidas",
    que: "Pases fallados (saques de banda incluidos), regates perdidos y balones robados en conducción.",
  },
];

export const ALTURAS_CAMPO: { clave: Altura3; nombre: string }[] = [
  { clave: "alta", nombre: "En campo rival" },
  { clave: "media", nombre: "Zona media" },
  { clave: "baja", nombre: "En su primer tercio" },
];

export type CampoJugador = {
  acciones: AccionCastilla[];
  /** Cuántas en cada altura. */
  porAltura: Record<Altura3, number>;
  /** Para los progresivos: de cuántos pases suyos salen. */
  pases: number;
  partidos: number;
};

/** Las acciones de un jugador del Castilla de un tipo, con su reparto por alturas. */
export function campoJugador(acciones: AccionCastilla[], playerId: string, modo: ModoCampo): CampoJugador {
  const suyas = acciones.filter((a) => a.nuestra && a.jugadorId === playerId);
  const filtro = modo === "progresivos" ? esProgresivo : modo === "defensivas" ? esRecuperacion : esPerdida;
  const lista = suyas.filter(filtro);
  const porAltura: Record<Altura3, number> = { alta: 0, media: 0, baja: 0 };
  for (const a of lista) porAltura[alturaAccion(a.x)]++;
  return {
    acciones: lista,
    porAltura,
    pases: suyas.filter((a) => a.tipo === "Pass").length,
    partidos: new Set(suyas.map((a) => a.partido)).size,
  };
}
