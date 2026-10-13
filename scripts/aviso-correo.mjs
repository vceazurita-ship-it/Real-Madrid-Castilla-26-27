/*
|--------------------------------------------------------------------------
| UN AVISO POR CORREO DESDE LA CUENTA DEL CLUB
|--------------------------------------------------------------------------
|
|   node scripts/aviso-correo.mjs <para> "<asunto>" "<texto>" [adjunto]
|
| Sale por la misma cuenta de Google del club que los informes
| (`lib/correo/gmail.ts`). El texto admite saltos de línea; cada párrafo va
| en su <p>.
*/

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");

const { entorno } = require("./supabase-local.cjs");

/* El cuarto, opcional: un fichero que va adjunto (un vídeo, un PDF). */
const [para, asunto, texto, adjunto] = process.argv.slice(2);

if (!para || !asunto || !texto) {
  console.log('Uso: node scripts/aviso-correo.mjs <para> "<asunto>" "<texto>"');
  process.exit(2);
}

for (const [k, v] of Object.entries(entorno() ?? {})) process.env[k] ??= v;

const { envia } = require("../lib/correo/gmail.ts");
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const parrafos = texto.split(/\n\s*\n|\n\n/).map((p) => p.trim()).filter(Boolean);

await envia({
  para: [para],
  asunto,
  html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">${parrafos.map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}</div>`,
  texto: parrafos.join("\n\n"),
  adjuntos: adjunto
    ? [{ nombre: path.basename(adjunto), tipo: /\.mp4$/i.test(adjunto) ? "video/mp4" : /\.pdf$/i.test(adjunto) ? "application/pdf" : "application/octet-stream", base64: fs.readFileSync(adjunto).toString("base64") }]
    : undefined,
});

console.log(`enviado a ${para}: ${asunto}`);
