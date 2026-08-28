import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { creaZip, type EntradaZip } from "@/lib/export/zip";
import {
  cortaClip,
  enCarpetaTemporal,
  entradaDeFuente,
  guardaDataUrl,
  hayFfmpeg,
  leeBytes,
  pegaVideos,
  portadaComoVideo,
  segmentoNormalizado,
  sondeaVideo,
  type FuenteServidor,
  type ModoCorte,
} from "@/lib/coding/servidor";

/**
 * Convierte los clips codificados en vídeo de verdad.
 *
 * Tres formas de salir, que son las tres que pide el trabajo del analista:
 *
 * - **`clip`**: un corte suelto, para mandarlo por el grupo.
 * - **`zip`**: varios cortes ordenados en carpetas por jugador, que es como se
 *   entregan los deberes de la semana.
 * - **`unificado`**: todos los cortes pegados en un solo vídeo, con la portada
 *   del jugador delante. Es el formato de la charla individual: se abre, se
 *   pone y no hay que ir saltando de fichero.
 *
 * El vídeo original no se copia en ningún momento: ffmpeg lee de la carpeta de
 * partidos o de la URL sólo los segundos de cada clip.
 */

export const runtime = "nodejs";

/*
 * Un partido entero son cientos de cortes, pero el techo lo pone el
 * despliegue: en Vercel el plan Hobby no acepta más de 300 s por función y el
 * build se cae si se pide más. Si algún día se sube de plan, se sube aquí.
 */
export const maxDuration = 300;

type ClipPedido = {
  /** Ruta dentro del ZIP, o nombre del fichero suelto. */
  nombre: string;
  inicioMs: number;
  finMs: number;
  /**
   * De qué vídeo sale, si no es el de la petición.
   *
   * Lo usa la biblioteca de la ficha del jugador: sus cortes vienen de varios
   * partidos, y un vídeo unificado de «todo lo suyo» tiene que poder leer de
   * todos ellos.
   */
  fuente?: FuenteServidor;
};

type Peticion = {
  /** El vídeo por defecto. Puede faltar si cada clip trae el suyo. */
  fuente?: FuenteServidor;
  clips: ClipPedido[];
  modo: ModoCorte;
  formato: "clip" | "zip" | "unificado";
  /** Nombre del fichero que se descarga, sin extensión. */
  nombre: string;
  /** PNG en `data:` URL: la portada que abre el vídeo unificado. */
  portada?: string;
  portadaSegundos?: number;
};

const MAX_CLIPS = 400;

function nombreSeguro(valor: string, respaldo: string) {
  const limpio = String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ._-]/g, "")
    .trim();

  return limpio || respaldo;
}

/** Deja la ruta del ZIP en algo que cualquier descompresor acepte. */
function rutaSegura(valor: string, respaldo: string) {
  const trozos = String(valor ?? "")
    .split("/")
    .map((trozo) => nombreSeguro(trozo, ""))
    .filter(Boolean);

  return trozos.length ? trozos.join("/") : respaldo;
}

export async function POST(request: NextRequest) {
  if (!hayFfmpeg()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "En este servidor no está el motor de vídeo (ffmpeg). Los clips " +
          "siguen guardados; sólo no se pueden cortar aquí.",
      },
      { status: 501 },
    );
  }

  let peticion: Peticion;

  try {
    peticion = (await request.json()) as Peticion;
  } catch {
    return NextResponse.json(
      { ok: false, error: "La petición no es válida." },
      { status: 400 },
    );
  }

  const clips = Array.isArray(peticion.clips) ? peticion.clips : [];

  if (clips.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No hay clips que exportar." },
      { status: 400 },
    );
  }

  if (clips.length > MAX_CLIPS) {
    return NextResponse.json(
      {
        ok: false,
        error: `Son demasiados clips de una vez (${clips.length}). Exporta por jugador o por categoría.`,
      },
      { status: 400 },
    );
  }

  const entrada = peticion.fuente ? entradaDeFuente(peticion.fuente) : null;

  /* Cada clip puede traer el suyo; el de la petición es el de por defecto. */
  const entradaDe = (clip: ClipPedido) =>
    clip.fuente ? entradaDeFuente(clip.fuente) : entrada;

  const sinVideo = clips.filter((clip) => !entradaDe(clip));

  if (sinVideo.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No se puede leer el vídeo del partido: revisa que siga en la " +
          "carpeta de partidos o que el enlace sea http(s).",
      },
      { status: 400 },
    );
  }

  const modo: ModoCorte = peticion.modo === "rapido" ? "rapido" : "preciso";

  const base = nombreSeguro(peticion.nombre, "clips");

  try {
    return await enCarpetaTemporal(async (carpeta) => {
      /* ------------------------------------------------ un solo clip */

      if (peticion.formato === "clip") {
        const clip = clips[0];

        const destino = path.join(carpeta, "clip.mp4");

        await cortaClip({
          entrada: entradaDe(clip)!,
          inicioMs: clip.inicioMs,
          finMs: clip.finMs,
          modo,
          destino,
        });

        const bytes = await leeBytes(destino);

        return new Response(bytes, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="${nombreSeguro(clip.nombre, base)}.mp4"`,
          },
        });
      }

      /* ------------------------------------------------ vídeo unificado */

      if (peticion.formato === "unificado") {
        /* La medida del vídeo montado la manda el primer corte. */
        const datos = await sondeaVideo(entradaDe(clips[0])!);

        const trozos: string[] = [];

        if (peticion.portada) {
          const imagen = await guardaDataUrl(
            peticion.portada,
            path.join(carpeta, "portada.png"),
          );

          trozos.push(
            await portadaComoVideo({
              imagen,
              duracionMs: Math.max(
                1000,
                Math.round((peticion.portadaSegundos ?? 4) * 1000),
              ),
              ancho: datos.ancho,
              alto: datos.alto,
              fps: datos.fps,
              destino: path.join(carpeta, "000-portada.mp4"),
            }),
          );
        }

        for (const [indice, clip] of clips.entries()) {
          trozos.push(
            await segmentoNormalizado({
              entrada: entradaDe(clip)!,
              inicioMs: clip.inicioMs,
              finMs: clip.finMs,
              ancho: datos.ancho,
              alto: datos.alto,
              fps: datos.fps,
              destino: path.join(
                carpeta,
                `${String(indice + 1).padStart(3, "0")}-trozo.mp4`,
              ),
            }),
          );
        }

        const destino = await pegaVideos(
          trozos,
          path.join(carpeta, "unificado.mp4"),
        );

        const bytes = await leeBytes(destino);

        return new Response(bytes, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="${base}.mp4"`,
          },
        });
      }

      /* ------------------------------------------------ paquete ZIP */

      const entradas: EntradaZip[] = [];

      for (const [indice, clip] of clips.entries()) {
        const destino = path.join(carpeta, `${indice}.mp4`);

        await cortaClip({
          entrada: entradaDe(clip)!,
          inicioMs: clip.inicioMs,
          finMs: clip.finMs,
          modo,
          destino,
        });

        entradas.push({
          nombre: `${rutaSegura(clip.nombre, `clip-${indice + 1}`)}.mp4`,
          datos: await leeBytes(destino),
        });
      }

      const zip = creaZip(entradas);

      return new Response(zip, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${base}.zip"`,
        },
      });
    });
  } catch (error) {
    console.error("[coding/export]", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? `No se ha podido cortar el vídeo: ${error.message}`
            : "No se ha podido cortar el vídeo.",
      },
      { status: 500 },
    );
  }
}
