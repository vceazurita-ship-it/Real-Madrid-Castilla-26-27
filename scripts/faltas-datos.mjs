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

  const periodos = (eq?.moments.items ?? []).filter((m) => cod(m) === "Periods").map((m) => m.startTimeMs / 1000).sort((a, b) => a - b);
  /* La 1ª parte no arranca en el 0 de Hudl (un segundo después): se descuenta. */
  const inicioT1 = periodos[0] ?? 0;
  const inicioT2 = periodos[1] ?? Infinity;

  /* De qué equipo es cada jugador, de las jugadas por equipo en que sale (como robos.cjs). */
  const players = (m) => (m.tags.find((t) => t.key === "09 - Players") || { values: [] }).values;
  const equipo = {};
  for (const m of eq?.moments.items ?? []) {
    const c = cod(m);
    if (!/ - /.test(c)) continue;
    const nuestro = c.startsWith("Real Madrid Castilla");
    for (const p of players(m)) equipo[p] ??= nuestro ? "defensivo" : "ofensivo";
  }

  /*
  | Las faltas de Hudl, por el centro de su clip y con su lado: la hace uno
  | del Castilla → «defensivo» (en contra); uno del rival → «ofensivo». Así
  | dos faltas seguidas de equipos distintos no se cambian el minuto.
  */
  const faltas = sesiones
    .flatMap((x) => x.moments.items)
    .filter((m) => tipos(m).some((t) => t === "Foul" || t === "Penalty foul" || t === "Infraction") && !tipos(m).includes("Offside"))
    .map((m) => ({ t: (m.startTimeMs + (m.endTimeMs ?? m.startTimeMs)) / 2000, lado: equipo[cod(m)] ?? null }))
    .sort((a, b) => a.t - b.t);

  const tramosFichero = join(TRANSICIONES, id, "tramos.json");

  const tramos = existsSync(tramosFichero) ? JSON.parse(readFileSync(tramosFichero, "utf8")) : TRAMOS_A_MANO[id] ?? [];

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
    if (!tramos.length) return "";

    const tr = tramos.find((x) => t < x.hasta);

    const s = Math.max(0, Math.round(t + (tr ? tr.d : 0)));

    return ` (táctica ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})`;
  };

  return { faltas, reloj, tactica, inicioT1, inicioT2 };
}

/** Sin tildes y en minúsculas, para buscar un nombre dentro de una nota. */
const llano = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** ¿Sale en la nota alguna palabra del nombre («Oscar Naasei» vale con «Óscar (21)»)? */
function nombraA(nota, nombre) {
  const texto = llano(nota);

  return llano(nombre)
    .split(/[\s.]+/)
    .filter((palabra) => palabra.length >= 3)
    .some((palabra) => new RegExp(`(^|[^a-z])${palabra}($|[^a-z])`).test(texto));
}

/**
 * La base del timeline del partido: por cada `clip`, sus segundos de vídeo,
 * quién hace la falta y su posición en la lista de su lado.
 *
 * El `clip` de la base y el del CSV revisado coinciden HOY, pero la base se
 * regenera (el análisis del partido) y sus números se corren si entra una
 * falta nueva —la infracción de Pitarch del J06 entraría la primera—. Por eso
 * no se fía sólo del número: ver `asignaBase`.
 */
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

      let orden = 0;

      for (const linea of readFileSync(f, "utf8").split(/\r?\n/)) {
        const m = /^((?:of|def)-c\d+);.*Vídeo Hudl (\d+):(\d{2})/i.exec(linea.trim());

        if (!m) continue;

        const autor = /(?:Falta|Mano|Penalti) de (.+?) \(del /.exec(linea)?.[1] ?? "";
        const victima = /\) sobre (.+?)\. /.exec(linea)?.[1] ?? "";

        vistos.set(m[1].toLowerCase(), {
          clip: m[1].toLowerCase(),
          lado: lado === "of" ? "ofensivo" : "defensivo",
          orden: orden++,
          segundos: Number(m[2]) * 60 + Number(m[3]),
          autor,
          victima,
        });
      }
    }
  }

  return vistos;
}

/**
 * Qué falta de la base es cada falta revisada, y sus segundos de vídeo.
 *
 * 1. La del mismo `clip`, si la nota revisada nombra a quien la hace (y a
 *    quien la recibe, cuando la base lo dice).
 * 2. Si no, la de su lado más cercana en el orden, entre las que no se ha
 *    quedado ya otra, cuya nota nombre al autor (mejor si también a la
 *    víctima).
 * 3. Si ninguna, ninguna: la falta tira de su nota.
 *
 * La 2 es la que salva una base regenerada con los números corridos; el
 * «entre las que no se ha quedado otra» evita que una falta sin pareja en la
 * base (la de Pitarch del J06, hoy) se lleve la de otra jugada del mismo
 * jugador.
 */
function asignaBase(base, faltas) {
  const asignada = new Map();
  const cogidas = new Set();

  const nombra = (falta, b) => Boolean(b.autor) && nombraA(falta.nota, b.autor);
  const victimaBien = (falta, b) => !b.victima || nombraA(falta.nota, b.victima);

  for (const falta of faltas) {
    const misma = base.get(falta.clip);

    if (!misma || misma.lado !== falta.lado) continue;

    if (!misma.autor || (nombra(falta, misma) && victimaBien(falta, misma))) {
      asignada.set(falta, misma.segundos);
      cogidas.add(misma.clip);
    }
  }

  for (const falta of faltas) {
    if (asignada.has(falta)) continue;

    const orden = faltas.filter((x) => x.lado === falta.lado).indexOf(falta);

    const candidata = [...base.values()]
      .filter((b) => b.lado === falta.lado && !cogidas.has(b.clip) && nombra(falta, b))
      .sort(
        (a, b) =>
          Number(victimaBien(falta, b)) - Number(victimaBien(falta, a)) ||
          Math.abs(a.orden - orden) - Math.abs(b.orden - orden),
      )[0];

    if (candidata) {
      asignada.set(falta, candidata.segundos);
      cogidas.add(candidata.clip);
    }
  }

  return asignada;
}

/**
 * El segundo de vídeo que dice la nota: el último «Vídeo (Hudl) mm:ss» o
 * «mm:ss TV».
 *
 * «Vídeo» ya es el segundo del vídeo de Hudl. «TV» es el reloj de la
 * retransmisión: en la 1ª parte va con el vídeo (desde el arranque de la
 * parte) y sigue contando en el descuento («49:21 TV»); en la 2ª arranca en
 * el 45:00 cuando el vídeo ya va por el descanso, así que se lleva al
 * arranque de la 2ª parte. Un «TV» de 45:00 en adelante es de la 2ª salvo que
 * la nota diga que es de la 1ª o no quepa en ella.
 */
function segundoDeNota(nota, reloj) {
  const todos = [...nota.matchAll(/(Vídeo(?: Hudl)?|TV)\s+(\d{1,3}):(\d{2})|(\d{1,3}):(\d{2})\s+TV/g)];

  const ultimo = todos[todos.length - 1];

  if (!ultimo) return null;

  const deTv = ultimo[1] ? ultimo[1] === "TV" : true;
  const [mm, ss] = ultimo[2] ? [ultimo[2], ultimo[3]] : [ultimo[4], ultimo[5]];
  const s = Number(mm) * 60 + Number(ss);

  if (!deTv || !reloj) return s;

  const tope = 45 * 60;
  const enLaPrimera = /\b(1a|1ª|primera)\s+parte\b|\bT1\b/i.test(nota);
  const enLaSegunda = /\b(2a|2ª|segunda)\s+parte\b|\bT2\b/i.test(nota);
  const cabeEnLaPrimera = reloj.inicioT1 + s < reloj.inicioT2;
  const segunda = s >= tope && !enLaPrimera && (enLaSegunda || !cabeEnLaPrimera || s > tope + 10 * 60);

  return segunda ? reloj.inicioT2 + (s - tope) : reloj.inicioT1 + s;
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

  /* El segundo de Hudl de cada falta, para el minuto y para el orden. */
  const segundo = new Map();
  const deLaBase = asignaBase(base, faltas);

  faltas.forEach((falta) => {
    falta.minuto = "";

    const aprox = deLaBase.get(falta) ?? segundoDeNota(falta.nota, reloj);

    if (aprox === null || aprox === undefined || !reloj) return;

    /*
    | La de Hudl más cercana DE SU LADO (el segundo de la base es el arranque
    | del clip). Una falta de Hudl sin equipo conocido vale para los dos.
    */
    const cerca = reloj.faltas
      .filter((h) => !h.lado || h.lado === falta.lado)
      .reduce((mejor, h) => (Math.abs(h.t - aprox) < Math.abs(mejor - aprox) ? h.t : mejor), Infinity);

    const t = Math.abs(cerca - aprox) <= 12 ? cerca : aprox;

    falta.minuto = `${reloj.reloj(t)}${reloj.tactica(t)}`;
    segundo.set(falta, t);

    conMinuto += 1;
  });

  /*
  | En el orden en que se dieron: por su segundo cuando se sabe (el descuento
  | de la 1ª va antes que la 2ª, porque es segundo de vídeo) y, si no, en el
  | sitio que le da el coding, detrás de la anterior que sí lo tiene.
  */
  let ultimo = -Infinity;
  const clave = new Map();

  faltas.forEach((falta, indice) => {
    if (segundo.has(falta)) ultimo = segundo.get(falta);
    clave.set(falta, [ultimo, indice]);
  });

  faltas.sort((a, b) => {
    const [ta, ia] = clave.get(a);
    const [tb, ib] = clave.get(b);

    return ta - tb || ia - ib;
  });

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
