/**
 * /api/acceso (18/11/2026): entrar como jugador, salir, y el acceso (admin).
 * Ver lib/acceso/*.
 *
 *   GET                                  → { rol, hayCodigoJugadores (= acceso de jugadores abierto), hayCodigoStaff }
 *   POST { accion: "jugador", usuario, contrasena }   → cookie de jugador (19/11: cada uno con la suya)
 *   POST { accion: "salir" }             → fuera todas las cookies de acceso
 *   POST { accion: "jugadores", abierto }            (admin) abre o cierra el acceso de jugadores
 *   POST { accion: "codigos", staff }    (admin) cambia el código del staff; "" lo quita
 *   POST { accion: "echar-jugadores" }   (admin) cierra todas las sesiones de jugador
 */
import { NextRequest, NextResponse } from "next/server";

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { apuntaIntento, cifraCodigo, guardaAcceso, leeAcceso, MINIMO_CODIGO, nuevaVersion, puertaCerrada } from "@/lib/acceso/codigos";
import { cuentaDe, esContrasenaDeJugador, normaliza } from "@/lib/acceso/jugadores";
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
    const quien = normaliza(String(cuerpo.usuario ?? "")).slice(0, 60);
    if (!quien) return mal("Escribe tu usuario: tu nombre y tu primer apellido.");
    const cerrada = await puertaCerrada(quien);
    if (cerrada) return mal(`Demasiados intentos. Prueba dentro de ${cerrada} min.`, 429);
    const doc = await leeAcceso();
    if (!doc.jugadores) return mal("El acceso de jugadores está cerrado ahora mismo: pregunta al cuerpo técnico.", 403);
    const cuenta = cuentaDe(quien, String(cuerpo.contrasena ?? ""));
    await apuntaIntento(Boolean(cuenta), quien);
    if (!cuenta) return mal("Usuario o contraseña no son. Usuario: nombre y primer apellido; contraseña: tu nombre y 123.", 401);
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
    if (!doc.jugadores) return mal("El acceso de jugadores está cerrado.");
    await guardaAcceso({ ...doc, jugadores: { ...doc.jugadores, version: nuevaVersion() } });
    return NextResponse.json({ ok: true });
  }

  const respuesta = (d: typeof doc) => NextResponse.json({ ok: true, hayCodigoJugadores: Boolean(d.jugadores), hayCodigoStaff: Boolean(d.staff) });

  if (accion === "jugadores") {
    const siguiente = { ...doc };
    if (cuerpo.abierto === true) siguiente.jugadores = { version: nuevaVersion(), desde: ahora };
    else delete siguiente.jugadores;
    await guardaAcceso(siguiente);
    return respuesta(siguiente);
  }

  if (accion === "codigos") {
    const siguiente = { ...doc };
    const codigo = String(cuerpo.staff ?? "").trim();
    if (!codigo) delete siguiente.staff;
    else {
      if (codigo.length < MINIMO_CODIGO) return mal(`El código tiene que tener al menos ${MINIMO_CODIGO} caracteres.`);
      /* Si fuera la contraseña de un jugador, ese jugador podría darse de alta como alguien del staff. */
      if (esContrasenaDeJugador(codigo)) return mal("Ese código es la contraseña de un jugador: pon otro.");
      siguiente.staff = { ...cifraCodigo(codigo), desde: ahora };
    }
    await guardaAcceso(siguiente);
    return respuesta(siguiente);
  }

  return mal("Acción desconocida.");
}
