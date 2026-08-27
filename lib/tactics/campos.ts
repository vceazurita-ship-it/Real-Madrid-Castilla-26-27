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
 * levantan el foso, los dos anillos LED, la grada y el techo en el mismo
 * espacio 3D que la cámara, y se pueden apagar de un clic —lo que se enseña
 * sigue siendo la jugada, no el estadio—.
 */

export type CampoId = "cesped" | "estadio" | "nocturno" | "pizarra" | "bernabeu";

/**
 * La paleta de todo lo que rodea al césped.
 *
 * Un campo vacío en cada color quiere decir «esa pieza no se dibuja»: el
 * diseño de imprimir no enciende focos y el apagado no levanta techo. Así se
 * elige el estadio desde aquí y `EntornoEstadio` no decide nada.
 */
export interface EntornoCampo {
  /** La hierba que hay entre la línea de cal y el foso. */
  banda: string;
  /** El pasillo de tartán entre la hierba y el primer anillo. */
  foso: string;
  /** Fondo de los dos anillos LED. */
  led: string;
  /** El barrido de luz que recorre el LED. Vacío = anillo apagado. */
  ledBrillo: string;
  /** El rótulo del club sobre el LED. */
  vallaTexto: string;
  /** Grada baja (la de abajo del anillo alto). */
  grada: string;
  /** Grada alta, más clara porque le da la luz de arriba. */
  gradaAlta: string;
  /** El moteado del público sentado. Vacío = grada vacía. */
  publico: string;
  /** Cubierta y cerchas. Vacío = estadio sin techo. */
  techo: string;
  /** La luz de los focos sobre el césped. Vacío = sin focos. */
  foco: string;
  /** El halo del suelo alrededor del campo. */
  halo: string;
}

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
  /** Colores del entorno. */
  entorno: EntornoCampo;
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
      foso: "#08161F",
      led: "#0B2233",
      ledBrillo: "rgba(228,206,155,.30)",
      vallaTexto: "rgba(228,206,155,.75)",
      grada: "#12293D",
      gradaAlta: "#22496B",
      publico: "rgba(255,255,255,.20)",
      techo: "",
      foco: "",
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
      foso: "#0B2036",
      led: "#0F2C4A",
      ledBrillo: "rgba(255,255,255,.45)",
      vallaTexto: "rgba(255,255,255,.88)",
      grada: "#1A4E78",
      gradaAlta: "#2E74AC",
      publico: "rgba(255,255,255,.28)",
      techo: "",
      foco: "rgba(255,255,255,.09)",
      halo: "rgba(120,190,140,.16)",
    },
  },
  {
    /*
    | El estadio encendido. Nace de los vídeos de la noche del estreno del
    | segundo anillo LED: dos cintas de luz dando la vuelta al campo, la grada
    | llena, los focos del techo y el videomarcador cantando la alineación.
    | Es el diseño de «esto se manda al grupo», no el de trabajar la charla.
    */
    id: "bernabeu",
    label: "Bernabéu",
    nota: "Noche de estadio: doble anillo LED, focos y grada llena",
    cesped: "#1A7C46",
    franja: "rgba(255,255,255,.07)",
    franjas: 16,
    linea: "rgba(255,255,255,.94)",
    grosor: 0.42,
    entorno: {
      banda: "#115932",
      foso: "#0A1524",
      led: "#0B2E7A",
      ledBrillo: "rgba(190,220,255,.85)",
      vallaTexto: "rgba(255,255,255,.95)",
      grada: "#0C1A2C",
      gradaAlta: "#1B3A5E",
      publico: "rgba(226,234,247,.46)",
      techo: "#0A1119",
      foco: "rgba(198,224,255,.20)",
      halo: "rgba(150,200,255,.18)",
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
      foso: "#03080D",
      led: "#050C14",
      ledBrillo: "rgba(120,200,255,.40)",
      vallaTexto: "rgba(120,200,255,.7)",
      grada: "#0A1826",
      gradaAlta: "#16334C",
      publico: "rgba(150,205,255,.20)",
      techo: "",
      foco: "rgba(90,170,255,.12)",
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
      foso: "#03101B",
      led: "#04121F",
      ledBrillo: "",
      vallaTexto: "rgba(200,169,107,.8)",
      grada: "#0A1A2A",
      gradaAlta: "#183B58",
      publico: "",
      techo: "",
      foco: "",
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
 * Lo que se lee en los anillos LED.
 *
 * No es decorativo: la pizarra se exporta y se manda, y una imagen que sale
 * del club tiene que decir de quién es sin depender del pie de foto.
 */
export const VALLA_TEXTO = "REAL MADRID CASTILLA";
