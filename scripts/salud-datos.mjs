/*
|--------------------------------------------------------------------------
| COPIA DE SEGURIDAD Y VIGÍA DE LÍMITES (15/11/2026)
|--------------------------------------------------------------------------
|
| «Quiero que no volvamos a tener ningún problema ni con Render ni con los
| vídeos/fotos ni con la base de datos». Lo lanza el vigía una vez al día.
|
| 1. COPIA: las cuatro tablas de la base que esté usando la app (la reserva
|    de Render o Supabase) a un .json.gz en .cache/copias (se guardan 21) y
|    otra en Backblaze B2, `copias/datos-AAAA-MM-DD.json.gz` (bucket privado).
|    Si un día se pierde una base, se vuelve con
|      node scripts/datos-copia.mjs --desde <el .json> --hacia <url> --hacer
|    (el .gz se descomprime antes; el formato es el mismo).
| 2. LÍMITES: tamaño de la base (1 GB gratis en Render, 0,5 GB en Neon),
|    días que le quedan a la base gratis de Render (DATOS_PG_CADUCA,
|    AAAA-MM-DD; 2026-12-14 si no está), lo ocupado en B2 (10 GB gratis) y si
|    Supabase ha vuelto. Si algo pasa del 70 % o quedan 10 días o menos,
|    manda UN correo al día al administrador con qué pasa y qué hacer.
|
|   node scripts/salud-datos.mjs            copia + límites + correo si toca
|   node scripts/salud-datos.mjs --en-seco  lo mismo, sin subir ni mandar
|
| Códigos: 0 todo bien · 3 hay aviso · 1 fallo de la copia.
*/
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");

const { RAIZ, entorno, salir } = require("./supabase-local.cjs");

const env = entorno() ?? {};
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

const EN_SECO = process.argv.includes("--en-seco");
const CARPETA = path.join(RAIZ, ".cache", "copias");
const GUARDAR = 21;
const HOY = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const TABLAS = ["app_documents", "general_seasons", "performance_seasons", "match_ratings"];
const B2_GRATIS = 10e9;
const PARA = String(process.env.AVISO_DATOS_PARA ?? "").trim() || "v.ceazurita@gmail.com";
const URL_APP = (process.env.SITIO_PUBLICO || "https://rmcf-castilla.onrender.com").replace(/\/$/, "");

const avisos = [];
const notas = [];
const mb = (b) => `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB`;

/* ---------------------------- 1. la copia ---------------------------- */

async function copia() {
  const url = process.env.DATOS_PG_URL;
  if (!url) {
    notas.push("Copia: sin DATOS_PG_URL (la app está en Supabase); se salta.");
    return null;
  }

  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", max: 1, prepare: false, onnotice: () => {} });

  try {
    const salida = { hechaEn: new Date().toISOString() };
    for (const t of TABLAS) {
      try {
        salida[t] = [...(await sql.unsafe(`select * from ${t}`))];
      } catch (e) {
        salida[t] = [];
        notas.push(`Copia: ${t} no se ha podido leer (${e.message}).`);
      }
    }
    const [{ bytes }] = await sql`select pg_database_size(current_database())::bigint as bytes`;
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(salida)));

    fs.mkdirSync(CARPETA, { recursive: true });
    const fichero = path.join(CARPETA, `datos-${HOY}.json.gz`);
    fs.writeFileSync(fichero, gz);
    const viejas = fs.readdirSync(CARPETA).filter((f) => /^datos-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).sort();
    for (const f of viejas.slice(0, Math.max(0, viejas.length - GUARDAR))) fs.unlinkSync(path.join(CARPETA, f));

    const filas = TABLAS.map((t) => `${t} ${salida[t].length}`).join(", ");
    estado.copia = { dia: HOY, bytes: gz.length };
    notas.push(`Copia de hoy: ${filas} (${mb(gz.length)} comprimida), en .cache/copias.`);

    if (!EN_SECO) {
      try {
        const b2 = require("./b2.cjs");
        if (b2.configurado()) {
          await b2.sube(`copias/datos-${HOY}.json.gz`, gz, "application/gzip");
          notas.push("Copia subida a Backblaze B2 (copias/).");
        } else {
          avisos.push("La copia de la base sólo está en este ordenador: falta configurar Backblaze B2 en .env.local.");
        }
      } catch (e) {
        avisos.push(`La copia no se ha podido subir a Backblaze (${e.message}); la de este ordenador sí está.`);
      }
    }

    return Number(bytes);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/* ---------------------------- 2. límites ---------------------------- */

function miraBase(bytes) {
  if (bytes == null) return;
  estado.base = { bytes };
  const url = process.env.DATOS_PG_URL || "";
  const enNeon = /neon\.tech/.test(url);
  const tope = enNeon ? 0.5e9 : 1e9;
  const uso = bytes / tope;
  notas.push(`Base de datos: ${mb(bytes)} de ${mb(tope)} (${Math.round(uso * 100)} %).`);
  if (uso > 0.7) avisos.push(`La base de datos ocupa ${mb(bytes)}, el ${Math.round(uso * 100)} % de lo gratis. Hay que limpiar documentos viejos (scripts/limpia-supabase.mjs en seco primero).`);

  if (/render\.com/.test(url)) {
    const caduca = process.env.DATOS_PG_CADUCA || "2026-12-14";
    const dias = Math.round((new Date(`${caduca}T00:00:00Z`) - new Date(`${HOY}T00:00:00Z`)) / 86_400_000);
    estado.base.caduca = caduca;
    estado.base.dias = dias;
    notas.push(`La base gratis de Render caduca el ${caduca} (quedan ${dias} días).`);
    if (dias <= 10) {
      avisos.push(
        `La base gratis de Render caduca en ${dias} días (${caduca}). Antes de esa fecha: crear una base en Neon (gratis y sin caducidad), copiar con ` +
          "`node scripts/datos-copia.mjs --desde <url de Render> --hacia <url de Neon> --hacer` y cambiar DATOS_PG_URL en Render, GitHub y .env.local. " +
          "La copia de cada noche está en .cache/copias y en Backblaze.",
      );
    }
  }
}

async function miraB2() {
  try {
    const b2 = require("./b2.cjs");
    if (!b2.configurado()) return;
    const todo = await b2.lista("");
    let total = 0;
    for (const v of todo.values()) total += v;
    const uso = total / B2_GRATIS;
    estado.b2 = { bytes: total, ficheros: todo.size, tope: B2_GRATIS };
    notas.push(`Backblaze B2 (vídeos, fotos y copias): ${mb(total)} de 10 GB (${Math.round(uso * 100)} %), ${todo.size} ficheros.`);
    if (uso > 0.7) avisos.push(`Backblaze B2 lleva ${mb(total)} de los 10 GB gratis (${Math.round(uso * 100)} %). Hay que borrar vídeos de temporadas o jornadas viejas antes de llegar al 100 %, o pasará a cobrar.`);
  } catch (e) {
    notas.push(`Backblaze: no se ha podido medir (${e.message}).`);
  }
}

async function miraSupabase() {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!u || !k) return;
  try {
    const r = await fetch(`${u}/rest/v1/app_documents?select=key&limit=1`, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
    estado.supabase = r.status === 402 ? "cortado" : r.ok ? "vuelto" : String(r.status);
    if (r.status === 402) notas.push("Supabase sigue cortado (402).");
    else if (r.ok) notas.push("Supabase ha vuelto: se puede pensar en volver (ver la nota del plan B), pero la reserva sigue mandando mientras DATOS_PG_URL esté puesta.");
    else notas.push(`Supabase responde ${r.status}.`);
  } catch (e) {
    notas.push(`Supabase: sin respuesta (${e.message}).`);
  }
}

/* ------------------------ Render: minutos ------------------------ */

/*
| Las publicaciones las hace .github/workflows/publica-render.yml y cada una
| deja la etiqueta render-AAAAMMDD-HHMM: se cuentan las del mes y se calcula
| con RENDER_MIN_POR_BUILD (8 por defecto) contra los 500 gratis.
*/
const estado = { comprobadoEn: new Date().toISOString(), pendientes: [] };

function miraRender() {
  try {
    const { execFileSync } = require("node:child_process");
    const salida = execFileSync("git", ["ls-remote", "--tags", "origin", "render-*"], { cwd: RAIZ, encoding: "utf8", timeout: 30_000 });
    const mes = HOY.slice(0, 7).replace("-", "");
    const n = salida.split(/\r?\n/).filter((l) => l.includes(`refs/tags/render-${mes}`)).length;
    const porBuild = Number(process.env.RENDER_MIN_POR_BUILD || 8);
    /* Noviembre de 2026 ya llevaba más del 70 % (350 min) cuando se empezó a contar (correo de Render del 15/11). */
    const ANTES = { "202611": 350 };
    const minutos = n * porBuild + (ANTES[mes] ?? 0);
    estado.render = { publicacionesMes: n, minutosEstimados: minutos, tope: 500 };
    notas.push(`Render: ${n} publicaciones este mes, unos ${minutos} de los 500 minutos gratis (con los 350 de antes del 15/11).`);
    if (minutos > 350) avisos.push(`Render lleva unos ${minutos} de 500 minutos de compilación este mes. «Publicar en Render» se para solo en 50 publicaciones; para algo urgente, se lanza a mano en GitHub.`);
  } catch (e) {
    notas.push(`Render: no se han podido contar las publicaciones (${e.message}).`);
  }
}

/* Lo que queda por cerrar a mano: sale en el aviso del administrador hasta que se resuelva. */
const PENDIENTES = [
  {
    id: "besoccer-api",
    titulo: "Alta en la API de BeSoccer",
    texto:
      "El registro no funcionó el 15/11. Hace falta la clave (BESOCCER_API_KEY en .env.local) para traer todo el historial de cada jugador rival: las fichas de la web de BeSoccer están bloqueadas desde el 10/11.",
  },
];

async function guardaEstado() {
  estado.avisos = avisos;
  estado.notas = notas;
  estado.pendientes = PENDIENTES.filter((p) => !(p.id === "besoccer-api" && process.env.BESOCCER_API_KEY));
  if (EN_SECO) return;
  try {
    const { createClient } = require("../lib/datos/cliente.cjs");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await sb
      .from("app_documents")
      .upsert({ key: "salud:plataformas", kind: "salud", data: estado, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) console.log(`No se ha podido guardar el estado para el aviso (${error.message}).`);
  } catch (e) {
    console.log(`No se ha podido guardar el estado para el aviso (${e.message}).`);
  }
}

/* ---------------------------- 3. aviso ---------------------------- */

const SELLO = path.join(RAIZ, ".cache", "copias", "aviso.json");

async function avisa() {
  if (!avisos.length) return;
  let antes = {};
  try {
    antes = JSON.parse(fs.readFileSync(SELLO, "utf8"));
  } catch {}
  if (antes.dia === HOY) {
    notas.push("Aviso ya mandado hoy.");
    return;
  }

  const asunto = avisos.length === 1 ? "Aviso de la plataforma: hay un límite cerca" : `Aviso de la plataforma: ${avisos.length} cosas a mirar`;
  const texto = [...avisos, "Cómo está todo:", ...notas, `Comprobado por el ordenador del club. La app: ${URL_APP}`].join("\n\n");

  if (EN_SECO) {
    console.log(`Para: ${PARA}\nAsunto: ${asunto}\n\n${texto}\n`);
    return;
  }

  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">${texto
    .split("\n\n")
    .map((p) => `<p>${esc(p)}</p>`)
    .join("")}</div>`;
  try {
    const { envia } = require("../lib/correo/gmail.ts");
    await envia({ para: [PARA], asunto, html, texto });
    fs.mkdirSync(path.dirname(SELLO), { recursive: true });
    fs.writeFileSync(SELLO, JSON.stringify({ dia: HOY, avisos }));
    notas.push(`Aviso mandado a ${PARA}.`);
  } catch (e) {
    notas.push(`El correo de aviso no ha salido (${e.message}).`);
  }
}

/* ---------------------------- marcha ---------------------------- */

let codigo = 0;
try {
  const bytes = await copia();
  miraBase(bytes);
} catch (e) {
  codigo = 1;
  avisos.push(`La copia de seguridad de la base ha fallado hoy: ${e.message}.`);
}
await miraB2();
await miraSupabase();
miraRender();
await avisa();
await guardaEstado();

for (const n of notas) console.log(n);
for (const a of avisos) console.log(`AVISO: ${a}`);
console.log(`  RESUMEN: ${avisos.length ? `${avisos.length} aviso(s)` : "todo en orden"}; ${notas[0] ?? ""}`);
salir(codigo || (avisos.length ? 3 : 0));
