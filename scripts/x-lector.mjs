/**
 * EL CHROME DE X Y SU LECTURA, COMPARTIDOS (23/11/2026).
 *
 * Salen de scripts/x-ideas.mjs para que los use también
 * scripts/abp-externos.mjs (análisis externos del Laboratorio de ABP). Mismo
 * Chrome propio (perfil `%LOCALAPPDATA%\rmcf-x`, puerto 9336), misma sesión y
 * mismas precauciones: pocas pantallas, pausas, y se para si X pide entrar o
 * demostrar que no es un robot.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { X, paso, pausa } from "./x-comun.mjs";

const PUERTO = Number(process.env.X_PUERTO ?? 9336);
const PERFIL = path.join(process.env.LOCALAPPDATA ?? os.homedir(), "rmcf-x");
let PERFIL_URL = `https://x.com/${X.CUENTA_X}`;
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((r) => fs.existsSync(r));



/* ------------------------------------------------------------------ */
/*  CHROME                                                             */
/* ------------------------------------------------------------------ */

async function pestanas() {
  try {
    return await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
  } catch {
    return null;
  }
}

export async function abreChrome() {
  if (await pestanas()) return true;
  if (!CHROME) return false;

  fs.mkdirSync(PERFIL, { recursive: true });
  spawn(
    CHROME,
    [`--remote-debugging-port=${PUERTO}`, `--user-data-dir=${PERFIL}`, "--no-first-run", "--no-default-browser-check", "--window-size=1300,950", PERFIL_URL],
    { stdio: "ignore", detached: true },
  ).unref();

  for (let i = 0; i < 30 && !(await pestanas()); i++) await pausa(1000, 1000);
  await pausa(5000, 7000);

  return Boolean(await pestanas());
}

export async function conecta() {
  let pag = (await pestanas()).find((p) => p.type === "page" && /\/\/(x|twitter)\.com/.test(p.url));

  if (!pag) {
    const nueva = await fetch(`http://127.0.0.1:${PUERTO}/json/new?${PERFIL_URL}`, { method: "PUT" });
    pag = await nueva.json();
    await pausa(6000, 8000);
  }

  const ws = new WebSocket(pag.webSocketDebuggerUrl);
  await new Promise((ok, mal) => {
    ws.onopen = ok;
    ws.onerror = mal;
  });

  let id = 0;
  const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      pend.get(m.id)(m);
      pend.delete(m.id);
    }
  };

  const manda = (method, params = {}, plazo = 60_000) =>
    new Promise((ok, mal) => {
      const i = ++id;
      const t = setTimeout(() => {
        pend.delete(i);
        mal(new Error("Chrome no contesta (plazo agotado)."));
      }, plazo);
      pend.set(i, (m) => {
        clearTimeout(t);
        if (m.error) mal(new Error(m.error.message));
        else ok(m.result);
      });
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  const evalua = async (expresion) => {
    const r = await manda("Runtime.evaluate", { expression: expresion, awaitPromise: true, returnByValue: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "Error en la página");
    return r?.result?.value;
  };

  const ve = async (url) => {
    await manda("Page.navigate", { url });
    await pausa(6000, 9000);
  };

  return { evalua, ve, cierra: () => ws.close() };
}

/** Lo que hace falta para saber si hay sesión o comprobación, sin bajar la página entera. */
export const MIRA_PAGINA = `(() => ({
  url: location.href,
  marcas: [...new Set([...document.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid")))].slice(0, 400)
    .map((t) => 'data-testid="' + t + '"').join(" ") +
    " " + [...document.querySelectorAll("iframe")].map((f) => f.src).join(" ")
}))()`;

export const ARTICULOS = `[...document.querySelectorAll('article[data-testid="tweet"]')].map((a) => a.outerHTML)`;

/* ------------------------------------------------------------------ */
/*  LEER                                                               */
/* ------------------------------------------------------------------ */

/** Una publicación que abre un hilo: se abre para juntar lo que sigue del mismo autor. */
const ABRE_HILO = /🧵|\b1\s*\/\s*\d+\b|\bhilo\b|\bthread\b|👇/i;

export async function leeX(vistos, cuenta, { dias: DIAS = 0, maxNuevos: MAX_NUEVOS = 15, hilos: HILOS = 2 } = {}) {
  PERFIL_URL = `https://x.com/${cuenta}`;
  const corte = DIAS ? Date.now() - DIAS * 86_400_000 : 0;
  paso(1, 4, "abriendo el Chrome de X");

  if (!(await abreChrome())) return { estado: "sin-chrome", detalle: "no encuentro Chrome o no arranca con el puerto de X" };

  const c = await conecta();

  try {
    await c.ve(PERFIL_URL);

    const pagina = await c.evalua(MIRA_PAGINA);

    if (X.pideComprobacion(pagina.url, pagina.marcas)) return { estado: "comprobacion", detalle: "X pide comprobación" };
    if (X.pideEntrar(pagina.url, pagina.marcas)) return { estado: "falta-sesion", detalle: "falta iniciar sesión en X" };

    paso(2, 4, `leyendo @${cuenta}${DIAS ? ` (los últimos ${DIAS} días)` : ""}`);

    const htmls = [];

    /* Dos o tres pantallas, como quien baja con la rueda; se para al llegar a lo ya visto. */
    /* Con --dias se baja hasta pasar la fecha de corte (como mucho 60 pantallas). */
    for (let vuelta = 0; vuelta < (DIAS ? 60 : 3); vuelta++) {
      htmls.push(...((await c.evalua(ARTICULOS)) ?? []));

      const hasta = X.postsDeArticulos(htmls, cuenta, Boolean(DIAS));
      if (DIAS) {
        if (hasta.some((p) => Date.parse(p.fecha) < corte) || hasta.length >= MAX_NUEVOS) break;
      } else if (hasta.some((p) => vistos.has(p.id)) || hasta.length >= MAX_NUEVOS) break;

      await c.evalua("window.scrollBy(0, Math.round(window.innerHeight * 1.6))");
      await pausa(3500, 6000);
    }

    let posts = X.postsDeArticulos(htmls, cuenta, Boolean(DIAS));
    if (DIAS) posts = posts.filter((p) => Date.parse(p.fecha) >= corte);

    console.log(`${posts.length} publicaciones a la vista`);

    /* Los hilos del propio autor: como mucho dos por pasada. */
    let hilos = 0;

    for (const p of posts) {
      if (vistos.has(p.id) || hilos >= HILOS || !ABRE_HILO.test(p.texto)) continue;

      hilos += 1;
      await pausa(2500, 4500);
      await c.ve(p.url);

      const conversacion = X.postsDeArticulos((await c.evalua(ARTICULOS)) ?? [], cuenta)
        .filter((q) => q.id !== p.id && Date.parse(q.fecha) >= Date.parse(p.fecha))
        .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
        .slice(0, 12);

      if (conversacion.length) {
        p.texto = [p.texto, ...conversacion.map((q) => q.texto)].join("\n\n").slice(0, 8000);
        p.imagenes = [...new Set([...(p.imagenes ?? []), ...conversacion.flatMap((q) => q.imagenes ?? [])])].slice(0, 6);
        console.log(`hilo ${p.id}: ${conversacion.length} más del mismo autor`);
      }
    }

    posts = posts.filter((p) => !vistos.has(p.id));

    return { estado: "ok", posts };
  } finally {
    c.cierra();
  }
}

