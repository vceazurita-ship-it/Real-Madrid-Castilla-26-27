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
  return (estado: { activeTooltipIndex?: unknown } | null) => {
    const i = Number(estado?.activeTooltipIndex);

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
    fillOpacity: !hay || es ? 1 : 0.3,
    stroke: es ? ORO : "transparent",
    strokeWidth: es ? 2 : 0,
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
 * La tira de filtros activos.
 *
 * Va pegada debajo de la cabecera (`sticky`) porque los gráficos que filtran
 * están muy abajo: sin ella se pulsaba un sector al final de la página y no
 * se veía qué había cambiado arriba. El hueco de la derecha es el del botón
 * flotante del PDF.
 */
export function BarraFiltros({
  chips,
  onQuitarTodo,
  antes,
}: {
  chips: Chip[];
  onQuitarTodo: () => void;
  /** Lo que va delante de los filtros (el aviso de la pretemporada). */
  antes?: ReactNode;
}) {
  return (
    <div className="sticky top-[80px] z-20 -mx-1 mt-4 rounded-2xl border border-white/10 bg-[#0B0F14]/85 px-3 py-2 pr-16 backdrop-blur-xl md:top-[96px]">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-1 text-white/60">
          {chips.length ? "Filtrando:" : "Sin filtros ·"}
        </span>

        {antes}

        {chips.map((chip) => (
          <button
            key={chip.clave}
            type="button"
            onClick={chip.quitar}
            title="Quitar este filtro"
            className="max-w-full truncate rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2.5 py-1 text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
          >
            <span className="text-white/60">{chip.etiqueta}:</span>{" "}
            {chip.texto} ✕
          </button>
        ))}

        {chips.length > 0 ? (
          <button
            type="button"
            onClick={onQuitarTodo}
            className="rounded-full px-2 py-1 text-white/60 underline-offset-2 transition hover:text-white hover:underline"
          >
            Quitar filtros
          </button>
        ) : (
          <span className="text-white/40">
            pulsa cualquier barra, sector, zona o fila para filtrar
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * El aviso de la pretemporada dentro de la tira: cuando está fuera dice
 * «Sólo liga · incluir pretemporada» y al pulsarlo la mete; cuando está dentro
 * ofrece volver a sacarla.
 */
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

  return fuera ? (
    <button
      type="button"
      onClick={() => onCambia(true)}
      title="La pretemporada está fuera de todos los datos. Pulsa para incluirla."
      className="rounded-full border border-dashed border-white/10 bg-white/[0.03] px-2.5 py-1 text-white/60 transition hover:bg-white/[0.06] hover:text-white"
    >
      {rotulo} · <span className="text-[#C8A96B]">incluir pretemporada</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => onCambia(false)}
      title="Vuelve a dejar fuera la pretemporada"
      className="rounded-full border border-dashed border-white/10 bg-white/[0.03] px-2.5 py-1 text-white/60 transition hover:bg-white/[0.06] hover:text-white"
    >
      Con pretemporada · <span className="text-[#C8A96B]">quitarla</span>
    </button>
  );
}
