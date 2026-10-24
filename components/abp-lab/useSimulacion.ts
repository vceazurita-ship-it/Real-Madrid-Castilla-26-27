"use client";

/**
 * La simulación de una rutina para pintarla: dónde está cada uno en `t`, la
 * defensa que toca (el rival tipo de la rutina, el próximo rival o ninguna) y
 * las lecturas de ventaja. La comparten la pizarra del estudio y la
 * presentación a pantalla completa, para que cuenten exactamente lo mismo.
 */

import { useMemo } from "react";

import type { PerfilAereo, ProximoRival } from "@/hooks/useContextoLab";
import { posicionesEn, recorridoBalon } from "@/lib/abp-lab/campo";
import type { Defensa, Envio, Lado, Punto, Rol } from "@/lib/abp-lab/modelo";
import type { TipoAbp } from "@/lib/abp-lab/referentes";
import { defensaEn, estadoBalon } from "@/lib/abp-lab/simulacion";
import { controlEspacio, duelosAereos, encajeSistemas, espaciosLibres, evaluaRemate, mapaLlegada, planCon, type DefensaRival } from "@/lib/abp-lab/ventaja";
import type { CalibreXg } from "@/lib/abp-lab/xg";

export type RutinaSimulable = {
  nombre: string;
  senal: string;
  tipo: TipoAbp;
  lado: Lado;
  contra: Defensa;
  roles: Rol[];
  balon?: Punto[];
  envio?: Envio;
};

export type QueDefensa = "tipo" | "proximo" | "ninguna";

export type ContextoSim = {
  aereo: Map<string, PerfilAereo>;
  calibre: CalibreXg | null;
  rival: ProximoRival | null;
};

/** La estructura del próximo rival en esta acción (córner o falta lateral), si su scouting la dice. */
export function estructuraPara(rival: ProximoRival | null, tipo: TipoAbp) {
  if (!rival) return null;

  return tipo === "corner" ? rival.corner : tipo === "falta" ? rival.falta : null;
}

/** La defensa que se pinta y se mide. */
export function defensaRivalDe(que: QueDefensa, r: RutinaSimulable, ctx: ContextoSim): DefensaRival | null {
  if (r.lado !== "ofensivo" || que === "ninguna") return null;

  if (que === "proximo") {
    const e = estructuraPara(ctx.rival, r.tipo);

    if (!ctx.rival || (!e && !ctx.rival.plantilla.length)) return null;

    const defensa: Defensa = e ? (e.tipo === "zonal" ? "zona" : e.tipo) : r.contra === "cualquiera" ? "mixta" : r.contra;

    return { defensa, enZona: e?.enZona ?? undefined, jugadores: ctx.rival.plantilla.filter((j) => !/portero|^po?r?$|^gk$/i.test(j.posicion.trim())) };
  }

  return { defensa: r.contra === "cualquiera" ? "mixta" : r.contra };
}

/**
 * Lo que no depende del instante: el plan de la defensa, el remate, el encaje
 * y la llegada. Se calcula al cambiar la rutina, no en cada fotograma.
 */
export function useSimulacionFija(r: RutinaSimulable, que: QueDefensa, ctx: ContextoSim) {
  const alturaDe = useMemo(() => (rol: Rol) => ctx.aereo.get(rol.jugador)?.altura ?? null, [ctx.aereo]);

  const camino = useMemo(() => recorridoBalon(r), [r]);

  const rivalDef = useMemo(() => defensaRivalDe(que, r, ctx), [que, r, ctx]);

  const plan = useMemo(() => (rivalDef ? planCon(r, rivalDef) : null), [r, rivalDef]);

  const remate = useMemo(() => (r.lado === "ofensivo" && plan ? evaluaRemate(r, plan, ctx.calibre, alturaDe) : null), [r, plan, ctx.calibre, alturaDe]);

  const encaje = useMemo(() => (r.lado === "ofensivo" && r.roles.length && (r.tipo === "corner" || r.tipo === "falta") ? encajeSistemas(r, ctx.calibre, alturaDe) : []), [r, ctx.calibre, alturaDe]);

  const llegada = useMemo(() => (r.lado === "ofensivo" ? mapaLlegada(r.roles) : []), [r.lado, r.roles]);

  return { alturaDe, camino, rivalDef, plan, remate, encaje, llegada };
}

export type SimulacionFija = ReturnType<typeof useSimulacionFija>;

/** Lo que cambia con el instante: dónde está cada uno, la defensa y las lecturas que se pintan. */
export function useSimulacionEn(r: RutinaSimulable, fija: SimulacionFija, t: number, conEspacio: boolean) {
  const { plan, camino, alturaDe } = fija;

  const nuestros = useMemo(() => posicionesEn(r.roles, t), [r.roles, t]);

  const envio = r.envio ?? "tenso";

  const estado = useMemo(
    () => (plan ? defensaEn(plan, r.roles, t, camino.at(-1)!, (s) => estadoBalon(camino, s, envio, r.tipo).suelo) : null),
    [plan, r.roles, r.tipo, t, camino, envio],
  );

  const defensa = useMemo(() => (plan && estado ? { plan, estado } : null), [plan, estado]);

  const atacantes = useMemo(() => nuestros.filter((_, i) => !["vigilancia", "lanzador"].includes(r.roles[i]?.papel)), [nuestros, r.roles]);

  const celdas = useMemo(() => (conEspacio && estado && plan ? controlEspacio(atacantes, estado.pos.filter((_, k) => plan[k].papel !== "barrera")) : []), [conEspacio, estado, atacantes, plan]);

  const libres = useMemo(() => (conEspacio && estado ? espaciosLibres([...nuestros, ...estado.pos]) : []), [conEspacio, estado, nuestros]);

  const duelos = useMemo(() => (plan && estado ? duelosAereos(r.roles, nuestros, plan, estado.pos, alturaDe) : []), [plan, estado, r.roles, nuestros, alturaDe]);

  return { nuestros, defensa, celdas, libres, duelos };
}

/** Las dos cosas juntas, para quien pinta y lee a la vez (la presentación). */
export function useSimulacion(r: RutinaSimulable, t: number, que: QueDefensa, ctx: ContextoSim, conEspacio: boolean) {
  const fija = useSimulacionFija(r, que, ctx);

  const en = useSimulacionEn(r, fija, t, conEspacio);

  return { ...fija, ...en };
}
