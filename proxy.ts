/**
 * LA PUERTA DE LA PLATAFORMA (18/11/2026). Ver lib/acceso/sesion.ts y rutas.ts.
 *
 *   - Sin haber entrado: las pantallas llevan a /entrar y las API dicen 401,
 *     salvo lo público (rutaPublica) y las máquinas con su cabecera interna.
 *   - Jugadores: sólo sus pantallas (las demás llevan a /jugadores) y nada de
 *     lo que rellena el staff por la API (403).
 *   - Cuerpo técnico: todo, como siempre.
 *
 * Las propias rutas siguen comprobando lo suyo (admin, quiniela, cron): esto
 * es una capa más, no la única.
 */
import { NextResponse, type NextRequest } from "next/server";

import { readDoc } from "@/lib/docStore";
import { CABECERA_INTERNA, COOKIE_JUGADOR, esInterna, leeSesionJugador, rolDe } from "@/lib/acceso/sesion";
import { apiVetadaJugador, pantallaDeJugador, rutaPublica } from "@/lib/acceso/rutas";

/* La versión vigente del código de jugadores, con 5 minutos de memoria: al
   cambiar el código en Ajustes, las sesiones viejas caen en ≤ 5 min. */
let version: { valor: string | null; hasta: number } = { valor: null, hasta: 0 };

async function versionVigente(): Promise<string | null> {
  if (Date.now() < version.hasta) return version.valor;
  try {
    const { data } = await readDoc<{ jugadores?: { version?: string } }>("secreto:acceso");
    version = { valor: data?.jugadores?.version ?? null, hasta: Date.now() + 5 * 60_000 };
  } catch {
    /* Sin base de datos no se echa a nadie: se vuelve a mirar en un minuto. */
    version = { valor: version.valor, hasta: Date.now() + 60_000 };
  }
  return version.valor;
}

const noAutorizado = (estado: number, error: string) => NextResponse.json({ ok: false, error }, { status: estado });

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const metodo = request.method.toUpperCase();
  const esApi = pathname.startsWith("/api/");

  if (rutaPublica(pathname, metodo, searchParams)) return NextResponse.next();
  if (esInterna(request.headers.get(CABECERA_INTERNA))) return NextResponse.next();

  let rol = rolDe(request.cookies);

  if (rol === "jugador") {
    const suya = leeSesionJugador(request.cookies.get(COOKIE_JUGADOR)?.value);
    const vigente = await versionVigente();
    /* Código cambiado o quitado en Ajustes: esa sesión ya no vale. */
    if (!vigente || (suya && suya !== vigente)) rol = null;
  }

  if (rol === "staff") return NextResponse.next();

  if (rol === "jugador") {
    if (esApi) {
      return apiVetadaJugador(pathname, metodo, searchParams.get("key")) ? noAutorizado(403, "Esto no está en el acceso de jugadores.") : NextResponse.next();
    }
    if (pantallaDeJugador(pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL("/jugadores", request.url));
  }

  if (esApi) return noAutorizado(401, "Hay que entrar en la plataforma.");

  const destino = new URL("/entrar", request.url);
  const volver = `${pathname}${request.nextUrl.search}`;
  if (volver !== "/") destino.searchParams.set("volver", volver);
  const r = NextResponse.redirect(destino);
  /* Una cookie de jugador que ya no vale se borra, para que /entrar no rebote. */
  if (request.cookies.get(COOKIE_JUGADOR)) r.cookies.delete(COOKIE_JUGADOR);
  return r;
}

export const config = {
  /* Fuera lo estático (_next y cualquier fichero con extensión: iconos, sw.js,
     manifest, vídeos, fotos). */
  matcher: ["/((?!_next/static|_next/image|.*\\.[A-Za-z0-9]+$).*)"],
};
