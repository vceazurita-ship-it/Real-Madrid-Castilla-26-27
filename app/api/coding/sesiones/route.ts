import { NextRequest, NextResponse } from "next/server";

import { listDocs } from "@/lib/docStore";
import type { ClipCoding, SesionCoding } from "@/lib/coding/modelo";

/**
 * Todo lo codificado, visto desde fuera del coding.
 *
 * La ficha de un jugador —la nuestra y la de un rival— quiere enseñar sus
 * cortes, y esos cortes están repartidos por una sesión distinta en cada
 * partido. Esta ruta recorre las sesiones guardadas y devuelve:
 *
 * - sin `jugador`: la lista de sesiones, para saber qué hay codificado;
 * - con `jugador`: **sus** clips de todas las sesiones, ya con el partido al
 *   que pertenece cada uno, que es lo que pinta la biblioteca de la ficha.
 *
 * No duplica nada: la fuente sigue siendo el documento de cada sesión.
 */

export const runtime = "nodejs";

type Resumen = {
  clave: string;
  ambito: string;
  refId: string;
  titulo: string;
  clips: number;
  actualizadoEn: string | null;
};

export type ClipConPartido = ClipCoding & {
  sesion: string;
  sesionTitulo: string;
  ambito: string;
  refId: string;
  /** El vídeo del que sale: sin esto no se puede cortar desde la ficha. */
  fuente: SesionCoding["fuente"];
  /** Cómo abrir el coding justo en este clip. */
  enlace: string;
};

export async function GET(request: NextRequest) {
  const jugador = request.nextUrl.searchParams.get("jugador");
  const ambito = request.nextUrl.searchParams.get("ambito");

  try {
    const documentos = await listDocs<SesionCoding>(
      ambito ? `coding:${ambito}:` : "coding:",
    );

    /* La configuración vive con el mismo prefijo y no es una sesión. */
    const sesiones = documentos.filter(
      (documento) =>
        documento.key !== "coding:config" &&
        Array.isArray(documento.data?.clips),
    );

    if (!jugador) {
      const resumen: Resumen[] = sesiones.map((documento) => ({
        clave: documento.key,
        ambito: documento.data.ambito,
        refId: documento.data.refId,
        titulo: documento.data.titulo,
        clips: documento.data.clips.length,
        actualizadoEn: documento.updatedAt,
      }));

      return NextResponse.json({ ok: true, sesiones: resumen });
    }

    const clips: ClipConPartido[] = [];

    for (const documento of sesiones) {
      const sesion = documento.data;

      for (const clip of sesion.clips) {
        if (clip.jugadorId !== jugador) continue;

        const parametros = new URLSearchParams({ ambito: sesion.ambito });

        if (sesion.ambito === "rival") parametros.set("equipo", sesion.titulo);
        else parametros.set("partido", sesion.refId);

        clips.push({
          ...clip,
          fuente: sesion.fuente ?? null,
          sesion: documento.key,
          sesionTitulo: sesion.titulo,
          ambito: sesion.ambito,
          refId: sesion.refId,
          enlace: `/coding?${parametros.toString()}`,
        });
      }
    }

    clips.sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));

    return NextResponse.json({ ok: true, clips });
  } catch (error) {
    console.error("[coding/sesiones]", error);

    return NextResponse.json(
      { ok: false, error: "No se han podido leer las sesiones de coding." },
      { status: 500 },
    );
  }
}
