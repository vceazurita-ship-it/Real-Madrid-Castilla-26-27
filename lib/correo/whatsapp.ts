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

/**
 * El texto de un mensaje corto, sin contar los enlaces (20/10/2026): en el
 * móvil se lee en cinco segundos o no se lee.
 */
const TOPE_CORTO = 400;

/** Recorta a `n` caracteres por la última frase entera que quepa (o la última palabra), sin «…». */
function cabeEn(texto: string, n: number) {
  if (texto.length <= n) return texto;

  const corte = texto.slice(0, n);

  /* El final de una frase, también si va al final de una línea (24/10/2026: el WhatsApp va en líneas). */
  const frase = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf(".\n"));

  if (frase > n * 0.4) return corte.slice(0, frase + 1);

  return corte.slice(0, corte.lastIndexOf(" ")).replace(/[,;:·\s]+$/, "");
}

/**
 * El mensaje: el asunto en negrita, lo que se quiera decir, el vídeo y los documentos con su enlace.
 *
 * Con `lineas` (20/10/2026) sale el formato corto de cuatro líneas: titular
 * en negrita, qué hacemos, qué ver (vídeo) y el PDF, en menos de 400
 * caracteres sin contar los enlaces. Vale para el informe del partido y para
 * el de balón parado: cada uno pone su titular (`asunto`) y su línea de qué
 * hacemos. Sin `lineas`, el de siempre.
 */
export function mensajeWhatsapp(o: {
  asunto: string;
  mensaje?: string;
  firma?: string;
  resumen?: string;
  video?: string | null;
  enlaces: { nombre: string; url: string }[];
  /** Los documentos antes que el vídeo: WhatsApp saca la vista previa del PRIMER enlace (la tarjeta del PDF). */
  documentosPrimero?: boolean;
  /** Formato corto: la línea (o líneas) de «qué hacemos», bajo el titular. */
  lineas?: string[];
}) {
  const video = o.video ? [`▶️ Vídeo en HD: ${o.video}`] : [];
  const documentos = o.enlaces.filter((d) => d.url !== o.video && !/\.mp4$/i.test(d.nombre)).map((d) => `📄 ${d.nombre}: ${d.url}`);
  const enlaces = (o.documentosPrimero ? [...documentos, ...video] : [...video, ...documentos]).join("\n");

  if (o.lineas) {
    const titular = `*${o.asunto.trim().replace(/\*/g, "")}*`;

    /* Lo que escribe quien lo manda va entero: son sus palabras. Se recorta lo nuestro. */
    const propio = o.mensaje?.trim() ? `${o.mensaje.trim()}${o.firma ? `\n— ${o.firma}` : ""}` : "";

    const etiquetas = enlaces.replace(/https?:\/\/\S+/g, "").length;

    const hueco = Math.max(60, TOPE_CORTO - titular.length - propio.length - etiquetas - 4);

    /* Cada línea acaba en punto (20/10/2026) y va en su renglón (24/10/2026, marketing: era un párrafo de cinco líneas en el móvil). */
    const que = cabeEn(
      o.lineas
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => (/[.?!:]$/.test(l) ? l : `${l}.`))
        .join("\n"),
      hueco,
    );

    return [titular, que, propio, enlaces].filter(Boolean).join("\n");
  }

  const cabeza = [`*${o.asunto.trim()}*`, o.mensaje?.trim() ? `${o.mensaje.trim()}${o.firma ? `\n— ${o.firma}` : ""}` : ""].filter(Boolean).join("\n\n");
  const hueco = TOPE_TEXTO - cabeza.length - enlaces.length - 8;
  const resumen = o.resumen?.trim() && hueco > 200 ? (o.resumen.trim().length > hueco ? `${o.resumen.trim().slice(0, hueco - 1).trimEnd()}…` : o.resumen.trim()) : "";

  return [cabeza, resumen, enlaces].filter(Boolean).join("\n\n");
}
