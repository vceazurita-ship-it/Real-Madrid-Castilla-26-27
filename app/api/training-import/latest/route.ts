import { NextResponse } from "next/server";

const APPS_SCRIPT = process.env.APPS_SCRIPT_URL!;

export async function GET() {
  try {
    const response = await fetch(
  `${APPS_SCRIPT}?action=jugadoresSesion`,
  {
    cache: "no-store",
  }
);

    if (!response.ok) {
      throw new Error("No se pudo obtener la última sesión.");
    }

    const jugadores = await response.json();

    console.log("JUGADORES SESION");
console.log(jugadores);

    const imageUrl =
      Array.isArray(jugadores) && jugadores.length > 0
        ? jugadores[0].IMAGE_URL ?? ""
        : "";

    return NextResponse.json({ imageUrl });

  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        imageUrl: "",
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}