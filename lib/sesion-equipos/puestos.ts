/*
|--------------------------------------------------------------------------
| EL PUESTO DE CADA UNO DE LA SESIÓN, EN UN SOLO SITIO (02/11/2026)
|--------------------------------------------------------------------------
|
| Antes se armaba dentro de la página; ahora lo usan también la prueba en
| Node y los criterios de reparto, y tiene que ser idéntico en los tres.
|
| La demarcación sale de `resuelveDemarcacion` (lib/sesion-equipos/
| aprendizaje.ts): a mano en la sesión > fijada en su ficha > (los que suben:
| aprendido > plantilla; los del Castilla: plantilla > aprendido).
*/

import { claveNombre, puestosDesdePlantilla, type AlmacenEquipos, type FichaPlantilla, type JugadorSesion, type Puesto, type PuestoDe } from "@/lib/sesion-equipos/modelo";
import { demarcacion, demarcacionesDesdePlantilla, grupoDeDemarcacion, puntoPreferido, type Demarcacion } from "@/lib/sesion-equipos/demarcacion";
import { aprendePosiciones, resuelveDemarcacion, type OrigenDemarcacion, type PerfilAprendido } from "@/lib/sesion-equipos/aprendizaje";

export type PuestosDeLaSesion = {
  /** El puesto de cinco según la plantilla (por id de la sesión). */
  puestosAuto: Record<string, Puesto>;
  /** La demarcación de su ficha de la plantilla (por id de la sesión). */
  fichas: Record<string, Demarcacion>;
  /** Lo aprendido de todas las sesiones, por `claveNombre`. */
  aprendido: Record<string, PerfilAprendido>;
  resuelve: (j: JugadorSesion) => { demarcacion?: Demarcacion; origen?: OrigenDemarcacion };
  demarcacionDe: (j: JugadorSesion) => Demarcacion | undefined;
  puestoDe: PuestoDe;
};

export function puestosDeLaSesion(
  jugadores: JugadorSesion[],
  plantilla: FichaPlantilla[],
  almacen: AlmacenEquipos,
  aprendidoYa?: Record<string, PerfilAprendido>,
): PuestosDeLaSesion {
  const puestosAuto = puestosDesdePlantilla(jugadores, plantilla);
  const fichas = demarcacionesDesdePlantilla(jugadores, plantilla);
  const aprendido = aprendidoYa ?? aprendePosiciones(almacen);
  const fijos = almacen.puestosFijos ?? {};

  const resuelve = (j: JugadorSesion) =>
    resuelveDemarcacion(j, {
      fijo: fijos[claveNombre(j.nombre)],
      ficha: fichas[j.id],
      aprendido: aprendido[claveNombre(j.nombre)],
      enPlantilla: Boolean(fichas[j.id] || puestosAuto[j.id]),
    });

  const demarcacionDe = (j: JugadorSesion) => resuelve(j).demarcacion;

  const base = (j: JugadorSesion) =>
    (j.demarcacion ? demarcacion(j.demarcacion)?.puesto : undefined) ?? j.puesto ?? demarcacion(demarcacionDe(j))?.puesto ?? puestosAuto[j.id];

  const puestoDe: PuestoDe = Object.assign((j: JugadorSesion) => base(j), {
    /* Lo fijado a mano es fijo: no se mezcla con dónde se le ha colocado otras veces. */
    preferido: (j: JugadorSesion) => puntoPreferido(j, demarcacionDe, base, resuelve(j).origen === "fijo" ? undefined : aprendido[claveNombre(j.nombre)]),
    grupo: (j: JugadorSesion) => grupoDeDemarcacion(demarcacionDe(j)),
  });

  return { puestosAuto, fichas, aprendido, resuelve, demarcacionDe, puestoDe };
}
