/**
 * Fichajes que ya están en la plantilla pero todavía no en la hoja.
 *
 * La plantilla sale de la pestaña JUGADORES (`hooks/usePlayers`) y ésa es la
 * fuente buena: aquí no se duplica a nadie ni se mantiene una lista paralela.
 * Lo que pasa es que **dar de alta a un jugador desde la app no llega a esa
 * pestaña**: la acción `createPlayer` del Apps Script escribe en la hoja de
 * sesiones —la de disponibilidad por fecha— y la maestra la lleva a mano el
 * cuerpo técnico. Hasta que alguien escribe esa fila, el fichaje no existe
 * para el once, ni para la pizarra de ABP, ni para el coding.
 *
 * Esto es el puente para ese rato: el jugador aparece en toda la app desde el
 * primer día y **se retira solo** en cuanto la hoja lo trae, porque el cruce
 * es por nombre y la hoja siempre gana. Si algún día `createPlayer` escribe en
 * la maestra, este archivo se queda vacío y no hay nada que limpiar.
 *
 * Cómo se añade uno: la ficha de abajo, y la foto por
 * `scripts/crop-player-cutouts.mjs` + `lib/playerImages.ts` (ver el README de
 * las fotos). Cómo se quita: cuando esté en la hoja, borrar su entrada.
 */

import { getPlayerImage, getPlayerPhotoSrc, normalizePlayerName } from "@/lib/playerImages";
import type { Player } from "@/types/player";

type Ficha = {
  /** El `ID_JUGADOR` que devolvió el alta, para que las notas cuadren. */
  id: string;
  nombre: string;
  apodo: string;
  /** Como la escribe la hoja: `CENTRAL`, `LATERAL D.`, `6`, `PORTERO`… */
  posicion: string;
  licencia: string;
  dorsal?: number;
  /**
   * Otras grafías con que la hoja puede escribirlo. Si la hoja ya lo trae con
   * una de ellas, NO se añade otra ficha: se completa la de la hoja.
   */
  alias?: string[];
};

/*
| Vacío desde el 16/09/2026: la hoja ya trae a los dos que había aquí —Óscar
| Naasei (JUG-52) y Sergio Martínez (JUG-53)—, así que el puente ha hecho su
| trabajo y se retira, que es justo lo que dice el encabezado.
|
| Y no era inofensivo dejarlos: **la hoja escribe "Óscar Nassei"** y aquí
| estaba escrito "Óscar Naasei" —que es como lo escriben la foto, el recorte,
| el dorsal y el registro de Opta—. El cruce que evita duplicados es por
| nombre, dos eses contra dos aes no casan, y el jugador salía DOS VECES en
| todas las pantallas que leen la plantilla: el once, la pizarra, el coding,
| las valoraciones y el dashboard de seguimiento. Se vio al contar la plantilla
| del dashboard: quince jugadores de campo y dieciséis en la lista.
|
| Si algún día hay que volver a usar esto, el nombre tiene que ir **como lo
| escriba la hoja**, aunque esté mal escrito: es la hoja la que manda.
*/
const FICHAS: Ficha[] = [
  /*
  | Thiago Pitarch, 22/09/2026. Vuelve a la plantilla y la hoja JUGADORES
  | todavía no lo trae, así que entra por aquí para estar desde el primer día
  | en el once, la pizarra de ABP, el coding y el resto de la app.
  |
  | El ID es NUEVO a propósito. Su JUG-13 de la temporada pasada ya no es suyo:
  | la hoja renumeró y hoy ese ID es el de Diego Lacosta. JUG-54 no lo usa
  | nadie —la hoja llega a JUG-50 y en la de sesiones se llegaron a repartir el
  | 52 y el 53—, y de todas formas el cruce que evita duplicados es por nombre.
  |
  | Cuando alguien escriba su fila en la hoja, **el nombre de ahí manda**: si la
  | hoja lo escribe distinto, hay que copiar su grafía en `nombre` o saldrá dos
  | veces (pasó con Óscar Nassei el 16/09/2026).
  */
  {
    id: "JUG-54",
    nombre: "Thiago Pitarch",
    apodo: "Thiago",
    posicion: "10",
    licencia: "RMCF Castilla",
    /*
    | La hoja lo dio de alta el 26/09/2026 como «Thiago», JUG-51. Sin este
    | alias el cruce por nombre no lo reconocía y salían DOS Thiagos: el de la
    | hoja, con los seguimientos, y este, con el historial de la pizarra de ABP.
    */
    alias: ["Thiago"],
  },
  /*
  | Hugo de Llanos, 24/10/2026. Centrocampista del Castilla (ficha del club:
  | dorsal 8) que la hoja JUGADORES todavía no trae. Si la hoja lo da de alta,
  | el nombre de ahí manda: copiar su grafía aquí o saldrá dos veces.
  */
  {
    id: "JUG-55",
    nombre: "Hugo de Llanos",
    apodo: "Hugo",
    posicion: "8",
    licencia: "RMCF Castilla",
    dorsal: 8,
    alias: ["Hugo", "De Llanos", "Hugo Llanos"],
  },
  /*
  | Los cinco de la ficha del Castilla en BeSoccer que no estaban en la hoja
  | (26/10/2026). Dorsal, puesto y nombre de BeSoccer, que de Arroyo,
  | Santamaría y Pérez sólo publica la inicial: corregidlo aquí
  | o en la hoja, que gana.
  */
  {
    id: "JUG-56",
    nombre: "D. Arroyo",
    apodo: "Arroyo",
    posicion: "PORTERO",
    licencia: "RMCF Castilla",
    dorsal: 12,
    alias: ["Arroyo"],
  },
  {
    id: "JUG-57",
    nombre: "Jorge Rajado",
    apodo: "Rajado",
    posicion: "11",
    licencia: "RMCF Castilla",
    dorsal: 34,
    alias: ["J. Rajado"],
  },
  {
    id: "JUG-58",
    nombre: "José Luis Sáez Espinosa",
    apodo: "Espinosa",
    posicion: "LATERAL I",
    licencia: "RMCF Castilla",
    dorsal: 35,
    alias: ["J. Espinosa", "Jose Luis Espinosa"],
  },
  {
    id: "JUG-59",
    nombre: "F. Santamaría",
    apodo: "Santamaría",
    posicion: "9",
    licencia: "RMCF Castilla",
    dorsal: 38,
    alias: ["F. Santamaria", "Santamaria"],
  },
  {
    id: "JUG-60",
    nombre: "A. Pérez",
    apodo: "Pérez",
    posicion: "11",
    licencia: "RMCF Castilla",
    dorsal: 39,
    alias: [],
  },
];

/*
| Jugadores que cuentan como del Castilla aunque la hoja diga otra licencia.
| Izan Regueira (JUG-46) está en JUGADORES con licencia «RMC» y por eso
| `esCastilla` salía falso y desaparecía de valoraciones, seguimiento, pizarra
| y demás pantallas que sólo cuentan al Castilla. Mientras la hoja no lo corrija
| (LICENCIA = RMCF Castilla) se fuerza aquí. Nombres ya normalizados.
*/
const CASTILLA_FIJOS = new Set([
  "izan regueira",
  "izan",
  "hugo de llanos",
  "hugo llanos",
]);

/** La licencia efectiva: la de la hoja, salvo para los fijos del Castilla. */
export function licenciaDe(nombre: string, licencia?: string): string {
  if (CASTILLA_FIJOS.has(normalizePlayerName(nombre))) return "RMCF Castilla";
  return licencia || "RMCF Castilla";
}

/**
 * ¿Es del Castilla? Una sola regla para todas las pantallas (Dashboard
 * Plantilla, Individual…): licencia «RMCF Castilla» o sin licencia escrita.
 */
export function esDelCastilla(nombre: string, licencia?: string): boolean {
  return (licenciaDe(nombre, licencia).trim() || "RMCF Castilla") === "RMCF Castilla";
}

/**
 * IDs que ya no son de nadie y a quién corresponden hoy.
 *
 * Thiago Pitarch entró el 22/09 por el puente con JUG-54 y la hoja lo dio de
 * alta después como JUG-51. Lo guardado con el ID viejo —la memoria y las
 * fichas de la pizarra de ABP— se traduce al leer (`idVigente`), sin
 * reescribir nada: en cuanto alguien guarde, ya se guarda con el nuevo.
 */
export const IDS_ANTERIORES: Record<string, string> = {
  "JUG-54": "JUG-51",
  /* Óscar Nassei y Sergio Martínez: /individual los tenía como 52 y 53 y la
     hoja como 49 y 50 (comprobado en JUGADORES el 19/10/2026). Así los
     enlaces viejos siguen abriendo a su jugador. */
  "JUG-52": "JUG-49",
  "JUG-53": "JUG-50",
};

export const idVigente = (id: string) => IDS_ANTERIORES[id] ?? id;

/** Los fichajes convertidos en jugadores, con sus recortes. */
const PENDIENTES: Player[] = FICHAS.map((ficha) => ({
  id: ficha.id,
  nombre: ficha.nombre,
  apodo: ficha.apodo,
  posicion: ficha.posicion,
  dorsal: ficha.dorsal,
  foto: getPlayerPhotoSrc(ficha.nombre, { id: ficha.id, variant: "cerca" }),
  fotoLejos: getPlayerImage(ficha.nombre, "lejos", ficha.id) ?? undefined,
  licencia: ficha.licencia,
  esCastilla: ficha.licencia === "RMCF Castilla",
  estado: "ÓPTIMO",
  activo: true,
  hudl: "",
}));

/**
 * Añade a la lista de la hoja los fichajes que ella todavía no trae.
 *
 * El cruce es por nombre normalizado y no por ID a propósito: la hoja ha
 * renumerado los `ID_JUGADOR` alguna vez, y lo que se mueve con la persona es
 * el nombre. En cuanto aparece en la hoja —aunque sea con otro ID— deja de
 * añadirse, así que no hay forma de que salga dos veces.
 */
export function conFichajes(deLaHoja: Player[]): Player[] {
  deLaHoja = deLaHoja.map((jugador) => {
    const licencia = licenciaDe(jugador.nombre, jugador.licencia);

    return licencia === jugador.licencia && jugador.esCastilla
      ? jugador
      : { ...jugador, licencia, esCastilla: licencia === "RMCF Castilla" };
  });

  if (PENDIENTES.length === 0) return deLaHoja;

  const posicionEnLaHoja = new Map(
    deLaHoja.map((jugador, i) => [normalizePlayerName(jugador.nombre), i]),
  );

  const salida = [...deLaHoja];

  FICHAS.forEach((ficha, k) => {
    const pendiente = PENDIENTES[k];

    const i = [ficha.nombre, ...(ficha.alias ?? [])]
      .map((nombre) => posicionEnLaHoja.get(normalizePlayerName(nombre)))
      .find((x) => x !== undefined);

    if (i === undefined) {
      salida.push(pendiente);
      return;
    }

    /*
    | Ya está en la hoja, aunque sea con otra grafía: una sola ficha, con el
    | ID de la hoja —que es el que llevan los seguimientos—, y lo que la hoja
    | no sabe (el nombre completo, que es como lo escriben Wyscout y Hudl, y
    | la foto, que va por ese nombre) sale de aquí.
    */
    const suya = salida[i];
    const sinFoto = !suya.foto || /default|placeholder/i.test(suya.foto);

    salida[i] = {
      ...suya,
      nombre: ficha.nombre,
      apodo: suya.apodo && suya.apodo !== suya.nombre ? suya.apodo : ficha.apodo,
      foto: sinFoto ? pendiente.foto : suya.foto,
      fotoLejos: suya.fotoLejos ?? pendiente.fotoLejos,
    };
  });

  return salida;
}
