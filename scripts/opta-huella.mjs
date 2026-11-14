/**
 * HUELLA TÁCTICA (14/11/2026, idea de F. Sosa · The Eye Intelligence Unit).
 *
 * Dónde toca cada equipo de Primera RFEF más y menos balón que el equipo
 * medio de su grupo. Lee el evento a evento de todos los partidos guardados
 * (`opta:directo:<partido>`, tabla `eventos`) y deja `opta:huella`:
 *
 *   { actualizado, mx, my, partidos, equipos: [{ teamId, nombre, grupo,
 *     castilla, partidos, toques, campoRival, malla: number[mx*my] }] }
 *
 * · Toque = la misma regla que el directo (lib/opta-directo-mapas.ts esToque):
 *   todo evento con sitio salvo falta, córner concedido, regateado, entrada
 *   fallida y falta cometida.
 * · Opta da la x de cada evento con su equipo atacando hacia x = 100.
 * · malla = recuento de toques por celda (mx a lo largo, my a lo ancho);
 *   la pantalla suaviza y compara con la media del grupo.
 * · grupo = componentes conexas de quién juega con quién (Opta no lo dice);
 *   el del Castilla es el 1.
 *
 * Uso: node --env-file=.env.local scripts/opta-huella.mjs [--fichero <carpeta>]
 */
import { createRequire } from "node:module";
const { createClient } = createRequire(import.meta.url)("../lib/datos/cliente.cjs");

const CASTILLA = "3kibouup3gxwnnxp3vhz83af7";
const MX = 30;
const MY = 20;
const NO_ES_TOQUE = new Set(["FreeKick", "Corner", "Challenge", "AttemptedTackle", "Foul"]);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const A_FICHERO = process.argv.includes("--fichero") ? process.argv[process.argv.indexOf("--fichero") + 1] : null;

async function claves() {
  const salida = [];
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await sb.from("app_documents").select("key").like("key", "opta:directo:%").order("key").range(desde, desde + 499);
    if (error) throw new Error(error.message);
    salida.push(...data.map((d) => d.key).filter((k) => k !== "opta:directo:archivo"));
    if (data.length < 500) break;
  }
  return salida;
}

const equipos = new Map();
const vecinos = new Map();
const une = (x, y) => {
  if (!vecinos.has(x)) vecinos.set(x, new Set());
  if (!vecinos.has(y)) vecinos.set(y, new Set());
  vecinos.get(x).add(y);
  vecinos.get(y).add(x);
};

let partidos = 0;
for (const key of await claves()) {
  const { data, error } = await sb.from("app_documents").select("data").eq("key", key).maybeSingle();
  if (error) throw new Error(`${key}: ${error.message}`);
  const doc = data?.data;
  const ev = doc?.eventos;
  const eq = doc?.equipos;
  if (!ev?.cols || !Array.isArray(ev.filas) || ev.filas.length < 200 || !eq?.cols) continue;
  /* Sólo partidos acabados: un directo a medias pesaría menos que el resto. */
  if (!/played|full/i.test(String(doc.estado ?? ""))) continue;
  const iE = (n) => eq.cols.indexOf(n);
  const delPartido = eq.filas.map((f) => ({ teamId: String(f[iE("teamId")]), nombre: String(f[iE("equipo")] ?? "") }));
  if (delPartido.length !== 2) continue;
  partidos += 1;
  une(delPartido[0].teamId, delPartido[1].teamId);
  for (const { teamId, nombre } of delPartido) {
    if (!equipos.has(teamId)) equipos.set(teamId, { teamId, nombre, partidos: 0, toques: 0, rival: 0, malla: new Array(MX * MY).fill(0) });
    const e = equipos.get(teamId);
    e.partidos += 1;
    if (nombre) e.nombre = nombre;
  }
  const i = (n) => ev.cols.indexOf(n);
  const [cT, cTipo, cX, cY] = [i("teamId"), i("tipo"), i("x"), i("y")];
  for (const f of ev.filas) {
    const e = equipos.get(String(f[cT]));
    if (!e || NO_ES_TOQUE.has(f[cTipo])) continue;
    const x = Number(f[cX]);
    const y = Number(f[cY]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) continue;
    const gx = Math.min(MX - 1, Math.max(0, Math.floor((x / 100) * MX)));
    const gy = Math.min(MY - 1, Math.max(0, Math.floor((y / 100) * MY)));
    e.malla[gy * MX + gx] += 1;
    e.toques += 1;
    if (x > 50) e.rival += 1;
  }
}

/* Grupos: el del Castilla, el 1. */
const grupo = new Map();
let n = 0;
const orden = [CASTILLA, ...[...vecinos.keys()].filter((k) => k !== CASTILLA)];
for (const inicio of orden) {
  if (!vecinos.has(inicio) || grupo.has(inicio)) continue;
  n += 1;
  const pila = [inicio];
  while (pila.length) {
    const x = pila.pop();
    if (grupo.has(x)) continue;
    grupo.set(x, n);
    for (const y of vecinos.get(x) ?? []) if (!grupo.has(y)) pila.push(y);
  }
}

const lista = [...equipos.values()]
  .filter((e) => e.toques > 0)
  .map((e) => ({
    teamId: e.teamId,
    nombre: e.nombre,
    grupo: grupo.get(e.teamId) ?? 0,
    castilla: e.teamId === CASTILLA,
    partidos: e.partidos,
    toques: e.toques,
    campoRival: e.rival / e.toques,
    malla: e.malla,
  }))
  .sort((a, b) => b.campoRival - a.campoRival);

const salida = { actualizado: new Date().toISOString(), mx: MX, my: MY, partidos, equipos: lista };
if (A_FICHERO) {
  const fs = await import("node:fs");
  fs.mkdirSync(A_FICHERO, { recursive: true });
  fs.writeFileSync(`${A_FICHERO}/opta-huella.json`, JSON.stringify(salida));
} else {
  const { error } = await sb.from("app_documents").upsert({ key: "opta:huella", kind: "opta", data: salida, updated_at: salida.actualizado }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
const g1 = lista.filter((e) => e.grupo === 1).length;
console.log(`Huella: ${partidos} partidos, ${lista.length} equipos (${g1} en el grupo del Castilla).`);
process.exit(0);
