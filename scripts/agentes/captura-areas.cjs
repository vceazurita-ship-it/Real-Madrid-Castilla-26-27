/*
 * Material para que el equipo de expertos puntúe la APP por áreas (23/10/2026).
 * Cada pantalla del menú, en escritorio (1440, modo día) y en el móvil (390),
 * con su texto visible y sus medidas (errores de JS, desborde en el móvil,
 * textos con contraste < 2,5). Toda petición que no sea GET se contesta «ok»
 * sin salir: no escribe en Supabase, la hoja ni Gmail.
 *
 * Necesita la app servida en el puerto 3124 (next build && next start -p 3124).
 *   node scripts/agentes/captura-areas.cjs [grupo|ruta …]
 * Deja .cache/expertos/areas/<grupo>/<pantalla>-{escritorio,movil}.jpg,
 * <pantalla>.txt y medidas.json.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const DIR = path.join(RAIZ, ".cache", "expertos", "areas");
const BASE = "http://127.0.0.1:3124";

const GRUPOS = {
  portada: ["/", "/alertas", "/general"],
  planificacion: ["/microcycles", "/micro_calendar", "/laboratorio/microciclo", "/jugadores-sesion", "/analisis-entrenamiento", "/calendar_general", "/desplazamiento"],
  rival: ["/rivals", "/scout-rival-collective", "/scout-rival-individual", "/scout-rival-abp", "/scout-rival-area", "/match-preparation", "/duelos", "/pizarra-tactica"],
  abp: ["/setpieces", "/setpieces_def", "/throw-ins", "/throw-ins-def", "/abp-microciclo", "/abp-pizarra"],
  partido: ["/coding", "/match-plans", "/laboratorio/transiciones", "/laboratorio/perdidas", "/laboratorio/faltas", "/analisis-goles", "/collective_history", "/data-analisis"],
  jugadores: ["/individual", "/dashboard-plantilla", "/ratings", "/calendar", "/individual_proc", "/comparative_ind", "/emotion"],
  identidad: ["/game-model", "/identidad-posicional", "/team-values", "/identidad-cultura"],
  club: ["/laboratorio/escudos", "/quiniela", "/laboratorio/apuestas"],
};
module.exports = { GRUPOS };
if (require.main !== module) return;

const pedidos = process.argv.slice(2);
const tareas = Object.entries(GRUPOS).flatMap(([g, rutas]) => rutas.map((r) => ({ g, r })))
  .filter(({ g, r }) => !pedidos.length || pedidos.includes(g) || pedidos.includes(r));

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const MIDE = `(() => {
  const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgba = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const fondo = (el) => { let capas = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 0.95) break; } if (getComputedStyle(e).backgroundImage !== "none") return null; } capas.reverse(); let r = 255, g = 255, b = 255; if (capas.length && capas[0].a >= 0.95) { ({ r, g, b } = capas[0]); capas = capas.slice(1); } for (const c of capas) { r = r * (1 - c.a) + c.r * c.a; g = g * (1 - c.a) + c.g * c.a; b = b * (1 - c.a) + c.b * c.a; } return { r, g, b }; };
  const malos = [];
  let revisados = 0;
  for (const el of document.querySelectorAll("main *")) {
    if (revisados > 4000) break;
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (!texto || texto.length < 2) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || +cs.opacity < 0.5 || el.closest("[aria-hidden=true],svg,canvas")) continue;
    revisados++;
    const c = rgba(cs.color); const f = fondo(el);
    if (!c || !f || c.a < 0.35) continue;
    const cr = c.r * c.a + f.r * (1 - c.a), cg = c.g * c.a + f.g * (1 - c.a), cb = c.b * c.a + f.b * (1 - c.a);
    const ratio = (Math.max(lum(cr, cg, cb), lum(f.r, f.g, f.b)) + 0.05) / (Math.min(lum(cr, cg, cb), lum(f.r, f.g, f.b)) + 0.05);
    if (ratio < 2.5) malos.push(ratio.toFixed(2) + " «" + texto.slice(0, 40) + "»");
  }
  const main = document.querySelector("main") ?? document.body;
  return { ancho: document.documentElement.scrollWidth, vista: innerWidth, malos: malos.length, ejemplos: malos.slice(0, 5), texto: main.innerText.replace(/\\n{3,}/g, "\\n\\n").slice(0, 9000) };
})()`;

(async () => {
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=9336", "--window-size=1440,1000", "--user-data-dir=" + path.join(RAIZ, ".cache", "expertos", "perfil-chrome"), "about:blank"], { stdio: "ignore", windowsHide: true });
  let ws;
  for (let i = 0; i < 40 && !ws; i++) {
    await espera(500);
    try { const l = await (await fetch("http://127.0.0.1:9336/json")).json(); const p = l.find((x) => x.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {}
  }
  let id = 0;
  const pend = new Map();
  const envia = (method, params = {}) => new Promise((res) => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
  let errores = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result ?? d.error); pend.delete(d.id); }
    if (d.method === "Fetch.requestPaused") {
      const r = d.params.request;
      if (!["GET", "HEAD", "OPTIONS"].includes(r.method)) envia("Fetch.fulfillRequest", { requestId: d.params.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from('{"success":true,"ok":true}').toString("base64") });
      else envia("Fetch.continueRequest", { requestId: d.params.requestId });
    }
    if (d.method === "Runtime.exceptionThrown") errores.push("EXC " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).split("\n")[0].slice(0, 160));
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errores.push("console " + d.params.args.map((a) => a.value ?? a.description).join(" ").split("\n")[0].slice(0, 160));
  };
  await new Promise((r) => (ws.onopen = r));
  await envia("Runtime.enable");
  await envia("Page.enable");
  await envia("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await envia("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("rmcf-theme","light")}catch(e){}` });

  const medidas = {};
  for (const { g, r } of tareas) {
    const carpeta = path.join(DIR, g);
    fs.mkdirSync(carpeta, { recursive: true });
    const nombre = r === "/" ? "portada" : r.slice(1).replace(/[/?=&]/g, "_");
    const fila = { ruta: r };
    for (const modo of ["escritorio", "movil"]) {
      errores = [];
      const movil = modo === "movil";
      await envia("Emulation.setDeviceMetricsOverride", movil ? { width: 390, height: 844, deviceScaleFactor: 1, mobile: true } : { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
      await envia("Page.navigate", { url: BASE + r });
      await espera(movil ? 7000 : 11000);
      const v = (await envia("Runtime.evaluate", { expression: MIDE, returnByValue: true }))?.result?.value ?? {};
      /* Página entera hasta 3 pantallas de alto, para que se vea más que la cabecera. */
      const alto = Math.min(movil ? 2500 : 3000, (await envia("Runtime.evaluate", { expression: "document.documentElement.scrollHeight", returnByValue: true }))?.result?.value ?? 1000);
      const foto = await envia("Page.captureScreenshot", { format: "jpeg", quality: 50, captureBeyondViewport: true, clip: { x: 0, y: 0, width: movil ? 390 : 1440, height: alto, scale: movil ? 1 : 0.6 } });
      if (foto?.data) fs.writeFileSync(path.join(carpeta, `${nombre}-${modo}.jpg`), Buffer.from(foto.data, "base64"));
      if (!movil) fs.writeFileSync(path.join(carpeta, `${nombre}.txt`), v.texto ?? "");
      fila[modo] = { contraste: v.malos ?? "?", ejemplos: v.ejemplos ?? [], errores: [...new Set(errores)].slice(0, 5), ...(movil && v.ancho > v.vista + 2 ? { desborde: `${v.ancho}/${v.vista}` } : {}) };
    }
    (medidas[g] ??= []).push(fila);
    console.log(g, r, JSON.stringify(fila.escritorio.errores), fila.movil.desborde ?? "");
  }
  for (const [g, filas] of Object.entries(medidas)) {
    const f = path.join(DIR, g, "medidas.json");
    const antes = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).filter((x) => !filas.some((y) => y.ruta === x.ruta)) : [];
    fs.writeFileSync(f, JSON.stringify([...antes, ...filas], null, 1));
  }
  try { process.kill(chrome.pid); } catch {}
  spawn("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore", windowsHide: true });
  process.exit(0);
})();
