/**
 * TODAS LAS DESCARGAS EN SEGUNDO PLANO (08/11/2026).
 *
 * Lo pidió el analista: «que todas las opciones de descargar se hagan en
 * segundo plano como en ABP». Es el patrón de `lib/abp/trabajo-exportar.ts`
 * hecho genérico:
 *
 * - El botón deja aquí un ENCARGO con una foto de lo que hay que exportar en el
 *   momento de pulsar (los datos, no la pantalla) y sigue a lo suyo.
 * - `components/ui/DescargasEnSegundoPlano.tsx`, en el layout raíz (no se
 *   desmonta al navegar), lo atiende: pinta la `mesa` fuera de la pantalla si
 *   hace falta DOM que fotografiar, ejecuta la `tarea`, enseña el progreso en
 *   una píldora y avisa al terminar (toast y, con la pestaña escondida,
 *   notificación del sistema).
 * - En el ordenador el fichero se baja solo al terminar; en móvil y tableta
 *   (donde el navegador exige un toque para descargar) sale «Descargar» en el
 *   aviso y en la píldora.
 *
 * Cómo se usa:
 *
 *   encargaDescarga({
 *     titulo: "Informe del rival · Hércules",
 *     vuelta: "/rivals",
 *     mesa: <LaminasInforme datos={foto} />,     // opcional
 *     tarea: async ({ raiz, avanza }) => {
 *       const hojas = await capturaLienzos(raiz!, "[data-lamina]", …);
 *       return { blob: (await pdfDeLienzos(hojas, …)).output("blob"), nombre: "informe.pdf" };
 *     },
 *   });
 *
 * REGLA: la tarea y la mesa sólo pueden usar lo que llevan dentro (la foto de
 * datos y `raiz`), nunca nodos ni refs de la pantalla que lo pidió: esa
 * pantalla puede haberse ido.
 *
 * Excepción, `pantalla: true`: para lo que de verdad fotografía la pantalla
 * visible (el PNG/PDF de «esta pantalla»). Mientras dura, los enlaces de la
 * app esperan: si se pulsa uno, se navega en cuanto la tarea llama a
 * `sueltaPantalla()` (después de las fotos) o termina. El resto (montar el PDF,
 * comprimir) sigue ya en segundo plano.
 */

import type { ReactElement } from "react";

export type ResultadoDescarga = { blob: Blob; nombre: string };

export type ContextoDescarga = {
  /** El contenedor fuera de pantalla con la `mesa` ya pintada (null si no hay mesa). */
  raiz: HTMLElement | null;
  /** Por dónde va: «3/9 hojas», y la fracción (0-1) si se sabe. */
  avanza: (texto: string, fraccion?: number) => void;
  /** Con `pantalla: true`: la pantalla ya no hace falta, los enlaces pueden navegar. */
  sueltaPantalla: () => void;
  /** Se cancela si el analista pulsa la ✕ de la píldora. */
  senal: AbortSignal;
};

export type PideDescarga = {
  titulo: string;
  /** La pantalla de la que sale (para «Ver» en el aviso). */
  vuelta?: string;
  /** Lo que hay que pintar para fotografiarlo. Lleva dentro su foto de datos. */
  mesa?: ReactElement;
  /** Ancho CSS de la mesa (por defecto 1440: las láminas 16:9 y los A4 caben). */
  ancho?: number;
  /** Fotografía la pantalla visible: retiene los enlaces hasta `sueltaPantalla`. */
  pantalla?: boolean;
  /** No bajar el fichero al terminar (la tarea ya lo comparte o lo envía ella). */
  sinDescarga?: boolean;
  tarea: (ctx: ContextoDescarga) => Promise<ResultadoDescarga | ResultadoDescarga[] | void>;
};

export type EstadoTrabajo = "esperando" | "en-marcha" | "listo" | "error";

export type TrabajoDescarga = PideDescarga & {
  id: string;
  estado: EstadoTrabajo;
  texto: string;
  fraccion?: number;
  resultados: ResultadoDescarga[];
  error?: string;
  /** Si la pantalla sigue retenida. */
  reteniendo: boolean;
  control: AbortController;
};

type Estado = {
  trabajos: TrabajoDescarga[];
  /** Adónde se quería ir mientras la pantalla estaba retenida. */
  destino: string | null;
};

let estado: Estado = { trabajos: [], destino: null };
let siguiente = 0;
const oyentes = new Set<() => void>();
/** Lo pone el anfitrión (router.push): para ir al destino pendiente al soltar la pantalla. */
let navega: ((href: string) => void) | null = null;

const retiene = () => estado.trabajos.some((t) => t.reteniendo && (t.estado === "esperando" || t.estado === "en-marcha"));

function publica(nuevo: Estado) {
  estado = nuevo;

  if (estado.destino && !retiene()) {
    const destino = estado.destino;

    estado = { ...estado, destino: null };
    setTimeout(() => navega?.(destino), 0);
  }

  oyentes.forEach((o) => o());
}

function cambia(id: string, parche: Partial<TrabajoDescarga>) {
  publica({ ...estado, trabajos: estado.trabajos.map((t) => (t.id === id ? { ...t, ...parche } : t)) });
}

export const descargas = {
  suscribe(oyente: () => void) {
    oyentes.add(oyente);

    return () => {
      oyentes.delete(oyente);
    };
  },

  foto: () => estado,

  cambia,

  quita(id: string) {
    const t = estado.trabajos.find((x) => x.id === id);

    t?.control.abort();
    publica({ ...estado, trabajos: estado.trabajos.filter((x) => x.id !== id) });
  },

  /** ¿Hay alguno que retenga la pantalla? (los enlaces esperan) */
  retiene,

  /** Un enlace pulsado mientras se retiene: se irá en cuanto se suelte. */
  esperaParaIr(href: string) {
    publica({ ...estado, destino: href });
  },

  ponNavegador(fn: ((href: string) => void) | null) {
    navega = fn;
  },
};

/** Deja el encargo y vuelve enseguida. Devuelve su id. */
export function encargaDescarga(pide: PideDescarga): string {
  const id = `desc-${Date.now()}-${(siguiente += 1)}`;
  const trabajo: TrabajoDescarga = {
    ...pide,
    id,
    estado: "esperando",
    texto: "Preparando…",
    resultados: [],
    reteniendo: Boolean(pide.pantalla),
    control: new AbortController(),
  };

  publica({ ...estado, trabajos: [...estado.trabajos, trabajo] });

  return id;
}

/** ¿Hay en marcha un encargo con este título? (para no lanzar dos iguales) */
export function descargaEnMarcha(titulo: string) {
  return estado.trabajos.some((t) => t.titulo === titulo && (t.estado === "esperando" || t.estado === "en-marcha"));
}
