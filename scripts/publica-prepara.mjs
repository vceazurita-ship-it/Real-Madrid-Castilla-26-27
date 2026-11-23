/*
| PREPARAR UNA PUBLICACIÓN EN RENDER QUE GASTE LO MÍNIMO (21/11/2026)
|
| Render da 500 minutos de compilación al mes y cada publicación compila la web
| entera (~8 min). Lo caro no es publicar: es publicar algo que falla en Render
| (se paga la compilación rota y luego la buena) o publicar dos veces lo que
| podía ir en una. Este script deja todo listo y comprobado AQUÍ:
|
|   1. Los JSON de public/data (análisis, ABP de las ligas, lo mejor a balón
|      parado) se generan aquí (`npm run datos:publicar`): en Render ya sólo se
|      compila (render.yaml → `npm run build:render`).
|   2. La ayuda de cada pantalla, al día (scripts/ayuda-al-dia.mjs).
|   3. La comprobación de GitHub (tipos, lint) en verde en el último commit subido.
|   4. Un `next build` como el de Render (RENDER=1, montón de 320 MB, sin tipos),
|      con el candado ../.build-lock. Si falla aquí, no se publica.
|   5. Qué cambia de la web desde la última publicación (etiqueta render-*).
|
|   node scripts/publica-prepara.mjs              comprueba (no publica)
|   node scripts/publica-prepara.mjs --publicar   y si todo va bien, publica UNA
|                                                 vez: public/publicado.txt +
|                                                 commit sin [skip render] +
|                                                 etiqueta render-AAAAMMDD-HHMM + push
|   --sin-build   se salta el paso 4 (sólo si ese mismo commit ya compiló aquí)
|
| Publicar SÓLO con la autorización del analista (ver memoria
| no-publicar-render-sin-doble-ok). El cambio de base de datos (quitar
| DATOS_PG_URL en Render) NO necesita compilar: «Save and deploy», no «rebuild».
*/
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PUBLICAR = process.argv.includes("--publicar");
const SIN_BUILD = process.argv.includes("--sin-build");
const raiz = process.cwd();
const fallos = [];

const sh = (c, o = {}) => `${execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...o }) ?? ""}`.trim();
const paso = (t) => console.log(`\n== ${t}`);

paso("1/5 · datos de public/data");
try {
  sh("npm run datos:publicar", { stdio: "inherit" });
} catch {
  fallos.push("los JSON de public/data no se han generado");
}

paso("2/5 · ayuda al día");
const ayuda = spawnSync(process.execPath, ["scripts/ayuda-al-dia.mjs"], { encoding: "utf8" });
const ayudaTxt = `${ayuda.stdout}`;
console.log(ayudaTxt.split("\n").slice(-4).join("\n"));
if (/Atrasadas/.test(ayudaTxt)) fallos.push("ayuda atrasada en alguna pantalla");

paso("3/5 · comprobación de GitHub del último commit subido");
try {
  const repo = sh("git remote get-url origin").replace(/.*github\.com[:/]/, "").replace(/\.git$/, "");
  const sha = sh("git rev-parse origin/main");
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?head_sha=${sha}&per_page=20`, { headers: { "User-Agent": "publica-prepara" } });
  const runs = (await r.json()).workflow_runs ?? [];
  const comp = runs.find((x) => x.name === "Comprobación");
  if (!comp) console.log(`(sin «Comprobación» para ${sha.slice(0, 7)} todavía)`);
  else {
    console.log(`Comprobación ${sha.slice(0, 7)}: ${comp.status} ${comp.conclusion ?? ""}`);
    if (comp.status === "completed" && comp.conclusion !== "success") fallos.push(`la Comprobación de GitHub falló en ${sha.slice(0, 7)}`);
    if (comp.status !== "completed") fallos.push("la Comprobación de GitHub aún no ha terminado: espera y repite");
  }
} catch (e) {
  console.log("no se ha podido mirar GitHub:", e.message);
}

paso("4/5 · build como el de Render");
if (SIN_BUILD) console.log("(saltado con --sin-build)");
else {
  const candado = path.resolve(raiz, "../.build-lock");
  let cogido = false;
  for (let i = 0; i < 120 && !cogido; i++) {
    try {
      fs.mkdirSync(candado);
      cogido = true;
    } catch {
      if (i === 0) console.log("esperando el candado ../.build-lock…");
      await new Promise((r) => setTimeout(r, 15000));
    }
  }
  if (!cogido) fallos.push("no se ha podido coger el candado del build");
  else {
    const t0 = Date.now();
    const b = spawnSync("npx", ["next", "build"], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, RENDER: "1", NODE_OPTIONS: "--max-old-space-size=320", SIN_TIPOS_EN_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1" },
    });
    fs.rmSync(candado, { recursive: true, force: true });
    console.log(`build ${b.status === 0 ? "bien" : "MAL"} en ${Math.round((Date.now() - t0) / 1000)} s`);
    if (b.status !== 0) fallos.push("el build como el de Render falla aquí");
  }
}

paso("5/5 · qué cambia de la web desde la última publicación");
const ultima = sh("git tag -l render-* --sort=-creatordate").split("\n")[0];
const ignorado = /^(scripts\/|\.github\/|supabase\/|\.claude\/|docs\/)|\.(md|cmd|ps1|vbs|log)$/;
const cambiados = sh(`git diff --name-only ${ultima}..HEAD`).split("\n").filter((f) => f && !ignorado.test(f));
console.log(`desde ${ultima}: ${cambiados.length} ficheros de la web`);
const sucio = sh("git status --porcelain").split("\n").filter((l) => l && !/video-informe-reintento\.log|zz-a-supabase|zz-compara|rivals-altas-bajas/.test(l));
const soloDatos = sucio.every((l) => /public\/data\//.test(l));
if (sucio.length && !soloDatos) fallos.push(`hay cambios sin commit: ${sucio.slice(0, 5).join(" | ")}`);

if (fallos.length) {
  console.log(`\nNO LISTO:\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}
console.log("\nLISTO para publicar una vez.");
if (!PUBLICAR) process.exit(0);

const ahora = new Date();
const marca = ahora.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
fs.writeFileSync("public/publicado.txt", `${ahora.toISOString().slice(0, 16)}Z\n`);
sh("git add public/publicado.txt public/data/analisis.json public/data/abp-ligas.json public/data/abp-acciones.json public/data/abp-acciones-todas.json");
sh(`git commit -m "Publicar en Render (${marca}): una sola compilación con todo lo pendiente" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`);
sh(`git tag render-${marca}`);
sh("git push -q origin main");
sh(`git push -q origin render-${marca}`);
console.log(`publicado: render-${marca}. Comprueba en 2-10 min: <web>/publicado.txt`);
