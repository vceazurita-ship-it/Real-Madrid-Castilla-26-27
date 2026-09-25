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
      "Partido fuera: el Castilla juega de blanco y el Sant Andreu de amarillo. Nuestro portero, de azul; el suyo, de verde.",
      "Los clips no traen marcador ni reloj, así que las faltas no llevan minuto: van en el orden en que las cortó el coding.",
    ],
  },
];

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

  return { ...partido, faltas };
}

const datos = PARTIDOS.map(leePartido);

const cabecera = `/**
 * Faltas etiquetadas a mano sobre los clips del coding.
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
