/**
 * CODING DE PARTIDO · la pizarra de vídeo (telestración).
 *
 * Pintar encima del partido es la mitad del análisis: el clip enseña **qué**
 * pasó y el dibujo enseña **qué había que ver**. Esto es el motor de esa
 * pizarra —el modelo de lo que se dibuja y cómo se pinta en un `<canvas>`—,
 * sin una sola línea de React, para que la pantalla sólo tenga que decidir
 * cuándo llamarlo.
 *
 * Tres decisiones mandan sobre todo lo demás:
 *
 * **Todo se guarda en coordenadas de 0 a 1.** Ni un píxel. El mismo dibujo
 * tiene que caer sobre el mismo jugador con el vídeo a media pantalla, a
 * pantalla completa y en el PNG que se exporta al doble de resolución. Un
 * grosor o un tamaño de letra en píxeles se leería enorme en un sitio y
 * invisible en otro: se guardan en unidades de una referencia de 1000 de
 * ancho y se escalan al pintar.
 *
 * **Se dibuja sobre ESCENAS, no sobre el vídeo entero.** Una escena es un
 * instante del partido (`tMs`), lo que dura en pantalla (`duracionMs`) y lo
 * que hay pintado. Así el analista puede dejar veinte pizarras repartidas por
 * el partido y verlas aparecer solas al pasar por encima, en vez de tener un
 * único garabato eterno. Y por eso hay `progreso`: dentro de su ventana, una
 * flecha puede trazarse sola y un jugador puede moverse hasta su sitio.
 *
 * **Lo que necesita ver el vídeo se pinta con el vídeo.** El foco, la lupa, el
 * difuminado y el jugador movido no son formas: son operaciones sobre la
 * imagen. Reciben el `<video>` (o una instantánea congelada del fotograma) y
 * lo dibujan ellos mismos. Nunca se leen los píxeles de vuelta —`getImageData`
 * revienta con un vídeo de otro dominio—, sólo se dibujan.
 */

/**
 * La letra de las chapas.
 *
 * La familia de verdad —la Barlow Condensed del club, con el nombre con hash
 * que le pone `next/font`— la trae quien pinta, porque `next/font` sólo puede
 * llamarse desde el árbol de componentes y este módulo lo importa también el
 * modelo de la sesión. Esto es el respaldo, no lo normal.
 */
const FAMILIA_RESPALDO = "'Barlow Condensed', system-ui, sans-serif";

/* ================================================================== */
/*  MODELO                                                             */
/* ================================================================== */

/** Un punto de la imagen, de 0 a 1. Nunca píxeles. */
export type PuntoTel = { x: number; y: number };

/**
 * Lo que se puede pintar.
 *
 * El orden de esta lista es el de la barra de herramientas, y va de lo que
 * más se usa a lo que menos: primero señalar, luego mover, luego medir.
 */
export type TipoDibujo =
  | "foco"
  | "anillo"
  | "flecha"
  | "linea"
  | "libre"
  | "zona"
  | "rect"
  | "elipse"
  | "seleccion"
  | "mover"
  | "texto"
  | "lupa"
  | "difumina"
  | "fuera-juego"
  | "medida";

export type DibujoTel = {
  id: string;
  tipo: TipoDibujo;
  /** Los puntos que definen la forma, en coordenadas de 0 a 1. */
  puntos: PuntoTel[];
  color: string;
  /** Grosor del trazo en unidades de la referencia de 1000 de ancho. */
  grosor: number;
  opacidad: number;
  relleno: boolean;
  discontinua: boolean;
  /** Se traza solo mientras dura la escena, en vez de aparecer entero. */
  animado: boolean;
  /** De -1 a 1: cuánto se comba una flecha o una línea. 0 = recta. */
  curvatura: number;
  texto: string;
  /** Cuerpo de letra, en unidades de la referencia. */
  tamano: number;
  /** Radio del anillo, la lupa o el recorte del jugador (normalizado al ancho). */
  radio: number;
  /** Aumento de la lupa. */
  zoom: number;
  /** Oscuridad del foco (0..1) o desenfoque del difuminado (px de referencia). */
  intensidad: number;
  /** El dorsal o el nombre que acompaña a un anillo o a un jugador movido. */
  etiqueta: string;
};

/**
 * Una pizarra colocada en un instante del partido.
 *
 * `congelada` es la que se comporta como la televisión: al llegar el vídeo a
 * ese fotograma se para solo, se enseña el dibujo y sigue. Va apagada por
 * defecto —parar el partido sin avisar en mitad de una revisión molesta—, pero
 * es justo lo que se quiere al enseñarle el análisis a la plantilla.
 */
export type EscenaTel = {
  id: string;
  nombre: string;
  tMs: number;
  duracionMs: number;
  /** El clip que acompaña, cuando la pizarra se creó desde uno. */
  clipId?: string;
  congelada: boolean;
  dibujos: DibujoTel[];
  creadoEn: string;
};

/** El tamaño del lienzo en píxeles de verdad (ya con el `devicePixelRatio`). */
export type MedidasTel = { ancho: number; alto: number };

/* ================================================================== */
/*  VALORES DE PARTIDA                                                 */
/* ================================================================== */

const REFERENCIA = 1000;

/** Cuánto dura una pizarra en pantalla si nadie dice otra cosa. */
export const DURACION_ESCENA_MS = 6000;

/**
 * La paleta.
 *
 * El oro del club para lo que señala, y después los colores que ya usan las
 * pizarras tácticas: azul para lo nuestro, rojo para el rival, verde para lo
 * que sale bien y ámbar para lo que hay que corregir. Blanco y negro al final
 * para las líneas que tienen que leerse sobre cualquier césped.
 */
export const PALETA_TEL: { nombre: string; color: string }[] = [
  { nombre: "Oro", color: "#C8A96B" },
  { nombre: "Azul", color: "#3B82F6" },
  { nombre: "Rojo", color: "#EF4444" },
  { nombre: "Verde", color: "#22C55E" },
  { nombre: "Ámbar", color: "#F59E0B" },
  { nombre: "Violeta", color: "#A855F7" },
  { nombre: "Cian", color: "#22D3EE" },
  { nombre: "Blanco", color: "#FFFFFF" },
  { nombre: "Negro", color: "#0B0F14" },
];

/** Cómo se llama cada herramienta y qué hace, para la barra y la ayuda. */
export const HERRAMIENTAS: {
  tipo: TipoDibujo;
  nombre: string;
  tecla: string;
  ayuda: string;
}[] = [
  {
    tipo: "foco",
    nombre: "Foco",
    tecla: "f",
    ayuda: "Apaga todo menos al jugador. Clic para el foco de siempre, o arrastra para darle forma.",
  },
  {
    tipo: "anillo",
    nombre: "Anillo",
    tecla: "r",
    ayuda: "El aro de televisión bajo los pies. Arrastra para agrandarlo.",
  },
  {
    tipo: "flecha",
    nombre: "Flecha",
    tecla: "a",
    ayuda: "Pase o carrera. Con la curvatura se comba; discontinua para lo que no lleva balón.",
  },
  { tipo: "linea", nombre: "Línea", tecla: "l", ayuda: "Una línea recta o combada, sin punta." },
  { tipo: "libre", nombre: "Lápiz", tecla: "p", ayuda: "Trazo a mano alzada." },
  {
    tipo: "zona",
    nombre: "Zona",
    tecla: "z",
    ayuda: "Polígono sombreado. Clic por cada vértice y doble clic para cerrarlo.",
  },
  { tipo: "rect", nombre: "Caja", tecla: "c", ayuda: "Rectángulo." },
  { tipo: "elipse", nombre: "Elipse", tecla: "e", ayuda: "Elipse o círculo." },
  {
    tipo: "seleccion",
    nombre: "Selección",
    tecla: "s",
    ayuda: "Clic en cada jugador: los marca y dibuja el bloque que forman. Doble clic para cerrar.",
  },
  {
    tipo: "mover",
    nombre: "Mover jugador",
    tecla: "m",
    ayuda: "Arrastra al jugador a donde tenía que estar: se recorta del fotograma y viaja hasta allí.",
  },
  { tipo: "texto", nombre: "Texto", tecla: "t", ayuda: "Una chapa con lo que hay que leer." },
  { tipo: "lupa", nombre: "Lupa", tecla: "u", ayuda: "Aumenta un trozo de la imagen." },
  { tipo: "difumina", nombre: "Difuminar", tecla: "b", ayuda: "Desenfoca lo que estorba." },
  {
    tipo: "fuera-juego",
    nombre: "Fuera de juego",
    tecla: "o",
    ayuda: "Línea de último defensor, con su franja. Gira el segundo tirador hasta casarla con el campo.",
  },
  {
    tipo: "medida",
    nombre: "Distancia",
    tecla: "d",
    ayuda: "Cota entre dos puntos. Escribe encima los metros.",
  },
];

/** Cuántos puntos pide cada herramienta para quedar hecha. */
export function formaDe(tipo: TipoDibujo): "punto" | "arrastre" | "muchos" {
  if (tipo === "texto") return "punto";
  if (tipo === "libre" || tipo === "zona" || tipo === "seleccion") return "muchos";
  return "arrastre";
}

/** Las herramientas que se dibujan con el vídeo debajo, no con formas. */
export function usaImagen(tipo: TipoDibujo) {
  return tipo === "lupa" || tipo === "difumina" || tipo === "mover";
}

const BASE_DIBUJO: Omit<DibujoTel, "id" | "tipo" | "puntos"> = {
  color: "#C8A96B",
  grosor: 5,
  opacidad: 1,
  relleno: true,
  discontinua: false,
  animado: false,
  curvatura: 0,
  texto: "",
  tamano: 26,
  radio: 0.05,
  zoom: 2,
  intensidad: 0.66,
  etiqueta: "",
};

/** Los ajustes propios de cada herramienta, encima de los de todas. */
function porDefectoDe(tipo: TipoDibujo): Partial<DibujoTel> {
  switch (tipo) {
    case "foco":
      return { intensidad: 0.66, relleno: false };
    case "anillo":
      return { radio: 0.045, grosor: 4 };
    case "zona":
      return { opacidad: 0.9, relleno: true, discontinua: true, grosor: 3 };
    case "seleccion":
      return { color: "#3B82F6", relleno: true, discontinua: true, grosor: 3 };
    case "mover":
      return { radio: 0.05, discontinua: true, grosor: 4 };
    case "difumina":
      return { intensidad: 14, relleno: false };
    case "lupa":
      return { radio: 0.09, zoom: 2.2, grosor: 3 };
    case "fuera-juego":
      return { color: "#22D3EE", grosor: 4, texto: "" };
    case "medida":
      return { color: "#FFFFFF", grosor: 3 };
    case "texto":
      return { tamano: 28 };
    default:
      return {};
  }
}

export function creaDibujo(
  tipo: TipoDibujo,
  puntos: PuntoTel[],
  ajustes: Partial<DibujoTel>,
  id: string,
): DibujoTel {
  return {
    ...BASE_DIBUJO,
    ...porDefectoDe(tipo),
    ...ajustes,
    id,
    tipo,
    puntos,
  };
}

export function escenaVacia(tMs: number, id: string, ahora: string): EscenaTel {
  return {
    id,
    nombre: "",
    tMs: Math.max(0, Math.round(tMs)),
    duracionMs: DURACION_ESCENA_MS,
    congelada: false,
    dibujos: [],
    creadoEn: ahora,
  };
}

/* ================================================================== */
/*  LEER LO GUARDADO                                                   */
/* ================================================================== */

function numero(valor: unknown, respaldo: number) {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : respaldo;
}

function texto(valor: unknown, respaldo = "") {
  return typeof valor === "string" ? valor : respaldo;
}

function normalizaDibujo(crudo: unknown, indice: number): DibujoTel | null {
  if (!crudo || typeof crudo !== "object") return null;

  const dato = crudo as Partial<DibujoTel>;

  if (!dato.tipo) return null;

  const puntos = Array.isArray(dato.puntos)
    ? dato.puntos
        .filter((punto) => punto && typeof punto === "object")
        .map((punto) => ({
          x: numero((punto as PuntoTel).x, 0),
          y: numero((punto as PuntoTel).y, 0),
        }))
    : [];

  if (puntos.length === 0) return null;

  const base = { ...BASE_DIBUJO, ...porDefectoDe(dato.tipo) };

  return {
    id: texto(dato.id) || `dib-${indice}`,
    tipo: dato.tipo,
    puntos,
    color: texto(dato.color, base.color),
    grosor: numero(dato.grosor, base.grosor),
    opacidad: numero(dato.opacidad, base.opacidad),
    relleno: dato.relleno ?? base.relleno,
    discontinua: dato.discontinua ?? base.discontinua,
    animado: dato.animado ?? base.animado,
    curvatura: numero(dato.curvatura, base.curvatura),
    texto: texto(dato.texto, base.texto),
    tamano: numero(dato.tamano, base.tamano),
    radio: numero(dato.radio, base.radio),
    zoom: numero(dato.zoom, base.zoom),
    intensidad: numero(dato.intensidad, base.intensidad),
    etiqueta: texto(dato.etiqueta, base.etiqueta),
  };
}

/**
 * Deja la lista de pizarras guardada lista para usar.
 *
 * Como con los clips: lo que falte se rellena aquí. Un campo nuevo que no se
 * añada a esta función no llega nunca a la pantalla.
 */
export function normalizaEscenas(crudo: unknown): EscenaTel[] {
  if (!Array.isArray(crudo)) return [];

  return crudo
    .map((cruda, indice): EscenaTel | null => {
      if (!cruda || typeof cruda !== "object") return null;

      const dato = cruda as Partial<EscenaTel>;

      const dibujos = Array.isArray(dato.dibujos)
        ? dato.dibujos
            .map((dibujo, posicion) => normalizaDibujo(dibujo, posicion))
            .filter((dibujo): dibujo is DibujoTel => dibujo !== null)
        : [];

      return {
        id: texto(dato.id) || `esc-${indice}`,
        nombre: texto(dato.nombre),
        tMs: Math.max(0, numero(dato.tMs, 0)),
        duracionMs: Math.max(500, numero(dato.duracionMs, DURACION_ESCENA_MS)),
        clipId: dato.clipId,
        congelada: dato.congelada === true,
        dibujos,
        creadoEn: texto(dato.creadoEn),
      };
    })
    .filter((escena): escena is EscenaTel => escena !== null)
    .sort((a, b) => a.tMs - b.tMs);
}

/* ================================================================== */
/*  CUÁNDO SE VE CADA PIZARRA                                          */
/* ================================================================== */

export function escenaEn(escenas: EscenaTel[], tMs: number): EscenaTel | null {
  let elegida: EscenaTel | null = null;

  for (const escena of escenas) {
    if (tMs >= escena.tMs && tMs <= escena.tMs + escena.duracionMs) {
      /* La que empieza más tarde manda: dos pizarras solapadas se leen mal. */
      if (!elegida || escena.tMs > elegida.tMs) elegida = escena;
    }
  }

  return elegida;
}

/** De 0 a 1 dentro de la ventana de la escena. */
export function progresoEscena(escena: EscenaTel, tMs: number) {
  if (escena.duracionMs <= 0) return 1;

  return Math.min(1, Math.max(0, (tMs - escena.tMs) / escena.duracionMs));
}

/** El nombre que se enseña en la lista cuando el analista no ha puesto uno. */
export function nombreEscena(escena: EscenaTel, indice: number) {
  if (escena.nombre.trim()) return escena.nombre.trim();

  const conTexto = escena.dibujos.find((dibujo) => dibujo.texto.trim());

  if (conTexto) return conTexto.texto.trim().split("\n")[0].slice(0, 40);

  return `Pizarra ${indice + 1}`;
}

/* ================================================================== */
/*  GEOMETRÍA                                                          */
/* ================================================================== */

function aPx(punto: PuntoTel, medidas: MedidasTel) {
  return { x: punto.x * medidas.ancho, y: punto.y * medidas.alto };
}

type Px = { x: number; y: number };

function distancia(a: Px, b: Px) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** El punto de control de una curva cuadrática con la comba pedida. */
function control(a: Px, b: Px, curvatura: number): Px {
  const medio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  if (!curvatura) return medio;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo = Math.hypot(dx, dy) || 1;

  return {
    x: medio.x + (-dy / largo) * largo * curvatura * 0.5,
    y: medio.y + (dx / largo) * largo * curvatura * 0.5,
  };
}

function enCurva(a: Px, c: Px, b: Px, t: number): Px {
  const u = 1 - t;

  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/** La envolvente convexa: el bloque que forman los jugadores marcados. */
export function envolvente(puntos: Px[]): Px[] {
  if (puntos.length < 3) return puntos;

  const orden = [...puntos].sort((a, b) => a.x - b.x || a.y - b.y);

  const cruz = (o: Px, a: Px, b: Px) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const abajo: Px[] = [];

  for (const punto of orden) {
    while (
      abajo.length >= 2 &&
      cruz(abajo[abajo.length - 2], abajo[abajo.length - 1], punto) <= 0
    ) {
      abajo.pop();
    }

    abajo.push(punto);
  }

  const arriba: Px[] = [];

  for (const punto of [...orden].reverse()) {
    while (
      arriba.length >= 2 &&
      cruz(arriba[arriba.length - 2], arriba[arriba.length - 1], punto) <= 0
    ) {
      arriba.pop();
    }

    arriba.push(punto);
  }

  abajo.pop();
  arriba.pop();

  return [...abajo, ...arriba];
}

function centroide(puntos: Px[]): Px {
  if (puntos.length === 0) return { x: 0, y: 0 };

  const suma = puntos.reduce(
    (total, punto) => ({ x: total.x + punto.x, y: total.y + punto.y }),
    { x: 0, y: 0 },
  );

  return { x: suma.x / puntos.length, y: suma.y / puntos.length };
}

function distanciaASegmento(punto: Px, a: Px, b: Px) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;

  if (largo2 === 0) return distancia(punto, a);

  const t = Math.max(
    0,
    Math.min(1, ((punto.x - a.x) * dx + (punto.y - a.y) * dy) / largo2),
  );

  return distancia(punto, { x: a.x + t * dx, y: a.y + t * dy });
}

function dentroDelPoligono(punto: Px, poligono: Px[]) {
  let dentro = false;

  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];

    const cruza =
      a.y > punto.y !== b.y > punto.y &&
      punto.x < ((b.x - a.x) * (punto.y - a.y)) / (b.y - a.y || 1e-9) + a.x;

    if (cruza) dentro = !dentro;
  }

  return dentro;
}

/* ================================================================== */
/*  TOCAR LO PINTADO                                                   */
/* ================================================================== */

/**
 * Si un punto de la pantalla cae sobre un dibujo.
 *
 * El margen es generoso a propósito: se está señalando con el ratón encima de
 * un vídeo en movimiento, no colocando vectores en un editor.
 */
export function tocaDibujo(
  dibujo: DibujoTel,
  punto: PuntoTel,
  medidas: MedidasTel,
): boolean {
  const escala = medidas.ancho / REFERENCIA;
  const cerca = Math.max(10, dibujo.grosor * escala * 2.2);
  const p = aPx(punto, medidas);
  const puntos = dibujo.puntos.map((uno) => aPx(uno, medidas));

  const [a, b] = puntos;

  switch (dibujo.tipo) {
    case "foco":
    case "elipse":
    case "rect":
    case "difumina": {
      if (!b) return distancia(p, a) <= cerca;

      const x0 = Math.min(a.x, b.x);
      const x1 = Math.max(a.x, b.x);
      const y0 = Math.min(a.y, b.y);
      const y1 = Math.max(a.y, b.y);

      if (dibujo.tipo === "foco" || dibujo.tipo === "elipse") {
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const rx = Math.max(4, (x1 - x0) / 2);
        const ry = Math.max(4, (y1 - y0) / 2);

        return ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 <= 1.15;
      }

      return p.x >= x0 - cerca && p.x <= x1 + cerca && p.y >= y0 - cerca && p.y <= y1 + cerca;
    }

    case "anillo":
    case "lupa": {
      const radio = dibujo.radio * medidas.ancho;

      return Math.abs(distancia(p, a) - radio) <= cerca * 1.6 || distancia(p, a) <= radio;
    }

    case "mover": {
      const radio = dibujo.radio * medidas.ancho;

      if (distancia(p, a) <= radio) return true;
      if (b && distancia(p, b) <= radio) return true;

      return b ? distanciaASegmento(p, a, b) <= cerca : false;
    }

    case "texto": {
      const alto = dibujo.tamano * escala * 1.9;
      const ancho = Math.max(60, dibujo.texto.length * dibujo.tamano * escala * 0.42);

      return (
        p.x >= a.x - 12 && p.x <= a.x + ancho + 12 && p.y >= a.y - alto && p.y <= a.y + alto
      );
    }

    case "zona":
    case "seleccion": {
      if (puntos.length < 3) {
        return puntos.some((uno) => distancia(p, uno) <= cerca * 2);
      }

      const forma = dibujo.tipo === "seleccion" ? envolvente(puntos) : puntos;

      if (dentroDelPoligono(p, forma)) return true;

      return forma.some((uno, indice) =>
        distanciaASegmento(p, uno, forma[(indice + 1) % forma.length]) <= cerca,
      );
    }

    case "libre":
      return puntos.some(
        (uno, indice) =>
          indice > 0 && distanciaASegmento(p, puntos[indice - 1], uno) <= cerca,
      );

    default: {
      if (!b) return distancia(p, a) <= cerca;

      if (dibujo.curvatura) {
        const c = control(a, b, dibujo.curvatura);

        for (let paso = 0; paso <= 20; paso += 1) {
          if (distancia(p, enCurva(a, c, b, paso / 20)) <= cerca) return true;
        }

        return false;
      }

      return distanciaASegmento(p, a, b) <= cerca;
    }
  }
}

/** El dibujo de más arriba que hay bajo el cursor, o `null`. */
export function dibujoEn(
  escena: EscenaTel,
  punto: PuntoTel,
  medidas: MedidasTel,
): DibujoTel | null {
  for (let i = escena.dibujos.length - 1; i >= 0; i -= 1) {
    if (tocaDibujo(escena.dibujos[i], punto, medidas)) return escena.dibujos[i];
  }

  return null;
}

/** Mueve un dibujo entero. */
export function mueveDibujo(
  dibujo: DibujoTel,
  dx: number,
  dy: number,
): DibujoTel {
  return {
    ...dibujo,
    puntos: dibujo.puntos.map((punto) => ({ x: punto.x + dx, y: punto.y + dy })),
  };
}

/** El tirador (vértice) que se está agarrando, o -1. */
export function tiradorEn(
  dibujo: DibujoTel,
  punto: PuntoTel,
  medidas: MedidasTel,
): number {
  const p = aPx(punto, medidas);

  return dibujo.puntos.findIndex((uno) => distancia(p, aPx(uno, medidas)) <= 14);
}

/* ================================================================== */
/*  PINTAR                                                             */
/* ================================================================== */

/**
 * Un lienzo auxiliar que se reaprovecha entre fotogramas.
 *
 * El foco y los recortes necesitan componer aparte (`destination-out` sobre
 * una capa propia). Crear un `<canvas>` sesenta veces por segundo es la forma
 * más rápida de que el navegador se atragante: se guarda uno y se redimensiona
 * sólo cuando cambia el tamaño.
 */
const auxiliares = new Map<string, HTMLCanvasElement>();

function lienzoAuxiliar(clave: string, ancho: number, alto: number) {
  let lienzo = auxiliares.get(clave);

  if (!lienzo) {
    lienzo = document.createElement("canvas");
    auxiliares.set(clave, lienzo);
  }

  const w = Math.max(1, Math.round(ancho));
  const h = Math.max(1, Math.round(alto));

  if (lienzo.width !== w || lienzo.height !== h) {
    lienzo.width = w;
    lienzo.height = h;
  }

  const ctx = lienzo.getContext("2d");

  if (ctx) ctx.clearRect(0, 0, lienzo.width, lienzo.height);

  return { lienzo, ctx };
}

/** El color con la transparencia pedida, sea `#rgb`, `#rrggbb` o lo que sea. */
function conAlfa(color: string, alfa: number) {
  const limpio = color.trim();

  if (limpio.startsWith("#")) {
    const hex =
      limpio.length === 4
        ? limpio
            .slice(1)
            .split("")
            .map((letra) => letra + letra)
            .join("")
        : limpio.slice(1, 7);

    const valor = Number.parseInt(hex, 16);

    if (Number.isFinite(valor)) {
      const r = (valor >> 16) & 255;
      const g = (valor >> 8) & 255;
      const b = valor & 255;

      return `rgba(${r}, ${g}, ${b}, ${alfa})`;
    }
  }

  return limpio;
}

type Contexto = {
  ctx: CanvasRenderingContext2D;
  medidas: MedidasTel;
  escala: number;
  /** De dónde salen los píxeles del vídeo para el foco, la lupa y el recorte. */
  imagen: CanvasImageSource | null;
  imagenAncho: number;
  imagenAlto: number;
  progreso: number;
  /** La familia de letra de las chapas, tal y como la quiere `ctx.font`. */
  familia: string;
};

/**
 * El truco que hace que un dibujo se lea sobre cualquier césped.
 *
 * Todo trazo se pinta dos veces: primero un contorno oscuro y ancho, y encima
 * el color. Sin él, una flecha amarilla sobre publicidad amarilla desaparece,
 * y es exactamente lo que separa una telestración de televisión de un garabato
 * en Paint.
 */
function trazaConContorno(
  entorno: Contexto,
  camino: () => void,
  color: string,
  grosor: number,
  discontinua: boolean,
  patron?: number[],
) {
  const { ctx } = entorno;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.save();
  ctx.setLineDash(discontinua ? (patron ?? [grosor * 2.2, grosor * 1.8]) : []);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = grosor + Math.max(2, grosor * 0.55);
  camino();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.setLineDash(discontinua ? (patron ?? [grosor * 2.2, grosor * 1.8]) : []);
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.shadowColor = conAlfa(color, 0.55);
  ctx.shadowBlur = grosor * 1.6;
  camino();
  ctx.stroke();
  ctx.restore();
}

/** La punta de una flecha, orientada por su tangente. */
function pintaPunta(
  entorno: Contexto,
  extremo: Px,
  desde: Px,
  color: string,
  grosor: number,
) {
  const { ctx } = entorno;

  const angulo = Math.atan2(extremo.y - desde.y, extremo.x - desde.x);
  const largo = grosor * 3.4;
  const ancho = grosor * 2.2;

  const dibuja = () => {
    ctx.beginPath();
    ctx.moveTo(extremo.x, extremo.y);
    ctx.lineTo(
      extremo.x - Math.cos(angulo - 0.42) * largo,
      extremo.y - Math.sin(angulo - 0.42) * largo,
    );
    ctx.lineTo(
      extremo.x - Math.cos(angulo) * largo * 0.72,
      extremo.y - Math.sin(angulo) * largo * 0.72,
    );
    ctx.lineTo(
      extremo.x - Math.cos(angulo + 0.42) * largo,
      extremo.y - Math.sin(angulo + 0.42) * largo,
    );
    ctx.closePath();
  };

  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = Math.max(2, grosor * 0.55);
  ctx.lineJoin = "round";
  dibuja();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.shadowColor = conAlfa(color, 0.55);
  ctx.shadowBlur = grosor * 1.4;
  dibuja();
  ctx.fill();
  ctx.restore();

  void ancho;
}

/**
 * Una chapa de texto con el aire de las portadas del club.
 *
 * Papel oscuro translúcido, filete de color a la izquierda y la condensada del
 * `INDIVIDUAL.pptx`. Devuelve el ancho, que es lo que necesita el que la pinta
 * para colocar la línea guía.
 */
function pintaChapa(
  entorno: Contexto,
  x: number,
  y: number,
  lineas: string[],
  color: string,
  tamano: number,
  anclaje: "izquierda" | "centro" = "izquierda",
) {
  const { ctx } = entorno;

  ctx.save();
  ctx.font = `600 ${tamano}px ${entorno.familia}`;
  ctx.textBaseline = "middle";

  const anchos = lineas.map((linea) => ctx.measureText(linea).width);
  const anchoTexto = Math.max(...anchos, 10);

  const relleno = tamano * 0.55;
  const altoLinea = tamano * 1.22;
  const alto = altoLinea * lineas.length + relleno * 1.1;
  const ancho = anchoTexto + relleno * 2.4;

  const x0 = anclaje === "centro" ? x - ancho / 2 : x;
  const y0 = y - alto / 2;

  const radio = Math.min(alto / 2, tamano * 0.42);

  ctx.beginPath();
  ctx.roundRect(x0, y0, ancho, alto, radio);
  ctx.fillStyle = "rgba(8, 11, 15, 0.86)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = tamano * 0.6;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = conAlfa(color, 0.5);
  ctx.lineWidth = Math.max(1, tamano * 0.045);
  ctx.stroke();

  /* El filete de color, recortado por la misma esquina redondeada. */
  ctx.save();
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x0, y0, Math.max(3, tamano * 0.16), alto);
  ctx.restore();

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";

  lineas.forEach((linea, indice) => {
    ctx.fillText(
      linea,
      x0 + relleno * 1.5,
      y0 + relleno * 0.55 + altoLinea * (indice + 0.5),
    );
  });

  ctx.restore();

  return { ancho, alto, x0, y0 };
}

/* ------------------------------------------------------ el foco ---- */

/**
 * Apaga el partido menos a quien importa.
 *
 * Todos los focos de la escena se resuelven en **una sola capa**: dos focos
 * pintados uno detrás de otro dejarían el segundo velo encima del primer
 * agujero y el primer jugador se vería a media luz.
 */
function pintaFocos(entorno: Contexto, focos: DibujoTel[]) {
  if (focos.length === 0) return;

  const { ctx, medidas } = entorno;

  const intensidad = Math.min(
    0.9,
    Math.max(...focos.map((foco) => foco.intensidad)),
  );

  const { lienzo, ctx: capa } = lienzoAuxiliar("foco", medidas.ancho, medidas.alto);

  if (!capa) return;

  capa.fillStyle = `rgba(4, 7, 11, ${intensidad})`;
  capa.fillRect(0, 0, medidas.ancho, medidas.alto);

  capa.globalCompositeOperation = "destination-out";

  for (const foco of focos) {
    const [a, b] = foco.puntos.map((punto) => aPx(punto, medidas));

    const centro = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;

    const rx = b ? Math.max(12, Math.abs(b.x - a.x) / 2) : foco.radio * medidas.ancho;
    const ry = b ? Math.max(12, Math.abs(b.y - a.y) / 2) : foco.radio * medidas.ancho;

    capa.save();
    capa.translate(centro.x, centro.y);
    capa.scale(rx, ry);

    const degradado = capa.createRadialGradient(0, 0, 0, 0, 0, 1);

    degradado.addColorStop(0, "rgba(0, 0, 0, 1)");
    degradado.addColorStop(0.62, "rgba(0, 0, 0, 1)");
    degradado.addColorStop(1, "rgba(0, 0, 0, 0)");

    capa.fillStyle = degradado;
    capa.beginPath();
    capa.arc(0, 0, 1, 0, Math.PI * 2);
    capa.fill();
    capa.restore();
  }

  capa.globalCompositeOperation = "source-over";

  ctx.drawImage(lienzo, 0, 0);

  /* El aro fino que remata el foco: sin él, el borde difuso no se lee. */
  for (const foco of focos) {
    if (!foco.relleno) continue;

    const [a, b] = foco.puntos.map((punto) => aPx(punto, medidas));

    const centro = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;

    const rx = b ? Math.max(12, Math.abs(b.x - a.x) / 2) : foco.radio * medidas.ancho;
    const ry = b ? Math.max(12, Math.abs(b.y - a.y) / 2) : foco.radio * medidas.ancho;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centro.x, centro.y, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.strokeStyle = conAlfa(foco.color, 0.55);
    ctx.lineWidth = Math.max(1.5, foco.grosor * entorno.escala * 0.4);
    ctx.stroke();
    ctx.restore();
  }
}

/* --------------------------------------------------- el anillo ---- */

function pintaAnillo(entorno: Contexto, dibujo: DibujoTel) {
  const { ctx, medidas, escala } = entorno;

  const centro = aPx(dibujo.puntos[0], medidas);
  const rx = Math.max(10, dibujo.radio * medidas.ancho);
  const ry = rx * 0.42;
  const grosor = Math.max(2, dibujo.grosor * escala);

  ctx.save();
  ctx.globalAlpha = dibujo.opacidad;

  /* La sombra en el suelo: lo que hace que el aro parezca apoyado. */
  const suelo = ctx.createRadialGradient(centro.x, centro.y, 0, centro.x, centro.y, rx);

  suelo.addColorStop(0, conAlfa(dibujo.color, 0.28));
  suelo.addColorStop(1, conAlfa(dibujo.color, 0));

  ctx.save();
  ctx.translate(centro.x, centro.y);
  ctx.scale(1, 0.42);
  ctx.translate(-centro.x, -centro.y);
  ctx.fillStyle = suelo;
  ctx.beginPath();
  ctx.arc(centro.x, centro.y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const arco = ctx.createLinearGradient(0, centro.y - ry, 0, centro.y + ry);

  arco.addColorStop(0, conAlfa(dibujo.color, 0.35));
  arco.addColorStop(1, dibujo.color);

  ctx.beginPath();
  ctx.ellipse(centro.x, centro.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = grosor + 3;
  ctx.stroke();

  ctx.strokeStyle = arco;
  ctx.lineWidth = grosor;
  ctx.shadowColor = conAlfa(dibujo.color, 0.7);
  ctx.shadowBlur = grosor * 3;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.ellipse(centro.x, centro.y, rx * 1.16, ry * 1.16, 0, 0, Math.PI * 2);
  ctx.strokeStyle = conAlfa(dibujo.color, 0.3);
  ctx.lineWidth = Math.max(1, grosor * 0.4);
  ctx.stroke();

  ctx.restore();

  if (dibujo.etiqueta.trim() || dibujo.texto.trim()) {
    const alto = rx * 1.5;

    ctx.save();
    ctx.globalAlpha = dibujo.opacidad;
    ctx.beginPath();
    ctx.moveTo(centro.x, centro.y - ry);
    ctx.lineTo(centro.x, centro.y - alto);
    ctx.strokeStyle = conAlfa(dibujo.color, 0.8);
    ctx.lineWidth = Math.max(1.5, grosor * 0.4);
    ctx.stroke();
    ctx.restore();

    const lineas = [dibujo.etiqueta.trim(), dibujo.texto.trim()].filter(Boolean);

    ctx.save();
    ctx.globalAlpha = dibujo.opacidad;
    pintaChapa(
      entorno,
      centro.x,
      centro.y - alto - dibujo.tamano * escala * 0.7,
      lineas,
      dibujo.color,
      dibujo.tamano * escala,
      "centro",
    );
    ctx.restore();
  }
}

/* ------------------------------------------- mover a un jugador ---- */

/**
 * El recorte del jugador, con los bordes difuminados.
 *
 * Se recorta del fotograma congelado y se le aplica una máscara redonda con
 * `destination-in`: sin ella se vería el cuadrado del recorte —el césped de al
 * lado pegado sobre el césped—, que es lo que delata a los montajes malos.
 */
function recorta(
  entorno: Contexto,
  centro: Px,
  radio: number,
): HTMLCanvasElement | null {
  const { imagen, imagenAncho, imagenAlto, medidas } = entorno;

  if (!imagen || !imagenAncho || !imagenAlto) return null;

  const lado = Math.max(8, radio * 2);

  const { lienzo, ctx: capa } = lienzoAuxiliar("recorte", lado, lado * 1.55);

  if (!capa) return null;

  /* Del centro para arriba hay cuerpo; para abajo, poco más que los pies. */
  const alto = lienzo.height;
  const arriba = alto * 0.72;

  const escalaX = imagenAncho / medidas.ancho;
  const escalaY = imagenAlto / medidas.alto;

  capa.drawImage(
    imagen,
    (centro.x - radio) * escalaX,
    (centro.y - arriba) * escalaY,
    lado * escalaX,
    alto * escalaY,
    0,
    0,
    lado,
    alto,
  );

  capa.globalCompositeOperation = "destination-in";

  const mascara = capa.createRadialGradient(
    lado / 2,
    arriba * 0.78,
    0,
    lado / 2,
    arriba * 0.78,
    Math.max(lado, alto) * 0.55,
  );

  mascara.addColorStop(0, "rgba(0, 0, 0, 1)");
  mascara.addColorStop(0.66, "rgba(0, 0, 0, 0.98)");
  mascara.addColorStop(1, "rgba(0, 0, 0, 0)");

  capa.fillStyle = mascara;
  capa.fillRect(0, 0, lado, alto);
  capa.globalCompositeOperation = "source-over";

  return lienzo;
}

function pintaMover(entorno: Contexto, dibujo: DibujoTel) {
  const { ctx, medidas, escala, progreso } = entorno;

  const origen = aPx(dibujo.puntos[0], medidas);
  const destino = dibujo.puntos[1] ? aPx(dibujo.puntos[1], medidas) : origen;

  const radio = Math.max(10, dibujo.radio * medidas.ancho);
  const grosor = Math.max(2, dibujo.grosor * escala);

  const avance = dibujo.animado ? progreso : 1;

  const actual = {
    x: origen.x + (destino.x - origen.x) * avance,
    y: origen.y + (destino.y - origen.y) * avance,
  };

  /* Dónde estaba de verdad: el aro discontinuo que no deja mentir al dibujo. */
  ctx.save();
  ctx.globalAlpha = dibujo.opacidad * 0.85;
  ctx.setLineDash([grosor * 1.6, grosor * 1.4]);
  ctx.beginPath();
  ctx.ellipse(origen.x, origen.y, radio, radio * 0.42, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = grosor + 2.5;
  ctx.stroke();
  ctx.strokeStyle = conAlfa(dibujo.color, 0.9);
  ctx.lineWidth = grosor;
  ctx.stroke();
  ctx.restore();

  /* La flecha del movimiento. */
  if (distancia(origen, destino) > radio * 0.6) {
    trazaConContorno(
      entorno,
      () => {
        ctx.beginPath();
        ctx.moveTo(origen.x, origen.y);
        ctx.lineTo(destino.x, destino.y);
      },
      conAlfa(dibujo.color, 0.9),
      grosor,
      true,
    );

    pintaPunta(entorno, destino, origen, dibujo.color, grosor);
  }

  const recortado = recorta(entorno, origen, radio);

  if (recortado) {
    const ancho = recortado.width;
    const alto = recortado.height;
    const arriba = alto * 0.72;

    /* La estela: tres fantasmas por el camino ya recorrido. */
    if (dibujo.animado && avance > 0.05) {
      for (let paso = 1; paso <= 3; paso += 1) {
        const t = Math.max(0, avance - paso * 0.14);

        if (t <= 0) break;

        const punto = {
          x: origen.x + (destino.x - origen.x) * t,
          y: origen.y + (destino.y - origen.y) * t,
        };

        ctx.save();
        ctx.globalAlpha = dibujo.opacidad * (0.22 - paso * 0.05);
        ctx.drawImage(recortado, punto.x - ancho / 2, punto.y - arriba, ancho, alto);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.globalAlpha = dibujo.opacidad;
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = radio * 0.5;
    ctx.drawImage(recortado, actual.x - ancho / 2, actual.y - arriba, ancho, alto);
    ctx.restore();
  } else {
    /* Sin fotograma que recortar, al menos se marca el destino. */
    ctx.save();
    ctx.globalAlpha = dibujo.opacidad;
    ctx.beginPath();
    ctx.ellipse(actual.x, actual.y, radio, radio * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = conAlfa(dibujo.color, 0.25);
    ctx.fill();
    ctx.restore();
  }

  /* Y el aro de destino, para que se vea dónde acaba. */
  ctx.save();
  ctx.globalAlpha = dibujo.opacidad;
  ctx.beginPath();
  ctx.ellipse(actual.x, actual.y, radio, radio * 0.42, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = grosor + 2.5;
  ctx.stroke();
  ctx.strokeStyle = dibujo.color;
  ctx.lineWidth = grosor;
  ctx.shadowColor = conAlfa(dibujo.color, 0.7);
  ctx.shadowBlur = grosor * 2.5;
  ctx.stroke();
  ctx.restore();

  if (dibujo.etiqueta.trim()) {
    ctx.save();
    ctx.globalAlpha = dibujo.opacidad;
    pintaChapa(
      entorno,
      actual.x,
      actual.y + radio * 0.9,
      [dibujo.etiqueta.trim()],
      dibujo.color,
      dibujo.tamano * escala * 0.8,
      "centro",
    );
    ctx.restore();
  }
}

/* ----------------------------------------------------- la lupa ---- */

function pintaLupa(entorno: Contexto, dibujo: DibujoTel) {
  const { ctx, medidas, escala, imagen, imagenAncho, imagenAlto } = entorno;

  const centro = aPx(dibujo.puntos[0], medidas);
  const radio = Math.max(20, dibujo.radio * medidas.ancho);
  const zoom = Math.max(1.1, dibujo.zoom);
  const grosor = Math.max(2, dibujo.grosor * escala);

  ctx.save();
  ctx.beginPath();
  ctx.arc(centro.x, centro.y, radio, 0, Math.PI * 2);
  ctx.clip();

  if (imagen && imagenAncho && imagenAlto) {
    const escalaX = imagenAncho / medidas.ancho;
    const escalaY = imagenAlto / medidas.alto;
    const lado = radio / zoom;

    ctx.drawImage(
      imagen,
      (centro.x - lado) * escalaX,
      (centro.y - lado) * escalaY,
      lado * 2 * escalaX,
      lado * 2 * escalaY,
      centro.x - radio,
      centro.y - radio,
      radio * 2,
      radio * 2,
    );
  } else {
    ctx.fillStyle = "rgba(4, 7, 11, 0.8)";
    ctx.fillRect(centro.x - radio, centro.y - radio, radio * 2, radio * 2);
  }

  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(centro.x, centro.y, radio, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = grosor + 3;
  ctx.stroke();
  ctx.strokeStyle = dibujo.color;
  ctx.lineWidth = grosor;
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = radio * 0.25;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  pintaChapa(
    entorno,
    centro.x,
    centro.y - radio - dibujo.tamano * escala * 0.8,
    [dibujo.texto.trim() || `×${zoom.toFixed(1)}`],
    dibujo.color,
    dibujo.tamano * escala * 0.72,
    "centro",
  );
  ctx.restore();
}

/* ------------------------------------------------ el difuminado ---- */

function pintaDifumina(entorno: Contexto, dibujo: DibujoTel) {
  const { ctx, medidas, escala, imagen, imagenAncho, imagenAlto } = entorno;

  const [a, b] = dibujo.puntos.map((punto) => aPx(punto, medidas));

  if (!b) return;

  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const ancho = Math.abs(b.x - a.x);
  const alto = Math.abs(b.y - a.y);

  if (ancho < 4 || alto < 4) return;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, ancho, alto, 8 * escala);
  ctx.clip();

  if (imagen && imagenAncho && imagenAlto) {
    const escalaX = imagenAncho / medidas.ancho;
    const escalaY = imagenAlto / medidas.alto;
    const margen = dibujo.intensidad * escala;

    ctx.filter = `blur(${Math.max(2, margen)}px)`;

    ctx.drawImage(
      imagen,
      Math.max(0, (x - margen) * escalaX),
      Math.max(0, (y - margen) * escalaY),
      (ancho + margen * 2) * escalaX,
      (alto + margen * 2) * escalaY,
      x - margen,
      y - margen,
      ancho + margen * 2,
      alto + margen * 2,
    );

    ctx.filter = "none";
  } else {
    ctx.fillStyle = "rgba(4, 7, 11, 0.85)";
    ctx.fillRect(x, y, ancho, alto);
  }

  ctx.restore();
}

/* ------------------------------------------- el fuera de juego ---- */

function pintaFueraDeJuego(entorno: Contexto, dibujo: DibujoTel) {
  const { ctx, medidas, escala } = entorno;

  const [a, b] = dibujo.puntos.map((punto) => aPx(punto, medidas));

  if (!b) return;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo = Math.hypot(dx, dy) || 1;

  /* La línea se estira hasta salirse del cuadro: un fuera de juego no acaba
     donde el ratón soltó el botón. */
  const diagonal = Math.hypot(medidas.ancho, medidas.alto);

  const ux = dx / largo;
  const uy = dy / largo;

  const desde = { x: a.x - ux * diagonal, y: a.y - uy * diagonal };
  const hasta = { x: a.x + ux * diagonal, y: a.y + uy * diagonal };

  const grosor = Math.max(2, dibujo.grosor * escala);

  /* La franja que se va apagando hacia el lado en fuera de juego. */
  const ancho = medidas.ancho * 0.09;
  const nx = -uy;
  const ny = ux;

  const franja = ctx.createLinearGradient(
    a.x,
    a.y,
    a.x + nx * ancho,
    a.y + ny * ancho,
  );

  franja.addColorStop(0, conAlfa(dibujo.color, 0.34));
  franja.addColorStop(1, conAlfa(dibujo.color, 0));

  ctx.save();
  ctx.globalAlpha = dibujo.opacidad;
  ctx.beginPath();
  ctx.moveTo(desde.x, desde.y);
  ctx.lineTo(hasta.x, hasta.y);
  ctx.lineTo(hasta.x + nx * ancho, hasta.y + ny * ancho);
  ctx.lineTo(desde.x + nx * ancho, desde.y + ny * ancho);
  ctx.closePath();
  ctx.fillStyle = franja;
  ctx.fill();
  ctx.restore();

  trazaConContorno(
    entorno,
    () => {
      ctx.beginPath();
      ctx.moveTo(desde.x, desde.y);
      ctx.lineTo(hasta.x, hasta.y);
    },
    dibujo.color,
    grosor,
    dibujo.discontinua,
  );

  const etiqueta = dibujo.texto.trim() || "FUERA DE JUEGO";

  ctx.save();
  ctx.globalAlpha = dibujo.opacidad;
  pintaChapa(
    entorno,
    a.x + nx * ancho * 0.5,
    a.y + ny * ancho * 0.5,
    [etiqueta],
    dibujo.color,
    dibujo.tamano * escala * 0.72,
    "centro",
  );
  ctx.restore();
}

/* ------------------------------------------------- la distancia ---- */

function pintaMedida(entorno: Contexto, dibujo: DibujoTel) {
  const { ctx, medidas, escala } = entorno;

  const [a, b] = dibujo.puntos.map((punto) => aPx(punto, medidas));

  if (!b) return;

  const grosor = Math.max(1.5, dibujo.grosor * escala);
  const angulo = Math.atan2(b.y - a.y, b.x - a.x);
  const tope = grosor * 4;

  const traza = () => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    for (const extremo of [a, b]) {
      ctx.moveTo(
        extremo.x - Math.cos(angulo + Math.PI / 2) * tope,
        extremo.y - Math.sin(angulo + Math.PI / 2) * tope,
      );
      ctx.lineTo(
        extremo.x + Math.cos(angulo + Math.PI / 2) * tope,
        extremo.y + Math.sin(angulo + Math.PI / 2) * tope,
      );
    }
  };

  trazaConContorno(entorno, traza, dibujo.color, grosor, dibujo.discontinua);

  if (dibujo.texto.trim()) {
    ctx.save();
    ctx.globalAlpha = dibujo.opacidad;
    pintaChapa(
      entorno,
      (a.x + b.x) / 2,
      (a.y + b.y) / 2 - grosor * 5,
      [dibujo.texto.trim()],
      dibujo.color,
      dibujo.tamano * escala * 0.7,
      "centro",
    );
    ctx.restore();
  }
}

/* ------------------------------------------------- la selección ---- */

function pintaSeleccion(entorno: Contexto, dibujo: DibujoTel) {
  const { ctx, medidas, escala } = entorno;

  const puntos = dibujo.puntos.map((punto) => aPx(punto, medidas));
  const grosor = Math.max(2, dibujo.grosor * escala);
  const radio = Math.max(10, medidas.ancho * 0.018);

  if (puntos.length >= 3) {
    const forma = envolvente(puntos);

    ctx.save();
    ctx.globalAlpha = dibujo.opacidad;
    ctx.beginPath();
    ctx.moveTo(forma[0].x, forma[0].y);
    forma.slice(1).forEach((punto) => ctx.lineTo(punto.x, punto.y));
    ctx.closePath();

    if (dibujo.relleno) {
      ctx.fillStyle = conAlfa(dibujo.color, 0.16);
      ctx.fill();
    }

    ctx.restore();

    trazaConContorno(
      entorno,
      () => {
        ctx.beginPath();
        ctx.moveTo(forma[0].x, forma[0].y);
        forma.slice(1).forEach((punto) => ctx.lineTo(punto.x, punto.y));
        ctx.closePath();
      },
      dibujo.color,
      grosor,
      dibujo.discontinua,
    );
  } else if (puntos.length === 2) {
    trazaConContorno(
      entorno,
      () => {
        ctx.beginPath();
        ctx.moveTo(puntos[0].x, puntos[0].y);
        ctx.lineTo(puntos[1].x, puntos[1].y);
      },
      dibujo.color,
      grosor,
      dibujo.discontinua,
    );
  }

  /* Y el aro de cada jugador marcado. */
  puntos.forEach((punto) => {
    ctx.save();
    ctx.globalAlpha = dibujo.opacidad;
    ctx.beginPath();
    ctx.ellipse(punto.x, punto.y, radio, radio * 0.45, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = grosor + 2.5;
    ctx.stroke();
    ctx.strokeStyle = dibujo.color;
    ctx.lineWidth = grosor;
    ctx.shadowColor = conAlfa(dibujo.color, 0.7);
    ctx.shadowBlur = grosor * 2;
    ctx.stroke();
    ctx.restore();
  });

  const etiqueta = dibujo.texto.trim() || dibujo.etiqueta.trim();

  if (etiqueta && puntos.length >= 2) {
    const centro = centroide(puntos);

    ctx.save();
    ctx.globalAlpha = dibujo.opacidad;
    pintaChapa(
      entorno,
      centro.x,
      centro.y,
      [etiqueta],
      dibujo.color,
      dibujo.tamano * escala * 0.72,
      "centro",
    );
    ctx.restore();
  }
}

/* ================================================================== */
/*  UN DIBUJO                                                          */
/* ================================================================== */

function pintaDibujo(entorno: Contexto, dibujo: DibujoTel) {
  const { ctx, medidas, escala, progreso } = entorno;

  const puntos = dibujo.puntos.map((punto) => aPx(punto, medidas));

  if (puntos.length === 0) return;

  const grosor = Math.max(1.5, dibujo.grosor * escala);
  const avance = dibujo.animado ? Math.max(0.02, progreso) : 1;

  ctx.save();
  ctx.globalAlpha = dibujo.opacidad;

  switch (dibujo.tipo) {
    case "anillo":
      pintaAnillo(entorno, dibujo);
      break;

    case "mover":
      pintaMover(entorno, dibujo);
      break;

    case "lupa":
      pintaLupa(entorno, dibujo);
      break;

    case "difumina":
      pintaDifumina(entorno, dibujo);
      break;

    case "fuera-juego":
      pintaFueraDeJuego(entorno, dibujo);
      break;

    case "medida":
      pintaMedida(entorno, dibujo);
      break;

    case "seleccion":
      pintaSeleccion(entorno, dibujo);
      break;

    case "flecha":
    case "linea": {
      const [a, b] = puntos;

      if (!b) break;

      const c = control(a, b, dibujo.curvatura);
      const fin = enCurva(a, c, b, avance);

      trazaConContorno(
        entorno,
        () => {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);

          if (avance >= 1) {
            ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
          } else {
            for (let paso = 1; paso <= 24; paso += 1) {
              const punto = enCurva(a, c, b, (avance * paso) / 24);

              ctx.lineTo(punto.x, punto.y);
            }
          }
        },
        dibujo.color,
        grosor,
        dibujo.discontinua,
      );

      if (dibujo.tipo === "flecha") {
        const antes = enCurva(a, c, b, Math.max(0, avance - 0.06));

        pintaPunta(entorno, fin, antes, dibujo.color, grosor);
      }

      break;
    }

    case "libre": {
      const hasta = Math.max(2, Math.round(puntos.length * avance));

      trazaConContorno(
        entorno,
        () => {
          ctx.beginPath();
          ctx.moveTo(puntos[0].x, puntos[0].y);

          for (let i = 1; i < hasta; i += 1) {
            const medio = {
              x: (puntos[i - 1].x + puntos[i].x) / 2,
              y: (puntos[i - 1].y + puntos[i].y) / 2,
            };

            ctx.quadraticCurveTo(puntos[i - 1].x, puntos[i - 1].y, medio.x, medio.y);
          }
        },
        dibujo.color,
        grosor,
        dibujo.discontinua,
      );

      break;
    }

    case "zona": {
      if (puntos.length < 2) break;

      const traza = () => {
        ctx.beginPath();
        ctx.moveTo(puntos[0].x, puntos[0].y);
        puntos.slice(1).forEach((punto) => ctx.lineTo(punto.x, punto.y));
        ctx.closePath();
      };

      if (dibujo.relleno) {
        ctx.save();
        traza();
        ctx.fillStyle = conAlfa(dibujo.color, 0.22);
        ctx.fill();
        ctx.restore();
      }

      trazaConContorno(entorno, traza, dibujo.color, grosor, dibujo.discontinua);

      if (dibujo.texto.trim()) {
        const centro = centroide(puntos);

        pintaChapa(
          entorno,
          centro.x,
          centro.y,
          [dibujo.texto.trim()],
          dibujo.color,
          dibujo.tamano * escala * 0.72,
          "centro",
        );
      }

      break;
    }

    case "rect": {
      const [a, b] = puntos;

      if (!b) break;

      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const ancho = Math.abs(b.x - a.x);
      const alto = Math.abs(b.y - a.y);

      const traza = () => {
        ctx.beginPath();
        ctx.roundRect(x, y, ancho, alto, Math.min(10 * escala, ancho / 2, alto / 2));
      };

      if (dibujo.relleno) {
        ctx.save();
        traza();
        ctx.fillStyle = conAlfa(dibujo.color, 0.2);
        ctx.fill();
        ctx.restore();
      }

      trazaConContorno(entorno, traza, dibujo.color, grosor, dibujo.discontinua);

      break;
    }

    case "elipse": {
      const [a, b] = puntos;

      if (!b) break;

      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2;
      const ry = Math.abs(b.y - a.y) / 2;

      const traza = () => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
      };

      if (dibujo.relleno) {
        ctx.save();
        traza();
        ctx.fillStyle = conAlfa(dibujo.color, 0.18);
        ctx.fill();
        ctx.restore();
      }

      trazaConContorno(entorno, traza, dibujo.color, grosor, dibujo.discontinua);

      break;
    }

    case "texto": {
      const [a, b] = puntos;

      const lineas = (dibujo.texto || "Escribe aquí").split("\n");

      const chapa = pintaChapa(
        entorno,
        a.x,
        a.y,
        lineas,
        dibujo.color,
        dibujo.tamano * escala,
      );

      /* La guía hasta lo que señala el texto, cuando se ha estirado. */
      if (b) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(chapa.x0 + chapa.ancho, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = conAlfa(dibujo.color, 0.85);
        ctx.lineWidth = Math.max(1.5, grosor * 0.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(b.x, b.y, Math.max(3, grosor * 0.9), 0, Math.PI * 2);
        ctx.fillStyle = dibujo.color;
        ctx.fill();
        ctx.restore();
      }

      break;
    }

    default:
      break;
  }

  ctx.restore();
}

/* ================================================================== */
/*  LA ESCENA ENTERA                                                   */
/* ================================================================== */

export type OpcionesPintado = {
  escena: EscenaTel;
  medidas: MedidasTel;
  /** De 0 a 1 dentro de la escena. En edición siempre 1. */
  progreso: number;
  /** El vídeo o el fotograma congelado del que salen los píxeles. */
  imagen: CanvasImageSource | null;
  imagenAncho: number;
  imagenAlto: number;
  /** El dibujo elegido, para pintarle los tiradores. */
  seleccion?: string | null;
  /** En edición se ven los vértices y las guías; al reproducir, no. */
  edicion?: boolean;
  /** La Barlow Condensed del club; sin ella se pinta con el respaldo. */
  familia?: string;
};

/**
 * Pinta una pizarra entera sobre el lienzo que se le dé.
 *
 * El orden importa y no es el de creación: primero lo que toca la imagen
 * (difuminado y lupa), después el foco —que apaga lo que hay debajo—, y sólo
 * entonces las formas y los textos, que tienen que quedar por encima de todo o
 * el propio foco se los comería.
 */
export function pintaEscena(
  ctx: CanvasRenderingContext2D,
  opciones: OpcionesPintado,
) {
  const { escena, medidas, progreso, imagen, imagenAncho, imagenAlto } = opciones;

  const entorno: Contexto = {
    ctx,
    medidas,
    escala: medidas.ancho / REFERENCIA,
    imagen,
    imagenAncho,
    imagenAlto,
    progreso,
    familia: opciones.familia || FAMILIA_RESPALDO,
  };

  ctx.clearRect(0, 0, medidas.ancho, medidas.alto);

  const fondo = escena.dibujos.filter(
    (dibujo) => dibujo.tipo === "difumina" || dibujo.tipo === "lupa",
  );

  for (const dibujo of fondo) pintaDibujo(entorno, dibujo);

  pintaFocos(
    entorno,
    escena.dibujos.filter((dibujo) => dibujo.tipo === "foco"),
  );

  for (const dibujo of escena.dibujos) {
    if (dibujo.tipo === "foco" || dibujo.tipo === "difumina" || dibujo.tipo === "lupa") {
      continue;
    }

    pintaDibujo(entorno, dibujo);
  }

  if (opciones.edicion && opciones.seleccion) {
    const elegido = escena.dibujos.find((dibujo) => dibujo.id === opciones.seleccion);

    if (elegido) pintaTiradores(entorno, elegido);
  }
}

function pintaTiradores(entorno: Contexto, dibujo: DibujoTel) {
  const { ctx, medidas } = entorno;

  ctx.save();

  dibujo.puntos.forEach((punto) => {
    const p = aPx(punto, medidas);

    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#0B0F14";
    ctx.fill();
    ctx.strokeStyle = "#C8A96B";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.restore();
}

/* ================================================================== */
/*  EL PNG DE UNA PIZARRA                                              */
/* ================================================================== */

/**
 * El fotograma con lo pintado encima, para llevárselo a la charla.
 *
 * Se compone a la resolución del vídeo, no a la de la pantalla: lo que se
 * enseña en el proyector no puede depender de cómo tuviera el analista la
 * ventana. Devuelve `null` si el navegador se niega a exportar el lienzo, que
 * es lo que pasa con un vídeo servido desde otro dominio sin permiso: no es un
 * fallo que deba tumbar nada, se avisa y ya.
 */
export function componeEscena(
  video: HTMLVideoElement,
  escena: EscenaTel,
  familia?: string,
): string | null {
  const ancho = video.videoWidth || 1280;
  const alto = video.videoHeight || 720;

  const lienzo = document.createElement("canvas");

  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext("2d");

  if (!ctx) return null;

  try {
    ctx.drawImage(video, 0, 0, ancho, alto);

    pintaEscena(ctx, {
      escena,
      medidas: { ancho, alto },
      progreso: 1,
      imagen: video,
      imagenAncho: ancho,
      imagenAlto: alto,
      edicion: false,
      familia,
    });

    return lienzo.toDataURL("image/png");
  } catch (error) {
    console.warn("[telestración] no se ha podido componer el PNG", error);

    return null;
  }
}
