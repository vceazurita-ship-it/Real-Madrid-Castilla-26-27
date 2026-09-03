/**
 * LA TIPOLOGÍA DE GOL DEL INFORME · lo que codifica el analista.
 *
 * La hoja «TIPOLOGÍA DE GOL» reparte cada gol —a favor y en contra— entre
 * ataque organizado, transiciones, balón parado y errores individuales. **Ese
 * reparto no lo da ningún dato**: sale de ver el partido, así que las casillas
 * salían punteadas y vacías y no había forma de escribirlas desde la app.
 *
 * Aquí viven las filas de esa tabla y los números que se escriben a mano. Se
 * guardan por rival en `app_documents` (`rival-tipologia:<equipo>`), así que se
 * escriben una vez y siguen ahí en el informe de la semana que viene.
 *
 * Lo único que no se escribe a mano son los penaltis y las propias puertas,
 * que los canta el marcador: si no hay número puesto, se pinta el contado.
 */

/** Las filas de la tabla, por secciones, en el orden del `.pptx` original. */
export const FILAS_TIPOLOGIA: { seccion: string; filas: string[] }[] = [
  {
    seccion: "AT. ORGANIZADO",
    filas: [
      "CENTRO IZQ.",
      "CENTRO DCH.",
      "JUEGO DIRECTO",
      "IND. DENTRO ÁREA",
      "IND. FUERA ÁREA",
      "DENTRO",
    ],
  },
  { seccion: "TRANSICIÓN", filas: ["C. PROPIO", "C. CONTRARIO"] },
  {
    seccion: "ABP",
    filas: ["CÓRNER", "FALTA DIRECTA", "FALTA INDIRECTA", "SDB", "PENALTI"],
  },
  { seccion: "ERRORES INDIVIDUALES", filas: ["ERROR IND."] },
];

/**
 * Los goles en propia puerta.
 *
 * No es una fila de la tabla —van al pie de cada columna, y en el reparto por
 * secciones el original los apunta como error individual—, pero se escribe
 * igual que las demás: lo que canta el marcador no siempre es lo que el
 * analista quiere que salga.
 */
export const FILA_PROPIA = "EN PROPIA PUERTA";

/** Todas las filas seguidas, que es como se recorren para pintar y para editar. */
export const TODAS_LAS_FILAS = FILAS_TIPOLOGIA.flatMap(
  (bloque) => bloque.filas,
);

/** Los números escritos a mano, por nombre de fila. Lo que no está, va vacío. */
export type ColumnaTipologia = Record<string, number>;

export type TipologiaManual = {
  aFavor: ColumnaTipologia;
  enContra: ColumnaTipologia;
};

export const TIPOLOGIA_VACIA: TipologiaManual = { aFavor: {}, enContra: {} };

export const claveTipologia = (equipo: string) =>
  `rival-tipologia:${equipo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/** Deja el documento en forma aunque venga de una versión anterior. */
export function normalizaTipologia(crudo: unknown): TipologiaManual {
  const limpia = (valor: unknown): ColumnaTipologia => {
    if (!valor || typeof valor !== "object") return {};

    const salida: ColumnaTipologia = {};

    for (const [fila, cuenta] of Object.entries(valor as object)) {
      const n = Number(cuenta);

      const valida = TODAS_LAS_FILAS.includes(fila) || fila === FILA_PROPIA;

      if (valida && Number.isFinite(n) && n >= 0) {
        salida[fila] = Math.round(n);
      }
    }

    return salida;
  };

  const dato = (crudo ?? {}) as Partial<TipologiaManual>;

  return { aFavor: limpia(dato.aFavor), enContra: limpia(dato.enContra) };
}

/** Lo guardado para este rival. Sin documento —o sin red—, tabla vacía. */
export async function leeTipologia(equipo: string): Promise<TipologiaManual> {
  try {
    const respuesta = await fetch(
      `/api/docs?key=${encodeURIComponent(claveTipologia(equipo))}`,
      { cache: "no-store" },
    );

    const cuerpo = await respuesta.json();

    return normalizaTipologia(cuerpo?.data);
  } catch (error) {
    console.error("[rivals] tipología", error);

    return TIPOLOGIA_VACIA;
  }
}

/**
 * Cuántos goles suman las casillas escritas de una columna.
 *
 * Sólo las filas de la tabla: las propias puertas van al pie, y meterlas aquí
 * bajaría el porcentaje de todas las secciones.
 */
export function sumaColumna(columna: ColumnaTipologia): number {
  return TODAS_LAS_FILAS.reduce(
    (total, fila) => total + (columna[fila] ?? 0),
    0,
  );
}
