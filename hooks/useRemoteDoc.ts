"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { descargarJson } from "@/lib/save-guard/exportar";

export type DocStatus = "loading" | "saved" | "saving" | "offline" | "error";

interface Options<T> {
  /** Clave del documento en `app_documents`. */
  key: string;
  /** Etiqueta para agrupar documentos del mismo tipo. */
  kind: string;
  /** Estado inicial si no existe nada guardado. */
  fallback: T;
  /** Milisegundos de espera antes de guardar tras el último cambio. */
  debounce?: number;
}

interface Result<T> {
  value: T;
  setValue: (updater: T | ((current: T) => T)) => void;
  status: DocStatus;
  /** El almacén remoto no está disponible: se trabaja solo en local. */
  localOnly: boolean;
  lastSavedAt: string | null;
  /** Hay trabajo en pantalla que todavía no está en el servidor. */
  sinGuardar: boolean;
  /** Manda ya lo pendiente, sin esperar al retardo. Dice si quedó guardado. */
  guardaYa: () => Promise<boolean>;
  reload: () => void;
}

/* ------------------------------------------------------------------ */
/*  LA COLA DE LO QUE NO HA LLEGADO AL SERVIDOR                        */
/* ------------------------------------------------------------------ */

const PREFIJO_CACHE = "rmcf-doc:";
const PREFIJO_COLA = "rmcf-doc-pend:";

/** Reintentos del guardado fallido: se dobla la espera hasta el minuto. */
const REINTENTO_MIN = 4000;
const REINTENTO_MAX = 60000;

/**
 * Tope de `sendBeacon` y de `fetch` con `keepalive`: 64 KB en todos los
 * navegadores. Un partido con muchas pizarras lo pasa, y entonces el envío al
 * cerrar la pestaña **no** sale. Por eso la red de seguridad de verdad es la
 * cola de `localStorage`, que se recupera al volver a entrar.
 */
const TOPE_ENVIO_AL_VUELO = 60_000;

interface Trabajo<T> {
  key: string;
  kind: string;
  data: T;
  /** Cuándo se escribió, para poder compararlo con la fecha del servidor. */
  at: string;
}

const claveCache = (key: string) => `${PREFIJO_CACHE}${key}`;
const claveCola = (key: string) => `${PREFIJO_COLA}${key}`;

function leeLocal<T>(clave: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const crudo = window.localStorage.getItem(clave);

    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

function escribeLocal(clave: string, valor: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* cuota llena o modo privado: seguimos sin caché */
  }
}

function borraLocal(clave: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(clave);
  } catch {
    /* nada que hacer */
  }
}

/** Manda un documento al servidor. Lanza si no ha quedado guardado. */
async function envia<T>(
  trabajo: Trabajo<T>,
  opciones: { keepalive?: boolean } = {},
): Promise<{ updatedAt: string | null; missingTable: boolean }> {
  const response = await fetch("/api/docs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: trabajo.key,
      kind: trabajo.kind,
      data: trabajo.data,
    }),
    keepalive: opciones.keepalive === true,
  });

  const body = await response.json();

  if (!response.ok || !body.success) throw new Error(body.error);

  return {
    updatedAt: (body.updatedAt as string | null) ?? null,
    missingTable: body.missingTable === true,
  };
}

/**
 * Envío de despedida: al cerrar la pestaña o al esconderla.
 *
 * `sendBeacon` es lo único que el navegador garantiza que sale con la página
 * muriéndose —un `fetch` normal se cancela—, pero no dice si el servidor lo
 * aceptó y no admite cuerpos grandes. Devuelve si lo ha aceptado la cola del
 * navegador; el documento se queda igualmente en la cola local hasta que un
 * guardado de verdad lo confirme.
 */
function despide<T>(trabajo: Trabajo<T>): boolean {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) return false;

  const cuerpo = JSON.stringify({
    key: trabajo.key,
    kind: trabajo.kind,
    data: trabajo.data,
  });

  if (cuerpo.length > TOPE_ENVIO_AL_VUELO) return false;

  try {
    return navigator.sendBeacon(
      "/api/docs",
      new Blob([cuerpo], { type: "application/json" }),
    );
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  EL HOOK                                                            */
/* ------------------------------------------------------------------ */

/**
 * Estado persistido en Supabase con caché en `localStorage`.
 *
 * La caché local se pinta de inmediato (y sigue funcionando si Supabase falla
 * o la tabla `app_documents` todavía no existe), mientras el documento remoto
 * se carga en segundo plano y pasa a mandar en cuanto llega.
 *
 * **Nada de lo que escribe el usuario se da por perdido.** Cada cambio entra
 * en una cola en `localStorage` que sólo se vacía cuando el servidor confirma
 * el guardado. De ahí salen las cuatro garantías:
 *
 * - un guardado fallido **se reintenta** (y en cuanto vuelve la red);
 * - al cerrar o esconder la pestaña se manda lo pendiente;
 * - al cambiar de documento se manda lo del anterior antes de soltarlo;
 * - y si aun así no llegó, al volver a entrar **la cola gana al servidor** y
 *   se reenvía, en vez de que la carga remota la pise en silencio.
 */
export function useRemoteDoc<T>({
  key,
  kind,
  fallback,
  debounce = 900,
}: Options<T>): Result<T> {
  const [value, setInternal] = useState<T>(fallback);
  const [status, setStatus] = useState<DocStatus>("loading");
  const [localOnly, setLocalOnly] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Evita guardar durante la carga inicial y en el primer render.
   *
   * No es sólo por el primer render: mientras carga un documento nuevo, en
   * `value` todavía está el **anterior** —el estado no se ha actualizado— y el
   * efecto de guardado lo encolaría bajo la clave nueva. Es decir: cambiar de
   * partido escribiría los clips del partido de antes dentro del de ahora.
   * Se probó a quitarlo (02/09/2026) y es exactamente lo que pasa.
   *
   * A cambio queda una ventana mínima: lo que se escriba **mientras** carga
   * (unos ~200 ms desde que se abre la pantalla) no entra en la cola y lo pisa
   * la respuesta del servidor. Para llegar a eso hay que teclear antes de que
   * la página termine de cargar.
   */
  const ready = useRef(false);

  /** Clave a la que pertenece el valor que hay ahora mismo en pantalla. */
  const claveDelValor = useRef(key);

  /**
   * La última foto que puso el servidor (o el vacío inicial), por identidad.
   *
   * Es lo que distingue «esto lo ha escrito el usuario» de «esto lo acaba de
   * traer la carga»: un cambio del usuario siempre construye un objeto nuevo,
   * así que si el valor es exactamente este objeto, no hay nada que guardar.
   * Sin esta distinción el efecto de guardado reenviaría al servidor lo que
   * acaba de leer de él.
   */
  const delServidor = useRef<T | null>(null);

  /* El autoguardado se dispara cada pocos segundos: sin esto, un servidor
     caído llenaría la pantalla de avisos repetidos. Se avisa una vez por
     racha de fallos y se rearma al primer guardado bueno. */
  const yaAvisado = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reintento = useRef<ReturnType<typeof setTimeout> | null>(null);
  const espera = useRef(REINTENTO_MIN);

  /** Lo que hay que mandar al servidor y todavía no ha llegado. */
  const pendiente = useRef<Trabajo<T> | null>(null);

  /** Para poder llamar al guardado desde temporizadores y desde `window`. */
  const flushRef = useRef<(() => Promise<boolean>) | null>(null);

  /**
   * Avisa de que el trabajo solo está en este navegador y ofrece bajarlo.
   *
   * El estado sigue en la caché local, así que no se pierde al recargar, pero
   * esa copia vive solo en este equipo: si el servidor no responde hay que
   * poder sacar el documento antes de cambiar de sitio.
   */
  const avisarDeGuardadoLocal = useCallback(
    (motivo: string, documento: T) => {
      if (yaAvisado.current) return;

      yaAvisado.current = true;

      toast.warning("Guardado solo en este navegador", {
        id: `doc-local-${key}`,
        duration: 12000,
        description: `${motivo}. Tus cambios siguen aquí y se reintentan solos, pero todavía no están en el servidor.`,
        action: {
          label: "Descargar copia",
          onClick: () => descargarJson(key, documento),
        },
      });
    },
    [key],
  );

  /* ------------------------------------------------------- guardado */

  const flush = useCallback(async (): Promise<boolean> => {
    const trabajo = pendiente.current;

    if (!trabajo) return true;

    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    if (reintento.current) {
      clearTimeout(reintento.current);
      reintento.current = null;
    }

    setStatus("saving");

    try {
      const resultado = await envia(trabajo);

      /*
      | Ojo: mientras volaba la petición el usuario ha podido marcar otro clip.
      | En ese caso `pendiente` ya es otro trabajo y NO se vacía la cola: lo
      | que se acaba de confirmar es la versión de antes, no la de pantalla.
      */
      const alDia = pendiente.current === trabajo;

      if (alDia) {
        pendiente.current = null;
        borraLocal(claveCola(trabajo.key));
        setSinGuardar(false);
      }

      if (resultado.missingTable) {
        setLocalOnly(true);
        setStatus("offline");

        avisarDeGuardadoLocal(
          "La tabla de documentos no existe todavía en el servidor",
          trabajo.data,
        );

        return false;
      }

      setLocalOnly(false);
      setLastSavedAt(resultado.updatedAt);
      setStatus(alDia ? "saved" : "saving");
      yaAvisado.current = false;
      espera.current = REINTENTO_MIN;

      return true;
    } catch (error) {
      console.error("[useRemoteDoc] guardado", error);

      /*
      | El trabajo se queda en la cola: sin esto, un fallo de red borraba de la
      | memoria lo último escrito y sólo sobrevivía en la caché… que la
      | siguiente carga pisaba con la versión vieja del servidor.
      */
      setStatus("error");
      setSinGuardar(true);

      const cuanto = espera.current;

      espera.current = Math.min(cuanto * 2, REINTENTO_MAX);

      if (reintento.current) clearTimeout(reintento.current);

      reintento.current = setTimeout(() => {
        reintento.current = null;
        void flushRef.current?.();
      }, cuanto);

      avisarDeGuardadoLocal(
        "El servidor no ha aceptado el guardado automático",
        trabajo.data,
      );

      return false;
    }
  }, [avisarDeGuardadoLocal]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /* ---------------------------------------------------------- carga */

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      ready.current = false;
      setStatus("loading");

      /* Al cambiar de documento, lo pendiente del anterior ya se ha mandado
         (el efecto de más abajo): este empieza limpio. */
      setSinGuardar(pendiente.current !== null);

      const cached = leeLocal<T>(claveCache(key));

      if (cached !== null) {
        delServidor.current = cached;
        setInternal(cached);
      } else if (claveDelValor.current !== key) {
        /*
        | Se ha cambiado de documento (de equipo, de rival…) y de este no hay
        | copia local: hasta que conteste el servidor, en pantalla estaría el
        | documento ANTERIOR, que es de otro. Se parte de vacío.
        |
        | Sólo al cambiar de clave: en un `reload()` de la misma clave, borrar
        | lo que hay para volver a pintarlo un segundo después es un parpadeo
        | gratis.
        */
        delServidor.current = fallback;
        setInternal(fallback);
      }

      claveDelValor.current = key;

      try {
        const response = await fetch(
          `/api/docs?key=${encodeURIComponent(key)}`,
          { cache: "no-store" },
        );

        const body = await response.json();

        if (cancelled) return;

        if (!response.ok || !body.success) throw new Error(body.error);

        if (body.missingTable) {
          setLocalOnly(true);
          setStatus("offline");
        } else {
          setLocalOnly(false);

          if (body.data !== null && body.data !== undefined) {
            delServidor.current = body.data as T;
            setInternal(body.data as T);
            escribeLocal(claveCache(key), body.data);
          } else if (cached === null) {
            delServidor.current = fallback;
            setInternal(fallback);
          }

          setLastSavedAt(body.updatedAt ?? null);
          setStatus("saved");

          /*
          |------------------------------------------------------------------
          | LO QUE NO LLEGÓ A GUARDARSE MANDA SOBRE EL SERVIDOR
          |------------------------------------------------------------------
          |
          | Si en la cola de este navegador quedó una versión más nueva que la
          | del servidor —se cerró el portátil, se fue la red, la petición
          | murió con la pestaña—, ésa es la buena. Antes la carga la pisaba
          | sin decir nada y el trabajo desaparecía.
          */
          const cola = leeLocal<Trabajo<T>>(claveCola(key));

          if (cola && cola.key === key) {
            /*
            | Se comparan como fechas, no como texto: Supabase devuelve
            | `…+00:00` y aquí se escribe `…Z`, así que dos instantes iguales
            | no dan cadenas iguales.
            */
            const delServidorMs = Date.parse(String(body.updatedAt ?? ""));

            const masNueva =
              !Number.isFinite(delServidorMs) ||
              Date.parse(cola.at) > delServidorMs;

            if (masNueva) {
              pendiente.current = { ...cola, kind };

              /* Se apunta como «lo que hay puesto» para que el efecto del
                 valor no vuelva a encolarlo: de mandarlo se encarga la
                 llamada de aquí abajo, que no espera al retardo. */
              delServidor.current = cola.data;
              setInternal(cola.data);
              escribeLocal(claveCache(key), cola.data);
              setSinGuardar(true);
              setStatus("saving");

              toast.info("Recuperado trabajo sin guardar", {
                id: `doc-rescate-${key}`,
                description:
                  "La última vez algo no llegó al servidor. Se ha recuperado y se está guardando.",
              });

              void envia(pendiente.current)
                .then((resultado) => {
                  if (pendiente.current?.at !== cola.at) return;

                  pendiente.current = null;
                  borraLocal(claveCola(key));
                  setSinGuardar(false);
                  setLastSavedAt(resultado.updatedAt);
                  setStatus("saved");
                })
                .catch(() => {
                  /* Sigue en la cola; que lo coja el reintento de siempre. */
                  void flushRef.current?.();
                });
            } else {
              /*
              | La cola es más vieja que el servidor: alguien guardó después
              | desde otro sitio. No se pisa lo nuevo, pero tampoco se tira lo
              | del usuario sin que pueda quedárselo.
              */
              borraLocal(claveCola(key));

              toast.warning("Había cambios locales antiguos", {
                id: `doc-viejo-${key}`,
                duration: 12000,
                description:
                  "El servidor tenía una versión posterior, así que se ha quedado la del servidor.",
                action: {
                  label: "Descargar los locales",
                  onClick: () => descargarJson(`${key}-local`, cola.data),
                },
              });
            }
          }
        }
      } catch (error) {
        console.error("[useRemoteDoc] carga", error);

        if (cancelled) return;

        setLocalOnly(true);
        setStatus("offline");
      } finally {
        if (!cancelled) ready.current = true;
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // `fallback` se usa solo como valor inicial; no debe reiniciar la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind, reloadToken]);

  /* -------------------------------------------------------- cambios */

  const setValue = useCallback(
    (updater: T | ((current: T) => T)) => {
      setInternal((current) =>
        typeof updater === "function"
          ? (updater as (value: T) => T)(current)
          : updater,
      );
    },
    [],
  );

  /*
  | Todo lo que pasa al cambiar el valor —caché, cola y temporizador— vive
  | aquí y no dentro del `setInternal`. El actualizador de `useState` se
  | ejecuta en el render (y React puede llamarlo dos veces): escribir en
  | `localStorage` y programar peticiones desde ahí es lo que no debe hacerse.
  */
  useEffect(() => {
    if (!ready.current) return;
    if (value === delServidor.current) return;

    escribeLocal(claveCache(key), value);

    const trabajo: Trabajo<T> = {
      key,
      kind,
      data: value,
      at: new Date().toISOString(),
    };

    pendiente.current = trabajo;
    escribeLocal(claveCola(key), trabajo);
    setSinGuardar(true);

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      timer.current = null;
      void flushRef.current?.();
    }, debounce);
  }, [debounce, key, kind, value]);

  /* --------------------------------------------- salidas y regresos */

  /*
  | Al cambiar de documento —otro rival, otro partido— o al salir de la
  | pantalla, lo pendiente se manda YA. Antes se limpiaba el temporizador y el
  | último cambio se quedaba a medio camino: en el coding, marcar un clip y
  | cambiar de partido en menos de un segundo lo borraba.
  */
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      if (reintento.current) {
        clearTimeout(reintento.current);
        reintento.current = null;
      }

      const trabajo = pendiente.current;

      if (!trabajo) return;

      pendiente.current = null;

      void envia(trabajo, { keepalive: true })
        .then(() => borraLocal(claveCola(trabajo.key)))
        .catch(() => {
          /* se queda en la cola: la próxima carga de esta clave lo reenvía */
        });
    },
    [key],
  );

  /*
  | La pestaña que se cierra, se esconde o se queda sin red.
  |
  | `pagehide` y el `visibilitychange` a oculto son los dos únicos avisos
  | fiables en móvil (el cierre de la app no dispara `beforeunload`). El aviso
  | al salir sólo se pone cuando SABEMOS que el guardado está fallando: si va
  | bien, el envío de despedida y la cola ya lo resuelven sin molestar.
  */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const alEsconder = () => {
      if (!pendiente.current) return;

      if (document.visibilityState === "hidden") {
        despide(pendiente.current);
      }

      void flushRef.current?.();
    };

    const alCerrar = () => {
      if (pendiente.current) despide(pendiente.current);
    };

    const alSalir = (evento: BeforeUnloadEvent) => {
      if (!pendiente.current) return;
      if (!(status === "error" || localOnly)) return;

      evento.preventDefault();
      evento.returnValue = "";
    };

    const alVolverLaRed = () => {
      if (pendiente.current) void flushRef.current?.();
    };

    document.addEventListener("visibilitychange", alEsconder);
    window.addEventListener("pagehide", alCerrar);
    window.addEventListener("beforeunload", alSalir);
    window.addEventListener("online", alVolverLaRed);

    return () => {
      document.removeEventListener("visibilitychange", alEsconder);
      window.removeEventListener("pagehide", alCerrar);
      window.removeEventListener("beforeunload", alSalir);
      window.removeEventListener("online", alVolverLaRed);
    };
  }, [localOnly, status]);

  const guardaYa = useCallback(async () => {
    espera.current = REINTENTO_MIN;

    return (await flushRef.current?.()) ?? true;
  }, []);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return {
    value,
    setValue,
    status,
    localOnly,
    lastSavedAt,
    sinGuardar,
    guardaYa,
    reload,
  };
}
