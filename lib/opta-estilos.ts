/**
 * ESTILOS DE LA CATEGORÍA (10/11/2026): las cuentas de la pestaña «Estilos»
 * de `/opta`. Funciones puras (ni fetch ni estado) para poder probarlas en
 * Node con las copias de `.cache/opta`.
 *
 * 1. **Momentum de toda la liga** (`momentumLiga`). Con la misma curva de
 *    `curvaMomento` (xG y toques en el área por tramo de 5′, saturados y
 *    suavizados), un equipo «aprieta» en un tramo cuando la curva pasa de
 *    `UMBRAL_DOMINIO` a su favor. Dominio = tramos en que aprieta ÷ tramos
 *    jugados, en total y por franjas de 15′. Cada gol se mira con los 5′
 *    anteriores (sin el propio remate del gol): «apretando» si dominaba el
 *    que marca; «a contrapié» si dominaba el que encaja.
 *
 *    OJO con el reloj: el tramo es `gameClock ÷ 300` y la segunda parte
 *    arranca en 2.700″, así que el descuento de la primera parte cae en el
 *    tramo 45′-50′ junto al arranque de la segunda: va en la franja 46-60. El
 *    de la segunda sí cuenta en la última (76-90+). Por eso la tercera es
 *    «31-45» y no «31-45+»: con este reloj no se pueden separar.
 *
 * 2. **Índices de estilo** (`indicesEstilo`): dominio, peligro y solidez,
 *    cada uno la media de los percentiles de unas métricas por partido de
 *    `opta:equipos` dentro de los equipos con que se compara.
 *
 * 3. **Radiografía** (`radiografia`): 22 métricas por partido en cinco
 *    familias, cada una con su percentil; la nota de juego es su media.
 *
 * Los porcentajes de Opta vienen en tanto por uno: aquí se dejan así y
 * `valorEquipo` los pasa a pantalla.
 */

import { CASTILLA_OPTA, percentil, type MetricaOpta } from "@/lib/opta";
import { NOMBRE_CASTILLA, nombreEquipo, valorEquipo, type Fila } from "@/lib/opta-analisis";
import { curvaMomento, enArea, type MomentoPartido, type Remate, type Tramo } from "@/lib/opta-eventos";

/* ------------------------------------------------------------------ */
/*  1. MOMENTUM DE TODA LA LIGA                                        */
/* ------------------------------------------------------------------ */

/** Desde cuánto (en la curva de −1 a 1) se dice que un equipo aprieta. */
export const UMBRAL_DOMINIO = 0.05;

/** Las franjas de 15′: tramos de 5′ que entran en cada una. */
export const FRANJAS: { clave: string; nombre: string; desde: number; hasta: number }[] = [
  { clave: "f1", nombre: "0-15", desde: 0, hasta: 2 },
  { clave: "f2", nombre: "16-30", desde: 3, hasta: 5 },
  { clave: "f3", nombre: "31-45", desde: 6, hasta: 8 },
  { clave: "f4", nombre: "46-60", desde: 9, hasta: 11 },
  { clave: "f5", nombre: "61-75", desde: 12, hasta: 14 },
  { clave: "f6", nombre: "76-90+", desde: 15, hasta: Number.POSITIVE_INFINITY },
];

export const franjaDe = (tramo: number) => FRANJAS.findIndex((f) => tramo >= f.desde && tramo <= f.hasta);

export type FilaMomentum = {
  teamId: string;
  equipo: string;
  partidos: number;
  /** Tanto por uno de los tramos en que aprieta. */
  dominio: number | null;
  /** Lo mismo por franja de 15′ (en el orden de FRANJAS). */
  franjas: (number | null)[];
  /** Índice de la franja en que más (y menos) aprieta. */
  fuerte: number | null;
  flojo: number | null;
  goles: number;
  golesApretando: number;
  golesContrapie: number;
  encajados: number;
  encajadosApretandoEl: number;
  encajadosApretandoRival: number;
};

/* La misma saturación que `curvaMomento` (lib/opta-eventos.ts). */
const satura = (v: number, k: number) => v / (v + k);
const brutoTramo = (ta: Tramo | undefined, tb: Tramo | undefined, quitaA?: { xG: number; toque: number }) => {
  const xa = Math.max(0, (ta?.xG ?? 0) - (quitaA?.xG ?? 0));
  const qa = Math.max(0, (ta?.toquesArea ?? 0) - (quitaA?.toque ?? 0));
  const dx = satura(xa, 0.3) - satura(tb?.xG ?? 0, 0.3);
  const dt = satura(qa, 3) - satura(tb?.toquesArea ?? 0, 3);
  return (dx + dt) / 2;
};

/**
 * Quién apretaba en los 5′ antes de un remate (de −1 a 1, positivo si el que
 * remata). Ventana [segundo − 300, segundo): la parte del tramo en curso que
 * ya se había jugado y el resto del anterior. Al tramo del gol se le quita
 * el propio remate (su xG y, si fue dentro del área, su toque) para que el
 * gol no se dé la razón a sí mismo.
 */
export function apretabaAntes(p: MomentoPartido, r: Remate): number | null {
  const ea = p.equipos.find((e) => e.teamId === r.teamId);
  const eb = p.equipos.find((e) => e.teamId !== r.teamId);
  if (!ea || !eb) return null;
  const k = Math.floor(r.segundo / 300);
  const f = (r.segundo - k * 300) / 300;
  const actual = brutoTramo(ea.tramos.get(k), eb.tramos.get(k), { xG: r.xG, toque: enArea(r.x, r.y) ? 1 : 0 });
  if (k === 0) return actual;
  const anterior = brutoTramo(ea.tramos.get(k - 1), eb.tramos.get(k - 1));
  return f * actual + (1 - f) * anterior;
}

/** Una fila por equipo con el momentum de toda su temporada. */
export function momentumLiga(momento: Map<string, MomentoPartido>, remates: Remate[]): FilaMomentum[] {
  type Acu = FilaMomentum & { tramos: number[]; aprieta: number[] };
  const acu = new Map<string, Acu>();
  const de = (teamId: string, equipo: string): Acu => {
    let a = acu.get(teamId);
    if (!a) {
      a = {
        teamId,
        equipo,
        partidos: 0,
        dominio: null,
        franjas: [],
        fuerte: null,
        flojo: null,
        goles: 0,
        golesApretando: 0,
        golesContrapie: 0,
        encajados: 0,
        encajadosApretandoEl: 0,
        encajadosApretandoRival: 0,
        tramos: FRANJAS.map(() => 0),
        aprieta: FRANJAS.map(() => 0),
      };
      acu.set(teamId, a);
    }
    return a;
  };

  for (const p of momento.values()) {
    if (p.equipos.length !== 2) continue;
    for (const e of p.equipos) {
      const a = de(e.teamId, e.equipo);
      a.partidos++;
      for (const t of curvaMomento(p, e.teamId, "mezcla")) {
        const i = franjaDe(t.tramo);
        if (i < 0) continue;
        a.tramos[i]++;
        if (t.valor > UMBRAL_DOMINIO) a.aprieta[i]++;
      }
    }
  }

  for (const r of remates) {
    if (!r.gol) continue;
    const p = momento.get(r.partido);
    if (!p || p.equipos.length !== 2) continue;
    const otro = p.equipos.find((e) => e.teamId !== r.teamId);
    if (!otro || !p.equipos.some((e) => e.teamId === r.teamId)) continue;
    const marca = de(r.teamId, r.equipo);
    const encaja = de(otro.teamId, otro.equipo);
    marca.goles++;
    encaja.encajados++;
    const v = apretabaAntes(p, r);
    if (v == null) continue;
    if (v > UMBRAL_DOMINIO) {
      marca.golesApretando++;
      encaja.encajadosApretandoRival++;
    } else if (v < -UMBRAL_DOMINIO) {
      marca.golesContrapie++;
      encaja.encajadosApretandoEl++;
    }
  }

  return [...acu.values()].map(({ tramos, aprieta, ...f }) => {
    const total = tramos.reduce((s, x) => s + x, 0);
    const franjas = tramos.map((n, i) => (n ? aprieta[i] / n : null));
    let fuerte: number | null = null;
    let flojo: number | null = null;
    for (let i = 0; i < franjas.length; i++) {
      const v = franjas[i];
      if (v == null) continue;
      if (fuerte == null || v > (franjas[fuerte] ?? 0)) fuerte = i;
      if (flojo == null || v < (franjas[flojo] ?? 0)) flojo = i;
    }
    return {
      ...f,
      equipo: f.teamId === CASTILLA_OPTA ? NOMBRE_CASTILLA : f.equipo,
      dominio: total ? aprieta.reduce((s, x) => s + x, 0) / total : null,
      franjas,
      fuerte,
      flojo,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  2. ÍNDICES DE ESTILO                                               */
/* ------------------------------------------------------------------ */

export type MetricaIndice = { a: string; inverso?: boolean };
export type Indice = "dominio" | "peligro" | "solidez";

export const INDICES: { clave: Indice; nombre: string; que: string; metricas: MetricaIndice[] }[] = [
  {
    clave: "dominio",
    nombre: "Dominio",
    que: "Tener la pelota y vivir en campo rival",
    metricas: [{ a: "Poss%" }, { a: "PsAtt" }, { a: "TchsA3" }, { a: "PPDA", inverso: true }],
  },
  {
    clave: "peligro",
    nombre: "Peligro",
    que: "Llegar y rematar",
    metricas: [{ a: "ExpG" }, { a: "ShtIncBl" }, { a: "TouchOpBox" }, { a: "Chance" }],
  },
  {
    clave: "solidez",
    nombre: "Solidez",
    que: "Conceder poco",
    metricas: [
      { a: "ExpGAg", inverso: true },
      { a: "ShotsAg", inverso: true },
      { a: "SOGAg", inverso: true },
      { a: "GA", inverso: true },
    ],
  },
];

export type IndicesEquipo = { teamId: string; equipo: string } & Record<Indice, number | null>;

const media = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** Los tres índices de cada equipo de `equipos` (0-100), contra esos mismos equipos. */
export function indicesEstilo(equipos: Fila[], catalogo?: Map<string, MetricaOpta>): IndicesEquipo[] {
  const muestras = new Map<string, (number | null)[]>();
  for (const ind of INDICES)
    for (const m of ind.metricas) if (!muestras.has(m.a)) muestras.set(m.a, equipos.map((f) => valorEquipo(f, m.a, "partido", catalogo)));
  return equipos.map((f, i) => {
    const salida = { teamId: String(f.teamId ?? ""), equipo: nombreEquipo(f) } as IndicesEquipo;
    for (const ind of INDICES) {
      salida[ind.clave] = media(
        ind.metricas.map((m) => {
          const xs = muestras.get(m.a)!;
          return percentil(xs[i], xs, m.inverso);
        }),
      );
    }
    return salida;
  });
}

/** Los `n` primeros de cada índice. */
export function topDe(indices: IndicesEquipo[], n: number): Record<Indice, Set<string>> {
  const top = (k: Indice) =>
    new Set(
      indices
        .filter((x) => x[k] != null)
        .sort((a, b) => b[k]! - a[k]! || a.equipo.localeCompare(b.equipo, "es"))
        .slice(0, n)
        .map((x) => x.teamId),
    );
  return { dominio: top("dominio"), peligro: top("peligro"), solidez: top("solidez") };
}

/* ------------------------------------------------------------------ */
/*  3. RADIOGRAFÍA                                                     */
/* ------------------------------------------------------------------ */

export type Familia = "ataque" | "progresion" | "posesion" | "defensa" | "abp";

export const FAMILIAS_RADIOGRAFIA: { clave: Familia; nombre: string }[] = [
  { clave: "ataque", nombre: "Ataque" },
  { clave: "progresion", nombre: "Progresión" },
  { clave: "posesion", nombre: "Posesión" },
  { clave: "defensa", nombre: "Presión y defensa" },
  { clave: "abp", nombre: "Balón parado" },
];

/** Las 22 porciones, en el orden en que se pintan. `inverso`: menos es mejor. */
export const METRICAS_RADIOGRAFIA: { a: string; familia: Familia; inverso?: boolean }[] = [
  { a: "ExpG", familia: "ataque" },
  { a: "ShtIncBl", familia: "ataque" },
  { a: "SOG", familia: "ataque" },
  { a: "TouchOpBox", familia: "ataque" },
  { a: "Chance", familia: "ataque" },
  { a: "ProgPass", familia: "progresion" },
  { a: "PsIntoPen", familia: "progresion" },
  { a: "SeqEndInA3", familia: "progresion" },
  { a: "TchsA3", familia: "progresion" },
  { a: "Poss%", familia: "posesion" },
  { a: "PsAtt", familia: "posesion" },
  { a: "Pass%", familia: "posesion" },
  { a: "Seq9+Pass", familia: "posesion" },
  { a: "PPDA", familia: "defensa", inverso: true },
  { a: "HighTurnovers", familia: "defensa" },
  { a: "PosWonA3rd", familia: "defensa" },
  { a: "ExpGAg", familia: "defensa", inverso: true },
  { a: "ShotsAg", familia: "defensa", inverso: true },
  { a: "xGSetPly", familia: "abp" },
  { a: "ChncSetPl", familia: "abp" },
  { a: "CrnrWon", familia: "abp" },
  { a: "ChncSetPl|OPP", familia: "abp", inverso: true },
];

export type Porcion = { a: string; familia: Familia; inverso: boolean; valor: number | null; percentil: number | null };

/** Las porciones de un equipo contra `muestra` (que lo incluye) y su nota de juego. */
export function radiografia(
  equipo: Fila,
  muestra: Fila[],
  catalogo?: Map<string, MetricaOpta>,
): { porciones: Porcion[]; nota: number | null; porFamilia: Record<Familia, number | null> } {
  const porciones = METRICAS_RADIOGRAFIA.map((m): Porcion => {
    const valor = valorEquipo(equipo, m.a, "partido", catalogo);
    const xs = muestra.map((f) => valorEquipo(f, m.a, "partido", catalogo));
    return { a: m.a, familia: m.familia, inverso: !!m.inverso, valor, percentil: percentil(valor, xs, m.inverso) };
  });
  const porFamilia = Object.fromEntries(
    FAMILIAS_RADIOGRAFIA.map((f) => [f.clave, media(porciones.filter((p) => p.familia === f.clave).map((p) => p.percentil))]),
  ) as Record<Familia, number | null>;
  return { porciones, nota: media(porciones.map((p) => p.percentil)), porFamilia };
}

/** El nombre corto para el Venn (nombres, no datos). */
const CORTOS: Record<string, string> = {
  "Real Madrid Castilla": "Castilla",
  "Unionistas de Salamanca": "Unionistas",
  "Deportivo de A Coruña II": "Deportivo II",
  "Juventud Torremolinos": "Torremolinos",
  "Gimnàstic Tarragona": "Gimnàstic",
  "Cultural Leonesa": "Cultural",
  "Racing de Ferrol": "Racing Ferrol",
  "Atlético Madrileño": "At. Madrileño",
  "Rayo Majadahonda": "Majadahonda",
  "Athletic Club II": "Athletic II",
};
export const nombreCorto = (n: string) => CORTOS[n] ?? n;
