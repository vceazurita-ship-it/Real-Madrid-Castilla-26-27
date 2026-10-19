/**
 * QUIÉN ENTRA EN EL ANÁLISIS DE ENTRENAMIENTO (19/10/2026).
 *
 * En obras sólo entraba el administrador. Terminada, entra también el cuerpo
 * técnico con su cuenta (la de la quiniela y las apuestas, la misma regla que
 * el envío de informes: `puedeMandar` en lib/correo/peticionInforme.ts). Sin
 * ninguna de las dos sesiones, la pantalla pide entrar.
 *
 * Sólo servidor: lee las cookies firmadas.
 */

import { COOKIE_ADMIN, esAdmin } from "@/lib/admin/sesion";
import { COOKIE, leeSesion } from "@/lib/quiniela/sesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

type LectorCookies = { get: (nombre: string) => { value: string } | undefined };

export function puedeVerEntreno(cookies: LectorCookies) {
  if (esAdmin(cookies.get(COOKIE_ADMIN)?.value)) return true;

  const slug = leeSesion(cookies.get(COOKIE)?.value);

  return Boolean(slug && PERSONA_POR_SLUG.has(slug));
}
