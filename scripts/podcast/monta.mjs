/*
|--------------------------------------------------------------------------
| MONTAJE DEL PODCAST «CASTILLA, POR DENTRO» (08/11/2026)
|--------------------------------------------------------------------------
|
| De las voces (scripts/podcast/voces.py) y el guion a un MP4 16:9 por
| capítulo, sólo con ffmpeg (gratis):
|   - un plano por réplica: la captura de la app con zoom lento hacia la zona
|     de la que se habla (encuadre 16:9 calculado aquí, determinista);
|   - tarjeta de quién habla (VÍCTOR dorada, ENTREVISTADOR gris), rótulo en
|     el tercio inferior y subtítulos quemados por trozos;
|   - portada de 3 s y cierre de 4 s con la acción y la ruta.
| Puerta final: duración frente a la objetivo (±15 %) en checks-montaje.md.
|
|   node scripts/podcast/monta.mjs boceto [capitulo]
*/
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const POD = path.join(RAIZ, ".cache", "podcast");
const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const [nombre = "boceto", soloTxt] = process.argv.slice(2);
const solo = soloTxt ? Number(soloTxt) : null;
const guion = JSON.parse(fs.readFileSync(path.join(POD, "guiones", `${nombre}.json`), "utf8"));
const AUD = path.join(POD, "audio", nombre);
const SAL = path.join(POD, "video", nombre);
fs.mkdirSync(SAL, { recursive: true });

const W = 1920, H = 1080, FPS = 30;
const ORO = "0xD8B45A";

/** Duración de un .wav leyendo su cabecera (sin ffprobe). */
function duracionWav(f) {
  const b = fs.readFileSync(f);
  let i = 12, rate = 0, canales = 1, bits = 16;
  while (i < b.length) {
    const id = b.toString("ascii", i, i + 4), tam = b.readUInt32LE(i + 4);
    if (id === "fmt ") { canales = b.readUInt16LE(i + 10); rate = b.readUInt32LE(i + 12); bits = b.readUInt16LE(i + 22); }
    if (id === "data") return tam / (rate * canales * (bits / 8));
    i += 8 + tam + (tam % 2);
  }
  throw new Error("wav sin datos: " + f);
}

/** Tamaño de un JPEG leyendo el marcador SOF. */
function tamJpg(f) {
  const b = fs.readFileSync(f);
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  throw new Error("jpg sin SOF: " + f);
}

/** La zona (fracciones) a un encuadre 16:9 dentro de la imagen, en píxeles. */
function encuadre([fx, fy, fw, fh], img, holgura = 1.12) {
  let w = fw * img.w * holgura, h = fh * img.h * holgura;
  if (fx === 0 && fy === 0 && fw === 1 && fh === 1) h = Math.min(h, (img.w * 9) / 16); // «toda»: la parte de arriba
  if (w / h < 16 / 9) w = (h * 16) / 9; else h = (w * 9) / 16;
  w = Math.max(w, 480); h = (w * 9) / 16;
  if (w > img.w) { w = img.w; h = (w * 9) / 16; }
  if (h > img.h) { h = img.h; w = (h * 16) / 9; }
  const cx = (fx + fw / 2) * img.w, cy = (fy === 0 && fh === 1 ? h / 2 / img.h : fy + fh / 2) * img.h;
  const x = Math.min(Math.max(0, cx - w / 2), img.w - w), y = Math.min(Math.max(0, cy - h / 2), img.h - h);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}
const amplia = (e, img, k) => {
  const w = Math.min(img.w, e.w * k), h = (w * 9) / 16, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  return { x: Math.round(Math.min(Math.max(0, cx - w / 2), img.w - w)), y: Math.round(Math.min(Math.max(0, cy - h / 2), Math.max(0, img.h - h))), w: Math.round(w), h: Math.round(Math.min(h, img.h)) };
};

/** Subtítulos: trozos de ~9 palabras repartidos por su peso en la duración. */
function trozos(texto, dur) {
  const pal = texto.split(/\s+/);
  const grupos = [];
  for (let i = 0; i < pal.length; i += 9) grupos.push(pal.slice(i, i + 9).join(" "));
  const total = pal.length;
  let t = 0;
  return grupos.map((g) => { const d = (g.split(" ").length / total) * dur; const r = { g, a: t, b: t + d }; t += d; return r; });
}

const ff = (args, cwd) => execFileSync(FFMPEG, ["-y", "-loglevel", "error", ...args], { cwd, stdio: ["ignore", "inherit", "inherit"] });
const comillas = (s) => s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");

const checks = ["| capítulo | duración | objetivo | desvío | veredicto |", "|---|---|---|---|---|"];
for (const cap of guion.capitulos) {
  if (solo && cap.n !== solo) continue;
  const tmp = path.join(SAL, `tmp-c${cap.n}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  for (const f of ["BarlowCondensed-Bold.ttf", "BarlowCondensed-Medium.ttf"]) fs.copyFileSync(path.join(RAIZ, "public", "fuentes", f), path.join(tmp, f));
  const segs = [];

  /* Portada (3 s) */
  fs.writeFileSync(path.join(tmp, "p1.txt"), "CASTILLA, POR DENTRO");
  fs.writeFileSync(path.join(tmp, "p2.txt"), `${cap.n} · ${cap.titulo}`);
  ff(["-f", "lavfi", "-i", `color=c=0x0B0F14:s=${W}x${H}:r=${FPS}:d=3`, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "3",
    "-vf", `drawtext=fontfile=BarlowCondensed-Bold.ttf:textfile=p1.txt:fontcolor=${ORO}:fontsize=64:x=(w-tw)/2:y=h/2-110,drawtext=fontfile=BarlowCondensed-Bold.ttf:textfile=p2.txt:fontcolor=white:fontsize=96:x=(w-tw)/2:y=h/2-20,drawbox=x=(iw-360)/2:y=ih/2+110:w=360:h=6:color=${ORO}:t=fill`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest", "s000.mp4"], tmp);
  segs.push("s000.mp4");

  let total = 3;
  cap.r.forEach(([voz, texto, cap_, zona, rotulo], i) => {
    const wav = path.join(AUD, `c${String(cap.n).padStart(2, "0")}-${String(i).padStart(2, "0")}-${voz}.wav`);
    if (!fs.existsSync(wav)) throw new Error("falta la voz " + wav);
    const dur = duracionWav(wav) + 0.3;
    total += dur;
    const img = path.join(RAIZ, guion.capturas[cap_]);
    const t = tamJpg(img);
    const fin = encuadre(zona, t), ini = amplia(fin, t, 1.18);
    const L = (a, b) => `(${a}+(${b - a})*min(t/${dur.toFixed(2)},1))`;
    const quien = voz === "V" ? "VÍCTOR" : "ENTREVISTADOR";
    fs.writeFileSync(path.join(tmp, `q${i}.txt`), quien);
    /* Al doble de tamaño antes de recortar: el zoom lento no tiembla por redondeo de píxeles. */
    const filtros = [
      `scale=${t.w * 2}:${t.h * 2}`,
      `crop=w='2*${L(ini.w, fin.w)}':h='2*${L(ini.h, fin.h)}':x='2*${L(ini.x, fin.x)}':y='2*${L(ini.y, fin.y)}'`,
    ];
    filtros.push(`scale=${W}:${H}:flags=lanczos`, "setsar=1", `fps=${FPS}`);
    /* Tarjeta de quién habla */
    filtros.push(`drawbox=x=48:y=44:w=${voz === "V" ? 210 : 330}:h=64:color=${voz === "V" ? ORO : "0x3A4048"}@0.95:t=fill`);
    filtros.push(`drawtext=fontfile=BarlowCondensed-Bold.ttf:textfile=q${i}.txt:fontcolor=${voz === "V" ? "0x0B0F14" : "white"}:fontsize=44:x=68:y=52`);
    /* Rótulo del bloque */
    if (rotulo) {
      fs.writeFileSync(path.join(tmp, `r${i}.txt`), rotulo.toUpperCase());
      filtros.push(`drawbox=x=0:y=ih-330:w=iw:h=86:color=0x0B0F14@0.82:t=fill`, `drawbox=x=0:y=ih-330:w=12:h=86:color=${ORO}:t=fill`);
      filtros.push(`drawtext=fontfile=BarlowCondensed-Bold.ttf:textfile=r${i}.txt:fontcolor=white:fontsize=54:x=48:y=h-316`);
    }
    /* Subtítulos */
    trozos(texto, dur - 0.3).forEach((s, k) => {
      fs.writeFileSync(path.join(tmp, `t${i}_${k}.txt`), s.g);
      filtros.push(`drawtext=fontfile=BarlowCondensed-Medium.ttf:textfile=t${i}_${k}.txt:fontcolor=white:fontsize=50:box=1:boxcolor=0x000000@0.72:boxborderw=14:x=(w-tw)/2:y=h-150:enable='between(t,${s.a.toFixed(2)},${s.b.toFixed(2)})'`);
    });
    const seg = `s${String(i + 1).padStart(3, "0")}.mp4`;
    ff(["-loop", "1", "-framerate", String(FPS), "-i", img, "-i", wav, "-t", dur.toFixed(2),
      "-filter_complex", `[0:v]${filtros.join(",")}[v];[1:a]aresample=48000,apad,aformat=channel_layouts=stereo[a]`, "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", seg], tmp);
    segs.push(seg);
  });

  /* Cierre (4 s): la acción */
  const ultima = cap.r[cap.r.length - 1];
  fs.writeFileSync(path.join(tmp, "c1.txt"), "ESTA SEMANA");
  fs.writeFileSync(path.join(tmp, "c2.txt"), (ultima[4] || cap.titulo).toUpperCase());
  ff(["-f", "lavfi", "-i", `color=c=0x0B0F14:s=${W}x${H}:r=${FPS}:d=4`, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "4",
    "-vf", `drawtext=fontfile=BarlowCondensed-Bold.ttf:textfile=c1.txt:fontcolor=${ORO}:fontsize=56:x=(w-tw)/2:y=h/2-100,drawtext=fontfile=BarlowCondensed-Bold.ttf:textfile=c2.txt:fontcolor=white:fontsize=84:x=(w-tw)/2:y=h/2`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest", "s999.mp4"], tmp);
  segs.push("s999.mp4");
  total += 4;

  fs.writeFileSync(path.join(tmp, "lista.txt"), segs.map((s) => `file '${s}'`).join("\n"));
  const fin = path.join(SAL, `castilla-por-dentro-${String(cap.n).padStart(2, "0")}.mp4`);
  ff(["-f", "concat", "-safe", "0", "-i", "lista.txt", "-c", "copy", "-movflags", "+faststart", fin], tmp);
  const desvio = (total - cap.duracion_obj_s) / cap.duracion_obj_s;
  checks.push(`| ${cap.n} | ${Math.round(total)} s | ${cap.duracion_obj_s} s | ${(desvio * 100).toFixed(0)} % | ${Math.abs(desvio) <= 0.15 ? "pasa" : "fuera de ±15 %"} |`);
  console.log(fin, Math.round(total) + " s");
}
fs.writeFileSync(path.join(SAL, "checks-montaje.md"), checks.join("\n") + "\n");
