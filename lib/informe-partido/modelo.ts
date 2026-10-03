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

export type DocumentoRival = { nombre: string; url: string; tipo: string; tamano: number | null; adjuntable: boolean };

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
  palancas: Palanca[];
  conPlan: Probabilidades;
  /** De dónde sale, para el pie: «xG y goles de 5 y 5 partidos · factor campo». */
  base: string;
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
  recursos: { documentos: DocumentoRival[]; videos: { nombre: string; url: string }[] };
  sintesis: Sintesis;
  avisos: string[];
};

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
};

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

/** Primera letra en mayúscula y el resto como venga. */
const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Un texto libre de la hoja partido en frases o líneas, sin vacíos. */
export function enFrases(texto: string | undefined, maximo = 6) {
  return (texto ?? "")
    .split(/\r?\n|•|·|;|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map((t) => t.replace(/^[-–—*\d.)\s]+/, "").trim())
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

export function ventajasYAmenazas(duelo: Duelo | null) {
  if (!duelo) return { ventajas: [] as string[], amenazas: [] as string[] };

  const comparables = duelo.metricas.filter(
    (m) => m.mejorAlto !== null && m.nosotros?.percentil != null && m.rival?.percentil != null && conDato(m),
  );

  const dif = (m: MetricaDuelo) => (m.nosotros?.percentil ?? 0) - (m.rival?.percentil ?? 0);

  const ventajas = comparables
    .filter((m) => dif(m) >= UMBRAL_DIFERENCIA)
    .sort((a, b) => dif(b) - dif(a))
    .slice(0, 3)
    .map((m) => `${frasePuesto(m, "nosotros", duelo.equipos)} · ellos ${ordinal(m.rival!.puesto)}`);

  /* Lo que ellos hacen muy bien en la liga, aunque estemos parejos. */
  const amenazas = comparables
    .filter((m) => -dif(m) >= UMBRAL_DIFERENCIA || (m.rival?.puesto ?? 99) <= 3)
    .sort((a, b) => (a.rival?.puesto ?? 99) - (b.rival?.puesto ?? 99) || dif(a) - dif(b))
    .slice(0, 3)
    .map((m) => `${frasePuesto(m, "rival", duelo.equipos)} · nosotros ${ordinal(m.nosotros!.puesto)}`);

  return { ventajas, amenazas };
}

/** Los tres del rival que más pesan: goles + asistencias, minutos, y lo que diga la ficha. */
export function aVigilar(once: JugadorRival[], plantilla: JugadorRival[]) {
  const peso = (j: JugadorRival) =>
    (j.goles ?? 0) * 3 + (j.asistencias ?? 0) * 2 + (j.minutos ?? 0) / 300 + j.rasgos.length * 0.5 + (j.fortalezas ? 1 : 0);

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

  const desvios = p.metricas
    .filter((m) => m.nuestro !== null && m.media !== null && m.media !== 0 && m.mejorAlto !== null)
    .map((m) => {
      const rel = ((m.nuestro! - m.media!) / Math.abs(m.media!)) * 100;

      const bueno = m.mejorAlto ? rel > 0 : rel < 0;

      return { m, rel, bueno };
    })
    .filter((x) => Math.abs(x.rel) >= 15)
    .sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel))
    .slice(0, 4);

  return desvios.map(
    ({ m, rel, bueno }) =>
      `${capital(m.nombre)}: ${cifra(m.nuestro, m.unidad)} frente a ${cifra(m.media, m.unidad)} de media (${rel > 0 ? "+" : ""}${Math.round(rel)} %) · ${bueno ? "mejor" : "peor"} de lo habitual`,
  );
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

  const frases = enFrases(t, 12);

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

  const dif = base.victoria - base.derrota;

  const tipo =
    dif > 0.2 ? "Partido para ganarlo" : dif > 0.07 ? "Partido de ligera ventaja" : dif > -0.07 ? "Partido igualado" : dif > -0.2 ? "Partido cuesta arriba" : "Partido de mucha exigencia";

  const lectura = `${tipo}: ${pct(base.victoria)} de victoria, ${pct(base.empate)} de empate y ${pct(base.derrota)} de derrota. Con el plan bien hecho, la victoria sube al ${pct(conPlan.victoria)}.`;

  return {
    ...base,
    lectura,
    palancas,
    conPlan,
    base: `xG y goles de la temporada antes del partido (${nNos} y ${nRiv} partidos) · ${campo === 1 ? "sin factor campo" : campo > 1 ? "en casa" : "fuera"}`,
  };
}

/** Post: cada palanca, su meta y lo que pasó (si Wyscout ya tiene el partido). */
export function revisaPalancas(inf: { pronostico: Pronostico | null; duelo: Duelo | null }) {
  const pr = inf.pronostico;

  if (!pr) return [] as { momento: string; meta: string; real: string; cumplida: boolean | null }[];

  const xg = inf.duelo?.partido?.metricas.find((x) => x.key === "xg");

  return pr.palancas.map((p) => {
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

const quienGol = (g: GolCronica) =>
  g.tipo === "propia" ? `en propia de ${apellido(g.jugador)}` : `${apellido(g.jugador)}${g.tipo === "penalti" ? ", de penalti" : ""}`;

/**
 * Los goles que cambiaron el partido, contados como en el vestuario: quién
 * marcó primero, los empates, quién se puso por delante y el que lo cerró.
 * El marcador va siempre desde nuestro lado (nosotros-ellos).
 */
export function relatoDeGoles(goles: GolCronica[]) {
  const frases: string[] = [];

  let nos = 0;
  let ellos = 0;

  goles.forEach((g, i) => {
    const antesIgual = nos === ellos;

    if (g.nuestro) nos++;
    else ellos++;

    const cuando = `${g.minuto}′, ${quienGol(g)}`;

    if (i === 0) frases.push(`${g.nuestro ? "Marcamos primero" : "Nos marcaron primero"} (${cuando})`);
    else if (nos === ellos) frases.push(`${g.nuestro ? "Empatamos" : "Nos empataron"} ${nos}-${ellos} (${cuando})`);
    else if (antesIgual) frases.push(`${g.nuestro ? "Nos pusimos" : "Se pusieron"} ${nos}-${ellos} (${cuando})`);
    else if (i === goles.length - 1) frases.push(`${g.nuestro ? "Lo cerramos" : "Lo cerraron"} ${nos}-${ellos} (${cuando})`);
  });

  return frases;
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

export function sintetiza(inf: Omit<InformePartido, "sintesis">): Sintesis {
  const { ventajas, amenazas } = ventajasYAmenazas(inf.duelo);

  const vigilar = aVigilar(inf.once.jugadores, inf.plantilla);

  const esPost = inf.momento === "post";

  const partido = esPost ? lecturaDelPartido(inf.duelo) : [];

  const relato = esPost ? relatoDeGoles(inf.cronica?.goles ?? []) : [];

  const frenados = esPost ? frenadosEn(vigilar, inf.cronica) : [];

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

          const prob = pr[r];

          return `El pronóstico daba ${pct(prob)} de ${r}: ${prob >= 0.45 ? "salió lo esperado" : prob >= 0.3 ? "un resultado posible, no el más probable" : "le dimos la vuelta a lo esperado"} (${inf.partido.gf}-${inf.partido.gc}; el más probable era ${pr.marcador})`;
        })()
      : "";

  const clavesPost = [
    ...partido.slice(0, 2),
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
    ...ventajas.slice(0, 1).map((v) => `Seguimos fuertes en ${v.charAt(0).toLowerCase()}${v.slice(1)}`),
  ]
    .filter(Boolean)
    .slice(0, 4);

  const claves =
    esPost
      ? clavesPost
      : delPlan.length >= 3
        ? delPlan.slice(0, 4)
        : /* Con dos o menos del plan, se completan con lo que dicen los datos.
             La primera ventaja y la primera amenaza ya van al pie de sus
             paneles: aquí entran las siguientes, para no repetir. */
          [
            ...delPlan,
            ...[1, 2].flatMap((i) => [
              ventajas[i] ? `Aprovechar · ${ventajas[i]}` : "",
              amenazas[i] ? `Neutralizar · ${amenazas[i]}` : "",
            ]),
          ]
            .filter(Boolean)
            .slice(0, 4);

  const rival = inf.partido.rival || "el rival";

  const titular =
    inf.momento === "post"
      ? inf.partido.jugado && inf.partido.gf !== null && inf.partido.gc !== null
        ? `${inf.partido.gf > inf.partido.gc ? "Victoria" : inf.partido.gf < inf.partido.gc ? "Derrota" : "Empate"} ${inf.partido.gf}-${inf.partido.gc} ${inf.partido.lado === "fuera" ? "en el campo del" : "ante el"} ${rival}`
        : `Post partido ante el ${rival}`
      : `${inf.partido.lado === "fuera" ? "Visitamos al" : "Recibimos al"} ${rival}${inf.contexto?.puesto ? `, ${ordinal(inf.contexto.puesto)} de la tabla` : ""}`;

  return { titular, claves, ventajas, amenazas, vigilar, partido, relato, frenados, veredicto };
}
