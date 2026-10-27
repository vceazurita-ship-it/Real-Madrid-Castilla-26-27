/**
 * QUIÉN MARCA A QUIÉN EN EL CÓRNER DEFENSIVO (27/10/2026).
 *
 * Una propuesta, no una orden: cruza su once (el marcado en Plantillas
 * rivales o su último de BeSoccer) con lo que se sabe de cada uno por arriba
 * —remates de ABP en nuestras hojas y en su scouting, la etiqueta «rematador
 * de ABP», la altura y los duelos aéreos de Wyscout— y nuestro once por su
 * valor defendiendo por arriba. El más peligroso de ellos, para el mejor de
 * los nuestros; y así hacia abajo.
 *
 * Por qué el puesto pesa tanto (27/10, Cartagena): con Wyscout solo, Fortea
 * (lateral, 62 % aéreos en ocho duelos) salía por delante de Lamini (central).
 * Un porcentaje con pocos duelos no dice nada y a muchos de los nuestros les
 * falta la altura en Wyscout; el central sí sabe defender el área. Así que:
 * el puesto marca la base, el % aéreo se acerca al 50 % cuantos menos duelos
 * tenga detrás, y la altura suma sólo si se sabe.
 *
 * Aquí sólo hay cuentas: quien llama trae los datos.
 */

export type Atacante = {
  clave: string;
  nombre: string;
  dorsal: string;
  posicion: string;
  altura: number | null;
  aereoPct: number | null;
  aereos90: number | null;
  /** Duelos aéreos que hay detrás del %. */
  duelos: number | null;
  /** Remates a balón parado registrados (nuestras hojas + su scouting). */
  remates: number;
  remataAbp: boolean;
};

export type Marcador = {
  playerId: string;
  nombre: string;
  /** POR, CEN, LAT, MED, BAN o DEL (`sitioDe`). */
  rol: string;
  /** Lo que se enseña: la posición de Wyscout o la de la hoja. */
  posicion: string;
  altura: number | null;
  aereoPct: number | null;
  aereos90: number | null;
  duelos: number | null;
  /** Está en el once de la semana. */
  titular: boolean;
};

export type Emparejamiento = {
  /** Clave del puesto de marca de la diapositiva (M1…M7). */
  puesto: string;
  marcador: Marcador | null;
  atacante: Atacante | null;
};

const PORTERO = /portero|^po?r?$|^gk$/i;

/** El % aéreo con pocos duelos detrás se acerca al 50 %: ocho duelos no son un dato. */
export function aereoFiable(pct: number | null, duelos: number | null) {
  if (pct == null) return null;

  const n = Math.max(0, duelos ?? 0);

  return (pct * n + 50 * 12) / (n + 12);
}

/** Lo que pesa un rematador: lo que ha hecho primero, lo que mide después. */
export function peligro(a: Atacante) {
  return (
    a.remates * 3 +
    (a.remataAbp ? 5 : 0) +
    Math.max(0, ((a.altura ?? 178) - 175) / 3) +
    ((aereoFiable(a.aereoPct, a.duelos) ?? 50) - 50) / 6 +
    Math.min(a.aereos90 ?? 0, 6) / 2
  );
}

const BASE_ROL: Record<string, number> = { CEN: 6, MED: 3, DEL: 2, LAT: 1, BAN: 0, POR: -99 };

/** Lo que vale uno de los nuestros para defender por arriba. */
export function poderAereo(m: Marcador) {
  return (
    (BASE_ROL[m.rol] ?? 1) +
    (m.altura ? (m.altura - 178) / 2.5 : 0) +
    ((aereoFiable(m.aereoPct, m.duelos) ?? 50) - 50) / 8 +
    Math.min(m.aereos90 ?? 0, 6) / 2
  );
}

const metros = (cm: number | null) => (cm ? `${(cm / 100).toFixed(2).replace(".", ",")} m` : "");

const aereos = (pct: number | null, duelos: number | null) =>
  pct != null && duelos ? `${Math.round(pct)} % aéreos (${Math.round(duelos)})` : "";

export function motivoAtacante(a: Atacante) {
  return [
    metros(a.altura),
    a.remates ? `${a.remates} ${a.remates === 1 ? "remate" : "remates"} ABP` : a.remataAbp ? "rematador de ABP" : "",
    aereos(a.aereoPct, a.duelos),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function motivoMarcador(m: Marcador) {
  return [m.posicion, metros(m.altura), aereos(m.aereoPct, m.duelos)].filter(Boolean).join(" · ");
}

/** Sus jugadores de campo, del más peligroso al menos. */
export const ordenaAtacantes = (atacantes: Atacante[]) =>
  atacantes.filter((a) => !PORTERO.test(a.posicion.trim())).sort((a, b) => peligro(b) - peligro(a));

/** Los nuestros de campo, del mejor por arriba al peor. */
export const ordenaMarcadores = (marcadores: Marcador[]) =>
  marcadores.filter((m) => m.rol !== "POR" && !PORTERO.test(m.posicion)).sort((a, b) => poderAereo(b) - poderAereo(a));

/**
 * La propuesta para los huecos de marca. Los que ya están puestos en una
 * marca se respetan; los huecos libres se llenan con los titulares mejores por
 * arriba que no estén ya en otro sitio de la diapositiva. Luego, por orden: su
 * más peligroso, para nuestro mejor.
 */
export function proponMarcas(opciones: {
  puestos: string[];
  /** Puesto → jugador que ya está en esa marca. */
  yaPuestos: Map<string, string>;
  /** Jugadores en otros puestos de la diapositiva (corta, balón, fuera). */
  ocupados: Set<string>;
  plantel: Marcador[];
  atacantes: Atacante[];
}): Emparejamiento[] {
  const porId = new Map(opciones.plantel.map((m) => [m.playerId, m]));
  const fijos = new Set(opciones.yaPuestos.values());

  const libres = ordenaMarcadores(opciones.plantel.filter((m) => m.titular && !fijos.has(m.playerId) && !opciones.ocupados.has(m.playerId)));

  const quien = new Map<string, Marcador | null>();

  for (const puesto of opciones.puestos) {
    const ya = opciones.yaPuestos.get(puesto);

    quien.set(puesto, ya ? (porId.get(ya) ?? null) : (libres.shift() ?? null));
  }

  /* Los marcadores, del mejor al peor, reciben a sus atacantes por orden. */
  const conMarcador = ordenaMarcadores([...quien.values()].filter((m): m is Marcador => m !== null));
  const suyos = ordenaAtacantes(opciones.atacantes);
  const atacanteDe = new Map(conMarcador.map((m, i) => [m.playerId, suyos[i] ?? null]));

  return opciones.puestos.map((puesto) => {
    const marcador = quien.get(puesto) ?? null;

    return { puesto, marcador, atacante: marcador ? (atacanteDe.get(marcador.playerId) ?? null) : null };
  });
}
