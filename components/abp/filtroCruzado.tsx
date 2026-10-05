"use client";

/*
| Filtro cruzado de las dos páginas de ABP (`/setpieces` y `/setpieces_def`).
|
| Lo pidió el cuerpo técnico: «todo lo que se pinche sirva como filtro». Cada
| página declara sus dimensiones —qué se puede filtrar, con qué estado y cómo
| se compara una fila con el valor elegido— y de aquí salen tres cosas:
|
| - `filtraFilas`, que filtra con todas menos las que se le digan. Un gráfico
|   de la zona de caída se pinta con todo filtrado **salvo** la zona de caída:
|   así la zona elegida sale resaltada y las demás atenuadas, en vez de
|   quedarse el gráfico en una sola barra.
| - `marca`, el aspecto de una barra o un sector: oro y opaco si es el
|   elegido, apagado si hay otro elegido.
| - `BarraFiltros`, la tira de «Filtrando: …» de arriba, con su ✕ en cada uno.
|
| Los estados siguen siendo los de siempre de cada página (los del cajón de
| filtros), así que el cajón y los clics no se pueden desincronizar.
*/

import type { ReactNode } from "react";
import { BarraFiltros as BarraComun, ESTILO_ELEGIDO, PastillaPretemporada } from "@/components/filtros/BarraFiltros";

export const ORO = "#C8A96B";
export const TODO = "ALL";
export const PULSA = "Pulsa para filtrar";

/*
| La pretemporada fuera por defecto.
|
| Un córner de un amistoso de julio contra un juvenil no es la misma muestra
| que uno de liga, y sumados los amistosos pesaban dos tercios de todo. Por
| defecto el filtro de competición deja fuera la pretemporada (no la copa);
| se incluye con un clic.
*/
export const SIN_PRETEMPORADA = "SIN_PRE";

export type Dimension<T> = {
  clave: string;
  etiqueta: string;
  valor: string;
  poner: (valor: string) => void;
  coincide: (fila: T, valor: string) => boolean;
  /** Cómo se lee el valor en la tira («liga:1» → «Jornada 1»). */
  texto?: (valor: string) => string;
  /** El valor de reposo, cuando no es «ALL» (la competición). */
  porDefecto?: string;
  /** Si el rótulo de un gráfico es el valor elegido, cuando no basta «===». */
  rotuloCoincide?: (rotulo: string, valor: string) => boolean;
};

/**
 * Manejador de clic de un gráfico cartesiano entero (barras y líneas): pulsar
 * en cualquier punto de la columna elige esa categoría, no sólo encima de la
 * barra, que en el móvil es muy fina. Va en el gráfico y no en cada `Bar`
 * para que un gráfico con dos series no alterne dos veces.
 */
export function pulsaIndice<D>(datos: D[], elige: (dato: D) => void) {
  return (
    estado: { activeTooltipIndex?: unknown; isTooltipActive?: unknown } | null,
  ) => {
    /* Fuera del área del gráfico (el eje, el margen) recharts manda
       `activeTooltipIndex: null`, y `Number(null)` es 0: elegía la primera
       barra en vez de no hacer nada. */
    const indice = estado?.activeTooltipIndex;

    if (indice === null || indice === undefined || indice === "") return;
    if (estado?.isTooltipActive === false) return;

    const i = Number(indice);

    if (Number.isInteger(i) && datos[i] !== undefined) elige(datos[i]);
  };
}

/** Filtra con todas las dimensiones menos las de `salvo`. */
export function filtraFilas<T>(
  filas: T[],
  dimensiones: Dimension<T>[],
  salvo: string[] = [],
): T[] {
  const vivas = dimensiones.filter(
    (d) => d.valor !== TODO && !salvo.includes(d.clave),
  );

  return vivas.length
    ? filas.filter((fila) => vivas.every((d) => d.coincide(fila, d.valor)))
    : filas;
}

/** Pulsar lo elegido lo quita; pulsar otra cosa la elige. */
export function alterna(actual: string, valor: string) {
  return actual === valor ? TODO : valor;
}

/** Texto vacío de la hoja frente a los rótulos «Sin …» de los gráficos. */
const VACIOS = new Set([
  "Sin zona",
  "Sin definir",
  "Sin acción",
  "Sin dato",
  "Unknown",
]);

/** Igualdad de celda que entiende los rótulos de lo vacío. */
export function igual(crudo: string | undefined, valor: string) {
  const t = (crudo || "").trim();

  return t ? t === valor.trim() : VACIOS.has(valor);
}

/**
 * Aspecto de una barra o un sector según lo elegido en su dimensión.
 *
 * Sin nada elegido, todo igual que antes. Con algo elegido, ese elemento va
 * con borde oro y los demás a un tercio de opacidad: se sigue viendo el
 * reparto entero, pero se sabe qué se está mirando.
 */
export function marca(
  elegido: string,
  nombre: string,
  /* Cuando el valor del filtro y el rótulo no se escriben igual («1P» y
     «Primer Palo»), la página dice ella si es el mismo. */
  coincide: boolean = elegido === nombre,
) {
  const hay = elegido !== TODO;
  const es = hay && coincide;

  return {
    fillOpacity: !hay || es ? 1 : ESTILO_ELEGIDO.apagado,
    stroke: es ? ORO : "transparent",
    strokeWidth: es ? ESTILO_ELEGIDO.grosor : 0,
    cursor: "pointer",
  };
}

export type Chip = {
  clave: string;
  etiqueta: string;
  texto: string;
  quitar: () => void;
};

/**
 * La tira de filtros activos: la común a todas las pantallas de análisis
 * (components/filtros/BarraFiltros.tsx, 05/10/2026). Ésta sólo traduce los
 * nombres de aquí a los de allí.
 */
export function BarraFiltros({
  chips,
  onQuitarTodo,
  antes,
  cuenta,
}: {
  chips: Chip[];
  onQuitarTodo: () => void;
  /** Lo que va delante de los filtros (el aviso de la pretemporada). */
  antes?: ReactNode;
  cuenta?: { vistas: number; total: number; unidad?: string };
}) {
  return (
    <BarraComun
      className="mt-4"
      previo={antes}
      cuenta={cuenta}
      onQuitarTodo={onQuitarTodo}
      pastillas={chips.map((c) => ({ clave: c.clave, rotulo: c.etiqueta, valor: c.texto, onQuitar: c.quitar }))}
    />
  );
}

/** El aviso de la pretemporada: la pastilla común. */
export function AvisoPretemporada({
  fuera,
  hayPretemporada,
  rotulo,
  onCambia,
}: {
  fuera: boolean;
  hayPretemporada: boolean;
  /** «Sólo liga» o «Liga y copa», según lo que haya. */
  rotulo: string;
  onCambia: (incluir: boolean) => void;
}) {
  if (!hayPretemporada) return null;

  return <PastillaPretemporada incluida={!fuera} rotuloSolo={rotulo} onCambiar={onCambia} />;
}
