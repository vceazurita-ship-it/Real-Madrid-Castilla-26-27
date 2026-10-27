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
};

let estado: EstadoPdfs = { huella: "", hechos: {}, encargo: null, enCurso: null, hecho: 0, total: 0, abrir: 0 };

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

    const hechos = estado.huella === encargo.huella ? estado.hechos : {};
    const ids = encargo.ids.filter((id) => !hechos[id]);

    if (ids.length === 0) return false;

    cambia({ huella: encargo.huella, hechos, encargo: { ...encargo, ids }, enCurso: null, hecho: 0, total: ids.length });

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
};
