/**
 * EL ADMINISTRADOR: QUIEN PUEDE ENTRAR EN AJUSTES.
 *
 * Ajustes lanza trabajos en el ordenador del club que escriben en las hojas,
 * en Supabase y en GitHub (02/10/2026: sólo Víctor). Se entra con usuario y
 * contraseña propios, aparte de la cuenta de la quiniela, y queda una cookie
 * firmada `admin_sesion` de 12 horas.
 *
 * **Ni el correo ni la contraseña están en el código** —el repositorio es
 * público—: viven en Supabase, en el documento `secreto:admin`
 * `{ email, sal, huella }` (scrypt), que `/api/docs` no sirve nunca. Con
 * `ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH` («sal:huella») en Vercel, mandan esas.
 * Tras cinco fallos seguidos se bloquea un cuarto de hora (`secreto:admin-intentos`).
 *
 * Sólo servidor: lleva el secreto de firma.
 */

import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

import { readDoc, writeDoc } from "@/lib/docStore";

export const COOKIE_ADMIN = "admin_sesion";

export const DURACION_ADMIN_H = 12;

const CLAVE_CREDENCIAL = "secreto:admin";

const CLAVE_INTENTOS = "secreto:admin-intentos";

const MAX_FALLOS = 5;

const BLOQUEO_MS = 15 * 60_000;

type Credencial = { email: string; sal: string; huella: string };

async function credencial(): Promise<Credencial | null> {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH) {
    const [sal, huella] = process.env.ADMIN_PASSWORD_HASH.split(":");

    return { email: process.env.ADMIN_EMAIL, sal, huella };
  }

  const { data } = await readDoc<Credencial>(CLAVE_CREDENCIAL);

  return data?.email && data.sal && data.huella ? data : null;
}

type Intentos = { fallos: number; desde: string };

function secreto() {
  const base = process.env.QUINIELA_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base) throw new Error("No hay con qué firmar la sesión de administrador.");

  /* Otro prefijo que la quiniela: una cookie de una no sirve para la otra. */
  return `admin:${base}`;
}

const firma = (cuerpo: string) => createHmac("sha256", secreto()).update(cuerpo).digest("base64url");

const iguales = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/**
 * ¿Son el usuario y la contraseña del administrador?
 *
 * Devuelve `"bloqueado"` si ya van cinco fallos en el último cuarto de hora:
 * la contraseña es corta y, sin esto, se puede probar entera en un rato.
 */
export async function credencialesValidas(email: string, contrasena: string): Promise<boolean | "bloqueado"> {
  const { data: intentos } = await readDoc<Intentos>(CLAVE_INTENTOS);

  const reciente = intentos && Date.now() - Date.parse(intentos.desde) < BLOQUEO_MS;

  if (reciente && intentos.fallos >= MAX_FALLOS) return "bloqueado";

  const buena = await credencial();

  if (!buena) return false;

  const correo = iguales(Buffer.from(email.trim().toLowerCase()), Buffer.from(buena.email.trim().toLowerCase()));

  const clave = iguales(scryptSync(contrasena, buena.sal, 32), Buffer.from(buena.huella, "hex"));

  const valida = correo && clave;

  await writeDoc(
    CLAVE_INTENTOS,
    "secreto",
    valida
      ? { fallos: 0, desde: new Date().toISOString() }
      : { fallos: (reciente ? intentos.fallos : 0) + 1, desde: reciente ? intentos.desde : new Date().toISOString() },
  ).catch(() => undefined);

  return valida;
}

export function creaSesionAdmin() {
  const cuerpo = `admin.${Date.now() + DURACION_ADMIN_H * 3_600_000}`;

  return `${cuerpo}.${firma(cuerpo)}`;
}

export function esAdmin(valor: string | undefined | null) {
  if (!valor) return false;

  const trozos = valor.split(".");

  if (trozos.length !== 3 || trozos[0] !== "admin") return false;

  const cuerpo = `${trozos[0]}.${trozos[1]}`;

  if (!iguales(Buffer.from(firma(cuerpo)), Buffer.from(trozos[2]))) return false;

  return Number(trozos[1]) > Date.now();
}

export const OPCIONES_COOKIE_ADMIN = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DURACION_ADMIN_H * 3600,
};
