/**
 * QUÉ HAY QUE BAJAR DE WYSCOUT, Y CÓMO HAN QUEDADO LOS DATOS (04/11/2026).
 *
 * El cerebro de la descarga incremental: mira la carpeta `public/data/wys`, el
 * calendario del Castilla (BeSoccer, `castilla:calendario`, sólo lectura) y el
 * punto de control de la pasada anterior, y dice qué equipos y qué lotes de
 * jugadores tocan. Las reglas están en `lib/data-analisis/wyscout-al-dia.ts`.
 *
 *   node scripts/wyscout-al-dia.cjs --ver              en seco: qué bajaría y cómo están los datos (no escribe nada)
 *   node scripts/wyscout-al-dia.cjs --empieza          abre una pasada nueva en el punto de control
 *   node scripts/wyscout-al-dia.cjs --equipos          el plan de equipos   → «PLAN: {...}»
 *   node scripts/wyscout-al-dia.cjs --jugadores        el plan de jugadores → «PLAN: {...}»
 *   node scripts/wyscout-al-dia.cjs --paso=releer      apunta el paso en el que va
 *   node scripts/wyscout-al-dia.cjs --cierra --codigo=N [--registro=fichero.log]
 *                                                      cierra la pasada y apunta cómo quedan los datos
 *
 * Con RMCF_COMPLETO=1 en el entorno (o `--completo`), el plan es «todo».
 * Lo usan `wyscout-semanal.cmd` y `wyscout-liga.mjs --incremental`.
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

const punto = require(path.join(RAIZ, "scripts", "wyscout-punto.cjs"));

const CARPETA = path.join(RAIZ, "public", "data", "wys");

const CALENDARIO_LOCAL = path.join(RAIZ, ".cache", "wyscout", "calendario.json");

const quiere = (flag) => process.argv.includes(flag);

const argumento = (nombre) => {
  const crudo = process.argv.find((a) => a.startsWith(`--${nombre}=`));

  return crudo ? crudo.slice(nombre.length + 3).replace(/^"|"$/g, "") : null;
};

const completo = quiere("--completo") || process.env.RMCF_COMPLETO === "1";

const hoyMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

/* --------------------------- LA CARPETA --------------------------- */

/** Las filas de todos los «Team Stats» y, por equipo, su fichero. */
function leeCarpeta(guardado) {
  require(path.join(RAIZ, "scripts", "cargador-ts.cjs"));

  const { partidosDeXlsx } = require(path.join(RAIZ, "lib", "data-analisis", "leer.ts"));

  const partidos = [];

  const porEquipo = new Map();

  let nombres = [];

  try {
    nombres = fs.readdirSync(CARPETA);
  } catch {
    nombres = [];
  }

  for (const nombre of nombres) {
    const base = /^Team Stats (.+?)(?: \(\d+\))?\.xlsx$/i.exec(nombre)?.[1];

    if (!base) continue;

    let filas = [];

    try {
      filas = partidosDeXlsx(fs.readFileSync(path.join(CARPETA, nombre)));
    } catch {
      continue;
    }

    partidos.push(...filas);

    const suyo = porEquipo.get(base) ?? { cuantas: new Map(), mtime: 0 };

    for (const f of filas) suyo.cuantas.set(f.equipo, (suyo.cuantas.get(f.equipo) ?? 0) + 1);

    suyo.mtime = Math.max(suyo.mtime, fs.statSync(path.join(CARPETA, nombre)).mtimeMs);

    porEquipo.set(base, suyo);
  }

  /* El equipo de un fichero es el que sale en todas sus filas (las otras son de sus rivales, una por partido). */
  const ficheros = [...porEquipo.entries()]
    .filter(([, s]) => s.cuantas.size)
    .map(([equipo, s]) => ({
      equipo,
      fila: [...s.cuantas.entries()].sort((a, b) => b[1] - a[1])[0][0],
      bajadoEn: guardado.equipos?.[equipo]?.bajadoEn ?? new Date(s.mtime).toISOString(),
    }));

  return { partidos, ficheros };
}

/* --------------------------- EL CALENDARIO --------------------------- */

/** El calendario del Castilla: Supabase (sólo lectura) y, si no hay red, la copia de la última vez. */
async function calendario() {
  const { entorno } = require(path.join(RAIZ, "scripts", "supabase-local.cjs"));

  const env = entorno();

  if (env) {
    try {
      const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/app_documents?key=eq.castilla:calendario&select=data`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
        signal: AbortSignal.timeout(20_000),
      });

      if (r.ok) {
        const partidos = (await r.json())[0]?.data?.partidos ?? [];

        if (partidos.length) {
          fs.mkdirSync(path.dirname(CALENDARIO_LOCAL), { recursive: true });
          fs.writeFileSync(CALENDARIO_LOCAL, JSON.stringify({ leidoEn: new Date().toISOString(), partidos }), "utf8");

          return partidos;
        }
      }
    } catch {
      /* sin red: la copia */
    }
  }

  try {
    return JSON.parse(fs.readFileSync(CALENDARIO_LOCAL, "utf8")).partidos ?? [];
  } catch {
    return [];
  }
}

/* --------------------------- LO QUE SE PIDE --------------------------- */

const reglas = () => {
  require(path.join(RAIZ, "scripts", "cargador-ts.cjs"));

  return require(path.join(RAIZ, "lib", "data-analisis", "wyscout-al-dia.ts"));
};

const existeLote = (n) => fs.existsSync(path.join(CARPETA, `Player Stats ${n}.xlsx`));

async function planes() {
  const guardado = punto.lee();

  const { partidos, ficheros } = leeCarpeta(guardado);

  const cal = await calendario();

  const hoy = hoyMadrid();

  const { planEquipos, planJugadores, estadoDatos } = reglas();

  return {
    guardado,
    equipos: planEquipos({ partidos, calendario: cal, hoy, ficheros, punto: guardado, completo }),
    jugadores: planJugadores({ partidos, calendario: cal, hoy, ficheros, punto: guardado, completo, existe: existeLote }),
    estado: estadoDatos({ partidos, calendario: cal, hoy, punto: guardado }),
    cal,
  };
}

/** El final de un registro a partir de su última sección («--- Publicando ---»): por qué falló el .cmd. */
function colaDelRegistro(fichero) {
  try {
    const completo = fs.readFileSync(fichero, "latin1");

    /* Sin la sección del propio cierre, que se escribe justo antes de llamarlo. */
    const cierre = completo.lastIndexOf("--- Como quedan los datos");

    const texto = cierre >= 0 ? completo.slice(0, cierre) : completo;

    const desde = texto.lastIndexOf("\n---");

    return texto
      .slice(desde >= 0 ? desde : Math.max(0, texto.length - 2000))
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^---/.test(l))
      .slice(-8)
      .join(" · ")
      .slice(0, 400);
  } catch {
    return "";
  }
}

const fechaCorta = (iso) => {
  const [, m, d] = String(iso).slice(0, 10).split("-");

  return `${d}/${m}`;
};

function cuentaEstado(estado) {
  const lineas = [];

  if (estado.ultimaCompleta) lineas.push(`Última jornada completa: J${estado.ultimaCompleta.jornada} (${fechaCorta(estado.ultimaCompleta.fecha)}), los ${estado.equipos} equipos con su partido.`);

  if (estado.ultimoCastilla) lineas.push(`Último partido del Castilla en los datos: J${estado.ultimoCastilla.jornada} contra ${estado.ultimoCastilla.rival} (${fechaCorta(estado.ultimoCastilla.fecha)}).`);

  for (const f of estado.faltan) lineas.push(`Falta J${f.jornada} (${fechaCorta(f.fecha)}): ${f.que}${f.abierta ? ", la jornada sigue abierta" : ""}.`);

  return lineas;
}

/* --------------------------- EL PROGRAMA --------------------------- */

(async () => {
  if (quiere("--ver")) {
    const { equipos, jugadores, estado, cal } = await planes();

    console.log(`\n  EN SECO · nada se baja ni se escribe${completo ? " · pedida completa" : ""}\n`);
    console.log(`  calendario: ${cal.length} partidos del Castilla`);
    console.log(`\n  Equipos (${equipos.modo}): ${equipos.motivo}`);

    for (const e of equipos.equipos) console.log(`    · ${e}: ${equipos.porque[e]}`);

    console.log(`\n  Jugadores (${jugadores.modo}): ${jugadores.motivo}`);

    for (const l of jugadores.lotes) console.log(`    · lote ${l.numero} (${l.equipos.join(", ")}): ${l.porque}`);

    console.log("\n  Cómo están los datos:");

    for (const l of cuentaEstado(estado)) console.log(`    ${l}`);

    console.log("\n  (los jugadores se vuelven a mirar después de bajar los equipos: lo nuevo puede sumar lotes)\n");

    return;
  }

  if (quiere("--empieza")) {
    punto.cambia((p) => {
      const ahora = new Date().toISOString();

      p.pasada = { id: ahora, empezadaEn: ahora, paso: "plan", plan: { equipos: [], lotes: [] }, hechos: { equipos: [], lotes: [] }, fallidos: { equipos: [], lotes: [] } };

      if (completo) {
        p.pasada.modo = "completa";
        p.pasada.motivo = "pedida completa, desde cero";
      }
    });

    return;
  }

  if (quiere("--equipos") || quiere("--jugadores")) {
    const { equipos, jugadores } = await planes();

    const plan = quiere("--equipos") ? equipos : jugadores;

    punto.cambia((p) => {
      const pasada = punto.pasada(p);

      if (quiere("--equipos")) {
        pasada.modo = equipos.modo;
        pasada.motivo = equipos.motivo;
      } else if (jugadores.modo === "completa" && pasada.modo !== "completa") {
        pasada.motivo = `${pasada.motivo ?? ""}${pasada.motivo ? "; " : ""}jugadores: ${jugadores.motivo}`;
      }
    });

    console.log(`PLAN: ${JSON.stringify(plan)}`);

    return;
  }

  const paso = argumento("paso");

  if (paso) {
    punto.cambia((p) => {
      const pasada = punto.pasada(p);

      pasada.paso = paso;

      /* Un paso nuevo deja atrás el error de otro anterior (al repetir sólo
         lo que falló, la pasada es la misma): si vuelve a fallar, el suyo. */
      const reanudada = pasada.codigo !== undefined;

      if (pasada.fallo && (reanudada || (pasada.fallo.paso !== "equipos" && pasada.fallo.paso !== "jugadores"))) delete pasada.fallo;

      delete pasada.terminadaEn;
      delete pasada.codigo;
    });

    return;
  }

  if (quiere("--cierra")) {
    const codigo = Number(argumento("codigo") ?? 1);

    const ok = codigo === 0 || codigo === 3;

    const registro = argumento("registro");

    punto.cambia((p) => {
      const pasada = punto.pasada(p);

      const ahora = new Date().toISOString();

      pasada.terminadaEn = ahora;
      pasada.codigo = codigo;

      if (ok) pasada.paso = "hecha";

      /* Lo que no apuntó la descarga (releer, publicar): el final del registro. */
      if (!ok && !pasada.fallo && registro) {
        const detalle = colaDelRegistro(registro);

        if (detalle) pasada.fallo = { paso: pasada.paso ?? "publicar", detalle };
      }

      if (ok && pasada.modo === "completa" && !pasada.incompleto?.length) p.ultimaCompleta = ahora;

      /* La primera vez no hay completa que contar: se empieza a contar hoy. */
      p.ultimaCompleta ??= ahora;
    });

    const { estado } = await planes();

    punto.cambia((p) => {
      p.estado = estado;
    });

    for (const l of cuentaEstado(estado)) console.log(l);

    return;
  }

  console.log("Uso: --ver | --empieza | --equipos | --jugadores | --paso=X | --cierra --codigo=N");
})().catch((error) => {
  console.log(`(punto de control de Wyscout: ${error.message})`);

  /* Nunca tumba la pasada: sin plan, la descarga hace lo de siempre. */
  process.exitCode = quiere("--equipos") || quiere("--jugadores") ? 1 : 0;
});
