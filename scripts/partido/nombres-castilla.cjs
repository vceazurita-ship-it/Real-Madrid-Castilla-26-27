/*
|--------------------------------------------------------------------------
| NOMBRES DEL CASTILLA EN EL ETIQUETADO DE HUDL (28/11/2026)
|--------------------------------------------------------------------------
|
| El timeline de Hudl (el etiquetado de Wyscout) pone a cada jugador como
| «4. Mario Rivas». En la J13 (Real Murcia) el 4 del Castilla salió como
| «4. Cisse»: un nombre que no es de nuestra plantilla, y la app lo enseñó
| como el que más robaba («Cisse: 13 de los 34 robos»).
|
| Regla: un jugador del Castilla cuyo nombre no es de la plantilla se
| resuelve por su DORSAL, con el nombre que ese dorsal lleva en el resto de
| partidos etiquetados (2 o más, sin discusión). Si no se puede resolver, se
| avisa en voz alta («NOMBRE DESCONOCIDO») y se deja como viene.
|
| Plantilla = jugadores del Castilla en Wyscout (public/data/analisis.json) +
| los nombres de dorsal que se repiten en los timelines.
|
|   const { nombreCastilla } = require("./nombres-castilla.cjs");
|   nombreCastilla("4. Cisse")  → "Mario Rivas" (y lo dice por consola)
|
|   node scripts/partido/nombres-castilla.cjs   audita todos los partidos
*/

const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..", "..");
const RELATIVA = path.join(RAIZ, "..", "..", "ANALISIS TRANSICIONES");
const CARPETA = fs.existsSync(RELATIVA) ? RELATIVA : "C:/Users/Usuario/Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES";
const NOSOTROS = "Real Madrid Castilla";

const sinTildes = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const partes = (codigo) => {
  const m = String(codigo).match(/^(\d+)\.\s*(.+)$/);

  return m ? { dorsal: m[1], nombre: m[2].trim() } : { dorsal: "", nombre: String(codigo).trim() };
};

/*
| Jugadores de la casa (RM C, Juvenil) que juegan con el Castilla pero no
| salen en su plantilla de Wyscout. Su nombre es bueno tal cual. Confirmado
| por el analista: «Jorge Rajado es del Real Madrid C» (28/11/2026, el 34 del
| Sant Andreu).
*/
const DE_LA_CASA = ["Jorge Rajado"];

/* Los jugadores del Castilla en Wyscout: el nombre bueno. */
function deWyscout() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(RAIZ, "public", "data", "analisis.json"), "utf8"));
    const nombres = new Set();

    for (const fila of j.jugadores ?? []) if (fila?.equipo === NOSOTROS && fila.jugador) nombres.add(fila.jugador);

    for (const n of DE_LA_CASA) nombres.add(n);

    return [...nombres];
  } catch {
    return [...DE_LA_CASA];
  }
}

/* Los códigos del Castilla de un timeline (los que salen en jugadas «Real Madrid Castilla - …»). */
function codigosCastilla(fichero) {
  const j = JSON.parse(fs.readFileSync(fichero, "utf8"));
  const cod = (m) => (m.tags.find((t) => t.key === "HUDL_CODE") || { values: [""] }).values[0];
  const tag = (m, k) => (m.tags.find((t) => t.key === k) || { values: [] }).values;
  const nuestros = new Set();

  for (const s of j.data?.taggingSessions?.items ?? []) {
    for (const m of s.moments?.items ?? []) {
      if (!cod(m).startsWith(`${NOSOTROS} - `)) continue;
      for (const p of tag(m, "09 - Players")) nuestros.add(p);
    }
  }

  return nuestros;
}

function partidos() {
  if (!fs.existsSync(CARPETA)) return [];

  return fs
    .readdirSync(CARPETA)
    .map((d) => ({ slug: d, fichero: path.join(CARPETA, d, "timeline-hudl.json") }))
    .filter((p) => fs.existsSync(p.fichero));
}

let cache = null;

/* dorsal → { nombre → en cuántos partidos } y los nombres de Wyscout. */
function referencia() {
  if (cache) return cache;

  const porDorsal = {};

  for (const p of partidos()) {
    let codigos;

    try {
      codigos = codigosCastilla(p.fichero);
    } catch {
      continue;
    }

    for (const c of codigos) {
      const { dorsal, nombre } = partes(c);

      if (!dorsal) continue;
      porDorsal[dorsal] ??= {};
      porDorsal[dorsal][nombre] = (porDorsal[dorsal][nombre] ?? 0) + 1;
    }
  }

  cache = { porDorsal, wyscout: deWyscout() };

  return cache;
}

/* ¿Es de nuestra plantilla? Igual entero, o el mismo apellido («Martínez» vale por «Joan Martínez» sólo si es el único). */
function esDeLaPlantilla(nombre, wyscout) {
  const n = sinTildes(nombre);

  if (wyscout.some((w) => sinTildes(w) === n)) return true;

  const apellido = n.split(/\s+/).pop();
  const conEse = wyscout.filter((w) => sinTildes(w).split(/\s+/).pop() === apellido);

  return conEse.length >= 1 && apellido.length >= 4;
}

/* El nombre que lleva ese dorsal en los demás partidos (2 o más y sin empate), si es de la plantilla. */
function delDorsal(dorsal, salvo, wyscout, porDorsal) {
  const cuentas = Object.entries(porDorsal[dorsal] ?? {}).filter(([n]) => n !== salvo && esDeLaPlantilla(n, wyscout));

  cuentas.sort((a, b) => b[1] - a[1]);

  if (!cuentas.length || cuentas[0][1] < 2 || (cuentas[1] && cuentas[1][1] === cuentas[0][1])) return null;

  return cuentas[0][0];
}

const avisados = new Set();

/**
 * El nombre de un jugador del Castilla («4. Cisse» → «Mario Rivas»). Sólo para
 * códigos del Castilla: los del rival se dejan como vienen.
 */
function nombreCastilla(codigo) {
  const { dorsal, nombre } = partes(codigo);
  const { porDorsal, wyscout } = referencia();

  if (!wyscout.length || esDeLaPlantilla(nombre, wyscout)) return nombre;

  const bueno = dorsal ? delDorsal(dorsal, nombre, wyscout, porDorsal) : null;

  if (!avisados.has(codigo)) {
    avisados.add(codigo);
    console.warn(
      bueno
        ? `  CORREGIDO: «${codigo}» no es de la plantilla del Castilla; el ${dorsal} es ${bueno} en los demás partidos → ${bueno}`
        : `  NOMBRE DESCONOCIDO: «${codigo}» no es de la plantilla del Castilla y su dorsal no dice quién es: revísalo`,
    );
  }

  return bueno ?? nombre;
}

module.exports = { nombreCastilla, esDeLaPlantilla, referencia };

/* Auditoría: cada partido, sus nombres del Castilla que no son de la plantilla. */
if (require.main === module) {
  const { porDorsal, wyscout } = referencia();
  let problemas = 0;

  console.log(`Plantilla de Wyscout: ${wyscout.length} jugadores del Castilla.`);
  for (const p of partidos()) {
    const malos = [...codigosCastilla(p.fichero)].filter((c) => !esDeLaPlantilla(partes(c).nombre, wyscout));

    for (const c of malos) {
      const { dorsal, nombre } = partes(c);
      const bueno = dorsal ? delDorsal(dorsal, nombre, wyscout, porDorsal) : null;

      problemas++;
      console.log(`${p.slug.padEnd(26)} «${c}» → ${bueno ? `se corrige a ${bueno}` : "SIN RESOLVER (revisar a mano)"}`);
    }
  }

  console.log(`RESUMEN: ${problemas} nombres del Castilla fuera de la plantilla en ${partidos().length} partidos`);
}
