/**
 * LOS RASGOS DE SU PUESTO, DEL EVENTO A EVENTO DE OPTA (25/11/2026).
 *
 * Petición del analista: «que los clips sean no solo de sus mayores fortalezas
 * sino también de cosas específicas de posición: extremo si sale por los
 * perfiles al regatear o solo por uno, si centra con una pierna o con las dos,
 * tipologías de sus finalizaciones, si es acelerador de transición con el
 * pase, con la conducción o con el regate, si arriesga en campo propio o no…
 * y eso desde la especificidad de cada posición».
 *
 * Lo usa scripts/opta-clips-jugador.mjs. Sin red ni ficheros: sólo cuentas
 * sobre los eventos de sus últimos partidos (los de los dos equipos, para
 * comparar con los de su mismo puesto en esos partidos).
 *
 * LO QUE DA OPTA (mirado el 25/11/2026 con consultas pequeñas):
 * - x/y de cada acción en el sentido del que la hace (x 0→100 hacia la portería
 *   rival; y 0 = banda DERECHA, 100 = izquierda), fin del pase (PassEndX/Y) y
 *   dónde EMPEZÓ la conducción que lleva a la acción (CarryX/CarryY): no hay
 *   evento «conducción», se deduce de ahí.
 * - Puesto en ese partido (Position|EVENT), pie bueno de la temporada (PrefFoot).
 * - Pase: largo (q1), centro (q2), al hueco (q4), cambio de orientación
 *   (q196), saque de puerta (q124), de falta (q5) o córner (q6), receptor.
 *   NO dice con qué pierna se da el pase ni el centro (BodyPart = «Other»);
 *   cerrado/abierto (q223/q224) sólo viene en los córners.
 * - Remate: derecha (q20), izquierda (q72), cabeza (q15), primer toque
 *   (q328), contragolpe (q23 / ShotPlayStyle), xG, gol.
 * - Pérdidas: pase fallado, Dispossessed, TakeOn fallado, BallTouch fallado.
 * - Recuperaciones: BallRecovery, Interception, Tackle; «le regatean» = Challenge.
 * - Portero: Save (estirada q179), Claim, Punch, Sweeper.
 */

/* ---------- Puestos ---------- */

/** El grupo de su puesto: POR, CEN, LAT, MC (pivote/interior), MP (mediapunta), EXT, DC. */
export function grupoDe(posicion = "") {
  const p = String(posicion);
  if (/Goalkeeper/i.test(p)) return "POR";
  if (/Centre Back|Central Defender/i.test(p)) return "CEN";
  if (/Back/i.test(p)) return "LAT";
  if (/Forward|Striker/i.test(p)) return "DC";
  if (/Winger|^Left Midfielder|^Right Midfielder|Left Attacking|Right Attacking/i.test(p)) return "EXT";
  if (/Attacking/i.test(p)) return "MP";
  return "MC";
}

/* ---------- Ayudas ---------- */

const ES_REMATE = new Set(["Goal", "AttemptSaved", "Miss", "Post"]);
const enArea = (x, y) => x >= 83 && y >= 21.1 && y <= 78.9;
const enAreaPequena = (x, y) => x >= 94.2 && y >= 36.8 && y <= 63.2;
const banda = (y) => (y < 50 ? "derecha" : "izquierda");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const corte = (e, que, antes = 4, despues = 3) => ({ e, que, antes, despues });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export const esPerdida = (e) =>
  (e.tipo === "Pass" && !e.ok && !e.corner && !e.falta) || e.tipo === "Dispossessed" || (e.tipo === "TakeOn" && !e.ok) || (e.tipo === "BallTouch" && !e.ok);
const esAccionConBalon = (e) => e.tipo === "Pass" || e.tipo === "TakeOn" || e.tipo === "BallTouch" || e.tipo === "Dispossessed";
const esPaseQueAvanza = (e) => e.tipo === "Pass" && e.ok && !e.centro && !e.corner && !e.falta && e.finX != null && (e.finX - e.x >= 15 || (e.finX >= 83 && e.finX - e.x >= 8));
const conduccion = (e) => (e.cx != null && e.x - e.cx >= 10 ? e.x - e.cx : 0);

/* ---------- El contexto de un partido ---------- */

/**
 * Prepara lo que comparten todos los rasgos: los eventos de cada partido en
 * orden, de qué equipo es cada jugador (los suyos: `delEquipo`) y el grupo de
 * puesto de cada jugador (su puesto más repetido en esos partidos).
 */
export function contexto(eventos, delEquipo) {
  const porPartido = new Map();
  for (const e of eventos) {
    if (!porPartido.has(e.partido)) porPartido.set(e.partido, []);
    porPartido.get(e.partido).push(e);
  }
  for (const l of porPartido.values()) l.sort((a, b) => a.parte - b.parte || a.idx - b.idx);
  const puestos = new Map();
  for (const e of eventos) {
    if (!e.posicion) continue;
    const m = puestos.get(e.jugadorId) ?? new Map();
    m.set(e.posicion, (m.get(e.posicion) ?? 0) + 1);
    puestos.set(e.jugadorId, m);
  }
  const puestoDe = new Map([...puestos].map(([id, m]) => [id, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
  const grupo = new Map([...puestoDe].map(([id, p]) => [id, grupoDe(p)]));
  /* El equipo de cada evento: los jugadores del rival los da opta:jugadores; si alguno no está, el que juega con ellos. */
  const suyo = (id) => delEquipo.has(id);
  return { porPartido, puestoDe, grupo, suyo, eventos };
}

/** Su siguiente acción en el mismo partido (en `tope` segundos). */
function siguienteSuya(ctx, e, tope = 8) {
  const l = ctx.porPartido.get(e.partido) ?? [];
  const i = l.indexOf(e);
  for (let k = i + 1; k < l.length; k++) {
    const s = l[k];
    if (s.parte !== e.parte || s.segundo - e.segundo > tope) return null;
    if (s.jugadorId === e.jugadorId && s.idx !== e.idx) return s;
  }
  return null;
}

/** La tasa de una cuenta en los de su grupo de puesto de esos partidos (con un mínimo de acciones). */
function medianaDelPuesto(ctx, grupo, cuenta, minimo) {
  const por = new Map();
  for (const e of ctx.eventos) {
    if (ctx.grupo.get(e.jugadorId) !== grupo) continue;
    if (!por.has(e.jugadorId)) por.set(e.jugadorId, []);
    por.get(e.jugadorId).push(e);
  }
  const tasas = [];
  for (const suyos of por.values()) {
    const { a, b } = cuenta(suyos);
    if (b >= minimo) tasas.push(a / b);
  }
  return tasas.length >= 4 ? mediana(tasas) : null;
}

/* ---------- Los rasgos ---------- */
/*
| Cada uno devuelve null si no hay muestra, o
|   { clave, tema?, titulo (corto, para el vídeo), texto (con las cifras),
|     peso (0-100: lo claro y lo útil que es), cortes: [{ e, que, antes, despues }] }
| `tema` = la fortaleza con la que se solapa (el capítulo se queda con el rasgo).
| `contra` = la fortaleza de la temporada que este rasgo de los últimos 5
| partidos desmiente (p. ej. «Juego aéreo» y «por arriba gana el 29 %»): el
| script de los vídeos lo deja en la ficha como forma reciente, sin capítulo.
| Los cortes van primero los que ENSEÑAN el título (25/11/2026: «Remate ·
| con la izquierda» no puede abrir con un cabezazo), y la ventana de cada uno
| (antes/después) se ajustó mirando fotogramas de 25 cortes.
*/

/** Primero los cortes que enseñan lo que dice el título; dentro, el orden que ya traían. */
const primeroLosQueEncajan = (lista, encaja) => [...lista.filter((c) => encaja(c.e)), ...lista.filter((c) => !encaja(c.e))];

function finalizacion(j) {
  const r = j.suyos.filter((e) => ES_REMATE.has(e.tipo) && e.estilo !== "Penalty");
  if (r.length < 4) return null;
  const der = r.filter((e) => e.der).length;
  const izq = r.filter((e) => e.izq).length;
  const cab = r.filter((e) => e.cabeza).length;
  const peq = r.filter((e) => enAreaPequena(e.x, e.y)).length;
  const dentro = r.filter((e) => enArea(e.x, e.y)).length;
  const fuera = r.length - dentro;
  const primer = r.filter((e) => e.primerToque).length;
  const contra = r.filter((e) => e.contra).length;
  const goles = r.filter((e) => e.tipo === "Goal").length;
  const pies = der + izq;
  const cuerpo =
    cab / r.length >= 0.4 ? "de cabeza" : pies && Math.min(der, izq) / pies >= 0.3 ? "con las dos piernas" : der >= izq ? "con la derecha" : "con la izquierda";
  const zona = fuera / r.length >= 0.5 ? "desde fuera" : peq / r.length >= 0.3 ? "en el área pequeña" : primer / r.length >= 0.5 ? "al primer toque" : "dentro del área";
  const parte = (e) => (e.cabeza ? "de cabeza" : e.izq ? "con la izquierda" : e.der ? "con la derecha" : "");
  const encajaCuerpo = (e) => (cuerpo === "de cabeza" ? e.cabeza : cuerpo === "con las dos piernas" ? e.der || e.izq : cuerpo === "con la derecha" ? e.der : e.izq);
  const encajaZona = (e) => (zona === "desde fuera" ? !enArea(e.x, e.y) : zona === "en el área pequeña" ? enAreaPequena(e.x, e.y) : zona === "al primer toque" ? e.primerToque : enArea(e.x, e.y));
  return {
    clave: "finalizacion", tema: "remate", titulo: `Remate · ${cuerpo}, ${zona}`, peso: 60 + Math.min(30, r.length * 2),
    texto: `${plural(r.length, "remate", "remates")}${goles ? ` (${plural(goles, "gol", "goles")})` : ""}: ${der} con la derecha · ${izq} con la izquierda · ${cab} de cabeza; ${dentro} dentro del área (${peq} en el área pequeña) y ${fuera} fuera; ${primer} al primer toque${contra ? ` · ${contra} al contragolpe` : ""}`,
    cortes: r
      .sort((a, b) => encajaCuerpo(b) + encajaZona(b) - encajaCuerpo(a) - encajaZona(a) || (b.tipo === "Goal") - (a.tipo === "Goal") || (b.xG ?? 0) - (a.xG ?? 0))
      .map((e) => corte(e, `${e.tipo === "Goal" ? "Gol" : e.tipo === "AttemptSaved" ? "A puerta" : e.tipo === "Post" ? "Al palo" : "Remate"} ${parte(e)}${enArea(e.x, e.y) ? "" : " desde fuera"}${e.primerToque ? " al primer toque" : ""}`, 6, 3)),
  };
}

function regateDireccion(j, ctx) {
  const tk = j.suyos.filter((e) => e.tipo === "TakeOn");
  const vistos = [];
  for (const e of tk) {
    const sig = siguienteSuya(ctx, e);
    const desde = e.cy ?? e.y;
    const hasta = sig ? sig.y : e.cy != null ? e.y : null;
    if (hasta == null) continue;
    const d = Math.abs(hasta - 50) - Math.abs(desde - 50);
    vistos.push({ e, hacia: d <= -4 ? "dentro" : d >= 4 ? "fuera" : "linea" });
  }
  if (vistos.length < 5) return null;
  const n = (h) => vistos.filter((v) => v.hacia === h).length;
  const dentro = n("dentro");
  const fuera = n("fuera");
  const linea = n("linea");
  const buenos = tk.filter((e) => e.ok).length;
  const total = vistos.length;
  const mayor = dentro >= fuera ? "dentro" : "fuera";
  const cuota = Math.max(dentro, fuera) / total;
  let titulo;
  let texto;
  if (cuota >= 0.85) {
    titulo = `Regate · siempre hacia ${mayor}`;
    texto = `Sólo regatea hacia ${mayor} (${Math.max(dentro, fuera)} de ${total})`;
  } else if (cuota >= 0.6) {
    titulo = `Regate · sobre todo hacia ${mayor}`;
    texto = `Regatea sobre todo hacia ${mayor} (${Math.max(dentro, fuera)} de ${total}; ${Math.min(dentro, fuera)} hacia ${mayor === "dentro" ? "fuera" : "dentro"})`;
  } else {
    titulo = "Regate · por los dos perfiles";
    texto = `Regatea por los dos perfiles (${dentro} hacia dentro · ${fuera} hacia fuera${linea ? ` · ${linea} en línea` : ""})`;
  }
  texto += `; le salen ${buenos} de ${tk.length}${j.pie ? `. Pie bueno: ${j.pie}` : ""}`;
  const orden = { [mayor]: 0, linea: 2 };
  return {
    clave: "regateDireccion", tema: "regate", titulo, texto, peso: 55 + Math.round(cuota * 35),
    cortes: vistos
      .sort((a, b) => (cuota >= 0.6 ? (orden[a.hacia] ?? 1) - (orden[b.hacia] ?? 1) : 0) || b.e.ok - a.e.ok || (orden[a.hacia] ?? 1) - (orden[b.hacia] ?? 1) || b.e.x - a.e.x)
      .map((v) => corte(v.e, `${v.hacia === "linea" ? "En línea" : `Hacia ${v.hacia}`}${v.e.ok ? "" : " · se la quitan"}`, 3, 4)),
  };
}

/** Pierna cambiada: el lado por donde juega y su pie bueno (sin cortes: va en la portada y la ficha). */
function piernaCambiada(j) {
  if (!j.pie) return null;
  const ys = j.suyos.filter((e) => e.x >= 30 && esAccionConBalon(e)).map((e) => e.y);
  if (ys.length < 30) return null;
  const y = mediana(ys);
  if (y > 40 && y < 60) return null;
  const lado = y <= 40 ? "derecha" : "izquierda";
  const cambiada = (lado === "derecha" && j.pie === "izquierdo") || (lado === "izquierda" && j.pie === "derecho");
  return {
    clave: "piernaCambiada", titulo: cambiada ? `A pierna cambiada · ${j.pie === "izquierdo" ? "zurdo" : "diestro"} en la ${lado}` : `A pierna natural · por la ${lado}`,
    texto: `Juega por la ${lado} (${pct(ys.filter((v) => (lado === "derecha" ? v < 50 : v >= 50)).length, ys.length)} % de sus acciones con balón en campo rival) y su pie bueno es el ${j.pie}${cambiada ? ": a pierna cambiada" : ""}`,
    peso: cambiada ? 50 : 30, cortes: [],
  };
}

function centros(j) {
  const c = j.suyos.filter((e) => e.tipo === "Pass" && e.centro && !e.corner && !e.falta);
  if (c.length < 4) return null;
  const fondo = c.filter((e) => e.x >= 92).length;
  const tres = c.filter((e) => e.x < 83).length;
  const pico = c.length - fondo - tres;
  const der = c.filter((e) => e.y < 50).length;
  const izq = c.length - der;
  const buenos = c.filter((e) => e.ok).length;
  const zonas = [["desde línea de fondo", fondo], ["desde el pico del área", pico], ["desde tres cuartos", tres]].sort((a, b) => b[1] - a[1]);
  const lados = Math.min(der, izq) / c.length >= 0.25 ? "desde las dos bandas" : `desde la ${der >= izq ? "derecha" : "izquierda"}`;
  const zonaDe = (e) => (e.x >= 92 ? "línea de fondo" : e.x < 83 ? "tres cuartos" : "pico del área");
  return {
    clave: "centros", tema: "centro", titulo: `Centro · ${zonas[0][0]}`, peso: 50 + Math.min(35, c.length * 2),
    texto: `${plural(c.length, "centro", "centros")} (${plural(buenos, "bueno", "buenos")}) ${lados}: ${fondo} desde línea de fondo · ${pico} desde el pico del área · ${tres} desde tres cuartos; ${der} por la derecha y ${izq} por la izquierda${j.pie ? `. Pie bueno: ${j.pie} (Opta no dice con qué pierna centra)` : ""}`,
    cortes: primeroLosQueEncajan(
      c.sort((a, b) => b.ok - a.ok || b.ocasion - a.ocasion || b.xPV - a.xPV).map((e) => corte(e, `Desde ${zonaDe(e)} · banda ${banda(e.y)}${e.ocasion ? " · ocasión" : ""}`, 3, 4)),
      (e) => `desde ${zonaDe(e) === "pico del área" ? "el pico del área" : zonaDe(e)}` === zonas[0][0],
    ),
  };
}

function progresion(j) {
  const pases = j.suyos.filter(esPaseQueAvanza);
  const cond = j.suyos.filter((e) => conduccion(e) && e.tipo !== "TakeOn");
  const reg = j.suyos.filter((e) => e.tipo === "TakeOn" && e.ok);
  const total = pases.length + cond.length + reg.length;
  if (total < 6) return null;
  const vias = [["con el pase", pases.length], ["con la conducción", cond.length], ["con el regate", reg.length]].sort((a, b) => b[1] - a[1]);
  const titulo = vias[0][1] / total >= 0.55 ? `Progresa · ${vias[0][0]}` : `Progresa · ${vias[0][0].replace("con el ", "").replace("con la ", "")} y ${vias[1][0].replace("con el ", "").replace("con la ", "")}`;
  const lista = [
    ...pases.sort((a, b) => b.xPV - a.xPV).map((e) => corte(e, e.cambio ? "Cambio de orientación" : e.hueco ? "Pase al hueco" : "Pase que avanza", 4, 3)),
    ...cond.sort((a, b) => conduccion(b) - conduccion(a)).map((e) => corte(e, `Conducción de ${Math.round(conduccion(e) * 1.05)} m`, 6, 2)),
    ...reg.sort((a, b) => b.x - a.x).map((e) => corte(e, "Regate", 3, 4)),
  ];
  /* Los cortes por turnos según su peso: primero la vía que más usa. */
  const por = new Map(vias.map(([v]) => [v, []]));
  for (const c of lista) por.get(c.que === "Regate" ? "con el regate" : c.que.startsWith("Conducción") ? "con la conducción" : "con el pase").push(c);
  const cortes = [];
  for (let i = 0; cortes.length < lista.length; i++) for (const [v] of vias) if (por.get(v)[i]) cortes.push(por.get(v)[i]);
  return {
    clave: "progresa", tema: "progresion", titulo, peso: 50 + Math.round((vias[0][1] / total) * 30),
    texto: `Cómo hace avanzar al equipo: ${plural(pases.length, "pase", "pases")} que avanzan (${plural(pases.filter((e) => e.cambio).length, "cambio de orientación", "cambios de orientación")}, ${pases.filter((e) => e.hueco).length} al hueco) · ${plural(cond.length, "conducción", "conducciones")} de 10 m o más · ${plural(reg.length, "regate", "regates")} ganados`,
    cortes,
  };
}

/** Acelerador de transición: su primera acción en los 10 s después de que su equipo recupere. */
function transicion(j, ctx) {
  const vistos = [];
  for (const [, l] of ctx.porPartido) {
    for (let i = 0; i < l.length; i++) {
      const R = l[i];
      const roba = R.tipo === "BallRecovery" || R.tipo === "Interception" || (R.tipo === "Tackle" && R.ok);
      if (!roba || !ctx.suyo(R.jugadorId)) continue;
      for (let k = i + 1; k < l.length; k++) {
        const s = l[k];
        if (s.parte !== R.parte || s.segundo - R.segundo > 10) break;
        if (!ctx.suyo(s.jugadorId) && ["Pass", "TakeOn", "BallRecovery", "Interception", "Clearance", "Save", "Claim"].includes(s.tipo)) break;
        if (s.jugadorId !== j.id || !esAccionConBalon(s)) continue;
        const como = s.tipo === "TakeOn" ? "regate" : conduccion(s) >= 8 ? "conducción" : s.tipo === "Pass" && s.finX != null && s.finX - s.x >= 12 ? "pase" : "asegura";
        vistos.push({ s, R, como });
        break;
      }
    }
  }
  if (vistos.length < 5) return null;
  const n = (c) => vistos.filter((v) => v.como === c).length;
  const vias = [["pase", n("pase")], ["conducción", n("conducción")], ["regate", n("regate")]].sort((a, b) => b[1] - a[1]);
  const acelera = vias.reduce((s, v) => s + v[1], 0);
  const cuota = acelera / vistos.length;
  const articulo = { pase: "el pase", "conducción": "la conducción", regate: "el regate" };
  const titulo = cuota >= 0.45 ? `Tras robo · acelera con ${articulo[vias[0][0]]}` : "Tras robo · pausa y asegura";
  return {
    clave: "transicion", titulo, peso: cuota >= 0.45 ? 55 + Math.round(cuota * 35) : 35,
    texto: `Tras recuperar su equipo, su primera acción en 10 s (${vistos.length} veces): ${plural(n("pase"), "pase", "pases")} hacia delante · ${plural(n("conducción"), "conducción", "conducciones")} · ${plural(n("regate"), "regate", "regates")} · asegura ${n("asegura")} (corto, de lado o atrás)${cuota >= 0.45 ? `: acelerador (${pct(acelera, vistos.length)} %)` : ""}`,
    cortes: vistos
      .filter((v) => (cuota >= 0.45 ? v.como !== "asegura" : true))
      .sort((a, b) => (b.s.xPV ?? 0) - (a.s.xPV ?? 0))
      .map((v) => corte(v.s, `Tras robo · ${v.como}`, Math.max(4, Math.min(8, v.s.segundo - v.R.segundo + 3)), 3)),
  };
}

/** Riesgo en campo propio: sus pérdidas en su mitad, contra los de su puesto en esos partidos. */
function riesgo(j, ctx) {
  const cuenta = (l) => {
    /* Sin balones largos ni saques de puerta: eso es su forma de salir (va en «salida»), no el riesgo. */
    const mitad = l.filter((e) => e.x < 50 && esAccionConBalon(e) && !e.saquePuerta && !e.largo);
    return { a: mitad.filter(esPerdida).length, b: mitad.length, perdidas: mitad.filter(esPerdida) };
  };
  const { a, b, perdidas } = cuenta(j.suyos);
  if (b < 25) return null;
  const med = medianaDelPuesto(ctx, j.grupo, cuenta, 25);
  const suya = a / b;
  const partidos = j.partidos;
  const ref = med != null && med > 0 ? `; los de su puesto en esos partidos, el ${Math.round(med * 100)} %` : "";
  let titulo;
  let texto;
  let peso;
  if (!a) {
    titulo = "Campo propio · no la pierde";
    texto = `Ninguna pérdida en su campo en ${plural(partidos, "partido", "partidos")} (${b} acciones con balón en su mitad)`;
    peso = 40;
  } else if (med != null && suya <= med * 0.7) {
    titulo = "Campo propio · arriesga poco";
    texto = `Arriesga poco en campo propio: ${plural(a, "pérdida", "pérdidas")} en ${plural(partidos, "partido", "partidos")} (el ${Math.round(suya * 100)} % de sus acciones en su mitad${ref})`;
    peso = 50;
  } else if (med != null && suya >= med * 1.3) {
    titulo = "Campo propio · arriesga y la pierde";
    texto = `Arriesga en campo propio: ${plural(a, "pérdida", "pérdidas")} en ${plural(partidos, "partido", "partidos")} (el ${Math.round(suya * 100)} % de sus acciones en su mitad${ref}). Presionarle`;
    peso = 85;
  } else {
    titulo = "Campo propio · riesgo normal";
    texto = `${plural(a, "pérdida", "pérdidas")} en su campo en ${plural(partidos, "partido", "partidos")} (el ${Math.round(suya * 100)} % de sus acciones en su mitad${ref})`;
    peso = 30;
  }
  const que = (e) => (e.tipo === "Pass" ? (e.largo ? "Balón largo perdido" : "Pase perdido") : e.tipo === "TakeOn" ? "Regate perdido" : e.tipo === "Dispossessed" ? "Le roban" : "Control perdido");
  return { clave: "riesgo", titulo, texto, peso, cortes: perdidas.sort((p, q) => p.x - q.x).map((e) => corte(e, `${que(e)} en su campo`, 3, 5)) };
}

/** Salida de balón (centrales y porteros): corto o largo, contra los de su puesto. */
function salida(j, ctx) {
  const portero = j.grupo === "POR";
  const cuenta = (l) => {
    const p = l.filter((e) => e.tipo === "Pass" && e.x < 50 && !e.corner && !e.falta && (portero || !e.saquePuerta));
    return { a: p.filter((e) => e.largo).length, b: p.length, p };
  };
  const { a: largos, b: n, p } = cuenta(j.suyos);
  if (n < 20) return null;
  const med = medianaDelPuesto(ctx, j.grupo, cuenta, 20);
  const cuota = largos / n;
  const largosBuenos = p.filter((e) => e.largo && e.ok).length;
  const rompen = p.filter(esPaseQueAvanza).length;
  const cambios = p.filter((e) => e.cambio).length;
  const saques = p.filter((e) => e.saquePuerta);
  const base = portero ? "Con el pie" : "Salida";
  const titulo = med != null && cuota >= Math.max(0.25, med * 1.35) ? `${base} · en largo` : med != null && cuota <= med * 0.7 ? `${base} · en corto` : `${base} · corto y largo`;
  return {
    clave: "salida", tema: "progresion", titulo, peso: /largo|corto$/.test(titulo) && !titulo.includes("y largo") ? 65 : 40,
    texto: `${n} pases en su campo: ${largos} en largo (${pct(largos, n)} %${med != null ? `; los de su puesto, ${Math.round(med * 100)} %` : ""}), ${largosBuenos} de ellos buenos · ${rompen} que rompen líneas · ${plural(cambios, "cambio de orientación", "cambios de orientación")}${portero && saques.length ? ` · ${saques.length} saques de puerta, ${saques.filter((e) => e.largo).length} en largo` : ""}`,
    cortes: p
      .filter((e) => (titulo.endsWith("en corto") ? esPaseQueAvanza(e) || !e.largo : e.largo || esPaseQueAvanza(e)))
      .sort((x, y) => y.ok - x.ok || y.xPV - x.xPV)
      .map((e) => corte(e, e.largo ? (e.ok ? "Balón largo" : "Balón largo perdido") : e.cambio ? "Cambio de orientación" : "Pase que rompe", 3, 4)),
  };
}

function aereo(j) {
  const a = j.suyos.filter((e) => e.tipo === "Aerial");
  if (a.length < 6) return null;
  const ganados = a.filter((e) => e.ok);
  const enSuArea = a.filter((e) => e.x < 17).length;
  const arriba = a.filter((e) => e.x >= 50).length;
  const p = pct(ganados.length, a.length);
  return {
    clave: "duelosAereos", tema: p >= 55 ? "aereo" : undefined, contra: p < 50 ? "aereo" : undefined, titulo: p >= 60 ? `Por arriba · gana el ${p} %` : p <= 40 ? `Por arriba · pierde (${p} % ganados)` : `Por arriba · ${p} % ganados`,
    peso: p >= 65 ? 70 : p <= 35 ? 60 : 40,
    texto: `Gana ${ganados.length} de ${a.length} duelos aéreos (${p} %); ${enSuArea} en su área y ${arriba} en campo rival`,
    cortes: (p <= 40 ? a.filter((e) => !e.ok) : ganados).sort((x, y) => (j.grupo === "DC" ? y.x - x.x : x.x - y.x)).map((e) => corte(e, e.ok ? "Duelo aéreo ganado" : "Duelo aéreo perdido", 3, 3)),
  };
}

function anticipacion(j) {
  const l = j.suyos.filter((e) => e.tipo === "Interception" || (e.tipo === "Tackle" && e.ok));
  if (l.length < 6) return null;
  const linea = j.grupo === "CEN" ? 33 : 50;
  const delante = l.filter((e) => e.x >= linea);
  const cuota = delante.length / l.length;
  const int = l.filter((e) => e.tipo === "Interception").length;
  return {
    clave: "anticipacion", tema: "recuperacion", titulo: cuota >= 0.45 ? "Defiende · salta hacia delante" : "Defiende · espera atrás",
    peso: cuota >= 0.55 || cuota <= 0.2 ? 60 : 40,
    texto: `${plural(int, "intercepción", "intercepciones")} y ${plural(l.length - int, "entrada ganada", "entradas ganadas")}; ${delante.length} lejos de su área (${j.grupo === "CEN" ? "más allá de su tercio" : "en campo rival"})`,
    cortes: l.sort((a, b) => (cuota >= 0.45 ? b.x - a.x : a.x - b.x)).map((e) => corte(e, e.tipo === "Interception" ? "Intercepción" : "Entrada ganada", 3, 3)),
  };
}

function despejes(j) {
  const d = j.suyos.filter((e) => e.tipo === "Clearance");
  if (d.length < 8) return null;
  const cab = d.filter((e) => e.cabeza).length;
  const area = d.filter((e) => e.x < 17).length;
  return {
    clave: "despejes", tema: "despeje", titulo: cab / d.length >= 0.5 ? "Despeje · de cabeza" : "Despeje · con el pie", peso: 40,
    texto: `${d.length} despejes: ${cab} de cabeza y ${d.length - cab} con el pie; ${area} dentro de su área`,
    cortes: primeroLosQueEncajan(
      d.sort((a, b) => a.x - b.x).map((e) => corte(e, e.cabeza ? "Despeje de cabeza" : "Despeje con el pie", 3, 3)),
      (e) => (cab / d.length >= 0.5 ? e.cabeza : !e.cabeza),
    ),
  };
}

/** El 1 contra 1 defensivo en banda: entradas (gana) contra Challenge (le regatean). */
function unoContraUno(j) {
  const l = j.suyos.filter((e) => (e.tipo === "Tackle" || e.tipo === "Challenge") && e.x < 60 && (e.y < 30 || e.y > 70));
  if (l.length < 4) return null;
  const gana = l.filter((e) => e.tipo === "Tackle").length;
  const pierde = l.length - gana;
  const p = pct(gana, l.length);
  return {
    clave: "unoContraUno", contra: p < 60 ? "entrada" : undefined, titulo: p >= 60 ? `Defendiendo en banda · gana ${gana} de ${l.length}` : `Defendiendo en banda · le superan ${pierde} de ${l.length}`,
    peso: p <= 50 ? 80 : p >= 75 ? 60 : 40,
    texto: `En banda gana ${gana} de ${l.length} duelos al regateador (${p} %); le superan ${pierde}`,
    cortes: l.sort((a, b) => (p < 60 ? (a.tipo === "Challenge" ? -1 : 1) - (b.tipo === "Challenge" ? -1 : 1) : (a.tipo === "Tackle" ? -1 : 1) - (b.tipo === "Tackle" ? -1 : 1))).map((e) => corte(e, e.tipo === "Tackle" ? "Gana el duelo" : "Le regatean", 4, 3)),
  };
}

function llegadas(j) {
  const ofensivas = j.suyos.filter((e) => ["Pass", "TakeOn", "BallTouch", "Goal", "AttemptSaved", "Miss", "Post"].includes(e.tipo));
  const area = ofensivas.filter((e) => enArea(e.x, e.y));
  const ultimo = ofensivas.filter((e) => e.x >= 67);
  if (ultimo.length < 10) return null;
  const porPartido = area.length / Math.max(1, j.partidos);
  return {
    clave: "llegadas", titulo: porPartido >= 1.5 ? "Llega al área rival" : "Llega poco al área rival", peso: porPartido >= 2 ? 60 : 35,
    texto: `${area.length} acciones con balón en el área rival y ${ultimo.length} en el último tercio en ${plural(j.partidos, "partido", "partidos")}`,
    cortes: porPartido >= 1.5 ? area.sort((a, b) => b.xPV - a.xPV).map((e) => corte(e, "En el área rival", 5, 3)) : [],
  };
}

/** Delantero: apoyos de espaldas (descargas en tres cuartos y aéreos ganados arriba). */
function apoyos(j) {
  const desc = j.suyos.filter((e) => e.tipo === "Pass" && e.ok && !e.centro && e.x >= 55 && e.x <= 85 && Math.abs(e.y - 50) <= 25 && e.finX != null && e.finX <= e.x + 2);
  const aer = j.suyos.filter((e) => e.tipo === "Aerial" && e.ok && e.x >= 50);
  if (desc.length + aer.length < 8) return null;
  return {
    clave: "apoyos", titulo: "De espaldas · apoya y descarga", peso: 45 + Math.min(30, desc.length + aer.length),
    texto: `${desc.length} descargas (pases atrás o de lado en tres cuartos) y ${aer.length} duelos aéreos ganados en campo rival`,
    cortes: [...desc.map((e) => corte(e, "Descarga", 4, 3)), ...aer.map((e) => corte(e, "Gana arriba", 3, 3))].sort((a, b) => b.e.xPV - a.e.xPV),
  };
}

/** Desmarque al espacio: los pases al hueco o largos hacia él. */
function desmarque(j, ctx) {
  const l = ctx.eventos.filter((e) => e.tipo === "Pass" && e.receptorId === j.id && (e.hueco || (e.largo && (e.finX ?? 0) >= 67)));
  if (l.length < 3) return null;
  const hueco = l.filter((e) => e.hueco).length;
  return {
    clave: "desmarque", titulo: "Desmarque · al espacio", peso: 45 + Math.min(35, l.length * 4),
    texto: `Le llegan al espacio ${l.length} balones (${hueco} pases al hueco y ${l.length - hueco} balones largos al último tercio)`,
    cortes: l.sort((a, b) => b.ok - a.ok || (b.finX ?? 0) - (a.finX ?? 0)).map((e) => corte(e, e.hueco ? "Pase al hueco para él" : "Balón largo para él", 2, 6)),
  };
}

function paradas(j, ctx) {
  const s = j.suyos.filter((e) => e.tipo === "Save");
  if (s.length < 4) return null;
  /* El remate que para: el AttemptSaved del rival en el mismo segundo. */
  const tiro = (e) => ctx.eventos.find((t) => t.partido === e.partido && t.parte === e.parte && t.tipo === "AttemptSaved" && Math.abs(t.segundo - e.segundo) <= 1 && !ctx.suyo(t.jugadorId));
  const con = s.map((e) => ({ e, t: tiro(e) }));
  const dentro = con.filter((c) => c.t && enArea(c.t.x, c.t.y)).length;
  const fuera = con.filter((c) => c.t && !enArea(c.t.x, c.t.y)).length;
  const cab = con.filter((c) => c.t?.cabeza).length;
  const est = s.filter((e) => e.estirada).length;
  return {
    clave: "paradasTipo", tema: "paradas", titulo: dentro >= fuera ? "Paradas · tiros de cerca" : "Paradas · tiros lejanos", peso: 60,
    texto: `${s.length} paradas: ${dentro} de tiros dentro del área y ${fuera} de fuera; ${cab} de cabeza; ${est} en estirada`,
    cortes: con.sort((a, b) => Number(Boolean(b.t) && enArea(b.t.x, b.t.y) === dentro >= fuera) - Number(Boolean(a.t) && enArea(a.t.x, a.t.y) === dentro >= fuera) || (b.t?.xG ?? 0) - (a.t?.xG ?? 0)).map((c) => corte(c.e, `Parada${c.t ? (enArea(c.t.x, c.t.y) ? " · tiro de dentro" : " · tiro de fuera") : ""}${c.e.estirada ? " · estirada" : ""}`, 5, 3)),
  };
}

function salidas(j) {
  const claim = j.suyos.filter((e) => e.tipo === "Claim");
  const punch = j.suyos.filter((e) => e.tipo === "Punch");
  const sweep = j.suyos.filter((e) => e.tipo === "Sweeper");
  const n = claim.length + punch.length + sweep.length;
  if (n < 3) return null;
  return {
    clave: "salidas", titulo: claim.length + punch.length >= sweep.length ? "Salidas · por alto" : "Salidas · fuera del área", peso: 45 + Math.min(30, n * 3),
    texto: `${plural(claim.length, "balón por alto atrapado", "balones por alto atrapados")} · ${plural(punch.length, "despeje de puños", "despejes de puños")} · ${plural(sweep.length, "salida", "salidas")} lejos de la portería`,
    cortes: (claim.length + punch.length >= sweep.length ? [...claim, ...punch, ...sweep] : [...sweep, ...claim, ...punch]).map((e) => corte(e, e.tipo === "Claim" ? "Blocaje por alto" : e.tipo === "Punch" ? "Despeje de puños" : "Salida", 4, 3)),
  };
}

/* ---------- Qué se mira en cada puesto ---------- */

const POR_GRUPO = {
  POR: [paradas, salidas, salida, riesgo],
  CEN: [salida, riesgo, aereo, anticipacion, despejes],
  LAT: [centros, unoContraUno, llegadas, regateDireccion, transicion, riesgo, piernaCambiada],
  MC: [progresion, transicion, riesgo, anticipacion, finalizacion],
  MP: [progresion, transicion, finalizacion, regateDireccion, desmarque],
  EXT: [regateDireccion, centros, finalizacion, transicion, desmarque, piernaCambiada],
  DC: [finalizacion, desmarque, apoyos, aereo, transicion],
};

export const NOMBRE_GRUPO = { POR: "portero", CEN: "central", LAT: "lateral", MC: "mediocentro", MP: "mediapunta", EXT: "extremo", DC: "delantero centro" };

/**
 * Los rasgos de un jugador. `pie` = «derecho»/«izquierdo» (PrefFoot de Opta) o null.
 * Devuelve { grupo, posicion, rasgos } con los rasgos de más a menos peso.
 */
export function rasgosDe(id, ctx, pie) {
  const suyos = ctx.eventos.filter((e) => e.jugadorId === id);
  const posicion = ctx.puestoDe.get(id) ?? "";
  const grupo = ctx.grupo.get(id) ?? "MC";
  const j = { id, suyos, grupo, pie, partidos: new Set(suyos.map((e) => e.partido)).size };
  const rasgos = POR_GRUPO[grupo].map((f) => f(j, ctx)).filter(Boolean).sort((a, b) => b.peso - a.peso);
  return { grupo, posicion, rasgos };
}
