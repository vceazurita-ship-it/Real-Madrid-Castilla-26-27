/**
 * ESTATURAS DE LOS RIVALES DESDE BESOCCER (11/11/2026).
 *
 * El analista quiere que la estatura de cada rival sea la de BeSoccer y que,
 * si la hoja RIVALES dice otra, se vean las dos. La página de PLANTILLA de
 * cada equipo trae la columna «cm» (la misma que ya lee rivals-stats.mjs cada
 * noche; las fichas de jugador están tras una verificación anti-bots y no se
 * piden). El id de BeSoccer de cada jugador sale de su foto en la hoja.
 *
 *   node scripts/rivals-alturas.mjs            → baja, compara y lo cuenta
 *   node scripts/rivals-alturas.mjs --subir    → además lo guarda en Supabase
 *
 * Se guarda en `app_documents`, clave `rivals:alturas`: { porId: { id: cm }, actualizado }.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire as crearRequireDatos } from "node:module";
const { createClient } = crearRequireDatos(import.meta.url)("../lib/datos/cliente.cjs"); /* con reserva: lib/datos/cliente.cjs */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOC_KEY = "rivals:alturas";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const subir = process.argv.includes("--subir");

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const curl = (url) =>
  execFileSync(
    "curl",
    ["-s", "--compressed", "--max-time", "45", "-H", `User-Agent: ${UA}`, "-H", "Accept: text/html,application/xhtml+xml", "-H", "Accept-Language: es-ES,es;q=0.9", url],
    { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
  );

/** id de BeSoccer → cm, de la columna «cm» de la página de plantilla. */
function alturasDePlantilla(html) {
  const alturas = {};

  for (const trozo of html.split(/<tr class="row-(?=body)/).slice(1)) {
    const id = trozo.match(/besoccer\.com\/jugador\/[a-z0-9-]+?-(\d+)"/)?.[1];
    const celdas = [...trozo.matchAll(/data-content-tab="team_info"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
    const cm = celdas.map((c) => Number(c.replace(/\s*cm$/i, ""))).find((n) => Number.isInteger(n) && n >= 150 && n <= 215);

    if (id && cm) alturas[id] = cm;
  }

  return alturas;
}

function leeEnv() {
  const env = { ...process.env };
  const fichero = path.join(RAIZ, ".env.local");

  if (fs.existsSync(fichero)) {
    for (const linea of fs.readFileSync(fichero, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);

      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }

  return env;
}

const squads = JSON.parse(fs.readFileSync(path.join(RAIZ, ".cache", "rivals-stats", "squads.json"), "utf8"));
const porId = {};

for (const [riv, equipo] of Object.entries(squads)) {
  let html = "";

  for (let intento = 0; intento < 3 && html.length < 5000; intento += 1) {
    if (intento) sleep(3000);

    try {
      html = curl(`https://es.besoccer.com/equipo/plantilla/${equipo.slug}`);
    } catch {
      html = "";
    }
  }

  const alturas = alturasDePlantilla(html);

  Object.assign(porId, alturas);
  console.log(`${riv} ${equipo.slug}: ${Object.keys(alturas).length} estaturas${html.length < 5000 ? " (no contestó)" : ""}`);
  sleep(1500);
}

const total = Object.keys(porId).length;

console.log(`\n${total} estaturas de BeSoccer`);

if (subir) {
  if (total < 200) {
    console.error("Muy pocas estaturas: no se sube nada.");
    process.exit(1);
  }

  const env = leeEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase
    .from("app_documents")
    .upsert({ key: DOC_KEY, kind: "rivals", data: { porId, actualizado: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) throw new Error(error.message);

  const { data } = await supabase.from("app_documents").select("data").eq("key", DOC_KEY).maybeSingle();

  console.log(`Guardado en ${DOC_KEY}: ${Object.keys(data?.data?.porId ?? {}).length} estaturas.`);
} else {
  fs.mkdirSync(path.join(RAIZ, ".cache", "rivals-stats"), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, ".cache", "rivals-stats", "alturas.json"), JSON.stringify(porId, null, 1));
}
