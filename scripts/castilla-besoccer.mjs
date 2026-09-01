/**
 * Cruza NUESTRA plantilla con BeSoccer y guarda el resultado en Supabase
 * (`app_documents`, clave `castilla:besoccer`).
 *
 *   node scripts/castilla-besoccer.mjs                 baja y sube
 *   node scripts/castilla-besoccer.mjs --sin-subir     deja la caché, no sube
 *   node scripts/castilla-besoccer.mjs --refrescar     ignora la caché
 *
 * De cada jugador del Castilla se guarda su **ficha de BeSoccer** —el enlace,
 * que es lo que se pone en su perfil— y el historial por temporadas que ya se
 * pinta para los rivales: partidos, titularidades, minutos, goles, asistencias,
 * tarjetas, y encajados y penaltis parados en los porteros.
 *
 * ¿Por qué no en la hoja? Por lo mismo que las estadísticas de rivales: la hoja
 * de plantilla escribe por nombre de columna y no tiene cabeceras para esto, así
 * que un guardado ahí se descartaría en silencio devolviendo `success: true`.
 * Y son datos que no edita nadie a mano.
 *
 * **El cruce es por nombre, y ahí está toda la dificultad.** Nuestra hoja
 * escribe «Diego Aguado» y BeSoccer «D. Aguado»; nosotros usamos apodos
 * («Meso», «Relu») que allí no existen. Se cruza por apellidos y sólo se acepta
 * cuando la coincidencia es **única**: con dos candidatos se prefiere dejarlo
 * sin atar a colgarle a un jugador la ficha de otro. Lo que quede suelto se
 * lista al final para poder resolverlo a mano en `MANUAL`.
 *
 * Notas de scraping (ver la nota "besoccer-plantillas-rivales"):
 * - BeSoccer devuelve 406 sin cabeceras de navegador, y el `fetch` de Node
 *   falla de forma intermitente donde `curl --compressed` funciona siempre.
 * - Se deja ~1,5 s entre peticiones. Son ~25 fichas: poco más de un minuto.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

const CACHE_DIR = ".cache/castilla-besoccer";

const DOC_KEY = "castilla:besoccer";
const DOC_KIND = "castilla";

/** Nuestra plantilla, la misma hoja que lee `hooks/usePlayers`. */
const PLANTILLA_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=205498392&single=true&output=csv";

/** El Castilla en BeSoccer. Sale de la clasificación del grupo. */
const SLUG = "rm-castilla";

/**
 * Cruces que el automatismo no puede hacer solo.
 *
 * De nuestro `ID_JUGADOR` al id de BeSoccer. Se rellena mirando la lista de
 * «sin atar» que imprime el script: es un minuto de trabajo por fichaje y
 * evita el riesgo de atar por parecido a quien no toca.
 */
const MANUAL = {};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const args = new Set(process.argv.slice(2));

const SIN_SUBIR = args.has("--sin-subir");
const REFRESCAR = args.has("--refrescar");

/* ------------------------------------------------------------------ */
/*  UTILIDADES                                                         */
/* ------------------------------------------------------------------ */

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
    { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
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

/* Palabras que no identifican a nadie: están en media plantilla. */
const RUIDO = new Set([
  "de", "del", "la", "el", "los", "las", "da", "dos", "van", "der", "di",
]);

const tokens = (nombre) =>
  normalize(nombre)
    .split(" ")
    .filter((t) => t.length > 2 && !RUIDO.has(t));

/* ------------------------------------------------------------------ */
/*  CACHÉ                                                              */
/* ------------------------------------------------------------------ */

fs.mkdirSync(CACHE_DIR, { recursive: true });

const rutaCache = (nombre) => path.join(CACHE_DIR, `${nombre}.json`);

function leeCache(nombre) {
  try {
    return JSON.parse(fs.readFileSync(rutaCache(nombre), "utf8"));
  } catch {
    return null;
  }
}

const guardaCache = (nombre, valor) =>
  fs.writeFileSync(rutaCache(nombre), JSON.stringify(valor, null, 2));

/* ------------------------------------------------------------------ */
/*  LA PLANTILLA DE BESOCCER                                           */
/* ------------------------------------------------------------------ */

/**
 * Los jugadores de la página de plantilla.
 *
 * BeSoccer mete un bloque JSON-LD por jugador con su nombre completo, su
 * puesto, su foto y la URL de su ficha. Es mucho mejor fuente que el enlace
 * suelto: el `slug` viene abreviado («a-carvajal») y el nombre no.
 */
function leePlantillaBesoccer(html) {
  const jugadores = [];

  for (const bloque of html.matchAll(
    /<script type="application\/ld\+json">\s*(\{[^<]*?"@type"\s*:\s*"Person"[\s\S]*?\})\s*<\/script>/g,
  )) {
    let dato;

    try {
      dato = JSON.parse(bloque[1]);
    } catch {
      continue;
    }

    const url = String(dato.url ?? "");
    const id = url.match(/-(\d+)$/)?.[1];

    if (!id) continue;

    jugadores.push({
      id,
      nombre: String(dato.name ?? "").trim(),
      puesto: String(dato.jobTitle ?? "").trim(),
      ficha: url,
      foto: String(dato.image ?? "").replace(/&amp;/g, "&"),
    });
  }

  return jugadores;
}

/* ------------------------------------------------------------------ */
/*  LA FICHA DE UN JUGADOR                                             */
/* ------------------------------------------------------------------ */

/*
| La tabla `table_parents` de la ficha da una fila por equipo-temporada
| (`parent_row`) y sub-filas por competición. Nos quedamos con las primeras.
|
| El orden de columnas es fijo pero **el significado de dos cambia según el
| puesto**: a los porteros se les dan goles encajados y penaltis parados donde
| a los de campo goles y asistencias. Lo decide la cabecera, no lo que ponga
| nuestra hoja. Es el mismo parseo que `scripts/rivals-stats.mjs`, repetido a
| propósito: los dos se corren sueltos y con meses de diferencia, y un módulo
| compartido entre dos `.mjs` de `scripts/` sólo añade un sitio más donde mirar.
*/

const filas = (tabla) =>
  [...tabla.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)].map((m) => ({
    attrs: m[1],
    html: m[2],
  }));

const celdas = (fila) =>
  [...fila.matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({
    html: m[3],
  }));

const escudoDe = (celda) => {
  const match = celda.match(/<img[^>]+src="([^"]+)"/);

  return match ? match[1].replace(/&amp;/g, "&") : "";
};

function tablaTrayectoria(html) {
  const donde = html.indexOf("table_parents");

  if (donde < 0) return null;

  const desde = html.lastIndexOf("<table", donde);
  const hasta = html.indexOf("</table>", donde);

  if (desde < 0 || hasta < 0) return null;

  return html.slice(desde, hasta);
}

function leeFicha(html) {
  const tabla = tablaTrayectoria(html);

  if (!tabla) return null;

  const todas = filas(tabla);
  const cabecera = todas.find((f) => /row-head/.test(f.attrs));

  if (!cabecera) return null;

  const portero = /Goles concedidos/i.test(cabecera.html);

  const temporadas = [];

  for (const fila of todas) {
    if (!/parent_row/.test(fila.attrs)) continue;

    const cs = celdas(fila.html);

    if (cs.length < 11) continue;

    const temporada = (strip(cs[1].html).match(/\d{4}\/\d{2}/) || [""])[0];

    if (!temporada) continue;

    const entrada = {
      temporada,
      equipo: strip(cs[0].html),
      escudo: escudoDe(cs[0].html),
      partidos: toNumber(strip(cs[2].html)),
      amarillas: toNumber(strip(cs[5].html)),
      rojas: toNumber(strip(cs[6].html)),
      titular: toNumber(strip(cs[8].html)),
      suplente: toNumber(strip(cs[9].html)),
      minutos: toNumber(strip(cs[10].html)),
    };

    if (portero) {
      entrada.encajados = toNumber(strip(cs[3].html));
      entrada.penaltisParados = toNumber(strip(cs[4].html));
    } else {
      entrada.goles = toNumber(strip(cs[3].html));
      entrada.asistencias = toNumber(strip(cs[4].html));
    }

    temporadas.push(entrada);
  }

  return { portero, temporadas };
}

/**
 * Junta las filas de una misma temporada.
 *
 * Un jugador cedido en enero tiene dos filas del mismo curso, una por club.
 * En la ficha interesa el total, conservando los nombres para poder explicarlo.
 */
function juntaTemporadas(temporadas) {
  const unidas = new Map();

  for (const entrada of temporadas) {
    const actual = unidas.get(entrada.temporada);

    if (!actual) {
      const { equipo, escudo, ...resto } = entrada;

      unidas.set(entrada.temporada, {
        ...resto,
        equipos: equipo ? [equipo] : [],
        escudos: equipo ? [escudo || ""] : [],
      });

      continue;
    }

    for (const clave of [
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
      if (entrada[clave] === undefined) continue;

      actual[clave] = (actual[clave] ?? 0) + entrada[clave];
    }

    if (entrada.equipo && !actual.equipos.includes(entrada.equipo)) {
      actual.equipos.push(entrada.equipo);
      actual.escudos.push(entrada.escudo || "");
    }
  }

  return [...unidas.values()].sort((a, b) =>
    b.temporada.localeCompare(a.temporada),
  );
}

/* ------------------------------------------------------------------ */
/*  NUESTRA PLANTILLA                                                  */
/* ------------------------------------------------------------------ */

/**
 * Lee el CSV de la hoja.
 *
 * Con papaparse y no a mano: las columnas de análisis del jugador llevan
 * texto largo **con saltos de línea dentro de las comillas**, y partiendo por
 * líneas cada nota se convertía en tres filas rotas. De veinticinco jugadores
 * activos se leían cinco.
 */
function parseCsv(texto) {
  const { data } = Papa.parse(texto, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return data;
}
async function nuestraPlantilla() {
  const respuesta = await fetch(PLANTILLA_CSV, { cache: "no-store" });

  if (!respuesta.ok) throw new Error(`La hoja no responde (${respuesta.status})`);

  return parseCsv(await respuesta.text()).filter(
    (fila) => fila.ACTIVO === "TRUE" && String(fila.NOMBRE || "").trim(),
  );
}

/* ------------------------------------------------------------------ */
/*  EL CRUCE                                                           */
/* ------------------------------------------------------------------ */

/**
 * A quién de BeSoccer corresponde uno de los nuestros.
 *
 * Por este orden: lo atado a mano en `MANUAL`, el nombre completo idéntico, y
 * por último los apellidos. Sólo se acepta cuando **hay un único candidato**:
 * «García» lo comparten tres, y colgarle a uno la ficha de otro es peor que
 * dejarlo sin enlace.
 */
function cruza(nuestro, deBesoccer) {
  if (MANUAL[nuestro.ID_JUGADOR]) {
    const atado = deBesoccer.find((j) => j.id === MANUAL[nuestro.ID_JUGADOR]);

    if (atado) return { jugador: atado, via: "manual" };
  }

  const nombre = normalize(nuestro.NOMBRE);

  const exacto = deBesoccer.filter((j) => normalize(j.nombre) === nombre);

  if (exacto.length === 1) return { jugador: exacto[0], via: "nombre" };

  /*
  | Por el apellido, que es el último token.
  |
  | Va antes que la comparación suelta porque BeSoccer abrevia el nombre de
  | pila —«Á. Lezcano»— y comparando cualquier token, «Álvaro Lezcano» tenía
  | tres candidatos («Álvaro Leiva» y «Álvaro Ginés» comparten el «Álvaro») y
  | se quedaba sin atar. Por apellido es uno solo.
  */
  const misTokens = tokens(nuestro.NOMBRE);

  const miApellido = misTokens[misTokens.length - 1];

  if (miApellido) {
    const porApellidoExacto = deBesoccer.filter((j) => {
      const suyos = tokens(j.nombre);

      return suyos[suyos.length - 1] === miApellido;
    });

    if (porApellidoExacto.length === 1) {
      return { jugador: porApellidoExacto[0], via: "apellido" };
    }
  }

  /* Y si no, cualquier apellido en común. */
  const propios = new Set(misTokens);

  if (!propios.size) return null;

  const porApellido = deBesoccer.filter((j) =>
    tokens(j.nombre).some((t) => propios.has(t)),
  );

  if (porApellido.length === 1) return { jugador: porApellido[0], via: "parecido" };

  /* Y el apodo, que a veces es el nombre con el que juega. */
  if (nuestro.APODO) {
    const delApodo = new Set(tokens(nuestro.APODO));

    const porApodo = deBesoccer.filter((j) =>
      tokens(j.nombre).some((t) => delApodo.has(t)),
    );

    if (porApodo.length === 1) return { jugador: porApodo[0], via: "apodo" };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  SUPABASE                                                           */
/* ------------------------------------------------------------------ */

function readEnv() {
  const env = {};

  if (fs.existsSync(".env.local")) {
    const raw = fs.readFileSync(".env.local", "utf8").split("\r").join("");

    for (const linea of raw.split("\n")) {
      const match = linea.match(/^([A-Z0-9_]+)=(.*)$/);

      if (match) env[match[1]] = match[2].trim();
    }
  }

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

async function sube(doc) {
  const env = readEnv();

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { error } = await supabase.from("app_documents").upsert(
    {
      key: DOC_KEY,
      kind: DOC_KIND,
      data: doc,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(`Supabase: ${error.message}`);

  console.log(`\nSubido: ${Object.keys(doc.porJugador).length} jugadores atados.`);
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("Plantilla del Castilla en BeSoccer…");

  let plantillaHtml = leeCache("_plantilla-html")?.html;

  if (!plantillaHtml || REFRESCAR) {
    plantillaHtml = curl(`https://es.besoccer.com/equipo/plantilla/${SLUG}`);
    guardaCache("_plantilla-html", { html: plantillaHtml });
  }

  const deBesoccer = leePlantillaBesoccer(plantillaHtml);

  console.log(`  ${deBesoccer.length} jugadores en BeSoccer.`);

  if (deBesoccer.length === 0) {
    throw new Error("BeSoccer no ha devuelto plantilla: ¿ha cambiado el slug?");
  }

  const nuestros = await nuestraPlantilla();

  console.log(`  ${nuestros.length} en nuestra hoja.\n`);

  const porJugador = {};
  const sinAtar = [];

  for (const nuestro of nuestros) {
    const cruce = cruza(nuestro, deBesoccer);

    if (!cruce) {
      sinAtar.push(nuestro);
      continue;
    }

    const { jugador, via } = cruce;

    let ficha = leeCache(jugador.id);

    if (!ficha || REFRESCAR) {
      sleep(1500);

      console.log(`  ficha de ${jugador.nombre}…`);

      let html = "";

      for (let intento = 0; intento < 3 && html.length < 5000; intento += 1) {
        if (intento) sleep(3000);

        try {
          html = curl(jugador.ficha);
        } catch {
          html = "";
        }
      }

      const leida = html ? leeFicha(html) : null;

      ficha = leida
        ? { portero: leida.portero, temporadas: juntaTemporadas(leida.temporadas) }
        : { portero: false, temporadas: [] };

      guardaCache(jugador.id, ficha);
    }

    porJugador[nuestro.ID_JUGADOR] = {
      besoccerId: jugador.id,
      nombre: jugador.nombre,
      puesto: jugador.puesto,
      ficha: jugador.ficha,
      foto: jugador.foto,
      via,
      portero: ficha.portero,
      temporadas: ficha.temporadas,
    };
  }

  const doc = {
    actualizado: new Date().toISOString(),
    fuente: "besoccer",
    equipo: SLUG,
    porJugador,
  };

  console.log(
    `\nAtados ${Object.keys(porJugador).length} de ${nuestros.length}.`,
  );

  if (sinAtar.length) {
    console.log("\nSin atar (ponlos en MANUAL si hace falta):");

    sinAtar.forEach((j) =>
      console.log(`  ${j.ID_JUGADOR}\t${j.NOMBRE}${j.APODO ? ` (${j.APODO})` : ""}`),
    );

    console.log("\nCandidatos de BeSoccer que nadie ha reclamado:");

    const reclamados = new Set(
      Object.values(porJugador).map((p) => p.besoccerId),
    );

    deBesoccer
      .filter((j) => !reclamados.has(j.id))
      .forEach((j) => console.log(`  ${j.id}\t${j.nombre} (${j.puesto})`));
  }

  guardaCache("_documento", doc);

  if (SIN_SUBIR) {
    console.log("\n--sin-subir: queda en la caché, Supabase no se toca.");

    return;
  }

  await sube(doc);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
