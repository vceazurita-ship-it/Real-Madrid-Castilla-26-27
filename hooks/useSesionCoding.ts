"use client";

import { useCallback, useMemo, useRef } from "react";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  TIPO_CODING,
  borradorVideoCompleto,
  claveSesion,
  creaClip,
  mismaFuente,
  mueveClip,
  nombreDeFuente,
  normalizaSesion,
  normalizaVideos,
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

        /* De qué vídeo es. Con uno solo da igual, pero con dos partes
           abiertas es lo único que separa el minuto 3 de cada una. */
        const video = nombreDeFuente(actual.fuente);

        return {
          ...actual,
          clips: [...actual.clips, video ? { ...clip, video } : clip],
          abierta: true,
        };
      }, true);

      return null;
    },
    [muta, siguienteNumero],
  );

  /**
   * Le pone a un vídeo el corte de inicio a fin, si no lo tiene ya.
   *
   * Es lo que hace que abrir un vídeo baste: el corte que casi siempre se
   * quiere —el vídeo entero— ya está hecho, y quien necesite uno más corto lo
   * marca encima con el I y el O de siempre.
   *
   * Se hace una sola vez por vídeo (`videosConCorte`) y sólo si el vídeo no
   * trae cortes: al volver a un partido codificado no aparece nada nuevo, y
   * borrar el corte completo es definitivo.
   */
  const ponCorteCompleto = useCallback(
    (fuente: FuenteVideo, duracionMs: number) => {
      if (!(duracionMs > 0)) return;

      muta((actual) => {
        const nombre = nombreDeFuente(fuente);

        if (!nombre) return actual;

        if (actual.videosConCorte.includes(nombre)) return actual;

        const marcados = [...actual.videosConCorte, nombre];

        /* Los clips de antes de que existiera `video` son del primero. */
        const primero = nombreDeFuente(actual.videos[0]);

        const tieneClips = actual.clips.some(
          (clip) => (clip.video ?? primero) === nombre,
        );

        if (tieneClips) return { ...actual, videosConCorte: marcados };

        const clip = creaClip(
          borradorVideoCompleto(duracionMs),
          siguienteNumero(actual.clips),
          new Date().toISOString(),
        );

        /*
        | La sesión NO se da por abierta por esto.
        |
        | «Abierta» es lo que hace saltar el aviso de «quedó a medias» al
        | volver, y quien abre un vídeo para verlo no ha empezado a codificar
        | nada: el aviso lo enciende el primer corte marcado a mano.
        */
        return {
          ...actual,
          clips: [...actual.clips, { ...clip, video: nombre }],
          videosConCorte: marcados,
        };
      }, true);
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

        /* De qué vídeo es, igual que un clip: `tMs` es un instante dentro de
           uno concreto. Lo que ya tuviera vídeo no se toca. */
        const suya: EscenaTel = escena.video
          ? escena
          : { ...escena, video: nombreDeFuente(actual.fuente) || undefined };

        return {
          ...actual,
          escenas: existe
            ? actual.escenas.map((una) => (una.id === suya.id ? suya : una))
            : [...actual.escenas, suya].sort((a, b) => a.tMs - b.tMs),
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

  /**
   * Pone un vídeo delante. Si no estaba en la sesión, entra en la lista.
   *
   * Es el camino de siempre —elegir un vídeo— y ahora además no se pierde el
   * anterior: los dos quedan a un toque y cada uno con sus clips.
   */
  const ponFuente = useCallback(
    (fuente: FuenteVideo | null, fps?: number) => {
      muta((actual) => ({
        ...actual,
        fuente,
        videos: normalizaVideos(actual.videos, fuente),
        fps: fps && fps > 0 ? fps : actual.fps,
      }));
    },
    [muta],
  );

  /**
   * Añade varios vídeos de una vez y deja delante el primero de los nuevos.
   *
   * Abrir las dos partes de un partido es un solo gesto: se eligen los dos
   * ficheros y la sesión se queda con los dos. Los que ya estaban no se
   * duplican —se comparan por nombre— y si el mismo vídeo llega ahora por la
   * carpeta cuando antes era del disco, gana el de la carpeta, que es el que
   * el servidor puede cortar.
   */
  const añadeVideos = useCallback(
    (fuentes: FuenteVideo[]) => {
      if (fuentes.length === 0) return;

      muta((actual) => {
        const videos = normalizaVideos([...actual.videos, ...fuentes], actual.fuente);

        /* Se pone delante el primero de los que se acaban de abrir. */
        const nuevo =
          videos.find((video) => mismaFuente(video, fuentes[0])) ?? actual.fuente;

        return { ...actual, videos, fuente: nuevo };
      });
    },
    [muta],
  );

  /**
   * Saca un vídeo de la sesión.
   *
   * **No se lleva sus clips por delante**: si tiene alguno, no se quita y la
   * pantalla lo dice. Quitar un vídeo con veinte cortes dentro sería perder
   * media tarde de trabajo con un toque.
   */
  const quitaVideo = useCallback(
    (fuente: FuenteVideo) => {
      let quitado = false;

      muta((actual) => {
        const nombre = nombreDeFuente(fuente);

        const primero = nombreDeFuente(actual.videos[0]);

        const tieneClips = actual.clips.some(
          (clip) => (clip.video ?? primero) === nombre,
        );

        if (tieneClips) return actual;

        const videos = actual.videos.filter(
          (video) => nombreDeFuente(video) !== nombre,
        );

        quitado = true;

        return {
          ...actual,
          videos,
          fuente: mismaFuente(actual.fuente, fuente)
            ? (videos[0] ?? null)
            : actual.fuente,
        };
      });

      return quitado;
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
    ponCorteCompleto,
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
    añadeVideos,
    quitaVideo,
    ponAjustes,
    abre,
    cierra,
  };
}
