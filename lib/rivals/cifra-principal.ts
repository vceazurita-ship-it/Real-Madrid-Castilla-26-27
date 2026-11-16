/**
 * UNA CIFRA POR MÉTRICA, CON SU PROVEEDOR (16/11/2026, ronda 16 de los jueces).
 *
 * El PPDA del Murcia salía 8,8 (Wyscout, en Plantillas), 10,2 (Opta, en el
 * Scout colectivo) y 10,8 (Opta, en el Plan de partido, que además decía «la
 * misma cifra de Plantillas rivales»). No eran errores sueltos: eran tres
 * cuentas.
 * - 8,8: Wyscout, media de sus PPDA partido a partido.
 * - 10,2: Opta, PPDA de la temporada = pases que deja dar / acciones
 *   defensivas, **cociente de las sumas** de la temporada (`opta:equipos`).
 * - 10,8: Opta, **media de los PPDA de cada partido** (la proyección del Plan
 *   trabaja partido a partido). La media de cocientes no es el cociente de la
 *   temporada: los partidos con pocas acciones defensivas pesan igual que los
 *   demás y la suben.
 *
 * **Quién manda**: la regla de la plataforma (`lib/fuentes.ts`): en xG, xG en
 * contra, remates y PPDA, **Opta**; la temporada es el cociente de las sumas.
 * Wyscout queda como «2.ª lectura», sólo en el detalle. Si Opta no tiene a ese
 * equipo, manda Wyscout y se dice. El puesto y la mediana, con la cuenta común
 * (`puestoEnLiga`) entre los equipos del grupo del proveedor que manda.
 *
 * La cuenta la hace `cifraEquipo` (`lib/cifras-equipo.ts`), que es la que ya
 * usan la portada y el informe; esto la deja lista para pintar en el área del
 * rival y para que la lea el Plan.
 */

import { cifraEquipo, type TablasOpta } from "@/lib/cifras-equipo";
import type { AspectoDestacado, FilaDestacada } from "@/lib/rivals/destacados-rival";
import { lecturaDePuesto, puestoEnLiga } from "@/lib/rivals/puesto-liga";

export type Proveedor = "Opta" | "Wyscout";

export type CifraPrincipal = {
  valor: number;
  proveedor: Proveedor;
  /** Partidos detrás de la cifra. */
  partidos: number | null;
  /** 1 = el mejor en el sentido de la métrica (en PPDA, el que más aprieta). */
  puesto: number | null;
  de: number | null;
  mediana: number | null;
  /** La del otro proveedor, para el detalle; nunca como cifra principal. */
  segunda: { valor: number; proveedor: Proveedor } | null;
};

/** Las magnitudes en las que manda Opta (claves de Wyscout de `METRICAS`). */
export const MANDA_OPTA = new Set(["ppda", "xg", "xgContra", "tiros", "tirosContra"]);

/** «PPDA» o «xG a favor por partido» → la clave de Wyscout (sólo las que tienen dos proveedores). */
export function claveConDosProveedores(nombre: string): string | null {
  if (/ppda/i.test(nombre)) return "ppda";

  return null;
}

/**
 * La cifra principal de un equipo en una magnitud con dos proveedores.
 *
 * `wyscout` es lo que ya trae la pantalla de Wyscout (valor, puesto, de,
 * mediana, partidos). Si Opta tiene la cifra, ésa manda y la de Wyscout pasa a
 * `segunda`; si no, la de Wyscout sale como principal y `segunda` es `null`.
 */
export function cifraPrincipal(
  clave: string,
  equipo: string,
  opciones: {
    opta?: TablasOpta | null;
    wyscout?: { valor: number; puesto?: number | null; de?: number | null; mediana?: number | null; partidos?: number | null } | null;
    mejorAlto?: boolean | null;
  } = {},
): CifraPrincipal | null {
  const w = opciones.wyscout ?? null;
  const deOpta = MANDA_OPTA.has(clave) && opciones.opta ? cifraEquipo(clave, equipo, { opta: opciones.opta, mejor: opciones.mejorAlto }) : null;

  if (deOpta && deOpta.fuente === "opta") {
    return {
      valor: deOpta.valor,
      proveedor: "Opta",
      partidos: deOpta.partidos,
      puesto: deOpta.puesto,
      de: deOpta.de,
      mediana: deOpta.mediana,
      segunda: w ? { valor: w.valor, proveedor: "Wyscout" } : null,
    };
  }

  if (!w) return null;

  return {
    valor: w.valor,
    proveedor: "Wyscout",
    partidos: w.partidos ?? null,
    puesto: w.puesto ?? null,
    de: w.de ?? null,
    mediana: w.mediana ?? null,
    segunda: null,
  };
}

export type FilaConProveedor = FilaDestacada & { proveedor: Proveedor; segunda: { valor: number; proveedor: Proveedor } | null };

export type AspectoConProveedor = Omit<AspectoDestacado, "filas"> & { filas: FilaConProveedor[] };

/**
 * Los aspectos de «Lo que le hace distinto» con la cifra que manda en cada
 * fila (PPDA de Opta si lo hay). Una cifra que con el proveedor bueno deja de
 * estar en el extremo (6 primeros o 6 últimos) deja de sostener el aspecto, y
 * un aspecto sin filas no sale. Lo usan /rivals y el Plan de partido.
 */
export function aspectosConCifraPrincipal(
  aspectos: AspectoDestacado[],
  equipo: string,
  opta: TablasOpta | null | undefined,
  equipos: number,
): AspectoConProveedor[] {
  return aspectos
    .map((a) => {
      const filas = a.filas
        .map((f): FilaConProveedor => {
          const clave = claveConDosProveedores(f.nombre);
          const c = clave ? cifraPrincipal(clave, equipo, { opta, wyscout: { valor: f.valor, puesto: f.puesto, de: f.de, mediana: f.mediana, partidos: f.partidos }, mejorAlto: false }) : null;

          if (!c || c.proveedor === "Wyscout") return { ...f, proveedor: "Wyscout", segunda: null };

          return {
            ...f,
            valor: c.valor,
            mediana: c.mediana ?? f.mediana,
            puesto: c.puesto ?? f.puesto,
            de: c.de ?? f.de,
            partidos: c.partidos ?? f.partidos,
            proveedor: "Opta",
            segunda: c.segunda,
          };
        })
        .filter(
          (f) =>
            f.proveedor === "Wyscout" ||
            lecturaDePuesto(f.puesto ?? 0, f.de ?? equipos, false) === (a.desviacion >= 0 ? "fuerte" : "flojo"),
        );

      return { ...a, filas };
    })
    .filter((a) => a.filas.length > 0);
}

/** Por si alguien sólo tiene la lista de valores (sin tablas de Opta): la misma cuenta. */
export { puestoEnLiga };
