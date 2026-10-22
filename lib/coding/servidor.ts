import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { lookup } from "node:dns/promises";
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

/**
 * ¿Es una dirección de la red de dentro?
 *
 * Todo lo que no sea internet público: el bucle local, los rangos privados de
 * la RFC 1918, la 169.254 —donde vive el servicio de metadatos de los
 * proveedores, que es el objetivo clásico— y sus equivalentes en IPv6.
 */
function esDeCasa(ip: string) {
  const limpio = ip.replace(/^\[|\]$/g, "").replace(/^::ffff:/i, "");

  const trozos = limpio.split(".");

  if (trozos.length === 4 && trozos.every((uno) => /^\d{1,3}$/.test(uno))) {
    const [a, b] = trozos.map(Number);

    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;

    return false;
  }

  const seis = limpio.toLowerCase();

  if (seis === "::" || seis === "::1") return true;

  /* fc00::/7 (privadas) y fe80::/10 (enlace local). */
  return /^f[cd]/.test(seis) || /^fe[89ab]/.test(seis);
}

/**
 * COMPRUEBA QUE UNA URL DEL CLIENTE APUNTA FUERA, NO A LA RED DEL DESPLIEGUE.
 *
 * Aquí entra una URL que escribe quien usa la app —«Desde un enlace» del
 * selector de fuente— y va derecha a ffmpeg, que se la descarga. Sin esta
 * comprobación, una petición con
 * `fuente: { tipo: "url", url: "http://169.254.169.254/…" }` hacía que el
 * servidor se asomara a su propia red interna y devolviera por el informe de
 * ffmpeg lo que hubiera encontrado. `guardaImagen` ya se defendía de esto con
 * `esDelBucket`; la entrada de vídeo no, y no puede limitarse al bucket porque
 * pegar un enlace de un proveedor es una función de verdad.
 *
 * Se mira el nombre **y a dónde resuelve**: sin lo segundo basta un dominio
 * propio apuntando a 127.0.0.1 para saltársela.
 */
export async function urlDeFueraDeCasa(url: string) {
  let sitio: URL;

  try {
    sitio = new URL(url);
  } catch {
    return false;
  }

  if (sitio.protocol !== "http:" && sitio.protocol !== "https:") return false;

  /* Usuario y contraseña en la URL: no hace falta para un vídeo y es la forma
     de colar credenciales de dentro. */
  if (sitio.username || sitio.password) return false;

  const nombre = sitio.hostname.toLowerCase();

  if (
    nombre === "localhost" ||
    nombre.endsWith(".localhost") ||
    nombre.endsWith(".internal") ||
    nombre.endsWith(".local") ||
    /* Sin punto sólo puede ser una máquina de la red de dentro. */
    !nombre.includes(".")
  ) {
    return false;
  }

  if (esDeCasa(nombre)) return false;

  try {
    const sitios = await lookup(nombre, { all: true });

    if (sitios.length === 0) return false;

    return sitios.every((uno) => !esDeCasa(uno.address));
  } catch {
    /* Si no resuelve, ffmpeg tampoco va a poder: se corta aquí. */
    return false;
  }
}

/** Lo que se le pasa a ffmpeg como entrada: una ruta de disco o una URL. */
export function entradaDeFuente(fuente: FuenteServidor) {
  if (fuente.tipo === "url") {
    /* Sólo http(s): `file:` o `concat:` desde el cliente sería dar acceso al
       disco del servidor con otro nombre. Que apunte de verdad a fuera lo
       comprueba `urlDeFueraDeCasa`, que necesita esperar al DNS. */
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

function ejecuta(binario: string, argumentos: string[], cwd?: string) {
  return new Promise<{ salida: string; error: string }>((listo, falla) => {
    const proceso = spawn(binario, argumentos, { windowsHide: true, cwd });

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

/* ------------------------------------------------------------------ */
/*  EL RÓTULO DE CADA CORTE                                            */
/* ------------------------------------------------------------------ */

/**
 * Lo mismo que `RotuloClip` del navegador (`lib/coding/rotulo.ts`), más el
 * rótulo ya pintado por él (`imagenDeRotulo`): un PNG de la caja a 1080 de
 * alto, en `data:` URL.
 */
export type RotuloServidor = {
  titulo: string;
  detalle: string;
  color: string;
  imagen?: string;
};

/**
 * El rótulo listo para ffmpeg.
 *
 * Con `imagen` es el PNG del navegador, que se pone encima con `overlay`;
 * sin ella, el respaldo con `drawtext` en `filtro`.
 */
export type RotuloListo = {
  carpeta: string;
  filtro?: string;
  imagen?: string;
};

/** Los mismos tiempos que el rótulo del navegador. */
const ROTULO_S = 3.5;
const ENTRADA_S = 0.25;
const SALIDA_S = 0.2;
const DESLIZA_U = 3;

const LETRA_ROTULO = path.join(
  process.cwd(),
  "public",
  "fuentes",
  "BarlowCondensed-Bold.ttf",
);

/** Igual que `baseDeRotulo` del navegador: en vertical manda el ancho. */
const baseDeRotulo = (ancho: number, alto: number) => Math.min(alto, ancho * 1.25);

/**
 * Prepara el rótulo del corte.
 *
 * Lo normal es que llegue **pintado**: el navegador dibuja la caja una vez con
 * la misma función que usan sus dos motores, y aquí sólo se escribe a disco y
 * se pone encima. Así el rótulo de ffmpeg es el mismo —una sola pieza, el
 * escudo, el filete oro— y no un parecido.
 *
 * Si no llega la imagen (una petición vieja, o más cortes de los que caben en
 * la petición), queda el respaldo con `drawtext`: **un solo fondo** del ancho
 * calculado sobre la letra, el filete y las dos líneas. El texto va en un
 * fichero (`textfile`) y no dentro del filtro: un nombre con dos puntos, una
 * comilla o un «%» rompía la sintaxis de ffmpeg.
 *
 * Devuelve `null` si no hay ni imagen ni letra: el corte sale igual, sin
 * rótulo.
 */
export async function preparaRotulo(opciones: {
  rotulo: RotuloServidor;
  carpeta: string;
  prefijo: string;
  ancho: number;
  alto: number;
}): Promise<RotuloListo | null> {
  const titulo = String(opciones.rotulo?.titulo ?? "").trim().toUpperCase();
  const detalle = String(opciones.rotulo?.detalle ?? "").trim();

  if (!titulo) return null;

  if (
    typeof opciones.rotulo.imagen === "string" &&
    opciones.rotulo.imagen.startsWith("data:image/png")
  ) {
    try {
      const fichero = await guardaImagen({
        fuente: opciones.rotulo.imagen,
        carpeta: opciones.carpeta,
        nombre: opciones.prefijo,
      });

      return { carpeta: opciones.carpeta, imagen: path.basename(fichero) };
    } catch (error) {
      console.warn("[coding] el rótulo pintado no se ha podido leer", error);
    }
  }

  if (!existsSync(LETRA_ROTULO)) return null;

  const letra = path.join(opciones.carpeta, "rotulo.ttf");

  if (!existsSync(letra)) await copyFile(LETRA_ROTULO, letra);

  await writeFile(
    path.join(opciones.carpeta, `${opciones.prefijo}-titulo.txt`),
    titulo,
    "utf8",
  );

  if (detalle) {
    await writeFile(
      path.join(opciones.carpeta, `${opciones.prefijo}-detalle.txt`),
      detalle,
      "utf8",
    );
  }

  const u = baseDeRotulo(opciones.ancho, opciones.alto) / 100;
  const margen = Math.round(4.2 * u);
  const filete = Math.max(3, Math.round(0.8 * u));
  const relleno = Math.round(1.6 * u);
  const altoTitulo = Math.round(5.4 * u);
  const altoDetalle = Math.round(3.4 * u);

  const altoCaja = Math.round(
    relleno * 2 + altoTitulo + (detalle ? altoDetalle + 0.5 * u : 0),
  );

  /*
  | El ancho de la caja, medido sobre la letra: la Barlow Condensed avanza
  | ~0,46 em en mayúsculas negritas y ~0,40 em en el detalle. Es el respaldo:
  | si se queda corto o largo por unos píxeles, sigue siendo una sola pieza.
  */
  const anchoTexto = Math.max(
    titulo.length * altoTitulo * 0.46,
    detalle.length * altoDetalle * 0.4,
  );
  const anchoCaja = Math.round(filete + relleno * 2.4 + anchoTexto);

  const arriba = opciones.alto - margen - altoCaja;
  const x = margen + filete + relleno;

  const cuando = `enable='lt(t,${ROTULO_S})'`;
  const alfa = `alpha='if(lt(t,${ENTRADA_S}),t/${ENTRADA_S},if(gt(t,${ROTULO_S - SALIDA_S}),(${ROTULO_S}-t)/${SALIDA_S},1))'`;

  const partes = [
    `drawbox=x=${margen}:y=${arriba}:w=${anchoCaja}:h=${altoCaja}:color=0x0B0F14@0.86:t=fill:${cuando}`,
    `drawbox=x=${margen}:y=${arriba}:w=${filete}:h=${altoCaja}:color=0xC8A96B:t=fill:${cuando}`,
    `drawtext=fontfile=rotulo.ttf:textfile=${opciones.prefijo}-titulo.txt:expansion=none:fontsize=${altoTitulo}:fontcolor=white:x=${x}:y=${arriba + relleno}:${alfa}:${cuando}`,
  ];

  if (detalle) {
    partes.push(
      `drawtext=fontfile=rotulo.ttf:textfile=${opciones.prefijo}-detalle.txt:expansion=none:fontsize=${altoDetalle}:fontcolor=0xE6D8B8:x=${x}:y=${Math.round(arriba + relleno + altoTitulo + 0.5 * u)}:${alfa}:${cuando}`,
    );
  }

  return { carpeta: opciones.carpeta, filtro: partes.join(",") };
}

/* ------------------------------------------------------------------ */
/*  LA IMAGEN Y EL SONIDO DE CADA TROZO                                */
/* ------------------------------------------------------------------ */

/** La medida con la que sale el vídeo, y si es la vertical del móvil. */
export type MedidaSalida = { ancho: number; alto: number; vertical?: boolean };

/**
 * La medida de salida a partir de la del partido y lo pedido en la barra.
 *
 * `medida` es la de la barra: `0` la del partido, un ancho para encoger y
 * `-1` el vertical 1080 × 1920 (`lib/coding/vertical.ts`). Nunca se agranda:
 * inventar píxeles no devuelve detalle.
 */
export function medidaDeSalida(
  datos: { ancho: number; alto: number },
  medida: number,
): MedidaSalida {
  if (medida === -1) return { ancho: 1080, alto: 1920, vertical: true };

  if (medida > 0 && datos.ancho > medida) {
    const alto = Math.round((datos.alto * medida) / datos.ancho);

    return { ancho: medida - (medida % 2), alto: alto - (alto % 2) };
  }

  return { ancho: datos.ancho, alto: datos.alto };
}

/**
 * El grafo de la imagen: la forma, el vertical, el fundido y el rótulo.
 *
 * Va en `-filter_complex` porque el rótulo pintado es una **segunda entrada**
 * —la imagen, en bucle sus 3,5 s— que se pone encima con `overlay`, con la
 * misma entrada deslizándose y la misma salida que en la pantalla.
 *
 * `indiceRotulo` es el número de esa entrada en la orden de ffmpeg: va
 * detrás de las demás, así que lo dice quien la monta.
 */
function grafoDeImagen(opciones: {
  /** `scale`, `pad`, `fps`… lo que deja el trozo con la forma de todos. */
  forma?: string;
  fundido?: string;
  rotulo?: RotuloListo | null;
  salida: MedidaSalida;
  indiceRotulo: number;
}): { entradas: string[]; argumentos: string[] } {
  const { ancho, alto } = opciones.salida;
  const pasos: string[] = [];

  let actual = "0:v";

  /*
  | El vertical: detrás, el mismo fotograma ampliado, desenfocado y
  | oscurecido; delante, el corte a todo el ancho y en el centro.
  */
  if (opciones.salida.vertical) {
    pasos.push(
      `[${actual}]split[va][vb]`,
      /* El fondo se desenfoca en pequeño y se amplía: igual de borroso y diez
         veces más barato que un `boxblur` grande sobre 1080 × 1920. */
      `[va]scale=${Math.round(ancho / 10)}:${Math.round(alto / 10)}:force_original_aspect_ratio=increase,crop=${Math.round(ancho / 10)}:${Math.round(alto / 10)},boxblur=3:2,scale=${ancho}:${alto},eq=brightness=-0.18[vf]`,
      `[vb]scale=${ancho}:-2[vc]`,
      `[vf][vc]overlay=(W-w)/2:(H-h)/2[v0]`,
    );
    actual = "v0";
  }

  /* El fundido va antes que el rótulo: el negro no se lo come. */
  const cadena = [opciones.forma, opciones.fundido, opciones.rotulo?.filtro]
    .filter(Boolean)
    .join(",");

  pasos.push(`[${actual}]${cadena || "null"}[v1]`);
  actual = "v1";

  const entradas: string[] = [];

  if (opciones.rotulo?.imagen) {
    const base = baseDeRotulo(ancho, alto);
    const escala = (base / 1080).toFixed(4);
    const margen = Math.round(0.042 * base);
    const desliza = Math.round((DESLIZA_U / 100) * base);

    entradas.push(
      "-loop",
      "1",
      "-t",
      String(ROTULO_S),
      "-i",
      opciones.rotulo.imagen,
    );

    pasos.push(
      `[${opciones.indiceRotulo}:v]format=rgba,scale=iw*${escala}:-1,fade=t=in:st=0:d=${ENTRADA_S}:alpha=1,fade=t=out:st=${ROTULO_S - SALIDA_S}:d=${SALIDA_S}:alpha=1[ro]`,
      `[${actual}][ro]overlay=x='${margen}-${desliza}*pow(max(0,1-t/${ENTRADA_S}),3)':y=H-h-${margen}:eof_action=pass[v2]`,
    );
    actual = "v2";
  }

  return {
    entradas,
    argumentos: ["-filter_complex", pasos.join(";"), "-map", `[${actual}]`],
  };
}

/**
 * El sonido de cada trozo: igualado y sin chasquidos en las uniones.
 *
 * Un montaje pega cortes de minutos y fuentes distintas, y el volumen saltaba
 * de uno a otro: el grito de la grada del minuto 80 a todo volumen y el
 * siguiente corte casi mudo. Cada trozo se lleva a **-16 LUFS** (`loudnorm`,
 * lo que piden las plataformas para el móvil) y entra y sale con un fundido
 * de 0,25 s, que es lo que evita el golpe en cada unión.
 */
export function filtroDeSonido(segundosTrozo: number, fundido = true) {
  const pasos = ["loudnorm=I=-16:TP=-1.5:LRA=11", "aresample=48000"];

  if (fundido && segundosTrozo > 0.8) {
    pasos.push(
      `afade=t=in:st=0:d=${ENTRADA_S}`,
      `afade=t=out:st=${Math.max(0, segundosTrozo - 0.25).toFixed(3)}:d=0.25`,
    );
  }

  return pasos.join(",");
}

export async function cortaClip(opciones: {
  entrada: string;
  inicioMs: number;
  finMs: number;
  modo: ModoCorte;
  destino: string;
  /** Lo que puede pesar el corte, en megas. `0` o ausente es sin tope. */
  topeMegas?: number;
  /** Con rótulo se recodifica siempre: hay que pintar encima. */
  rotulo?: RotuloListo | null;
  /** La medida con la que sale; sin ella, la del partido. */
  salida?: MedidaSalida;
  /** La del partido, para saber si hay que tocarla. */
  original?: { ancho: number; alto: number };
  /** Si el partido trae sonido. Sin él no hay nada que igualar. */
  audio?: boolean;
}) {
  const duracion = Math.max(0, opciones.finMs - opciones.inicioMs);

  if (duracion <= 0) throw new Error("El clip no tiene duración.");

  const comunes = [
    "-hide_banner",
    "-loglevel",
    "error",
    /* El `-t` va delante del `-i`: es de esta entrada. Detrás sería de la
       siguiente, que con el rótulo es la imagen, y el partido saldría entero. */
    "-ss",
    segundos(opciones.inicioMs),
    "-t",
    segundos(duracion),
    "-i",
    opciones.entrada,
  ];

  const cambiaMedida =
    !!opciones.salida &&
    (!!opciones.salida.vertical ||
      (!!opciones.original &&
        (opciones.salida.ancho !== opciones.original.ancho ||
          opciones.salida.alto !== opciones.original.alto)));

  /*
  | Copiando no hay nada que apretar: los bytes son los del partido. Un tope
  | de peso obliga a recodificar, así que `rapido` con tope pasa a `preciso`
  | —y eso lo decide quien llama, no aquí: aquí sólo se deja de copiar.
  */
  const copia =
    opciones.modo === "rapido" &&
    !(opciones.topeMegas ?? 0) &&
    !opciones.rotulo &&
    !cambiaMedida;

  /*
  | Cuánta calidad se conserva al recodificar.
  |
  | Con tope de peso manda el techo de caudal, así que apretar más el `crf` no
  | cambiaría nada. Sin tope, en cambio, el `crf` es lo único que decide, y 20
  | se nota en un plano abierto de un campo de hierba: 18 es prácticamente
  | indistinguible del original y pesa alrededor de un tercio más, que sin tope
  | da igual. Un corte no debería verse peor que el partido del que sale.
  */
  const crf = (opciones.topeMegas ?? 0) > 0 ? "20" : "18";

  /* El sonido se iguala también copiando la imagen: recodificarlo es nada. */
  const sonido =
    opciones.audio === false
      ? ["-an"]
      : [
          "-map",
          "0:a:0?",
          "-af",
          filtroDeSonido(duracion / 1000),
          "-c:a",
          "aac",
          "-b:a",
          "160k",
        ];

  let codificacion: string[];

  if (copia) {
    codificacion = [
      "-map",
      "0:v:0",
      "-c:v",
      "copy",
      ...sonido,
      "-avoid_negative_ts",
      "make_zero",
    ];
  } else {
    const salida: MedidaSalida =
      opciones.salida ?? opciones.original ?? { ancho: 0, alto: 0 };

    const grafo = grafoDeImagen({
      forma: cambiaMedida && !salida.vertical
        ? `scale=${salida.ancho}:${salida.alto},setsar=1`
        : undefined,
      rotulo: opciones.rotulo,
      salida: { ...salida, vertical: opciones.salida?.vertical },
      indiceRotulo: 1,
    });

    codificacion = [
      ...grafo.entradas,
      ...grafo.argumentos,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      crf,
      ...rejillaDeCaudal(opciones.topeMegas ?? 0, duracion / 1000),
      "-pix_fmt",
      "yuv420p",
      ...sonido,
    ];
  }

  await ejecuta(
    FFMPEG,
    [
      ...comunes,
      ...codificacion,
      "-movflags",
      "+faststart",
      "-y",
      opciones.destino,
    ],
    opciones.rotulo?.carpeta,
  );

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
  /** Cuántas entradas trae ya `entradaArgs` (la imagen fija trae dos). */
  entradasPropias?: number;
  ancho: number;
  alto: number;
  vertical?: boolean;
  fps: number;
  destino: string;
  /** Duración del silencio que hay que inventar, en ms. `0` si ya trae sonido. */
  silencioMs?: number;
  /** De qué entrada sale el sonido cuando no hay que inventarlo. */
  sonidoDe?: string;
  /** Lo que dura el trozo, en segundos: para el fundido del sonido. */
  segundosTrozo?: number;
  /** `false` en la portada: su sonido es silencio y no hay nada que igualar. */
  igualaSonido?: boolean;
  /** Techo de peso del fichero final y lo que dura, para la rejilla de caudal. */
  topeMegas?: number;
  segundosDelTope?: number;
  /** Ya preparado para esta misma medida (`preparaRotulo`). */
  rotulo?: RotuloListo | null;
  /** Los filtros `fade` del fundido entre cortes, ya escritos. */
  fundido?: string;
}) {
  /*
   * El silencio es una entrada más, y entonces hay que mapear a mano: sin
   * `-map`, ffmpeg elige el vídeo de una entrada y el audio de la otra sólo
   * por suerte, y con dos entradas de vídeo se equivoca.
   */
  const silencio = !!opciones.silencioMs && opciones.silencioMs > 0;
  const propias = opciones.entradasPropias ?? 1;

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

  const indiceSilencio = propias;
  const indiceRotulo = propias + (silencio ? 1 : 0);

  const forma = `scale=${opciones.ancho}:${opciones.alto}:force_original_aspect_ratio=decrease,pad=${opciones.ancho}:${opciones.alto}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${opciones.fps.toFixed(3)}`;

  const grafo = grafoDeImagen({
    forma,
    fundido: opciones.fundido,
    rotulo: opciones.rotulo,
    salida: {
      ancho: opciones.ancho,
      alto: opciones.alto,
      vertical: opciones.vertical,
    },
    indiceRotulo,
  });

  /* El sonido inventado es silencio: no hay nada que igualar. */
  const sonido = silencio
    ? ["-map", `${indiceSilencio}:a:0`]
    : opciones.igualaSonido === false
      ? ["-map", opciones.sonidoDe ?? "0:a:0"]
      : [
          "-map",
          opciones.sonidoDe ?? "0:a:0",
          "-af",
          filtroDeSonido(opciones.segundosTrozo ?? 0),
        ];

  await ejecuta(FFMPEG, [
    "-hide_banner",
    "-loglevel",
    "error",
    ...opciones.entradaArgs,
    ...extra,
    ...grafo.entradas,
    ...grafo.argumentos,
    ...sonido,
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
  ], opciones.rotulo?.carpeta);

  return opciones.destino;
}

/** Un trozo de vídeo ya normalizado, listo para pegar. */
export async function segmentoNormalizado(opciones: {
  entrada: string;
  inicioMs: number;
  finMs: number;
  ancho: number;
  alto: number;
  vertical?: boolean;
  fps: number;
  destino: string;
  /** Si la fuente de ESTE trozo trae sonido. Sin él, se le pone silencio. */
  audio?: boolean;
  /** Lo que puede pesar el fichero final del que este trozo forma parte. */
  topeMegas?: number;
  /** Y lo que dura ese fichero final, que es entre lo que se reparte. */
  segundosDelTope?: number;
  rotulo?: RotuloListo | null;
  /**
   * Fundido a negro de este trozo, en ms: al entrar, al salir o los dos.
   * Con un clip partido por pizarras sólo entra el primero y sale el último.
   */
  fundido?: { ms: number; entra: boolean; sale: boolean };
}) {
  const duracion = Math.max(0, opciones.finMs - opciones.inicioMs);

  if (duracion <= 0) throw new Error("El clip no tiene duración.");

  /* Lo mismo que `negroDeFundido` del navegador: un trozo corto no se funde. */
  const fundido =
    opciones.fundido && opciones.fundido.ms > 0 && duracion > opciones.fundido.ms * 2
      ? [
          opciones.fundido.entra
            ? `fade=t=in:st=0:d=${segundos(opciones.fundido.ms)}`
            : "",
          opciones.fundido.sale
            ? `fade=t=out:st=${segundos(duracion - opciones.fundido.ms)}:d=${segundos(opciones.fundido.ms)}`
            : "",
        ]
          .filter(Boolean)
          .join(",")
      : "";

  return normaliza({
    entradaArgs: [
      "-ss",
      segundos(opciones.inicioMs),
      "-t",
      segundos(duracion),
      "-i",
      opciones.entrada,
    ],
    ancho: opciones.ancho,
    alto: opciones.alto,
    vertical: opciones.vertical,
    fps: opciones.fps,
    destino: opciones.destino,
    silencioMs: opciones.audio === false ? duracion : 0,
    segundosTrozo: duracion / 1000,
    topeMegas: opciones.topeMegas,
    segundosDelTope: opciones.segundosDelTope,
    rotulo: opciones.rotulo,
    /*
    | El sonido entra y sale con su fundido en cada unión aunque la imagen
    | vaya a corte seco (`filtroDeSonido`): el golpe de un sonido que empieza
    | a todo volumen se oye aunque no se vea.
    */
    fundido: fundido || undefined,
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
  vertical?: boolean;
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
    entradasPropias: 2,
    /* El silencio de la portada ya viene en la entrada 1: no se iguala. */
    silencioMs: 0,
    sonidoDe: "1:a:0",
    igualaSonido: false,
    segundosTrozo: opciones.duracionMs / 1000,
    ancho: opciones.ancho,
    alto: opciones.alto,
    vertical: opciones.vertical,
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
  vertical?: boolean;
  fps: number;
  audio: boolean;
  paradas: ParadaPedida[];
  /** Carpeta de trabajo y prefijo de los trozos, para no pisarse entre clips. */
  carpeta: string;
  prefijo: string;
  /**
   * Segundos entre los que repartir `topeMegas`.
   *
   * En un montaje unificado es lo que va a durar el fichero ENTERO, no este
   * clip: sin esto, cada clip con pizarras se llevaba el presupuesto completo
   * y veinte cortes con un tope de 50 MB salían en cerca de un giga.
   */
  segundosDelTope?: number;
  destino: string;
  /** Lo que puede pesar el corte ya montado, en megas. */
  topeMegas?: number;
  /** Va en el trozo que empieza el corte: es el que tiene el tiempo cero. */
  rotulo?: RotuloListo | null;
  /** Fundido a negro al entrar en el corte y al salir de él, en ms. */
  fundidoMs?: number;
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
        vertical: opciones.vertical,
        fps: opciones.fps,
        audio: opciones.audio,
        /* El tope es del fichero entero, y cada trozo es un pedazo de él: se
           aplica el mismo caudal a todos, que es lo que lo hace cumplir. */
        topeMegas: opciones.topeMegas,
        segundosDelTope: opciones.segundosDelTope ?? (duracion + paradasMs) / 1000,
        destino: nombra("video"),
        rotulo: a === 0 ? opciones.rotulo : null,
        fundido: opciones.fundidoMs
          ? { ms: opciones.fundidoMs, entra: a === 0, sale: b >= duracion }
          : undefined,
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
        vertical: opciones.vertical,
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

/**
 * El caudal de vídeo que hace caber `segundos` en `bytes`, con el mismo
 * descuento que `rejillaDeCaudal`: sonido y contenedor.
 */
export function caudalParaCaber(bytes: number, segundos: number) {
  return Math.max(400_000, Math.round((bytes * 8 * 0.94) / segundos - 160_000));
}

/**
 * Si el fichero ya montado se ha pasado del tope, se vuelve a comprimir UNA
 * vez con el caudal justo para caber.
 *
 * La rejilla de caudal es un techo por trozo, y al pegar trozos con pizarras
 * y carátula —imágenes fijas que pesan poco— la cuenta casi siempre cuadra;
 * pero un partido con mucho grano o un corte muy corto puede pasarse por
 * unos megas, y un fichero de 17 MB no entra en un WhatsApp de 16. Mejor una
 * segunda pasada que mandar algo que se va a rechazar. El sonido no se toca:
 * ya está igualado.
 *
 * Devuelve lo que pesa al final y si ha hecho falta reintentar.
 */
export async function ajustaAlTope(archivo: string, topeMegas: number) {
  const tope = Math.max(0, topeMegas) * 1_000_000;
  const antes = (await stat(archivo)).size;

  if (tope <= 0 || antes <= tope) return { bytes: antes, reintento: false };

  const { duracionMs } = await sondeaVideo(archivo);
  const segundos = duracionMs / 1000;

  if (segundos <= 0) return { bytes: antes, reintento: false };

  /* Un 3 % de margen más: el primer intento ya demostró que la cuenta va justa. */
  const caudal = Math.round(caudalParaCaber(tope * 0.97, segundos) / 1000);

  const nuevo = archivo.replace(/\.mp4$/i, "") + "-ajustado.mp4";

  /* Si la segunda pasada falla, vale el MP4 de la primera: se pasa del tope, pero es bueno. */
  try {
  await ejecuta(FFMPEG, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    archivo,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-b:v",
    `${caudal}k`,
    "-maxrate",
    `${caudal}k`,
    "-bufsize",
    `${caudal * 2}k`,
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    "-y",
    nuevo,
  ]);

  await rename(nuevo, archivo);
  } catch (error) {
    console.warn("[coding] la segunda pasada para caber en el tope ha fallado", error);
    await rm(nuevo, { force: true }).catch(() => {});

    return { bytes: antes, reintento: false };
  }

  return { bytes: (await stat(archivo)).size, reintento: true };
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
