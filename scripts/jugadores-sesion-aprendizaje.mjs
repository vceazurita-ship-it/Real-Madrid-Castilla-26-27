/*
|--------------------------------------------------------------------------
| DÓNDE COLOCA EL CUERPO TÉCNICO A CADA JUGADOR (14/10/2026)
|--------------------------------------------------------------------------
|
|   node scripts/jugadores-sesion-aprendizaje.mjs          lo enseña y lo guarda
|   node scripts/jugadores-sesion-aprendizaje.mjs --ver    sólo lo enseña
|
| Lee todas las sesiones de Jugadores sesión y, con `aprendePosiciones`
| (lib/sesion-equipos/aprendizaje.ts), saca por jugador el sitio medio donde
| lo coloca a mano el cuerpo técnico (lo reciente pesa más). Lo deja en
| `jugadores-sesion:aprendizaje`: es el archivo del aprendizaje, el que se
| consulta para colocar a los jugadores en equipos directamente. La pantalla
| no lo necesita (lo calcula al momento con las mismas sesiones).
|
| Va cada noche en `jornada-nocturna.cmd` (es instantáneo).
*/

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");

const { entorno, salir } = require("./supabase-local.cjs");
const { createClient } = require("@supabase/supabase-js");
const { aprendePosiciones, sitioEnPalabras } = require("../lib/sesion-equipos/aprendizaje.ts");
const { demarcacionCercana, demarcacion } = require("../lib/sesion-equipos/demarcacion.ts");

const SOLO_VER = process.argv.includes("--ver");
const env = entorno();

if (!env) {
  console.log("RESUMEN: faltan las llaves de Supabase en .env.local");
  salir(1);
} else {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("app_documents").select("data").eq("key", "jugadores-sesion").single();

  if (error || !data?.data) {
    console.log(`RESUMEN: no se puede leer jugadores-sesion (${error?.message ?? "vacío"})`);
    salir(1);
  } else {
    const almacen = data.data;
    const perfiles = aprendePosiciones(almacen);
    const jugadores = Object.values(perfiles)
      .sort((a, b) => b.veces - a.veces)
      .map((p) => ({ ...p, sitio: sitioEnPalabras(p), demarcacion: demarcacion(demarcacionCercana(p))?.nombre }));

    console.log(`${almacen.sesiones?.length ?? 0} sesiones; ${jugadores.length} jugadores colocados a mano alguna vez.\n`);

    for (const j of jugadores) console.log(`  ${j.nombre.padEnd(26)} ${String(j.veces).padStart(3)} veces  ${j.sitio.padEnd(30)} (${j.demarcacion})  última ${j.ultima}`);

    if (SOLO_VER) {
      console.log("\nRESUMEN: en seco, no se guarda nada.");
    } else {
      const ahora = new Date().toISOString();
      const { error: e2 } = await supabase
        .from("app_documents")
        .upsert({ key: "jugadores-sesion:aprendizaje", kind: "jugadores-sesion", data: { actualizado: ahora, sesiones: almacen.sesiones?.length ?? 0, jugadores }, updated_at: ahora }, { onConflict: "key" });

      if (e2) {
        console.log(`RESUMEN: no se guarda (${e2.message})`);
        salir(1);
      } else {
        console.log(`\nRESUMEN: aprendizaje de ${jugadores.length} jugadores guardado.`);
      }
    }
  }
}
