/**
 * EL ANÁLISIS DE UN ENTRENAMIENTO POR OBJETIVOS (16/10/2026, en obras).
 *
 *   node scripts/entreno/analiza-entreno.mjs --fecha 2026-10-16
 *   node scripts/entreno/analiza-entreno.mjs --fecha 2026-10-16 --ver   → sólo dice qué vídeo usaría
 *
 * Lo pide la pantalla «Análisis de entrenamiento» (encargo `entreno` del
 * vigía). Lee los objetivos de `entreno:<fecha>`, busca el vídeo del día
 * —primero la cámara táctica en SESIONES, si no Hudl—, se lo enseña a Gemini
 * por partes de 20 minutos con los objetivos, corta clips de ejemplo
 * (correctos y mejorables) y deja todo en `entreno-analisis:<fecha>`.
 * El modelo de datos y lo que hace la pantalla, en lib/entreno/modelo.ts.
 *
 * Termina con «RESUMEN: …». Códigos: 0 hecho, 2 sin objetivos, 3 no hay vídeo
 * del día, 4 sin clave de Gemini, 5 la sesión de Hudl no entra, 1 otro fallo.
 */

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { abreHudl, cabecerasPara, espera } from "../hudl-chrome.mjs";

const require = createRequire(import.meta.url);
const { entorno } = require("../supabase-local.cjs");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenAI, MediaResolution, createPartFromUri } = require("@google/genai");

const ejecuta = promisify(execFile);
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FFMPEG = path.join(REPO, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const SESIONES = path.join(REPO, "..", "..", "SESIONES");
const CACHE = path.join(REPO, ".cache", "entrenos");
const BUCKET = "performance";
const EQUIPO_HUDL = "363689";

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};

const FECHA = arg("fecha");
const SOLO_VER = process.argv.includes("--ver");
const PARTE_S = 20 * 60;
const CLIPS_POR_VEREDICTO = 4;
/* Cada modelo con su propia cuota gratuita; `gemini-2.5-flash-lite` ya no se da a cuentas nuevas (404, 17/10/2026). */
const MODELOS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

function fin(codigo, texto) {
  console.log(`RESUMEN: ${texto}`);
  process.exitCode = codigo;
}

const paso = (n, texto) => console.log(`PASO: ${n}/5 · ${texto}`);

/* ------------------------------------------------------------------ */
/*  LA FECHA, ESCRITA COMO LA ESCRIBA CADA UNO                         */
/* ------------------------------------------------------------------ */

/** Todas las formas en que puede aparecer la fecha en un nombre de fichero o un título de Hudl. */
function formasDeFecha(fecha) {
  const [a, m, d] = fecha.split("-");
  const aa = a.slice(2);
  const sinCero = (x) => String(Number(x));

  return [
    `${a}-${m}-${d}`, `${a}${m}${d}`, `${a}_${m}_${d}`, `${a}.${m}.${d}`,
    `${d}-${m}-${a}`, `${d}/${m}/${a}`, `${d}.${m}.${a}`, `${d}_${m}_${a}`, `${d}${m}${a}`,
    `${d}-${m}-${aa}`, `${d}/${m}/${aa}`, `${d}.${m}.${aa}`, `${d}_${m}_${aa}`, `${d}${m}${aa}`,
    `${sinCero(d)}/${sinCero(m)}/${a}`, `${sinCero(d)}-${sinCero(m)}-${a}`, `${sinCero(d)}/${sinCero(m)}/${aa}`,
  ];
}

const llevaFecha = (texto, fecha) => {
  const formas = formasDeFecha(fecha);

  /* Que no sea parte de un número más largo (el 161026 de 1610261). */
  return formas.some((f) => new RegExp(`(^|[^0-9])${f.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([^0-9]|$)`).test(texto));
};

const diaLocal = (ms) => {
  const d = new Date(ms);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/*  EL VÍDEO: CÁMARA TÁCTICA O HUDL                                    */
/* ------------------------------------------------------------------ */

const EXT = /\.(mp4|mov|mkv|mts|m4v|avi)$/i;

/** Los ficheros de la cámara táctica de ese día (pueden ser varios trozos: van en orden de nombre). */
function deLaCamara(fecha) {
  if (!fs.existsSync(SESIONES)) return [];

  const hallados = [];
  const mira = (dir, nivel, conFechaArriba) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);

      if (e.isDirectory() && nivel < 3) mira(ruta, nivel + 1, conFechaArriba || llevaFecha(e.name, fecha));
      else if (e.isFile() && EXT.test(e.name)) {
        const porNombre = conFechaArriba || llevaFecha(e.name, fecha);
        const porDia = diaLocal(fs.statSync(ruta).mtimeMs) === fecha;

        if (porNombre || porDia) hallados.push(ruta);
      }
    }
  };

  mira(SESIONES, 0, false);

  return hallados.sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

async function duracion(ficheros) {
  let total = 0;

  for (const f of ficheros) {
    const r = await ejecuta(FFMPEG, ["-hide_banner", "-i", f], { maxBuffer: 1 << 24 }).catch((e) => ({ stderr: String(e.stderr ?? "") }));
    const m = String(r.stderr ?? "").match(/Duration: (\d+):(\d+):([\d.]+)/);

    if (m) total += Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }

  return total;
}

/** La lista HLS de una variante como mucho de `tope` b/s (un entrenamiento no necesita la de 5 Mb/s). */
async function listaHls(nav, master, tope = 3_500_000) {
  const texto = await fetch(master, { headers: await cabecerasPara(nav, master) }).then((r) => r.text());
  const lineas = texto.split(/\r?\n/);
  const variantes = [];

  lineas.forEach((l, i) => {
    const m = l.match(/^#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+)/);

    if (m && lineas[i + 1] && !lineas[i + 1].startsWith("#")) variantes.push({ bw: Number(m[1]), url: new URL(lineas[i + 1].trim(), master).href });
  });

  variantes.sort((a, b) => b.bw - a.bw);

  const elegida = variantes.find((v) => v.bw <= tope) ?? variantes[variantes.length - 1];
  const urlLista = elegida?.url ?? master;
  const lista = elegida ? await fetch(urlLista, { headers: await cabecerasPara(nav, urlLista) }).then((r) => r.text()) : texto;
  const segs = [];
  /* Lo que dura cada trozo (#EXTINF): el único dato fiable de tiempo; el del propio trozo no lo es. */
  const dur = [];
  let init = null;
  let pendiente = null;

  for (const l of lista.split(/\r?\n/)) {
    const mapa = l.match(/#EXT-X-MAP:URI="([^"]+)"/);
    const d = l.match(/^#EXTINF:([\d.]+)/);

    if (mapa) init = new URL(mapa[1], urlLista).href;
    else if (d) pendiente = Number(d[1]);
    else if (l && !l.startsWith("#")) {
      segs.push(new URL(l.trim(), urlLista).href);
      dur.push(pendiente ?? 0);
      pendiente = null;
    }
  }

  return { init, segs, dur, bw: elegida?.bw ?? null };
}

/** El entrenamiento del día en la biblioteca de Hudl: el título lleva la fecha y no es un partido. */
async function deHudl(fecha, destino) {
  const fichero = path.join(destino, "hudl.mp4");
  const hecho = path.join(destino, "hudl.json");

  if (fs.existsSync(fichero) && fs.existsSync(hecho)) return { fichero, ...JSON.parse(fs.readFileSync(hecho, "utf8")) };

  const nav = await abreHudl();

  try {
    const respuestas = [];
    const pendientes = new Set();
    const hls = [];

    nav.al("Network.loadingFinished", (p) => {
      if (pendientes.delete(p.requestId)) respuestas.push(p.requestId);
    });
    nav.al("Network.responseReceived", (p) => {
      const url = p.response?.url ?? "";

      if (/\/api\/graphql\/query/.test(url)) pendientes.add(p.requestId);
      if (/video\.ondemand\.m3u8/.test(url)) hls.push(url);
    });

    const cuerpo = async (id) => {
      try {
        return (await nav.manda("Network.getResponseBody", { requestId: id })).body ?? "";
      } catch {
        return "";
      }
    };

    await nav.manda("Page.navigate", { url: `https://www.hudl.com/library/${EQUIPO_HUDL}` });

    const videos = [];
    const recoge = async () => {
      for (const id of respuestas.splice(0)) {
        const texto = await cuerpo(id);

        if (!texto.includes('"library"')) continue;

        try {
          for (const arista of JSON.parse(texto).data?.library?.edges ?? []) {
            const v = arista.node;

            if (v?.title && v?.id && !videos.some((x) => x.id === v.id)) videos.push(v);
          }
        } catch {
          /* no era JSON entero */
        }
      }
    };

    for (let i = 0; i < 40 && !videos.length; i += 1) {
      await espera(1500);
      await recoge();
    }

    const esPartido = (t) => /^\d{4}-\d{2}-\d{2} .+ - .+ \d+ - \d+$/.test(t);
    const casan = () => videos.filter((v) => !esPartido(v.title) && llevaFecha(v.title, fecha));

    /* La biblioteca carga por páginas: se baja hasta encontrarlo o pasar de su fecha. */
    for (let i = 0; i < 12 && videos.length && !casan().length; i += 1) {
      const antes = videos.length;

      await nav.js(`
        window.scrollTo(0, document.body.scrollHeight);
        for (const el of document.querySelectorAll("*")) {
          if (el.scrollHeight > el.clientHeight + 200 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight;
        }
      `);
      await espera(3000);
      await recoge();

      const masViejo = videos.map((v) => String(v.createdAt ?? "")).sort()[0] ?? "";

      if (videos.length === antes || (masViejo && masViejo.slice(0, 10) < fecha)) break;
    }

    if (!videos.length) {
      const donde = String(await nav.js("return location.href"));

      if (/login|identity/i.test(donde)) return { error: 5, texto: "la sesión de Hudl no entra: abre scripts\\actualizar-wys.cmd y entra una vez a mano" };

      return { error: 1, texto: `la biblioteca de Hudl no ha contestado (${donde})` };
    }

    const candidatos = casan().sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));

    if (!candidatos.length) return null;

    const v = candidatos[0];

    console.log(`  Hudl: «${v.title}» (${Math.round((v.durationMs ?? 0) / 60000)} min)`);

    if (SOLO_VER) return { fichero: null, titulo: v.title, id: v.id };

    hls.length = 0;
    await nav.manda("Page.navigate", { url: `https://www.hudl.com/watch/video/${v.id}` });

    for (let i = 0; i < 30 && !hls.length; i += 1) await espera(1000);

    if (!hls.length) return { error: 1, texto: `Hudl no ha dado la lista del vídeo «${v.title}»` };

    const lista = await listaHls(nav, hls[0]);
    const cab = await cabecerasPara(nav, lista.segs[0]);
    const baja = async (url) => {
      for (let i = 0; i < 5; i += 1) {
        const r = await fetch(url, { headers: cab }).catch(() => null);

        if (r?.ok) return Buffer.from(await r.arrayBuffer());

        await espera(1000 * (i + 1));
      }

      throw new Error(`no baja un trozo del vídeo (${url.split("/").pop()})`);
    };

    paso(2, `bajando «${v.title}» de Hudl (${lista.segs.length} trozos${lista.bw ? `, ${(lista.bw / 1e6).toFixed(1)} Mb/s` : ""})`);

    /*
    | Cada trozo, su propio fichero (cabecera + trozo), y el concat de ffmpeg
    | los encadena (16/10/2026). Pegarlos todos en uno NO vale: cada trozo de
    | Hudl trae los tiempos desde cero y los 81 min del 16/10 se quedaron en
    | 3:48 (a 637 imágenes por segundo). El concat suma la duración de cada
    | fichero al siguiente. Lo ya bajado se aprovecha si se corta a medias.
    */
    const dirTrozos = path.join(destino, "trozos");

    fs.mkdirSync(dirTrozos, { recursive: true });

    const init = lista.init ? await baja(lista.init) : Buffer.alloc(0);
    const nombres = [];

    for (const [i, s] of lista.segs.entries()) {
      const ruta = path.join(dirTrozos, `t_${String(i).padStart(5, "0")}.mp4`);

      if (!fs.existsSync(ruta)) fs.writeFileSync(ruta, Buffer.concat([init, await baja(s)]));

      nombres.push(ruta);

      if (i % 100 === 0) console.log(`  trozo ${i + 1}/${lista.segs.length}`);
    }

    const listaConcat = path.join(destino, "trozos.txt");

    /* Con la duración de cada uno: si no, ffmpeg se fía de la del trozo y el 16/10 salió de 31 horas. */
    fs.writeFileSync(
      listaConcat,
      nombres.map((f, i) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'${lista.dur[i] ? `\nduration ${lista.dur[i]}` : ""}`).join("\n"),
      "utf8",
    );

    await ejecuta(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listaConcat, "-c", "copy", "-movflags", "+faststart", fichero], { maxBuffer: 1 << 24 });

    /* Que de verdad dure lo que dice Hudl: si no, mejor parar que analizar un vídeo roto. */
    const dura = await duracion([fichero]);
    const esperada = (v.durationMs ?? 0) / 1000;

    if (esperada && (dura < esperada * 0.8 || dura > esperada * 1.2)) {
      fs.rmSync(fichero, { force: true });

      return { error: 1, texto: `el vídeo de Hudl ha salido de ${Math.round(dura / 60)} min y debería durar ${Math.round(esperada / 60)}: no se analiza` };
    }

    fs.rmSync(dirTrozos, { recursive: true, force: true });
    fs.rmSync(listaConcat, { force: true });

    const datos = { titulo: v.title, id: v.id, url: `https://www.hudl.com/watch/video/${v.id}` };

    fs.writeFileSync(hecho, JSON.stringify(datos), "utf8");

    return { fichero, ...datos };
  } finally {
    await nav.cierra();
  }
}

/* ------------------------------------------------------------------ */
/*  GEMINI                                                             */
/* ------------------------------------------------------------------ */

async function conGemini(fn) {
  let ultimo = null;

  for (const model of MODELOS) {
    for (let intento = 0; intento < 4; intento += 1) {
      try {
        return await fn(model);
      } catch (error) {
        ultimo = error;

        const estado = error?.status;
        const porDia = /per_day|PerDay|retry in \d+h/i.test(String(error?.message ?? ""));

        console.log(`  (${model}: ${estado ?? ""} ${String(error?.message ?? error).slice(0, 140)})`);

        if (estado === 503 || estado === 500) await espera(10_000 * (intento + 1));
        else if (estado === 429 && !porDia) await espera(65_000);
        else break;
      }
    }
  }

  throw ultimo ?? new Error("Gemini no ha contestado");
}

const segundos = (t) => {
  const p = String(t ?? "").trim().split(":").map(Number);

  if (p.some((x) => !Number.isFinite(x))) return null;

  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0];
};

const ESQUEMA = {
  type: "object",
  properties: {
    acciones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          objetivo: { type: "string", description: "El id del objetivo" },
          inicio: { type: "string", description: "MM:SS dentro de este vídeo" },
          fin: { type: "string", description: "MM:SS dentro de este vídeo" },
          veredicto: { type: "string", enum: ["correcta", "mejorable"] },
          jugador: { type: "string", description: "Quién es y cómo se le ha reconocido" },
          explicacion: { type: "string", description: "Por qué ese veredicto, en una frase corta" },
        },
        required: ["objetivo", "inicio", "fin", "veredicto", "explicacion"],
      },
    },
  },
  required: ["acciones"],
};

function instrucciones(objetivos, desde, hasta) {
  const mm = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return [
    "Eres analista del Real Madrid Castilla y estás viendo un trozo de un ENTRENAMIENTO (no un partido).",
    `Este vídeo es del minuto ${mm(desde)} al ${mm(hasta)} de la sesión; los tiempos que des van DESDE EL PRINCIPIO DE ESTE VÍDEO (00:00).`,
    "Para cada objetivo, localiza las acciones en las que se ve con claridad a su jugador o jugadores haciendo (o debiendo hacer) lo que se busca, y di si es CORRECTA o MEJORABLE según su criterio.",
    "REGLAS: sólo acciones que se vean bien; si no estás seguro de que es ese jugador, no la pongas; no inventes; nada de lo que pase en tiempos de descanso o explicación;",
    "cada acción dura lo que dura la jugada (normalmente 3-12 s); como mucho 25 por objetivo; la explicación, en castellano y en una frase corta y concreta (qué hizo y qué debía hacer).",
    "Objetivos:",
    ...objetivos.map((o) =>
      [
        `- id ${o.id}: ${o.objetivo}`,
        `  jugadores: ${o.jugadores.map((j) => j.nombre).join(", ") || "los que se indiquen"}`,
        o.reconocer ? `  cómo reconocerlos: ${o.reconocer}` : "",
        o.correcto ? `  CORRECTA si: ${o.correcto}` : "",
        o.mejorable ? `  MEJORABLE si: ${o.mejorable}` : "",
        o.donde ? `  sólo en: ${o.donde}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");
}

async function analizaParte(ai, ruta, objetivos, desde, hasta) {
  const subido = await ai.files.upload({ file: ruta, config: { mimeType: "video/mp4" } });
  let fichero = subido;

  for (let i = 0; i < 90 && fichero.state !== "ACTIVE"; i += 1) {
    if (fichero.state === "FAILED") throw new Error("Gemini no ha podido procesar el vídeo");

    await espera(4000);
    fichero = await ai.files.get({ name: subido.name });
  }

  try {
    const r = await conGemini((model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [createPartFromUri(fichero.uri, fichero.mimeType), { text: instrucciones(objetivos, desde, hasta) }] }],
        config: { temperature: 0.2, mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW, responseMimeType: "application/json", responseJsonSchema: ESQUEMA },
      }),
    );

    return JSON.parse(r.text ?? "{}").acciones ?? [];
  } finally {
    await ai.files.delete({ name: subido.name }).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

async function principal() {
  if (!FECHA || !/^\d{4}-\d{2}-\d{2}$/.test(FECHA)) return fin(1, "Uso: --fecha AAAA-MM-DD");

  const env = entorno();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  paso(1, "objetivos y vídeo del día");

  const { data: docSesion } = await supabase.from("app_documents").select("data").eq("key", `entreno:${FECHA}`).maybeSingle();
  const objetivos = (docSesion?.data?.objetivos ?? []).filter((o) => o?.id && String(o.objetivo ?? "").trim());

  if (!objetivos.length && !SOLO_VER) return fin(2, `el entrenamiento del ${FECHA} no tiene objetivos: defínelos en la pantalla antes de analizar`);

  console.log(`  ${objetivos.length} objetivos`);

  const destino = path.join(CACHE, FECHA);

  fs.mkdirSync(destino, { recursive: true });

  /* 1. La cámara táctica, si la hay; si no, Hudl. */
  const camara = deLaCamara(FECHA);
  let fuente = null;

  if (camara.length) {
    fuente = { tipo: "camara", ficheros: camara, nombre: camara.map((f) => path.basename(f)).join(" + "), url: null };
    console.log(`  cámara táctica: ${fuente.nombre}`);
  } else {
    console.log(`  sin cámara táctica del ${FECHA} en ${SESIONES}; se busca en Hudl`);

    const hudl = await deHudl(FECHA, destino);

    if (hudl?.error) return fin(hudl.error, hudl.texto);

    if (!hudl) return fin(3, `no hay vídeo del entrenamiento del ${FECHA}: ni en la carpeta SESIONES ni en Hudl con esa fecha en el título`);

    if (SOLO_VER) return fin(0, `usaría el vídeo de Hudl «${hudl.titulo}»`);

    fuente = { tipo: "hudl", ficheros: [hudl.fichero], nombre: hudl.titulo, url: hudl.url };
  }

  if (SOLO_VER) return fin(0, `usaría la cámara táctica: ${fuente.nombre}`);

  const duracionTotal = await duracion(fuente.ficheros);

  console.log(`  vídeo: ${Math.round(duracionTotal / 60)} min`);

  /* Varios trozos de la cámara: se leen como uno (lista para el concat de ffmpeg). */
  const entrada = (() => {
    if (fuente.ficheros.length === 1) return ["-i", fuente.ficheros[0]];

    const lista = path.join(destino, "lista.txt");

    fs.writeFileSync(lista, fuente.ficheros.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");

    return ["-f", "concat", "-safe", "0", "-i", lista];
  })();

  /* 3. La copia para la IA: 1 imagen por segundo, 360 de alto, sin sonido, en partes de 20 min. */
  paso(3, "preparando el vídeo para la IA");

  const dirPartes = path.join(destino, "partes");

  fs.rmSync(dirPartes, { recursive: true, force: true });
  fs.mkdirSync(dirPartes, { recursive: true });

  await ejecuta(
    FFMPEG,
    ["-y", "-loglevel", "error", ...entrada, "-vf", "fps=1,scale=-2:360", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "32", "-f", "segment", "-segment_time", String(PARTE_S), "-reset_timestamps", "1", path.join(dirPartes, "parte_%02d.mp4")],
    { maxBuffer: 1 << 26 },
  );

  const partes = fs.readdirSync(dirPartes).filter((f) => f.endsWith(".mp4")).sort();

  /* 4. Gemini, parte a parte. */
  const clave = env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

  if (!clave) return fin(4, "falta GEMINI_API_KEY en .env.local");

  const ai = new GoogleGenAI({ apiKey: clave });
  const acciones = [];
  const avisos = [];
  const porId = new Map(objetivos.map((o) => [o.id, o]));

  for (const [i, parte] of partes.entries()) {
    const desde = i * PARTE_S;
    const hasta = Math.min(duracionTotal, desde + PARTE_S);

    paso(4, `la IA mira la parte ${i + 1} de ${partes.length}`);

    try {
      const leidas = await analizaParte(ai, path.join(dirPartes, parte), objetivos, desde, hasta);

      for (const a of leidas) {
        const ini = segundos(a.inicio);
        const fn = segundos(a.fin);

        if (!porId.has(a.objetivo) || ini === null) continue;

        acciones.push({
          id: `${a.objetivo}-${Math.round(desde + ini)}`,
          objetivoId: a.objetivo,
          inicio: desde + ini,
          fin: desde + Math.max(ini + 2, fn ?? ini + 6),
          veredicto: a.veredicto === "mejorable" ? "mejorable" : "correcta",
          jugador: String(a.jugador ?? "").slice(0, 120),
          explicacion: String(a.explicacion ?? "").slice(0, 240),
          clip: null,
        });
      }

      console.log(`  parte ${i + 1}: ${leidas.length} acciones`);
    } catch (error) {
      const texto = `la parte ${i + 1} (min ${Math.round(desde / 60)}-${Math.round(hasta / 60)}) no se ha podido mirar: ${String(error?.message ?? error).slice(0, 120)}`;

      avisos.push(texto);
      console.log(`  FALLO: ${texto}`);
    }

    if (i < partes.length - 1) await espera(20_000);
  }

  /* Sin repetir: dos acciones del mismo objetivo con el mismo segundo son la misma. */
  const unicas = [...new Map(acciones.map((a) => [a.id, a])).values()].sort((a, b) => a.inicio - b.inicio);

  /* 5. Clips de ejemplo: los primeros de cada veredicto por objetivo, repartidos por la sesión. */
  paso(5, "cortando clips y contando");

  const aCortar = [];

  for (const o of objetivos) {
    for (const v of ["correcta", "mejorable"]) {
      const suyas = unicas.filter((a) => a.objetivoId === o.id && a.veredicto === v);
      const salto = Math.max(1, Math.floor(suyas.length / CLIPS_POR_VEREDICTO));

      for (let k = 0; k < suyas.length && aCortar.filter((x) => x.objetivoId === o.id && x.veredicto === v).length < CLIPS_POR_VEREDICTO; k += salto) aCortar.push(suyas[k]);
    }
  }

  const dirClips = path.join(destino, "clips");

  fs.mkdirSync(dirClips, { recursive: true });

  for (const [i, a] of aCortar.entries()) {
    const ss = Math.max(0, a.inicio - 3);
    const dura = Math.min(25, a.fin - a.inicio + 6);
    const fichero = path.join(dirClips, `${a.id}.mp4`);

    try {
      await ejecuta(
        FFMPEG,
        ["-y", "-loglevel", "error", ...(entrada[0] === "-f" ? [] : ["-ss", String(ss)]), ...entrada, ...(entrada[0] === "-f" ? ["-ss", String(ss)] : []), "-t", String(dura), "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", fichero],
        { maxBuffer: 1 << 24 },
      );

      const destinoBucket = `2026/entrenos/${FECHA}/${a.id}.mp4`;
      const { error } = await supabase.storage.from(BUCKET).upload(destinoBucket, fs.readFileSync(fichero), { contentType: "video/mp4", upsert: true });

      if (error) throw new Error(error.message);

      a.clip = supabase.storage.from(BUCKET).getPublicUrl(destinoBucket).data.publicUrl;
      console.log(`  clip ${i + 1}/${aCortar.length}`);
    } catch (error) {
      avisos.push(`un clip (${Math.round(a.inicio / 60)}') no se ha podido cortar: ${String(error?.message ?? error).slice(0, 80)}`);
    }
  }

  const resumen = objetivos.map((o) => {
    const suyas = unicas.filter((a) => a.objetivoId === o.id);
    const correctas = suyas.filter((a) => a.veredicto === "correcta").length;

    return { objetivoId: o.id, total: suyas.length, correctas, mejorables: suyas.length - correctas };
  });

  const huella = (o) => [o.id, String(o.objetivo ?? "").trim(), (o.jugadores ?? []).map((j) => j.id).sort().join(","), String(o.reconocer ?? "").trim(), String(o.correcto ?? "").trim(), String(o.mejorable ?? "").trim(), String(o.donde ?? "").trim()].join("|");

  const analisis = {
    fecha: FECHA,
    hechoEn: new Date().toISOString(),
    fuente: { tipo: fuente.tipo, nombre: fuente.nombre, duracion: Math.round(duracionTotal), url: fuente.url },
    acciones: unicas,
    resumen,
    avisos,
    objetivosAnalizados: objetivos.map(huella),
  };

  const { error } = await supabase.from("app_documents").upsert({ key: `entreno-analisis:${FECHA}`, kind: "entreno", data: analisis, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return fin(1, `no se ha podido guardar el análisis: ${error.message}`);

  const conClip = unicas.filter((a) => a.clip).length;

  return fin(
    avisos.length && !unicas.length ? 1 : 0,
    `entrenamiento del ${FECHA} (${fuente.tipo === "camara" ? "cámara táctica" : "Hudl"}, ${Math.round(duracionTotal / 60)} min): ${unicas.length} acciones en ${objetivos.length} objetivos, ${conClip} clips${avisos.length ? ` · ${avisos.length} avisos` : ""}`,
  );
}

principal().catch((error) => fin(1, `FALLO: ${String(error?.stack ?? error).slice(0, 300)}`));
