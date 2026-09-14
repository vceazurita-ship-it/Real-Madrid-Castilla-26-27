import type { FilaJugador, FilaPartido } from "./leer";
import {
  METRICA_POR_KEY,
  valorEnGrupo,
  type Metrica,
} from "./metricas";
import {
  METRICAS_JUGADOR,
  metricasDe,
  percentilEnPlantilla,
  puestoDe,
  valorDe,
  type MetricaJugador,
  type Puesto,
} from "./individual";
import { mismoEquipo } from "./nombres";

/**
 * QUÉ HACE DISTINTO A ESTE EQUIPO, Y A ESTE JUGADOR.
 *
 * Una tabla de cincuenta y siete métricas dice mucho de un equipo y no dice
 * **nada** de un vistazo: para saber a qué se parece un rival hay que leerla
 * entera y acordarse de la media de la liga en cada fila. Lo que un cuerpo
 * técnico necesita el lunes es lo contrario: cuatro frases con lo que de
 * verdad le separa del resto.
 *
 * Así que aquí no se mira métrica a métrica sino **por aspectos**: grupos de
 * dos o tres métricas que describen lo mismo. «Presión alta» son el PPDA y las
 * recuperaciones en campo rival juntas; una sola de las dos se puede disparar
 * por el estilo del rival de turno, las dos a la vez ya es una manera de jugar.
 *
 * Y todo se mide contra **la mediana de la categoría**, no contra la media: con
 * veinte equipos, uno que presione como nadie arrastra la media y no la
 * mediana.
 */

/* ------------------------------------------------------------------ */
/*  LOS ASPECTOS                                                       */
/* ------------------------------------------------------------------ */

export type Aspecto = {
  key: string;
  /** Cómo se llama en la caseta. */
  label: string;
  momento: "con" | "sin" | "trOf" | "trDef" | "abp";
  /** Las métricas que lo componen, del catálogo de equipo. */
  metricas: string[];
  /** Qué significa destacar en esto, en una línea. */
  explica: string;
};

export const ASPECTOS: Aspecto[] = [
  {
    key: "presion",
    label: "Presión alta",
    momento: "sin",
    metricas: ["ppda", "recuperacionesAltas"],
    explica: "Aprieta arriba y roba lejos de su portería",
  },
  {
    key: "dominio",
    label: "Dominio con balón",
    momento: "con",
    metricas: ["posesion", "pases", "pasesPrecisos"],
    explica: "Quiere el balón y lo mueve con acierto",
  },
  {
    key: "progresion",
    label: "Progresión",
    momento: "con",
    metricas: ["cuotaProgresivos", "pasesProgresivos", "progresivosPrecisos"],
    explica: "Su circulación avanza en vez de mantener",
  },
  {
    key: "llegada",
    label: "Llegada al área",
    momento: "con",
    metricas: ["entradasArea", "toquesArea", "cuotaUltimoTercio"],
    explica: "Entra dentro, no se queda en la frontal",
  },
  {
    key: "remate",
    label: "Producción de remate",
    momento: "con",
    metricas: ["tiros", "xg", "xgPorTiro"],
    explica: "Genera volumen y calidad de tiro",
  },
  {
    key: "directo",
    label: "Juego directo",
    momento: "con",
    metricas: ["pasesLargos", "longitudPase", "duelosAereos"],
    explica: "Salta líneas con el pase largo y disputa arriba",
  },
  {
    key: "banda",
    label: "Juego por fuera",
    momento: "con",
    metricas: ["centros", "centrosPrecisos"],
    explica: "Ataca por el centro lateral",
  },
  {
    key: "transicionOf",
    label: "Ataque en transición",
    momento: "trOf",
    metricas: ["contras", "contrasRemate"],
    explica: "Sale corriendo al robar y remata la contra",
  },
  {
    key: "verticalidad",
    label: "Verticalidad",
    momento: "trOf",
    metricas: ["pasesPorOcasion", "minutosPorOcasion", "pasesProfundidad"],
    explica: "Llega con pocos pases y poco tiempo",
  },
  {
    key: "solidez",
    label: "Solidez defensiva",
    momento: "sin",
    metricas: ["tirosContra", "duelosDefensivos", "interceptaciones"],
    explica: "Concede poco y gana el duelo defensivo",
  },
  {
    key: "repliegue",
    label: "Defensa de área",
    momento: "sin",
    metricas: ["despejes", "duelosAereos", "tirosContraPuerta"],
    explica: "Defiende cerca de su portería y despeja",
  },
  {
    key: "cuidado",
    label: "Cuidado del balón",
    momento: "trDef",
    metricas: ["perdidas", "perdidasBajas"],
    explica: "Pierde poco y lejos de su área",
  },
  {
    key: "duelo",
    label: "Contundencia en el duelo",
    momento: "sin",
    metricas: ["duelos", "duelosGanados", "faltas"],
    explica: "Va al choque y lo gana",
  },
  {
    key: "abpOf",
    label: "Balón parado a favor",
    momento: "abp",
    metricas: ["corners", "cornersRemate", "cuotaRematesAbp"],
    explica: "Saca rédito de la estrategia",
  },
  {
    key: "abpDef",
    label: "Balón parado en contra",
    momento: "abp",
    metricas: ["corners", "cornersRemate"],
    explica: "Cuánta estrategia concede y cuánta le rematan",
  },
  {
    key: "eficacia",
    label: "Eficacia",
    momento: "con",
    metricas: ["goles", "golesMenosXg"],
    explica: "Marca por encima o por debajo de lo que genera",
  },
];

export const ASPECTO_POR_KEY = new Map(ASPECTOS.map((a) => [a.key, a]));

/**
 * Los cuatro con los que se abre, y por qué éstos.
 *
 * Son los que más veces cambian un plan de partido: cómo presiona, si domina
 * el balón, si llega al área y si concede. Todo lo demás afina; esto cuatro
 * deciden si se sale a apretar o a esperar. El usuario los cambia cuando su
 * rival pide otra cosa.
 */
export const ASPECTOS_POR_DEFECTO = ["presion", "dominio", "llegada", "solidez"];

/** Cuántos caben en una diapositiva sin que deje de leerse. */
export const MAXIMO_DESTACADOS = 4;

/* ------------------------------------------------------------------ */
/*  EL EQUIPO                                                          */
/* ------------------------------------------------------------------ */

export type DesviacionMetrica = {
  metrica: Metrica;
  valor: number;
  mediana: number;
  /** Dónde queda entre los veinte equipos, con el sentido ya puesto. */
  percentil: number;
};

export type DestacadoEquipo = {
  aspecto: Aspecto;
  /** Media de los percentiles de sus métricas: 50 es del montón. */
  percentil: number;
  /** Lo mismo contado desde la media: −50 … +50. */
  desviacion: number;
  filas: DesviacionMetrica[];
};

/**
 * Se mide en percentiles, no en tanto por ciento sobre la mediana.
 *
 * La primera versión dividía por la mediana de la liga, y con eso el aspecto
 * «Eficacia» salía **−1.101 %** para el Castilla: su mediana es «goles menos
 * xG», que en una categoría entera vale casi cero, y dividir por casi cero
 * dispara cualquier cosa. La eficacia salía siempre la primera de todos los
 * equipos, que es tanto como no ordenar nada.
 *
 * El percentil no divide por nada, va acotado entre 0 y 100 y es lo que ya usa
 * el resto de la plataforma, así que dos aspectos se pueden comparar entre sí
 * aunque uno vaya en segundos y otro en porcentaje.
 */
function percentilEnLiga(
  metrica: Metrica,
  valor: number,
  liga: FilaPartido[],
  equipos: string[],
  mejorAlto: boolean | null,
) {
  const valores = equipos
    .map((e) => valorEnGrupo(metrica, liga.filter((p) => p.equipo === e)))
    .filter((v): v is number => v !== null);

  if (valores.length < 5) return null;

  const peores = valores.filter((v) =>
    mejorAlto === false ? v > valor : v < valor,
  ).length;

  const iguales = valores.filter((v) => v === valor).length;

  const mediana = [...valores].sort((a, b) => a - b)[
    Math.floor(valores.length / 2)
  ];

  return {
    percentil: Math.round(((peores + iguales / 2) / valores.length) * 100),
    mediana,
  };
}

/**
 * Cuánto se sale este equipo de la categoría, aspecto por aspecto.
 *
 * Positivo es «hace más de esto que el resto», con el sentido de cada métrica
 * ya puesto: en PPDA, pérdidas o remates en contra, **menos** es más. Así una
 * desviación positiva siempre se lee igual, sea la métrica que sea.
 */
export function destacadosDeEquipo(
  equipo: string,
  liga: FilaPartido[],
  equipos: string[],
  aspectos: Aspecto[] = ASPECTOS,
): DestacadoEquipo[] {
  const suyos = liga.filter((p) => mismoEquipo(p.equipo, equipo));

  if (suyos.length === 0) return [];

  /* Las de «en contra» salen de la fila del rival, no de la suya. */
  const contra = liga.filter((p) => mismoEquipo(p.rival, equipo));

  return aspectos
    .map((aspecto) => {
      const filas: DesviacionMetrica[] = [];

      const enContra = aspecto.key === "abpDef";

      for (const key of aspecto.metricas) {
        const metrica = METRICA_POR_KEY.get(key);

        if (!metrica) continue;

        const valor = valorEnGrupo(metrica, enContra ? contra : suyos);

        if (valor === null) continue;

        /*
        | En «balón parado en contra» el sentido se gira: que le saquen muchos
        | córners no es una virtud suya, aunque la métrica diga «más mejor».
        */
        const mejorAlto =
          metrica.mejorAlto === null
            ? null
            : enContra
              ? !metrica.mejorAlto
              : metrica.mejorAlto;

        const enLaLiga = percentilEnLiga(
          metrica,
          valor,
          liga,
          equipos,
          mejorAlto,
        );

        if (!enLaLiga) continue;

        filas.push({
          metrica,
          valor,
          mediana: enLaLiga.mediana,
          percentil: enLaLiga.percentil,
        });
      }

      if (filas.length === 0) return null;

      const percentil =
        filas.reduce((s, f) => s + f.percentil, 0) / filas.length;

      return { aspecto, percentil, desviacion: percentil - 50, filas };
    })
    .filter((d): d is DestacadoEquipo => d !== null)
    .sort((a, b) => Math.abs(b.desviacion) - Math.abs(a.desviacion));
}

/* ------------------------------------------------------------------ */
/*  LA NUBE DE LA CATEGORÍA                                            */
/* ------------------------------------------------------------------ */

export type PuntoNube = {
  equipo: string;
  x: number;
  /** `null` cuando el aspecto sólo tiene una métrica con datos. */
  y: number | null;
};

export type NubeAspecto = {
  x: Metrica;
  y: Metrica | null;
  medianaX: number;
  medianaY: number | null;
  puntos: PuntoNube[];
};

const medianaDe = (valores: number[]) =>
  [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)];

/**
 * Los veinte equipos en las dos métricas de un aspecto.
 *
 * Es lo que convierte «va +33 en dominio con balón» en una imagen: cada equipo
 * un punto, las dos medianas cruzando el dibujo y el que interesa marcado. Una
 * barra dice cuánto; la nube dice **con quién se parece y de quién se separa**,
 * que es lo que se pregunta al preparar un partido.
 *
 * Se queda con las dos primeras métricas del aspecto que tengan dato. Con una
 * sola no hay dispersión que pintar y se devuelve `y: null`: quien lo dibuje
 * decide qué hacer con eso.
 */
export function nubeDeAspecto(
  destacado: DestacadoEquipo,
  liga: FilaPartido[],
  equipos: string[],
): NubeAspecto | null {
  const metX = destacado.filas[0]?.metrica;

  if (!metX) return null;

  const metY = destacado.filas[1]?.metrica ?? null;

  /* En «balón parado en contra» las cifras de cada equipo son las de sus
     rivales, igual que en el cálculo de arriba. */
  const enContra = destacado.aspecto.key === "abpDef";

  const puntos: PuntoNube[] = [];

  for (const equipo of equipos) {
    const suyas = enContra
      ? liga.filter((p) => mismoEquipo(p.rival, equipo))
      : liga.filter((p) => mismoEquipo(p.equipo, equipo));

    if (suyas.length === 0) continue;

    const x = valorEnGrupo(metX, suyas);

    if (x === null) continue;

    puntos.push({ equipo, x, y: metY ? valorEnGrupo(metY, suyas) : null });
  }

  if (puntos.length < 3) return null;

  const enY = puntos
    .map((p) => p.y)
    .filter((v): v is number => v !== null);

  return {
    x: metX,
    y: metY && enY.length >= 3 ? metY : null,
    medianaX: medianaDe(puntos.map((p) => p.x)),
    medianaY: enY.length >= 3 ? medianaDe(enY) : null,
    puntos,
  };
}

/**
 * A partir de aquí deja de ser ruido.
 *
 * Veinte puntos de percentil son quedar por encima del 70 % de la categoría o
 * por debajo del 30 %. Menos que eso, con veinte equipos y tres jornadas, es
 * el vaivén normal. Es un umbral de oficio, no una prueba estadística, y la
 * pantalla lo dice.
 */
export const UMBRAL_EQUIPO = 20;

/* ------------------------------------------------------------------ */
/*  EL JUGADOR                                                         */
/* ------------------------------------------------------------------ */

export type DesviacionJugador = {
  metrica: MetricaJugador;
  valor: number;
  percentil: number;
};

export type DestacadoJugador = {
  jugador: FilaJugador;
  puesto: Puesto;
  /** Qué parte de los minutos posibles ha jugado. */
  cuotaMinutos: number;
  /** Lo que más le separa de los de su puesto, de mayor a menor. */
  fuertes: DesviacionJugador[];
  flojos: DesviacionJugador[];
};

/** Minutos que se le piden a un jugador para juzgarle: el 60 % de lo posible. */
export const CUOTA_MINUTOS = 0.6;

/** A partir de aquí un jugador destaca de verdad en algo. */
export const PERCENTIL_DESTACA = 80;
export const PERCENTIL_FLOJEA = 20;

/**
 * Quién destaca de una plantilla, y en qué.
 *
 * Dos reglas que evitan las dos tonterías más fáciles:
 *
 * - **Sólo con minutos.** Un «por noventa» de quien ha jugado veinte minutos
 *   es una extrapolación de tres acciones, y siempre sale alguien disparado.
 *   Se piden seis de cada diez minutos posibles del equipo.
 * - **Contra los de su puesto.** Un central nunca va a destacar en regates ni
 *   un extremo en despejes: comparar a todos con todos sólo descubre en qué
 *   posición juega cada uno.
 */
export function destacadosDeJugadores(
  jugadores: FilaJugador[],
  equipo: string,
  universo: FilaJugador[],
): DestacadoJugador[] {
  const suyos = jugadores.filter(
    (j) => j.temporada === "actual" && mismoEquipo(j.equipo, equipo),
  );

  if (suyos.length === 0) return [];

  /*
  | Cuántos minutos se han podido jugar. Y esto tiene dos trampas.
  |
  | La primera: **no se puede preguntar sólo al equipo**. La descarga de
  | Wyscout no trae los mismos partidos de todos —del Huesca hay uno y del
  | Castilla tres—, y midiendo cada equipo contra sí mismo, quien jugó el
  | único partido bajado de los suyos salía con el «89 % de los minutos» y
  | entraba en la hoja de destacados con noventa minutos en las piernas. El
  | suelo es la jornada de la categoría: el que más ha jugado de los dos mil.
  |
  | La segunda: Wyscout **cuenta el descuento**, así que un fijo puede pasar
  | de los noventa por partido y salir con el 113 %, que en una diapositiva se
  | lee como un error. Por eso el techo es el mayor de los tres.
  */
  const jornadas = Math.max(
    ...universo.filter((j) => j.temporada === "actual").map((j) => j.partidos),
    ...suyos.map((j) => j.partidos),
    1,
  );

  const posibles = Math.max(jornadas * 90, ...suyos.map((j) => j.minutos));

  return suyos
    .map((jugador) => {
      const cuotaMinutos = posibles > 0 ? jugador.minutos / posibles : 0;

      if (cuotaMinutos < CUOTA_MINUTOS) return null;

      const puesto = puestoDe(jugador.posicion);

      /* Los de su puesto en toda la categoría, con minutos bastantes. */
      const iguales = universo.filter(
        (j) =>
          j.temporada === "actual" &&
          puestoDe(j.posicion) === puesto &&
          j.minutos >= 90,
      );

      if (iguales.length < 8) return null;

      const filas: DesviacionJugador[] = [];

      for (const metrica of metricasDe(puesto)) {
        if (metrica.mejorAlto === null) continue;

        const valor = valorDe(jugador, metrica.columna);

        if (valor === null) continue;

        const percentil = percentilEnPlantilla(
          valor,
          iguales
            .map((c) => valorDe(c, metrica.columna))
            .filter((v): v is number => v !== null),
          metrica.mejorAlto,
        );

        if (percentil === null) continue;

        filas.push({ metrica, valor, percentil });
      }

      const orden = [...filas].sort((a, b) => b.percentil - a.percentil);

      return {
        jugador,
        puesto,
        cuotaMinutos,
        fuertes: orden.filter((f) => f.percentil >= PERCENTIL_DESTACA).slice(0, 3),
        flojos: orden
          .filter((f) => f.percentil <= PERCENTIL_FLOJEA)
          .slice(-3)
          .reverse(),
      };
    })
    .filter((d): d is DestacadoJugador => d !== null && d.fuertes.length > 0)
    /* Manda quien más destaca: el mejor percentil que tenga. */
    .sort((a, b) => (b.fuertes[0]?.percentil ?? 0) - (a.fuertes[0]?.percentil ?? 0));
}

/* ------------------------------------------------------------------ */
/*  LAS FRASES                                                         */
/* ------------------------------------------------------------------ */

export function fraseDeEquipo(destacado: DestacadoEquipo, equipo: string) {
  const p = Math.round(destacado.percentil);

  const como =
    destacado.desviacion >= 0
      ? `por delante del ${p} % de la categoría`
      : `por detrás: sólo el ${p} % de la categoría queda por debajo`;

  return `${equipo} va ${como} en ${destacado.aspecto.label.toLowerCase()}: ${destacado.aspecto.explica.toLowerCase()}.`;
}

export function fraseDeJugador(destacado: DestacadoJugador) {
  if (destacado.fuertes.length === 0) {
    return `${destacado.jugador.jugador} no destaca en nada concreto de los de su puesto.`;
  }

  const lista = destacado.fuertes
    .map((f) => `${f.metrica.nombre.toLowerCase()} (p${f.percentil})`)
    .join(", ");

  return `${destacado.jugador.jugador} destaca entre los de su puesto en ${lista}.`;
}

/** Las métricas de jugador que existen de verdad, para avisar si falta alguna. */
export const COLUMNAS_JUGADOR = METRICAS_JUGADOR.map((m) => m.columna);
