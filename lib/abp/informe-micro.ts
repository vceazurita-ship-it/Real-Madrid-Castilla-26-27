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
  minutosPorAspecto,
  normalizaTrabajo,
  type AbpLado,
  type AspectoKey,
  type DiaKey,
  type OrigenDias,
  type TotalesPlan,
  type Trabajo,
} from "./microciclo";

import { hayEvaluacion, textoEsAbp, type RegistroTarea } from "./registro";

import type { FilaCruce } from "./transferencia";

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
   * Lo preparado del rival. `null` es «se ha mirado y no hay nada»;
   * `undefined`, «todavía no se sabe» (no se avisa de nada).
   */
  rivalAnalisis?: RivalAnalisisInforme | null;
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
};

export type RivalAnalisisInforme = {
  equipo: string;
  jornada: string;
  conclusiones: { seccion: string; texto: string }[];
  /** Los PDF preparados de la jornada (ABP y centros), con su enlace. */
  documentos?: { nombre: string; url: string }[];
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
    peligro: fila.stats.acciones ? `${dec(fila.stats.peligroPct)} %` : "—",
    minutosSemana: fmtMin(fila.minutosMicro),
    minutosTemporada: fmtMin(fila.minutosTemporada),
    urgencia: fila.urgencia,
    transferencia: fila.transferencia?.delta ?? null,
  };
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

function lecturaCruce(lado: AbpLado, datos: CifrasPartido, medible: boolean) {
  if (!medible) return { lectura: "Ninguna hoja lo registra", tono: "neutro" as const };

  if (datos.acciones === 0) return { lectura: "No se dio en el partido", tono: "neutro" as const };

  if (lado === "ofensivo") {
    if (datos.goles > 0) return { lectura: `${plural(datos.goles, "gol", "goles")} a favor`, tono: "bien" as const };

    if (datos.peligros > 0) return { lectura: `Peligro en ${datos.peligros} de ${datos.acciones}`, tono: "bien" as const };

    return { lectura: "Sin peligro", tono: "mal" as const };
  }

  if (datos.goles > 0) return { lectura: `${plural(datos.goles, "gol", "goles")} en contra`, tono: "mal" as const };

  if (datos.peligros > 0) return { lectura: `Nos generaron peligro en ${datos.peligros} de ${datos.acciones}`, tono: "mal" as const };

  return { lectura: "Bien defendido", tono: "bien" as const };
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
        ...lecturaCruce(lado, datos, medible),
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

function fraseLista(trozos: string[]) {
  if (trozos.length <= 1) return trozos.join("");

  return `${trozos.slice(0, -1).join(", ")} y ${trozos[trozos.length - 1]}`;
}

/**
 * Las claves de la previa: qué se ha trabajado, por qué y qué vigilar.
 *
 * Cada frase sale de un dato que el informe trae más abajo; aquí sólo se
 * elige lo que importa y se dice en una línea. Si un dato falta, su frase no
 * sale: mejor tres claves ciertas que cinco con relleno.
 */
function clavesPrevia(
  datos: DatosInforme,
  porAspecto: TiempoSemana["porAspecto"],
  comparativa: ComparativaInforme | null,
) {
  const claves: string[] = [];

  const primera = datos.prioridades[0];

  if (primera && primera.urgencia !== null) {
    claves.push(
      `La urgencia número uno es ${nombreAspecto(primera.aspecto.label, primera.lado)}: ` +
        `${plural(primera.stats.acciones, "acción", "acciones")} en la temporada y ${dec(primera.stats.peligroPct)} % de peligro${primera.lado === "defensivo" ? " en contra" : ""}. ` +
        (primera.minutosMicro > 0
          ? `Esta semana se le han dado ${fmtMin(primera.minutosMicro)}.`
          : "Esta semana no se ha trabajado."),
    );
  }

  const olvidadas = datos.prioridades
    .slice(1)
    .filter((fila) => fila.urgencia !== null && fila.minutosMicro === 0)
    .map((fila) => nombreAspecto(fila.aspecto.label, fila.lado));

  if (olvidadas.length) {
    claves.push(
      `De las urgencias de la temporada, sin trabajar esta semana: ${fraseLista(olvidadas)}.`,
    );
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

  const conclusion = datos.rivalAnalisis?.conclusiones.find((una) => una.texto.trim());

  if (conclusion && datos.rivalAnalisis) {
    claves.push(
      `Del ${datos.rivalAnalisis.equipo}, a vigilar en «${conclusion.seccion}»: ${recorta(conclusion.texto)}`,
    );
  }

  if (comparativa) {
    type Puesto = { texto: string; puesto: number };

    const puestos: Puesto[] = comparativa.filas
      .filter((fila) => fila.sentido === "alto")
      .flatMap((fila) => [
        fila.puestoFavor === null
          ? null
          : { texto: `${fila.rotulo.toLowerCase()} a favor`, puesto: fila.puestoFavor },
        fila.puestoContra === null
          ? null
          : { texto: `${fila.rotulo.toLowerCase()} en contra`, puesto: fila.puestoContra },
      ])
      .filter((uno): uno is Puesto => uno !== null);

    const peor = [...puestos].sort((a, b) => b.puesto - a.puesto)[0];
    const mejor = [...puestos].sort((a, b) => a.puesto - b.puesto)[0];

    const n = comparativa.equipos;

    const trozos: string[] = [];

    if (mejor && mejor.puesto <= Math.ceil(n / 3)) trozos.push(`lo mejor, ${mejor.texto} (${mejor.puesto}.º de ${n})`);
    if (peor && peor.puesto > n - Math.ceil(n / 3)) trozos.push(`lo peor, ${peor.texto} (${peor.puesto}.º de ${n})`);

    if (trozos.length) claves.push(`Contra la categoría: ${trozos.join("; ")}.`);
  }

  return claves.slice(0, 5);
}

/** Las claves del post: qué pasó a balón parado y si lo trabajado apareció. */
function clavesPost(
  partido: PartidoAbpInforme,
  calendario: PartidoCalendario | null | undefined,
) {
  const claves: string[] = [];

  const { favor, contra } = partido;

  const marcador =
    calendario?.jugado && calendario.golesFavor !== null && calendario.golesContra !== null
      ? `${calendario.golesFavor}-${calendario.golesContra}`
      : "";

  /*
  | Los goles y las acciones ya están en la cabecera y en la tabla del
  | partido: aquí sólo va lo que esas cifras no dicen solas, qué parte del
  | resultado fue de balón parado.
  */
  if (marcador) {
    const gf = calendario!.golesFavor!;
    const gc = calendario!.golesContra!;

    claves.push(
      `El partido acabó ${marcador}. A balón parado: ${favor.goles} de ${gf} a favor y ${contra.goles} de ${gc} en contra.`,
    );
  }

  const trabajadas = partido.cruce.filter((una) => una.trabajado && una.medible);

  if (trabajadas.length) {
    const aparecieron = trabajadas.filter((una) => una.acciones > 0);

    const buenas = aparecieron.filter((una) => una.tono === "bien");
    const malas = aparecieron.filter((una) => una.tono === "mal");

    const cita = (una: LineaCruce) =>
      `${una.aspecto.toLowerCase()} ${LADO_LABEL[una.lado].toLowerCase()} (${una.lectura.toLowerCase()})`;

    let frase = `De los ${plural(trabajadas.length, "aspecto trabajado", "aspectos trabajados")} en la semana, en el partido ${
      aparecieron.length === 1 ? "apareció 1" : `aparecieron ${aparecieron.length}`
    }`;

    if (buenas.length) frase += `; salió bien ${fraseLista(buenas.slice(0, 3).map(cita))}`;

    if (malas.length) frase += `; no rindió ${fraseLista(malas.slice(0, 2).map(cita))}`;

    claves.push(`${frase}.`);
  }

  const sinTrabajar = partido.cruce.filter(
    (una) => !una.trabajado && una.lado === "defensivo" && (una.goles > 0 || una.peligros > 0),
  );

  if (sinTrabajar.length) {
    claves.push(
      `Nos hicieron daño en algo que no se trabajó: ${fraseLista(
        sinTrabajar.slice(0, 3).map((una) => `${una.aspecto.toLowerCase()} (${una.lectura.toLowerCase()})`),
      )}. Candidato para el próximo microciclo.`,
    );
  }

  const productivas = partido.cruce.filter(
    (una) => !una.trabajado && una.lado === "ofensivo" && una.goles > 0,
  );

  if (productivas.length) {
    claves.push(
      `Marcamos en algo que no se trabajó esta semana: ${fraseLista(productivas.map((una) => una.aspecto.toLowerCase()))}.`,
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

  const conMuestra = datos.filas
    .filter((fila) => fila.stats.acciones > 0 || fila.minutosTemporada > 0)
    .sort((a, b) => b.stats.acciones - a.stats.acciones);

  const equipo = conMuestra.map(filaEquipo);

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

  const totales = datos.totales;

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

  /*
  | Los minutos por `aspecto|lado`. Si la pantalla no los manda, se sacan de
  | las entradas con la misma cuenta que ella (`minutosPorAspecto`).
  */
  const minutosAspecto = datos.minutosPorAspecto?.length
    ? new Map(datos.minutosPorAspecto.map(({ clave, minutos }) => [clave, minutos]))
    : minutosPorAspecto(datos.entradas);

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
      ? partidoDelInforme(accionesPartido, minutosAspecto)
      : null;

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

  const urgenciasTocadas = datos.prioridades.filter((fila) => fila.minutosMicro > 0).length;

  const minutosTile = {
    rotulo: "Minutos de ABP",
    valor: fmtMin(totales.minutos),
    pie: `Objetivo ${fmtMin(objetivo.minimo)}-${fmtMin(objetivo.maximo)}`,
  };

  const valoracionTile = {
    rotulo: "Tareas valoradas",
    valor: `${valoradas.length} de ${datos.tareas.length}`,
    pie: media === null ? "Sin nota media" : `Media ${dec(media)}`,
  };

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
        valoracionTile,
      ]
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
        {
          rotulo: "Carga",
          valor: String(Math.round(totales.carga)),
          pie: `Cognitiva ${Math.round(totales.cargaCog)}`,
        },
        {
          rotulo: "Aspectos trabajados",
          valor: String(aspectosSemana),
          pie: datos.prioridades.length
            ? `Cubren ${urgenciasTocadas} de las ${datos.prioridades.length} urgencias`
            : "Sin urgencias calculadas",
        },
        valoracionTile,
      ];

  const claves = esPost
    ? partidoAbp
      ? clavesPost(partidoAbp, calendario)
      : []
    : clavesPrevia(datos, tiempo.porAspecto, comparativa);

  const modoRotulo = esPost ? "Post partido" : "Previa del partido";

  const titulo = `Balón parado · Microciclo ${datos.micro}`;

  const rivalNombre = datos.rival || calendario?.rival || "";

  const subtitulo = [rivalNombre && `Contra ${rivalNombre}`, datos.temporada]
    .filter(Boolean)
    .join(" · ");

  const jornadaCorta = calendario?.jornada ? ` · J${calendario.jornada}` : "";

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
    vieneDe: datos.partidoAnterior
      ? `Viene del partido contra ${datos.partidoAnterior.rival} (${datos.partidoAnterior.cuando})`
      : "",
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
    prioridades: datos.prioridades.map(filaEquipo),
    tiempo,
    objetivo,
    tareasValoradas,
    seguimientoResumen,
    comparativa,
    propio,
    partidoAbp,
    graficos: datos.graficos ?? [],
    avisos,
    rivalAnalisis: datos.rivalAnalisis ?? null,
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
                fila.xg > 0 ? dec(fila.xg, 2) : "—",
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
                c.xg > 0 ? `<b>${dec(c.xg, 2)}</b>` : "—",
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

  const cruce: Seccion | null =
    p && p.cruce.length
      ? {
          titulo: "Lo trabajado, ¿apareció?",
          pie: "Cada aspecto trabajado en la semana frente a lo que pasó en el partido. Debajo, lo que no se trabajó y dio peligro o gol.",
          html: tabla(
            ["Aspecto", "Lado", "En la semana", "En el partido", "Lectura"],
            p.cruce.map((una) => [
              esc(una.aspecto),
              LADO_LABEL[una.lado],
              una.trabajado ? fmtMin(una.minutos) : `<span style="color:${SUAVE}">Sin trabajar</span>`,
              una.medible
                ? `${plural(una.acciones, "acción", "acciones")}${una.remates ? ` · ${plural(una.remates, "remate", "remates")}` : ""}`
                : "—",
              tonoHtml(una.lectura, una.tono),
            ]),
          ),
          texto: p.cruce.map(
            (una) =>
              `- ${nombreAspecto(una.aspecto, una.lado)} · ${una.trabajado ? `${fmtMin(una.minutos)} en la semana` : "sin trabajar"} · ${
                una.medible ? plural(una.acciones, "acción", "acciones") : "sin dato"
              } · ${una.lectura}`,
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

  const tiempo: Seccion = {
    titulo: esPost ? "El tiempo que se le dio" : "El tiempo de la semana",
    pie: `${tiempoTexto} ${explicaDias(o)} Referencia: 90-100' en una semana de seis entrenamientos, prorrateada.`,
    html: graficos("tiempo"),
    texto: [],
    fija: true,
  };

  const semana: Seccion = {
    titulo: "La semana, tarea a tarea",
    pie: "Lo planificado de balón parado, día a día. «est.» es carga estimada; el resto viene medida de la hoja de registro.",
    html: tabla(
      ["Día", "Aspecto", "Lado", "Momento", "Medio", "Roles", "Min.", "Carga"],
      informe.trabajos.map((linea) => [
        esc(linea.dia),
        `${esc(linea.aspectos)}${linea.notas ? `<br><span style="color:${SUAVE};font-size:12px">${esc(linea.notas)}</span>` : ""}`,
        esc(linea.lados),
        esc(linea.momento),
        esc(linea.medio),
        esc(linea.roles),
        esc(linea.minutos),
        `${linea.carga}${linea.medida ? "" : ' <span style="color:#9CA3AF">est.</span>'}`,
      ]),
    ),
    texto: informe.trabajos.map(
      (linea) =>
        `- ${linea.dia} · ${linea.aspectos} (${linea.lados}) · ${linea.minutos} · ${linea.momento} · ${linea.medio}${linea.notas ? ` · ${linea.notas}` : ""}`,
    ),
  };

  /* ---------- prioridades (previa) y aspecto por aspecto (post) ---------- */

  const prioridades: Seccion = {
    titulo: "Prioridades de la semana",
    pie: "Las cinco urgencias de la temporada: mezclan cuánto ocurre, lo peligroso que está siendo y lo poco que se ha trabajado. «Peligro» es el de quien saca: en lo defensivo, el que nos generan.",
    html: tabla(
      ["Aspecto", "Lado", "Urgencia", "Acciones", "Peligro", "Esta semana", "Temporada"],
      informe.prioridades.map((linea) => [
        esc(linea.aspecto),
        LADO_LABEL[linea.lado],
        linea.urgencia === null ? "—" : `<b>${Math.round(linea.urgencia)}</b>`,
        String(linea.acciones),
        esc(linea.peligro),
        linea.minutosSemana === "0'" ? `<span style="color:${NARANJA}">Sin trabajar</span>` : esc(linea.minutosSemana),
        esc(linea.minutosTemporada),
      ]),
    ),
    texto: informe.prioridades.map(
      (linea) =>
        `- ${nombreAspecto(linea.aspecto, linea.lado)} · urgencia ${linea.urgencia === null ? "—" : Math.round(linea.urgencia)} · ${linea.acciones} acciones · peligro ${linea.peligro} · esta semana ${linea.minutosSemana === "0'" ? "sin trabajar" : linea.minutosSemana}`,
    ),
  };

  const equipo: Seccion = {
    titulo: "Aspecto por aspecto, en la temporada",
    pie: "Todas nuestras hojas de ABP. «Transferencia» compara el peligro en los partidos con trabajo previo y sin él: positiva, el trabajo se nota; «—», todavía sin muestra.",
    html: tabla(
      ["Aspecto", "Lado", "Acciones", "Remates", "Goles", "Peligro", "Trabajado", "Transferencia"],
      informe.equipo.map((linea) => [
        esc(linea.aspecto),
        LADO_LABEL[linea.lado],
        String(linea.acciones),
        String(linea.remates),
        String(linea.goles),
        esc(linea.peligro),
        esc(linea.minutosTemporada),
        numeroConSigno(linea.transferencia, " pts"),
      ]),
    ),
    texto: informe.equipo.map(
      (linea) =>
        `- ${nombreAspecto(linea.aspecto, linea.lado)} · ${linea.acciones} acciones · ${linea.remates} remates · ${plural(linea.goles, "gol", "goles")} · peligro ${linea.peligro} · trabajado ${linea.minutosTemporada} · transferencia ${numeroConSigno(linea.transferencia, " pts")}`,
    ),
  };

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
        linea.evaluacion > 0 ? `<b>${dec(linea.evaluacion)}</b>` : "—",
        esc(linea.analisis || linea.observaciones || "—"),
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

  /* ---------- la categoría ---------- */

  const c = informe.comparativa;

  const categoria: Seccion | null = c
    ? {
        titulo: "Cómo estamos contra la categoría",
        pie: `${c.equipos} equipos · ${plural(c.jugados, "jornada", "jornadas")} · lo que Wyscout mide, por partido. En contra, el 1.º es el que menos concede. Sin goles: de la liga nadie publica de qué jugada nace cada uno.`,
        html: `${tabla(
          ["Métrica", "Nosotros", "Mediana", "Puesto", "En contra", "Mediana", "Puesto"],
          c.filas.map((fila) => [
            `<b>${esc(fila.rotulo)}</b>`,
            fmtMedida(fila.favor, fila.key),
            fmtMedida(fila.medianaFavor, fila.key),
            fila.puestoFavor === null ? "—" : `<b>${fila.puestoFavor}.º</b> de ${c.equipos}`,
            fmtMedida(fila.contra, fila.key),
            fmtMedida(fila.medianaContra, fila.key),
            fila.puestoContra === null ? "—" : `<b>${fila.puestoContra}.º</b> de ${c.equipos}`,
          ]),
        )}${graficos("wyscout")}`,
        texto: [
          ...c.filas.map(
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

  const seguimiento: Seccion = {
    titulo: "Seguimiento individual de balón parado",
    pie: `${plural(s.lineas.length, "registro", "registros")} de ${plural(s.jugadores, "jugador", "jugadores")}. Se reconoce por lo escrito en objetivos y feedback (la hoja no tiene casilla de ABP): es una lectura, no un dato cerrado.`,
    html: `${graficos("seguimiento")}${tabla(
      ["Jugador", "Fecha", "Quién", "Modalidad", "Objetivo", "Feedback"],
      s.lineas.map((linea) => [
        `<b>${esc(linea.jugador)}</b>`,
        esc(linea.fecha),
        esc(linea.quien),
        esc([linea.modalidad, linea.estrategia].filter(Boolean).join(" · ")),
        esc(linea.objetivo || "—"),
        esc(linea.feedback || "—"),
      ]),
    )}`,
    texto: s.lineas.map(
      (linea) => `- ${linea.jugador} · ${linea.fecha} · ${linea.objetivo || "sin objetivo escrito"}`,
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
    ? [claves, partido, cruce, valoracion, tiempo, semana, rival, acumulado, equipo, categoria, seguimiento]
    : [claves, prioridades, tiempo, semana, valoracion, rival, categoria, acumulado, seguimiento];

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

  const avisos = conPrefijo.avisos.length
    ? `<tr><td style="padding:6px 24px 8px"><table role="presentation" width="100%" style="width:100%;border-collapse:collapse"><tr><td style="padding:10px 12px;background:#FEF7E7;border-left:3px solid ${ORO};font:400 12px/1.6 Arial,sans-serif;color:#7A5B1E">${conPrefijo.avisos
        .map((aviso) => esc(aviso))
        .join("<br>")}</td></tr></table></td></tr>`
    : "";

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
  opciones: { imagenes?: ModoImagenes } = {},
) {
  const lineaPartido = [informe.partido, informe.vieneDe].filter(Boolean);

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

<tr><td style="padding:0">${informeCuerpoHtml(informe, opciones)}</td></tr>

<tr><td style="padding:18px 24px 24px;border-top:1px solid #E5E1D6">
  <p style="margin:0;font:400 11px/1.6 Arial,sans-serif;color:${SUAVE}">Generado automáticamente por la plataforma del Real Madrid Castilla · ${esc(informe.generado)}</p>
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
};

/** Un texto recortado a `n` caracteres por una palabra entera, con «…». */
function corto(texto: string, n = 90) {
  const limpio = texto.replace(/\s+/g, " ").trim();

  if (limpio.length <= n) return limpio;

  const cortado = limpio.slice(0, n - 1);

  const espacio = cortado.lastIndexOf(" ");

  return `${(espacio > n * 0.6 ? cortado.slice(0, espacio) : cortado).replace(/[\s,;:.·-]+$/, "")}…`;
}

export function pinceladaAbp(informe: InformeMicro): PinceladaAbp {
  const rivalNombre = informe.subtitulo.match(/^Contra (.+?)(?: · |$)/)?.[1] ?? "";

  const conclusiones = (informe.rivalAnalisis?.conclusiones ?? [])
    .filter((una) => una.texto.trim())
    .slice(0, 2)
    .map((una) => corto(`${una.seccion}: ${una.texto}`));

  /* Sin conclusiones escritas, al menos lo que hay preparado: que no parezca
     que del rival no se ha mirado nada. */
  const laminas = informe.graficos.filter((grafico) => grafico.area === "rival").length;

  const documentos = informe.rivalAnalisis?.documentos?.length ?? 0;

  const rival = conclusiones.length
    ? conclusiones
    : laminas || documentos
      ? [
          `Del rival: ${[laminas ? `${laminas} ${laminas === 1 ? "lámina" : "láminas"}` : "", documentos ? `${documentos} ${documentos === 1 ? "informe en PDF" : "informes en PDF"}` : ""]
            .filter(Boolean)
            .join(" y ")} en ABP del Rival, sin conclusiones escritas`,
        ]
      : [];

  const minutos = Math.round(informe.tiempo.minutos);

  const objetivo = `${fmtMin(informe.objetivo.minimo)}-${fmtMin(informe.objetivo.maximo)}`;

  const tareas = {
    rotulo: "Tareas valoradas",
    valor: `${informe.valoracion.valoradas}/${informe.valoracion.total}`,
    pie: informe.valoracion.media === null ? undefined : `media ${dec(informe.valoracion.media)}`,
  };

  if (informe.modo === "post") {
    const p = informe.partidoAbp;

    if (!p) {
      return {
        modo: "post",
        titular: "El partido aún no está registrado en las hojas de balón parado",
        claves: [`La semana: ${fmtMin(minutos)} de balón parado (objetivo ${objetivo})`],
        cifras: [{ rotulo: "Minutos de ABP", valor: fmtMin(minutos), pie: `objetivo ${objetivo}` }, tareas],
        rival,
      };
    }

    const trabajadas = p.cruce.filter((una) => una.trabajado && una.medible);

    const aparecieron = trabajadas.filter((una) => una.acciones > 0);

    const buenas = aparecieron.filter((una) => una.tono === "bien");

    const daño = p.cruce
      .filter((una) => !una.trabajado && una.lado === "defensivo" && (una.goles > 0 || una.peligros > 0))
      .sort((a, b) => b.goles - a.goles || b.peligros - a.peligros)[0];

    const claves = [
      `${p.favor.goles} a favor y ${p.contra.goles} en contra a balón parado · ${p.favor.remates}-${p.contra.remates} en remates`,
      trabajadas.length
        ? `De ${trabajadas.length} aspectos trabajados aparecieron ${aparecieron.length}; ${buenas.length} salieron bien`
        : "",
      daño ? `Nos hizo daño sin trabajarlo: ${nombreAspecto(daño.aspecto, daño.lado).toLowerCase()}` : "",
    ]
      .filter(Boolean)
      .map((una) => corto(una));

    return {
      modo: "post",
      titular:
        p.favor.goles > p.contra.goles
          ? `El balón parado sumó: ${p.favor.goles}-${p.contra.goles}${rivalNombre ? ` ante ${rivalNombre}` : ""}`
          : p.favor.goles < p.contra.goles
            ? `El balón parado restó: ${p.favor.goles}-${p.contra.goles}${rivalNombre ? ` ante ${rivalNombre}` : ""}`
            : p.favor.goles === 0
              ? "Sin goles a balón parado en ningún área"
              : `Empate a balón parado: ${p.favor.goles}-${p.contra.goles}`,
      claves: claves.slice(0, 3),
      cifras: [
        { rotulo: "Goles ABP", valor: `${p.favor.goles}·${p.contra.goles}`, pie: "a favor · en contra" },
        { rotulo: "Remates ABP", valor: `${p.favor.remates}·${p.contra.remates}`, pie: "a favor · en contra" },
        { rotulo: "xG ABP", valor: `${dec(p.favor.xg, 2)}·${dec(p.contra.xg, 2)}`, pie: "a favor · en contra" },
        { rotulo: "Minutos de ABP", valor: fmtMin(minutos), pie: `objetivo ${objetivo}` },
      ],
      rival,
    };
  }

  /* Previa: la urgencia número uno, cuánto se trabajó y lo que se dejó sin tocar. */
  const primera = informe.prioridades[0];

  const sinTocar = informe.prioridades.filter((una) => una.urgencia !== null && una.minutosSemana === fmtMin(0));

  const aspectos = new Set(informe.trabajos.flatMap((una) => una.aspectos.split(/,\s*/)).filter(Boolean)).size;

  const veredicto =
    informe.objetivo.veredicto === "corto"
      ? `faltan ${fmtMin(informe.objetivo.faltan)} para el objetivo`
      : informe.objetivo.veredicto === "pasado"
        ? "por encima del objetivo"
        : "dentro del objetivo";

  const claves = [
    primera
      ? `Urgencia nº 1: ${nombreAspecto(primera.aspecto, primera.lado).toLowerCase()} · ${
          primera.minutosSemana === fmtMin(0) ? "sin trabajar esta semana" : `${primera.minutosSemana} esta semana`
        }`
      : "",
    `${fmtMin(minutos)} de balón parado en la semana, ${veredicto} (${objetivo})`,
    sinTocar.length
      ? `Sin trabajar: ${sinTocar
          .slice(0, 2)
          .map((una) => nombreAspecto(una.aspecto, una.lado).toLowerCase())
          .join(" y ")}`
      : "",
  ]
    .filter(Boolean)
    .map((una) => corto(una));

  return {
    modo: "previa",
    titular: rivalNombre ? `Balón parado para el ${rivalNombre}: ${fmtMin(minutos)} de trabajo` : `${fmtMin(minutos)} de balón parado en la semana`,
    claves: claves.slice(0, 3),
    cifras: [
      { rotulo: "Minutos de ABP", valor: fmtMin(minutos), pie: `objetivo ${objetivo}` },
      {
        rotulo: "Aspectos trabajados",
        valor: String(aspectos),
        pie: informe.prioridades.length
          ? `${informe.prioridades.length - sinTocar.length} de ${informe.prioridades.length} urgencias`
          : undefined,
      },
      tareas,
    ],
    rival,
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

  if (informe.avisos.length) {
    lineas.push("", "AVISOS");
    informe.avisos.forEach((aviso) => lineas.push(`- ${aviso}`));
  }

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
