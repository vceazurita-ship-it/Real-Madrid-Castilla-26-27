/**
 * LOS VÍDEOS DE LOS INFORMES, EN SEGUNDO PLANO (02/11/2026).
 *
 * El mismo avance que la pizarra de ABP (`lib/abp/trabajo-exportar.ts` y
 * `lib/abp/cache-exportar.ts`), llevado a los informes PRE y POST del
 * partido y de ABP:
 *
 * - **Sigue aunque se cierre el diálogo o se cambie de pantalla.** El montaje
 *   vive en este módulo, no en el componente: al volver a abrir el informe se
 *   engancha al que ya va por la mitad (o al terminado).
 * - **Sigue con la pestaña escondida.** `montaVideoInforme` cede el paso por
 *   un MessageChannel y no depende de `requestAnimationFrame`.
 * - **Lo ya montado no se rehace.** La huella sale del CONTENIDO del guion
 *   (y de las opciones que cambian el vídeo), no de la hora a la que se
 *   generó el informe: reabrir el mismo informe da el mismo vídeo al instante.
 * - **Panel con los pasos y «Cancelar»** (`components/informes/TrabajoInformes.tsx`,
 *   en el layout raíz).
 * - **Uno detrás de otro**: dos montajes a la vez se pisan el descodificador.
 *
 * Al recargar se pierde: no ocupa disco.
 */

import { resumen } from "@/lib/abp/cache-exportar";
import type { GuionVideo } from "@/lib/video-informe/guion";
import { montaVideoInforme, type OpcionesVideo, type VideoMontado } from "@/lib/video-informe/monta";

/** Sube cuando cambia cómo se monta el vídeo: lo guardado deja de valer. */
const VERSION = "2026-11-02-capitulos";

/** Cuántos vídeos terminados se guardan (cada uno pesa decenas de MB). */
const GUARDADOS = 4;

export type EstadoTrabajoVideo = "cola" | "montando" | "listo" | "fallo" | "cancelado";

export type TrabajoVideo = {
  huella: string;
  /** «Vídeo del informe · Post J10», para el panel. */
  rotulo: string;
  estado: EstadoTrabajoVideo;
  /** Por dónde va («escena 3/8…», «tu vídeo 42 %…»). */
  paso: string;
  /** Cuándo se pidió, para ordenar el panel. */
  pedido: number;
};

type Interno = TrabajoVideo & { promesa: Promise<VideoMontado>; control: AbortController; escuchas: Set<(texto: string) => void> };

const trabajos = new Map<string, Interno>();
let cola: Promise<unknown> = Promise.resolve();
let foto: TrabajoVideo[] = [];
const oyentes = new Set<() => void>();

const avisa = () => {
  foto = [...trabajos.values()]
    .filter((t) => t.estado === "cola" || t.estado === "montando")
    .map(({ huella, rotulo, estado, paso, pedido }) => ({ huella, rotulo, estado, paso, pedido }))
    .sort((a, b) => a.pedido - b.pedido);
  oyentes.forEach((o) => o());
};

/** Quita los terminados más viejos por encima del tope, y los fallados o cancelados. */
const poda = () => {
  const hechos = [...trabajos.values()].filter((t) => t.estado === "listo").sort((a, b) => a.pedido - b.pedido);

  for (const t of hechos.slice(0, Math.max(0, hechos.length - GUARDADOS))) trabajos.delete(t.huella);
};

/** La huella de un vídeo: el guion entero y las opciones que lo cambian (no el `alPaso`). */
export function huellaVideo(guion: GuionVideo, opciones: Omit<OpcionesVideo, "alPaso" | "senal"> = {}) {
  return resumen(`${VERSION}|${JSON.stringify(guion)}|${JSON.stringify(opciones)}`);
}

export const trabajoVideo = {
  suscribe(oyente: () => void) {
    oyentes.add(oyente);

    return () => {
      oyentes.delete(oyente);
    };
  },

  /** Los que están en cola o montándose, para el panel. */
  foto: () => foto,

  /** El estado de uno (para el diálogo que lo pidió). */
  de: (huella: string): TrabajoVideo | null => {
    const t = trabajos.get(huella);

    return t ? { huella: t.huella, rotulo: t.rotulo, estado: t.estado, paso: t.paso, pedido: t.pedido } : null;
  },

  /**
   * El vídeo de este guion: el guardado, el que ya se está montando o uno
   * nuevo a la cola. `alPaso` se engancha también a uno que ya va por la mitad.
   *
   * `prepara` (02/11/2026): lo que hay que hacer con el guion justo antes de
   * montarlo, ya en su turno de la cola —rodar las jugadas de la pizarra de
   * ABP y cambiar sus marcas «pizarra:…» por el vídeo—. La huella sale del
   * guion de ENTRADA, así que un guion con las mismas jugadas da el mismo
   * vídeo aunque se pida desde otra pantalla.
   */
  pide(rotulo: string, guion: GuionVideo, opciones: Omit<OpcionesVideo, "senal"> = {}, prepara?: (guion: GuionVideo, paso: (texto: string) => void, senal: AbortSignal) => Promise<GuionVideo>): Promise<VideoMontado> {
    const { alPaso, ...resto } = opciones;
    const huella = huellaVideo(guion, resto);
    const ya = trabajos.get(huella);

    if (ya && ya.estado !== "fallo" && ya.estado !== "cancelado") {
      if (alPaso) ya.escuchas.add(alPaso);

      return ya.promesa;
    }

    const control = new AbortController();
    const trabajo = { huella, rotulo, estado: "cola", paso: "en cola…", pedido: Date.now(), control, escuchas: new Set(alPaso ? [alPaso] : []) } as Interno;

    const paso = (texto: string) => {
      trabajo.paso = texto;
      trabajo.escuchas.forEach((e) => e(texto));
      avisa();
    };

    trabajo.promesa = cola
      .catch(() => undefined)
      .then(async () => {
        control.signal.throwIfAborted();
        trabajo.estado = "montando";
        paso("empezando…");

        const listo = prepara ? await prepara(guion, paso, control.signal) : guion;

        control.signal.throwIfAborted();

        return montaVideoInforme(listo, { ...resto, alPaso: paso, senal: control.signal });
      })
      .then(
        (v) => {
          trabajo.estado = "listo";
          trabajo.escuchas.clear();
          poda();
          avisa();

          return v;
        },
        (error: unknown) => {
          trabajo.estado = control.signal.aborted ? "cancelado" : "fallo";
          trabajo.escuchas.clear();
          trabajos.delete(huella);
          avisa();

          throw control.signal.aborted ? new Error("Vídeo cancelado.") : error;
        },
      );

    /* Si el diálogo ya se ha cerrado, nadie espera la promesa: que un fallo no salga como error suelto. */
    trabajo.promesa.catch(() => undefined);
    cola = trabajo.promesa;
    trabajos.set(huella, trabajo);
    avisa();

    return trabajo.promesa;
  },

  cancela(huella: string) {
    trabajos.get(huella)?.control.abort();
  },
};
