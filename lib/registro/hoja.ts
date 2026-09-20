/**
 * ESCRIBIR EN LA HOJA DE REGISTRO DE TAREAS.
 *
 * La pestaña de registro (gid `111318766`) es de donde come todo lo que
 * analiza microciclos: `/microcycles`, la transferencia de Data Análisis, el
 * microciclo de ABP y el calendario de micros. Rellenarla a mano, fila a fila,
 * es media hora por semana; esto es el vocabulario para poder hacerlo desde la
 * app sin romper nada.
 *
 * LO QUE NO SE PUEDE TOCAR, Y POR QUÉ
 *
 * Tres columnas son **fórmulas** de la propia hoja, comprobadas contra sus
 * valores crudos:
 *
 *   - `Carga Ponderada` = Tiempo × Intensidad.
 *   - `Carga cognitiva` = Tiempo × Demanda Cognitiva.
 *   - `Demanda Cognitiva`, que sale del bloque Densidad…Motivación con una
 *     fórmula que **no se puede reconstruir desde fuera** (no es lineal).
 *
 * Por eso al escribir NO se mandan: la fila nueva se crea **clonando la de
 * arriba** (`insertRowsAfter` + `copyTo`), que arrastra fórmulas, formato y
 * validaciones, y después se escriben sólo las columnas de mano. Un
 * `appendRow` dejaría la fila sin carga y sin demanda cognitiva, que es
 * justamente lo que miden todas las pantallas.
 *
 * Y la cabecera **no está en la fila 1**: encima hay un título del club. El
 * script busca la fila que empieza por «Temporada», igual que
 * `lib/abp/registro.ts`.
 */

/** Las 32 columnas, en el orden exacto de la hoja. */
export const COLUMNAS_REGISTRO = [
  "Temporada",
  "Micro",
  "Rival",
  "Día",
  "MD",
  "Fecha",
  "Tarea",
  "Tipo Tarea",
  "Evaluación",
  "Análisis Post",
  "Formato",
  "Nº Jugadores",
  "Grupo",
  "Espacio",
  "Contenido Principal",
  "Contenido Secundario",
  "Fase",
  "Tiempo",
  "Intensidad (1-5)",
  "Carga Ponderada",
  "Exig.Cog.(1-5)",
  "Carga cognitiva",
  "Demanda Cognitiva",
  "Densidad",
  "NºJug",
  "NºComodines",
  "Normativa",
  "Incertidumbre",
  "Familiaridad (dificultad)",
  "Motivacion",
  "Observaciones",
] as const;

/**
 * Las que calcula la hoja. No se mandan nunca: se heredan de la fila clonada.
 */
export const CALCULADAS = [
  "Carga Ponderada",
  "Carga cognitiva",
  "Demanda Cognitiva",
] as const;

export type ColumnaRegistro = (typeof COLUMNAS_REGISTRO)[number];

/** Una fila de tarea, tal y como la escribe la app. */
export type FilaRegistro = Partial<Record<ColumnaRegistro, string | number>>;

/* ------------------------------------------------------------------ */
/*  VOCABULARIO DE LA HOJA                                             */
/* ------------------------------------------------------------------ */

/*
| Las listas salen de lo que ya está escrito en la hoja, no de un manual.
|
| Son las mismas opciones que el cuerpo técnico viene usando toda la
| temporada: si se escribe otra cosa, la fila entra igual —la hoja no lo
| rechaza— pero deja de agruparse con las demás en los gráficos.
*/
export const TIPOS_TAREA = [
  "Activación",
  "Analítica",
  "Ataque - Defensa",
  "Circuito",
  "Competición",
  "Específico",
  "Finalizaciones",
  "Juego de Posesión",
  "Juego Posicional",
  "Oleadas",
  "Partido Condicionado",
  "Rondo",
  "Rondo Complejo",
  "Rueda de Pases",
  "Situación de Juego",
  "Tarea Integrada",
  "Trabajo de Fuerza",
  "Vuelta a la calma",
];

export const FASES = [
  "Ofensiva",
  "Defensiva",
  "Tr Ofensiva",
  "Tr Defensiva",
  "Global",
  "Competición",
  "Conductual",
  "ABP Ofensivo",
  "ABP Defensivo",
  "ABP Global",
];

/** Las fases que cuentan como balón parado, para poder marcarlas. */
export const FASES_ABP = ["ABP Ofensivo", "ABP Defensivo", "ABP Global"];

export const GRUPOS = ["Plantilla Parcial", "Plantilla Completa", "Grupo Reducido"];

/* ------------------------------------------------------------------ */
/*  EL MODELO QUE MANEJA LA PANTALLA                                   */
/* ------------------------------------------------------------------ */

export type TareaNueva = {
  /** Identificador dentro de la sesión: «D-T1», «X-COMP». */
  tarea: string;
  tipoTarea: string;
  fase: string;
  formato: string;
  grupo: string;
  jugadores: number;
  contenidoPrincipal: string;
  contenidoSecundario: string;
  tiempo: number;
  intensidad: number;
  exigCog: number;
  densidad: number;
  nJug: number;
  nComodines: number;
  normativa: number;
  incertidumbre: number;
  familiaridad: number;
  motivacion: number;
  observaciones: string;
};

export type SesionNueva = {
  /** "2026-09-20". */
  fecha: string;
  dia: string;
  md: string;
  /** Sin tareas es un día de descanso: no se escribe ninguna fila. */
  tareas: TareaNueva[];
};

export type MicroNuevo = {
  temporada: string;
  micro: number;
  rival: string;
  sesiones: SesionNueva[];
};

/* ------------------------------------------------------------------ */
/*  LO QUE YA SE ESCRIBE EN LA HOJA                                    */
/* ------------------------------------------------------------------ */

/**
 * Las opciones, sacadas de la propia hoja y ordenadas por lo que más se usa.
 *
 * Las listas de arriba son el respaldo —lo que hay que ofrecer una temporada
 * nueva, con la hoja en blanco— pero mandan los valores que el cuerpo técnico
 * viene escribiendo: «Partido Reducido» y «Juego de Posición» existen y no
 * estaban en ningún catálogo, y escribirlos distinto rompe los agrupados de
 * `/microcycles`.
 */
export function sugerenciasDelRegistro(
  tareas: {
    tipoTarea: string;
    fase: string;
    formato: string;
    grupo: string;
    contenidoPrincipal: string;
    contenidoSecundario: string;
  }[],
) {
  const porUso = (valores: string[], respaldo: string[] = []) => {
    const cuenta = new Map<string, number>();

    for (const bruto of valores) {
      const valor = (bruto || "").trim();

      if (!valor) continue;

      cuenta.set(valor, (cuenta.get(valor) ?? 0) + 1);
    }

    const usados = [...cuenta].sort((a, b) => b[1] - a[1]).map(([valor]) => valor);

    /* Lo del catálogo que nadie ha usado todavía, detrás y en su orden. */
    return [...usados, ...respaldo.filter((uno) => !cuenta.has(uno))];
  };

  return {
    tipos: porUso(tareas.map((t) => t.tipoTarea), TIPOS_TAREA),
    fases: porUso(tareas.map((t) => t.fase), FASES),
    formatos: porUso(tareas.map((t) => t.formato)),
    grupos: porUso(tareas.map((t) => t.grupo), GRUPOS),
    principales: porUso(tareas.map((t) => t.contenidoPrincipal)),
    secundarios: porUso(tareas.map((t) => t.contenidoSecundario)),
  };
}

export type Sugerencias = ReturnType<typeof sugerenciasDelRegistro>;

export function tareaVacia(dia: string, numero: number): TareaNueva {
  return {
    tarea: `${dia}-T${numero}`,
    tipoTarea: "",
    fase: "",
    formato: "",
    grupo: "Plantilla Parcial",
    jugadores: 22,
    contenidoPrincipal: "",
    contenidoSecundario: "",
    tiempo: 0,
    intensidad: 0,
    exigCog: 0,
    densidad: 0,
    nJug: 0,
    nComodines: 0,
    normativa: 0,
    incertidumbre: 0,
    familiaridad: 0,
    motivacion: 0,
    observaciones: "",
  };
}

/** La fila del partido, que en la hoja es una tarea más («X-COMP»). */
export function tareaDeCompeticion(dia: string): TareaNueva {
  return {
    ...tareaVacia(dia, 1),
    tarea: `${dia}-COMP`,
    tipoTarea: "Competición",
    fase: "Competición",
  };
}

/* ------------------------------------------------------------------ */
/*  MANEJAR LAS SESIONES                                               */
/* ------------------------------------------------------------------ */

/**
 * Renumera las tareas de una sesión: D-T1, D-T2…
 *
 * Quitar la segunda de cuatro dejaba T1, T3 y T4, y en la hoja eso se lee como
 * que falta una. La del partido («X-COMP») no lleva número y se queda quieta.
 */
export function renumera(sesion: SesionNueva): SesionNueva {
  let numero = 0;

  return {
    ...sesion,
    tareas: sesion.tareas.map((tarea) => {
      if (/-COMP$/i.test(tarea.tarea)) return tarea;

      numero += 1;

      return { ...tarea, tarea: `${sesion.dia}-T${numero}` };
    }),
  };
}

/** Minutos de cada sesión y del microciclo entero. */
export function minutosDe(sesiones: SesionNueva[]) {
  const porFecha: Record<string, number> = {};

  let total = 0;

  let tareas = 0;

  for (const sesion of sesiones) {
    const suyos = sesion.tareas.reduce((suma, tarea) => suma + (tarea.tiempo || 0), 0);

    porFecha[sesion.fecha] = suyos;

    total += suyos;

    tareas += sesion.tareas.length;
  }

  return { porFecha, total, tareas };
}

/** Los minutos de balón parado, que son los que mide el microciclo de ABP. */
export function minutosAbp(sesiones: SesionNueva[]) {
  return sesiones.reduce(
    (suma, sesion) =>
      suma +
      sesion.tareas.reduce(
        (parcial, tarea) =>
          parcial + (FASES_ABP.includes(tarea.fase) ? tarea.tiempo || 0 : 0),
        0,
      ),
    0,
  );
}

export type TareaDeOtro = {
  dia: string;
  md: string;
  tarea: string;
  tipoTarea: string;
  fase: string;
  formato: string;
  grupo: string;
  contenidoPrincipal: string;
  contenidoSecundario: string;
  tiempo: number;
  intensidad: number;
  exigCog: number;
};

/**
 * Copia la estructura de otro microciclo sobre el que se está creando.
 *
 * Una semana se parece mucho a la anterior: los mismos tipos de tarea en el
 * mismo sitio, los mismos contenidos, los mismos tiempos. Copiarla y cambiar lo
 * que toque es la mitad del trabajo.
 *
 * **Se ata por MD, no por día de la semana**: el MD-2 de la semana pasada es el
 * MD-2 de ésta aunque uno cayera en sábado y el otro en lunes. Lo que no
 * encuentre pareja se queda como estaba, sin borrar nada.
 */
export function copiaEstructura(
  sesiones: SesionNueva[],
  deOtro: TareaDeOtro[],
): SesionNueva[] {
  const porMd = new Map<string, TareaDeOtro[]>();

  for (const tarea of deOtro) {
    const clave = (tarea.md || "").trim().toUpperCase();

    if (!clave) continue;

    porMd.set(clave, [...(porMd.get(clave) ?? []), tarea]);
  }

  return sesiones.map((sesion) => {
    const suyas = porMd.get((sesion.md || "").trim().toUpperCase());

    if (!suyas || suyas.length === 0) return sesion;

    return renumera({
      ...sesion,
      tareas: suyas.map((tarea, indice) => ({
        ...tareaVacia(sesion.dia, indice + 1),
        /* La del partido conserva su nombre; las demás se renumeran después. */
        tarea: /-COMP$/i.test(tarea.tarea) ? `${sesion.dia}-COMP` : `${sesion.dia}-T${indice + 1}`,
        tipoTarea: tarea.tipoTarea,
        fase: tarea.fase,
        formato: tarea.formato,
        grupo: tarea.grupo || "Plantilla Parcial",
        contenidoPrincipal: tarea.contenidoPrincipal,
        contenidoSecundario: tarea.contenidoSecundario,
        tiempo: tarea.tiempo,
        intensidad: tarea.intensidad,
        exigCog: tarea.exigCog,
      })),
    });
  });
}

/* ------------------------------------------------------------------ */
/*  DE LA PANTALLA A LA HOJA                                           */
/* ------------------------------------------------------------------ */

/** "2026-09-20" → "20/09/2026", que es como lo escribe la hoja. */
export function aFechaHoja(iso: string) {
  const trozos = (iso || "").split("-");

  return trozos.length === 3 ? `${trozos[2]}/${trozos[1]}/${trozos[0]}` : iso;
}

/**
 * Las filas listas para la hoja.
 *
 * Un cero no es un dato: si nadie ha puesto el tiempo o la intensidad, la
 * casilla se manda **vacía**. Escribir ceros haría que las medias de carga de
 * `/microcycles` bajaran por tareas que sólo están esbozadas.
 */
export function filasDelMicro(micro: MicroNuevo): FilaRegistro[] {
  const filas: FilaRegistro[] = [];

  const numero = (valor: number) => (valor > 0 ? valor : "");

  for (const sesion of micro.sesiones) {
    for (const tarea of sesion.tareas) {
      filas.push({
        Temporada: micro.temporada,
        Micro: micro.micro,
        Rival: micro.rival,
        "Día": sesion.dia,
        MD: sesion.md,
        Fecha: aFechaHoja(sesion.fecha),
        Tarea: tarea.tarea,
        "Tipo Tarea": tarea.tipoTarea,
        Formato: tarea.formato,
        "Nº Jugadores": numero(tarea.jugadores),
        Grupo: tarea.grupo,
        "Contenido Principal": tarea.contenidoPrincipal,
        "Contenido Secundario": tarea.contenidoSecundario,
        Fase: tarea.fase,
        Tiempo: numero(tarea.tiempo),
        "Intensidad (1-5)": numero(tarea.intensidad),
        "Exig.Cog.(1-5)": numero(tarea.exigCog),
        Densidad: numero(tarea.densidad),
        "NºJug": numero(tarea.nJug),
        "NºComodines": numero(tarea.nComodines),
        Normativa: numero(tarea.normativa),
        Incertidumbre: numero(tarea.incertidumbre),
        "Familiaridad (dificultad)": numero(tarea.familiaridad),
        Motivacion: numero(tarea.motivacion),
        Observaciones: tarea.observaciones,
      });
    }
  }

  return filas;
}

/** Lo que hay que mirar antes de escribir nada. */
export function revisaMicro(micro: MicroNuevo) {
  const problemas: string[] = [];

  if (!micro.temporada.trim()) problemas.push("Falta la temporada.");

  if (!(micro.micro > 0)) problemas.push("Falta el número de microciclo.");

  if (!micro.rival.trim()) problemas.push("Falta el rival (o «NO COMPETICIÓN»).");

  const conTareas = micro.sesiones.filter((sesion) => sesion.tareas.length > 0);

  if (conTareas.length === 0) problemas.push("No hay ninguna sesión con tareas.");

  const nombres = new Set<string>();

  for (const sesion of conTareas) {
    for (const tarea of sesion.tareas) {
      if (!tarea.tarea.trim()) {
        problemas.push(`Hay una tarea sin nombre el ${aFechaHoja(sesion.fecha)}.`);

        continue;
      }

      if (nombres.has(tarea.tarea)) {
        problemas.push(`«${tarea.tarea}» está repetida: los nombres de tarea no se repiten dentro de un microciclo.`);
      }

      nombres.add(tarea.tarea);
    }
  }

  return problemas;
}
