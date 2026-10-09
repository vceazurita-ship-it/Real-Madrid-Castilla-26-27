/**
 * EL CHROME DEL CLUB, PARA HUDL.
 *
 * Hudl no pide contraseña aparte: el perfil de Chrome de Wyscout
 * (`%LOCALAPPDATA%\rmcf-wyscout`, puerto 9333) con las cookies guardadas en
 * `.cache/wyscout/sesion.json` ya entra en hudl.com con acceso a todos los
 * equipos de la cantera (29/09/2026). Es el mismo perfil y el mismo puerto que
 * usa `wyscout-liga.mjs`, así que **no pueden correr a la vez**: el vigía no
 * lanza el análisis del partido mientras baja Wyscout, ni al revés.
 *
 * Abre una pestaña propia, repone las cookies y al cerrar las vuelve a guardar
 * (la cookie de Hudl es de sesión: Chrome la tira al salir). Si el Chrome lo
 * ha abierto este script, lo cierra al acabar; si ya estaba, lo deja.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { esperaTurno, sueltaTurno } from "./chrome-turno.mjs";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const PERFIL = path.join(
  process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Local"),
  "rmcf-wyscout",
);

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((ruta) => fs.existsSync(ruta));

const PUERTO = 9333;

/** Es una credencial: no sale de este ordenador (`.cache/` está ignorado). */
const FICHERO_SESION = path.join(RAIZ, ".cache", "wyscout", "sesion.json");

const DOMINIOS_SESION = /(^|\.)(hudl|wyscout)\.com$/i;

export const espera = (ms) => new Promise((listo) => setTimeout(listo, ms));

async function pestanas() {
  try {
    return await fetch(`http://127.0.0.1:${PUERTO}/json`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json());
  } catch {
    return null;
  }
}

/**
 * Conecta con Chrome (abriéndolo si hace falta) en una pestaña nueva.
 *
 * Devuelve `manda` (CDP), `js`, `al(metodo, fn)` para escuchar eventos y
 * `cierra()`, que guarda las cookies y deja Chrome como estaba.
 */
export async function abreHudl() {
  /* Por turnos con la descarga de Wyscout: mismo perfil y mismo puerto. */
  if (!(await esperaTurno("Hudl (análisis del partido)"))) {
    throw new Error("el Chrome del club lleva más de hora y media ocupado con otra cosa");
  }

  let loAbrimos = false;

  if (!(await pestanas())) {
    if (!CHROME) throw new Error("No encuentro Chrome en Program Files.");

    spawn(
      CHROME,
      [
        `--remote-debugging-port=${PUERTO}`,
        `--user-data-dir=${PERFIL}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1600,1000",
        "about:blank",
      ],
      { stdio: "ignore", detached: true },
    ).unref();

    loAbrimos = true;

    for (let i = 0; i < 60 && !(await pestanas()); i++) await espera(500);

    if (!(await pestanas())) throw new Error("Chrome no ha abierto el puerto de mando.");
  }

  const nueva = await fetch(`http://127.0.0.1:${PUERTO}/json/new?about:blank`, { method: "PUT", signal: AbortSignal.timeout(15_000) }).then(
    (r) => r.json(),
  );

  const ws = new WebSocket(nueva.webSocketDebuggerUrl);

  await new Promise((listo, falla) => {
    ws.onopen = listo;
    ws.onerror = () => falla(new Error("No se puede hablar con la pestaña de Chrome."));
  });

  let n = 0;
  const pendientes = new Map();
  const oyentes = new Map();

  ws.onmessage = (e) => {
    const dato = JSON.parse(e.data);

    if (dato.id && pendientes.has(dato.id)) {
      pendientes.get(dato.id)(dato);
      pendientes.delete(dato.id);
    }

    if (dato.method) for (const fn of oyentes.get(dato.method) ?? []) fn(dato.params);
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

  const al = (metodo, fn) => oyentes.set(metodo, [...(oyentes.get(metodo) ?? []), fn]);

  const js = async (codigo) => {
    const r = await manda("Runtime.evaluate", {
      expression: `(async () => { ${codigo} })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    return r.result?.value;
  };

  await manda("Network.enable", { maxResourceBufferSize: 50_000_000, maxTotalBufferSize: 200_000_000 });
  await manda("Page.enable");

  /* Las cookies guardadas, antes de pedir nada. */
  try {
    const { cookies } = JSON.parse(fs.readFileSync(FICHERO_SESION, "utf8"));

    await manda("Network.setCookies", {
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        ...(c.expires && c.expires > 0 ? { expires: c.expires } : {}),
      })),
    });
  } catch {
    /* sin fichero: si el perfil ya está dentro, vale igual */
  }

  async function cierra() {
    try {
      const { cookies } = await manda("Network.getAllCookies");

      const nuestras = (cookies ?? []).filter((c) =>
        DOMINIOS_SESION.test(String(c.domain ?? "").replace(/^\./, "")),
      );

      if (nuestras.length) {
        fs.mkdirSync(path.dirname(FICHERO_SESION), { recursive: true });
        fs.writeFileSync(
          FICHERO_SESION,
          JSON.stringify({ guardadoEn: new Date().toISOString(), cookies: nuestras }),
          "utf8",
        );
      }
    } catch {
      /* lo peor que pasa es que la próxima vez haya que reponerlas de antes */
    }

    try {
      if (loAbrimos) await manda("Browser.close", {}, 5000);
      else await fetch(`http://127.0.0.1:${PUERTO}/json/close/${nueva.id}`, { signal: AbortSignal.timeout(15_000) });
    } catch {
      /* ya cerrado */
    }

    try {
      ws.close();
    } catch {
      /* nada */
    }

    sueltaTurno();
  }

  return { manda, js, al, cierra };
}

/**
 * Las cookies de Hudl para un recurso, en forma de cabecera.
 *
 * Los trozos del vídeo van firmados con cookies de CloudFront: sin ellas, 403.
 * Se quedan en memoria, nunca en disco.
 */
export async function cabecerasPara(nav, url) {
  const { cookies } = await nav.manda("Network.getCookies", { urls: [url] });

  return {
    Cookie: (cookies ?? []).map((c) => `${c.name}=${c.value}`).join("; "),
    Referer: "https://www.hudl.com/",
  };
}
