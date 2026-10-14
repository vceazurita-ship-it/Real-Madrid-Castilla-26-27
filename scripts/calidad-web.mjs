/*
|--------------------------------------------------------------------------
| CALIDAD DE LA WEB: LIGHTHOUSE PANTALLA A PANTALLA (14/10/2026)
|--------------------------------------------------------------------------
|
|   node scripts/calidad-web.mjs              las pantallas con * de la lista
|   node scripts/calidad-web.mjs --todas      todas
|
| Pasa Lighthouse (el medidor de Google) por las pantallas de
| `.github/lighthouse/pantallas.txt` en la web publicada y deja:
|
|   calidad-web/informe.md     la tabla de notas y, por pantalla, lo que falla
|   calidad-web/<pantalla>.html  el informe completo de Lighthouse
|
| Lo lanza GitHub (.github/workflows/calidad-web.yml) tras cada despliegue y
| los lunes, y pinta el informe en el resumen de la ejecución. En local
| funciona igual pero va lento: unos cinco minutos por pantalla.
|
| Mide en modo móvil y con el tema por defecto (día). No falla nunca por una
| nota baja: es un termómetro, no un examen.
*/

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const WEB = process.env.WEB ?? "https://real-madrid-castilla-26-27.vercel.app";
const TODAS = process.argv.includes("--todas");
const SALIDA = "calidad-web";
const CATEGORIAS = [
  ["performance", "Velocidad"],
  ["accessibility", "Accesibilidad"],
  ["best-practices", "Buenas prácticas"],
  ["seo", "SEO"],
];

const pantallas = readFileSync(".github/lighthouse/pantallas.txt", "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .filter((l) => TODAS || l.startsWith("*"))
  .map((l) => l.replace(/^\*\s*/, ""));

if (!existsSync(SALIDA)) mkdirSync(SALIDA);

const nombreDe = (ruta) => (ruta === "/" ? "portada" : ruta.slice(1).replaceAll("/", "-"));
const nota = (n) => (n == null ? "–" : `${n >= 90 ? "🟢" : n >= 50 ? "🟠" : "🔴"} ${n}`);

const filas = [];
const detalles = [];

for (const ruta of pantallas) {
  const nombre = nombreDe(ruta);
  const base = `${SALIDA}/${nombre}`;

  console.log(`Midiendo ${ruta}…`);

  try {
    execFileSync(
      "npx",
      [
        "-y",
        "lighthouse@12.8.2",
        `${WEB}${ruta}`,
        "--quiet",
        "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
        "--output=json",
        "--output=html",
        `--output-path=${base}`,
        `--only-categories=${CATEGORIAS.map(([k]) => k).join(",")}`,
        "--max-wait-for-load=60000",
      ],
      { stdio: "inherit", shell: process.platform === "win32", timeout: 10 * 60 * 1000 },
    );
  } catch {
    filas.push(`| [${ruta}](${WEB}${ruta}) | ${CATEGORIAS.map(() => "⚠️").join(" | ")} |`);
    detalles.push(`### ${ruta}\n\nLighthouse no ha podido medirla.\n`);
    continue;
  }

  const informe = JSON.parse(readFileSync(`${base}.report.json`, "utf8"));
  const notas = CATEGORIAS.map(([k]) => {
    const s = informe.categories[k]?.score;
    return s == null ? null : Math.round(s * 100);
  });

  filas.push(`| [${ruta}](${WEB}${ruta}) | ${notas.map(nota).join(" | ")} |`);

  // Lo que falla, de lo que más pesa en la nota a lo que menos.
  const fallos = [];

  for (const [k, titulo] of CATEGORIAS) {
    for (const ref of informe.categories[k]?.auditRefs ?? []) {
      const a = informe.audits[ref.id];

      if (!a || a.score == null || a.score >= 0.9 || !ref.weight) continue;

      const ejemplos = (a.details?.items ?? [])
        .slice(0, 3)
        .map((it) => it.node?.snippet ?? it.url ?? "")
        .filter(Boolean)
        .map((t) => `\`${String(t).slice(0, 110).replaceAll("`", "'")}\``);

      fallos.push({ peso: ref.weight * (1 - a.score), linea: `- **${titulo}** · ${a.title}${a.displayValue ? ` (${a.displayValue})` : ""}${ejemplos.length ? `<br>${ejemplos.join("<br>")}` : ""}` });
    }
  }

  fallos.sort((a, b) => b.peso - a.peso);

  const lcp = informe.audits["largest-contentful-paint"]?.displayValue;
  const tbt = informe.audits["total-blocking-time"]?.displayValue;
  const cls = informe.audits["cumulative-layout-shift"]?.displayValue;

  detalles.push(
    `### ${ruta}\n\nCarga ${lcp ?? "–"} · bloqueo ${tbt ?? "–"} · saltos ${cls ?? "–"}\n\n${fallos.length ? fallos.slice(0, 8).map((f) => f.linea).join("\n") : "Nada que arreglar."}\n`,
  );
}

const md = `## Calidad de la web

${TODAS ? "Todas las pantallas" : "Las pantallas principales"} · ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} · móvil, tema día

| Pantalla | ${CATEGORIAS.map(([, t]) => t).join(" | ")} |
| --- | ${CATEGORIAS.map(() => "---").join(" | ")} |
${filas.join("\n")}

<details><summary>Qué falla en cada pantalla</summary>

${detalles.join("\n")}
</details>

El informe completo de cada pantalla va en el fichero adjunto «calidad-web» de esta ejecución.
`;

writeFileSync(`${SALIDA}/informe.md`, md);
console.log(md);
