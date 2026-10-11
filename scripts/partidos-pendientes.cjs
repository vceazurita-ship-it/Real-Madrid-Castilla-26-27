/**
 * LOS PARTIDOS QUE FALTAN EN LOS DATOS DE WYSCOUT, Y EL CORREO QUE LO DICE (11/10/2026).
 *
 * Cruza el calendario del Castilla (BeSoccer, `castilla:calendario`) con
 * `public/data/analisis.json` y dice qué partidos de jornadas YA JUGADAS no
 * están todavía en Wyscout —normalmente un aplazado que aún no se ha jugado, o
 * que se jugó entre semana y Wyscout no lo ha cargado—. La regla de reparto es
 * la misma que usa DATA (`lib/data-analisis/alcance.ts`, `pendientesWyscout`).
 *
 *   node scripts/partidos-pendientes.cjs --ver      sólo lo dice
 *   node scripts/partidos-pendientes.cjs --json     además, una línea «JSON: [...]» para el vigía
 *   node scripts/partidos-pendientes.cjs --correo   y manda el correo si toca
 *
 * El correo lo manda la cuenta de Google del club (lib/correo/gmail.ts) a
 * `CORREO_AVISOS` (por defecto el del coordinador) y sale:
 *   - «sigue pendiente»: una vez al día mientras falte algo;
 *   - «ya está actualizado»: el día que lo que faltaba entra.
 * Lo que se avisó queda en .cache/partidos-pendientes.json para no repetirse.
 *
 * Lo lanza el vigía (`scripts/vigia.cjs`, `revisionDiaria`) cada mañana;
 * si falta algo pide antes una pasada de Wyscout y manda el correo después.
 * Termina siempre con `RESUMEN: …`.
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

require(path.join(RAIZ, "scripts", "cargador-ts.cjs"));

const { entorno } = require(path.join(RAIZ, "scripts", "supabase-local.cjs"));
const { pendientesWyscout } = require(path.join(RAIZ, "lib", "data-analisis", "alcance.ts"));

const ESTADO = path.join(RAIZ, ".cache", "partidos-pendientes.json");
const DESTINATARIO = process.env.CORREO_AVISOS || "v.ceazurita@gmail.com";

const quiere = (flag) => process.argv.includes(flag);

/** Hoy, con el día de Madrid. */
const hoyMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

const escapa = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fechaCorta = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

function leeEstado() {
  try {
    return JSON.parse(fs.readFileSync(ESTADO, "utf8"));
  } catch {
    return { pendientes: [], avisadoEl: "" };
  }
}

function guardaEstado(estado) {
  fs.mkdirSync(path.dirname(ESTADO), { recursive: true });
  fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2), "utf8");
}

const claveDe = (p) => `J${p.jornada} · ${p.partido ?? p.faltan.join(", ")}`;

async function calendario(env) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/app_documents?key=eq.castilla:calendario&select=data`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });

  if (!r.ok) throw new Error(`Supabase ${r.status} al leer el calendario`);

  const filas = await r.json();

  return filas[0]?.data?.partidos ?? [];
}

async function manda(asunto, titulo, lineas, pie) {
  const { envia } = require(path.join(RAIZ, "lib", "correo", "gmail.ts"));

  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0B0F14;font-size:14px;line-height:1.5">
<p style="margin:0 0 4px;font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#8A6A2C">Real Madrid Castilla · Plataforma Integral</p>
<h2 style="margin:0 0 12px">${escapa(titulo)}</h2>
<ul style="padding-left:18px">${lineas.map((l) => `<li style="margin:2px 0">${escapa(l)}</li>`).join("")}</ul>
<p style="margin-top:16px;color:#777;font-size:12px">${escapa(pie)}</p>
</body></html>`;

  await envia({ para: [DESTINATARIO], asunto, html, texto: [titulo, "", ...lineas.map((l) => `· ${l}`), "", pie].join("\n") });
}

(async () => {
  const env = entorno();

  if (!env) throw new Error("Faltan las llaves de Supabase en .env.local");

  Object.assign(process.env, env);

  const indice = JSON.parse(fs.readFileSync(path.join(RAIZ, "public", "data", "analisis.json"), "utf8"));
  const cal = await calendario(env);
  const hoy = hoyMadrid();

  /* La jornada que se está jugando este fin de semana no está pendiente: su
     ventana sigue abierta y Wyscout la va cargando. Sólo las ya cerradas. */
  const pendientes = pendientesWyscout(indice.partidos ?? [], cal, hoy).filter((p) => !p.abierta);
  const claves = pendientes.map(claveDe);

  for (const p of pendientes) {
    console.log(`J${p.jornada} (${fechaCorta(p.fecha)}): falta ${p.partido ?? p.faltan.join(", ")}${p.abierta ? " · la jornada aún puede tener partidos por jugar" : ""}`);
  }

  if (quiere("--json")) console.log(`JSON: ${JSON.stringify(claves)}`);

  const estado = leeEstado();
  const resueltos = (estado.pendientes ?? []).filter((c) => !claves.includes(c));

  if (quiere("--correo")) {
    const pie = "Revisión diaria del ordenador del club. La regla: una jornada ya jugada está completa cuando los 20 equipos del grupo tienen su partido en Wyscout; un aplazado se coloca en su jornada en cuanto se juega y Wyscout lo carga.";

    if (resueltos.length) {
      await manda(
        "Datos de Wyscout: ya está actualizado lo que faltaba",
        "Ya está actualizado",
        [...resueltos.map((c) => `${c}: ya está en los datos.`), ...(claves.length ? [`Sigue pendiente: ${claves.join(" · ")}.`] : [])],
        pie,
      );
      console.log(`correo enviado a ${DESTINATARIO}: ya está actualizado (${resueltos.join("; ")})`);
      estado.avisadoEl = hoy;
    } else if (claves.length && estado.avisadoEl !== hoy) {
      await manda(
        `Datos de Wyscout: ${claves.length === 1 ? "sigue pendiente un partido" : `siguen pendientes ${claves.length} partidos`}`,
        claves.length === 1 ? "Sigue pendiente un partido" : `Siguen pendientes ${claves.length} partidos`,
        pendientes.map((p) => `J${p.jornada} (jornada del ${fechaCorta(p.fecha)}): ${p.partido ?? `sin partido ${p.faltan.join(", ")}`}.`),
        `${pie} Se vuelve a mirar mañana; cuando entre, llegará un correo diciendo que ya está.`,
      );
      console.log(`correo enviado a ${DESTINATARIO}: sigue pendiente`);
      estado.avisadoEl = hoy;
    } else {
      console.log(claves.length ? "hoy ya se avisó" : "nada pendiente y nada nuevo que contar: sin correo");
    }

    guardaEstado({ pendientes: claves, avisadoEl: estado.avisadoEl ?? "" });
  }

  console.log(
    `RESUMEN: ${claves.length ? `${claves.length === 1 ? "pendiente" : "pendientes"} ${claves.join(" · ")}` : "todas las jornadas jugadas están completas en Wyscout"}${resueltos.length ? ` · ya ha entrado ${resueltos.join(" · ")}` : ""}`,
  );
})().catch((error) => {
  console.error(`RESUMEN: no se ha podido revisar (${error.message})`);
  process.exitCode = 1;
});
