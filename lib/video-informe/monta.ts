/*
|--------------------------------------------------------------------------
| EL VÍDEO RESUMEN DEL INFORME, MONTADO EN EL NAVEGADOR
|--------------------------------------------------------------------------
|
| Convierte un `GuionVideo` en un MP4 (H.264 + AAC) de menos de un minuto, en
| 1280×720 a 30 fps, sin servidor: la app vive en Vercel y una función no
| puede ni ver un vídeo ni aguantar un montaje. Es el mismo camino que el
| montaje del coding (`lib/coding/rapido.ts`): WebCodecs para codificar y el
| `MuxorMp4` propio para escribir el fichero. Ver [[coding-montaje-navegador]].
|
| Tres pasos, y los dos primeros pueden fallar sin que el vídeo deje de salir:
|   1. `/api/informe/video-guion` pule la locución (Gemini, sin coste).
|   2. `/api/informe/voz` la lee (Gemini TTS, sin coste) → PCM 24 kHz mono.
|   3. Cada escena se pinta en un lienzo fotograma a fotograma —texto que
|      entra, barras que crecen, un corte del rival si lo hay— y se codifica.
|
| Las cuatro trampas del codificador del navegador están medidas en el coding
| y aquí se respetan: el fotograma se cierra en el acto, el muxor escribe la
| caja de color, el sonido mide lo mismo que la imagen y el primer instante
| nunca es negativo.
*/

import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";

import { SEGUNDOS_MAXIMOS, type Escena, type GuionVideo } from "./guion";

const ANCHO = 1280;
const ALTO = 720;
const FPS = 30;
/** ~10 MB el minuto: cabe con el PDF dentro del tope de adjuntos del correo (16 MB). */
const CAUDAL = 1_400_000;
const CODEC = "avc1.4d401f"; /* H.264 Main 3.1: 1280×720 a 30 fps en cualquier aparato. */

const FONDO = "#08111F";
const ORO = "#C8A96B";
const BLANCO = "#FFFFFF";
const FUENTE = `"Barlow Condensed", "Segoe UI", Arial, sans-serif`;

/** Lo que dura cada escena si la voz no manda otra cosa, y cuánto se le deja de aire tras la locución. */
const SEGUNDOS: Record<Escena["tipo"], number> = { portada: 5, cifras: 7, claves: 8, barras: 7, clip: 7, imagen: 7, cierre: 5 };
const AIRE = 0.7;

/** Las que se sacrifican primero si no cabe en el minuto, por este orden. */
const PRESCINDIBLES = ["clip", "abp", "duelo", "grafico-1", "vigilar", "grafico-0", "rival", "cifras"];

export type PasoVideo = (texto: string) => void;

export function puedeMontarVideo() {
  return typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof VideoFrame !== "undefined";
}

/* ------------------------------------------------------------------ */
/*  LA IA: LOCUCIÓN Y VOZ                                             */
/* ------------------------------------------------------------------ */

const conPlazo = <T,>(p: Promise<T>, ms: number, siNo: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(siNo), ms))]);

async function puleLocucion(guion: GuionVideo): Promise<GuionVideo> {
  const escenas = guion.escenas.map((e) => ({ id: e.id, texto: e.locucion, palabras: Math.ceil(SEGUNDOS[e.tipo] * 2.4) }));

  const r = await conPlazo(
    fetch("/api/informe/video-guion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contexto: guion.titulo, escenas }) })
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null),
    15_000,
    null,
  );

  const lista = (r as { ok?: boolean; locuciones?: { id: string; texto: string }[] } | null)?.locuciones;

  if (!lista) return guion;

  const porId = new Map(lista.map((l) => [l.id, l.texto]));

  return { ...guion, escenas: guion.escenas.map((e) => ({ ...e, locucion: porId.get(e.id)?.trim() || e.locucion })) };
}

type Voz = { frecuencia: number; pistas: (Float32Array | null)[] };

async function pideVoz(guion: GuionVideo): Promise<Voz | null> {
  const r = await conPlazo(
    fetch("/api/informe/voz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ textos: guion.escenas.map((e) => e.locucion) }) })
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null),
    55_000,
    null,
  );

  const datos = r as { ok?: boolean; frecuencia?: number; pistas?: (string | null)[] } | null;

  if (!datos?.ok || !datos.pistas) return null;

  return {
    frecuencia: datos.frecuencia || 24_000,
    pistas: datos.pistas.map((b64) => {
      if (!b64) return null;

      const crudo = atob(b64);
      const bytes = new Uint8Array(crudo.length);

      for (let i = 0; i < crudo.length; i += 1) bytes[i] = crudo.charCodeAt(i);

      /* PCM de 16 bits con signo, little-endian → flotante [-1, 1]. */
      const enteros = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
      const flot = new Float32Array(enteros.length);

      for (let i = 0; i < enteros.length; i += 1) flot[i] = enteros[i] / 32768;

      return flot;
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  LA DURACIÓN DE CADA ESCENA                                         */
/* ------------------------------------------------------------------ */

type EscenaMedida = { escena: Escena; segundos: number; voz: Float32Array | null };

function reparte(guion: GuionVideo, voz: Voz | null): EscenaMedida[] {
  let lista: EscenaMedida[] = guion.escenas.map((escena, i) => {
    const pista = voz?.pistas[i] ?? null;
    const habla = pista ? pista.length / (voz?.frecuencia || 24_000) : 0;
    const base = escena.tipo === "clip" ? escena.segundos : SEGUNDOS[escena.tipo];

    return { escena, voz: pista, segundos: Math.max(habla ? habla + AIRE : 0, pista ? Math.min(base, habla + AIRE + 1) : base) };
  });

  const total = () => lista.reduce((s, x) => s + x.segundos, 0);

  /* Primero se quita el aire; si aún no cabe, salen escenas por orden de prescindibles. */
  for (const id of PRESCINDIBLES) {
    if (total() <= SEGUNDOS_MAXIMOS) break;

    lista = lista.filter((x) => x.escena.id !== id);
  }

  if (total() > SEGUNDOS_MAXIMOS) {
    const factor = SEGUNDOS_MAXIMOS / total();

    lista = lista.map((x) => ({ ...x, segundos: x.segundos * factor }));
  }

  return lista;
}

/* ------------------------------------------------------------------ */
/*  EL DIBUJO                                                          */
/* ------------------------------------------------------------------ */

type Lienzo = OffscreenCanvasRenderingContext2D;

const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

/** Progreso 0→1 de una entrada que empieza en `desde` s y dura `cuanto` s. */
const entra = (t: number, desde: number, cuanto = 0.45) => suave((t - desde) / cuanto);

function parteLineas(ctx: Lienzo, texto: string, anchoMax: number) {
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let actual = "";

  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;

    if (ctx.measureText(prueba).width > anchoMax && actual) {
      lineas.push(actual);
      actual = p;
    } else actual = prueba;
  }

  if (actual) lineas.push(actual);

  return lineas;
}

function fondo(ctx: Lienzo, titulo: string, progreso: number, t: number) {
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  /* Un halo dorado que respira muy despacio: que no parezca una diapositiva parada. */
  const g = ctx.createRadialGradient(ANCHO * 0.85, ALTO * 0.1, 0, ANCHO * 0.85, ALTO * 0.1, 700 + Math.sin(t * 0.8) * 40);
  g.addColorStop(0, "rgba(200,169,107,0.16)");
  g.addColorStop(1, "rgba(200,169,107,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.fillStyle = ORO;
  ctx.fillRect(56, 48, 42, 4);
  ctx.font = `600 20px ${FUENTE}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`REAL MADRID CASTILLA · ${titulo.toUpperCase()}`, 110, 56);

  /* La barra de abajo cuenta el minuto. */
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, ALTO - 6, ANCHO, 6);
  ctx.fillStyle = ORO;
  ctx.fillRect(0, ALTO - 6, ANCHO * progreso, 6);
}

function titular(ctx: Lienzo, texto: string, t: number, y = 150, tam = 54) {
  const a = entra(t, 0.05);

  ctx.globalAlpha = a;
  ctx.fillStyle = BLANCO;
  ctx.font = `700 ${tam}px ${FUENTE}`;
  ctx.fillText(texto.toUpperCase(), 56 + (1 - a) * -30, y);
  ctx.globalAlpha = 1;
}

function pieLocucion(ctx: Lienzo, texto: string, t: number) {
  /* La locución, escrita abajo: quien lo vea sin sonido lee lo mismo que se dice. */
  const a = entra(t, 0.3, 0.6);

  ctx.globalAlpha = a * 0.85;
  ctx.font = `400 24px ${FUENTE}`;
  ctx.fillStyle = BLANCO;

  const lineas = parteLineas(ctx, texto, ANCHO - 112).slice(0, 2);

  lineas.forEach((l, i) => ctx.fillText(l, 56, ALTO - 62 + i * 30 - (lineas.length - 1) * 30));
  ctx.globalAlpha = 1;
}

function pintaPortada(ctx: Lienzo, e: Extract<Escena, { tipo: "portada" }>, t: number) {
  const a = entra(t, 0.1, 0.6);

  ctx.globalAlpha = a;
  ctx.fillStyle = ORO;
  ctx.font = `700 26px ${FUENTE}`;
  ctx.fillText(e.sello, 56, 250 + (1 - a) * 20);
  ctx.globalAlpha = 1;

  const b = entra(t, 0.35, 0.6);

  ctx.globalAlpha = b;
  ctx.fillStyle = BLANCO;
  ctx.font = `700 92px ${FUENTE}`;

  const lineas = parteLineas(ctx, e.titulo.toUpperCase(), ANCHO - 112).slice(0, 2);

  lineas.forEach((l, i) => ctx.fillText(l, 56 + (1 - b) * -40, 360 + i * 96));
  ctx.globalAlpha = 1;

  const c = entra(t, 0.8, 0.6);

  ctx.globalAlpha = c * 0.7;
  ctx.font = `400 30px ${FUENTE}`;
  ctx.fillText(e.subtitulo, 56, 380 + lineas.length * 96 - 40);
  ctx.globalAlpha = 1;
}

function pintaClaves(ctx: Lienzo, titulo: string, lineas: string[], t: number) {
  titular(ctx, titulo, t);

  lineas.slice(0, 4).forEach((linea, i) => {
    const a = entra(t, 0.4 + i * 0.35, 0.5);

    ctx.globalAlpha = a;
    ctx.fillStyle = ORO;
    ctx.fillRect(56, 215 + i * 92, 8, 48);
    ctx.fillStyle = BLANCO;
    ctx.font = `500 34px ${FUENTE}`;

    const partes = parteLineas(ctx, linea, ANCHO - 170).slice(0, 2);

    partes.forEach((p, k) => ctx.fillText(p, 90 + (1 - a) * 30, 236 + i * 92 + k * 38 + (partes.length === 1 ? 10 : 0)));
    ctx.globalAlpha = 1;
  });
}

function pintaCifras(ctx: Lienzo, e: Extract<Escena, { tipo: "cifras" }>, t: number) {
  titular(ctx, e.titulo, t);

  const n = Math.min(4, e.cifras.length);
  const ancho = (ANCHO - 112 - (n - 1) * 20) / n;

  e.cifras.slice(0, 4).forEach((c, i) => {
    const a = entra(t, 0.4 + i * 0.3, 0.5);
    const x = 56 + i * (ancho + 20);

    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, 210 + (1 - a) * 30, ancho, 300);
    ctx.fillStyle = ORO;
    ctx.fillRect(x, 210 + (1 - a) * 30, ancho, 4);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `600 20px ${FUENTE}`;
    ctx.fillText(c.rotulo.toUpperCase(), x + 20, 254 + (1 - a) * 30);
    ctx.fillStyle = BLANCO;

    const largo = c.valor.length > 12;

    ctx.font = `700 ${largo ? 30 : 64}px ${FUENTE}`;

    const lineas = parteLineas(ctx, c.valor, ancho - 40).slice(0, largo ? 5 : 2);

    lineas.forEach((l, k) => ctx.fillText(l, x + 20, (largo ? 300 : 330) + k * (largo ? 36 : 66) + (1 - a) * 30));

    if (c.pie) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `400 20px ${FUENTE}`;
      parteLineas(ctx, c.pie, ancho - 40)
        .slice(0, 2)
        .forEach((l, k) => ctx.fillText(l, x + 20, 460 + k * 24 + (1 - a) * 30));
    }

    ctx.globalAlpha = 1;
  });
}

function pintaBarras(ctx: Lienzo, e: Extract<Escena, { tipo: "barras" }>, t: number) {
  titular(ctx, e.titulo, t);

  const maximo = Math.max(0.01, ...e.barras.map((b) => b.valor));

  e.barras.slice(0, 4).forEach((b, i) => {
    const a = entra(t, 0.4 + i * 0.25, 0.8);
    const y = 220 + i * 80;

    ctx.globalAlpha = entra(t, 0.3 + i * 0.25, 0.4);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `600 26px ${FUENTE}`;
    ctx.fillText(b.rotulo.toUpperCase(), 56, y + 8);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(300, y - 18, ANCHO - 356 - 220, 36);
    ctx.fillStyle = i === e.barras.length - 1 && e.barras.length > 3 ? ORO : "rgba(200,169,107,0.75)";
    ctx.fillRect(300, y - 18, (ANCHO - 356 - 220) * (b.valor / maximo) * a, 36);
    ctx.fillStyle = BLANCO;
    ctx.font = `700 30px ${FUENTE}`;
    ctx.fillText(b.texto, ANCHO - 56 - 200, y + 10);
    ctx.globalAlpha = 1;
  });
}

function pintaImagen(ctx: Lienzo, e: Extract<Escena, { tipo: "imagen" }>, img: ImageBitmap | null, t: number) {
  titular(ctx, e.titulo, t, 120, 40);

  if (img) {
    const a = entra(t, 0.3, 0.6);
    const cajaW = ANCHO - 112;
    const cajaH = ALTO - 120 - 130;
    const k = Math.min(cajaW / img.width, cajaH / img.height);
    const w = img.width * k;
    const h = img.height * k;

    ctx.globalAlpha = a;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(56 + (cajaW - w) / 2 - 8, 140 - 8 + (1 - a) * 20, w + 16, h + 16);
    ctx.drawImage(img, 56 + (cajaW - w) / 2, 140 + (1 - a) * 20, w, h);
    ctx.globalAlpha = 1;
  }
}

function pintaClip(ctx: Lienzo, e: Extract<Escena, { tipo: "clip" }>, video: HTMLVideoElement | null, t: number) {
  if (video && video.videoWidth) {
    /* Cubre el lienzo entero recortando lo que sobre. */
    const k = Math.max(ANCHO / video.videoWidth, ALTO / video.videoHeight);
    const w = video.videoWidth * k;
    const h = video.videoHeight * k;

    ctx.drawImage(video, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);

    const g = ctx.createLinearGradient(0, ALTO * 0.45, 0, ALTO);
    g.addColorStop(0, "rgba(8,17,31,0)");
    g.addColorStop(1, "rgba(8,17,31,0.92)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }

  const a = entra(t, 0.2, 0.6);

  ctx.globalAlpha = a;
  ctx.fillStyle = ORO;
  ctx.fillRect(56, ALTO - 150, 8, 44);
  ctx.fillStyle = BLANCO;
  ctx.font = `700 36px ${FUENTE}`;
  ctx.fillText(parteLineas(ctx, e.titulo, ANCHO - 140)[0] ?? "", 84, ALTO - 116);
  ctx.globalAlpha = 1;
}

function pintaCierre(ctx: Lienzo, e: Extract<Escena, { tipo: "cierre" }>, t: number) {
  const a = entra(t, 0.1, 0.6);

  ctx.globalAlpha = a;
  ctx.fillStyle = ORO;
  ctx.font = `700 26px ${FUENTE}`;
  ctx.fillText(e.titulo.toUpperCase(), 56, 240);
  ctx.globalAlpha = 1;

  const b = entra(t, 0.4, 0.7);

  ctx.globalAlpha = b;
  ctx.fillStyle = BLANCO;
  ctx.font = `700 54px ${FUENTE}`;

  let y = 320;

  for (const linea of e.lineas.slice(0, 2)) {
    for (const l of parteLineas(ctx, linea, ANCHO - 112).slice(0, 2)) {
      ctx.fillText(l, 56 + (1 - b) * -30, y);
      y += 62;
    }
  }

  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/*  LOS RECURSOS DE CADA ESCENA                                         */
/* ------------------------------------------------------------------ */

async function cargaImagen(src: string): Promise<ImageBitmap | null> {
  try {
    const blob = await (await fetch(src)).blob();

    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

/**
 * Un `<video>` del bucket listo para pedirle fotogramas. `null` si no se
 * puede abrir (CORS, códec, enlace de YouTube): la escena sale con su texto
 * sobre el fondo y nadie se entera de que faltó.
 */
async function abreClip(url: string, segundos: number): Promise<{ video: HTMLVideoElement; desde: number } | null> {
  if (typeof document === "undefined") return null;

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  video.src = url;

  const listo = await conPlazo(
    new Promise<boolean>((r) => {
      video.addEventListener("loadeddata", () => r(true), { once: true });
      video.addEventListener("error", () => r(false), { once: true });
    }),
    8000,
    false,
  );

  if (!listo || !video.videoWidth || !Number.isFinite(video.duration)) return null;

  /* El tramo del medio: los vídeos de scouting empiezan con carátula. */
  const desde = Math.max(0, Math.min(video.duration - segundos, video.duration * 0.35));

  /* Si el fotograma no se puede leer por CORS, `getImageData` revienta: se comprueba una vez. */
  try {
    const prueba = new OffscreenCanvas(2, 2).getContext("2d")!;
    prueba.drawImage(video, 0, 0, 2, 2);
    prueba.getImageData(0, 0, 1, 1);
  } catch {
    return null;
  }

  return { video, desde };
}

async function buscaFotograma(video: HTMLVideoElement, segundo: number) {
  if (Math.abs(video.currentTime - segundo) < 1 / FPS / 2) return;

  await conPlazo(
    new Promise<void>((r) => {
      video.addEventListener("seeked", () => r(), { once: true });
      video.currentTime = Math.min(segundo, Math.max(0, video.duration - 0.05));
    }),
    600,
    undefined,
  );
}

/* ------------------------------------------------------------------ */
/*  EL MONTAJE                                                         */
/* ------------------------------------------------------------------ */

function copia(fuente: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(fuente) ? new Uint8Array(fuente.buffer as ArrayBuffer, fuente.byteOffset, fuente.byteLength) : new Uint8Array(fuente as ArrayBuffer);
  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength)) as Bytes;

  salida.set(vista);

  return salida;
}

const respira = () => new Promise<void>((r) => setTimeout(r, 0));

export type VideoMontado = { blob: Blob; segundos: number; conVoz: boolean; escenas: number };

/**
 * Monta el vídeo resumen de un guion. `alPaso` recibe el texto de progreso
 * para la pantalla («voz…», «escena 3/7…»).
 */
export async function montaVideoInforme(guionCrudo: GuionVideo, alPaso: PasoVideo = () => {}): Promise<VideoMontado> {
  if (!puedeMontarVideo()) throw new Error("Este navegador no puede montar vídeo (hace falta Chrome, Edge o Safari 17).");

  alPaso("guion…");
  const guion = await puleLocucion(guionCrudo);

  alPaso("voz…");
  const voz = await pideVoz(guion);
  const escenas = reparte(guion, voz);
  const total = escenas.reduce((s, x) => s + x.segundos, 0);

  /* Recursos por adelantado: imágenes y el corte del rival. */
  alPaso("recursos…");
  const imagenes = new Map<string, ImageBitmap | null>();
  const clips = new Map<string, { video: HTMLVideoElement; desde: number } | null>();

  await Promise.all(
    escenas.map(async ({ escena }) => {
      if (escena.tipo === "imagen") imagenes.set(escena.id, await cargaImagen(escena.src));
      if (escena.tipo === "clip") clips.set(escena.id, await abreClip(escena.url, escena.segundos));
    }),
  );

  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await conPlazo<unknown>(Promise.all([document.fonts.load(`700 60px "Barlow Condensed"`), document.fonts.load(`400 24px "Barlow Condensed"`)]), 2000, null);
    } catch {
      /* Con la fuente del sistema vale. */
    }
  }

  /* ---- codificadores y muxor ---- */
  const muxor = new MuxorMp4();
  let fallo: Error | null = null;

  const codificador = new VideoEncoder({
    output: (trozo, metadatos) => {
      const descripcion = metadatos?.decoderConfig?.description;

      if (descripcion) muxor.configuraVideo({ ancho: ANCHO, alto: ALTO, descripcion: copia(descripcion) });

      const datos = new Uint8Array(trozo.byteLength) as Bytes;
      trozo.copyTo(datos);
      muxor.añadeVideo(datos, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / FPS, trozo.type === "key");
    },
    error: (e) => {
      fallo = e instanceof Error ? e : new Error(String(e));
    },
  });

  codificador.configure({ codec: CODEC, width: ANCHO, height: ALTO, bitrate: CAUDAL, framerate: FPS, latencyMode: "quality", avc: { format: "avc" } });

  const frecuencia = voz?.frecuencia || 24_000;
  let enMuestras = 0;

  const sonido = new AudioEncoder({
    output: (trozo, metadatos) => {
      const descripcion = metadatos?.decoderConfig?.description;

      if (descripcion) muxor.configuraAudio({ frecuencia, canales: 1, descripcion: copia(descripcion) });

      const datos = new Uint8Array(trozo.byteLength) as Bytes;
      trozo.copyTo(datos);

      const cuantas = Math.round(((trozo.duration || 0) * frecuencia) / 1e6) || 1024;
      muxor.añadeAudio(datos, enMuestras, cuantas);
      enMuestras += cuantas;
    },
    error: (e) => {
      fallo = e instanceof Error ? e : new Error(String(e));
    },
  });

  sonido.configure({ codec: "mp4a.40.2", sampleRate: frecuencia, numberOfChannels: 1, bitrate: 96_000 });

  /* ---- la pista de sonido entera: la voz de cada escena en su sitio y silencio en el resto ---- */
  const totalMuestras = Math.ceil(total * frecuencia);
  const pista = new Float32Array(totalMuestras);
  let inicio = 0;

  for (const x of escenas) {
    if (x.voz) pista.set(x.voz.subarray(0, Math.min(x.voz.length, totalMuestras - Math.floor(inicio * frecuencia))), Math.floor(inicio * frecuencia));

    inicio += x.segundos;
  }

  for (let i = 0; i < totalMuestras; i += 1024) {
    const n = Math.min(1024, totalMuestras - i);
    const datos = new AudioData({ format: "f32-planar", sampleRate: frecuencia, numberOfFrames: n, numberOfChannels: 1, timestamp: Math.round((i / frecuencia) * 1e6), data: pista.subarray(i, i + n) });

    sonido.encode(datos);
    datos.close();
  }

  /* ---- los fotogramas ---- */
  const lienzo = new OffscreenCanvas(ANCHO, ALTO);
  const ctx = lienzo.getContext("2d")!;
  const totalFotogramas = Math.round(total * FPS);
  let fotograma = 0;
  let arranque = 0;

  for (const [k, x] of escenas.entries()) {
    alPaso(`escena ${k + 1}/${escenas.length}…`);

    const cuantos = k === escenas.length - 1 ? totalFotogramas - fotograma : Math.round(x.segundos * FPS);
    const clip = x.escena.tipo === "clip" ? clips.get(x.escena.id) ?? null : null;

    for (let i = 0; i < cuantos; i += 1) {
      if (fallo) throw fallo;

      const t = i / FPS;
      const e = x.escena;

      if (clip) await buscaFotograma(clip.video, clip.desde + t);

      fondo(ctx, guion.titulo, fotograma / totalFotogramas, arranque + t);

      if (e.tipo === "portada") pintaPortada(ctx, e, t);
      else if (e.tipo === "claves") pintaClaves(ctx, e.titulo, e.lineas, t);
      else if (e.tipo === "cifras") pintaCifras(ctx, e, t);
      else if (e.tipo === "barras") pintaBarras(ctx, e, t);
      else if (e.tipo === "imagen") pintaImagen(ctx, e, imagenes.get(e.id) ?? null, t);
      else if (e.tipo === "clip") pintaClip(ctx, e, clip?.video ?? null, t);
      else pintaCierre(ctx, e, t);

      if (e.tipo !== "portada" && e.tipo !== "cierre" && e.tipo !== "clip") pieLocucion(ctx, e.locucion, t);

      /* Fundido entre escenas. */
      const restante = (cuantos - i) / FPS;
      const velo = Math.max(0, 1 - Math.min(t / 0.3, restante / 0.3));

      if (velo > 0) {
        ctx.fillStyle = `rgba(8,17,31,${velo})`;
        ctx.fillRect(0, 0, ANCHO, ALTO);
      }

      const marca = new VideoFrame(lienzo, { timestamp: Math.round((fotograma / FPS) * 1e6), duration: Math.round(1e6 / FPS) });

      codificador.encode(marca, { keyFrame: fotograma % (FPS * 2) === 0 });
      marca.close();
      fotograma += 1;

      /* Que el codificador no se ahogue y la pantalla pueda pintar el progreso. */
      while (codificador.encodeQueueSize > 8) await respira();
    }

    arranque += x.segundos;
  }

  alPaso("cerrando el vídeo…");
  await Promise.all([codificador.flush(), sonido.flush()]);
  codificador.close();
  sonido.close();

  for (const c of clips.values()) {
    if (c) {
      c.video.pause();
      c.video.removeAttribute("src");
      c.video.load();
    }
  }

  for (const img of imagenes.values()) img?.close();

  if (fallo) throw fallo;

  return { blob: muxor.cierra(), segundos: Math.round(total), conVoz: Boolean(voz?.pistas.some(Boolean)), escenas: escenas.length };
}
