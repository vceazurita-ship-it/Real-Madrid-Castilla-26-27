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
|    otra en Backblaze B2, `copias/datos-AAAA-MM-DD.json.gz` (bucket privado;
|    allí se quedan los últimos 14 días y la del día 1 de cada mes, 22/11/2026).
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

/*
| ROTACIÓN DE LAS COPIAS EN B2 (22/11/2026, OK del analista): se guardaban
| todas para siempre (~9 MB/día, ~1,5 GB en la temporada). Se quedan las de
| los últimos DIAS_B2 días y la del día 1 de cada mes; el resto se oculta y la
| regla del bucket (daysFromHidingToDeleting: 1) la borra al día siguiente.
| Por seguridad nunca se quedan menos de DIAS_B2 copias, aunque falten días.
*/
const DIAS_B2 = 14;

export function copiasQueSobran(nombres, hoy) {
  const limite = new Date(`${hoy}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - (DIAS_B2 - 1));
  const desde = limite.toISOString().slice(0, 10);
  const copias = nombres.map((n) => [n, n.match(/^copias\/datos-(\d{4}-\d{2}-\d{2})\.json\.gz$/)?.[1]]).filter(([, d]) => d).sort((a, b) => b[1].localeCompare(a[1]));
  const masNuevas = new Set(copias.slice(0, DIAS_B2).map(([n]) => n));
  return copias.filter(([n, d]) => d < desde && !d.endsWith("-01") && !masNuevas.has(n)).map(([n]) => n);
}

async function rotaCopiasB2(b2, enSeco) {
  const nombres = [...(await b2.lista("copias/")).keys()];
  const sobran = copiasQueSobran(nombres, HOY);
  if (!sobran.length) return notas.push(`Copias en Backblaze: ${nombres.length}, ninguna para borrar.`);
  if (enSeco) return notas.push(`(en seco) en Backblaze se borrarían ${sobran.length} copias viejas: ${sobran.map((n) => n.slice(13, 23)).join(", ")}.`);
  for (const n of sobran) await b2.oculta(n);
  notas.push(`Copias en Backblaze: ${sobran.length} viejas borradas, quedan ${nombres.length - sobran.length}.`);
}
const mb = (b) => `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB`;

/* ---------------------------- 1. la copia ---------------------------- */

async function copia() {
  const url = process.env.DATOS_PG_URL;
  /*
  | 21/11/2026: de vuelta en Supabase. Sin DATOS_PG_URL la copia se saltaba;
  | ahora se leen las tablas por REST con la clave de servicio (sin contraseña
  | de la base), de 100 en 100. El tamaño de la base no se puede pedir por
  | REST: se queda sin medir (null) y no se pinta esa barra.
  */
  const sql = url
    ? (await import("postgres")).default(url, { ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", max: 1, prepare: false, onnotice: () => {} })
    : null;
  const leeRest = async (t) => {
    const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!U || !K) throw new Error("faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
    const filas = [];
    for (let desde = 0; ; desde += 100) {
      const r = await fetch(`${U}/rest/v1/${t}?select=*&order=updated_at.asc`, { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: `${desde}-${desde + 99}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      filas.push(...j);
      if (j.length < 100) return filas;
    }
  };

  /*
  | 25/11/2026 — Supabase cortó por bajada de datos: bajar la base entera cada
  | día eran ~85 MB diarios. Ahora app_documents se lee POR PARTES: primero
  | sólo `key, updated_at` (unos 35 KB), y se bajan nada más que los documentos
  | nuevos o cambiados desde la copia anterior; el resto sale de esa copia.
  | Los días 1 y 15 (o sin copia anterior, o si algo falla) se baja entera,
  | por si alguna escritura no hubiera movido `updated_at`.
  */
  const leeSellos = async () => {
    if (sql) return [...(await sql`select key, updated_at from app_documents`)];
    const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const filas = [];
    for (let desde = 0; ; desde += 1000) {
      const r = await fetch(`${U}/rest/v1/app_documents?select=key,updated_at&order=key.asc`, { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: `${desde}-${desde + 999}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      filas.push(...j);
      if (j.length < 1000) return filas;
    }
  };
  const leeClaves = async (claves) => {
    if (sql) return [...(await sql`select * from app_documents where key = any(${claves})`)];
    const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const filas = [];
    for (let i = 0; i < claves.length; i += 20) {
      const lista = claves.slice(i, i + 20).map((k) => `"${k.replace(/"/g, '\\"')}"`).join(",");
      const r = await fetch(`${U}/rest/v1/app_documents?select=*&key=in.(${encodeURIComponent(lista)})`, { headers: { apikey: K, Authorization: `Bearer ${K}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      filas.push(...(await r.json()));
    }
    return filas;
  };
  const anterior = () => {
    const ultima = fs.existsSync(CARPETA)
      ? fs.readdirSync(CARPETA).filter((n) => /^datos-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n) && n < `datos-${HOY}`).sort().pop()
      : null;
    if (!ultima) return null;
    const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(CARPETA, ultima))).toString("utf8"));
    return Array.isArray(j.app_documents) && j.app_documents.length ? j.app_documents : null;
  };
  const documentosPorPartes = async () => {
    if (/-(01|15)$/.test(HOY)) return null;
    const viejos = anterior();
    if (!viejos) return null;
    const sellos = await leeSellos();
    const deAntes = new Map(viejos.map((f) => [f.key, f]));
    const iguales = (a, b) => a && b && new Date(a).getTime() === new Date(b).getTime();
    const cambiados = sellos.filter((s) => !iguales(deAntes.get(s.key)?.updated_at, s.updated_at)).map((s) => s.key);
    const nuevos = new Map((cambiados.length ? await leeClaves(cambiados) : []).map((f) => [f.key, f]));
    if (nuevos.size !== cambiados.length) throw new Error(`pedidos ${cambiados.length}, llegados ${nuevos.size}`);
    notas.push(`Copia por partes: ${cambiados.length} documentos bajados de ${sellos.length}.`);
    return sellos.map((s) => nuevos.get(s.key) ?? deAntes.get(s.key));
  };

  try {
    const salida = { hechaEn: new Date().toISOString(), origen: sql ? "reserva" : "supabase" };
    for (const t of TABLAS) {
      try {
        if (t === "app_documents") {
          const porPartes = await documentosPorPartes().catch((e) => {
            notas.push(`Copia por partes no ha salido (${e.message}); se baja entera.`);
            return null;
          });
          if (porPartes) {
            salida[t] = porPartes;
            continue;
          }
        }
        salida[t] = sql ? [...(await sql.unsafe(`select * from ${t}`))] : await leeRest(t);
      } catch (e) {
        salida[t] = [];
        notas.push(`Copia: ${t} no se ha podido leer (${e.message}).`);
      }
    }
    if (!salida.app_documents.length) {
      avisos.push("La copia de hoy ha salido vacía (app_documents sin filas): no se guarda para no tapar las buenas.");
      return null;
    }
    const bytes = sql ? (await sql`select pg_database_size(current_database())::bigint as bytes`)[0].bytes : null;
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(salida)));

    fs.mkdirSync(CARPETA, { recursive: true });
    const fichero = path.join(CARPETA, `datos-${HOY}.json.gz`);
    fs.writeFileSync(fichero, gz);
    const viejas = fs.readdirSync(CARPETA).filter((f) => /^datos-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).sort();
    for (const f of viejas.slice(0, Math.max(0, viejas.length - GUARDAR))) fs.unlinkSync(path.join(CARPETA, f));

    const filas = TABLAS.map((t) => `${t} ${salida[t].length}`).join(", ");
    estado.copia = { dia: HOY, bytes: gz.length };
    notas.push(`Copia de hoy: ${filas} (${mb(gz.length)} comprimida), en .cache/copias.`);

    if (EN_SECO) {
      try {
        const b2 = require("./b2.cjs");
        if (b2.configurado()) await rotaCopiasB2(b2, true);
      } catch (e) {
        notas.push(`(en seco) no se ha podido mirar la rotación de B2: ${e.message}`);
      }
    } else {
      try {
        const b2 = require("./b2.cjs");
        if (b2.configurado()) {
          await b2.sube(`copias/datos-${HOY}.json.gz`, gz, "application/gzip");
          notas.push("Copia subida a Backblaze B2 (copias/).");
          /* Sólo después de subir la de hoy: si la subida falla, no se borra nada. */
          await rotaCopiasB2(b2, false).catch((e) => avisos.push(`No se han podido rotar las copias de Backblaze (${e.message}); no pasa nada, se reintenta mañana.`));
        } else {
          avisos.push("La copia de la base sólo está en este ordenador: falta configurar Backblaze B2 en .env.local.");
        }
      } catch (e) {
        avisos.push(`La copia no se ha podido subir a Backblaze (${e.message}); la de este ordenador sí está.`);
      }
    }

    return bytes == null ? null : Number(bytes);
  } finally {
    if (sql) await sql.end({ timeout: 5 });
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
    else if (r.ok) notas.push(process.env.DATOS_PG_URL ? "Supabase ha vuelto: se puede pensar en volver (ver la nota del plan B), pero la reserva sigue mandando mientras DATOS_PG_URL esté puesta." : "Supabase: la app vive en él (desde el 21/11/2026).");
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

/*
| Los ficheros que se quedaron en Supabase (16/11/2026): 252 sin copia en otro
| sitio. En cuanto Supabase vuelve, scripts/supabase-rescate.mjs los baja, los
| sube a B2 y cambia los enlaces; mientras falte algo, se avisa.
*/
async function rescataSupabase() {
  if (estado.supabase !== "vuelto" || EN_SECO) return;

  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [path.join(RAIZ, "scripts", "supabase-rescate.mjs")], { encoding: "utf8", timeout: 50 * 60_000 });
  const resumen = (String(r.stdout).match(/RESUMEN: (.*)/) ?? [])[1] ?? `sin resumen (código ${r.status})`;

  if (r.status === 0) notas.push(`Rescate de ficheros de Supabase: ${resumen}.`);
  else avisos.push(`Supabase ha vuelto y el rescate de sus ficheros no ha terminado: ${resumen}. Se reintenta mañana solo.`);
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
await rescataSupabase();
miraRender();
await avisa();
await guardaEstado();

for (const n of notas) console.log(n);
for (const a of avisos) console.log(`AVISO: ${a}`);
/* 21/11/2026: el aviso va en el RESUMEN (lo único que guarda el registro del vigía), no sólo cuántos. */
console.log(`  RESUMEN: ${avisos.length ? `${avisos.length} aviso(s): ${avisos[0].slice(0, 160)}` : "todo en orden"}; ${notas[0] ?? ""}`);
salir(codigo || (avisos.length ? 3 : 0));
