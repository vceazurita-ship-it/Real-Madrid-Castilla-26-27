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

/**
 * El tipo de acción que acaba en gol (03/11/2026, lo pidió el analista junto a
 * la fase y el campo donde arranca). Vale para los dos lados: es lo que pasó,
 * visto desde nuestro análisis.
 */
export const ACCIONES = [
  { clave: "centroLateral", nombre: "Centro lateral" },
  { clave: "paseAtras", nombre: "Pase atrás desde línea de fondo" },
  { clave: "paseEspalda", nombre: "Pase a la espalda" },
  { clave: "combinacion", nombre: "Combinación por dentro" },
  { clave: "jugadaIndividual", nombre: "Jugada individual" },
  { clave: "remateLejano", nombre: "Remate de fuera del área" },
  { clave: "rechace", nombre: "Rechace / segunda acción" },
  { clave: "corner", nombre: "Córner" },
  { clave: "faltaLateral", nombre: "Falta lateral" },
  { clave: "faltaDirecta", nombre: "Falta directa" },
  { clave: "penalti", nombre: "Penalti" },
  { clave: "saqueBanda", nombre: "Saque de banda" },
  { clave: "propiaPuerta", nombre: "En propia puerta" },
] as const;

/** Desde qué campo arranca la fase del gol (mitad, no tercio), siempre desde el Castilla: «propio» = nuestra mitad. */
export const CAMPOS = [
  { clave: "propio", nombre: "Campo propio" },
  { clave: "contrario", nombre: "Campo contrario" },
] as const;

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
export type AccionGol = (typeof ACCIONES)[number]["clave"];
export type Campo = (typeof CAMPOS)[number]["clave"];

/** Una celda del campo de 3×3, en la referencia del Castilla (ver arriba). */
export type Celda = { tercio: 0 | 1 | 2; carril: 0 | 1 | 2 };

/** Un jugador NUESTRO que interviene, con lo que hizo («Recupera», «Pase», «Asiste», «Remata», «Pierde», «Duelo perdido»…). */
export type Implicado = { jugador: string; accion: string };

/** Lo que se saca de Hudl, sin mirar el vídeo. Todo opcional: lo que no se sabe no se pone. */
export type FichaAuto = {
  fase?: FaseNuestra;
  origen?: Origen;
  /** Desde qué mitad arranca esa fase, para nosotros (el robo, nuestra pérdida, el saque…). */
  campo?: Campo;
  /** El tipo de acción que acaba en gol. */
  accion?: AccionGol;
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
  /** El corte del gol, sacado del vídeo de Hudl (~12 s antes del gol y ~5 s después), en el bucket. */
  video?: string;
  /**
   * El vídeo del partido en Hudl y el segundo del gol en ese vídeo. Hudl no
   * deja enlazar a un instante (ignora ?t=, #t= y compañía: siempre abre en
   * 0), así que el enlace va al partido y el «mm:ss» se enseña al lado.
   */
  hudl?: { url: string; seg: number };
  /** De dónde sale cada dato, en una frase (sólo con los textos explicativos encendidos). */
  fuentes?: Partial<Record<CampoFuente, string>>;
  /** Lo que ha visto el script, en una frase (como `TipologiaGol.motivo`). */
  motivo?: string;
};

/** Los datos de la ficha que llevan su fuente. */
export type CampoFuente = "casado" | "autor" | "tipo" | "fase" | "campo" | "accion" | "origen" | "implicados" | "video";

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

/**
 * La ficha que se enseña: lo manual encima de lo automático. `deHudl`, lo que
 * llega del script sin tocar; `deTipologia`, lo que se ha puesto o cambiado
 * para que case con la tipología elegida (`fichaCoherente`).
 */
export type FichaTecnica = FichaManual & {
  motivo?: string;
  hudl?: FichaAuto["hudl"];
  fuentes?: FichaAuto["fuentes"];
  deHudl: (keyof FichaAuto)[];
  deTipologia?: (keyof FichaAuto)[];
};

export function fichaDe(auto: FichaAuto | undefined, manual: FichaManual | undefined): FichaTecnica {
  const a = auto ?? {};
  const m = manual ?? {};
  const deHudl = (Object.keys(a) as (keyof FichaAuto)[]).filter((k) => k !== "motivo" && k !== "fuentes" && a[k] !== undefined && (m as Record<string, unknown>)[k] === undefined);

  return { ...a, ...m, deHudl };
}

/** Lo que de verdad dice algo de la jugada (el vídeo o el enlace solos no cuentan). */
export const tieneFicha = (f: FichaTecnica) =>
  Boolean(f.fase || f.campo || f.accion || f.origen || f.zonaOrigen || f.implicados?.length || f.claves?.length || f.causas?.length || f.lectura || f.consigna);

/** Lo que hace cada uno de los nuestros, para elegir al escribirlo a mano. */
export const ACCIONES_IMPLICADO = {
  favor: ["Recupera", "Pase", "Conduce", "Asiste", "Remata"],
  contra: ["Pierde", "Duelo perdido", "Llega tarde", "Pierde la marca", "Falta"],
} as const;

/** «mm:ss» de un segundo del vídeo (h:mm:ss si pasa de la hora). */
export function rotuloSegundo(seg: number) {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");

  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/* ------------------------------------------------------------------ */
/*  Coherencia con la tipología                                        */
/* ------------------------------------------------------------------ */

type TipoTipologia = "dentro" | "bandaD" | "bandaI" | "espalda" | "caida" | "error" | "transContrario" | "transPropio" | "corner" | "faltaLateral" | "faltaDirecta" | "banda" | "penalti";

const ACCION_ABP: Partial<Record<TipoTipologia, AccionGol>> = { corner: "corner", faltaLateral: "faltaLateral", faltaDirecta: "faltaDirecta", banda: "saqueBanda", penalti: "penalti" };
const ACCIONES_ABP = new Set<string>(["corner", "faltaLateral", "faltaDirecta", "saqueBanda", "penalti"]);
const ORIGENES_ORGANIZADOS = new Set<string>(["construccion", "posesionLarga", "defensaPosicional"]);

/**
 * Lo que la tipología (la hoja del cuerpo técnico) dice de la ficha. La fase
 * sale siempre: AT. ORGANIZADO es ataque o defensa organizada; TRANSICIÓN,
 * transición; ABP, ABP. El campo, cuando la tipología lo lleva dentro: la
 * transición dice desde qué campo roba QUIEN MARCA (en un gol en contra, su
 * campo propio es nuestro campo contrario), y el córner y el penalti se sacan
 * siempre en el campo del que defiende. La acción, en el balón parado.
 */
export function ejeDeTipologia(tipo: string, aFavor: boolean): { fase: FaseNuestra; campo?: Campo; accion?: AccionGol; accionSiFalta?: AccionGol } | null {
  const t = tipo as TipoTipologia;
  const suyo = (c: Campo): Campo => (aFavor ? c : c === "propio" ? "contrario" : "propio");

  if (ACCION_ABP[t]) {
    return { fase: aFavor ? "abpOfensiva" : "abpDefensiva", accion: ACCION_ABP[t], ...(t === "corner" || t === "penalti" ? { campo: suyo("contrario") } : {}) };
  }

  if (t === "transContrario" || t === "transPropio") return { fase: aFavor ? "transicionOfensiva" : "transicionDefensiva", campo: suyo(t === "transPropio" ? "propio" : "contrario") };

  if (["dentro", "bandaD", "bandaI", "espalda", "caida", "error"].includes(t)) {
    return { fase: aFavor ? "ataqueOrganizado" : "defensaOrganizada", ...(t === "caida" ? { accionSiFalta: "rechace" as const } : t === "espalda" ? { accionSiFalta: "paseEspalda" as const } : {}) };
  }

  return null;
}

/**
 * La ficha, de acuerdo con la tipología que se enseña (la elegida a mano o la
 * de Hudl). Lo que ha puesto el cuerpo técnico en la ficha no se toca; lo
 * automático que contradice la tipología se cambia (fase, campo, acción) o se
 * quita (un origen que no es de esa fase). Así nunca sale, por ejemplo, un
 * «córner» con fase «transición».
 */
export function fichaCoherente(f: FichaTecnica, tipo: string | null | undefined, aFavor: boolean): FichaTecnica {
  const eje = tipo ? ejeDeTipologia(tipo, aFavor) : null;

  if (!eje) return f;

  const out: FichaTecnica = { ...f, deHudl: [...f.deHudl] };
  const cambiados: (keyof FichaAuto)[] = [];
  const libre = (k: keyof FichaAuto) => f[k as keyof FichaTecnica] === undefined || f.deHudl.includes(k);
  const pon = <K extends "fase" | "campo" | "accion" | "origen">(k: K, v: FichaTecnica[K] | undefined) => {
    if (!libre(k) || out[k] === v) return;

    out[k] = v;
    out.deHudl = out.deHudl.filter((x) => x !== k);
    if (v !== undefined) cambiados.push(k);
  };

  pon("fase", eje.fase);
  if (eje.campo) pon("campo", eje.campo);

  const esAbp = eje.fase === "abpOfensiva" || eje.fase === "abpDefensiva";
  const accion = out.accion;

  if (esAbp) {
    /* Un gol de córner o de penalti rematado al rechace sigue siendo ese balón parado: la acción «rechace» vale. */
    if (accion !== "rechace" && accion !== "propiaPuerta" && accion !== eje.accion) pon("accion", eje.accion);
  } else if (accion && ACCIONES_ABP.has(accion)) {
    pon("accion", eje.accionSiFalta);
  } else if (!accion && eje.accionSiFalta) {
    pon("accion", eje.accionSiFalta);
  }

  const origen = out.origen;

  if (esAbp) pon("origen", "abp");
  else if (origen === "abp") pon("origen", undefined);
  else if ((eje.fase === "transicionOfensiva" || eje.fase === "transicionDefensiva") && origen && ORIGENES_ORGANIZADOS.has(origen)) pon("origen", undefined);

  return cambiados.length ? { ...out, deTipologia: cambiados } : out;
}

export const nombreFase = (c: string) => [...FASES_NUESTRAS.favor, ...FASES_NUESTRAS.contra].find((x) => x.clave === c)?.nombre ?? "";
export const nombreOrigen = (c: string) => [...ORIGENES.favor, ...ORIGENES.contra].find((x) => x.clave === c)?.nombre ?? "";
export const nombreAccion = (c: string) => ACCIONES.find((x) => x.clave === c)?.nombre ?? "";
export const nombreCampo = (c: string) => CAMPOS.find((x) => x.clave === c)?.nombre ?? "";
export const nombreClave = (c: string) => CLAVES_FAVOR.find((x) => x.clave === c)?.nombre ?? "";
export const nombreCausa = (c: string) => CAUSAS_CONTRA.find((x) => x.clave === c)?.nombre ?? "";

/** «Tercio propio · izquierda». */
export function nombreCelda(c: Celda) {
  return `${["Nuestro tercio", "Zona media", "Su tercio"][c.tercio]} · ${["izquierda", "centro", "derecha"][c.carril]}`;
}
