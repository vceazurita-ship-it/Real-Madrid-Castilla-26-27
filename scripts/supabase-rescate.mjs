/**
 * RESCATE DE LOS FICHEROS QUE SE QUEDARON EN SUPABASE (16/11/2026).
 *
 *   node scripts/supabase-rescate.mjs             si Supabase deja bajar ficheros, los rescata
 *   node scripts/supabase-rescate.mjs --en-seco   sólo dice qué haría
 *
 * Supabase se cortó el 13/11 (402, cuota de almacenamiento) y su API de
 * ficheros dejó de contestar. La base se pasó a la reserva (DATOS_PG_URL) y los
 * ficheros NUEVOS van a Backblaze B2, pero los 495 viejos (732 MB) siguen allí:
 * informes de lesión, GPS y controles de carga, documentos e informes de los
 * rivales, imágenes de los desplazamientos, adjuntos de alertas y 4 fotos de
 * jugadores. 252 no tienen copia en ningún otro sitio (inventario del 16/11 en
 * .cache/copias/supabase-2026-11-16/storage-objects.json, sacado por SQL).
 *
 * Lo lanza `salud-datos.mjs` cada día en cuanto ve que Supabase ha vuelto. Hace:
 *   1. baja cada fichero del inventario a .cache/copias/supabase-storage/<cubo>/<ruta>
 *      (todos, también los de la otra app del proyecto, cubo «aspecto»);
 *   2. sube a B2 los de la app con la misma ruta que usa el cliente de datos
 *      (cubo performance → <ruta>; otros → <cubo>/<ruta>), así /api/video los sirve;
 *   3. cambia en la base los enlaces «…supabase.co/storage/v1/object/…» de esos
 *      ficheros por «<web>/api/video/<ruta>», documento a documento y con
 *      escritura condicional sobre `updated_at` (si alguien guarda en medio, se
 *      reintenta al día siguiente).
 * Es idempotente: apunta lo hecho en .cache/copias/supabase-rescate.json y
 * retoma donde lo dejó.
 *
 * Termina con «RESUMEN: …». Códigos: 0 hecho o nada que hacer · 2 Supabase
 * sigue cortado · 1 fallo.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { RAIZ, entorno } = require("./supabase-local.cjs");

for (const [k, v] of Object.entries(entorno() ?? {})) if (!process.env[k]) process.env[k] = v;

const EN_SECO = process.argv.includes("--en-seco");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITIO = (process.env.SITIO_PUBLICO || "https://rmcf-castilla.onrender.com").replace(/\/$/, "");
const CARPETA = path.join(RAIZ, ".cache", "copias");
const INVENTARIO = path.join(CARPETA, "supabase-2026-11-16", "storage-objects.json");
const DESTINO = path.join(CARPETA, "supabase-storage");
const ESTADO = path.join(CARPETA, "supabase-rescate.json");
/** Cubos de otra aplicación del mismo proyecto: se guardan aquí, no van a B2. */
const AJENOS = new Set(["aspecto"]);

/* Salir sin `process.exit` en seco: en Windows, justo después de un fetch, Node revienta en libuv (código 127). */
const fin = async (codigo, texto) => {
  console.log(`RESUMEN: ${texto}`);
  process.exitCode = codigo;
  setTimeout(() => process.exit(codigo), 300);
  await new Promise(() => {});
};

if (!URL_SB || !CLAVE) await fin(1, "faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
if (!fs.existsSync(INVENTARIO)) await fin(1, `no está el inventario (${INVENTARIO})`);

const cab = { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` };
const prueba = await fetch(`${URL_SB}/storage/v1/bucket`, { headers: cab }).catch((e) => ({ ok: false, status: e.message }));

if (prueba.status === 402) await fin(2, "Supabase sigue cortado (402): no se puede bajar nada todavía");
if (!prueba.ok) await fin(1, `la API de ficheros de Supabase contesta ${prueba.status}`);

const inv = JSON.parse(fs.readFileSync(INVENTARIO, "utf8"));
const objetos = (Array.isArray(inv) ? inv[0]?.todo ?? inv : inv).filter((o) => o?.b && o?.n);
const estado = fs.existsSync(ESTADO) ? JSON.parse(fs.readFileSync(ESTADO, "utf8")) : { bajados: {}, subidos: {}, enlaces: {} };
const b2 = require("./b2.cjs");
const rutaB2 = (o) => `${o.b === "performance" ? "" : `${o.b}/`}${o.n}`;
const guarda = () => fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 1));

let bajados = 0;
let subidos = 0;
const fallos = [];

for (const o of objetos) {
  const clave = `${o.b}/${o.n}`;
  const local = path.join(DESTINO, o.b, ...o.n.split("/"));

  try {
    if (!estado.bajados[clave] || !fs.existsSync(local)) {
      if (EN_SECO) {
        console.log(`bajaría ${clave}`);
        continue;
      }

      const r = await fetch(`${URL_SB}/storage/v1/object/${o.b}/${o.n.split("/").map(encodeURIComponent).join("/")}`, { headers: cab });

      if (!r.ok) throw new Error(`HTTP ${r.status} al bajar`);

      const datos = Buffer.from(await r.arrayBuffer());

      fs.mkdirSync(path.dirname(local), { recursive: true });
      fs.writeFileSync(local, datos);
      estado.bajados[clave] = datos.length;
      bajados++;
      guarda();
    }

    if (AJENOS.has(o.b) || estado.subidos[clave]) continue;

    if (EN_SECO) {
      console.log(`subiría a B2 ${rutaB2(o)}`);
      continue;
    }

    await b2.sube(rutaB2(o), fs.readFileSync(local), o.m || "application/octet-stream");
    estado.subidos[clave] = rutaB2(o);
    subidos++;
    guarda();
  } catch (e) {
    fallos.push(`${clave}: ${e.message}`);
  }
}

/* ---------------- los enlaces de la base ---------------- */

let cambiados = 0;

if (!EN_SECO && process.env.DATOS_PG_URL) {
  const postgres = require("postgres");
  const sql = postgres(process.env.DATOS_PG_URL, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATOS_PG_URL) ? false : "require", prepare: false });
  const host = new URL(URL_SB).host.replace(/\./g, "\\.");
  const patron = new RegExp(`https?://${host}/storage/v1/object/(?:public|sign|authenticated)/([^/"?\\s]+)/([^"?\\s]+)(?:\\?[^"\\s]*)?`, "g");
  const nueva = (cubo, ruta) => {
    let llano = ruta;

    /* Un «%» suelto en un enlace no puede tumbar el rescate entero: se deja ese enlace como estaba. */
    try {
      llano = decodeURIComponent(ruta);
    } catch {
      return null;
    }

    const clave = `${cubo}/${llano}`;

    if (!estado.subidos[clave]) return null;

    return `${SITIO}/api/video/${estado.subidos[clave].split("/").map(encodeURIComponent).join("/")}`;
  };

  for (const [tabla, k] of [["app_documents", "key"], ["general_seasons", "season"], ["performance_seasons", "season"], ["match_ratings", "season"]]) {
    const filas = await sql.unsafe(`select ${k} as k, data::text as d, updated_at from ${tabla} where data::text like $1`, [`%${new URL(URL_SB).host}/storage/%`]);

    for (const f of filas) {
      let n = 0;
      const d = f.d.replace(patron, (todo, cubo, ruta) => {
        const u = nueva(cubo, ruta);

        if (!u) return todo;
        n++;

        return u;
      });

      if (!n) continue;

      /* Se compara en milisegundos: las filas escritas antes del disparador que redondea guardan microsegundos y la fecha leída en JS no los trae. */
      const r = await sql.unsafe(
        `update ${tabla} set data = $1::jsonb, updated_at = date_trunc('milliseconds', now()) where ${k} = $2 and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $3::timestamptz)`,
        [d, f.k, f.updated_at],
      );

      if (r.count === 1) {
        cambiados += n;
        estado.enlaces[`${tabla}:${f.k}`] = n;
      } else {
        fallos.push(`${tabla}:${f.k}: alguien guardó en medio; se reintenta mañana`);
      }
    }
  }

  guarda();
  await sql.end();
}

const total = objetos.length;
const hechos = Object.keys(estado.bajados).length;
const enB2 = Object.keys(estado.subidos).length;

if (fallos.length) for (const f of fallos.slice(0, 20)) console.log(`  fallo: ${f}`);

await fin(
  fallos.length ? 1 : 0,
  `${hechos}/${total} ficheros bajados (${bajados} hoy), ${enB2} en B2 (${subidos} hoy), ${cambiados} enlaces cambiados${fallos.length ? `; ${fallos.length} fallos` : ""}`,
);
