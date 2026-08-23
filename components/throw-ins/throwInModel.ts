import { chipInk } from "@/lib/theme";

// Modelo compartido de saques de banda (ofensivo y defensivo).
//
// Las dos hojas usan el MISMO vocabulario y siempre en términos absolutos:
// un resultado sin sufijo es del RMCF y uno acabado en "Rival" es del rival.
// Por eso "Posicional" en la hoja defensiva significa que recuperamos, y
// "Posicional Rival" en la ofensiva significa que perdimos la posesión.
//
// La hoja defensiva no tiene las columnas Intencion, Sacador, Rutina ni
// Velocidad_Saque: cada vista declara sus columnas en CHART_FIELDS/FILTERS.

export type RecordRow = Record<string, string>;
export type Mode = "offensive" | "defensive";

export function normalizeKey(key: string) {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/** Lee una columna tolerando acentos, espacios y mayúsculas de la hoja. */
export function read(row: RecordRow, key: string) {
  const expected = normalizeKey(key);
  const match = Object.keys(row).find((column) => normalizeKey(column) === expected);
  return match ? row[match]?.trim() ?? "" : "";
}

export function norm(value?: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function numero(value?: string) {
  const parsed = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------- Zona saque

export type Zona = 1 | 2 | 3;
export type Banda = "izq" | "der";

/** Zona 1 = tercio propio del sacador, Zona 3 = su último tercio. */
export function parseZona(row: RecordRow): Zona | null {
  const match = read(row, "Zona_Saque").match(/([1-3])/);
  return match ? (Number(match[1]) as Zona) : null;
}

/** Perfil marca la banda del saque; Zona_Saque es el respaldo si falta. */
export function parseBanda(row: RecordRow): Banda | null {
  const source = norm(`${read(row, "Perfil")} ${read(row, "Zona_Saque")}`);
  if (source.includes("izq") || source.includes("left")) return "izq";
  if (source.includes("der") || source.includes("right")) return "der";
  return null;
}

export const BANDA_LABEL: Record<Banda, string> = {
  izq: "Banda izquierda",
  der: "Banda derecha",
};

/** El sacador de la hoja defensiva es el rival: sus zonas van al revés. */
export function zonaLabel(zona: Zona, mode: Mode) {
  if (mode === "offensive") {
    return zona === 1 ? "Zona 1 · tercio propio" : zona === 2 ? "Zona 2 · medio" : "Zona 3 · último tercio";
  }
  return zona === 1 ? "Zona 1 · su tercio" : zona === 2 ? "Zona 2 · medio" : "Zona 3 · junto a nuestra área";
}

// --------------------------------------------------------------- Zona caída

export type Direccion = {
  label: string;
  sentido: "progresion" | "retroceso" | "area" | null;
  carril: "exterior" | "interior" | "area" | null;
};

/**
 * Zona_Caida guarda la dirección del envío ("Progresión Carril Exterior",
 * "Retroceso Carril Interior", "Area"), no una zona del terreno.
 */
export function parseDireccion(value: string): Direccion {
  const raw = (value || "").trim();
  const t = norm(raw);

  if (!t) return { label: "Sin dato", sentido: null, carril: null };
  if (t.includes("area")) return { label: "Área", sentido: "area", carril: "area" };

  return {
    label: raw,
    sentido: t.includes("progres") ? "progresion" : t.includes("retroces") ? "retroceso" : null,
    carril: t.includes("exterior") ? "exterior" : t.includes("interior") ? "interior" : null,
  };
}

export function esProgresion(row: RecordRow) {
  const direccion = parseDireccion(read(row, "Zona_Caida"));
  return direccion.sentido === "progresion" || direccion.sentido === "area";
}

// ---------------------------------------------------------------- Resultado

export type Owner = "rmcf" | "rival" | "neutro";

export type Resultado = {
  /** Etiqueta canónica; las variantes de la hoja se unifican aquí. */
  label: string;
  owner: Owner;
  /** 1 Posicional · 2 ABP · 3 Conquista · 4 Ocasión · 5 Gol. */
  rank: number;
};

export function parseResultado(value: string): Resultado {
  const t = norm(value);
  if (!t) return { label: "Sin dato", owner: "neutro", rank: 0 };

  const owner: Owner = /\brival\b/.test(t) ? "rival" : "rmcf";
  const sufijo = owner === "rival" ? " Rival" : "";

  if (t.includes("gol")) return { label: `Gol${sufijo}`, owner, rank: 5 };
  if (t.includes("ocas")) return { label: `Ocasión${sufijo}`, owner, rank: 4 };
  if (t.includes("conquista") || t.includes("ultimo tercio"))
    return { label: `Conquista último tercio${sufijo}`, owner, rank: 3 };
  if (t.includes("abp")) return { label: `ABP${sufijo}`, owner, rank: 2 };
  if (t.includes("posicional")) return { label: `Posicional${sufijo}`, owner, rank: 1 };
  if (t.includes("nada")) return { label: "Nada", owner: "neutro", rank: 0 };

  // Vocabulario desconocido: sólo damos por rival lo que se declara rival.
  // Firmarlo como RMCF inflaría retención y recuperación sin que nadie lo vea.
  return { label: value.trim(), owner: owner === "rival" ? "rival" : "neutro", rank: 0 };
}

/** Nos quedamos con el balón: en ataque es retención, en defensa recuperación. */
export function esFavorable(resultado: Resultado) {
  return resultado.owner === "rmcf" && resultado.rank > 0;
}

/** Conquista de último tercio, ocasión o gol firmados por un equipo concreto. */
export function produccionDe(resultado: Resultado, owner: Owner) {
  return resultado.owner === owner && resultado.rank >= 3;
}

/**
 * Producción real de la jugada: conquista de último tercio, ocasión o gol.
 * En ataque la firma el RMCF; en defensa es exactamente lo que concedemos.
 */
export function esProduccion(resultado: Resultado, mode: Mode) {
  return produccionDe(resultado, mode === "offensive" ? "rmcf" : "rival");
}

/**
 * Transición: el saque acaba en producción NUESTRA sea cual sea la vista.
 * En la hoja defensiva es el contragolpe tras robar el saque del rival, que
 * es justo lo que esProduccion() no puede medir ahí.
 */
export function esTransicion(resultado: Resultado) {
  return produccionDe(resultado, "rmcf");
}

export const RESULT_COLORS: Record<string, string> = {
  Gol: "#10B981",
  "Ocasión": "#34D399",
  "Conquista último tercio": "#C8A96B",
  ABP: "#E7D2A0",
  Posicional: "#5E7FB8",
  Nada: "#475569",
  "Sin dato": "#334155",
  "Posicional Rival": "#8A6A72",
  "ABP Rival": "#A9787C",
  "Conquista último tercio Rival": "#C98A80",
  "Ocasión Rival": "#D08A7E",
  "Gol Rival": "#B45454",
};

export function resultColor(label: string) {
  return RESULT_COLORS[label] ?? "#64748B";
}

/**
 * El mismo color, pero legible como texto en modo día: los tonos de arriba
 * están pensados para fondo oscuro y sobre blanco no llegan a 2,5:1. Las
 * variables `--rmcf-chip-*` (en `app/globals.css`) solo oscurecen en modo día.
 *
 * Para atributos SVG hay que seguir usando `resultColor`: `var()` no se
 * resuelve dentro de un atributo de presentación.
 */
export function resultInk(label: string) {
  return chipInk(resultColor(label));
}

// ------------------------------------------------------------------ Colores

type Stop = { p: number; c: [number, number, number] };

function ramp(t: number, stops: Stop[]) {
  const ratio = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));

  let a = stops[0];
  let b = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i].p && ratio <= stops[i + 1].p) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }

  const span = b.p - a.p || 1;
  const local = (ratio - a.p) / span;
  const rgb = a.c.map((channel, i) => Math.round(channel + (b.c[i] - channel) * local));

  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * El calor mide "cuánta métrica hay", y la rampa dice si eso es bueno o malo
 * para el RMCF. Así el 80% de recuperación en defensa se pinta verde y el 80%
 * de peligro concedido se pinta rojo, aunque ambos vivan en la misma vista.
 */
export type Tono = "positivo" | "negativo" | "neutro";

const RAMPS: Record<Tono, Stop[]> = {
  positivo: [
    { p: 0, c: [14, 24, 38] },
    { p: 0.5, c: [200, 169, 107] },
    { p: 1, c: [16, 185, 129] },
  ],
  negativo: [
    { p: 0, c: [14, 24, 38] },
    { p: 0.5, c: [122, 58, 58] },
    { p: 1, c: [233, 150, 140] },
  ],
  neutro: [
    { p: 0, c: [14, 24, 38] },
    { p: 0.5, c: [110, 92, 58] },
    { p: 1, c: [200, 169, 107] },
  ],
};

export function heatColor(t: number, tono: Tono) {
  return ramp(t, RAMPS[tono]);
}

/**
 * Texto legible sobre un color del mapa de calor. Un umbral fijo sobre el
 * ratio no vale: a mitad de rampa el tono positivo es oro claro (pide texto
 * oscuro) y el negativo es granate (pide texto claro). Se decide por la
 * luminancia real del color pintado.
 */
export function textoSobre(color: string, oscuro = "#0B1728", claro = "#F8FAFC") {
  const rgb = color.match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (!rgb) return claro;

  const [r, g, b] = rgb.slice(1, 4).map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? oscuro : claro;
}

/** Tono de una métrica "cuanto más, peor para nosotros" según la vista. */
export function tonoDeModo(mode: Mode): Tono {
  return mode === "offensive" ? "positivo" : "negativo";
}

export const ACCENT = "#C8A96B";
export const ACCENT_LIGHT = "#E7D2A0";

/** El oro claro como tinta de texto; en modo día baja de luminosidad. */
export const ACCENT_INK = "var(--rmcf-gold-ink)";

// ----------------------------------------------------------------- Resumen

/** Etiqueta canónica de la dirección del envío de una fila. */
export function direccionDe(row: RecordRow) {
  return parseDireccion(read(row, "Zona_Caida"));
}

export type Resumen = {
  acciones: number;
  /** Porcentajes ya redondeables sobre el total de acciones. */
  progresionPct: number;
  favorablePct: number;
  produccion: number;
  produccionPct: number;
  transicion: number;
  transicionPct: number;
  rival: number;
  /** null cuando ninguna fila trae el dato. */
  calidad: number | null;
  bloqueadores: number | null;
};

/**
 * Agregado único de un conjunto de saques. El panel, el mapa de zonas y el
 * flujo mostraban los mismos KPIs calculados tres veces por separado, que es
 * como se cuelan discrepancias entre bloques de la misma pantalla.
 */
export function resumenDe(rows: RecordRow[], mode: Mode): Resumen {
  let progresion = 0;
  let favorable = 0;
  let produccion = 0;
  let transicion = 0;
  let rival = 0;
  let calidadSuma = 0;
  let calidadN = 0;
  let bloqSuma = 0;
  let bloqN = 0;

  rows.forEach((row) => {
    const resultado = parseResultado(read(row, "Resultado_Final"));

    if (esProgresion(row)) progresion += 1;
    if (esFavorable(resultado)) favorable += 1;
    if (esProduccion(resultado, mode)) produccion += 1;
    if (esTransicion(resultado)) transicion += 1;
    if (resultado.owner === "rival") rival += 1;

    const calidad = numero(read(row, "Calidad_Envio"));
    if (calidad !== null) {
      calidadSuma += calidad;
      calidadN += 1;
    }

    const bloqueadores = numero(read(row, "N_Bloqueadores"));
    if (bloqueadores !== null) {
      bloqSuma += bloqueadores;
      bloqN += 1;
    }
  });

  const pct = (value: number) => (rows.length ? (value / rows.length) * 100 : 0);

  return {
    acciones: rows.length,
    progresionPct: pct(progresion),
    favorablePct: pct(favorable),
    produccion,
    produccionPct: pct(produccion),
    transicion,
    transicionPct: pct(transicion),
    rival,
    calidad: calidadN ? calidadSuma / calidadN : null,
    bloqueadores: bloqN ? bloqSuma / bloqN : null,
  };
}
