/**
 * «MANDARME MI QUINIELA»: el texto de los pronósticos de una jornada.
 *
 * Lo comparten el botón de WhatsApp (navegador) y el correo (servidor), para
 * que los dos digan lo mismo. Sólo cuenta lo GUARDADO, nunca un borrador.
 */

import { partidosDe, type Signo } from "./modelo";

export function textoDeMisPronosticos(jornada: number, nombre: string, signos: (Signo | null | undefined)[]) {
  const lineas = partidosDe(jornada).map((p, i) => `${i + 1}. ${p.local} - ${p.visitante}: ${signos[i] ?? "sin pronóstico"}`);

  return [`Quiniela · Jornada ${jornada} · ${nombre}`, "", ...lineas].join("\n");
}

/** `wa.me` con el teléfono si lo hay; sin él, para elegir el chat. */
export function enlaceWhatsapp(texto: string, telefono?: string | null) {
  const digitos = (telefono ?? "").replace(/\D/g, "");

  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
