/**
 * PROYECCIÓN DE LA JORNADA · EL MONTAJE (12/11/2026).
 *
 * De los documentos que ya lee la app a las dos proyecciones. Lo usan la ruta
 * `/api/proyeccion` (en el servidor, para no bajar al navegador los 10 MB de
 * eventos de Opta) y la prueba en Node. Puro: recibe los documentos ya leídos.
 */

import { comoNuestro, ordenaPartidos, type PartidoNuestro } from "@/lib/castilla/calendario";
import { aObjetos, CASTILLA_OPTA, type TablaOpta } from "@/lib/opta";
import { gruposDePartidos } from "@/lib/opta-abp";
import { casaEquipo, pistaDe, rematesDe, saquesDe, type Remate, type Saque } from "@/lib/opta-eventos";
import type { PartidoBeSoccer } from "@/lib/quiniela/besoccer";
import { mismoClub } from "@/lib/rivals/mismoClub";

import { proyeccionAbp, type ProyeccionAbp } from "./abp";
import { tablaDe, type Tabla } from "./base";
import { camposDeWyscout, conWyscout, delGrupo, filasAbpOpta, filasJuegoOpta, type EquipoOpta, type PartidoWyscout } from "./fuentes";
import { proyeccionJuego, type ProyeccionJuego } from "./juego";

export type DocsBase = {
  equipos: TablaOpta | null;
  partidos: TablaOpta | null;
  wyscout: PartidoWyscout[];
};

export type DocsAbp = {
  abpEventos: TablaOpta | null;
  remates: TablaOpta | null;
  jugadores: TablaOpta | null;
  castilla: TablaOpta | null;
};

export type PreparadoJuego = { tabla: Tabla; equipos: EquipoOpta[] };
export type PreparadoAbp = { tabla: Tabla; saques: Saque[]; remates: Remate[]; equipos: EquipoOpta[] };

const equiposDe = (t: TablaOpta | null): EquipoOpta[] => aObjetos(t).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));

/** La tabla del juego: Opta por partido + contraataques de Wyscout, sólo nuestro grupo. */
export function preparaJuego(d: DocsBase): PreparadoJuego | null {
  if (!d.equipos || !d.partidos) return null;
  const equipos = equiposDe(d.equipos);
  const campos = camposDeWyscout(d.wyscout, equipos);
  const grupos = gruposDePartidos(d.partidos);
  const filas = delGrupo(conWyscout(filasJuegoOpta(aObjetos(d.partidos), campos), d.wyscout, equipos), grupos, CASTILLA_OPTA);
  return { tabla: tablaDe(filas), equipos };
}

/** La tabla del balón parado: Opta evento a evento, sólo nuestro grupo. */
export function preparaAbp(d: DocsBase & DocsAbp): PreparadoAbp | null {
  if (!d.equipos || !d.partidos || !d.abpEventos || !d.remates) return null;
  const equipos = equiposDe(d.equipos);
  const pista = pistaDe(aObjetos(d.jugadores), aObjetos(d.castilla));
  const remates = rematesDe(d.remates, pista);
  const saques = saquesDe(d.abpEventos, remates, pista);
  const campos = camposDeWyscout(d.wyscout, equipos);
  const grupos = gruposDePartidos(d.partidos);
  const filas = delGrupo(filasAbpOpta(aObjetos(d.partidos), saques, remates, campos), grupos, CASTILLA_OPTA);
  const delG = new Set(filas.map((f) => f.equipo));
  return {
    tabla: tablaDe(filas),
    saques: saques.filter((s) => delG.has(s.teamId)),
    remates: remates.filter((r) => delG.has(r.teamId)),
    equipos,
  };
}

/* ------------------------------------------------------------------ */
/*  EL PARTIDO                                                         */
/* ------------------------------------------------------------------ */

export type PartidoObjetivo = PartidoNuestro & { rivalId: string | null };

/**
 * El partido que se proyecta. Con `rival`, el próximo contra él (o, si ya se
 * jugó y no queda otro, el último, para ver lo proyectado frente a lo real);
 * con `jornada`, ése; sin nada, el próximo del calendario.
 */
export function eligePartido(
  calendario: PartidoBeSoccer[],
  equipos: EquipoOpta[],
  ahora: number,
  pide: { rival?: string | null; jornada?: number | null; anterior?: boolean } = {},
): PartidoObjetivo | null {
  const nuestros = ordenaPartidos(calendario).map(comoNuestro).filter((p) => p.cuando && p.cuando >= "2026-07-01");
  const corte = ahora - 2.5 * 3_600_000;
  let elegido: PartidoNuestro | null = null;
  if (pide.anterior) elegido = nuestros.filter((p) => p.jugado && Date.parse(p.cuando) <= corte).pop() ?? null;
  else if (pide.jornada) elegido = nuestros.find((p) => p.jornada === pide.jornada) ?? null;
  else if (pide.rival) {
    const r = pide.rival;
    const idR = casaEquipo(r, equipos);
    const suyos = nuestros.filter((p) => mismoClub(p.rival, r) || (idR != null && casaEquipo(p.rival, equipos) === idR));
    elegido = suyos.find((p) => Date.parse(p.cuando) > corte) ?? suyos[suyos.length - 1] ?? null;
  } else elegido = nuestros.find((p) => Date.parse(p.cuando) > corte) ?? nuestros[nuestros.length - 1] ?? null;
  if (!elegido) return null;
  return { ...elegido, rivalId: casaEquipo(elegido.rival, equipos) };
}

export type Resultado = {
  partido: PartidoObjetivo;
  abp: ProyeccionAbp | null;
  juego: ProyeccionJuego | null;
};

/** Las dos proyecciones del partido (la que no tenga datos sale null). */
export function proyeccionDelPartido(partido: PartidoObjetivo, juego: PreparadoJuego | null, abp: PreparadoAbp | null): Resultado {
  const riv = partido.rivalId;
  const nosLocal = partido.lado === "casa";
  const antesDe = partido.jugado ? partido.cuando.slice(0, 10) : null;
  const nombre = partido.rival;
  return {
    partido,
    juego: riv && juego ? proyeccionJuego({ tabla: juego.tabla, nos: CASTILLA_OPTA, riv, nosLocal, nombreRival: nombre, antesDe }) : null,
    abp:
      riv && abp
        ? proyeccionAbp({ tabla: abp.tabla, saques: abp.saques, remates: abp.remates, nos: CASTILLA_OPTA, riv, nosLocal, nombreRival: nombre, antesDe })
        : null,
  };
}
