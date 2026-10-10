/**
 * EL PRÓXIMO PARTIDO, PARA LA PORTADA.
 *
 * La portada abre con el partido que viene: contra quién, cuándo, dónde y en
 * qué día de la semana de trabajo estamos. Las fechas salen del calendario de
 * BeSoccer (`castilla:calendario`, ver `lib/castilla/calendario.ts`) y los
 * escudos, los campos y nuestra fila de la tabla de `/api/data-analisis?portada=1`,
 * que abre el informe de rivales en el servidor y manda sólo lo que cabe aquí.
 *
 * Todo lo de este módulo es puro: recibe el reloj como argumento y no mira la
 * hora por su cuenta, que es lo que permite llamarlo desde el render.
 */

import { mismoClub } from "@/lib/rivals/mismoClub";

export type EquipoPortada = {
  /** Como lo escribe la hoja ("Teruel"). */
  nombre: string;
  /** Como lo escribe BeSoccer ("CD Teruel"): coincide con el calendario. */
  nombreLargo: string;
  escudo: string;
  estadio: string;
  ciudad: string;
};

export type ClasificacionPortada = {
  puesto: number;
  deCuantos: number;
  puntos: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  favor: number;
  contra: number;
};

export type RespuestaPortada = {
  equipos: EquipoPortada[];
  clasificacion: ClasificacionPortada | null;
};

/** El rival del calendario, buscado entre los del informe con la regla de siempre. */
export function equipoDelInforme(equipos: EquipoPortada[], rival: string) {
  if (!rival) return null;

  return (
    equipos.find((equipo) => equipo.nombreLargo === rival) ??
    equipos.find(
      (equipo) => mismoClub(equipo.nombreLargo, rival) || mismoClub(equipo.nombre, rival),
    ) ??
    null
  );
}

const ZONA = "Europe/Madrid";

/**
 * "Domingo, 18 de octubre".
 *
 * Sólo la primera letra en mayúscula: con `capitalize` de CSS salía «Domingo,
 * 18 De Octubre», que en castellano no se escribe así.
 */
export function diaLargo(cuando: string) {
  const fecha = new Date(cuando);

  if (Number.isNaN(fecha.getTime())) return "";

  const texto = fecha.toLocaleDateString("es-ES", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "12:00". */
export function horaCorta(cuando: string) {
  const fecha = new Date(cuando);

  if (Number.isNaN(fecha.getTime())) return "";

  return fecha.toLocaleTimeString("es-ES", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** El día natural en Madrid, "2026-10-18", de un instante cualquiera. */
export function diaEnMadrid(instante: number) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instante));

  return partes.slice(0, 10);
}

/**
 * Cuánto falta, dicho como se dice: «hoy», «mañana», «en 5 días».
 *
 * Se cuenta por días naturales y no por horas: un partido del domingo a las
 * doce es «mañana» todo el sábado, aunque falten treinta horas.
 */
export function cuantoFalta(cuando: string, ahora: number) {
  const partido = (cuando || "").slice(0, 10);

  const hoy = diaEnMadrid(ahora);

  if (!partido || !hoy) return "";

  const dias = Math.round(
    (Date.parse(`${partido}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000,
  );

  if (dias <= 0) return "hoy";
  if (dias === 1) return "mañana";

  return `en ${dias} días`;
}

/** "V", "E" o "D" para un partido jugado. */
export function signoResultado(favor: number | null, contra: number | null) {
  if (favor === null || contra === null) return null;

  if (favor > contra) return "V" as const;
  if (favor < contra) return "D" as const;

  return "E" as const;
}
