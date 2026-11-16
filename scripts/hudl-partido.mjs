/**
 * EL TIMELINE DE UN PARTIDO NUESTRO, DESDE HUDL.
 *
 *   node scripts/hudl-partido.mjs --fecha 2026-09-27 --salida "<carpeta>"
 *   node scripts/hudl-partido.mjs --fecha 2026-09-27 --ver     → sólo dice qué encuentra
 *
 * De cada partido hay varias copias en la biblioteca del Castilla (equipo
 * 363689) y **sólo una lleva el timeline**: la que se llama como Wyscout,
 * «AAAA-MM-DD Local - Visitante x - y». A veces hay dos con ese nombre (J5) y
 * una viene vacía, así que se abren todas las que casan y gana la de más
 * acciones.
 *
 * Los datos no se leen de la pantalla: la página del vídeo pide un
 * `api/graphql/query` de ~2 MB con `taggingSessions` —una sesión por equipo y
 * otra por jugador— y se recoge con `Network.getResponseBody`.
 *
 * Deja en la carpeta de salida:
 *   timeline-hudl.json   la respuesta tal cual (lo que leen armar/robos-hudl)
 *   video-hudl.json      id, título, duración y la lista HLS de la retransmisión
 *   hls.json             los trozos del vídeo, para sacar fotogramas sin bajarlo
 *                        entero (`scripts/hudl-fotogramas.mjs`)
 *
 * Termina con «RESUMEN: …». Códigos: 0 hecho, 3 no está todavía en Hudl,
 * 2 la sesión no entra, 1 otro fallo.
 */

import fs from "node:fs";
import path from "node:path";

import { abreHudl, cabecerasPara, espera } from "./hudl-chrome.mjs";

const EQUIPO_HUDL = "363689";

const arg = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);

  return i > 0 ? process.argv[i + 1] : null;
};

const FECHA = arg("fecha");
const SALIDA = arg("salida");
const SOLO_VER = process.argv.includes("--ver");

if (!FECHA || !/^\d{4}-\d{2}-\d{2}$/.test(FECHA) || (!SALIDA && !SOLO_VER)) {
  console.error("Uso: node scripts/hudl-partido.mjs --fecha AAAA-MM-DD --salida <carpeta>");
  process.exit(1);
}

/** La fecha del título puede ir un día por detrás (partido de noche, hora UTC). */
const fechasValidas = (() => {
  const base = Date.parse(`${FECHA}T12:00:00Z`);

  return [-1, 0, 1].map((d) => new Date(base + d * 86_400_000).toISOString().slice(0, 10));
})();

/** Cómo escribe el analista la fecha: «13112026», «13-11-2026», «13/11/2026». */
const fechasDelTitulo = (() => {
  const [a, m, d] = FECHA.split("-");

  return [`${d}${m}${a}`, `${d}-${m}-${a}`, `${d}/${m}/${a}`];
})();

const hasta4 = new Date(Date.parse(`${FECHA}T12:00:00Z`) + 4 * 86_400_000).toISOString().slice(0, 10);

/** Entrenamientos: «S79», «"S078"», «Castilla s76», «S74 RM Castilla». */
const esSesion = (titulo) => /(^|[\s"])S\d{2,3}\b/i.test(titulo);

const esDeWyscout = (titulo) =>
  /^\d{4}-\d{2}-\d{2} .+ - .+ \d+ - \d+$/.test(titulo) && /Real Madrid Castilla/i.test(titulo);

function fin(codigo, texto) {
  console.log(`RESUMEN: ${texto}`);

  process.exitCode = codigo;
}

async function principal() {
  const nav = await abreHudl();

  /* Lo que va contestando la página: cuerpo pedido a la carta. */
  /*
  | El cuerpo se pide cuando la respuesta ha terminado de llegar
  | (`loadingFinished`), no con las cabeceras: el timeline pesa ~2 MB y,
  | pedido antes, podía venir vacío y darse el partido por «sin timeline».
  */
  const respuestas = [];
  const pendientes = new Set();

  nav.al("Network.loadingFinished", (p) => {
    if (pendientes.delete(p.requestId)) respuestas.push(p.requestId);
  });
  const hls = [];

  nav.al("Network.responseReceived", (p) => {
    const url = p.response?.url ?? "";

    if (/\/api\/graphql\/query/.test(url)) pendientes.add(p.requestId);

    if (/video\.ondemand\.m3u8/.test(url)) hls.push(url);
  });

  const cuerpo = async (id) => {
    try {
      const r = await nav.manda("Network.getResponseBody", { requestId: id });

      return r.body ?? "";
    } catch {
      return "";
    }
  };

  try {
    /* ---------------- la biblioteca ---------------- */

    await nav.manda("Page.navigate", { url: `https://www.hudl.com/library/${EQUIPO_HUDL}` });

    const videos = [];

    const recoge = async () => {
      for (const id of respuestas.splice(0)) {
        const texto = await cuerpo(id);

        if (!texto.includes('"library"')) continue;

        try {
          for (const arista of JSON.parse(texto).data?.library?.edges ?? []) {
            const v = arista.node;

            if (v?.title && v?.id && !videos.some((x) => x.id === v.id)) videos.push(v);
          }
        } catch {
          /* no era JSON entero */
        }
      }
    };

    for (let i = 0; i < 40 && !videos.length; i++) {
      await espera(1500);

      await recoge();
    }

    const casanWyscout = () =>
      videos.filter((v) => esDeWyscout(v.title) && fechasValidas.includes(v.title.slice(0, 10)));

    /*
    | J12 (16/11/2026): Wyscout no subió su copia y el timeline venía en la
    | del analista («13112026 LIGA J.12 NASTIC - RM CASTILLA»). Si no hay
    | copia con nombre de Wyscout, se abren también las demás del partido
    | —las que llevan su fecha en el título o se subieron en los 4 días
    | siguientes con «Castilla» y sin pinta de sesión— y decide el timeline.
    */
    const otrasDelPartido = () =>
      videos.filter((v) => {
        if (esDeWyscout(v.title)) return false;

        const t = v.title;

        if (fechasDelTitulo.some((f) => t.includes(f))) return !esSesion(t);

        const subido = String(v.createdAt ?? "").slice(0, 10);

        return subido >= FECHA && subido <= hasta4 && /castilla/i.test(t) && !esSesion(t) && !/^J\.\d+ /i.test(t);
      });

    const casan = () => {
      const wy = casanWyscout();

      return wy.length ? wy : otrasDelPartido();
    };

    /*
    | La biblioteca carga por páginas al bajar. Después de un partido se suben
    | sesiones de entrenamiento y partidos de otros, y el nuestro puede quedar
    | fuera de la primera: se baja hasta encontrarlo o pasar de su fecha.
    */
    for (let i = 0; i < 12 && videos.length && !casan().length; i++) {
      const antes = videos.length;

      await nav.js(`
        window.scrollTo(0, document.body.scrollHeight);
        for (const el of document.querySelectorAll("*")) {
          if (el.scrollHeight > el.clientHeight + 200 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight;
        }
      `);

      await espera(3000);

      await recoge();

      const masViejo = videos.map((v) => String(v.createdAt ?? "")).sort()[0] ?? "";

      if (videos.length === antes || (masViejo && masViejo.slice(0, 10) < fechasValidas[0])) break;
    }

    const donde = await nav.js("return location.href");

    if (!videos.length) {
      if (/login|identity/i.test(String(donde))) {
        return fin(2, "la sesión de Hudl no entra: hay que abrir scripts\\actualizar-wys.cmd y entrar una vez a mano");
      }

      return fin(1, `la biblioteca de Hudl no ha contestado (${donde})`);
    }

    const candidatos = casan()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    console.log(`Biblioteca: ${videos.length} vídeos; del partido del ${FECHA}: ${candidatos.length}`);

    if (process.argv.includes("--lista")) {
      for (const v of videos) console.log(`    ${String(v.createdAt ?? "").slice(0, 10)}  ${v.title}`);
    }

    for (const v of candidatos) console.log(`  · ${v.title} (${v.id})`);

    if (!candidatos.length) {
      return fin(3, `en Hudl todavía no está el vídeo de Wyscout del ${FECHA} («AAAA-MM-DD Local - Visitante x - y»)`);
    }

    /* ---------------- cada copia, hasta dar con el timeline ---------------- */

    let mejor = null;

    for (const v of candidatos) {
      respuestas.length = 0;
      pendientes.clear();
      hls.length = 0;

      await nav.manda("Page.navigate", { url: `https://www.hudl.com/watch/video/${v.id}` });

      let timeline = null;

      for (let i = 0; i < 40 && !timeline; i++) {
        await espera(1500);

        for (const id of respuestas.splice(0)) {
          const texto = await cuerpo(id);

          if (!texto.includes('"taggingSessions"')) continue;

          try {
            const json = JSON.parse(texto);

            if (json.data?.taggingSessions?.items?.length) timeline = { texto, json };
          } catch {
            /* sigue */
          }
        }
      }

      const sesiones = timeline?.json.data.taggingSessions.items ?? [];

      const acciones = sesiones.reduce((s, x) => s + (x.moments?.items?.length ?? 0), 0);

      console.log(`  ${v.title}: ${sesiones.length} sesiones, ${acciones} acciones`);

      if (sesiones.length >= 2 && acciones > (mejor?.acciones ?? 0)) {
        mejor = { video: v, timeline, acciones, master: hls[0] ?? null };
      }
    }

    if (!mejor) {
      return fin(3, `el vídeo del ${FECHA} está en Hudl pero todavía sin timeline (sesiones de etiquetado vacías)`);
    }

    if (SOLO_VER) {
      return fin(0, `encontrado «${mejor.video.title}» con ${mejor.acciones} acciones (sin escribir)`);
    }

    fs.mkdirSync(SALIDA, { recursive: true });

    fs.writeFileSync(path.join(SALIDA, "timeline-hudl.json"), mejor.timeline.texto, "utf8");

    /* ---------------- la lista HLS ---------------- */

    let trozos = null;

    if (mejor.master) {
      try {
        trozos = await listaHls(nav, mejor.master);
      } catch (error) {
        console.log(`  (sin lista de trozos del vídeo: ${error.message})`);
      }
    }

    fs.writeFileSync(
      path.join(SALIDA, "video-hudl.json"),
      JSON.stringify(
        {
          id: mejor.video.id,
          titulo: mejor.video.title,
          duracionMs: mejor.video.durationMs ?? null,
          url: `https://www.hudl.com/watch/video/${mejor.video.id}`,
          master: mejor.master,
          leidoEn: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );

    if (trozos) fs.writeFileSync(path.join(SALIDA, "hls.json"), JSON.stringify(trozos), "utf8");

    return fin(
      0,
      `timeline de «${mejor.video.title}»: ${mejor.acciones} acciones` +
        (trozos ? `, vídeo en ${trozos.segs.length} trozos` : ", sin lista del vídeo"),
    );
  } finally {
    await nav.cierra();
  }
}

/**
 * La variante de más calidad de la retransmisión, trozo a trozo.
 *
 * Los nombres de los trozos NO son correlativos (J5): hay que leerlos de la
 * lista. Y ffmpeg contra el m3u8 da 403, porque las cookies van aparte.
 */
async function listaHls(nav, master) {
  const cab = await cabecerasPara(nav, master);

  const texto = await fetch(master, { headers: cab }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} en la lista maestra`);

    return r.text();
  });

  const lineas = texto.split(/\r?\n/);

  let variante = null;
  let ancho = -1;

  lineas.forEach((l, i) => {
    const m = l.match(/^#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+)/);

    if (m && Number(m[1]) > ancho && lineas[i + 1] && !lineas[i + 1].startsWith("#")) {
      ancho = Number(m[1]);
      variante = new URL(lineas[i + 1].trim(), master).href;
    }
  });

  /* Sin variantes, la maestra ya es la lista de trozos. */
  const urlLista = variante ?? master;

  const lista = variante
    ? await fetch(variante, { headers: await cabecerasPara(nav, variante) }).then((r) => r.text())
    : texto;

  const base = urlLista.slice(0, urlLista.lastIndexOf("/") + 1);

  const init = lista.match(/#EXT-X-MAP:URI="([^"]+)"/)?.[1] ?? null;

  const segs = [];
  const dur = [];

  let pendiente = null;

  for (const l of lista.split(/\r?\n/)) {
    const d = l.match(/^#EXTINF:([\d.]+)/);

    if (d) pendiente = Number(d[1]);
    else if (l && !l.startsWith("#") && pendiente !== null) {
      segs.push(l.trim());
      dur.push(pendiente);
      pendiente = null;
    }
  }

  if (!segs.length) throw new Error("la lista no trae trozos");

  return { base, init, segs, dur, lista: urlLista };
}

principal().catch((error) => {
  fin(1, `ha fallado: ${error.message}`);
});
