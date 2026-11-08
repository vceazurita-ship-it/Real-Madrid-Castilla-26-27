/*
|--------------------------------------------------------------------------
| MAPA DE LA MEMORIA EN JSON CANVAS (08/11/2026)
|--------------------------------------------------------------------------
|
| Idea tomada del «segundo cerebro» de Obsidian (kepano, formato abierto
| jsoncanvas.org): las notas de memoria del proyecto ya se enlazan con
| [[nombre]]; esto las pinta como un mapa (.canvas) que se abre en Obsidian
| o en cualquier visor de JSON Canvas. Sólo lee la memoria y escribe el mapa.
|
|   node scripts/agentes/mapa-memoria.mjs [carpeta-memoria] [salida.canvas]
*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const carpeta = process.argv[2] ?? path.join(os.homedir(), ".claude", "projects", "C--Users-Usuario-Downloads-RMCF-CASTILLA-RMCF-Real-Madrid-Castilla-26-27", "memory");
const salida = process.argv[3] ?? path.join(carpeta, "mapa.canvas");

const notas = fs.readdirSync(carpeta).filter((f) => f.endsWith(".md") && f !== "MEMORY.md").map((f) => {
  const txt = fs.readFileSync(path.join(carpeta, f), "utf8");
  const nombre = txt.match(/^name:\s*(.+)$/m)?.[1].trim() ?? f.replace(/\.md$/, "");
  const desc = txt.match(/^description:\s*(.+)$/m)?.[1].trim() ?? "";
  const tipo = txt.match(/^\s*type:\s*(\w+)/m)?.[1] ?? "project";
  const enlaces = [...txt.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
  return { f, nombre, desc, tipo, enlaces };
});
const porNombre = new Map(notas.map((n) => [n.nombre, n]));
const grado = (n) => n.enlaces.length + notas.filter((o) => o.enlaces.includes(n.nombre)).length;
/* Las más enlazadas, en el centro; el resto en anillos. */
const orden = [...notas].sort((a, b) => grado(b) - grado(a));
const COLOR = { project: "4", feedback: "1", reference: "5", user: "6" };
const nodes = orden.map((n, i) => {
  const anillo = Math.floor(Math.sqrt(i));
  const enAnillo = 2 * anillo + 1;
  const ang = (2 * Math.PI * (i - anillo * anillo)) / enAnillo;
  const r = anillo * 520;
  return { id: n.nombre, type: "file", file: n.f, x: Math.round(r * Math.cos(ang)), y: Math.round(r * Math.sin(ang)), width: 400, height: 220, color: COLOR[n.tipo] ?? "4" };
});
const edges = [];
for (const n of notas) for (const e of new Set(n.enlaces)) if (porNombre.has(e) && e !== n.nombre) edges.push({ id: `${n.nombre}->${e}`, fromNode: n.nombre, toNode: e, toEnd: "arrow" });
fs.writeFileSync(salida, JSON.stringify({ nodes, edges }, null, 1));
const sueltas = notas.filter((n) => grado(n) === 0).map((n) => n.nombre);
console.log(`${nodes.length} notas · ${edges.length} enlaces · ${sueltas.length} sin enlazar → ${salida}`);
