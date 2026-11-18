/**
 * ¿ESTÁ AL DÍA LA AYUDA DE CADA PANTALLA? (12/11/2026)
 *
 * Regla del analista: cualquier cambio de una pantalla actualiza su ayuda
 * (`lib/ayuda/paginas.ts`) y su fecha `revisada` en el mismo commit.
 *
 *   node scripts/ayuda-al-dia.mjs            → lista lo que está atrasado
 *   node scripts/ayuda-al-dia.mjs --estricto → sale con 1 si hay algo atrasado
 *
 * Compara, para cada entrada, `revisada` con el último commit que tocó la
 * carpeta de la pantalla (`app/<ruta>/`). También dice qué pantallas del menú
 * no tienen ayuda. No lee datos: sólo git y el propio fichero.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const estricto = process.argv.includes("--estricto");
const fuente = fs.readFileSync(path.join(RAIZ, "lib", "ayuda", "paginas.ts"), "utf8");

/* Cada entrada: su ruta y, si la tiene, su `revisada` (hasta la siguiente `ruta:`). */
const trozos = fuente.split(/\n\s+ruta:\s*"/).slice(1);
const entradas = trozos.map((t) => ({
  ruta: t.slice(0, t.indexOf('"')),
  revisada: t.match(/\n\s+revisada:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1] ?? "",
}));

/*
| Una sola pasada de git (18/11/2026). Antes era un `git log -1` por pantalla
| sobre toda la historia: con el ordenador del club ocupado pasaba de los
| cinco minutos y las ideas de X salían «ayuda no pasa: (plazo agotado)».
| Sólo importa lo cambiado después de la `revisada` más antigua, así que se
| lee desde ahí y se mira fichero a fichero (lo más nuevo primero).
*/
const fechas = entradas.map((e) => e.revisada).filter(Boolean).sort();
const desde = entradas.some((e) => !e.revisada) || !fechas.length ? null : fechas[0];
const cambios = []; /* [fecha, fichero] del más nuevo al más viejo */

try {
  const salida = execFileSync("git", ["log", "--format=@%cs", "--name-only", ...(desde ? [`--since=${desde}T00:00:00`] : []), "--", "app"], { cwd: RAIZ, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  let fecha = "";

  for (const linea of salida.split(/\r?\n/)) {
    if (linea.startsWith("@")) fecha = linea.slice(1);
    else if (linea.trim()) cambios.push([fecha, linea.trim()]);
  }
} catch {
  /* Sin git, nada sale atrasado por cambio (sí las que no tienen `revisada`). */
}

const atrasadas = [];

for (const { ruta, revisada } of entradas) {
  const carpeta = path.join("app", ruta === "/" ? "" : ruta.slice(1));
  const fichero = ruta === "/" ? path.join("app", "page.tsx") : carpeta;

  if (!fs.existsSync(path.join(RAIZ, fichero))) continue;

  /* Las subpantallas con ayuda propia (/laboratorio/microciclo) no cuentan como cambio de la madre (16/11/2026). */
  const hijas = ruta === "/" ? [] : entradas.filter((e) => e.ruta.startsWith(`${ruta}/`)).map((e) => `app${e.ruta}/`);
  const esSuyo = (f) => (ruta === "/" ? f === "app/page.tsx" : f.startsWith(`app${ruta}/`) && !hijas.some((h) => f.startsWith(h)));
  const cambio = cambios.find(([, f]) => esSuyo(f))?.[0] ?? "";

  if (!revisada || (cambio && cambio > revisada)) atrasadas.push({ ruta, revisada: revisada || "nunca", cambio });
}

/* Pantallas con page.tsx y sin ayuda (las de la API y las internas no cuentan). */
const conAyuda = new Set(entradas.map((e) => e.ruta));
const sinAyuda = [];
const recorre = (dir) => {
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith("_") || e.name.startsWith("(") || e.name === "api") continue;
    const sub = path.join(dir, e.name);

    if (fs.existsSync(path.join(RAIZ, sub, "page.tsx"))) {
      const ruta = "/" + sub.split(path.sep).slice(1).join("/");
      /* Las que sólo redirigen (/opta, /visionados) llevan la ayuda de su destino. */
      const codigo = fs.readFileSync(path.join(RAIZ, sub, "page.tsx"), "utf8");
      const soloRedirige = /\bredirect\(/.test(codigo) && codigo.split("\n").length < 40;

      if (!conAyuda.has(ruta) && !soloRedirige) sinAyuda.push(ruta);
    }

    recorre(sub);
  }
};
recorre("app");

console.log(`Ayuda: ${entradas.length} pantallas con entrada.`);

if (atrasadas.length) {
  console.log(`\nAtrasadas (la pantalla cambió después de revisar su ayuda): ${atrasadas.length}`);
  for (const a of atrasadas) console.log(`  ${a.ruta.padEnd(32)} revisada ${a.revisada} · pantalla ${a.cambio}`);
}

if (sinAyuda.length) {
  console.log(`\nSin ayuda: ${sinAyuda.length}`);
  for (const r of sinAyuda) console.log(`  ${r}`);
}

if (!atrasadas.length && !sinAyuda.length) console.log("Todo al día.");

if (estricto && atrasadas.length) process.exit(1);
