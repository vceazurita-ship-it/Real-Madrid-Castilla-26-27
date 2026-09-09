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
|
| ---
|
| RED DE SEGURIDAD (09/09/2026)
|
| Un plan de partido escrito entero desapareció sin dejar rastro: no llegó a la
| hoja y aquí no quedaba copia de nada. Dos agujeros, los dos tapados:
|
|   · **No había respaldo.** El texto vivía sólo en el estado de React entre
|     que se escribía y que el Apps Script contestaba —treinta a setenta
|     segundos en frío—, así que cerrar la pestaña en ese rato se lo llevaba.
|     Ahora, en cuanto hay algo pendiente se copia en `localStorage` con la
|     clave `respaldo`, y al volver a entrar se ofrece recuperarlo. Es la
|     misma idea que la cola de `useRemoteDoc`.
|   · **Un fallo no se reintentaba.** El estado se quedaba en error y ahí
|     seguía hasta que el usuario volviera a escribir; un corte de red de diez
|     segundos bastaba para que nada más se guardase en toda la sesión. Ahora
|     se reintenta solo, doblando la espera de cuatro segundos al minuto.
|
| Lo recuperado **no se escribe solo**: entre medias puede haber editado otro,
| y pisar la hoja sin preguntar cambiaría una pérdida silenciosa por otra. Se
| devuelve en `recuperado` para que la página lo ofrezca.
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
  /**
   * Clave del respaldo en `localStorage`, **una por registro** —el ID del
   * rival, el de la sesión—: lo pendiente de un partido no puede aparecer al
   * abrir otro. Sin ella no hay respaldo y el hook se comporta como antes.
   */
  respaldo?: string;
}

export interface AutoSaveResult<T = unknown> {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  /** Cambios sin escribir (pendientes, guardándose o fallidos). */
  pending: boolean;
  /**
   * Lo que quedó pendiente en una visita anterior y nunca llegó al servidor.
   * `null` cuando no hay nada que recuperar o no se pasó `respaldo`.
   */
  recuperado: Recuperado<T> | null;
  /** Tira el respaldo: se ha aplicado, o el usuario no lo quiere. */
  descartaRecuperado: () => void;
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

/**
 * Trabajo que se quedó sin llegar al servidor en una visita anterior.
 *
 * Lo devuelve el hook para que la página lo ofrezca; nunca se escribe solo.
 */
export interface Recuperado<T> {
  valor: T;
  /** Cuándo se escribió, en ISO. */
  fecha: string;
}

/* Reintento del guardado fallido: se dobla la espera hasta el minuto, igual
   que la cola de `useRemoteDoc`. */
const REINTENTO_MIN = 4000;
const REINTENTO_MAX = 60000;

const claveDe = (respaldo: string) => `rmcf-auto:${respaldo}`;

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
  respaldo,
}: Options<T>): AutoSaveResult<T> {
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

  /* ------------------------------------------------------------------ */
  /*  RESPALDO EN EL NAVEGADOR                                           */
  /* ------------------------------------------------------------------ */

  const clave = respaldo ? claveDe(respaldo) : null;

  const claveRef = useRef(clave);

  useEffect(() => {
    claveRef.current = clave;
  });

  /* Copia lo pendiente. Se llama en cuanto hay un cambio, **antes** del
     retardo: la pestaña se puede cerrar durante esa espera. */
  const copiaAparte = useCallback((valor: T) => {
    if (!claveRef.current || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        claveRef.current,
        JSON.stringify({ fecha: new Date().toISOString(), valor }),
      );
    } catch {
      /* Cuota llena o modo privado: se sigue sin respaldo. */
    }
  }, []);

  const tiraLaCopia = useCallback(() => {
    if (!claveRef.current || typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(claveRef.current);
    } catch {
      /* nada que hacer */
    }
  }, []);

  /*
  | Lo que quedó a medias se lee de `localStorage`, que es un sistema de fuera
  | de React: `useSyncExternalStore` y no un efecto con `setState`, que además
  | daría un desajuste al hidratar —el servidor no tiene navegador—.
  |
  | **A propósito no se avisa al copiar**, sólo al tirar la copia: si cada
  | tecla refrescase la lectura, «lo que quedó pendiente» sería lo que se está
  | escribiendo ahora mismo. Lo que interesa es la foto de al llegar.
  */
  const oyentes = useRef(new Set<() => void>());

  const avisaDelCambio = useCallback(() => {
    oyentes.current.forEach((oyente) => oyente());
  }, []);

  const suscribe = useCallback((oyente: () => void) => {
    oyentes.current.add(oyente);

    /* Otra pestaña del mismo navegador también puede tirar la copia. */
    if (typeof window !== "undefined") {
      window.addEventListener("storage", oyente);
    }

    return () => {
      oyentes.current.delete(oyente);

      if (typeof window !== "undefined") {
        window.removeEventListener("storage", oyente);
      }
    };
  }, []);

  const leeCrudo = useCallback(() => {
    if (!clave || typeof window === "undefined") return null;

    try {
      return window.localStorage.getItem(clave);
    } catch {
      return null;
    }
  }, [clave]);

  /* Devuelve la cadena tal cual: si devolviera un objeto nuevo en cada lectura
     React no pararía de renderizar. El objeto se arma después. */
  const crudo = useSyncExternalStore(suscribe, leeCrudo, () => null);

  const recuperado = useMemo<Recuperado<T> | null>(() => {
    if (!crudo) return null;

    try {
      const leido = JSON.parse(crudo) as { fecha?: string; valor?: T };

      if (!leido || !("valor" in leido)) return null;

      return { valor: leido.valor as T, fecha: leido.fecha ?? "" };
    } catch {
      return null;
    }
  }, [crudo]);

  const descartaRecuperado = useCallback(() => {
    tiraLaCopia();

    avisaDelCambio();
  }, [avisaDelCambio, tiraLaCopia]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enVuelo = useRef<Promise<void> | null>(null);

  /* Reintento del guardado fallido. */
  const reintento = useRef<ReturnType<typeof setTimeout> | null>(null);
  const espera = useRef(REINTENTO_MIN);

  /* El reintento tiene que llamar a `escribir`, que lo define a él: la
     referencia rompe el círculo. Se declara vacía —pasarle `escribir` a
     `useRef` es escribir después sobre algo que ya se dio a un hook— y el
     efecto de más abajo la mantiene al día. */
  const escribirRef = useRef<() => Promise<void>>(async () => {});
  /* Ha entrado un cambio mientras se guardaba: hay que repetir al terminar. */
  const repetir = useRef(false);

  const cancelarTemporizador = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const cancelarReintento = useCallback(() => {
    if (reintento.current) {
      clearTimeout(reintento.current);
      reintento.current = null;
    }

    espera.current = REINTENTO_MIN;
  }, []);

  /*
  | Vuelve a intentarlo solo, doblando la espera.
  |
  | Sin esto, un corte de red de diez segundos dejaba el hook en error hasta
  | que el usuario volviera a teclear: podía escribir el plan entero creyendo
  | que se guardaba. La copia en `localStorage` sigue puesta mientras tanto.
  */
  const programaReintento = useCallback((intenta: () => void) => {
    if (reintento.current) return;

    const cuanto = espera.current;

    espera.current = Math.min(REINTENTO_MAX, cuanto * 2);

    reintento.current = setTimeout(() => {
      reintento.current = null;

      intenta();
    }, cuanto);
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

            /* No se da por bueno: la copia se queda y se vuelve a intentar. */
            programaReintento(() => void escribirRef.current());

            break;
          }
        } catch (error) {
          console.error("[useAutoSave] guardado", error);

          setStatus("error");

          programaReintento(() => void escribirRef.current());

          break;
        }

        /* Se da por guardada la huella que se envió, no la de ahora: si el
           usuario ha seguido escribiendo, eso sigue contando como pendiente. */
        guardado.current = huella;

        cancelarReintento();

        setLastSavedAt(new Date());
        setStatus("saved");

        /*
        | La copia se tira sólo cuando lo que hay en pantalla es exactamente lo
        | que acaba de llegar al servidor. Si el usuario ha seguido escribiendo
        | mientras tanto, ese texto todavía no está guardado y su respaldo
        | tiene que seguir donde está.
        */
        if (huellaRef.current(valueRef.current) === guardado.current) {
          tiraLaCopia();
        }

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
  }, [cancelarReintento, programaReintento, tiraLaCopia]);

  useEffect(() => {
    escribirRef.current = escribir;
  });

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

    /* La copia va **antes** del retardo: el rato entre teclear y que conteste
       el Apps Script —hasta setenta segundos en frío— es justo donde se perdió
       un plan de partido entero. */
    copiaAparte(value);

    cancelarTemporizador();

    timer.current = setTimeout(() => {
      timer.current = null;

      void escribir();
    }, debounce);

    return cancelarTemporizador;
  }, [
    huella,
    value,
    enabled,
    debounce,
    escribir,
    cancelarTemporizador,
    copiaAparte,
  ]);

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

      if (reintento.current) {
        clearTimeout(reintento.current);
        reintento.current = null;
      }
    },
    [escribir]
  );

  return {
    status,
    lastSavedAt,
    pending: pendiente,
    recuperado,
    descartaRecuperado,
    flush,
    sync,
  };
}

export default useAutoSave;
