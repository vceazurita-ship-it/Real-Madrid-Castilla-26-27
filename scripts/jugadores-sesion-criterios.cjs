/*
|--------------------------------------------------------------------------
| PRUEBA DE LOS CRITERIOS DE JUGADORES SESIÓN CON DATOS REALES (02/11/2026)
|--------------------------------------------------------------------------
|
|   node scripts/jugadores-sesion-criterios.cjs [AAAA-MM-DD] [número de tarea]
|
| Sólo LEE: las sesiones y la pizarra táctica de Supabase (GET a la API REST),
| la plantilla de la hoja (CSV publicado) y Wyscout del disco (public/data).
| No escribe nada en ningún sitio.
|
| Para la sesión pedida (por defecto la última) y una de sus tareas, propone
| los equipos con cada criterio y comprueba lo que no se puede romper: nadie
| sin sitio, nadie en dos, los de fuera siguen fuera, los comodines que pide la
| tarea, equipos de tamaño parejo; y que cada criterio hace lo suyo
| (titulares juntos, la mezcla parcial al 0 % es titulares contra suplentes,
| sinergias y perfiles mejoran su medida sin descompensar líneas). Enseña
| además la línea que explica cada equipo y lo aprendido de los que suben.
*/

require("./cargador-ts.cjs");

const { entorno } = require("./supabase-local.cjs");
const Papa = require("papaparse");
const { proponeConCriterio, CRITERIOS, lineaDe } = require("../lib/sesion-equipos/criterios.ts");
const { puestosDeLaSesion } = require("../lib/sesion-equipos/puestos.ts");
const { titularesDeLaSesion, jugadoresConWyscout, parejasDeLaSesion, rasgosDeLaSesion } = require("../lib/sesion-equipos/fuentes.ts");
const { onceDeLaPizarra } = require("../lib/tactics/onceDeLaPizarra.ts");
const { claveNombre, casaPalabra, FUERA, COMODIN, repartoDe } = require("../lib/sesion-equipos/modelo.ts");
const { demarcacion } = require("../lib/sesion-equipos/demarcacion.ts");
const { leeDatos } = require("../lib/data-analisis/leer.ts");
const { posicionDe } = require("../lib/posiciones.ts");

const PLANTILLA_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=205498392&single=true&output=csv";

/* Azar con semilla: la prueba sale igual cada vez. */
function semilla(s) {
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

let fallos = 0;
const comprueba = (ok, texto) => {
  if (!ok) fallos += 1;
  console.log(`  ${ok ? "ok " : "MAL"} ${texto}`);
};

(async () => {
  const env = entorno();

  if (!env) {
    console.log("RESUMEN: faltan las llaves de Supabase en .env.local");
    process.exitCode = 1;
    return;
  }

  const leeDoc = async (key) => {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/app_documents?key=eq.${encodeURIComponent(key)}&select=data`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    const j = await r.json();
    return j?.[0]?.data ?? null;
  };

  /* `onceDeLaPizarra` pide /api/docs como en el navegador: aquí va a la API REST, sólo GET. */
  const fetchReal = global.fetch;
  global.fetch = async (url, init) => {
    if (typeof url === "string" && url.startsWith("/api/docs?key=")) {
      if (init?.method && init.method !== "GET") throw new Error("La prueba no escribe");
      const key = decodeURIComponent(url.split("key=")[1]);
      return { json: async () => ({ data: await leeDoc(key) }) };
    }
    return fetchReal(url, init);
  };

  const almacen = await leeDoc("jugadores-sesion");
  const once = await onceDeLaPizarra();
  const csv = await (await fetchReal(PLANTILLA_CSV)).text();
  /* Como `cargaPlantilla` (hooks/usePlayers.ts): sólo los activos y el puesto corregido por lib/posiciones.ts. */
  const plantilla = Papa.parse(csv, { header: true, skipEmptyLines: true })
    .data.filter((p) => p.ACTIVO === "TRUE")
    .map((p) => ({ nombre: p.NOMBRE ?? "", apodo: p.APODO || p.NOMBRE || "", posicion: posicionDe(p.NOMBRE ?? "", p.POSICION ?? "") }));
  const datos = await leeDatos();
  const filas = datos.jugadores;

  const fecha = process.argv[2];
  const sesiones = [...(almacen?.sesiones ?? [])].sort((a, b) => (b.fecha ?? b.creadaEn).localeCompare(a.fecha ?? a.creadaEn));
  const sesion = (fecha && sesiones.find((s) => s.fecha === fecha)) || sesiones[0];
  const numTarea = Math.max(1, Number(process.argv[3] ?? 1)) - 1;
  const tarea = sesion.tareas[Math.min(numTarea, sesion.tareas.length - 1)];

  console.log(`${sesiones.length} sesiones · ${sesion.titulo} · «${tarea.nombre}» (${tarea.equipos.length} equipos, ${tarea.comodines} comodines)`);
  console.log(`Pizarra: ${once ? `${once.escena}, ${once.fichas.length} fichas` : "sin tablero de onces"} · Plantilla: ${plantilla.length} · Wyscout: ${filas.length} filas`);

  const { puestoDe, demarcacionDe, resuelve, aprendido } = puestosDeLaSesion(sesion.jugadores, plantilla, almacen);

  /* Los nombres de cada uno: el de la lista y los de su ficha de la plantilla. */
  const nombresDe = (j) => {
    const suyas = new Set(claveNombre(j.nombre).split(" "));
    const fichas = plantilla.filter((f) =>
      [f.nombre, f.apodo].some((n) => {
        const pals = claveNombre(n || "").split(" ").filter((p) => p.length > 1);
        return pals.length > 0 && pals.every((p) => casaPalabra(p, suyas));
      }),
    );
    return [j.nombre, ...fichas.flatMap((f) => [f.nombre, f.apodo].filter(Boolean))];
  };

  const titulares = titularesDeLaSesion(once, sesion.jugadores, nombresDe);
  const conWys = jugadoresConWyscout(sesion.jugadores, filas, demarcacionDe, nombresDe);
  const parejas = parejasDeLaSesion(conWys, filas);
  const rasgos = rasgosDeLaSesion(conWys, filas);

  console.log(`\nTitulares de la pizarra en la sesión (${titulares.size}): ${sesion.jugadores.filter((j) => titulares.has(j.id)).map((j) => j.nombre).join(", ")}`);
  console.log(`Con fila de Wyscout: ${conWys.length} · parejas juzgadas: ${parejas.length} · con rasgo: ${Object.keys(rasgos).length}`);
  for (const p of parejas.slice(0, 6)) console.log(`   ${p.saldo > 0 ? "+" : ""}${p.saldo} ${sesion.jugadores.find((j) => j.id === p.a).nombre} / ${sesion.jugadores.find((j) => j.id === p.b).nombre}: ${p.motivo}`);

  console.log("\nPuesto de cada uno (origen):");
  for (const j of sesion.jugadores) {
    const r = resuelve(j);
    const ap = aprendido[claveNombre(j.nombre)];
    console.log(
      `   ${j.nombre.padEnd(22)} ${(j.etiqueta ?? "").padEnd(8)} ${(demarcacion(r.demarcacion)?.corto ?? "·").padEnd(4)} ${(r.origen ?? "").padEnd(9)} ${puestoDe(j) ?? ""}${ap ? `  aprendido ${ap.demarcacion ?? ""} (${ap.veces} veces)` : ""}${rasgos[j.id] ? `  rasgo ${rasgos[j.id].rotulo} p${rasgos[j.id].percentil}` : ""}`,
    );
  }

  /* Lo que nunca se puede romper. */
  const invariantes = (nombre, t) => {
    const r = repartoDe(t, sesion.jugadores);
    const fueraAntes = Object.entries(tarea.sitio).filter(([, d]) => d === FUERA).map(([id]) => id);
    const tam = t.equipos.map((e) => r.porEquipo[e.id].length);
    comprueba(r.sinSitio.length === 0, `${nombre}: nadie sin sitio`);
    comprueba(fueraAntes.every((id) => t.sitio[id] === FUERA), `${nombre}: los de fuera siguen fuera`);
    comprueba(r.comodines.length === Math.min(tarea.comodines, sesion.jugadores.length), `${nombre}: ${tarea.comodines} comodín(es)`);
    comprueba(Math.max(...tam) - Math.min(...tam) <= 1, `${nombre}: equipos de ${tam.join("-")}`);
    comprueba(!r.comodines.some((j) => puestoDe(j) === "POR"), `${nombre}: ningún portero de comodín`);
    return r;
  };

  const base = { puestoDe, titulares, parejas, rasgos };
  const resultados = {};

  for (const c of CRITERIOS) {
    for (const extra of c.clave === "parcial" ? [{ mezcla: 0 }, { mezcla: 50 }, { mezcla: 100 }] : c.clave === "perfiles" ? [{ modoPerfiles: "repartidos" }, { modoPerfiles: "juntos" }] : [{}]) {
      const etiqueta = `${c.rotulo}${extra.mezcla !== undefined ? ` ${extra.mezcla} %` : ""}${extra.modoPerfiles ? ` (${extra.modoPerfiles})` : ""}`;
      const p = proponeConCriterio(tarea, sesion.jugadores, { ...base, ...extra, criterio: c.clave, azar: semilla(7) });

      console.log(`\n== ${etiqueta}${p.aviso ? ` · AVISO: ${p.aviso}` : ""}`);
      for (const l of p.lineas) console.log(`   ${l.nombre}: ${l.texto}`);

      const r = invariantes(etiqueta, p.tarea);
      resultados[etiqueta] = { p, r };
    }
  }

  /* Que cada criterio haga lo suyo. */
  console.log("\nCada criterio, lo suyo:");
  const titEn = (r, e) => r.porEquipo[e.id].filter((j) => titulares.has(j.id)).length;

  if (titulares.size) {
    const { p, r } = resultados["Titulares vs suplentes"];
    const t0 = titEn(r, p.tarea.equipos[0]);
    const enEquipo = sesion.jugadores.filter((j) => titulares.has(j.id) && p.tarea.sitio[j.id] && p.tarea.sitio[j.id] !== FUERA && p.tarea.sitio[j.id] !== COMODIN).length;
    comprueba(t0 === Math.min(enEquipo, r.porEquipo[p.tarea.equipos[0].id].length), `Titulares: ${t0} titulares juntos en ${p.tarea.equipos[0].nombre}`);

    const p0 = resultados["Mezcla parcial 0 %"];
    comprueba(titEn(p0.r, p0.p.tarea.equipos[0]) === t0, "Mezcla parcial 0 %: igual que titulares contra suplentes");

    const p100 = resultados["Mezcla parcial 100 %"];
    const repartidos = p100.p.tarea.equipos.map((e) => titEn(p100.r, e));
    comprueba(Math.max(...repartidos) - Math.min(...repartidos) <= 2, `Mezcla parcial 100 %: titulares ${repartidos.join("-")}`);

    const m = resultados["Mezcla total"];
    const mt = m.p.tarea.equipos.map((e) => titEn(m.r, e));
    comprueba(Math.max(...mt) - Math.min(...mt) <= 1, `Mezcla total: titulares ${mt.join("-")}`);
  }

  const lineas = resultados["Por líneas"];
  for (const e of lineas.p.tarea.equipos) {
    const lista = lineas.r.porEquipo[e.id];
    const tiene = (l) => lista.some((j) => lineaDe(j, puestoDe) === l);
    const hay = (l) => sesion.jugadores.some((j) => lineaDe(j, puestoDe) === l && lineas.p.tarea.sitio[j.id] && ![FUERA, COMODIN].includes(lineas.p.tarea.sitio[j.id]));
    const todas = ["DEF", "MED", "ARR"].filter(hay).every(tiene);
    comprueba(todas || lista.length < 4, `Por líneas: ${e.nombre} con defensas, medios y arriba`);
  }

  const valorSinergia = (t) => parejas.reduce((s, p) => s + (t.sitio[p.a] && t.sitio[p.a] === t.sitio[p.b] && ![FUERA, COMODIN].includes(t.sitio[p.a]) ? p.saldo : 0), 0);
  if (parejas.length) {
    const vs = valorSinergia(resultados["Sinergias"].p.tarea);
    const vl = valorSinergia(lineas.p.tarea);
    comprueba(vs >= vl, `Sinergias: saldo de las parejas juntas ${vs} (por líneas daba ${vl})`);
  }

  const lineasIguales = (a, b) =>
    a.p.tarea.equipos.every((e) =>
      ["POR", "DEF", "MED", "ARR", "?"].every(
        (l) => a.r.porEquipo[e.id].filter((j) => lineaDe(j, puestoDe) === l).length === b.r.porEquipo[e.id].filter((j) => lineaDe(j, puestoDe) === l).length,
      ),
    );
  if (parejas.length) comprueba(lineasIguales(resultados["Sinergias"], lineas), "Sinergias: las líneas de cada equipo, como por líneas");
  if (Object.keys(rasgos).length >= 2) comprueba(lineasIguales(resultados["Por perfiles (repartidos)"], lineas), "Perfiles: las líneas de cada equipo, como por líneas");

  console.log(`\nRESUMEN: ${fallos ? `${fallos} comprobaciones fallan` : "todo bien"} (no se ha escrito nada).`);
  process.exitCode = fallos ? 1 : 0;
})();
