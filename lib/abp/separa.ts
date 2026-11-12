/**
 * Que nadie tape a nadie al enseñar la pizarra (proyector y exportación).
 *
 * En el córner los rematadores van hombro con hombro y, a tamaño de sala,
 * cuatro caras apiladas no dejan leer ni el puesto ni el nombre. Sólo al
 * enseñar —al editar, cada cara está donde se ha puesto—: las que se pisan se
 * abren hacia los lados y, si aun así no caben, se pintan algo más pequeñas y
 * se abren algo más. Nunca sin foto: el 25/10/2026 el cuerpo técnico echó en
 * falta caras en la exportación y en los informes.
 *
 * 12/11/2026, tercera ronda de jueces (fútbol 7,5): en el córner defensivo los
 * rivales 4, 5 y 9 quedaban DEBAJO de M1–M3 con el nombre cortado, en la falta
 * directa la cara de Pol tapaba el nombre de nuestro portero («TRE») y en la
 * falta lateral la chapa de Joan se comía la de Mario. La regla ahora es una
 * sola y se mira entera: ningún nombre —nuestras chapas, la placa del apellido
 * del rival, la de nuestro portero, las letras de las consignas— queda debajo
 * de otra cosa, en ningún sentido. `solapesDeLamina` lo comprueba (lo usa el
 * arnés que valida las nueve láminas).
 *
 * Todo va en coordenadas de la plantilla (1920 × 1080). Nada de esto se guarda:
 * mueve lo pintado, no el documento.
 */

type Punto = {
  id: string;
  x: number;
  y: number;
  /**
   * Lo que mide de ancho la chapa con el nombre (01/11/2026). En un rival, lo
   * que mide la placa con su apellido. Sin dato, sólo la cara (o el disco).
   */
  chapa?: number;
};

export type Caja = { x0: number; x1: number; y0: number; y1: number };

/** Cuánto se encoge una cara que, ya abierta, sigue pisando a otra. */
export const ESCALA_APRETADA = 0.8;

/*
| Lo que ocupa cada cosa respecto a su punto (los pies), tal y como la pinta
| `TableroSlide`: la foto de 96 × 120 encima de los pies (lo opaco, el jugador
| recortado, mide unos 76 de ancho) y la chapa de 40 de alto que empieza 8 px
| por encima de los pies. Todo encoge desde los pies.
*/
const CARA = { w: 76, arriba: 114, abajo: 8 };
const CHAPA = { arriba: 8, abajo: 32 };

/** El disco del rival (52 con su filo blanco de 3) y la placa de su apellido. */
const DISCO = { w: 58, arriba: 59, abajo: 1 };
const PLACA_ALTO = 20;

/** El aire mínimo entre dos nombres, para que no se lean pegados. */
const AIRE_NOMBRES = 4;

/** Hasta dónde se abre una cara a cada lado (a su tamaño y apretada). */
const ABRE_MAX = 64;
const ABRE_MAX_APRETADA = 110;

export type Separadas = Map<string, { x: number; compacta: boolean }>;

function caja(x: number, y: number, forma: { w: number; arriba: number; abajo: number }, k = 1): Caja {
  return { x0: x - (forma.w * k) / 2, x1: x + (forma.w * k) / 2, y0: y - forma.arriba * k, y1: y + forma.abajo * k };
}

function solape(a: Caja, b: Caja) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);

  return w > 0 && h > 0 ? w * h : 0;
}

const seCruzan = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0;

/** Quién se pinta por delante: el más bajo en la foto (más cerca) y, en la misma fila, el de la izquierda. */
export function profundidad(x: number, y: number) {
  return Math.round(y) * 2000 - Math.round(x);
}

/**
 * La chapa de una ficha. 12/11/2026 (marketing: «Carvajal, Mario y Dani muy
 * pequeños»): en una cara apretada sólo encoge la foto; la chapa con el nombre
 * se queda a su tamaño, colgada del mismo sitio (8 px por encima de los pies,
 * a escala).
 */
export function cajaChapa(x: number, y: number, ancho: number, k = 1): Caja {
  const y0 = y - CHAPA.arriba * k;

  return { x0: x - ancho / 2, x1: x + ancho / 2, y0, y1: y0 + CHAPA.arriba + CHAPA.abajo };
}

/** Lo alto que va la chapa (de arriba abajo) de una ficha a escala `k`. */
const altoChapa = (y: number, k: number) => [y - CHAPA.arriba * k, y - CHAPA.arriba * k + CHAPA.arriba + CHAPA.abajo] as const;

/** Lo opaco de la cara de una ficha (sin su chapa). */
export function cajaCara(x: number, y: number, k = 1): Caja {
  return caja(x, y, CARA, k);
}

/** El disco del rival y, si lleva apellido, su placa (debajo o, si no cabe, encima). */
export function cajasRival(x: number, y: number, placa = 0, arriba = false): Caja[] {
  const disco = caja(x, y, DISCO);

  if (!placa) return [disco];

  const y0 = arriba ? disco.y0 - PLACA_ALTO - 2 : y - 2;

  return [disco, { x0: x - placa / 2, x1: x + placa / 2, y0, y1: y0 + PLACA_ALTO }];
}

/* ------------------------------------------------------------------ */
/*  NUESTRAS CARAS                                                     */
/* ------------------------------------------------------------------ */

type Pos = { id: string; x: number; y: number; x0: number; chapa: number; k: number };

/**
 * Lo que tienen que separarse en horizontal dos fichas para que ningún nombre
 * quede tapado: ni chapa con chapa, ni la cara del de delante sobre la chapa
 * del de detrás. 0 si no se cruzan en vertical (no se pueden pisar).
 */
function hueco(a: Pos, b: Pos) {
  let falta = 0;

  if (a.chapa && b.chapa && seCruzan(...altoChapa(a.y, a.k), ...altoChapa(b.y, b.k))) {
    falta = Math.max(falta, (a.chapa + b.chapa) / 2 + AIRE_NOMBRES);
  }

  const [delante, detras] = profundidad(a.x0, a.y) > profundidad(b.x0, b.y) ? [a, b] : [b, a];

  if (detras.chapa && seCruzan(delante.y - CARA.arriba * delante.k, delante.y - CHAPA.arriba * delante.k, ...altoChapa(detras.y, detras.k))) {
    falta = Math.max(falta, (CARA.w * delante.k + detras.chapa) / 2 + 2);
  }

  /* Dos caras en la misma fila, que no se monten más de un cuarto. */
  if (Math.abs(a.y - b.y) < 40) falta = Math.max(falta, (CARA.w * (a.k + b.k)) / 2 * 0.78);

  return falta;
}

/** Lo que tiene que apartarse en horizontal una ficha para no pisar una caja fija (nuestro portero). */
function huecoFijo(p: Pos, fijo: Caja) {
  const cara = cajaCara(p.x, p.y, p.k);
  const chapa = p.chapa ? cajaChapa(p.x, p.y, p.chapa, p.k) : null;
  const pisa = solape(cara, fijo) > 0 || (chapa != null && solape(chapa, fijo) > 0);

  if (!pisa) return 0;

  const medio = Math.max(CARA.w * p.k, p.chapa) / 2;
  const centro = (fijo.x0 + fijo.x1) / 2;

  /* Hacia el lado que menos cuesta. */
  return p.x >= centro ? fijo.x1 + medio + 2 - p.x : fijo.x0 - medio - 2 - p.x;
}

function relaja(pos: Pos[], fijos: Caja[]) {
  for (let vuelta = 0; vuelta < 240; vuelta += 1) {
    let movido = false;

    for (let i = 0; i < pos.length; i += 1) {
      for (let j = i + 1; j < pos.length; j += 1) {
        const a = pos[i];
        const b = pos[j];
        const falta = hueco(a, b);

        if (!falta) continue;

        const dx = b.x - a.x;

        if (Math.abs(dx) >= falta - 0.5) continue;

        /* Se respeta el orden de la pizarra: el que estaba a la izquierda sigue a la izquierda. */
        const sentido = b.x0 !== a.x0 ? Math.sign(b.x0 - a.x0) : 1;
        const empuje = (falta - sentido * dx) / 2;

        if (empuje <= 0) continue;

        const ax = tope(a, a.x - sentido * empuje);
        const bx = tope(b, b.x + sentido * empuje);

        if (Math.abs(ax - a.x) > 0.01 || Math.abs(bx - b.x) > 0.01) movido = true;

        a.x = ax;
        b.x = bx;
      }
    }

    for (const p of pos) {
      for (const fijo of fijos) {
        const mueve = huecoFijo(p, fijo);

        if (Math.abs(mueve) > 0.01) {
          const nx = tope(p, p.x + mueve);

          if (Math.abs(nx - p.x) > 0.01) movido = true;

          p.x = nx;
        }
      }
    }

    if (!movido) break;
  }
}

function tope(p: Pos, x: number) {
  const max = p.k < 1 ? ABRE_MAX_APRETADA : ABRE_MAX;

  return Math.max(p.x0 - max, Math.min(p.x0 + max, x));
}

function pisadas(pos: Pos[], fijos: Caja[]) {
  const mal = new Set<string>();

  for (let i = 0; i < pos.length; i += 1) {
    for (let j = i + 1; j < pos.length; j += 1) {
      const falta = hueco(pos[i], pos[j]);

      if (falta && Math.abs(pos[j].x - pos[i].x) < falta - 1) {
        mal.add(pos[i].id);
        mal.add(pos[j].id);
      }
    }

    if (fijos.some((fijo) => Math.abs(huecoFijo(pos[i], fijo)) > 1)) mal.add(pos[i].id);
  }

  return mal;
}

/**
 * Dónde se pinta cada una de las nuestras. Primero se abren a su tamaño (hasta
 * 64 px a cada lado); las que siguen pisando un nombre se pintan apretadas y
 * se abren más (hasta 110 px). `fijos`: lo que no se mueve y no se puede tapar
 * (nuestro portero bajo palos, con su nombre).
 */
export function separaFichas(fichas: Punto[], fijos: Caja[] = []): Separadas {
  const apretadas = new Set<string>();
  let pos: Pos[] = [];

  for (let ronda = 0; ronda < 4; ronda += 1) {
    pos = fichas.map((ficha) => ({
      id: ficha.id,
      x: ficha.x,
      y: ficha.y,
      x0: ficha.x,
      chapa: ficha.chapa ?? 0,
      k: apretadas.has(ficha.id) ? ESCALA_APRETADA : 1,
    }));

    relaja(pos, fijos);

    const mal = pisadas(pos, fijos);
    const nuevas = [...mal].filter((id) => !apretadas.has(id));

    if (nuevas.length === 0) break;

    nuevas.forEach((id) => apretadas.add(id));
  }

  return new Map(pos.map((p) => [p.id, { x: Math.round(p.x), compacta: p.k < 1 }]));
}

/** Las cajas que ocupan las nuestras ya colocadas: la cara y la chapa de cada una. */
function cajasFichas(fichas: Punto[], separadas: Separadas | null) {
  return fichas.map((ficha) => {
    const sep = separadas?.get(ficha.id);
    const x = sep?.x ?? ficha.x;
    const k = sep?.compacta ? ESCALA_APRETADA : 1;

    return {
      id: ficha.id,
      x,
      y: ficha.y,
      k,
      cara: cajaCara(x, ficha.y, k),
      chapa: ficha.chapa ? cajaChapa(x, ficha.y, ficha.chapa, k) : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  NUESTRO PORTERO                                                    */
/* ------------------------------------------------------------------ */

export type LadoNombre = "abajo" | "derecha" | "izquierda" | "arriba";

/** El disco de nuestro portero (52 con su filo oro) y la placa de su nombre a cada lado. */
export function cajasPortero(x: number, y: number, nombre: number, lado: LadoNombre): Caja[] {
  const disco = caja(x, y, DISCO);

  if (!nombre) return [disco];

  const medio = (disco.y0 + disco.y1) / 2;
  const placa =
    lado === "abajo"
      ? { x0: x - nombre / 2, x1: x + nombre / 2, y0: y, y1: y + 22 }
      : lado === "arriba"
        ? { x0: x - nombre / 2, x1: x + nombre / 2, y0: disco.y0 - 26, y1: disco.y0 - 4 }
        : lado === "derecha"
          ? { x0: disco.x1 + 4, x1: disco.x1 + 4 + nombre, y0: medio - 11, y1: medio + 11 }
          : { x0: disco.x0 - 4 - nombre, x1: disco.x0 - 4, y0: medio - 11, y1: medio + 11 };

  return [disco, placa];
}

/**
 * Hacia dónde va el nombre de nuestro portero (12/11/2026, falta directa: la
 * cara de Pol, justo debajo, lo dejaba en «TRE»). Debajo si cabe; si no, al
 * lado libre o encima. Se decide con las caras donde las puso el analista,
 * antes de separarlas (y luego se apartan de él, `separaFichas` con `fijos`).
 */
export function ladoNombrePortero(portero: { x: number; y: number; nombre: number }, fichas: Punto[]): LadoNombre {
  if (!portero.nombre) return "abajo";

  const ocupado = cajasFichas(fichas, null).flatMap((f) => [f.cara, ...(f.chapa ? [f.chapa] : [])]);
  const lados: LadoNombre[] = ["abajo", "derecha", "izquierda", "arriba"];
  const coste = (lado: LadoNombre) => {
    const placa = cajasPortero(portero.x, portero.y, portero.nombre, lado)[1];

    return ocupado.reduce((suma, otra) => suma + solape(otra, placa), 0) + (placa.y0 < 96 ? 1e6 : 0);
  };

  return lados.find((lado) => coste(lado) === 0) ?? [...lados].sort((a, b) => coste(a) - coste(b))[0];
}

/* ------------------------------------------------------------------ */
/*  LOS RIVALES                                                        */
/* ------------------------------------------------------------------ */

export type Apartados = Map<string, { x: number; y: number; debajo: boolean; nombreArriba: boolean }>;

/** Por dónde puede ir algo pintado sin salirse del campo de la foto. */
const LIENZO = { x0: 30, x1: 1890, y0: 100, y1: 1066 };

const dentro = (c: Caja) => c.x0 >= LIENZO.x0 && c.x1 <= LIENZO.x1 && c.y0 >= LIENZO.y0 && c.y1 <= LIENZO.y1;

/** Los sitios alrededor de un punto, de cerca a lejos (los de los lados y por delante primero). */
function alrededor(x: number, y: number, hasta: number, paso = 12) {
  const sitios: { x: number; y: number; d: number }[] = [{ x, y, d: 0 }];

  for (let r = paso; r <= hasta; r += paso) {
    for (let g = 0; g < 16; g += 1) {
      const a = (g / 16) * Math.PI * 2;
      /* En perspectiva el campo se ve achatado: los sitios, en elipse. */
      const sx = x + Math.cos(a) * r;
      const sy = y + Math.sin(a) * r * 0.8;
      /*
      | Más caro hacia arriba: detrás de la fila está la portería y, en el
      | córner defensivo, el de la zona; un rival allí se lee como suyo.
      */
      const d = r * (Math.sin(a) < -0.3 ? 1.6 : 1);

      sitios.push({ x: sx, y: sy, d });
    }
  }

  return sitios.sort((a, b) => a.d - b.d);
}

/**
 * Dónde se pinta cada rival para no tapar a los nuestros ni que le tapen.
 *
 * 12/11/2026 (tercera ronda): antes, si no había sitio a 70 px se pintaba
 * DEBAJO de las caras y su nombre salía cortado (4 GIL, 5 RIJN, 9 MARCO en el
 * córner defensivo). Ahora busca en anillos hasta 260 px —el más cercano que no
 * pisa ninguna cara, ninguna chapa, ningún otro rival ni lo que se pase en
 * `otras`— y su apellido va debajo del disco o, si ahí no cabe, encima. La
 * chapa de su marca ya lleva su dorsal («M1 →4»): aunque se aparte, se sabe
 * quién es de quién. Si nada queda limpio, el sitio que menos tapa.
 */
export function apartaRivales(rivales: Punto[], fichas: Punto[], separadas: Separadas | null, otras: Caja[] = []): Apartados {
  const nuestras = cajasFichas(fichas, separadas);
  const chapas = nuestras.flatMap((f) => (f.chapa ? [{ ...f.chapa, x0: f.chapa.x0 - 4, x1: f.chapa.x1 + 4 }] : []));
  const caras = nuestras.map((f) => f.cara);
  const puestos: Caja[] = [];
  const salida: Apartados = new Map();

  const coste = (cajas: Caja[]) =>
    cajas.reduce(
      (suma, c) =>
        suma +
        chapas.reduce((s, o) => s + solape(o, c) * 6, 0) +
        caras.reduce((s, o) => s + solape(o, c) * 2, 0) +
        puestos.reduce((s, o) => s + solape(o, c) * 6, 0) +
        otras.reduce((s, o) => s + solape(o, c) * 6, 0) +
        (dentro(c) ? 0 : 5000),
      0,
    );

  for (const rival of rivales) {
    let mejor: { x: number; y: number; arriba: boolean; coste: number } | null = null;

    for (const sitio of alrededor(rival.x, rival.y, 260)) {
      for (const arriba of rival.chapa ? [false, true] : [false]) {
        const c = coste(cajasRival(sitio.x, sitio.y, rival.chapa ?? 0, arriba));

        if (!mejor || c < mejor.coste) mejor = { x: sitio.x, y: sitio.y, arriba, coste: c };
        if (c === 0) break;
      }

      if (mejor?.coste === 0) break;
    }

    const final = mejor ?? { x: rival.x, y: rival.y, arriba: false, coste: 0 };

    puestos.push(...cajasRival(final.x, final.y, rival.chapa ?? 0, final.arriba));
    salida.set(rival.id, { x: Math.round(final.x), y: Math.round(final.y), debajo: false, nombreArriba: final.arriba });
  }

  return salida;
}

/* ------------------------------------------------------------------ */
/*  LAS LETRAS DE LAS CONSIGNAS                                        */
/* ------------------------------------------------------------------ */

/**
 * La letra de una consigna (A, B, «C·D·E») junto a lo que nombra. `x, y` son
 * los pies de la figura (ya separada) —o, si la consigna habla de un grupo
 * entero («Marcas: …», «En barreras…»), el centro del grupo a la altura de su
 * primera fila—, `k` su escala y `w × h` lo que mide la letra.
 */
export type Insignia = { id: string; x: number; y: number; k: number; w: number; h: number; grupo?: boolean };

export type Colocadas = Map<string, { left: number; top: number }>;

/** Un rival ya colocado, con su placa: lo que las letras no pueden tapar. */
export type RivalColocado = Punto & { nombreArriba?: boolean };

/**
 * Dónde va cada letra para no tapar ningún nombre (12/11/2026, jueces: «E»
 * sobre CORTA LEIVA, «C» sobre MARIO → «MAR»).
 *
 * Se prueban sitios alrededor de su figura —las dos esquinas de la cabeza, los
 * dos costados de la cara, encima y a los lados de su chapa— y, si ninguno
 * queda limpio, en anillos cada vez más lejos (hasta 200 px). Gana el primero
 * que no pisa ninguna chapa, ninguna cara, ningún rival ni su placa, nuestro
 * portero ni otra letra ya puesta. Lo comparten la lámina general, el
 * PowerPoint y el PDF de cada jugador (que fotografía la misma lámina).
 */
export function colocaInsignias(
  insignias: Insignia[],
  fichas: Punto[],
  separadas: Separadas | null,
  rivales: RivalColocado[] = [],
  otras: Caja[] = [],
): Colocadas {
  const delante = cajasFichas(fichas, separadas);
  const fijas: Caja[] = [...rivales.flatMap((rival) => cajasRival(rival.x, rival.y, rival.chapa ?? 0, rival.nombreArriba)), ...otras];
  const puestas: Caja[] = [];
  const salida: Colocadas = new Map();

  for (const una of insignias) {
    const { x, y, k, w, h } = una;
    const suya = una.grupo ? undefined : delante.find((d) => d.id === una.id);
    const anchoChapa = suya?.chapa ? suya.chapa.x1 - suya.chapa.x0 : 60 * k;

    const cerca = una.grupo
      ? [
          { left: x - w / 2, top: y - 122 * k - h - 6 },
          { left: x - w / 2, top: y + 34 * k + 6 },
        ]
      : [
          { left: x + 34 * k, top: y - 138 * k },
          { left: x - 34 * k - w, top: y - 138 * k },
          { left: x + 42 * k, top: y - 86 * k },
          { left: x - 42 * k - w, top: y - 86 * k },
          { left: x - w / 2, top: y - 118 * k - h - 4 },
          { left: x + anchoChapa / 2 + 4, top: y - 4 },
          { left: x - anchoChapa / 2 - 4 - w, top: y - 4 },
        ];
    const centro = { x: x, y: y - 70 * k };
    const lejos = alrededor(centro.x, centro.y, 200, 10)
      .slice(1)
      .map((s) => ({ left: s.x - w / 2, top: s.y - h / 2 }));

    const coste = (c: { left: number; top: number }) => {
      /* Con 3 px de aire: tocar el borde de una chapa ya se lee como encima. */
      const box = { x0: c.left - 3, x1: c.left + w + 3, y0: c.top - 3, y1: c.top + h + 3 };

      return (
        delante.reduce((suma, d) => suma + (d.chapa ? solape(d.chapa, box) * 4 : 0) + solape(d.cara, box), 0) +
        fijas.reduce((suma, otra) => suma + solape(otra, box) * 3, 0) +
        puestas.reduce((suma, otra) => suma + solape(otra, box) * 4, 0) +
        (dentro(box) ? 0 : 5000)
      );
    };

    const elegido =
      cerca.find((c) => coste(c) === 0) ?? lejos.find((c) => coste(c) === 0) ?? [...cerca, ...lejos].sort((a, b) => coste(a) - coste(b))[0];

    puestas.push({ x0: elegido.left, x1: elegido.left + w, y0: elegido.top, y1: elegido.top + h });
    salida.set(una.id, { left: Math.round(elegido.left), top: Math.round(elegido.top) });
  }

  return salida;
}

/* ------------------------------------------------------------------ */
/*  LA COMPROBACIÓN                                                    */
/* ------------------------------------------------------------------ */

/**
 * Lo que queda tapado en una lámina ya colocada: cada nombre (chapa, placa del
 * rival, nombre del portero, letra) que pisa otra cosa. Vacío = limpia. La usa
 * el arnés que valida las láminas exportadas; la pantalla no la necesita.
 */
export function solapesDeLamina({
  fichas,
  separadas,
  rivales = [],
  portero = [],
  letras = [],
  nombre = (id) => id,
}: {
  fichas: Punto[];
  separadas: Separadas | null;
  rivales?: RivalColocado[];
  portero?: Caja[];
  letras?: { id: string; caja: Caja }[];
  nombre?: (id: string) => string;
}): string[] {
  const nuestras = cajasFichas(fichas, separadas).map((f) => ({ ...f, z: profundidad(f.x, f.y) }));
  const avisos: string[] = [];
  const TOLERA = 6;
  const pisa = (a: Caja, b: Caja) => solape(a, b) > TOLERA;

  for (const a of nuestras) {
    for (const b of nuestras) {
      if (a === b) continue;

      if (a.id < b.id && a.chapa && b.chapa && pisa(a.chapa, b.chapa)) avisos.push(`chapa ${nombre(a.id)} × chapa ${nombre(b.id)}`);
      /* La cara del de delante sobre la chapa del de detrás. */
      if (a.z > b.z && b.chapa && pisa({ ...a.cara, y1: a.y - CHAPA.arriba * a.k }, b.chapa)) avisos.push(`cara ${nombre(a.id)} tapa chapa ${nombre(b.id)}`);
    }
  }

  const deRival = rivales.map((r) => ({ r, cajas: cajasRival(r.x, r.y, r.chapa ?? 0, r.nombreArriba) }));

  for (const { r, cajas } of deRival) {
    for (const f of nuestras) {
      for (const c of cajas) {
        if (f.chapa && pisa(c, f.chapa)) avisos.push(`rival ${nombre(r.id)} × chapa ${nombre(f.id)}`);
        if (solape(c, f.cara) > 60) avisos.push(`rival ${nombre(r.id)} × cara ${nombre(f.id)}`);
      }
    }

    for (const otro of deRival) {
      if (otro.r.id <= r.id) continue;
      if (cajas.some((c) => otro.cajas.some((o) => pisa(c, o)))) avisos.push(`rival ${nombre(r.id)} × rival ${nombre(otro.r.id)}`);
    }

    if (cajas.some((c) => portero.some((p) => pisa(c, p)))) avisos.push(`rival ${nombre(r.id)} × portero`);
  }

  for (const p of portero) {
    for (const f of nuestras) {
      if (pisa(p, f.cara) || (f.chapa && pisa(p, f.chapa))) avisos.push(`portero × ${nombre(f.id)}`);
    }
  }

  letras.forEach((l, i) => {
    for (const f of nuestras) {
      if (pisa(l.caja, f.cara) || (f.chapa && pisa(l.caja, f.chapa))) avisos.push(`letra ${l.id} × ${nombre(f.id)}`);
    }

    for (const { r, cajas } of deRival) if (cajas.some((c) => pisa(c, l.caja))) avisos.push(`letra ${l.id} × rival ${nombre(r.id)}`);
    if (portero.some((p) => pisa(p, l.caja))) avisos.push(`letra ${l.id} × portero`);

    letras.slice(i + 1).forEach((otra) => {
      if (pisa(l.caja, otra.caja)) avisos.push(`letra ${l.id} × letra ${otra.id}`);
    });
  });

  return [...new Set(avisos)];
}
