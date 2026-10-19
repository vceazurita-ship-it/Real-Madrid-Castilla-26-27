/*
| Comprueba que la red de agentes está bien montada (19/10/2026). Lo corre
| GitHub en cada cambio de `.claude/agents/`, `agentes/` o `scripts/agentes/`
| (.github/workflows/agentes.yml) y se puede correr a mano:
|
|   node scripts/agentes/valida.mjs
|
| Falla si un agente no tiene cabecera, usa un modelo que no toca, puede
| escribir (Edit, Write, Bash libre…), o si un esquema no es JSON válido.
| No llama a ningún modelo: es gratis y no necesita secretos.
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = path.join(RAIZ, ".claude", "agents");

/* Quién hace qué: el modelo es parte del diseño (coste), no un detalle. */
const MODELO = {
  "vigilante-datos": "haiku",
  "lector-cortes": "haiku",
  "analista-partido": "opus",
  "analista-rival": "opus",
  mantenedor: "sonnet",
  "analista-abp": "sonnet",
  verificador: "sonnet",
  "redactor-jugadores": "sonnet",
  "revisor-cambios": "sonnet",
  /* El equipo de expertos (20/10/2026): sólo opinan, con el esquema «critica». */
  "experto-futbol": "opus",
  guionista: "opus",
  "experto-analisis": "sonnet",
  "experto-marketing": "sonnet",
  "editor-video": "sonnet",
  "productor-video": "sonnet",
};
const LEER = new Set(["Read", "Grep", "Glob"]);
const GIT_LECTURA = /^Bash\(git (diff|log|show):\*\)$/;

const fallos = [];
const mal = (quien, que) => fallos.push(`${quien}: ${que}`);

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".md"))) {
  const nombre = f.replace(/\.md$/, "");
  const texto = fs.readFileSync(path.join(DIR, f), "utf8").replace(/\r\n/g, "\n");
  const m = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);

  if (!m) {
    mal(nombre, "sin cabecera ---");
    continue;
  }

  const campo = (k) => m[1].match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1].trim() ?? "";

  if (campo("name") !== nombre) mal(nombre, `name «${campo("name")}» no coincide con el fichero`);
  if (campo("description").length < 40) mal(nombre, "description demasiado corta: es lo que decide cuándo se usa");
  if (!MODELO[nombre]) mal(nombre, "no está en la tabla de modelos de valida.mjs (añádelo ahí y en agentes/README.md)");
  else if (campo("model") !== MODELO[nombre]) mal(nombre, `model «${campo("model")}» y debería ser «${MODELO[nombre]}»`);

  for (const t of campo("tools").split(/,\s*/).filter(Boolean)) {
    if (!LEER.has(t) && !(nombre === "revisor-cambios" && GIT_LECTURA.test(t))) mal(nombre, `herramienta «${t}»: los agentes sólo leen`);
  }

  if (m[2].trim().length < 300) mal(nombre, "instrucciones demasiado cortas");
  if (!/esquema/i.test(m[2])) mal(nombre, "las instrucciones no dicen qué esquema devolver");
}

for (const f of fs.readdirSync(path.join(RAIZ, "agentes", "esquemas"))) {
  try {
    const e = JSON.parse(fs.readFileSync(path.join(RAIZ, "agentes", "esquemas", f), "utf8"));
    if (e.type !== "object" || !e.required?.length) mal(f, "el esquema tiene que ser un objeto con campos obligatorios");
  } catch (e) {
    mal(f, `JSON no válido: ${e.message}`);
  }
}

const reglas = fs.readFileSync(path.join(RAIZ, "agentes", "reglas.md"), "utf8");
for (const imprescindible of ["NO se nombra", "fuente", "Hora de Madrid", "No escribes"]) {
  if (!reglas.includes(imprescindible)) mal("reglas.md", `falta la regla «${imprescindible}»`);
}

if (fallos.length) {
  console.error(`✗ ${fallos.length} problemas en la red de agentes:\n- ${fallos.join("\n- ")}`);
  process.exit(1);
}

console.log(`✓ Red de agentes: ${fs.readdirSync(DIR).filter((x) => x.endsWith(".md")).length} agentes, sólo lectura, modelos según el diseño.`);
