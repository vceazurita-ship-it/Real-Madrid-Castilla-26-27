/**
 * ENTRAR EN LA QUINIELA.
 *
 * Registro, entrada, salida y cambio de contraseña. Todo pasa por aquí porque
 * las cuentas viven bajo una clave `secreto:`, y ésas **no se sirven al
 * navegador** por `/api/docs`: se leen y se escriben sólo en el servidor.
 *
 * Los mensajes de error están escritos para que se entiendan sin ser técnico,
 * pero **sin decir de más**: «ese correo no está registrado» le contaría a
 * cualquiera quién juega y quién no. Al entrar, si algo falla, se dice lo
 * mismo pase lo que pase.
 */

import { NextRequest, NextResponse } from "next/server";

import { readDoc, writeDoc } from "@/lib/docStore";
import {
  CLAVE_CUENTAS,
  CUENTAS_VACIAS,
  MINIMO_CLAVE,
  acierta,
  cifra,
  claveInicialDe,
  cuentaDeCorreo,
  limpiaCorreo,
  type CuentaQuiniela,
  type DocumentoCuentas,
} from "@/lib/quiniela/cuentas";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";
import { COOKIE, OPCIONES_COOKIE, creaSesion, leeSesion } from "@/lib/quiniela/sesion";

export const dynamic = "force-dynamic";

async function dameCuentas(): Promise<DocumentoCuentas> {
  const { data } = await readDoc<DocumentoCuentas>(CLAVE_CUENTAS);

  return data?.cuentas ? data : CUENTAS_VACIAS;
}

const guarda = (doc: DocumentoCuentas) =>
  writeDoc(CLAVE_CUENTAS, "quiniela-cuentas", doc);

const mal = (error: string, estado = 400) =>
  NextResponse.json({ ok: false, error }, { status: estado });

/** Lo que la pantalla necesita saber de quien ha entrado. Nunca el hash. */
const suyo = (cuenta: CuentaQuiniela) => ({
  slug: cuenta.slug,
  correo: cuenta.correo,
  nombre: PERSONA_POR_SLUG.get(cuenta.slug)?.nombre ?? cuenta.slug,
  inicial: cuenta.inicial,
});

/** Quién ha entrado, si es que hay alguien. */
export async function GET(request: NextRequest) {
  const slug = leeSesion(request.cookies.get(COOKIE)?.value);

  if (!slug) return NextResponse.json({ ok: true, yo: null });

  const doc = await dameCuentas();

  const cuenta = doc.cuentas[slug];

  /* La cuenta pudo borrarse con la sesión viva: entonces no hay nadie. */
  return NextResponse.json({ ok: true, yo: cuenta ? suyo(cuenta) : null });
}

export async function POST(request: NextRequest) {
  let cuerpo: Record<string, unknown>;

  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return mal("No se ha entendido la petición.");
  }

  const accion = String(cuerpo.accion ?? "");

  /* ---------------------------- SALIR ---------------------------- */

  if (accion === "salir") {
    const respuesta = NextResponse.json({ ok: true });

    respuesta.cookies.set(COOKIE, "", { ...OPCIONES_COOKIE, maxAge: 0 });

    return respuesta;
  }

  /* -------------------------- REGISTRARSE ------------------------- */

  if (accion === "registrar") {
    const slug = String(cuerpo.slug ?? "");

    const correo = limpiaCorreo(cuerpo.correo);

    if (!PERSONA_POR_SLUG.has(slug)) {
      return mal("Elige quién eres de la lista.");
    }

    if (!correo) return mal("Ese correo no tiene buena pinta. Repásalo.");

    const doc = await dameCuentas();

    if (doc.cuentas[slug]) {
      return mal(
        "Ya estás registrado. Entra con tu correo y tu contraseña; si no te acuerdas, avisa a Víctor.",
      );
    }

    const deOtro = cuentaDeCorreo(doc, correo);

    if (deOtro) {
      return mal("Ese correo ya lo está usando otra persona.");
    }

    /* La contraseña inicial es lo que va antes de la arroba. */
    const { sal, hash } = cifra(claveInicialDe(correo));

    const cuenta: CuentaQuiniela = {
      slug,
      correo,
      hash,
      sal,
      altaEn: new Date().toISOString(),
      inicial: true,
    };

    await guarda({ cuentas: { ...doc.cuentas, [slug]: cuenta } });

    const respuesta = NextResponse.json({ ok: true, yo: suyo(cuenta) });

    respuesta.cookies.set(COOKIE, creaSesion(slug), OPCIONES_COOKIE);

    return respuesta;
  }

  /* ---------------------------- ENTRAR ---------------------------- */

  if (accion === "entrar") {
    const correo = limpiaCorreo(cuerpo.correo);

    const clave = String(cuerpo.clave ?? "");

    /* Mismo mensaje para «no existe» y para «no es ésa»: lo contrario le
       diría a cualquiera quién está dado de alta. */
    const generico = "El correo o la contraseña no son correctos.";

    if (!correo || !clave) return mal(generico, 401);

    const doc = await dameCuentas();

    const cuenta = cuentaDeCorreo(doc, correo);

    if (!cuenta || !acierta(clave, cuenta)) return mal(generico, 401);

    const respuesta = NextResponse.json({ ok: true, yo: suyo(cuenta) });

    respuesta.cookies.set(COOKIE, creaSesion(cuenta.slug), OPCIONES_COOKIE);

    return respuesta;
  }

  /* ---------------------- CAMBIAR LA CONTRASEÑA ------------------- */

  if (accion === "cambiar") {
    const slug = leeSesion(request.cookies.get(COOKIE)?.value);

    if (!slug) return mal("Entra otra vez: se te ha caducado la sesión.", 401);

    const actual = String(cuerpo.actual ?? "");

    const nueva = String(cuerpo.nueva ?? "");

    if (nueva.length < MINIMO_CLAVE) {
      return mal(`La nueva contraseña necesita al menos ${MINIMO_CLAVE} caracteres.`);
    }

    const doc = await dameCuentas();

    const cuenta = doc.cuentas[slug];

    if (!cuenta) return mal("No encuentro tu cuenta.", 401);

    if (!acierta(actual, cuenta)) return mal("La contraseña de ahora no es ésa.");

    const { sal, hash } = cifra(nueva);

    const cambiada: CuentaQuiniela = { ...cuenta, sal, hash, inicial: false };

    await guarda({ cuentas: { ...doc.cuentas, [slug]: cambiada } });

    return NextResponse.json({ ok: true, yo: suyo(cambiada) });
  }

  return mal("No sé qué quieres hacer.");
}
