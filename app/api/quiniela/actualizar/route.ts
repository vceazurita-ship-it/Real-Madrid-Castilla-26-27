/**
 * ACTUALIZAR LOS RESULTADOS DESDE LA APP.
 *
 * Es lo que hace el botón de Ajustes: leer de BeSoccer el 1-X-2 de la jornada
 * en curso y la anterior, y escribirlo. El trabajo de verdad está en
 * `lib/quiniela/actualiza.ts`, que comparte con el cron nocturno
 * (`/api/quiniela/cron`).
 *
 * El `GET` no actualiza nada: dice si **este servidor puede leer BeSoccer**,
 * que es de lo que depende todo lo demás.
 */

import { NextRequest, NextResponse } from "next/server";

import { actualizaResultados } from "@/lib/quiniela/actualiza";
import { leeCalendario, traePaginaConFetch } from "@/lib/quiniela/besoccer";
import { JORNADAS } from "@/lib/quiniela/modelo";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

export const dynamic = "force-dynamic";

/* Nueve páginas de BeSoccer, de una en una: hay que darle margen. */
export const maxDuration = 60;

/**
 * ¿Puede este servidor leer BeSoccer?
 *
 * Pide **una** página y devuelve el código que contesta. Sirve para saber, sin
 * escribir nada y sin tener que entrar, si el botón va a poder hacer su
 * trabajo. Va sin sesión a propósito: lo único que se aprende llamándola es un
 * número de tres cifras sobre una web pública.
 */
export async function GET() {
  const { cuerpo, estado } = await traePaginaConFetch(
    "https://es.besoccer.com/equipo/partidos/teruel",
  );

  /*
  | No basta con el código: contestar 200 no es contestar lo mismo.
  |
  | El 18/09/2026 el servidor recibía un 200 y **una página sin el calendario**:
  | la comprobación decía que sí y luego no había ni un partido que leer. Así
  | que se cuenta lo que de verdad se puede parsear, que es lo que importa.
  */
  const partidos = cuerpo ? leeCalendario(cuerpo) : [];

  const puede = estado === 200 && partidos.length > 0;

  return NextResponse.json({
    ok: true,
    estado,
    puede,
    bytes: cuerpo.length,
    partidos: partidos.length,
    /* Para poder ver de un vistazo si lo que llega es otra cosa. */
    muestra: partidos.slice(0, 3).map((uno) => `J${uno.jornada} ${uno.cuando.slice(0, 10)} ${uno.local}-${uno.visitante}`),
    tienePanel: cuerpo.includes('panel-title">Partidos'),
    dice: puede
      ? `BeSoccer contesta y trae ${partidos.length} partidos: el botón puede actualizar al momento.`
      : estado === 200
        ? `BeSoccer contesta 200 pero la página que llega no trae el calendario (${cuerpo.length} bytes). Los resultados los pondrá el ordenador del club.`
        : `BeSoccer contesta ${estado} desde el servidor: los resultados los pondrá el ordenador del club.`,
  });
}

export async function POST(request: NextRequest) {
  const slug = leeSesion(request.cookies.get(COOKIE)?.value);

  if (!slug || !PERSONA_POR_SLUG.has(slug)) {
    return NextResponse.json(
      { ok: false, error: "Entra con tu correo para poder actualizar." },
      { status: 401 },
    );
  }

  const pedida = Number(request.nextUrl.searchParams.get("jornada"));

  try {
    const parte = await actualizaResultados(
      JORNADAS.includes(pedida) ? pedida : undefined,
    );

    return NextResponse.json({ ok: true, ...parte });
  } catch (error) {
    console.error("[quiniela] actualizar", error);

    return NextResponse.json(
      { ok: false, error: "No se ha podido actualizar. Inténtalo en un momento." },
      { status: 503 },
    );
  }
}
