import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { NextRequest, NextResponse } from "next/server";

import { resuelveRutaDeVideo } from "@/lib/coding/servidor";

/**
 * Sirve un partido de la carpeta local, por trozos.
 *
 * El reproductor tiene que poder saltar al minuto 73 de un fichero de cuatro
 * gigas sin descargarlo entero: eso es exactamente lo que hace la cabecera
 * `Range`, y por eso esta ruta la implementa en vez de devolver el fichero de
 * una pieza. Sin ella, `<video>` no deja mover la barra de progreso.
 *
 * La ruta llega del cliente, así que `resuelveRutaDeVideo` la encierra dentro
 * de la carpeta de partidos y sólo deja pasar extensiones de vídeo.
 */

export const runtime = "nodejs";

const TIPOS: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".ts": "video/mp2t",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
};

export async function GET(request: NextRequest) {
  const relativa = request.nextUrl.searchParams.get("ruta") ?? "";

  const absoluta = resuelveRutaDeVideo(relativa);

  if (!absoluta) {
    return NextResponse.json(
      { ok: false, error: "Ruta de vídeo no válida." },
      { status: 400 },
    );
  }

  let tamano = 0;

  try {
    tamano = (await stat(absoluta)).size;
  } catch {
    return NextResponse.json(
      { ok: false, error: "El vídeo ya no está en la carpeta." },
      { status: 404 },
    );
  }

  const tipo = TIPOS[path.extname(absoluta).toLowerCase()] ?? "video/mp4";

  const rango = request.headers.get("range");

  if (!rango) {
    const flujo = createReadStream(absoluta);

    return new Response(Readable.toWeb(flujo) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": tipo,
        "Content-Length": String(tamano),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=0",
      },
    });
  }

  const trozos = /bytes=(\d*)-(\d*)/.exec(rango);

  const desde = trozos?.[1] ? Number(trozos[1]) : 0;

  const hasta = trozos?.[2] ? Number(trozos[2]) : tamano - 1;

  if (
    !Number.isFinite(desde) ||
    !Number.isFinite(hasta) ||
    desde < 0 ||
    desde > hasta ||
    desde >= tamano
  ) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${tamano}` },
    });
  }

  const fin = Math.min(hasta, tamano - 1);

  const flujo = createReadStream(absoluta, { start: desde, end: fin });

  return new Response(Readable.toWeb(flujo) as ReadableStream, {
    status: 206,
    headers: {
      "Content-Type": tipo,
      "Content-Length": String(fin - desde + 1),
      "Content-Range": `bytes ${desde}-${fin}/${tamano}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=0",
    },
  });
}
