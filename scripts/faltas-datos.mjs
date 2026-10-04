/**
 * Convierte los CSV del etiquetado de faltas en el módulo que lee la pantalla.
 *
 *   node scripts/faltas-datos.mjs
 *
 * El etiquetado lo hacen agentes mirando los clips imagen a imagen —los prepara
 * `scripts/abp-clips-preparar.mjs`— y sueltan un CSV por tanda en
 *   Downloads/RMCF CASTILLA/ANALISIS FALTAS/<partido>/
 * Este script los junta y escribe `lib/faltas/datos.ts`. Se vuelve a lanzar
 * cada vez que se etiqueta una jornada nueva.
 *
 * **La carpeta de cada partido se declara aquí abajo, en `PARTIDOS`**, con la
 * ruta de sus clips: así una jornada nueva es añadir cuatro líneas y volver a
 * lanzar, sin tocar el código.
 *
 * El CSV lleva seis campos y los escribe una persona o un agente, así que se
 * lee a la defensiva: el número de defensores puede venir como `?`, y el texto
 * de la nota puede traer comas pero nunca punto y coma.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const ORIGEN = "C:/Users/Usuario/Downloads/RMCF CASTILLA/ANALISIS FALTAS";
const DESTINO = join(RAIZ, "lib", "faltas", "datos.ts");

const ZONAS = ["campo propio", "medio campo", "campo rival"];
const CARRILES = ["izquierda", "centro", "derecha"];
const DISTANCIAS = ["frontal", "media", "lejana"];

/**
 * Los partidos etiquetados.
 *
 * `clips` es de dónde salieron, y se guarda a propósito: cuando dentro de tres
 * meses alguien quiera repasar una falta, lo primero que va a preguntar es
 * dónde está el vídeo.
 */
const PARTIDOS = [
  {
    id: "sant-andreu",
    jornada: "LIGA 04",
    rival: "UE Sant Andreu",
    local: false,
    fecha: "2026-09-21",
    resultado: "1-1",
    clips: "C:/Users/Usuario/Downloads/ABP vs SANT ANDREU",
    notas: [
      "El campo se cuenta siempre hacia la portería que ataca quien saca la falta: «campo propio» es el del que la saca, no el nuestro.",
      "Las faltas van en el orden en que se dieron. El vídeo del partido no lleva reloj en pantalla, así que no se anota el minuto.",
    ],
  },
  {
    id: "alcorcon",
    jornada: "LIGA 05",
    rival: "AD Alcorcón",
    local: true,
    fecha: "2026-09-27",
    resultado: "1-2",
    clips: "Hudl · Castilla · «2026-09-27 Real Madrid Castilla - Alcorcón 1 - 2» (timeline de Sportscode)",
    notas: [
      "Sale del timeline de Sportscode subido a Hudl —minuto, quién la hace, sobre quién y la tarjeta— y cada falta se ha mirado después en la retransmisión y en la cámara táctica del club, que enseña el campo entero: zona, carril, distancia, defensores y la nota salen de la imagen.",
      "Los defensores entre la falta y la portería están contados en las 28, con la cámara táctica. En las faltas laterales junto al área y en el penalti se cuentan en profundidad —los que están más cerca de su línea de fondo que el balón— y los que están a la misma altura no cuentan; por eso ahí sale 1, el portero. Esas no entran en «Faltas que cortaron algo»: son balón parado, no una transición cortada.",
      "La cámara táctica no tiene el mismo tiempo que la retransmisión (lleva cortes): cada falta se buscó en ella a mano.",
      "El campo se cuenta siempre hacia la portería que ataca quien saca la falta.",
    ],
  },
];

/*
| Los partidos nuevos no se escriben aquí: el análisis del partido
| (`scripts/analisis-partido.cjs`) deja un `partido.json` en su carpeta con
| estos mismos campos y se recoge solo. Lo que está arriba manda.
*/
for (const carpeta of existsSync(ORIGEN) ? readdirSync(ORIGEN) : []) {
  const fichero = join(ORIGEN, carpeta, "partido.json");

  if (!existsSync(fichero) || PARTIDOS.some((p) => p.id === carpeta)) continue;

  try {
    const datos = JSON.parse(readFileSync(fichero, "utf8"));

    /* El mismo partido ya escrito arriba a mano (J4, J5 en carpetas sin jornada): manda el de arriba. */
    if (PARTIDOS.some((p) => p.fecha && p.fecha === datos.fecha)) continue;

    PARTIDOS.push({ ...datos, id: carpeta });
  } catch (error) {
    console.warn(`${fichero}: no se puede leer (${error.message})`);
  }
}

PARTIDOS.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

/** "3" → 3. "?" o vacío → null, que no es lo mismo que cero. */
function numero(valor) {
  const n = Number.parseInt(String(valor ?? "").trim(), 10);

  return Number.isFinite(n) ? n : null;
}

function deLaLista(valor, permitidos) {
  const limpio = String(valor ?? "").trim().toLowerCase();

  return permitidos.includes(limpio) ? limpio : "";
}

function parteLinea(linea, lado) {
  const p = linea.split(";").map((x) => x.trim());

  if (p.length < 5) return null;

  const clip = p[0];

  if (!/^(of|def)-c?\d+$/i.test(clip)) return null;

  return {
    clip: clip.toLowerCase(),
    lado,
    zona: deLaLista(p[1], ZONAS),
    carril: deLaLista(p[2], CARRILES),
    distancia: deLaLista(p[3], DISTANCIAS),
    /* Cuántos defensores hay entre la falta y su portería, portero incluido. */
    entre: numero(p[4]),
    nota: p.slice(5).join(" — ").trim(),
  };
}

/* ------------------------------------------------------------------ */
/*  EL MINUTO EXACTO DE CADA FALTA (04/10/2026)                        */
/* ------------------------------------------------------------------ */

/*
| Hasta ahora el minuto iba suelto en la nota, cada falta a su manera
| («(13:39 TV)», «Vídeo 40:05», «T1, min 40»…) o no iba. Ahora cada falta
| lleva `minuto`: el de la retransmisión con sus segundos («12'03"», el
| descuento como «45+1'20"») y, entre paréntesis, el de la grabación
| táctica cuando hay desfases medidos («(táctica 12:58)»).
|
| Cómo: el segundo de vídeo de la falta sale de la base del timeline
| («Vídeo Hudl 11:25» en `<carpeta>/faltas/*-hudl.csv`) o, si no, de su nota;
| se busca la falta de Hudl más cercana (±12 s) y se toma el CENTRO de su
| clip, que es cuando pasa (el clip arranca unos segundos antes).
*/
const TRANSICIONES = "C:/Users/Usuario/Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES";
const ANALISIS = "C:/Users/Usuario/Downloads/RMCF CASTILLA/PARTIDOS/ANALISIS";

/* Alcorcón no tiene tramos.json: sus desfases se midieron a mano (los mismos que robos.cjs). */
const TRAMOS_A_MANO = {
  alcorcon: [
    { hasta: 1816, d: 5.5 },
    { hasta: 3010, d: -25 },
    { hasta: 4820, d: 73 },
    { hasta: 1e9, d: 36 },
  ],
};

function relojDe(id) {
  const fichero = join(TRANSICIONES, id, "timeline-hudl.json");

  if (!existsSync(fichero)) return null;

  const j = JSON.parse(readFileSync(fichero, "utf8"));

  const sesiones = j.data?.taggingSessions?.items ?? [];

  const cod = (m) => (m.tags.find((t) => t.key === "HUDL_CODE") || { values: [""] }).values[0];
  const tipos = (m) => (m.tags.find((t) => t.key === "02 - Type") || { values: [] }).values;

  const eq = sesiones.find((x) => x.moments.items.some((m) => / - Possessions$/.test(cod(m)))) || sesiones[0];

  const inicioT2 = (eq?.moments.items ?? []).filter((m) => cod(m) === "Periods").map((m) => m.startTimeMs / 1000).sort((a, b) => a - b)[1] ?? Infinity;

  /* Las faltas de Hudl, por el centro de su clip. */
  const faltas = sesiones
    .flatMap((x) => x.moments.items)
    .filter((m) => tipos(m).some((t) => t === "Foul" || t === "Penalty foul" || t === "Infraction") && !tipos(m).includes("Offside"))
    .map((m) => (m.startTimeMs + (m.endTimeMs ?? m.startTimeMs)) / 2000)
    .sort((a, b) => a - b);

  const tramosFichero = join(TRANSICIONES, id, "tramos.json");

  const tramos = existsSync(tramosFichero) ? JSON.parse(readFileSync(tramosFichero, "utf8")) : TRAMOS_A_MANO[id] ?? [];

  const reloj = (t) => {
    const primera = t < inicioT2;
    const dentro = Math.max(0, primera ? t : t - inicioT2);
    const tope = 45 * 60;
    const descuento = dentro >= tope;
    const seg = descuento ? dentro - tope : dentro + (primera ? 0 : tope);
    const mmss = `${Math.floor(seg / 60)}'${String(Math.floor(seg % 60)).padStart(2, "0")}"`;

    return descuento ? `${primera ? 45 : 90}+${mmss}` : mmss;
  };

  const tactica = (t) => {
    if (!tramos.length) return "";

    const tr = tramos.find((x) => t < x.hasta);

    const s = Math.max(0, Math.round(t + (tr ? tr.d : 0)));

    return ` (táctica ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})`;
  };

  return { faltas, reloj, tactica };
}

/** Los segundos de vídeo de cada falta según la base del timeline del partido (`clip` → segundos). */
function baseDe(id) {
  const vistos = new Map();

  if (!existsSync(ANALISIS)) return vistos;

  for (const carpeta of readdirSync(ANALISIS)) {
    const ficha = join(ANALISIS, carpeta, "partido.json");

    try {
      if (!existsSync(ficha) || JSON.parse(readFileSync(ficha, "utf8")).slug !== id) continue;
    } catch {
      continue;
    }

    for (const lado of ["of", "def"]) {
      const f = join(ANALISIS, carpeta, "faltas", `${lado}-hudl.csv`);

      if (!existsSync(f)) continue;

      for (const linea of readFileSync(f, "utf8").split(/\r?\n/)) {
        const m = /^((?:of|def)-c\d+);.*Vídeo Hudl (\d+):(\d{2})/i.exec(linea.trim());

        if (m) vistos.set(m[1].toLowerCase(), Number(m[2]) * 60 + Number(m[3]));
      }
    }
  }

  return vistos;
}

/** El segundo de vídeo que dice la nota: el último «Vídeo (Hudl) mm:ss» o «mm:ss TV». */
function segundoDeNota(nota) {
  const todos = [...nota.matchAll(/(?:Vídeo(?: Hudl)?|TV)\s+(\d{1,3}):(\d{2})|(\d{1,3}):(\d{2})\s+TV/g)];

  const ultimo = todos[todos.length - 1];

  if (!ultimo) return null;

  const [mm, ss] = ultimo[1] ? [ultimo[1], ultimo[2]] : [ultimo[3], ultimo[4]];

  return Number(mm) * 60 + Number(ss);
}

function leePartido(partido) {
  const dir = join(ORIGEN, partido.id);

  if (!existsSync(dir)) return { ...partido, faltas: [] };

  const faltas = [];

  for (const f of readdirSync(dir).filter((x) => x.endsWith(".csv")).sort()) {
    const lado = /^def/i.test(f) ? "defensivo" : "ofensivo";

    for (const linea of readFileSync(join(dir, f), "utf8").split(/\r?\n/)) {
      const t = linea.trim();

      if (!t || t.startsWith("#") || t.startsWith("clip;")) continue;

      const fila = parteLinea(t, lado);

      if (fila) faltas.push(fila);
    }
  }

  /* En el orden del coding, que es el del partido. */
  faltas.sort((a, b) => a.clip.localeCompare(b.clip, "es", { numeric: true }));

  const reloj = relojDe(partido.id);

  const base = baseDe(partido.id);

  let conMinuto = 0;

  for (const falta of faltas) {
    falta.minuto = "";

    const aprox = base.get(falta.clip) ?? segundoDeNota(falta.nota);

    if (aprox === null || aprox === undefined || !reloj) continue;

    /* La de Hudl más cercana (el segundo de la base es el arranque del clip). */
    const cerca = reloj.faltas.reduce((mejor, t) => (Math.abs(t - aprox) < Math.abs(mejor - aprox) ? t : mejor), Infinity);

    const t = Math.abs(cerca - aprox) <= 12 ? cerca : aprox;

    falta.minuto = `${reloj.reloj(t)}${reloj.tactica(t)}`;

    conMinuto += 1;
  }

  console.log(`  ${partido.id}: minuto exacto en ${conMinuto} de ${faltas.length}`);

  return { ...partido, faltas };
}

const datos = PARTIDOS.map(leePartido);

const cabecera = `/**
 * Faltas etiquetadas a mano mirando el vídeo del partido.
 *
 * ESTE FICHERO SE GENERA. No lo edites: lo escribe
 * scripts/faltas-datos.mjs a partir de los CSV de
 * Downloads/RMCF CASTILLA/ANALISIS FALTAS.
 *
 * Generado: ${new Date().toISOString().slice(0, 10)}
 */

export type LadoFalta = "ofensivo" | "defensivo";

export type Falta = {
  /** "of-c03": de qué clip salió, para poder volver al vídeo. */
  clip: string;
  /** Ofensivo = a favor del Castilla. Defensivo = del rival. */
  lado: LadoFalta;
  /** Tercio del campo, contado hacia la portería que ataca quien saca. */
  zona: string;
  carril: string;
  /** "frontal" · "media" · "lejana". */
  distancia: string;
  /**
   * Cuántos defensores hay entre la falta y su propia portería, portero
   * incluido. \`null\` cuando no se veía el campo entero para contarlos.
   */
  entre: number | null;
  /** «12'03" (táctica 12:58)»: minuto de la retransmisión y, si hay desfases, de la táctica. Vacío si no se sabe. */
  minuto: string;
  nota: string;
};

export type PartidoFaltas = {
  id: string;
  jornada: string;
  rival: string;
  local: boolean;
  fecha: string;
  resultado: string;
  /** De dónde salieron los clips, para poder volver al vídeo. */
  clips: string;
  notas: string[];
  faltas: Falta[];
};

export const PARTIDOS: PartidoFaltas[] = `;

mkdirSync(dirname(DESTINO), { recursive: true });

writeFileSync(DESTINO, `${cabecera}${JSON.stringify(datos, null, 2)};\n`, "utf8");

for (const uno of datos) {
  const of = uno.faltas.filter((f) => f.lado === "ofensivo").length;
  const def = uno.faltas.length - of;

  console.log(`${uno.id}: ${uno.faltas.length} faltas (${of} a favor, ${def} en contra)`);
}

console.log(`escrito ${DESTINO}`);
