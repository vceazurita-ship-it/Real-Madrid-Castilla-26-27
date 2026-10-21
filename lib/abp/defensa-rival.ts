/**
 * «Poner su defensa»: el rival colocado como defiende el córner o la falta
 * lateral, para que el bloqueo y la carrera se expliquen contra algo.
 *
 * Sale de dos sitios que ya existen y que aquí sólo se leen:
 * - el scouting de ABP del rival (`abp-rival-scout`): en las acciones en que
 *   él defiende, el patrón y las observaciones dicen si va en zona, al hombre
 *   o mixto, y a veces cuántos en zona («Zona en 1 +3 y marcas»);
 * - su plantilla (`rivalesPlantillas`): los etiquetados «Rematador de ABP» y
 *   los más altos, con su dorsal.
 *
 * Lo que no se sabe no se inventa: sin estructura en el scouting, sólo se
 * colocan sus rematadores, cada uno marcando a uno de los nuestros, y se dice.
 * Las chapas se mueven luego a mano como cualquier rival.
 */

import type { RivalScoutAction } from "@/lib/abp/rivalScout";
import type { RivalPlayerAerial } from "@/lib/abp/rival";
import type { FichaPizarra } from "@/lib/abp/pizarra";
import { nuevoRival, type RivalPizarra } from "@/lib/abp/trazos";

export type TipoDefensa = "zonal" | "mixta" | "hombre";

export type EstructuraDefensa = {
  tipo: TipoDefensa;
  /** Cuántos defienden en zona, si el scouting lo dice. */
  enZona: number | null;
  /** El texto del scouting del que sale, tal cual. */
  fuente: string;
  /** En cuántas acciones registradas se apoya. */
  acciones: number;
};

const NUMEROS: Record<string, number> = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };

const sinTildes = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** «Zona en 1 +3» → 4; «mixto con dos en zona» → 2; nada → null. */
export function cuantosEnZona(texto: string): number | null {
  const t = sinTildes(texto).replace(/\b(uno|una|dos|tres|cuatro|cinco|seis|siete)\b/g, (p) => String(NUMEROS[p]));

  const suma = t.match(/zona\s*(?:en|de|con)?\s*(\d+)\s*\+\s*(\d+)/);

  if (suma) return Number(suma[1]) + Number(suma[2]);

  const delante = t.match(/(\d+)\s*(?:en|de)?\s*zona/);

  if (delante) return Number(delante[1]);

  const detras = t.match(/zona\s*(?:en|de|con)?\s*(\d+)/);

  return detras ? Number(detras[1]) : null;
}

/** La familia de acciones del scouting que corresponde a cada plantilla. */
export function familiaDePlantilla(plantilla: string): "corner" | "falta-lateral" | null {
  if (plantilla === "corner-of") return "corner";
  if (plantilla === "falta-lat-of") return "falta-lateral";

  return null;
}

/**
 * Cómo defiende el rival esa acción, según lo registrado. `null` si no hay
 * ninguna acción suya defendiendo que diga zona, hombre o mixto.
 */
export function estructuraDefensiva(
  acciones: RivalScoutAction[],
  familia: "corner" | "falta-lateral",
): EstructuraDefensa | null {
  const suyas = acciones.filter((a) => a.condicion === "defensivo" && a.family === familia);

  const votos: Record<TipoDefensa, number> = { zonal: 0, mixta: 0, hombre: 0 };
  const textos: string[] = [];
  let enZona: number | null = null;

  for (const accion of suyas) {
    const texto = [accion.patron, accion.observaciones].filter(Boolean).join(" · ").trim();

    if (!texto) continue;

    const t = sinTildes(texto);
    const zona = /\bzona/.test(t);
    const hombre = /hombre|marca/.test(t);

    if (!zona && !hombre) continue;

    const tipo: TipoDefensa = /mixt/.test(t) || (zona && hombre) ? "mixta" : zona ? "zonal" : "hombre";

    votos[tipo] += 1;
    textos.push(texto);
    enZona ??= cuantosEnZona(texto);
  }

  const total = votos.zonal + votos.mixta + votos.hombre;

  if (total === 0) return null;

  const tipo = (Object.keys(votos) as TipoDefensa[]).sort((a, b) => votos[b] - votos[a])[0];

  return { tipo, enZona: tipo === "hombre" ? 0 : enZona, fuente: textos[0], acciones: total };
}

/** Sus mejores por alto: los etiquetados primero, luego por estatura (sin el portero, que no marca en un córner). */
export function susCabeceadores(plantilla: RivalPlayerAerial[], maximo = 3) {
  return [...plantilla]
    .filter((uno) => uno.remataAbp || ((uno.altura ?? 0) >= 186 && !/portero|^po?r?$|^gk$/i.test(uno.posicion.trim())))
    .sort((a, b) => Number(b.remataAbp) - Number(a.remataAbp) || (b.altura ?? 0) - (a.altura ?? 0))
    .slice(0, maximo);
}

/*
| Dónde cae cada cosa en la foto de cada plantilla (coordenadas de 1920 × 1080).
| Córner: la portería arriba, el área pequeña hacia y ≈ 300 entre el primer palo
| (x ≈ 820) y el segundo (x ≈ 1100). Falta lateral: la línea de la defensa justo
| por delante de nuestros rematadores, que esperan en y ≈ 466.
*/
const GEOMETRIA = {
  "corner-of": { zona: { x0: 830, x1: 1100, y: 300 }, area: { x0: 560, x1: 1300, y0: 250, y1: 600 }, marca: { dx: 22, dy: -36 } },
  "falta-lat-of": { zona: { x0: 780, x1: 1080, y: 392 }, area: { x0: 600, x1: 1250, y0: 330, y1: 560 }, marca: { dx: 18, dy: -40 } },
} as const;

export type DefensaColocada = {
  rivales: RivalPizarra[];
  /** Lo que se le dice al cuerpo técnico, con la fuente. */
  aviso: string;
};

/**
 * Las chapas del rival para esa diapositiva.
 *
 * Los de zona, repartidos a lo largo del área pequeña (o de la línea, en la
 * falta); los de marca, cada uno pegado por el lado de la portería a uno de
 * los nuestros que están en el área, de más adelantado a menos. Sus
 * rematadores llevan el dorsal y van primero a la zona central o a marcar a
 * nuestro rematador más peligroso.
 */
export function colocaDefensa(
  plantilla: string,
  fichas: FichaPizarra[],
  estructura: EstructuraDefensa | null,
  cabeceadores: RivalPlayerAerial[],
  equipo: string,
): DefensaColocada | null {
  const geo = GEOMETRIA[plantilla as keyof typeof GEOMETRIA];

  if (!geo) return null;

  const enArea = fichas
    .filter((f) => f.x >= geo.area.x0 && f.x <= geo.area.x1 && f.y >= geo.area.y0 && f.y <= geo.area.y1)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const dorsales = cabeceadores.map((uno) => uno.dorsal.trim()).filter(Boolean);
  const marca = (f: FichaPizarra) => nuevoRival({ x: f.x + geo.marca.dx, y: f.y + geo.marca.dy });

  if (!estructura) {
    if (cabeceadores.length === 0 || enArea.length === 0) return null;

    const rivales = cabeceadores.slice(0, enArea.length).map((uno, i) => ({
      ...marca(enArea[i]),
      ...(uno.dorsal ? { dorsal: uno.dorsal } : {}),
    }));

    return {
      rivales,
      aviso: `El scouting de ${equipo} no dice cómo defiende esta acción: coloco sólo a sus ${rivales.length === 1 ? "rematador" : `${rivales.length} rematadores`} de ABP marcando a los nuestros. Muévelos a donde toque.`,
    };
  }

  const enZona = Math.min(6, estructura.enZona ?? (estructura.tipo === "zonal" ? 4 : estructura.tipo === "mixta" ? 3 : 0));

  const zona: RivalPizarra[] = Array.from({ length: enZona }, (_, i) =>
    nuevoRival({
      x: enZona === 1 ? (geo.zona.x0 + geo.zona.x1) / 2 : geo.zona.x0 + ((geo.zona.x1 - geo.zona.x0) * i) / (enZona - 1),
      y: geo.zona.y,
    }),
  );

  /* Al hombre o mixta: uno pegado a cada uno de los nuestros que atacan el área. */
  const marcas = estructura.tipo === "zonal" ? [] : enArea.slice(0, Math.max(0, 10 - enZona)).map(marca);

  /* El dorsal de sus mejores por alto: en la zona del centro y marcando a los primeros. */
  const conDorsal = [...(zona.length ? [zona[Math.floor(zona.length / 2)]] : []), ...marcas, ...zona];
  const usados = new Set<string>();

  for (const dorsal of dorsales) {
    const chapa = conDorsal.find((c) => !usados.has(c.id));

    if (!chapa) break;

    chapa.dorsal = dorsal;
    usados.add(chapa.id);
  }

  const como =
    estructura.tipo === "zonal"
      ? `en zona con ${enZona}`
      : estructura.tipo === "hombre"
        ? "al hombre"
        : `mixta, ${enZona} en zona y el resto al hombre`;

  const deCuantas = estructura.acciones === 1 ? "1 acción" : `${estructura.acciones} acciones`;
  const conCabeza = dorsales.length
    ? ` Sus rematadores (${dorsales.map((d) => `el ${d}`).join(", ")}) llevan el dorsal.`
    : "";

  return {
    rivales: [...zona, ...marcas],
    aviso: `${equipo} defiende ${como} (scouting, ${deCuantas}: «${estructura.fuente}»).${conCabeza} Colocación orientativa: ajústala a mano.`,
  };
}
