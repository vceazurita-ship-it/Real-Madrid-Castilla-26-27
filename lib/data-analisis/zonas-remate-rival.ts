/**
 * ¿LE DEJAMOS REMATAR CÓMODO? (27/11/2026, idea de X). Los remates que nos
 * hizo el rival en un partido, repartidos en tres zonas, por partes y frente a
 * lo que concedemos de media en la temporada.
 *
 * Zonas (coordenadas de Opta, 0-100, el que remata ataca hacia x = 100):
 *   · Área central: dentro del área (x ≥ 83, y entre 21,1 y 78,9) y entre los
 *     postes prolongados (y entre 45,2 y 54,8).
 *   · Área lateral: dentro del área, fuera de ese carril.
 *   · Fuera del área: el resto.
 * Sin penaltis (no dicen nada del bloque).
 */

import { enArea, PALO_DCHO, PALO_IZDO, type Remate } from "@/lib/opta-eventos";
import { esPenalti } from "@/lib/data-analisis/ocasiones-concedidas";
import { temporadaDe } from "@/lib/data-analisis/metricas";

export type ZonaRemate = "central" | "lateral" | "fuera";

export const ZONAS: { clave: ZonaRemate; nombre: string; detalle: string }[] = [
  { clave: "central", nombre: "Área central", detalle: "dentro del área, entre los postes prolongados" },
  { clave: "lateral", nombre: "Área lateral", detalle: "dentro del área, fuera del carril de los postes" },
  { clave: "fuera", nombre: "Fuera del área", detalle: "desde fuera del área grande" },
];

export function zonaDe(r: Pick<Remate, "x" | "y">): ZonaRemate {
  if (!enArea(r.x, r.y)) return "fuera";
  return r.y >= PALO_DCHO && r.y <= PALO_IZDO ? "central" : "lateral";
}

export type CifraZona = { remates: number; xG: number; xGMedio: number | null; goles: number };

const vacia = (): CifraZona => ({ remates: 0, xG: 0, xGMedio: null, goles: 0 });

function suma(rs: Remate[]): Record<ZonaRemate, CifraZona> {
  const out: Record<ZonaRemate, CifraZona> = { central: vacia(), lateral: vacia(), fuera: vacia() };
  for (const r of rs) {
    const c = out[zonaDe(r)];
    c.remates += 1;
    c.xG += r.xG;
    if (r.gol) c.goles += 1;
  }
  for (const z of Object.values(out)) z.xGMedio = z.remates ? z.xG / z.remates : null;
  return out;
}

export type ZonasDelPartido = {
  /** Remates del rival en el partido (sin penaltis), por zona: todo el partido y por parte. */
  partido: Record<ZonaRemate, CifraZona>;
  primera: Record<ZonaRemate, CifraZona>;
  segunda: Record<ZonaRemate, CifraZona>;
  total: number;
  totalPrimera: number;
  totalSegunda: number;
  penaltis: number;
  /** Lo que concedemos en los otros partidos de la temporada (3 o más), por partido y por remate. */
  temporada: null | {
    partidos: number;
    porZona: Record<ZonaRemate, CifraZona & { porPartido: number }>;
    rematesPorPartido: number;
  };
};

/**
 * `remates`: todos los de opta:remates. `partido`: la clave del partido.
 * `nuestro`: el teamId del Castilla en Opta.
 */
export function zonasDelPartido(remates: Remate[], partido: string, nuestro: string): ZonasDelPartido | null {
  const delRival = remates.filter((r) => r.partido === partido && r.teamId !== nuestro);
  if (!remates.some((r) => r.partido === partido)) return null;
  const penaltis = delRival.filter(esPenalti).length;
  const enJuego = delRival.filter((r) => !esPenalti(r));
  const primera = enJuego.filter((r) => r.parte === 1);
  const segunda = enJuego.filter((r) => r.parte >= 2);

  const fecha = remates.find((r) => r.partido === partido)?.fecha ?? "";
  const temp = fecha ? temporadaDe(fecha.slice(0, 10)) : "";
  const resto = remates.filter(
    (r) => r.rivalId === nuestro && r.teamId !== nuestro && r.partido !== partido && !esPenalti(r) && (!temp || temporadaDe(r.fecha.slice(0, 10)) === temp),
  );
  const n = new Set(resto.map((r) => r.partido)).size;
  let temporada: ZonasDelPartido["temporada"] = null;
  if (n >= 3) {
    const s = suma(resto);
    const porZona = {} as Record<ZonaRemate, CifraZona & { porPartido: number }>;
    for (const z of ZONAS) porZona[z.clave] = { ...s[z.clave], porPartido: s[z.clave].remates / n };
    temporada = { partidos: n, porZona, rematesPorPartido: resto.length / n };
  }

  return {
    partido: suma(enJuego),
    primera: suma(primera),
    segunda: suma(segunda),
    total: enJuego.length,
    totalPrimera: primera.length,
    totalSegunda: segunda.length,
    penaltis,
    temporada,
  };
}

const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const veces = (n: number) => `${n} ${n === 1 ? "remate" : "remates"}`;

/** El titular y la lectura de la segunda parte, con las cifras ya redondeadas. */
export function lecturaZonas(z: ZonasDelPartido, rival: string): { titular: string; partes: string | null } {
  const c = z.partido.central;
  const t = z.temporada;
  let titular: string;
  if (!z.total) {
    titular = `${rival} no remató en juego.`;
  } else if (!c.remates) {
    titular = `${rival} no remató ni una vez desde el área central: ${veces(z.total)}, ${z.partido.lateral.remates} desde el área lateral y ${z.partido.fuera.remates} desde fuera.`;
  } else {
    const ref = t && t.porZona.central.porPartido > 0 ? ` (concedemos ${coma(t.porZona.central.porPartido, 1)} por partido)` : "";
    const cuota = Math.round((c.remates / z.total) * 100);
    titular = `${rival} remató ${c.remates} ${c.remates === 1 ? "vez" : "veces"} desde el área central${ref}: el ${cuota} % de sus ${veces(z.total)}, con ${coma(c.xGMedio ?? 0)} de xG medio cada uno.`;
  }

  /* Partes: sólo si la segunda tuvo remates y cambia algo que contar. */
  let partes: string | null = null;
  const p1 = z.totalPrimera;
  const p2 = z.totalSegunda;
  if (p1 + p2 >= 3) {
    const c1 = z.primera.central.remates;
    const c2 = z.segunda.central.remates;
    const x1 = z.primera.fuera.remates + z.primera.lateral.remates;
    const x2 = z.segunda.fuera.remates + z.segunda.lateral.remates;
    if (p2 > p1) {
      partes =
        c2 > c1
          ? `En la segunda parte apretó (${p1} → ${p2} remates) y encontró el carril central: ${c1} → ${c2} desde el área central.`
          : `En la segunda parte apretó (${p1} → ${p2} remates), pero lo que creció fue el tiro lateral o lejano (${x1} → ${x2}): el carril central aguantó (${c1} → ${c2}).`;
    } else if (p2 < p1) {
      partes = `En la segunda parte remató menos (${p1} → ${p2}); desde el área central, ${c1} → ${c2}.`;
    } else {
      partes = `Remató lo mismo en las dos partes (${p1} y ${p2}); desde el área central, ${c1} → ${c2}.`;
    }
  }
  return { titular, partes };
}
