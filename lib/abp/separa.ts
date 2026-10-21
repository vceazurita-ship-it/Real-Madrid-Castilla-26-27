/**
 * Que nadie tape a nadie al enseñar la pizarra (proyector y exportación).
 *
 * En el córner los rematadores van hombro con hombro y, a tamaño de sala,
 * cuatro caras apiladas no dejan leer ni el puesto ni el nombre. Sólo al
 * enseñar —al editar, cada cara está donde se ha puesto—: las que se pisan se
 * abren un poco hacia los lados (como mucho 30 px, para que sigan sobre el
 * arranque de su flecha) y, si aun así no caben, se pintan compactas: el puesto
 * en un disco y el nombre debajo, sin foto.
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

type Punto = { id: string; x: number; y: number };

const SEPARA_X = 84;
const SEPARA_Y = 64;
const EMPUJE_MAX = 30;

/*
| Lo que ocupa cada cosa respecto a su punto (los pies), tal y como la pinta
| `TableroSlide`: la cara es la foto de 120 de alto con la chapa debajo; el
| disco compacto, 54 más el nombre; el rival, su chapa de 52 encima del punto.
*/
const CARA = { w: 84, arriba: 118, abajo: 22 };
const DISCO = { w: 64, arriba: 66, abajo: 10 };
const RIVAL = { w: 52, arriba: 56, abajo: -2 };


/** Hasta dónde se aparta un rival antes de rendirse y pintarse debajo. */
const APARTA_MAX = 56;

export type Separadas = Map<string, { x: number; compacta: boolean }>;

export function separaFichas(fichas: Punto[]): Separadas {
  const pos = fichas.map((ficha) => ({ id: ficha.id, x: ficha.x, y: ficha.y, x0: ficha.x }));

  for (let vuelta = 0; vuelta < 24; vuelta += 1) {
    let movido = false;

    for (let i = 0; i < pos.length; i += 1) {
      for (let j = i + 1; j < pos.length; j += 1) {
        const a = pos[i];
        const b = pos[j];
        const dx = b.x - a.x;

        if (Math.abs(b.y - a.y) >= SEPARA_Y || Math.abs(dx) >= SEPARA_X - 1) continue;

        const sentido = dx === 0 ? (a.x0 <= b.x0 ? 1 : -1) : Math.sign(dx);
        const empuje = (SEPARA_X - Math.abs(dx)) / 2;

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
  */
  for (let i = 0; i < pos.length; i += 1) {
    for (let j = i + 1; j < pos.length; j += 1) {
      const a = caja(pos[i].x, pos[i].y, CARA);
      const b = caja(pos[j].x, pos[j].y, CARA);

      if (solape(a, b) > 300) {
        compactas.add(pos[i].id);
        compactas.add(pos[j].id);
      }
    }
  }

  /*
  | Las compactas son más estrechas (un disco de 54 px): entre ellas basta con
  | 64 px, y se les deja abrirse un poco más, que ya no tapan ninguna foto.
  */
  const forma = (p: { id: string }) => (compactas.has(p.id) ? DISCO : CARA);
  const tope = (p: { id: string }) => (compactas.has(p.id) ? 48 : EMPUJE_MAX);

  /*
  | Segunda pasada, con lo que de verdad ocupa cada uno: dos discos, o un disco
  | junto a una cara, se abren hasta no pisarse (los discos, hasta 48 px).
  */
  for (let vuelta = 0; vuelta < 32; vuelta += 1) {
    let movido = false;

    for (let i = 0; i < pos.length; i += 1) {
      for (let j = i + 1; j < pos.length; j += 1) {
        const a = pos[i];
        const b = pos[j];

        if (!compactas.has(a.id) && !compactas.has(b.id)) continue;

        const ca = caja(a.x, a.y, forma(a));
        const cb = caja(b.x, b.y, forma(b));

        if (solape(ca, cb) <= 0) continue;

        const dx = b.x - a.x;
        const sentido = dx === 0 ? (a.x0 <= b.x0 ? 1 : -1) : Math.sign(dx);
        const hace = (forma(a).w + forma(b).w) / 2 + 2 - Math.abs(dx);
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
  const caras = fichas.map((ficha) => {
    const sep = separadas?.get(ficha.id);
    const x = sep?.x ?? ficha.x;

    return caja(x, ficha.y, sep?.compacta ? DISCO : CARA);
  });

  const puestos: Caja[] = [];
  const salida: Apartados = new Map();

  const pisa = (c: Caja) => caras.some((cara) => solape(cara, c) > 40) || puestos.some((otra) => solape(otra, c) > 40);

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

      elegido = candidatos.find((c) => !pisa(caja(c.x, c.y, RIVAL))) ?? null;

      if (elegido) break;
    }

    const final = elegido ?? { x: rival.x, y: rival.y };

    puestos.push(caja(final.x, final.y, RIVAL));
    salida.set(rival.id, { x: Math.round(final.x), y: Math.round(final.y), debajo: elegido == null });
  }

  return salida;
}
