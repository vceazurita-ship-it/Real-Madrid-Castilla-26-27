/**
 * EL VÍDEO DEL PARTIDO, MONTADO EN EL ORDENADOR DEL CLUB (12/10/2026).
 *
 * Minuto y medio con los cortes REALES del partido: los goles, nuestras
 * llegadas y lo que nos generó el rival, sacados del vídeo de Hudl (la
 * retransmisión, con reloj y dorsales) por los momentos que su timeline ya
 * marca; cada corte con su lectura táctica escrita por Gemini viendo el clip;
 * el partido en datos; robos y transiciones; voz y cama de sonido. Lo pinta
 * el mismo `lib/video-informe/dibujo.ts` que usa el navegador, aquí con
 * `@napi-rs/canvas`, y lo codifica ffmpeg.
 *
 *   node scripts/partido/video-informe.mjs --jornada 7 [--correo a@b.com]
 *        [--sin-voz] [--sin-ia] [--sin-subir] [--solo-cortes] [--cortes-de-cache]
 *
 * Deja todo en `<carpeta del análisis>/video/`: cortes/*.mp4, guion.json,
 * <slug>.mp4. Sube los cortes y el vídeo al bucket `performance` y escribe
 * `informe-clips:jNN` e `informe-video:jNN`: el informe del navegador usa
 * esos cortes y, si el vídeo ya está, lo adjunta sin montar nada.
 *
 * Hace falta: `hudl-partido.mjs` ya pasado (hls.json + timeline), Chrome
 * del club (perfil del Wyscout) para las cookies de Hudl, GEMINI_API_KEY y
 * las claves de Supabase en .env.local. Sin voz (cuota del TTS: 10 al día)
 * el vídeo sale igual, con el texto en pantalla; con `--correo` y sin voz,
 * NO manda nada y sale con código 7 (para reintentar más tarde).
 *
 * Termina con «RESUMEN: …». Códigos: 0 hecho, 2 faltan datos, 7 sin voz (y
 * se pedía correo), 1 fallo.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import { abreHudl, cabecerasPara } from "../hudl-chrome.mjs";

const require = createRequire(import.meta.url);
require("../cargador-ts.cjs");

const { REPO, leePartido } = require("./comun.cjs");
const { entorno } = require("../supabase-local.cjs");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenAI } = require("@google/genai");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const { escenasDeCortes, SEGUNDOS_MAXIMOS } = require("../../lib/video-informe/guion.ts");
const { ANCHO, ALTO, FPS, SEGUNDOS, corteEn, pintaFotograma, rellenaGrano, reparteEscenas } = require("../../lib/video-informe/dibujo.ts");
const { FRECUENCIA_AAC, camaSintetica, pcm16aFlotante, remuestrea, reparteVoz } = require("../../lib/video-informe/voz.ts");

const ejecuta = promisify(execFile);

const FFMPEG = path.join(REPO, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const CLUB = path.join(REPO, "..", "..");
const ANALISIS = path.join(CLUB, "PARTIDOS", "ANALISIS");
const BUCKET = "performance";

const args = process.argv.slice(2);
const bandera = (n) => args.includes(n);
const valor = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);

const JORNADA = Number(valor("--jornada"));
const CORREO = valor("--correo");
const SIN_VOZ = bandera("--sin-voz");
const SIN_IA = bandera("--sin-ia");
const SIN_SUBIR = bandera("--sin-subir");
const SOLO_CORTES = bandera("--solo-cortes");
const DE_CACHE = bandera("--cortes-de-cache");
/* Cuánto antes del final del momento de Hudl empieza el corte y cuánto dura (para medir desfases: --antes 5 --dura 30). */
/* El corte empieza 5 s antes del remate (que se ancla con el evento del portero o del rematador, ver eligeMomentos) y dura 7. */
const ANTES = Number(valor("--antes")) || 5;
const DURA = Number(valor("--dura")) || 7;

function fin(codigo, texto) {
  console.log(`RESUMEN: ${texto}`);
  process.exit(codigo);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/*  EL PARTIDO Y SU TIMELINE                                           */
/* ------------------------------------------------------------------ */

function carpetaDeJornada(n) {
  const prefijo = `J${String(n).padStart(2, "0")} `;
  const nombre = fs.readdirSync(ANALISIS).find((d) => d.startsWith(prefijo) && fs.existsSync(path.join(ANALISIS, d, "partido.json")));

  return nombre ? path.join(ANALISIS, nombre) : null;
}

const minutoDe = (t, periodos) => {
  const [t1 = 0, t2 = Infinity] = periodos;
  const m = t >= t2 ? 45 + Math.floor((t - t2) / 60) + 1 : Math.floor((t - t1) / 60) + 1;

  if (t < t2 && m > 45) return `45+${m - 45}'`;
  if (t >= t2 && m > 90) return `90+${m - 90}'`;

  return `${Math.max(1, m)}'`;
};

/**
 * Los momentos del partido que merecen un corte, con su tiempo de Hudl y sus
 * protagonistas FIABLES.
 *
 * Los momentos de EQUIPO del timeline (goles, remates, contras, córners…)
 * dicen cuándo y de quién es la acción, pero su etiqueta «Players» mezcla a
 * los que atacan con los que defienden. Quién remata, quién asiste y cómo
 * acaba sale de la sesión por JUGADOR: cada remate, gol y asistencia lleva su
 * autor, su zona y su resultado («14 - Shot - Outcome»).
 *
 * Y el tiempo del remate, medido en el J07: el evento «Shot against» del
 * portero (4 s) EMPIEZA en el remate; el evento del rematador son 20 s con el
 * remate ~2 s después del centro; el momento de equipo acaba 4-6 s después.
 */
function eligeMomentos(timeline, nosotros = "Real Madrid Castilla") {
  const SES = timeline.data.taggingSessions.items;
  const cod = (m) => (m.tags.find((t) => t.key === "HUDL_CODE") || { values: [""] }).values[0];
  const tag = (m, k) => (m.tags.find((t) => t.key === k) || { values: [] }).values;
  const EQ = SES.find((s) => s.moments.items.some((m) => / - Possessions$/.test(cod(m)))) || SES[0];
  const JUG = SES.find((s) => s !== EQ) || SES[1];
  const items = EQ.moments.items;
  const periodos = items
    .filter((m) => cod(m) === "Periods")
    .map((m) => m.startTimeMs / 1000)
    .sort((a, b) => a - b);

  /* De qué equipo es cada jugador: por los momentos de equipo en los que aparece. */
  const equipo = {};

  for (const m of items) {
    const c = cod(m);

    if (!/ - /.test(c)) continue;

    for (const p of tag(m, "09 - Players")) equipo[p] ??= c.startsWith(nosotros) ? "nosotros" : "rival";
  }

  const sinDorsal = (j) => j.replace(/^\d+\.\s*/, "");
  const TERCIO = { "Own third": 0, "Middle third": 1, "Final third": 2 };
  const CARRIL = { "Left flank": 0, Center: 1, "Right flank": 2 };
  const RESULTADO = { Goal: "gol", "Goalkeeper save": "parada", Post: "palo", Wide: "fuera", Blocked: "bloqueado", "Blocked shot": "bloqueado", Saved: "parada" };

  const eventos = (JUG?.moments.items ?? [])
    .filter((m) => cod(m) !== "Periods")
    .map((m) => {
      const ini = m.startTimeMs / 1000;
      const fin = (m.endTimeMs ?? m.startTimeMs) / 1000;
      const tercio = TERCIO[tag(m, "04 - Location - Third")[0]];
      const carril = CARRIL[tag(m, "03 - Location - Flank")[0]];

      return {
        jugador: sinDorsal(cod(m)),
        de: equipo[cod(m)],
        ini,
        fin,
        centro: (ini + fin) / 2,
        tipos: tag(m, "02 - Type"),
        resultado: RESULTADO[tag(m, "14 - Shot - Outcome")[0]] ?? "",
        zona: tercio !== undefined && carril !== undefined ? { tercio, carril } : null,
      };
    });

  const texto = (m) => JSON.stringify(m.tags).toLowerCase();
  const conRemate = (m) => /shot on goal|goal/.test(texto(m));

  const candidatos = [];

  for (const m of items) {
    const c = cod(m);
    const propio = c.startsWith(nosotros);
    const de = propio ? "nosotros" : "rival";
    const ini = m.startTimeMs / 1000;
    const fin = (m.endTimeMs ?? m.startTimeMs) / 1000;
    let tipo = null;
    let peso = 0;

    if (/ - Goals$/.test(c)) [tipo, peso] = [propio ? "gol" : "gol-contra", 100];
    else if (/ - Shots$/.test(c)) [tipo, peso] = [propio ? "remate" : "remate-contra", conRemate(m) ? 60 : 40];
    else if (/ - Counterattacks$/.test(c)) [tipo, peso] = [propio ? "contra" : "remate-contra", 55];
    else if (/ - Corners$/.test(c) && conRemate(m)) [tipo, peso] = [propio ? "corner" : "remate-contra", 50];
    else if (/ - Highlights$/.test(c)) [tipo, peso] = [propio ? "remate" : "remate-contra", 45];

    if (!tipo) continue;

    /* Los eventos por jugador de ESE equipo dentro del momento (con un margen: el del rematador dura 20 s). */
    const dentro = eventos.filter((e) => e.de === de && e.centro >= ini - 2 && e.centro <= fin + 2);
    const remates = dentro.filter((e) => e.tipos.some((t) => /^(Shot|Head shot|Free kick shot|Shot after corner|Shot after throw in)$/.test(t)) && !e.tipos.includes("Shot against"));
    const goles = remates.filter((e) => e.tipos.includes("Goal"));
    const rematador = goles[0] ?? remates[remates.length - 1] ?? null;
    const asistente = dentro.filter((e) => e !== rematador && e.tipos.some((t) => /^(Assist|Shot assist|Second assist|Key pass|Corner)$/.test(t))).pop() ?? null;

    /* El remate del portero contrario (empieza en el remate) es la marca más fiable; si no, el centro del rematador + 2 s; si no, el final del momento − 5 s. */
    const portero = eventos.filter((e) => e.de !== de && e.tipos.includes("Shot against") && e.ini >= ini - 2 && e.ini <= fin + 4).sort((a, b) => a.ini - b.ini);
    const tRemate = portero.length ? portero[portero.length - 1].ini - 0.5 : rematador ? rematador.centro + 2 : fin - 5;
    const desde = Math.max(0, tRemate - ANTES);

    if (/ - Goals$/.test(c) && !goles.length && !rematador) peso = 90;

    candidatos.push({
      t: tRemate,
      desde,
      dura: DURA,
      tipo,
      peso,
      de,
      minuto: minutoDe(tRemate, periodos),
      remata: rematador?.jugador ?? "",
      asiste: asistente?.jugador ?? "",
      resultado: goles.length ? "gol" : rematador?.resultado ?? "",
      zona: rematador?.zona ?? null,
      desdeZona: asistente?.zona ?? null,
      jugadores: [rematador?.jugador, asistente?.jugador].filter(Boolean),
    });
  }

  /* Por peso, y sin dos cortes de la misma jugada (a menos de 8 s). */
  candidatos.sort((a, b) => b.peso - a.peso || a.t - b.t);

  const elegidos = [];
  const tope = { gol: 4, "gol-contra": 4, remate: 4, contra: 2, corner: 1, "remate-contra": 4 };
  const cuenta = {};

  for (const c of candidatos) {
    if ((cuenta[c.tipo] ?? 0) >= (tope[c.tipo] ?? 2)) continue;
    if (elegidos.some((e) => Math.abs(e.t - c.t) < 8)) continue;

    cuenta[c.tipo] = (cuenta[c.tipo] ?? 0) + 1;
    elegidos.push(c);
  }

  /* Y el conteo del partido, para la escena de datos. */
  const n = (re, propio) => items.filter((m) => re.test(cod(m)) && cod(m).startsWith(nosotros) === propio).length;
  const datos = {
    posesiones: [n(/ - Possessions$/, true), n(/ - Possessions$/, false)],
    remates: [n(/ - Shots$/, true), n(/ - Shots$/, false)],
    corners: [n(/ - Corners$/, true), n(/ - Corners$/, false)],
    ataques: [n(/ - Open play attacks$/, true), n(/ - Open play attacks$/, false)],
    contras: [n(/ - Counterattacks$/, true), n(/ - Counterattacks$/, false)],
    abp: [n(/ - Set Pieces$/, true), n(/ - Set Pieces$/, false)],
  };

  return { elegidos: elegidos.sort((a, b) => a.t - b.t), datos, periodos };
}

/* ------------------------------------------------------------------ */
/*  LOS CORTES, DESDE HUDL                                             */
/* ------------------------------------------------------------------ */

async function cortaDeHudl(carpeta, momentos, destino) {
  const hls = JSON.parse(fs.readFileSync(path.join(carpeta, "hls.json"), "utf8"));
  const acumulado = [0];

  for (const d of hls.dur) acumulado.push(acumulado[acumulado.length - 1] + d);

  const nav = await abreHudl();

  try {
    const cab = await cabecerasPara(nav, hls.base + hls.segs[0]);
    const baja = async (f) => {
      for (let i = 0; i < 4; i += 1) {
        const r = await fetch(hls.base + f, { headers: cab }).catch(() => null);

        if (r?.ok) return Buffer.from(await r.arrayBuffer());

        await espera(800);
      }

      throw new Error(`no baja ${f}`);
    };

    const init = hls.init ? await baja(hls.init) : Buffer.alloc(0);
    const tmp = path.join(destino, "tmp");
    fs.mkdirSync(tmp, { recursive: true });

    for (const [i, m] of momentos.entries()) {
      m.fichero = path.join(destino, `${String(i + 1).padStart(2, "0")}-${m.tipo}-${m.minuto.replace(/[^0-9+]/g, "")}.mp4`);

      if (fs.existsSync(m.fichero)) continue;

      const s0 = Math.max(0, acumulado.findIndex((a) => a > m.desde) - 1);
      const s1 = Math.min(hls.segs.length - 1, acumulado.findIndex((a) => a >= m.desde + m.dura + 0.5) - 1);
      const trozos = [init];

      for (let s = s0; s <= (s1 < s0 ? s0 + 2 : s1); s += 1) trozos.push(await baja(hls.segs[s]));

      const crudo = path.join(tmp, "crudo.mp4");
      fs.writeFileSync(crudo, Buffer.concat(trozos));

      await ejecuta(FFMPEG, [
        "-y", "-loglevel", "error",
        "-ss", String(Math.max(0, m.desde - acumulado[s0])),
        "-i", crudo,
        "-t", String(m.dura),
        "-vf", "scale=1280:-2",
        "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-ac", "1",
        "-movflags", "+faststart",
        m.fichero,
      ]);

      console.log(`  corte ${i + 1}/${momentos.length}: ${m.tipo} ${m.minuto} (Hudl ${m.desde.toFixed(1)} s)`);
    }

    fs.rmSync(tmp, { recursive: true, force: true });
  } finally {
    await nav.cierra();
  }
}

/* ------------------------------------------------------------------ */
/*  GEMINI: LECTURA DE CADA CORTE, GUION Y VOZ                          */
/* ------------------------------------------------------------------ */

const ROTULO = { gol: "Gol", "gol-contra": "Gol en contra", remate: "Remate", "remate-contra": "Remate en contra", contra: "Contraataque", corner: "Córner", abp: "Balón parado", robo: "Robo", perdida: "Pérdida", otro: "Acción" };

async function conGemini(fn, modelos) {
  let ultimo = null;

  for (const model of modelos) {
    for (let intento = 0; intento < 4; intento += 1) {
      try {
        return await fn(model);
      } catch (error) {
        ultimo = error;
        const estado = error?.status;
        const porDia = /per_day|PerDay|retry in \d+h/i.test(String(error?.message ?? ""));

        console.log(`  (${model}: ${estado ?? ""} ${String(error?.message ?? error).slice(0, 120)})`);

        /* 503 = saturado: unos segundos. 429 por minuto: un minuto entero. 429 por día: a otro modelo. */
        if (estado === 503) await espera(8000 * (intento + 1));
        else if (estado === 429 && !porDia) await espera(65_000);
        else break;
      }
    }
  }

  throw ultimo ?? new Error("Gemini no ha contestado");
}

async function leeCortes(ai, partido, momentos) {
  for (const [i, m] of momentos.entries()) {
    if (m.texto) continue;

    const bytes = fs.readFileSync(m.fichero);
    const contexto = `${partido.local ? "Real Madrid Castilla" : partido.rival} contra ${partido.local ? partido.rival : "Real Madrid Castilla"}, jornada ${partido.jornada} de Primera Federación, resultado final ${partido.gf}-${partido.gc} para el Castilla. En este corte: ${ROTULO[m.tipo].toLowerCase()} ${m.de === "nosotros" ? "del Real Madrid Castilla" : `del ${partido.rival}`} en el minuto ${m.minuto}${m.remata ? `; remata ${m.remata}` : ""}${m.asiste ? ` tras pase de ${m.asiste}` : ""}${m.resultado ? ` (${m.resultado})` : ""}.`;

    try {
      const r = await conGemini(
        (model) =>
          ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType: "video/mp4", data: bytes.toString("base64") } },
                  {
                    text: `Eres el analista táctico del Real Madrid Castilla. ${contexto}\nMira el vídeo y escribe UNA frase de lectura táctica (máximo 22 palabras, castellano de España, sin adornos): qué hace bien o mal el equipo en esa acción (ocupación, presión, vigilancias, marcaje, el pase clave). Sólo lo que se ve. Devuelve JSON {"texto": "..."}.`,
                  },
                ],
              },
            ],
            config: { temperature: 0.3, responseMimeType: "application/json", responseJsonSchema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] } },
          }),
        ["gemini-2.5-flash"],
      );

      m.texto = String(JSON.parse(r.text ?? "{}").texto ?? "").trim().slice(0, 160);
      console.log(`  lectura ${i + 1}: ${m.texto}`);
    } catch (error) {
      console.log(`  (sin lectura del corte ${i + 1}: ${String(error?.message ?? error).slice(0, 80)})`);
    }

    /* La cuota gratuita del Flash es por minuto: un respiro entre cortes. */
    await espera(6500);
  }
}

async function escribeLocuciones(ai, guion) {
  const escenas = guion.escenas.map((e) => ({ id: e.id, texto: e.locucion, palabras: Math.ceil((e.tipo === "clips" ? e.segundos : SEGUNDOS[e.tipo]) * 2.4) }));
  const prompt = [
    "Eres el analista del Real Madrid Castilla y locutas el vídeo del partido para el cuerpo técnico (minuto y medio).",
    "Reescribe la locución de cada escena en castellano de España, directa, con criterio táctico y sin adornos, como se habla en un vestuario profesional.",
    "REGLAS: no inventes ni cambies ningún dato, cifra, nombre ni minuto; no añadas nada que no esté; cada escena no puede pasar de las palabras que se indican;",
    "las cifras en palabras cuando ayuden a leerlas en voz alta; sin emojis, sin comillas, sin encabezados.",
    `Contexto: ${guion.titulo}.`,
    "Escenas (id · tope de palabras · texto):",
    ...escenas.map((e) => `- ${e.id} · ${e.palabras} palabras · ${e.texto}`),
  ].join("\n");

  const r = await conGemini(
    (model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseJsonSchema: { type: "object", properties: { locuciones: { type: "array", items: { type: "object", properties: { id: { type: "string" }, texto: { type: "string" } }, required: ["id", "texto"] } } }, required: ["locuciones"] },
        },
      }),
    ["gemini-2.5-pro", "gemini-2.5-flash"],
  );

  const porId = new Map((JSON.parse(r.text ?? "{}").locuciones ?? []).map((l) => [l.id, String(l.texto).trim()]));

  return {
    ...guion,
    escenas: guion.escenas.map((e, k) => {
      const t = porId.get(e.id);
      const vale = t && t.split(/\s+/).length <= escenas[k].palabras * 1.3;

      return { ...e, locucion: vale ? t : e.locucion };
    }),
  };
}

/** La voz entera en una petición (10 al día en el plan gratuito), repartida por escenas. */
async function pideVoz(ai, guion) {
  const textos = guion.escenas.map((e) => e.locucion.replace(/\s+/g, " ").trim());
  const parrafos = textos
    .filter(Boolean)
    .map((t) => (/[.!?…]$/.test(t) ? t : `${t}.`))
    .join("\n\n")
    .slice(0, 2200);

  const r = await conGemini(
    (model) =>
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: `Lee con tono de analista de fútbol, ritmo ágil, en castellano de España, haciendo una pausa clara entre párrafos:\n\n${parrafos}` }] }],
        config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
      }),
    ["gemini-2.5-flash-preview-tts"],
  );

  const parte = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);

  if (!parte) throw new Error("Gemini no ha devuelto audio");

  const frecuencia = Number(parte.inlineData.mimeType?.match(/rate=(\d+)/)?.[1]) || 24_000;
  const entera = remuestrea(pcm16aFlotante(new Uint8Array(Buffer.from(parte.inlineData.data, "base64"))), frecuencia, FRECUENCIA_AAC);

  return reparteVoz(entera, textos, FRECUENCIA_AAC);
}

/* ------------------------------------------------------------------ */
/*  EL GUION DEL PARTIDO (CON LO QUE HAY EN NODE)                      */
/* ------------------------------------------------------------------ */

function guionDelPartido(partido, cortes, datos, transiciones, escudoRival = null) {
  const rival = partido.rival;
  const marcador = `${partido.gf}-${partido.gc}`;
  const fecha = new Date(partido.cuando ?? partido.fecha);
  const fechaTexto = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  const resultado = partido.gf > partido.gc ? "victoria" : partido.gf < partido.gc ? "derrota" : "empate";
  const goles = cortes.filter((c) => c.tipo === "gol" || c.tipo === "gol-contra");
  const escenas = [];

  escenas.push({
    id: "portada",
    tipo: "portada",
    titulo: rival,
    subtitulo: [`Jornada ${partido.jornada}`, fechaTexto, partido.local ? "en casa" : "fuera"].join(" · "),
    sello: `POST · ${marcador}`,
    escudoNosotros: path.join(REPO, "public", "logo.png"),
    escudoRival,
    locucion: `${rival}, ${partido.local ? "en casa" : "fuera"}: ${resultado} ${marcador}. ${goles.map((g) => `${g.tipo === "gol" ? "Gol nuestro" : "Gol suyo"} en el ${g.minuto}`).join(", ")}.`,
  });

  const par = (a) => `${a[0]} – ${a[1]}`;

  escenas.push({
    id: "datos",
    tipo: "cifras",
    titulo: "El partido en datos",
    cifras: [
      { rotulo: "Remates", valor: par(datos.remates), pie: `Castilla – ${rival}` },
      { rotulo: "Ataques en juego", valor: par(datos.ataques), pie: "con llegada" },
      { rotulo: "Córners", valor: par(datos.corners), pie: `Castilla – ${rival}` },
      { rotulo: "Balón parado", valor: par(datos.abp), pie: "acciones" },
    ],
    locucion: `En datos: ${datos.remates[0]} remates nuestros por ${datos.remates[1]} suyos; ${datos.ataques[0]} ataques con llegada por ${datos.ataques[1]}; córners ${datos.corners[0]} a ${datos.corners[1]}.`,
  });

  if (transiciones) {
    const r = transiciones.robos ?? [];
    const p = transiciones.perdidas ?? [];
    const adelante = r.filter((x) => x.accion === "ADELANTE").length;
    const conRemate = r.filter((x) => /REMATE|GOL|OCASION/i.test(x.desenlace)).length;
    const pRemate = p.filter((x) => /REMATE|GOL|OCASION/i.test(x.desenlace)).length;
    const lineas = [
      `${r.length} robos, ${adelante} hacia delante (${r.length ? Math.round((100 * adelante) / r.length) : 0} %)`,
      `${conRemate} robos acabaron en remate`,
      `${p.length} pérdidas, ${pRemate} nos costaron un remate`,
    ];

    escenas.push({ id: "transiciones", tipo: "claves", titulo: "Robos y transiciones", lineas, locucion: lineas.slice(0, 3).join(". ") });
  }

  escenas.push(...escenasDeCortes(cortes, rival, 7));

  escenas.push({
    id: "cierre",
    tipo: "cierre",
    titulo: "Lo que nos deja",
    lineas: [`${resultado[0].toUpperCase()}${resultado.slice(1)} ${marcador} ante ${rival}: ${datos.remates[0] >= datos.remates[1] ? "dominamos el remate" : "nos remataron más"} y ${datos.corners[0] >= datos.corners[1] ? "ganamos el balón parado" : "sufrimos a balón parado"}.`],
    locucion: `Lo que nos deja: ${resultado} ${marcador}. ${datos.remates[0] >= datos.remates[1] ? "Dominamos el remate" : "Nos remataron más"} y ${datos.corners[0] >= datos.corners[1] ? "ganamos el balón parado" : "sufrimos a balón parado"}.`,
  });

  return { titulo: `${rival} · J${partido.jornada} · post`, escenas };
}

/* ------------------------------------------------------------------ */
/*  EL RENDER CON NAPI + FFMPEG                                        */
/* ------------------------------------------------------------------ */

async function extraeFotogramas(fichero, destino) {
  fs.mkdirSync(destino, { recursive: true });

  if (fs.existsSync(path.join(destino, "f_0001.jpg"))) return;

  await ejecuta(FFMPEG, ["-y", "-loglevel", "error", "-i", fichero, "-vf", `fps=${FPS},scale=${ANCHO}:-2`, "-q:v", "4", path.join(destino, "f_%04d.jpg")], { maxBuffer: 1 << 24 });
}

async function extraeSonido(fichero) {
  const { stdout } = await ejecuta(FFMPEG, ["-loglevel", "error", "-i", fichero, "-f", "f32le", "-ac", "1", "-ar", String(FRECUENCIA_AAC), "pipe:1"], { encoding: "buffer", maxBuffer: 1 << 28 });

  return new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 4));
}

async function renderiza(guion, pistas, carpetaVideo, salida) {
  for (const [peso, fichero] of [["700", "BarlowCondensed-Bold.ttf"], ["600", "BarlowCondensed-SemiBold.ttf"], ["500", "BarlowCondensed-Medium.ttf"], ["400", "BarlowCondensed-Medium.ttf"]]) {
    const ruta = path.join(REPO, "public", "fuentes", fichero);

    if (fs.existsSync(ruta)) GlobalFonts.registerFromPath(ruta, "Barlow Condensed");
    void peso;
  }

  const fuente = `"Barlow Condensed", "Segoe UI", Arial, sans-serif`;
  const escenas = reparteEscenas(guion, pistas, FRECUENCIA_AAC, SEGUNDOS_MAXIMOS);
  const total = escenas.reduce((s, x) => s + x.segundos, 0);
  const arranques = [];
  let inicio = 0;

  for (const x of escenas) {
    arranques.push(inicio);
    inicio += x.segundos;
  }

  /* Recursos: escudos y los fotogramas y el sonido de cada corte. */
  const rec = { imagenes: new Map() };
  const cortes = new Map();

  for (const [k, { escena: e, segundos }] of escenas.entries()) {
    if (e.tipo === "portada") {
      for (const [clave, src] of [["nosotros", e.escudoNosotros], ["rival", e.escudoRival]]) {
        try {
          rec.imagenes.set(`${e.id}:${clave}`, src ? await loadImage(src) : null);
        } catch {
          rec.imagenes.set(`${e.id}:${clave}`, null);
        }
      }
    } else if (e.tipo === "clips") {
      const porCorte = segundos / e.cortes.length;

      for (const [i, c] of e.cortes.entries()) {
        const dir = path.join(carpetaVideo, "fotogramas", path.basename(c.fichero, ".mp4"));

        await extraeFotogramas(c.fichero, dir);
        cortes.set(`${e.id}:${i}`, { dir, sonido: await extraeSonido(c.fichero), desde: arranques[k] + i * porCorte, dura: porCorte });
      }
    }
  }

  /* ---- el sonido: cama + voz + el sonido ambiente de cada corte, bajo ---- */
  const totalMuestras = Math.ceil(total * FRECUENCIA_AAC);
  const pista = new Float32Array(totalMuestras);

  pista.set(camaSintetica(total, arranques.slice(1), FRECUENCIA_AAC).subarray(0, totalMuestras));

  for (const c of cortes.values()) {
    const d0 = Math.floor(c.desde * FRECUENCIA_AAC);
    const n = Math.min(c.sonido.length, Math.floor(c.dura * FRECUENCIA_AAC), totalMuestras - d0);

    for (let i = 0; i < n; i += 1) {
      const env = Math.min(1, i / (0.3 * FRECUENCIA_AAC), (n - i) / (0.3 * FRECUENCIA_AAC));

      pista[d0 + i] += c.sonido[i] * 0.35 * env;
    }
  }

  escenas.forEach((x, k) => {
    if (!x.voz) return;

    const desde = Math.floor(arranques[k] * FRECUENCIA_AAC);

    for (let i = 0; i < x.voz.length && desde + i < totalMuestras; i += 1) pista[desde + i] += x.voz[i] * 0.95;
  });

  for (let i = 0; i < totalMuestras; i += 1) pista[i] = Math.max(-1, Math.min(1, pista[i]));

  const mezcla = path.join(carpetaVideo, "mezcla.f32");
  fs.writeFileSync(mezcla, Buffer.from(pista.buffer, pista.byteOffset, pista.byteLength));

  /* ---- los fotogramas, a ffmpeg por la entrada estándar ---- */
  const ff = spawn(FFMPEG, [
    "-y", "-loglevel", "error",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${ANCHO}x${ALTO}`, "-r", String(FPS), "-i", "pipe:0",
    "-f", "f32le", "-ar", String(FRECUENCIA_AAC), "-ac", "1", "-i", mezcla,
    /* Con tope de caudal: 90 s tienen que quedar por debajo de los 16 MB que admite el correo del informe. */
    "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-maxrate", "1400k", "-bufsize", "2800k", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart", "-shortest",
    salida,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  const escribe = (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once("drain", r)));
  const lienzo = createCanvas(ANCHO, ALTO);
  const ctx = lienzo.getContext("2d");
  const grano = createCanvas(256, 256);
  rellenaGrano(grano.getContext("2d"));
  const totalFotogramas = Math.round(total * FPS);
  let fotograma = 0;
  let ultimoCuadro = { ruta: "", img: null };

  for (const [k, x] of escenas.entries()) {
    const cuantos = k === escenas.length - 1 ? totalFotogramas - fotograma : Math.round(x.segundos * FPS);
    const e = x.escena;

    process.stdout.write(`  escena ${k + 1}/${escenas.length} (${e.id}, ${x.segundos.toFixed(1)} s)\n`);

    for (let i = 0; i < cuantos; i += 1) {
      const t = i / FPS;
      let cuadro = null;

      if (e.tipo === "clips") {
        const { k: c, tc } = corteEn(e, t, x.segundos);
        const corte = cortes.get(`${e.id}:${c}`);

        if (corte) {
          const ruta = path.join(corte.dir, `f_${String(Math.min(Math.round(tc * FPS) + 1, 9999)).padStart(4, "0")}.jpg`);

          if (ruta !== ultimoCuadro.ruta) {
            try {
              ultimoCuadro = { ruta, img: fs.existsSync(ruta) ? await loadImage(ruta) : ultimoCuadro.img };
            } catch {
              ultimoCuadro = { ruta, img: ultimoCuadro.img };
            }
          }

          cuadro = ultimoCuadro.img;
        }
      }

      pintaFotograma(ctx, grano, fuente, guion.titulo, rec, { medida: x, t, global: arranques[k] + t, progreso: fotograma / totalFotogramas, restante: (cuantos - i) / FPS, cuadro });
      await escribe(lienzo.data());
      fotograma += 1;
    }
  }

  ff.stdin.end();

  await new Promise((r, j) => ff.on("close", (code) => (code === 0 ? r() : j(new Error(`ffmpeg ha salido con ${code}`)))));

  return { segundos: Math.round(total), escenas: escenas.length };
}

/* ------------------------------------------------------------------ */
/*  SUPABASE Y CORREO                                                  */
/* ------------------------------------------------------------------ */

function supabaseDe(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function sube(supabase, fichero, destino, tipo) {
  const { error } = await supabase.storage.from(BUCKET).upload(destino, fs.readFileSync(fichero), { contentType: tipo, upsert: true });

  if (error) throw new Error(error.message);

  return supabase.storage.from(BUCKET).getPublicUrl(destino).data.publicUrl;
}

async function guardaDoc(supabase, key, kind, data) {
  const { error } = await supabase.from("app_documents").upsert({ key, kind, data, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) throw new Error(error.message);
}

async function mandaCorreo(env, para, partido, video, url, resumen) {
  for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

  const { envia } = require("../../lib/correo/gmail.ts");
  const asunto = `Vídeo del partido · LIGA ${String(partido.jornada).padStart(2, "0")} ${partido.rival} (${partido.gf}-${partido.gc})`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><p>El vídeo del partido contra <b>${partido.rival}</b> (jornada ${partido.jornada}, ${partido.gf}-${partido.gc}), montado en el ordenador del club con los cortes reales de Hudl y la lectura táctica de cada acción.</p><p>${resumen}</p><p>Va adjunto y también se puede ver aquí: <a href="${url}">${url}</a></p></div>`;

  await envia({
    para: [para],
    asunto,
    html,
    texto: `El vídeo del partido contra ${partido.rival} (jornada ${partido.jornada}, ${partido.gf}-${partido.gc}). ${resumen}\n${url}`,
    adjuntos: [{ nombre: path.basename(video), tipo: "video/mp4", base64: fs.readFileSync(video).toString("base64") }],
  });
}

/* ------------------------------------------------------------------ */
/*  EL ESCUDO DEL RIVAL Y LAS LECTURAS DE SUS CORTES                    */
/* ------------------------------------------------------------------ */

/** El escudo del rival, del documento `rivals:informe` (los baja BeSoccer), como fichero temporal para `loadImage`. */
async function escudoDelRival(supabase, rival, destino) {
  try {
    const { mismoClub } = require("../../lib/rivals/mismoClub.ts");
    const { data } = await supabase.from("app_documents").select("data").eq("key", "rivals:informe").maybeSingle();
    const porNombre = new Map();

    for (const informe of Object.values(data?.data?.porId ?? {})) {
      if (informe?.nombre && informe?.escudo) porNombre.set(informe.nombre, informe.escudo);

      for (const fila of informe?.clasificacion?.total ?? []) if (fila?.equipo && fila?.escudo && !porNombre.has(fila.equipo)) porNombre.set(fila.equipo, fila.escudo);
    }

    const nombre = [...porNombre.keys()].find((n) => n === rival) ?? [...porNombre.keys()].find((n) => mismoClub(n, rival));

    if (!nombre) return null;

    const r = await fetch(porNombre.get(nombre));

    if (!r.ok) return null;

    const fichero = path.join(destino, "escudo-rival.png");
    fs.writeFileSync(fichero, Buffer.from(await r.arrayBuffer()));

    return fichero;
  } catch (error) {
    console.log(`  (sin escudo del rival: ${String(error?.message ?? error).slice(0, 80)})`);

    return null;
  }
}

/**
 * `--lecturas-rival "<equipo>"`: a los cortes del rival que el vigía subió
 * desde la carpeta de Análisis visual (`rival-analisis-clips:<equipo>`, la
 * jornada más reciente) les pone la lectura táctica de Gemini viendo cada
 * vídeo, y la guarda en el mismo documento (`texto`). El informe del
 * navegador la enseña bajo el rótulo del corte. Sólo pide las que faltan.
 */
async function lecturasDelRival(ai, supabase, equipo) {
  const { clipsKey, SECCION_POR_ID, ordenJornada } = require("../../lib/rivals/analisis.ts");
  const clave = clipsKey(equipo);
  const { data, error } = await supabase.from("app_documents").select("data, kind").eq("key", clave).maybeSingle();

  if (error) throw new Error(error.message);

  const doc = data?.data;
  const jornadas = Object.keys(doc?.jornadas ?? {}).sort(ordenJornada);
  const jornada = jornadas.filter((j) => doc.jornadas[j]?.clips?.length).pop();

  if (!jornada) return fin(0, `${equipo}: no hay cortes del rival a los que poner lectura`);

  const clips = doc.jornadas[jornada].clips;
  const tmp = path.join(CLUB, "PARTIDOS", "ANALISIS", "tmp-lecturas");
  fs.mkdirSync(tmp, { recursive: true });
  let hechas = 0;

  for (const [i, c] of clips.slice(0, 10).entries()) {
    if (c.texto || !ai) continue;

    try {
      const r = await fetch(c.url);

      if (!r.ok) continue;

      const bytes = Buffer.from(await r.arrayBuffer());

      if (bytes.length > 19_000_000) continue;

      const seccion = SECCION_POR_ID.get(c.seccion)?.titulo ?? c.seccion;
      const respuesta = await conGemini(
        (model) =>
          ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType: "video/mp4", data: bytes.toString("base64") } },
                  { text: `Eres el analista táctico del Real Madrid Castilla y preparas el partido contra ${equipo}. Este corte es de ${equipo} (${seccion}${c.partido ? `, partido ${c.partido}` : ""}, ${jornada}). Mira el vídeo y escribe UNA frase (máximo 22 palabras, castellano de España, sin adornos) con lo que hay que saber de cómo lo hacen: colocación, movimientos, a quién buscan, dónde flojean. Sólo lo que se ve. Devuelve JSON {"texto": "..."}.` },
                ],
              },
            ],
            config: { temperature: 0.3, responseMimeType: "application/json", responseJsonSchema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] } },
          }),
        ["gemini-2.5-flash"],
      );

      c.texto = String(JSON.parse(respuesta.text ?? "{}").texto ?? "").trim().slice(0, 160);
      hechas += 1;
      console.log(`  lectura ${i + 1}: ${c.texto}`);
      await espera(6500);
    } catch (e) {
      console.log(`  (sin lectura del corte ${i + 1}: ${String(e?.message ?? e).slice(0, 80)})`);
    }
  }

  fs.rmSync(tmp, { recursive: true, force: true });

  if (hechas) {
    const { error: e2 } = await supabase.from("app_documents").upsert({ key: clave, kind: data?.kind ?? "rival-analisis-clips", data: doc, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (e2) throw new Error(e2.message);
  }

  return fin(0, `${equipo} (${jornada}): ${hechas} lecturas nuevas de ${clips.length} cortes`);
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

async function principal() {
  const env = entorno();
  const geminiKey = env?.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  const ai = geminiKey && !SIN_IA ? new GoogleGenAI({ apiKey: geminiKey }) : null;

  /* --lecturas-rival "<equipo>": sólo pone lectura a los cortes del rival ya subidos, para la previa. */
  if (valor("--lecturas-rival")) {
    if (!env) return fin(2, "faltan las claves de Supabase en .env.local");

    return lecturasDelRival(ai, supabaseDe(env), valor("--lecturas-rival"));
  }

  if (!JORNADA && !valor("--carpeta")) return fin(2, "falta --jornada N (o --carpeta)");

  /* --si-no-enviado: para la tarea programada que reintenta hasta que haya voz; una vez mandado, no vuelve a mandar. */
  const SI_NO_ENVIADO = bandera("--si-no-enviado");

  const carpeta = valor("--carpeta") || carpetaDeJornada(JORNADA);

  if (!carpeta) return fin(2, `no hay carpeta de análisis de la jornada ${JORNADA} en ${ANALISIS}`);

  const partido = leePartido(carpeta);
  const clave = `j${String(partido.jornada).padStart(2, "0")}`;
  const carpetaVideo = path.join(carpeta, "video");
  const carpetaCortes = path.join(carpetaVideo, "cortes");
  fs.mkdirSync(carpetaCortes, { recursive: true });

  const marcaEnviado = path.join(carpetaVideo, "enviado.json");

  if (SI_NO_ENVIADO && fs.existsSync(marcaEnviado)) return fin(0, `ya se mandó: ${fs.readFileSync(marcaEnviado, "utf8").slice(0, 120)}`);

  if (!fs.existsSync(path.join(carpeta, "timeline-hudl.json")) || !fs.existsSync(path.join(carpeta, "hls.json"))) {
    return fin(2, "faltan timeline-hudl.json o hls.json: pasa antes scripts/hudl-partido.mjs");
  }

  /* --solo-correo: el vídeo ya está montado; sólo se (re)sube y se manda. */
  if (bandera("--solo-correo")) {
    const hecho = path.join(carpetaVideo, `${partido.slug}.mp4`);

    if (!CORREO || !fs.existsSync(hecho)) return fin(2, "para --solo-correo hacen falta --correo y el vídeo ya montado");
    if (!env) return fin(2, "faltan las claves de Supabase en .env.local");

    const url = await sube(supabaseDe(env), hecho, `2026/informes/video/${partido.slug}.mp4`, "video/mp4");

    await mandaCorreo(env, CORREO, partido, hecho, url, `${(fs.statSync(hecho).size / 1048576).toFixed(1)} MB`);

    return fin(0, `correo con el vídeo de LIGA ${String(partido.jornada).padStart(2, "0")} ${partido.rival} a ${CORREO}`);
  }

  /* 1. Los momentos y los cortes. */
  const timeline = JSON.parse(fs.readFileSync(path.join(carpeta, "timeline-hudl.json"), "utf8"));
  const { elegidos, datos } = eligeMomentos(timeline);

  console.log(`${partido.rival} (J${partido.jornada}): ${elegidos.length} momentos elegidos · remates ${datos.remates.join("-")} · córners ${datos.corners.join("-")}`);

  const cacheCortes = path.join(carpetaVideo, "cortes.json");
  let momentos = elegidos;

  if (DE_CACHE && fs.existsSync(cacheCortes)) momentos = JSON.parse(fs.readFileSync(cacheCortes, "utf8"));
  else await cortaDeHudl(carpeta, momentos, carpetaCortes);

  /* 2. La lectura táctica de cada corte (Gemini viendo el vídeo). */
  if (ai) await leeCortes(ai, partido, momentos);

  fs.writeFileSync(cacheCortes, JSON.stringify(momentos, null, 2), "utf8");

  const cortes = momentos.map((m) => ({
    url: m.url ?? "",
    fichero: m.fichero,
    /* Quién remata y quién asiste, de la sesión por jugador: «Gol · 79' · Ángel Carvajal (asiste Diego Aguado)». */
    rotulo: `${ROTULO[m.tipo]} · ${m.minuto}${m.remata ? ` · ${m.remata}` : ""}${m.asiste ? ` (asiste ${m.asiste})` : ""}`,
    texto: m.texto ?? "",
    tipo: m.tipo,
    minuto: m.minuto,
    segundos: m.dura,
    de: m.de,
    desde: 0,
    remata: m.remata ?? "",
    asiste: m.asiste ?? "",
    resultado: m.resultado ?? "",
    zona: m.zona ?? null,
    desdeZona: m.desdeZona ?? null,
  }));

  /* 3. Al bucket, para que el navegador los use. */
  const supabase = SIN_SUBIR ? null : env ? supabaseDe(env) : null;

  if (supabase) {
    for (const c of cortes) {
      c.url = await sube(supabase, c.fichero, `2026/informes/clips/${clave}/${path.basename(c.fichero)}`, "video/mp4");
    }

    await guardaDoc(supabase, `informe-clips:${clave}`, "informe-clips", {
      partido: { jornada: partido.jornada, rival: partido.rival, fecha: partido.fecha, resultado: `${partido.gf}-${partido.gc}`, slug: partido.slug },
      cortes: cortes.map(({ fichero: _f, ...c }) => c),
      creado: new Date().toISOString(),
    });
    console.log(`  ${cortes.length} cortes en el bucket y en informe-clips:${clave}`);
  }

  if (SOLO_CORTES) return fin(0, `${cortes.length} cortes del partido${supabase ? " subidos" : ""}`);

  /* 4. El guion, la locución y la voz. */
  const { PARTIDOS } = require("../../lib/transiciones/datos.ts");
  const transiciones = PARTIDOS.find((p) => p.id === partido.slug) ?? null;
  const escudo = supabase ? await escudoDelRival(supabase, partido.rival, carpetaVideo) : null;
  let guion = guionDelPartido(partido, cortes, datos, transiciones, escudo);

  if (ai) {
    try {
      guion = await escribeLocuciones(ai, guion);
    } catch (error) {
      console.log(`  (locución sin pulir: ${String(error?.message ?? error).slice(0, 100)})`);
    }
  }

  fs.writeFileSync(path.join(carpetaVideo, "guion.json"), JSON.stringify(guion, null, 2), "utf8");

  let pistas = null;
  let motivoSinVoz = SIN_VOZ ? "pedido sin voz" : ai ? "" : "sin IA";

  if (ai && !SIN_VOZ) {
    try {
      pistas = await pideVoz(ai, guion);
    } catch (error) {
      motivoSinVoz = error?.status === 429 ? "cuota del TTS agotada (10 al día)" : String(error?.message ?? error).slice(0, 100);
      console.log(`  (sin voz: ${motivoSinVoz})`);
    }
  }

  if (!pistas && CORREO) return fin(7, `sin voz (${motivoSinVoz}); no se manda el correo, reintentar más tarde`);

  /* 5. El render. */
  const salida = path.join(carpetaVideo, `${partido.slug}.mp4`);
  const { segundos, escenas } = await renderiza(guion, pistas, carpetaVideo, salida);
  const mb = (fs.statSync(salida).size / 1048576).toFixed(1);

  console.log(`  vídeo: ${salida} · ${segundos} s · ${escenas} escenas · ${mb} MB${pistas ? "" : " · SIN VOZ"}`);

  /* 6. Al bucket y, si se pide, por correo. */
  let url = "";

  if (supabase) {
    url = await sube(supabase, salida, `2026/informes/video/${partido.slug}.mp4`, "video/mp4");
    await guardaDoc(supabase, `informe-video:${clave}`, "informe-video", { url, creado: new Date().toISOString(), segundos, conVoz: Boolean(pistas), partido: { jornada: partido.jornada, rival: partido.rival } });
  }

  const resumen = `${segundos} s, ${escenas} escenas, ${cortes.length} cortes de Hudl${pistas ? ", con voz" : ", sin voz"}, ${mb} MB`;

  if (CORREO) {
    await mandaCorreo(env, CORREO, partido, salida, url, resumen);
    fs.writeFileSync(marcaEnviado, JSON.stringify({ a: CORREO, cuando: new Date().toISOString(), resumen }), "utf8");
    console.log(`  correo mandado a ${CORREO}`);
  }

  return fin(0, `vídeo de LIGA ${String(partido.jornada).padStart(2, "0")} ${partido.rival}: ${resumen}${url ? ` · ${url}` : ""}${CORREO ? ` · correo a ${CORREO}` : ""}`);
}

principal().catch((error) => {
  console.error(error);
  fin(1, `fallo: ${String(error?.message ?? error).slice(0, 200)}`);
});
