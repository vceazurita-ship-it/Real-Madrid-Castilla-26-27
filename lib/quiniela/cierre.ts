/**
 * CUÁNDO SE CIERRA UNA JORNADA.
 *
 * **El viernes a las 12:00**, hora de Madrid, de la semana en la que se juega.
 * A partir de ahí la jornada no se toca: ni para rellenar lo que faltaba ni
 * para cambiar lo puesto. Antes se avisa por correo, a las 9:00 de ese mismo
 * viernes.
 *
 * Dos cosas que no son obvias y que están resueltas aquí:
 *
 * - **El huso.** El calendario guarda fechas sin hora (`2026-08-30`) y el
 *   servidor corre en UTC. En verano Madrid va dos horas por delante y en
 *   invierno una, así que «las 12:00» no es una hora fija de UTC. Se resuelve
 *   preguntándole a `Intl` qué hora es en Madrid, que es la única forma de no
 *   equivocarse dos veces al año sin meter una librería.
 * - **Qué viernes.** No es «el viernes anterior al primer partido» sin más:
 *   una jornada puede tener un partido adelantado al propio viernes. Se toma
 *   el viernes de la semana del **primer** partido, y si ese partido cae en
 *   viernes, es ese mismo día.
 */

import { partidosDe } from "./modelo";

export const HORA_CIERRE = 12;
export const HORA_AVISO = 9;

const ZONA = "Europe/Madrid";

/* ------------------------------------------------------------------ */
/*  LA HORA DE MADRID                                                  */
/* ------------------------------------------------------------------ */

const FORMATO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

export type EnMadrid = {
  /** "2026-09-18". */
  fecha: string;
  hora: number;
  minuto: number;
  /** 0 domingo … 5 viernes … 6 sábado. */
  diaSemana: number;
};

const DIAS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Qué día y qué hora es en Madrid en un instante dado. */
export function enMadrid(instante: Date): EnMadrid {
  const trozos = FORMATO.formatToParts(instante);

  const dame = (tipo: string) =>
    trozos.find((uno) => uno.type === tipo)?.value ?? "";

  /* `hour12: false` puede dar "24" a medianoche en algunos motores. */
  const hora = Number(dame("hour")) % 24;

  return {
    fecha: `${dame("year")}-${dame("month")}-${dame("day")}`,
    hora,
    minuto: Number(dame("minute")),
    diaSemana: DIAS[dame("weekday")] ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/*  EL VIERNES DE UNA JORNADA                                          */
/* ------------------------------------------------------------------ */

/** El día de la semana de una fecha en texto, sin tocar husos. */
function diaDe(fecha: string) {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

/** Suma días a una fecha en texto y devuelve otra fecha en texto. */
function suma(fecha: string, dias: number) {
  const base = new Date(`${fecha}T12:00:00Z`);

  base.setUTCDate(base.getUTCDate() + dias);

  return base.toISOString().slice(0, 10);
}

/**
 * El viernes de la semana en la que se juega una jornada.
 *
 * `null` si la jornada no tiene partidos, que no debería pasar nunca pero deja
 * la pantalla en «abierta» en vez de reventar.
 */
export function viernesDe(jornada: number): string | null {
  const partidos = partidosDe(jornada);

  if (partidos.length === 0) return null;

  const primera = partidos.reduce(
    (menor, uno) => (menor === "" || uno.fecha < menor ? uno.fecha : menor),
    "",
  );

  const dia = diaDe(primera);

  /*
  | Se retrocede hasta el viernes anterior o igual.
  |
  | Domingo (0) son dos días atrás; sábado (6), uno; viernes (5), cero. Un
  | partido entre semana —un aplazado en miércoles— tiraría del viernes de la
  | semana anterior, que es lo correcto: no se puede cerrar el plazo después de
  | haberse jugado un partido de la jornada.
  */
  const atras = (dia - 5 + 7) % 7;

  return suma(primera, -atras);
}

export type EstadoJornada = {
  /** "2026-09-18", o `null` si no se sabe. */
  viernes: string | null;
  /** Si ya no se puede tocar. */
  cerrada: boolean;
  /** Si hoy es el viernes de cierre y todavía se puede. */
  ultimasHoras: boolean;
};

/**
 * Cómo está una jornada **ahora mismo**.
 *
 * Recibe el instante en vez de preguntarlo para que se pueda comprobar sin
 * esperar a un viernes, y porque llamar a `new Date()` durante el render
 * rompe las reglas de pureza de React.
 */
export function estadoDe(jornada: number, ahora: Date): EstadoJornada {
  const viernes = viernesDe(jornada);

  if (!viernes) return { viernes: null, cerrada: false, ultimasHoras: false };

  const hoy = enMadrid(ahora);

  if (hoy.fecha > viernes) return { viernes, cerrada: true, ultimasHoras: false };

  if (hoy.fecha < viernes) {
    return { viernes, cerrada: false, ultimasHoras: false };
  }

  /* Es el viernes: manda la hora. */
  const cerrada = hoy.hora >= HORA_CIERRE;

  return { viernes, cerrada, ultimasHoras: !cerrada };
}

/** "viernes 18 de septiembre a las 12:00", para escribirlo en pantalla. */
export function cuandoCierra(viernes: string | null) {
  if (!viernes) return "";

  const [, mes, dia] = viernes.split("-");

  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  return `viernes ${Number(dia)} de ${meses[Number(mes) - 1] ?? ""} a las ${HORA_CIERRE}:00`;
}

/**
 * Qué jornada le toca avisar a un viernes dado.
 *
 * Lo usa el correo de las 9:00: en vez de calcular «la jornada de hoy» con la
 * regla de la pantalla —que mira partidos jugados—, se pregunta al revés, cuál
 * es la jornada cuyo viernes es hoy. Así el aviso no depende de que alguien
 * haya metido los resultados de la semana pasada.
 */
export function jornadaQueCierraEl(fecha: string, jornadas: number[]) {
  return jornadas.find((una) => viernesDe(una) === fecha) ?? null;
}
