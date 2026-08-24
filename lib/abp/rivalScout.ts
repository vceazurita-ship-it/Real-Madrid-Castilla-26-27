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

import {
  AbpFamily,
  AbpOwner,
  FAMILY_LABEL,
  abpResult,
  esPeligro,
  norm,
  teamKey,
} from "./model";
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
  /**
   * Patrón o rutina reconocible: "bloqueo doble al primer palo", "salida en
   * corto y centro atrás"… Se rellena sólo en las acciones que significan
   * algo para el plan de partido, y es lo que agrupa el panel de patrones.
   * Vacío = acción registrada pero sin nada que destacar.
   */
  patron: string;
  observaciones: string;
}

/** Acciones por equipo, indexadas por `teamKey` para aguantar CF/CD y tildes. */
export interface RivalScoutStore {
  teams: Record<string, RivalScoutAction[]>;
  /**
   * Catálogo de patrones que mantiene el cuerpo técnico.
   *
   * Mientras no exista, el combo se rellena solo con lo ya escrito más las
   * sugerencias de fábrica (`patternCatalog`). En cuanto se toca —se añade,
   * se renombra o se quita algo— pasa a mandar esta lista y nada vuelve a
   * colarse sola: si no, quitar un patrón no serviría de nada porque
   * reaparecería en cuanto quedara una acción con ese texto.
   */
  patterns?: string[];
}

export const EMPTY_SCOUT_STORE: RivalScoutStore = { teams: {} };

/** Clave del documento en `app_documents`. */
export const SCOUT_DOC_KEY = "abp-rival-scout";
export const SCOUT_DOC_KIND = "abp-rival";

export function scoutKey(equipo: string) {
  return teamKey(equipo) || "sin-equipo";
}

/**
 * Acciones de un rival, con los campos que puedan faltar rellenados.
 *
 * El documento guardado en `app_documents` es de la versión que lo escribió:
 * las acciones registradas antes de que existiera el patrón no traen ese
 * campo. Se completa al leer y no al guardar, para no tener que reescribir el
 * documento entero por cada campo nuevo.
 */
export function actionsOf(
  store: RivalScoutStore | null | undefined,
  equipo: string,
): RivalScoutAction[] {
  const stored = store?.teams?.[scoutKey(equipo)] ?? [];

  return stored.map((action) => ({
    ...action,
    patron: action.patron ?? "",
    observaciones: action.observaciones ?? "",
  }));
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

/**
 * Patrones habituales, como punto de partida al escribir.
 *
 * Es una lista de sugerencias, no un cerrojo: el campo admite cualquier texto
 * porque cada rival tiene sus manías y forzarlas dentro de doce etiquetas
 * haría perder justo el detalle que sirve para preparar el partido.
 */
export const PATRON_SUGERIDO = [
  "Bloqueo al portero",
  "Bloqueo doble al primer palo",
  "Cortina y salida al segundo palo",
  "Arrastre al primer palo y remate atrás",
  "Salida en corto",
  "Envío tenso al primer palo",
  "Balón al punto de penalti",
  "Rechace preparado en la frontal",
  "Saque de banda largo al área",
  "Todos fuera del área y entrada lanzada",
  "Marcaje mixto con dos en zona",
  "Marcaje al hombre sin nadie en palos",
];

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
    patron: "",
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
    Patron: action.patron,
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
/*  PATRONES                                                           */
/* ------------------------------------------------------------------ */

/**
 * Un patrón agrupado: la misma rutina vista en varias acciones.
 *
 * Lo que se lleva al plan de partido no es la acción suelta sino la repetición
 * —«tres veces el bloqueo al portero, dos acabaron en remate»—, así que aquí
 * se juntan por el texto del patrón y se cuenta qué produjeron.
 */
export interface PatternGroup {
  /** Texto tal y como se escribió la primera vez. */
  patron: string;
  condicion: AbpSide;
  veces: number;
  familias: AbpFamily[];
  remates: number;
  peligro: number;
  goles: number;
  jornadas: string[];
  sacadores: string[];
  rematadores: string[];
  zonas: string[];
  /** Observaciones de cada acción del grupo, con su partido y su minuto. */
  notas: { id: string; jornada: string; minuto: string; texto: string }[];
  acciones: RivalScoutAction[];
}

/** De quién es el resultado que registra la acción. */
function ownerOf(condicion: AbpSide): AbpOwner {
  return condicion === "ofensivo" ? "rmcf" : "rival";
}

/**
 * ¿La acción acabó en gol u ocasión para quien atacaba?
 *
 * Se calcula igual que en `scoutRowsToEvents` —mismo `abpResult`, mismo
 * dueño implícito— para que el panel de patrones no cuente un peligro distinto
 * del que cuentan los totales de arriba.
 */
export function esPeligroAccion(action: RivalScoutAction) {
  const owner = ownerOf(action.condicion);

  return esPeligro(abpResult(action.resultado, owner), owner);
}

export function esGolAccion(action: RivalScoutAction) {
  const owner = ownerOf(action.condicion);
  const result = abpResult(action.resultado, owner);

  return result.rank === 5 && esPeligro(result, owner);
}

/** Añade sin repetir y sin colar vacíos. */
function push(list: string[], value: string) {
  const clean = value.trim();

  if (clean && !list.includes(clean)) list.push(clean);
}

/** La zona que describe la acción: la de la falta o la del saque de banda. */
function zonaDe(action: RivalScoutAction) {
  return action.zonaFalta || action.zonaSaque || "";
}

/**
 * Agrupa por patrón las acciones que lo tengan escrito.
 *
 * Las que no lo llevan quedan fuera a propósito: el registro sirve para contar
 * volumen y el patrón para preparar el partido, y mezclarlos convertiría el
 * panel en la misma tabla de abajo.
 *
 * La clave junta lado y texto normalizado, así que «Bloqueo al portero» y
 * «bloqueo al portero » son el mismo patrón, pero atacando y defendiendo se
 * cuentan por separado —significan cosas opuestas—.
 */
export function groupPatterns(actions: RivalScoutAction[]): PatternGroup[] {
  const groups = new Map<string, PatternGroup>();

  actions.forEach((action) => {
    const patron = action.patron.trim();

    if (!patron) return;

    const key = `${action.condicion}|${norm(patron)}`;

    const group = groups.get(key) ?? {
      patron,
      condicion: action.condicion,
      veces: 0,
      familias: [] as AbpFamily[],
      remates: 0,
      peligro: 0,
      goles: 0,
      jornadas: [] as string[],
      sacadores: [] as string[],
      rematadores: [] as string[],
      zonas: [] as string[],
      notas: [] as PatternGroup["notas"],
      acciones: [] as RivalScoutAction[],
    };

    group.veces += 1;
    group.acciones.push(action);

    if (!group.familias.includes(action.family))
      group.familias.push(action.family);

    if (action.remate === "Sí") group.remates += 1;
    if (esPeligroAccion(action)) group.peligro += 1;
    if (esGolAccion(action)) group.goles += 1;

    push(group.jornadas, action.jornada);
    push(group.sacadores, action.sacador);
    push(group.rematadores, action.rematador);
    push(group.zonas, zonaDe(action));

    if (action.observaciones.trim()) {
      group.notas.push({
        id: action.id,
        jornada: action.jornada,
        minuto: action.minuto,
        texto: action.observaciones.trim(),
      });
    }

    groups.set(key, group);
  });

  /* Primero lo que hace daño, luego lo que más se repite: es el orden en que
     se decide qué entra en la pizarra. */
  return [...groups.values()].sort(
    (a, b) =>
      b.goles - a.goles ||
      b.peligro - a.peligro ||
      b.veces - a.veces ||
      a.patron.localeCompare(b.patron, "es"),
  );
}

/**
 * Patrones ya escritos en cualquier rival, para sugerirlos al teclear.
 *
 * Se miran todos los equipos y no sólo el analizado: el vocabulario del cuerpo
 * técnico es el mismo para toda la liga, y así «Bloqueo al portero» se escribe
 * igual en el Bilbao Athletic que en el Osasuna B y los grupos no se parten.
 */
export function knownPatterns(store: RivalScoutStore | null | undefined) {
  const vistos: string[] = [];

  Object.values(store?.teams ?? {}).forEach((actions) => {
    (actions ?? []).forEach((action) => push(vistos, action.patron ?? ""));
  });

  vistos.sort((a, b) => a.localeCompare(b, "es"));

  return [
    ...vistos,
    ...PATRON_SUGERIDO.filter(
      (option) => !vistos.some((seen) => norm(seen) === norm(option)),
    ),
  ];
}

/* ------------------------------------------------------------------ */
/*  CATÁLOGO DE PATRONES                                               */
/* ------------------------------------------------------------------ */

/**
 * Los patrones que ofrece el combo al registrar una acción.
 *
 * Devuelve el catálogo guardado si el cuerpo técnico ya lo ha tocado, y si no
 * el derivado de siempre: lo escrito en cualquier rival más las sugerencias.
 * Ese derivado es sólo la semilla; a la primera edición se materializa.
 */
export function patternCatalog(store: RivalScoutStore | null | undefined) {
  const guardado = store?.patterns;

  /* La semilla derivada puede traer variantes de mayúsculas del mismo texto:
     el catálogo se queda con una sola entrada de cada. */
  const lista: string[] = [];
  const vistos = new Set<string>();

  (Array.isArray(guardado) ? guardado : knownPatterns(store)).forEach(
    (patron) => {
      const limpio = (patron || "").trim();

      if (!limpio || vistos.has(norm(limpio))) return;

      vistos.add(norm(limpio));
      lista.push(limpio);
    },
  );

  return lista;
}

/** Cuántas acciones usan cada entrada del catálogo, para avisar al quitarla. */
export function patternUsage(
  store: RivalScoutStore | null | undefined,
  catalogo: string[],
) {
  const usos: Record<string, number> = {};

  const porTexto = new Map<string, string>();

  catalogo.forEach((patron) => {
    usos[patron] = 0;
    porTexto.set(norm(patron), patron);
  });

  Object.values(store?.teams ?? {}).forEach((actions) => {
    (actions ?? []).forEach((action) => {
      const entrada = porTexto.get(norm(action.patron ?? ""));

      if (entrada) usos[entrada] += 1;
    });
  });

  return usos;
}

/** Escribe el catálogo materializado, que es lo que vuelve editable el combo. */
function withCatalog(store: RivalScoutStore, patterns: string[]) {
  return { ...store, patterns };
}

/** Añade un patrón al final: el orden lo decide quien lo mantiene. */
export function addPattern(store: RivalScoutStore, patron: string) {
  const lista = patternCatalog(store);

  const limpio = patron.trim();

  if (!limpio || lista.some((item) => norm(item) === norm(limpio))) {
    return withCatalog(store, lista);
  }

  return withCatalog(store, [...lista, limpio]);
}

/**
 * Renombra un patrón **y reescribe las acciones que lo usaban**.
 *
 * Sin lo segundo el panel de patrones partiría el grupo en dos —las viejas con
 * el texto anterior y las nuevas con el corregido—, que es justo lo que
 * `knownPatterns` lleva evitando desde el principio compartiendo vocabulario
 * entre todos los rivales.
 */
export function renamePattern(
  store: RivalScoutStore,
  from: string,
  to: string,
) {
  const limpio = to.trim();

  if (!limpio || norm(from) === norm(limpio)) {
    return withCatalog(store, patternCatalog(store));
  }

  const lista: string[] = [];

  patternCatalog(store).forEach((item) =>
    push(lista, norm(item) === norm(from) ? limpio : item),
  );

  const teams: Record<string, RivalScoutAction[]> = {};

  Object.entries(store.teams ?? {}).forEach(([key, actions]) => {
    teams[key] = (actions ?? []).map((action) =>
      norm(action.patron ?? "") === norm(from)
        ? { ...action, patron: limpio }
        : action,
    );
  });

  return withCatalog({ ...store, teams }, lista);
}

/**
 * Quita un patrón del combo sin tocar las acciones ya registradas.
 *
 * Lo escrito en una acción es una observación de un partido concreto y no se
 * borra por limpiar el vocabulario: el panel de patrones lo sigue agrupando,
 * simplemente deja de ofrecerse al teclear.
 */
export function removePattern(store: RivalScoutStore, patron: string) {
  return withCatalog(
    store,
    patternCatalog(store).filter((item) => norm(item) !== norm(patron)),
  );
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
  "Patron",
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
