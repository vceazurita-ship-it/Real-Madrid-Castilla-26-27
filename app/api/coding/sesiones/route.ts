import { NextRequest, NextResponse } from "next/server";

import { listDocs } from "@/lib/docStore";
import type { ClipCoding, SesionCoding } from "@/lib/coding/modelo";
import { idVigente } from "@/lib/fichajes";
import { normalizePlayerName } from "@/lib/playerImages";

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
 *   Con `nombre` (uno o varios), el cruce es por nombre: ver `esDelJugador`.
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

/*
| ¿Es de este jugador el clip?
|
| Era `clip.jugadorId === jugador`, y los JUG-XX de la hoja se han renumerado:
| un clip guardado con el JUG-13 de Thiago salía hoy en la ficha de Diego
| Lacosta, que es quien tiene ahora ese número. El clip copia el nombre al
| crearse (`jugadorNombre`), y el nombre es lo que se mueve con la persona.
|
| - Si la ficha manda sus nombres (`nombre`, puede venir varias veces: el de
|   la pantalla, el completo de la hoja y el apodo) y el clip tiene nombre,
|   manda el nombre: igual → suyo; distinto → de otro, aunque el ID coincida.
|   Un nombre que sólo coincide en parte («Thiago» dentro de «Thiago
|   Pitarch») vale si además el ID cuadra.
| - Sin nombres (o clip sin nombre), el ID, traducido en los dos lados con
|   `idVigente` (JUG-54 → JUG-51).
*/
function esDelJugador(
  clip: ClipCoding,
  jugador: string,
  nombres: string[],
): boolean {
  if (clip.sujeto === "colectivo") return false;

  const mismoId = idVigente(clip.jugadorId) === idVigente(jugador);
  const suyo = normalizePlayerName(clip.jugadorNombre ?? "");

  if (nombres.length === 0 || !suyo) return mismoId;

  if (nombres.includes(suyo)) return true;

  const fichas = suyo.split(" ");
  const enParte = nombres.some((nombre) => {
    const piezas = nombre.split(" ");

    return (
      fichas.every((pieza) => piezas.includes(pieza)) ||
      piezas.every((pieza) => fichas.includes(pieza))
    );
  });

  return enParte && mismoId;
}

export async function GET(request: NextRequest) {
  const jugador = request.nextUrl.searchParams.get("jugador");
  const ambito = request.nextUrl.searchParams.get("ambito");
  const nombres = [
    ...new Set(
      request.nextUrl.searchParams
        .getAll("nombre")
        .map(normalizePlayerName)
        .filter(Boolean),
    ),
  ];

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
        if (!esDelJugador(clip, jugador, nombres)) continue;

        const parametros = new URLSearchParams({ ambito: sesion.ambito });

        if (sesion.ambito === "rival") parametros.set("equipo", sesion.titulo);
        else parametros.set("partido", sesion.refId);

        /*
        | El vídeo DEL CLIP, no el de la sesión.
        |
        | Una sesión puede tener varias cámaras o las dos partes en ficheros
        | distintos, y los minutos de un corte sólo significan algo dentro del
        | suyo: con la fuente de la sesión, la biblioteca del jugador cortaba
        | el minuto 12 de la segunda parte sobre la primera.
        */
        const suyo =
          (clip.video
            ? (sesion.videos ?? []).find((video) => video.nombre === clip.video)
            : (sesion.videos ?? [])[0]) ??
          sesion.fuente ??
          null;

        clips.push({
          ...clip,
          fuente: suyo,
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
