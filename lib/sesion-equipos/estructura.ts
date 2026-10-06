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
 */
import type { JugadorSesion, Puesto } from "@/lib/sesion-equipos/modelo";

/** Los dibujos más usados, de once a los espacios reducidos. El primer número es el portero. */
export const ESTRUCTURAS: { valor: string; rotulo: string }[] = [
  { valor: "1-4-3-3", rotulo: "1-4-3-3" },
  { valor: "1-4-2-3-1", rotulo: "1-4-2-3-1" },
  { valor: "1-4-4-2", rotulo: "1-4-4-2" },
  { valor: "1-3-5-2", rotulo: "1-3-5-2" },
  { valor: "1-3-4-3", rotulo: "1-3-4-3" },
  { valor: "1-5-3-2", rotulo: "1-5-3-2" },
  { valor: "1-4-3-2", rotulo: "1-4-3-2 (10)" },
  { valor: "1-3-3-2", rotulo: "1-3-3-2 (9)" },
  { valor: "1-3-3-1", rotulo: "1-3-3-1 (8)" },
  { valor: "1-3-2-1", rotulo: "1-3-2-1 (7)" },
  { valor: "1-2-3-1", rotulo: "1-2-3-1 (7)" },
  { valor: "1-2-2-1", rotulo: "1-2-2-1 (6)" },
  { valor: "1-2-1-1", rotulo: "1-2-1-1 (5)" },
  { valor: "1-2-1", rotulo: "1-2-1 (4)" },
  { valor: "3-3", rotulo: "3-3 (sin portero)" },
  { valor: "2-2", rotulo: "2-2 (sin portero)" },
];

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
  linea: number;
  jugador: JugadorSesion | null;
};

const ORDEN: (Puesto | undefined)[] = ["POR", "DEF", "MED", "EXT", "DEL", undefined];

/**
 * Coloca a los jugadores de un equipo en los huecos de su dibujo.
 *
 * Con `orden` (lo cambiado a mano) manda ese orden; los que no están en él
 * van detrás por puesto. Si sobran jugadores, quedan fuera del dibujo y se
 * dice; si faltan, el hueco queda vacío.
 */
export function colocaEnEstructura(
  jugadores: JugadorSesion[],
  estructura: string | undefined,
  puestoDe: (j: JugadorSesion) => Puesto | undefined,
  orden?: string[],
): { huecos: Hueco[]; sobran: JugadorSesion[] } {
  const lineas = lineasDe(estructura);
  if (!lineas.length) return { huecos: [], sobran: jugadores };

  const porPuesto = [...jugadores].sort((a, b) => ORDEN.indexOf(puestoDe(a)) - ORDEN.indexOf(puestoDe(b)));
  const total = lineas.reduce((s, n) => s + n, 0);

  /*
  | Con orden a mano, cada hueco es el que se dejó (un «» es un hueco vacío a
  | propósito). Quien entra después al equipo ocupa primero los huecos que no
  | se tocaron y, si no hay, queda fuera del dibujo.
  */
  let enOrden: (JugadorSesion | null)[];
  if (orden?.length) {
    const fijados = orden.slice(0, total).map((id) => (id ? jugadores.find((j) => j.id === id) ?? null : null));
    const puestos = new Set(fijados.filter(Boolean).map((j) => j!.id));
    const nuevos = porPuesto.filter((j) => !puestos.has(j.id));
    enOrden = Array.from({ length: total }, (_, i) => fijados[i] ?? (orden[i] ? nuevos.shift() ?? null : null));
    enOrden.push(...nuevos);
  } else {
    enOrden = porPuesto;
  }

  const huecos: Hueco[] = [];
  let k = 0;
  const L = lineas.length;

  lineas.forEach((n, linea) => {
    /* De atrás (abajo) adelante (arriba), con aire en los dos fondos. */
    const y = L === 1 ? 0.5 : 0.88 - (linea / (L - 1)) * 0.76;
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
      huecos.push({ x: (i + 1) / (n + 1), y, linea, jugador: deLaLinea[i] ?? null });
    }
  });

  return { huecos, sobran: enOrden.slice(k).filter((j): j is JugadorSesion => Boolean(j)) };
}

/** El orden de los huecos tras cambiar de sitio a dos jugadores (o a uno con un hueco vacío). */
export function intercambia(huecos: Hueco[], a: number, b: number): string[] {
  const ids = huecos.map((h) => h.jugador?.id ?? "");
  [ids[a], ids[b]] = [ids[b], ids[a]];
  /* Los huecos vacíos se guardan como «» para que el siguiente no se corra. */
  return ids;
}
