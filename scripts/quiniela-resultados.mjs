/**
 * LOS RESULTADOS DE LA QUINIELA, DE BESOCCER Y SOLOS.
 *
 * Lee de BeSoccer los nueve partidos de la jornada y escribe el 1-X-2 en el
 * documento `quiniela` de Supabase. Con eso, el ranking y la parrilla de la
 * pantalla se ponen al día sin que nadie teclee nada.
 *
 * Corre en ESTE ordenador y no en un servidor, como el resto del trabajo
 * nocturno: **BeSoccer bloquea las IP de centro de datos** —al runner de
 * GitHub le contesta 406 con cero bytes, comprobado el 01/09/2026— y desde una
 * conexión normal funciona. Lo lanza `scripts/jornada-nocturna.cmd`, que la
 * tarea programada dispara a las 00:00 y repite cada dos horas hasta que salga
 * bien: con eso quedan cubiertas las noches del viernes, del sábado y del
 * domingo.
 *
 * Tres decisiones que no son obvias:
 *
 * - **Se ata por número de jornada, no por fecha.** El calendario del Excel
 *   trae la fecha nominal de la jornada —los nueve partidos de la 4 figuran el
 *   domingo 20— y en realidad se juegan repartidos entre el viernes y el
 *   domingo. BeSoccer sí escribe «Primera Federación. Jornada 4» en cada
 *   partido, y eso no se mueve.
 * - **Se mira el calendario del equipo de casa**, que trae sus 38 jornadas con
 *   marcador. Una página por partido, nueve por jornada.
 * - **Se comprueban los dos nombres antes de escribir nada.** Si el partido que
 *   devuelve BeSoccer no es el que dice nuestro calendario, se salta y se
 *   avisa: preferimos un hueco a un resultado puesto en el partido de al lado.
 *
 *   node scripts/quiniela-resultados.mjs              → la jornada de ahora y la anterior
 *   node scripts/quiniela-resultados.mjs --jornada 3  → una concreta
 *   node scripts/quiniela-resultados.mjs --ver        → dice qué haría, sin escribir
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { leePartidos } from "./rivals-informe.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

const CLAVE = "quiniela";

/**
 * Cada equipo de nuestro calendario, con su ficha en BeSoccer.
 *
 * Los `slug` son los mismos que usan `rivals-informe.mjs` y `rivals-stats.mjs`.
 * Se repiten aquí a propósito, como allí: los tres scripts se corren sueltos y
 * un fichero compartido sólo añadiría otro sitio donde mirar cuando cambie uno.
 */
const SLUGS = {
  "AD Alcorcón": "ad-alcorcon",
  "Águilas FC": "aguilas-cf",
  "Algeciras CF": "algeciras-cf",
  "Antequera CF": "antequera",
  "Atlético Madrileño": "at-madrid-b",
  "CD Teruel": "teruel",
  "CE Europa": "ce-europa",
  "CF Rayo Majadahonda": "rayo-majadahonda",
  "FC Cartagena": "cartagena",
  "Gimnàstic de Tarragona": "gimnastic-tarragona",
  "Hércules de Alicante CF": "hercules",
  "Juventud de Torremolinos CF": "juventud-torremolinos",
  "Real Jaén CF": "real-jaen",
  "Real Murcia CF": "real-murcia",
  "Real Zaragoza": "real-zaragoza",
  "SD Huesca": "huesca",
  "UD Ibiza": "ibiza-eivissa",
  "UE Sant Andreu": "sant-andreu",
  'Villarreal CF "B"': "villarreal-b",
};

/* ------------------------------------------------------------------ */
/*  COMPARAR NOMBRES DE EQUIPO                                         */
/* ------------------------------------------------------------------ */

/**
 * Las siglas del tipo de club, que cada sitio pone donde quiere.
 *
 * Nuestro calendario escribe «AD Alcorcón» y BeSoccer «Alcorcón»; nosotros
 * «Villarreal CF "B"» y ellos «Villarreal B». Quitando las siglas quedan los
 * nombres, que sí coinciden. La **B** no se quita: es lo único que distingue a
 * un filial de su primer equipo.
 */
const SIGLAS = new Set(["cf", "cd", "ud", "sd", "ad", "fc", "ue", "ce", "rcd", "sad", "de", "club"]);

function nombreClave(nombre) {
  return (nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/["'.]/g, " ")
    .split(/\s+/)
    .filter((trozo) => trozo && !SIGLAS.has(trozo))
    .join(" ")
    .trim();
}

/** Si dos nombres son el mismo equipo, con lo puesto por delante o por detrás. */
function mismoEquipo(uno, otro) {
  const a = nombreClave(uno);
  const b = nombreClave(otro);

  if (!a || !b) return false;

  return a === b || a.includes(b) || b.includes(a);
}

/* ------------------------------------------------------------------ */
/*  BESOCCER                                                           */
/* ------------------------------------------------------------------ */

function pagina(url) {
  const salida = execFileSync(
    "curl",
    [
      "-s", "--compressed", "--max-time", "45",
      "-H", `User-Agent: ${UA}`,
      "-H", "Accept: text/html,application/xhtml+xml",
      "-H", "Accept-Language: es-ES,es;q=0.9",
      "-w", "\n@@ESTADO@@%{http_code}",
      url,
    ],
    { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
  );

  const corte = salida.lastIndexOf("\n@@ESTADO@@");

  const estado = corte === -1 ? 0 : Number(salida.slice(corte + 11).trim()) || 0;

  return { cuerpo: corte === -1 ? salida : salida.slice(0, corte), estado };
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** El calendario de un equipo, con sus 38 jornadas. Se pide una vez por pasada. */
const calendarios = new Map();

async function calendarioDe(slug) {
  if (calendarios.has(slug)) return calendarios.get(slug);

  await espera(1200);

  const { cuerpo, estado } = pagina(`https://es.besoccer.com/equipo/partidos/${slug}`);

  if (estado !== 200 || !cuerpo) {
    console.warn(`  ${slug}: BeSoccer contestó ${estado}. Se salta.`);

    calendarios.set(slug, []);

    return [];
  }

  const partidos = leePartidos(cuerpo, slug);

  calendarios.set(slug, partidos);

  return partidos;
}

/* ------------------------------------------------------------------ */
/*  EL CALENDARIO DE LA QUINIELA                                       */
/* ------------------------------------------------------------------ */

/**
 * Se lee del propio `lib/quiniela/calendario.ts` en vez de copiarlo.
 *
 * Es un fichero de datos plano —una línea por partido— y sacarlo con una
 * expresión regular evita tener dos calendarios que se pueden separar. Si
 * algún día cambia el formato, esto lo dice en vez de leer de menos: se
 * comprueban los nueve partidos por jornada.
 */
function calendarioQuiniela() {
  const fuente = fs.readFileSync("lib/quiniela/calendario.ts", "utf8");

  const partidos = [];

  const patron =
    /\{\s*jornada:\s*(\d+),\s*fecha:\s*"([^"]+)",\s*local:\s*"((?:[^"\\]|\\.)*)",\s*visitante:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;

  for (const linea of fuente.matchAll(patron)) {
    partidos.push({
      jornada: Number(linea[1]),
      fecha: linea[2],
      local: linea[3].replace(/\\"/g, '"'),
      visitante: linea[4].replace(/\\"/g, '"'),
    });
  }

  return partidos;
}

/* ------------------------------------------------------------------ */
/*  QUÉ JORNADA TOCA                                                   */
/* ------------------------------------------------------------------ */

/**
 * La jornada de ahora **y la anterior**.
 *
 * Las dos, y no sólo la de hoy, porque el último partido de una jornada se
 * juega el domingo por la noche y la tarea corre a las 00:00: para entonces el
 * calendario ya apunta a la siguiente y la que se acaba de jugar se quedaría
 * sin su último resultado para siempre.
 */
function jornadasQueTocan(partidos, hoy) {
  const numeros = [...new Set(partidos.map((uno) => uno.jornada))].sort((a, b) => a - b);

  const deHoy =
    numeros.find((numero) => {
      const suyos = partidos.filter((uno) => uno.jornada === numero);

      const ultima = suyos.reduce((mayor, uno) => (uno.fecha > mayor ? uno.fecha : mayor), "");

      /* Las fechas del Excel son nominales y el partido puede jugarse después:
         se da un día de margen antes de dar la jornada por pasada. */
      return ultima >= hoy;
    }) ?? numeros[numeros.length - 1];

  return [deHoy - 1, deHoy].filter((numero) => numeros.includes(numero));
}

/* ------------------------------------------------------------------ */
/*  SUPABASE                                                           */
/* ------------------------------------------------------------------ */

function entorno() {
  const env = {};

  if (fs.existsSync(".env.local")) {
    for (const linea of fs.readFileSync(".env.local", "utf8").split("\r").join("").split("\n")) {
      const trozo = linea.match(/^([A-Z0-9_]+)=(.*)$/);

      if (trozo) env[trozo[1]] = trozo[2].trim();
    }
  }

  for (const clave of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[clave]) env[clave] = process.env[clave];
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: ponlas en .env.local o en el entorno.",
    );
  }

  return env;
}

/* ------------------------------------------------------------------ */
/*  LA PASADA                                                          */
/* ------------------------------------------------------------------ */

const soloVer = process.argv.includes("--ver");

const jornadaPedida = (() => {
  const donde = process.argv.indexOf("--jornada");

  return donde >= 0 ? Number(process.argv[donde + 1]) : null;
})();

/** «1», «X» o «2» de un marcador. */
const signoDe = (local, visitante) =>
  local > visitante ? "1" : local < visitante ? "2" : "X";

async function main() {
  const calendario = calendarioQuiniela();

  if (calendario.length === 0) {
    throw new Error("No se ha podido leer lib/quiniela/calendario.ts");
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const jornadas = jornadaPedida
    ? [jornadaPedida]
    : jornadasQueTocan(calendario, hoy);

  console.log(`[quiniela] jornadas que se miran: ${jornadas.join(", ")}`);

  const env = entorno();

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: fila, error } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", CLAVE)
    .maybeSingle();

  if (error) throw new Error(`No se ha podido leer la quiniela: ${error.message}`);

  const doc = fila?.data ?? { jornadas: {}, jugadores: [] };

  doc.jornadas = doc.jornadas ?? {};

  let cambios = 0;

  for (const numero of jornadas) {
    const suyos = calendario.filter((uno) => uno.jornada === numero);

    if (suyos.length === 0) {
      console.warn(`[quiniela] la jornada ${numero} no está en el calendario.`);

      continue;
    }

    const guardada = doc.jornadas[String(numero)] ?? {
      jornada: numero,
      pronosticos: {},
      resultados: suyos.map(() => null),
    };

    /*
    | Una jornada que nadie apostó NO se toca.
    |
    | No es un detalle: la regla dice que no pronosticar cuenta como fallo en
    | cuanto el partido se ha jugado. Si esto escribiera los resultados de una
    | jornada anterior a que existiera la quiniela —la 1, la 2, la 3—, los diez
    | aparecerían con nueve fallos cada uno y el ranking quedaría inservible.
    | Sin apuestas no hay nada que corregir, así que no hay nada que escribir.
    */
    const apostaron = Object.values(guardada.pronosticos ?? {}).filter((suyos) =>
      (suyos ?? []).some(Boolean),
    ).length;

    if (apostaron === 0) {
      console.log(
        `\n[quiniela] jornada ${numero}: no la apostó nadie, así que no se tocan sus resultados.`,
      );

      continue;
    }

    const resultados = [...(guardada.resultados ?? [])];

    while (resultados.length < suyos.length) resultados.push(null);

    console.log(
      `\n[quiniela] jornada ${numero}: ${suyos.length} partidos · la apostaron ${apostaron}`,
    );

    for (const [indice, partido] of suyos.entries()) {
      const slug = SLUGS[partido.local];

      if (!slug) {
        console.warn(`  · ${partido.local}: sin ficha de BeSoccer. Repasar la tabla SLUGS.`);

        continue;
      }

      const partidos = await calendarioDe(slug);

      const suyo = partidos.find((uno) => {
        const jornadaDeBeSoccer = Number(
          (uno.competicion || "").match(/Jornada (\d+)/)?.[1] ?? 0,
        );

        return jornadaDeBeSoccer === numero;
      });

      if (!suyo) {
        console.log(`  · ${partido.local} - ${partido.visitante}: BeSoccer no trae esa jornada todavía`);

        continue;
      }

      /* La red de seguridad: que sea el partido que creemos. */
      if (
        !mismoEquipo(suyo.local.nombre, partido.local) ||
        !mismoEquipo(suyo.visitante.nombre, partido.visitante)
      ) {
        console.warn(
          `  · ${partido.local} - ${partido.visitante}: BeSoccer dice «${suyo.local.nombre} - ${suyo.visitante.nombre}». No coincide, se salta.`,
        );

        continue;
      }

      if (!suyo.jugado || suyo.local.goles === null || suyo.visitante.goles === null) {
        console.log(
          `  · ${partido.local} - ${partido.visitante}: sin jugar (${String(suyo.fecha).slice(0, 16)})`,
        );

        continue;
      }

      const signo = signoDe(suyo.local.goles, suyo.visitante.goles);

      const previo = resultados[indice] ?? null;

      if (previo === signo) {
        console.log(`  · ${partido.local} ${suyo.local.goles}-${suyo.visitante.goles} ${partido.visitante} · ${signo} (ya estaba)`);

        continue;
      }

      if (previo && previo !== signo) {
        console.warn(
          `  · ${partido.local} - ${partido.visitante}: estaba puesto «${previo}» y BeSoccer dice «${signo}» (${suyo.local.goles}-${suyo.visitante.goles}). Se corrige.`,
        );
      } else {
        console.log(
          `  · ${partido.local} ${suyo.local.goles}-${suyo.visitante.goles} ${partido.visitante} → ${signo}`,
        );
      }

      resultados[indice] = signo;

      cambios += 1;
    }

    doc.jornadas[String(numero)] = {
      ...guardada,
      jornada: numero,
      resultados,
      /* De dónde salen y de cuándo son, para poder decirlo en pantalla. */
      resultadosEn: new Date().toISOString(),
      origenResultados: "besoccer",
    };
  }

  if (cambios === 0) {
    console.log("\n[quiniela] nada nuevo que escribir.");

    return;
  }

  if (soloVer) {
    console.log(`\n[quiniela] --ver: habría escrito ${cambios} resultado(s).`);

    return;
  }

  const { error: alEscribir } = await supabase.from("app_documents").upsert(
    { key: CLAVE, kind: "quiniela", data: doc, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );

  if (alEscribir) throw new Error(`No se ha podido guardar: ${alEscribir.message}`);

  /* Releer: el `ok` de una escritura no es una comprobación. */
  const { data: despues } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", CLAVE)
    .maybeSingle();

  const puestos = jornadas.flatMap((numero) =>
    (despues?.data?.jornadas?.[String(numero)]?.resultados ?? []).filter(Boolean),
  ).length;

  console.log(`\n[quiniela] ${cambios} resultado(s) escritos. En total hay ${puestos} puestos en esas jornadas.`);
}

main().catch((error) => {
  console.error("[quiniela]", error.message);

  process.exit(1);
});
