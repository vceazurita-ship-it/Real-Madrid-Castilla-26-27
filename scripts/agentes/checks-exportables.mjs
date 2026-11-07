/*
|--------------------------------------------------------------------------
| PUERTA DETERMINISTA ANTES DE LOS JUECES (07/11/2026)
|--------------------------------------------------------------------------
|
|   node scripts/agentes/checks-exportables.mjs     (tras captura-exportables.cjs)
|
| Idea tomada del método de «grafo de agentes» (nota de investigación que trajo
| el usuario): lo que tiene una única respuesta correcta lo comprueba código, no
| un modelo; y no se abre la puerta de los jueces sin evidencia. El 06/11 los
| jueces puntuaron dos rondas sin los PDF (no les llegaban) y eso costó dinero
| y notas falsas.
|
| Escribe .cache/expertos/areas/informes/checks.md (nodo | requisito |
| veredicto | evidencia) y sale con código 1 si algo FALLA. red.mjs no llama a
| los jueces del grupo «informes» si falla (salvo --sin-puerta).
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CARPETA = path.join(RAIZ, ".cache", "expertos", "areas", "informes");
const filas = [];
const apunta = (nodo, requisito, ok, evidencia) => filas.push({ nodo, requisito, veredicto: ok === null ? "sin resolver" : ok ? "pasa" : "falla", evidencia });
const lista = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).map(String) : []);
const mb = (f) => fs.statSync(f).size / 1048576;

/* 1 · El .zip de la pizarra */
const piz = path.join(CARPETA, "pizarra");
const ficheros = lista(piz);
const general = ficheros.filter((f) => /^General[\\/].+\.pdf$/i.test(f));
const pptx = ficheros.filter((f) => /\.pptx$/i.test(f));
const pdfJug = ficheros.filter((f) => /^Jugadores[\\/].+\.pdf$/i.test(f));
const mp4 = ficheros.filter((f) => /\.mp4$/i.test(f));

apunta("pizarra", "llega el .zip descomprimido", ficheros.length > 0, `${ficheros.length} ficheros en pizarra/`);
apunta("pizarra", "PDF general", general.length === 1, general.join(", ") || "ninguno");
apunta("pizarra", "PowerPoint", pptx.length === 1, pptx.join(", ") || "ninguno");
apunta("pizarra", "un PDF por jugador del once (10 de campo + portero)", pdfJug.length >= 11, `${pdfJug.length} PDF en Jugadores/`);
apunta("pizarra", "portero entre los PDF", pdfJug.some((f) => /MESTRE|POR|PORTERO/i.test(f)) || null, pdfJug.find((f) => /MESTRE/i.test(f)) ?? "no encontrado por nombre");

if (mp4.length) {
  const pesos = mp4.map((f) => mb(path.join(piz, f)));
  const max = Math.max(...pesos);

  apunta("vídeos", "ningún MP4 vacío", pesos.every((p) => p > 0.05), `mínimo ${Math.min(...pesos).toFixed(2)} MB`);
  apunta("vídeos", "ningún MP4 de más de 15 MB (WhatsApp)", max <= 15, `máximo ${max.toFixed(1)} MB · total ${pesos.reduce((s, p) => s + p, 0).toFixed(1)} MB en ${mp4.length}`);
}

/* 2 · Las páginas en imagen (lo que lee el juez de comunicación) */
const paginas = lista(path.join(CARPETA, "paginas")).filter((f) => f.endsWith(".jpg"));

apunta("páginas", "páginas de los PDF en imagen", paginas.length >= 5, `${paginas.length} jpg`);

/* 3 · Los informes */
const HUECOS = /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b|sin dato|no hay nada escrito|Infinity/;

for (const nombre of ["informe-abp-previa", "informe-partido-previa"]) {
  const txt = path.join(CARPETA, `${nombre}.txt`);
  const jpg = path.join(CARPETA, `${nombre}.jpg`);
  const texto = fs.existsSync(txt) ? fs.readFileSync(txt, "utf8") : "";
  const hueco = HUECOS.exec(texto);

  apunta(nombre, "captura y texto", fs.existsSync(jpg) && texto.length > 500, `${texto.length} caracteres`);
  apunta(nombre, "sin huecos (undefined, NaN, «sin dato»…)", !hueco, hueco ? `«${texto.slice(Math.max(0, hueco.index - 40), hueco.index + 40).replace(/\s+/g, " ")}»` : "ninguno");
  apunta(nombre, "captura del móvil", fs.existsSync(path.join(CARPETA, `${nombre}-movil.jpg`)), `${nombre}-movil.jpg`);
}

/* El punto débil del titular, citado también en «Dónde hacerles daño» (lo pedían los jueces). */
const partido = fs.existsSync(path.join(CARPETA, "informe-partido-previa.txt")) ? fs.readFileSync(path.join(CARPETA, "informe-partido-previa.txt"), "utf8") : "";
/* «Les hacemos daño por Jiménez: …» o «Les hacemos daño en su salida: Mehdi Puch» (07/11/2026); y el «punto débil» de antes. */
const debil = (
  /Les hacemos da[nñ]o por\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.]+(?:\s[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/.exec(partido) ??
  /Les hacemos da[nñ]o[^:\n]*:\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.]+(?:\s[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/.exec(partido) ??
  /punto d[eé]bil[^:\n]*:\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.]+(?:\s[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/.exec(partido)
)?.[1];
const dano = /D[oó]nde hacerles da[nñ]o([\s\S]{0,800})/i.exec(partido)?.[1] ?? "";

if (debil) apunta("informe-partido-previa", "el punto débil del titular sale en «Dónde hacerles daño»", dano.includes(debil.split(" ").pop()), `titular: ${debil}`);

/* 4 · Errores de JS */
const medidas = fs.existsSync(path.join(CARPETA, "medidas.json")) ? JSON.parse(fs.readFileSync(path.join(CARPETA, "medidas.json"), "utf8")) : { pantallas: [] };

for (const p of medidas.pantallas ?? []) apunta("js", `sin errores en ${p.ruta}`, !(p.errores ?? []).length, (p.errores ?? []).join(" | ").slice(0, 160) || "ninguno");

const md = ["| nodo | requisito | veredicto | evidencia |", "|---|---|---|---|", ...filas.map((f) => `| ${f.nodo} | ${f.requisito} | ${f.veredicto} | ${String(f.evidencia).replace(/\|/g, "/")} |`)].join("\n");

fs.mkdirSync(CARPETA, { recursive: true });
fs.writeFileSync(path.join(CARPETA, "checks.md"), `# Puerta antes de los jueces\n\n${md}\n`);
console.log(md);

const fallan = filas.filter((f) => f.veredicto === "falla");

console.log(fallan.length ? `\nFALLAN ${fallan.length}: no se llama a los jueces.` : "\nTodo pasa.");
process.exit(fallan.length ? 1 : 0);
