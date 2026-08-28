import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  EXTENSIONES_VIDEO,
  carpetaDeVideos,
  hayFfmpeg,
} from "@/lib/coding/servidor";

/**
 * Los partidos que hay en la máquina donde corre la app.
 *
 * El coding necesita el vídeo entero y un partido pesa gigas: subirlo desde el
 * navegador no es una opción. Así que el analista deja el fichero en la
 * carpeta de partidos —`CODING_VIDEOS_DIR`, o `videos/` en la raíz— y desde
 * aquí se elige; el reproductor lo pide por trozos y ffmpeg corta sobre el
 * mismo fichero, sin copiarlo a ninguna parte.
 *
 * Sólo se devuelve el nombre, el peso y la ruta relativa. La ruta absoluta no
 * sale nunca de aquí.
 */

export const runtime = "nodejs";

export type VideoDePartido = {
  /** Ruta relativa dentro de la carpeta, que es lo que viaja al cliente. */
  ruta: string;
  nombre: string;
  tamano: number;
  modificado: string;
};

/** Hasta dos niveles de carpetas: `2026/jornada-01/partido.mp4`. */
async function busca(base: string, relativa: string, profundidad: number) {
  const encontrados: VideoDePartido[] = [];

  const absoluta = path.join(base, relativa);

  const entradas = await readdir(absoluta, { withFileTypes: true });

  for (const entrada of entradas) {
    if (entrada.name.startsWith(".")) continue;

    const dentro = relativa ? `${relativa}/${entrada.name}` : entrada.name;

    if (entrada.isDirectory()) {
      if (profundidad <= 0) continue;

      encontrados.push(...(await busca(base, dentro, profundidad - 1)));

      continue;
    }

    if (!EXTENSIONES_VIDEO.includes(path.extname(entrada.name).toLowerCase())) {
      continue;
    }

    const datos = await stat(path.join(base, dentro));

    encontrados.push({
      ruta: dentro,
      nombre: entrada.name,
      tamano: datos.size,
      modificado: datos.mtime.toISOString(),
    });
  }

  return encontrados;
}

export async function GET() {
  const carpeta = carpetaDeVideos();

  if (!existsSync(carpeta)) {
    return NextResponse.json({
      ok: true,
      carpeta,
      existe: false,
      ffmpeg: hayFfmpeg(),
      videos: [],
    });
  }

  try {
    const videos = await busca(carpeta, "", 2);

    videos.sort((a, b) => b.modificado.localeCompare(a.modificado));

    return NextResponse.json({
      ok: true,
      carpeta,
      existe: true,
      ffmpeg: hayFfmpeg(),
      videos,
    });
  } catch (error) {
    console.error("[coding/videos]", error);

    return NextResponse.json(
      { ok: false, error: "No se ha podido leer la carpeta de partidos." },
      { status: 500 },
    );
  }
}
