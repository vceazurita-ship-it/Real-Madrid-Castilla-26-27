/**
 * La hoja de registro de tareas, leída para el microciclo de ABP.
 *
 * Es la misma pestaña que alimenta `/microcycles`, pero aquí sólo interesa una
 * parte: qué microciclos existen (con su rival, que es lo que después permite
 * cruzar con el partido) y qué tareas de balón parado se llegaron a hacer, con
 * su tiempo y su desgaste **ya medido**.
 *
 * Ese desgaste es el motivo de leerla: la planificación puede estimar la carga
 * de un trabajo, pero si la tarea ya está registrada no hay que estimar nada
 * —se importa la cifra real y se marca como tal—.
 *
 * La pestaña tiene una fila de título por encima de las cabeceras, así que no
 * se puede usar `loadSheet` tal cual: se localiza la fila de cabeceras y se lee
 * por nombre de columna, no por posición. La hoja gana columnas cada temporada
 * y las posiciones fijas se rompen en silencio.
 */

import Papa from "papaparse";

import { norm, num } from "./model";
import { sheetUrl } from "./sheets";
import type { AbpLado, AspectoKey, DiaKey } from "./microciclo";
import { DIA_KEYS } from "./microciclo";

/** Pestaña «registro de tareas», en el mismo libro que las hojas de ABP. */
export const REGISTRO_GID = "111318766";

export type RegistroTarea = {
  temporada: string;
  micro: number;
  rival: string;
  dia: DiaKey | "";
  md: string;
  fecha: string;
  tarea: string;
  tipoTarea: string;
  fase: string;
  /** Cómo se monta la tarea: «8v8+6». Lo pide el editor de microciclos para
      poder sugerir lo que ya se usa. */
  formato: string;
  grupo: string;
  contenidoPrincipal: string;
  contenidoSecundario: string;
  tiempo: number;
  intensidad: number;
  /** «Carga Ponderada» de la hoja: tiempo × intensidad. */
  carga: number;
  exigCog: number;
  /** «Carga cognitiva» de la hoja. Su fórmula lleva más ingredientes. */
  cargaCog: number;
  observaciones: string;
  /*
  | La valoración de la tarea, tal y como la escribió quien la dirigió.
  |
  | La hoja la tiene desde siempre —y `/microcycles` ya la enseña—, pero aquí
  | no se leía. Se lee desde el 16/09/2026 porque es lo único que dice si lo
  | planificado salió bien: el informe de ABP del microciclo la lleva. Un cero
  | es «no valorada», que es distinto de valorarla con un cero; por eso
  | `hayEvaluacion` mira que la casilla traiga algo.
  */
  evaluacion: number;
  analisisPost: string;
};

/** `true` si alguien valoró de verdad esa tarea. */
export function hayEvaluacion(tarea: RegistroTarea) {
  return tarea.evaluacion > 0 || tarea.analisisPost.trim().length > 0;
}

export type RegistroMicro = {
  temporada: string;
  micro: number;
  rival: string;
  /** MD por día, tal y como está escrito en la hoja. */
  md: Partial<Record<DiaKey, string>>;
  tareas: number;
  tareasAbp: number;
};

export type RegistroDataset = {
  tareas: RegistroTarea[];
  micros: RegistroMicro[];
};

/* ------------------------------------------------------------------ */
/*  LECTURA                                                            */
/* ------------------------------------------------------------------ */

/** Localiza una columna por su nombre, tolerando cómo esté escrita. */
function indiceDe(cabeceras: string[], ...pistas: string[]) {
  for (const pista of pistas) {
    const buscado = norm(pista);

    const indice = cabeceras.findIndex((cabecera) =>
      norm(cabecera).startsWith(buscado),
    );

    if (indice >= 0) return indice;
  }

  return -1;
}

const DIAS_VALIDOS = new Set<string>(DIA_KEYS);

function parseDia(value: string): DiaKey | "" {
  const limpio = value.trim().toUpperCase();

  /*
  | «Miércoles» no es «M».
  |
  | Quedándose con la primera letra, un día escrito entero metía el miércoles
  | en la casilla del martes y el sábado en la del viernes, sin decir nada. La
  | app siempre escribe la inicial, pero la hoja la rellenan personas.
  */
  const enteros: Record<string, DiaKey> = {
    LUNES: "L",
    MARTES: "M",
    MIERCOLES: "X",
    MIÉRCOLES: "X",
    JUEVES: "J",
    VIERNES: "V",
    SABADO: "S",
    SÁBADO: "S",
    DOMINGO: "D",
  };

  if (enteros[limpio]) return enteros[limpio];

  const letra = limpio.slice(0, 1);

  return DIAS_VALIDOS.has(letra) ? (letra as DiaKey) : "";
}

export async function loadRegistro(): Promise<RegistroDataset> {
  const response = await fetch(sheetUrl(REGISTRO_GID), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`No se pudo leer el registro de tareas (${response.status})`);
  }

  const parsed = Papa.parse<string[]>(await response.text(), {
    header: false,
    skipEmptyLines: true,
  });

  const filas = parsed.data;

  /* La fila de cabeceras no siempre es la primera: encima hay un título. */
  const filaCabecera = filas.findIndex(
    (fila) => norm(fila?.[0]) === "temporada",
  );

  if (filaCabecera < 0) return { tareas: [], micros: [] };

  const cabeceras = filas[filaCabecera].map((valor) => String(valor ?? ""));

  const col = {
    temporada: indiceDe(cabeceras, "temporada"),
    micro: indiceDe(cabeceras, "micro"),
    rival: indiceDe(cabeceras, "rival"),
    dia: indiceDe(cabeceras, "dia", "día"),
    md: indiceDe(cabeceras, "md"),
    fecha: indiceDe(cabeceras, "fecha"),
    tarea: indiceDe(cabeceras, "tarea"),
    tipoTarea: indiceDe(cabeceras, "tipo tarea"),
    fase: indiceDe(cabeceras, "fase"),
    formato: indiceDe(cabeceras, "formato"),
    grupo: indiceDe(cabeceras, "grupo"),
    principal: indiceDe(cabeceras, "contenido principal"),
    secundario: indiceDe(cabeceras, "contenido secundario"),
    tiempo: indiceDe(cabeceras, "tiempo"),
    intensidad: indiceDe(cabeceras, "intensidad"),
    carga: indiceDe(cabeceras, "carga ponderada"),
    exigCog: indiceDe(cabeceras, "exig.cog", "exig cog", "exigencia cog"),
    cargaCog: indiceDe(cabeceras, "carga cognitiva"),
    observaciones: indiceDe(cabeceras, "observaciones"),
    evaluacion: indiceDe(cabeceras, "evaluacion", "evaluación", "valoracion"),
    analisisPost: indiceDe(cabeceras, "analisis post", "análisis post"),
  };

  const texto = (fila: string[], indice: number) =>
    indice >= 0 ? String(fila[indice] ?? "").trim() : "";

  const numero = (fila: string[], indice: number) =>
    indice >= 0 ? num(fila[indice]) : 0;

  const tareas: RegistroTarea[] = [];

  filas.slice(filaCabecera + 1).forEach((fila) => {
    if (!Array.isArray(fila)) return;

    const micro = numero(fila, col.micro);
    const tarea = texto(fila, col.tarea);

    if (micro <= 0 || !tarea) return;

    tareas.push({
      temporada: texto(fila, col.temporada),
      micro,
      rival: texto(fila, col.rival),
      dia: parseDia(texto(fila, col.dia)),
      md: texto(fila, col.md),
      fecha: texto(fila, col.fecha),
      tarea,
      tipoTarea: texto(fila, col.tipoTarea),
      fase: texto(fila, col.fase),
      formato: texto(fila, col.formato),
      grupo: texto(fila, col.grupo),
      contenidoPrincipal: texto(fila, col.principal),
      contenidoSecundario: texto(fila, col.secundario),
      tiempo: numero(fila, col.tiempo),
      intensidad: numero(fila, col.intensidad),
      carga: numero(fila, col.carga),
      exigCog: numero(fila, col.exigCog),
      cargaCog: numero(fila, col.cargaCog),
      observaciones: texto(fila, col.observaciones),
      evaluacion: numero(fila, col.evaluacion),
      analisisPost: texto(fila, col.analisisPost),
    });
  });

  /* --- Microciclos, en el orden en que se juegan --- */

  const porMicro = new Map<string, RegistroMicro>();

  /**
   * El rival se repite en cada fila del micro, pero no siempre coincide: el
   * micro 2 tiene diecisiete filas con un rival y dos con otro, seguramente
   * de arrastrar la celda. Quedarse con el primero deja el microciclo atado
   * al partido equivocado según cómo estén ordenadas las filas, así que manda
   * el mayoritario.
   */
  const votosRival = new Map<string, Map<string, number>>();

  tareas.forEach((tarea) => {
    const clave = `${tarea.temporada}#${tarea.micro}`;

    const actual =
      porMicro.get(clave) ??
      ({
        temporada: tarea.temporada,
        micro: tarea.micro,
        rival: "",
        md: {},
        tareas: 0,
        tareasAbp: 0,
      } satisfies RegistroMicro);

    actual.tareas += 1;

    if (esTareaAbp(tarea)) actual.tareasAbp += 1;

    if (tarea.rival) {
      const votos = votosRival.get(clave) ?? new Map<string, number>();

      votos.set(tarea.rival, (votos.get(tarea.rival) ?? 0) + 1);
      votosRival.set(clave, votos);
    }

    if (tarea.dia && tarea.md && !actual.md[tarea.dia]) {
      actual.md[tarea.dia] = tarea.md;
    }

    porMicro.set(clave, actual);
  });

  porMicro.forEach((micro, clave) => {
    const votos = [...(votosRival.get(clave) ?? new Map())];

    micro.rival =
      votos.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  });

  const micros = [...porMicro.values()].sort(
    (a, b) => a.temporada.localeCompare(b.temporada, "es") || a.micro - b.micro,
  );

  return { tareas, micros };
}

/* ------------------------------------------------------------------ */
/*  QUÉ ES UNA TAREA DE ABP                                            */
/* ------------------------------------------------------------------ */

/**
 * La hoja no tiene una casilla de «esto es ABP».
 *
 * A veces la fase lo dice («ABP Ofensivo»), a veces sólo lo dice el contenido
 * («Global» + «Corners y faltas of»), y hay tareas de ABP con la fase puesta en
 * «Competición» o «Defensiva». Se mira en los cuatro sitios.
 */
const PISTAS_ABP =
  /\babp\b|balon parado|corner|falta lateral|falta directa|saque de banda|saque de puerta|saque de meta|saque de medio|penalti|penati/;

/**
 * ¿Este texto habla de balón parado?
 *
 * Sale fuera de `esTareaAbp` (16/09/2026) porque hay otro sitio que necesita la
 * misma pregunta con otro texto: el **seguimiento individual**, donde tampoco
 * hay casilla de «esto es ABP» y lo único que se puede mirar son los objetivos
 * y el feedback escritos a mano. Compartir el criterio evita que la misma tarea
 * cuente como ABP en una pantalla y no en la otra.
 *
 * Es una lectura de texto libre, no un dato: quien la use tiene que decir que
 * es una estimación.
 */
export function textoEsAbp(...partes: (string | undefined)[]) {
  return PISTAS_ABP.test(norm(partes.filter(Boolean).join(" · ")));
}

export function esTareaAbp(tarea: RegistroTarea) {
  return textoEsAbp(
    tarea.fase,
    tarea.contenidoPrincipal,
    tarea.contenidoSecundario,
    tarea.tipoTarea,
  );
}

/** Ofensivo, defensivo, o `null` si la hoja no lo dice y hay que elegirlo. */
export function ladoDeTarea(tarea: RegistroTarea): AbpLado | null {
  const texto = norm(
    [tarea.fase, tarea.contenidoPrincipal, tarea.contenidoSecundario].join(" "),
  );

  const ofensivo = /ofensiv|\bof\b/.test(texto);
  const defensivo = /defensiv|\bdef\b/.test(texto);

  /* «Corners y faltas of y def» menciona los dos: que lo decida quien importa. */
  if (ofensivo && defensivo) return null;
  if (ofensivo) return "ofensivo";
  if (defensivo) return "defensivo";

  return null;
}

/**
 * Aspecto **propuesto** para una tarea del registro.
 *
 * Es una lectura del texto libre del contenido, no un dato: la hoja escribe
 * «Córners y faltas laterales ofensivas» en una sola casilla y ahí caben dos
 * aspectos del catálogo. Por eso el diálogo de importación lo enseña como
 * sugerencia editable y no lo aplica a ciegas.
 */
export function aspectoDeTarea(tarea: RegistroTarea): AspectoKey | null {
  const texto = norm(
    [tarea.contenidoSecundario, tarea.contenidoPrincipal, tarea.fase].join(" "),
  );

  if (/penalti|penati/.test(texto)) return "penalti";
  if (/saque de medio|saque de centro/.test(texto)) return "saque-medio";
  if (/saque de puerta|saque de meta|reinicio/.test(texto)) {
    return "reinicio-porteria";
  }

  if (/banda/.test(texto)) {
    if (/z ?3|zona ?3/.test(texto)) return "banda-z3";
    if (/z ?1|zona ?1|inicio/.test(texto)) return "banda-z1";

    return "banda-z2";
  }

  if (/corner/.test(texto)) {
    return /corto|indirect/.test(texto) ? "corner-indirecto" : "corner-directo";
  }

  if (/falta directa/.test(texto)) return "falta-directa-porteria";

  if (/falta/.test(texto)) {
    return /corto|indirect/.test(texto)
      ? "falta-lateral-indirecta"
      : "falta-lateral-directa";
  }

  return null;
}
