"use client";

/**
 * FILTRAR PINCHANDO.
 *
 * Lo pidió el cuerpo técnico tal cual: «que todo lo que se pinche sirva de
 * filtro». Una zona del campo, una barra, una fila de la tabla: se pincha y
 * la pantalla entera se queda con eso; se vuelve a pinchar y se suelta.
 *
 * Lo comparten faltas y transiciones, y por eso vive aparte y no sabe nada de
 * ninguna de las dos: cada pantalla dice qué dimensiones tiene y cómo se lee
 * cada una de una fila, y aquí sólo se guarda qué valores están marcados.
 *
 * **Dentro de una dimensión, o; entre dimensiones, y.** Pinchar «izquierda» y
 * luego «derecha» deja las dos bandas; pinchar además «campo rival» se queda
 * con las de banda que fueron en campo rival. Es como se piensa en voz alta
 * delante del vídeo, y no hace falta explicarlo.
 *
 * **La gráfica de lo filtrado no se vacía.** Si se filtra por zona, la gráfica
 * de zonas sigue enseñando las tres —con la elegida marcada y las otras
 * apagadas—, porque se calcula con todos los filtros MENOS el suyo
 * (`pasaFiltros(..., excepto)`). Si no, después del primer clic no quedaría
 * nada que pinchar para cambiar de opinión.
 */

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { BarraFiltros as BarraComun, ESTILO_ELEGIDO, PastillaPretemporada } from "@/components/filtros/BarraFiltros";


const ORO = "#C8A96B";

export const TITULO_FILTRO = "Pulsa para filtrar";

/** Dimensión → valores marcados. Una dimensión sin valores no está. */
export type Filtros = Record<string, string[]>;

export function useFiltrosCruzados() {
  const [filtros, setFiltros] = useState<Filtros>({});

  /*
  | Varios valores de una vez: el «Otro» de una gráfica son dos acciones, y la
  | casilla del campo son una zona Y un carril. Si ya estaban todos, se
  | sueltan todos; si falta alguno, se ponen los que faltan.
  */
  const alternaVarios = useCallback((pares: [dimension: string, valor: string][]) => {
    setFiltros((antes) => {
      const yaEstan = pares.every(([d, v]) => (antes[d] ?? []).includes(v));
      const despues: Filtros = { ...antes };

      for (const [d, v] of pares) {
        const suyos = despues[d] ?? [];

        despues[d] = yaEstan
          ? suyos.filter((x) => x !== v)
          : suyos.includes(v)
            ? suyos
            : [...suyos, v];

        if (despues[d].length === 0) delete despues[d];
      }

      return despues;
    });
  }, []);

  const alterna = useCallback(
    (dimension: string, valor: string) => alternaVarios([[dimension, valor]]),
    [alternaVarios],
  );

  const quita = useCallback((dimension: string, valor: string) => {
    setFiltros((antes) => {
      const quedan = (antes[dimension] ?? []).filter((x) => x !== valor);
      const despues: Filtros = { ...antes };

      if (quedan.length) despues[dimension] = quedan;
      else delete despues[dimension];

      return despues;
    });
  }, []);

  const limpia = useCallback(() => setFiltros({}), []);

  return { filtros, alterna, alternaVarios, quita, limpia };
}

/**
 * ¿Pasa la fila todos los filtros? Con `excepto`, sin mirar esas dimensiones:
 * es lo que usa la gráfica de una dimensión para seguir enseñándola entera.
 */
export function pasaFiltros<T>(
  fila: T,
  filtros: Filtros,
  lectores: Record<string, (fila: T) => string>,
  excepto: string[] = [],
) {
  for (const [dimension, valores] of Object.entries(filtros)) {
    if (!valores.length || excepto.includes(dimension)) continue;

    const leer = lectores[dimension];

    if (leer && !valores.includes(leer(fila))) return false;
  }

  return true;
}

export const estaActivo = (filtros: Filtros, dimension: string, valor: string) =>
  (filtros[dimension] ?? []).includes(valor);

export const hayFiltro = (filtros: Filtros, dimension: string) =>
  (filtros[dimension]?.length ?? 0) > 0;

/**
 * Cómo se pinta una pieza pinchable de una gráfica: la marcada con el oro y
 * entera; las demás de esa misma gráfica, apagadas, sólo si hay algo marcado.
 */
export function marcaPieza(activo: boolean, hayAlgo: boolean): CSSProperties {
  if (activo) return { outline: `${ESTILO_ELEGIDO.grosor}px solid ${ORO}`, outlineOffset: 2, opacity: 1 };

  return { opacity: hayAlgo ? ESTILO_ELEGIDO.apagado : 1 };
}

/** Lo mismo para un trozo de SVG (barras de recharts, cajones del campo). */
export function marcaSvg(activo: boolean, hayAlgo: boolean) {
  return {
    stroke: activo ? ORO : undefined,
    strokeWidth: activo ? ESTILO_ELEGIDO.grosor : undefined,
    fillOpacity: activo || !hayAlgo ? 1 : ESTILO_ELEGIDO.apagado,
    cursor: "pointer",
  } as const;
}

/**
 * Un valor pinchable dentro de una tabla o una lista.
 *
 * Dos aspectos: `pieza` (chips, barras, leyendas) lleva el contorno de oro,
 * y `celda` (las de la tabla) sólo se tiñe. En la tabla, después de filtrar,
 * TODAS las filas que quedan cumplen el filtro: una columna entera con
 * contorno sería ruido, y un tinte basta para ver qué columna manda.
 */
export function Filtrable({
  activo,
  atenuado = false,
  onClick,
  children,
  className = "",
  variante = "celda",
  titulo,
}: {
  activo: boolean;
  atenuado?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  variante?: "celda" | "pieza";
  titulo?: string;
}) {
  const marca =
    variante === "pieza"
      ? marcaPieza(activo, atenuado)
      : { opacity: atenuado && !activo ? ESTILO_ELEGIDO.apagado : 1 };

  return (
    <button
      type="button"
      onClick={(e) => {
        /* Que el clic no le llegue a la fila de debajo. */
        e.stopPropagation();
        onClick();
      }}
      aria-pressed={activo}
      title={titulo ?? TITULO_FILTRO}
      style={marca}
      className={`cursor-pointer rounded-md text-left transition hover:opacity-100 ${
        variante === "celda" && activo
          ? "bg-[#C8A96B]/15 px-1 text-[#C8A96B]"
          : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * ¿Es de pretemporada? Lo pidió el cuerpo técnico: los amistosos no se
 * mezclan con la liga salvo que se pida. Se decide por el rótulo de la
 * jornada, que es lo único que traen los dos generadores.
 */
export const esPretemporada = (jornada: string) => {
  /* Con la misma regla que `parseJornada` (lib/abp/partido.ts): «pretemporada»
     o «amistos-» en cualquier sitio, y además las abreviaturas «PR3», «Pre 2». */
  const t = jornada.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  return (
    t.includes("pretemporada") ||
    t.includes("amistos") ||
    /^\s*(pre[\s\-_.]|pret\b|pr\s*\d)/.test(t)
  );
};

export type ChipFiltro = {
  clave: string;
  /** «Zona», «Carril»… */
  rotulo: string;
  /** Lo que se lee: «campo rival». */
  valor: string;
  onQuitar: () => void;
};

/**
 * La barra de «Filtrando: …»: la común a todas las pantallas de análisis
 * (components/filtros/BarraFiltros.tsx, 05/10/2026). Ésta traduce los nombres
 * de aquí a los de allí y pone la pastilla de la pretemporada si hay.
 */
export function BarraFiltros({
  chips,
  onLimpiar,
  pretemporada,
  cuenta,
  className = "",
}: {
  chips: ChipFiltro[];
  onLimpiar: () => void;
  /**
   * Sólo cuando hay partidos de pretemporada en los datos: fuera por
   * defecto, y aquí se meten o se sacan. Sin ellos la barra ni lo menciona.
   */
  pretemporada?: { incluida: boolean; onCambiar: (incluir: boolean) => void };
  cuenta?: { vistas: number; total: number; unidad?: string };
  className?: string;
}) {
  return (
    <BarraComun
      className={className}
      cuenta={cuenta}
      onQuitarTodo={onLimpiar}
      previo={pretemporada ? <PastillaPretemporada incluida={pretemporada.incluida} onCambiar={pretemporada.onCambiar} /> : undefined}
      pastillas={chips.map((c) => ({ clave: c.clave, rotulo: c.rotulo, valor: c.valor, onQuitar: c.onQuitar }))}
    />
  );
}
