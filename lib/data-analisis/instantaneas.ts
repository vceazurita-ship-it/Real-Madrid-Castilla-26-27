import { esNuestro } from "./individual";
import type { FilaJugador } from "./leer";

/**
 * LO QUE HIZO EN ESTA JORNADA, RESTANDO DOS FOTOS.
 *
 * La descarga individual de Wyscout es **acumulada**: una fila por jugador con
 * lo que lleva en toda la temporada, todo por noventa minutos. No trae el
 * partido a partido, y por eso hasta ahora el once sólo podía contar el curso
 * entero mientras Opta y nuestras valoraciones sí se recortaban.
 *
 * Pero si se guarda una **foto** de esa fila cada semana, la diferencia entre
 * dos fotos **es** lo que pasó entre medias. Con los minutos de cada foto se
 * recupera lo que hizo en ese tramo y se vuelve a poner por noventa minutos,
 * que es como se compara.
 *
 * **Las tres primeras jornadas ya no se pueden partir**: cuando se empezó a
 * guardar fotos (18/09/2026) ya venían sumadas en una sola fila, y de una suma
 * no se saca el reparto. De la cuarta en adelante, sí.
 *
 * ## Cómo se resta cada cosa
 *
 * No todas las columnas se restan igual, y confundirlas da números que parecen
 * buenos y no lo son:
 *
 * - **Las de «por 90»** (`Pases/90`, `Duelos aéreos en los 90`): se deshace el
 *   promedio con los minutos de cada foto —`valor × minutos ÷ 90`—, se restan
 *   los totales y se vuelve a dividir por los minutos del tramo.
 * - **Los totales** (`Goles`, `xG`, `Asistencias`, `Partidos jugados`): se
 *   restan tal cual.
 * - **Los porcentajes** no se pueden restar: un 80 % y un 75 % no dan un
 *   porcentaje del tramo. Se recalculan con su **volumen** —los centros de
 *   «acierto de centro %»— reconstruyendo aciertos e intentos de cada foto.
 *   La tabla de volúmenes es la misma que ya usa la ficha individual.
 * - **Las medias que no son ni tasa ni total** —la longitud media de pase— se
 *   quedan fuera: sin el número de pases de cada tramo no hay forma honesta de
 *   recomponerlas, y es mejor un hueco que una cifra inventada.
 */

/** Una fila de la foto: lo que llevaba acumulado ese jugador ese día. */
export type FilaInstantanea = {
  jugador: string;
  equipo: string;
  /** La «Posición específica» de Wyscout, tal cual. */
  posicion: string;
  partidos: number;
  minutos: number;
  /** Las columnas tal y como venían: por 90, porcentaje o total. */
  datos: Record<string, number>;
};

export type Instantanea = {
  /** Cuándo se tomó, en ISO. */
  tomadaEn: string;
  /** Con qué jornada se corresponde, si se sabe decir. */
  nota?: string;
  jugadores: FilaInstantanea[];
};

export type HistorialInstantaneas = {
  /** De la más antigua a la más reciente. */
  fotos: Instantanea[];
};

export const CLAVE_INSTANTANEAS = "wyscout-instantaneas";

export const HISTORIAL_VACIO: HistorialInstantaneas = { fotos: [] };

/* ------------------------------------------------------------------ */
/*  DE QUÉ TIPO ES CADA COLUMNA                                        */
/* ------------------------------------------------------------------ */

export type TipoColumna = "tasa" | "porcentaje" | "total" | "media";

/**
 * Qué clase de número es una columna, por cómo la rotula Wyscout.
 *
 * Se decide por el rótulo y no por una lista a mano para que una columna nueva
 * de la descarga entre sola: todas las de tasa llevan «/90» o «en los 90», y
 * todas las de porcentaje llevan «%».
 */
export function tipoDeColumna(columna: string): TipoColumna {
  if (columna.includes("%")) return "porcentaje";

  if (columna.includes("/90") || columna.includes("en los 90")) return "tasa";

  /* «Longitud media pases, m» y «Longitud media pases largos, m». */
  if (columna.startsWith("Longitud media")) return "media";

  return "total";
}

/* ------------------------------------------------------------------ */
/*  TOMAR LA FOTO                                                      */
/* ------------------------------------------------------------------ */

/** La foto de los nuestros, tal y como están hoy en la descarga. */
export function instantaneaDe(
  jugadores: FilaJugador[],
  tomadaEn: Date,
  nota?: string,
): Instantanea {
  const nuestros = jugadores.filter(
    (uno) => esNuestro(uno) && uno.temporada === "actual",
  );

  return {
    tomadaEn: tomadaEn.toISOString(),
    ...(nota ? { nota } : {}),
    jugadores: nuestros
      .map((uno) => ({
        jugador: uno.jugador,
        equipo: uno.equipo,
        posicion: uno.posicion,
        partidos: uno.partidos,
        minutos: uno.minutos,
        datos: uno.datos,
      }))
      .sort((a, b) => a.jugador.localeCompare(b.jugador, "es")),
  };
}

/**
 * Si dos fotos son la misma.
 *
 * Se compara por **minutos y partidos de cada jugador**: si nadie ha jugado
 * nada entre una y otra, la descarga es la misma y guardarla otra vez sólo
 * engorda el documento y mete una resta de cero por el medio.
 */
export function mismaFoto(a: Instantanea, b: Instantanea) {
  const clave = (foto: Instantanea) =>
    foto.jugadores
      .map((uno) => `${uno.jugador}:${uno.partidos}:${uno.minutos}`)
      .join("|");

  return clave(a) === clave(b);
}

/* ------------------------------------------------------------------ */
/*  LA RESTA                                                           */
/* ------------------------------------------------------------------ */

/** Lo que hizo un jugador entre dos fotos, ya con forma de fila de Wyscout. */
export type Tramo = {
  /** La fila sintética: se puede meter en las mismas rejillas. */
  fila: FilaJugador;
  /** Minutos y partidos del tramo. */
  minutos: number;
  partidos: number;
};

/**
 * Deshace el promedio: de «por 90» a total del acumulado.
 *
 * Con cero minutos el total es cero, no `null`: un jugador que no ha jugado no
 * ha hecho nada, que es distinto de no saberlo.
 */
const aTotal = (valor: number, minutos: number) => (valor * minutos) / 90;

/**
 * Lo que hizo cada uno entre dos fotos.
 *
 * `volumenes` dice, para cada porcentaje, de qué columna sale su volumen —la
 * misma tabla de la ficha individual—. Se pasa como argumento en vez de
 * importarla para que este módulo no dependa del catálogo de métricas y se
 * pueda probar solo.
 */
export function tramoEntre(
  antes: Instantanea,
  ahora: Instantanea,
  volumenes: Record<string, { columna: string }>,
): Tramo[] {
  const previas = new Map(antes.jugadores.map((uno) => [uno.jugador, uno]));

  const salida: Tramo[] = [];

  for (const hoy of ahora.jugadores) {
    const ayer = previas.get(hoy.jugador);

    /* Un fichaje que no estaba en la foto anterior: lo suyo ES el tramo. */
    const minutosAntes = ayer?.minutos ?? 0;
    const partidosAntes = ayer?.partidos ?? 0;

    const minutos = hoy.minutos - minutosAntes;
    const partidos = hoy.partidos - partidosAntes;

    /* Sin minutos nuevos no jugó: no hay tramo que contar. */
    if (minutos <= 0) continue;

    const datos: Record<string, number> = {};

    for (const [columna, valor] of Object.entries(hoy.datos)) {
      const tipo = tipoDeColumna(columna);

      const previo = ayer?.datos[columna];

      if (tipo === "media") continue;

      if (tipo === "total") {
        datos[columna] = valor - (previo ?? 0);

        continue;
      }

      if (tipo === "tasa") {
        const hecho = aTotal(valor, hoy.minutos) - aTotal(previo ?? 0, minutosAntes);

        datos[columna] = (hecho / minutos) * 90;

        continue;
      }

      /*
      | Porcentaje: se recompone con su volumen.
      |
      | Aciertos = volumen × minutos ÷ 90 × porcentaje ÷ 100, en cada foto. La
      | resta de aciertos entre la resta de intentos es el porcentaje del tramo.
      | Sin intentos nuevos no hay porcentaje que dar —y un 0 % ahí sería una
      | mentira—, así que esa columna se queda fuera de este tramo.
      */
      const volumen = volumenes[columna];

      if (!volumen) continue;

      const intentosAhora = aTotal(hoy.datos[volumen.columna] ?? 0, hoy.minutos);

      const intentosAntes = aTotal(ayer?.datos[volumen.columna] ?? 0, minutosAntes);

      const intentos = intentosAhora - intentosAntes;

      if (intentos <= 0) continue;

      const aciertos =
        (intentosAhora * valor) / 100 - (intentosAntes * (previo ?? 0)) / 100;

      datos[columna] = Math.max(0, Math.min(100, (aciertos / intentos) * 100));
    }

    salida.push({
      minutos,
      partidos,
      fila: {
        jugador: hoy.jugador,
        equipo: hoy.equipo,
        temporada: "actual",
        posicion: hoy.posicion,
        edad: 0,
        partidos,
        minutos,
        pie: "",
        altura: 0,
        peso: 0,
        contrato: "",
        datos,
      },
    });
  }

  return salida.sort((a, b) => b.minutos - a.minutos);
}

/* ------------------------------------------------------------------ */
/*  LOS TRAMOS QUE SE PUEDEN OFRECER                                   */
/* ------------------------------------------------------------------ */

export type TramoDisponible = {
  /** Índice de la foto anterior y de la posterior dentro del historial. */
  desde: number;
  hasta: number;
  /** "12 sep → 19 sep". */
  rotulo: string;
  /** Cuántos minutos del equipo cubre, para poder decir si es un partido o dos. */
  minutos: number;
};

const dia = (iso: string) => {
  const [anio, mes, resto] = iso.split("-");

  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  return `${Number(resto.slice(0, 2))} ${meses[Number(mes) - 1] ?? ""}${
    anio !== String(new Date().getFullYear()) ? ` ${anio.slice(2)}` : ""
  }`;
};

/**
 * Los tramos que salen de un historial: cada foto contra la anterior.
 *
 * Con una sola foto la lista viene vacía, y la pantalla lo dice en vez de
 * ofrecer un selector que no hace nada.
 */
export function tramosDe(
  historial: HistorialInstantaneas,
  volumenes: Record<string, { columna: string }>,
): TramoDisponible[] {
  const salida: TramoDisponible[] = [];

  for (let i = 1; i < historial.fotos.length; i += 1) {
    const tramos = tramoEntre(historial.fotos[i - 1], historial.fotos[i], volumenes);

    if (tramos.length === 0) continue;

    salida.push({
      desde: i - 1,
      hasta: i,
      rotulo: `${dia(historial.fotos[i - 1].tomadaEn)} → ${dia(historial.fotos[i].tomadaEn)}`,
      /* Los minutos del que más jugó: si hubo partido, rondará los noventa. */
      minutos: Math.max(...tramos.map((uno) => uno.minutos)),
    });
  }

  return salida.reverse();
}
