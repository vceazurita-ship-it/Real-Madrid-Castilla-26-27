/**
 * Arranca `public/sw.js` con unos globales de navegador de mentira y comprueba
 * qué peticiones toca, cuáles deja pasar y qué sirve cuando no hay red.
 *
 *   node scripts/sw-harness.mjs      (desde la raíz del proyecto)
 *
 * Lo que de verdad se rompe al tocar el trabajador no es la sintaxis: es la
 * lista de lo que se guarda. Un día se cachea sin querer la relectura que
 * comprueba un guardado y la app empieza a jurar que no se ha guardado algo
 * que sí está en la hoja. Eso es lo que vigila esto.
 */
import fs from "node:fs";
import vm from "node:vm";

const ORIGEN = "https://castilla.app";

function nuevoEntorno() {
  const almacen = new Map(); // nombre de caché -> Map(url -> Response)

  const abrir = (nombre) => {
    if (!almacen.has(nombre)) almacen.set(nombre, new Map());
    const c = almacen.get(nombre);
    return Promise.resolve({
      put: (pet, res) => { c.set(typeof pet === "string" ? new URL(pet, ORIGEN).href : pet.url, res); return Promise.resolve(); },
      match: (pet) => Promise.resolve(c.get(typeof pet === "string" ? new URL(pet, ORIGEN).href : pet.url)),
    });
  };

  const caches = {
    open: abrir,
    keys: () => Promise.resolve([...almacen.keys()]),
    delete: (n) => Promise.resolve(almacen.delete(n)),
    match: (pet) => {
      const url = typeof pet === "string" ? new URL(pet, ORIGEN).href : pet.url;
      for (const c of almacen.values()) if (c.has(url)) return Promise.resolve(c.get(url));
      return Promise.resolve(undefined);
    },
  };

  const oyentes = {};
  const self = {
    addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => Promise.resolve() },
    location: { origin: ORIGEN },
  };

  const estado = { red: true, llamadas: 0 };

  const fetchFalso = async (pet) => {
    estado.llamadas += 1;
    if (!estado.red) throw new TypeError("Failed to fetch");
    const r = new Response("ok", { status: 200 });
    Object.defineProperty(r, "type", { value: "basic" });
    Object.defineProperty(r, "__origen", { value: "red" });
    return r;
  };

  const ctx = vm.createContext({ self, caches, fetch: fetchFalso, Response, Request, URL, Date, Promise, console });
  vm.runInContext(fs.readFileSync("public/sw.js", "utf8"), ctx);

  return { oyentes, estado, caches };
}

async function pide(entorno, url, { modo = "no-cors", metodo = "GET" } = {}) {
  let respuesta = "PASA"; // el trabajador no lo toca
  const evento = {
    request: { url, method: metodo, mode: modo },
    respondWith: (p) => { respuesta = p; },
    waitUntil: () => {},
  };
  entorno.oyentes.fetch(evento);
  if (respuesta === "PASA") return "PASA";
  try {
    const r = await respuesta;
    return r?.__origen === "red" ? "RED" : "CACHÉ";
  } catch { return "FALLA"; }
}

const casos = [
  ["estáticos con huella",        `${ORIGEN}/_next/static/chunks/a.js`, {}, "RED"],
  ["lectura de la hoja",          `${ORIGEN}/api/rivals?action=jugadores`, {}, "RED"],
  ["relectura de un guardado",    `${ORIGEN}/api/rivals?action=jugadores&fresco=1`, {}, "PASA"],
  ["vídeo del coding",            `${ORIGEN}/api/coding/video?id=1`, {}, "PASA"],
  ["subida (POST)",               `${ORIGEN}/api/general/upload`, { metodo: "POST" }, "PASA"],
  ["navegación a una pantalla",   `${ORIGEN}/rivals`, { modo: "navigate" }, "RED"],
  ["petición interna del router", `${ORIGEN}/rivals?_rsc=abc`, {}, "PASA"],
  ["hoja publicada de Google",    "https://docs.google.com/spreadsheets/d/e/x/pub?output=csv", {}, "RED"],
  ["foto de Supabase",            "https://abc.supabase.co/storage/v1/object/public/performance/players/cerca/x.webp", {}, "RED"],
  ["YouTube",                     "https://www.youtube.com/watch?v=1", {}, "PASA"],
  ["Power BI",                    "https://app.powerbi.com/reportEmbed", {}, "PASA"],
];

console.log("CON RED");
const e = nuevoEntorno();
let fallos = 0;
for (const [nombre, url, opts, esperado] of casos) {
  const r = await pide(e, url, opts);
  const ok = r === esperado;
  if (!ok) fallos += 1;
  console.log(`  ${ok ? "✔" : "✘"} ${nombre.padEnd(28)} ${r}${ok ? "" : "  (esperaba " + esperado + ")"}`);
}

console.log("\nSIN RED (después de haberlo visto todo con red)");
e.estado.red = false;
const sinRed = [
  ["estáticos con huella",      `${ORIGEN}/_next/static/chunks/a.js`, {}, "CACHÉ"],
  ["lectura de la hoja",        `${ORIGEN}/api/rivals?action=jugadores`, {}, "CACHÉ"],
  ["navegación ya visitada",    `${ORIGEN}/rivals`, { modo: "navigate" }, "CACHÉ"],
  ["hoja publicada de Google",  "https://docs.google.com/spreadsheets/d/e/x/pub?output=csv", {}, "CACHÉ"],
  ["relectura de un guardado",  `${ORIGEN}/api/rivals?action=jugadores&fresco=1`, {}, "PASA"],
];
for (const [nombre, url, opts, esperado] of sinRed) {
  const r = await pide(e, url, opts);
  const ok = r === esperado;
  if (!ok) fallos += 1;
  console.log(`  ${ok ? "✔" : "✘"} ${nombre.padEnd(28)} ${r}${ok ? "" : "  (esperaba " + esperado + ")"}`);
}

/* Una pantalla en la que no se ha entrado nunca: tiene que caer en la portada. */
const e2 = nuevoEntorno();
await pide(e2, `${ORIGEN}/`, { modo: "navigate" });
e2.estado.red = false;
const nueva = await pide(e2, `${ORIGEN}/coding`, { modo: "navigate" });
console.log(`  ${nueva === "CACHÉ" ? "✔" : "✘"} pantalla nunca visitada     ${nueva} (respaldo: la portada)`);
if (nueva !== "CACHÉ") fallos += 1;

/* El sello con la fecha. */
const sello = await e.caches.match("/__castilla/ultimo-dato");
const fecha = sello ? await sello.text() : null;
console.log(`\n  ${fecha ? "✔" : "✘"} sello de fecha para el aviso: ${fecha ?? "NO SE ESCRIBIÓ"}`);
if (!fecha) fallos += 1;

console.log(fallos === 0 ? "\nTodo como debe." : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
