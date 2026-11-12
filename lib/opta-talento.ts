/**
 * LAS CUENTAS DE LA PESTAÑA «TALENTO» DE /opta (10/11/2026).
 *
 * Funciones puras (ni fetch ni estado) sobre las tablas de `lib/opta.ts`, para
 * poder probarlas en Node con las copias de `.cache/opta`. Aquí no va ni una
 * cifra de Opta: el repositorio es público.
 *
 * 1. DISPERSIÓN DE PERCENTILES. Cada eje es el percentil (0-100) del jugador
 *    en una métrica por 90 DENTRO DE SU FAMILIA ANCHA de puesto: defensas
 *    (centrales y laterales), centrocampistas (mediocentros y mediapuntas) y
 *    delanteros (puntas y hombres de banda). Los porteros, fuera. Con la
 *    correlación de rangos de Spearman entre los dos ejes.
 *
 * 2. RANKING POR PERFIL. Cada perfil son 5-6 métricas; la «nota de perfil» es
 *    la media de los percentiles del jugador frente a los de SU puesto (la
 *    familia fina de `FAMILIA_PUESTO`). Un porcentaje de pocos intentos no
 *    cuenta (se marca).
 *
 * 3. MOMENTOS DEL GOL.
 *    - «Goles que valen puntos»: el marcador se reconstruye con los goles de
 *      `opta:remates` en orden (parte, segundo). Un gol vale los puntos que su
 *      equipo habría perdido sin él (resultado final menos ese gol): el 1-0
 *      vale 2, el empate a uno vale 1, el tercero de un 3-0 no vale nada.
 *      Los goles en propia puerta NO salen como remate: en los partidos en los
 *      que los remates no suman el `Goal` de `opta:partidos`, el resultado
 *      final sale de `opta:partidos` (y los puntos, de él) y el gol en propia
 *      se coloca donde lo pide el `MatchState` de Opta del gol siguiente
 *      (ganando / empatando / perdiendo); si no cambia ningún estado, se deja
 *      al final. En los partidos que cuadran, el `MatchState` coincide con el
 *      marcador reconstruido en todos los goles (512 de 512 el 10/11/2026).
 *    - «Desde el banquillo»: `opta:jugadores-partidos` con GS = 0 y Min > 0.
 *
 * 4. TEMPORADA A TEMPORADA: el mismo `playerId` en `opta:hist:*:jugadores`.
 */

import { CASTILLA_OPTA, num, percentil, type Celda } from "@/lib/opta";
import type { Remate } from "@/lib/opta-eventos";
import { FAMILIA_PUESTO } from "@/lib/opta-nombres";

export type Fila = Record<string, Celda>;

/* ------------------------------------------------------------------ */
/*  FAMILIAS ANCHAS                                                    */
/* ------------------------------------------------------------------ */

export const FAMILIAS_ANCHAS = ["Defensas", "Centrocampistas", "Delanteros"] as const;
export type FamiliaAncha = (typeof FAMILIAS_ANCHAS)[number];

const ANCHA_DE: Record<string, FamiliaAncha> = {
  Centrales: "Defensas",
  Laterales: "Defensas",
  Mediocentros: "Centrocampistas",
  Mediapuntas: "Centrocampistas",
  Bandas: "Delanteros",
  Delanteros: "Delanteros",
};

export const familiaFina = (f: Fila): string => FAMILIA_PUESTO[String(f.puesto ?? "")] ?? "";
export const familiaAncha = (f: Fila): FamiliaAncha | null => ANCHA_DE[familiaFina(f)] ?? null;

/* ------------------------------------------------------------------ */
/*  VALOR POR 90                                                       */
/* ------------------------------------------------------------------ */

/** Las tasas de `opta:jugadores` (vienen en tanto por uno y no se dividen). */
export const TASAS = new Set(["Pass%", "Ps%InA3rd", "OnTarget%", "LongBall%", "Tackle%", "Duel%", "Aerial%", "Arl%AH", "Arl%DH"]);

/** De qué columna sale el «cuántas veces» de cada porcentaje, y cuántas hacen falta para juzgarlo. */
export const BASE_TASA: Record<string, { col: string; min: number }> = {
  "Pass%": { col: "PsAtt", min: 50 },
  "Ps%InA3rd": { col: "TchsA3", min: 30 },
  "OnTarget%": { col: "ShtIncBl", min: 10 },
  "LongBall%": { col: "PsAtt", min: 50 },
  "Aerial%": { col: "AerialWon", min: 5 },
};

/** Recuento por 90 o tasa tal cual. null si no hay dato o minutos. */
export function valor90(f: Fila, a: string): number | null {
  const v = num(f[a]);
  if (v == null) return null;
  if (TASAS.has(a)) return v;
  const m = num(f.Min);
  return m && m > 0 ? (v / m) * 90 : null;
}

/** ¿La tasa sale de tan pocos intentos que no se juzga? */
export function muestraCorta(f: Fila, a: string): boolean {
  const b = BASE_TASA[a];
  if (!b) return false;
  return (num(f[b.col]) ?? 0) < b.min;
}

/* ------------------------------------------------------------------ */
/*  1. DISPERSIÓN                                                      */
/* ------------------------------------------------------------------ */

export type PuntoTalento = {
  id: string;
  jugador: string;
  teamId: string;
  equipo: string;
  puesto: string;
  familia: FamiliaAncha;
  min: number;
  vx: number;
  vy: number;
  px: number;
  py: number;
};

/**
 * Los jugadores de campo con `minimo` minutos o más, cada uno con el
 * percentil de sus dos métricas por 90 frente a los de su familia ancha y su
 * ámbito (los que entran en `filas`).
 */
export function puntosPercentil(filas: Fila[], mx: string, my: string, minimo: number, inversoX = false, inversoY = false): PuntoTalento[] {
  const base = filas
    .map((f) => ({ f, fam: familiaAncha(f), min: num(f.Min) ?? 0 }))
    .filter((x): x is { f: Fila; fam: FamiliaAncha; min: number } => x.fam != null && x.min >= minimo)
    .map((x) => ({ ...x, vx: valor90(x.f, mx), vy: valor90(x.f, my) }))
    .filter((x) => x.vx != null && x.vy != null && !muestraCorta(x.f, mx) && !muestraCorta(x.f, my));
  const muestras = new Map<FamiliaAncha, { xs: number[]; ys: number[] }>();
  for (const x of base) {
    const m = muestras.get(x.fam) ?? { xs: [], ys: [] };
    m.xs.push(x.vx!);
    m.ys.push(x.vy!);
    muestras.set(x.fam, m);
  }
  return base.map((x) => {
    const m = muestras.get(x.fam)!;
    return {
      id: String(x.f.playerId ?? ""),
      jugador: String(x.f.jugador ?? ""),
      teamId: String(x.f.teamId ?? ""),
      equipo: String(x.f.equipo ?? ""),
      puesto: String(x.f.puesto ?? ""),
      familia: x.fam,
      min: x.min,
      vx: x.vx!,
      vy: x.vy!,
      px: percentil(x.vx, m.xs, inversoX) ?? 0,
      py: percentil(x.vy, m.ys, inversoY) ?? 0,
    };
  });
}

/** Rangos con empates al promedio (1 = el menor). */
function rangos(xs: number[]): number[] {
  const orden = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < orden.length; ) {
    let j = i;
    while (j + 1 < orden.length && orden[j + 1].v === orden[i].v) j++;
    const medio = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[orden[k].i] = medio;
    i = j + 1;
  }
  return r;
}

/** Correlación de rangos de Spearman (Pearson sobre rangos, con empates). */
export function spearman(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return null;
  const rx = rangos(xs.slice(0, n));
  const ry = rangos(ys.slice(0, n));
  const mx = rx.reduce((s, v) => s + v, 0) / n;
  const my = ry.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (rx[i] - mx) * (ry[i] - my);
    sxx += (rx[i] - mx) ** 2;
    syy += (ry[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

/** La correlación en una frase. */
export function lecturaSpearman(rho: number, nx: string, ny: string): string {
  const a = Math.abs(rho);
  const fuerza = a < 0.1 ? "nada" : a < 0.3 ? "poco" : a < 0.5 ? "algo" : a < 0.7 ? "bastante" : "mucho";
  if (a < 0.1) return `Ir bien en ${nx} no dice nada de ${ny}: son dos talentos distintos, y quien destaca en los dos es raro.`;
  if (rho > 0)
    return `Se parecen ${fuerza}: quien va alto en ${nx} tiende a ir alto en ${ny}${a < 0.5 ? ", pero hay muchos que sólo hacen una de las dos cosas" : ""}.`;
  return `Van ${fuerza} en contra: quien va alto en ${nx} suele ir bajo en ${ny}; destacar en las dos es lo raro.`;
}

/* ------------------------------------------------------------------ */
/*  2. PERFILES                                                        */
/* ------------------------------------------------------------------ */

export type Perfil = {
  clave: string;
  nombre: string;
  que: string;
  /** Familias finas (`FAMILIA_PUESTO`) a las que se aplica. */
  familias: string[];
  /** Métricas; `inverso` cuando menos es mejor. */
  metricas: { a: string; inverso?: boolean }[];
};

export const PERFILES: Perfil[] = [
  {
    clave: "rematador",
    nombre: "Rematador",
    que: "Vive en el área y remata mucho y bien.",
    familias: ["Delanteros", "Bandas"],
    metricas: [{ a: "Goal" }, { a: "GoalExPn" }, { a: "ExpG" }, { a: "ShtIncBl" }, { a: "SOG" }, { a: "TouchOpBox" }],
  },
  {
    clave: "delantero-defiende",
    nombre: "Delantero que defiende",
    que: "Presiona arriba, roba en campo rival y gana duelos.",
    familias: ["Delanteros", "Bandas"],
    metricas: [{ a: "PosWonA3rd" }, { a: "IntA3" }, { a: "Recovery" }, { a: "Duel%" }, { a: "Tackle%" }, { a: "AerialWon" }],
  },
  {
    clave: "creador",
    nombre: "Creador",
    que: "Fabrica ocasiones con el último pase.",
    familias: ["Mediapuntas", "Mediocentros", "Bandas", "Delanteros"],
    metricas: [{ a: "Chance" }, { a: "KeyPass" }, { a: "xA" }, { a: "Ast" }, { a: "ThrghBalls" }, { a: "Ps%InA3rd" }],
  },
  {
    clave: "extremo-regate",
    nombre: "Extremo desequilibrante",
    que: "Encara en el área, provoca faltas y genera tras el regate.",
    familias: ["Bandas", "Mediapuntas"],
    metricas: [{ a: "1v1InBox" }, { a: "Sc1v1InBox" }, { a: "KPAf1v1" }, { a: "TouchOpBox" }, { a: "FoulSuf" }, { a: "Disposs", inverso: true }],
  },
  {
    clave: "recuperador",
    nombre: "Mediocentro recuperador",
    que: "Roba, intercepta y gana duelos en el medio.",
    familias: ["Mediocentros"],
    metricas: [{ a: "Recovery" }, { a: "PosWonM3rd" }, { a: "Int" }, { a: "Tackle%" }, { a: "Duel%" }, { a: "Aerial%" }],
  },
  {
    clave: "central-salida",
    nombre: "Central con salida",
    que: "Da muchos pases, los acierta, llega lejos y no la pierde.",
    familias: ["Centrales"],
    metricas: [{ a: "PsAtt" }, { a: "Pass%" }, { a: "LgBallCp" }, { a: "TchsM3" }, { a: "ThrghBalls" }, { a: "PossLost", inverso: true }],
  },
  {
    clave: "lateral-profundo",
    nombre: "Lateral profundo",
    que: "Pisa el último tercio, centra y crea.",
    familias: ["Laterales"],
    metricas: [{ a: "TchsA3" }, { a: "Crosses" }, { a: "CrossCmp" }, { a: "Chance" }, { a: "xA" }, { a: "TouchOpBox" }],
  },
];

export type FilaPerfil = {
  id: string;
  jugador: string;
  teamId: string;
  equipo: string;
  puesto: string;
  familia: string;
  min: number;
  edad: number | null;
  nota: number | null;
  /** Percentil de cada métrica del perfil (null si no hay dato o la muestra es corta). */
  adn: { a: string; p: number | null; v: number | null; corta: boolean }[];
};

/**
 * La nota de perfil de cada jugador de `candidatos`, con el percentil de cada
 * métrica frente a los de SU puesto en `poblacion` (con el mínimo).
 */
export function rankingPerfil(poblacion: Fila[], candidatos: Fila[], perfil: Perfil, minimo: number): FilaPerfil[] {
  const elegibles = poblacion.filter((f) => (num(f.Min) ?? 0) >= minimo && familiaFina(f));
  const muestras = new Map<string, number[]>();
  for (const f of elegibles)
    for (const m of perfil.metricas) {
      if (muestraCorta(f, m.a)) continue;
      const v = valor90(f, m.a);
      if (v == null) continue;
      const k = `${familiaFina(f)}|${m.a}`;
      const xs = muestras.get(k) ?? [];
      xs.push(v);
      muestras.set(k, xs);
    }
  return candidatos
    .filter((f) => (num(f.Min) ?? 0) >= minimo && perfil.familias.includes(familiaFina(f)))
    .map((f) => {
      const fam = familiaFina(f);
      const adn = perfil.metricas.map((m) => {
        const v = valor90(f, m.a);
        const corta = muestraCorta(f, m.a);
        const p = v == null || corta ? null : percentil(v, muestras.get(`${fam}|${m.a}`) ?? [], Boolean(m.inverso));
        return { a: m.a, p, v, corta };
      });
      const ps = adn.map((x) => x.p).filter((p): p is number => p != null);
      return {
        id: String(f.playerId ?? ""),
        jugador: String(f.jugador ?? ""),
        teamId: String(f.teamId ?? ""),
        equipo: String(f.equipo ?? ""),
        puesto: String(f.puesto ?? ""),
        familia: fam,
        min: num(f.Min) ?? 0,
        edad: num(f.Age),
        /* Con menos de la mitad de las métricas juzgables, no hay nota. */
        nota: ps.length * 2 >= perfil.metricas.length ? ps.reduce((s, p) => s + p, 0) / ps.length : null,
        adn,
      };
    })
    .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
}

/* ------------------------------------------------------------------ */
/*  3a. GOLES QUE VALEN PUNTOS                                         */
/* ------------------------------------------------------------------ */

export type MomentoGol = "delante" | "empate" | "ampliar" | "recortar";

export const NOMBRE_MOMENTO: Record<MomentoGol, string> = {
  delante: "Para ponerse por delante",
  empate: "Para empatar",
  ampliar: "Para ampliar",
  recortar: "Para recortar",
};

export type GolContado = {
  partido: string;
  teamId: string;
  tiradorId: string;
  tirador: string;
  parte: number;
  segundo: number;
  penalti: boolean;
  /** Diferencia (propios − rival) justo antes del gol. */
  antes: number;
  momento: MomentoGol;
  /** Puntos que da el gol: los del resultado final menos los que habría sin él. */
  puntos: number;
  /** El partido no cuadra (gol en propia): el momento sale con el estado de Opta. */
  incierto: boolean;
};

export type ResumenGoleador = {
  id: string;
  jugador: string;
  teamId: string;
  goles: number;
  puntos: number;
  decisivos: number;
  momentos: Record<MomentoGol, number>;
  pctDecisivos: number;
  penaltis: number;
  inciertos: number;
};

const puntosDe = (gf: number, gc: number) => (gf > gc ? 3 : gf === gc ? 1 : 0);

const momentoDe = (d: number): MomentoGol => (d === 0 ? "delante" : d === -1 ? "empate" : d < -1 ? "recortar" : "ampliar");

const estadoDe = (d: number) => (d > 0 ? "Ahead" : d < 0 ? "Behind" : "Tied");

export type CuadreGoles = {
  goles: GolContado[];
  /** Partidos en los que los remates no suman lo de `opta:partidos`. */
  noCuadran: { partido: string; teamId: string; remates: number; oficial: number }[];
  /** Goles de esos partidos (su «momento» puede variar en uno). */
  inciertos: number;
};

/**
 * Reconstruye el marcador de cada partido con los goles de los remates (en
 * orden de parte y segundo) y lo cuadra con `opta:partidos`.
 */
export function golesConMarcador(remates: Remate[], partidos: Fila[]): CuadreGoles {
  /* Resultado oficial: partido → teamId → goles. */
  const oficial = new Map<string, Map<string, number>>();
  for (const f of partidos) {
    const p = String(f.partido ?? "");
    const t = String(f.teamId ?? "");
    const g = num(f.Goal);
    if (!p || !t || g == null) continue;
    if (!oficial.has(p)) oficial.set(p, new Map());
    oficial.get(p)!.set(t, g);
  }

  const porPartido = new Map<string, Remate[]>();
  for (const r of remates) if (r.gol) porPartido.set(r.partido, [...(porPartido.get(r.partido) ?? []), r]);

  const salida: GolContado[] = [];
  const noCuadran: CuadreGoles["noCuadran"] = [];
  let inciertos = 0;

  for (const [p, marcador] of oficial) {
    const equipos = [...marcador.keys()];
    if (equipos.length !== 2) continue;
    const gs = [...(porPartido.get(p) ?? [])].sort((a, b) => a.parte - b.parte || a.segundo - b.segundo);
    /* Goles que faltan de cada equipo (en propia puerta del rival). */
    const faltan = new Map<string, number>();
    let cuadra = true;
    for (const t of equipos) {
      const deRemate = gs.filter((g) => g.teamId === t).length;
      const of = marcador.get(t)!;
      if (deRemate !== of) {
        cuadra = false;
        noCuadran.push({ partido: p, teamId: t, remates: deRemate, oficial: of });
      }
      faltan.set(t, Math.max(0, of - deRemate));
    }
    const cuenta = new Map<string, number>(equipos.map((t) => [t, 0]));
    const final = (t: string) => marcador.get(t)!;
    for (const g of gs) {
      const yo = g.teamId;
      const otro = equipos.find((t) => t !== yo);
      if (!otro || !marcador.has(yo)) continue;
      /* Si el estado de Opta no casa, delante va un gol en propia que no salió como remate. */
      if (!cuadra && g.marcador) {
        for (let vuelta = 0; vuelta < 6 && estadoDe(cuenta.get(yo)! - cuenta.get(otro)!) !== g.marcador; vuelta++) {
          const d = cuenta.get(yo)! - cuenta.get(otro)!;
          const quien = (g.marcador === "Ahead" || (g.marcador === "Tied" && d < 0)) ? yo : otro;
          if ((faltan.get(quien) ?? 0) <= 0) break;
          faltan.set(quien, faltan.get(quien)! - 1);
          cuenta.set(quien, cuenta.get(quien)! + 1);
        }
      }
      const antes = cuenta.get(yo)! - cuenta.get(otro)!;
      const con = puntosDe(final(yo), final(otro));
      const sin = puntosDe(final(yo) - 1, final(otro));
      salida.push({
        partido: p,
        teamId: yo,
        tiradorId: g.tiradorId,
        tirador: g.tirador,
        parte: g.parte,
        segundo: g.segundo,
        penalti: g.tipo === "PenaltyGoal",
        antes,
        momento: momentoDe(antes),
        puntos: con - sin,
        incierto: !cuadra,
      });
      if (!cuadra) inciertos++;
      cuenta.set(yo, cuenta.get(yo)! + 1);
    }
  }
  return { goles: salida, noCuadran, inciertos };
}

export function goleadores(goles: GolContado[]): ResumenGoleador[] {
  const m = new Map<string, ResumenGoleador>();
  for (const g of goles) {
    const id = g.tiradorId || g.tirador;
    if (!id) continue;
    const r = m.get(id) ?? {
      id,
      jugador: g.tirador,
      teamId: g.teamId,
      goles: 0,
      puntos: 0,
      decisivos: 0,
      momentos: { delante: 0, empate: 0, ampliar: 0, recortar: 0 },
      pctDecisivos: 0,
      penaltis: 0,
      inciertos: 0,
    };
    r.goles++;
    r.puntos += g.puntos;
    if (g.puntos > 0) r.decisivos++;
    r.momentos[g.momento]++;
    if (g.penalti) r.penaltis++;
    if (g.incierto) r.inciertos++;
    r.teamId = g.teamId;
    m.set(id, r);
  }
  return [...m.values()]
    .map((r) => ({ ...r, pctDecisivos: r.goles ? r.decisivos / r.goles : 0 }))
    .sort((a, b) => b.puntos - a.puntos || b.decisivos - a.decisivos || b.goles - a.goles);
}

/* ------------------------------------------------------------------ */
/*  3b. DESDE EL BANQUILLO                                             */
/* ------------------------------------------------------------------ */

export type Suplente = {
  id: string;
  jugador: string;
  teamId: string;
  partidosSup: number;
  minSup: number;
  golesSup: number;
  tirosSup: number;
  xgSup: number;
  /** Sólo con 90′ o más en ese papel. */
  g90Sup: number | null;
  partidosTit: number;
  minTit: number;
  golesTit: number;
  g90Tit: number | null;
};

export function desdeElBanquillo(filas: Fila[]): Suplente[] {
  const m = new Map<string, Suplente>();
  for (const f of filas) {
    const min = num(f.Min) ?? 0;
    if (min <= 0) continue;
    const id = String(f.playerId ?? "");
    if (!id) continue;
    const s = m.get(id) ?? {
      id,
      jugador: String(f.jugador ?? ""),
      teamId: String(f.teamId ?? ""),
      partidosSup: 0,
      minSup: 0,
      golesSup: 0,
      tirosSup: 0,
      xgSup: 0,
      g90Sup: null,
      partidosTit: 0,
      minTit: 0,
      golesTit: 0,
      g90Tit: null,
    };
    if (num(f.GS) === 1) {
      s.partidosTit++;
      s.minTit += min;
      s.golesTit += num(f.Goal) ?? 0;
    } else {
      s.partidosSup++;
      s.minSup += min;
      s.golesSup += num(f.Goal) ?? 0;
      s.tirosSup += num(f.ShtIncBl) ?? 0;
      s.xgSup += num(f.ExpG) ?? 0;
    }
    s.teamId = String(f.teamId ?? s.teamId);
    m.set(id, s);
  }
  return [...m.values()]
    .filter((s) => s.partidosSup > 0)
    .map((s) => ({
      ...s,
      g90Sup: s.minSup >= 90 ? (s.golesSup / s.minSup) * 90 : null,
      g90Tit: s.minTit >= 90 ? (s.golesTit / s.minTit) * 90 : null,
    }));
}

/* ------------------------------------------------------------------ */
/*  4. TEMPORADA A TEMPORADA                                           */
/* ------------------------------------------------------------------ */

export const METRICAS_TEMPORADA: { a: string; nombre: string; tasa?: boolean }[] = [
  { a: "Goal", nombre: "Goles" },
  { a: "ShtIncBl", nombre: "Remates" },
  { a: "SOG", nombre: "A puerta" },
  { a: "Ast", nombre: "Asistencias" },
  { a: "KeyPass", nombre: "Pases clave" },
  { a: "1v1InBox", nombre: "Regates en el área" },
  { a: "Recovery", nombre: "Recuperaciones" },
];

export type TarjetaTemporada = {
  clave: string;
  equipo: string;
  teamId: string;
  min: number;
  partidos: number | null;
  puesto: string;
  valores: { a: string; nombre: string; total: number | null; p90: number | null; p: number | null }[];
  /** Con cuántos de su puesto se compara (con el mínimo de minutos). */
  comparados: number;
  familia: string;
  /** Partidos de su equipo que trae la tabla (null en la temporada en curso, que no se mide). */
  partidosEquipo: number | null;
  /** La tabla no trae la temporada entera de su equipo: sin percentil. */
  incompleta: boolean;
};

/** Con menos de su puesto en la tabla, el percentil no dice nada. */
export const COMPARADOS_MIN = 10;

/*
| LA COBERTURA DE CADA TEMPORADA (12/11/2026).
|
| Las tablas pasadas de Opta no traen la temporada entera de todos: la 25/26
| tiene los 20 equipos del grupo del Castilla, pero de casi todos sólo 2 o 3
| partidos (del Castilla, 3; del Athletic Club II, 38). Con eso, el percentil
| de un jugador sale de compararle con gente que jugó un partido o dos, y la
| tarjeta lo daba como si fuera su temporada. Ahora se mide: los partidos de
| un equipo en la tabla son los del que más jugó de ese equipo (`GM`), y con
| menos de `PARTIDOS_COMPLETA` la temporada de ese equipo cuenta como
| incompleta: su tarjeta lo dice y no lleva percentil, y sus jugadores tampoco
| entran en el percentil de los demás.
*/

/** Una temporada de grupo son 38 jornadas. */
export const JORNADAS_TEMPORADA = 38;

/** Desde aquí (8 de cada 10 jornadas) la temporada de un equipo se da por completa. */
export const PARTIDOS_COMPLETA = 30;

/** Partidos de cada equipo (teamId) que trae una tabla de jugadores. */
export function partidosPorEquipo(filas: Fila[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of filas) {
    const id = String(f.teamId ?? "");
    if (!id) continue;
    m.set(id, Math.max(m.get(id) ?? 0, num(f.GM) ?? 0));
  }
  return m;
}

/** La tarjeta de una temporada para `playerId` (null si no aparece o no jugó). */
export function tarjetaTemporada(
  clave: string,
  filas: Fila[],
  playerId: string,
  minimo: number,
  /** Sólo en las temporadas cerradas: partidos de cada equipo en la tabla, para medir la cobertura. */
  cobertura?: Map<string, number>,
): TarjetaTemporada | null {
  const f = filas.find((x) => String(x.playerId ?? "") === playerId);
  const min = num(f?.Min) ?? 0;
  if (!f || min <= 0) return null;
  const fam = familiaFina(f);
  const completo = (x: Fila) => !cobertura || (cobertura.get(String(x.teamId ?? "")) ?? 0) >= PARTIDOS_COMPLETA;
  const partidosEquipo = cobertura ? (cobertura.get(String(f.teamId ?? "")) ?? 0) : null;
  const incompleta = Boolean(cobertura) && !completo(f);
  const pares = filas.filter((x) => familiaFina(x) === fam && (num(x.Min) ?? 0) >= minimo && completo(x));
  return {
    clave,
    equipo: f.teamId === CASTILLA_OPTA ? "Real Madrid Castilla" : String(f.equipo ?? ""),
    teamId: String(f.teamId ?? ""),
    min,
    partidos: num(f.GM),
    puesto: String(f.puesto ?? ""),
    familia: fam,
    comparados: pares.length,
    partidosEquipo,
    incompleta,
    valores: METRICAS_TEMPORADA.filter((m) => f[m.a] !== undefined).map((m) => {
      const total = num(f[m.a]);
      const p90 = valor90(f, m.a);
      const p = fam && !incompleta && p90 != null && min >= minimo && pares.length >= COMPARADOS_MIN ? percentil(p90, pares.map((x) => valor90(x, m.a))) : null;
      return { a: m.a, nombre: m.nombre, total, p90, p };
    }),
  };
}
