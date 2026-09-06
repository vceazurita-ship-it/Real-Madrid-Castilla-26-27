import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
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

/**
 * Dónde dejar un vídeo que llega del navegador, listo para escribirlo.
 *
 * Es la salida del callejón sin salida del fichero abierto del ordenador: el
 * navegador lo lee del disco y el servidor no, así que se podía codificar
 * pero no cortar nada. Aquí el fichero **se copia** a la carpeta de partidos
 * —no sale a internet: el servidor es la misma máquina— y a partir de ahí es
 * un vídeo de la carpeta como cualquier otro, con sus cortes y su reproducción
 * por trozos.
 *
 * El nombre que manda el cliente no se usa tal cual: se le quita el camino y
 * todo lo que no sea letra, número o guion. Y no se pisa nada: si ya hay un
 * partido con ese nombre, el que llega se queda al lado con un número. Un
 * vídeo de cuatro gigas machacado por error no se recupera.
 *
 * Devuelve `null` si el nombre no acaba en extensión de vídeo.
 */
export async function destinoDeImportacion(nombre: string) {
  const base = carpetaDeVideos();

  const limpio = path.basename(String(nombre ?? "").replace(/\\/g, "/"));

  const extension = path.extname(limpio).toLowerCase();

  if (!EXTENSIONES_VIDEO.includes(extension)) return null;

  const cuerpo =
    limpio
      .slice(0, -extension.length)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9 ._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-. ]+|[-. ]+$/g, "")
      .slice(0, 80) || "partido";

  await mkdir(base, { recursive: true });

  let relativa = `${cuerpo}${extension}`;

  for (let vuelta = 2; existsSync(path.join(base, relativa)); vuelta += 1) {
    relativa = `${cuerpo}-${vuelta}${extension}`;
  }

  return { absoluta: path.join(base, relativa), relativa };
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
  /**
   * Si el fichero trae sonido.
   *
   * Importa para el vídeo unificado: los trozos se pegan sin recodificar y
   * eso exige que todos tengan los mismos flujos. Un partido exportado de una
   * mesa de edición viene a menudo **mudo**, y al pegarlo con la carátula —que
   * sí lleva silencio— salían un vídeo con la pista rota o un pegado que se
   * negaba. Cuando falta, se le pone un silencio del mismo largo.
   */
  audio: boolean;
};

/** Lo que hace falta saber del vídeo antes de cortarlo o de montar la portada. */
export async function sondeaVideo(entrada: string): Promise<DatosVideo> {
  const { salida } = await ejecuta(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height,avg_frame_rate:format=duration",
    "-of",
    "json",
    entrada,
  ]);

  const leido = JSON.parse(salida || "{}");

  const flujos: { codec_type?: string }[] = Array.isArray(leido?.streams)
    ? leido.streams
    : [];

  const flujo =
    (flujos.find((uno) => uno.codec_type === "video") as Record<
      string,
      unknown
    >) ?? {};

  const audio = flujos.some((uno) => uno.codec_type === "audio");

  /* `avg_frame_rate` viene como fracción ("25/1", "30000/1001"). */
  const [arriba, abajo] = String(flujo.avg_frame_rate ?? "25/1").split("/");

  const fps = Number(abajo) > 0 ? Number(arriba) / Number(abajo) : 25;

  return {
    duracionMs: Math.round(Number(leido?.format?.duration ?? 0) * 1000),
    ancho: Number(flujo.width) || 1280,
    alto: Number(flujo.height) || 720,
    fps: Number.isFinite(fps) && fps > 0 ? fps : 25,
    audio,
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
/**
 * Los argumentos que obligan a un fichero a caber en tantos megas.
 *
 * Es una **rejilla de caudal** (`-maxrate`/`-bufsize`), no un caudal fijo: el
 * `-crf 20` sigue mandando en lo que se ve, y esto sólo pone el techo por el
 * que el fichero no puede pasar. Así un corte tranquilo pesa lo que tenga que
 * pesar y sólo se aprieta el que se pasaría.
 *
 * El `bufsize` es de dos segundos de caudal: con uno, una entrada de área
 * llena de movimiento se ve a bloques; con más, el pico se come el presupuesto
 * y el final del corte sale peor que el principio.
 *
 * Se le descuentan el sonido (160 kb/s) y un 6 % de contenedor —el índice del
 * MP4 y las cabeceras de cada muestra no son gratis— porque un tope que se
 * pasa por poco no sirve para lo que se pidió: que el fichero quepa.
 */
function rejillaDeCaudal(topeMegas: number, segundos: number): string[] {
  const bytes = Math.max(0, topeMegas) * 1_000_000;

  if (bytes <= 0 || segundos <= 0) return [];

  const caudal = Math.max(
    400_000,
    Math.round((bytes * 8 * 0.94) / segundos - 160_000),
  );

  return [
    "-maxrate",
    `${Math.round(caudal / 1000)}k`,
    "-bufsize",
    `${Math.round((caudal * 2) / 1000)}k`,
  ];
}

export async function cortaClip(opciones: {
  entrada: string;
  inicioMs: number;
  finMs: number;
  modo: ModoCorte;
  destino: string;
  /** Lo que puede pesar el corte, en megas. `0` o ausente es sin tope. */
  topeMegas?: number;
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

  /*
  | Copiando no hay nada que apretar: los bytes son los del partido. Un tope
  | de peso obliga a recodificar, así que `rapido` con tope pasa a `preciso`
  | —y eso lo decide quien llama, no aquí: aquí sólo se deja de copiar.
  */
  const copia = opciones.modo === "rapido" && !(opciones.topeMegas ?? 0);

  const codificacion = copia
    ? ["-c", "copy", "-avoid_negative_ts", "make_zero"]
    : [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        ...rejillaDeCaudal(opciones.topeMegas ?? 0, duracion / 1000),
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
  /** Duración del silencio que hay que inventar, en ms. `0` si ya trae sonido. */
  silencioMs?: number;
  /** Techo de peso del fichero final y lo que dura, para la rejilla de caudal. */
  topeMegas?: number;
  segundosDelTope?: number;
}) {
  /*
   * El silencio es una entrada más, y entonces hay que mapear a mano: sin
   * `-map`, ffmpeg elige el vídeo de una entrada y el audio de la otra sólo
   * por suerte, y con dos entradas de vídeo se equivoca.
   */
  const silencio = opciones.silencioMs && opciones.silencioMs > 0;

  const extra = silencio
    ? [
        "-f",
        "lavfi",
        "-t",
        segundos(opciones.silencioMs ?? 0),
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=48000",
      ]
    : [];

  const mapas = silencio ? ["-map", "0:v:0", "-map", "1:a:0"] : [];

  await ejecuta(FFMPEG, [
    "-hide_banner",
    "-loglevel",
    "error",
    ...opciones.entradaArgs,
    ...extra,
    ...mapas,
    "-vf",
    `scale=${opciones.ancho}:${opciones.alto}:force_original_aspect_ratio=decrease,pad=${opciones.ancho}:${opciones.alto}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${opciones.fps.toFixed(3)}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    ...rejillaDeCaudal(opciones.topeMegas ?? 0, opciones.segundosDelTope ?? 0),
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
  /** Si la fuente de ESTE trozo trae sonido. Sin él, se le pone silencio. */
  audio?: boolean;
  /** Lo que puede pesar el fichero final del que este trozo forma parte. */
  topeMegas?: number;
  /** Y lo que dura ese fichero final, que es entre lo que se reparte. */
  segundosDelTope?: number;
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
    silencioMs: opciones.audio === false ? duracion : 0,
    topeMegas: opciones.topeMegas,
    segundosDelTope: opciones.segundosDelTope,
  });
}

/**
 * La portada como trozo de vídeo.
 *
 * La imagen la pinta el navegador con la misma plantilla que la portada del
 * jugador rival (`lib/rivals/portada.ts`) y llega aquí ya escrita a disco por
 * `guardaImagen`. Se le pega un silencio porque un trozo sin pista de sonido
 * rompe el pegado con los clips, que sí la tienen.
 */
export async function imagenComoVideo(opciones: {
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

/* ------------------------------------------------------------------ */
/*  LAS PIZARRAS, DENTRO DEL VÍDEO                                     */
/* ------------------------------------------------------------------ */

/** Una pizarra quemada: el fotograma parado con lo pintado encima. */
export type ParadaPedida = {
  /** La ruta del fotograma ya compuesto (vídeo + dibujo), en disco. */
  imagen: string;
  /** Dónde para, contado desde el principio del clip. */
  enMs: number;
  /** Cuánto se queda parado. */
  duracionMs: number;
};

/**
 * Corta un clip parándose en cada pizarra.
 *
 * La telestración no se puede «pegar» sobre el vídeo que corre sin recodificar
 * fotograma a fotograma, y hacerlo así sería lento y frágil —el difuminado, la
 * lupa y el jugador recortado necesitan los píxeles de debajo—. Aquí se hace
 * lo que hace la televisión, que además es lo que la pantalla ya enseña: el
 * vídeo **se detiene** en el instante de la pizarra, se ve el dibujo el rato
 * que dure y sigue limpio.
 *
 * El fotograma parado lo compone el navegador (`componeEscena`) a la
 * resolución del vídeo, así que sale exactamente lo que el analista vio al
 * pintarlo. Cómo llega —enlace del bucket o `data:` URL— lo resuelve
 * `guardaImagen`.
 *
 * Con paradas **siempre se recodifica**: los trozos tienen que compartir forma
 * para poder pegarse, así que el modo `rapido` no se aplica.
 */
export async function cortaClipConParadas(opciones: {
  entrada: string;
  inicioMs: number;
  finMs: number;
  ancho: number;
  alto: number;
  fps: number;
  audio: boolean;
  paradas: ParadaPedida[];
  /** Carpeta de trabajo y prefijo de los trozos, para no pisarse entre clips. */
  carpeta: string;
  prefijo: string;
  destino: string;
  /** Lo que puede pesar el corte ya montado, en megas. */
  topeMegas?: number;
}) {
  const duracion = Math.max(0, opciones.finMs - opciones.inicioMs);

  if (duracion <= 0) throw new Error("El clip no tiene duración.");

  /* Sólo las que caen dentro, y en orden: una pizarra de otro momento del
     partido no pinta nada aquí. */
  const paradas = opciones.paradas
    .filter((parada) => parada.enMs >= 0 && parada.enMs <= duracion)
    .sort((a, b) => a.enMs - b.enMs);

  /* Lo que suman las pizarras: cuentan para el peso del fichero final. */
  const paradasMs = paradas.reduce(
    (suma, parada) => suma + Math.max(500, parada.duracionMs),
    0,
  );

  const trozos: string[] = [];

  let desde = 0;
  let numero = 0;

  const nombra = (que: string) =>
    path.join(
      opciones.carpeta,
      `${opciones.prefijo}-${String(++numero).padStart(3, "0")}-${que}.mp4`,
    );

  const corta = async (a: number, b: number) => {
    /* Menos de un fotograma no es un trozo: ffmpeg saca un fichero vacío y el
       pegado se cae con él. */
    if (b - a < 1000 / Math.max(1, opciones.fps)) return;

    trozos.push(
      await segmentoNormalizado({
        entrada: opciones.entrada,
        inicioMs: opciones.inicioMs + a,
        finMs: opciones.inicioMs + b,
        ancho: opciones.ancho,
        alto: opciones.alto,
        fps: opciones.fps,
        audio: opciones.audio,
        /* El tope es del fichero entero, y cada trozo es un pedazo de él: se
           aplica el mismo caudal a todos, que es lo que lo hace cumplir. */
        topeMegas: opciones.topeMegas,
        segundosDelTope: (duracion + paradasMs) / 1000,
        destino: nombra("video"),
      }),
    );
  };

  for (const parada of paradas) {
    await corta(desde, parada.enMs);

    trozos.push(
      await imagenComoVideo({
        imagen: parada.imagen,
        duracionMs: Math.max(500, parada.duracionMs),
        ancho: opciones.ancho,
        alto: opciones.alto,
        fps: opciones.fps,
        destino: nombra("pizarra"),
      }),
    );

    desde = parada.enMs;
  }

  await corta(desde, duracion);

  if (trozos.length === 0) throw new Error("El clip se ha quedado sin vídeo.");

  if (trozos.length === 1) {
    await copyFile(trozos[0], opciones.destino);

    return opciones.destino;
  }

  return pegaVideos(trozos, opciones.destino);
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
 * La carpeta donde se montan los cortes intermedios.
 *
 * No hay un `enCarpetaTemporal(trabajo)` que la borre sola al salir: el
 * resultado se devuelve **por trozos**, así que el fichero tiene que seguir
 * ahí después de que la ruta haya terminado. La borra `respuestaDeFichero`
 * cuando el flujo se cierra, y quien llame se encarga de limpiarla si algo
 * revienta antes de llegar a devolver nada. Un partido entero son cientos de
 * ficheros: dejarlos por el disco del analista sería llenárselo en una semana.
 */
export async function creaCarpetaTemporal() {
  return mkdtemp(path.join(tmpdir(), "rmcf-coding-"));
}

export async function borraCarpetaTemporal(carpeta: string) {
  await rm(carpeta, { recursive: true, force: true }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/*  LAS IMÁGENES QUE VIENEN DEL NAVEGADOR                              */
/* ------------------------------------------------------------------ */

/*
| ffmpeg abre la imagen **por su nombre**: un JPEG llamado `.png` no lo lee.
| Por eso la extensión no la elige quien llama, la pone el tipo real.
*/
const EXTENSION_DE_IMAGEN: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Techo de lo que se descarga: una carátula son cientos de kilobytes. */
const MAX_IMAGEN = 32 * 1024 * 1024;

/**
 * La carátula o una pizarra, escrita a disco para dársela a ffmpeg.
 *
 * Llega de dos formas, y las dos hacen falta:
 *
 * - **`data:` URL**, como siempre: es lo cómodo, y basta cuando el servidor es
 *   esta misma máquina.
 * - **Enlace del bucket**, que es lo único que sobrevive a un despliegue con
 *   funciones: allí el cuerpo de una petición no puede pasar de 4,5 MB, y una
 *   carátula más quince fotogramas parados se plantan muy por encima —era el
 *   413 de la exportación—. El navegador las sube sueltas por
 *   `/api/coding/imagenes` y aquí sólo viaja el enlace. Ver
 *   `lib/coding/imagenes.ts`.
 *
 * Sólo se descarga **del bucket del proyecto**: la URL la manda el cliente, y
 * un servidor que se trae cualquier dirección que le pidan es una puerta
 * abierta a la red interna del despliegue.
 */
export async function guardaImagen(opciones: {
  /** `data:` URL, o enlace http(s) del bucket. */
  fuente: string;
  carpeta: string;
  /** Nombre sin extensión: la pone el tipo real de la imagen. */
  nombre: string;
}) {
  const { fuente, carpeta, nombre } = opciones;

  const destino = (tipo: string, respaldo: string) =>
    path.join(carpeta, `${nombre}${EXTENSION_DE_IMAGEN[tipo] ?? respaldo}`);

  if (fuente.startsWith("data:")) {
    const coma = fuente.indexOf(",");

    if (coma < 0) throw new Error("La imagen no es válida.");

    const puntoYComa = fuente.indexOf(";");

    const tipo = fuente
      .slice(5, puntoYComa >= 0 && puntoYComa < coma ? puntoYComa : coma)
      .trim()
      .toLowerCase();

    const archivo = destino(tipo, ".png");

    await writeFile(archivo, Buffer.from(fuente.slice(coma + 1), "base64"));

    return archivo;
  }

  if (!esDelBucket(fuente)) {
    throw new Error(
      "La imagen no viene de un sitio que el servidor pueda leer.",
    );
  }

  const respuesta = await fetch(fuente);

  if (!respuesta.ok) {
    throw new Error(`No se ha podido leer la imagen (${respuesta.status}).`);
  }

  const bytes = Buffer.from(await respuesta.arrayBuffer());

  if (bytes.byteLength > MAX_IMAGEN) throw new Error("La imagen pesa demasiado.");

  const tipo = (respuesta.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  const archivo = destino(
    tipo,
    path.extname(new URL(fuente).pathname).toLowerCase() || ".png",
  );

  await writeFile(archivo, bytes);

  return archivo;
}

/** ¿La URL es del bucket del proyecto? Es lo único que el servidor se trae. */
export function esDelBucket(url: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabase) return false;

  try {
    return new URL(url).origin === new URL(supabase).origin;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  DEVOLVER EL FICHERO TERMINADO                                      */
/* ------------------------------------------------------------------ */

/**
 * El resultado, servido por trozos, y la carpeta borrada al terminar.
 *
 * Un vídeo unificado son decenas de megas: leído entero a memoria se lleva por
 * delante al servidor, y un despliegue con funciones corta en 4,5 MB **toda
 * respuesta que no vaya por trozos**. Así que se lee con un flujo, y la
 * carpeta de trabajo se borra cuando el último trozo ha salido —no antes, o el
 * navegador se descargaría un fichero a medias—.
 */
export function respuestaDeFichero(opciones: {
  archivo: string;
  /** Se borra al cerrarse el flujo, sea por terminar o por cancelarse. */
  carpeta: string;
  /** Nombre con el que se descarga, extensión incluida. */
  nombre: string;
  tipo: string;
}) {
  const lector = createReadStream(opciones.archivo);

  /* `close` salta tanto al acabar como al cancelar la descarga. */
  lector.on("close", () => {
    void borraCarpetaTemporal(opciones.carpeta);
  });

  return new Response(Readable.toWeb(lector) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": opciones.tipo,
      "Content-Disposition": `attachment; filename="${opciones.nombre}"`,
      /* Sin `Content-Length` a propósito: es lo que la mantiene por trozos. */
      "Cache-Control": "no-store",
    },
  });
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
