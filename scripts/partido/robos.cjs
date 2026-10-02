/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club, no lo empaqueta nadie. */
/**
 * Robos y transiciones de un partido SACADOS DEL TIMELINE DE HUDL (Sportscode/
 * Wyscout), no mirando imagen a imagen.
 *
 * Es `ANALISIS TRANSICIONES/robos-hudl.cjs` (J4 y J5) traído al repositorio
 * para que lo lance el análisis del partido sin tocar el código:
 *
 *   node scripts/partido/robos.cjs <slug> [--segundos N] [--ver]
 *
 * Lee `ANALISIS TRANSICIONES/<slug>/timeline-hudl.json` y los desfases de
 * `ANALISIS TRANSICIONES/<slug>/tramos.json` ([{hasta, d}] en segundos de
 * Hudl), y escribe `<slug>/bloques/bNNNNN.csv`. Aplica el criterio de
 * MANUAL_ETIQUETADO.md:
 *
 * - ROBO = acción del Castilla con el balón en juego que se lo quita al rival
 *   de forma activa: interceptación, duelo defensivo con «Recovered
 *   possession», recuperación en presión tras pérdida, o recuperación con el
 *   rival marcado como «Loss» justo antes.
 * - NO cuentan: las del portero, las que llegan de un despeje, un remate o un
 *   balón largo sin disputa, las que salen de un balón parado del rival
 *   (banda, falta, córner, saque de puerta) y las faltas pitadas.
 *
 * La columna «segundo» es el segundo del VÍDEO TÁCTICO del club, no el de
 * Hudl: cada partido lleva sus tramos de desfase medidos a mano (TRAMOS).
 */
const fs = require("node:fs");
const path = require("node:path");

const PARTIDO = process.argv[2];
const SOLO_VER = process.argv.includes("--ver");
const AQUI = path.join(__dirname, "..", "..", "..", "..", "ANALISIS TRANSICIONES");

/*
| Desfase vídeo táctico − vídeo de Hudl, por tramos de Hudl (segundos).
| Alcorcón: medido jugada a jugada el 29/09 (saques de banda y faltas).
| Los demás, en su `tramos.json`: el del Sant Andreu se ató con los goles y
| dos jugadas por parte; los nuevos los mide el análisis del partido.
*/
const leeTramos = (slug) => {
  const f = path.join(AQUI, slug, "tramos.json");

  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
};

const TRAMOS = {
  alcorcon: [
    { hasta: 1816, d: 5.5 },
    { hasta: 3010, d: -25 },
    { hasta: 4820, d: 73 },
    { hasta: 1e9, d: 36 },
  ],
};

if (!TRAMOS[PARTIDO]) TRAMOS[PARTIDO] = leeTramos(PARTIDO) || [];

const j = JSON.parse(fs.readFileSync(path.join(AQUI, PARTIDO, "timeline-hudl.json"), "utf8"));
/* La sesión por equipo es la que tiene «<equipo> - Possessions»; no se fía del orden. */
const SES = j.data.taggingSessions.items;
const EQ = SES.find((s) => s.moments.items.some((m) => / - Possessions$/.test((m.tags.find((t) => t.key === "HUDL_CODE") || { values: [""] }).values[0]))) || SES[0];
const JUG = SES.find((s) => s !== EQ) || SES[1];
const cod = (m) => m.tags.find((t) => t.key === "HUDL_CODE").values[0];
const tag = (m, k) => (m.tags.find((t) => t.key === k) || { values: [] }).values;
const uno = (m, k) => tag(m, k)[0] || "";

/* De qué equipo es cada jugador: de todas las jugadas por equipo en que sale. */
const equipo = {};
for (const m of EQ.moments.items) {
  const c = cod(m);
  if (!/ - /.test(c)) continue;
  const nuestro = c.startsWith("Real Madrid Castilla");
  for (const p of tag(m, "09 - Players")) equipo[p] ??= nuestro ? "RMC" : "RIV";
}

const inicioT2 = EQ.moments.items.filter((m) => cod(m) === "Periods").map((m) => m.startTimeMs / 1000).sort((a, b) => a - b)[1] ?? Infinity;

const ev = JUG.moments.items
  .filter((m) => cod(m) !== "Periods")
  .map((m) => ({ m, jug: cod(m), t: m.startTimeMs / 1000, tipos: tag(m, "02 - Type"), eq: equipo[cod(m)] }))
  .sort((a, b) => a.t - b.t);

const sinDorsal = (j) => j.replace(/^\d+\.\s*/, "");
const es = (e, ...ts) => ts.some((t) => e.tipos.includes(t));
const BALON_PARADO = ["Throw in", "Free kick", "Corner", "Goal kick", "Penalty"];
const TERCIO = { "Own third": "campo propio", "Middle third": "medio campo", "Final third": "campo rival" };
const CARRIL = { "Left flank": "izquierda", Center: "centro", "Right flank": "derecha" };

/* ¿Es un robo? */
function esRobo(e, i) {
  if (e.eq !== "RMC") return false;
  if (uno(e.m, "08 - Player - Position") === "GK" || es(e, "Goalkeeper action", "Save")) return false;

  const activo =
    es(e, "Interception", "Counterpressing recovery") ||
    (es(e, "Defensive duel") && uno(e.m, "23 - In defense - Possession") === "Recovered possession") ||
    es(e, "Recovery");
  if (!activo) return false;

  /* Si el árbitro pita falta a nuestro favor en esa acción, no es un robo: es una falta. */
  if (ev.slice(Math.max(0, i - 2), i + 3).some((x) => Math.abs(x.t - e.t) <= 1.5 && ((x.eq === "RMC" && es(x, "Foul suffered")) || (x.eq === "RIV" && es(x, "Foul", "Infraction"))))) return false;

  /* La última acción con balón del rival antes del robo. */
  const antes = ev.slice(Math.max(0, i - 6), i).reverse().find((x) => x.t >= e.t - 6 && x.eq === "RIV");
  if (!antes) return false;
  if (es(antes, ...BALON_PARADO)) return false;

  /* Segundo balón de un balón parado (de cualquiera de los dos): no es un robo. */
  if (ev.slice(Math.max(0, i - 25), i).some((x) => x.t >= e.t - 10 && es(x, "Corner", "Free kick", "Throw in", "Goal kick"))) return false;
  if (es(antes, "Clearance", "Shot", "Save")) return false;

  /* Una recuperación a secas sólo cuenta si el rival la perdió con alguien encima. */
  if (!es(e, "Interception", "Counterpressing recovery", "Defensive duel")) {
    const presion = es(antes, "Loss", "Duel", "Offensive duel") || ev.slice(Math.max(0, i - 3), i).some((x) => x.eq === "RMC" && es(x, "Duel", "Defensive duel", "Aerial duel"));
    if (!presion) return false;
    if (es(antes, "Long pass") && !es(antes, "Loss")) return false;
  }
  return true;
}

/* Lo primero que hacemos con el balón. */
function accionDe(e, i) {
  const conPase = (x) => {
    if (es(x, "Clearance")) return "DESPEJE";
    if (es(x, "Pass")) return uno(x.m, "11 - Pass - Direction") === "Forward" || es(x, "Progressive pass") ? "ADELANTE" : "HORIZONTAL_ATRAS";
    if (es(x, "Carry")) return es(x, "Progressive run") || /1[0-9]|2|3/.test(uno(x.m, "31 - Carry - Progression")) ? "ADELANTE" : "HORIZONTAL_ATRAS";
    return null;
  };
  const propia = conPase(e);
  if (propia) return { accion: propia, quien: e };
  for (const x of ev.slice(i + 1)) {
    if (x.t > e.t + 8) break;
    if (x.eq === "RIV" && !es(x, "Duel", "Defensive duel", "Aerial duel", "Foul suffered")) return { accion: "PERDIDA", quien: null };
    if (x.eq === "RMC") {
      if (es(x, "Foul", "Infraction")) return { accion: "PERDIDA", quien: null };
      const a = conPase(x);
      if (a) return { accion: a, quien: x };
      if (es(x, "Loss")) return { accion: "PERDIDA", quien: null };
    }
  }
  return { accion: "PERDIDA", quien: null };
}

/* Cómo acaba la posesión. */
function desenlaceDe(e, i) {
  let fin = e.t;
  let pases = es(e, "Pass") ? 1 : 0;
  let ultimoNuestro = e.t;
  let remate = null, area = false, ultimo = TERCIO[uno(e.m, "04 - Location - Third")] === "campo rival", porQue = "PERDIDA", ultimoEv = e;
  for (const x of ev.slice(i + 1)) {
    if (x.t > e.t + 45) { porQue = "POSESION"; break; }
    if (x.eq === "RMC") {
      if (es(x, "Foul", "Infraction")) { fin = x.t; porQue = "FALTA_CONTRA"; break; }
      if (es(x, "Foul suffered")) { fin = x.t; porQue = "FALTA_FAVOR"; break; }
      if (es(x, "Throw in", "Corner", "Free kick", "Goal kick")) { fin = x.t; porQue = "FUERA_NUESTRO"; break; }
      fin = x.t; ultimoEv = x; ultimoNuestro = x.t;
      if (es(x, "Pass")) pases += 1;
      if (es(x, "Shot", "Head shot")) { remate = x; }
      if (es(x, "Touch in box", "Pass to penalty area", "Deep completed cross")) area = true;
      if (uno(x.m, "04 - Location - Third") === "Final third") ultimo = true;
      if (remate) break;
      if (es(x, "Loss")) { porQue = "PERDIDA"; break; }
      continue;
    }
    /* El rival: un duelo no rompe la posesión; tocar el balón, sí. */
    if (es(x, "Duel", "Defensive duel", "Aerial duel", "Foul suffered") && !es(x, "Recovery", "Interception")) {
      if (es(x, "Foul suffered")) { fin = x.t; porQue = "FALTA_CONTRA"; break; }
      continue;
    }
    if (es(x, "Foul", "Infraction")) { fin = x.t; porQue = "FALTA_FAVOR"; break; }
    if (es(x, "Throw in", "Goal kick", "Corner")) { fin = x.t; porQue = "FUERA"; break; }
    fin = x.t; porQue = "PERDIDA"; break;
  }
  let desenlace;
  if (remate) desenlace = "REMATE";
  else if (area) desenlace = "AREA";
  else if (ultimo) desenlace = "ULTIMO_TERCIO";
  /* Posesión = la conservamos de verdad más de 15 s: cuenta nuestro último toque, no cuándo sale el balón. */
  else if (ultimoNuestro - e.t > 15 || (porQue === "POSESION" && ultimoNuestro - e.t > 15)) desenlace = "POSESION";
  else if (porQue === "FUERA_NUESTRO" || porQue === "POSESION") desenlace = "PERDIDA";
  else if (uno(ultimoEv.m, "08 - Player - Position") === "GK") desenlace = "ATRAS_PORTERO";
  else desenlace = porQue;
  return { desenlace, duracion: Math.max(0, Math.round(fin - e.t)), pases, remate, porQue };
}

const aTactica = (t) => {
  const tramos = TRAMOS[PARTIDO] || [];
  const tr = tramos.find((x) => t < x.hasta);
  /* Nunca negativo: con un desfase negativo al principio caía en el bloque −300, que no se escribe. */
  return Math.max(0, Math.round(t + (tr ? tr.d : 0)));
};

const reloj = (t) => {
  const min = t < inicioT2 ? t / 60 : 45 + (t - inicioT2) / 60;
  return `${Math.floor(min)}'${String(Math.floor((min % 1) * 60)).padStart(2, "0")}"`;
};

const TIPO = (e) =>
  es(e, "Interception") ? "Interceptación" : es(e, "Counterpressing recovery") ? "Recuperación tras pérdida" : es(e, "Defensive duel") ? "Duelo ganado" : "Recuperación con presión";

const robos = [];
ev.forEach((e, i) => {
  if (!esRobo(e, i)) return;
  if (robos.length && e.t - robos[robos.length - 1].t < 4) return;
  const { accion, quien } = accionDe(e, i);
  const d = desenlaceDe(e, i);
  const zona = TERCIO[uno(e.m, "04 - Location - Third")] || "";
  const carril = CARRIL[uno(e.m, "03 - Location - Flank")] || "";
  const partes = [
    `${reloj(e.t)} · ${TIPO(e)} de ${sinDorsal(e.jug)} en ${zona} por ${carril === "centro" ? "el centro" : "la " + carril}`,
    quien && quien !== e ? `sigue ${sinDorsal(quien.jug)}` : "",
    d.remate ? `acaba en remate de ${sinDorsal(d.remate.jug)}` : `acaba en ${d.desenlace.toLowerCase().replace(/_/g, " ")}`,
  ].filter(Boolean);
  robos.push({
    t: e.t,
    fila: [aTactica(e.t), zona, carril, accion, d.desenlace, d.duracion, d.pases, partes.join(", "), accion === "PERDIDA" && d.duracion <= 1 && d.pases === 0 ? "baja" : es(e, "Recovery") && !es(e, "Interception", "Counterpressing recovery", "Defensive duel") ? "media" : "alta"],
  });
});

const cuenta = (k) => robos.reduce((m, r) => ((m[r.fila[k]] = (m[r.fila[k]] || 0) + 1), m), {});
console.log(`${PARTIDO}: ${robos.length} robos`);
console.log("  acción", cuenta(3));
console.log("  zona", cuenta(1));
console.log("  desenlace", cuenta(4));

if (SOLO_VER) process.exit(0);

const dir = path.join(AQUI, PARTIDO, "bloques");
fs.mkdirSync(dir, { recursive: true });
const porBloque = {};
for (const r of robos) {
  const b = Math.floor(r.fila[0] / 300) * 300;
  (porBloque[b] ??= []).push(r.fila.join(";"));
}
const segundosVideo = Number(process.argv[process.argv.indexOf("--segundos") + 1]) || Math.max(...robos.map((r) => r.fila[0])) + 60;
for (let b = 0; b < segundosVideo; b += 300) {
  const f = path.join(dir, `b${String(b).padStart(5, "0")}.csv`);
  fs.writeFileSync(
    f,
    ["# segundo;zona;carril;accion;desenlace;duracion;pases;detalle;confianza",
      "# Sacado del timeline de Hudl (robos-hudl.cjs), no mirado imagen a imagen. El segundo es del vídeo táctico.",
      ...(porBloque[b] || [])].join("\n") + "\n",
    "utf8",
  );
}
console.log(`escritos ${Math.ceil(segundosVideo / 300)} bloques en ${dir}`);
