/* eslint-disable @typescript-eslint/no-require-imports -- arnés de Node: corre
   en el ordenador del club, no lo empaqueta nadie. */
/**
 * LA BASE DEL ANÁLISIS, SACADA DEL TIMELINE DE HUDL.
 *
 *   node scripts/partido/preparar.cjs --carpeta "<carpeta del partido>"
 *
 * Es `HUDL ALCORCON/armar.cjs` + `fichas.cjs` del J5, sin nada escrito a mano:
 * jornada, rival, marcador y nombres salen de `partido.json` y de la propia
 * hoja. Deja en la carpeta:
 *
 *   conteo.json            lo que dice Hudl que hubo: córners, saques de banda,
 *                          faltas y penaltis de cada equipo. Es la vara con la
 *                          que `verificar.cjs` mira que no falte nada.
 *   base/bandaOf.tsv       una fila por saque de banda, con las columnas que
 *   base/bandaDef.tsv      salen del dato (Tiempo, Minuto, Sacador, Perfil,
 *                          Zona, Envío, Caída, Receptor, Resultado). Las de
 *                          criterio van en blanco: las pone el vídeo.
 *   base/banda-detalle.csv lo que dice Hudl de cada saque, sin traducir
 *   base/piezas.json       córners, faltas y penaltis, con su segundo de vídeo
 *   faltas/of-hudl.csv     todas las faltas, en el formato de ANALISIS FALTAS
 *   faltas/def-hudl.csv    (zona, carril y distancia del dato; «entre» con ?)
 *   jugadas/<id>/ficha.txt lo que registró Hudl de cada jugada, para quien
 *                          mire las imágenes
 *   trabajos.json          los tramos de la retransmisión que hay que bajar
 *                          (`scripts/hudl-fotogramas.mjs`)
 *
 * Lo que NO sale del dato se deja en blanco a propósito (calidad, intención,
 * defensa, debilidad, rutina, repetir, velocidad, ocupación…): es juicio y lo
 * pone quien mira el vídeo, según los manuales de `scripts/partido/manuales`.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  NOSOTROS,
  publicada,
  leePartido,
  leeTimeline,
  sinTildes,
  uno,
  reloj,
  sinDorsal,
  escribeTsv,
} = require("./comun.cjs");

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};

const CARPETA = arg("carpeta");

if (!CARPETA) {
  console.error('Uso: node scripts/partido/preparar.cjs --carpeta "<carpeta del partido>"');
  process.exit(1);
}

const P = leePartido(CARPETA);

const T = leeTimeline(CARPETA);

const { acciones, esNuestro, equipoDe, tiempo, minuto, codigosEquipo } = T;

const RIVAL_CORTO = P.rival;

/* ------------------------------------------------------------------ */
/*  NOMBRES COMO LOS ESCRIBE LA HOJA                                   */
/* ------------------------------------------------------------------ */

/*
| Cada pestaña escribe a los nuestros a su manera: en banda Ciria es «Alexis»
| y en córners «Ciria»; Joan Martínez es «Joan» y hay otro «Martínez». Así que
| el nombre sale de los valores que ya tiene ESA columna en ESA pestaña: el que
| coincide con una palabra del nombre de Hudl, y entre varios el más usado.
*/
function nombrador(valores) {
  const cuenta = {};

  for (const v of valores) if (v) cuenta[v] = (cuenta[v] || 0) + 1;

  return (jug) => {
    const pals = sinTildes(sinDorsal(jug)).split(/\s+/);

    const casan = Object.keys(cuenta).filter((v) => pals.includes(sinTildes(v)));

    if (casan.length) return casan.sort((a, b) => cuenta[b] - cuenta[a])[0];

    return sinDorsal(jug).split(" ").slice(-1)[0];
  };
}

/* ------------------------------------------------------------------ */
/*  PUESTOS                                                            */
/* ------------------------------------------------------------------ */

const puestoDe = {};

for (const a of acciones) {
  const p = uno(a.m, "08 - Player - Position");

  if (!p) continue;

  puestoDe[a.jug] ??= {};
  puestoDe[a.jug][p] = (puestoDe[a.jug][p] || 0) + 1;
}

const puesto = (jug) => Object.entries(puestoDe[jug] || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

function linea(jug) {
  const p = puesto(jug);

  if (/^(CF|SS)$/.test(p)) return "9";
  if (/(W|RAMF|LAMF)$/.test(p)) return "Extremo";
  if (/^AMF$/.test(p)) return "10";
  if (/(DMF|CMF)$/.test(p)) return "Medios";
  if (/^(GK|RCB|LCB|CB|RB|LB|RWB|LWB|RCB3|LCB3)$/.test(p)) return "Primera linea";

  return "";
}

const sufijo = (nuestro) => (nuestro ? "" : " Rival");

/* ------------------------------------------------------------------ */
/*  SAQUES DE BANDA                                                    */
/* ------------------------------------------------------------------ */

const posesionesSaque = [
  ...(codigosEquipo["Throw ins"]?.nuestro ?? []),
  ...(codigosEquipo["Throw ins"]?.rival ?? []),
];

const piezasEquipo = [
  ...(codigosEquipo.Corners?.nuestro ?? []),
  ...(codigosEquipo.Corners?.rival ?? []),
  ...(codigosEquipo["Free kicks"]?.nuestro ?? []),
  ...(codigosEquipo["Free kicks"]?.rival ?? []),
];

const deNosotros = (m) => (m.tags.find((t) => t.key === "HUDL_CODE")?.values[0] ?? "").startsWith(NOSOTROS);

/*
| El saque casi nunca trae pase (5 de 41 en el J5): el momento siguiente es de
| quien lo recibe. El receptor es el primero del equipo que saca que hace algo
| en los 6 s siguientes; si antes toca uno del otro equipo, se perdió.
*/
const saques = acciones
  .filter((a) => a.tipos.includes("Throw in"))
  .map((a) => {
    const suyo = esNuestro(a.jug);

    const siguiente = acciones.find(
      (x) => x.t > a.t && x.t - a.t <= 6000 && !(x.jug === a.jug && x.t - a.t < 1000),
    );

    const recibe = siguiente && esNuestro(siguiente.jug) === suyo ? siguiente : null;

    return { ...a, recibe, perdido: Boolean(siguiente && !recibe) };
  });

function resultadoBanda(saque, nuestro) {
  const pos = posesionesSaque
    .filter((p) => deNosotros(p) === nuestro)
    .sort((a, b) => Math.abs(a.startTimeMs - saque.t) - Math.abs(b.startTimeMs - saque.t))[0];

  const cerca = pos && Math.abs(pos.startTimeMs - saque.t) < 15000;

  const fin = cerca ? pos.endTimeMs : saque.t + 10000;

  const resultado = cerca ? uno(pos, "07 - Outcome") : "";
  const eventos = cerca ? uno(pos, "06 - Number of team events") : "";

  const gol = acciones.find(
    (a) => a.t >= saque.t && a.t <= fin + 2000 && a.tipos.includes("Goal") && esNuestro(a.jug) === nuestro,
  );

  if (gol) return { r: "Gol" + sufijo(nuestro), eventos, resultado };

  if (/Shot/.test(resultado)) return { r: "Ocasión" + sufijo(nuestro), eventos, resultado };

  /* Un córner o una falta nada más acabar la posesión: acabó en ABP. */
  const pieza = piezasEquipo.find((p) => p.startTimeMs >= saque.t && p.startTimeMs <= fin + 8000);

  if (pieza) return { r: deNosotros(pieza) ? "ABP" : "ABP Rival", eventos, resultado };

  const falta = acciones.find((a) => a.t > saque.t && a.t <= fin + 3000 && a.tipos.includes("Foul"));

  if (falta) return { r: !esNuestro(falta.jug) ? "ABP" : "ABP Rival", eventos, resultado };

  const pisa = acciones.some(
    (a) =>
      a.t >= saque.t &&
      a.t <= fin &&
      esNuestro(a.jug) === nuestro &&
      uno(a.m, "04 - Location - Third") === "Final third" &&
      !a.tipos.some((x) => /Foul|Infraction|Duel|Interception|Clearance/.test(x)),
  );

  if (pisa) return { r: nuestro ? "Conquista de último tercio" : "Conquista último tercio Rival", eventos, resultado };

  if (eventos === "4 or less") return { r: "Posicional" + sufijo(!nuestro), eventos, resultado };

  return { r: "Posicional" + sufijo(nuestro), eventos, resultado };
}

const zonaBanda = (tercio) => ({ "Own third": "Zona 1", "Middle third": "Zona 2", "Final third": "Zona 3" })[tercio] || "";
const ladoBanda = (carril) => ({ "Right flank": "Derecho", "Left flank": "Izquierdo" })[carril] || "";

const envio = (largo) => (/Short|Medium/.test(largo) ? "Corto" : /Long/.test(largo) ? "Largo" : "");

const ORDEN_TERCIO = { "Own third": 1, "Middle third": 2, "Final third": 3 };

function caida(a) {
  if (!a.recibe) return "";

  const r = a.recibe.m;
  const desde = uno(a.m, "03 - Location - Flank");
  const hasta = uno(r, "03 - Location - Flank");
  const t0 = ORDEN_TERCIO[uno(a.m, "04 - Location - Third")];
  const t1 = ORDEN_TERCIO[uno(r, "04 - Location - Third")];

  if (t1 === 3 && hasta === "Center") return "Area";

  let sentido = "";

  if (t1 > t0) sentido = "Progresión";
  else if (t1 < t0) sentido = "Retroceso";
  else {
    const l = linea(a.recibe.jug);

    sentido = l === "Primera linea" ? "Retroceso" : l === "9" || l === "Extremo" ? "Progresión" : "";
  }

  if (!sentido) return "";

  return `${sentido} ${hasta === desde ? "Carril Exterior" : "Carril Interior"}`;
}

const CAB_BANDA_OF = ["id", "JORNADA", "Rival", "Tiempo", "Minuto", "Resultado RMC", "Resultado RIVAL", "Sacador", "Perfil", "Zona_Saque", "Tipo_Envio", "Zona_Caida", "Calidad_Envio", "Intencion", "N_Bloqueadores", "Receptor", "Defensa_Rival", "Debilidad_Rival", "Resultado_Final", "Rutina", "Repetir", "Velocidad_Saque"];

const CAB_BANDA_DEF = ["id", "JORNADA", "Rival", "Tiempo", "Minuto", "Resultado RMC", "Resultado RIVAL", "Perfil", "Zona_Saque", "Tipo_Envio", "Zona_Caida", "Calidad_Envio", "N_Bloqueadores", "Receptor", "Defensa", "Debilidad_Defensiva", "Resultado_Final"];

/* ------------------------------------------------------------------ */
/*  FALTAS                                                             */
/* ------------------------------------------------------------------ */

/*
| La falta es el «Foul» del que la comete y su sitio viene contado hacia la
| portería que ataca ÉL; la hoja de faltas lo cuenta hacia la que ataca quien
| SACA. Si el otro tiene su «Foul suffered» en el mismo segundo, se usa ése,
| que ya viene girado.
*/
const GIRA_TERCIO = { "Own third": "campo rival", "Middle third": "medio campo", "Final third": "campo propio" };
const TERCIO = { "Own third": "campo propio", "Middle third": "medio campo", "Final third": "campo rival" };
const GIRA_CARRIL = { "Left flank": "derecha", "Right flank": "izquierda", Center: "centro" };
const CARRIL = { "Left flank": "izquierda", "Right flank": "derecha", Center: "centro" };

const distancia = (zona, carril) => (zona === "campo rival" ? (carril === "centro" ? "frontal" : "media") : "lejana");

/* ------------------------------------------------------------------ */
/*  FICHAS                                                             */
/* ------------------------------------------------------------------ */

const quien = (jug) => (esNuestro(jug) ? "CASTILLA" : RIVAL_CORTO.toUpperCase());

const lineaAccion = (a, t0) => {
  const s = Math.round((a.t - t0) / 1000);

  return (
    `  ${s >= 0 ? "+" : ""}${s}s  ${quien(a.jug).padEnd(10)} ${a.jug.padEnd(24)} ${a.tipos.slice(0, 3).join(" + ")}` +
    `  [${uno(a.m, "04 - Location - Third")}, ${uno(a.m, "03 - Location - Flank")}]` +
    (uno(a.m, "10 - Pass - Recipient") ? `  → ${uno(a.m, "10 - Pass - Recipient")} (${uno(a.m, "09 - Pass - Accurate")})` : "") +
    (uno(a.m, "29 - Infraction - Card") ? `  TARJETA ${uno(a.m, "29 - Infraction - Card")}` : "")
  );
};

const contexto = (t0, desde, hasta) =>
  acciones
    .filter((a) => a.t >= t0 + desde && a.t <= t0 + hasta)
    .map((a) => lineaAccion(a, t0))
    .join("\n");

const trabajos = [];

const JUGADAS = path.join(CARPETA, "jugadas");

function ficha(id, desdeS, dura, lineas) {
  const dir = path.join(JUGADAS, id);

  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, "ficha.txt"), lineas.filter((l) => l !== null).join("\n") + "\n", "utf8");

  trabajos.push({ dir: dir.replace(/\\/g, "/"), desde: Math.max(0, desdeS), dura });
}

/* ------------------------------------------------------------------ */
/*  TODO JUNTO                                                         */
/* ------------------------------------------------------------------ */

(async () => {
  /* Los nombres que ya usa cada pestaña. */
  let hojaBanda = [];
  let hojaPiezas = [];

  try {
    hojaBanda = await publicada("bandaOf");
    hojaPiezas = await publicada("piezasOf");
  } catch (error) {
    console.log(`(no se ha podido leer la hoja para los nombres: ${error.message})`);
  }

  const nombreBanda = nombrador(hojaBanda.map((f) => f.Sacador));
  const nombrePiezas = nombrador([...hojaPiezas.map((f) => f.Sacador), ...hojaPiezas.map((f) => f.Rematador)]);

  const COMUN = {
    JORNADA: P.etiqueta,
    Rival: P.rivalHoja,
    "Resultado RMC": P.gf ?? "",
    "Resultado RIVAL": P.gc ?? "",
  };

  /* -------- banda -------- */

  const filasOf = [];
  const filasDef = [];

  const detalle = [["id", "equipo", "tiempo", "minuto", "video", "sacador", "tercio", "carril", "receptor", "receptor_puesto", "recibe_tercio", "recibe_carril", "recibe_accion", "perdido", "largo_hudl", "eventos_posesion", "resultado_hudl", "Resultado_Final"]];

  let nOf = 0;
  let nDef = 0;

  for (const a of saques) {
    const nuestro = esNuestro(a.jug);

    const id = nuestro ? `banda-of-${String(++nOf).padStart(2, "0")}` : `banda-def-${String(++nDef).padStart(2, "0")}`;

    const posEq = posesionesSaque
      .slice()
      .sort((x, y) => Math.abs(x.startTimeMs - a.t) - Math.abs(y.startTimeMs - a.t))[0];

    const largo = posEq && Math.abs(posEq.startTimeMs - a.t) < 15000 ? uno(posEq, "05 - Length") : "";

    const rf = resultadoBanda(a, nuestro);

    const rec = a.recibe?.jug ?? "";

    let Perfil = ladoBanda(uno(a.m, "03 - Location - Flank"));
    let Zona_Saque = zonaBanda(uno(a.m, "04 - Location - Third"));

    /* Zona y Perfil se cuentan SIEMPRE desde el Castilla; Hudl los da desde el que saca. */
    if (!nuestro) {
      Zona_Saque = { "Zona 1": "Zona 3", "Zona 3": "Zona 1" }[Zona_Saque] || Zona_Saque;
      Perfil = { Derecho: "Izquierdo", Izquierdo: "Derecho" }[Perfil] || Perfil;
    }

    const fila = {
      id,
      ...COMUN,
      Tiempo: `T${tiempo(a.t)}`,
      Minuto: String(minuto(a.t)),
      Perfil,
      Zona_Saque,
      Tipo_Envio: envio(largo),
      Zona_Caida: caida(a),
      Receptor: rec ? linea(rec) : "",
      Resultado_Final: rf.r,
      hudl_ms: a.t,
    };

    if (nuestro) filasOf.push({ ...fila, Sacador: nombreBanda(a.jug) });
    else filasDef.push(fila);

    detalle.push([id, equipoDe[a.jug], fila.Tiempo, fila.Minuto, reloj(a.t), sinDorsal(a.jug),
      uno(a.m, "04 - Location - Third"), uno(a.m, "03 - Location - Flank"),
      rec ? sinDorsal(rec) : "", rec ? puesto(rec) : "",
      a.recibe ? uno(a.recibe.m, "04 - Location - Third") : "", a.recibe ? uno(a.recibe.m, "03 - Location - Flank") : "",
      a.recibe ? a.recibe.tipos.slice(0, 2).join("+") : "", a.perdido ? "sí" : "",
      largo, rf.eventos, rf.resultado, rf.r]);

    const pos = posEq && Math.abs(posEq.startTimeMs - a.t) < 15000 ? posEq : null;

    ficha(id, Math.round(a.t / 1000) - 2, 16, [
      `JUGADA ${id} · SAQUE DE BANDA del ${quien(a.jug)}`,
      `Saca: ${a.jug} (${uno(a.m, "08 - Player - Position")})`,
      `Hudl lo sitúa en: ${uno(a.m, "04 - Location - Third")} · ${uno(a.m, "03 - Location - Flank")} (visto desde el equipo que SACA atacando)`,
      `Vídeo Hudl ${reloj(a.t)} (${Math.round(a.t / 1000)} s). Las imágenes empiezan 2 s antes del saque: s_01 = -2 y -1, s_02 = 0 y +1 (el saque), s_03 = +2 y +3 …`,
      pos ? `Posesión que abre (Hudl): ${uno(pos, "06 - Number of team events")} acciones, dura ${uno(pos, "10 - Duration")} s, largo «${uno(pos, "05 - Length")}», acaba en «${uno(pos, "07 - Outcome") || "sin remate"}»` : null,
      `Propuesta del dato (revísala con la imagen): ${JSON.stringify({ Tiempo: fila.Tiempo, Minuto: fila.Minuto, Perfil, Zona_Saque, Tipo_Envio: fila.Tipo_Envio, Zona_Caida: fila.Zona_Caida, Receptor: fila.Receptor, Resultado_Final: rf.r })}`,
      "",
      "Acciones registradas por Hudl (segundos respecto al saque):",
      contexto(a.t, -3000, 20000),
    ]);
  }

  const base = path.join(CARPETA, "base");

  escribeTsv(path.join(base, "bandaOf.tsv"), [...CAB_BANDA_OF, "hudl_ms"], filasOf);
  escribeTsv(path.join(base, "bandaDef.tsv"), [...CAB_BANDA_DEF, "hudl_ms"], filasDef);

  fs.writeFileSync(
    path.join(base, "banda-detalle.csv"),
    "﻿" + detalle.map((f) => f.map((x) => (/[",;]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(",")).join("\r\n") + "\r\n",
    "utf8",
  );

  /* -------- faltas (todas) -------- */

  const faltas = acciones.filter((a) => a.tipos.includes("Foul") || a.tipos.includes("Penalty foul"));

  const of = [];
  const def = [];

  for (const a of faltas) {
    const aFavor = !esNuestro(a.jug);

    const sufrida = acciones.find(
      (b) => Math.abs(b.t - a.t) <= 2000 && b.tipos.includes("Foul suffered") && esNuestro(b.jug) === aFavor,
    );

    const zona = sufrida ? TERCIO[uno(sufrida.m, "04 - Location - Third")] : GIRA_TERCIO[uno(a.m, "04 - Location - Third")];
    const carril = sufrida ? CARRIL[uno(sufrida.m, "03 - Location - Flank")] : GIRA_CARRIL[uno(a.m, "03 - Location - Flank")];

    const victima = uno(a.m, "30 - Infraction - Opponent");
    const tarjeta = uno(a.m, "29 - Infraction - Card");
    const mano = uno(a.m, "28 - Infraction - Type") === "Hand foul";
    const penalti = a.tipos.includes("Penalty foul");

    const lista = aFavor ? of : def;

    const id = `${aFavor ? "of" : "def"}-c${String(lista.length + 1).padStart(2, "0")}`;

    const nota = [
      `T${tiempo(a.t)} min ${minuto(a.t)}.`,
      `${penalti ? "Penalti" : mano ? "Mano" : "Falta"} de ${sinDorsal(a.jug)} (${esNuestro(a.jug) ? "del Castilla" : `del ${RIVAL_CORTO}`})${victima ? ` sobre ${sinDorsal(victima)}` : ""}.`,
      tarjeta === "Yellow" ? "Amarilla." : tarjeta === "Red" ? "Roja." : "",
      `Vídeo Hudl ${reloj(a.t)}.`,
    ]
      .filter(Boolean)
      .join(" ");

    lista.push({ id, t: a.t, zona: zona || "", carril: carril || "", distancia: distancia(zona, carril), entre: "?", nota, penalti });

    ficha(`falta-${id}`, Math.round(a.t / 1000) - 4, 18, [
      `JUGADA falta-${id} · ${penalti ? "PENALTI" : "FALTA"} ${aFavor ? `A FAVOR del Castilla (la comete el ${RIVAL_CORTO})` : "EN CONTRA (la comete el Castilla)"}`,
      `La comete: ${a.jug} · sobre: ${victima || "?"} · ${uno(a.m, "28 - Infraction - Type")}${tarjeta ? ` · tarjeta ${tarjeta}` : ""}`,
      `Hudl la sitúa (visto desde el que la COMETE): ${uno(a.m, "04 - Location - Third")} · ${uno(a.m, "03 - Location - Flank")}`,
      `Propuesta del dato, desde el que SACA (revísala): zona ${zona || "?"} · carril ${carril || "?"} · distancia ${distancia(zona, carril)}`,
      `Vídeo Hudl ${reloj(a.t)} (${Math.round(a.t / 1000)} s). Las imágenes empiezan 4 s antes de la marca: s_01 = -4 y -3, s_02 = -2 y -1, s_03 = 0 y +1 … OJO: en la TV la falta se ve 4-12 s DESPUÉS de la marca de Hudl: búscala, es el primer instante en que se para el juego.`,
      "",
      "Acciones registradas por Hudl (segundos respecto a la falta):",
      contexto(a.t, -8000, 20000),
    ]);
  }

  const dirFaltas = path.join(CARPETA, "faltas");

  fs.mkdirSync(dirFaltas, { recursive: true });

  const escribeFaltas = (pref, lista) =>
    fs.writeFileSync(
      path.join(dirFaltas, `${pref}-hudl.csv`),
      "# clip;zona;carril;distancia;entre;nota — base del timeline de Hudl; revisar zona/carril/distancia/entre con la cámara táctica\n" +
        lista.map((f) => [f.id, f.zona, f.carril, f.distancia, f.entre, f.nota.replace(/;/g, ",")].join(";")).join("\n") +
        "\n",
      "utf8",
    );

  escribeFaltas("of", of);
  escribeFaltas("def", def);

  /* -------- córners, faltas a balón parado y penaltis -------- */

  const piezas = [];

  const corners = acciones.filter((a) => a.tipos.includes("Corner"));

  let nCo = 0;
  let nCd = 0;

  for (const a of corners) {
    const nuestro = esNuestro(a.jug);

    const id = nuestro ? `corner-of-${String(++nCo).padStart(2, "0")}` : `corner-def-${String(++nCd).padStart(2, "0")}`;

    piezas.push({ id, tipo: "Córner", nuestro, sacador: nuestro ? nombrePiezas(a.jug) : sinDorsal(a.jug), hudl_ms: a.t, Tiempo: tiempo(a.t), Minuto: minuto(a.t), carril: uno(a.m, "03 - Location - Flank") });

    ficha(id, Math.round(a.t / 1000) - 2, 18, [
      `JUGADA ${id} · CÓRNER del ${quien(a.jug)}`,
      `Saca: ${a.jug} · banda (Hudl, visto desde el que saca): ${uno(a.m, "03 - Location - Flank")}`,
      `Vídeo Hudl ${reloj(a.t)} (${Math.round(a.t / 1000)} s). s_01 = -2 y -1, s_02 = 0 y +1 (el golpeo) …`,
      "",
      "Acciones registradas por Hudl (segundos respecto al golpeo):",
      contexto(a.t, -2000, 20000),
    ]);
  }

  /* Faltas que se sacan como balón parado de ataque: candidatas, no todas van
     a la hoja (sólo las de Z1-Z6 en las que se busca área o tiro). */
  const libres = acciones.filter((a) => a.tipos.includes("Free kick") || a.tipos.includes("Penalty"));

  let nFo = 0;
  let nFd = 0;

  for (const a of libres) {
    const nuestro = esNuestro(a.jug);

    const penalti = a.tipos.includes("Penalty");

    const tercio = uno(a.m, "04 - Location - Third");

    /* Desde el medio campo hacia atrás no es una pieza de ataque. */
    if (!penalti && tercio === "Own third") continue;

    const id = nuestro ? `abp-of-${String(++nFo).padStart(2, "0")}` : `abp-def-${String(++nFd).padStart(2, "0")}`;

    const conCodigo = piezasEquipo.some(
      (p) => /Free kicks/.test(p.tags.find((t) => t.key === "HUDL_CODE")?.values[0] ?? "") && Math.abs(p.startTimeMs - a.t) < 5000,
    );

    piezas.push({ id, tipo: penalti ? "Penalti" : "Falta", nuestro, sacador: nuestro ? nombrePiezas(a.jug) : sinDorsal(a.jug), hudl_ms: a.t, Tiempo: tiempo(a.t), Minuto: minuto(a.t), tercio, carril: uno(a.m, "03 - Location - Flank"), tipos: a.tipos, codigoFreeKicks: conCodigo });

    ficha(id, Math.round(a.t / 1000) - 3, 20, [
      `JUGADA ${id} · ${penalti ? "PENALTI" : "FALTA (candidata a balón parado de ataque)"} del ${quien(a.jug)}`,
      `Saca: ${a.jug} · Hudl la sitúa (desde el que saca): ${tercio} · ${uno(a.m, "03 - Location - Flank")} · tipos: ${a.tipos.join(", ")}`,
      conCodigo ? "Hudl la cuenta también como «Free kicks» de equipo (ataque a balón parado)." : "Hudl NO la cuenta como «Free kicks» de equipo: mira si se busca área o tiro desde Z1-Z6; si se juega en corto para seguir, NO va a la hoja.",
      `Vídeo Hudl ${reloj(a.t)} (${Math.round(a.t / 1000)} s). s_01 = -3 y -2 …`,
      "",
      "Acciones registradas por Hudl (segundos respecto al golpeo):",
      contexto(a.t, -3000, 20000),
    ]);
  }

  fs.writeFileSync(path.join(base, "piezas.json"), JSON.stringify(piezas, null, 1), "utf8");

  /* -------- la vara de medir -------- */

  const cuenta = (cosa) => ({
    nuestro: codigosEquipo[cosa]?.nuestro.length ?? 0,
    rival: codigosEquipo[cosa]?.rival.length ?? 0,
  });

  const penaltis = acciones.filter((a) => a.tipos.includes("Penalty"));

  const conteo = {
    rivalHudl: T.rivalHudl,
    equipos: T.equipos,
    corners: cuenta("Corners"),
    banda: cuenta("Throw ins"),
    freeKicksEquipo: cuenta("Free kicks"),
    goles: cuenta("Goals"),
    penaltis: {
      nuestro: penaltis.filter((a) => esNuestro(a.jug)).length,
      rival: penaltis.filter((a) => !esNuestro(a.jug)).length,
    },
    faltas: { aFavor: of.length, enContra: def.length },
    accionesBanda: { nuestro: filasOf.length, rival: filasDef.length },
    accionesCorner: { nuestro: nCo, rival: nCd },
    candidatasAbp: { nuestro: nFo, rival: nFd },
    inicioT2ms: Number.isFinite(T.inicioT2) ? T.inicioT2 : null,
  };

  fs.writeFileSync(path.join(CARPETA, "conteo.json"), JSON.stringify(conteo, null, 2), "utf8");
  fs.writeFileSync(path.join(CARPETA, "trabajos.json"), JSON.stringify(trabajos, null, 1), "utf8");

  console.log(`Rival en Hudl: ${T.rivalHudl}`);
  console.log(`Saques de banda: ${filasOf.length} nuestros + ${filasDef.length} suyos (códigos de equipo: ${conteo.banda.nuestro} + ${conteo.banda.rival})`);
  console.log(`Córners: ${nCo} + ${nCd} (códigos: ${conteo.corners.nuestro} + ${conteo.corners.rival})`);
  console.log(`Faltas: ${of.length} a favor, ${def.length} en contra · candidatas a ABP: ${nFo} + ${nFd} · penaltis ${conteo.penaltis.nuestro} + ${conteo.penaltis.rival}`);
  console.log(`RESUMEN: base preparada — ${filasOf.length + filasDef.length} saques, ${nCo + nCd} córners, ${of.length + def.length} faltas, ${trabajos.length} jugadas con ficha`);
})().catch((error) => {
  console.log(`RESUMEN: no se ha podido preparar la base (${error.message})`);
  process.exitCode = 1;
});
