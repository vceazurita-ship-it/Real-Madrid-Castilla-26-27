/**
 * La lectura que acompaña a cada sección de balón parado.
 *
 * Todas las páginas de ABP dejaban al cuerpo técnico con la misma pregunta
 * delante de cada gráfico: «vale, 28 % de peligro… ¿eso es mucho?». El número
 * filtrado no dice nada solo. Necesita dos referencias:
 *
 *   1. **El global** — lo mismo sin filtrar. Un 28 % con el filtro puesto es
 *      una noticia si el global es 16 %, y no lo es si el global es 27 %.
 *   2. **El tiempo** — la misma métrica jornada a jornada, para saber si la
 *      muestra filtrada va a más (evolución) o a menos (involución).
 *
 * Aquí se calculan las dos, y la frase que las explica. Las páginas sólo
 * ponen el lector de sus filas: el resto es igual en las cinco.
 *
 * **Ojo con el sentido.** En las hojas defensivas subir es empeorar: más
 * peligro concedido es peor noticia, no mejor. Por eso todo lo que juzga
 * («bien», «mal», «evolución») pasa por `sentido`, y nunca por el signo del
 * número a secas.
 */

import type { JornadaAbp } from "./partido";

/**
 * Las jornadas **en el orden en el que se jugaron**, que no es el de los
 * desplegables.
 *
 * `comparaJornadas` pone la liga primero porque es lo que se busca en un menú.
 * Para una tendencia eso es un error de bulto: la pretemporada se juega en
 * julio y con ese orden la jornada 1 de liga salía la **primera** de la serie,
 * de modo que «las últimas jornadas» eran en realidad los amistosos de verano
 * y la evolución se leía justo del revés.
 */
function comparaCronologico(a: JornadaAbp, b: JornadaAbp) {
  const bloque = (jornada: JornadaAbp) => (jornada.competicion === "amistoso" ? 0 : 1);

  if (bloque(a) !== bloque(b)) return bloque(a) - bloque(b);

  if ((a.numero ?? 0) !== (b.numero ?? 0)) return (a.numero ?? 0) - (b.numero ?? 0);

  /* Misma jornada y distinta competición: la copa después de la liga. */
  return a.competicion === b.competicion ? 0 : a.competicion === "liga" ? -1 : 1;
}

/* ------------------------------------------------------------------ */
/*  LO MÍNIMO QUE HAY QUE SABER DE UNA ACCIÓN                          */
/* ------------------------------------------------------------------ */

/**
 * Una acción reducida a lo que el análisis necesita.
 *
 * Cada página traduce sus filas a esto con un lector propio: las de córners
 * tienen columnas distintas a las de saque de banda y el scouting rival ni
 * siquiera viene de una hoja, pero las cuatro responden a las mismas cinco
 * preguntas.
 */
export type EventoAnalisis = {
  jornada: JornadaAbp;
  xg: number;
  remate: boolean;
  gol: boolean;
  /** Acabó en gol u ocasión para quien manda en la página. */
  peligro: boolean;
  /**
   * Las dos que sólo tienen sentido en el saque de banda: si el envío fue
   * hacia delante y si el balón se quedó en casa. Las hojas de córner no las
   * registran y por eso van aparte, no dentro de `peligro`.
   */
  progresion: boolean;
  retencion: boolean;
  /** El valor de la dimensión de la sección; "" cuando la sección no tiene. */
  categoria: string;
};

export type ClaveMetrica =
  | "peligro"
  | "xg"
  | "remate"
  | "gol"
  | "volumen"
  | "progresion"
  | "retencion";

/**
 * Cómo se llama cada métrica en esta página.
 *
 * En los saques de banda ofensivos «peligro» se llama producción y en los
 * defensivos, peligro concedido: es la misma cuenta con distinto nombre, y
 * cambiarle el rótulo es más barato —y menos confuso— que duplicar la métrica.
 */
export type Etiquetas = Partial<Record<ClaveMetrica, string>>;

/** Desde dónde se juzga: atacando, subir es mejorar; defendiendo, al revés. */
export type Sentido = "ofensivo" | "defensivo";

export type Tono = "bueno" | "malo" | "neutro";

/* ------------------------------------------------------------------ */
/*  MÉTRICAS                                                           */
/* ------------------------------------------------------------------ */

type Metrica = {
  label: string;
  /** Qué mide, en una línea, para el pie de la sección. */
  glosa: string;
  medir: (eventos: EventoAnalisis[]) => number | null;
  formatear: (valor: number) => string;
  /** Los porcentajes se comparan en puntos; el resto, en tanto por ciento. */
  porcentual: boolean;
  /** Mínimo de acciones para que el número signifique algo. */
  minimo: number;
  /**
   * De quién habla la métrica.
   *
   * Casi todas hablan del sujeto de la página —lo que produce el atacante o lo
   * que concede el defensor— y por eso se juzgan con `sentido`. La retención
   * no: mide que el balón se quede en casa, y eso es buena noticia también en
   * la página defensiva, donde el que saca es el rival. Sin esta distinción,
   * recuperar más saldría pintado en rojo.
   */
  sujeto?: "pagina" | "rmcf";
};

const pct = (parte: number, total: number) => (total ? (parte / total) * 100 : 0);

const formatoPct = (valor: number) =>
  `${valor.toFixed(valor > 0 && valor < 10 ? 1 : 0).replace(".", ",")} %`;

const formatoXg = (valor: number) => valor.toFixed(2).replace(".", ",");

export const METRICAS: Record<ClaveMetrica, Metrica> = {
  peligro: {
    label: "Peligro",
    glosa: "acciones que acaban en gol u ocasión",
    medir: (e) => (e.length ? pct(e.filter((uno) => uno.peligro).length, e.length) : null),
    formatear: formatoPct,
    porcentual: true,
    minimo: 5,
  },

  xg: {
    label: "xG por acción",
    glosa: "xG acumulado dividido entre las acciones",
    medir: (e) => (e.length ? e.reduce((suma, uno) => suma + uno.xg, 0) / e.length : null),
    formatear: formatoXg,
    porcentual: false,
    minimo: 5,
  },

  remate: {
    label: "Remate",
    glosa: "acciones que terminan en remate",
    medir: (e) => (e.length ? pct(e.filter((uno) => uno.remate).length, e.length) : null),
    formatear: formatoPct,
    porcentual: true,
    minimo: 5,
  },

  gol: {
    label: "Gol",
    glosa: "acciones que acaban en gol",
    medir: (e) => (e.length ? pct(e.filter((uno) => uno.gol).length, e.length) : null),
    formatear: formatoPct,
    porcentual: true,
    minimo: 8,
  },

  progresion: {
    label: "Progresión",
    glosa: "envíos hacia delante o al área",
    medir: (e) => (e.length ? pct(e.filter((uno) => uno.progresion).length, e.length) : null),
    formatear: formatoPct,
    porcentual: true,
    minimo: 5,
  },

  retencion: {
    label: "Retención",
    glosa: "acaba con el balón para el RMCF",
    medir: (e) => (e.length ? pct(e.filter((uno) => uno.retencion).length, e.length) : null),
    formatear: formatoPct,
    porcentual: true,
    minimo: 5,
    sujeto: "rmcf",
  },

  /*
  | El volumen no se mide en total, sino **por jornada**.
  |
  | En total siempre sube —cada partido suma acciones y ninguna se borra—, así
  | que la tendencia daría «evolución» en todas las secciones y en todas las
  | páginas. Por jornada sí dice algo: si sacábamos ocho córners por partido y
  | ahora sacamos tres, eso es la noticia.
  */
  volumen: {
    label: "Acciones por jornada",
    glosa: "cuántas veces aparece por partido",
    medir: (e) => {
      if (!e.length) return null;

      const jornadas = new Set(e.map((uno) => uno.jornada.clave)).size;

      return jornadas ? e.length / jornadas : null;
    },
    formatear: (valor) => valor.toFixed(1).replace(".", ","),
    porcentual: false,
    minimo: 3,
  },
};

/* ------------------------------------------------------------------ */
/*  COMPARACIÓN CON EL GLOBAL                                          */
/* ------------------------------------------------------------------ */

export type Comparativa = {
  clave: ClaveMetrica;
  label: string;
  glosa: string;
  filtro: number | null;
  global: number | null;
  /** Puntos porcentuales en las métricas porcentuales, unidades en el resto. */
  delta: number | null;
  /** Variación relativa sobre el global, en tanto por ciento. */
  deltaRel: number | null;
  porcentual: boolean;
  /** El valor ya formateado, para la chapa. */
  valorTexto: string;
  /** El global ya formateado. */
  globalTexto: string;
  /** La diferencia ya formateada: "+12 pp". */
  deltaTexto: string;
  tono: Tono;
  /** Con poca muestra el número se enseña, pero no se juzga. */
  fiable: boolean;
};

/** Convierte una diferencia en juicio, teniendo en cuenta desde dónde se mira. */
function tonoDe(delta: number | null, sentido: Sentido, umbral: number): Tono {
  if (delta == null || Math.abs(delta) < umbral) return "neutro";

  const mejora = sentido === "ofensivo" ? delta > 0 : delta < 0;

  return mejora ? "bueno" : "malo";
}

/** Con qué vara se mide esta métrica: la de la página o la nuestra de siempre. */
function sentidoDe(clave: ClaveMetrica, sentido: Sentido): Sentido {
  return METRICAS[clave].sujeto === "rmcf" ? "ofensivo" : sentido;
}

const signo = (valor: number, decimales = 0) =>
  `${valor >= 0 ? "+" : "−"}${Math.abs(valor).toFixed(decimales).replace(".", ",")}`;

function comparaMetrica(
  clave: ClaveMetrica,
  filtradas: EventoAnalisis[],
  globales: EventoAnalisis[],
  sentido: Sentido,
  etiquetas: Etiquetas = {},
): Comparativa {
  const metrica = METRICAS[clave];

  const filtro = metrica.medir(filtradas);
  const global = metrica.medir(globales);

  const delta = filtro != null && global != null ? filtro - global : null;

  const deltaRel =
    filtro != null && global != null && global !== 0
      ? ((filtro - global) / Math.abs(global)) * 100
      : null;

  /* Un punto porcentual arriba o abajo no es una diferencia, es ruido. */
  const umbral = metrica.porcentual ? 4 : Math.max(0.02, Math.abs(global ?? 0) * 0.12);

  const fiable = filtradas.length >= metrica.minimo;

  return {
    clave,
    label: etiquetas[clave] ?? metrica.label,
    glosa: metrica.glosa,
    filtro,
    global,
    delta,
    deltaRel,
    porcentual: metrica.porcentual,
    valorTexto: filtro == null ? "–" : metrica.formatear(filtro),
    globalTexto: global == null ? "–" : metrica.formatear(global),
    deltaTexto:
      delta == null
        ? ""
        : metrica.porcentual
          ? `${signo(delta, Math.abs(delta) < 10 ? 1 : 0)} pp`
          : signo(delta, 2),
    tono: fiable ? tonoDe(delta, sentidoDe(clave, sentido), umbral) : "neutro",
    fiable,
  };
}

/* ------------------------------------------------------------------ */
/*  TENDENCIA                                                          */
/* ------------------------------------------------------------------ */

export type PuntoSerie = {
  clave: string;
  etiqueta: string;
  corto: string;
  valor: number | null;
  n: number;
};

export type Veredicto = "evolucion" | "involucion" | "estable" | "insuficiente";

export type Tendencia = {
  serie: PuntoSerie[];
  /** Cuánto se mueve la métrica por jornada, según una recta ponderada. */
  pendiente: number | null;
  /** La métrica en la mitad reciente de las jornadas y en la anterior. */
  reciente: number | null;
  previo: number | null;
  delta: number | null;
  jornadasReciente: number;
  jornadasPrevio: number;
  veredicto: Veredicto;
  tono: Tono;
  etiqueta: string;
  texto: string;
};

/** La métrica jornada a jornada, en el orden en el que se juegan. */
export function serieDe(eventos: EventoAnalisis[], clave: ClaveMetrica): PuntoSerie[] {
  const metrica = METRICAS[clave];

  const porJornada = new Map<
    string,
    { jornada: JornadaAbp; eventos: EventoAnalisis[] }
  >();

  eventos.forEach((evento) => {
    if (!evento.jornada.clave) return;

    const entrada = porJornada.get(evento.jornada.clave);

    if (entrada) entrada.eventos.push(evento);
    else porJornada.set(evento.jornada.clave, { jornada: evento.jornada, eventos: [evento] });
  });

  return [...porJornada.values()]
    .sort((a, b) => comparaCronologico(a.jornada, b.jornada))
    .map(({ jornada, eventos: suyos }) => ({
      clave: jornada.clave,
      etiqueta: jornada.etiqueta,
      corto: jornada.corto,
      /* El volumen de una sola jornada es su recuento, no una media. */
      valor: clave === "volumen" ? suyos.length : metrica.medir(suyos),
      n: suyos.length,
    }));
}

/** Recta de mínimos cuadrados ponderada: una jornada de una acción pesa poco. */
function pendienteDe(serie: PuntoSerie[]): number | null {
  const puntos = serie.filter((punto) => punto.valor != null && punto.n > 0);

  if (puntos.length < 3) return null;

  const pesoTotal = puntos.reduce((suma, punto) => suma + punto.n, 0);

  const mediaX = puntos.reduce((suma, punto, i) => suma + i * punto.n, 0) / pesoTotal;

  const mediaY =
    puntos.reduce((suma, punto) => suma + (punto.valor ?? 0) * punto.n, 0) / pesoTotal;

  let numerador = 0;
  let denominador = 0;

  puntos.forEach((punto, i) => {
    numerador += punto.n * (i - mediaX) * ((punto.valor ?? 0) - mediaY);
    denominador += punto.n * (i - mediaX) ** 2;
  });

  return denominador === 0 ? null : numerador / denominador;
}

const VEREDICTO_ETIQUETA: Record<Veredicto, string> = {
  evolucion: "Evolución",
  involucion: "Involución",
  estable: "Estable",
  insuficiente: "Sin recorrido",
};

/**
 * Hacia dónde va la muestra filtrada.
 *
 * Se parte en dos mitades **de jornadas, no de acciones**, y cada mitad se
 * mide juntando sus acciones en vez de promediando porcentajes: una jornada
 * con dos córners no puede pesar lo mismo que una con doce, que es justo lo
 * que pasa si se hace la media de las medias.
 */
export function analizaTendencia(
  eventos: EventoAnalisis[],
  clave: ClaveMetrica,
  sentido: Sentido,
): Tendencia {
  const metrica = METRICAS[clave];
  const serie = serieDe(eventos, clave);

  const conDatos = serie.filter((punto) => punto.n > 0);

  if (conDatos.length < 2 || eventos.length < metrica.minimo) {
    return {
      serie,
      pendiente: null,
      reciente: null,
      previo: null,
      delta: null,
      jornadasReciente: 0,
      jornadasPrevio: 0,
      veredicto: "insuficiente",
      tono: "neutro",
      etiqueta: VEREDICTO_ETIQUETA.insuficiente,
      texto:
        conDatos.length === 0
          ? "Sin acciones que situar en el calendario."
          : conDatos.length === 1
            ? `Todo cae en ${conDatos[0].etiqueta.toLowerCase()}: con una sola jornada no hay tendencia que leer.`
            : `Con ${eventos.length} ${eventos.length === 1 ? "acción" : "acciones"} repartidas en ${conDatos.length} jornadas todavía no hay tendencia que leer.`,
    };
  }

  const corte = Math.floor(conDatos.length / 2);

  const jornadasPrevias = conDatos.slice(0, corte);
  const jornadasRecientes = conDatos.slice(corte);

  const clavesRecientes = new Set(jornadasRecientes.map((punto) => punto.clave));

  const eventosRecientes = eventos.filter((uno) => clavesRecientes.has(uno.jornada.clave));
  const eventosPrevios = eventos.filter(
    (uno) => uno.jornada.clave && !clavesRecientes.has(uno.jornada.clave),
  );

  const medirTramo = (tramo: EventoAnalisis[], jornadas: number) =>
    clave === "volumen"
      ? jornadas
        ? tramo.length / jornadas
        : null
      : metrica.medir(tramo);

  const reciente = medirTramo(eventosRecientes, jornadasRecientes.length);
  const previo = medirTramo(eventosPrevios, jornadasPrevias.length);

  const delta = reciente != null && previo != null ? reciente - previo : null;

  /* Igual que en la comparativa: por debajo del umbral es ruido de muestra. */
  const umbral = metrica.porcentual ? 5 : Math.max(0.02, Math.abs(previo ?? 0) * 0.15);

  const mueve = delta != null && Math.abs(delta) >= umbral;

  const mejora =
    delta != null && (sentidoDe(clave, sentido) === "ofensivo" ? delta > 0 : delta < 0);

  const veredicto: Veredicto = !mueve ? "estable" : mejora ? "evolucion" : "involucion";

  const formatea = (valor: number | null) => (valor == null ? "–" : metrica.formatear(valor));

  const rotuloReciente =
    jornadasRecientes.length === 1
      ? jornadasRecientes[0].etiqueta.toLowerCase()
      : `las ${jornadasRecientes.length} últimas`;

  const rotuloPrevio =
    jornadasPrevias.length === 1
      ? jornadasPrevias[0].etiqueta.toLowerCase()
      : `las ${jornadasPrevias.length} primeras`;

  const texto =
    veredicto === "estable"
      ? `Estable en el tiempo: ${formatea(previo)} en ${rotuloPrevio} y ${formatea(reciente)} en ${rotuloReciente}.`
      : `${mejora ? "Va a mejor" : "Va a peor"}: de ${formatea(previo)} en ${rotuloPrevio} a ${formatea(reciente)} en ${rotuloReciente}.`;

  return {
    serie,
    pendiente: pendienteDe(serie),
    reciente,
    previo,
    delta,
    jornadasReciente: jornadasRecientes.length,
    jornadasPrevio: jornadasPrevias.length,
    veredicto,
    tono: veredicto === "estable" ? "neutro" : mejora ? "bueno" : "malo",
    etiqueta: VEREDICTO_ETIQUETA[veredicto],
    texto,
  };
}

/* ------------------------------------------------------------------ */
/*  REPARTO POR CATEGORÍA                                              */
/* ------------------------------------------------------------------ */

export type CuotaCategoria = {
  nombre: string;
  acciones: number;
  cuota: number;
  cuotaGlobal: number;
  /** Puntos porcentuales de más o de menos que en el global. */
  deltaPp: number;
  /** La métrica de la sección dentro de esa categoría. */
  metrica: number | null;
};

export type Reparto = {
  /** Cómo se llama la dimensión: "tipo de acción", "zona de caída"… */
  etiqueta: string;
  categorias: CuotaCategoria[];
  lider: CuotaCategoria | null;
  /** La que más gana y la que más pierde peso respecto al global. */
  sube: CuotaCategoria | null;
  baja: CuotaCategoria | null;
  /** La más productiva con muestra suficiente. */
  masEficaz: CuotaCategoria | null;
  texto: string;
};

/* Valores que no son una categoría, sino la ausencia de dato. */
const SIN_VALOR = /^(sin dato|sin datos|unknown|n\/a|no aplica|no hubo|-|–|)$/i;

function analizaReparto(
  filtradas: EventoAnalisis[],
  globales: EventoAnalisis[],
  etiqueta: string,
  clave: ClaveMetrica,
  sentido: Sentido,
): Reparto | null {
  const utiles = filtradas.filter((uno) => !SIN_VALOR.test(uno.categoria.trim()));

  if (utiles.length === 0) return null;

  const metrica = METRICAS[clave];

  const porCategoria = new Map<string, EventoAnalisis[]>();

  utiles.forEach((evento) => {
    const nombre = evento.categoria.trim();
    const lista = porCategoria.get(nombre);

    if (lista) lista.push(evento);
    else porCategoria.set(nombre, [evento]);
  });

  const globalesUtiles = globales.filter((uno) => !SIN_VALOR.test(uno.categoria.trim()));

  const globalPorCategoria = new Map<string, number>();

  globalesUtiles.forEach((evento) => {
    const nombre = evento.categoria.trim();

    globalPorCategoria.set(nombre, (globalPorCategoria.get(nombre) ?? 0) + 1);
  });

  const categorias: CuotaCategoria[] = [...porCategoria.entries()]
    .map(([nombre, suyos]) => {
      const cuota = pct(suyos.length, utiles.length);

      const cuotaGlobal = globalesUtiles.length
        ? pct(globalPorCategoria.get(nombre) ?? 0, globalesUtiles.length)
        : 0;

      return {
        nombre,
        acciones: suyos.length,
        cuota,
        cuotaGlobal,
        deltaPp: cuota - cuotaGlobal,
        /* Con menos de tres acciones el porcentaje de la categoría es anecdótico. */
        metrica: suyos.length >= 3 ? metrica.medir(suyos) : null,
      };
    })
    .sort((a, b) => b.acciones - a.acciones);

  const lider = categorias[0] ?? null;

  if (!lider) return null;

  const movibles = categorias.filter((una) => Math.abs(una.deltaPp) >= 5);

  const sube = movibles.length
    ? movibles.reduce((mejor, una) => (una.deltaPp > mejor.deltaPp ? una : mejor))
    : null;

  const baja = movibles.length
    ? movibles.reduce((peor, una) => (una.deltaPp < peor.deltaPp ? una : peor))
    : null;

  const conMetrica = categorias.filter((una) => una.metrica != null);

  const masEficaz = conMetrica.length
    ? conMetrica.reduce((mejor, una) =>
        (una.metrica ?? 0) > (mejor.metrica ?? 0) ? una : mejor,
      )
    : null;

  const frases: string[] = [];

  if (categorias.length === 1) {
    frases.push(`Todo se concentra en «${lider.nombre}».`);
  } else {
    frases.push(
      `Manda «${lider.nombre}» con el ${formatoPct(lider.cuota)} de las acciones${
        Math.abs(lider.deltaPp) >= 5 ? ` (${signo(lider.deltaPp)} pp sobre su peso global)` : ""
      }.`,
    );
  }

  if (sube && sube.nombre !== lider.nombre && sube.deltaPp >= 5) {
    frases.push(`Gana peso «${sube.nombre}» (${signo(sube.deltaPp)} pp).`);
  }

  if (baja && baja.deltaPp <= -5 && baja.nombre !== sube?.nombre && baja.nombre !== lider.nombre) {
    frases.push(`Lo pierde «${baja.nombre}» (${signo(baja.deltaPp)} pp).`);
  }

  if (masEficaz?.metrica != null && categorias.length > 1) {
    frases.push(
      `${sentido === "ofensivo" ? "Lo que más produce" : "Por donde más se concede"}: «${masEficaz.nombre}», ${metrica.formatear(masEficaz.metrica)}.`,
    );
  }

  return { etiqueta, categorias, lider, sube, baja, masEficaz, texto: frases.join(" ") };
}

/* ------------------------------------------------------------------ */
/*  EL ANÁLISIS COMPLETO DE UNA SECCIÓN                                */
/* ------------------------------------------------------------------ */

export type Muestra = {
  filtradas: number;
  total: number;
  cuota: number;
  jornadas: number;
  jornadasTotal: number;
  /** No hay ningún filtro puesto: lo filtrado y el global son lo mismo. */
  sinFiltro: boolean;
  /** Tan poca cosa que cualquier porcentaje engaña. */
  corta: boolean;
};

export type AnalisisSeccion = {
  muestra: Muestra;
  principal: Comparativa;
  secundarias: Comparativa[];
  tendencia: Tendencia;
  reparto: Reparto | null;
  /** La frase que resume las tres lecturas. */
  titular: string;
};

/** Las métricas de apoyo que acompañan a cada principal, sin repetirla. */
const ACOMPANAN: Record<ClaveMetrica, ClaveMetrica[]> = {
  peligro: ["xg", "remate", "volumen"],
  xg: ["peligro", "remate", "volumen"],
  remate: ["peligro", "xg", "volumen"],
  gol: ["peligro", "xg", "volumen"],
  volumen: ["peligro", "xg", "remate"],
  progresion: ["peligro", "retencion", "volumen"],
  retencion: ["peligro", "progresion", "volumen"],
};

export function analizaSeccion({
  filtradas,
  globales,
  metrica = "peligro",
  sentido = "ofensivo",
  dimension,
  unidad = "acciones",
  etiquetas = {},
  acompanan,
}: {
  filtradas: EventoAnalisis[];
  globales: EventoAnalisis[];
  metrica?: ClaveMetrica;
  sentido?: Sentido;
  /** Cómo se llama la dimensión de la sección, si tiene. */
  dimension?: string;
  unidad?: string;
  etiquetas?: Etiquetas;
  /** Las métricas de apoyo, cuando la página tiene otras que las de córner. */
  acompanan?: ClaveMetrica[];
}): AnalisisSeccion {
  const jornadas = new Set(filtradas.map((uno) => uno.jornada.clave).filter(Boolean)).size;

  const jornadasTotal = new Set(globales.map((uno) => uno.jornada.clave).filter(Boolean)).size;

  const muestra: Muestra = {
    filtradas: filtradas.length,
    total: globales.length,
    cuota: pct(filtradas.length, globales.length),
    jornadas,
    jornadasTotal,
    sinFiltro: filtradas.length === globales.length,
    corta: filtradas.length > 0 && filtradas.length < METRICAS[metrica].minimo,
  };

  const principal = comparaMetrica(metrica, filtradas, globales, sentido, etiquetas);

  const secundarias = (acompanan ?? ACOMPANAN[metrica])
    .filter((clave) => clave !== metrica)
    .map((clave) => comparaMetrica(clave, filtradas, globales, sentido, etiquetas));

  const tendencia = analizaTendencia(filtradas, metrica, sentido);

  const reparto = dimension
    ? analizaReparto(filtradas, globales, dimension, metrica, sentido)
    : null;

  return {
    muestra,
    principal,
    secundarias,
    tendencia,
    reparto,
    titular: redactaTitular({ muestra, principal, tendencia, reparto, sentido, unidad }),
  };
}

/* ------------------------------------------------------------------ */
/*  LA FRASE                                                           */
/* ------------------------------------------------------------------ */

function redactaTitular({
  muestra,
  principal,
  tendencia,
  reparto,
  sentido,
  unidad,
}: {
  muestra: Muestra;
  principal: Comparativa;
  tendencia: Tendencia;
  reparto: Reparto | null;
  sentido: Sentido;
  unidad: string;
}): string {
  if (muestra.total === 0) return "Todavía no hay acciones registradas.";

  if (muestra.filtradas === 0) {
    return `Ninguna de las ${muestra.total} ${unidad} registradas entra en este filtro.`;
  }

  const metrica = METRICAS[principal.clave];

  const frases: string[] = [];

  /* 1 · Cuánto se está mirando. */
  frases.push(
    muestra.sinFiltro
      ? `Sin filtros: ${muestra.total} ${unidad} de ${muestra.jornadasTotal} ${muestra.jornadasTotal === 1 ? "jornada" : "jornadas"}.`
      : `${muestra.filtradas} de ${muestra.total} ${unidad} (${formatoPct(muestra.cuota)}) en ${muestra.jornadas} ${muestra.jornadas === 1 ? "jornada" : "jornadas"}.`,
  );

  /* 2 · Qué dice frente al global. */
  if (muestra.sinFiltro) {
    if (principal.filtro != null) {
      frases.push(
        `${principal.label}: ${metrica.formatear(principal.filtro)}, la referencia contra la que se compara cualquier filtro.`,
      );
    }
  } else if (principal.filtro != null && principal.global != null && principal.delta != null) {
    const sinDiferencia = Math.abs(principal.delta) < (metrica.porcentual ? 4 : 0.02);

    const relacion = sinDiferencia
      ? "en línea con"
      : principal.delta > 0
        ? "por encima de"
        : "por debajo de";

    const juicio =
      principal.tono === "neutro"
        ? ""
        : principal.tono === "bueno"
          ? sentido === "ofensivo"
            ? " Es de lo que mejor funciona."
            : " Se defiende mejor de lo habitual."
          : sentido === "ofensivo"
            ? " Rinde por debajo de lo habitual."
            : " Es por donde más peligro se genera.";

    frases.push(
      `${principal.label} ${metrica.formatear(principal.filtro)}, ${relacion} ${metrica.formatear(principal.global)} global.${juicio}`,
    );
  }

  /* 3 · Hacia dónde va. */
  frases.push(tendencia.texto);

  /* 4 · Dónde se concentra, si la sección reparte por algo. */
  if (reparto?.texto) frases.push(reparto.texto);

  /* 5 · El aviso, al final, para que no se lea un porcentaje de tres acciones. */
  if (muestra.corta) {
    frases.push(
      `Con ${muestra.filtradas} ${muestra.filtradas === 1 ? "acción" : "acciones"} cada una mueve mucho el porcentaje: tómalo como indicio, no como dato.`,
    );
  }

  return frases.join(" ");
}
