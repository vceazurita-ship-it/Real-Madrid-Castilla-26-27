/**
 * EL ENCARGO DE AJUSTES, DESDE LA NUBE (10/11/2026).
 *
 *   node scripts/nube-encargo.mjs <tarea> empieza
 *   node scripts/nube-encargo.mjs <tarea> acaba ok "resultado"
 *   node scripts/nube-encargo.mjs <tarea> acaba fallo "motivo"
 *
 * Los procesos que corren en GitHub Actions (Opta semanal, Wyscout…) apuntan
 * aquí cómo van, en el mismo documento `mantenimiento` que escribe el vigía
 * del ordenador del club. Así Ajustes enseña «en marcha», «hecho» o «ha
 * fallado» igual venga de donde venga.
 *
 * Escritura condicional, como el vigía (`marca` en scripts/vigia.cjs): sólo
 * entra si `updated_at` sigue siendo el leído; si alguien ha escrito en medio,
 * se relee y se vuelve a aplicar el cambio en vez de pisarlo.
 *
 * El registro de GitHub es público: aquí no se escribe nada más que la tarea.
 */
import { createRequire as crearRequireDatos } from "node:module";
const { createClient } = crearRequireDatos(import.meta.url)("../lib/datos/cliente.cjs"); /* con reserva: lib/datos/cliente.cjs */

const [tarea, accion, estado, ...resto] = process.argv.slice(2);
const resultado = resto.join(" ").trim();

if (!tarea || !["empieza", "acaba"].includes(accion)) {
  console.error("Uso: node scripts/nube-encargo.mjs <tarea> empieza | acaba ok|fallo \"texto\"");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const sb = createClient(url, llave, { auth: { persistSession: false } });
const CLAVE = "mantenimiento";
const ahora = new Date().toISOString();

const cambio =
  accion === "empieza"
    ? { empezadoEn: ahora, enLaNube: true }
    : {
        hechoEn: ahora,
        ok: estado === "ok",
        resultado: resultado || (estado === "ok" ? "hecho en la nube" : "ha fallado en la nube"),
        enLaNube: true,
        ...(estado === "ok" ? { bienEn: ahora } : {}),
      };

for (let intento = 0; intento < 8; intento++) {
  const { data: fila, error: errorLectura } = await sb.from("app_documents").select("data, updated_at").eq("key", CLAVE).maybeSingle();
  if (errorLectura) throw new Error(`Supabase: ${errorLectura.message}`);

  const datos = fila?.data && typeof fila.data === "object" ? fila.data : {};
  const data = { ...datos, [tarea]: { ...(datos[tarea] ?? {}), ...cambio } };
  const updated_at = new Date().toISOString();

  if (!fila) {
    const { error } = await sb.from("app_documents").insert({ key: CLAVE, kind: "mantenimiento", data, updated_at });
    if (!error) break;
    if (error.code !== "23505") throw new Error(`Supabase: ${error.message}`);
    continue;
  }

  const { data: filas, error } = await sb
    .from("app_documents")
    .update({ data, updated_at })
    .eq("key", CLAVE)
    .eq("updated_at", fila.updated_at)
    .select("key");
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (filas?.length) break;

  await new Promise((r) => setTimeout(r, 200 + Math.random() * 400));
}

console.log(`${tarea}: ${accion === "empieza" ? "en marcha" : estado === "ok" ? "hecho" : "ha fallado"} (apuntado en Ajustes).`);
