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

import Papa from "papaparse";

import { REGISTRO_GID } from "@/lib/abp/registro";
import { sheetUrl } from "@/lib/abp/sheets";
import type { DiaSemana } from "@/lib/castilla/calendario";
import { traeCsv } from "@/lib/hojaCsv";
import { fechaIsoDeHoja } from "@/lib/registro/hoja";
import { mismoClub } from "@/lib/rivals/mismoClub";

/* ------------------------------------------------------------------ */
/*  LOS DÍAS LIBRES DEL MICROCICLO                                     */
/* ------------------------------------------------------------------ */

/**
 * Los días que tienen alguna tarea en la hoja de registro (10/10/2026).
 *
 * La tira de la semana de la portada proponía el descanso de siempre —el
 * día después del partido— aunque el cuerpo técnico hubiera decidido otra
 * cosa en el microciclo. En la hoja de registro un día libre **es un día sin
 * filas** (`/laboratorio/microciclo` no escribe nada en los libres), así que
 * basta con saber qué fechas tienen tareas.
 *
 * Va por `traeCsv` y no por `loadRegistro`: ésta es la pantalla que más se
 * abre y aquí sólo hace falta la columna de la fecha, leída de la copia que
 * ya tiene el navegador.
 */
export async function fechasConTarea(): Promise<Set<string>> {
  const csv = await traeCsv(sheetUrl(REGISTRO_GID));

  const filas = Papa.parse<string[]>(csv, { header: false, skipEmptyLines: true }).data;

  /* La fila de cabeceras no es la primera: encima hay un título. */
  const cabecera = filas.findIndex((fila) => String(fila?.[0] ?? "").trim().toLowerCase() === "temporada");

  if (cabecera < 0) return new Set();

  const columna = filas[cabecera].findIndex((valor) =>
    String(valor ?? "").trim().toLowerCase().startsWith("fecha"),
  );

  if (columna < 0) return new Set();

  const fechas = new Set<string>();

  for (const fila of filas.slice(cabecera + 1)) {
    const iso = fechaIsoDeHoja(fila?.[columna]);

    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) fechas.add(iso);
  }

  return fechas;
}

/**
 * Qué días de la semana son libres.
 *
 * Si el microciclo ya está en la hoja —algún día de la semana, que no sea el
 * del partido, tiene tareas— mandan sus filas: libre es el día sin ninguna.
 * Si todavía no se ha escrito, se enseña la propuesta de siempre, y se dice
 * que es una propuesta.
 */
export function libresDeLaSemana(
  dias: DiaSemana[],
  conTarea: Set<string> | null,
  /** Lo decidido en el editor para esta semana (`lib/portada/libres.ts`). */
  decididos?: string[] | null,
): { libres: Set<string>; delMicro: boolean } {
  const entrenables = dias.filter((dia) => dia.md > 0);

  /* Lo decidido a mano manda, aunque la hoja todavía no tenga el micro. */
  if (decididos) {
    const enLaSemana = new Set(entrenables.map((dia) => dia.fecha));

    return {
      libres: new Set(decididos.filter((fecha) => enLaSemana.has(fecha))),
      delMicro: true,
    };
  }

  const escrito = conTarea !== null && entrenables.some((dia) => conTarea.has(dia.fecha));

  if (!escrito) {
    return { libres: new Set(dias.filter((dia) => dia.descanso).map((dia) => dia.fecha)), delMicro: false };
  }

  return {
    libres: new Set(entrenables.filter((dia) => !conTarea.has(dia.fecha)).map((dia) => dia.fecha)),
    delMicro: true,
  };
}

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
