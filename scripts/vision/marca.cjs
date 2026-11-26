/*
 * El jugador marcado en su clip y el momento exacto de Opta, desde Node (26/11/2026).
 *
 * Usa scripts/vision/marca-jugador.py y scripts/vision/reloj.py (entorno de
 * Python aparte en %LOCALAPPDATA%\rmcf-vision\venv, fuera del repo). Lo usan
 * scripts/opta-clips-castilla.mjs y scripts/opta-clips-jugador.mjs. Sin ese
 * entorno, hayVision() es false: los clips salen sin marca y con el desfase
 * por defecto.
 *
 * EL DESFASE DE OPTA. El vídeo de /vod-url llega ANTES de lo pedido, y no
 * siempre lo mismo: el 20/11 (Castilla-Murcia, mirado con el reloj del
 * marcador) 3 s en la primera parte y 6-7 en la segunda. `desfases()` lo mide
 * en cada partido y cada parte: pide un par de momentos, saca un fotograma y
 * lee el reloj (reloj.py). `ventana()` dice qué pedir y cuánto saltar para
 * que el clip vaya de verdad de `antes` a `despues` alrededor de la acción.
 *
 * LA MARCA, EN DOS PASADAS (el analista vio que a veces marcaba al rival):
 * analiza() cada clip → kitDe() aprende el color de SU camiseta en ese partido
 * con los clips en que el balón es suyo (pase, control, conducción) → pinta()
 * sólo marca a alguien con esa camiseta. Sin camiseta clara, sin marca.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PYTHON = path.join(process.env.LOCALAPPDATA || "", "rmcf-vision", "venv", "Scripts", "python.exe");
const MARCA = path.join(__dirname, "marca-jugador.py");
const RELOJ = path.join(__dirname, "reloj.py");
const DESFASE_POR_DEFECTO = 3;
const COLOR_MAX = 38;

const hayVision = () => process.platform === "win32" && fs.existsSync(PYTHON);

function python(args, dir, tope = 300_000) {
  return new Promise((ok) => {
    const p = spawn(PYTHON, args, { cwd: dir, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8", YOLO_VERBOSE: "False" } });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", () => {});
    const reloj = setTimeout(() => p.kill(), tope);
    p.on("close", () => {
      clearTimeout(reloj);
      ok(
        out
          .split(/\r?\n/)
          .filter((l) => l.startsWith("{"))
          .map((l) => {
            try {
              return JSON.parse(l);
            } catch {
              return null;
            }
          })
          .filter(Boolean),
      );
    });
  });
}

function ffmpegRun(ffmpeg, args, cwd) {
  return new Promise((ok) => {
    const p = spawn(ffmpeg, ["-y", "-loglevel", "error", ...args], { cwd, windowsHide: true });
    const reloj = setTimeout(() => p.kill(), 60_000);
    p.on("close", (c) => {
      clearTimeout(reloj);
      ok(c === 0);
    });
  });
}

const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/**
 * El desfase de cada parte de un partido: { 1: s, 2: s }.
 * `muestras` = { 1: [segundo, …], 2: [segundo, …] } (momentos de Opta de esa parte).
 */
async function desfases({ opta, partido, fecha, muestras, ffmpeg, dir }) {
  const salida = { 1: DESFASE_POR_DEFECTO, 2: DESFASE_POR_DEFECTO };
  if (!hayVision()) return salida;
  const pedidos = [];
  for (const parte of [1, 2]) {
    for (const [i, segundo] of (muestras[parte] ?? []).slice(0, 3).entries()) {
      const v = await opta.video({ partido, fecha, parte, segundo, tipo: "Pass" }, 0, 3);
      if (!v.url) continue;
      const img = `reloj-${parte}-${i}.jpg`;
      if (await ffmpegRun(ffmpeg, ["-ss", "1", "-i", v.url, "-frames:v", "1", "-q:v", "3", img], dir)) pedidos.push({ parte, segundo, img });
    }
  }
  if (!pedidos.length) return salida;
  const leidos = await python([RELOJ, ...pedidos.flatMap((p) => [p.img, String(p.segundo + 1 - DESFASE_POR_DEFECTO)])], dir, 240_000);
  for (const parte of [1, 2]) {
    const ds = pedidos
      .map((p, i) => ({ p, r: leidos[i] }))
      .filter(({ p, r }) => p.parte === parte && r && typeof r.reloj === "number")
      .map(({ p, r }) => p.segundo + 1 - r.reloj)
      .filter((d) => d >= -2 && d <= 20);
    const m = mediana(ds);
    if (m != null) salida[parte] = Math.round(m * 10) / 10;
  }
  for (const p of pedidos) fs.rmSync(path.join(dir, p.img), { force: true });
  return salida;
}

/*
| EL RELOJ DE CADA CLIP (26/11/2026, segunda vuelta). Medir una vez por parte
| no basta: Opta corta su vídeo por trozos y cada clip llega adelantado una
| cantidad distinta (en Rober, de 2 a 3 s MÁS de lo medido). Así que a cada
| clip se le pide un tramo de sobra, se lee el reloj del marcador en dos
| fotogramas suyos (1 s y 3 s) y se sabe qué minuto de partido es su segundo 0.
| `lista` = [{ bruto: "r001.mp4", inicioPedido: segundo de partido pedido como arranque }].
| Devuelve, por clip, el segundo de partido de su arranque, o null si no se lee.
*/
async function relojDeClips({ dir, lista, ffmpeg }) {
  const salida = lista.map(() => null);
  if (!hayVision() || !lista.length) return salida;
  const fotos = [];
  for (const [i, c] of lista.entries()) {
    for (const t of [1, 3]) {
      const img = `rl-${i}-${t}.jpg`;
      if (await ffmpegRun(ffmpeg, ["-ss", String(t), "-i", c.bruto, "-frames:v", "1", "-q:v", "3", img], dir)) fotos.push({ i, t, img });
    }
  }
  const leidos = await python([RELOJ, ...fotos.flatMap((f) => [f.img, String(lista[f.i].inicioPedido - DESFASE_POR_DEFECTO + f.t)])], dir, 600_000);
  const porClip = lista.map(() => []);
  fotos.forEach((f, k) => {
    const r = leidos[k];
    /* El reloj marca el segundo entero en curso: a mitad de ese segundo, de media. */
    if (r && typeof r.reloj === "number") porClip[f.i].push(r.reloj + 0.5 - f.t);
    fs.rmSync(path.join(dir, f.img), { force: true });
  });
  porClip.forEach((v, i) => {
    if (!v.length) return;
    /* Las dos lecturas deben casar (a menos de 1,5 s); si no, la más cercana a lo pedido. */
    const m = v.length === 2 && Math.abs(v[0] - v[1]) < 1.5 ? (v[0] + v[1]) / 2 : v.sort((a, b) => Math.abs(a - lista[i].inicioPedido) - Math.abs(b - lista[i].inicioPedido))[0];
    salida[i] = Math.round(m * 10) / 10;
  });
  return salida;
}

/** Qué pedir a Opta y cuánto saltar para un clip de `antes` + `despues` de verdad con ese desfase. */
function ventana(antes, despues, desfase) {
  /* Opta sólo acepta segundos enteros: se pide de más y se salta lo que sobra. */
  const pideAntes = Math.max(0, Math.floor(antes - desfase));
  return { pideAntes, pideDespues: Math.ceil(despues + desfase + 0.5), salta: Math.max(0, Math.round((pideAntes + desfase - antes) * 100) / 100) };
}

async function analiza({ dir, entrada, segundo, json }) {
  if (!hayVision()) return null;
  const [r] = await python([MARCA, "analiza", entrada, String(segundo), json], dir);
  return r && fs.existsSync(path.join(dir, json)) ? r : null;
}

/** El color de su camiseta: la mediana de las «cabezas» de sus clips claros, si casan entre sí. */
function kitDe(cabezas) {
  const v = cabezas.filter(Boolean);
  if (v.length < 3) return null;
  const med = [0, 1, 2].map((i) => mediana(v.map((c) => c[i])));
  const cerca = v.filter((c) => Math.hypot(c[0] - med[0], c[1] - med[1], c[2] - med[2]) < COLOR_MAX);
  if (cerca.length < 3 || cerca.length / v.length < 0.6) return null;
  return [0, 1, 2].map((i) => mediana(cerca.map((c) => c[i])));
}

async function pinta({ dir, entrada, salida, json, nombre, kit, ffmpeg, salidaFfmpeg }) {
  const destino = path.join(dir, salida);
  if (!hayVision() || !kit || !fs.existsSync(path.join(dir, json))) {
    fs.copyFileSync(path.join(dir, entrada), destino);
    return { marcado: false, motivo: kit ? "sin análisis" : "sin camiseta clara" };
  }
  const [r] = await python([MARCA, "pinta", entrada, salida, json, nombre, ...kit.map(String), ffmpeg, ...salidaFfmpeg], dir);
  if (!fs.existsSync(destino)) fs.copyFileSync(path.join(dir, entrada), destino);
  return r ?? { marcado: false, motivo: "sin respuesta" };
}

module.exports = { hayVision, desfases, relojDeClips, ventana, analiza, kitDe, pinta, DESFASE_POR_DEFECTO };
