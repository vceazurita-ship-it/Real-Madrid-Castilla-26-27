/*
| CAPTURA DE INFORMES Y EXPORTABLES PARA LOS JUECES (06/11/2026)
|
|   node scripts/agentes/captura-exportables.cjs        (con next start -p 3124 en marcha)
|
| Deja en .cache/expertos/areas/informes/:
| - pizarra/…            el .zip «Solo documentos» de /abp-pizarra descomprimido
|                         (PDF general, PowerPoint y un PDF por jugador)
| - informe-abp-previa / informe-abp-post          (.jpg + .txt) /abp-microciclo
| - informe-partido-previa / informe-partido-post  (.jpg + .txt) /microcycles
| - medidas.json          errores de JS de cada pantalla
|
| NADA SALE NI SE ESCRIBE: toda petición que no sea una lectura se contesta en
| falso con {ok:true} (correos, WhatsApp, guardados, subidas).
*/
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..", "..");
const SALIDA = path.join(RAIZ, ".cache", "expertos", "areas", "informes");
const DESCARGAS = path.join(SALIDA, "_descargas");
const PUERTO = 9493;
const BASE = "http://localhost:3124";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* Lo que se deja pasar aunque no sea GET: lecturas. */
const esLectura = (url, metodo, cuerpo) =>
  metodo === "GET" ||
  /\/api\/(data-analisis|data-elite|visionados|youtube\/visionados|rivals|docs\?)/.test(url) && metodo === "GET" ||
  (/\/api\/registro/.test(url) && /"accion"\s*:\s*"(filas|lee|leer)"/.test(cuerpo || "")) ||
  /\/api\/(informe|abp)\/[^?]*(datos|paquete|carga|lee)/.test(url);

(async () => {
  fs.rmSync(SALIDA, { recursive: true, force: true });
  fs.mkdirSync(DESCARGAS, { recursive: true });
  const perfil = path.join(RAIZ, ".cache", "expertos", "perfil-exportables");
  fs.rmSync(perfil, { recursive: true, force: true });
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  let ws;
  for (let i = 0; i < 50 && !ws; i++) { await espera(300); try { const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json(); const p = l.find((x) => x.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} }
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pend = new Map(); let errores = []; const falsos = [];
  const envia = (method, params = {}) => new Promise((r) => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  ws.addEventListener("message", async (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") errores.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200));
    if (m.method === "Fetch.requestPaused") {
      const { requestId, request } = m.params;
      if (esLectura(request.url, request.method, request.postData)) return envia("Fetch.continueRequest", { requestId });
      falsos.push(`${request.method} ${request.url.replace(BASE, "")}`);
      envia("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify({ ok: true, success: true })).toString("base64") });
    }
  });
  const js = async (e) => (await envia("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
  const pulsa = (texto, exacto = false) => js(`(() => { const t = ${JSON.stringify(texto)}; const b = [...document.querySelectorAll("button,[role=button],[role=menuitem]")].find((x) => x.getBoundingClientRect().width > 0 && !x.disabled && (${exacto} ? x.innerText.trim().toLowerCase() === t.toLowerCase() : x.innerText.trim().toLowerCase().startsWith(t.toLowerCase()))); if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true; })()`);
  const hasta = async (expr, seg = 60) => { for (let i = 0; i < seg * 2; i++) { if (await js(expr)) return true; await espera(500); } return false; };
  const foto = async (nombre) => {
    const alto = await js(`Math.min(9000, Math.max(...[...document.querySelectorAll("[role=dialog], .modal-veil *")].map((d) => d.scrollHeight), document.documentElement.scrollHeight))`);
    await envia("Emulation.setDeviceMetricsOverride", { width: 1440, height: Math.max(1000, alto || 1000), deviceScaleFactor: 1, mobile: false });
    await espera(1500);
    const f = await envia("Page.captureScreenshot", { format: "jpeg", quality: 55, clip: { x: 0, y: 0, width: 1440, height: Math.max(1000, alto || 1000), scale: 0.6 } });
    fs.writeFileSync(path.join(SALIDA, `${nombre}.jpg`), Buffer.from(f.data, "base64"));
    const texto = await js(`(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); return (d || document.body).innerText; })()`);
    fs.writeFileSync(path.join(SALIDA, `${nombre}.txt`), String(texto || "").replace(/\n{3,}/g, "\n\n").slice(0, 30000));
    await envia("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  };

  await envia("Runtime.enable"); await envia("Page.enable");
  await envia("Fetch.enable", { patterns: [{ urlPattern: `${BASE}/api/*`, requestStage: "Request" }, { urlPattern: "*script.google.com*", requestStage: "Request" }, { urlPattern: "*googleapis.com/upload*", requestStage: "Request" }] });
  await envia("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DESCARGAS, eventsEnabled: true });
  await envia("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const medidas = [];

  /* 1. Pizarra de ABP: Exportar → Solo documentos (.zip). */
  errores = [];
  await envia("Page.navigate", { url: `${BASE}/abp-pizarra` });
  const lista = await hasta(`[...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Exportar")`, 90);
  console.log("pizarra lista:", lista);
  if (lista) {
    await pulsa("Exportar", true); await espera(800);
    console.log("solo documentos:", await pulsa("Solo documentos"));
    for (let i = 0; i < 360; i++) {
      await espera(1000);
      const zips = fs.readdirSync(DESCARGAS).filter((f) => /\.zip$/i.test(f));
      if (zips.length) { await espera(2000); break; }
    }
  }
  const zip = fs.readdirSync(DESCARGAS).find((f) => /\.zip$/i.test(f));
  if (zip) {
    const dest = path.join(SALIDA, "pizarra");
    fs.mkdirSync(dest, { recursive: true });
    execFileSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${path.join(DESCARGAS, zip)}' -DestinationPath '${dest}' -Force`]);
    console.log("zip:", zip);
  } else console.log("NO llegó el .zip de la pizarra");
  medidas.push({ ruta: "/abp-pizarra (Exportar → Solo documentos)", errores: errores.slice(0, 5) });

  /* 2. Informe de ABP de la semana: previa y post. */
  for (const [ruta, boton, pestanas, prefijo] of [
    ["/abp-microciclo", "Informe de la semana", ["Previa del partido", "Post partido"], "informe-abp"],
    ["/microcycles", "Informe del partido", ["Previa", "Post partido"], "informe-partido"],
  ]) {
    errores = [];
    await envia("Page.navigate", { url: `${BASE}${ruta}` });
    const hay = await hasta(`[...document.querySelectorAll("button")].some((b) => !b.disabled && b.innerText.includes(${JSON.stringify(boton)}))`, 150);
    console.log(ruta, "botón:", hay);
    if (!hay) continue;
    await pulsa(boton); await espera(30000);
    for (const p of pestanas) {
      console.log("  pestaña", p, await pulsa(p, true));
      await espera(15000);
      await foto(`${prefijo}-${/post/i.test(p) ? "post" : "previa"}`);
    }
    medidas.push({ ruta: `${ruta} (${boton})`, errores: errores.slice(0, 5) });
  }

  fs.writeFileSync(path.join(SALIDA, "medidas.json"), JSON.stringify({ pantallas: medidas, peticionesContestadasEnFalso: [...new Set(falsos)].slice(0, 40) }, null, 1));
  console.log("ficheros:", fs.readdirSync(SALIDA).join(", "));
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
