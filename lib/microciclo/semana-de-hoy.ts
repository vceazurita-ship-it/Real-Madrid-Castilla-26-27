/**
 * LA SEMANA DE HOY, UNA SOLA FUENTE (16/11/2026).
 *
 * Las cuatro pantallas de planificación no se ponían de acuerdo sobre la
 * semana en curso: /microcycles tenía el micro 22 con 13 tareas del 16 al
 * 19/11, los dos calendarios pintaban esa semana vacía (leían una copia de la
 * hoja que sólo trae lo ya hecho) y /jugadores-sesion se abría en el 12/11.
 * Además el MD de un mismo día cambiaba: el creador de micros cuenta hasta 14
 * días antes del partido (el 22/11 es MD-7) y los calendarios cortaban en 6.
 *
 * Aquí está la definición que comparten:
 *
 * - **MD de un día**: los días que faltan para el próximo partido del
 *   calendario, desde el día siguiente al partido anterior y hasta 14 días
 *   (lo mismo que `formaSemana` y el creador de /laboratorio/microciclo).
 * - **El micro de hoy**: el que tiene hoy entre su primera y su última fecha;
 *   si hoy cae entre dos (el libre de después del partido), el siguiente si
 *   ya está planificado; si no, el último que empezó.
 * - **Sus días**: del día siguiente al partido anterior hasta su partido, con
 *   su MD y sus tareas, estén hechas o sólo planificadas (sin minutos).
 *
 * Puro: sin reloj ni red. El «hoy» llega de fuera, en «AAAA-MM-DD».
 */

import { soloDia } from "@/lib/castilla/calendario";

import { esFilaDePartido, etiquetaMicro, fechaIsoDeHoja, rivalDelMicro, separaSemanas } from "./cuenta";

const DIA_MS = 86_400_000;

/** Hasta dónde se cuenta hacia atrás desde el partido, como el creador de micros. */
export const MD_MAXIMO = 14;

const aDias = (iso: string) => Math.round(Date.parse(`${iso}T12:00:00Z`) / DIA_MS);

const esIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const sumaDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

/** Las fechas de partido, «AAAA-MM-DD», ordenadas y sin repetir (acepta el `cuando` de BeSoccer). */
export function fechasDePartido(fechas: Iterable<string>) {
  return [...new Set([...fechas].map((f) => soloDia(String(f ?? ""))).filter(esIso))].sort();
}

/**
 * El MD de un día, con la misma numeración que el creador de micros: «MD» el
 * día del partido; «MD-n» con n = días que faltan para el próximo (hasta 14);
 * «» si no hay partido a la vista.
 */
export function mdDelDia(dia: string, fechas: Iterable<string>): string {
  if (!esIso(dia)) return "";

  const lista = fechasDePartido(fechas);

  if (lista.includes(dia)) return "MD";

  const proximo = lista.find((f) => f > dia);

  if (!proximo) return "";

  const n = aDias(proximo) - aDias(dia);

  return n >= 1 && n <= MD_MAXIMO ? `MD-${n}` : "";
}

/**
 * EL MD DE LOS CALENDARIOS (17/11/2026, r20, jueces). /calendar_general y
 * /micro_calendar ponían MD distintos al mismo día (el 21/11, «Libre» en uno
 * y «MD+1» en otro; el 01/12, «MD+2» y «MD-5»). Una sola regla para los dos:
 * «MD» el día del partido; «MD+1» el día después; «MD+2» el segundo día
 * después, salvo que el siguiente partido esté a dos días o menos; si no,
 * «MD-n» hasta el próximo (como `mdDelDia`).
 */
export function mdDelCalendario(dia: string, fechas: Iterable<string>): string {
  if (!esIso(dia)) return "";

  const lista = fechasDePartido(fechas);

  if (lista.includes(dia)) return "MD";

  const anterior = [...lista].reverse().find((f) => f < dia);
  const proximo = lista.find((f) => f > dia);
  const despues = anterior ? aDias(dia) - aDias(anterior) : Infinity;
  const antes = proximo ? aDias(proximo) - aDias(dia) : Infinity;

  if (despues === 1) return "MD+1";
  if (despues === 2 && antes > 2) return "MD+2";

  return antes >= 1 && antes <= MD_MAXIMO ? `MD-${antes}` : "";
}

/**
 * El MD que se pinta en un día SIN sesión de los calendarios: MD, MD+1, MD+2
 * y MD-1 a MD-5 siempre; MD-6 en adelante, sólo en la semana en curso (de hoy
 * al próximo partido): los de semanas lejanas eran ruido.
 */
export function mdALaVista(dia: string, fechas: Iterable<string>, hoy: string): string {
  const md = mdDelCalendario(dia, fechas);
  const n = /^MD-(\d+)$/.exec(md);

  if (!n || Number(n[1]) <= 5) return md;

  const proximo = esIso(hoy) ? fechasDePartido(fechas).find((f) => f >= hoy) : undefined;

  return proximo && dia >= hoy && dia <= proximo ? md : "";
}

/** Lo mínimo de una fila de la hoja de registro para armar la semana. */
export type FilaSemana = {
  micro: number;
  rival: string;
  fecha: string;
  md?: string;
  tarea?: string;
  fase?: string;
  tipoTarea?: string;
  contenidoPrincipal?: string;
  tiempo?: number;
};

const filaDeCuenta = (f: FilaSemana) => ({ md: f.md, fase: f.fase, tipo: f.tipoTarea, contenidoPrincipal: f.contenidoPrincipal });

/** ¿Es la fila del partido? La misma regla que lib/microciclo/cuenta.ts. */
export const esPartidoDeLaHoja = (f: FilaSemana) => esFilaDePartido(filaDeCuenta(f));

/**
 * El micro de hoy (13, o 13,1 para el «13B»), o `null` si la hoja no tiene
 * fechas que se entiendan.
 */
export function microDeHoy<T extends FilaSemana>(filas: T[], hoy: string): number | null {
  if (!esIso(hoy)) return null;

  const tramos = new Map<number, { desde: string; hasta: string }>();

  for (const f of separaSemanas(filas.filter((x) => x.micro > 0))) {
    const iso = fechaIsoDeHoja(f.fecha);

    if (!iso) continue;

    const t = tramos.get(f.micro);

    tramos.set(f.micro, t ? { desde: iso < t.desde ? iso : t.desde, hasta: iso > t.hasta ? iso : t.hasta } : { desde: iso, hasta: iso });
  }

  if (tramos.size === 0) return null;

  let empezado: { micro: number; desde: string; hasta: string } | null = null;
  let siguiente: { micro: number; desde: string } | null = null;

  for (const [micro, { desde, hasta }] of tramos) {
    if (desde <= hoy && hoy <= hasta) return micro;

    if (desde <= hoy && (!empezado || desde > empezado.desde)) empezado = { micro, desde, hasta };

    if (desde > hoy && (!siguiente || desde < siguiente.desde)) siguiente = { micro, desde };
  }

  /* Entre dos micros (el libre tras el partido): manda el que viene si ya
     está planificado y empieza dentro de una semana. */
  if (siguiente && aDias(siguiente.desde) - aDias(hoy) <= 7) return siguiente.micro;

  return empezado?.micro ?? siguiente?.micro ?? null;
}

export type DiaDeLaSemana<T extends FilaSemana> = {
  /** «2026-11-16». */
  fecha: string;
  /** «MD-4», «MD»; «» si no hay partido a la vista. */
  md: string;
  partido: boolean;
  /** Todas las filas del día en la hoja, partido incluido. */
  tareas: T[];
  /** Sólo las de entreno. */
  entreno: T[];
  /** Sin tareas ni partido. */
  libre: boolean;
  /** Las tareas del día no tienen minutos todavía: están planificadas. */
  planificado: boolean;
  hoy: boolean;
};

export type SemanaDeHoy<T extends FilaSemana> = {
  micro: number;
  /** «22», «13B». */
  etiqueta: string;
  rival: string;
  dias: DiaDeLaSemana<T>[];
  tareasEntreno: number;
  /** 1 si la semana tiene su partido (en la hoja o en el calendario). */
  partidos: number;
  /** «13 tareas de entreno + 1 partido»: la cuenta única de la semana. */
  cuenta: string;
  /** El día de trabajo que toca: hoy si se entrena, si no el próximo con tareas. */
  diaDeTrabajo: DiaDeLaSemana<T> | null;
};

/** «13 tareas de entreno + 1 partido», «1 tarea de entreno». */
export function textoTareasYPartido(tareas: number, partidos: number) {
  const t = `${tareas} ${tareas === 1 ? "tarea" : "tareas"} de entreno`;

  return partidos > 0 ? `${t} + ${partidos} ${partidos === 1 ? "partido" : "partidos"}` : t;
}

/**
 * La semana de un micro con sus días (del día siguiente al partido anterior
 * hasta el suyo), su MD y sus tareas planificadas o hechas.
 */
export function semanaDelMicro<T extends FilaSemana>(filas: T[], micro: number, fechas: Iterable<string>, hoy = ""): SemanaDeHoy<T> | null {
  const separadas = separaSemanas(filas.filter((x) => x.micro > 0));
  const suyas = separadas.filter((f) => Math.abs(f.micro - micro) < 1e-6) as T[];

  if (suyas.length === 0) return null;

  const partidosCal = fechasDePartido(fechas);
  const porDia = new Map<string, T[]>();

  for (const f of suyas) {
    const iso = fechaIsoDeHoja(f.fecha);

    if (iso) porDia.set(iso, [...(porDia.get(iso) ?? []), f]);
  }

  const conTareas = [...porDia.keys()].sort();

  if (conTareas.length === 0) return null;

  /* El partido del micro: la fila de competición o, si la hoja no la tiene,
     el primero del calendario desde su último día con tareas. */
  const deLaHoja = conTareas.find((d) => (porDia.get(d) ?? []).some(esPartidoDeLaHoja));
  const ultimo = conTareas[conTareas.length - 1];
  const delCalendario = partidosCal.find((f) => f >= ultimo && aDias(f) - aDias(ultimo) <= 6);
  const fechaPartido = deLaHoja ?? delCalendario ?? "";

  /* El primer día: el siguiente al partido anterior, si está a dos semanas; si no, el primero con tareas. */
  const anterior = fechaPartido ? [...partidosCal].reverse().find((f) => f < fechaPartido) : undefined;
  const primero = conTareas[0];
  const desde =
    anterior && aDias(fechaPartido) - aDias(anterior) <= MD_MAXIMO && sumaDias(anterior, 1) <= primero ? sumaDias(anterior, 1) : primero;
  const hasta = fechaPartido && fechaPartido > ultimo ? fechaPartido : ultimo;

  const todas = fechaPartido && !partidosCal.includes(fechaPartido) ? [...partidosCal, fechaPartido] : partidosCal;
  const dias: DiaDeLaSemana<T>[] = [];

  for (let d = desde; d <= hasta && dias.length < 21; d = sumaDias(d, 1)) {
    const tareas = porDia.get(d) ?? [];
    const entreno = tareas.filter((f) => !esPartidoDeLaHoja(f));
    const partido = d === fechaPartido || tareas.some(esPartidoDeLaHoja);
    const escrito = String(tareas.find((f) => String(f.md ?? "").trim())?.md ?? "").trim().toUpperCase();

    dias.push({
      fecha: d,
      md: mdDelDia(d, todas) || escrito,
      partido,
      tareas,
      entreno,
      libre: entreno.length === 0 && !partido,
      planificado: entreno.length > 0 && entreno.every((f) => !(Number(f.tiempo) > 0)),
      hoy: d === hoy,
    });
  }

  const tareasEntreno = dias.reduce((s, d) => s + d.entreno.length, 0);
  const partidos = fechaPartido ? 1 : 0;
  const diaDeTrabajo = esIso(hoy) ? (dias.find((d) => d.fecha >= hoy && d.entreno.length > 0) ?? null) : null;

  return {
    micro,
    etiqueta: etiquetaMicro(micro),
    rival: rivalDelMicro(suyas.find((f) => f.rival.trim())?.rival.trim() ?? ""),
    dias,
    tareasEntreno,
    partidos,
    cuenta: textoTareasYPartido(tareasEntreno, partidos),
    diaDeTrabajo,
  };
}

/** La semana de hoy: el micro de hoy con sus días, su MD y sus tareas. */
export function semanaDeHoy<T extends FilaSemana>(filas: T[], fechas: Iterable<string>, hoy: string): SemanaDeHoy<T> | null {
  const micro = microDeHoy(filas, hoy);

  return micro === null ? null : semanaDelMicro(filas, micro, fechas, hoy);
}

/**
 * Los días con tareas de la hoja que NO trae otra fuente (la copia del Apps
 * Script sólo trae lo hecho): lo planificado, para pintarlo aparte en los
 * calendarios. Devuelve fecha → filas.
 */
export function diasPlanificados<T extends FilaSemana>(filas: T[], yaPintados: Set<string>): Map<string, T[]> {
  const mapa = new Map<string, T[]>();

  for (const f of filas) {
    const iso = fechaIsoDeHoja(f.fecha);

    if (!iso || yaPintados.has(iso) || f.micro <= 0 || !String(f.tarea ?? "").trim()) continue;

    mapa.set(iso, [...(mapa.get(iso) ?? []), f]);
  }

  return mapa;
}
