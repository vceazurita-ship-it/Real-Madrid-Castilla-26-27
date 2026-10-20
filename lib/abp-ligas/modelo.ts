/**
 * EL BALÓN PARADO DE CADA LIGA (laboratorio de ABP, 20/10/2026)
 *
 * Lee `public/data/abp-ligas.json` —lo escribe `scripts/abp-ligas.cjs` desde
 * los «Team Stats» de Wyscout— y lo cuenta por equipo: por partido, cuántas
 * acciones de cada tipo acaban en remate (por cada 100) y lo mismo en contra.
 *
 * Dos reglas de DATA que aquí también mandan:
 *   - **Un cociente se recalcula sumando**, nunca promediando los % de cada
 *     partido (ver `metricas.ts`).
 *   - **El percentil va orientado**: en lo que se concede, menos es mejor, y el
 *     percentil ya devuelve «qué bien está».
 *
 * Wyscout NO trae goles esperados a balón parado ni saques de banda: no se
 * nombran.
 */
import type { Unidad } from "@/lib/data-analisis/metricas";

/** Las columnas del JSON, en el orden de `scripts/abp-ligas.cjs`. */
const C = { abp: 0, abpRem: 1, cor: 2, corRem: 3, fal: 4, falRem: 5, pen: 6, penGol: 7, tiros: 8 } as const;

type Columna = keyof typeof C;

const N = Object.keys(C).length;

export type LigaAbp = {
  slug: string;
  nombre: string;
  corto: string;
  competicion: string;
  temporada: string;
  equipos: string[];
  /** [fecha, equipo, rival, golesFavor, golesContra, ...9 a favor, ...9 en contra] */
  partidos: (string | number | null)[][];
};

export type AbpLigas = { version: number; generado: string; ligas: LigaAbp[] };

/** Un partido de un equipo, ya desplegado. */
export type PartidoAbp = {
  fecha: string;
  equipo: string;
  rival: string;
  golesFavor: number;
  golesContra: number;
  favor: Record<Columna, number | null>;
  contra: Record<Columna, number | null>;
};

export function partidosDe(liga: LigaAbp): PartidoAbp[] {
  const lado = (fila: (string | number | null)[], desde: number) =>
    Object.fromEntries((Object.keys(C) as Columna[]).map((k) => [k, (fila[desde + C[k]] as number | null) ?? null])) as Record<Columna, number | null>;

  return liga.partidos.map((f) => ({
    fecha: String(f[0]),
    equipo: liga.equipos[Number(f[1])],
    rival: liga.equipos[Number(f[2])],
    golesFavor: Number(f[3] ?? 0),
    golesContra: Number(f[4] ?? 0),
    favor: lado(f, 5),
    contra: lado(f, 5 + N),
  }));
}

/* ------------------------------------------------------------------ */
/*  LAS MÉTRICAS                                                       */
/* ------------------------------------------------------------------ */

export type Lado = "favor" | "contra";

export type MetricaAbp = {
  key: string;
  nombre: string;
  /** Cómo se dice en una frase corta («córners con remate»). */
  corto: string;
  lado: Lado;
  unidad: Unidad;
  /** Lo que se concede es mejor bajo; el volumen propio, alto. */
  mejorAlto: boolean | null;
  /** Por partido (suma ÷ partidos) o por cada 100 acciones (suma ÷ suma × 100). */
  numerador: Columna;
  denominador: Columna | "partidos";
  comoLeer: string;
};

const porPartido = (key: string, nombre: string, corto: string, lado: Lado, col: Columna, mejorAlto: boolean | null, comoLeer: string): MetricaAbp => ({
  key,
  nombre,
  corto,
  lado,
  unidad: "decimal",
  mejorAlto,
  numerador: col,
  denominador: "partidos",
  comoLeer,
});

const porCien = (key: string, nombre: string, corto: string, lado: Lado, num: Columna, den: Columna, mejorAlto: boolean | null, comoLeer: string): MetricaAbp => ({
  key,
  nombre,
  corto,
  lado,
  unidad: "porcentaje",
  mejorAlto,
  numerador: num,
  denominador: den,
  comoLeer,
});

export const METRICAS_ABP: MetricaAbp[] = [
  porPartido("abpRemF", "ABP con remate por partido", "jugadas a balón parado con remate", "favor", "abpRem", true, "Cuántas jugadas a balón parado acaban en remate propio cada partido. Es la medida de peligro más directa que trae Wyscout."),
  porPartido("abpRemC", "ABP con remate en contra por partido", "remates de balón parado en contra", "contra", "abpRem", false, "Cuántas jugadas a balón parado del rival acaban en remate cada partido. Menos es mejor."),
  porCien("abpPctF", "ABP que acaban en remate (por cada 100)", "balón parado que acaba en remate", "favor", "abpRem", "abp", true, "De cada 100 jugadas a balón parado propias, cuántas terminan en remate. Mide la calidad del saque y de la llegada, no el volumen."),
  porCien("abpPctC", "ABP del rival que acaban en remate (por cada 100)", "balón parado del rival que acaba en remate", "contra", "abpRem", "abp", false, "De cada 100 jugadas a balón parado del rival, cuántas acaban en remate. Menos es mejor."),
  porCien("corPctF", "Córners con remate (por cada 100)", "córners con remate", "favor", "corRem", "cor", true, "De cada 100 córners propios, cuántos acaban en remate."),
  porCien("corPctC", "Córners en contra con remate (por cada 100)", "córners del rival con remate", "contra", "corRem", "cor", false, "De cada 100 córners del rival, cuántos acaban en remate. Menos es mejor."),
  porCien("falPctF", "Faltas con remate (por cada 100)", "faltas con remate", "favor", "falRem", "fal", true, "De cada 100 faltas propias (directas y laterales), cuántas acaban en remate."),
  porCien("falPctC", "Faltas en contra con remate (por cada 100)", "faltas del rival con remate", "contra", "falRem", "fal", false, "De cada 100 faltas del rival, cuántas acaban en remate. Menos es mejor."),
  porPartido("corF", "Córners por partido", "córners a favor", "favor", "cor", null, "Volumen: cuántos córners se sacan. Es estilo (llegar por fuera y forzarlos), no rendimiento."),
  porPartido("corC", "Córners concedidos por partido", "córners concedidos", "contra", "cor", false, "Cuántos córners saca el rival cada partido. Menos es mejor."),
  porPartido("falF", "Faltas a favor por partido", "faltas a favor", "favor", "fal", null, "Volumen de faltas que se sacan (Wyscout las llama «tiros libres»)."),
  porPartido("penF", "Penaltis a favor por partido", "penaltis a favor", "favor", "pen", true, "Penaltis que nos pitan cada partido. En muestras cortas es ruido."),
  porPartido("penC", "Penaltis en contra por partido", "penaltis en contra", "contra", "pen", false, "Penaltis que nos pitan en contra cada partido. Menos es mejor."),
  porCien("cuotaF", "Remates que nacen de ABP (por cada 100)", "remates que nacen de balón parado", "favor", "abpRem", "tiros", null, "De cada 100 remates propios, cuántos nacen de una jugada a balón parado. Alto puede ser virtud (se ensaya y renta) o aviso (en juego no se llega)."),
];

export const METRICA = Object.fromEntries(METRICAS_ABP.map((m) => [m.key, m])) as Record<string, MetricaAbp>;

/** El valor de una métrica sobre un puñado de partidos. Null si no hay base. */
export function valorDe(partidos: PartidoAbp[], m: MetricaAbp): number | null {
  const filas = partidos.map((p) => p[m.lado]);

  const suma = (col: Columna) => {
    const v = filas.map((f) => f[col]).filter((x): x is number => x !== null);

    return v.length ? v.reduce((a, b) => a + b, 0) : null;
  };

  const num = suma(m.numerador);

  if (num === null) return null;

  if (m.denominador === "partidos") {
    const jugados = filas.filter((f) => f[m.numerador] !== null).length;

    return jugados ? num / jugados : null;
  }

  const den = suma(m.denominador);

  return den ? (num / den) * 100 : null;
}

/** Base de la métrica (las acciones del denominador), para no leer de más una muestra corta. */
export function baseDe(partidos: PartidoAbp[], m: MetricaAbp): number {
  if (m.denominador === "partidos") return partidos.filter((p) => p[m.lado][m.numerador] !== null).length;

  return partidos.reduce((a, p) => a + (p[m.lado][m.denominador as Columna] ?? 0), 0);
}

/* ------------------------------------------------------------------ */
/*  LA LIGA                                                            */
/* ------------------------------------------------------------------ */

export type FilaLiga = { equipo: string; partidos: number; valores: Record<string, number | null> };

export function tablaDe(liga: LigaAbp): FilaLiga[] {
  const todos = partidosDe(liga);

  return liga.equipos.map((equipo) => {
    const suyos = todos.filter((p) => p.equipo === equipo);

    return { equipo, partidos: suyos.length, valores: Object.fromEntries(METRICAS_ABP.map((m) => [m.key, valorDe(suyos, m)])) };
  });
}

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;

  const o = [...valores].sort((a, b) => a - b);

  const mitad = Math.floor(o.length / 2);

  return o.length % 2 ? o[mitad] : (o[mitad - 1] + o[mitad]) / 2;
}

/**
 * Percentil orientado («qué bien está», 0-100) y puesto (1 = el mejor).
 * En las de estilo (`mejorAlto: null`) el puesto es del más alto al más bajo.
 */
export function posicionEn(tabla: FilaLiga[], equipo: string, m: MetricaAbp) {
  const valores = tabla.map((f) => ({ equipo: f.equipo, v: f.valores[m.key] })).filter((x): x is { equipo: string; v: number } => x.v !== null);

  const mio = valores.find((x) => x.equipo === equipo)?.v ?? null;

  if (mio === null || valores.length < 2) return { valor: mio, percentil: null, puesto: null, de: valores.length, mediana: mediana(valores.map((x) => x.v)) };

  const alto = m.mejorAlto !== false;

  const peores = valores.filter((x) => (alto ? x.v < mio : x.v > mio)).length;

  const iguales = valores.filter((x) => x.v === mio).length - 1;

  const mejores = valores.filter((x) => (alto ? x.v > mio : x.v < mio)).length;

  return {
    valor: mio,
    percentil: ((peores + iguales / 2) / (valores.length - 1)) * 100,
    puesto: mejores + 1,
    de: valores.length,
    mediana: mediana(valores.map((x) => x.v)),
  };
}

/** Partido a partido de un equipo en una métrica, con su rival. */
export function serieDe(liga: LigaAbp, equipo: string, m: MetricaAbp) {
  return partidosDe(liga)
    .filter((p) => p.equipo === equipo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((p, i) => ({ etiqueta: `${i + 1}`, valor: valorDe([p], m), nota: `${p.rival} · ${p.golesFavor}-${p.golesContra} · ${p.fecha.slice(8, 10)}/${p.fecha.slice(5, 7)}` }));
}

/** Busca un equipo por su nombre corto («Arsenal», «Castilla»). */
export function equipoQueCasa(liga: LigaAbp, buscado: string) {
  const b = buscado.toLowerCase();

  return liga.equipos.find((e) => e.toLowerCase() === b) ?? liga.equipos.find((e) => e.toLowerCase().includes(b)) ?? "";
}
