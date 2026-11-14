/**
 * Pide el encargo «opta» como si se pulsara en Ajustes (09/11/2026).
 *
 * Lo lanza la tarea de los lunes (scripts/opta-semanal.cmd): así la pasada la
 * hace el vigía, con su progreso en Ajustes, sus mandos de pausar/cancelar y
 * su aviso, igual que si la pidiera el analista. Escribe con la misma guarda
 * que la web (sólo si nadie ha tocado el documento entre medias).
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("../lib/datos/cliente.cjs"); /* con reserva: lib/datos/cliente.cjs */

const RAIZ = path.join(__dirname, "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(RAIZ, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  for (let i = 0; i < 6; i++) {
    const { data: fila, error } = await sb.from("app_documents").select("data, updated_at").eq("key", "mantenimiento").maybeSingle();
    if (error) throw error;

    const d = fila?.data ?? {};
    d.opta = { ...(d.opta ?? {}), pedidoEn: new Date().toISOString(), pedidoPor: "tarea de los lunes", pausado: undefined, orden: undefined };

    const ahora = new Date().toISOString();
    const q = fila
      ? sb.from("app_documents").update({ data: d, updated_at: ahora }).eq("key", "mantenimiento").eq("updated_at", fila.updated_at)
      : sb.from("app_documents").insert({ key: "mantenimiento", kind: "mantenimiento", data: d, updated_at: ahora });
    const { data: ok, error: e2 } = await q.select("key");
    if (e2) throw e2;
    if (ok?.length) {
      console.log(`Opta pedido al vigía: ${d.opta.pedidoEn}`);
      return;
    }
  }
  console.error("No se pudo pedir: el documento cambiaba sin parar.");
  process.exit(1);
})().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
