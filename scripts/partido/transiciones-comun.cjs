/**
 * LO QUE COMPARTEN LOS ROBOS Y LAS PÉRDIDAS (04/11/2026).
 *
 * `robos.cjs` y `perdidas.cjs` leen el mismo timeline de Hudl y miran el
 * mismo partido desde los dos lados. Aquí vive lo que tienen que ver igual
 * para que un robo y una pérdida no se contradigan:
 *
 * - El INSTANTE de cada acción (`e.t`). Las acciones de Wyscout en Hudl son
 *   ventanas que empiezan ~2 s antes del toque (4 s las de un toque, 5-10 s
 *   los pases, que acaban en el control); los remates son ventanas de 14 s
 *   con el disparo hacia el segundo 8 (20 s y el 16,5 si son gol) y las
 *   faltas, de 7 s con el pitido 2 s antes del final: medido con el «Shot
 *   against» del portero y el «Foul suffered» del otro (J07, J10). Antes se usaba el
 *   centro del clip: en un pase largo perdido caía con el balón en el aire.
 *   El instante es el segundo de «Abrir en Hudl» y el del corte.
 * - Las POSESIONES de la sesión por equipo («<equipo> - Possessions»), que
 *   son las de Wyscout: una intercepción que no controla ya abre una
 *   posesión de un segundo. Un TOQUE SUELTO es una de esas posesiones
 *   (≤ 4,5 s, sin un pase de verdad, una conducción ni un remate) metida
 *   entre dos del otro equipo: no corta la jugada. Es el mismo criterio que
 *   `esToque`/`cadena` de `scripts/goles-liga.mjs`.
 * - Tercio y carril de una acción van en la referencia del equipo del que
 *   la hace: los robos y las pérdidas son acciones nuestras y ya están en la
 *   del Castilla. El tercio medio no dice en qué mitad: no se inventa.
 */
const fs = require("node:fs");
const path = require("node:path");

/* Desde un worktree (.claude/worktrees/…) la ruta relativa no llega: se cae a la de siempre. */
const RELATIVA = path.join(__dirname, "..", "..", "..", "..", "ANALISIS TRANSICIONES");
const AQUI = fs.existsSync(RELATIVA) ? RELATIVA : "C:/Users/Usuario/Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES";

/*
| Desfase vídeo táctico − vídeo de Hudl, por tramos de Hudl (segundos).
| Alcorcón: medido jugada a jugada el 29/09 (saques de banda y faltas). Los
| demás, en su `tramos.json`. Sin tramos (no hay táctica), el segundo es el
| de Hudl.
*/
const TRAMOS_FIJOS = {
  alcorcon: [
    { hasta: 1816, d: 5.5 },
    { hasta: 3010, d: -25 },
    { hasta: 4820, d: 73 },
    { hasta: 1e9, d: 36 },
  ],
};

const BALON_PARADO = ["Throw in", "Free kick", "Corner", "Goal kick", "Penalty"];
const TERCIO = { "Own third": "campo propio", "Middle third": "medio campo", "Final third": "campo rival" };
const CARRIL = { "Left flank": "izquierda", Center: "centro", "Right flank": "derecha" };
/* Lo que es tocar sin jugar: no hace a nadie dueño del balón. */
const TOQUE = ["Interception", "Clearance", "Shot block", "Head pass", "Save"];
/* Lo que es tener el balón y jugarlo. */
const CON_BALON = ["Pass", "Carry", "Progressive run", "Dribble", "Cross", "Touch", "Acceleration", "Offensive duel"];

const sinDorsal = (j) => String(j).replace(/^\d+\.\s*/, "");
const es = (e, ...ts) => ts.some((t) => e.tipos.includes(t));

function cargaPartido(slug) {
  const carpeta = path.join(AQUI, slug);
  const fTramos = path.join(carpeta, "tramos.json");
  const tramos = TRAMOS_FIJOS[slug] || (fs.existsSync(fTramos) ? JSON.parse(fs.readFileSync(fTramos, "utf8")) : []);

  const j = JSON.parse(fs.readFileSync(path.join(carpeta, "timeline-hudl.json"), "utf8"));
  const cod = (m) => (m.tags.find((t) => t.key === "HUDL_CODE") || { values: [""] }).values[0];
  const tag = (m, k) => (m.tags.find((t) => t.key === k) || { values: [] }).values;
  const uno = (m, k) => tag(m, k)[0] || "";

  /* La sesión por equipo es la que tiene «<equipo> - Possessions»; no se fía del orden. */
  const SES = j.data.taggingSessions.items;
  const EQ = SES.find((s) => s.moments.items.some((m) => / - Possessions$/.test(cod(m)))) || SES[0];
  const JUG = SES.find((s) => s !== EQ) || SES[1];

  /* De qué equipo es cada jugador: de todas las jugadas por equipo en que sale. */
  const equipo = {};
  for (const m of EQ.moments.items) {
    const c = cod(m);
    if (!/ - /.test(c)) continue;
    const nuestro = c.startsWith("Real Madrid Castilla");
    for (const p of tag(m, "09 - Players")) equipo[p] ??= nuestro ? "RMC" : "RIV";
  }

  /* Arranque de cada parte en segundos de Hudl. */
  const periodos = EQ.moments.items.filter((m) => cod(m) === "Periods").map((m) => m.startTimeMs / 1000).sort((a, b) => a - b);
  const inicioT1 = periodos[0] ?? 0;
  const inicioT2 = periodos[1] ?? Infinity;

  /* El instante de la acción (ver arriba). */
  const instante = (m, tipos) => {
    const ini = m.startTimeMs / 1000;
    const dura = ((m.endTimeMs ?? m.startTimeMs) - m.startTimeMs) / 1000;
    if (tipos.includes("Shot") || tipos.includes("Head shot") || tipos.includes("Penalty")) return dura >= 18 ? ini + 16.5 : ini + 8;
    /* La falta (ventana de 7 s) acaba 2 s después del pitido: su «Foul suffered» cae ahí (J07, J10). */
    if (tipos.includes("Infraction") || tipos.includes("Foul")) return ini + Math.max(2, dura - 2);
    return ini + Math.min(2, dura / 2);
  };

  const ev = JUG.moments.items
    .filter((m) => cod(m) !== "Periods")
    .map((m) => {
      const tipos = tag(m, "02 - Type");
      return { m, jug: cod(m), t: instante(m, tipos), fin: (m.endTimeMs ?? m.startTimeMs) / 1000, tipos, eq: equipo[cod(m)] };
    })
    .sort((a, b) => a.t - b.t);

  /* Las posesiones de Wyscout, en orden. */
  const posesiones = EQ.moments.items
    .filter((m) => / - Possessions$/.test(cod(m)))
    .map((m) => ({ a: m.startTimeMs / 1000, b: (m.endTimeMs ?? m.startTimeMs) / 1000, eq: cod(m).startsWith("Real Madrid Castilla") ? "RMC" : "RIV" }))
    .sort((x, y) => x.a - y.a || x.b - y.b);

  /* ¿Una posesión es sólo un toque suelto metido entre dos del otro? (`esToque`/`cadena` de goles-liga.mjs). */
  for (let k = 0; k < posesiones.length; k++) {
    const p = posesiones[k];
    const antes = posesiones[k - 1];
    const despues = posesiones[k + 1];
    p.toque = false;
    if (!antes || !despues || antes.eq === p.eq || despues.eq === p.eq) continue;
    if (p.a - antes.b > 1.5 || despues.a - p.b > 1.5 || p.b - p.a > 4.5) continue;
    const suyas = ev.filter((e) => e.eq === p.eq && e.t >= p.a - 2.5 && e.t <= p.b + 0.5 && !es(e, "Shot against"));
    p.toque = suyas.length > 0 && suyas.every((e) => !es(e, "Shot", "Head shot", "Penalty") && esToqueAccion(e));
  }

  /*
  | Una acción es de tocar sin jugar si despeja, bloquea, intercepta o
  | cabecea sin dársela a nadie, o si no lleva ni pase ni conducción ni
  | control. Con «Recovery» y sin «Loss» se ha quedado el balón: no lo es
  | (un cabezazo o una intercepción que sí encuentra a un compañero).
  */
  function esToqueAccion(e) {
    if (es(e, "Recovery") && !es(e, "Loss")) return false;
    if (es(e, "Interception", "Clearance", "Shot block", "Save")) return true;
    if (es(e, "Head pass")) return uno(e.m, "09 - Pass - Accurate") !== "Accurate";
    return !es(e, "Pass", "Carry", "Progressive run", "Dribble", "Cross", "Goal kick", "Touch");
  }

  /* La posesión en la que cae un instante (la que empieza antes y acaba después, con margen). */
  const posesionEn = (t, margen = 0.6) => {
    let mejor = null;
    for (const p of posesiones) {
      if (p.a - margen > t) break;
      if (t <= p.b + margen) mejor = p;
    }
    return mejor;
  };

  /* ¿Esta acción es un toque suelto de su equipo, metido en la jugada del otro? */
  const esToqueSuelto = (x) => {
    const p = posesionEn(x.t, 0.3);
    return Boolean(p && p.toque && p.eq === x.eq);
  };

  const aTactica = (t) => {
    const tr = tramos.find((x) => t < x.hasta);
    /* Nunca negativo: con un desfase negativo al principio caía en el bloque −300, que no se escribe. */
    return Math.max(0, Math.round(t + (tr ? tr.d : 0)));
  };

  /*
  | El minuto del partido, con sus segundos y como se dice en el fútbol: el
  | descuento va como «45+1'56"» y «90+2'10"».
  */
  const reloj = (t) => {
    const primera = t < inicioT2;
    const dentro = Math.max(0, primera ? t - inicioT1 : t - inicioT2);
    const tope = 45 * 60;
    const descuento = dentro >= tope;
    const seg = descuento ? dentro - tope : dentro + (primera ? 0 : tope);
    const mmss = `${Math.floor(seg / 60)}'${String(Math.floor(seg % 60)).padStart(2, "0")}"`;
    return descuento ? `${primera ? 45 : 90}+${mmss}` : mmss;
  };

  /* «mm:ss» de la grabación táctica, si hay desfases medidos. */
  const tactica = (t) => {
    if (!tramos.length) return "";
    const s = aTactica(t);
    return ` (táctica ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})`;
  };

  return { carpeta, tramos, ev, posesiones, posesionEn, esToqueSuelto, equipo, inicioT1, inicioT2, uno, tag, cod, aTactica, reloj, tactica };
}

/**
 * Escribe los bloques de cinco minutos (`bloques/` o `bloques-perdidas/`).
 * La fila lleva al final `hudl=<segundo>`: el instante en el vídeo de Hudl,
 * para «Abrir en Hudl» y para el corte (04/11/2026).
 */
function escribeBloques(carpeta, sub, filas, segundosVideo, comentario) {
  const dir = path.join(carpeta, sub);
  fs.mkdirSync(dir, { recursive: true });
  /* Fuera los bloques de una pasada anterior (09/10/2026). */
  for (const viejo of fs.readdirSync(dir).filter((f) => /^b\d+\.csv$/.test(f))) fs.rmSync(path.join(dir, viejo), { force: true });
  const porBloque = {};
  for (const f of filas) {
    const b = Math.floor(f[0] / 300) * 300;
    (porBloque[b] ??= []).push(f.join(";"));
  }
  const hasta = segundosVideo || Math.max(0, ...filas.map((f) => f[0])) + 60;
  for (let b = 0; b < hasta; b += 300) {
    fs.writeFileSync(
      path.join(dir, `b${String(b).padStart(5, "0")}.csv`),
      ["# segundo;zona;carril;accion;desenlace;duracion;pases;detalle;confianza;jugador;hudl", comentario, ...(porBloque[b] || [])].join("\n") + "\n",
      "utf8",
    );
  }
  return { dir, bloques: Math.ceil(hasta / 300) };
}

module.exports = { AQUI, BALON_PARADO, TERCIO, CARRIL, TOQUE, CON_BALON, sinDorsal, es, cargaPartido, escribeBloques };
