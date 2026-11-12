/**
 * Que nadie tape a nadie al enseñar la pizarra (proyector y exportación).
 *
 * En el córner los rematadores van hombro con hombro y, a tamaño de sala,
 * cuatro caras apiladas no dejan leer ni el puesto ni el nombre. Sólo al
 * enseñar —al editar, cada cara está donde se ha puesto—: las que se pisan se
 * abren un poco hacia los lados (como mucho 30 px, para que sigan sobre el
 * arranque de su flecha) y, si aun así no caben, se pintan más pequeñas y se
 * abren algo más. Nunca sin foto: el 25/10/2026 el cuerpo técnico echó en falta
 * caras en la exportación y en los informes (antes se pintaban como un disco
 * con el puesto, sin foto).
 *
 * Los rivales (ronda del sobresaliente, 21/10/2026): la marca de un rival
 * colocada a menos de metro y medio de uno de los nuestros le tapaba la cara
 * —el R3 en el segundo palo sólo enseñaba la «R»—. Se aparta hacia el lado
 * libre y, si aun así sigue encima, se pinta por debajo de la cara: lo que se
 * explica es nuestra rutina, el rival es la referencia.
 *
 * Todo va en coordenadas de la plantilla (1920 × 1080). Nada de esto se guarda:
 * mueve lo pintado, no el documento.
 */

type Punto = {
  id: string;
  x: number;
  y: number;
  /**
   * Lo que mide de ancho la chapa con el nombre (01/11/2026). Con el nombre
   * a 18 px una chapa pasa de los 76 px que separan a dos de una fila, y la
   * de al lado se comía media palabra. Sin dato, se cuenta sólo la cara.
   */
  chapa?: number;
};

const SEPARA_X = 84;
const SEPARA_Y = 64;
const EMPUJE_MAX = 30;

/*
| Lo que ocupa cada cosa respecto a su punto (los pies), tal y como la pinta
| `TableroSlide`: la cara es la foto de 120 de alto con la chapa debajo; el
| disco compacto, 54 más el nombre; el rival, su chapa de 52 encima del punto.
*/
const CARA = { w: 84, arriba: 118, abajo: 32 };

/** La chapa, de 8 px por encima de los pies a 32 por debajo. */
const CHAPA = { arriba: 8, abajo: 32 };

/** Cuánto se encoge una cara que, ya abierta, sigue pisando a otra. */
export const ESCALA_APRETADA = 0.74;

const DISCO = { w: Math.round(84 * ESCALA_APRETADA), arriba: Math.round(118 * ESCALA_APRETADA), abajo: Math.round(32 * ESCALA_APRETADA) };
const RIVAL = { w: 52, arriba: 56, abajo: -2 };

/*
| El rival con su apellido debajo del disco (12/11/2026, jueces: «rival y su
| dorsal» en la leyenda y un icono genérico en el campo). La placa del nombre
| ocupa unos 22 px bajo el punto y lo que mida de ancho (`chapa` del rival).
*/
const formaRival = (rival: { chapa?: number }) =>
  rival.chapa ? { w: Math.max(RIVAL.w, rival.chapa), arriba: RIVAL.arriba, abajo: 22 } : RIVAL;


/** Hasta dónde se aparta un rival antes de rendirse y pintarse debajo. */
const APARTA_MAX = 56;

export type Separadas = Map<string, { x: number; compacta: boolean }>;

/** El rectángulo de la chapa (encoge desde los pies, como la cara). */
function cajaChapa(x: number, y: number, ancho: number, k = 1) {
  return caja(x, y, { w: ancho * k, arriba: CHAPA.arriba * k, abajo: CHAPA.abajo * k });
}

export function separaFichas(fichas: Punto[]): Separadas {
  const pos = fichas.map((ficha) => ({ id: ficha.id, x: ficha.x, y: ficha.y, x0: ficha.x, chapa: ficha.chapa ?? 0 }));

  /* Lo que tienen que separarse dos para que ni las caras ni las chapas se pisen. */
  const hueco = (a: (typeof pos)[number], b: (typeof pos)[number], ka = 1, kb = 1, cara = SEPARA_X) => {
    const mismasChapas = Math.abs(b.y - a.y) < (CHAPA.arriba + CHAPA.abajo) * Math.max(ka, kb);

    return Math.max(cara, mismasChapas ? (a.chapa * ka + b.chapa * kb) / 2 + 6 : 0);
  };

  for (let vuelta = 0; vuelta < 24; vuelta += 1) {
    let movido = false;

    for (let i = 0; i < pos.length; i += 1) {
      for (let j = i + 1; j < pos.length; j += 1) {
        const a = pos[i];
        const b = pos[j];
        const dx = b.x - a.x;
        const separa = hueco(a, b);

        if (Math.abs(b.y - a.y) >= SEPARA_Y || Math.abs(dx) >= separa - 1) continue;

        const sentido = dx === 0 ? (a.x0 <= b.x0 ? 1 : -1) : Math.sign(dx);
        const empuje = (separa - Math.abs(dx)) / 2;

        const ax = Math.max(a.x0 - EMPUJE_MAX, Math.min(a.x0 + EMPUJE_MAX, a.x - sentido * empuje));
        const bx = Math.max(b.x0 - EMPUJE_MAX, Math.min(b.x0 + EMPUJE_MAX, b.x + sentido * empuje));

        if (ax !== a.x || bx !== b.x) movido = true;

        a.x = ax;
        b.x = bx;
      }
    }

    if (!movido) break;
  }

  const compactas = new Set<string>();

  /*
  | Compacta toda cara que, ya abierta, sigue pisando la foto o la chapa de
  | otra: no sólo las de la misma fila. Un rematador que llega en carrera a la
  | altura del de al lado le tapaba la chapa aunque no estuvieran «en fila».
  | Y también si lo que se pisan son los nombres de las dos chapas.
  */
  for (let i = 0; i < pos.length; i += 1) {
    for (let j = i + 1; j < pos.length; j += 1) {
      const a = pos[i];
      const b = pos[j];
      const caras = solape(caja(a.x, a.y, CARA), caja(b.x, b.y, CARA));
      const chapas = a.chapa && b.chapa ? solape(cajaChapa(a.x, a.y, a.chapa), cajaChapa(b.x, b.y, b.chapa)) : 0;

      if (caras > 300 || chapas > 40) {
        compactas.add(a.id);
        compactas.add(b.id);
      }
    }
  }

  /*
  | Las apretadas son más estrechas (la cara a menos tamaño): se les deja
  | abrirse un poco más para que se pisen lo menos posible.
  */
  const forma = (p: { id: string }) => (compactas.has(p.id) ? DISCO : CARA);
  const escala = (p: { id: string }) => (compactas.has(p.id) ? ESCALA_APRETADA : 1);
  const tope = (p: { id: string }) => (compactas.has(p.id) ? 48 : EMPUJE_MAX);

  /*
  | Segunda pasada, con lo que de verdad ocupa cada uno: dos caras apretadas, o
  | una apretada junto a una normal, se abren hasta no pisarse (hasta 48 px).
  */
  for (let vuelta = 0; vuelta < 32; vuelta += 1) {
    let movido = false;

    for (let i = 0; i < pos.length; i += 1) {
      for (let j = i + 1; j < pos.length; j += 1) {
        const a = pos[i];
        const b = pos[j];

        if (!compactas.has(a.id) && !compactas.has(b.id)) continue;

        const pisanCaras = solape(caja(a.x, a.y, forma(a)), caja(b.x, b.y, forma(b))) > 0;
        const pisanChapas =
          a.chapa > 0 &&
          b.chapa > 0 &&
          solape(cajaChapa(a.x, a.y, a.chapa, escala(a)), cajaChapa(b.x, b.y, b.chapa, escala(b))) > 0;

        if (!pisanCaras && !pisanChapas) continue;

        const dx = b.x - a.x;
        const sentido = dx === 0 ? (a.x0 <= b.x0 ? 1 : -1) : Math.sign(dx);
        const hace = hueco(a, b, escala(a), escala(b), (forma(a).w + forma(b).w) / 2) + 2 - Math.abs(dx);
        const empuje = Math.max(1, hace / 2);

        const ax = Math.max(a.x0 - tope(a), Math.min(a.x0 + tope(a), a.x - sentido * empuje));
        const bx = Math.max(b.x0 - tope(b), Math.min(b.x0 + tope(b), b.x + sentido * empuje));

        if (ax !== a.x || bx !== b.x) movido = true;

        a.x = ax;
        b.x = bx;
      }
    }

    if (!movido) break;
  }

  return new Map(pos.map((p) => [p.id, { x: Math.round(p.x), compacta: compactas.has(p.id) }]));
}

/** El rectángulo que ocupa algo de pie sobre su punto (x, y). */
function caja(x: number, y: number, forma: { w: number; arriba: number; abajo: number }) {
  return { x0: x - forma.w / 2, x1: x + forma.w / 2, y0: y - forma.arriba, y1: y + forma.abajo };
}

type Caja = ReturnType<typeof caja>;

function solape(a: Caja, b: Caja) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);

  return w > 0 && h > 0 ? w * h : 0;
}

export type Apartados = Map<string, { x: number; y: number; debajo: boolean }>;

/**
 * Dónde se pinta cada rival para no tapar a los nuestros.
 *
 * Se prueban sitios cercanos —a los lados primero, luego arriba y abajo— y se
 * queda el primero que no pisa ninguna cara ni otro rival ya colocado. Si
 * ninguno vale dentro de `APARTA_MAX`, el rival se queda en su punto y se
 * pinta por debajo de las caras (`debajo`).
 */
export function apartaRivales(
  rivales: Punto[],
  fichas: Punto[],
  separadas: Separadas | null,
): Apartados {
  /* La cara y, si se sabe, la chapa con el nombre: un rival encima de la chapa
     dejaba la lámina sin saber quién era el de debajo (12/11/2026, jueces). */
  const caras = fichas.flatMap((ficha) => {
    const sep = separadas?.get(ficha.id);
    const x = sep?.x ?? ficha.x;
    const k = sep?.compacta ? ESCALA_APRETADA : 1;

    return [
      caja(x, ficha.y, sep?.compacta ? DISCO : CARA),
      ...(ficha.chapa ? [cajaChapa(x, ficha.y, ficha.chapa, k)] : []),
    ];
  });

  const puestos: Caja[] = [];
  const salida: Apartados = new Map();

  /*
  | 12/11/2026 (jueces, saque de banda defensivo): con 40 px² de tolerancia el
  | disco de un rival se comía el borde de la chapa de Sergio, de Mario y de
  | Cestero. Contra una chapa (el nombre) no se tolera nada; contra la cara,
  | un poco (el borde transparente de la foto).
  */
  const chapas = fichas.flatMap((ficha) => {
    const sep = separadas?.get(ficha.id);

    return ficha.chapa ? [cajaChapa(sep?.x ?? ficha.x, ficha.y, ficha.chapa + 8, sep?.compacta ? ESCALA_APRETADA : 1)] : [];
  });
  const pisa = (c: Caja) =>
    chapas.some((chapa) => solape(chapa, c) > 0) ||
    caras.some((cara) => solape(cara, c) > 40) ||
    puestos.some((otra) => solape(otra, c) > 40);

  const PASOS = [0, 14, 28, 42, APARTA_MAX, APARTA_MAX + 14];

  for (const rival of rivales) {
    let elegido: { x: number; y: number } | null = null;

    for (const paso of PASOS) {
      const candidatos =
        paso === 0
          ? [{ x: rival.x, y: rival.y }]
          : [
              { x: rival.x + paso, y: rival.y },
              { x: rival.x - paso, y: rival.y },
              { x: rival.x + paso, y: rival.y - paso / 2 },
              { x: rival.x - paso, y: rival.y - paso / 2 },
              { x: rival.x, y: rival.y - paso },
              { x: rival.x, y: rival.y + paso },
            ];

      elegido = candidatos.find((c) => !pisa(caja(c.x, c.y, formaRival(rival)))) ?? null;

      if (elegido) break;
    }

    /*
    | 12/11/2026 (jueces): en una fila de marcas —córner y falta lateral
    | defensivos— los nuestros van a 76 px y no queda hueco a los lados: un
    | tercio de los rivales acababa «debajo», sin dorsal a la vista. Antes de
    | rendirse se prueba un paso por delante de la fila (hacia el que saca, más
    | abajo en la foto), donde está de verdad el atacante antes del golpeo.
    */
    if (!elegido) {
      for (const dy of [70, 90, 110, 130]) {
        const candidatos = [0, 18, -18, 36, -36, 54, -54].map((dx) => ({ x: rival.x + dx, y: rival.y + dy }));

        elegido = candidatos.find((c) => !pisa(caja(c.x, c.y, formaRival(rival)))) ?? null;

        if (elegido) break;
      }
    }

    const final = elegido ?? { x: rival.x, y: rival.y };

    puestos.push(caja(final.x, final.y, formaRival(rival)));
    salida.set(rival.id, { x: Math.round(final.x), y: Math.round(final.y), debajo: elegido == null });
  }

  return salida;
}

/* ------------------------------------------------------------------ */
/*  LAS LETRAS DE LAS CONSIGNAS                                        */
/* ------------------------------------------------------------------ */

/**
 * La letra de una consigna (A, B, «C·D·E») junto a la figura que nombra.
 * `x, y` son los pies de la figura (ya separada), `k` su escala (compacta o
 * no) y `w × h` lo que mide la letra.
 */
export type Insignia = { id: string; x: number; y: number; k: number; w: number; h: number };

export type Colocadas = Map<string, { left: number; top: number }>;

/**
 * Dónde va cada letra para no tapar ningún nombre (12/11/2026, jueces: «E»
 * sobre CORTA LEIVA, «C» sobre MARIO → «MAR»).
 *
 * Iba siempre en la esquina de arriba a la derecha de la cabeza y, en el
 * córner, esa esquina cae justo en la chapa del compañero de detrás. Ahora se
 * prueban sitios alrededor de su figura —las dos esquinas de la cabeza, los
 * dos costados de la cara, encima y a los lados de su chapa— y gana el
 * primero que no pisa ninguna chapa (tampoco la suya), ninguna otra cara,
 * ningún rival ni otra letra ya puesta. Si ninguno queda limpio, el que menos
 * pisa. Lo comparten la lámina general, el PowerPoint y el PDF de cada
 * jugador (que fotografía la misma lámina).
 */
export function colocaInsignias(
  insignias: Insignia[],
  fichas: Punto[],
  separadas: Separadas | null,
  rivales: Punto[] = [],
  otras: Caja[] = [],
): Colocadas {
  const delante = fichas.map((ficha) => {
    const sep = separadas?.get(ficha.id);
    const x = sep?.x ?? ficha.x;
    const k = sep?.compacta ? ESCALA_APRETADA : 1;

    return {
      id: ficha.id,
      cara: caja(x, ficha.y, sep?.compacta ? DISCO : CARA),
      chapa: ficha.chapa ? cajaChapa(x, ficha.y, ficha.chapa + 6, k) : null,
    };
  });

  const fijas: Caja[] = [...rivales.map((rival) => caja(rival.x, rival.y, formaRival(rival))), ...otras];
  const puestas: Caja[] = [];
  const salida: Colocadas = new Map();

  for (const una of insignias) {
    const { x, y, k, w, h } = una;
    const suya = delante.find((d) => d.id === una.id);
    const anchoChapa = suya?.chapa ? suya.chapa.x1 - suya.chapa.x0 : 60 * k;

    const candidatos = [
      { left: x + 34 * k, top: y - 138 * k },
      { left: x - 34 * k - w, top: y - 138 * k },
      { left: x + 44 * k, top: y - 86 * k },
      { left: x - 44 * k - w, top: y - 86 * k },
      { left: x - w / 2, top: y - 122 * k - h - 4 },
      { left: x + anchoChapa / 2 + 4, top: y - 4 },
      { left: x - anchoChapa / 2 - 4 - w, top: y - 4 },
    ];

    const coste = (c: { left: number; top: number }) => {
      /* Con 3 px de aire: tocar el borde de una chapa ya se lee como encima. */
      const box = { x0: c.left - 3, x1: c.left + w + 3, y0: c.top - 3, y1: c.top + h + 3 };

      return (
        delante.reduce((suma, d) => suma + (d.chapa ? solape(d.chapa, box) * 4 : 0) + (d.id !== una.id ? solape(d.cara, box) : 0), 0) +
        fijas.reduce((suma, otra) => suma + solape(otra, box) * 2, 0) +
        puestas.reduce((suma, otra) => suma + solape(otra, box) * 4, 0)
      );
    };

    const elegido = candidatos.find((c) => coste(c) === 0) ?? [...candidatos].sort((a, b) => coste(a) - coste(b))[0];

    puestas.push({ x0: elegido.left, x1: elegido.left + w, y0: elegido.top, y1: elegido.top + h });
    salida.set(una.id, { left: Math.round(elegido.left), top: Math.round(elegido.top) });
  }

  return salida;
}
