/**
 * Rellena en la hoja RIVALES las fotos que faltan, sacándolas de BeSoccer.
 *
 *   node scripts/rivals-fotos.mjs Teruel            enseña lo que haría
 *   node scripts/rivals-fotos.mjs Teruel --escribir escribe en la hoja
 *   node scripts/rivals-fotos.mjs --todos           repasa todos los equipos
 *
 * Una ficha sin cara se lee peor en la pizarra y deja la portada del análisis
 * individual con la silueta, así que las fotos que faltan valen el viaje. La
 * columna FOTO de la hoja es además la clave con la que todo lo demás cruza al
 * jugador con BeSoccer (`players/medium/<id>.jpg`, ver la nota
 * "besoccer-plantillas-rivales"), de modo que rellenarla arregla dos cosas a
 * la vez.
 *
 * **No empareja por nombre a ciegas.** BeSoccer escribe los nombres cortos y
 * en otras lenguas, así que una coincidencia de nombre sólo se acepta si
 * además cuadran **dos** datos duros —edad, altura, peso o dorsal—. Lo que no
 * llega a eso se deja sin tocar y se avisa: una foto equivocada en una ficha
 * de scouting es peor que un hueco.
 *
 * Escribe con `guardarRivalJugador`, la misma acción que usa la app. Si el
 * Apps Script de la hoja está roto, el script lo dice y no sigue.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* La misma URL que usa `app/api/rivals`. */
const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ??
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

const CABECERAS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

/* BeSoccer devuelve 406 si se le pide muy seguido; hay que ir despacio. */
const PAUSA_MS = 1600;

const espera = (ms) => new Promise((listo) => setTimeout(listo, ms));

const limpio = (valor) =>
  String(valor ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "GREGORIO MEDINA" → "gregorio medina", sin tildes. */
const normaliza = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const numero = (valor) => {
  const encontrado = String(valor ?? "").match(/\d+/);

  return encontrado ? Number(encontrado[0]) : null;
};

/* ------------------------------------------------------------------ */
/*  LA HOJA                                                            */
/* ------------------------------------------------------------------ */

async function leeHoja() {
  const respuesta = await fetch(`${APPS_SCRIPT_URL}?action=rivalesPlantillas`, {
    headers: { Accept: "application/json" },
  });

  const filas = await respuesta.json();

  if (!Array.isArray(filas)) {
    throw new Error("La hoja no ha devuelto la lista de jugadores.");
  }

  return filas;
}

async function escribeFila(fila) {
  const respuesta = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "guardarRivalJugador", player: fila }),
  });

  const texto = await respuesta.text();

  let leido;

  try {
    leido = JSON.parse(texto);
  } catch {
    throw new Error(`La hoja no ha devuelto JSON: ${texto.slice(0, 120)}`);
  }

  if (!leido.success) {
    if (/datos is not defined/i.test(String(leido.error))) {
      throw new Error(
        "El `doPost` del Apps Script está roto (`datos is not defined`): " +
          "arréglalo con `manejaAlertas(e)` y vuelve a publicar. " +
          "Ver scripts/apps-script/README.md.",
      );
    }

    throw new Error(String(leido.error ?? "guardado rechazado"));
  }

  return leido;
}

/* ------------------------------------------------------------------ */
/*  BESOCCER                                                           */
/* ------------------------------------------------------------------ */

const CACHE = path.join(RAIZ, ".cache", "besoccer-plantillas");

async function pideHtml(url) {
  fs.mkdirSync(CACHE, { recursive: true });

  const fichero = path.join(
    CACHE,
    `${url.replace(/[^a-z0-9]+/gi, "-").slice(-80)}.html`,
  );

  if (fs.existsSync(fichero)) return fs.readFileSync(fichero, "utf8");

  /*
  | Se pide con `curl --compressed`, no con `fetch`.
  |
  | BeSoccer contesta **406** al `fetch` de Node aunque lleve las mismas
  | cabeceras que el navegador —comprobado otra vez el 28/08/2026—, y con curl
  | funciona siempre. Es la misma conclusión a la que llegó el script de
  | estadísticas; ver la nota "besoccer-plantillas-rivales".
  */
  for (let intento = 1; intento <= 3; intento += 1) {
    try {
      const html = execFileSync(
        "curl",
        [
          "-s",
          "--compressed",
          "--max-time",
          "60",
          "-A",
          CABECERAS["User-Agent"],
          "-H",
          `Accept: ${CABECERAS.Accept}`,
          "-H",
          `Accept-Language: ${CABECERAS["Accept-Language"]}`,
          "-w",
          "\n%{http_code}",
          url,
        ],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      );

      const corte = html.lastIndexOf("\n");
      const codigo = Number(html.slice(corte + 1).trim());
      const cuerpo = html.slice(0, corte);

      if (codigo === 404) return null;

      if (codigo === 200 && cuerpo.length > 1000) {
        fs.writeFileSync(fichero, cuerpo);

        await espera(PAUSA_MS);

        return cuerpo;
      }
    } catch {
      /* curl no está o ha fallado: se reintenta y, si no, se deja pasar. */
    }

    await espera(PAUSA_MS * intento * 2);
  }

  return null;
}

/** Los jugadores de una página de plantilla, con su foto y su ficha. */
function leePlantilla(html) {
  const jugadores = [];

  for (const bloque of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    let datos;

    try {
      datos = JSON.parse(bloque[1]);
    } catch {
      continue;
    }

    for (const item of Array.isArray(datos) ? datos : [datos]) {
      if (item?.["@type"] !== "Person" || !item.name) continue;

      const foto = String(item.image ?? "").split("?")[0];

      /* La silueta de "sin foto" no es una foto. */
      if (!foto || /nofoto/i.test(foto)) continue;

      jugadores.push({ nombre: item.name, url: item.url, foto });
    }
  }

  return jugadores;
}

/** Edad, peso, altura y dorsal de una ficha individual. */
function leeFicha(html) {
  const texto = limpio(html.replace(/<script[\s\S]*?<\/script>/g, " "));

  const busca = (patron) => {
    const encontrado = texto.match(patron);

    return encontrado ? Number(encontrado[1]) : null;
  };

  return {
    edad: busca(/(\d{1,2})\s*años/i),
    peso: busca(/(\d{2,3})\s*kgs/i),
    altura: busca(/(\d{3})\s*cms/i),
    dorsal: busca(/(\d{1,2})\s*dorsal/i),
  };
}

/* ------------------------------------------------------------------ */
/*  EL CRUCE                                                           */
/* ------------------------------------------------------------------ */

/**
 * Cuántos datos duros coinciden entre la fila de la hoja y la ficha.
 *
 * Con dos ya es el mismo jugador: que coincidan la edad y la altura de dos
 * personas distintas del mismo equipo y con nombre parecido no pasa.
 */
function cuadran(fila, ficha) {
  let aciertos = 0;

  const compara = (deLaHoja, deLaFicha) => {
    const a = numero(deLaHoja);

    if (a === null || deLaFicha === null) return;

    if (Math.abs(a - deLaFicha) <= 1) aciertos += 1;
  };

  compara(fila.EDAD, ficha.edad);
  compara(fila.PESO, ficha.peso);
  compara(fila.ALTURA, ficha.altura);

  return aciertos;
}

/** ¿Se parecen los nombres? Vale el nombre deportivo o cualquier apellido. */
function pareceElMismo(fila, nombreBeSoccer) {
  const deportivo = normaliza(fila["NOMBRE DEPORTIVO"]);
  const completo = normaliza(fila.JUGADOR);
  const suyo = normaliza(nombreBeSoccer);

  if (!suyo) return false;

  if (deportivo && (suyo === deportivo || suyo.includes(deportivo))) return true;

  if (completo && suyo === completo) return true;

  /* "A. Palop" contra "ALEJANDRO PALOP": el apellido es lo que manda. */
  const apellido = completo.split(" ").pop();

  return Boolean(apellido && apellido.length > 3 && suyo.includes(apellido));
}

/* ------------------------------------------------------------------ */
/*  EL TRABAJO                                                         */
/* ------------------------------------------------------------------ */

/** El slug de BeSoccer de un equipo: se prueban las formas corrientes. */
async function buscaPlantilla(equipo) {
  const base = normaliza(equipo).replace(/\s+/g, "-");

  const candidatos = [
    base,
    base.replace(/^(cd|ud|cf|sd|rc|ca)-/, ""),
    `cd-${base}`,
    `ud-${base}`,
    `cf-${base}`,
  ];

  for (const slug of [...new Set(candidatos)]) {
    const html = await pideHtml(
      `https://es.besoccer.com/equipo/plantilla/${slug}`,
    );

    if (html && html.includes("row-body")) {
      return { slug, jugadores: leePlantilla(html) };
    }
  }

  return null;
}

async function main() {
  const argumentos = process.argv.slice(2);

  const escribir = argumentos.includes("--escribir");
  const todos = argumentos.includes("--todos");

  const equipoPedido = argumentos.find((uno) => !uno.startsWith("--"));

  if (!equipoPedido && !todos) {
    console.log(
      "Uso: node scripts/rivals-fotos.mjs <equipo> [--escribir] | --todos",
    );

    process.exit(1);
  }

  const filas = await leeHoja();

  const equipos = todos
    ? [...new Set(filas.map((fila) => fila.NOMBRE_EQUIPO).filter(Boolean))]
    : [equipoPedido];

  let puestas = 0;
  let sinResolver = 0;

  for (const equipo of equipos) {
    const sinFoto = filas.filter(
      (fila) =>
        fila.NOMBRE_EQUIPO === equipo &&
        !String(fila.FOTO ?? "").trim() &&
        String(fila.JUGADOR ?? "").trim() &&
        fila.ESTADO !== "NO EN PLANTILLA",
    );

    if (sinFoto.length === 0) continue;

    console.log(`\n${equipo}: ${sinFoto.length} sin foto`);

    const plantilla = await buscaPlantilla(equipo);

    if (!plantilla) {
      console.log("  no se encuentra la plantilla en BeSoccer");
      sinResolver += sinFoto.length;
      continue;
    }

    for (const fila of sinFoto) {
      const candidatos = plantilla.jugadores.filter((uno) =>
        pareceElMismo(fila, uno.nombre),
      );

      if (candidatos.length === 0) {
        console.log(
          `  · ${fila["NOMBRE DEPORTIVO"] || fila.JUGADOR}: sin candidato`,
        );

        sinResolver += 1;
        continue;
      }

      let elegido = null;

      for (const candidato of candidatos) {
        const html = candidato.url ? await pideHtml(candidato.url) : null;

        const ficha = html ? leeFicha(html) : null;

        const aciertos = ficha ? cuadran(fila, ficha) : 0;

        if (aciertos >= 2) {
          elegido = { ...candidato, ficha, aciertos };
          break;
        }
      }

      if (!elegido) {
        console.log(
          `  · ${fila["NOMBRE DEPORTIVO"] || fila.JUGADOR}: candidato sin confirmar (${candidatos
            .map((uno) => uno.nombre)
            .join(", ")})`,
        );

        sinResolver += 1;
        continue;
      }

      console.log(
        `  ✓ ${fila["NOMBRE DEPORTIVO"] || fila.JUGADOR} → ${elegido.nombre} · ${elegido.foto}`,
      );

      if (!escribir) continue;

      await escribeFila({ ...fila, FOTO: elegido.foto });

      puestas += 1;

      await espera(500);
    }
  }

  console.log(
    `\n${escribir ? "Escritas" : "Encontradas"}: ${escribir ? puestas : "—"} · sin resolver: ${sinResolver}`,
  );

  if (!escribir) console.log("Nada se ha escrito. Añade --escribir para hacerlo.");
}

main().catch((error) => {
  console.error("\nFALLO:", error.message);
  process.exit(1);
});
