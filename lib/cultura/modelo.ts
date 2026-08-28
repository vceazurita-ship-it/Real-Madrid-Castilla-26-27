/**
 * El repositorio de documentos de cultura: qué es un documento y de qué está
 * hecho.
 *
 * El área de **Identidad** venía trabajando con ficheros sueltos —un HTML por
 * documento, montado a mano y exportado con `window.print()`—, y eso tiene dos
 * problemas: cada uno acaba con una tipografía y unos márgenes distintos, y el
 * contenido no se puede tocar sin editar el marcado. Aquí el documento es
 * **datos**: una lista de diapositivas con su tipo, y el dibujo lo pone la
 * plantilla de la casa (`public/INDIVIDUAL.pptx`).
 *
 * Así, añadir el documento número dos es escribir un fichero de contenido en
 * `lib/cultura/documentos/` y meterlo en `repositorio.ts`. No se toca ni un
 * componente.
 *
 * Las medidas y la paleta se declaran aquí y no se importan del dossier de
 * desplazamiento a propósito: los dos hablan la lengua de `INDIVIDUAL.pptx`,
 * pero son familias de documentos distintas y no deben poder arrastrarse la
 * una a la otra. Es la misma decisión que ya tomaron `lib/viaje/modelo.ts` y
 * `lib/rivals/portada.ts`.
 */

/* ------------------------------------------------------------------ */
/*  MEDIDAS Y PALETA                                                   */
/* ------------------------------------------------------------------ */

/** La diapositiva de la plantilla: 12192000×6858000 EMU son 1920×1080 px. */
export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

/** Margen lateral: donde arranca el filo rosa de la plantilla. */
export const MARGEN_CULTURA = 96;

export const COLORES_CULTURA = {
  papel: "#FFFFFF",
  crema: "#F7F4EC",
  verde: "#1B3A2E",
  navy: "#0F1E3D",
  rosa: "#F6AFB6",
  rosaHondo: "#D89AA6",
  tinta: "#0B1420",
  /**
   * El único color que la plantilla no trae.
   *
   * Un documento de valores necesita distinguir lo que suma de lo que es
   * inadmisible, y con los seis colores de la casa esa distinción no se ve: el
   * verde y el navy son los dos "buenos" y el rosa es la firma, no un aviso.
   * El granate es el rosa de la plantilla oscurecido hasta que aguanta texto
   * blanco encima, así que sigue siendo de la familia.
   */
  granate: "#8C2F3D",
  /** El fondo teñido de las conductas inadmisibles: el granate al 6 %. */
  granatePapel: "#FBEEF0",
};

export const CLUB_CULTURA = "REAL MADRID CF · CASTILLA";

/* ------------------------------------------------------------------ */
/*  CONTENIDO                                                          */
/* ------------------------------------------------------------------ */

/** Dónde se mira la conducta. Son los dos sitios donde se es del Castilla. */
export type Ambito = "campo" | "fuera";

/** Una conducta observable, con el nombre de lo que demuestra. */
export type Conducta = {
  /** "Humildad" o "Egoísmo y Arrogancia": qué se está viendo. */
  rotulo: string;
  texto: string;
};

export type BloqueConducta = {
  ambito: Ambito;
  /** "En el campo". */
  titulo: string;
  /** "Entrenamiento y partido": dónde exactamente. */
  matiz: string;
  suma: Conducta;
  resta: Conducta;
};

export type Valor = {
  /** 1 a 5: el orden en el que los votó la plantilla. */
  numero: number;
  titulo: string;
  /** "Votado por 9 jugadores", tal y como salió del recuento. */
  votos: string;
  /** Los antivalores que se le oponen, con sus votos: "Egoísmo (22)". */
  antivalores: string;
  /**
   * El párrafo que explica el valor. Lo que va entre `**` se pinta en verde y
   * en negrita: son las frases que se quieren recordar de memoria.
   */
  explicacion: string;
  bloques: BloqueConducta[];
};

/**
 * Una diapositiva.
 *
 * Es una unión discriminada y no un componente porque el contenido tiene que
 * poder viajar sin React: el mismo dato monta la vista previa, el `.pptx` y el
 * PDF, y mañana podría montar una ficha de vestuario impresa.
 */
export type DiapositivaCultura =
  | {
      tipo: "portada";
      titulo: string;
      subtitulo: string;
      /** El párrafo de entrada; admite `**negritas**`. */
      entradilla: string;
      /** El índice de la derecha: qué se va a leer. */
      indice: { numero: number; titulo: string; votos: string }[];
    }
  | { tipo: "valor"; valor: Valor }
  | { tipo: "conductas"; valor: Valor };

export type DocumentoCultura = {
  /** El identificador del repositorio: "01-valores". */
  id: string;
  /** El número con el que se nombra el fichero: "01". */
  numero: string;
  titulo: string;
  subtitulo: string;
  /** Para qué sirve, en la ficha del repositorio. */
  resumen: string;
  etiquetas: string[];
  /** "26 / 27". */
  temporada: string;
  /** La raíz del nombre del fichero que se descarga. */
  archivo: string;
  /** De dónde sale el contenido, si venía de otro sitio. */
  origen?: string;
  diapositivas: DiapositivaCultura[];
};

/* ------------------------------------------------------------------ */
/*  DERIVADOS                                                          */
/* ------------------------------------------------------------------ */

/**
 * El rótulo de cada diapositiva.
 *
 * Es lo que va en la chapa de la cabecera, en el nombre de la hoja del
 * PowerPoint y en el pie del PDF: una sola cuenta para los tres, que es como
 * se evita que el documento diga tres cosas distintas de la misma página.
 */
export function titulosDocumento(documento: DocumentoCultura): string[] {
  return documento.diapositivas.map((hoja) => {
    if (hoja.tipo === "portada") return "Portada";

    if (hoja.tipo === "valor") return `Valor ${hoja.valor.numero}`;

    return `Valor ${hoja.valor.numero} · Conductas`;
  });
}

/** Los valores del documento, en orden. Vale para contar y para el índice. */
export function valoresDe(documento: DocumentoCultura): Valor[] {
  return documento.diapositivas
    .filter((hoja) => hoja.tipo === "valor")
    .map((hoja) => (hoja as { valor: Valor }).valor);
}

/**
 * Parte un texto por sus `**negritas**`.
 *
 * Se escribe así en el contenido —y no con etiquetas— para que el fichero de
 * datos se pueda leer y corregir sin saber marcado: quien redacta los valores
 * es el cuerpo técnico, no quien programa.
 */
export function partesRicas(texto: string): { texto: string; fuerte: boolean }[] {
  return texto
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((trozo) => trozo !== "")
    .map((trozo) =>
      trozo.startsWith("**") && trozo.endsWith("**")
        ? { texto: trozo.slice(2, -2), fuerte: true }
        : { texto: trozo, fuerte: false },
    );
}
