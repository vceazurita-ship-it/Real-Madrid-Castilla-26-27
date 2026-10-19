/**
 * Escribir un texto largo en la hoja desde las pantallas de conocimiento
 * (`/game-model`, `/team-values`, `/identidad-posicional`).
 *
 * Esas tres pantallas guardan con un `GET` al Apps Script y el texto viaja
 * **dentro de la dirección** (`?action=guardarPrincipio&PRINCIPIO=…`). Medido
 * el 19/10/2026 contra el despliegue, sólo leyendo (una lectura con relleno):
 *
 * - hasta ~11 000 caracteres de dirección, va;
 * - entre ~12 000 y ~16 000, el script **se ejecuta** pero la redirección a
 *   googleusercontent, que lleva la petición entera codificada y crece un
 *   tercio, contesta 400: la hoja escribe y la pantalla dice que no;
 * - a partir de ~16 000, Google contesta 400 antes de llegar al script: **no
 *   se escribe nada**.
 *
 * Y no hace falta un texto enorme para llegar: cada tilde ocupa seis
 * caracteres codificada (`%C3%A1`) y cada espacio, tres. Un principio de
 * 3 000-4 000 letras en castellano ya está en la zona mala.
 *
 * Así que: si la dirección cabe, `GET` como siempre (es lo que se sabe que
 * funciona). Si no cabe, no se manda por `GET` —sería perderlo o contarlo
 * mal— y se prueba por `POST` en JSON, como `lib/hojaRivales.ts`. Que el
 * `doPost` del script reparta también estas acciones **no se ha podido
 * comprobar sin escribir**; si no las conoce, contesta con un error, no
 * escribe nada y la pantalla lo cuenta como no guardado (con el aviso de
 * rescate del texto), que es lo honesto.
 */

import { HOJA_RIVALES_URL } from "@/lib/hojaRivales";

/** Tope de la dirección para mandar por `GET`, con margen sobre lo medido. */
export const TOPE_URL_HOJA = 10_000;

/**
 * ¿Ha escrito de verdad el Apps Script?
 *
 * Un 200 no basta: el script contesta 200 también cuando no escribe, con
 * `{ success: false, error }` en el cuerpo, y la página de «Authorization
 * required» de Google también llega con 200. Mirar sólo `res.ok` daba por
 * guardado un texto que no estaba en la hoja. Una respuesta de texto que no
 * es JSON ni HTML se da por buena, que es lo que se hacía antes.
 */
export async function escritoEnLaHoja(res: Response): Promise<boolean> {
  if (!res.ok) return false;

  const texto = await res.text().catch(() => "");

  try {
    const cuerpo = JSON.parse(texto) as {
      success?: boolean;
      ok?: boolean;
      error?: unknown;
    } | null;

    if (!cuerpo || typeof cuerpo !== "object") return true;

    if (cuerpo.success === false || cuerpo.ok === false) return false;

    return !(cuerpo.error && cuerpo.success !== true && cuerpo.ok !== true);
  } catch {
    return !/<html|<!doctype/i.test(texto);
  }
}

/** La dirección del `GET` para una acción y sus campos. */
function direccion(accion: string, campos: Record<string, string | number>) {
  const consulta = Object.entries(campos)
    .map(([k, v]) => `&${k}=${encodeURIComponent(String(v))}`)
    .join("");

  return `${HOJA_RIVALES_URL}?action=${accion}${consulta}`;
}

/**
 * Cuánto ocupa un texto dentro de la dirección, en la misma unidad que
 * `TOPE_URL_HOJA`. Sirve para avisar en pantalla antes de llegar al tope.
 */
export function pesoEnLaDireccion(texto: string) {
  return encodeURIComponent(texto).length;
}

/**
 * Lo que queda de dirección para el texto: el tope menos la acción, el ID y
 * los nombres de los campos (unos 150 caracteres).
 */
export const TOPE_TEXTO_HOJA = TOPE_URL_HOJA - 200;

export type ResultadoHoja = { ok: boolean; largo: boolean };

/**
 * Manda una acción con texto a la hoja: `GET` si cabe, `POST` en JSON si no.
 *
 * `largo` dice si iba por encima del tope, para que la pantalla pueda explicar
 * por qué no se ha guardado si falla.
 */
export async function guardaTextoEnLaHoja(
  accion: string,
  campos: Record<string, string | number>,
): Promise<ResultadoHoja> {
  const url = direccion(accion, campos);

  if (url.length <= TOPE_URL_HOJA) {
    return { ok: await fetch(url).then(escritoEnLaHoja), largo: false };
  }

  const res = await fetch(HOJA_RIVALES_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: accion, ...campos }),
  });

  return { ok: await escritoEnLaHoja(res), largo: true };
}

/** Texto del aviso cuando lo que no se ha guardado es por largo. */
export const AVISO_TEXTO_LARGO = {
  titulo: "Texto demasiado largo para la hoja",
  descripcion:
    "La hoja no admite textos tan largos en un solo apartado. Acórtalo o pártelo en dos; lo escrito sigue en pantalla y se puede exportar desde el aviso.",
};
