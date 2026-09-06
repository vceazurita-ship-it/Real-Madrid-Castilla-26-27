/**
 * Descarga de BeSoccer las estadísticas de todos los jugadores rivales y las
 * guarda en Supabase (`app_documents`, clave `rivals:stats`).
 *
 *   node scripts/rivals-stats.mjs            descarga lo que falte y sube
 *   node scripts/rivals-stats.mjs --solo-subir   sólo reconstruye y sube
 *   node scripts/rivals-stats.mjs --refrescar    ignora la caché y baja todo
 *
 * ¿Por qué Supabase y no la hoja? La hoja RIVALES escribe **por nombre de
 * columna** y no tiene cabeceras para partidos, minutos, goles ni tarjetas: un
 * guardado ahí se descartaría en silencio devolviendo `success: true`. Estos
 * números además no los edita nadie a mano, así que un documento JSON que se
 * regenera con este script es el sitio natural.
 *
 * La clave de cada jugador es su **id de resfu**, el que ya viaja dentro de la
 * URL de la columna FOTO (`players/medium/<id>.jpg`). Es el id propio de
 * BeSoccer y no se mueve; los `ID_JUGADOR` de la hoja sí se renumeran.
 *
 * De cada temporada se guarda también el **escudo** de los clubes por los que
 * pasó, que es lo que hace legible el historial en la ficha y en el PDF del
 * once. La caché guarda lo ya parseado, no el HTML, así que las fichas que se
 * bajaron antes de esto no lo tienen: una pasada normal las detecta y las
 * vuelve a pedir ella sola (`--solo-subir` no, que no baja nada). Mientras no
 * se corra, la ficha pinta la inicial del club en el hueco del escudo.
 *
 * Del propio equipo rival se guarda además su **escudo grande** (`equipos`),
 * que es el que firma la cabecera del PDF del once y la portada del jugador.
 * No puede salir de la hoja RIVALES: no tiene columna para él.
 *
 * Notas de scraping (ver también la nota "besoccer-plantillas-rivales"):
 * - BeSoccer devuelve 406 sin cabeceras de navegador, y el `fetch` de Node
 *   falla de forma intermitente donde `curl --compressed` funciona siempre.
 * - Se deja ~1,5 s entre peticiones. Son ~450 páginas: media hora larga.
 * - La descarga se cachea en `.cache/rivals-stats/`, así que se puede cortar y
 *   reanudar sin repetir nada.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

const CACHE_DIR = ".cache/rivals-stats";
const CACHE_FILE = path.join(CACHE_DIR, "besoccer.json");

const DOC_KEY = "rivals:stats";
const DOC_KIND = "rivals";

/** Temporada en curso: la que se enseña de entrada si el jugador ya ha jugado. */
const TEMPORADA = "2026/27";

/* Slug de BeSoccer de cada equipo rival. Salen de la clasificación del grupo:
   https://es.besoccer.com/competicion/clasificacion/primera_division_rfef/2027/grupo2 */
const TEAM_SLUGS = {
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

/*
| Emparejamientos a mano: fila de la hoja -> id de resfu.
|
| Sólo para quien no tiene foto en la hoja **y** aparece en BeSoccer con otro
| nombre, que es donde el emparejamiento automático no puede acertar. Antes de
| añadir a alguien aquí, confírmalo con edad + altura + peso de su ficha; el
| nombre solo no basta.
*/
const OVERRIDES = {
  /* "Goyo" (Gregorio Medina, Teruel): BeSoccer lo escribe "Gollo". Coinciden
     26 años, 62 kg y 177 cm. */
  "RIV-01|gregorio medina": "676931",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const args = new Set(process.argv.slice(2));

const soloSubir = args.has("--solo-subir");
const refrescar = args.has("--refrescar");

/*
|--------------------------------------------------------------------------
| UTILIDADES
|--------------------------------------------------------------------------
*/

const sleep = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function curl(url) {
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
    { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" }
  );
}

const strip = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const toNumber = (text) => {
  const match = String(text).replace(/\./g, "").match(/-?\d+/);

  return match ? Number(match[0]) : 0;
};

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const NOISE = new Set(["de", "del", "la", "el", "los", "las", "da", "dos", "van", "der"]);

const tokens = (name) =>
  normalize(name)
    .split(" ")
    .filter((token) => token && !NOISE.has(token));

const resfuId = (foto) => {
  const match = String(foto ?? "").match(/players\/[a-z]+\/(\d+)/);

  return match ? match[1] : null;
};

/*
|--------------------------------------------------------------------------
| PARSEO DE LA FICHA
|--------------------------------------------------------------------------
| La tabla `table_parents` de la ficha tiene una fila `parent_row` por
| equipo-temporada y filas `parent_son` por competición dentro de ella. Nos
| quedamos con las `parent_row`: son el total en ese club esa temporada.
|
| El orden de columnas es fijo, pero el significado de dos de ellas cambia
| según el puesto: a los porteros se les dan goles encajados y penaltis
| parados donde a los de campo se les dan goles y asistencias. Lo decide la
| cabecera, no la posición que tengamos nosotros en la hoja.
*/

function rows(tableHtml) {
  return [...tableHtml.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)].map((m) => ({
    attrs: m[1],
    html: m[2],
  }));
}

function cells(rowHtml) {
  return [...rowHtml.matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({
    html: m[3],
  }));
}

/*
| Escudo del club en la celda del equipo. Viene como
| `cdn.resfu.com/img_data/escudos/medium/<id>.jpg?size=60x&lossy=1`; el
| `&amp;` de la entidad HTML hay que deshacerlo o el CDN devuelve la imagen
| por defecto.
*/
function escudoDe(cellHtml) {
  const match = cellHtml.match(/<img[^>]+src="([^"]+)"/);

  return match ? match[1].replace(/&amp;/g, "&") : "";
}

function trajectoryTable(html) {
  const start = html.indexOf("table_parents");

  if (start < 0) return null;

  const from = html.lastIndexOf("<table", start);
  const to = html.indexOf("</table>", start);

  if (from < 0 || to < 0) return null;

  return html.slice(from, to);
}

function parsePlayer(html) {
  const table = trajectoryTable(html);

  if (!table) return null;

  const all = rows(table);
  const head = all.find((row) => /row-head/.test(row.attrs));

  if (!head) return null;

  const portero = /Goles concedidos/i.test(head.html);

  const temporadas = [];

  for (const row of all) {
    if (!/parent_row/.test(row.attrs)) continue;

    const cs = cells(row.html);

    if (cs.length < 11) continue;

    const temporada = (strip(cs[1].html).match(/\d{4}\/\d{2}/) || [""])[0];

    if (!temporada) continue;

    const entry = {
      temporada,
      equipo: strip(cs[0].html),
      /* La celda del equipo trae su escudo:
         cdn.resfu.com/img_data/escudos/medium/<id>.jpg. Es lo que hace legible
         de un vistazo el historial de la ficha, donde el nombre del club
         escrito a 9 px no se lee. */
      escudo: escudoDe(cs[0].html),
      partidos: toNumber(strip(cs[2].html)),
      amarillas: toNumber(strip(cs[5].html)),
      rojas: toNumber(strip(cs[6].html)),
      titular: toNumber(strip(cs[8].html)),
      suplente: toNumber(strip(cs[9].html)),
      minutos: toNumber(strip(cs[10].html)),
    };

    if (portero) {
      entry.encajados = toNumber(strip(cs[3].html));
      entry.penaltisParados = toNumber(strip(cs[4].html));
    } else {
      entry.goles = toNumber(strip(cs[3].html));
      entry.asistencias = toNumber(strip(cs[4].html));
    }

    temporadas.push(entry);
  }

  return { portero, temporadas };
}

/**
 * Junta las filas de una misma temporada.
 *
 * Un jugador puede haber pasado por dos clubes en un año (cedido en enero,
 * por ejemplo) y BeSoccer le da una fila a cada uno. Al preparar un partido
 * interesa el total del curso, no el desglose, así que se suman y se
 * conservan los nombres de los clubes para poder explicarlo en la ficha.
 */
function mergeSeasons(temporadas) {
  const merged = new Map();

  for (const entry of temporadas) {
    const current = merged.get(entry.temporada);

    if (!current) {
      const { equipo, escudo, ...rest } = entry;

      merged.set(entry.temporada, {
        ...rest,
        equipos: equipo ? [equipo] : [],
        /* Mismo índice que `equipos`: la ficha empareja escudo y nombre por
           posición, así que si un club se queda sin escudo hay que dejarle su
           hueco vacío, no saltárselo. */
        escudos: equipo ? [escudo || ""] : [],
      });
      continue;
    }

    for (const key of [
      "partidos",
      "titular",
      "suplente",
      "minutos",
      "amarillas",
      "rojas",
      "goles",
      "asistencias",
      "encajados",
      "penaltisParados",
    ]) {
      if (entry[key] === undefined) continue;

      current[key] = (current[key] ?? 0) + entry[key];
    }

    if (entry.equipo && !current.equipos.includes(entry.equipo)) {
      current.equipos.push(entry.equipo);
      current.escudos.push(entry.escudo || "");
    }
  }

  /* De la más reciente a la más antigua: "2026/27" ordena bien como texto. */
  return [...merged.values()].sort((a, b) =>
    b.temporada.localeCompare(a.temporada)
  );
}

/*
|--------------------------------------------------------------------------
| DESCARGA
|--------------------------------------------------------------------------
*/

/**
 * Lee una lista de la hoja, con reintentos.
 *
 * Apps Script devuelve de vez en cuando **una página de Google** en vez del
 * JSON —una interstitial con `ppConfig` dentro— y un `.json()` a pelo se
 * rompe con «Unexpected token '<'». Eso es lo que tumbaba la actualización
 * nocturna las noches del 2, el 5 y el 6 de septiembre de 2026: no había nada
 * mal en los datos, era el servidor de Google contestando otra cosa.
 *
 * Es un tropiezo pasajero, así que se reintenta. Lo que no se hace es
 * adivinar: si después de cuatro intentos sigue sin haber JSON, se sale con
 * un mensaje que dice lo que pasó de verdad.
 */
async function traeDeLaHoja(url, quePide = "la hoja") {
  let ultimo = "";

  for (let intento = 1; intento <= 4; intento += 1) {
    if (intento > 1) {
      await new Promise((sigue) => setTimeout(sigue, intento * 4000));
    }

    try {
      const respuesta = await fetch(url, { cache: "no-store" });

      const texto = await respuesta.text();

      /* Una página de error empieza por '<'. Los datos, por '[' o '{'. */
      const limpio = texto.trim();

      if (!limpio.startsWith("[") && !limpio.startsWith("{")) {
        ultimo = `${quePide}: Google ha contestado una página, no datos (HTTP ${respuesta.status})`;

        continue;
      }

      return JSON.parse(limpio);
    } catch (error) {
      ultimo = `${quePide}: ${String(error?.message ?? error).slice(0, 140)}`;
    }
  }

  throw new Error(`No se ha podido leer ${ultimo}`);
}

async function loadRivals() {
  const data = await traeDeLaHoja(
    `${APPS_SCRIPT_URL}?action=rivalesPlantillas`,
    "las plantillas rivales",
  );

  if (!Array.isArray(data)) throw new Error("La hoja no ha devuelto una lista.");

  /* Las plantillas traen filas en blanco reservadas para altas futuras. */
  return data.filter((player) => String(player.JUGADOR || "").trim());
}

/*
| Escudo del club, de la propia página de plantilla.
|
| Lo da la etiqueta `og:image`:
| `cdn.resfu.com/img_data/equipos/<id>.png?size=120x&lossy=1`. Se le sube el
| `size` a 500 porque este escudo no se pinta a 9 px como los del historial:
| firma la cabecera del PDF del once y ocupa una esquina entera de la portada
| del jugador, y a 120 px se le ven los dientes.
|
| PNG y no el `.jpg` de los escudos pequeños: el PNG viene con transparencia y
| la portada lo pone sobre blanco, el PDF sobre papel o sobre fondo oscuro
| según el tema, y un recuadro blanco cantaría en el segundo.
*/
function escudoDelEquipo(html) {
  const match = html.match(
    /<meta property="og:image" content="([^"]+equipos\/[^"]+)"/
  );

  if (!match) return "";

  return match[1].replace(/&amp;/g, "&").replace(/size=\d+x/, "size=500x");
}

function fetchSquads() {
  const squads = {};

  for (const [id, slug] of Object.entries(TEAM_SLUGS)) {
    let html = "";

    for (let attempt = 0; attempt < 3 && html.length < 5000; attempt += 1) {
      if (attempt) sleep(3000);

      try {
        html = curl(`https://es.besoccer.com/equipo/plantilla/${slug}`);
      } catch {
        html = "";
      }
    }

    const jugadores = {};

    for (const m of html.matchAll(
      /href="https:\/\/es\.besoccer\.com\/jugador\/([a-z0-9-]+?-(\d+))"/g
    )) {
      jugadores[m[2]] = m[1];
    }

    squads[id] = { slug, jugadores, escudo: escudoDelEquipo(html) };

    console.log(
      `plantilla ${id} ${slug}: ${Object.keys(jugadores).length}` +
        (squads[id].escudo ? "" : " (sin escudo)")
    );

    sleep(1500);
  }

  return squads;
}

/**
 * Completa los escudos que falten en un `squads.json` ya cacheado.
 *
 * La caché de plantillas se guardó antes de que existiera el escudo, y tirarla
 * entera para recuperarlo obligaría a volver a bajar las diecinueve páginas
 * cada vez que se toque algo. Se piden sólo las que les falta, y con eso
 * `--solo-subir` también puede dejar el documento completo.
 */
function completaEscudos(squads) {
  const faltan = Object.entries(squads).filter(([, team]) => !team.escudo);

  if (!faltan.length) return false;

  console.log(`escudos de equipo por descargar: ${faltan.length}`);

  for (const [id, team] of faltan) {
    let html = "";

    for (let attempt = 0; attempt < 3 && html.length < 5000; attempt += 1) {
      if (attempt) sleep(3000);

      try {
        html = curl(`https://es.besoccer.com/equipo/plantilla/${team.slug}`);
      } catch {
        html = "";
      }
    }

    team.escudo = escudoDelEquipo(html);

    console.log(`escudo ${id} ${team.slug}: ${team.escudo || "no encontrado"}`);

    sleep(1500);
  }

  return true;
}

/**
 * A qué ficha de BeSoccer corresponde cada fila de la hoja.
 *
 * Manda el id de la foto, que cubre casi todo. Para las filas sin foto se
 * puntúa por nombre **dentro de su propio equipo**, exigiendo que coincida el
 * último token: compartir sólo el nombre de pila empareja a dos personas
 * distintas (Pau Cifuentes ≠ Pau Martínez).
 */
function resolve(players, squads) {
  return players.map((player) => {
    const squad = squads[player.ID_EQUIPO];

    const manual =
      OVERRIDES[`${player.ID_EQUIPO}|${normalize(player.JUGADOR)}`];

    if (manual) {
      return {
        player,
        id: manual,
        slug: squad?.jugadores[manual] ?? null,
        how: "manual",
      };
    }

    const fromPhoto = resfuId(player.FOTO);

    /* Aunque BeSoccer ya no lo liste en la plantilla, su ficha sigue viva y es
       la que queremos: la hoja puede ir por delante o por detrás. */
    if (fromPhoto) {
      return {
        player,
        id: fromPhoto,
        slug: squad?.jugadores[fromPhoto] ?? null,
        how: squad?.jugadores[fromPhoto] ? "foto" : "foto-fuera",
      };
    }

    if (!squad) return { player, id: null, slug: null, how: null };

    const want = tokens(player.JUGADOR || player["NOMBRE DEPORTIVO"]);
    const surname = want[want.length - 1];

    let best = null;

    for (const [candidateId, slug] of Object.entries(squad.jugadores)) {
      const have = tokens(slug.replace(/-\d+$/, "").replace(/-/g, " "));

      if (!surname || !have.includes(surname)) continue;

      const score = have.filter((token) => want.includes(token)).length;

      if (!best || score > best.score) best = { id: candidateId, slug, score };
    }

    return best
      ? { player, id: best.id, slug: best.slug, how: "nombre" }
      : { player, id: null, slug: null, how: null };
  });
}

function readCache() {
  if (refrescar || !fs.existsSync(CACHE_FILE)) return {};

  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeCache(cache) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
}

/*
| Una ficha cacheada antes de que existieran los escudos no los tiene y no hay
| forma de sacarlos sin volver a la página: la caché guarda lo ya parseado, no
| el HTML. Se marcan como pendientes para que una pasada normal las refresque
| sola, sin obligar a un `--refrescar` que tiraría también las buenas.
*/
function completa(entry) {
  if (!entry || !Array.isArray(entry.temporadas)) return false;

  return entry.temporadas.every((season) => season.escudo !== undefined);
}

function scrape(targets, cache) {
  const pending = targets.filter((row) => row.id && !completa(cache[row.id]));

  console.log(`fichas por descargar: ${pending.length}`);

  const failures = [];

  let done = 0;

  for (const row of pending) {
    done += 1;

    const url = `https://es.besoccer.com/jugador/${row.slug || `x-${row.id}`}`;

    let parsed = null;
    let error = null;

    for (let attempt = 0; attempt < 3 && !parsed; attempt += 1) {
      if (attempt) sleep(4000);

      try {
        const html = curl(url);

        /* Una respuesta corta es un bloqueo o un error, no una ficha vacía. */
        if (html.length < 20000) {
          error = `respuesta corta (${html.length})`;
          continue;
        }

        parsed = parsePlayer(html);

        if (!parsed) error = "sin tabla de trayectoria";
      } catch (e) {
        error = String(e?.message ?? e).slice(0, 120);
      }
    }

    /*
    | Un fallo NO se cachea. BeSoccer devuelve de vez en cuando la ficha sin
    | el módulo de trayectoria: es un tropiezo del servidor, no un jugador
    | sin datos. Guardarlo dejaba a esa gente sin estadísticas para siempre
    | (pasó con 6 el 25/08/2026, y al reintentarlos salieron a la primera).
    | Sin cachearlo, la siguiente pasada los vuelve a pedir.
    */
    if (parsed) {
      cache[row.id] = { url, portero: parsed.portero, temporadas: parsed.temporadas };
    } else {
      failures.push(`${row.player.NOMBRE_EQUIPO} · ${row.player.JUGADOR}: ${error ?? "desconocido"}`);
    }

    if (done % 10 === 0 || done === pending.length) {
      writeCache(cache);

      console.log(
        `${done}/${pending.length} · ${row.player.NOMBRE_EQUIPO} · ${row.player.JUGADOR}`
      );
    }

    sleep(1500);
  }

  writeCache(cache);

  if (failures.length) {
    console.log(`fichas que no han salido (se reintentan al volver a correr): ${failures.length}`);

    failures.forEach((line) => console.log(`  · ${line}`));
  }
}

/*
|--------------------------------------------------------------------------
| DOCUMENTO Y SUBIDA
|--------------------------------------------------------------------------
*/

function buildDoc(targets, cache, squads) {
  const porId = {};
  const porNombre = {};

  /* El club, con el nombre que le da la hoja —que es el que se lee en la app—
     y el escudo que le ha sacado BeSoccer. */
  const equipos = {};

  for (const { player } of targets) {
    const id = String(player.ID_EQUIPO || "");

    if (!id || equipos[id]) continue;

    const escudo = squads?.[id]?.escudo || "";

    if (!escudo) continue;

    equipos[id] = {
      id,
      nombre: String(player.NOMBRE_EQUIPO || "").trim(),
      escudo,
    };
  }

  for (const row of targets) {
    const entry = row.id ? cache[row.id] : null;

    if (!entry || entry.error) continue;

    porId[row.id] = {
      portero: entry.portero,
      url: entry.url,
      temporadas: mergeSeasons(entry.temporadas),
    };

    /* Índice de respaldo para las filas de la hoja que no traen foto. */
    const key = `${normalize(row.player.NOMBRE_EQUIPO)}|${normalize(
      row.player.JUGADOR
    )}`;

    porNombre[key] = row.id;
  }

  return {
    actualizado: new Date().toISOString(),
    fuente: "besoccer",
    temporada: TEMPORADA,
    porId,
    porNombre,
    equipos,
  };
}

/**
 * Las claves de Supabase.
 *
 * En un portátil salen de `.env.local`; en la tarea nocturna, que corre en un
 * runner de GitHub, no hay tal fichero y vienen del entorno. Se admiten las
 * dos formas para que el mismo script valga en los dos sitios sin tocar nada,
 * y se avisa claro cuando no hay ninguna: sin claves el script subía `null` y
 * el fallo aparecía media hora después, al terminar la descarga.
 */
function readEnv() {
  const env = {};

  if (fs.existsSync(".env.local")) {
    /* El fichero viene con saltos de Windows y en JS el `.` de una expresión
       regular no cruza un retorno de carro: sin quitarlos, ninguna línea
       encaja. */
    const raw = fs.readFileSync(".env.local", "utf8").split("\r").join("");

    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

      if (match) env[match[1]] = match[2].trim();
    }
  }

  /* Lo que venga por el entorno manda: es lo que pone la tarea nocturna. */
  for (const clave of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[clave]) env[clave] = process.env[clave];
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: " +
        "ponlas en .env.local o en el entorno antes de subir nada.",
    );
  }

  return env;
}

async function upload(doc) {
  const env = readEnv();

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabase
    .from("app_documents")
    .upsert(
      { key: DOC_KEY, kind: DOC_KIND, data: doc, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) throw new Error(error.message);

  /* Relectura: un `success` sin comprobar no prueba que se haya escrito. */
  const { data, error: readError } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", DOC_KEY)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const saved = Object.keys(data?.data?.porId ?? {}).length;
  const sent = Object.keys(doc.porId).length;

  if (saved !== sent) {
    throw new Error(`Se enviaron ${sent} jugadores y la tabla guardó ${saved}.`);
  }

  const clubes = Object.keys(data?.data?.equipos ?? {}).length;

  if (clubes !== Object.keys(doc.equipos).length) {
    throw new Error(
      `Se enviaron ${Object.keys(doc.equipos).length} escudos de equipo y la tabla guardó ${clubes}.`
    );
  }

  console.log(
    `Supabase: ${saved} jugadores y ${clubes} escudos de equipo verificados en ${DOC_KEY}.`
  );
}

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

const players = await loadRivals();

console.log(`jugadores en la hoja: ${players.length}`);

const squadsFile = path.join(CACHE_DIR, "squads.json");

let squads;

if (!refrescar && fs.existsSync(squadsFile)) {
  squads = JSON.parse(fs.readFileSync(squadsFile, "utf8"));

  /* Una caché de antes de los escudos de club: se completa sola. */
  if (completaEscudos(squads)) {
    fs.writeFileSync(squadsFile, JSON.stringify(squads));
  }
} else {
  squads = fetchSquads();

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(squadsFile, JSON.stringify(squads));
}

const targets = resolve(players, squads);

const sinFicha = targets.filter((row) => !row.id);

if (sinFicha.length) {
  console.log(`sin ficha en BeSoccer (${sinFicha.length}):`);

  sinFicha.forEach((row) =>
    console.log(`  · ${row.player.NOMBRE_EQUIPO} · ${row.player.JUGADOR}`)
  );
}

const cache = readCache();

if (!soloSubir) scrape(targets, cache);

const doc = buildDoc(targets, cache, squads);

const conFicha = targets.filter((row) => row.id).length;

console.log(
  `documento: ${Object.keys(doc.porId).length} de ${conFicha} jugadores con ficha`
);

console.log(
  `escudos de equipo: ${Object.keys(doc.equipos).length} de ${Object.keys(TEAM_SLUGS).length}`
);

await upload(doc);
