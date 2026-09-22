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
    segundosVideo: 6158,
    bloquesTotales: 21,
    notas: [],
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
  if (!existsSync(dir)) return { ...partido, bloquesCerrados: 0, robos: [] };

  const ficheros = readdirSync(dir).filter((f) => f.endsWith(".csv")).sort();
  const robos = [];
  for (const f of ficheros) {
    for (const linea of readFileSync(join(dir, f), "utf8").split(/\r?\n/)) {
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

  return { ...partido, bloquesCerrados: ficheros.length, robos: limpio };
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
  segundosVideo: number;
  bloquesTotales: number;
  bloquesCerrados: number;
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
