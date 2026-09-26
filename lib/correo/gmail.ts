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
  /**
   * Para las imágenes que van DENTRO del cuerpo del correo.
   *
   * Gmail no pinta un `<img src="data:…">` —lo quita—, así que los gráficos no
   * pueden viajar dentro del HTML: van como parte aparte con este identificador
   * y el HTML las llama con `src="cid:<esto>"`. Es lo que hace que un informe
   * con dibujos se vea igual en Gmail, en Outlook y en el móvil, sin alojar
   * nada en ningún sitio.
   */
  cid?: string;
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
  const nombre = adjunto.nombre.replace(/"/g, "");

  const cabeceras = [
    `Content-Type: ${adjunto.tipo}; name="${nombre}"`,
    "Content-Transfer-Encoding: base64",
  ];

  if (adjunto.cid) {
    /* Va dentro del cuerpo, no colgando al final: `inline` es lo que evita que
       Outlook la enseñe además como adjunto suelto. */
    cabeceras.push(
      `Content-ID: <${adjunto.cid}>`,
      `Content-Disposition: inline; filename="${nombre}"`,
    );
  } else {
    cabeceras.push(`Content-Disposition: attachment; filename="${nombre}"`);
  }

  return [...cabeceras, "", base64EnLineas(adjunto.base64)].join("\r\n");
}

/** Envuelve un cuerpo en un multipart, con sus partes dentro. */
function envuelve(tipo: string, limite: string, partes: string[], extra = "") {
  return [
    `Content-Type: ${tipo}; boundary="${limite}"${extra}`,
    "",
    ...partes.flatMap((parte) => [`--${limite}`, parte]),
    `--${limite}--`,
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
/**
 * Nadie ve a los demás: todo el mundo va en copia oculta.
 *
 * Los correos de la plataforma salen a una lista —el cuerpo técnico, los
 * jugadores de un grupo— y poniéndolos a todos en `To:` cada uno se lleva las
 * direcciones de los demás. Eso es repartir datos personales sin que nadie lo
 * haya pedido, y basta con que uno responda a todos para montar un hilo que no
 * quería nadie.
 *
 * Así que los destinatarios van en `Bcc:` y en `To:` va **la propia cuenta que
 * envía**: un mensaje sin `To:` lo tratan peor los filtros de correo, y de paso
 * queda copia en el buzón del club de lo que salió. Si no se sabe la cuenta se
 * usa `undisclosed-recipients:;`, que es la forma de decir lo mismo cuando no
 * hay a quién poner.
 */
export function escribeMensaje(correo: Correo, remitente?: string | null) {
  const sello = Date.now().toString(36);

  const alternativo = envuelve(
    "multipart/alternative",
    `castilla-alt-${sello}`,
    [
      parteTexto("text/plain", correo.texto),
      parteTexto("text/html", correo.html),
    ],
  );

  const adjuntos = correo.adjuntos ?? [];

  const dentroDelCuerpo = adjuntos.filter((uno) => uno.cid);
  const sueltos = adjuntos.filter((uno) => !uno.cid);

  /*
  | Las imágenes del cuerpo —los gráficos del informe— van **con** el HTML
  | dentro de un `related`, que es lo que le dice al cliente de correo que esas
  | partes no son adjuntos sino el propio documento. Los adjuntos de verdad, si
  | algún día los hay, cuelgan del `mixed` de fuera.
  */
  const conImagenes = dentroDelCuerpo.length
    ? envuelve(
        "multipart/related",
        `castilla-rel-${sello}`,
        [alternativo, ...dentroDelCuerpo.map(parteAdjunto)],
        '; type="text/html"',
      )
    : alternativo;

  const cuerpo = sueltos.length
    ? envuelve("multipart/mixed", `castilla-mix-${sello}`, [
        conImagenes,
        ...sueltos.map(parteAdjunto),
      ])
    : conImagenes;

  return [
    `To: ${remitente || "undisclosed-recipients:;"}`,
    `Bcc: ${correo.para.join(", ")}`,
    `Subject: ${cabecera(correo.asunto)}`,
    "MIME-Version: 1.0",
    cuerpo,
  ].join("\r\n");
}

/* ------------------------------------------------------------------ */
/*  HABLAR CON GMAIL                                                   */
/* ------------------------------------------------------------------ */

/** Lo que Gmail quiere: el mensaje en base64 «de URL», sin relleno. */
function paraGmail(mensaje: string) {
  return Buffer.from(mensaje, "utf8").toString("base64url");
}

/*
| EL ORDEN DE ESTAS DOS PREGUNTAS IMPORTA, Y NO ES OBVIO.
|
| Los dos fallos que puede dar el envío contestan **403**. Durante un día la
| primera rama era «o el mensaje habla de permisos O el estado es 403», así que
| se tragaba también el de la API desactivada y mandaba a reconectar la cuenta:
| el usuario reconectó, concedió el permiso, y la pantalla le siguió diciendo lo
| mismo porque el problema era el otro. Se mira PRIMERO lo que dice Google y sólo
| al final se cae en el genérico por código.
*/
function traduceFallo(estado: number, mensaje: string) {
  if (/has not been used|is disabled|Gmail API/i.test(mensaje)) {
    /*
    | El mensaje de Google trae el número de proyecto y el enlace exacto: se
    | pasan tal cual.
    |
    | Comprobado el 16/09/2026 con un envío de verdad: la cuenta tenía el
    | permiso `gmail.send` concedido y Google seguía contestando 403 porque la
    | **Gmail API no estaba activada en el proyecto**. Sin decir cuál es el
    | proyecto ni dónde se activa, el aviso mandaba a reconectar la cuenta una
    | y otra vez sin arreglar nada.
    */
    const proyecto = /project (\d+)/.exec(mensaje)?.[1] ?? "";

    const enlace = proyecto
      ? `https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=${proyecto}`
      : "https://console.cloud.google.com/apis/library/gmail.googleapis.com";

    return (
      "Falta activar la Gmail API en el proyecto de Google. El permiso de la " +
      `cuenta está bien: lo que hay que hacer es entrar en ${enlace} y pulsar ` +
      "«Habilitar». Tarda un par de minutos en surtir efecto."
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

  /*
  | Se pregunta la cuenta ANTES de mandar, no después.
  |
  | Antes sólo hacía falta para enseñar el remitente en pantalla y se
  | preguntaba al final; ahora va en la cabecera `To:`, porque los
  | destinatarios viajan en copia oculta. Si falla, el envío sigue: la
  | cabecera cae en `undisclosed-recipients:;` y nadie ve a nadie igual.
  */
  const remitente = await cuentaDeEnvio(acceso);

  const respuesta = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${acceso}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: paraGmail(escribeMensaje(correo, remitente)) }),
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

  return { id: datos.id, cuenta: remitente };
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
