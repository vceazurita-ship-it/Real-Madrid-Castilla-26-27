/*
 * La marca del jugador en su clip, desde Node (26/11/2026).
 *
 * Llama a scripts/vision/marca-jugador.py (YOLO en la CPU, entorno de Python
 * aparte en %LOCALAPPDATA%\rmcf-vision\venv, fuera del repo). Lo usan
 * scripts/opta-clips-castilla.mjs y scripts/opta-clips-jugador.mjs.
 *
 *   const { marca, hayVision } = require("./vision/marca.cjs");
 *   const r = await marca({ dir, entrada: "k001.mp4", salida: "m001.mp4", segundo: 4, nombre: "Cestero", ffmpeg, salidaFfmpeg });
 *   // r = { marcado: true|false, motivo?, … }; si no marca, deja en `salida` el clip tal cual
 *
 * Sin el entorno de Python, hayVision() es false y los montajes siguen sin marca.
 *
 * EL DESFASE DE OPTA (26/11/2026, mirado con el reloj del marcador de la
 * tele): el vídeo que da /vod-url llega 3 s ANTES de lo pedido. Pedido
 * [acción − 4, acción + 3], el clip va de acción − 7 a acción: la acción cae
 * al final. Se corrige al pedir (antes − 3, después + 3) y se le dice a la
 * marca dónde cae.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PYTHON = path.join(process.env.LOCALAPPDATA || "", "rmcf-vision", "venv", "Scripts", "python.exe");
const SCRIPT = path.join(__dirname, "marca-jugador.py");
const DESFASE_OPTA = 3;

const hayVision = () => process.platform === "win32" && fs.existsSync(PYTHON);

function marca({ dir, entrada, salida, segundo, nombre, ffmpeg, salidaFfmpeg, tope = 240_000 }) {
  return new Promise((ok) => {
    const p = spawn(PYTHON, [SCRIPT, entrada, salida, String(segundo), nombre, ffmpeg, ...salidaFfmpeg], { cwd: dir, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8", YOLO_VERBOSE: "False" } });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", () => {});
    const reloj = setTimeout(() => p.kill(), tope);
    p.on("close", () => {
      clearTimeout(reloj);
      const linea = out.trim().split(/\r?\n/).filter((l) => l.startsWith("{")).pop();
      let r = { marcado: false, motivo: "sin respuesta" };
      try {
        if (linea) r = JSON.parse(linea);
      } catch {
        /* se queda sin marca */
      }
      if (!fs.existsSync(path.join(dir, salida))) fs.copyFileSync(path.join(dir, entrada), path.join(dir, salida));
      ok(r);
    });
  });
}

module.exports = { marca, hayVision, DESFASE_OPTA };
