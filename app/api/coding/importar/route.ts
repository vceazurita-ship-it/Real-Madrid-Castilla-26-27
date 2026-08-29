import { createWriteStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as FlujoWeb } from "node:stream/web";

import { NextRequest, NextResponse } from "next/server";

import { destinoDeImportacion } from "@/lib/coding/servidor";

/**
 * Lleva a la carpeta de partidos el vídeo que se abrió del ordenador.
 *
 * Es la salida al único callejón sin salida del coding: un fichero abierto con
 * el selector del navegador se reproduce y se codifica, pero el servidor no lo
 * ve —el navegador no dice dónde está— y por tanto ffmpeg no puede cortarlo.
 * Hasta ahora eso se avisaba y ahí se acababa: había que ir a buscar el
 * fichero, copiarlo a mano a la carpeta y volver a elegirlo.
 *
 * El cuerpo de la petición **es el fichero**, en crudo y a chorro: nada de
 * `FormData`, que obligaría a juntar los cuatro gigas en memoria antes de
 * empezar a escribir. Aquí se enchufa el flujo de entrada directamente al
 * fichero de destino, así que la app no crece ni con un partido de tres horas.
 *
 * Esto es una función de la máquina del analista, que es donde corre la app
 * cuando se codifica: la copia va por el bucle local y a velocidad de disco.
 * En un servidor desplegado el disco es de sólo lectura y la escritura falla;
 * el error se devuelve tal cual y la pantalla lo enseña.
 */

export const runtime = "nodejs";

/* Una copia de varios gigas no cabe en el plazo de una función desplegada, y
   tampoco tiene sentido allí. En local no hay más techo que el disco. */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const nombre = request.nextUrl.searchParams.get("nombre") ?? "";

  const destino = await destinoDeImportacion(nombre).catch(() => null);

  if (!destino) {
    return NextResponse.json(
      {
        ok: false,
        error: "Ese fichero no parece un vídeo de partido.",
      },
      { status: 400 },
    );
  }

  if (!request.body) {
    return NextResponse.json(
      { ok: false, error: "No ha llegado el vídeo." },
      { status: 400 },
    );
  }

  try {
    await pipeline(
      Readable.fromWeb(request.body as unknown as FlujoWeb<Uint8Array>),
      createWriteStream(destino.absoluta),
    );
  } catch (error) {
    /* Una copia a medias es peor que ninguna: se vería en la lista de la
       carpeta y ffmpeg se caería con ella dentro de media hora. */
    await rm(destino.absoluta, { force: true }).catch(() => undefined);

    console.error("[coding/importar]", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? `No se ha podido copiar el vídeo: ${error.message}`
            : "No se ha podido copiar el vídeo.",
      },
      { status: 500 },
    );
  }

  const { size } = await stat(destino.absoluta);

  return NextResponse.json({
    ok: true,
    ruta: destino.relativa,
    nombre: path.basename(destino.relativa),
    tamano: size,
  });
}
