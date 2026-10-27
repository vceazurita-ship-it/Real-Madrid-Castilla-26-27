/**
 * LOS PDF DE ABP POR JUGADOR, EN SEGUNDO PLANO (27/10/2026).
 *
 * El encargo vive aquí, fuera de la pantalla de la pizarra: lo atiende
 * `components/abp/pizarra/TrabajoPdfs.tsx`, que está en el layout raíz y no se
 * desmonta al navegar. Así se puede pedir, cerrar la ventana, irse a otra
 * pantalla y recibir el aviso al terminar. La pizarra sólo lee el estado.
 *
 * Es un almacén mínimo para `useSyncExternalStore`: cada cambio crea un estado
 * nuevo (las suscripciones comparan por referencia).
 */

import type { PdfJugador } from "@/lib/abp/pizarra-jugador";
import type { TableroPizarra } from "@/lib/abp/pizarra";
import type { Player } from "@/types/player";

export type HechoPdf = PdfJugador & { url?: string };

/** El vídeo de un jugador: la jugada como en el laboratorio, con él resaltado. */
export type HechoVideo = { nombre: string; blob: Blob; url?: string; fallo?: boolean };

export type EncargoPdfs = {
  /** Versión de la pizarra: si cambia, lo hecho ya no vale. */
  huella: string;
  tablero: TableroPizarra;
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  jornada?: string;
  escudoRival?: string;
  ids: string[];
  /** La pantalla a la que vuelve el aviso. */
  vuelta: string;
};

export type EstadoPdfs = {
  huella: string;
  hechos: Record<string, HechoPdf>;
  encargo: EncargoPdfs | null;
  /** Quién se está montando ahora. */
  enCurso: string | null;
  hecho: number;
  total: number;
  /** Sube cada vez que el aviso pide abrir la ventana. */
  abrir: number;
  /** Los vídeos van en su propia cola (son más lentos), con la misma huella. */
  videos: Record<string, HechoVideo>;
  encargoVideos: EncargoPdfs | null;
  enCursoVideo: string | null;
  /** Lo hecho del vídeo en curso (0 → 1). */
  avanceVideo: number;
  hechoVideos: number;
  totalVideos: number;
};

let estado: EstadoPdfs = {
  huella: "",
  hechos: {},
  encargo: null,
  enCurso: null,
  hecho: 0,
  total: 0,
  abrir: 0,
  videos: {},
  encargoVideos: null,
  enCursoVideo: null,
  avanceVideo: 0,
  hechoVideos: 0,
  totalVideos: 0,
};

/** Otra pizarra (o la misma cambiada): lo hecho ya no vale. */
const deEsta = (huella: string) => (estado.huella === huella ? {} : { huella, hechos: {}, videos: {} });

const oyentes = new Set<() => void>();

const cambia = (parche: Partial<EstadoPdfs>) => {
  estado = { ...estado, ...parche };
  oyentes.forEach((oyente) => oyente());
};

export const trabajoPdfs = {
  suscribe(oyente: () => void) {
    oyentes.add(oyente);

    return () => oyentes.delete(oyente);
  },

  foto: () => estado,

  /** Pide los PDF que falten. Con uno en marcha no se pide otro: `false`. */
  encarga(encargo: EncargoPdfs) {
    if (estado.encargo) return false;

    /* Con vídeos de otra pizarra en marcha no se cambia de huella. */
    if (estado.encargoVideos && estado.huella !== encargo.huella) return false;

    const hechos = estado.huella === encargo.huella ? estado.hechos : {};
    const ids = encargo.ids.filter((id) => !hechos[id]);

    if (ids.length === 0) return false;

    cambia({ ...deEsta(encargo.huella), encargo: { ...encargo, ids }, enCurso: null, hecho: 0, total: ids.length });

    return true;
  },

  empieza: (playerId: string | null) => cambia({ enCurso: playerId }),

  apunta(huella: string, playerId: string, hecho: HechoPdf) {
    if (estado.huella !== huella) return;

    cambia({ hechos: { ...estado.hechos, [playerId]: hecho }, hecho: estado.hecho + 1 });
  },

  /** La URL de la subida, sólo si sigue siendo ESE PDF. */
  enlaza(playerId: string, blob: Blob, url: string) {
    const actual = estado.hechos[playerId];

    if (actual?.blob === blob) cambia({ hechos: { ...estado.hechos, [playerId]: { ...actual, url } } });
  },

  /** Un jugador que no ha salido también cuenta para el progreso. */
  salta: () => cambia({ hecho: estado.hecho + 1 }),

  termina: () => cambia({ encargo: null, enCurso: null }),

  pideAbrir: () => cambia({ abrir: estado.abrir + 1 }),

  /** Pide los vídeos que falten. Con otra cola en marcha (u otra pizarra a medias), `false`. */
  encargaVideos(encargo: EncargoPdfs) {
    if (estado.encargoVideos) return false;
    if (estado.encargo && estado.huella !== encargo.huella) return false;

    const videos = estado.huella === encargo.huella ? estado.videos : {};
    const ids = encargo.ids.filter((id) => !videos[id]);

    if (ids.length === 0) return false;

    cambia({ ...deEsta(encargo.huella), encargoVideos: { ...encargo, ids }, enCursoVideo: null, avanceVideo: 0, hechoVideos: 0, totalVideos: ids.length });

    return true;
  },

  empiezaVideo: (playerId: string | null) => cambia({ enCursoVideo: playerId, avanceVideo: 0 }),

  /* Sólo cuando se nota (cada 2 %): cada cambio repinta a quien escucha. */
  avanzaVideo(fraccion: number) {
    if (Math.abs(fraccion - estado.avanceVideo) >= 0.02 || fraccion >= 1) cambia({ avanceVideo: fraccion });
  },

  apuntaVideo(huella: string, playerId: string, hecho: HechoVideo) {
    if (estado.huella !== huella) return;

    cambia({ videos: { ...estado.videos, [playerId]: hecho }, hechoVideos: estado.hechoVideos + 1 });
  },

  /** El resultado de la subida, sólo si sigue siendo ESE vídeo. */
  subidaVideo(playerId: string, blob: Blob, resultado: { url: string } | { fallo: true }) {
    const actual = estado.videos[playerId];

    if (actual?.blob !== blob) return;

    cambia({ videos: { ...estado.videos, [playerId]: "url" in resultado ? { ...actual, url: resultado.url, fallo: false } : { ...actual, fallo: true } } });
  },

  saltaVideo: () => cambia({ hechoVideos: estado.hechoVideos + 1 }),

  terminaVideos: () => cambia({ encargoVideos: null, enCursoVideo: null, avanceVideo: 0 }),
};
