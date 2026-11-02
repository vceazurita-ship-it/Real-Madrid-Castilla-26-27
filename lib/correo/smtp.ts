/**
 * MANDAR CORREO POR SMTP DE GMAIL, CON CONTRASEÑA DE APLICACIÓN (02/11/2026).
 *
 * Por qué existe: el envío por la API de Gmail (`gmail.ts`) cuelga del mismo
 * permiso OAuth que la subida a YouTube, y ese permiso **caduca** —Google
 * contesta `invalid_grant`— cuando la aplicación de la consola sigue «en
 * prueba» (a los 7 días), cuando se revoca o cuando se cambia la contraseña.
 * Reconectarlo exige un clic de una persona. Una **contraseña de aplicación**
 * de la cuenta del club no caduca: sólo deja de valer si alguien la borra o
 * cambia la contraseña de la cuenta. Así que, si está puesta, el correo va por
 * aquí y no depende de nadie.
 *
 * Se configura con dos variables (en `.env.local` y en Vercel):
 *
 * - `GMAIL_SMTP_USER`     la dirección de la cuenta del club (la misma que
 *                         está conectada a YouTube: es el remitente).
 * - `GMAIL_APP_PASSWORD`  la contraseña de aplicación de 16 letras que da
 *                         https://myaccount.google.com/apppasswords (hace
 *                         falta tener la verificación en dos pasos). Los
 *                         espacios con que la enseña Google dan igual.
 *
 * **Sin librería, como el resto del correo.** El mensaje ya lo escribe
 * `escribeMensaje` (RFC 5322 con todo en base64); aquí sólo se habla el SMTP
 * justo para entregarlo: EHLO, AUTH PLAIN, MAIL, RCPT, DATA y QUIT sobre TLS
 * directo al 465. Son cien líneas que se leen, frente a una dependencia más.
 *
 * **Esto es sólo de servidor** (usa `node:tls`).
 */

import net from "node:net";
import tls from "node:tls";

export type ConfigSmtp = {
  host: string;
  puerto: number;
  /** TLS desde el primer byte (465). Sin él sólo se admite `localhost`: es para las pruebas. */
  seguro: boolean;
  usuario: string;
  clave: string;
  /** Nombre con el que sale, si se quiere (`GMAIL_SMTP_NOMBRE`). */
  nombre: string;
};

/**
 * Tope de Gmail por SMTP: 25 MB el mensaje entero, ya en base64.
 *
 * La ruta de subida de la API llega a 35 MB, así que un mensaje entre los dos
 * prefiere la API (ver `ordenDeVias` en `gmail.ts`).
 */
export const LIMITE_SMTP = 25 * 1024 * 1024;

/** La configuración del entorno, o `null` si falta alguna de las dos variables. */
export function configSmtp(env: Record<string, string | undefined> = process.env): ConfigSmtp | null {
  const usuario = String(env.GMAIL_SMTP_USER ?? "").trim();
  const clave = String(env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");

  if (!usuario || !clave) return null;

  return {
    host: String(env.GMAIL_SMTP_HOST ?? "").trim() || "smtp.gmail.com",
    puerto: Number(env.GMAIL_SMTP_PORT) || 465,
    seguro: env.GMAIL_SMTP_SEGURO !== "0",
    usuario,
    clave,
    nombre: String(env.GMAIL_SMTP_NOMBRE ?? "").trim(),
  };
}

/** Un fallo de SMTP con la respuesta del servidor y si el mensaje pudo salir. */
export class FalloSmtp extends Error {
  /** `true` si el servidor ya tenía el mensaje entero cuando falló: reintentar por otra vía lo duplicaría. */
  quizaSalio: boolean;

  constructor(mensaje: string, quizaSalio = false) {
    super(mensaje);
    this.name = "FalloSmtp";
    this.quizaSalio = quizaSalio;
  }
}

/** Lo que dice Gmail, en palabras del analista. */
function traduce(codigo: number, texto: string) {
  if (codigo === 535 || codigo === 534) {
    return (
      "Gmail no acepta la contraseña de aplicación (GMAIL_APP_PASSWORD). " +
      "Crea otra en https://myaccount.google.com/apppasswords con la cuenta del club " +
      "y cámbiala en .env.local y en Vercel."
    );
  }

  if (codigo === 552) return "El mensaje pasa de 25 MB, que es lo que admite Gmail por SMTP.";

  if (codigo === 550 && /daily|limit/i.test(texto)) return "La cuenta del club ha llegado al tope diario de envíos de Gmail.";

  return `Gmail (SMTP) respondió ${codigo}: ${texto}`;
}

/**
 * El cuerpo de DATA: saltos CRLF y los puntos a principio de línea doblados.
 *
 * Un renglón que empieza por «.» se tomaría por el final del mensaje; el
 * estándar (RFC 5321 §4.5.2) es doblarlo y el servidor lo deshace.
 */
export function cuerpoData(mensaje: string) {
  const crlf = mensaje.replace(/\r?\n/g, "\r\n");

  return `${crlf.replace(/(^|\r\n)\./g, "$1..")}\r\n.\r\n`;
}

/** Quita la cabecera `Bcc:` (con sus líneas de continuación): por SMTP los destinatarios van en RCPT. */
export function sinBcc(mensaje: string) {
  const corte = mensaje.indexOf("\r\n\r\n");

  const cabeceras = corte >= 0 ? mensaje.slice(0, corte) : mensaje;

  const limpias = cabeceras.replace(/^Bcc:.*(?:\r\n[ \t].*)*\r\n/im, "");

  return corte >= 0 ? limpias + mensaje.slice(corte) : limpias;
}

/**
 * Entrega un mensaje ya escrito.
 *
 * `destinatarios` son los sobres (RCPT TO): los de la copia oculta más la
 * propia cuenta, que va en `To:` y se queda copia de lo que salió, igual que
 * por la API.
 *
 * Devuelve la línea final de Gmail (`250 2.0.0 OK … gsmtp`).
 */
export async function enviaSmtp(config: ConfigSmtp, destinatarios: string[], mensaje: string) {
  if (!config.seguro && !/^(localhost|127\.0\.0\.1|::1)$/.test(config.host)) {
    throw new FalloSmtp("SMTP sin TLS sólo se admite contra localhost: la contraseña viajaría en claro.");
  }

  const socket: net.Socket = config.seguro
    ? tls.connect({ host: config.host, port: config.puerto, servername: config.host })
    : net.connect({ host: config.host, port: config.puerto });

  socket.setTimeout(120_000);

  let buffer = "";
  let lineas: string[] = [];
  let esperando: { resuelve: (r: { codigo: number; texto: string }) => void; falla: (e: Error) => void } | null = null;
  const listas: { codigo: number; texto: string }[] = [];
  let roto: Error | null = null;

  const entrega = (respuesta: { codigo: number; texto: string }) => {
    if (esperando) {
      const uno = esperando;
      esperando = null;
      uno.resuelve(respuesta);
    } else listas.push(respuesta);
  };

  socket.setEncoding("utf8");

  socket.on("data", (trozo: string) => {
    buffer += trozo;

    let salto: number;

    while ((salto = buffer.indexOf("\n")) >= 0) {
      const linea = buffer.slice(0, salto).replace(/\r$/, "");
      buffer = buffer.slice(salto + 1);
      lineas.push(linea);

      /* «250-…» sigue; «250 …» (con espacio, o sólo el código) cierra la respuesta. */
      if (/^\d{3}(?: |$)/.test(linea)) {
        entrega({ codigo: Number(linea.slice(0, 3)), texto: lineas.map((l) => l.slice(4)).join(" ").trim() });
        lineas = [];
      }
    }
  });

  const rompe = (error: Error) => {
    roto ??= error;

    if (esperando) {
      const uno = esperando;
      esperando = null;
      uno.falla(error);
    }
  };

  socket.on("error", rompe);
  socket.on("timeout", () => {
    rompe(new Error("Gmail (SMTP) no contesta."));
    socket.destroy();
  });
  socket.on("close", () => rompe(new Error("Gmail (SMTP) ha cerrado la conexión.")));

  const respuesta = () =>
    new Promise<{ codigo: number; texto: string }>((resuelve, falla) => {
      const lista = listas.shift();

      if (lista) return resuelve(lista);
      if (roto) return falla(roto);

      esperando = { resuelve, falla };
    });

  const orden = async (linea: string | null, espera: number[], quizaSalio = false) => {
    if (linea !== null) socket.write(linea);

    let r: { codigo: number; texto: string };

    try {
      r = await respuesta();
    } catch (error) {
      throw new FalloSmtp(error instanceof Error ? error.message : String(error), quizaSalio);
    }

    if (!espera.includes(r.codigo)) throw new FalloSmtp(traduce(r.codigo, r.texto), quizaSalio);

    return r;
  };

  try {
    await orden(null, [220]);
    await orden("EHLO castilla.local\r\n", [250]);
    await orden(`AUTH PLAIN ${Buffer.from(`\0${config.usuario}\0${config.clave}`, "utf8").toString("base64")}\r\n`, [235]);
    await orden(`MAIL FROM:<${config.usuario}>\r\n`, [250]);

    for (const una of destinatarios) await orden(`RCPT TO:<${una}>\r\n`, [250, 251]);

    await orden("DATA\r\n", [354]);

    /* A partir de aquí el servidor tiene el mensaje entero: si se corta la
       respuesta, puede haber salido, y no se reintenta por otra vía. */
    const final = await orden(cuerpoData(mensaje), [250], true);

    socket.write("QUIT\r\n");

    return final.texto;
  } finally {
    socket.end();
    setTimeout(() => socket.destroy(), 2_000).unref?.();
  }
}
