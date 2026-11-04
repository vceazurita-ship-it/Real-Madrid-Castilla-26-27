"use client";

/**
 * AVISOS, CONFIRMACIONES Y PREGUNTAS CON EL ESTILO DEL CLUB (04/11/2026).
 *
 * Lo pidió el analista: «los alert que salen en la página me parecen muy
 * cutres». Aquí vive todo lo que antes salía con las ventanas del navegador:
 *
 * - `aviso.exito / aviso.aviso / aviso.error / aviso.info (titulo, texto?)`:
 *   el aviso que aparece arriba y se va solo (los errores se quedan hasta que
 *   se cierran). Por debajo es sonner, así que los ~500 `toast.*` que ya había
 *   en la app salen con el mismo aspecto sin tocarlos: el estilo lo pone
 *   `components/themed-toaster.tsx` y `components/ui/avisos.css`.
 * - `await confirmar({ titulo, texto, peligro })` → `true` / `false`, en un
 *   diálogo propio (`components/ui/Dialogos.tsx`, montado en el layout).
 * - `await pedirTexto({ titulo, valor })` → el texto o `null` si se cancela.
 * - `enPalabras(error)`: el mensaje técnico («HTTP 500», «Failed to fetch»,
 *   «Unexpected token <») dicho como lo diría el analista. Se aplica solo a
 *   todo `toast.error`, así que en cada sitio basta con pasar el error.
 */

import type { ReactNode } from "react";
import { toast, type ExternalToast } from "sonner";

/* ------------------------------------------------------------------ */
/* Mensajes en palabras del analista                                   */
/* ------------------------------------------------------------------ */

const POR_CODIGO: Record<string, string> = {
  "400": "Lo que se ha mandado no se ha podido leer. Revisa los datos y vuelve a probar.",
  "401": "Hace falta volver a entrar con tu cuenta.",
  "403": "Tu cuenta no tiene permiso para esto.",
  "404": "No se encuentra lo que se buscaba. Puede que ya no exista.",
  "408": "Ha tardado demasiado y se ha cortado. Vuelve a probar.",
  "409": "Alguien lo ha cambiado a la vez. Recarga la página y vuelve a probar.",
  "413": "El archivo pesa demasiado para subirlo.",
  "429": "Demasiadas peticiones seguidas. Espera un minuto y vuelve a probar.",
};

function porCodigo(codigo: string) {
  if (POR_CODIGO[codigo]) return POR_CODIGO[codigo];

  if (codigo.startsWith("5")) return "El servidor no ha contestado bien. Vuelve a probar en un momento.";

  return "No ha salido bien. Vuelve a probar en un momento.";
}

const SIN_RED = /failed to fetch|networkerror|network request failed|load failed|fetch failed|ERR_NETWORK|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i;
const CORTADO = /aborterror|the (operation|user) (was )?abort|signal is aborted|ETIMEDOUT|timed out|timeout exceeded/i;
const ROTO = /unexpected token|unexpected end of json|is not valid json|json\.parse|unexpected end of input/i;
const PANTALLA = /cannot read propert|cannot set propert|is not a function|is not defined|is not iterable|undefined is not|null is not|maximum call stack|^(type|reference|range|syntax)error\b/i;
const SIN_SITIO = /quotaexceedederror|exceeded the quota/i;
/** «mira el log», «revisa la consola»… no son cosas que el analista vaya a mirar. */
const MIRA_EL_LOG = /[^.!?\n]*\b(mira|revisa|consulta|ver|abre)\b[^.!?\n]*\b(log|logs|registro del servidor|consola|terminal)\b[^.!?\n]*[.!?]?/gi;

/**
 * Un mensaje de error dicho en palabras del analista. Lo que ya está escrito
 * para él pasa tal cual; lo técnico se traduce y lo que sobra se quita.
 */
export function enPalabras(entrada: unknown): string {
  let texto =
    entrada instanceof Error
      ? entrada.message || entrada.name
      : typeof entrada === "string"
      ? entrada
      : entrada == null
      ? ""
      : String(entrada);

  // Sólo la primera línea: lo de debajo suele ser la pila.
  texto = texto.split(/\n\s*at\s/)[0].trim();

  if (!texto) return "";

  if (SIN_RED.test(texto)) return "No llega la conexión con el servidor. Mira que haya red y vuelve a probar.";
  if (CORTADO.test(texto)) return "Ha tardado demasiado y se ha cortado. Vuelve a probar.";
  if (ROTO.test(texto)) return "La respuesta ha llegado incompleta. Vuelve a probar en un momento.";
  if (SIN_SITIO.test(texto)) return "El navegador se ha quedado sin sitio para guardar. Libera espacio y vuelve a probar.";
  if (PANTALLA.test(texto)) return "Algo ha fallado en esta pantalla. Recarga la página y vuelve a probar.";

  // «HTTP 500», «500», «Error 502», «El servidor respondió 503», «La hoja respondió 500».
  const soloCodigo = texto.match(/^(?:HTTP|Error|Status)?\s*:?\s*(\d{3})\.?$/i);

  if (soloCodigo) return porCodigo(soloCodigo[1]);

  const respondio = texto.match(/^(?:El servidor|La hoja|YouTube)\s+(?:respondió|contesta|responde)\s+(\d{3})/i);

  if (respondio) {
    const quien = /hoja/i.test(texto) ? "La hoja" : /youtube/i.test(texto) ? "YouTube" : "El servidor";

    return respondio[1].startsWith("5") || respondio[1] === "429"
      ? `${quien} no ha contestado bien. Vuelve a probar en un momento.`
      : porCodigo(respondio[1]);
  }

  // Un código suelto al final de una frase ya escrita: «No se pudo leer el registro (500).»
  texto = texto.replace(/\s*\((?:HTTP\s*)?\d{3}\)\.?$/i, ".").replace(/\s*\bHTTP\s*\d{3}\b/gi, "");

  texto = texto.replace(MIRA_EL_LOG, "").replace(/\s{2,}/g, " ").trim();

  // El «Error:» del principio no dice nada.
  texto = texto.replace(/^(?:Error|Uncaught)\s*:\s*/i, "");

  if (!texto) return "No ha salido bien. Vuelve a probar en un momento.";

  return texto.length > 280 ? `${texto.slice(0, 277).trimEnd()}…` : texto;
}

/* ------------------------------------------------------------------ */
/* Avisos (toasts)                                                     */
/* ------------------------------------------------------------------ */

export type TipoAviso = "exito" | "aviso" | "error" | "info";

export type OpcionesAviso = Omit<ExternalToast, "description"> & {
  /** El texto de debajo del título. */
  texto?: ReactNode;
};

/** Cuánto se queda cada tipo: el error, hasta que se cierre. */
export const DURACION_AVISO: Record<TipoAviso, number> = {
  exito: 4_000,
  info: 6_000,
  aviso: 8_000,
  error: Number.POSITIVE_INFINITY,
};

function lanza(tipo: TipoAviso, titulo: ReactNode, textoU?: ReactNode | OpcionesAviso, mas?: OpcionesAviso) {
  const opciones: OpcionesAviso =
    textoU !== null && typeof textoU === "object" && !("$$typeof" in (textoU as object)) && !Array.isArray(textoU)
      ? (textoU as OpcionesAviso)
      : { ...mas, texto: textoU as ReactNode };

  const { texto, ...resto } = opciones;
  const datos: ExternalToast = { ...resto, description: texto };

  if (tipo === "exito") return toast.success(titulo, datos);
  if (tipo === "aviso") return toast.warning(titulo, datos);
  if (tipo === "info") return toast.info(titulo, datos);

  return toast.error(titulo, datos);
}

type Lanzador = (titulo: ReactNode, texto?: ReactNode | OpcionesAviso, opciones?: OpcionesAviso) => string | number;

export const aviso: Record<TipoAviso, Lanzador> & { cierra: (id?: string | number) => void } = {
  exito: (t, x, o) => lanza("exito", t, x, o),
  aviso: (t, x, o) => lanza("aviso", t, x, o),
  error: (t, x, o) => lanza("error", t, x, o),
  info: (t, x, o) => lanza("info", t, x, o),
  cierra: (id) => {
    toast.dismiss(id);
  },
};

/* ------------------------------------------------------------------ */
/* Lo que se le pone a sonner para que todos los toast.* lo cumplan    */
/* ------------------------------------------------------------------ */

/** Lo que leen en voz alta los lectores de pantalla cuando sale un error. */
type Oyente = (texto: string) => void;

const oyentesError = new Set<Oyente>();

export function escuchaErrores(oyente: Oyente) {
  oyentesError.add(oyente);

  return () => {
    oyentesError.delete(oyente);
  };
}

function aTexto(nodo: unknown): string {
  return typeof nodo === "string" || typeof nodo === "number" ? String(nodo) : "";
}

const MARCA = "__rmcfAvisos";

/**
 * Una sola vez, al montar el `Toaster`: `toast.error` traduce el mensaje,
 * no se cierra solo y se anuncia como alerta; `toast.warning` dura más.
 * Si un sitio pasa su propio `duration`, manda el suyo.
 */
export function preparaAvisos() {
  const t = toast as typeof toast & { [MARCA]?: boolean };

  if (t[MARCA]) return;

  t[MARCA] = true;

  const error = toast.error;
  const warning = toast.warning;
  const info = toast.info;

  toast.error = (mensaje, datos) => {
    const titulo = typeof mensaje === "string" ? enPalabras(mensaje) || "No ha salido bien" : mensaje;
    const descripcion = typeof datos?.description === "string" ? enPalabras(datos.description) || undefined : datos?.description;

    // Si el título y el texto dicen lo mismo, sobra el texto.
    const limpio = descripcion && descripcion === titulo ? undefined : descripcion;

    const leido = [aTexto(titulo), aTexto(limpio)].filter(Boolean).join(". ");

    if (leido) oyentesError.forEach((oyente) => oyente(leido));

    return error(titulo, { duration: DURACION_AVISO.error, ...datos, description: limpio });
  };

  toast.warning = (mensaje, datos) => warning(mensaje, { duration: DURACION_AVISO.aviso, ...datos });
  toast.info = (mensaje, datos) => info(mensaje, { duration: DURACION_AVISO.info, ...datos });
}

/* ------------------------------------------------------------------ */
/* Confirmar y preguntar                                               */
/* ------------------------------------------------------------------ */

export type OpcionesConfirmar = {
  titulo: string;
  texto?: string;
  /** Borra o tira algo: botón rojo y el foco empieza en «Cancelar». */
  peligro?: boolean;
  /** Lo que dice el botón de seguir. Por defecto «Sí, seguir» (o «Borrar» con peligro). */
  aceptar?: string;
  cancelar?: string;
};

export type OpcionesPedirTexto = {
  titulo: string;
  texto?: string;
  /** Lo que ya viene escrito. */
  valor?: string;
  placeholder?: string;
  etiqueta?: string;
  aceptar?: string;
  cancelar?: string;
  /** Varias líneas. */
  largo?: boolean;
  /** Si no es válido, el porqué (se enseña debajo del campo). */
  valida?: (valor: string) => string | null;
};

export type Dialogo =
  | ({ tipo: "confirmar"; id: number; responde: (si: boolean) => void } & OpcionesConfirmar)
  | ({ tipo: "pedir"; id: number; responde: (valor: string | null) => void } & OpcionesPedirTexto);

let cola: Dialogo[] = [];
let siguiente = 1;
const oyentes = new Set<() => void>();

function avisaCambio() {
  oyentes.forEach((oyente) => oyente());
}

export const dialogos = {
  suscribe(oyente: () => void) {
    oyentes.add(oyente);

    return () => {
      oyentes.delete(oyente);
    };
  },
  /** El que está a la vista (el primero de la cola). */
  actual(): Dialogo | null {
    return cola[0] ?? null;
  },
  quita(id: number) {
    cola = cola.filter((d) => d.id !== id);
    avisaCambio();
  },
};

/** Si no hay quien pinte el diálogo (fuera del layout), mejor no bloquear. */
let montado = 0;

export function marcaDialogosMontados(si: boolean) {
  montado += si ? 1 : -1;
}

/** Los verbos que tiran algo: botón rojo. */
const QUE_BORRA = /^(borrar|eliminar|quitar|descartar|vaciar|tirar|retirar|perder|deshacer|sustituir|reemplazar|cerrar)$/i;
/** O lo dice el texto. */
const SE_PIERDE = /\b(eliminar|borrar|se borra\w*|se pierde\w*|perder\w*|no se puede deshacer|no se podrán recuperar)\b/i;

/** «¿Sustituirlo por…?» → «Sustituir»; «¿Seguro que…?» → nada. */
function verboDe(pregunta: string) {
  const primera = pregunta.replace(/^¿/, "").split(/[\s,?]/)[0] ?? "";
  const infinitivo = primera.match(/^([a-záéíóúñ]+?(?:ar|er|ir))(?:lo|la|los|las|le|les|se|me|te)?$/i)?.[1];

  return infinitivo ? infinitivo[0].toUpperCase() + infinitivo.slice(1).toLowerCase() : undefined;
}

/** La primera frase y lo demás. */
function primeraFrase(texto: string): [string, string] {
  const corte = texto.search(/[.!](\s|$)/);

  return corte < 0 ? [texto, ""] : [texto.slice(0, corte + 1).trim(), texto.slice(corte + 1).trim()];
}

/**
 * Una pregunta escrita de corrido («¿Quitar este objetivo? Sus acciones
 * dejarán de contar.») partida en título y texto, con el botón diciendo lo
 * que hace («Quitar») en vez de un «Aceptar» que no dice nada.
 */
export function deUnaFrase(frase: string): OpcionesConfirmar {
  const limpia = frase.trim();
  const fin = limpia.indexOf("?");
  const peligroPorTexto = SE_PIERDE.test(limpia);

  if (fin < 0) return { titulo: limpia, peligro: peligroPorTexto };

  // Dónde empieza la pregunta: su «¿» o, si se olvidó, el final de la frase anterior.
  let inicio = limpia.lastIndexOf("¿", fin);

  if (inicio < 0) {
    const corte = Math.max(limpia.lastIndexOf(". ", fin), limpia.lastIndexOf("\n", fin));

    inicio = corte < 0 ? 0 : corte + 1;
  }

  let pregunta = limpia.slice(inicio, fin + 1).trim();

  if (!pregunta.startsWith("¿")) pregunta = `¿${pregunta}`;

  const antes = limpia.slice(0, inicio).trim();
  const despues = limpia.slice(fin + 1).trim();
  const verbo = verboDe(pregunta);
  const peligro = (verbo ? QUE_BORRA.test(verbo) : false) || peligroPorTexto;
  const aceptar = verbo ?? (/elimin/i.test(limpia) ? "Eliminar" : /borr/i.test(limpia) ? "Borrar" : undefined);

  // «…se perderán. ¿Continuar?»: la pregunta es el botón, el título es lo de antes.
  if (antes && pregunta.split(/\s+/).length <= 2) {
    const [titulo, resto] = primeraFrase(antes);

    return { titulo, texto: [resto, despues].filter(Boolean).join("\n\n") || undefined, aceptar, peligro };
  }

  return { titulo: pregunta, texto: [antes, despues].filter(Boolean).join("\n\n") || undefined, aceptar, peligro };
}

/**
 * Pregunta antes de seguir. `await confirmar({ titulo, texto, peligro })`
 * devuelve `true` si se acepta y `false` si se cancela, se pulsa Esc o se
 * toca fuera. Con una frase suelta («¿Borrar X? Se pierde.») la parte sola.
 */
export function confirmar(opciones: OpcionesConfirmar | string): Promise<boolean> {
  const o = typeof opciones === "string" ? deUnaFrase(opciones) : opciones;

  if (typeof window === "undefined") return Promise.resolve(false);

  if (!montado) return Promise.resolve(window.confirm([o.titulo, o.texto].filter(Boolean).join("\n\n")));

  return new Promise((resolve) => {
    const id = siguiente++;

    cola = [...cola, { ...o, tipo: "confirmar", id, responde: resolve }];
    avisaCambio();
  });
}

/** Pide un texto. Devuelve lo escrito (recortado) o `null` si se cancela. */
export function pedirTexto(opciones: OpcionesPedirTexto): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  if (!montado) return Promise.resolve(window.prompt(opciones.titulo, opciones.valor ?? ""));

  return new Promise((resolve) => {
    const id = siguiente++;

    cola = [...cola, { ...opciones, tipo: "pedir", id, responde: resolve }];
    avisaCambio();
  });
}
