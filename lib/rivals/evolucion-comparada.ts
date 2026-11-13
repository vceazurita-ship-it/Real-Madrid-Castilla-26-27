/**
 * EVOLUCIÓN COMPARADA (13/11/2026): el xG a favor y en contra por partido del
 * Castilla y del rival, como media acumulada hasta cada jornada, y la media de
 * su grupo como referencia. Sobre `opta:partidos` (equipo × partido).
 *
 * LA JORNADA, como en `lib/opta-evolucion.ts`: «jornada k» de un equipo es su
 * k-ésimo partido por fecha (Opta no trae el número). La media de la liga en la
 * jornada k es la media de la media acumulada de cada equipo del grupo que ha
 * jugado k partidos.
 *
 * EL xG EN CONTRA: la columna `ExpGAg` de su fila; si no viene, el `ExpG` del
 * rival en ese mismo partido (es la misma cifra).
 */

import { num } from "@/lib/opta";
import { partidosPorEquipo } from "@/lib/opta-evolucion";
import type { Fila, PartidoEquipo } from "@/lib/opta-analisis";

export type LadoXg = "favor" | "contra";

export type PuntoComparado = { jornada: number; castilla: number | null; rival: number | null; liga: number | null };

export type SerieComparada = {
  lado: LadoXg;
  puntos: PuntoComparado[];
  /** Partidos con dato de cada uno. */
  partidosCastilla: number;
  partidosRival: number;
};

function xgDe(p: PartidoEquipo, lado: LadoXg): number | null {
  if (lado === "favor") return num(p.fila.ExpG);
  return num(p.fila.ExpGAg) ?? (p.otra ? num(p.otra.ExpG) : null);
}

/** La media hasta cada partido (los huecos no cuentan, pero el punto sigue). */
function acumulada(suyos: PartidoEquipo[], lado: LadoXg): (number | null)[] {
  let suma = 0;
  let n = 0;
  return suyos.map((p) => {
    const v = xgDe(p, lado);
    if (v != null && Number.isFinite(v)) {
      suma += v;
      n++;
    }
    return n ? suma / n : null;
  });
}

/**
 * Las dos series (xG a favor y en contra) para el Castilla y el rival.
 * `grupo` son los teamId de la liga de referencia (el grupo del Castilla).
 */
export function evolucionComparada(partidos: Fila[], castillaId: string, rivalId: string, grupo: Set<string>): SerieComparada[] {
  const porEquipo = partidosPorEquipo(partidos);
  const nuestros = porEquipo.get(castillaId) ?? [];
  const suyos = porEquipo.get(rivalId) ?? [];
  const jornadas = Math.max(nuestros.length, suyos.length);

  return (["favor", "contra"] as const).map((lado) => {
    const c = acumulada(nuestros, lado);
    const r = acumulada(suyos, lado);
    const ligaPorEquipo = [...grupo].map((id) => acumulada(porEquipo.get(id) ?? [], lado));

    const puntos: PuntoComparado[] = Array.from({ length: jornadas }, (_, k) => {
      const vs = ligaPorEquipo.map((serie) => serie[k]).filter((v): v is number => v != null);
      return {
        jornada: k + 1,
        castilla: c[k] ?? null,
        rival: r[k] ?? null,
        liga: vs.length ? vs.reduce((s, x) => s + x, 0) / vs.length : null,
      };
    });

    return {
      lado,
      puntos,
      partidosCastilla: nuestros.filter((p) => xgDe(p, lado) != null).length,
      partidosRival: suyos.filter((p) => xgDe(p, lado) != null).length,
    };
  });
}

/** El último valor con dato de una línea. */
export function ultimoDe(puntos: PuntoComparado[], k: "castilla" | "rival" | "liga"): { jornada: number; valor: number } | null {
  for (let i = puntos.length - 1; i >= 0; i--) {
    const v = puntos[i][k];
    if (v != null) return { jornada: puntos[i].jornada, valor: v };
  }
  return null;
}

/**
 * Hacia dónde va: la media acumulada de ahora contra la de hace `atras`
 * partidos suyos. «sube» / «baja» si se mueve al menos 0,1 xG.
 */
export function tendencia(puntos: PuntoComparado[], k: "castilla" | "rival", atras = 3): "sube" | "baja" | "igual" | null {
  const conDato = puntos.map((p) => p[k]).filter((v): v is number => v != null);
  if (conDato.length <= atras) return null;
  const dif = conDato[conDato.length - 1] - conDato[conDato.length - 1 - atras];
  return dif >= 0.1 ? "sube" : dif <= -0.1 ? "baja" : "igual";
}
