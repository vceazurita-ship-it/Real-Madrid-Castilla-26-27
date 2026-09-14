import type { FilaJugador, FilaPartido } from "./leer";
import {
  METRICAS,
  formatea,
  percentil,
  temporadaDe,
  valorEnGrupo,
} from "./metricas";
import {
  ASPECTOS,
  UMBRAL_EQUIPO,
  destacadosDeEquipo,
} from "./destacados";
import {
  METRICAS_JUGADOR,
  esNuestro,
  metricasDe,
  percentilEnPlantilla,
  puestoDe,
  universoDe,
  valorDe,
} from "./individual";

/**
 * LO QUE HAY QUE MIRAR HOY, SIN ABRIR NADA.
 *
 * La plataforma tiene cuarenta pantallas y ninguna avisa: hay que entrar a
 * buscar. Esto le da la vuelta —**el dato viene a por ti**— y se pone en la
 * portada: lo que se sale de lo normal, para bien y para mal, con el enlace a
 * la pantalla donde se mira entero.
 *
 * Tres reglas al escribir una alerta, que son las que impiden que esto se
 * convierta en ruido:
 *
 * - **Sólo lo que se sale.** Un percentil 55 no es noticia. Cada regla lleva
 *   su listón —±20 puntos en un aspecto, p85 en una métrica— y por debajo no
 *   aparece nada. Vale más una portada sin alertas que una con seis inventadas.
 * - **Las buenas también.** Un panel que sólo avisa de lo malo se lee como una
 *   bronca y se deja de mirar. Lo que el equipo hace mejor que nadie es tan
 *   accionable como lo que hace peor: se sostiene, se explota, se enseña.
 * - **Con su sitio.** Cada alerta dice a qué pantalla lleva y qué mirar al
 *   llegar. Una alerta sin destino es una preocupación, no una herramienta.
 *
 * Todo lo de aquí sale del dataset que ya está abierto en el servidor: ni una
 * lectura más, ni una hoja, ni una petición. Las alertas de otras áreas —los
 * seguimientos, por ejemplo— las arma quien tiene esos datos a mano.
 */

export type Alerta = {
  clave: string;
  tono: "buena" | "mala";
  /** De dónde sale: «Data · contra la liga». */
  area: string;
  titulo: string;
  /** Qué significa, en una línea. */
  detalle: string;
  /** La cifra que la dispara, ya escrita. */
  cifra: string;
  /**
   * Cuánto se sale de lo normal, de 0 a 100.
   *
   * Es lo único que ordena la lista: sin una medida común, un percentil 92 y
   * un aspecto a +40 no se pueden poner uno encima del otro.
   */
  fuerza: number;
  enlace: string;
  /** Qué mirar al llegar. */
  mira: string;
};

/** Cómo se llama el Castilla en los informes de Wyscout. */
const NOSOTROS = "Real Madrid Castilla";

/* A partir de aquí una métrica suelta deja de ser vaivén. */
const PERCENTIL_ALTO = 85;
const PERCENTIL_BAJO = 15;

/** Cuántos goles por partido de desvío sobre el xG ya son noticia. */
const DESVIO_GOL = 0.4;

/** Lo que se le pide a un jugador para juzgarle: los mismos minutos que en el resto de la app. */
const CUOTA_MINUTOS = 0.6;

export function alertasDeData(
  partidos: FilaPartido[],
  jugadores: FilaJugador[],
): Alerta[] {
  const temporadas = [...new Set(partidos.map((p) => temporadaDe(p.fecha)))]
    .filter(Boolean)
    .sort();

  const actual = temporadas[temporadas.length - 1] ?? "";

  const liga = partidos.filter((p) => temporadaDe(p.fecha) === actual);

  const equipos = [...new Set(liga.map((p) => p.equipo))];

  const nuestros = liga.filter((p) => p.equipo === NOSOTROS);

  if (nuestros.length === 0 || equipos.length < 5) return [];

  const alertas: Alerta[] = [];

  /* ---------------------------------------------------------------- */
  /*  1 · LOS ASPECTOS EN LOS QUE NOS SALIMOS                          */
  /* ---------------------------------------------------------------- */

  const aspectos = destacadosDeEquipo(NOSOTROS, liga, equipos, ASPECTOS);

  /* Las métricas que ya cuenta un aspecto no vuelven a salir sueltas. */
  const contadas = new Set<string>();

  for (const uno of aspectos) {
    if (Math.abs(uno.desviacion) < UMBRAL_EQUIPO) continue;

    for (const fila of uno.filas) contadas.add(fila.metrica.key);

    const arriba = uno.desviacion > 0;

    alertas.push({
      clave: `aspecto-${uno.aspecto.key}`,
      tono: arriba ? "buena" : "mala",
      area: "Data · los más destacados",
      titulo: arriba
        ? `${uno.aspecto.label}: de lo mejor de la categoría`
        : `${uno.aspecto.label}: de lo peor de la categoría`,
      detalle: `${uno.aspecto.explica}. Lo dicen ${uno.filas.length} métricas a la vez, no una suelta.`,
      cifra: `percentil ${Math.round(uno.percentil)} de ${equipos.length} equipos`,
      fuerza: Math.min(100, Math.abs(uno.desviacion) * 2),
      enlace: "/data-analisis?area=destacados",
      mira: "El aspecto abierto métrica a métrica, y qué equipos se le parecen.",
    });
  }

  /* ---------------------------------------------------------------- */
  /*  2 · LAS MÉTRICAS SUELTAS QUE SE DISPARAN                         */
  /* ---------------------------------------------------------------- */

  for (const metrica of METRICAS) {
    /* Las de estilo no se juzgan: tener muchos centros no es bueno ni malo. */
    if (metrica.mejorAlto === null) continue;

    if (contadas.has(metrica.key)) continue;

    const nuestro = valorEnGrupo(metrica, nuestros);

    if (nuestro === null) continue;

    const todos = equipos
      .map((e) => valorEnGrupo(metrica, liga.filter((p) => p.equipo === e)))
      .filter((v): v is number => v !== null);

    const p = percentil(nuestro, todos, metrica.mejorAlto);

    if (p === null || (p < PERCENTIL_ALTO && p > PERCENTIL_BAJO)) continue;

    const arriba = p >= PERCENTIL_ALTO;

    const puesto = arriba
      ? todos.filter((v) => (metrica.mejorAlto ? v > nuestro : v < nuestro)).length + 1
      : todos.filter((v) => (metrica.mejorAlto ? v < nuestro : v > nuestro)).length + 1;

    alertas.push({
      clave: `metrica-${metrica.key}`,
      tono: arriba ? "buena" : "mala",
      area: "Data · contra la liga",
      titulo: arriba
        ? `${metrica.nombre}: ${puesto}º de ${todos.length}`
        : `${metrica.nombre}: ${puesto}º por la cola de ${todos.length}`,
      detalle: metrica.comoLeer,
      cifra: `${formatea(nuestro, metrica.unidad)} · percentil ${p}`,
      fuerza: Math.min(100, Math.abs(p - 50) * 2),
      enlace: "/data-analisis?area=liga",
      mira: "La barra de esa métrica y el resto de su fase de juego.",
    });
  }

  /* ---------------------------------------------------------------- */
  /*  3 · LO QUE SE MARCA POR ENCIMA O POR DEBAJO DE LO QUE SE GENERA  */
  /* ---------------------------------------------------------------- */

  const metDif = METRICAS.find((m) => m.key === "golesMenosXg");

  const dif = metDif ? valorEnGrupo(metDif, nuestros) : null;

  if (dif !== null && Math.abs(dif) >= DESVIO_GOL) {
    const arriba = dif > 0;

    alertas.push({
      clave: "goles-menos-xg",
      tono: arriba ? "buena" : "mala",
      area: "Data · nuestra historia",
      titulo: arriba
        ? "Se marca por encima de lo que valen las ocasiones"
        : "Se marca por debajo de lo que valen las ocasiones",
      detalle: arriba
        ? "Acierto por delante de lo generado. Sostenido es un buen delantero; en tres partidos, casi siempre vuelve a su sitio."
        : "Se generan ocasiones que no se terminan. Si el xG sostiene, es cuestión de tiempo; si no, el problema está antes del remate.",
      cifra: `${dif >= 0 ? "+" : ""}${dif.toFixed(2)} goles por partido sobre el xG`,
      fuerza: Math.min(100, Math.abs(dif) * 60),
      enlace: "/data-analisis?area=historia",
      mira: "La serie por temporadas y el partido a partido de este curso.",
    });
  }

  /* ---------------------------------------------------------------- */
  /*  4 · LOS NUESTROS, CONTRA LOS DE SU PUESTO EN LA CATEGORÍA        */
  /* ---------------------------------------------------------------- */

  const deEsteAno = jugadores.filter((j) => j.temporada === "actual");

  const plantilla = deEsteAno.filter((j) => esNuestro(j));

  const jornadas = Math.max(...deEsteAno.map((j) => j.partidos), 1);

  const posibles = Math.max(
    jornadas * 90,
    ...plantilla.map((j) => j.minutos),
    1,
  );

  const universo = universoDe(jugadores, "liga");

  for (const jugador of plantilla) {
    if (jugador.minutos / posibles < CUOTA_MINUTOS) continue;

    const puesto = puestoDe(jugador.posicion);

    const iguales = universo.filter((j) => puestoDe(j.posicion) === puesto);

    if (iguales.length < 8) continue;

    let mejor: { nombre: string; percentil: number; valor: number; unidad: string } | null =
      null;

    let flojas = 0;

    for (const metrica of metricasDe(puesto)) {
      if (metrica.mejorAlto === null) continue;

      const valor = valorDe(jugador, metrica.columna);

      if (valor === null) continue;

      const p = percentilEnPlantilla(
        valor,
        iguales
          .map((c) => valorDe(c, metrica.columna))
          .filter((v): v is number => v !== null),
        metrica.mejorAlto,
      );

      if (p === null) continue;

      if (p <= 10) flojas += 1;

      if (p >= 95 && (!mejor || p > mejor.percentil)) {
        mejor = {
          nombre: metrica.nombre,
          percentil: p,
          valor,
          unidad: metrica.unidad,
        };
      }
    }

    if (mejor) {
      alertas.push({
        clave: `jugador-bien-${jugador.jugador}`,
        tono: "buena",
        area: "Data · jugador a jugador",
        titulo: `${jugador.jugador} está entre los mejores de su puesto`,
        detalle: `${mejor.nombre} en el percentil ${mejor.percentil} de los ${iguales.length} de su puesto en la categoría. Con ${jugador.minutos}′ jugados no es una casualidad de un rato.`,
        cifra: `${mejor.nombre} ${formatea(mejor.valor, mejor.unidad as never)}`,
        fuerza: Math.min(100, (mejor.percentil - 50) * 2),
        enlace: "/data-analisis?area=individual",
        mira: "Su ficha entera, métrica a métrica, y su evolución respecto al año pasado.",
      });
    }

    /*
    | Tres cosas en el percentil 10 no es «una métrica mala»: es que en algo
    | del juego se le está pidiendo lo que no da, y con esos minutos encima.
    */
    if (flojas >= 3) {
      alertas.push({
        clave: `jugador-flojo-${jugador.jugador}`,
        tono: "mala",
        area: "Data · jugador a jugador",
        titulo: `${jugador.jugador} juega mucho y va por detrás de los de su puesto`,
        detalle: `${flojas} métricas en el percentil 10 o por debajo, contra los ${iguales.length} de su puesto de la categoría. O es el rol o es la forma: las dos cosas se trabajan.`,
        cifra: `${Math.round((jugador.minutos / posibles) * 100)} % de los minutos`,
        fuerza: Math.min(100, 40 + flojas * 8),
        enlace: "/data-analisis?area=individual",
        mira: "Dónde le falta, y si el trabajo individual va de eso.",
      });
    }
  }

  return alertas.sort((a, b) => b.fuerza - a.fuerza);
}

/* ------------------------------------------------------------------ */
/*  LO QUE DE VERDAD SALE A LA PORTADA                                 */
/* ------------------------------------------------------------------ */

/**
 * De treinta y cinco avisos a una docena.
 *
 * Las reglas de arriba disparan mucho —hay cincuenta y siete métricas y
 * veintitantos jugadores— y una portada con treinta alertas no avisa de nada:
 * se lee como una lista y se deja de mirar a la semana.
 *
 * Tres cortes, en este orden:
 *
 * - **Uno por jugador.** Alguien puede estar en el percentil 97 en una cosa y
 *   en el 8 en tres: las dos son verdad, pero en la portada ocupa una línea,
 *   la más fuerte.
 * - **Cupo por familia.** Sin él, seis «está entre los mejores de su puesto»
 *   seguidos tapan el aspecto colectivo que hay debajo.
 * - **Las dos caras.** Si tras los cortes sólo quedan buenas —o sólo malas—,
 *   se rescata lo más fuerte del otro lado. Un panel de una sola cara miente
 *   por omisión.
 */
export function seleccionaAlertas(alertas: Alerta[], tope = 12): Alerta[] {
  const porJugador = new Map<string, Alerta>();

  const resto: Alerta[] = [];

  for (const a of alertas) {
    const jugador = /^jugador-(?:bien|flojo)-(.+)$/.exec(a.clave)?.[1];

    if (!jugador) {
      resto.push(a);
      continue;
    }

    const puesta = porJugador.get(jugador);

    if (!puesta || a.fuerza > puesta.fuerza) porJugador.set(jugador, a);
  }

  const CUPOS: Record<string, number> = {
    aspecto: 3,
    metrica: 3,
    jugador: 3,
    otra: 2,
  };

  const familia = (a: Alerta) =>
    a.clave.startsWith("aspecto-")
      ? "aspecto"
      : a.clave.startsWith("metrica-")
        ? "metrica"
        : a.clave.startsWith("jugador-")
          ? "jugador"
          : "otra";

  const puestas: Alerta[] = [];
  const cuenta: Record<string, number> = {};

  const candidatas = [...resto, ...porJugador.values()].sort(
    (a, b) => b.fuerza - a.fuerza,
  );

  for (const a of candidatas) {
    const f = familia(a);

    if ((cuenta[f] ?? 0) >= CUPOS[f]) continue;

    cuenta[f] = (cuenta[f] ?? 0) + 1;

    puestas.push(a);

    if (puestas.length >= tope) break;
  }

  /* Y que se vean las dos caras, aunque una sea más floja. */
  for (const tono of ["buena", "mala"] as const) {
    if (puestas.some((a) => a.tono === tono)) continue;

    const rescatada = candidatas.find((a) => a.tono === tono);

    if (rescatada) puestas.push(rescatada);
  }

  return puestas.sort((a, b) => b.fuerza - a.fuerza);
}

/** Para que quien la pinte no tenga que saber cuántas métricas hay. */
export const METRICAS_MIRADAS = METRICAS.filter((m) => m.mejorAlto !== null).length;

export const METRICAS_JUGADOR_MIRADAS = METRICAS_JUGADOR.length;
