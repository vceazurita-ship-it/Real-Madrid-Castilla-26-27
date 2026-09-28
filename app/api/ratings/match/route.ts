import { NextRequest, NextResponse } from "next/server";

import { readSeason, writeSeason } from "@/lib/ratings/store";
import { MatchMeta, marcadorDe } from "@/lib/ratings/types";

export const dynamic = "force-dynamic";

/**
 * Cambios en un partido de Valoraciones que no son las notas.
 *
 * - `editar`: fecha, rival, competición, resultado y local/visitante de un
 *   partido ya guardado. El identificador NO cambia —de él cuelgan las
 *   valoraciones— y el partido queda marcado como `editado`, que es lo que
 *   hace que mande sobre lo que diga el calendario.
 * - `ocultar` / `mostrar`: quitar de la lista un partido del calendario sin
 *   tocar la hoja, que alimenta también el plan de partido.
 */

type Cambios = Partial<Pick<MatchMeta, "date" | "opponent" | "competition" | "isHome" | "result">>;

type Body = {
  accion?: "editar" | "ocultar" | "mostrar";
  matchId?: string;
  cambios?: Cambios;
};

const mal = (error: string, status = 400) =>
  NextResponse.json({ success: false, error }, { status });

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const matchId = String(body.matchId ?? "");

    if (!matchId) return mal("Falta el partido");

    const season = await readSeason();

    if (body.accion === "editar") {
      const guardado = season.matches[matchId];

      if (!guardado) return mal("Ese partido todavía no está guardado.", 404);

      const cambios = body.cambios ?? {};
      const opponent = String(cambios.opponent ?? guardado.match.opponent).trim();

      if (!opponent) return mal("El rival no puede quedar vacío.");

      const isHome = typeof cambios.isHome === "boolean" ? cambios.isHome : guardado.match.isHome;
      const result = String(cambios.result ?? guardado.match.result).trim();
      const date = String(cambios.date ?? guardado.match.date).trim();

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return mal("La fecha no es válida.");

      season.matches[matchId] = {
        ...guardado,
        match: {
          ...guardado.match,
          date,
          opponent,
          competition: String(cambios.competition ?? guardado.match.competition).trim() || "Amistoso",
          isHome,
          result,
          ...marcadorDe(result, isHome),
          editado: true,
        },
        updatedAt: new Date().toISOString(),
      };
    } else if (body.accion === "ocultar" || body.accion === "mostrar") {
      const ocultos = new Set(season.ocultos ?? []);

      if (body.accion === "ocultar") ocultos.add(matchId);
      else ocultos.delete(matchId);

      season.ocultos = [...ocultos];
    } else {
      return mal("No sé qué hay que hacer.");
    }

    const saved = await writeSeason(season);

    return NextResponse.json({ success: true, season: saved });
  } catch (error) {
    console.error("POST /api/ratings/match", error);

    return mal("Error guardando el partido", 500);
  }
}
