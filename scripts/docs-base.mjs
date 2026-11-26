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
import fs from "node:fs";
import path from "node:path";
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

/*
| COPIA EN DISCO POR SELLO (26/11/2026). Supabase da 5,5 GB de bajada al mes y
| el 25-26/11 estos scripts se llevaban 40-60 MB al día bajando cada noche los
| mismos documentos grandes (opta:directo:*, opta:jugadores…). Ahora se pide
| primero sólo el sello (key, updated_at: bytes) y se baja entero sólo lo que
| cambió desde la última vez; lo demás sale de .cache/docs-base/.
*/
const COPIA = path.join(process.cwd(), ".cache", "docs-base");
const fichero = (clave) => path.join(COPIA, `${encodeURIComponent(clave)}.json`);
const leeCopia = (clave) => {
  try {
    return JSON.parse(fs.readFileSync(fichero(clave), "utf8"));
  } catch {
    return null;
  }
};
const ponCopia = (clave, sello, data) => {
  try {
    fs.mkdirSync(COPIA, { recursive: true });
    fs.writeFileSync(fichero(clave), JSON.stringify({ sello, data }));
  } catch {
    /* sin copia: la próxima vez se baja */
  }
};

/** `{ clave: data }` de las que existan. */
export async function leeDocs(claves) {
  return conReintento(async () => {
    const { data: sellos, error: e1 } = await sb().from("app_documents").select("key, updated_at").in("key", claves);
    if (e1) throw new Error(e1.message);
    const salida = {};
    const faltan = [];
    for (const f of sellos ?? []) {
      const c = leeCopia(f.key);
      if (c && f.updated_at && c.sello === f.updated_at) salida[f.key] = c.data;
      else faltan.push(f.key);
    }
    if (faltan.length) {
      const { data, error } = await sb().from("app_documents").select("key, data, updated_at").in("key", faltan);
      if (error) throw new Error(error.message);
      for (const f of data ?? []) {
        salida[f.key] = f.data;
        if (f.updated_at) ponCopia(f.key, f.updated_at, f.data);
      }
    }
    return salida;
  });
}

export async function leeDoc(clave) {
  return (await leeDocs([clave]))[clave] ?? null;
}

export async function guardaDoc(clave, kind, data) {
  await conReintento(async () => {
    const { data: vuelta, error } = await sb().from("app_documents").upsert({ key: clave, kind, data, updated_at: new Date().toISOString() }, { onConflict: "key" }).select("updated_at");
    if (error) throw new Error(error.message);
    /* El sello tal y como lo guarda la base: la siguiente lectura no baja lo que acabamos de subir. */
    const sello = Array.isArray(vuelta) ? vuelta[0]?.updated_at : null;
    if (sello) ponCopia(clave, sello, data);
  });
}
