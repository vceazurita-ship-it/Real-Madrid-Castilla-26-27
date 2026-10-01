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
  /**
   * Las columnas de la hoja que el editor no maneja —«Evaluación», «Análisis
   * Post», «Espacio»—, tal y como estaban.
   *
   * Editar un microciclo es borrar sus filas y escribirlas otra vez: sin esto,
   * retocar un tiempo se llevaba por delante la valoración que el cuerpo
   * técnico escribió después de la sesión.
   */
  extra?: Record<string, string | number>;
};

export type SesionNueva = {
  /** "2026-09-20". */
  fecha: string;
  dia: string;
  md: string;
  /** Sin tareas es un día de descanso: no se escribe ninguna fila. */
  tareas: TareaNueva[];
  /**
   * Día libre marcado a propósito (27/09/2026).
   *
   * No es lo mismo que un día que se ha quedado sin tareas: copiar otra semana
   * no le mete tareas y la pantalla lo pinta como libre, no como pendiente.
   */
  libre?: boolean;
  /**
   * El rival de ESTE día, si no es el del microciclo (01/10/2026).
   *
   * Un micro puede abarcar dos partidos —el 13 lleva la semana del Sant
   * Andreu y la del Alcorcón— y cada fila lleva el suyo. Editarlo con un
   * único rival reescribía las del segundo partido con el nombre del primero.
   */
  rival?: string;
};

/**
 * Una tarea que nadie ha tocado: sin tipo, sin contenido, sin tiempo ni
 * observaciones. No se escribe en la hoja.
 *
 * Cada día nacía con cuatro tareas vacías y, si no se quitaban a mano, se
 * escribían como cuatro filas en blanco en el registro.
 */
export function tareaEnBlanco(tarea: TareaNueva) {
  return (
    !tarea.tipoTarea.trim() &&
    !tarea.contenidoPrincipal.trim() &&
    !tarea.contenidoSecundario.trim() &&
    !tarea.observaciones.trim() &&
    !(tarea.tiempo > 0)
  );
}

/** Las tareas de una sesión que sí se escriben. */
export const tareasQueSeEscriben = (sesion: SesionNueva) =>
  sesion.libre ? [] : sesion.tareas.filter((tarea) => !tareaEnBlanco(tarea));

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

    /* Se SUMA: dos sesiones pueden acabar con la misma fecha si alguien la
       corrige a mano, y asignando, el panel de una enseñaba los minutos de la
       otra. */
    porFecha[sesion.fecha] = (porFecha[sesion.fecha] ?? 0) + suyos;

    total += suyos;

    /* Las que se escriben: las cuatro vacías de cada día no cuentan. */
    tareas += tareasQueSeEscriben(sesion).length;
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
): { sesiones: SesionNueva[]; puestas: number; sinPareja: number } {
  const porMd = new Map<string, TareaDeOtro[]>();

  for (const tarea of deOtro) {
    const clave = (tarea.md || "").trim().toUpperCase();

    if (!clave) continue;

    porMd.set(clave, [...(porMd.get(clave) ?? []), tarea]);
  }

  /* Un MD sólo se vuelca una vez: si el usuario escribe «MD-3» en dos días, el
     bloque iría a los dos y el microciclo saldría con las tareas duplicadas. */
  const usados = new Set<string>();

  let puestas = 0;

  const nuevas = sesiones.map((sesion) => {
    const clave = (sesion.md || "").trim().toUpperCase();

    const suyas = usados.has(clave) ? undefined : porMd.get(clave);

    if (!suyas || suyas.length === 0) return sesion;

    usados.add(clave);

    puestas += suyas.length;

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

  return { sesiones: nuevas, puestas, sinPareja: deOtro.length - puestas };
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
    for (const tarea of tareasQueSeEscriben(sesion)) {
      filas.push({
        /* Lo que el editor no toca va primero: lo suyo manda encima. */
        ...(tarea.extra ?? {}),
        Temporada: micro.temporada,
        Micro: micro.micro,
        Rival: sesion.rival?.trim() || micro.rival,
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
/**
 * Lo que hay que mirar antes de escribir nada.
 *
 * `permitirRepetidas`: al editar uno que YA está en la hoja con nombres
 * repetidos —el micro 13 tiene dos «L-T1», la de ABP y el rondo—, eso no puede
 * impedir guardarlo: se avisa en `avisos` y se deja escribir.
 */
export function revisaMicro(
  micro: MicroNuevo,
  { permitirRepetidas = false }: { permitirRepetidas?: boolean } = {},
) {
  const problemas: string[] = [];

  if (!micro.temporada.trim()) problemas.push("Falta la temporada.");

  if (!(micro.micro > 0)) problemas.push("Falta el número de microciclo.");

  if (!micro.rival.trim()) problemas.push("Falta el rival (o «NO COMPETICIÓN»).");

  const conTareas = micro.sesiones.filter((sesion) => tareasQueSeEscriben(sesion).length > 0);

  if (conTareas.length === 0) problemas.push("No hay ninguna sesión con tareas rellenas.");

  const nombres = new Set<string>();

  for (const sesion of conTareas) {
    /*
    | La fecha tiene que ser una fecha.
    |
    | El campo es editable y nadie valida lo que se escribe: con «20/9/26» o
    | «2026/09/20», el panel se titulaba «undefined NaN», la hoja recibía texto
    | en vez de fecha —y el calendario de microciclos deja de ver esa fila— y
    | la ventana del microciclo se saltaba el día entero.
    */
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sesion.fecha)) {
      problemas.push(
        `La fecha «${sesion.fecha || "(vacía)"}» no vale: se escribe como 2026-09-20.`,
      );
    } else if (Number.isNaN(Date.parse(`${sesion.fecha}T12:00:00Z`))) {
      problemas.push(`La fecha «${sesion.fecha}» no existe en el calendario.`);
    }

    for (const tarea of tareasQueSeEscriben(sesion)) {
      if (!tarea.tarea.trim()) {
        problemas.push(`Hay una tarea sin nombre el ${aFechaHoja(sesion.fecha)}.`);

        continue;
      }

      if (nombres.has(tarea.tarea) && !permitirRepetidas) {
        problemas.push(`«${tarea.tarea}» está repetida: los nombres de tarea no se repiten dentro de un microciclo.`);
      }

      nombres.add(tarea.tarea);
    }
  }

  return problemas;
}

/* ------------------------------------------------------------------ */
/*  DE LA HOJA A LA PANTALLA: EDITAR UN MICROCICLO                     */
/* ------------------------------------------------------------------ */

/** Las columnas que el editor no maneja y que hay que devolver tal cual. */
export const COLUMNAS_QUE_VIAJAN = ["Evaluación", "Análisis Post", "Espacio"] as const;

const numeroDeHoja = (valor: unknown) => {
  const n = Number(String(valor ?? "").replace(",", ".").trim());

  return Number.isFinite(n) && n > 0 ? n : 0;
};

const textoDeHoja = (valor: unknown) => String(valor ?? "").trim();

/** "20/09/2026", "2026-09-20" o "2026-09-20T…" → "2026-09-20". */
export function fechaIsoDeHoja(valor: unknown) {
  const texto = textoDeHoja(valor);

  const iso = texto.match(/^(d{4})-(d{2})-(d{2})/);

  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const barras = texto.match(/^(d{1,2})[/-](d{1,2})[/-](d{4})$/);

  if (barras) return `${barras[3]}-${barras[2].padStart(2, "0")}-${barras[1].padStart(2, "0")}`;

  return texto;
}

/**
 * Un microciclo de la hoja, listo para editarlo.
 *
 * Las filas llegan de `registroFilas` con TODAS sus columnas (el CSV
 * publicado no trae las de la demanda cognitiva y tarda minutos en
 * refrescar). Se agrupan por fecha, en el orden de la hoja.
 */
export function microDeFilas(
  filas: Record<string, unknown>[],
  respaldo: { temporada: string; micro: number; rival: string },
): MicroNuevo {
  const porFecha = new Map<string, SesionNueva>();

  for (const fila of filas) {
    const fecha = fechaIsoDeHoja(fila.Fecha);

    const dia = textoDeHoja(fila["Día"]).toUpperCase().slice(0, 1);

    if (!porFecha.has(fecha)) {
      porFecha.set(fecha, {
        fecha,
        dia,
        md: textoDeHoja(fila.MD).toUpperCase(),
        tareas: [],
        rival: textoDeHoja(fila.Rival),
      });
    }

    const extra: Record<string, string | number> = {};

    for (const columna of COLUMNAS_QUE_VIAJAN) {
      const valor = fila[columna];

      if (valor !== undefined && valor !== null && valor !== "") {
        extra[columna] = typeof valor === "number" ? valor : String(valor);
      }
    }

    porFecha.get(fecha)!.tareas.push({
      tarea: textoDeHoja(fila.Tarea),
      tipoTarea: textoDeHoja(fila["Tipo Tarea"]),
      fase: textoDeHoja(fila.Fase),
      formato: textoDeHoja(fila.Formato),
      grupo: textoDeHoja(fila.Grupo),
      jugadores: numeroDeHoja(fila["Nº Jugadores"]),
      contenidoPrincipal: textoDeHoja(fila["Contenido Principal"]),
      contenidoSecundario: textoDeHoja(fila["Contenido Secundario"]),
      tiempo: numeroDeHoja(fila.Tiempo),
      intensidad: numeroDeHoja(fila["Intensidad (1-5)"]),
      exigCog: numeroDeHoja(fila["Exig.Cog.(1-5)"]),
      densidad: numeroDeHoja(fila.Densidad),
      nJug: numeroDeHoja(fila["NºJug"]),
      nComodines: numeroDeHoja(fila["NºComodines"]),
      normativa: numeroDeHoja(fila.Normativa),
      incertidumbre: numeroDeHoja(fila.Incertidumbre),
      familiaridad: numeroDeHoja(fila["Familiaridad (dificultad)"]),
      motivacion: numeroDeHoja(fila.Motivacion),
      observaciones: textoDeHoja(fila.Observaciones),
      extra,
    });
  }

  const primera = filas[0] ?? {};

  const rival = textoDeHoja(primera.Rival) || respaldo.rival;

  return {
    temporada: textoDeHoja(primera.Temporada) || respaldo.temporada,
    micro: numeroDeHoja(primera.Micro) || respaldo.micro,
    rival,
    /* El rival sólo se guarda en el día cuando es OTRO: así cambiar el del
       microciclo arriba sigue cambiando todos los demás. */
    sesiones: [...porFecha.values()]
      .map((sesion) => (sesion.rival === rival ? { ...sesion, rival: undefined } : sesion))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
  };
}
