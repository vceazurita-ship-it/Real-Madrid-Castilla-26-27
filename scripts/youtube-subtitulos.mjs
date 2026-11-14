/*
|--------------------------------------------------------------------------
| LOS SUBTÍTULOS DE LOS RESÚMENES DE YOUTUBE, CON LA SESIÓN DEL ANALISTA
|--------------------------------------------------------------------------
| (04/11/2026)
|
| Sin sesión, YouTube no deja leer los subtítulos automáticos. Con ellos sale
| el segundo exacto de cada acción a balón parado (lo calcula
| `abp-acciones.cjs`: el nombre del rematador, «gol» cerca y el orden).
|
| LA SESIÓN. Un perfil de Chrome propio y aparte, `.cache/chrome-youtube`
| (fuera de git), en el que el analista entra UNA vez con su cuenta con
| `scripts\youtube-sesion.cmd` (acceso directo «YouTube · iniciar sesión»).
| Aquí nunca se mete una contraseña ni se intenta entrar, ni se resuelve una
| comprobación de robot: si YouTube la pide, se para y se dice.
|
| CÓMO. Chrome sin ventana (o el que ya abrió el .cmd, mismo puerto) por CDP:
|   1. youtube.com → `ytcfg.get("LOGGED_IN")`. Si no, se publica «caducada».
|   2. Cada vídeo → la pista automática (`captionTracks`, kind «asr») pedida
|      desde la propia página con `fmt=json3`; si llega vacía (YouTube pide ya
|      un token del reproductor), el panel «Mostrar transcripción».
| Ritmo moderado (5-8 s por vídeo) y un tope por pasada.
|
| EL ESTADO. `mantenimiento:youtube` en Supabase (lib/mantenimiento.ts,
| `SesionYoutube`): lo lee Ajustes y avisa si hay que volver a entrar.
*/

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const espera = (ms) => new Promise((listo) => setTimeout(listo, ms));

export const PUERTO_YOUTUBE = 9355;

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  path.join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
].find((ruta) => fs.existsSync(ruta));

export class SinSesion extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

async function pestanas() {
  try {
    return await fetch(`http://127.0.0.1:${PUERTO_YOUTUBE}/json`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
  } catch {
    return null;
  }
}

/** El perfil existe y alguien ha entrado alguna vez (hay cookies). */
export const hayPerfil = (perfil) => fs.existsSync(path.join(perfil, "Default"));

/**
 * Abre el perfil de YouTube sin ventana (o se engancha al que abrió el .cmd).
 * Devuelve `{ js, ve, cierra }`.
 */
export async function abreYoutube(perfil) {
  let loAbrimos = false;

  if (!(await pestanas())) {
    if (!CHROME) throw new Error("No encuentro Chrome.");

    /* Si el perfil está abierto sin puerto (una ventana a mano), Chrome le pasa
       el encargo a esa ventana y el puerto no se abre nunca: se dice «ocupado». */
    spawn(
      CHROME,
      [
        `--remote-debugging-port=${PUERTO_YOUTUBE}`,
        `--user-data-dir=${perfil}`,
        "--headless=new",
        "--mute-audio",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1400,900",
        "about:blank",
      ],
      { stdio: "ignore", detached: true },
    ).unref();

    loAbrimos = true;

    for (let i = 0; i < 40 && !(await pestanas()); i++) await espera(500);

    if (!(await pestanas())) throw new SinSesion("ocupado", "el perfil de YouTube está abierto en otra ventana (ciérrala)");
  }

  const nueva = await fetch(`http://127.0.0.1:${PUERTO_YOUTUBE}/json/new?about:blank`, { method: "PUT", signal: AbortSignal.timeout(15_000) }).then((r) =>
    r.json(),
  );

  const ws = new WebSocket(nueva.webSocketDebuggerUrl);

  await new Promise((listo, falla) => {
    ws.onopen = listo;
    ws.onerror = () => falla(new Error("No se puede hablar con la pestaña de Chrome."));
  });

  let n = 0;
  const pendientes = new Map();

  ws.onmessage = (e) => {
    const dato = JSON.parse(e.data);

    if (dato.id && pendientes.has(dato.id)) {
      pendientes.get(dato.id)(dato);
      pendientes.delete(dato.id);
    }
  };

  const manda = (metodo, parametros = {}, plazo = 60_000) =>
    new Promise((res, rej) => {
      const id = ++n;

      pendientes.set(id, (d) => (d.error ? rej(new Error(`${metodo}: ${d.error.message}`)) : res(d.result)));

      ws.send(JSON.stringify({ id, method: metodo, params: parametros }));

      setTimeout(() => {
        if (pendientes.delete(id)) rej(new Error(`sin respuesta: ${metodo}`));
      }, plazo);
    });

  const js = async (codigo) => {
    const r = await manda("Runtime.evaluate", { expression: `(async () => { ${codigo} })()`, returnByValue: true, awaitPromise: true });

    return r.result?.value;
  };

  await manda("Page.enable");

  /* Sin «HeadlessChrome» en el agente: con él YouTube sirve otra página. */
  const { userAgent } = await manda("Browser.getVersion");

  await manda("Network.enable");
  await manda("Network.setUserAgentOverride", { userAgent: String(userAgent).replace("HeadlessChrome", "Chrome"), acceptLanguage: "es-ES,es" });

  /** Carga una dirección y espera a que la página esté. */
  async function ve(url) {
    await manda("Page.navigate", { url });

    for (let i = 0; i < 40; i++) {
      await espera(500);

      if ((await js("return document.readyState")) === "complete") break;
    }

    await espera(1500);

    /* ¿Comprobación de robot? Se para aquí: no se resuelve nunca. */
    const robot = await js(`
      const t = (document.body?.innerText || "").slice(0, 4000);
      return location.href.includes("/sorry/") || /no eres un bot|not a bot|unusual traffic|tráfico inusual/i.test(t);
    `);

    if (robot) throw new SinSesion("comprobacion", "YouTube pide comprobar que no es un robot");
  }

  async function cierra() {
    try {
      if (loAbrimos) await manda("Browser.close", {}, 5000);
      else await fetch(`http://127.0.0.1:${PUERTO_YOUTUBE}/json/close/${nueva.id}`, { signal: AbortSignal.timeout(10_000) });
    } catch {
      /* ya cerrado */
    }

    try {
      ws.close();
    } catch {
      /* nada */
    }
  }

  return { js, ve, cierra };
}

/** ¿Hay una cuenta dentro? */
export async function estaDentro(yt) {
  await yt.ve("https://www.youtube.com/?hl=es&gl=ES");

  return Boolean(await yt.js(`return Boolean(window.ytcfg?.get?.("LOGGED_IN"))`));
}

/**
 * Los subtítulos de un vídeo como [[segundo, texto], …], o [] si no tiene.
 * `lengua` es la del resumen («es» o «en»): se prefiere la pista automática en
 * esa lengua.
 */
export async function subtitulosDe(yt, id, lengua) {
  await yt.ve(`https://www.youtube.com/watch?v=${id}&hl=es&gl=ES`);

  /* 1. La pista, pedida desde la página (lleva la sesión). */
  const pista = await yt.js(`
    const pr = window.ytInitialPlayerResponse;
    if (!pr || pr.videoDetails?.videoId !== ${JSON.stringify(id)}) return null;
    const pistas = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const de = (l) => pistas.find((p) => p.kind === "asr" && p.languageCode?.startsWith(l)) || pistas.find((p) => p.languageCode?.startsWith(l));
    const p = de(${JSON.stringify(lengua)}) || pistas.find((x) => x.kind === "asr") || pistas[0];
    if (!p) return { sin: true };
    try {
      const r = await fetch(p.baseUrl + "&fmt=json3", { credentials: "include" });
      const texto = await r.text();
      if (!texto) return { vacia: true };
      const d = JSON.parse(texto);
      return { lineas: (d.events || []).filter((e) => e.segs).map((e) => [Math.round(e.tStartMs / 1000), e.segs.map((s) => s.utf8).join("").replace(/\\s+/g, " ").trim()]).filter((l) => l[1]) };
    } catch { return { vacia: true }; }
  `);

  if (pista?.lineas?.length) return { via: "pista", lineas: pista.lineas };

  if (pista?.sin) return { via: null, lineas: [] };

  /* 2. El panel «Mostrar transcripción». */
  const panel = await yt.js(`
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector("tp-yt-paper-button#expand, #description-inline-expander #expand")?.click();
    await espera(800);
    const boton = document.querySelector("ytd-video-description-transcript-section-renderer button")
      || [...document.querySelectorAll("button")].find((b) => /transcrip/i.test(b.getAttribute("aria-label") || b.innerText || ""));
    if (!boton) return [];
    boton.click();
    const aSeg = (s) => s.trim().split(":").reduce((t, p) => t * 60 + Number(p), 0);
    for (let i = 0; i < 20; i++) {
      await espera(500);
      const filas = [...document.querySelectorAll("ytd-transcript-segment-renderer, transcript-segment-view-model")];
      if (filas.length) {
        return filas.map((f) => {
          const partes = (f.innerText || "").split("\\n").map((x) => x.trim()).filter(Boolean);
          const i = partes.findIndex((x) => /^\\d{1,2}:\\d{2}(:\\d{2})?$/.test(x));
          return i < 0 ? null : [aSeg(partes[i]), partes.filter((_, k) => k !== i).join(" ")];
        }).filter((l) => l && l[1]);
      }
    }
    return [];
  `);

  return panel?.length ? { via: "panel", lineas: panel } : { via: null, lineas: [] };
}

/** Publica cómo está la sesión para que lo vea Ajustes. Nunca rompe nada. */
export async function publicaEstado(raiz, estado) {
  try {
    const { entorno } = require(path.join(raiz, "scripts", "supabase-local.cjs"));

    const env = entorno();

    if (!env) return false;

    const { createClient } = require("../lib/datos/cliente.cjs"); /* con reserva: lib/datos/cliente.cjs */

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const clave = "mantenimiento:youtube";

    const { data: previo } = await supabase.from("app_documents").select("data").eq("key", clave).maybeSingle();

    const ahora = new Date().toISOString();

    const data = {
      ...estado,
      comprobadoEn: ahora,
      ...(estado.estado === "ok" ? { bienEn: ahora } : previo?.data?.bienEn ? { bienEn: previo.data.bienEn } : {}),
    };

    const { error } = await supabase.from("app_documents").upsert({ key: clave, kind: "mantenimiento", data, updated_at: ahora }, { onConflict: "key" });

    return !error;
  } catch {
    return false;
  }
}
