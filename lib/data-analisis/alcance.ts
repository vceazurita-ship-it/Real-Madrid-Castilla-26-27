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

/*
|--------------------------------------------------------------------------
| A QUÉ JORNADA PERTENECE CADA PARTIDO DE WYSCOUT (11/10/2026)
|--------------------------------------------------------------------------
|
| Wyscout no escribe la jornada: sólo la fecha. Hasta ahora un partido era de
| una jornada si caía en su ventana de días, y con eso un partido APLAZADO no
| tenía dónde ir: el Cartagena - Real Murcia de la J5 se jugó el miércoles 7
| de octubre y caía en la ventana de la J7, con lo que la J5 seguía
| «incompleta» para siempre y la J7 tenía a dos equipos con partido de más.
|
| Ahora se reparte en dos pasadas: primero cada fila a la ventana en que cae
| (una por equipo y jornada), y lo que sobra —el aplazado, o un segundo
| partido en la misma ventana— a la primera jornada en la que ni el equipo ni
| su rival tienen partido. Lo que falta después de eso es lo que de verdad
| está pendiente: un partido que todavía no se ha jugado o que Wyscout aún no
| ha cargado.
*/

export type JornadaWyscout = {
  jornada: number;
  /** "2026-09-27T12:00", la fecha de nuestro partido de esa jornada. */
  cuando: string;
  /** Equipo → su fila de esa jornada. */
  con: Map<string, FilaPartido>;
  /** Los equipos del grupo sin partido en esa jornada, por nombre. */
  faltan: string[];
  /** La ventana de la jornada sigue abierta: puede quedar un partido por jugarse. */
  abierta: boolean;
  /** Ya se jugó nuestro partido de esa jornada (o pasó su fecha). */
  jugada: boolean;
};

export type RepartoWyscout = {
  competicion: string;
  equipos: string[];
  jornadas: JornadaWyscout[];
  /** Filas que no han cabido en ninguna jornada (no debería pasar). */
  sueltas: FilaPartido[];
};

export function repartoWyscout(partidos: FilaPartido[], calendario: PartidoCalendario[], hoy: string): RepartoWyscout | null {
  const liga = deLiga(calendario);
  if (!liga.length) return null;

  /* Nuestra competición: la de nuestros partidos que caen en el calendario. */
  const nuestra = partidos.find((p) => NOSOTROS.test(p.equipo) && partidoDeFecha(calendario, p.fecha))?.competicion;
  if (!nuestra) return null;

  /* La ventana de cada jornada: de la mitad del hueco con la anterior a la mitad del hueco con la siguiente. */
  const ventanas = liga.map((cal, i) => {
    const antes = liga[i - 1];
    const despues = liga[i + 1];
    return {
      cal,
      desde: antes ? Math.floor(dias(cal.cuando, antes.cuando) / 2) : 4,
      hasta: despues ? Math.floor(dias(despues.cuando, cal.cuando) / 2) : 4,
    };
  });

  const delGrupo = partidos
    .filter((p) => p.competicion === nuestra && dias(p.fecha, liga[0].cuando) >= -ventanas[0].desde)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const equipos = [...new Set(delGrupo.map((p) => p.equipo))].sort((a, b) => a.localeCompare(b, "es"));

  const jornadas: JornadaWyscout[] = ventanas.map(({ cal, hasta }) => ({
    jornada: cal.jornada ?? 0,
    cuando: cal.cuando,
    con: new Map<string, FilaPartido>(),
    faltan: [],
    abierta: dias(hoy, cal.cuando) <= hasta,
    jugada: (cal.golesLocal !== null && cal.golesLocal !== undefined) || dia(cal.cuando) <= hoy,
  }));

  /*
  | Cada partido son dos filas (una por equipo) y se coloca como una unidad,
  | por orden de fecha:
  |
  | - a su ventana, si los dos equipos están libres en ella;
  | - al hueco que los dos equipos comparten en una jornada anterior, si se
  |   jugó ENTRE SEMANA (martes a jueves): así es como se recupera un
  |   aplazado, y así el Cartagena - Real Murcia del miércoles 7 de octubre
  |   vuelve a la J5 en vez de quedarse en la J7;
  | - y si en su ventana uno de los dos ya tiene partido, el que sobra es el
  |   aplazado: el que se jugó entre semana con un hueco común se va a él.
  |
  | Un partido de fin de semana con hueco común anterior se queda en su
  | ventana: un aplazado que se recupera en un fin de semana sin jornada cae
  | en la ventana de la jornada de al lado y sólo se reconoce cuando llega el
  | partido de verdad de esa jornada y lo desplaza.
  */
  type Unidad = { filas: FilaPartido[]; fecha: string; equipos: string[] };
  const porPartido = new Map<string, Unidad>();
  for (const p of delGrupo) {
    const clave = `${dia(p.fecha)}|${[p.equipo, p.rival].sort().join("|")}`;
    const u = porPartido.get(clave) ?? { filas: [], fecha: p.fecha, equipos: [p.equipo, p.rival] };
    u.filas.push(p);
    porPartido.set(clave, u);
  }
  const unidades = [...porPartido.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const colocadas = new Map<Unidad, number>();
  const sueltas: FilaPartido[] = [];

  const entreSemana = (fecha: string) => {
    const d = new Date(`${dia(fecha)}T12:00:00Z`).getUTCDay();
    return d >= 2 && d <= 4;
  };
  const libres = (u: Unidad, k: number) => u.equipos.every((e) => !jornadas[k].con.has(e));
  /*
  | Las ventanas en que cae la fecha, la más cercana primero. Dos ventanas se
  | solapan cuando nuestro partido de una jornada se jugó entre semana (la J4
  | del miércoles 23/09 llega hasta el viernes 25, que ya es J5): se prueba
  | primero la más cercana y, a igual distancia, la que tenga libres a los dos.
  */
  const ventanasDe = (u: Unidad) =>
    ventanas
      .map(({ cal, desde, hasta }, i) => ({ i, d: dias(u.fecha, cal.cuando), desde, hasta }))
      .filter(({ d, desde, hasta }) => d >= -desde && d <= hasta)
      .sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || a.i - b.i)
      .map(({ i }) => i);
  const ventanaDe = (u: Unidad) => {
    const posibles = ventanasDe(u);
    return posibles.find((k) => libres(u, k)) ?? posibles[0] ?? -1;
  };
  /** El primer hueco anterior a `antesDe` en el que los dos equipos están libres y que ya había empezado cuando se jugó. */
  const huecoComun = (u: Unidad, antesDe: number) =>
    jornadas.findIndex((j, i) => i < antesDe && libres(u, i) && dias(u.fecha, j.cuando) >= -ventanas[i].desde);
  const pon = (u: Unidad, k: number) => {
    for (const p of u.filas) jornadas[k].con.set(p.equipo, p);
    colocadas.set(u, k);
  };
  const quita = (u: Unidad) => {
    const k = colocadas.get(u);
    if (k === undefined) return;
    for (const p of u.filas) jornadas[k].con.delete(p.equipo);
    colocadas.delete(u);
  };

  for (const u of unidades) {
    const kw = ventanaDe(u);
    const antes = huecoComun(u, kw < 0 ? jornadas.length : kw);

    if (kw < 0) {
      if (antes >= 0) pon(u, antes);
      else sueltas.push(...u.filas);
      continue;
    }

    if (antes >= 0 && entreSemana(u.fecha)) {
      pon(u, antes);
      continue;
    }

    if (libres(u, kw)) {
      pon(u, kw);
      continue;
    }

    /* Choque en la ventana: el que sobra es el aplazado. */
    const ocupante = [...colocadas.entries()].find(([otra, k]) => k === kw && otra.equipos.some((e) => u.equipos.includes(e)))?.[0];
    if (ocupante) {
      quita(ocupante);
      const suHueco = huecoComun(ocupante, kw);
      if (suHueco >= 0 && libres(u, kw)) {
        pon(ocupante, suHueco);
        pon(u, kw);
        continue;
      }
      pon(ocupante, kw);
    }

    if (antes >= 0) pon(u, antes);
    else sueltas.push(...u.filas);
  }

  for (const j of jornadas) j.faltan = equipos.filter((e) => !j.con.has(e));

  return { competicion: nuestra, equipos, jornadas, sueltas };
}

export type PendienteWyscout = {
  jornada: number;
  /** "2026-09-27". */
  fecha: string;
  faltan: string[];
  /** «Algeciras - Villarreal B» cuando faltan justo dos y por tanto se sabe el partido. */
  partido: string | null;
  abierta: boolean;
};

/** Las jornadas ya jugadas a las que Wyscout todavía no les tiene todos los partidos. */
export function pendientesWyscout(partidos: FilaPartido[], calendario: PartidoCalendario[], hoy: string): PendienteWyscout[] {
  const reparto = repartoWyscout(partidos, calendario, hoy);
  if (!reparto) return [];
  return reparto.jornadas
    .filter((j) => j.jugada && j.faltan.length > 0)
    .map((j) => ({
      jornada: j.jornada,
      fecha: dia(j.cuando),
      faltan: j.faltan,
      partido: j.faltan.length === 2 ? `${j.faltan[0]} - ${j.faltan[1]}` : null,
      abierta: j.abierta,
    }));
}

export function alcanceWyscout(partidos: FilaPartido[], calendario: PartidoCalendario[], hoy: string): Alcance {
  const base: Alcance = { fuente: "Wyscout", jornada: null, fecha: null, rival: "", estado: "sin-datos", detalle: "", pendientes: [] };
  const liga = deLiga(calendario);
  if (!liga.length) return { ...base, detalle: "Sin calendario de BeSoccer para saber la jornada." };

  const reparto = repartoWyscout(partidos, calendario, hoy);
  /* La última jornada con nuestro partido en Wyscout. */
  const nuestras = (reparto?.jornadas ?? []).filter((j) => [...j.con.keys()].some((e) => NOSOTROS.test(e)));
  const actual = nuestras[nuestras.length - 1];
  if (!reparto || !actual) return { ...base, detalle: "Wyscout todavía no tiene ningún partido de liga del Castilla.", pendientes: pendientesDesde(calendario, hoy, 0) };

  const cal = liga.find((p) => p.jornada === actual.jornada)!;
  const ultima = [...actual.con.entries()].find(([e]) => NOSOTROS.test(e))![1];
  const { equipos } = reparto;
  const faltan = actual.faltan;

  /* Y los huecos de jornadas anteriores: un aplazado que aún no se ha jugado o que Wyscout no ha cargado. */
  const huecos = reparto.jornadas
    .filter((j) => j.jugada && j.jornada !== actual.jornada && j.faltan.length > 0)
    .map((j) => `J${j.jornada} (${j.faltan.length === 2 ? j.faltan.join(" - ") : j.faltan.join(", ")})`);

  return {
    fuente: "Wyscout",
    jornada: cal.jornada ?? null,
    fecha: dia(ultima.fecha),
    rival: rivalDe(cal),
    estado: faltan.length ? "incompleta" : "completa",
    detalle:
      (faltan.length
        ? `J${cal.jornada}: faltan ${
            faltan.length > 4
              ? `${faltan.slice(0, 4).join(", ")} y ${faltan.length - 4} más`
              : faltan.length > 1
                ? `${faltan.slice(0, -1).join(", ")} y ${faltan[faltan.length - 1]}`
                : faltan[0]
          }${actual.abierta ? " (la jornada aún puede tener partidos por jugar)" : ""}.`
        : `Los ${equipos.length} equipos del grupo tienen su partido de la J${cal.jornada}.`) +
      (huecos.length ? ` De jornadas anteriores falta ${huecos.join(" y ")}: aplazados que aún no están.` : ""),
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
