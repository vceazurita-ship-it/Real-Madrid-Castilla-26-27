/**
 * Robos y transiciones de un partido SACADOS DEL TIMELINE DE HUDL (Sportscode/
 * Wyscout), no mirando imagen a imagen.
 *
 * Es `ANALISIS TRANSICIONES/robos-hudl.cjs` (J4 y J5) traído al repositorio
 * para que lo lance el análisis del partido sin tocar el código:
 *
 *   node scripts/partido/robos.cjs <slug> [--segundos N] [--ver] [--json fichero]
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
 *   balón largo sin disputa, las que salen de un balón parado (banda, falta,
 *   córner, saque de puerta), las faltas pitadas, y desde el 04/11/2026 las
 *   que vienen tras un TOQUE SUELTO del rival en medio de nuestra jugada (una
 *   intercepción suya que no controla): ahí el balón nunca dejó de ser
 *   nuestro y la jugada es la misma.
 * - La transición es lo que pasa en los 15 s siguientes al robo (como en los
 *   goles): un remate, el área o el último tercio más tarde ya es ataque
 *   posicional y la jugada acaba en POSESION.
 *
 * La columna «segundo» es el segundo del VÍDEO TÁCTICO del club, no el de
 * Hudl: cada partido lleva sus tramos de desfase medidos a mano. El de Hudl
 * va al final de la fila (`hudl=`): es el de «Abrir en Hudl» y el del corte.
 */
const { BALON_PARADO, TERCIO, CARRIL, sinDorsal, es, cargaPartido, escribeBloques } = require("./transiciones-comun.cjs");

const PARTIDO = process.argv[2];
const SOLO_VER = process.argv.includes("--ver");

if (!PARTIDO) {
  console.error("Uso: node scripts/partido/robos.cjs <slug> [--segundos N] [--ver] [--json fichero]");
  process.exit(2);
}

const P = cargaPartido(PARTIDO);
const { ev, uno, reloj, tactica, aTactica, esToqueSuelto, posesionEn, posesiones } = P;

/* La transición: lo que llega en estos segundos es de la transición; lo de después, ataque posicional. */
const TRANSICION = 15;

/* ¿Es un robo? */
const esRobo = (e, i) => !motivoNoRobo(e, i);

/*
| Por qué una acción NO es un robo ("" si lo es). Con `--por <segundo de
| Hudl>` se escribe para cada acción nuestra de ±4 s: es lo que hay que
| mirar cuando alguien pregunta por qué falta un robo.
*/
function motivoNoRobo(e, i) {
  if (e.eq !== "RMC") return "no es nuestra";
  if (uno(e.m, "08 - Player - Position") === "GK" || es(e, "Goalkeeper action", "Save")) return "portero";

  /*
  | Robo = nos quedamos el balón (04/10/2026). Una «Interception» sin
  | «Recovery» es un desvío, un cabezazo a nadie, un tiro bloqueado o un toque
  | que se va fuera: Wyscout sólo pone «Recovery» cuando el jugador se queda
  | con él. Y un tiro del rival que bloqueamos no es un robo, aunque luego lo
  | recojamos.
  */
  const activo =
    es(e, "Recovery", "Counterpressing recovery") ||
    (es(e, "Defensive duel") && uno(e.m, "23 - Ground duel - In defense - Possession") === "Recovered possession");
  if (!activo || es(e, "Shot block")) return "no se queda el balón";

  /* Si el árbitro pita falta a nuestro favor en esa acción, no es un robo: es una falta. */
  if (ev.slice(Math.max(0, i - 2), i + 3).some((x) => Math.abs(x.t - e.t) <= 1.5 && ((x.eq === "RMC" && es(x, "Foul suffered")) || (x.eq === "RIV" && es(x, "Foul", "Infraction"))))) return "falta pitada";

  /* La última acción con balón del rival antes del robo. */
  const antes = ev.slice(Math.max(0, i - 6), i).reverse().find((x) => x.t >= e.t - 6 && x.eq === "RIV");
  if (!antes) return "sin acción del rival antes";
  if (es(antes, ...BALON_PARADO)) return "tras balón parado del rival";

  /*
  | Un toque suelto del rival en medio de nuestra jugada (04/11/2026): si la
  | posesión suya de justo antes es sólo un toque entre dos nuestras, el
  | balón nunca fue suyo. Ni robo ni pérdida: la jugada sigue.
  */
  const nuestra = posesiones.find((p) => p.eq === "RMC" && Math.abs(p.a - e.t) <= 2.5);
  if (nuestra) {
    const k = posesiones.indexOf(nuestra);
    const previa = posesiones[k - 1];
    const deAntes = posesiones[k - 2];
    /* …siempre que la nuestra de antes fuera de verdad, no otro toque (un cabezazo nuestro a nadie). */
    if (previa && previa.eq === "RIV" && previa.toque && deAntes && !deAntes.toque) return "tras un toque suelto del rival en nuestra jugada";
  }

  /* Segundo balón de un balón parado (de cualquiera de los dos): no es un robo. */
  /*
  | Salvo un saque de puerta que el rival ya ha jugado en corto (04/10/2026):
  | con dos toques suyos controlados por el suelo —pase sin cabeza ni largo,
  | conducción o control— el balón ya es suyo en juego y quitárselo es
  | presionar su salida, no ganar un segundo balón.
  */
  const parados = ev.slice(Math.max(0, i - 25), i).filter((x) => x.t >= e.t - 10 && es(x, "Corner", "Free kick", "Throw in", "Goal kick"));
  if (parados.length) {
    const ultimo = parados[parados.length - 1];
    const soloSaqueDePuerta = parados.every((x) => es(x, "Goal kick") && !es(x, "Corner", "Free kick", "Throw in"));
    const jugadoEnCorto =
      ev
        .slice(ev.indexOf(ultimo) + 1, i)
        .filter((x) => x.eq === "RIV" && es(x, "Pass", "Carry", "Touch") && !es(x, "Head pass", "Long pass")).length >= 2;
    if (!(soloSaqueDePuerta && ultimo.eq === "RIV" && jugadoEnCorto)) return "segundo balón de un balón parado";
  }
  if (es(antes, "Clearance", "Shot", "Save", "Shot block")) return "tras despeje, remate o parada";

  /* El rechace de un tiro nuestro (bloqueado o parado) que volvemos a coger
     tampoco: el balón no llegó a ser suyo. */
  const tiro = ev.slice(Math.max(0, i - 12), i).reverse().find((x) => x.t >= e.t - 8 && x.eq === "RMC" && es(x, "Shot", "Head shot"));
  if (tiro && !ev.slice(ev.indexOf(tiro) + 1, i).some((x) => x.eq === "RIV" && es(x, "Pass", "Carry", "Touch") && !es(x, "Shot block", "Save", "Clearance", "Interception"))) return "rechace de un tiro nuestro";

  /* Una recuperación a secas sólo cuenta si el rival la perdió con alguien encima. */
  if (!es(e, "Interception", "Counterpressing recovery", "Defensive duel")) {
    /*
    | El duelo del rival que va emparejado con el nuestro tiene el MISMO
    | instante y el orden lo deja detrás: hay que mirarlo también (04/10/2026).
    */
    const presion =
      es(antes, "Loss", "Duel", "Offensive duel") ||
      ev.slice(Math.max(0, i - 3), i).some((x) => x.eq === "RMC" && es(x, "Duel", "Defensive duel", "Aerial duel")) ||
      /* …y lo mismo con su «Loss»: va pegado a nuestra recuperación y puede caer medio segundo después. */
      ev.slice(i + 1, i + 4).some((x) => x.t - e.t <= 1 && x.eq === "RIV" && es(x, "Loss"));
    if (!presion) return "sin presión";
    if (es(antes, "Long pass") && !es(antes, "Loss")) return "balón largo sin disputa";
  }
  return "";
}

/* Lo primero que hacemos con el balón. */
function accionDe(e, i) {
  const conPase = (x) => {
    if (es(x, "Clearance")) return "DESPEJE";
    if (es(x, "Pass")) return uno(x.m, "11 - Pass - Direction") === "Forward" || es(x, "Progressive pass") ? "ADELANTE" : "HORIZONTAL_ATRAS";
    if (es(x, "Carry")) return es(x, "Progressive run") || /^(10-20m|20-30m|30m or more)$/.test(uno(x.m, "31 - Carry - Progression")) ? "ADELANTE" : "HORIZONTAL_ATRAS";
    return null;
  };
  const propia = conPase(e);
  if (propia) return { accion: propia, quien: e };
  for (const x of ev.slice(i + 1)) {
    if (x.t > e.t + 8) break;
    /* Un toque suelto del rival no nos la quita. */
    if (x.eq === "RIV" && esToqueSuelto(x)) continue;
    if (x.eq === "RIV" && !es(x, "Duel", "Defensive duel", "Aerial duel", "Foul suffered")) return { accion: "PERDIDA", quien: null };
    if (x.eq === "RMC") {
      if (es(x, "Foul", "Infraction")) return { accion: "PERDIDA", quien: null };
      const a = conPase(x);
      if (a) return { accion: a, quien: x };
      if (es(x, "Loss") && !siguenNuestra(x)) return { accion: "PERDIDA", quien: null };
    }
  }
  return { accion: "PERDIDA", quien: null };
}

/* Tras un «Loss» nuestro, ¿lo que viene es sólo un toque suelto suyo y la seguimos teniendo? */
function siguenNuestra(x) {
  const p = posesionEn(x.fin, 1.5);
  const k = p ? posesiones.indexOf(p) : -1;
  const siguiente = k >= 0 ? (p.eq === "RIV" ? p : posesiones[k + 1]) : null;
  return Boolean(siguiente && siguiente.eq === "RIV" && siguiente.toque && siguiente.a - x.t <= 8);
}

/* Cómo acaba la posesión (y la transición: los primeros 15 s). */
function desenlaceDe(e, i) {
  let fin = e.t;
  let pases = es(e, "Pass") ? 1 : 0;
  let ultimoNuestro = e.t;
  /* «Último tercio» es llegar con el balón, no robarlo allí y perderlo al
     momento (4 de los 9 del J06 eran eso). */
  let remate = null, area = false, ultimo = false, porQue = "PERDIDA", ultimoEv = e;
  for (const x of ev.slice(i + 1)) {
    if (x.t > e.t + 45) { porQue = "POSESION"; break; }
    if (x.eq === "RMC") {
      if (es(x, "Foul", "Infraction")) { fin = x.t; porQue = "FALTA_CONTRA"; break; }
      if (es(x, "Foul suffered")) { fin = x.t; porQue = "FALTA_FAVOR"; break; }
      if (es(x, "Throw in", "Corner", "Free kick", "Goal kick")) { fin = x.t; porQue = "FUERA_NUESTRO"; break; }
      fin = x.t; ultimoEv = x; ultimoNuestro = x.t;
      const enTransicion = x.t - e.t <= TRANSICION;
      if (es(x, "Pass") && enTransicion) pases += 1;
      if (es(x, "Shot", "Head shot") && enTransicion) remate = x;
      if (es(x, "Touch in box", "Pass to penalty area", "Deep completed cross") && enTransicion) area = true;
      if (uno(x.m, "04 - Location - Third") === "Final third" && enTransicion) ultimo = true;
      if (remate) break;
      if (es(x, "Loss") && !siguenNuestra(x)) { porQue = "PERDIDA"; break; }
      continue;
    }
    /* El rival: un duelo no rompe la posesión; tocar el balón, sí. Un toque suelto suyo, no (04/11/2026). */
    /* Si a él le hacen falta, la hemos hecho nosotros, aunque se lleve la «Recovery» (J10 68'). */
    if (es(x, "Foul suffered")) { fin = x.t; porQue = "FALTA_CONTRA"; break; }
    if (es(x, "Duel", "Defensive duel", "Aerial duel") && !es(x, "Recovery", "Interception")) continue;
    if (es(x, "Foul", "Infraction")) { fin = x.t; porQue = "FALTA_FAVOR"; break; }
    if (es(x, "Throw in", "Goal kick", "Corner")) { fin = x.t; porQue = "FUERA"; break; }
    if (esToqueSuelto(x)) continue;
    fin = x.t; porQue = "PERDIDA"; break;
  }
  let desenlace;
  if (remate) desenlace = "REMATE";
  else if (area) desenlace = "AREA";
  else if (ultimo) desenlace = "ULTIMO_TERCIO";
  /* Posesión = la conservamos de verdad más de 15 s: cuenta nuestro último toque, no cuándo sale el balón. */
  else if (ultimoNuestro - e.t > TRANSICION) desenlace = "POSESION";
  /* Si el balón sale y el saque es nuestro, la jugada acaba fuera (MANUAL), no en pérdida. */
  else if (porQue === "FUERA_NUESTRO") desenlace = "FUERA";
  else if (porQue === "POSESION") desenlace = "PERDIDA";
  else if (uno(ultimoEv.m, "08 - Player - Position") === "GK") desenlace = "ATRAS_PORTERO";
  else desenlace = porQue;
  /* La duración es la de la transición (hasta el remate o el final, con tope en 45 s). */
  return { desenlace, duracion: Math.max(0, Math.round((remate ? remate.t : fin) - e.t)), pases, remate, porQue };
}

/* «Con presión» sólo si había un duelo nuestro justo antes; si no, el rival la perdió solo. */
const conPresion = (i) =>
  es(ev[i], "Duel") ||
  ev.slice(Math.max(0, i - 3), i).some((x) => x.eq === "RMC" && es(x, "Duel", "Defensive duel", "Aerial duel"));

const TIPO = (e, i) =>
  es(e, "Interception")
    ? "Interceptación"
    : es(e, "Counterpressing recovery")
      ? "Recuperación tras pérdida"
      : es(e, "Defensive duel")
        ? "Duelo ganado"
        : conPresion(i)
          ? "Recuperación con presión"
          : "Recuperación (pérdida del rival)";

/* Con --descartes, cada recuperación nuestra que NO cuenta, con el motivo y su segundo de Hudl. */
if (process.argv.includes("--descartes")) {
  ev.forEach((e, i) => {
    if (e.eq !== "RMC" || !es(e, "Recovery", "Counterpressing recovery")) return;
    const motivo = motivoNoRobo(e, i);
    if (motivo) console.log(`${e.t.toFixed(1)}\t${reloj(e.t)}\t${sinDorsal(e.jug)}\t${motivo}`);
  });
  process.exit(0);
}

if (process.argv.includes("--por")) {
  const t0 = Number(process.argv[process.argv.indexOf("--por") + 1]);
  ev.forEach((e, i) => {
    if (Math.abs(e.t - t0) <= 4) console.log(`${e.t.toFixed(1)} ${e.eq} ${e.jug} [${e.tipos.join(",")}] → ${e.eq === "RMC" ? motivoNoRobo(e, i) || "ROBO" : ""}`);
  });
  process.exit(0);
}

const robos = [];
ev.forEach((e, i) => {
  if (!esRobo(e, i)) return;
  if (robos.length && e.t - robos[robos.length - 1].t < 4) return;
  const { accion, quien } = accionDe(e, i);
  const d = desenlaceDe(e, i);
  const zona = TERCIO[uno(e.m, "04 - Location - Third")] || "";
  const carril = CARRIL[uno(e.m, "03 - Location - Flank")] || "";
  const partes = [
    `${reloj(e.t)}${tactica(e.t)} · ${TIPO(e, i)} de ${sinDorsal(e.jug)} en ${zona} por ${carril === "centro" ? "el centro" : "la " + carril}`,
    quien && quien !== e ? `sigue ${sinDorsal(quien.jug)}` : "",
    d.remate ? `acaba en remate de ${sinDorsal(d.remate.jug)}` : `acaba en ${d.desenlace.toLowerCase().replace(/_/g, " ")}`,
  ].filter(Boolean);
  robos.push({
    t: e.t,
    fila: [aTactica(e.t), zona, carril, accion, d.desenlace, d.duracion, d.pases, partes.join(", "), accion === "PERDIDA" && d.duracion <= 1 && d.pases === 0 ? "baja" : es(e, "Recovery") && !es(e, "Interception", "Counterpressing recovery", "Defensive duel") ? "media" : "alta",
      /*
      | El jugador que roba (19/10/2026): sale de la sesión POR JUGADOR del
      | timeline, la única con nombres fiables.
      */
      sinDorsal(e.jug),
      /* El instante en el vídeo de Hudl (04/11/2026), con una décima. */
      `hudl=${e.t.toFixed(1)}`],
  });
});

const cuenta = (k) => robos.reduce((m, r) => ((m[r.fila[k]] = (m[r.fila[k]] || 0) + 1), m), {});
console.log(`${PARTIDO}: ${robos.length} robos`);
console.log("  acción", cuenta(3));
console.log("  zona", cuenta(1));
console.log("  desenlace", cuenta(4));

/* Con --json <fichero>, cada robo con su tiempo de Hudl: para auditar. */
if (process.argv.includes("--json")) {
  require("node:fs").writeFileSync(process.argv[process.argv.indexOf("--json") + 1], JSON.stringify(robos, null, 1));
}

/* Con --ver, cada robo con su detalle: es lo que hay que mirar antes de escribir. */
if (SOLO_VER) {
  for (const r of robos) console.log(`  ${r.fila[7]} · ${r.fila[4]} · ${r.fila[8]}`);
  process.exit(0);
}

const segundos = Number(process.argv[process.argv.indexOf("--segundos") + 1]) || 0;
const { dir, bloques } = escribeBloques(
  P.carpeta,
  "bloques",
  robos.map((r) => r.fila),
  segundos,
  "# Sacado del timeline de Hudl (robos.cjs), no mirado imagen a imagen. El segundo es del vídeo táctico; hudl= es el de la retransmisión de Hudl.",
);
console.log(`escritos ${bloques} bloques en ${dir}`);
