/**
 * RECOGE NUESTROS VÍDEOS DE ABP DE LA JORNADA (17/10/2026).
 *
 *   node scripts/abp/video-jugadores.cjs            (lo lanza el vigía cuando cambia la carpeta)
 *   node scripts/abp/video-jugadores.cjs --solo-ver (dice qué haría, sin subir nada)
 *
 * Mira `C:\Users\Usuario\Downloads\RMCF CASTILLA\ABP\VIDEO - JUGADORES`. Cada
 * vídeo nuevo o cambiado (tamaño o fecha) se deja en ≤45 MB con ffmpeg —el
 * bucket no admite más de 50 MB por fichero y el almacén entero es de 1 GB—,
 * se saca un póster, se sube y se apunta en `abp:video-jugadores`
 * (lib/abp/video-jugadores.ts). Sólo se guardan los últimos CUATRO: los
 * anteriores se borran del almacén.
 *
 * Un fichero que todavía se está copiando (cambiado hace menos de 90 s, o que
 * sigue creciendo: la copia de Windows conserva la fecha del original) se deja
 * para la siguiente vuelta. Termina con «RESUMEN: …».
 */

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");

require(path.join(RAIZ, "scripts/cargador-ts.cjs"));

const { createClient } = require(path.join(RAIZ, "node_modules/@supabase/supabase-js"));
const { entorno } = require(path.join(RAIZ, "scripts/supabase-local.cjs"));
const { VIDEO_JUGADORES_KEY, VIDEO_JUGADORES_KIND, jornadaDeNombre, normalizaVideosJugadores } = require(path.join(RAIZ, "lib/abp/video-jugadores.ts"));

const CARPETA = process.env.VIDEO_JUGADORES_DIR || "C:\\Users\\Usuario\\Downloads\\RMCF CASTILLA\\ABP\\VIDEO - JUGADORES";
const FFMPEG = path.join(RAIZ, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const BUCKET = "performance";
const TEMPORAL = path.join(RAIZ, ".cache", "video-jugadores");
const VIDEO = /\.(mp4|mov|m4v|avi|mkv)$/i;
const TOPE_MB = 45;
const SE_GUARDAN = 4;
const SOLO_VER = process.argv.includes("--solo-ver");

function termina(codigo, resumen) {
  console.log(`RESUMEN: ${resumen}`);
  process.exitCode = codigo;
}

function ff(args) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) reject(Object.assign(new Error(String(stderr || error.message).slice(-400)), { stderr: String(stderr ?? "") }));
      else resolve(String(stderr ?? ""));
    });
  });
}

/** La duración, de lo que ffmpeg dice al abrirlo (no hay ffprobe en ffmpeg-static). */
async function duracion(fichero) {
  const texto = await ff(["-hide_banner", "-i", fichero]).catch((e) => e.stderr ?? "");
  const m = texto.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);

  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** Lo deja en ≤45 MB: tasa calculada por su duración; 1080p si da para ello, si no 720p. */
async function comprime(entrada, salida, segundos) {
  let factor = 1;

  for (let intento = 0; intento < 3; intento += 1) {
    const kbps = Math.max(250, Math.min(5000, Math.floor(((TOPE_MB * 8192) / Math.max(1, segundos)) * 0.92 * factor) - 96));
    const alto = kbps >= 2500 ? 1080 : 720;

    await ff([
      "-y", "-loglevel", "error", "-i", entrada,
      "-vf", `scale=-2:'min(${alto},ih)'`,
      "-c:v", "libx264", "-preset", "veryfast",
      "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.3)}k`, "-bufsize", `${kbps * 2}k`,
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "2",
      "-movflags", "+faststart", salida,
    ]);

    const mb = fs.statSync(salida).size / 1048576;

    if (mb <= 49) return mb;

    factor *= 0.8;
  }

  throw new Error("no baja de 49 MB ni comprimiéndolo más");
}

async function principal() {
  if (!fs.existsSync(CARPETA)) return termina(0, `no existe la carpeta ${CARPETA}`);

  const env = entorno();

  if (!env) return termina(1, "faltan las claves de Supabase en .env.local");

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const lee = async () => {
    const { data, error } = await supabase.from("app_documents").select("data").eq("key", VIDEO_JUGADORES_KEY).maybeSingle();

    if (error) throw new Error(error.message);

    return normalizaVideosJugadores(data?.data);
  };
  const guarda = async (doc) => {
    const { error } = await supabase
      .from("app_documents")
      .upsert({ key: VIDEO_JUGADORES_KEY, kind: VIDEO_JUGADORES_KIND, data: doc, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) throw new Error(error.message);
  };

  const doc = await lee();
  const ficheros = fs
    .readdirSync(CARPETA)
    .filter((f) => VIDEO.test(f))
    .map((nombre) => {
      const st = fs.statSync(path.join(CARPETA, nombre));

      return { nombre, tamano: st.size, mtime: Math.round(st.mtimeMs) };
    });
  const nuevos = ficheros.filter((f) => {
    const ya = doc.videos[f.nombre];

    return !ya || ya.origen?.tamano !== f.tamano || ya.origen?.mtime !== f.mtime;
  });
  /* Una fecha en el futuro (reloj de la cámara) no es «recién copiado»: lo que cuenta es que el tamaño ya no cambie. */
  if (nuevos.length) await new Promise((r) => setTimeout(r, 5000));
  const copiandose = nuevos.filter((f) => {
    const edad = Date.now() - f.mtime;
    let ahora = f.tamano;

    try {
      ahora = fs.statSync(path.join(CARPETA, f.nombre)).size;
    } catch {}

    return ahora !== f.tamano || (edad >= 0 && edad < 90_000);
  });
  const aSubir = nuevos.filter((f) => !copiandose.includes(f));

  console.log(`  ${ficheros.length} vídeos en la carpeta · ${aSubir.length} por subir · ${copiandose.length} copiándose`);

  if (SOLO_VER) {
    for (const f of aSubir) console.log(`  subiría «${f.nombre}» (jornada ${jornadaDeNombre(f.nombre) ?? "¿?"}, ${Math.round(f.tamano / 1048576)} MB)`);

    return termina(0, `${aSubir.length} por subir`);
  }

  fs.mkdirSync(TEMPORAL, { recursive: true });

  const hechos = [];
  const fallos = [];

  for (const f of aSubir) {
    const origen = path.join(CARPETA, f.nombre);
    const salida = path.join(TEMPORAL, "video.mp4");
    const poster = path.join(TEMPORAL, "poster.jpg");
    const jornada = jornadaDeNombre(f.nombre);
    const base = `abp/video-jugadores/${jornada ? `j${String(jornada).padStart(2, "0")}` : "sin-jornada"}-${Date.now()}`;

    try {
      console.log(`PASO: comprimiendo «${f.nombre}»`);

      const segundos = await duracion(origen);

      if (!segundos) throw new Error("ffmpeg no sabe cuánto dura");

      const mb = await comprime(origen, salida, segundos);

      await ff(["-y", "-loglevel", "error", "-ss", String(Math.min(segundos * 0.1, 30)), "-i", salida, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "4", poster]).catch(() => undefined);

      console.log(`PASO: subiendo «${f.nombre}» (${mb.toFixed(1)} MB)`);

      const subeUno = async (fichero, destino, tipo) => {
        const { error } = await supabase.storage.from(BUCKET).upload(destino, fs.readFileSync(fichero), { contentType: tipo, upsert: true });

        if (error) throw new Error(error.message);

        return supabase.storage.from(BUCKET).getPublicUrl(destino).data.publicUrl;
      };
      const url = await subeUno(salida, `${base}.mp4`, "video/mp4");
      const posterUrl = fs.existsSync(poster) ? await subeUno(poster, `${base}.jpg`, "image/jpeg").catch(() => null) : null;

      /* Relee antes de escribir: otra pasada no se pisa. Lo anterior de este mismo fichero se borra del almacén. */
      const actual = await lee();
      const viejo = actual.videos[f.nombre];

      if (viejo) await supabase.storage.from(BUCKET).remove([viejo.ruta, viejo.posterRuta].filter(Boolean));

      actual.videos[f.nombre] = {
        nombre: f.nombre,
        jornada,
        url,
        poster: posterUrl,
        segundos: Math.round(segundos),
        mb: Math.round(mb * 10) / 10,
        origen: { tamano: f.tamano, mtime: f.mtime },
        ruta: `${base}.mp4`,
        posterRuta: posterUrl ? `${base}.jpg` : null,
        subidoEn: new Date().toISOString(),
      };

      /* Sólo los cuatro últimos: el almacén es de 1 GB. */
      const sobran = Object.values(actual.videos)
        .sort((a, b) => b.subidoEn.localeCompare(a.subidoEn))
        .slice(SE_GUARDAN);

      for (const v of sobran) {
        await supabase.storage.from(BUCKET).remove([v.ruta, v.posterRuta].filter(Boolean));
        delete actual.videos[v.nombre];
      }

      await guarda(actual);
      hechos.push(`${f.nombre} (${jornada ? `J${jornada}` : "sin jornada en el nombre"}, ${mb.toFixed(0)} MB)`);
    } catch (error) {
      fallos.push(`${f.nombre}: ${String(error?.message ?? error).slice(0, 120)}`);
      console.log(`  FALLO: ${f.nombre}: ${error?.message ?? error}`);
    } finally {
      fs.rmSync(salida, { force: true });
      fs.rmSync(poster, { force: true });
    }
  }

  const partes = [hechos.length ? `subidos ${hechos.join(" · ")}` : "", fallos.length ? `fallaron ${fallos.join(" · ")}` : "", copiandose.length ? `${copiandose.length} todavía copiándose` : ""].filter(Boolean);

  return termina(fallos.length && !hechos.length ? 1 : 0, partes.join(" · ") || "nada nuevo en la carpeta");
}

principal().catch((error) => termina(1, `se ha roto: ${error?.message ?? error}`));
