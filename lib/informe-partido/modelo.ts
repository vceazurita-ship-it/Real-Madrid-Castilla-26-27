/**
 * EL INFORME DEL PARTIDO: PREVIA Y POST (03/10/2026).
 *
 * Junta en un solo documento lo que el cuerpo técnico tiene repartido en
 * media plataforma:
 *
 *   - el microciclo de la semana (hoja de registro de tareas),
 *   - nuestro análisis y el del rival en datos (Data Análisis · Wyscout),
 *   - el análisis colectivo del rival y su plantilla (hoja RIVALES, BeSoccer),
 *   - su posible once (el marcado en Plantillas o, si no, su último once),
 *   - y el plan de partido (Preparación de Partido).
 *
 * Sale en dos formas: un **resumen en dos diapositivas** —lo que se lee en el
 * móvil antes de entrar al vestuario— y un **informe extenso** por correo.
 *
 * Este módulo es el modelo y la síntesis: no pide nada ni pinta nada. Lo
 * llenan `carga.ts` (navegador) y lo pintan `components/informe-partido/*`
 * y `html.ts`. La regla de siempre: lo que no llega no se inventa; se dice en
 * `avisos`.
 */

/* ------------------------------------------------------------------ */
/*  LA FORMA                                                           */
/* ------------------------------------------------------------------ */

import type { CortePartido } from "@/lib/video-informe/guion";

export type Momento = "previa" | "post";

export type MetricaDuelo = {
  key: string;
  nombre: string;
  unidad: string;
  mejorAlto: boolean | null;
  fase: string;
  /** «Resultado», «Con balón», «Transiciones», «Sin balón», «Balón parado». */
  bloque?: string;
  comoLeer?: string;
  mediana: number | null;
  /** La media de la liga por equipo y partido. */
  media?: number | null;
  nosotros: { valor: number; puesto: number; percentil: number | null } | null;
  rival: { valor: number; puesto: number; percentil: number | null } | null;
};

export type PartidoForma = { fecha: string; rival: string; gf: number; gc: number; xg: number };

export type Duelo = {
  temporada: string;
  equipos: number;
  rival: string | null;
  jugados: { nosotros: number; rival: number };
  /** Las medias son de antes de este día (el del partido). */
  corte?: string | null;
  esquema: { nosotros: string; rival: string };
  metricas: MetricaDuelo[];
  forma: { nosotros: PartidoForma[]; rival: PartidoForma[] };
  partido: null | {
    fecha: string;
    marcador: string;
    metricas: {
      key: string;
      nombre: string;
      unidad: string;
      mejorAlto: boolean | null;
      nuestro: number | null;
      suyo: number | null;
      media: number | null;
    }[];
  };
};

export type DiaMicro = {
  fecha: string;
  /** «Lun 28». */
  etiqueta: string;
  md: string;
  tareas: number;
  minutos: number;
  carga: number;
  /** Los contenidos principales del día, sin repetir. */
  contenidos: string[];
  esPartido: boolean;
};

export type TareaMicro = {
  fecha: string;
  dia: string;
  md: string;
  tarea: string;
  tipo: string;
  fase: string;
  contenido: string;
  secundario: string;
  formato: string;
  minutos: number;
  intensidad: number;
  evaluacion: number;
  analisis: string;
};

export type Microciclo = {
  micro: number;
  temporada: string;
  rival: string;
  dias: DiaMicro[];
  tareas: TareaMicro[];
  totales: {
    tareas: number;
    minutos: number;
    carga: number;
    abpMinutos: number;
    valoradas: number;
    valoracionMedia: number | null;
  };
  /** Contenidos principales por minutos, de más a menos. */
  contenidos: { nombre: string; minutos: number }[];
  /** Fases por minutos. */
  fases: { nombre: string; minutos: number }[];
};

export type JugadorRival = {
  clave: string;
  nombre: string;
  dorsal: string;
  posicion: string;
  /** POR · DEF · MED · DEL, para colocarlo. */
  linea: "POR" | "DEF" | "MED" | "DEL" | "";
  foto: string;
  pie: string;
  altura: string;
  edad: string;
  /** Las etiquetas de la ficha (IMPACTO): «Juego aéreo», «1v1»… */
  rasgos: string[];
  caracteristicas: string;
  fortalezas: string;
  debilidades: string;
  rol: string;
  goles: number | null;
  asistencias: number | null;
  partidos: number | null;
  minutos: number | null;
  /** Dónde va en el dibujo, en tanto por uno (x: banda, y: 0 portería → 1 ataque). */
  x?: number;
  y?: number;
};

export type Plan = {
  claves: string[];
  ataque: string;
  defensa: string;
  abpOf: string;
  abpDef: string;
  emocionales: string;
  estado: string;
  estructuraOf: string;
  estructuraDef: string;
  fortalezas: string;
  debilidades: string;
  duelos: { campo: string; titulo: string; texto: string }[];
};

export type BloqueColectivo = {
  fase: string;
  bloque: string;
  campos: { titulo: string; texto: string }[];
};

export type Colectivo = {
  bloques: BloqueColectivo[];
  conclusiones: { titulo: string; texto: string }[];
  /**
   * Lo que cabe en una diapositiva: una línea por momento del juego (cómo
   * salen, cómo atacan, cómo defienden, qué hacen al robar) y dónde hacerles
   * daño. Sale del mismo análisis, campo a campo por orden de importancia.
   */
  resumen: { fases: { titulo: string; texto: string }[]; dano: string[] };
};

export type DocumentoRival = {
  nombre: string;
  url: string;
  tipo: string;
  tamano: number | null;
  adjuntable: boolean;
  /** Los sacados en Plantillas rivales: cuál es (se sustituyen al volver a sacarlos). */
  generado?: "plantilla-pdf" | "informe-pptx";
};

/** Una de las tres palancas con las que el plan mueve el pronóstico. */
export type Palanca = {
  momento: "Sin balón" | "Con balón" | "Balón parado";
  /** «Bajar su xG de 1,52 a 1,22». */
  objetivo: string;
  /** El dato que la justifica. */
  porque: string;
  /** La línea del plan de partido que la trabaja. */
  plan: string;
  /** Puntos porcentuales de victoria que añade por sí sola. */
  victoria: number;
  /** La meta en número y con qué dato del partido se revisa. */
  meta: number;
  revisa: "xgSuyo" | "xgNuestro" | null;
};

export type Probabilidades = { victoria: number; empate: number; derrota: number; esperados: { nosotros: number; rival: number }; marcador: string };

/** Una métrica del rival para nombrarla en una frase: «pases en el último tercio, 3.º de 20». */
export type ArmaMetrica = { key: string; nombre: string; valor: string; puesto: number; de: number };

/**
 * El pronóstico del partido con lo que vienen siendo los dos.
 *
 * No es una apuesta: es un modelo de Poisson con el xG y los goles de la
 * temporada (antes del partido), corregido por cuántos partidos hay detrás y
 * por el campo. Sirve para dos cosas: decir de qué partido venimos a hablar
 * y medir cuánto mueve el plan cada palanca.
 */
export type Pronostico = Probabilidades & {
  lectura: string;
  /** La idea del partido en una frase: qué quitarles y por dónde hacerles daño, con dato. */
  idea: string;
  palancas: Palanca[];
  conPlan: Probabilidades;
  /** De dónde sale, para el pie: «xG y goles de 5 y 5 partidos · factor campo». */
  base: string;
  /**
   * Su mejor arma (con balón o en transición) y su punto más flojo sin balón,
   * los mismos que justifican las palancas (20/10/2026): con ellos se arma el
   * titular de la previa («Su arma: … ¿Se la quitamos?») y el gancho del vídeo
   * puede usarlos sin recalcular.
   */
  suFuerte?: ArmaMetrica | null;
  suDebil?: ArmaMetrica | null;
};

export type ContextoRival = {
  escudo: string;
  escudoNuestro: string;
  puesto: number | null;
  puntos: number | null;
  /** «G», «E», «P» de los últimos partidos de liga, del más reciente al más antiguo. */
  racha: string[];
  goleadores: { nombre: string; goles: number }[];
  entrenador: string;
  estructuras: string[];
  /** Nuestros «G», «E», «P» de liga (calendario de BeSoccer), del más reciente al más antiguo. */
  nuestraRacha: string[];
  /** Nuestro puesto, para la cabecera. */
  nuestroPuesto: number | null;
  nuestrosPuntos: number | null;
};

export type GolCronica = {
  minuto: string;
  /** Quien lo marca; en propia puerta, el del equipo que se lo mete. */
  jugador: string;
  asistente: string;
  tipo: "" | "penalti" | "propia";
  /** Gol a nuestro favor. */
  nuestro: boolean;
};

/** Post: lo que pasó en el partido según BeSoccer (goles, su once, cambios y tarjetas). */
export type Cronica = {
  goles: GolCronica[];
  /** Su dibujo en el partido («1-4-3-3»). */
  estructura: string;
  /** Su once de verdad, colocado por líneas. */
  onceReal: JugadorRival[];
  /** El once previsto frente al real: sólo si había uno marcado. */
  acierto: { acertados: number; total: number; noSalieron: string[]; sorpresas: string[] } | null;
  /** Suyos: BeSoccer los da del equipo del informe, que es el rival. */
  cambios: { minuto: string; sale: string; entra: string }[];
  tarjetas: { minuto: string; jugador: string; tipo: "amarilla" | "roja" }[];
};

export type InformePartido = {
  momento: Momento;
  generado: string;
  partido: {
    jornada: number | null;
    cuando: string;
    /** «Viernes 2 de octubre · 21:15». */
    fechaTexto: string;
    lado: "casa" | "fuera" | "";
    rival: string;
    gf: number | null;
    gc: number | null;
    jugado: boolean;
  };
  microciclo: Microciclo | null;
  duelo: Duelo | null;
  plan: Plan | null;
  colectivo: Colectivo | null;
  once: { jugadores: JugadorRival[]; fuente: "marcado" | "ultimo" | null; detalle: string };
  plantilla: JugadorRival[];
  contexto: ContextoRival | null;
  abp: {
    minutosSemana: number;
    laminasRival: number;
    documentosRival: { nombre: string; url: string }[];
    /** Lo llena el diálogo cuando llega el informe de ABP incrustado. */
    pincelada?: PinceladaAbp | null;
  } | null;
  /** Post: el partido contado. `null` en la previa o si BeSoccer aún no lo tiene. */
  cronica: Cronica | null;
  /** El pronóstico con los datos de antes del partido (en el post, para contrastarlo). */
  pronostico: Pronostico | null;
  /**
   * Los recursos del rival (Scouting colectivo → Recursos): documentos y
   * vídeos. Los subidos al bucket se pueden adjuntar; los enlaces van como enlace.
   */
  recursos: {
    documentos: DocumentoRival[];
    videos: { nombre: string; url: string; /** «Córner ofensivo · VS EUROPA»: de dónde sale el corte, para el vídeo resumen. */ rotulo?: string; /** La lectura táctica del corte (Gemini, la pone el ordenador del club). */ texto?: string }[];
    /** Los cortes del propio partido (Hudl → bucket, los corta el ordenador del club: `informe-clips:jNN`), con su lectura táctica. */
    cortes?: CortePartido[];
    /** El equipo como lo escribe la hoja de plantillas (para pedir sus documentos a Plantillas rivales). */
    equipoPlantilla: string;
    /** Los que se sacaron en Plantillas rivales: de qué tipo y cuándo. */
    generados: { tipo: "plantilla-pdf" | "informe-pptx"; creado: string }[];
  };
  sintesis: Sintesis;
  avisos: string[];
  /** Los duelos jugador a jugador (Competición → Duelos), resumidos. */
  duelosJugadores: DuelosInforme | null;
  /** El rival de un vistazo (DATA → Un equipo de un vistazo), resumido. */
  vistazo: VistazoRival | null;
  /** El vídeo resumen ya montado por el ordenador del club (`informe-video:jNN`): el diálogo lo adjunta tal cual, sin montar nada. */
  videoListo?: { url: string; creado: string; segundos: number; /** El póster (JPEG en el bucket). */ poster?: string | null; /** La copia ligera en 720p para adjuntar (desde el 15/10/2026; `url` es la de Full HD). */ ligero?: string | null } | null;
};

/* ------------------------------------------------------------------ */
/*  DUELOS Y EL RIVAL DE UN VISTAZO (06/10/2026)                       */
/* ------------------------------------------------------------------ */

export type VeredictoDuelo = "ventaja" | "parejo" | "desventaja" | "sin-datos";

/** Un enfrentamiento de un duelo: con balón de uno contra sin balón del otro. */
export type EnfrentamientoInforme = {
  sentido: "con" | "sin" | "aire";
  titulo: string;
  nuestro: number;
  suyo: number;
  veredicto: VeredictoDuelo;
};

export type DueloJugadores = {
  clave: string;
  titulo: string;
  zona: "defensa" | "medio" | "ataque";
  nuestros: string[];
  suyos: string[];
  veredicto: VeredictoDuelo;
  balance: number | null;
  /** Con el balón nuestro (+ = les hacemos daño) y con el suyo (− = nos lo hacen). */
  conBalon: number | null;
  sinBalon: number | null;
  resumen: string;
  /** Los enfrentamientos que se despegan (ventaja o desventaja), del más claro al menos. */
  destacados: EnfrentamientoInforme[];
};

export type DuelosInforme = {
  lista: DueloJugadores[];
  /** De dónde sale su once («Once probable marcado en Plantillas rivales»…). */
  fuenteSuya: string;
};

export type VistazoRival = {
  equipo: string;
  competicion: string;
  /** «Datos hasta la J6 · jornada completa». */
  alcance: string;
  partidos: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  tabla: { puesto: number; de: number } | null;
  forma: { resultado: "G" | "E" | "P"; rival: string; marcador: string; casa: boolean }[];
  sistemas: { sistema: string; partidos: number }[];
  fases: { label: string; percentil: number | null }[];
  fuertes: { nombre: string; valor: string; puesto: number; de: number }[];
  flojos: { nombre: string; valor: string; puesto: number; de: number }[];
  estilo: { nombre: string; valor: string; mediana: string; puesto: number; de: number }[];
  frases: string[];
  /** Los que más rinden para su puesto, con lo que destacan. */
  figuras: { nombre: string; posicion: string; indice: number; minutos: number; destaca: string[] }[];
};

const apellidos = (lista: string[]) => lista.map((n) => apellido(n)).join(" y ");

/** «Dónde atacar»: los duelos en los que, con el balón nuestro, les sacamos ventaja. */
export function duelosParaAtacar(d: DuelosInforme | null, umbral = 10) {
  return (d?.lista ?? [])
    .filter((x) => (x.conBalon ?? 0) >= umbral)
    .sort((a, b) => (b.conBalon ?? 0) - (a.conBalon ?? 0));
}

/** «Qué vigilar»: los duelos en los que, con el balón suyo, nos sacan ventaja. */
export function duelosParaVigilar(d: DuelosInforme | null, umbral = 10) {
  return (d?.lista ?? [])
    .filter((x) => (x.sinBalon ?? 0) <= -umbral)
    .sort((a, b) => (a.sinBalon ?? 0) - (b.sinBalon ?? 0));
}

/** Dónde se juega cada duelo, dicho desde nuestro campo (las claves son las de `DUELOS`). */
export const LUGAR_DUELO: Record<string, string> = {
  "cen-del": "por dentro, ante nuestros centrales",
  "latd-bani": "nuestra banda derecha",
  "lati-band": "nuestra banda izquierda",
  "piv-media": "entre líneas, en nuestra medular",
  medio: "la medular",
  "media-piv": "entre líneas, en su medular",
  "band-lati": "nuestra banda derecha",
  "bani-latd": "nuestra banda izquierda",
  "del-cen": "por dentro, ante sus centrales",
};

/** Una línea de caseta para un duelo, por el lado que se pida. */
export function fraseDuelo(x: DueloJugadores, lado: "con" | "sin") {
  const clave = x.destacados.find((e) => e.sentido === lado && e.veredicto === (lado === "con" ? "ventaja" : "desventaja"));
  const quien = lado === "con" ? `${apellidos(x.nuestros)} ante ${apellidos(x.suyos)}` : `${apellidos(x.suyos)} ante ${apellidos(x.nuestros)}`;
  const donde = LUGAR_DUELO[x.clave] ?? x.titulo.replace(/^Nuestr[oa]s? /, "").replace(/ vs .*/, "");
  /* En palabras y no «P97 contra P32» (20/10/2026): el percentil contra su puesto, «97 frente a 32 de 100». */
  return `${quien} (${donde})${clave ? `: ${clave.titulo.toLowerCase()}, ${lado === "con" ? clave.nuestro : clave.suyo} frente a ${lado === "con" ? clave.suyo : clave.nuestro} de 100` : ""}`;
}

export type Sintesis = {
  /** Una frase que encabeza el resumen. */
  titular: string;
  /** Las 3-4 claves del partido (previa) o lo que nos deja (post). */
  claves: string[];
  /** Dónde estamos mejor y dónde están mejor ellos, con cifra. */
  ventajas: string[];
  amenazas: string[];
  /** Los 3 del rival a vigilar. */
  vigilar: JugadorRival[];
  /** Post: lo que dijo el partido en datos, frente a lo habitual. */
  partido: string[];
  /** Post: los goles que cambiaron el partido, en frases. */
  relato: string[];
  /** Post: qué hicieron en el partido los que había que vigilar. */
  frenados: { jugador: JugadorRival; texto: string; bien: boolean }[];
  /** Post: el pronóstico frente al resultado, en una frase. */
  veredicto: string;
  /**
   * La línea bajo el titular (20/10/2026). Previa: el pronóstico en una línea
   * («Victoria 50 % · empate 22 % · derrota 28 % · lo más probable, 1-1»).
   * Post: el hito que cambia la lectura («Contra diez desde el 57′…»). Vacía
   * si no hay dato.
   */
  subtitular: string;
  /**
   * Previa: «Cómo lo ganamos» en una línea por fase (con balón, sin balón,
   * transiciones, balón parado): verbo + quién + dónde + por qué, en ≤ 70
   * caracteres y sin «…». La fase sin dato no sale (20/10/2026).
   */
  plan: { fase: string; texto: string }[];
  /** Post: cada clave del plan con su veredicto y la métrica del partido que lo sostiene. */
  cumplimiento: FilaCumplimiento[];
  /** Post: «Qué toca en el microciclo», hasta tres contenidos sacados por reglas de lo ya medido. */
  microciclo: string[];
};

/** Una clave del plan, revisada con Wyscout: `null` = no hay métrica que la mida (no se inventa veredicto). */
export type FilaCumplimiento = { clave: string; tema: string; veredicto: "si" | "no" | "igual" | null; dato: string };

/**
 * La pincelada del informe de ABP del microciclo (la arma la pantalla de ABP,
 * incrustada: `lib/abp/informe-micro.ts` → `pinceladaAbp`). Misma forma.
 */
export type PinceladaAbp = {
  modo: "previa" | "post";
  titular: string;
  claves: string[];
  cifras: { rotulo: string; valor: string; pie?: string }[];
  rival: string[];
  /** Los minutos de ABP de la semana, los mismos del informe de ABP (`minutosAbp`, lib/abp/minutos.ts). */
  minutos?: { confirmados: number; propuestos: number; texto: string };
};

/**
 * Los minutos de ABP de la semana, UNA cifra para todo el informe
 * (20/10/2026): la del informe de ABP cuando ha llegado (cuenta campo, vídeo
 * y trabajo tras el entreno, y deja fuera los bocetos); si no, la del
 * registro de tareas. Antes salían 23′ en el resumen y 1 h 35′ en el de ABP.
 */
export function minutosAbpInforme(inf: { abp: InformePartido["abp"]; microciclo: Microciclo | null }) {
  const m = inf.abp?.pincelada?.minutos;

  if (m) return { minutos: Math.round(m.confirmados), texto: m.texto };

  const registro = inf.microciclo?.totales.abpMinutos ?? 0;

  return { minutos: registro, texto: "" };
}

/** «1 h 35′», «23′». */
export const minutosLegibles = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h ${String(Math.round(n % 60)).padStart(2, "0")}′` : `${Math.round(n)}′`);

/* ------------------------------------------------------------------ */
/*  FORMATO                                                            */
/* ------------------------------------------------------------------ */

const coma = (n: number, decimales = 1) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** Una cifra de Data con su unidad, como en la pantalla. */
export function cifra(valor: number | null | undefined, unidad: string) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";

  if (unidad === "porcentaje") return `${coma(valor)} %`;
  if (unidad === "entero") return String(Math.round(valor));
  if (unidad === "minutos") return `${coma(valor)}′`;

  return coma(valor, Math.abs(valor) >= 10 ? 1 : 2);
}

/** «1.º», «12.º». */
export const ordinal = (n: number) => `${n}.º`;

/** Primera letra en mayúscula y el resto como venga; «xG» se queda como está (no «XG»). */
const capital = (s: string) => (!s || /^x[A-Z]/.test(s) ? s : s.charAt(0).toUpperCase() + s.slice(1));

/** Un texto libre de la hoja partido en frases o líneas, sin vacíos. */
export function enFrases(texto: string | undefined, maximo = 6) {
  return (texto ?? "")
    .split(/\r?\n|•|·|;|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    /* Fuera las viñetas y la numeración («1.», «2)», «- »), pero no un dibujo:
       «1-4-4-2 / 1-4-3-3.» se quedaba en «/ 1-4-3-3.» (20/10/2026). */
    .map((t) => t.replace(/^(?:[-–—*•]\s*|\d{1,2}[.)](?![\d-])\s*)+/, "").trim())
    .filter((t) => t.length > 2)
    .slice(0, maximo);
}

/* ------------------------------------------------------------------ */
/*  LA SÍNTESIS                                                        */
/* ------------------------------------------------------------------ */

/*
| Lo que se considera ventaja o amenaza en datos: el percentil ya viene
| orientado («más es mejor» o al revés, según la métrica), así que la
| diferencia de percentiles dice quién lo lleva mejor y por cuánto.
*/
const UMBRAL_DIFERENCIA = 20;

/**
 * Una métrica con dato de verdad. Hay columnas de Wyscout que en esta liga
 * salen a cero para todos (los contraataques con remate, por ejemplo): un
 * «0,0 % · 13.º» no dice nada y en una diapositiva parece un error.
 */
export function conDato(m: MetricaDuelo) {
  const ceroLiga = (m.media ?? m.mediana ?? 0) === 0 && (m.mediana ?? 0) === 0;

  const ceroLosDos = (m.nosotros?.valor ?? 0) === 0 && (m.rival?.valor ?? 0) === 0;

  return !ceroLiga && !ceroLosDos;
}

function frasePuesto(m: MetricaDuelo, quien: "nosotros" | "rival", equipos: number) {
  const dato = m[quien];

  if (!dato) return "";

  return `${m.nombre}: ${cifra(dato.valor, m.unidad)} (${ordinal(dato.puesto)} de ${equipos})`;
}

/*
| EL CRUCE, ATAQUE CONTRA DEFENSA (20/10/2026).
|
| Antes se comparaba ataque con ataque: «xG por remate 0,15 (3.º) · ellos
| 20.º» enfrentaba nuestro remate con SU remate, que no se cruzan en el
| campo. Lo que se cruza es nuestro ataque con su defensa y su ataque con la
| nuestra. Cada pareja: la métrica de ataque de uno y la de defensa del otro;
| los percentiles ya vienen orientados (largo = mejor), así que la resta dice
| quién gana el cruce y por cuánto.
*/
const PAREJAS_CRUCE: { ataque: string; defensa: string }[] = [
  { ataque: "xg", defensa: "xgContra" },
  { ataque: "tiros", defensa: "tirosContra" },
  { ataque: "xgPorTiro", defensa: "xgContraPorTiro" },
];

export type Cruce = {
  /** Quién ataca en este cruce. */
  ataca: "nosotros" | "rival";
  ataque: MetricaDuelo;
  defensa: MetricaDuelo;
  /** + = gana el que ataca. */
  ventaja: number;
  texto: string;
};

export function crucesAtaqueDefensa(duelo: Duelo | null): Cruce[] {
  if (!duelo) return [];

  const m = (k: string) => duelo.metricas.find((x) => x.key === k && conDato(x));

  const salida: Cruce[] = [];

  for (const par of PAREJAS_CRUCE) {
    const at = m(par.ataque);
    const de = m(par.defensa);

    if (!at || !de) continue;

    for (const ataca of ["nosotros", "rival"] as const) {
      const defiende = ataca === "nosotros" ? "rival" : "nosotros";

      const a = at[ataca];
      const d = de[defiende];

      if (a?.percentil == null || d?.percentil == null) continue;

      const quienAt = ataca === "nosotros" ? "Nuestro" : "Su";
      const quienDe = ataca === "nosotros" ? "su" : "nuestro";

      /* «Nuestro xG 2,23 (4.º) contra su xG en contra 1,69 (14.º)». */
      const texto = `${quienAt} ${minusculaInicial(at.nombre)} ${cifra(a.valor, at.unidad)} (${ordinal(a.puesto)}) contra ${quienDe} ${minusculaInicial(de.nombre)} ${cifra(d.valor, de.unidad)} (${ordinal(d.puesto)})`;

      salida.push({ ataca, ataque: at, defensa: de, ventaja: a.percentil - d.percentil, texto });
    }
  }

  return salida;
}

/** «XG a favor» → «xG a favor»; «Remates en contra» → «remates en contra». Las siglas se respetan. */
function minusculaInicial(s: string) {
  return /^[A-Z]{2}/.test(s) || /^x[A-Z]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

export function ventajasYAmenazas(duelo: Duelo | null) {
  if (!duelo) return { ventajas: [] as string[], amenazas: [] as string[] };

  const comparables = duelo.metricas.filter(
    (m) => m.mejorAlto !== null && m.nosotros?.percentil != null && m.rival?.percentil != null && conDato(m),
  );

  const dif = (m: MetricaDuelo) => (m.nosotros?.percentil ?? 0) - (m.rival?.percentil ?? 0);

  /* Primero los cruces de verdad (nuestro ataque contra su defensa, su
     ataque contra la nuestra); luego, lo que uno hace mucho mejor que el otro. */
  const cruces = crucesAtaqueDefensa(duelo);

  /* Un cruce en el que nosotros defendemos y ellos atacan peor que nosotros
     defendemos también es ventaja nuestra. */
  /* Primero el cruce de nuestro ataque (es el que se entrena con balón), luego el resto, de más a menos claro. */
  const orden = (quien: Cruce["ataca"]) => (a: Cruce, b: Cruce) => Number(b.ataca === quien) - Number(a.ataca === quien) || Math.abs(b.ventaja) - Math.abs(a.ventaja);

  const aFavor = cruces.filter((c) => (c.ataca === "nosotros" ? c.ventaja : -c.ventaja) >= UMBRAL_DIFERENCIA).sort(orden("nosotros"));

  const enContra = cruces.filter((c) => (c.ataca === "rival" ? c.ventaja : -c.ventaja) >= UMBRAL_DIFERENCIA).sort(orden("rival"));

  const yaCruzadas = new Set(cruces.flatMap((c) => [c.ataque.key, c.defensa.key]));

  const ventajas = [
    ...aFavor.map((c) => c.texto),
    ...comparables
      .filter((m) => !yaCruzadas.has(m.key) && dif(m) >= UMBRAL_DIFERENCIA)
      .sort((a, b) => dif(b) - dif(a))
      .map((m) => `${frasePuesto(m, "nosotros", duelo.equipos)} · ellos ${ordinal(m.rival!.puesto)}`),
  ].slice(0, 3);

  /* «Dónde nos pueden hacer daño» sólo con lo que ellos hacen MEJOR que
     nosotros (20/10/2026): antes entraba lo que hacían muy bien en la liga
     aunque nosotros fuéramos mejores («pases en el último tercio: 3.º ·
     nosotros 2.º»), que no es una amenaza. */
  const amenazas = [
    ...enContra.map((c) => c.texto),
    ...comparables
      .filter((m) => !yaCruzadas.has(m.key) && -dif(m) >= UMBRAL_DIFERENCIA)
      .sort((a, b) => dif(a) - dif(b))
      .map((m) => `${frasePuesto(m, "rival", duelo.equipos)} · nosotros ${ordinal(m.nosotros!.puesto)}`),
  ].slice(0, 3);

  return { ventajas, amenazas };
}

/**
 * Las métricas en las que más se separan los dos (20/10/2026): son las que
 * van en la diapositiva 1 («Los dos en datos»), de 3 a 6. La tabla entera,
 * en el informe completo.
 */
export function metricasQueSeparan(duelo: Duelo | null, maximo = 6) {
  const todas = (duelo?.metricas ?? []).filter((m) => m.nosotros?.percentil != null && m.rival?.percentil != null && m.mejorAlto !== null && conDato(m));

  const dif = (m: MetricaDuelo) => Math.abs((m.nosotros!.percentil ?? 0) - (m.rival!.percentil ?? 0));

  const elegidas = new Set(
    [...todas]
      .sort((a, b) => dif(b) - dif(a))
      .slice(0, maximo)
      .map((m) => m.key),
  );

  /* En el orden de lectura de siempre (resultado, con balón, transiciones…). */
  return todas.filter((m) => elegidas.has(m.key));
}

/**
 * El sello de alcance (20/10/2026): hasta qué jornada llegan los datos y con
 * cuántos partidos de cada uno, igual en todas las piezas. Así «1,14» en el
 * post y «1,38» en la previa siguiente dicen de dónde sale cada uno.
 */
export function selloDatos(inf: { duelo: Duelo | null; vistazo: VistazoRival | null; partido: { jornada: number | null }; momento: Momento }) {
  const d = inf.duelo;

  if (!d) return "";

  const enVistazo = /J(\d+)/.exec(inf.vistazo?.alcance ?? "")?.[1];

  /* Las medias del duelo son de antes del partido: en la previa y en el
     post llegan hasta la jornada anterior a la del informe. */
  const jornada = inf.partido.jornada ? inf.partido.jornada - 1 : enVistazo ? Number(enVistazo) : null;

  const partidos = d.jugados.nosotros === d.jugados.rival ? `${d.jugados.nosotros} partidos de cada uno` : `${d.jugados.nosotros} partidos nuestros y ${d.jugados.rival} suyos`;

  return `Wyscout ${d.temporada}${jornada && jornada > 0 ? `, hasta la J${jornada} incluida` : ""} · ${partidos}`;
}

/** Los tres del rival que más pesan: goles + asistencias, minutos, y lo que diga la ficha. */
export function aVigilar(once: JugadorRival[], plantilla: JugadorRival[]) {
  /* Por ritmo y no por total (20/10/2026): dos goles en 217′ pesan más que dos
     en 700′. Con menos de 300′ el ritmo engaña, y se cuenta el total. */
  const ritmo = (j: JugadorRival) => ((j.goles ?? 0) + 0.6 * (j.asistencias ?? 0)) / Math.max(j.minutos ?? 0, 1) * 90;

  const peso = (j: JugadorRival) =>
    (j.minutos ?? 0) >= 300
      ? ritmo(j) * 9 + (j.minutos ?? 0) / 600 + j.rasgos.length * 0.5 + (j.fortalezas ? 1 : 0)
      : (j.goles ?? 0) * 3 + (j.asistencias ?? 0) * 2 + (j.minutos ?? 0) / 300 + j.rasgos.length * 0.5 + (j.fortalezas ? 1 : 0);

  const base = once.length ? once : plantilla;

  return [...base]
    .filter((j) => j.linea !== "POR")
    .sort((a, b) => peso(b) - peso(a))
    .slice(0, 3);
}

/** Post: las métricas del partido que más se separan de lo habitual. */
export function lecturaDelPartido(duelo: Duelo | null) {
  const p = duelo?.partido;

  if (!p) return [] as string[];

  const valor = (k: string) => p.metricas.find((x) => x.key === k)?.nuestro ?? null;

  /*
  | Destacados con base (20/10/2026). Antes ganaban siempre las cifras de
  | pocos casos: «córners con remate 50 % (+86 %)» era 1 remate en 2 córners.
  | Un porcentaje «con remate» sólo se destaca con 8 o más casos debajo; los
  | goles no se destacan (ya están en el marcador) y el desvío se da en la
  | cifra frente a la media, no en un % relativo que con medias bajas se
  | dispara («+163 %»).
  */
  const base: Record<string, string> = { cornersRemate: "corners", contrasRemate: "contras", ataquesPosRemate: "ataquesPos", abpRemate: "abp" };

  const conBase = (k: string) => {
    if (!(k in base)) return true;

    const n = valor(base[k]);

    return n !== null && n >= 8;
  };

  const desvios = p.metricas
    .filter((m) => m.nuestro !== null && m.media !== null && m.media !== 0 && m.mejorAlto !== null)
    .filter((m) => m.key !== "goles" && m.key !== "golesContra" && conBase(m.key))
    .map((m) => {
      const rel = ((m.nuestro! - m.media!) / Math.abs(m.media!)) * 100;

      const bueno = m.mejorAlto ? rel > 0 : rel < 0;

      return { m, rel, bueno };
    })
    .filter((x) => Math.abs(x.rel) >= 15)
    .sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel))
    .slice(0, 4);

  return desvios.map(({ m, bueno }) => `${capital(m.nombre)}: ${cifraPartido(m.nuestro!, m.unidad)} frente a ${cifra(m.media, m.unidad)} de media · ${bueno ? "mejor" : "peor"} de lo habitual`);
}

/** Una cifra de UN partido: los recuentos van sin decimales («0 contraataques», no «0,00»). */
function cifraPartido(valor: number, unidad: string) {
  return unidad !== "porcentaje" && Number.isInteger(valor) ? String(valor) : cifra(valor, unidad);
}

/* ------------------------------------------------------------------ */
/*  EL PRONÓSTICO                                                      */
/* ------------------------------------------------------------------ */

const poisson = (k: number, l: number) => {
  let f = 1;

  for (let i = 2; i <= k; i++) f *= i;

  return (Math.exp(-l) * l ** k) / f;
};

/** Victoria, empate y derrota con los goles esperados de cada uno. */
export function probabilidades(nos: number, ellos: number): Probabilidades {
  let victoria = 0;
  let empate = 0;
  let derrota = 0;

  let mejor = { p: -1, a: 0, b: 0 };

  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= 10; b++) {
      const pr = poisson(a, nos) * poisson(b, ellos);

      if (a > b) victoria += pr;
      else if (a === b) empate += pr;
      else derrota += pr;

      if (pr > mejor.p) mejor = { p: pr, a, b };
    }
  }

  const total = victoria + empate + derrota || 1;

  return {
    victoria: victoria / total,
    empate: empate / total,
    derrota: derrota / total,
    esperados: { nosotros: nos, rival: ellos },
    marcador: `${mejor.a}-${mejor.b}`,
  };
}

/** «36 %». */
export const pct = (x: number) => `${Math.round(x * 100)} %`;

/**
 * La primera frase que dice algo. Los textos de la hoja empiezan muchas veces
 * con un rótulo —«DEFENSA CR», «ATAQUE CP», «1. Estructura:»— que en una
 * diapositiva no significa nada: se salta todo lo que sea mayúsculas cortas o
 * acabe en dos puntos.
 */
export function fraseUtil(t: string | undefined, n = 110) {
  const rotulo = (f: string) => (f === f.toUpperCase() && f.split(/\s+/).length <= 4) || /:\s*$/.test(f) || f.length < 12;

  /* Sin la puntuación suelta del principio: la hoja daba «/ 1-4-3-3.» y la
     diapositiva lo pintaba tal cual (gazapo cazado el 20/10/2026). Lo que se
     queda en menos de cinco letras y no es un dibujo («1-4-4-2») no dice
     nada: fuera. */
  const frases = enFrases(t, 12)
    .map((x) => x.replace(/^[\s/·\-–—|,;:.]+/, "").trim())
    .filter((x) => (x.match(/\p{L}/gu)?.length ?? 0) >= 5 || /\d-\d-\d/.test(x));

  const f = capital(frases.find((x) => !rotulo(x)) ?? frases[0] ?? "");

  return f.length > n ? `${f.slice(0, n - 1).trimEnd()}…` : f;
}

const primeraFrase = fraseUtil;

/**
 * El pronóstico y las tres palancas.
 *
 * - Fuerza de cada uno: 70 % xG + 30 % goles (el xG es más estable con pocos
 *   partidos, los goles dicen si se convierte), entre la media de la liga.
 * - Con pocos partidos se acerca a la media: peso n / (n + 3).
 * - Campo: ±8 % a los goles esperados de cada uno.
 * - Palancas: −20 % a su xG (sin balón), +15 % al nuestro (con balón) y
 *   +0,12 goles a balón parado (un córner más con remate claro, más o menos).
 *   Son metas que un plan bien ejecutado consigue; cuánto vale cada una en
 *   victoria es lo que se mide.
 */
export function pronostica(inf: { duelo: Duelo | null; partido: { lado: "casa" | "fuera" | "" }; plan: Plan | null }): Pronostico | null {
  const d = inf.duelo;

  if (!d?.rival) return null;

  const m = (key: string) => d.metricas.find((x) => x.key === key);

  const xg = m("xg");
  const goles = m("goles");
  const xgC = m("xgContra");
  const golesC = m("golesContra");

  if (!xg?.nosotros || !xg.rival || !xgC?.nosotros || !xgC.rival) return null;

  const mediaXg = xg.media ?? xg.mediana ?? 1.3;
  const mediaGoles = goles?.media ?? goles?.mediana ?? mediaXg;

  const fuerza = (xgV: number, gV: number | undefined, n: number) => {
    const bruta = 0.7 * (xgV / mediaXg) + 0.3 * ((gV ?? xgV) / (gV === undefined ? mediaXg : mediaGoles));

    const peso = n / (n + 3);

    return 1 + peso * (bruta - 1);
  };

  const nNos = d.jugados.nosotros;
  const nRiv = d.jugados.rival;

  const ataqueNos = fuerza(xg.nosotros.valor, goles?.nosotros?.valor, nNos);
  const ataqueRiv = fuerza(xg.rival.valor, goles?.rival?.valor, nRiv);
  const defensaNos = fuerza(xgC.nosotros.valor, golesC?.nosotros?.valor, nNos);
  const defensaRiv = fuerza(xgC.rival.valor, golesC?.rival?.valor, nRiv);

  const campo = inf.partido.lado === "casa" ? 1.08 : inf.partido.lado === "fuera" ? 0.92 : 1;

  const lNos = mediaXg * ataqueNos * defensaRiv * campo;
  const lRiv = (mediaXg * ataqueRiv * defensaNos) / campo;

  const base = probabilidades(lNos, lRiv);

  /* Lo que justifica cada palanca, con dato. */
  const peorSuyo = (bloques: string[]) =>
    d.metricas
      .filter((x) => bloques.includes(x.bloque ?? "") && x.mejorAlto !== null && x.rival?.percentil != null && conDato(x))
      .sort((a, b) => (a.rival!.percentil ?? 0) - (b.rival!.percentil ?? 0))[0];

  const mejorSuyo = (bloques: string[]) =>
    d.metricas
      .filter((x) => bloques.includes(x.bloque ?? "") && x.mejorAlto !== null && x.rival?.percentil != null && conDato(x))
      .sort((a, b) => (b.rival!.percentil ?? 0) - (a.rival!.percentil ?? 0))[0];

  const dato = (x: MetricaDuelo | undefined, quien: "rival" | "nosotros") =>
    x && x[quien] ? `${x.nombre}: ${cifra(x[quien]!.valor, x.unidad)} (${ordinal(x[quien]!.puesto)} de ${d.equipos})` : "";

  const suFuerte = mejorSuyo(["Con balón", "Transiciones"]);
  const suDebil = peorSuyo(["Sin balón", "Transiciones"]);
  const abpNos = m("corners");
  const abpRem = m("abpRemate");

  const conSinBalon = probabilidades(lNos, lRiv * 0.8);
  const conConBalon = probabilidades(lNos * 1.15, lRiv);
  const conAbp = probabilidades(lNos + 0.12, lRiv);
  const conPlan = probabilidades(lNos * 1.15 + 0.12, lRiv * 0.8);

  const sube = (x: Probabilidades) => Math.round((x.victoria - base.victoria) * 100);

  const palancas: Palanca[] = [
    {
      momento: "Sin balón",
      objetivo: `Bajar su xG de ${cifra(lRiv, "decimal")} a ${cifra(lRiv * 0.8, "decimal")}`,
      porque: suFuerte ? `Su punto fuerte · ${dato(suFuerte, "rival")}` : "Es lo que más pesa en su ataque",
      plan: primeraFrase(inf.plan?.defensa),
      victoria: sube(conSinBalon),
      meta: lRiv * 0.8,
      revisa: "xgSuyo",
    },
    {
      momento: "Con balón",
      objetivo: `Subir nuestro xG de ${cifra(lNos, "decimal")} a ${cifra(lNos * 1.15, "decimal")}`,
      porque: suDebil ? `Por donde sufren · ${dato(suDebil, "rival")}` : "Generar más de lo que solemos contra ellos",
      plan: primeraFrase(inf.plan?.ataque),
      victoria: sube(conConBalon),
      meta: lNos * 1.15,
      revisa: "xgNuestro",
    },
    {
      momento: "Balón parado",
      objetivo: "Sumar 0,12 goles esperados a balón parado",
      porque: abpNos?.nosotros
        ? `Nuestro · ${dato(abpNos, "nosotros")}${abpRem?.nosotros ? ` · ${dato(abpRem, "nosotros")}` : ""}`
        : "Un córner más con remate claro",
      plan: primeraFrase(inf.plan?.abpOf || inf.plan?.abpDef),
      victoria: sube(conAbp),
      meta: 0.12,
      revisa: null,
    },
  ];

  const enMinuscula = (x: MetricaDuelo) => x.nombre.replace(/\s*%$/, "").replace(/^./, (c) => c.toLowerCase());

  const idea =
    suFuerte && suDebil
      ? `Quitarles ${enMinuscula(suFuerte)} (son ${ordinal(suFuerte.rival!.puesto)} de la liga) y hacerles daño donde sufren: ${enMinuscula(suDebil)} (${ordinal(suDebil.rival!.puesto)})`
      : suFuerte
        ? `Quitarles ${enMinuscula(suFuerte)}: son ${ordinal(suFuerte.rival!.puesto)} de la liga`
        : "";

  const dif = base.victoria - base.derrota;

  const tipo =
    dif > 0.2 ? "Partido para ganarlo" : dif > 0.07 ? "Partido de ligera ventaja" : dif > -0.07 ? "Partido igualado" : dif > -0.2 ? "Partido cuesta arriba" : "Partido de mucha exigencia";

  const lectura = `${tipo}: ${pct(base.victoria)} de victoria, ${pct(base.empate)} de empate y ${pct(base.derrota)} de derrota. Con el plan bien hecho, la victoria sube al ${pct(conPlan.victoria)}.`;

  const arma = (x: MetricaDuelo | undefined): ArmaMetrica | null =>
    x?.rival ? { key: x.key, nombre: x.nombre, valor: cifra(x.rival.valor, x.unidad), puesto: x.rival.puesto, de: d.equipos } : null;

  return {
    ...base,
    lectura,
    idea,
    palancas,
    conPlan,
    suFuerte: arma(suFuerte),
    suDebil: arma(suDebil),
    base: `xG y goles de la temporada antes del partido (${nNos} y ${nRiv} partidos) · ${campo === 1 ? "sin factor campo" : campo > 1 ? "en casa" : "fuera"}`,
  };
}

/**
 * Post: lo que daba el pronóstico frente a lo que pasó, cifra a cifra.
 *
 * Tres comparaciones: el resultado (cuánto se le daba al que salió), los goles
 * esperados contra los marcados y —cuando Wyscout tiene el partido— contra el
 * xG de verdad, que dice si el partido se pareció a lo previsto aunque el
 * marcador no lo hiciera.
 */
export function contrastePronostico(inf: { pronostico: Pronostico | null; duelo: Duelo | null; partido: InformePartido["partido"] }) {
  const pr = inf.pronostico;

  const p = inf.partido;

  if (!pr || !p.jugado || p.gf === null || p.gc === null) return [] as { rotulo: string; previsto: string; real: string; acierto: boolean | null }[];

  const resultado = p.gf > p.gc ? "victoria" : p.gf < p.gc ? "derrota" : "empate";

  const masProbable = pr.victoria >= pr.empate && pr.victoria >= pr.derrota ? "victoria" : pr.derrota >= pr.empate ? "derrota" : "empate";

  const xg = inf.duelo?.partido?.metricas.find((x) => x.key === "xg");

  /*
  | Sin ✗ de marcador, goles ni xG (20/10/2026): un modelo de goles esperados
  | no «acierta» un 3-2, y la tabla salía con cuatro aspas que no decían nada.
  | Queda si se dio lo más probable y, con Wyscout, la lectura del xG
  | previsto frente al real, sin veredicto.
  */
  const filas: { rotulo: string; previsto: string; real: string; acierto: boolean | null }[] = [
    { rotulo: "Lo más probable", previsto: `${masProbable} (${pct(pr[masProbable])})`, real: `${resultado} ${p.gf}-${p.gc}`, acierto: masProbable === resultado },
    /* Sin el xG de Wyscout la fila no sale: el informe no dice lo que
       falta (antes, «pendiente de Wyscout»; 19/10/2026). */
    ...(xg?.nuestro != null && xg?.suyo != null
      ? [
          {
            rotulo: "Goles esperados",
            previsto: `${cifra(pr.esperados.nosotros, "decimal")} – ${cifra(pr.esperados.rival, "decimal")}`,
            real: `${cifra(xg.nuestro, "decimal")} – ${cifra(xg.suyo, "decimal")}`,
            acierto: null,
          },
        ]
      : []),
  ];

  return filas;
}

/** «la victoria», «el empate», «la derrota». */
const conArticulo = (r: "victoria" | "empate" | "derrota") => (r === "empate" ? "el empate" : `la ${r}`);

/**
 * Post: la lectura del xG previsto frente al real, en una frase y sin
 * veredicto (20/10/2026): «Generamos más y concedimos menos de lo previsto:
 * 3,46 frente a 1,71 a favor y 0,75 frente a 1,63 en contra».
 */
export function lecturaXg(inf: { pronostico: Pronostico | null; duelo: Duelo | null }) {
  const pr = inf.pronostico;

  const xg = inf.duelo?.partido?.metricas.find((x) => x.key === "xg");

  if (!pr || xg?.nuestro == null || xg?.suyo == null) return "";

  const a = xg.nuestro - pr.esperados.nosotros;
  const c = xg.suyo - pr.esperados.rival;

  const cuanto = (x: number) => (x >= 0.4 ? "más" : x <= -0.4 ? "menos" : "");

  const g = cuanto(a);
  const k = cuanto(c);

  const lectura =
    g && k
      ? `Generamos ${g} y concedimos ${k} de lo previsto`
      : g
        ? `Generamos ${g} de lo previsto y concedimos lo esperado`
        : k
          ? `Generamos lo esperado y concedimos ${k} de lo previsto`
          : "El partido fue el previsto";

  return `${lectura}: ${cifra(xg.nuestro, "decimal")} goles esperados frente a ${cifra(pr.esperados.nosotros, "decimal")} a favor, ${cifra(xg.suyo, "decimal")} frente a ${cifra(pr.esperados.rival, "decimal")} en contra`;
}

/** Post: cada palanca, su meta y lo que pasó (si Wyscout ya tiene el partido). */
export function revisaPalancas(inf: { pronostico: Pronostico | null; duelo: Duelo | null }) {
  const pr = inf.pronostico;

  if (!pr) return [] as { momento: string; meta: string; real: string; cumplida: boolean | null }[];

  const xg = inf.duelo?.partido?.metricas.find((x) => x.key === "xg");

  /* La palanca que se mide con el xG y aún no lo tiene no sale: el informe
     no dice «pendiente de Wyscout» (19/10/2026). */
  const medibles = pr.palancas.filter((p) => {
    if (!p.revisa) return true;

    return (p.revisa === "xgSuyo" ? xg?.suyo : xg?.nuestro) != null;
  });

  return medibles.map((p) => {
    const real = p.revisa === "xgSuyo" ? (xg?.suyo ?? null) : p.revisa === "xgNuestro" ? (xg?.nuestro ?? null) : null;

    const cumplida = real === null ? null : p.revisa === "xgSuyo" ? real <= p.meta : real >= p.meta;

    return {
      momento: p.momento,
      meta: p.revisa === "xgSuyo" ? `su xG ≤ ${cifra(p.meta, "decimal")}` : p.revisa === "xgNuestro" ? `nuestro xG ≥ ${cifra(p.meta, "decimal")}` : "+0,12 goles esperados",
      real:
        real !== null
          ? `${cifra(real, "decimal")} en el partido`
          : p.revisa
            ? "pendiente de Wyscout (los martes)"
            : "ver el informe de balón parado",
      cumplida,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  EL POST: EL PARTIDO CONTADO                                        */
/* ------------------------------------------------------------------ */

const plano = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

/**
 * El mismo jugador escrito de dos maneras: «R. HUESO» y «Rubén Hueso», o
 * «THIAGO HELGUERA MERELLO VOLANTE» y «Thiago Helguera». Basta con que el
 * apellido de uno esté en el otro.
 */
export function mismoJugador(a: string, b: string) {
  const x = plano(a);
  const y = plano(b);

  if (!x.length || !y.length) return false;

  const apellidoX = x[x.length - 1];
  const apellidoY = y[y.length - 1];

  return y.includes(apellidoX) || x.includes(apellidoY) || (x.length > 1 && y.includes(x[1]) && y.includes(x[0]));
}

/** El apellido, para las frases: «Carvajal». */
export const apellido = (nombre: string) => {
  const partes = nombre.trim().split(/\s+/);

  const ultimo = partes[partes.length - 1] ?? "";

  return ultimo.charAt(0).toUpperCase() + ultimo.slice(1).toLowerCase();
};

/**
 * Los goles que cambiaron el partido, contados como en el vestuario: quién
 * marcó primero, los empates, quién se puso por delante y el que lo cerró.
 * El marcador va siempre desde nuestro lado (nosotros-ellos).
 */
/*
| EL RELATO, GOL A GOL (20/10/2026).
|
| Antes se saltaba goles (el 3-1 de Ciria no salía) y se equivocaba de
| sujeto: «Lo cerraron 3-2 (90+1′, Destiny)» cuando quien lo había cerrado
| éramos nosotros y ellos sólo recortaron. Ahora va una línea por gol, con el
| minuto delante y la plantilla según el estado del marcador:
|
|   recibir el primero → «Nos marcaron primero»;  igualar → «Empatamos»;
|   pasar a ganar tras ir perdiendo → «Le dimos la vuelta»;  ampliar →
|   «Ampliamos»;  gol suyo con el partido ganado → «Recortaron»…
|
| Entre los goles, los hitos que cambian la lectura (BeSoccer): su
| expulsión con el marcador de ese momento y la tanda de cambios de tres o
| más; si luego marca uno que entró en esa tanda, se dice en su gol.
*/
const minutoNum = (m: string) => {
  const [base, extra] = m.split("+").map((x) => Number.parseInt(x, 10) || 0);

  return base + (extra ?? 0) / 100;
};

/** El estado del marcador gol a gol, desde nuestro lado. */
function marcadorPorGoles(goles: GolCronica[]) {
  let nos = 0;
  let ellos = 0;

  let fuimosPerdiendo = false;
  let fuimosGanando = false;

  return goles.map((g) => {
    const antes = { nos, ellos };

    if (g.nuestro) nos++;
    else ellos++;

    const tras = { nos, ellos, fuimosPerdiendo, fuimosGanando };

    if (nos < ellos) fuimosPerdiendo = true;
    if (nos > ellos) fuimosGanando = true;

    return { g, antes, tras };
  });
}

export function relatoDeGoles(goles: GolCronica[], cronica?: Pick<Cronica, "tarjetas" | "cambios"> | null) {
  const lineas: { min: number; texto: string }[] = [];

  /* La tanda de cambios suya (3 o más en el mismo minuto): quién entró en ella. */
  const porMinuto = new Map<string, Cronica["cambios"]>();

  for (const c of cronica?.cambios ?? []) porMinuto.set(c.minuto, [...(porMinuto.get(c.minuto) ?? []), c]);

  const tanda = [...porMinuto].find(([, l]) => l.length >= 3) ?? null;

  const entroEnTanda = (g: GolCronica) => !g.nuestro && g.tipo !== "propia" && tanda?.[1].some((c) => mismoJugador(c.entra, g.jugador));

  marcadorPorGoles(goles).forEach(({ g, antes, tras }, i) => {
    const { nos, ellos } = tras;

    const marcador = `${nos}-${ellos}`;

    const descanso = minutoNum(g.minuto) >= 40 && minutoNum(g.minuto) < 46 ? " antes del descanso" : "";

    let frase: string;

    if (g.nuestro) {
      if (i === 0) frase = "Marcamos primero";
      else if (nos === ellos) frase = `Empatamos ${marcador}${descanso}`;
      else if (nos === ellos + 1 && antes.nos === antes.ellos) frase = tras.fuimosPerdiendo ? `Le dimos la vuelta: ${marcador}` : `Nos pusimos por delante: ${marcador}`;
      else if (nos > ellos) frase = `Ampliamos: ${marcador}`;
      else frase = `Recortamos: ${marcador}`;
    } else {
      if (i === 0) frase = "Nos marcaron primero";
      else if (nos === ellos) frase = `Nos empataron ${marcador}${descanso}`;
      else if (ellos === nos + 1 && antes.nos === antes.ellos) frase = tras.fuimosGanando ? `Nos dieron la vuelta: ${marcador}` : `Se pusieron por delante: ${marcador}`;
      else if (ellos > nos) frase = `Ampliaron: ${marcador}`;
      else frase = `Recortaron: ${marcador}`;
    }

    const quien = g.tipo === "propia" ? `en propia, ${apellido(g.jugador)}` : `${apellido(g.jugador)}${g.tipo === "penalti" ? ", de penalti" : ""}${entroEnTanda(g) ? `, que entró en el ${tanda![0]}′` : ""}`;

    lineas.push({ min: minutoNum(g.minuto), texto: `${g.minuto}′ · ${frase} (${quien})` });
  });

  /* Su roja: desde ese minuto jugamos con uno más, y el marcador de ese momento. */
  const marcadorEn = (min: number) => {
    const antes = goles.filter((g) => minutoNum(g.minuto) <= min);

    return `${antes.filter((g) => g.nuestro).length}-${antes.filter((g) => !g.nuestro).length}`;
  };

  for (const t of (cronica?.tarjetas ?? []).filter((x) => x.tipo === "roja")) {
    lineas.push({ min: minutoNum(t.minuto) + 0.001, texto: `${t.minuto}′ · Jugamos contra diez (roja a ${apellido(t.jugador)}), con ${marcadorEn(minutoNum(t.minuto))}` });
  }

  /* La tanda sólo se nombra si alguien de ella marcó: si no, no cambia la lectura. */
  if (tanda && goles.some(entroEnTanda)) {
    lineas.push({ min: minutoNum(tanda[0]) + 0.002, texto: `${tanda[0]}′ · Ellos cambian ${tanda[1].length === 3 ? "tres" : tanda[1].length === 4 ? "cuatro" : tanda[1].length} de golpe` });
  }

  return lineas.sort((a, b) => a.min - b.min).map((l) => l.texto);
}

/** El giro del partido, para el titular y el asunto (20/10/2026). */
export function giroDelPartido(inf: { partido: InformePartido["partido"]; cronica: Cronica | null; duelo: Duelo | null }) {
  const p = inf.partido;

  if (!p.jugado || p.gf === null || p.gc === null) return null;

  const resultado = p.gf > p.gc ? "victoria" : p.gf < p.gc ? "derrota" : "empate";

  const goles = inf.cronica?.goles ?? [];

  const pasos = marcadorPorGoles(goles);

  const fuimosPerdiendo = pasos.some((x) => x.tras.nos < x.tras.ellos);
  const fuimosGanando = pasos.some((x) => x.tras.nos > x.tras.ellos);

  /* Gol suyo en los últimos diez minutos con el partido ganado: se sufrió. */
  const sufrida = resultado === "victoria" && p.gf - p.gc === 1 && pasos.some((x) => !x.g.nuestro && minutoNum(x.g.minuto) >= 80 && x.antes.nos > x.antes.ellos);

  const verbo =
    resultado === "victoria"
      ? fuimosPerdiendo
        ? "Remontamos"
        : sufrida
          ? "Ganamos sufriendo"
          : "Ganamos"
      : resultado === "empate"
        ? fuimosPerdiendo
          ? "Rescatamos un empate"
          : fuimosGanando
            ? "Se nos escapó la victoria"
            : "Empatamos"
        : fuimosGanando
          ? "Se nos escapó"
          : "Perdimos";

  const xg = inf.duelo?.partido?.metricas.find((x) => x.key === "xg");

  const xgNos = xg?.nuestro ?? null;
  const xgSuyo = xg?.suyo ?? null;

  const dominio = xgNos !== null && xgSuyo !== null ? (xgNos >= 1.2 && xgNos >= 2 * xgSuyo ? "nuestro" : xgSuyo >= 1.2 && xgSuyo >= 2 * xgNos ? "suyo" : null) : null;

  return { resultado, verbo, fuimosPerdiendo, fuimosGanando, sufrida, dominio, xgNos, xgSuyo };
}

/** Qué hicieron en el partido los que había que vigilar. */
export function frenadosEn(vigilar: JugadorRival[], cronica: Cronica | null) {
  if (!cronica) return [] as Sintesis["frenados"];

  return vigilar.map((j) => {
    const suyos = cronica.goles.filter((g) => !g.nuestro && g.tipo !== "propia");

    const marco = suyos.filter((g) => mismoJugador(j.nombre, g.jugador)).map((g) => `${g.minuto}′`);

    const asistio = suyos.filter((g) => g.asistente && mismoJugador(j.nombre, g.asistente)).map((g) => `${g.minuto}′`);

    const titular = cronica.onceReal.some((r) => r.clave === j.clave || mismoJugador(j.nombre, r.nombre));

    const entro = cronica.cambios.some((c) => mismoJugador(j.nombre, c.entra));

    if (marco.length || asistio.length) {
      return {
        jugador: j,
        bien: false,
        texto: [marco.length ? `marcó (${marco.join(", ")})` : "", asistio.length ? `dio una asistencia (${asistio.join(", ")})` : ""].filter(Boolean).join(" y "),
      };
    }

    return {
      jugador: j,
      bien: true,
      texto: titular ? "sin gol ni asistencia" : entro ? "salió desde el banquillo, sin gol ni asistencia" : "no fue titular",
    };
  });
}

/* ------------------------------------------------------------------ */
/*  LO QUE HACEMOS: EL PLAN POR FASES, EL PLAN A REVISIÓN Y QUÉ TOCA   */
/*  (20/10/2026, plan de mejora de los informes)                       */
/* ------------------------------------------------------------------ */

/** Una línea de diapositiva cabe en esto: lo que pasa se rehace más corto, nunca con «…». */
const TOPE_LINEA = 70;

const primeraQueQuepa = (...opciones: string[]) => opciones.find((o) => o && o.length <= TOPE_LINEA) ?? "";

/** «Pases en el último tercio» → «pases en el último tercio»; sin el «%» del final. */
const nombreEnFrase = (nombre: string) => minusculaInicial(nombre.replace(/\s*%$/, ""));

/** Dónde se juega el duelo cuando atacamos nosotros (con balón) y cuando atacan ellos (sin balón). */
const LUGAR_ATAQUE: Record<string, string> = {
  "cen-del": "por dentro",
  "latd-bani": "por la derecha",
  "lati-band": "por la izquierda",
  "piv-media": "entre líneas",
  medio: "por la medular",
  "media-piv": "entre líneas",
  "band-lati": "por la derecha",
  "bani-latd": "por la izquierda",
  "del-cen": "por dentro",
};

const LUGAR_DEFENSA: Record<string, string> = {
  "cen-del": "por dentro",
  "latd-bani": "por nuestra derecha",
  "lati-band": "por nuestra izquierda",
  "piv-media": "entre líneas",
  medio: "en la medular",
  "media-piv": "entre líneas",
  "band-lati": "por nuestra derecha",
  "bani-latd": "por nuestra izquierda",
  "del-cen": "por dentro",
};

/**
 * Un duelo cuenta sólo si sus jugadores están en el once que esperamos
 * (20/10/2026): salía Aviles, que no estaba en su once probable.
 */
export function dueloEnSuOnce(x: DueloJugadores, once: JugadorRival[]) {
  if (!once.length) return true;

  return x.suyos.every((s) => once.some((j) => mismoJugador(j.nombre, s)));
}

/** «Cómo lo ganamos» de la previa, una línea por fase. */
export function planPorFases(inf: Omit<InformePartido, "sintesis">): { fase: string; texto: string }[] {
  const once = inf.once.jugadores;

  const enOnce = (x: DueloJugadores) => dueloEnSuOnce(x, once);

  const pr = inf.pronostico;

  const lineas: { fase: string; texto: string }[] = [];

  /* CON BALÓN · el duelo que más ganamos con el balón; si no, donde más sufren. */
  const atacar = duelosParaAtacar(inf.duelosJugadores).filter(enOnce)[0];

  if (atacar) {
    const clave = atacar.destacados.find((e) => e.sentido === "con" && e.veredicto === "ventaja");
    const quien = apellidos(atacar.nuestros);
    const lugar = LUGAR_ATAQUE[atacar.clave] ?? "";
    const razon = clave ? `${clave.nuestro >= 90 ? "de los mejores en" : "mejor en"} ${clave.titulo.toLowerCase()}` : "";

    lineas.push({
      fase: "Con balón",
      texto: primeraQueQuepa(razon ? `Atacamos ${lugar} con ${quien}: ${razon}` : "", `Atacamos ${lugar} con ${quien}`, `Buscamos a ${quien} ${lugar}`),
    });
  } else if (pr?.suDebil) {
    lineas.push({
      fase: "Con balón",
      texto: primeraQueQuepa(`Atacamos donde sufren: ${nombreEnFrase(pr.suDebil.nombre)} (${ordinal(pr.suDebil.puesto)} de ${pr.suDebil.de})`, `Atacamos donde sufren: ${nombreEnFrase(pr.suDebil.nombre)}`),
    });
  }

  /* SIN BALÓN · el duelo en el que más nos pueden hacer daño; si no, su arma. */
  const vigilar = duelosParaVigilar(inf.duelosJugadores).filter(enOnce)[0];

  if (vigilar) {
    const clave = vigilar.destacados.find((e) => e.sentido === "sin" && e.veredicto === "desventaja");
    const quien = apellidos(vigilar.suyos);
    const lugar = LUGAR_DEFENSA[vigilar.clave] ?? "";
    const fuertes = vigilar.suyos.length > 1 ? "fuertes" : "fuerte";

    lineas.push({
      fase: "Sin balón",
      texto: primeraQueQuepa(
        clave ? `Vigilamos a ${quien} ${lugar}: ${fuertes} en ${clave.titulo.toLowerCase()}` : "",
        clave ? `Vigilamos a ${quien} ${lugar}: ${clave.titulo.toLowerCase()}` : "",
        `Vigilamos a ${quien} ${lugar}`,
      ),
    });
  } else if (pr?.suFuerte) {
    lineas.push({
      fase: "Sin balón",
      texto: primeraQueQuepa(`Les quitamos ${nombreEnFrase(pr.suFuerte.nombre)}: son ${ordinal(pr.suFuerte.puesto)} de ${pr.suFuerte.de}`, `Les quitamos ${nombreEnFrase(pr.suFuerte.nombre)}`),
    });
  }

  /* TRANSICIONES · la métrica de transición en la que más se separan. */
  const d = inf.duelo;

  const transicion = (d?.metricas ?? [])
    .filter((m) => m.bloque === "Transiciones" && m.mejorAlto !== null && m.nosotros?.percentil != null && m.rival?.percentil != null && conDato(m))
    .map((m) => ({ m, dif: (m.nosotros!.percentil ?? 0) - (m.rival!.percentil ?? 0) }))
    .filter((x) => Math.abs(x.dif) >= 15)
    .sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))[0];

  if (transicion && d) {
    const { m, dif } = transicion;
    const nos = `${ordinal(m.nosotros!.puesto)} de ${d.equipos}`;
    const ellos = `${ordinal(m.rival!.puesto)} de ${d.equipos}`;

    const frases: Record<string, [string, string]> = {
      recuperacionesAltas: [`Robamos arriba: somos ${nos} en recuperaciones altas`, `Salida limpia: ellos roban arriba (${ellos})`],
      contras: [`Salimos rápido al robar: ${nos} en contraataques`, `Vigilamos su contraataque: son ${ellos}`],
      contrasRemate: [`Salimos rápido al robar: ${nos} en contraataques con remate`, `Vigilamos su contraataque: son ${ellos}`],
      perdidasBajas: [`Les apretamos la salida: pierden balones atrás (${ellos})`, `Salida segura: perdemos balones atrás (${nos})`],
    };

    const [aFavor, enContra] = frases[m.key] ?? [`Ganamos la transición: ${nombreEnFrase(m.nombre)}, ${nos}`, `Cuidado en la transición: ${nombreEnFrase(m.nombre)}, ellos ${ellos}`];

    lineas.push({ fase: "Transiciones", texto: primeraQueQuepa(dif > 0 ? aFavor : enContra) });
  }

  /* BALÓN PARADO · sus rematadores (ficha de Plantillas); si no, nuestro córner. */
  const aereo = /rematador|a[eé]re|cabeza/i;

  const rematadores = (once.length ? once : inf.plantilla).filter((j) => j.linea !== "POR" && j.rasgos.some((r) => aereo.test(r))).slice(0, 2);

  const corners = d?.metricas.find((m) => m.key === "corners" && conDato(m));

  if (rematadores.length) {
    const rasgo = rematadores[0].rasgos.find((r) => aereo.test(r)) ?? "";

    lineas.push({
      fase: "Balón parado",
      texto: primeraQueQuepa(
        `Marcamos a ${apellidos(rematadores.map((j) => j.nombre))} en su balón parado: ${minusculaInicial(rasgo)}`,
        `Marcamos a ${apellidos(rematadores.map((j) => j.nombre))} en su balón parado`,
        `Marcamos a ${apellido(rematadores[0].nombre)} en su balón parado`,
      ),
    });
  } else if (corners?.nosotros && (corners.nosotros.percentil ?? 0) >= 70 && d) {
    lineas.push({ fase: "Balón parado", texto: primeraQueQuepa(`Buscamos el córner: sacamos ${cifra(corners.nosotros.valor, corners.unidad)} por partido (${ordinal(corners.nosotros.puesto)})`) });
  }

  return lineas.filter((l) => l.texto);
}

/*
| EL PLAN, A REVISIÓN (post). Cada clave del plan se casa con una o dos
| métricas del partido por sus palabras: «posesión» → posesión y pases en el
| último tercio; «transición» → contraataques y recuperaciones altas… Si no
| casa con ninguna, la fila va sin veredicto: no se inventa.
*/
const TEMAS_PLAN: { tema: string; re: RegExp; metricas: string[] }[] = [
  { tema: "Balón parado", re: /bal[oó]n parado|\babp\b|c[oó]rner/i, metricas: ["corners", "cornersRemate"] },
  { tema: "Transición", re: /transici|contraata|tras robo|al robar/i, metricas: ["contras", "recuperacionesAltas"] },
  { tema: "Sin balón", re: /sin bal[oó]n|defens|presi[oó]n|bloque|replieg|someter/i, metricas: ["xgContra", "tirosContra"] },
  { tema: "Posesión", re: /posesi[oó]n|dominio|control|asociativ|elabora|circulaci/i, metricas: ["posesion", "pasesUltimoTercio"] },
  { tema: "Llegada y remate", re: /[aá]rea|finaliz|remat|ocasi|\bgol/i, metricas: ["xg", "tiros"] },
  { tema: "Juego por fuera", re: /centro|banda|exterior|carril/i, metricas: ["centros", "entradasArea"] },
  { tema: "Progresión", re: /progres|vertical|profund|romper l[ií]neas/i, metricas: ["pasesProgresivos", "pasesUltimoTercio"] },
];

type MetricaPartido = NonNullable<Duelo["partido"]>["metricas"][number];

/** «contraataques 0 frente a 0,71 de media». */
const datoFrenteAMedia = (m: MetricaPartido) => `${nombreEnFrase(m.nombre)} ${cifraPartido(m.nuestro!, m.unidad)} frente a ${cifra(m.media, m.unidad)} de media`;

/** ¿Mejor, peor o igual que nuestra media? Con un 5 % de margen. */
function frenteAMedia(m: MetricaPartido): "si" | "no" | "igual" {
  const media = m.media ?? 0;

  const rel = media === 0 ? (m.nuestro ?? 0) - media : ((m.nuestro ?? 0) - media) / Math.abs(media);

  if (Math.abs(rel) < 0.05) return "igual";

  return (m.mejorAlto ? rel > 0 : rel < 0) ? "si" : "no";
}

export function cumplimientoPlan(inf: { plan: Plan | null; duelo: Duelo | null }): FilaCumplimiento[] {
  const claves = inf.plan?.claves ?? [];

  const metricas = inf.duelo?.partido?.metricas ?? [];

  return claves.map((clave) => {
    const tema = TEMAS_PLAN.find((t) => t.re.test(clave));

    const medibles = (tema?.metricas ?? [])
      .map((k) => metricas.find((m) => m.key === k))
      .filter((m): m is MetricaPartido => Boolean(m && m.nuestro !== null && m.media !== null && m.mejorAlto !== null));

    if (!tema || !medibles.length) return { clave, tema: tema?.tema ?? "", veredicto: null, dato: "" };

    return {
      clave,
      tema: tema.tema,
      veredicto: frenteAMedia(medibles[0]),
      dato: capital(medibles.slice(0, 2).map(datoFrenteAMedia).join(" · ")),
    };
  });
}

/**
 * «Qué toca en el microciclo» (post, 20/10/2026). Sustituye a «Dónde hay que
 * crecer», que repetía métricas de la temporada que no salían del partido.
 * Tres contenidos, por reglas, con lo ya medido: la clave del plan que no se
 * cumplió, la palanca que no se movió, el gol encajado con el partido
 * ganado al final y el duelo de riesgo que se confirmó (marcó o asistió).
 */
export function queTocaEnElMicro(inf: Omit<InformePartido, "sintesis">, cumplimiento: FilaCumplimiento[]) {
  const salida: string[] = [];

  for (const f of cumplimiento.filter((x) => x.veredicto === "no")) {
    const primero = f.dato.split(" · ")[0];

    salida.push(`${f.tema} · no salió (${minusculaInicial(primero)})`);
  }

  for (const x of revisaPalancas(inf).filter((r) => r.cumplida === false)) {
    salida.push(`${x.momento} · la meta era ${x.meta} y se quedó en ${x.real.replace(/ en el partido$/, "")}`);
  }

  /* Un gol suyo en los últimos diez minutos con el partido a favor. */
  const goles = inf.cronica?.goles ?? [];

  const roja = (inf.cronica?.tarjetas ?? []).find((t) => t.tipo === "roja");

  const tarde = marcadorPorGoles(goles).find((x) => !x.g.nuestro && minutoNum(x.g.minuto) >= 80 && x.antes.nos > x.antes.ellos);

  if (tarde) {
    const unoMas = roja && minutoNum(roja.minuto) < minutoNum(tarde.g.minuto);

    salida.push(`Cierre de partido · nos marcaron en el ${tarde.g.minuto}′ con ${tarde.antes.nos}-${tarde.antes.ellos}${unoMas ? " y uno más" : ""}`);
  }

  /* El duelo de riesgo que se confirmó: alguno de ellos marcó o asistió. */
  const suyos = goles.filter((g) => !g.nuestro && g.tipo !== "propia");

  for (const x of duelosParaVigilar(inf.duelosJugadores).filter((v) => dueloEnSuOnce(v, inf.once.jugadores))) {
    const golDe = suyos.find((g) => x.suyos.some((s) => mismoJugador(s, g.jugador)));
    const asistencia = suyos.find((g) => g.asistente && x.suyos.some((s) => mismoJugador(s, g.asistente)));

    const hecho = golDe ? `marcó ${apellido(golDe.jugador)} (${golDe.minuto}′)` : asistencia ? `asistió ${apellido(asistencia.asistente)} (${asistencia.minuto}′)` : "";

    if (hecho) {
      salida.push(`${`Defensa ${LUGAR_DEFENSA[x.clave] ?? ""}`.trim()} · ${hecho}, como temíamos`);

      break;
    }
  }

  return salida.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/*  TITULARES, ASUNTO, PREENCABEZADO Y WHATSAPP (20/10/2026)           */
/* ------------------------------------------------------------------ */

/** «dom 16:30» (o «dom 25» si no hay hora), en hora de Madrid. */
export function cuandoCorto(cuando: string) {
  if (!cuando) return "";

  const d = new Date(cuando);

  if (Number.isNaN(d.getTime())) return "";

  const conHora = /T\d{2}:\d{2}/.test(cuando);

  const partes = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);

  const de = (t: string) => partes.find((p) => p.type === t)?.value ?? "";

  const dia = de("weekday").replace(/\.$/, "");

  return conHora ? `${dia} ${de("hour")}:${de("minute")}` : `${dia} ${de("day")}`;
}

/** El titular del post según el giro del partido. */
function titularPost(inf: Omit<InformePartido, "sintesis">) {
  const giro = giroDelPartido(inf);

  const p = inf.partido;

  const rival = p.rival || "el rival";

  if (!giro) return `Post partido ante el ${rival}`;

  const xg = giro.xgNos !== null && giro.xgSuyo !== null ? `${cifra(giro.xgNos, "decimal")} goles esperados contra ${cifra(giro.xgSuyo, "decimal")}` : "";

  if (giro.dominio === "nuestro") {
    if (giro.resultado !== "victoria") return `Dominamos y no ganamos (${p.gf}-${p.gc}): ${xg}`;

    return giro.sufrida && !giro.fuimosPerdiendo ? `Dominamos y sufrimos al final (${p.gf}-${p.gc}): ${xg}` : `${giro.verbo} y dominamos: ${xg}`;
  }

  if (giro.dominio === "suyo" && giro.resultado !== "derrota") return `${giro.verbo} (${p.gf}-${p.gc}) aunque ellos generaron más: ${xg}`;

  return `${giro.verbo} ${p.gf}-${p.gc} ante el ${rival}`;
}

/** El asunto de cada correo, con dato (20/10/2026). Sin dato, el de siempre. */
export function asuntoInforme(inf: InformePartido, tipo: "resumen" | "completo") {
  const p = inf.partido;

  const rival = p.rival || "el rival";

  const j = p.jornada ? `J${p.jornada} ` : "";

  const esPost = inf.momento === "post";

  if (tipo === "completo") {
    const partes = esPost
      ? [inf.duelo?.partido ? "el partido en datos" : "", inf.cronica?.onceReal.length ? "su once" : "", inf.plan?.claves.length ? "el plan a revisión" : "", inf.duelosJugadores ? "los duelos" : ""]
      : [inf.duelosJugadores ? "duelos" : "", inf.once.jugadores.length ? (inf.once.fuente === "marcado" ? "su once probable" : "su último once") : "", inf.colectivo ? "cómo juegan" : "", inf.abp ? "balón parado" : ""];

    const lista = partes.filter(Boolean).slice(0, 3);

    const y = lista.length > 1 ? `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}` : lista[0] ?? "";

    return `Consulta · ${j}${rival}${y ? `: ${y}` : ""}`;
  }

  if (esPost) {
    const giro = giroDelPartido(inf);

    if (!giro) return `Post · ${j}${rival}`;

    const prep = giro.resultado === "victoria" ? "al" : "ante el";

    const xg = giro.xgNos !== null && giro.xgSuyo !== null ? `xG ${cifra(giro.xgNos, "decimal")} a ${cifra(giro.xgSuyo, "decimal")}` : "";

    const idea =
      giro.dominio === "nuestro"
        ? `: dominio claro (${xg})`
        : giro.dominio === "suyo"
          ? `: ellos generaron más (${xg})`
          : giro.sufrida
            ? `: sufrimos al final${xg ? ` (${xg})` : ""}`
            : xg
              ? ` (${xg})`
              : "";

    const encajados = giro.resultado === "victoria" && (p.gc ?? 0) >= 2 ? `, pero encajamos ${p.gc}` : "";

    return `${j}· ${giro.verbo} ${p.gf}-${p.gc} ${prep} ${rival}${idea}${encajados}`.replace(/^· /, "");
  }

  const pr = inf.pronostico;

  const donde = [p.lado === "fuera" ? "fuera" : p.lado === "casa" ? "en casa" : "", cuandoCorto(p.cuando)].filter(Boolean).join(", ");

  if (!pr) return `Previa · ${j}${rival}${donde ? ` (${donde})` : ""}`;

  return `${j}${rival}${donde ? ` (${donde})` : ""}: ${pct(pr.victoria)} de victoria, ${pct(pr.conPlan.victoria)} con el plan`;
}

/** El texto que se ve junto al asunto en la bandeja: la acción, no la etiqueta. */
export function preencabezadoInforme(inf: InformePartido) {
  const s = inf.sintesis;

  if (inf.momento === "post") return s.microciclo[0] ? `Qué toca esta semana: ${minusculaInicial(s.microciclo[0])}` : s.subtitular || s.titular;

  return s.plan[0] ? `Cómo lo ganamos: ${minusculaInicial(s.plan[0].texto)}` : inf.pronostico?.idea || s.titular;
}

/**
 * El WhatsApp en cuatro líneas (20/10/2026): titular en negrita, qué
 * hacemos, el vídeo y el PDF. Aquí van las dos primeras; los enlaces los pone
 * `mensajeWhatsapp`.
 */
export function whatsappInforme(inf: InformePartido): { titular: string; lineas: string[] } {
  const p = inf.partido;

  const s = inf.sintesis;

  const j = p.jornada ? `J${p.jornada} · ` : "";

  if (inf.momento === "post") {
    const marcador = p.gf !== null && p.gc !== null ? (p.lado === "fuera" ? `${p.rival} ${p.gc}-${p.gf} RM Castilla` : `RM Castilla ${p.gf}-${p.gc} ${p.rival}`) : p.rival;

    return {
      titular: `${j}${marcador}`.toUpperCase(),
      lineas: [[`${s.titular}.`, s.microciclo[0] ? `Esta semana: ${minusculaInicial(s.microciclo[0])}.` : ""].filter(Boolean).join(" ")],
    };
  }

  const pr = inf.pronostico;

  const cabeza = [`${j}${p.rival}`.toUpperCase(), cuandoCorto(p.cuando), p.lado === "fuera" ? "fuera" : p.lado === "casa" ? "en casa" : ""].filter(Boolean).join(" · ");

  return {
    titular: cabeza,
    lineas: [
      [pr ? `${pct(pr.victoria)} de victoria; ${pct(pr.conPlan.victoria)} con el plan.` : "", s.plan[0] ? `Clave: ${minusculaInicial(s.plan[0].texto)}.` : ""].filter(Boolean).join(" "),
    ].filter(Boolean),
  };
}

export function sintetiza(inf: Omit<InformePartido, "sintesis">): Sintesis {
  const { ventajas, amenazas } = ventajasYAmenazas(inf.duelo);

  const vigilar = aVigilar(inf.once.jugadores, inf.plantilla);

  const esPost = inf.momento === "post";

  const partido = esPost ? lecturaDelPartido(inf.duelo) : [];

  const relato = esPost ? relatoDeGoles(inf.cronica?.goles ?? [], inf.cronica) : [];

  const frenados = esPost ? frenadosEn(vigilar, inf.cronica) : [];

  const plan = esPost ? [] : planPorFases(inf);

  const cumplimiento = esPost ? cumplimientoPlan(inf) : [];

  const microciclo = esPost ? queTocaEnElMicro(inf, cumplimiento) : [];

  /* Las claves: las que escribió el cuerpo técnico en el plan; si no hay, las
     que dicen los datos. Nunca más de cuatro: es lo que cabe en la cabeza. */
  const delPlan = inf.plan?.claves ?? [];

  /* Post: lo que nos deja, de lo más sólido a lo más fino. El resultado y el
     relato ya van en el titular y en la línea de goles; aquí lo que se
     aprende: el partido en datos, si los conocíamos y si los frenamos. */
  const acierto = inf.cronica?.acierto;

  const frenadosBien = frenados.filter((f) => f.bien);

  const pr = inf.pronostico;

  const veredicto =
    pr && inf.partido.jugado && inf.partido.gf !== null && inf.partido.gc !== null
      ? (() => {
          const r = inf.partido.gf! > inf.partido.gc! ? "victoria" : inf.partido.gf! < inf.partido.gc! ? "derrota" : "empate";

          const mp = pr.victoria >= pr.empate && pr.victoria >= pr.derrota ? "victoria" : pr.derrota >= pr.empate ? "derrota" : "empate";

          /* «Un resultado posible, no el más probable» era falso para una
             victoria al 40 % que era lo más probable (20/10/2026). */
          return mp === r
            ? `El pronóstico daba ${conArticulo(r)} como lo más probable (${pct(pr[r])}): se dio`
            : `El pronóstico daba ${pct(pr[r])} a ${conArticulo(r)}; lo más probable era ${conArticulo(mp)} (${pct(pr[mp])})`;
        })()
      : "";

  /* Una cifra, una función: lo que ya sale en «¿Se cumplió?» no se repite aquí. */
  const enCumplimiento = (linea: string) => cumplimiento.some((f) => f.dato.toLowerCase().includes(linea.split(":")[0].toLowerCase()));

  const clavesPost = [
    ...partido.filter((l) => !enCumplimiento(l)).slice(0, 2),
    acierto
      ? `Acertamos ${acierto.acertados} de ${acierto.total} de su once${acierto.sorpresas.length ? ` · ${acierto.sorpresas.length === 1 ? "la sorpresa" : "las sorpresas"}: ${acierto.sorpresas.map(apellido).join(", ")}` : ""}`
      : "",
    frenados.length
      ? frenadosBien.length === frenados.length
        ? `Ninguno de los ${frenados.length} jugadores a vigilar marcó ni asistió`
        : `${frenados
            .filter((f) => !f.bien)
            .map((f) => `${apellido(f.jugador.nombre)} ${f.texto}`)
            .join("; ")}${frenados.length - frenadosBien.length > 1 ? ": estaban entre los que había que frenar" : ": era uno de los que había que frenar"}`
      : "",
  ]
    .filter(Boolean)
    .slice(0, 4);

  /* Previa: las claves del cuerpo técnico mandan; sin ellas (o con menos de
     tres), el plan por fases (20/10/2026: antes «Atacar · … P97…» y
     «Aprovechar · xG a favor 2,23…», cortadas con «…»). */
  const claves = esPost ? clavesPost : delPlan.length >= 3 ? delPlan.slice(0, 4) : [...delPlan, ...plan.map((l) => `${l.fase} · ${l.texto}`)].slice(0, 4);

  const rival = inf.partido.rival || "el rival";

  /* Previa: la pregunta del partido, su mejor arma (20/10/2026). Antes, «Visitamos
     al Algeciras CF, 13.º de la tabla», un dato de agenda. */
  const arma = pr?.suFuerte;

  const titular = esPost
    ? titularPost(inf)
    : arma
      ? `Su arma: ${nombreEnFrase(arma.nombre)} (${ordinal(arma.puesto)} de ${arma.de}). ¿Se la quitamos?`
      : `${inf.partido.lado === "fuera" ? "Visitamos al" : "Recibimos al"} ${rival}${inf.contexto?.puesto ? `, ${ordinal(inf.contexto.puesto)} de la tabla` : ""}`;

  const roja = (inf.cronica?.tarjetas ?? []).find((t) => t.tipo === "roja");

  const subtitular = esPost
    ? roja
      ? `Contra diez desde el ${roja.minuto}′ (roja a ${apellido(roja.jugador)})`
      : ""
    : pr
      ? `Victoria ${pct(pr.victoria)} · empate ${pct(pr.empate)} · derrota ${pct(pr.derrota)} · lo más probable, ${pr.marcador}`
      : "";

  return { titular, subtitular, claves, ventajas, amenazas, vigilar, partido, relato, frenados, veredicto, plan, cumplimiento, microciclo };
}
