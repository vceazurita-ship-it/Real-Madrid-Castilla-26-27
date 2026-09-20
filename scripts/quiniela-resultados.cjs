/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: se
   ejecuta con `node` desde el .cmd de la tarea nocturna, no lo empaqueta nadie,
   y el cargador de TypeScript necesita los ganchos de CommonJS. */

/**
 * LOS RESULTADOS DE LA QUINIELA, DE BESOCCER Y SOLOS.
 *
 * Lee de BeSoccer el 1-X-2 de los nueve partidos de la jornada y lo escribe en
 * el documento `quiniela` de Supabase. Con eso, el ranking y la parrilla de la
 * pantalla se ponen al día sin que nadie teclee nada.
 *
 * **El lector no está aquí**: está en `lib/quiniela/besoccer.ts`, que es el
 * mismo que usa el botón de Ajustes. Si BeSoccer cambia su HTML, se toca un
 * solo sitio. Lo único propio de este script es **cómo pide las páginas**: con
 * `curl`, igual que los otros tres scripts nocturnos.
 *
 * Corre en ESTE ordenador y no en un servidor: **BeSoccer bloquea las IP de
 * centro de datos** —al runner de GitHub le contestó 406 con cero bytes el
 * 01/09/2026— y desde una conexión normal funciona. Lo lanza
 * `scripts/jornada-nocturna.cmd`, que la tarea programada dispara a las 00:00 y
 * repite cada dos horas hasta que salga bien: con eso quedan cubiertas las
 * noches del viernes, del sábado y del domingo.
 *
 *   node scripts/quiniela-resultados.cjs              → la jornada de ahora y la anterior
 *   node scripts/quiniela-resultados.cjs --jornada 3  → una concreta
 *   node scripts/quiniela-resultados.cjs --ver        → dice qué haría, sin escribir
 *
 * Termina con una línea `RESUMEN: …`: es lo que el vigía (`scripts/vigia.cjs`)
 * copia a la pantalla de Ajustes cuando alguien pulsa el botón.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

require(path.join(RAIZ, "scripts/cargador-ts.cjs"));

const { createClient } = require(path.join(RAIZ, "node_modules/@supabase/supabase-js"));

const { traeResultados } = require(path.join(RAIZ, "lib/quiniela/besoccer.ts"));
const { CALENDARIO } = require(path.join(RAIZ, "lib/quiniela/calendario.ts"));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

const CLAVE = "quiniela";

const soloVer = process.argv.includes("--ver");

const jornadaPedida = (() => {
  const donde = process.argv.indexOf("--jornada");

  return donde >= 0 ? Number(process.argv[donde + 1]) : null;
})();

/* ------------------------------------------------------------------ */
/*  PEDIR PÁGINAS                                                      */
/* ------------------------------------------------------------------ */

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Una página con `curl`, con el código HTTP a la vista.
 *
 * El `-w` escribe el estado detrás del cuerpo. Sin eso, una respuesta
 * rechazada llega como cadena vacía y no hay forma de distinguir «no hay
 * partidos» de «no me dejan mirar».
 */
async function traePagina(url) {
  await espera(1200);

  const MARCA = "\n@@ESTADO@@";

  try {
    const salida = execFileSync(
      "curl",
      [
        "-s", "--compressed", "--max-time", "45",
        "-H", `User-Agent: ${UA}`,
        "-H", "Accept: text/html,application/xhtml+xml",
        "-H", "Accept-Language: es-ES,es;q=0.9",
        "-w", `${MARCA}%{http_code}`,
        url,
      ],
      { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
    );

    const corte = salida.lastIndexOf(MARCA);

    return corte === -1
      ? { cuerpo: salida, estado: 0 }
      : {
          cuerpo: salida.slice(0, corte),
          estado: Number(salida.slice(corte + MARCA.length).trim()) || 0,
        };
  } catch (error) {
    console.warn(`  (no se ha podido pedir ${url}: ${error.message})`);

    return { cuerpo: "", estado: 0 };
  }
}

/* ------------------------------------------------------------------ */
/*  QUÉ JORNADA TOCA                                                   */
/* ------------------------------------------------------------------ */

/**
 * La jornada de ahora **y la anterior**.
 *
 * Las dos, y no sólo la de hoy, porque el último partido se juega el domingo
 * por la noche y la tarea corre a las 00:00: para entonces el calendario ya
 * apunta a la siguiente y la recién jugada se quedaría sin su último resultado.
 */
function jornadasQueTocan(hoy) {
  const numeros = [...new Set(CALENDARIO.map((uno) => uno.jornada))].sort((a, b) => a - b);

  const deHoy =
    numeros.find((numero) => {
      const ultima = CALENDARIO.filter((uno) => uno.jornada === numero).reduce(
        (mayor, uno) => (uno.fecha > mayor ? uno.fecha : mayor),
        "",
      );

      return ultima >= hoy;
    }) ?? numeros[numeros.length - 1];

  return [deHoy - 1, deHoy].filter((numero) => numeros.includes(numero));
}

/* ------------------------------------------------------------------ */
/*  SUPABASE                                                           */
/* ------------------------------------------------------------------ */

function entorno() {
  const env = {};

  const fichero = path.join(RAIZ, ".env.local");

  if (fs.existsSync(fichero)) {
    for (const linea of fs.readFileSync(fichero, "utf8").split("\r").join("").split("\n")) {
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

async function main() {
  const hoy = new Date().toISOString().slice(0, 10);

  const jornadas = jornadaPedida ? [jornadaPedida] : jornadasQueTocan(hoy);

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

  /* Lo que cambia ESTE pase, partido a partido: es lo único que se escribirá. */
  const cambiados = [];

  const bloqueadas = [];

  const sinApuestas = [];

  for (const numero of jornadas) {
    const nuestros = CALENDARIO.filter((uno) => uno.jornada === numero);

    if (nuestros.length === 0) {
      console.warn(`[quiniela] la jornada ${numero} no está en el calendario.`);

      continue;
    }

    const guardada = doc.jornadas[String(numero)] ?? {
      jornada: numero,
      pronosticos: {},
      resultados: nuestros.map(() => null),
    };

    /*
    | Una jornada que nadie apostó NO se toca.
    |
    | No es un detalle: no pronosticar cuenta como fallo en cuanto el partido
    | se juega, así que escribir los resultados de una jornada anterior a la
    | quiniela pondría a los diez con nueve fallos y el ranking quedaría
    | inservible.
    */
    const apostaron = Object.values(guardada.pronosticos ?? {}).filter((suyos) =>
      (suyos ?? []).some(Boolean),
    ).length;

    if (apostaron === 0) {
      sinApuestas.push(numero);

      console.log(
        `\n[quiniela] jornada ${numero}: no la apostó nadie, así que no se tocan sus resultados.`,
      );

      continue;
    }

    console.log(
      `\n[quiniela] jornada ${numero}: ${nuestros.length} partidos · la apostaron ${apostaron}`,
    );

    const lectura = await traeResultados(numero, traePagina);

    if (lectura.bloqueado) {
      bloqueadas.push(numero);

      console.warn(
        `[quiniela] BeSoccer no ha contestado (${[...new Set(lectura.estados)].join(", ")}). Se deja para la próxima pasada.`,
      );

      continue;
    }

    const resultados = [...(guardada.resultados ?? [])];

    while (resultados.length < nuestros.length) resultados.push(null);

    for (const partido of lectura.partidos) {
      if (!partido.signo) {
        console.log(
          `  · ${partido.local} - ${partido.visitante}: ${partido.nota ?? "sin resultado"}${
            partido.cuando ? ` (${partido.cuando.slice(0, 16)})` : ""
          }`,
        );

        continue;
      }

      const previo = resultados[partido.indice] ?? null;

      if (previo === partido.signo) {
        console.log(
          `  · ${partido.local} ${partido.marcador} ${partido.visitante} · ${partido.signo} (ya estaba)`,
        );

        continue;
      }

      if (previo) {
        console.warn(
          `  · ${partido.local} - ${partido.visitante}: estaba «${previo}» y BeSoccer dice «${partido.signo}» (${partido.marcador}). Se corrige.`,
        );
      } else {
        console.log(
          `  · ${partido.local} ${partido.marcador} ${partido.visitante} → ${partido.signo}`,
        );
      }

      resultados[partido.indice] = partido.signo;

      cambiados.push({ jornada: numero, indice: partido.indice, signo: partido.signo });

      cambios += 1;
    }
  }

  if (cambios === 0) {
    console.log("\n[quiniela] nada nuevo que escribir.");

    console.log(
      `RESUMEN: ${
        bloqueadas.length > 0
          ? "BeSoccer no ha contestado; se reintentará"
          : sinApuestas.length === jornadas.length
            ? `nadie apostó la jornada ${jornadas.join(" ni la ")}: no se toca`
            : `nada nuevo en la jornada ${jornadas.join(" y ")}`
      }`,
    );

    if (bloqueadas.length > 0) process.exitCode = 1;

    return;
  }

  if (soloVer) {
    console.log(`\n[quiniela] --ver: habría escrito ${cambios} resultado(s).`);

    return;
  }

  /*
  | Releer y cambiar SÓLO los resultados.
  |
  | Entre la lectura de arriba y ahora han pasado las páginas de BeSoccer, y en
  | ese rato alguien puede haber guardado su apuesta: escribir la copia de
  | antes se la llevaría por delante. Esto corre también desde el botón de
  | Ajustes, a cualquier hora, así que no es una hipótesis.
  */
  const { data: ahora, error: alReleer } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", CLAVE)
    .maybeSingle();

  if (alReleer) throw new Error(`No se ha podido releer la quiniela: ${alReleer.message}`);

  const fresco = ahora?.data ?? doc;

  fresco.jornadas = fresco.jornadas ?? {};

  /*
  | Se aplican los signos UNO A UNO sobre lo recién leído.
  |
  | Antes se escribía el array entero de resultados construido con la copia de
  | hace medio minuto: si alguien marcaba un resultado a mano desde la pantalla
  | mientras el script bajaba las páginas, ese resultado se borraba —y encima
  | la jornada quedaba etiquetada como «besoccer»—. Y se tocaban también
  | jornadas en las que este pase no tenía nada que aportar.
  */
  for (const { jornada, indice, signo } of cambiados) {
    const clave = String(jornada);

    const previa = fresco.jornadas[clave] ?? { jornada, pronosticos: {}, resultados: [] };

    const resultados = [...(previa.resultados ?? [])];

    const cuantos = CALENDARIO.filter((uno) => uno.jornada === jornada).length;

    while (resultados.length < cuantos) resultados.push(null);

    resultados[indice] = signo;

    fresco.jornadas[clave] = {
      ...previa,
      jornada,
      resultados,
      /* De dónde salen y de cuándo son, para poder decirlo en pantalla. */
      resultadosEn: new Date().toISOString(),
      origenResultados: "besoccer",
    };
  }

  const { error: alEscribir } = await supabase.from("app_documents").upsert(
    { key: CLAVE, kind: "quiniela", data: fresco, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );

  if (alEscribir) throw new Error(`No se ha podido guardar: ${alEscribir.message}`);

  /* Releer: el `ok` de una escritura no es una comprobación. */
  const { data: despues } = await supabase
    .from("app_documents")
    .select("data")
    .eq("key", CLAVE)
    .maybeSingle();

  const tocadas = [...new Set(cambiados.map((uno) => String(uno.jornada)))];

  const puestos = tocadas.flatMap((numero) =>
    (despues?.data?.jornadas?.[numero]?.resultados ?? []).filter(Boolean),
  ).length;

  console.log(
    `\n[quiniela] ${cambios} resultado(s) escritos. En total hay ${puestos} puestos en esas jornadas.`,
  );

  console.log(
    `RESUMEN: ${cambios} resultado(s) nuevos · ${puestos} puestos en la jornada ${tocadas.join(" y ")}`,
  );
}

main()
  .then(() => {
    /* Sin `process.exit`: con el cliente de Supabase abierto, Node revienta en
       Windows con una aserción de libuv y el código de salida se va a 127. */
    const codigo = process.exitCode ?? 0;

    setTimeout(() => process.exit(codigo), 150).unref();
  })
  .catch((error) => {
    console.error("[quiniela]", error.message);

    process.exitCode = 1;

    setTimeout(() => process.exit(1), 150).unref();
  });
