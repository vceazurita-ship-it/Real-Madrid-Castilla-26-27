/**
 * Comprueba que los parsers de `rivals-informe.mjs` siguen leyendo BeSoccer.
 *
 *   node scripts/rivals-informe-harness.mjs
 *
 * Baja cuatro páginas de ejemplo —clasificación, calendario y club del Teruel,
 * y la ficha de un partido— y enseña lo que ha sacado de cada una. No sube
 * nada a Supabase ni escribe caché: es para mirar con los ojos cuando BeSoccer
 * cambie una clase y algo empiece a salir vacío.
 *
 * Con `--offline <carpeta>` usa HTML ya guardado en vez de pedirlo, que es lo
 * cómodo mientras se ajusta una expresión regular: los ficheros tienen que
 * llamarse `clasif.html`, `partidos.html`, `equipo.html` y `alineaciones.html`.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  leeAlineacion,
  leeClasificacion,
  leeEntrenador,
  leeEntrenadorPartido,
  leeEstadio,
  leeGoles,
  leePartidos,
} from "./rivals-informe.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const args = process.argv.slice(2);

const offline = args.includes("--offline") ? args[args.indexOf("--offline") + 1] : "";

const SLUG = "teruel";

const PAGINAS = {
  clasif:
    "https://es.besoccer.com/competicion/clasificacion/primera_division_rfef/2027/grupo2",
  partidos: `https://es.besoccer.com/equipo/partidos/${SLUG}`,
  equipo: `https://es.besoccer.com/equipo/${SLUG}`,
};

function baja(url) {
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

function html(nombre, url) {
  if (offline) return fs.readFileSync(path.join(offline, `${nombre}.html`), "utf8");

  return baja(url);
}

const corta = (lista, n = 3) => lista.slice(0, n);

/* -------------------------------------------------- clasificación */

const clasificacion = leeClasificacion(html("clasif", PAGINAS.clasif));

console.log("\n=== CLASIFICACIÓN ===");

for (const pestana of ["total", "local", "visitante"]) {
  const filas = clasificacion[pestana];

  console.log(`${pestana}: ${filas.length} filas`);

  for (const fila of corta(filas)) {
    console.log(
      `  ${fila.puesto}. ${fila.equipo} (${fila.slug}) — ${fila.puntos} pts, ` +
        `${fila.jugados} PJ, ${fila.favor}:${fila.contra} · ${fila.escudo}`
    );
  }
}

/* -------------------------------------------------- partidos */

const partidos = leePartidos(html("partidos", PAGINAS.partidos), SLUG);

console.log("\n=== PARTIDOS ===");
console.log(`${partidos.length} partidos, ${partidos.filter((p) => p.jugado).length} jugados`);

for (const partido of corta(partidos.filter((p) => p.jugado).slice(-4), 4)) {
  console.log(
    `  ${partido.fecha.slice(0, 10)} [${partido.competicion}] ` +
      `${partido.local.nombre} ${partido.local.goles}-${partido.visitante.goles} ` +
      `${partido.visitante.nombre} · ${partido.enCasa ? "casa" : "fuera"} ${partido.resultado}`
  );
}

/* -------------------------------------------------- club */

const club = html("equipo", PAGINAS.equipo);

console.log("\n=== ENTRENADOR ===");
console.log(leeEntrenador(club));

console.log("\n=== ESTADIO ===");
console.log(leeEstadio(club));

/* -------------------------------------------------- ficha de partido */

const ultimo = [...partidos].reverse().find((partido) => partido.jugado);

if (ultimo) {
  const url = `https://es.besoccer.com/partido/${ultimo.local.slug}/${ultimo.visitante.slug}/${ultimo.id}`;

  const visitante = !ultimo.enCasa;

  const ficha = html("alineaciones", `${url}/alineaciones`);

  console.log(`\n=== ALINEACIÓN (${ultimo.local.nombre} vs ${ultimo.visitante.nombre}) ===`);

  const alineacion = leeAlineacion(ficha, visitante);

  console.log(`entrenador: ${leeEntrenadorPartido(ficha, visitante)}`);
  console.log(`estructura: ${alineacion?.estructura}`);

  for (const jugador of alineacion?.jugadores ?? []) {
    console.log(`  pos${jugador.puesto} · ${jugador.dorsal} ${jugador.nombre}`);
  }

  console.log("\n=== GOLES ===");

  console.log(leeGoles(offline ? ficha : baja(url), visitante));
}
