/**
 * EL RODAJE DE UNA DIAPOSITIVA DE ABP (01/11/2026).
 *
 * Lo que antes hacía `grabaJugada` de una tirada —fotografiar la diapositiva
 * en cada instante y codificar el MP4— va ahora en dos mitades:
 *
 * 1. **El material** (`ruedaMaterial`): las fotos de la diapositiva de verdad,
 *    montada fuera de pantalla con su reloj. Por fase, las fichas y el balón
 *    sueltos (recortados por tandas: la foto sin ninguna contra la foto con
 *    unas pocas que no se tocan) y ~20 fotos del fondo sin ellas, con dónde
 *    está cada ficha en cada foto. Las fotos se guardan en JPEG: así el
 *    material de toda una pizarra cabe en memoria.
 * 2. **El montaje** (`montaJugada`): de ese material salen los fotogramas a
 *    30 por segundo. Las fichas se colocan en cada fotograma sobre una curva
 *    (Catmull-Rom por los centros de las fotos: sin quiebros entre una foto y
 *    la siguiente; el arranque y la llegada ya van suavizados por la pizarra,
 *    `suave` en `lib/abp/trazos.ts`) y el fondo (flechas que crecen, rival,
 *    cabecera) se funde de una foto a otra.
 *
 * Con las dos mitades, el MISMO material vale para el vídeo de la diapositiva
 * y para el de cada jugador («su responsabilidad»: él resaltado, el resto
 * apagado) sin volver a fotografiar nada: fotografiar es lo caro.
 *
 * Todas las esperas aguantan la pestaña escondida (otra pestaña delante, la
 * ventana minimizada): nada de `requestAnimationFrame` ni de relojes
 * encadenados, que Chrome congela o retrasa hasta un minuto. Al codificador se
 * le espera por su evento `dequeue`.
 */

import { COLORES, TABLERO_H, TABLERO_W } from "@/lib/abp/pizarra";
import { PIXEL_VACIO, esperaFotos, pintado, respira } from "@/lib/export/lienzos";
import { aligeraImagenes, capturaNodo, fotoRapida, fuentesIncrustadas } from "@/lib/export/captura";
import { FAMILIA_PORTADA, esperaFuentePortada } from "@/lib/rivals/portada-font";
import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";
import { FPS_LAMINA, codecLamina } from "@/lib/tactics/lamina";
import { fuentesDe } from "@/lib/abp/cache-exportar";

export const FPS = FPS_LAMINA;

/**
 * Fotos por fase en movimiento (01/11/2026: 12 → 20, «los vídeos parecen poco
 * fluidos»). Entre una y otra no se repite la foto: las fichas van sueltas y
 * se colocan en cada fotograma sobre su curva.
 */
export const FOTOS_POR_FASE = 20;
/** Lo que se mueve suelto por encima del fondo. */
const MOVILES = "[data-ficha],[data-balon]";
/** Margen del recorte, para llevarse la sombra. */
const MARGEN_RECORTE = 16;
/**
 * La primera foto de cada fase, un pelo DESPUÉS de su arranque: en el
 * instante exacto la cabecera de la diapositiva aún decía la fase anterior
 * mientras el rótulo grande ya anunciaba la nueva.
 */
const ARRANQUE = 0.001;
/** Las fotos guardadas: 0,95 no se distingue del original y una diapositiva pesa unos 300 kB. */
const CALIDAD_FOTO = 0.95;

type Caja = { x: number; y: number; w: number; h: number };

/** Una foto del fondo (sin las fichas) y dónde estaba cada ficha. */
export type TomaGuardada = { fondo: Blob; cajas: Map<string, Caja> };

export type FaseRodada = {
  /** Cada ficha (y el balón) recortada, con su sombra. */
  sueltas: Map<string, HTMLCanvasElement>;
  /** `FOTOS_POR_FASE + 1` fotos, del arranque al final de la fase. */
  tomas: TomaGuardada[];
  /** La diapositiva entera al acabar la fase (con las fichas puestas). */
  llegada: Blob;
};

export type MaterialJugada = {
  nFases: number;
  /** La diapositiva entera en la salida. */
  salida: Blob;
  /** La salida sin las fichas (para colocarlas aparte, resaltadas o apagadas). */
  salidaVacia: TomaGuardada;
  fases: FaseRodada[];
  /** Las fichas en gris, hechas una vez (vídeos por jugador). */
  grises: Map<string, HTMLCanvasElement>;
};

const claveMovil = (el: Element, i: number) =>
  el.hasAttribute("data-balon") ? "balon" : `${el.getAttribute("data-player") ?? "ficha"}#${i}`;

/** Dónde está cada ficha y el balón, en píxeles del tablero. */
function cajasDe(nodo: HTMLElement): Map<string, Caja> {
  const base = nodo.getBoundingClientRect();
  const ex = TABLERO_W / (base.width || TABLERO_W);
  const ey = TABLERO_H / (base.height || TABLERO_H);
  const cajas = new Map<string, Caja>();

  nodo.querySelectorAll(MOVILES).forEach((el, i) => {
    const r = el.getBoundingClientRect();

    if (!r.width || !r.height) return;

    cajas.set(claveMovil(el, i), {
      x: (r.left - base.left) * ex - MARGEN_RECORTE,
      y: (r.top - base.top) * ey - MARGEN_RECORTE,
      w: r.width * ex + MARGEN_RECORTE * 2,
      h: r.height * ey + MARGEN_RECORTE * 2,
    });
  });

  return cajas;
}

/** La ficha suelta: lo que cambia entre la foto con ella y la misma sin ella (con su sombra y sin el césped). */
function recorta(lleno: CanvasImageSource, vacio: CanvasImageSource, caja: Caja): HTMLCanvasElement | null {
  const w = Math.max(1, Math.ceil(caja.w));
  const h = Math.max(1, Math.ceil(caja.h));
  const pinta = (imagen: CanvasImageSource) => {
    const lienzo = document.createElement("canvas");

    lienzo.width = w;
    lienzo.height = h;

    const ctx = lienzo.getContext("2d", { willReadFrequently: true });

    if (!ctx) return null;

    ctx.drawImage(imagen, caja.x, caja.y, w, h, 0, 0, w, h);

    return { lienzo, ctx };
  };
  const a = pinta(lleno);
  const b = pinta(vacio);

  if (!a || !b) return null;

  const pa = a.ctx.getImageData(0, 0, w, h);
  const pb = b.ctx.getImageData(0, 0, w, h).data;
  const d = pa.data;

  for (let i = 0; i < d.length; i += 4) {
    const diferencia = Math.abs(d[i] - pb[i]) + Math.abs(d[i + 1] - pb[i + 1]) + Math.abs(d[i + 2] - pb[i + 2]);

    d[i + 3] = Math.round(Math.min(1, Math.max(0, (diferencia - 10) / 40)) * 255);
  }

  a.ctx.putImageData(pa, 0, 0);

  return a.lienzo;
}

/** Lo que necesita el rodaje para fotografiar la diapositiva en cada instante. */
export type PideFoto = {
  /** El tablero de fuera de pantalla, ya montado. */
  nodo: HTMLElement;
  /** Pone el reloj del tablero (0 = salida; 1, 2… = fin de cada fase) y espera a que se pinte. */
  pon: (valor: number) => Promise<void>;
};

/** Cuántas fotos lleva el material de una diapositiva de `fases` fases (para el progreso). */
export const fotosDelMaterial = (fases: number) => 2 + fases * (FOTOS_POR_FASE + 4);

/* ------------------------------------------------------------------ */
/*  1 · EL MATERIAL                                                    */
/* ------------------------------------------------------------------ */

export async function ruedaMaterial({
  nodo,
  pon,
  nFases,
  alAvance,
}: PideFoto & { nFases: number; alAvance?: (fraccion: number) => void }): Promise<MaterialJugada> {
  await esperaFuentePortada();
  await pintado();
  await esperaFotos(nodo);
  await aligeraImagenes(nodo);

  const opciones = {
    backgroundColor: COLORES.tinta,
    imagePlaceholder: PIXEL_VACIO,
    includeQueryParams: true,
    formato: "jpeg" as const,
    quality: 0.92,
    width: TABLERO_W,
    height: TABLERO_H,
    /* A la medida nativa del tablero: 1920 × 1080, sin reescalar después. */
    pixelRatio: 1,
    style: { margin: "0", transform: "none", transformOrigin: "top left" },
    /* Element y no HTMLElement: el balón es un <svg> y también se aparta. */
    filter: (n: HTMLElement) => !(n instanceof Element) || !n.hasAttribute("data-export-hide"),
  };

  /*
    El primer fotograma, con la captura completa: deja las fotos en la caché.
    Los demás, con la rápida y las fuentes hechas una vez.
  */
  let caliente = false;
  const fontEmbedCSS = await fuentesDe(nodo, () => fuentesIncrustadas(nodo, opciones));
  /* El reloj puesto: las fotos de las tandas son del mismo instante y no hace falta repintar. */
  let ultimo = Number.NaN;
  let hechas = 0;
  const total = fotosDelMaterial(nFases);

  async function retrata(): Promise<HTMLImageElement> {
    const inicio = performance.now();

    if (caliente) {
      try {
        const imagen = await fotoRapida(nodo, { ...opciones, fontEmbedCSS });

        /* Lo que cuesta cada fotograma, para medirlo desde fuera. */
        performance.measure("abp-video-foto", { start: inicio });

        return imagen;
      } catch {
        /* Si la rápida falla, la de siempre. */
      }
    }

    const { dataUrl } = await capturaNodo(nodo, fontEmbedCSS ? { ...opciones, fontEmbedCSS } : opciones);

    caliente = true;

    return cargaImagen(dataUrl);
  }

  /* La foto de un instante; con `aparta`, sin esas fichas (o el balón) y con dónde estaban. */
  async function toma(valor: number, aparta?: Set<string>): Promise<{ imagen: HTMLImageElement; cajas: Map<string, Caja> }> {
    if (valor !== ultimo) {
      await pon(valor);
      ultimo = valor;
    }

    const apartados: Element[] = [];

    if (aparta?.size) {
      nodo.querySelectorAll(MOVILES).forEach((el, i) => {
        if (aparta.has(claveMovil(el, i)) && !el.hasAttribute("data-export-hide")) {
          el.setAttribute("data-export-hide", "");
          apartados.push(el);
        }
      });
    }

    try {
      const imagen = await retrata();

      alAvance?.(Math.min(1, ++hechas / total));

      return { imagen, cajas: aparta ? cajasDe(nodo) : new Map() };
    } finally {
      apartados.forEach((el) => el.removeAttribute("data-export-hide"));
    }
  }

  /* Las fotos se guardan en JPEG: un lienzo para todas. */
  const guarda = document.createElement("canvas");

  guarda.width = TABLERO_W;
  guarda.height = TABLERO_H;

  const gctx = guarda.getContext("2d");

  if (!gctx) throw new Error("El navegador no da un lienzo 2D");

  const aBlob = async (imagen: CanvasImageSource) => {
    gctx.fillStyle = COLORES.tinta;
    gctx.fillRect(0, 0, TABLERO_W, TABLERO_H);
    gctx.drawImage(imagen, 0, 0, TABLERO_W, TABLERO_H);

    const blob = await new Promise<Blob | null>((listo) => guarda.toBlob(listo, "image/jpeg", CALIDAD_FOTO));

    if (!blob) throw new Error("No se ha podido guardar un fotograma");

    return blob;
  };

  const salida = await aBlob((await toma(0)).imagen);
  let salidaVacia: TomaGuardada | null = null;
  const fases: FaseRodada[] = [];

  for (let fase = 1; fase <= nFases; fase += 1) {
    /*
      El reloj, ya dentro de la fase (`ARRANQUE`): la cabecera de la
      diapositiva dice la fase nueva desde la primera foto, como el rótulo.
      Las fichas se cuentan con el reloj puesto.
    */
    const inicio = fase - 1 + ARRANQUE;

    if (inicio !== ultimo) {
      await pon(inicio);
      ultimo = inicio;
    }

    const claves = [...cajasDe(nodo).keys()];
    const primera = await toma(inicio, new Set(claves));
    const sueltas = new Map<string, HTMLCanvasElement>();
    const tocan = (a: Caja, b: Caja) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const tandas: string[][] = [];

    for (const clave of primera.cajas.keys()) {
      const caja = primera.cajas.get(clave) as Caja;
      const tanda = tandas.find((t) => t.every((otra) => !tocan(caja, primera.cajas.get(otra) as Caja)));

      if (tanda) tanda.push(clave);
      else tandas.push([clave]);
    }

    for (const tanda of tandas) {
      const sola = await toma(inicio, new Set(claves.filter((c) => !tanda.includes(c))));

      for (const clave of tanda) {
        const recorte = recorta(sola.imagen, primera.imagen, primera.cajas.get(clave) as Caja);

        if (recorte) sueltas.set(clave, recorte);
      }
    }

    /* Lo que no está quieto al empezar (un balón que aparece) se queda en el fondo. */
    const aparta = new Set(sueltas.keys());
    const tomas: TomaGuardada[] = [{ fondo: await aBlob(primera.imagen), cajas: primera.cajas }];

    /* La salida sin fichas, en el instante 0 (con la cabecera de la salida). */
    if (fase === 1) {
      const vacia = await toma(0, aparta);

      salidaVacia = { fondo: await aBlob(vacia.imagen), cajas: vacia.cajas };
    }

    for (let k = 1; k <= FOTOS_POR_FASE; k += 1) {
      const t = await toma(fase - 1 + k / FOTOS_POR_FASE, aparta);

      tomas.push({ fondo: await aBlob(t.imagen), cajas: t.cajas });
    }

    const llegada = await aBlob((await toma(fase)).imagen);

    fases.push({ sueltas, tomas, llegada });
  }

  guarda.width = 0;
  guarda.height = 0;

  if (!salidaVacia) throw new Error("La diapositiva no tiene jugada");

  return { nFases, salida, salidaVacia, fases, grises: new Map() };
}

function cargaImagen(src: string) {
  return new Promise<HTMLImageElement>((listo, falla) => {
    const imagen = new Image();

    imagen.onload = () => listo(imagen);
    imagen.onerror = () => falla(new Error("No se ha podido leer un fotograma"));
    imagen.src = src;
  });
}

/* ------------------------------------------------------------------ */
/*  EL CODIFICADOR                                                     */
/* ------------------------------------------------------------------ */

function copiaBytes(origen: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(origen)
    ? new Uint8Array(origen.buffer, origen.byteOffset, origen.byteLength)
    : new Uint8Array(origen as ArrayBuffer);

  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength));

  salida.set(vista);

  return salida as Bytes;
}

export type Emisor = {
  lienzo: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ancho: number;
  alto: number;
  /** Los fotogramas ya mandados. */
  readonly cuadros: number;
  /** Manda el lienzo tal como está ahora. */
  emite: () => Promise<void>;
  /** Acaba y devuelve el MP4. */
  cierra: () => Promise<Blob>;
  /** Suelta el codificador (siempre, también si algo ha fallado). */
  suelta: () => void;
};

/**
 * Un MP4 H.264 a `caudal` bits por segundo. Con `software`, el codificador
 * del propio navegador y no el de la tarjeta gráfica: es el segundo intento
 * cuando el de la tarjeta falla (en Windows hay tarjetas que dicen que sí y
 * luego no codifican).
 */
export async function abreEmisor(
  ancho: number,
  alto: number,
  caudal: number,
  software = false,
  /**
   * «constant» para la tele: el caudal pedido de verdad (con «variable» el
   * codificador se quedaba en la mitad en lo quieto y escatimaba en las
   * carreras). «variable» para WhatsApp y el móvil, donde pesa el tamaño.
   */
  modo: "constant" | "variable" = "variable",
): Promise<Emisor> {
  const codec = await codecLamina(ancho, alto, caudal);

  if (!codec) throw new Error("Este navegador no sabe montar vídeo. Prueba con Chrome o Edge.");

  const lienzo = document.createElement("canvas");

  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext("2d");

  if (!ctx) throw new Error("El navegador no da un lienzo 2D");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  let fallo: Error | null = null;
  let cuadros = 0;
  const muxor = new MuxorMp4();
  const codificador = new VideoEncoder({
    output: (trozo, metadatos) => {
      const descripcion = metadatos?.decoderConfig?.description;

      if (descripcion) muxor.configuraVideo({ ancho, alto, descripcion: copiaBytes(descripcion) });

      const datos = new Uint8Array(new ArrayBuffer(trozo.byteLength));

      trozo.copyTo(datos);
      muxor.añadeVideo(datos as Bytes, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / FPS, trozo.type === "key");
    },
    error: (e) => {
      fallo = e instanceof Error ? e : new Error(String(e));
    },
  });

  const config: VideoEncoderConfig = {
    codec,
    width: ancho,
    height: alto,
    bitrate: caudal,
    bitrateMode: modo,
    framerate: FPS,
    latencyMode: "quality",
    hardwareAcceleration: software ? "prefer-software" : "no-preference",
    avc: { format: "avc" },
  };

  /* Si este codificador no sabe ir a caudal fijo, a caudal variable: mejor eso que nada. */
  const sabe = await VideoEncoder.isConfigSupported(config).then((r) => Boolean(r.supported)).catch(() => false);

  codificador.configure(sabe ? config : { ...config, bitrateMode: "variable" });

  /* El hueco en la cola, por su evento; el reloj es sólo la red si el codificador se cae. */
  const hueco = () =>
    new Promise<void>((listo) => {
      const sigue = () => {
        clearTimeout(red);
        codificador.removeEventListener("dequeue", sigue);
        listo();
      };
      const red = setTimeout(sigue, 1000);

      codificador.addEventListener("dequeue", sigue);
    });

  return {
    lienzo,
    ctx,
    ancho,
    alto,
    get cuadros() {
      return cuadros;
    },
    async emite() {
      if (fallo) throw fallo;

      const cuadro = new VideoFrame(lienzo, {
        timestamp: Math.round((cuadros * 1_000_000) / FPS),
        duration: Math.round(1_000_000 / FPS),
      });

      try {
        codificador.encode(cuadro, { keyFrame: cuadros % (FPS * 2) === 0 });
      } finally {
        cuadro.close();
      }

      cuadros += 1;

      while (codificador.encodeQueueSize > 6 && !fallo) await hueco();

      /* De vez en cuando, ceder el paso: la pantalla (y el panel) siguen vivos. */
      if (cuadros % 15 === 0) await respira();
    },
    async cierra() {
      await codificador.flush();

      if (fallo) throw fallo;

      codificador.close();

      return muxor.cierra();
    },
    suelta() {
      if (codificador.state !== "closed") codificador.close();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  2 · EL MONTAJE                                                     */
/* ------------------------------------------------------------------ */

/** Los segundos de cada tramo. */
export type Tiempos = { salida: number; movimiento: number; pausa: number; final: number };

/** Lo que la capa de encima necesita saber de cada fotograma. */
export type EstadoCapa = {
  /** 0 = salida; 1…n = cada fase (movimiento y respiro); n + 1 = llegada. */
  tramo: number;
  nFases: number;
  /** Segundos desde que empezó el tramo. */
  desde: number;
  /** De 0 a 1 en todo el segmento. */
  progreso: number;
  /** Dónde empieza cada tramo, en fracción del segmento (para la barra). */
  cortes: number[];
};

export function duracionSegmento(fases: number, t: Tiempos) {
  const c = (s: number) => Math.round(s * FPS);

  return (c(t.salida) + fases * c(t.movimiento) + Math.max(0, fases - 1) * c(t.pausa) + c(t.final)) / FPS;
}

/** Las fotos del fondo, decodificadas sólo las que hacen falta ahora (unas pocas a la vez). */
class Fondos {
  private hechos = new Map<Blob, Promise<ImageBitmap>>();

  de(blob: Blob) {
    const ya = this.hechos.get(blob);

    if (ya) return ya;

    const nuevo = createImageBitmap(blob);

    this.hechos.set(blob, nuevo);

    while (this.hechos.size > 4) {
      const viejo = this.hechos.keys().next().value as Blob;
      const promesa = this.hechos.get(viejo);

      this.hechos.delete(viejo);
      void promesa?.then((b) => b.close()).catch(() => undefined);
    }

    return nuevo;
  }

  suelta() {
    for (const promesa of this.hechos.values()) void promesa.then((b) => b.close()).catch(() => undefined);

    this.hechos.clear();
  }
}

/** Catmull-Rom: pasa por las cuatro y no hace esquinas en las fotos. */
const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

const centro = (c: Caja) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });

/** La ficha en gris (el resto, en el vídeo de un jugador), hecha una vez por fase. */
function gris(material: MaterialJugada, fase: number, clave: string, recorte: HTMLCanvasElement) {
  const k = `${fase}|${clave}`;
  const hecho = material.grises.get(k);

  if (hecho) return hecho;

  const lienzo = document.createElement("canvas");

  lienzo.width = recorte.width;
  lienzo.height = recorte.height;

  const ctx = lienzo.getContext("2d");

  if (ctx) {
    ctx.filter = "grayscale(1)";
    ctx.drawImage(recorte, 0, 0);
  }

  material.grises.set(k, lienzo);

  return lienzo;
}

/**
 * Pone las fichas sueltas sobre el fondo. Sin `destacado`, todas como son.
 * Con él (el id del jugador), él delante, más grande y con su brillo rosa, un
 * aro a sus pies y «TÚ» encima; el resto en gris y apagado, como en su PDF.
 */
function ponFichas(
  mx: CanvasRenderingContext2D,
  material: MaterialJugada,
  fase: number,
  sueltas: Map<string, HTMLCanvasElement>,
  donde: (clave: string) => { x: number; y: number } | null,
  destacado: string | undefined,
  reloj: number,
) {
  const suyas: [string, HTMLCanvasElement, { x: number; y: number }][] = [];

  for (const [clave, recorte] of sueltas) {
    const p = donde(clave);

    if (!p) continue;

    if (destacado && clave.startsWith(`${destacado}#`)) {
      suyas.push([clave, recorte, p]);
      continue;
    }

    if (destacado && clave !== "balon") {
      mx.globalAlpha = 0.42;
      mx.drawImage(gris(material, fase, clave, recorte), p.x - recorte.width / 2, p.y - recorte.height / 2);
      mx.globalAlpha = 1;
    } else {
      mx.drawImage(recorte, p.x - recorte.width / 2, p.y - recorte.height / 2);
    }
  }

  for (const [, recorte, p] of suyas) {
    const escala = 1.22;
    const w = recorte.width * escala;
    const h = recorte.height * escala;
    /* Los pies: al final de la foto (120 px de los ~170 de la ficha). */
    const alto = recorte.height - MARGEN_RECORTE * 2;
    const pies = p.y - recorte.height / 2 + MARGEN_RECORTE + alto * 0.7;
    const late = 0.5 + 0.5 * Math.sin(reloj * Math.PI * 2 * 1.2);

    mx.save();
    mx.strokeStyle = COLORES.rosa;
    mx.globalAlpha = 0.55 + 0.45 * late;
    mx.lineWidth = 6;
    mx.beginPath();
    mx.ellipse(p.x, pies, 66 + 8 * late, 20 + 2 * late, 0, 0, Math.PI * 2);
    mx.stroke();
    mx.restore();

    mx.save();
    mx.shadowColor = COLORES.rosa;
    mx.shadowBlur = 28;
    /* Crece desde los pies, como en la pizarra. */
    mx.drawImage(recorte, p.x - w / 2, pies - (pies - (p.y - recorte.height / 2)) * escala, w, h);
    mx.restore();

    /* «TÚ», encima de la cabeza. */
    const arriba = pies - (pies - (p.y - recorte.height / 2)) * escala + MARGEN_RECORTE * escala - 14;
    const cw = 76;
    const ch = 44;

    mx.save();
    mx.fillStyle = COLORES.rosa;
    mx.beginPath();
    mx.roundRect(p.x - cw / 2, arriba - ch, cw, ch, 10);
    mx.fill();
    mx.beginPath();
    mx.moveTo(p.x - 10, arriba);
    mx.lineTo(p.x + 10, arriba);
    mx.lineTo(p.x, arriba + 10);
    mx.closePath();
    mx.fill();
    mx.fillStyle = "#0F1E3D";
    mx.font = `700 32px ${FAMILIA_PORTADA}, Arial, sans-serif`;
    mx.textAlign = "center";
    mx.textBaseline = "middle";
    mx.fillText("TÚ", p.x, arriba - ch / 2 + 2);
    mx.restore();
  }
}

/**
 * Monta el segmento de una diapositiva en el emisor: salida, cada fase en
 * movimiento con su respiro y la llegada. `dibuja` pone la foto del tablero en
 * el lienzo del vídeo (a su medida); `capa`, lo de encima (rótulos, barra).
 * Devuelve el póster: la llegada limpia, sin capa.
 */
export async function montaJugada(
  e: Emisor,
  material: MaterialJugada,
  {
    tiempos,
    dibuja,
    capa,
    destacado,
    alAvance,
  }: {
    tiempos: Tiempos;
    dibuja: (ctx: CanvasRenderingContext2D, foto: CanvasImageSource) => void;
    capa: (ctx: CanvasRenderingContext2D, estado: EstadoCapa) => void;
    /** El id del jugador que se resalta (vídeo de su responsabilidad). */
    destacado?: string;
    alAvance?: (fraccion: number) => void;
  },
): Promise<{ poster: Blob | null }> {
  const { nFases } = material;
  const c = (s: number) => Math.round(s * FPS);
  const cuadrosSalida = c(tiempos.salida);
  const cuadrosMovimiento = c(tiempos.movimiento);
  const cuadrosPausa = c(tiempos.pausa);
  const cuadrosFinal = c(tiempos.final);
  const totales = cuadrosSalida + nFases * cuadrosMovimiento + Math.max(0, nFases - 1) * cuadrosPausa + cuadrosFinal;
  const inicios = [0];

  for (let fase = 1; fase <= nFases; fase += 1) inicios.push(cuadrosSalida + (fase - 1) * (cuadrosMovimiento + cuadrosPausa));

  inicios.push(totales - cuadrosFinal);

  const cortes = inicios.slice(1).map((inicio) => inicio / totales);
  const fondos = new Fondos();

  /* El fotograma en movimiento se compone aquí, a la medida del tablero, y luego pasa al vídeo. */
  const mezcla = document.createElement("canvas");

  mezcla.width = TABLERO_W;
  mezcla.height = TABLERO_H;

  const mx = mezcla.getContext("2d");

  if (!mx) throw new Error("El navegador no da un lienzo 2D");

  let hechos = 0;
  let tramo = 0;

  const emite = async (veces: number, foto: CanvasImageSource) => {
    for (let k = 0; k < veces; k += 1) {
      dibuja(e.ctx, foto);
      capa(e.ctx, {
        tramo,
        nFases,
        desde: (hechos - inicios[tramo]) / FPS,
        progreso: hechos / Math.max(1, totales - 1),
        cortes,
      });
      await e.emite();
      hechos += 1;
      alAvance?.(hechos / totales);
    }
  };

  /* Quieto: la foto entera o, con un jugador resaltado, el fondo con las fichas encima. */
  const quieto = async (veces: number, entera: Blob, fondo: TomaGuardada, fase: number) => {
    if (!destacado) {
      await emite(veces, await fondos.de(entera));

      return;
    }

    const base = await fondos.de(fondo.fondo);
    const sueltas = material.fases[fase - 1].sueltas;

    for (let k = 0; k < veces; k += 1) {
      mx.drawImage(base, 0, 0, TABLERO_W, TABLERO_H);
      ponFichas(mx, material, fase, sueltas, (clave) => (fondo.cajas.get(clave) ? centro(fondo.cajas.get(clave) as Caja) : null), destacado, hechos / FPS);
      await emite(1, mezcla);
    }
  };

  try {
    await quieto(cuadrosSalida, material.salida, material.salidaVacia, 1);

    let poster: Blob | null = null;

    for (let fase = 1; fase <= nFases; fase += 1) {
      tramo = fase;

      const { tomas, sueltas, llegada } = material.fases[fase - 1];
      const n = tomas.length - 1;
      /* El centro de cada ficha en cada foto (si en una no está, el de la más cercana). */
      const centros = new Map<string, { x: number; y: number }[]>();

      for (const clave of sueltas.keys()) {
        const lista: ({ x: number; y: number } | null)[] = tomas.map((t) => (t.cajas.get(clave) ? centro(t.cajas.get(clave) as Caja) : null));
        let ultimo = lista.find(Boolean) ?? null;

        if (!ultimo) continue;

        centros.set(
          clave,
          lista.map((p) => {
            if (p) ultimo = p;

            return ultimo as { x: number; y: number };
          }),
        );
      }

      for (let j = 0; j < cuadrosMovimiento; j += 1) {
        const s = (j / cuadrosMovimiento) * n;
        const k = Math.min(n - 1, Math.floor(s));
        const t = s - k;
        const a = await fondos.de(tomas[k].fondo);

        mx.globalAlpha = 1;
        mx.drawImage(a, 0, 0, TABLERO_W, TABLERO_H);

        if (t > 0) {
          const b = await fondos.de(tomas[k + 1].fondo);

          mx.globalAlpha = t;
          mx.drawImage(b, 0, 0, TABLERO_W, TABLERO_H);
          mx.globalAlpha = 1;
        }

        ponFichas(
          mx,
          material,
          fase,
          sueltas,
          (clave) => {
            const p = centros.get(clave);

            if (!p) return null;

            const p0 = p[Math.max(0, k - 1)];
            const p1 = p[k];
            const p2 = p[Math.min(n, k + 1)];
            const p3 = p[Math.min(n, k + 2)];

            return { x: catmull(p0.x, p1.x, p2.x, p3.x, t), y: catmull(p0.y, p1.y, p2.y, p3.y, t) };
          },
          destacado,
          hechos / FPS,
        );

        await emite(1, mezcla);
      }

      const fin = tomas[n];

      if (fase < nFases) {
        await quieto(cuadrosPausa, llegada, fin, fase);
      } else {
        /* El póster, limpio: la posición de llegada sin la barra ni el rótulo. */
        if (destacado) {
          mx.drawImage(await fondos.de(fin.fondo), 0, 0, TABLERO_W, TABLERO_H);
          ponFichas(mx, material, fase, sueltas, (clave) => (fin.cajas.get(clave) ? centro(fin.cajas.get(clave) as Caja) : null), destacado, 0);
          dibuja(e.ctx, mezcla);
        } else {
          dibuja(e.ctx, await fondos.de(llegada));
        }

        poster = await new Promise<Blob | null>((listo) => e.lienzo.toBlob(listo, "image/jpeg", 0.9));

        tramo = nFases + 1;
        await quieto(cuadrosFinal, llegada, fin, fase);
      }
    }

    return { poster };
  } finally {
    fondos.suelta();
    mezcla.width = 0;
    mezcla.height = 0;
  }
}

/** Lo que pesa el material de una diapositiva en memoria (para el tope de la caché). */
export function pesoMaterial(m: MaterialJugada) {
  return m.salida.size + m.salidaVacia.fondo.size + m.fases.reduce((s, f) => s + f.llegada.size + f.tomas.reduce((t, x) => t + x.fondo.size, 0), 0);
}
