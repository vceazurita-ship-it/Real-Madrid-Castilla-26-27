/**
 * Lo que sitúa una acción de balón parado dentro de un partido: de qué
 * competición es, en qué minuto pasó y cómo iba el marcador.
 *
 * Las cinco hojas de ABP —córners y faltas a favor y en contra, y los dos
 * saques de banda— escriben estas tres cosas, pero **cada una a su manera**:
 *
 *   JORNADA   "PRETEMPORADA 03" · "LIGA 01" · "LIGA"
 *   Tiempo    "1" · "2" · "1T" · "2T" · "T1" · "T2"
 *   Minuto    "Minuto" en tres hojas y "MINUTO" en la de córners en contra
 *   Marcador  "Resultado RMC" y "Resultado RIVAL", los goles de cada uno
 *             **en ese momento** del partido
 *
 * Aquí se leen las tres de una vez y en un solo idioma, para que la misma
 * pregunta —«¿qué nos pasa a balón parado cuando vamos por delante en la
 * segunda parte de un partido de liga?»— se pueda hacer en cualquiera de las
 * páginas y signifique lo mismo en todas.
 *
 * **Por qué hacía falta**: `/setpieces` y `/setpieces_def` filtraban por
 * jornada con `Number("PRETEMPORADA 01")` → 1 y `Number("LIGA 01")` → 1, así
 * que el primer partido de liga y el primer amistoso eran **la misma jornada**
 * y sus acciones se sumaban. No fallaba: mezclaba.
 */

/* ------------------------------------------------------------------ */
/*  LECTURA DE CELDAS                                                  */
/* ------------------------------------------------------------------ */

export type FilaHoja = Record<string, string>;

/** Sin acentos, sin espacios y en minúsculas: así se comparan cabeceras. */
function claveColumna(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/**
 * Lee una columna por su nombre, tolerando acentos, espacios y mayúsculas.
 *
 * Es lo que permite leer «Minuto» y «MINUTO» con la misma llamada, y —más
 * importante— lo que hace que **añadir una columna a la hoja no rompa nada**:
 * las páginas de córners leían por posición (`r[27]` era el xG) y bastaba con
 * meter «Marcador» en medio para que todo el análisis se corriera una casilla.
 */
export function lee(fila: FilaHoja, ...nombres: string[]): string {
  for (const nombre of nombres) {
    const directo = fila[nombre];

    if (directo != null && String(directo).trim()) return String(directo).trim();
  }

  const buscadas = nombres.map(claveColumna);

  for (const columna of Object.keys(fila)) {
    if (!buscadas.includes(claveColumna(columna))) continue;

    const valor = fila[columna];

    if (valor != null && String(valor).trim()) return String(valor).trim();
  }

  return "";
}

/** Número tolerante con la coma decimal y con el texto de alrededor. */
export function numero(valor?: string | number): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  const limpio = String(valor ?? "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!limpio) return null;

  const parsed = Number(limpio);

  return Number.isFinite(parsed) ? parsed : null;
}

/* ------------------------------------------------------------------ */
/*  COMPETICIÓN Y JORNADA                                              */
/* ------------------------------------------------------------------ */

export type Competicion = "liga" | "amistoso" | "copa";

export const COMPETICIONES: { key: Competicion; label: string; corto: string }[] =
  [
    { key: "liga", label: "Liga", corto: "L" },
    { key: "copa", label: "Copa", corto: "C" },
    { key: "amistoso", label: "Pretemporada", corto: "PR" },
  ];

export const COMPETICION_LABEL: Record<Competicion, string> = {
  liga: "Liga",
  copa: "Copa",
  amistoso: "Pretemporada",
};

export type JornadaAbp = {
  competicion: Competicion;
  /** 1, 2… o `null` cuando la hoja escribe sólo «LIGA», sin número. */
  numero: number | null;
  /** Lo que pone la celda, tal cual. */
  bruto: string;
  /** "J01" · "PR03" · "COPA". Para una chapa estrecha. */
  corto: string;
  /** "Jornada 1" · "Pretemporada 3". Para un desplegable. */
  etiqueta: string;
  /**
   * Clave única de partido.
   *
   * Lleva la competición dentro **a propósito**: `liga:1` y `amistoso:1` son
   * dos partidos distintos, y confundirlos era justo el fallo que había.
   */
  clave: string;
};

const SIN_JORNADA: JornadaAbp = {
  competicion: "liga",
  numero: null,
  bruto: "",
  corto: "—",
  etiqueta: "Sin jornada",
  clave: "",
};

function normaliza(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * De qué competición es un partido, y qué jornada.
 *
 * La hoja lo escribe en la columna JORNADA con el prefijo delante:
 * «PRETEMPORADA 03», «LIGA 01», «LIGA» a secas mientras no se numera. Un
 * número suelto se lee como liga, que es lo que se anota cuando la temporada
 * ya ha empezado y nadie escribe el prefijo.
 */
export function parseJornada(bruto: string): JornadaAbp {
  const texto = String(bruto ?? "").trim();

  if (!texto) return SIN_JORNADA;

  const t = normaliza(texto);

  const competicion: Competicion =
    t.includes("pretemporada") || t.includes("amistos")
      ? "amistoso"
      : t.includes("copa")
        ? "copa"
        : "liga";

  const match = t.match(/(\d+)/);

  const numero = match ? Number(match[1]) : null;

  const prefijo =
    competicion === "amistoso" ? "PR" : competicion === "copa" ? "COPA" : "J";

  const corto =
    numero != null
      ? `${prefijo}${String(numero).padStart(2, "0")}`
      : COMPETICIONES.find((una) => una.key === competicion)!.corto;

  const nombre =
    competicion === "amistoso"
      ? "Pretemporada"
      : competicion === "copa"
        ? "Copa"
        : "Jornada";

  return {
    competicion,
    numero,
    bruto: texto,
    corto,
    etiqueta: numero != null ? `${nombre} ${numero}` : COMPETICION_LABEL[competicion],
    clave: `${competicion}:${numero ?? texto}`,
  };
}

/** Ordena jornadas como se leen: liga primero y por número. */
export function comparaJornadas(a: JornadaAbp, b: JornadaAbp) {
  const orden: Record<Competicion, number> = { liga: 0, copa: 1, amistoso: 2 };

  if (orden[a.competicion] !== orden[b.competicion]) {
    return orden[a.competicion] - orden[b.competicion];
  }

  return (a.numero ?? 0) - (b.numero ?? 0);
}

/* ------------------------------------------------------------------ */
/*  MINUTO Y TRAMO                                                     */
/* ------------------------------------------------------------------ */

export type TramoKey = "0-15" | "16-30" | "31-45" | "46-60" | "61-75" | "76-90";

export const TRAMOS: { key: TramoKey; label: string; desde: number; hasta: number }[] =
  [
    { key: "0-15", label: "0'-15'", desde: 0, hasta: 15 },
    { key: "16-30", label: "16'-30'", desde: 16, hasta: 30 },
    { key: "31-45", label: "31'-45'", desde: 31, hasta: 45 },
    { key: "46-60", label: "46'-60'", desde: 46, hasta: 60 },
    { key: "61-75", label: "61'-75'", desde: 61, hasta: 75 },
    { key: "76-90", label: "76'-90'", desde: 76, hasta: Infinity },
  ];

export const TRAMO_LABEL: Record<TramoKey, string> = Object.fromEntries(
  TRAMOS.map((tramo) => [tramo.key, tramo.label]),
) as Record<TramoKey, string>;

export type MinutoAbp = {
  /** Minuto de partido. `null` cuando la hoja no lo anotó. */
  minuto: number | null;
  /** 1 o 2. Sale de `Tiempo` y, si falta, del propio minuto. */
  parte: 1 | 2 | null;
  tramo: TramoKey | null;
};

export const SIN_MINUTO: MinutoAbp = { minuto: null, parte: null, tramo: null };

/**
 * La parte del partido, con los tres formatos que usan las hojas.
 *
 * «1» y «2» en córners a favor, «1T» y «2T» en córners en contra, y las dos
 * de banda mezclan «1T» con «T1». Se busca el dígito y se ignora la letra,
 * que es lo único que cambia.
 */
export function parseParte(valor: string): 1 | 2 | null {
  const t = normaliza(valor);

  if (!t) return null;

  if (/(^|[^0-9])2([^0-9]|$)/.test(t) || t.includes("segunda")) return 2;
  if (/(^|[^0-9])1([^0-9]|$)/.test(t) || t.includes("primera")) return 1;

  return null;
}

/** El tramo de quince minutos al que pertenece un minuto de partido. */
export function tramoDe(minuto: number | null): TramoKey | null {
  if (minuto == null || !Number.isFinite(minuto)) return null;

  const encontrado = TRAMOS.find(
    (tramo) => minuto >= tramo.desde && minuto <= tramo.hasta,
  );

  return encontrado?.key ?? null;
}

/**
 * Minuto, parte y tramo de una acción.
 *
 * El minuto que anotan las hojas es **el del partido**, no el de la parte: en
 * la segunda van del 46 al 95, así que se puede usar tal cual para los tramos.
 * Si viene «45+2», se suma el añadido, que es como lo cuenta cualquier acta.
 *
 * Cuando falta el minuto pero está la parte, se deja `minuto: null` y el tramo
 * vacío: media parte es demasiado ancho para llamarlo tramo, y rellenarlo con
 * un 23 inventado ensuciaría el reparto sin que nadie se enterara.
 */
export function parseMinuto(fila: FilaHoja): MinutoAbp {
  const bruto = lee(fila, "Minuto", "MINUTO", "Min");

  const parteDeclarada = parseParte(lee(fila, "Tiempo", "Parte", "Periodo"));

  if (!bruto) return { minuto: null, parte: parteDeclarada, tramo: null };

  /* "45+2" son 47 a efectos de tramo. */
  const partes = bruto.split("+");

  const base = numero(partes[0]);

  if (base == null) return { minuto: null, parte: parteDeclarada, tramo: null };

  const anadido = partes.length > 1 ? (numero(partes[1]) ?? 0) : 0;

  const minuto = Math.max(0, Math.round(base + anadido));

  return {
    minuto,
    /* Sin `Tiempo`, el propio minuto dice la parte. */
    parte: parteDeclarada ?? (minuto > 45 ? 2 : 1),
    tramo: tramoDe(minuto),
  };
}

/* ------------------------------------------------------------------ */
/*  MARCADOR Y ESTADO DEL PARTIDO                                      */
/* ------------------------------------------------------------------ */

export type EstadoPartido = "ganando" | "empatando" | "perdiendo";

export const ESTADOS: { key: EstadoPartido; label: string }[] = [
  { key: "ganando", label: "Ganando" },
  { key: "empatando", label: "Empatando" },
  { key: "perdiendo", label: "Perdiendo" },
];

export const ESTADO_LABEL: Record<EstadoPartido, string> = {
  ganando: "Ganando",
  empatando: "Empatando",
  perdiendo: "Perdiendo",
};

/** El color con el que se pinta cada estado, el mismo en toda la plataforma. */
export const ESTADO_COLOR: Record<EstadoPartido, string> = {
  ganando: "#2E7D52",
  empatando: "#C8A96B",
  perdiendo: "#B4454F",
};

export type MarcadorAbp = {
  /** Goles del Castilla en ese momento. `null` si la hoja no lo anotó. */
  rmcf: number | null;
  rival: number | null;
  /** "1-0", o "" si falta alguno de los dos. */
  texto: string;
  estado: EstadoPartido | null;
};

export const SIN_MARCADOR: MarcadorAbp = {
  rmcf: null,
  rival: null,
  texto: "",
  estado: null,
};

/**
 * Cómo iba el partido cuando pasó la acción.
 *
 * Las cuatro hojas lo escriben igual y **en términos absolutos**: «Resultado
 * RMC» son nuestros goles y «Resultado RIVAL» los suyos, da igual que la hoja
 * sea ofensiva o defensiva. Por eso el estado se lee siempre desde nosotros.
 *
 * Un 0-0 es un marcador, no un hueco: se distingue de la celda vacía porque
 * `numero("")` devuelve `null` y `numero("0")` devuelve 0.
 */
export function parseMarcador(fila: FilaHoja): MarcadorAbp {
  const rmcf = numero(
    lee(fila, "Resultado RMC", "Resultado_RMC", "Goles RMC", "Marcador RMC"),
  );

  const rival = numero(
    lee(fila, "Resultado RIVAL", "Resultado_RIVAL", "Goles Rival", "Marcador Rival"),
  );

  if (rmcf == null || rival == null) {
    return { rmcf, rival, texto: "", estado: null };
  }

  return {
    rmcf,
    rival,
    texto: `${rmcf}-${rival}`,
    estado: rmcf > rival ? "ganando" : rmcf < rival ? "perdiendo" : "empatando",
  };
}

/* ------------------------------------------------------------------ */
/*  LO QUE SITÚA A UNA ACCIÓN                                          */
/* ------------------------------------------------------------------ */

/**
 * Las tres lecturas juntas: es lo que acompaña a cualquier acción de ABP.
 *
 * Se guarda entero en cada evento en vez de recalcularlo donde haga falta,
 * porque de aquí salen a la vez los filtros, los gráficos por tramo y el
 * rótulo que se escribe al lado de la acción en una tabla.
 */
export type ContextoAccion = {
  jornada: JornadaAbp;
  minuto: MinutoAbp;
  marcador: MarcadorAbp;
};

export function contextoDeFila(fila: FilaHoja): ContextoAccion {
  return {
    jornada: parseJornada(lee(fila, "JORNADA", "Jornada")),
    minuto: parseMinuto(fila),
    marcador: parseMarcador(fila),
  };
}

/** "J01 · 67' · 1-0", lo que se escribe al lado de una acción. */
export function rotuloContexto(contexto: ContextoAccion) {
  return [
    contexto.jornada.corto,
    contexto.minuto.minuto != null ? `${contexto.minuto.minuto}'` : "",
    contexto.marcador.texto,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ------------------------------------------------------------------ */
/*  FILTRO COMÚN                                                       */
/* ------------------------------------------------------------------ */

/**
 * El filtro de contexto que comparten las cinco páginas.
 *
 * `"ALL"` es «todo», que es como ya hablaban los desplegables de estas
 * páginas: así el filtro nuevo se enchufa al lado de los que había sin
 * inventarse un segundo idioma.
 */
export type FiltroContexto = {
  competicion: Competicion | "ALL";
  estado: EstadoPartido | "ALL";
  tramo: TramoKey | "ALL";
};

export const FILTRO_VACIO: FiltroContexto = {
  competicion: "ALL",
  estado: "ALL",
  tramo: "ALL",
};

/**
 * ¿Pasa esta acción el filtro de contexto?
 *
 * Una acción **sin** el dato no pasa un filtro que sí lo pide: si se pregunta
 * por lo que ocurre yendo por delante, una acción sin marcador anotado no es
 * una respuesta, y colarla inflaría la muestra con lo que no se sabe.
 */
export function pasaContexto(
  contexto: ContextoAccion,
  filtro: FiltroContexto,
): boolean {
  if (
    filtro.competicion !== "ALL" &&
    contexto.jornada.competicion !== filtro.competicion
  ) {
    return false;
  }

  if (filtro.estado !== "ALL" && contexto.marcador.estado !== filtro.estado) {
    return false;
  }

  if (filtro.tramo !== "ALL" && contexto.minuto.tramo !== filtro.tramo) {
    return false;
  }

  return true;
}

/** Cuántos filtros de contexto hay puestos, para el contador del cajón. */
export function contextoActivo(filtro: FiltroContexto) {
  return [filtro.competicion, filtro.estado, filtro.tramo].filter(
    (valor) => valor !== "ALL",
  ).length;
}

/**
 * Las opciones del desplegable de competición, con lo que hay de verdad.
 *
 * No se ofrece «Copa» si no hay ni un partido de copa: un filtro que siempre
 * deja la pantalla en blanco es peor que no tenerlo.
 */
export function competicionesPresentes(jornadas: JornadaAbp[]): Competicion[] {
  const vistas = new Set(jornadas.map((jornada) => jornada.competicion));

  return COMPETICIONES.filter((una) => vistas.has(una.key)).map((una) => una.key);
}
