/**
 * EL RESPALDO DE OPTA (17/11/2026).
 *
 * GET ?que=abp-favor|abp-contra|banda-favor|banda-contra|transiciones|faltas
 *     [&etiquetadas=AAAA-MM-DD,…]  (transiciones y faltas: las fechas que ya
 *     están etiquetadas en Hudl, que no hace falta mandar)
 *
 * Devuelve `{ partidos, filas }` con las filas de esa pantalla sacadas de
 * Opta (lib/opta-respaldo/calcula.ts). Qué partido entra lo decide la
 * pantalla con lib/opta-respaldo/etiquetado.ts: lo etiquetado manda.
 */
import { NextRequest, NextResponse } from "next/server";

import { fechaEtiquetada } from "@/lib/opta-respaldo/etiquetado";
import { respaldoOpta } from "@/lib/opta-respaldo/servidor";
import { QUE_RESPALDO, type QueRespaldo } from "@/lib/opta-respaldo/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const que = request.nextUrl.searchParams.get("que") as QueRespaldo | null;
  if (!que || !QUE_RESPALDO.includes(que)) {
    return NextResponse.json({ success: false, error: "¿Qué pantalla?" }, { status: 400 });
  }
  const etiquetadas = (request.nextUrl.searchParams.get("etiquetadas") ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f));

  try {
    const r = await respaldoOpta();
    const fuera = <T extends { fecha: string }>(xs: T[]) => xs.filter((x) => !fechaEtiquetada(x.fecha, etiquetadas));
    const filas =
      que === "abp-favor"
        ? r.abpFavor
        : que === "abp-contra"
          ? r.abpContra
          : que === "banda-favor"
            ? r.bandaFavor
            : que === "banda-contra"
              ? r.bandaContra
              : que === "transiciones"
                ? fuera(r.transiciones)
                : fuera(r.faltas);
    return NextResponse.json(
      { success: true, generado: r.generado, partidos: r.partidos, filas },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    console.error("[opta/respaldo]", error);
    return NextResponse.json({ success: false, error: "No se pudo leer Opta." }, { status: 500 });
  }
}
