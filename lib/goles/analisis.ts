/*
|--------------------------------------------------------------------------
| ANÁLISIS DE GOLES: NUESTROS Y DE TODA LA LIGA (13/10/2026)
|--------------------------------------------------------------------------
|
| El documento `goles:analisis` lo escribe cada noche `scripts/goles-liga.mjs`
| (paso de `jornada-nocturna.cmd`, justo después del informe de rivales):
|
|   - los goles de todos los partidos de liga, con su minuto, de BeSoccer
|     (`rivals:informe`: cada partido sale dos veces, una por equipo, y
|     `propio` dice si el gol es del equipo de esa ficha);
|   - los remates, a puerta y xG de cada equipo y partido, de Wyscout
|     (`public/data/analisis.json`), que no traen minuto;
|   - la tipología de los goles de nuestros partidos y los remates por minuto,
|     del timeline de Hudl (el etiquetado de Wyscout del partido), y el texto
|     de cada gol de la grabación táctica cuando lo hay.
|
| Nadie publica de dónde viene cada gol del resto de la liga: de ellos sólo
| se sabe si fue de penalti o en propia puerta. La tipología completa es de
| nuestros partidos, y el cuerpo técnico la puede corregir gol a gol
| (`goles:tipologia-manual`, que manda sobre la de Hudl).
|
| Aquí van los tipos y la aritmética, sin React: lo usan la pantalla
| `/analisis-goles` y el script.
*/

import { mismoEquipo } from "@/lib/data-analisis/nombres";

export const DOC_GOLES = "goles:analisis";
export const DOC_TIPOLOGIA_MANUAL = "goles:tipologia-manual";
export const CASTILLA = "Real Madrid Castilla";

export type Lado = "local" | "visitante";

export type Gol = {
  /** El minuto que corre (1-45, 46-90); en el descuento, 45 o 90. */
  min: number;
  /** Los minutos de descuento («45+2» → 2). 0 si no es descuento. */
  extra: number;
  parte: 1 | 2;
  lado: Lado;
  /** Lo que dice BeSoccer: penalti, en propia puerta o nada. */
  tipo: "" | "penalti" | "propia";
  jugador: string;
  asistente?: string;
};

export type RematesWyscout = {
  goles: number;
  tiros: number;
  aPuerta: number;
  xg: number;
  /** Tiros de fuera del área. */
  fuera: number;
  /** Ataques que acaban en remate, por fase. */
  posicional: number;
  contra: number;
  abp: number;
};

export type PartidoGoles = {
  /** El id de BeSoccer. */
  id: string;
  jornada: number;
  fecha: string;
  local: string;
  visitante: string;
  escudoLocal?: string;
  escudoVisitante?: string;
  gl: number;
  gv: number;
  goles: Gol[];
  /** Wyscout, por lado (si está descargado). */
  wys?: Partial<Record<Lado, RematesWyscout>>;
};

/* La tipología, como la hoja del cuerpo técnico. */
export const FASES = [
  {
    fase: "AT. ORGANIZADO",
    tipos: [
      { clave: "dentro", nombre: "Dentro" },
      { clave: "bandaD", nombre: "Banda D" },
      { clave: "bandaI", nombre: "Banda I" },
      { clave: "espalda", nombre: "Espalda" },
      { clave: "caida", nombre: "Caída / 2ª acción" },
      { clave: "error", nombre: "Tras error" },
    ],
  },
  {
    fase: "TRANSICIÓN",
    tipos: [
      { clave: "transContrario", nombre: "Campo contrario" },
      { clave: "transPropio", nombre: "Campo propio" },
    ],
  },
  {
    fase: "ABP",
    tipos: [
      { clave: "corner", nombre: "Córner" },
      { clave: "faltaLateral", nombre: "Falta lateral" },
      { clave: "faltaDirecta", nombre: "Falta directa" },
      { clave: "banda", nombre: "Saque de banda" },
      { clave: "penalti", nombre: "Penalti" },
    ],
  },
] as const;

export type TipoGol = (typeof FASES)[number]["tipos"][number]["clave"];

export const NOMBRE_TIPO = Object.fromEntries(FASES.flatMap((f) => f.tipos.map((t) => [t.clave, t.nombre]))) as Record<TipoGol, string>;
export const FASE_DE = Object.fromEntries(FASES.flatMap((f) => f.tipos.map((t) => [t.clave, f.fase]))) as Record<TipoGol, string>;

/** Un gol de nuestros partidos, clasificado (la clave es `<idPartido>:<n.º de gol en el partido>`). */
export type TipologiaGol = {
  tipo: TipoGol | null;
  /** Por qué: lo que se ha visto en Hudl. */
  motivo: string;
  /** El texto del gol en la grabación táctica, si lo hay. */
  texto?: string;
};

/** Un remate de nuestros partidos, del timeline de Hudl. */
export type RemateHudl = { min: number; extra: number; parte: 1 | 2; nuestro: boolean; aPuerta: boolean; gol: boolean };

export type GolesDoc = {
  actualizado: string;
  temporada: string;
  partidos: PartidoGoles[];
  tipologia: Record<string, TipologiaGol>;
  /** Por id de partido: los remates del timeline de Hudl. */
  remates: Record<string, RemateHudl[]>;
  /** Partidos nuestros sin timeline todavía (para decirlo en pantalla). */
  sinTimeline: string[];
};

export const GOLES_VACIO: GolesDoc = { actualizado: "", temporada: "", partidos: [], tipologia: {}, remates: {}, sinTimeline: [] };

export type TipologiaManual = Record<string, TipoGol | "">;

/* ------------------------------------------------------------------ */
/*  Franjas                                                            */
/* ------------------------------------------------------------------ */

export type Franja = { clave: string; nombre: string; parte: 1 | 2; desde: number; hasta: number; descuento: boolean };

/**
 * Las franjas de un tamaño (cada 15 por defecto) y, si se piden, los dos
 * descuentos aparte («45+» y «90+»). Sin descuentos aparte, el 45+2 cuenta en
 * la última franja de la primera parte.
 */
export function franjas(tamano: number, descuentos: boolean): Franja[] {
  const t = Math.max(1, Math.min(45, Math.round(tamano)));
  const lista: Franja[] = [];

  for (const parte of [1, 2] as const) {
    const base = parte === 1 ? 0 : 45;

    for (let a = 0; a < 45; a += t) {
      const desde = base + a + 1;
      const hasta = base + Math.min(45, a + t);

      lista.push({ clave: `${parte}-${desde}`, nombre: `${desde}-${hasta}'`, parte, desde, hasta, descuento: false });
    }

    if (descuentos) lista.push({ clave: `${parte}-d`, nombre: parte === 1 ? "45+'" : "90+'", parte, desde: base + 46, hasta: base + 99, descuento: true });
  }

  return lista;
}

/**
 * Franjas a medida, con los cortes escritos a mano: «20, 45, 70» da 1-20,
 * 21-45, 46-70 y 71-90. El 45 se añade siempre (las partes no se mezclan).
 */
export function franjasACortes(texto: string, descuentos: boolean): Franja[] | null {
  const cortes = [...new Set(String(texto).split(/[^\d]+/).filter(Boolean).map(Number).filter((n) => n > 0 && n < 90).concat(45, 90))].sort((a, b) => a - b);

  if (cortes.length < 2) return null;

  const lista: Franja[] = [];
  let desde = 1;

  for (const hasta of cortes) {
    const parte: 1 | 2 = hasta <= 45 ? 1 : 2;

    lista.push({ clave: `${parte}-${desde}`, nombre: `${desde}-${hasta}'`, parte, desde, hasta, descuento: false });

    if (descuentos && (hasta === 45 || hasta === 90)) lista.push({ clave: `${parte}-d`, nombre: `${hasta}+'`, parte, desde: hasta + 1, hasta: hasta + 54, descuento: true });

    desde = hasta + 1;
  }

  return lista;
}

/** En qué franja cae un minuto (con su descuento). */
export function franjaDe(lista: Franja[], min: number, extra: number, parte: 1 | 2): Franja | undefined {
  const normales = lista.filter((f) => f.parte === parte && !f.descuento);

  if (extra > 0 || min > (parte === 1 ? 45 : 90)) return lista.find((f) => f.parte === parte && f.descuento) ?? normales.at(-1);

  return normales.find((f) => min >= f.desde && min <= f.hasta) ?? normales.at(-1);
}

/** «45+2» → {min: 45, extra: 2, parte: 1}. */
export function leeMinuto(texto: string): { min: number; extra: number; parte: 1 | 2 } {
  const m = String(texto).match(/(\d+)(?:\s*\+\s*(\d+))?/);
  const min = m ? Number(m[1]) : 0;
  const extra = m?.[2] ? Number(m[2]) : 0;

  return { min, extra, parte: min <= 45 ? 1 : 2 };
}

export const rotuloMinuto = (g: { min: number; extra: number }) => (g.extra ? `${g.min}+${g.extra}'` : `${g.min}'`);

/* ------------------------------------------------------------------ */
/*  Vista de un equipo                                                 */
/* ------------------------------------------------------------------ */

export type GolVisto = Gol & { partido: PartidoGoles; aFavor: boolean; indice: number; clave: string };

/** Si el equipo jugó el partido, en qué lado. */
export function ladoDe(p: PartidoGoles, equipo: string): Lado | null {
  if (mismoEquipo(p.local, equipo)) return "local";
  if (mismoEquipo(p.visitante, equipo)) return "visitante";

  return null;
}

export const claveGol = (p: PartidoGoles, indice: number) => `${p.id}:${indice}`;

/** Los goles de un equipo (a favor y en contra), con su partido. */
export function golesDe(partidos: PartidoGoles[], equipo: string): GolVisto[] {
  const salida: GolVisto[] = [];

  for (const p of partidos) {
    const lado = ladoDe(p, equipo);

    if (!lado) continue;

    p.goles.forEach((g, indice) => salida.push({ ...g, partido: p, aFavor: g.lado === lado, indice, clave: claveGol(p, indice) }));
  }

  return salida;
}

/** El marcador justo después de un gol, desde el lado del equipo. */
export function marcadorTras(p: PartidoGoles, indice: number, lado: Lado) {
  let a = 0;
  let b = 0;

  for (let i = 0; i <= indice; i += 1) {
    if (p.goles[i].lado === lado) a += 1;
    else b += 1;
  }

  return `${a}-${b}`;
}

/** Quién marcó primero y cómo acabó, desde el lado del equipo. */
export function primerGol(p: PartidoGoles, lado: Lado): { primero: "propio" | "rival" | "nadie"; resultado: "G" | "E" | "P" } {
  const mio = lado === "local" ? p.gl : p.gv;
  const suyo = lado === "local" ? p.gv : p.gl;
  const resultado = mio > suyo ? "G" : mio === suyo ? "E" : "P";
  const g = p.goles[0];

  return { primero: !g ? "nadie" : g.lado === lado ? "propio" : "rival", resultado };
}

export const media = (n: number, d: number) => (d > 0 ? n / d : 0);

export const fmt = (n: number, dec = 2) =>
  Number.isFinite(n) ? n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "—";
