"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { descargarJson } from "@/lib/save-guard/exportar";
import { mismoDocumento } from "@/lib/igualdad";

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

/**
 * Lo último que este navegador ha mandado de cada documento, por clave
 * (06/10/2026).
 *
 * Al esconder la pestaña salen dos envíos: el de despedida (sin versión, que
 * el servidor escribe sin preguntar) y el normal (con versión). Si el de
 * despedida llega antes, el normal choca con él: el servidor ve otra versión y
 * contesta «alguien ha guardado esto»… y ese alguien era esta misma pantalla.
 * Con esto se reconoce el caso: si lo que hay en el servidor es lo último que
 * mandamos nosotros, no es un conflicto, es nuestra propia versión.
 */
const ultimoEnviado = new Map<string, unknown>();

interface Trabajo<T> {
  key: string;
  kind: string;
  data: T;
  /** Ya se adoptó una vez nuestra propia versión del servidor: si vuelve a chocar, es de verdad otro. */
  adoptado?: boolean;
  /** Cuándo se escribió, para poder ordenar los avisos. */
  at: string;
  /**
   * La versión del servidor sobre la que se editó.
   *
   * Es lo que permite saber si alguien ha guardado en medio. Comparando
   * relojes no se puede: el de este navegador y el del servidor no son el
   * mismo, y una tablet con la hora mal decidía tirar trabajo bueno o pisar
   * el de otro.
   */
  basadaEn?: string | null;
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

/** Alguien guardó el documento mientras se editaba. */
export class ConflictoDeVersion extends Error {
  readonly updatedAt: string | null;

  readonly actual: unknown;

  constructor(updatedAt: string | null, actual: unknown) {
    super("Alguien ha guardado este documento mientras lo editabas.");

    this.name = "ConflictoDeVersion";
    this.updatedAt = updatedAt;
    this.actual = actual;
  }
}

/** Manda un documento al servidor. Lanza si no ha quedado guardado. */
async function envia<T>(
  trabajo: Trabajo<T>,
  opciones: { keepalive?: boolean; forzar?: boolean } = {},
): Promise<{ updatedAt: string | null; missingTable: boolean }> {
  ultimoEnviado.set(trabajo.key, trabajo.data);

  const response = await fetch("/api/docs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: trabajo.key,
      kind: trabajo.kind,
      data: trabajo.data,
      /* Sin la versión, el servidor escribe sin preguntar: es lo que se
         quiere al forzar a propósito, y lo único posible en el envío de
         despedida, que no puede esperar respuesta. */
      ...(opciones.forzar || trabajo.basadaEn === undefined
        ? {}
        : { basadaEn: trabajo.basadaEn }),
    }),
    keepalive: opciones.keepalive === true,
  });

  const body = await response.json();

  if (response.status === 409 && body?.conflicto) {
    throw new ConflictoDeVersion(
      (body.updatedAt as string | null) ?? null,
      body.data,
    );
  }

  if (!response.ok || !body.success) throw new Error(body.error);

  return {
    updatedAt: (body.updatedAt as string | null) ?? null,
    missingTable: body.missingTable === true,
  };
}

/**
 * Tras un guardado bueno, lo que siga pendiente pasa a basarse en la versión
 * que acaba de quedar en el servidor.
 *
 * Cada cambio se encola con la versión del servidor de ese momento. Si se
 * tecleaba con un guardado en vuelo, lo pendiente se quedaba apuntando a la
 * versión de ANTES de ese guardado —que es nuestro— y el siguiente envío
 * chocaba consigo mismo: un 409 y el aviso falso de «Alguien ha guardado esto».
 * También se reescribe la cola persistida, que es la que se compara al volver.
 */
function rebasaPendiente<T>(
  pendiente: { current: Trabajo<T> | null },
  key: string,
  version: string | null,
) {
  const sigue = pendiente.current;

  if (!sigue || sigue.key !== key) return;

  /* Se toca en el sitio, sin cambiar el objeto: las comprobaciones de
     `pendiente.current === trabajo` de los envíos en vuelo siguen valiendo. */
  sigue.basadaEn = version;
  escribeLocal(claveCola(sigue.key), sigue);
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
    /*
    | Con su versión también (06/10/2026): si el guardado normal llega antes con
    | lo mismo, el servidor ve los mismos datos y no crea otra versión; sin ella,
    | el de despedida escribía una versión nueva que la pantalla no conocía y el
    | siguiente cambio chocaba con «alguien ha guardado esto».
    */
    ...(trabajo.basadaEn === undefined ? {} : { basadaEn: trabajo.basadaEn }),
  });

  if (cuerpo.length > TOPE_ENVIO_AL_VUELO) return false;

  ultimoEnviado.set(trabajo.key, trabajo.data);

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

  /**
   * La versión del servidor sobre la que se está editando.
   *
   * Viaja con cada guardado: si en el servidor hay otra, es que alguien ha
   * escrito en medio —otra pestaña, otro portátil— y no se pisa.
   */
  const versionServidor = useRef<string | null | undefined>(undefined);

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
      versionServidor.current = resultado.updatedAt;
      if (!alDia) rebasaPendiente(pendiente, trabajo.key, resultado.updatedAt);
      setStatus(alDia ? "saved" : "saving");
      yaAvisado.current = false;
      espera.current = REINTENTO_MIN;

      return true;
    } catch (error) {
      /*
      |------------------------------------------------------------------
      | ALGUIEN HA GUARDADO ESTO MIENTRAS LO EDITABAS
      |------------------------------------------------------------------
      |
      | Dos pestañas abiertas, dos portátiles, el ordenador del club. Antes
      | ganaba el último en escribir **y el otro no se enteraba**: el trabajo
      | de media hora desaparecía sin un aviso. Ahora no se escribe encima:
      | lo pendiente se queda en la cola —no se pierde— y se pregunta.
      |
      | Reintentar solo tampoco vale: el reintento volvería a chocar. Decide
      | quien está delante, que es el único que sabe cuál de las dos versiones
      | vale.
      */
      /*
      | ¿«Alguien» somos nosotros? Si lo que hay en el servidor es exactamente
      | lo último que mandó esta pantalla (el envío de despedida ganó la
      | carrera), se adopta esa versión y se reintenta sin molestar a nadie.
      | Una sola vez por trabajo: si vuelve a chocar, sí es otro.
      */
      if (
        error instanceof ConflictoDeVersion &&
        !trabajo.adoptado &&
        mismoDocumento(error.actual, ultimoEnviado.get(trabajo.key))
      ) {
        /* Sólo si la pantalla sigue en este documento: si ya cambió, la versión sería de otro. */
        if (claveDelValor.current === trabajo.key) {
          versionServidor.current = error.updatedAt;
          setLastSavedAt(error.updatedAt);
        }

        const sigue = pendiente.current;

        if (sigue && sigue.key === trabajo.key) {
          sigue.basadaEn = error.updatedAt;
          sigue.adoptado = true;
          escribeLocal(claveCola(sigue.key), sigue);
        }

        /* Si lo pendiente ya es justo eso, está guardado: se vacía la cola. */
        if (sigue === trabajo && mismoDocumento(error.actual, trabajo.data)) {
          pendiente.current = null;
          borraLocal(claveCola(trabajo.key));
          setSinGuardar(false);
          setStatus("saved");
          return true;
        }

        return (await flushRef.current?.()) ?? false;
      }

      if (error instanceof ConflictoDeVersion) {
        setStatus("error");
        setSinGuardar(true);

        toast.warning("Alguien ha guardado esto mientras lo editabas", {
          id: `doc-conflicto-${trabajo.key}`,
          duration: 30000,
          description:
            "No se ha escrito encima. Puedes quedarte con lo tuyo —se manda y pisa lo suyo— o traer lo del servidor y perder lo que tengas sin guardar.",
          action: {
            label: "Quedarme con lo mío",
            onClick: () => {
              void envia(trabajo, { forzar: true })
                .then((forzado) => {
                  if (pendiente.current === trabajo) {
                    pendiente.current = null;
                    borraLocal(claveCola(trabajo.key));
                    setSinGuardar(false);
                  } else {
                    rebasaPendiente(pendiente, trabajo.key, forzado.updatedAt);
                  }

                  versionServidor.current = forzado.updatedAt;
                  setLastSavedAt(forzado.updatedAt);
                  setStatus("saved");

                  toast.success("Guardado lo tuyo");
                })
                .catch(() => {
                  toast.error("No se ha podido guardar. Inténtalo otra vez.");
                });
            },
          },
          cancel: {
            label: "Traer lo suyo",
            onClick: () => {
              pendiente.current = null;
              borraLocal(claveCola(trabajo.key));
              setSinGuardar(false);
              setReloadToken((n) => n + 1);
            },
          },
        });

        return false;
      }

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

        /*
        | Si esto viene de la caché del service worker, NO es el servidor.
        |
        | Sin red, el propio service worker contesta con la última copia que
        | vio, y con un 200 limpio. Tratarla como buena era declararse
        | «guardado» con un documento viejo delante y machacar la copia local,
        | que es justo la que hay que conservar para cuando vuelva la
        | cobertura: lo que se editara encima se subiría sobre esa versión
        | vieja, borrando lo que hubiera guardado otro desde entonces.
        */
        if (response.headers.get("x-rmcf-de-la-cache")) {
          if (cached === null && body.data !== null && body.data !== undefined) {
            delServidor.current = body.data as T;
            setInternal(body.data as T);
          }

          setLocalOnly(true);
          setStatus("offline");
        } else if (body.missingTable) {
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

          /* La versión sobre la que se edita a partir de ahora. */
          versionServidor.current = (body.updatedAt as string | null) ?? null;
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
            | ¿Sigue el servidor donde lo dejamos?
            |
            | Antes esto se decidía comparando el reloj del navegador con el
            | del servidor. Son dos relojes distintos: una tablet con la hora
            | atrasada daba por vieja una cola buena —y la tiraba— y una
            | adelantada reenviaba una cola vieja encima de lo que otro había
            | guardado después. Ahora se compara **la versión sobre la que se
            | editó**: si el servidor sigue en ella, la cola es lo nuevo y se
            | manda; si no, es que alguien escribió en medio y se pregunta.
            |
            | Las colas viejas —guardadas antes de que existiera la versión—
            | se siguen tratando como antes: son de este mismo navegador y lo
            | que traen es trabajo de alguien.
            */
            const versionCola = cola.basadaEn;

            const mismas = (a: string | null, b: string | null) =>
              a === b ||
              (a != null && b != null && Date.parse(a) === Date.parse(b));

            const masNueva =
              versionCola === undefined ||
              mismas(versionCola, (body.updatedAt as string | null) ?? null);

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
                  /* La versión que queda en el servidor es la nuestra: sin
                     apuntarla, lo siguiente que se editara chocaba con ella. */
                  if (claveDelValor.current === key) {
                    versionServidor.current = resultado.updatedAt;
                  }

                  if (pendiente.current?.at !== cola.at) {
                    rebasaPendiente(pendiente, key, resultado.updatedAt);
                    return;
                  }

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
              | Alguien guardó desde otro sitio después de que esto se
              | quedara en la cola. No se pisa lo suyo, pero tampoco se tira lo
              | del usuario: se guarda aparte y se ofrecen las dos salidas.
              */
              borraLocal(claveCola(key));

              escribeLocal(`${claveCola(key)}:apartado`, cola);

              toast.warning("Tenías cambios sin guardar de otra vez", {
                id: `doc-viejo-${key}`,
                duration: 30000,
                description:
                  "Mientras tanto alguien guardó este documento desde otro sitio, así que en pantalla está lo suyo. Lo tuyo no se ha perdido: puedes descargarlo o mandarlo encima.",
                action: {
                  label: "Mandar lo mío",
                  onClick: () => {
                    void envia({ ...cola, kind }, { forzar: true })
                      .then((forzado) => {
                        delServidor.current = cola.data;
                        setInternal(cola.data);
                        escribeLocal(claveCache(key), cola.data);
                        versionServidor.current = forzado.updatedAt;
                        setLastSavedAt(forzado.updatedAt);
                        setStatus("saved");
                        borraLocal(`${claveCola(key)}:apartado`);

                        toast.success("Guardado lo tuyo");
                      })
                      .catch(() => {
                        toast.error("No se ha podido guardar. Inténtalo otra vez.");
                      });
                  },
                },
                cancel: {
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

    /*
    | A partir del primer cambio del usuario, «lo que puso la carga» deja de
    | servir para saltarse guardados (07/10/2026). Si no, deshacer hasta el
    | objeto cargado —Jugadores sesión— o «limpiar» con el mismo vacío de
    | partida —el once del rival— era el mismo objeto que puso la carga y no se
    | guardaba: la pantalla enseñaba una cosa y el servidor tenía otra.
    */
    delServidor.current = null;

    escribeLocal(claveCache(key), value);

    const trabajo: Trabajo<T> = {
      key,
      kind,
      data: value,
      at: new Date().toISOString(),
      basadaEn: versionServidor.current,
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
