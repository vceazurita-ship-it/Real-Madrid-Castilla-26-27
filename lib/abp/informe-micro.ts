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
 *
 * DOS INFORMES POR SEMANA (03/10/2026): la **previa** —qué vamos a hacer y por
 * qué: la semana, las urgencias, el rival y las claves para el partido— y el
 * **post** —qué pasó: nuestras acciones de esa jornada, si lo entrenado
 * apareció y cómo salieron las tareas, y después el acumulado—. Es el mismo
 * modelo con otro orden y otras secciones; lo decide `modo`, y
 * `modoSugerido` propone el que toca según la fecha y las hojas.
 */

import {
  ASPECTOS,
  ASPECTO_BY_KEY,
  DIAS,
  LADO_LABEL,
  MEDIO_LABEL,
  MOMENTO_LABEL,
  ROL_LABEL,
  cargaCognitiva,
  cargaCondicional,
  cargaEsReal,
  claveAspecto,
  fmtMin,
  normalizaTrabajo,
  type AbpLado,
  type AspectoKey,
  type DiaKey,
  type OrigenDias,
  type TotalesPlan,
  type Trabajo,
} from "./microciclo";

import { hayEvaluacion, textoEsAbp, type RegistroTarea } from "./registro";

import {
  MINIMO_ACCIONES_PRIORIDAD,
  construyeCruce,
  prioridadesAbp,
  type EntradaCruce,
  type FilaCruce,
} from "./transferencia";

import { esPropuestaDelBoceto, minutosAbp } from "./minutos";

import {
  etiquetaFamilia,
  type AreaGrafico,
  type ComparativaAbp,
  type GraficoInforme,
  type PropioAbp,
  type SeguimientoResumen,
  type TareaValorada,
  type TiempoSemana,
} from "./informe-graficos";

import type { AccionAbp } from "@/lib/data-analisis/abp-propio";
import { agrupa, enlaceEnSegundo, rotuloRef, segundoEnVideo, type Apunte, type VideoApuntes } from "@/lib/abp/apuntes";
import { buildAerialThreats } from "./rival";
import { teamKey } from "./model";
import { playerKey } from "@/lib/rivals/once";

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
  dias?: {
    clave: DiaKey;
    etiqueta: string;
    tipo: "entreno" | "descanso" | "partido";
    /** "2026-09-21": el día del calendario, lo sepa o no la hoja de registro. */
    fecha?: string;
  }[];
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
  /** Previa del partido o post partido. Sin decir, previa. */
  modo?: ModoInforme;
  /**
   * El partido de la semana según el calendario (BeSoccer), con su jornada,
   * su hora y, si ya se jugó, el resultado. Es lo que permite separar la ida
   * de la vuelta al buscar sus acciones en nuestras hojas.
   */
  partidoCalendario?: PartidoCalendario | null;
  /**
   * Las acciones de nuestras hojas de ABP de ESE partido
   * (`accionesDelPartido`). Sólo se usan en el post.
   */
  accionesPartido?: AccionAbp[] | null;
  /**
   * Las acciones del partido del que viene la semana (`partidoAnterior`).
   * Sólo en la previa: dicen qué nos dejó a balón parado (20/10/2026).
   */
  accionesAnterior?: AccionAbp[] | null;
  /**
   * Las plantillas rivales (`/api/rivals?action=rivalesPlantillas`), en
   * bruto: de ahí salen la estatura y la etiqueta «Rematador de ABP» de sus
   * jugadores para el bloque de emparejamientos (20/10/2026). Sólo previa.
   */
  plantillaRival?: unknown;
  /**
   * Su once probable marcado en Plantillas rivales (`rival-once:<equipo>`),
   * con las claves de jugador (`playerKey`). Sólo se lee: separa a los que
   * salen de los que sólo entran (22/10/2026). Sin él, nadie lleva «si entra».
   */
  onceRival?: { titulares: string[]; dudas: string[] } | null;
  /**
   * Los cortes del partido (`informe-clips:jNN`), para enlazar cada acción de
   * peligro del post con su vídeo por el minuto (22/10/2026). Sólo se lee.
   */
  clipsPartido?: { minuto: string; url: string; de: string; tipo: string }[] | null;
  /**
   * Lo preparado del rival. `null` es «se ha mirado y no hay nada»;
   * `undefined`, «todavía no se sabe» (no se avisa de nada).
   */
  rivalAnalisis?: RivalAnalisisInforme | null;
  /**
   * Lo necesario para rehacer el cruce aquí dentro (19/10/2026).
   *
   * La pantalla monta `filas` con TODAS las acciones de las hojas, amistosos de
   * julio incluidos, mientras el resto del informe habla de competición: la
   * tabla de aspectos daba 6 goles a favor y «Nuestro balón parado» 2, y las
   * urgencias contaban 149 saques de banda de los que un tercio eran de
   * pretemporada. Con esto el informe rehace el cruce con las mismas acciones
   * que el resto (`conPretemporada`) y con los minutos que cuentan
   * (`minutosAbp`). Sin ello, se usan `filas` tal cual.
   */
  cruce?: Omit<EntradaCruce, "minutosMicro">;
  /** Si el informe mete los amistosos de verano (el interruptor del diálogo). */
  conPretemporada?: boolean;
};

export type ModoInforme = "previa" | "post";

/** El partido de la semana como lo da el calendario (`PartidoNuestro`). */
export type PartidoCalendario = {
  jornada: number;
  /** "2026-09-20T12:00", hora de Madrid. */
  cuando: string;
  rival: string;
  lado: "casa" | "fuera";
  golesFavor: number | null;
  golesContra: number | null;
  jugado: boolean;
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

  /* Lo que no se sabe no se cuenta en el informe (17/10/2026): sólo los días con trabajo. */
  return `${dias} con trabajo de balón parado.`;
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
/*  EL PARTIDO DEL MICROCICLO                                          */
/* ------------------------------------------------------------------ */

/**
 * Cuándo se juega el partido de la semana.
 *
 * Primero el calendario (trae la hora); si no, el día marcado como partido en
 * la ventana del microciclo, sin hora. `conHora` lo dice, porque «ya se ha
 * jugado» no se decide igual con una hora que con un día entero.
 */
export function fechaDelPartido(
  datos: Pick<DatosInforme, "partidoCalendario" | "dias">,
): { fecha: Date; conHora: boolean } | null {
  const cuando = datos.partidoCalendario?.cuando ?? "";

  const conHora = cuando.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);

  if (conHora) {
    const fecha = new Date(
      Number(conHora[1]),
      Number(conHora[2]) - 1,
      Number(conHora[3]),
      Number(conHora[4] ?? 0),
      Number(conHora[5] ?? 0),
    );

    if (!Number.isNaN(fecha.getTime())) {
      return { fecha, conHora: conHora[4] !== undefined && cuando.slice(11, 16) !== "00:00" };
    }
  }

  const delDia = (datos.dias ?? []).find((dia) => dia.tipo === "partido");

  const fecha = leeFecha(delDia?.fecha);

  return fecha ? { fecha, conHora: false } : null;
}

/** «ATL. BALEARES», «Atlético Baleares»: se comparan sin tildes ni siglas. */
const SIGLAS_CLUB =
  /\b(ad|cd|ud|sd|cf|fc|rcd|sad|club|deportivo|deportiva|real|cultural|sociedad)\b/g;

function claveEquipo(nombre: string) {
  return String(nombre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(SIGLAS_CLUB, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * ¿La hoja y el calendario hablan del mismo rival?
 *
 * Basta con que una palabra de tres letras o más de uno sea el principio de
 * una del otro: «ATL MADRID B» y «Atlético Madrileño» comparten «atl», y la
 * jornada ya ha filtrado antes, así que aquí sólo se descarta lo que es
 * claramente otro equipo.
 */
export function mismoRival(uno: string, otro: string) {
  const a = claveEquipo(uno);
  const b = claveEquipo(otro);

  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const palabrasA = a.split(" ").filter((p) => p.length >= 3);
  const palabrasB = b.split(" ").filter((p) => p.length >= 3);

  return palabrasA.some((p) =>
    palabrasB.some((q) => p.startsWith(q) || q.startsWith(p)),
  );
}

/**
 * Las acciones de nuestras hojas de ABP que son del partido de este micro.
 *
 * Por orden de fiabilidad:
 *
 * 1. **La jornada del calendario** (BeSoccer) contra la de la hoja, en liga, y
 *    con el rival comprobado. Es lo único que distingue la ida de la vuelta.
 * 2. **El texto de la jornada** que la pantalla ya cruzó con la hoja
 *    (`partido.jornada`), si no hay calendario.
 * 3. Sin ninguna de las dos, el último partido oficial registrado contra ese
 *    rival. Nunca un amistoso: el de julio contra el mismo equipo no es el
 *    partido de esta semana.
 *
 * Si nada encaja devuelve una lista vacía, y el informe dice que el partido
 * todavía no está registrado en vez de inventárselo.
 */
export function accionesDelPartido(
  acciones: AccionAbp[],
  partido: {
    rival: string;
    /** El número de jornada del calendario. */
    jornada?: number | null;
    /** La jornada tal y como la escribe la hoja («LIGA 07»). */
    jornadaHoja?: string | null;
  },
): AccionAbp[] {
  const oficiales = acciones.filter(
    (una) => una.jornada.competicion !== "amistoso",
  );

  const delRival = (lista: AccionAbp[]) =>
    lista.filter((una) => !una.rival || !partido.rival || mismoRival(una.rival, partido.rival));

  if (partido.jornada) {
    return delRival(
      oficiales.filter(
        (una) =>
          una.jornada.competicion === "liga" && una.jornada.numero === partido.jornada,
      ),
    );
  }

  const hoja = String(partido.jornadaHoja ?? "").trim().toLowerCase();

  if (hoja) {
    const suyas = oficiales.filter(
      (una) => una.jornada.bruto.trim().toLowerCase() === hoja,
    );

    if (suyas.length) return delRival(suyas);
  }

  if (!partido.rival) return [];

  const conRival = oficiales.filter((una) => una.rival && mismoRival(una.rival, partido.rival));

  const ultima = conRival.reduce<AccionAbp | null>(
    (mejor, una) =>
      !mejor || (una.jornada.numero ?? 0) > (mejor.jornada.numero ?? 0) ? una : mejor,
    null,
  );

  return ultima ? conRival.filter((una) => una.jornada.clave === ultima.jornada.clave) : [];
}

/**
 * Previa o post, según lo que se sabe del partido.
 *
 * Post si el partido ya tiene acciones en nuestras hojas, si el calendario lo
 * da por jugado o si ya ha pasado: con hora, dos horas después del inicio;
 * con sólo el día, desde el día siguiente. Si no, previa.
 */
export function modoSugerido(entrada: {
  fecha: { fecha: Date; conHora: boolean } | null;
  jugado?: boolean;
  hayAcciones: boolean;
  ahora?: Date;
}): ModoInforme {
  if (entrada.hayAcciones || entrada.jugado) return "post";

  if (!entrada.fecha) return "previa";

  const ahora = (entrada.ahora ?? new Date()).getTime();

  const { fecha, conHora } = entrada.fecha;

  const limite = conHora
    ? fecha.getTime() + 2 * 3_600_000
    : new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1).getTime();

  return ahora >= limite ? "post" : "previa";
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
  /** Propuesta del boceto sin confirmar: sale, pero sus minutos no suman (`minutosAbp`). */
  propuesta: boolean;
  /** Minutos sin redondear, para no tener que releer «15'». */
  min: number;
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
  /** Minutos de este microciclo. */
  minutosSemana: string;
  minutosTemporada: string;
  urgencia: number | null;
  transferencia: number | null;
  /** Acciones con gol u ocasión para quien saca. */
  peligros: number;
  /** «8 de 53»: la base a la vista (19/10/2026). */
  base: string;
  /** Minutos de la semana sin formatear (los que cuentan). */
  minSemana: number;
  /** Está en el plan de la semana, aunque todavía sin minutos. */
  planificado: boolean;
  /** Saque de banda: va aparte del balón parado que acaba en remate. */
  esBanda: boolean;
  /** Cuántas acciones (y cuántas con peligro) hay detrás de la transferencia, en cada grupo. */
  transferenciaN: { con: number; sin: number; peligrosCon: number; peligrosSin: number } | null;
  /**
   * Lo que dice el rival de la semana de este aspecto (20/10/2026), en una
   * línea: «sube: el Algeciras concede 3,1 faltas por partido (17.º de 20)».
   * Vacío si Wyscout no lo mide o el rival está en la media.
   */
  contraRival: string;
  /** El sentido de `contraRival`: si el rival hace subir o bajar la prioridad. */
  sentidoRival: "sube" | "baja" | null;
  /** `contraRival` sin el puesto ni la mediana, para un titular: «el Algeciras saca 3,0 faltas por partido». */
  contraRivalCorto: string;
  /**
   * Prioridad que se apoya en pocos peligros (22/10/2026, `muestraSuficiente`
   * contra el resto de nuestro balón parado): se dice que es tendencia, de
   * dónde salen y cuánto valían. Vacío si la muestra aguanta.
   */
  tendencia: string;
  /** La familia de la acción («corner», «falta-lateral»…): para cruzarla con Wyscout. */
  familia: string;
  /**
   * Lo que nos hizo en esto el rival del partido anterior (20/10/2026, hilo
   * entre semanas): «contra el Antequera CF nos dio 2 sustos (2 de 2)». Vacío
   * si no nos hizo daño ahí.
   */
  delAnterior: string;
  /**
   * Su tasa de peligro frente al resto de nuestro balón parado del mismo lado
   * (20/10/2026): «el doble que el resto de nuestro balón parado en contra
   * (7,6 %)». Vacío sin muestra.
   */
  referencia: string;
  /** La clave del aspecto (`AspectoKey`): para buscar sus acciones en las hojas. */
  clave: AspectoKey;
  /**
   * Cómo fueron sus acciones de peligro en el partido anterior (23/10/2026):
   * «las 2 contra el Antequera CF: desde Z4 interior, envío bombeado al
   * segundo palo». Vacío si la hoja no lo trae.
   */
  patron: string;
  /** El patrón hecho consigna, en defensa: «El segundo palo tiene dueño antes del golpeo». */
  consignaPatron: string;
  /**
   * Por qué no es la nº 1 aunque nos costó goles (24/10/2026, ronda 6 de los
   * expertos): «El córner directo defensivo sigue vigilado: nos ha costado 2
   * goles (base corta), pero está por debajo del resto…». Vacío si no hace
   * falta explicarlo.
   */
  segundoPlano: string;
  /** Goles esperados de la temporada en este aspecto (en contra, si es defensivo). */
  xg: number;
  /** El factor del rival de la semana en este mismo aspecto (1 = neutro). */
  factorRival: number;
};

/** Lo que pasó en el partido, contado a favor o en contra. */
export type CifrasPartido = {
  acciones: number;
  remates: number;
  peligros: number;
  goles: number;
  xg: number;
};

export type FilaPartidoAbp = CifrasPartido & {
  familia: string;
  /** «Córner», «Saque de banda»… */
  etiqueta: string;
  lado: AbpLado;
  /** Sólo en la banda a favor: cuántas veces seguimos con el balón. */
  retenidos: number | null;
};

/** Lo trabajado en la semana, frente a lo que pasó en el partido. */
export type LineaCruce = CifrasPartido & {
  aspecto: string;
  lado: AbpLado;
  /** Minutos de la semana; 0 si no se trabajó. */
  minutos: number;
  trabajado: boolean;
  /** Si alguna hoja registra este aspecto. */
  medible: boolean;
  lectura: string;
  tono: "bien" | "mal" | "neutro";
};

export type PartidoAbpInforme = {
  /** «Jornada 7». */
  jornada: string;
  favor: CifrasPartido;
  contra: CifrasPartido;
  filas: FilaPartidoAbp[];
  cruce: LineaCruce[];
  rematadores: { jugador: string; total: number; peligro: number }[];
  sacadores: { jugador: string; total: number; peligro: number }[];
  /** Acciones que no se pueden atribuir a un aspecto (sin envío o sin zona). */
  sinClasificar: number;
  /** El marcador del partido, si ya se jugó: para contar cuántos goles fueron a balón parado. */
  marcador?: { favor: number; contra: number } | null;
  /**
   * Cada acción con peligro o gol, contada (22/10/2026): minuto, envío, caída
   * y remate de la hoja, con su corte si lo hay. Sin saques de banda que no
   * dieron peligro.
   */
  peligrosas: { lado: AbpLado; aspecto: string; texto: string; /** Sin el tipo, para lo esencial. */ corto: string; xg: number; clip: string | null }[];
};

export type InformeMicro = {
  modo: ModoInforme;
  /** Con la idea, sin corchetes ni siglas (20/10/2026): «Balón parado J9 Algeciras: defendemos el córner, 4 de 27 con peligro». */
  asunto: string;
  /** Lo que se ve junto al asunto en la bandeja: la acción. */
  preencabezado: string;
  /**
   * A quién marcamos y por dónde atacamos (previa, 20/10/2026): sus
   * rematadores con estatura y etiqueta, y nuestro balón parado ofensivo que
   * el rival concede. `null` si no hay ninguna de las dos cosas.
   */
  emparejamientos: { marcamos: string[]; atacamos: string[] } | null;
  /** «Previa del partido» · «Post partido». */
  modoRotulo: string;
  /**
   * La portada para el jugador (22/10/2026): el partido delante
   * («ALGECIRAS CF · DOM 25 OCT · 16:30 · FUERA»), qué es debajo («Balón
   * parado: lo que toca esta semana») y el microciclo, pequeño, al pie.
   */
  portada: { partido: string; que: string; pie: string };
  /**
   * El cierre del post (22/10/2026): «PARA LA SEMANA QUE VIENE», la consigna
   * con su porqué. `null` si el partido no deja nada con dato.
   */
  cierre: { titulo: string; consigna: string; porQue: string; marcamos: string } | null;
  titulo: string;
  subtitulo: string;
  generado: string;
  rango: string;
  /** El partido de la semana en una línea: jornada, fecha, campo y, en el post, el resultado. */
  partido: string;
  /** De qué partido viene la semana. */
  vieneDe: string;
  resumen: { rotulo: string; valor: string; pie: string }[];
  /** Las claves: 3-5 frases calculadas, lo primero que se lee. */
  claves: string[];
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
  /**
   * Previa sin señal clara en contra (25/10/2026, ronda 7): ninguna
   * prioridad defensiva pasa la regla de muestra. La nº 1 es la de más goles
   * esperados concedidos y `otra`, la siguiente de otra familia. `null` si sí la hay.
   */
  sinSenal: { otra: LineaEquipo | null } | null;
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
  /** Sólo en el post: el partido de la semana, acción por acción. */
  partidoAbp: PartidoAbpInforme | null;
  /** Los gráficos, cada uno con el área de la sección en la que va. */
  graficos: GraficoInforme[];
  /** Lo que el informe no sabe, dicho donde se lee. */
  avisos: string[];
  /**
   * Lo analizado del rival de la semana en «ABP del Rival»: sus conclusiones
   * por sección. Las láminas van en `graficos` con el área `rival`.
   */
  rivalAnalisis?: RivalAnalisisInforme | null;
  /**
   * Los minutos de ABP de la semana, de `minutosAbp` (19/10/2026): la ÚNICA
   * cifra de minutos del informe, la diapositiva y el vídeo. `texto` dice qué
   * cuenta («1h 5' (35' en campo, 30' en vídeo); 30' más propuestos…»).
   */
  minutosAbp: {
    confirmados: number;
    propuestos: number;
    campo: number;
    video: number;
    texto: string;
    /** Los mismos minutos por lado (23/10/2026), si cuadran con el total: «ofensivo 1 h 10′ · defensivo 10′». */
    porLado: { ofensivo: number; defensivo: number } | null;
  };
  /**
   * Previa sin un minuto todavía (19/10/2026): la semana no ha empezado, así
   * que no se habla de minutos, carga ni «sin trabajar»; sólo de lo planificado.
   */
  sinMinutos: boolean;
  /** Su balón parado según Wyscout (previa), si el rival está en la categoría. */
  rivalAbp: RivalAbpInforme | null;
};

/** Su balón parado, medido por Wyscout, con su puesto en la categoría. */
export type RivalAbpInforme = {
  equipo: string;
  equipos: number;
  /** Cada métrica con valor, mediana y puesto; sólo las que tienen dato. */
  filas: { rotulo: string; key: string; favor: number | null; puestoFavor: number | null; contra: number | null; puestoContra: number | null; medianaFavor: number; medianaContra: number }[];
  /** Una o dos frases, ya escritas. */
  lineas: string[];
};

export type RivalAnalisisInforme = {
  equipo: string;
  jornada: string;
  conclusiones: { seccion: string; texto: string }[];
  /** Los PDF preparados de la jornada (ABP y centros), con su enlace. */
  documentos?: { nombre: string; url: string }[];
  /** Los apuntes con vídeo (16/10/2026): el del rival y los nuestros (partido anterior y contra él). */
  apuntes?: { titulo: string; deQuien: "rival" | "propio"; video: VideoApuntes | null; apuntes: Apunte[] }[];
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

/* ---------------- números, como se leen aquí ---------------- */

/** Con coma decimal. */
export function dec(valor: number, decimales = 1) {
  return valor.toFixed(decimales).replace(".", ",");
}

function pct(parte: number, total: number) {
  return total > 0 ? `${dec((parte / total) * 100)} %` : "—";
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** «1 h 20 min», «45 min»: el tiempo como se lee en voz alta (22/10/2026). */
export function fmtLargo(minutos: number) {
  const total = Math.round(minutos);

  const h = Math.floor(total / 60);
  const m = total % 60;

  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

/** «dentro del objetivo», «faltan 20 min para el objetivo», «por encima del objetivo». */
function veredictoObjetivo(o: ObjetivoSemana) {
  return o.veredicto === "dentro" ? "dentro del objetivo" : o.veredicto === "corto" ? `faltan ${fmtLargo(o.faltan)} para el objetivo` : "por encima del objetivo";
}

/** «Córner directo (defensivo)»: el mismo nombre en todo el informe. */
function nombreAspecto(aspecto: string, lado: AbpLado) {
  return `${aspecto} (${LADO_LABEL[lado].toLowerCase()})`;
}

/**
 * «córner directo defensivo», «saque de banda Z2 ofensivo»: el aspecto dentro de
 * una frase (19/10/2026). Con `nombreAspecto(...).toLowerCase()` salían
 * «saque de banda z2 (defensivo)» y paréntesis dentro de paréntesis.
 */
function mayuscula(texto: string) {
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;
}

/** «defensivo», «defensiva», «defensivos»: el lado concordado con el aspecto. */
function ladoConcordado(aspecto: string, lado: AbpLado) {
  const base = LADO_LABEL[lado].toLowerCase();

  if (/^penaltis\b/i.test(aspecto)) return `${base}s`;

  return /^falta\b/i.test(aspecto) ? base.replace(/o$/, "a") : base;
}

function aspectoEnFrase(aspecto: string, lado: AbpLado) {
  return `${aspecto.charAt(0).toLowerCase()}${aspecto.slice(1)} ${ladoConcordado(aspecto, lado)}`;
}

function listaAspectos(trabajo: Trabajo) {
  return trabajo.aspectos
    .map((clave) => ASPECTO_LABEL.get(clave) ?? clave)
    .join(", ");
}

/* ---------------- la regla de muestra (20/10/2026) ---------------- */

/**
 * Con menos acciones que esto, «salió bien» o «no rindió» es ruido (19/10/2026):
 * se juzgaba un córner con una sola acción. Los goles sí cuentan siempre.
 */
export const MINIMO_VEREDICTO = 5;

/** Casos (acciones con peligro, vistos o esperados) que hacen falta para un veredicto. */
export const MINIMO_CASOS = 3;

/**
 * LA REGLA DE MUESTRA DEL INFORME (20/10/2026, crítica de los expertos).
 *
 * Una sola para todo: el «salió bien / no salió» del post, su titular y el
 * «¿se nota el trabajo?» de la temporada. Se mide en **casos que importan**
 * —acciones con peligro, vistas o esperadas con la tasa de referencia—, no en
 * acciones totales: 0 de 6 con un 7 % de peligro en la temporada es justo lo
 * esperable (0,4 casos), y «2 de 2» no es un diagnóstico de nada.
 *
 * Hace falta `MINIMO_VEREDICTO` acciones y `MINIMO_CASOS` casos vistos o
 * esperados. Si no, la frase es de tendencia o el dato no destaca.
 */
export function muestraSuficiente(o: { acciones: number; casos: number; tasa?: number | null }) {
  if (o.acciones < MINIMO_VEREDICTO) return false;

  const esperados = o.tasa === null || o.tasa === undefined ? 0 : o.acciones * o.tasa;

  return Math.max(esperados, o.casos) >= MINIMO_CASOS;
}

/**
 * Con muestra, cómo queda lo visto frente a lo esperado: «alto», «bajo» o
 * «normal». Sin tasa de referencia no hay contra qué comparar: `null`.
 */
function frenteALoEsperado(acciones: number, casos: number, tasa: number | null | undefined) {
  if (tasa === null || tasa === undefined) return null;

  const esperados = acciones * tasa;

  if (casos >= esperados * 1.5 && casos - esperados >= 1.5) return "alto" as const;
  if (casos <= esperados / 1.5 && esperados - casos >= 1.5) return "bajo" as const;

  return "normal" as const;
}

/**
 * «4 de 27 (14,8 %)», o «2 de 2» sin porcentaje cuando hay tan pocas acciones
 * que el porcentaje engaña (20/10/2026).
 */
function tasaConBase(casos: number, acciones: number) {
  if (!acciones) return "";

  return acciones < MINIMO_VEREDICTO ? `${casos} de ${acciones}` : `${dec((casos / acciones) * 100)} %`;
}

/* ---------------- el rival de la semana en las prioridades ---------------- */

/**
 * Qué mide Wyscout de cada familia, por lado (20/10/2026). Defendiendo
 * nosotros, se mira cómo ATACA el rival eso mismo; atacando, cómo lo CONCEDE.
 * Los saques de banda no salen: Wyscout no los mide.
 */
/*
| Sólo lo que mide ese mismo aspecto (25/10/2026, ronda 7 de los expertos):
| «faltas lanzadas» cuenta TODAS las faltas (al centro, a puerta, de medio
| campo), no la lateral directa; «el Algeciras saca 3 faltas por partido» no
| decía nada de su falta lateral. En las faltas, sólo su eficacia.
*/
const WYSCOUT_FAMILIA: Record<string, { volumen: string | null; remate: string | null; nombre: string } | undefined> = {
  corner: { volumen: "corners", remate: "cornersRemate", nombre: "córners" },
  "falta-lateral": { volumen: null, remate: "faltasRemate", nombre: "faltas" },
  "falta-directa": { volumen: null, remate: "faltasRemate", nombre: "faltas" },
  penalti: { volumen: "penaltis", remate: null, nombre: "penaltis" },
};

/**
 * Cuánto pesa el rival en un aspecto: un factor entre 0,7 y 1,3 para el orden
 * de las prioridades, y la línea que lo explica. Defendiendo, sube si el rival
 * destaca atacando eso; atacando, sube si el rival lo concede.
 *
 * La posición en la categoría se lee como en el resto del informe: atacando,
 * el 1.º es el que más hace; defendiendo, el que menos concede.
 */
function pesoDelRival(fila: FilaCruce, ra: RivalAbpInforme | null) {
  const familia = fila.aspecto.reconocimiento?.family ?? "";

  const medida = WYSCOUT_FAMILIA[familia];

  if (!ra || !medida || ra.equipos < 2) return null;

  const cara = fila.lado === "defensivo" ? ("favor" as const) : ("contra" as const);

  const n = ra.equipos;

  const lecturas = [medida.volumen, medida.remate]
    .filter((key): key is string => Boolean(key))
    .map((key) => {
      const una = ra.filas.find((f) => f.key === key);
      const valor = una?.[cara] ?? null;
      const sitio = cara === "favor" ? una?.puestoFavor : una?.puestoContra;

      if (!una || valor === null || !sitio) return null;

      /* 1 = el rival es muy bueno atacándolo (o lo concede mucho): sube la prioridad. */
      const fuerza = cara === "favor" ? 1 - (sitio - 1) / (n - 1) : (sitio - 1) / (n - 1);

      return { key, valor, sitio, fuerza, mediana: cara === "favor" ? una.medianaFavor : una.medianaContra };
    })
    .filter((una): una is { key: string; valor: number; sitio: number; fuerza: number; mediana: number } => una !== null);

  if (!lecturas.length) return null;

  /*
  | Su balón parado en conjunto (25/10/2026, ronda 7): si el rival está entre
  | los tres peores de la categoría en «ABP con remate %», su balón parado
  | hace poco daño, y eso baja todo lo que defendemos de él, sea cual sea su
  | volumen.
  */
  const abp = cara === "favor" ? ra.filas.find((f) => f.key === "abpRemate") : undefined;

  const abpFlojo = abp && abp.favor !== null && abp.puestoFavor && abp.puestoFavor > n - 3 ? { key: "abpRemate", valor: abp.favor, sitio: abp.puestoFavor, fuerza: 0, mediana: abp.medianaFavor } : null;

  const media = lecturas.reduce((s, una) => s + una.fuerza, 0) / lecturas.length;

  const fuerza = abpFlojo ? Math.min(media, 0.3) : media;

  const sentido = fuerza >= 0.65 ? ("sube" as const) : fuerza <= 0.35 ? ("baja" as const) : null;

  /* La línea, con la métrica más extrema en el sentido que manda. */
  const elegida = abpFlojo && media > 0.35 ? abpFlojo : [...lecturas].sort((a, b) => (sentido === "baja" ? a.fuerza - b.fuerza : b.fuerza - a.fuerza))[0];

  const v = fmtMedida(elegida.valor, elegida.key);

  const rival = ra.equipo;

  const dice =
    elegida.key === "abpRemate"
      ? `sólo el ${v} del balón parado del ${rival} acaba en remate`
      : cara === "favor"
      ? elegida.key === medida.remate
        ? `el ${rival} remata el ${v} de sus ${medida.nombre}`
        : elegida.key === "penaltis"
          ? `el ${rival} tiene ${v} penaltis a favor por partido`
          : `el ${rival} saca ${v} ${medida.nombre} por partido`
      : elegida.key === medida.remate
        ? `al ${rival} le rematan el ${v} de ${medida.nombre === "faltas" ? "las" : "los"} ${medida.nombre}`
        : elegida.key === "penaltis"
          ? `el ${rival} concede ${v} penaltis por partido`
          : `el ${rival} concede ${v} ${medida.nombre} por partido`;

  return {
    factor: 0.7 + 0.6 * fuerza,
    sentido,
    /* Con la referencia (20/10/2026): el puesto y la mediana de la categoría. */
    motivo: sentido ? `${dice} (${elegida.sitio}.º de ${n}; la mediana, ${fmtMedida(elegida.mediana, elegida.key)})` : "",
    corto: sentido ? dice : "",
  };
}

/** Lo que nos hizo en un aspecto el rival del partido anterior, con sus cifras (hilo entre semanas). */
type DanoAnterior = { factor: number; frase: string; rival: string } & CifrasPartido;

/**
 * El daño en contra contado como hecho, no como impresión (22/10/2026):
 * «nos remataron 2 de 2 (0,16 goles esperados)». «Sustos» era subjetivo.
 */
function danoEnFrase(c: CifrasPartido) {
  const xg = c.xg > 0 ? ` (${dec(c.xg, 2)} goles esperados)` : "";

  if (c.goles > 0) return `nos marcaron ${plural(c.goles, "gol", "goles")} en ${plural(c.acciones, "acción", "acciones")}${xg}`;

  return c.remates >= c.peligros && c.remates > 0
    ? `nos remataron ${c.remates} de ${c.acciones}${xg}`
    : `nos crearon peligro en ${c.peligros} de ${c.acciones}${xg}`;
}

function filaEquipo(
  fila: FilaCruce,
  semana?: { minutos: Map<string, number>; planificado: Set<string> },
  ra: RivalAbpInforme | null = null,
  anterior: Map<string, DanoAnterior> | null = null,
): LineaEquipo {
  const clave = claveAspecto(fila.aspecto.key, fila.lado);

  /* Los minutos de la semana, los que cuentan (`minutosAbp`), no los del plan entero. */
  const minSemana = semana ? (semana.minutos.get(clave) ?? 0) : fila.minutosMicro;

  const delRival = pesoDelRival(fila, ra);

  return {
    contraRival: delRival?.motivo ?? "",
    contraRivalCorto: delRival?.corto ?? "",
    delAnterior: anterior?.get(`${fila.aspecto.label}|${fila.lado}`)?.frase ?? "",
    referencia: "",
    tendencia: "",
    clave: fila.aspecto.key,
    patron: "",
    consignaPatron: "",
    segundoPlano: "",
    xg: fila.stats.xg || 0,
    factorRival: delRival?.factor ?? 1,
    sentidoRival: delRival?.sentido ?? null,
    familia: fila.aspecto.reconocimiento?.family ?? "",
    aspecto: fila.aspecto.label,
    lado: fila.lado,
    acciones: fila.stats.acciones,
    remates: fila.stats.remates,
    goles: fila.stats.goles,
    peligro: tasaConBase(fila.stats.peligro, fila.stats.acciones),
    minutosSemana: fmtMin(minSemana),
    minutosTemporada: fmtMin(fila.minutosTemporada),
    urgencia: fila.urgencia,
    transferencia: fila.transferencia?.delta ?? null,
    peligros: fila.stats.peligro,
    base: `${fila.stats.peligro} de ${fila.stats.acciones}`,
    minSemana,
    planificado: semana ? semana.planificado.has(clave) : minSemana > 0,
    esBanda: fila.aspecto.grupo === "banda",
    transferenciaN:
      fila.transferencia && fila.transferencia.delta !== null
        ? {
            con: fila.transferencia.accionesCon,
            sin: fila.transferencia.accionesSin,
            peligrosCon: fila.transferencia.peligrosCon,
            peligrosSin: fila.transferencia.peligrosSin,
          }
        : null,
  };
}

/**
 * «el córner directo defensivo, 8 de 53 con peligro en contra y 2 goles encajados».
 * La urgencia dicha con su base, como la lee el cuerpo técnico.
 */
function urgenciaEnFrase(linea: LineaEquipo) {
  const enContra = linea.lado === "defensivo";

  const goles = linea.goles
    ? ` y ${plural(linea.goles, enContra ? "gol encajado" : "gol", enContra ? "goles encajados" : "goles")}`
    : "";

  /* «4 de 27 (14,8 %)»; con muy pocas acciones, sin el porcentaje repetido. */
  const tasa = linea.acciones >= MINIMO_VEREDICTO && linea.peligro ? ` (${linea.peligro})` : "";

  return `${conArticulo(linea.aspecto)} ${ladoConcordado(linea.aspecto, linea.lado)}, ${linea.base} con peligro${enContra ? " en contra" : ""}${tasa}${goles}`;
}

/**
 * La prioridad dicha como consigna, en primera persona y en presente
 * (20/10/2026): «Defendemos el córner directo», «Atacamos la falta lateral
 * directa», «Tiramos los penaltis». Es lo que se dice en el vestuario.
 */
function consignaDe(aspecto: string, lado: AbpLado) {
  const con = conArticulo(aspecto);

  if (lado === "defensivo") return `Defendemos ${con}`;

  return /^los penaltis/.test(con) ? `Tiramos ${con}` : `Atacamos ${con}`;
}

/**
 * Transferencia en palabras de vestuario, con su base (20/10/2026).
 *
 * Se mide en peligros, no en acciones (`muestraSuficiente`): hace falta al
 * menos `MINIMO_CASOS` peligros en cada grupo y 10 entre los dos para decir
 * «se nota» o «no se nota». Si no, sólo las dos tasas con su base.
 */
function seNotaElTrabajo(linea: LineaEquipo) {
  if (linea.transferencia === null || !linea.transferenciaN) return "";

  const { con, sin, peligrosCon, peligrosSin } = linea.transferenciaN;

  const bases = `con trabajo previo ${peligrosCon} de ${con} · sin él ${peligrosSin} de ${sin}`;

  const suficiente =
    peligrosCon + peligrosSin >= 10 &&
    muestraSuficiente({ acciones: con, casos: peligrosCon, tasa: sin ? peligrosSin / sin : null }) &&
    muestraSuficiente({ acciones: sin, casos: peligrosSin, tasa: con ? peligrosCon / con : null });

  /* Sin veredicto, sólo las dos bases (22/10/2026): «pocos peligros para concluir» en ocho filas era ruido; lo dice el pie una vez. */
  if (!suficiente) return mayuscula(bases);

  const lectura =
    Math.abs(linea.transferencia) < 1
      ? "Igual con trabajo que sin él"
      : linea.transferencia > 0
        ? "Se nota el trabajo"
        : "No se nota todavía";

  return `${lectura} (${numeroConSigno(linea.transferencia, " pts")}) · ${bases}`;
}

/* ---------------- el partido, acción por acción ---------------- */

const ORDEN_FAMILIA = [
  "corner",
  "falta-lateral",
  "falta-directa",
  "penalti",
  "banda",
  "saque-medio",
  "saque-meta",
  "otra",
];

const ladoDe = (accion: AccionAbp): AbpLado =>
  accion.bloque.endsWith("Def") ? "defensivo" : "ofensivo";

/** Lo mismo que lee la pantalla del cruce (`lib/abp/competicion.ts`). */
function envioDe(texto: string): "corto" | "largo" | null {
  const t = String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  if (!t.trim()) return null;
  if (t.includes("corto")) return "corto";
  if (t.includes("bombead") || t.includes("tenso") || t.includes("largo")) return "largo";

  return null;
}

function zonaDe(texto: string): number | null {
  const encontrada = String(texto ?? "").match(/([1-3])/);

  return encontrada ? Number(encontrada[1]) : null;
}

function encaja(accion: AccionAbp, aspecto: AspectoKey) {
  const r = ASPECTO_BY_KEY.get(aspecto)?.reconocimiento;

  if (!r) return false;
  if (accion.familia !== r.family) return false;
  if (r.envio && envioDe(accion.envio) !== r.envio) return false;
  if (r.zonaSaque && zonaDe(accion.zonaSaque) !== r.zonaSaque) return false;

  return true;
}

function cifras(lista: AccionAbp[]): CifrasPartido {
  return {
    acciones: lista.length,
    remates: lista.filter((una) => una.remate).length,
    peligros: lista.filter((una) => una.peligro).length,
    goles: lista.filter((una) => una.gol).length,
    xg: Number(lista.reduce((suma, una) => suma + (una.xg || 0), 0).toFixed(2)),
  };
}

function cuentaNombres(lista: AccionAbp[], nombre: (una: AccionAbp) => string) {
  const mapa = new Map<string, { total: number; peligro: number }>();

  lista.forEach((una) => {
    const quien = nombre(una).trim();

    if (!quien) return;

    const fila = mapa.get(quien) ?? { total: 0, peligro: 0 };

    fila.total += 1;
    if (una.peligro) fila.peligro += 1;

    mapa.set(quien, fila);
  });

  return [...mapa.entries()]
    .map(([jugador, fila]) => ({ jugador, ...fila }))
    .sort((a, b) => b.total - a.total || b.peligro - a.peligro);
}

/**
 * La lectura de un aspecto en el partido, con la regla de muestra
 * (`muestraSuficiente`) y contra su propia tasa de la temporada (20/10/2026).
 *
 * Un gol siempre es veredicto. Sin muestra, se dice lo que pasó y, si la hay,
 * la tasa de la temporada para que se vea que es lo normal; nunca «salió
 * bien» ni «no salió». Con muestra, se compara con lo esperado.
 */
function lecturaCruce(lado: AbpLado, datos: CifrasPartido, medible: boolean, tasa: number | null = null) {
  if (!medible) return { lectura: "Ninguna hoja lo registra", tono: "neutro" as const };

  if (datos.acciones === 0) return { lectura: "No se dio en el partido", tono: "neutro" as const };

  const ofensivo = lado === "ofensivo";

  if (datos.goles > 0) {
    return ofensivo
      ? { lectura: `${plural(datos.goles, "gol", "goles")} a favor`, tono: "bien" as const }
      : { lectura: `${plural(datos.goles, "gol", "goles")} en contra`, tono: "mal" as const };
  }

  const visto = `${ofensivo ? "Peligro" : "Nos generaron peligro"} en ${datos.peligros} de ${datos.acciones}`;

  const deLaTemporada = tasa === null ? "" : ` (${dec(tasa * 100)} % en la temporada)`;

  if (!muestraSuficiente({ acciones: datos.acciones, casos: datos.peligros, tasa })) {
    if (datos.acciones < MINIMO_VEREDICTO) {
      return {
        lectura: datos.peligros > 0 ? `${visto}: pocas para concluir` : "Sin conclusión: pocas acciones",
        tono: "neutro" as const,
      };
    }

    return {
      lectura: `${datos.peligros > 0 ? visto : `Sin peligro en ${datos.acciones}`}: ${tasa === null ? "pocas para concluir" : `dentro de lo normal${deLaTemporada}`}`,
      tono: "neutro" as const,
    };
  }

  const frente = frenteALoEsperado(datos.acciones, datos.peligros, tasa);

  if (frente === "alto") {
    return { lectura: `${visto}, por encima de lo normal${deLaTemporada}`, tono: ofensivo ? ("bien" as const) : ("mal" as const) };
  }

  if (frente === "bajo") {
    return ofensivo
      ? { lectura: `${visto}, por debajo de lo normal${deLaTemporada}`, tono: "mal" as const }
      : { lectura: `Bien defendido: ${datos.peligros} de ${datos.acciones}, por debajo de lo normal${deLaTemporada}`, tono: "bien" as const };
  }

  /* Con muestra pero sin referencia, o en lo esperado: se dice, sin juicio. */
  return { lectura: `${visto}${frente === "normal" ? `: dentro de lo normal${deLaTemporada}` : ""}`, tono: "neutro" as const };
}

/**
 * El partido de la semana a balón parado, y el cruce con lo entrenado.
 *
 * El cruce va por aspecto y lado, con el mismo reconocimiento que la pantalla
 * (familia, tipo de envío, zona del saque). Entran los aspectos trabajados en
 * la semana —aparecieran o no— y, de los que NO se trabajaron, sólo los que
 * dieron peligro o gol: son los que hay que mirar para el siguiente micro.
 */
/** «90+1'» → 91: para casar una acción de la hoja con su corte. */
function minutoEnNumero(texto: string) {
  const m = String(texto ?? "").match(/(\d+)(?:\s*\+\s*(\d+))?/);

  return m ? Number(m[1]) + Number(m[2] ?? 0) : null;
}

/**
 * Una acción de peligro contada con lo que guarda la hoja (22/10/2026):
 * «49': falta lateral interior Z4, envío bombeado al segundo palo; remate
 * (ocasión), 0,12 goles esperados».
 */
function accionEnFrase(a: AccionAbp, corta = false) {
  const caida = a.zonaCaida && !/^no\b/i.test(a.zonaCaida) ? (/palo/i.test(a.zonaCaida) ? ` al ${a.zonaCaida.toLowerCase()}` : ` a la zona de ${a.zonaCaida.toLowerCase()}`) : "";

  const envio = a.envio ? `envío ${a.envio.toLowerCase()}${caida}` : caida.trim();

  const remate = a.remate ? `remate${a.zonaRemate && !/^no\b/i.test(a.zonaRemate) && a.zonaRemate.toLowerCase() !== a.zonaCaida.toLowerCase() ? ` en ${a.zonaRemate.toLowerCase()}` : ""}` : "";

  /* «Ocasión rival» en una acción que ya va «en contra» sobra: «ocasión». */
  const resultado = a.resultado.replace(/\s*rival\b/i, "").toLowerCase();

  const final = a.gol ? "gol" : resultado;

  const xg = a.xg > 0 ? `${dec(a.xg, 2)} goles esperados` : "";

  /* El tipo sobra en el saque de banda (ya lo dice el aspecto) y en la versión corta. */
  const tipo = corta || a.familia === "banda" ? "" : enMinusculaInicial(a.tipo || etiquetaFamilia(a.familia));

  /* Corta: «49': envío bombeado al segundo palo y remate (0,12 goles esperados)». */
  const cuerpo = corta
    ? `${[envio, remate].filter(Boolean).join(" y ")}${!remate && final && final !== "nada" ? `, ${final}` : ""}${a.gol ? " y gol" : ""}${xg ? ` (${xg})` : ""}`
    : [[tipo, envio].filter(Boolean).join(", "), remate ? `${remate}${final ? ` (${final})` : ""}` : final, xg].filter(Boolean).join("; ");

  return `${a.minuto ? `${a.minuto}: ` : ""}${cuerpo}`;
}

/**
 * El patrón de un aspecto en el partido anterior (23/10/2026): sus acciones
 * de peligro, desde dónde y adónde, si la hoja lo trae y se repite.
 * «las 2 contra el Antequera CF: desde Z4 interior, envío bombeado al segundo
 * palo». En defensa, con un palo claro, la consigna: «El segundo palo tiene
 * dueño antes del golpeo». `null` si no hay patrón que contar.
 */
function patronDe(acciones: AccionAbp[], aspecto: AspectoKey, lado: AbpLado, rival: string) {
  const suyas = acciones.filter((una) => ladoDe(una) === lado && encaja(una, aspecto) && una.peligro);

  if (suyas.length === 0) return null;

  /* Lo que más se repite de un campo; vacío si la hoja no lo trae o no hay mayoría. */
  const comun = (valor: (a: AccionAbp) => string) => {
    const cuenta = new Map<string, number>();

    suyas.forEach((a) => {
      const v = valor(a).trim();

      if (v && !/^no\b/i.test(v)) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
    });

    const [mejor, n] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];

    return n * 2 > suyas.length ? mejor : "";
  };

  const zona = comun((a) => {
    const m = a.tipo.match(/\b(interior|exterior)?\s*(Z\s?\d)\b/i);

    return m ? [m[2].replace(/\s/g, "").toUpperCase(), m[1]?.toLowerCase()].filter(Boolean).join(" ") : "";
  });

  const envio = comun((a) => a.envio.toLowerCase());
  const caida = comun((a) => a.zonaCaida.toLowerCase());

  if (!zona && !caida) return null;

  const destino = caida ? (/palo/.test(caida) ? ` al ${caida}` : ` a la zona de ${caida}`) : "";

  const como = [zona ? `desde ${zona}` : "", envio || destino ? `${envio ? `envío ${envio}` : "envío"}${destino}` : ""].filter(Boolean).join(", ");

  /* El verbo sale del desenlace (26/10/2026, análisis): un saque de banda que acabó en ocasión sin remate no «nos remató». */
  const una = suyas[0];

  const cuantas =
    suyas.length === 1
      ? lado === "defensivo"
        ? una.gol
          ? "la que nos marcaron"
          : una.remate
            ? "la que nos remataron"
            : "la que nos generó ocasión"
        : una.gol
          ? "la que marcamos"
          : una.remate
            ? "la que rematamos"
            : "la que nos dio ocasión"
      : `las ${suyas.length} con peligro`;

  const palo = caida.match(/(primer|segundo) palo/)?.[0] ?? "";

  return {
    patron: `${cuantas}${rival ? ` contra el ${rival}` : ""}: ${como}`,
    consigna: lado === "defensivo" && palo ? `El ${palo} tiene dueño antes del golpeo` : "",
  };
}

function enMinusculaInicial(texto: string) {
  return `${texto.charAt(0).toLowerCase()}${texto.slice(1)}`;
}

function partidoDelInforme(
  acciones: AccionAbp[],
  minutos: Map<string, number>,
  /** La tasa de peligro de la temporada por `claveAspecto` (0-1): la referencia de cada lectura. */
  tasas: Map<string, number> = new Map(),
  /** Los cortes del partido, para enlazar cada acción de peligro por su minuto. */
  clips: DatosInforme["clipsPartido"] = null,
): PartidoAbpInforme {
  const favor = acciones.filter((una) => ladoDe(una) === "ofensivo");
  const contra = acciones.filter((una) => ladoDe(una) === "defensivo");

  const familias = [...new Set(acciones.map((una) => una.familia))].sort(
    (a, b) =>
      (ORDEN_FAMILIA.indexOf(a) + 1 || 99) - (ORDEN_FAMILIA.indexOf(b) + 1 || 99),
  );

  const filas: FilaPartidoAbp[] = familias.flatMap((familia) =>
    (["ofensivo", "defensivo"] as AbpLado[]).flatMap((lado) => {
      const suyas = acciones.filter((una) => una.familia === familia && ladoDe(una) === lado);

      if (suyas.length === 0) return [];

      return [
        {
          familia,
          etiqueta: etiquetaFamilia(familia),
          lado,
          ...cifras(suyas),
          retenidos:
            familia === "banda" && lado === "ofensivo"
              ? suyas.filter((una) => una.retenido).length
              : null,
        },
      ];
    }),
  );

  const cruce: LineaCruce[] = [];

  ASPECTOS.forEach((aspecto) => {
    (["ofensivo", "defensivo"] as AbpLado[]).forEach((lado) => {
      const min = minutos.get(claveAspecto(aspecto.key, lado)) ?? 0;

      const medible = aspecto.reconocimiento !== null;

      const suyas = acciones.filter((una) => ladoDe(una) === lado && encaja(una, aspecto.key));

      const datos = cifras(suyas);

      const trabajado = min > 0;

      if (!trabajado && datos.peligros === 0 && datos.goles === 0) return;

      cruce.push({
        aspecto: aspecto.label,
        lado,
        minutos: min,
        trabajado,
        medible,
        ...datos,
        ...lecturaCruce(lado, datos, medible, tasas.get(claveAspecto(aspecto.key, lado)) ?? null),
      });
    });
  });

  /* Lo trabajado primero, por minutos; lo no trabajado detrás. */
  cruce.sort(
    (a, b) =>
      Number(b.trabajado) - Number(a.trabajado) || b.minutos - a.minutos || b.acciones - a.acciones,
  );

  const sinClasificar = acciones.filter(
    (una) => !ASPECTOS.some((aspecto) => encaja(una, aspecto.key)),
  ).length;

  const jornada = acciones[0]?.jornada.etiqueta ?? "";

  /*
  | Las acciones de peligro, una a una, con su corte (22/10/2026). El corte se
  | casa por el minuto (±1) y por el equipo; si no hay corte, la acción sale
  | igual, sin enlace.
  */
  const peligrosas = acciones
    .filter((una) => una.peligro || una.gol)
    .map((una) => {
      const lado = ladoDe(una);

      const n = minutoEnNumero(una.minuto);

      const de = lado === "defensivo" ? "rival" : "nosotros";

      const corte =
        n === null
          ? null
          : (clips ?? []).find((c) => c.de === de && c.url && !/^(robo|perdida|contra)$/.test(c.tipo) && Math.abs((minutoEnNumero(c.minuto) ?? -9) - n) <= 1);

      const aspecto = ASPECTOS.find((uno) => encaja(una, uno.key))?.label ?? etiquetaFamilia(una.familia);

      return { lado, aspecto, texto: accionEnFrase(una), corto: accionEnFrase(una, true), xg: una.xg || 0, clip: corte?.url ?? null, orden: n ?? 999 };
    })
    .sort((a, b) => a.orden - b.orden)
    .map((una) => ({ lado: una.lado, aspecto: una.aspecto, texto: una.texto, corto: una.corto, xg: una.xg, clip: una.clip }));

  return {
    jornada,
    peligrosas,
    favor: cifras(favor),
    contra: cifras(contra),
    filas,
    cruce,
    /* Los nombres sólo valen en lo nuestro: en las hojas de en contra el que
       remata es del rival. */
    rematadores: cuentaNombres(favor.filter((una) => una.remate), (una) => una.rematador),
    sacadores: cuentaNombres(favor, (una) => una.sacador),
    sinClasificar,
  };
}

/* ---------------- las claves ---------------- */

/** Un texto largo, cortado por una palabra y con puntos suspensivos. */
function recorta(texto: string, tope = 170) {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();

  if (limpio.length <= tope) return limpio;

  const corte = limpio.slice(0, tope);

  return `${corte.slice(0, Math.max(corte.lastIndexOf(" "), tope - 20)).replace(/[\s,;.:]+$/, "")}…`;
}

/**
 * Una frase corta SIN cortarla a media palabra (20/10/2026): «2 goles
 * encajad…» se leía como un error. Primero se quitan los paréntesis; si
 * todavía no cabe, se queda la frase hasta el último signo (coma, punto y
 * coma, dos puntos, «·») que quepa. Si ninguno cabe, va entera: mejor una
 * línea larga que una rota.
 */
function breve(texto: string, tope = 90) {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();

  if (limpio.length <= tope) return limpio;

  const sinParentesis = limpio.replace(/\s*\([^()]*\)/g, "").replace(/\s+([,.;:])/g, "$1").trim();

  if (sinParentesis.length <= tope) return sinParentesis;

  const trozo = sinParentesis.slice(0, tope + 1);

  const corte = Math.max(trozo.lastIndexOf(", "), trozo.lastIndexOf("; "), trozo.lastIndexOf(": "), trozo.lastIndexOf(" · "));

  return corte > tope * 0.45 ? sinParentesis.slice(0, corte).trim() : sinParentesis;
}

function fraseLista(trozos: string[]) {
  if (trozos.length <= 1) return trozos.join("");

  return `${trozos.slice(0, -1).join(", ")} y ${trozos[trozos.length - 1]}`;
}

/** Un día del plan con lo que lleva, para decir «planificado» sin minutos. */
type DiaPlanificado = { dia: string; aspectos: string[]; lados: Set<AbpLado> };

/** «el viernes, córner directo y falta lateral directa (defensivo)». */
function fraseDia(uno: DiaPlanificado) {
  const lado = uno.lados.size === 1 ? ` (${LADO_LABEL[[...uno.lados][0]].toLowerCase()})` : "";

  return `${uno.dia.toLowerCase()}, ${fraseLista(uno.aspectos.slice(0, 2).map((a) => a.toLowerCase()))}${uno.aspectos.length > 2 ? " y más" : ""}${lado}`;
}


/**
 * Cuántas acciones hay detrás de una métrica de Wyscout (por partido × partidos).
 *
 * Los porcentajes se leen sobre su base —«faltas con remate %» sobre las faltas
 * lanzadas—; los penaltis, sobre ellos mismos. Con pocas acciones el puesto en
 * la categoría es ruido: 4 penaltis en 8 partidos no hacen «lo mejor» de nadie.
 */
const BASE_MEDIDA: Record<string, string> = {
  cornersRemate: "corners",
  faltasRemate: "faltasTiro",
  abpRemate: "abp",
};

/** Por debajo de esto, una métrica de la categoría no sale en las claves. */
const MINIMO_BASE_CATEGORIA = 20;

function baseDeMedida(comparativa: ComparativaInforme, key: string, lado: "favor" | "contra") {
  const fila = comparativa.filas.find((una) => una.key === (BASE_MEDIDA[key] ?? key));

  const porPartido = fila ? fila[lado] : null;

  return porPartido === null ? null : porPartido * comparativa.jugados;
}

/**
 * Cómo se dice cada métrica en la frase de lo mejor y lo peor (22/10/2026):
 * «faltas que concedemos», no «faltas lanzadas en contra».
 */
const METRICA_EN_FRASE: Record<string, { favor?: string; contra?: string }> = {
  corners: { favor: "córners a favor", contra: "córners que concedemos" },
  cornersRemate: { favor: "córners que acaban en remate", contra: "córners que nos rematan" },
  faltasTiro: { contra: "faltas que concedemos" },
  faltasRemate: { favor: "faltas que acaban en remate", contra: "faltas que nos rematan" },
  abp: { contra: "balón parado que concedemos" },
  abpRemate: { favor: "balón parado que acaba en remate", contra: "balón parado que nos rematan" },
  penaltis: { favor: "penaltis a favor", contra: "penaltis en contra" },
};

/**
 * Lo mejor y lo peor contra la categoría (22/10/2026), con sentido y con muestra:
 *
 * - Entran las métricas en las que el sentido es claro: las «altas» por los
 *   dos lados y, de las neutras, sólo lo que concedemos (menos es mejor:
 *   faltas y balón parado en contra). Lo que ya se ha conciliado arriba, no.
 * - Un porcentaje necesita `MINIMO_BASE_CATEGORIA` acciones detrás. Un
 *   recuento por partido, que su diferencia con la mediana no sea ruido:
 *   1,5 desviaciones de Poisson sobre la temporada. Así «1,1 faltas
 *   concedidas por partido (1.º)» entra —9 frente a 18— y «0,50 penaltis
 *   (1.º)» no —4 frente a 2—.
 */
function loMejorYLoPeor(comparativa: ComparativaInforme, choque: { key: string; lado: "favor" | "contra" } | null) {
  type Puesto = { texto: string; valor: string; puesto: number };

  const J = comparativa.jugados;
  const n = comparativa.equipos;

  const esRecuento = (key: string) => !/Remate$/.test(key);

  const conMuestra = (key: string, lado: "favor" | "contra", valor: number, mediana: number) =>
    esRecuento(key)
      ? mediana > 0 && J > 0 && (Math.abs(valor - mediana) * J) / Math.sqrt(mediana * J) >= 1.5
      : (baseDeMedida(comparativa, key, lado) ?? 0) >= MINIMO_BASE_CATEGORIA;

  const puestos: Puesto[] = comparativa.filas.flatMap((fila) =>
    (["favor", "contra"] as const).flatMap((lado) => {
      const texto = METRICA_EN_FRASE[fila.key]?.[lado];
      const valor = fila[lado];
      const puesto = lado === "favor" ? fila.puestoFavor : fila.puestoContra;
      const mediana = lado === "favor" ? fila.medianaFavor : fila.medianaContra;

      if (!texto || valor === null || !puesto) return [];
      if (choque && choque.key === fila.key && choque.lado === lado) return [];
      if (!conMuestra(fila.key, lado, valor, mediana)) return [];

      return [{ texto, valor: `${fmtMedida(valor, fila.key)}${esRecuento(fila.key) ? " por partido" : ""}`, puesto }];
    }),
  );

  const mejor = [...puestos].sort((a, b) => a.puesto - b.puesto)[0];
  const peor = [...puestos].sort((a, b) => b.puesto - a.puesto)[0];

  return {
    mejor: mejor && mejor.puesto <= Math.ceil(n / 3) ? mejor : null,
    peor: peor && peor !== mejor && peor.puesto > n - Math.ceil(n / 3) ? peor : null,
  };
}

/**
 * SU BALÓN PARADO (19/10/2026): lo que Wyscout mide del rival de la semana,
 * con su puesto en la categoría. Sale de la misma comparativa que «Cómo
 * estamos contra la categoría», así que no pide nada más. Si el rival no está
 * en la categoría (o no hay comparativa), no sale.
 *
 * Los puestos van como en el resto del informe: atacando, el 1.º es el que más
 * hace; defendiendo, el que menos concede.
 */
function rivalAbpDe(comparativa: ComparativaAbp | null, rival: string): RivalAbpInforme | null {
  if (!comparativa?.liga.length || !rival) return null;

  const suya = comparativa.liga.filter((fila) => mismoRival(fila.equipo, rival));

  /* Con dos candidatos no se elige: mejor no decir nada que hablar de otro equipo. */
  if (suya.length !== 1) return null;

  const fila = suya[0];

  const n = comparativa.liga.length;

  const medianaDe = (valores: number[]) => {
    const orden = [...valores].sort((a, b) => a - b);
    const medio = Math.floor(orden.length / 2);

    return orden.length === 0 ? 0 : orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
  };

  const filas = (comparativa.medidas ?? []).map((medida) => {
    const valoresDe = (lado: "favor" | "contra") =>
      comparativa.liga.map((una) => una.valores?.[medida.key]?.[lado]).filter((uno): uno is number => typeof uno === "number");

    const puesto = (valor: number | null, todos: number[], menosEsMejor: boolean) => {
      if (valor === null) return null;

      const orden = [...todos].sort((a, b) => (menosEsMejor ? a - b : b - a));
      const sitio = orden.findIndex((uno) => Math.abs(uno - valor) < 1e-9);

      return sitio < 0 ? null : sitio + 1;
    };

    const favor = fila.valores?.[medida.key]?.favor ?? null;
    const contra = fila.valores?.[medida.key]?.contra ?? null;

    return {
      rotulo: medida.rotulo,
      key: medida.key,
      favor,
      puestoFavor: puesto(favor, valoresDe("favor"), false),
      medianaFavor: medianaDe(valoresDe("favor")),
      contra,
      puestoContra: puesto(contra, valoresDe("contra"), true),
      medianaContra: medianaDe(valoresDe("contra")),
    };
  });

  const de = (key: string) => filas.find((una) => una.key === key);

  const trozo = (key: string, lado: "favor" | "contra", texto: (valor: string) => string) => {
    const una = de(key);
    const valor = una?.[lado];
    const sitio = lado === "favor" ? una?.puestoFavor : una?.puestoContra;

    if (!una || valor === null || valor === undefined || !Number.isFinite(valor)) return "";

    return `${texto(fmtMedida(valor, key))}${sitio ? ` (${sitio}.º de ${n})` : ""}`;
  };

  const ataca = [
    trozo("corners", "favor", (v) => `sacan ${v} córners por partido`),
    trozo("cornersRemate", "favor", (v) => `rematan el ${v} de sus córners`),
    trozo("abpRemate", "favor", (v) => `el ${v} de su balón parado acaba en remate`),
  ].filter(Boolean);

  const defiende = [
    trozo("corners", "contra", (v) => `conceden ${v} córners por partido`),
    trozo("cornersRemate", "contra", (v) => `les rematan el ${v}`),
  ].filter(Boolean);

  const lineas = [
    ataca.length ? `Atacando, ${fraseLista(ataca)}.` : "",
    defiende.length ? `Defendiendo, ${fraseLista(defiende)} (aquí el 1.º es el que menos concede).` : "",
  ].filter(Boolean);

  if (!lineas.length) return null;

  return {
    equipo: fila.equipo,
    equipos: n,
    filas: filas.filter((una) => una.favor !== null || una.contra !== null),
    lineas,
  };
}

/**
 * Las claves de la previa: qué toca, por qué y qué está planificado.
 *
 * Cada frase sale de un dato que el informe trae más abajo; aquí sólo se
 * elige lo que importa y se dice en una línea. Si un dato falta, su frase no
 * sale: mejor tres claves ciertas que cinco con relleno.
 *
 * Desde el 19/10/2026, con la semana sin un minuto (`sinMinutos`) no se habla
 * de minutos ni de «sin trabajar»: el lunes eso no es un dato, es que la
 * semana no ha empezado. Se dice lo planificado.
 */
function clavesPrevia(
  datos: DatosInforme,
  prioridades: LineaEquipo[],
  porAspecto: TiempoSemana["porAspecto"],
  comparativa: ComparativaInforme | null,
  sinMinutos: boolean,
  planificado: DiaPlanificado[],
) {
  const claves: string[] = [];

  const conRemate = prioridades.filter((una) => !una.esBanda);
  const banda = prioridades.find((una) => una.esBanda);

  const primera = conRemate[0] ?? banda;

  /*
  | Una cifra, una función (20/10/2026): la base de la prioridad nº 1 ya va en
  | el titular y en su ficha. Aquí, de dónde sale (nuestras hojas) y si está
  | en el plan, sin repetir el número.
  */
  if (primera) {
    const estado = sinMinutos
      ? primera.planificado
        ? "está en el plan de la semana"
        : "no figura en el plan de la semana"
      : primera.minSemana > 0
        ? `esta semana se le han dado ${fmtLargo(primera.minSemana)}`
        : "esta semana no se ha trabajado";

    claves.push(`${consignaDe(primera.aspecto, primera.lado)} (prioridad nº 1 en nuestras hojas): ${estado}.`);

    /* El patrón del último partido, como consigna (23/10/2026). */
    if (primera.patron) claves.push(`${mayuscula(primera.patron)}.${primera.consignaPatron ? ` ${primera.consignaPatron}.` : ""}`);

    /* Con pocos peligros detrás, se dice (22/10/2026): es un aviso reciente, y se trabaja igual. */
    if (primera.tendencia) claves.push(`${primera.tendencia}.`);
  }

  /* Si Wyscout dice otra cosa de ese mismo aspecto, se concilia en una frase. */
  const choque = primera && comparativa ? choqueConWyscout(primera, comparativa) : null;

  if (choque) claves.push(choque.frase);

  /* El rival de la semana, cruzado con nuestras prioridades: qué sube y qué baja. */
  const rivalNombre = datos.partidoCalendario?.rival || datos.rival;

  const cruzadas = prioridades.filter((una) => una.sentidoRival && una.contraRival).slice(0, 2);

  /* Una decisión por frase (22/10/2026): «sube… porque…; baja… porque…» llevaba seis cifras de un tirón. */
  if (rivalNombre) {
    cruzadas.forEach((una) =>
      claves.push(`${mayuscula(conArticulo(una.aspecto))} ${ladoConcordado(una.aspecto, una.lado)} pesa ${una.sentidoRival === "sube" ? "más" : "menos"} contra ellos: ${una.contraRival}.`),
    );
  }

  if (banda && banda !== primera) {
    claves.push(
      `Saques de banda, aparte: ${conArticulo(banda.aspecto)} ${ladoConcordado(banda.aspecto, banda.lado)}, ${banda.base} con peligro${banda.lado === "defensivo" ? " en contra" : ""}.`,
    );
  }

  if (sinMinutos) {
    /* Si la nº 1 ya dice «está en el plan», el plan día a día lo dicen lo esencial y su tabla (22/10/2026): deja sitio a la categoría. */
    if (planificado.length && !primera?.planificado) {
      claves.push(`Planificado para la semana: ${planificado.map(fraseDia).join("; ")}.`);
    }
  } else {
    const olvidadas = conRemate
      .slice(1)
      .filter((fila) => fila.minSemana === 0)
      .map((fila) => aspectoEnFrase(fila.aspecto, fila.lado));

    if (olvidadas.length) {
      claves.push(`De las prioridades de la temporada, sin trabajar esta semana: ${fraseLista(olvidadas)}.`);
    }

    const total = porAspecto.reduce((s, una) => s + una.ofensivo + una.defensivo, 0);

    if (total > 0) {
      const arriba = porAspecto.slice(0, 2).filter((una) => una.ofensivo + una.defensivo > 0);

      claves.push(
        `El grueso de la semana: ${fraseLista(
          arriba.map(
            (una) =>
              `${una.etiqueta} (${fmtMin(una.ofensivo + una.defensivo)}, ${
                una.ofensivo >= una.defensivo ? "sobre todo ofensivo" : "sobre todo defensivo"
              })`,
          ),
        )}, ${dec(((arriba.reduce((s, una) => s + una.ofensivo + una.defensivo, 0)) / total) * 100, 0)} % del tiempo de ABP.`,
      );
    }
  }

  const conclusion = datos.rivalAnalisis?.conclusiones.find((una) => una.texto.trim());

  if (conclusion && datos.rivalAnalisis) {
    claves.push(
      `Del ${datos.rivalAnalisis.equipo}, a vigilar en «${conclusion.seccion}»: ${recorta(conclusion.texto)}`,
    );
  }

  if (comparativa) {
    const { mejor, peor } = loMejorYLoPeor(comparativa, choque);

    const n = comparativa.equipos;

    const trozos: string[] = [];

    if (mejor) trozos.push(`Lo mejor: ${mejor.texto}, ${mejor.valor} (${mejor.puesto}.º de ${n})`);
    if (peor) trozos.push(`lo peor: ${peor.texto}, ${peor.valor} (${peor.puesto}.º de ${n})`);

    if (trozos.length) claves.push(`Contra la categoría, en Wyscout. ${trozos.join("; ")}.`);
  }

  return claves.slice(0, 6);
}

/**
 * Cuando la prioridad nº 1 (nuestras hojas) y Wyscout dicen cosas distintas
 * del mismo aspecto (20/10/2026): el córner defensivo salía prioridad con
 * 4 de 27 y, dos tablas más abajo, Wyscout nos ponía 6.º de 20 defendiendo
 * córners. No es una contradicción —miden cosas distintas—, pero hay que
 * decirlo en una frase para que no se lea como tal.
 */
function choqueConWyscout(primera: LineaEquipo, comparativa: ComparativaInforme) {
  const medida = WYSCOUT_FAMILIA[primera.familia];

  if (!medida) return null;

  const key = medida.remate ?? medida.volumen;

  if (!key) return null;

  const fila = comparativa.filas.find((una) => una.key === key);

  const lado = primera.lado === "defensivo" ? ("contra" as const) : ("favor" as const);

  const valor = fila?.[lado] ?? null;
  const puesto = lado === "contra" ? fila?.puestoContra : fila?.puestoFavor;

  const n = comparativa.equipos;

  /* Sólo si Wyscout nos deja en la mitad buena: si también sale mal, no hay nada que conciliar. */
  if (!fila || valor === null || !puesto || puesto > n / 2) return null;

  const enContra = primera.lado === "defensivo";

  const porQue = primera.goles
    ? `la prioridad la marcan los ${plural(primera.goles, enContra ? "gol encajado" : "gol", enContra ? "goles encajados" : "goles")}`
    : "la prioridad sale de lo que registran nuestras hojas";

  const rotulo = fila.rotulo.replace(/\s*%$/, "");

  return {
    key,
    lado,
    frase: `En Wyscout, en cambio, estamos en la mitad buena: ${rotulo.charAt(0).toLowerCase()}${rotulo.slice(1)} ${enContra ? "en contra" : "a favor"}, ${fmtMedida(valor, key)} (${puesto}.º de ${n}); ${porQue}.`,
  };
}

/**
 * Lo que da para titular en el post (20/10/2026): un gol, o un veredicto con
 * muestra (`muestraSuficiente`, ya aplicado en `tono`). «2 de 2» no es un
 * titular aunque fuera lo que más peligro dio: la tabla de debajo dice
 * «pocas para concluir» y el titular no puede decir lo contrario.
 */
function conVeredicto(una: LineaCruce) {
  if (!una.medible || una.acciones === 0) return false;

  if (una.goles > 0) return true;

  return una.lado === "defensivo" ? una.tono === "mal" : una.tono === "bien";
}

function loQueMasPeligroDio(partido: PartidoAbpInforme) {
  return partido.cruce
    .filter(conVeredicto)
    .sort(
      (a, b) =>
        b.goles - a.goles ||
        b.peligros - a.peligros ||
        b.peligros / b.acciones - a.peligros / a.acciones ||
        /* A igualdad, lo que nos hicieron: es lo que hay que corregir. */
        Number(b.lado === "defensivo") - Number(a.lado === "defensivo"),
    )[0];
}

/** El aspecto en minúsculas con el artículo: «la falta lateral directa», «los penaltis». */
function conArticulo(aspecto: string) {
  const a = `${aspecto.charAt(0).toLowerCase()}${aspecto.slice(1)}`;

  if (/^penaltis\b/.test(a)) return `los ${a}`;
  if (/^falta\b/.test(a)) return `la ${a}`;

  return `el ${a}`;
}

/** La primera letra en minúscula: para meter una lectura dentro de una frase. */
function enMinuscula(texto: string) {
  return `${texto.charAt(0).toLowerCase()}${texto.slice(1)}`;
}

/**
 * Cuántos goles del partido fueron a balón parado, sobre el total
 * (20/10/2026): «A balón parado: 0 de 3 a favor y 0 de 2 en contra» no se
 * entendía.
 */
function golesAbpEnFrase(marcador: { favor: number; contra: number }, favor: number, contra: number) {
  const total = marcador.favor + marcador.contra;

  const abp = favor + contra;

  if (total === 0) return "Sin goles en el partido";

  if (abp === 0) return total === 1 ? "El único gol del partido no fue a balón parado" : `Ninguno de los ${total} goles fue a balón parado`;

  const reparto = favor && contra ? ` (${favor} a favor y ${contra} en contra)` : favor ? " (a favor)" : " (en contra)";

  return abp === 1 ? `Uno de los ${total} goles fue a balón parado${reparto}` : `${abp} de los ${total} goles fueron a balón parado${reparto}`;
}

/**
 * El titular del post (20/10/2026): lo que más pesó con veredicto —un gol o
 * algo con muestra—, con sus minutos de la semana. Si nada da para veredicto,
 * el balance del partido a balón parado con lo que más se vio, sin juzgarlo.
 */
/**
 * ¿La semana se fue al ataque y el daño llegó en defensa? (24/10/2026,
 * guionista): es la historia del post, mejor que tres cifras en una frase.
 */
function ataqueYDanoEnContra(partido: PartidoAbpInforme, porLado: { ofensivo: number; defensivo: number } | null) {
  const susto = sustoDelPartido(partido);

  /* «El daño llegó en…» sólo con muestra (25/10/2026, ronda 7): 2 de 2 con 0,16 goles esperados no es daño, es tendencia. */
  return susto && sustoConMuestra(susto) && porLado && porLado.ofensivo >= 3 * Math.max(porLado.defensivo, 1) ? susto : null;
}

/** El peligro en contra del partido pasa la regla de muestra del informe (`muestraSuficiente`). */
function sustoConMuestra(susto: LineaCruce) {
  return susto.goles > 0 || muestraSuficiente({ acciones: susto.acciones, casos: susto.peligros });
}

function titularPost(partido: PartidoAbpInforme, porLado: { ofensivo: number; defensivo: number } | null = null) {
  const historia = loQueMasPeligroDio(partido) ? null : ataqueYDanoEnContra(partido, porLado);

  if (historia) {
    const donde = `${conArticulo(historia.aspecto)} en contra`;

    return laQueCabe([`Entrenamos sobre todo el ataque y el daño llegó en ${donde}`, `Entrenamos el ataque y el daño llegó en ${donde.replace(/^((?:el|la|los) \S+ \S+) \S+ en contra$/, "$1 en contra")}`], 80);
  }

  const top = loQueMasPeligroDio(partido);

  const total = partido.favor.acciones + partido.contra.acciones;

  if (top) {
    const trabajo = top.minutos > 0 ? `${fmtLargo(top.minutos)} de trabajo en la semana` : "ningún minuto de trabajo en la semana";

    const quien = `${conArticulo(top.aspecto)} ${top.lado === "ofensivo" ? "a favor" : "en contra"}`;

    if (top.goles > 0) {
      return top.lado === "ofensivo"
        ? `Marcamos con ${quien} (${plural(top.goles, "gol", "goles")}): ${trabajo}`
        : `Nos marcaron con ${quien} (${plural(top.goles, "gol", "goles")}): ${trabajo}`;
    }

    return top.lado === "ofensivo"
      ? `Lo que mejor salió, ${quien}: ${enMinuscula(top.lectura)}`
      : `Lo que más daño nos hizo, ${quien}: ${enMinuscula(top.lectura)}`;
  }

  if (!total) return "";

  const base = partido.marcador
    ? golesAbpEnFrase(partido.marcador, partido.favor.goles, partido.contra.goles)
    : `${total} acciones a balón parado y ${plural(partido.favor.goles + partido.contra.goles, "gol", "goles")}`;

  /* Lo que más se vio, dicho como hecho y no como diagnóstico. */
  const susto = partido.cruce
    .filter((una) => una.medible && una.lado === "defensivo" && una.peligros >= 2)
    .sort((a, b) => b.peligros - a.peligros)[0];

  const remates = `${plural(partido.favor.remates, "remate", "remates")} a favor y ${partido.contra.remates} en contra`;

  const sinGoles = partido.favor.goles + partido.contra.goles === 0;

  /* En afirmativo (23/10/2026): «Cero goles a balón parado», no «Ningún gol…». */
  const ceroGoles = partido.marcador && sinGoles ? `Cero goles a balón parado en el ${partido.marcador.favor}-${partido.marcador.contra}` : base;

  if (!susto) return laQueCabe([`${ceroGoles}: ${remates}`, `${base}: ${remates}`], 80);

  /*
  | Sin muestra, tendencia (25/10/2026, ronda 7): «2 de 2» no titula un
  | diagnóstico. Se dice el balance y lo que se vigila, sin venderlo.
  */
  if (!sustoConMuestra(susto)) {
    const vigila = `${aspectoCorto(susto.aspecto)} en contra`;

    const cuenta = susto.remates >= susto.peligros ? `${plural(susto.remates, "remate", "remates")} en ${susto.acciones}` : `peligro en ${susto.peligros} de ${susto.acciones}`;

    return laQueCabe([`${ceroGoles}; a vigilar: ${vigila} (${cuenta})`, `${ceroGoles}; a vigilar: ${vigila}`, `${base}; a vigilar: ${vigila}`], 80);
  }

  /*
  | Una idea, lo que toca corregir (23/10/2026, equipo de expertos): el
  | aspecto, lo que nos hicieron y cuánto se le dio. «Ningún gol a balón
  | parado; en la falta lateral…» empezaba por una negación y metía dos
  | ideas; los cero goles van en las claves.
  */
  const quien = mayuscula(`${conArticulo(susto.aspecto)} en contra`);
  const quienCorto = quien.replace(/^((?:El|La|Los) \S+ \S+) \S+ en contra$/, "$1 en contra");

  const hecho = susto.remates >= susto.peligros ? `nos remataron ${susto.remates} de ${susto.acciones}` : `nos crearon peligro en ${susto.peligros} de ${susto.acciones}`;

  /* Una cifra de trabajo, no una cuenta (24/10/2026, marketing): «… y la trabajamos 2 min», sin «de 1 h 20 min». */
  const trabajo = susto.minutos > 0 ? ` y la trabajamos ${fmtLargo(susto.minutos)}` : " sin trabajarla en la semana";

  return laQueCabe([`${quien}: ${hecho}${trabajo}`, `${quienCorto}: ${hecho}${trabajo}`, `${quienCorto}: ${hecho}`], 80);
}

/**
 * Lo que toca el próximo microciclo según el partido (20/10/2026): lo que nos
 * marcaron o lo que salió mal con muestra; primero lo que no se trabajó.
 */
function candidatosDelPartido(partido: PartidoAbpInforme) {
  return partido.cruce
    .filter((una) => una.medible && una.acciones > 0 && (una.goles > 0 && una.lado === "defensivo" || una.tono === "mal"))
    .sort((a, b) => Number(a.trabajado) - Number(b.trabajado) || b.goles - a.goles || b.peligros - a.peligros);
}

/**
 * Las claves del post: qué pasó a balón parado y si lo trabajado apareció.
 *
 * Desde el 20/10/2026, en este orden: los goles sobre el total, lo que no
 * salió, lo que salió, lo que toca el próximo microciclo y, al final, la
 * cuenta de lo trabajado. Sólo se juzga con muestra (`muestraSuficiente`) o
 * con goles: lo demás se lee en la tabla.
 */
function clavesPost(partido: PartidoAbpInforme, minutosSemana = 0) {
  const claves: string[] = [];

  const { favor, contra } = partido;

  if (partido.marcador) {
    claves.push(
      `El partido acabó ${partido.marcador.favor}-${partido.marcador.contra}: ${enMinuscula(golesAbpEnFrase(partido.marcador, favor.goles, contra.goles))}.`,
    );
  }

  const trabajadas = partido.cruce.filter((una) => una.trabajado && una.medible);

  const aparecieron = trabajadas.filter((una) => una.acciones > 0);

  const cita = (una: LineaCruce) => `${aspectoEnFrase(una.aspecto, una.lado)} (${enMinuscula(una.lectura)})`;

  const buenas = aparecieron.filter((una) => una.tono === "bien");
  const malas = aparecieron.filter((una) => una.tono === "mal");

  if (malas.length) claves.push(`No salió: ${fraseLista(malas.slice(0, 2).map(cita))}.`);

  if (buenas.length) claves.push(`Salió bien: ${fraseLista(buenas.slice(0, 2).map(cita))}.`);

  const candidatos = candidatosDelPartido(partido).filter((una) => !una.trabajado);

  if (candidatos.length) {
    claves.push(`Para el próximo microciclo, porque no se trabajó: ${fraseLista(candidatos.slice(0, 2).map(cita))}.`);
  }

  const productivas = partido.cruce.filter(
    (una) => !una.trabajado && una.lado === "ofensivo" && una.goles > 0,
  );

  if (productivas.length) {
    claves.push(
      `Marcamos en algo que no se trabajó esta semana: ${fraseLista(productivas.map((una) => aspectoEnFrase(una.aspecto, una.lado)))}.`,
    );
  }

  /* Lo que nos remataron sin veredicto (pocas acciones), con lo que se le dio en la semana: es la causa. */
  const susto = sustoDelPartido(partido);

  if (susto && !malas.includes(susto)) {
    claves.push(
      `${mayuscula(conArticulo(susto.aspecto))} en contra: ${danoEnFrase(susto)}; ${susto.minutos > 0 ? `le dimos ${fmtLargo(susto.minutos)}${minutosSemana > susto.minutos ? ` de ${fmtLargo(minutosSemana)}` : ""} en la semana` : "no se trabajó en la semana"}.`,
    );
  }

  const reparto = repartoDelPartido(partido);

  if (reparto) claves.push(`${reparto}.`);

  return claves.slice(0, 5);
}

/** Lo que más peligro nos generó en contra, sin gol: dos o más acciones con peligro. */
function sustoDelPartido(partido: PartidoAbpInforme) {
  return partido.cruce
    .filter((una) => una.medible && una.lado === "defensivo" && una.peligros >= 2 && una.goles === 0)
    .sort((a, b) => b.peligros - a.peligros)[0];
}

/**
 * El partido a balón parado sin mezclar (22/10/2026): lo que puede acabar en
 * remate (córner, falta, penalti) aparte de los saques de banda. Los totales
 * juntos daban «15 % en contra» con 2 faltas y un saque.
 */
function repartoDelPartido(partido: PartidoAbpInforme) {
  /* Tres grupos (26/10/2026, análisis): córner y falta, saques de banda y penaltis, cada uno con su cuenta. */
  const grupo = (familia: string) => (familia === "banda" ? "banda" : familia === "penalti" ? "penalti" : "remate");

  const suma = (lado: AbpLado, cual: string) =>
    partido.filas
      .filter((f) => f.lado === lado && grupo(f.familia) === cual)
      .reduce((s, f) => ({ acciones: s.acciones + f.acciones, peligros: s.peligros + f.peligros }), { acciones: 0, peligros: 0 });

  const remateF = suma("ofensivo", "remate");
  const remateC = suma("defensivo", "remate");
  const bandaF = suma("ofensivo", "banda");
  const bandaC = suma("defensivo", "banda");
  const penaltiF = suma("ofensivo", "penalti");
  const penaltiC = suma("defensivo", "penalti");

  const trozos = [
    remateF.acciones + remateC.acciones
      ? `En córners y faltas, peligro en ${remateF.peligros} de ${remateF.acciones} a favor y ${remateC.peligros} de ${remateC.acciones} en contra`
      : "",
    bandaF.acciones + bandaC.acciones ? `saques de banda, ${bandaF.peligros} de ${bandaF.acciones} y ${bandaC.peligros} de ${bandaC.acciones}` : "",
    penaltiF.acciones + penaltiC.acciones ? `penaltis, ${penaltiF.acciones} a favor y ${penaltiC.acciones} en contra` : "",
  ].filter(Boolean);

  return trozos.length ? mayuscula(trozos.join("; ")) : "";
}


/**
 * Reúne el informe.
 *
 * Nada de lo que hay aquí pide datos: lo que no llegue, no sale, y se dice en
 * `avisos` para que quien lo lea sepa que falta y no que no ha pasado.
 */
export function construyeInforme(datos: DatosInforme): InformeMicro {
  const generado = datos.generado ?? new Date();

  const modo: ModoInforme = datos.modo ?? "previa";

  const esPost = modo === "post";

  const avisos: string[] = [];

  /*
  | ---------------- los minutos que cuentan (19/10/2026) ----------------
  | Una sola cuenta para todo el informe, la diapositiva del partido y el
  | vídeo: lo planificado menos lo que el boceto propuso y nadie confirmó.
  */
  const minutos = minutosAbp(datos.entradas, datos.tareas);

  const propuestas = new Set(minutos.propuestas.map(({ trabajo }) => trabajo));

  /* La previa de una semana que todavía no tiene ni un minuto: sólo lo planificado. */
  const sinMinutos = !esPost && minutos.confirmados === 0;

  if (minutos.propuestas.length) {
    avisos.push(
      `${minutos.propuestas.length === 1 ? "Una tarea del boceto" : `${minutos.propuestas.length} tareas del boceto`} (${fmtMin(minutos.propuestos)}) ${minutos.propuestas.length === 1 ? "sigue" : "siguen"} como propuesta y no ${minutos.propuestas.length === 1 ? "suma" : "suman"} minutos: confírmala${minutos.propuestas.length === 1 ? "" : "s"} quitando «Boceto ·» de la nota en el microciclo, o apúntala${minutos.propuestas.length === 1 ? "" : "s"} en la hoja de registro ese día.`,
    );
  }

  /* ---------------- la semana, día a día ---------------- */

  const trabajos: LineaTrabajo[] = datos.entradas.map(({ dia, trabajo }) => {
    const limpio = normalizaTrabajo(trabajo);

    const propuesta = propuestas.has(trabajo);

    return {
      dia: DIA_LABEL.get(dia) ?? dia,
      aspectos: listaAspectos(limpio),
      lados: limpio.lados.map((lado) => LADO_LABEL[lado]).join(" + "),
      momento: MOMENTO_LABEL[limpio.momento],
      medio: MEDIO_LABEL[limpio.medio],
      roles: limpio.roles.map((rol) => ROL_LABEL[rol]).join(", "),
      /* Sin minutos todavía, la casilla va vacía: «0'» no es un dato (19/10/2026). */
      minutos: limpio.minutos ? fmtMin(limpio.minutos) : "",
      carga: Math.round(cargaCondicional(limpio)),
      cargaCog: Math.round(cargaCognitiva(limpio)),
      medida: cargaEsReal(limpio),
      /* El motivo del boceto es largo y técnico: en el informe basta con decir qué es. */
      /* Las notas del boceto son del analista, no del cuerpo técnico (25/10/2026): fuera del informe. */
      notas: propuesta || esPropuestaDelBoceto(limpio) ? "" : String(limpio.notas ?? "").trim(),
      propuesta,
      min: limpio.minutos || 0,
    };
  });

  /* Lo planificado por día —con minutos o sin ellos—, para la previa del lunes. */
  const planificadoPorDia = new Map<string, DiaPlanificado>();

  datos.entradas.forEach(({ dia, trabajo }) => {
    const limpio = normalizaTrabajo(trabajo);

    const etiqueta = DIA_LABEL.get(dia) ?? dia;

    const uno = planificadoPorDia.get(etiqueta) ?? { dia: etiqueta, aspectos: [], lados: new Set<AbpLado>() };

    limpio.aspectos.forEach((clave) => {
      const nombre = ASPECTO_LABEL.get(clave) ?? clave;

      if (!uno.aspectos.includes(nombre)) uno.aspectos.push(nombre);
    });

    limpio.lados.forEach((lado) => uno.lados.add(lado));

    planificadoPorDia.set(etiqueta, uno);
  });

  const planificado = [...planificadoPorDia.values()];

  const clavesPlanificadas = new Set(
    datos.entradas.flatMap(({ trabajo }) => {
      const limpio = normalizaTrabajo(trabajo);

      return limpio.aspectos.flatMap((aspecto) => limpio.lados.map((lado) => claveAspecto(aspecto, lado)));
    }),
  );

  const semanaAspectos = { minutos: minutos.porAspecto, planificado: clavesPlanificadas };

  if (trabajos.length === 0) {
    avisos.push(
      "Este microciclo no tiene ningún trabajo de balón parado planificado.",
    );
  }

  /* ---------------- el rango de fechas ---------------- */

  /*
  | Las fechas de la semana salen, por orden, de:
  |
  | 1. La ventana del microciclo —de partido a partido, con el calendario—, que
  |    la pantalla ya conoce. Hasta el 27/09/2026 no se miraba, y en cuanto la
  |    hoja de registro venía sin fechas el informe decía no saberlas cuando
  |    la cabecera de la propia pantalla las estaba enseñando.
  | 2. Las tareas de la hoja de registro, si la ventana no llega.
  */
  const fechasVentana = (datos.dias ?? [])
    .map((dia) => leeFecha(dia.fecha))
    .filter((fecha): fecha is Date => fecha !== null);

  const fechasHoja = datos.tareas
    .map((tarea) => leeFecha(tarea.fecha))
    .filter((fecha): fecha is Date => fecha !== null);

  const fechas = (fechasVentana.length ? fechasVentana : fechasHoja).sort(
    (a, b) => a.getTime() - b.getTime(),
  );

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
      "Ni el calendario ni la hoja de registro dicen las fechas de este microciclo, así que el seguimiento individual es el de toda la temporada, no el de esta semana.",
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

  /* En la previa es normal que todavía no haya notas: sólo se avisa en el post. */
  if (esPost && datos.tareas.length > 0 && valoradas.length === 0) {
    avisos.push(
      "Ninguna tarea de ABP de este microciclo está valorada en la hoja de registro.",
    );
  }

  /* ---------------- quién ha llevado seguimiento de ABP ---------------- */

  /*
  | El seguimiento no tiene casilla de «esto es ABP»: se reconoce por lo que
  | está escrito en los objetivos y en el feedback. Es una estimación, y por
  | eso se dice en el pie de la sección.
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

  /*
  | El cruce, con las mismas acciones que el resto del informe (19/10/2026):
  | sin los amistosos de verano salvo que se pidan, y con los minutos que
  | cuentan. Si la pantalla no manda con qué rehacerlo, se usa el suyo.
  */
  const filas: FilaCruce[] = datos.cruce
    ? (() => {
        const oficial = (competicion: string) => datos.conPretemporada || competicion !== "amistoso";

        return construyeCruce({
          ...datos.cruce,
          events: datos.cruce.events.filter((una) => oficial(una.contexto.jornada.competicion)),
          partidos: datos.cruce.partidos.filter((una) => oficial(una.competicion)),
          minutosMicro: minutos.porAspecto,
        });
      })()
    : datos.filas;

  const conMuestra = filas
    .filter((fila) => fila.stats.acciones > 0 || fila.minutosTemporada > 0)
    .sort((a, b) => b.stats.acciones - a.stats.acciones);

  const equipo = conMuestra.map((fila) => filaEquipo(fila, semanaAspectos));

  /*
  | Las prioridades del informe (19/10/2026): el balón parado que acaba en
  | remate, por el daño que hace, y los saques de banda aparte (uno como
  | mucho). Ver `prioridadesAbp`.
  */
  /*
  | Desde el 20/10/2026, en la previa pesa también el rival de la semana
  | (`pesoDelRival`): defender el córner baja si el rival casi no remata los
  | suyos, y atacar la falta sube si la concede mucho. Cada prioridad lleva la
  | línea que lo explica.
  */
  const rivalAbp = esPost ? null : rivalAbpDe(datos.comparativa ?? null, datos.partidoCalendario?.rival || datos.rival);

  /* La tasa de peligro de la temporada de cada aspecto: la referencia de las lecturas del post. */
  const tasasTemporada = new Map(
    filas
      .filter((fila) => fila.stats.acciones >= MINIMO_VEREDICTO)
      .map((fila) => [claveAspecto(fila.aspecto.key, fila.lado), fila.stats.peligro / fila.stats.acciones] as const),
  );

  /*
  | El arco de la previa (20/10/2026): de dónde venimos. «Viene del partido
  | contra…» era una línea de agenda; con las acciones de ese partido en las
  | hojas, dice lo que nos dejó a balón parado.
  */
  const anterior =
    !esPost && datos.partidoAnterior && (datos.accionesAnterior?.length ?? 0) > 0
      ? partidoDelInforme(datos.accionesAnterior ?? [], new Map(), tasasTemporada)
      : null;

  /*
  | El hilo entre semanas (20/10/2026): lo que nos hizo daño en el partido
  | anterior pesa en la previa siguiente, junto al rival de la semana. Un gol
  | en contra pesa más que dos sustos. Sólo lo defensivo: es lo que se corrige.
  */
  const danoAnterior = new Map<string, DanoAnterior>();

  if (anterior && datos.partidoAnterior) {
    const rivalAnterior = datos.partidoAnterior.rival;

    const ante = `contra el ${rivalAnterior}`;

    anterior.cruce
      .filter((una) => una.medible && una.lado === "defensivo" && una.acciones > 0)
      .forEach((una) => {
        const cifrasUna = { acciones: una.acciones, remates: una.remates, peligros: una.peligros, goles: una.goles, xg: una.xg };

        if (una.goles > 0) danoAnterior.set(`${una.aspecto}|defensivo`, { factor: 1.35, frase: `${ante} ${danoEnFrase(cifrasUna)}`, rival: rivalAnterior, ...cifrasUna });
        else if (una.peligros >= 2) danoAnterior.set(`${una.aspecto}|defensivo`, { factor: 1.2, frase: `${ante} ${danoEnFrase(cifrasUna)}`, rival: rivalAnterior, ...cifrasUna });
      });
  }

  const pesoDeLaSemana =
    rivalAbp || danoAnterior.size
      ? (fila: FilaCruce) => {
          const delRival = rivalAbp ? (pesoDelRival(fila, rivalAbp)?.factor ?? null) : null;
          const delAnterior = danoAnterior.get(`${fila.aspecto.label}|${fila.lado}`)?.factor ?? null;

          return delRival === null && delAnterior === null ? null : (delRival ?? 1) * (delAnterior ?? 1);
        }
      : undefined;

  /*
  | La referencia de cada prioridad (20/10/2026): su peligro frente al resto
  | de nuestro balón parado del mismo lado, que es lo que dice si «4 de 27» es
  | mucho. Sin los saques de banda, que van aparte.
  */
  /* Su peligro frente al resto de nuestro balón parado del mismo lado, como número: 1 = igual; por debajo de 1, en contra, mejor. */
  const frenteAlResto = (linea: LineaEquipo) => {
    if (linea.esBanda || linea.acciones < MINIMO_VEREDICTO) return null;

    const resto = equipo.filter((una) => una.lado === linea.lado && !una.esBanda && una.aspecto !== linea.aspecto);

    const acciones = resto.reduce((s, una) => s + una.acciones, 0);
    const peligros = resto.reduce((s, una) => s + una.peligros, 0);

    if (acciones < 20 || peligros === 0) return null;

    const delResto = peligros / acciones;

    return { r: linea.peligros / linea.acciones / delResto, peligros, acciones, delResto };
  };

  const referenciaDe = (linea: LineaEquipo) => {
    const fr = frenteAlResto(linea);

    if (!fr) return "";

    const { r, peligros, acciones, delResto } = fr;

    /*
    | La base, dicha (23/10/2026, equipo de expertos): este porcentaje es el
    | del balón parado que puede acabar en remate, sin saques de banda; el de
    | la tabla de la temporada cuenta todo. Sin decirlo, «17,5 %» y «7,6 %»
    | parecían contradecirse.
    */
    const resto2 = `resto de nuestro balón parado ${linea.lado === "defensivo" ? "en contra" : "a favor"} sin saques de banda (${peligros} de ${acciones}, ${dec(delResto * 100)} %)`;

    if (r >= 2.7) return `el triple que el ${resto2}`;
    if (r >= 1.8) return `el doble que el ${resto2}`;
    if (r >= 1.25) return `por encima del ${resto2}`;
    if (r <= 0.55) return `la mitad que el ${resto2}`;
    if (r <= 0.8) return `por debajo del ${resto2}`;

    return `en línea con el ${resto2}`;
  };

  /*
  | El umbral honesto de la prioridad (22/10/2026): la misma regla de muestra
  | que el resto del informe (`muestraSuficiente`), con el resto de nuestro
  | balón parado del mismo lado como referencia. Si no llega, la prioridad
  | sigue, pero se dice que es tendencia, de dónde salen sus peligros y cuánto
  | valían: «2 de 8» eran las dos del último partido (0 de 6 antes).
  */
  const tendenciaDe = (linea: LineaEquipo) => {
    if (linea.esBanda || linea.peligros === 0) return "";

    const resto = equipo.filter((una) => una.lado === linea.lado && !una.esBanda && una.aspecto !== linea.aspecto);

    const accionesResto = resto.reduce((s, una) => s + una.acciones, 0);

    const tasa = accionesResto >= 20 ? resto.reduce((s, una) => s + una.peligros, 0) / accionesResto : null;

    if (muestraSuficiente({ acciones: linea.acciones, casos: linea.peligros, tasa })) return "";

    const ant = danoAnterior.get(`${linea.aspecto}|${linea.lado}`);

    if (ant && ant.peligros > 0 && ant.peligros <= linea.peligros && ant.acciones <= linea.acciones) {
      const cuantas =
        ant.peligros === linea.peligros
          ? linea.peligros === 1
            ? "la única llegó"
            : linea.peligros === 2
              ? "las dos llegaron"
              : `las ${linea.peligros} llegaron`
          : `${ant.peligros} de las ${linea.peligros} llegaron`;

      /*
      | Un aviso, no una certeza (23/10/2026): «Tendencia, no norma» debajo de
      | «Prioridad nº 1» le quitaba la fuerza que el titular le daba. Se dice
      | qué es (reciente), de dónde sale y por qué se trabaja igual.
      */
      const antes = `antes, ${linea.peligros - ant.peligros} de ${linea.acciones - ant.acciones}`;

      return `Aviso reciente: ${cuantas} contra el ${ant.rival} (${antes}${ant.xg > 0 ? `; valían ${dec(ant.xg, 2)} goles esperados` : ""}). Lo cerramos antes de que sea costumbre`;
    }

    return `Aviso con poca muestra: ${plural(linea.peligros, "acción con peligro", "acciones con peligro")} en la temporada`;
  };

  const prioridades: LineaEquipo[] = (
    filas.length
      ? prioridadesAbp(filas, { rival: pesoDeLaSemana }).map((una) => filaEquipo(una.fila, semanaAspectos, rivalAbp, danoAnterior))
      : datos.prioridades.map((fila) => filaEquipo(fila, semanaAspectos, rivalAbp, danoAnterior))
  ).map((linea) => ({ ...linea, referencia: referenciaDe(linea), tendencia: tendenciaDe(linea) }));

  /*
  | LA PRIORIDAD Nº 1 (25/10/2026, ronda 7 de los expertos; cierra las
  | discusiones de las rondas 4-6). Se ordena por los goles esperados que nos
  | conceden en la temporada, por acción, y sólo cuenta como «señal» lo que
  | pasa la regla de muestra (`muestraSuficiente`, contra el resto de nuestro
  | balón parado del mismo lado) y no es mejor que ese resto con el rival
  | haciéndolo bajar. El rival pesa sólo con lo que Wyscout mide de ese mismo
  | aspecto (`pesoDelRival`). Los goles apoyan, pero con 2 o menos son base
  | corta y no deciden.
  |
  | Si nada da señal, no se inventa una: la nº 1 es la que más goles
  | esperados nos ha concedido y el titular lo dice («Sin señal clara en
  | contra: mantenemos el córner y la falta lateral»).
  */
  const tasaDelResto = (linea: LineaEquipo) => {
    const resto = equipo.filter((una) => una.lado === linea.lado && !una.esBanda && una.aspecto !== linea.aspecto);

    const acciones = resto.reduce((s, una) => s + una.acciones, 0);

    return acciones >= 20 ? resto.reduce((s, una) => s + una.peligros, 0) / acciones : null;
  };

  const aSegundoPlano = (una: LineaEquipo) => {
    const fr = frenteAlResto(una);

    return Boolean(fr && fr.r <= 0.8 && una.sentidoRival === "baja");
  };

  const conSenal = (una: LineaEquipo) =>
    !una.esBanda && muestraSuficiente({ acciones: una.acciones, casos: una.peligros, tasa: tasaDelResto(una) }) && !aSegundoPlano(una);

  const xgPorAccion = (una: LineaEquipo) => (una.acciones ? una.xg / una.acciones : 0) * una.factorRival;

  const defensivas = prioridades.filter((una) => una.lado === "defensivo" && !una.esBanda);

  const conSenalDef = defensivas.filter(conSenal).sort((a, b) => xgPorAccion(b) - xgPorAccion(a) || b.goles - a.goles);

  const sinSenal = !esPost && defensivas.length > 0 && conSenalDef.length === 0;

  const numeroUno = conSenalDef[0] ?? (sinSenal ? [...defensivas].sort((a, b) => b.xg - a.xg || b.peligros - a.peligros)[0] : null);

  if (numeroUno) {
    prioridades.splice(prioridades.indexOf(numeroUno), 1);
    prioridades.unshift(numeroUno);
  }

  /* La que se vigila sin ser la nº 1 (sin señal clara): otra familia defensiva, para el titular. */
  const vigiladaTambien = sinSenal ? (defensivas.filter((una) => una !== numeroUno && una.familia !== numeroUno?.familia).sort((a, b) => b.xg - a.xg || b.peligros - a.peligros)[0] ?? null) : null;

  /* Lo que nos costó goles y no es la nº 1: se dice por qué, con su base. */
  prioridades.forEach((una, i) => {
    if (i === 0 || una.esBanda || una.lado !== "defensivo" || !una.goles) return;

    const fr = frenteAlResto(una);

    const ref = fr && fr.r <= 0.8 ? ", pero está por debajo del resto de nuestro balón parado en contra" : "";

    const rival = una.sentidoRival === "baja" && una.contraRivalCorto ? ` y ${una.contraRivalCorto}` : "";

    prioridades[i] = {
      ...una,
      segundoPlano: `${mayuscula(conArticulo(una.aspecto))} ${ladoConcordado(una.aspecto, una.lado)} sigue vigilado: nos ha costado ${plural(una.goles, "gol", "goles")}${una.goles <= 2 ? " (base corta)" : ""}${ref}${rival}`,
    };
  });

  /*
  | El patrón de la última jornada (23/10/2026): si la hoja dice desde dónde
  | y adónde fueron las acciones de peligro de ese aspecto en el partido
  | anterior, la prioridad lo lleva, y en defensa se convierte en consigna
  | («el segundo palo tiene dueño antes del golpeo»).
  */
  if (!esPost) {
    prioridades.forEach((una, i) => {
      const p = patronDe(datos.accionesAnterior ?? [], una.clave, una.lado, datos.partidoAnterior?.rival ?? "");

      if (p) prioridades[i] = { ...una, patron: p.patron, consignaPatron: p.consigna };
    });
  }

  /*
  | Emparejamientos (20/10/2026): a quién marcamos —sus rematadores de ABP
  | según el scouting y sus más altos— y por dónde atacamos —lo nuestro
  | ofensivo que el rival concede—. Lo que no tiene dato no sale.
  */
  const emparejamientos = (() => {
    if (esPost) return null;

    const rivalEquipo = datos.partidoCalendario?.rival || datos.rival;

    const aereos = rivalEquipo ? buildAerialThreats(datos.plantillaRival, [], rivalEquipo) : [];

    /*
    | Quién sale (22/10/2026): con su once marcado en Plantillas rivales, los
    | titulares primero y el resto con «si entra». Sin once marcado, como
    | estaban. La clave del jugador es la del once (`playerKey`), no el id.
    */
    const once = datos.onceRival && datos.onceRival.titulares.length ? datos.onceRival : null;

    const filasRival = Array.isArray(datos.plantillaRival)
      ? (datos.plantillaRival as Record<string, unknown>[]).filter((fila) => fila && typeof fila === "object" && teamKey(String(fila.NOMBRE_EQUIPO ?? "")) === teamKey(rivalEquipo))
      : [];

    const claveDe = (nombre: string, foto: string) => {
      const fila = filasRival.find((f) => String(f.FOTO ?? "").trim() === foto && foto) ?? filasRival.find((f) => [f["NOMBRE DEPORTIVO"], f.JUGADOR].some((n) => String(n ?? "").trim() === nombre));

      return fila ? playerKey(fila) : "";
    };

    const titular = (nombre: string, foto: string) => (once ? once.titulares.includes(claveDe(nombre, foto)) : true);

    /* «F. CARMONA» → «Carmona»: en la charla se dice el apellido. */
    const apellido = (nombre: string) => {
      const ultimo = nombre.trim().split(/\s+/).pop() ?? nombre;

      return ultimo.charAt(0).toUpperCase() + ultimo.slice(1).toLowerCase();
    };

    const candidatos = aereos.filter((uno) => uno.remataAbp || (uno.altura ?? 0) >= 186);

    const masAlto = Math.max(0, ...candidatos.map((uno) => uno.altura ?? 0));

    const marcamos = candidatos
      .map((uno) => ({ uno, sale: titular(uno.nombre, uno.foto) }))
      .sort((a, b) => Number(b.sale) - Number(a.sale) || Number(b.uno.remataAbp) - Number(a.uno.remataAbp) || (b.uno.altura ?? 0) - (a.uno.altura ?? 0))
      .slice(0, 4)
      .map(({ uno, sale }) => {
        const quien = `${apellido(uno.nombre)}${uno.dorsal ? ` (${uno.dorsal})` : ""}`;

        const altura = uno.altura ? `${dec(uno.altura / 100, 2)} m` : "";

        const que = uno.remataAbp ? "su rematador" : uno.altura && uno.altura === masAlto ? "el más alto" : "";

        return `${quien}: ${[que, altura].filter(Boolean).join(", ")}${sale ? "" : ", si entra"}`;
      });

    /* Quién la pone, si el scouting lo tiene marcado y sale. */
    const sacadores = aereos.filter((uno) => uno.sacaAbp && titular(uno.nombre, uno.foto)).map((uno) => apellido(uno.nombre));

    if (marcamos.length && sacadores.length) marcamos.push(`La pone ${fraseLista(sacadores)}`);

    /*
    | Por dónde atacamos (22/10/2026): lo que Wyscout mide de cómo defiende el
    | rival cada familia que acaba en remate. Primero la que más concede; la
    | otra, sólo si es claramente peor (tercio de arriba de la categoría).
    */
    const ra = rivalAbp;

    const familias = [
      { key: "cornersRemate", nombre: "córner", articulo: "Al córner" },
      { key: "faltasRemate", nombre: "falta", articulo: "A la falta" },
    ]
      .map((f) => {
        const fila = ra?.filas.find((una) => una.key === f.key);

        return fila && fila.contra !== null && fila.puestoContra ? { ...f, valor: fila.contra, puesto: fila.puestoContra, mediana: fila.medianaContra } : null;
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => b.puesto - a.puesto);

    const n = ra?.equipos ?? 0;

    const atacamos = [
      ...prioridades
        .filter((una) => una.lado === "ofensivo" && !una.esBanda && una.sentidoRival === "sube" && una.contraRival)
        .slice(0, 1)
        .map((una) => `${consignaDe(una.aspecto, una.lado)}: ${una.contraRival}`),
      /*
      | Sólo si es una debilidad de verdad (23/10/2026): en el tercio de
      | abajo de la categoría y claramente por encima de la mediana. «Les
      | rematan el 33,3 % (12.º)» era la mediana (32,6 %), no un hueco.
      */
      ...(familias[0] && familias[0].puesto > (2 * n) / 3 && (familias[0].mediana === null || familias[0].valor > familias[0].mediana * 1.1)
        ? [
            `${familias[0].articulo}: les rematan el ${fmtMedida(familias[0].valor, familias[0].key)} (${familias[0].puesto}.º de ${n}; la mediana, ${fmtMedida(familias[0].mediana, familias[0].key)})`,
            ...(familias[1] && familias[1].puesto <= Math.ceil(n / 3)
              ? [`${familias[1].articulo}, menos: el ${fmtMedida(familias[1].valor, familias[1].key)} (${familias[1].puesto}.º de ${n})`]
              : []),
          ]
        : []),
    ];

    return marcamos.length || atacamos.length ? { marcamos, atacamos } : null;
  })();

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

  /*
  | Dos fuentes que no cuadran (22/10/2026): Wyscout daba 0,50 penaltis a
  | favor por partido (unos 4 en 8) y nuestras hojas 2. Una de las dos cuenta
  | otra cosa o le falta algo; no es para el informe, es para quien lo manda.
  */
  if (comparativa && equipo.length) {
    const partidos = Math.min(comparativa.jugados, datos.propio?.partidos ?? comparativa.jugados);

    (
      [
        { familia: "penalti", key: "penaltis", nombre: "penaltis" },
        { familia: "corner", key: "corners", nombre: "córners" },
      ] as const
    ).forEach(({ familia, key, nombre }) => {
      const fila = comparativa.filas.find((una) => una.key === key);

      (["favor", "contra"] as const).forEach((lado) => {
        const porPartido = fila?.[lado];

        if (porPartido === null || porPartido === undefined || !partidos) return;

        const wyscout = porPartido * partidos;

        const hojas = equipo
          .filter((una) => una.familia === familia && una.lado === (lado === "favor" ? "ofensivo" : "defensivo"))
          .reduce((s, una) => s + una.acciones, 0);

        if (Math.abs(wyscout - hojas) >= Math.max(2, wyscout * 0.25)) {
          /*
          | Fuera de la vista hasta que cuadren (25/10/2026, ronda 7): «0,50
          | penaltis, 1.º de 20» llegaba al cuerpo técnico mientras nuestras
          | hojas cuentan la mitad. Los córners se quedan: son el eje del
          | informe y el aviso basta.
          */
          if (key === "penaltis") {
            const i = comparativa.filas.findIndex((una) => una.key === key);

            if (i >= 0) comparativa.filas.splice(i, 1);
          }

          avisos.push(
            `${mayuscula(nombre)} ${lado === "favor" ? "a favor" : "en contra"}: Wyscout cuenta unos ${Math.round(wyscout)} (${fmtMedida(porPartido, key)} por partido en ${partidos}) y nuestras hojas ${hojas}. Revisa la hoja de ABP: el informe usa las dos y no cuadran.`,
          );
        }
      });
    });
  }

  const propio = datos.propio ?? null;

  /*
  | Un solo aviso para «no hay nada en nuestras hojas». Antes salían dos —uno
  | por el cruce y otro por el resumen— que decían lo mismo con otras palabras.
  */
  if ((!propio || propio.acciones === 0) && equipo.length === 0) {
    avisos.push(
      "Todavía no hay acciones de balón parado registradas en nuestras hojas de competición: sin ellas no hay goles ni peligro de la temporada.",
    );
  }

  /* ---------------- el tiempo de la semana ---------------- */

  /* Los totales de lo que cuenta, no los de la pantalla (que suman las propuestas). */
  const totales = minutos.totales;

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

  minutos.entradas.forEach(({ dia, trabajo }) => {
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

  /*
  | Los minutos por `aspecto|lado`: los de `minutosAbp`, con la misma cuenta
  | que la pantalla (`minutosPorAspecto`) pero sin las propuestas del boceto.
  | `datos.minutosPorAspecto` ya no se usa (19/10/2026): las sumaba.
  */
  const minutosAspecto = minutos.porAspecto;

  /* El reparto por aspecto llega en `aspecto|lado`: se junta por aspecto. */
  const porAspectoMapa = new Map<string, { ofensivo: number; defensivo: number }>();

  minutosAspecto.forEach((minutos, clave) => {
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
        etiqueta: ASPECTO_LABEL.get(aspecto as AspectoKey) ?? aspecto,
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

  /* ---------------- el partido ---------------- */

  const calendario = datos.partidoCalendario ?? null;

  const cuandoPartido = fechaDelPartido(datos);

  const jornadaTexto = calendario?.jornada
    ? `Jornada ${calendario.jornada}`
    : datos.partido?.jornada ?? "";

  const accionesPartido = datos.accionesPartido ?? [];

  const partidoAbp =
    esPost && accionesPartido.length > 0
      ? {
          ...partidoDelInforme(accionesPartido, minutosAspecto, tasasTemporada, datos.clipsPartido ?? null),
          marcador:
            calendario?.jugado && calendario.golesFavor !== null && calendario.golesContra !== null
              ? { favor: calendario.golesFavor, contra: calendario.golesContra }
              : null,
        }
      : null;

  const vieneDe = datos.partidoAnterior
    ? (() => {
        const hecho = anterior ? hechoDelPartido(anterior) : "";

        return hecho
          ? `Del partido contra ${datos.partidoAnterior.rival} (${datos.partidoAnterior.cuando}): ${hecho}`
          : `Viene del partido contra ${datos.partidoAnterior.rival} (${datos.partidoAnterior.cuando})`;
      })()
    : "";

  if (esPost && !partidoAbp) {
    avisos.push(
      `Todavía no hay acciones ${jornadaTexto ? `de la ${jornadaTexto.toLowerCase()} ` : "de este partido "}en nuestras hojas de ABP: el informe post sale sin el partido a balón parado hasta que se registren.`,
    );
  }

  if (partidoAbp && partidoAbp.sinClasificar > 0) {
    avisos.push(
      `${partidoAbp.sinClasificar === 1 ? "1 acción del partido no lleva" : `${partidoAbp.sinClasificar} acciones del partido no llevan`} el tipo de envío o la zona del saque en la hoja: ${partidoAbp.sinClasificar === 1 ? "cuenta" : "cuentan"} en el partido, pero no se ${partidoAbp.sinClasificar === 1 ? "puede" : "pueden"} atribuir a un aspecto del cruce.`,
    );
  }

  if (!esPost && datos.rival && datos.rivalAnalisis === null) {
    avisos.push(
      `No hay nada preparado de ${datos.rival} en «ABP del Rival» ni en «Área del Rival»: la previa sale sin el análisis del rival.`,
    );
  }

  const marcador =
    calendario?.jugado && calendario.golesFavor !== null && calendario.golesContra !== null
      ? `${calendario.golesFavor}-${calendario.golesContra}`
      : "";

  const partido = [
    jornadaTexto,
    cuandoPartido
      ? cuandoPartido.fecha.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }) +
        (cuandoPartido.conHora
          ? `, ${cuandoPartido.fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
          : "")
      : "",
    calendario ? (calendario.lado === "casa" ? "en casa" : "fuera") : "",
    esPost && marcador ? `resultado ${marcador}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  /* ---------------- la cabecera ---------------- */

  const aspectosSemana = new Set(
    [...minutosAspecto.entries()].filter(([, m]) => m > 0).map(([clave]) => clave.split("|")[0]),
  ).size;

  const prioridadesTocadas = prioridades.filter((fila) => fila.minSemana > 0).length;

  /* Lo propuesto sin confirmar se dice al pie, para que nadie busque los minutos que faltan. */
  /* «Tiempo dedicado: 1 h 20 min · dentro del objetivo (1 h 15 min – 1 h 23 min)» (22/10/2026): «1h 20' de 1h 15'-1h 23'» no se entendía. */
  /* Lo propuesto sin confirmar va al aviso del analista, no al informe (25/10/2026). */
  const pieMinutos = `${veredictoObjetivo(objetivo)} (${fmtLargo(objetivo.minimo)} – ${fmtLargo(objetivo.maximo)})`;

  const minutosTile = {
    rotulo: "Tiempo dedicado",
    valor: fmtLargo(totales.minutos),
    pie: pieMinutos,
  };

  const valoracionTile = {
    rotulo: "Tareas valoradas",
    valor: `${valoradas.length} de ${datos.tareas.length}`,
    pie: media === null ? "" : `Media ${dec(media)}`,
  };
  /* Sin ninguna tarea valorada, la ficha no sale: lo que no hay no se nombra (17/10/2026). */
  const conValoracion = valoradas.length > 0 ? [valoracionTile] : [];

  const primeraPrioridad = prioridades.find((una) => !una.esBanda) ?? prioridades[0];

  /*
  | La previa del lunes (19/10/2026): sin minutos, la cabecera no enseña ceros
  | (minutos, reparto, carga, «0 aspectos»), sino la prioridad nº 1 con su base
  | y lo planificado. Su primera ficha es también el gancho del vídeo.
  */
  const resumenSinMinutos = [
    ...(primeraPrioridad
      ? [
          {
            /* Sin señal clara no es una prioridad (26/10/2026, análisis): es lo que se mantiene. */
            rotulo: sinSenal ? "Lo que mantenemos" : "Prioridad nº 1",
            valor: primeraPrioridad.base,
            pie: `${mayuscula(aspectoEnFrase(primeraPrioridad.aspecto, primeraPrioridad.lado))}: acciones con peligro${primeraPrioridad.lado === "defensivo" ? " en contra" : ""}${golesConXg(primeraPrioridad)}${sinSenal ? " · base corta" : primeraPrioridad.tendencia ? " · aviso reciente" : ""}`,
          },
        ]
      : []),
    ...(trabajos.length
      ? [
          {
            rotulo: "Planificado",
            valor: plural(trabajos.length, "tarea", "tareas"),
            pie: fraseLista(planificado.map((uno) => uno.dia.toLowerCase())),
          },
        ]
      : []),
  ];

  /*
  | La cabecera dice cada dato UNA vez: lo que sale aquí no se repite en el pie
  | de su sección (antes los minutos, la nota media y el seguimiento salían
  | arriba y otra vez debajo). En el post, el detalle del partido va en su
  | tabla; arriba sólo los goles, que son el titular.
  */
  const resumen = esPost
    ? [
        ...(partidoAbp
          ? [
              {
                rotulo: "Goles a balón parado",
                valor: `${partidoAbp.favor.goles} · ${partidoAbp.contra.goles}`,
                pie: "A favor · en contra",
              },
            ]
          : []),
        minutosTile,
        ...conValoracion,
      ]
    : sinMinutos
      ? resumenSinMinutos
      : [
          minutosTile,
          {
            rotulo: "Ofensivo · defensivo",
            valor: `${fmtMin(totales.porLado.ofensivo)} · ${fmtMin(totales.porLado.defensivo)}`,
            pie: "Reparto por lado",
          },
          {
            rotulo: "Campo · vídeo",
            valor: `${fmtMin(totales.minutosCampo)} · ${fmtMin(totales.minutosVideo)}`,
            pie: "Dónde se trabajó",
          },
          ...(totales.carga > 0
            ? [
                {
                  rotulo: "Carga",
                  valor: String(Math.round(totales.carga)),
                  pie: totales.cargaCog > 0 ? `Cognitiva ${Math.round(totales.cargaCog)}` : "",
                },
              ]
            : []),
          {
            rotulo: "Aspectos trabajados",
            valor: String(aspectosSemana),
            pie: prioridades.length
              ? `Cubren ${prioridadesTocadas} de las ${prioridades.length} prioridades`
              : "",
          },
          ...conValoracion,
        ];

  const claves = esPost
    ? partidoAbp
      ? clavesPost(partidoAbp, minutos.confirmados)
      : []
    : clavesPrevia(datos, prioridades, tiempo.porAspecto, comparativa, sinMinutos, planificado);

  const modoRotulo = esPost ? "Post partido" : "Previa del partido";

  const titulo = `Balón parado · Microciclo ${datos.micro}`;

  const rivalNombre = datos.rival || calendario?.rival || "";

  const subtitulo = [rivalNombre && `Contra ${rivalNombre}`, datos.temporada]
    .filter(Boolean)
    .join(" · ");

  const jornadaCorta = calendario?.jornada ? ` · J${calendario.jornada}` : "";

  /*
  | La portada para el jugador (22/10/2026): el partido delante y qué es este
  | papel debajo; «Microciclo 18» es un número interno y baja al pie.
  */
  const diaCorto = cuandoPartido
    ? [
        cuandoPartido.fecha.toLocaleDateString("es-ES", { weekday: "short" }).replace(/\.$/, ""),
        String(cuandoPartido.fecha.getDate()),
        cuandoPartido.fecha.toLocaleDateString("es-ES", { month: "short" }).replace(/\.$/, ""),
      ].join(" ")
    : "";

  const horaCorta = cuandoPartido?.conHora ? cuandoPartido.fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";

  const portada = {
    partido: [rivalNombre, esPost ? marcador : "", diaCorto, esPost ? "" : horaCorta, calendario ? (calendario.lado === "casa" ? "en casa" : "fuera") : ""]
      .filter(Boolean)
      .join(" · ")
      .toUpperCase(),
    que: esPost ? "Balón parado: lo que nos deja el partido" : "Balón parado: lo que toca esta semana",
    pie: [jornadaTexto, `Microciclo ${datos.micro}`, rango].filter(Boolean).join(" · "),
  };

  /*
  | El cierre del post (22/10/2026): «para la semana que viene», con su
  | porqué. Lo que nos marcaron o salió mal con muestra; si no, lo que más
  | peligro nos generó en contra. Sin nada de eso, no hay cierre.
  */
  const cierre = (() => {
    /* El patrón hecho consigna, si la hoja lo trae: «Defendemos la falta lateral directa. El segundo palo tiene dueño antes del golpeo». */
    const conPatron = (consigna: string, p: { consigna: string } | null) => (p?.consigna ? `${consigna}. ${p.consigna}` : consigna);

    if (esPost) {
      if (!partidoAbp) return null;

      const una = candidatosDelPartido(partidoAbp)[0] ?? sustoDelPartido(partidoAbp);

      if (!una) return null;

      const clave = ASPECTOS.find((a) => a.label === una.aspecto)?.key;

      const p = clave ? patronDe(datos.accionesPartido ?? [], clave, una.lado, "") : null;

      /*
      | Cuánto, no «le damos más» (24/10/2026, marketing): una propuesta con
      | cifra —una tarea propia, el 20 % del balón parado de la semana, entre
      | 15 y 30 min— que el cuerpo técnico acepta o cambia.
      */
      const propuesta = Math.min(30, Math.max(15, Math.round((minutos.confirmados * 0.2) / 5) * 5));

      const semana =
        una.minutos > 0
          ? `Esta semana le dimos ${fmtLargo(una.minutos)}; el próximo microciclo, ${fmtLargo(propuesta)} en una tarea propia`
          : `No se trabajó en la semana; el próximo microciclo, ${fmtLargo(propuesta)} en una tarea propia`;

      /* El dato del partido no se repite si ya es el del titular. */
      const delTitular = loQueMasPeligroDio(partidoAbp) ?? sustoDelPartido(partidoAbp);

      const hecho = delTitular && delTitular.aspecto === una.aspecto && delTitular.lado === una.lado ? "" : una.lado === "defensivo" ? danoEnFrase(una) : enMinuscula(una.lectura);

      return { titulo: "Para la semana que viene", consigna: conPatron(consignaDe(una.aspecto, una.lado), p), porQue: hecho ? `${mayuscula(hecho)}. ${semana}` : semana, marcamos: "" };
    }

    /*
    | El cierre de la previa (23/10/2026, equipo de expertos): «PARA EL
    | DOMINGO», la consigna, su porqué en una frase y a quién marcamos. La
    | previa acababa en tablas de la temporada, sin decir qué hacemos.
    */
    const primera = prioridades.find((una) => !una.esBanda) ?? prioridades[0];

    if (!primera) return null;

    const defensivo = primera.lado === "defensivo";

    const dia = (() => {
      const cuando = datos.partidoCalendario?.cuando;
      const fecha = cuando ? new Date(cuando) : null;

      return fecha && !Number.isNaN(fecha.getTime()) ? ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][fecha.getDay()] : "";
    })();

    const porQue =
      primera.goles > 0
        ? defensivo
          ? `Nos ha costado ${plural(primera.goles, "gol", "goles")} esta temporada: ${primera.base} con peligro en contra`
          : `Ya nos ha dado ${plural(primera.goles, "gol", "goles")}: ${primera.base} con peligro`
        : primera.sentidoRival === "sube" && primera.contraRivalCorto
          ? `${mayuscula(primera.contraRivalCorto)}${primera.delAnterior ? `, y ${primera.delAnterior}` : ""}`
          : primera.delAnterior
            ? mayuscula(primera.delAnterior)
            : `${primera.base} con peligro${defensivo ? " en contra" : ""}`;

    /* «Carmona (2): su rematador, 1,84 m» → «Carmona (2)»: en el cierre, sólo los nombres de los que salen. */
    const nombres = defensivo
      ? (emparejamientos?.marcamos ?? []).filter((m) => !/^La pone\b/.test(m) && !/si entra$/.test(m)).slice(0, 3).map((m) => m.split(":")[0].trim())
      : [];

    /* Sin señal clara (25/10/2026): las dos que se mantienen, con su base, en una frase. */
    const otra = sinSenal && defensivo ? vigiladaTambien : null;

    const baseCorta = (una: LineaEquipo) => `${mayuscula(aspectoCorto(una.aspecto))}, ${una.base} con peligro${golesConXg(una)}`;

    const consignaSinSenal = sinSenal && defensivo ? `Defendemos ${aspectoCorto(primera.aspecto)}${otra && aspectoCorto(otra.aspecto) !== aspectoCorto(primera.aspecto) ? ` y ${aspectoCorto(otra.aspecto)}` : ""}` : "";

    return {
      titulo: dia ? `Para el ${dia}` : "Para el partido",
      consigna: conPatron(consignaSinSenal || consignaDe(primera.aspecto, primera.lado), primera.consignaPatron ? { consigna: primera.consignaPatron } : null),
      porQue: consignaSinSenal ? [baseCorta(primera), otra ? enMinuscula(baseCorta(otra)) : ""].filter(Boolean).join("; ") : porQue,
      marcamos: nombres.length ? `Marcamos a ${fraseLista(nombres).replace(/ y /, " y a ")}` : "",
    };
  })();

  /* Sin minutos, los gráficos del tiempo serían una barra a cero: no salen. */
  const graficos = (datos.graficos ?? []).filter((grafico) => !(sinMinutos && grafico.area === "tiempo"));

  const informe: InformeMicro = {
    modo,
    modoRotulo,
    portada,
    cierre,
    /* De reserva: abajo se cambia por el asunto con la idea (`asuntoAbp`). */
    emparejamientos,
    asunto: `Balón parado · ${esPost ? "post" : "previa"} · Microciclo ${datos.micro}${rivalNombre ? ` · ${rivalNombre}` : ""}${jornadaCorta}${esPost && marcador ? ` (${marcador})` : ""}`,
    preencabezado: "",
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
    partido,
    vieneDe,
    resumen,
    claves,
    trabajos,
    valoracion: {
      lineas: lineasValoracion,
      valoradas: valoradas.length,
      total: datos.tareas.length,
      media,
    },
    seguimiento: { lineas: lineasSeguimiento, jugadores },
    equipo,
    prioridades,
    sinSenal: sinSenal ? { otra: vigiladaTambien } : null,
    tiempo,
    objetivo,
    tareasValoradas,
    seguimientoResumen,
    comparativa,
    propio,
    partidoAbp,
    graficos,
    avisos,
    rivalAnalisis: datos.rivalAnalisis ?? null,
    minutosAbp: {
      confirmados: minutos.confirmados,
      propuestos: minutos.propuestos,
      campo: minutos.campo,
      video: minutos.video,
      texto: minutos.texto,
      porLado: (() => {
        /* Una tarea con varios aspectos no puede sumar dos veces: si el reparto no cuadra con el total, no se da. */
        const lado = (l: AbpLado) => [...minutos.porAspecto.entries()].filter(([clave]) => clave.endsWith(`|${l}`)).reduce((t, [, m]) => t + m, 0);

        const ofensivo = lado("ofensivo");
        const defensivo = lado("defensivo");

        if (!(ofensivo + defensivo > 0 && Math.abs(ofensivo + defensivo - minutos.confirmados) <= Math.max(2, minutos.confirmados * 0.05))) return null;

        /* Que las dos partes sumen el total que se escribe al lado (25/10/2026): «1 h 13 min ofensivos y 8 defensivos» de «1 h 20» no cuadraba. */
        const total = Math.round(minutos.confirmados);
        const of = Math.round((ofensivo * total) / (ofensivo + defensivo));

        return { ofensivo: of, defensivo: total - of };
      })(),
    },
    sinMinutos,
    rivalAbp,
  };

  const conIdea = asuntoAbp(informe, {
    jornada: calendario?.jornada ?? null,
    golesFavor: calendario?.jugado ? (calendario.golesFavor ?? null) : null,
    golesContra: calendario?.jugado ? (calendario.golesContra ?? null) : null,
  });

  if (conIdea.asunto) informe.asunto = conIdea.asunto;

  informe.preencabezado = conIdea.preencabezado;

  return informe;
}

/**
 * Lo que nos dejó un partido a balón parado, en una frase y como hecho
 * (20/10/2026): un gol primero; si no, lo que salió mal con muestra; si no,
 * el aspecto que más sustos nos dio; si no, los remates. Para el arco de la
 * previa («Del partido contra…»).
 */
function hechoDelPartido(partido: PartidoAbpInforme) {
  const enContra = partido.cruce
    .filter((una) => una.medible && una.lado === "defensivo" && una.goles > 0)
    .sort((a, b) => b.goles - a.goles)[0];

  if (enContra) return `nos marcaron con ${conArticulo(enContra.aspecto)} (${plural(enContra.goles, "gol", "goles")})`;

  const aFavor = partido.cruce
    .filter((una) => una.medible && una.lado === "ofensivo" && una.goles > 0)
    .sort((a, b) => b.goles - a.goles)[0];

  if (aFavor) return `marcamos con ${conArticulo(aFavor.aspecto)} (${plural(aFavor.goles, "gol", "goles")})`;

  const mal = partido.cruce.find((una) => una.medible && una.tono === "mal");

  if (mal) return `${aspectoEnFrase(mal.aspecto, mal.lado)}, ${enMinuscula(mal.lectura)}`;

  const susto = partido.cruce
    .filter((una) => una.medible && una.lado === "defensivo" && una.peligros >= 2)
    .sort((a, b) => b.peligros - a.peligros)[0];

  if (susto) return `en ${conArticulo(susto.aspecto)} en contra ${danoEnFrase(susto)}`;

  const total = partido.favor.acciones + partido.contra.acciones;

  return total ? `${plural(partido.favor.remates, "remate", "remates")} a balón parado a favor y ${partido.contra.remates} en contra` : "";
}

/* ------------------------------------------------------------------ */
/*  EL PAPEL                                                           */
/* ------------------------------------------------------------------ */

const ORO = "#C8A96B";
const NAVY = "#0F1E3D";
const CREMA = "#F7F4EC";
const TINTA = "#1F2937";
const SUAVE = "#6B7280";
const VERDE = "#0F7B5C";
const NARANJA = "#B4530A";

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

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin:0 0 14px"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function parrafo(texto: string) {
  return `<p style="margin:0 0 12px;font:400 13px/1.55 Arial,sans-serif;color:${TINTA}">${texto}</p>`;
}

/** Cada métrica con su forma: los porcentajes con su signo y coma decimal. */
function fmtMedida(valor: number | null, key: string) {
  if (valor === null || !Number.isFinite(valor)) return "—";

  const esPorcentaje = /Remate$/.test(key) || key === "cuotaRematesAbp";

  return esPorcentaje ? `${dec(valor)} %` : dec(valor, key === "penaltis" ? 2 : 1);
}

function numeroConSigno(valor: number | null, sufijo = "") {
  if (valor === null || !Number.isFinite(valor)) return "—";

  return `${valor > 0 ? "+" : ""}${dec(valor)}${sufijo}`;
}

function tonoHtml(texto: string, tono: "bien" | "mal" | "neutro") {
  if (tono === "neutro") return `<span style="color:${SUAVE}">${esc(texto)}</span>`;

  return `<b style="color:${tono === "bien" ? VERDE : NARANJA}">${esc(texto)}</b>`;
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

/**
 * Una sección del informe, escrita dos veces: en HTML y en texto.
 *
 * Las dos versiones salen del MISMO sitio (`seccionesDe`) para que no puedan
 * decir cosas distintas ni ir en otro orden: antes el texto plano llevaba su
 * propia lista de apartados, en otro orden y con otros títulos, y le faltaban
 * secciones enteras.
 */
type Seccion = {
  titulo: string;
  pie: string;
  html: string;
  texto: string[];
  /** Sale aunque no lleve cuerpo: su dato va entero en el pie. */
  fija?: boolean;
};

function seccionesDe(informe: InformeMicro, modoImagenes: ModoImagenes): Seccion[] {
  const esPost = informe.modo === "post";

  const graficos = (area: AreaGrafico) => bloqueGraficos(informe, modoImagenes, area);

  const lista: Seccion[] = [];

  const mete = (seccion: Seccion) => {
    if (seccion.fija || seccion.html.trim() || seccion.texto.length) lista.push(seccion);
  };

  /* ---------- las claves ---------- */

  /*
  | Cada frase, una vez (25/10/2026, guionista): lo que ya dice «Lo esencial»
  | (titular y claves de la pincelada) no se repite en «Claves». Se compara
  | el arranque de cada frase, sin tildes ni mayúsculas.
  */
  const arranque = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").slice(0, 40);

  const esencia = pinceladaAbp(informe);

  const yaDicho = new Set([esencia.titular, ...esencia.claves].map(arranque));

  const clavesSinRepetir = informe.claves.filter((una) => !yaDicho.has(arranque(una)));

  const claves: Seccion = {
    titulo: esPost ? "Lo que nos deja el partido" : "Claves para el partido",
    pie: esPost
      ? "Lo que dice el dato del partido, y si lo trabajado en la semana apareció."
      : informe.sinMinutos
        ? "Qué toca esta semana, por qué y qué está planificado."
        : "Qué se ha trabajado, por qué y qué vigilar del rival.",
    html: clavesSinRepetir.length
      ? `<ol style="margin:0 0 8px;padding-left:20px">${clavesSinRepetir
          .map(
            (una) =>
              `<li style="margin:0 0 8px;font:400 14px/1.55 Arial,sans-serif;color:${TINTA}">${esc(una)}</li>`,
          )
          .join("")}</ol>`
      : "",
    texto: clavesSinRepetir.map((una, i) => `${i + 1}. ${una}`),
  };

  /* ---------- el partido (post) ---------- */

  const p = informe.partidoAbp;

  const partido: Seccion | null = p
    ? {
        titulo: "El partido a balón parado",
        pie: `${p.jornada}, de nuestras hojas de ABP. «Peligro» es gol u ocasión para quien saca.`,
        html:
          tabla(
            ["Acción", "Lado", "Acciones", "Remates", "Peligro", "Goles", "xG"],
            [
              ...p.filas.map((fila) => [
                esc(fila.etiqueta) +
                  (fila.retenidos !== null
                    ? `<br><span style="color:${SUAVE};font-size:12px">${fila.retenidos} de ${fila.acciones} con el balón conservado</span>`
                    : ""),
                fila.lado === "ofensivo" ? "A favor" : "En contra",
                String(fila.acciones),
                String(fila.remates),
                `${fila.peligros} (${pct(fila.peligros, fila.acciones)})`,
                fila.goles ? `<b>${fila.goles}</b>` : "0",
                dec(fila.xg, 2),
              ]),
            ],
          ) +
          /* Sin totales que mezclen saques de banda con córners y faltas (22/10/2026): el reparto, en una frase. */
          (repartoDelPartido(p) ? parrafo(esc(`${repartoDelPartido(p)}.`)) : "") +
          (p.peligrosas.length
            ? `<p style="margin:10px 0 6px;font:700 11px/1.3 Arial,sans-serif;color:${SUAVE};letter-spacing:.14em;text-transform:uppercase">Las acciones de peligro, una a una</p><ul style="margin:0 0 12px;padding-left:20px">${p.peligrosas
                .map(
                  (una) =>
                    `<li style="margin:0 0 5px;font:400 13px/1.5 Arial,sans-serif;color:${TINTA}"><b>${una.lado === "ofensivo" ? "A favor" : "En contra"} · ${esc(una.aspecto)}</b>: ${esc(una.texto)}${
                      una.clip ? ` · <a href="${esc(una.clip)}" style="color:#8A6A2C;font-weight:700">ver el corte</a>` : ""
                    }</li>`,
                )
                .join("")}</ul>`
            : "") +
          (p.rematadores.length || p.sacadores.length
            ? parrafo(
                [
                  p.sacadores.length
                    ? `<b>Sacadores:</b> ${p.sacadores
                        .slice(0, 5)
                        .map((uno) => `${esc(uno.jugador)} (${uno.total})`)
                        .join(", ")}`
                    : "",
                  p.rematadores.length
                    ? `<b>Rematadores:</b> ${p.rematadores
                        .slice(0, 5)
                        .map((uno) => `${esc(uno.jugador)} (${uno.total}${uno.peligro ? `, ${uno.peligro} con peligro` : ""})`)
                        .join(", ")}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · "),
              )
            : ""),
        texto: [
          ...p.filas.map(
            (fila) =>
              `- ${fila.etiqueta} ${fila.lado === "ofensivo" ? "a favor" : "en contra"}: ${plural(fila.acciones, "acción", "acciones")} · ${plural(fila.remates, "remate", "remates")} · peligro ${fila.peligros} (${pct(fila.peligros, fila.acciones)}) · ${plural(fila.goles, "gol", "goles")}${fila.xg > 0 ? ` · xG ${dec(fila.xg, 2)}` : ""}${fila.retenidos !== null ? ` · ${fila.retenidos} con el balón conservado` : ""}`,
          ),
          ...(repartoDelPartido(p) ? [`- ${repartoDelPartido(p)}`] : []),
          ...p.peligrosas.map((una) => `- ${una.lado === "ofensivo" ? "A favor" : "En contra"} · ${una.aspecto}: ${una.texto}${una.clip ? ` · ${una.clip}` : ""}`),
          ...(p.sacadores.length
            ? [`- Sacadores: ${p.sacadores.slice(0, 5).map((uno) => `${uno.jugador} (${uno.total})`).join(", ")}`]
            : []),
          ...(p.rematadores.length
            ? [`- Rematadores: ${p.rematadores.slice(0, 5).map((uno) => `${uno.jugador} (${uno.total})`).join(", ")}`]
            : []),
        ],
      }
    : null;

  /* Sólo los aspectos que nuestras hojas registran: de lo que no hay dato, nada (17/10/2026). */
  const cruceMedible = p ? p.cruce.filter((una) => una.medible) : [];

  /*
  | Sólo lo que dice algo (22/10/2026): lo que dio peligro o gol, o tiene
  | veredicto. Diez filas de «Sin conclusión» y «No se dio» tapaban la única
  | con consecuencias; esas van en una línea debajo.
  */
  const conAlgo = cruceMedible.filter((una) => una.peligros > 0 || una.goles > 0 || una.tono !== "neutro");
  const sinAcciones = cruceMedible.filter((una) => !conAlgo.includes(una) && una.acciones === 0);
  const pocas = cruceMedible.filter((una) => !conAlgo.includes(una) && una.acciones > 0 && una.acciones < MINIMO_VEREDICTO);
  const normales = cruceMedible.filter((una) => !conAlgo.includes(una) && una.acciones >= MINIMO_VEREDICTO);

  const resto = [
    normales.length ? `Sin peligro y dentro de lo normal: ${fraseLista(normales.map((una) => `${aspectoEnFrase(una.aspecto, una.lado)} (${una.acciones})`))}` : "",
    pocas.length ? `${normales.length ? "con" : "Con"} tan pocas acciones que no se leen: ${fraseLista(pocas.map((una) => `${aspectoEnFrase(una.aspecto, una.lado)} (${una.acciones})`))}` : "",
    sinAcciones.length ? `no se dieron en el partido: ${fraseLista(sinAcciones.map((una) => aspectoEnFrase(una.aspecto, una.lado)))}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  const cruce: Seccion | null =
    p && cruceMedible.length
      ? {
          titulo: "Lo trabajado, ¿apareció?",
          pie: "Lo trabajado en la semana que apareció con peligro o con veredicto, y lo que no se trabajó y dio peligro o gol. El resto, debajo, en una línea.",
          html:
            (conAlgo.length
              ? tabla(
                  ["Aspecto", "Lado", "En la semana", "En el partido", "Lectura"],
                  conAlgo.map((una) => [
                    esc(una.aspecto),
                    LADO_LABEL[una.lado],
                    una.trabajado ? fmtMin(una.minutos) : `<span style="color:${SUAVE}">Sin trabajar</span>`,
                    `${plural(una.acciones, "acción", "acciones")}${una.remates ? ` · ${plural(una.remates, "remate", "remates")}` : ""}`,
                    tonoHtml(una.lectura, una.tono),
                  ]),
                )
              : "") + (resto ? parrafo(`<span style="color:${SUAVE}">${esc(`${mayuscula(resto)}.`)}</span>`) : ""),
          texto: [
            ...conAlgo.map(
              (una) =>
                `- ${nombreAspecto(una.aspecto, una.lado)} · ${una.trabajado ? `${fmtMin(una.minutos)} en la semana` : "sin trabajar"} · ${plural(una.acciones, "acción", "acciones")} · ${una.lectura}`,
            ),
            ...(resto ? [`${mayuscula(resto)}.`] : []),
          ],
        }
      : null;

  /* ---------- la semana ---------- */

  const o = informe.objetivo;

  const veredicto =
    o.veredicto === "dentro"
      ? "dentro del objetivo"
      : o.veredicto === "corto"
        ? `faltan ${fmtMin(o.faltan)} para el mínimo`
        : `${fmtMin(Math.round(informe.tiempo.minutos) - o.maximo)} por encima del máximo`;

  const tiempoTexto = `${veredicto.charAt(0).toUpperCase()}${veredicto.slice(1)}.`;

  /*
  | Una sola base, dicha una vez (26/10/2026, análisis): qué es la cifra y
  | cómo se reparte entre córner y falta (lo que acaba en remate) y el resto.
  */
  const conRematePlan = informe.tiempo.porAspecto
    .filter((una) => una.etiqueta.startsWith("Córner") || una.etiqueta.startsWith("Falta"))
    .reduce((t, una) => t + una.ofensivo + una.defensivo, 0);

  const restoPlan = Math.max(0, Math.round(informe.tiempo.minutos) - Math.round(conRematePlan));

  const queCuenta = ` Es el tiempo del plan de balón parado de la semana, en campo y en vídeo: ${fmtLargo(informe.tiempo.minutos)}${conRematePlan > 0 && restoPlan > 0 ? `, ${fmtLargo(conRematePlan)} de córner y falta y ${fmtLargo(restoPlan)} de saques de banda, penaltis y reinicios` : ""}.`;

  /* La previa sin un minuto no lleva esta sección: el lunes no hay tiempo que medir. */
  const tiempo: Seccion | null = informe.sinMinutos
    ? null
    : {
        titulo: esPost ? "El tiempo que se le dio" : "El tiempo de la semana",
        pie: `${tiempoTexto} ${explicaDias(o)} Referencia: 90-100' en una semana de seis entrenamientos, prorrateada.${queCuenta}`,
        html: graficos("tiempo"),
        texto: [],
        fija: true,
      };

  /* Sin un minuto en toda la semana, las columnas de minutos y carga no dicen nada. */
  const conMinutos = informe.trabajos.some((linea) => linea.min > 0);

  const celdaMinutos = (linea: LineaTrabajo) => esc(linea.minutos);

  const celdaCarga = (linea: LineaTrabajo) =>
    linea.carga > 0 ? `${linea.carga}${linea.medida ? "" : ' <span style="color:#9CA3AF">est.</span>'}` : "";

  const semana: Seccion = {
    titulo: informe.sinMinutos ? "Lo planificado, tarea a tarea" : "La semana, tarea a tarea",
    pie: conMinutos
      ? "Lo planificado de balón parado, día a día. «est.» es carga estimada; el resto viene medida de la hoja de registro."
      : "Lo planificado de balón parado, día a día.",
    html: tabla(
      ["Día", "Aspecto", "Lado", "Momento", "Medio", "Roles", ...(conMinutos ? ["Min.", "Carga"] : [])],
      informe.trabajos.map((linea) => [
        esc(linea.dia),
        `${esc(linea.aspectos)}${linea.notas ? `<br><span style="color:${SUAVE};font-size:12px">${esc(linea.notas)}</span>` : ""}`,
        esc(linea.lados),
        esc(linea.momento),
        esc(linea.medio),
        esc(linea.roles),
        ...(conMinutos ? [celdaMinutos(linea), celdaCarga(linea)] : []),
      ]),
    ),
    texto: informe.trabajos.map((linea) =>
      [
        `- ${linea.dia} · ${linea.aspectos} (${linea.lados})`,
        linea.minutos ? `${linea.minutos}${linea.propuesta ? " (propuesta)" : ""}` : "",
        linea.momento,
        linea.medio,
        linea.notas,
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  };

  /* ---------- prioridades (previa) y aspecto por aspecto (post) ---------- */

  /*
  | Las prioridades con su base a la vista (19/10/2026): «8 de 53» en vez de un
  | 78 sobre 100 que nadie sabía de dónde salía. El número de urgencia de la
  | pantalla no se enseña aquí: el orden del informe es otro (`prioridadesAbp`).
  */
  const estadoSemana = (linea: LineaEquipo) => {
    if (linea.minSemana > 0) return esc(fmtMin(linea.minSemana));

    if (informe.sinMinutos) return linea.planificado ? "Planificado" : "";

    return `<span style="color:${NARANJA}">Sin trabajar</span>`;
  };

  const estadoSemanaTexto = (linea: LineaEquipo) =>
    linea.minSemana > 0
      ? `esta semana ${fmtMin(linea.minSemana)}`
      : informe.sinMinutos
        ? linea.planificado
          ? "planificado esta semana"
          : ""
        : "sin trabajar esta semana";

  /* El rival de la semana, si dice algo de alguna prioridad (20/10/2026). */
  const conRival = informe.prioridades.some((linea) => linea.contraRival);

  const columnaRival = (linea: LineaEquipo) =>
    linea.contraRival
      ? `<span style="color:${linea.sentidoRival === "sube" ? NARANJA : VERDE}">${linea.sentidoRival === "sube" ? "Pesa más" : "Pesa menos"}</span> · ${esc(linea.contraRival)}`
      : "";

  const prioridades: Seccion = {
    titulo: "Prioridades de la semana",
    pie: `Sólo competición, de nuestras hojas de ABP. Primero el balón parado que acaba en remate (córner, falta, penalti), ordenado por el daño que hace —acciones con peligro y goles—, por cómo rinde frente a su familia y por lo poco que se ha trabajado; los saques de banda, aparte. «Con peligro» es gol u ocasión para quien saca: en lo defensivo, lo que nos generan. Fuera lo que tiene menos de ${MINIMO_ACCIONES_PRIORIDAD} acciones.${conRival ? " «Contra el rival» es lo que Wyscout mide de él en ese mismo aspecto: pesa más si ataca bien lo que defendemos o concede lo que atacamos, y pesa menos si no." : ""}`,
    html: tabla(
      ["", "Aspecto", "Lado", "Con peligro", "Goles", "Esta semana", "Trabajado en la temporada", ...(conRival ? ["Contra el rival"] : [])],
      informe.prioridades.map((linea, i) => [
        linea.esBanda ? `<span style="color:${SUAVE}">Banda</span>` : `<b>${i + 1}</b>`,
        esc(linea.aspecto),
        LADO_LABEL[linea.lado],
        `<b>${esc(linea.base)}</b>${linea.acciones >= MINIMO_VEREDICTO && linea.peligro ? ` <span style="color:${SUAVE}">(${esc(linea.peligro)})</span>` : ""}${linea.referencia ? `<br><span style="color:${SUAVE};font-size:12px">${esc(mayuscula(linea.referencia))}</span>` : ""}${linea.delAnterior ? `<br><span style="color:${NARANJA};font-size:12px">${esc(mayuscula(linea.delAnterior))}</span>` : ""}${linea.tendencia ? `<br><span style="color:${SUAVE};font-size:12px;font-style:italic">${esc(linea.tendencia)}</span>` : ""}${linea.patron ? `<br><span style="color:${TINTA};font-size:12px">${esc(mayuscula(linea.patron))}${linea.consignaPatron ? `. <b>${esc(linea.consignaPatron)}</b>` : ""}</span>` : ""}`,
        linea.goles ? `<b>${linea.goles}</b>` : "0",
        estadoSemana(linea),
        esc(linea.minutosTemporada),
        ...(conRival ? [columnaRival(linea)] : []),
      ]),
    ),
    texto: informe.prioridades.map((linea, i) =>
      [
        `- ${linea.esBanda ? "Saques de banda, aparte" : `${i + 1}`}: ${urgenciaEnFrase(linea)}`,
        linea.referencia,
        linea.delAnterior,
        linea.tendencia,
        linea.patron ? `${mayuscula(linea.patron)}${linea.consignaPatron ? `. ${linea.consignaPatron}` : ""}` : "",
        estadoSemanaTexto(linea),
        `${linea.minutosTemporada} en la temporada`,
        linea.contraRival ? `${linea.sentidoRival === "sube" ? "pesa más" : "pesa menos"} por el rival: ${linea.contraRival}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  };

  const equipo: Seccion = {
    titulo: "Aspecto por aspecto, en la temporada",
    pie: "Nuestras hojas de ABP, con las mismas acciones que el resto del informe. «¿Se nota el trabajo?» compara el peligro en los partidos con trabajo la semana antes y sin él, con su base en cada lado. Sólo se dice «se nota» o «no se nota» con 10 acciones con peligro o más entre los dos lados y al menos 3 en cada uno: cuentan los peligros, no las acciones. Sin veredicto, sólo las dos bases (con trabajo previo · sin él). Con menos de 5 acciones, la base sin porcentaje.",
    html: tabla(
      ["Aspecto", "Lado", "Acciones", "Remates", "Goles", "Peligro", "Trabajado", "¿Se nota el trabajo?"],
      informe.equipo.map((linea) => [
        esc(linea.aspecto),
        LADO_LABEL[linea.lado],
        String(linea.acciones),
        String(linea.remates),
        String(linea.goles),
        esc(linea.peligro),
        esc(linea.minutosTemporada),
        esc(seNotaElTrabajo(linea)),
      ]),
    ),
    texto: informe.equipo.map((linea) =>
      [
        `- ${nombreAspecto(linea.aspecto, linea.lado)}`,
        `${linea.acciones} acciones`,
        plural(linea.remates, "remate", "remates"),
        plural(linea.goles, "gol", "goles"),
        linea.peligro ? `peligro ${linea.peligro}` : "",
        `trabajado ${linea.minutosTemporada}`,
        seNotaElTrabajo(linea),
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  };

  /* ---------- su balón parado (previa, 19/10/2026) ---------- */

  const ra = informe.rivalAbp;

  const suBalonParado: Seccion | null =
    !esPost && ra
      ? {
          titulo: `Su balón parado · ${ra.equipo}`,
          pie: `Lo que Wyscout mide del rival, por partido, contra los ${ra.equipos} equipos de la categoría.`,
          html: `${ra.lineas.map((linea) => parrafo(esc(linea))).join("")}${tabla(
            ["Métrica", "Ellos", "Mediana", "Puesto", "Concedido", "Mediana", "Puesto"],
            ra.filas.map((fila) => [
              `<b>${esc(fila.rotulo)}</b>`,
              fila.favor === null ? "" : fmtMedida(fila.favor, fila.key),
              fila.favor === null ? "" : fmtMedida(fila.medianaFavor, fila.key),
              fila.puestoFavor === null ? "" : `<b>${fila.puestoFavor}.º</b> de ${ra.equipos}`,
              fila.contra === null ? "" : fmtMedida(fila.contra, fila.key),
              fila.contra === null ? "" : fmtMedida(fila.medianaContra, fila.key),
              fila.puestoContra === null ? "" : `<b>${fila.puestoContra}.º</b> de ${ra.equipos}`,
            ]),
          )}`,
          texto: ra.lineas.map((linea) => `- ${linea}`),
        }
      : null;

  /* ---------- a quién marcamos y por dónde atacamos (previa, 20/10/2026) ---------- */

  const em = informe.emparejamientos;

  const emparejamientos: Seccion | null = em
    ? {
        /* El título promete sólo lo que hay (22/10/2026): sin «por dónde atacamos» no se nombra. */
        titulo:
          em.marcamos.length && em.atacamos.length
            ? "A quién marcamos y por dónde atacamos"
            : em.marcamos.length
              ? "A quién marcamos en su balón parado"
              : "Por dónde les atacamos",
        pie: [
          em.marcamos.length
            ? "Sus rematadores de balón parado según el scouting y sus jugadores de 1,86 m o más; primero los de su once probable, y «si entra» los demás."
            : "",
          em.atacamos.length ? "Por dónde atacar: lo que Wyscout mide de cómo defiende el rival cada balón parado." : "",
        ]
          .filter(Boolean)
          .join(" "),
        html: [
          em.marcamos.length
            ? `<p style="margin:0 0 6px;font:700 11px/1.3 Arial,sans-serif;color:${SUAVE};letter-spacing:.14em;text-transform:uppercase">Defendiendo: a quién marcamos</p><ul style="margin:0 0 14px;padding-left:20px">${em.marcamos
                .map((uno) => `<li style="margin:0 0 4px;font:400 14px/1.5 Arial,sans-serif;color:${TINTA}">${esc(uno)}</li>`)
                .join("")}</ul>`
            : "",
          em.atacamos.length
            ? `<p style="margin:0 0 6px;font:700 11px/1.3 Arial,sans-serif;color:${SUAVE};letter-spacing:.14em;text-transform:uppercase">Atacando: por dónde</p><ul style="margin:0 0 8px;padding-left:20px">${em.atacamos
                .map((uno) => `<li style="margin:0 0 4px;font:400 14px/1.5 Arial,sans-serif;color:${TINTA}">${esc(uno)}</li>`)
                .join("")}</ul>`
            : "",
        ].join(""),
        texto: [
          ...(em.marcamos.length ? ["Defendiendo, a quién marcamos:", ...em.marcamos.map((uno) => `- ${uno}`)] : []),
          ...(em.atacamos.length ? ["Atacando, por dónde:", ...em.atacamos.map((uno) => `- ${uno}`)] : []),
        ],
      }
    : null;

  /* ---------- la valoración ---------- */

  const v = informe.valoracion;

  const valoracion: Seccion = {
    titulo: "Cómo salieron las tareas",
    pie: "Nota y análisis posterior de cada tarea, de la hoja de registro.",
    html: `${graficos("contenidos")}${tabla(
      ["Tarea", "Día", "Fecha", "Nota", "Análisis posterior"],
      v.lineas.map((linea) => [
        esc(linea.tarea),
        esc(linea.dia),
        esc(linea.fecha),
        linea.evaluacion > 0 ? `<b>${dec(linea.evaluacion)}</b>` : "",
        esc(linea.analisis || linea.observaciones || ""),
      ]),
    )}`,
    texto: v.lineas.map(
      (linea) =>
        `- ${linea.tarea}${linea.dia ? ` (${linea.dia})` : ""}${linea.evaluacion > 0 ? ` · nota ${dec(linea.evaluacion)}` : ""}${
          linea.analisis || linea.observaciones ? ` · ${linea.analisis || linea.observaciones}` : ""
        }`,
    ),
  };

  /* ---------- el rival ---------- */

  const r = informe.rivalAnalisis;

  const docs = r?.documentos ?? [];

  const rival: Seccion | null =
    r && (r.conclusiones.length || docs.length || (!esPost && graficos("rival")))
      ? {
          titulo: esPost
            ? `Lo que esperábamos del rival · ${r.equipo}`
            : `El rival a balón parado · ${r.equipo}`,
          pie: esPost
            ? `Las conclusiones de la previa (${r.jornada}), para leerlas con el partido ya jugado.`
            : `Lo analizado en «ABP del Rival» y «Área del Rival» (${r.jornada}): cómo ataca y defiende a balón parado y en centros laterales.`,
          html: `${
            docs.length
              ? parrafo(
                  `Informes de la jornada: ${docs
                    .map((d) => `<a href="${esc(d.url)}" style="color:#8A6A2C;font-weight:600">${esc(d.nombre)} (PDF)</a>`)
                    .join(" · ")}`,
                )
              : ""
          }${tabla(
            ["Sección", "Lo que se concluye"],
            r.conclusiones.map((una) => [`<b>${esc(una.seccion)}</b>`, esc(una.texto)]),
          )}${esPost ? "" : graficos("rival")}`,
          texto: [
            ...r.conclusiones.map((una) => `- ${una.seccion}: ${una.texto}`),
            ...docs.map((d) => `- ${d.nombre} (PDF): ${d.url}`),
          ],
        }
      : null;

  /*
  | ---------- los apuntes, con su vídeo (16/10/2026) ----------
  | Lo que el analista escribe en «ABP del Rival → Apuntes y vídeo»: cada
  | apunte con su minuto o su clip y, si el vídeo lo tiene localizado, el
  | enlace que lo abre en ese segundo.
  */
  const cuadernos = (r?.apuntes ?? []).filter((c) => c.apuntes.length);

  const apuntes: Seccion | null = cuadernos.length
    ? {
        titulo: "Los apuntes, con su vídeo",
        pie: "Cada referencia abre el vídeo en ese momento cuando está localizado; «Clip» es el número del corte en el vídeo del analista.",
        html: cuadernos
          .map((c) => {
            const filas = agrupa(c.apuntes).flatMap((g) =>
              g.tipos.flatMap((t) =>
                t.apuntes.map((a) => {
                  const seg = segundoEnVideo(a, c.video);
                  const ref = rotuloRef(a.ref) || (seg !== null ? "Ver" : "");
                  const enlace = c.video && seg !== null ? `<a href="${esc(enlaceEnSegundo(c.video, seg))}" style="color:#8A6A2C;font-weight:700">${esc(ref)}</a>` : esc(ref);

                  return [esc(`${g.fase.deQuien[c.deQuien]} · ${t.tipo.titulo}`), enlace, esc(a.texto)];
                }),
              ),
            );

            return `${parrafo(`<b>${esc(c.titulo)}</b>${c.video ? ` · <a href="${esc(enlaceEnSegundo(c.video, c.video.inicio ?? 0))}" style="color:#8A6A2C;font-weight:600">ver el vídeo</a>` : ""}`)}${tabla(["Qué", "Dónde", "Apunte"], filas)}`;
          })
          .join(""),
        texto: cuadernos.flatMap((c) => [
          `${c.titulo}${c.video ? ` (vídeo: ${c.video.url})` : ""}`,
          ...c.apuntes.map((a) => {
            const seg = segundoEnVideo(a, c.video);

            return `- ${rotuloRef(a.ref) ? `${rotuloRef(a.ref)}: ` : ""}${a.texto}${c.video && seg !== null ? ` · ${enlaceEnSegundo(c.video, seg)}` : ""}`;
          }),
        ]),
      }
    : null;

  /* ---------- la categoría ---------- */

  const c = informe.comparativa;

  /* Una métrica sin dato nuestro a favor ni en contra no sale. */
  const filasConDato = (c?.filas ?? []).filter((fila) => (fila.favor !== null && Number.isFinite(fila.favor)) || (fila.contra !== null && Number.isFinite(fila.contra)));

  const categoria: Seccion | null = c && filasConDato.length
    ? {
        titulo: "Cómo estamos contra la categoría",
        pie: `${c.equipos} equipos · ${plural(c.jugados, "jornada", "jornadas")} · lo que Wyscout mide, por partido. En contra, el 1.º es el que menos concede.`,
        html: `${tabla(
          ["Métrica", "Nosotros", "Mediana", "Puesto", "En contra", "Mediana", "Puesto"],
          filasConDato.map((fila) => [
            `<b>${esc(fila.rotulo)}</b>`,
            fmtMedida(fila.favor, fila.key),
            fmtMedida(fila.medianaFavor, fila.key),
            fila.puestoFavor === null ? "" : `<b>${fila.puestoFavor}.º</b> de ${c.equipos}`,
            fmtMedida(fila.contra, fila.key),
            fmtMedida(fila.medianaContra, fila.key),
            fila.puestoContra === null ? "" : `<b>${fila.puestoContra}.º</b> de ${c.equipos}`,
          ]),
          /* Los gráficos de la categoría, sólo en la previa (19/10/2026): de una semana a otra no cambian y el post los repetía enteros. */
        )}${esPost ? "" : graficos("wyscout")}`,
        texto: [
          ...filasConDato.map(
            (fila) =>
              `- ${fila.rotulo}: ${fmtMedida(fila.favor, fila.key)} (mediana ${fmtMedida(fila.medianaFavor, fila.key)}${
                fila.puestoFavor === null ? "" : `, ${fila.puestoFavor}.º de ${c.equipos}`
              }) · en contra ${fmtMedida(fila.contra, fila.key)} (mediana ${fmtMedida(fila.medianaContra, fila.key)}${
                fila.puestoContra === null ? "" : `, ${fila.puestoContra}.º de ${c.equipos}`
              })`,
          ),
          ...(c.temporadas.length > 1
            ? c.temporadas.map((una) => {
                const corners = una.valores?.corners;

                return `- Córners en los ${c.jugados} primeros partidos de ${una.temporada}${una.esActual ? " (ésta)" : ""}: ${fmtMedida(corners?.favor ?? null, "corners")} a favor · ${fmtMedida(corners?.contra ?? null, "corners")} en contra`;
              })
            : []),
        ],
      }
    : null;

  /* ---------- nuestro acumulado ---------- */

  const pr = informe.propio;

  const acumulado: Seccion | null =
    pr && pr.acciones > 0
      ? {
          titulo: "Nuestro balón parado en la temporada",
          pie: `${pr.acciones} acciones en ${plural(pr.partidos, "partido", "partidos")} de nuestras hojas de ABP${
            pr.conPretemporada
              ? ", con los amistosos de verano"
              : pr.fueraDePretemporada
                ? `, sólo competición (fuera ${pr.fueraDePretemporada} de pretemporada)`
                : ""
          }${esPost && p ? `, con la ${p.jornada.toLowerCase()} incluida` : ""}. Aquí los goles son dato.`,
          html: `${tabla(
            ["", "Acciones", "Remates", "Peligro", "Goles", "xG"],
            (
              [
                ["A favor", pr.ofensivo],
                ["En contra", pr.defensivo],
              ] as [string, PropioAbp["ofensivo"]][]
            ).map(([rotulo, lado]) => [
              `<b>${rotulo}</b>`,
              String(lado.acciones),
              String(lado.remates),
              `${lado.peligros} (${pct(lado.peligros, lado.acciones)})`,
              `<b>${lado.goles}</b>`,
              dec(lado.xg, 2),
            ]),
          )}${graficos("nuestro")}`,
          texto: (
            [
              ["A favor", pr.ofensivo],
              ["En contra", pr.defensivo],
            ] as [string, PropioAbp["ofensivo"]][]
          ).map(
            ([rotulo, lado]) =>
              `- ${rotulo}: ${lado.acciones} acciones · ${lado.remates} remates · peligro ${lado.peligros} (${pct(lado.peligros, lado.acciones)}) · ${plural(lado.goles, "gol", "goles")} · xG ${dec(lado.xg, 2)}`,
          ),
        }
      : null;

  /* ---------- el seguimiento individual ---------- */

  const s = informe.seguimiento;

  /*
  | El mismo registro hecho a varios jugadores va en UNA fila (19/10/2026): el
  | post de la J8 traía cuatro filas idénticas («ABP: Penalti · Interés y
  | proactividad») que no decían nada más que la primera.
  */
  const gruposSeguimiento = [
    ...s.lineas
      .reduce((mapa, linea) => {
        const clave = [linea.fecha, linea.quien, linea.modalidad, linea.estrategia, linea.objetivo, linea.feedback].join("|");

        const grupo = mapa.get(clave) ?? { ...linea, jugadores: [] as string[] };

        if (!grupo.jugadores.includes(linea.jugador)) grupo.jugadores.push(linea.jugador);

        return mapa.set(clave, grupo);
      }, new Map<string, LineaSeguimiento & { jugadores: string[] }>())
      .values(),
  ];

  /* Sin registros de ABP, la sección no sale (17/10/2026). */
  const seguimiento: Seccion | null = s.lineas.length === 0 ? null : {
    titulo: "Seguimiento individual de balón parado",
    pie: `${plural(s.lineas.length, "registro", "registros")} de ${plural(s.jugadores, "jugador", "jugadores")}. Se reconoce por lo escrito en objetivos y feedback (la hoja no tiene casilla de ABP): es una lectura, no un dato cerrado.`,
    /* El gráfico de quién lleva seguimiento, sólo con más de un grupo: con uno repite la tabla. */
    html: `${gruposSeguimiento.length > 1 ? graficos("seguimiento") : ""}${tabla(
      ["Jugador", "Fecha", "Quién", "Modalidad", "Objetivo", "Feedback"],
      gruposSeguimiento.map((linea) => [
        `<b>${esc(fraseLista(linea.jugadores))}</b>`,
        esc(linea.fecha),
        esc(linea.quien),
        esc([linea.modalidad, linea.estrategia].filter(Boolean).join(" · ")),
        esc(linea.objetivo || ""),
        esc(linea.feedback || ""),
      ]),
    )}`,
    texto: gruposSeguimiento.map(
      (linea) => [`- ${fraseLista(linea.jugadores)}`, linea.fecha, linea.objetivo, linea.feedback].filter(Boolean).join(" · "),
    ),
  };

  /*
  | EL ORDEN.
  |
  | Previa: qué vamos a hacer y por qué → las claves, las urgencias que lo
  | justifican, la semana, el rival, y después el contexto (categoría y lo
  | nuestro). Post: qué pasó → las claves, el partido, lo que esperábamos
  | del rival (para leerlo al lado del partido), si lo entrenado apareció,
  | cómo salieron las tareas, la semana, el acumulado y, al final, la consigna
  | para la semana que viene (22/10/2026: acababa en el seguimiento, sin cierre).
  */
  const c2 = informe.cierre;

  /* Post: «Para la semana que viene». Previa (23/10/2026): «Para el domingo», con a quién marcamos, antes de los anexos. */
  const cierre: Seccion | null = c2
    ? {
        titulo: c2.titulo,
        pie: "",
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY};border-radius:10px"><tr><td style="padding:16px 18px"><p style="margin:0;font:700 19px/1.35 Arial,sans-serif;color:#F2E6C9">${esc(c2.consigna)}</p><p style="margin:6px 0 0;font:400 13px/1.5 Arial,sans-serif;color:#C9D2DF">${esc(c2.porQue)}.</p>${c2.marcamos ? `<p style="margin:8px 0 0;font:700 14px/1.5 Arial,sans-serif;color:#F2E6C9">${esc(c2.marcamos)}.</p>` : ""}</td></tr></table>`,
        texto: [[`${c2.consigna}.`, `${c2.porQue}.`, c2.marcamos ? `${c2.marcamos}.` : ""].filter(Boolean).join(" ")],
      }
    : null;

  const orden: (Seccion | null)[] = esPost
    ? [claves, partido, rival, cruce, valoracion, tiempo, semana, apuntes, acumulado, equipo, categoria, seguimiento, cierre]
    : [claves, prioridades, tiempo, semana, valoracion, rival, suBalonParado, emparejamientos, cierre, apuntes, categoria, acumulado, seguimiento];

  orden.forEach((una) => {
    if (una) mete(una);
  });

  return lista;
}

function seccionHtml(seccion: Seccion) {
  return `<tr><td style="padding:22px 24px 4px"><h2 style="margin:0;font:700 15px/1.3 Arial,sans-serif;color:${NAVY};text-transform:uppercase;letter-spacing:.08em">${esc(seccion.titulo)}</h2>${
    seccion.pie
      ? `<p style="margin:4px 0 12px;font:400 12px/1.5 Arial,sans-serif;color:${SUAVE}">${esc(seccion.pie)}</p>`
      : `<div style="height:12px"></div>`
  }${seccion.html}</td></tr>`;
}

/**
 * El informe sin su marco: cabecera de cifras, avisos y secciones.
 *
 * Es lo que se mete DENTRO de otro correo —el del partido lleva el informe de
 * balón parado entero como una sección más— y lo que envuelve `informeHtml`
 * para el correo propio, así que hay una sola fuente. Va en una tabla al 100 %
 * para caber en un contenedor blanco de 760 px.
 *
 * `prefijoCid` antepone algo a cada `cid:` de los gráficos: en un correo con
 * otras imágenes (las diapositivas del partido) dos `cid` iguales se pisan.
 */
export function informeCuerpoHtml(
  informe: InformeMicro,
  opciones: { imagenes?: ModoImagenes; prefijoCid?: string } = {},
) {
  const modoImagenes = opciones.imagenes ?? "data";

  const prefijo = opciones.prefijoCid ?? "";

  const conPrefijo = prefijo
    ? { ...informe, graficos: informe.graficos.map((grafico) => ({ ...grafico, cid: `${prefijo}${grafico.cid}` })) }
    : informe;

  const resumen = conPrefijo.resumen
    .map(
      (dato) =>
        `<td style="padding:12px 14px;background:${CREMA};border:1px solid #E5E1D6;border-top:3px solid #C8A96B;border-radius:8px;width:33%"><p style="margin:0;font:600 10px/1.3 Arial,sans-serif;color:${SUAVE};text-transform:uppercase;letter-spacing:.08em">${esc(dato.rotulo)}</p><p style="margin:4px 0 0;font:700 24px/1.15 Arial,sans-serif;color:${NAVY}">${esc(dato.valor)}</p><p style="margin:2px 0 0;font:400 11px/1.4 Arial,sans-serif;color:${SUAVE}">${esc(dato.pie)}</p></td>`,
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

  /* Los avisos ya no van en el informe (04/10/2026): son trabajo pendiente de
     quien lo manda, y se le enseñan antes de enviar (AvisoAntesDeMandar). */
  const avisos = "";

  const secciones = seccionesDe(conPrefijo, modoImagenes).map(seccionHtml).join("\n");

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#FFFFFF">
<tr><td style="padding:18px 24px 0"><table role="presentation" width="100%" style="width:100%;border-collapse:separate;border-spacing:0">${resumen}</table></td></tr>

${avisos}

${secciones}
</table>`;
}

/** El informe como correo: tablas y estilos en línea, que es lo que sobrevive. */
export function informeHtml(
  informe: InformeMicro,
  opciones: { imagenes?: ModoImagenes; /** El bloque del vídeo (póster enlazado), ya en HTML: va bajo la cabecera. */ video?: string } = {},
) {
  /* «Del partido contra…» va bajo el titular, no antes (20/10/2026): competían dos titulares. */
  const esencia = pinceladaAbp(informe);

  /* La portada lleva el partido delante (22/10/2026); el microciclo y las fechas, al pie. */
  const lineaPartido = [informe.portada.pie, esencia.titular ? "" : informe.vieneDe].filter(Boolean);

  /*
  | Bajo el titular, sólo si habla de lo mismo (24/10/2026, marketing): la
  | línea del partido anterior sobre otro aspecto metía una segunda idea.
  */
  const primeraEsencia = informe.prioridades.find((una) => !una.esBanda);

  const vieneBajoTitular =
    informe.modo !== "post" && informe.vieneDe && (!primeraEsencia || informe.vieneDe.toLowerCase().includes(primeraEsencia.aspecto.toLowerCase())) ? informe.vieneDe : "";

  const cabecera = informe.portada.partido || informe.titulo;

  /*
  | Lo esencial arriba (14/10/2026): el titular y las claves de la pincelada,
  | y la barra de los minutos de la semana contra su objetivo, en la misma
  | franja azul de la cabecera. Quien sólo lee el principio ya sabe cómo ha ido.
  */
  const obj = informe.objetivo;
  const colorObjetivo = obj.veredicto === "corto" ? (obj.cumplido >= 0.95 ? "#D9A21B" : "#D97757") : "#4CC79F";
  const relleno = Math.max(3, Math.min(100, Math.round((obj.hechos / Math.max(1, obj.maximo)) * 100)));
  /* Sin un minuto (previa del lunes) la barra sería un cero: no sale (19/10/2026). */
  const barraObjetivo = obj.maximo && !informe.sinMinutos
    ?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td style="font:700 10px/1.3 Arial,sans-serif;color:${ORO};letter-spacing:.2em;text-transform:uppercase">Tiempo dedicado</td><td align="right" style="font:700 15px/1.3 Arial,sans-serif;color:#FFFFFF">${esc(fmtLargo(obj.hechos))} <span style="font:400 12px Arial,sans-serif;color:#9FB0C6">· ${esc(veredictoObjetivo(obj))} (${esc(fmtLargo(obj.minimo))} – ${esc(fmtLargo(obj.maximo))})</span></td></tr><tr><td colspan="2" style="padding-top:6px"><div style="height:10px;background:rgba(255,255,255,0.12);border-radius:5px"><div style="height:10px;width:${relleno}%;background:${colorObjetivo};border-radius:5px"></div></div></td></tr></table>`
    : "";
  const bloqueEsencial = esencia.titular
    ? `<tr><td style="padding:0 24px 22px;background:${NAVY}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(200,169,107,0.35)"><tr><td style="padding-top:16px"><p style="margin:0;font:700 10px/1.3 Arial,sans-serif;color:${ORO};letter-spacing:.24em;text-transform:uppercase">Lo esencial</p><p style="margin:6px 0 0;font:700 19px/1.35 Arial,sans-serif;color:#F2E6C9">${esc(esencia.titular)}</p>${
        vieneBajoTitular ? `<p style="margin:6px 0 0;font:400 13px/1.5 Arial,sans-serif;color:#9FB0C6">${esc(vieneBajoTitular)}</p>` : ""
      }${
        esencia.claves.length
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px">${esencia.claves
              .map((c, i) => `<tr><td valign="top" style="padding:3px 12px 3px 0;font:700 18px/1.2 Georgia,'Times New Roman',serif;color:${ORO}">${String(i + 1).padStart(2, "0")}</td><td valign="top" style="padding:4px 0;font:400 14px/1.5 Arial,sans-serif;color:#E6E9EF">${esc(c)}</td></tr>`)
              .join("")}</table>`
          : ""
      }${barraObjetivo}</td></tr></table></td></tr>`
    : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(`${cabecera} · ${informe.portada.que}`)}</title></head><body style="margin:0;padding:0;background:#EEEAE0">${
    informe.preencabezado ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(informe.preencabezado)}</div>` : ""
  }
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#EEEAE0;padding:18px 0"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="860" style="width:860px;max-width:96%;background:#FFFFFF;border-radius:12px;overflow:hidden">

<tr><td style="padding:22px 24px;background:${NAVY}">
  <p style="margin:0;font:600 10px/1.3 Arial,sans-serif;color:${ORO};text-transform:uppercase;letter-spacing:.28em">RMCF Castilla · Balón parado · ${esc(informe.modoRotulo)}</p>
  <h1 style="margin:8px 0 0;font:700 26px/1.2 Arial,sans-serif;color:#FFFFFF;letter-spacing:.02em">${esc(cabecera)}</h1>
  <p style="margin:6px 0 0;font:600 16px/1.4 Arial,sans-serif;color:#F2E6C9">${esc(informe.portada.que)}</p>
  ${lineaPartido.map((linea) => `<p style="margin:4px 0 0;font:400 12px/1.5 Arial,sans-serif;color:#9FB0C6">${esc(linea)}</p>`).join("")}
</td></tr>
${bloqueEsencial}
${opciones.video ?? ""}
<tr><td style="padding:0">${informeCuerpoHtml(informe, opciones)}</td></tr>

<tr><td style="padding:18px 24px 24px;border-top:1px solid #E5E1D6">
  <p style="margin:0;font:400 11px/1.6 Arial,sans-serif;color:${SUAVE}">Real Madrid Castilla · cuerpo técnico · ${esc(informe.generado)}</p>
</td></tr>

</table></td></tr></table></body></html>`;
}

/* ------------------------------------------------------------------ */
/*  LA PINCELADA: EL BALÓN PARADO EN CUATRO LÍNEAS                     */
/* ------------------------------------------------------------------ */

/**
 * Lo esencial del informe de balón parado para otro documento (el resumen
 * del partido en dos diapositivas): un titular, hasta tres claves cortas,
 * hasta cuatro cifras grandes y hasta dos conclusiones del rival.
 *
 * Sale del informe ya montado —no recalcula nada—, así que dice lo mismo que
 * el informe completo, sólo que más corto.
 */
export type PinceladaAbp = {
  modo: "previa" | "post";
  titular: string;
  claves: string[];
  cifras: { rotulo: string; valor: string; pie?: string }[];
  rival: string[];
  /**
   * Los minutos de ABP de la semana, los MISMOS del informe (`minutosAbp`,
   * 19/10/2026). Para que el resumen del partido y el vídeo no cuenten otros:
   * `texto` ya dice qué cuenta. Opcional para no romper a quien lea la forma
   * de antes (`lib/informe-partido/modelo.ts`).
   */
  minutos?: { confirmados: number; propuestos: number; texto: string };
  /** Post: lo que nos dio peligro en contra, como consigna y dato, para «Qué toca» del informe del partido (22/10/2026). */
  sustoEnContra?: { consigna: string; dato: string; /** Sin muestra: para vigilar, no la prioridad (25/10/2026). */ corta?: boolean } | null;
  /** Post: los goles esperados del partido a balón parado (25/10/2026), para revisar la palanca del pronóstico. */
  xgPartido?: { favor: number; contra: number } | null;
  /**
   * Previa: la prioridad nº 1 de balón parado, como consigna («Defendemos la
   * falta lateral directa») y como frase corta (el titular del informe de
   * ABP), para que la previa del partido la use tal cual (24/10/2026).
   */
  prioridad?: { consigna: string; texto: string } | null;
};

/**
 * Lo esencial del informe, para el resumen del partido, el vídeo y la cabecera
 * (20/10/2026, segunda ronda de los expertos):
 *
 * - Previa: el titular es la consigna contra el rival («Contra el Algeciras,
 *   defendemos el córner directo: 4 de 27…»); las claves no lo repiten: qué
 *   hace el rival en eso, si está en el plan y qué más sube.
 * - Post: el titular sólo sale de un gol o de un veredicto con muestra; las
 *   claves, en orden: qué no salió, qué salió y qué toca el próximo micro.
 *
 * Ninguna frase se corta a media palabra (`breve`).
 */
/** Las siglas que van en mayúsculas al pasar «ALGECIRAS CF» a «Algeciras CF». */
const SIGLAS_EN_MAYUSCULA = new Set(["cf", "ud", "cd", "sd", "rc", "fc", "rcd", "sad", "ad", "cp", "ce", "ue", "sc"]);

/** El nombre como lo escribe Wyscout («Algeciras»), no en mayúsculas de la hoja (20/10/2026). */
function rivalBonito(informe: InformeMicro) {
  const rivalHoja = informe.subtitulo.match(/^Contra (.+?)(?: · |$)/)?.[1] ?? "";

  return (
    informe.rivalAbp?.equipo ||
    (rivalHoja === rivalHoja.toUpperCase()
      ? rivalHoja
          .toLowerCase()
          .split(" ")
          .map((palabra) => (SIGLAS_EN_MAYUSCULA.has(palabra) ? palabra.toUpperCase() : `${palabra.charAt(0).toUpperCase()}${palabra.slice(1)}`))
          .join(" ")
      : rivalHoja)
  );
}

/** La primera variante que cabe en `tope` caracteres; si ninguna, la última. */
function laQueCabe(variantes: string[], tope: number) {
  const buenas = variantes.filter(Boolean);

  return buenas.find((una) => una.length <= tope) ?? buenas[buenas.length - 1] ?? "";
}

/**
 * El titular de la previa (20/10/2026): la consigna contra el rival con su
 * base, en 80 caracteres como mucho. Si no cabe, primero se van los goles y
 * luego el rival; la base se queda, que es el porqué.
 */
/** «el córner directo» → «el córner»; «la falta lateral directa» → «la falta lateral». */
/** «; 2 goles con 0,91 goles esperados», « (0,16 goles esperados)» o nada (26/10/2026). */
function golesConXg(una: { goles: number; xg: number }) {
  const xg = una.xg > 0 ? `${dec(una.xg, 2)} goles esperados` : "";

  if (una.goles > 0) return `; ${plural(una.goles, "gol", "goles")}${xg ? ` con ${xg}` : ""}`;

  return xg ? ` (${xg})` : "";
}

function aspectoCorto(aspecto: string) {
  return conArticulo(aspecto).replace(/ (?:directo|directa|indirecto|indirecta)$/, "");
}

/**
 * Los dos aspectos que se mantienen cuando no hay señal clara en contra
 * (25/10/2026, ronda 7): «el córner y la falta lateral». Vacío si hay señal.
 */
function sinSenalEnFrase(informe: InformeMicro, primera: LineaEquipo | undefined) {
  if (!informe.sinSenal || !primera || primera.lado !== "defensivo") return "";

  const a = aspectoCorto(primera.aspecto);

  const b = informe.sinSenal.otra ? aspectoCorto(informe.sinSenal.otra.aspecto) : "";

  return b && b !== a ? `${a} y ${b}` : a;
}

/**
 * La prioridad de la previa como consigna y como titular, la misma en el
 * informe, el asunto, la pincelada y la previa del partido (25/10/2026).
 */
function prioridadDePrevia(informe: InformeMicro, rival: string): { consigna: string; texto: string } | null {
  const primera = informe.prioridades.find((una) => !una.esBanda) ?? informe.prioridades[0];

  if (!primera) return null;

  const dos = sinSenalEnFrase(informe, primera);

  if (dos) {
    /*
    | En lenguaje de campo (26/10/2026, fútbol, marketing y guion): lo que
    | hacemos el domingo; «sin señal clara» se leía como «nada que hacer».
    | Con sus rematadores marcados, quién tiene dueño.
    */
    const nombres = (informe.emparejamientos?.marcamos ?? [])
      .filter((m) => !m.startsWith("La pone") && !m.endsWith("si entra"))
      .slice(0, 2)
      .map((m) => m.split(":")[0].split(" (")[0].trim());

    const remataPoco = primera.sentidoRival === "baja" && rival;

    return {
      consigna: `Defendemos ${dos}`,
      texto: laQueCabe(
        [
          nombres.length ? `Defendemos ${dos}: ${fraseLista(nombres)} ${nombres.length > 1 ? "tienen" : "tiene"} dueño` : "",
          remataPoco ? `Defendemos ${dos}, aunque el ${rival} remata poco` : "",
          `Defendemos ${dos}`,
        ].filter(Boolean),
        80,
      ),
    };
  }

  return { consigna: consignaDe(primera.aspecto, primera.lado), texto: titularPrevia(primera, rival) };
}

function titularPrevia(primera: LineaEquipo, rival: string) {
  const consigna = consignaDe(primera.aspecto, primera.lado);

  /* «Defendemos la falta lateral directa» → «Defendemos la falta lateral» si no cabe. */
  const consignaCorta = consigna.replace(/^(\S+ (?:el|la|los) \S+ \S+) \S+$/, "$1");

  /*
  | Que se entienda a la primera (22/10/2026): «2 de 8 con peligro» no decía
  | qué contaba. Ahora, qué hicieron esas acciones y, si el rival lo hace
  | subir, por qué importa esta semana.
  */
  const defensivo = primera.lado === "defensivo";

  const hecho = defensivo
    ? `${primera.peligros} de ${primera.acciones} ${primera.peligros === 1 ? "nos creó" : "nos crearon"} peligro`
    : `${primera.peligros} de ${primera.acciones} ${primera.peligros === 1 ? "acabó" : "acabaron"} en peligro`;

  const ante = rival ? ` ante el ${rival}` : "";

  /*
  | Una idea por titular (23/10/2026, equipo de expertos): «Defendemos la
  | falta lateral: 2 de 8 nos crearon peligro, y el Algeciras saca 3 faltas
  | por partido» eran dos ideas y 18 palabras. Ahora, la más fuerte de las
  | que hay, por este orden: los goles que nos costó, lo que el rival hace
  | subir (si la base es corta, el titular no la vende como certeza), lo que
  | nos hizo el partido anterior y, si no, la base.
  */
  if (defensivo && primera.goles > 0) {
    return laQueCabe([`${consigna}: nos ha costado ${plural(primera.goles, "gol", "goles")} esta temporada`, `${consignaCorta}: nos ha costado ${plural(primera.goles, "gol", "goles")}`], 80);
  }

  if (!defensivo && primera.goles > 0) {
    return laQueCabe([`${consigna}${ante}: ya nos ha dado ${plural(primera.goles, "gol", "goles")}`, `${consignaCorta}: ya nos ha dado ${plural(primera.goles, "gol", "goles")}`], 80);
  }

  if (primera.sentidoRival === "sube" && primera.contraRivalCorto) {
    const delRival = primera.contraRivalCorto.replace(/(\d+),0\b/g, "$1");

    return laQueCabe([`${consigna}: ${delRival}`, `${consignaCorta}: ${delRival}`], 80);
  }

  if (primera.delAnterior) return laQueCabe([`${consigna}: ${primera.delAnterior}`, `${consignaCorta}: ${primera.delAnterior}`], 80);

  return laQueCabe([`${consigna}${ante}: ${hecho}`, `${consigna}: ${hecho}`, `${consignaCorta}: ${hecho}`], 80);
}

/**
 * El asunto y el preencabezado con la idea (20/10/2026, equipo de expertos):
 * nada de «[PREVIA] RMCF Castilla · ABP · Microciclo 18», que se cortaba en el
 * móvil antes de decir nada. Previa: la consigna con su base. Post: el
 * marcador, los goles a balón parado y lo que más pesó.
 */
function asuntoAbp(
  informe: InformeMicro,
  partido: { jornada: number | null; golesFavor: number | null; golesContra: number | null },
) {
  const rival = rivalBonito(informe);

  const j = partido.jornada ? ` J${partido.jornada}` : "";

  const p = pinceladaAbp(informe);

  if (informe.modo === "post") {
    const pa = informe.partidoAbp;

    const hayMarcador = partido.golesFavor !== null && partido.golesContra !== null;

    const marcador = hayMarcador
      ? `, ${partido.golesFavor}-${partido.golesContra} ${partido.golesFavor! > partido.golesContra! ? "al" : "ante el"} ${rival}`
      : rival
        ? ` ante el ${rival}`
        : "";

    if (!pa) return { asunto: `Balón parado${j}${marcador}`, preencabezado: p.claves[0] ?? "" };

    const golesAbp = pa.favor.goles + pa.contra.goles;

    const goles =
      golesAbp === 0
        ? "ningún gol"
        : [pa.favor.goles ? `${plural(pa.favor.goles, "gol", "goles")} a favor` : "", pa.contra.goles ? `${plural(pa.contra.goles, "gol", "goles")} en contra` : ""].filter(Boolean).join(" y ");

    const top = loQueMasPeligroDio(pa);

    const susto = pa.cruce
      .filter((una) => una.medible && una.lado === "defensivo" && una.peligros >= 2)
      .sort((a, b) => b.peligros - a.peligros)[0];

    const idea =
      top && top.goles === 0
        ? top.lado === "defensivo"
          ? `${conArticulo(top.aspecto)} nos hizo daño`
          : `${conArticulo(top.aspecto)} nos salió`
        : !top && susto
          ? `en ${conArticulo(susto.aspecto)} nos remataron ${susto.remates >= susto.peligros ? susto.remates : susto.peligros} de ${susto.acciones}`
          : "";

    const union = idea ? (golesAbp === 0 || pa.contra.goles === 0 ? ", pero " : "; ") : "";

    const candidato = candidatosDelPartido(pa)[0];

    return {
      /* En 80 caracteres: si no cabe, «la falta lateral directa» se queda en «la falta lateral». */
      asunto: laQueCabe([`Balón parado${j}${marcador}: ${goles}${union}${idea}`, `Balón parado${j}${marcador}: ${goles}${union}${idea.replace(/^((?:en )?(?:el|la|los) \S+ \S+) \S+/, "$1")}`], 90),
      preencabezado: candidato ? `Para el próximo microciclo: ${aspectoEnFrase(candidato.aspecto, candidato.lado)}` : (p.claves[0] ?? ""),
    };
  }

  const conRemate = informe.prioridades.filter((una) => !una.esBanda);

  const primera = conRemate[0] ?? informe.prioridades[0];

  const cabeza = `Balón parado${j}${rival ? ` ${rival}` : ""}`;

  if (!primera) return { asunto: `${cabeza}: lo planificado de la semana`, preencabezado: p.claves[0] ?? "" };

  /* «defendemos el córner directo» se queda en «defendemos el córner» si no cabe. */
  const consigna = enMinuscula(prioridadDePrevia(informe, rival)?.consigna ?? consignaDe(primera.aspecto, primera.lado));

  const corta = consigna.replace(/^(\S+ (?:el|la|los) \S+).*$/, "$1");

  /* Sin señal clara, el asunto no lleva una base que no aguanta (25/10/2026). */
  const asunto = informe.sinSenal
    ? laQueCabe([`${cabeza}: ${consigna}, sin señal clara en contra`, `${cabeza}: ${consigna}`, `${cabeza}: ${corta}`], 78)
    : laQueCabe([`${cabeza}: ${consigna}, ${primera.base} con peligro`, `${cabeza}: ${corta}, ${primera.base} con peligro`, `${cabeza}: ${corta}`], 78);

  const dias = [...new Set(informe.trabajos.map((una) => una.dia.toLowerCase()))];

  const accion = dias.length
    ? `Ya está en el plan: ${fraseLista(dias)} (${plural(informe.trabajos.length, "tarea", "tareas")})`
    : "";

  return {
    asunto,
    preencabezado: [accion, primera.contraRival ? mayuscula(primera.contraRival) : ""].filter(Boolean).join(". "),
  };
}

export function pinceladaAbp(informe: InformeMicro): PinceladaAbp {
  const rivalNombre = rivalBonito(informe);

  const conclusiones = (informe.rivalAnalisis?.conclusiones ?? [])
    .filter((una) => una.texto.trim())
    .slice(0, 2)
    .map((una) => breve(`${una.seccion}: ${una.texto}`, 110));

  /* Sin conclusiones escritas, lo que Wyscout mide de su balón parado (19/10/2026).
     Las líneas de «2 informes en PDF» eran trámite, no relato: fuera (20/10/2026). */
  const rival = conclusiones.length
    ? conclusiones
    : (informe.rivalAbp?.lineas ?? []).slice(0, 1).map((linea) => breve(`Su balón parado: ${enMinuscula(linea)}`, 120));

  /* Una sola cifra de minutos para todo (`minutosAbp`): la del informe. */
  const minutos = Math.round(informe.minutosAbp.confirmados);

  const minutosPincelada = {
    confirmados: informe.minutosAbp.confirmados,
    propuestos: informe.minutosAbp.propuestos,
    texto: informe.minutosAbp.texto,
  };

  const objetivo = `${fmtMin(informe.objetivo.minimo)}-${fmtMin(informe.objetivo.maximo)}`;

  const pieMinutos = `objetivo ${objetivo}`;

  const tareas = informe.valoracion.valoradas
    ? [
        {
          rotulo: "Tareas valoradas",
          valor: `${informe.valoracion.valoradas}/${informe.valoracion.total}`,
          pie: informe.valoracion.media === null ? undefined : `media ${dec(informe.valoracion.media)}`,
        },
      ]
    : [];

  if (informe.modo === "post") {
    const p = informe.partidoAbp;

    if (!p) {
      return {
        modo: "post",
        /* Sin el partido en las hojas, se habla de la semana y no se nombra lo que falta. */
        titular: `${rivalNombre ? `La semana del partido ante ${rivalNombre}: ` : "La semana: "}${fmtMin(minutos)} de balón parado`,
        claves: [`Objetivo de la semana: ${objetivo}`],
        cifras: [{ rotulo: "Minutos de ABP", valor: fmtMin(minutos), pie: pieMinutos }, ...tareas],
        rival,
        minutos: minutosPincelada,
      };
    }

    const trabajadas = p.cruce.filter((una) => una.trabajado && una.medible);

    const aparecieron = trabajadas.filter((una) => una.acciones > 0);

    /* Sólo se juzga lo que tuvo muestra (`muestraSuficiente`) o goles: el tono ya lo trae. */
    const buenas = aparecieron.filter((una) => una.tono === "bien");
    const malas = aparecieron.filter((una) => una.tono === "mal");

    const nombre = (una: LineaCruce) => aspectoEnFrase(una.aspecto, una.lado);

    const candidato = candidatosDelPartido(p)[0];

    /*
    | En este orden (20/10/2026): qué falló, qué salió y qué entrenamos la
    | semana que viene. La cuenta de lo trabajado baja al detalle; sólo sube
    | si no hay nada con veredicto.
    */
    /*
    | Lo que nos remataron sin veredicto (22/10/2026): la causa —lo que se le
    | dio en la semana— y las acciones, contadas desde la hoja. «De 13
    | aspectos trabajados aparecieron 8» dependía del azar: fuera.
    */
    const sustoSin = sustoDelPartido(p);

    /*
    | El porqué del susto (23/10/2026): el titular ya dice cuánto se le dio;
    | aquí, cómo se repartió la semana, que es lo que se corrige.
    */
    const lados = informe.minutosAbp.porLado;

    /*
    | La historia, en tres frases cortas (24/10/2026, guionista): a qué se le
    | dio la semana, qué nos hicieron y los goles. El reparto, con el total
    | como suma exacta de sus partes (antes 1 h 13 min + 8 min ≠ 1 h 20 min).
    */
    const historia = ataqueYDanoEnContra(p, lados);

    /* «Le dimos 1 h 13 min de 1 h 20 min al ataque» no se entendía a la primera (25/10/2026, guionista): la proporción, en palabras. */
    const enDecimos = lados && minutos > 0 ? Math.round((lados.ofensivo / minutos) * 10) : 0;

    const semanaSusto = sustoSin
      ? historia && lados
        ? enDecimos >= 9
          ? "Nueve de cada diez minutos de balón parado fueron al ataque"
          : `${enDecimos} de cada diez minutos de balón parado fueron al ataque`
        : sustoSin.minutos > 0
          ? `Le dimos ${fmtLargo(sustoSin.minutos)} en la semana, de ${fmtLargo(minutos)} de balón parado`
          : "No se trabajó en la semana"
      : "";

    /* Sin muestra, el hecho con su base y sin diagnóstico (25/10/2026, ronda 7). */
    const hechoSusto = historia
      ? `${mayuscula(conArticulo(historia.aspecto))} en contra: ${danoEnFrase(historia)}`
      : sustoSin
        ? `${mayuscula(conArticulo(sustoSin.aspecto))} en contra: ${danoEnFrase(sustoSin)}`
        : "";

    const accionesSusto = sustoSin
      ? p.peligrosas.filter((una) => una.lado === "defensivo" && una.aspecto === sustoSin.aspecto).slice(0, 2).map((una) => una.corto)
      : [];

    const titularPre = titularPost(p, informe.minutosAbp.porLado);

    const claves = [
      historia ? semanaSusto : "",
      hechoSusto,
      malas.length ? `No salió: ${fraseLista(malas.slice(0, 2).map(nombre))}` : "",
      buenas.length ? `Salió bien: ${fraseLista(buenas.slice(0, 2).map(nombre))}` : "",
      /* Los goles del partido, si el titular no los dice ya (23/10/2026): «Ninguno de los 5 goles fue a balón parado». */
      sustoSin && p.marcador && !/^Cero goles/.test(titularPre) ? golesAbpEnFrase(p.marcador, p.favor.goles, p.contra.goles) : "",
      historia ? "" : semanaSusto,
      ...accionesSusto,
      !sustoSin && candidato ? `Para el próximo microciclo: ${nombre(candidato)}` : "",
      repartoDelPartido(p),
    ]
      .filter(Boolean)
      .map((una) => breve(una, 90));

    const titular =
      titularPre ||
      (p.favor.goles > p.contra.goles
        ? `El balón parado sumó: ${p.favor.goles}-${p.contra.goles}${rivalNombre ? ` ante ${rivalNombre}` : ""}`
        : `El balón parado restó: ${p.favor.goles}-${p.contra.goles}${rivalNombre ? ` ante ${rivalNombre}` : ""}`);

    /* El susto en contra, para que el informe del partido lo lleve a «Qué toca» (22/10/2026). */
    const susto = p.cruce.filter((una) => una.medible && una.lado === "defensivo" && una.peligros >= 2).sort((a, b) => b.peligros - a.peligros)[0];

    return {
      modo: "post",
      titular,
      /* Con muestra o sin ella (25/10/2026, ronda 7): «corta» le dice al informe del partido que es para vigilar, no la prioridad. */
      sustoEnContra: susto
        ? sustoConMuestra(susto)
          ? { consigna: `Defendemos ${conArticulo(susto.aspecto)}`, dato: `${susto.peligros} de ${susto.acciones} con peligro en contra en el partido`, corta: false }
          : { consigna: `Vigilamos ${conArticulo(susto.aspecto)} en contra`, dato: `${danoEnFrase(susto)}: base corta`, corta: true }
        : null,
      /* Los goles esperados del partido a balón parado, para revisar la palanca del pronóstico (25/10/2026). */
      xgPartido: { favor: p.favor.xg, contra: p.contra.xg },
      claves: claves.slice(0, 3),
      cifras: [
        { rotulo: "Goles ABP", valor: `${p.favor.goles}·${p.contra.goles}`, pie: "a favor · en contra" },
        { rotulo: "Remates ABP", valor: `${p.favor.remates}·${p.contra.remates}`, pie: "a favor · en contra" },
        { rotulo: "xG ABP", valor: `${dec(p.favor.xg, 2)}·${dec(p.contra.xg, 2)}`, pie: "a favor · en contra" },
        { rotulo: "Minutos de ABP", valor: fmtMin(minutos), pie: pieMinutos },
      ],
      rival,
      minutos: minutosPincelada,
    };
  }

  /*
  | Previa. La prioridad número uno —con su base— manda, dicha como consigna
  | contra el rival. Sin un minuto todavía (el lunes), ni minutos ni «sin
  | trabajar»: lo planificado (19/10/2026).
  */
  const conRemate = informe.prioridades.filter((una) => !una.esBanda);
  const banda = informe.prioridades.find((una) => una.esBanda);
  const primera = conRemate[0] ?? banda;

  const aspectos = new Set(informe.trabajos.flatMap((una) => una.aspectos.split(/,\s*/)).filter(Boolean)).size;

  const nombre = (una: LineaEquipo) => aspectoEnFrase(una.aspecto, una.lado);

  /* «4 de 27 con peligro en contra y 2 goles encajados». */
  const baseDe = (una: LineaEquipo) =>
    `${una.base} con peligro${una.lado === "defensivo" ? " en contra" : ""}${una.goles ? ` y ${plural(una.goles, una.lado === "defensivo" ? "gol encajado" : "gol", una.lado === "defensivo" ? "goles encajados" : "goles")}` : ""}`;

  /*
  | Lo que dice el rival de la prioridad nº 1 (20/10/2026). Si el rival la
  | hace bajar y aun así sigue primera, se dice: no puede parecer un descuido.
  */
  const delRival = primera?.contraRival
    ? primera.sentidoRival === "baja"
      ? `Contra ellos pesa menos (${primera.contraRival}), pero sigue siendo la nº 1`
      : mayuscula(primera.contraRival)
    : "";

  /* El hilo con el partido anterior y la referencia de su base (20/10/2026). */
  /* Si la línea «Del partido contra…» ya lo cuenta, no se repite: va la referencia. */
  const porQue = primera?.delAnterior && !informe.vieneDe.includes(conArticulo(primera.aspecto))
    ? mayuscula(primera.delAnterior)
    : primera?.referencia
      ? `${/^(por|en línea)/.test(primera.referencia) ? "Está" : "Es"} ${primera.referencia}`
      : "";

  const subeOtra = informe.prioridades.find((una) => una !== primera && una.sentidoRival === "sube" && una.contraRival);

  const otraQueSube = subeOtra ? `${mayuscula(conArticulo(subeOtra.aspecto))} ${ladoConcordado(subeOtra.aspecto, subeOtra.lado)} pesa más contra ellos: ${subeOtra.contraRival}` : "";

  if (informe.sinMinutos) {
    const dias = [...new Set(informe.trabajos.map((una) => una.dia.toLowerCase()))];

    const enElPlan = primera && dias.length
      ? primera.planificado
        ? `Ya está en el plan: ${fraseLista(dias)} (${plural(informe.trabajos.length, "tarea", "tareas")})`
        : `No figura en el plan: ${fraseLista(dias)} (${plural(informe.trabajos.length, "tarea", "tareas")})`
      : dias.length
        ? `Planificado: ${fraseLista(dias)} (${plural(informe.trabajos.length, "tarea", "tareas")})`
        : "";

    /*
    | Primero el umbral honesto (22/10/2026): si la prioridad es tendencia, va
    | antes que nada. Lo que el titular ya dice del rival no se repite: va la
    | referencia en su lugar.
    */
    /*
    | Qué dijo ya el titular (23/10/2026): los goles, el rival o el partido
    | anterior, por ese orden. Lo que dijo no se repite; lo que no, va aquí.
    */
    const titularDeGoles = Boolean(primera && primera.goles > 0);
    const titularConRival = Boolean(primera && !titularDeGoles && primera.sentidoRival === "sube" && primera.contraRivalCorto);
    const titularConAnterior = Boolean(primera && !titularDeGoles && !titularConRival && primera.delAnterior);

    /*
    | El patrón del último partido: «Las 2 con peligro contra el Antequera CF:
    | desde Z4 interior, envío bombeado al segundo palo». La consigna que sale
    | de él («El segundo palo tiene dueño…») va sólo en «Para el domingo»: cada
    | frase, una vez (25/10/2026, guionista).
    */
    const patron = primera?.patron ? mayuscula(primera.patron) : "";

    /*
    | Con los goles en el titular, de cuántos y con qué (23/10/2026): «2 de
    | los 3 goles que nos han marcado a balón parado; 8 remates en 27
    | acciones». La referencia contra el resto confundía: el córner puede
    | estar por debajo en ocasiones y por encima en goles.
    */
    const golesLado = primera ? informe.equipo.filter((una) => una.lado === primera.lado && !una.esBanda).reduce((t, una) => t + una.goles, 0) : 0;

    const dePartido = primera?.lado === "defensivo" ? "que nos han marcado" : "que hemos marcado";

    const base =
      primera && titularDeGoles
        ? `${golesLado > primera.goles ? `${primera.goles} de los ${golesLado} goles ${dePartido} a balón parado` : `Todos los goles ${dePartido} a balón parado`}; ${plural(primera.remates, "remate", "remates")} en ${primera.acciones} acciones`
        : "";

    const porQueSinRepetir = titularConAnterior ? (primera?.referencia ? `${/^(por|en línea)/.test(primera.referencia) ? "Está" : "Es"} ${primera.referencia}` : "") : porQue;

    /* Lo que bajó a segundo plano aunque costó goles, dicho (24/10/2026): si no, parecía un descuido. */
    const segundo = conRemate.find((una) => una.segundoPlano)?.segundoPlano ?? "";

    /*
    | Sin señal clara en contra (25/10/2026, ronda 7): lo esencial dice por qué
    | —ninguna pasa la regla de muestra—, con la base y los goles esperados de
    | cada una, y lo que pesa el rival. Nada se vende como certeza.
    */
    const otraVigilada = informe.sinSenal?.otra ?? null;

    /* Corta, para que quepa entera (25/10/2026): «El córner directo en contra: 4 de 27 con peligro, 2 goles y 0,85 goles esperados». */
    /* Goles reales junto a los esperados (26/10/2026, análisis): «2 goles con 0,91 goles esperados». */
    const conXg = (una: LineaEquipo) => `${mayuscula(conArticulo(una.aspecto))} en contra: ${una.base} con peligro${golesConXg(una)}`;

    const clavesSinSenal =
      informe.sinSenal && primera
        ? [
            conXg(primera),
            otraVigilada ? conXg(otraVigilada) : "",
            /* El porqué de cada una, sin generalizar: una puede tener muestra y aun así no apretar. */
            `Ninguna da una señal clara: ${[primera, otraVigilada]
              .filter((una): una is LineaEquipo => Boolean(una))
              .map((una) => `${aspectoCorto(una.aspecto)}, ${!una.tendencia && /^(por debajo|la mitad)/.test(una.referencia) && una.sentidoRival === "baja" ? `por debajo del resto y el rival ${/^la /.test(aspectoCorto(una.aspecto)) ? "la" : "lo"} hace bajar` : "base corta"}`)
              .join("; ")}`,
            primera.contraRival ? mayuscula(primera.contraRival) : "",
            enElPlan,
          ]
        : null;

    const claves = (
      clavesSinSenal ?? [
        patron,
        primera?.tendencia ?? "",
        base || porQueSinRepetir,
        segundo,
        titularConRival ? "" : delRival,
        enElPlan,
        otraQueSube,
        banda && banda !== primera ? `Saques de banda, aparte: ${nombre(banda)}, ${banda.base} con peligro` : "",
        conRemate[1] && !conRemate[1].segundoPlano ? `Después: ${nombre(conRemate[1])}, ${baseDe(conRemate[1])}` : "",
      ]
    )
      .filter(Boolean)
      .map((una) => breve(una, una === patron || una === segundo || una.startsWith("Ninguna da") ? 160 : 110))
      .filter((una, i, todas) => todas.indexOf(una) === i);

    const laPrioridad = prioridadDePrevia(informe, rivalNombre);

    /*
    | Nuestro balón parado ofensivo, en una línea (26/10/2026, fútbol): lo
    | mejor que tenemos con muestra y, si Wyscout lo dice, si el rival lo concede.
    */
    const mejorOfensivo = informe.equipo
      .filter((una) => una.lado === "ofensivo" && !una.esBanda && una.acciones >= MINIMO_ACCIONES_PRIORIDAD && una.peligros > 0)
      .sort((a, b) => b.peligros / b.acciones - a.peligros / a.acciones)[0];

    const ofensivo = mejorOfensivo
      ? `Atacando, lo mejor que tenemos: ${aspectoCorto(mejorOfensivo.aspecto)}, ${mejorOfensivo.base} con peligro${mejorOfensivo.sentidoRival === "sube" && mejorOfensivo.contraRivalCorto ? `, y ${mejorOfensivo.contraRivalCorto}` : ""}`
      : "";

    const clavesConOfensivo = ofensivo && !claves.some((una) => una.startsWith("Atacando")) ? [...claves.slice(0, 3), ofensivo] : claves;

    return {
      modo: "previa",
      titular: laPrioridad
        ? laPrioridad.texto
        : rivalNombre
          ? `Balón parado para el ${rivalNombre}: lo planificado de la semana`
          : "Balón parado: lo planificado de la semana",
      claves: clavesConOfensivo.slice(0, 4),
      /* La nº 1 lista para la previa del partido (24/10/2026): la misma consigna y la misma frase, sin rehacerla allí. */
      prioridad: laPrioridad,
      cifras: [
        ...(primera ? [{ rotulo: informe.sinSenal ? "Lo que mantenemos" : "Prioridad nº 1", valor: primera.base, pie: `${mayuscula(nombre(primera))}: con peligro${primera.lado === "defensivo" ? " en contra" : ""}${golesConXg(primera)}${informe.sinSenal ? " · base corta" : primera.tendencia ? " · aviso reciente" : ""}` }] : []),
        ...(informe.trabajos.length ? [{ rotulo: "Planificado", valor: String(informe.trabajos.length), pie: informe.trabajos.length === 1 ? "tarea" : "tareas" }] : []),
      ],
      rival,
      minutos: minutosPincelada,
    };
  }

  const veredicto =
    informe.objetivo.veredicto === "corto"
      ? `faltan ${fmtMin(informe.objetivo.faltan)} para el objetivo`
      : informe.objetivo.veredicto === "pasado"
        ? "por encima del objetivo"
        : "dentro del objetivo";

  const sinTocar = conRemate.filter((una) => una.minSemana === 0 && una !== primera);

  const claves = [
    primera
      ? `${consignaDe(primera.aspecto, primera.lado)}: ${primera.base} con peligro · ${primera.minSemana > 0 ? `${fmtMin(primera.minSemana)} esta semana` : "sin trabajar esta semana"}`
      : "",
    porQue,
    delRival,
    `${fmtMin(minutos)} de balón parado en la semana, ${veredicto} (${objetivo})`,
    sinTocar.length ? `Sin trabajar: ${sinTocar.slice(0, 2).map(nombre).join(" y ")}` : "",
    otraQueSube,
  ]
    .filter(Boolean)
    .map((una) => breve(una, 90));

  return {
    modo: "previa",
    titular: `Esta semana, ${fmtMin(minutos)} de balón parado${rivalNombre ? ` para el ${rivalNombre}` : ""}: ${veredicto}`,
    claves: claves.slice(0, 3),
    cifras: [
      { rotulo: "Minutos de ABP", valor: fmtMin(minutos), pie: pieMinutos },
      {
        rotulo: "Aspectos trabajados",
        valor: String(aspectos),
        pie: conRemate.length ? `${conRemate.length - conRemate.filter((una) => una.minSemana === 0).length} de ${conRemate.length} prioridades` : undefined,
      },
      ...tareas,
    ],
    rival,
    minutos: minutosPincelada,
  };
}


/**
 * El mismo informe en texto, para quien lea el correo sin formato.
 *
 * Las mismas secciones, en el mismo orden y con los mismos títulos que el
 * HTML: salen de `seccionesDe`. Lo único que no lleva son los gráficos; su
 * dato ya va en el pie o en las líneas de cada sección.
 */
export function informeTexto(informe: InformeMicro) {
  const lineas: string[] = [];

  lineas.push(informe.portada.partido || informe.titulo.toUpperCase());
  lineas.push(informe.portada.que);
  lineas.push(informe.portada.pie);

  if (informe.vieneDe) lineas.push(informe.vieneDe);

  lineas.push("");

  informe.resumen.forEach((dato) => {
    lineas.push(`- ${dato.rotulo}: ${dato.valor} (${dato.pie})`);
  });


  seccionesDe(informe, "data").forEach((seccion) => {
    lineas.push("", seccion.titulo.toUpperCase());

    if (seccion.pie) lineas.push(seccion.pie);

    seccion.texto.forEach((linea) => lineas.push(linea));
  });

  lineas.push(
    "",
    `Generado automáticamente por la plataforma del Real Madrid Castilla · ${informe.generado}`,
  );

  return lineas.join("\n");
}
