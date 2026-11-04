/**
 * EL PUNTO DE CONTROL DE LA DESCARGA DE WYSCOUT (04/11/2026).
 *
 * Un JSON en `.cache/wyscout/punto-de-control.json` que cada paso de la pasada
 * va apuntando: qué había que bajar, qué ha bajado ya, en qué paso va y, si
 * falla, el primer error. La pasada siguiente parte de ahí y no repite lo que
 * ya está. La forma está en `lib/data-analisis/wyscout-al-dia.ts`.
 *
 * Lo escriben `wyscout-liga.mjs` (equipos y lotes, uno a uno) y
 * `wyscout-al-dia.cjs` (el plan, los pasos del .cmd y el cierre); lo lee el
 * vigía al acabar para contarlo en Ajustes. Sin dependencias: lo importa
 * también el .mjs con `createRequire`.
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

const FICHERO = path.join(RAIZ, ".cache", "wyscout", "punto-de-control.json");

function lee() {
  try {
    const dato = JSON.parse(fs.readFileSync(FICHERO, "utf8"));

    return dato && typeof dato === "object" ? dato : {};
  } catch {
    return {};
  }
}

/** Escribe entero, por un fichero aparte y un renombrado: un corte a medias no deja un JSON roto. */
function guarda(punto) {
  fs.mkdirSync(path.dirname(FICHERO), { recursive: true });

  const temporal = `${FICHERO}.${process.pid}.tmp`;

  fs.writeFileSync(temporal, JSON.stringify(punto, null, 2), "utf8");

  fs.renameSync(temporal, FICHERO);
}

/** Lee, cambia y guarda. `cambio(punto)` modifica el objeto en sitio. Nunca tumba la descarga. */
function cambia(cambio) {
  try {
    const punto = lee();

    cambio(punto);

    guarda(punto);

    return punto;
  } catch (error) {
    console.log(`  (no se ha podido apuntar el punto de control: ${error.message})`);

    return null;
  }
}

/** La pasada en curso, creándola si no la hay. */
function pasada(punto) {
  if (!punto.pasada) punto.pasada = { id: new Date().toISOString(), empezadaEn: new Date().toISOString() };

  const p = punto.pasada;

  p.plan ??= { equipos: [], lotes: [] };
  p.hechos ??= { equipos: [], lotes: [] };
  p.fallidos ??= { equipos: [], lotes: [] };

  return p;
}

const anade = (lista, valor) => {
  if (!lista.includes(valor)) lista.push(valor);
};

const quita = (lista, valor) => {
  const i = lista.indexOf(valor);

  if (i >= 0) lista.splice(i, 1);
};

/** Un equipo bajado (o no) en esta pasada. */
function equipoHecho(equipo, ok, detalle) {
  return cambia((punto) => {
    const p = pasada(punto);

    if (ok) {
      anade(p.hechos.equipos, equipo);
      quita(p.fallidos.equipos, equipo);

      punto.equipos ??= {};
      punto.equipos[equipo] = { bajadoEn: new Date().toISOString() };
    } else {
      anade(p.fallidos.equipos, equipo);

      if (detalle && !p.fallo) p.fallo = { paso: "equipos", detalle: String(detalle).slice(0, 400) };
    }
  });
}

/** Un lote de jugadores bajado (o no). `bien` son los equipos que sí traía, con su último partido. */
function loteHecho(numero, ok, bien, ultimoPartido, detalle) {
  return cambia((punto) => {
    const p = pasada(punto);

    if (ok) {
      anade(p.hechos.lotes, numero);
      quita(p.fallidos.lotes, numero);
    } else {
      anade(p.fallidos.lotes, numero);

      if (detalle && !p.fallo) p.fallo = { paso: "jugadores", detalle: String(detalle).slice(0, 400) };
    }

    const ahora = new Date().toISOString();

    punto.jugadores ??= {};

    for (const equipo of bien) punto.jugadores[equipo] = { bajadoEn: ahora, ultimoPartido: ultimoPartido?.[equipo] ?? null };
  });
}

module.exports = { FICHERO, lee, guarda, cambia, pasada, equipoHecho, loteHecho };
