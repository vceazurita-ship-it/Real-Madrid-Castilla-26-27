/**
 * Arreglo de una vez (14/11/2026): pone el local primero en el índice del día
 * (opta:directo) y en el archivo (opta:directo:archivo) mirando el «campo» de
 * cada partido en su documento. Uso: node --env-file=.env.local scripts/opta-directo-orden.mjs
 */
import { createRequire } from "node:module";
const { createClient } = createRequire(import.meta.url)("../lib/datos/cliente.cjs");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const lee = async (key) => (await sb.from("app_documents").select("data").eq("key", key).maybeSingle()).data?.data ?? null;
const guarda = async (key, data) => {
  const { error } = await sb.from("app_documents").upsert({ key, kind: "opta", data, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
};

/* ¿Está el local en segundo lugar? Del doc del partido. */
async function alReves(partido, equipos) {
  const d = await lee(`opta:directo:${partido}`);
  const t = d?.equipos;
  if (!t?.cols) return false;
  const cE = t.cols.indexOf("equipo");
  const cC = t.cols.indexOf("campo");
  const local = t.filas.find((f) => String(f[cC]).toUpperCase() === "HOME");
  return Boolean(local && equipos?.[1] === local[cE] && equipos?.[0] !== local[cE]);
}
const gira = (p) => ({ ...p, equipos: [...(p.equipos ?? [])].reverse(), goles: p.goles ? [...p.goles].reverse() : p.goles, xg: p.xg ? [...p.xg].reverse() : p.xg });

let cambios = 0;
for (const key of ["opta:directo", "opta:directo:archivo"]) {
  const doc = await lee(key);
  if (!doc?.partidos) continue;
  const partidos = [];
  for (const p of doc.partidos) {
    if (await alReves(p.partido, p.equipos)) {
      partidos.push(gira(p));
      cambios += 1;
    } else partidos.push(p);
  }
  await guarda(key, { ...doc, partidos });
}
console.log(`Partidos con el local corregido: ${cambios}`);
process.exit(0);
