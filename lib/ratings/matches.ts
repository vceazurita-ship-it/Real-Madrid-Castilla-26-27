import Papa from "papaparse";

import { MatchMeta } from "./types";

/** Mismo CSV que alimenta /match-plans: calendario y resultados de la temporada. */
export const MATCHES_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=953333469&single=true&output=csv";

type MatchRow = {
  microciclo: string;
  fecha: string;
  resultado: string;
  partido: string;
  enlace: string;
};

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** "dd/mm/yyyy" (o con - y .) → "YYYY-MM-DD". Devuelve "" si no se entiende. */
export function toDateKey(fecha: string) {
  const match = (fecha ?? "")
    .trim()
    .match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);

  if (!match) return "";

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];

  return `${year}-${month}-${day}`;
}

export function parseResult(resultado: string) {
  const match = (resultado ?? "").match(/(\d+)\s*[-–:]\s*(\d+)/);

  if (!match) return null;

  return { home: Number(match[1]), away: Number(match[2]) };
}

/**
 * Separa "Local - Visitante" sin romper los nombres que llevan guion,
 * y detecta de qué lado juega el Castilla.
 */
function splitSides(partido: string) {
  const raw = (partido ?? "").trim();
  const parts = raw.split(/\s+-\s+/);

  if (parts.length < 2) {
    return { isHome: true, opponent: raw };
  }

  const home = parts[0].trim();
  const away = parts.slice(1).join(" - ").trim();

  const homeIsRM = /castilla/i.test(home);
  const awayIsRM = /castilla/i.test(away);

  const isHome = homeIsRM || !awayIsRM;

  return { isHome, opponent: isHome ? away : home };
}

/** Identificador estable de un partido: fecha + rival. */
export function matchId(date: string, opponent: string, source: "csv" | "manual") {
  const base = [date || "sin-fecha", slug(opponent) || "rival"].join("-");

  return source === "manual" ? `m-${base}` : base;
}

export function rowToMatch(row: MatchRow): MatchMeta {
  const { isHome, opponent } = splitSides(row.partido);
  const score = parseResult(row.resultado);
  const date = toDateKey(row.fecha);

  return {
    id: matchId(date, opponent, "csv"),
    date,
    opponent,
    competition: (row.microciclo ?? "").trim() || "Sin microciclo",
    isHome,
    result: (row.resultado ?? "").trim(),
    gf: score ? (isHome ? score.home : score.away) : null,
    ga: score ? (isHome ? score.away : score.home) : null,
    source: "csv",
  };
}

export async function fetchMatches(signal?: AbortSignal): Promise<MatchMeta[]> {
  const response = await fetch(MATCHES_CSV_URL, { signal });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const parsed = Papa.parse<MatchRow>(await response.text(), {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .filter((row) => (row?.partido ?? "").trim().length > 0)
    .map(rowToMatch);
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const shortFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
});

function toDate(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;

  const [year, month, day] = key.split("-").map(Number);

  return new Date(year, month - 1, day, 12);
}

export function formatMatchDate(match: MatchMeta) {
  const date = toDate(match.date);

  return date ? dateFormatter.format(date) : "Sin fecha";
}

export function formatMatchDateShort(match: MatchMeta) {
  const date = toDate(match.date);

  return date ? shortFormatter.format(date) : "—";
}

/** Etiqueta corta para ejes y tarjetas: "vs Rival" / "@ Rival". */
export function matchLabel(match: MatchMeta) {
  return `${match.isHome ? "vs" : "@"} ${match.opponent}`;
}

export type Outcome = "W" | "D" | "L";

export function matchOutcome(match: MatchMeta): Outcome | null {
  if (match.gf === null || match.ga === null) return null;

  if (match.gf > match.ga) return "W";
  if (match.gf < match.ga) return "L";

  return "D";
}

/** Orden cronológico; los partidos sin fecha quedan al final. */
export function compareMatches(a: MatchMeta, b: MatchMeta) {
  if (!a.date && !b.date) return a.opponent.localeCompare(b.opponent, "es");
  if (!a.date) return 1;
  if (!b.date) return -1;

  return a.date.localeCompare(b.date);
}
