/**
 * EL SEGUNDO DE CADA GOL EN LOS RESÚMENES DE LA RFEF (16/11/2026).
 *
 *   node scripts/rfef-goles-resumenes.mjs              marca los que faltan (sin pasarse del gratis)
 *   node scripts/rfef-goles-resumenes.mjs --max 20     como mucho 20 vídeos en esta pasada
 *   node scripts/rfef-goles-resumenes.mjs --rehacer ID vuelve a marcar un vídeo
 *
 * Para «ver de seguido todos los goles de los rivales» hace falta saber en qué
 * segundo de cada resumen entra cada gol: la RFEF no lo da (sin capítulos,
 * subtítulos ni reloj; memoria youtube-segundo-exacto). Gemini sí ve un vídeo
 * de YouTube por su enlace: se le pasa el resumen con el marcador y devuelve
 * el segundo, quién marca y una descripción. Probado el 16/11 con Murcia 1-2
 * Alcorcón: los tres goles, en el orden y con los goleadores de Opta.
 *
 * Se guarda en app_documents `rfef:goles-resumenes` → { videos: { <id>: {
 * goles: [{ segundo, equipo, descripcion }], esperados, cuadra, en } } }.
 * Sólo «cuadra» si salen tantos goles como dice el marcador; si no, la
 * pantalla no usa ese vídeo para encadenar (enseña el resumen entero).
 *
 * Gratis: cada resumen son ~75 k tokens; el nivel gratuito de Gemini aguanta
 * ~3 por minuto, así que va de uno en uno con pausa y se para al primer 429
 * (se retoma en la siguiente pasada). Lo lanza el vigía cada noche.
 *
 * Termina con «RESUMEN: …». Códigos: 0 bien · 8 cuota agotada (se sigue
 * mañana) · 1 fallo.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { entorno } = require("./supabase-local.cjs");

for (const [k, v] of Object.entries(entorno() ?? {})) if (!process.env[k]) process.env[k] = v;

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};

const MAX = Number(arg("max") ?? 60);
const REHACER = arg("rehacer");
const SITIO = (process.env.SITIO_PUBLICO || "https://rmcf-castilla.onrender.com").replace(/\/$/, "");
const CLAVE = "rfef:goles-resumenes";
const MODELO = "gemini-2.5-flash";
const PAUSA_MS = 25_000;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function fin(codigo, texto) {
  console.log(`RESUMEN: ${texto}`);
  process.exitCode = codigo;
  setTimeout(() => process.exit(codigo), 300);
  await new Promise(() => {});
}

if (!process.env.GEMINI_API_KEY) await fin(1, "falta GEMINI_API_KEY");
if (!process.env.DATOS_PG_URL) await fin(1, "falta DATOS_PG_URL");

const postgres = require("postgres");
const sql = postgres(process.env.DATOS_PG_URL, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATOS_PG_URL) ? false : "require", prepare: false, onnotice: () => {}, idle_timeout: 20, connect_timeout: 30 });

/* La base de Render corta conexiones (ECONNRESET): cada consulta se reintenta tres veces. */
async function conReintento(fn) {
  for (let n = 1; ; n++) {
    try {
      return await fn();
    } catch (e) {
      if (n >= 3) throw e;
      console.log(`  (base: ${e.code ?? e.message}; reintento ${n})`);
      await espera(5000 * n);
    }
  }
}

const lista = await fetch(`${SITIO}/api/rivals/resumenes`)
  .then((r) => r.json())
  .catch(() => null);

if (!lista?.ok || !Array.isArray(lista.videos)) await fin(1, "no se ha podido leer la lista de resúmenes de la web");

const [fila] = await conReintento(() => sql`select data from app_documents where key = ${CLAVE}`);
const doc = fila?.data ?? { videos: {} };
doc.videos ??= {};

const guarda = async () => {
  doc.actualizado = new Date().toISOString();
  await conReintento(() => sql`insert into app_documents (key, kind, data, updated_at) values (${CLAVE}, ${"rfef"}, ${sql.json(doc)}, date_trunc('milliseconds', now()))
            on conflict (key) do update set data = excluded.data, updated_at = excluded.updated_at`);
};

/* Primero nuestro grupo (son los rivales), y dentro, lo más reciente. */
const NUESTRO_GRUPO = /castilla|murcia|majadahonda|jaen|zaragoza|huesca|europa|villarreal|algeciras|antequera|andreu|cartagena|ibiza|teruel|madrileno|alcorcon|hercules|gimnastic|torremolinos|aguilas/;
const delGrupo = (v) => {
  const d = (t) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  return NUESTRO_GRUPO.test(d(v.local)) && NUESTRO_GRUPO.test(d(v.visitante)) ? 0 : 1;
};
const pendientes = lista.videos
  .filter((v) => (REHACER ? v.id === REHACER : !doc.videos[v.id] || (!doc.videos[v.id].cuadra && !doc.videos[v.id].reintentado)))
  .sort((a, b) => delGrupo(a) - delGrupo(b) || b.jornada - a.jornada)
  .slice(0, MAX);

let hechos = 0;
let cuadran = 0;

for (const v of pendientes) {
  const esperados = v.golesLocal + v.golesVisitante;

  if (esperados === 0) {
    doc.videos[v.id] = { goles: [], esperados: 0, cuadra: true, en: new Date().toISOString() };
    hechos++;
    cuadran++;
    continue;
  }

  const pregunta = async (extra) => {
  const prompt = extra + `Es el resumen oficial de un partido de fútbol: ${v.local} ${v.golesLocal}-${v.golesVisitante} ${v.visitante}. Localiza CADA gol del partido en el vídeo (deberían ser ${esperados}). Para cada gol da el segundo del vídeo en que el balón entra en la portería (la primera vez que se ve, no la repetición), el equipo que marca tal y como aparece en el marcador del título, y una descripción en español de unas 8 palabras con el goleador si se entiende. Si una repetición vuelve a enseñar el mismo gol, no lo cuentes dos veces. Responde SOLO JSON: {"goles":[{"segundo":n,"equipo":"...","descripcion":"..."}]}`;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ file_data: { file_uri: `https://www.youtube.com/watch?v=${v.id}` } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: e.message } }) }));

  const j = await r.json().catch(() => ({}));

  return { r, j };
  };

  let { r, j } = await pregunta("");

  if (r.status === 429) {
    await guarda();
    await sql.end();
    await fin(8, `cuota de Gemini agotada tras ${hechos} vídeos (${cuadran} cuadran); se sigue en la próxima pasada`);
  }

  if (!r.ok) {
    console.log(`  ${v.id} (${v.local} - ${v.visitante}): ${j?.error?.message ?? r.status}`);
    await espera(PAUSA_MS);
    continue;
  }

  let goles = lee(j);

  function lee(j) {
  try {
    return (JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}").goles ?? [])
      .filter((g) => Number.isFinite(Number(g.segundo)))
      .map((g) => ({ segundo: Math.round(Number(g.segundo)), equipo: String(g.equipo ?? ""), descripcion: String(g.descripcion ?? "") }))
      .filter((g) => !v.segundos || g.segundo <= v.segundos)
      .sort((a, b) => a.segundo - b.segundo);
  } catch {
    return [];
  }
  }

  let cuadra = goles.length === esperados;

  /* Un segundo intento si no cuadra: que repase el vídeo entero. */
  if (!cuadra && r.ok) {
    await espera(PAUSA_MS);
    ({ r, j } = await pregunta(`Ojo: en un primer repaso salieron ${goles.length} goles y el marcador final suma ${esperados}. Revisa TODO el vídeo hasta el final, incluidos goles de penalti y en propia puerta. `));
    if (r.status === 429) {
      await guarda();
      await sql.end();
      await fin(8, `cuota de Gemini agotada tras ${hechos} vídeos (${cuadran} cuadran); se sigue en la próxima pasada`);
    }
    const otra = r.ok ? lee(j) : [];

    if (Math.abs(otra.length - esperados) < Math.abs(goles.length - esperados)) goles = otra;
    cuadra = goles.length === esperados;
  }

  doc.videos[v.id] = { goles, esperados, cuadra, reintentado: true, en: new Date().toISOString() };
  hechos++;
  if (cuadra) cuadran++;
  console.log(`  J${v.jornada} ${v.local} ${v.golesLocal}-${v.golesVisitante} ${v.visitante}: ${goles.length}/${esperados}${cuadra ? "" : " (no cuadra)"}`);

  if (hechos % 5 === 0) await guarda();

  await espera(PAUSA_MS);
}

await guarda();
await sql.end();

const total = Object.keys(doc.videos).length;
const bien = Object.values(doc.videos).filter((x) => x.cuadra).length;

await fin(0, `${hechos} vídeos marcados en esta pasada; en total ${total} de ${lista.videos.length}, ${bien} con todos sus goles`);
