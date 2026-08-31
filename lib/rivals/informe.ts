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

/** Portero, defensa, medio o delantero, tal y como los agrupa BeSoccer. */
export type Demarcacion = "PT" | "DF" | "MC" | "DL" | "";

/** Uno del once inicial. */
export type JugadorOnce = {
  /** 1..11, el `pos<N>` de BeSoccer: 1 es el portero. */
  puesto: number;
  dorsal: string;
  nombre: string;
  foto: string;
  /** Para calcular con qué dibujo **acaba** el partido. */
  demarcacion?: Demarcacion;
  /** La nota de BeSoccer, "7.1". */
  nota?: string;
};

/** Uno del banquillo. */
export type SuplenteOnce = {
  dorsal: string;
  nombre: string;
  foto: string;
  demarcacion?: Demarcacion;
  nota?: string;
  /** Minuto en el que saltó al campo, o "" si se quedó sentado. */
  entra?: string;
};

export type CambioPartido = {
  /** "46", "90+2". Sin la comilla: la pone quien lo pinta. */
  minuto: string;
  sale: string;
  entra: string;
};

export type TarjetaPartido = {
  minuto: string;
  jugador: string;
  tipo: "amarilla" | "roja";
  /** "Falta", "Protestar"… lo que dice BeSoccer. */
  motivo: string;
};

/** Una alineación de las que se enseñan en las hojas de partidos. */
export type OncePartido = {
  /** El del `Partido` al que pertenece. */
  partidoId: string;
  /** "1-4-3-3", ya con el uno delante. */
  estructura: string;
  entrenador: string;
  jugadores: JugadorOnce[];
  /**
   * La convocatoria que se quedó en el banquillo, y quién entró.
   *
   * Falta en lo que se bajó antes de septiembre de 2026 y en los partidos de
   * los que BeSoccer ya no publica ficha: quien lo pinta enseña lo que haya.
   */
  suplentes?: SuplenteOnce[];
  cambios?: CambioPartido[];
  tarjetas?: TarjetaPartido[];
};

/** Una etapa del entrenador en un club, de su ficha de BeSoccer. */
export type EtapaEntrenador = {
  equipo: string;
  escudo: string;
  partidos: number;
  /** "01-07-2026". */
  desde: string;
  hasta: string;
  ganados: number;
  empatados: number;
  perdidos: number;
  /** La que más repitió allí: "4-4-2". */
  tactica: string;
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
  /** "14/07/1970". */
  nacimiento?: string;
  /** Su ficha en BeSoccer, de donde sale la trayectoria. */
  ficha?: string;
  /**
   * Por dónde ha pasado, de lo más reciente a lo más antiguo.
   *
   * La hoja del míster enseñaba otra vez el balance del equipo —que ya está
   * dos hojas antes—; lo que no se sabe de un rival nuevo es de dónde viene su
   * entrenador y con qué dibujo ha trabajado.
   */
  trayectoria?: EtapaEntrenador[];
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
  return cuenta(informe, soloLiga ? "liga" : "todo");
}

/**
 * Lo mismo, pero **sólo la pretemporada**.
 *
 * El informe enseña los dos balances uno debajo del otro desde que el cuerpo
 * técnico pidió que no se mezclaran: cuatro amistosos de agosto contra equipos
 * de otra categoría no dicen lo mismo que cuatro jornadas de liga, y sumados
 * en una sola fila de cifras no había manera de saber cuál era cuál.
 */
export function balanceAmistosos(informe: InformeEquipo) {
  return cuenta(informe, "amistosos");
}

function cuenta(informe: InformeEquipo, que: "liga" | "amistosos" | "todo") {
  let favor = 0;
  let contra = 0;
  let ganados = 0;
  let empatados = 0;
  let perdidos = 0;
  let partidos = 0;

  for (const partido of informe.partidos) {
    if (!partido.jugado) continue;
    if (que === "liga" && !esLiga(partido)) continue;
    if (que === "amistosos" && esLiga(partido)) continue;

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

/* ------------------------------------------------------------------ */
/*  ONCES: QUIÉN ACABA EL PARTIDO Y CON QUÉ DIBUJO                     */
/* ------------------------------------------------------------------ */

/**
 * La estructura que se deduce de las demarcaciones de once jugadores.
 *
 * BeSoccer sólo publica **la de salida** (`data-tacticName`), y lo que el
 * cuerpo técnico quiere ver es también con qué acabó el partido: si entró un
 * delantero por un medio, el dibujo cambió. Aquí se cuentan defensas, medios y
 * delanteros, que es lo único que BeSoccer distingue.
 *
 * Es una lectura gruesa —un 1-4-2-3-1 sale como 1-4-5-1— y por eso se rotula
 * como lo que es: la estructura por demarcaciones. La de salida sigue siendo la
 * buena y va al lado.
 */
export function estructuraDeDemarcaciones(
  jugadores: { demarcacion?: Demarcacion }[],
) {
  const cuenta = { DF: 0, MC: 0, DL: 0 };

  let porteros = 0;

  for (const jugador of jugadores) {
    if (jugador.demarcacion === "PT") porteros += 1;
    else if (jugador.demarcacion && jugador.demarcacion in cuenta) {
      cuenta[jugador.demarcacion as "DF" | "MC" | "DL"] += 1;
    }
  }

  /* Sin demarcaciones —lo bajado antes de septiembre de 2026— no hay nada que
     deducir: mejor vacío que un "1-0-0-0" que parece un dato. */
  if (cuenta.DF + cuenta.MC + cuenta.DL === 0) return "";

  return `${porteros || 1}-${cuenta.DF}-${cuenta.MC}-${cuenta.DL}`;
}

/** Uno de los once que terminan el partido. */
export type JugadorFinal = JugadorOnce & {
  /** Minuto en el que entró, si no era titular. */
  entraEn?: string;
  /** A quién sustituyó. */
  porQuien?: string;
};

/**
 * El once que **acaba** el partido: el inicial con los cambios aplicados.
 *
 * El que entra hereda el puesto del que sale, que es lo que deja dibujar el
 * segundo campograma sin inventarse una posición: si el entrenador movió a la
 * gente después del cambio, eso no lo publica nadie.
 *
 * Los cambios se aplican en orden de minuto —un jugador que entra y luego sale
 * se sustituye a sí mismo correctamente—, y un cambio cuyo saliente no esté en
 * el campo se descarta en vez de colar a un duodécimo hombre.
 */
export function onceFinal(once: OncePartido): JugadorFinal[] {
  const enCampo: JugadorFinal[] = once.jugadores.map((jugador) => ({ ...jugador }));

  const suplentes = once.suplentes ?? [];

  const cambios = [...(once.cambios ?? [])].sort(
    (a, b) => minutoDe(a.minuto) - minutoDe(b.minuto),
  );

  for (const cambio of cambios) {
    const indice = enCampo.findIndex(
      (jugador) => mismoNombre(jugador.nombre, cambio.sale),
    );

    if (indice === -1) continue;

    const banquillo = suplentes.find((uno) => mismoNombre(uno.nombre, cambio.entra));

    enCampo[indice] = {
      puesto: enCampo[indice].puesto,
      dorsal: banquillo?.dorsal ?? "",
      nombre: cambio.entra,
      foto: banquillo?.foto ?? "",
      demarcacion: banquillo?.demarcacion ?? enCampo[indice].demarcacion,
      nota: banquillo?.nota ?? "",
      entraEn: cambio.minuto,
      porQuien: cambio.sale,
    };
  }

  return enCampo;
}

/** "90+2" es el minuto 92 a efectos de ordenar. */
function minutoDe(valor: string) {
  const partes = String(valor ?? "").split("+");

  return (Number(partes[0]) || 0) + (Number(partes[1]) || 0);
}

/**
 * Si dos nombres son el mismo.
 *
 * BeSoccer escribe al jugador igual en la alineación y en el evento, pero no
 * siempre con los mismos acentos ni con el mismo nombre de pila abreviado, así
 * que se comparan normalizados y se acepta que uno contenga al otro —"Diego
 * Gómez" contra "D. Gómez"—.
 */
function mismoNombre(uno: string, otro: string) {
  const a = normalizeKey(uno);
  const b = normalizeKey(otro);

  if (!a || !b) return false;

  return a === b || a.includes(b) || b.includes(a);
}

/* ------------------------------------------------------------------ */
/*  TIPOLOGÍA DE GOLES                                                 */
/* ------------------------------------------------------------------ */

/** Lo que se puede contar de los goles con lo que publica BeSoccer. */
export type TipologiaGoles = {
  total: number;
  penaltis: number;
  propia: number;
  /** Todo lo demás: en la tabla del club esto se reparte a mano. */
  jugada: number;
};

/**
 * Cuenta los goles a favor y en contra por lo que se sabe de cada uno.
 *
 * La tabla del `.pptx` original reparte cada gol en AT.ORG, TRANSICIÓN, ABP y
 * errores individuales; eso lo codifica el analista viendo el partido y no hay
 * dato que lo dé. Lo que sí se sabe es cuántos fueron de penalti y cuántos en
 * propia puerta, que son dos casillas de esa misma tabla.
 */
export function tipologiaGoles(partidos: Partido[]) {
  const vacia = (): TipologiaGoles => ({
    total: 0,
    penaltis: 0,
    propia: 0,
    jugada: 0,
  });

  const aFavor = vacia();
  const enContra = vacia();

  for (const partido of partidos) {
    for (const gol of partido.goles ?? []) {
      const casilla = gol.propio ? aFavor : enContra;

      casilla.total += 1;

      if (gol.tipo === "penalti") casilla.penaltis += 1;
      else if (gol.tipo === "propia") casilla.propia += 1;
      else casilla.jugada += 1;
    }
  }

  return { aFavor, enContra };
}

/**
 * Cómo se rotula la competición de un partido en una diapositiva.
 *
 | Un once de pretemporada y un once de liga no se leen igual: el de agosto
 | lleva a cuatro del filial y a los tres que estaban a prueba. Antes la hoja
 | de alineaciones sólo decía el marcador, y quien la miraba el viernes no
 | tenía forma de saber si aquel 1-4-4-2 era de un amistoso en Boadilla o de
 | la última jornada, así que ahora va escrito al lado del título.
 */
export function rotuloCompeticion(partido: Partido | null | undefined) {
  if (!partido) return "";

  if (!esLiga(partido)) return "PRETEMPORADA · AMISTOSO";

  return (partido.competicion || "COMPETICIÓN OFICIAL").toUpperCase();
}
