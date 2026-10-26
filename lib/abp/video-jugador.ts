/**
 * El vídeo de balón parado de UN jugador (26/10/2026): su PDF en movimiento.
 *
 * Vertical 1080×1920, como el PDF, para verlo en el móvil. Abre con su
 * portada y luego, acción a acción, la hoja de esa acción con la diapositiva
 * VIVA: la salida quieta, cada fase en movimiento (su cara corre con su
 * flecha) y una pausa para leer su cometido. Un aro rosa con «TÚ» le sigue
 * todo el rato, para que no tenga que buscarse.
 *
 * El motor es el de `components/abp/pizarra/VideoJugada.tsx` (WebCodecs + el
 * `MuxorMp4` del coding). Quien llama pone las fotos de la diapositiva: aquí
 * no se toca el DOM.
 */

import { MuxorMp4 } from "@/lib/coding/mp4";
import type { Bytes } from "@/lib/export/zip";
import { FPS_LAMINA, codecLamina } from "@/lib/tactics/lamina";
import {
  HOJA_H,
  HOJA_W,
  marcaJugador,
  pintaAccion,
  pintaPortada,
  type CometidoAccion,
  type ContextoJugador,
} from "@/lib/abp/pizarra-jugador";

/** Segundos de cada tramo. La pausa final es la lectura de su cometido. */
const PORTADA_S = 1.8;
const SALIDA_S = 0.8;
const MOVIMIENTO_S = 1.4;
const PAUSA_FASE_S = 0.4;
const LECTURA_S = 1.8;
/** Fundido entre hojas (agente editor-video): un corte seco entre acciones despista. */
const FUNDIDO = 8;
/** Fotos de la diapositiva por fase en movimiento; el resto de fotogramas las repiten. */
export const FOTOS_POR_FASE = 8;

/* 3,5 Mb/s: sin bloques en las flechas finas y, con 15-30 s, por debajo de
   los 16 MB que WhatsApp acepta como adjunto. Va sin sonido a propósito. */
const CAUDAL = 3_500_000;

export type FotoDiapositiva = { imagen: HTMLImageElement; punto: { x: number; y: number } | null };

function copiaBytes(origen: AllowSharedBufferSource): Bytes {
  const vista = ArrayBuffer.isView(origen)
    ? new Uint8Array(origen.buffer, origen.byteOffset, origen.byteLength)
    : new Uint8Array(origen as ArrayBuffer);

  const salida = new Uint8Array(new ArrayBuffer(vista.byteLength));

  salida.set(vista);

  return salida as Bytes;
}

export function duracionVideoJugador(fases: number[]) {
  return (
    PORTADA_S +
    fases.reduce((total, n) => total + SALIDA_S + n * (MOVIMIENTO_S + PAUSA_FASE_S) + LECTURA_S, 0)
  );
}

export async function videoJugador(opciones: {
  cx: ContextoJugador;
  retrato: HTMLImageElement | null;
  acciones: CometidoAccion[];
  /** Fases de cada acción (0 = foto fija). */
  fases: number[];
  /** La diapositiva `accion` en el instante `tiempo` (en fases), con él medido. */
  foto: (accion: number, tiempo: number) => Promise<FotoDiapositiva>;
  alProgreso?: (fraccion: number) => void;
}): Promise<Blob> {
  const { cx, retrato, acciones, fases, foto, alProgreso } = opciones;

  const codec = await codecLamina(HOJA_W, HOJA_H, CAUDAL);

  if (!codec) throw new Error("Este navegador no sabe montar vídeo. Prueba con Chrome o Edge.");

  const lienzo = document.createElement("canvas");

  lienzo.width = HOJA_W;
  lienzo.height = HOJA_H;

  const ctx = lienzo.getContext("2d") as CanvasRenderingContext2D;

  let fallo: Error | null = null;
  const muxor = new MuxorMp4();
  const codificador = new VideoEncoder({
    output: (trozo, metadatos) => {
      const descripcion = metadatos?.decoderConfig?.description;

      if (descripcion) muxor.configuraVideo({ ancho: HOJA_W, alto: HOJA_H, descripcion: copiaBytes(descripcion) });

      const datos = new Uint8Array(new ArrayBuffer(trozo.byteLength));

      trozo.copyTo(datos);
      muxor.añadeVideo(datos as Bytes, Math.max(0, trozo.timestamp), trozo.duration || 1_000_000 / FPS_LAMINA, trozo.type === "key");
    },
    error: (e) => {
      fallo = e instanceof Error ? e : new Error(String(e));
    },
  });

  try {
    codificador.configure({
      codec,
      width: HOJA_W,
      height: HOJA_H,
      bitrate: CAUDAL,
      framerate: FPS_LAMINA,
      latencyMode: "quality",
      avc: { format: "avc" },
    });

    let cuadros = 0;

    /* La última imagen emitida, para fundir la hoja siguiente sobre ella. */
    const anterior = document.createElement("canvas");

    anterior.width = HOJA_W;
    anterior.height = HOJA_H;

    const ctxAnterior = anterior.getContext("2d") as CanvasRenderingContext2D;
    let fundir = 0;

    /* Cada fotograma se recompone: el aro late aunque la diapositiva esté quieta. */
    const emite = async (veces: number, pinta: (segundos: number) => void) => {
      for (let k = 0; k < veces; k += 1) {
        if (fallo) throw fallo;

        pinta(cuadros / FPS_LAMINA);

        if (fundir > 0) {
          ctx.globalAlpha = fundir / (FUNDIDO + 1);
          ctx.drawImage(anterior, 0, 0);
          ctx.globalAlpha = 1;
          fundir -= 1;
        }

        const cuadro = new VideoFrame(lienzo, {
          timestamp: Math.round((cuadros * 1_000_000) / FPS_LAMINA),
          duration: Math.round(1_000_000 / FPS_LAMINA),
        });

        try {
          codificador.encode(cuadro, { keyFrame: cuadros % (FPS_LAMINA * 2) === 0 });
        } finally {
          cuadro.close();
        }

        cuadros += 1;

        while (codificador.encodeQueueSize > 6 && !fallo) await new Promise((resuelve) => setTimeout(resuelve, 5));
      }
    };

    const fotosTotales = acciones.reduce((total, _, i) => total + 1 + fases[i] * FOTOS_POR_FASE, 0);
    let hechas = 0;
    const avanza = () => alProgreso?.(++hechas / Math.max(1, fotosTotales));

    const total = acciones.length + 1;

    await emite(Math.round(PORTADA_S * FPS_LAMINA), () => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, HOJA_W, HOJA_H);
      pintaPortada(ctx, cx, retrato, acciones);
    });

    /* Un error del codificador corta antes de pedir otra foto (son lentas). */
    const sigue = () => {
      if (fallo) throw fallo;
    };

    for (const [orden, accion] of acciones.entries()) {
      sigue();

      /* Lo que se veía al acabar lo anterior, para fundir encima. */
      ctxAnterior.drawImage(lienzo, 0, 0);
      fundir = FUNDIDO;

      const hoja = (vista: FotoDiapositiva) => (segundos: number) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, HOJA_W, HOJA_H);
        pintaAccion(ctx, cx, accion, vista.imagen, orden + 2, total);

        if (vista.punto) marcaJugador(ctx, vista.punto, segundos);
      };

      let vista = await foto(orden, 0);
      avanza();
      await emite(Math.round(SALIDA_S * FPS_LAMINA), hoja(vista));

      const n = fases[orden];
      const porFoto = (MOVIMIENTO_S * FPS_LAMINA) / FOTOS_POR_FASE;

      for (let fase = 1; fase <= n; fase += 1) {
        let emitidos = 0;

        for (let k = 1; k <= FOTOS_POR_FASE; k += 1) {
          sigue();
          vista = await foto(orden, fase - 1 + k / FOTOS_POR_FASE);
          avanza();

          const hasta = Math.round(k * porFoto);

          await emite(hasta - emitidos, hoja(vista));
          emitidos = hasta;
        }

        await emite(Math.round(PAUSA_FASE_S * FPS_LAMINA), hoja(vista));
      }

      await emite(Math.round(LECTURA_S * FPS_LAMINA), hoja(vista));
    }

    await codificador.flush();

    if (fallo) throw fallo;

    return muxor.cierra();
  } finally {
    /* Abierto a medias deja a Chrome sin codificadores para el siguiente. */
    if (codificador.state !== "closed") codificador.close();
  }
}
