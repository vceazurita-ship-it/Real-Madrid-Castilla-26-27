/**
 * LA SESIÓN DE LA QUINIELA.
 *
 * Una cookie firmada, nada más: dentro va el `slug` de quien ha entrado y
 * hasta cuándo vale. Va firmada para que no se pueda editar a mano —si no, con
 * cambiar el valor de la cookie se podría rellenar la quiniela de cualquiera,
 * que es justo lo único que esto tiene que impedir—.
 *
 * **El secreto de firma se deriva de `SUPABASE_SERVICE_ROLE_KEY`**, que ya
 * existe y nunca sale del servidor. Se hizo así para no obligar a dar de alta
 * otra variable de entorno: una variable más que alguien tiene que acordarse
 * de poner en Vercel es una forma segura de que el día del despliegue nadie
 * pueda entrar. Si algún día se quiere una propia, basta con definir
 * `QUINIELA_SECRET` y esto la prefiere.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "quiniela_sesion";

/** Un mes. Es una quiniela: pedir la contraseña cada semana sería un castigo. */
export const DURACION_DIAS = 30;

function secreto() {
  const propio = process.env.QUINIELA_SECRET;

  if (propio) return propio;

  const deSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!deSupabase) {
    throw new Error(
      "No hay con qué firmar la sesión: falta QUINIELA_SECRET o SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return `quiniela:${deSupabase}`;
}

const firma = (cuerpo: string) =>
  createHmac("sha256", secreto()).update(cuerpo).digest("base64url");

/** El valor que se guarda en la cookie: `slug.caduca.firma`. */
export function creaSesion(slug: string) {
  const caduca = Date.now() + DURACION_DIAS * 24 * 60 * 60 * 1000;

  const cuerpo = `${slug}.${caduca}`;

  return `${cuerpo}.${firma(cuerpo)}`;
}

/** El `slug` de una cookie válida, o `null` si no lo es o ha caducado. */
export function leeSesion(valor: string | undefined | null): string | null {
  if (!valor) return null;

  const trozos = valor.split(".");

  if (trozos.length !== 3) return null;

  const [slug, caduca, suya] = trozos;

  const cuerpo = `${slug}.${caduca}`;

  const mia = Buffer.from(firma(cuerpo));

  const dada = Buffer.from(suya);

  /* Longitudes distintas: `timingSafeEqual` reventaría en vez de decir que no. */
  if (mia.length !== dada.length || !timingSafeEqual(mia, dada)) return null;

  if (!Number.isFinite(Number(caduca)) || Number(caduca) < Date.now()) {
    return null;
  }

  return slug;
}

/** Cómo se escribe la cookie. `httpOnly` para que el JavaScript no la lea. */
export const OPCIONES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: DURACION_DIAS * 24 * 60 * 60,
  secure: process.env.NODE_ENV === "production",
};
