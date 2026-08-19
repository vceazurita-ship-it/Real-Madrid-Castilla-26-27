import { SeasonArea } from "./types";

interface AreaConfig {
  /** Texto pequeño en mayúsculas sobre el título. */
  eyebrow: string;
  title: string;
  description: string;
  /** Carpeta raíz dentro del bucket de storage. */
  storagePrefix: string;
  api: {
    load: string;
    save: string;
    upload: string;
    delete: string;
  };
}

export const SEASON_LABEL = "2026 / 2027";

export const AREA_CONFIG: Record<SeasonArea, AreaConfig> = {
  general: {
    eyebrow: "RMCF CASTILLA · GENERAL",
    title: "Área General",
    description:
      "Planificación semanal de la temporada. Busca una semana, consulta sus imágenes y documentos, o sube nuevos archivos.",
    storagePrefix: "2026/general",
    api: {
      load: "/api/general/load",
      save: "/api/general/save",
      upload: "/api/general/upload",
      delete: "/api/general/delete",
    },
  },

  performance: {
    eyebrow: "RMCF CASTILLA · PERFORMANCE",
    title: "Área Condicional",
    description:
      "Seguimiento semanal del área de rendimiento. Busca una semana, consulta sus imágenes y documentos, o sube nuevos archivos.",
    storagePrefix: "2026/performance",
    api: {
      load: "/api/performance/load",
      save: "/api/performance/save",
      upload: "/api/performance/upload",
      delete: "/api/performance/delete",
    },
  },
};
