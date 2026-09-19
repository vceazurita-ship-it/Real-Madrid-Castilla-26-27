/**
 * ACTUALIZAR LOS RESULTADOS DESDE LA APP.
 *
 * Es lo que hace el botón de Ajustes: leer de BeSoccer el 1-X-2 de la jornada
 * en curso y la anterior, y escribirlo. El trabajo de verdad está en
 * `lib/quiniela/actualiza.ts`, que comparte con el script nocturno del
 * ordenador del club (`scripts/quiniela-resultados.cjs`).
 *
 * **Hoy, desde Vercel, no puede**: a las IP de centro de datos BeSoccer les
 * contesta 200 con una página de tres kilobytes y sin calendario. Un bloqueo
 * disfrazado de respuesta buena, que es justo lo que tumbó la primera versión
 * de la comprobación —miraba el código HTTP y daba el visto bueno—. Cuando eso
 * pasa, el botón **deja el encargo** para el trabajo nocturno de ese ordenador,
 * que tiene una conexión normal y sí puede.
 *
 * **Y si el ordenador del club está escuchando, ni se intenta aquí**: su vigía
 * (`scripts/vigia.cjs`) recoge el encargo en segundos y lo hace con su
 * conexión. Intentarlo antes desde aquí sólo serían veinte segundos de páginas
 * vacías.
 *
 * Se deja montado igualmente: el día que BeSoccer deje de bloquear, o se ponga
 * un proxy en medio, esto funciona sin tocar nada. Y el `GET` contesta a la
 * pregunta que decide todo —**¿puede este servidor leer BeSoccer?**— contando
 * los partidos que consigue parsear, no el código que recibe.
 */

import { NextRequest, NextResponse } from "next/server";

import { vigiaVivo } from "@/lib/mantenimiento";
import { leeMantenimiento, pideEncargo } from "@/lib/mantenimientoServidor";
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
    const { vigia } = await leeMantenimiento();

    if (vigiaVivo(vigia)) {
      await pideEncargo("quiniela", slug);

      return NextResponse.json({ ok: true, encargado: true, cambios: 0, jornadas: [] });
    }

    const parte = await actualizaResultados(
      JORNADAS.includes(pedida) ? pedida : undefined,
    );

    /*
    | Si BeSoccer no deja mirar, el botón no se queda en nada: deja el encargo
    | de la quiniela, y el vigía del ordenador del club lo hace en cuanto se
    | encienda. Es lo único honesto que se puede ofrecer desde aquí.
    */
    if (parte.bloqueado) {
      await pideEncargo("quiniela", slug);

      return NextResponse.json({ ok: true, ...parte, encargado: true });
    }

    return NextResponse.json({ ok: true, ...parte });
  } catch (error) {
    console.error("[quiniela] actualizar", error);

    return NextResponse.json(
      { ok: false, error: "No se ha podido actualizar. Inténtalo en un momento." },
      { status: 503 },
    );
  }
}
