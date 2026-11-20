/**
 * EL ESTADO DE UN DÍA DE ENTRENO, IGUAL EN TODAS LAS PANTALLAS (20/11/2026).
 *
 * Los jueces vieron el 16, el 18 y el 19/11 «planificado, sin minutos» en
 * /micro_calendar y /calendar_general mientras /microcycles decía «Equipos
 * hechos» y que la L-T1 no se hizo. La regla es la de /microcycles
 * (components/sesion-dia/DiaConectado.tsx y la lectura de la semana):
 *
 *   - la sesión está HECHA si tiene equipos en Jugadores sesión o minutos en
 *     la hoja;
 *   - con equipos, la tarea del plan que no casa con ninguna de la sesión
 *     (`enlaza`) NO se hizo.
 *
 * Sin equipos ni minutos, el día sigue planificado.
 */

import { enlaza, planDeRegistro, sesionDeFecha, type FilaPlan } from "@/lib/sesion-dia/conexion";
import type { AlmacenEquipos } from "@/lib/sesion-equipos/modelo";

export type EstadoDia = {
  /** Con equipos hechos o con minutos apuntados. */
  hecha: boolean;
  /** Con equipos en Jugadores sesión. */
  conEquipos: boolean;
  /** Los códigos del plan («L-T1») que no se hicieron (sólo se sabe con equipos). */
  noHechas: Set<string>;
};

export function estadoDelDia(fecha: string, hoy: string, registro: FilaPlan[], almacen: AlmacenEquipos | null | undefined, minutos = 0): EstadoDia {
  /* Equipos hechos por adelantado no hacen la sesión: sólo cuenta hasta hoy. */
  const equipos = fecha <= hoy ? sesionDeFecha(almacen?.sesiones, fecha) : null;
  const noHechas = new Set<string>();

  if (equipos) {
    const plan = planDeRegistro(registro, fecha);
    const enlace = enlaza(equipos.tareas, plan);

    plan.forEach((p, k) => {
      if (!enlace.includes(k)) noHechas.add(p.codigo);
    });
  }

  return { hecha: Boolean(equipos) || minutos > 0, conEquipos: Boolean(equipos), noHechas };
}
