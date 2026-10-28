/**
 * El campograma de caídas del coding, metido solo en la pizarra de la
 * jornada (28/10/2026): una diapositiva «DÓNDE CAEN» por carpeta con caídas
 * marcadas, en el tablero `riv-RIV-NN` de esa jornada. Se rehace cada vez que
 * cambian las etiquetas; las diapositivas del analista no se tocan.
 */

import { aLienzo } from "@/lib/abp-lab/puente-pizarra";
import { CARPETAS, caidasDe, resumenDe, rutinasDe, type CarpetaKey, type ClipEstado } from "@/lib/abp/coding-rival";
import { slideDePlantilla, type CaidaPizarra, type PizarraStore, type SlidePizarra } from "@/lib/abp/pizarra";

/** Metros del laboratorio (x de banda a banda, y desde la línea de fondo) si se saca desde la izquierda. */
const ZONA: Record<string, [number, number]> = {
  "1.er palo": [30.5, 2.5],
  Centro: [34, 6.5],
  "2.º palo": [38.5, 3],
  "Frontal / rechace": [34, 17],
  Frontal: [34, 17],
};

const COLOR: Record<string, string> = { Izquierda: "#5AA9FF", Derecha: "#D8B45A", Central: "#9AE6B4", "Sin lado": "#E5E7EB" };

const x0 = (l: string) => l === "Izquierda" || l === "Derecha" || l === "Central";

export const tableroDeJornada = (jornada: number) => `riv-RIV-${String(jornada).padStart(2, "0")}`;

function caidas(clips: [number, ClipEstado][], defensivo: boolean): CaidaPizarra[] {
  const { cuenta } = caidasDe(clips);

  const lados = Object.keys(cuenta);

  const bolas: CaidaPizarra[] = lados.flatMap((lado, k) =>
    Object.entries(cuenta[lado]).flatMap(([zona, n]) => {
      const base = ZONA[zona];

      if (!base) return [];

      const x = (lado === "Derecha" ? 68 - base[0] : base[0]) + (lados.length > 1 ? (k - (lados.length - 1) / 2) * 6 : 0);

      return [{ ...aLienzo("porteria", { x, y: base[1] + (lados.length > 1 ? k * 2.5 : 0) }), n, color: COLOR[lado] ?? "#FFFFFF" }];
    }),
  );

  if (defensivo) {
    const libres = new Map<string, number>();

    for (const [, c] of clips) if (c.etiquetas?.libre) libres.set(c.etiquetas.libre, (libres.get(c.etiquetas.libre) ?? 0) + 1);

    for (const [zona, n] of libres) {
      const base = ZONA[zona];

      if (base) bolas.unshift({ ...aLienzo("porteria", { x: base[0], y: base[1] }), n, color: "#FF4D4D", libre: true });
    }
  }

  return bolas;
}

const masVeces = (valores: (string | undefined)[]) => {
  const cuenta = new Map<string, number>();

  for (const v of valores) if (v) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);

  return [...cuenta].sort((a, b) => b[1] - a[1])[0] ?? null;
};

const ZONA_FRASE: Record<string, string> = {
  "1.er palo": "el primer palo",
  Centro: "el centro del área pequeña",
  "2.º palo": "el segundo palo",
  "Frontal / rechace": "la frontal",
  Frontal: "la frontal",
};

/**
 * La consigna en lenguaje de vestuario (experto de fútbol, 28/10/2026): en
 * lo suyo, dónde cargan; en su defensa, dónde les hacemos daño.
 */
function consignaDe(defensivo: boolean, clips: [number, ClipEstado][]) {
  const et = clips.map(([, c]) => c.etiquetas ?? {});

  if (defensivo) {
    const libre = masVeces(et.map((e) => e.libre));

    const estructura = masVeces(et.map((e) => e.estructura));

    return libre ? `Atacamos ${ZONA_FRASE[libre[0]] ?? libre[0].toLowerCase()}: ${estructura ? `con su ${estructura[0].toLowerCase()} ` : ""}lo dejan sin nadie` : "";
  }

  const zona = masVeces(et.map((e) => e.zona));

  const goles = et.filter((e) => e.desenlace === "Gol").length;

  return zona ? `Cuidado con ${ZONA_FRASE[zona[0]] ?? zona[0].toLowerCase()}: ahí cargan ${zona[1]} de ${clips.length}${goles ? ` (${goles === 1 ? "un gol" : `${goles} goles`})` : ""}` : "";
}

/** El reparto por zona, para las consignas: «Primer palo: 2 · Gol: 1». */
function repartoDe(clips: [number, ClipEstado][]) {
  const cuenta = new Map<string, number>();

  for (const [, c] of clips) {
    const z = c.etiquetas?.zona;

    if (z) cuenta.set(z, (cuenta.get(z) ?? 0) + 1);
  }

  const goles = clips.filter(([, c]) => c.etiquetas?.desenlace === "Gol").length;

  return [...[...cuenta].sort((a, b) => b[1] - a[1]).map(([z, n]) => `${(ZONA_FRASE[z] ?? z).replace(/^el |^la /, "")}: ${n}`), ...(goles ? [`Gol: ${goles}`] : [])]
    .map((l) => l.charAt(0).toUpperCase() + l.slice(1))
    .join(" · ");
}

/** Las diapositivas «DÓNDE CAEN» que tocan ahora, una por carpeta con algo marcado. */
export function slidesDeCaidas(porCarpeta: Map<CarpetaKey, [number, ClipEstado][]>, rival: string): SlidePizarra[] {
  return CARPETAS.flatMap((c) => {
    const clips = porCarpeta.get(c.key) ?? [];

    const bolas = caidas(clips, c.fase === "def");

    if (!bolas.length) return [];

    const base = slideDePlantilla("libre");

    /* En la consigna, «primer palo» y no «1.er palo»: el limpiador de consignas lo partía en «1. er». */
    const llano = (t: string) => t.replace(/1\.er palo/g, "primer palo").replace(/2\.º palo/g, "segundo palo");

    const leyenda = [...new Set(clips.map(([, x]) => x.etiquetas?.lado).filter((l): l is string => Boolean(l && x0(l))))]
      .map((l) => `${l === "Izquierda" ? "Azul" : l === "Derecha" ? "Oro" : "Verde"}: desde la ${l.toLowerCase()}`)
      .join(" · ");

    const notas = [
      consignaDe(c.fase === "def", clips),
      repartoDe(clips) ? `Reparto: ${repartoDe(clips)}` : "",
      llano(resumenDe(c.key, clips)),
      ...rutinasDe(clips).map((r) => llano(`Rutina que repite (${r.clips.length}): ${r.texto}`)),
      leyenda ? `Bolas: ${leyenda}${c.fase === "def" ? " · Rojo: zona que dejan sin nadie" : ""}` : "",
    ].filter(Boolean);

    return [
      {
        ...base,
        id: `SL-caidas-${c.key.toLowerCase().replace(/\s+/g, "-")}`,
        titulo: `DÓNDE CAEN · ${c.corto.toUpperCase()} · ${rival.toUpperCase()}`,
        vista: "porteria" as const,
        notas,
        caidas: bolas,
        deCoding: c.key,
      },
    ];
  });
}

/**
 * El tablero con sus diapositivas de caídas al día (al final, en el orden de
 * las carpetas). Devuelve null si no hay tablero de esa jornada o no cambia
 * nada, para no escribir por escribir.
 */
export function conCaidas(store: PizarraStore, clave: string, nuevas: SlidePizarra[]): PizarraStore | null {
  const tablero = store.tableros?.[clave];

  if (!tablero) return null;

  const viejas = tablero.slides.filter((s) => s.deCoding);

  const firma = (lista: SlidePizarra[]) => JSON.stringify(lista.map((s) => [s.id, s.titulo, s.notas, s.caidas]));

  if (firma(viejas) === firma(nuevas)) return null;

  return {
    ...store,
    tableros: {
      ...store.tableros,
      [clave]: { ...tablero, slides: [...tablero.slides.filter((s) => !s.deCoding), ...nuevas], actualizado: new Date().toISOString() },
    },
  };
}
