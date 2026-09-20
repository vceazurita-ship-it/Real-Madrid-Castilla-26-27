/**
 * LA QUINIELA DE LA SEMANA: las reglas.
 *
 * Aquí no hay pantalla ni guardado, sólo lo que significa acertar. Se separa a
 * propósito: el ranking es lo único que la gente va a discutir, y tiene que
 * poder comprobarse sin abrir un navegador.
 *
 * **Se juega al 1-X-2 de toda la vida**, jornada a jornada, sobre el calendario
 * de `calendario.ts`. Cada uno rellena sus nueve pronósticos, se meten los
 * resultados cuando se juegan, y el acierto se cuenta solo.
 *
 * Dos decisiones que no son obvias:
 *
 * - **Un partido sin resultado no cuenta para nadie.** Ni acierto ni fallo: la
 *   jornada se va completando según se juega, y el porcentaje del lunes tiene
 *   que ser el de los partidos jugados, no el de los nueve.
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
  /**
   * Cuándo se tocaron los resultados por última vez, y de dónde salieron.
   *
   * Lo escribe el que los pone: `scripts/quiniela-resultados.mjs` cuando los
   * baja de BeSoccer por la noche, y `/api/quiniela/guardar` cuando alguien
   * marca uno a mano. Sirve para que la pantalla pueda decir **de cuándo es lo
   * que se está viendo**, que en una jornada en marcha es la mitad de la
   * información: un 3 de 9 no significa lo mismo a las once de la noche del
   * sábado que el lunes.
   */
  resultadosEn?: string;
  origenResultados?: "besoccer" | "mano";
  /**
   * Cuántos lleva puestos cada uno, **sin decir cuáles**.
   *
   * Sólo existe en lo que sirve `/api/quiniela/leer` y sólo mientras la
   * jornada está abierta: en ese rato el servidor borra los pronósticos de los
   * demás —si no, con mirar la respuesta se copiaba la quiniela del vecino— y
   * manda únicamente el recuento, que es lo que la pantalla necesita para
   * decir «completa» o «3 de 9». Al cerrarse, llegan los pronósticos enteros y
   * esto sobra.
   */
  puestos?: Record<string, number>;
};

/**
 * Lo que cada uno se pone de su cosecha.
 *
 * No tiene nada que ver con acertar: es la parte de guasa. Cada uno puede
 * ponerse una canción, una frase y una foto de broma, y **puede hacerlo cuando
 * le dé la gana** —al entrar no hace falta nada de esto—. Sale junto a su
 * nombre en el ranking.
 *
 * La canción es un enlace (YouTube, Spotify, lo que sea) y no un fichero: subir
 * audio al almacén del club para una broma sería pagar espacio y derechos por
 * algo que ya está enlazado en cualquier sitio. La foto **sí** se sube, porque
 * la gracia está en que sea suya.
 */
export type ExtrasJugador = {
  /** Enlace a la canción. */
  cancion?: string;
  /** Cómo se llama, para no enseñar una URL pelada. */
  cancionNombre?: string;
  /** Su frase. */
  frase?: string;
  /** La foto de broma, ya subida. */
  foto?: string;
};

export type DocumentoQuiniela = {
  /** Por número de jornada. */
  jornadas: Record<string, JornadaQuiniela>;
  /** Quién juega esta temporada, por `slug` del staff. */
  jugadores: string[];
  /** La canción, la frase y la foto de broma de cada uno. */
  extras?: Record<string, ExtrasJugador>;
  /**
   * Las jornadas de las que ya salió el correo del viernes.
   *
   * Lo apunta `/api/quiniela/aviso`: el cron puede repetirse y nadie quiere
   * el mismo aviso dos veces.
   */
  avisadas?: number[];
};

export const QUINIELA_VACIA: DocumentoQuiniela = { jornadas: {}, jugadores: [] };

/* ------------------------------------------------------------------ */
/*  LA COMIDA                                                          */
/* ------------------------------------------------------------------ */

/**
 * Cada cuántas jornadas se paga la comida.
 *
 * La temporada son 38 jornadas, así que salen tres bloques cerrados —1-10,
 * 11-20, 21-30— y un último de ocho, del 31 al 38. Ese último se cuenta igual:
 * dejar fuera las ocho jornadas finales, que son las que más se juegan, no
 * tendría ninguna gracia.
 */
export const JORNADAS_POR_BLOQUE = 10;

/** Cuántos no pagan: los dos mejores de cada bloque. */
export const INVITADOS_POR_BLOQUE = 2;

export type Bloque = {
  /** 1, 2, 3… */
  numero: number;
  desde: number;
  hasta: number;
};

/* ------------------------------------------------------------------ */
/*  EL CALENDARIO                                                      */
/* ------------------------------------------------------------------ */

/** Si un valor que llega de fuera es un signo de verdad. */
export function esSigno(valor: unknown): valor is Signo {
  return valor === "1" || valor === "X" || valor === "2";
}

export function partidosDe(jornada: number): PartidoQuiniela[] {
  return CALENDARIO.filter((uno) => uno.jornada === jornada);
}

export const JORNADAS = [...new Set(CALENDARIO.map((uno) => uno.jornada))].sort(
  (a, b) => a - b,
);

/*
| Los bloques se calculan aquí y no arriba, junto a su tipo, porque necesitan
| `JORNADAS` y en JavaScript un `const` no existe hasta su línea: declararlos
| antes reventaba al cargar el módulo.
*/
export const BLOQUES: Bloque[] = (() => {
  const salida: Bloque[] = [];

  const ultima = JORNADAS[JORNADAS.length - 1] ?? 0;

  for (let desde = 1; desde <= ultima; desde += JORNADAS_POR_BLOQUE) {
    salida.push({
      numero: salida.length + 1,
      desde,
      hasta: Math.min(desde + JORNADAS_POR_BLOQUE - 1, ultima),
    });
  }

  return salida;
})();

export function bloqueDe(jornada: number): Bloque {
  return (
    BLOQUES.find((uno) => jornada >= uno.desde && jornada <= uno.hasta) ??
    BLOQUES[BLOQUES.length - 1]
  );
}

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

/* ------------------------------------------------------------------ */
/*  LA PARRILLA: LO QUE PUSO CADA UNO                                  */
/* ------------------------------------------------------------------ */

/**
 * Lo que ha puesto todo el mundo, partido a partido.
 *
 * Es lo que se enseña **cuando la jornada ya está cerrada**, que es cuando
 * deja de ser información privilegiada y pasa a ser la conversación del
 * vestuario: quién se ha atrevido con el 2, quién ha firmado la quiniela del
 * miedo y quién es el único que ve algo que no ve nadie.
 *
 * Se calcula aquí y no en la pantalla para poder comprobarlo sin navegador.
 */
export type FilaParrilla = {
  indice: number;
  partido: PartidoQuiniela;
  resultado: Signo | null;
  /** El signo de cada uno, por `slug`. */
  signos: Record<string, Signo | null>;
  /** Cuántos han puesto cada signo. */
  votos: Record<Signo, number>;
  /** El signo más votado, o `null` si hay empate o no hay votos. */
  mayoria: Signo | null;
  /**
   * Quien ha puesto un signo que **no ha puesto nadie más**.
   *
   * Es el dato que más se comenta el lunes: el que se la jugó solo. Vacío si
   * todos coinciden o si son dos o más en cada opción.
   */
  solitarios: string[];
  /** Si todos los que han rellenado han puesto lo mismo. */
  unanime: boolean;
  /** Cuántos han acertado, de los que han puesto algo. */
  aciertos: number;
  /** Cuántos han puesto algo. */
  rellenado: number;
};

export function parrillaDe(
  jornada: JornadaQuiniela,
  jugadores: string[],
): FilaParrilla[] {
  const partidos = partidosDe(jornada.jornada);

  return partidos.map((partido, indice) => {
    const signos: Record<string, Signo | null> = {};

    const votos: Record<Signo, number> = { "1": 0, X: 0, "2": 0 };

    for (const slug of jugadores) {
      const suyo = jornada.pronosticos[slug]?.[indice] ?? null;

      signos[slug] = suyo;

      if (suyo) votos[suyo] += 1;
    }

    const rellenado = SIGNOS.reduce((t, signo) => t + votos[signo], 0);

    const masVotado = SIGNOS.reduce(
      (mejor, signo) => (votos[signo] > votos[mejor] ? signo : mejor),
      SIGNOS[0],
    );

    /* Empate arriba no es mayoría: nadie manda. */
    const empatados = SIGNOS.filter((signo) => votos[signo] === votos[masVotado]);

    const mayoria = rellenado > 0 && empatados.length === 1 ? masVotado : null;

    const solitarios = jugadores.filter((slug) => {
      const suyo = signos[slug];

      return suyo !== null && votos[suyo] === 1;
    });

    const resultado = jornada.resultados[indice] ?? null;

    return {
      indice,
      partido,
      resultado,
      signos,
      votos,
      mayoria,
      solitarios: rellenado > 1 ? solitarios : [],
      unanime: rellenado > 1 && empatados.length === 1 && votos[masVotado] === rellenado,
      aciertos: resultado
        ? jugadores.filter((slug) => signos[slug] === resultado).length
        : 0,
      rellenado,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  QUIÉN PAGA LA COMIDA                                               */
/* ------------------------------------------------------------------ */

export type FilaBloque = {
  slug: string;
  aciertos: number;
  jugados: number;
  porcentaje: number;
  /** De los dos que no pagan. */
  invitado: boolean;
};

/**
 * El acierto de cada uno en un bloque de diez jornadas.
 *
 * Ordena por porcentaje, igual que el ranking general y por el mismo motivo:
 * quien se pierde dos jornadas de viaje no puede quedar detrás por eso.
 *
 * **Los empatados a porcentaje entran todos.** Si tres empatan en el segundo
 * puesto, no pagan cuatro: inventar un desempate para que la cuenta salga a dos
 * sería peor que pagar una comida de más, y un desempate arbitrario en una
 * apuesta entre compañeros no lo acepta nadie.
 */
export function rankingDeBloque(
  doc: DocumentoQuiniela,
  jugadores: string[],
  bloque: Bloque,
): FilaBloque[] {
  const jornadas = Object.values(doc.jornadas).filter(
    (una) => una.jornada >= bloque.desde && una.jornada <= bloque.hasta,
  );

  const filas = jugadores
    .map((slug) => {
      let aciertos = 0;
      let jugados = 0;

      for (const jornada of jornadas) {
        const marcador = marcadorDe(jornada, slug);

        aciertos += marcador.aciertos;
        jugados += marcador.jugados;
      }

      return {
        slug,
        aciertos,
        jugados,
        porcentaje: jugados > 0 ? (aciertos / jugados) * 100 : 0,
        invitado: false,
      };
    })
    .sort(
      (a, b) =>
        b.porcentaje - a.porcentaje ||
        b.aciertos - a.aciertos ||
        a.slug.localeCompare(b.slug),
    );

  /* Sin un solo partido jugado no invita nadie a nadie. */
  const conJuego = filas.filter((una) => una.jugados > 0);

  if (conJuego.length === 0) return filas;

  const corte = conJuego[Math.min(INVITADOS_POR_BLOQUE, conJuego.length) - 1];

  const porEncima = (fila: FilaBloque) =>
    fila.porcentaje > corte.porcentaje ||
    (fila.porcentaje === corte.porcentaje && fila.aciertos > corte.aciertos);

  const empatado = (fila: FilaBloque) =>
    fila.porcentaje === corte.porcentaje && fila.aciertos === corte.aciertos;

  /*
  | Con cero aciertos no invita nadie a nadie. Y si el empate del corte se
  | llevase a todos, nadie pagaría: entonces entran sólo los que van por
  | delante del empate. Pasó de verdad en la jornada 4, con uno solo apostando
  | y nueve empatados a 0 %.
  */
  const candidatos = filas.filter(
    (fila) => fila.jugados > 0 && fila.aciertos > 0 && (porEncima(fila) || empatado(fila)),
  );

  const nadiePaga = candidatos.length >= filas.length;

  for (const fila of filas) {
    fila.invitado =
      candidatos.includes(fila) && (!nadiePaga || porEncima(fila));
  }

  return filas;
}

/** Si el bloque ya se ha jugado entero: hasta entonces, nada es definitivo. */
export function bloqueCerrado(doc: DocumentoQuiniela, bloque: Bloque) {
  for (let jornada = bloque.desde; jornada <= bloque.hasta; jornada += 1) {
    const guardada = doc.jornadas[String(jornada)];

    const partidos = partidosDe(jornada).length;

    const conResultado = (guardada?.resultados ?? []).filter(Boolean).length;

    if (conResultado < partidos) return false;
  }

  return true;
}

/** Una jornada en blanco, con tantos huecos como partidos tenga. */
/**
 * La jornada tal y como se la puede ver quien pregunta.
 *
 * Con la jornada abierta, de los demás sólo se sabe **cuántos** signos llevan
 * puestos, no cuáles. Vive aquí —y no en la ruta de lectura— porque hay dos
 * sitios que contestan con el documento: `/api/quiniela/leer` y la respuesta
 * de `/api/quiniela/guardar`. Cuando sólo la tenía el primero, bastaba con
 * guardar cualquier cosa para que el servidor devolviera las apuestas de todos.
 */
export function comoLaVe(
  jornada: JornadaQuiniela,
  yo: string | null,
  cerrada: boolean,
): JornadaQuiniela {
  if (cerrada) return jornada;

  const puestos: Record<string, number> = {};

  const mios: Record<string, (Signo | null)[]> = {};

  for (const [slug, signos] of Object.entries(jornada.pronosticos ?? {})) {
    puestos[slug] = signos.filter(Boolean).length;

    if (slug === yo) mios[slug] = signos;
  }

  return { ...jornada, pronosticos: mios, puestos };
}

export function jornadaVacia(jornada: number): JornadaQuiniela {
  return {
    jornada,
    pronosticos: {},
    resultados: partidosDe(jornada).map(() => null),
  };
}
