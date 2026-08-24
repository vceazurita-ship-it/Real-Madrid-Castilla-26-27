import { NextRequest, NextResponse } from "next/server";
import { getPlayerImage } from "@/lib/playerImages";
import { isHiddenPlayer } from "@/lib/hiddenPlayers";

/**
 * Plantilla y disponibilidad de la sesión.
 *
 * GET  devuelve la plantilla con el estado que tiene ahora mismo.
 * POST guarda los estados escogidos a mano, con la misma acción de Apps Script
 *      (`appendSessionStatus`) que usa el importador automático.
 */

const APPS_SCRIPT = process.env.APPS_SCRIPT_URL!;

interface SheetPlayer {
  ID_JUGADOR: string;
  NOMBRE: string;
  APODO?: string;
  POSICION?: string;
  DORSAL?: string;
  FOTO_URL?: string;
  LICENCIA?: string;
  ACTIVO?: string;
  ESTADO?: string;
}

async function fetchSquad(): Promise<SheetPlayer[]> {
  const response = await fetch(`${APPS_SCRIPT}?action=jugadoresSesion`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudo obtener la plantilla.");
  }

  const data = await response.json();

  const squad: SheetPlayer[] = Array.isArray(data) ? data : [];

  // Los jugadores ocultos siguen llegando de la hoja; se descartan aquí para
  // que ninguna pantalla los reciba.
  return squad.filter(
    (player) => !isHiddenPlayer(player.NOMBRE, player.APODO)
  );
}

function toClient(player: SheetPlayer) {
  return {
    id: player.ID_JUGADOR,
    nombre: player.NOMBRE,
    apodo: player.APODO || player.NOMBRE,
    posicion: player.POSICION ?? "",
    dorsal: Number(player.DORSAL) || undefined,
    foto:
      getPlayerImage(player.NOMBRE, "cerca", player.ID_JUGADOR) ??
      player.FOTO_URL ??
      "",
    licencia: player.LICENCIA || "RMCF Castilla",
    activo: String(player.ACTIVO ?? "").toUpperCase() !== "FALSE",
    estado: player.ESTADO || "NO CONVOCADO",
  };
}

export async function GET() {
  try {
    const squad = await fetchSquad();

    return NextResponse.json({ success: true, players: squad.map(toClient) });
  } catch (error) {
    console.error("[training-session] GET", error);

    return NextResponse.json(
      { success: false, error: "No se pudo cargar la plantilla." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const fecha: string =
      body?.fecha ?? new Date().toISOString().slice(0, 10);

    const estados: Record<string, string> = body?.estados ?? {};

    const squad = await fetchSquad();

    const players = squad.map((player) => ({
      ...toClient(player),
      estado: estados[player.ID_JUGADOR] ?? "NO CONVOCADO",
    }));

    const response = await fetch(APPS_SCRIPT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "appendSessionStatus",
        fecha,
        replace: true,
        imageUrl: body?.imageUrl ?? "",
        players,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.error || "Error guardando la sesión.");
    }

    return NextResponse.json({ success: true, total: players.length });
  } catch (error) {
    console.error("[training-session] POST", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la disponibilidad.",
      },
      { status: 500 }
    );
  }
}
