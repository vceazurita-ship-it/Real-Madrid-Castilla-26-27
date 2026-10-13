/*
|--------------------------------------------------------------------------
| LOS ESCUDOS DE TODA LA CATEGORÍA (LOS DOS GRUPOS)
|--------------------------------------------------------------------------
|
|   node scripts/escudos-categoria.mjs
|
| `rivals:informe` sólo trae los escudos de nuestro grupo (el 2), y la
| Comparativa con la categoría compara con los cuarenta equipos de Primera
| Federación: los del grupo 1 salían sin escudo (13/10/2026). Esto lee la
| clasificación de BeSoccer de los dos grupos y deja los pares nombre-escudo
| en `escudos:categoria` (unos pocos KB). `/api/data-analisis?escudos=1` los
| junta con los de siempre. Los escudos no cambian: basta con pasarlo al
| empezar la temporada o si sube un equipo nuevo.
|
| Va por `curl --compressed`: el fetch de Node recibe un 406 de BeSoccer.
*/

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { entorno } = require("./supabase-local.cjs");
const { createClient } = require("@supabase/supabase-js");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const GRUPOS = [1, 2];
const url = (g) => `https://es.besoccer.com/competicion/clasificacion/primera_division_rfef/2027/grupo${g}`;

function trae(direccion) {
  return execFileSync("curl", ["-s", "--compressed", "--max-time", "45", "-H", `User-Agent: ${UA}`, "-H", "Accept: text/html,application/xhtml+xml", "-H", "Accept-Language: es-ES,es;q=0.9", direccion], { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" });
}

const equipos = [];

for (const grupo of GRUPOS) {
  const html = trae(url(grupo));
  const total = html.slice(html.indexOf('id="tab_total0"'));
  const fin = total.indexOf('id="tab_local0"');
  const bloque = fin > 0 ? total.slice(0, fin) : total;

  for (const fila of bloque.split('<tr class="row-body').slice(1)) {
    const nombre = fila.match(/<span class="team-name">([^<]*)<\/span>/)?.[1]?.trim();
    const id = (fila.match(/img_data\/equipos\/(\d+)\.png/) ?? fila.match(/img_data\/escudos\/[a-z_]+\/(\d+)\.jpg/))?.[1];

    if (nombre && id && !equipos.some((e) => e.equipo === nombre)) equipos.push({ equipo: nombre, escudo: `https://cdn.resfu.com/img_data/equipos/${id}.png`, grupo });
  }

  console.log(`Grupo ${grupo}: ${equipos.filter((e) => e.grupo === grupo).length} equipos`);
}

if (equipos.length < 30) {
  console.log(`RESUMEN: sólo ${equipos.length} equipos; BeSoccer habrá cambiado la página. No se guarda nada.`);
  process.exitCode = 1;
} else {
  const env = entorno();

  if (!env) throw new Error("Faltan las llaves de Supabase en .env.local");

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await supabase.from("app_documents").upsert({ key: "escudos:categoria", kind: "escudos", data: { equipos, actualizado: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) throw new Error(error.message);

  console.log(`RESUMEN: ${equipos.length} escudos en escudos:categoria`);
}
