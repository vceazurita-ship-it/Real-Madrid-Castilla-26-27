/*
|--------------------------------------------------------------------------
| DASHBOARD DE PLANTILLA (31/10/2026)
|--------------------------------------------------------------------------
|
| El analista pidió dejar fuera lo que no se registra —lesiones, selección,
| estado de la hoja de controles— y mirar lo que sí hay cada semana:
|
| - **Wyscout** (descarga de jugadores): minutos, partidos, edad, contrato,
|   amarillas y el percentil contra su puesto en la liga. Es la cuenta buena
|   de minutos: Valoraciones deja partidos a medio anotar (el de Ibiza tiene
|   minutos de nueve jugadores).
| - **Valoraciones**: quién jugó cada jornada, de titular o desde el banquillo,
|   y la nota del cuerpo técnico. «Jugó» es tener minutos, nota o la marca de
|   titular; «titular» es la marca o los noventa minutos (la marca falta en
|   jornadas enteras, como la J2).
| - **La hoja JUGADORES**: puesto, licencia, ficha de competencias.
|
| Todo lo de aquí es puro (sin React) para poder probarlo en Node.
*/

import { casaNombre, puestoDeLaHoja } from "@/lib/data-analisis/once";
import {
  MINUTOS_MINIMOS,
  comparablesDe,
  esNuestro,
  fuertesYFlojos,
  puestoDe,
  type MetricaJugador,
  type Puesto,
} from "@/lib/data-analisis/individual";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { temporadaDe } from "@/lib/data-analisis/metricas";
import { idVigente, mismoJugador } from "@/lib/fichajes";
import { summarize, type PlayerSummary, type RatedEntry } from "@/lib/ratings/compute";
import { compareMatches } from "@/lib/ratings/matches";
import type { MatchMeta, PlayerRating, RatingsSeason } from "@/lib/ratings/types";

/** Lo que la página ya ha leído de la hoja para cada jugador. */
export type FichaPlantilla = {
  id: string;
  nombre: string;
  apodo: string;
  /** El puesto de la hoja, ya corregido con `posicionDe`. */
  posicionHoja: string;
  delCastilla: boolean;
};

/** Un partido de liga ya jugado, con sus registros por jugador (ids vigentes). */
export type PartidoLiga = {
  match: MatchMeta;
  jornada: number;
  jugadores: Map<string, PlayerRating>;
};

/** Lo que hizo un jugador en un partido, según Valoraciones. */
export type Aparicion = {
  jugo: boolean;
  titular: boolean;
  /** Minutos anotados; `null` si jugó pero no constan. */
  minutos: number | null;
  nota: number;
};

export type JugadorDash<F extends FichaPlantilla = FichaPlantilla> = {
  ficha: F;
  wy: FilaJugador | null;
  /** Donde juega: el de Wyscout si tiene fila, si no el de la hoja. */
  puesto: Puesto;
  minutos: number;
  /** De dónde salen los minutos. */
  fuenteMinutos: "wyscout" | "valoraciones";
  /** Minutos sobre los posibles (0-100), o `null` sin partidos. */
  pct: number | null;
  /** Partidos con minutos: Wyscout si lo tiene, si no Valoraciones. */
  partidos: number;
  titular: number;
  suplente: number;
  apariciones: Aparicion[];
  edad: number | null;
  contrato: string;
  amarillas: number | null;
  goles: number;
  asistencias: number;
  notas: PlayerSummary | null;
  /** Media de sus percentiles contra su puesto en la liga (Wyscout). */
  indice: number | null;
  fuertes: { metrica: MetricaJugador; valor: number; percentil: number }[];
  flojos: { metrica: MetricaJugador; valor: number; percentil: number }[];
  /** Con quién se ha comparado su percentil. */
  contraPuesto: number;
};

/* ------------------------------------------------------------------ */
/*  PARTIDOS                                                           */
/* ------------------------------------------------------------------ */

/** Los partidos de la temporada ya jugados, en orden, sin los ocultos de Valoraciones. */
export function partidosDeLiga(season: RatingsSeason, hoy: string): PartidoLiga[] {
  const ocultos = new Set(season.ocultos ?? []);

  return Object.values(season.matches)
    .filter((m) => m?.match && !ocultos.has(m.match.id))
    .filter((m) => m.match.date && m.match.date <= hoy)
    .sort((a, b) => compareMatches(a.match, b.match))
    .map((m, i) => ({
      match: m.match,
      jornada: i + 1,
      jugadores: new Map(
        Object.values(m.players ?? {}).map((p) => [idVigente(p.playerId), p] as const),
      ),
    }));
}

export function aparicionDe(entrada: PlayerRating | undefined): Aparicion {
  if (!entrada) return { jugo: false, titular: false, minutos: null, nota: 0 };

  const minutos = Number(entrada.minutes) || 0;
  const jugo = minutos > 0 || entrada.starter || entrada.rating > 0;

  return {
    jugo,
    titular: jugo && (entrada.starter || minutos >= 90),
    minutos: jugo ? (minutos > 0 ? minutos : null) : 0,
    nota: entrada.rating > 0 ? entrada.rating : 0,
  };
}

/** Partidos del Castilla en la descarga de Wyscout de esta temporada. */
export function partidosWyscout(partidos: FilaPartido[], hoy: string) {
  const actual = temporadaDe(hoy);

  return partidos.filter(
    (p) => p.equipo.toLowerCase().includes("madrid castilla") && temporadaDe(p.fecha) === actual,
  ).length;
}

/* ------------------------------------------------------------------ */
/*  CRUCE CON WYSCOUT                                                  */
/* ------------------------------------------------------------------ */

/**
 * La fila de Wyscout de cada jugador, **uno a uno**.
 *
 * Primera pasada por el nombre (`casaNombre`, que ya sabe que «L. Fati Joao»
 * es Lamini, y luego inicial y apellido); la segunda, por el apodo y sólo
 * entre las filas que nadie se ha llevado. Con el apodo en la primera,
 * «Sergio» (Sergio Martínez) se quedaba la fila de Sergio Mestre.
 */
export function atarWyscout<F extends FichaPlantilla>(fichas: F[], filas: FilaJugador[]) {
  const nuestras = filas.filter((f) => esNuestro(f) && f.temporada === "actual");
  const usadas = new Set<FilaJugador>();
  const atadas = new Map<string, FilaJugador>();

  const libres = () => nuestras.filter((f) => !usadas.has(f));

  const ata = (ficha: F, fila: FilaJugador | null | undefined) => {
    if (!fila || usadas.has(fila)) return;
    usadas.add(fila);
    atadas.set(ficha.id, fila);
  };

  /* Los del Castilla eligen antes: «Diego Martínez "Beto"» (RMC) se llevaba
     la fila de «S. Martínez» por el apellido. */
  const orden = [...fichas].sort((a, b) => Number(b.delCastilla) - Number(a.delCastilla));

  /* 1 · Apellido e inicial que casan, sin duda («S. Martínez» es Sergio y no Joan). */
  for (const ficha of orden) {
    const parecidos = libres().filter((f) => mismoJugador(ficha.nombre, f.jugador));

    if (parecidos.length === 1) ata(ficha, parecidos[0]);
  }

  /* 2 · Por nombre, con el resto de apellidos (`casaNombre`). */
  for (const ficha of orden) {
    if (!atadas.has(ficha.id)) ata(ficha, casaNombre(ficha.nombre, libres(), (f) => f.jugador));
  }

  /* 3 · Por apodo, entre lo que quede. */
  for (const ficha of orden) {
    if (atadas.has(ficha.id) || !ficha.apodo || ficha.apodo === ficha.nombre) continue;

    ata(ficha, casaNombre(ficha.apodo, libres(), (f) => f.jugador));
  }

  return atadas;
}

/* ------------------------------------------------------------------ */
/*  EL JUGADOR                                                         */
/* ------------------------------------------------------------------ */

const media = (valores: number[]) =>
  valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;

export function construyeJugadores<F extends FichaPlantilla>(
  fichas: F[],
  filasWyscout: FilaJugador[],
  partidos: PartidoLiga[],
  partidosEquipo: number,
): JugadorDash<F>[] {
  const atadas = atarWyscout(fichas, filasWyscout);
  const posibles = partidosEquipo * 90;

  return fichas.map((ficha) => {
    const wy = atadas.get(ficha.id) ?? null;
    const apariciones = partidos.map((p) => aparicionDe(p.jugadores.get(ficha.id)));
    const jugadas = apariciones.filter((a) => a.jugo);
    const minutosValoraciones = jugadas.reduce((acc, a) => acc + (a.minutos ?? 0), 0);

    const minutos = wy ? wy.minutos : minutosValoraciones;
    const puesto: Puesto = wy && wy.minutos > 0 ? puestoDe(wy.posicion) : puestoDeLaHoja(ficha.posicionHoja);

    const entradas: RatedEntry[] = partidos.flatMap((p) => {
      const entry = p.jugadores.get(ficha.id);
      return entry ? [{ match: p.match, entry }] : [];
    });
    const resumen = entradas.length ? summarize(ficha.id, entradas) : null;

    /* Percentil contra su puesto en la liga, con los mismos mínimos que Data análisis. */
    let indice: number | null = null;
    let fuertes: JugadorDash["fuertes"] = [];
    let flojos: JugadorDash["flojos"] = [];
    let contraPuesto = 0;

    if (wy && wy.minutos >= MINUTOS_MINIMOS) {
      const comparables = comparablesDe(filasWyscout, puesto, "liga");

      if (comparables.contra !== "solo") {
        const r = fuertesYFlojos(wy, comparables.lista, puesto);
        const m = media(r.todas.map((x) => x.percentil));

        indice = m === null ? null : Math.round(m);
        fuertes = r.fuertes.slice(0, 3);
        flojos = r.flojos.slice(0, 3);
        contraPuesto = comparables.lista.length;
      }
    }

    const amarillas90 = wy?.datos["Tarjetas amarillas/90"];

    return {
      ficha,
      wy,
      puesto,
      minutos,
      fuenteMinutos: wy ? "wyscout" : "valoraciones",
      pct: posibles > 0 ? Math.min(100, Math.round((minutos / posibles) * 100)) : null,
      partidos: wy ? wy.partidos : jugadas.length,
      titular: jugadas.filter((a) => a.titular).length,
      suplente: jugadas.filter((a) => !a.titular).length,
      apariciones,
      edad: wy && wy.edad > 0 ? wy.edad : null,
      contrato: wy?.contrato?.trim() ?? "",
      amarillas:
        wy && typeof amarillas90 === "number" ? Math.round((amarillas90 * wy.minutos) / 90) : null,
      goles: wy?.datos["Goles"] ?? resumen?.goals ?? 0,
      asistencias: wy?.datos["Asistencias"] ?? resumen?.assists ?? 0,
      notas: resumen && resumen.played > 0 ? resumen : null,
      indice,
      fuertes,
      flojos,
      contraPuesto,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  AVISOS                                                             */
/* ------------------------------------------------------------------ */

export type TipoAviso = "pocos" | "sinJugar" | "carga" | "amarillas" | "nota";

export type Aviso<F extends FichaPlantilla = FichaPlantilla> = {
  tipo: TipoAviso;
  jugador: JugadorDash<F>;
  /** La cifra que lo dispara, ya escrita. */
  cifra: string;
};

export const AVISOS: Record<TipoAviso, { titulo: string; regla: string; accion: string }> = {
  pocos: {
    titulo: "Juega poco",
    regla: "menos del 25 % de los minutos posibles",
    accion: "buscarle minutos o un partido con otro equipo",
  },
  sinJugar: {
    titulo: "Tres partidos sin jugar",
    regla: "jugó antes y no en ninguno de los tres últimos",
    accion: "hablar con él y ver si entra en la próxima convocatoria",
  },
  carga: {
    titulo: "Carga alta de minutos",
    regla: "el 90 % o más de los minutos posibles",
    accion: "valorar rotación o dosificar la semana",
  },
  amarillas: {
    titulo: "A una amarilla del ciclo",
    regla: "cuatro amarillas, nueve, catorce… (la quinta de cada ciclo es sanción)",
    accion: "la próxima amarilla le deja fuera un partido",
  },
  nota: {
    titulo: "Nota a la baja",
    regla: "sus tres últimas notas, un punto o más por debajo de las tres anteriores",
    accion: "revisar sus últimos partidos en vídeo",
  },
};

/** Los avisos de la semana, sólo de los del Castilla. */
export function avisosDe<F extends FichaPlantilla>(lista: JugadorDash<F>[], partidosEquipo: number): Aviso<F>[] {
  const avisos: Aviso<F>[] = [];
  const posibles = partidosEquipo * 90;

  for (const j of lista) {
    if (!j.ficha.delCastilla) continue;

    const deCampo = j.puesto !== "POR";

    if (deCampo && partidosEquipo >= 3 && j.pct !== null) {
      if (j.pct < 25) avisos.push({ tipo: "pocos", jugador: j, cifra: `${j.minutos}′ de ${posibles} (${j.pct} %)` });
      if (j.pct >= 90) avisos.push({ tipo: "carga", jugador: j, cifra: `${j.minutos}′ de ${posibles} (${j.pct} %)` });
    }

    const ultimas = j.apariciones.slice(-3);
    const antes = j.apariciones.slice(0, -3);

    if (deCampo && ultimas.length === 3 && ultimas.every((a) => !a.jugo) && antes.some((a) => a.jugo)) {
      const ultima = [...antes].reverse().find((a) => a.jugo);
      avisos.push({
        tipo: "sinJugar",
        jugador: j,
        cifra: `${antes.filter((a) => a.jugo).length} partidos antes${ultima?.titular ? ", alguno de titular" : ""}`,
      });
    }

    if (j.amarillas !== null && j.amarillas % 5 === 4) {
      avisos.push({ tipo: "amarillas", jugador: j, cifra: `${j.amarillas} amarillas` });
    }

    if (j.notas && j.notas.played >= 6 && j.notas.trend <= -1) {
      avisos.push({ tipo: "nota", jugador: j, cifra: `${j.notas.trend.toFixed(1).replace(".", ",")} puntos` });
    }
  }

  return avisos;
}
