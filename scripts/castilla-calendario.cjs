/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club desde el .cmd nocturno, no lo empaqueta nadie. */
/**
 * NUESTRO CALENDARIO, DE BESOCCER.
 *
 * La plataforma sabía las fechas de los rivales pero no las nuestras: el
 * calendario de la quiniela se quedó **sin los partidos del Castilla** a
 * propósito (los pronósticos van por índice) y las hojas no traen la hora. Y
 * sin la fecha del próximo partido no se puede montar la semana: no es lo mismo
 * de domingo a domingo que de sábado a viernes.
 *
 * Así que se lee la ficha del Castilla en BeSoccer y se guarda en Supabase, en
 * el documento **`castilla:calendario`**:
 *
 *   { partidos: [...], actualizadoEn }
 *
 * De ahí come `/abp-microciclo` para proponer el boceto de la semana.
 *
 * Corre en ESTE ordenador y no en el servidor: BeSoccer contesta a las IP de
 * centro de datos con una página sin calendario ([[jornada-nocturna]]). Va como
 * un paso más de `scripts/jornada-nocturna.cmd`.
 *
 *   node scripts/castilla-calendario.cjs          → lo baja y lo guarda
 *   node scripts/castilla-calendario.cjs --ver    → lo enseña, sin escribir
 */

const { execFileSync } = require("node:child_process");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

require(path.join(RAIZ, "scripts/cargador-ts.cjs"));

const { createClient } = require(path.join(RAIZ, "node_modules/@supabase/supabase-js"));

const { leeCalendario } = require(path.join(RAIZ, "lib/quiniela/besoccer.ts"));
const { CLAVE_CALENDARIO, DESDE, ordenaPartidos } = require(
  path.join(RAIZ, "lib/castilla/calendario.ts"),
);

const { entorno, salir } = require(path.join(RAIZ, "scripts/supabase-local.cjs"));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

const URL_CASTILLA = "https://es.besoccer.com/equipo/partidos/rm-castilla";

const soloVer = process.argv.includes("--ver");

function pagina(url) {
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

async function main() {
  const { cuerpo, estado } = pagina(URL_CASTILLA);

  const todos = cuerpo ? leeCalendario(cuerpo) : [];

  /*
  | La página trae DOS temporadas, las dos con «Jornada 4».
  |
  | Es la misma trampa que costó los resultados de la quiniela: aquí se corta
  | por fecha, que es lo único que las separa de verdad.
  */
  const partidos = ordenaPartidos(todos.filter((uno) => uno.cuando >= DESDE));

  if (partidos.length === 0) {
    console.error(
      `[calendario] BeSoccer ha contestado ${estado} con ${cuerpo.length} bytes y ningún partido de esta temporada.` +
        (estado === 200 ? " Página sin calendario: es el bloqueo a los servidores." : ""),
    );

    console.log("RESUMEN: BeSoccer no ha dado el calendario del Castilla");

    return salir(1);
  }

  const jugados = partidos.filter((uno) => uno.golesLocal !== null).length;

  console.log(`[calendario] ${partidos.length} partidos, ${jugados} jugados.`);

  const siguiente = partidos.find((uno) => uno.golesLocal === null);

  if (siguiente) {
    console.log(
      `[calendario] el próximo: J${siguiente.jornada} · ${siguiente.cuando} · ${siguiente.local} - ${siguiente.visitante}`,
    );
  }

  if (soloVer) {
    for (const uno of partidos.slice(0, 8)) {
      console.log(`  J${uno.jornada} ${uno.cuando} ${uno.local} - ${uno.visitante}`);
    }

    return salir(0);
  }

  const env = entorno();

  if (!env) {
    console.error("[calendario] faltan las llaves de Supabase.");

    return salir(1);
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase.from("app_documents").upsert(
    {
      key: CLAVE_CALENDARIO,
      kind: "castilla",
      data: { partidos, actualizadoEn: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    console.error(`[calendario] no se ha podido guardar: ${error.message}`);

    return salir(1);
  }

  console.log(
    `RESUMEN: calendario del Castilla al día (${partidos.length} partidos${
      siguiente ? `, el próximo el ${siguiente.cuando.slice(0, 10)}` : ""
    })`,
  );

  return salir(0);
}

main().catch((error) => {
  console.error(`[calendario] ${error.message}`);

  salir(1);
});
