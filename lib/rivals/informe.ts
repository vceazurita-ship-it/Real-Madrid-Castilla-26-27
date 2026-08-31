/*
|--------------------------------------------------------------------------
| EL INFORME DEL RIVAL
|--------------------------------------------------------------------------
|
| Lo que hace falta para montar `public/INFORME RIVAL.pptx` sin que nadie
| tenga que abrir BeSoccer: la clasificación del grupo, los partidos de la
| temporada con sus goleadores, el entrenador, el estadio, las estructuras que
| repite y las últimas alineaciones.
|
| Va en Supabase (`app_documents`, clave `rivals:informe`) por lo mismo que las
| estadísticas de jugador (`stats.ts` lo cuenta largo): la hoja RIVALES escribe
| **por nombre de columna** y no tiene cabeceras para nada de esto, así que un
| guardado ahí se descartaría en silencio devolviendo `success: true`. Y son
| datos que no edita nadie a mano: se regeneran con
| `node scripts/rivals-informe.mjs`.
|
| Es un documento aparte de `rivals:stats` a propósito. Aquél va por jugador y
| lo pide media app —las fichas, el PDF del once, el desplazamiento—; éste va
| por equipo, pesa lo suyo (diecinueve clasificaciones y cientos de partidos) y
| sólo lo abre quien se descarga el informe. Metiéndolos juntos, cada ficha de
| jugador arrastraría la liga entera.
|
| Aquí no hay lógica de pantalla ni de dibujo: sólo la forma del documento y
| cómo se encuentra dentro a un equipo. Lo pinta `informe-ppt.ts`.
*/

import { normalizeKey } from "@/lib/rivals/stats";

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

/** Una fila de la clasificación, en cualquiera de las tres pestañas. */
export type FilaClasificacion = {
  puesto: number;
  equipo: string;
  /** `cdn.resfu.com/img_data/equipos/<id>.png`. */
  escudo: string;
  /** Slug de BeSoccer, para saber cuál de las filas es el rival del informe. */
  slug: string;
  puntos: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  favor: number;
  contra: number;
};

/**
 * Las tres pestañas de la clasificación del grupo.
 *
 * La diapositiva enseña **total y visitante** cuando jugamos en casa, y
 * **total y local** cuando vamos fuera: lo que interesa del rival es cómo se
 * comporta donde va a jugar. Se guardan las tres y decide el que pinta.
 */
export type Clasificacion = {
  total: FilaClasificacion[];
  local: FilaClasificacion[];
  visitante: FilaClasificacion[];
};

/** Un gol, tal y como lo cuenta la ficha del partido. */
export type GolPartido = {
  /** "30", "45+2". Sin la comilla: la pone quien lo pinta. */
  minuto: string;
  jugador: string;
  /** `true` cuando el gol es del equipo del informe. */
  propio: boolean;
  /** "penalti", "propia" o "" para el gol normal. */
  tipo: "" | "penalti" | "propia";
};

export type LadoPartido = {
  nombre: string;
  escudo: string;
  slug: string;
  goles: number | null;
};

export type Partido = {
  /** Id de BeSoccer, que es la clave de la ficha y de la alineación. */
  id: string;
  /** ISO con zona, tal y como lo escribe `starttime`. */
  fecha: string;
  /** "Primera Federación", "Partidos Amistosos"… */
  competicion: string;
  local: LadoPartido;
  visitante: LadoPartido;
  /** `false` mientras no se haya jugado: entonces no hay marcador. */
  jugado: boolean;
  /** En casa del equipo del informe. */
  enCasa: boolean;
  /** "G", "E", "P" o "" si no se ha jugado. */
  resultado: "" | "G" | "E" | "P";
  /** Sólo de los partidos a los que se les ha pedido la ficha. */
  goles?: GolPartido[];
};

/** Una alineación de las que se enseñan en las dos últimas diapositivas. */
export type OncePartido = {
  /** El del `Partido` al que pertenece. */
  partidoId: string;
  /** "1-4-3-3", ya con el uno delante. */
  estructura: string;
  entrenador: string;
  jugadores: {
    /** 1..11, el `pos<N>` de BeSoccer: 1 es el portero. */
    puesto: number;
    dorsal: string;
    nombre: string;
    foto: string;
  }[];
};

export type Entrenador = {
  nombre: string;
  foto: string;
  /** "56 años" ya viene formateado; aquí sólo el número. */
  edad: string;
  partidos: number;
  ganados: number;
  empatados: number;
  perdidos: number;
};

export type Estadio = {
  nombre: string;
  ciudad: string;
  direccion: string;
  /** "1957". */
  construccion: string;
  /** "3000". */
  capacidad: string;
  /** "103 x 65". */
  tamano: string;
  foto: string;
};

export type Goleador = {
  nombre: string;
  foto: string;
  goles: number;
};

/* ------------------------------------------------------------------ */
/*  EL INFORME DE UN EQUIPO                                            */
/* ------------------------------------------------------------------ */

export type InformeEquipo = {
  /** `ID_EQUIPO` de la hoja ("RIV-01"). */
  id: string;
  /** Nombre tal y como lo escribe la hoja ("Teruel"). */
  nombre: string;
  /** Nombre de BeSoccer ("CD Teruel"): es el que sale en los marcadores. */
  nombreLargo: string;
  slug: string;
  escudo: string;
  entrenador: Entrenador | null;
  estadio: Estadio | null;
  clasificacion: Clasificacion;
  /** La temporada entera, de la primera jornada a la última. */
  partidos: Partido[];
  goleadores: Goleador[];
  /**
   * Las estructuras que ha sacado, de la más repetida a la menos.
   *
   * Sale de contar las alineaciones, así que **sólo cuenta los partidos de los
   * que se ha bajado la ficha** (`ONCES_POR_EQUIPO`). Es lo que se quiere: la
   * estructura de octubre no dice nada de cómo sale ahora.
   */
  estructuras: { estructura: string; veces: number }[];
  /** De la más reciente a la más antigua. */
  onces: OncePartido[];
};

export type InformeDoc = {
  /** ISO de la última descarga. */
  actualizado: string;
  fuente: "besoccer";
  /** "2026/27". */
  temporada: string;
  /** Cómo se llama la competición en BeSoccer, para el pie de las tablas. */
  competicion: string;
  /** Por `ID_EQUIPO`. */
  porId: Record<string, InformeEquipo>;
};

/** Clave del documento en `app_documents`. */
export const INFORME_KEY = "rivals:informe";

export const INFORME_KIND = "rivals";

/* ------------------------------------------------------------------ */
/*  BUSCAR UN EQUIPO                                                   */
/* ------------------------------------------------------------------ */

/**
 * El informe de un equipo, por `ID_EQUIPO` o por nombre.
 *
 * Por nombre además del id porque la pantalla de plantillas trabaja con el
 * nombre del equipo —es lo que elige el selector— y los `ID_EQUIPO` de la hoja
 * se renumeran (nota "ids-jugador-renumerados"). Se prueba el id primero, que
 * es exacto, y si no se compara el nombre normalizado contra los dos que
 * guarda el documento: el de la hoja ("Teruel") y el de BeSoccer ("CD
 * Teruel"), que no siempre coinciden.
 */
export function findInforme(
  doc: InformeDoc | null,
  equipo: { ID_EQUIPO?: unknown; NOMBRE_EQUIPO?: unknown } | string | null,
): InformeEquipo | null {
  if (!doc?.porId) return null;

  const id =
    typeof equipo === "string" ? "" : String(equipo?.ID_EQUIPO ?? "").trim();

  if (id && doc.porId[id]) return doc.porId[id];

  const nombre = normalizeKey(
    typeof equipo === "string" ? equipo : equipo?.NOMBRE_EQUIPO,
  );

  if (!nombre) return null;

  const equipos = Object.values(doc.porId);

  return (
    equipos.find(
      (informe) =>
        normalizeKey(informe.nombre) === nombre ||
        normalizeKey(informe.nombreLargo) === nombre,
    ) ??
    /* "Atlético Madrid B" en la hoja contra "At. Madrid B" en BeSoccer: si no
       hay coincidencia exacta se acepta que uno contenga al otro, que resuelve
       las abreviaturas sin llegar a confundir dos clubes del grupo. */
    equipos.find((informe) => {
      const largo = normalizeKey(informe.nombreLargo);
      const corto = normalizeKey(informe.nombre);

      return (
        (largo && (largo.includes(nombre) || nombre.includes(largo))) ||
        (corto && (corto.includes(nombre) || nombre.includes(corto)))
      );
    }) ??
    null
  );
}

/* ------------------------------------------------------------------ */
/*  LECTURAS QUE HACEN FALTA EN VARIOS SITIOS                          */
/* ------------------------------------------------------------------ */

/** La fila del propio equipo dentro de una de las tres clasificaciones. */
export function filaPropia(
  filas: FilaClasificacion[],
  informe: InformeEquipo,
): FilaClasificacion | null {
  return (
    filas.find((fila) => fila.slug === informe.slug) ??
    filas.find(
      (fila) => normalizeKey(fila.equipo) === normalizeKey(informe.nombreLargo),
    ) ??
    null
  );
}

/**
 * Los partidos ya jugados, del más reciente al más antiguo.
 *
 * `sort` sobre una copia: `partidos` es del documento y lo comparten todas las
 * diapositivas, que lo recorren en el orden del calendario.
 */
export function jugados(informe: InformeEquipo) {
  return informe.partidos
    .filter((partido) => partido.jugado)
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** El marcador de un partido, tal y como se titula una diapositiva. */
export function marcador(partido: Partido) {
  const goles = partido.jugado
    ? `${partido.local.goles ?? 0}-${partido.visitante.goles ?? 0}`
    : "vs";

  return `${partido.local.nombre} ${goles} ${partido.visitante.nombre}`;
}

/**
 * Goles a favor y en contra, contando sólo lo que pide el informe.
 *
 * `liga` deja fuera los amistosos, que es lo que se mira a partir de la
 * primera jornada; con `false` entra la pretemporada entera, que es la única
 * referencia que hay antes de que empiece.
 */
export function balance(informe: InformeEquipo, soloLiga: boolean) {
  let favor = 0;
  let contra = 0;
  let ganados = 0;
  let empatados = 0;
  let perdidos = 0;
  let partidos = 0;

  for (const partido of informe.partidos) {
    if (!partido.jugado) continue;
    if (soloLiga && !esLiga(partido)) continue;

    const propios = partido.enCasa
      ? partido.local.goles
      : partido.visitante.goles;

    const ajenos = partido.enCasa
      ? partido.visitante.goles
      : partido.local.goles;

    favor += propios ?? 0;
    contra += ajenos ?? 0;
    partidos += 1;

    if (partido.resultado === "G") ganados += 1;
    else if (partido.resultado === "E") empatados += 1;
    else if (partido.resultado === "P") perdidos += 1;
  }

  return { favor, contra, ganados, empatados, perdidos, partidos };
}

/**
 * Si un partido es de competición oficial.
 *
 * BeSoccer titula los amistosos "Partidos Amistosos"; todo lo demás —liga,
 * copa, play-off— cuenta. Se mira por el nombre y no por un id de competición
 * porque el mismo equipo juega amistosos contra clubes de otras categorías y
 * BeSoccer no les da competición propia.
 */
export function esLiga(partido: Partido) {
  return !/amistos/i.test(partido.competicion);
}
