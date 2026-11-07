/*
| Captura del grupo «mejora» para los jueces (05/11/2026): la pestaña «Área de
| mejora» de una ficha de /individual (dentro de un modal, que captura-areas no
| abre) y el panel de equipo de Data análisis. Mismo formato que captura-areas:
| <nombre>-escritorio.jpg, <nombre>-movil.jpg, <nombre>.txt y medidas.json.
|
|   node scripts/agentes/captura-mejora.cjs [Jugador]     (por defecto Fortuny)
|
| Necesita `next start -p 3124` en marcha.
*/
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..", "..");
const SALIDA = path.join(RAIZ, ".cache", "expertos", "areas", "mejora");
const PUERTO = 9479;
const JUGADOR = process.argv[2] || "Fortuny";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const perfil = path.join(RAIZ, ".cache", "expertos", "perfil-mejora");
  fs.rmSync(perfil, { recursive: true, force: true });
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=" + PUERTO, "--user-data-dir=" + perfil, "about:blank"], { stdio: "ignore", windowsHide: true });
  let ws;
  for (let i = 0; i < 40 && !ws; i++) { await espera(300); try { const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json(); const p = l.find((x) => x.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} }
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pend = new Map(); let errores = [];
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errores.push(m.params.exceptionDetails.exception?.description?.slice(0, 200)); });
  const envia = (method, params = {}) => new Promise((r) => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const js = async (expr) => (await envia("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
  await envia("Runtime.enable"); await envia("Page.enable");

  const medidas = [];
  const pantallas = [
    {
      nombre: "individual-area-de-mejora",
      ruta: "/individual",
      prepara: async () => {
        for (let i = 0; i < 25; i++) { await espera(1500); if (await js(`[...document.querySelectorAll("button")].some((x) => x.querySelector("h3") && x.innerText.includes(${JSON.stringify(JUGADOR)}))`)) break; }
        /* Con reintentos (07/11/2026): el clic antes de hidratar no abría la ficha y los jueces juzgaban la lista. */
        for (let k = 0; k < 6; k++) {
          await js(`[...document.querySelectorAll("button")].find((x) => x.querySelector("h3") && x.innerText.includes(${JSON.stringify(JUGADOR)}))?.click()`);
          await espera(2500);
          if (await js(`[...document.querySelectorAll("button")].some((x) => x.innerText.trim().toLowerCase() === "área de mejora")`)) break;
        }
        await js(`[...document.querySelectorAll("button")].find((x) => x.innerText.trim().toLowerCase() === "área de mejora")?.click()`);
        /* Hasta que salga el bloque de la élite (o 40 s). */
        for (let k = 0; k < 20; k++) { await espera(2000); if (await js(`document.body.innerText.toLowerCase().includes("cara a cara con la élite")`)) break; }
        await espera(2000);
      },
      texto: `(() => { const t = [...document.querySelectorAll("[role=dialog], .modal-veil, [aria-modal=true]")].pop(); return (t || document.body).innerText; })()`,
    },
    {
      nombre: "data-analisis-equipo",
      ruta: "/data-analisis?area=equipo",
      prepara: async () => { await espera(16000); },
      texto: `(document.querySelector("main") || document.body).innerText`,
    },
  ];

  for (const p of pantallas) {
    const m = { ruta: p.ruta };
    for (const movil of [false, true]) {
      errores = [];
      /* Alto de tres pantallas: el modal crece con la ventana y se ve la pestaña entera. */
      await envia("Emulation.setDeviceMetricsOverride", movil ? { width: 390, height: 2500, deviceScaleFactor: 1, mobile: true } : { width: 1440, height: 2700, deviceScaleFactor: 1, mobile: false });
      await envia("Page.navigate", { url: `http://localhost:3124${p.ruta}` });
      await p.prepara();
      const ancho = await js("document.documentElement.scrollWidth");
      const f = await envia("Page.captureScreenshot", { format: "jpeg", quality: 55, clip: { x: 0, y: 0, width: movil ? 390 : 1440, height: movil ? 2500 : 2700, scale: movil ? 1 : 0.6 } });
      fs.writeFileSync(path.join(SALIDA, `${p.nombre}-${movil ? "movil" : "escritorio"}.jpg`), Buffer.from(f.data, "base64"));
      if (!movil) fs.writeFileSync(path.join(SALIDA, `${p.nombre}.txt`), String(await js(p.texto)).replace(/\n{3,}/g, "\n\n").slice(0, 12000));
      m[movil ? "movil" : "escritorio"] = { desborde: movil ? Math.max(0, ancho - 390) : 0, errores: errores.slice(0, 5) };
      console.log(p.nombre, movil ? "móvil" : "escritorio", "ancho", ancho, "errores", errores.length);
    }
    medidas.push(m);
  }
  fs.writeFileSync(path.join(SALIDA, "medidas.json"), JSON.stringify(medidas, null, 1));
  chrome.kill();
  process.exit(0);
})();
