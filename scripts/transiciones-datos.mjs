/**
 * Convierte los CSV del etiquetado de robos en el módulo que lee la pantalla.
 *
 * El etiquetado lo hacen agentes mirando el vídeo imagen a imagen y sueltan un
 * CSV por bloque de cinco minutos en
 *   Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES/<partido>/bloques/*.csv
 * Este script los junta y escribe lib/transiciones/datos.ts. Se vuelve a
 * lanzar cada vez que cierra un bloque nuevo:
 *
 *   node scripts/transiciones-datos.mjs
 *
 * Dos avisos sobre el CSV, que viene escrito a mano por los agentes:
 *  - el texto del detalle a veces lleva un `;` dentro, así que NO se puede
 *    partir por posición: el último campo es siempre la confianza y la acción
 *    se busca por su nombre;
 *  - conviven dos formatos, el viejo de cinco campos y el ampliado de nueve.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const ORIGEN = "C:/Users/Usuario/Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES";
const DESTINO = join(RAIZ, "lib", "transiciones", "datos.ts");

/** Cada bloque del etiquetado son cinco minutos de vídeo. */
const SEGUNDOS_BLOQUE = 300;

const ACCIONES = ["ADELANTE", "HORIZONTAL_ATRAS", "DESPEJE", "PERDIDA"];
const CONFIANZAS = ["alta", "media", "baja"];

/** Cada partido, con lo que hay que saber para leer sus minutos. */
const PARTIDOS = [
  {
    id: "torremolinos",
    jornada: "J2",
    rival: "Juventud Torremolinos",
    local: true,
    fecha: "2026-09-05",
    resultado: "",
    /*
    | Sin ruta: estos dos vídeos ya no están en este ordenador y no consta
    | dónde acabaron. Se deja en blanco a propósito —una ruta que no existe es
    | peor que ninguna— y el panel de actualizar empieza vacío para ellos.
    */
    video: "",
    segundosVideo: 6060,
    /*
    | Veinte y no veintiuno: el último bloque se etiquetó de corrido desde el
    | 95' hasta el final del vídeo, seis minutos en vez de cinco, así que con
    | veinte ficheros el partido está cubierto entero.
    */
    bloquesTotales: 20,
    notas: [
      "El vídeo arranca en el saque inicial y su reloj va casi a la par del reloj del partido.",
      "El juego se detiene en el 28'31\" por una lesión y ya no se reanuda: enlaza con la pausa de hidratación, campo vacío y aspersores, hasta el 31'30\".",
      "El Castilla ataca hacia arriba de la imagen en las dos partes.",
      "La 1ª parte acaba en el minuto 50:31 del vídeo (45+6, con el marcador 1-0) y el descanso está cortado: el vídeo salta en el 50:38 y la 2ª parte arranca en el 50:41. A partir de ahí el minuto del vídeo va unos 5:40 por delante del reloj del partido.",
    ],
    goles: [
      { seg: 1555, de: "castilla", texto: "Gol del Castilla, concedido tras una revisión de la jugada" },
      { seg: 5343, de: "castilla", texto: "Gol del Castilla, nacido del robo del 88'53\"" },
    ],
  },
  {
    id: "aguilas",
    jornada: "J3",
    rival: "Águilas FC",
    local: false,
    fecha: "2026-09-12",
    resultado: "",
    video: "",
    segundosVideo: 6158,
    bloquesTotales: 21,
    notas: [
      "Revisado entero, pero con menos lupa que el J2. Los 40 robos son un suelo, no un total: el que empieza y acaba en un par de segundos no se ve.",
      "Y el sesgo no es sólo de cantidad: con menos lupa se ven sobre todo los robos que llevan a algo, y por eso aquí sale 90% hacia delante y en el J2 un 60%. NO compares ese porcentaje entre los dos partidos; para eso hace falta volver a mirar el J3 con el detalle del J2.",
      "Aquí la dirección SÍ cambia: el Castilla ataca hacia arriba de la imagen hasta el segundo 3016 y hacia abajo desde el 3017.",
      "El descanso no está grabado: hay un corte de montaje entre el 3016 y el 3017. No hay marcador en pantalla, así que los minutos son de vídeo.",
      "Pausa de hidratación del 83'09\" al 84'53\". El vídeo acaba en el 102'37\" con el partido todavía en juego.",
      "En el 74'10\" nuestro portero le para un penalti al Águilas.",
    ],
    goles: [
      { seg: 687, de: "rival", texto: "Gol del Águilas, en una falta al borde del área" },
    ],
  },
  {
    id: "sant-andreu",
    jornada: "J4",
    rival: "UE Sant Andreu",
    local: false,
    fecha: "2026-09-21",
    resultado: "1-1",
    video: "C:/Users/Usuario/Downloads/SANT ANDREU - RM CASTILLA.mov",
    segundosVideo: 5914,
    bloquesTotales: 20,
    notas: [
      "Revisado con la misma lupa que el J3, no con la del J2: los robos que salen son un suelo, no un total, y el que empieza y acaba en un par de segundos no se ve.",
      "Por lo mismo, el reparto entre ADELANTE y HORIZONTAL_ATRAS de este partido NO se puede comparar con el del J2, que se miró imagen a imagen. Con el J3 sí: están mirados igual.",
    ],
    goles: [],
  },
];

function parteLinea(linea) {
  const p = linea.split(";").map((x) => x.trim());
  if (p.length < 4) return null;

  const seg = Number.parseInt(p[0], 10);
  if (!Number.isFinite(seg)) return null;

  const ultimo = (p[p.length - 1] || "").toLowerCase();
  const confianza = CONFIANZAS.includes(ultimo) ? ultimo : "media";

  // La acción manda: si está en la cuarta columna es el formato ampliado.
  const iAccion = p.findIndex((x) => ACCIONES.includes(x.toUpperCase()));
  if (iAccion < 0) return null;
  const ampliado = iAccion === 3;

  const zona = (p[1] || "").toLowerCase();
  const accion = p[iAccion].toUpperCase();

  if (!ampliado) {
    return {
      seg,
      zona,
      carril: "",
      accion,
      desenlace: "",
      duracion: null,
      pases: "",
      detalle: p.slice(iAccion + 1, p.length - 1).join(" — "),
      confianza,
    };
  }

  const duracion = Number.parseInt(p[5], 10);
  return {
    seg,
    zona,
    carril: (p[2] || "").toLowerCase(),
    accion,
    desenlace: (p[4] || "").toUpperCase(),
    duracion: Number.isFinite(duracion) ? duracion : null,
    pases: p[6] || "",
    detalle: p.slice(7, p.length - 1).join(" — "),
    confianza,
  };
}

function leePartido(partido) {
  const dir = join(ORIGEN, partido.id, "bloques");
  if (!existsSync(dir)) {
    return { ...partido, bloquesCerrados: 0, segundosRevisados: 0, robos: [] };
  }

  const ficheros = readdirSync(dir).filter((f) => f.endsWith(".csv")).sort();
  const robos = [];
  let cerrados = 0;
  let segundosRevisados = 0;

  for (const f of ficheros) {
    const inicio = Number.parseInt(f.replace(/\D/g, ""), 10) || 0;
    const esUltimo = inicio === (partido.bloquesTotales - 1) * SEGUNDOS_BLOQUE;
    const fin = esUltimo ? partido.segundosVideo - 1 : inicio + SEGUNDOS_BLOQUE - 1;

    const texto = readFileSync(join(dir, f), "utf8");

    /*
    | Un bloque a medias deja dicho hasta dónde llegó: `# revisado hasta el
    | segundo 371`. Sin esa línea se entiende que está entero, que es el caso
    | de los bloques del J2, etiquetados antes de que existiera la costumbre.
    */
    const hasta = texto.match(/revisado hasta el segundo\s+(\d+)/i);
    const llega = hasta ? Math.min(Number.parseInt(hasta[1], 10), fin) : fin;
    if (llega >= fin) cerrados += 1;
    segundosRevisados += Math.max(0, llega - inicio + 1);

    for (const linea of texto.split(/\r?\n/)) {
      const t = linea.trim();
      if (!t || t.startsWith("segundo;") || t.startsWith("#")) continue;
      const fila = parteLinea(t);
      if (fila) robos.push({ ...fila, bloque: f.replace(".csv", "") });
    }
  }

  robos.sort((a, b) => a.seg - b.seg);

  // Los bloques se solapan cuatro segundos para poder ver el final de una
  // jugada: si el mismo robo aparece dos veces, se queda el primero.
  const limpio = [];
  for (const r of robos) {
    if (limpio.length && r.seg - limpio[limpio.length - 1].seg < 3) continue;
    limpio.push(r);
  }

  return { ...partido, bloquesCerrados: cerrados, segundosRevisados, robos: limpio };
}

const datos = PARTIDOS.map(leePartido);

const cabecera = `/**
 * Robos y transiciones etiquetados a mano sobre el vídeo.
 *
 * ESTE FICHERO SE GENERA. No lo edites: lo escribe
 * scripts/transiciones-datos.mjs a partir de los CSV de
 * Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES.
 *
 * Generado: ${new Date().toISOString().slice(0, 10)}
 */

export type Accion = "ADELANTE" | "HORIZONTAL_ATRAS" | "DESPEJE" | "PERDIDA";
export type Confianza = "alta" | "media" | "baja";

export type Robo = {
  /** Segundo del vídeo en que el balón pasa a ser nuestro. */
  seg: number;
  zona: string;
  carril: string;
  accion: Accion;
  /** Cómo acaba la posesión que nace del robo. Vacío en los bloques viejos. */
  desenlace: string;
  duracion: number | null;
  pases: string;
  detalle: string;
  confianza: Confianza;
  bloque: string;
};

export type Gol = { seg: number; de: "castilla" | "rival"; texto: string };

export type PartidoTransiciones = {
  id: string;
  jornada: string;
  rival: string;
  local: boolean;
  fecha: string;
  resultado: string;
  /** Dónde está el vídeo, para poder volver a él y para el panel de actualizar. */
  video: string;
  segundosVideo: number;
  bloquesTotales: number;
  bloquesCerrados: number;
  /** Segundos de vídeo mirados de verdad, contando los bloques a medias. */
  segundosRevisados: number;
  notas: string[];
  goles: Gol[];
  robos: Robo[];
};

export const PARTIDOS: PartidoTransiciones[] = `;

mkdirSync(dirname(DESTINO), { recursive: true });
writeFileSync(DESTINO, cabecera + JSON.stringify(datos, null, 2) + ";\n", "utf8");

for (const p of datos) {
  console.log(
    `${p.id}: ${p.bloquesCerrados}/${p.bloquesTotales} bloques, ${p.robos.length} robos`,
  );
}
console.log("escrito", DESTINO);
