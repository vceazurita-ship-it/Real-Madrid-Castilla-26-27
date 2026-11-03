/*
|--------------------------------------------------------------------------
| EL ANÁLISIS TÉCNICO DE CADA GOL, DESDE EL CASTILLA (03/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que sea un análisis técnico desde nuestro equipo, no
| tanto desde la acción rival». La tipología (`FASES`) dice cómo llegó el gol;
| esta ficha dice QUÉ HICIMOS NOSOTROS: en qué fase estábamos, dónde nace la
| jugada para nosotros (el robo o la construcción en los nuestros; la pérdida
| o el momento defensivo en los suyos), quién de los nuestros interviene, qué
| salió bien o mal y qué nos llevamos al entrenamiento.
|
| Dos capas, como la tipología:
|   - `FichaAuto`: la saca `scripts/goles-liga.mjs` del timeline de Hudl cada
|     noche y va en `goles:analisis` → `tecnico[clave]`.
|   - `FichaManual`: lo que el cuerpo técnico corrige o añade en la pantalla,
|     en `goles:tecnico-manual`. Manda sobre lo automático, campo a campo.
|
| La clave de cada gol es la de siempre: `<idPartido>:<n.º de gol>` (`claveGol`).
| Las zonas van SIEMPRE en la referencia del Castilla: tercio 0 = el nuestro
| (donde defendemos), 2 = el suyo; carril 0 = izquierda, 2 = derecha mirando
| a la portería rival. Así un gol en contra y uno a favor se pintan en el
| mismo campo sin girarlo.
*/

export const DOC_TECNICO_MANUAL = "goles:tecnico-manual";

/** Nuestra fase cuando nace la jugada del gol. */
export const FASES_NUESTRAS = {
  favor: [
    { clave: "ataqueOrganizado", nombre: "Ataque organizado" },
    { clave: "transicionOfensiva", nombre: "Transición ofensiva" },
    { clave: "abpOfensiva", nombre: "ABP ofensiva" },
  ],
  contra: [
    { clave: "defensaOrganizada", nombre: "Defensa organizada" },
    { clave: "transicionDefensiva", nombre: "Transición defensiva" },
    { clave: "abpDefensiva", nombre: "ABP defensiva" },
  ],
} as const;

/** Dónde y cómo nace la jugada, para nosotros. */
export const ORIGENES = {
  favor: [
    { clave: "roboAlto", nombre: "Robo en campo contrario" },
    { clave: "roboMedio", nombre: "Robo en zona media" },
    { clave: "roboBajo", nombre: "Robo en nuestro campo" },
    { clave: "construccion", nombre: "Construcción desde atrás" },
    { clave: "posesionLarga", nombre: "Posesión instalada en su campo" },
    { clave: "segundaJugada", nombre: "Segunda jugada / rechace" },
    { clave: "errorRival", nombre: "Error del rival en salida" },
    { clave: "abp", nombre: "Balón parado" },
  ],
  contra: [
    { clave: "perdidaSalida", nombre: "Pérdida en nuestra salida" },
    { clave: "perdidaMedio", nombre: "Pérdida en zona media" },
    { clave: "perdidaAlta", nombre: "Pérdida en campo contrario" },
    { clave: "defensaPosicional", nombre: "Ataque posicional suyo" },
    { clave: "segundaJugada", nombre: "Segunda jugada / rechace" },
    { clave: "errorPropio", nombre: "Error nuestro" },
    { clave: "abp", nombre: "Balón parado" },
  ],
} as const;

/** Lo que hicimos bien en un gol nuestro (varias a la vez). */
export const CLAVES_FAVOR = [
  { clave: "presionTrasPerdida", nombre: "Presión tras pérdida" },
  { clave: "roboOrientado", nombre: "Robo y primer pase hacia delante" },
  { clave: "amplitud", nombre: "Amplitud para fijar y atacar el lado débil" },
  { clave: "ruptura", nombre: "Ruptura / ataque a la espalda" },
  { clave: "tercerHombre", nombre: "Tercer hombre / pared" },
  { clave: "superioridadDentro", nombre: "Superioridad por dentro" },
  { clave: "centroLlegada", nombre: "Centro y ocupación del área" },
  { clave: "llegadaSegundaLinea", nombre: "Llegada de segunda línea" },
  { clave: "rechace", nombre: "Atacar el rechace" },
  { clave: "rutinaAbp", nombre: "Rutina de ABP entrenada" },
  { clave: "accionIndividual", nombre: "Acción individual" },
] as const;

/** Lo que falló en un gol en contra (varias a la vez). */
export const CAUSAS_CONTRA = [
  { clave: "presionBalon", nombre: "Sin presión al poseedor" },
  { clave: "vigilancias", nombre: "Vigilancias tras pérdida" },
  { clave: "repliegue", nombre: "Repliegue tardío" },
  { clave: "basculacion", nombre: "Basculación tardía" },
  { clave: "lineaDefensiva", nombre: "Línea defensiva desajustada" },
  { clave: "coberturas", nombre: "Sin cobertura / permuta" },
  { clave: "dueloPerdido", nombre: "Duelo perdido" },
  { clave: "centroSinOposicion", nombre: "Centro sin oposición" },
  { clave: "marcaArea", nombre: "Marca perdida en el área" },
  { clave: "rechace", nombre: "Rechace no atacado" },
  { clave: "abpMarcas", nombre: "ABP: marca o zona" },
  { clave: "errorTecnico", nombre: "Error técnico" },
  { clave: "portero", nombre: "Acción del portero" },
] as const;

export type Bando = keyof typeof FASES_NUESTRAS;
export type FaseNuestra = (typeof FASES_NUESTRAS)[Bando][number]["clave"];
export type Origen = (typeof ORIGENES)[Bando][number]["clave"];
export type ClaveFavor = (typeof CLAVES_FAVOR)[number]["clave"];
export type CausaContra = (typeof CAUSAS_CONTRA)[number]["clave"];

/** Una celda del campo de 3×3, en la referencia del Castilla (ver arriba). */
export type Celda = { tercio: 0 | 1 | 2; carril: 0 | 1 | 2 };

/** Un jugador NUESTRO que interviene, con lo que hizo («Recupera», «Pase», «Asiste», «Remata», «Pierde», «Duelo perdido»…). */
export type Implicado = { jugador: string; accion: string };

/** Lo que se saca de Hudl, sin mirar el vídeo. Todo opcional: lo que no se sabe no se pone. */
export type FichaAuto = {
  fase?: FaseNuestra;
  origen?: Origen;
  /** Dónde nace la jugada: el robo o el inicio de la posesión (a favor); nuestra pérdida o su inicio (en contra). */
  zonaOrigen?: Celda;
  /** Por qué carril llega al área. */
  carril?: 0 | 1 | 2;
  /** Del origen al gol. */
  segundos?: number;
  /** Pases del equipo que marca en la jugada. */
  pases?: number;
  /** Los nuestros, en orden de la jugada. */
  implicados?: Implicado[];
  /** El corte del gol (de `informe-clips:jNN`), si lo hay. */
  video?: string;
  /** Lo que ha visto el script, en una frase (como `TipologiaGol.motivo`). */
  motivo?: string;
};

/** Lo que pone el cuerpo técnico. Manda sobre `FichaAuto` campo a campo. */
export type FichaManual = Partial<Omit<FichaAuto, "motivo">> & {
  /** Gol nuestro: lo que hicimos bien. */
  claves?: ClaveFavor[];
  /** Gol en contra: lo que falló. */
  causas?: CausaContra[];
  /** Qué hicimos, en una o dos frases técnicas. */
  lectura?: string;
  /** Lo que nos llevamos al entrenamiento: «repetir» en los nuestros, «corregir» en los suyos. */
  consigna?: string;
  /** Visto en vídeo por el cuerpo técnico. */
  revisado?: boolean;
};

export type FichasManuales = Record<string, FichaManual>;

/** La ficha que se enseña: lo manual encima de lo automático. */
export type FichaTecnica = FichaManual & { motivo?: string; deHudl: (keyof FichaAuto)[] };

export function fichaDe(auto: FichaAuto | undefined, manual: FichaManual | undefined): FichaTecnica {
  const a = auto ?? {};
  const m = manual ?? {};
  const deHudl = (Object.keys(a) as (keyof FichaAuto)[]).filter((k) => k !== "motivo" && a[k] !== undefined && (m as Record<string, unknown>)[k] === undefined);

  return { ...a, ...m, deHudl };
}

export const nombreFase = (c: string) => [...FASES_NUESTRAS.favor, ...FASES_NUESTRAS.contra].find((x) => x.clave === c)?.nombre ?? "";
export const nombreOrigen = (c: string) => [...ORIGENES.favor, ...ORIGENES.contra].find((x) => x.clave === c)?.nombre ?? "";
export const nombreClave = (c: string) => CLAVES_FAVOR.find((x) => x.clave === c)?.nombre ?? "";
export const nombreCausa = (c: string) => CAUSAS_CONTRA.find((x) => x.clave === c)?.nombre ?? "";

/** «Tercio propio · izquierda». */
export function nombreCelda(c: Celda) {
  return `${["Nuestro tercio", "Zona media", "Su tercio"][c.tercio]} · ${["izquierda", "centro", "derecha"][c.carril]}`;
}
