import type { Unidad } from "@/lib/data-analisis/metricas";

/**
 * LO QUE DESTACA DEL RIVAL, PARA EL INFORME.
 *
 * Las dos diapositivas nuevas del informe —lo que hace distinto a su juego
 * colectivo y quién se sale de los suyos— salen del mismo sitio que la
 * pantalla de Data Análisis: los informes de Wyscout de toda la categoría.
 *
 * **La cuenta se hace en el servidor.** El dataset entero son más de dos megas
 * de JSON y el informe se monta en el navegador, a veces desde el móvil en el
 * campo: bajarse la categoría al completo para sacar cuatro frases y seis
 * jugadores no tiene sentido. `/api/data-analisis?destacados=` devuelve ya
 * resuelto lo que cabe en las dos hojas, con la **misma librería** que usa la
 * pantalla, así que el informe y la pantalla no pueden discrepar.
 *
 * Y si no hay dato —un rival del que nadie ha bajado informe, la carpeta
 * vacía, el endpoint caído— devuelve `null` y el informe se monta sin esas dos
 * hojas, como hace ya con la clasificación en agosto.
 */

export type FilaDestacada = {
  nombre: string;
  valor: number;
  mediana: number;
  unidad: Unidad;
  percentil: number;
};

export type EjeNube = {
  nombre: string;
  unidad: Unidad;
  /** `null` en las métricas de estilo: ni más es mejor ni menos. */
  mejorAlto: boolean | null;
};

/**
 * La categoría entera en las dos métricas del aspecto.
 *
 * Es lo que convierte «va +33 en dominio con balón» en una imagen: un escudo
 * por equipo, las dos medianas cruzando el dibujo y el rival marcado. Con una
 * sola métrica con datos, `y` viene a `null` y se pinta en una línea.
 */
export type NubeDestacada = {
  x: EjeNube;
  y: EjeNube | null;
  medianaX: number;
  medianaY: number | null;
  puntos: { equipo: string; x: number; y: number | null }[];
};

export type AspectoDestacado = {
  /** «Presión alta». */
  aspecto: string;
  /** Qué significa destacar en esto, en una línea. */
  explica: string;
  percentil: number;
  /** −50 … +50: lo mismo contado desde la media de la categoría. */
  desviacion: number;
  filas: FilaDestacada[];
  nube: NubeDestacada | null;
};

export type JugadorDestacado = {
  jugador: string;
  posicion: string;
  puesto: string;
  minutos: number;
  partidos: number;
  /** Tanto por ciento de los minutos posibles de su equipo. */
  cuotaMinutos: number;
  fuertes: { nombre: string; valor: number; unidad: Unidad; percentil: number }[];
};

export type DestacadosRival = {
  temporada: string;
  /** Cuántos equipos tiene la categoría con la que se compara. */
  equipos: number;
  equipo: AspectoDestacado[];
  jugadores: JugadorDestacado[];
};

export async function traeDestacadosRival(
  equipo: string,
): Promise<DestacadosRival | null> {
  if (!equipo.trim()) return null;

  try {
    const respuesta = await fetch(
      `/api/data-analisis?destacados=${encodeURIComponent(equipo)}`,
      { cache: "no-store" },
    );

    if (!respuesta.ok) return null;

    const crudo = await respuesta.json();

    const destacados = crudo?.destacados as DestacadosRival | undefined;

    if (!destacados) return null;

    /* Sin nada en ninguna de las dos hojas no hay hojas que pintar. */
    if (
      destacados.equipo.length === 0 &&
      destacados.jugadores.length === 0
    ) {
      return null;
    }

    return destacados;
  } catch (error) {
    console.error("[informe] destacados", error);

    return null;
  }
}
