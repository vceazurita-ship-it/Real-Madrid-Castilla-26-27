/**
 * CÓMO MARCA DE CÓRNER (23/11/2026, idea de X).
 *
 * Reparte los remates que nacen de los córners de un equipo en tres grupos,
 * para saber si hay que ganar el primer balón o dejar gente en el rechace:
 *
 * - **Primer contacto**: remate en la misma jugada que el córner, sin pase
 *   intermedio (el pase del remate es el del sacador o no consta) y en ≤ 3 s.
 * - **Segunda jugada**: rechace o segundo centro: el resto de remates de la
 *   misma jugada y los que Opta ata al córner en otra secuencia (`segundas`
 *   de `saquesDe`), siempre dentro de ≤ 10 s del saque.
 * - **En corto**: todo lo que sale de un córner sacado en corto (Opta:
 *   CornerType = Short), sea cuando sea dentro de los 10 s.
 *
 * Lo que llega pasados 10 s no entra en ningún grupo (se cuenta aparte).
 * Conversión = goles de los tres grupos por cada 10 córners.
 *
 * Sin datos de Opta aquí (el repo es público): sólo nombres y fórmulas.
 */

import type { Remate, Saque } from "@/lib/opta-eventos";

export const PRIMER_TOQUE_S = 3;
export const SEGUNDA_S = 10;

export type GrupoCorner = "primer" | "segunda" | "corto";

export const GRUPOS_CORNER: { clave: GrupoCorner; rotulo: string; detalle: string }[] = [
  { clave: "primer", rotulo: "Primer contacto", detalle: `remate sin pase intermedio y en ≤ ${PRIMER_TOQUE_S} s` },
  { clave: "segunda", rotulo: "Segunda jugada", detalle: `rechace o segundo centro en ≤ ${SEGUNDA_S} s` },
  { clave: "corto", rotulo: "Jugada en corto", detalle: "córner sacado en corto" },
];

export type RemateCorner = Remate & { grupo: GrupoCorner; tras: number; desde: "derecha" | "izquierda" };

export type CuentaGrupo = { remates: number; goles: number; xG: number };

export type ComoMarca = {
  corners: number;
  partidos: number;
  grupos: Record<GrupoCorner, CuentaGrupo>;
  remates: RemateCorner[];
  /** Remates atados al córner pero llegados después de 10 s. */
  tardios: number;
  goles: number;
  /** Goles por cada 10 córners. */
  conversion: number | null;
};

/** Cada remate de un córner, con su grupo (o null si llega tarde). */
function clasifica(s: Saque): { r: Remate; grupo: GrupoCorner | null; tras: number }[] {
  const corto = s.rosca === "Short";
  const salida: { r: Remate; grupo: GrupoCorner | null; tras: number }[] = [];
  const mira = (r: Remate, misma: boolean) => {
    const tras = r.parte === s.parte ? r.segundo - s.segundo : Number.POSITIVE_INFINITY;
    let grupo: GrupoCorner | null;
    if (tras < 0 || tras > SEGUNDA_S) grupo = null;
    else if (corto) grupo = "corto";
    else {
      const sinPase = !r.asistente || r.asistente === s.lanzador;
      grupo = misma && sinPase && tras <= PRIMER_TOQUE_S ? "primer" : "segunda";
    }
    salida.push({ r, grupo, tras });
  };
  for (const r of s.remates) mira(r, true);
  for (const r of s.segundas) mira(r, false);
  return salida;
}

const vacio = (): CuentaGrupo => ({ remates: 0, goles: 0, xG: 0 });

/** Lo de un conjunto de córners (de un equipo o de toda la liga). */
export function comoMarca(corners: Saque[]): ComoMarca {
  const grupos: Record<GrupoCorner, CuentaGrupo> = { primer: vacio(), segunda: vacio(), corto: vacio() };
  const remates: RemateCorner[] = [];
  let tardios = 0;
  for (const s of corners) {
    const desde = s.y < 50 ? "derecha" : "izquierda";
    for (const { r, grupo, tras } of clasifica(s)) {
      if (!grupo) {
        tardios += 1;
        continue;
      }
      const g = grupos[grupo];
      g.remates += 1;
      g.xG += r.xG;
      if (r.gol) g.goles += 1;
      remates.push({ ...r, grupo, tras, desde });
    }
  }
  const goles = grupos.primer.goles + grupos.segunda.goles + grupos.corto.goles;
  return {
    corners: corners.length,
    partidos: new Set(corners.map((s) => s.partido)).size,
    grupos,
    remates,
    tardios,
    goles,
    conversion: corners.length ? (goles / corners.length) * 10 : null,
  };
}

/** Parte de los remates de cada grupo (0-1). */
export function reparto(c: ComoMarca): Record<GrupoCorner, number | null> {
  const n = c.grupos.primer.remates + c.grupos.segunda.remates + c.grupos.corto.remates;
  const p = (k: GrupoCorner) => (n ? c.grupos[k].remates / n : null);
  return { primer: p("primer"), segunda: p("segunda"), corto: p("corto") };
}

export type ZonaRechace = "frontal" | "segundo palo" | "dentro del área";

/**
 * Desde dónde se remata el rechace, visto por quien ataca (x hacia la
 * portería, y = 0 su banda derecha): «frontal» a más de 12 m de la línea de
 * fondo (x < 88,5); «segundo palo» en el lado contrario al del saque, más
 * allá del poste lejano (y > 55,4 si sacan desde su derecha, y < 44,6 si
 * desde su izquierda); el resto, dentro del área.
 */
export function zonaRechace(r: RemateCorner): ZonaRechace {
  if (r.x < 88.5) return "frontal";
  const lejano = r.desde === "derecha" ? r.y > 55.4 : r.y < 44.6;
  return lejano ? "segundo palo" : "dentro del área";
}

/** ¿Pesa la segunda jugada? Al menos 3 remates y más parte que la media de la liga (o que el primer contacto). */
export function pesaSegunda(eq: ComoMarca, liga: ComoMarca | null): boolean {
  const r = reparto(eq);
  if (eq.grupos.segunda.remates < 3 || r.segunda == null) return false;
  const ligaSeg = liga ? reparto(liga).segunda : null;
  return eq.grupos.segunda.remates >= eq.grupos.primer.remates || (ligaSeg != null && r.segunda > ligaSeg);
}

/** Quién remata los rechaces, de más a menos. */
export function rematadoresRechace(rs: RemateCorner[]) {
  const m = new Map<string, { tirador: string; remates: number; goles: number; xG: number; zonas: Record<ZonaRechace, number> }>();
  for (const r of rs) {
    if (r.grupo !== "segunda" || !r.tirador) continue;
    const a = m.get(r.tirador) ?? { tirador: r.tirador, remates: 0, goles: 0, xG: 0, zonas: { frontal: 0, "segundo palo": 0, "dentro del área": 0 } };
    a.remates += 1;
    a.xG += r.xG;
    if (r.gol) a.goles += 1;
    a.zonas[zonaRechace(r)] += 1;
    m.set(r.tirador, a);
  }
  return [...m.values()].sort((a, b) => b.remates - a.remates || b.xG - a.xG);
}
