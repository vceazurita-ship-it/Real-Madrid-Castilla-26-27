/**
 * CODING DE PARTIDO · el modelo.
 *
 * Codificar un partido es ver noventa minutos marcando el principio y el final
 * de cada acción de cada jugador. Lo que hace que sea utilizable no es la
 * pantalla: es que **el tiempo se guarde con precisión de milisegundo** y que
 * el analista no tenga que soltar el teclado. Todo lo demás —las listas, los
 * filtros, la exportación— se deriva de eso.
 *
 * Dos decisiones que explican el resto del módulo:
 *
 * **Lo que se marca y lo que se corta son dos cosas distintas.** El analista
 * marca el instante exacto de la acción (`codingInicioMs` / `codingFinMs`) y
 * el clip que se exporta lleva además un margen delante y detrás
 * (`inicioMs` / `finMs`). Se guardan los cuatro números: así se puede cambiar
 * el margen mucho después sin haber perdido el momento real, que es el dato
 * que costó noventa minutos de trabajo.
 *
 * **La sesión es un documento, no una tabla.** Vive en `app_documents` como
 * las pizarras y el repositorio de cultura, con una clave por partido o por
 * rival. Un partido codificado son unos cientos de clips: caben de sobra en un
 * documento, se leen de un viaje y se guardan enteros, que es justo lo que
 * quiere un autoguardado que no puede perder nada.
 *
 * **Un clip es de alguien o del equipo.** El sujeto puede ser un jugador o un
 * comportamiento colectivo —la salida de balón, el repliegue—, y los dos se
 * guardan en los mismos campos porque para las listas, los filtros y las
 * carpetas del ZIP un sujeto es un sujeto. Vale igual para los nuestros y para
 * el rival: lo único que cambia entre los dos ámbitos es de dónde sale la
 * plantilla.
 */

import { normalizaEscenas, type EscenaTel } from "@/lib/coding/telestracion";

export type AmbitoCoding = "partido" | "rival";

/**
 * De dónde sale el vídeo.
 *
 * Los partidos pesan gigas, así que hay dos caminos y ninguno pasa por subir
 * el fichero entero desde el navegador:
 *
 * - `url`: el vídeo ya está en algún sitio con dirección propia —el bucket de
 *   Supabase, un enlace directo—. Es el único que funciona en el servidor
 *   desplegado.
 * - `archivo`: el vídeo está en la carpeta de partidos de la máquina donde
 *   corre la app. Se sirve por trozos y se corta ahí mismo, sin copiarlo.
 * - `local`: un fichero abierto desde el ordenador del analista. Vale para
 *   codificar —el navegador lo reproduce sin subir nada—, pero el servidor no
 *   puede verlo, así que **no se puede exportar** hasta llevarlo a la carpeta
 *   de partidos. Al recargar la página hay que volver a elegirlo: un navegador
 *   no puede guardar el permiso sobre un fichero del disco.
 */
export type FuenteVideo =
  | { tipo: "url"; url: string; nombre: string }
  | { tipo: "archivo"; ruta: string; nombre: string }
  | { tipo: "local"; nombre: string };

export type CategoriaCoding = {
  id: string;
  nombre: string;
  /** Color de la marca en la línea de tiempo. */
  color: string;
  /** Tecla que la selecciona. Vacío = sin tecla. */
  tecla: string;
};

/**
 * Un comportamiento colectivo: lo que hace el equipo, no un jugador.
 *
 * La salida de balón, la presión tras pérdida o el repliegue no son de nadie
 * en concreto, y hasta ahora no había forma de codificarlas: el clip exigía un
 * jugador. Son el **sujeto** del clip igual que lo es un jugador —lo que la
 * acción trata—, mientras que la categoría sigue siendo el tipo de acción.
 *
 * Sirven en los dos ámbitos sin cambiar nada: el mismo repliegue se codifica
 * del Castilla para corregirlo y del rival para atacarlo.
 *
 * **Su tecla se pulsa con mayúscula** (⇧ + la letra). No es un capricho: entre
 * jugadores, categorías y las teclas del reproductor no queda una sola letra
 * libre, y el turno de mayúsculas da un teclado entero sin quitarle ninguna a
 * nadie. Además se lee solo: minúscula = alguien, mayúscula = el equipo.
 */
export type ComportamientoColectivo = {
  id: string;
  nombre: string;
  color: string;
  /** La letra; se selecciona con ⇧ delante. Vacío = sin tecla. */
  tecla: string;
};

/**
 * De qué va el clip: de un jugador o de un comportamiento del equipo.
 *
 * Los dos se guardan en los mismos campos (`jugadorId` / `jugadorNombre`),
 * porque para todo lo que viene después —listas, filtros, resúmenes, carpetas
 * del ZIP— un sujeto es un sujeto. Lo único que cambia es de dónde sale el
 * nombre y cómo se agrupa al enseñarlo.
 */
export type TipoSujeto = "jugador" | "colectivo";

/** Lo elegido en la pantalla ahora mismo, sea quien sea. */
export type SujetoCoding = {
  tipo: TipoSujeto;
  id: string;
  nombre: string;
  dorsal?: number;
};

export type ClipCoding = {
  id: string;
  /** Orden de creación: es el número con el que se nombra el fichero. */
  numero: number;
  /**
   * De quién es el clip: de un jugador o del equipo.
   *
   * Falta en los clips guardados antes de que existieran los comportamientos
   * colectivos, y por eso se lee como `jugador` cuando no está: todo lo que ya
   * había codificado era de un jugador.
   */
  sujeto?: TipoSujeto;
  /** El jugador, o el comportamiento colectivo cuando `sujeto` es colectivo. */
  jugadorId: string;
  /** Copiado al crear el clip: el nombre tiene que sobrevivir a la hoja. */
  jugadorNombre: string;
  jugadorDorsal?: number;
  categoriaId: string;
  /** Lo que se exporta, ya con los márgenes puestos. */
  inicioMs: number;
  finMs: number;
  /** El instante exacto que marcó el analista, sin márgenes. */
  codingInicioMs: number;
  codingFinMs: number;
  preRollMs: number;
  postRollMs: number;
  nota: string;
  tags: string[];
  /** `revisar` lo marca el analista cuando quiere volver sobre el clip. */
  estado: "ok" | "revisar";
  creadoEn: string;
};

export type SesionCoding = {
  ambito: AmbitoCoding;
  /** Identificador del partido, o del rival cuando se analiza a un rival. */
  refId: string;
  titulo: string;
  fuente: FuenteVideo | null;
  /** Fotogramas por segundo, para que las flechas avancen un fotograma justo. */
  fps: number;
  preRollMs: number;
  postRollMs: number;
  clips: ClipCoding[];
  /**
   * Las pizarras pintadas sobre el vídeo (`lib/coding/telestracion`).
   *
   * Viven en la sesión y no en el clip porque una pizarra es de un **instante
   * del partido**, no de un corte: la misma flecha vale para el clip del
   * lateral y para el del extremo si los dos pasan por ahí, y borrar un clip
   * no puede llevarse por delante el análisis dibujado encima.
   */
  escenas: EscenaTel[];
  /**
   * Una sesión queda `abierta` mientras se codifica y se cierra a mano.
   * Es lo que permite avisar de que se dejó a medias al volver a entrar.
   */
  abierta: boolean;
  actualizadoEn: string;
};

export type ConfigCoding = {
  categorias: CategoriaCoding[];
  /** Los comportamientos de equipo, con su tecla de mayúscula. */
  comportamientos: ComportamientoColectivo[];
  /** `idJugador` → tecla. Se comparte entre partidos. */
  teclasJugador: Record<string, string>;
  preRollMs: number;
  postRollMs: number;
  fps: number;
};

/* ------------------------------------------------------------------ */
/*  VALORES DE PARTIDA                                                 */
/* ------------------------------------------------------------------ */

/**
 * Las categorías con las que se arranca.
 *
 * Son las que pidió el cuerpo técnico, con su tecla en la fila de casa
 * (`q`…`p`, `a`…) para que la mano no se mueva del sitio. Se pueden cambiar
 * enteras desde la configuración: esto es sólo el punto de partida.
 */
export const CATEGORIAS_INICIALES: CategoriaCoding[] = [
  { id: "ataque", nombre: "Ataque", color: "#F87171", tecla: "q" },
  { id: "defensa", nombre: "Defensa", color: "#60A5FA", tecla: "w" },
  { id: "pase", nombre: "Pase", color: "#34D399", tecla: "e" },
  { id: "control", nombre: "Control", color: "#A78BFA", tecla: "r" },
  { id: "conduccion", nombre: "Conducción", color: "#FBBF24", tecla: "t" },
  { id: "duelo", nombre: "Duelo", color: "#FB7185", tecla: "y" },
  { id: "recuperacion", nombre: "Recuperación", color: "#22D3EE", tecla: "u" },
  { id: "perdida", nombre: "Pérdida", color: "#F97316", tecla: "g" },
  { id: "remate", nombre: "Remate", color: "#C8A96B", tecla: "h" },
  { id: "centro", nombre: "Centro", color: "#818CF8", tecla: "p" },
  { id: "desmarque", nombre: "Desmarque", color: "#4ADE80", tecla: "a" },
  { id: "abp-of", nombre: "ABP OF", color: "#F472B6", tecla: "s" },
  { id: "abp-def", nombre: "ABP DEF", color: "#94A3B8", tecla: "d" },
  { id: "otros", nombre: "Otros", color: "#CBD5E1", tecla: "f" },
];

/**
 * Los comportamientos colectivos con los que se arranca.
 *
 * Son las fases del juego tal y como las nombra el cuerpo técnico, en el orden
 * en que ocurren: con balón, sin balón, las dos transiciones y el balón
 * parado. Se pueden cambiar enteras desde la configuración.
 *
 * Sirven igual para los nuestros y para el rival —la salida de balón se
 * codifica para corregir la propia o para atacar la suya—, así que la lista es
 * una sola y no cambia con el ámbito.
 */
export const COMPORTAMIENTOS_INICIALES: ComportamientoColectivo[] = [
  { id: "salida", nombre: "Salida de balón", color: "#34D399", tecla: "q" },
  { id: "progresion", nombre: "Progresión", color: "#4ADE80", tecla: "w" },
  { id: "finalizacion", nombre: "Finalización", color: "#C8A96B", tecla: "e" },
  { id: "presion-alta", nombre: "Presión alta", color: "#F87171", tecla: "a" },
  { id: "bloque-medio", nombre: "Bloque medio", color: "#60A5FA", tecla: "s" },
  { id: "repliegue", nombre: "Repliegue", color: "#818CF8", tecla: "d" },
  {
    id: "transicion-of",
    nombre: "Transición ofensiva",
    color: "#FBBF24",
    tecla: "z",
  },
  {
    id: "transicion-def",
    nombre: "Transición defensiva",
    color: "#FB7185",
    tecla: "x",
  },
  { id: "abp-of-col", nombre: "ABP ofensivo", color: "#F472B6", tecla: "c" },
  { id: "abp-def-col", nombre: "ABP defensivo", color: "#94A3B8", tecla: "v" },
];

/** Teclas que se reparten solas entre los jugadores de la convocatoria. */
export const TECLAS_JUGADOR_POR_DEFECTO = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
  "z",
  "x",
  "c",
  "v",
  "b",
  "n",
  "m",
];

export const CONFIG_POR_DEFECTO: ConfigCoding = {
  categorias: CATEGORIAS_INICIALES,
  comportamientos: COMPORTAMIENTOS_INICIALES,
  teclasJugador: {},
  preRollMs: 2000,
  postRollMs: 2000,
  fps: 25,
};

export const CLAVE_CONFIG_CODING = "coding:config";

export const TIPO_CODING = "coding";

/** La clave del documento de una sesión en `app_documents`. */
export function claveSesion(ambito: AmbitoCoding, refId: string) {
  return `coding:${ambito}:${apodoCoding(refId)}`;
}

/** Limpia un identificador para que pase el patrón de `/api/docs`. */
export function apodoCoding(valor: unknown) {
  const limpio = String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return limpio || "sin-id";
}

export function sesionVacia(
  ambito: AmbitoCoding,
  refId: string,
  titulo: string,
  config: ConfigCoding,
): SesionCoding {
  return {
    ambito,
    refId,
    titulo,
    fuente: null,
    fps: config.fps,
    preRollMs: config.preRollMs,
    postRollMs: config.postRollMs,
    clips: [],
    escenas: [],
    abierta: false,
    actualizadoEn: "",
  };
}

/* ------------------------------------------------------------------ */
/*  TIEMPO                                                             */
/* ------------------------------------------------------------------ */

/** 2234250 → "37:14.250". Con horas cuando el vídeo pasa de los 60 min. */
export function formateaMs(ms: number) {
  const seguro = Math.max(0, Math.round(ms));

  const milis = seguro % 1000;
  const totalSegundos = Math.floor(seguro / 1000);
  const segundos = totalSegundos % 60;
  const totalMinutos = Math.floor(totalSegundos / 60);
  const minutos = totalMinutos % 60;
  const horas = Math.floor(totalMinutos / 60);

  const dos = (valor: number) => String(valor).padStart(2, "0");

  const cuerpo = `${dos(minutos)}:${dos(segundos)}.${String(milis).padStart(3, "0")}`;

  return horas > 0 ? `${horas}:${cuerpo}` : cuerpo;
}

/** 7580 → "7.58s": la duración como se lee en la lista de clips. */
export function formateaDuracion(ms: number) {
  return `${(Math.max(0, ms) / 1000).toFixed(2)}s`;
}

/** "04:12" — el tiempo total codificado, sin milésimas. */
export function formateaTotal(ms: number) {
  const totalSegundos = Math.round(Math.max(0, ms) / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;

  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

/** Segundos con tres decimales, que es como los quiere ffmpeg. */
export function segundosFfmpeg(ms: number) {
  return (Math.max(0, ms) / 1000).toFixed(3);
}

/** La duración de un fotograma en milisegundos. */
export function msPorFotograma(fps: number) {
  return 1000 / (fps > 0 ? fps : 25);
}

export function duracionClip(clip: ClipCoding) {
  return Math.max(0, clip.finMs - clip.inicioMs);
}

export function duracionCoding(clip: ClipCoding) {
  return Math.max(0, clip.codingFinMs - clip.codingInicioMs);
}

/* ------------------------------------------------------------------ */
/*  CREAR Y VALIDAR                                                    */
/* ------------------------------------------------------------------ */

export type BorradorClip = {
  /** `jugador` si no se dice otra cosa: es lo que se codifica casi siempre. */
  sujeto?: TipoSujeto;
  jugadorId: string;
  jugadorNombre: string;
  jugadorDorsal?: number;
  categoriaId: string;
  codingInicioMs: number;
  codingFinMs: number;
  preRollMs: number;
  postRollMs: number;
  /** Duración del vídeo, para no salirse por los extremos. */
  duracionVideoMs?: number;
};

/**
 * Por qué no se puede crear este clip, o `null` si se puede.
 *
 * Devuelve el motivo escrito porque es lo que se le enseña al analista: en
 * mitad de un partido, «el final va antes del principio» sirve y un icono
 * rojo, no.
 */
export function problemaDeClip(borrador: BorradorClip): string | null {
  if (!borrador.jugadorId) {
    return "Elige antes un jugador o un comportamiento colectivo.";
  }

  if (borrador.codingInicioMs < 0 || borrador.codingFinMs < 0) {
    return "El tiempo no puede ser negativo.";
  }

  if (borrador.codingFinMs <= borrador.codingInicioMs) {
    return "El final tiene que ir después del inicio.";
  }

  return null;
}

/**
 * El clip completo a partir de lo marcado.
 *
 * Los márgenes se recortan contra los extremos del vídeo: un IN a los 0,5 s
 * con dos segundos de margen no puede empezar en negativo.
 */
export function creaClip(
  borrador: BorradorClip,
  numero: number,
  ahora: string,
): ClipCoding {
  const tope = borrador.duracionVideoMs;

  const inicioMs = Math.max(0, borrador.codingInicioMs - borrador.preRollMs);

  const finBruto = borrador.codingFinMs + borrador.postRollMs;

  const finMs =
    tope !== undefined && tope > 0 ? Math.min(finBruto, tope) : finBruto;

  return {
    id: `clip-${numero}-${Math.round(borrador.codingInicioMs)}`,
    numero,
    sujeto: borrador.sujeto === "colectivo" ? "colectivo" : "jugador",
    jugadorId: borrador.jugadorId,
    jugadorNombre: borrador.jugadorNombre,
    jugadorDorsal: borrador.jugadorDorsal,
    categoriaId: borrador.categoriaId,
    inicioMs,
    finMs,
    codingInicioMs: borrador.codingInicioMs,
    codingFinMs: borrador.codingFinMs,
    preRollMs: borrador.preRollMs,
    postRollMs: borrador.postRollMs,
    nota: "",
    tags: [],
    estado: "ok",
    creadoEn: ahora,
  };
}

/**
 * Recalcula los extremos exportables de un clip ya creado.
 *
 * Se usa al mover el IN, el OUT o los márgenes desde la ficha del clip: el
 * momento codificado manda y el corte se deriva de él, nunca al revés.
 */
export function recalculaClip(
  clip: ClipCoding,
  cambios: Partial<
    Pick<
      ClipCoding,
      "codingInicioMs" | "codingFinMs" | "preRollMs" | "postRollMs"
    >
  >,
  duracionVideoMs?: number,
): ClipCoding {
  const siguiente = { ...clip, ...cambios };

  const inicioMs = Math.max(
    0,
    siguiente.codingInicioMs - siguiente.preRollMs,
  );

  const finBruto = siguiente.codingFinMs + siguiente.postRollMs;

  const finMs =
    duracionVideoMs !== undefined && duracionVideoMs > 0
      ? Math.min(finBruto, duracionVideoMs)
      : finBruto;

  return { ...siguiente, inicioMs, finMs };
}

/* ------------------------------------------------------------------ */
/*  NOMBRES DE FICHERO                                                 */
/* ------------------------------------------------------------------ */

/** "001_PASE" — el nombre del clip dentro de la carpeta del jugador. */
export function nombreDeClip(clip: ClipCoding, categorias: CategoriaCoding[]) {
  const categoria = categorias.find((una) => una.id === clip.categoriaId);

  const trozos = [String(clip.numero).padStart(3, "0")];

  if (categoria) trozos.push(apodoCoding(categoria.nombre).toUpperCase());

  return trozos.join("_");
}

/**
 * "PARTIDO/SERGIO MESTRE/001_PASE.mp4" — la ruta dentro del ZIP.
 *
 * Lo colectivo va en su propia rama —`COLECTIVO/Presión alta/…`— y no suelto
 * entre los jugadores: quien abre el ZIP busca una cosa o la otra, no las dos
 * mezcladas, y un comportamiento con nombre de carpeta al lado de los nombres
 * de la plantilla se lee como si fuera un futbolista más.
 */
export function rutaDeClip(
  clip: ClipCoding,
  categorias: CategoriaCoding[],
  carpeta: string,
) {
  const fichero = `${nombreDeClip(clip, categorias)}.mp4`;

  if (clip.sujeto === "colectivo") {
    const comportamiento = clip.jugadorNombre.trim() || "sin-comportamiento";

    return `${carpeta}/COLECTIVO/${comportamiento}/${fichero}`;
  }

  const jugador = clip.jugadorNombre.trim() || "sin-jugador";

  return `${carpeta}/${jugador}/${fichero}`;
}

/* ------------------------------------------------------------------ */
/*  ESTADÍSTICAS                                                       */
/* ------------------------------------------------------------------ */

export type ResumenCoding = {
  clave: string;
  etiqueta: string;
  clips: number;
  totalMs: number;
  mediaMs: number;
};

function resume(
  clips: ClipCoding[],
  clave: (clip: ClipCoding) => { clave: string; etiqueta: string },
): ResumenCoding[] {
  const mapa = new Map<string, ResumenCoding>();

  for (const clip of clips) {
    const { clave: id, etiqueta } = clave(clip);

    const actual = mapa.get(id) ?? {
      clave: id,
      etiqueta,
      clips: 0,
      totalMs: 0,
      mediaMs: 0,
    };

    actual.clips += 1;
    actual.totalMs += duracionClip(clip);

    mapa.set(id, actual);
  }

  return [...mapa.values()]
    .map((fila) => ({
      ...fila,
      mediaMs: fila.clips > 0 ? Math.round(fila.totalMs / fila.clips) : 0,
    }))
    .sort((a, b) => b.clips - a.clips);
}

/** Lo que ha hecho cada jugador. Lo colectivo tiene su propia tabla. */
export function porJugador(clips: ClipCoding[]) {
  return resume(
    clips.filter((clip) => clip.sujeto !== "colectivo"),
    (clip) => ({ clave: clip.jugadorId, etiqueta: clip.jugadorNombre }),
  );
}

/**
 * Lo mismo para los comportamientos de equipo.
 *
 * Van aparte y no mezclados con los jugadores porque son otra pregunta: «cuánto
 * hemos trabajado a Mestre» y «cuántas salidas de balón llevamos» no se leen en
 * la misma lista, y sumadas se estorban —el equipo saldría siempre arriba.
 */
export function porColectivo(clips: ClipCoding[]) {
  return resume(
    clips.filter((clip) => clip.sujeto === "colectivo"),
    (clip) => ({ clave: clip.jugadorId, etiqueta: clip.jugadorNombre }),
  );
}

export function porCategoria(
  clips: ClipCoding[],
  categorias: CategoriaCoding[],
) {
  return resume(clips, (clip) => ({
    clave: clip.categoriaId || "sin-categoria",
    etiqueta:
      categorias.find((una) => una.id === clip.categoriaId)?.nombre ??
      "Sin categoría",
  }));
}

export function totalCodificadoMs(clips: ClipCoding[]) {
  return clips.reduce((total, clip) => total + duracionClip(clip), 0);
}

/* ------------------------------------------------------------------ */
/*  NORMALIZAR LO GUARDADO                                             */
/* ------------------------------------------------------------------ */

/**
 * Deja una sesión leída del almacén con todos sus campos.
 *
 * Los documentos guardados sobreviven a los cambios de este fichero, así que
 * lo que falte se rellena aquí en vez de romper la pantalla. Un campo nuevo
 * que no se añada a esta función **no llega nunca** a la aplicación.
 */
export function normalizaSesion(
  crudo: unknown,
  ambito: AmbitoCoding,
  refId: string,
  titulo: string,
  config: ConfigCoding,
): SesionCoding {
  const base = sesionVacia(ambito, refId, titulo, config);

  if (!crudo || typeof crudo !== "object") return base;

  const dato = crudo as Partial<SesionCoding>;

  const clips = Array.isArray(dato.clips) ? dato.clips : [];

  return {
    ...base,
    ...dato,
    ambito,
    refId,
    titulo: dato.titulo || titulo,
    fuente: dato.fuente ?? null,
    fps: typeof dato.fps === "number" && dato.fps > 0 ? dato.fps : base.fps,
    preRollMs:
      typeof dato.preRollMs === "number" ? dato.preRollMs : base.preRollMs,
    postRollMs:
      typeof dato.postRollMs === "number" ? dato.postRollMs : base.postRollMs,
    escenas: normalizaEscenas(dato.escenas),
    abierta: dato.abierta === true,
    clips: clips.map((clip, indice) => ({
      ...clip,
      numero: typeof clip?.numero === "number" ? clip.numero : indice + 1,
      /* Lo que se codificó antes de que esto existiera era de un jugador. */
      sujeto: clip?.sujeto === "colectivo" ? "colectivo" : "jugador",
      jugadorNombre: clip?.jugadorNombre ?? "",
      jugadorId: clip?.jugadorId ?? "",
      categoriaId: clip?.categoriaId ?? "",
      nota: clip?.nota ?? "",
      estado: clip?.estado === "revisar" ? "revisar" : "ok",
      tags: Array.isArray(clip?.tags) ? clip.tags : [],
    })),
  };
}

/** Lo mismo para la configuración: una categoría nueva no puede tumbar nada. */
export function normalizaConfig(crudo: unknown): ConfigCoding {
  if (!crudo || typeof crudo !== "object") return CONFIG_POR_DEFECTO;

  const dato = crudo as Partial<ConfigCoding>;

  const categorias = Array.isArray(dato.categorias) && dato.categorias.length
    ? dato.categorias.map((categoria) => ({
        id: categoria?.id ?? apodoCoding(categoria?.nombre),
        nombre: categoria?.nombre ?? "Sin nombre",
        color: categoria?.color ?? "#CBD5E1",
        tecla: categoria?.tecla ?? "",
      }))
    : CATEGORIAS_INICIALES;

  /*
  | Ojo con el «tenía algo guardado»: una configuración anterior a los
  | comportamientos colectivos no trae la lista, y sin este relleno el panel
  | saldría vacío para siempre —la configuración se guarda entera, así que el
  | hueco se volvería a escribir en cuanto alguien tocara cualquier otra cosa.
  */
  const comportamientos =
    Array.isArray(dato.comportamientos) && dato.comportamientos.length
      ? dato.comportamientos.map((uno) => ({
          id: uno?.id ?? apodoCoding(uno?.nombre),
          nombre: uno?.nombre ?? "Sin nombre",
          color: uno?.color ?? "#CBD5E1",
          tecla: uno?.tecla ?? "",
        }))
      : COMPORTAMIENTOS_INICIALES;

  return {
    categorias,
    comportamientos,
    teclasJugador:
      dato.teclasJugador && typeof dato.teclasJugador === "object"
        ? dato.teclasJugador
        : {},
    preRollMs:
      typeof dato.preRollMs === "number"
        ? dato.preRollMs
        : CONFIG_POR_DEFECTO.preRollMs,
    postRollMs:
      typeof dato.postRollMs === "number"
        ? dato.postRollMs
        : CONFIG_POR_DEFECTO.postRollMs,
    fps: typeof dato.fps === "number" && dato.fps > 0 ? dato.fps : 25,
  };
}

/**
 * Reparte las teclas libres entre los jugadores que no tengan una.
 *
 * Se hace con la convocatoria delante y no al configurar: quien entra en la
 * lista tiene tecla desde el primer momento, sin pasar por los ajustes.
 */
export function reparteTeclas(
  jugadores: { id: string }[],
  teclas: Record<string, string>,
): Record<string, string> {
  const usadas = new Set(Object.values(teclas).filter(Boolean));

  const resultado = { ...teclas };

  for (const jugador of jugadores) {
    if (resultado[jugador.id]) continue;

    const libre = TECLAS_JUGADOR_POR_DEFECTO.find((tecla) => !usadas.has(tecla));

    if (!libre) break;

    resultado[jugador.id] = libre;
    usadas.add(libre);
  }

  return resultado;
}

/** Las teclas repetidas, para poder avisar en la configuración. */
export function teclasRepetidas(config: ConfigCoding): string[] {
  const cuenta = new Map<string, number>();

  const suma = (tecla: string) => {
    if (!tecla) return;

    cuenta.set(tecla, (cuenta.get(tecla) ?? 0) + 1);
  };

  Object.values(config.teclasJugador).forEach(suma);
  config.categorias.forEach((categoria) => suma(categoria.tecla));

  /*
  | Los comportamientos se cuentan aparte porque viven en otro teclado: se
  | pulsan con ⇧ delante, así que la `q` de una categoría y la `q` de un
  | comportamiento no se pisan. Sólo chocan entre ellos.
  */
  const conShift = new Map<string, number>();

  config.comportamientos.forEach((uno) => {
    if (!uno.tecla) return;

    conShift.set(uno.tecla, (conShift.get(uno.tecla) ?? 0) + 1);
  });

  return [
    ...[...cuenta.entries()]
      .filter(([, veces]) => veces > 1)
      .map(([tecla]) => tecla),
    ...[...conShift.entries()]
      .filter(([, veces]) => veces > 1)
      .map(([tecla]) => `⇧${tecla}`),
  ];
}

/**
 * Teclas que el reproductor se reserva.
 *
 * Si una de éstas se asigna a un jugador, el coding deja de funcionar: se
 * comprueba al configurar, no al pulsarla en mitad de un partido.
 */
export const TECLAS_RESERVADAS = ["i", "o", "j", "k", "l", " ", "escape"];

/* ------------------------------------------------------------------ */
/*  JUGADORES                                                          */
/* ------------------------------------------------------------------ */

/**
 * Un jugador tal y como lo necesita el coding.
 *
 * Es el mínimo común entre la plantilla propia (`types/player`, con foto y
 * dorsal numérico) y una plantilla rival (`lib/tactics/rivals`, con el dorsal
 * como texto y sin foto). El módulo no conoce ninguna de las dos: cada
 * pantalla trae su lista ya traducida a esto, y así el mismo panel de teclas
 * sirve para analizar a los nuestros y a los del rival.
 */
export type JugadorCoding = {
  id: string;
  nombre: string;
  dorsal?: number;
  foto?: string;
  posicion?: string;
};
