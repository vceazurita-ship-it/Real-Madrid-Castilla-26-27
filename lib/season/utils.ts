import { FileKind, MonthData, SeasonFile, WeekData } from "./types";

const MONTH_INDEX: Record<string, number> = {
  Ene: 0,
  Feb: 1,
  Mar: 2,
  Abr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Ago: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dic: 11,
};

/** Acepta "2026-07-27" y "27 Jul". La temporada va de julio 2026 a junio 2027. */
export function parseWeekDate(value: string): Date | null {
  if (!value) return null;

  if (value.includes("-")) {
    const iso = new Date(value);
    return isNaN(iso.getTime()) ? null : iso;
  }

  const [day, month] = value.trim().split(" ");
  const monthIndex = MONTH_INDEX[month];

  if (monthIndex === undefined || !day) return null;

  const year = monthIndex >= 6 ? 2026 : 2027;
  const date = new Date(year, monthIndex, Number(day));

  return isNaN(date.getTime()) ? null : date;
}

export function flattenWeeks(season: MonthData[]): WeekData[] {
  return season.flatMap((month) => month.weeks);
}

export function weekFileCount(week: WeekData) {
  return {
    images: week.images?.length ?? 0,
    pdfs: week.pdfs?.length ?? 0,
  };
}

export function weekHasFiles(week: WeekData) {
  const { images, pdfs } = weekFileCount(week);
  return images + pdfs > 0;
}

/** Semana que contiene la fecha indicada (hoy por defecto). */
export function findWeekForDate(
  season: MonthData[],
  reference: Date = new Date()
): WeekData | null {
  const day = new Date(reference);
  day.setHours(0, 0, 0, 0);

  const match = flattenWeeks(season).find((week) => {
    const start = parseWeekDate(week.start);
    const end = parseWeekDate(week.end);

    if (!start || !end) return false;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return day >= start && day <= end;
  });

  return match ?? null;
}

/**
 * Con la semana en curso conocida, las cuentas son de lo que ya ha pasado
 * («7 de 17 semanas con archivos») y no sobre las 52: medir contra la
 * temporada entera hacía que lo normal pareciera un fallo.
 */
export function seasonStats(
  season: MonthData[],
  currentWeekId: number | null = null
) {
  const all = flattenWeeks(season);

  const weeks =
    currentWeekId === null
      ? all
      : all.filter((week) => week.id <= currentWeekId);

  const seasonWeek =
    currentWeekId === null
      ? null
      : all.findIndex((week) => week.id === currentWeekId) + 1 || null;

  const images = weeks.reduce(
    (total, week) => total + (week.images?.length ?? 0),
    0
  );

  const pdfs = weeks.reduce(
    (total, week) => total + (week.pdfs?.length ?? 0),
    0
  );

  const completed = weeks.filter(weekHasFiles).length;

  // Pendientes: sólo semanas ya pasadas y sin archivos; las futuras no cuentan.
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const pending = weeks.filter((week) => {
    if (weekHasFiles(week)) return false;
    const fin = parseWeekDate(week.end);
    return !!fin && fin < hoy;
  }).length;

  return {
    totalWeeks: weeks.length,
    completed,
    pending,
    images,
    pdfs,
    progress:
      weeks.length > 0 ? Math.round((completed / weeks.length) * 100) : 0,
    /** Semana de la temporada en la que estamos (1-52) y cuántas tiene. */
    seasonWeek,
    seasonTotal: all.length,
    scopedToToday: currentWeekId !== null,
  };
}

/** Todos los archivos de la temporada, de la semana más reciente a la más antigua. */
export function collectFiles(
  season: MonthData[],
  kind: FileKind
): SeasonFile[] {
  return season
    .flatMap((month) =>
      month.weeks.flatMap((week) =>
        (kind === "images" ? week.images ?? [] : week.pdfs ?? []).map(
          (url): SeasonFile => ({
            url,
            kind,
            week: week.week,
            month: week.month || month.name,
            start: week.start,
            end: week.end,
            weekId: week.id,
          })
        )
      )
    )
    .sort((a, b) => b.weekId - a.weekId);
}

export function fileNameFromUrl(url: string) {
  const raw = url.split("?")[0].split("/").pop() ?? "archivo";

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Fuerza la descarga. Los archivos de Supabase son otro origen, así que el
 * atributo `download` se ignora: hay que pedirlo con el parámetro `?download=`.
 */
/**
 * Nombre para enseñar. Los archivos subidos llevan un sello técnico
 * («1783751973455-ozwumosqbm.jpeg», «informe-lk3j2h9s4abc.pdf»): se quita, y
 * si no queda nada con sentido se usa el rótulo de reserva («Imagen 2»).
 */
export function humanFileName(url: string, fallback: string) {
  const name = fileNameFromUrl(url);
  const dot = name.lastIndexOf(".");

  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";

  if (/^\d{9,}/.test(base)) return fallback;

  /* Sello largo de la subida, o un número suelto de 5-6 cifras al final
     («RMCF-HOJA-FIRMAS-53245» → «RMCF-HOJA-FIRMAS»). */
  const sinSello = base
    .replace(/-(?=[a-z0-9]*\d)[a-z0-9]{10,14}$/i, "")
    .replace(/-\d{5,6}$/, "");

  return sinSello ? `${sinSello}${extension}` : fallback;
}

export function downloadUrl(url: string) {
  const name = fileNameFromUrl(url);

  if (!url.startsWith("http")) return url;

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}download=${encodeURIComponent(name)}`;
}

/*
| UN SOLO FORMATO DE FECHAS (30/10/2026)
|
| La hoja escribe «24 Ago» y cada sitio lo pintaba a su manera: «24 Ago — 30
| Ago» en la cabecera, «26 Oct · 1 Nov» en la lista. En español los meses
| abreviados van en minúscula y el intervalo lleva una raya corta: «24 ago –
| 30 ago». Sin fechas no se dice nada (antes, «Fechas sin definir»).
*/
export function fechaSemana(valor: string | null | undefined) {
  return String(valor ?? "").trim().toLocaleLowerCase("es-ES");
}

export function rangoFechas(start: string | null | undefined, end: string | null | undefined) {
  const desde = fechaSemana(start);
  const hasta = fechaSemana(end);

  if (desde && hasta) return `${desde} – ${hasta}`;

  return desde || hasta;
}

export function weekRangeLabel(week: WeekData) {
  return rangoFechas(week.start, week.end);
}
