/**
 * CONSULTAS A OPTA DESDE EL CHROME DEL CLUB (24/11/2026).
 *
 * Lo mínimo para preguntar a ProVision (SSQL por /dp-proxy) y pedir el vídeo
 * de un momento (/vod-url) desde la pestaña de Opta del Chrome del club
 * (puerto 9335, perfil rmcf-opta, con su sesión: no se teclea contraseña).
 * Lo usa scripts/opta-clips-jugador.mjs; los scripts de antes llevan su copia.
 *
 *   const opta = await conectaOpta();          // null si no hay pestaña viva
 *   const t = await opta.consulta(sql, { sseas: [id] }, "team t");
 *   const url = await opta.video({ partido, fecha, parte, segundo, tipo }, antes, despues);
 *   opta.cierra();
 */
export const PUERTO_OPTA = 9335;

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function pestanas() {
  try {
    return await (await fetch(`http://127.0.0.1:${PUERTO_OPTA}/json/list`)).json();
  } catch {
    return null;
  }
}

export async function conectaOpta() {
  const lista = ((await pestanas()) ?? []).filter((t) => t.type === "page" && t.url.includes("trumedia")).reverse();
  for (const p of lista) {
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    try {
      await new Promise((ok, mal) => {
        ws.onopen = ok;
        ws.onerror = mal;
        setTimeout(() => mal(new Error("sin conexión")), 10_000);
      });
    } catch {
      continue;
    }
    let n = 0;
    const pendientes = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      pendientes.get(d.id)?.(d);
      pendientes.delete(d.id);
    };
    ws.onclose = () => {
      for (const r of pendientes.values()) r({ error: { message: "conexión cerrada" } });
      pendientes.clear();
    };
    const evalua = (expr, tope = 240_000) =>
      new Promise((ok) => {
        const i = ++n;
        const t = setTimeout(() => {
          pendientes.delete(i);
          ok({ error: { message: `la pestaña de Opta no contesta en ${tope / 1000} s` } });
        }, tope);
        pendientes.set(i, (d) => {
          clearTimeout(t);
          ok(d);
        });
        if (ws.readyState !== 1) {
          clearTimeout(t);
          pendientes.delete(i);
          ok({ error: { message: "conexión cerrada" } });
          return;
        }
        ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } }));
      });
    const vive = await evalua("1", 10_000);
    if (vive.error) {
      ws.close();
      continue;
    }

    const pide = async (ruta, cuerpo) => {
      const d = await evalua(
        `fetch(${JSON.stringify(ruta)}, ${JSON.stringify({ method: cuerpo ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })}).then(async (r) => [r.status, r.headers.get("content-type") || "", await r.text()]).catch((e) => [0, "", String(e)])`,
      );
      const [status, tipo, texto] = d.result?.result?.value ?? [0, "", d.error?.message ?? ""];
      return { status, tipo, texto };
    };

    const consulta = async (statement, f, tabla) => {
      const descriptor = JSON.stringify({
        namespaces: ["f", "pc"], sport: "SOCCER", siteName: "realmadrid", f,
        pc: { sgbps: "totals", ssv: "totals", strp: "standard", stc: ["total"], pcspco: [] },
        queryByGameCheck: true, restrictiveEventCheck: true,
      });
      const r = await pide("/dp-proxy", { format: "MIXED", statement, descriptor, entityData: { modalIdClause: "TRUE", entityClause: "TRUE", entityTable: tabla }, site: "realmadrid" });
      if (r.status === 401 || r.status === 403 || (r.status === 200 && !r.tipo.includes("json"))) throw Object.assign(new Error("la sesión de Opta ha caducado"), { sesion: true });
      if (r.status !== 200) throw new Error(`Opta rechaza la consulta (${r.status}): ${r.texto.slice(0, 200)}`);
      const j = JSON.parse(r.texto);
      const d = j._data ?? j;
      return { cols: d.header.map((h) => h.columnId), filas: d.rows.map((f) => f.map((v) => (Array.isArray(v) ? v[1] : v))) };
    };

    /** La temporada de una competición (por nombre, sin tildes). */
    const temporada = async (liga = "Primera División RFEF") => {
      const r = await pide("/dp/descriptor/query?name=queryFindSeasons&isOpponent=false&reportType=summary&site=realmadrid");
      const filas = JSON.parse(r.texto)._data.rows;
      const llano = (v) => String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const t = filas.filter((x) => llano(x[3]) === llano(liga)).sort((a, b) => String(b[5]).localeCompare(String(a[5])))[0];
      if (!t) throw new Error(`No encuentro ${liga} en Opta.`);
      return t[0];
    };

    /** El HLS de un momento, como lo pide el reproductor de ProVision. Si no acepta el tipo, «Pass». */
    const video = async (a, antes, despues, playType = a.tipo || "Pass") => {
      const cuerpo = {
        period: a.parte, gameClock: a.segundo, gameDate: a.fecha, playType, gameId: a.partido,
        numberOfPeriods: 2, periodLength: 45, preEventOffset: -antes, postEventOffset: despues, eventMetaData: {},
      };
      const r = await pide("/vod-url", cuerpo);
      if (r.status === 401 || r.status === 403) return { sesion: true };
      try {
        const j = r.status === 200 ? JSON.parse(r.texto) : null;
        if (j?.url) return { url: j.url };
      } catch {
        if (/login|sign in/i.test(r.texto)) return { sesion: true };
      }
      return playType !== "Pass" ? video(a, antes, despues, "Pass") : { error: `sin vídeo (${r.status})` };
    };

    return { consulta, temporada, video, cierra: () => ws.close() };
  }
  return null;
}

/** Abre el Chrome de Opta con su perfil si está cerrado (la sesión vive en el perfil). */
export async function abreChromeOpta() {
  if ((await pestanas())?.some((t) => t.type === "page" && t.url.includes("trumedia"))) return true;
  const fs = await import("node:fs");
  const { spawn } = await import("node:child_process");
  const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((r) => fs.existsSync(r));
  if (!chrome) return false;
  spawn(chrome, [`--remote-debugging-port=${PUERTO_OPTA}`, `--user-data-dir=${process.env.LOCALAPPDATA}\\rmcf-opta`, "--no-first-run", "--no-default-browser-check", "--window-size=1500,950", "https://realmadrid.opta.trumediasports.com/soccer/league-tables"], { stdio: "ignore", detached: true }).unref();
  for (let i = 0; i < 40; i++) {
    if ((await pestanas())?.some((t) => t.type === "page" && t.url.includes("trumedia"))) {
      await espera(8000);
      return true;
    }
    await espera(1000);
  }
  return false;
}
