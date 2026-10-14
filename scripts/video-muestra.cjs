/*
|--------------------------------------------------------------------------
| VÍDEO DE MUESTRA DEL INFORME (14/10/2026)
|--------------------------------------------------------------------------
|
|   node scripts/video-muestra.cjs <carpeta>          hoja de fotogramas
|   node scripts/video-muestra.cjs <carpeta> --mp4    y el vídeo entero
|
| Pinta un informe inventado con TODOS los tipos de escena del vídeo (los de
| siempre y los de datos: gancho, contexto, versus, percentiles, duelos y
| fases) con el mismo dibujo que el navegador y el ordenador del club
| (`lib/video-informe/dibujo.ts`), sin red ni datos de verdad.
|
| Lo lanza GitHub cada vez que se toca el vídeo (.github/workflows/
| video-muestra.yml) y deja la hoja y el mp4 como adjunto de la ejecución:
| se ve cómo queda un cambio de diseño sin mandar un informe. Necesita
| @napi-rs/canvas (viene con pdfjs-dist) y, para el mp4, un ffmpeg en el PATH
| o el de ffmpeg-static.
*/

/* Un fallo al cargar (una librería que falta) no pasa por el catch de abajo: también como aviso de GitHub. */
process.on("uncaughtException", (e) => {
  console.error(e);

  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Vídeo de muestra::${String(e?.stack ?? e).replaceAll("%", "%25").replaceAll("\n", "%0A")}`);

  process.exit(1);
});

require("./cargador-ts.cjs");

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const D = require("../lib/video-informe/dibujo.ts");

const RAIZ = path.join(__dirname, "..");
const salida = path.resolve(process.argv[2] ?? "video-muestra");
const conMp4 = process.argv.includes("--mp4");

fs.mkdirSync(salida, { recursive: true });

for (const f of ["BarlowCondensed-Bold.ttf", "BarlowCondensed-SemiBold.ttf", "BarlowCondensed-Medium.ttf"]) GlobalFonts.registerFromPath(path.join(RAIZ, "public/fuentes", f), "Barlow Condensed");

const fuente = `"Barlow Condensed", Arial, sans-serif`;
const racha = (t) => t.split("");

const once = [
  [0.5, 0.04], [0.15, 0.22], [0.38, 0.18], [0.62, 0.18], [0.85, 0.22], [0.3, 0.42], [0.5, 0.38], [0.7, 0.42], [0.18, 0.66], [0.5, 0.72], [0.82, 0.66],
].map(([x, y], i) => ({ nombre: ["Destiny", "Moi Parra", "Zarzana", "Luismi", "Gené", "Pérez", "Ruiz", "Torres", "Núñez", "Díaz", "Gil"][i], dorsal: String(i + 1), posicion: "", foto: "/logo.png", x, y, destacado: i === 9 || i === 10 }));

const guion = {
  titulo: "Antequera CF · previa",
  escenas: [
    { id: "gancho", tipo: "gancho", dato: "2º", rotulo: "CENTROS AL ÁREA", contexto: "Antequera CF, de 20 equipos de la categoría: su mejor arma (17,4 por partido).", locucion: "Antequera es segundo de veinte en centros al área." },
    { id: "portada", tipo: "portada", titulo: "Antequera CF", subtitulo: "Jornada 8 · Domingo 18 de octubre · en casa", sello: "PREVIA", escudoNosotros: "/logo.png", escudoRival: "/logo.png", locucion: "Antequera, en casa." },
    { id: "contexto", tipo: "contexto", titulo: "Cómo llegamos los dos", equipos: [{ nombre: "Real Madrid Castilla", nuestro: true, puesto: 12, puntos: 9, racha: racha("EPEGP") }, { nombre: "Antequera CF", nuestro: false, puesto: 5, puntos: 13, racha: racha("GGEPG") }], locucion: "Doce contra cinco." },
    { id: "pronostico", tipo: "barras", titulo: "Lo que dice el dato", barras: [{ rotulo: "Victoria", valor: 0.38, texto: "38 %" }, { rotulo: "Empate", valor: 0.29, texto: "29 %" }, { rotulo: "Derrota", valor: 0.33, texto: "33 %" }, { rotulo: "Con el plan", valor: 0.45, texto: "45 %" }], locucion: "El modelo nos da un 38 por ciento de victoria." },
    { id: "once", tipo: "once", titulo: "Su once previsto", jugadores: once, locucion: "Así se colocan." },
    { id: "fases", tipo: "fases", titulo: "Cómo juegan", fases: [{ titulo: "Salida", texto: "Salen en corto con los centrales abiertos; si les presionan, balón largo al 9." }, { titulo: "Ataque", texto: "Cargan el área con centros desde los dos costados." }, { titulo: "Defensa", texto: "Bloque medio en 4-4-2, juntos por dentro." }, { titulo: "Transición", texto: "Al robar buscan rápido al extremo derecho." }], dano: ["Espalda de los laterales cuando suben", "Segundo palo en sus córners defensivos"], locucion: "Cómo juegan." },
    { id: "clips", tipo: "clips", titulo: "Cómo juegan: acciones", segundos: 12, locucion: "Dos acciones suyas.", cortes: [{ url: "x", rotulo: "Córner ofensivo · VS EUROPA · J7", texto: "Bloqueo al primer palo y remate en el segundo." }, { url: "x", rotulo: "Centro lateral · VS IBIZA · J6", texto: "El lateral llega a línea de fondo y centra atrás." }] },
    { id: "percentiles", tipo: "percentiles", titulo: "Antequera CF, fase a fase", pie: "Percentil contra los equipos de Primera Federación · datos hasta la J7", filas: [{ nombre: "Ataque posicional", percentil: 71 }, { nombre: "Centros", percentil: 94 }, { nombre: "Transición ofensiva", percentil: 48 }, { nombre: "Presión", percentil: 22 }, { nombre: "Defensa del área", percentil: 63 }, { nombre: "Balón parado", percentil: 80 }], locucion: "Fase a fase." },
    { id: "versus", tipo: "versus", titulo: "Donde más nos separamos", pie: "Media por partido esta temporada · la raya, la mediana de los 20 equipos", filas: [{ nombre: "Centros", nuestro: 9.1, suyo: 17.4, textoNuestro: "9,1", textoSuyo: "17", media: 12.3, mejorAlto: true }, { nombre: "xG", nuestro: 1.1, suyo: 1.6, textoNuestro: "1,1", textoSuyo: "1,6", media: 1.3, mejorAlto: true }, { nombre: "Recuperaciones altas", nuestro: 8.2, suyo: 4.1, textoNuestro: "8,2", textoSuyo: "4,1", media: 6, mejorAlto: true }, { nombre: "Posesión", nuestro: 56, suyo: 47, textoNuestro: "56 %", textoSuyo: "47 %", media: 50, mejorAlto: true }, { nombre: "Remates concedidos", nuestro: 11.4, suyo: 9.2, textoNuestro: "11", textoSuyo: "9,2", media: 10.5, mejorAlto: false }], locucion: "Donde más nos separamos." },
    { id: "vigilar", tipo: "vigilar", titulo: "A vigilar", jugadores: once.slice(9).map((j) => ({ ...j, texto: "Remate de cabeza · desmarque al primer palo" })), locucion: "Sus hombres a vigilar." },
    { id: "duelos", tipo: "duelos", titulo: "Los duelos que deciden", duelos: [{ titulo: "Banda derecha", nuestros: "Fortea · Mesonero", suyos: "Moi Parra · Zarzana", veredicto: "ventaja", texto: "Les ganamos en duelos y en llegadas por ese costado." }, { titulo: "Centro del campo", nuestros: "Cestero · Thiago", suyos: "Luismi · Gené", veredicto: "parejo", texto: "Igualados en pases progresivos." }, { titulo: "Área", nuestros: "Joan Martínez · Mario Rivas", suyos: "Destiny", veredicto: "desventaja", texto: "Su 9 gana el 61 % de los duelos aéreos." }], locucion: "Los duelos." },
    { id: "claves", tipo: "claves", titulo: "Las claves", lineas: ["Defender el segundo palo en los córners: 3 de sus 5 goles.", "Atacar la espalda del lateral derecho cuando sube.", "Cerrar el pasillo interior a su 10."], locucion: "Tres claves." },
    { id: "cierre", tipo: "cierre", titulo: "El plan, en una frase", lineas: ["Cerrar sus centros y castigar la espalda de sus laterales."], locucion: "En una frase." },
  ],
};

/** Un fotograma de partido inventado para los cortes: césped a franjas y fichas. */
function cuadroDeMentira() {
  const c = createCanvas(1280, 720);
  const x = c.getContext("2d");

  for (let i = 0; i < 16; i++) {
    x.fillStyle = i % 2 ? "#2f7d3a" : "#2a7034";
    x.fillRect(i * 80, 0, 80, 720);
  }

  for (let i = 0; i < 9; i++) {
    x.fillStyle = "#eeeeee";
    x.beginPath();
    x.arc(200 + i * 110, 380 + (i % 3) * 60, 14, 0, 7);
    x.fill();
    x.fillStyle = "#1a2a6c";
    x.beginPath();
    x.arc(260 + i * 115, 330 + (i % 2) * 90, 14, 0, 7);
    x.fill();
  }

  return c;
}

(async () => {
  const logo = await loadImage(path.join(RAIZ, "public/logo.png"));
  const imagenes = new Map();

  for (const e of guion.escenas) {
    if (e.tipo === "portada") {
      imagenes.set(`${e.id}:nosotros`, logo);
      imagenes.set(`${e.id}:rival`, logo);
    }

    if (e.tipo === "once" || e.tipo === "vigilar") e.jugadores.forEach((_, i) => imagenes.set(`${e.id}:${i}`, logo));
  }

  const rec = { imagenes };
  const medidas = D.reparteEscenas(guion, null, 48000);
  const total = medidas.reduce((s, m) => s + m.segundos, 0);
  const arranques = [];

  medidas.reduce((s, m) => (arranques.push(s), s + m.segundos), 0);

  const lienzo = createCanvas(D.ANCHO, D.ALTO);
  const ctx = lienzo.getContext("2d");
  const grano = createCanvas(256, 256);
  const cuadro = cuadroDeMentira();

  D.rellenaGrano(grano.getContext("2d"));

  const marcas = arranques.slice(1).map((a) => a / total);
  const pinta = (k, t) => {
    const m = medidas[k];

    D.pintaFotograma(ctx, grano, fuente, guion.titulo, rec, { medida: m, t, global: arranques[k] + t, progreso: (arranques[k] + t) / total, restante: m.segundos - t, cuadro: m.escena.tipo === "clips" ? cuadro : null, marcas });
  };

  /* La hoja: de cada escena, la entrada y el momento lleno. */
  const hoja = createCanvas(640 * 2, 360 * medidas.length);
  const h = hoja.getContext("2d");

  medidas.forEach((m, k) =>
    [0.8, Math.min(3.4, m.segundos - 0.6)].forEach((t, j) => {
      pinta(k, t);
      h.drawImage(lienzo, j * 640, k * 360, 640, 360);
    }),
  );

  fs.writeFileSync(path.join(salida, "hoja.png"), await hoja.encode("png"));
  console.log(`${medidas.length} escenas, ${total.toFixed(1)} s → ${path.join(salida, "hoja.png")}`);

  if (!conMp4) return;

  let ffmpeg = "ffmpeg";

  try {
    const estatico = require("ffmpeg-static");

    if (estatico && fs.existsSync(estatico)) ffmpeg = estatico;
  } catch {
    /* El del PATH. */
  }

  const destino = path.join(salida, "muestra.mp4");
  const proceso = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${D.ANCHO}x${D.ALTO}`, "-r", String(D.FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-preset", "veryfast", destino], { stdio: ["pipe", "inherit", "inherit"] });
  const escribe = (buf) => new Promise((ok) => (proceso.stdin.write(buf) ? ok() : proceso.stdin.once("drain", ok)));

  for (let k = 0; k < medidas.length; k++) {
    const fotogramas = Math.round(medidas[k].segundos * D.FPS);

    for (let i = 0; i < fotogramas; i++) {
      pinta(k, i / D.FPS);
      await escribe(Buffer.from(ctx.getImageData(0, 0, D.ANCHO, D.ALTO).data.buffer));
    }
  }

  proceso.stdin.end();
  await new Promise((ok, mal) => proceso.on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg salió con ${c}`)))));
  console.log(`→ ${destino}`);
})().catch((e) => {
  console.error(e);

  /* En GitHub, también como aviso: se lee por la API sin iniciar sesión, el registro no. */
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Vídeo de muestra::${String(e?.stack ?? e).replaceAll("%", "%25").replaceAll("\n", "%0A")}`);

  process.exit(1);
});
