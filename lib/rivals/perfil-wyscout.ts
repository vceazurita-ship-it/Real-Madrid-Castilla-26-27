/**
 * EL JUGADOR RIVAL EN LOS DATOS DE WYSCOUT (21/10/2026).
 *
 * La ficha de BeSoccer dice cuánto juega (partidos, minutos, goles); no dice
 * **cómo** juega. Las descargas de Wyscout de toda la categoría que alimentan
 * DATA sí lo dicen, y con un criterio que ya está acordado allí: cada métrica
 * en **percentil contra los de su mismo puesto en la categoría**, esta
 * temporada y con al menos 90′ (`MINUTOS_MINIMOS`). Comparar a un central con
 * todos sólo descubre que es central.
 *
 * Se parte en dos mitades a propósito:
 * - `perfilesDeEquipo` corre **en el servidor** (`/api/data-analisis?perfiles=`):
 *   el dataset entero son megas y la ficha se abre a veces desde el móvil.
 *   Sale una lista corta, una entrada por jugador de ese club en Wyscout.
 * - `asignaPerfiles` corre en la pantalla: casa las fichas de la hoja RIVALES con
 *   su entrada por nombre (`casaNombre`, como Duelos), uno a uno.
 *
 * Lo que más le separa de sus iguales sale de `fuertesYFlojos` de DATA, que ya
 * descarta los porcentajes de pocas acciones. Y aquí sólo se enseña lo que
 * separa de verdad: por encima del 70 o por debajo del 30.
 */
import type { FilaJugador } from "@/lib/data-analisis/leer";
import {
  MINUTOS_MINIMOS,
  PUESTOS,
  fuertesYFlojos,
  puestoDe,
  type Puesto,
} from "@/lib/data-analisis/individual";
import type { Unidad } from "@/lib/data-analisis/metricas";
import { casaNombre } from "@/lib/data-analisis/once";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { normalizePlayerName } from "@/lib/playerImages";

/** Sólo cuenta como «destaca» por encima de esto, y como «flojea» por debajo del espejo. */
export const PERCENTIL_FUERTE = 70;
export const PERCENTIL_FLOJO = 30;

/** Con menos iguales que éstos, un percentil no es una referencia. */
const IGUALES_MINIMOS = 8;

export type RasgoWyscout = {
  nombre: string;
  valor: number;
  unidad: Unidad;
  percentil: number;
  comoLeer: string;
};

export type PerfilWyscout = {
  /** Cómo le llama Wyscout, por si no coincide con la hoja. */
  jugador: string;
  posicion: string;
  puesto: Puesto;
  puestoLabel: string;
  partidos: number;
  minutos: number;
  /** Contra cuántos de su puesto se le compara. */
  iguales: number;
  /** Con menos de 90′ no se compara: las cifras serían extrapolaciones. */
  muestraCorta: boolean;
  fuertes: RasgoWyscout[];
  flojos: RasgoWyscout[];
};

export type PerfilesDeEquipo = {
  /** La jornada más alta que lleva alguien de la categoría en la descarga. */
  partidosDeLaCategoria: number;
  perfiles: PerfilWyscout[];
};

const rasgo = (r: { metrica: { nombre: string; unidad: Unidad; comoLeer: string }; valor: number; percentil: number }): RasgoWyscout => ({
  nombre: r.metrica.nombre,
  valor: r.valor,
  unidad: r.metrica.unidad,
  percentil: r.percentil,
  comoLeer: r.metrica.comoLeer,
});

/** En el servidor: los de un club, cada uno contra los de su puesto en la categoría. */
export function perfilesDeEquipo(jugadores: FilaJugador[], equipo: string): PerfilesDeEquipo {
  const actuales = jugadores.filter((j) => j.temporada === "actual");

  const suyos = actuales.filter((j) => j.minutos > 0 && mismoClub(j.equipo, equipo));

  const igualesDe = new Map<Puesto, FilaJugador[]>();

  for (const j of actuales) {
    if (j.minutos < MINUTOS_MINIMOS) continue;
    const p = puestoDe(j.posicion);
    igualesDe.set(p, [...(igualesDe.get(p) ?? []), j]);
  }

  const perfiles = suyos.map((fila): PerfilWyscout => {
    const puesto = puestoDe(fila.posicion);
    const iguales = igualesDe.get(puesto) ?? [];

    const base = {
      jugador: fila.jugador,
      posicion: fila.posicion.split(",")[0].trim(),
      puesto,
      puestoLabel: PUESTOS.find((p) => p.key === puesto)?.label ?? puesto,
      partidos: fila.partidos,
      minutos: Math.round(fila.minutos),
      iguales: iguales.length,
    };

    if (fila.minutos < MINUTOS_MINIMOS || iguales.length < IGUALES_MINIMOS) {
      return { ...base, muestraCorta: true, fuertes: [], flojos: [] };
    }

    const { fuertes, flojos } = fuertesYFlojos(fila, iguales, puesto);

    return {
      ...base,
      muestraCorta: false,
      fuertes: fuertes.filter((f) => f.percentil >= PERCENTIL_FUERTE).slice(0, 3).map(rasgo),
      flojos: flojos.filter((f) => f.percentil <= PERCENTIL_FLOJO).slice(0, 3).map(rasgo),
    };
  });

  return {
    partidosDeLaCategoria: Math.max(0, ...actuales.map((j) => j.partidos)),
    perfiles,
  };
}

type FilaHoja = { JUGADOR?: unknown; "NOMBRE DEPORTIVO"?: unknown };

const texto = (v: unknown) => String(v ?? "").trim();

/** La hoja escribe muchos nombres en mayúsculas («CARLOS LAZO»): como los de Wyscout. */
const comoNombre = (t: string) =>
  t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s\-'.])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : t;

const nombresDe = (jugador: FilaHoja) =>
  [comoNombre(texto(jugador["NOMBRE DEPORTIVO"])), comoNombre(texto(jugador.JUGADOR))].filter(
    (nombre, i, todos) => nombre && todos.indexOf(nombre) === i,
  );

/*
| ¿Pueden ser la misma persona? `casaNombre` casa por apellido cuando hay un
| solo candidato con él, y eso en una plantilla no basta: el Antequera tiene a
| Samu, Iván y Fer Pérez y Wyscout sólo a Iván, así que los tres salían con los
| datos de Iván. Si los dos traen nombre de pila, la inicial tiene que ser la
| misma («J. Lazo» sí es Javier Lazo; «Carlos Abad» no es Javier Rentero).
*/
function mismaInicial(uno: string, otro: string) {
  const a = normalizePlayerName(uno).split(" ");
  const b = normalizePlayerName(otro).split(" ");

  if (a.length < 2 || b.length < 2) return true;

  return a[0].charAt(0) === b[0].charAt(0);
}

/**
 * En la pantalla: a cada ficha de la plantilla, su entrada de Wyscout.
 *
 * Se resuelve **la plantilla entera a la vez** y uno a uno, porque una entrada
 * de Wyscout es una persona: primero los nombres idénticos, luego por
 * apellido con la misma inicial, y si dos fichas siguen reclamando la misma
 * entrada no se le da a ninguna. Mejor una ficha sin datos que una con los de
 * su compañero.
 */
export function asignaPerfiles<T extends FilaHoja>(
  fichas: T[],
  perfiles: PerfilWyscout[],
  clave: (ficha: T) => string,
): Map<string, PerfilWyscout> {
  const asignados = new Map<string, PerfilWyscout>();

  if (!perfiles.length) return asignados;

  const usados = new Set<string>();

  /* 1. Idénticos, con el nombre deportivo o con el completo. */
  for (const ficha of fichas) {
    const nombres = nombresDe(ficha).map(normalizePlayerName);
    const exacto = perfiles.find((p) => !usados.has(p.jugador) && nombres.includes(normalizePlayerName(p.jugador)));

    if (exacto) {
      asignados.set(clave(ficha), exacto);
      usados.add(exacto.jugador);
    }
  }

  /* 2. Por apellido, entre los que quedan, y sólo si nadie más lo reclama. */
  const libres = perfiles.filter((p) => !usados.has(p.jugador));
  const reclamos = new Map<string, { ficha: T; perfil: PerfilWyscout }[]>();

  for (const ficha of fichas) {
    if (asignados.has(clave(ficha))) continue;

    let perfil: PerfilWyscout | null = null;

    for (const nombre of nombresDe(ficha)) {
      const candidato = casaNombre(nombre, libres, (p) => p.jugador);

      if (candidato && mismaInicial(nombre, candidato.jugador)) {
        perfil = candidato;
        break;
      }
    }

    if (perfil) reclamos.set(perfil.jugador, [...(reclamos.get(perfil.jugador) ?? []), { ficha, perfil }]);
  }

  for (const lista of reclamos.values()) {
    if (lista.length === 1) asignados.set(clave(lista[0].ficha), lista[0].perfil);
  }

  return asignados;
}
