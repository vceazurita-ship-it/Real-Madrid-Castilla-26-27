/**
 * MANDAR UN INFORME POR WHATSAPP (15/10/2026).
 *
 * WhatsApp no deja que una web mande mensajes sola desde un número personal
 * (eso es la API de empresa, con otro número y de pago). Lo que sí deja es
 * abrir el chat con el mensaje ya escrito: `https://wa.me/<número>?text=…`.
 * Así sale desde el número de quien lo manda y basta un toque en «Enviar» por
 * chat. Los documentos no van como archivo, van como enlace al almacén (los
 * mismos que lleva el correo; se borran a los 30 días, ver /api/informe/subida).
 *
 * Se puede usar en el navegador y en el servidor.
 */

export type CanalEnvio = "correo" | "whatsapp";

/** Un mensaje listo para WhatsApp: el texto entero y de qué correo sale (resumen, completo…). */
export type MensajeWhatsapp = { titulo: string; texto: string };

/** Los dígitos de un teléfono con prefijo de país (sin «+»). Un móvil español sin prefijo se da por +34. */
export function normalizaTelefono(texto: string) {
  const limpio = texto.trim().replace(/[\s().-]/g, "");
  const digitos = limpio.replace(/^\+/, "").replace(/^00/, "").replace(/\D/g, "");

  if (!digitos) return "";

  /* 9 cifras que empiezan por 6, 7, 8 o 9: un número español. */
  if (!/^(\+|00)/.test(limpio) && /^[6789]\d{8}$/.test(digitos)) return `34${digitos}`;

  return digitos;
}

export const esTelefono = (texto: string) => /^\d{8,15}$/.test(normalizaTelefono(texto));

/** «+34 600 11 22 33» para enseñarlo; el resto, con «+» y en grupos de tres. */
export function telefonoLegible(numero: string) {
  const n = normalizaTelefono(numero);

  if (n.startsWith("34") && n.length === 11) return `+34 ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)} ${n.slice(9)}`;

  return `+${n.replace(/(\d{3})(?=\d)/g, "$1 ")}`;
}

/** Los teléfonos de un texto (separados por comas, punto y coma o líneas), y los que no lo parecen. */
export function telefonosDe(texto: string) {
  const trozos = texto.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

  return { buenos: [...new Set(trozos.filter(esTelefono).map(normalizaTelefono))], malos: trozos.filter((x) => !esTelefono(x)) };
}

/**
 * El enlace que abre WhatsApp con el mensaje escrito. Sin número, WhatsApp
 * deja elegir el chat (sirve para mandarlo a un grupo).
 */
export function enlaceWhatsapp(numero: string | null, texto: string) {
  return `https://wa.me/${numero ? normalizaTelefono(numero) : ""}?text=${encodeURIComponent(texto)}`;
}

/** WhatsApp corta los enlaces muy largos: el texto se queda en lo que cabe sin perder los enlaces. */
const TOPE_TEXTO = 3500;

/** El mensaje: el asunto en negrita, lo que se quiera decir, el vídeo y los documentos con su enlace. */
export function mensajeWhatsapp(o: { asunto: string; mensaje?: string; firma?: string; resumen?: string; video?: string | null; enlaces: { nombre: string; url: string }[] }) {
  const enlaces = [
    ...(o.video ? [`▶️ Vídeo en HD: ${o.video}`] : []),
    ...o.enlaces.filter((d) => d.url !== o.video && !/\.mp4$/i.test(d.nombre)).map((d) => `📄 ${d.nombre}: ${d.url}`),
  ].join("\n");

  const cabeza = [`*${o.asunto.trim()}*`, o.mensaje?.trim() ? `${o.mensaje.trim()}${o.firma ? `\n— ${o.firma}` : ""}` : ""].filter(Boolean).join("\n\n");
  const hueco = TOPE_TEXTO - cabeza.length - enlaces.length - 8;
  const resumen = o.resumen?.trim() && hueco > 200 ? (o.resumen.trim().length > hueco ? `${o.resumen.trim().slice(0, hueco - 1).trimEnd()}…` : o.resumen.trim()) : "";

  return [cabeza, resumen, enlaces].filter(Boolean).join("\n\n");
}
