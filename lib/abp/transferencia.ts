/**
 * El cruce: lo entrenado contra lo que pasa en el partido.
 *
 * Dos preguntas distintas, y conviene no confundirlas.
 *
 * **Urgencia** mira sólo la competición y la dedicación acumulada: qué aspecto
 * ocurre mucho, nos sale mal y apenas se trabaja. Se puede responder desde el
 * primer día, aunque no haya ni un microciclo planificado.
 *
 * **Transferencia** mira si trabajar un aspecto cambió algo: compara los
 * partidos precedidos de trabajo con los que no lo tuvieron. Necesita historia
 * —varios microciclos ya planificados y varios partidos jugados—, así que al
 * principio dice honestamente que todavía no puede opinar. Es la diferencia
 * entre no tener respuesta y tener una respuesta inventada.
 *
 * Las dos cuentas son deliberadamente transparentes: la página enseña los
 * ingredientes al lado del resultado para que se pueda discutir el número.
 */

import type { AbpLado, Aspecto } from "./microciclo";
import { ASPECTOS, claveAspecto } from "./microciclo";
import {
  AspectoStats,
  CompeticionEvent,
  CompeticionPartido,
  STATS_VACIAS,
  buscaPartido,
  encajaEnAspecto,
  statsDeAspecto,
} from "./competicion";

/* ------------------------------------------------------------------ */
/*  SUAVIZADO                                                          */
/* ------------------------------------------------------------------ */

/**
 * Cuántas acciones «prestadas» de la referencia se le suman a cada aspecto.
 *
 * Sin esto, un aspecto con una sola acción que acabó en gol marca 100 % de
 * peligro y se come el ranking. Con `K = 5`, un aspecto necesita volumen real
 * para separarse de lo normal en su familia, y los que apenas ocurren se
 * quedan pegados a ella, que es justo lo que sabemos de ellos.
 */
const K_SUAVIZADO = 5;

function suaviza(peligro: number, acciones: number, referencia: number) {
  return (peligro + K_SUAVIZADO * referencia) / (acciones + K_SUAVIZADO);
}

/**
 * Cuánto nos podemos fiar de lo que dice un aspecto: de 0 sin ninguna acción
 * a casi 1 con muchas.
 *
 * Sin esto, un aspecto que **nunca ocurre** salía urgente: su peligro suavizado
 * se queda en la referencia de su familia —o sea, «va como los demás»— y encima
 * no se ha trabajado nunca, así que sumaba déficit y desatención sin haber
 * ocurrido una sola vez. Reinicio de portería marcaba 56 sobre 100 con cero
 * acciones registradas. Un aspecto que no aparece en el partido no puede ser
 * urgente: no hay nada a lo que transferir.
 */
function confianza(acciones: number) {
  return acciones / (acciones + K_SUAVIZADO);
}

/* ------------------------------------------------------------------ */
/*  URGENCIA                                                           */
/* ------------------------------------------------------------------ */

/**
 * Peso de cada ingrediente. Se declaran aquí, y no repartidos por el código,
 * porque son un criterio del cuerpo técnico y se van a querer discutir.
 */
export const PESOS = {
  /**
   * Lo que hace daño (21/10/2026): acciones con peligro y goles, no el número
   * de acciones. Antes pesaba el volumen puro (40 %) y las cinco primeras eran
   * saques de banda —149 acciones, 5 % de peligro— mientras el córner
   * defensivo, con 18 remates y 2 goles en contra, quedaba en el 38.
   */
  dano: 0.5,
  /** Cómo de mal nos va cuando ocurre, frente a su propia familia. */
  deficit: 0.3,
  /** Cuán poco se ha trabajado esta temporada. */
  desatencion: 0.2,
};

/**
 * Un aspecto con goles en contra nunca baja de aquí ni del tercer puesto: un
 * gol encajado a balón parado es lo que le cuesta puntos al equipo.
 */
export const SUELO_GOL_EN_CONTRA = 65;

export type FilaCruce = {
  aspecto: Aspecto;
  lado: AbpLado;
  /** Minutos en el microciclo que se está viendo. */
  minutosMicro: number;
  /** Minutos en todos los microciclos planificados. */
  minutosTemporada: number;
  stats: AspectoStats;
  /** Peligro ya suavizado, en tanto por ciento. */
  peligroAjustado: number;
  /**
   * Peligro medio de su familia en ese lado, en tanto por ciento: la vara con
   * la que se juzga si el aspecto va bien o mal.
   */
  referencia: number;
  /** Reparto de minutos y de acciones, para comparar dedicación con realidad. */
  pctMinutos: number;
  pctAcciones: number;
  /** `null` cuando ninguna hoja registra la acción. */
  urgencia: number | null;
  ingredientes: { dano: number; deficit: number; desatencion: number };
  /** Subida por goles en contra (ver `SUELO_GOL_EN_CONTRA`). */
  subidaPorGoles: boolean;
  transferencia: Transferencia | null;
};

export type Transferencia = {
  partidosCon: number;
  partidosSin: number;
  accionesCon: number;
  accionesSin: number;
  /** Acciones con peligro en cada grupo: la muestra que de verdad cuenta (20/10/2026). */
  peligrosCon: number;
  peligrosSin: number;
  /** Peligro en cada grupo, en tanto por ciento. */
  pctCon: number;
  pctSin: number;
  /**
   * Diferencia orientada a favor: positiva significa que después de trabajarlo
   * fue mejor (más peligro si atacamos, menos peligro concedido si defendemos).
   * `null` cuando no hay muestra para decir nada.
   */
  delta: number | null;
};

/** Muestra mínima para que la transferencia diga algo en vez de ruido. */
const MINIMO_PARTIDOS = 1;
const MINIMO_ACCIONES = 3;

export type EntradaCruce = {
  events: CompeticionEvent[];
  partidos: CompeticionPartido[];
  /** Minutos del microciclo abierto, por `claveAspecto`. */
  minutosMicro: Map<string, number>;
  /** Minutos de toda la temporada planificada, por `claveAspecto`. */
  minutosTemporada: Map<string, number>;
  /**
   * Qué se trabajó antes de cada partido: para cada jornada, el conjunto de
   * `claveAspecto` con minutos en el microciclo que lleva a ese partido.
   */
  trabajoPrevio: Map<string, Set<string>>;
};

/**
 * Ata cada microciclo planificado con el partido que le corresponde.
 *
 * El enlace es el rival: el micro 5 se prepara contra el Ferrol y la jornada de
 * pretemporada contra el Ferrol es la que mide si aquello sirvió. Los nombres
 * no se escriben igual en las dos hojas, y de eso se encarga `buscaPartido`.
 */
export function construyeTrabajoPrevio(
  planes: { rival: string; minutos: Map<string, number> }[],
  partidos: CompeticionPartido[],
): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();

  planes.forEach((plan) => {
    const partido = buscaPartido(plan.rival, partidos);

    if (!partido) return;

    const trabajado = mapa.get(partido.jornada) ?? new Set<string>();

    plan.minutos.forEach((minutos, clave) => {
      if (minutos > 0) trabajado.add(clave);
    });

    mapa.set(partido.jornada, trabajado);
  });

  return mapa;
}

function calculaTransferencia(
  events: CompeticionEvent[],
  aspecto: Aspecto,
  lado: AbpLado,
  partidos: CompeticionPartido[],
  trabajoPrevio: Map<string, Set<string>>,
): Transferencia | null {
  if (!aspecto.reconocimiento) return null;

  const clave = claveAspecto(aspecto.key, lado);

  const propios = events.filter(
    (event) => event.lado === lado && encajaEnAspecto(event, aspecto),
  );

  const conJornada = new Set(
    partidos
      .filter((partido) => trabajoPrevio.get(partido.jornada)?.has(clave))
      .map((partido) => partido.jornada),
  );

  /* Un partido sólo cuenta como «sin trabajo» si sabemos qué se hizo esa
     semana: una jornada cuyo microciclo ni siquiera está planificado no dice
     nada, y meterla del lado de «sin trabajo» inventaría una comparación. */
  const conocidas = new Set(trabajoPrevio.keys());

  const con = propios.filter((event) => conJornada.has(event.jornada));

  const sin = propios.filter(
    (event) => conocidas.has(event.jornada) && !conJornada.has(event.jornada),
  );

  const partidosCon = new Set(con.map((event) => event.jornada)).size;
  const partidosSin = new Set(sin.map((event) => event.jornada)).size;

  const pct = (lista: CompeticionEvent[]) =>
    lista.length
      ? (lista.filter((event) => event.peligro).length / lista.length) * 100
      : 0;

  const pctCon = pct(con);
  const pctSin = pct(sin);

  const suficiente =
    partidosCon >= MINIMO_PARTIDOS &&
    partidosSin >= MINIMO_PARTIDOS &&
    con.length >= MINIMO_ACCIONES &&
    sin.length >= MINIMO_ACCIONES;

  /* Atacando, más peligro es mejor; defendiendo, menos peligro concedido. */
  const delta = lado === "ofensivo" ? pctCon - pctSin : pctSin - pctCon;

  return {
    partidosCon,
    partidosSin,
    accionesCon: con.length,
    accionesSin: sin.length,
    peligrosCon: con.filter((event) => event.peligro).length,
    peligrosSin: sin.filter((event) => event.peligro).length,
    pctCon,
    pctSin,
    delta: suficiente ? delta : null,
  };
}

/**
 * Monta la tabla del cruce: una fila por aspecto y lado.
 *
 * Se calcula entera de una vez porque las tres normalizaciones —volumen,
 * déficit y desatención— necesitan ver todas las filas para saber cuál es el
 * máximo con el que comparar.
 */
export function construyeCruce(entrada: EntradaCruce): FilaCruce[] {
  const { events, partidos, minutosMicro, minutosTemporada, trabajoPrevio } =
    entrada;

  const nPartidos = partidos.length;

  const lados: AbpLado[] = ["ofensivo", "defensivo"];

  /* ---------------------------------------------------------------- */
  /*  REFERENCIA POR FAMILIA                                          */
  /* ---------------------------------------------------------------- */

  /*
  | Un saque de banda no se juzga con la vara de un córner.
  |
  | Comparando contra la media de todo el lado, los saques de banda salían
  | siempre deficitarios —un 4 % de peligro es lo normal en un saque de banda y
  | un desastre en un córner— y el ranking decía «no generáis nada» de algo que
  | está generando lo que se genera desde ahí. La referencia es la media de su
  | propia familia: córners con córners, faltas con faltas, bandas con bandas.
  |
  | Sirve para dos cosas: es el valor hacia el que se suaviza el peligro de
  | cada aspecto y es la vara con la que se mide su déficit.
  */
  const referencia = new Map<string, number>();

  const grupos = [...new Set(ASPECTOS.map((aspecto) => aspecto.grupo))];

  lados.forEach((lado) => {
    grupos.forEach((grupo) => {
      const delGrupo = ASPECTOS.filter(
        (aspecto) => aspecto.grupo === grupo && aspecto.reconocimiento,
      );

      const propios = events.filter(
        (event) =>
          event.lado === lado &&
          delGrupo.some((aspecto) => encajaEnAspecto(event, aspecto)),
      );

      referencia.set(
        `${grupo}|${lado}`,
        propios.length
          ? propios.filter((event) => event.peligro).length / propios.length
          : 0,
      );
    });
  });

  const referenciaDe = (aspecto: Aspecto, lado: AbpLado) =>
    referencia.get(`${aspecto.grupo}|${lado}`) ?? 0;

  /* --- Primera pasada: datos crudos --- */

  type Bruto = {
    aspecto: Aspecto;
    lado: AbpLado;
    stats: AspectoStats;
    minutosMicro: number;
    minutosTemporada: number;
    peligroAjustado: number;
  };

  const brutos: Bruto[] = [];

  lados.forEach((lado) => {
    ASPECTOS.forEach((aspecto) => {
      const clave = claveAspecto(aspecto.key, lado);

      const stats = aspecto.reconocimiento
        ? statsDeAspecto(events, aspecto, lado, nPartidos)
        : STATS_VACIAS;

      brutos.push({
        aspecto,
        lado,
        stats,
        minutosMicro: minutosMicro.get(clave) ?? 0,
        minutosTemporada: minutosTemporada.get(clave) ?? 0,
        peligroAjustado:
          suaviza(stats.peligro, stats.acciones, referenciaDe(aspecto, lado)) *
          100,
      });
    });
  });

  /* --- Máximos para normalizar --- */

  const conDato = brutos.filter((bruto) => bruto.aspecto.reconocimiento);

  const maxDano = Math.max(
    1e-9,
    ...conDato.map((bruto) =>
      danoDe(bruto.lado, bruto.stats, bruto.peligroAjustado, referenciaDe(bruto.aspecto, bruto.lado) * 100),
    ),
  );

  const maxMinutos = Math.max(
    0,
    ...brutos.map((bruto) => bruto.minutosTemporada),
  );

  const totalAcciones = conDato.reduce(
    (total, bruto) => total + bruto.stats.acciones,
    0,
  );

  const totalMinutos = brutos.reduce(
    (total, bruto) => total + bruto.minutosTemporada,
    0,
  );

  /* --- Segunda pasada: urgencia y transferencia --- */

  const filas: FilaCruce[] = brutos.map((bruto) => {
    const { aspecto, lado, stats } = bruto;

    const dano =
      danoDe(lado, stats, bruto.peligroAjustado, referenciaDe(aspecto, lado) * 100) /
      maxDano;

    /* Todo lo que no sea volumen puro se pondera por la muestra: un aspecto
       del que no sabemos nada no puede arrastrar la urgencia hacia arriba. */
    const fiabilidad = confianza(stats.acciones);

    /*
    | Déficit: cuánto peor que su propia familia.
    |
    | 0,5 es «como el resto de los suyos», 1 es claramente peor y 0 claramente
    | mejor. Atacando duele no generar; defendiendo duele conceder.
    |
    | El punto de comparación es la referencia tal cual —si el aspecto va como
    | su familia, sale exactamente 0,5— y el suelo se aplica sólo a la escala,
    | que es lo que hay que proteger de una división por casi cero. Aplicarlo
    | también al punto de comparación desplazaba a toda una familia de poco
    | peligro hacia el déficit: los saques de banda salían al 0,63 aun yendo
    | clavados a su propia media.
    */
    const base = referenciaDe(aspecto, lado);
    const escala = Math.max(base, 0.05);
    const tasa = bruto.peligroAjustado / 100;

    const bruta =
      lado === "ofensivo"
        ? 0.5 + (base - tasa) / (2 * escala)
        : 0.5 + (tasa - base) / (2 * escala);

    const deficit = Math.max(0, Math.min(1, bruta)) * fiabilidad;

    /* Sin nada planificado todavía, todo está igual de desatendido. */
    const desatencion =
      (maxMinutos ? 1 - bruto.minutosTemporada / maxMinutos : 1) * fiabilidad;

    const urgencia = aspecto.reconocimiento
      ? 100 *
        (PESOS.dano * dano +
          PESOS.deficit * deficit +
          PESOS.desatencion * desatencion)
      : null;

    return {
      aspecto,
      lado,
      minutosMicro: bruto.minutosMicro,
      minutosTemporada: bruto.minutosTemporada,
      stats,
      peligroAjustado: bruto.peligroAjustado,
      referencia: referenciaDe(aspecto, lado) * 100,
      pctMinutos: totalMinutos
        ? (bruto.minutosTemporada / totalMinutos) * 100
        : 0,
      pctAcciones: totalAcciones ? (stats.acciones / totalAcciones) * 100 : 0,
      urgencia,
      ingredientes: { dano, deficit, desatencion },
      subidaPorGoles: false,
      transferencia: calculaTransferencia(
        events,
        aspecto,
        lado,
        partidos,
        trabajoPrevio,
      ),
    };
  });

  /*
  | Gol en contra: nunca por debajo de «Alta» ni fuera de los tres primeros.
  | Se sube hasta la tercera urgencia (o el suelo, la mayor de las dos), así el
  | número sigue ordenado con su puesto y la etiqueta dice lo mismo.
  */
  const tercera =
    filas
      .map((fila) => fila.urgencia)
      .filter((valor): valor is number => valor !== null)
      .sort((a, b) => b - a)[2] ?? 0;

  return filas.map((fila) => {
    if (fila.urgencia === null || fila.lado !== "defensivo" || fila.stats.goles <= 0) return fila;

    const suelo = Math.max(SUELO_GOL_EN_CONTRA, tercera);

    return fila.urgencia >= suelo ? fila : { ...fila, urgencia: suelo, subidaPorGoles: true };
  });
}

/**
 * Lo que hace daño en un aspecto, en «acciones con peligro».
 *
 * - **Defendiendo**: el peligro que nos han hecho, y cada gol cuenta dos veces
 *   más (un gol también es peligro, y es el que cuesta puntos).
 * - **Atacando**: el peligro que nos falta para rendir como su familia, por
 *   las veces que ocurre, más los goles que ya no hacemos de más. Un aspecto
 *   que ya rinde no tiene nada en juego por mucho que se repita.
 */
function danoDe(lado: AbpLado, stats: AspectoStats, peligroAjustado: number, referencia: number) {
  if (lado === "defensivo") return stats.peligro + 2 * stats.goles;

  return (stats.acciones * Math.max(0, referencia - peligroAjustado)) / 100;
}

/** La urgencia dicha en una línea, para el título de la cifra. */
export function formulaUrgencia(fila: FilaCruce) {
  const pct = (valor: number) => `${Math.round(valor * 100)}`;
  const partes = [
    `Daño ${pct(fila.ingredientes.dano)} × ${PESOS.dano * 100} %`,
    `peor que los suyos ${pct(fila.ingredientes.deficit)} × ${PESOS.deficit * 100} %`,
    `poco trabajado ${pct(fila.ingredientes.desatencion)} × ${PESOS.desatencion * 100} %`,
  ];

  const base = `Urgencia = ${partes.join(" + ")} (cada parte de 0 a 100).`;

  return fila.subidaPorGoles
    ? `${base} Sube a ${Math.round(fila.urgencia ?? 0)} porque nos han marcado ${fila.stats.goles === 1 ? "un gol" : `${fila.stats.goles} goles`} así.`
    : base;
}

/** Aspectos con datos, de más urgente a menos. */
export function ordenaPorUrgencia(filas: FilaCruce[]) {
  return filas
    .filter((fila) => fila.urgencia !== null)
    .sort((a, b) => (b.urgencia ?? 0) - (a.urgencia ?? 0));
}

/* ------------------------------------------------------------------ */
/*  LAS PRIORIDADES DEL INFORME                                        */
/* ------------------------------------------------------------------ */

/**
 * Pesos de las prioridades del informe (19/10/2026). Como `PESOS`, se declaran
 * aquí para poder discutirlos.
 */
export const PESOS_INFORME = {
  /** Lo que está en juego: acciones con peligro y goles (ver `enJuego`). */
  enJuego: 0.5,
  /** Cómo de mal nos va frente a su familia (el `deficit` de la urgencia). */
  deficit: 0.3,
  /** Cuán poco se ha trabajado en la temporada. */
  desatencion: 0.2,
};

/** Por debajo de esto, un aspecto no entra en las prioridades: es ruido. */
export const MINIMO_ACCIONES_PRIORIDAD = 5;

export type Prioridad = {
  fila: FilaCruce;
  /** 0-100, sólo para ordenar: no se enseña como «urgencia». */
  peso: number;
  /** Los saques de banda van aparte: no acaban en remate. */
  esBanda: boolean;
};

/**
 * Lo que está en juego en un aspecto, en «acciones con peligro».
 *
 * - **Defendiendo**: las acciones con peligro que nos han hecho, y cada gol
 *   cuenta otra vez (un gol también es peligro). Es el daño de verdad.
 * - **Atacando**: el peligro que nos falta para rendir como su familia,
 *   multiplicado por las veces que ocurre. Un aspecto que ya rinde no tiene
 *   nada en juego por mucho que se repita.
 */
function enJuego(fila: FilaCruce) {
  if (fila.lado === "defensivo") return fila.stats.peligro + fila.stats.goles;

  const falta = Math.max(0, fila.referencia - fila.peligroAjustado) / 100;

  return fila.stats.acciones * falta;
}

/**
 * LAS PRIORIDADES DEL INFORME DE ABP (19/10/2026, crítica de los expertos).
 *
 * La urgencia de la pantalla premia el volumen, y las cinco primeras eran
 * siempre saques de banda (149-156 acciones, 0 remates, 2-7 % de peligro)
 * mientras el córner directo defensivo —15 % de peligro y 2 goles en contra—
 * no salía. Aquí se repesa con lo que de verdad hace daño (`enJuego`: acciones
 * con peligro y goles), se deja fuera lo que tiene menos de
 * `MINIMO_ACCIONES_PRIORIDAD` acciones y **los saques de banda van aparte**:
 * como mucho `banda` de ellos, detrás del balón parado que acaba en remate
 * (córner, falta, penalti).
 *
 * La urgencia de siempre no se toca: la sigue usando la pantalla y el boceto.
 */
export function prioridadesAbp(
  filas: FilaCruce[],
  opciones: {
    conRemate?: number;
    banda?: number;
    /**
     * Cuánto pesa el rival de la semana en cada aspecto (20/10/2026): un factor
     * alrededor de 1 —más si el rival ataca bien lo que defendemos o concede lo
     * que atacamos— que multiplica el peso. Sin él, manda nuestro histórico.
     */
    rival?: (fila: FilaCruce) => number | null;
  } = {},
): Prioridad[] {
  const conRemate = opciones.conRemate ?? 4;
  const banda = opciones.banda ?? 1;

  const candidatas = filas.filter(
    (fila) => fila.aspecto.reconocimiento && fila.urgencia !== null && fila.stats.acciones >= MINIMO_ACCIONES_PRIORIDAD,
  );

  const maximo = Math.max(1e-9, ...candidatas.map(enJuego));

  const pesadas = candidatas
    .map((fila) => ({
      fila,
      esBanda: fila.aspecto.grupo === "banda",
      peso:
        100 *
        (PESOS_INFORME.enJuego * (enJuego(fila) / maximo) +
          PESOS_INFORME.deficit * fila.ingredientes.deficit +
          PESOS_INFORME.desatencion * fila.ingredientes.desatencion) *
        (opciones.rival?.(fila) ?? 1),
    }))
    .sort((a, b) => b.peso - a.peso);

  return [
    ...pesadas.filter((una) => !una.esBanda).slice(0, conRemate),
    ...pesadas.filter((una) => una.esBanda).slice(0, banda),
  ];
}

/** Color del semáforo de urgencia. */
export function colorUrgencia(urgencia: number) {
  if (urgencia >= 65) return "#F87171";
  if (urgencia >= 45) return "#FBBF24";

  return "#34D399";
}

export function etiquetaUrgencia(urgencia: number) {
  if (urgencia >= 65) return "Alta";
  if (urgencia >= 45) return "Media";

  return "Baja";
}
