/**
 * NUESTRO VÍDEO DE ABP DE LA JORNADA (17/10/2026, lo pidió el usuario).
 *
 * El informe de ABP del microciclo ya no monta un vídeo con los clips: lleva
 * el vídeo completo que prepara el analista para los jugadores, que se deja en
 * `C:\Users\Usuario\Downloads\RMCF CASTILLA\ABP\VIDEO - JUGADORES` con un
 * nombre que diga de qué jornada es («J8», «JORNADA 8», «LIG.08»…) o contra
 * quién («vs CD Teruel»). El vigía lo recoge solo
 * (`scripts/abp/video-jugadores.cjs`): lo deja en ≤45 MB, lo sube al bucket y
 * lo apunta aquí. El informe lo enlaza (póster y botón, y la última página
 * del PDF). Si no hay vídeo de esa jornada, el informe no dice nada de vídeo.
 */

export const VIDEO_JUGADORES_KEY = "abp:video-jugadores";
export const VIDEO_JUGADORES_KIND = "abp";

export type VideoJugadores = {
  /** El nombre del fichero en la carpeta (también es la clave). */
  nombre: string;
  /** La jornada que dice el nombre, si la dice. */
  jornada: number | null;
  url: string;
  poster: string | null;
  segundos: number;
  mb: number;
  /** Para no volver a subir lo mismo: tamaño y fecha del fichero de origen. */
  origen: { tamano: number; mtime: number };
  ruta: string;
  posterRuta: string | null;
  subidoEn: string;
};

export type DocVideoJugadores = { videos: Record<string, VideoJugadores> };

export function normalizaVideosJugadores(x: unknown): DocVideoJugadores {
  const d = (x && typeof x === "object" ? x : {}) as Partial<DocVideoJugadores>;
  const videos: Record<string, VideoJugadores> = {};

  for (const [k, v] of Object.entries(d.videos ?? {})) if (v && typeof v.url === "string" && v.url) videos[k] = v;

  return { videos };
}

/** «J8», «J-08», «JORNADA 8», «LIG.08», «JOR 8» → 8. */
export function jornadaDeNombre(nombre: string): number | null {
  const limpio = nombre.replace(/\.[a-z0-9]+$/i, "");
  const m = limpio.match(/\b(?:J|JOR|JORN|JORNADA|LIG|LIGA)\s*[-_.]?\s*0*(\d{1,2})\b/i);

  return m ? Number(m[1]) : null;
}

const plano = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* Lo que no distingue a un equipo de otro. */
const VACIAS = new Set(["cd", "cf", "ud", "sd", "rcd", "ad", "fc", "club", "real", "de", "del", "la", "el", "b", "sad", "deportivo", "atletico", "union", "sociedad"]);

/**
 * El vídeo de la jornada: primero por el número de jornada del nombre; si
 * ninguno lo lleva, por el nombre del rival (alguna palabra que lo distinga).
 * Si hay dos, el más reciente.
 */
export function eligeVideoJugadores(doc: DocVideoJugadores, jornada: number | null, rival: string | null | undefined): VideoJugadores | null {
  const todos = Object.values(doc.videos).sort((a, b) => b.subidoEn.localeCompare(a.subidoEn));

  if (jornada) {
    const porJornada = todos.find((v) => v.jornada === jornada);

    if (porJornada) return porJornada;
  }

  const palabras = plano(rival ?? "")
    .split(" ")
    .filter((p) => p.length > 2 && !VACIAS.has(p));

  if (!palabras.length) return null;

  return todos.find((v) => v.jornada === null && palabras.some((p) => plano(v.nombre).split(" ").includes(p))) ?? null;
}
