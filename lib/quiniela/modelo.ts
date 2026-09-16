/**
 * LA QUINIELA DE LA SEMANA: las reglas.
 *
 * Aquí no hay pantalla ni guardado, sólo lo que significa acertar. Se separa a
 * propósito: el ranking es lo único que la gente va a discutir, y tiene que
 * poder comprobarse sin abrir un navegador.
 *
 * **Se juega al 1-X-2 de toda la vida**, jornada a jornada, sobre el calendario
 * de `calendario.ts`. Cada uno rellena sus diez pronósticos, se meten los
 * resultados cuando se juegan, y el acierto se cuenta solo.
 *
 * Dos decisiones que no son obvias:
 *
 * - **Un partido sin resultado no cuenta para nadie.** Ni acierto ni fallo: la
 *   jornada se va completando según se juega, y el porcentaje del lunes tiene
 *   que ser el de los partidos jugados, no el de los diez.
 * - **No pronosticar es fallar**, pero sólo cuando el partido ya se ha jugado.
 *   Si no, quien se olvida de rellenar saldría con el mismo porcentaje que
 *   quien acierta todo, y la quiniela dejaría de tener gracia.
 */

import { CALENDARIO, type PartidoQuiniela } from "./calendario";

/** 1 local, X empate, 2 visitante. */
export type Signo = "1" | "X" | "2";

export const SIGNOS: Signo[] = ["1", "X", "2"];

/** Cómo se lee cada signo cuando hace falta explicarlo. */
export const NOMBRE_DEL_SIGNO: Record<Signo, string> = {
  "1": "Gana el local",
  X: "Empate",
  "2": "Gana el visitante",
};

/**
 * Lo que se guarda de una jornada.
 *
 * Los pronósticos van por persona y por partido: `pronosticos[slug][indice]`,
 * donde el índice es la posición del partido dentro de la jornada. Se usa el
 * índice y no el nombre de los equipos porque un partido aplazado se sigue
 * jugando en su sitio de la jornada.
 */
export type JornadaQuiniela = {
  jornada: number;
  /** Por persona, su signo en cada partido. `null` es sin rellenar. */
  pronosticos: Record<string, (Signo | null)[]>;
  /** El resultado de cada partido. `null` mientras no se haya jugado. */
  resultados: (Signo | null)[];
  /** Cuándo se cerró la jornada, si se cerró. */
  cerradaEn?: string;
};

export type DocumentoQuiniela = {
  /** Por número de jornada. */
  jornadas: Record<string, JornadaQuiniela>;
  /** Quién juega esta temporada, por `slug` del staff. */
  jugadores: string[];
};

export const QUINIELA_VACIA: DocumentoQuiniela = { jornadas: {}, jugadores: [] };

/* ------------------------------------------------------------------ */
/*  EL CALENDARIO                                                      */
/* ------------------------------------------------------------------ */

export function partidosDe(jornada: number): PartidoQuiniela[] {
  return CALENDARIO.filter((uno) => uno.jornada === jornada);
}

export const JORNADAS = [...new Set(CALENDARIO.map((uno) => uno.jornada))].sort(
  (a, b) => a - b,
);

/**
 * Qué jornada toca hoy.
 *
 * La primera cuyo último partido no se haya jugado todavía; pasada la
 * temporada, la última. Se compara con la fecha en texto (`2026-08-30`) para no
 * depender del huso horario: el calendario no tiene hora, sólo día.
 */
export function jornadaDeHoy(hoy: string): number {
  for (const jornada of JORNADAS) {
    const partidos = partidosDe(jornada);

    const ultima = partidos.reduce(
      (mayor, uno) => (uno.fecha > mayor ? uno.fecha : mayor),
      "",
    );

    if (ultima >= hoy) return jornada;
  }

  return JORNADAS[JORNADAS.length - 1];
}

/* ------------------------------------------------------------------ */
/*  ACERTAR                                                            */
/* ------------------------------------------------------------------ */

export type Marcador = {
  aciertos: number;
  /** Partidos ya jugados de los que se ha contado: el divisor. */
  jugados: number;
  /** Sobre los jugados. 0 si todavía no hay ninguno. */
  porcentaje: number;
};

/** El acierto de una persona en una jornada. */
export function marcadorDe(
  jornada: JornadaQuiniela,
  slug: string,
): Marcador {
  const suyos = jornada.pronosticos[slug] ?? [];

  let aciertos = 0;
  let jugados = 0;

  jornada.resultados.forEach((resultado, indice) => {
    /* Sin resultado el partido no cuenta: ni a favor ni en contra. */
    if (!resultado) return;

    jugados += 1;

    if (suyos[indice] === resultado) aciertos += 1;
  });

  return {
    aciertos,
    jugados,
    porcentaje: jugados > 0 ? (aciertos / jugados) * 100 : 0,
  };
}

export type FilaRanking = {
  slug: string;
  /** Sumando todas las jornadas. */
  total: Marcador;
  /** Lo que ha hecho en la jornada que se está mirando. */
  semana: Marcador;
  /** Jornadas en las que ha acertado más que nadie. */
  jornadasGanadas: number;
  /** Su mejor jornada, en aciertos. */
  mejorJornada: number;
};

/**
 * El ranking de acierto de toda la temporada.
 *
 * Ordena por porcentaje y no por aciertos: quien se incorpora en la jornada
 * diez no puede empezar con cuarenta puntos de desventaja imposibles de
 * remontar. A igualdad de porcentaje mandan los aciertos, y después el nombre,
 * para que el orden no baile entre recargas.
 */
export function ranking(
  doc: DocumentoQuiniela,
  jugadores: string[],
  jornadaMirada: number,
): FilaRanking[] {
  const jornadas = Object.values(doc.jornadas);

  const filas = jugadores.map((slug) => {
    let aciertos = 0;
    let jugados = 0;
    let jornadasGanadas = 0;
    let mejorJornada = 0;

    for (const jornada of jornadas) {
      const marcador = marcadorDe(jornada, slug);

      aciertos += marcador.aciertos;
      jugados += marcador.jugados;

      if (marcador.jugados > 0) {
        mejorJornada = Math.max(mejorJornada, marcador.aciertos);

        /* Ganar la jornada es acertar más que todos los demás; si empatan
           dos, la ganan los dos: no hay desempate inventado. */
        const mejorAjeno = jugadores
          .filter((otro) => otro !== slug)
          .reduce(
            (mayor, otro) => Math.max(mayor, marcadorDe(jornada, otro).aciertos),
            0,
          );

        if (marcador.aciertos > 0 && marcador.aciertos >= mejorAjeno) {
          jornadasGanadas += 1;
        }
      }
    }

    const deLaSemana = doc.jornadas[String(jornadaMirada)];

    return {
      slug,
      total: {
        aciertos,
        jugados,
        porcentaje: jugados > 0 ? (aciertos / jugados) * 100 : 0,
      },
      semana: deLaSemana
        ? marcadorDe(deLaSemana, slug)
        : { aciertos: 0, jugados: 0, porcentaje: 0 },
      jornadasGanadas,
      mejorJornada,
    };
  });

  return filas.sort(
    (a, b) =>
      b.total.porcentaje - a.total.porcentaje ||
      b.total.aciertos - a.total.aciertos ||
      a.slug.localeCompare(b.slug),
  );
}

/**
 * El pleno: los partidos que ha acertado todo el mundo y los que no ha
 * acertado nadie. Es lo que se comenta el lunes.
 */
export function rarezasDe(jornada: JornadaQuiniela, jugadores: string[]) {
  const conPronostico = jugadores.filter(
    (slug) => (jornada.pronosticos[slug] ?? []).some(Boolean),
  );

  const todos: number[] = [];
  const nadie: number[] = [];

  jornada.resultados.forEach((resultado, indice) => {
    if (!resultado || conPronostico.length === 0) return;

    const aciertan = conPronostico.filter(
      (slug) => jornada.pronosticos[slug]?.[indice] === resultado,
    ).length;

    if (aciertan === conPronostico.length) todos.push(indice);
    if (aciertan === 0) nadie.push(indice);
  });

  return { todos, nadie };
}

/** Una jornada en blanco, con tantos huecos como partidos tenga. */
export function jornadaVacia(jornada: number): JornadaQuiniela {
  return {
    jornada,
    pronosticos: {},
    resultados: partidosDe(jornada).map(() => null),
  };
}
