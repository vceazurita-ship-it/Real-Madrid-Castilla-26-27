/**
 * ANÁLISIS VISUAL DEL RIVAL: BALÓN PARADO Y ÁREA.
 *
 * Lo que antes se montaba a mano en un PowerPoint —medio campo, cruces donde
 * remata el rival, balones donde saca y las fichas de los que meten el balón—
 * se dibuja aquí, jornada a jornada, y sale igual a PDF, a PPT y al informe del
 * microciclo de ABP.
 *
 * Dos documentos por rival, y separados a propósito:
 *
 * - `rival-analisis:<equipo>` — las láminas y las notas. Lo edita la pantalla
 *   con `useRemoteDoc`.
 * - `rival-analisis-clips:<equipo>` — los vídeos y los PDF de la carpeta de la
 *   jornada. Lo escribe el ordenador del club (`scripts/rival-carpeta.mjs`).
 *   Si fuera el mismo documento, la importación y quien está dibujando se
 *   pisarían el trabajo.
 *
 * Las posiciones se guardan en METROS sobre el medio campo que se ve: `x` de
 * 0 a 68 desde la banda izquierda (mirando a la portería, que está arriba) e
 * `y` de 0 a 45 desde la línea de fondo. Así una lámina no depende del tamaño
 * al que se pinte.
 */

import { slugClave } from "@/lib/rivals/media";

export type Ambito = "abp" | "area";

export type SeccionId =
  | "corner-of"
  | "corner-def"
  | "falta-of"
  | "falta-def"
  | "centros-of"
  | "centros-def";

export type Seccion = {
  id: SeccionId;
  ambito: Ambito;
  titulo: string;
  /** Cómo lo hace el rival: atacando o defendiendo. */
  lado: "ataca" | "defiende";
  /** Título con el que nace una lámina nueva. */
  tituloLamina: string;
};

export const SECCIONES: Seccion[] = [
  { id: "corner-of", ambito: "abp", titulo: "Córner ofensivo", lado: "ataca", tituloLamina: "CÓRNER OFENSIVO" },
  { id: "corner-def", ambito: "abp", titulo: "Córner defensivo", lado: "defiende", tituloLamina: "CÓRNER DEFENSIVO" },
  { id: "falta-of", ambito: "abp", titulo: "Falta ofensiva", lado: "ataca", tituloLamina: "FALTA OFENSIVA" },
  { id: "falta-def", ambito: "abp", titulo: "Falta defensiva", lado: "defiende", tituloLamina: "FALTA DEFENSIVA" },
  { id: "centros-of", ambito: "area", titulo: "Centros laterales · cómo atacan", lado: "ataca", tituloLamina: "CENTROS LATERALES" },
  { id: "centros-def", ambito: "area", titulo: "Centros laterales · cómo defienden", lado: "defiende", tituloLamina: "DEFENSA DE CENTROS LATERALES" },
];

export const SECCION_POR_ID = new Map(SECCIONES.map((una) => [una.id, una]));

export const seccionesDe = (ambito: Ambito) =>
  SECCIONES.filter((una) => una.ambito === ambito);

/* ------------------------------------------------------------------ */
/*  LA LÁMINA                                                          */
/* ------------------------------------------------------------------ */

/** Ancho y fondo del medio campo que se dibuja, en metros. */
export const CAMPO_ANCHO = 68;
export const CAMPO_FONDO = 45;

export type ColorMarca = "rojo" | "amarillo" | "azul" | "blanco";

export const COLORES: Record<ColorMarca, string> = {
  rojo: "#E11D1D",
  amarillo: "#FFE600",
  azul: "#2F6FEB",
  blanco: "#FFFFFF",
};

/** Lo que se lee en la leyenda si nadie ha escrito otra cosa. */
export const LEYENDA_POR_DEFECTO: Partial<Record<ColorMarca, string>> = {
  rojo: "CERRADA",
  amarillo: "ABIERTA",
};

export type Punto = { x: number; y: number };

export type Marca =
  /** Dónde remata o dónde cae el balón. */
  | { id: string; tipo: "cruz"; x: number; y: number; color: ColorMarca }
  /** Desde dónde sale el balón. */
  | { id: string; tipo: "balon"; x: number; y: number; color: ColorMarca }
  /** Un rótulo («CORTA», «RASO») con líneas a los puntos que explica. */
  | { id: string; tipo: "etiqueta"; x: number; y: number; texto: string; a: Punto[] }
  /** Un desplazamiento o un pase. */
  | {
      id: string;
      tipo: "flecha";
      x: number;
      y: number;
      x2: number;
      y2: number;
      color: ColorMarca;
      discontinua?: boolean;
    }
  /** Una zona a vigilar: una elipse translúcida. */
  | { id: string; tipo: "zona"; x: number; y: number; rx: number; ry: number; color: ColorMarca };

export type TipoMarca = Marca["tipo"];

export type JugadorLamina = {
  /** `playerKey()` del jugador; el nombre va de respaldo si la hoja cambia. */
  clave: string;
  nombre: string;
  /** El segundo dato de la ficha, debajo de la altura. */
  dato: "edad" | "pie";
};

export type Lamina = {
  id: string;
  seccion: SeccionId;
  titulo: string;
  marcas: Marca[];
  /** Rótulo encima de las fichas («PRINCIPALES CENTRADORES»). */
  tituloJugadores?: string;
  jugadores: JugadorLamina[];
  /** Texto de la leyenda por color; vacío = ese color no sale. */
  leyenda?: Partial<Record<ColorMarca, string>>;
  /** Lo que se concluye: va al informe del microciclo. */
  notas?: string;
};

export type TrabajoJornada = {
  laminas: Lamina[];
  /** Una conclusión por sección, aunque no tenga lámina. */
  notas?: Partial<Record<SeccionId, string>>;
  /**
   * Las láminas quitadas, para poder recuperarlas.
   *
   * El 27/09/2026 desapareció la lámina de córner cerrado del Alcorcón y no
   * había forma de volver atrás: el aviso con «Deshacer» dura unos segundos.
   * Se guardan las últimas `MAX_QUITADAS` de cada jornada.
   */
  quitadas?: { lamina: Lamina; en: string }[];
};

export const MAX_QUITADAS = 15;

/**
 * Una lámina sin nada: ni marcas, ni jugadores, ni consignas.
 *
 * No sale ni en el informe del microciclo ni en el PDF o el PPT de la
 * jornada: una diapositiva con el campo vacío sólo hace pasar de largo.
 */
export const laminaVacia = (lamina: Lamina) =>
  lamina.marcas.length === 0 && lamina.jugadores.length === 0 && !lamina.notas?.trim();

export type RivalAnalisisDoc = {
  /** Por jornada («J5»): contra el mismo rival se juega ida y vuelta. */
  jornadas: Record<string, TrabajoJornada>;
};

export const ANALISIS_VACIO: RivalAnalisisDoc = { jornadas: {} };

export const ANALISIS_KIND = "rival-analisis";

export const analisisKey = (equipo: unknown) => `rival-analisis:${slugClave(equipo)}`;

/* ------------------------------------------------------------------ */
/*  LO QUE TRAE LA CARPETA                                             */
/* ------------------------------------------------------------------ */

export type ClipAnalisis = {
  id: string;
  seccion: SeccionId;
  /** «VS EUROPA»: el partido del rival del que sale el clip. */
  partido: string;
  nombre: string;
  url: string;
  /** Ruta dentro del bucket. */
  path: string;
  tamano: number;
  /** El fichero de la carpeta del que salió, para no subirlo dos veces. */
  origen: string;
  origenTamano: number;
};

export type DocAnalisis = {
  id: string;
  ambito: Ambito;
  nombre: string;
  url: string;
  path: string;
  tamano: number;
  origen: string;
};

export type ClipsJornada = {
  clips: ClipAnalisis[];
  docs: DocAnalisis[];
  /** Las carpetas de las que se ha recogido, por si hay que repetirlo. */
  rutas: string[];
  importadoEn?: string;
};

export type RivalClipsDoc = { jornadas: Record<string, ClipsJornada> };

export const CLIPS_VACIO: RivalClipsDoc = { jornadas: {} };

export const CLIPS_KIND = "rival-analisis-clips";

export const clipsKey = (equipo: unknown) => `rival-analisis-clips:${slugClave(equipo)}`;

/** La carpeta del bucket donde caen los vídeos de ese rival. */
export const carpetaBucket = (equipo: unknown, jornada: string) =>
  `2026/rivales/${slugClave(equipo)}/analisis/${slugClave(jornada)}`;

/* ------------------------------------------------------------------ */
/*  AYUDAS                                                             */
/* ------------------------------------------------------------------ */

export function nuevoIdAnalisis() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** «J5 AD ALCORCON» → «J5». Sin número, lo que venga en mayúsculas. */
export function jornadaDeTexto(texto: string): string | null {
  const numero = texto.match(/\bJ(?:ORNADA)?\s*[-_.]?\s*(\d{1,2})\b/i)?.[1];

  return numero ? `J${Number(numero)}` : null;
}

/** Ordena «J12» detrás de «J5», no delante. */
export const ordenJornada = (a: string, b: string) =>
  (Number(a.replace(/\D/g, "")) || 0) - (Number(b.replace(/\D/g, "")) || 0);

export function laminaNueva(seccion: SeccionId): Lamina {
  const suya = SECCION_POR_ID.get(seccion);

  return {
    id: nuevoIdAnalisis(),
    seccion,
    titulo: suya?.tituloLamina ?? "LÁMINA",
    marcas: [],
    jugadores: [],
    leyenda: { ...LEYENDA_POR_DEFECTO },
    tituloJugadores: seccion.startsWith("centros") ? "PRINCIPALES CENTRADORES" : "",
  };
}

const num = (valor: unknown, respaldo = 0) =>
  typeof valor === "number" && Number.isFinite(valor) ? valor : respaldo;

const esColor = (valor: unknown): valor is ColorMarca =>
  typeof valor === "string" && valor in COLORES;

function normalizaMarca(cruda: unknown): Marca | null {
  if (!cruda || typeof cruda !== "object") return null;

  const m = cruda as Record<string, unknown>;

  const id = typeof m.id === "string" ? m.id : nuevoIdAnalisis();

  const x = num(m.x);
  const y = num(m.y);
  const color = esColor(m.color) ? m.color : "rojo";

  switch (m.tipo) {
    case "cruz":
    case "balon":
      return { id, tipo: m.tipo, x, y, color };
    case "etiqueta":
      return {
        id,
        tipo: "etiqueta",
        x,
        y,
        texto: String(m.texto ?? ""),
        a: Array.isArray(m.a)
          ? m.a.map((p) => ({ x: num((p as Punto)?.x), y: num((p as Punto)?.y) }))
          : [],
      };
    case "flecha":
      return {
        id,
        tipo: "flecha",
        x,
        y,
        x2: num(m.x2, x),
        y2: num(m.y2, y),
        color,
        discontinua: Boolean(m.discontinua),
      };
    case "zona":
      return { id, tipo: "zona", x, y, rx: num(m.rx, 4), ry: num(m.ry, 3), color };
    default:
      return null;
  }
}

function normalizaLamina(cruda: unknown): Lamina | null {
  if (!cruda || typeof cruda !== "object") return null;

  const l = cruda as Record<string, unknown>;

  const seccion = SECCION_POR_ID.has(l.seccion as SeccionId)
    ? (l.seccion as SeccionId)
    : null;

  if (!seccion) return null;

  return {
    id: typeof l.id === "string" ? l.id : nuevoIdAnalisis(),
    seccion,
    titulo: String(l.titulo ?? ""),
    marcas: Array.isArray(l.marcas)
      ? l.marcas.map(normalizaMarca).filter((m): m is Marca => m !== null)
      : [],
    tituloJugadores: typeof l.tituloJugadores === "string" ? l.tituloJugadores : "",
    jugadores: Array.isArray(l.jugadores)
      ? l.jugadores
          .filter((j) => j && typeof j === "object")
          .map((j) => {
            const uno = j as Record<string, unknown>;

            return {
              clave: String(uno.clave ?? ""),
              nombre: String(uno.nombre ?? ""),
              dato: uno.dato === "pie" ? ("pie" as const) : ("edad" as const),
            };
          })
      : [],
    leyenda:
      l.leyenda && typeof l.leyenda === "object"
        ? (l.leyenda as Partial<Record<ColorMarca, string>>)
        : { ...LEYENDA_POR_DEFECTO },
    notas: typeof l.notas === "string" ? l.notas : "",
  };
}

export function normalizaAnalisis(crudo: unknown): RivalAnalisisDoc {
  const doc = (crudo && typeof crudo === "object" ? crudo : {}) as Record<string, unknown>;

  const jornadas: Record<string, TrabajoJornada> = {};

  const origen =
    doc.jornadas && typeof doc.jornadas === "object"
      ? (doc.jornadas as Record<string, unknown>)
      : {};

  for (const [jornada, trabajo] of Object.entries(origen)) {
    const t = (trabajo && typeof trabajo === "object" ? trabajo : {}) as Record<string, unknown>;

    jornadas[jornada] = {
      laminas: Array.isArray(t.laminas)
        ? t.laminas.map(normalizaLamina).filter((l): l is Lamina => l !== null)
        : [],
      notas:
        t.notas && typeof t.notas === "object"
          ? (t.notas as Partial<Record<SeccionId, string>>)
          : {},
      quitadas: Array.isArray(t.quitadas)
        ? t.quitadas
            .map((q) => {
              const lamina = normalizaLamina((q as { lamina?: unknown })?.lamina);

              return lamina ? { lamina, en: String((q as { en?: unknown }).en ?? "") } : null;
            })
            .filter((q): q is { lamina: Lamina; en: string } => q !== null)
        : [],
    };
  }

  return { jornadas };
}

export function normalizaClips(crudo: unknown): RivalClipsDoc {
  const doc = (crudo && typeof crudo === "object" ? crudo : {}) as Record<string, unknown>;

  const jornadas: Record<string, ClipsJornada> = {};

  const origen =
    doc.jornadas && typeof doc.jornadas === "object"
      ? (doc.jornadas as Record<string, unknown>)
      : {};

  for (const [jornada, crudoJ] of Object.entries(origen)) {
    const j = (crudoJ && typeof crudoJ === "object" ? crudoJ : {}) as Partial<ClipsJornada>;

    jornadas[jornada] = {
      clips: Array.isArray(j.clips) ? j.clips.filter((c) => c && c.url && c.seccion) : [],
      docs: Array.isArray(j.docs) ? j.docs.filter((d) => d && d.url) : [],
      rutas: Array.isArray(j.rutas) ? j.rutas.map(String) : [],
      importadoEn: j.importadoEn,
    };
  }

  return { jornadas };
}

/** «IZDO», «IZQ», «ZURDO» → «ZURDO»; lo demás que diga derecho, «DIESTRO». */
export function pieLegible(valor: unknown): string {
  const texto = String(valor ?? "").trim().toUpperCase();

  if (!texto) return "";

  if (/^(IZ|ZUR|LEFT)/.test(texto)) return "ZURDO";

  if (/^(DE|DCH|DIES|RIGHT)/.test(texto)) return "DIESTRO";

  if (/AMB/.test(texto)) return "AMBIDIESTRO";

  return texto;
}
