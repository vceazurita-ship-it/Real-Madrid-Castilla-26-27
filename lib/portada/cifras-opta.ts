/**
 * LAS CIFRAS DE xG DE LA TARJETA DEL ESTADIO, DE OPTA (10/11/2026).
 *
 * La regla de `lib/fuentes.ts`: el xG (a favor y en contra) y la posesión los
 * manda Opta. La tarjeta oscura de la portada las daba de Wyscout mientras la
 * de «Opta de un vistazo», justo debajo, daba otras para lo mismo. Aquí se
 * sacan de Opta, por partido y contra el grupo del equipo (los 20 con los que
 * juega), con los mismos números que la tabla de abajo; Wyscout queda como
 * segunda lectura en la tarjeta.
 *
 * Funciones puras: ni fetch ni estado.
 */

import type { OptaLigero } from "@/hooks/useOptaLigero";
import { num } from "@/lib/opta";
import { enAmbito, posicionEn, valorEquipo, type Fila } from "@/lib/opta-analisis";
import { hastaElPartido } from "@/lib/opta-laboratorio";
import { partidoDeFecha, type PartidoCalendario } from "@/lib/data-analisis/alcance";

export type CifrasOpta = {
  partidos: number;
  /** Equipos del grupo con dato. */
  deCuantos: number;
  xg: number | null;
  puestoXg: number | null;
  /** El que más genera del grupo y la mediana, para la barra y la referencia. */
  tope: number | null;
  mediana: number | null;
  xgContra: number | null;
  puestoXgContra: number | null;
  posesion: number | null;
  puestoPosesion: number | null;
  /** Totales de la temporada: goles a favor y xG. */
  goles: number | null;
  esperados: number | null;
};

export function cifrasOptaDe(opta: OptaLigero, teamId: string | null): CifrasOpta | null {
  if (!teamId) return null;
  const grupo = opta.grupos.get(teamId);
  const delGrupo: Fila[] = opta.equipos.filter((f) =>
    grupo === undefined ? enAmbito(f.teamId, opta.grupos, "todos") : opta.grupos.get(String(f.teamId ?? "")) === grupo,
  );
  const fila = delGrupo.find((f) => f.teamId === teamId);
  const partidos = fila ? num(fila.GM) : null;
  if (!fila || !partidos) return null;

  const pos = (a: string, mejor: boolean | null) => {
    const v = valorEquipo(fila, a, "partido", opta.catalogo);
    return posicionEn(v, delGrupo.map((f) => valorEquipo(f, a, "partido", opta.catalogo)), mejor);
  };
  const xg = pos("ExpG", true);
  const contra = pos("ExpGAg", false);
  const posesion = pos("Poss%", null);
  const todos = delGrupo.map((f) => valorEquipo(f, "ExpG", "partido", opta.catalogo)).filter((v): v is number => v != null);

  return {
    partidos,
    deCuantos: xg.deCuantos,
    xg: xg.valor,
    puestoXg: xg.puesto,
    tope: todos.length ? Math.max(...todos) : null,
    mediana: xg.mediana,
    xgContra: contra.valor,
    puestoXgContra: contra.puesto,
    posesion: posesion.valor,
    puestoPosesion: posesion.puesto,
    goles: num(fila.GF) ?? num(fila.Goal),
    esperados: num(fila.ExpG),
  };
}

/**
 * Hasta dónde llega Opta, para el sello: «J11» si el último partido de la
 * descarga cae en una jornada del calendario del Castilla (±1 día), o la
 * fecha («8 nov») si no.
 */
export function hastaOpta(opta: OptaLigero, calendario: PartidoCalendario[]): string {
  const ultimo = opta.meta?.temporada?.ultimoPartido || "";
  const jornada = ultimo ? partidoDeFecha(calendario, ultimo)?.jornada : undefined;
  if (jornada) return `J${jornada}`;
  const fecha = hastaElPartido(opta.meta, opta.partidos);
  return fecha ? `hasta el ${fecha}` : "";
}
