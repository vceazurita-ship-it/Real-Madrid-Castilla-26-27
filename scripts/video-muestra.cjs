/*
|--------------------------------------------------------------------------
| VÍDEO DE MUESTRA DEL INFORME (14/10/2026)
|--------------------------------------------------------------------------
|
|   node scripts/video-muestra.cjs <carpeta>          hoja de fotogramas
|   node scripts/video-muestra.cjs <carpeta> --mp4    y el vídeo entero
|
| Saca también `vertical.png`: la pieza para jugadores en 9:16 (21/10/2026).
| Desde el 22/10/2026, la previa y el post por separado, como salen de
| verdad (el balance es sólo del post): `hoja.png` y `vertical.png` son la
| previa; `hoja-post.png` y `vertical-post.png`, el post.
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
const G = require("../lib/video-informe/guion.ts");
const V = require("../lib/video-informe/vertical.ts");

const RAIZ = path.join(__dirname, "..");
const salida = path.resolve(process.argv[2] ?? "video-muestra");
const conMp4 = process.argv.includes("--mp4");

fs.mkdirSync(salida, { recursive: true });

for (const f of ["BarlowCondensed-Bold.ttf", "BarlowCondensed-SemiBold.ttf", "BarlowCondensed-Medium.ttf"]) GlobalFonts.registerFromPath(path.join(RAIZ, "public/fuentes", f), "Barlow Condensed");

const fuente = `"Barlow Condensed", Arial, sans-serif`;
const racha = (t) => t.split("");

const once = [
  [0.5, 0.04], [0.15, 0.22], [0.38, 0.18], [0.62, 0.18], [0.85, 0.22], [0.3, 0.42], [0.5, 0.38], [0.7, 0.42], [0.18, 0.66], [0.5, 0.72], [0.82, 0.66],
].map(([x, y], i) => ({ nombre: ["Destiny", "Moi Parra", "Zarzana", "Luismi", "Gené", "Pérez", "Ruiz", "Torres", "Núñez", "Díaz", "Gil"][i], dorsal: String(i + 1), posicion: "", foto: "", x, y, destacado: i === 9 || i === 10 }));

const guion = {
  titulo: "Antequera CF · previa",
  escenas: [
    /* Desde el 20/10/2026, como los arma `guion.ts`: el gancho a casi toda la pantalla con una línea, títulos que dicen la conclusión, claves de una en una y la consigna al final. */
    { id: "gancho", tipo: "gancho", dato: "2.º", antetitulo: "Antequera CF · su mejor arma", rotulo: "DE LA LIGA EN CENTROS AL ÁREA", contexto: "Antequera CF, de 20 equipos de la categoría: su mejor arma (17,4 por partido).", locucion: "Antequera es segundo de veinte en centros al área." },
    { id: "portada", tipo: "portada", titulo: "Antequera CF", subtitulo: "Jornada 8 · Domingo 18 de octubre · en casa", sello: "PREVIA", escudoNosotros: "/logo.png", escudoRival: null, idea: "Defendemos el segundo palo en los córners", locucion: "Antequera, en casa." },
    { id: "contexto", tipo: "contexto", titulo: "Ellos llegan por delante: 5º contra 12º", equipos: [{ nombre: "Real Madrid Castilla", nuestro: true, puesto: 12, puntos: 9, racha: racha("EPEGP") }, { nombre: "Antequera CF", nuestro: false, puesto: 5, puntos: 13, racha: racha("GGEPG") }], locucion: "Doce contra cinco." },
    { id: "pronostico", tipo: "barras", titulo: "Victoria: 38 %; con el plan, 45 %", barras: [{ rotulo: "Victoria", valor: 0.38, texto: "38 %" }, { rotulo: "Empate", valor: 0.29, texto: "29 %" }, { rotulo: "Derrota", valor: 0.33, texto: "33 %" }, { rotulo: "Con el plan", valor: 0.45, texto: "45 %" }], locucion: "El modelo nos da un 38 por ciento de victoria; con el plan, un 45." },
    { id: "once", tipo: "once", titulo: "Su once previsto: en oro, a quién vigilar", jugadores: once, locucion: "Así se colocan." },
    { id: "clips", tipo: "clips", titulo: "Así nos atacan: córner ofensivo y centro lateral", segundos: 12, locucion: "Mira: bloqueo al primer palo y remate en el segundo.", cortes: [{ url: "x", rotulo: "Córner ofensivo · VS EUROPA · J7", texto: "Bloqueo al primer palo y remate en el segundo." }, { url: "x", rotulo: "Centro lateral · VS IBIZA · J6", texto: "El lateral llega a línea de fondo y centra atrás." }] },
    /* Desde el 21/10/2026, en dos escenas de dos tarjetas. */
    { id: "fases", tipo: "fases", titulo: "Así juegan", fases: [{ titulo: "Salida", texto: "Salen en corto con los centrales abiertos; si les presionan, balón largo" }, { titulo: "Ataque", texto: "Cargan el área con centros desde los dos costados." }], dano: [], locucion: "Cómo juegan." },
    { id: "fases-2", tipo: "fases", titulo: "Y por dónde hacerles daño", fases: [{ titulo: "Defensa", texto: "Bloque medio en 4-4-2, juntos por dentro; al robar buscan rápido al extremo derecho." }], dano: ["Espalda de los laterales cuando suben", "Segundo palo en sus córners defensivos"], locucion: "Y por dónde hacerles daño." },
    /* «Fuertes en centros» y «Nos sacan ventaja en centros» decían lo mismo: el guion deja la comparativa (21/10/2026). */
    false && { id: "percentiles", tipo: "percentiles", titulo: "Fuertes en centros, flojos en presión", pie: "Percentil contra los equipos de Primera Federación · datos hasta la J7", filas: [{ nombre: "Ataque posicional", percentil: 71 }, { nombre: "Centros", percentil: 94 }, { nombre: "Transición ofensiva", percentil: 48 }, { nombre: "Presión", percentil: 22 }, { nombre: "Defensa del área", percentil: 63 }, { nombre: "Balón parado", percentil: 80 }], locucion: "Fase a fase." },
    { id: "versus", tipo: "versus", titulo: "Nos sacan ventaja en centros", pie: "Media por partido esta temporada · la raya, la mediana de los 20 equipos", filas: [{ nombre: "Centros", nuestro: 9.1, suyo: 17.4, textoNuestro: "9,1", textoSuyo: "17", media: 12.3, mejorAlto: true }, { nombre: "Goles esperados", nuestro: 1.1, suyo: 1.6, textoNuestro: "1,1", textoSuyo: "1,6", media: 1.3, mejorAlto: true }, { nombre: "Recuperaciones altas", nuestro: 8.2, suyo: 4.1, textoNuestro: "8,2", textoSuyo: "4,1", media: 6, mejorAlto: true }, { nombre: "Posesión", nuestro: 56, suyo: 47, textoNuestro: "56 %", textoSuyo: "47 %", media: 50, mejorAlto: true }, { nombre: "Remates concedidos", nuestro: 11.4, suyo: 9.2, textoNuestro: "11", textoSuyo: "9,2", media: 10.5, mejorAlto: false }], locucion: "Donde más nos separamos." },
    { id: "vigilar", tipo: "vigilar", titulo: "A vigilar: Díaz y Gil", jugadores: once.slice(9).map((j, i) => ({ ...j, texto: ["Peligro de cabeza a balón parado", "Busca el desmarque al primer palo"][i] })), locucion: "Sus hombres a vigilar." },
    { id: "duelos", tipo: "duelos", titulo: "Ganamos en banda derecha; sufrimos en área", duelos: [{ titulo: "Banda derecha", nuestros: "Fortea · Mesonero", suyos: "Moi Parra · Zarzana", veredicto: "ventaja", texto: "Les ganamos en duelos y en llegadas por ese costado" }, { titulo: "Centro del campo", nuestros: "Cestero · Thiago", suyos: "Luismi · Gené", veredicto: "parejo", texto: "Igualados en pases progresivos." }, { titulo: "Área", nuestros: "Joan Martínez · Mario Rivas", suyos: "Destiny", veredicto: "desventaja", texto: "Su 9 gana el 61 % de los duelos aéreos." }], locucion: "Los duelos." },
    /* Nuestras llegadas del último partido (cortes de Hudl, con su tipo y minuto): el rótulo dice «34' · Remate» y se retira a los 3,5 s. */
    { id: "clips-2", tipo: "clips", titulo: "Así llegamos en la J7: lo repetimos", segundos: 13.4, locucion: "Así llegamos.", marcas: [{ minuto: 34, gol: false, de: "nosotros" }, { minuto: 67, gol: true, de: "nosotros" }], cortes: [{ url: "x", rotulo: "Remate · 34'", tipo: "remate", minuto: "34'", minutoNum: 34, de: "nosotros", segundos: 6, zona: { tercio: 2, carril: 1 }, desdeZona: { tercio: 2, carril: 2 } }, { url: "x", rotulo: "Gol · 67'", tipo: "gol", minuto: "67'", minutoNum: 67, de: "nosotros", segundos: 3, zona: { tercio: 2, carril: 1 }, desdeZona: { tercio: 1, carril: 0 } }, { url: "x", rotulo: "Gol · 67'", tipo: "gol", minuto: "67'", minutoNum: 67, de: "nosotros", segundos: 4.4, repeticion: true, velocidad: 0.5 }] },
    /* Desde el 21/10/2026: cada clave es una consigna (presente, «nosotros») y, debajo, su dato. */
    { id: "claves", tipo: "claves", titulo: "Tres claves para ganar el partido", lineas: ["Defendemos el segundo palo en los córners", "Atacamos la espalda del lateral derecho", "Cerramos el pasillo interior a su 10"], pies: ["3 de sus 5 goles", "Sube en el 70 % de sus ataques", "Recibe entre líneas 8 veces por partido"], locucion: "Tres claves." },
    /* Un único cierre (21/10/2026) que contesta al gancho (22/10/2026): la consigna y, debajo, contra qué. */
    { id: "cierre", tipo: "cierre", titulo: "Nuestra consigna", lineas: [G.consigna("Defender el segundo palo en los córners: 3 de sus 5 goles.", 9)], pie: "Contra su 2.º en centros al área", locucion: "Nuestra consigna." },
  ].filter(Boolean),
};

/* El orden de verdad (22/10/2026): sus acciones antes de su once y ninguna racha de más de dos láminas de datos sin una jugada. */
{
  const io = guion.escenas.findIndex((e) => e.id === "once");
  const ic = guion.escenas.findIndex((e) => e.id === "clips");

  if (io >= 0 && ic > io) guion.escenas.splice(io, 0, guion.escenas.splice(ic, 1)[0]);
}

guion.escenas = G.intercalaCortes(guion.escenas);

/* El post (22/10/2026), aparte: lo que buscábamos, los goles, los datos, a quién frenamos, el balance y la consigna. */
const guionPost = {
  titulo: "Antequera CF · post",
  escenas: G.intercalaCortes(
    [
      { id: "gancho", tipo: "gancho", dato: "3-2", antetitulo: "Antequera CF · J8", rotulo: "REMONTAMOS CON UNO MÁS DESDE EL 57'", contexto: "", locucion: "Remontamos tres a dos." },
      { id: "portada", tipo: "portada", titulo: "Antequera CF", subtitulo: "Jornada 8 · Domingo 18 de octubre · en casa", sello: "POST · 3-2", escudoNosotros: "/logo.png", escudoRival: null, idea: "Esta semana, cerramos los partidos con ventaja", locucion: "Antequera, tres a dos." },
      G.escenaPlan(["Ganar", "Mandar con el balón", "Defender sin balón su juego directo", "Salir rápido al robar"]),
      { id: "clips-1", tipo: "clips", titulo: "Así remontamos", segundos: 14, locucion: "Los goles.", marcas: [{ minuto: 40, gol: true, de: "rival" }, { minuto: 45, gol: true, de: "nosotros" }, { minuto: 53, gol: true, de: "nosotros" }], cortes: [{ url: "x", rotulo: "Gol · 45'", tipo: "gol", minuto: "45'", minutoNum: 45, de: "nosotros", segundos: 7, zona: { tercio: 2, carril: 1 }, desdeZona: { tercio: 2, carril: 0 } }, { url: "x", rotulo: "Gol · 53'", tipo: "gol", minuto: "53'", minutoNum: 53, de: "nosotros", segundos: 7, zona: { tercio: 2, carril: 2 } }] },
      { id: "versus", tipo: "versus", titulo: "Dominamos en goles esperados", pie: "", filas: [{ nombre: "Goles esperados", nuestro: 3.46, suyo: 0.75, textoNuestro: "3,5", textoSuyo: "0,8", media: 1.3, mejorAlto: true }, { nombre: "Entradas al área", nuestro: 41, suyo: 12, textoNuestro: "41", textoSuyo: "12", media: 25, mejorAlto: true }, { nombre: "Posesión", nuestro: 63.7, suyo: 36.3, textoNuestro: "64 %", textoSuyo: "36 %", media: 50, mejorAlto: true }] },
      { id: "vigilar", tipo: "vigilar", titulo: "Frenamos a 2 de 3 de sus peligrosos", jugadores: [{ nombre: "Destiny", dorsal: "9", posicion: "", foto: "", x: 0, y: 0, destacado: false, texto: "Marcó en el 90+1' con 3-1" }, { nombre: "Gené", dorsal: "10", posicion: "", foto: "", x: 0, y: 0, destacado: true, texto: "Sin gol ni asistencia" }, { nombre: "Gutiérrez", dorsal: "7", posicion: "", foto: "", x: 0, y: 0, destacado: true, texto: "Sin gol ni asistencia" }], locucion: "A quién frenamos." },
      /* Sólo filas medidas (sin «pendiente») y de una en una, con el recuento al final. */
      G.escenaBalance([
        { que: "El resultado", buscabamos: "Ganar", logramos: "Victoria 3-2", estado: "si" },
        { que: "Con balón", buscabamos: "Mandar con el balón", logramos: "64 % de la posesión · 41 entradas al área", estado: "si" },
        { que: "Sin balón", buscabamos: "Defender su juego directo", logramos: "0,8 goles esperados suyos (1,6 de media)", estado: "si" },
        { que: "Transición", buscabamos: "Salir rápido al robar", logramos: "0 contraataques (0,7 de media)", estado: "no" },
      ]).escena,
      { id: "cierre", tipo: "cierre", titulo: "Nuestra consigna", lineas: ["Esta semana, cerramos los partidos con ventaja"], pie: "Nos marcaron en el 90+1' con 3-1 y uno más", locucion: "Nuestra consigna." },
    ].filter(Boolean),
  ),
};

/* Lo que va en la pieza de jugadores del post (la lista blanca de `consignasDePartido`). */
const CONSIGNAS_POST = new Set(["gancho", "portada", "clips-1", "balance", "cierre"]);

/* La pieza «Consignas» para los jugadores (20/10/2026): la lista blanca de `consignasDePartido`. */
const CONSIGNAS = new Set(["gancho", "portada", "vigilar", "clips", "claves", "cierre"]);

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

  /* Como el montaje de verdad: el escudo del rival y las fotos sólo si existen (aquí, ninguno: sale su nombre y el dorsal). */
  for (const e of [...guion.escenas, ...guionPost.escenas]) if (e.tipo === "portada") imagenes.set(`${e.id}:nosotros`, logo);

  const rec = { imagenes };
  const medidas = D.reparteEscenas(guion, null, 48000);
  const total = medidas.reduce((s, m) => s + m.segundos, 0);
  const arranques = [];

  medidas.reduce((s, m) => (arranques.push(s), s + m.segundos), 0);

  /* En Full HD, como sale el vídeo de verdad (15/10/2026). */
  const lienzo = createCanvas(D.ANCHO_HD, D.ALTO_HD);
  const ctx = lienzo.getContext("2d");
  const grano = createCanvas(256, 256);
  const cuadro = cuadroDeMentira();

  D.rellenaGrano(grano.getContext("2d"));

  const marcas = arranques.slice(1).map((a) => a / total);
  const pinta = (k, t) => {
    const m = medidas[k];

    D.pintaFotograma(ctx, grano, fuente, guion.titulo, rec, { medida: m, t, global: arranques[k] + t, progreso: (arranques[k] + t) / total, restante: m.segundos - t, cuadro: m.escena.tipo === "clips" ? cuadro : null, marcas });
  };

  /* En los cortes, el centro de la segunda jugada (no el parpadeo entre dos, que dura 0,15 s y parecía un campo vacío). */
  const mitadDeCorte = (m) => {
    const l = D.limitesDeCortes(m.escena, m.segundos);
    const c = l[Math.min(1, l.length - 1)];

    return c.desde + Math.min(2.2, c.dura / 2);
  };

  /* La hoja: de cada escena, la entrada y el momento lleno. */
  const hojaDe = async (g, nombre) => {
    const md = D.reparteEscenas(g, null, 48000);
    const tot = md.reduce((s, m) => s + m.segundos, 0);
    const arr = [];

    md.reduce((s, m) => (arr.push(s), s + m.segundos), 0);

    const hoja = createCanvas(640 * 2, 360 * md.length);
    const h = hoja.getContext("2d");

    /* El momento «lleno», a los 3,4 s o más tarde en las escenas que van de una en una (claves y balance). */
    md.forEach((m, k) =>
      [0.8, m.escena.tipo === "clips" ? mitadDeCorte(m) : Math.min(Math.max(3.4, m.segundos * 0.72), m.segundos - 0.6)].forEach((t, j) => {
        D.pintaFotograma(ctx, grano, fuente, g.titulo, rec, { medida: m, t, global: arr[k] + t, progreso: (arr[k] + t) / tot, restante: m.segundos - t, cuadro: m.escena.tipo === "clips" ? cuadro : null, marcas: arr.slice(1).map((a) => a / tot) });
        h.drawImage(lienzo, j * 640, k * 360, 640, 360);
      }),
    );

    fs.writeFileSync(path.join(salida, nombre), await hoja.encode("png"));
    console.log(`${nombre}: ${md.length} escenas, ${tot.toFixed(1)} s`);
    console.log(md.map((m) => `  ${m.escena.id.padEnd(12)} ${m.segundos.toFixed(1).padStart(5)} s`).join(String.fromCharCode(10)));
  };

  await hojaDe(guion, "hoja.png");
  await hojaDe(guionPost, "hoja-post.png");

  /* Lo que duraría la pieza «Consignas» con estas escenas (tope 75 s). */
  const consignas = D.reparteEscenas({ ...guion, escenas: guion.escenas.filter((e) => CONSIGNAS.has(e.id)) }, null, 48000, G.SEGUNDOS_CONSIGNAS);

  console.log(`Consignas: ${consignas.length} escenas, ${consignas.reduce((s, m) => s + m.segundos, 0).toFixed(1)} s`);

  /* La pieza para jugadores en vertical: 1080×1920, tres momentos de cada escena (la portada, desde su primer fotograma: es la miniatura). */
  const lienzoV = createCanvas(V.ANCHO_V_HD, V.ALTO_V_HD);
  const ctxV = lienzoV.getContext("2d");
  const verticalDe = async (g, lista, nombre) => {
    const guionV = V.paraVertical({ ...g, escenas: g.escenas.filter((e) => lista.has(e.id)) });
    const medidasV = D.reparteEscenas(guionV, null, 48000, G.SEGUNDOS_CONSIGNAS, G.SEGUNDOS_CONSIGNAS_MINIMOS);
    const totalV = medidasV.reduce((s, m) => s + m.segundos, 0);
    const arranquesV = [];

    medidasV.reduce((s, m) => (arranquesV.push(s), s + m.segundos), 0);

    const hojaV = createCanvas(360 * 3, 640 * medidasV.length);
    const hv = hojaV.getContext("2d");

    medidasV.forEach((m, k) => {
      const lleno = m.escena.tipo === "clips" ? mitadDeCorte(m) : Math.min(Math.max(3.4, m.segundos * 0.5), m.segundos - 0.6);
      const momentos = k === 0 ? [0, 1.5, m.segundos - 0.6] : [0.8, lleno, m.segundos - 0.6];

      momentos.forEach((t, j) => {
        V.pintaFotogramaVertical(ctxV, grano, fuente, rec, { medida: m, t, global: arranquesV[k] + t, progreso: (arranquesV[k] + t) / totalV, restante: m.segundos - t, cuadro: m.escena.tipo === "clips" ? cuadro : null });
        hv.drawImage(lienzoV, j * 360, k * 640, 360, 640);
      });
    });

    fs.writeFileSync(path.join(salida, nombre), await hojaV.encode("png"));
    console.log(`${nombre}: ${medidasV.length} escenas, ${totalV.toFixed(1)} s`);
    console.log(medidasV.map((m) => `  ${m.escena.id.padEnd(12)} ${m.segundos.toFixed(1).padStart(5)} s`).join(String.fromCharCode(10)));

    return medidasV;
  };

  const medidasV = await verticalDe(guion, CONSIGNAS, "vertical.png");

  await verticalDe(guionPost, CONSIGNAS_POST, "vertical-post.png");

  /* Y el primer fotograma suelto, a tamaño de miniatura de WhatsApp. */
  V.pintaFotogramaVertical(ctxV, grano, fuente, rec, { medida: medidasV[0], t: 0, global: 0, progreso: 0, restante: medidasV[0].segundos, cuadro: null });
  fs.writeFileSync(path.join(salida, "vertical-miniatura.png"), await lienzoV.encode("png"));

  if (!conMp4) return;

  let ffmpeg = "ffmpeg";

  try {
    const estatico = require("ffmpeg-static");

    if (estatico && fs.existsSync(estatico)) ffmpeg = estatico;
  } catch {
    /* El del PATH. */
  }

  const destino = path.join(salida, "muestra.mp4");
  const proceso = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${D.ANCHO_HD}x${D.ALTO_HD}`, "-r", String(D.FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-preset", "veryfast", destino], { stdio: ["pipe", "inherit", "inherit"] });
  const escribe = (buf) => new Promise((ok) => (proceso.stdin.write(buf) ? ok() : proceso.stdin.once("drain", ok)));

  for (let k = 0; k < medidas.length; k++) {
    const fotogramas = Math.round(medidas[k].segundos * D.FPS);

    for (let i = 0; i < fotogramas; i++) {
      pinta(k, i / D.FPS);
      /* Los píxeles del lienzo sin copiarlos (como el script del club): getImageData creaba 3,6 MB por fotograma. */
      await escribe(lienzo.data());
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
