import { writeFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { creaZip, type EntradaZip } from "@/lib/export/zip";
import {
  borraCarpetaTemporal,
  cortaClip,
  cortaClipConParadas,
  creaCarpetaTemporal,
  entradaDeFuente,
  guardaImagen,
  hayFfmpeg,
  imagenComoVideo,
  leeBytes,
  pegaVideos,
  respuestaDeFichero,
  segmentoNormalizado,
  sondeaVideo,
  type FuenteServidor,
  type ModoCorte,
  type ParadaPedida,
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
  /**
   * Las pizarras que hay que quemar dentro de este clip.
   *
   * Cada una es el fotograma ya compuesto por el navegador —vídeo + dibujo, a
   * la resolución del vídeo— y el vídeo se para ahí el rato que diga. Ver
   * `cortaClipConParadas`.
   *
   * `imagen` es un enlace del bucket —lo normal— o una `data:` URL. Van por
   * separado porque quince fotogramas dentro de esta petición la pasan de los
   * 4,5 MB que aguanta el despliegue: ver `lib/coding/imagenes.ts`.
   */
  pizarras?: { imagen: string; enMs: number; duracionMs: number }[];
};

type Peticion = {
  /** El vídeo por defecto. Puede faltar si cada clip trae el suyo. */
  fuente?: FuenteServidor;
  clips: ClipPedido[];
  modo: ModoCorte;
  formato: "clip" | "zip" | "unificado";
  /** Nombre del fichero que se descarga, sin extensión. */
  nombre: string;
  /**
   * La portada que abre el vídeo unificado.
   *
   * Enlace del bucket, o `data:` URL. Lo mismo que las pizarras: pintada a la
   * resolución del lienzo, ella sola pasaba del techo de la petición.
   */
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

  /*
   * La carpeta de trabajo no se borra en un `finally`.
   *
   * El resultado sale **por trozos** —un vídeo unificado son decenas de megas,
   * y una respuesta que no vaya por trozos la corta el despliegue en 4,5 MB—,
   * así que el fichero tiene que seguir en su sitio mientras se descarga. La
   * borra `respuestaDeFichero` cuando el flujo se cierra; aquí sólo se limpia
   * si la cosa se tuerce antes de llegar a devolverlo.
   */
  const carpeta = await creaCarpetaTemporal();

  try {
    /*
     * El sondeo se guarda: son cientos de cortes y casi siempre del mismo
     * fichero, y la biblioteca de un jugador junta varios partidos.
     */
    const sondeos = new Map<string, Awaited<ReturnType<typeof sondeaVideo>>>();

    const sondeaUnaVez = async (entrada: string) => {
      const guardado = sondeos.get(entrada);

      if (guardado) return guardado;

      const nuevo = await sondeaVideo(entrada);

      sondeos.set(entrada, nuevo);

      return nuevo;
    };

    /* Las pizarras del clip, escritas a disco para dárselas a ffmpeg. */
    const paradasDe = async (clip: ClipPedido, indice: number) => {
      const pedidas = Array.isArray(clip.pizarras) ? clip.pizarras : [];

      const listas: ParadaPedida[] = [];

      for (const [numero, pizarra] of pedidas.entries()) {
        if (!pizarra?.imagen) continue;

        listas.push({
          imagen: await guardaImagen({
            fuente: pizarra.imagen,
            carpeta,
            nombre: `pizarra-${indice}-${numero}`,
          }),
          enMs: Math.max(0, Number(pizarra.enMs) || 0),
          duracionMs: Math.max(500, Number(pizarra.duracionMs) || 2000),
        });
      }

      return listas;
    };

    /* ------------------------------------------------ un solo clip */

    if (peticion.formato === "clip") {
      const clip = clips[0];

      const destino = path.join(carpeta, "clip.mp4");

      const paradas = await paradasDe(clip, 0);

      if (paradas.length > 0) {
        const datos = await sondeaUnaVez(entradaDe(clip)!);

        await cortaClipConParadas({
          entrada: entradaDe(clip)!,
          inicioMs: clip.inicioMs,
          finMs: clip.finMs,
          ancho: datos.ancho,
          alto: datos.alto,
          fps: datos.fps,
          audio: datos.audio,
          paradas,
          carpeta,
          prefijo: "clip",
          destino,
        });
      } else {
        await cortaClip({
          entrada: entradaDe(clip)!,
          inicioMs: clip.inicioMs,
          finMs: clip.finMs,
          modo,
          destino,
        });
      }

      return respuestaDeFichero({
        archivo: destino,
        carpeta,
        nombre: `${nombreSeguro(clip.nombre, base)}.mp4`,
        tipo: "video/mp4",
      });
    }

    /* ------------------------------------------------ vídeo unificado */

    if (peticion.formato === "unificado") {
      /*
       * La medida del vídeo montado la manda el primer corte, pero el sonido
       * se pregunta por fuente: la biblioteca de un jugador junta cortes de
       * varios partidos, y basta con que uno venga mudo —lo normal en lo que
       * sale de una mesa de edición— para que el pegado quede roto.
       */
      const datos = await sondeaUnaVez(entradaDe(clips[0])!);

      const trozos: string[] = [];

      if (peticion.portada) {
        const imagen = await guardaImagen({
          fuente: peticion.portada,
          carpeta,
          nombre: "portada",
        });

        trozos.push(
          await imagenComoVideo({
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
        const entradaClip = entradaDe(clip)!;

        const suyo = await sondeaUnaVez(entradaClip);

        const paradas = await paradasDe(clip, indice);

        const destinoTrozo = path.join(
          carpeta,
          `${String(indice + 1).padStart(3, "0")}-trozo.mp4`,
        );

        trozos.push(
          paradas.length > 0
            ? await cortaClipConParadas({
                entrada: entradaClip,
                inicioMs: clip.inicioMs,
                finMs: clip.finMs,
                ancho: datos.ancho,
                alto: datos.alto,
                fps: datos.fps,
                audio: suyo.audio,
                paradas,
                carpeta,
                prefijo: `u${indice}`,
                destino: destinoTrozo,
              })
            : await segmentoNormalizado({
                entrada: entradaClip,
                inicioMs: clip.inicioMs,
                finMs: clip.finMs,
                ancho: datos.ancho,
                alto: datos.alto,
                fps: datos.fps,
                audio: suyo.audio,
                destino: destinoTrozo,
              }),
        );
      }

      const destino = await pegaVideos(
        trozos,
        path.join(carpeta, "unificado.mp4"),
      );

      return respuestaDeFichero({
        archivo: destino,
        carpeta,
        nombre: `${base}.mp4`,
        tipo: "video/mp4",
      });
    }

    /* ------------------------------------------------ paquete ZIP */

    const entradas: EntradaZip[] = [];

    for (const [indice, clip] of clips.entries()) {
      const destino = path.join(carpeta, `${indice}.mp4`);

      const paradas = await paradasDe(clip, indice);

      if (paradas.length > 0) {
        const datos = await sondeaUnaVez(entradaDe(clip)!);

        await cortaClipConParadas({
          entrada: entradaDe(clip)!,
          inicioMs: clip.inicioMs,
          finMs: clip.finMs,
          ancho: datos.ancho,
          alto: datos.alto,
          fps: datos.fps,
          audio: datos.audio,
          paradas,
          carpeta,
          prefijo: `z${indice}`,
          destino,
        });
      } else {
        await cortaClip({
          entrada: entradaDe(clip)!,
          inicioMs: clip.inicioMs,
          finMs: clip.finMs,
          modo,
          destino,
        });
      }

      entradas.push({
        nombre: `${rutaSegura(clip.nombre, `clip-${indice + 1}`)}.mp4`,
        datos: await leeBytes(destino),
      });
    }

    /*
     * El ZIP sale por trozos como el vídeo: se escribe al lado de los cortes
     * y se sirve desde ahí. Un partido entero en clips sueltos pasa de sobra
     * de los 4,5 MB que aguanta una respuesta de una sola pieza.
     */
    const zip = path.join(carpeta, "paquete.zip");

    await writeFile(
      zip,
      Buffer.from(await creaZip(entradas).arrayBuffer()),
    );

    return respuestaDeFichero({
      archivo: zip,
      carpeta,
      nombre: `${base}.zip`,
      tipo: "application/zip",
    });
  } catch (error) {
    await borraCarpetaTemporal(carpeta);

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
