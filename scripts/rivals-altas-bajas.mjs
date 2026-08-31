/**
 * Pone al día las plantillas rivales de la hoja con lo que dice BeSoccer:
 * da de alta a los que han llegado y marca `NO EN PLANTILLA` a los que ya no
 * están.
 *
 *   node scripts/rivals-altas-bajas.mjs --preparar altas.json
 *       Baja las fichas de los que faltan y deja las filas listas. No escribe.
 *
 *   node scripts/rivals-altas-bajas.mjs --escribir altas.json
 *       Escribe en la hoja lo preparado. Reanudable: guarda lo hecho al lado.
 *
 *   ...--salvo RIV-01     no toca ese equipo (se puede repetir)
 *
 * Va en dos pasos a posta. El primero sólo lee de BeSoccer —dos páginas por
 * jugador, ficha y fichajes, a ~1,6 s— y deja un JSON que se puede mirar antes
 * de tocar nada; el segundo escribe fila a fila, a ~4 s cada una, y va dejando
 * constancia para poder cortarlo y seguir.
 *
 * **Las bajas no se borran**, se marcan `NO EN PLANTILLA`: un jugador que se
 * fue en agosto sigue saliendo en los vídeos de la pretemporada y en los
 * informes ya escritos, y borrar la fila deja huérfano todo eso.
 *
 * Antes de dar a nadie por baja, este script exige que **su id de resfu** —el
 * que ya viaja en la columna FOTO— no esté en la plantilla de BeSoccer. El
 * nombre no vale: la página escribe "Pau" por Pau Darbra y "Jaume Tovar" por
 * Jaime Tovar. Aun así, repasa la lista a mano: puede haber altas que BeSoccer
 * tarde días en publicar.
 */
import fs from "node:fs";

import {
  TEAM_SLUGS,
  empareja,
  pagina,
  plantillaDe,
  resfuId,
} from "./rivals-cotejo.mjs";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

const sleep = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const limpio = (html) =>
  String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const numero = (texto) => {
  const match = String(texto ?? "").match(/-?\d+/);

  return match ? Number(match[0]) : null;
};

/*
| El rol fino de BeSoccer -> la POSICIÓN que entiende la hoja.
|
| El código de tres letras de la ficha (POR/DEF/CEN/DEL) no sirve: mete en el
| mismo saco a un lateral y a un central, y el campograma los coloca en sitios
| distintos. El fino está en `<div class="mt5 box bg-role rolN"><b>LI</b></div>`.
|
| Se escribe el vocabulario que ya usa la hoja —"LATERAL IZDO", no "LATERAL
| IZQUIERDO"—, que es el que `getSlot()` reconoce en `app/rivals/page.tsx`.
*/
const POSICIONES = {
  PT: "PORTERO",
  GK: "PORTERO",
  POR: "PORTERO",
  DFC: "CENTRAL",
  CB: "CENTRAL",
  LD: "LATERAL DCHO",
  RB: "LATERAL DCHO",
  LI: "LATERAL IZDO",
  LB: "LATERAL IZDO",
  CAR: "CARRILERO",
  MCD: "MEDIO CENTRO DEF",
  DM: "MEDIO CENTRO DEF",
  MC: "MEDIO CENTRO",
  CM: "MEDIO CENTRO",
  MI: "INTERIOR IZQUIERDO",
  MD: "INTERIOR DERECHO",
  MCO: "MEDIA PUNTA",
  AM: "MEDIA PUNTA",
  ED: "EXTREMO DCHO",
  RW: "EXTREMO DCHO",
  EI: "EXTREMO IZDO",
  LW: "EXTREMO IZDO",
  SD: "SEGUNDO DELANTERO",
  DC: "DELANTERO",
  ST: "DELANTERO",
};

/** Lo grueso, por si la ficha no trae el rol fino. */
const PUESTOS = {
  Portero: "PORTERO",
  Defensa: "DEFENSA",
  Centrocampista: "MEDIO CENTRO",
  Delantero: "DELANTERO",
};

/*
|--------------------------------------------------------------------------
| LA FICHA DE UN JUGADOR
|--------------------------------------------------------------------------
*/

/**
 * El nombre completo es el `panel-subtitle` **pegado** al `panel-title` que
 * lleva el alias. La página tiene otros `panel-title` ("Temporada 2026/27") y
 * otros `panel-subtitle` (noticias, secciones), así que hay que emparejarlos
 * por posición y no coger el primero que aparezca.
 */
function nombreCompleto(html, alias) {
  const titulos = [
    ...html.matchAll(
      /class="[^"]*panel-title[^"]*"[^>]*>([\s\S]{0,160}?)<\/[a-z0-9]+>/g,
    ),
  ];

  for (const titulo of titulos) {
    if (limpio(titulo[1]) !== alias) continue;

    const resto = html.slice(titulo.index, titulo.index + 900);

    const sub = resto.match(
      /class="[^"]*panel-subtitle[^"]*"[^>]*>([\s\S]{0,160}?)<\/[a-z0-9]+>/,
    );

    if (sub) return limpio(sub[1]);
  }

  return "";
}

function fichaDe(html) {
  const alias = limpio(
    (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "",
  ).replace(/^Estad[íi]sticas\s+/i, "");

  /*
  | Edad, peso y altura viven en la lista de `<div class="stat">` de la
  | cabecera, cada uno como un par `big-row` (el número) + `small-row` (la
  | unidad). Se leen por la UNIDAD y no por la posición: el orden de las cajas
  | cambia de una ficha a otra, y en las de los chavales sin valor de mercado
  | falta una entera.
  */
  const datos = {};

  for (const par of html.matchAll(
    /<div class="big-row">([\s\S]*?)<\/div>\s*<div class="small-row">([\s\S]*?)<\/div>/g,
  )) {
    datos[limpio(par[2]).toLowerCase()] = limpio(par[1]);
  }

  /* La nacionalidad es el `small-row` que va detrás de la bandera. */
  const pais = limpio(
    (html.match(
      /<div class="round-row mb5">\s*<img[^>]*flags[^>]*>\s*<\/div>\s*<div class="small-row">([\s\S]*?)<\/div>/,
    ) || [])[1] || "",
  );

  /*
  | El rol fino —el que distingue a un lateral de un central— está en la caja
  | `bg-role` de la cabecera. El código de tres letras de la lista de `stat`
  | sólo dice POR/DEF/CEN/DEL y no basta para colocar a nadie en el campo.
  */
  const rol = limpio(
    (html.match(/class="mt5 box bg-role rol\d*"[^>]*>\s*<b>([^<]*)<\/b>/) ||
      [])[1] || "",
  ).toUpperCase();

  const pie = limpio(
    (html.match(/<div>Pie preferido<\/div>\s*<div>([^<]*)<\/div>/) || [])[1] ||
      "",
  );

  let persona = {};

  for (const bloque of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    let json;

    try {
      json = JSON.parse(bloque[1]);
    } catch {
      continue;
    }

    if (json["@type"] === "Person" && json.birthDate) {
      persona = json;
      break;
    }
  }

  return {
    alias,
    nombre: nombreCompleto(html, alias) || alias,
    rol,
    puesto: String(persona.jobTitle || ""),
    edad: numero(datos["años"]),
    peso: numero(datos["kgs"]) ?? numero(persona.weight?.value),
    altura: numero(datos["cms"]) ?? numero(persona.height?.value),
    pais: pais || String(persona.nationality?.name || ""),
    pie: /izquierd/i.test(pie) ? "IZDO" : /derech/i.test(pie) ? "DCHO" : "",
  };
}

/**
 * De dónde viene y desde cuándo.
 *
 * La página de fichajes es mejor fuente que el "Equipo anterior" de la ficha,
 * que se queda desfasado. Vale la llegada más reciente cuyo **destino** sea el
 * club rival; una fila con sólo origen es una salida o una renovación.
 */
function llegadaA(html, slug) {
  for (const fila of html.matchAll(/<tr class="row-body"[\s\S]*?<\/tr>/g)) {
    const texto = fila[0];

    const anclaDestino = texto.match(
      /<a href="[^"]*\/equipo\/([a-z0-9-]+)"[^>]*data-cy="destinationTransfer"[\s\S]*?<span>([^<]*)<\/span>/,
    );

    /* El destino se reconoce por el SLUG del club, no por su nombre: la página
       de plantilla se titula "Plantel de jugadores del CE Europa" y la tabla de
       fichajes escribe "CE Europa"; comparar textos falla con cualquier club
       que lleve artículo o abreviatura. */
    if (!anclaDestino || anclaDestino[1] !== slug) continue;

    const destino = limpio(anclaDestino[2]);

    if (!destino) continue;

    const origen = limpio(
      (texto.match(/data-cy="originTransfer"[\s\S]*?<span>([^<]*)<\/span>/) ||
        [])[1] || "",
    );

    const fecha = (texto.match(/<span>(\d{2})\/(\d{2})\/(\d{4})<\/span>/) || [])
      .slice(1);

    return {
      procedencia: origen,
      /* La hoja escribe la fecha en ISO, que es como ordena. */
      fecha: fecha.length === 3 ? `${fecha[2]}-${fecha[1]}-${fecha[0]}` : "",
    };
  }

  return { procedencia: "", fecha: "" };
}

/*
|--------------------------------------------------------------------------
| PREPARAR
|--------------------------------------------------------------------------
*/

async function cargaHoja() {
  const response = await fetch(`${APPS_SCRIPT_URL}?action=rivalesPlantillas`, {
    cache: "no-store",
  });

  const data = await response.json();

  if (!Array.isArray(data)) throw new Error("La hoja no ha devuelto una lista.");

  return data;
}

const mayus = (texto) => String(texto ?? "").trim().toUpperCase();

async function preparar(salida, salvo) {
  const hoja = await cargaHoja();

  const siguienteId =
    Math.max(
      ...hoja
        .map((fila) => numero(String(fila.ID_JUGADOR || "").replace(/\D+/g, "")))
        .filter((valor) => valor !== null),
    ) + 1;

  const plan = { altas: [], bajas: [] };

  let idLibre = siguienteId;

  for (const [equipo, slug] of Object.entries(TEAM_SLUGS)) {
    if (salvo.has(equipo)) {
      console.log(`${equipo} ${slug}: saltado a petición.`);
      continue;
    }

    const filas = hoja.filter((fila) => fila.ID_EQUIPO === equipo);

    const conJugador = filas.filter((fila) => String(fila.JUGADOR || "").trim());

    const huecos = filas.filter((fila) => !String(fila.JUGADOR || "").trim());

    const html = pagina(
      `https://es.besoccer.com/equipo/plantilla/${slug}`,
      slug,
    );

    const plantilla = plantillaDe(html);

    if (plantilla.length === 0) {
      console.log(`${equipo} ${slug}: SIN DATOS, se salta.`);
      continue;
    }

    const { parejas, altas } = empareja(conJugador, plantilla);

    const nombreEquipo = conJugador[0]?.NOMBRE_EQUIPO ?? slug;

    let dorsalLibre =
      Math.max(0, ...filas.map((fila) => numero(fila.DORSAL) ?? 0)) + 1;

    console.log(
      `${equipo} ${nombreEquipo}: ${altas.length} altas (${huecos.length} huecos)`,
    );

    for (const alta of altas) {
      const ficha = fichaDe(
        pagina(alta.url, `p-${alta.id}`),
      );

      const traspaso = llegadaA(
        pagina(
          alta.url.replace("/jugador/", "/jugador/fichajes/"),
          `f-${alta.id}`,
        ),
        slug,
      );

      const hueco = huecos.shift();

      plan.altas.push({
        equipo,
        besoccerId: alta.id,
        hueco: Boolean(hueco),
        fila: {
          ID_JUGADOR: hueco ? hueco.ID_JUGADOR : `RIV-JUG-${idLibre++}`,
          ID_EQUIPO: equipo,
          NOMBRE_EQUIPO: nombreEquipo,
          DORSAL: hueco ? hueco.DORSAL : dorsalLibre++,
          JUGADOR: mayus(ficha.nombre || alta.nombre),
          "NOMBRE DEPORTIVO": mayus(ficha.alias || alta.nombre),
          "LUGAR DE NACIMIENTO": mayus(ficha.pais),
          EDAD: ficha.edad ?? "",
          PESO: ficha.peso ?? "",
          ALTURA: ficha.altura ? `${ficha.altura}cm` : "",
          "POSICIÓN":
            POSICIONES[ficha.rol] ?? PUESTOS[alta.puesto] ?? "DELANTERO",
          /* La hoja escribe un punto cuando no hay segunda posición. */
          "2º POSICIÓN": ".",
          "PIE DOMINANTE": ficha.pie,
          PROCEDENCIA: mayus(traspaso.procedencia),
          "FECHA INCORPORACIÓN": traspaso.fecha,
          IMPACTO: "",
          ROL: "",
          "CARACTERÍSTICAS": "",
          FORTALEZAS: "",
          DEBILIDADES: "",
          OBSERVACIONES: "",
          VIDEO: "",
          DOC: "",
          FOTO: alta.foto,
          ESTADO: "ACTIVO",
        },
      });

      console.log(
        `    + ${mayus(ficha.alias || alta.nombre).padEnd(22)} ` +
          `${(POSICIONES[ficha.rol] ?? PUESTOS[alta.puesto] ?? "?").padEnd(18)}` +
          `${ficha.edad ?? "?"}a ${ficha.altura ?? "?"}cm ` +
          `${traspaso.procedencia || "—"}`,
      );
    }

    for (const pareja of parejas) {
      if (pareja.besoccer) continue;

      if (mayus(pareja.fila.ESTADO) === "NO EN PLANTILLA") continue;

      plan.bajas.push({
        equipo,
        besoccerId: resfuId(pareja.fila.FOTO),
        fila: { ...pareja.fila, ESTADO: "NO EN PLANTILLA" },
      });

      console.log(`    - ${mayus(pareja.fila.JUGADOR)}`);
    }
  }

  fs.writeFileSync(salida, JSON.stringify(plan, null, 1));

  console.log(
    `\n${salida}: ${plan.altas.length} altas, ${plan.bajas.length} bajas.`,
  );
}

/*
|--------------------------------------------------------------------------
| ESCRIBIR
|--------------------------------------------------------------------------
*/

async function escribeFila(fila, crear) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: crear ? "crearRivalJugador" : "guardarRivalJugador",
      player: fila,
    }),
  });

  const texto = await response.text();

  let leido;

  try {
    leido = JSON.parse(texto);
  } catch {
    throw new Error(`La hoja no ha devuelto JSON: ${texto.slice(0, 120)}`);
  }

  if (!leido.success) {
    if (/datos is not defined/i.test(String(leido.error))) {
      throw new Error(
        "El `doPost` del Apps Script está roto (`datos is not defined`). " +
          "Ver scripts/apps-script/README.md.",
      );
    }

    throw new Error(String(leido.error ?? "guardado rechazado"));
  }
}

async function escribir(entrada) {
  const plan = JSON.parse(fs.readFileSync(entrada, "utf8"));

  const hechoFile = `${entrada}.hecho.json`;

  const hecho = new Set(
    fs.existsSync(hechoFile)
      ? JSON.parse(fs.readFileSync(hechoFile, "utf8"))
      : [],
  );

  const guarda = () =>
    fs.writeFileSync(hechoFile, JSON.stringify([...hecho], null, 1));

  const tareas = [
    ...plan.bajas.map((baja) => ({
      clave: `baja:${baja.fila.ID_JUGADOR}`,
      fila: baja.fila,
      crear: false,
      etiqueta: `- ${baja.fila.JUGADOR} (${baja.equipo})`,
    })),
    ...plan.altas.map((alta) => ({
      clave: `alta:${alta.fila.ID_JUGADOR}`,
      fila: alta.fila,
      /* Los huecos que la hoja ya tiene reservados se rellenan; el resto se
         añade al final del bloque de su equipo. */
      crear: !alta.hueco,
      etiqueta: `+ ${alta.fila["NOMBRE DEPORTIVO"]} (${alta.equipo})`,
    })),
  ];

  let n = 0;

  for (const tarea of tareas) {
    n += 1;

    if (hecho.has(tarea.clave)) continue;

    await escribeFila(tarea.fila, tarea.crear);

    hecho.add(tarea.clave);
    guarda();

    console.log(`${String(n).padStart(3)}/${tareas.length} ${tarea.etiqueta}`);

    sleep(600);
  }

  console.log(`\nHecho: ${hecho.size} filas.`);
}

/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);

const salvo = new Set();

args.forEach((arg, indice) => {
  if (arg === "--salvo") salvo.add(args[indice + 1]);
});

if (args.includes("--preparar")) {
  await preparar(args[args.indexOf("--preparar") + 1], salvo);
} else if (args.includes("--escribir")) {
  await escribir(args[args.indexOf("--escribir") + 1]);
} else {
  console.log(
    "Uso: node scripts/rivals-altas-bajas.mjs --preparar altas.json [--salvo RIV-01]\n" +
      "     node scripts/rivals-altas-bajas.mjs --escribir altas.json",
  );
}
