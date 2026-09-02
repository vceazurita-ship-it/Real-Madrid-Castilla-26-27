"use client";

import { useCallback, useMemo, useRef } from "react";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  TIPO_CODING,
  claveSesion,
  creaClip,
  mueveClip,
  normalizaSesion,
  ordenaPorTiempo,
  problemaDeClip,
  recalculaClip,
  sesionVacia,
  type AmbitoCoding,
  type BorradorClip,
  type ClipCoding,
  type ConfigCoding,
  type FuenteVideo,
  type SesionCoding,
} from "@/lib/coding/modelo";
import type { EscenaTel } from "@/lib/coding/telestracion";

/**
 * La sesión de coding: los clips de un partido, guardándose solos.
 *
 * Se apoya en `useRemoteDoc`, que ya escribe en `app_documents` con retardo,
 * cachea en el navegador y sigue funcionando sin conexión. Aquí encima van las
 * dos cosas que este módulo necesita y que un documento genérico no da:
 *
 * - **Deshacer.** Se guarda la lista de clips anterior a cada cambio, no el
 *   cambio: son unos cientos de objetos pequeños y así deshacer es volver a
 *   poner un array, sin tener que invertir la operación que se hizo.
 * - **Numeración estable.** El número de un clip es el nombre del fichero que
 *   se exporta, así que no puede reordenarse al borrar uno de en medio: se
 *   toma siempre el mayor usado más uno.
 */

const TOPE_DESHACER = 60;

export function useSesionCoding(opciones: {
  ambito: AmbitoCoding;
  refId: string;
  titulo: string;
  config: ConfigCoding;
}) {
  const { ambito, refId, titulo, config } = opciones;

  const doc = useRemoteDoc<SesionCoding>({
    key: claveSesion(ambito, refId),
    kind: TIPO_CODING,
    fallback: sesionVacia(ambito, refId, titulo, config),
    debounce: 700,
  });

  const sesion = useMemo(
    () => normalizaSesion(doc.value, ambito, refId, titulo, config),
    [ambito, config, doc.value, refId, titulo],
  );

  const historial = useRef<ClipCoding[][]>([]);

  const { setValue } = doc;

  const muta = useCallback(
    (cambio: (actual: SesionCoding) => SesionCoding, conDeshacer = false) => {
      if (conDeshacer) {
        historial.current = [
          ...historial.current.slice(-(TOPE_DESHACER - 1)),
          sesion.clips,
        ];
      }

      setValue((crudo) => {
        const actual = normalizaSesion(crudo, ambito, refId, titulo, config);

        return {
          ...cambio(actual),
          actualizadoEn: new Date().toISOString(),
        };
      });
    },
    [ambito, config, refId, sesion.clips, setValue, titulo],
  );

  /* ------------------------------------------------------------ clips */

  const siguienteNumero = useCallback(
    (clips: ClipCoding[]) =>
      clips.reduce((mayor, clip) => Math.max(mayor, clip.numero), 0) + 1,
    [],
  );

  /**
   * Crea un clip. Devuelve el motivo si no se ha podido, o `null` si sí.
   *
   * Devolver el problema en vez de lanzar es lo que permite a la pantalla
   * enseñarlo sin envolver cada llamada en un `try`: en mitad de un partido,
   * un error no puede costar más de un aviso.
   */
  const añadeClip = useCallback(
    (borrador: BorradorClip) => {
      const problema = problemaDeClip(borrador);

      if (problema) return problema;

      muta((actual) => {
        const clip = creaClip(
          borrador,
          siguienteNumero(actual.clips),
          new Date().toISOString(),
        );

        return { ...actual, clips: [...actual.clips, clip], abierta: true };
      }, true);

      return null;
    },
    [muta, siguienteNumero],
  );

  const actualizaClip = useCallback(
    (id: string, cambios: Partial<ClipCoding>, duracionVideoMs?: number) => {
      muta(
        (actual) => ({
          ...actual,
          clips: actual.clips.map((clip) =>
            clip.id === id
              ? recalculaClip({ ...clip, ...cambios }, {}, duracionVideoMs)
              : clip,
          ),
        }),
        true,
      );
    },
    [muta],
  );

  const borraClip = useCallback(
    (id: string) => {
      muta(
        (actual) => ({
          ...actual,
          clips: actual.clips.filter((clip) => clip.id !== id),
        }),
        true,
      );
    },
    [muta],
  );

  const duplicaClip = useCallback(
    (id: string) => {
      muta((actual) => {
        const original = actual.clips.find((clip) => clip.id === id);

        if (!original) return actual;

        const numero = siguienteNumero(actual.clips);

        return {
          ...actual,
          clips: [
            ...actual.clips,
            {
              ...original,
              id: `clip-${numero}-${Math.round(original.codingInicioMs)}`,
              numero,
              creadoEn: new Date().toISOString(),
            },
          ],
        };
      }, true);
    },
    [muta, siguienteNumero],
  );

  /* ------------------------------------------------------------ orden */

  /*
  | Reordenar entra en el deshacer de los clips, como borrar o duplicar.
  |
  | Un arrastre que cae donde no era es exactamente el fallo que el
  | `Backspace` tiene que poder retirar: mover una fila no es «ver» la lista de
  | otra forma, es cambiar el vídeo que va a salir.
  */
  const mueveClipA = useCallback(
    (id: string, destinoId: string, donde: "antes" | "despues") => {
      muta(
        (actual) => ({
          ...actual,
          clips: mueveClip(actual.clips, id, destinoId, donde),
        }),
        true,
      );
    },
    [muta],
  );

  const ordenaClipsPorTiempo = useCallback(() => {
    muta((actual) => ({ ...actual, clips: ordenaPorTiempo(actual.clips) }), true);
  }, [muta]);

  const deshacer = useCallback(() => {
    const anterior = historial.current[historial.current.length - 1];

    if (!anterior) return false;

    historial.current = historial.current.slice(0, -1);

    muta((actual) => ({ ...actual, clips: anterior }));

    return true;
  }, [muta]);

  /* --------------------------------------------------- las pizarras */

  /*
  | Las pizarras se guardan **fuera del deshacer de los clips**.
  |
  | El `Backspace` del coding tiene que borrar la última acción marcada, no la
  | última flecha pintada: son dos trabajos distintos y mezclarlos haría que
  | deshacer en mitad de un partido diera un resultado imprevisible. La pizarra
  | tiene su propio deshacer, dentro de la pizarra.
  */
  const guardaEscena = useCallback(
    (escena: EscenaTel) => {
      muta((actual) => {
        const existe = actual.escenas.some((una) => una.id === escena.id);

        return {
          ...actual,
          escenas: existe
            ? actual.escenas.map((una) => (una.id === escena.id ? escena : una))
            : [...actual.escenas, escena].sort((a, b) => a.tMs - b.tMs),
        };
      });
    },
    [muta],
  );

  /**
   * En qué cortes se reutiliza una pizarra, además de en el suyo.
   *
   * Se guarda en la escena y no en el clip porque la pizarra es lo que se
   * reparte: borrar un corte no puede llevarse por delante el dibujo, que es
   * la misma razón por la que las escenas viven en la sesión y no en el clip.
   */
  const ponClipsDeEscena = useCallback(
    (escenaId: string, clipIds: string[]) => {
      muta((actual) => ({
        ...actual,
        escenas: actual.escenas.map((una) =>
          una.id === escenaId
            ? { ...una, clipIds: clipIds.length > 0 ? clipIds : undefined }
            : una,
        ),
      }));
    },
    [muta],
  );

  const borraEscena = useCallback(
    (id: string) => {
      muta((actual) => ({
        ...actual,
        escenas: actual.escenas.filter((una) => una.id !== id),
      }));
    },
    [muta],
  );

  /* ------------------------------------------------------- la sesión */

  const ponFuente = useCallback(
    (fuente: FuenteVideo | null, fps?: number) => {
      muta((actual) => ({
        ...actual,
        fuente,
        fps: fps && fps > 0 ? fps : actual.fps,
      }));
    },
    [muta],
  );

  const ponAjustes = useCallback(
    (cambios: Partial<Pick<SesionCoding, "preRollMs" | "postRollMs" | "fps">>) => {
      muta((actual) => ({ ...actual, ...cambios }));
    },
    [muta],
  );

  /** Cierra la sesión: es lo que apaga el aviso de «quedó a medias». */
  const cierra = useCallback(() => {
    muta((actual) => ({ ...actual, abierta: false }));
  }, [muta]);

  const abre = useCallback(() => {
    muta((actual) => ({ ...actual, abierta: true }));
  }, [muta]);

  return {
    sesion,
    status: doc.status,
    localOnly: doc.localOnly,
    lastSavedAt: doc.lastSavedAt,
    /** Hay clips marcados que todavía no están en el servidor. */
    sinGuardar: doc.sinGuardar,
    /** Manda ya lo pendiente (el botón «Guardar ahora» de la cabecera). */
    guardaYa: doc.guardaYa,
    añadeClip,
    actualizaClip,
    borraClip,
    duplicaClip,
    mueveClipA,
    ordenaClipsPorTiempo,
    deshacer,
    guardaEscena,
    ponClipsDeEscena,
    borraEscena,
    ponFuente,
    ponAjustes,
    abre,
    cierra,
  };
}
