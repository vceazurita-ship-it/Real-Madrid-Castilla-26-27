/**
 * EL ACCESO (18/11/2026), en Supabase `secreto:acceso` (nunca sale por
 * /api/docs: las claves `secreto:` están vetadas).
 *
 *   - jugadores: si está, el acceso de jugadores está ABIERTO. Desde el
 *     19/11/2026 cada jugador entra con su usuario (nombre y primer apellido)
 *     y su contraseña (nombre123): lib/acceso/jugadores.ts. Lleva una
 *     `version`: al cerrarlo o al «echar a todos», las sesiones de jugador
 *     abiertas dejan de valer en ≤ 5 min (proxy.ts).
 *   - staff: el que pide «registrarse» con la cuenta del cuerpo técnico. Sin
 *     él, cualquiera con la dirección podría darse de alta como alguien del
 *     staff que aún no tiene cuenta y verlo todo.
 *
 * Se guardan con scrypt y sal, como las contraseñas de la quiniela. Cinco
 * fallos seguidos con el mismo usuario lo cierran 15 minutos (sólo a él).
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
  jugadores?: { version: string; desde: string };
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

type Intento = { fallos: number; desde: string };
type Intentos = Record<string, Intento>;

const leeIntentos = async (): Promise<Intentos> => {
  const { data } = await readDoc<Intentos>(CLAVE_INTENTOS);
  /* El formato del 18/11 era un único contador para todos: se descarta. */
  return data && typeof data === "object" && !("fallos" in data) ? data : {};
};

/** null si ese usuario puede probar; si no, los minutos que le faltan. */
export async function puertaCerrada(quien: string): Promise<number | null> {
  const i = (await leeIntentos())[quien];
  if (!i || i.fallos < MAX_FALLOS) return null;
  const falta = Date.parse(i.desde) + BLOQUEO_MS - Date.now();
  return falta > 0 ? Math.ceil(falta / 60_000) : null;
}

export async function apuntaIntento(bien: boolean, quien: string) {
  const todos = await leeIntentos();
  const ahora = new Date().toISOString();
  /* Se limpian los viejos para que el documento no crezca. */
  for (const [k, v] of Object.entries(todos)) if (Date.now() - Date.parse(v.desde) > BLOQUEO_MS) delete todos[k];
  if (bien) {
    if (!todos[quien]) return;
    delete todos[quien];
  } else {
    const i = todos[quien];
    const fallos = (i?.fallos ?? 0) + 1;
    todos[quien] = { fallos, desde: !i || fallos >= MAX_FALLOS ? ahora : i.desde };
  }
  return writeDoc(CLAVE_INTENTOS, "acceso", todos);
}
