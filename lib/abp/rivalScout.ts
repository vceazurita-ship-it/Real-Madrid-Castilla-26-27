/**
 * Scouting de ABP del rival registrado desde la propia app.
 *
 * Es la tercera vía de datos de `/scout-rival-abp`, y la única que sirve para
 * la liga: las cuatro hojas de ABP sólo tienen los partidos que juega el
 * Castilla, así que de un rival al que aún no hemos enfrentado no hay nada.
 * Aquí el cuerpo técnico registra lo que ve en el vídeo del rival.
 *
 * El formato es deliberadamente el mismo contrato de columnas que
 * `RIVAL_SCOUT_COLUMNS`: cada acción se convierte en una fila equivalente a la
 * de la hoja y se puntúa con `scoutRowsToEvents`. Si algún día se monta la hoja
 * en Google Sheets, las dos fuentes conviven sin tocar los agregados.
 *
 * Se guarda todo en un único documento de `app_documents` en vez de uno por
 * equipo: así una sola lectura sabe qué rivales tienen trabajo hecho y el
 * selector puede marcarlos. El coste es que dos personas editando rivales
 * distintos a la vez se pisarían; con un cuerpo técnico pequeño no compensa
 * complicarlo.
 */

import { AbpFamily, FAMILY_LABEL, teamKey } from "./model";
import { AbpEvent, AbpSide, scoutRowsToEvents } from "./rival";
import { SheetRow } from "./sheets";

/* ------------------------------------------------------------------ */
/*  MODELO                                                             */
/* ------------------------------------------------------------------ */

export interface RivalScoutAction {
  id: string;
  /** Jornada o partido observado: "J1", "Copa", "Pretemporada 03"… */
  jornada: string;
  /** Contra quién jugaba el rival ese día. */
  oponente: string;
  /** Mirado desde el equipo analizado: él ataca o él defiende. */
  condicion: AbpSide;
  tiempo: string;
  minuto: string;
  family: AbpFamily;
  /** Sólo faltas: interior, exterior, centrada, perfilada. */
  perfilFalta: string;
  /** Sólo faltas: zona Z1–Z6. */
  zonaFalta: string;
  /** Sólo saques de banda: zona 1, 2 o 3. */
  zonaSaque: string;
  sacador: string;
  perfilGolpeo: string;
  tipoEnvio: string;
  zonaCaida: string;
  calidadEnvio: string;
  nAtacantes: string;
  nBloqueadores: string;
  tipoCarrera: string;
  remate: string;
  rematador: string;
  tipoRemate: string;
  zonaRemate: string;
  xg: string;
  segundoBalon: string;
  resultado: string;
  observaciones: string;
}

/** Acciones por equipo, indexadas por `teamKey` para aguantar CF/CD y tildes. */
export interface RivalScoutStore {
  teams: Record<string, RivalScoutAction[]>;
}

export const EMPTY_SCOUT_STORE: RivalScoutStore = { teams: {} };

/** Clave del documento en `app_documents`. */
export const SCOUT_DOC_KEY = "abp-rival-scout";
export const SCOUT_DOC_KIND = "abp-rival";

export function scoutKey(equipo: string) {
  return teamKey(equipo) || "sin-equipo";
}

export function actionsOf(
  store: RivalScoutStore | null | undefined,
  equipo: string,
): RivalScoutAction[] {
  return store?.teams?.[scoutKey(equipo)] ?? [];
}

/* ------------------------------------------------------------------ */
/*  VOCABULARIO                                                        */
/* ------------------------------------------------------------------ */

/*
 * Los valores salen de lo que ya escriben las cuatro hojas de ABP, para que el
 * scouting del rival y el nuestro se lean con el mismo idioma.
 */

export const FAMILY_OPTIONS: AbpFamily[] = [
  "corner",
  "falta-lateral",
  "falta-directa",
  "penalti",
  "banda",
  "saque-medio",
  "saque-meta",
];

export const PERFIL_FALTA = ["Interior", "Exterior", "Centrada", "Perfilada"];
export const ZONA_FALTA = ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6"];
export const ZONA_SAQUE = ["Zona 1", "Zona 2", "Zona 3"];
export const TIEMPO = ["1T", "2T"];
export const PERFIL_GOLPEO = ["Cerrado", "Abierto", "Neutro"];
export const TIPO_ENVIO = ["Corto", "Largo", "Tenso", "Bombeado", "Bote"];
export const CALIDAD_ENVIO = ["1", "2", "3", "4"];
export const TIPO_CARRERA = ["Desde atrás", "Estático", "No aplica"];
export const REMATE = ["Sí", "No", "No aplica"];
export const TIPO_REMATE = ["Limpio", "Forzado", "No Remate", "No aplica"];
export const SEGUNDO_BALON = ["Ganado", "Perdido", "No hubo"];

/** Dónde cae el balón: el área tiene un vocabulario y la banda, otro. */
export const ZONA_CAIDA_AREA = [
  "Primer palo",
  "Central",
  "Segundo palo",
  "Frontal",
  "Área",
  "6m",
  "Penalti",
  "Fuera",
];

export const ZONA_CAIDA_BANDA = [
  "Progresión Carril Exterior",
  "Progresión Carril Interior",
  "Retroceso Carril Exterior",
  "Retroceso Carril Interior",
  "Fuera",
];

export const ZONA_REMATE = [
  "Primer palo",
  "Central",
  "Segundo palo",
  "Fuera de área",
  "No Remate",
  "No aplica",
];

export function zonaCaidaOptions(family: AbpFamily) {
  return family === "banda" ? ZONA_CAIDA_BANDA : ZONA_CAIDA_AREA;
}

/*
 * Resultado. El sujeto es siempre el equipo analizado cuando ataca y su
 * oponente cuando defiende: es la convención de la hoja de scouting, y la que
 * `scoutRowsToEvents` da por supuesta. Por eso NO se ofrecen aquí las
 * variantes con «RMCF», que en esta página significarían otra cosa.
 */
export const RESULTADO = [
  "Gol",
  "Ocasión",
  "Conquista último tercio",
  "ABP",
  "Posicional",
  "Nada",
  "Transición Rival",
];

/** De quién es el resultado que se está registrando, para rotularlo bien. */
export function resultadoOwnerLabel(condicion: AbpSide, equipo: string) {
  return condicion === "ofensivo"
    ? `Cómo acabó para el ${equipo}`
    : `Cómo acabó para quien atacaba al ${equipo}`;
}

/* ------------------------------------------------------------------ */
/*  ALTA Y CONVERSIÓN                                                  */
/* ------------------------------------------------------------------ */

let seq = 0;

/** Id local estable; no viaja a ningún sitio salvo al propio documento. */
function newId() {
  seq += 1;
  return `abp-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export function newAction(
  partial: Partial<RivalScoutAction> = {},
): RivalScoutAction {
  return {
    id: newId(),
    jornada: "",
    oponente: "",
    condicion: "ofensivo",
    tiempo: "1T",
    minuto: "",
    family: "corner",
    perfilFalta: "",
    zonaFalta: "",
    zonaSaque: "",
    sacador: "",
    perfilGolpeo: "",
    tipoEnvio: "",
    zonaCaida: "",
    calidadEnvio: "",
    nAtacantes: "",
    nBloqueadores: "",
    tipoCarrera: "",
    remate: "No",
    rematador: "",
    tipoRemate: "",
    zonaRemate: "",
    xg: "",
    segundoBalon: "",
    resultado: "Nada",
    observaciones: "",
    ...partial,
  };
}

/**
 * Texto de `Tipo_Accion` tal y como lo escribiría la hoja.
 *
 * `abpFamily`, `abpZone` y `abpProfile` vuelven a leer de aquí, así que la
 * frase tiene que quedar en su idioma: "Falta lateral interior Z4".
 */
export function composeTipoAccion(action: RivalScoutAction): string {
  const base = FAMILY_LABEL[action.family] ?? "Otra";

  if (action.family !== "falta-lateral" && action.family !== "falta-directa") {
    return base;
  }

  return [base, action.perfilFalta.toLowerCase(), action.zonaFalta]
    .filter(Boolean)
    .join(" ");
}

/** Una acción guardada, con la forma de una fila de la hoja de scouting. */
export function actionToRow(
  action: RivalScoutAction,
  equipo: string,
): SheetRow {
  return {
    JORNADA: action.jornada,
    Equipo: equipo,
    Rival: action.oponente,
    Condicion: action.condicion === "defensivo" ? "Defensivo" : "Ofensivo",
    Tiempo: action.tiempo,
    Minuto: action.minuto,
    Tipo_Accion: composeTipoAccion(action),
    Zona_Saque: action.zonaSaque,
    Sacador: action.sacador,
    Perfil_Golpeo: action.perfilGolpeo,
    Tipo_Envio: action.tipoEnvio,
    Zona_Caida: action.zonaCaida,
    Calidad_Envio: action.calidadEnvio,
    N_Atacantes: action.nAtacantes,
    N_Bloqueadores: action.nBloqueadores,
    Tipo_Carrera: action.tipoCarrera,
    Remate: action.remate,
    Rematador: action.rematador,
    Tipo_Remate: action.tipoRemate,
    Zona_Remate: action.zonaRemate,
    xG: action.xg,
    Segundo_Balon: action.segundoBalon,
    Resultado_Final: action.resultado,
    Observaciones: action.observaciones,
  };
}

/** Eventos de ABP de un equipo a partir de sus acciones registradas. */
export function actionsToEvents(
  equipo: string,
  actions: RivalScoutAction[],
): AbpEvent[] {
  if (!equipo || !actions.length) return [];

  return scoutRowsToEvents(actions.map((action) => actionToRow(action, equipo)));
}

/* ------------------------------------------------------------------ */
/*  EXPORTACIÓN                                                        */
/* ------------------------------------------------------------------ */

/** Cabeceras del CSV, en el orden del contrato de la hoja de scouting. */
const CSV_HEADERS = [
  "JORNADA",
  "Equipo",
  "Rival",
  "Condicion",
  "Tiempo",
  "Minuto",
  "Tipo_Accion",
  "Zona_Saque",
  "Sacador",
  "Perfil_Golpeo",
  "Tipo_Envio",
  "Zona_Caida",
  "Calidad_Envio",
  "N_Atacantes",
  "N_Bloqueadores",
  "Tipo_Carrera",
  "Remate",
  "Rematador",
  "Tipo_Remate",
  "Zona_Remate",
  "xG",
  "Segundo_Balon",
  "Resultado_Final",
  "Observaciones",
];

const csvCell = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/**
 * CSV con el contrato de la hoja de scouting.
 *
 * Sirve para pegar lo registrado en Google Sheets el día que se monte esa
 * hoja, y como copia de seguridad legible sin abrir Supabase.
 */
export function actionsToCsv(equipo: string, actions: RivalScoutAction[]) {
  const rows = actions.map((action) => actionToRow(action, equipo));

  return [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      CSV_HEADERS.map((header) => csvCell(String(row[header] ?? ""))).join(","),
    ),
  ].join("\n");
}
