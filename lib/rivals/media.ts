/*
|--------------------------------------------------------------------------
| RECURSOS DEL RIVAL · VÍDEOS Y DOCUMENTOS
|--------------------------------------------------------------------------
|
| El informe de scouting y el plan de partido comparten fila en la hoja de
| Google, y esa hoja tiene **una** columna por recurso (VIDEO, DOC,
| HUDL_PLAYLIST…). No se pueden añadir columnas desde aquí —el backend es un
| Apps Script que no vive en este repo—, así que una lista de vídeos con su
| nombre no cabe ahí de ninguna manera.
|
| Por eso los recursos añadidos desde la app viven en `app_documents`, un
| documento JSON por rival, junto a los archivos subidos al bucket de storage.
| Las columnas de la hoja siguen existiendo y editándose como siempre: en
| pantalla se pintan en la misma lista, marcadas como «hoja», para que el
| usuario vea todo el material del rival en un único sitio.
*/

export type MediaKind = "video" | "doc";

export type MediaOrigen =
  /** URL pegada a mano (YouTube, HUDL, Drive…). */
  | "enlace"
  /** Archivo subido desde el ordenador al bucket de Supabase. */
  | "archivo";

export interface MediaItem {
  id: string;
  /** Lo que el usuario lee en la lista. Nunca vacío al guardar. */
  nombre: string;
  url: string;
  origen: MediaOrigen;
  /** Ruta dentro del bucket. Solo en los subidos; hace falta para borrarlos. */
  path?: string;
  mime?: string;
  /** Bytes, para poder avisar del peso antes de abrirlo con datos móviles. */
  tamano?: number;
  /** ISO de cuándo se añadió. */
  creado: string;
}

export interface RivalMediaDoc {
  videos: MediaItem[];
  docs: MediaItem[];
}

export const MEDIA_VACIO: RivalMediaDoc = { videos: [], docs: [] };

export const RIVAL_MEDIA_KIND = "rival-media";

/**
 * Trozo de clave admitido por `/api/docs` (`^[a-z0-9][a-z0-9:_-]{2,120}$`).
 *
 * Los identificadores de rival vienen de la hoja ("RIV-01", a veces con
 * espacios o acentos), así que hay que limpiarlos antes de usarlos.
 */
export function slugClave(valor: unknown): string {
  const limpio = String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return limpio || "sin-id";
}

/** Clave del documento de recursos de un rival en `app_documents`. */
export function rivalMediaKey(idRival: unknown): string {
  return `rival-media:${slugClave(idRival)}`;
}

/** Carpeta del bucket donde caen los archivos de ese rival. */
export function rivalMediaFolder(idRival: unknown): string {
  return `2026/rivales/${slugClave(idRival)}`;
}

/**
 * Normaliza lo que venga de `app_documents`.
 *
 * El documento lo escribe esta misma app, pero puede llegar a medio hacer de
 * una versión anterior o directamente vacío la primera vez.
 */
export function normalizarMedia(data: unknown): RivalMediaDoc {
  const bruto = (data ?? {}) as Partial<RivalMediaDoc>;

  const lista = (valor: unknown): MediaItem[] =>
    Array.isArray(valor)
      ? (valor as MediaItem[]).filter(
          (item) => item && typeof item.url === "string" && item.url.trim()
        )
      : [];

  return { videos: lista(bruto.videos), docs: lista(bruto.docs) };
}

/** Identificador local; no viaja a ningún sitio donde deba ser único global. */
export function nuevoId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * URL que se puede abrir en una pestaña.
 *
 * Un enlace pegado desde la barra del navegador suele venir sin protocolo, y
 * sin él el navegador lo trata como ruta relativa de la propia app.
 */
export function enlaceAbrible(url: string): string {
  const limpio = url.trim();

  if (!limpio) return "";

  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

/** Nombre por defecto de un archivo subido: el suyo, sin extensión. */
export function nombreDesdeArchivo(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || nombre;
}

export function formatearTamano(bytes: number | undefined): string {
  if (!bytes) return "";

  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/*
| Extensiones que el bucket acepta para cada tipo. No es seguridad —el bucket
| es público y lo sube el propio equipo técnico— sino una red para no subir
| por error un vídeo de 2 GB donde se espera un PDF.
*/
export const EXTENSIONES: Record<MediaKind, string> = {
  video: "video/*,.mp4,.mov,.m4v,.webm",
  doc: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*",
};

/** Tope de subida. Por encima, el navegador tarda más que la paciencia. */
export const MAX_BYTES: Record<MediaKind, number> = {
  video: 300 * 1024 * 1024,
  doc: 40 * 1024 * 1024,
};
