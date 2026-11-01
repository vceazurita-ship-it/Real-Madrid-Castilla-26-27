/**
 * La asignación de coste mínimo de `n` filas a `m` columnas (n ≤ m): para cada
 * fila, su columna. Es el método húngaro de siempre (Kuhn-Munkres con
 * potenciales), O(n²·m): con once huecos y cuarenta jugadores no se nota.
 *
 * Lo usan la propuesta de once (el mejor once en conjunto, no hueco a hueco)
 * y el tablero de los onces (qué ficha ocupa qué hueco, por cercanía).
 */
export function hungaro(coste: number[][]): number[] {
  const n = coste.length;
  const m = coste[0]?.length ?? 0;

  if (n === 0 || m < n) return new Array(n).fill(-1);

  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const camino = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const usado = new Array(m + 1).fill(false);

    do {
      usado[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= m; j += 1) {
        if (usado[j]) continue;

        const cur = coste[i0 - 1][j - 1] - u[i0] - v[j];

        if (cur < minv[j]) {
          minv[j] = cur;
          camino[j] = j0;
        }

        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }

      for (let j = 0; j <= m; j += 1) {
        if (usado[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = camino[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const fila = new Array(n).fill(-1);

  for (let j = 1; j <= m; j += 1) if (p[j]) fila[p[j] - 1] = j - 1;

  return fila;
}
