"use client";

/*
|--------------------------------------------------------------------------
| useAutoSave
|--------------------------------------------------------------------------
|
| Autoguardado común a toda la app: el usuario escribe y el trabajo sale solo
| hacia el servidor, sin botón de por medio.
|
| Lo que resuelve, además de ahorrar el clic: hasta ahora el texto vivía en el
| formulario hasta que alguien se acordaba de pulsar «Guardar». Un cambio de
| rival, una recarga o una pestaña cerrada se lo llevaban entero.
|
| Uso desde una página:
|
|     const auto = useAutoSave({
|       value: rivalActivo,
|       enabled: modoEdicion,
|       save: guardarEnLaHoja,          // devuelve true si se da por bueno
|     });
|
|     <AutoSaveStatus estado={auto.status} guardadoEn={auto.lastSavedAt} />
|
| Reglas de la casa:
|
|   · Mientras `enabled` es falso el valor se sigue de cerca pero no se
|     guarda. Así, cambiar de rival o de ficha en modo lectura no dispara
|     escrituras, y al entrar en edición se parte de limpio.
|   · Nunca hay dos guardados a la vez. Si llega un cambio con uno en vuelo,
|     se encola uno solo al terminar (el último valor manda).
|   · `save` devuelve `false` cuando el guardado NO se puede dar por bueno
|     (p. ej. el save-guard ha detectado columnas perdidas). El estado se
|     queda en error y el contenido sigue marcado como pendiente.
*/

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus =
  /** Sin cambios pendientes desde la última carga. */
  | "idle"
  /** Hay cambios esperando a que se cumpla el retardo. */
  | "dirty"
  | "saving"
  | "saved"
  | "error";

interface Options<T> {
  value: T;
  /**
   * Escribe el valor. Devolver `false` marca el guardado como no válido: el
   * contenido sigue contando como pendiente y el estado pasa a error.
   */
  save: (value: T) => Promise<boolean | void>;
  /** Mientras sea falso se observa el valor pero no se escribe nada. */
  enabled?: boolean;
  /** Milisegundos de calma antes de escribir. */
  debounce?: number;
  /**
   * Huella del valor. Por defecto `JSON.stringify`; se pasa a mano cuando hay
   * campos que cambian solos y no deben disparar un guardado.
   */
  fingerprint?: (value: T) => string;
}

export interface AutoSaveResult {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  /** Cambios sin escribir (pendientes, guardándose o fallidos). */
  pending: boolean;
  /** Escribe ya lo que haya pendiente. Espera a que termine. */
  flush: () => Promise<void>;
  /**
   * Da el valor actual por guardado sin escribirlo.
   *
   * Es lo que hay que llamar tras cargar del servidor o al cambiar de
   * registro: el valor cambia de golpe y eso no es una edición del usuario.
   */
  sync: () => void;
}

const huellaPorDefecto = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    /* Referencias circulares: mejor no guardar que guardar cualquier cosa. */
    return "";
  }
};

export function useAutoSave<T>({
  value,
  save,
  enabled = true,
  debounce = 1200,
  fingerprint = huellaPorDefecto,
}: Options<T>): AutoSaveResult {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  /* Última huella dada por buena: con ella se decide si hay algo que hacer. */
  const guardado = useRef<string>(fingerprint(value));

  /* Valor y función de guardado siempre frescos dentro de los temporizadores,
     sin que su identidad reprograme el efecto en cada render. */
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const huellaRef = useRef(fingerprint);

  /* Los temporizadores leen estas referencias, y para entonces el efecto ya se
     ha ejecutado: nunca guardan una versión vieja. */
  useEffect(() => {
    valueRef.current = value;
    saveRef.current = save;
    huellaRef.current = fingerprint;
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enVuelo = useRef<Promise<void> | null>(null);
  /* Ha entrado un cambio mientras se guardaba: hay que repetir al terminar. */
  const repetir = useRef(false);

  const cancelarTemporizador = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const escribir = useCallback(async (): Promise<void> => {
    /* Un solo guardado en vuelo; el que llega se encola. */
    if (enVuelo.current) {
      repetir.current = true;

      return enVuelo.current;
    }

    const tarea = (async () => {
      /* Bucle y no recursión: si entra un cambio mientras se guardaba, se
         repite aquí mismo en vez de encadenar promesas. */
      let pendiente = true;

      while (pendiente) {
        pendiente = false;

        const actual = valueRef.current;
        const huella = huellaRef.current(actual);

        if (huella === guardado.current) break;

        setStatus("saving");

        try {
          const resultado = await saveRef.current(actual);

          if (resultado === false) {
            setStatus("error");
            break;
          }
        } catch (error) {
          console.error("[useAutoSave] guardado", error);

          setStatus("error");
          break;
        }

        /* Se da por guardada la huella que se envió, no la de ahora: si el
           usuario ha seguido escribiendo, eso sigue contando como pendiente. */
        guardado.current = huella;

        setLastSavedAt(new Date());
        setStatus("saved");

        if (repetir.current) pendiente = true;

        repetir.current = false;
      }

      repetir.current = false;
    })();

    enVuelo.current = tarea;

    try {
      await tarea;
    } finally {
      enVuelo.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    cancelarTemporizador();

    await escribir();
  }, [cancelarTemporizador, escribir]);

  const sync = useCallback(() => {
    cancelarTemporizador();

    guardado.current = huellaRef.current(valueRef.current);
    repetir.current = false;

    setStatus("idle");
  }, [cancelarTemporizador]);

  /* Programa el guardado cuando el contenido cambia de verdad. */
  const huella = fingerprint(value);

  useEffect(() => {
    if (!enabled) {
      /* En lectura el valor puede cambiar (carga, cambio de registro) sin que
         sea una edición: se acepta como base y no se escribe nada. */
      cancelarTemporizador();

      guardado.current = huella;

      return;
    }

    if (huella === guardado.current) return;

    setStatus("dirty");

    cancelarTemporizador();

    timer.current = setTimeout(() => {
      timer.current = null;

      void escribir();
    }, debounce);

    return cancelarTemporizador;
  }, [huella, enabled, debounce, escribir, cancelarTemporizador]);

  /* Al salir del modo edición se escribe lo que quede sin esperar al retardo. */
  const estabaActivo = useRef(enabled);

  useEffect(() => {
    if (estabaActivo.current && !enabled) void flush();

    estabaActivo.current = enabled;
  }, [enabled, flush]);

  const pendiente = status === "dirty" || status === "saving" || status === "error";

  /*
  | Cerrar la pestaña con algo sin escribir es la única pérdida que el
  | autoguardado no puede evitar por su cuenta: se avisa, y de paso se intenta
  | un último envío por si el navegador da tiempo.
  */
  useEffect(() => {
    if (!pendiente) return;

    const avisar = (evento: BeforeUnloadEvent) => {
      void escribir();

      evento.preventDefault();
      evento.returnValue = "";
    };

    window.addEventListener("beforeunload", avisar);

    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendiente, escribir]);

  /* Cambiar de pestaña o bloquear el móvil: momento natural para consolidar. */
  useEffect(() => {
    if (!pendiente) return;

    const alOcultar = () => {
      if (document.visibilityState === "hidden") void escribir();
    };

    document.addEventListener("visibilitychange", alOcultar);

    return () => document.removeEventListener("visibilitychange", alOcultar);
  }, [pendiente, escribir]);

  /* Desmontaje (navegar a otra página): último intento con lo que haya. */
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;

        void escribir();
      }
    },
    [escribir]
  );

  return { status, lastSavedAt, pending: pendiente, flush, sync };
}

export default useAutoSave;
