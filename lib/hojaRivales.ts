/**
 * Hablar con la hoja RIVALES desde el navegador.
 *
 * Tres pantallas escriben en la misma hoja —el informe de scouting colectivo,
 * el plan de partido y el guardado de alineaciones— y las tres mandaban el
 * cuerpo como formulario (`URLSearchParams`). Eso **dejó de funcionar**: el
 * `doPost` del Apps Script lee `e.postData.contents` y lo pasa por
 * `JSON.parse`, así que un formulario se estrella antes de repartir por acción
 * y la hoja contesta
 *
 *     {"success":false,"error":"SyntaxError: Unexpected token 'a', \"action=gua\"…"}
 *
 * Detectado el 01/09/2026: el informe colectivo llevaba días sin guardar nada
 * y el aviso que salía en pantalla era ese mensaje de JavaScript, que no dice
 * qué hacer. Aquí se manda **JSON**, que es lo que el script espera.
 *
 * Y se manda con `Content-Type: text/plain;charset=utf-8` a propósito. Es uno
 * de los tres tipos que el navegador considera «simples»: con
 * `application/json` haría antes una petición `OPTIONS` de comprobación, y un
 * despliegue de Apps Script no contesta a `OPTIONS`, así que el guardado
 * moriría sin llegar nunca a la hoja. El script no mira la cabecera: lee el
 * cuerpo tal cual. Es lo mismo que hace `app/api/rivals/route.ts`.
 *
 * Ojo con lo que **no** arregla esto: la hoja escribe por nombre de columna y
 * descarta en silencio lo que no tenga cabecera. Eso se sigue comprobando
 * releyendo la fila (`hooks/useSaveGuard`).
 */

import { explicaErrorScript } from "@/lib/appsScriptErrors";

/** El despliegue del Apps Script que sirve la hoja. */
export const HOJA_RIVALES_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

/** Una fila de la hoja: columna -> valor, tal y como la sirve el script. */
export type FilaHoja = Record<string, string>;

/**
 * Avisa al servidor de que acaba de escribirse algo.
 *
 * `/api/rivals` guarda las lecturas de la hoja hasta diez minutos, y estas
 * escrituras van directas al Apps Script sin pasar por ahí: sin este aviso,
 * quien guardara una alineación no la vería en la lista hasta que la copia
 * caducase. No se espera ni se comprueba —lo peor que puede pasar es servir
 * la copia un rato más— y en el servidor no existe `window`.
 */
export function olvidaLoGuardado() {
  if (typeof window === "undefined") return;

  void fetch("/api/rivals", { method: "DELETE" }).catch(() => undefined);
}

/**
 * Manda una acción a la hoja y devuelve lo que conteste.
 *
 * Lanza con un mensaje ya traducido si algo va mal: un HTTP que no sea 200,
 * una respuesta que no es JSON —casi siempre la página de «Authorization
 * required» de Google— o un `success: false` del propio script.
 */
export async function guardaEnLaHoja(
  accion: string,
  datos: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const respuesta = await fetch(HOJA_RIVALES_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: accion, ...datos }),
  });

  if (!respuesta.ok) {
    throw new Error(`La hoja respondió ${respuesta.status}`);
  }

  const cuerpo = await respuesta.text();

  let leido: Record<string, unknown>;

  try {
    leido = JSON.parse(cuerpo);
  } catch {
    throw new Error("La hoja no devolvió datos legibles");
  }

  if (leido?.success === false) {
    throw new Error(
      explicaErrorScript(leido.error) || "El servidor rechazó el guardado",
    );
  }

  /* Escrito en la hoja: la copia del servidor ya no vale. */
  olvidaLoGuardado();

  return leido;
}

/** Las filas de la hoja RIVALES, sin caché: se usa para verificar guardados. */
export async function leeRivales(): Promise<FilaHoja[]> {
  const respuesta = await fetch(`${HOJA_RIVALES_URL}?action=rivales`, {
    cache: "no-store",
  });

  if (!respuesta.ok) throw new Error(`La hoja respondió ${respuesta.status}`);

  const filas = await respuesta.json();

  return Array.isArray(filas) ? filas : [];
}
