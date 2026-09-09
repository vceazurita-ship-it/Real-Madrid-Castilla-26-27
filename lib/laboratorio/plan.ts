/**
 * Laboratorio · del scouting al borrador del plan de partido.
 *
 * El cuerpo técnico escribe dos cosas distintas sobre cada rival:
 *
 * - **El análisis del rival** (`/scout-rival-collective`): cómo defiende en
 *   bloque alto, cómo inicia, dónde sufre a la espalda. Son treinta campos y
 *   se rellenan viendo vídeo, así que casi siempre están.
 * - **El plan de partido** (`/match-preparation`): qué vamos a hacer nosotros.
 *   Claves, ataque, defensa, balón parado, duelos y estructuras. Se escribe la
 *   noche antes y es lo que se lleva a la charla.
 *
 * Lo segundo sale de lo primero y de la identidad del equipo, y eso es
 * exactamente lo que un modelo puede adelantar: **un borrador**, no el plan.
 * Aquí no se inventa una idea de juego —se toma de los planes que el cuerpo
 * técnico ya ha escrito esta temporada, que son el ejemplo de estilo— y se
 * cruza con el scouting del rival de la semana.
 *
 * Reglas de la casa, que son las que hacen que esto se pueda usar:
 *
 * 1. **No escribe en la hoja.** Devuelve un borrador y punto: se lee, se
 *    corrige y se copia lo que valga. Un plan de partido lo firma un
 *    entrenador, no un modelo.
 * 2. **Sólo habla de lo que hay escrito.** Si del rival no consta cómo
 *    defiende los córners, el borrador lo deja en blanco y lo dice, en vez de
 *    rellenarlo con literatura.
 * 3. **Se ve de dónde sale cada cosa.** Cada campo del borrador viene con los
 *    campos del scouting en los que se apoya.
 */

/** Los campos del plan que se redactan. Son los de `/match-preparation`. */
export const CAMPOS_BORRADOR = [
  "CLAVES_PARTIDO",
  "CLAVES_EMOCIONALES",
  "ATAQUE",
  "DEFENSA",
  "ABP_OF",
  "ABP_DEF",
  "DUELOS_CB_FAVOR",
  "DUELOS_CB_CONTRA",
  "DUELOS_SB_FAVOR",
  "DUELOS_SB_CONTRA",
  "FORTALEZAS",
  "DEBILIDADES",
  "ESTRUCTURA_OF",
  "ESTRUCTURA_DEF",
] as const;

export type CampoBorrador = (typeof CAMPOS_BORRADOR)[number];

export const ETIQUETA_CAMPO: Record<CampoBorrador, string> = {
  CLAVES_PARTIDO: "Claves del partido",
  CLAVES_EMOCIONALES: "Claves emocionales",
  ATAQUE: "Ataque",
  DEFENSA: "Defensa",
  ABP_OF: "ABP ofensivo",
  ABP_DEF: "ABP defensivo",
  DUELOS_CB_FAVOR: "Duelos CB a favor",
  DUELOS_CB_CONTRA: "Duelos CB en contra",
  DUELOS_SB_FAVOR: "Duelos SB a favor",
  DUELOS_SB_CONTRA: "Duelos SB en contra",
  FORTALEZAS: "Fortalezas del rival",
  DEBILIDADES: "Debilidades del rival",
  ESTRUCTURA_OF: "Estructura ofensiva",
  ESTRUCTURA_DEF: "Estructura defensiva",
};

/** Los campos del scouting del rival: la materia prima del borrador. */
export const CAMPOS_SCOUTING = [
  "DEF_REINICIO_EMPAREJAN",
  "DEF_REINICIO_ORIENTAN",
  "DEF_REINICIO_ACTIVOS_PRESION",
  "DEF_REINICIO_JUGADORES_DEBILES",
  "DEF_BLOQUE_ALTO_ESTRUCTURA",
  "DEF_BLOQUE_ALTO_TRAYECTORIA_ACOSO",
  "DEF_BLOQUE_ALTO_SALTOS_PARES_IMPARES",
  "DEF_BLOQUE_ALTO_DISTANCIAS",
  "DEF_BLOQUE_ALTO_ESPALDA",
  "DEF_BLOQUE_MEDIO_ESTRUCTURA",
  "DEF_BLOQUE_MEDIO_FUSIONAN_LINEA",
  "DEF_BLOQUE_MEDIO_CORTES",
  "DEF_BLOQUE_MEDIO_DISTANCIAS",
  "DEF_BLOQUE_MEDIO_CENTRALES_SALTADORES",
  "DEF_BLOQUE_MEDIO_ESPALDA",
  "DEF_AREA_HUNDE_LINEA",
  "DEF_AREA_PUNTO_PENALTI",
  "DEF_AREA_JUGADOR_DEBIL",
  "OF_REINICIO_ROMBO",
  "OF_REINICIO_REFERENCIA_PARTIDO",
  "OF_REINICIO_REFERENCIAS",
  "OF_REINICIO_EQUIPO_PRESIONANTE",
  "OF_REINICIO_CONTEXTO",
  "OF_REINICIO_CERRADO",
  "OF_INICIO_ESTRUCTURA",
  "OF_INICIO_CENTRAL_CAPACIDAD",
  "OF_INICIO_JUGAR_ESPACIO",
  "OF_INICIO_JUGADOR_DEBIL_DENTRO",
  "OF_INICIO_ASOCIACIONES",
  "OF_CAMPO_ESTRUCTURA",
  "OF_CAMPO_CARRIL_EXTERIOR",
  "OF_CAMPO_JUGADORES_DENTRO",
  "OF_AREA_JUGADORES",
  "OF_AREA_CENTROS",
  "TRANSICION_DEF_ESTRUCTURA",
  "TRANSICION_DEF_DIFICULTADES_ESPALDA",
  "TRANSICION_DEF_PRIMERA_INTENCION",
  "FORTALEZAS_INDIVIDUALES",
  "DEBILIDADES_INDIVIDUALES",
  "JUGADORES_CLAVE",
] as const;

export type Fila = Record<string, string>;

export type CampoRedactado = {
  campo: CampoBorrador;
  texto: string;
  /** Campos del scouting en los que se apoya. Vacío = no había en qué. */
  seApoyaEn: string[];
};

export type Borrador = {
  campos: CampoRedactado[];
  /** Lo que el scouting no cuenta y haría falta para cerrar el plan. */
  huecos: string[];
  motor: string;
  /** Céntimos de euro, estimados. 0 en los motores del plan gratuito. */
  coste: number;
};

/* ------------------------------------------------------------------ */
/*  MOTORES                                                            */
/* ------------------------------------------------------------------ */

export type Motor = {
  key: string;
  label: string;
  /** Lo que hay que saber antes de pulsar. */
  pista: string;
  proveedor: "google" | "openai";
  modelo: string;
  /** Dólares por millón de tokens, para estimar lo que cuesta cada borrador. */
  entrada: number;
  salida: number;
  gratis: boolean;
};

/**
 * Los dos motores.
 *
 * El de Google ya lo usa la app para el dictado por voz y la importación de
 * sesiones, así que la clave está puesta y su plan gratuito cubre de sobra un
 * puñado de borradores por semana. El de OpenAI es el que se preguntó —GPT-6
 * Astra, salido el 3 de septiembre de 2026— y **se cobra por uso**: diez
 * dólares el millón de tokens de entrada y cincuenta el de salida. Un borrador
 * ronda los cuatro mil de entrada y dos mil de salida, o sea unos catorce
 * céntimos. No es gratis, pero tampoco es una suscripción nueva: sale de la
 * clave de OpenAI que el proyecto ya tiene.
 */
export const MOTORES: Motor[] = [
  {
    key: "gemini",
    label: "Gemini 2.5 Flash",
    pista: "El que ya usa la app para el dictado. Plan gratuito: sin coste.",
    proveedor: "google",
    modelo: "gemini-2.5-flash",
    entrada: 0,
    salida: 0,
    gratis: true,
  },
  {
    key: "astra",
    label: "GPT-6 Astra",
    pista: "El de OpenAI, del 3 de septiembre de 2026. Se paga por uso: unos 14 céntimos por borrador.",
    proveedor: "openai",
    modelo: "gpt-6-astra",
    entrada: 10,
    salida: 50,
    gratis: false,
  },
];

export const MOTOR_POR_DEFECTO = "gemini";

/** Céntimos de euro, redondeando por arriba y con el cambio a ojo. */
export function costeEstimado(motor: Motor, entrada: number, salida: number) {
  if (motor.gratis) return 0;

  const dolares =
    (entrada / 1_000_000) * motor.entrada + (salida / 1_000_000) * motor.salida;

  return Math.round(dolares * 100);
}

/* ------------------------------------------------------------------ */
/*  EL ENCARGO                                                         */
/* ------------------------------------------------------------------ */

/** Los campos con algo escrito, en «CAMPO: texto». */
export function comoTexto(fila: Fila, campos: readonly string[]) {
  return campos
    .map((campo) => [campo, String(fila[campo] ?? "").trim()] as const)
    .filter(([, texto]) => texto !== "")
    .map(([campo, texto]) => `${campo}: ${texto}`)
    .join("\n");
}

/**
 * El encargo que se le manda al modelo.
 *
 * Lo importante no es la lista de instrucciones sino **los ejemplos**: los
 * planes que el cuerpo técnico ya ha escrito son los que llevan la voz de la
 * casa —«Estructura Piramidal dinámica y variable», los reinicios numerados,
 * el ABP en tres líneas—, y sin ellos sale un texto de manual que no se
 * parece a nada de lo que se lee en la caseta.
 */
export function encargo(opciones: {
  rival: Fila;
  ejemplos: Fila[];
}): { sistema: string; peticion: string } {
  const { rival, ejemplos } = opciones;

  const sistema = [
    "Eres analista del Real Madrid Castilla y preparas el BORRADOR del plan de partido de esta jornada.",
    "",
    "Reglas que no se saltan:",
    "1. Escribe SOLO a partir del scouting que se te da y del estilo de los planes de ejemplo. No inventes datos del rival: ni nombres, ni dorsales, ni estadísticas que no aparezcan.",
    "2. Si para un campo no hay material suficiente, deja el texto vacío y explica qué falta en «huecos». Un campo en blanco es mejor que un campo relleno de tópicos.",
    "3. Copia el REGISTRO de los ejemplos: telegráfico, en líneas cortas, numerando cuando el ejemplo numera. Nada de párrafos explicativos ni de lenguaje de informe comercial.",
    "3b. Cada punto numerado va en SU PROPIA LÍNEA, separado con un salto de línea real (\\n). Nunca encadenes «1. … 2. …» en el mismo renglón: esto se lee en una charla, no en un párrafo.",
    "4. ATAQUE y DEFENSA describen lo que hace el CASTILLA; FORTALEZAS y DEBILIDADES describen al RIVAL. No los confundas.",
    "5. En «seApoyaEn» pon los nombres exactos de los campos del scouting que has usado para ese texto.",
    "6. Escribe en español de España, sin encabezados en Markdown.",
  ].join("\n");

  const muestras = ejemplos
    .map(
      (ejemplo, indice) =>
        `--- EJEMPLO ${indice + 1} · plan escrito por el cuerpo técnico contra ${
          ejemplo.EQUIPO ?? "un rival"
        } ---\n${comoTexto(ejemplo, CAMPOS_BORRADOR)}`,
    )
    .join("\n\n");

  const peticion = [
    `RIVAL DE ESTA JORNADA: ${rival.EQUIPO ?? "—"} (jornada ${rival.JORNADA ?? "—"}, ${
      rival.LOCAL_VISITANTE ?? "—"
    }).`,
    "",
    "SCOUTING DEL RIVAL, tal y como está escrito en la hoja:",
    comoTexto(rival, CAMPOS_SCOUTING) || "(no hay scouting escrito)",
    "",
    muestras,
    "",
    `Redacta el borrador de estos campos: ${CAMPOS_BORRADOR.join(", ")}.`,
  ].join("\n");

  return { sistema, peticion };
}

/** El esquema de la respuesta, para pedirla ya estructurada. */
export const ESQUEMA_BORRADOR = {
  type: "object",
  properties: {
    campos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          campo: { type: "string", enum: [...CAMPOS_BORRADOR] },
          texto: { type: "string" },
          seApoyaEn: { type: "array", items: { type: "string" } },
        },
        required: ["campo", "texto", "seApoyaEn"],
      },
    },
    huecos: { type: "array", items: { type: "string" } },
  },
  required: ["campos", "huecos"],
} as const;
