import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import ffmpegRuta from "ffmpeg-static";
import ffprobe from "ffprobe-static";

/**
 * El motor de corte: ffmpeg en el servidor.
 *
 * Es lo que separa este módulo de una lista de marcas de tiempo. Un partido
 * pesa gigas, así que **nunca se copia el vídeo entero**: ffmpeg abre la
 * fuente —un fichero de la carpeta de partidos o una URL con soporte de
 * rangos, como el bucket de Supabase— y lee sólo los segundos del clip.
 *
 * Los binarios vienen de `ffmpeg-static` y `ffprobe-static`, no del sistema:
 * en esta máquina no hay ffmpeg instalado y pedirle al cuerpo técnico que lo
 * instale sería convertir una función de la app en un manual de terminal.
 *
 * Este fichero es **sólo de servidor**: importa `node:child_process`, así que
 * no puede acabar en un componente de cliente.
 */

const FFMPEG = ffmpegRuta as unknown as string;
const FFPROBE = ffprobe.path;

/** Techo de cada llamada a ffmpeg. Un corte de diez segundos no tarda esto. */
const PLAZO_MS = 10 * 60 * 1000;

export type ModoCorte = "preciso" | "rapido";

export type FuenteServidor =
  | { tipo: "url"; url: string }
  | { tipo: "archivo"; ruta: string };

/* ------------------------------------------------------------------ */
/*  LA CARPETA DE PARTIDOS                                             */
/* ------------------------------------------------------------------ */

/**
 * Dónde están los vídeos de partido en esta máquina.
 *
 * Se configura con `CODING_VIDEOS_DIR`; si no está, se usa `videos/` en la
 * raíz del proyecto. No se sirve desde `public/` a propósito: ahí dentro
 * cualquiera con la URL se descargaría el partido entero.
 */
export function carpetaDeVideos() {
  const configurada = process.env.CODING_VIDEOS_DIR;

  return configurada && configurada.trim()
    ? path.resolve(configurada.trim())
    : path.resolve(process.cwd(), "videos");
}

export const EXTENSIONES_VIDEO = [
  ".mp4",
  ".mov",
  ".m4v",
  ".mkv",
  ".avi",
  ".mpg",
  ".mpeg",
  ".ts",
  ".webm",
];

/**
 * Convierte la ruta que manda el navegador en una ruta real de disco.
 *
 * Devuelve `null` si se sale de la carpeta de partidos. El cliente manda
 * texto, así que un `../../.env` sería una forma perfectamente cómoda de
 * leerse las claves del servidor.
 */
export function resuelveRutaDeVideo(relativa: string) {
  const base = carpetaDeVideos();

  const limpia = String(relativa ?? "").replace(/\\/g, "/");

  if (!limpia || limpia.includes("..")) return null;

  const absoluta = path.resolve(base, limpia);

  const dentro =
    absoluta === base || absoluta.startsWith(base + path.sep);

  if (!dentro) return null;

  if (!EXTENSIONES_VIDEO.includes(path.extname(absoluta).toLowerCase())) {
    return null;
  }

  return absoluta;
}

/** Lo que se le pasa a ffmpeg como entrada: una ruta de disco o una URL. */
export function entradaDeFuente(fuente: FuenteServidor) {
  if (fuente.tipo === "url") {
    /* Sólo http(s): `file:` o `concat:` desde el cliente sería dar acceso al
       disco del servidor con otro nombre. */
    if (!/^https?:\/\//i.test(fuente.url)) return null;

    return fuente.url;
  }

  const absoluta = resuelveRutaDeVideo(fuente.ruta);

  if (!absoluta || !existsSync(absoluta)) return null;

  return absoluta;
}

/* ------------------------------------------------------------------ */
/*  EJECUTAR                                                           */
/* ------------------------------------------------------------------ */

function ejecuta(binario: string, argumentos: string[]) {
  return new Promise<{ salida: string; error: string }>((listo, falla) => {
    const proceso = spawn(binario, argumentos, { windowsHide: true });

    let salida = "";
    let error = "";

    /* ffmpeg escribe su informe entero por stderr, también cuando va bien. */
    proceso.stdout.on("data", (trozo) => {
      salida += String(trozo);
    });

    proceso.stderr.on("data", (trozo) => {
      error += String(trozo);
    });

    const reloj = setTimeout(() => {
      proceso.kill("SIGKILL");
      falla(new Error("ffmpeg ha tardado demasiado y se ha cancelado."));
    }, PLAZO_MS);

    proceso.on("error", (fallo) => {
      clearTimeout(reloj);
      falla(fallo);
    });

    proceso.on("close", (codigo) => {
      clearTimeout(reloj);

      if (codigo === 0) return listo({ salida, error });

      /* Del informe de ffmpeg sólo interesan las últimas líneas: el resto es
         la configuración con la que se compiló. */
      const ultimas = error.trim().split("\n").slice(-4).join(" · ");

      falla(new Error(ultimas || `ffmpeg ha terminado con el código ${codigo}`));
    });
  });
}

/* ------------------------------------------------------------------ */
/*  SONDEO                                                             */
/* ------------------------------------------------------------------ */

export type DatosVideo = {
  duracionMs: number;
  ancho: number;
  alto: number;
  fps: number;
};

/** Lo que hace falta saber del vídeo antes de cortarlo o de montar la portada. */
export async function sondeaVideo(entrada: string): Promise<DatosVideo> {
  const { salida } = await ejecuta(FFPROBE, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,avg_frame_rate:format=duration",
    "-of",
    "json",
    entrada,
  ]);

  const leido = JSON.parse(salida || "{}");

  const flujo = leido?.streams?.[0] ?? {};

  /* `avg_frame_rate` viene como fracción ("25/1", "30000/1001"). */
  const [arriba, abajo] = String(flujo.avg_frame_rate ?? "25/1").split("/");

  const fps = Number(abajo) > 0 ? Number(arriba) / Number(abajo) : 25;

  return {
    duracionMs: Math.round(Number(leido?.format?.duration ?? 0) * 1000),
    ancho: Number(flujo.width) || 1280,
    alto: Number(flujo.height) || 720,
    fps: Number.isFinite(fps) && fps > 0 ? fps : 25,
  };
}

/* ------------------------------------------------------------------ */
/*  CORTAR                                                             */
/* ------------------------------------------------------------------ */

const segundos = (ms: number) => (Math.max(0, ms) / 1000).toFixed(3);

/**
 * Corta un trozo del vídeo.
 *
 * Dos modos, y la diferencia importa:
 *
 * - **`preciso`** vuelve a codificar y corta en el fotograma exacto que marcó
 *   el analista. Es el que se usa por defecto, porque un clip de acción que
 *   empieza medio segundo tarde ya no enseña la acción.
 * - **`rapido`** copia los flujos sin tocarlos —sale al instante y sin pérdida
 *   de calidad—, pero sólo puede empezar en un fotograma clave: según cómo
 *   esté comprimido el partido, el corte puede irse hasta un par de segundos.
 */
export async function cortaClip(opciones: {
  entrada: string;
  inicioMs: number;
  finMs: number;
  modo: ModoCorte;
  destino: string;
}) {
  const duracion = Math.max(0, opciones.finMs - opciones.inicioMs);

  if (duracion <= 0) throw new Error("El clip no tiene duración.");

  const comunes = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    segundos(opciones.inicioMs),
    "-i",
    opciones.entrada,
    "-t",
    segundos(duracion),
  ];

  const codificacion =
    opciones.modo === "rapido"
      ? ["-c", "copy", "-avoid_negative_ts", "make_zero"]
      : [
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "160k",
        ];

  await ejecuta(FFMPEG, [
    ...comunes,
    ...codificacion,
    "-movflags",
    "+faststart",
    "-y",
    opciones.destino,
  ]);

  return opciones.destino;
}

/* ------------------------------------------------------------------ */
/*  VÍDEO UNIFICADO                                                    */
/* ------------------------------------------------------------------ */

/**
 * Deja un trozo con la misma forma que todos los demás.
 *
 * Para pegar vídeos sin volver a codificarlos, todos tienen que compartir
 * medida, fotogramas y sonido. Los clips salen del mismo partido, así que ya
 * coinciden; la portada es una imagen fija y el sonido no existe, y ésa es
 * justo la pieza que rompería el pegado.
 */
async function normaliza(opciones: {
  entradaArgs: string[];
  ancho: number;
  alto: number;
  fps: number;
  destino: string;
}) {
  await ejecuta(FFMPEG, [
    "-hide_banner",
    "-loglevel",
    "error",
    ...opciones.entradaArgs,
    "-vf",
    `scale=${opciones.ancho}:${opciones.alto}:force_original_aspect_ratio=decrease,pad=${opciones.ancho}:${opciones.alto}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${opciones.fps.toFixed(3)}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-shortest",
    "-y",
    opciones.destino,
  ]);

  return opciones.destino;
}

/** Un trozo de vídeo ya normalizado, listo para pegar. */
export async function segmentoNormalizado(opciones: {
  entrada: string;
  inicioMs: number;
  finMs: number;
  ancho: number;
  alto: number;
  fps: number;
  destino: string;
}) {
  const duracion = Math.max(0, opciones.finMs - opciones.inicioMs);

  if (duracion <= 0) throw new Error("El clip no tiene duración.");

  return normaliza({
    entradaArgs: [
      "-ss",
      segundos(opciones.inicioMs),
      "-i",
      opciones.entrada,
      "-t",
      segundos(duracion),
    ],
    ancho: opciones.ancho,
    alto: opciones.alto,
    fps: opciones.fps,
    destino: opciones.destino,
  });
}

/**
 * La portada como trozo de vídeo.
 *
 * La imagen la pinta el navegador con la misma plantilla que la portada del
 * jugador rival (`lib/rivals/portada.ts`) y llega aquí como PNG. Se le pega un
 * silencio porque un trozo sin pista de sonido rompe el pegado con los clips,
 * que sí la tienen.
 */
export async function portadaComoVideo(opciones: {
  imagen: string;
  duracionMs: number;
  ancho: number;
  alto: number;
  fps: number;
  destino: string;
}) {
  return normaliza({
    entradaArgs: [
      "-loop",
      "1",
      "-t",
      segundos(opciones.duracionMs),
      "-i",
      opciones.imagen,
      "-f",
      "lavfi",
      "-t",
      segundos(opciones.duracionMs),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
    ],
    ancho: opciones.ancho,
    alto: opciones.alto,
    fps: opciones.fps,
    destino: opciones.destino,
  });
}

/** Pega en uno todos los trozos, que ya vienen con la misma forma. */
export async function pegaVideos(archivos: string[], destino: string) {
  if (archivos.length === 0) throw new Error("No hay nada que pegar.");

  const lista = path.join(path.dirname(destino), "lista.txt");

  /* El demuxer `concat` pide rutas entrecomilladas y con las comillas simples
     escapadas; en Windows además hay que darle barras normales. */
  const cuerpo = archivos
    .map((archivo) => `file '${archivo.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
    .join("\n");

  await writeFile(lista, cuerpo, "utf8");

  await ejecuta(FFMPEG, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    lista,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-y",
    destino,
  ]);

  return destino;
}

/* ------------------------------------------------------------------ */
/*  ESPACIO DE TRABAJO                                                 */
/* ------------------------------------------------------------------ */

/**
 * Una carpeta temporal que se borra sola.
 *
 * Los cortes intermedios de un partido entero pueden ser cientos de ficheros;
 * dejarlos por el disco del analista sería llenárselo en una semana.
 */
export async function enCarpetaTemporal<T>(
  trabajo: (carpeta: string) => Promise<T>,
): Promise<T> {
  const carpeta = await mkdtemp(path.join(tmpdir(), "rmcf-coding-"));

  try {
    return await trabajo(carpeta);
  } finally {
    await rm(carpeta, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** El PNG que manda el navegador, escrito a disco para dárselo a ffmpeg. */
export async function guardaDataUrl(dataUrl: string, destino: string) {
  const coma = dataUrl.indexOf(",");

  if (coma < 0) throw new Error("La portada no es una imagen válida.");

  await writeFile(destino, Buffer.from(dataUrl.slice(coma + 1), "base64"));

  return destino;
}

export async function leeBytes(archivo: string) {
  const contenido = await readFile(archivo);

  return new Uint8Array(
    contenido.buffer.slice(
      contenido.byteOffset,
      contenido.byteOffset + contenido.byteLength,
    ),
  ) as Uint8Array<ArrayBuffer>;
}

/** ¿Están los binarios donde deberían? Lo mira la pantalla antes de ofrecer. */
export function hayFfmpeg() {
  return Boolean(FFMPEG && existsSync(FFMPEG) && FFPROBE && existsSync(FFPROBE));
}
