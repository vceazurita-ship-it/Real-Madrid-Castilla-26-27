/**
 * LA GRABACIÓN TÁCTICA, ABIERTA DESDE LA APP (31/10/2026).
 *
 * «Vídeo Análisis de Partidos» tiene, en el ordenador principal, un botón que
 * abre la grabación táctica del partido («J 07 - UD IBIZA - RM CASTILLA.mp4»,
 * en Downloads/RMCF CASTILLA/PARTIDOS, 4-7 GB). Una página https no puede
 * abrir un fichero del disco (file:// está vetado), así que el botón es un
 * enlace normal a este servidor, que sólo escucha en 127.0.0.1:
 *
 *   GET /tactica/7          abre la grabación de la J7 en el reproductor de
 *                           Windows y redirige a una página que lo dice
 *   GET /tactica/7/carpeta  la enseña seleccionada en el Explorador
 *   GET /estado             las grabaciones que ve (JSON)
 *
 * Una navegación de primer nivel a 127.0.0.1 no es contenido mixto y el
 * navegador la deja pasar desde la app publicada. Sólo abre lo que hay en
 * PARTIDOS y por número de jornada: no recibe rutas.
 *
 * Lo arranca el vigía (scripts/vigia.cjs) al ponerse en marcha. También se
 * puede lanzar suelto: node scripts/grabacion-tactica.cjs
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

/** El mismo que PUERTO_GRABACIONES de lib/video-partido/enlaces.ts. */
const PUERTO = 47832;

const PARTIDOS = path.join(__dirname, "..", "..", "..", "PARTIDOS");

const VIDEO = /\.(mov|mp4|m4v|mkv|mxf|avi)$/i;

/** La grabación de una jornada; si hay dos, la grande (la otra suele ser un corte). */
function grabacionDe(jornada) {
  let mejor = null;

  for (const d of fs.readdirSync(PARTIDOS, { withFileTypes: true })) {
    if (!d.isFile() || !VIDEO.test(d.name)) continue;

    if (Number(d.name.match(/^J\s*0*(\d{1,2})\s*-/i)?.[1]) !== jornada) continue;

    const ruta = path.join(PARTIDOS, d.name);

    const tam = fs.statSync(ruta).size;

    if (!mejor || tam > mejor.tam) mejor = { fichero: d.name, ruta, tam };
  }

  return mejor;
}

const escapa = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function pagina(res, estado, titulo, texto, extra = "") {
  res.writeHead(estado, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });

  res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapa(titulo)}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0F14;color:#fff;font:15px/1.5 system-ui,sans-serif}
  main{max-width:520px;padding:28px;border:1px solid #ffffff1f;border-radius:18px;background:#11161C}
  p.k{margin:0;color:#C8A96B;font-size:11px;letter-spacing:.3em;text-transform:uppercase}
  h1{margin:10px 0 6px;font-size:20px} p{color:#ffffffa6} a{color:#C8A96B}
  code{display:block;margin-top:12px;padding:10px;border-radius:10px;background:#ffffff0d;color:#ffffffcc;font-size:12px;word-break:break-all}
</style></head><body><main><p class="k">RMCF Castilla · Grabación táctica</p><h1>${escapa(titulo)}</h1><p>${texto}</p>${extra}</main></body></html>`);
}

/** El reproductor que Windows tenga para ese tipo de fichero. */
function abre(ruta) {
  spawn("explorer.exe", [ruta], { detached: true, stdio: "ignore", windowsHide: false }).unref();
}

function enCarpeta(ruta) {
  spawn("explorer.exe", [`/select,"${ruta}"`], { detached: true, stdio: "ignore", windowsVerbatimArguments: true }).unref();
}

function atiende(req, res) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PUERTO}`);

  if (req.method !== "GET") {
    res.writeHead(405).end();

    return;
  }

  if (url.pathname === "/estado") {
    let lista = [];

    try {
      lista = fs.readdirSync(PARTIDOS).filter((n) => VIDEO.test(n) && /^J\s*\d/i.test(n));
    } catch {
      /* sin carpeta, lista vacía */
    }

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: true, carpeta: PARTIDOS, grabaciones: lista }));

    return;
  }

  const m = url.pathname.match(/^\/(tactica|abierta)\/(\d{1,2})(\/carpeta)?\/?$/);

  if (!m) {
    pagina(res, 404, "No hay nada aquí", "Este ordenador sólo abre las grabaciones tácticas de los partidos.");

    return;
  }

  const jornada = Number(m[2]);

  let g = null;

  try {
    g = grabacionDe(jornada);
  } catch {
    /* sin carpeta */
  }

  if (!g) {
    pagina(res, 404, `J${jornada}: no está la grabación`, `En <strong>${escapa(PARTIDOS)}</strong> no hay ningún vídeo que empiece por «J ${String(jornada).padStart(2, "0")} -».`);

    return;
  }

  /* Abrir y redirigir: recargar la página no vuelve a abrir el vídeo. */
  if (m[1] === "tactica") {
    try {
      if (m[3]) enCarpeta(g.ruta);
      else abre(g.ruta);
    } catch (error) {
      pagina(res, 500, "No se ha podido abrir", escapa(error.message));

      return;
    }

    res.writeHead(303, { Location: `/abierta/${jornada}${m[3] ? "/carpeta" : ""}`, "Cache-Control": "no-store" });
    res.end();

    return;
  }

  const gb = (g.tam / 1024 ** 3).toFixed(1).replace(".", ",");

  pagina(
    res,
    200,
    g.fichero,
    m[3]
      ? "Está seleccionada en el Explorador de este ordenador."
      : `Se abre en el reproductor de este ordenador (${gb} GB; con un vídeo tan grande puede tardar unos segundos). Ya puedes cerrar esta pestaña.`,
    `<code>${escapa(g.ruta)}</code>${m[3] ? "" : `<p><a href="/tactica/${jornada}/carpeta">Enseñarla en la carpeta</a></p>`}`,
  );
}

/**
 * Pone el servidor en marcha. Si el puerto ya está cogido (otro vigía, o
 * lanzado a mano), no hace nada: con uno basta.
 */
function sirveGrabaciones(apunta = console.log) {
  const servidor = http.createServer((req, res) => {
    try {
      atiende(req, res);
    } catch (error) {
      try {
        pagina(res, 500, "Se ha roto", escapa(error.message));
      } catch {
        /* la respuesta ya había salido */
      }
    }
  });

  servidor.once("error", (error) => {
    if (error.code !== "EADDRINUSE") apunta(`Grabación táctica: no se puede escuchar en ${PUERTO} (${error.message}).`);
  });

  servidor.listen(PUERTO, "127.0.0.1", () => apunta(`Grabación táctica: la app la abre por http://127.0.0.1:${PUERTO}.`));

  return servidor;
}

module.exports = { sirveGrabaciones, PUERTO };

if (require.main === module) sirveGrabaciones();
