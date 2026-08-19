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

export function seasonStats(season: MonthData[]) {
  const weeks = flattenWeeks(season);

  const images = weeks.reduce(
    (total, week) => total + (week.images?.length ?? 0),
    0
  );

  const pdfs = weeks.reduce(
    (total, week) => total + (week.pdfs?.length ?? 0),
    0
  );

  const completed = weeks.filter(weekHasFiles).length;

  return {
    totalWeeks: weeks.length,
    completed,
    images,
    pdfs,
    progress:
      weeks.length > 0 ? Math.round((completed / weeks.length) * 100) : 0,
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
export function downloadUrl(url: string) {
  const name = fileNameFromUrl(url);

  if (!url.startsWith("http")) return url;

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}download=${encodeURIComponent(name)}`;
}

export function weekRangeLabel(week: WeekData) {
  if (!week.start && !week.end) return "Fechas sin definir";
  if (!week.end) return week.start;
  if (!week.start) return week.end;

  return `${week.start} — ${week.end}`;
}
