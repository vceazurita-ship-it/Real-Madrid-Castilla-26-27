import type { FilaJugador } from "@/lib/data-analisis/leer";
import { puestoDe } from "@/lib/data-analisis/individual";
import { mismoClub } from "@/lib/rivals/mismoClub";

/*
|--------------------------------------------------------------------------
| POR DÓNDE ATACA EL RIVAL (13/11/2026)
|--------------------------------------------------------------------------
|
| Reparte entre banda izquierda, centro y banda derecha sus centros, regates,
| pases al área y acciones progresivas de la temporada, y dice qué jugador
| carga cada banda. Sale de la descarga de jugadores de Wyscout (cifras por 90
| × minutos / 90 = acciones de la temporada).
|
| El lado lo da el puesto principal de Wyscout: laterales, carrileros y
| extremos con L/R delante van a su banda; el resto (centrales, mediocentros,
| mediapuntas, delanteros) al centro. Un «LCB» o un «LCMF» es un jugador de
| dentro aunque juegue a la izquierda. Los centros, cuando la descarga trae
| «Centros desde la banda izquierda/derecha», van al lado desde el que se
| centran de verdad, no al del puesto.
|
| Lo calcula el servidor (`/api/data-analisis?bandas=`): a la pantalla sólo le
| llegan los totales, nunca las filas de Wyscout.
*/

export type Banda = "izquierda" | "centro" | "derecha";

export const BANDAS: { key: Banda; label: string }[] = [
  { key: "izquierda", label: "Banda izquierda" },
  { key: "centro", label: "Centro" },
  { key: "derecha", label: "Banda derecha" },
];

export type TipoAccion = "centros" | "regates" | "pasesArea" | "progresivas";

export const TIPOS_ACCION: { key: TipoAccion; label: string; deQue: string }[] = [
  { key: "centros", label: "Centros", deQue: "de sus centros" },
  { key: "regates", label: "Regates", deQue: "de sus regates" },
  { key: "pasesArea", label: "Pases al área", deQue: "de sus pases al área" },
  { key: "progresivas", label: "Acciones progresivas", deQue: "de sus acciones progresivas" },
];

export type ParteBanda = {
  banda: Banda;
  /** Acciones de la temporada de esa banda, por tipo. */
  acciones: Record<TipoAccion, number>;
  /** Por tipo, el que más acciones tiene en esa banda y su parte sobre el TOTAL del equipo. */
  lider: Record<TipoAccion, { jugador: string; posicion: string; acciones: number } | null>;
};

export type PorDondeAtaca = {
  /** Acciones de todo el equipo, por tipo. */
  total: Record<TipoAccion, number>;
  bandas: ParteBanda[];
  /** Cuántos jugadores de campo con minutos entran en la cuenta. */
  contados: number;
  /** Todos los que entran, para casarlos con la plantilla de una vez (`asignaPerfiles`). */
  nombres: string[];
};

const cero = (): Record<TipoAccion, number> => ({ centros: 0, regates: 0, pasesArea: 0, progresivas: 0 });

/** Banda por el puesto principal de Wyscout. */
export function bandaDelPuesto(posicion: string): Banda {
  const sigla = posicion.split(",")[0].trim().toUpperCase();
  const puesto = puestoDe(sigla);

  if (puesto !== "LAT" && puesto !== "BAN") return "centro";

  if (sigla.startsWith("L")) return "izquierda";

  if (sigla.startsWith("R")) return "derecha";

  return "centro";
}

/** Del «por 90» de Wyscout al total de la temporada. */
const total = (fila: FilaJugador, columna: string) => {
  const v = fila.datos[columna];

  return typeof v === "number" && Number.isFinite(v) && v > 0 ? (v * fila.minutos) / 90 : 0;
};

const tiene = (fila: FilaJugador, columna: string) => typeof fila.datos[columna] === "number";

export function porDondeAtaca(jugadores: FilaJugador[], equipo: string): PorDondeAtaca {
  const suyos = jugadores.filter(
    (j) => j.temporada === "actual" && j.minutos > 0 && mismoClub(j.equipo, equipo) && puestoDe(j.posicion) !== "POR",
  );

  const totalEquipo = cero();
  const porBanda = new Map<Banda, Record<TipoAccion, number>>(BANDAS.map((b) => [b.key, cero()]));
  /* Lo de cada jugador en cada banda: los centros pueden repartirse entre dos. */
  const enBanda = new Map<Banda, Map<string, { fila: FilaJugador; acciones: Record<TipoAccion, number> }>>(
    BANDAS.map((b) => [b.key, new Map()]),
  );

  const suma = (banda: Banda, fila: FilaJugador, tipo: TipoAccion, valor: number) => {
    if (valor <= 0) return;

    porBanda.get(banda)![tipo] += valor;

    const mapa = enBanda.get(banda)!;
    const actual = mapa.get(fila.jugador) ?? { fila, acciones: cero() };

    actual.acciones[tipo] += valor;
    mapa.set(fila.jugador, actual);
  };

  const nombres: string[] = [];

  for (const fila of suyos) {
    const banda = bandaDelPuesto(fila.posicion);

    const acciones: Record<TipoAccion, number> = {
      centros: total(fila, "Centros/90"),
      regates: total(fila, "Regates/90"),
      pasesArea: total(fila, "Pases al área de penalti/90"),
      progresivas: total(fila, "Pases progresivos/90") + total(fila, "Carreras en progresión/90"),
    };

    for (const t of TIPOS_ACCION) totalEquipo[t.key] += acciones[t.key];

    /* Los centros, por el lado del que salen si la descarga lo trae. */
    if (tiene(fila, "Centros desde la banda izquierda/90") || tiene(fila, "Centros desde la banda derecha/90")) {
      const izq = Math.min(acciones.centros, total(fila, "Centros desde la banda izquierda/90"));
      const der = Math.min(acciones.centros - izq, total(fila, "Centros desde la banda derecha/90"));

      suma("izquierda", fila, "centros", izq);
      suma("derecha", fila, "centros", der);
      suma(banda, fila, "centros", acciones.centros - izq - der);
    } else {
      suma(banda, fila, "centros", acciones.centros);
    }

    suma(banda, fila, "regates", acciones.regates);
    suma(banda, fila, "pasesArea", acciones.pasesArea);
    suma(banda, fila, "progresivas", acciones.progresivas);

    nombres.push(fila.jugador);
  }

  const bandas: ParteBanda[] = BANDAS.map(({ key }) => {
    const lider = {} as ParteBanda["lider"];
    const mapa = [...enBanda.get(key)!.values()];

    for (const t of TIPOS_ACCION) {
      const mejor = [...mapa].sort((a, b) => b.acciones[t.key] - a.acciones[t.key])[0];

      lider[t.key] =
        mejor && mejor.acciones[t.key] >= 1
          ? {
              jugador: mejor.fila.jugador,
              posicion: mejor.fila.posicion.split(",")[0].trim(),
              acciones: Math.round(mejor.acciones[t.key]),
            }
          : null;
    }

    const acciones = cero();

    for (const t of TIPOS_ACCION) acciones[t.key] = Math.round(porBanda.get(key)![t.key]);

    return { banda: key, acciones, lider };
  });

  const redondeado = cero();

  for (const t of TIPOS_ACCION) redondeado[t.key] = Math.round(totalEquipo[t.key]);

  return { total: redondeado, bandas, contados: nombres.length, nombres };
}
