/**
 * EL ANÁLISIS DE UN ENTRENAMIENTO (16/10/2026, en obras: sólo el administrador).
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
  [o.id, o.objetivo.trim(), o.jugadores.map((j) => j.id).sort().join(","), (o.reconocer ?? "").trim(), (o.correcto ?? "").trim(), (o.mejorable ?? "").trim(), (o.donde ?? "").trim()].join("|");

/** El veredicto que vale: el del analista si lo hay; si no, el de la IA. `null` = descartada. */
export function veredictoFinal(a: AccionEntreno, validaciones: Record<string, Validacion> | undefined): Veredicto | null {
  const v = validaciones?.[a.id];

  if (v === "descartada") return null;

  return v ?? a.veredicto;
}

/** Las cuentas de un objetivo con lo validado. */
export function cuentas(objetivoId: string, acciones: AccionEntreno[], validaciones: Record<string, Validacion> | undefined) {
  const suyas = acciones.filter((a) => a.objetivoId === objetivoId);
  const vigentes = suyas.map((a) => veredictoFinal(a, validaciones)).filter((v): v is Veredicto => v !== null);
  const correctas = vigentes.filter((v) => v === "correcta").length;
  const validadas = suyas.filter((a) => validaciones?.[a.id]).length;

  return { total: vigentes.length, correctas, mejorables: vigentes.length - correctas, pct: vigentes.length ? Math.round((100 * correctas) / vigentes.length) : null, validadas, propuestas: suyas.length };
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const nuevoId = () => Math.random().toString(36).slice(2, 10);

export function normalizaSesion(x: unknown): SesionEntreno {
  const s = (x && typeof x === "object" ? x : {}) as Partial<SesionEntreno>;

  return {
    objetivos: Array.isArray(s.objetivos)
      ? s.objetivos
          .filter((o) => o && typeof o.objetivo === "string")
          .map((o) => ({ ...o, id: o.id || nuevoId(), jugadores: Array.isArray(o.jugadores) ? o.jugadores.filter((j) => j && j.id) : [] }))
      : [],
    validaciones: s.validaciones && typeof s.validaciones === "object" ? s.validaciones : {},
    notas: typeof s.notas === "string" ? s.notas : "",
  };
}
