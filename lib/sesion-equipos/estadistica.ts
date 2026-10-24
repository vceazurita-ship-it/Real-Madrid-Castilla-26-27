/**
 * LO QUE DICEN LAS SESIONES REGISTRADAS DE CADA JUGADOR (Dashboard Individual).
 *
 * Sale del documento `jugadores-sesion` (lo que se registra en
 * /jugadores-sesion): quién estuvo en cada sesión y en qué tareas jugó. Sólo se
 * lee; aquí no se escribe nada.
 */
import { COMODIN, FUERA, casaPalabra, claveNombre, limpiaJugador, type AlmacenEquipos, type SesionEquipos } from "@/lib/sesion-equipos/modelo";

/**
 * Primer día (incluido) desde el que cuentan las sesiones registradas:
 * miércoles 21/10/2026. Antes no se registraba bien ni siempre (faltaban
 * sesiones, listas a medias, tareas sin repartir) y las cifras saldrían
 * falseadas. Una sesión sin fecha en el título tampoco cuenta: no se puede
 * saber si es de antes. Se filtra aquí, en los registros, no en la vista.
 */
export const SESIONES_CONTADAS_DESDE = "2026-10-21";

/** La base escrita en pantalla. */
export const SESIONES_DESDE_TEXTO = "desde el 21/10";

export type SesionesDeJugador = {
  /** Sesiones registradas en que estuvo (en la lista y, si era baja, con alguna tarea hecha). */
  sesiones: number;
  /** Tareas en que jugó (equipo o comodín)... */
  tareasHechas: number;
  /** ...de las que tenían esas sesiones. */
  tareasTotales: number;
  /** Veces que fue comodín. */
  comodin: number;
};

export type ResumenSesiones = {
  /** Sesiones registradas que cuentan. */
  totalSesiones: number;
  /** Por id del jugador del dashboard, sólo de quien tiene registros. */
  porJugador: Map<string, SesionesDeJugador>;
};

export type FichaCruce = { id: string; nombre: string; apodo?: string };

export function sesionesQueCuentan(almacen: AlmacenEquipos | null | undefined): SesionEquipos[] {
  return (almacen?.sesiones ?? []).filter((s) => Boolean(s.fecha) && (s.fecha as string) >= SESIONES_CONTADAS_DESDE);
}

/** Casa un nombre de la lista del delegado con UN jugador de la plantilla; si hay duda, con ninguno. */
function casaCon(nombre: string, plantilla: FichaCruce[]): string | null {
  const palabras = claveNombre(nombre).split(" ").filter(Boolean);
  if (!palabras.length) return null;

  const clave = palabras.join(" ");

  const exactos = plantilla.filter((p) => claveNombre(p.nombre) === clave || (p.apodo && claveNombre(p.apodo) === clave));
  if (exactos.length === 1) return exactos[0].id;
  if (exactos.length > 1) return null;

  const casan = plantilla.filter((p) =>
    [p.nombre, p.apodo ?? ""].some((n) => {
      const suyas = new Set(claveNombre(n).split(" ").filter(Boolean));
      return suyas.size > 0 && palabras.every((w) => casaPalabra(w, suyas));
    }),
  );

  return casan.length === 1 ? casan[0].id : null;
}

export function resumenDeSesiones(almacen: AlmacenEquipos | null | undefined, plantilla: FichaCruce[]): ResumenSesiones {
  const sesiones = sesionesQueCuentan(almacen);
  const porJugador = new Map<string, SesionesDeJugador>();
  const cruce = new Map<string, string | null>();

  for (const sesion of sesiones) {
    for (const crudo of sesion.jugadores) {
      const j = limpiaJugador(crudo);
      /* Los de otro equipo (RMC, JA) vienen en la lista y no casan con esta plantilla: se quedan fuera. */
      const clave = claveNombre(j.nombre);
      if (!cruce.has(clave)) cruce.set(clave, casaCon(j.nombre, plantilla));
      const id = cruce.get(clave);
      if (!id) continue;

      let hechas = 0;
      let comodin = 0;

      for (const t of sesion.tareas) {
        const donde = t.sitio[crudo.id];

        if (donde === COMODIN) {
          hechas += 1;
          comodin += 1;
        } else if (donde && donde !== FUERA && t.equipos.some((e) => e.id === donde)) hechas += 1;
      }

      /* Una baja que no hizo ninguna tarea no estuvo en la sesión. */
      if (j.baja && hechas === 0) continue;

      const previo = porJugador.get(id) ?? { sesiones: 0, tareasHechas: 0, tareasTotales: 0, comodin: 0 };

      porJugador.set(id, {
        sesiones: previo.sesiones + 1,
        tareasHechas: previo.tareasHechas + hechas,
        tareasTotales: previo.tareasTotales + sesion.tareas.length,
        comodin: previo.comodin + comodin,
      });
    }
  }

  return { totalSesiones: sesiones.length, porJugador };
}
