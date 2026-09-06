"use client";

/**
 * Cortar el partido **aquí**, en el navegador.
 *
 * El camino de siempre —ffmpeg en el servidor leyendo el fichero— no existe
 * cuando la app está desplegada: en Vercel no hay carpeta de partidos, el
 * cuerpo de una petición no pasa de 4,5 MB (así que el vídeo no se puede
 * subir: son gigas) y una función se corta a los 300 s. Un partido en el
 * portátil del analista y la app en internet no se podían juntar, y ése es
 * justo el caso normal.
 *
 * Aquí no se sube nada y no se le pide nada al servidor.
 *
 * ---
 *
 * **Hay dos motores, y esta es la puerta de los dos** (`cortaEnElNavegador`,
 * al final del fichero).
 *
 * El bueno es el **rápido**, `lib/coding/rapido.ts`: lee el MP4, saca del
 * fichero sólo las muestras de cada corte y las pasa por WebCodecs. No
 * reproduce nada, así que no cuesta lo que dura el vídeo, y sale MP4.
 *
 * Lo que queda en este fichero es el **motor de respaldo**, que graba la
 * pantalla a tiempo real y es lo que se usa cuando el rápido no puede: un
 * fichero que no es un MP4 legible (un MKV), un códec que este navegador no
 * descodifica, o un navegador sin WebCodecs. Vale para todo porque no
 * necesita entender el fichero: le basta con que el navegador lo reproduzca.
 *
 * Así es como graba:
 *
 * 1. Se pinta cada fotograma del corte en un `<canvas>`.
 * 2. `canvas.captureStream(0)` convierte ese lienzo en una pista de vídeo —a
 *    la que se le empuja un fotograma por cada uno que se pinta— y una mezcla
 *    de WebAudio da la de sonido.
 * 3. `MediaRecorder` graba las dos y devuelve el fichero.
 *
 * Lo que sale es lo mismo que salía del servidor, con las mismas tres formas:
 * un corte suelto, un ZIP con los cortes en carpetas, o el vídeo unificado con
 * la carátula delante. Y las pizarras se queman igual: el vídeo **se para** en
 * el fotograma pintado, se ve el dibujo y sigue limpio.
 *
 * ---
 *
 * **Las tres trampas de grabar así, todas medidas contando los fotogramas del
 * fichero con `ffmpeg -vf showinfo`.** Ninguna avisa: el vídeo sale, se abre, y
 * lo que falta no se ve hasta que alguien lo pone en la sala.
 *
 * 1. **`MediaRecorder` no suelta un byte mientras alguna de sus pistas esté
 *    seca.** El montaje empieza con el vídeo parado —buscando el corte, o
 *    enseñando la carátula—, así que la pista de sonido no daba nada y se
 *    perdían los primeros segundos del primer corte. Por eso el sonido va
 *    mezclado con un `ConstantSource` a cero, que no para nunca.
 * 2. **La primera grabadora de la página tarda unos cinco segundos en
 *    arrancar** (5734 ms contra 1517 ms la segunda). Se paga antes de nada,
 *    con una grabación de mentira que se tira: `calientaCodificador`.
 * 3. **El primer `play()` de un `<video>` recién abierto tarda segundos** en
 *    dar imagen. Se paga también antes, en seco.
 *
 * Y aun con todo eso, no se supone que esté grabando: cada grabación abre con
 * un fundido desde negro y no se le da un fotograma del partido hasta ver que
 * el fichero está creciendo (`preparaGrabadora`).
 *
 * ---
 *
 * Dos cosas que hay que saber de este motor, y que la pantalla dice:
 *
 * - **Va a tiempo real.** Se graba lo que se reproduce, así que un montaje de
 *   cuatro minutos tarda cuatro minutos. Por eso existe el rápido.
 * - **La pestaña tiene que estar delante.** Un navegador congela el pintado de
 *   las pestañas de atrás. Si se cambia de pestaña, esto **para** el vídeo y la
 *   grabación y sigue al volver: el montaje sale entero, sólo tarda más.
 *
 * Por eso el montaje se hace con una pantalla propia encima de todo: enseña lo
 * que se está grabando, lleva la cuenta, se puede cancelar y —de paso— impide
 * que un teclazo cree un clip mientras tanto.
 */

import { creaZip, type Bytes, type EntradaZip } from "@/lib/export/zip";
import { montaRapido, puedeIrRapido } from "@/lib/coding/rapido";
import {
  CORTE_CANCELADO as CANCELADO,
  montaEscenario,
  type PantallaMontaje,
  type ClipNavegador,
  type PeticionNavegador,
  type ResultadoNavegador,
} from "@/lib/coding/pantalla-montaje";

/* ------------------------------------------------------------------ */
/*  QUÉ SABE GRABAR ESTE NAVEGADOR                                     */
/* ------------------------------------------------------------------ */

/*
| **WebM primero, y es una decisión medida, no una preferencia.**
|
| Lo suyo sería MP4: el vídeo acaba en un grupo de WhatsApp o en una
| presentación, y ahí un `.webm` da guerra. Pero el MP4 de `MediaRecorder` no
| se puede usar para esto. Medido en esta máquina, contando los fotogramas del
| fichero con `showinfo`: al empezar a grabar **tira los primeros segundos** y
| sólo entonces se pone en marcha —de tres intentos, uno arrancó a los cinco
| segundos y otro no arrancó en nueve—. Con WebM (VP9/Opus) el primer trozo con
| datos llega a los 500 ms, siempre, y el fichero sale entero.
|
| Un vídeo con los tres primeros segundos comidos no vale para nada, y encima
| no se nota hasta que se abre. Un `.webm` se ve en Chrome, en Edge, en VLC y
| en Windows, y quien necesite MP4 lo tiene en el camino del servidor.
|
| El MP4 se queda al final de la lista por Safari, que sólo sabe grabar en MP4:
| ahí se coge, y el fundido de entrada de `preparaGrabadora` comprueba que de
| verdad esté grabando antes de meter un solo fotograma del partido.
*/
const CANDIDATOS = [
  'video/webm;codecs="vp9,opus"',
  'video/webm;codecs="vp8,opus"',
  "video/webm",
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  "video/mp4",
];

export type FormatoGrabacion = {
  mime: string;
  contenedor: "mp4" | "webm";
};

function primerFormato(lista: readonly string[]): FormatoGrabacion | null {
  if (typeof MediaRecorder === "undefined") return null;

  for (const mime of lista) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return {
        mime,
        contenedor: mime.startsWith("video/mp4") ? "mp4" : "webm",
      };
    }
  }

  return null;
}

export function formatoDeGrabacion() {
  return primerFormato(CANDIDATOS);
}

/** El formato de repuesto: el primero que no use el contenedor que ha fallado. */
function otroFormato(fallido: "mp4" | "webm") {
  return primerFormato(
    CANDIDATOS.filter(
      (mime) => mime.startsWith("video/mp4") === (fallido === "webm"),
    ),
  );
}

/* ------------------------------------------------------------------ */
/*  LOS NÚMEROS DE LA GRABACIÓN                                        */
/* ------------------------------------------------------------------ */

/** Cada cuánto suelta la grabadora un trozo. Corto, para enterarse antes. */
const TROZO_MS = 200;

/**
 * Lo que se la deja en marcha antes de darle el primer fotograma.
 *
 * Corto a propósito: **este rato sale en el vídeo**. La pista de sonido empieza
 * a manar en cuanto arranca la grabadora —para eso está el silencio de
 * `ConstantSource`—, así que el reloj del fichero corre aunque no haya imagen,
 * y un calentón largo sería una pantalla en negro al principio de cada corte.
 */
const CALENTON_MS = 250;

/** El fundido de entrada, que además prueba que está grabando. */
const FUNDIDO_MS = 1200;

/**
 * Lo que tiene que pesar lo grabado para dar el fundido por bueno.
 *
 * Separa «vivo» de «muerto», que es lo único que hace falta: un fundido desde
 * negro que ha entrado en el fichero pesa decenas de kilobytes, y una
 * grabación que no ha arrancado pesa 36 bytes —la cabecera— y ahí se queda.
 * Puesto más alto (60 KB) tardaba siete segundos en decidirse con la imagen
 * quieta, y esos siete segundos salían congelados al principio del corte.
 */
const UMBRAL_LISTA = 8_000;

/** Lo que se espera a que arranque antes de bajar a WebM. */
const PLAZO_LISTA = 9000;

/**
 * Si este navegador puede montar el vídeo sin salir de la máquina.
 *
 * Le vale cualquiera de los dos motores: con WebCodecs se monta aunque no
 * hubiera grabadora, y con grabadora se monta aunque no haya WebCodecs.
 */
export function puedeCortarAqui() {
  if (typeof window === "undefined") return false;

  if (puedeIrRapido()) return true;

  return (
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    formatoDeGrabacion() !== null
  );
}

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  LO QUE SE LE PIDE                                                  */
/* ------------------------------------------------------------------ */

/*
| Los tipos y la pantalla viven en `pantalla-montaje`, que es de los dos
| motores. Se vuelven a exportar aquí porque este módulo sigue siendo la
| puerta de entrada del montaje para el resto de la aplicación.
*/
export type {
  ClipNavegador,
  ParadaNavegador,
  PeticionNavegador,
  ResultadoNavegador,
} from "@/lib/coding/pantalla-montaje";

export { CORTE_CANCELADO } from "@/lib/coding/pantalla-montaje";

/* ------------------------------------------------------------------ */
/*  HERRAMIENTAS                                                       */
/* ------------------------------------------------------------------ */

/** El ancho máximo del montaje: un 4K a tiempo real no lo aguanta nadie. */
const TOPE_ANCHO = 1920;

/** Espera un evento con plazo. Sin plazo, un `seeked` que no llega cuelga. */
function esperaEvento(objetivo: EventTarget, evento: string, plazoMs: number) {
  return new Promise<boolean>((listo) => {
    const acaba = (valor: boolean) => {
      clearTimeout(plazo);
      objetivo.removeEventListener(evento, llegada);
      listo(valor);
    };

    const llegada = () => acaba(true);

    const plazo = setTimeout(() => acaba(false), plazoMs);

    objetivo.addEventListener(evento, llegada);
  });
}

/** El siguiente fotograma pintado por el navegador. */
const siguienteFotograma = () =>
  new Promise<void>((listo) => requestAnimationFrame(() => listo()));

type VideoConFotogramas = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    devuelve: (ahora: number, datos: { mediaTime: number }) => void,
  ) => number;
};

const hayFotogramasDelVideo = (video: HTMLVideoElement) =>
  typeof (video as VideoConFotogramas).requestVideoFrameCallback === "function";

/**
 * El siguiente fotograma **del vídeo**, no el de la pantalla.
 *
 * Es la diferencia entre un montaje bueno y uno con el principio de cada corte
 * congelado, y costó verlo: `drawImage` de un vídeo que todavía no tiene
 * fotograma **no pinta nada** —no falla, no borra: deja el lienzo como
 * estaba—. Con el lienzo movido por `requestAnimationFrame`, los primeros
 * segundos de un corte recién buscado se grababan con lo último que hubiera
 * pintado (la carátula), y esos segundos del partido no aparecían por ningún
 * lado aunque el reloj del vídeo sí corriera.
 *
 * `requestVideoFrameCallback` avisa cuando hay un fotograma de verdad, y de
 * paso dice a qué instante del partido corresponde (`mediaTime`), que es más
 * exacto que preguntarle la hora al elemento. Devuelve `null` si se cumple el
 * plazo sin fotograma —el vídeo está parado o atascado— para que el bucle
 * siga vivo y pueda mirar si ya ha terminado.
 */
function siguienteDelVideo(video: HTMLVideoElement, plazoMs = 250) {
  return new Promise<number | null>((listo) => {
    const conFotogramas = video as VideoConFotogramas;

    if (typeof conFotogramas.requestVideoFrameCallback !== "function") {
      requestAnimationFrame(() => listo(null));
      return;
    }

    let hecho = false;

    const plazo = setTimeout(() => {
      if (hecho) return;

      hecho = true;
      listo(null);
    }, plazoMs);

    conFotogramas.requestVideoFrameCallback((_ahora, datos) => {
      if (hecho) return;

      hecho = true;
      clearTimeout(plazo);
      listo(datos.mediaTime);
    });
  });
}

/** Lleva el vídeo a un instante y espera a tener ese fotograma de verdad. */
async function ve(video: HTMLVideoElement, segundos: number) {
  if (Math.abs(video.currentTime - segundos) < 0.002) return true;

  const llegada = esperaEvento(video, "seeked", 20_000);

  video.currentTime = segundos;

  return llegada;
}

/**
 * Dale al play, y si el navegador no deja, al menos que salga sin sonido.
 *
 * La política de reproducción automática puede negarse cuando el montaje
 * arranca unos segundos después del clic —pintar la carátula tarda—. Antes que
 * dejar al analista sin vídeo, sale mudo.
 */
async function arranca(video: HTMLVideoElement) {
  try {
    await video.play();
  } catch {
    video.muted = true;

    await video.play().catch(() => undefined);
  }
}

function cargaImagen(src: string) {
  return new Promise<HTMLImageElement | null>((listo) => {
    const imagen = new Image();

    imagen.onload = () => listo(imagen);
    imagen.onerror = () => listo(null);
    imagen.src = src;
  });
}

const reloj = (segundos: number) => {
  const total = Math.max(0, Math.round(segundos));

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};


/* ------------------------------------------------------------------ */
/*  EL MONTAJE                                                         */
/* ------------------------------------------------------------------ */

/** Las pizarras de un clip, ya con la imagen cargada. */
type ParadaLista = {
  imagen: HTMLImageElement;
  enMs: number;
  duracionMs: number;
};

/**
 * El montaje grabando la pantalla, a tiempo real.
 *
 * Es el camino de respaldo desde el 29/08/2026: sólo se usa cuando el rápido
 * (`lib/coding/rapido.ts`) dice que no puede con este fichero o con este
 * navegador. Sigue entero porque es el único que funciona en cualquier sitio:
 * no le hace falta saber leer el fichero, le basta con que el navegador sepa
 * reproducirlo.
 */
async function montaATiempoReal(
  peticion: PeticionNavegador,
  escenario: PantallaMontaje,
): Promise<ResultadoNavegador> {
  const elMejor = formatoDeGrabacion();

  if (!elMejor) {
    throw new Error(
      "Este navegador no sabe grabar vídeo. Abre el coding en Chrome o en " +
        "Edge y el montaje se hace aquí mismo.",
    );
  }

  /* Puede bajar a WebM a mitad de camino: ver `preparaGrabadora`. */
  let formato: FormatoGrabacion = elMejor;

  const clips = peticion.clips.filter((clip) => clip.finMs > clip.inicioMs);

  if (clips.length === 0) throw new Error("No hay clips que exportar.");

  const arranqueTotal = Date.now();

  escenario.enseñaVideo(true);

  escenario.explica(
    "Se monta en este ordenador, a tiempo real: el partido no se sube a " +
      "ningún sitio. Deja esta pestaña delante —si te vas a otra, el montaje " +
      "se para y sigue al volver— y no cierres la ventana.",
  );

  const url = URL.createObjectURL(peticion.fichero);

  /* La grabadora de turno: la necesita el guardia de la pestaña de atrás. */
  let grabadora: MediaRecorder | null = null;

  /* La mezcla de sonido, para cerrarla pase lo que pase. */
  let cierraMezcla: (() => void) | null = null;

  let reanudaVideo = false;
  let reanudaGrabadora = false;

  const { video, lienzo } = escenario;

  /*
  | Pestaña de atrás: se para todo y se sigue al volver.
  |
  | El navegador congela `requestAnimationFrame` en las pestañas que no se ven,
  | pero **no** para el vídeo ni la grabadora: sin esto, el lienzo se quedaba
  | clavado mientras el partido seguía corriendo, y lo que salía era un plano
  | fijo de dos minutos con el corte perdido por dentro.
  */
  const alCambiarVisibilidad = () => {
    if (document.hidden) {
      reanudaVideo = !video.paused;

      if (reanudaVideo) video.pause();

      reanudaGrabadora = grabadora?.state === "recording";

      if (reanudaGrabadora) grabadora?.pause();

      return;
    }

    if (reanudaGrabadora) grabadora?.resume();

    if (reanudaVideo) void video.play().catch(() => undefined);

    reanudaVideo = false;
    reanudaGrabadora = false;
  };

  document.addEventListener("visibilitychange", alCambiarVisibilidad);

  try {
    video.src = url;
    video.load();

    if (!(await esperaEvento(video, "loadedmetadata", 30_000))) {
      throw new Error(
        "No se ha podido abrir el vídeo. Vuelve a elegirlo en «El vídeo».",
      );
    }

    /* -------------------------------------------- la medida del montaje */

    let ancho = video.videoWidth || 1280;
    let alto = video.videoHeight || 720;

    if (ancho > TOPE_ANCHO) {
      alto = Math.round((alto * TOPE_ANCHO) / ancho);
      ancho = TOPE_ANCHO;
    }

    /* Los codificadores quieren medidas pares. */
    ancho -= ancho % 2;
    alto -= alto % 2;

    lienzo.width = ancho;
    lienzo.height = alto;

    escenario.encaja(ancho, alto);

    const ctx = lienzo.getContext("2d", { alpha: false });

    if (!ctx) throw new Error("No se ha podido preparar el lienzo del montaje.");

    /*
    | Treinta como mucho, aunque el partido venga a 50.
    |
    | Esto codifica **a tiempo real**: cada fotograma de más es trabajo que el
    | ordenador tiene que sacar adelante mientras además descodifica el
    | partido, y cuando no llega no avisa, se come fotogramas. A 30 se ve
    | igual de fluido y sobra margen en un portátil.
    */
    const fps = Math.min(30, Math.max(24, Math.round(peticion.fps || 25)));

    /*
    | Un empujón al descodificador antes de grabar nada.
    |
    | El primer `play()` de un `<video>` recién abierto tarda **segundos** en
    | dar el primer fotograma —medido: cinco—, y si eso pasa con la grabadora
    | en marcha son cinco segundos congelados al principio del corte. Aquí se
    | paga ese peaje una sola vez y en seco, antes de que exista una grabadora.
    */
    await ve(video, clips[0].inicioMs / 1000);

    await arranca(video);

    await siguienteDelVideo(video, 5000);

    video.pause();

    /* --------------------------------------------- el flujo que se graba */

    /*
    | El lienzo se graba **empujando** cada fotograma, no dejando que el
    | navegador lo muestree solo.
    |
    | Medido en esta máquina: con `captureStream(fps)`, Chrome deja de sacar
    | fotogramas del lienzo durante segundos enteros aunque se esté pintando en
    | cada `requestVideoFrameCallback` y el lienzo tenga los píxeles del
    | partido. El vídeo salía con la carátula pegada encima del primer corte y
    | con un agujero de seis segundos sin un solo fotograma dentro del fichero
    | —contados con `showinfo`—. `captureStream(0)` + `requestFrame()` es la
    | forma explícita: un fotograma en el vídeo por cada uno que se pinta.
    |
    | Si el navegador no supiera pedirlos a mano, se vuelve al muestreo
    | automático: peor, pero mejor que un vídeo vacío.
    */
    const aMano = lienzo.captureStream(0);

    const pista = aMano.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;

    const empujaAMano = typeof pista?.requestFrame === "function";

    if (!empujaAMano) for (const suelta of aMano.getTracks()) suelta.stop();

    const flujo = empujaAMano ? aMano : lienzo.captureStream(fps);

    let ultimoEmpuje = 0;

    /* Mientras el codificador se despierta no se le da un solo fotograma. */
    let enSeco = false;

    /** Mete en el vídeo lo que se acaba de pintar, sin pasar de los fps. */
    const empuja = (siempre = false) => {
      if (!empujaAMano || enSeco) return;

      const ahora = performance.now();

      if (!siempre && ahora - ultimoEmpuje < 1000 / fps - 2) return;

      ultimoEmpuje = ahora;

      pista.requestFrame();
    };

    /* ------------------------------------------------------- pintar */

    const pintaVideo = () => {
      ctx.drawImage(video, 0, 0, ancho, alto);
    };

    /** Una imagen encajada en el lienzo, con barras si no es del mismo formato. */
    const pintaImagen = (imagen: HTMLImageElement) => {
      const anchoImagen = imagen.naturalWidth || ancho;
      const altoImagen = imagen.naturalHeight || alto;

      const escala = Math.min(ancho / anchoImagen, alto / altoImagen);

      const w = Math.round(anchoImagen * escala);
      const h = Math.round(altoImagen * escala);

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, ancho, alto);

      ctx.drawImage(
        imagen,
        Math.round((ancho - w) / 2),
        Math.round((alto - h) / 2),
        w,
        h,
      );
    };

    /* ------------------------------------ las imágenes, todas por delante */

    /*
    | Cargarlas antes de grabar y no sobre la marcha: descodificar un fotograma
    | de 1080p tarda, y hacerlo con la grabadora en marcha mete ese tirón
    | dentro del vídeo que se entrega.
    */
    const portada = peticion.portada ? await cargaImagen(peticion.portada) : null;

    const paradasDe = new Map<ClipNavegador, ParadaLista[]>();

    for (const clip of clips) {
      const listas: ParadaLista[] = [];

      for (const parada of clip.paradas ?? []) {
        const imagen = await cargaImagen(parada.imagen);

        if (!imagen) continue;

        listas.push({
          imagen,
          enMs: Math.max(0, parada.enMs),
          duracionMs: Math.max(500, parada.duracionMs),
        });
      }

      listas.sort((una, otra) => una.enMs - otra.enMs);

      paradasDe.set(clip, listas);
    }

    /* --------------------------------------------------- la cuenta */

    const portadaMs = portada
      ? Math.max(1000, Math.round((peticion.portadaSegundos ?? 4) * 1000))
      : 0;

    const totalMs =
      portadaMs +
      clips.reduce(
        (suma, clip) =>
          suma +
          (clip.finMs - clip.inicioMs) +
          (paradasDe.get(clip) ?? []).reduce(
            (parcial, parada) => parcial + parada.duracionMs,
            0,
          ),
        0,
      );

    /*
    | Lo que dura el fichero más largo que va a salir.
    |
    | En el unificado es todo el montaje; en cortes sueltos, el clip más
    | largo, que es el que decide si el tope de peso se cumple para todos.
    */
    const segundosDeSalida =
      peticion.formato === "unificado"
        ? totalMs / 1000
        : Math.max(
            0.5,
            ...clips.map(
              (clip) =>
                ((clip.finMs - clip.inicioMs) +
                  (paradasDe.get(clip) ?? []).reduce(
                    (parcial, parada) => parcial + parada.duracionMs,
                    0,
                  )) /
                1000,
            ),
          );

    const topeMegas = Math.max(0, peticion.topeMegas ?? 0);

    /* Lo ya montado, en milisegundos de vídeo entregado. */
    let hechoMs = 0;

    const dice = (texto: string, dentroMs = 0) =>
      escenario.dice(
        `${texto} · ${reloj((hechoMs + dentroMs) / 1000)} de ${reloj(totalMs / 1000)}`,
        totalMs > 0 ? (hechoMs + dentroMs) / totalMs : 0,
      );

    /* --------------------------------------------------------- el sonido */

    let conSonido = false;

    /*
    | El sonido del partido, mezclado con un silencio que no para nunca.
    |
    | Lo del silencio no es un adorno, es lo que hace que esto grabe: medido,
    | **`MediaRecorder` no suelta un solo byte mientras alguna de sus pistas no
    | dé datos**. La pista de sonido de un `<video>` en pausa no da ninguno, y
    | el montaje empieza siempre con el vídeo parado —buscando el corte, o
    | enseñando la carátula—: la grabación se quedaba muda y ciega hasta que el
    | vídeo arrancaba, y los primeros segundos del primer corte no llegaban al
    | fichero. Con un `ConstantSource` a cero enchufado a la mezcla, la pista
    | siempre está viva, las pausas del montaje salen en silencio —que es lo
    | que tienen que sonar— y el vídeo empieza donde tiene que empezar.
    |
    | El sonido del partido **no se manda a los altavoces** a propósito: el
    | `<video>` del montaje sólo existe para grabar, y nadie quiere cuatro
    | minutos de partido a todo volumen mientras se monta.
    */
    try {
      const mezcla = new AudioContext();

      await mezcla.resume().catch(() => undefined);

      const salida = mezcla.createMediaStreamDestination();

      const silencio = mezcla.createConstantSource();

      silencio.offset.value = 0;
      silencio.connect(salida);
      silencio.start();

      /* Un vídeo mudo no tiene nada que aportar, y pedirlo da error. */
      try {
        mezcla.createMediaElementSource(video).connect(salida);
        conSonido = true;
      } catch {
        conSonido = false;
      }

      for (const pistaDeSonido of salida.stream.getAudioTracks()) {
        flujo.addTrack(pistaDeSonido);
      }

      cierraMezcla = () => void mezcla.close().catch(() => undefined);
    } catch {
      conSonido = false;
    }

    /*
    | El caudal, con el tope de peso que se haya pedido.
    |
    | Aquí se graba corte a corte, así que el fichero que hay que hacer caber
    | es **este** y el tope se reparte entre lo que dure. El suelo de medio
    | mega es el mismo que en el motor rápido: por debajo la imagen deja de
    | servir para analizar, y antes que entregar una mancha se pasa del tope.
    */
    const caudal = (() => {
      const bueno = Math.min(
        16_000_000,
        Math.max(2_500_000, Math.round(ancho * alto * fps * 0.15)),
      );

      const topeBytes = Math.max(0, topeMegas) * 1_000_000;

      if (topeBytes <= 0 || segundosDeSalida <= 0) return bueno;

      const cabe = Math.round(
        (topeBytes * 8 * 0.94) / segundosDeSalida - 128_000,
      );

      return Math.max(500_000, Math.min(bueno, cabe));
    })();

    const creaGrabadora = () => {
      const nueva = new MediaRecorder(flujo, {
        mimeType: formato.mime,
        videoBitsPerSecond: caudal,
        audioBitsPerSecond: 128_000,
      });

      const trozos: Blob[] = [];

      /*
      | Lo grabado hasta ahora, en bytes: es lo que dice si está grabando de
      | verdad.
      |
      | Se cuentan bytes y no trozos a propósito. El MP4 de Chrome los suelta a
      | ráfagas —36 bytes, nada, 350 000, nada— y contar trozos seguidos daba
      | por muerta una grabación que iba perfectamente. Los bytes no engañan:
      | un fundido de entrada de 1080p que ha entrado en el fichero pesa lo que
      | pesa.
      */
      let bytes = 0;

      const fin = new Promise<Blob>((listo, falla) => {
        nueva.ondataavailable = (evento) => {
          const datos = evento.data;

          if (datos?.size) trozos.push(datos);

          bytes += datos?.size ?? 0;
        };

        nueva.onstop = () =>
          listo(new Blob(trozos, { type: formato.mime.split(";")[0] }));

        nueva.onerror = () =>
          falla(new Error("La grabación se ha cortado a medias."));
      });

      grabadora = nueva;

      return { graba: nueva, fin, bytes: () => bytes };
    };

    const paraSiCancelan = () => {
      if (escenario.cancelado()) throw new Error(CANCELADO);
    };

    /* --------------------------------- la grabadora que graba de verdad */

    /**
     * Arranca la grabadora y **no devuelve hasta que está grabando de verdad**.
     *
     * Esto es lo más importante de todo el fichero, y lo que costó encontrar.
     * Medido en esta máquina, contando los fotogramas del fichero con
     * `showinfo`: si a `MediaRecorder` se le empiezan a dar fotogramas nada
     * más llamar a `start()`, el codificador de MP4/H.264 **tira los primeros
     * cinco o seis segundos** —el fichero salía con 11 fotogramas al principio,
     * un agujero de seis segundos sin uno solo, y el resto bien—. En la pantalla
     * eso era la carátula pegada encima del primer corte y los tres primeros
     * segundos del corte desaparecidos. No es cosa del formato (con VP9 pasa
     * igual) ni de las pausas ni del sonido; y con VP8, que codifica por
     * software, no pasa nunca. Calentar con otra grabadora antes tampoco sirve.
     *
     * Lo que sí sirve, medido: **dejar la grabadora en marcha unos segundos sin
     * darle un solo fotograma**. Después de eso el fichero sale entero y a su
     * ritmo. Así que aquí se hace justo eso y luego se comprueba —no se
     * supone—: se abre con un fundido desde negro del primer fotograma, que es
     * imagen que cambia, y no se sigue hasta ver varios trozos seguidos con
     * datos. Si en nueve segundos no llega, se baja a WebM, que arranca
     * siempre, en vez de entregar un vídeo con agujeros.
     */
    /**
     * Enciende el codificador con una grabación de mentira que se tira.
     *
     * Medido: **la primera grabadora de la página tarda unos cinco segundos en
     * soltar el primer byte; la segunda, milésimas** (5734 ms contra 1517 ms
     * en el mismo montaje). Sin esto, ese peaje lo pagaba el primer corte, que
     * salía con cinco segundos congelados delante. Aquí se paga una vez, antes
     * de grabar nada que importe, y encima sirve para elegir el formato: lo
     * que se ve en la pantalla es el partido con un velo que se mueve —hace
     * falta imagen que cambie para saber si el codificador está vivo—.
     */
    const calientaCodificador = async () => {
      const { graba, fin, bytes } = creaGrabadora();

      graba.start(TROZO_MS);

      const hasta = performance.now() + PLAZO_LISTA;

      while (performance.now() < hasta && bytes() < UMBRAL_LISTA) {
        paraSiCancelan();

        await siguienteFotograma();

        pintaVideo();

        ctx.fillStyle = `rgba(0,0,0,${0.35 + 0.35 * Math.sin(performance.now() / 120)})`;
        ctx.fillRect(0, 0, ancho, alto);

        empuja();

        dice("Preparando el codificador");
      }

      graba.stop();

      await fin.catch(() => null);

      grabadora = null;

      /* Ni un byte: este contenedor no graba aquí, se prueba con el otro. */
      if (bytes() < UMBRAL_LISTA) {
        const repuesto = otroFormato(formato.contenedor);

        if (repuesto) formato = repuesto;
      }
    };

    const preparaGrabadora = async (dibuja: () => void) => {
      for (let vuelta = 0; vuelta < 2; vuelta += 1) {
        const { graba, fin, bytes } = creaGrabadora();

        /* En seco: la grabadora en marcha y el lienzo sin empujar nada. */
        enSeco = true;

        graba.start(TROZO_MS);

        const finDelCalenton = performance.now() + CALENTON_MS;

        while (performance.now() < finDelCalenton) {
          paraSiCancelan();

          dice("Preparando el codificador");

          await siguienteFotograma();
        }

        enSeco = false;

        /* El fundido de entrada, que además es la prueba de que graba. */
        const arranqueFundido = performance.now();

        let listo = false;

        while (performance.now() - arranqueFundido < PLAZO_LISTA) {
          paraSiCancelan();

          await siguienteFotograma();

          const t = performance.now() - arranqueFundido;

          dibuja();

          /*
          | El velo se va en `FUNDIDO_MS`, y si para entonces la grabación
          | todavía no ha dado señales sigue latiendo muy flojo: una imagen
          | quieta no genera bytes, y sin bytes esto no sabría nunca si está
          | grabando o esperando a un codificador muerto.
          */
          const velo =
            t < FUNDIDO_MS
              ? 1 - t / FUNDIDO_MS
              : 0.05 + 0.05 * Math.sin(t / 90);

          ctx.fillStyle = `rgba(0,0,0,${velo})`;
          ctx.fillRect(0, 0, ancho, alto);

          empuja();

          dice("Abriendo el vídeo");

          if (t > FUNDIDO_MS + TROZO_MS && bytes() > UMBRAL_LISTA) {
            listo = true;
            break;
          }
        }

        if (listo) return { graba, fin };

        /*
        | Ni con ésas. Se tira esta grabación y se cambia de contenedor: un
        | vídeo entero en el formato de repuesto vale mil veces más que uno con
        | agujeros en el formato bonito.
        */
        graba.stop();

        await fin.catch(() => null);

        const repuesto = otroFormato(formato.contenedor);

        if (!repuesto) {
          throw new Error(
            "El navegador no ha llegado a grabar nada. Cierra las pestañas " +
              "pesadas que tengas abiertas y vuelve a intentarlo.",
          );
        }

        formato = repuesto;
      }

      throw new Error("El navegador no ha podido ponerse a grabar.");
    };

    /* ------------------------------------------------ las dos maniobras */

    /**
     * Mantiene una imagen quieta en el lienzo el rato que se le diga.
     *
     * El tiempo se cuenta sumando fotogramas y no con un reloj de pared: si la
     * pestaña se va atrás, la grabadora se para pero el reloj seguiría
     * corriendo, y la parada saldría más corta de lo pedido. El tope por
     * fotograma es lo que absorbe ese hueco.
     */
    const sostiene = async (
      imagen: HTMLImageElement,
      ms: number,
      etiqueta: string,
    ) => {
      let restante = ms;
      let antes = performance.now();

      while (restante > 0) {
        paraSiCancelan();

        await siguienteFotograma();

        const ahora = performance.now();

        restante -= Math.min(ahora - antes, 120);
        antes = ahora;

        pintaImagen(imagen);

        empuja();

        dice(etiqueta, ms - Math.max(0, restante));
      }
    };

    /**
     * Arranca el vídeo y **no graba hasta que hay imagen**.
     *
     * Después de una búsqueda, un `play()` tarda en dar el primer fotograma
     * —el descodificador tiene que llenarse— y ese rato el lienzo sigue con lo
     * de antes. Grabarlo sería meter unos segundos congelados al principio de
     * cada corte. Con la grabadora en pausa mientras tanto, el corte empieza
     * en su fotograma y no en un plano fijo.
     */
    const arrancaConImagen = async (graba: MediaRecorder | null) => {
      if (graba?.state === "recording") graba.pause();

      await arranca(video);

      if (hayFotogramasDelVideo(video)) {
        /* Cinco segundos de margen: si no llega imagen, se sigue igual. */
        for (let intento = 0; intento < 20; intento += 1) {
          const media = await siguienteDelVideo(video);

          if (media !== null) break;
        }
      } else {
        await siguienteFotograma();
      }

      pintaVideo();

      if (graba?.state === "paused") graba.resume();

      empuja(true);
    };

    /** Reproduce el clip desde donde ya está el vídeo, parando en cada pizarra. */
    const corre = async (
      clip: ClipNavegador,
      etiqueta: string,
      graba: MediaRecorder | null,
    ) => {
      const paradas = paradasDe.get(clip) ?? [];

      /* Lo que llevan sumado las paradas ya hechas de este clip. */
      let enParadas = 0;
      let indice = 0;

      const base = hechoMs;

      await arrancaConImagen(graba);

      for (;;) {
        paraSiCancelan();

        const media = await siguienteDelVideo(video);

        pintaVideo();

        empuja();

        const t = (media ?? video.currentTime) * 1000;

        const parada = paradas[indice];

        if (parada && t >= clip.inicioMs + parada.enMs) {
          video.pause();

          hechoMs = base + (t - clip.inicioMs) + enParadas;

          await sostiene(parada.imagen, parada.duracionMs, etiqueta);

          hechoMs = base;

          enParadas += parada.duracionMs;
          indice += 1;

          await arrancaConImagen(graba);

          continue;
        }

        dice(etiqueta, Math.max(0, t - clip.inicioMs) + enParadas);

        if (t >= clip.finMs || video.ended) break;
      }

      video.pause();

      hechoMs = base + (clip.finMs - clip.inicioMs) + enParadas;
    };

    const acabado = (blob: Blob, extension: string): ResultadoNavegador => ({
      blob,
      extension,
      contenedor: formato.contenedor,
      conSonido,
      segundos: Math.round((Date.now() - arranqueTotal) / 1000),
    });

    /* El peaje del codificador, una sola vez y antes de nada. */
    await calientaCodificador();

    /* ------------------------------------------------- un corte suelto */

    if (peticion.formato === "clip") {
      const clip = clips[0];

      dice("Preparando el corte");

      await ve(video, clip.inicioMs / 1000);

      /* El fundido de entrada abre con el primer fotograma del corte. */
      const { graba, fin } = await preparaGrabadora(pintaVideo);

      await corre(clip, "Grabando el corte", graba);

      graba.stop();

      return acabado(await fin, formato.contenedor);
    }

    /* --------------------------------------------- el vídeo unificado */

    if (peticion.formato === "unificado") {
      dice("Preparando el montaje");

      await ve(video, clips[0].inicioMs / 1000);

      /*
      | El fundido de entrada es la carátula si la hay: así el vídeo abre como
      | tiene que abrir y de paso el codificador se pone en marcha con imagen
      | quieta, que es donde no se nota.
      */
      const { graba, fin } = await preparaGrabadora(
        portada ? () => pintaImagen(portada) : pintaVideo,
      );

      if (portada) {
        await sostiene(portada, portadaMs, "Carátula");

        hechoMs += portadaMs;
      }

      for (const [indice, clip] of clips.entries()) {
        paraSiCancelan();

        if (indice > 0) {
          /*
          | Buscar el siguiente corte lleva su tiempo, y ese tiempo no puede
          | salir en el vídeo: la grabadora se para mientras tanto y sigue
          | justo donde lo dejó.
          */
          graba.pause();

          await ve(video, clip.inicioMs / 1000);

          pintaVideo();

          /* La grabadora la vuelve a soltar `corre`, ya con imagen. */
        }

        await corre(clip, `Corte ${indice + 1} de ${clips.length}`, graba);
      }

      graba.stop();

      return acabado(await fin, formato.contenedor);
    }

    /* ------------------------------------------------- el paquete ZIP */

    const entradas: EntradaZip[] = [];

    for (const [indice, clip] of clips.entries()) {
      paraSiCancelan();

      dice(`Preparando el corte ${indice + 1} de ${clips.length}`);

      await ve(video, clip.inicioMs / 1000);

      const { graba, fin } = await preparaGrabadora(pintaVideo);

      await corre(clip, `Corte ${indice + 1} de ${clips.length}`, graba);

      graba.stop();

      const trozo = await fin;

      entradas.push({
        nombre: `${clip.nombre}.${formato.contenedor}`,
        datos: new Uint8Array(await trozo.arrayBuffer()) as Bytes,
      });
    }

    dice("Cerrando el paquete");

    return acabado(creaZip(entradas), "zip");
  } finally {
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);

    cierraMezcla?.();

    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------------------------ */
/*  LA PUERTA                                                          */
/* ------------------------------------------------------------------ */

/**
 * Monta el vídeo aquí, con el motor que mejor le venga a este fichero.
 *
 * Primero el rápido, que lee el MP4 y trabaja con WebCodecs sin reproducir
 * nada; si dice que no puede —el fichero no es un MP4 que sepa recorrer, el
 * códec no le entra, o el navegador no trae WebCodecs—, se graba a tiempo
 * real, que funciona siempre.
 *
 * **Y si el rápido se rompe a mitad, también se cae al de siempre.** Cuesta
 * unos minutos de más, pero el analista se lleva su vídeo: quedarse sin nada
 * después de esperar es lo único que no se puede permitir.
 */
export async function cortaEnElNavegador(
  peticion: PeticionNavegador,
): Promise<ResultadoNavegador> {
  const clips = peticion.clips.filter((clip) => clip.finMs > clip.inicioMs);

  if (clips.length === 0) throw new Error("No hay clips que exportar.");

  const escenario = montaEscenario(peticion.titulo ?? "Montando el vídeo");

  try {
    if (puedeIrRapido()) {
      escenario.dice("Abriendo el partido", 0);

      try {
        const rapido = await montaRapido(peticion, escenario);

        if (rapido) return rapido;
      } catch (error) {
        if (error instanceof Error && error.message === CANCELADO) throw error;

        console.warn(
          "[coding] el montaje rápido no ha podido; se graba a tiempo real",
          error,
        );
      }
    }

    return await montaATiempoReal(peticion, escenario);
  } finally {
    escenario.cierra();
  }
}
