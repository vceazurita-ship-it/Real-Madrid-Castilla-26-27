/**
 * Lo que pasó a balón parado en los partidos del Castilla.
 *
 * `lib/abp/rival.ts` lee las mismas cuatro hojas pero se coloca del lado del
 * rival —para el scouting, el sujeto es él—. Aquí el sujeto somos nosotros:
 * «ofensivo» es lo que ejecutamos y «defensivo» lo que defendemos, que es como
 * se planifica una semana. Por eso son dos lecturas y no una.
 *
 * **Cada hoja tiene su propia convención de resultado** y de eso depende que el
 * peligro se le asigne a quien toca:
 *
 * - `piezasOf` y las dos de saque de banda son absolutas: sin sufijo es del
 *   RMCF y «… Rival» es del rival.
 * - `piezasDef` tiene como sujeto implícito al que ataca, que allí es el
 *   rival: «Ocasión» es ocasión SUYA, y lo nuestro va marcado a mano («Gol
 *   RMCF», «Transición Ofensiva»).
 *
 * Ignorarlo no da error: da métricas a cero.
 */

import {
  AbpFamily,
  abpFamily,
  norm,
  num,
  abpResult,
  teamKey,
} from "./model";
import { ABP_GIDS, SheetRow, loadSheet } from "./sheets";
import {
  contextoDeFila,
  type Competicion,
  type ContextoAccion,
} from "./partido";
import type { AbpLado, Aspecto } from "./microciclo";

/* ------------------------------------------------------------------ */
/*  EVENTO                                                             */
/* ------------------------------------------------------------------ */

export type Envio = "corto" | "largo";

export type CompeticionEvent = {
  jornada: string;
  /**
   * De qué competición es, en qué minuto pasó y cómo iba el marcador.
   *
   * Lo lee `lib/abp/partido.ts` de las mismas columnas que ya trae la hoja.
   * Va aquí porque lo que se planifica en un microciclo se mide contra los
   * partidos **de liga**: sumar los amistosos de julio a la jornada que viene
   * es lo que hacía que el número no dijera nada.
   */
  contexto: ContextoAccion;
  rival: string;
  /** Nombre normalizado, para cruzar con la hoja de registro de tareas. */
  rivalKey: string;
  lado: AbpLado;
  family: AbpFamily;
  /** `null` cuando la hoja no anotó el tipo de envío. */
  envio: Envio | null;
  zonaSaque: number | null;
  remate: boolean;
  xg: number;
  /** Gol u ocasión clara para quien atacaba en esta acción. */
  peligro: boolean;
  gol: boolean;
};

export type CompeticionPartido = {
  jornada: string;
  rival: string;
  rivalKey: string;
  competicion: Competicion;
};

export type CompeticionDataset = {
  events: CompeticionEvent[];
  partidos: CompeticionPartido[];
  /** Hojas que no se pudieron leer. La página lo dice en vez de callarlo. */
  fallos: string[];
  /**
   * Saques de banda a los que la hoja no anotó la zona.
   *
   * No caen en Z1, Z2 ni Z3, así que quedan fuera del cruce. Se cuentan aparte
   * para poder decirlo: si no, esas acciones simplemente se evaporan y el
   * reparto por zonas parece completo cuando no lo está.
   */
  bandaSinZona: Record<AbpLado, number>;
};

const pick = (row: SheetRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }

  return "";
};

/**
 * Traduce `Tipo_Envio` a la única distinción que separa un córner al área de
 * uno jugado en corto. Lo que no reconoce se queda sin clasificar antes que
 * inventarse el reparto.
 */
function parseEnvio(value: string): Envio | null {
  const t = norm(value);

  if (!t) return null;
  if (t.includes("corto")) return "corto";
  if (t.includes("bombead") || t.includes("tenso") || t.includes("largo")) {
    return "largo";
  }

  return null;
}

function parseZonaSaque(value: string): number | null {
  const match = norm(value).match(/([1-3])/);

  return match ? Number(match[1]) : null;
}

const esSi = (value: string) => /^s[ií]$/i.test(value.trim());

function toEvent(
  row: SheetRow,
  options: {
    lado: AbpLado;
    /** De quién es el resultado cuando la celda no lo dice. */
    implicitOwner: "rmcf" | "rival";
    familyFallback?: AbpFamily;
  },
): CompeticionEvent | null {
  const rival = pick(row, "Rival");

  if (!rival) return null;

  const tipoAccion = pick(row, "Tipo_Accion", "TipoAccion");

  const result = abpResult(
    pick(row, "Resultado_Final", "Resultado"),
    options.implicitOwner,
  );

  /* Quien ataca en esta acción: nosotros si es nuestro ABP ofensivo, el rival
     si la estamos defendiendo. Su peligro es el que cuenta en esta fila. */
  const atacante = options.lado === "ofensivo" ? "rmcf" : "rival";

  const remateRaw = pick(row, "Remate");

  return {
    jornada: pick(row, "JORNADA", "Jornada"),
    contexto: contextoDeFila(row),
    rival,
    rivalKey: teamKey(rival),
    lado: options.lado,
    family: tipoAccion
      ? abpFamily(tipoAccion)
      : (options.familyFallback ?? "otra"),
    envio: parseEnvio(pick(row, "Tipo_Envio")),
    zonaSaque: parseZonaSaque(pick(row, "Zona_Saque")),
    remate: remateRaw ? esSi(remateRaw) : Boolean(pick(row, "Rematador")),
    xg: num(pick(row, "xG", "xg")),
    peligro: result.owner === atacante && result.rank >= 4,
    gol: result.owner === atacante && result.rank === 5,
  };
}

/* ------------------------------------------------------------------ */
/*  CARGA                                                              */
/* ------------------------------------------------------------------ */

/**
 * Lee las cuatro hojas. Si una falla, las demás siguen: una página con tres
 * cuartos del dato y un aviso es más útil que una página en blanco.
 */
export async function loadCompeticion(): Promise<CompeticionDataset> {
  const fallos: string[] = [];

  const leer = async (gid: string, nombre: string) => {
    try {
      return await loadSheet(gid);
    } catch {
      fallos.push(nombre);
      return [] as SheetRow[];
    }
  };

  const [piezasOf, piezasDef, bandaOf, bandaDef] = await Promise.all([
    leer(ABP_GIDS.piezasOf, "ABP ofensivo"),
    leer(ABP_GIDS.piezasDef, "ABP defensivo"),
    leer(ABP_GIDS.bandaOf, "Saques de banda ofensivos"),
    leer(ABP_GIDS.bandaDef, "Saques de banda defensivos"),
  ]);

  const events: CompeticionEvent[] = [];

  const push = (
    rows: SheetRow[],
    options: Parameters<typeof toEvent>[1],
  ) => {
    rows.forEach((row) => {
      const event = toEvent(row, options);

      if (event) events.push(event);
    });
  };

  push(piezasOf, { lado: "ofensivo", implicitOwner: "rmcf" });
  push(piezasDef, { lado: "defensivo", implicitOwner: "rival" });

  push(bandaOf, {
    lado: "ofensivo",
    implicitOwner: "rmcf",
    familyFallback: "banda",
  });

  /* La hoja defensiva de banda **sí** es absoluta: lo del rival viene marcado
     con «… Rival» y lo sin sufijo es nuestro. */
  push(bandaDef, {
    lado: "defensivo",
    implicitOwner: "rmcf",
    familyFallback: "banda",
  });

  /* Un partido por jornada; el nombre del rival se toma del primero que lo
     traiga, que en estas hojas es siempre el mismo.

     La clave lleva la competición dentro: «PRETEMPORADA 01» y «LIGA 01» son
     dos partidos, y agrupándolos por el texto de la celda ya lo eran, pero
     cualquiera que contara jornadas por su número los juntaba. */
  const porJornada = new Map<string, CompeticionPartido>();

  events.forEach((event) => {
    const clave = event.contexto.jornada.clave || event.jornada;

    if (!clave || porJornada.has(clave)) return;

    porJornada.set(clave, {
      jornada: event.jornada,
      rival: event.rival,
      rivalKey: event.rivalKey,
      competicion: event.contexto.jornada.competicion,
    });
  });

  const partidos = [...porJornada.values()].sort((a, b) =>
    a.jornada.localeCompare(b.jornada, "es", { numeric: true }),
  );

  const bandaSinZona: Record<AbpLado, number> = { ofensivo: 0, defensivo: 0 };

  events.forEach((event) => {
    if (event.family === "banda" && event.zonaSaque === null) {
      bandaSinZona[event.lado] += 1;
    }
  });

  return { events, partidos, fallos, bandaSinZona };
}

/* ------------------------------------------------------------------ */
/*  CRUCE CON EL CATÁLOGO DE LA PLANIFICACIÓN                          */
/* ------------------------------------------------------------------ */

/**
 * ¿Esta acción de competición es del aspecto que se planifica?
 *
 * Devuelve `false` para los aspectos que ninguna hoja reconoce: quien llama
 * tiene que distinguir «no ocurrió» de «no se registra», y para eso mira
 * `aspecto.reconocimiento`.
 */
export function encajaEnAspecto(event: CompeticionEvent, aspecto: Aspecto) {
  const r = aspecto.reconocimiento;

  if (!r) return false;
  if (event.family !== r.family) return false;
  if (r.envio && event.envio !== r.envio) return false;
  if (r.zonaSaque && event.zonaSaque !== r.zonaSaque) return false;

  return true;
}

export type AspectoStats = {
  acciones: number;
  remates: number;
  goles: number;
  peligro: number;
  xg: number;
  /** Peligro por acción, en tanto por ciento. */
  peligroPct: number;
  /** Acciones por partido. */
  porPartido: number;
  /**
   * Acciones de la misma familia a las que la hoja no anotó el tipo de envío
   * y que por eso no se han repartido entre directo e indirecto.
   */
  sinClasificar: number;
};

export const STATS_VACIAS: AspectoStats = {
  acciones: 0,
  remates: 0,
  goles: 0,
  peligro: 0,
  xg: 0,
  peligroPct: 0,
  porPartido: 0,
  sinClasificar: 0,
};

export function statsDeAspecto(
  events: CompeticionEvent[],
  aspecto: Aspecto,
  lado: AbpLado,
  partidos: number,
): AspectoStats {
  const r = aspecto.reconocimiento;

  if (!r) return STATS_VACIAS;

  const delLado = events.filter((event) => event.lado === lado);
  const propias = delLado.filter((event) => encajaEnAspecto(event, aspecto));

  /* Sólo tiene sentido avisar de lo no clasificado donde el reparto depende
     del envío: en banda o en penaltis no hay nada que repartir. */
  const sinClasificar = r.envio
    ? delLado.filter(
        (event) => event.family === r.family && event.envio === null,
      ).length
    : 0;

  const peligro = propias.filter((event) => event.peligro).length;

  return {
    acciones: propias.length,
    remates: propias.filter((event) => event.remate).length,
    goles: propias.filter((event) => event.gol).length,
    peligro,
    xg: propias.reduce((total, event) => total + event.xg, 0),
    peligroPct: propias.length ? (peligro / propias.length) * 100 : 0,
    porPartido: partidos ? propias.length / partidos : 0,
    sinClasificar,
  };
}

/* ------------------------------------------------------------------ */
/*  EMPAREJAR NOMBRES DE EQUIPO                                        */
/* ------------------------------------------------------------------ */

/**
 * Palabras que no identifican a nadie: aparecen en media liga.
 *
 * `teamKey` ya quita las siglas del club, pero no basta para cruzar la hoja de
 * registro con las de ABP, donde el mismo equipo está escrito de dos maneras
 * («R.FERROL» y «RACING DE FERROL», «RCD FABRIL» y «DEPORTIVO FABRIL»).
 */
const PALABRAS_VACIAS = new Set([
  "real",
  "racing",
  "deportivo",
  "club",
  "futbol",
  "balompie",
  "atletico",
  "union",
  "sociedad",
  "cultural",
  "de",
  "del",
  "la",
  "el",
  "cf",
  "cd",
  "sd",
  "ud",
  "ad",
  "ca",
  "rc",
  "rcd",
  "sad",
  "b",
  "c",
]);

function tokens(nombre: string) {
  return norm(nombre)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !PALABRAS_VACIAS.has(token));
}

/**
 * Busca el partido que corresponde al rival de un microciclo.
 *
 * Primero por clave exacta. Si no la hay, por palabra distintiva compartida
 * —y **sólo si la coincidencia es única**: con dos candidatos se prefiere no
 * cruzar nada a colgarle a un partido el trabajo de otra semana.
 */
export function buscaPartido(
  rival: string,
  partidos: CompeticionPartido[],
): CompeticionPartido | null {
  if (!rival.trim()) return null;

  const clave = teamKey(rival);

  const exacto = partidos.filter(
    (partido) => clave && partido.rivalKey === clave,
  );

  if (exacto.length === 1) return exacto[0];

  const propios = new Set(tokens(rival));

  if (!propios.size) return null;

  const candidatos = partidos.filter((partido) =>
    tokens(partido.rival).some((token) => propios.has(token)),
  );

  return candidatos.length === 1 ? candidatos[0] : null;
}
