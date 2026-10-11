/**
 * Pérdidas y transiciones defensivas de un partido SACADAS DEL TIMELINE DE
 * HUDL (Sportscode/Wyscout), el espejo de `robos.cjs` (11/10/2026).
 *
 *   node scripts/partido/perdidas.cjs <slug> [--segundos N] [--ver]
 *
 * Lee `ANALISIS TRANSICIONES/<slug>/timeline-hudl.json` y los desfases de
 * `<slug>/tramos.json`, y escribe `<slug>/bloques-perdidas/bNNNNN.csv` con
 * el mismo formato que los robos: segundo;zona;carril;accion;desenlace;
 * duracion;pases;detalle;confianza.
 *
 * - PÉRDIDA = acción del Castilla con el balón en juego marcada «Loss» por
 *   Wyscout: un pase que no llega, una conducción que se corta, un duelo o un
 *   control que se pierde. Es nuestro balón que pasa a ser suyo.
 * - NO cuentan: los remates (y sus rechaces), los despejes a propósito, los
 *   balones parados que se pierden en el propio saque (banda, falta, córner,
 *   saque de puerta en largo), ni las jugadas en que el árbitro pita falta.
 * - `accion` es lo primero que hace EL RIVAL con el balón: ADELANTE,
 *   HORIZONTAL_ATRAS, DESPEJE o RECUPERAMOS (lo recuperamos antes de que lo
 *   juegue: la pérdida no llega a ser transición).
 * - `desenlace` es en qué acaba SU posesión: REMATE (del rival), AREA (llegan
 *   a nuestra área), ULTIMO_TERCIO, POSESION (se la quedan más de 15 s),
 *   FALTA_FAVOR (falta nuestra, a su favor), FALTA_CONTRA (nos hacen falta),
 *   FUERA, ATRAS_PORTERO (atrás a su portero) o RECUPERAMOS.
 * - La zona y el carril son los de la pérdida, vistos desde nosotros: «campo
 *   propio» es nuestro campo.
 *
 * El criterio de robo está en MANUAL_ETIQUETADO.md; éste es su reflejo.
 */
const fs = require("node:fs");
const path = require("node:path");

const PARTIDO = process.argv[2];
const SOLO_VER = process.argv.includes("--ver");
const AQUI = path.join(__dirname, "..", "..", "..", "..", "ANALISIS TRANSICIONES");

if (!PARTIDO) {
  console.error("Uso: node scripts/partido/perdidas.cjs <slug> [--segundos N] [--ver]");
  process.exit(2);
}

const leeTramos = (slug) => {
  const f = path.join(AQUI, slug, "tramos.json");

  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
};

/* Los mismos desfases que los robos (ver robos.cjs): el Alcorcón a mano, el resto en su tramos.json. */
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
const SES = j.data.taggingSessions.items;
const EQ = SES.find((s) => s.moments.items.some((m) => / - Possessions$/.test((m.tags.find((t) => t.key === "HUDL_CODE") || { values: [""] }).values[0]))) || SES[0];
const JUG = SES.find((s) => s !== EQ) || SES[1];
const cod = (m) => m.tags.find((t) => t.key === "HUDL_CODE").values[0];
const tag = (m, k) => (m.tags.find((t) => t.key === k) || { values: [] }).values;
const uno = (m, k) => tag(m, k)[0] || "";

const equipo = {};
for (const m of EQ.moments.items) {
  const c = cod(m);
  if (!/ - /.test(c)) continue;
  const nuestro = c.startsWith("Real Madrid Castilla");
  for (const p of tag(m, "09 - Players")) equipo[p] ??= nuestro ? "RMC" : "RIV";
}

const periodos = EQ.moments.items.filter((m) => cod(m) === "Periods").map((m) => m.startTimeMs / 1000).sort((a, b) => a - b);
const inicioT1 = periodos[0] ?? 0;
const inicioT2 = periodos[1] ?? Infinity;

/* El centro del clip, como en los robos (04/10/2026). */
const ev = JUG.moments.items
  .filter((m) => cod(m) !== "Periods")
  .map((m) => ({ m, jug: cod(m), t: (m.startTimeMs + (m.endTimeMs ?? m.startTimeMs)) / 2000, tipos: tag(m, "02 - Type"), eq: equipo[cod(m)] }))
  .sort((a, b) => a.t - b.t);

const sinDorsal = (j) => j.replace(/^\d+\.\s*/, "");
const es = (e, ...ts) => ts.some((t) => e.tipos.includes(t));
const BALON_PARADO = ["Throw in", "Free kick", "Corner", "Goal kick", "Penalty"];
const TERCIO = { "Own third": "campo propio", "Middle third": "medio campo", "Final third": "campo rival" };
const CARRIL = { "Left flank": "izquierda", Center: "centro", "Right flank": "derecha" };

/* ¿Es una pérdida? */
function esPerdida(e, i) {
  if (e.eq !== "RMC") return false;
  if (!es(e, "Loss")) return false;

  /* Un remate no es una pérdida, ni un despeje a propósito ni un bloqueo. */
  if (es(e, "Shot", "Head shot", "Clearance", "Shot block", "Save", "Goalkeeper action")) return false;

  /* El propio saque de un balón parado que se pierde (un saque de puerta en
     largo que gana su central, un saque de banda que vuelve): no es juego. */
  if (es(e, ...BALON_PARADO)) return false;

  /* Si el árbitro pita falta en esa acción, no es una pérdida: es una falta. */
  if (ev.slice(Math.max(0, i - 2), i + 3).some((x) => Math.abs(x.t - e.t) <= 1.5 && ((x.eq === "RIV" && es(x, "Foul suffered")) || (x.eq === "RMC" && es(x, "Foul", "Infraction"))))) return false;
  if (ev.slice(Math.max(0, i - 2), i + 3).some((x) => Math.abs(x.t - e.t) <= 1.5 && ((x.eq === "RMC" && es(x, "Foul suffered")) || (x.eq === "RIV" && es(x, "Foul", "Infraction"))))) return false;

  return true;
}

/* Lo primero que hace el rival con el balón. */
function accionDe(e, i) {
  const conPase = (x) => {
    if (es(x, "Clearance")) return "DESPEJE";
    if (es(x, "Pass")) return uno(x.m, "11 - Pass - Direction") === "Forward" || es(x, "Progressive pass") ? "ADELANTE" : "HORIZONTAL_ATRAS";
    if (es(x, "Carry")) return es(x, "Progressive run") || /^(10-20m|20-30m|30m or more)$/.test(uno(x.m, "31 - Carry - Progression")) ? "ADELANTE" : "HORIZONTAL_ATRAS";
    return null;
  };
  for (const x of ev.slice(i + 1)) {
    if (x.t > e.t + 8) break;
    if (x.eq === "RMC") {
      /* Un duelo nuestro no rompe su posesión; tocarlo con control, sí. */
      if (es(x, "Duel", "Defensive duel", "Aerial duel", "Foul suffered") && !es(x, "Recovery", "Interception")) continue;
      if (es(x, "Foul", "Infraction")) return { accion: "ADELANTE", quien: null, falta: true };
      return { accion: "RECUPERAMOS", quien: null };
    }
    if (x.eq === "RIV") {
      if (es(x, "Foul", "Infraction")) return { accion: "RECUPERAMOS", quien: null };
      const a = conPase(x);
      if (a) return { accion: a, quien: x };
      if (es(x, "Loss")) return { accion: "RECUPERAMOS", quien: null };
    }
  }
  return { accion: "RECUPERAMOS", quien: null };
}

/* Cómo acaba SU posesión. */
function desenlaceDe(e, i) {
  let fin = e.t;
  let pases = 0;
  let ultimoSuyo = e.t;
  let remate = null, area = false, ultimo = false, porQue = "RECUPERAMOS", ultimoEv = e;
  for (const x of ev.slice(i + 1)) {
    if (x.t > e.t + 45) { porQue = "POSESION"; break; }
    if (x.eq === "RIV") {
      if (es(x, "Foul", "Infraction")) { fin = x.t; porQue = "FALTA_CONTRA"; break; }
      if (es(x, "Foul suffered")) { fin = x.t; porQue = "FALTA_FAVOR"; break; }
      if (es(x, "Throw in", "Corner", "Free kick", "Goal kick")) { fin = x.t; porQue = "FUERA_SUYO"; break; }
      fin = x.t; ultimoEv = x; ultimoSuyo = x.t;
      if (es(x, "Pass")) pases += 1;
      if (es(x, "Shot", "Head shot")) { remate = x; }
      if (es(x, "Touch in box", "Pass to penalty area", "Deep completed cross")) area = true;
      if (uno(x.m, "04 - Location - Third") === "Final third") ultimo = true;
      if (remate) break;
      if (es(x, "Loss")) { porQue = "RECUPERAMOS"; break; }
      continue;
    }
    /* Nosotros: un duelo no rompe su posesión; tocar el balón, sí. */
    if (es(x, "Duel", "Defensive duel", "Aerial duel", "Foul suffered") && !es(x, "Recovery", "Interception")) {
      if (es(x, "Foul suffered")) { fin = x.t; porQue = "FALTA_CONTRA"; break; }
      continue;
    }
    if (es(x, "Foul", "Infraction")) { fin = x.t; porQue = "FALTA_FAVOR"; break; }
    if (es(x, "Throw in", "Goal kick", "Corner")) { fin = x.t; porQue = "FUERA"; break; }
    fin = x.t; porQue = "RECUPERAMOS"; break;
  }
  let desenlace;
  if (remate) desenlace = "REMATE";
  else if (area) desenlace = "AREA";
  else if (ultimo) desenlace = "ULTIMO_TERCIO";
  else if (ultimoSuyo - e.t > 15 || (porQue === "POSESION" && ultimoSuyo - e.t > 15)) desenlace = "POSESION";
  else if (porQue === "FUERA_SUYO") desenlace = "FUERA";
  else if (porQue === "POSESION") desenlace = "RECUPERAMOS";
  else if (uno(ultimoEv.m, "08 - Player - Position") === "GK" && ultimoEv.eq === "RIV") desenlace = "ATRAS_PORTERO";
  else desenlace = porQue;
  return { desenlace, duracion: Math.max(0, Math.round(fin - e.t)), pases, remate, porQue };
}

const aTactica = (t) => {
  const tramos = TRAMOS[PARTIDO] || [];
  const tr = tramos.find((x) => t < x.hasta);
  return Math.max(0, Math.round(t + (tr ? tr.d : 0)));
};

const reloj = (t) => {
  const primera = t < inicioT2;
  const dentro = Math.max(0, primera ? t - inicioT1 : t - inicioT2);
  const tope = 45 * 60;
  const descuento = dentro >= tope;
  const seg = descuento ? dentro - tope : dentro + (primera ? 0 : tope);
  const mmss = `${Math.floor(seg / 60)}'${String(Math.floor(seg % 60)).padStart(2, "0")}"`;
  return descuento ? `${primera ? 45 : 90}+${mmss}` : mmss;
};

const tactica = (t) => {
  if (!(TRAMOS[PARTIDO] || []).length) return "";
  const s = aTactica(t);
  return ` (táctica ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})`;
};

/* «Con presión» si el rival tenía un duelo encima en ese momento. */
const conPresion = (e, i) =>
  es(e, "Duel", "Offensive duel", "Aerial duel") ||
  ev.slice(Math.max(0, i - 3), i + 3).some((x) => x !== e && Math.abs(x.t - e.t) <= 1.5 && x.eq === "RIV" && es(x, "Duel", "Defensive duel", "Aerial duel", "Counterpressing recovery"));

const TIPO = (e, i) =>
  es(e, "Pass", "Long pass", "Head pass", "Cross")
    ? es(e, "Long pass") ? "Pase largo perdido" : es(e, "Cross") ? "Centro perdido" : "Pase perdido"
    : es(e, "Carry", "Dribble", "Progressive run")
      ? "Conducción cortada"
      : es(e, "Duel", "Offensive duel", "Aerial duel")
        ? "Duelo perdido"
        : es(e, "Touch", "Received pass")
          ? "Control perdido"
          : conPresion(e, i)
            ? "Pérdida bajo presión"
            : "Pérdida";

const perdidas = [];
ev.forEach((e, i) => {
  if (!esPerdida(e, i)) return;
  if (perdidas.length && e.t - perdidas[perdidas.length - 1].t < 4) return;
  const { accion, quien } = accionDe(e, i);
  const d = desenlaceDe(e, i);
  const zona = TERCIO[uno(e.m, "04 - Location - Third")] || "";
  const carril = CARRIL[uno(e.m, "03 - Location - Flank")] || "";
  const presion = conPresion(e, i);
  const partes = [
    `${reloj(e.t)}${tactica(e.t)} · ${TIPO(e, i)} de ${sinDorsal(e.jug)} en ${zona} por ${carril === "centro" ? "el centro" : "la " + carril}${presion ? ", con presión" : ""}`,
    quien ? `sigue ${sinDorsal(quien.jug)}` : "",
    d.remate ? `acaba en remate de ${sinDorsal(d.remate.jug)}` : `acaba en ${d.desenlace.toLowerCase().replace(/_/g, " ")}`,
  ].filter(Boolean);
  perdidas.push({
    t: e.t,
    fila: [
      aTactica(e.t),
      zona,
      carril,
      accion,
      d.desenlace,
      d.duracion,
      d.pases,
      partes.join(", "),
      es(e, "Pass", "Long pass", "Cross", "Duel", "Offensive duel", "Aerial duel", "Carry") ? "alta" : "media",
    ],
  });
});

const cuenta = (k) => perdidas.reduce((m, r) => ((m[r.fila[k]] = (m[r.fila[k]] || 0) + 1), m), {});
console.log(`${PARTIDO}: ${perdidas.length} pérdidas`);
console.log("  acción del rival", cuenta(3));
console.log("  zona", cuenta(1));
console.log("  desenlace", cuenta(4));

if (SOLO_VER) {
  for (const r of perdidas) console.log(`  ${r.fila[7]} · ${r.fila[4]} · ${r.fila[8]}`);
  process.exit(0);
}

const dir = path.join(AQUI, PARTIDO, "bloques-perdidas");
fs.mkdirSync(dir, { recursive: true });
for (const viejo of fs.readdirSync(dir).filter((f) => /^b\d+\.csv$/.test(f))) fs.rmSync(path.join(dir, viejo), { force: true });
const porBloque = {};
for (const r of perdidas) {
  const b = Math.floor(r.fila[0] / 300) * 300;
  (porBloque[b] ??= []).push(r.fila.join(";"));
}
const segundosVideo = Number(process.argv[process.argv.indexOf("--segundos") + 1]) || Math.max(...perdidas.map((r) => r.fila[0])) + 60;
for (let b = 0; b < segundosVideo; b += 300) {
  const f = path.join(dir, `b${String(b).padStart(5, "0")}.csv`);
  fs.writeFileSync(
    f,
    ["# segundo;zona;carril;accion;desenlace;duracion;pases;detalle;confianza",
      "# Sacado del timeline de Hudl (perdidas.cjs), no mirado imagen a imagen. El segundo es del vídeo táctico. La acción es la del rival tras nuestra pérdida.",
      ...(porBloque[b] || [])].join("\n") + "\n",
    "utf8",
  );
}
console.log(`escritos ${Math.ceil(segundosVideo / 300)} bloques en ${dir}`);
console.log(`RESUMEN: ${perdidas.length} pérdidas del ${PARTIDO}`);
