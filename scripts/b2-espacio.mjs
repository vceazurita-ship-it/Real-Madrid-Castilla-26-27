/**
 * EL ESPACIO DE BACKBLAZE B2, SOSTENIBLE (27/11/2026).
 *
 *   node scripts/b2-espacio.mjs           en seco: dice qué ocupa y qué liberaría
 *   node scripts/b2-espacio.mjs --hacer   lo libera
 *
 * Backblaze avisó el 27/11 del 75 % de los 10 GB gratis (7,6 GB). Lo que más
 * pesa y más crece es el vídeo de cada acción del Castilla sacado de Opta
 * (`opta/acciones/<partido>/…`, ~0,25 GB por partido: 2,5 GB con 11
 * partidos). Ese vídeo se puede volver a bajar cuando se quiera y, si no
 * está, cada acción sigue teniendo «Vídeo en Opta» (ProVision en ese
 * segundo), así que es lo que se rota:
 *
 *   - Se quedan los cortes de los últimos PARTIDOS partidos del Castilla
 *     (por fecha, de opta:partidos). Los de los anteriores se borran de B2 (todas
 *     sus versiones) y salen del documento opta:acciones-video, para que la
 *     pantalla no enlace a un vídeo que ya no está.
 *   - Si aun así el bucket pasa de OBJETIVO, se quedan menos partidos (nunca
 *     menos de MINIMO).
 *
 * `opta-acciones-video.mjs` sólo baja esos mismos últimos partidos, así que lo
 * borrado no se vuelve a bajar. Lo demás (goles, cortes de Hudl, informes,
 * copias, clips de jugadores) no se toca. Corre cada noche en
 * jornada-nocturna.cmd antes de bajar vídeo nuevo, y `scripts/b2.cjs` no deja
 * subir nada por encima de 9 GB.
 *
 * Termina con «RESUMEN: …». Códigos: 0 bien · 1 fallo.
 */
import { createRequire } from "node:module";
import { baseConfigurada, guardaDoc, leeDocs } from "./docs-base.mjs";

const require = createRequire(import.meta.url);
const { entorno } = require("./supabase-local.cjs");

for (const [k, v] of Object.entries(entorno() ?? {})) if (!process.env[k]) process.env[k] = v;

const b2 = require("./b2.cjs");

/* 4, elegido por el analista el 27/11/2026; el mismo número que el --partidos por defecto de opta-acciones-video.mjs. */
const PARTIDOS = 4;
const MINIMO = 2;
const OBJETIVO = 8e9;
const CASTILLA = "3kibouup3gxwnnxp3vhz83af7";
const CLAVE = "opta:acciones-video";
const HACER = process.argv.includes("--hacer");
const gb = (x) => `${(x / 1e9).toFixed(2)} GB`;

async function fin(codigo, texto) {
  console.log(`RESUMEN: ${texto}`);
  process.exitCode = codigo;
  setTimeout(() => process.exit(codigo), 300);
  await new Promise(() => {});
}

if (!b2.configurado()) await fin(1, "falta la llave de B2");
if (!baseConfigurada()) await fin(1, "falta la base de datos (Supabase o DATOS_PG_URL)");

/* Todas las versiones del bucket, con su id (para poder borrarlas). */
const s = await b2.autoriza();
const versiones = [];
let nombre = null;
let id = null;

do {
  const r = await fetch(`${s.apiUrl}/b2api/v3/b2_list_file_versions`, {
    method: "POST",
    headers: { Authorization: s.token, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: s.bucketId, maxFileCount: 10000, ...(nombre ? { startFileName: nombre, startFileId: id } : {}) }),
  });
  const j = await r.json();

  if (!r.ok) await fin(1, `B2 no deja listar: ${j.message ?? r.status}`);
  versiones.push(...(j.files ?? []));
  nombre = j.nextFileName;
  id = j.nextFileId;
} while (nombre);

const total = versiones.reduce((a, f) => a + (f.contentLength ?? 0), 0);
console.log(`Backblaze B2: ${gb(total)} de 10 GB (${Math.round(total / 1e8)} %), ${versiones.length} versiones.`);

/* Lo que pesa cada partido en opta/acciones. */
const porPartido = new Map();

for (const f of versiones) {
  const m = f.fileName.match(/^opta\/acciones\/([^/]+)\//);

  if (!m) continue;
  const p = porPartido.get(m[1]) ?? { bytes: 0, ficheros: [] };

  p.bytes += f.contentLength ?? 0;
  p.ficheros.push(f);
  porPartido.set(m[1], p);
}

const docs = await leeDocs(["opta:partidos", CLAVE]);
const tabla = docs["opta:partidos"];

if (!tabla?.cols) await fin(1, "falta opta:partidos");

const iT = tabla.cols.indexOf("teamId");
const iP = tabla.cols.indexOf("partido");
const iF = tabla.cols.indexOf("fecha");
const fechaDe = new Map(tabla.filas.filter((f) => f[iT] === CASTILLA).map((f) => [String(f[iP]), String(f[iF] ?? "")]));
/* Del más nuevo al más viejo; un partido que no está en opta:partidos cuenta como el más viejo. */
const orden = [...porPartido.keys()].sort((a, b) => (fechaDe.get(b) ?? "").localeCompare(fechaDe.get(a) ?? ""));

let quedan = Math.min(PARTIDOS, orden.length);
const libera = (n) => orden.slice(n).reduce((a, p) => a + porPartido.get(p).bytes, 0);

while (quedan > MINIMO && total - libera(quedan) > OBJETIVO) quedan--;

const fuera = orden.slice(quedan);
const liberado = libera(quedan);

for (const p of orden) {
  console.log(`  ${fuera.includes(p) ? "BORRA" : "queda"}  ${(fechaDe.get(p) || "¿sin fecha?").slice(0, 10)}  ${p}  ${gb(porPartido.get(p).bytes)}`);
}

if (!fuera.length) await fin(0, `${gb(total)} en B2; el vídeo de acciones ya sólo tiene los últimos ${orden.length} partidos, no sobra nada`);

if (!HACER) await fin(0, `en seco: se borrarían ${fuera.length} partidos de vídeo de acciones (${gb(liberado)}); B2 quedaría en ${gb(total - liberado)}. Para hacerlo: --hacer`);

/* Primero el documento (que la pantalla deje de enlazarlos), luego los ficheros. */
const doc = docs[CLAVE] ?? { clips: {} };
let entradas = 0;

for (const k of Object.keys(doc.clips ?? {})) {
  if (fuera.includes(k.split("|")[0])) {
    delete doc.clips[k];
    entradas++;
  }
}

doc.actualizado = new Date().toISOString();
await guardaDoc(CLAVE, "opta", doc);

let borradas = 0;
let fallos = 0;

for (const p of fuera) {
  for (const f of porPartido.get(p).ficheros) {
    const r = await fetch(`${s.apiUrl}/b2api/v3/b2_delete_file_version`, {
      method: "POST",
      headers: { Authorization: s.token, "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: f.fileName, fileId: f.fileId }),
    });

    if (r.ok) borradas++;
    else fallos++;
  }
}

await fin(fallos ? 1 : 0, `vídeo de acciones: fuera ${fuera.length} partidos viejos (${borradas} ficheros, ${gb(liberado)}; ${entradas} enlaces quitados del documento${fallos ? `; ${fallos} no se pudieron borrar, se reintenta mañana` : ""}). B2 queda en ${gb(total - liberado)} de 10 GB; se quedan los últimos ${quedan} partidos`);
