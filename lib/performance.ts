// lib/performance.ts

export const CURRENT_SEASON = "2026-2027";

export function getWeekFolder(weekId: number) {
  return `${CURRENT_SEASON}/semana-${String(weekId).padStart(2, "0")}`;
}