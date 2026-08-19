/**
 * Utilidades compartidas por los calendarios de la temporada
 * (/calendar, /micro_calendar, /calendar_performance).
 *
 * Todas las fechas se manejan en hora LOCAL. Nunca uses toISOString()
 * para obtener la clave de un día: en España (UTC+1/+2) devuelve el día
 * anterior. Usa dateKey() / parseDateKey().
 */

export const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const WEEK = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export const WEEK_SHORT = ["L", "M", "X", "J", "V", "S", "D"] as const;

/** Primer y último mes navegables. */
export const START_MONTH = new Date(2026, 6, 1); // Julio 2026
export const END_MONTH = new Date(2027, 5, 1); // Junio 2027

/** Primer y último día con actividad de la temporada. */
export const SEASON_FIRST_DAY = new Date(2026, 6, 13);
export const SEASON_LAST_DAY = new Date(2027, 5, 30);

export const SEASON_LABEL = "Temporada 2026 / 2027";

export type CalendarMonth = {
  month: number;
  year: number;
};

/** Lista de meses navegables de la temporada. */
export function buildSeasonMonths(): CalendarMonth[] {
  const result: CalendarMonth[] = [];
  let current = new Date(START_MONTH);

  while (current <= END_MONTH) {
    result.push({
      month: current.getMonth(),
      year: current.getFullYear(),
    });

    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return result;
}

/** Índice del mes actual dentro de la temporada, o 0 si estamos fuera de ella. */
export function currentMonthIndex(months: CalendarMonth[], today = new Date()) {
  const index = months.findIndex(
    (m) => m.month === today.getMonth() && m.year === today.getFullYear()
  );

  return index !== -1 ? index : 0;
}

/** Lunes de la semana a la que pertenece `date`. */
export function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Matriz de semanas (lunes → domingo) que cubre por completo el mes. */
export function buildCalendar(month: number, year: number): Date[][] {
  const current = getMonday(new Date(year, month, 1));
  const weeks: Date[][] = [];

  while (true) {
    const week: Date[] = [];

    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    weeks.push(week);

    if (current.getMonth() !== month || current.getFullYear() !== year) {
      break;
    }
  }

  return weeks;
}

/** Clave local de un día: "YYYY-MM-DD". */
export function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Convierte "YYYY-MM-DD" en un Date local a mediodía (inmune a husos horarios). */
export function parseDateKey(key: string) {
  const [year, month, day] = key.slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

/**
 * Clave de un valor de fecha que llega del Apps Script / Sheets.
 * Acepta "YYYY-MM-DD", ISO completo o cualquier cosa parseable por Date.
 * Los ISO con hora se leen en UTC, que es como los serializa Sheets.
 */
export function recordDateKey(value: string | Date | null | undefined) {
  if (!value) return "";

  if (value instanceof Date) return dateKey(value);

  const raw = String(value).trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);

  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, "0"),
    String(parsed.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date) {
  return isSameDay(date, new Date());
}

/** Días anteriores al arranque o posteriores al cierre de la temporada. */
export function isOutOfSeason(date: Date) {
  return date < SEASON_FIRST_DAY || date > SEASON_LAST_DAY;
}

export function formatLongDate(date: Date) {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "45'" → "45 min" legible, y "1h 15'" cuando pasa de la hora. */
export function formatMinutes(minutes: number) {
  const total = Math.round(minutes);
  if (total < 60) return `${total}'`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}'`;
}

/**
 * Normaliza texto para comparar: sin acentos, sin espacios extra, en mayúsculas.
 * Los valores llegan de Sheets y no siempre vienen igual escritos
 * ("VÍDEO", "Video", "vídeo "...).
 */
export function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}
