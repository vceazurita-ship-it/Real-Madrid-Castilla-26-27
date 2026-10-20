/*
|--------------------------------------------------------------------------
| EL VÍDEO RESUMEN DEL INFORME, MONTADO EN EL NAVEGADOR
|--------------------------------------------------------------------------
|
| Convierte un `GuionVideo` en un MP4 (H.264 + AAC) en 1920×1080 a 30 fps,
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
| Tres pasos, y el primero puede fallar sin que el vídeo deje de salir:
|   1. `/api/informe/video-guion` pule los textos de pantalla (Gemini, sin coste).
|   2. La banda sonora se compone aquí (`musica.ts`): desde el 13/10/2026 el
|      vídeo no lleva voz en off.
|   3. Cada escena se pinta fotograma a fotograma y se codifica.
*/

import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";

import { ALTO, ALTO_HD, ANCHO, ANCHO_HD, FPS, SEGUNDO_POSTER, corteEn, estiramiento, limitesDeCortes, palabrasDeEscena, pintaFotograma, rellenaGrano, reparteEscenas, type Recursos } from "./dibujo";
import { SEGUNDOS_MAXIMOS, soloCompletas, type Corte, type Escena, type GuionVideo, type JugadorEscena } from "./guion";
import { FRECUENCIA_AAC, remuestrea } from "./voz";
import { bandaSonora, masteriza, rmsConPuerta } from "./musica";
import { posterDeVideo } from "./portada-video";
import { FotogramasCorte } from "./fotogramas-corte";
import { ALTO_V, ALTO_V_HD, ANCHO_V, ANCHO_V_HD, paraVertical, pintaFotogramaVertical } from "./vertical";

/*
| DOS VÍDEOS EN UNA PASADA (15/10/2026):
|   - El BUENO, en 1920×1080, va al bucket y el correo lo enlaza (póster, botón
|     y QR). Su tope es el del bucket: 50 MB por fichero; se apunta a 40 MB
|     (el codificador del navegador se pasa algo: 6 Mb/s en 60 s dieron 45,6 MB).
|     Hasta 5 Mb/s (un vídeo de un minuto); uno de 2:30 sale a ~2,1 Mb/s.
|   - La copia LIGERA, en 1280×720 y ~13 MB, va adjunta para verla sin
|     conexión: cabe con el PDF dentro de los 16 MB de adjuntos del correo.
| Los fotogramas se pintan una vez (en HD) y la copia ligera es ese lienzo
| reducido: cuesta una segunda codificación, no un segundo dibujo.
*/
const CAUDAL = 1_500_000;
const CAUDAL_MINIMO = 750_000;
const BYTES_OBJETIVO = 13 * 1024 * 1024;
const CAUDAL_SONIDO = 96_000;
const CAUDAL_HD = 5_000_000;
const CAUDAL_HD_MINIMO = 2_000_000;
const BYTES_OBJETIVO_HD = 40 * 1024 * 1024;

/** El caudal de la copia ligera (la adjunta): ~11 MB el minuto y ~13 MB hasta 2:30. */
export const caudalPara = (segundos: number) => Math.round(Math.max(CAUDAL_MINIMO, Math.min(CAUDAL, (BYTES_OBJETIVO * 8) / Math.max(1, segundos) - CAUDAL_SONIDO)));
/** El caudal del vídeo en Full HD (el enlazado), para quedarse bajo los 50 MB del bucket. */
export const caudalHdPara = (segundos: number) => Math.round(Math.max(CAUDAL_HD_MINIMO, Math.min(CAUDAL_HD, (BYTES_OBJETIVO_HD * 8) / Math.max(1, segundos) - CAUDAL_SONIDO)));
const CODEC = "avc1.4d401f"; /* H.264 Main 3.1: 1280×720 a 30 fps en cualquier aparato. */
/* H.264 High 4.0 (o Main 4.0 si el codificador no da High): 1920×1080 a 30 fps. */
const CODECS_HD = ["avc1.640028", "avc1.4d4028"];

/** El primer códec de HD que este navegador sabe codificar; `null` si ninguno (entonces sale sólo en 720p). */
async function codecHd(caudal: number, ancho = ANCHO_HD, alto = ALTO_HD) {
  for (const codec of CODECS_HD) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width: ancho, height: alto, bitrate: caudal, framerate: FPS, avc: { format: "avc" } });

      if (r.supported) return codec;
    } catch {
      /* Probamos el siguiente. */
    }
  }

  return null;
}

export type PasoVideo = (texto: string) => void;

export type OpcionesVideo = {
  alPaso?: PasoVideo;
  /** La familia de la fuente del informe (Barlow Condensed de next/font lleva un nombre propio). */
  fuente?: string;
  /**
   * Un vídeo ENTERO que va detrás del guion (18/10/2026, el de ABP para los
   * jugadores): a pantalla completa, con su propio sonido, sin música ni
   * rótulos encima. El guion queda como entrada corta (sin estirar a un minuto).
   */
  cola?: { url: string } | null;
  /** Lo más que dura el guion (sin la cola). */
  tope?: number;
  /** Lo menos que dura el guion: sin él, un minuto (`SEGUNDOS_MINIMOS`). */
  minimo?: number;
  /**
   * En vertical, 1080×1920 (21/10/2026): la pieza para jugadores, para verla
   * en el móvil. Sólo entran las escenas con composición vertical
   * (`vertical.ts`) y la portada va delante (es la miniatura de WhatsApp).
   */
  vertical?: boolean;
};

/* Con cola, un solo vídeo (el enlazado): todo el margen del bucket para él. */
const BYTES_OBJETIVO_COLA = 44 * 1024 * 1024;
const caudalColaPara = (segundos: number) => Math.round(Math.max(600_000, Math.min(CAUDAL_HD, (BYTES_OBJETIVO_COLA * 8) / Math.max(1, segundos) - CAUDAL_SONIDO)));

export function puedeMontarVideo() {
  return typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined" && typeof VideoFrame !== "undefined" && typeof document !== "undefined";
}

/* ------------------------------------------------------------------ */
/*  LA IA: LOCUCIÓN Y VOZ                                             */
/* ------------------------------------------------------------------ */

const conPlazo = <T,>(p: Promise<T>, ms: number, siNo: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(siNo), ms))]);

async function puleLocucion(guion: GuionVideo): Promise<GuionVideo> {
  const factor = estiramiento(guion);
  const escenas = guion.escenas.map((e) => ({ id: e.id, texto: e.locucion, palabras: palabrasDeEscena(e, factor) }));

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

type Clip = { fuente: FotogramasCorte; desde: number; sonido?: Float32Array | null };

/*
| LOS CORTES, DESDE MEMORIA (15/10/2026). Antes cada corte se abría como un
| `<video>` remoto y se le pedía cada fotograma con 0,6 s de plazo; con veinte
| cortes a la vez Chrome no los bajaba todos (limita las descargas de vídeo
| simultáneas) y, aunque llegaran, un `<video>` parado no siempre tiene la
| imagen (con la pestaña en segundo plano, nunca): la escena salía con el
| título y sin jugada. Ahora se baja el fichero entero —una vez por URL,
| cuatro a la vez— y se descodifica con WebCodecs (`fotogramas-corte.ts`).
| El sonido sale del mismo fichero.
*/
const bajados = new Map<string, Promise<Blob | null>>();

function bajaCorte(url: string) {
  let p = bajados.get(url);

  if (!p) {
    p = conPlazo(
      fetch(url)
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null),
      45_000,
      null,
    );
    bajados.set(url, p);
  }

  return p;
}

/** Hace `trabajo` con cada elemento, `cuantos` a la vez. */
async function enTandas<T>(lista: T[], cuantos: number, trabajo: (x: T) => Promise<void>) {
  let i = 0;

  await Promise.all(
    Array.from({ length: Math.min(cuantos, lista.length) }, async () => {
      while (i < lista.length) await trabajo(lista[i++]);
    }),
  );
}

/** Un corte listo para pedirle fotogramas, con su sonido; `null` si no se puede bajar o abrir (YouTube, Hudl, HEVC…). */
async function abreClip(url: string, segundos: number, desdeSegundo?: number, desdeFraccion?: number): Promise<Clip | null> {
  const blob = await bajaCorte(url);

  if (!blob || !blob.size) return null;

  const fuente = await FotogramasCorte.abre(blob);

  if (!fuente) return null;

  const duracion = fuente.duracion;

  /* Un corte preparado empieza donde debe; en un vídeo largo se busca la acción pasada la carátula. */
  const desde =
    typeof desdeFraccion === "number"
      ? Math.max(0, Math.min(duracion * desdeFraccion, duracion - segundos))
      : typeof desdeSegundo === "number"
      ? Math.max(0, Math.min(desdeSegundo, duracion - segundos))
      : duracion <= segundos + 1
        ? 0
        : Math.max(0, Math.min(duracion - segundos, duracion * (duracion < 30 ? 0.5 : 0.35) - segundos / 2));

  /* Que de verdad salga imagen: si no se descodifica ni el primer fotograma, el corte no entra. */
  const prueba = await conPlazo(fuente.en(desde), 15_000, null);

  fuente.cierra();

  if (!prueba) return null;

  return { fuente, desde, sonido: await sonidoDelClip(blob) };
}

/**
 * El sonido ambiente de un corte (el estadio, el golpeo), a 48 kHz mono: va
 * bajo la música. `null` si no se puede descodificar; el vídeo sigue.
 */
async function sonidoDelClip(blob: Blob): Promise<Float32Array | null> {
  if (typeof OfflineAudioContext === "undefined") return null;

  try {
    const ac = new OfflineAudioContext(1, 1, FRECUENCIA_AAC);
    const buffer = await ac.decodeAudioData(await blob.arrayBuffer());
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

/**
 * Abre todos los cortes del guion y quita los que no se pueden ver; una
 * escena que se queda sin cortes no sale (el guion no anuncia jugadas que
 * luego no están). Lo que dura cada escena se rehace con los que quedan.
 */
async function conCortesVisibles(guion: GuionVideo, alPaso: PasoVideo): Promise<{ guion: GuionVideo; abiertos: Map<Corte, Clip> }> {
  const abiertos = new Map<Corte, Clip>();
  const todos = guion.escenas.flatMap((e) => (e.tipo === "clips" ? e.cortes.map((c) => ({ c, e })) : []));
  let hechos = 0;

  await enTandas(todos, 4, async ({ c, e }) => {
    const dura = (c as Corte & { segundos?: number }).segundos || e.segundos / Math.max(1, e.cortes.length);
    const clip = await abreClip(c.url, dura, c.desde, c.desdeFraccion);

    if (clip) abiertos.set(c, clip);

    hechos += 1;
    alPaso(`cortes ${hechos}/${todos.length}…`);
  });

  const escenas = guion.escenas.flatMap((e): Escena[] => {
    if (e.tipo !== "clips") return [e];

    const quedan = e.cortes.filter((c) => abiertos.has(c));

    if (!quedan.length) return [];

    if (quedan.length === e.cortes.length) return [e];

    const dura = (c: Corte) => (c as Corte & { segundos?: number }).segundos || e.segundos / e.cortes.length;

    return [{ ...e, cortes: quedan, segundos: quedan.reduce((s, c) => s + dura(c), 0) }];
  });

  const fuera = todos.length - abiertos.size;

  if (fuera) console.warn(`[vídeo] ${fuera} de ${todos.length} cortes no se han podido abrir: salen del vídeo`);

  return { guion: { ...guion, escenas }, abiertos };
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
  /** El vídeo en Full HD (o en 720p si el navegador no codifica 1080): va al bucket y se enlaza. */
  blob: Blob;
  /** La copia ligera en 720p para adjuntar; `null` si el vídeo ya sale en 720p (entonces el adjunto es `blob`). */
  ligero: Blob | null;
  segundos: number;
  conVoz: boolean;
  escenas: number;
  /** Por qué va sin voz, si va sin ella. */
  motivoSinVoz?: string;
  /** El póster (JPEG en data URL): la portada con el botón de reproducir, para el correo y el PDF. */
  poster?: string;
};

/** Monta el vídeo resumen de un guion. `alPaso` recibe el texto de progreso para la pantalla. */
export async function montaVideoInforme(guionEntrada: GuionVideo, opciones: OpcionesVideo = {}): Promise<VideoMontado> {
  if (!puedeMontarVideo()) throw new Error("Este navegador no puede montar vídeo (hace falta Chrome, Edge o Safari 17).");

  /* La comprobación previa (21/10/2026): ninguna escena a medias, venga el guion de donde venga. */
  const guionCompleto: GuionVideo = { ...guionEntrada, escenas: soloCompletas(guionEntrada.escenas) };
  const vertical = Boolean(opciones.vertical);
  const guionCrudo = vertical ? paraVertical(guionCompleto) : guionCompleto;
  /* Las medidas del vídeo: el lienzo lógico (y la copia ligera) y el de alta definición. */
  const W = vertical ? ANCHO_V : ANCHO;
  const H = vertical ? ALTO_V : ALTO;
  const W_HD = vertical ? ANCHO_V_HD : ANCHO_HD;
  const H_HD = vertical ? ALTO_V_HD : ALTO_HD;

  const alPaso = opciones.alPaso ?? (() => {});
  const fuente = `${opciones.fuente ? `${opciones.fuente}, ` : ""}"Barlow Condensed", "Segoe UI", Arial, sans-serif`;

  /* Los cortes y el texto de la IA a la vez (16/10/2026): la IA puede tardar hasta 20 s y no depende de los cortes. */
  alPaso("cortes…");
  const [{ guion: conCortes, abiertos }, pulido] = await Promise.all([conCortesVisibles(guionCrudo, alPaso), puleLocucion(guionCrudo)]);
  const pulidas = new Map(pulido.escenas.map((e) => [e.id, e.locucion]));
  const guion: GuionVideo = { ...conCortes, escenas: conCortes.escenas.map((e) => ({ ...e, locucion: pulidas.get(e.id) ?? e.locucion })) };

  /* Sin voz en off desde el 13/10/2026: música compuesta (musica.ts) y el texto en pantalla. */
  const pistas = null;
  const escenas = reparteEscenas(guion, pistas, FRECUENCIA_AAC, opciones.tope ?? SEGUNDOS_MAXIMOS, opciones.cola ? 0 : opciones.minimo);
  const totalGuion = escenas.reduce((s, x) => s + x.segundos, 0);

  /* La cola: se baja entera y se descodifica como un corte; si no se puede leer, no hay vídeo (es lo principal). */
  let cola: { fuente: FotogramasCorte; sonido: Float32Array | null; segundos: number } | null = null;

  if (opciones.cola?.url) {
    alPaso("bajando tu vídeo…");
    const blob = await conPlazo(
      fetch(opciones.cola.url)
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null),
      180_000,
      null,
    );
    const fuenteCola = blob?.size ? await FotogramasCorte.abre(blob) : null;

    if (!blob || !fuenteCola) throw new Error("Tu vídeo no se puede leer en este navegador (prueba con Chrome o Edge).");

    cola = { fuente: fuenteCola, sonido: await sonidoDelClip(blob), segundos: fuenteCola.duracion };
  }

  const total = totalGuion + (cola?.segundos ?? 0);

  alPaso("fotos y cortes…");
  const rec: Recursos = { imagenes: new Map() };
  const clips = new Map<string, Clip | null>();

  await Promise.all(
    escenas.map(async ({ escena: e }) => {
      if (e.tipo === "imagen") rec.imagenes.set(e.id, await cargaImagen(e.src));
      else if (e.tipo === "portada") {
        rec.imagenes.set(`${e.id}:nosotros`, await cargaImagen(e.escudoNosotros ?? ""));
        rec.imagenes.set(`${e.id}:rival`, await cargaImagen(e.escudoRival ?? ""));
      } else if (e.tipo === "once" || e.tipo === "vigilar") {
        await Promise.all(e.jugadores.map(async (j: JugadorEscena, i: number) => rec.imagenes.set(`${e.id}:${i}`, await cargaImagen(j.foto))));
      } else if (e.tipo === "clips") {
        /* Ya abiertos (conCortesVisibles): el reparto y la IA copian las escenas pero no los cortes, así que se casan por el propio corte. */
        e.cortes.forEach((c: Corte, i: number) => clips.set(`${e.id}:${i}`, abiertos.get(c) ?? null));
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

  /* ---- codificadores y muxores: el de HD y el de la copia ligera ---- */
  let fallo: Error | null = null;

  const codificadorPara = (muxor: MuxorMp4, ancho: number, alto: number) =>
    new VideoEncoder({
      output: (trozo, metadatos) => {
        const descripcion = metadatos?.decoderConfig?.description;

        if (descripcion) muxor.configuraVideo({ ancho, alto, descripcion: copia(descripcion) });

        const datos = new Uint8Array(trozo.byteLength) as Bytes;
        trozo.copyTo(datos);
        muxor.añadeVideo(datos, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / FPS, trozo.type === "key");
      },
      error: (e) => {
        fallo = e instanceof Error ? e : new Error(String(e));
      },
    });

  /* El de Full HD, si el navegador lo sabe hacer; si no, el vídeo sale en 720p como antes. */
  const caudalHd = cola ? caudalColaPara(total) : caudalHdPara(total);
  const codec = await codecHd(caudalHd, W_HD, H_HD);
  const muxorHd = codec ? new MuxorMp4() : null;
  const codificadorHd = muxorHd ? codificadorPara(muxorHd, W_HD, H_HD) : null;

  codificadorHd?.configure({ codec: codec!, width: W_HD, height: H_HD, bitrate: caudalHd, framerate: FPS, latencyMode: "quality", avc: { format: "avc" } });

  /* La copia ligera (la adjunta del correo). Con cola el vídeo sólo va enlazado: no se hace, salvo que no haya HD. */
  const muxor = cola && codificadorHd ? null : new MuxorMp4();
  const codificador = muxor ? codificadorPara(muxor, W, H) : null;

  codificador?.configure({ codec: CODEC, width: W, height: H, bitrate: cola ? caudalColaPara(total) : caudalPara(total), framerate: FPS, latencyMode: "quality", avc: { format: "avc" } });
  const muxores = [muxor, muxorHd].filter((m): m is MuxorMp4 => Boolean(m));

  const frecuencia = FRECUENCIA_AAC;
  let enMuestras = 0;

  const sonido = new AudioEncoder({
    output: (trozo, metadatos) => {
      const descripcion = metadatos?.decoderConfig?.description;

      if (descripcion) for (const m of muxores) m.configuraAudio({ frecuencia, canales: 1, descripcion: copia(descripcion) });

      const datos = new Uint8Array(trozo.byteLength) as Bytes;
      trozo.copyTo(datos);

      const cuantas = Math.round(((trozo.duration || 0) * frecuencia) / 1e6) || 1024;
      for (const m of muxores) m.añadeAudio(datos, enMuestras, cuantas);
      enMuestras += cuantas;
    },
    error: (e) => {
      fallo = e instanceof Error ? e : new Error(String(e));
    },
  });

  sonido.configure({ codec: "mp4a.40.2", sampleRate: frecuencia, numberOfChannels: 1, bitrate: CAUDAL_SONIDO });

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

  /* La música: se aparta bajo los cortes del partido y marca cada gol (el remate cae a ~5,5 s del corte). */
  const tramosConSonido: [number, number][] = [];
  const golpes: number[] = [];

  escenas.forEach((x, k) => {
    if (x.escena.tipo !== "clips") return;

    tramosConSonido.push([arranques[k], arranques[k] + x.segundos]);

    const limites = limitesDeCortes(x.escena, x.segundos);

    x.escena.cortes.forEach((c, i) => {
      if (!c.repeticion && /^gol/.test((c as Corte & { tipo?: string }).tipo ?? "")) golpes.push(arranques[k] + limites[i].desde + Math.min(5.5, limites[i].dura * 0.6));
    });
  });

  const muestrasGuion = Math.min(totalMuestras, Math.ceil(totalGuion * frecuencia));

  pista.set(bandaSonora({ total: totalGuion, cortes: arranques.slice(1), tramosConSonido, golpes, frecuencia }).subarray(0, muestrasGuion));

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

        pista[d0 + j] += clip.sonido[salto + j] * 0.5 * env;
      }
    });
  });

  /*
  | Se masteriza el guion; la cola lleva su sonido tal cual (con un fundido de
  | entrada para no dar un golpe). La música de la entrada se deja al nivel de
  | la cola: con el vídeo del 18/10 la música iba a −15 dB y su vídeo a −30, y
  | al entrar parecía que se había quitado el sonido.
  */
  if (cola) {
    /* El nivel de su vídeo medido igual que la mezcla (sin silencios: 20/10/2026), para que la entrada y la cola suenen parejas. */
    const rmsCola = cola.sonido?.length ? rmsConPuerta(cola.sonido, frecuencia) : 0;

    masteriza(pista.subarray(0, muestrasGuion), rmsCola > 0.005 ? Math.min(0.19, Math.max(0.04, rmsCola * 1.3)) : undefined, frecuencia);
  } else masteriza(pista, undefined, frecuencia);

  if (cola?.sonido) {
    const n = Math.min(cola.sonido.length, totalMuestras - muestrasGuion);
    /* Medio segundo (20/10/2026; antes 0,25 s): pasar de la música al sonido del vídeo daba un golpe. */
    const fundido = 0.5 * frecuencia;

    for (let j = 0; j < n; j += 1) pista[muestrasGuion + j] = cola.sonido[j] * Math.min(1, j / fundido);
  }

  for (let i = 0; i < totalMuestras; i += 1024) {
    const n = Math.min(1024, totalMuestras - i);
    const datos = new AudioData({ format: "f32-planar", sampleRate: frecuencia, numberOfFrames: n, numberOfChannels: 1, timestamp: Math.round((i / frecuencia) * 1e6), data: pista.subarray(i, i + n) });

    sonido.encode(datos);
    datos.close();
  }

  /* ---- los fotogramas ---- */
  /* Se pinta en HD (dibujo.ts escala sus medidas de 1280 al lienzo) y la copia ligera es ese lienzo reducido. */
  const lienzo = document.createElement("canvas");
  lienzo.width = codificadorHd ? W_HD : W;
  lienzo.height = codificadorHd ? H_HD : H;
  const ctx = lienzo.getContext("2d", { alpha: false })!;
  const reducido = codificadorHd && codificador ? document.createElement("canvas") : null;
  const ctxReducido = reducido?.getContext("2d", { alpha: false }) ?? null;

  if (reducido && ctxReducido) {
    reducido.width = W;
    reducido.height = H;
    ctxReducido.imageSmoothingQuality = "high";
  }
  const grano = document.createElement("canvas");
  grano.width = 256;
  grano.height = 256;
  rellenaGrano(grano.getContext("2d")!);
  const totalFotogramas = Math.round(total * FPS);
  const fotogramasGuion = Math.round(totalGuion * FPS);
  let fotograma = 0;
  /*
  | El fotograma del póster: la PORTADA (escudos, rival, jornada y la idea)
  | ya entera, no la primera escena (20/10/2026: desde que el vídeo abre con el
  | gancho, el póster del correo era un «2º» sobre fondo oscuro).
  */
  const escenaPoster = Math.max(0, escenas.findIndex((x) => x.escena.tipo === "portada"));
  let fotoPoster: HTMLCanvasElement | null = null;
  let clipEnCurso: Clip | null = null;

  /* Cada fotograma pintado, a los codificadores (el HD y, si va, la copia ligera reducida). */
  const codifica = async () => {
    const tiempo = { timestamp: Math.round((fotograma / FPS) * 1e6), duration: Math.round(1e6 / FPS) };
    const clave = { keyFrame: fotograma % (FPS * 2) === 0 };

    if (codificadorHd) {
      const hd = new VideoFrame(lienzo, tiempo);

      codificadorHd.encode(hd, clave);
      hd.close();
    }

    if (codificador) {
      if (reducido && ctxReducido) ctxReducido.drawImage(lienzo, 0, 0, W, H);

      const marca = new VideoFrame(reducido ?? lienzo, tiempo);

      codificador.encode(marca, clave);
      marca.close();
    }

    fotograma += 1;

    while ((codificador?.encodeQueueSize ?? 0) > 8 || (codificadorHd?.encodeQueueSize ?? 0) > 8) await respira();
  };

  for (const [k, x] of escenas.entries()) {
    alPaso(`escena ${k + 1}/${escenas.length}…`);

    const cuantos = k === escenas.length - 1 ? fotogramasGuion - fotograma : Math.round(x.segundos * FPS);
    const e = x.escena;

    for (let i = 0; i < cuantos; i += 1) {
      if (fallo) throw fallo;

      const t = i / FPS;
      let cuadro: VideoFrame | null = null;

      if (e.tipo === "clips") {
        const { k: c, tv } = corteEn(e, t, x.segundos);
        const clip = clips.get(`${e.id}:${c}`);

        /* Al pasar de corte, el anterior suelta su descodificador. */
        if (clip && clipEnCurso && clipEnCurso !== clip) clipEnCurso.fuente.cierra();

        if (clip) {
          clipEnCurso = clip;
          cuadro = await clip.fuente.en(clip.desde + tv * ((e.cortes[c] as { velocidad?: number }).velocidad ?? 1));
        }
      }

      const f = { medida: x, t, global: arranques[k] + t, progreso: fotograma / totalFotogramas, restante: (cuantos - i) / FPS, cuadro, marcas: arranques.slice(1).map((a) => a / total) };

      if (vertical) pintaFotogramaVertical(ctx, grano, fuente, rec, f);
      else pintaFotograma(ctx, grano, fuente, guion.titulo, rec, f);

      if (k === escenaPoster && i === Math.min(cuantos - 1, Math.round(SEGUNDO_POSTER * FPS))) {
        fotoPoster = document.createElement("canvas");
        fotoPoster.width = W;
        fotoPoster.height = H;
        fotoPoster.getContext("2d")!.drawImage(lienzo, 0, 0, W, H);
      }

      await codifica();
    }
  }

  /* La cola: el vídeo entero a pantalla completa (encajado, sin recortar), saliendo del fondo del informe. */
  if (cola) {
    clipEnCurso?.fuente.cierra();

    const cuantos = totalFotogramas - fotograma;
    const W = lienzo.width;
    const H = lienzo.height;

    for (let i = 0; i < cuantos; i += 1) {
      if (fallo) throw fallo;
      if (i % FPS === 0) alPaso(`tu vídeo ${Math.round((i / cuantos) * 100)} %…`);

      const t = i / FPS;
      const cuadro = await cola.fuente.en(t);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      if (cuadro) {
        const vw = cuadro.displayWidth;
        const vh = cuadro.displayHeight;
        const e = Math.min(W / vw, H / vh);

        ctx.drawImage(cuadro, (W - vw * e) / 2, (H - vh * e) / 2, vw * e, vh * e);
      }

      if (t < 0.5) {
        ctx.globalAlpha = 1 - t / 0.5;
        ctx.fillStyle = "#08111F";
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      await codifica();
    }

    cola.fuente.cierra();
  }

  alPaso("cerrando el vídeo…");
  await Promise.all([codificador?.flush(), codificadorHd?.flush(), sonido.flush()]);
  codificador?.close();
  codificadorHd?.close();
  sonido.close();

  for (const c of abiertos.values()) c.fuente.cierra();

  bajados.clear();

  for (const img of rec.imagenes.values()) img?.close();

  if (fallo) throw fallo;

  /* En vertical, el póster es la portada tal cual (la miniatura de WhatsApp); el de 16:9 lleva su botón y su rótulo. */
  const poster = vertical ? fotoPoster?.toDataURL("image/jpeg", 0.85) : await posterDeVideo(fotoPoster, { segundos: total, rotulo: guion.titulo }).catch(() => undefined);

  const ligero = muxor ? muxor.cierra() : null;
  const hd = muxorHd ? muxorHd.cierra() : null;
  /* Si el HD se pasara del tope del bucket (50 MB), no se podría subir: va la copia ligera como vídeo único. */
  const hdCabe = hd && hd.size < 49 * 1024 * 1024;

  if (hd && !hdCabe) console.warn(`[vídeo] el HD pesa ${(hd.size / 1048576).toFixed(1)} MB y no cabe en el bucket${ligero ? ": va el de 720p" : ""}`);

  return { blob: hdCabe || !ligero ? hd! : ligero, ligero: hdCabe ? ligero : null, segundos: Math.round(total), conVoz: false, escenas: escenas.length, poster };
}
