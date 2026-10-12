/*
|--------------------------------------------------------------------------
| EL VÍDEO RESUMEN DEL INFORME, MONTADO EN EL NAVEGADOR
|--------------------------------------------------------------------------
|
| Convierte un `GuionVideo` en un MP4 (H.264 + AAC) en 1280×720 a 30 fps,
| sin servidor: la app vive en Vercel y una función no puede ni ver un vídeo
| ni aguantar un montaje. Es el mismo camino que el montaje del coding
| (`lib/coding/rapido.ts`): WebCodecs para codificar y el `MuxorMp4` propio
| para escribir el fichero. Ver [[coding-montaje-navegador]].
|
| Lo que se pinta está en `dibujo.ts` y lo comparte con el motor de Node del
| ordenador del club (`scripts/partido/video-informe.mjs`), que es el que
| monta el vídeo «grande» con los cortes reales de Hudl. Aquí sólo quedan
| los recursos del navegador (ImageBitmap, `<video>`), la IA y WebCodecs.
|
| Tres pasos, y los dos primeros pueden fallar sin que el vídeo deje de salir:
|   1. `/api/informe/video-guion` pule la locución (Gemini, sin coste).
|   2. `/api/informe/voz` la lee entera (Gemini TTS, sin coste; 10 al día) y
|      `reparteVoz` la parte por escenas.
|   3. Cada escena se pinta fotograma a fotograma y se codifica.
*/

import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";

import { ALTO, ANCHO, FPS, SEGUNDOS, corteEn, limitesDeCortes, pintaFotograma, rellenaGrano, reparteEscenas, type Recursos } from "./dibujo";
import { SEGUNDOS_MAXIMOS, type Corte, type GuionVideo, type JugadorEscena } from "./guion";
import { FRECUENCIA_AAC, camaSintetica, pcm16aFlotante, remuestrea, reparteVoz } from "./voz";
import { posterDeVideo } from "./portada-video";

/** ~11 MB el minuto: cabe con el PDF dentro del tope de adjuntos del correo. */
const CAUDAL = 1_500_000;
const CODEC = "avc1.4d401f"; /* H.264 Main 3.1: 1280×720 a 30 fps en cualquier aparato. */

export type PasoVideo = (texto: string) => void;

export type OpcionesVideo = {
  alPaso?: PasoVideo;
  /** La familia de la fuente del informe (Barlow Condensed de next/font lleva un nombre propio). */
  fuente?: string;
};

export function puedeMontarVideo() {
  return typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined" && typeof VideoFrame !== "undefined" && typeof document !== "undefined";
}

/* ------------------------------------------------------------------ */
/*  LA IA: LOCUCIÓN Y VOZ                                             */
/* ------------------------------------------------------------------ */

const conPlazo = <T,>(p: Promise<T>, ms: number, siNo: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(siNo), ms))]);

async function puleLocucion(guion: GuionVideo): Promise<GuionVideo> {
  const escenas = guion.escenas.map((e) => ({ id: e.id, texto: e.locucion, palabras: Math.ceil((e.tipo === "clips" ? e.segundos : SEGUNDOS[e.tipo]) * 2.4) }));

  const r = await conPlazo(
    fetch("/api/informe/video-guion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contexto: guion.titulo, escenas }) })
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null),
    20_000,
    null,
  );

  const lista = (r as { ok?: boolean; locuciones?: { id: string; texto: string }[] } | null)?.locuciones;

  if (!lista) return guion;

  const porId = new Map(lista.map((l) => [l.id, l.texto]));

  return { ...guion, escenas: guion.escenas.map((e) => ({ ...e, locucion: porId.get(e.id)?.trim() || e.locucion })) };
}

async function pideVoz(guion: GuionVideo): Promise<{ pistas: (Float32Array | null)[] | null; motivo?: string }> {
  const textos = guion.escenas.map((e) => e.locucion.replace(/\s+/g, " ").trim());

  const r = await conPlazo(
    fetch("/api/informe/voz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ textos }) }).catch(() => null),
    58_000,
    null,
  );

  if (!r) return { pistas: null, motivo: "La IA de voz no ha contestado a tiempo." };

  if (!r.ok) {
    const j = (await r.json().catch(() => null)) as { error?: string } | null;

    return { pistas: null, motivo: j?.error ?? `La IA de voz ha fallado (${r.status}).` };
  }

  const bytes = new Uint8Array(await r.arrayBuffer());
  const deFrecuencia = Number(r.headers.get("X-Voz-Frecuencia")) || 24_000;
  const entera = remuestrea(pcm16aFlotante(bytes), deFrecuencia, FRECUENCIA_AAC);

  if (entera.length < FRECUENCIA_AAC * 0.5) return { pistas: null, motivo: "La IA de voz ha devuelto un audio vacío." };

  return { pistas: reparteVoz(entera, textos, FRECUENCIA_AAC) };
}

/* ------------------------------------------------------------------ */
/*  LOS RECURSOS DEL NAVEGADOR                                         */
/* ------------------------------------------------------------------ */

async function cargaImagen(src: string): Promise<ImageBitmap | null> {
  if (!src) return null;

  try {
    const r = await conPlazo(fetch(src), 8000, null);

    if (!r || !r.ok) return null;

    return await createImageBitmap(await r.blob());
  } catch {
    return null;
  }
}

type Clip = { video: HTMLVideoElement; desde: number; sonido?: Float32Array | null };

/** Un `<video>` del bucket listo para pedirle fotogramas; `null` si no se puede abrir (CORS, códec, YouTube). */
async function abreClip(url: string, segundos: number, desdeSegundo?: number, desdeFraccion?: number): Promise<Clip | null> {
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

  /* Un corte preparado empieza donde debe; en un vídeo largo se busca la acción pasada la carátula. */
  const desde =
    typeof desdeFraccion === "number"
      ? Math.max(0, Math.min(video.duration * desdeFraccion, video.duration - segundos))
      : typeof desdeSegundo === "number"
      ? Math.max(0, Math.min(desdeSegundo, video.duration - segundos))
      : video.duration <= segundos + 1
        ? 0
        : Math.max(0, Math.min(video.duration - segundos, video.duration * (video.duration < 30 ? 0.5 : 0.35) - segundos / 2));

  try {
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = 2;
    const prueba = c.getContext("2d")!;
    prueba.drawImage(video, 0, 0, 2, 2);
    prueba.getImageData(0, 0, 1, 1);
  } catch {
    return null;
  }

  return { video, desde };
}

/**
 * El sonido ambiente de un corte (el estadio, el golpeo), a 48 kHz mono: va
 * bajo la voz. `null` si no se puede bajar o descodificar; el vídeo sigue.
 */
async function sonidoDelClip(url: string): Promise<Float32Array | null> {
  if (typeof AudioContext === "undefined") return null;

  try {
    const r = await conPlazo(fetch(url), 12_000, null);

    if (!r || !r.ok) return null;

    const ac = new OfflineAudioContext(1, 1, FRECUENCIA_AAC);
    const buffer = await ac.decodeAudioData(await r.arrayBuffer());
    const salida = new Float32Array(buffer.length);

    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      const datos = buffer.getChannelData(c);

      for (let i = 0; i < datos.length; i += 1) salida[i] += datos[i] / buffer.numberOfChannels;
    }

    return buffer.sampleRate === FRECUENCIA_AAC ? salida : remuestrea(salida, buffer.sampleRate, FRECUENCIA_AAC);
  } catch {
    return null;
  }
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

export type VideoMontado = {
  blob: Blob;
  segundos: number;
  conVoz: boolean;
  escenas: number;
  /** Por qué va sin voz, si va sin ella. */
  motivoSinVoz?: string;
  /** El póster (JPEG en data URL): la portada con el botón de reproducir, para el correo y el PDF. */
  poster?: string;
};

/** Monta el vídeo resumen de un guion. `alPaso` recibe el texto de progreso para la pantalla. */
export async function montaVideoInforme(guionCrudo: GuionVideo, opciones: OpcionesVideo = {}): Promise<VideoMontado> {
  if (!puedeMontarVideo()) throw new Error("Este navegador no puede montar vídeo (hace falta Chrome, Edge o Safari 17).");

  const alPaso = opciones.alPaso ?? (() => {});
  const fuente = `${opciones.fuente ? `${opciones.fuente}, ` : ""}"Barlow Condensed", "Segoe UI", Arial, sans-serif`;

  alPaso("guion…");
  const guion = await puleLocucion(guionCrudo);

  alPaso("voz…");
  const { pistas, motivo: motivoSinVoz } = await pideVoz(guion);
  const escenas = reparteEscenas(guion, pistas, FRECUENCIA_AAC, SEGUNDOS_MAXIMOS);
  const total = escenas.reduce((s, x) => s + x.segundos, 0);

  alPaso("fotos y cortes…");
  const rec: Recursos = { imagenes: new Map() };
  const clips = new Map<string, Clip | null>();

  await Promise.all(
    escenas.map(async ({ escena: e, segundos }) => {
      if (e.tipo === "imagen") rec.imagenes.set(e.id, await cargaImagen(e.src));
      else if (e.tipo === "portada") {
        rec.imagenes.set(`${e.id}:nosotros`, await cargaImagen(e.escudoNosotros ?? ""));
        rec.imagenes.set(`${e.id}:rival`, await cargaImagen(e.escudoRival ?? ""));
      } else if (e.tipo === "once" || e.tipo === "vigilar") {
        await Promise.all(e.jugadores.map(async (j: JugadorEscena, i: number) => rec.imagenes.set(`${e.id}:${i}`, await cargaImagen(j.foto))));
      } else if (e.tipo === "clips") {
        await Promise.all(
          e.cortes.map(async (c: Corte, i: number) => {
            const [clip, sonido] = await Promise.all([abreClip(c.url, limitesDeCortes(e, segundos)[i].dura, c.desde, c.desdeFraccion), sonidoDelClip(c.url)]);

            clips.set(`${e.id}:${i}`, clip ? { ...clip, sonido } : null);
          }),
        );
      }
    }),
  );

  if ("fonts" in document) {
    try {
      await conPlazo<unknown>(Promise.all([document.fonts.load(`700 60px ${fuente}`), document.fonts.load(`400 24px ${fuente}`)]), 2000, null);
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

  const frecuencia = FRECUENCIA_AAC;
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

  /* ---- la pista de sonido entera: la cama debajo, la voz de cada escena en su sitio ---- */
  alPaso("sonido…");
  const totalMuestras = Math.ceil(total * frecuencia);
  const arranques: number[] = [];
  let inicio = 0;

  for (const x of escenas) {
    arranques.push(inicio);
    inicio += x.segundos;
  }

  const pista = new Float32Array(totalMuestras);

  pista.set(camaSintetica(total, arranques.slice(1), frecuencia).subarray(0, totalMuestras));

  /* El sonido ambiente de cada corte, bajo y con fundidos, en el sitio donde se ve. */
  escenas.forEach((x, k) => {
    if (x.escena.tipo !== "clips") return;

    const limites = limitesDeCortes(x.escena, x.segundos);

    x.escena.cortes.forEach((corte, i) => {
      const clip = clips.get(`${x.escena.id}:${i}`);

      if (!clip?.sonido || corte.repeticion) return;

      const d0 = Math.floor((arranques[k] + limites[i].desde) * frecuencia);
      const salto = Math.floor(clip.desde * frecuencia);
      const n = Math.min(clip.sonido.length - salto, Math.floor(limites[i].dura * frecuencia), totalMuestras - d0);

      for (let j = 0; j < n; j += 1) {
        const env = Math.min(1, j / (0.3 * frecuencia), (n - j) / (0.3 * frecuencia));

        pista[d0 + j] += clip.sonido[salto + j] * 0.35 * env;
      }
    });
  });

  escenas.forEach((x, k) => {
    if (!x.voz) return;

    const desde = Math.floor(arranques[k] * frecuencia);

    for (let i = 0; i < x.voz.length && desde + i < totalMuestras; i += 1) pista[desde + i] = Math.max(-1, Math.min(1, pista[desde + i] + x.voz[i] * 0.95));
  });

  for (let i = 0; i < totalMuestras; i += 1024) {
    const n = Math.min(1024, totalMuestras - i);
    const datos = new AudioData({ format: "f32-planar", sampleRate: frecuencia, numberOfFrames: n, numberOfChannels: 1, timestamp: Math.round((i / frecuencia) * 1e6), data: pista.subarray(i, i + n) });

    sonido.encode(datos);
    datos.close();
  }

  /* ---- los fotogramas ---- */
  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d", { alpha: false })!;
  const grano = document.createElement("canvas");
  grano.width = 256;
  grano.height = 256;
  rellenaGrano(grano.getContext("2d")!);
  const totalFotogramas = Math.round(total * FPS);
  let fotograma = 0;
  /* El fotograma del póster: la portada a los 2,4 s, con los escudos y el título ya dentro. */
  let fotoPoster: HTMLCanvasElement | null = null;

  for (const [k, x] of escenas.entries()) {
    alPaso(`escena ${k + 1}/${escenas.length}…`);

    const cuantos = k === escenas.length - 1 ? totalFotogramas - fotograma : Math.round(x.segundos * FPS);
    const e = x.escena;

    for (let i = 0; i < cuantos; i += 1) {
      if (fallo) throw fallo;

      const t = i / FPS;
      let cuadro: HTMLVideoElement | null = null;

      if (e.tipo === "clips") {
        const { k: c, tc } = corteEn(e, t, x.segundos);
        const clip = clips.get(`${e.id}:${c}`);

        if (clip) {
          await buscaFotograma(clip.video, clip.desde + tc * ((e.cortes[c] as { velocidad?: number }).velocidad ?? 1));
          cuadro = clip.video;
        }
      }

      pintaFotograma(ctx, grano, fuente, guion.titulo, rec, { medida: x, t, global: arranques[k] + t, progreso: fotograma / totalFotogramas, restante: (cuantos - i) / FPS, cuadro });

      if (k === 0 && i === Math.min(cuantos - 1, Math.round(2.4 * FPS))) {
        fotoPoster = document.createElement("canvas");
        fotoPoster.width = ANCHO;
        fotoPoster.height = ALTO;
        fotoPoster.getContext("2d")!.drawImage(lienzo, 0, 0);
      }

      const marca = new VideoFrame(lienzo, { timestamp: Math.round((fotograma / FPS) * 1e6), duration: Math.round(1e6 / FPS) });

      codificador.encode(marca, { keyFrame: fotograma % (FPS * 2) === 0 });
      marca.close();
      fotograma += 1;

      while (codificador.encodeQueueSize > 8) await respira();
    }
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

  for (const img of rec.imagenes.values()) img?.close();

  if (fallo) throw fallo;

  const poster = await posterDeVideo(fotoPoster, { segundos: total, rotulo: guion.titulo }).catch(() => undefined);

  return { blob: muxor.cierra(), segundos: Math.round(total), conVoz: Boolean(pistas?.some(Boolean)), escenas: escenas.length, motivoSinVoz, poster };
}
