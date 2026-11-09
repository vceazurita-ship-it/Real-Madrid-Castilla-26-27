/**
 * QUÉ SE ACTUALIZA SOLO, Y CUÁNDO FUE LA ÚLTIMA VEZ (09/11/2026).
 *
 * Lo pidió el analista: una pestaña en Ajustes con la lista de los datos que
 * se van poniendo al día (quiniela, equipos rivales, ABP, datos de la jornada,
 * laboratorio de ABP…). Cada entrada dice qué alimenta, de dónde sale, cada
 * cuánto se hace y DÓNDE MIRAR SU FECHA, que es la del dato de verdad:
 *
 * - `docs` / `prefijos`: documentos de Supabase (`updated_at`).
 * - `ficheros`: ficheros de `public/data` que se publican con la web; su
 *   fecha es la del último commit en GitHub (el repo es público).
 *
 * `cadaHoras` es lo que se espera entre dos actualizaciones: con más del
 * doble (y un margen) se marca «atrasada». `encargo` enlaza con el botón de
 * siempre de Ajustes cuando se puede pedir a mano.
 *
 * Al añadir un proceso nuevo que ponga datos al día, añádelo aquí.
 */
import type { Tarea } from "@/lib/mantenimiento";

export type Grupo = "jornada" | "diario" | "semanal" | "continuo" | "mano";

export type Actualizacion = {
  clave: string;
  nombre: string;
  /** Qué pantallas o informes come de esto. */
  alimenta: string;
  fuente: string;
  /** Cuándo se hace, en palabras. */
  cuando: string;
  grupo: Grupo;
  cadaHoras?: number;
  docs?: string[];
  prefijos?: string[];
  ficheros?: string[];
  encargo?: Tarea;
  /** La pantalla donde se ve. */
  enlace?: string;
};

export const GRUPOS: { grupo: Grupo; titulo: string; texto: string }[] = [
  { grupo: "jornada", titulo: "Cada noche · la jornada", texto: "La tarea «Jornada nocturna» del ordenador del club, a las 00:00 y, si no sale, cada dos horas hasta que salga." },
  { grupo: "diario", titulo: "Cada mañana", texto: "Tareas del ordenador del club a primera hora." },
  { grupo: "semanal", titulo: "Cada semana o cada mes", texto: "Las descargas de Wyscout." },
  { grupo: "continuo", titulo: "Durante el día", texto: "Lo que el vigía del ordenador del club refresca solo o recoge en cuanto aparece." },
  { grupo: "mano", titulo: "Cuando se pide", texto: "No tienen hora: se lanzan desde aquí o desde su pantalla." },
];

export const ACTUALIZACIONES: Actualizacion[] = [
  /* ---------- Cada noche: la jornada ---------- */
  {
    clave: "jornada",
    nombre: "Datos de la jornada",
    alimenta: "Resultados, goleadores con su asistente, alineaciones, tarjetas y clasificación: plantillas rivales, informes y portada",
    fuente: "BeSoccer",
    cuando: "Cada noche",
    grupo: "jornada",
    cadaHoras: 24,
    docs: ["rivals:informe"],
    encargo: "rivales",
    enlace: "/rivals",
  },
  {
    clave: "rivales-stats",
    nombre: "Fichas de los jugadores rivales",
    alimenta: "Minutos, goles y tarjetas de cada rival, «Cómo llega» y las fichas de /rivals",
    fuente: "BeSoccer",
    cuando: "Cada noche (con la jornada)",
    grupo: "jornada",
    cadaHoras: 24,
    docs: ["rivals:stats"],
    encargo: "rivales",
    enlace: "/rivals",
  },
  {
    clave: "plantillas-rivales",
    nombre: "Altas, bajas y dorsales de los equipos rivales",
    alimenta: "El aviso de cambios en las plantillas rivales y las caras que faltaban",
    fuente: "BeSoccer",
    cuando: "Cada noche (con la jornada)",
    grupo: "jornada",
    cadaHoras: 24,
    docs: ["rivals:cotejo"],
    encargo: "rivales",
    enlace: "/rivals",
  },
  {
    clave: "castilla-besoccer",
    nombre: "Nuestra plantilla en BeSoccer",
    alimenta: "Minutos, titularidades, goles, asistencias y tarjetas en Valoraciones y en las fichas individuales",
    fuente: "BeSoccer",
    cuando: "Cada noche (con la jornada)",
    grupo: "jornada",
    cadaHoras: 24,
    docs: ["castilla:besoccer"],
    encargo: "rivales",
    enlace: "/ratings",
  },
  {
    clave: "goles",
    nombre: "Goles de la liga",
    alimenta: "Análisis de goles: franjas, local/visitante y tipología",
    fuente: "BeSoccer",
    cuando: "Cada noche (con la jornada)",
    grupo: "jornada",
    cadaHoras: 24,
    docs: ["goles:analisis"],
    encargo: "rivales",
    enlace: "/analisis-goles",
  },
  {
    clave: "abp-cortes",
    nombre: "Vídeo de cada acción a balón parado",
    alimenta: "Los cortes de ABP ofensivo y defensivo de cada jornada",
    fuente: "Hudl y vídeo del partido",
    cuando: "Cada noche (con la jornada)",
    grupo: "jornada",
    cadaHoras: 24 * 7,
    docs: ["abp:cortes"],
    enlace: "/setpieces",
  },
  {
    clave: "quiniela",
    nombre: "Resultados de la quiniela",
    alimenta: "El 1-X-2 de la jornada y el ranking de acierto",
    fuente: "BeSoccer",
    cuando: "Cada noche (con la jornada) y al pulsar",
    grupo: "jornada",
    cadaHoras: 24,
    docs: ["quiniela"],
    encargo: "quiniela",
    enlace: "/quiniela",
  },

  /* ---------- Cada mañana ---------- */
  {
    clave: "abp-acciones",
    nombre: "Lo mejor a balón parado de cada jornada",
    alimenta: "Laboratorio de ABP: acciones de Primera RFEF, LaLiga, Segunda, Premier y Champions con su resumen de YouTube",
    fuente: "Wyscout y YouTube",
    cuando: "Cada día a las 8:30",
    grupo: "diario",
    cadaHoras: 24,
    ficheros: ["public/data/abp-acciones.json"],
    enlace: "/laboratorio/abp",
  },

  /* ---------- Semanal / mensual ---------- */
  {
    clave: "wyscout",
    nombre: "Datos de Wyscout de la liga",
    alimenta: "Data análisis, el once por tres fuentes, Duelos, percentiles y las fichas individuales",
    fuente: "Wyscout",
    cuando: "Cada martes y al pulsar",
    grupo: "semanal",
    cadaHoras: 24 * 7,
    ficheros: ["public/data/analisis.json"],
    docs: ["wyscout-instantaneas"],
    encargo: "wyscout",
    enlace: "/data-analisis",
  },
  {
    clave: "elite",
    nombre: "Élite: Primera y Premier",
    alimenta: "«Área de mejora» de las fichas individuales: cara a cara con la élite",
    fuente: "Wyscout",
    cuando: "Una vez al mes (con la descarga del martes)",
    grupo: "semanal",
    cadaHoras: 24 * 31,
    ficheros: ["public/data/wys-elite"],
    enlace: "/individual",
  },

  /* ---------- Durante el día ---------- */
  {
    clave: "calendario",
    nombre: "Calendario del Castilla",
    alimenta: "La portada (próximo partido y semana), el boceto del microciclo y los desplazamientos",
    fuente: "BeSoccer",
    cuando: "Cada seis horas",
    grupo: "continuo",
    cadaHoras: 6,
    docs: ["castilla:calendario"],
    enlace: "/",
  },
  {
    clave: "video-jugadores",
    nombre: "Vídeo de ABP para los jugadores",
    alimenta: "El vídeo de la jornada en el informe de ABP y en el del partido",
    fuente: "Carpeta del ordenador del club",
    cuando: "En cuanto aparece en la carpeta",
    grupo: "continuo",
    docs: ["abp:video-jugadores"],
    enlace: "/abp-pizarra",
  },

  /* ---------- Cuando se pide ---------- */
  {
    clave: "carpeta",
    nombre: "Análisis visual del rival",
    alimenta: "Las láminas por jornada de ABP y Área del rival",
    fuente: "Carpeta de análisis del rival",
    cuando: "Al pulsar en Análisis del rival",
    grupo: "mano",
    prefijos: ["coding:rival:"],
    encargo: "carpeta",
    enlace: "/scout-rival-area",
  },
  {
    clave: "partido",
    nombre: "Análisis del partido",
    alimenta: "Faltas, robos, pérdidas, ABP y banda del último partido; vídeo del informe",
    fuente: "Hudl, Wyscout y vídeo",
    cuando: "Al pulsar, tras cada partido",
    grupo: "mano",
    prefijos: ["informe-clips:"],
    encargo: "partido",
    enlace: "/laboratorio/faltas",
  },
  {
    clave: "entreno",
    nombre: "Análisis de entrenamiento",
    alimenta: "Objetivos, clips y validación de la sesión",
    fuente: "Vídeo de la sesión",
    cuando: "Al pulsar",
    grupo: "mano",
    encargo: "entreno",
    enlace: "/analisis-entrenamiento",
  },
  {
    clave: "abp-ligas",
    nombre: "Goles a balón parado de las ligas",
    alimenta: "«Goles a balón parado» de Data análisis: la categoría frente a otras ligas",
    fuente: "Wyscout (equipos) y Opta",
    cuando: "A mano, con actualizar-abp-ligas.cmd en el ordenador del club",
    grupo: "mano",
    ficheros: ["public/data/abp-ligas.json"],
    enlace: "/data-analisis",
  },
  {
    clave: "escudos",
    nombre: "Escudos de la categoría",
    alimenta: "Los escudos de los dos grupos de Primera RFEF en toda la app",
    fuente: "BeSoccer",
    cuando: "Desde Escudos, cuando cambia algún club",
    grupo: "mano",
    docs: ["escudos:categoria"],
    enlace: "/laboratorio/escudos",
  },
];

export type EstadoFrescura = "al-dia" | "atrasada" | "sin-dato";

/** Cómo va de fresco: atrasada si pasa del doble de lo esperado (más 6 h de margen). */
export function frescura(a: Actualizacion, fecha: string | null, ahora: number): EstadoFrescura {
  if (!fecha) return "sin-dato";

  if (!a.cadaHoras) return "al-dia";

  const horas = (ahora - Date.parse(fecha)) / 3_600_000;

  return horas > a.cadaHoras * 2 + 6 ? "atrasada" : "al-dia";
}

/** Lo que devuelve /api/actualizaciones. */
export type FechaActualizacion = { clave: string; fecha: string | null };
