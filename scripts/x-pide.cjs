/**
 * Pide el encargo «x» (leer @fernandosb9 en X y sacar ideas) como si se
 * pulsara «Leer ahora» en Ajustes (12/11/2026).
 *
 * Lo lanza la tarea de las mañanas (scripts/x-ideas-diario.cmd): así la pasada
 * la hace el vigía, con su progreso en Ajustes y su aviso al terminar. Escribe
 * con la misma guarda que la web (sólo si nadie ha tocado el documento entre
 * medias). Igual que scripts/opta-pide.cjs.
 */
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const { entorno } = require(path.join(__dirname, "supabase-local.cjs"));

const env = entorno();

if (!env) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  for (let i = 0; i < 6; i++) {
    const { data: fila, error } = await sb.from("app_documents").select("data, updated_at").eq("key", "mantenimiento").maybeSingle();
    if (error) throw error;

    const d = fila?.data ?? {};
    d.x = { ...(d.x ?? {}), pedidoEn: new Date().toISOString(), pedidoPor: "tarea de las mañanas", pausado: undefined, orden: undefined };

    const ahora = new Date().toISOString();
    const q = fila
      ? sb.from("app_documents").update({ data: d, updated_at: ahora }).eq("key", "mantenimiento").eq("updated_at", fila.updated_at)
      : sb.from("app_documents").insert({ key: "mantenimiento", kind: "mantenimiento", data: d, updated_at: ahora });
    const { data: ok, error: e2 } = await q.select("key");
    if (e2) throw e2;
    if (ok?.length) {
      console.log(`Ideas desde X pedidas al vigía: ${d.x.pedidoEn}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
  }
  console.error("No se pudo pedir: el documento cambiaba sin parar.");
  process.exitCode = 1;
})().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exitCode = 1;
});
