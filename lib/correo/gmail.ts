/**
 * MANDAR CORREO DESDE LA CUENTA DEL CLUB.
 *
 * Es la misma cuenta de Google que ya está conectada para subir los vídeos del
 * coding a YouTube (`lib/coding/youtube.ts`): el `refresh_token` vive en
 * `app_documents` bajo `secreto:youtube` —una clave que `/api/docs` no sirve— y
 * de ahí sale un acceso fresco para cada envío. Así el correo sale **del club**
 * y no de una cuenta de servicio con otro nombre, que es justo lo que no se
 * quería: un informe del cuerpo técnico tiene que llegar firmado por el club.
 *
 * **No hay librería de correo.** Nodemailer y compañía existen para hablar SMTP;
 * aquí se le entrega a Gmail el mensaje ya escrito y él lo manda. Un correo es
 * texto plano con cabeceras (RFC 5322), y escribirlo a mano son treinta líneas
 * que se leen, frente a una dependencia más en el paquete.
 *
 * **Esto es sólo de servidor**: lee el secreto de la cuenta y usa `Buffer`.
 *
 * Lo que hay que saber si algún día falla:
 *
 * - Hace falta el permiso `gmail.send`, que se pide junto a los de YouTube. Una
 *   cuenta conectada **antes** de que esto existiera no lo tiene, y Google
 *   contesta 403: hay que volver a conectarla desde el panel del coding. El
 *   error ya lo dice con esas palabras.
 * - Y hace falta tener activada la *Gmail API* en el mismo proyecto de la
 *   consola de Google donde ya está la de YouTube. Eso se hace una vez y no se
 *   ve desde aquí; si falta, Google contesta que la API está deshabilitada.
 */

import { dameAcceso, leeAjustes } from "@/lib/coding/youtube";

export type Adjunto = {
  nombre: string;
  /** "application/pdf", "text/html"… */
  tipo: string;
  /** El contenido ya en base64. */
  base64: string;
};

export type Correo = {
  /** Destinatarios. Si va vacío, no se manda nada. */
  para: string[];
  asunto: string;
  /** El cuerpo bonito. */
  html: string;
  /** El mismo contenido en texto, para quien no vea HTML. */
  texto: string;
  adjuntos?: Adjunto[];
};

/** Una dirección de correo que se pueda mandar, o `null`. */
export function limpiaCorreo(valor: unknown) {
  const texto = String(valor ?? "").trim();

  /* Ni validación de laboratorio ni nada: que tenga arroba, un punto detrás y
     ningún espacio. Lo que pase de aquí lo juzga Google. */
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto) ? texto.toLowerCase() : null;
}

/**
 * Las direcciones de un texto escrito a mano.
 *
 * Se aceptan separadas por comas, por punto y coma o por saltos de línea,
 * porque es como las pega la gente desde otro correo. Se quitan las repetidas.
 */
export function leeDestinatarios(valor: string) {
  const trozos = String(valor ?? "").split(/[,;\n]/);

  const buenas: string[] = [];
  const malas: string[] = [];

  for (const trozo of trozos) {
    if (!trozo.trim()) continue;

    const limpia = limpiaCorreo(trozo);

    if (!limpia) malas.push(trozo.trim());
    else if (!buenas.includes(limpia)) buenas.push(limpia);
  }

  return { buenas, malas };
}

/* ------------------------------------------------------------------ */
/*  EL MENSAJE                                                         */
/* ------------------------------------------------------------------ */

/**
 * Una cabecera con acentos, como manda el RFC 2047.
 *
 * Sin esto, un asunto con «Á» o con «·» llega troceado o con símbolos raros en
 * la bandeja de entrada, según el cliente de correo.
 */
function cabecera(valor: string) {
  const limpio = valor.replace(/[\r\n]+/g, " ").trim();

  /* Si es ASCII puro no hace falta envolverlo, y se lee mejor en crudo. */
  if (/^[\x20-\x7E]*$/.test(limpio)) return limpio;

  return `=?UTF-8?B?${Buffer.from(limpio, "utf8").toString("base64")}?=`;
}

/** Base64 partido en líneas de 76, que es lo que admite un correo. */
function base64EnLineas(datos: string) {
  return (datos.match(/.{1,76}/g) ?? []).join("\r\n");
}

function parteTexto(tipo: string, contenido: string) {
  return [
    `Content-Type: ${tipo}; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    base64EnLineas(Buffer.from(contenido, "utf8").toString("base64")),
  ].join("\r\n");
}

function parteAdjunto(adjunto: Adjunto) {
  return [
    `Content-Type: ${adjunto.tipo}; name="${adjunto.nombre.replace(/"/g, "")}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${adjunto.nombre.replace(/"/g, "")}"`,
    "",
    base64EnLineas(adjunto.base64),
  ].join("\r\n");
}

/**
 * El correo entero, escrito como se escribe un correo.
 *
 * Va en dos capas: primero `multipart/alternative` con el texto y el HTML —el
 * cliente enseña el que sepa—, y si hay adjuntos, todo eso dentro de un
 * `multipart/mixed`. El orden importa: dentro de `alternative`, la última parte
 * es la preferida, así que el HTML va después del texto.
 *
 * `From` no se pone: lo escribe Gmail con la cuenta que autoriza, y ponerlo a
 * mano sólo sirve para que no coincida.
 */
export function escribeMensaje(correo: Correo) {
  const limite = `castilla-${Date.now().toString(36)}`;
  const limiteMixto = `${limite}-mixto`;

  const alternativo = [
    `Content-Type: multipart/alternative; boundary="${limite}"`,
    "",
    `--${limite}`,
    parteTexto("text/plain", correo.texto),
    `--${limite}`,
    parteTexto("text/html", correo.html),
    `--${limite}--`,
  ].join("\r\n");

  const adjuntos = correo.adjuntos ?? [];

  const cabeceras = [
    `To: ${correo.para.join(", ")}`,
    `Subject: ${cabecera(correo.asunto)}`,
    "MIME-Version: 1.0",
  ];

  if (adjuntos.length === 0) {
    return [...cabeceras, alternativo].join("\r\n");
  }

  return [
    ...cabeceras,
    `Content-Type: multipart/mixed; boundary="${limiteMixto}"`,
    "",
    `--${limiteMixto}`,
    alternativo,
    ...adjuntos.flatMap((adjunto) => [`--${limiteMixto}`, parteAdjunto(adjunto)]),
    `--${limiteMixto}--`,
  ].join("\r\n");
}

/* ------------------------------------------------------------------ */
/*  HABLAR CON GMAIL                                                   */
/* ------------------------------------------------------------------ */

/** Lo que Gmail quiere: el mensaje en base64 «de URL», sin relleno. */
function paraGmail(mensaje: string) {
  return Buffer.from(mensaje, "utf8").toString("base64url");
}

function traduceFallo(estado: number, mensaje: string) {
  if (/insufficient|scope|permission/i.test(mensaje) || estado === 403) {
    return (
      "La cuenta de Google está conectada pero sin permiso para enviar correo. " +
      "Vuelve a conectarla en Coding · YouTube: al reconectar se pide también ese permiso."
    );
  }

  if (/has not been used|disabled|Gmail API/i.test(mensaje)) {
    return (
      "Falta activar la Gmail API en el proyecto de Google que ya usa YouTube. " +
      "Se hace una vez en la consola de Google Cloud."
    );
  }

  return mensaje || `Gmail respondió ${estado}`;
}

/**
 * Manda el correo y devuelve desde qué cuenta ha salido.
 *
 * Si la cuenta no está conectada se levanta con el mismo aviso que la subida de
 * vídeos, que es donde se conecta.
 */
export async function envia(correo: Correo) {
  if (correo.para.length === 0) {
    throw new Error("No hay ninguna dirección a la que mandarlo.");
  }

  const ajustes = await leeAjustes();

  const acceso = await dameAcceso(ajustes);

  const respuesta = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${acceso}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: paraGmail(escribeMensaje(correo)) }),
    },
  );

  const datos = (await respuesta.json().catch(() => null)) as {
    id?: string;
    error?: { message?: string };
  } | null;

  if (!respuesta.ok || !datos?.id) {
    throw new Error(
      traduceFallo(respuesta.status, datos?.error?.message ?? ""),
    );
  }

  return { id: datos.id, cuenta: await cuentaDeEnvio(acceso) };
}

/**
 * Desde qué dirección sale el correo.
 *
 * Se pregunta al punto de identidad de Google (`userinfo`) y no a Gmail: leer
 * el perfil de Gmail exigiría permiso de lectura del buzón, y para escribir el
 * remitente en la pantalla no hace falta poder leer el correo de nadie.
 *
 * Si no se puede saber, no pasa nada: el envío ya ha salido.
 */
export async function cuentaDeEnvio(acceso: string) {
  try {
    const respuesta = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${acceso}` } },
    );

    if (!respuesta.ok) return "";

    const datos = (await respuesta.json()) as { email?: string };

    return String(datos.email ?? "");
  } catch {
    return "";
  }
}
