/**
 * DE DÓNDE SALE CADA DATO (10/11/2026, fase 3 de Wyscout + Opta).
 *
 * Wyscout y Opta miden muchas cosas que se llaman igual y no dan la misma
 * cifra: cada proveedor tiene su modelo de xG, su manera de contar una
 * pérdida y su raya de «robo alto». Lo acordado con los expertos:
 *
 * 1. **Una fuente principal por magnitud.** La otra, si sale, es una
 *    «segunda lectura» pequeña. Nunca se promedian ni se hace un percentil
 *    con las dos juntas.
 *    - **Opta** manda en xG y remates, PPDA y presión, balón parado,
 *      pérdidas y recuperaciones por zona, estilo y momentum: tiene los 40
 *      equipos de la categoría evento a evento.
 *    - **Wyscout** manda en el perfil del jugador (78 métricas, percentil
 *      contra su puesto), el once y el sistema, y los duelos.
 * 2. **Cada cifra lleva su sello** (`SelloFuente`): fuente, población y hasta
 *    dónde llega («Opta · grupo (20 equipos) · J11»). La fuente nunca va en
 *    un título.
 * 3. **Si las dos difieren de verdad** (por encima del umbral de la
 *    magnitud) se pone una nota de método corta, con `discrepancia()`. Por
 *    debajo, nada: es ruido de modelo y no se comenta.
 *
 * Aquí sólo hay nombres, definiciones y umbrales: ni una cifra (el
 * repositorio es público y los datos tienen licencia).
 *
 * Claves de cada fuente:
 * - Wyscout de equipo: `key` de `METRICAS` (`lib/data-analisis/metricas.ts`);
 *   de jugador, la `columna` de `METRICAS_JUGADOR`
 *   (`lib/data-analisis/individual.ts`).
 * - Opta: la abreviatura de la columna (`lib/opta-nombres.ts`), por partido
 *   en equipos y por 90 minutos en jugadores.
 */

export type Fuente = "opta" | "wyscout";

export const NOMBRE_FUENTE: Record<Fuente, string> = { opta: "Opta", wyscout: "Wyscout" };

export type Lectura = {
  /** La clave en esa fuente (ver arriba). */
  clave: string;
  /** Qué cuenta esa fuente, en una línea. */
  definicion: string;
};

export type Umbral = {
  /** Diferencia relativa (sobre la cifra principal) a partir de la cual se avisa: 0,15 = 15 %. */
  relativo?: number;
  /** Diferencia absoluta a partir de la cual se avisa, en la unidad de la magnitud. */
  absoluto?: number;
  /** Por debajo de esta diferencia absoluta nunca se avisa (cifras pequeñas: un 50 % de 0,1 es nada). */
  suelo?: number;
};

export type Magnitud = {
  clave: string;
  nombre: string;
  ambito: "equipo" | "jugador";
  principal: Fuente;
  /** Por qué manda esa fuente, en una línea. */
  porque: string;
  /** true más es mejor, false menos es mejor, null es estilo. */
  mejor: boolean | null;
  unidad: "decimal" | "porcentaje" | "entero";
  /** Decimales para escribirla. */
  decimales: number;
  /** Por partido (equipo) o por 90′ (jugador). */
  base: "partido" | "90";
  opta: Lectura;
  wyscout: Lectura;
  /**
   * `true`: las dos miden lo mismo y la diferencia es de modelo o de
   * etiquetado. `false`: se llaman igual pero no cuentan lo mismo; la
   * segunda lectura no se enseña al lado, y si se enseña, la nota lo dice.
   */
  mismaCosa: boolean;
  umbral: Umbral;
  /** La razón de la diferencia, para la nota («cada proveedor tiene su modelo de xG»). */
  porQueDifiere: string;
  /** «La diferencia es de … no de juego»: modelo (por defecto), cálculo, etiquetado. */
  deQue?: string;
};

/* ------------------------------------------------------------------ */
/*  EL DICCIONARIO                                                     */
/* ------------------------------------------------------------------ */

const XG: Umbral = { relativo: 0.15, absoluto: 0.3, suelo: 0.1 };
const RECUENTO: Umbral = { relativo: 0.15, suelo: 1 };
const PORCENTAJE: Umbral = { absoluto: 5 };

const OPTA_EVENTOS = "Opta tiene los 40 equipos de la categoría evento a evento";
const WYSCOUT_PERFIL = "el perfil de jugador es de Wyscout: 78 métricas y percentil contra su puesto";

export const MAGNITUDES: Magnitud[] = [
  /* ----------------------------- EQUIPO ---------------------------- */
  {
    clave: "xg",
    nombre: "Goles esperados (xG)",
    ambito: "equipo",
    principal: "opta",
    porque: `${OPTA_EVENTOS}, con el xG de cada remate`,
    mejor: true,
    unidad: "decimal",
    decimales: 2,
    base: "partido",
    opta: { clave: "ExpG", definicion: "Suma del xG de cada remate (penaltis incluidos), modelo de Opta." },
    wyscout: { clave: "xg", definicion: "Suma del xG de cada remate (penaltis incluidos), modelo de Wyscout." },
    mismaCosa: true,
    umbral: XG,
    porQueDifiere: "cada proveedor tiene su modelo de xG",
  },
  {
    clave: "xgContra",
    nombre: "xG en contra",
    ambito: "equipo",
    principal: "opta",
    porque: `${OPTA_EVENTOS}, con el xG de cada remate`,
    mejor: false,
    unidad: "decimal",
    decimales: 2,
    base: "partido",
    opta: { clave: "ExpGAg", definicion: "xG de los remates que le hace el rival, modelo de Opta." },
    wyscout: { clave: "xgContra", definicion: "xG de los remates que le hace el rival, modelo de Wyscout (cruzando el informe del rival)." },
    mismaCosa: true,
    umbral: XG,
    porQueDifiere: "cada proveedor tiene su modelo de xG",
  },
  {
    clave: "remates",
    nombre: "Remates",
    ambito: "equipo",
    principal: "opta",
    porque: OPTA_EVENTOS,
    mejor: true,
    unidad: "decimal",
    decimales: 1,
    base: "partido",
    opta: { clave: "ShtIncBl", definicion: "Remates, bloqueados incluidos." },
    wyscout: { clave: "tiros", definicion: "Tiros, bloqueados incluidos." },
    mismaCosa: true,
    umbral: RECUENTO,
    porQueDifiere: "cada proveedor etiqueta el remate a su manera",
    deQue: "etiquetado",
  },
  {
    clave: "rematesContra",
    nombre: "Remates en contra",
    ambito: "equipo",
    principal: "opta",
    porque: OPTA_EVENTOS,
    mejor: false,
    unidad: "decimal",
    decimales: 1,
    base: "partido",
    opta: { clave: "ShotsAg", definicion: "Remates del rival, bloqueados incluidos." },
    wyscout: { clave: "tirosContra", definicion: "Tiros del rival, bloqueados incluidos." },
    mismaCosa: true,
    umbral: RECUENTO,
    porQueDifiere: "cada proveedor etiqueta el remate a su manera",
    deQue: "etiquetado",
  },
  {
    clave: "posesion",
    nombre: "Posesión",
    ambito: "equipo",
    principal: "opta",
    porque: "es estilo, y el estilo se lee en Opta",
    mejor: null,
    unidad: "porcentaje",
    decimales: 0,
    base: "partido",
    opta: { clave: "Poss%", definicion: "Parte de los pases del partido que da el equipo." },
    wyscout: { clave: "posesion", definicion: "Parte del tiempo de juego con el balón." },
    mismaCosa: true,
    umbral: PORCENTAJE,
    porQueDifiere: "Opta la cuenta por pases y Wyscout por tiempo",
  },
  {
    clave: "ppda",
    nombre: "PPDA",
    ambito: "equipo",
    principal: "opta",
    porque: "la presión se lee en Opta, evento a evento y con los 40 equipos",
    mejor: false,
    unidad: "decimal",
    decimales: 1,
    base: "partido",
    opta: {
      clave: "PPDA",
      definicion: "Pases del rival en su 60 % de campo por cada acción defensiva nuestra allí; en la temporada, cociente de las sumas.",
    },
    wyscout: { clave: "ppda", definicion: "Pases del rival por cada acción defensiva nuestra; en la temporada, media de los partidos." },
    mismaCosa: true,
    umbral: RECUENTO,
    porQueDifiere: "Opta lo saca de la temporada entera y Wyscout promedia partido a partido, y un partido raro pesa mucho en la media",
    deQue: "cálculo",
  },
  {
    clave: "recuperacionesAltas",
    nombre: "Recuperaciones altas",
    ambito: "equipo",
    principal: "opta",
    porque: "las recuperaciones por zona son de Opta",
    mejor: true,
    unidad: "decimal",
    decimales: 1,
    base: "partido",
    opta: { clave: "HighTurnovers", definicion: "Robos en juego a menos de 40 m de la portería rival." },
    wyscout: { clave: "Balones recuperados · altos", definicion: "Recuperaciones en el tercio de ataque." },
    mismaCosa: false,
    umbral: RECUENTO,
    porQueDifiere: "Opta mide 40 m desde la portería y Wyscout el último tercio",
  },
  {
    clave: "recuperaciones",
    nombre: "Recuperaciones",
    ambito: "equipo",
    principal: "opta",
    porque: "las recuperaciones por zona son de Opta",
    mejor: true,
    unidad: "decimal",
    decimales: 1,
    base: "partido",
    opta: { clave: "Recovery", definicion: "Sólo balones sueltos o que el rival da; intercepciones y entradas van aparte." },
    wyscout: { clave: "recuperaciones", definicion: "Todo balón que pasa a ser nuestro: intercepciones y entradas incluidas." },
    mismaCosa: false,
    umbral: RECUENTO,
    porQueDifiere: "Opta deja fuera las intercepciones y las entradas",
  },
  {
    clave: "perdidas",
    nombre: "Pérdidas",
    ambito: "equipo",
    principal: "opta",
    porque: "las pérdidas por zona son de Opta",
    mejor: false,
    unidad: "decimal",
    decimales: 1,
    base: "partido",
    opta: { clave: "PossLost", definicion: "Cada pase que no llega, regate perdido o balón robado, salga o no el balón." },
    wyscout: { clave: "perdidas", definicion: "Balones perdidos: pase fallado, duelo perdido o balón robado." },
    mismaCosa: false,
    umbral: RECUENTO,
    porQueDifiere: "cada uno decide qué acción es pérdida",
  },
  {
    clave: "centros",
    nombre: "Centros",
    ambito: "equipo",
    principal: "opta",
    porque: "es estilo, y el estilo se lee en Opta",
    mejor: null,
    unidad: "decimal",
    decimales: 1,
    base: "partido",
    opta: { clave: "Crosses", definicion: "Centros, en juego y de balón parado." },
    wyscout: { clave: "centros", definicion: "Centros laterales al área." },
    mismaCosa: false,
    umbral: RECUENTO,
    porQueDifiere: "Opta cuenta también los centros de balón parado",
  },
  {
    clave: "corners",
    nombre: "Córners a favor",
    ambito: "equipo",
    principal: "opta",
    porque: "el balón parado es de Opta, saque a saque",
    mejor: true,
    unidad: "decimal",
    decimales: 1,
    base: "partido",
    opta: { clave: "CrnrWon", definicion: "Córners que se ganan." },
    wyscout: { clave: "corners", definicion: "Córners que se sacan." },
    mismaCosa: true,
    umbral: { relativo: 0.15, suelo: 0.5 },
    porQueDifiere: "uno cuenta el córner ganado y otro el sacado",
  },
  {
    clave: "golesAbp",
    nombre: "Goles a balón parado",
    ambito: "equipo",
    principal: "opta",
    porque: "el balón parado es de Opta: el gol viene etiquetado con su jugada",
    mejor: true,
    unidad: "entero",
    decimales: 0,
    base: "partido",
    opta: { clave: "GoalSetPly", definicion: "Goles de córner, falta y saque de banda, etiquetados con su jugada; sin penaltis." },
    wyscout: { clave: "golesAbp", definicion: "Estimación: córners y faltas con remate por la conversión de la liga (sin penaltis)." },
    mismaCosa: false,
    umbral: { relativo: 0.3, suelo: 2 },
    porQueDifiere: "Wyscout no etiqueta el gol de balón parado: es una estimación",
  },
  {
    clave: "duelos",
    nombre: "Duelos",
    ambito: "equipo",
    principal: "wyscout",
    porque: "los duelos son de Wyscout",
    mejor: null,
    unidad: "decimal",
    decimales: 0,
    base: "partido",
    opta: { clave: "Duels", definicion: "Duelos en el suelo y por arriba." },
    wyscout: { clave: "duelos", definicion: "Duelos ofensivos, defensivos, aéreos y de balón suelto." },
    mismaCosa: false,
    umbral: RECUENTO,
    porQueDifiere: "Wyscout cuenta como duelo muchos más choques que Opta",
  },
  {
    clave: "duelosGanados",
    nombre: "Duelos ganados %",
    ambito: "equipo",
    principal: "wyscout",
    porque: "los duelos son de Wyscout",
    mejor: true,
    unidad: "porcentaje",
    decimales: 0,
    base: "partido",
    opta: { clave: "Duel%", definicion: "Duelos ganados sobre los jugados." },
    wyscout: { clave: "duelosGanados", definicion: "Duelos ganados sobre los jugados." },
    mismaCosa: true,
    umbral: PORCENTAJE,
    porQueDifiere: "cada proveedor decide qué choque es un duelo",
  },
  {
    clave: "duelosAereos",
    nombre: "Duelos aéreos ganados %",
    ambito: "equipo",
    principal: "wyscout",
    porque: "los duelos son de Wyscout",
    mejor: true,
    unidad: "porcentaje",
    decimales: 0,
    base: "partido",
    opta: { clave: "Aerial%", definicion: "Duelos por arriba ganados sobre los jugados." },
    wyscout: { clave: "duelosAereos", definicion: "Duelos aéreos ganados sobre los jugados." },
    mismaCosa: true,
    umbral: PORCENTAJE,
    porQueDifiere: "cada proveedor decide qué choque es un duelo",
  },

  /* ---------------------------- JUGADOR ---------------------------- */
  {
    clave: "jugador.xg",
    nombre: "xG del jugador",
    ambito: "jugador",
    principal: "wyscout",
    porque: WYSCOUT_PERFIL,
    mejor: true,
    unidad: "decimal",
    decimales: 2,
    base: "90",
    opta: { clave: "ExpG", definicion: "Suma del xG de sus remates, modelo de Opta." },
    wyscout: { clave: "xG/90", definicion: "Suma del xG de sus remates, modelo de Wyscout." },
    mismaCosa: true,
    umbral: { relativo: 0.15, absoluto: 0.15, suelo: 0.05 },
    porQueDifiere: "cada proveedor tiene su modelo de xG",
  },
  {
    clave: "jugador.remates",
    nombre: "Remates del jugador",
    ambito: "jugador",
    principal: "wyscout",
    porque: WYSCOUT_PERFIL,
    mejor: true,
    unidad: "decimal",
    decimales: 1,
    base: "90",
    opta: { clave: "ShtIncBl", definicion: "Remates, bloqueados incluidos." },
    wyscout: { clave: "Remates/90", definicion: "Remates, bloqueados incluidos." },
    mismaCosa: true,
    umbral: { relativo: 0.15, suelo: 0.3 },
    porQueDifiere: "cada proveedor etiqueta el remate a su manera",
    deQue: "etiquetado",
  },
  {
    clave: "jugador.xa",
    nombre: "Asistencias esperadas (xA)",
    ambito: "jugador",
    principal: "wyscout",
    porque: WYSCOUT_PERFIL,
    mejor: true,
    unidad: "decimal",
    decimales: 2,
    base: "90",
    opta: { clave: "xA", definicion: "xG de los remates que nacen de sus pases." },
    wyscout: { clave: "xA/90", definicion: "Probabilidad de que su pase acabe en asistencia." },
    mismaCosa: false,
    umbral: { relativo: 0.2, suelo: 0.05 },
    porQueDifiere: "Opta mide el remate que sale del pase y Wyscout el pase",
  },
  {
    clave: "jugador.centros",
    nombre: "Centros del jugador",
    ambito: "jugador",
    principal: "wyscout",
    porque: WYSCOUT_PERFIL,
    mejor: null,
    unidad: "decimal",
    decimales: 1,
    base: "90",
    opta: { clave: "Crosses", definicion: "Centros, en juego y de balón parado." },
    wyscout: { clave: "Centros/90", definicion: "Centros en juego." },
    mismaCosa: true,
    umbral: { relativo: 0.2, suelo: 0.5 },
    porQueDifiere: "Opta cuenta también los centros de balón parado",
  },
  {
    clave: "jugador.duelosAereos",
    nombre: "Duelos aéreos ganados % del jugador",
    ambito: "jugador",
    principal: "wyscout",
    porque: WYSCOUT_PERFIL,
    mejor: true,
    unidad: "porcentaje",
    decimales: 0,
    base: "90",
    opta: { clave: "Aerial%", definicion: "Duelos por arriba ganados sobre los jugados." },
    wyscout: { clave: "Duelos aéreos ganados, %", definicion: "Duelos aéreos ganados sobre los jugados." },
    mismaCosa: true,
    umbral: { absoluto: 8 },
    porQueDifiere: "cada proveedor decide qué choque es un duelo",
  },
  {
    clave: "jugador.pase",
    nombre: "Acierto en el pase",
    ambito: "jugador",
    principal: "wyscout",
    porque: WYSCOUT_PERFIL,
    mejor: true,
    unidad: "porcentaje",
    decimales: 0,
    base: "90",
    opta: { clave: "Pass%", definicion: "Pases que llegan a un compañero sobre los intentados." },
    wyscout: { clave: "Precisión pases, %", definicion: "Pases precisos sobre los intentados." },
    mismaCosa: true,
    umbral: { absoluto: 5 },
    porQueDifiere: "cada proveedor cuenta el pase a su manera (saques, despejes)",
  },
  {
    clave: "jugador.interceptaciones",
    nombre: "Interceptaciones del jugador",
    ambito: "jugador",
    principal: "wyscout",
    porque: WYSCOUT_PERFIL,
    mejor: true,
    unidad: "decimal",
    decimales: 1,
    base: "90",
    opta: { clave: "Int", definicion: "Pases del rival cortados." },
    wyscout: { clave: "Interceptaciones/90", definicion: "Pases del rival cortados." },
    mismaCosa: true,
    umbral: { relativo: 0.2, suelo: 0.5 },
    porQueDifiere: "cada proveedor etiqueta la intercepción a su manera",
  },
];

export const MAGNITUD = new Map(MAGNITUDES.map((m) => [m.clave, m]));

/** La magnitud por su clave (o la misma si ya es una). */
export function magnitudDe(m: string | Magnitud): Magnitud | null {
  return typeof m === "string" ? (MAGNITUD.get(m) ?? null) : m;
}

export const secundariaDe = (m: Magnitud): Fuente => (m.principal === "opta" ? "wyscout" : "opta");

/** La lectura de una fuente concreta. */
export const lecturaDe = (m: Magnitud, f: Fuente): Lectura => (f === "opta" ? m.opta : m.wyscout);

/* ------------------------------------------------------------------ */
/*  LA NOTA DE DISCREPANCIA                                            */
/* ------------------------------------------------------------------ */

const coma = (v: number, d: number) => v.toFixed(d).replace(".", ",");

/** Cómo se escribe una cifra de la magnitud («1,15», «48 %»). */
export function cifraDe(m: Magnitud, v: number): string {
  return m.unidad === "porcentaje" ? `${coma(v, m.decimales)} %` : coma(v, m.decimales);
}

/** ¿Pasa el umbral? Mismas reglas que `discrepancia`, sin el texto. */
export function pasaUmbral(m: Magnitud, principal: number, secundario: number): boolean {
  const dif = Math.abs(principal - secundario);
  const { relativo, absoluto, suelo = 0 } = m.umbral;
  if (dif < suelo || dif === 0) return false;
  const rel = principal !== 0 ? dif / Math.abs(principal) : Infinity;
  return (relativo != null && rel > relativo) || (absoluto != null && dif > absoluto);
}

/**
 * La nota de método cuando las dos fuentes difieren por encima del umbral
 * («Wyscout le da 1,40: la diferencia es de modelo, no de juego (cada
 * proveedor tiene su modelo de xG)»). Por debajo del umbral, o sin alguna de
 * las dos cifras, `null`: no se comenta.
 *
 * `valorPrincipal` es la cifra de la fuente principal de la magnitud y
 * `valorSecundario` la de la otra, las dos en la misma base (por partido o
 * por 90′) y unidad.
 */
export function discrepancia(
  magnitud: string | Magnitud,
  valorPrincipal: number | null | undefined,
  valorSecundario: number | null | undefined,
): string | null {
  const m = magnitudDe(magnitud);
  if (!m || valorPrincipal == null || valorSecundario == null) return null;
  if (!Number.isFinite(valorPrincipal) || !Number.isFinite(valorSecundario)) return null;
  if (!pasaUmbral(m, valorPrincipal, valorSecundario)) return null;

  const otra = NOMBRE_FUENTE[secundariaDe(m)];
  const dice = `${otra} da ${cifraDe(m, valorSecundario)}`;

  return m.mismaCosa
    ? `${dice}: la diferencia es de ${m.deQue ?? "modelo"}, no de juego (${m.porQueDifiere}).`
    : `${dice}, pero no es la misma cuenta: ${m.porQueDifiere}.`;
}

/* ------------------------------------------------------------------ */
/*  EL SELLO, EN TEXTO                                                 */
/* ------------------------------------------------------------------ */

export type Sello = {
  fuente: Fuente;
  /** «grupo (20 equipos)», «40 equipos», «Primera RFEF». */
  poblacion?: string;
  /** «J11», «8 nov». */
  hasta?: string;
  /** N.º de partidos del equipo o del jugador. */
  partidos?: number;
};

/** «Opta · grupo (20 equipos) · J11 · 11 partidos». */
export function selloTexto({ fuente, poblacion, hasta, partidos }: Sello): string {
  return [
    NOMBRE_FUENTE[fuente],
    poblacion,
    hasta,
    partidos ? `${partidos} ${partidos === 1 ? "partido" : "partidos"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
