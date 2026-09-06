"use client";

/**
 * El montaje rápido: WebCodecs, sin reproducir el partido.
 *
 * El camino de antes graba la pantalla mientras el vídeo se reproduce, así que
 * **cuesta lo que dura el vídeo**: cuatro minutos de cortes, cuatro minutos de
 * espera, más el rato de buscar cada corte, más el calentón del codificador de
 * cada fichero. Y sale WebM, porque el MP4 de `MediaRecorder` en esta máquina
 * se come los primeros segundos.
 *
 * Aquí no se reproduce nada. Se leen del fichero **sólo las muestras de cada
 * corte** (`lib/coding/mp4.ts`), se descodifican con `VideoDecoder`, se vuelven
 * a codificar con `VideoEncoder` y se escriben en un MP4 de verdad. El
 * navegador va tan rápido como pueda la máquina —medido en ésta: muy por
 * encima del tiempo real— y no hay nada que se pueda «perder por el camino»,
 * porque el codificador **encola** los fotogramas en vez de tirarlos, que era
 * la avería de fondo del otro motor.
 *
 * Lo que sale es lo mismo de siempre: un corte suelto, un ZIP con los cortes o
 * el unificado con la carátula delante, y las pizarras quemadas parando el
 * vídeo en el fotograma pintado.
 *
 * ---
 *
 * **Cuándo NO se usa** (y entonces manda `null` para que el otro motor tome el
 * relevo, ver `lib/coding/navegador.ts`):
 *
 * - El navegador no trae WebCodecs (Safari viejo, Firefox viejo).
 * - El fichero no es un MP4/MOV que `abreMp4` sepa recorrer —un MKV, por
 *   ejemplo—.
 * - El vídeo viene en un códec que este navegador no descodifica.
 * - Hay pista de sonido y no se sabe descodificar: antes que entregar un vídeo
 *   mudo sin avisar, se monta a tiempo real, que sí lo conserva.
 */

import {
  abreMp4,
  claveAntesDe,
  LectorMuestras,
  MuxorMp4,
  primeraDesde,
  type PistaMp4,
} from "@/lib/coding/mp4";
import {
  CORTE_CANCELADO,
  type ClipNavegador,
  type PantallaMontaje,
  type PeticionNavegador,
  type ResultadoNavegador,
} from "@/lib/coding/pantalla-montaje";
import { creaZip, type Bytes, type EntradaZip } from "@/lib/export/zip";

/* ------------------------------------------------------------------ */
/*  LOS NÚMEROS                                                        */
/* ------------------------------------------------------------------ */

/**
 * El ancho máximo del montaje.
 *
 * Un partido en 4K se codifica a 1920: un 4K entero tarda cuatro veces más y
 * ningún proyector de sala de vídeo lo va a enseñar. Lo normal —1080p— no se
 * toca, así que el corte sale con la medida del partido.
 */
const TOPE_ANCHO = 1920;

/** Fotogramas por segundo como mucho: de 60 para arriba no aporta nada. */
const TOPE_FPS = 60;

/** Cada cuántos segundos un fotograma clave, para que se pueda buscar dentro. */
const CLAVE_CADA_S = 2;

/** Cuántos fotogramas se dejan en la cola antes de esperar al codificador. */
const COLA_MAXIMA = 8;

/**
 * Cuántas muestras se le adelantan al descodificador.
 *
 * Corta a propósito, y ésta sí es delicada: su fondo de armario son nueve
 * fotogramas —medido— y todos los que estén esperando turno para codificarse
 * salen de ahí. Con cuatro por delante va a toda velocidad y nunca se acerca
 * al tope.
 */
const COLA_DESCODIFICADOR = 4;

/**
 * Los niveles de H.264 que se prueban, de menos a más.
 *
 * El nivel que se pide es sólo una intención: el codificador escribe en el
 * fichero el que de verdad ha usado, y de ahí lo copia el muxor. Se prueban en
 * orden porque una tarjeta puede aceptar 4.0 y no 5.2.
 */
const NIVELES = [
  { codec: "avc1.640028", pixeles: 1920 * 1080, fps: 32 },
  { codec: "avc1.64002a", pixeles: 1920 * 1088, fps: 62 },
  { codec: "avc1.640032", pixeles: 2560 * 1440, fps: 62 },
  { codec: "avc1.640033", pixeles: 4096 * 2304, fps: 32 },
  { codec: "avc1.640034", pixeles: 4096 * 2304, fps: 62 },
];

/** Si este navegador puede montar así. */
export function puedeIrRapido() {
  return (
    typeof window !== "undefined" &&
    typeof VideoEncoder !== "undefined" &&
    typeof VideoDecoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  );
}

const duerme = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/** Una copia propia de lo que da WebCodecs, que puede venir en memoria compartida. */
function copiaBytes(fuente: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(fuente)
    ? new Uint8Array(fuente.buffer as ArrayBuffer, fuente.byteOffset, fuente.byteLength)
    : new Uint8Array(fuente as ArrayBuffer);

  const salida = new Uint8Array(vista.length) as Bytes;

  salida.set(vista);

  return salida;
}

/**
 * Lo mismo, pero para las promesas de WebCodecs.
 *
 * Un `flush()` que no vuelve deja la pantalla del montaje quieta para
 * siempre y sin decir nada, que es la peor forma de fallar.
 */
function conPlazo<T>(promesa: Promise<T>, ms: number, quien: string) {
  return new Promise<T>((listo, falla) => {
    const plazo = setTimeout(
      () => falla(new Error(`El montaje se ha quedado esperando a ${quien}.`)),
      ms,
    );

    promesa.then(
      (valor) => {
        clearTimeout(plazo);
        listo(valor);
      },
      (error) => {
        clearTimeout(plazo);
        falla(error);
      },
    );
  });
}

/**
 * Espera a que la cola baje, sin bloquear la página.
 *
 * Con plazo: si un codificador se queda tonto, esto se convertiría en una
 * pantalla de montaje que no avanza nunca y no dice nada. Con el plazo, salta
 * el error y el montaje se cae al motor de siempre, que sí acaba.
 */
async function esperaCola(mira: () => number, tope: number, quien: string) {
  const hasta = performance.now() + 30_000;

  while (mira() > tope) {
    if (performance.now() > hasta) {
      throw new Error(`El montaje se ha quedado esperando a ${quien}.`);
    }

    await duerme(4);
  }
}

const reloj = (segundos: number) => {
  const total = Math.max(0, Math.round(segundos));

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/*  LA SALIDA: CODIFICADORES + MUXOR                                   */
/* ------------------------------------------------------------------ */

type Plan = {
  ancho: number;
  alto: number;
  fps: number;
  bitrate: number;
  codec: string;
};

type Salida = {
  /** Un fotograma ya en la medida de salida. Se cierra aquí. */
  mete: (fotograma: VideoFrame, clave?: boolean) => void;
  /** Sonido en crudo, ya en el reloj de salida. */
  meteSonido: (canales: Float32Array[], frecuencia: number) => void;
  termina: () => Promise<Blob>;
  /** Lo que llevan codificado los fotogramas, en microsegundos. */
  hastaUs: () => number;
  esperaSitio: () => Promise<void>;
};

function abreSalida(plan: Plan): Salida {
  const muxor = new MuxorMp4();

  let fallo: Error | null = null;
  let ultimoUs = 0;
  let ultimaClaveUs = -Infinity;

  const codificador = new VideoEncoder({
    output: (trozo, metadatos) => {
      const descripcion = metadatos?.decoderConfig?.description;

      if (descripcion) {
        muxor.configuraVideo({
          ancho: plan.ancho,
          alto: plan.alto,
          descripcion: copiaBytes(descripcion),
        });
      }

      const datos = new Uint8Array(trozo.byteLength) as Bytes;

      trozo.copyTo(datos);

      muxor.añadeVideo(
        datos,
        trozo.timestamp,
        trozo.duration || 1_000_000 / plan.fps,
        trozo.type === "key",
      );
    },
    error: (error) => {
      console.warn("[coding] el codificador de vídeo ha fallado", error);

      fallo = error instanceof Error ? error : new Error(String(error));
    },
  });

  codificador.configure({
    codec: plan.codec,
    width: plan.ancho,
    height: plan.alto,
    bitrate: plan.bitrate,
    framerate: plan.fps,
    latencyMode: "quality",
    avc: { format: "avc" },
  });

  /* ------------------------------------------------------- el sonido */

  let sonido: AudioEncoder | null = null;
  let frecuenciaSonido = 0;
  let enMuestras = 0;
  let pendienteSonido = 0;

  const abreSonido = (frecuencia: number, canales: number) => {
    frecuenciaSonido = frecuencia;

    sonido = new AudioEncoder({
      output: (trozo, metadatos) => {
        const descripcion = metadatos?.decoderConfig?.description;

        if (descripcion) {
          muxor.configuraAudio({
            frecuencia,
            canales,
            descripcion: copiaBytes(descripcion),
          });
        }

        const datos = new Uint8Array(trozo.byteLength) as Bytes;

        trozo.copyTo(datos);

        const cuantas = Math.round(((trozo.duration || 0) * frecuencia) / 1e6);

        muxor.añadeAudio(datos, enMuestras, cuantas || 1024);

        enMuestras += cuantas || 1024;
      },
      error: (error) => {
        console.warn("[coding] el codificador de sonido ha fallado", error);

        fallo = error instanceof Error ? error : new Error(String(error));
      },
    });

    sonido.configure({
      codec: "mp4a.40.2",
      sampleRate: frecuencia,
      numberOfChannels: canales,
      bitrate: canales > 1 ? 192_000 : 128_000,
    });
  };

  return {
    hastaUs: () => ultimoUs,

    esperaSitio: async () => {
      if (fallo) throw fallo;

      await esperaCola(
        () => codificador.encodeQueueSize,
        COLA_MAXIMA,
        "que el codificador saque los fotogramas",
      );
    },

    mete: (fotograma, clave = false) => {
      if (fallo) {
        fotograma.close();
        throw fallo;
      }

      ultimoUs = fotograma.timestamp + (fotograma.duration || 0);

      /*
      | Un fotograma clave cada dos segundos, pedido a mano.
      |
      | WebCodecs no tiene ajuste de «grupo de imágenes»: si no se le piden,
      | hay codificadores que sueltan uno al principio y ninguno más, y
      | entonces adelantar el vídeo en la sala de vídeo va a tirones o
      | directamente no va.
      */
      const toca =
        clave || fotograma.timestamp - ultimaClaveUs >= CLAVE_CADA_S * 1e6;

      if (toca) ultimaClaveUs = fotograma.timestamp;

      codificador.encode(fotograma, { keyFrame: toca });

      fotograma.close();
    },

    meteSonido: (canales, frecuencia) => {
      if (canales.length === 0 || canales[0].length === 0) return;

      if (!sonido) abreSonido(frecuencia, canales.length);

      if (!sonido || frecuenciaSonido !== frecuencia) return;

      /*
      | El sonido se le da al codificador en paquetes de 1024 muestras, que es
      | lo que come un AAC. En uno solo gigante también valdría, pero un corte
      | de quince segundos son tres megas de números que se copian dos veces.
      */
      const PASO = 1024;
      const total = canales[0].length;
      const cuantos = canales.length;

      for (let desde = 0; desde < total; desde += PASO) {
        const largo = Math.min(PASO, total - desde);
        const plano = new Float32Array(largo * cuantos);

        for (let c = 0; c < cuantos; c += 1) {
          plano.set(canales[c].subarray(desde, desde + largo), c * largo);
        }

        sonido.encode(
          new AudioData({
            format: "f32-planar",
            sampleRate: frecuencia,
            numberOfFrames: largo,
            numberOfChannels: cuantos,
            timestamp: Math.round((pendienteSonido / frecuencia) * 1e6),
            data: plano,
          }),
        );

        pendienteSonido += largo;
      }
    },

    termina: async () => {
      await conPlazo(codificador.flush(), 180_000, "que acabe el vídeo");

      codificador.close();

      if (sonido) {
        await conPlazo(sonido.flush(), 60_000, "que acabe el sonido");
        sonido.close();
      }

      if (fallo) throw fallo;

      return muxor.cierra();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  EL PLAN DE SALIDA                                                  */
/* ------------------------------------------------------------------ */

async function planea(fuente: PistaMp4, fpsSesion?: number): Promise<Plan | null> {
  let ancho = fuente.ancho;
  let alto = fuente.alto;

  if (ancho > TOPE_ANCHO) {
    alto = Math.round((alto * TOPE_ANCHO) / ancho);
    ancho = TOPE_ANCHO;
  }

  ancho -= ancho % 2;
  alto -= alto % 2;

  /*
  | Los fotogramas por segundo salen del propio partido, no de la sesión.
  |
  | Aquí no se codifica a tiempo real, así que un partido a 50 se puede
  | entregar a 50: el otro motor lo bajaba a 30 porque no le daba tiempo.
  */
  const medio = fuente.duracionUs[Math.floor(fuente.n / 2)] || 40_000;

  const fps = Math.min(
    TOPE_FPS,
    Math.max(10, Math.round(1_000_000 / medio) || fpsSesion || 25),
  );

  /*
  | El caudal: lo que traía el partido, corregido por lo que se haya
  | encogido la imagen y con un tercio de más para que recodificar no se note.
  | El suelo lo pone la propia medida, por si el original venía muy apretado.
  */
  const proporcion = (ancho * alto) / Math.max(1, fuente.ancho * fuente.alto);

  const bitrate = Math.round(
    Math.min(
      30_000_000,
      Math.max(
        3_000_000,
        fuente.bitrate * proporcion * 1.3,
        ancho * alto * fps * 0.12,
      ),
    ),
  );

  for (const nivel of NIVELES) {
    if (ancho * alto > nivel.pixeles || fps > nivel.fps) continue;

    const config: VideoEncoderConfig = {
      codec: nivel.codec,
      width: ancho,
      height: alto,
      bitrate,
      framerate: fps,
      latencyMode: "quality",
      avc: { format: "avc" },
    };

    try {
      const { supported } = await VideoEncoder.isConfigSupported(config);

      if (supported) {
        return { ancho, alto, fps, bitrate, codec: nivel.codec };
      }
    } catch {
      /* Ese nivel no; se prueba el siguiente. */
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  LAS IMÁGENES QUEMADAS                                              */
/* ------------------------------------------------------------------ */

async function cargaMapa(src: string) {
  try {
    const respuesta = await fetch(src);

    return await createImageBitmap(await respuesta.blob());
  } catch (error) {
    console.warn("[coding] no se ha podido leer una imagen del montaje", error);

    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  EL MONTAJE                                                         */
/* ------------------------------------------------------------------ */

type ParadaLista = {
  mapa: ImageBitmap;
  enUs: number;
  duracionUs: number;
};

/**
 * Monta el vídeo con WebCodecs, o devuelve `null` si aquí no se puede.
 *
 * `null` significa «este fichero o este navegador no son para mí»: quien
 * llama tiene que seguir por el camino de siempre. Los fallos de verdad —el
 * codificador que revienta a mitad— sí se lanzan.
 */
export async function montaRapido(
  peticion: PeticionNavegador,
  pantalla: PantallaMontaje,
): Promise<ResultadoNavegador | null> {
  if (!puedeIrRapido()) return null;

  const clips = peticion.clips.filter((clip) => clip.finMs > clip.inicioMs);

  if (clips.length === 0) throw new Error("No hay clips que exportar.");

  const abierto = await abreMp4(peticion.fichero);

  if (!abierto?.video) return null;

  const fuente = abierto.video;

  const configDecodificador: VideoDecoderConfig = {
    codec: fuente.codec,
    description: fuente.descripcion ?? undefined,
    codedWidth: fuente.ancho,
    codedHeight: fuente.alto,
    hardwareAcceleration: "no-preference",
  };

  try {
    const { supported } = await VideoDecoder.isConfigSupported(configDecodificador);

    if (!supported) return null;
  } catch {
    return null;
  }

  const plan = await planea(fuente, peticion.fps);

  if (!plan) return null;

  /* ------------------------------------------------------- el sonido */

  const pistaSonido = abierto.audio;

  let configSonido: AudioDecoderConfig | null = null;

  if (pistaSonido) {
    configSonido = {
      codec: pistaSonido.codec,
      sampleRate: pistaSonido.frecuencia,
      numberOfChannels: pistaSonido.canales,
      description: pistaSonido.descripcion ?? undefined,
    };

    try {
      const cabe = await AudioDecoder.isConfigSupported(configSonido);

      const codifica = await AudioEncoder.isConfigSupported({
        codec: "mp4a.40.2",
        sampleRate: pistaSonido.frecuencia,
        numberOfChannels: pistaSonido.canales,
        bitrate: pistaSonido.canales > 1 ? 192_000 : 128_000,
      });

      /*
      | Con sonido que no se sabe pasar, este motor se retira.
      |
      | Entregar el vídeo mudo sin decir nada sería peor que tardar: el otro
      | motor lo graba a tiempo real, pero lo graba.
      */
      if (!cabe.supported || !codifica.supported) return null;
    } catch {
      return null;
    }
  }

  const arranque = Date.now();

  pantalla.enseñaVideo(false);
  pantalla.encaja(plan.ancho, plan.alto);
  pantalla.explica(
    "Se monta en este ordenador y sin reproducir el partido, así que va " +
      "mucho más rápido que el vídeo. El fichero no se sube a ningún sitio. " +
      "Puedes cambiar de pestaña: esto sigue.",
  );

  /* ---------------------------------------------- lo que hay que pintar */

  /*
  | Dos lienzos, y hacen falta los dos.
  |
  | En el «vivo» se copia cada fotograma del partido nada más salir del
  | descodificador —ver `pasaClip`, que es la clave de que esto no se
  | atasque—, y en el «quieto» se pintan la carátula y las pizarras. Con uno
  | solo, una pizarra en medio del corte borraría el fotograma que estaba
  | esperando su turno para codificarse.
  */
  const lienzo = new OffscreenCanvas(plan.ancho, plan.alto);
  const pincel = lienzo.getContext("2d", { alpha: false });

  const quieto = new OffscreenCanvas(plan.ancho, plan.alto);
  const pincelQuieto = quieto.getContext("2d", { alpha: false });

  if (!pincel || !pincelQuieto) {
    throw new Error("No se ha podido preparar el lienzo del montaje.");
  }

  const vista = pantalla.lienzo;

  vista.width = Math.min(960, plan.ancho);
  vista.height = Math.round((vista.width * plan.alto) / plan.ancho);

  const ojo = vista.getContext("2d", { alpha: false });

  let ultimaVista = 0;

  /** Enseña un fotograma de cuando en cuando: verlo montar tranquiliza. */
  const asoma = (que: CanvasImageSource) => {
    const ahora = performance.now();

    if (!ojo || ahora - ultimaVista < 90) return;

    ultimaVista = ahora;

    ojo.drawImage(que, 0, 0, vista.width, vista.height);
  };

  /** Una imagen encajada en el lienzo quieto, con barras si hace falta. */
  const pintaMapa = (mapa: ImageBitmap) => {
    const escala = Math.min(plan.ancho / mapa.width, plan.alto / mapa.height);

    const w = Math.round(mapa.width * escala);
    const h = Math.round(mapa.height * escala);

    pincelQuieto.fillStyle = "#000";
    pincelQuieto.fillRect(0, 0, plan.ancho, plan.alto);

    pincelQuieto.drawImage(
      mapa,
      Math.round((plan.ancho - w) / 2),
      Math.round((plan.alto - h) / 2),
      w,
      h,
    );
  };

  /* ------------------------------------------- las imágenes, por delante */

  const portada = peticion.portada ? await cargaMapa(peticion.portada) : null;

  const paradasDe = new Map<ClipNavegador, ParadaLista[]>();

  for (const clip of clips) {
    const listas: ParadaLista[] = [];

    for (const parada of clip.paradas ?? []) {
      const mapa = await cargaMapa(parada.imagen);

      if (!mapa) continue;

      listas.push({
        mapa,
        enUs: Math.max(0, parada.enMs) * 1000,
        duracionUs: Math.max(500, parada.duracionMs) * 1000,
      });
    }

    listas.sort((una, otra) => una.enUs - otra.enUs);

    paradasDe.set(clip, listas);
  }

  const portadaUs = portada
    ? Math.max(1_000_000, Math.round((peticion.portadaSegundos ?? 4) * 1e6))
    : 0;

  const totalUs =
    (peticion.formato === "unificado" ? portadaUs : 0) +
    clips.reduce(
      (suma, clip) =>
        suma +
        (clip.finMs - clip.inicioMs) * 1000 +
        (paradasDe.get(clip) ?? []).reduce(
          (parcial, parada) => parcial + parada.duracionUs,
          0,
        ),
      0,
    );

  /*
  | Un techo de caudal para los montajes muy largos.
  |
  | Todo lo codificado espera en memoria hasta que se cierra el fichero, así
  | que un montaje de media hora al caudal bueno serían gigas de RAM y la
  | pestaña se caería sin decir nada. Con esto, lo normal —unos minutos de
  | cortes— no se entera de que existe el tope, y lo enorme sale más apretado
  | pero sale.
  */
  const topePorPeso = (900e6 * 8) / Math.max(30, totalUs / 1e6);

  if (topePorPeso < plan.bitrate) plan.bitrate = Math.round(topePorPeso);

  /*
  | Y el techo que ha pedido quien exporta: que cada fichero quepa en X megas.
  |
  | Se mide sobre **el fichero más largo que va a salir**, no sobre el total:
  | en cortes sueltos cada clip es un fichero y el que manda es el más largo,
  | y en el unificado el fichero es uno solo y dura todo. Así el tope se
  | cumple en los dos formatos con una sola cuenta.
  |
  | Se le resta el sonido y un 6 % de contenedor: el índice de un MP4 y las
  | cabeceras de cada muestra no son gratis, y un tope que se pasa por poco es
  | un tope que no sirve para lo que se pidió.
  */
  const topeBytes = Math.max(0, peticion.topeMegas ?? 0) * 1_000_000;

  if (topeBytes > 0) {
    const mayorUs =
      peticion.formato === "unificado"
        ? totalUs
        : Math.max(
            1,
            ...clips.map(
              (clip) =>
                (clip.finMs - clip.inicioMs) * 1000 +
                (paradasDe.get(clip) ?? []).reduce(
                  (parcial, parada) => parcial + parada.duracionUs,
                  0,
                ),
            ),
          );

    const segundos = Math.max(0.5, mayorUs / 1e6);

    const paraSonido = pistaSonido ? 192_000 : 0;

    const topeCaudal = Math.round(
      (topeBytes * 8 * 0.94) / segundos - paraSonido,
    );

    /*
    | Por debajo de este caudal el vídeo deja de servir para analizar: se
    | avisa en la pantalla del montaje y se sale con lo mínimo antes que
    | entregar una mancha. Medio mega por segundo es un 720p pobre pero
    | legible.
    */
    plan.bitrate = Math.max(400_000, Math.min(plan.bitrate, topeCaudal));
  }

  /** Lo entregado, en microsegundos de vídeo montado. */
  let hechoUs = 0;

  const dice = (texto: string, dentroUs = 0) =>
    pantalla.dice(
      `${texto} · ${reloj((hechoUs + dentroUs) / 1e6)} de ${reloj(totalUs / 1e6)}`,
      totalUs > 0 ? (hechoUs + dentroUs) / totalUs : 0,
    );

  const paraSiCancelan = () => {
    if (pantalla.cancelado()) throw new Error(CORTE_CANCELADO);
  };

  /* ------------------------------------------------------ el descodificador */

  const lectorVideo = new LectorMuestras(peticion.fichero);
  const lectorSonido = new LectorMuestras(peticion.fichero);

  /**
   * Mete en la salida una imagen quieta, tantos fotogramas como haga falta.
   *
   * Aquí no se espera nada: una parada de tres segundos son setenta y cinco
   * fotogramas idénticos que el codificador despacha en un suspiro y que
   * ocupan unos pocos bytes cada uno. En el otro motor esa parada costaba tres
   * segundos de reloj de verdad.
   */
  const sostiene = async (
    salida: Salida,
    mapa: ImageBitmap,
    desdeUs: number,
    duracionUs: number,
    etiqueta: string,
    /** Desde dónde cuenta el reloj de la pantalla: el principio de su trozo. */
    origenUs = 0,
  ) => {
    pintaMapa(mapa);
    asoma(quieto);

    const cuantos = Math.max(1, Math.round((duracionUs / 1e6) * plan.fps));
    const paso = Math.round(duracionUs / cuantos);

    for (let i = 0; i < cuantos; i += 1) {
      paraSiCancelan();

      await salida.esperaSitio();

      salida.mete(
        new VideoFrame(quieto, {
          timestamp: Math.round(desdeUs + i * paso),
          duration: paso,
        }),
        i === 0,
      );

      dice(etiqueta, desdeUs - origenUs + i * paso);
    }
  };

  /**
   * Pasa un corte entero: lee, descodifica, para en las pizarras y codifica.
   *
   * El corte casi nunca empieza en un fotograma clave, así que se descodifica
   * desde el clave anterior y se tira lo que sobra —es lo que hace un
   * reproductor al buscar, pero sin enseñarlo—.
   */
  const pasaClip = async (
    salida: Salida,
    clip: ClipNavegador,
    desplazamientoInicial: number,
    etiqueta: string,
  ) => {
    const inicioUs = clip.inicioMs * 1000;
    const finUs = clip.finMs * 1000;

    const paradas = paradasDe.get(clip) ?? [];

    let desplazamiento = desplazamientoInicial - inicioUs;
    let siguienteParada = 0;
    let primero = true;

    const fotogramas: VideoFrame[] = [];

    let falloDec: Error | null = null;

    const descodificador = new VideoDecoder({
      output: (fotograma) => fotogramas.push(fotograma),
      error: (error) => {
        falloDec = error instanceof Error ? error : new Error(String(error));
      },
    });

    descodificador.configure(configDecodificador);

    const desde = claveAntesDe(fuente, inicioUs);
    const hasta = Math.min(fuente.n - 1, primeraDesde(fuente, finUs));

    /**
     * Saca de la cola lo descodificado y lo mete en la salida.
     *
     * **El fotograma se copia al lienzo y se cierra en el acto, siempre.** No
     * es un capricho ni una comodidad para redimensionar: medido en esta
     * máquina, el descodificador de Chrome sólo tiene **nueve** fotogramas de
     * fondo de armario, y no suelta uno nuevo hasta que se le devuelve otro.
     * Pasarle el fotograma al codificador sin copiarlo —lo suyo, y de hecho lo
     * que hacía este código antes— se los quedaba dentro de su cola: a los
     * nueve, el descodificador se paraba y `flush()` no volvía **nunca**. Sin
     * error, sin aviso: la pantalla del montaje quieta para siempre.
     *
     * La copia al lienzo es una imagen nueva, del navegador, así que el
     * descodificador recupera la suya inmediatamente y no hay forma de que
     * esto se atasque por muchos fotogramas que lleve el codificador dentro.
     */
    const vacia = async () => {
      while (fotogramas.length > 0) {
        const fotograma = fotogramas.shift()!;

        const t = fotograma.timestamp;
        const dur = fotograma.duration || Math.round(1e6 / plan.fps);

        if (t + dur <= inicioUs || t >= finUs) {
          fotograma.close();
          continue;
        }

        pincel.drawImage(fotograma, 0, 0, plan.ancho, plan.alto);

        fotograma.close();

        asoma(lienzo);

        /* Las pizarras que ya tocan, antes del fotograma que las lleva. */
        while (
          siguienteParada < paradas.length &&
          t >= inicioUs + paradas[siguienteParada].enUs
        ) {
          const parada = paradas[siguienteParada];

          await sostiene(
            salida,
            parada.mapa,
            t + desplazamiento,
            parada.duracionUs,
            etiqueta,
            desplazamientoInicial,
          );

          desplazamiento += parada.duracionUs;
          siguienteParada += 1;
        }

        await salida.esperaSitio();

        paraSiCancelan();

        const salidaUs = Math.round(t + desplazamiento);

        salida.mete(
          new VideoFrame(lienzo, { timestamp: salidaUs, duration: dur }),
          primero,
        );

        primero = false;

        dice(etiqueta, salidaUs - desplazamientoInicial);
      }
    };

    for (let i = desde; i <= hasta; i += 1) {
      paraSiCancelan();

      if (falloDec) throw falloDec;

      const datos = await lectorVideo.dame(fuente.offsets[i], fuente.tam[i]);

      descodificador.decode(
        new EncodedVideoChunk({
          type: fuente.clave[i] ? "key" : "delta",
          timestamp: Math.round(fuente.ptsUs[i]),
          duration: Math.round(fuente.duracionUs[i]),
          data: datos,
        }),
      );

      await esperaCola(
        () => descodificador.decodeQueueSize,
        COLA_DESCODIFICADOR,
        "que el descodificador siga",
      );

      await vacia();
    }

    await conPlazo(descodificador.flush(), 60_000, "que salgan los fotogramas");

    await vacia();

    descodificador.close();

    /* Una pizarra al final del corte, cuando ya no queda fotograma detrás. */
    while (siguienteParada < paradas.length) {
      const parada = paradas[siguienteParada];

      await sostiene(
        salida,
        parada.mapa,
        salida.hastaUs(),
        parada.duracionUs,
        etiqueta,
        desplazamientoInicial,
      );

      desplazamiento += parada.duracionUs;
      siguienteParada += 1;
    }

    return desplazamiento + finUs;
  };

  /* --------------------------------------------------------- el sonido */

  /**
   * El sonido del corte, con silencio donde el vídeo se para.
   *
   * Se arma en crudo —un vector de números por canal— y se le da entero al
   * codificador. Las paradas no son un hueco: son ceros, que es lo que suena
   * cuando la imagen se congela, y así el sonido y la imagen siguen midiendo
   * lo mismo hasta el final del vídeo.
   */
  const pasaSonido = async (salida: Salida, clip: ClipNavegador) => {
    if (!pistaSonido || !configSonido) return;

    dice("Poniendo el sonido");

    const inicioUs = clip.inicioMs * 1000;
    const finUs = clip.finMs * 1000;

    const paradas = paradasDe.get(clip) ?? [];

    const frecuencia = pistaSonido.frecuencia;
    const enMuestras = (us: number) => Math.round((us / 1e6) * frecuencia);

    /* Los tramos de partido que suenan, y dónde caen dentro del corte. */
    const tramos: { desdeUs: number; hastaUs: number; salida: number }[] = [];

    let cursor = inicioUs;
    let escrito = 0;

    for (const parada of paradas) {
      const corta = Math.min(finUs, inicioUs + parada.enUs);

      if (corta > cursor) {
        tramos.push({ desdeUs: cursor, hastaUs: corta, salida: escrito });
        escrito += enMuestras(corta - cursor);
      }

      escrito += enMuestras(parada.duracionUs);
      cursor = corta;
    }

    if (finUs > cursor) {
      tramos.push({ desdeUs: cursor, hastaUs: finUs, salida: escrito });
      escrito += enMuestras(finUs - cursor);
    }

    const canales: Float32Array[] = [];

    let cuantosCanales = 0;

    const guarda = (datos: AudioData) => {
      if (cuantosCanales === 0) {
        cuantosCanales = datos.numberOfChannels;

        for (let c = 0; c < cuantosCanales; c += 1) {
          canales.push(new Float32Array(escrito));
        }
      }

      const largo = datos.numberOfFrames;
      const desdeUs = datos.timestamp;
      const hastaUs = desdeUs + (largo / frecuencia) * 1e6;

      for (const tramo of tramos) {
        const a = Math.max(desdeUs, tramo.desdeUs);
        const b = Math.min(hastaUs, tramo.hastaUs);

        if (b <= a) continue;

        const salto = Math.round(((a - desdeUs) / 1e6) * frecuencia);
        const cuantas = Math.min(
          largo - salto,
          Math.round(((b - a) / 1e6) * frecuencia),
        );

        if (cuantas <= 0) continue;

        const destino = tramo.salida + Math.round(((a - tramo.desdeUs) / 1e6) * frecuencia);

        for (let c = 0; c < cuantosCanales; c += 1) {
          const trozo = new Float32Array(cuantas);

          datos.copyTo(trozo, {
            planeIndex: c,
            frameOffset: salto,
            frameCount: cuantas,
            format: "f32-planar",
          });

          if (destino + cuantas <= canales[c].length) {
            canales[c].set(trozo, destino);
          } else if (destino < canales[c].length) {
            canales[c].set(trozo.subarray(0, canales[c].length - destino), destino);
          }
        }
      }

      datos.close();
    };

    const descodificador = new AudioDecoder({
      output: guarda,
      error: (error) => {
        throw error;
      },
    });

    descodificador.configure(configSonido);

    /* Un paquete antes del principio: el AAC necesita carrerilla. */
    const desde = Math.max(0, primeraDesde(pistaSonido, inicioUs) - 2);
    const hasta = Math.min(pistaSonido.n - 1, primeraDesde(pistaSonido, finUs));

    for (let i = desde; i <= hasta; i += 1) {
      const datos = await lectorSonido.dame(
        pistaSonido.offsets[i],
        pistaSonido.tam[i],
      );

      descodificador.decode(
        new EncodedAudioChunk({
          type: "key",
          timestamp: Math.round(pistaSonido.ptsUs[i]),
          duration: Math.round(pistaSonido.duracionUs[i]),
          data: datos,
        }),
      );

      await esperaCola(
        () => descodificador.decodeQueueSize,
        32,
        "que el descodificador de sonido siga",
      );
    }

    await conPlazo(descodificador.flush(), 60_000, "que salga el sonido");

    descodificador.close();

    if (canales.length === 0) {
      /* Ni un paquete: silencio del mismo largo, que el vídeo no se descuadre. */
      salida.meteSonido([new Float32Array(escrito), new Float32Array(escrito)], frecuencia);

      return;
    }

    salida.meteSonido(canales, frecuencia);
  };

  /* --------------------------------------------------- un vídeo entero */

  const montaUno = async (
    lista: ClipNavegador[],
    conPortada: boolean,
    etiqueta: (indice: number) => string,
  ) => {
    const salida = abreSalida(plan);

    let desplazamiento = 0;

    if (conPortada && portada) {
      await sostiene(salida, portada, 0, portadaUs, "Carátula");

      /*
      | Y el mismo rato de silencio.
      |
      | El sonido de salida es una tira continua que empieza en cero: sin
      | estos segundos de nada, el partido empezaría a sonar encima de la
      | carátula y todo el vídeo iría adelantado justo lo que dura.
      */
      if (pistaSonido) {
        const cuantas = Math.round((portadaUs / 1e6) * pistaSonido.frecuencia);

        salida.meteSonido(
          Array.from(
            { length: pistaSonido.canales },
            () => new Float32Array(cuantas),
          ),
          pistaSonido.frecuencia,
        );
      }

      desplazamiento = portadaUs;
      hechoUs += portadaUs;
    }

    for (const [indice, clip] of lista.entries()) {
      paraSiCancelan();

      const antes = desplazamiento;

      desplazamiento = await pasaClip(
        salida,
        clip,
        desplazamiento,
        etiqueta(indice),
      );

      await pasaSonido(salida, clip);

      hechoUs += desplazamiento - antes;
    }

    dice("Cerrando el vídeo");

    return salida.termina();
  };

  /* ------------------------------------------------------- las tres salidas */

  const acabado = (blob: Blob, extension: string): ResultadoNavegador => {
    /* Las imágenes quemadas ya no hacen falta, y ocupan memoria de la tarjeta. */
    portada?.close();

    for (const lista of paradasDe.values()) {
      for (const parada of lista) parada.mapa.close();
    }

    const segundos = Math.max(1, Math.round((Date.now() - arranque) / 1000));

    return {
      blob,
      extension,
      contenedor: "mp4",
      conSonido: Boolean(pistaSonido),
      segundos,
      vecesReal: Number((totalUs / 1e6 / segundos).toFixed(1)),
    };
  };

  if (peticion.formato === "zip") {
    const entradas: EntradaZip[] = [];

    for (const [indice, clip] of clips.entries()) {
      paraSiCancelan();

      const blob = await montaUno(
        [clip],
        false,
        () => `Corte ${indice + 1} de ${clips.length}`,
      );

      entradas.push({
        nombre: `${clip.nombre}.mp4`,
        datos: new Uint8Array(await blob.arrayBuffer()) as Bytes,
      });
    }

    dice("Cerrando el paquete");

    return acabado(creaZip(entradas), "zip");
  }

  const unificado = peticion.formato === "unificado";

  const blob = await montaUno(clips, unificado, (indice) =>
    unificado ? `Corte ${indice + 1} de ${clips.length}` : "Montando el corte",
  );

  return acabado(blob, "mp4");
}
