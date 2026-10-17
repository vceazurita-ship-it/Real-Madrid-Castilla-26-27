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

/**
 * La lista HLS de una variante: la mejor que no pase de `tope` b/s (para los
 * clips), o la más ligera con `tope` = 0 (para la copia que mira la IA). Sólo
 * H.264: la de 1080 en HEVC no hace falta para nada de esto.
 */
async function listaHls(nav, master, tope = 3_500_000) {
  const texto = await fetch(master, { headers: await cabecerasPara(nav, master) }).then((r) => r.text());
  const lineas = texto.split(/\r?\n/);
  const variantes = [];

  lineas.forEach((l, i) => {
    const m = l.match(/^#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+)/);

    if (m && !/hvc1|hev1/.test(l) && lineas[i + 1] && !lineas[i + 1].startsWith("#")) variantes.push({ bw: Number(m[1]), url: new URL(lineas[i + 1].trim(), master).href });
  });

  variantes.sort((a, b) => b.bw - a.bw);

  const elegida = tope === 0 ? variantes[variantes.length - 1] : (variantes.find((v) => v.bw <= tope) ?? variantes[variantes.length - 1]);
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

/**
 * El entrenamiento del día en la biblioteca de Hudl: el título lleva la fecha y
 * no es un partido. NO se baja (17/10/2026, lo pidió el usuario: nada de
 * entrenamientos enteros en disco): devuelve el vídeo, su lista maestra y la
 * sesión de Hudl abierta, para pedir luego sólo los trozos que hagan falta.
 * Quien la recibe la cierra.
 */
async function deHudl(fecha) {
  const nav = await abreHudl();
  let entregada = false;

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

    if (SOLO_VER) return { titulo: v.title, id: v.id };

    hls.length = 0;
    await nav.manda("Page.navigate", { url: `https://www.hudl.com/watch/video/${v.id}` });

    for (let i = 0; i < 30 && !hls.length; i += 1) await espera(1000);

    if (!hls.length) return { error: 1, texto: `Hudl no ha dado la lista del vídeo «${v.title}»` };

    entregada = true;

    return { nav, master: hls[0], titulo: v.title, id: v.id, url: `https://www.hudl.com/watch/video/${v.id}`, durationMs: v.durationMs ?? 0 };
  } finally {
    if (!entregada) await nav.cierra();
  }
}

/* ------------------------------------------------------------------ */
/*  LAS FUENTES: TRAMOS AL VUELO, NADA ENTERO EN DISCO                 */
/* ------------------------------------------------------------------ */

/*
| 17/10/2026 (lo pidió el usuario): los entrenamientos NO se bajan enteros.
| Una fuente sabe dos cosas: dar la copia ligera de un tramo (1 imagen por
| segundo, 360 de alto, para la IA) y cortar un clip de un tramo. En Hudl,
| cada una baja SÓLO los trozos HLS de ese tramo —de la variante más ligera
| para la IA y de la buena (≤3,5 Mb/s) para los clips— y los borra al acabar.
| La cámara táctica ya está en el disco: se lee el tramo directamente.
*/

const LIGERA = ["-vf", "fps=1,scale=-2:360", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "32"];
const CLIP = ["-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"];

function fuenteCamara(ficheros, destino) {
  const entrada = (() => {
    if (ficheros.length === 1) return ["-i", ficheros[0]];

    const lista = path.join(destino, "lista.txt");

    fs.writeFileSync(lista, ficheros.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");

    return ["-f", "concat", "-safe", "0", "-i", lista];
  })();
  /* Con varios ficheros (concat) el salto va detrás de la entrada; con uno, delante (más rápido). */
  const tramo = (ss, dura) => (entrada[0] === "-f" ? [...entrada, "-ss", String(ss), "-t", String(dura)] : ["-ss", String(ss), "-t", String(dura), ...entrada]);

  return {
    tipo: "camara",
    nombre: ficheros.map((f) => path.basename(f)).join(" + "),
    url: null,
    duracion: () => duracion(ficheros),
    ligera: (ss, dura, salida) => ejecuta(FFMPEG, ["-y", "-loglevel", "error", ...tramo(ss, dura), ...LIGERA, salida], { maxBuffer: 1 << 24 }),
    clip: (ss, dura, salida) => ejecuta(FFMPEG, ["-y", "-loglevel", "error", ...tramo(ss, dura), ...CLIP, salida], { maxBuffer: 1 << 24 }),
    cierra: async () => undefined,
  };
}

async function fuenteHudl(hudl, destino) {
  const { nav, master } = hudl;
  const alta = await listaHls(nav, master, 3_500_000);
  const baja = await listaHls(nav, master, 0);
  const cabeceras = new Map();
  const cabDe = async (url) => {
    const base = url.split("?")[0].replace(/[^/]+$/, "");

    if (!cabeceras.has(base)) cabeceras.set(base, await cabecerasPara(nav, url));

    return cabeceras.get(base);
  };
  const baja1 = async (url) => {
    for (let i = 0; i < 5; i += 1) {
      const r = await fetch(url, { headers: await cabDe(url) }).catch(() => null);

      if (r?.ok) return Buffer.from(await r.arrayBuffer());

      await espera(1000 * (i + 1));
    }

    throw new Error(`no baja un trozo del vídeo (${url.split("?")[0].split("/").pop()})`);
  };

  /*
  | Los trozos que cubren [ss, ss + dura], cada uno en su fichero (cabecera +
  | trozo) y una lista para el concat con la duración de su #EXTINF: cada
  | trozo de Hudl declara mal su propio tiempo (16/10: 81 min salieron de
  | 3:48 pegados en uno, y de 31 h con el concat sin duraciones).
  */
  const trozos = async (lista, ss, dura) => {
    const inicios = [0];

    for (const d of lista.dur) inicios.push(inicios[inicios.length - 1] + d);

    let i0 = Math.max(0, inicios.findIndex((t, i) => i < lista.segs.length && inicios[i + 1] > ss));
    const i1 = Math.min(lista.segs.length - 1, Math.max(i0, inicios.findIndex((t) => t >= ss + dura) - 1));

    if (i0 < 0) i0 = 0;

    const dir = fs.mkdtempSync(path.join(destino, "t-"));
    const init = lista.init ? await baja1(lista.init) : Buffer.alloc(0);
    const lineas = [];

    for (let i = i0; i <= (i1 < 0 ? lista.segs.length - 1 : i1); i += 1) {
      const ruta = path.join(dir, `t_${String(i).padStart(5, "0")}.mp4`);

      fs.writeFileSync(ruta, Buffer.concat([init, await baja1(lista.segs[i])]));
      lineas.push(`file '${ruta.split(path.sep).join("/")}'\nduration ${lista.dur[i] || 4}`);
    }

    const txt = path.join(dir, "lista.txt");

    fs.writeFileSync(txt, lineas.join("\n"), "utf8");

    return { dir, txt, desfase: Math.max(0, ss - inicios[i0]) };
  };

  const corta = async (lista, ss, dura, opciones, salida) => {
    const t = await trozos(lista, ss, dura);

    try {
      await ejecuta(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", t.txt, "-ss", String(t.desfase), "-t", String(dura), ...opciones, salida], { maxBuffer: 1 << 24 });
    } finally {
      fs.rmSync(t.dir, { recursive: true, force: true });
    }
  };

  return {
    tipo: "hudl",
    nombre: hudl.titulo,
    url: hudl.url,
    duracion: async () => alta.dur.reduce((s, d) => s + d, 0),
    ligera: (ss, dura, salida) => corta(baja, ss, dura, LIGERA, salida),
    clip: (ss, dura, salida) => corta(alta, ss, dura, CLIP, salida),
    cierra: () => nav.cierra(),
  };
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
    /* 17/10/2026: la primera pasada (16/10) dio 29 de 29 «correctas» con jugadores reconocidos sólo por su sitio en una cámara lejana. */
    "SÉ EXIGENTE, como un entrenador: lo normal es que haya acciones de los dos tipos. Si el objetivo no trae criterio, CORRECTA sólo si lo hace como lo haría el mejor de su puesto; ante la duda, MEJORABLE.",
    "La cámara puede ser lejana: si no puedes reconocer al jugador con seguridad (peto, dorsal, rasgo claro), NO pongas la acción; en «jugador» di en qué te basas para reconocerlo.",
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

  /* 1. La cámara táctica, si la hay; si no, Hudl (sin bajarlo). */
  const camara = deLaCamara(FECHA);
  let fuente = null;

  if (camara.length) {
    fuente = fuenteCamara(camara, destino);
    console.log(`  cámara táctica: ${fuente.nombre}`);
  } else {
    console.log(`  sin cámara táctica del ${FECHA} en ${SESIONES}; se busca en Hudl`);

    const hudl = await deHudl(FECHA);

    if (hudl?.error) return fin(hudl.error, hudl.texto);

    if (!hudl) return fin(3, `no hay vídeo del entrenamiento del ${FECHA}: ni en la carpeta SESIONES ni en Hudl con esa fecha en el título`);

    if (SOLO_VER) return fin(0, `usaría el vídeo de Hudl «${hudl.titulo}»`);

    paso(2, `listas de «${hudl.titulo}» en Hudl (sin bajar el vídeo)`);
    fuente = await fuenteHudl(hudl, destino);
  }

  if (SOLO_VER) return fin(0, `usaría la cámara táctica: ${fuente.nombre}`);

  /* --prueba-tramo SS: corta 60 s de copia ligera y 20 s de clip desde ese segundo y para (sin IA ni almacén). */
  const prueba = arg("prueba-tramo");

  if (prueba) {
    try {
      const ss = Number(prueba);
      const salida = path.join(REPO, ".cache", "entrenos");

      await fuente.ligera(ss, 60, path.join(salida, "prueba-ligera.mp4"));
      await fuente.clip(ss, 20, path.join(salida, "prueba-clip.mp4"));

      return fin(0, `prueba: ${Math.round(await fuente.duracion() / 60)} min; ligera y clip desde el segundo ${ss} en .cache/entrenos`);
    } finally {
      await fuente.cierra().catch(() => undefined);
      fs.rmSync(destino, { recursive: true, force: true });
    }
  }

  try {
    return await analiza(supabase, env, objetivos, fuente, destino);
  } finally {
    await fuente.cierra().catch(() => undefined);
    /* Nada se queda en el disco: sólo los clips, en el almacén. */
    fs.rmSync(destino, { recursive: true, force: true });
  }
}

async function analiza(supabase, env, objetivos, fuente, destino) {
  const duracionTotal = await fuente.duracion();

  console.log(`  vídeo: ${Math.round(duracionTotal / 60)} min`);

  const clave = env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

  if (!clave) return fin(4, "falta GEMINI_API_KEY en .env.local");

  const ai = new GoogleGenAI({ apiKey: clave });
  const acciones = [];
  const avisos = [];
  const porId = new Map(objetivos.map((o) => [o.id, o]));
  const nPartes = Math.max(1, Math.ceil(duracionTotal / PARTE_S));

  /* 3. Parte a parte: la copia ligera de ese tramo, la IA la mira y se borra. */
  for (let i = 0; i < nPartes; i += 1) {
    const desde = i * PARTE_S;
    const hasta = Math.min(duracionTotal, desde + PARTE_S);
    const parte = path.join(destino, `parte_${String(i).padStart(2, "0")}.mp4`);

    paso(3, `parte ${i + 1} de ${nPartes}: copia ligera y la IA la mira`);

    try {
      await fuente.ligera(desde, hasta - desde, parte);

      const leidas = await analizaParte(ai, parte, objetivos, desde, hasta);

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
    } finally {
      fs.rmSync(parte, { force: true });
    }

    if (i < nPartes - 1) await espera(20_000);
  }

  paso(4, "juntando lo que ha visto la IA");

  /* Sin repetir: dos acciones del mismo objetivo con el mismo segundo son la misma. */
  const unicas = [...new Map(acciones.map((a) => [a.id, a])).values()].sort((a, b) => a.inicio - b.inicio);

  /*
  | 5. UN clip de cada veredicto por objetivo (17/10/2026, lo pidió el
  | usuario: «uno de cada, no más, para no saturar el espacio»): el que la IA
  | explica con más detalle. Antes de subir los nuevos se borran los de un
  | análisis anterior de ese día.
  */
  paso(5, "un clip de cada: correcto y mejorable");

  const carpeta = `2026/entrenos/${FECHA}`;
  const { data: viejos } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 1000 });

  if (viejos?.length) await supabase.storage.from(BUCKET).remove(viejos.map((f) => `${carpeta}/${f.name}`));

  const aCortar = objetivos.flatMap((o) =>
    ["correcta", "mejorable"]
      .map((v) => unicas.filter((a) => a.objetivoId === o.id && a.veredicto === v).sort((a, b) => b.explicacion.length - a.explicacion.length)[0])
      .filter(Boolean),
  );

  for (const [i, a] of aCortar.entries()) {
    const ss = Math.max(0, a.inicio - 3);
    const dura = Math.min(25, a.fin - a.inicio + 6);
    const fichero = path.join(destino, `${a.id}.mp4`);

    try {
      await fuente.clip(ss, dura, fichero);

      const destinoBucket = `${carpeta}/${a.id}.mp4`;
      const { error } = await supabase.storage.from(BUCKET).upload(destinoBucket, fs.readFileSync(fichero), { contentType: "video/mp4", upsert: true });

      if (error) throw new Error(error.message);

      a.clip = supabase.storage.from(BUCKET).getPublicUrl(destinoBucket).data.publicUrl;
      console.log(`  clip ${i + 1}/${aCortar.length}`);
    } catch (error) {
      avisos.push(`un clip (${Math.round(a.inicio / 60)}') no se ha podido cortar: ${String(error?.message ?? error).slice(0, 80)}`);
    } finally {
      fs.rmSync(fichero, { force: true });
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
