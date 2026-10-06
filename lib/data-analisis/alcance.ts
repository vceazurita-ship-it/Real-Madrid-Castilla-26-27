/**
 * HASTA QUÉ JORNADA LLEGAN LOS DATOS, Y SI ESA JORNADA ESTÁ COMPLETA (06/10/2026).
 *
 * Cada área de DATA lee una fuente distinta —los «Team Stats» de Wyscout, el
 * log de Opta, el registro propio de balón parado— y cada una se actualiza a
 * su ritmo. Mirar una tabla sin saber si ya está el último partido, o si de la
 * última jornada faltan la mitad de los equipos, es leerla mal.
 *
 * La jornada sale del calendario del Castilla (BeSoccer, `castilla:calendario`):
 * ninguna de las tres fuentes la escribe. «Completa» quiere decir:
 * - en Wyscout, que **todos los equipos del grupo** tienen su partido de esa
 *   jornada (los «Team Stats» se bajan equipo a equipo y alguno puede faltar,
 *   o jugar el lunes);
 * - en Opta y en el registro propio, que está el **último partido jugado**.
 */
import type { FilaPartido } from "@/lib/data-analisis/leer";

export type PartidoCalendario = {
  jornada?: number;
  /** "2026-09-20T12:00". */
  cuando: string;
  local: string;
  visitante: string;
  golesLocal?: number | null;
  golesVisitante?: number | null;
};

export type Alcance = {
  /** De qué fuente se habla («Wyscout», «Opta», «Registro propio»). */
  fuente: string;
  jornada: number | null;
  /** «2026-10-02». */
  fecha: string | null;
  rival: string;
  estado: "completa" | "incompleta" | "sin-datos";
  /** Por qué no está completa, o de qué está hecha. */
  detalle: string;
  /** Jornadas ya jugadas que todavía no han entrado en esta fuente. */
  pendientes: string[];
};

const NOSOTROS = /castilla/i;

const dia = (iso: string) => iso.slice(0, 10);

const dias = (a: string, b: string) => Math.round((Date.parse(`${dia(a)}T12:00:00Z`) - Date.parse(`${dia(b)}T12:00:00Z`)) / 86_400_000);

const fechaCorta = (iso: string) => {
  const [, m, d] = dia(iso).split("-");
  return `${d}/${m}`;
};

const rivalDe = (p: PartidoCalendario) => (NOSOTROS.test(p.local) ? p.visitante : p.local);

/** Los partidos de liga del calendario (con jornada), en orden. */
function deLiga(calendario: PartidoCalendario[]) {
  return calendario.filter((p) => typeof p.jornada === "number" && p.jornada > 0 && p.cuando).sort((a, b) => a.cuando.localeCompare(b.cuando));
}

/** Jugados: con marcador, o ya pasados. */
function jugados(calendario: PartidoCalendario[], hoy: string) {
  return deLiga(calendario).filter((p) => (p.golesLocal !== null && p.golesLocal !== undefined) || dia(p.cuando) < hoy);
}

/** El partido del calendario de esa fecha (±1 día: Wyscout y BeSoccer no siempre coinciden en el huso). */
export function partidoDeFecha(calendario: PartidoCalendario[], fecha: string) {
  return deLiga(calendario).find((p) => Math.abs(dias(p.cuando, fecha)) <= 1) ?? null;
}

/** Las jornadas jugadas después de la última que tiene la fuente. */
function pendientesDesde(calendario: PartidoCalendario[], hoy: string, ultima: number | null) {
  return jugados(calendario, hoy)
    .filter((p) => (p.jornada ?? 0) > (ultima ?? 0))
    .map((p) => `J${p.jornada} (${rivalDe(p)}, ${fechaCorta(p.cuando)})`);
}

/* ------------------------------------------------------------------ */
/*  WYSCOUT: LOS INFORMES DE EQUIPO                                    */
/* ------------------------------------------------------------------ */

export function alcanceWyscout(partidos: FilaPartido[], calendario: PartidoCalendario[], hoy: string): Alcance {
  const base: Alcance = { fuente: "Wyscout", jornada: null, fecha: null, rival: "", estado: "sin-datos", detalle: "", pendientes: [] };
  const liga = deLiga(calendario);
  if (!liga.length) return { ...base, detalle: "Sin calendario de BeSoccer para saber la jornada." };

  const inicio = liga[0].cuando;
  /* Nuestros partidos de liga en Wyscout: los que caen en una fecha del calendario. */
  const nuestras = partidos
    .filter((p) => NOSOTROS.test(p.equipo) && dia(p.fecha) >= dia(inicio) && partidoDeFecha(calendario, p.fecha))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ultima = nuestras[0];
  if (!ultima) return { ...base, detalle: "Wyscout todavía no tiene ningún partido de liga del Castilla.", pendientes: pendientesDesde(calendario, hoy, 0) };

  const cal = partidoDeFecha(calendario, ultima.fecha)!;
  const competicion = ultima.competicion;

  /* La ventana de la jornada: de la mitad del hueco con la anterior a la mitad del hueco con la siguiente. */
  const i = liga.indexOf(cal);
  const antes = liga[i - 1];
  const despues = liga[i + 1];
  const desde = antes ? Math.floor(dias(cal.cuando, antes.cuando) / 2) : 4;
  const hasta = despues ? Math.floor(dias(despues.cuando, cal.cuando) / 2) : 4;
  const enVentana = (f: string) => {
    const d = dias(f, cal.cuando);
    return d >= -desde && d <= hasta;
  };

  const delGrupo = partidos.filter((p) => p.competicion === competicion && dia(p.fecha) >= dia(inicio));
  const equipos = [...new Set(delGrupo.map((p) => p.equipo))];
  const conPartido = new Set(delGrupo.filter((p) => enVentana(p.fecha)).map((p) => p.equipo));
  const faltan = equipos.filter((e) => !conPartido.has(e)).sort((a, b) => a.localeCompare(b, "es"));

  /* La ventana sigue abierta: puede que quede un partido por jugarse (el del lunes). */
  const abierta = dias(hoy, cal.cuando) <= hasta;

  return {
    fuente: "Wyscout",
    jornada: cal.jornada ?? null,
    fecha: dia(ultima.fecha),
    rival: rivalDe(cal),
    estado: faltan.length ? "incompleta" : "completa",
    detalle: faltan.length
      ? `${conPartido.size} de ${equipos.length} equipos con su partido de la J${cal.jornada}; faltan ${faltan.slice(0, 4).join(", ")}${faltan.length > 4 ? ` y ${faltan.length - 4} más` : ""}${abierta ? " (la jornada aún puede tener partidos por jugar)" : ""}.`
      : `Los ${equipos.length} equipos del grupo tienen su partido de la J${cal.jornada}.`,
    pendientes: pendientesDesde(calendario, hoy, cal.jornada ?? null),
  };
}

/* ------------------------------------------------------------------ */
/*  OPTA Y REGISTRO PROPIO: NUESTROS PARTIDOS                          */
/* ------------------------------------------------------------------ */

/** Para fuentes que sólo tienen partidos nuestros: hasta cuál llegan y si es el último jugado. */
export function alcanceDeFechas(fuente: string, fechas: string[], calendario: PartidoCalendario[], hoy: string, queEs: string): Alcance {
  const base: Alcance = { fuente, jornada: null, fecha: null, rival: "", estado: "sin-datos", detalle: "", pendientes: [] };
  const conJornada = fechas
    .map((f) => ({ f, p: partidoDeFecha(calendario, f) }))
    .filter((x): x is { f: string; p: PartidoCalendario } => Boolean(x.p))
    .sort((a, b) => b.f.localeCompare(a.f));
  if (!conJornada.length) return { ...base, detalle: `Todavía no hay ${queEs} de ningún partido de liga.`, pendientes: pendientesDesde(calendario, hoy, 0) };
  return jornadaHecha(fuente, conJornada[0].p, calendario, hoy, queEs, new Set(conJornada.map((x) => x.p.jornada ?? 0)).size);
}

/** Igual, cuando la fuente ya escribe el número de jornada (el registro propio de ABP). */
export function alcanceDeJornadas(fuente: string, jornadas: number[], calendario: PartidoCalendario[], hoy: string, queEs: string): Alcance {
  const base: Alcance = { fuente, jornada: null, fecha: null, rival: "", estado: "sin-datos", detalle: "", pendientes: [] };
  const max = Math.max(0, ...jornadas);
  if (!max) return { ...base, detalle: `Todavía no hay ${queEs} de ningún partido de liga.`, pendientes: pendientesDesde(calendario, hoy, 0) };
  const p = deLiga(calendario).find((x) => x.jornada === max);
  if (!p) return { ...base, jornada: max, estado: "completa", detalle: `Hasta la J${max}.` };
  return jornadaHecha(fuente, p, calendario, hoy, queEs, new Set(jornadas).size);
}

function jornadaHecha(fuente: string, p: PartidoCalendario, calendario: PartidoCalendario[], hoy: string, queEs: string, cuantas: number): Alcance {
  const pendientes = pendientesDesde(calendario, hoy, p.jornada ?? null);
  return {
    fuente,
    jornada: p.jornada ?? null,
    fecha: dia(p.cuando),
    rival: rivalDe(p),
    estado: pendientes.length ? "incompleta" : "completa",
    detalle: pendientes.length
      ? `Hay ${queEs} de ${cuantas} ${cuantas === 1 ? "partido" : "partidos"}; el último jugado aún no ha entrado.`
      : `Está ${queEs === "acciones registradas" ? "registrado" : "metido"} hasta el último partido jugado (${cuantas} ${cuantas === 1 ? "partido" : "partidos"}).`,
    pendientes,
  };
}
