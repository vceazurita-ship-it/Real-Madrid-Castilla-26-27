/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club, no lo empaqueta nadie. */
/**
 * LA CÁMARA TÁCTICA DEL CLUB: BUSCAR UNA JUGADA Y CORTARLA.
 *
 * La grabación táctica (dron o torre detrás de una portería, se ven los 22) es
 * la buena para contar ocupación, bloqueos y cómo defiende cada equipo. Pero
 * **no lleva el tiempo de Hudl**: tiene cortes (el dron se recarga) y el
 * desfase cambia a lo largo del partido. Cada jugada hay que buscarla.
 *
 *   node scripts/partido/tactica.cjs busca "<carpeta>" <jugada> <desde> <hasta> [paso=2]
 *       → tacticas/<jugada>/busqueda_<desde>.jpg: rejilla de miniaturas, 6 por
 *         fila; la k-ésima (desde 0, fila a fila) es el segundo desde + k·paso
 *
 *   node scripts/partido/tactica.cjs corta "<carpeta>" <jugada> <segundo>
 *       → tacticas/<jugada>/s_01..s_08.jpg, 2 s apilados por imagen, desde 2 s
 *         antes del momento; apunta el segundo en momento.txt
 *
 *   node scripts/partido/tactica.cjs dura "<carpeta>"
 *       → lo que dura el vídeo, en segundos
 *
 * El vídeo sale de `partido.json` (`videoTactico`). **Uno a uno, nunca en
 * paralelo**: es HEVC de varios gigas y decodificar dos a la vez revienta la
 * memoria (J5).
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const { REPO, leePartido } = require("./comun.cjs");

const FF = path.join(REPO, "node_modules", "ffmpeg-static", "ffmpeg.exe");

const [orden, carpeta, ...resto] = process.argv.slice(2);

if (!orden || !carpeta) {
  console.error("Uso: node scripts/partido/tactica.cjs busca|corta|dura <carpeta> …");
  process.exit(1);
}

const P = leePartido(carpeta);

const V = P.videoTactico;

if (!V || !fs.existsSync(V)) {
  console.error(`No está el vídeo táctico (${V || "partido.json no lo trae"}).`);
  process.exit(2);
}

if (orden === "dura") {
  const r = spawnSync(FF, ["-hide_banner", "-i", V], { encoding: "utf8" });

  const m = String(r.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);

  console.log(m ? Math.round(+m[1] * 3600 + +m[2] * 60 + +m[3]) : "?");

  process.exit(0);
}

const [jugada] = resto;

const dir = path.join(carpeta, "tacticas", jugada);

fs.mkdirSync(dir, { recursive: true });

if (orden === "busca") {
  const desde = Number(resto[1]);
  const hasta = Number(resto[2]);
  const paso = Number(resto[3] || 2);

  const n = Math.floor((hasta - desde) / paso) + 1;

  const salida = path.join(dir, `busqueda_${desde}.jpg`);

  execFileSync(FF, [
    "-hide_banner", "-loglevel", "error", "-threads", "2",
    "-ss", String(desde), "-i", V, "-t", String(hasta - desde + paso),
    "-vf", `fps=1/${paso},scale=400:-2,tile=6x${Math.ceil(n / 6)}:padding=4:color=black`,
    "-frames:v", "1", "-q:v", "4", "-y", salida,
  ]);

  console.log(`${salida}\n${n} miniaturas: la k-ésima (desde 0, fila a fila) es el segundo ${desde} + k·${paso}`);
} else if (orden === "corta") {
  const momento = Number(resto[1]);

  for (const f of fs.readdirSync(dir)) if (/^s_\d+\.jpg$/.test(f)) fs.rmSync(path.join(dir, f));

  execFileSync(FF, [
    "-hide_banner", "-loglevel", "error", "-threads", "2",
    "-ss", String(Math.max(0, momento - 2)), "-i", V, "-t", "16",
    "-vf", "fps=1,scale=1280:-2,tile=1x2", "-fps_mode", "passthrough", "-q:v", "3", "-y",
    path.join(dir, "s_%02d.jpg"),
  ]);

  fs.writeFileSync(path.join(dir, "momento.txt"), `${momento}\n`);

  console.log(`hecho: ${fs.readdirSync(dir).filter((f) => /^s_/.test(f)).length} imágenes · s_01 arriba = segundo ${momento - 2}, s_02 arriba = el momento`);
} else {
  console.error(`Orden desconocida: ${orden}`);
  process.exit(1);
}
