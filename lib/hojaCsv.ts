/**
 * Una sola descarga de cada hoja publicada mientras dure la pestaña, y una
 * copia en el aparato para que la siguiente vez no haya que esperar.
 *
 * Las pantallas leen de hojas de Google publicadas en CSV, y cada una se la
 * bajaba entera **cada vez que se entraba**. Como se navega sin recargar,
 * dar una vuelta por el menú —principios, microciclos, ABP, valores— y volver
 * atrás repetía las mismas descargas una y otra vez; Google no es rápido con
 * ellas y son los segundos de reloj de arena que se ven al cambiar de
 * pantalla. Es el mismo remedio que ya llevaba la plantilla en `usePlayers`,
 * aquí para todas las demás hojas.
 *
 * Lo que se guarda es la promesa, no el texto: dos componentes que pidan la
 * misma hoja a la vez comparten una única petición en vuelo.
 *
 * **Desde el 11/10/2026 la copia sobrevive a la pestaña.** Cada texto bajado
 * se guarda también en `localStorage` con su hora. Al volver a pedirlo —en
 * otra pestaña, tras recargar, al día siguiente— se devuelve esa copia AL
 * MOMENTO y, si tiene más de unos minutos, se baja la nueva por detrás para
 * la próxima vez (y se avisa, ver `suscribeHojas`, para que la cabecera pueda
 * ofrecer «Recargar»). Lo que antes era medio minuto de «Cargando…» con el
 * Apps Script frío pasa a ser instantáneo con los datos de la última vez,
 * que en esta app es casi siempre lo que se quiere ver.
 *
 * Tres reglas:
 * - Quien escribe en la hoja y se relee pide `forzar`: salta la copia, baja y
 *   la renueva. Y `olvidaCsv()` tira también las copias guardadas.
 * - Una URL con `fresco=1` es una relectura que comprueba un guardado
 *   (`lib/save-guard`): nunca sale de la copia ni se guarda.
 * - Si la red falla y hay copia, se devuelve la copia: sin cobertura la app
 *   sigue leyéndose.
 */

const enMemoria = new Map<string, Promise<string>>();

/* ------------------------------------------------------------------ */
/*  La copia en el aparato                                             */
/* ------------------------------------------------------------------ */

const PREFIJO = "rmcf-hoja:";
/** Con una copia de menos de esto, ni se mira la red. */
const FRESCA_MS = 3 * 60_000;
/** Una hoja más grande que esto no se guarda: el almacén son unos 5 MB. */
const TOPE_BYTES = 900_000;

type Copia = { texto: string; en: number };

function almacen(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function leeCopia(url: string): Copia | null {
  const st = almacen();

  if (!st) return null;

  try {
    const bruto = st.getItem(PREFIJO + url);

    if (!bruto) return null;

    const copia = JSON.parse(bruto) as Partial<Copia>;

    return typeof copia.texto === "string" && typeof copia.en === "number" ? (copia as Copia) : null;
  } catch {
    return null;
  }
}

/** Quita las copias más viejas hasta que quepa la nueva. */
function hazSitio(st: Storage) {
  const claves: { clave: string; en: number }[] = [];

  for (let i = 0; i < st.length; i += 1) {
    const clave = st.key(i);

    if (!clave?.startsWith(PREFIJO)) continue;

    try {
      const copia = JSON.parse(st.getItem(clave) ?? "") as Partial<Copia>;

      claves.push({ clave, en: typeof copia.en === "number" ? copia.en : 0 });
    } catch {
      claves.push({ clave, en: 0 });
    }
  }

  claves.sort((a, b) => a.en - b.en);

  for (const { clave } of claves.slice(0, Math.max(1, Math.ceil(claves.length / 3)))) {
    st.removeItem(clave);
  }
}

function guardaCopia(url: string, texto: string) {
  const st = almacen();

  if (!st || texto.length > TOPE_BYTES) return;

  const valor = JSON.stringify({ texto, en: Date.now() } satisfies Copia);

  try {
    st.setItem(PREFIJO + url, valor);
  } catch {
    /* Lleno: se hace sitio una vez y se vuelve a intentar; si no cabe, no pasa nada. */
    try {
      hazSitio(st);
      st.setItem(PREFIJO + url, valor);
    } catch {
      /* Sin sitio: la próxima vez se baja, como siempre. */
    }
  }
}

function borraCopias(url?: string) {
  const st = almacen();

  if (!st) return;

  if (url) {
    st.removeItem(PREFIJO + url);

    return;
  }

  const claves: string[] = [];

  for (let i = 0; i < st.length; i += 1) {
    const clave = st.key(i);

    if (clave?.startsWith(PREFIJO)) claves.push(clave);
  }

  for (const clave of claves) st.removeItem(clave);
}

/* ------------------------------------------------------------------ */
/*  El estado, para la cabecera                                        */
/* ------------------------------------------------------------------ */

export type EstadoHojas = {
  /** Cuántas descargas van ahora mismo. */
  bajando: number;
  /** Hojas servidas desde la copia del aparato en esta pestaña. */
  deCopia: number;
  /** La más vieja de las copias que se han enseñado (ms desde la época), o `null`. */
  masVieja: number | null;
  /** Ha llegado una hoja distinta de la copia que se enseñó: toca recargar para verla. */
  hayNuevas: boolean;
};

let estado: EstadoHojas = { bajando: 0, deCopia: 0, masVieja: null, hayNuevas: false };
const oyentes = new Set<() => void>();

function cambia(parche: Partial<EstadoHojas>) {
  estado = { ...estado, ...parche };

  for (const oye of oyentes) oye();
}

/** El aviso de «hay datos nuevos» ya se ha atendido: se apaga hasta que llegue otra hoja distinta. */
export function descartaNuevas() {
  if (estado.hayNuevas) cambia({ hayNuevas: false });
}

/** Para `useSyncExternalStore`: el estado de las hojas de esta pestaña. */
export function estadoHojas(): EstadoHojas {
  return estado;
}

export function suscribeHojas(oye: () => void) {
  oyentes.add(oye);

  return () => {
    oyentes.delete(oye);
  };
}

/* ------------------------------------------------------------------ */
/*  Pedir                                                              */
/* ------------------------------------------------------------------ */

const esRelectura = (url: string) => /[?&]fresco=1(&|$)/.test(url);

function baja(url: string, copiaEnsenada: string | null): Promise<string> {
  cambia({ bajando: estado.bajando + 1 });

  return fetch(url)
    .then((respuesta) => {
      if (!respuesta.ok) {
        throw new Error(`La hoja respondió ${respuesta.status}`);
      }

      return respuesta.text();
    })
    .then((texto) => {
      if (!esRelectura(url)) guardaCopia(url, texto);

      cambia({
        bajando: Math.max(0, estado.bajando - 1),
        hayNuevas: estado.hayNuevas || (copiaEnsenada !== null && copiaEnsenada !== texto),
      });

      return texto;
    })
    .catch((error: unknown) => {
      cambia({ bajando: Math.max(0, estado.bajando - 1) });

      throw error;
    });
}

/**
 * Tira todas las copias de esta pestaña y del aparato.
 *
 * Lo llama `olvidaLoGuardado()` después de escribir en la hoja: escribir
 * invalida cualquier lectura, y afinar por URL no merece la pena —son
 * cuatro descargas y vuelven a bajarse en cuanto hagan falta—.
 */
export function olvidaTodoElCsv() {
  enMemoria.clear();
  borraCopias();
}

export function traeCsv(
  url: string,
  opciones: { forzar?: boolean } = {},
): Promise<string> {
  if (opciones.forzar) {
    enMemoria.delete(url);
    borraCopias(url);
  }

  const guardada = enMemoria.get(url);

  if (guardada) return guardada;

  /*
  | Sin `AbortSignal` a propósito: la descarga es de todos los que la esperan,
  | y desmontar una pantalla no puede cortársela a otra que siga pidiéndola.
  */
  const copia = opciones.forzar || esRelectura(url) ? null : leeCopia(url);

  if (copia) {
    /* La copia se enseña ya. Si es reciente no se toca la red; si no, se
       renueva por detrás y la próxima petición (o la recarga) la tendrá. */
    const servida = Promise.resolve(copia.texto);

    enMemoria.set(url, servida);
    cambia({
      deCopia: estado.deCopia + 1,
      masVieja: estado.masVieja === null ? copia.en : Math.min(estado.masVieja, copia.en),
    });

    if (Date.now() - copia.en > FRESCA_MS) {
      void baja(url, copia.texto)
        .then((texto) => {
          enMemoria.set(url, Promise.resolve(texto));
        })
        .catch(() => {
          /* Sin red: la copia que ya se enseña sigue valiendo. */
        });
    }

    return servida;
  }

  const descarga = baja(url, null).catch((error: unknown) => {
    enMemoria.delete(url);

    throw error;
  });

  enMemoria.set(url, descarga);

  return descarga;
}

/**
 * Lo mismo para lo que llega en JSON: las plantillas rivales, los jugadores y
 * el seguimiento, que salen del Apps Script en vez de una hoja publicada.
 *
 * Aquí importa todavía más. Medido el 03/09/2026 contra el script de la hoja:
 * la primera llamada después de un rato parada tarda **entre 30 y 70 segundos**
 * —Apps Script tiene que abrir el libro— y las siguientes, tres o seis. La
 * pantalla de rivales pide las plantillas al abrirse, y también la pizarra
 * táctica, el coding y el ABP del rival: cada visita era otra vez esa cuenta.
 * Con la copia del aparato, esa cuenta sólo se paga la primera vez en cada
 * ordenador o móvil; después se enseña lo de la última vez y se renueva detrás.
 */
export function traeJson<T = unknown>(
  url: string,
  opciones: { forzar?: boolean } = {},
): Promise<T> {
  return traeCsv(url, opciones).then((texto) => JSON.parse(texto) as T);
}

/** Olvida lo bajado de una hoja (o de todas) para que se vuelva a pedir. */
export function olvidaCsv(url?: string) {
  if (url) {
    enMemoria.delete(url);
    borraCopias(url);
  } else {
    olvidaTodoElCsv();
  }
}
