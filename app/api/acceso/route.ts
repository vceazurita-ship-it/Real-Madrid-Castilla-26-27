/**
 * /api/acceso (18/11/2026): entrar como jugador, salir, y los códigos (admin).
 * Ver lib/acceso/*.
 *
 *   GET                                  → { rol, hayCodigoJugadores, hayCodigoStaff }
 *   POST { accion: "jugador", codigo }   → cookie de jugador
 *   POST { accion: "salir" }             → fuera todas las cookies de acceso
 *   POST { accion: "codigos", jugadores?, staff? }   (admin) cambia uno o los dos; "" lo quita
 *   POST { accion: "echar-jugadores" }   (admin) cierra todas las sesiones de jugador
 */
import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { aciertaCodigo, apuntaIntento, cifraCodigo, guardaAcceso, leeAcceso, MINIMO_CODIGO, nuevaVersion, puertaCerrada } from "@/lib/acceso/codigos";
import {
  COOKIE_JUGADOR,
  COOKIE_QUINIELA,
  COOKIE_ROL,
  creaSesionJugador,
  OPCIONES_COOKIE_JUGADOR,
  OPCIONES_COOKIE_ROL,
  rolDe,
} from "@/lib/acceso/sesion";

export const dynamic = "force-dynamic";

const mal = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(request: NextRequest) {
  const doc = await leeAcceso().catch(() => ({}) as Awaited<ReturnType<typeof leeAcceso>>);
  return NextResponse.json({ ok: true, rol: rolDe(request.cookies), hayCodigoJugadores: Boolean(doc.jugadores), hayCodigoStaff: Boolean(doc.staff) });
}

export async function POST(request: NextRequest) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return mal("No se ha entendido la petición.");
  }
  const accion = String(cuerpo.accion ?? "");

  if (accion === "salir") {
    const r = NextResponse.json({ ok: true });
    for (const c of [COOKIE_JUGADOR, COOKIE_ROL, COOKIE_QUINIELA, COOKIE_ADMIN]) r.cookies.set(c, "", { path: "/", maxAge: 0 });
    return r;
  }

  if (accion === "jugador") {
    const cerrada = await puertaCerrada();
    if (cerrada) return mal(`Demasiados intentos. Prueba dentro de ${cerrada} min.`, 429);
    const doc = await leeAcceso();
    if (!doc.jugadores) return mal("El acceso de jugadores aún no está abierto: pide el código al cuerpo técnico.", 403);
    const bien = aciertaCodigo(String(cuerpo.codigo ?? ""), doc.jugadores);
    await apuntaIntento(bien);
    if (!bien) return mal("Ese código no es.", 401);
    const r = NextResponse.json({ ok: true, rol: "jugador" });
    r.cookies.set(COOKIE_JUGADOR, creaSesionJugador(doc.jugadores.version), OPCIONES_COOKIE_JUGADOR);
    r.cookies.set(COOKIE_ROL, "jugador", OPCIONES_COOKIE_ROL);
    return r;
  }

  /* Lo demás, sólo el administrador. */
  if (!esAdmin(request.cookies.get(COOKIE_ADMIN)?.value)) return mal("Sólo el administrador.", 401);

  const doc = await leeAcceso();
  const ahora = new Date().toISOString();

  if (accion === "echar-jugadores") {
    if (!doc.jugadores) return mal("No hay código de jugadores.");
    await guardaAcceso({ ...doc, jugadores: { ...doc.jugadores, version: nuevaVersion() } });
    return NextResponse.json({ ok: true });
  }

  if (accion === "codigos") {
    const siguiente = { ...doc };
    for (const lado of ["jugadores", "staff"] as const) {
      if (!(lado in cuerpo)) continue;
      const codigo = String(cuerpo[lado] ?? "").trim();
      if (!codigo) {
        delete siguiente[lado];
        continue;
      }
      if (codigo.length < MINIMO_CODIGO) return mal(`El código tiene que tener al menos ${MINIMO_CODIGO} caracteres.`);
      if (lado === "jugadores") siguiente.jugadores = { ...cifraCodigo(codigo), version: nuevaVersion(), desde: ahora };
      else siguiente.staff = { ...cifraCodigo(codigo), desde: ahora };
    }
    /* Si fueran iguales, un jugador podría darse de alta como alguien del staff. */
    const igual =
      (typeof cuerpo.jugadores === "string" && cuerpo.jugadores.trim() && aciertaCodigo(cuerpo.jugadores, siguiente.staff)) ||
      (typeof cuerpo.staff === "string" && cuerpo.staff.trim() && aciertaCodigo(cuerpo.staff, siguiente.jugadores));
    if (igual) return mal("Los dos códigos no pueden ser iguales.");
    await guardaAcceso(siguiente);
    return NextResponse.json({ ok: true, hayCodigoJugadores: Boolean(siguiente.jugadores), hayCodigoStaff: Boolean(siguiente.staff) });
  }

  return mal("Acción desconocida.");
}
