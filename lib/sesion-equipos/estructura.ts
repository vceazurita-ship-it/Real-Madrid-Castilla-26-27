/**
 * LA ESTRUCTURA DE CADA EQUIPO DE UNA TAREA (06/10/2026).
 *
 * Una tarea se puede hacer «sólo con equipos» —quién va con quién— o «con
 * estructura»: cada equipo con su dibujo (1-4-3-3, 1-3-2-1…) y sus jugadores
 * colocados en un mini campograma. Se colocan solos por puesto (portero
 * atrás, luego defensas, medios, extremos y delanteros; los extremos a las
 * bandas de su línea) y se cambian de sitio tocando a dos.
 *
 * El orden a mano se guarda en el equipo (`orden`: ids de jugador por hueco),
 * así que sobrevive a recargar y viaja con «Duplicar» y «Como la anterior».
 *
 * COLOCAR A MANO (07/10/2026): además, cada hueco puede llevar su punto exacto
 * del campo (`posiciones`, mismo índice que `orden`). Soltar a un jugador en
 * el césped lo deja ahí; y si el dibujo ya está lleno, se le abre un hueco
 * nuevo en ese punto en vez de echar a nadie. Así se dibuja cualquier
 * estructura, por rara que sea, sin tener que escribirla.
 */
import type { JugadorSesion, Puesto } from "@/lib/sesion-equipos/modelo";

/** Un punto del campo en tanto por uno: x de izquierda a derecha, y de la portería contraria (0) a la suya (1). */
export type Punto = { x: number; y: number };

/** Los dibujos de la lista. El primer número es el portero; sin portero, todos son de campo. */
const DIBUJOS: string[] = [
  /* 11 */
  "1-4-3-3", "1-4-2-3-1", "1-4-4-2", "1-4-1-4-1", "1-4-3-1-2", "1-4-4-1-1", "1-4-1-2-1-2", "1-4-2-2-2", "1-4-3-2-1", "1-4-2-4",
  "1-3-5-2", "1-3-4-3", "1-3-4-1-2", "1-3-4-2-1", "1-3-1-4-2", "1-3-3-3-1", "1-5-3-2", "1-5-4-1", "1-5-2-3",
  /* 10 */
  "1-4-3-2", "1-4-4-1", "1-3-4-2", "1-3-3-3", "1-4-2-3", "1-4-1-3-1", "1-3-3-2-1", "1-5-3-1",
  /* 9 */
  "1-3-3-2", "1-3-4-1", "1-4-3-1", "1-3-2-3", "1-2-4-2", "1-3-1-3-1", "1-4-2-2", "1-3-2-2-1",
  /* 8 */
  "1-3-3-1", "1-3-2-2", "1-2-3-2", "1-4-2-1", "1-3-1-3", "1-2-4-1", "1-3-1-2-1", "1-4-3",
  /* 7 */
  "1-3-2-1", "1-2-3-1", "1-3-1-2", "1-2-1-2-1", "1-2-2-2", "1-4-1-1", "1-3-3", "1-1-3-2",
  /* 6 */
  "1-2-2-1", "1-3-1-1", "1-2-1-2", "1-3-2", "1-1-3-1", "1-2-3",
  /* 5 */
  "1-2-1-1", "1-2-2", "1-1-2-1", "1-3-1", "1-1-1-2",
  /* 4 */
  "1-2-1", "1-1-2", "1-3", "1-1-1-1",
  /* sin portero */
  "4-3-3", "4-4-2", "3-4-3", "3-3-3", "4-3-2", "3-4-2", "3-3-2", "4-3-1", "3-2-3", "3-3-1", "2-3-2", "3-2-2",
  "3-2-1", "2-3-1", "2-2-2", "3-3", "2-1-2", "2-2-1", "2-3", "3-2", "2-2", "2-1-1", "1-2-1", "2-1", "1-2",
];

/** Lo que suma un dibujo: el número de jugadores que pide. */
export const jugadoresDe = (estructura: string | undefined) => lineasDe(estructura).reduce((s, n) => s + n, 0);

/** Lleva portero: empieza por una línea de uno y tiene más de una línea. */
export const conPortero = (estructura: string | undefined) => {
  const l = lineasDe(estructura);
  return l.length > 1 && l[0] === 1;
};

/** La lista de dibujos (sin repetidos), con su rótulo. Se mantiene por compatibilidad. */
export const ESTRUCTURAS: { valor: string; rotulo: string; jugadores: number; portero: boolean }[] = [
  ...new Set(DIBUJOS),
].map((valor) => ({ valor, rotulo: valor, jugadores: jugadoresDe(valor), portero: conPortero(valor) }));

/**
 * Los dibujos agrupados para el desplegable: primero los que encajan con los
 * jugadores que tiene el equipo, luego por tamaño (de once a los reducidos) y
 * al final los que van sin portero.
 */
export function gruposDeEstructuras(jugadores: number) {
  const conPor = ESTRUCTURAS.filter((e) => e.portero);
  const sinPor = ESTRUCTURAS.filter((e) => !e.portero);
  const tamanos = [...new Set(conPor.map((e) => e.jugadores))].sort((a, b) => b - a);

  const grupos: { rotulo: string; opciones: typeof ESTRUCTURAS }[] = [];

  const encajan = ESTRUCTURAS.filter((e) => e.jugadores === jugadores);
  if (jugadores > 0 && encajan.length) grupos.push({ rotulo: `Para ${jugadores} (los que tiene)`, opciones: encajan });

  for (const n of tamanos) {
    if (n === jugadores) continue;
    grupos.push({ rotulo: `${n} jugadores`, opciones: conPor.filter((e) => e.jugadores === n) });
  }

  grupos.push({ rotulo: "Sin portero", opciones: sinPor.filter((e) => e.jugadores !== jugadores) });

  return grupos.filter((g) => g.opciones.length);
}

/** «1-4-3-3» → [1, 4, 3, 3]. Acepta «1·4·3·3», «1 4 3 3» o «433» (una cifra por línea). */
export function lineasDe(estructura: string | undefined): number[] {
  const t = (estructura ?? "").trim();
  if (!t) return [];
  const partes = /[^\d]/.test(t) ? t.split(/[^\d]+/) : t.split("");
  return partes.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0 && n <= 7);
}

/** «1-4-3-3» bien escrito, o «» si no se entiende. */
export const normalizaEstructura = (estructura: string) => lineasDe(estructura).join("-");

/** El dibujo que más se parece al número de jugadores del equipo. */
export function estructuraPara(jugadores: number) {
  const porTamano: Record<number, string> = {
    11: "1-4-3-3",
    10: "1-4-3-2",
    9: "1-3-3-2",
    8: "1-3-3-1",
    7: "1-3-2-1",
    6: "1-2-2-1",
    5: "1-2-1-1",
    4: "1-2-1",
  };
  if (jugadores >= 11) return "1-4-3-3";
  return porTamano[jugadores] ?? "1-2-1";
}

export type Hueco = {
  /** En tanto por uno del campo vertical: x de izquierda a derecha, y de su portería (abajo, 1) a la contraria (arriba, 0). */
  x: number;
  y: number;
  /** La línea del dibujo; -1 en un hueco abierto a mano fuera del dibujo. */
  linea: number;
  jugador: JugadorSesion | null;
  /** El punto lo puso alguien a mano: se guarda y se respeta. */
  aMano?: boolean;
  /** Comparte el puesto con el jugador del hueco (08/10/2026): se turnan o hacen el puesto a la vez. */
  pareja?: JugadorSesion | null;
};

/**
 * Las parejas válidas de un equipo (08/10/2026): titular → compañero, los dos
 * en el equipo, sin cadenas (un compañero no puede tener a su vez compañero).
 */
export function parejasDe(jugadores: JugadorSesion[], pares?: Record<string, string>) {
  const companeros = new Map<string, JugadorSesion>();
  if (!pares) return companeros;

  const usados = new Set<string>();
  for (const [titular, companero] of Object.entries(pares)) {
    if (!companero || titular === companero || usados.has(titular) || usados.has(companero)) continue;
    const t = jugadores.find((j) => j.id === titular);
    const c = jugadores.find((j) => j.id === companero);
    if (!t || !c) continue;
    companeros.set(titular, c);
    usados.add(titular);
    usados.add(companero);
  }
  return companeros;
}

const ORDEN: (Puesto | undefined)[] = ["POR", "DEF", "MED", "EXT", "DEL", undefined];

/** Un punto guardado que se puede creer. */
const puntoValido = (p: Punto | null | undefined): p is Punto =>
  Boolean(p) && Number.isFinite(p!.x) && Number.isFinite(p!.y) && p!.x >= 0 && p!.x <= 1 && p!.y >= 0 && p!.y <= 1;

/**
 * SIN PORTEROS EN EL CAMPO (07/10/2026). El campograma dibuja sólo a los de
 * campo: los porteros del equipo se nombran aparte (`porteros`) y la línea
 * del portero de la estructura («1-» de «1-4-3-3») no se pinta. El dibujo se
 * sigue escribiendo entero, como se dice en el campo.
 *
 * Lo guardado conserva su forma: el índice 0 de `orden`/`posiciones` es el
 * hueco del portero cuando la estructura lo lleva (así lo guardado antes sigue
 * valiendo) y `paraGuardar` lo pone delante al escribir.
 */
export function colocaEnEstructura(
  jugadores: JugadorSesion[],
  estructura: string | undefined,
  puestoDe: (j: JugadorSesion) => Puesto | undefined,
  orden?: string[],
  posiciones?: (Punto | null)[],
  pares?: Record<string, string>,
): { huecos: Hueco[]; sobran: JugadorSesion[]; porteros: JugadorSesion[]; parejas: Map<string, JugadorSesion> } {
  const lleva = conPortero(estructura);

  /* El compañero no ocupa hueco: va en el de su titular. */
  const parejas = parejasDe(jugadores, pares);
  const ocultos = new Set([...parejas.values()].map((j) => j.id));
  const visibles = jugadores.filter((j) => !ocultos.has(j.id));

  const porteros = visibles.filter((j) => puestoDe(j) === "POR");
  const deCampo = visibles.filter((j) => puestoDe(j) !== "POR");
  const lineas = lleva ? lineasDe(estructura).slice(1).join("-") : estructura;

  const r = colocaDeCampo(deCampo, lineas, puestoDe, lleva ? orden?.slice(1) : orden, lleva ? posiciones?.slice(1) : posiciones);

  const huecos = r.huecos.map((h) => (h.jugador && parejas.has(h.jugador.id) ? { ...h, pareja: parejas.get(h.jugador.id) } : h));

  /* Un titular fuera del dibujo (o portero) arrastra a su compañero con él. */
  const conSuPareja = (lista: JugadorSesion[]) => lista.flatMap((j) => (parejas.has(j.id) ? [j, parejas.get(j.id)!] : [j]));

  return { huecos, sobran: conSuPareja(r.sobran), porteros: conSuPareja(porteros), parejas };
}

/** Lo que se guarda, con el hueco del portero delante si la estructura lo lleva. */
export function paraGuardar(estructura: string | undefined, guardado: { orden: string[]; posiciones?: (Punto | null)[] }) {
  if (!conPortero(estructura)) return guardado;
  return {
    orden: ["", ...guardado.orden],
    posiciones: guardado.posiciones ? [null, ...guardado.posiciones] : undefined,
  };
}

/** Los huecos de campo de un dibujo: lo que pide sin contar al portero. */
export const huecosDeCampo = (estructura: string | undefined) => jugadoresDe(estructura) - (conPortero(estructura) ? 1 : 0);

/**
 * Coloca a los jugadores de un equipo en los huecos de su dibujo.
 *
 * Con `orden` (lo cambiado a mano) manda ese orden; los que no están en él
 * van detrás por puesto. Si sobran jugadores, quedan fuera del dibujo y se
 * dice —salvo que tengan un punto puesto a mano: entonces son un hueco más—;
 * si faltan, el hueco queda vacío.
 */
function colocaDeCampo(
  jugadores: JugadorSesion[],
  estructura: string | undefined,
  puestoDe: (j: JugadorSesion) => Puesto | undefined,
  orden?: string[],
  posiciones?: (Punto | null)[],
): { huecos: Hueco[]; sobran: JugadorSesion[] } {
  const lineas = lineasDe(estructura);
  if (!lineas.length) return { huecos: [], sobran: jugadores };

  const porPuesto = [...jugadores].sort((a, b) => ORDEN.indexOf(puestoDe(a)) - ORDEN.indexOf(puestoDe(b)));
  const total = lineas.reduce((s, n) => s + n, 0);

  /*
  | Con orden a mano, cada hueco es el que se dejó (un «» es un hueco vacío a
  | propósito). Quien entra después al equipo ocupa primero los huecos que no
  | se tocaron y, si no hay, queda fuera del dibujo. Lo que hay en `orden`
  | más allá del dibujo son los huecos abiertos a mano.
  */
  let enOrden: (JugadorSesion | null)[];
  if (orden?.length) {
    const fijados = orden.map((id) => (id ? jugadores.find((j) => j.id === id) ?? null : null));
    const puestos = new Set(fijados.filter(Boolean).map((j) => j!.id));
    const nuevos = porPuesto.filter((j) => !puestos.has(j.id));
    enOrden = Array.from({ length: total }, (_, i) => fijados[i] ?? (orden[i] ? nuevos.shift() ?? null : null));
    for (let i = total; i < fijados.length; i += 1) enOrden.push(fijados[i]);
    enOrden.push(...nuevos);
  } else {
    enOrden = porPuesto;
  }

  const huecos: Hueco[] = [];
  let k = 0;
  const L = lineas.length;

  lineas.forEach((n, linea) => {
    /* De atrás (abajo) adelante (arriba), con aire en los dos fondos. */
    const y = L === 1 ? 0.5 : 0.84 - (linea / (L - 1)) * 0.7;
    let deLaLinea = enOrden.slice(k, k + n);
    k += n;

    /* Sin orden a mano, los extremos a las bandas de su línea. */
    if (!orden?.length && n >= 3) {
      const ext = deLaLinea.filter((j) => j && puestoDe(j) === "EXT");
      if (ext.length) {
        const resto = deLaLinea.filter((j) => !j || puestoDe(j) !== "EXT");
        deLaLinea = [ext[0], ...resto, ...ext.slice(1)];
      }
    }

    for (let i = 0; i < n; i += 1) {
      const indice = huecos.length;
      const fijo = posiciones?.[indice];
      huecos.push(
        puntoValido(fijo)
          ? { x: fijo.x, y: fijo.y, linea, jugador: deLaLinea[i] ?? null, aMano: true }
          : { x: (i + 1) / (n + 1), y, linea, jugador: deLaLinea[i] ?? null },
      );
    }
  });

  /* Fuera del dibujo: con su punto a mano son un hueco más; sin él, sobran. */
  const sobran: JugadorSesion[] = [];
  for (let i = total; i < enOrden.length; i += 1) {
    const j = enOrden[i];
    if (!j) continue;
    const fijo = posiciones?.[i];
    if (puntoValido(fijo) && orden && i < orden.length) huecos.push({ x: fijo.x, y: fijo.y, linea: -1, jugador: j, aMano: true });
    else sobran.push(j);
  }

  return { huecos, sobran };
}

/** Lo que se guarda de unos huecos: quién está en cada uno y su punto si es a mano. */
export function guardaHuecos(huecos: Hueco[]): { orden: string[]; posiciones?: (Punto | null)[] } {
  const orden = huecos.map((h) => h.jugador?.id ?? "");
  const posiciones = huecos.map((h) => (h.aMano ? { x: redondea(h.x), y: redondea(h.y) } : null));
  return posiciones.some(Boolean) ? { orden, posiciones } : { orden };
}

const redondea = (n: number) => Math.round(n * 1000) / 1000;

/** El orden de los huecos tras cambiar de sitio a dos jugadores (o a uno con un hueco vacío). */
export function intercambia(huecos: Hueco[], a: number, b: number) {
  const nuevos = huecos.map((h) => ({ ...h }));
  [nuevos[a].jugador, nuevos[b].jugador] = [nuevos[b].jugador, nuevos[a].jugador];
  /* Los huecos vacíos se guardan como «» para que el siguiente no se corra. */
  return guardaHuecos(nuevos);
}

/**
 * Deja a un jugador en un punto del campo (07/10/2026).
 *
 * Si ya estaba en el dibujo, su hueco se mueve a ese punto; si viene de fuera,
 * ocupa el primer hueco vacío —que se lleva al punto— y, si no queda ninguno,
 * se abre uno nuevo ahí.
 */
export function colocaEnPunto(huecos: Hueco[], jugador: JugadorSesion, punto: Punto) {
  const nuevos = huecos.map((h) => ({ ...h }));
  const p = { x: Math.min(0.96, Math.max(0.04, punto.x)), y: Math.min(0.97, Math.max(0.03, punto.y)) };

  let i = nuevos.findIndex((h) => h.jugador?.id === jugador.id);
  if (i < 0) i = nuevos.findIndex((h) => !h.jugador);
  if (i < 0) {
    nuevos.push({ ...p, linea: -1, jugador, aMano: true });
  } else {
    nuevos[i] = { ...nuevos[i], ...p, jugador, aMano: true };
  }

  return guardaHuecos(nuevos);
}

/** Saca al jugador del sitio que ocupaba en el campo (deja el hueco vacío). */
export function quitaDeHuecos(huecos: Hueco[], jugadorId: string) {
  return guardaHuecos(huecos.map((h) => (h.jugador?.id === jugadorId ? { ...h, jugador: null } : h)));
}
