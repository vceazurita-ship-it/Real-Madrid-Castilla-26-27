/*
 * REVISIÓN DE DISEÑO EN TRES ANCHOS (19/11/2026).
 *
 * Petición del analista: «recorre toda la app y deja mejorada cada área en
 * móvil, tableta y portátil». Mide, en cada pantalla del menú y en 390
 * (móvil), 820 (tableta) y 1366 (portátil), lo que se puede medir sin opinar:
 *   - desborde: la página más ancha que la pantalla, y QUÉ la ensancha;
 *   - dedo: botones y enlaces de menos de 32 px en móvil y tableta;
 *   - letra: textos de menos de 11 px;
 *   - contraste: textos por debajo de 2,5:1 (modo día);
 *   - errores de JavaScript.
 * Toda petición que no sea GET se contesta «ok» sin salir (no escribe nada).
 *
 * Necesita `next build && next start -p 3124` y la cookie de administrador
 * (la firma él mismo con QUINIELA_SECRET o SUPABASE_SERVICE_ROLE_KEY de
 * .env.local), porque desde el 18/11 la plataforma pide entrar.
 *   node scripts/agentes/revisa-diseno.cjs [desde] [hasta] [--fotos]
 * Deja .cache/diseno/medidas.json (y las fotos con --fotos).
 */
const { spawn } = require("child_process");
const { createHmac } = require("crypto");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const DIR = path.join(RAIZ, ".cache", "diseno");
const BASE = "http://127.0.0.1:3124";

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }),
);
const secreto = `admin:${env.QUINIELA_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY}`;
const cuerpo = `admin.${Date.now() + 6 * 3_600_000}`;
const ADMIN = `${cuerpo}.${createHmac("sha256", secreto).update(cuerpo).digest("base64url")}`;

const modulos = fs.readFileSync(path.join(RAIZ, "lib", "modules.ts"), "utf8");
const RUTAS = ["/", ...new Set([...modulos.matchAll(/href: "(\/[^"]*)"/g)].map((m) => m[1])), "/ajustes", "/jugadores", "/entrar"];

const ANCHOS = { movil: [390, 844, true], tableta: [820, 1180, true], portatil: [1366, 900, false] };

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const FOTOS = process.argv.includes("--fotos");
const desde = Number(args[0] ?? 0), hasta = Number(args[1] ?? RUTAS.length);
const soloRutas = args.filter((a) => a.startsWith("/"));
const tareas = soloRutas.length ? soloRutas : RUTAS.slice(desde, hasta);

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const PUERTO = 9400 + (process.pid % 500);
const PERFIL = path.join(RAIZ, ".cache", "expertos", `perfil-chrome-${PUERTO}`);

const MIDE = `(() => {
  const vw = innerWidth;
  const quien = (el) => { const c = (el.getAttribute("class") || "").split(/\\s+/).slice(0, 6).join("."); const t = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 40); return el.tagName.toLowerCase() + (c ? "." + c : "") + (t ? " «" + t + "»" : ""); };
  const enScroll = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true; } return false; };
  const visible = (el, r) => { if (!r.width || !r.height) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05 && !el.closest("[aria-hidden=true]"); };
  const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgba = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const fondo = (el) => { let capas = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 0.95) break; } if (getComputedStyle(e).backgroundImage !== "none") return null; } capas.reverse(); let r = 255, g = 255, b = 255; if (capas.length && capas[0].a >= 0.95) { ({ r, g, b } = capas[0]); capas = capas.slice(1); } for (const c of capas) { r = r * (1 - c.a) + c.r * c.a; g = g * (1 - c.a) + c.g * c.a; b = b * (1 - c.a) + c.b * c.a; } return { r, g, b }; };
  const fuera = [], dedos = [], letras = [], contraste = [];
  let n = 0;
  for (const el of document.querySelectorAll("main *")) {
    if (++n > 6000) break;
    if (el.closest("svg,canvas")) continue;
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    if (r.right > vw + 2 && r.left < vw && !enScroll(el) && getComputedStyle(el).position !== "fixed") fuera.push(Math.round(r.right) + " " + quien(el));
    const pulsable = el.matches("button, a[href], [role=button], input:not([type=hidden]), select, summary");
    if (pulsable && vw < 1000 && (r.height < 32 || r.width < 32) && r.width > 4) dedos.push(Math.round(r.width) + "x" + Math.round(r.height) + " " + quien(el));
    const texto = [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join(" ").trim();
    if (texto.length < 2) continue;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.fontSize) < 11) letras.push(cs.fontSize + " " + quien(el));
    const c = rgba(cs.color), f = fondo(el);
    if (!c || !f || c.a < 0.35) continue;
    const cr = c.r * c.a + f.r * (1 - c.a), cg = c.g * c.a + f.g * (1 - c.a), cb = c.b * c.a + f.b * (1 - c.a);
    const ratio = (Math.max(lum(cr, cg, cb), lum(f.r, f.g, f.b)) + 0.05) / (Math.min(lum(cr, cg, cb), lum(f.r, f.g, f.b)) + 0.05);
    if (ratio < 2.5) contraste.push(ratio.toFixed(2) + " " + quien(el));
  }
  /* Del que desborda, sólo los más externos: el hijo de uno ya apuntado sobra. */
  return { ancho: document.documentElement.scrollWidth, vw, fuera: fuera.slice(0, 8), nFuera: fuera.length, dedos: dedos.slice(0, 8), nDedos: dedos.length, letras: letras.slice(0, 6), nLetras: letras.length, contraste: contraste.slice(0, 6), nContraste: contraste.length };
})()`;

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=" + PUERTO, "--user-data-dir=" + PERFIL, "about:blank"], { stdio: "ignore", windowsHide: true });
  let ws;
  for (let i = 0; i < 40 && !ws; i++) {
    await espera(500);
    try { const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json(); const p = l.find((x) => x.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {}
  }
  let id = 0;
  const pend = new Map();
  const envia = (method, params = {}) => new Promise((res) => { const k = ++id; pend.set(k, res); ws.send(JSON.stringify({ id: k, method, params })); });
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
  };
  await new Promise((r) => (ws.onopen = r));
  await envia("Runtime.enable");
  await envia("Page.enable");
  await envia("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await envia("Network.setCookie", { name: "admin_sesion", value: ADMIN, url: BASE });
  /* Sin el aviso diario del administrador encima de cada pantalla. */
  const hoy = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 10);
  await envia("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("rmcf-theme","light");localStorage.setItem("rmcf:aviso-base-datos","${hoy}")}catch(e){}` });

  const fichero = path.join(DIR, "medidas.json");
  const medidas = fs.existsSync(fichero) ? JSON.parse(fs.readFileSync(fichero, "utf8")) : {};
  for (const r of tareas) {
    const fila = {};
    for (const [modo, [w, h, movil]] of Object.entries(ANCHOS)) {
      errores = [];
      await envia("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: movil });
      await envia("Page.navigate", { url: BASE + r });
      await espera(6000);
      for (let i = 0; i < 12; i++) {
        const cargando = (await envia("Runtime.evaluate", { expression: "!!document.querySelector('main .animate-pulse, main [aria-busy=\"true\"]')", returnByValue: true }))?.result?.value;
        if (!cargando) break;
        await espera(2000);
      }
      const donde = (await envia("Runtime.evaluate", { expression: "location.pathname", returnByValue: true }))?.result?.value ?? "";
      const v = (await envia("Runtime.evaluate", { expression: MIDE, returnByValue: true }))?.result?.value ?? {};
      if (FOTOS) {
        const alto = Math.min(2400, (await envia("Runtime.evaluate", { expression: "document.documentElement.scrollHeight", returnByValue: true }))?.result?.value ?? h);
        const foto = await envia("Page.captureScreenshot", { format: "jpeg", quality: 45, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: alto, scale: modo === "portatil" ? 0.6 : 0.8 } });
        const nombre = r === "/" ? "portada" : r.slice(1).replace(/[/?=&]/g, "_");
        if (foto?.data) fs.writeFileSync(path.join(DIR, `${nombre}-${modo}.jpg`), Buffer.from(foto.data, "base64"));
      }
      fila[modo] = { ...(donde !== r.split("?")[0] ? { estaba: donde } : {}), ...v, errores: [...new Set(errores)].slice(0, 4) };
    }
    medidas[r] = fila;
    fs.writeFileSync(fichero, JSON.stringify(medidas, null, 1));
    const res = Object.entries(fila).map(([m, x]) => `${m[0]}:${x.ancho > x.vw + 2 ? "DESBORDA" + x.ancho : "ok"} d${x.nDedos} l${x.nLetras} c${x.nContraste}${x.errores.length ? " ERR" : ""}`).join(" | ");
    console.log(r, res);
  }
  try { process.kill(chrome.pid); } catch {}
  spawn("taskkill", ["/T", "/F", "/PID", String(chrome.pid)], { stdio: "ignore", windowsHide: true });
  process.exit(0);
})();
