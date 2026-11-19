/**
 * ACCESO A LA PLATAFORMA (18/11/2026).
 *
 * Desde el 18/11 la plataforma pide entrar. Hay tres llaves, todas cookies
 * firmadas (nada de base de datos en cada petición: el proxy sólo comprueba
 * firmas):
 *
 *   - CUERPO TÉCNICO: la cuenta de la quiniela (`quiniela_sesion`, 30 días)
 *     o la de administrador (`admin_sesion`, 12 h). Lo ven todo.
 *   - JUGADORES: cada uno con su usuario (lib/acceso/jugadores.ts), si Ajustes lo abre
 *     (`jugador_sesion`, 30 días). Ven la plataforma SIN lo que rellena el
 *     staff sobre ellos (lib/acceso/rutas.ts).
 *   - MÁQUINAS: los scripts del ordenador del club y el propio servidor
 *     mandan la cabecera `x-plataforma-interna` (firma derivada de
 *     SUPABASE_SERVICE_ROLE_KEY, que sólo tienen ellos).
 *
 * Este fichero no importa nada de Supabase: lo usa el proxy en cada petición.
 * Las firmas de admin y quiniela son las mismas que en lib/admin/sesion.ts y
 * lib/quiniela/sesion.ts (si cambian allí, cambian aquí).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_JUGADOR = "jugador_sesion";
/** Legible por el navegador, SÓLO para pintar el menú: la seguridad la pone el proxy. */
export const COOKIE_ROL = "plataforma_rol";
export const COOKIE_QUINIELA = "quiniela_sesion";
export const COOKIE_ADMIN = "admin_sesion";
export const CABECERA_INTERNA = "x-plataforma-interna";

export const DURACION_JUGADOR_DIAS = 30;

export type Rol = "staff" | "jugador" | null;

const servicio = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const hmac = (secreto: string, cuerpo: string) => createHmac("sha256", secreto).update(cuerpo).digest("base64url");

function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ----------------------------- JUGADORES ----------------------------- */

function secretoJugador() {
  const base = process.env.QUINIELA_SECRET ?? servicio();
  if (!base) throw new Error("No hay con qué firmar la sesión de jugador.");
  /* Otro prefijo: una cookie de quiniela o de admin no vale como de jugador ni al revés. */
  return `jugadores:${base}`;
}

/** `jugador.<versión del código>.<caduca>.<firma>`: al cambiar el código, las sesiones viejas dejan de valer. */
export function creaSesionJugador(version: string) {
  const cuerpo = `jugador.${version}.${Date.now() + DURACION_JUGADOR_DIAS * 86_400_000}`;
  return `${cuerpo}.${hmac(secretoJugador(), cuerpo)}`;
}

/** La versión del código con que se entró, o null si la cookie no vale. */
export function leeSesionJugador(valor: string | undefined | null): string | null {
  if (!valor) return null;
  const t = valor.split(".");
  if (t.length !== 4 || t[0] !== "jugador") return null;
  try {
    if (!iguales(hmac(secretoJugador(), `${t[0]}.${t[1]}.${t[2]}`), t[3])) return null;
  } catch {
    return null;
  }
  return Number(t[2]) > Date.now() ? t[1] : null;
}

/* --------------------------- CUERPO TÉCNICO --------------------------- */

/** La misma comprobación que lib/quiniela/sesion.ts (`leeSesion`), sin importar nada más. */
function esQuiniela(valor: string | undefined | null) {
  if (!valor) return false;
  const t = valor.split(".");
  if (t.length !== 3) return false;
  const propio = process.env.QUINIELA_SECRET;
  const secreto = propio ? propio : servicio() ? `quiniela:${servicio()}` : "";
  if (!secreto) return false;
  return iguales(hmac(secreto, `${t[0]}.${t[1]}`), t[2]) && Number(t[1]) > Date.now();
}

/** La misma comprobación que lib/admin/sesion.ts (`esAdmin`). */
function esAdminCookie(valor: string | undefined | null) {
  if (!valor) return false;
  const t = valor.split(".");
  if (t.length !== 3 || t[0] !== "admin") return false;
  const base = process.env.QUINIELA_SECRET ?? servicio();
  if (!base) return false;
  return iguales(hmac(`admin:${base}`, `${t[0]}.${t[1]}`), t[2]) && Number(t[1]) > Date.now();
}

/* ------------------------------ MÁQUINAS ------------------------------ */

/** La cabecera que mandan los scripts del club y el propio servidor. */
export function firmaInterna(clave = servicio()) {
  return clave ? hmac(`interna:${clave}`, "plataforma") : "";
}

export function esInterna(valor: string | null | undefined) {
  const mia = firmaInterna();
  return Boolean(valor && mia && iguales(valor, mia));
}

/* -------------------------------- QUIÉN -------------------------------- */

/**
 * Quién pide, sólo con las cookies. El staff gana: si en un aparato hay las
 * dos (un entrenador que probó el código de jugadores), ve lo del staff.
 * `versionJugador` es la versión vigente del código (null = sin comprobar).
 */
export function rolDe(cookies: { get(nombre: string): { value: string } | undefined }): Rol {
  if (esAdminCookie(cookies.get(COOKIE_ADMIN)?.value) || esQuiniela(cookies.get(COOKIE_QUINIELA)?.value)) return "staff";
  if (leeSesionJugador(cookies.get(COOKIE_JUGADOR)?.value)) return "jugador";
  return null;
}

export const OPCIONES_COOKIE_JUGADOR = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: DURACION_JUGADOR_DIAS * 86_400,
  secure: process.env.NODE_ENV === "production",
};

export const OPCIONES_COOKIE_ROL = { ...OPCIONES_COOKIE_JUGADOR, httpOnly: false };
