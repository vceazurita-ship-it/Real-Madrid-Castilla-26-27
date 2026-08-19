export interface WeekData {
  id: number;
  month: string;
  week: string;
  start: string;
  end: string;
  images: string[];
  pdfs?: string[];
  /** Campo antiguo de un único PDF por semana; se fusiona en `pdfs` al cargar. */
  pdf?: string;
}

export interface MonthData {
  id: number;
  name: string;
  weeks: WeekData[];
}

export type SeasonArea = "general" | "performance";

export type FileKind = "images" | "pdfs";

/** Un archivo de la temporada con el contexto de la semana a la que pertenece. */
export interface SeasonFile {
  url: string;
  kind: FileKind;
  week: string;
  month: string;
  start: string;
  end: string;
  weekId: number;
}
