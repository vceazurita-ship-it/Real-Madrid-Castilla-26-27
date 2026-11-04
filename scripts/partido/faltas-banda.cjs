/**
 * FALTAS Y SAQUES DE BANDA DESDE EL TIMELINE DE HUDL (04/11/2026).
 *
 * Las reglas con las que se leen las faltas y los saques de banda del
 * timeline de Sportscode, en un solo sitio: las usan la base del análisis
 * (`preparar.cjs`), la pantalla de faltas (`faltas-datos.mjs`) y los cortes
 * de cada saque (`banda-cortes.mjs`). Salieron de cotejar J3-J10 contra la
 * hoja de banda y las faltas revisadas con la imagen:
 *
 * - Cada acción de jugador va en la referencia de SU equipo (el tercio y el
 *   carril, hacia la portería que ataca él). En una acción del rival hay que
 *   girar las dos cosas para contarla desde el Castilla.
 * - «Out of play foul» no es una falta: es la tarjeta a otro jugador con el
 *   balón ya parado (J3 99:21 y 101:29, J7 90:25, siempre a 2-3 s de la falta
 *   de verdad). Contarla daba una falta doble con el mismo saque.
 * - La infracción sin tipo (la de Pitarch del J6, 5:54) sí da falta.
 * - El saque de banda no lleva pase: el receptor es la siguiente acción.
 */

const fs = require("node:fs");
const path = require("node:path");

const { leeTimeline, uno, sinDorsal, mismoEquipo } = require("./comun.cjs");

/* ------------------------------------------------------------------ */
/*  DÓNDE ESTÁN LOS PARTIDOS                                           */
/* ------------------------------------------------------------------ */

/** La carpeta del club: dos niveles por encima del repo; desde una copia de trabajo (`.claude/worktrees/x`), cinco. */
const REPO = path.join(__dirname, "..", "..");
const CASA =
  [path.join(REPO, "..", ".."), path.join(REPO, "..", "..", "..", "..", "..")].find((c) => fs.existsSync(path.join(c, "PARTIDOS"))) ??
  path.join(REPO, "..", "..");

const CARPETAS = [path.join(CASA, "PARTIDOS", "ANALISIS"), path.join(CASA, "ANALISIS TRANSICIONES"), path.join(CASA, "HUDL ALCORCON")];

const leeJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};

/** La fecha del partido de una carpeta: del vídeo de Hudl, del partido.json o del nombre. */
function fechaDe(carpeta) {
  const v = leeJson(path.join(carpeta, "video-hudl.json"));
  const f = String(v?.titulo ?? "").match(/\d{4}-\d{2}-\d{2}/)?.[0];

  if (f) return f;

  const p = leeJson(path.join(carpeta, "partido.json"));

  if (/^\d{4}-\d{2}-\d{2}/.test(p?.fecha ?? "")) return p.fecha.slice(0, 10);

  return path.basename(carpeta).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

/**
 * Todos los timelines de nuestros partidos, uno por partido.
 *
 * El mismo timeline está a veces en dos carpetas (la del análisis y la de
 * transiciones): cuenta una vez y se queda la que tiene el vídeo
 * (`video-hudl.json` + `hls.json`), que es la que sirve para cortar. Las
 * otras copias se guardan en `copias` (la de transiciones lleva el slug).
 */
function partidosHudl() {
  const vistos = new Map();

  const mira = (carpeta, hondo) => {
    if (!fs.existsSync(carpeta)) return;

    const fichero = path.join(carpeta, "timeline-hudl.json");

    if (fs.existsSync(fichero)) {
      try {
        const T = leeTimeline(carpeta);

        if (T.rivalHudl && T.acciones.length) {
          const firma = `${T.rivalHudl}|${T.acciones.length}|${T.momentosEq.length}`;
          const video = leeJson(path.join(carpeta, "video-hudl.json"));
          const conVideo = Boolean(video?.url) && fs.existsSync(path.join(carpeta, "hls.json"));
          const item = { carpeta, T, fecha: fechaDe(carpeta), video: video?.url ? video : null, conVideo, copias: [carpeta] };
          const ya = vistos.get(firma);

          if (!ya) vistos.set(firma, item);
          else {
            ya.copias.push(carpeta);
            if (!ya.conVideo && conVideo) Object.assign(ya, { carpeta, video: item.video, conVideo: true });
            ya.fecha ??= item.fecha;
          }
        }
      } catch {
        /* Un timeline vacío o roto: como si no estuviera. */
      }
    }

    if (hondo > 0) for (const d of fs.readdirSync(carpeta, { withFileTypes: true })) if (d.isDirectory()) mira(path.join(carpeta, d.name), hondo - 1);
  };

  for (const c of CARPETAS) mira(c, 1);

  return [...vistos.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/* ------------------------------------------------------------------ */
/*  FALTAS                                                             */
/* ------------------------------------------------------------------ */

/* El sitio de la falta, hacia la portería que ataca quien la SACA. */
const GIRA_TERCIO = { "Own third": "campo rival", "Middle third": "medio campo", "Final third": "campo propio" };
const TERCIO = { "Own third": "campo propio", "Middle third": "medio campo", "Final third": "campo rival" };
const GIRA_CARRIL = { "Left flank": "derecha", "Right flank": "izquierda", Center: "centro" };
const CARRIL = { "Left flank": "izquierda", "Right flank": "derecha", Center: "centro" };

const distanciaDe = (zona, carril) => (zona === "campo rival" ? (carril === "centro" ? "frontal" : "media") : "lejana");

/** ¿Esta acción es una falta pitada? */
const esFalta = (a) =>
  (a.tipos.includes("Foul") || a.tipos.includes("Penalty foul") || (a.tipos.includes("Infraction") && !a.tipos.includes("Offside"))) &&
  uno(a.m, "28 - Infraction - Type") !== "Out of play foul";

/**
 * Las faltas del partido, en orden, con lo que dice el dato.
 *
 * `t` es el arranque de la marca de Hudl (ms): la falta se ve en la tele de
 * 4 a 12 s después. `centro` es el centro de su clip, el instante con el que
 * se casa el reloj de la tele (`faltas-datos.mjs`).
 */
function faltasHudl(T) {
  const { acciones, esNuestro } = T;

  return acciones.filter(esFalta).map((a) => {
    const aFavor = !esNuestro(a.jug);

    /* El «Foul suffered» del otro en el mismo segundo ya viene en la referencia del que saca. */
    const sufrida = acciones.find((b) => Math.abs(b.t - a.t) <= 2000 && b.tipos.includes("Foul suffered") && esNuestro(b.jug) === aFavor);

    const zona = (sufrida ? TERCIO[uno(sufrida.m, "04 - Location - Third")] : GIRA_TERCIO[uno(a.m, "04 - Location - Third")]) ?? "";
    const carril = (sufrida ? CARRIL[uno(sufrida.m, "03 - Location - Flank")] : GIRA_CARRIL[uno(a.m, "03 - Location - Flank")]) ?? "";

    return {
      t: a.t,
      centro: (a.t + (a.m.endTimeMs ?? a.t)) / 2,
      lado: aFavor ? "ofensivo" : "defensivo",
      autor: a.jug,
      victima: uno(a.m, "30 - Infraction - Opponent"),
      sufre: sufrida?.jug ?? "",
      tarjeta: uno(a.m, "29 - Infraction - Card"),
      mano: uno(a.m, "28 - Infraction - Type") === "Hand foul",
      penalti: a.tipos.includes("Penalty foul"),
      zona,
      carril,
      /* El penalti se tira desde el punto: siempre frontal (así lo cuenta la revisión del J5 y del J6); el carril, el del lado del área donde fue. */
      distancia: a.tipos.includes("Penalty foul") ? "frontal" : distanciaDe(zona, carril),
      m: a.m,
    };
  });
}

/**
 * La base de las faltas de un partido, como la escribe el análisis
 * (`faltas/of-hudl.csv`, `def-hudl.csv`): un id por lado en el orden del
 * partido, el sitio del dato, «entre» sin contar y una nota con lo que dice
 * Hudl y el segundo de su vídeo (con él se casa después la revisión).
 */
function baseFaltas(T, rivalCorto) {
  const of = [];
  const def = [];

  for (const f of faltasHudl(T)) {
    const lista = f.lado === "ofensivo" ? of : def;
    const id = `${f.lado === "ofensivo" ? "of" : "def"}-c${String(lista.length + 1).padStart(2, "0")}`;
    const nuestro = f.lado === "defensivo";
    const nota = [
      `T${T.tiempo(f.t)} min ${T.minuto(f.t)}.`,
      `${f.penalti ? "Penalti" : f.mano ? "Mano" : "Falta"} de ${sinDorsal(f.autor)} (${nuestro ? "del Castilla" : `del ${rivalCorto}`})${f.victima ? ` sobre ${sinDorsal(f.victima)}` : ""}.`,
      f.tarjeta === "Yellow" ? "Amarilla." : f.tarjeta === "Red" ? "Roja." : "",
      `Vídeo Hudl ${Math.floor(f.t / 60000)}:${String(Math.floor(f.t / 1000) % 60).padStart(2, "0")}.`,
    ]
      .filter(Boolean)
      .join(" ");

    lista.push({ ...f, id, entre: "?", nota });
  }

  return { of, def };
}

/** Escribe la base de las faltas en `dir` (`of-hudl.csv`, `def-hudl.csv`). */
function escribeBaseFaltas(dir, { of, def }) {
  fs.mkdirSync(dir, { recursive: true });

  for (const [pref, lista] of [["of", of], ["def", def]]) {
    fs.writeFileSync(
      path.join(dir, `${pref}-hudl.csv`),
      "# clip;zona;carril;distancia;entre;nota — base del timeline de Hudl; revisar zona/carril/distancia/entre con la cámara táctica\n" +
        lista.map((f) => [f.id, f.zona, f.carril, f.distancia, f.entre, f.nota.replace(/;/g, ",")].join(";")).join("\n") +
        "\n",
      "utf8",
    );
  }
}

/* ------------------------------------------------------------------ */
/*  SAQUES DE BANDA                                                    */
/* ------------------------------------------------------------------ */

/*
| La convención de la hoja (la del analista, la de la pretemporada y del J3,
| y la que lee la pantalla): **Zona_Saque desde el que SACA** (Zona 1 su
| tercio, Zona 3 su último tercio: en un saque del rival, junto a nuestra
| área) y **Perfil, la banda vista desde el Castilla** (la derecha es la de
| nuestro lateral derecho, saque quien saque). Hudl da las dos desde el que
| saca: la zona va tal cual y en los del rival se gira la banda.
*/
const ZONA_SAQUE = { "Own third": "Zona 1", "Middle third": "Zona 2", "Final third": "Zona 3" };
const BANDA = { "Right flank": "Derecho", "Left flank": "Izquierdo" };
const GIRA_BANDA = { "Right flank": "Izquierdo", "Left flank": "Derecho" };

/** Los saques de banda del partido, en orden, con su zona y su banda en la convención de la hoja. */
function saquesHudl(T) {
  return T.acciones
    .filter((a) => a.tipos.includes("Throw in"))
    .map((a) => {
      const nuestro = T.esNuestro(a.jug);
      const flanco = uno(a.m, "03 - Location - Flank");

      return {
        t: a.t,
        nuestro,
        Tiempo: `T${T.tiempo(a.t)}`,
        Minuto: String(T.minuto(a.t)),
        Zona_Saque: ZONA_SAQUE[uno(a.m, "04 - Location - Third")] ?? "",
        Perfil: (nuestro ? BANDA : GIRA_BANDA)[flanco] ?? "",
        sacador: a.jug,
        m: a.m,
      };
    });
}

/* ------------------------------------------------------------------ */
/*  CASAR LA HOJA CON HUDL                                             */
/* ------------------------------------------------------------------ */

const llano = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** ¿Nombra la hoja («Fortea», «Alexis») al jugador de Hudl («2. Jesús Fortea»)? */
function mismoJugador(hoja, hudl) {
  const a = llano(hoja).split(/[\s.]+/).filter((p) => p.length >= 3);
  const b = llano(sinDorsal(hudl)).split(/[\s.]+/).filter((p) => p.length >= 3);

  return a.length > 0 && a.some((p) => b.includes(p));
}

/** «45+2» o «47» → minuto; «» → null. */
const minutoDeHoja = (v) => {
  const m = String(v ?? "").match(/^(\d+)(?:\s*\+\s*(\d+))?/);

  return m ? Number(m[1]) + Number(m[2] ?? 0) : null;
};

/**
 * Casa las filas de la hoja de una jornada (un lado) con los saques de Hudl
 * del mismo lado: alineación en orden (las dos listas van en el orden del
 * partido) que premia el mismo tiempo y minuto (±1: la hoja a mano cuenta el
 * minuto cumplido y Hudl el que corre), la misma banda y el mismo sacador, y
 * deja sin pareja lo que sobra a cada lado. Devuelve, por fila, el saque de
 * Hudl (o null) y por qué no casa lo que no casa.
 */
function casaSaques(filas, saques) {
  const n = filas.length;
  const m = saques.length;

  const parecido = (f, s) => {
    let p = 0;
    const tf = String(f.Tiempo ?? "").match(/[12]/)?.[0];
    const mf = minutoDeHoja(f.Minuto);
    const ms = Number(s.Minuto);

    if (tf && `T${tf}` !== s.Tiempo) p -= 6;

    if (mf !== null) {
      /* El descuento la hoja lo escribe como 45 o 90 a secas. */
      const d = Math.abs(mf - ms);
      const tope = (mf === 45 || mf === 90) && ms >= mf;

      p += d <= 1 || tope ? 4 - d : d <= 3 ? 0 : -8;
    }

    if (f.Perfil && s.Perfil) p += f.Perfil === s.Perfil ? 2 : -2;
    /* La zona sólo desempata (la revisión con la imagen la corrige a veces): tres saques seguidos de Fortea en el J4. */
    if (f.Zona_Saque && f.Zona_Saque === s.Zona_Saque) p += 1;
    if (f.Sacador) p += mismoJugador(f.Sacador, s.sacador) ? 2 : -1;

    return p;
  };

  /* Alineación clásica: saltar una fila o un saque cuesta lo mismo que una pareja mala. */
  const SALTO = -3;
  const P = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(""));

  for (let i = 1; i <= n; i++) {
    P[i][0] = i * SALTO;
    D[i][0] = "f";
  }
  for (let j = 1; j <= m; j++) {
    P[0][j] = j * SALTO;
    D[0][j] = "s";
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const ambos = P[i - 1][j - 1] + parecido(filas[i - 1], saques[j - 1]);
      const fila = P[i - 1][j] + SALTO;
      const saque = P[i][j - 1] + SALTO;
      const mejor = Math.max(ambos, fila, saque);

      P[i][j] = mejor;
      D[i][j] = mejor === ambos ? "a" : mejor === fila ? "f" : "s";
    }
  }

  const pareja = new Array(n).fill(null);
  const sobran = [];

  for (let i = n, j = m; i > 0 || j > 0; ) {
    const d = D[i][j];

    if (d === "a") {
      /* Una pareja que no se parece en nada no es pareja. */
      if (parecido(filas[i - 1], saques[j - 1]) > -4) pareja[i - 1] = saques[j - 1];
      else sobran.unshift(saques[j - 1]);
      i--;
      j--;
    } else if (d === "f") i--;
    else {
      sobran.unshift(saques[j - 1]);
      j--;
    }
  }

  return { pareja, sobran };
}

/** El partido de Hudl de cada jornada de liga: por la fecha del calendario y, si no la hay, por el rival. */
function partidoDeJornada(partidos, { fecha, rival }) {
  return (
    (fecha && partidos.find((p) => p.fecha === fecha)) ||
    (rival && partidos.filter((p) => mismoEquipo(p.T.rivalHudl, rival)).length === 1 && partidos.find((p) => mismoEquipo(p.T.rivalHudl, rival))) ||
    null
  );
}

/** Los nombres de una carpeta del bucket, todos (de mil en mil: una temporada pasa de mil cortes). */
async function nombresEnBucket(supabase, bucket, carpeta) {
  const nombres = new Set();

  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(carpeta, { limit: 1000, offset: desde });

    if (error) throw new Error(`no se puede leer el bucket (${error.message})`);

    for (const f of data ?? []) nombres.add(f.name);

    if (!data || data.length < 1000) return nombres;
  }
}

module.exports = {
  nombresEnBucket,
  CASA,
  partidosHudl,
  partidoDeJornada,
  fechaDe,
  esFalta,
  faltasHudl,
  baseFaltas,
  escribeBaseFaltas,
  saquesHudl,
  casaSaques,
  mismoJugador,
  minutoDeHoja,
  distanciaDe,
};
