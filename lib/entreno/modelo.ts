/**
 * EL ANÁLISIS DE UN ENTRENAMIENTO (16/10/2026; terminado el 19/10/2026 y
 * abierto al cuerpo técnico en /analisis-entrenamiento).
 *
 * El analista sube el entrenamiento del día a Hudl (con la fecha en el título)
 * y, cuando la hay, deja la grabación de la cámara táctica en
 * `C:\Users\Usuario\Downloads\RMCF CASTILLA\SESIONES`. En la pantalla define
 * objetivos —uno o varios jugadores, qué se busca, cómo reconocerlos en el
 * vídeo y qué es correcto o mejorable— y pide el análisis. El ordenador del
 * club (`scripts/entreno/analiza-entreno.mjs`, encargo `entreno` del vigía)
 * busca el vídeo, Gemini propone las acciones de cada objetivo con su
 * veredicto, se cortan clips de ejemplo y se cuentan. El analista valida o
 * corrige cada acción: los números finales salen de lo validado.
 *
 * Dos documentos por día, separados para no pisarse:
 *   - `entreno:AAAA-MM-DD` → lo que escribe la pantalla (objetivos y validaciones).
 *   - `entreno-analisis:AAAA-MM-DD` → lo que escribe el ordenador del club.
 */

export type JugadorObjetivo = { id: string; nombre: string };

export type ObjetivoEntreno = {
  id: string;
  jugadores: JugadorObjetivo[];
  /** «Perfilarse antes de recibir para jugar hacia delante». */
  objetivo: string;
  /** Cómo encontrarlos en el vídeo: «peto naranja, dorsal 8», «el lateral izquierdo del equipo de blanco». */
  reconocer?: string;
  /** Qué cuenta como acción correcta y qué como mejorable (lo que lee la IA para decidir). */
  correcto?: string;
  mejorable?: string;
  /** Si sólo interesa una tarea o un tramo: «rondo 6v3», «del minuto 20 al 45». */
  donde?: string;
  /*
  | Lo que se añadió el 19/10/2026 (opcional: los objetivos guardados antes
  | siguen valiendo tal cual). Sólo `tarea` entra en `huellaObjetivo`, y sólo
  | sin «Mirar sólo en»: desde el 21/10/2026 se le pasa a la IA como pista.
  | El resto no cambia lo que mira la IA y tocarlo no pide volver a analizar.
  */
  /** La tarea del registro del día en la que mirarlo: «L-T1». */
  tarea?: string;
  /** Cómo se llama esa tarea en el registro, copiado al elegirla: «Rondo 6v3 + 2». */
  tareaTexto?: string;
  /** El porcentaje de correctas que se pide (1-100): con él se dice si se cumple. */
  meta?: number;
  /** De dónde sale el objetivo: «Seguimiento individual», «Qué toca · post J8»… */
  origen?: string;
};

export type Veredicto = "correcta" | "mejorable";

/** Lo que decide el analista sobre una acción propuesta. */
export type Validacion = Veredicto | "descartada";

export type SesionEntreno = {
  objetivos: ObjetivoEntreno[];
  /** Por id de acción: lo que dijo el analista (manda sobre la IA). */
  validaciones?: Record<string, Validacion>;
  /** Notas generales de la sesión. */
  notas?: string;
};

export const SESION_VACIA: SesionEntreno = { objetivos: [], validaciones: {} };

export type AccionEntreno = {
  id: string;
  objetivoId: string;
  /** Segundos desde el principio del vídeo analizado. */
  inicio: number;
  fin: number;
  veredicto: Veredicto;
  /** Quién (como lo describió la IA) y por qué ese veredicto. */
  jugador?: string;
  explicacion: string;
  /** El clip cortado (bucket), si se cortó: no se corta todo, sólo ejemplos. */
  clip?: string | null;
};

export type ResumenObjetivo = { objetivoId: string; total: number; correctas: number; mejorables: number };

export type AnalisisEntreno = {
  fecha: string;
  hechoEn: string;
  fuente: { tipo: "camara" | "hudl"; nombre: string; duracion: number; url?: string | null };
  acciones: AccionEntreno[];
  resumen: ResumenObjetivo[];
  /** Lo que conviene saber (partes que la IA no pudo leer, cuota agotada…). */
  avisos: string[];
  /** Los objetivos tal y como estaban al analizar: si luego cambian, se avisa. */
  objetivosAnalizados: string[];
};

export const claveSesion = (fecha: string) => `entreno:${fecha}`;
export const claveAnalisis = (fecha: string) => `entreno-analisis:${fecha}`;
export const KIND_ENTRENO = "entreno";

/** Una huella de los objetivos (lo que importa para el análisis) para saber si han cambiado desde el último. */
export const huellaObjetivo = (o: ObjetivoEntreno) =>
  [o.id, o.objetivo.trim(), o.jugadores.map((j) => j.id).sort().join(","), (o.reconocer ?? "").trim(), (o.correcto ?? "").trim(), (o.mejorable ?? "").trim(), (o.donde ?? "").trim(), ...(!(o.donde ?? "").trim() && o.tarea ? [`t:${o.tarea.trim()}`] : [])].join("|");

/** El veredicto que vale: el del analista si lo hay; si no, el de la IA. `null` = descartada. */
export function veredictoFinal(a: AccionEntreno, validaciones: Record<string, Validacion> | undefined): Veredicto | null {
  const v = validaciones?.[a.id];

  if (v === "descartada") return null;

  return v ?? a.veredicto;
}

/**
 * Con menos acciones que esto no se da porcentaje (19/10/2026): un 67 % de
 * tres acciones se leía igual que uno de cuarenta. Por debajo, «tendencia».
 */
export const MINIMO_PORCENTAJE = 8;

export type Cuentas = {
  /** Las que cuentan (Y): todas menos las descartadas. */
  total: number;
  correctas: number;
  mejorables: number;
  /** De las que cuentan, cuántas ha validado alguien (Z). Las demás van con lo que dijo la IA. */
  validadas: number;
  /** Las que siguen como las dejó la IA, sin que nadie las mire (descartadas aparte). */
  porValidar: number;
  descartadas: number;
  /** Lo que propuso la IA, descartadas incluidas. */
  propuestas: number;
  /** El porcentaje de correctas, sólo con `MINIMO_PORCENTAJE` acciones o más. */
  pct: number | null;
  /** El porcentaje aunque la muestra sea corta (para la barra y para comparar). */
  pctBruto: number | null;
  muestraCorta: boolean;
};

/** Las cuentas de un conjunto de acciones con lo validado. */
export function cuentasDe(suyas: AccionEntreno[], validaciones: Record<string, Validacion> | undefined): Cuentas {
  const vigentes = suyas.filter((a) => veredictoFinal(a, validaciones) !== null);
  const correctas = vigentes.filter((a) => veredictoFinal(a, validaciones) === "correcta").length;
  const validadas = vigentes.filter((a) => validaciones?.[a.id]).length;
  const pctBruto = vigentes.length ? Math.round((100 * correctas) / vigentes.length) : null;

  return {
    total: vigentes.length,
    correctas,
    mejorables: vigentes.length - correctas,
    validadas,
    porValidar: suyas.filter((a) => !validaciones?.[a.id]).length,
    descartadas: suyas.length - vigentes.length,
    propuestas: suyas.length,
    pct: vigentes.length >= MINIMO_PORCENTAJE ? pctBruto : null,
    pctBruto,
    muestraCorta: vigentes.length > 0 && vigentes.length < MINIMO_PORCENTAJE,
  };
}

/** Las cuentas de un objetivo con lo validado. */
export function cuentas(objetivoId: string, acciones: AccionEntreno[], validaciones: Record<string, Validacion> | undefined) {
  return cuentasDe(
    acciones.filter((a) => a.objetivoId === objetivoId),
    validaciones,
  );
}

/**
 * La cuenta, dicha siempre igual (19/10/2026): «9 de 14 correctas (11
 * validadas)». Con muestra corta no hay porcentaje: «tendencia».
 */
export function lecturaCuentas(c: Cuentas) {
  if (!c.total) return "Ninguna acción cuenta";

  const validadas = c.validadas === c.total ? "todas validadas" : c.validadas === 0 ? "ninguna validada" : `${c.validadas} validada${c.validadas === 1 ? "" : "s"}`;
  const base = `${c.correctas} de ${c.total} correctas (${validadas})`;

  return c.pct !== null ? `${base} · ${c.pct} %` : `${base} · tendencia`;
}

/** El porcentaje o, con muestra corta, la palabra «tendencia». */
export const porcentajeOTendencia = (c: Cuentas) => (c.pct !== null ? `${c.pct} %` : c.total ? "Tendencia" : "");

/** ¿Llega a la meta? `null` si no hay meta o la muestra no deja decirlo. */
export function cumpleMeta(c: Cuentas, meta: number | undefined): boolean | null {
  if (!meta || c.pct === null) return null;

  return c.pct >= meta;
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const nuevoId = () => Math.random().toString(36).slice(2, 10);

export function normalizaSesion(x: unknown): SesionEntreno {
  const s = (x && typeof x === "object" ? x : {}) as Partial<SesionEntreno>;

  return {
    objetivos: Array.isArray(s.objetivos)
      ? s.objetivos
          .filter((o) => o && typeof o.objetivo === "string")
          /* Sin id, uno fijo por su sitio: uno al azar cambiaría en cada pintado y la edición iría a parar a otro. */
          .map((o, i) => ({
            ...o,
            id: o.id || `obj-${i}`,
            jugadores: Array.isArray(o.jugadores) ? o.jugadores.filter((j) => j && j.id) : [],
            /* La meta, sólo si es un número con sentido: un texto o un 0 la quitan en vez de romper la cuenta. */
            meta: typeof o.meta === "number" && o.meta >= 1 && o.meta <= 100 ? Math.round(o.meta) : undefined,
          }))
      : [],
    validaciones: s.validaciones && typeof s.validaciones === "object" ? s.validaciones : {},
    notas: typeof s.notas === "string" ? s.notas : "",
  };
}
