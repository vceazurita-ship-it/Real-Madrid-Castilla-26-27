/*
|--------------------------------------------------------------------------
| CORREO DE LAS 7:00: LO QUE QUEDÓ SIN HACER EN «MIS TAREAS»  (31/10/2026)
|--------------------------------------------------------------------------
|
|   node scripts/tareas-pendientes-correo.mjs [--seco] [--forzar] [--hoy AAAA-MM-DD]
|
| Lee «Mis tareas» (documentos `agenda:responsabilidades` y `agenda:mis-tareas`
| de Supabase), el calendario del Castilla y los días con sesión de la hoja de
| registro de tareas, y cuenta lo que quedó sin hacer de días anteriores con
| la MISMA función que el aviso de la app (`pendientesAnteriores`). Si hay
| algo, manda el correo desde la cuenta del club con scripts/aviso-correo.mjs.
|
| Sólo lee: no escribe nada en Supabase ni en la hoja.
|
|   --seco     imprime el correo y no lo manda.
|   --forzar   lo manda aunque hoy ya se haya mandado.
|   --hoy      hace como si fuera ese día (para probar).
|
| Lo lanza cada mañana a las 7:00 la tarea «RMCF Castilla - Tareas pendientes»
| (scripts/instalar-tarea-tareas-pendientes.cmd). Un sello por día en
| .cache/tareas-pendientes evita que salga dos veces si la tarea se repite.
|
| Termina con «RESUMEN: …». Código 0 enviado o nada que enviar, 1 fallo.
*/

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./cargador-ts.cjs");

const { RAIZ, entorno, salir } = require("./supabase-local.cjs");

const PARA = "v.ceazurita@gmail.com";
const URL_APP = "https://real-madrid-castilla-26-27.vercel.app/?tareas=1";

const args = process.argv.slice(2);
const seco = args.includes("--seco");
const forzar = args.includes("--forzar");
const iHoy = args.indexOf("--hoy");

const hoy = iHoy >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(args[iHoy + 1] ?? "") ? args[iHoy + 1] : new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

const SELLOS = path.join(RAIZ, ".cache", "tareas-pendientes");
const sello = path.join(SELLOS, `enviado-${hoy}.txt`);

const env = entorno();

if (!env) {
  console.log("  RESUMEN: faltan las llaves de Supabase (.env.local); no se ha mirado nada.");
  salir(1);
} else {
  try {
    await principal();
  } catch (e) {
    console.log(`  RESUMEN: fallo al preparar el correo de tareas: ${e instanceof Error ? e.message : String(e)}`);
    salir(1);
  }
}

async function doc(clave) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/app_documents?key=eq.${encodeURIComponent(clave)}&select=data`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });

  if (!r.ok) throw new Error(`Supabase ${r.status} al leer ${clave}`);

  const filas = await r.json();

  return filas[0]?.data ?? null;
}

async function principal() {
  if (!forzar && !seco && fs.existsSync(sello)) {
    console.log(`  RESUMEN: el correo de hoy (${hoy}) ya salió.`);
    salir(0);

    return;
  }

  const m = require("../lib/portada/mis-tareas.ts");

  const [calendario, hechas, propias] = await Promise.all([doc("castilla:calendario"), doc(m.CLAVE_HECHAS), doc(m.CLAVE_PROPIAS)]);

  const partidos = calendario?.partidos ?? [];

  if (!partidos.length) throw new Error("el calendario del Castilla no ha llegado");

  /* Los días con sesión; si la hoja no contesta, se supone la semana de siempre (como en la app). */
  let sesiones = null;

  try {
    const { loadRegistro } = require("../lib/abp/registro.ts");

    sesiones = m.sesionesDeRegistro((await loadRegistro()).tareas);
  } catch (e) {
    console.log(`Hoja de registro sin leer (${e instanceof Error ? e.message : e}): se supone la semana de siempre.`);
  }

  const pendientes = m.pendientesAnteriores({
    partidos,
    hoy,
    hechas: hechas && typeof hechas === "object" ? hechas : {},
    doc: m.normalizaPropias(propias),
    sesiones,
  });

  if (!pendientes.length) {
    console.log(`  RESUMEN: ${hoy}: nada pendiente de días anteriores; no se manda correo.`);
    salir(0);

    return;
  }

  const n = pendientes.length;

  const asunto = n === 1 ? "Mis tareas: queda 1 sin hacer de días anteriores" : `Mis tareas: quedan ${n} sin hacer de días anteriores`;

  const porDia = new Map();

  for (const t of pendientes) {
    if (!porDia.has(t.fecha)) porDia.set(t.fecha, []);

    porDia.get(t.fecha).push(t);
  }

  const bloques = [...porDia].map(([fecha, lista]) =>
    [m.rotuloDia(fecha), ...lista.map((t) => `· ${t.texto}${t.prioridad === "alta" ? " (prioridad alta)" : ""}`)].join("\n"),
  );

  const texto = [
    `Buenos días. ${n === 1 ? "Sigue sin marcar esta tarea" : `Siguen sin marcar estas ${n} tareas`} de «Mis tareas»:`,
    ...bloques,
    `Para marcarlas como hechas o pasarlas a hoy: ${URL_APP}`,
  ].join("\n\n");

  if (seco) {
    console.log("--- EN SECO: no se manda nada ---");
    console.log(`Para:   ${PARA}`);
    console.log(`Asunto: ${asunto}`);
    console.log("");
    console.log(texto);
    console.log("");
    console.log(`  RESUMEN: ${hoy}: ${n} pendientes; correo preparado en seco, sin enviar.`);
    salir(0);

    return;
  }

  const envio = spawnSync(process.execPath, [path.join(RAIZ, "scripts", "aviso-correo.mjs"), PARA, asunto, texto], { cwd: RAIZ, encoding: "utf8" });

  process.stdout.write(envio.stdout ?? "");
  process.stderr.write(envio.stderr ?? "");

  if (envio.status !== 0) {
    console.log(`  RESUMEN: ${hoy}: ${n} pendientes, pero el correo NO ha salido (código ${envio.status}).`);
    salir(1);

    return;
  }

  fs.mkdirSync(SELLOS, { recursive: true });
  fs.writeFileSync(sello, `${new Date().toISOString()} · ${n} pendientes\n`, "utf8");

  for (const viejo of fs.readdirSync(SELLOS).filter((f) => f.startsWith("enviado-")).sort().slice(0, -15)) fs.rmSync(path.join(SELLOS, viejo), { force: true });

  console.log(`  RESUMEN: ${hoy}: correo enviado a ${PARA} con ${n} pendientes.`);
  salir(0);
}
