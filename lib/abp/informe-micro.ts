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
  /** La familia de la acción («corner», «falta-lateral»…): para cruzarla con Wyscout. */
  familia: string;
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
};

export type InformeMicro = {
  modo: ModoInforme;
  asunto: string;
  /** «Previa del partido» · «Post partido». */
  modoRotulo: string;
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
  minutosAbp: { confirmados: number; propuestos: number; campo: number; video: number; texto: string };
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
const WYSCOUT_FAMILIA: Record<string, { volumen: string; remate: string | null; nombre: string } | undefined> = {
  corner: { volumen: "corners", remate: "cornersRemate", nombre: "córners" },
  "falta-lateral": { volumen: "faltasTiro", remate: "faltasRemate", nombre: "faltas" },
  "falta-directa": { volumen: "faltasTiro", remate: "faltasRemate", nombre: "faltas" },
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

      return { key, valor, sitio, fuerza };
    })
    .filter((una): una is { key: string; valor: number; sitio: number; fuerza: number } => una !== null);

  if (!lecturas.length) return null;

  const fuerza = lecturas.reduce((s, una) => s + una.fuerza, 0) / lecturas.length;

  const sentido = fuerza >= 0.65 ? ("sube" as const) : fuerza <= 0.35 ? ("baja" as const) : null;

  /* La línea, con la métrica más extrema en el sentido que manda. */
  const elegida = [...lecturas].sort((a, b) => (sentido === "baja" ? a.fuerza - b.fuerza : b.fuerza - a.fuerza))[0];

  const v = fmtMedida(elegida.valor, elegida.key);

  const rival = ra.equipo;

  const dice =
    cara === "favor"
      ? elegida.key === medida.remate
        ? `el ${rival} remata el ${v} de sus ${medida.nombre}`
        : elegida.key === "penaltis"
          ? `el ${rival} tiene ${v} penaltis a favor por partido`
          : `el ${rival} saca ${v} ${medida.nombre} por partido`
      : elegida.key === medida.remate
        ? `al ${rival} le rematan el ${v} de los ${medida.nombre}`
        : elegida.key === "penaltis"
          ? `el ${rival} concede ${v} penaltis por partido`
          : `el ${rival} concede ${v} ${medida.nombre} por partido`;

  return {
    factor: 0.7 + 0.6 * fuerza,
    sentido,
    motivo: sentido ? `${dice} (${elegida.sitio}.º de ${n})` : "",
  };
}

function filaEquipo(
  fila: FilaCruce,
  semana?: { minutos: Map<string, number>; planificado: Set<string> },
  ra: RivalAbpInforme | null = null,
): LineaEquipo {
  const clave = claveAspecto(fila.aspecto.key, fila.lado);

  /* Los minutos de la semana, los que cuentan (`minutosAbp`), no los del plan entero. */
  const minSemana = semana ? (semana.minutos.get(clave) ?? 0) : fila.minutosMicro;

  const delRival = pesoDelRival(fila, ra);

  return {
    contraRival: delRival?.motivo ?? "",
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

  if (!suficiente) return `${mayuscula(bases)} · pocos peligros para concluir`;

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
function partidoDelInforme(
  acciones: AccionAbp[],
  minutos: Map<string, number>,
  /** La tasa de peligro de la temporada por `claveAspecto` (0-1): la referencia de cada lectura. */
  tasas: Map<string, number> = new Map(),
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

  return {
    jornada,
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

/** «Penaltis a favor» ya dice «a favor»: no se le pega otra vez. */
function conLado(rotulo: string, lado: "a favor" | "en contra") {
  const minusculas = rotulo.toLowerCase().replace(/\s*%$/, "");

  return /\ba favor\b|\ben contra\b/.test(minusculas) ? minusculas : `${minusculas} ${lado}`;
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
        ? `esta semana se le han dado ${fmtMin(primera.minSemana)}`
        : "esta semana no se ha trabajado";

    claves.push(`${consignaDe(primera.aspecto, primera.lado)} (prioridad nº 1 en nuestras hojas): ${estado}.`);
  }

  /* Si Wyscout dice otra cosa de ese mismo aspecto, se concilia en una frase. */
  const choque = primera && comparativa ? choqueConWyscout(primera, comparativa) : null;

  if (choque) claves.push(choque.frase);

  /* El rival de la semana, cruzado con nuestras prioridades: qué sube y qué baja. */
  const rivalNombre = datos.partidoCalendario?.rival || datos.rival;

  const cruzadas = prioridades.filter((una) => una.sentidoRival && una.contraRival).slice(0, 2);

  if (rivalNombre && cruzadas.length) {
    claves.push(
      `Contra el ${rivalNombre}: ${cruzadas
        .map((una) => `${una.sentidoRival} ${conArticulo(una.aspecto)} ${ladoConcordado(una.aspecto, una.lado)}, porque ${una.contraRival}`)
        .join("; ")}.`,
    );
  }

  if (banda && banda !== primera) {
    claves.push(
      `Saques de banda, aparte: ${conArticulo(banda.aspecto)} ${ladoConcordado(banda.aspecto, banda.lado)}, ${banda.base} con peligro${banda.lado === "defensivo" ? " en contra" : ""}.`,
    );
  }

  if (sinMinutos) {
    if (planificado.length) {
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
    type Puesto = { texto: string; puesto: number };

    /*
    | Sólo métricas con muestra (19/10/2026): «lo mejor, penaltis a favor a
    | favor (1.º de 20)» eran 4 penaltis en 8 partidos, y «lo peor, faltas con
    | remate» unas 17 faltas. Con menos de `MINIMO_BASE_CATEGORIA` acciones
    | detrás, la métrica no compite por la clave (sigue en la tabla).
    */
    const conMuestra = (key: string, lado: "favor" | "contra") =>
      (baseDeMedida(comparativa, key, lado) ?? 0) >= MINIMO_BASE_CATEGORIA;

    /* Lo que ya se ha conciliado arriba no vuelve a salir como lectura suelta. */
    const yaDicho = (key: string, lado: "favor" | "contra") => choque?.key === key && choque.lado === lado;

    const puestos: Puesto[] = comparativa.filas
      .filter((fila) => fila.sentido === "alto")
      .flatMap((fila) => [
        fila.puestoFavor === null || !conMuestra(fila.key, "favor") || yaDicho(fila.key, "favor")
          ? null
          : { texto: conLado(fila.rotulo, "a favor"), puesto: fila.puestoFavor },
        fila.puestoContra === null || !conMuestra(fila.key, "contra") || yaDicho(fila.key, "contra")
          ? null
          : { texto: conLado(fila.rotulo, "en contra"), puesto: fila.puestoContra },
      ])
      .filter((uno): uno is Puesto => uno !== null);

    const peor = [...puestos].sort((a, b) => b.puesto - a.puesto)[0];
    const mejor = [...puestos].sort((a, b) => a.puesto - b.puesto)[0];

    const n = comparativa.equipos;

    const trozos: string[] = [];

    if (mejor && mejor.puesto <= Math.ceil(n / 3)) trozos.push(`lo mejor, ${mejor.texto} (${mejor.puesto}.º de ${n})`);
    if (peor && peor !== mejor && peor.puesto > n - Math.ceil(n / 3)) trozos.push(`lo peor, ${peor.texto} (${peor.puesto}.º de ${n})`);

    if (trozos.length) claves.push(`Contra la categoría, en Wyscout: ${trozos.join("; ")}.`);
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
function titularPost(partido: PartidoAbpInforme) {
  const top = loQueMasPeligroDio(partido);

  const total = partido.favor.acciones + partido.contra.acciones;

  if (top) {
    const trabajo = top.minutos > 0 ? `${fmtMin(top.minutos)} de trabajo en la semana` : "ningún minuto de trabajo en la semana";

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

  return susto
    ? `${base}; ${conArticulo(susto.aspecto)} en contra nos dio ${susto.peligros} sustos`
    : `${base}: ${remates}`;
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
function clavesPost(partido: PartidoAbpInforme) {
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

  if (trabajadas.length) {
    const sinVeredicto = aparecieron.length > 0 && !buenas.length && !malas.length;

    claves.push(
      `De ${plural(trabajadas.length, "aspecto trabajado", "aspectos trabajados")} en la semana, en el partido ${
        aparecieron.length === 1 ? "apareció 1" : `aparecieron ${aparecieron.length}`
      }${sinVeredicto ? "; con tan pocas acciones, ninguno da para un veredicto (el detalle, en la tabla)" : ""}.`,
    );
  }

  return claves.slice(0, 5);
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
      notas: propuesta
        ? "Propuesta del boceto, sin confirmar"
        : esPropuestaDelBoceto(limpio)
          ? "Del boceto, con su tarea en la hoja de registro ese día"
          : String(limpio.notas ?? "").trim(),
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

  const prioridades: LineaEquipo[] = filas.length
    ? prioridadesAbp(filas, { rival: rivalAbp ? (fila) => pesoDelRival(fila, rivalAbp)?.factor ?? null : undefined }).map((una) =>
        filaEquipo(una.fila, semanaAspectos, rivalAbp),
      )
    : datos.prioridades.map((fila) => filaEquipo(fila, semanaAspectos, rivalAbp));

  /* La tasa de peligro de la temporada de cada aspecto: la referencia de las lecturas del post. */
  const tasasTemporada = new Map(
    filas
      .filter((fila) => fila.stats.acciones >= MINIMO_VEREDICTO)
      .map((fila) => [claveAspecto(fila.aspecto.key, fila.lado), fila.stats.peligro / fila.stats.acciones] as const),
  );

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
          ...partidoDelInforme(accionesPartido, minutosAspecto, tasasTemporada),
          marcador:
            calendario?.jugado && calendario.golesFavor !== null && calendario.golesContra !== null
              ? { favor: calendario.golesFavor, contra: calendario.golesContra }
              : null,
        }
      : null;

  /*
  | El arco de la previa (20/10/2026): de dónde venimos. «Viene del partido
  | contra…» era una línea de agenda; con las acciones de ese partido en las
  | hojas, dice lo que nos dejó a balón parado.
  */
  const anterior =
    !esPost && datos.partidoAnterior && (datos.accionesAnterior?.length ?? 0) > 0
      ? partidoDelInforme(datos.accionesAnterior ?? [], new Map(), tasasTemporada)
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
  const pieMinutos = [
    `Objetivo ${fmtMin(objetivo.minimo)}-${fmtMin(objetivo.maximo)}`,
    minutos.propuestos ? `+${fmtMin(minutos.propuestos)} propuestos` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const minutosTile = {
    rotulo: "Minutos de ABP",
    valor: fmtMin(totales.minutos),
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
            rotulo: "Prioridad nº 1",
            valor: primeraPrioridad.base,
            pie: `${mayuscula(aspectoEnFrase(primeraPrioridad.aspecto, primeraPrioridad.lado))}: acciones con peligro${primeraPrioridad.lado === "defensivo" ? " en contra" : ""}`,
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
      ? clavesPost(partidoAbp)
      : []
    : clavesPrevia(datos, prioridades, tiempo.porAspecto, comparativa, sinMinutos, planificado);

  const modoRotulo = esPost ? "Post partido" : "Previa del partido";

  const titulo = `Balón parado · Microciclo ${datos.micro}`;

  const rivalNombre = datos.rival || calendario?.rival || "";

  const subtitulo = [rivalNombre && `Contra ${rivalNombre}`, datos.temporada]
    .filter(Boolean)
    .join(" · ");

  const jornadaCorta = calendario?.jornada ? ` · J${calendario.jornada}` : "";

  /* Sin minutos, los gráficos del tiempo serían una barra a cero: no salen. */
  const graficos = (datos.graficos ?? []).filter((grafico) => !(sinMinutos && grafico.area === "tiempo"));

  return {
    modo,
    modoRotulo,
    asunto: `[${esPost ? "POST" : "PREVIA"}] RMCF Castilla · ABP · Microciclo ${datos.micro}${rivalNombre ? ` · ${rivalNombre}` : ""}${jornadaCorta}${esPost && marcador ? ` (${marcador})` : ""}`,
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
    },
    sinMinutos,
    rivalAbp,
  };
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

  if (susto) return `${conArticulo(susto.aspecto)} en contra nos dio ${susto.peligros} sustos`;

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

  const claves: Seccion = {
    titulo: esPost ? "Lo que nos deja el partido" : "Claves para el partido",
    pie: esPost
      ? "Lo que dice el dato del partido, y si lo trabajado en la semana apareció."
      : informe.sinMinutos
        ? "Qué toca esta semana, por qué y qué está planificado."
        : "Qué se ha trabajado, por qué y qué vigilar del rival.",
    html: informe.claves.length
      ? `<ol style="margin:0 0 8px;padding-left:20px">${informe.claves
          .map(
            (una) =>
              `<li style="margin:0 0 8px;font:400 14px/1.55 Arial,sans-serif;color:${TINTA}">${esc(una)}</li>`,
          )
          .join("")}</ol>`
      : "",
    texto: informe.claves.map((una, i) => `${i + 1}. ${una}`),
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
              ...(
                [
                  ["Total a favor", p.favor],
                  ["Total en contra", p.contra],
                ] as [string, CifrasPartido][]
              ).map(([rotulo, c]) => [
                `<b>${rotulo}</b>`,
                "",
                `<b>${c.acciones}</b>`,
                `<b>${c.remates}</b>`,
                `<b>${c.peligros} (${pct(c.peligros, c.acciones)})</b>`,
                `<b>${c.goles}</b>`,
                `<b>${dec(c.xg, 2)}</b>`,
              ]),
            ],
          ) +
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
          `- Total a favor: ${plural(p.favor.acciones, "acción", "acciones")} · ${plural(p.favor.remates, "remate", "remates")} · peligro ${p.favor.peligros} · ${plural(p.favor.goles, "gol", "goles")}${p.favor.xg > 0 ? ` · xG ${dec(p.favor.xg, 2)}` : ""}`,
          `- Total en contra: ${plural(p.contra.acciones, "acción", "acciones")} · ${plural(p.contra.remates, "remate", "remates")} · peligro ${p.contra.peligros} · ${plural(p.contra.goles, "gol", "goles")}${p.contra.xg > 0 ? ` · xG ${dec(p.contra.xg, 2)}` : ""}`,
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

  const cruce: Seccion | null =
    p && cruceMedible.length
      ? {
          titulo: "Lo trabajado, ¿apareció?",
          pie: "Cada aspecto trabajado en la semana frente a lo que pasó en el partido. Debajo, lo que no se trabajó y dio peligro o gol.",
          html: tabla(
            ["Aspecto", "Lado", "En la semana", "En el partido", "Lectura"],
            cruceMedible.map((una) => [
              esc(una.aspecto),
              LADO_LABEL[una.lado],
              una.trabajado ? fmtMin(una.minutos) : `<span style="color:${SUAVE}">Sin trabajar</span>`,
              `${plural(una.acciones, "acción", "acciones")}${una.remates ? ` · ${plural(una.remates, "remate", "remates")}` : ""}`,
              tonoHtml(una.lectura, una.tono),
            ]),
          ),
          texto: cruceMedible.map(
            (una) =>
              `- ${nombreAspecto(una.aspecto, una.lado)} · ${una.trabajado ? `${fmtMin(una.minutos)} en la semana` : "sin trabajar"} · ${plural(una.acciones, "acción", "acciones")} · ${una.lectura}`,
          ),
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

  /* Qué cuenta en los minutos, dicho una vez (`minutosAbp`, 19/10/2026). */
  const queCuenta = informe.minutosAbp.propuestos
    ? ` Cuentan las tareas de campo y de vídeo del microciclo; ${fmtMin(informe.minutosAbp.propuestos)} del boceto siguen como propuesta y no suman hasta confirmarse.`
    : " Cuentan las tareas de campo y de vídeo del microciclo.";

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

  const celdaMinutos = (linea: LineaTrabajo) =>
    linea.propuesta
      ? `<span style="color:${SUAVE}">${esc(linea.minutos)}<br>propuesta</span>`
      : esc(linea.minutos);

  const celdaCarga = (linea: LineaTrabajo) =>
    linea.carga > 0 ? `${linea.carga}${linea.medida ? "" : ' <span style="color:#9CA3AF">est.</span>'}` : "";

  const semana: Seccion = {
    titulo: informe.sinMinutos ? "Lo planificado, tarea a tarea" : "La semana, tarea a tarea",
    pie: conMinutos
      ? "Lo planificado de balón parado, día a día. «est.» es carga estimada; el resto viene medida de la hoja de registro. Lo marcado «propuesta» es del boceto y no suma minutos hasta confirmarse."
      : "Lo planificado de balón parado, día a día. Los minutos y la carga salen cuando se registren.",
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
      ? `<span style="color:${linea.sentidoRival === "sube" ? NARANJA : VERDE}">${linea.sentidoRival === "sube" ? "Sube" : "Baja"}</span> · ${esc(linea.contraRival)}`
      : "";

  const prioridades: Seccion = {
    titulo: "Prioridades de la semana",
    pie: `Sólo competición, de nuestras hojas de ABP. Primero el balón parado que acaba en remate (córner, falta, penalti), ordenado por el daño que hace —acciones con peligro y goles—, por cómo rinde frente a su familia y por lo poco que se ha trabajado; los saques de banda, aparte. «Con peligro» es gol u ocasión para quien saca: en lo defensivo, lo que nos generan. Fuera lo que tiene menos de ${MINIMO_ACCIONES_PRIORIDAD} acciones.${conRival ? " «Contra el rival» es lo que Wyscout mide de él en ese mismo aspecto: sube la prioridad si ataca bien lo que defendemos o concede lo que atacamos, y baja si no." : ""}`,
    html: tabla(
      ["", "Aspecto", "Lado", "Con peligro", "Goles", "Esta semana", "Trabajado en la temporada", ...(conRival ? ["Contra el rival"] : [])],
      informe.prioridades.map((linea, i) => [
        linea.esBanda ? `<span style="color:${SUAVE}">Banda</span>` : `<b>${i + 1}</b>`,
        esc(linea.aspecto),
        LADO_LABEL[linea.lado],
        `<b>${esc(linea.base)}</b>${linea.acciones >= MINIMO_VEREDICTO && linea.peligro ? ` <span style="color:${SUAVE}">(${esc(linea.peligro)})</span>` : ""}`,
        linea.goles ? `<b>${linea.goles}</b>` : "0",
        estadoSemana(linea),
        esc(linea.minutosTemporada),
        ...(conRival ? [columnaRival(linea)] : []),
      ]),
    ),
    texto: informe.prioridades.map((linea, i) =>
      [
        `- ${linea.esBanda ? "Saques de banda, aparte" : `${i + 1}`}: ${urgenciaEnFrase(linea)}`,
        estadoSemanaTexto(linea),
        `${linea.minutosTemporada} en la temporada`,
        linea.contraRival ? `${linea.sentidoRival === "sube" ? "sube" : "baja"} por el rival: ${linea.contraRival}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  };

  const equipo: Seccion = {
    titulo: "Aspecto por aspecto, en la temporada",
    pie: "Nuestras hojas de ABP, con las mismas acciones que el resto del informe. «¿Se nota el trabajo?» compara el peligro en los partidos con trabajo la semana antes y sin él, con su base en cada lado. Sólo se dice «se nota» o «no se nota» con 10 acciones con peligro o más entre los dos lados y al menos 3 en cada uno: cuentan los peligros, no las acciones. Con menos de 5 acciones, la base sin porcentaje.",
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
  | nuestro). Post: qué pasó → las claves, el partido, si lo entrenado
  | apareció, cómo salieron las tareas, la semana, y después el acumulado.
  */
  const orden: (Seccion | null)[] = esPost
    ? [claves, partido, cruce, valoracion, tiempo, semana, rival, apuntes, acumulado, equipo, categoria, seguimiento]
    : [claves, prioridades, tiempo, semana, valoracion, rival, suBalonParado, apuntes, categoria, acumulado, seguimiento];

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
  const lineaPartido = [informe.partido, informe.vieneDe].filter(Boolean);

  /*
  | Lo esencial arriba (14/10/2026): el titular y las claves de la pincelada,
  | y la barra de los minutos de la semana contra su objetivo, en la misma
  | franja azul de la cabecera. Quien sólo lee el principio ya sabe cómo ha ido.
  */
  const esencia = pinceladaAbp(informe);
  const obj = informe.objetivo;
  const colorObjetivo = obj.veredicto === "corto" ? (obj.cumplido >= 0.95 ? "#D9A21B" : "#D97757") : "#4CC79F";
  const relleno = Math.max(3, Math.min(100, Math.round((obj.hechos / Math.max(1, obj.maximo)) * 100)));
  /* Sin un minuto (previa del lunes) la barra sería un cero: no sale (19/10/2026). */
  const barraObjetivo = obj.maximo && !informe.sinMinutos
    ?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td style="font:700 10px/1.3 Arial,sans-serif;color:${ORO};letter-spacing:.2em;text-transform:uppercase">Minutos de balón parado</td><td align="right" style="font:700 15px/1.3 Arial,sans-serif;color:#FFFFFF">${esc(fmtMin(obj.hechos))} <span style="font:400 12px Arial,sans-serif;color:#9FB0C6">de ${esc(fmtMin(obj.minimo))}-${esc(fmtMin(obj.maximo))}</span></td></tr><tr><td colspan="2" style="padding-top:6px"><div style="height:10px;background:rgba(255,255,255,0.12);border-radius:5px"><div style="height:10px;width:${relleno}%;background:${colorObjetivo};border-radius:5px"></div></div></td></tr></table>`
    : "";
  const bloqueEsencial = esencia.titular
    ? `<tr><td style="padding:0 24px 22px;background:${NAVY}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(200,169,107,0.35)"><tr><td style="padding-top:16px"><p style="margin:0;font:700 10px/1.3 Arial,sans-serif;color:${ORO};letter-spacing:.24em;text-transform:uppercase">Lo esencial</p><p style="margin:6px 0 0;font:700 19px/1.35 Arial,sans-serif;color:#F2E6C9">${esc(esencia.titular)}</p>${
        esencia.claves.length
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px">${esencia.claves
              .map((c, i) => `<tr><td valign="top" style="padding:3px 12px 3px 0;font:700 18px/1.2 Georgia,'Times New Roman',serif;color:${ORO}">${String(i + 1).padStart(2, "0")}</td><td valign="top" style="padding:4px 0;font:400 14px/1.5 Arial,sans-serif;color:#E6E9EF">${esc(c)}</td></tr>`)
              .join("")}</table>`
          : ""
      }${barraObjetivo}</td></tr></table></td></tr>`
    : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(`${informe.titulo} · ${informe.modoRotulo}`)}</title></head><body style="margin:0;padding:0;background:#EEEAE0">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#EEEAE0;padding:18px 0"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="860" style="width:860px;max-width:96%;background:#FFFFFF;border-radius:12px;overflow:hidden">

<tr><td style="padding:22px 24px;background:${NAVY}">
  <p style="margin:0;font:600 10px/1.3 Arial,sans-serif;color:${ORO};text-transform:uppercase;letter-spacing:.28em">RMCF Castilla · Balón parado · ${esc(informe.modoRotulo)}</p>
  <h1 style="margin:8px 0 0;font:700 26px/1.2 Arial,sans-serif;color:#FFFFFF">${esc(informe.titulo)}</h1>
  <p style="margin:6px 0 0;font:400 13px/1.5 Arial,sans-serif;color:#9FB0C6">${esc(
    [informe.subtitulo, informe.rango].filter(Boolean).join(" · "),
  )}</p>
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
  sustoEnContra?: { consigna: string; dato: string } | null;
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

export function pinceladaAbp(informe: InformeMicro): PinceladaAbp {
  /* El nombre como lo escribe Wyscout («Algeciras»), no en mayúsculas de la hoja (20/10/2026). */
  const rivalHoja = informe.subtitulo.match(/^Contra (.+?)(?: · |$)/)?.[1] ?? "";

  const rivalNombre =
    informe.rivalAbp?.equipo ||
    (rivalHoja === rivalHoja.toUpperCase()
      ? rivalHoja
          .toLowerCase()
          .split(" ")
          .map((palabra) => (SIGLAS_EN_MAYUSCULA.has(palabra) ? palabra.toUpperCase() : `${palabra.charAt(0).toUpperCase()}${palabra.slice(1)}`))
          .join(" ")
      : rivalHoja);

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

  const pieMinutos = `objetivo ${objetivo}${informe.minutosAbp.propuestos ? ` · +${fmtMin(informe.minutosAbp.propuestos)} propuestos` : ""}`;

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
    const claves = [
      malas.length ? `No salió: ${fraseLista(malas.slice(0, 2).map(nombre))}` : "",
      buenas.length ? `Salió bien: ${fraseLista(buenas.slice(0, 2).map(nombre))}` : "",
      candidato ? `Para el próximo microciclo: ${nombre(candidato)}` : "",
      `Remates a balón parado: ${p.favor.remates} a favor y ${p.contra.remates} en contra`,
      trabajadas.length
        ? `De ${plural(trabajadas.length, "aspecto trabajado", "aspectos trabajados")}, en el partido ${aparecieron.length === 1 ? "apareció 1" : `aparecieron ${aparecieron.length}`}`
        : "",
    ]
      .filter(Boolean)
      .map((una) => breve(una, 90));

    const titular =
      titularPost(p) ||
      (p.favor.goles > p.contra.goles
        ? `El balón parado sumó: ${p.favor.goles}-${p.contra.goles}${rivalNombre ? ` ante ${rivalNombre}` : ""}`
        : `El balón parado restó: ${p.favor.goles}-${p.contra.goles}${rivalNombre ? ` ante ${rivalNombre}` : ""}`);

    /* El susto en contra, para que el informe del partido lo lleve a «Qué toca» (22/10/2026). */
    const susto = p.cruce.filter((una) => una.medible && una.lado === "defensivo" && una.peligros >= 2).sort((a, b) => b.peligros - a.peligros)[0];

    return {
      modo: "post",
      titular,
      sustoEnContra: susto ? { consigna: `Defendemos ${conArticulo(susto.aspecto)}`, dato: `${susto.peligros} de ${susto.acciones} con peligro en contra en el partido` } : null,
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

  /* Lo que dice el rival de la prioridad nº 1, y otra prioridad que el rival hace subir. */
  const delRival = primera?.contraRival ? mayuscula(primera.contraRival) : "";

  const subeOtra = informe.prioridades.find((una) => una !== primera && una.sentidoRival === "sube" && una.contraRival);

  const otraQueSube = subeOtra ? `Sube ${conArticulo(subeOtra.aspecto)} ${ladoConcordado(subeOtra.aspecto, subeOtra.lado)}: ${subeOtra.contraRival}` : "";

  if (informe.sinMinutos) {
    const dias = [...new Set(informe.trabajos.map((una) => una.dia.toLowerCase()))];

    const enElPlan = primera && dias.length
      ? primera.planificado
        ? `Ya está en el plan: ${fraseLista(dias)} (${plural(informe.trabajos.length, "tarea", "tareas")})`
        : `No figura en el plan: ${fraseLista(dias)} (${plural(informe.trabajos.length, "tarea", "tareas")})`
      : dias.length
        ? `Planificado: ${fraseLista(dias)} (${plural(informe.trabajos.length, "tarea", "tareas")})`
        : "";

    const claves = [
      delRival,
      enElPlan,
      otraQueSube,
      banda && banda !== primera ? `Saques de banda, aparte: ${nombre(banda)}, ${banda.base} con peligro` : "",
      conRemate[1] ? `Después: ${nombre(conRemate[1])}, ${baseDe(conRemate[1])}` : "",
    ]
      .filter(Boolean)
      .map((una) => breve(una, 90));

    return {
      modo: "previa",
      titular: primera
        ? `${rivalNombre ? `Contra el ${rivalNombre}, ${enMinuscula(consignaDe(primera.aspecto, primera.lado))}` : consignaDe(primera.aspecto, primera.lado)}: ${baseDe(primera)}`
        : rivalNombre
          ? `Balón parado para el ${rivalNombre}: lo planificado de la semana`
          : "Balón parado: lo planificado de la semana",
      claves: claves.slice(0, 3),
      cifras: [
        ...(primera ? [{ rotulo: "Prioridad nº 1", valor: primera.base, pie: `${mayuscula(nombre(primera))}: con peligro${primera.lado === "defensivo" ? " en contra" : ""}` }] : []),
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

  lineas.push(`${informe.titulo.toUpperCase()} · ${informe.modoRotulo.toUpperCase()}`);
  lineas.push([informe.subtitulo, informe.rango].filter(Boolean).join(" · "));

  if (informe.partido) lineas.push(informe.partido);
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
