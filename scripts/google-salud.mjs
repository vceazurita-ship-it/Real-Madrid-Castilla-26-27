/*
|--------------------------------------------------------------------------
| ¿SIGUE VIVA LA CONEXIÓN CON GOOGLE?  (02/11/2026)
|--------------------------------------------------------------------------
|
|   node scripts/google-salud.mjs [--seco] [--forzar]
|
| Canjea el `refresh_token` de la cuenta del club (correo y YouTube) como haría
| un envío, SIN mandar nada, y mira que traiga todos los permisos
| (`lib/correo/salud-google.ts`). Si se ha caído, avisa por correo en el acto
| —por SMTP con la contraseña de aplicación, que no depende de ese permiso—
| con el enlace para volver a conectar. Así el aviso llega cuando cae, no
| cuando alguien intenta mandar un informe.
|
| Lo lanza el vigía del ordenador del club (scripts/vigia.cjs) cada pocas
| horas. Usar el token a diario tiene otro efecto: Google no lo da por
| abandonado (caducan a los seis meses sin uso).
|
| Sólo lee: no escribe en Supabase ni en la hoja. El único rastro es el sello
| .cache/google-salud.json, para no repetir el correo: sale al caer y, si sigue
| caída, como mucho una vez al día.
|
|   --seco     dice qué mandaría y no lo manda.
|   --forzar   lo manda aunque ya se haya avisado hoy.
|
| Para: AVISO_GOOGLE_PARA (.env.local) o, si no está, el analista.
|
| Termina con «RESUMEN: …». Código 0 bien, 3 caída (avisado o no), 1 fallo.
*/

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");

const { RAIZ, entorno, salir } = require("./supabase-local.cjs");

const URL_APP = "https://rmcf-castilla.onrender.com";

const args = process.argv.slice(2);
const seco = args.includes("--seco");
const forzar = args.includes("--forzar");

const SELLO = path.join(RAIZ, ".cache", "google-salud.json");

const DIA_MS = 24 * 3_600_000;

const env = entorno();

if (!env) {
  console.log("  RESUMEN: faltan las llaves de Supabase (.env.local); no se ha mirado nada.");
  salir(1);
} else {
  for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

  try {
    salir(await principal());
  } catch (e) {
    console.log(`  RESUMEN: no se ha podido comprobar Google: ${e instanceof Error ? e.message : String(e)}`);
    salir(1);
  }
}

function leeSello() {
  try {
    return JSON.parse(fs.readFileSync(SELLO, "utf8"));
  } catch {
    return {};
  }
}

function guardaSello(sello) {
  fs.mkdirSync(path.dirname(SELLO), { recursive: true });
  fs.writeFileSync(SELLO, JSON.stringify(sello, null, 2));
}

async function principal() {
  const { compruebaGoogle } = require("../lib/correo/salud-google.ts");

  const salud = await compruebaGoogle();

  const antes = leeSello();

  const ahora = Date.now();

  if (!salud.hayQueReconectar) {
    if (!seco) guardaSello({ estado: salud.estado, comprobadoEn: salud.comprobadoEn, avisadoEn: "" });

    /* «fallo» es un corte de red: ni se avisa ni se da por caída. */
    console.log(`  RESUMEN: Google ${salud.estado === "ok" ? "bien" : salud.estado}: ${salud.motivo}`);

    return salud.estado === "fallo" ? 1 : 0;
  }

  const yaAvisado = antes.estado === salud.estado && antes.avisadoEn && ahora - Date.parse(antes.avisadoEn) < DIA_MS;

  if (yaAvisado && !forzar) {
    console.log(`  RESUMEN: Google sigue caído (${salud.estado}); ya se avisó el ${antes.avisadoEn}.`);

    return 3;
  }

  const para = String(process.env.AVISO_GOOGLE_PARA ?? "").trim() || "v.ceazurita@gmail.com";

  const enlace = `${URL_APP}/api/youtube/conectar`;

  const asunto = "Hay que volver a conectar Google (correo y YouTube)";

  const texto = [
    salud.motivo,
    salud.correoPorSmtp
      ? "Mientras tanto, los correos salen por la contraseña de aplicación; lo que no va es la subida a YouTube."
      : "Mientras tanto no salen los correos de los informes por la API ni se suben vídeos a YouTube.",
    `Para arreglarlo, un clic con la cuenta del club: ${enlace}`,
    `Comprobado por el ordenador del club el ${new Date(ahora).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}.`,
  ].join("\n\n");

  if (seco) {
    console.log(`Para:   ${para}\nAsunto: ${asunto}\n\n${texto}\n`);
    console.log(`  RESUMEN: Google caído (${salud.estado}); en seco, no se manda nada.`);

    return 3;
  }

  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">` +
    texto
      .split("\n\n")
      .map((p) => `<p>${esc(p)}</p>`)
      .join("") +
    `<p><a href="${enlace}" style="display:inline-block;padding:10px 16px;background:#d4a017;color:#000;border-radius:8px;text-decoration:none;font-weight:bold">Volver a conectar Google</a></p></div>`;

  const { envia } = require("../lib/correo/gmail.ts");

  try {
    const { via } = await envia({ para: [para], asunto, html, texto });

    guardaSello({ estado: salud.estado, comprobadoEn: salud.comprobadoEn, avisadoEn: new Date(ahora).toISOString() });

    console.log(`  RESUMEN: Google caído (${salud.estado}); avisado a ${para} por ${via === "smtp" ? "SMTP" : "la API"}.`);
  } catch (e) {
    /* Sin SMTP configurado y con el permiso caído, el correo no puede salir: queda el aviso de la portada. */
    console.log(
      `  RESUMEN: Google caído (${salud.estado}); el correo de aviso no ha salido (${e instanceof Error ? e.message : String(e)}). ` +
        "Pon GMAIL_SMTP_USER y GMAIL_APP_PASSWORD en .env.local para que estos avisos lleguen.",
    );
  }

  return 3;
}
