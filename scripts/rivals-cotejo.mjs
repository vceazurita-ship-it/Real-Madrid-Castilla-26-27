/**
 * Coteja las plantillas rivales de la hoja con las de BeSoccer y dice qué ha
 * cambiado: quién ha llegado y quién ya no está.
 *
 *   node scripts/rivals-cotejo.mjs              informe por pantalla
 *   node scripts/rivals-cotejo.mjs --json x.json  además lo deja en un fichero
 *   node scripts/rivals-cotejo.mjs --refrescar   ignora la caché de HTML
 *   node scripts/rivals-cotejo.mjs --equipo RIV-05   sólo ése
 *
 * **No escribe nada.** El informe es la entrada de `rivals-altas-bajas.mjs`,
 * que es el que toca la hoja; separado a posta, porque una baja mal
 * emparejada tacha a un jugador que sigue en el equipo.
 *
 * El emparejamiento es el de la nota "besoccer-plantillas-rivales": primero
 * por el **id de resfu** que ya viaja dentro de la URL de la columna FOTO
 * (`players/medium/<id>.jpg`), que es la clave fuerte, y sólo para las filas
 * que se quedan fuera se puntúa por nombre **exigiendo que coincida el último
 * apellido**. Compartir el nombre de pila empareja a dos jugadores distintos.
 *
 * Notas de scraping: BeSoccer devuelve 406 sin cabeceras de navegador y el
 * `fetch` de Node falla donde `curl --compressed` funciona siempre, así que se
 * baja con `curl` y ~1,5 s entre páginas.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

const CACHE_DIR = ".cache/cotejo";

/* Slugs de BeSoccer, los mismos que usa `rivals-stats.mjs`. */
export const TEAM_SLUGS = {
  "RIV-01": "teruel",
  "RIV-02": "juventud-torremolinos",
  "RIV-03": "aguilas-cf",
  "RIV-04": "sant-andreu",
  "RIV-05": "ad-alcorcon",
  "RIV-06": "at-madrid-b",
  "RIV-07": "ibiza-eivissa",
  "RIV-08": "antequera",
  "RIV-09": "algeciras-cf",
  "RIV-10": "cartagena",
  "RIV-11": "hercules",
  "RIV-12": "gimnastic-tarragona",
  "RIV-13": "real-murcia",
  "RIV-14": "rayo-majadahonda",
  "RIV-15": "real-jaen",
  "RIV-16": "real-zaragoza",
  "RIV-17": "huesca",
  "RIV-18": "ce-europa",
  "RIV-19": "villarreal-b",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const sleep = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function curl(url) {
  return execFileSync(
    "curl",
    [
      "-s",
      "--compressed",
      "--max-time",
      "45",
      "-H",
      `User-Agent: ${UA}`,
      "-H",
      "Accept: text/html,application/xhtml+xml",
      "-H",
      "Accept-Language: es-ES,es;q=0.9",
      url,
    ],
    { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
  );
}

/** Baja una página y la deja en la caché; devuelve el HTML. */
export function pagina(url, nombre, refrescar = false) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const file = path.join(CACHE_DIR, `${nombre}.html`);

  if (!refrescar && fs.existsSync(file)) {
    const cached = fs.readFileSync(file, "utf8");

    if (cached.length > 5000) return cached;
  }

  let html = "";

  for (let intento = 0; intento < 3 && html.length < 5000; intento += 1) {
    if (intento) sleep(3000);

    try {
      html = curl(url);
    } catch {
      html = "";
    }
  }

  if (html.length > 5000) fs.writeFileSync(file, html);

  sleep(1500);

  return html;
}

export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const RUIDO = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "da",
  "dos",
  "van",
  "der",
  "di",
]);

export const tokens = (nombre) =>
  normalize(nombre)
    .split(" ")
    .filter((token) => token && !RUIDO.has(token));

export const resfuId = (foto) => {
  const match = String(foto ?? "").match(/players\/[a-z]+\/(\d+)/);

  return match ? match[1] : null;
};

/*
| Los jugadores de una página de plantilla.
|
| Cada uno viene en un `<script type="application/ld+json">` de tipo `Person`
| con el nombre corto, el puesto grueso, la URL y la foto.
|
| **El id sale de la FOTO, no de la URL.** La URL suele acabar en el id
| (`/jugador/n-ruiz-998277`) pero no siempre: a los veteranos con ficha antigua
| BeSoccer les deja el slug con el nombre entero y sin número
| (`/jugador/pau-darbra-martinez`). Sacando el id de la URL, esos tres se caían
| del parseo y salían como bajas del equipo estando en la plantilla —justo el
| fallo contra el que avisa la nota de scraping—. La foto
| (`players/medium/<id>.jpg`) la llevan todos.
*/
export function plantillaDe(html) {
  const jugadores = [];

  for (const bloque of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    let json;

    try {
      json = JSON.parse(bloque[1]);
    } catch {
      continue;
    }

    if (json["@type"] !== "Person") continue;

    const id =
      resfuId(json.image) || (String(json.url || "").match(/-(\d+)$/) || [])[1];

    if (!id) continue;

    jugadores.push({
      id,
      nombre: String(json.name || "").trim(),
      puesto: String(json.jobTitle || "").trim(),
      url: String(json.url || ""),
      foto: `https://cdn.resfu.com/img_data/players/medium/${id}.jpg`,
    });
  }

  return jugadores;
}

async function cargaHoja() {
  const response = await fetch(`${APPS_SCRIPT_URL}?action=rivalesPlantillas`, {
    cache: "no-store",
  });

  const data = await response.json();

  if (!Array.isArray(data)) throw new Error("La hoja no ha devuelto una lista.");

  return data;
}

/*
| Empareja las filas de un equipo con su plantilla de BeSoccer.
|
| Primero por id de resfu, que no falla. Lo que sobre se puntúa por nombre y
| **sólo cuenta si coincide el último apellido**: hay jugadores que BeSoccer
| escribe acortados ("Pau" por Pau Darbra) o en otra lengua, y ahí el nombre de
| pila solo empareja a dos personas distintas.
*/
export function empareja(filas, plantilla) {
  const porId = new Map(plantilla.map((uno) => [uno.id, uno]));

  const usados = new Set();
  const parejas = [];
  const sueltas = [];

  for (const fila of filas) {
    const id = resfuId(fila.FOTO);

    if (id && porId.has(id)) {
      usados.add(id);
      parejas.push({ fila, besoccer: porId.get(id), via: "foto" });
      continue;
    }

    sueltas.push(fila);
  }

  const libres = plantilla.filter((uno) => !usados.has(uno.id));

  for (const fila of sueltas) {
    const nombre = tokens(fila["NOMBRE DEPORTIVO"] || fila.JUGADOR);
    const completo = tokens(fila.JUGADOR);

    const apellido = completo[completo.length - 1];

    let mejor = null;
    let mejorPunto = 0;

    for (const uno of libres) {
      if (usados.has(uno.id)) continue;

      const suyos = tokens(uno.nombre);

      /* La condición dura: el último apellido de la hoja tiene que estar. */
      if (!apellido || !suyos.includes(apellido)) continue;

      const comunes = suyos.filter(
        (token) => nombre.includes(token) || completo.includes(token),
      ).length;

      if (comunes > mejorPunto) {
        mejorPunto = comunes;
        mejor = uno;
      }
    }

    if (mejor) {
      usados.add(mejor.id);
      parejas.push({ fila, besoccer: mejor, via: "nombre" });
      continue;
    }

    parejas.push({ fila, besoccer: null, via: null });
  }

  return {
    parejas,
    altas: plantilla.filter((uno) => !usados.has(uno.id)),
  };
}

/* ------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2);

  const refrescar = args.includes("--refrescar");

  const soloEquipo = args.includes("--equipo")
    ? args[args.indexOf("--equipo") + 1]
    : null;

  const salida = args.includes("--json")
    ? args[args.indexOf("--json") + 1]
    : null;

  const hoja = await cargaHoja();

  const informe = [];

  for (const [equipo, slug] of Object.entries(TEAM_SLUGS)) {
    if (soloEquipo && equipo !== soloEquipo) continue;

    const filas = hoja.filter(
      (fila) =>
        fila.ID_EQUIPO === equipo && String(fila.JUGADOR || "").trim(),
    );

    const html = pagina(
      `https://es.besoccer.com/equipo/plantilla/${slug}`,
      slug,
      refrescar,
    );

    const plantilla = plantillaDe(html);

    if (plantilla.length === 0) {
      console.log(`${equipo} ${slug}: SIN DATOS (la página no ha bajado)`);
      continue;
    }

    const { parejas, altas } = empareja(filas, plantilla);

    const bajas = parejas
      .filter((pareja) => !pareja.besoccer)
      .map((pareja) => pareja.fila);

    /* Quien ya está marcado como fuera y sigue sin aparecer no es noticia. */
    const bajasNuevas = bajas.filter(
      (fila) => String(fila.ESTADO || "").toUpperCase() !== "NO EN PLANTILLA",
    );

    /* Y quien estaba marcado fuera pero ha vuelto a aparecer, sí. */
    const vueltas = parejas
      .filter(
        (pareja) =>
          pareja.besoccer &&
          String(pareja.fila.ESTADO || "").toUpperCase() === "NO EN PLANTILLA",
      )
      .map((pareja) => pareja.fila);

    informe.push({
      equipo,
      slug,
      nombre: filas[0]?.NOMBRE_EQUIPO ?? slug,
      enHoja: filas.length,
      enBesoccer: plantilla.length,
      altas,
      bajas: bajasNuevas,
      vueltas,
      porNombre: parejas
        .filter((pareja) => pareja.via === "nombre")
        .map((pareja) => ({
          hoja: pareja.fila.JUGADOR,
          besoccer: pareja.besoccer.nombre,
          id: pareja.besoccer.id,
        })),
    });

    console.log(
      `${equipo} ${(filas[0]?.NOMBRE_EQUIPO ?? slug).padEnd(26)} ` +
        `hoja ${String(filas.length).padStart(2)} · besoccer ${String(
          plantilla.length,
        ).padStart(2)} · altas ${altas.length} · bajas ${bajasNuevas.length}` +
        (vueltas.length ? ` · vuelven ${vueltas.length}` : ""),
    );

    for (const alta of altas) {
      console.log(`    + ${alta.nombre.padEnd(24)} ${alta.puesto} (${alta.id})`);
    }

    for (const baja of bajasNuevas) {
      console.log(
        `    - ${String(baja.JUGADOR).padEnd(24)} ${baja["POSICIÓN"]} (${
          baja.ID_JUGADOR
        })`,
      );
    }
  }

  if (salida) {
    fs.writeFileSync(salida, JSON.stringify(informe, null, 1));
    console.log(`\n${salida}`);
  }

  const altas = informe.reduce((suma, uno) => suma + uno.altas.length, 0);
  const bajas = informe.reduce((suma, uno) => suma + uno.bajas.length, 0);

  console.log(`\nTotal: ${altas} altas, ${bajas} bajas.`);
}

/* El fichero se importa además desde `rivals-altas-bajas.mjs`, así que sólo se
   ejecuta cuando es él quien se ha invocado. Comparar `import.meta.url` con
   `process.argv[1]` no vale en Windows: son `file:///C:/…` y `C:\…`. */
if (path.basename(process.argv[1] ?? "") === "rivals-cotejo.mjs") {
  await main();
}
