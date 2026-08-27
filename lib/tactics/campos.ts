/**
 * Cómo se ve el campo de la pizarra táctica: el césped y lo que hay alrededor.
 *
 * Hasta ahora el campo era un verde fijo escrito dentro del propio dibujo. Con
 * la cámara en perspectiva eso se queda corto por dos razones. Una es de sala:
 * la charla del sábado por la noche y el análisis del lunes por la mañana no
 * piden la misma imagen, y un césped iluminado se proyecta distinto que uno
 * apagado. La otra es de lectura: cuando la pizarra se llena de flechas de
 * colores, un césped oscuro y sin saturar deja el dibujo por delante, mientras
 * que para una foto que se comparte manda el verde de siempre.
 *
 * Y el **entorno**: con el campo inclinado, alrededor no había nada. Ahora se
 * levantan las vallas de publicidad y el graderío en el mismo espacio 3D que
 * la cámara, y se pueden apagar de un clic —lo que se enseña sigue siendo la
 * jugada, no el estadio—.
 */

export type CampoId = "cesped" | "estadio" | "nocturno" | "pizarra";

export interface DisenoCampo {
  id: CampoId;
  label: string;
  /** Lo que se lee bajo el nombre al elegirlo. */
  nota: string;
  /** Color base del césped. */
  cesped: string;
  /** La segunda franja de siega. Vacío = sin franjas. */
  franja: string;
  /** Cuántas franjas de siega tiene el campo a lo largo. */
  franjas: number;
  /** Color de las líneas. */
  linea: string;
  /** Grosor de las líneas, en unidades de campo. */
  grosor: number;
  /** Colores del entorno: banda de hierba, valla de publicidad y graderío. */
  entorno: {
    /** La hierba que hay entre la línea de cal y la valla. */
    banda: string;
    valla: string;
    vallaTexto: string;
    grada: string;
    gradaAlta: string;
    /** El halo del suelo alrededor del campo. */
    halo: string;
  };
}

export const CAMPOS: DisenoCampo[] = [
  {
    id: "cesped",
    label: "Césped",
    nota: "El de siempre: verde apagado y el dibujo por delante",
    cesped: "#0F2A1D",
    franja: "rgba(255,255,255,.022)",
    franjas: 10,
    linea: "rgba(255,255,255,.34)",
    grosor: 0.35,
    entorno: {
      banda: "#0B2015",
      valla: "#0B2233",
      vallaTexto: "rgba(228,206,155,.75)",
      grada: "#12293D",
      gradaAlta: "#22496B",
      halo: "rgba(200,169,107,.10)",
    },
  },
  {
    id: "estadio",
    label: "Estadio",
    nota: "Verde de retransmisión, para la foto que se comparte",
    cesped: "#1B7A43",
    franja: "rgba(255,255,255,.055)",
    franjas: 14,
    linea: "rgba(255,255,255,.82)",
    grosor: 0.4,
    entorno: {
      banda: "#146134",
      valla: "#0F2C4A",
      vallaTexto: "rgba(255,255,255,.88)",
      grada: "#1A4E78",
      gradaAlta: "#2E74AC",
      halo: "rgba(120,190,140,.16)",
    },
  },
  {
    id: "nocturno",
    label: "Nocturno",
    nota: "Campo apagado y líneas frías: las flechas mandan",
    cesped: "#081018",
    franja: "rgba(120,200,255,.028)",
    franjas: 10,
    linea: "rgba(150,205,255,.42)",
    grosor: 0.32,
    entorno: {
      banda: "#050B11",
      valla: "#050C14",
      vallaTexto: "rgba(120,200,255,.7)",
      grada: "#0A1826",
      gradaAlta: "#16334C",
      halo: "rgba(80,150,220,.12)",
    },
  },
  {
    id: "pizarra",
    label: "Pizarra",
    nota: "Tinta y oro de la casa, sin césped: para imprimir",
    cesped: "#04121F",
    franja: "",
    franjas: 0,
    linea: "rgba(200,169,107,.55)",
    grosor: 0.34,
    entorno: {
      banda: "#030D17",
      valla: "#04121F",
      vallaTexto: "rgba(200,169,107,.8)",
      grada: "#0A1A2A",
      gradaAlta: "#183B58",
      halo: "rgba(200,169,107,.14)",
    },
  },
];

export const CAMPO_POR_DEFECTO: CampoId = "cesped";

export const CAMPO_BY_ID = new Map(CAMPOS.map((campo) => [campo.id, campo]));

export function disenoDe(id: CampoId | undefined): DisenoCampo {
  return CAMPO_BY_ID.get(id ?? CAMPO_POR_DEFECTO) ?? CAMPOS[0];
}

/**
 * Lo que se lee en las vallas de publicidad.
 *
 * No es decorativo: la pizarra se exporta y se manda, y una imagen que sale
 * del club tiene que decir de quién es sin depender del pie de foto.
 */
export const VALLA_TEXTO = "REAL MADRID CASTILLA";
