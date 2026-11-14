/*
|--------------------------------------------------------------------------
| EL CORTE DE CADA ROBO Y DE CADA PÉRDIDA (04/11/2026)
|--------------------------------------------------------------------------
|
|   node scripts/partido/transiciones-cortes.mjs <slug>… [--carpeta C]
|   node scripts/partido/transiciones-cortes.mjs --todos
|        saca del vídeo de Hudl los cortes que falten (5 s antes y 8 s
|        después del instante) y los sube al bucket:
|          performance/2026/robos/clips/<slug>-<segundo>.mp4
|          performance/2026/perdidas/clips/<slug>-<segundo>.mp4
|   … --ver       sólo cuenta lo que falta y escribe el índice; no corta
|
| Lee las filas que escriben `robos.cjs` y `perdidas.cjs` (su `hudl=` es el
| instante en la retransmisión de Hudl) y deja en
| `ANALISIS TRANSICIONES/<slug>/cortes.json` el enlace al partido en Hudl y
| el de cada corte que está en el bucket: de ahí lo recoge
| `transiciones-datos.mjs` para «Ver el robo» y «Abrir en Hudl · mm:ss».
|
| Es idempotente: lo que ya está en el bucket no se vuelve a cortar ni a
| subir. Corta de uno en uno (poca memoria en el ordenador del club). La
| carpeta del vídeo de Hudl (con `hls.json` y `video-hudl.json`) se busca
| sola: es la que tiene el mismo `timeline-hudl.json` que el partido.
*/

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { entorno, salir } = require("../supabase-local.cjs");
const { createClient } = require("../../lib/datos/cliente.cjs"); /* con reserva: lib/datos/cliente.cjs */
const { AQUI } = require("./transiciones-comun.cjs");
import { subeAlmacen, urlAlmacen, listaAlmacen } from "../almacen.cjs";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CASA = path.dirname(AQUI);
const BUCKET = "performance";
const CARPETAS = { robos: "2026/robos/clips", perdidas: "2026/perdidas/clips" };
const BLOQUES = { robos: "bloques", perdidas: "bloques-perdidas" };
const ANTES = 5;
const DESPUES = 8;
const SOLO_VER = process.argv.includes("--ver");
/* `--max N`: como mucho N cortes por partido (para probar). */
const MAXIMO = process.argv.includes("--max") ? Number(process.argv[process.argv.indexOf("--max") + 1]) : Infinity;

const args = process.argv.slice(2).filter((a, i, todos) => todos[i - 1] !== "--max" && a !== "--max");
const carpetaForzada = args.includes("--carpeta") ? args[args.indexOf("--carpeta") + 1] : null;
const slugs = args.includes("--todos")
  ? fs.readdirSync(AQUI).filter((d) => fs.existsSync(path.join(AQUI, d, "timeline-hudl.json")))
  : args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--carpeta");

if (!slugs.length) {
  console.error("Uso: node scripts/partido/transiciones-cortes.mjs <slug>… | --todos [--ver] [--carpeta C]");
  process.exit(2);
}

const huella = (f) => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");

/* La carpeta con el vídeo de Hudl del partido: la que tiene su mismo timeline. */
function carpetaHudl(slug) {
  if (carpetaForzada) return carpetaForzada;

  const propia = huella(path.join(AQUI, slug, "timeline-hudl.json"));
  const raices = [path.join(CASA, "PARTIDOS", "ANALISIS"), path.join(CASA, "HUDL ALCORCON")].filter((r) => fs.existsSync(r));

  for (const raiz of raices) {
    for (const d of [raiz, ...fs.readdirSync(raiz).map((x) => path.join(raiz, x))]) {
      const t = path.join(d, "timeline-hudl.json");

      if (fs.existsSync(t) && fs.existsSync(path.join(d, "video-hudl.json")) && huella(t) === propia) return d;
    }
  }

  return null;
}

/* Las acciones con su instante de Hudl, de los bloques que escriben robos.cjs y perdidas.cjs. */
function acciones(slug, area) {
  const dir = path.join(AQUI, slug, BLOQUES[area]);

  if (!fs.existsSync(dir)) return [];

  const salida = [];

  for (const f of fs.readdirSync(dir).filter((x) => /^b\d+\.csv$/.test(x)).sort()) {
    for (const linea of fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/)) {
      const m = linea.match(/;hudl=([\d.]+)\s*$/);

      if (m) salida.push({ seg: Number(m[1]), nombre: `${slug}-${Math.round(Number(m[1]))}.mp4` });
    }
  }

  return salida;
}

async function listaBucket(supabase, carpeta) {
  /* Supabase y Backblaze (los vídeos van allí desde el 11/11/2026). */
  try {
    return new Set((await listaAlmacen(supabase, carpeta)).map((f) => f.name));
  } catch (error) {
    throw new Error(`no se lee el bucket (${error.message})`);
  }
}

async function principal() {
  const env = entorno();

  if (!env) {
    console.error("Faltan las llaves de Supabase en .env.local");
    return salir(1);
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const url = (area, nombre) => urlAlmacen(supabase, `${CARPETAS[area]}/${nombre}`);
  const enBucket = { robos: await listaBucket(supabase, CARPETAS.robos), perdidas: await listaBucket(supabase, CARPETAS.perdidas) };

  let nav = null;
  let sinChrome = false;
  let hechos = 0;
  let rotos = 0;

  try {
    for (const slug of slugs) {
      const carpeta = carpetaHudl(slug);

      if (!carpeta) {
        console.log(`${slug}: no hay carpeta con el vídeo de Hudl de este partido (hls.json + video-hudl.json); sin cortes ni enlace.`);
        continue;
      }

      const video = JSON.parse(fs.readFileSync(path.join(carpeta, "video-hudl.json"), "utf8"));
      const indice = { hudl: video.url ?? "", carpeta: path.basename(carpeta), antes: ANTES, despues: DESPUES, robos: {}, perdidas: {} };
      const faltan = [];

      for (const area of ["robos", "perdidas"]) {
        for (const a of acciones(slug, area)) {
          if (enBucket[area].has(a.nombre)) indice[area][String(Math.round(a.seg))] = url(area, a.nombre);
          else faltan.push({ ...a, area });
        }
      }

      console.log(`${slug}: ${Object.keys(indice.robos).length + Object.keys(indice.perdidas).length} cortes en el bucket, faltan ${faltan.length} (${path.basename(carpeta)})`);

      if (faltan.length && !SOLO_VER && !sinChrome && fs.existsSync(path.join(carpeta, "hls.json"))) {
        if (!nav) {
          const { abreHudl } = await import("../hudl-chrome.mjs");

          /* Sin Chrome no hay cortes, pero el índice (enlace a Hudl y cortes ya subidos) se escribe igual. */
          nav = await abreHudl().catch((error) => {
            sinChrome = true;
            console.log(`  no se abre el Chrome del club (${error?.message ?? error}): sin cortes nuevos en esta pasada`);
            return null;
          });
        }
      }

      if (faltan.length && nav && !SOLO_VER) {
        const { preparaCortesLigeros } = await import("../hudl-corte.mjs");
        let corta = null;

        try {
          ({ corta } = await preparaCortesLigeros(nav, carpeta));
        } catch (error) {
          console.log(`  no se puede abrir el vídeo (${error?.message ?? error})`);
        }

        for (const [n, a] of faltan.entries()) {
          if (!corta || n >= MAXIMO) break;

          const fichero = path.join(RAIZ, ".cache", "transiciones", "cortes", a.area, a.nombre);
          const bien = await corta(Math.max(0, a.seg - ANTES), ANTES + DESPUES, fichero).catch(() => false);

          if (!bien) {
            rotos += 1;
            console.log(`  ${a.area}/${a.nombre}: ROTO`);
            continue;
          }

          const { error } = await subeAlmacen(supabase, `${CARPETAS[a.area]}/${a.nombre}`, fichero, { contentType: "video/mp4", upsert: true });

          if (error) {
            rotos += 1;
            console.log(`  ${a.area}/${a.nombre}: no se sube (${error.message})`);
            continue;
          }

          indice[a.area][String(Math.round(a.seg))] = url(a.area, a.nombre);
          hechos += 1;

          if ((n + 1) % 20 === 0) {
            console.log(`  ${n + 1}/${faltan.length}`);
            /* El índice se va guardando: si se corta a medias, lo subido ya cuenta. */
            fs.writeFileSync(path.join(AQUI, slug, "cortes.json"), JSON.stringify(indice, null, 1), "utf8");
          }
        }
      }

      fs.writeFileSync(path.join(AQUI, slug, "cortes.json"), JSON.stringify(indice, null, 1), "utf8");
    }
  } finally {
    if (nav) await nav.cierra();
  }

  console.log(`RESUMEN: ${hechos} cortes subidos${rotos ? `, ${rotos} sin poder sacar` : ""}`);
  salir(0);
}

principal().catch((error) => {
  console.error(error?.stack ?? error);
  salir(1);
});
