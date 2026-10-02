/**
 * EL ADMINISTRADOR: QUIEN PUEDE ENTRAR EN AJUSTES.
 *
 * Ajustes lanza trabajos en el ordenador del club que escriben en las hojas,
 * en Supabase y en GitHub (02/10/2026: sólo Víctor). Se entra con usuario y
 * contraseña propios, aparte de la cuenta de la quiniela, y queda una cookie
 * firmada `admin_sesion` de 12 horas.
 *
 * La contraseña NO está escrita aquí: sólo su huella (scrypt con sal). Se
 * pueden cambiar sin tocar código con `ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH`
 * («sal:huella», en hexadecimal) en las variables de entorno de Vercel.
 *
 * Sólo servidor: lleva el secreto de firma.
 */

import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const COOKIE_ADMIN = "admin_sesion";

export const DURACION_ADMIN_H = 12;

const EMAIL = (process.env.ADMIN_EMAIL ?? "v.ceazurita@gmail.com").trim().toLowerCase();

const [SAL, HUELLA] = (
  process.env.ADMIN_PASSWORD_HASH ??
  "9f4df709e3ca5d597484c07a43045171:c6acb72a354e4d49b554016f47a2fceb7382e20613f59043c05f0bf81c93b4ba"
).split(":");

function secreto() {
  const base = process.env.QUINIELA_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base) throw new Error("No hay con qué firmar la sesión de administrador.");

  /* Otro prefijo que la quiniela: una cookie de una no sirve para la otra. */
  return `admin:${base}`;
}

const firma = (cuerpo: string) => createHmac("sha256", secreto()).update(cuerpo).digest("base64url");

const iguales = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/** ¿Son el usuario y la contraseña del administrador? */
export function credencialesValidas(email: string, contrasena: string) {
  const correo = iguales(Buffer.from(email.trim().toLowerCase()), Buffer.from(EMAIL));

  const clave = iguales(scryptSync(contrasena, SAL, 32), Buffer.from(HUELLA, "hex"));

  return correo && clave;
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
