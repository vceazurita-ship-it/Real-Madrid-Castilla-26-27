/**
 * QUÉ GOLES SE MARCAN ANTES (16/11/2026).
 *
 * «Dando prioridad al Castilla, al Murcia y a los próximos rivales.» Lo usan
 * los dos marcadores de goles en vídeo (opta-goles-video.mjs y
 * rfef-goles-resumenes.mjs): un partido vale lo que el mejor de sus dos
 * equipos en esta escala (menos = antes):
 *
 *   0  el Castilla
 *   1  el Real Murcia
 *   2… los próximos rivales del calendario, en su orden (castilla:calendario)
 *   50 el resto de nuestro grupo (rivales de esta temporada)
 *   99 el resto de la categoría
 */
require("./cargador-ts.cjs");

const { mismoEquipo } = require("../lib/rivals/resumen-de-partido.ts");

const PROXIMOS = 4;

/** `partidos` = data.partidos de `castilla:calendario`. */
function prioridades(partidos, ahora = Date.now()) {
  const rival = (p) => (/castilla|real madrid ii/i.test(p.local) ? p.visitante : p.local);
  const todos = (partidos ?? []).filter((p) => p?.local && p?.visitante);
  const proximos = todos
    .filter((p) => p.golesLocal == null && Date.parse(p.cuando) > ahora - 86_400_000)
    .sort((a, b) => Date.parse(a.cuando) - Date.parse(b.cuando))
    .slice(0, PROXIMOS)
    .map(rival);
  const grupo = [...new Set(todos.map(rival))];

  const deEquipo = (nombre) => {
    if (!nombre) return 99;
    if (mismoEquipo(nombre, "Real Madrid Castilla") || /real madrid ii/i.test(nombre)) return 0;
    if (mismoEquipo(nombre, "Real Murcia")) return 1;

    const i = proximos.findIndex((r) => mismoEquipo(nombre, r));

    if (i >= 0) return 2 + i;

    return grupo.some((r) => mismoEquipo(nombre, r)) ? 50 : 99;
  };

  return {
    proximos,
    deEquipo,
    /** La del partido: la del mejor de los dos. */
    dePartido: (a, b) => Math.min(deEquipo(a), deEquipo(b)),
  };
}

module.exports = { prioridades };
