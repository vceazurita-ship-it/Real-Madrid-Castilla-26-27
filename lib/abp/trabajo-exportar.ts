/**
 * LAS EXPORTACIONES DE LA PIZARRA DE ABP, EN SEGUNDO PLANO (31/10/2026).
 *
 * Lo pidió el analista: «cuando lanzo cualquiera de las exportaciones de la
 * pizarra de ABP, que siga haciéndolo aunque cambie de página». Los botones de
 * la pizarra sólo dejan aquí el encargo, con una foto de lo que había al
 * pulsar; lo atiende `components/abp/pizarra/TrabajoExportar.tsx`, que está en
 * el layout raíz y no se desmonta al navegar. Mismo patrón que
 * `trabajo-pdfs.ts` (los PDF por jugador).
 *
 * Almacén mínimo para `useSyncExternalStore`: cada cambio crea un estado nuevo.
 */

import type { Destino } from "@/components/abp/pizarra/VideoJugada";
import type { SlidePizarra, TableroPizarra } from "@/lib/abp/pizarra";
import type { Player } from "@/types/player";

type Comun = { players: Map<string, Player>; temporada: string; rival: string; jornada?: string };

export type EncargoExportar =
  | { id: string; tipo: "todo"; conVideos: boolean; soloVideos?: boolean; datos: Comun & { tablero: TableroPizarra; escudoRival?: string } }
  | { id: string; tipo: "pizarra"; formato: "pptx" | "pdf"; porFases: boolean; datos: Comun & { slides: SlidePizarra[] } }
  | { id: string; tipo: "video"; destino: Destino; datos: Comun & { slide: SlidePizarra; titulo: string } };

/** Lo que se encarga: el id lo pone el almacén. */
export type PideExportar = EncargoExportar extends infer E ? (E extends EncargoExportar ? Omit<E, "id"> : never) : never;

export type EstadoExportar = {
  encargos: EncargoExportar[];
  /** Por dónde va cada uno («3/9», «42 %»…), para el botón que lo pidió. */
  rotulos: Record<string, string>;
};

let estado: EstadoExportar = { encargos: [], rotulos: {} };
let siguiente = 0;

const oyentes = new Set<() => void>();

const cambia = (parche: Partial<EstadoExportar>) => {
  estado = { ...estado, ...parche };
  oyentes.forEach((oyente) => oyente());
};

export const trabajoExportar = {
  suscribe(oyente: () => void) {
    oyentes.add(oyente);

    return () => oyentes.delete(oyente);
  },

  foto: () => estado,

  encarga(pide: PideExportar) {
    const id = `exp-${Date.now()}-${(siguiente += 1)}`;

    cambia({ encargos: [...estado.encargos, { ...pide, id } as EncargoExportar] });

    return id;
  },

  rotula: (id: string, texto: string) => {
    if (estado.rotulos[id] !== texto) cambia({ rotulos: { ...estado.rotulos, [id]: texto } });
  },

  termina(id: string) {
    const rotulos = { ...estado.rotulos };

    delete rotulos[id];
    cambia({ encargos: estado.encargos.filter((e) => e.id !== id), rotulos });
  },
};

/** El encargo en marcha de un tipo (y, si se dice, que cumpla algo más). */
export function enMarcha<T extends EncargoExportar["tipo"]>(
  e: EstadoExportar,
  tipo: T,
  cumple: (encargo: Extract<EncargoExportar, { tipo: T }>) => boolean = () => true,
) {
  return e.encargos.find((x): x is Extract<EncargoExportar, { tipo: T }> => x.tipo === tipo && cumple(x as Extract<EncargoExportar, { tipo: T }>));
}

/** Los que ya han arrancado: el doble montaje de React en desarrollo no los repite. */
export const arrancados = new Set<string>();
