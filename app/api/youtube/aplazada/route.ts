import { NextRequest, NextResponse } from "next/server";

import { hayB2 } from "@/lib/almacen/b2-servidor";
import { acabaAplazada, empiezaAplazada, TROZO_BYTES, trozoAplazada } from "@/lib/coding/youtube-aplazadas";

/**
 * CODING · guardar un vídeo que YouTube no admite hoy (cuota agotada) para
 * subirlo solo cuando Google la renueve. Ver `lib/coding/youtube-aplazadas.ts`.
 *
 * - `?accion=empieza` (JSON: bytes, tipo, titulo, descripcion) → { id, trozo }
 * - `?accion=trozo&id=…&n=…` (el trozo en crudo, ≤ 16 MB)
 * - `?accion=acaba` (JSON: id, ficha?) → queda esperando cuota
 */

export const dynamic = "force-dynamic";

const mal = (mensaje: string, estado = 400) => NextResponse.json({ ok: false, error: mensaje }, { status: estado });

export async function POST(request: NextRequest) {
  if (!hayB2()) return mal("El servidor no tiene dónde guardar el vídeo (faltan las llaves de Backblaze).", 503);

  const accion = request.nextUrl.searchParams.get("accion");

  try {
    if (accion === "empieza") {
      const cuerpo = (await request.json()) as Record<string, unknown>;
      const bytes = Number(cuerpo.bytes ?? 0);

      if (!Number.isFinite(bytes) || bytes <= 0) return mal("El vídeo no tiene tamaño.");

      return NextResponse.json({
        ok: true,
        ...(await empiezaAplazada({
          bytes,
          tipo: String(cuerpo.tipo ?? "video/mp4"),
          titulo: String(cuerpo.titulo ?? "Vídeo del coding"),
          descripcion: String(cuerpo.descripcion ?? ""),
        })),
      });
    }

    if (accion === "trozo") {
      const id = request.nextUrl.searchParams.get("id") ?? "";
      const n = Number(request.nextUrl.searchParams.get("n") ?? 0);

      if (!id || !Number.isInteger(n) || n < 1) return mal("Trozo sin número.");

      const datos = Buffer.from(await request.arrayBuffer());

      if (!datos.length || datos.length > TROZO_BYTES) return mal("Trozo vacío o demasiado grande.");

      await trozoAplazada(id, n, datos);

      return NextResponse.json({ ok: true });
    }

    if (accion === "acaba") {
      const cuerpo = (await request.json()) as { id?: string; ficha?: { jugadorId?: string; nombre?: string } };

      if (!cuerpo.id) return mal("Falta el vídeo.");

      const ficha = cuerpo.ficha?.jugadorId ? { jugadorId: String(cuerpo.ficha.jugadorId), nombre: String(cuerpo.ficha.nombre ?? "") } : undefined;

      await acabaAplazada(cuerpo.id, ficha);

      return NextResponse.json({ ok: true });
    }

    return mal("Acción desconocida.");
  } catch (error) {
    console.error("[youtube] aplazada", accion, error);

    return mal(error instanceof Error ? error.message : "No se ha podido guardar el vídeo.", 500);
  }
}
