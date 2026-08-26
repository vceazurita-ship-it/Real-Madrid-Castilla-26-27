/**
 * Vocabulario y cuentas del microciclo de balón parado.
 *
 * Aquí vive lo que el cuerpo técnico planifica —qué aspecto de ABP se trabaja,
 * cuándo dentro de la sesión, en campo o en vídeo, con qué roles y cuánto
 * desgaste deja— y el puente hacia lo que luego se mide en competición.
 *
 * El catálogo de aspectos es **cerrado y propio de la planificación**: es la
 * lista con la que se decide una semana. Las hojas de ABP registran otra cosa
 * (`Tipo_Accion` en texto libre, que `lib/abp/model.ts` reduce a familias), así
 * que cada aspecto declara cómo se reconoce en competición. No todos se pueden
 * reconocer: hay acciones que hoy ninguna hoja registra, y eso se dice en
 * pantalla en vez de pintar un cero, que se leería como «no pasa nunca».
 *
 * Ver `lib/abp/competicion.ts` (lo que hicimos en los partidos) y
 * `lib/abp/registro.ts` (lo que hicimos en los entrenamientos).
 */

import type { AbpFamily } from "./model";

/* ------------------------------------------------------------------ */
/*  EJES DE LA PLANIFICACIÓN                                           */
/* ------------------------------------------------------------------ */

/** Ofensivo: lo ejecutamos. Defensivo: lo defendemos. */
export type AbpLado = "ofensivo" | "defensivo";

export const LADOS: { key: AbpLado; label: string; color: string }[] = [
  { key: "ofensivo", label: "Ofensivo", color: "#34D399" },
  { key: "defensivo", label: "Defensivo", color: "#F87171" },
];

export const LADO_LABEL: Record<AbpLado, string> = {
  ofensivo: "Ofensivo",
  defensivo: "Defensivo",
};

export const LADO_COLOR: Record<AbpLado, string> = {
  ofensivo: "#34D399",
  defensivo: "#F87171",
};

/** Dónde cae el trabajo dentro de la sesión. */
export type AbpMomento = "pre" | "intra" | "post";

export const MOMENTOS: { key: AbpMomento; label: string; short: string }[] = [
  { key: "pre", label: "Pre entreno", short: "PRE" },
  { key: "intra", label: "Intra entreno", short: "INTRA" },
  { key: "post", label: "Post entreno", short: "POST" },
];

export const MOMENTO_LABEL: Record<AbpMomento, string> = {
  pre: "Pre entreno",
  intra: "Intra entreno",
  post: "Post entreno",
};

export const MOMENTO_SHORT: Record<AbpMomento, string> = {
  pre: "PRE",
  intra: "INTRA",
  post: "POST",
};

/** Campo o sala de vídeo. Cambia el desgaste, no el contenido. */
export type AbpMedio = "campo" | "video";

export const MEDIOS: { key: AbpMedio; label: string }[] = [
  { key: "campo", label: "Campo" },
  { key: "video", label: "Vídeo" },
];

export const MEDIO_LABEL: Record<AbpMedio, string> = {
  campo: "Campo",
  video: "Vídeo",
};

/**
 * Con quién se trabaja. No es excluyente: una tarea de córner puede montarse
 * con sacadores y rematadores a la vez y sin bloqueadores.
 */
export type AbpRol = "sacadores" | "fijadores" | "rematadores";

export const ROLES: { key: AbpRol; label: string; short: string }[] = [
  { key: "sacadores", label: "Sacadores", short: "SAC" },
  { key: "fijadores", label: "Fijadores (bloqueadores)", short: "FIJ" },
  { key: "rematadores", label: "Rematadores", short: "REM" },
];

export const ROL_LABEL: Record<AbpRol, string> = {
  sacadores: "Sacadores",
  fijadores: "Fijadores (bloqueadores)",
  rematadores: "Rematadores",
};

export const ROL_SHORT: Record<AbpRol, string> = {
  sacadores: "SAC",
  fijadores: "FIJ",
  rematadores: "REM",
};

/* ------------------------------------------------------------------ */
/*  CATÁLOGO DE ASPECTOS                                               */
/* ------------------------------------------------------------------ */

export type AspectoKey =
  | "corner-directo"
  | "corner-indirecto"
  | "falta-lateral-directa"
  | "falta-lateral-indirecta"
  | "falta-directa-porteria"
  | "penalti"
  | "banda-z1"
  | "banda-z2"
  | "banda-z3"
  | "saque-medio"
  | "reinicio-porteria"
  | "libre-indirecto-area";

/**
 * Cómo se reconoce un aspecto entre las acciones de las hojas de competición.
 *
 * `family` es la familia de `lib/abp/model.ts`. `envio` distingue las jugadas
 * que la hoja no separa: un córner **al área** (bombeado o tenso) y un córner
 * **en corto** son dos entrenamientos distintos, pero la hoja los guarda a los
 * dos como "Córner" y sólo se diferencian por `Tipo_Envio`. Es una lectura,
 * no un dato registrado, y la página lo advierte donde se usa.
 */
type Reconocimiento = {
  family: AbpFamily;
  /** "largo" = bombeado o tenso; "corto" = jugado en corto. */
  envio?: "corto" | "largo";
  /** Zona del saque de banda (1, 2 o 3). */
  zonaSaque?: number;
};

export type Aspecto = {
  key: AspectoKey;
  label: string;
  /** Para las fichas estrechas de la semana. */
  short: string;
  grupo: "corner" | "falta" | "banda" | "otras";
  /**
   * `null` cuando ninguna hoja puede reconocer la acción. No es lo mismo que
   * cero acciones: es que no hay dónde mirar, y decirlo evita planificar a
   * ciegas creyendo que el dato existe.
   */
  reconocimiento: Reconocimiento | null;
  /** Por qué no hay dato, cuando no lo hay. */
  sinDato?: string;
};

export const ASPECTOS: Aspecto[] = [
  {
    key: "corner-directo",
    label: "Córner directo",
    short: "Córner dir.",
    grupo: "corner",
    reconocimiento: { family: "corner", envio: "largo" },
  },
  {
    key: "corner-indirecto",
    label: "Córner indirecto",
    short: "Córner ind.",
    grupo: "corner",
    reconocimiento: { family: "corner", envio: "corto" },
  },
  {
    key: "falta-lateral-directa",
    label: "Falta lateral directa",
    short: "F. lat. dir.",
    grupo: "falta",
    reconocimiento: { family: "falta-lateral", envio: "largo" },
  },
  {
    key: "falta-lateral-indirecta",
    label: "Falta lateral indirecta",
    short: "F. lat. ind.",
    grupo: "falta",
    reconocimiento: { family: "falta-lateral", envio: "corto" },
  },
  {
    key: "falta-directa-porteria",
    label: "Falta directa a portería",
    short: "F. directa",
    grupo: "falta",
    reconocimiento: { family: "falta-directa" },
  },
  {
    key: "penalti",
    label: "Penaltis",
    short: "Penalti",
    grupo: "otras",
    reconocimiento: { family: "penalti" },
  },
  {
    key: "banda-z1",
    label: "Saque de banda Z1",
    short: "Banda Z1",
    grupo: "banda",
    reconocimiento: { family: "banda", zonaSaque: 1 },
  },
  {
    key: "banda-z2",
    label: "Saque de banda Z2",
    short: "Banda Z2",
    grupo: "banda",
    reconocimiento: { family: "banda", zonaSaque: 2 },
  },
  {
    key: "banda-z3",
    label: "Saque de banda Z3",
    short: "Banda Z3",
    grupo: "banda",
    reconocimiento: { family: "banda", zonaSaque: 3 },
  },
  {
    key: "saque-medio",
    label: "Saque de medio",
    short: "S. medio",
    grupo: "otras",
    reconocimiento: { family: "saque-medio" },
  },
  {
    key: "reinicio-porteria",
    label: "Reinicio de portería",
    short: "Reinicio",
    grupo: "otras",
    reconocimiento: { family: "saque-meta" },
  },
  {
    key: "libre-indirecto-area",
    label: "Libre indirecto dentro del área",
    short: "Libre ind.",
    grupo: "otras",
    reconocimiento: null,
    sinDato:
      "Ninguna hoja de ABP tiene una casilla para el libre indirecto dentro del área.",
  },
];

export const ASPECTO_BY_KEY = new Map<AspectoKey, Aspecto>(
  ASPECTOS.map((aspecto) => [aspecto.key, aspecto]),
);

export function aspectoLabel(key: AspectoKey) {
  return ASPECTO_BY_KEY.get(key)?.label ?? key;
}

export const GRUPO_LABEL: Record<Aspecto["grupo"], string> = {
  corner: "Córners",
  falta: "Faltas",
  banda: "Saques de banda",
  otras: "Otras",
};

/** Los aspectos agrupados, en el orden en que se eligen. */
export const ASPECTOS_POR_GRUPO = (
  ["corner", "falta", "banda", "otras"] as const
).map((grupo) => ({
  grupo,
  label: GRUPO_LABEL[grupo],
  aspectos: ASPECTOS.filter((aspecto) => aspecto.grupo === grupo),
}));

/* ------------------------------------------------------------------ */
/*  EL PLAN                                                            */
/* ------------------------------------------------------------------ */

/** Lunes a domingo, con las iniciales que usa la hoja de registro. */
export type DiaKey = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export const DIAS: { key: DiaKey; label: string; corto: string }[] = [
  { key: "L", label: "Lunes", corto: "Lun" },
  { key: "M", label: "Martes", corto: "Mar" },
  { key: "X", label: "Miércoles", corto: "Mié" },
  { key: "J", label: "Jueves", corto: "Jue" },
  { key: "V", label: "Viernes", corto: "Vie" },
  { key: "S", label: "Sábado", corto: "Sáb" },
  { key: "D", label: "Domingo", corto: "Dom" },
];

export const DIA_KEYS: DiaKey[] = DIAS.map((dia) => dia.key);

/** Qué se hace ese día. El descanso no es un entrenamiento sin tareas. */
export type TipoDia = "entreno" | "descanso" | "partido";

export const TIPOS_DIA: { key: TipoDia; label: string }[] = [
  { key: "entreno", label: "Entrenamiento" },
  { key: "descanso", label: "Descanso" },
  { key: "partido", label: "Partido" },
];

export type OrigenTrabajo = "manual" | "registro";

export type Trabajo = {
  id: string;
  lado: AbpLado;
  aspecto: AspectoKey;
  momento: AbpMomento;
  medio: AbpMedio;
  roles: AbpRol[];
  /** Minutos de trabajo. */
  minutos: number;
  /** 1-10. 0 significa «no lo he valorado», no «ninguna». */
  intensidad: number;
  /** 1-10, la exigencia cognitiva de la tarea. */
  exigCognitiva: number;
  /**
   * Cargas tal y como las tiene la hoja de registro, cuando el trabajo viene
   * de allí. Mandan sobre las estimadas: son las que se midieron.
   */
  cargaRegistrada?: number | null;
  cargaCogRegistrada?: number | null;
  origen: OrigenTrabajo;
  /** `Tarea` de la hoja, para no importar dos veces lo mismo. */
  tareaId?: string;
  notas: string;
};

export type PlanDia = {
  tipo: TipoDia;
  /** MD-4, MD-1, MD… Se escribe a mano o llega de la hoja. */
  md: string;
  trabajos: Trabajo[];
};

export type MicroPlan = {
  temporada: string;
  micro: number;
  rival: string;
  dias: Record<DiaKey, PlanDia>;
};

/** Todo lo planificado, indexado por `claveMicro`. */
export type MicroStore = {
  micros: Record<string, MicroPlan>;
};

export const EMPTY_MICRO_STORE: MicroStore = { micros: {} };

export function claveMicro(temporada: string, micro: number) {
  return `${temporada.trim()}#${micro}`;
}

export function planVacio(
  temporada: string,
  micro: number,
  rival: string,
): MicroPlan {
  return { temporada, micro, rival, dias: diasCompletos(undefined) };
}

/**
 * Devuelve el día con su forma completa.
 *
 * Los documentos guardados por versiones anteriores pueden no tener todos los
 * días —o tenerlos a medias—, y la pantalla no puede caerse por eso.
 */
export function diaDe(plan: MicroPlan | undefined, dia: DiaKey): PlanDia {
  const guardado = plan?.dias?.[dia];

  return {
    tipo: guardado?.tipo ?? "entreno",
    md: guardado?.md ?? "",
    trabajos: Array.isArray(guardado?.trabajos) ? guardado.trabajos : [],
  };
}

/**
 * Los siete días con su forma completa.
 *
 * Todo lo que lee un plan pasa por aquí: un documento guardado antes de que
 * existiera un campo —o con un día que nunca se tocó— no puede tumbar la
 * pantalla.
 */
export function diasCompletos(
  plan: MicroPlan | undefined,
): Record<DiaKey, PlanDia> {
  const dias = {} as Record<DiaKey, PlanDia>;

  DIA_KEYS.forEach((dia) => {
    dias[dia] = diaDe(plan, dia);
  });

  return dias;
}

/** Todos los trabajos del microciclo, en orden de la semana. */
export function trabajosDelPlan(plan: MicroPlan | undefined): {
  dia: DiaKey;
  trabajo: Trabajo;
}[] {
  if (!plan) return [];

  return DIA_KEYS.flatMap((dia) =>
    diaDe(plan, dia).trabajos.map((trabajo) => ({ dia, trabajo })),
  );
}

export function nuevoTrabajo(overrides: Partial<Trabajo> = {}): Trabajo {
  return {
    /* `crypto.randomUUID` no está en todos los navegadores de la caseta. */
    id: `T-${Math.random().toString(36).slice(2, 10)}`,
    lado: "ofensivo",
    aspecto: "corner-directo",
    momento: "intra",
    medio: "campo",
    roles: [],
    minutos: 10,
    intensidad: 0,
    exigCognitiva: 0,
    origen: "manual",
    notas: "",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  DESGASTE                                                           */
/* ------------------------------------------------------------------ */

/**
 * Carga condicional de un trabajo.
 *
 * La hoja de registro de tareas calcula su «Carga Ponderada» como
 * `Tiempo × Intensidad` —comprobado contra sus propias filas—, así que la
 * planificación usa exactamente la misma cuenta. Un trabajo importado trae la
 * suya ya medida y esa manda.
 */
export function cargaCondicional(trabajo: Trabajo) {
  if (trabajo.cargaRegistrada != null) return trabajo.cargaRegistrada;

  return trabajo.minutos * trabajo.intensidad;
}

/**
 * Carga cognitiva.
 *
 * La hoja la calcula con más ingredientes que el tiempo y la exigencia
 * (densidad, incertidumbre, familiaridad…), y su fórmula no se puede
 * reconstruir desde fuera. Lo que se planifica aquí es una **estimación**
 * declarada —`Tiempo × Exigencia`, la misma escala— y así se etiqueta en
 * pantalla; lo importado conserva la cifra real de la hoja.
 */
export function cargaCognitiva(trabajo: Trabajo) {
  if (trabajo.cargaCogRegistrada != null) return trabajo.cargaCogRegistrada;

  return trabajo.minutos * trabajo.exigCognitiva;
}

/** ¿La carga de este trabajo está medida o estimada? */
export function cargaEsReal(trabajo: Trabajo) {
  return trabajo.cargaRegistrada != null || trabajo.cargaCogRegistrada != null;
}

export type TotalesPlan = {
  minutos: number;
  minutosCampo: number;
  minutosVideo: number;
  trabajos: number;
  carga: number;
  cargaCog: number;
  porLado: Record<AbpLado, number>;
  porMomento: Record<AbpMomento, number>;
  porRol: Record<AbpRol, number>;
  /** Días con al menos un trabajo de ABP. */
  diasConAbp: number;
};

export function totalesDe(entradas: { dia: DiaKey; trabajo: Trabajo }[]): TotalesPlan {
  const totales: TotalesPlan = {
    minutos: 0,
    minutosCampo: 0,
    minutosVideo: 0,
    trabajos: entradas.length,
    carga: 0,
    cargaCog: 0,
    porLado: { ofensivo: 0, defensivo: 0 },
    porMomento: { pre: 0, intra: 0, post: 0 },
    porRol: { sacadores: 0, fijadores: 0, rematadores: 0 },
    diasConAbp: new Set(entradas.map((entrada) => entrada.dia)).size,
  };

  entradas.forEach(({ trabajo }) => {
    const minutos = trabajo.minutos || 0;

    totales.minutos += minutos;
    totales.carga += cargaCondicional(trabajo);
    totales.cargaCog += cargaCognitiva(trabajo);
    totales.porLado[trabajo.lado] += minutos;
    totales.porMomento[trabajo.momento] += minutos;

    if (trabajo.medio === "video") totales.minutosVideo += minutos;
    else totales.minutosCampo += minutos;

    trabajo.roles.forEach((rol) => {
      totales.porRol[rol] += minutos;
    });
  });

  return totales;
}

/** Minutos por aspecto y lado. La clave es `${aspecto}|${lado}`. */
export function minutosPorAspecto(
  entradas: { trabajo: Trabajo }[],
): Map<string, number> {
  const mapa = new Map<string, number>();

  entradas.forEach(({ trabajo }) => {
    const clave = `${trabajo.aspecto}|${trabajo.lado}`;

    mapa.set(clave, (mapa.get(clave) ?? 0) + (trabajo.minutos || 0));
  });

  return mapa;
}

export function claveAspecto(aspecto: AspectoKey, lado: AbpLado) {
  return `${aspecto}|${lado}`;
}

/* ------------------------------------------------------------------ */
/*  FORMATO                                                            */
/* ------------------------------------------------------------------ */

export function fmtMin(minutos: number) {
  if (!minutos) return "0'";

  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);

  return horas > 0 ? `${horas}h ${resto}'` : `${Math.round(minutos)}'`;
}

export function fmtPct(valor: number) {
  if (!Number.isFinite(valor)) return "—";

  return `${valor.toFixed(valor >= 10 ? 0 : 1)} %`;
}
