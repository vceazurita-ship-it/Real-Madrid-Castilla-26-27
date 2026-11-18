/**
 * LOS DOS CÓDIGOS DEL ACCESO (18/11/2026), en Supabase `secreto:acceso`
 * (nunca sale por /api/docs: las claves `secreto:` están vetadas).
 *
 *   - jugadores: el que se da al vestuario para entrar como jugador. Lleva una
 *     `version`: al cambiarlo (o al «echar a todos»), las sesiones de jugador
 *     abiertas dejan de valer en ≤ 5 min (proxy.ts).
 *   - staff: el que pide «registrarse» con la cuenta del cuerpo técnico. Sin
 *     él, cualquiera con la dirección podría darse de alta como alguien del
 *     staff que aún no tiene cuenta y verlo todo.
 *
 * Se guardan con scrypt y sal, como las contraseñas de la quiniela. Cinco
 * fallos seguidos cierran la puerta de jugadores 15 minutos.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { readDoc, writeDoc } from "@/lib/docStore";

export const CLAVE_ACCESO = "secreto:acceso";
const CLAVE_INTENTOS = "secreto:acceso-intentos";
export const MINIMO_CODIGO = 6;
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60_000;

type Cifrado = { sal: string; huella: string };
export type DocAcceso = {
  jugadores?: Cifrado & { version: string; desde: string };
  staff?: Cifrado & { desde: string };
};

const amasa = (codigo: string, sal: string) => scryptSync(codigo.trim().normalize("NFKC").toLowerCase(), sal, 64).toString("hex");

export function cifraCodigo(codigo: string): Cifrado {
  const sal = randomBytes(16).toString("hex");
  return { sal, huella: amasa(codigo, sal) };
}

export function aciertaCodigo(codigo: string, c: Cifrado | undefined) {
  if (!c?.sal || !c.huella || !codigo) return false;
  const a = Buffer.from(amasa(codigo, c.sal), "hex");
  const b = Buffer.from(c.huella, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function leeAcceso(): Promise<DocAcceso> {
  const { data } = await readDoc<DocAcceso>(CLAVE_ACCESO);
  return data ?? {};
}

export async function guardaAcceso(doc: DocAcceso) {
  await writeDoc(CLAVE_ACCESO, "acceso", doc);
}

export const nuevaVersion = () => randomBytes(6).toString("base64url");

type Intentos = { fallos: number; desde: string };

/** null si se puede probar; si no, los minutos que faltan. */
export async function puertaCerrada(): Promise<number | null> {
  const { data } = await readDoc<Intentos>(CLAVE_INTENTOS);
  if (!data || data.fallos < MAX_FALLOS) return null;
  const falta = Date.parse(data.desde) + BLOQUEO_MS - Date.now();
  return falta > 0 ? Math.ceil(falta / 60_000) : null;
}

export async function apuntaIntento(bien: boolean) {
  if (bien) return writeDoc(CLAVE_INTENTOS, "acceso", { fallos: 0, desde: new Date().toISOString() });
  const { data } = await readDoc<Intentos>(CLAVE_INTENTOS);
  const caducado = !data || Date.now() - Date.parse(data.desde) > BLOQUEO_MS;
  const fallos = caducado ? 1 : data.fallos + 1;
  return writeDoc(CLAVE_INTENTOS, "acceso", { fallos, desde: caducado || fallos >= MAX_FALLOS ? new Date().toISOString() : data.desde });
}
