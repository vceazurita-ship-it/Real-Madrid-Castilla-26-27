/**
 * NUESTRO CALENDARIO: DEL PARTIDO ANTERIOR AL SIGUIENTE.
 *
 * Las fechas salen de BeSoccer (`scripts/castilla-calendario.cjs`, que lo deja
 * en el documento `castilla:calendario`) porque son las únicas que traen la
 * hora y los adelantos: el calendario de la quiniela se quedó sin los partidos
 * del Castilla y las hojas no tienen fecha de partido.
 *
 * Aquí está lo que se deduce de ellas y que necesita el microciclo: cuál es el
 * próximo, cuál fue el anterior y **qué forma tiene la semana**. No es lo mismo
 * de domingo a domingo (siete días) que de sábado a viernes (seis) o de viernes
 * a domingo (nueve): los días de entrenamiento cambian y con ellos el reparto
 * de los 90′ de balón parado.
 */

import type { PartidoBeSoccer } from "@/lib/quiniela/besoccer";

export const CLAVE_CALENDARIO = "castilla:calendario";

/** La ficha de BeSoccer trae dos temporadas; ésta empieza aquí. */
export const DESDE = "2026-07-01";

/** Cómo se llama el Castilla en BeSoccer. */
export const NOSOTROS = "Castilla";

export type PartidoCastilla = PartidoBeSoccer;

export function ordenaPartidos(partidos: PartidoCastilla[]) {
  return [...partidos].sort((a, b) => a.cuando.localeCompare(b.cuando));
}

export function esNuestro(nombre: string) {
  return /castilla/i.test(nombre || "");
}

export type Lado = "casa" | "fuera";

export type PartidoNuestro = {
  jornada: number;
  /** "2026-09-20T12:00", tal cual lo da BeSoccer (hora de Madrid). */
  cuando: string;
  rival: string;
  lado: Lado;
  golesFavor: number | null;
  golesContra: number | null;
  jugado: boolean;
};

export function comoNuestro(partido: PartidoCastilla): PartidoNuestro {
  const enCasa = esNuestro(partido.local);

  const jugado = partido.golesLocal !== null && partido.golesVisitante !== null;

  return {
    jornada: partido.jornada,
    cuando: partido.cuando,
    rival: enCasa ? partido.visitante : partido.local,
    lado: enCasa ? "casa" : "fuera",
    golesFavor: jugado ? (enCasa ? partido.golesLocal : partido.golesVisitante) : null,
    golesContra: jugado ? (enCasa ? partido.golesVisitante : partido.golesLocal) : null,
    jugado,
  };
}

/**
 * El próximo y el anterior, mirados desde un momento dado.
 *
 * El corte no es «tiene marcador»: un partido recién jugado tarda un rato en
 * tenerlo, y hasta entonces se colaría como «el próximo». Se mira la hora, y
 * se le dan dos horas y media de gracia —lo que dura un partido con su
 * descanso— para que el de esta tarde siga siendo el de hoy mientras se juega.
 */
export function alrededorDe(partidos: PartidoCastilla[], ahora: number) {
  const nuestros = ordenaPartidos(partidos).map(comoNuestro).filter((uno) => uno.cuando);

  const corte = ahora - 2.5 * 3_600_000;

  const proximo = nuestros.find((uno) => Date.parse(uno.cuando) > corte) ?? null;

  const anteriores = nuestros.filter((uno) => Date.parse(uno.cuando) <= corte);

  return { proximo, anterior: anteriores[anteriores.length - 1] ?? null, todos: nuestros };
}

/* ------------------------------------------------------------------ */
/*  LA FORMA DE LA SEMANA                                              */
/* ------------------------------------------------------------------ */

export type DiaSemana = {
  /** "2026-09-22". */
  fecha: string;
  /** Lunes, martes… en español y en minúscula. */
  nombre: string;
  /** Días que faltan para el partido: 6, 5, … 1, y 0 el día del partido. */
  md: number;
  /** "MD-3", "MD" — como se rotula en la pizarra. */
  rotulo: string;
  /** El día siguiente al partido anterior, que se descansa o se recupera. */
  esPostPartido: boolean;
  /** El día de partido no entrena, y el de descanso tampoco. */
  entrena: boolean;
  /** Descanso propuesto; el cuerpo técnico lo mueve. */
  descanso: boolean;
};

const NOMBRES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const DIA = 86_400_000;

/** El día natural de una fecha de BeSoccer, sin arrastrar la hora. */
export function soloDia(cuando: string) {
  return (cuando || "").slice(0, 10);
}

const aMedioDia = (dia: string) => Date.parse(`${dia}T12:00:00Z`);

export function diasEntre(desde: string, hasta: string) {
  return Math.round((aMedioDia(hasta) - aMedioDia(desde)) / DIA);
}

/**
 * Los días que hay entre un partido y el siguiente.
 *
 * Se cuentan desde el día siguiente al partido anterior hasta el día del
 * próximo, los dos incluidos. Sin partido anterior —la primera jornada, o una
 * vuelta de parón— se toman seis días, que es la semana de siempre.
 *
 * **El descanso se propone, no se impone**: el día siguiente al partido si la
 * semana da de sí (seis días o más), y ninguno si la semana es corta. Es lo que
 * más se mueve de un cuerpo técnico a otro, y por eso se puede cambiar.
 */
export function formaSemana(proximo: string, anterior: string | null): DiaSemana[] {
  const partido = soloDia(proximo);

  const desde = anterior ? soloDia(anterior) : "";

  const largo = desde ? Math.min(Math.max(diasEntre(desde, partido), 1), 14) : 7;

  const dias: DiaSemana[] = [];

  for (let atras = largo - 1; atras >= 0; atras -= 1) {
    const fecha = new Date(aMedioDia(partido) - atras * DIA).toISOString().slice(0, 10);

    const esPostPartido = Boolean(desde) && atras === largo - 1;

    /* Sin partido anterior no hay post-partido: la semana empieza limpia. */
    const descanso = esPostPartido && largo >= 6;

    dias.push({
      fecha,
      nombre: NOMBRES[new Date(aMedioDia(fecha)).getUTCDay()],
      md: atras,
      rotulo: atras === 0 ? "MD" : `MD-${atras}`,
      esPostPartido,
      entrena: atras > 0 && !descanso,
      descanso,
    });
  }

  return dias;
}

/** «de domingo a domingo», «de sábado a viernes». */
export function comoSeLlama(dias: DiaSemana[], anterior: string | null) {
  const partido = dias[dias.length - 1];

  if (!anterior) return `hasta el ${partido?.nombre ?? ""}`;

  const salida = new Date(aMedioDia(soloDia(anterior))).getUTCDay();

  return `de ${NOMBRES[salida]} a ${partido?.nombre ?? ""}`;
}
