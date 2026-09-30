import { NextRequest, NextResponse } from "next/server";

import {
  ConflictoDeGuardado,
  cambiaTemporada,
} from "../_lib/cambiaTemporada";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { matchId } = (await request.json()) as { matchId?: string };

    if (!matchId) {
      return NextResponse.json(
        { success: false, error: "Falta el partido" },
        { status: 400 }
      );
    }

    /* Condicional, como save: un borrado a la vez que otro guardado ya no
       resucita ni se come el partido del otro. */
    const saved = await cambiaTemporada((season) => {
      delete season.matches[matchId];
    });

    return NextResponse.json({ success: true, season: saved });
  } catch (error) {
    console.error("POST /api/ratings/delete", error);

    if (error instanceof ConflictoDeGuardado) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Error borrando las valoraciones" },
      { status: 500 }
    );
  }
}
