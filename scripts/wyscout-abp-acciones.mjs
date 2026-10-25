#!/usr/bin/env node
/*
|--------------------------------------------------------------------------
| LAS ACCIONES A BALÓN PARADO DE CADA JORNADA, DESDE WYSCOUT
|--------------------------------------------------------------------------
|
| El laboratorio de ABP (/laboratorio/abp, «Lo mejor de cada jornada») enseña
| las mejores acciones a balón parado de cada jornada de cinco competiciones:
| los dos grupos de Primera RFEF, Segunda División, Premier League y Champions.
| Esto las baja de Wyscout, partido a partido, y las deja en
| `.cache/wyscout/abp-acciones/`; `scripts/abp-acciones.cjs` las compacta en
| `public/data/abp-acciones.json`.
|
|     node scripts/wyscout-abp-acciones.mjs              (todo lo nuevo)
|     node scripts/wyscout-abp-acciones.mjs --solo=premier-league
|     node scripts/wyscout-abp-acciones.mjs --max=5      (para probar)
|     node scripts/wyscout-abp-acciones.mjs --desatendido (la tarea diaria)
|
| CÓMO, Y POR QUÉ ASÍ (25/10/2026)
|
| Se usa el MISMO Chrome, perfil, sesión y login que `wyscout-liga.mjs`
| (se importan de allí: `abreChrome`, `conecta`, `esperaLogin`…). Una vez
| dentro, NO se hace ni un clic: todo son lecturas hechas DESDE la propia
| página, con su sesión, y lo único que sale de Chrome es el dato del partido.
| Ningún token ni cookie se lee desde aquí ni se escribe en un fichero.
|
|   1. La lista de partidos de cada competición sale del motor de la
|      plataforma: `POST /app/aengine-service.php` con
|      `{"obj":"match","act":"list.competition","params":{"competitionId":…,
|      "aenavi@page":N}}`. Va por cookie (mismo origen) y trae 25 por página,
|      de más nuevo a más viejo, con «Jornada: N» en el subtítulo.
|   2. Los eventos del partido salen del GraphQL de `searchapi.wyscout.com`
|      (`events(match:[id], type:[shot])` y `type:[corner, free_kick,
|      throw_in]`). La página pasa su propio `ae.getAccessToken()`; si el
|      token ha caducado, `ae.refreshToken()` lo renueva dentro de la página.
|
| Sólo lectura: ni listas, ni clips, ni descargas de XML (esas tienen cupo).
|
| INCREMENTAL
|
| Un fichero por partido en `.cache/wyscout/abp-acciones/<fuente>/<id>.json`.
| Un partido ya bajado no se vuelve a pedir, salvo que se bajara antes de
| 36 h después de jugarse (Wyscout aún puede estar revisando la etiqueta).
|
| CÓDIGOS DE SALIDA (los mismos que `wyscout-liga.mjs` donde coinciden)
|
|   0 algo nuevo bajado · 3 nada nuevo · 2 sesión caducada · 7 Chrome ocupado
|   8 incompleto (algún partido o competición falló) · 1 roto
*/

import fs from "node:fs";
import path from "node:path";
import {
  CACHE, abreChrome, conecta, reponeLasCookies, guardaLasCookies, esperaLogin, abreAplicacion,
} from "./wyscout-liga.mjs";
import { esperaTurno } from "./chrome-turno.mjs";

const espera = (ms) => new Promise((listo) => setTimeout(listo, ms));

function argumento(nombre) {
  const crudo = process.argv.find((a) => a.startsWith(`--${nombre}=`));

  return crudo ? crudo.slice(nombre.length + 3).replace(/^"|"$/g, "") || null : null;
}

const bandera = (nombre) => process.argv.includes(`--${nombre}`);

const CARPETA = path.join(CACHE, "abp-acciones");

/** La temporada 26/27 empezó en julio: lo de antes no se pide. */
const INICIO_TEMPORADA = "2026-07-01";

/*
| Las fuentes. Los ids son los del motor de la plataforma (aengine), comprobados
| el 25/10/2026 en la cuenta del club: Primera RFEF es una sola competición con
| los dos grupos dentro (el grupo se reparte al compactar, por equipo).
*/
const FUENTES = [
  {
    slug: "primera-rfef", nombre: "Primera RFEF (los dos grupos)", competicion: "-602",
    grupos: { "primera-rfef-g1": "51723", "primera-rfef-g2": "51724" },
  },
  { slug: "segunda", nombre: "Segunda División", competicion: "12" },
  { slug: "premier-league", nombre: "Premier League", competicion: "8" },
  { slug: "champions", nombre: "UEFA Champions League", competicion: "10" },
];

const SOLO = argumento("solo");
const MAX = Number(argumento("max") ?? 0);

/* ------------------------------------------------------------------ */
/*  LO QUE SE EJECUTA DENTRO DE LA PÁGINA                              */
/* ------------------------------------------------------------------ */

/*
| Se instala una vez en la pestaña. Las funciones viven en `window.__rmcfAbp`
| y devuelven sólo datos de partidos: el token se queda en la página.
*/
const AYUDANTES = `
  if (window.__rmcfAbp) return true;

  const motor = async (consulta) => {
    const r = await fetch("/app/aengine-service.php", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
      body: "query=" + encodeURIComponent(JSON.stringify(consulta)),
    });
    const texto = await r.text();
    try { return JSON.parse(texto); } catch { return { __roto: r.status + " " + texto.slice(0, 120) }; }
  };

  const grafo = async (query, variables) => {
    for (let intento = 0; intento < 2; intento++) {
      const u = new URL("https://searchapi.wyscout.com/graphql");
      u.searchParams.set("token", window.ae.getAccessToken());
      const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
      const texto = await r.text();
      let j = null;
      try { j = JSON.parse(texto); } catch { return { __roto: r.status + " " + texto.slice(0, 120) }; }
      const caducado = (j.errors || []).some((e) => e && e.extensions && e.extensions.action === "refresh_token");
      if (!caducado) return j;
      try { window.ae.refreshToken(); } catch (e) { /* se reintenta igual */ }
    }
    return { __roto: "token caducado y no se renueva" };
  };

  window.__rmcfAbp = { motor, grafo };
  return true;
`;

const CAMPOS = "id minute eventSec half teamId playerId player { shortName } x y rX rY xg types bodyPart length";

const CONSULTA_PARTIDO = `query($m: [ID!], $id: ID!) {
  tiros: events(match: $m, type: [shot], limit: 500) { ${CAMPOS} possession { firstEvent { id types eventSec } } }
  abp: events(match: $m, type: [corner, any_free_kick, throw_in], limit: 900) { ${CAMPOS} }
  partido: match(id: $id) { id name date score teamA { id name } teamB { id name } }
}`;

/* ------------------------------------------------------------------ */
/*  LISTAS                                                             */
/* ------------------------------------------------------------------ */

/** Los partidos de la temporada de una competición, página a página. */
async function partidosDe(nav, fuente) {
  const partidos = [];

  for (let pagina = 1; pagina <= 60; pagina++) {
    const r = await nav.js(`
      const p = { key: 0, competitionId: ${JSON.stringify(fuente.competicion)}, future_matches: 0 };
      p["aenavi@page"] = ${pagina};
      const j = await window.__rmcfAbp.motor({ obj: "match", act: "list.competition", params: p });
      if (j.__roto) return { roto: j.__roto };
      return {
        permiso: j.status ? j.status.permission !== false : true,
        paginas: j.navi ? j.navi.page_num : 1,
        lista: (j.list || []).map((x) => ({
          id: String(x.objId), titulo: x.title, subtitulo: String(x.subtitle || "").replace(/<[^>]*>/g, ""),
          fecha: x.data, eventos: Boolean(x.hasEvents),
        })),
      };
    `);

    if (r.roto) throw new Error(`la lista de partidos no contesta (${r.roto})`);

    if (!r.permiso) return null;

    let viejos = false;

    for (const x of r.lista) {
      if (String(x.fecha).slice(0, 10) < INICIO_TEMPORADA) {
        viejos = true;

        continue;
      }

      /* «Jornada: 9» en el subtítulo. */
      const jornada = Number((/Jornada:\s*(\d+)/i.exec(x.subtitulo) || [])[1]) || null;

      /* Jugado = el título trae el marcador («A - B 1 - 2»). */
      const jugado = /\d+\s-\s\d+\s*$/.test(x.titulo);

      partidos.push({ id: x.id, titulo: x.titulo, fecha: x.fecha, jornada, jugado, eventos: x.eventos });
    }

    if (viejos || pagina >= (r.paginas || 1) || !r.lista.length) break;
  }

  return partidos;
}

/** Equipo → grupo, para repartir Primera RFEF al compactar. */
async function gruposDe(nav, fuente) {
  const equipos = {};

  for (const [slug, grupo] of Object.entries(fuente.grupos ?? {})) {
    const lista = await nav.js(`
      const j = await window.__rmcfAbp.motor({ obj: "team", act: "list", params: { key: 0, competitionId: ${JSON.stringify(fuente.competicion)}, roundId: -22185, groupId: ${JSON.stringify(grupo)} } });
      return (j.list || []).filter((x) => x.objId).map((x) => ({ id: String(x.objId), nombre: x.title }));
    `);

    for (const e of lista) equipos[e.id] = { grupo: slug, nombre: e.nombre };
  }

  return equipos;
}

/* ------------------------------------------------------------------ */
/*  UN PARTIDO                                                         */
/* ------------------------------------------------------------------ */

/*
| Sin la posesión, por si acaso (25/10/2026): en algunos partidos pedir
| `possession` revienta el servidor (500, una página HTML de Rails). Sin ella
| se pierde sólo la marca de «segunda jugada», que se deduce igual por el
| tiempo entre el saque y el remate.
*/
const CONSULTA_SIN_POSESION = CONSULTA_PARTIDO.replace(" possession { firstEvent { id types eventSec } }", "");

/*
| Lo que se bajó con una consulta vieja se vuelve a pedir: la de antes del
| 25/10 no traía las faltas sin centro (`any_free_kick`).
*/
const VERSION_CONSULTA = 2;

async function bajaPartido(nav, id) {
  const pide = (consulta) =>
    nav.js(`
      const j = await window.__rmcfAbp.grafo(${JSON.stringify(consulta)}, { m: [${JSON.stringify(id)}], id: ${JSON.stringify(id)} });
      if (j.__roto) return { roto: j.__roto };
      if (j.errors && j.errors.length) return { roto: j.errors.map((e) => e.message).join("; ").slice(0, 200) };
      return j.data;
    `);

  let r = await pide(CONSULTA_PARTIDO);

  if (r?.roto && /^500/.test(r.roto)) r = await pide(CONSULTA_SIN_POSESION);

  if (r?.roto) throw new Error(r.roto.replace(/\s+/g, " ").slice(0, 120));

  return r;
}

const fichero = (fuente, id) => path.join(CARPETA, fuente.slug, `${id}.json`);

/** ¿Hace falta pedirlo? No, si ya está y se bajó con el partido asentado. */
function yaEsta(fuente, partido) {
  try {
    const previo = JSON.parse(fs.readFileSync(fichero(fuente, partido.id), "utf8"));

    const asentado = Date.parse(previo.bajadoEn) - Date.parse(String(partido.fecha).replace(" ", "T")) > 36 * 3_600_000;

    return asentado && previo.version === VERSION_CONSULTA;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

async function principal() {
  console.log("\n  RMCF · acciones a balón parado de cada jornada (Wyscout)\n");

  fs.mkdirSync(CARPETA, { recursive: true });

  if (!(await esperaTurno("Wyscout (acciones de ABP)"))) {
    console.log("\n  CHROME OCUPADO: otro proceso lleva hora y media con él; se deja para luego.\n");

    process.exitCode = 7;

    return;
  }

  const chrome = abreChrome();

  const nav = await conecta();

  if (await reponeLasCookies(nav)) {
    try {
      await nav.manda("Page.navigate", { url: "https://wyscout.hudl.com/app/" });

      await espera(4000);
    } catch {
      /* esperaLogin lo verá */
    }
  }

  let dentro = false;
  let nuevos = 0;
  const fallos = [];

  try {
    if (!(await esperaLogin(nav))) {
      console.log("  No se ha iniciado sesión. Nada que hacer.\n");

      process.exitCode = 2;

      return;
    }

    dentro = true;

    /* La cáscara de la plataforma (la de `window.ae`) tarda en pintarse. */
    const hayMotor = await nav.esperaValor(`return typeof (window.ae && window.ae.getAccessToken) === "function" ? 1 : 0;`, (v) => v === 1, 40);

    if (!hayMotor) {
      await abreAplicacion(nav, "Platform").catch(() => {});

      if (!(await nav.esperaValor(`return typeof (window.ae && window.ae.getAccessToken) === "function" ? 1 : 0;`, (v) => v === 1, 40))) {
        throw new Error("La plataforma no termina de cargar (no hay window.ae).");
      }
    }

    await nav.js(AYUDANTES);

    for (const fuente of FUENTES) {
      if (SOLO && !fuente.slug.startsWith(SOLO) && !Object.keys(fuente.grupos ?? {}).includes(SOLO)) continue;

      console.log(`  ${fuente.nombre}`);

      let partidos;

      try {
        partidos = await partidosDe(nav, fuente);
      } catch (error) {
        console.log(`    ✗ ${error.message}\n`);

        fallos.push(fuente.nombre);

        continue;
      }

      if (partidos === null || (!partidos.length && fuente.competicion)) {
        console.log("    ✗ No está en la cuenta de Wyscout (o no tiene partidos esta temporada): se sigue con las demás.\n");

        if (partidos === null) fallos.push(`${fuente.nombre} (sin acceso)`);

        continue;
      }

      const dir = path.join(CARPETA, fuente.slug);

      fs.mkdirSync(dir, { recursive: true });

      if (fuente.grupos) {
        try {
          const equipos = await gruposDe(nav, fuente);

          if (Object.keys(equipos).length) fs.writeFileSync(path.join(dir, "_grupos.json"), JSON.stringify(equipos), "utf8");
        } catch (error) {
          console.log(`    (los grupos no se leen: ${error.message}; se usa el reparto anterior)`);
        }
      }

      fs.writeFileSync(
        path.join(dir, "_partidos.json"),
        JSON.stringify({ actualizado: new Date().toISOString(), competicion: fuente.competicion, partidos }),
        "utf8",
      );

      const pendientes = partidos.filter((p) => p.jugado && p.eventos && !(bandera("rehacer") ? false : yaEsta(fuente, p)));

      const sinEtiquetar = partidos.filter((p) => p.jugado && !p.eventos).length;

      console.log(
        `    ${partidos.filter((p) => p.jugado).length} jugados · ${pendientes.length} por bajar` +
          (sinEtiquetar ? ` · ${sinEtiquetar} que Wyscout aún no ha etiquetado` : ""),
      );

      let hechos = 0;

      for (const p of MAX ? pendientes.slice(0, MAX) : pendientes) {
        try {
          const datos = await bajaPartido(nav, p.id);

          fs.writeFileSync(
            fichero(fuente, p.id),
            JSON.stringify({ bajadoEn: new Date().toISOString(), version: VERSION_CONSULTA, id: p.id, jornada: p.jornada, fecha: p.fecha, titulo: p.titulo, ...datos }),
            "utf8",
          );

          hechos++;
          nuevos++;

          if (hechos % 20 === 0) console.log(`    … ${hechos}/${pendientes.length}`);
        } catch (error) {
          console.log(`    ✗ ${p.titulo}: ${error.message}`);

          fallos.push(`${p.titulo}`);

          /* Si se ha caído la sesión, no tiene sentido seguir pidiendo. */
          if (/login|401|403|caducado/i.test(error.message)) throw error;
        }

        await espera(250);
      }

      console.log(`    ✓ ${hechos} bajados\n`);
    }

    if (fallos.length) {
      console.log(`\n  INCOMPLETO: ${fallos.slice(0, 8).join(" · ")}${fallos.length > 8 ? ` y ${fallos.length - 8} más` : ""}\n`);

      process.exitCode = 8;
    } else {
      process.exitCode = nuevos ? 0 : 3;
    }

    console.log(`  RESUMEN: ${nuevos} partidos nuevos con sus acciones a balón parado${fallos.length ? ` (${fallos.length} fallos)` : ""}.`);
  } finally {
    if (dentro) await guardaLasCookies(nav);

    try {
      await nav.manda("Browser.close");

      await espera(2500);
    } catch {
      /* ya se había ido */
    }

    nav.cierra();

    chrome.kill();
  }
}

principal().catch((error) => {
  console.error("\n  Se ha roto:", error.message, "\n");

  process.exit(1);
});
