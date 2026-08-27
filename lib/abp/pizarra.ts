/**
 * Pizarra de balón parado: vocabulario, plantillas de diapositiva y memoria.
 *
 * Es la versión viva del PowerPoint que el cuerpo técnico montaba a mano para
 * cada partido (`public/RMCF CASTILLA - LIG.01 CD TERUEL.pptx`): siete
 * diapositivas —córner ofensivo, falta lateral ofensiva, directas a portería,
 * córner defensivo, falta lateral defensiva, falta directa defensiva y saque
 * de banda defensivo— con el campo en perspectiva, la cara de cada jugador en
 * su sitio, una chapa con su puesto y un panel a la derecha que agrupa los
 * puestos por cometido.
 *
 * Las medidas SON las de la plantilla. 12192000×6858000 EMU son 1920×1080 px a
 * 6350 EMU por píxel, así que las coordenadas de cada chapa están sacadas del
 * `slide*.xml` del propio pptx y no reinventadas: el tablero se pinta en ese
 * lienzo y se escala entero para que quepa en la pantalla.
 *
 * Lo que la plantilla no podía tener porque se hacía a mano:
 *
 * - **Se reutiliza el partido anterior.** Un microciclo cambia cuatro nombres,
 *   no las siete diapositivas.
 * - **La app aprende el puesto de cada uno.** Cada vez que alguien se coloca en
 *   un puesto queda anotado, y «colocar automáticamente» rellena las
 *   diapositivas por orden de prioridad, sin repetir a nadie dentro de una.
 *
 * El diseño —papel, tipografía y chapas— es el de `public/INDIVIDUAL.pptx`,
 * que ya vive en `lib/rivals/portada.ts`. Aquí sólo está el modelo: quien
 * pinta es `components/abp/pizarra/`.
 */

/* ------------------------------------------------------------------ */
/*  LIENZO                                                             */
/* ------------------------------------------------------------------ */

/** El lienzo de la plantilla. Todas las coordenadas van en estos píxeles. */
export const TABLERO_W = 1920;
export const TABLERO_H = 1080;

/** Alto de la cabecera con el título, sacado del pptx (121 px). */
export const CABECERA_H = 121;

/** El panel de puestos de la derecha: 620×560 en 1279,141. */
export const PANEL = { x: 1279, y: 141, w: 620, h: 560 };

/** La caja de notas: 746×354 en 1153,714. */
export const NOTAS = { x: 1153, y: 714, w: 746, h: 354 };

/**
 * Paleta.
 *
 * Los tres primeros son los de `INDIVIDUAL.pptx` (ver `lib/rivals/portada.ts`);
 * el azul y el naranja son los que la plantilla de ABP usa para las chapas de
 * puesto y la cabecera, y se conservan porque son los que el cuerpo técnico
 * reconoce de un vistazo.
 */
export const COLORES = {
  papel: "#FFFFFF",
  verde: "#1B3A2E",
  navy: "#0F1E3D",
  crema: "#F7F4EC",
  rosa: "#F6AFB6",
  rosaHondo: "#D89AA6",
  /** El azul de las chapas de puesto del pptx de ABP. */
  chapa: "#00304E",
  /** El naranja del degradado de la cabecera de la plantilla original. */
  ambar: "#FF9E12",
  /** El oro de la casa: el mismo acento que usa toda la plataforma. */
  oro: "#C8A96B",
  oroClaro: "#E4CE9B",
  /** Azul casi negro, el fondo de la cabecera y de los paneles. */
  tinta: "#04121F",
};

/**
 * Cómo se firma la diapositiva.
 *
 * Va sobre el título de la acción, en la cabecera. La diapositiva se proyecta
 * en la sala y se imprime para el vestuario, y fuera de casa acaba en manos de
 * gente que no tiene por qué reconocer el escudo: se escribe el nombre entero.
 */
export const CLUB = "REAL MADRID CF - CASTILLA";

/* ------------------------------------------------------------------ */
/*  EJES                                                               */
/* ------------------------------------------------------------------ */

/** Qué foto de campo lleva la diapositiva. */
export type VistaCampo = "ancho" | "porteria";

/** Una foto del fondo, con el rectángulo que ocupa en el lienzo. */
export type CapaCampo = {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Cuántos píxeles tarda el borde derecho en desaparecer.
   *
   * El plano de portería es más estrecho que el lienzo, así que su borde
   * cortaba en seco sobre el campo ancho de debajo —dos fotos del mismo
   * estadio a escalas distintas, una junto a otra— y en la diapositiva se veía
   * una línea vertical con el graderío duplicado a la derecha. Difuminando ese
   * borde las dos capas se funden y no hay costura.
   */
  fundido?: number;
};

/*
| Las dos vistas son las del pptx, y la de portería **no sustituye** al campo
| ancho: se pinta encima. En la plantilla, las diapositivas de portería llevan
| las dos fotos —el campo entero a sangre y, sobre él, el plano corto del área
| en 1576×1080 pegado a la izquierda—, de forma que la banda derecha del campo
| grande sigue asomando bajo el panel de puestos. Poniendo sólo la de portería,
| que es más estrecha que el lienzo, el recorte se comía la portería, que es
| justo lo que hay que ver.
*/
const CAMPO_ANCHO: CapaCampo = {
  src: "/abp-campo-ancho.png",
  x: 0,
  y: 0,
  w: TABLERO_W,
  h: TABLERO_H,
};

/**
 * El velo de una vista: un degradado que se pinta sobre las fotos.
 *
 * En el plano de portería la banda derecha del lienzo no es campo, es el
 * sobrante del campo ancho asomando a otra escala. Ahí es donde van el panel de
 * puestos y las consignas, así que en lugar de enseñar un trozo de graderío
 * descuadrado se apaga hacia la tinta de la casa: el panel gana un fondo limpio
 * y la costura desaparece.
 */
export type VistaCampoDef = {
  label: string;
  capas: CapaCampo[];
  velo?: string;
};

export const VISTAS: Record<VistaCampo, VistaCampoDef> = {
  ancho: { label: "Campo ancho", capas: [CAMPO_ANCHO] },
  porteria: {
    label: "Plano de portería",
    capas: [
      CAMPO_ANCHO,
      {
        src: "/abp-campo-porteria.png",
        x: 5,
        y: -2,
        w: 1576,
        h: TABLERO_H,
        fundido: 190,
      },
    ],
    velo:
      "linear-gradient(90deg, rgba(4,18,32,0) 0%, rgba(4,18,32,0) 62%, rgba(4,18,32,.55) 76%, rgba(4,18,32,.9) 88%, rgba(4,18,32,.96) 100%)",
  },
};

export type LadoPizarra = "ofensivo" | "defensivo";

export const LADO_PIZARRA_LABEL: Record<LadoPizarra, string> = {
  ofensivo: "Ofensivo",
  defensivo: "Defensivo",
};

/* ------------------------------------------------------------------ */
/*  PUESTOS Y GRUPOS                                                   */
/* ------------------------------------------------------------------ */

/** Una caja del panel de la derecha: agrupa puestos por cometido. */
export type GrupoAbp = {
  key: string;
  label: string;
};

/**
 * Un puesto de una diapositiva.
 *
 * `x`/`y` es dónde va la chapa en el lienzo de 1920×1080, sacado del pptx.
 * Sin coordenadas el puesto **sólo vive en el panel**: es el caso de los
 * lanzadores de falta directa o de los penaltis, que son una lista de nombres
 * por orden y no una posición en el campo.
 */
export type PuestoAbp = {
  key: string;
  /** Lo que se lee en la chapa: "R1", "M3", "RL"… */
  code: string;
  /**
   * Lo que se lee en la chapa cuando NO es el `code`.
   *
   * La clave de un puesto tiene que ser única dentro de la diapositiva, pero
   * lo que el cuerpo técnico dice en la sala no: en una barrera hay dos
   * centrales y los dos son «C», y los dos laterales son «L». Se separan por
   * dentro y se llaman igual por fuera.
   */
  sigla?: string;
  /** Lo que significa, para el panel y las ayudas. */
  label: string;
  grupo: string;
  x?: number;
  y?: number;
};

/** Lo que se pinta en la chapa de un puesto. */
export function siglaDe(puesto: Pick<PuestoAbp, "code" | "sigla">) {
  return puesto.sigla ?? puesto.code;
}

/* ------------------------------------------------------------------ */
/*  ADORNOS DEL CAMPO                                                  */
/* ------------------------------------------------------------------ */

/**
 * Dibujos que trae la propia diapositiva y que no son jugadores.
 *
 * Van sobre el césped, por debajo de las fichas, y **se exportan**: forman
 * parte de lo que se enseña en la sala, no del cromo de edición.
 *
 * - `zona` marca desde dónde se lanza —el punto de penalti, cada lado de la
 *   frontal—, y así la diapositiva de directas dice algo aunque el orden de
 *   lanzadores viva en el panel.
 * - `transicion` es la flecha de salida de las diapositivas defensivas: si la
 *   acción se defiende bien, se sale a la contra.
 */
export type AdornoAbp =
  | { tipo: "zona"; x: number; y: number; label: string }
  | { tipo: "transicion"; label: string; remate: string };

/* ------------------------------------------------------------------ */
/*  PLANTILLAS DE DIAPOSITIVA                                          */
/* ------------------------------------------------------------------ */

export type PlantillaSlide = {
  key: string;
  titulo: string;
  vista: VistaCampo;
  lado: LadoPizarra;
  grupos: GrupoAbp[];
  puestos: PuestoAbp[];
  /** Las consignas que la plantilla trae escritas. Se pueden cambiar. */
  notas: string[];
  /**
   * Versión del dibujo de la plantilla.
   *
   * Las pizarras guardadas llevan dentro la posición de cada ficha, no la de la
   * plantilla: se copian al colocar y luego se pueden arrastrar. Eso está bien
   * mientras la plantilla no cambie, pero cuando cambia —una barrera que pasa
   * de cuatro a cinco, una fila que se abre porque las chapas se tapaban— las
   * jornadas ya montadas se quedaban con el dibujo viejo y había que rehacerlas
   * a mano.
   *
   * Subiendo este número, `normalizaTablero` vuelve a plantar las fichas donde
   * dice la plantilla la próxima vez que se abre la pizarra. **Súbelo sólo al
   * mover coordenadas**: recolocar borra los ajustes que alguien haya hecho
   * arrastrando en esa diapositiva.
   */
  rev: number;
  /** Lo que la diapositiva dibuja en el campo además de las caras. */
  adornos?: AdornoAbp[];
  /**
   * Grupos que se eligen de una vez, y no puesto a puesto.
   *
   * En «directas a portería» lo que se decide no es quién es el lanzador 2 del
   * lado izquierdo: es **quién tira desde ese lado**, y en qué orden. Pulsar
   * cualquiera de sus puestos abre la lista entera del grupo y se marcan
   * varios de golpe; los marcados caen en los puestos del grupo por orden y se
   * pintan todos en el campo, uno detrás de otro.
   */
  elegirEnGrupo?: string[];
  /**
   * Si la misma cara puede salir en varios sitios de la diapositiva.
   *
   * La regla normal es que no: en un córner nadie puede ser a la vez el
   * rematador 1 y el que cierra, y ponerle en el segundo sitio le quita del
   * primero. En «directas a portería» esa regla estorba, porque lo que hay ahí
   * no son puestos de una misma jugada sino **opciones distintas** —lado
   * izquierdo, lado derecho, penalti— y el mismo tirador puede estar en las
   * tres. Dentro de un mismo sitio sigue sin poder repetirse: nadie lanza a la
   * vez de primero y de segundo desde la izquierda.
   */
  repite?: boolean;
  /**
   * Grupos cuyos puestos llevan una casilla vacía para el dorsal del rival.
   *
   * En el córner defensivo cada marca es un rival concreto, y el dorsal no se
   * sabe hasta que el rival sale al campo: la diapositiva se imprime con la
   * casilla en blanco y se rellena a boli en el vestuario. Va en la chapa del
   * campo **y** en la fila del panel, para que valga leerla de las dos formas.
   */
  dorsal?: string[];
};

/* Atajo para no repetir el prefijo de la clave en cada puesto. */
const puestos = (
  plantilla: string,
  lista: (Omit<PuestoAbp, "key"> & { key?: string })[],
): PuestoAbp[] =>
  lista.map((puesto) => ({ ...puesto, key: `${plantilla}:${puesto.code}` }));

export const PLANTILLAS: PlantillaSlide[] = [
  {
    key: "corner-of",
    rev: 3,
    titulo: "CÓRNER OFENSIVO",
    vista: "ancho",
    lado: "ofensivo",
    grupos: [
      { key: "lanzadores", label: "LANZADORES" },
      { key: "bloqueos", label: "BLOQUEOS" },
      { key: "rechace", label: "RECHACE" },
      { key: "rematadores", label: "REMATADORES" },
      { key: "cierra", label: "CIERRA" },
    ],
    /*
    | Fuera el puesto de «lanzador»: su chapa caía en 190,120, o sea **debajo
    | de la cabecera**, y en la diapositiva no se veía más que un filo. Quien
    | saca el córner es la corta —`C`—, que ya está en el grupo de lanzadores.
    |
    | `Z1` y `D1` van cambiados respecto a como estaban: el zaguero es el que
    | se queda arriba y el defensa el que cierra por delante.
    |
    | Los tres rematadores estaban a 40 px unos de otros con una ficha de 96 de
    | ancha: las chapas de R2 y R3 desaparecían detrás de la cara del de al
    | lado. Mismo trazado diagonal, con sitio para leerlos.
    */
    puestos: puestos("corner-of", [
      { code: "C", label: "Corta", grupo: "lanzadores", x: 831, y: 845 },
      { code: "BZ", label: "Bloqueo zona", grupo: "bloqueos", x: 960, y: 317 },
      { code: "BC", label: "Bloqueo corta", grupo: "bloqueos", x: 880, y: 233 },
      { code: "RC", label: "Rechace corto", grupo: "rechace", x: 590, y: 531 },
      { code: "RL", label: "Rechace largo", grupo: "rechace", x: 906, y: 537 },
      { code: "R1", label: "Rematador 1", grupo: "rematadores", x: 1000, y: 455 },
      { code: "R2", label: "Rematador 2", grupo: "rematadores", x: 1076, y: 415 },
      { code: "R3", label: "Rematador 3", grupo: "rematadores", x: 1152, y: 375 },
      { code: "D1", label: "Defensa 1", grupo: "cierra", x: 154, y: 258 },
      { code: "Z1", label: "Zaguero 1", grupo: "cierra", x: 290, y: 356 },
    ]),
    notas: [
      "1. Remate detrás de corta.",
      "2. Prolongación en primero.",
      "3. Pisada para segundo.",
      "Si hay 2x1 jugar rápido en corto para terminar acción.",
    ],
  },
  {
    key: "falta-lat-of",
    rev: 2,
    titulo: "FALTA LATERAL OFENSIVA",
    vista: "porteria",
    lado: "ofensivo",
    grupos: [
      { key: "lanzadores", label: "LANZADORES" },
      { key: "bloqueo", label: "BLOQUEO Y CARRERA" },
      { key: "rechace", label: "RECHACE" },
      { key: "rematadores", label: "REMATADORES" },
      { key: "equilibra", label: "EQUILIBRA Y CORTA" },
    ],
    puestos: puestos("falta-lat-of", [
      { code: "E", label: "Ejecutor", grupo: "lanzadores", x: 831, y: 845 },
      { code: "C", label: "Corta", grupo: "lanzadores", x: 148, y: 550 },
      { code: "BR", label: "Bloqueo y carrera", grupo: "bloqueo", x: 781, y: 401 },
      { code: "RE", label: "Rechace", grupo: "rechace", x: 711, y: 677 },
      { code: "R1", label: "Rematador 1", grupo: "rematadores", x: 824, y: 466 },
      { code: "R2", label: "Rematador 2", grupo: "rematadores", x: 900, y: 466 },
      { code: "R3", label: "Rematador 3", grupo: "rematadores", x: 976, y: 466 },
      { code: "R4", label: "Rematador 4", grupo: "rematadores", x: 1052, y: 466 },
      { code: "D1", label: "Equilibra", grupo: "equilibra", x: 250, y: 760 },
      { code: "Z1", label: "Corta atrás", grupo: "equilibra", x: 326, y: 804 },
    ]),
    notas: [
      "Carril exterior: pasada · 2º palo.",
      "Carril interior: superar corta · penalti.",
      "Segunda falta lateral: zona 1.",
      "Si hay ventaja exterior sacar rápido corto para amenazar.",
    ],
  },
  {
    key: "directas",
    rev: 3,
    titulo: "DIRECTAS A PORTERÍA",
    vista: "porteria",
    lado: "ofensivo",
    grupos: [
      { key: "lado-i", label: "LANZADORES LADO I" },
      { key: "lado-d", label: "LANZADORES LADO D" },
      { key: "penaltis", label: "PENALTIS" },
    ],
    /*
    | Esta diapositiva era sólo una lista: nueve nombres en el panel y el campo
    | entero vacío. Ahora dice DESDE DÓNDE se lanza y **quiénes** lanzan.
    |
    | Los tres de cada sitio van al campo, en columna detrás de su marca: el
    | primero de pie sobre el balón y los otros dos por detrás, en la fila de
    | espera. Antes sólo se plantaba el primero y el segundo y el tercero
    | vivían en el panel; el orden se leía, pero las caras no se veían, que es
    | justo lo que la sala mira. Se eligen los tres de una vez (`elegirEnGrupo`).
    |
    | Las columnas van a 160 px de separación —la ficha mide 120 de alta y su
    | chapa 30— para que ninguna cara tape la chapa de la de delante. La del
    | lado derecho se ha traído de 1135 a 1100, marca incluida: a 1135 la ficha
    | llegaba a 1183 y se metía debajo de la caja de consignas, que empieza en
    | 1153 y se pinta por encima.
    */
    elegirEnGrupo: ["lado-i", "lado-d", "penaltis"],
    repite: true,
    puestos: puestos("directas", [
      { code: "I1", label: "Lado izquierdo · 1", grupo: "lado-i", x: 415, y: 585 },
      { code: "I2", label: "Lado izquierdo · 2", grupo: "lado-i", x: 415, y: 745 },
      { code: "I3", label: "Lado izquierdo · 3", grupo: "lado-i", x: 415, y: 905 },
      { code: "D1", label: "Lado derecho · 1", grupo: "lado-d", x: 1100, y: 585 },
      { code: "D2", label: "Lado derecho · 2", grupo: "lado-d", x: 1100, y: 745 },
      { code: "D3", label: "Lado derecho · 3", grupo: "lado-d", x: 1100, y: 905 },
      { code: "P1", label: "Penalti · 1", grupo: "penaltis", x: 768, y: 430 },
      { code: "P2", label: "Penalti · 2", grupo: "penaltis", x: 768, y: 590 },
      { code: "P3", label: "Penalti · 3", grupo: "penaltis", x: 768, y: 750 },
    ]),
    adornos: [
      { tipo: "zona", x: 415, y: 585, label: "Lado I" },
      { tipo: "zona", x: 768, y: 430, label: "Penalti" },
      { tipo: "zona", x: 1100, y: 585, label: "Lado D" },
    ],
    notas: ["Orden de lanzamiento cerrado antes del partido."],
  },
  {
    key: "corner-def",
    rev: 3,
    titulo: "CÓRNER DEFENSIVO",
    vista: "ancho",
    lado: "defensivo",
    grupos: [
      { key: "corta", label: "CORTA" },
      { key: "balon", label: "BALÓN" },
      { key: "marcas", label: "MARCAS" },
      { key: "rechace", label: "RL / MARCA" },
    ],
    puestos: puestos("corner-def", [
      { code: "C", label: "Corta", grupo: "corta", x: 788, y: 254 },
      { code: "B", label: "Balón", grupo: "balon", x: 866, y: 273 },
      { code: "M1", label: "Marca 1", grupo: "marcas", x: 946, y: 351 },
      { code: "M2", label: "Marca 2", grupo: "marcas", x: 1020, y: 351 },
      { code: "M3", label: "Marca 3", grupo: "marcas", x: 1094, y: 351 },
      { code: "M4", label: "Marca 4", grupo: "marcas", x: 1168, y: 351 },
      { code: "M5", label: "Marca 5", grupo: "marcas", x: 1242, y: 351 },
      { code: "RC", label: "Rechace corto", grupo: "rechace", x: 374, y: 350 },
      { code: "RL", label: "Rechace largo", grupo: "rechace", x: 933, y: 510 },
      { code: "AR", label: "Área", grupo: "rechace", x: 727, y: 506 },
    ]),
    /* Cada marca es un rival con nombre y apellidos, pero el dorsal no se sabe
       hasta que salen al campo: la casilla va en blanco y se rellena a boli. */
    dorsal: ["marcas"],
    adornos: [
      { tipo: "transicion", label: "Defendemos el córner", remate: "Volamos todos para hacer gol" },
    ],
    notas: [
      "Marcas: área pequeña «por delante».",
      "Marcas: hasta punto de penalti «marca pegada».",
      "Marcas: amenaza lejana «distancia de brazo».",
      "Bloqueos: cambio de marca.",
      "Bloques de 3 o más rivales: el último libra para marcar a la primera amenaza.",
    ],
  },
  {
    key: "falta-lat-def",
    rev: 2,
    titulo: "FALTA LATERAL DEFENSIVA",
    vista: "porteria",
    lado: "defensivo",
    grupos: [
      { key: "corta", label: "CORTA" },
      { key: "marcas", label: "MARCAS" },
      { key: "zona", label: "ZONA" },
    ],
    puestos: puestos("falta-lat-def", [
      { code: "C", label: "Corta", grupo: "corta", x: 680, y: 467 },
      { code: "M1", label: "Marca 1", grupo: "marcas", x: 787, y: 467 },
      { code: "M2", label: "Marca 2", grupo: "marcas", x: 857, y: 467 },
      { code: "M3", label: "Marca 3", grupo: "marcas", x: 927, y: 467 },
      { code: "M4", label: "Marca 4", grupo: "marcas", x: 997, y: 467 },
      { code: "M5", label: "Marca 5", grupo: "marcas", x: 1067, y: 467 },
      { code: "M6", label: "Marca 6", grupo: "marcas", x: 1137, y: 467 },
      { code: "AR", label: "Área", grupo: "zona", x: 425, y: 621 },
      { code: "RC", label: "Rechace corto", grupo: "zona", x: 879, y: 561 },
      { code: "RL", label: "Rechace largo", grupo: "zona", x: 1056, y: 560 },
    ]),
    adornos: [
      { tipo: "transicion", label: "Defendemos la falta", remate: "Volamos todos para hacer gol" },
    ],
    notas: [
      "Voz de mando.",
      "Amenaza delante de la corta: comunicación · 2º con la corta.",
      "Ante amagos, si nos movemos nos mantenemos.",
    ],
  },
  {
    key: "falta-dir-def",
    rev: 2,
    titulo: "FALTA DIRECTA DEFENSIVA",
    vista: "porteria",
    lado: "defensivo",
    grupos: [
      { key: "barrera", label: "BARRERA" },
      { key: "suelo", label: "SUELO" },
      { key: "segunda", label: "2ª JUGADA" },
    ],
    /*
    | La barrera es de cinco: dos laterales en los extremos, dos centrales y la
    | punta. Los dos laterales se llaman «L» y los dos centrales «C» —así se
    | dice en el campo—, pero por dentro cada puesto necesita su propia clave
    | para que la memoria sepa quién va en cada sitio: de ahí `LD` y `C2`, que
    | se leen «L» y «C».
    |
    | Y van a 76 px unos de otros, no a 60: con la ficha de 96 de ancha, la cara
    | del de la derecha tapaba la chapa del de al lado y en la diapositiva
    | impresa no se sabía quién era el cuarto de la barrera.
    */
    puestos: puestos("falta-dir-def", [
      { code: "L", label: "Barrera · lateral I", grupo: "barrera", x: 600, y: 467 },
      { code: "C2", sigla: "C", label: "Barrera · central I", grupo: "barrera", x: 676, y: 467 },
      { code: "C", label: "Barrera · central D", grupo: "barrera", x: 752, y: 467 },
      { code: "9", label: "Barrera · punta", grupo: "barrera", x: 828, y: 467 },
      { code: "LD", sigla: "L", label: "Barrera · lateral D", grupo: "barrera", x: 904, y: 467 },
      { code: "SU", label: "Suelo", grupo: "suelo", x: 742, y: 317 },
      { code: "AR", label: "Área", grupo: "segunda", x: 418, y: 556 },
      { code: "RL", label: "Rechace largo", grupo: "segunda", x: 865, y: 576 },
      { code: "2A", label: "2ª jugada", grupo: "segunda", x: 1005, y: 469 },
      { code: "2B", label: "2ª jugada", grupo: "segunda", x: 1120, y: 467 },
    ]),
    adornos: [
      { tipo: "transicion", label: "Aguanta la barrera", remate: "Volamos todos para hacer gol" },
    ],
    notas: [
      "En barreras de menor número se mantienen laterales y, si es necesario, punta.",
      "Centrales a marcar si no es barrera de 5.",
    ],
  },
  {
    key: "banda-def",
    rev: 2,
    titulo: "SAQUE DE BANDA DEFENSIVO",
    vista: "porteria",
    lado: "defensivo",
    grupos: [
      { key: "sacador", label: "SACADOR" },
      { key: "banda", label: "DEF BANDA" },
      { key: "area", label: "ÁREA" },
    ],
    puestos: puestos("banda-def", [
      { code: "S", label: "Al sacador", grupo: "sacador", x: 339, y: 345 },
      { code: "DB", label: "Defensa de banda", grupo: "banda", x: 345, y: 555 },
      { code: "C", label: "Corta", grupo: "banda", x: 529, y: 346 },
      { code: "M1", label: "Marca 1", grupo: "area", x: 579, y: 487 },
      { code: "M2", label: "Marca 2", grupo: "area", x: 648, y: 361 },
      { code: "M3", label: "Marca 3", grupo: "area", x: 723, y: 471 },
      { code: "M4", label: "Marca 4", grupo: "area", x: 818, y: 365 },
      { code: "M5", label: "Marca 5", grupo: "area", x: 929, y: 363 },
      { code: "RC", label: "Rechace corto", grupo: "area", x: 639, y: 561 },
      { code: "RL", label: "Rechace largo", grupo: "area", x: 936, y: 523 },
    ]),
    adornos: [
      { tipo: "transicion", label: "Ganamos el duelo", remate: "Volamos todos para hacer gol" },
    ],
    notas: [
      "Atención a la segunda acción tras el duelo.",
      "Despeje expeditivo con la pierna corta.",
    ],
  },
  {
    key: "libre",
    rev: 2,
    titulo: "PIZARRA LIBRE",
    vista: "ancho",
    lado: "ofensivo",
    grupos: [{ key: "campo", label: "EN EL CAMPO" }],
    puestos: [],
    notas: [],
  },
];

export const PLANTILLA_BY_KEY = new Map(
  PLANTILLAS.map((plantilla) => [plantilla.key, plantilla]),
);

/** Las siete de la plantilla de partido, en el orden en que se presentan. */
export const ORDEN_POR_DEFECTO = [
  "corner-of",
  "falta-lat-of",
  "directas",
  "corner-def",
  "falta-lat-def",
  "falta-dir-def",
  "banda-def",
];

/* ------------------------------------------------------------------ */
/*  EL DOCUMENTO                                                       */
/* ------------------------------------------------------------------ */

/** Una cara en el tablero. Sin `puesto` es una ficha suelta. */
export type FichaPizarra = {
  id: string;
  playerId: string;
  /** Clave del puesto que ocupa, o `null` si está puesta a mano. */
  puesto: string | null;
  /** Posición de la chapa en el lienzo de 1920×1080. */
  x: number;
  y: number;
};

export type SlidePizarra = {
  id: string;
  /** De qué plantilla salió: manda la vista, los grupos y los puestos. */
  plantilla: string;
  /** Se puede cambiar sin tocar la plantilla. */
  titulo: string;
  vista: VistaCampo;
  fichas: FichaPizarra[];
  notas: string[];
  /** Con qué versión del dibujo de la plantilla se colocaron las fichas. */
  rev?: number;
};

/**
 * Por qué se guardó una versión.
 *
 * Se anota para que el histórico se lea sin adivinar: no es lo mismo la foto
 * que la app hace sola cuando el entrenador deja de tocar que la que él guarda
 * a propósito antes de enseñarla en la sala.
 */
export type MotivoVersion = "auto" | "mano" | "copia" | "previa";

export const MOTIVO_LABEL: Record<MotivoVersion, string> = {
  auto: "Automática",
  mano: "Guardada a mano",
  copia: "Traída de otra jornada",
  previa: "Antes de restaurar",
};

/**
 * Una jornada entera congelada.
 *
 * Guarda las diapositivas **y el nombre del rival**, porque el nombre se puede
 * escribir a mano y una versión tiene que poder decir contra quién se montó
 * aunque después se haya reescrito.
 */
export type VersionPizarra = {
  id: string;
  /** ISO de cuándo se guardó. */
  creada: string;
  /** Lo que se lee en la lista del histórico. */
  etiqueta: string;
  rival: string;
  motivo: MotivoVersion;
  /** Marcada a mano: no se cae nunca del histórico. */
  fijada?: boolean;
  slides: SlidePizarra[];
};

export type TableroPizarra = {
  /** `matchId` de `lib/ratings/matches`. */
  partidoId: string;
  /**
   * Contra quién se juega, **tal y como se quiere leer en la diapositiva**.
   *
   * Arranca con el nombre del calendario, pero se puede escribir a mano: la
   * hoja llama «CD Teruel» a quien en la sala se llama «Teruel», y la
   * diapositiva se proyecta, así que manda lo que escribe el cuerpo técnico.
   */
  rival: string;
  /** Jornada de la hoja RIVALES, cuando el tablero se ata a una fila. */
  jornada?: string;
  /**
   * `ID` de la fila de la hoja RIVALES.
   *
   * Es la misma llave con la que se abren el plan de partido
   * (`/match-preparation?rival=<ID>`) y el informe del rival
   * (`/scout-rival-collective?rival=<ID>`): con esto la pizarra deja de ser
   * una isla.
   */
  rivalId?: string;
  slides: SlidePizarra[];
  /** ISO del último cambio. */
  actualizado?: string;
  /** El histórico de la jornada, de lo más reciente a lo más antiguo. */
  versiones?: VersionPizarra[];
};

/**
 * Lo que la app ha aprendido de los puestos.
 *
 * Por cada puesto, quién lo ha ocupado, cuántas veces y cuándo fue la última.
 * No es una preferencia declarada a mano: se anota sola cada vez que alguien
 * se coloca, que es como el cuerpo técnico ya decide —por costumbre— quién
 * saca los córners.
 */
export type MemoriaPuesto = {
  playerId: string;
  veces: number;
  /** ISO de la última vez. Desempata cuando dos llevan las mismas veces. */
  ultima: string;
};

export type MemoriaPizarra = Record<string, MemoriaPuesto[]>;

export type PizarraStore = {
  tableros: Record<string, TableroPizarra>;
  memoria: MemoriaPizarra;
};

export const EMPTY_PIZARRA_STORE: PizarraStore = { tableros: {}, memoria: {} };

/* `crypto.randomUUID` no está en todos los navegadores de la caseta. */
function nuevoId(prefijo: string) {
  return `${prefijo}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/*  CONSTRUCCIÓN                                                       */
/* ------------------------------------------------------------------ */

export function slideDePlantilla(key: string): SlidePizarra {
  const plantilla = PLANTILLA_BY_KEY.get(key) ?? PLANTILLAS[0];

  return {
    id: nuevoId("SL"),
    plantilla: plantilla.key,
    titulo: plantilla.titulo,
    vista: plantilla.vista,
    fichas: [],
    notas: [...plantilla.notas],
    rev: plantilla.rev,
  };
}

/* ------------------------------------------------------------------ */
/*  AL DÍA CON LA PLANTILLA                                            */
/* ------------------------------------------------------------------ */

/**
 * Replanta las fichas de un tablero cuando su plantilla ha cambiado de dibujo.
 *
 * Se hace **al leer**, no al guardar: así una jornada montada hace semanas se
 * abre ya con la barrera de cinco y las filas separadas, sin pedirle a nadie
 * que la rehaga, y la corrección viaja también a lo que se exporta. Sólo se
 * tocan las fichas que ocupan un puesto —las sueltas, las que alguien puso a
 * mano donde quiso, se quedan donde están—.
 *
 * Devuelve **el mismo objeto** si no hay nada que cambiar: la pizarra se lee en
 * cada render y crear un tablero nuevo cada vez dispararía el autoguardado.
 */
export function normalizaTablero(tablero: TableroPizarra): TableroPizarra {
  let tocado = false;

  const slides = tablero.slides.map((slide) => {
    const plantilla = PLANTILLA_BY_KEY.get(slide.plantilla);

    if (!plantilla || slide.rev === plantilla.rev) return slide;

    const porClave = new Map(
      plantilla.puestos.map((puesto) => [puesto.key, puesto]),
    );

    const fichas = slide.fichas.map((ficha) => {
      if (!ficha.puesto) return ficha;

      const puesto = porClave.get(ficha.puesto);

      /* El puesto ya no existe en la plantilla: la ficha se queda suelta. */
      if (!puesto) return { ...ficha, puesto: null };

      const { x, y } = sitioDe(puesto);

      return ficha.x === x && ficha.y === y ? ficha : { ...ficha, x, y };
    });

    tocado = true;

    return { ...slide, fichas, rev: plantilla.rev };
  });

  return tocado ? { ...tablero, slides } : tablero;
}

export function tableroVacio(partidoId: string, rival: string): TableroPizarra {
  return {
    partidoId,
    rival,
    slides: ORDEN_POR_DEFECTO.map(slideDePlantilla),
    versiones: [],
  };
}

/**
 * Trae las diapositivas de otra jornada a este tablero.
 *
 * Se conservan las fichas —quién está en cada puesto y dónde— y las notas, que
 * es justo lo que no se quiere volver a montar. Los identificadores se renuevan
 * para que las dos semanas no compartan objeto.
 *
 * **Lo del destino que no son diapositivas no se toca**: el nombre del rival,
 * la jornada a la que está atado y, sobre todo, su histórico. Copiar la semana
 * pasada es empezar la de esta, no borrar lo que ya se había guardado aquí.
 */
export function copiaTablero(
  origen: TableroPizarra,
  destino: TableroPizarra,
  cuando: string,
): TableroPizarra {
  return {
    ...destino,
    actualizado: cuando,
    slides: origen.slides.map((slide) => ({
      ...slide,
      id: nuevoId("SL"),
      notas: [...slide.notas],
      fichas: slide.fichas.map((ficha) => ({ ...ficha, id: nuevoId("FI") })),
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  HISTÓRICO DE LA JORNADA                                            */
/* ------------------------------------------------------------------ */

/**
 * Cuántas versiones automáticas se guardan por jornada.
 *
 * El histórico vive dentro del mismo documento que la pizarra, así que no
 * puede crecer sin freno: cada versión son las siete diapositivas enteras. Las
 * **fijadas no cuentan** —esas las ha marcado alguien a propósito— y las
 * automáticas viejas se van cayendo por abajo.
 */
export const MAX_VERSIONES = 20;

/**
 * La huella de un tablero: rival y diapositivas, sin identificadores.
 *
 * Sirve para no guardar dos versiones iguales. Los `id` se dejan fuera a
 * propósito: al traer la jornada anterior se renuevan todos y la pizarra sería
 * «distinta» sin que haya cambiado ni un nombre.
 */
export function huellaTablero(rival: string, slides: SlidePizarra[]) {
  return JSON.stringify([
    rival.trim(),
    slides.map((slide) => [
      slide.plantilla,
      slide.titulo,
      slide.vista,
      slide.notas,
      [...slide.fichas]
        .map((ficha) => [ficha.playerId, ficha.puesto, Math.round(ficha.x), Math.round(ficha.y)])
        .sort((a, b) => String(a).localeCompare(String(b))),
    ]),
  ]);
}

export function huellaVersion(version: VersionPizarra) {
  return huellaTablero(version.rival, version.slides);
}

/** Si no hay una sola cara puesta, no hay pizarra que guardar. */
export function tieneFichas(slides: SlidePizarra[]) {
  return slides.some((slide) => slide.fichas.length > 0);
}

const fechaVersion = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "26 ago, 16:03", que es como se busca una versión: por cuándo fue. */
export function etiquetaVersion(cuando: string) {
  const fecha = new Date(cuando);

  return Number.isNaN(fecha.getTime()) ? cuando : fechaVersion.format(fecha);
}

/**
 * Congela el tablero tal y como está ahora y lo mete en su histórico.
 *
 * Si lo que hay ya es idéntico a la última versión guardada no se apunta nada:
 * el histórico de una jornada tiene que poder leerse, y veinte fotos iguales no
 * cuentan nada de cómo se llegó a la pizarra final.
 */
export function registraVersion(
  tablero: TableroPizarra,
  opciones: {
    cuando: string;
    motivo: MotivoVersion;
    etiqueta?: string;
    fijada?: boolean;
    /** Guardar aunque no haya cambiado nada: lo pide alguien a mano. */
    forzar?: boolean;
  },
): TableroPizarra {
  const versiones = tablero.versiones ?? [];

  const huella = huellaTablero(tablero.rival, tablero.slides);

  if (!opciones.forzar && versiones[0] && huellaVersion(versiones[0]) === huella) {
    return tablero;
  }

  const version: VersionPizarra = {
    id: nuevoId("VE"),
    creada: opciones.cuando,
    etiqueta: opciones.etiqueta?.trim() || etiquetaVersion(opciones.cuando),
    rival: tablero.rival,
    motivo: opciones.motivo,
    ...(opciones.fijada ? { fijada: true } : {}),
    slides: tablero.slides.map((slide) => ({
      ...slide,
      notas: [...slide.notas],
      fichas: slide.fichas.map((ficha) => ({ ...ficha })),
    })),
  };

  return { ...tablero, versiones: podaVersiones([version, ...versiones]) };
}

/** Deja las fijadas y las `MAX_VERSIONES` automáticas más recientes. */
export function podaVersiones(versiones: VersionPizarra[]) {
  let sueltas = 0;

  return versiones.filter((version) => {
    if (version.fijada) return true;

    sueltas += 1;

    return sueltas <= MAX_VERSIONES;
  });
}

/**
 * Vuelve a una versión del histórico.
 *
 * Las diapositivas se copian con identificadores nuevos —para que editar la
 * pizarra no reescriba la versión guardada— y el nombre del rival vuelve al
 * que tenía entonces, que es parte de lo que se está restaurando.
 */
export function aplicaVersion(
  tablero: TableroPizarra,
  versionId: string,
  cuando: string,
): TableroPizarra {
  const version = (tablero.versiones ?? []).find((item) => item.id === versionId);

  if (!version) return tablero;

  return {
    ...tablero,
    rival: version.rival,
    actualizado: cuando,
    slides: version.slides.map((slide) => ({
      ...slide,
      id: nuevoId("SL"),
      notas: [...slide.notas],
      fichas: slide.fichas.map((ficha) => ({ ...ficha, id: nuevoId("FI") })),
    })),
  };
}

export function fijaVersion(
  tablero: TableroPizarra,
  versionId: string,
  fijada: boolean,
): TableroPizarra {
  return {
    ...tablero,
    versiones: (tablero.versiones ?? []).map((version) =>
      version.id === versionId ? { ...version, fijada } : version,
    ),
  };
}

export function renombraVersion(
  tablero: TableroPizarra,
  versionId: string,
  etiqueta: string,
): TableroPizarra {
  return {
    ...tablero,
    versiones: (tablero.versiones ?? []).map((version) =>
      version.id === versionId
        ? { ...version, etiqueta: etiqueta.trim() || etiquetaVersion(version.creada) }
        : version,
    ),
  };
}

export function quitaVersion(tablero: TableroPizarra, versionId: string): TableroPizarra {
  return {
    ...tablero,
    versiones: (tablero.versiones ?? []).filter((version) => version.id !== versionId),
  };
}

/** El puesto con su plantilla resuelta. */
export function puestosDe(slide: SlidePizarra): PuestoAbp[] {
  return PLANTILLA_BY_KEY.get(slide.plantilla)?.puestos ?? [];
}

export function gruposDe(slide: SlidePizarra): GrupoAbp[] {
  return PLANTILLA_BY_KEY.get(slide.plantilla)?.grupos ?? [];
}

export function adornosDe(slide: SlidePizarra): AdornoAbp[] {
  return PLANTILLA_BY_KEY.get(slide.plantilla)?.adornos ?? [];
}

/** Si el puesto lleva casilla en blanco para el dorsal del rival. */
export function pideDorsal(slide: SlidePizarra, puesto: PuestoAbp) {
  return (PLANTILLA_BY_KEY.get(slide.plantilla)?.dorsal ?? []).includes(
    puesto.grupo,
  );
}

/** Si el grupo se elige entero de una vez y no puesto a puesto. */
export function eligeEnGrupo(slide: SlidePizarra, grupoKey: string) {
  return (PLANTILLA_BY_KEY.get(slide.plantilla)?.elegirEnGrupo ?? []).includes(
    grupoKey,
  );
}

/**
 * Si en esta diapositiva la misma cara puede salir en varios sitios.
 *
 * Sólo lo dicen las plantillas donde los grupos son opciones y no puestos de
 * una misma jugada —las directas—. En el resto, poner a alguien en un puesto
 * le saca del anterior.
 */
export function admiteRepetidos(slide: SlidePizarra) {
  return PLANTILLA_BY_KEY.get(slide.plantilla)?.repite === true;
}

/** Los puestos de un grupo, en el orden en que los escribe la plantilla. */
export function puestosDeGrupo(slide: SlidePizarra, grupoKey: string) {
  return puestosDe(slide).filter((puesto) => puesto.grupo === grupoKey);
}

/** Quién ocupa un grupo, por orden de puesto y sin los huecos. */
export function ocupantesDeGrupo(slide: SlidePizarra, grupoKey: string) {
  return puestosDeGrupo(slide, grupoKey)
    .map(
      (puesto) =>
        slide.fichas.find((ficha) => ficha.puesto === puesto.key)?.playerId,
    )
    .filter(Boolean) as string[];
}

/**
 * Lo aprendido en todos los puestos de un grupo, sumado y por prioridad.
 *
 * Eligiendo por grupo, «los habituales» no pueden ser los del puesto pulsado:
 * quien lanzó el año pasado desde la izquierda es el habitual del lado, no del
 * hueco número dos. Se suman las veces de los tres puestos y se ordena igual
 * que la memoria de uno solo.
 */
export function memoriaDeGrupo(memoria: MemoriaPizarra, puestos: PuestoAbp[]) {
  const suma = new Map<string, MemoriaPuesto>();

  puestos.forEach((puesto) => {
    (memoria[puesto.key] ?? []).forEach((item) => {
      const previo = suma.get(item.playerId);

      suma.set(
        item.playerId,
        previo
          ? {
              playerId: item.playerId,
              veces: previo.veces + item.veces,
              ultima: previo.ultima > item.ultima ? previo.ultima : item.ultima,
            }
          : { ...item },
      );
    });
  });

  return ordenaMemoria([...suma.values()]);
}

/**
 * Deja en un grupo justo a los elegidos, por orden.
 *
 * Los que repiten puesto **conservan su ficha**: si alguien ya estaba de
 * primero del lado izquierdo y sólo se añade un tercero, la cara del primero
 * no se replanta y se queda donde el entrenador la hubiera arrastrado. Los
 * elegidos que estuvieran en otro puesto de la diapositiva se mueven aquí, que
 * es la misma regla que al asignar de uno en uno: nadie sale dos veces.
 *
 * Salvo donde la plantilla dice lo contrario (`repite`). En las directas los
 * grupos son opciones —izquierda, derecha, penalti— y no puestos de una misma
 * jugada: elegir al mismo tirador en dos de ellas es la decisión, no un
 * despiste, y no se le quita del otro sitio.
 */
export function conElegidosDelGrupo(
  slide: SlidePizarra,
  puestos: PuestoAbp[],
  playerIds: string[],
): SlidePizarra {
  const claves = new Set(puestos.map((puesto) => puesto.key));

  const elegidos = playerIds.slice(0, puestos.length);

  const repite = admiteRepetidos(slide);

  const previas = new Map(
    slide.fichas
      .filter((ficha) => ficha.puesto && claves.has(ficha.puesto))
      .map((ficha) => [ficha.puesto as string, ficha]),
  );

  const limpio = slide.fichas.filter(
    (ficha) =>
      !(ficha.puesto && claves.has(ficha.puesto)) &&
      (repite || !elegidos.includes(ficha.playerId)),
  );

  const nuevas = elegidos.map((playerId, indice) => {
    const previa = previas.get(puestos[indice].key);

    return previa && previa.playerId === playerId
      ? previa
      : fichaNueva(playerId, puestos[indice]);
  });

  return { ...slide, fichas: [...limpio, ...nuevas] };
}

export function puestoDe(slide: SlidePizarra, key: string | null) {
  if (!key) return null;

  return puestosDe(slide).find((puesto) => puesto.key === key) ?? null;
}

/**
 * Dónde cae una ficha nueva de un puesto.
 *
 * Los puestos de campo traen su sitio de la plantilla. Los que sólo viven en
 * el panel —lanzadores, penaltis— no se pintan en el campo, y por eso se les
 * da una posición fuera de él: la pizarra no los dibuja.
 */
export function sitioDe(puesto: PuestoAbp | null, indice = 0) {
  if (puesto?.x != null && puesto?.y != null) {
    return { x: puesto.x, y: puesto.y };
  }

  if (puesto) return { x: -1, y: -1 };

  /* Ficha suelta: en fila por el centro del campo, sin taparse. */
  return { x: 300 + (indice % 8) * 110, y: 620 + Math.floor(indice / 8) * 120 };
}

export function fichaNueva(
  playerId: string,
  puesto: PuestoAbp | null,
  indice = 0,
): FichaPizarra {
  const { x, y } = sitioDe(puesto, indice);

  return { id: nuevoId("FI"), playerId, puesto: puesto?.key ?? null, x, y };
}

/** Una ficha del panel, sin sitio en el campo, no se dibuja sobre el césped. */
export function enElCampo(ficha: FichaPizarra) {
  return ficha.x >= 0 && ficha.y >= 0;
}

/* ------------------------------------------------------------------ */
/*  MEMORIA DE PUESTOS                                                 */
/* ------------------------------------------------------------------ */

/**
 * Anota que un jugador ha ocupado un puesto.
 *
 * Se cuenta por puesto y no por grupo: «rematador 1» y «rematador 3» son dos
 * sitios distintos del área y el que va al primer palo no es el que va al
 * segundo. La lista se deja ya ordenada por prioridad para que leerla sea
 * gratis.
 */
export function aprende(
  memoria: MemoriaPizarra,
  puesto: string,
  playerId: string,
  cuando: string,
): MemoriaPizarra {
  const lista = memoria[puesto] ?? [];

  const anterior = lista.find((item) => item.playerId === playerId);

  const siguiente = anterior
    ? lista.map((item) =>
        item.playerId === playerId
          ? { ...item, veces: item.veces + 1, ultima: cuando }
          : item,
      )
    : [...lista, { playerId, veces: 1, ultima: cuando }];

  return { ...memoria, [puesto]: ordenaMemoria(siguiente) };
}

/** Manda quién lo ha hecho más veces; a igualdad, quien lo hizo más tarde. */
export function ordenaMemoria(lista: MemoriaPuesto[]) {
  return [...lista].sort(
    (a, b) => b.veces - a.veces || b.ultima.localeCompare(a.ultima),
  );
}

/** Los candidatos de un puesto, por prioridad. */
export function prioridadDe(memoria: MemoriaPizarra, puesto: string) {
  return (memoria[puesto] ?? []).map((item) => item.playerId);
}

/**
 * Rellena los puestos vacíos de una diapositiva con lo aprendido.
 *
 * Dos reglas y las dos importan. **Nadie se repite dentro de una diapositiva**:
 * un jugador no puede ser a la vez el rematador 1 y el que cierra, y la memoria
 * por sí sola lo propondría para los dos. Y **no se toca lo que ya está
 * puesto**: si el entrenador ha colocado a alguien a mano, colocar
 * automáticamente rellena lo que falta, no rehace su trabajo.
 *
 * En las diapositivas de opciones (`repite`) la primera regla se estrecha a
 * cada grupo: el mismo tirador puede salir en la izquierda, en la derecha y en
 * el penalti —que es lo normal— pero no dos veces en el mismo lado.
 *
 * Devuelve las fichas nuevas; los puestos sin candidato se quedan vacíos, que
 * es más honesto que poner al primero de la plantilla.
 */
export function colocaAutomatico(
  slide: SlidePizarra,
  memoria: MemoriaPizarra,
  disponibles: Set<string>,
): FichaPizarra[] {
  const ocupados = new Set(
    slide.fichas.map((ficha) => ficha.puesto).filter(Boolean) as string[],
  );

  const repite = admiteRepetidos(slide);

  const puestos = puestosDe(slide);

  const puestoPorClave = new Map(
    puestos.map((puesto) => [puesto.key, puesto]),
  );

  /*
  | Con `repite`, un cubo por grupo; sin él, uno para toda la diapositiva. Se
  | crean todos de antemano: una ficha suelta tiene que caer en los cubos de
  | los grupos que todavía no ha visitado nadie.
  */
  const cubos = new Map<string, Set<string>>(
    (repite ? [...new Set(puestos.map((puesto) => puesto.grupo))] : ["*"]).map(
      (clave) => [clave, new Set<string>()],
    ),
  );

  const cuboDe = (grupo: string) => {
    const clave = repite ? grupo : "*";

    let cubo = cubos.get(clave);

    if (!cubo) {
      cubo = new Set<string>();
      cubos.set(clave, cubo);
    }

    return cubo;
  };

  slide.fichas.forEach((ficha) => {
    const grupo = ficha.puesto
      ? puestoPorClave.get(ficha.puesto)?.grupo
      : undefined;

    /* Una ficha suelta —sin puesto— no es de nadie: ocupa en toda la hoja. */
    if (repite && !grupo) {
      cubos.forEach((cubo) => cubo.add(ficha.playerId));

      return;
    }

    cuboDe(grupo ?? "*").add(ficha.playerId);
  });

  const nuevas: FichaPizarra[] = [];

  puestos.forEach((puesto) => {
    if (ocupados.has(puesto.key)) return;

    const usados = cuboDe(puesto.grupo);

    const elegido = prioridadDe(memoria, puesto.key).find(
      (playerId) => disponibles.has(playerId) && !usados.has(playerId),
    );

    if (!elegido) return;

    usados.add(elegido);
    nuevas.push(fichaNueva(elegido, puesto));
  });

  return nuevas;
}

/**
 * Cuántos puestos de la diapositiva tienen a alguien.
 *
 * Se cuentan cruzando con la plantilla y no contando las fichas: una pizarra
 * guardada hace semanas puede llevar fichas de un puesto que la plantilla ya
 * no tiene, y contándolas a secas salía «11/10 puestos».
 */
export function cuentaPuestos(slide: SlidePizarra) {
  const puestos = puestosDe(slide);

  const ocupados = new Set(
    slide.fichas.map((ficha) => ficha.puesto).filter(Boolean) as string[],
  );

  return {
    total: puestos.length,
    cubiertos: puestos.filter((puesto) => ocupados.has(puesto.key)).length,
  };
}
