/**
 * LOS CLIPS DE HUDL DE CADA JUGADOR RIVAL, A B2 (17/11/2026).
 *
 *   node scripts/hudl-clips-rival.mjs              lo que falte, por prioridad
 *   node scripts/hudl-clips-rival.mjs --max 40     como mucho 40 clips en esta pasada
 *   node scripts/hudl-clips-rival.mjs --lista YOLDI   sólo las listas cuyo título lleve eso
 *   node scripts/hudl-clips-rival.mjs --seco       baja y sube, pero no escribe el documento (lo enseña)
 *
 * El analista exporta de Wyscout los cortes de un jugador rival y los lleva a
 * Hudl; allí quedan como una LISTA (PlaylistItem) titulada «RIVAL - Nº»,
 * «RIVAL - NOMBRE» o «RIVAL - Nº NOMBRE» («UD IBIZA - YOLDI»). Aquí:
 *
 * 1. Se abre Hudl con el Chrome del club (`abreHudl`: perfil del Wyscout,
 *    puerto 9333, por turnos con Wyscout; sin contraseña).
 * 2. Se pide la biblioteca entera del equipo (`Web_PerformanceCore_GetLibraryItems_r1`)
 *    con la MISMA consulta y cabeceras que usa la página (se capturan al
 *    cargarla), y se quedan las listas con ese título (`leeTituloLista`).
 * 3. De cada lista, su página `watch/playlist/<id>` trae en
 *    `window.__hudlEmbed.data.playlistResult` los clips con su `playbackUri`
 *    (HLS con `#startOffsetMs=…&durationMs=…`). Se baja la variante de 720p
 *    trozo a trozo con las cookies de la sesión (ffmpeg contra el m3u8 da 403),
 *    ffmpeg recorta y recodifica (~2-4 MB por clip de 11 s) y se sube a B2:
 *    `hudl/clips/<lista>/<clip>.mp4` (ids internos de Hudl: estables).
 * 4. Documento `hudl:clips-rival` (lib/hudl-clips.ts).
 *
 * Incremental: una lista con el mismo `updatedAt` y todos sus clips bajados no
 * se vuelve a abrir; si cambia, se baja sólo lo nuevo. Orden: el próximo rival
 * primero (castilla:calendario, scripts/goles-prioridad.cjs), luego el resto.
 *
 * Termina con «RESUMEN: …». Códigos: 0 bien · 8 el Chrome del club está
 * ocupado o Hudl no tiene la sesión (se sigue en la próxima pasada) · 1 fallo.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";

import { abreHudl, cabecerasPara, espera } from "./hudl-chrome.mjs";
import { FFMPEG, corteValido } from "./hudl-corte.mjs";

const require = createRequire(import.meta.url);
const { entorno } = require("./supabase-local.cjs");

for (const [k, v] of Object.entries(entorno() ?? {})) if (!process.env[k]) process.env[k] = v;

require("./cargador-ts.cjs");

const b2 = require("./b2.cjs");
const { prioridades } = require("./goles-prioridad.cjs");
const { CLAVE_HUDL_CLIPS, leeTituloLista, normalizaDocHudl } = require("../lib/hudl-clips.ts");

const ejecuta = promisify(execFile);

const EQUIPO = "363689";
const HUDL = "https://www.hudl.com";

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};
const MAX = Number(arg("max") ?? 300);
const SOLO = arg("lista");
const SECO = process.argv.includes("--seco");

async function fin(codigo, texto) {
  console.log(`RESUMEN: ${texto}`);
  process.exitCode = codigo;
  setTimeout(() => process.exit(codigo), 300);
  await new Promise(() => {});
}

if (!SECO && !process.env.DATOS_PG_URL) await fin(1, "falta DATOS_PG_URL");
if (!b2.configurado()) await fin(1, "falta la llave de B2");

/* ---------- datos ---------- */

const postgres = require("postgres");
const sql = process.env.DATOS_PG_URL
  ? postgres(process.env.DATOS_PG_URL, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATOS_PG_URL) ? false : "require", prepare: false, onnotice: () => {}, idle_timeout: 20, connect_timeout: 30 })
  : null;

async function conReintento(fn) {
  for (let n = 1; ; n++) {
    try {
      return await fn();
    } catch (e) {
      if (n >= 3) throw e;
      console.log(`  (base: ${e.code ?? e.message}; reintento ${n})`);
      await espera(5000 * n);
    }
  }
}

const docs = sql
  ? Object.fromEntries((await conReintento(() => sql`select key, data from app_documents where key in (${CLAVE_HUDL_CLIPS}, 'castilla:calendario')`)).map((f) => [f.key, f.data]))
  : {};
const doc = normalizaDocHudl(docs[CLAVE_HUDL_CLIPS]);
const { deEquipo, proximos } = prioridades(docs["castilla:calendario"]?.partidos);

const guarda = async () => {
  doc.actualizado = new Date().toISOString();

  if (SECO || !sql) return;

  /* Dos pasadas a la vez (la de la noche y un «Pedir a Hudl», 17/11/2026) se
     pisaban el documento: antes de escribir se suman los clips que otra haya
     guardado mientras tanto, por id de clip, en las listas que siguen vivas. */
  const [fila] = await conReintento(() => sql`select data from app_documents where key = ${CLAVE_HUDL_CLIPS}`);
  const otro = normalizaDocHudl(fila?.data);

  for (const [id, suya] of Object.entries(otro.listas)) {
    const mia = doc.listas[id];

    if (!mia) continue;
    const tengo = new Set(mia.clips.map((c) => c.id));

    for (const c of suya.clips) if (!tengo.has(c.id)) mia.clips.push(c);
  }

  await conReintento(() => sql`insert into app_documents (key, kind, data, updated_at) values (${CLAVE_HUDL_CLIPS}, ${"hudl"}, ${sql.json(doc)}, date_trunc('milliseconds', now()))
            on conflict (key) do update set data = excluded.data, updated_at = excluded.updated_at`);
};

/* El id interno de Hudl va dentro del id en base64: «PlaylistClip6ac4…» → «6ac4…». */
const interno = (id) => {
  try {
    return Buffer.from(String(id), "base64").toString("utf8").replace(/^[A-Za-z]+/, "") || String(id).replace(/\W/g, "");
  } catch {
    return String(id).replace(/\W/g, "");
  }
};

/* ---------- Hudl ---------- */

console.log("PASO: 1/4 · Abrir Hudl");

let nav;

try {
  nav = await abreHudl();
} catch (error) {
  await fin(8, `el Chrome del club no está libre (${error.message}); se sigue en la próxima pasada`);
}

const js = async (expresion) => {
  const r = await nav.manda("Runtime.evaluate", { expression: expresion, awaitPromise: true, returnByValue: true }, 120_000);

  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split("\n")[0] ?? "fallo en la página");

  return r.result?.value;
};

/** Texto de una URL de hudl.com pedida desde la propia página (con su sesión). */
const textoDesdePagina = (url) =>
  js(`fetch(${JSON.stringify(url)},{credentials:"include"}).then(async r=>({s:r.status,t:await r.text()})).catch(e=>({s:0,t:String(e)}))`);

/** El objeto JSON que empieza en `desde` (llaves equilibradas, respetando cadenas). */
function objetoEn(texto, desde) {
  let nivel = 0;
  let cadena = false;

  for (let i = desde; i < texto.length; i++) {
    const c = texto[i];

    if (cadena) {
      if (c === "\\") i++;
      else if (c === '"') cadena = false;
    } else if (c === '"') cadena = true;
    else if (c === "{") nivel++;
    else if (c === "}" && --nivel === 0) return texto.slice(desde, i + 1);
  }

  return null;
}

let codigoFinal = 0;
let textoFinal = "";
let hechos = 0;
let fallos = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hudl-clips-"));

try {
  /* La consulta y las cabeceras de la biblioteca, tal cual las manda la página. */
  let peticion = null;

  nav.al("Network.requestWillBeSent", (p) => {
    if (!peticion && /graphql/.test(p.request.url) && /GetLibraryItems/.test(p.request.postData ?? "")) peticion = p.request;
  });

  await nav.manda("Page.navigate", { url: `${HUDL}/library/${EQUIPO}` });

  for (let i = 0; i < 40 && !peticion; i++) await espera(1000);

  if (!peticion) {
    const donde = await js("location.href").catch(() => "");

    codigoFinal = 8;
    textoFinal = /login|sign/i.test(String(donde))
      ? "Hudl ha perdido la sesión en el Chrome del club: entra una vez en hudl.com con el perfil del Wyscout"
      : "la biblioteca de Hudl no ha cargado; se sigue en la próxima pasada";
    throw new Error("sin biblioteca");
  }

  console.log("PASO: 2/4 · Biblioteca de Hudl");

  const original = JSON.parse(peticion.postData);
  const cabeceras = Object.fromEntries(Object.entries(peticion.headers).filter(([k]) => !/^(content-length|cookie|host)$/i.test(k)));
  const items = [];
  let after = null;

  for (let pagina = 0; pagina < 80; pagina++) {
    const cuerpo = JSON.stringify({
      ...original,
      variables: {
        ...original.variables,
        teamId: EQUIPO,
        first: 100,
        includeActive: true,
        includeDeleted: false,
        includeItemsNotAttachedToEvents: true,
        sorts: [{ sortType: "createdAt", sortOrder: "descending" }],
        query: [],
        after,
      },
    });
    const r = await js(`fetch(${JSON.stringify(peticion.url)},{method:"POST",credentials:"include",headers:${JSON.stringify(cabeceras)},body:${JSON.stringify(cuerpo)}}).then(r=>r.text())`);
    const lib = JSON.parse(r ?? "{}")?.data?.library;

    if (!lib) throw new Error(`la biblioteca no contesta como se esperaba: ${String(r).slice(0, 160)}`);

    for (const e of lib.edges ?? []) items.push(e.node);

    if (!lib.pageInfo?.hasNextPage) break;

    after = lib.pageInfo.endCursor;
  }

  const listas = items
    .filter((x) => x?.__typename === "PlaylistItem" && !x.deletedAt)
    .map((x) => ({ x, partes: leeTituloLista(x.title) }))
    .filter(({ partes }) => partes)
    .filter(({ x }) => !SOLO || String(x.title).toLowerCase().includes(SOLO.toLowerCase()))
    .map(({ x, partes }) => ({ id: x.id, titulo: String(x.title).trim(), ...partes, actualizada: x.updatedAt, enHudl: Number(x.clipCount) || 0, prioridad: deEquipo(partes.rival) }))
    .sort((a, b) => a.prioridad - b.prioridad || String(b.actualizada).localeCompare(String(a.actualizada)));

  console.log(`${items.length} elementos en la biblioteca; ${listas.length} listas de jugador rival. Próximos rivales: ${proximos.join(", ") || "—"}.`);

  /* El catálogo entero primero: la app sabe qué hay en Hudl aunque aún no esté bajado. */
  for (const l of listas) {
    const ya = doc.listas[l.id];

    doc.listas[l.id] = { ...(ya ?? { clips: [] }), titulo: l.titulo, rival: l.rival, dorsal: l.dorsal, nombre: l.nombre, enHudl: l.enHudl, actualizada: ya?.actualizada };
  }

  if (!SOLO) {
    const vivas = new Set(listas.map((l) => l.id));

    for (const id of Object.keys(doc.listas)) if (!vivas.has(id)) delete doc.listas[id];
  }

  await guarda();

  const pendientes = listas.filter((l) => {
    const ya = doc.listas[l.id];

    return ya.actualizada !== l.actualizada || ya.clips.length < l.enHudl;
  });
  const totalClips = pendientes.reduce((s, l) => s + Math.max(0, l.enHudl - doc.listas[l.id].clips.length), 0);

  console.log(`PASO: 3/4 · Clips (${pendientes.length} listas por mirar, unos ${totalClips} clips)`);

  let cuenta = 0;

  for (const l of pendientes) {
    if (hechos >= MAX) break;

    const entrada = doc.listas[l.id];
    const pagina = await textoDesdePagina(`${HUDL}/watch/playlist/${encodeURIComponent(l.id)}`);
    const i = pagina?.t?.indexOf("window.__hudlEmbed=") ?? -1;
    const embed = i >= 0 ? objetoEn(pagina.t, i + "window.__hudlEmbed=".length) : null;
    let clips = null;

    try {
      const datos = JSON.parse(embed).data;
      const pr = typeof datos.playlistResult === "string" ? JSON.parse(datos.playlistResult) : datos.playlistResult;

      clips = pr?.data?.playlist?.clips?.items ?? null;
    } catch {
      clips = null;
    }

    if (!Array.isArray(clips)) {
      fallos++;
      console.log(`  ${l.titulo}: no se leen sus clips (HTTP ${pagina?.s ?? "?"})`);
      continue;
    }

    const hechosAntes = new Map(entrada.clips.map((c) => [c.id, c]));
    const nuevos = [];

    for (const [n, c] of clips.entries()) {
      const previo = hechosAntes.get(c.id);

      if (previo) {
        nuevos.push({ ...previo, titulo: String(c.title ?? previo.titulo), descripcion: c.description ?? previo.descripcion });
        continue;
      }

      if (hechos >= MAX) continue;

      cuenta++;
      const uri = String(c.playbackUri ?? c.streams?.[0]?.playbackUri ?? "");
      const [ruta, fragmento = ""] = uri.split("#");
      const opciones = new URLSearchParams(fragmento);
      const desde = Number(opciones.get("startOffsetMs") ?? 0) / 1000;
      const dura = Number(opciones.get("durationMs") ?? (Number(c.endTimeMs) - Number(c.startTimeMs))) / 1000;
      const rotulo = `[${cuenta}/${totalClips}] ${l.titulo} · ${String(n + 1).padStart(2, "0")} ${c.title ?? ""}`;

      try {
        if (!ruta || !(dura > 0)) throw new Error("sin vídeo");

        const fichero = path.join(tmp, `${interno(c.id)}.mp4`);

        await bajaClip(`${HUDL}${ruta}`, desde, dura, fichero);

        const datos = fs.readFileSync(fichero);
        const url = await b2.sube(`hudl/clips/${interno(l.id)}/${interno(c.id)}.mp4`, datos, "video/mp4");

        fs.rmSync(fichero, { force: true });
        nuevos.push({ id: c.id, titulo: String(c.title ?? "").trim(), ...(c.description ? { descripcion: String(c.description).trim() } : {}), url, bytes: datos.length, segundos: Math.round(dura) });
        hechos++;
        console.log(`  ${rotulo} (${(datos.length / 1e6).toFixed(1)} MB)`);
      } catch (error) {
        fallos++;
        console.log(`  ${rotulo}: FALLO ${String(error.message).split("\n")[0].slice(0, 140)}`);
      }
    }

    entrada.clips = nuevos;
    entrada.enHudl = clips.length;

    /* Sólo se da por mirada si está entera: si no, la próxima pasada vuelve. */
    if (nuevos.length >= clips.length) entrada.actualizada = l.actualizada;

    entrada.bajadaEn = new Date().toISOString();
    await guarda();
  }

  console.log("PASO: 4/4 · Guardar");
  await guarda();

  const todas = Object.values(doc.listas);
  const bajados = todas.reduce((s, x) => s + x.clips.length, 0);
  const enHudl = todas.reduce((s, x) => s + x.enHudl, 0);

  textoFinal = `${hechos} clips nuevos de Hudl${fallos ? ` (${fallos} fallos)` : ""}; ${todas.length} listas de jugador rival, ${bajados} de ${enHudl} clips en la app${SECO ? " (en seco: documento sin escribir)" : ""}`;

  if (SECO) console.log(JSON.stringify(doc, null, 1).slice(0, 4000));
} catch (error) {
  if (!codigoFinal) {
    codigoFinal = 1;
    textoFinal = `ha fallado: ${error.message}`;
  }
} finally {
  await nav.cierra().catch(() => {});
  fs.rmSync(tmp, { recursive: true, force: true });
  await sql?.end().catch(() => {});
}

await fin(codigoFinal, textoFinal);

/* ---------- un clip ---------- */

/**
 * Baja un clip de Hudl a mp4 de 720p.
 *
 * El m3u8 maestro (www.hudl.com, con la cookie de sesión) tiene variantes de
 * 540, 720 y 1080; la de 720 trae trozos de 4 s en veuw1p.hudl.com firmados
 * con cookies de CloudFront. Se bajan con esas cookies (en memoria) o, si no
 * abren, desde la página; se pegan detrás del `init` y ffmpeg recorta
 * [desde, desde + dura] y recodifica.
 */
async function bajaClip(maestro, desde, dura, fichero) {
  const m = await textoDesdePagina(maestro);

  if (m?.s !== 200 || !/#EXTM3U/.test(m.t)) throw new Error(`lista maestra HTTP ${m?.s}`);

  const lineas = m.t.split(/\r?\n/);
  const variantes = [];

  lineas.forEach((linea, i) => {
    const alto = Number(linea.match(/^#EXT-X-STREAM-INF:.*RESOLUTION=\d+x(\d+)/)?.[1] ?? 0);

    if (alto && lineas[i + 1] && !lineas[i + 1].startsWith("#")) variantes.push({ alto, url: new URL(lineas[i + 1].trim(), maestro).href });
  });

  /* 720 si la hay; si no, la más alta que no pase de 720; si no, la que haya. */
  const elegida =
    variantes.find((v) => v.alto === 720) ??
    variantes.filter((v) => v.alto < 720).sort((a, b) => b.alto - a.alto)[0] ??
    variantes.sort((a, b) => a.alto - b.alto)[0];
  const lista = elegida ? await textoDesdePagina(elegida.url) : m;

  if (lista?.s !== 200) throw new Error(`lista de trozos HTTP ${lista?.s}`);

  const base = elegida?.url ?? maestro;
  const init = lista.t.match(/#EXT-X-MAP:URI="([^"]+)"/)?.[1];
  const trozos = lista.t
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => new URL(l.trim(), base).href);

  if (!trozos.length) throw new Error("la lista no trae trozos");

  let cab = await cabecerasPara(nav, trozos[0]);
  const baja = async (url) => {
    for (let i = 0; i < 4; i++) {
      const r = await fetch(url, { headers: cab }).catch(() => null);

      if (r?.ok) return Buffer.from(await r.arrayBuffer());

      if (r && (r.status === 401 || r.status === 403)) {
        /* Sin las cookies de CloudFront, desde la propia página. */
        const b64 = await js(
          `fetch(${JSON.stringify(url)},{credentials:"include"}).then(async r=>{if(!r.ok)return null;const b=new Uint8Array(await r.arrayBuffer());let s="";for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return btoa(s)}).catch(()=>null)`,
        ).catch(() => null);

        if (b64) return Buffer.from(b64, "base64");

        cab = await cabecerasPara(nav, url).catch(() => cab);
      }

      await espera(800);
    }

    throw new Error(`no baja un trozo (${url.split("?")[0].split("/").pop()})`);
  };

  const partes = [];

  if (init) partes.push(await baja(new URL(init, base).href));
  for (const t of trozos) partes.push(await baja(t));

  const crudo = `${fichero}.crudo.mp4`;

  fs.writeFileSync(crudo, Buffer.concat(partes));

  try {
    await ejecuta(FFMPEG, [
      "-y", "-loglevel", "error",
      "-ss", String(Math.max(0, desde)),
      "-i", crudo,
      "-t", String(dura),
      "-vf", "scale=-2:'min(720,ih)'",
      "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", /* 22/11/2026: slow + CRF 2 = misma imagen, menos peso */
      "-c:a", "aac", "-b:a", "96k", "-ac", "2",
      "-movflags", "+faststart",
      fichero,
    ], { windowsHide: true, timeout: 180_000 });
  } finally {
    fs.rmSync(crudo, { force: true });
  }

  if (!(await corteValido(fichero, dura))) throw new Error("el corte no ha salido bien");
}
