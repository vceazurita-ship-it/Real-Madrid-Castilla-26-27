/**
 * Pérdidas y transiciones defensivas de un partido SACADAS DEL TIMELINE DE
 * HUDL (Sportscode/Wyscout), el espejo de `robos.cjs` (11/10/2026).
 *
 *   node scripts/partido/perdidas.cjs <slug> [--segundos N] [--ver] [--json fichero]
 *
 * Lee `ANALISIS TRANSICIONES/<slug>/timeline-hudl.json` y los desfases de
 * `<slug>/tramos.json`, y escribe `<slug>/bloques-perdidas/bNNNNN.csv` con
 * el mismo formato que los robos: segundo;zona;carril;accion;desenlace;
 * duracion;pases;detalle;confianza;jugador;hudl.
 *
 * - PÉRDIDA = un balón que TENÍAMOS (04/11/2026) y pasa a ser suyo: acción
 *   nuestra en juego marcada «Loss» por Wyscout —un pase que no llega, una
 *   conducción que se corta, un regate o un control que se pierde— cuando la
 *   jugada era nuestra (lo último con balón antes fue nuestro).
 * - NO cuentan: los remates (y sus rechaces), los despejes, los toques que no
 *   controlamos en su jugada (una intercepción o un cabezazo que vuelve a
 *   ellos: no llegó a ser nuestro, es un robo que no sale, no una pérdida),
 *   los balones parados que se pierden en el propio saque, las jugadas en que
 *   el árbitro pita falta, y la pérdida que se queda en un TOQUE SUELTO suyo
 *   (lo tocan sin controlarlo y lo seguimos teniendo).
 * - `accion` es lo primero que hace EL RIVAL con el balón: ADELANTE,
 *   HORIZONTAL_ATRAS, DESPEJE o RECUPERAMOS (lo recuperamos antes de que lo
 *   juegue: la pérdida no llega a ser transición).
 * - `desenlace` es en qué acaba SU transición, los 15 s siguientes a la
 *   pérdida: REMATE (del rival), AREA (llegan a nuestra área),
 *   ULTIMO_TERCIO, POSESION (se la quedan más de 15 s), FALTA_FAVOR (falta
 *   nuestra, a su favor), FALTA_CONTRA (nos hacen falta), FUERA,
 *   ATRAS_PORTERO (atrás a su portero) o RECUPERAMOS. Un toque suelto nuestro
 *   en su jugada no la corta.
 * - La zona y el carril son los de la pérdida, vistos desde nosotros: «campo
 *   propio» es nuestro tercio.
 */
const { BALON_PARADO, TERCIO, CARRIL, CON_BALON, sinDorsal, es, cargaPartido, escribeBloques } = require("./transiciones-comun.cjs");

const PARTIDO = process.argv[2];
const SOLO_VER = process.argv.includes("--ver");

if (!PARTIDO) {
  console.error("Uso: node scripts/partido/perdidas.cjs <slug> [--segundos N] [--ver] [--json fichero]");
  process.exit(2);
}

const P = cargaPartido(PARTIDO);
const { ev, uno, reloj, tactica, aTactica, esToqueSuelto, posesionEn, posesiones } = P;

const TRANSICION = 15;

/* ¿El balón era nuestro? Lo último con balón antes de la acción, sin contar duelos, fue nuestro y no se perdió. */
function teniamosBalon(e, i) {
  for (const x of ev.slice(Math.max(0, i - 12), i).reverse()) {
    if (x.t < e.t - 10) return false;
    if (x.t > e.t + 0.05) continue;
    if (x.jug === e.jug && Math.abs(x.t - e.t) < 0.05) continue;
    /* Los duelos van de dos en dos y no dicen de quién era el balón. */
    if (es(x, "Duel", "Defensive duel", "Aerial duel", "Loose ball duel") && !es(x, "Recovery", "Pass", "Carry", "Touch")) continue;
    if (es(x, "Foul", "Infraction", "Foul suffered", "Shot against", "Save")) continue;
    if (x.eq === "RMC") return !es(x, "Loss") || es(x, "Recovery");
    /* Un toque suelto del rival en nuestra jugada no se la lleva. */
    if (x.eq === "RIV" && esToqueSuelto(x)) continue;
    return false;
  }
  return false;
}

/* ¿Es una pérdida? */
const esPerdida = (e, i) => !motivoNoPerdida(e, i);

/* Por qué una acción NO es una pérdida ("" si lo es); `--por <segundo de Hudl>` lo escribe para ±4 s. */
function motivoNoPerdida(e, i) {
  if (e.eq !== "RMC") return "no es nuestra";
  if (!es(e, "Loss")) return "sin Loss";

  /* Un remate no es una pérdida, ni un despeje a propósito ni un bloqueo. */
  if (es(e, "Shot", "Head shot", "Clearance", "Shot block", "Save")) return "remate, despeje o bloqueo";

  /* El propio saque de un balón parado que se pierde: no es juego. */
  if (es(e, ...BALON_PARADO)) return "el propio saque de un balón parado";

  /*
  | Una intercepción, o un duelo (aéreo, por un balón dividido o defendiendo)
  | que no nos deja el balón, no es perder un balón nuestro: es no llegar a
  | robarlo (04/11/2026). Sólo cuenta si la acción es de jugar el balón.
  */
  if (es(e, "Interception")) return "intercepción que no controlamos";
  if (!es(e, ...CON_BALON, "Aerial duel", "Loose ball duel") && !es(e, "Goalkeeper action")) return "no es una acción con balón";
  if (es(e, "Goalkeeper action") && !es(e, "Pass")) return "portero sin pase";

  /*
  | Y el balón tenía que ser nuestro (04/11/2026). Quien lo juega con el pie
  | —un pase, una conducción, un regate, un centro— lo tenía, aunque fuera
  | al primer toque tras un balón largo suyo. Un control, un cabezazo o un
  | duelo aéreo o dividido, sólo si la jugada venía siendo nuestra.
  */
  const jugado = es(e, "Pass", "Carry", "Dribble", "Progressive run", "Cross", "Offensive duel", "Acceleration") && !es(e, "Head pass");
  if (!jugado && !teniamosBalon(e, i)) return "el balón no era nuestro";

  /* Si el árbitro pita falta en esa acción, no es una pérdida: es una falta. */
  if (ev.slice(Math.max(0, i - 2), i + 3).some((x) => Math.abs(x.t - e.t) <= 1.5 && es(x, "Foul suffered", "Foul", "Infraction"))) return "falta pitada";

  /* Si lo que viene es sólo un toque suelto suyo y la seguimos teniendo, no la hemos perdido. */
  const p = posesionEn(e.fin, 1.5);
  const k = p ? posesiones.indexOf(p) : -1;
  const suya = k >= 0 ? (p.eq === "RIV" ? p : posesiones[k + 1]) : null;
  if (suya && suya.eq === "RIV" && suya.toque && suya.a - e.t <= 8) return "sólo un toque suelto suyo: la seguimos teniendo";

  return "";
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
      /* Un duelo nuestro no rompe su posesión; un toque suelto, tampoco; tocarlo con control, sí. */
      if (es(x, "Duel", "Defensive duel", "Aerial duel", "Foul suffered") && !es(x, "Recovery", "Interception")) continue;
      if (esToqueSuelto(x)) continue;
      if (es(x, "Foul", "Infraction")) return { accion: "ADELANTE", quien: null, falta: true };
      return { accion: "RECUPERAMOS", quien: null };
    }
    if (x.eq === "RIV") {
      if (es(x, "Foul", "Infraction")) return { accion: "RECUPERAMOS", quien: null };
      const a = conPase(x);
      if (a) return { accion: a, quien: x };
      if (es(x, "Loss") && !esToqueSuelto(x)) return { accion: "RECUPERAMOS", quien: null };
    }
  }
  return { accion: "RECUPERAMOS", quien: null };
}

/* Cómo acaba SU transición (los primeros 15 s) y su posesión. */
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
      const enTransicion = x.t - e.t <= TRANSICION;
      if (es(x, "Pass") && enTransicion) pases += 1;
      if (es(x, "Shot", "Head shot") && enTransicion) remate = x;
      if (es(x, "Touch in box", "Pass to penalty area", "Deep completed cross") && enTransicion) area = true;
      if (uno(x.m, "04 - Location - Third") === "Final third" && enTransicion) ultimo = true;
      if (remate) break;
      if (es(x, "Loss") && !esToqueSuelto(x)) {
        /* Si tras su «Loss» sólo hay un toque suelto nuestro, siguen ellos. */
        const p = posesionEn(x.fin, 1.5);
        const k = p ? posesiones.indexOf(p) : -1;
        const nuestra = k >= 0 ? (p.eq === "RMC" ? p : posesiones[k + 1]) : null;
        if (nuestra && nuestra.eq === "RMC" && nuestra.toque && nuestra.a - x.t <= 8) continue;
        porQue = "RECUPERAMOS";
        break;
      }
      continue;
    }
    /* Nosotros: un duelo no rompe su posesión; un toque suelto tampoco; tocar el balón, sí. */
    /* Si a uno nuestro le hacen falta, es falta suya, aunque se lleve la «Recovery». */
    if (es(x, "Foul suffered")) { fin = x.t; porQue = "FALTA_CONTRA"; break; }
    if (es(x, "Duel", "Defensive duel", "Aerial duel") && !es(x, "Recovery", "Interception")) continue;
    if (es(x, "Foul", "Infraction")) { fin = x.t; porQue = "FALTA_FAVOR"; break; }
    if (es(x, "Throw in", "Goal kick", "Corner")) { fin = x.t; porQue = "FUERA"; break; }
    if (esToqueSuelto(x)) continue;
    fin = x.t; porQue = "RECUPERAMOS"; break;
  }
  let desenlace;
  if (remate) desenlace = "REMATE";
  else if (area) desenlace = "AREA";
  else if (ultimo) desenlace = "ULTIMO_TERCIO";
  else if (ultimoSuyo - e.t > TRANSICION) desenlace = "POSESION";
  else if (porQue === "FUERA_SUYO") desenlace = "FUERA";
  else if (porQue === "POSESION") desenlace = "RECUPERAMOS";
  else if (uno(ultimoEv.m, "08 - Player - Position") === "GK" && ultimoEv.eq === "RIV") desenlace = "ATRAS_PORTERO";
  else desenlace = porQue;
  return { desenlace, duracion: Math.max(0, Math.round((remate ? remate.t : fin) - e.t)), pases, remate, porQue };
}

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

if (process.argv.includes("--por")) {
  const t0 = Number(process.argv[process.argv.indexOf("--por") + 1]);
  ev.forEach((e, i) => {
    if (Math.abs(e.t - t0) <= 4) console.log(`${e.t.toFixed(1)} ${e.eq} ${e.jug} [${e.tipos.join(",")}] → ${e.eq === "RMC" && es(e, "Loss") ? motivoNoPerdida(e, i) || "PÉRDIDA" : ""}`);
  });
  process.exit(0);
}

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
      /* El nuestro que la pierde (19/10/2026), de la sesión por jugador: ver robos.cjs. */
      sinDorsal(e.jug),
      /* El instante en el vídeo de Hudl (04/11/2026). */
      `hudl=${e.t.toFixed(1)}`,
    ],
  });
});

const cuenta = (k) => perdidas.reduce((m, r) => ((m[r.fila[k]] = (m[r.fila[k]] || 0) + 1), m), {});
console.log(`${PARTIDO}: ${perdidas.length} pérdidas`);
console.log("  acción del rival", cuenta(3));
console.log("  zona", cuenta(1));
console.log("  desenlace", cuenta(4));

/* Con --json <fichero>, cada pérdida con su tiempo de Hudl: para auditar. */
if (process.argv.includes("--json")) {
  require("node:fs").writeFileSync(process.argv[process.argv.indexOf("--json") + 1], JSON.stringify(perdidas, null, 1));
}

if (SOLO_VER) {
  for (const r of perdidas) console.log(`  ${r.fila[7]} · ${r.fila[4]} · ${r.fila[8]}`);
  process.exit(0);
}

const segundos = Number(process.argv[process.argv.indexOf("--segundos") + 1]) || 0;
const { dir, bloques } = escribeBloques(
  P.carpeta,
  "bloques-perdidas",
  perdidas.map((r) => r.fila),
  segundos,
  "# Sacado del timeline de Hudl (perdidas.cjs), no mirado imagen a imagen. El segundo es del vídeo táctico; hudl= es el de la retransmisión de Hudl. La acción es la del rival tras nuestra pérdida.",
);
console.log(`escritos ${bloques} bloques en ${dir}`);
console.log(`RESUMEN: ${perdidas.length} pérdidas del ${PARTIDO}`);
