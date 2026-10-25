#!/usr/bin/env node
/*
|--------------------------------------------------------------------------
| EL VÍDEO DE CADA PARTIDO DE «LO MEJOR DE CADA JORNADA» (25/10/2026)
|--------------------------------------------------------------------------
|
| Cada tarjeta de /laboratorio/abp («Lo mejor de cada jornada») lleva un botón
| «Ver vídeo». Wyscout no sirve: sus clips no tienen dirección (se fabrican al
| vuelo con un POST) y lo único que comparte es un envío interno a otra cuenta
| de Wyscout, que además escribe (comprobado otra vez el 25/10/2026). Así que
| el enlace va al RESUMEN OFICIAL del partido en YouTube.
|
|     node scripts/abp-videos-youtube.mjs                 (todo lo pendiente)
|     node scripts/abp-videos-youtube.mjs --solo=laliga
|     node scripts/abp-videos-youtube.mjs --max=5         (para probar)
|     node scripts/abp-videos-youtube.mjs --reintentar    (otra vez los que no tienen)
|
| CÓMO
|
| Sin API ni cuota: la página de resultados de búsqueda de YouTube
| (`/results?search_query=…`, el `ytInitialData` que trae dentro) y la página
| del vídeo (`ytInitialPlayerResponse`: fecha exacta de publicación, países y
| descripción). Sólo lectura, sin cuenta.
|
| Un vídeo vale si:
|   - el título nombra a LOS DOS equipos y dice que es un resumen
|     («resumen», «highlights», «goles»…), y no es una rueda de prensa,
|     una previa o un partido entero;
|   - lo publica un canal oficial: el de la competición (LALIGA EA SPORTS,
|     LALIGA HYPERMOTION, Premier League, UEFA, la RFEF), el de uno de los dos
|     clubes o, a falta de esos, el de quien tiene los derechos (DAZN,
|     Movistar Plus+, TNT Sports, CBS Sports Golazo, Sky Sports);
|   - se publicó entre el día del partido y siete días después;
|   - se puede ver en España.
|
| EL SEGUNDO EXACTO
|
| Los resúmenes oficiales casi nunca traen capítulos ni minutos en la
| descripción, y los subtítulos automáticos no se dejan leer sin la sesión de
| un navegador. Se guardan las marcas que haya (capítulos o líneas «1:23 …» de
| la descripción) y `abp-acciones.cjs` sólo pone `&t=` si una de ellas nombra
| SIN DUDA la acción (su minuto, o el goleador si sólo marcó uno). Si no, el
| enlace va al resumen entero.
|
| INCREMENTAL
|
| `.cache/abp-videos/<fuente>/<idWyscout>.json`. Un partido con vídeo no se
| vuelve a buscar nunca. Sin vídeo se reintenta mientras el partido tenga
| menos de diez días (los resúmenes de 1.ª RFEF tardan) y como mucho cada seis
| horas; pasado eso se queda como está.
|
| CÓDIGOS DE SALIDA: 0 algo nuevo · 3 nada nuevo · 8 YouTube ha cortado (lo
| que quede se busca en la siguiente pasada) · 1 roto.
*/

import fs from "node:fs";
import path from "node:path";

const RAIZ = path.join(import.meta.dirname, "..");

const ORIGEN = path.join(RAIZ, ".cache", "wyscout", "abp-acciones");

const CARPETA = path.join(RAIZ, ".cache", "abp-videos");

const espera = (ms) => new Promise((listo) => setTimeout(listo, ms));

function argumento(nombre) {
  const crudo = process.argv.find((a) => a.startsWith(`--${nombre}=`));

  return crudo ? crudo.slice(nombre.length + 3).replace(/^"|"$/g, "") || null : null;
}

const SOLO = argumento("solo");
const MAX = Number(argumento("max") ?? 0);
const REHACER = process.argv.includes("--rehacer");

/** Vuelve a buscar los que se quedaron sin resumen (tras mejorar el reconocimiento de nombres). */
const REINTENTAR = process.argv.includes("--reintentar");

/** Las carpetas de `wyscout-abp-acciones.mjs` y en qué idioma se busca primero. */
const FUENTES = [
  { slug: "laliga", palabra: "resumen" },
  { slug: "primera-rfef", palabra: "resumen" },
  { slug: "segunda", palabra: "resumen" },
  { slug: "premier-league", palabra: "highlights" },
  { slug: "champions", palabra: "highlights" },
];

/* ------------------------------------------------------------------ */
/*  NOMBRES                                                            */
/* ------------------------------------------------------------------ */

export const normaliza = (s) =>
  ` ${String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/** Palabras que no distinguen a un equipo. */
const RUIDO = new Set(
  "real club cf fc cd ud sd rc sad afc de la el del los las b ii cyd ad sc ac as fk sk cp sl sv vfl tsg bk if ik nk gnk hnk bsc rcd ca cs cfr pfc united city town sporting athletic deportivo union atletico olympique racing ssc".split(" "),
);

/*
| Lo que los títulos de YouTube llaman de otra manera. Sólo los casos que las
| palabras propias no resuelven (comprobado con los títulos reales).
*/
const ALIAS = {
  "manchester city": ["man city"],
  "manchester united": ["man utd", "man united"],
  "tottenham hotspur": ["spurs", "tottenham"],
  "wolverhampton wanderers": ["wolves"],
  "nottingham forest": ["forest", "nottingham"],
  "brighton hove albion": ["brighton"],
  "west ham united": ["west ham"],
  "newcastle united": ["newcastle"],
  "leeds united": ["leeds"],
  "deportivo la coruna": ["deportivo", "depor", "rc deportivo"],
  "atletico madrid": ["atletico de madrid", "atleti", "atletico"],
  "athletic club": ["athletic", "athletic club"],
  "deportivo alaves": ["alaves"],
  "bayern munchen": ["bayern"],
  "paris saint germain": ["psg", "paris"],
  "internazionale": ["inter"],
  "sporting cp": ["sporting"],
  "sporting gijon": ["sporting", "sporting gijon"],
  "racing santander": ["racing"],
  "racing ferrol": ["racing ferrol", "racing club ferrol"],
  "cultural leonesa": ["leonesa", "cultural"],
  "celta fortuna": ["celta", "fortuna"],
  "real sociedad b": ["real sociedad b", "r sociedad b", "sanse"],
  "real madrid castilla": ["castilla", "real madrid castilla"],
  /* Wyscout llama «Athletic Bilbao» al Bilbao Athletic (el filial). */
  "athletic bilbao": ["bilbao athletic", "athletic club b", "athletic b"],
  "atletico madrid b": ["atletico madrileno", "atl madrileno", "atletico de madrid b", "atletico madrid b"],
  "villarreal b": ["villarreal b", "villarreal cf b"],
  "borussia dortmund": ["dortmund", "bvb"],
  "bodo glimt": ["bodo glimt", "glimt"],
};

/*
| Los filiales no tienen canal propio: su resumen lo sube el del primer equipo
| («Athletic Club», «Atlético de Madrid», «Villarreal CF»…).
*/
const ALIAS_CANAL = {
  "athletic bilbao": ["athletic club"],
  "atletico madrid b": ["atletico de madrid"],
  "villarreal b": ["villarreal cf", "villarreal"],
  "real sociedad b": ["real sociedad"],
  "real madrid castilla": ["real madrid"],
};

/** Cómo reconocer a cada equipo de una competición: en un título (`t`) y como dueño de un canal (`c`). */
function reconocedores(equipos) {
  const tokens = new Map();

  for (const e of equipos) for (const t of new Set(normaliza(e).trim().split(" "))) tokens.set(t, (tokens.get(t) ?? 0) + 1);

  const mapa = new Map();

  for (const e of equipos) {
    const n = normaliza(e).trim();

    const propias = n.split(" ").filter((t) => t.length >= 3 && !RUIDO.has(t) && tokens.get(t) === 1 && !/^\d+$/.test(t));

    const formas = new Set([n, ...propias, ...(ALIAS[n] ?? [])]);

    const filial = / (b|ii)$/.test(` ${n}`);

    /*
    | «Real Sociedad B»: el filial sólo se reconoce con su «B» detrás de una
    | palabra suya («Villarreal CF ‘B’», «R. SOCIEDAD B», «Athletic Club “B”»).
    */
    if (filial) {
      formas.clear();

      formas.add(n);

      for (const a of ALIAS[n] ?? []) formas.add(a);

      const base = n.replace(/ (b|ii)$/, "").split(" ").filter((t) => t.length >= 4 && !RUIDO.has(t));

      for (const t of base) for (const pegote of ["b", "cf b", "club b"]) formas.add(`${t} ${pegote}`);
    }

    const canal = filial || ALIAS_CANAL[n] ? new Set([...(ALIAS_CANAL[n] ?? [])]) : formas;

    mapa.set(e, { t: [...formas].filter(Boolean), c: [...canal].filter(Boolean) });
  }

  return mapa;
}

const nombra = (texto, formas) => {
  const t = normaliza(texto);

  const pegado = t.replace(/ /g, "");

  return formas.some((f) => t.includes(` ${f} `) || (f.length >= 5 && !f.includes(" ") && pegado.includes(f)));
};

/* ------------------------------------------------------------------ */
/*  YOUTUBE                                                            */
/* ------------------------------------------------------------------ */

const CABECERAS = {
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.6",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  Cookie: "CONSENT=YES+1; SOCS=CAI",
};

class Cortado extends Error {}

async function trae(url) {
  for (let intento = 0; intento < 3; intento++) {
    let r;

    try {
      r = await fetch(url, { headers: CABECERAS });
    } catch (error) {
      if (intento === 2) throw error;

      await espera(4000);

      continue;
    }

    if (r.status === 429 || r.url.includes("/sorry/")) throw new Cortado("YouTube ha cortado (429)");

    if (r.ok) return r.text();

    await espera(3000);
  }

  throw new Error(`YouTube no contesta: ${url}`);
}

function jsonDe(html, nombre) {
  const i = html.indexOf(`var ${nombre} = `);

  if (i < 0) return null;

  const desde = i + nombre.length + 7;

  /* El objeto acaba en «};» seguido de «var» o de «</script>». */
  const fin = html.indexOf("};", desde);

  for (let f = fin; f > 0; f = html.indexOf("};", f + 2)) {
    const resto = html.slice(f + 2, f + 12);

    if (!resto.startsWith("var ") && !resto.startsWith("</script")) continue;

    try {
      return JSON.parse(html.slice(desde, f + 1));
    } catch {
      /* el siguiente */
    }
  }

  return null;
}

const duracion = (texto) => String(texto ?? "").split(":").reduce((s, p) => s * 60 + Number(p), 0);

async function busca(consulta) {
  const html = await trae(`https://www.youtube.com/results?search_query=${encodeURIComponent(consulta)}&hl=es&gl=ES`);

  const datos = jsonDe(html, "ytInitialData");

  const lista = [];

  const recorre = (o) => {
    if (!o || typeof o !== "object") return;

    if (o.videoRenderer) {
      const v = o.videoRenderer;

      lista.push({
        id: v.videoId,
        titulo: (v.title?.runs ?? []).map((x) => x.text).join(""),
        canal: v.ownerText?.runs?.[0]?.text ?? "",
        segundos: v.lengthText?.simpleText ? duracion(v.lengthText.simpleText) : 0,
      });

      return;
    }

    for (const k in o) recorre(o[k]);
  };

  recorre(datos);

  return lista.filter((v) => v.id && v.titulo);
}

const aSegundos = (s) => s.split(":").reduce((t, p) => t * 60 + Number(p), 0);

/** Capítulos y líneas «1:23 …» de la descripción: [segundo, texto]. */
function marcasDe(html, descripcion) {
  const marcas = [];

  for (const m of html.matchAll(/"chapterRenderer":\{"title":\{"simpleText":"((?:[^"\\]|\\.)*)"\},"timeRangeStartMillis":(\d+)/g)) {
    marcas.push([Math.round(Number(m[2]) / 1000), JSON.parse(`"${m[1]}"`)]);
  }

  if (!marcas.length) {
    for (const linea of String(descripcion ?? "").split("\n")) {
      const m = /(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s|$)/.exec(linea);

      if (!m) continue;

      const texto = linea.replace(m[1], "").replace(/^[\s\-–|:·]+/, "").trim();

      if (texto) marcas.push([aSegundos(m[1]), texto.slice(0, 120)]);
    }
  }

  return marcas;
}

async function ficha(id) {
  const html = await trae(`https://www.youtube.com/watch?v=${id}&hl=es&gl=ES`);

  const pr = jsonDe(html, "ytInitialPlayerResponse");

  if (!pr) return null;

  const mf = pr.microformat?.playerMicroformatRenderer ?? {};

  const paises = mf.availableCountries ?? [];

  return {
    publicado: mf.publishDate || mf.uploadDate || "",
    canal: pr.videoDetails?.author ?? "",
    titulo: pr.videoDetails?.title ?? "",
    segundos: Number(pr.videoDetails?.lengthSeconds ?? 0),
    enEspana: pr.playabilityStatus?.status === "OK" && (!paises.length || paises.includes("ES")),
    directo: Boolean(pr.videoDetails?.isLiveContent),
    marcas: marcasDe(html, pr.videoDetails?.shortDescription),
  };
}

/* ------------------------------------------------------------------ */
/*  ¿ES EL RESUMEN DE ESTE PARTIDO?                                    */
/* ------------------------------------------------------------------ */

const OFICIALES = [
  /^ laliga( ea sports| hypermotion)? $/,
  /^ premier league $/,
  /^ uefa( champions league)? $/,
  /^ champions league $/,
  /^ real federacion espanola (de )?futbol $/,
  /^ rfef $/,
  /^ primera federacion $/,
];

const DERECHOS = [/^ dazn( futbol| es)? $/, /movistar/, /^ tnt sports( uk)? $/, /^ cbs sports golazo $/, /^ sky sports( football| premier league)? $/];

const ES_RESUMEN = /\b(resumen|highlights?|goles|goals|gols|extended)\b/;

const NO_ES = /\b(rueda de prensa|press conference|previa|preview|entrevista|interview|reaccion|reaction|declaraciones|classic|clasico historico|full match|partido completo|en directo|live|watchalong|podcast|tactical|analisis|analysis|every goal|todos los goles de la temporada|training|entrenamiento|behind the scenes|fans|aficion|matchday vlog)\b/;

/** 1 = el de la competición, 2 = el de un club, 3 = el de quien tiene los derechos, 0 = no vale. */
function nivel(canal, formasA, formasB) {
  const c = normaliza(canal);

  if (OFICIALES.some((re) => re.test(c))) return 1;

  if (nombra(canal, formasA.c) || nombra(canal, formasB.c)) return 2;

  if (DERECHOS.some((re) => re.test(c))) return 3;

  return 0;
}

function candidatos(lista, formasA, formasB) {
  return lista
    .map((v) => ({ ...v, nivel: nivel(v.canal, formasA, formasB) }))
    .filter((v) => {
      const t = normaliza(v.titulo);

      return (
        v.nivel > 0 &&
        nombra(v.titulo, formasA.t) &&
        nombra(v.titulo, formasB.t) &&
        ES_RESUMEN.test(t) &&
        !NO_ES.test(t) &&
        v.segundos >= 40 &&
        v.segundos <= 16 * 60
      );
    })
    .sort((a, b) => a.nivel - b.nivel);
}

const DIA = 86_400_000;

function fechaCuadra(publicado, fechaPartido) {
  const p = Date.parse(publicado);

  const f = Date.parse(`${String(fechaPartido).slice(0, 10)}T00:00:00Z`);

  return Number.isFinite(p) && Number.isFinite(f) && p >= f - DIA / 2 && p <= f + 8 * DIA;
}

/** Busca el resumen de un partido. Devuelve el vídeo o null. */
async function resuelve(fuente, partido, formas) {
  const [a, b] = partido.equipos;

  const otra = fuente.palabra === "resumen" ? "highlights" : "resumen";

  const vistos = new Set();

  for (const palabra of [fuente.palabra, otra]) {
    const lista = await busca(`${a} ${b} ${palabra}`);

    await espera(900 + Math.random() * 600);

    const buenos = candidatos(lista, formas.get(a), formas.get(b)).filter((v) => !vistos.has(v.id));

    for (const v of buenos.slice(0, 3)) {
      vistos.add(v.id);

      const f = await ficha(v.id);

      await espera(700 + Math.random() * 500);

      if (!f || !f.enEspana || f.directo || !fechaCuadra(f.publicado, partido.fecha)) continue;

      const salida = { id: v.id, canal: f.canal || v.canal, titulo: f.titulo || v.titulo, publicado: f.publicado, segundos: f.segundos, nivel: v.nivel };

      if (f.marcas.length) salida.marcas = f.marcas;

      return salida;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

const leeJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};

/** «Arsenal - Everton 2 - 0» → ["Arsenal", "Everton"]. */
function equiposDe(titulo) {
  const sin = String(titulo).replace(/\s+\d+\s*-\s*\d+\s*$/, "").trim();

  const partes = sin.split(" - ");

  return partes.length === 2 ? partes.map((p) => p.trim()) : null;
}

function hayQueBuscar(previo, partido) {
  if (!previo || REHACER) return true;

  if (previo.video) return false;

  if (REINTENTAR) return true;

  const ahora = Date.now();

  const jugado = Date.parse(String(partido.fecha).replace(" ", "T"));

  /* Pasados diez días, se deja como está si ya se buscó después del tercero. */
  if (ahora - jugado > 10 * DIA) return Date.parse(previo.buscadoEn) - jugado < 3 * DIA;

  return ahora - Date.parse(previo.buscadoEn) > 6 * 3_600_000;
}

async function principal() {
  console.log("\n  RMCF · el resumen en YouTube de cada partido (lo mejor de cada jornada)\n");

  let nuevos = 0;
  let cortado = false;

  for (const fuente of FUENTES) {
    if (SOLO && fuente.slug !== SOLO) continue;

    const lista = leeJson(path.join(ORIGEN, fuente.slug, "_partidos.json"));

    if (!lista) continue;

    /* Sólo los partidos que ya están bajados de Wyscout (los que salen en la pantalla). */
    const partidos = lista.partidos
      .filter((p) => p.jugado && fs.existsSync(path.join(ORIGEN, fuente.slug, `${p.id}.json`)))
      .map((p) => ({ ...p, equipos: equiposDe(p.titulo) }))
      .filter((p) => p.equipos);

    const formas = reconocedores([...new Set(partidos.flatMap((p) => p.equipos))]);

    const dir = path.join(CARPETA, fuente.slug);

    fs.mkdirSync(dir, { recursive: true });

    const pendientes = partidos.filter((p) => hayQueBuscar(leeJson(path.join(dir, `${p.id}.json`)), p));

    const conVideo = partidos.length - pendientes.length;

    console.log(`  ${fuente.slug}: ${partidos.length} partidos · ${pendientes.length} por buscar`);

    let hechos = 0;
    let hallados = 0;

    for (const p of MAX ? pendientes.slice(0, MAX) : pendientes) {
      let video = null;

      try {
        video = await resuelve(fuente, p, formas);
      } catch (error) {
        if (error instanceof Cortado) {
          console.log(`    ✗ ${error.message}: se sigue en la siguiente pasada.`);

          cortado = true;

          break;
        }

        console.log(`    ✗ ${p.titulo}: ${error.message}`);

        continue;
      }

      const previo = leeJson(path.join(dir, `${p.id}.json`));

      fs.writeFileSync(
        path.join(dir, `${p.id}.json`),
        JSON.stringify({ id: p.id, partido: p.titulo, fecha: p.fecha, buscadoEn: new Date().toISOString(), intentos: (previo?.intentos ?? 0) + 1, video }),
        "utf8",
      );

      hechos++;

      if (video) {
        hallados++;
        nuevos++;
      }

      if (hechos % 25 === 0) console.log(`    … ${hechos}/${pendientes.length} (${hallados} con resumen)`);
    }

    console.log(`    ✓ ${hallados} resúmenes nuevos de ${hechos} buscados (ya estaban ${conVideo})\n`);

    if (cortado) break;
  }

  console.log(`  RESUMEN: ${nuevos} partidos nuevos con su resumen en YouTube${cortado ? " (YouTube cortó: sigue en la próxima pasada)" : ""}.`);

  process.exitCode = cortado ? 8 : nuevos ? 0 : 3;
}

const soyYo = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (soyYo) {
  principal().catch((error) => {
    console.error("\n  Se ha roto:", error.message, "\n");

    process.exit(1);
  });
}
