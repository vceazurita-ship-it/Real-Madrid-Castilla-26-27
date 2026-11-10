/**
 * LAS MÉTRICAS DE OPTA EN CASTELLANO (09/11/2026).
 *
 * Opta trae unas 1.280 columnas con su abreviatura en inglés (`ExpG`,
 * `PPDA`, `ChncSetPl|OPP`…). Aquí están, traducidas, las que usa el área
 * `/opta`, con lo que hace falta para leerlas bien:
 *
 * - `unidad`: cómo se escriben. Los porcentajes de Opta vienen en tanto por
 *   uno (0,82) y aquí se pasan a 82 %.
 * - `tasa`: si ya es un cociente (posesión, PPDA, acierto). Una tasa no se
 *   divide por partidos ni por 90 minutos; un recuento, sí.
 * - `mejor`: `true` más es mejor, `false` menos es mejor (goles encajados,
 *   PPDA), `null` es estilo y no hay mejor ni peor (posesión, pases).
 *
 * Lo que no está aquí se enseña con el nombre de Opta (`nombreMetrica`).
 * Son nombres, no datos: el repositorio es público y aquí no va ni una cifra.
 */

import type { Unidad } from "@/lib/data-analisis/metricas";
import type { MetricaOpta } from "@/lib/opta";

export type DefMetrica = {
  nombre: string;
  /** Corto, para la cabecera de una tabla. */
  corto?: string;
  unidad: Unidad;
  tasa?: boolean;
  mejor: boolean | null;
  /** Qué mide, en una línea. */
  que?: string;
};

const c = (nombre: string, mejor: boolean | null = true, extra: Partial<DefMetrica> = {}): DefMetrica => ({
  nombre,
  unidad: "entero",
  mejor,
  ...extra,
});
const d = (nombre: string, mejor: boolean | null = true, extra: Partial<DefMetrica> = {}): DefMetrica => ({
  nombre,
  unidad: "decimal",
  mejor,
  ...extra,
});
const pct = (nombre: string, mejor: boolean | null = true, extra: Partial<DefMetrica> = {}): DefMetrica => ({
  nombre,
  unidad: "porcentaje",
  tasa: true,
  mejor,
  ...extra,
});
const tasa = (nombre: string, mejor: boolean | null = true, extra: Partial<DefMetrica> = {}): DefMetrica => ({
  nombre,
  unidad: "decimal",
  tasa: true,
  mejor,
  ...extra,
});

export const METRICAS_OPTA: Record<string, DefMetrica> = {
  /* Resultado */
  GM: c("Partidos jugados", null, { corto: "PJ" }),
  Min: c("Minutos", null, { corto: "Min" }),
  Age: c("Edad", null, { corto: "Edad", tasa: true }),
  /* Puntos y resultados se enseñan siempre en total: «1,45 puntos por partido» no lo lee nadie. */
  P: c("Puntos", true, { corto: "Pts", tasa: true }),
  W: c("Victorias", true, { corto: "G", tasa: true }),
  D: c("Empates", null, { corto: "E", tasa: true }),
  L: c("Derrotas", false, { corto: "P", tasa: true }),
  GF: c("Goles a favor", true, { corto: "GF" }),
  GA: c("Goles encajados", false, { corto: "GC" }),
  ExpGD: d("Diferencia de xG", true, { corto: "xG dif.", que: "xG a favor menos xG en contra" }),
  CleanSheet: c("Porterías a cero", true, { corto: "A cero" }),

  /* Ataque */
  Goal: c("Goles", true, { corto: "Goles" }),
  GoalExPn: c("Goles sin penaltis", true, { corto: "Goles s/p" }),
  ExpG: d("Goles esperados (xG)", true, { corto: "xG", que: "Probabilidad de gol de cada remate, sumada" }),
  NPxG: d("xG sin penaltis", true, { corto: "xG s/p" }),
  xGOP: d("xG en juego", true, { corto: "xG juego", que: "xG de las jugadas que no nacen de balón parado" }),
  xGOT: d("xG a puerta (xGOT)", true, { corto: "xGOT", que: "Calidad de los remates que van entre los tres palos" }),
  "ExpG/Shot": tasa("xG por remate", true, { corto: "xG/rem.", que: "Calidad media de cada remate" }),
  ShtIncBl: c("Remates", true, { corto: "Remates", que: "Incluidos los bloqueados" }),
  SOG: c("Remates a puerta", true, { corto: "A puerta" }),
  "OnTarget%": pct("Remates a puerta (%)", true, { corto: "% a puerta" }),
  TouchOpBox: c("Toques en el área rival", true, { corto: "Toques área" }),
  TchsA3: c("Toques en el último tercio", true, { corto: "Toques ú. tercio" }),
  Chance: c("Ocasiones creadas", true, { corto: "Ocasiones", que: "Pases clave más asistencias" }),
  KeyPass: c("Pases clave", true, { corto: "Pases clave" }),
  Ast: c("Asistencias", true, { corto: "Asist." }),
  xA: d("Asistencias esperadas (xA)", true, { corto: "xA" }),
  CounterAttack: c("Contraataques", null, { corto: "Contras" }),
  CounterAttToShot: c("Contraataques acabados en remate", true, { corto: "Contras a remate" }),
  "1v1InBox": c("Regates en el área", true, { corto: "Regates área" }),
  Sc1v1InBox: c("Regates ganados en el área", true, { corto: "Regates área ok" }),
  KPAf1v1: c("Pases clave tras regate", true, { corto: "P. clave tras regate" }),

  /* Construcción */
  "Poss%": pct("Posesión", null, { corto: "Posesión" }),
  PsAtt: c("Pases intentados", null, { corto: "Pases" }),
  "Pass%": pct("Acierto en el pase", true, { corto: "% pase" }),
  "Ps%InA3rd": pct("Acierto en el pase en el último tercio", true, { corto: "% pase ú. tercio" }),
  ProgPass: c("Pases progresivos", true, { corto: "Progresivos" }),
  PsIntoPen: c("Pases al área", true, { corto: "Pases al área", que: "Incluidos los centros" }),
  "Seq9+Pass": c("Secuencias de 9 pases o más", null, { corto: "Sec. 9+ pases" }),
  SeqEndInA3: c("Secuencias que llegan al último tercio", true, { corto: "Sec. a ú. tercio" }),
  Sequences: c("Secuencias", null, { corto: "Secuencias" }),
  AvgPossPass: tasa("Pases por posesión", null, { corto: "Pases/posesión" }),
  DirectSpeed: tasa("Verticalidad", null, { corto: "Verticalidad", que: "Metros que avanza la jugada por segundo" }),
  LgBall: c("Balones largos", null, { corto: "Largos" }),
  LgBallCp: c("Balones largos completados", true, { corto: "Largos ok" }),
  "LongBall%": pct("Balones largos sobre el total de pases", null, { corto: "% largos" }),
  Crosses: c("Centros", null, { corto: "Centros" }),
  CrossCmp: c("Centros completados", true, { corto: "Centros ok" }),
  ThrghBalls: c("Pases al hueco", true, { corto: "Al hueco" }),
  ThrghBlCmp: c("Pases al hueco completados", true, { corto: "Al hueco ok" }),
  CrossOpen: c("Centros en juego", null, { corto: "Centros juego" }),
  Touches: c("Toques", null, { corto: "Toques" }),
  TchsM3: c("Toques en el tercio medio", null, { corto: "Toques medio" }),
  TchsD3: c("Toques en el propio tercio", null, { corto: "Toques propio" }),
  PossLost: c("Pérdidas", false, { corto: "Pérdidas" }),
  PsLostD3: c("Pérdidas en campo propio", false, { corto: "Pérd. propio" }),
  PsLostM3: c("Pérdidas en el tercio medio", false, { corto: "Pérd. medio" }),
  PsLostA3: c("Pérdidas en el último tercio", null, { corto: "Pérd. ú. tercio" }),
  Disposs: c("Balones perdidos en conducción", false, { corto: "Desposeído" }),
  FoulSuf: c("Faltas recibidas", true, { corto: "F. recibidas" }),

  /* Presión y defensa */
  ExpGAg: d("xG en contra", false, { corto: "xG contra" }),
  NPxGAg: d("xG en contra sin penaltis", false, { corto: "xG contra s/p" }),
  ShotsAg: c("Remates en contra", false, { corto: "Rem. contra" }),
  SOGAg: c("Remates a puerta en contra", false, { corto: "A puerta contra" }),
  PPDA: tasa("PPDA", false, { corto: "PPDA", que: "Pases que se le dejan dar al rival por cada acción defensiva: cuanto más bajo, más se presiona" }),
  HighTurnovers: c("Robos altos", true, { corto: "Robos altos", que: "Recuperaciones a menos de 40 m de la portería rival" }),
  HighTOEndShot: c("Robos altos acabados en remate", true, { corto: "Robo alto a remate" }),
  HighTOEndGoal: c("Robos altos acabados en gol", true, { corto: "Robo alto a gol" }),
  PosWonA3rd: c("Recuperaciones en el último tercio", true, { corto: "Recup. ú. tercio" }),
  PosWonM3rd: c("Recuperaciones en el tercio medio", true, { corto: "Recup. medio" }),
  PosWonD3rd: c("Recuperaciones en el propio tercio", null, { corto: "Recup. propio" }),
  Recovery: c("Recuperaciones", true, { corto: "Recup." }),
  Int: c("Intercepciones", true, { corto: "Intercep." }),
  IntA3: c("Intercepciones en el último tercio", true, { corto: "Intercep. ú. tercio" }),
  Clrnce: c("Despejes", null, { corto: "Despejes" }),
  CrossBlkd: c("Centros bloqueados", null, { corto: "Centros bloq." }),
  "Duel%": pct("Duelos ganados", true, { corto: "% duelos" }),
  "Aerial%": pct("Duelos aéreos ganados", true, { corto: "% aéreos" }),
  "Arl%AH": pct("Aéreos ganados en campo rival", true, { corto: "% aéreos arriba" }),
  "Arl%DH": pct("Aéreos ganados en campo propio", true, { corto: "% aéreos atrás" }),
  AerialWon: c("Duelos aéreos ganados (n.º)", true, { corto: "Aéreos ganados" }),
  "Tackle%": pct("Entradas ganadas", true, { corto: "% entradas" }),
  FoulCom: c("Faltas cometidas", false, { corto: "Faltas" }),
  Yellow: c("Amarillas", false, { corto: "Amarillas" }),
  Red: c("Rojas", false, { corto: "Rojas" }),

  /* Balón parado */
  GoalSetPly: c("Goles a balón parado", true, { corto: "Goles ABP" }),
  "GoalSetPly|OPP": c("Goles a balón parado encajados", false, { corto: "Goles ABP contra" }),
  xGSetPly: d("xG a balón parado", true, { corto: "xG ABP" }),
  ChncSetPl: c("Ocasiones a balón parado", true, { corto: "Ocasiones ABP" }),
  "ChncSetPl|OPP": c("Ocasiones a balón parado concedidas", false, { corto: "Ocasiones ABP contra" }),
  CrnrWon: c("Córners a favor", true, { corto: "Córners" }),
  CrnrLost: c("Córners concedidos", false, { corto: "Córners contra" }),
  Corners: c("Córners lanzados", null, { corto: "Córners lanzados" }),
  xGCrnrs: d("xG de córner", true, { corto: "xG córner" }),
  ShotCrnrs: c("Remates de córner", true, { corto: "Remates córner" }),
  GoalCrnrs: c("Goles de córner", true, { corto: "Goles córner" }),
  "GoalCrnrs|OPP": c("Goles de córner encajados", false, { corto: "Goles córner contra" }),
  "GoalDirFK|OPP": c("Goles de falta directa encajados", false, { corto: "Faltas dir. contra" }),
  GoalDirFK: c("Goles de falta directa", true, { corto: "Goles falta dir." }),
  ShotDirFK: c("Remates de falta directa", true, { corto: "Remates falta dir." }),
  KeyPsCrn: c("Pases clave de córner", true, { corto: "P. clave córner" }),
  KeyPsFK: c("Pases clave de falta", true, { corto: "P. clave falta" }),
  AstCrnr: c("Asistencias de córner", true, { corto: "Asist. córner" }),
  AstFK: c("Asistencias de falta", true, { corto: "Asist. falta" }),
  PensWon: c("Penaltis a favor", true, { corto: "Penaltis" }),
  PensConc: c("Penaltis cometidos", false, { corto: "Penaltis contra" }),
  CrnrsLeadingShot: c("Córners que acaban en remate", true, { corto: "Córner a remate" }),

  /* Portería */
  Saves: c("Paradas", true, { corto: "Paradas" }),
  "Save%": pct("Paradas sobre remates a puerta", true, { corto: "% paradas" }),
  SvInBox: c("Paradas dentro del área", true, { corto: "Paradas área" }),
  xGOTConc: d("xG a puerta concedido", false, { corto: "xGOT contra" }),
  GABA: d("Goles evitados", true, { corto: "Evitados", que: "xG en contra menos goles encajados: positivo, el portero salva más de lo esperado" }),
  GAg: c("Goles encajados en el campo", false, { corto: "Encajados" }),
  CrossClaim: c("Centros atrapados", true, { corto: "Centros atrapados" }),
  SvPen: c("Penaltis parados", true, { corto: "Pen. parados" }),
};

/** El nombre en castellano; si no está traducido, el de Opta (o la abreviatura). */
export function nombreMetrica(a: string, catalogo?: Map<string, MetricaOpta>): string {
  return METRICAS_OPTA[a]?.nombre ?? catalogo?.get(a)?.n ?? a;
}

/** La cabecera corta para una tabla. */
export function cortoMetrica(a: string, catalogo?: Map<string, MetricaOpta>): string {
  const m = METRICAS_OPTA[a];
  return m?.corto ?? m?.nombre ?? catalogo?.get(a)?.n ?? a;
}

/**
 * Cómo se lee una métrica, aunque no esté en el diccionario (con el catálogo de Opta).
 *
 * El formato del catálogo casi nunca es «PERCENT» a secas: lleva su máscara
 * detrás («PERCENT|0.0'%'|-», «NUMBER|0.00|-»…), así que se mira la primera
 * parte. Comparándolo entero, 167 porcentajes sin traducir (Cross%, Shoot%,
 * Arl%AH…) se dividían por partido o por 90 y salían en tanto por uno.
 */
export function defMetrica(a: string, catalogo?: Map<string, MetricaOpta>): DefMetrica {
  const m = METRICAS_OPTA[a];
  if (m) return m;
  const f = String(catalogo?.get(a)?.f ?? "").split("|")[0];
  const nombre = catalogo?.get(a)?.n ?? a;
  return {
    nombre,
    unidad: f === "PERCENT" ? "porcentaje" : f === "INTEGER" ? "entero" : "decimal",
    /* Las medias y los cocientes de Opta («Avg Pass Distance», «Points Per Game», «… (Per 90)») ya vienen divididos. */
    tasa: f === "PERCENT" || (f === "NUMBER" && esMediaPorNombre(nombre)),
    mejor: null,
  };
}

/*
 * «Distance» no basta (las distancias recorridas del físico son totales), «km/h» no es un cociente
 * y «Above Average» (GAA, AAA) es un total: las medias llevan «Avg», «Average», «Per» o « / ».
 */
const MEDIA = /\bavg\b|\baverage\b|\bper\b| \/ |\bage\b/i;
/* Sin «lookbehind» en la expresión: el Safari de algunos iPad no lo entiende y tumbaría el módulo entero. */
const esMediaPorNombre = (nombre: string) => MEDIA.test(nombre.replace(/above average/gi, ""));

/** El puesto de Opta en una familia, para comparar a cada uno con los suyos. */
export const FAMILIA_PUESTO: Record<string, string> = {
  Goalkeeper: "Porteros",
  "Central Defender": "Centrales",
  "Left Centre Back": "Centrales",
  "Right Centre Back": "Centrales",
  "Right Back": "Laterales",
  "Left Back": "Laterales",
  "Right Wing Back": "Laterales",
  "Left Wing Back": "Laterales",
  "Defensive Midfielder": "Mediocentros",
  "Central Midfielder": "Mediocentros",
  "Left Central Midfielder": "Mediocentros",
  "Right Central Midfielder": "Mediocentros",
  "Attacking Midfielder": "Mediapuntas",
  "Centre Attacking Midfielder": "Mediapuntas",
  "Left Attacking Midfielder": "Bandas",
  "Right Attacking Midfielder": "Bandas",
  "Left Midfielder": "Bandas",
  "Right Midfielder": "Bandas",
  "Left Winger": "Bandas",
  "Right Winger": "Bandas",
  "Second Striker": "Delanteros",
  "Centre Forward": "Delanteros",
  Striker: "Delanteros",
};

export const FAMILIAS = ["Porteros", "Centrales", "Laterales", "Mediocentros", "Mediapuntas", "Bandas", "Delanteros"] as const;

/** Las métricas de la ficha de cada familia: lo que se le pide a ese puesto. */
export const PERFIL_FAMILIA: Record<string, string[]> = {
  Porteros: ["Saves", "SvInBox", "GABA", "GAg", "ExpGAg", "CrossClaim", "Pass%", "LgBall", "LongBall%"],
  Centrales: ["Pass%", "LgBallCp", "Int", "Clrnce", "Recovery", "PosWonM3rd", "Duel%", "Aerial%", "AerialWon", "Tackle%", "PossLost", "FoulCom"],
  Laterales: ["Crosses", "CrossCmp", "Chance", "xA", "TchsA3", "Pass%", "Recovery", "Int", "Duel%", "Tackle%", "Aerial%", "PossLost"],
  Mediocentros: ["Touches", "PsAtt", "Pass%", "Ps%InA3rd", "Chance", "xA", "ThrghBalls", "Recovery", "PosWonM3rd", "Int", "Duel%", "PossLost"],
  Mediapuntas: ["Chance", "KeyPass", "xA", "Ast", "ExpG", "Goal", "ShtIncBl", "TouchOpBox", "1v1InBox", "Ps%InA3rd", "PosWonA3rd", "PossLost"],
  Bandas: ["Goal", "ExpG", "ShtIncBl", "Chance", "xA", "Crosses", "1v1InBox", "Sc1v1InBox", "TouchOpBox", "PosWonA3rd", "Disposs", "PossLost"],
  Delanteros: ["Goal", "GoalExPn", "ExpG", "ShtIncBl", "SOG", "OnTarget%", "TouchOpBox", "Chance", "xA", "Aerial%", "PosWonA3rd", "PossLost"],
};

/** Las fases del colectivo, con sus métricas de equipo. */
export const FASES_EQUIPO: { clave: string; titulo: string; pregunta: string; metricas: string[] }[] = [
  {
    clave: "ataque",
    titulo: "Ataque",
    pregunta: "¿Cuánto y qué tan bien rematamos?",
    metricas: ["Goal", "ExpG", "NPxG", "xGOP", "xGOT", "ShtIncBl", "SOG", "ExpG/Shot", "TouchOpBox", "Chance", "CounterAttToShot"],
  },
  {
    clave: "construccion",
    titulo: "Construcción",
    pregunta: "¿Cómo llevamos el balón hasta arriba?",
    metricas: ["Poss%", "PsAtt", "Pass%", "Ps%InA3rd", "ProgPass", "PsIntoPen", "SeqEndInA3", "Seq9+Pass", "AvgPossPass", "DirectSpeed", "PossLost"],
  },
  {
    clave: "defensa",
    titulo: "Presión y defensa",
    pregunta: "¿Cuánto concedemos y dónde robamos?",
    metricas: ["GA", "ExpGAg", "ShotsAg", "SOGAg", "PPDA", "HighTurnovers", "HighTOEndShot", "PosWonA3rd", "Recovery", "Int", "Duel%", "Aerial%", "FoulCom"],
  },
  {
    clave: "abp",
    titulo: "Balón parado",
    pregunta: "¿Qué sacamos y qué concedemos a balón parado?",
    metricas: ["GoalSetPly", "xGSetPly", "ChncSetPl", "CrnrWon", "xGCrnrs", "PensWon", "GoalSetPly|OPP", "ChncSetPl|OPP", "CrnrLost", "GoalCrnrs|OPP", "PensConc"],
  },
  {
    clave: "porteria",
    titulo: "Portería",
    pregunta: "¿Qué hace nuestro portero con lo que le llega?",
    metricas: ["Saves", "Save%", "GABA", "xGOTConc", "CleanSheet", "CrossClaim", "SvPen"],
  },
];
