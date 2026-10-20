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
import type { GolesTemporada } from "./goles-temporada";

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
      /** La desviación típica de nuestros partidos de antes (con 4 o más): el «dentro de lo habitual» (21/10/2026). */
      desviacion?: number | null;
      /** El recuento detrás de un porcentaje del partido: «6 de 8» (24/10/2026). */
      recuento?: { de: number; total: number } | null;
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
  /** Arriba en volumen (pases, posesión) y abajo en peligro: «mucho balón, poco remate» (21/10/2026). */
  muchoBalon?: { volumen: ArmaMetrica; sinPeligro: ArmaMetrica } | null;
};

/** Las métricas que acaban en peligro: de ellas sale «su arma» (21/10/2026). */
const PELIGRO = ["xg", "goles", "tiros", "xgPorTiro", "entradasArea", "ataquesPosRemate", "contrasRemate", "abpRemate", "cornersRemate"];

/** Las de volumen: dicen el estilo, no el daño. */
const VOLUMEN = ["posesion", "pasesUltimoTercio", "pasesProgresivos", "centros"];

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
  /** Si su once no se sostiene (dos porteros, un expulsado que no sale), el aviso para el analista; entonces `acierto` es null. */
  avisoOnce?: string;
  /** Los nombres del once que no se sostienen (el portero de más, el expulsado que no sale): los duelos con ellos no se publican. */
  dudosos?: string[];
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
  /** Previa: lo que pidió el post del partido anterior («Qué toca en el microciclo»), para cruzarlo con las tareas de esta semana (24/10/2026). */
  postAnterior?: { etiqueta: string; lineas: string[] } | null;
  /** Post: los goles de la temporada (`goles:analisis`): en cuántos partidos nos marcaron tarde yendo por delante y la fase de cada gol en contra (25/10/2026). */
  golesTemporada?: GolesTemporada | null;
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

/**
 * La cifra de un duelo, UNA sola (22/10/2026): la misma en la diapositiva, en
 * el capítulo del completo, en la tabla y en el PPT. Es la media de las
 * diferencias (sobre 100) de los dos cruces que más pesan por ese lado, los
 * que se nombran al lado; sin cruces destacados, el balance de ese lado.
 * Antes el completo usaba un cruce (+85), la diapositiva dos (+57) y la tabla
 * el balance (+35): tres cifras para lo mismo.
 */
export function ventajaVisible(x: DueloJugadores, lado: "con" | "sin") {
  const claves = crucesDelDuelo(x, lado);

  if (!claves.length) return lado === "con" ? x.conBalon : x.sinBalon;

  return Math.round(claves.reduce((s, e) => s + (e.nuestro - e.suyo), 0) / claves.length);
}

/** Los cruces que sostienen la cifra del duelo por ese lado (como mucho dos). */
export function crucesDelDuelo(x: DueloJugadores, lado: "con" | "sin") {
  return x.destacados.filter((e) => e.sentido === lado && e.veredicto === (lado === "con" ? "ventaja" : "desventaja")).slice(0, 2);
}

/**
 * Lo que dice cada cruce en lenguaje de banquillo (22/10/2026): con balón,
 * lo que les hacemos; sin balón, lo que nos hacen y lo que pedimos. Las
 * claves son los títulos de las facetas de lib/duelos.ts.
 */
const CONDUCTA: Record<string, { con: string; sin: string }> = {
  "Regate contra entrada": { con: "le encaramos en el uno contra uno", sin: "nos encara: le esperamos y no entramos a la primera" },
  "Cuerpo a cuerpo con balón": { con: "le jugamos al pie, gana el cuerpo a cuerpo", sin: "gana el choque: le anticipamos antes del control" },
  "Cambio de ritmo": { con: "le atacamos con cambio de ritmo", sin: "nos rompe con cambio de ritmo: le cerramos el espacio" },
  "Desmarque a la espalda": { con: "le atacamos la espalda con desmarques", sin: "nos ataca la espalda: vigilamos su desmarque" },
  Conducción: { con: "le encaramos en conducción", sin: "progresa en conducción: le salimos antes de que arranque" },
  "Pase que rompe líneas": { con: "rompemos su línea con el pase", sin: "rompe líneas con el pase: le tapamos la línea" },
  "Pase bajo presión": { con: "jugamos bajo su presión sin perderla", sin: "juega bajo presión sin perderla: no saltamos solos" },
  "Recibir entre líneas": { con: "le recibimos entre líneas y nos giramos", sin: "recibe entre líneas: le vigilamos la espalda" },
  "Último pase": { con: "le buscamos para el último pase", sin: "da el último pase: le cerramos el carril interior" },
  "Centro contra juego aéreo": { con: "centramos: pierde por alto", sin: "centra bien: cerramos el centro y el primer palo" },
  "Remate contra bloqueo": { con: "le buscamos el remate", sin: "remata mucho: bloqueamos el remate" },
  "Juego aéreo": { con: "le buscamos por alto", sin: "nos gana por alto: emparejamos al más alto" },
};

/** El comportamiento del cruce que más pesa, en palabras («le encaramos en conducción»). */
export function conductaDuelo(x: DueloJugadores, lado: "con" | "sin") {
  const e = crucesDelDuelo(x, lado)[0];

  return e ? (CONDUCTA[e.titulo]?.[lado] ?? e.titulo.toLowerCase()) : "";
}

/** Las cifras que componen la del duelo, para el paréntesis del final: «conducción 97-38 · regate contra entrada 89-42». */
export function cifrasDuelo(x: DueloJugadores, lado: "con" | "sin") {
  return crucesDelDuelo(x, lado)
    .map((e) => `${e.titulo.toLowerCase()} ${lado === "con" ? e.nuestro : e.suyo}-${lado === "con" ? e.suyo : e.nuestro}`)
    .join(" · ");
}

/** Una línea de caseta para un duelo: quién, dónde, qué hacemos y, al final, las cifras (sobre 100, contra su puesto). */
export function fraseDuelo(x: DueloJugadores, lado: "con" | "sin") {
  const quien = lado === "con" ? `${apellidos(x.nuestros)} ante ${apellidos(x.suyos)}` : `${apellidos(x.suyos)} ante ${apellidos(x.nuestros)}`;
  const donde = LUGAR_DUELO[x.clave] ?? x.titulo.replace(/^Nuestr[oa]s? /, "").replace(/ vs .*/, "");
  const conducta = conductaDuelo(x, lado);
  const cifras = cifrasDuelo(x, lado);

  return `${quien} (${donde})${conducta ? `: ${conducta}` : ""}${cifras ? ` (${cifras})` : ""}`;
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
  /**
   * Post: «Qué toca en el microciclo», hasta tres, cada uno «consigna · dato»
   * (21/10/2026): la consigna en primera del plural («Cerramos los partidos
   * con ventaja») y, tras « · », el dato que la pide.
   */
  microciclo: string[];
  /**
   * Los titulares de las diapositivas 2 y 3 (21/10/2026): la conclusión, no
   * la etiqueta («Cumplimos 2 de 3: la transición, como siempre» y no «LO QUE
   * NOS DEJA»). Vacíos si no hay con qué.
   */
  titularPlan: string;
  titularDuelos: string;
  /** Previa: la consigna con la que acaba el resumen (las mismas líneas que el cierre del vídeo). La primera responde a la pregunta del titular. */
  consigna: string[];
  /**
   * Previa: la idea del partido, la respuesta a la pregunta del titular
   * (23/10/2026): «Ganamos la segunda jugada y atacamos la espalda de
   * Gomez». Titular, LA IDEA y la consigna nº 1 cuentan la misma historia.
   */
  ideaPrevia: string;
  /** Previa: cada consigna con las tareas de la semana que la entrenan (sin tarea, la lista va vacía: lo decide el cuerpo técnico). */
  consignaTareas: { consigna: string; tareas: string[] }[];
  /** Previa: lo que pidió el post anterior, con las tareas de esta semana que lo entrenan. */
  delPostAnterior: { origen: string; consigna: string; dato: string; tareas: string[] }[];
  /** Previa: la consigna que mejor responde a los datos pero no tiene tarea esta semana (va al aviso del analista, no al informe). */
  ideaSinTarea: string;
  /**
   * Post: la roja del rival pesa en las cifras del partido (24/10/2026,
   * experto de análisis): «Desde el 57′ jugamos con uno más (33 minutos): la
   * posesión, las entradas al área y lo que nos generaron cuentan ese tramo».
   * Wyscout da el partido entero, sin tramos. Vacía si no hubo roja.
   */
  notaRoja: string;
  /** Post: cada gol en contra con su contexto (24/10/2026): «90+1′ · 3-2 · Destiny, que entró en el 64′ · con 3-1 y uno más». */
  golesEnContra: string[];
};

/** Una clave del plan, revisada con Wyscout: `null` = no hay métrica que la mida (no se inventa veredicto). */
export type FilaCumplimiento = {
  clave: string;
  tema: string;
  veredicto: "si" | "no" | "igual" | null;
  dato: string;
  /** La meta contada en corto y en primera del plural, con su veredicto: «Al robar no salimos» (22/10/2026). */
  lectura?: string;
  /** Lo que pesa sobre la cifra, en la misma fila: «con diez enfrente desde el 57′» (25/10/2026). */
  matiz?: string;
};

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
  /** Post: el aspecto que nos dio peligro en contra en el partido, ya como consigna y dato, para «Qué toca en el microciclo» (22/10/2026). */
  sustoEnContra?: { consigna: string; dato: string; /** Sin muestra: para vigilar, no la prioridad (25/10/2026). */ corta?: boolean } | null;
  /** Post: los goles esperados del partido a balón parado (25/10/2026), para revisar la palanca del pronóstico. */
  xgPartido?: { favor: number; contra: number } | null;
  /** Previa: la prioridad nº 1 del informe de ABP, tal cual (24/10/2026): la previa del partido dice lo mismo. */
  prioridad?: { consigna: string; texto: string } | null;
};

/**
 * Los minutos de ABP de la semana, UNA cifra para todo el informe
 * (20/10/2026): la del informe de ABP cuando ha llegado (cuenta campo, vídeo
 * y trabajo tras el entreno, y deja fuera los bocetos); si no, la del
 * registro de tareas. Antes salían 23′ en el resumen y 1 h 35′ en el de ABP.
 */
export function minutosAbpInforme(inf: { abp: InformePartido["abp"]; microciclo: Microciclo | null }) {
  const m = inf.abp?.pincelada?.minutos;

  /* El mismo formato que el resto del informe (25/10/2026): «1h 20'» de la pantalla de ABP pasa a «1 h 20′». */
  if (m) return { minutos: Math.round(m.confirmados), texto: (m.texto ?? "").replace(/(\d+)h\s*(\d+)'/g, "$1 h $2′").replace(/(\d+)h(?=\W|$)/g, "$1 h").replace(/(\d+)'/g, "$1′") };

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

/** Una cifra con un decimal, para las frases («3,5 goles esperados contra 0,8»). */
const unDecimal = (n: number) => coma(n, 1);

/**
 * Las siglas, en palabras (21/10/2026): «xG a favor» → «Goles esperados a
 * favor», «ABP con remate %» → «Balón parado con remate %». Un entrenador no
 * tiene por qué saber qué es «xG», y el pie que lo explicaba no lo lee nadie.
 */
export function sinSiglas(nombre: string) {
  const t = nombre.replace(/\bxG\b/g, "goles esperados").replace(/\bABP\b/g, "balón parado");

  return /^(x[A-Z]|[A-ZÁÉÍÓÚ])/.test(nombre) ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Lo que no puede quedar colgando al final de un texto recortado. */
const COLGANTE = /[\s,;:·(–—-]+(?:de|del|la|las|el|los|en|con|y|e|o|u|a|al|por|para|que|su|sus|un|una|ni|se|sin|como|cuando|donde|tras|desde|hasta|ante|entre|sobre|muy|más|lo|le|les|si)?$/i;

/**
 * Un texto que no cabe, cortado en una pausa natural y sin «…» (21/10/2026):
 * «2 goles encajad…» o «el otro de 3º…» se leían como un error. Primero el
 * final de frase; si no, la coma, el punto y coma o el paréntesis; si no, la
 * última palabra entera, sin preposición ni artículo colgando. Un paréntesis
 * abierto que no se cierra se va entero.
 */
export function cortaEnPausa(texto: string, n: number) {
  const t = (texto ?? "").trim();

  if (t.length <= n) return t;

  const cabe = t.slice(0, n + 1);

  const limpia = (s: string) => {
    let x = s.trim();

    const abierto = x.lastIndexOf("(");

    if (abierto > x.lastIndexOf(")")) x = x.slice(0, abierto).trim();

    for (let i = 0; i < 4 && COLGANTE.test(x); i++) x = x.replace(COLGANTE, "").trim();

    return x;
  };

  const finFrase = Math.max(cabe.lastIndexOf(". "), cabe.lastIndexOf("? "), cabe.lastIndexOf("! "));

  if (finFrase >= n * 0.4) return t.slice(0, finFrase + 1).trim();

  const pausa = Math.max(cabe.lastIndexOf(", "), cabe.lastIndexOf("; "), cabe.lastIndexOf(" ("), cabe.lastIndexOf(" — "), cabe.lastIndexOf(": "));

  if (pausa >= n * 0.45) return limpia(t.slice(0, pausa));

  const espacio = cabe.lastIndexOf(" ");

  return limpia(t.slice(0, espacio > 0 ? espacio : n));
}

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

  return `${sinSiglas(m.nombre)}: ${cifra(dato.valor, m.unidad)} (${ordinal(dato.puesto)} de ${equipos})`;
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
/*
| Cada pareja con su frase (21/10/2026): «Nuestro remates 14,6 (3.º) contra su
| remates en contra» tenía la concordancia rota y la sigla «xG» delante. Ahora:
| «Goles esperados: generamos 2,23 (4.º) y ellos conceden 1,69 (14.º)».
*/
const PAREJAS_CRUCE: { ataque: string; defensa: string; rotulo: string; verbos: { nosotros: [string, string]; rival: [string, string] } }[] = [
  { ataque: "xg", defensa: "xgContra", rotulo: "Goles esperados", verbos: { nosotros: ["generamos", "ellos conceden"], rival: ["generan", "nosotros concedemos"] } },
  { ataque: "tiros", defensa: "tirosContra", rotulo: "Remates", verbos: { nosotros: ["hacemos", "ellos permiten"], rival: ["hacen", "nosotros permitimos"] } },
  { ataque: "xgPorTiro", defensa: "xgContraPorTiro", rotulo: "Goles esperados por remate", verbos: { nosotros: ["sacamos", "ellos conceden"], rival: ["sacan", "nosotros concedemos"] } },
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

      const [verboAt, verboDe] = par.verbos[ataca];

      /* «Goles esperados: generamos 2,23 (4.º) y ellos conceden 1,69 (14.º)». */
      const texto = `${par.rotulo}: ${verboAt} ${cifra(a.valor, at.unidad)} (${ordinal(a.puesto)}) y ${verboDe} ${cifra(d.valor, de.unidad)} (${ordinal(d.puesto)})`;

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

    return n !== null && n >= 10;
  };

  /* Un porcentaje con menos de 10 casos debajo no es «mejor» ni «peor» de lo habitual (24/10/2026): 6 de 8 duelos aéreos es poco juego aéreo, no una mejora. */
  const conRecuento = (m: (typeof p.metricas)[number]) => !m.recuento || m.recuento.total >= 10;

  const desvios = p.metricas
    .filter((m) => m.nuestro !== null && m.media !== null && m.media !== 0 && m.mejorAlto !== null)
    /* Los goles esperados ya van en el subtítulo: aquí no se repiten (24/10/2026). */
    .filter((m) => !["goles", "golesContra", "xg", "xgContra"].includes(m.key) && conBase(m.key) && conRecuento(m))
    .map((m) => {
      const rel = ((m.nuestro! - m.media!) / Math.abs(m.media!)) * 100;

      const bueno = m.mejorAlto ? rel > 0 : rel < 0;

      return { m, rel, bueno };
    })
    .filter((x) => Math.abs(x.rel) >= 15)
    .sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel))
    .slice(0, 4);

  return desvios.map(({ m, bueno }) => `${sinSiglas(m.nombre)}: ${cifraPartido(m.nuestro!, m.unidad)}${conRecuentoTexto(m)} frente a ${cifra(m.media, m.unidad)} de media · ${bueno ? "mejor" : "peor"} de lo habitual`);
}

/** « (6 de 8)» tras un porcentaje del partido, si se sabe (24/10/2026). */
export const conRecuentoTexto = (m: { recuento?: { de: number; total: number } | null }) => (m.recuento ? ` (${Math.round(m.recuento.de)} de ${Math.round(m.recuento.total)})` : "");

/**
 * Un recuento bajo de UN partido (24/10/2026): con 0,71 contraataques de
 * media, un 0 sale casi la mitad de las veces por puro azar (e^-0,71 ≈ 49 %).
 * No es un dato para un veredicto. Lo mismo un porcentaje con menos de 10
 * casos debajo.
 */
const RECUENTOS = new Set(["contras", "goles", "golesContra", "tirosPuerta", "penaltis", "corners"]);

const muestraCorta = (m: { key: string; unidad: string; media: number | null; recuento?: { de: number; total: number } | null }) =>
  m.unidad === "porcentaje" ? Boolean(m.recuento && m.recuento.total < 10) : RECUENTOS.has(m.key) && m.media !== null && Math.abs(m.media) < 2;

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

/** «Estructura 1-4-3-3.», «1-4-4-2 / 1-4-3-3.»: sólo un dibujo, sin una frase que diga nada. */
const SOLO_DIBUJO = /^(?:estructura\s*:?\s*)?1-\d(?:-\d){1,3}(?:\s*(?:\/|,|\by\b|\bo\b)\s*1-\d(?:-\d){1,3})*\s*\.?$/i;

/**
 * Una línea de «Cómo juegan» con sujeto y verbo (21/10/2026): la hoja da
 * «Estructura 1-4-3-3.» o «1-4-4-2 / 1-4-3-3.», que en una diapositiva es
 * una etiqueta. Ahora «Salen en 1-4-3-3: inicios en corto para luego jugar
 * directo con última línea». `textos`: los campos de esa fase, por orden de
 * importancia; si el primero es sólo el dibujo, la frase la pone el siguiente.
 */
export function fraseDeFase(titulo: string, textos: string[], n = 120) {
  const verbo = /salen/i.test(titulo) ? "Salen" : /atacan/i.test(titulo) ? "Atacan" : /defienden/i.test(titulo) ? "Defienden" : "";

  const frases = textos
    .flatMap((t) => enFrases(t, 8))
    .map((x) => x.replace(/^[\s/·\-–—|,;:.]+/, "").trim())
    .filter((x) => (x.match(/\p{L}/gu)?.length ?? 0) >= 5 || /\d-\d-\d/.test(x));

  if (!frases.length) return "";

  const [primera, ...resto] = frases;

  const sinPunto = (s: string) => s.replace(/[.\s]+$/, "");

  if (verbo && SOLO_DIBUJO.test(primera)) {
    const dibujos = primera.match(/1-\d(?:-\d){1,3}/g) ?? [];

    const base = `${verbo} en ${dibujos.length > 1 ? `${dibujos.slice(0, -1).join(", ")} o ${dibujos[dibujos.length - 1]}` : dibujos[0]}`;

    const siguiente = resto.find((f) => !SOLO_DIBUJO.test(f) && !/^(?:estructura\s+)?1-\d/i.test(f) && !(f === f.toUpperCase() && f.split(/\s+/).length <= 4));

    return cortaEnPausa(siguiente ? `${base}: ${minusculaInicial(sinPunto(siguiente))}` : base, n);
  }

  if (verbo && /^(?:estructura\s+)?1-\d/i.test(primera)) return cortaEnPausa(`${verbo} en ${sinPunto(primera.replace(/^estructura\s+/i, ""))}`, n);

  return cortaEnPausa(sinPunto(fraseUtil(textos.join("\n"), 400)), n);
}

/**
 * «Dónde hacerles daño» con nombre y apellido y lo que dice su ficha
 * (21/10/2026): «…por el perfil de Ángel» no decía de quién hablaba. Cada
 * nombre que sea de su plantilla pasa a nombre y apellido, y la primera vez,
 * con sus rasgos de defensor flojo («lento, pierde duelos»).
 */
export function explicaDano(texto: string, plantilla: JugadorRival[]) {
  let salida = texto;

  const vistos = new Set<string>();

  /* Con tilde delante («Ángel») `\b` no sirve: la frontera se mira a mano. */
  for (const palabra of texto.match(/(?<!\p{L})\p{Lu}\p{L}{3,}(?!\p{L})/gu) ?? []) {
    const clave = plano(palabra)[0];

    if (!clave || vistos.has(clave)) continue;

    const j = plantilla.find((x) => {
      const t = plano(x.nombre);

      return t.length > 1 && t.includes(clave);
    });

    if (!j) continue;

    vistos.add(clave);

    const rasgos = rasgosDebiles(j).slice(0, 2);

    /* Si ya es el apellido («Carmona»), no se repite. */
    const esApellido = plano(j.nombre).slice(-1)[0] === clave;

    const nombre = `${palabra}${esApellido ? "" : ` ${apellido(j.nombre)}`}${rasgos.length ? ` (${rasgos.join(", ")})` : ""}`;

    salida = salida.replace(new RegExp(`(^|[^\\p{L}])${palabra}(?![\\p{L}])`, "u"), `$1${nombre}`);
  }

  return salida;
}

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

  const dato = (x: MetricaDuelo | undefined, quien: "rival" | "nosotros") =>
    x && x[quien] ? `${sinSiglas(x.nombre)}: ${cifra(x[quien]!.valor, x.unidad)} (${ordinal(x[quien]!.puesto)} de ${d.equipos})` : "";

  /*
  | Su arma, de peligro y no de volumen (21/10/2026). Salía «pases en el
  | último tercio (3.º)» de un equipo 19.º en goles esperados y 20.º en xG por
  | remate: mucho balón que no hace daño. El arma es una métrica que acaba en
  | peligro y en la que están en el tercio de arriba (6 primeros de 20); su
  | punto débil, una en la que están en el tercio de abajo (un 10.º de 20 es
  | la mediana, no una debilidad). Si no hay ninguna, no se nombra.
  */
  const arriba = Math.max(3, Math.round(d.equipos * 0.25));
  const abajo = d.equipos - arriba + 1;

  const suFuerte = d.metricas
    .filter((x) => PELIGRO.includes(x.key) && x.mejorAlto !== null && x.rival?.percentil != null && x.rival.puesto <= arriba && conDato(x))
    .sort((a, b) => (b.rival!.percentil ?? 0) - (a.rival!.percentil ?? 0))[0];

  const debil = peorSuyo(["Sin balón", "Transiciones"]);
  const suDebil = debil && debil.rival!.puesto >= abajo ? debil : undefined;

  /* Mucho balón, poco peligro: arriba en volumen y abajo en lo que hace daño. */
  const volumen = d.metricas
    .filter((x) => VOLUMEN.includes(x.key) && x.rival && x.rival.puesto <= arriba && conDato(x))
    .sort((a, b) => a.rival!.puesto - b.rival!.puesto)[0];

  const sinPeligro = d.metricas
    .filter((x) => ["xg", "xgPorTiro"].includes(x.key) && x.rival && x.rival.puesto >= abajo && conDato(x))
    .sort((a, b) => b.rival!.puesto - a.rival!.puesto)[0];
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

  const enMinuscula = (x: MetricaDuelo) => nombreEnFrase(sinSiglas(x.nombre));

  const muchoBalon = !suFuerte && volumen && sinPeligro ? { volumen, sinPeligro } : null;

  const idea =
    suFuerte && suDebil
      ? `Quitarles ${enMinuscula(suFuerte)} (son ${ordinal(suFuerte.rival!.puesto)} de la liga) y hacerles daño donde sufren: ${enMinuscula(suDebil)} (${ordinal(suDebil.rival!.puesto)})`
      : suFuerte
        ? `Quitarles ${enMinuscula(suFuerte)}: son ${ordinal(suFuerte.rival!.puesto)} de la liga`
        : muchoBalon && suDebil
          ? `Mucho balón y poco remate (${ordinal(muchoBalon.sinPeligro.rival!.puesto)} en ${enMinuscula(muchoBalon.sinPeligro)}): les cerramos el área y les hacemos daño donde sufren, ${enMinuscula(suDebil)} (${ordinal(suDebil.rival!.puesto)})`
          : suDebil
            ? `Hacerles daño donde sufren: ${enMinuscula(suDebil)} (${ordinal(suDebil.rival!.puesto)} de la liga)`
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
    muchoBalon: muchoBalon ? { volumen: arma(muchoBalon.volumen)!, sinPeligro: arma(muchoBalon.sinPeligro)! } : null,
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

  /*
  | Una idea por frase y dos cifras como mucho en cada una (21/10/2026): antes
  | iban cuatro en una («3,46 frente a 1,71 a favor, 0,75 frente a 1,63 en
  | contra») y no se leía de una vez. El cuánto, en palabras: «el doble», «la
  | mitad», «más», «menos» o «lo previsto».
  */
  const cuanto = (real: number, previsto: number) => {
    const r = previsto > 0 ? real / previsto : 1;

    if (r >= 2.7) return "el triple de lo previsto";
    if (r >= 1.8) return "el doble de lo previsto";
    if (r <= 0.4) return "menos de la mitad de lo previsto";
    if (r <= 0.6) return "la mitad de lo previsto";
    if (real - previsto >= 0.4) return "más de lo previsto";
    if (real - previsto <= -0.4) return "menos de lo previsto";

    return "lo previsto";
  };

  /*
  | Cada cifra con su etiqueta (25/10/2026, fútbol y guion): «Generamos el
  | doble de lo previsto (1,7)» se leía como si hubiéramos generado 1,7.
  */
  const lado = (verbo: string, real: number, previsto: number) => {
    const c = cuanto(real, previsto);

    return `${verbo} ${unDecimal(real)} goles esperados; el pronóstico daba ${unDecimal(previsto)}${c === "lo previsto" ? "" : ` (${c.replace(/ de lo previsto$/, "")})`}`;
  };

  return [lado("Generamos", xg.nuestro, pr.esperados.nosotros), lado("Concedimos", xg.suyo, pr.esperados.rival)].join(". ");
}

/** Post: cada palanca, su meta y lo que pasó (si Wyscout ya tiene el partido). */
export function revisaPalancas(inf: { pronostico: Pronostico | null; duelo: Duelo | null; abp?: InformePartido["abp"] }) {
  const pr = inf.pronostico;

  if (!pr) return [] as { momento: string; meta: string; real: string; cumplida: boolean | null }[];

  const xg = inf.duelo?.partido?.metricas.find((x) => x.key === "xg");

  /* La palanca que se mide con el xG y aún no lo tiene no sale: el informe
     no dice «pendiente de Wyscout» (19/10/2026). */
  const medibles = pr.palancas.filter((p) => {
    if (!p.revisa) return true;

    return (p.revisa === "xgSuyo" ? xg?.suyo : xg?.nuestro) != null;
  });

  /*
  | El balón parado con su veredicto, como las otras dos (25/10/2026, ronda 7):
  | los goles esperados del partido a balón parado salen del informe de ABP
  | (a favor menos en contra) frente a la meta de +0,12.
  */
  const xgAbp = inf.abp?.pincelada?.xgPartido ?? null;

  return medibles.map((p) => {
    if (p.momento === "Balón parado" && xgAbp) {
      const neto = xgAbp.favor - xgAbp.contra;

      return {
        momento: p.momento,
        meta: `+${cifra(p.meta, "decimal")} goles esperados (a favor menos en contra)`,
        real: `${cifra(xgAbp.favor, "decimal")} a favor − ${cifra(xgAbp.contra, "decimal")} en contra = ${neto >= 0 ? "+" : "−"}${cifra(Math.abs(neto), "decimal")}`,
        cumplida: neto >= p.meta,
      };
    }

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

  const suRoja = (cronica?.tarjetas ?? []).filter((t) => t.tipo === "roja").sort((a, b) => minutoNum(a.minuto) - minutoNum(b.minuto))[0];

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

    /* Cómo nos marcaron (22/10/2026): un gol suyo con uno más es la lección del partido; se dice en su línea. */
    const conUnoMas = !g.nuestro && suRoja && minutoNum(suRoja.minuto) < minutoNum(g.minuto) ? ", con uno más" : "";

    lineas.push({ min: minutoNum(g.minuto), texto: `${g.minuto}′ · ${frase} (${quien})${conUnoMas}` });
  });

  /*
  | Su roja vuelve a la cronología (24/10/2026, guionista): es el giro que
  | explica el «con uno más» del titular, y sin ella el relato saltaba del 53′
  | al 64′. Se cuenta aquí, una vez; el subtítulo ya no la repite entera.
  */
  if (suRoja) {
    const antes = goles.filter((g) => minutoNum(g.minuto) <= minutoNum(suRoja.minuto));

    lineas.push({
      min: minutoNum(suRoja.minuto) + 0.001,
      texto: `${suRoja.minuto}′ · Se quedan con diez: roja a ${apellido(suRoja.jugador)} (${antes.filter((g) => g.nuestro).length}-${antes.filter((g) => !g.nuestro).length})`,
    });
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

  /* Su roja (las tarjetas de BeSoccer son suyas): desde ese minuto, uno más. Un «dominamos» sin eso engaña (21/10/2026). */
  const roja = (inf.cronica?.tarjetas ?? []).filter((t) => t.tipo === "roja").sort((a, b) => minutoNum(a.minuto) - minutoNum(b.minuto))[0];

  const unoMas = roja && minutoNum(roja.minuto) < 88 ? { minuto: roja.minuto, jugador: roja.jugador } : null;

  /* El gol suyo tardío con el partido ganado: el minuto, para el asunto. */
  const tardio = pasos.find((x) => !x.g.nuestro && minutoNum(x.g.minuto) >= 80 && x.antes.nos > x.antes.ellos)?.g.minuto ?? null;

  return { resultado, verbo, fuimosPerdiendo, fuimosGanando, sufrida, dominio, xgNos, xgSuyo, unoMas, tardio };
}

/** Qué hicieron en el partido los que había que vigilar. */
export function frenadosEn(vigilar: JugadorRival[], cronica: Cronica | null) {
  if (!cronica) return [] as Sintesis["frenados"];

  return vigilar.map((j) => {
    const suyos = cronica.goles.filter((g) => !g.nuestro && g.tipo !== "propia");

    const marco = suyos.filter((g) => mismoJugador(j.nombre, g.jugador)).map((g) => `${g.minuto}′`);

    const asistio = suyos.filter((g) => g.asistente && mismoJugador(j.nombre, g.asistente)).map((g) => `${g.minuto}′`);

    const titular = cronica.onceReal.some((r) => r.clave === j.clave || mismoJugador(j.nombre, r.nombre));

    const cambio = cronica.cambios.find((c) => mismoJugador(j.nombre, c.entra));

    const entro = Boolean(cambio);

    if (marco.length || asistio.length) {
      /* Si salió desde el banquillo, se dice (21/10/2026): marcar en 26′ no es lo mismo que en 90′. */
      return {
        jugador: j,
        bien: false,
        texto: `${!titular && cambio ? `entró en el ${cambio.minuto}′ y ` : ""}${[marco.length ? `marcó (${marco.join(", ")})` : "", asistio.length ? `dio una asistencia (${asistio.join(", ")})` : ""].filter(Boolean).join(" y ")}`,
      };
    }

    return {
      jugador: j,
      bien: true,
      texto: titular ? "sin gol ni asistencia" : entro ? "salió desde el banquillo, sin gol ni asistencia" : "no fue titular",
    };
  });
}

/**
 * «A quién teníamos que frenar» en una frase (22/10/2026), no un acertijo de
 * «✓» y «!»: «Destiny marcó (90+1′); Gené y Gutierrez, sin gol ni
 * asistencia». Los que hicieron daño van primero, uno a uno; los demás, juntos
 * por lo que les pasó.
 */
export function fraseFrenados(frenados: Sintesis["frenados"]) {
  const malos = frenados.filter((f) => !f.bien).map((f) => `${apellido(f.jugador.nombre)} ${f.texto}`);

  const grupos = new Map<string, string[]>();

  for (const f of frenados.filter((x) => x.bien)) grupos.set(f.texto, [...(grupos.get(f.texto) ?? []), apellido(f.jugador.nombre)]);

  const buenos = [...grupos].map(([texto, quienes]) => `${quienes.length > 1 ? `${quienes.slice(0, -1).join(", ")} y ${quienes[quienes.length - 1]}` : quienes[0]}, ${texto}`);

  return [...malos, ...buenos].join("; ");
}

/* ------------------------------------------------------------------ */
/*  LO QUE HACEMOS: EL PLAN POR FASES, EL PLAN A REVISIÓN Y QUÉ TOCA   */
/*  (20/10/2026, plan de mejora de los informes)                       */
/* ------------------------------------------------------------------ */

/** Una línea de diapositiva cabe en esto: lo que pasa se rehace más corto, nunca con «…». */
const TOPE_LINEA = 70;

const primeraQueQuepa = (...opciones: string[]) => opciones.find((o) => o && o.length <= TOPE_LINEA) ?? "";

/**
 * «19.º de 20 en balón parado con remate» si su balón parado está entre los
 * cinco peores de la categoría; si no, "". Para contrastar el scouting
 * («ABP: excelente sacador») con lo que mide Wyscout (24/10/2026).
 */
export function abpDelRivalFlojo(d: Duelo | null) {
  if (!d) return "";

  const m = d.metricas.find((x) => x.key === "abpRemate" && x.rival?.puesto != null) ?? d.metricas.find((x) => x.key === "cornersRemate" && x.rival?.puesto != null);

  if (!m?.rival?.puesto || m.rival.puesto <= d.equipos - 5) return "";

  return `${ordinal(m.rival.puesto)} de ${d.equipos} en ${nombreEnFrase(sinSiglas(m.nombre))}`;
}

/** «Pases en el último tercio» → «pases en el último tercio»; sin el «%» ni el paréntesis del final («(conducción)»). */
const nombreEnFrase = (nombre: string) => minusculaInicial(nombre.replace(/\s*%$/, "").replace(/\s*\([^)]*\)\s*$/, ""));

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

/*
| EL SCOUTING CRUZADO CON EL DATO (21/10/2026).
|
| El plan salía sólo del ranking de Wyscout y chocaba con lo que el cuerpo
| técnico ya sabía: «les apretamos la salida» de un equipo que juega directo,
| «atacamos entre líneas» cuando su punto débil documentado es la espalda de
| un central lento. Ahora manda el scouting (Scouting colectivo y la ficha
| de cada jugador) y el dato entra de refuerzo si va en el mismo sentido.
*/

/** Todo lo que el cuerpo técnico escribió del rival, en un texto. */
const textoScouting = (inf: Pick<InformePartido, "colectivo" | "plan">) =>
  [
    ...(inf.colectivo?.bloques ?? []).flatMap((b) => b.campos.map((c) => c.texto)),
    ...(inf.colectivo?.conclusiones ?? []).map((c) => c.texto),
    inf.plan?.fortalezas ?? "",
    inf.plan?.debilidades ?? "",
  ].join("\n");

/** «Juegan directo», «ganar la segunda acción», «guardar la 2º»… */
const JUEGO_DIRECTO = /juegan?\s+(?:en\s+)?(?:directo|largo)|juego\s+directo|bal[oó]n(?:es)?\s+largos?|(?:segunda|2\s*[ºª°])\s+(?:acci[oó]n|jugada)|(?:guardar|ganar)\s+la\s+(?:segunda|2\s*[ºª°])/i;

/**
 * Nos buscarán en largo y a la segunda jugada, y nosotros vamos mal por alto:
 * la convergencia de su estilo (scouting) con nuestra debilidad (dato).
 */
export function segundaJugada(inf: Pick<InformePartido, "colectivo" | "plan" | "duelo">) {
  const d = inf.duelo;

  const aereo = d?.metricas.find((m) => m.key === "duelosAereos" && conDato(m));

  if (!d || !aereo?.nosotros || !aereo.rival) return null;

  const abajo = d.equipos - Math.max(3, Math.round(d.equipos * 0.3)) + 1;

  if (aereo.nosotros.puesto < abajo || aereo.rival.puesto >= aereo.nosotros.puesto) return null;

  if (!JUEGO_DIRECTO.test(textoScouting(inf))) return null;

  /*
  | Si Wyscout dice que son de posesión (entre los cinco primeros), el «en
  | largo» del scouting es sólo el primer pase: se matiza (22/10/2026). Antes
  | el titular afirmaba «en largo» de un equipo 4.º en posesión.
  */
  const posesion = d.metricas.find((m) => m.key === "posesion" && conDato(m));

  const dePosesion = Boolean(posesion?.rival && posesion.rival.puesto <= 5);

  return { puesto: aereo.nosotros.puesto, de: d.equipos, suyo: aereo.rival.puesto, dePosesion, puestoPosesion: posesion?.rival?.puesto ?? null };
}

/** Los rasgos de la ficha que son un punto débil de un defensor, en palabras de caseta. */
const RASGO_DEBIL: [RegExp, string][] = [
  [/^lento$/i, "lento"],
  [/perdedor de duelos/i, "pierde duelos"],
  [/sufre la presi[oó]n/i, "sufre la presión"],
  [/flojo por alto/i, "flojo por alto"],
  [/deja centrar/i, "deja centrar"],
];

/* En el orden de la tabla y no en el de la ficha: «lento y pierde duelos», no «pierde duelos y lento». */
const rasgosDebiles = (j: JugadorRival) => RASGO_DEBIL.filter(([re]) => j.rasgos.some((r) => re.test(r.trim()))).map(([, t]) => t);

/**
 * El defensor de su once al que atacar: el que nombra el scouting en su
 * punto débil («Defensa espalda: … por el perfil de Ángel») o, si no nombra a
 * nadie, el que tiene más rasgos de debilidad en la ficha.
 */
export function defensorDebil(inf: Pick<InformePartido, "colectivo" | "once">) {
  const defensas = inf.once.jugadores.filter((j) => j.linea === "DEF");

  if (!defensas.length) return null;

  const campos = (inf.colectivo?.bloques ?? []).flatMap((b) => b.campos).filter((c) => /espalda|d[eé]bil|1\s*x\s*1|uno contra uno/i.test(`${c.titulo} ${c.texto}`));

  const tokens = new Set(plano(campos.map((c) => c.texto).join(" ")));

  const nombrado = defensas.find((j) => plano(j.nombre).some((t) => t.length >= 4 && tokens.has(t)));

  const jugador = nombrado ?? [...defensas].filter((j) => rasgosDebiles(j).length >= 2).sort((a, b) => rasgosDebiles(b).length - rasgosDebiles(a).length)[0];

  if (!jugador) return null;

  const rasgos = rasgosDebiles(jugador).slice(0, 2);

  if (!rasgos.length && !nombrado) return null;

  return { jugador, rasgos, espalda: campos.some((c) => /espalda/i.test(`${c.titulo} ${c.texto}`)) };
}

const yFinal = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} y ${l[l.length - 1]}` : l[0] ?? "");

/** «Salen en corto», «inicio en corto», «salida combinativa»: el scouting dice que su salida se puede presionar. */
const SALEN_EN_CORTO = /sal(?:en|ida)\s+(?:de\s+bal[oó]n\s+)?(?:en\s+)?corto|inicios?\s+(?:de\s+juego\s+)?en\s+corto|salida\s+(?:combinativa|elaborada|asociativa)/i;

/** El duelo de su once en el que está ese defensor (si lo hay). */
function dueloDelDefensor(inf: Pick<InformePartido, "duelosJugadores" | "once">, jugador: JugadorRival) {
  return (inf.duelosJugadores?.lista ?? []).find((x) => x.suyos.some((s) => mismoJugador(jugador.nombre, s)) && dueloEnSuOnce(x, inf.once.jugadores));
}

/** La parte de una línea del plan que es consigna: lo de antes de los dos puntos («Atacamos la espalda de Gomez»). */
const consignaDe = (texto: string) => texto.split(/:\s/)[0].trim();

/** «Ganamos…», «Atacamos…», «Les quitamos…»: una consigna en primera del plural. */
const ES_CONSIGNA = /^(?:(?:Les|Le|Nos)\s+)?[A-ZÁÉÍÓÚa-záéíóú][a-záéíóúñ]+mos\b/;

/**
 * La consigna que responde a la pregunta del titular (23/10/2026, guionista):
 * el titular preguntaba «¿Ganamos la segunda jugada?», LA IDEA hablaba de
 * otra cosa y la consigna enumeraba tres sin decir cuál era la respuesta.
 * Mismo orden que el titular: segunda jugada, su arma, mucho balón, la baza.
 */
function respuestaDelTitular(inf: Omit<InformePartido, "sintesis">, plan: { fase: string; texto: string }[]) {
  const consignas = plan.map((l) => consignaDe(l.texto)).filter((t) => ES_CONSIGNA.test(t));

  const busca = (re: RegExp) => consignas.find((c) => re.test(c));

  const pr = inf.pronostico;

  if (segundaJugada(inf)) return busca(/segunda jugada/i) ?? "Ganamos la segunda jugada";

  if (pr?.suFuerte) return busca(/^Les quitamos/i) ?? `Les quitamos ${nombreEnFrase(sinSiglas(pr.suFuerte.nombre))}`;

  if (pr?.muchoBalon) return busca(/^(?:Les quitamos|Doblamos|Vigilamos)/) ?? consignas[0] ?? "";

  return busca(/^(?:Atacamos|Buscamos)/) ?? consignas[0] ?? "";
}

/** Qué tareas de la semana entrenan cada tipo de consigna (por las palabras de la hoja de registro). */
const TAREAS_DE_CONSIGNA: { consigna: RegExp; tarea: RegExp }[] = [
  /* Lo que pide el post (24/10/2026): «Sacamos más de cada robo», «Cerramos los partidos con ventaja». */
  { consigna: /cada robo|al robar|salimos r[aá]pido|contraata|transici/i, tarea: /transici|contraata|tras robo|tras recuperaci/i },
  { consigna: /cerramos|con ventaja|gestionamos/i, tarea: /gesti[oó]n|ventaja|cierre de partido|marcador|superioridad|11\s*v\s*10/i },
  { consigna: /segunda jugada|rechace/i, tarea: /segunda|2\s*[ªº°]|rechace|a[eé]re|directo|bal[oó]n largo/i },
  { consigna: /espalda|profundidad/i, tarea: /espalda|profundidad|ruptura|desmarque|[uú]ltimo tercio|ataque\s*cr\b|finalizaci/i },
  { consigna: /robamos|presionamos|apretamos/i, tarea: /presi[oó]n|tras p[eé]rdida|robo|recuperaci|bloque (?:medio-)?alto|evitar progresi/i },
  { consigna: /marcamos|bal[oó]n parado|c[oó]rner|falta/i, tarea: /\babp\b|bal[oó]n parado|c[oó]rner|faltas?\b/i },
  { consigna: /salimos r[aá]pido|contraata|transici/i, tarea: /transici|contraata/i },
  { consigna: /doblamos|vigilamos|les quitamos|defendemos/i, tarea: /defensa|defensiv|bloque|1\s*v\s*1|ayuda|basculaci/i },
  { consigna: /atacamos|buscamos|cargamos|llegamos/i, tarea: /ataque|ofensiv|finaliz|[uú]ltimo tercio|centro|banda/i },
];

/**
 * Las tareas de la semana que entrenan una consigna de la previa (23/10/2026,
 * experto de fútbol): «Ganamos la segunda jugada» era una de las tres
 * consignas y ninguna de las catorce tareas hablaba de segundas jugadas.
 * Una consigna sin tarea no es un dato que falte: es una decisión del
 * cuerpo técnico, y se dice.
 */
export function tareasDeConsigna(consigna: string, micro: Microciclo | null) {
  const tema = TAREAS_DE_CONSIGNA.find((t) => t.consigna.test(consigna));

  if (!tema || !micro) return [];

  return micro.tareas
    .filter((t) => t.md !== "MD" && !/competici/i.test(`${t.tipo} ${t.fase}`))
    .filter((t) => tema.tarea.test([t.fase, t.contenido, t.secundario, t.tipo].join(" ")))
    .map((t) => `${t.dia} ${t.tarea}${t.secundario ? ` (${minusculaInicial(t.secundario)})` : t.contenido ? ` (${minusculaInicial(t.contenido)})` : ""}`);
}

/**
 * Los avisos de coherencia del plan para el analista (23/10/2026): un duelo
 * calculado con alguien que no está en su once probable, o un defensor al
 * que el plan manda atacar y cuyo duelo sale en contra.
 */
export function avisosDelPlan(inf: Omit<InformePartido, "sintesis">) {
  if (inf.momento === "post") return [];

  const avisos: string[] = [];

  const once = inf.once.jugadores;

  const fuera = once.length ? [...new Set((inf.duelosJugadores?.lista ?? []).flatMap((x) => x.suyos.filter((s) => !once.some((j) => mismoJugador(j.nombre, s)))))] : [];

  if (fuera.length) avisos.push(`Hay duelos calculados con ${yFinal(fuera.map(apellido))}, que no ${fuera.length === 1 ? "está" : "están"} en su once probable: esos duelos no salen. Revisa el once en Plantillas rivales.`);

  const debil = defensorDebil(inf);

  const duelo = debil ? dueloDelDefensor(inf, debil.jugador) : undefined;

  if (debil && duelo && (ventajaVisible(duelo, "con") ?? 0) < 0) {
    avisos.push(`El scouting señala a ${apellido(debil.jugador.nombre)} como su punto débil, pero el duelo con ${apellidos(duelo.nuestros)} sale en contra: el plan no lo manda atacar. Revísalo.`);
  }

  return avisos;
}

/** «Cómo lo ganamos» de la previa, una línea por fase. */
export function planPorFases(inf: Omit<InformePartido, "sintesis">): { fase: string; texto: string }[] {
  const once = inf.once.jugadores;

  const enOnce = (x: DueloJugadores) => dueloEnSuOnce(x, once);

  const pr = inf.pronostico;

  const d = inf.duelo;

  const lineas: { fase: string; texto: string }[] = [];

  /* La línea del duelo que más ganamos con el balón, con sus cifras (21/10/2026: antes acababa en el nombre de una métrica). */
  const atacar = duelosParaAtacar(inf.duelosJugadores).filter(enOnce)[0];

  const lineaDuelo = (() => {
    if (!atacar) return "";

    const clave = atacar.destacados.find((e) => e.sentido === "con" && e.veredicto === "ventaja");
    const quien = apellidos(atacar.nuestros);
    const lugar = LUGAR_ATAQUE[atacar.clave] ?? "";

    return primeraQueQuepa(
      clave ? `Atacamos ${lugar} con ${quien}: ${clave.titulo.toLowerCase()} ${clave.nuestro} frente a ${clave.suyo}` : "",
      `Atacamos ${lugar} con ${quien}`,
      `Buscamos a ${quien} ${lugar}`,
    );
  })();

  /* CON BALÓN · el defensor débil que señala el scouting; si no, el duelo; si no, donde sufren. */
  const debil = defensorDebil(inf);

  /*
  | El defensor que nombra el plan, con SU duelo (23/10/2026, experto de
  | fútbol): «Atacamos la espalda de Gomez» convivía con un duelo de centrales
  | contra otro jugador. Si su duelo sale en contra, la línea no sale (y el
  | analista recibe el aviso); si sale a favor, dice quién le ataca.
  */
  const dueloDebil = debil ? dueloDelDefensor(inf, debil.jugador) : undefined;
  const debilEnContra = dueloDebil ? (ventajaVisible(dueloDebil, "con") ?? 0) < 0 : false;

  if (debil && !debilEnContra) {
    const ap = apellido(debil.jugador.nombre);
    const donde = debil.espalda ? `la espalda de ${ap}` : `a ${ap}`;
    const refuerzo = pr?.suDebil && /^duelos/.test(pr.suDebil.key) ? `son ${ordinal(pr.suDebil.puesto)} en ${nombreEnFrase(pr.suDebil.nombre)}` : "";
    const con = dueloDebil ? ` con ${apellidos(dueloDebil.nuestros)}` : "";

    lineas.push({
      fase: "Con balón",
      texto: primeraQueQuepa(
        con && debil.rasgos.length ? `Atacamos ${donde}${con}: ${yFinal(debil.rasgos)}` : "",
        debil.rasgos.length && refuerzo ? `Atacamos ${donde}: ${yFinal(debil.rasgos)}, y ${refuerzo}` : "",
        debil.rasgos.length ? `Atacamos ${donde}: ${yFinal(debil.rasgos)}` : "",
        `Atacamos ${donde}`,
      ),
    });
  } else if (lineaDuelo) {
    lineas.push({ fase: "Con balón", texto: lineaDuelo });
  } else if (pr?.suDebil) {
    lineas.push({
      fase: "Con balón",
      texto: primeraQueQuepa(`Atacamos donde sufren: ${nombreEnFrase(pr.suDebil.nombre)} (${ordinal(pr.suDebil.puesto)} de ${pr.suDebil.de})`, `Atacamos donde sufren: ${nombreEnFrase(pr.suDebil.nombre)}`),
    });
  }

  /* SIN BALÓN · su juego directo contra nuestro juego aéreo; si no, el duelo en el que más sufrimos; si no, su arma. */
  const segunda = segundaJugada(inf);

  const vigilar = duelosParaVigilar(inf.duelosJugadores).filter(enOnce)[0];

  if (segunda) {
    lineas.push({
      fase: "Sin balón",
      texto: primeraQueQuepa(
        segunda.dePosesion ? `Ganamos la segunda jugada: su envío largo y somos ${ordinal(segunda.puesto)} de ${segunda.de} por alto` : `Ganamos la segunda jugada: juegan en largo y somos ${ordinal(segunda.puesto)} de ${segunda.de} por alto`,
        `Ganamos la segunda jugada`,
      ),
    });
  } else if (vigilar) {
    const clave = vigilar.destacados.find((e) => e.sentido === "sin" && e.veredicto === "desventaja");
    const quien = apellidos(vigilar.suyos);
    const lugar = LUGAR_DEFENSA[vigilar.clave] ?? "";
    const ganan = vigilar.suyos.length > 1 ? "ganan" : "gana";

    lineas.push({
      fase: "Sin balón",
      texto: primeraQueQuepa(
        clave ? `Doblamos ${lugar}: ${quien} ${ganan} en ${clave.titulo.toLowerCase()} (${clave.suyo} frente a ${clave.nuestro})` : "",
        clave ? `Doblamos ${lugar}: ${quien} ${ganan} en ${clave.titulo.toLowerCase()}` : "",
        `Doblamos ${lugar} ante ${quien}`,
        `Vigilamos a ${quien} ${lugar}`,
      ),
    });
  } else if (pr?.suFuerte) {
    lineas.push({
      fase: "Sin balón",
      texto: primeraQueQuepa(`Les quitamos ${nombreEnFrase(sinSiglas(pr.suFuerte.nombre))}: son ${ordinal(pr.suFuerte.puesto)} de ${pr.suFuerte.de}`, `Les quitamos ${nombreEnFrase(sinSiglas(pr.suFuerte.nombre))}`),
    });
  }

  /*
  | TRANSICIONES · la métrica en la que más se separan, sólo si el puesto que
  | se cita es de verdad un extremo (21/10/2026): «pierden balones atrás (10.º
  | de 20)» vendía la mediana como una debilidad.
  */
  if (d) {
    const top = Math.max(3, Math.round(d.equipos * 0.25));
    const cola = d.equipos - top + 1;

    const nos = (m: MetricaDuelo) => `${ordinal(m.nosotros!.puesto)} de ${d.equipos}`;
    const ellos = (m: MetricaDuelo) => `${ordinal(m.rival!.puesto)} de ${d.equipos}`;

    /* Cada frase dice qué puesto cita y si ese puesto tiene que estar arriba o abajo. */
    const frases = (m: MetricaDuelo): Record<"aFavor" | "enContra", { texto: string; puesto: number; extremo: "arriba" | "abajo" }> => {
      switch (m.key) {
        case "recuperacionesAltas": {
          /*
          | «Robamos arriba» se apoya en algo suyo (23/10/2026, expertos de
          | fútbol y análisis): que salen en corto (scouting) o que pierden
          | balones atrás. Con sólo nuestro puesto, la línea no sale.
          */
          const perdidas = d.metricas.find((x) => x.key === "perdidasBajas" && conDato(x));
          const suyo = SALEN_EN_CORTO.test(textoScouting(inf)) ? "salen en corto" : perdidas?.rival && perdidas.rival.puesto >= cola ? `pierden balones atrás (${ellos(perdidas)})` : "";

          return {
            aFavor: { texto: suyo ? `Robamos arriba: ${suyo} y somos ${nos(m)} en recuperaciones altas` : "", puesto: m.nosotros!.puesto, extremo: "arriba" },
            enContra: { texto: `Salida limpia: ellos roban arriba (${ellos(m)})`, puesto: m.rival!.puesto, extremo: "arriba" },
          };
        }
        case "contras":
        case "contrasRemate":
          return {
            aFavor: { texto: `Salimos rápido al robar: ${nos(m)} en contraataques`, puesto: m.nosotros!.puesto, extremo: "arriba" },
            enContra: { texto: `Vigilamos su contraataque: son ${ellos(m)}`, puesto: m.rival!.puesto, extremo: "arriba" },
          };
        case "perdidasBajas":
          return {
            aFavor: { texto: `Les apretamos la salida: pierden balones atrás (${ellos(m)})`, puesto: m.rival!.puesto, extremo: "abajo" },
            enContra: { texto: `Salida segura: perdemos balones atrás (${nos(m)})`, puesto: m.nosotros!.puesto, extremo: "abajo" },
          };
        default:
          return {
            aFavor: { texto: `Ganamos la transición: ${nombreEnFrase(m.nombre)}, ${nos(m)}`, puesto: m.nosotros!.puesto, extremo: "arriba" },
            enContra: { texto: `Cuidado en la transición: ${nombreEnFrase(m.nombre)}, ellos ${ellos(m)}`, puesto: m.rival!.puesto, extremo: "arriba" },
          };
      }
    };

    const transicion = d.metricas
      .filter((m) => m.bloque === "Transiciones" && m.mejorAlto !== null && m.nosotros?.percentil != null && m.rival?.percentil != null && conDato(m))
      .map((m) => ({ m, dif: (m.nosotros!.percentil ?? 0) - (m.rival!.percentil ?? 0) }))
      .filter((x) => Math.abs(x.dif) >= 15)
      .sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))
      .map(({ m, dif }) => frases(m)[dif > 0 ? "aFavor" : "enContra"])
      .find((f) => f.texto && (f.extremo === "arriba" ? f.puesto <= top : f.puesto >= cola));

    if (transicion) lineas.push({ fase: "Transiciones", texto: primeraQueQuepa(transicion.texto) });
  }

  /* BALÓN PARADO · sus rematadores (ficha de Plantillas); si no, nuestro córner. */
  const aereo = /rematador|a[eé]re|cabeza|^el alto$/i;

  const rematadores = (once.length ? once : inf.plantilla).filter((j) => j.linea !== "POR" && j.rasgos.some((r) => aereo.test(r.trim()))).slice(0, 2);

  const corners = d?.metricas.find((m) => m.key === "corners" && conDato(m));

  /* Si la prioridad de ABP de la semana es el córner defensivo, la línea lo dice. */
  const abpTexto = [inf.abp?.pincelada?.titular ?? "", ...(inf.abp?.pincelada?.claves ?? [])].join(" ");
  const cornerEnContra = /c[oó]rner[^.]*defens/i.test(abpTexto);

  /*
  | Lo mismo que la previa de ABP (24/10/2026, experto de fútbol): si su
  | informe ya ha llegado, la línea es su prioridad nº 1 («Defendemos la falta
  | lateral»), no otra calculada aquí.
  */
  const prioridadAbp = inf.momento === "post" ? "" : inf.abp?.pincelada?.prioridad?.consigna || consignaDe(inf.abp?.pincelada?.titular ?? "");

  /* El scouting puede llamar «fortaleza» a un balón parado que en los datos rinde poco: se dice (24/10/2026, experto de análisis). */
  const flojo = abpDelRivalFlojo(d);

  if (prioridadAbp && ES_CONSIGNA.test(prioridadAbp)) {
    const quienes = rematadores.length ? apellidos(rematadores.map((j) => j.nombre)) : "";

    lineas.push({ fase: "Balón parado", texto: primeraQueQuepa(quienes ? `${prioridadAbp}; marcamos a ${quienes}` : "", prioridadAbp) });
  } else if (rematadores.length) {
    const quienes = apellidos(rematadores.map((j) => j.nombre));
    const rasgo = rematadores[0].rasgos.find((r) => aereo.test(r.trim())) ?? "";

    lineas.push({
      fase: "Balón parado",
      texto: primeraQueQuepa(
        flojo ? `Marcamos a ${quienes}: su balón parado rinde poco (${flojo})` : "",
        cornerEnContra ? `Marcamos a ${quienes} en los córners en contra` : "",
        `Marcamos a ${quienes} en su balón parado: ${minusculaInicial(sinSiglas(rasgo))}`,
        `Marcamos a ${quienes} en su balón parado`,
        `Marcamos a ${apellido(rematadores[0].nombre)} en su balón parado`,
      ),
    });
  } else if (corners?.nosotros && (corners.nosotros.percentil ?? 0) >= 70 && d) {
    lineas.push({ fase: "Balón parado", texto: primeraQueQuepa(`Buscamos el córner: sacamos ${cifra(corners.nosotros.valor, corners.unidad)} por partido (${ordinal(corners.nosotros.puesto)})`) });
  }

  /* Con hueco (sin transición, por ejemplo), el duelo que más ganamos con balón entra como segunda línea. */
  if (lineas.length < 4 && debil && !debilEnContra && lineaDuelo && !(dueloDebil && atacar && dueloDebil.clave === atacar.clave)) lineas.splice(1, 0, { fase: "Con balón", texto: lineaDuelo });

  return lineas.filter((l) => l.texto).slice(0, 4);
}

/*
| EL PLAN, A REVISIÓN (post). Cada clave del plan se casa con las métricas
| del partido que la miden de verdad (21/10/2026): «control» con posesión y
| entradas al área, no con pases en el último tercio; «transición» con
| contraataques, no sólo con el % de recuperaciones altas. Si no casa con
| ninguna, la fila va sin veredicto: no se inventa.
|
| Y una regla de muestra: lo que queda dentro de lo habitual (a menos de una
| desviación típica de nuestra media, o de un 15 % si no la hay) es «=»,
| nunca un ✗. Un 16,4 % frente a 17,7 % es ruido de un partido, no «no salió».
*/
const TEMAS_PLAN: { tema: string; re: RegExp; metricas: string[]; consigna: string }[] = [
  { tema: "Balón parado", re: /bal[oó]n parado|\babp\b|c[oó]rner/i, metricas: ["cornersRemate", "corners"], consigna: "Sacamos más de nuestro balón parado" },
  { tema: "Transición", re: /transici|contraata|tras robo|al robar/i, metricas: ["contras", "recuperacionesAltas"], consigna: "Sacamos más de cada robo" },
  { tema: "Sin balón", re: /sin bal[oó]n|defens|presi[oó]n|bloque|replieg|someter/i, metricas: ["xgContra", "tirosContra"], consigna: "Concedemos menos cerca de nuestra área" },
  { tema: "Posesión", re: /posesi[oó]n|dominio|control|asociativ|elabora|circulaci/i, metricas: ["posesion", "entradasArea"], consigna: "Mandamos con el balón y lo llevamos al área" },
  { tema: "Llegada y remate", re: /[aá]rea|finaliz|remat|ocasi|\bgol/i, metricas: ["xg", "tiros"], consigna: "Llegamos más y mejor al área" },
  { tema: "Juego por fuera", re: /centro|banda|exterior|carril/i, metricas: ["centros", "entradasArea"], consigna: "Cargamos el área desde banda" },
  { tema: "Progresión", re: /progres|vertical|profund|romper l[ií]neas/i, metricas: ["pasesProgresivos", "pasesUltimoTercio"], consigna: "Progresamos más rápido hacia su área" },
];

type MetricaPartido = NonNullable<Duelo["partido"]>["metricas"][number];

/** «contraataques 0 frente a 0,71 de media». */
const datoFrenteAMedia = (m: MetricaPartido) =>
  `${nombreEnFrase(sinSiglas(m.nombre))} ${cifraPartido(m.nuestro!, m.unidad)}${conRecuentoTexto(m)} frente a ${cifra(m.media, m.unidad)} de media${
    m.unidad !== "porcentaje" && muestraCorta(m) && Math.abs((m.nuestro ?? 0) - (m.media ?? 0)) < 2 ? ` (con esa media, ${Math.floor(m.media ?? 0)} o ${Math.floor(m.media ?? 0) + 1} es lo normal)` : ""
  }`;

/**
 * ¿Mejor, peor o dentro de lo habitual? Lo habitual: a menos de una
 * desviación típica de nuestra media (la da Data con 4 o más partidos); sin
 * ella, a menos de un 15 %.
 */
function frenteAMedia(m: MetricaPartido): "si" | "no" | "igual" {
  const media = m.media ?? 0;
  const valor = m.nuestro ?? 0;

  /*
  | Fuera la regla «0 con media ≥ 0,5 = ✗» (24/10/2026): con 0,71 de media,
  | un 0 es lo normal casi la mitad de las veces. Un recuento bajo sólo cuenta
  | si se separa al menos dos de la media; un porcentaje de menos de 10 casos,
  | nunca.
  */
  if (muestraCorta(m) && (m.unidad === "porcentaje" || Math.abs(valor - media) < 2)) return "igual";

  /*
  | Una sola regla, la misma en todo el informe (25/10/2026, análisis y
  | fútbol): con la desviación de pocos partidos, 0,75 goles esperados en
  | contra frente a 1,57 de media (la mitad) salía «en nuestra media» y el
  | capítulo del pronóstico lo daba por cumplido. Lo habitual es a menos de una
  | desviación, pero nunca más de un 25 % de la media.
  */
  const margen = m.desviacion != null && m.desviacion > 0 ? Math.min(m.desviacion, Math.abs(media) * 0.25) : Math.abs(media) * 0.15;

  if (Math.abs(valor - media) <= margen) return "igual";

  return (m.mejorAlto ? valor > media : valor < media) ? "si" : "no";
}

/** La regla, como se lee al pie de «Lo que buscábamos»: la misma para la diapositiva, el completo y el vídeo. */
export const REGLA_VEREDICTO = "✓ mejor que nuestra media · = dentro de lo habitual · ✗ peor; lo habitual, a menos de una desviación y nunca más de un 25 % de la media";

/*
| La meta en corto (22/10/2026): el plan escribe «Optimizar y ajustar nuestra
| fase sin balón ante un equipo que…» y eso no se lee en una diapositiva. Se
| cuenta como en el vestuario, en primera del plural, según el veredicto.
*/
const LECTURA_TEMA: Record<string, Record<"si" | "no" | "igual", string>> = {
  Posesión: { si: "Mandamos con el balón", no: "No mandamos con el balón", igual: "Con el balón, en nuestra media" },
  "Sin balón": { si: "Sin balón concedimos poco", no: "Sin balón concedimos de más", igual: "Sin balón, en nuestra media" },
  Transición: { si: "Al robar, salimos y les hicimos daño", no: "Robamos y no salimos", igual: "Al robar, sin diferencia clara" },
  "Balón parado": { si: "Nuestro balón parado apareció", no: "Nuestro balón parado no apareció", igual: "Balón parado, en nuestra media" },
  "Llegada y remate": { si: "Llegamos y rematamos más que nunca", no: "Llegamos poco al área", igual: "En el área, en nuestra media" },
  "Juego por fuera": { si: "Cargamos el área desde banda", no: "Jugamos poco por fuera", igual: "Por fuera, en nuestra media" },
  Progresión: { si: "Progresamos rápido hacia su área", no: "Nos costó progresar", igual: "Progresando, en nuestra media" },
};

/* La posesión y los contraataques no tienen «mejor» en la liga (depende del estilo), pero para la meta que los pide, más es mejor. */
const SENTIDO_EN_META: Record<string, boolean> = { posesion: true, contras: true };

export function cumplimientoPlan(inf: { plan: Plan | null; duelo: Duelo | null }): FilaCumplimiento[] {
  const claves = inf.plan?.claves ?? [];

  const metricas = (inf.duelo?.partido?.metricas ?? []).map((m) => (m.mejorAlto === null && m.key in SENTIDO_EN_META ? { ...m, mejorAlto: SENTIDO_EN_META[m.key] } : m));

  return claves.map((clave) => {
    const tema = TEMAS_PLAN.find((t) => t.re.test(clave));

    const medibles = (tema?.metricas ?? [])
      .map((k) => metricas.find((m) => m.key === k))
      .filter((m): m is MetricaPartido => Boolean(m && m.nuestro !== null && m.media !== null && m.mejorAlto !== null))
      .slice(0, 2);

    if (!tema || !medibles.length) return { clave, tema: tema?.tema ?? "", veredicto: null, dato: "" };

    /* Las dos métricas votan: ✓ si alguna sale mejor y ninguna peor; ✗ al revés; si no, «=». */
    const votos = medibles.map(frenteAMedia);

    const veredicto = votos.includes("si") && !votos.includes("no") ? "si" : votos.includes("no") && !votos.includes("si") ? "no" : "igual";

    return { clave, tema: tema.tema, veredicto, dato: capital(medibles.map(datoFrenteAMedia).join(" · ")), lectura: LECTURA_TEMA[tema.tema]?.[veredicto] };
  });
}

/** Con qué métrica del rival se cruza cada tema (24/10/2026): lo que dice el rival de esa clave. */
const RIVAL_DE_TEMA: Record<string, string> = {
  "Sin balón": "xg",
  Transición: "perdidasBajas",
  "Llegada y remate": "xgContra",
};

/**
 * Cada clave del plan con su dato de hoy, el del rival y una meta medible
 * (24/10/2026, experto de análisis): «Esta temporada, contraataques 0,71
 * (8.º de 20) · ellos pierden en campo propio el 20,2 %, en la mediana
 * (20,8 %) · meta: más de 0,71». La meta es nuestra media de la temporada:
 * la misma con la que el post dirá si se cumplió. Un rival en la mediana se
 * dice: no se le vende como «se expondrá».
 */
export function metaDeClave(inf: Pick<InformePartido, "duelo">, clave: string) {
  const tema = TEMAS_PLAN.find((t) => t.re.test(clave));

  if (!tema) return "";

  const ms = inf.duelo?.metricas ?? [];

  const de = inf.duelo?.equipos ?? 0;

  const nuestra = tema.metricas.map((k) => ms.find((m) => m.key === k)).find((m) => m?.nosotros);

  if (!nuestra?.nosotros) return "";

  const puesto = (p: number) => (de ? ` (${ordinal(p)} de ${de})` : "");

  const hoy = `Esta temporada, ${nombreEnFrase(sinSiglas(nuestra.nombre))} ${cifra(nuestra.nosotros.valor, nuestra.unidad)}${puesto(nuestra.nosotros.puesto)}`;

  const suya = ms.find((m) => m.key === (RIVAL_DE_TEMA[tema.tema] ?? nuestra.key) && m.rival);

  const tercio = de ? Math.ceil(de / 3) : 0;

  const extremo = suya?.rival && tercio ? suya.rival.puesto <= tercio || suya.rival.puesto > de - tercio : true;

  const ellos = suya?.rival
    ? `ellos, ${nombreEnFrase(sinSiglas(suya.nombre))} ${cifra(suya.rival.valor, suya.unidad)}${puesto(suya.rival.puesto)}${!extremo && suya.mediana !== null ? `, en la mediana (${cifra(suya.mediana, suya.unidad)})` : ""}`
    : "";

  const alto = nuestra.mejorAlto ?? SENTIDO_EN_META[nuestra.key] ?? null;

  const meta = alto === null ? "" : `meta: ${alto ? "más de" : "menos de"} ${cifra(nuestra.nosotros.valor, nuestra.unidad)}`;

  return [hoy, ellos, meta].filter(Boolean).join(" · ");
}

/** La consigna de un tema del plan: «Sacamos más de cada robo». */
export const consignaDeTema = (tema: string) => TEMAS_PLAN.find((t) => t.tema === tema)?.consigna ?? "";

/**
 * Una clave del cuerpo técnico, en corto y como consigna (24/10/2026): «Optimizar
 * y ajustar nuestra fase sin balón ante un equipo que…» → «Concedemos menos
 * cerca de nuestra área». Sin tema reconocible, la clave recortada en una pausa.
 */
export function claveEnCorto(clave: string) {
  const tema = TEMAS_PLAN.find((t) => t.re.test(clave));

  return tema ? tema.consigna : cortaEnPausa(clave, 70);
}

/**
 * «Qué toca en el microciclo» (post, 20/10/2026). Sustituye a «Dónde hay que
 * crecer», que repetía métricas de la temporada que no salían del partido.
 * Tres contenidos, por reglas, con lo ya medido: la clave del plan que no se
 * cumplió, la palanca que no se movió, el gol encajado con el partido
 * ganado al final y el duelo de riesgo que se confirmó (marcó o asistió).
 *
 * Cada uno, «consigna · dato» (21/10/2026): la consigna en primera del
 * plural, verbo + qué + dónde («Cerramos los partidos con ventaja»), y el
 * dato que la pide. Antes era una etiqueta («Transición · no salió»).
 */
/** Las métricas del partido que, si quedan claramente por debajo, piden trabajo: su consigna (22/10/2026). */
const CONSIGNA_METRICA: Record<string, string> = {
  corners: "Atacamos para acabar en córner",
  centros: "Llegamos más a centro desde banda",
  entradasArea: "Pisamos más el área",
  tirosPuerta: "Rematamos más entre los tres palos",
  contras: "Salimos más rápido al contraataque",
  recuperacionesAltas: "Robamos más arriba",
  perdidasBajas: "Cuidamos el balón en campo propio",
  duelosAereos: "Ganamos más duelos por alto",
  duelosDefensivos: "Ganamos los duelos defensivos",
  pasesProgresivos: "Progresamos más con el pase",
};

export function queTocaEnElMicro(inf: Omit<InformePartido, "sintesis">, cumplimiento: FilaCumplimiento[]) {
  /*
  | Por orden (22/10/2026): lo del plan que no salió, el gol que se nos escapó
  | al final, el balón parado que nos dio peligro, las metas del plan, la
  | métrica que quedó claramente por debajo y el duelo de riesgo que se
  | confirmó. Hasta tres; cada uno, «consigna · dato».
  */
  const plan: string[] = [];

  for (const f of cumplimiento.filter((x) => x.veredicto === "no")) {
    const primero = f.dato.split(" · ")[0];

    plan.push(`${consignaDeTema(f.tema) || f.tema} · ${minusculaInicial(primero)}`);
  }

  const metas: string[] = [];

  for (const x of revisaPalancas(inf).filter((r) => r.cumplida === false)) {
    const real = x.real.replace(/ en el partido$/, "");

    const meta = x.meta.replace(/^.*[≤≥]\s*/, "");

    if (x.momento === "Sin balón") metas.push(`Concedemos menos ocasiones · la meta era dejarles en ${meta} goles esperados y fueron ${real}`);
    else if (x.momento === "Con balón") metas.push(`Generamos más ocasiones · la meta eran ${meta} goles esperados y fueron ${real}`);
    else if (x.momento === "Balón parado") metas.push(`Sacamos más de nuestro balón parado · ${x.real.replace(/ = .*$/, "")}; la meta era +0,12`);
  }

  /* Un gol suyo en los últimos diez minutos con el partido a favor. */
  const goles = inf.cronica?.goles ?? [];

  const roja = (inf.cronica?.tarjetas ?? []).find((t) => t.tipo === "roja");

  const tarde = marcadorPorGoles(goles).find((x) => !x.g.nuestro && minutoNum(x.g.minuto) >= 80 && x.antes.nos > x.antes.ellos);

  /*
  | Con su base de temporada (25/10/2026, experto de análisis): «Cerramos los
  | partidos» en plural no puede salir de un solo gol sin decir si se repite.
  */
  const base = inf.golesTemporada?.cerradosConVentaja;

  const baseCierre = base && base.partidos > 1 ? (base.veces <= 1 ? `; la primera vez en ${base.partidos} partidos` : `; nos ha pasado en ${base.veces} de ${base.partidos} partidos`) : "";

  /*
  | Lo aislado va al vídeo, lo que se repite al microciclo (25/10/2026, ronda
  | 7, experto de fútbol): si es la primera vez en la temporada, el gol tardío
  | no encabeza «Esta semana»; se enseña el lunes (ver `golesEnContraDe`).
  */
  const aislado = Boolean(base && base.partidos > 1 && base.veces <= 1);

  const cierre = tarde && !aislado
    ? `Cerramos los partidos con ventaja · nos marcaron en el ${tarde.g.minuto}′ con ${tarde.antes.nos}-${tarde.antes.ellos}${roja && minutoNum(roja.minuto) < minutoNum(tarde.g.minuto) ? " y uno más" : ""}${baseCierre}`
    : "";

  /* El balón parado que nos dio peligro en contra (lo trae la pincelada del informe de ABP). */
  const susto = inf.abp?.pincelada?.sustoEnContra;

  const abp = susto && !susto.corta ? `${susto.consigna} · ${susto.dato}` : "";

  /* Sin muestra, el balón parado se vigila, pero detrás de lo que tiene peso (25/10/2026). */
  const abpCorto = susto && susto.corta ? `${susto.consigna} · ${susto.dato}` : "";

  /*
  | La métrica que quedó claramente por debajo de lo nuestro: a más de una
  | desviación y media de la media (o un 40 % sin desviación). Sólo las que
  | tienen consigna de campo.
  */
  const debajo = (inf.duelo?.partido?.metricas ?? [])
    .filter((m) => CONSIGNA_METRICA[m.key] && m.nuestro !== null && m.media !== null && m.media !== 0 && m.mejorAlto !== null && !muestraCorta(m))
    .map((m) => {
      const peor = m.mejorAlto ? m.media! - m.nuestro! : m.nuestro! - m.media!;

      const margen = m.desviacion != null && m.desviacion > 0 ? 1.5 * m.desviacion : 0.4 * Math.abs(m.media!);

      /* Calidad antes que volumen (22/10/2026): tras 3,5 goles esperados, «acabar en córner» no es lo primero que toca. */
      const volumen = m.key === "corners" || m.key === "centros" ? 0.6 : 1;

      return { m, peor, fuerza: (peor / margen) * volumen };
    })
    .filter((x) => x.fuerza >= 1)
    .sort((a, b) => b.fuerza - a.fuerza)[0];

  const metrica = debajo ? `${CONSIGNA_METRICA[debajo.m.key]} · ${minusculaInicial(sinSiglas(debajo.m.nombre))}: ${cifraPartido(debajo.m.nuestro!, debajo.m.unidad)} frente a ${cifra(debajo.m.media, debajo.m.unidad)} de media` : "";

  /* El duelo de riesgo que se confirmó: alguno de ellos marcó o asistió. */
  const suyos = goles.filter((g) => !g.nuestro && g.tipo !== "propia");

  let duelo = "";

  for (const x of duelosParaVigilar(inf.duelosJugadores).filter((v) => dueloEnSuOnce(v, inf.once.jugadores))) {
    const golDe = suyos.find((g) => x.suyos.some((s) => mismoJugador(s, g.jugador)));
    const asistencia = suyos.find((g) => g.asistente && x.suyos.some((s) => mismoJugador(s, g.asistente)));

    const hecho = golDe ? `marcó ${apellido(golDe.jugador)} (${golDe.minuto}′)` : asistencia ? `asistió ${apellido(asistencia.asistente)} (${asistencia.minuto}′)` : "";

    if (hecho) {
      duelo = `Cerramos ${LUGAR_DEFENSA[x.clave] ?? "atrás"} · ${hecho}, como temíamos`;

      break;
    }
  }

  /* Lo que tiene peso primero (24/10/2026): el gol que se nos escapó con el partido ganado y el balón parado que nos remató; luego el plan. */
  return [cierre, abp, ...plan, ...metas, metrica, duelo, abpCorto].filter(Boolean).slice(0, 3);
}

/**
 * El titular de la diapositiva 2 del post (21/10/2026): cuántas claves del
 * plan se cumplieron y cuál falló, en una frase. Sin claves medidas, lo
 * primero que toca en el microciclo.
 */
export function titularDelPlan(cumplimiento: FilaCumplimiento[], microciclo: string[]) {
  const medidas = cumplimiento.filter((f) => f.veredicto);

  const si = medidas.filter((f) => f.veredicto === "si");
  const no = medidas.filter((f) => f.veredicto === "no");
  const igual = medidas.filter((f) => f.veredicto === "igual");

  /*
  | Una lección y no una cuenta (25/10/2026, marketing y guion): el recuento
  | delante («Cumplimos 2 de 3», el mismo que el vídeo) y detrás lo que pasó,
  | en palabras: «Cumplimos 2 de 3: mandamos con el balón y concedimos poco;
  | al robar, sin diferencia clara».
  */
  const corto = (f: FilaCumplimiento) => {
    const l = f.lectura ?? f.tema;

    return minusculaInicial(l.replace(/^Sin balón concedimos/, "concedimos"));
  };

  if (medidas.length) {
    const bien = si.length ? yFinal(si.map(corto)) : "";
    const resto = [...no, ...igual].map(corto).join("; ");

    return `Cumplimos ${si.length} de ${medidas.length}${bien ? `: ${bien}` : ""}${resto ? `${bien ? "; " : ": "}${resto}` : ""}`;
  }

  const toca = microciclo[0]?.split(" · ")[0];

  return toca ? `Esta semana: ${minusculaInicial(toca)}` : "";
}

/** El titular de la diapositiva de los duelos (21/10/2026): el cruce que más ganamos y el que más sufrimos. */
/**
 * El duelo que sostiene LA IDEA cuando nombra a un defensor suyo («Atacamos
 * la espalda de Gomez», 24/10/2026, fútbol y guion: los tres titulares
 * cuentan la misma idea). Primero el duelo en que sale él; si no sale, el de
 * nuestro delantero ante sus centrales, que es el que la explota.
 */
export function dueloDeLaIdea(inf: Pick<InformePartido, "duelosJugadores">, idea: string) {
  const nombre = /espalda de (\p{Lu}[\p{L}'’-]+)/u.exec(idea)?.[1] ?? "";

  if (!nombre) return null;

  const lista = inf.duelosJugadores?.lista ?? [];

  const suyo = plano(nombre).join(" ");

  const conEl = lista.find((x) => x.suyos.some((n) => plano(apellido(n)).join(" ") === suyo));

  const delantero = lista.find((x) => x.clave === "del-cen");

  const duelo = conEl ?? delantero ?? null;

  return duelo ? { nombre, duelo, conEl: Boolean(conEl) } : { nombre, duelo: null, conEl: false };
}

export function titularDuelos(inf: Pick<InformePartido, "duelosJugadores" | "once" | "momento">, idea = "") {
  /* Previa: la 2/3 cuenta LA IDEA desde el duelo que la explota (24/10/2026). */
  const deLaIdea = inf.momento === "post" ? null : dueloDeLaIdea(inf, idea);

  if (deLaIdea?.duelo) {
    const quien = apellidos(deLaIdea.duelo.nuestros);

    const vigila = duelosParaVigilar(inf.duelosJugadores)
      .filter((x) => dueloEnSuOnce(x, inf.once.jugadores))
      .sort((a, b) => (ventajaVisible(a, "sin") ?? 0) - (ventajaVisible(b, "sin") ?? 0))[0];

    const cuidado = vigila ? `; cuidado con ${apellidos(vigila.suyos)} ${LUGAR_DEFENSA[vigila.clave] ?? ""}` : "";

    if (quien) return `La espalda de ${deLaIdea.nombre} la atacamos con ${quien}${cuidado}`.replace(/\s+/g, " ").trim();
  }

  const enOnce = (x: DueloJugadores) => dueloEnSuOnce(x, inf.once.jugadores);

  /* Los mismos tres que pinta la lámina, y el primero por la cifra que se ve. */
  const atacar = duelosParaAtacar(inf.duelosJugadores)
    .filter(enOnce)
    .slice(0, 3)
    .sort((a, b) => (ventajaVisible(b, "con") ?? 0) - (ventajaVisible(a, "con") ?? 0))[0];
  const vigilar = duelosParaVigilar(inf.duelosJugadores)
    .filter(enOnce)
    .slice(0, 3)
    .sort((a, b) => (ventajaVisible(a, "sin") ?? 0) - (ventajaVisible(b, "sin") ?? 0))[0];

  const signo = (n: number | null) => (n === null ? "" : n > 0 ? ` (+${n})` : ` (−${Math.abs(n)})`);

  const post = inf.momento === "post";

  const gana = atacar ? `${post ? "Esperábamos ganar" : "Les ganamos"} ${LUGAR_ATAQUE[atacar.clave] ?? ""} con ${apellidos(atacar.nuestros)}${signo(ventajaVisible(atacar, "con"))}` : "";
  const sufre = vigilar ? `${post ? "sufrir" : "sufrimos"} ${LUGAR_DEFENSA[vigilar.clave] ?? ""} ante ${apellidos(vigilar.suyos)}${signo(ventajaVisible(vigilar, "sin"))}` : "";

  /*
  | Previa: una idea, sin cifras (24/10/2026, marketing y guion): «+70» y «−47»
  | no le dicen nada al entrenador en un titular; la escala va en la lámina.
  | «Atacamos por la derecha con Fortuny; cuidado con Garcia entre líneas».
  */
  if (!post) {
    const ataca = atacar ? `Atacamos ${LUGAR_ATAQUE[atacar.clave] ?? ""} con ${apellidos(atacar.nuestros)}` : "";
    const cuidado = vigilar ? `cuidado con ${apellidos(vigilar.suyos)} ${LUGAR_DEFENSA[vigilar.clave] ?? ""}` : "";

    return (ataca && cuidado ? `${ataca}; ${cuidado}` : ataca || (cuidado ? capital(cuidado) : "")).replace(/\s+/g, " ").trim();
  }

  if (gana && sufre) return `${gana}; ${post ? "y " : ""}${sufre}`.replace(/\s+/g, " ");

  return (gana || (sufre ? sufre.charAt(0).toUpperCase() + sufre.slice(1) : "")).replace(/\s+/g, " ");
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

/**
 * El titular del post según el giro del partido. `sinMarcador`: para el
 * WhatsApp, cuya cabecera ya lleva el marcador (21/10/2026: salía dos veces).
 */
export function titularPost(inf: Omit<InformePartido, "sintesis">, { sinMarcador = false } = {}) {
  const giro = giroDelPartido(inf);

  const p = inf.partido;

  /* Sin el nombre del rival no se escribe «ante el el rival» (20/10/2026): se omite. */
  const ante = p.rival ? ` ante el ${p.rival}` : "";

  if (!giro) return `Post partido${ante}`;

  const m = sinMarcador ? "" : ` ${p.gf}-${p.gc}`;
  const mp = sinMarcador ? "" : ` (${p.gf}-${p.gc})`;

  /* Un decimal y sin sigla: «3,5 goles esperados contra 0,8». */
  const xg = giro.xgNos !== null && giro.xgSuyo !== null ? `${unDecimal(giro.xgNos)} goles esperados contra ${unDecimal(giro.xgSuyo)}` : "";

  /*
  | Su roja matiza el dominio (21/10/2026), pero se cuenta UNA vez: en el
  | subtítulo, que va siempre bajo el titular (22/10/2026).
  */

  /*
  | La lección va en el titular (22/10/2026): con el partido ganado nos
  | marcaron al final. Antes, con «Remontamos» (fuimosPerdiendo) la rama
  | «sufrida» no se usaba nunca y la lección salía dos diapositivas después.
  | Los goles esperados bajan al subtítulo.
  */
  if (giro.resultado === "victoria" && giro.tardio) {
    const conUnoMas = giro.unoMas && minutoNum(giro.unoMas.minuto) < minutoNum(giro.tardio) ? "con uno más " : "";

    /*
    | Una idea (24/10/2026, marketing): «Remontamos 3-2 y dominamos, pero…»
    | eran dos verbos y la remontada fue el 2-1, no el 3-2. El dominio baja
    | al subtítulo.
    */
    return `Ganamos${m}, pero ${conUnoMas}nos marcaron en el ${giro.tardio}′`;
  }

  if (giro.dominio === "nuestro") {
    if (giro.resultado !== "victoria") return `Dominamos y no ganamos${mp}: ${xg}`;

    /* Con el marcador (20/10/2026): «Remontamos 3-2 y dominamos…»; sin él, el titular no decía cómo acabó. */
    return giro.sufrida && !giro.fuimosPerdiendo ? `Dominamos y sufrimos al final${mp}: ${xg}` : `${giro.verbo}${m} y dominamos: ${xg}`;
  }

  if (giro.dominio === "suyo" && giro.resultado !== "derrota") return `${giro.verbo}${mp} aunque ellos generaron más: ${xg}`;

  return `${giro.verbo}${m}${ante}`;
}

/** «Esta semana: cerrar los partidos con ventaja y defender la falta lateral directa». */
export function titularEstaSemana(microciclo: string[]) {
  const tareas = microciclo.slice(0, 3).map((t) => minusculaInicial(enInfinitivo(t.split(" · ")[0].trim()))).filter(Boolean);

  return tareas.length ? `Esta semana: ${yFinal(tareas)}` : "";
}

/**
 * Una consigna en infinitivo, para el asunto (23/10/2026): «Ganamos la
 * segunda jugada» → «Ganar la segunda jugada»; «Les quitamos…» → «Quitarles…».
 */
export function enInfinitivo(consigna: string) {
  const m = consigna.match(/^(?:(Les|Le|Nos)\s+)?([A-Za-zÁÉÍÓÚáéíóúñ]+?)([aei])mos\b(.*)$/);

  if (!m) return consigna;

  const [, pronombre, raiz, vocal, resto] = m;

  return capital(`${raiz.toLowerCase()}${vocal}r${pronombre ? pronombre.toLowerCase() : ""}${resto}`);
}

/** El asunto de cada correo, con dato (20/10/2026). Sin dato, el de siempre. */
export function asuntoInforme(inf: InformePartido, tipo: "resumen" | "completo") {
  const p = inf.partido;

  const rival = p.rival || "el rival";

  const j = p.jornada ? `J${p.jornada} ` : "";

  const esPost = inf.momento === "post";

  /*
  | El completo, corto y distinto del resumen en la bandeja (23/10/2026,
  | marketing): «Consulta · J9 Algeciras CF: rival, duelos y balón parado».
  | Lo que lleva dentro, de lo que hay; como mucho 60 caracteres.
  */
  if (tipo === "completo") {
    const partes = esPost
      ? ["el partido", inf.plan?.claves.length || inf.sintesis.cumplimiento.length ? "el plan" : "", inf.duelosJugadores ? "los duelos" : ""]
      : [inf.vistazo || inf.colectivo ? "rival" : "", inf.duelosJugadores ? "duelos" : "", inf.abp ? "balón parado" : ""];

    const lista = partes.filter(Boolean);

    for (let n = lista.length; n >= 0; n--) {
      const texto = `Consulta · ${j}${rival}${n ? `: ${yFinal(lista.slice(0, n))}` : ""}`;

      if (texto.length <= 60 || !n) return texto.slice(0, 60);
    }
  }

  if (esPost) {
    const giro = giroDelPartido(inf);

    if (!giro) return `Post · ${j}${rival}`;

    const prep = giro.resultado === "victoria" ? "al" : "ante el";

    /*
    | Sin siglas y corto (21/10/2026): «dominio claro (xG 3,46 a 0,75)» no lo
    | entiende un entrenador y la bandeja del móvil lo cortaba antes del dato.
    | Primero el marcador y el giro; luego, la idea más fuerte que quepa en
    | unos 75 caracteres.
    */
    /* Con gol suyo al final, «Ganamos», como el titular: la remontada fue el 2-1, no el 3-2 (24/10/2026). */
    const verbo = giro.resultado === "victoria" && giro.tardio ? "Ganamos" : giro.verbo;

    const base = `${j ? `${j.trim()} · ` : ""}${verbo} ${p.gf}-${p.gc}${p.rival ? ` ${prep} ${p.rival}` : ""}`;

    /* Cada hueco, su mejor versión que quepa (de la más rica a la más corta). */
    const huecos: string[][] = [
      giro.dominio === "nuestro" ? (giro.unoMas ? [" y dominamos con uno más", " y dominamos"] : [" y dominamos las ocasiones", " y dominamos"]) : giro.dominio === "suyo" ? [", aunque ellos generaron más"] : [],
      giro.sufrida && giro.tardio ? [`, pero nos marcaron en el ${giro.tardio}′`] : giro.resultado === "victoria" && (p.gc ?? 0) >= 2 ? [`, pero encajamos ${p.gc}`] : [],
    ];

    /* La combinación que llena más huecos sin pasar de 80 caracteres y, a igualdad, la más rica. */
    const combinaciones = huecos.reduce<string[][]>((acc, opciones) => acc.flatMap((c) => [...opciones.map((o) => [...c, o]), [...c, ""]]), [[]]);

    const mejor = combinaciones
      .map((c) => ({ texto: base + c.join(""), llenos: c.filter(Boolean).length }))
      .filter((c) => c.texto.length <= 80)
      .sort((a, b) => b.llenos - a.llenos || b.texto.length - a.texto.length)[0];

    /* La acción, como en la previa (24/10/2026, marketing): «J8 · Ganamos 3-2 al Antequera CF · Esta semana: cerrar con ventaja». */
    const toca = inf.sintesis.microciclo[0]?.split(" · ")[0];

    const conAccion = toca ? `${base} · Esta semana: ${minusculaInicial(enInfinitivo(toca))}` : "";

    return conAccion && conAccion.length <= 90 ? conAccion : (mejor?.texto ?? base);
  }

  const pr = inf.pronostico;

  /*
  | Jornada, rival, dónde y LA IDEA en infinitivo (23/10/2026, marketing):
  | «J9 Algeciras CF (fuera, dom 16:30) · Ganar la segunda jugada». La hora
  | entra sólo si cabe en ~70 caracteres; el pronóstico, sólo sin consigna.
  */
  const lado = p.lado === "fuera" ? "fuera" : p.lado === "casa" ? "en casa" : "";

  const idea = inf.sintesis.consigna[0] ? enInfinitivo(inf.sintesis.consigna[0]) : "";

  if (idea) {
    const conHora = `${j}${rival} (${[lado, cuandoCorto(p.cuando)].filter(Boolean).join(", ")}) · ${idea}`.replace(" ()", "");

    return conHora.length <= 72 ? conHora : `${j}${rival}${lado ? ` (${lado})` : ""} · ${idea}`;
  }

  const donde = [lado, cuandoCorto(p.cuando)].filter(Boolean).join(", ");

  const cabeza = `${rival} (${[p.jornada ? `J${p.jornada}` : "", donde].filter(Boolean).join(", ")})`.replace(" ()", "");

  if (!pr) return `Previa · ${cabeza}`;

  return `${cabeza}: ${pct(pr.victoria)} de victoria, ${pct(pr.conPlan.victoria)} con el plan`;
}

/** El texto que se ve junto al asunto en la bandeja: la acción, no la etiqueta. */
export function preencabezadoInforme(inf: InformePartido) {
  const s = inf.sintesis;

  if (inf.momento === "post") {
    const [consigna, dato] = (s.microciclo[0] ?? "").split(" · ");

    return consigna ? `Esta semana: ${minusculaInicial(consigna)}${dato ? ` (${dato})` : ""}` : s.subtitular || s.titular;
  }

  /* La idea del partido y cuándo (23/10/2026): «Ganamos la segunda jugada y atacamos la espalda de Gomez. Dom 16:30». */
  if (s.ideaPrevia) return [`${s.ideaPrevia}.`, capital(cuandoCorto(inf.partido.cuando))].filter(Boolean).join(" ");

  return s.plan[0] ? `Cómo lo ganamos: ${minusculaInicial(s.plan[0].texto)}` : inf.pronostico?.idea || s.titular;
}

/**
 * El titular de la previa sale de la idea principal (24/10/2026, marketing y
 * guion): afirmativo, una sola idea y sin pregunta. «Buscan en largo a la
 * última línea: toca ganar la segunda jugada»; «Su punto débil, Gomez (lento
 * y pierde duelos): toca atacar su espalda». Sin una de estas tres, manda el
 * dato (la cadena de siempre en `sintetiza`).
 */
function titularDePrevia(inf: Omit<InformePartido, "sintesis">, principal: string) {
  if (!principal) return "";

  const toca = `toca ${minusculaInicial(enInfinitivo(principal))}`;

  if (/segunda jugada|rechace/i.test(principal)) {
    const s = segundaJugada(inf);

    if (s) return s.dePosesion ? `Buscan en largo a la última línea: ${toca}` : `Juegan en largo: ${toca}`;
  }

  const debil = defensorDebil(inf);

  const nombra = debil ? plano(debil.jugador.nombre).some((t) => t.length >= 4 && plano(principal).includes(t)) : false;

  if (debil && nombra) {
    const ap = apellido(debil.jugador.nombre);

    /*
    | La 1/3 presenta al rival y su punto débil; LA IDEA (3/3) dice qué hacemos
    | con él (24/10/2026, guion y marketing: «Atacamos la espalda de Gomez»
    | salía cuatro veces casi igual). «Algeciras CF sale en corto y busca en
    | largo; Gomez es lento y pierde duelos».
    */
    /* Una sola idea por titular (24/10/2026, guion): el punto débil, sin el «sale en corto y busca en largo» delante, que es otra historia. */
    if (inf.partido.rival) return `El punto débil del ${inf.partido.rival}: ${ap}${debil.rasgos.length ? `, ${yFinal(debil.rasgos)}` : ""}`;

    return debil.rasgos.length ? `Su punto débil: ${ap}, ${yFinal(debil.rasgos)}` : `Su punto débil: ${ap}`;
  }

  const arma = inf.pronostico?.suFuerte;

  if (arma && /^Les quitamos/i.test(principal)) return `Su arma: ${nombreEnFrase(sinSiglas(arma.nombre))} (${ordinal(arma.puesto)} de ${arma.de}): toca quitársela`;

  return "";
}

/**
 * La línea del plan con su porqué para el WhatsApp de la previa (24/10/2026):
 * «Atacamos la espalda de Gomez con Carvajal: lento y pierde duelos.»
 */
function consignaConPorque(s: Pick<Sintesis, "consigna" | "plan">) {
  const principal = s.consigna[0];

  if (!principal) return "";

  const linea = s.plan.find((l) => consignaDe(l.texto) === principal)?.texto ?? principal;

  return /[.?!]$/.test(linea) ? linea : `${linea}.`;
}

/** Las claves del cuerpo técnico que sirve cada fase del plan (24/10/2026, guion: la idea y el plan del cuerpo técnico eran dos historias). */
const FASE_DE_CLAVE: [string, RegExp][] = [
  ["Con balón", /posesi|con bal[oó]n|ataque|ofensiv|dominio/i],
  ["Sin balón", /sin bal[oó]n|defens|presi[oó]n|bloque/i],
  ["Transiciones", /transici|contraata|robo|p[eé]rdida/i],
  ["Balón parado", /bal[oó]n parado|\babp\b|c[oó]rner|faltas?\b/i],
];

/** El número (desde 1) de la clave del cuerpo técnico que sirve esta fase, o 0 si ninguna. */
export function claveDeFase(claves: string[], fase: string) {
  const re = FASE_DE_CLAVE.find(([f]) => f === fase)?.[1];

  if (!re) return 0;

  return claves.findIndex((c) => re.test(c)) + 1;
}

/** Palabras con mayúscula tras una preposición que no son nombres de jugador. */
const NO_ES_NOMBRE = /^(?:Z\d|Zona|Estructura|Atenci[oó]n|Ventaja|Prioridad|Ocupaci[oó]n|Vigilancia|Reinicios?|C[oó]rner|Falta|Penalti|Banda|Área|Area|Defensa|Ataque|Transici[oó]n|Bal[oó]n|Saque|Medio|Central|Lateral|Extremo|Punta|Portero|Mediapunta|Pivote)$/i;

/**
 * El plan de la previa, sin lo heredado de otro rival (24/10/2026, experto de
 * fútbol): «Z1: 4-2-3-1 (Intención de levantar a Dani)» nombraba al portero
 * del Antequera en la previa del Algeciras (y el Algeciras también tiene un
 * Dani: el nombre solo no basta). No se publica, y va a los avisos del
 * analista, una línea que:
 * - está copiada del plan del partido anterior y nombra a un jugador de
 *   aquel rival;
 * - nombra a alguien que no está en su plantilla ni en la nuestra;
 * - el boceto dejó con «?».
 */
export function planSinHeredado(
  plan: Plan | null,
  conocidos: string[],
  rival: string,
  avisos: string[],
  anterior?: { rival: string; plan: Plan | null; nombres: string[] } | null,
): Plan | null {
  if (!plan) return plan;

  const tokens = new Set(conocidos.flatMap((n) => plano(n)).filter((t) => t.length >= 3));

  /* El plan anterior, línea a línea, y su plantilla («Dani» → «Dani Alcover»). */
  const textosAnterior = anterior?.plan
    ? [anterior.plan.ataque, anterior.plan.defensa, anterior.plan.abpOf, anterior.plan.abpDef, anterior.plan.emocionales, anterior.plan.estado, anterior.plan.estructuraOf, anterior.plan.estructuraDef, anterior.plan.fortalezas, anterior.plan.debilidades, ...anterior.plan.claves, ...anterior.plan.duelos.map((d) => d.texto)]
    : [];

  const lineasAnterior = new Set(textosAnterior.flatMap((t) => t.split("\n")).map((l) => plano(l).join(" ")).filter(Boolean));

  const deAnterior = (n: string) => anterior?.nombres.find((x) => plano(x).some((t) => plano(n).includes(t)));

  const NOMBRE = /(?:^|[\s(])(?:a|al|de|del|con|ante|sobre|para|levantar a)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})/g;

  const quitadas: string[] = [];

  const limpia = (texto: string, campo: string) =>
    texto
      .split("\n")
      .filter((linea) => {
        const t = linea.trim();

        if (/^\?\s/.test(t)) {
          quitadas.push(`«${campo}: ${t.replace(/^\?\s*/, "")}» lleva la marca «?» del boceto`);

          return false;
        }

        const nombres = [...t.matchAll(NOMBRE)].map((m) => m[1]).filter((n) => !NO_ES_NOMBRE.test(n));

        const copiada = lineasAnterior.has(plano(t).join(" "));

        const suyo = copiada ? nombres.map((n) => ({ n, de: deAnterior(n) })).find((x) => x.de) : undefined;

        if (suyo?.de) {
          quitadas.push(`«${campo}: ${t}» viene del plan contra el ${anterior?.rival} y nombra a ${suyo.n} (${suyo.de}, de aquel rival)`);

          return false;
        }

        const desconocido = nombres.find((n) => !plano(n).some((x) => tokens.has(x)));

        if (desconocido) {
          quitadas.push(`«${campo}: ${t}» nombra a ${desconocido}, que no está en la plantilla del ${rival || "rival"} ni en la nuestra`);

          return false;
        }

        return true;
      })
      .map((l) => l.replace(/^(\s*)\*\s+/, "$1"))
      .join("\n")
      .trim();

  const limpio: Plan = {
    ...plan,
    claves: plan.claves.map((c) => limpia(c, "Claves")).filter(Boolean),
    ataque: limpia(plan.ataque, "Con balón"),
    defensa: limpia(plan.defensa, "Sin balón"),
    abpOf: limpia(plan.abpOf, "ABP ofensivo"),
    abpDef: limpia(plan.abpDef, "ABP defensivo"),
    emocionales: limpia(plan.emocionales, "Claves emocionales"),
    estado: limpia(plan.estado, "Cómo llega el rival"),
    estructuraOf: limpia(plan.estructuraOf, "Estructura ofensiva"),
    estructuraDef: limpia(plan.estructuraDef, "Estructura defensiva"),
    fortalezas: limpia(plan.fortalezas, "Sus fortalezas"),
    debilidades: limpia(plan.debilidades, "Sus debilidades"),
    duelos: plan.duelos.map((d) => ({ ...d, texto: limpia(d.texto, `Duelos · ${d.titulo.toLowerCase()}`) })).filter((d) => d.texto),
  };

  if (quitadas.length) avisos.push(`El plan de partido trae ${quitadas.length === 1 ? "una línea que no se publica" : `${quitadas.length} líneas que no se publican`}: ${quitadas.join("; ")}. Revísalo en Preparación de Partido.`);

  return limpio;
}

/**
 * Los avisos de la semana de la previa (24/10/2026): lo que no tiene tarea no
 * se escribe en el informe («→ sin tarea esta semana» era un aviso para el
 * analista dentro del documento del cuerpo técnico); se le dice a él.
 */
export function avisosDeLaSemana(inf: InformePartido) {
  if (inf.momento === "post" || !inf.microciclo?.tareas.length) return [];

  const s = inf.sintesis;

  const avisos: string[] = [];

  if (s.ideaSinTarea) avisos.push(`«${s.ideaSinTarea}» es lo que más piden los datos, pero no tiene tarea esta semana: no es la idea principal del informe. Si se entrena, apúntalo en el registro de tareas.`);

  const sinTarea = s.consignaTareas.filter((c) => !c.tareas.length && c.consigna !== s.ideaSinTarea).map((c) => c.consigna);

  if (sinTarea.length) avisos.push(`Sin tarea esta semana: ${yFinal(sinTarea.map((c) => `«${c}»`))}. En el informe salen sin tareas a su lado.`);

  const anterior = s.delPostAnterior.filter((c) => !c.tareas.length).map((c) => c.consigna);

  if (anterior.length) avisos.push(`Lo que pidió el ${s.delPostAnterior[0]?.origen || "post anterior"} y no tiene tarea esta semana: ${yFinal(anterior.map((c) => `«${c}»`))}.`);

  /* LA IDEA nombra a un defensor que no sale en los duelos (24/10/2026): el duelo de nuestro delantero se calculó con otros centrales. */
  const deLaIdea = dueloDeLaIdea(inf, s.consigna[0] ?? "");

  if (deLaIdea && !deLaIdea.conEl) avisos.push(`LA IDEA ataca a ${deLaIdea.nombre}, pero ${deLaIdea.nombre} no sale en los duelos (su once en Duelos tiene a ${deLaIdea.duelo ? apellidos(deLaIdea.duelo.suyos) : "otros centrales"}): revisa el once del rival en Duelos para que la cifra sea la de ${deLaIdea.nombre}.`);

  return avisos;
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

  /*
  | Sin mayúsculas en la cabecera (en WhatsApp suenan a grito) y sin repetir
  | el marcador en la línea de debajo (21/10/2026).
  */
  if (inf.momento === "post") {
    const marcador = p.gf !== null && p.gc !== null ? (p.lado === "fuera" ? `${p.rival} ${p.gc}-${p.gf} RM Castilla` : `RM Castilla ${p.gf}-${p.gc} ${p.rival}`) : p.rival;

    const giro = titularPost(inf, { sinMarcador: true });

    /* Las tres tareas, no sólo la primera (24/10/2026, marketing), en infinitivo y separadas. */
    const tocas = s.microciclo.map((x) => minusculaInicial(enInfinitivo(x.split(" · ")[0]))).filter(Boolean);

    return {
      titular: `${j}${marcador}`,
      lineas: [/[.?!]$/.test(giro) ? giro : `${giro}.`, s.subtitular ? `${s.subtitular}.` : "", tocas.length ? `Esta semana: ${tocas.join(" · ")}.` : ""].filter(Boolean),
    };
  }

  const pr = inf.pronostico;

  const cabeza = [`${j}${p.rival}`, cuandoCorto(p.cuando), p.lado === "fuera" ? "fuera" : p.lado === "casa" ? "en casa" : ""].filter(Boolean).join(" · ");

  return {
    titular: cabeza,
    /*
    | La idea con su porqué, lo demás en «Además» y el pronóstico al final,
    | cada cosa en su línea (24/10/2026, marketing y guion: «¿Ganamos la
    | segunda jugada? La respuesta: ganamos la segunda jugada» se contestaba
    | repitiéndose). Sin el «con el plan», que es un supuesto.
    */
    lineas: [
      consignaConPorque(s) || s.titular,
      s.consigna.length > 1 ? `Además: ${yFinal(s.consigna.slice(1).map(minusculaInicial))}.` : "",
      pr ? `Pronóstico: ${pct(pr.victoria)} de victoria · ${pct(pr.derrota)} de derrota.` : "",
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

  const planBase = esPost ? [] : planPorFases(inf);

  /* El hilo de la previa (23/10/2026): la línea del plan que responde a la pregunta del titular va primera, en «Cómo lo ganamos» y en la consigna. */
  const respuesta = esPost ? "" : respuestaDelTitular(inf, planBase);

  /*
  | La idea principal tiene que estar entrenada (24/10/2026, expertos de
  | fútbol, guion y marketing): «Ganamos la segunda jugada → sin tarea esta
  | semana» decía en el informe que lo más importante no se entrenaba. La
  | respuesta al dato manda si tiene tarea; si no, la primera línea del plan
  | que sí la tiene. La otra va al aviso del analista, no al informe.
  */
  const candidatas = esPost ? [] : [...new Set([respuesta, ...planBase.map((l) => consignaDe(l.texto)).filter((t) => t && ES_CONSIGNA.test(t))].filter(Boolean))];

  const hayTareas = Boolean(inf.microciclo?.tareas.some((t) => t.md !== "MD"));

  const conTarea = (c: string) => tareasDeConsigna(c, inf.microciclo).length > 0;

  const principal = hayTareas ? candidatas.find(conTarea) ?? candidatas[0] ?? "" : candidatas[0] ?? "";

  const ideaSinTarea = hayTareas && respuesta && respuesta !== principal && !conTarea(respuesta) ? respuesta : "";

  const plan = principal ? [...planBase.filter((l) => consignaDe(l.texto) === principal), ...planBase.filter((l) => consignaDe(l.texto) !== principal)] : planBase;

  const consigna = esPost ? [] : [principal, ...candidatas.filter((c) => c !== principal)].filter(Boolean).slice(0, 3);

  /* LA IDEA: la principal y, si la hay, otra que también se entrena. La misma en la diapositiva 3, la portada del completo, el WhatsApp y el vídeo. */
  /* Sin el balón parado (tiene su bloque) ni otra que nombre al mismo jugador: «…la espalda de Gomez y marcamos a Carmona y Gomez…» era dos ideas y un nombre repetido (24/10/2026). */
  const nombresDe = (t: string) => new Set(t.split(/\s+/).slice(1).filter((w) => /^\p{Lu}\p{Ll}+/u.test(w)).map((w) => w.replace(/\W+$/u, "")));

  const nombrados = nombresDe(principal);

  const acompana = consigna.slice(1).find((c) => (!hayTareas || conTarea(c)) && !/bal[oó]n parado/i.test(c) && ![...nombresDe(c)].some((n) => nombrados.has(n)));

  const ideaPrevia = principal ? (acompana ? `${principal} y ${minusculaInicial(acompana)}` : principal) : "";

  /* Una sola lista por consigna (24/10/2026): el resumen daba dos tareas y el completo, tres. */
  const consignaTareas = consigna.map((c) => ({ consigna: c, tareas: tareasDeConsigna(c, inf.microciclo).slice(0, 3) }));

  /* Lo que pidió el post anterior, en esta semana (24/10/2026, experto de fútbol): la corrección del lunes no se pierde antes del miércoles. */
  const delPostAnterior = esPost
    ? []
    : (inf.postAnterior?.lineas ?? [])
        .map((l) => {
          const [c, ...dato] = l.split(" · ");

          return { origen: inf.postAnterior?.etiqueta ?? "", consigna: c.trim(), dato: dato.join(" · ").trim(), tareas: tareasDeConsigna(c, inf.microciclo).slice(0, 3) };
        })
        .filter((x) => x.consigna);

  /* La roja, en la misma fila que la cifra a la que afecta (25/10/2026): «concedimos poco… con diez enfrente desde el 57′». */
  const rojaMeta = esPost ? (inf.cronica?.tarjetas ?? []).filter((t) => t.tipo === "roja" && minutoNum(t.minuto) < 88).sort((a, b) => minutoNum(a.minuto) - minutoNum(b.minuto))[0] : undefined;

  const cumplimiento = esPost
    ? cumplimientoPlan(inf).map((f) => (rojaMeta && f.veredicto === "si" && f.tema !== "Balón parado" ? { ...f, matiz: `con diez enfrente desde el ${rojaMeta.minuto}′` } : f))
    : [];

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
             victoria al 40 % que era lo más probable (20/10/2026). Y un
             40/23/37 no «se dio»: estaba abierto (21/10/2026). */
          const verbo = r === "victoria" ? "Ganamos" : r === "empate" ? "Empatamos" : "Perdimos";

          const orden = (["victoria", "empate", "derrota"] as const).map((k) => pr[k]).sort((a, b) => b - a);

          const abierto = orden[0] - orden[1] < 0.08;

          if (mp === r) return abierto ? `${verbo} en un partido que el pronóstico veía abierto (${conArticulo(r)}, ${pct(pr[r])})` : `${verbo}, como apuntaba el pronóstico (${pct(pr[r])})`;

          return `${verbo}; el pronóstico daba ${pct(pr[r])} a ${conArticulo(r)} y lo más probable era ${conArticulo(mp)} (${pct(pr[mp])})`;
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

  /*
  | Previa: la pregunta del partido (20/10/2026; afinada el 21/10/2026). Por
  | orden: lo que el scouting y el dato dicen a la vez (juegan en largo y
  | nosotros vamos mal por alto), su arma de peligro, «mucho balón y poco
  | remate», nuestra mejor baza en el cruce. Nunca una métrica de volumen
  | que no hace daño, ni una que contradiga la tabla de al lado.
  */
  const arma = pr?.suFuerte;

  const segunda = esPost ? null : segundaJugada(inf);

  const baza = crucesAtaqueDefensa(inf.duelo).filter((c) => c.ataca === "nosotros" && c.ventaja >= UMBRAL_DIFERENCIA).sort((a, b) => b.ventaja - a.ventaja)[0];

  const titularDato = esPost
    ? ""
    : segunda
      ? segunda.dePosesion
        ? `Buscan en largo a la última línea: toca ganar la segunda jugada`
        : `Juegan en largo: toca ganar la segunda jugada`
      : arma
        ? `Su arma: ${nombreEnFrase(sinSiglas(arma.nombre))} (${ordinal(arma.puesto)} de ${arma.de}): toca quitársela`
        : pr?.muchoBalon
          ? `Mucho balón y poco peligro: ${ordinal(pr.muchoBalon.volumen.puesto)} en ${nombreEnFrase(sinSiglas(pr.muchoBalon.volumen.nombre))}, ${ordinal(pr.muchoBalon.sinPeligro.puesto)} en ${nombreEnFrase(sinSiglas(pr.muchoBalon.sinPeligro.nombre))}`
          : baza
            ? `Nuestra baza. ${baza.texto}`
            : `${inf.partido.lado === "fuera" ? "Visitamos al" : "Recibimos al"} ${rival}${inf.contexto?.puesto ? `, ${ordinal(inf.contexto.puesto)} de la tabla` : ""}`;

  /* Previa: el titular sale de la idea principal (24/10/2026); sin ella, del dato. */
  const titular = esPost ? titularPost(inf) : titularDePrevia(inf, consigna[0] ?? "") || titularDato;

  const roja = (inf.cronica?.tarjetas ?? []).find((t) => t.tipo === "roja");

  /*
  | La línea bajo el titular. Previa: el pronóstico en una frase que lleva al
  | plan, sin el marcador más probable (ese va en su bloque): «Hoy ganaríamos
  | la mitad de las veces. Con el plan bien hecho, el 64 %» (21/10/2026).
  */

  const veces = (x: number) => (Math.abs(x - 0.5) <= 0.03 ? "la mitad de las veces" : `el ${pct(x)} de las veces`);

  /*
  | Post (22/10/2026): los goles esperados del partido, si el titular no los
  | lleva, y su roja con lo que pasó en ese tramo. El xG no viene partido por
  | minutos (Wyscout da el total), así que el tramo se cuenta con los goles:
  | «desde el 57′, con uno más (roja a Pérez, con 2-1): 1-1 en ese tramo».
  */
  const giro = esPost ? giroDelPartido(inf) : null;

  const xgPost = giro && giro.xgNos !== null && giro.xgSuyo !== null && !titular.includes("goles esperados") ? `${unDecimal(giro.xgNos)} goles esperados contra ${unDecimal(giro.xgSuyo)}` : "";

  const tramo = roja
    ? (() => {
        const tras = (inf.cronica?.goles ?? []).filter((g) => minutoNum(g.minuto) > minutoNum(roja.minuto));

        return `${tras.filter((g) => g.nuestro).length}-${tras.filter((g) => !g.nuestro).length} en ese tramo`;
      })()
    : "";

  /*
  | El subtítulo del post (24/10/2026): las ocasiones y el tramo con uno más,
  | en dos frases. La roja con su jugador y su marcador ya va en «Cómo fue».
  */
  const subtitular = esPost
    ? [
        xgPost ? `${giro?.dominio === "nuestro" ? "Dominamos" : "Generamos"}: ${xgPost}` : "",
        roja ? `Con uno más desde el ${roja.minuto}′, ese tramo acabó ${tramo.replace(/ en ese tramo$/, "")}` : "",
      ]
        .filter(Boolean)
        .join(". ")
    : pr
      ? `Hoy ganaríamos ${veces(pr.victoria)}; si se cumplen las metas del plan, el ${pct(pr.conPlan.victoria)}`
      : "";

  const titularPlan = esPost ? titularDelPlan(cumplimiento, microciclo) : "";

  /* La roja pesa en las cifras del partido entero: se avisa donde se leen (24/10/2026). */
  const notaRoja =
    esPost && roja && minutoNum(roja.minuto) < 88
      ? `Desde el ${roja.minuto}′ jugamos con uno más (${Math.max(1, 90 - Math.floor(minutoNum(roja.minuto)))} minutos): la posesión, las entradas al área y lo que nos generaron cuentan ese tramo`
      : "";

  const baseTarde = inf.golesTemporada?.cerradosConVentaja;

  const golesEnContra = esPost ? golesEnContraDe(inf.cronica, inf.golesTemporada?.fases, { tardeAislado: Boolean(baseTarde && baseTarde.partidos > 1 && baseTarde.veces <= 1) }) : [];

  return {
    titular,
    subtitular,
    claves,
    ventajas,
    amenazas,
    vigilar,
    partido,
    relato,
    frenados,
    veredicto,
    plan,
    cumplimiento,
    microciclo,
    titularPlan,
    /* Post: la 3 ya no repite lo que esperábamos de los duelos; cuenta cómo nos marcaron (24/10/2026). */
    /* Post: la 3 abre con lo que toca, en infinitivo (25/10/2026, marketing): «Esta semana: cerrar los partidos con ventaja y defender la falta lateral». */
    titularDuelos: esPost ? titularEstaSemana(microciclo) || titularGolesEnContra(inf.cronica) : titularDuelos(inf, consigna[0] ?? ""),
    consigna,
    ideaPrevia,
    consignaTareas,
    delPostAnterior,
    ideaSinTarea,
    notaRoja,
    golesEnContra,
  };
}

/**
 * Cómo nos marcaron (24/10/2026, experto de fútbol): cada gol en contra con
 * el marcador, quién y en qué contexto (primero, con ventaja, con uno más,
 * de penalti, en propia, el que entró desde el banquillo). La fase del
 * coding se añade cuando el corte la trae.
 */
export function titularGolesEnContra(cronica: Cronica | null) {
  if (!cronica) return "";

  const roja = cronica.tarjetas.filter((t) => t.tipo === "roja").sort((a, b) => minutoNum(a.minuto) - minutoNum(b.minuto))[0];

  const suyos = marcadorPorGoles(cronica.goles).filter((x) => !x.g.nuestro);

  if (!suyos.length) return "No nos marcaron";

  const como = ({ g, antes }: (typeof suyos)[number]) => {
    const unoMas = roja && minutoNum(roja.minuto) < minutoNum(g.minuto);

    const ventaja = antes.nos > antes.ellos ? ` con ${antes.nos}-${antes.ellos}${unoMas ? " y uno más" : ""}` : unoMas ? " con uno más" : "";

    return g.tipo === "propia" ? `en propia en el ${g.minuto}′` : g.tipo === "penalti" ? `de penalti en el ${g.minuto}′${ventaja}` : `en el ${g.minuto}′${ventaja}`;
  };

  const cuantos = ["", "uno", "dos", "tres", "cuatro"][suyos.length] ?? String(suyos.length);

  return `Nos marcaron ${cuantos}: ${yFinal(suyos.map(como))}`;
}

/**
 * El nombre de una métrica del partido con lo que la explica (25/10/2026,
 * análisis): «Goles recibidos (1 en propia)». Con 0,75 goles esperados en
 * contra, «2 recibidos» parecía un fallo defensivo que no era.
 */
export function nombreMetricaPartido(m: { key: string; nombre: string }, cronica: Cronica | null) {
  const propias = (cronica?.goles ?? []).filter((g) => !g.nuestro && g.tipo === "propia").length;

  return m.key === "golesContra" && propias ? `${m.nombre} (${propias} en propia)` : m.nombre;
}

/** Los goles van en entero: «3», no «3,00». */
export const unidadPartido = (m: { key: string; unidad: string }) => (m.key === "goles" || m.key === "golesContra" ? "entero" : m.unidad);

export function golesEnContraDe(cronica: Cronica | null, fases?: Record<string, string>, opciones: { /** El gol tardío con ventaja es la primera vez en la temporada: va al vídeo, no al microciclo. */ tardeAislado?: boolean } = {}) {
  if (!cronica) return [] as string[];

  const roja = cronica.tarjetas.filter((t) => t.tipo === "roja").sort((a, b) => minutoNum(a.minuto) - minutoNum(b.minuto))[0];

  return marcadorPorGoles(cronica.goles)
    .map(({ g, antes, tras }, i) => {
      if (g.nuestro) return "";

      const entro = g.tipo !== "propia" ? cronica.cambios.find((c) => mismoJugador(c.entra, g.jugador)) : undefined;

      const quien =
        g.tipo === "propia"
          ? `en propia (${apellido(g.jugador)})`
          : `${apellido(g.jugador)}${g.tipo === "penalti" ? ", de penalti" : ""}${entro ? `, que entró en el ${entro.minuto}′` : ""}${g.asistente ? `; asistencia de ${apellido(g.asistente)}` : ""}`;

      const conUnoMas = roja && minutoNum(roja.minuto) < minutoNum(g.minuto);

      const contexto =
        antes.nos > antes.ellos
          ? `con ${antes.nos}-${antes.ellos} a favor${conUnoMas ? " y uno más" : ""}`
          : i === 0
            ? "el primero del partido"
            : conUnoMas
              ? "con uno más"
              : "";

      /* La fase, si el coding de Hudl la clasificó (25/10/2026); el gol en propia ya dice lo que es. */
      const fase = g.tipo !== "propia" ? (fases?.[String(g.minuto).replace(/[′'\s]/g, "")] ?? "") : "";

      const alVideo = opciones.tardeAislado && antes.nos > antes.ellos && minutoNum(g.minuto) >= 80 ? "para el vídeo del lunes: la primera vez esta temporada" : "";

      return [`${g.minuto}′`, `${tras.nos}-${tras.ellos}`, quien, fase, contexto, alVideo].filter(Boolean).join(" · ");
    })
    .filter(Boolean);
}
