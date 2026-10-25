/**
 * LO MEJOR A BALÓN PARADO DE CADA JORNADA, EN UN JSON PEQUEÑO (25/10/2026)
 *
 * `scripts/wyscout-abp-acciones.mjs` deja en `.cache/wyscout/abp-acciones/`
 * los remates y los saques de cada partido de la temporada (Primera RFEF,
 * LaLiga EA Sports, Segunda, Premier y Champions), tal y como los da Wyscout. Esto los convierte
 * en acciones a balón parado —córner, falta, falta directa, saque de banda
 * largo y penalti que acaban en remate— y, por competición y jornada, se queda
 * con las cinco mejores: primero los goles (los de penalti detrás de los
 * demás), luego por xG y, a igualdad, el remate a puerta.
 *
 *   node scripts/abp-acciones.cjs
 *
 * Sale `public/data/abp-acciones.json`, que lee /laboratorio/abp («Lo mejor de
 * cada jornada»). Lo que no consta no se escribe: una acción sin lanzador
 * conocido no lleva `lz`, sin xG no lleva `xg`, sin coordenadas no lleva
 * puntos.
 *
 * Igual que `abp-ligas.cjs`: si la carpeta no está (Vercel), se conserva el
 * JSON anterior; una competición sin carpeta se queda como estaba. Y no tumba
 * la compilación si algo falla.
 *
 * EL VÍDEO (25/10/2026). `scripts/abp-videos-youtube.mjs` deja en
 * `.cache/abp-videos/<fuente>/<id>.json` el resumen oficial de YouTube de cada
 * partido. Cada competición lleva `videos` (id del partido → vídeo y canal) y
 * una acción lleva `vt` (segundo del resumen) sólo si una marca del vídeo
 * —capítulo o línea con minuto de la descripción— la nombra sin duda. Sin
 * resumen, el partido no sale en `videos` y la tarjeta no enseña el botón.
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

/* La caché de Wyscout vive en el repositorio principal; en un worktree se apunta con ABP_CACHE_RAIZ. */
const RAIZ_CACHE = process.env.ABP_CACHE_RAIZ || RAIZ;

const ORIGEN = path.join(RAIZ_CACHE, ".cache", "wyscout", "abp-acciones");

const VIDEOS = path.join(RAIZ_CACHE, ".cache", "abp-videos");

const SALIDA = path.join(RAIZ, "public", "data", "abp-acciones.json");

/** TODAS las acciones (para «Patrones que más rinden»), en un JSON aparte que sólo se pide al abrir esa vista. */
const SALIDA_TODAS = path.join(RAIZ, "public", "data", "abp-acciones-todas.json");

/** Cuántas por jornada. */
const TOP = 5;

/** Las competiciones de la pantalla, en este orden, y de qué carpeta sale cada una. */
const COMPETICIONES = [
  { slug: "primera-rfef-g2", nombre: "Primera RFEF · Grupo 2", corto: "1.ª RFEF G2", fuente: "primera-rfef", grupo: "primera-rfef-g2" },
  { slug: "primera-rfef-g1", nombre: "Primera RFEF · Grupo 1", corto: "1.ª RFEF G1", fuente: "primera-rfef", grupo: "primera-rfef-g1" },
  { slug: "laliga", nombre: "LaLiga EA Sports", corto: "LaLiga", fuente: "laliga" },
  { slug: "segunda", nombre: "Segunda División", corto: "LaLiga Hypermotion", fuente: "segunda" },
  { slug: "premier-league", nombre: "Premier League", corto: "Premier", fuente: "premier-league" },
  { slug: "champions", nombre: "UEFA Champions League", corto: "Champions", fuente: "champions" },
];

/* --------------------------- UNA ACCIÓN --------------------------- */

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** El tipo de saque que busca cada clase de acción entre los eventos de ABP. */
const SAQUE = { corner: "corner", falta: "any_free_kick", banda: "throw_in" };

/** De qué clase es un remate a balón parado (o null si no lo es). */
function tipoDe(tiro) {
  const t = new Set(tiro.types || []);

  if (t.has("penalty")) return "penalti";

  if (t.has("free_kick_shot") || t.has("direct_free_kick")) return "directa";

  if (t.has("shot_after_corner")) return "corner";

  if (t.has("shot_after_free_kick")) return "falta";

  if (t.has("shot_after_throw_in")) return "banda";

  /*
  | Wyscout sólo marca «shot_after_…» cuando el remate llega enseguida. Un
  | córner en corto o una falta lateral que acaba en remate a los diez
  | segundos se reconoce por la posesión: empezó en ese saque y no hace mucho.
  */
  const primero = tiro.possession && tiro.possession.firstEvent;

  if (!primero || !Array.isArray(primero.types) || tiro.eventSec - primero.eventSec > 25) return null;

  if (primero.types.includes("corner")) return "corner";

  if (primero.types.includes("any_free_kick")) return "falta";

  if (primero.types.includes("throw_in")) return "banda";

  return null;
}

function resultadoDe(tiro) {
  const t = new Set(tiro.types || []);

  if (t.has("goal")) return "gol";

  if (t.has("shot_on_post")) return "palo";

  if (t.has("shot_on_goal")) return "puerta";

  if (t.has("blocked_shot")) return "bloqueado";

  return "fuera";
}

/** El saque del que sale el remate: el último de su clase, del mismo equipo, en los 30 s de antes. */
function saqueDe(tiro, tipo, saques) {
  if (tipo === "penalti" || tipo === "directa") return tiro;

  const clase = SAQUE[tipo];

  const primero = tiro.possession && tiro.possession.firstEvent;

  const candidatos = saques.filter(
    (s) =>
      (s.types || []).includes(clase) &&
      s.teamId === tiro.teamId &&
      s.half === tiro.half &&
      s.eventSec <= tiro.eventSec + 0.5 &&
      tiro.eventSec - s.eventSec <= 30,
  );

  /* Si la posesión dice cuál fue, ése. */
  const exacto = primero && candidatos.find((s) => String(s.id) === String(primero.id));

  if (exacto) return exacto;

  return candidatos.sort((a, b) => b.eventSec - a.eventSec)[0] || null;
}

const nombre = (e) => (e && e.player && e.player.shortName ? String(e.player.shortName).trim() : "");

/** Un punto de Wyscout (0-100) que valga: 0,0 es «no consta». */
const punto = (x, y) => (Number.isFinite(x) && Number.isFinite(y) && !(x === 0 && y === 0) ? [r1(x), r1(y)] : null);

/** Donde cae un saque: además, 100,100 es «fue a portería» (el final de un tiro), no un sitio. */
const caidaDe = (x, y) => (x === 100 && y === 100 ? null : punto(x, y));

function accionesDe(partido) {
  const tiros = Array.isArray(partido.tiros) ? partido.tiros : [];

  const saques = Array.isArray(partido.abp) ? partido.abp : [];

  const info = partido.partido || {};

  const equipos = new Map([info.teamA, info.teamB].filter(Boolean).map((e) => [Number(e.id), e.name]));

  const acciones = [];

  for (const tiro of tiros) {
    const tipo = tipoDe(tiro);

    if (!tipo) continue;

    const saque = saqueDe(tiro, tipo, saques);

    const marcado = new Set(tiro.types || []);

    const deWyscout = marcado.has("shot_after_corner") || marcado.has("shot_after_free_kick") || marcado.has("shot_after_throw_in");

    /* Una falta en su campo que acaba en remate es una jugada, no un balón parado. */
    if (tipo === "falta" && saque && saque !== tiro && saque.x < 55 && !deWyscout) continue;

    /*
    | Banda: sólo los saques LARGOS (los que caen dentro del área o pasan de
    | 25 m). Sin el saque delante no se puede saber, y no se cuenta.
    */
    if (tipo === "banda" && (!saque || !((saque.rX >= 83 && saque.rY > 18 && saque.rY < 82) || saque.length >= 25))) continue;

    const a = {
      t: tipo,
      r: resultadoDe(tiro),
      min: tiro.minute,
      seg: Math.round(tiro.eventSec),
      parte: tiro.half,
    };

    const equipo = equipos.get(Number(tiro.teamId));

    if (equipo) a.eq = equipo;

    const rival = [...equipos].find(([id]) => id !== Number(tiro.teamId));

    if (rival) a.rival = rival[1];

    const rm = nombre(tiro);

    if (rm) a.rm = rm;

    const lz = saque && saque !== tiro ? nombre(saque) : "";

    if (lz && lz !== rm) a.lz = lz;

    if (Number.isFinite(tiro.xg) && tiro.xg > 0) a.xg = r3(tiro.xg);

    if (marcado.has("head_shot") || tiro.bodyPart === "head") a.cabeza = true;

    if (saque) {
      const s = punto(saque.x, saque.y);

      if (s) a.saque = s;

      if (saque !== tiro) {
        const c = caidaDe(saque.rX, saque.rY);

        if (c) a.caida = c;

        const tras = Math.round(tiro.eventSec - saque.eventSec);

        if (tras > 0) a.tras = tras;
      }
    }

    const rem = punto(tiro.x, tiro.y);

    if (rem) a.remate = rem;

    acciones.push(a);
  }

  return acciones;
}

/* ---------------------------- EL VÍDEO ---------------------------- */

const plano = (s) =>
  ` ${String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim()} `;

/** El apellido con el que se reconoce a un jugador en un texto («B. Saka» → «saka»). */
const apellido = (nombreCorto) => {
  const partes = plano(nombreCorto).trim().replace(/'/g, "").split(" ").filter((p) => p.length >= 4);

  return partes.length ? partes[partes.length - 1] : "";
};

/*
| El segundo del resumen en el que está la acción, sólo si una marca la nombra
| sin duda: por su minuto («23'», «min 23»), o —si es gol— por el goleador
| cuando ése sólo marcó uno en el partido. Dos marcas posibles = ninguna.
*/
function segundoDe(a, marcas, accionesDelPartido) {
  if (!Array.isArray(marcas) || !marcas.length) return null;

  const porMinuto = marcas.filter(([, texto]) => new RegExp(`(^|[^0-9])${a.min}(\\+\\d+)?'|\\bmin\\.? ?${a.min}\\b|\\bminuto ${a.min}\\b`, "i").test(texto));

  if (porMinuto.length === 1) return porMinuto[0][0];

  if (porMinuto.length > 1 || a.r !== "gol" || !a.rm) return null;

  const ap = apellido(a.rm);

  if (!ap) return null;

  const susGoles = accionesDelPartido.filter((b) => b.r === "gol" && b.rm && apellido(b.rm) === ap).length;

  if (susGoles !== 1) return null;

  const porNombre = marcas.filter(([, texto]) => plano(texto).replace(/'/g, "").includes(` ${ap} `));

  return porNombre.length === 1 ? porNombre[0][0] : null;
}

/* --------------------------- EL RANKING --------------------------- */

/** Goles primero (los de penalti detrás), luego xG, luego a puerta. */
function peso(a) {
  const gol = a.r === "gol" ? (a.t === "penalti" ? 1 : 2) : 0;

  const puerta = a.r === "gol" || a.r === "puerta" || a.r === "palo" ? 1 : 0;

  return [gol, a.xg ?? -1, puerta];
}

function compara(a, b) {
  const pa = peso(a);
  const pb = peso(b);

  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];

  return 0;
}

/* --------------------------- EL TRABAJO --------------------------- */

const leeJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};

function competicion(def) {
  const dir = path.join(ORIGEN, def.fuente);

  if (!fs.existsSync(dir)) return null;

  const grupos = def.grupo ? leeJson(path.join(dir, "_grupos.json")) || {} : null;

  const jornadas = new Map();

  const dirVideos = path.join(VIDEOS, def.fuente);

  /** Id del partido → { v: id de YouTube, c: canal }. */
  const videos = {};

  /** Todas las acciones, con el partido en una tabla aparte. */
  const todas = [];

  const tabla = {};

  let partidos = 0;

  for (const f of fs.readdirSync(dir)) {
    if (!/^\d+\.json$/.test(f)) continue;

    const p = leeJson(path.join(dir, f));

    if (!p || !p.partido) continue;

    if (grupos) {
      const a = grupos[String(p.partido.teamA && p.partido.teamA.id)];

      const b = grupos[String(p.partido.teamB && p.partido.teamB.id)];

      if ((a && a.grupo) !== def.grupo && (b && b.grupo) !== def.grupo) continue;
    }

    partidos++;

    const fecha = String(p.fecha || p.partido.date || "").slice(0, 10);

    const clave = p.jornada ? `j${p.jornada}` : `f${fecha}`;

    if (!jornadas.has(clave)) jornadas.set(clave, { n: p.jornada || null, desde: fecha, hasta: fecha, partidos: 0, acciones: [] });

    const j = jornadas.get(clave);

    j.partidos++;

    if (fecha && fecha < j.desde) j.desde = fecha;

    if (fecha && fecha > j.hasta) j.hasta = fecha;

    const titulo = String(p.partido.name || p.titulo || "").replace(/(\d+):(\d+)\s*$/, "$1-$2");

    const acciones = accionesDe(p);

    const resumen = (leeJson(path.join(dirVideos, `${p.id}.json`)) || {}).video;

    if (resumen && resumen.id) videos[String(p.id)] = { v: resumen.id, c: resumen.canal || "" };

    if (acciones.length) tabla[String(p.id)] = { p: titulo, f: fecha, j: p.jornada ? `Jornada ${p.jornada}` : `Partidos del ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` };

    for (const a of acciones) {
      const vt = resumen ? segundoDe(a, resumen.marcas, acciones) : null;

      j.acciones.push({ ...a, p: titulo, id: String(p.id), fecha, ...(vt !== null ? { vt } : {}) });

      todas.push({ ...a, id: String(p.id), ...(vt !== null ? { vt } : {}) });
    }
  }

  if (!partidos) return null;

  const lista = [...jornadas.values()]
    .sort((a, b) => (a.n ?? 0) - (b.n ?? 0) || a.desde.localeCompare(b.desde))
    .map((j) => {
      const ordenadas = [...j.acciones].sort(compara);

      const porTipo = {};

      for (const a of j.acciones) porTipo[a.t] = (porTipo[a.t] || 0) + 1;

      return {
        n: j.n,
        etiqueta: j.n ? `Jornada ${j.n}` : `Partidos del ${j.desde.slice(8, 10)}/${j.desde.slice(5, 7)}`,
        desde: j.desde,
        hasta: j.hasta,
        partidos: j.partidos,
        acciones: j.acciones.length,
        goles: j.acciones.filter((a) => a.r === "gol").length,
        porTipo,
        top: ordenadas.slice(0, TOP),
      };
    });

  /* Sólo los vídeos de los partidos que salen en algún top: el resto no se enseña. */
  const enTop = new Set(lista.flatMap((j) => j.top.map((a) => a.id)));

  const suyos = Object.fromEntries(Object.entries(videos).filter(([id]) => enTop.has(id)));

  return {
    slug: def.slug,
    nombre: def.nombre,
    corto: def.corto,
    partidos,
    acciones: lista.reduce((s, j) => s + j.acciones, 0),
    goles: lista.reduce((s, j) => s + j.goles, 0),
    conVideo: Object.keys(videos).length,
    jornadas: lista,
    videos: suyos,
    todas: { slug: def.slug, corto: def.corto, nombre: def.nombre, partidos: tabla, videos, acciones: todas },
  };
}

function principal() {
  const anterior = leeJson(SALIDA);

  if (!fs.existsSync(ORIGEN)) {
    console.log("  abp-acciones: no hay carpeta de Wyscout aquí; se deja el JSON como estaba.");

    return;
  }

  const competiciones = [];

  for (const def of COMPETICIONES) {
    const nueva = competicion(def);

    if (nueva) {
      competiciones.push(nueva);

      continue;
    }

    const vieja = anterior && Array.isArray(anterior.competiciones) ? anterior.competiciones.find((c) => c.slug === def.slug) : null;

    if (vieja) competiciones.push(vieja);
  }

  if (!competiciones.length) {
    console.log("  abp-acciones: nada que compactar.");

    return;
  }

  const todasComp = competiciones.map((c) => c.todas).filter(Boolean);

  const anteriorTodas = leeJson(SALIDA_TODAS);

  for (const c of competiciones) delete c.todas;

  /* Una competición sin carpeta conserva sus acciones de antes. */
  for (const def of COMPETICIONES) {
    if (todasComp.some((t) => t.slug === def.slug)) continue;

    const vieja = anteriorTodas && Array.isArray(anteriorTodas.competiciones) ? anteriorTodas.competiciones.find((t) => t.slug === def.slug) : null;

    if (vieja) todasComp.push(vieja);
  }

  todasComp.sort((a, b) => COMPETICIONES.findIndex((d) => d.slug === a.slug) - COMPETICIONES.findIndex((d) => d.slug === b.slug));

  const salida = { generado: new Date().toISOString(), temporada: "2026/2027", competiciones };

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });

  fs.writeFileSync(SALIDA, JSON.stringify(salida), "utf8");

  fs.writeFileSync(SALIDA_TODAS, JSON.stringify({ generado: salida.generado, temporada: salida.temporada, competiciones: todasComp }), "utf8");

  const kb = Math.round(fs.statSync(SALIDA).size / 1024);

  console.log(
    `  abp-acciones: ${competiciones.map((c) => `${c.corto} ${c.partidos} partidos (${c.conVideo ?? 0} con resumen)/${c.acciones} acciones`).join(" · ")} → public/data/abp-acciones.json (${kb} KB)`,
  );
}

try {
  principal();
} catch (error) {
  console.error("  abp-acciones: no se ha podido compactar:", error && error.message);
}
