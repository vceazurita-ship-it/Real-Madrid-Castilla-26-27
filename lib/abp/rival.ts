/**
 * Perfil de ABP de un rival.
 *
 * Hay dos orígenes posibles y la página distingue siempre cuál está viendo:
 *
 * - `scout`: la hoja de scouting de ABP rival (`RIVAL_SCOUT_GID`), que observa
 *   sus propios partidos. Es la buena: trae sacador, rematador y las acciones
 *   que nadie registra hoy (saque de medio y saque de meta).
 *
 * - `derivado`: lo que se puede deducir de nuestras cuatro hojas. El ataque
 *   del rival es nuestra hoja defensiva y su defensa es nuestra hoja ofensiva.
 *   Sirve mientras no exista la otra, pero sólo cubre los partidos contra
 *   nosotros y no registra nombres propios del rival.
 */

import {
  AbpFamily,
  AbpResult,
  abpFamily,
  abpProfile,
  abpResult,
  abpZone,
  alturaCm,
  norm,
  num,
  teamKey,
} from "./model";
import { ABP_GIDS, RIVAL_SCOUT_GID, SheetRow, loadSheet } from "./sheets";

export type AbpSource = "scout" | "derivado";

/** Lado de la acción visto desde el equipo analizado. */
export type AbpSide = "ofensivo" | "defensivo";

export interface AbpEvent {
  source: AbpSource;
  equipo: string;
  side: AbpSide;
  jornada: string;
  family: AbpFamily;
  /** Zona de la falta (Z1-Z6) cuando el tipo de acción la lleva. */
  zona: number | null;
  /** Perfil de la falta: interior, exterior, centrada, perfilada. */
  perfil: string | null;
  /** Zona del saque de banda: 1, 2 o 3. */
  zonaSaque: number | null;
  sacador: string;
  rematador: string;
  tipoEnvio: string;
  zonaRemate: string;
  remate: boolean;
  xg: number;
  result: AbpResult;
  /** La acción acabó en gol u ocasión clara para el equipo analizado. */
  peligro: boolean;
}

export interface FamilyStats {
  family: AbpFamily;
  acciones: number;
  remates: number;
  goles: number;
  xg: number;
  peligro: number;
  /** Peligro por acción, en tanto por ciento. */
  peligroPct: number;
  /** Remates por acción, en tanto por ciento. */
  remotePct: number;
}

export interface PersonStats {
  nombre: string;
  acciones: number;
  remates: number;
  goles: number;
  xg: number;
  peligro: number;
}

export interface RivalAbpProfile {
  equipo: string;
  source: AbpSource;
  /** Rutas de datos disponibles, para avisar en pantalla. */
  hasScout: boolean;
  events: AbpEvent[];
}

/* ------------------------------------------------------------------ */
/*  LECTURA                                                            */
/* ------------------------------------------------------------------ */

const pick = (row: SheetRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
};

const esSi = (value: string) => /^s[ií]$/i.test(value.trim());

/** Zona del saque de banda a partir de "Zona 2", "2", "Z2"… */
function parseZonaSaque(value: string): number | null {
  const match = norm(value).match(/([1-3])/);
  return match ? Number(match[1]) : null;
}

/**
 * Construye un evento a partir de una fila, indicando desde qué lado se mira.
 *
 * `owner` dice de quién es el peligro que cuenta: cuando analizamos el ataque
 * del rival, un «Gol Rival» de nuestra hoja defensiva es un gol suyo.
 */
function toEvent(
  row: SheetRow,
  options: {
    source: AbpSource;
    equipo: string;
    side: AbpSide;
    owner: "rmcf" | "rival";
    /** De quién es el resultado cuando la celda no lo dice. */
    implicitOwner: "rmcf" | "rival";
    familyFallback?: AbpFamily;
  },
): AbpEvent {
  const tipoAccion = pick(row, "Tipo_Accion", "TipoAccion", "Tipo accion");
  const family = tipoAccion
    ? abpFamily(tipoAccion)
    : (options.familyFallback ?? "otra");

  const result = abpResult(
    pick(row, "Resultado_Final", "Resultado"),
    options.implicitOwner,
  );
  const rematador = pick(row, "Rematador");
  const remateRaw = pick(row, "Remate");

  return {
    source: options.source,
    equipo: options.equipo,
    side: options.side,
    jornada: pick(row, "JORNADA", "Jornada"),
    family,
    zona: abpZone(tipoAccion),
    perfil: abpProfile(tipoAccion),
    zonaSaque: parseZonaSaque(pick(row, "Zona_Saque")),
    sacador: pick(row, "Sacador"),
    rematador,
    tipoEnvio: pick(row, "Tipo_Envio"),
    zonaRemate: pick(row, "Zona_Remate"),
    remate: remateRaw ? esSi(remateRaw) : Boolean(rematador),
    xg: num(pick(row, "xG", "xg")),
    result,
    peligro: result.owner === options.owner && result.rank >= 4,
  };
}

/* ------------------------------------------------------------------ */
/*  CARGA                                                              */
/* ------------------------------------------------------------------ */

export interface AbpDataset {
  events: AbpEvent[];
  hasScout: boolean;
  /** Equipos presentes, ordenados alfabéticamente. */
  equipos: string[];
}

/**
 * Carga todo lo que hay y devuelve un único conjunto de eventos etiquetados
 * por origen. Si una hoja falla, las demás siguen: es preferible una página
 * incompleta y avisada a una página en blanco.
 */
export async function loadRivalAbp(): Promise<AbpDataset> {
  const [scout, piezasOf, piezasDef, bandaOf, bandaDef] = await Promise.all([
    loadSheet(RIVAL_SCOUT_GID).catch(() => [] as SheetRow[]),
    loadSheet(ABP_GIDS.piezasOf).catch(() => [] as SheetRow[]),
    loadSheet(ABP_GIDS.piezasDef).catch(() => [] as SheetRow[]),
    loadSheet(ABP_GIDS.bandaOf).catch(() => [] as SheetRow[]),
    loadSheet(ABP_GIDS.bandaDef).catch(() => [] as SheetRow[]),
  ]);

  const events: AbpEvent[] = [];

  /* --- Hoja de scouting: el equipo analizado viene en la propia fila. --- */
  scout.forEach((row) => {
    const equipo = pick(row, "Equipo", "EQUIPO");
    if (!equipo) return;

    const side: AbpSide = norm(pick(row, "Condicion", "Condición")).startsWith(
      "d",
    )
      ? "defensivo"
      : "ofensivo";

    events.push(
      toEvent(row, {
        source: "scout",
        equipo,
        side,
        /* En la hoja de scouting el «dueño» del peligro es siempre el equipo
           analizado cuando ataca, y su oponente cuando defiende. */
        owner: side === "ofensivo" ? "rmcf" : "rival",
        implicitOwner: side === "ofensivo" ? "rmcf" : "rival",
      }),
    );
  });

  /* --- Derivado: nuestra hoja defensiva es el ataque del rival. --- */
  piezasDef.forEach((row) => {
    const equipo = pick(row, "Rival");
    if (!equipo) return;

    events.push(
      toEvent(row, {
        source: "derivado",
        equipo,
        side: "ofensivo",
        owner: "rival",
        implicitOwner: "rival",
      }),
    );
  });

  /* --- Y nuestra hoja ofensiva es su defensa: el peligro es nuestro. --- */
  piezasOf.forEach((row) => {
    const equipo = pick(row, "Rival");
    if (!equipo) return;

    events.push(
      toEvent(row, {
        source: "derivado",
        equipo,
        side: "defensivo",
        owner: "rmcf",
        implicitOwner: "rmcf",
      }),
    );
  });

  bandaDef.forEach((row) => {
    const equipo = pick(row, "Rival");
    if (!equipo || !pick(row, "Zona_Saque")) return;

    events.push(
      toEvent(row, {
        source: "derivado",
        equipo,
        side: "ofensivo",
        owner: "rival",
        implicitOwner: "rmcf",
        familyFallback: "banda",
      }),
    );
  });

  bandaOf.forEach((row) => {
    const equipo = pick(row, "Rival");
    if (!equipo || !pick(row, "Zona_Saque")) return;

    events.push(
      toEvent(row, {
        source: "derivado",
        equipo,
        side: "defensivo",
        owner: "rmcf",
        implicitOwner: "rmcf",
        familyFallback: "banda",
      }),
    );
  });

  const equipos = [...new Set(events.map((event) => event.equipo))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  return { events, hasScout: scout.length > 0, equipos };
}

/* ------------------------------------------------------------------ */
/*  AGREGADOS                                                          */
/* ------------------------------------------------------------------ */

export function statsByFamily(events: AbpEvent[]): FamilyStats[] {
  const buckets = new Map<AbpFamily, AbpEvent[]>();

  events.forEach((event) => {
    const list = buckets.get(event.family) ?? [];
    list.push(event);
    buckets.set(event.family, list);
  });

  return [...buckets.entries()].map(([family, list]) => {
    const remates = list.filter((event) => event.remate).length;
    const peligro = list.filter((event) => event.peligro).length;

    return {
      family,
      acciones: list.length,
      remates,
      goles: list.filter((event) => event.result.rank === 5 && event.peligro).length,
      xg: list.reduce((total, event) => total + event.xg, 0),
      peligro,
      peligroPct: list.length ? (peligro / list.length) * 100 : 0,
      remotePct: list.length ? (remates / list.length) * 100 : 0,
    };
  });
}

/** Ranking de personas por una columna de la hoja (sacador o rematador). */
export function rankPeople(
  events: AbpEvent[],
  field: "sacador" | "rematador",
): PersonStats[] {
  const buckets = new Map<string, AbpEvent[]>();

  events.forEach((event) => {
    const nombre = event[field];
    if (!nombre) return;

    const list = buckets.get(nombre) ?? [];
    list.push(event);
    buckets.set(nombre, list);
  });

  return [...buckets.entries()]
    .map(([nombre, list]) => ({
      nombre,
      acciones: list.length,
      remates: list.filter((event) => event.remate).length,
      goles: list.filter((event) => event.result.rank === 5 && event.peligro).length,
      xg: list.reduce((total, event) => total + event.xg, 0),
      peligro: list.filter((event) => event.peligro).length,
    }))
    .sort((a, b) => b.peligro - a.peligro || b.xg - a.xg || b.acciones - a.acciones);
}

/** Reparto de saques de banda por zona (1, 2, 3). */
export function bandaByZone(events: AbpEvent[]) {
  return [1, 2, 3].map((zona) => {
    const list = events.filter(
      (event) => event.family === "banda" && event.zonaSaque === zona,
    );

    const peligro = list.filter((event) => event.peligro).length;

    return {
      zona,
      acciones: list.length,
      peligro,
      peligroPct: list.length ? (peligro / list.length) * 100 : 0,
      xg: list.reduce((total, event) => total + event.xg, 0),
    };
  });
}

/* ------------------------------------------------------------------ */
/*  PLANTILLA: ESTATURAS Y ETIQUETAS                                   */
/* ------------------------------------------------------------------ */

export interface RivalPlayerAerial {
  id: string;
  nombre: string;
  dorsal: string;
  posicion: string;
  altura: number | null;
  foto: string;
  /** Etiquetado como rematador de ABP en el scouting. */
  remataAbp: boolean;
  /** Etiquetado como sacador de ABP en el scouting. */
  sacaAbp: boolean;
  /** Aparece rematando en los datos de ABP. */
  remates: number;
}

const clean = (value: unknown) => String(value ?? "").trim();

/**
 * Cruza la plantilla del rival con sus eventos de ABP.
 *
 * La altura y las etiquetas salen de la hoja de plantillas; los remates, de
 * los eventos. Cuando la hoja de scouting no existe todavía, `remates` queda a
 * cero y la lista vale igual como aviso de amenaza aérea por estatura.
 */
export function buildAerialThreats(
  squadRows: unknown,
  events: AbpEvent[],
  equipo: string,
): RivalPlayerAerial[] {
  if (!Array.isArray(squadRows)) return [];

  const target = teamKey(equipo);

  const rematesPorNombre = new Map<string, number>();

  events
    .filter((event) => event.side === "ofensivo" && event.rematador)
    .forEach((event) => {
      const key = norm(event.rematador);
      rematesPorNombre.set(key, (rematesPorNombre.get(key) ?? 0) + 1);
    });

  return squadRows
    .filter(
      (raw): raw is Record<string, unknown> =>
        Boolean(raw) && typeof raw === "object",
    )
    .filter((row) => teamKey(clean(row.NOMBRE_EQUIPO)) === target)
    .map((row) => {
      const nombre =
        clean(row["NOMBRE DEPORTIVO"]) || clean(row.JUGADOR) || "Sin nombre";

      const impacto = norm(clean(row.IMPACTO));

      return {
        id: clean(row.ID_JUGADOR) || nombre,
        nombre,
        dorsal: clean(row.DORSAL),
        posicion: clean(row["POSICIÓN"]),
        altura: alturaCm(clean(row.ALTURA)),
        foto: clean(row.FOTO),
        remataAbp: impacto.includes("rematador de abp"),
        sacaAbp: impacto.includes("sacador de abp") || impacto.includes("saca abp"),
        remates: rematesPorNombre.get(norm(nombre)) ?? 0,
      };
    })
    .sort((a, b) => (b.altura ?? 0) - (a.altura ?? 0));
}
