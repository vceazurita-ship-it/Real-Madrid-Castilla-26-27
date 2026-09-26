/**
 * EL INFORME DE BALÓN PARADO DE UN MICROCICLO.
 *
 * Reúne en una hoja lo que hasta ahora había que ir a buscar a cuatro sitios:
 * qué se trabajó de ABP esa semana, cómo se valoró, a qué jugadores se les hizo
 * seguimiento de balón parado y qué dice el dato del equipo. Se manda por
 * correo desde la cuenta del club (`lib/correo/gmail.ts`) y **se puede mirar en
 * pantalla sin mandarlo**, que es lo que se hace casi siempre.
 *
 * Tres decisiones que explican cómo está hecho:
 *
 * 1. **Aquí no se baja nada.** Todo llega ya cargado desde la pantalla del
 *    microciclo, que es donde ya están el plan, la hoja de registro, las hojas
 *    de competición y el seguimiento. Volver a pedirlos en el servidor sería
 *    pagar otra vez una espera que en frío pasa de medio minuto.
 * 2. **Primero un modelo, después el papel.** `construyeInforme` decide qué se
 *    cuenta; `informeHtml` e `informeTexto` sólo lo escriben. Así la vista
 *    previa de la pantalla y el correo no pueden decir cosas distintas.
 * 3. **Lo estimado se dice.** El seguimiento individual no tiene casilla de
 *    ABP: se reconoce por lo que está escrito en los objetivos y el feedback
 *    (`textoEsAbp`). El informe lo avisa donde se lee, no en una nota al pie.
 *
 * El correo se escribe con tablas y estilos en línea a posta: Gmail y Outlook
 * tiran las hojas de estilo, y un informe que llega sin formato no lo lee
 * nadie.
 */

import {
  ASPECTOS,
  DIAS,
  LADO_LABEL,
  MEDIO_LABEL,
  MOMENTO_LABEL,
  ROL_LABEL,
  cargaCognitiva,
  cargaCondicional,
  cargaEsReal,
  fmtMin,
  normalizaTrabajo,
  type AbpLado,
  type DiaKey,
  type OrigenDias,
  type TotalesPlan,
  type Trabajo,
} from "./microciclo";

import { hayEvaluacion, textoEsAbp, type RegistroTarea } from "./registro";

import type { FilaCruce } from "./transferencia";

import type {
  AreaGrafico,
  ComparativaAbp,
  GraficoInforme,
  PropioAbp,
  SeguimientoResumen,
  TareaValorada,
  TiempoSemana,
} from "./informe-graficos";

/* ------------------------------------------------------------------ */
/*  LO QUE RECIBE                                                      */
/* ------------------------------------------------------------------ */

/** Una fila del seguimiento individual, como la manda la hoja. */
export type SeguimientoFila = {
  ID_JUGADOR?: string;
  NOMBRE?: string;
  FECHA?: string;
  OBJETIVO_OFENSIVO?: string;
  OBJETIVO_DEFENSIVO?: string;
  OBJETIVO_MENTAL?: string;
  FEEDBACK?: string;
  QUIEN?: string;
  MODALIDAD?: string;
  MOMENTO?: string;
  ESTRATEGIA?: string;
};

export type DatosInforme = {
  temporada: string;
  micro: number;
  rival: string;
  /** El partido con el que se mide la semana, si se ha podido cruzar. */
  partido: { jornada: string; rival: string } | null;
  /**
   * Los días DE ESTE microciclo, en su orden, tal y como los da la ventana.
   *
   * Hace falta porque el reparto por día se dibujaba sobre las siete letras de
   * la semana natural, de lunes a domingo, y un microciclo no es eso: el del
   * Sant Andreu va de domingo a miércoles. Salían cuatro columnas vacías de
   * días que no existen en esa semana, y el día de partido no se distinguía de
   * uno de descanso.
   */
  dias?: { clave: DiaKey; etiqueta: string; tipo: "entreno" | "descanso" | "partido" }[];
  /**
   * De qué partido viene la semana.
   *
   * El microciclo va de partido a partido, así que el informe tiene que decir
   * los dos: con uno solo no se sabe si la semana fue de siete días o de tres,
   * y el objetivo de minutos se lee contra eso.
   */
  partidoAnterior?: { rival: string; cuando: string } | null;
  /** Los trabajos planificados, día a día. */
  entradas: { dia: DiaKey; trabajo: Trabajo }[];
  totales: TotalesPlan;
  /** Las tareas de ABP de ese microciclo en la hoja de registro. */
  tareas: RegistroTarea[];
  /** El seguimiento individual entero: aquí se filtra por fecha y por ABP. */
  seguimientos: SeguimientoFila[];
  /** Para poner nombre a un `ID_JUGADOR`. */
  nombrePorId?: Map<string, string>;
  /** El cruce de la temporada, aspecto por aspecto. */
  filas: FilaCruce[];
  /** Las cinco urgencias de arriba, ya ordenadas. */
  prioridades: FilaCruce[];
  /**
   * Con quién nos comparamos: la categoría de este año y nosotros mismos en las
   * temporadas anteriores, a estas alturas. Sale de
   * `/api/data-analisis?abpInforme=1`; sin ella el informe se monta igual, sólo
   * que sin la parte de comparación.
   */
  comparativa?: ComparativaAbp | null;
  /**
   * Nuestro balón parado tal y como lo registran nuestras cuatro hojas.
   *
   * Es la única fuente donde los **goles de balón parado son un dato**: el
   * analista escribe el resultado de cada acción. De la liga nadie publica de
   * qué jugada nace cada gol, así que ahí sólo se comparan cosas medidas.
   */
  propio?: PropioAbp | null;
  /** Los gráficos ya dibujados (`lib/abp/informe-graficos.ts`). */
  graficos?: GraficoInforme[];
  /**
   * Días de entrenamiento de la semana.
   *
   * Con ellos se prorratea el objetivo de minutos de ABP: el cuerpo técnico
   * quiere **90-100 minutos en una semana de seis entrenamientos**, así que una
   * de cuatro pide su parte, no los noventa enteros.
   */
  diasEntreno?: number;
  /**
   * De dónde sale ese número de días.
   *
   * Sin esto el informe no puede distinguir «se entrenaron cuatro días» de «no
   * se sabe cuántos días se entrenó», y son cosas muy distintas para juzgar si
   * la semana se quedó corta. Lo calcula `diasDeLaSemana`.
   */
  origenDias?: OrigenDias;
  /** Minutos del microciclo por `aspecto|lado`, para el reparto. */
  minutosPorAspecto?: { clave: string; minutos: number }[];
  /** Para poder fijar la fecha en las pruebas. */
  generado?: Date;
};

/** El objetivo de minutos de ABP de una semana, según lo que se entrene. */
export const OBJETIVO_ABP = {
  /** La referencia del cuerpo técnico: 90-100 minutos en seis días. */
  minimo: 90,
  maximo: 100,
  dias: 6,
} as const;

export type ObjetivoSemana = {
  diasEntreno: number;
  minimo: number;
  maximo: number;
  hechos: number;
  /** Cuánto falta para el mínimo, o 0 si ya se llegó. */
  faltan: number;
  /** 0..1 contra el mínimo, para poder pintarlo. */
  cumplido: number;
  veredicto: "corto" | "dentro" | "pasado";
  /** De dónde sale el número de días, para poder decirlo. */
  origen: OrigenDias;
};

/**
 * El objetivo de la semana, prorrateado por los días que se entrena.
 *
 * Sin prorratear, una semana de cuatro entrenamientos sale siempre en rojo
 * aunque se haya trabajado exactamente lo que tocaba.
 *
 * **El número de días tiene que venir de `diasDeLaSemana`**, que distingue los
 * días marcados de un plan que nadie ha tocado. Pasar aquí el recuento crudo de
 * días con `tipo === "entreno"` es lo que tuvo roto esto: como todo día nace
 * «entreno», salían siete, el tope los dejaba en seis y el objetivo era
 * 90-100′ **siempre**, en todas las semanas. El prorrateo no llegaba a
 * activarse nunca.
 */
export function objetivoDeLaSemana(
  minutos: number,
  diasEntreno: number,
  origen: OrigenDias = "marcados",
): ObjetivoSemana {
  /*
  | El tope son seis, aunque la semana tenga siete días marcados.
  |
  | La referencia del cuerpo técnico es «90-100 minutos en una semana de seis
  | entrenamientos»: eso es el objetivo de una semana completa, no una regla de
  | tres sin fin. Sin este tope, un plan con los siete días puestos pedía
  | 105-117 minutos y dejaba en rojo una semana de 89′ que está justo en su
  | sitio. Hacia abajo sí se prorratea, que es para lo que se hizo.
  */
  const dias = Math.min(OBJETIVO_ABP.dias, Math.max(0, diasEntreno));

  const parte = dias / OBJETIVO_ABP.dias;

  const minimo = Math.round(OBJETIVO_ABP.minimo * parte);
  const maximo = Math.round(OBJETIVO_ABP.maximo * parte);

  return {
    diasEntreno: dias,
    minimo,
    maximo,
    hechos: minutos,
    faltan: Math.max(0, minimo - minutos),
    cumplido: minimo > 0 ? Math.min(1.4, minutos / minimo) : 0,
    veredicto: minutos < minimo ? "corto" : minutos > maximo ? "pasado" : "dentro",
    origen,
  };
}

/** Cómo se explica en el informe de dónde salen los días contados. */
export function explicaDias(objetivo: ObjetivoSemana) {
  const dias = `${objetivo.diasEntreno} día${objetivo.diasEntreno === 1 ? "" : "s"}`;

  if (objetivo.origen === "a mano") {
    return `${dias} de entrenamiento, según lo anotado en el microciclo.`;
  }

  if (objetivo.origen === "marcados") {
    return `${dias} de entrenamiento, según los días marcados en el plan.`;
  }

  return (
    `${dias} con trabajo de balón parado. En el plan no hay ningún día marcado ` +
    "como descanso ni como partido, así que no se puede saber cuántos días se " +
    "entrenó: se cuentan los que tienen trabajo. Marcando los descansos —o " +
    "escribiendo los días entrenados— el objetivo sale exacto."
  );
}

/* ------------------------------------------------------------------ */
/*  FECHAS                                                             */
/* ------------------------------------------------------------------ */

/**
 * La fecha de una fila del registro, que viene como la escribió la hoja.
 *
 * Se aceptan «12/09/2026» y «2026-09-12». Lo que no se entienda no se usa: una
 * fecha inventada movería el rango de la semana y con él los seguimientos que
 * entran en el informe.
 */
export function leeFecha(valor: string | undefined): Date | null {
  const texto = String(valor ?? "").trim();

  if (!texto) return null;

  const conBarras = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (conBarras) {
    const fecha = new Date(
      Number(conBarras[3]),
      Number(conBarras[2]) - 1,
      Number(conBarras[1]),
    );

    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    const fecha = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  return null;
}

/**
 * La fecha de la hoja, escrita para leerla.
 *
 * La hoja de seguimiento guarda marcas de tiempo enteras
 * —`2026-09-22T07:00:00.000Z`— y eso se colaba tal cual en las tablas del
 * informe, que es un correo que se lee de un vistazo: una columna de
 * veinticuatro caracteres de los que sólo importan diez.
 *
 * Lo que no se entienda se deja como está: perder el dato por no saber
 * formatearlo es peor que enseñarlo feo.
 */
export function fechaCorta(valor: string | undefined): string {
  const fecha = leeFecha(valor);

  return fecha ? diaMes(fecha) : String(valor ?? "").trim();
}

function diaMes(fecha: Date) {
  return fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  EL MODELO                                                          */
/* ------------------------------------------------------------------ */

export type LineaTrabajo = {
  dia: string;
  aspectos: string;
  lados: string;
  momento: string;
  medio: string;
  roles: string;
  minutos: string;
  carga: number;
  cargaCog: number;
  /** La carga viene medida de la hoja, no estimada. */
  medida: boolean;
  notas: string;
};

export type LineaValoracion = {
  tarea: string;
  dia: string;
  fecha: string;
  evaluacion: number;
  analisis: string;
  observaciones: string;
};

export type LineaSeguimiento = {
  jugador: string;
  fecha: string;
  quien: string;
  modalidad: string;
  momento: string;
  estrategia: string;
  objetivo: string;
  feedback: string;
};

export type LineaEquipo = {
  aspecto: string;
  lado: AbpLado;
  acciones: number;
  remates: number;
  goles: number;
  peligro: string;
  minutosTemporada: string;
  urgencia: number | null;
  transferencia: number | null;
};

export type InformeMicro = {
  asunto: string;
  titulo: string;
  subtitulo: string;
  generado: string;
  rango: string;
  partido: string;
  resumen: { rotulo: string; valor: string; pie: string }[];
  trabajos: LineaTrabajo[];
  valoracion: {
    lineas: LineaValoracion[];
    valoradas: number;
    total: number;
    media: number | null;
  };
  seguimiento: {
    lineas: LineaSeguimiento[];
    jugadores: number;
  };
  equipo: LineaEquipo[];
  prioridades: LineaEquipo[];
  /** El tiempo de la semana: objetivo prorrateado y cómo se reparte. */
  tiempo: TiempoSemana;
  objetivo: ObjetivoSemana;
  /** Las tareas valoradas, para pintarlas. */
  tareasValoradas: TareaValorada[];
  /** El seguimiento de ABP, agrupado. */
  seguimientoResumen: SeguimientoResumen;
  /** Cómo estamos contra la categoría y contra nosotros mismos. */
  comparativa: ComparativaInforme | null;
  /** Nuestro balón parado registrado acción por acción, con sus goles. */
  propio: PropioAbp | null;
  /** Los gráficos, en el orden en que van en el correo. */
  graficos: GraficoInforme[];
  /** Lo que el informe no sabe, dicho donde se lee. */
  avisos: string[];
};

/**
 * Una métrica medida, con lo nuestro, la mediana de la liga y el puesto.
 *
 * **No hay goles aquí, y es a propósito.** De la liga nadie publica de qué
 * jugada nace cada gol: Wyscout da remates por vía y penaltis marcados. Lo que
 * se compara es lo que se mide.
 */
export type FilaComparativa = {
  key: string;
  rotulo: string;
  sentido: "alto" | "neutro";
  /** Lo nuestro a favor y dónde queda en la categoría. */
  favor: number | null;
  medianaFavor: number;
  puestoFavor: number | null;
  /** Lo que nos hacen, y el puesto con el mejor primero (menos, mejor). */
  contra: number | null;
  medianaContra: number;
  puestoContra: number | null;
};

export type ComparativaInforme = {
  temporada: string;
  jugados: number;
  equipos: number;
  filas: FilaComparativa[];
  temporadas: {
    temporada: string;
    esActual: boolean;
    valores: Record<string, { favor: number | null; contra: number | null }>;
  }[];
};

const ASPECTO_LABEL = new Map(ASPECTOS.map((uno) => [uno.key, uno.label]));

const DIA_LABEL = new Map(DIAS.map((uno) => [uno.key, uno.label]));

function listaAspectos(trabajo: Trabajo) {
  return trabajo.aspectos
    .map((clave) => ASPECTO_LABEL.get(clave) ?? clave)
    .join(", ");
}

function filaEquipo(fila: FilaCruce): LineaEquipo {
  return {
    aspecto: fila.aspecto.label,
    lado: fila.lado,
    acciones: fila.stats.acciones,
    remates: fila.stats.remates,
    goles: fila.stats.goles,
    peligro: fila.stats.acciones ? `${fila.stats.peligroPct.toFixed(1)} %` : "—",
    minutosTemporada: fmtMin(fila.minutosTemporada),
    urgencia: fila.urgencia,
    transferencia: fila.transferencia?.delta ?? null,
  };
}

/**
 * Reúne el informe.
 *
 * Nada de lo que hay aquí pide datos: lo que no llegue, no sale, y se dice en
 * `avisos` para que quien lo lea sepa que falta y no que no ha pasado.
 */
export function construyeInforme(datos: DatosInforme): InformeMicro {
  const generado = datos.generado ?? new Date();

  const avisos: string[] = [];

  /* ---------------- la semana, día a día ---------------- */

  const trabajos: LineaTrabajo[] = datos.entradas.map(({ dia, trabajo }) => {
    const limpio = normalizaTrabajo(trabajo);

    return {
      dia: DIA_LABEL.get(dia) ?? dia,
      aspectos: listaAspectos(limpio),
      lados: limpio.lados.map((lado) => LADO_LABEL[lado]).join(" + "),
      momento: MOMENTO_LABEL[limpio.momento],
      medio: MEDIO_LABEL[limpio.medio],
      roles: limpio.roles.map((rol) => ROL_LABEL[rol]).join(", ") || "—",
      minutos: fmtMin(limpio.minutos),
      carga: Math.round(cargaCondicional(limpio)),
      cargaCog: Math.round(cargaCognitiva(limpio)),
      medida: cargaEsReal(limpio),
      notas: String(limpio.notas ?? "").trim(),
    };
  });

  if (trabajos.length === 0) {
    avisos.push(
      "Este microciclo no tiene ningún trabajo de balón parado planificado.",
    );
  }

  /* ---------------- el rango de fechas ---------------- */

  const fechas = datos.tareas
    .map((tarea) => leeFecha(tarea.fecha))
    .filter((fecha): fecha is Date => fecha !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const desde = fechas[0] ?? null;
  const hasta = fechas[fechas.length - 1] ?? null;

  const rango =
    desde && hasta
      ? desde.getTime() === hasta.getTime()
        ? diaMes(desde)
        : `${diaMes(desde)} — ${diaMes(hasta)}`
      : "";

  if (!rango) {
    avisos.push(
      "La hoja de registro no trae fechas de este microciclo, así que el seguimiento de abajo es el de toda la temporada, no el de esta semana.",
    );
  }

  /* ---------------- la valoración registrada ---------------- */

  const valoradas = datos.tareas.filter(hayEvaluacion);

  const conNota = valoradas.filter((tarea) => tarea.evaluacion > 0);

  const media = conNota.length
    ? conNota.reduce((suma, tarea) => suma + tarea.evaluacion, 0) /
      conNota.length
    : null;

  const lineasValoracion: LineaValoracion[] = valoradas.map((tarea) => ({
    tarea: tarea.tarea,
    dia: DIA_LABEL.get(tarea.dia as DiaKey) ?? tarea.dia ?? "",
    fecha: fechaCorta(tarea.fecha),
    evaluacion: tarea.evaluacion,
    analisis: tarea.analisisPost,
    observaciones: tarea.observaciones,
  }));

  if (datos.tareas.length > 0 && valoradas.length === 0) {
    avisos.push(
      "Ninguna tarea de ABP de este microciclo está valorada en la hoja de registro.",
    );
  }

  /* ---------------- quién ha llevado seguimiento de ABP ---------------- */

  /*
  | El seguimiento no tiene casilla de «esto es ABP»: se reconoce por lo que
  | está escrito en los objetivos y en el feedback. Es una estimación, y por
  | eso se dice en el propio título de la sección.
  */
  const dentroDelRango = (fecha: Date | null) => {
    if (!desde || !hasta) return true;
    if (!fecha) return false;

    /* El día de cierre entero, no hasta las 00:00. */
    return (
      fecha.getTime() >= desde.getTime() &&
      fecha.getTime() <= hasta.getTime() + 86_399_000
    );
  };

  const deAbp = datos.seguimientos.filter((fila) => {
    if (
      !textoEsAbp(
        fila.OBJETIVO_OFENSIVO,
        fila.OBJETIVO_DEFENSIVO,
        fila.OBJETIVO_MENTAL,
        fila.FEEDBACK,
      )
    ) {
      return false;
    }

    return dentroDelRango(leeFecha(fila.FECHA));
  });

  const lineasSeguimiento: LineaSeguimiento[] = deAbp
    .map((fila) => ({
      jugador:
        datos.nombrePorId?.get(String(fila.ID_JUGADOR ?? "")) ??
        String(fila.NOMBRE ?? fila.ID_JUGADOR ?? "—"),
      fecha: fechaCorta(fila.FECHA),
      quien: fila.QUIEN ?? "",
      modalidad: fila.MODALIDAD ?? "",
      momento: fila.MOMENTO ?? "",
      estrategia: fila.ESTRATEGIA ?? "",
      objetivo: [fila.OBJETIVO_OFENSIVO, fila.OBJETIVO_DEFENSIVO]
        .map((uno) => String(uno ?? "").trim())
        .filter(Boolean)
        .join(" · "),
      feedback: String(fila.FEEDBACK ?? "").trim(),
    }))
    .sort((a, b) => a.jugador.localeCompare(b.jugador, "es"));

  const jugadores = new Set(lineasSeguimiento.map((linea) => linea.jugador)).size;

  if (lineasSeguimiento.length === 0) {
    avisos.push(
      "No hay ningún seguimiento individual que hable de balón parado en estas fechas.",
    );
  }

  /* ---------------- el dato del equipo ---------------- */

  const conMuestra = datos.filas
    .filter((fila) => fila.stats.acciones > 0 || fila.minutosTemporada > 0)
    .sort((a, b) => b.stats.acciones - a.stats.acciones);

  const equipo = conMuestra.map(filaEquipo);

  if (equipo.length === 0) {
    avisos.push(
      "Todavía no hay acciones de balón parado registradas en las hojas de competición.",
    );
  }

  /* ---------------- la cabecera ---------------- */

  const totales = datos.totales;

  const resumen = [
    {
      rotulo: "Minutos de ABP",
      valor: fmtMin(totales.minutos),
      pie: `${totales.trabajos} trabajo${totales.trabajos === 1 ? "" : "s"} en ${totales.diasConAbp} día${totales.diasConAbp === 1 ? "" : "s"}`,
    },
    {
      rotulo: "Ofensivo / defensivo",
      valor: `${fmtMin(totales.porLado.ofensivo)} · ${fmtMin(totales.porLado.defensivo)}`,
      pie: "Reparto por lado",
    },
    {
      rotulo: "Campo / vídeo",
      valor: `${fmtMin(totales.minutosCampo)} · ${fmtMin(totales.minutosVideo)}`,
      pie: "Dónde se trabajó",
    },
    {
      rotulo: "Carga",
      valor: String(Math.round(totales.carga)),
      pie: `Cognitiva ${Math.round(totales.cargaCog)}`,
    },
    {
      rotulo: "Tareas valoradas",
      valor: `${valoradas.length} de ${datos.tareas.length}`,
      pie: media === null ? "Sin nota media" : `Media ${media.toFixed(1)}`,
    },
    {
      rotulo: "Seguimiento de ABP",
      valor: String(lineasSeguimiento.length),
      pie: `${jugadores} jugador${jugadores === 1 ? "" : "es"}`,
    },
  ];

  /* ---------------- contra la liga y contra nosotros mismos ---------------- */

  const mediana = (valores: number[]) => {
    if (valores.length === 0) return 0;

    const orden = [...valores].sort((a, b) => a - b);
    const medio = Math.floor(orden.length / 2);

    return orden.length % 2
      ? orden[medio]
      : (orden[medio - 1] + orden[medio]) / 2;
  };

  /** El puesto de un valor dentro de la categoría, con su sentido. */
  const puestoDe = (
    valor: number | null,
    todos: number[],
    menosEsMejor: boolean,
  ) => {
    if (valor === null || todos.length === 0) return null;

    const orden = [...todos].sort((a, b) => (menosEsMejor ? a - b : b - a));

    const sitio = orden.findIndex((uno) => Math.abs(uno - valor) < 1e-9);

    return sitio < 0 ? null : sitio + 1;
  };

  const comparativa: ComparativaInforme | null = datos.comparativa?.liga.length
    ? (() => {
        const { liga, nosotros, historico, medidas } = datos.comparativa!;

        const filas: FilaComparativa[] = (medidas ?? []).map((medida) => {
          const favores = liga
            .map((fila) => fila.valores?.[medida.key]?.favor)
            .filter((uno): uno is number => typeof uno === "number");

          const contras = liga
            .map((fila) => fila.valores?.[medida.key]?.contra)
            .filter((uno): uno is number => typeof uno === "number");

          const favor = nosotros?.valores?.[medida.key]?.favor ?? null;
          const contra = nosotros?.valores?.[medida.key]?.contra ?? null;

          return {
            key: medida.key,
            rotulo: medida.rotulo,
            sentido: medida.sentido,
            favor,
            medianaFavor: mediana(favores),
            puestoFavor: puestoDe(favor, favores, false),
            contra,
            medianaContra: mediana(contras),
            /* Lo que nos hacen: el primero es el que menos concede. */
            puestoContra: puestoDe(contra, contras, true),
          };
        });

        return {
          temporada: datos.comparativa!.temporada,
          jugados: datos.comparativa!.jugados,
          equipos: liga.length,
          filas,
          temporadas: historico.map((una) => ({
            temporada: una.temporada,
            esActual: una.esActual,
            valores: una.valores,
          })),
        };
      })()
    : null;

  if (!comparativa) {
    avisos.push(
      "No se ha podido comparar con la categoría: falta el informe de Wyscout de esta temporada.",
    );
  }

  const propio = datos.propio ?? null;

  if (!propio || propio.acciones === 0) {
    avisos.push(
      "No hay acciones de balón parado registradas en nuestras hojas, así que el informe no puede decir cuántos goles de estrategia llevamos.",
    );
  }

  /* ---------------- el tiempo de la semana ---------------- */

  const objetivo = objetivoDeLaSemana(
    totales.minutos,
    datos.diasEntreno ?? 0,
    datos.origenDias ?? "marcados",
  );

  /*
  | El reparto por día sale de las entradas, no del plan: lo que importa aquí
  | es dónde cayeron los minutos de ABP, y un día de partido puede llevarlos.
  */
  const minutosDelDia = new Map<DiaKey, number>();

  datos.entradas.forEach(({ dia, trabajo }) => {
    minutosDelDia.set(dia, (minutosDelDia.get(dia) ?? 0) + (trabajo.minutos || 0));
  });

  /*
  | Sólo los días que existen en ESTE microciclo, y el partido marcado.
  |
  | Antes se recorría `DIAS` —las siete letras de la semana natural— y eso
  | pintaba columnas de días que no son de esta semana. Ahora manda la ventana:
  | los días de entrenamiento y el del partido, en su orden. El descanso se
  | queda fuera: no aporta nada a un gráfico de minutos y roba sitio.
  |
  | Sin ventana —un informe viejo, o la consola— se hace lo de antes, para no
  | dejar el gráfico vacío.
  */
  const deLaVentana = (datos.dias ?? []).filter(
    (dia) => dia.tipo === "entreno" || dia.tipo === "partido",
  );

  const porDia =
    deLaVentana.length > 0
      ? deLaVentana.map((dia) => ({
          etiqueta: dia.etiqueta,
          minutos: minutosDelDia.get(dia.clave) ?? 0,
          esEntreno: dia.tipo === "entreno",
          esPartido: dia.tipo === "partido",
        }))
      : DIAS.map((dia) => ({
          etiqueta: dia.corto,
          minutos: minutosDelDia.get(dia.key) ?? 0,
          esEntreno: (minutosDelDia.get(dia.key) ?? 0) > 0,
          esPartido: false,
        }));

  /* El reparto por aspecto llega en `aspecto|lado`: se junta por aspecto. */
  const porAspectoMapa = new Map<string, { ofensivo: number; defensivo: number }>();

  (datos.minutosPorAspecto ?? []).forEach(({ clave, minutos }) => {
    const [aspecto, lado] = clave.split("|");

    const fila = porAspectoMapa.get(aspecto) ?? { ofensivo: 0, defensivo: 0 };

    if (lado === "defensivo") fila.defensivo += minutos;
    else fila.ofensivo += minutos;

    porAspectoMapa.set(aspecto, fila);
  });

  const tiempo: TiempoSemana = {
    minutos: totales.minutos,
    minimo: objetivo.minimo,
    maximo: objetivo.maximo,
    diasEntreno: objetivo.diasEntreno,
    origenDias: objetivo.origen,
    veredicto: objetivo.veredicto,
    porDia,
    porAspecto: [...porAspectoMapa.entries()]
      .map(([aspecto, valores]) => ({
        etiqueta: ASPECTO_LABEL.get(aspecto as never) ?? aspecto,
        ...valores,
      }))
      .sort((a, b) => b.ofensivo + b.defensivo - (a.ofensivo + a.defensivo)),
    porMedio: { campo: totales.minutosCampo, video: totales.minutosVideo },
    porMomento: totales.porMomento,
    porRol: totales.porRol,
  };

  /* ---------------- lo que se pinta de valoración y seguimiento ---------- */

  const tareasValoradas: TareaValorada[] = valoradas
    .filter((tarea) => tarea.evaluacion > 0)
    .map((tarea) => ({
      tarea: tarea.tarea,
      /* «M-T4» no dice nada; lo que se reconoce es el contenido. */
      contenido: tarea.contenidoSecundario || tarea.contenidoPrincipal || "",
      dia: DIA_LABEL.get(tarea.dia as DiaKey)?.slice(0, 3) ?? tarea.dia ?? "",
      nota: tarea.evaluacion,
      minutos: tarea.tiempo,
    }));

  const cuentaPor = (lista: string[]) => {
    const mapa = new Map<string, number>();

    lista.forEach((uno) => mapa.set(uno, (mapa.get(uno) ?? 0) + 1));

    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  };

  const seguimientoResumen: SeguimientoResumen = {
    porJugador: cuentaPor(lineasSeguimiento.map((una) => una.jugador)).map(
      ([jugador, registros]) => ({ jugador, registros }),
    ),
    porQuien: cuentaPor(lineasSeguimiento.map((una) => una.quien)).map(
      ([quien, registros]) => ({ quien, registros }),
    ),
    total: lineasSeguimiento.length,
    jugadores,
  };

  const titulo = `Balón parado · Microciclo ${datos.micro}`;

  const subtitulo = [datos.rival && `Contra ${datos.rival}`, datos.temporada]
    .filter(Boolean)
    .join(" · ");

  return {
    asunto: `[RMCF Castilla] ABP · Microciclo ${datos.micro}${datos.rival ? ` · ${datos.rival}` : ""}`,
    titulo,
    subtitulo,
    generado: generado.toLocaleString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    rango,
    partido: [
      datos.partidoAnterior
        ? `Viene del partido contra ${datos.partidoAnterior.rival} (${datos.partidoAnterior.cuando})`
        : "",
      datos.partido
        ? `Se mide contra ${datos.partido.jornada} · ${datos.partido.rival}`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
    resumen,
    trabajos,
    valoracion: {
      lineas: lineasValoracion,
      valoradas: valoradas.length,
      total: datos.tareas.length,
      media,
    },
    seguimiento: { lineas: lineasSeguimiento, jugadores },
    equipo,
    prioridades: datos.prioridades.map(filaEquipo),
    tiempo,
    objetivo,
    tareasValoradas,
    seguimientoResumen,
    comparativa,
    propio,
    graficos: datos.graficos ?? [],
    avisos,
  };
}

/* ------------------------------------------------------------------ */
/*  EL PAPEL                                                           */
/* ------------------------------------------------------------------ */

const ORO = "#C8A96B";
const NAVY = "#0F1E3D";
const CREMA = "#F7F4EC";
const TINTA = "#1F2937";
const SUAVE = "#6B7280";

function esc(valor: unknown) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tabla(cabeceras: string[], filas: string[][]) {
  if (filas.length === 0) return "";

  const th = cabeceras
    .map(
      (una) =>
        `<th align="left" style="padding:8px 10px;border-bottom:2px solid ${ORO};font:600 11px/1.3 Arial,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:${NAVY}">${esc(una)}</th>`,
    )
    .join("");

  const tr = filas
    .map(
      (fila, indice) =>
        `<tr style="background:${indice % 2 ? "#FFFFFF" : CREMA}">${fila
          .map(
            (celda) =>
              `<td style="padding:8px 10px;border-bottom:1px solid #E5E1D6;font:400 13px/1.45 Arial,sans-serif;color:${TINTA};vertical-align:top">${celda}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function seccion(titulo: string, pie: string, cuerpo: string) {
  if (!cuerpo) return "";

  return `<tr><td style="padding:22px 24px 4px"><h2 style="margin:0;font:700 15px/1.3 Arial,sans-serif;color:${NAVY};text-transform:uppercase;letter-spacing:.08em">${esc(titulo)}</h2>${
    pie
      ? `<p style="margin:4px 0 12px;font:400 12px/1.5 Arial,sans-serif;color:${SUAVE}">${esc(pie)}</p>`
      : `<div style="height:12px"></div>`
  }${cuerpo}</td></tr>`;
}

/** Dos decimales con coma, que es como se leen aquí. */
function fmtDec(valor: number) {
  return valor.toFixed(2).replace(".", ",");
}

/**
 * Cada métrica con su forma: los porcentajes con su signo.
 *
 * Se decide por la clave y no por el rótulo: el rótulo lo escribe el catálogo
 * del servidor y puede cambiar sin avisar.
 */
function fmtMedida(valor: number | null, key: string) {
  if (valor === null || !Number.isFinite(valor)) return "—";

  const esPorcentaje = /Remate$/.test(key) || key === "cuotaRematesAbp";

  return esPorcentaje
    ? `${valor.toFixed(1).replace(".", ",")} %`
    : valor.toFixed(key === "penaltis" ? 2 : 1).replace(".", ",");
}

function numeroConSigno(valor: number | null, sufijo = "") {
  if (valor === null || !Number.isFinite(valor)) return "—";

  const signo = valor > 0 ? "+" : "";

  return `${signo}${valor.toFixed(1)}${sufijo}`;
}

/**
 * Cómo se enseña una imagen según dónde se vea.
 *
 * En la vista previa de la app vale el `data:` de siempre. En el correo **no**:
 * Gmail quita esas imágenes, así que allí van como partes aparte y el HTML las
 * llama por su `cid` (ver `lib/correo/gmail.ts`).
 */
export type ModoImagenes = "data" | "cid";

/**
 * Los gráficos de un área, cada uno con su leyenda debajo.
 *
 * La leyenda no es un adorno: un gráfico que hay que explicar de viva voz no
 * sirve en un correo que se abre en el móvil de camino al campo.
 */
function bloqueGraficos(
  informe: InformeMicro,
  modo: ModoImagenes,
  area: AreaGrafico,
) {
  const suyos = informe.graficos.filter((grafico) => grafico.area === area);

  if (suyos.length === 0) return "";

  return suyos
    .map(
      (grafico) =>
        `<p style="margin:0 0 4px;font:600 11px/1.3 Arial,sans-serif;color:${NAVY};text-transform:uppercase;letter-spacing:.08em">${esc(grafico.titulo)}</p><img src="${
          modo === "cid" ? `cid:${esc(grafico.cid)}` : grafico.imagen
        }" alt="${esc(grafico.titulo)}" width="${grafico.ancho}" style="display:block;width:100%;max-width:${grafico.ancho}px;height:auto;border:1px solid #E5E1D6;border-radius:8px;margin:0 0 6px"><p style="margin:0 0 20px;font:400 12px/1.55 Arial,sans-serif;color:${SUAVE}">${esc(grafico.leyenda)}</p>`,
    )
    .join("");
}

/** El informe como correo: tablas y estilos en línea, que es lo que sobrevive. */
export function informeHtml(
  informe: InformeMicro,
  opciones: { imagenes?: ModoImagenes } = {},
) {
  const modoImagenes = opciones.imagenes ?? "data";
  const resumen = informe.resumen
    .map(
      (dato) =>
        `<td style="padding:10px 12px;background:${CREMA};border:1px solid #E5E1D6;border-radius:8px;width:33%"><p style="margin:0;font:600 10px/1.3 Arial,sans-serif;color:${SUAVE};text-transform:uppercase;letter-spacing:.08em">${esc(dato.rotulo)}</p><p style="margin:4px 0 0;font:700 19px/1.2 Arial,sans-serif;color:${NAVY}">${esc(dato.valor)}</p><p style="margin:2px 0 0;font:400 11px/1.4 Arial,sans-serif;color:${SUAVE}">${esc(dato.pie)}</p></td>`,
    )
    .reduce<string[][]>((filas, celda, indice) => {
      if (indice % 3 === 0) filas.push([]);

      filas[filas.length - 1].push(celda);

      return filas;
    }, [])
    .map(
      (fila) =>
        `<tr>${fila.join(
          '<td style="width:10px"></td>',
        )}</tr><tr><td colspan="5" style="height:10px"></td></tr>`,
    )
    .join("");

  const semana = tabla(
    ["Día", "Aspecto", "Lado", "Momento", "Medio", "Roles", "Min.", "Carga"],
    informe.trabajos.map((linea) => [
      esc(linea.dia),
      `${esc(linea.aspectos)}${linea.notas ? `<br><span style="color:${SUAVE};font-size:12px">${esc(linea.notas)}</span>` : ""}`,
      esc(linea.lados),
      esc(linea.momento),
      esc(linea.medio),
      esc(linea.roles),
      esc(linea.minutos),
      `${linea.carga}${linea.medida ? "" : " <span style=\"color:#9CA3AF\">est.</span>"}`,
    ]),
  );

  const valoracion = tabla(
    ["Tarea", "Día", "Fecha", "Nota", "Análisis posterior"],
    informe.valoracion.lineas.map((linea) => [
      esc(linea.tarea),
      esc(linea.dia),
      esc(linea.fecha),
      linea.evaluacion > 0 ? `<b>${linea.evaluacion}</b>` : "—",
      esc(linea.analisis || linea.observaciones || "—"),
    ]),
  );

  const seguimiento = tabla(
    ["Jugador", "Fecha", "Quién", "Modalidad", "Objetivo", "Feedback"],
    informe.seguimiento.lineas.map((linea) => [
      `<b>${esc(linea.jugador)}</b>`,
      esc(linea.fecha),
      esc(linea.quien),
      esc([linea.modalidad, linea.estrategia].filter(Boolean).join(" · ")),
      esc(linea.objetivo || "—"),
      esc(linea.feedback || "—"),
    ]),
  );

  const prioridades = tabla(
    ["Aspecto", "Lado", "Urgencia", "Acciones", "Peligro", "Trabajado"],
    informe.prioridades.map((linea) => [
      esc(linea.aspecto),
      esc(LADO_LABEL[linea.lado]),
      linea.urgencia === null
        ? "—"
        : `<b>${Math.round(linea.urgencia)}</b>`,
      String(linea.acciones),
      esc(linea.peligro),
      esc(linea.minutosTemporada),
    ]),
  );

  const equipo = tabla(
    [
      "Aspecto",
      "Lado",
      "Acciones",
      "Remates",
      "Goles",
      "Peligro",
      "Trabajado",
      "Transferencia",
    ],
    informe.equipo.map((linea) => [
      esc(linea.aspecto),
      esc(LADO_LABEL[linea.lado]),
      String(linea.acciones),
      String(linea.remates),
      String(linea.goles),
      esc(linea.peligro),
      esc(linea.minutosTemporada),
      numeroConSigno(linea.transferencia, " pts"),
    ]),
  );

  const avisos = informe.avisos.length
    ? `<tr><td style="padding:6px 24px 18px"><table role="presentation" width="100%" style="width:100%;border-collapse:collapse"><tr><td style="padding:10px 12px;background:#FEF7E7;border-left:3px solid ${ORO};font:400 12px/1.6 Arial,sans-serif;color:#7A5B1E">${informe.avisos
        .map((aviso) => esc(aviso))
        .join("<br>")}</td></tr></table></td></tr>`
    : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(informe.titulo)}</title></head><body style="margin:0;padding:0;background:#EEEAE0">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#EEEAE0;padding:18px 0"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="860" style="width:860px;max-width:96%;background:#FFFFFF;border-radius:12px;overflow:hidden">

<tr><td style="padding:22px 24px;background:${NAVY}">
  <p style="margin:0;font:600 10px/1.3 Arial,sans-serif;color:${ORO};text-transform:uppercase;letter-spacing:.28em">RMCF Castilla · Balón parado</p>
  <h1 style="margin:8px 0 0;font:700 26px/1.2 Arial,sans-serif;color:#FFFFFF">${esc(informe.titulo)}</h1>
  <p style="margin:6px 0 0;font:400 13px/1.5 Arial,sans-serif;color:#9FB0C6">${esc(
    [informe.subtitulo, informe.rango].filter(Boolean).join(" · "),
  )}</p>
  ${informe.partido ? `<p style="margin:4px 0 0;font:400 12px/1.5 Arial,sans-serif;color:#9FB0C6">${esc(informe.partido)}</p>` : ""}
</td></tr>

<tr><td style="padding:18px 24px 0"><table role="presentation" width="100%" style="width:100%;border-collapse:separate;border-spacing:0">${resumen}</table></td></tr>

${avisos}

${seccion(
  "Lo que hay que mirar",
  "Los cuatro gráficos que contestan la semana: si se ha dedicado el tiempo que tocaba, cuántos córners generamos y concedemos, si los rematamos, y qué está rentando de lo nuestro.",
  bloqueGraficos(informe, modoImagenes, "destacados"),
)}

${seccion(
  "El tiempo de la semana",
  `${fmtMin(informe.tiempo.minutos)} de balón parado. ${explicaDias(informe.objetivo)} El objetivo del cuerpo técnico son 90-100 minutos en una semana de seis entrenamientos, así que la parte que toca en ésta son ${informe.objetivo.minimo}-${informe.objetivo.maximo}.`,
  `${tabla(
    ["", "Minutos", "Objetivo", "Diferencia"],
    [
      [
        "<b>Esta semana</b>",
        `<b>${fmtMin(informe.tiempo.minutos)}</b>`,
        `${informe.objetivo.minimo}′ – ${informe.objetivo.maximo}′`,
        informe.objetivo.veredicto === "dentro"
          ? "<b>dentro del objetivo</b>"
          : informe.objetivo.veredicto === "corto"
            ? `faltan <b>${informe.objetivo.faltan}′</b>`
            : `<b>+${Math.round(informe.tiempo.minutos) - informe.objetivo.maximo}′</b> por encima`,
      ],
    ],
  )}${bloqueGraficos(informe, modoImagenes, "tiempo")}`,
)}

${seccion("La semana, tarea a tarea", "Lo planificado de balón parado, día a día. «est.» es carga estimada; el resto viene medida de la hoja de registro.", semana)}

${
  bloqueGraficos(informe, modoImagenes, "partido").trim()
    ? seccion(
        "Nuestro partido, por las dos vías",
        "Lo mismo contado por Wyscout y por nosotros. Wyscout mide igual a todos los equipos, así que vale para comparar; nuestro registro llega a donde él no llega —la falta lateral separada, el saque de banda— y es el único que trae goles, porque el analista escribe el resultado de cada acción. Que las dos vías no den lo mismo es normal: no cuentan lo mismo.",
        bloqueGraficos(informe, modoImagenes, "partido"),
      )
    : ""
}

${seccion(
  "Cómo estamos contra la categoría",
  informe.comparativa
    ? `${informe.comparativa.equipos} equipos · ${informe.comparativa.jugados} jornada${informe.comparativa.jugados === 1 ? "" : "s"} · lo que Wyscout mide de verdad, por partido. De la liga nadie publica de qué jugada nace cada gol, así que aquí no hay goles estimados.`
    : "",
  informe.comparativa
    ? `${tabla(
        [
          "Métrica",
          "Nosotros",
          "Mediana liga",
          "Puesto",
          "En contra",
          "Mediana",
          "Puesto",
        ],
        informe.comparativa.filas.map((fila) => [
          `<b>${esc(fila.rotulo)}</b>`,
          fmtMedida(fila.favor, fila.key),
          fmtMedida(fila.medianaFavor, fila.key),
          fila.puestoFavor === null
            ? "—"
            : `<b>${fila.puestoFavor}.º</b> de ${informe.comparativa!.equipos}`,
          fmtMedida(fila.contra, fila.key),
          fmtMedida(fila.medianaContra, fila.key),
          fila.puestoContra === null
            ? "—"
            : `<b>${fila.puestoContra}.º</b> de ${informe.comparativa!.equipos}`,
        ]),
      )}${bloqueGraficos(informe, modoImagenes, "wyscout")}`
    : "",
)}

${seccion(
  "Nuestros registros de competición",
  informe.propio
    ? `${informe.propio.acciones} acciones en ${informe.propio.partidos} partidos, de nuestras cuatro hojas de ABP. ${informe.propio.conPretemporada ? "Van dentro los amistosos de verano." : informe.propio.fueraDePretemporada ? `Sólo competición: fuera quedan ${informe.propio.fueraDePretemporada} acciones de pretemporada.` : ""} Aquí los goles son dato: los escribe el analista acción por acción.`
    : "",
  bloqueGraficos(informe, modoImagenes, "nuestro"),
)}

${seccion(
  "Los contenidos y su valoración",
  informe.valoracion.media === null
    ? `${informe.valoracion.valoradas} de ${informe.valoracion.total} tareas con algo escrito.`
    : `${informe.valoracion.valoradas} de ${informe.valoracion.total} tareas valoradas · media ${informe.valoracion.media.toFixed(1)}.`,
  `${bloqueGraficos(informe, modoImagenes, "contenidos")}${valoracion}`,
)}

${seccion(
  "Seguimiento individual de balón parado",
  "Reconocido por lo que está escrito en los objetivos y el feedback: la hoja de seguimiento no tiene casilla de ABP, así que esta lista es una lectura, no un dato cerrado.",
  `${bloqueGraficos(informe, modoImagenes, "seguimiento")}${seguimiento}`,
)}

${seccion(
  "Por dónde empezar",
  "Las cinco urgencias de arriba: mezclan lo que pasa en el partido, lo peligroso que está siendo y lo poco que se ha trabajado.",
  prioridades,
)}

${seccion(
  "El balón parado del equipo, aspecto por aspecto",
  "Toda la temporada registrada en las hojas de ABP. «Transferencia» compara los partidos con trabajo previo y los que no; en blanco cuando todavía no hay muestra.",
  equipo,
)}

${seccion(
  "Nuestro balón parado, en cifras",
  informe.propio
    ? `${informe.propio.acciones} acciones en ${informe.propio.partidos} partidos, de nuestras cuatro hojas de ABP. ${informe.propio.conPretemporada ? "Van dentro los amistosos de verano." : informe.propio.fueraDePretemporada ? `Sólo competición: fuera quedan ${informe.propio.fueraDePretemporada} acciones de pretemporada.` : ""} Aquí los goles son dato: los escribe el analista acción por acción.`
    : "",
  informe.propio
    ? tabla(
        ["", "Acciones", "Remates", "Peligro", "Goles", "xG"],
        [
          [
            "<b>A favor</b>",
            String(informe.propio.ofensivo.acciones),
            String(informe.propio.ofensivo.remates),
            String(informe.propio.ofensivo.peligros),
            `<b>${informe.propio.ofensivo.goles}</b>`,
            fmtDec(informe.propio.ofensivo.xg),
          ],
          [
            "<b>En contra</b>",
            String(informe.propio.defensivo.acciones),
            String(informe.propio.defensivo.remates),
            String(informe.propio.defensivo.peligros),
            `<b>${informe.propio.defensivo.goles}</b>`,
            fmtDec(informe.propio.defensivo.xg),
          ],
        ],
      )
    : "",
)}

<tr><td style="padding:18px 24px 24px;border-top:1px solid #E5E1D6">
  <p style="margin:0;font:400 11px/1.6 Arial,sans-serif;color:${SUAVE}">Generado automáticamente por la plataforma del Real Madrid Castilla · ${esc(informe.generado)}</p>
</td></tr>

</table></td></tr></table></body></html>`;
}

/** El mismo informe en texto, para quien lea el correo sin formato. */
export function informeTexto(informe: InformeMicro) {
  const lineas: string[] = [];

  lineas.push(informe.titulo.toUpperCase());
  lineas.push([informe.subtitulo, informe.rango].filter(Boolean).join(" · "));

  if (informe.partido) lineas.push(informe.partido);

  lineas.push("");

  informe.resumen.forEach((dato) => {
    lineas.push(`- ${dato.rotulo}: ${dato.valor} (${dato.pie})`);
  });

  if (informe.avisos.length) {
    lineas.push("", "AVISOS");
    informe.avisos.forEach((aviso) => lineas.push(`- ${aviso}`));
  }

  lineas.push("", "LA SEMANA");

  informe.trabajos.forEach((linea) => {
    lineas.push(
      `- ${linea.dia} · ${linea.aspectos} (${linea.lados}) · ${linea.minutos} · ${linea.momento} · ${linea.medio}`,
    );
  });

  lineas.push(
    "",
    `LA VALORACIÓN REGISTRADA (${informe.valoracion.valoradas} de ${informe.valoracion.total})`,
  );

  informe.valoracion.lineas.forEach((linea) => {
    lineas.push(
      `- ${linea.tarea}${linea.evaluacion > 0 ? ` · nota ${linea.evaluacion}` : ""}${
        linea.analisis ? ` · ${linea.analisis}` : ""
      }`,
    );
  });

  lineas.push(
    "",
    `SEGUIMIENTO INDIVIDUAL DE ABP (${informe.seguimiento.lineas.length} registros · ${informe.seguimiento.jugadores} jugadores)`,
  );

  informe.seguimiento.lineas.forEach((linea) => {
    lineas.push(
      `- ${linea.jugador} · ${linea.fecha} · ${linea.objetivo || "sin objetivo escrito"}`,
    );
  });

  lineas.push("", "POR DÓNDE EMPEZAR");

  informe.prioridades.forEach((linea) => {
    lineas.push(
      `- ${linea.aspecto} (${LADO_LABEL[linea.lado]}) · urgencia ${
        linea.urgencia === null ? "—" : Math.round(linea.urgencia)
      } · ${linea.acciones} acciones · peligro ${linea.peligro}`,
    );
  });

  if (informe.propio) {
    const p = informe.propio;

    lineas.push(
      "",
      `NUESTRO BALÓN PARADO REGISTRADO (${p.acciones} acciones en ${p.partidos} partidos)`,
      `- A favor: ${p.ofensivo.acciones} acciones · ${p.ofensivo.remates} remates · ${p.ofensivo.goles} goles · xG ${fmtDec(p.ofensivo.xg)}`,
      `- En contra: ${p.defensivo.acciones} acciones · ${p.defensivo.remates} remates · ${p.defensivo.goles} goles · xG ${fmtDec(p.defensivo.xg)}`,
    );
  }

  if (informe.comparativa) {
    const c = informe.comparativa;

    lineas.push(
      "",
      `CONTRA LA CATEGORÍA (${c.equipos} equipos · ${c.jugados} jornadas · lo que mide Wyscout, por partido)`,
    );

    c.filas.forEach((fila) => {
      lineas.push(
        `- ${fila.rotulo}: ${fmtMedida(fila.favor, fila.key)} (mediana ${fmtMedida(fila.medianaFavor, fila.key)})${
          fila.puestoFavor === null ? "" : ` · ${fila.puestoFavor}.º de ${c.equipos}`
        } · en contra ${fmtMedida(fila.contra, fila.key)}${
          fila.puestoContra === null ? "" : ` · ${fila.puestoContra}.º de ${c.equipos}`
        }`,
      );
    });

    if (c.temporadas.length > 1) {
      lineas.push("", `NUESTRAS TEMPORADAS, EN SUS ${c.jugados} PRIMEROS PARTIDOS`);

      c.temporadas.forEach((una) => {
        const corners = una.valores?.corners;

        lineas.push(
          `- ${una.temporada}${una.esActual ? " (ésta)" : ""}: ${fmtMedida(corners?.favor ?? null, "corners")} córners a favor · ${fmtMedida(corners?.contra ?? null, "corners")} en contra`,
        );
      });
    }
  }

  lineas.push("", "EL BALÓN PARADO DEL EQUIPO");

  informe.equipo.forEach((linea) => {
    lineas.push(
      `- ${linea.aspecto} (${LADO_LABEL[linea.lado]}) · ${linea.acciones} acciones · ${linea.remates} remates · ${linea.goles} goles · peligro ${linea.peligro} · trabajado ${linea.minutosTemporada}`,
    );
  });

  lineas.push(
    "",
    `Generado automáticamente por la plataforma del Real Madrid Castilla · ${informe.generado}`,
  );

  return lineas.join("\n");
}
