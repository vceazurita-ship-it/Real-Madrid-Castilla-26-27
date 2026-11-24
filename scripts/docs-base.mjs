/**
 * LEER Y GUARDAR DOCUMENTOS DESDE LOS SCRIPTS NOCTURNOS (24/11/2026).
 *
 * Los scripts que se escribieron durante el corte de Supabase (13/11) hablaban
 * directamente con el Postgres de reserva (`DATOS_PG_URL`). Al volver a
 * Supabase el 22/11 esa variable se quitó (quedó como DATOS_PG_URL_RESERVA) y
 * cada noche salían con «falta DATOS_PG_URL»: el vídeo de los goles y de las
 * acciones de Opta, los clips de Hudl de los rivales y los goles de los
 * resúmenes de la RFEF se quedaron sin poner al día. Ahora van por el cliente
 * de datos de la app (lib/datos/cliente.cjs): Supabase de siempre y, si algún
 * día vuelve a hacer falta, la reserva con sólo poner DATOS_PG_URL.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { entorno } = require("./supabase-local.cjs");

for (const [k, v] of Object.entries(entorno() ?? {})) if (!process.env[k]) process.env[k] = v;

const { createClient } = require("../lib/datos/cliente.cjs");

let cliente = null;
const sb = () => (cliente ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY));

/** ¿Se puede hablar con la base? (las llaves de Supabase o la reserva). */
export const baseConfigurada = () => Boolean(process.env.DATOS_PG_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY));

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function conReintento(fn) {
  for (let n = 1; ; n++) {
    try {
      return await fn();
    } catch (e) {
      if (n >= 3) throw e;
      console.log(`  (base: ${e.code ?? e.message}; reintento ${n})`);
      await espera(5000 * n);
    }
  }
}

/** `{ clave: data }` de las que existan. */
export async function leeDocs(claves) {
  return conReintento(async () => {
    const { data, error } = await sb().from("app_documents").select("key, data").in("key", claves);
    if (error) throw new Error(error.message);
    return Object.fromEntries((data ?? []).map((f) => [f.key, f.data]));
  });
}

export async function leeDoc(clave) {
  return (await leeDocs([clave]))[clave] ?? null;
}

export async function guardaDoc(clave, kind, data) {
  await conReintento(async () => {
    const { error } = await sb().from("app_documents").upsert({ key: clave, kind, data, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  });
}
