/*
|--------------------------------------------------------------------------
| Lo recién escrito, encima del CSV publicado (07/10/2026)
|--------------------------------------------------------------------------
|
| El modelo de juego y los valores de equipo se leen del CSV que publica la
| hoja, y Google tarda minutos en refrescarlo. Guardar y recargar enseñaba el
| texto de antes —tirar la copia con `olvidaCsv` no basta: lo viejo viene del
| propio Google—, y la siguiente edición partía de él.
|
| Así que cada texto que llega a la hoja se apunta aquí, en `localStorage`,
| con su hora, y al cargar se pone encima del CSV durante diez minutos. En
| cuanto el CSV ya dice lo mismo, la nota sobra y se tira.
*/

const VIGENCIA = 10 * 60 * 1000;

type Notas = Record<string, { valor: string; en: number }>;

const claveDe = (espacio: string) => `rmcf-escrito:${espacio}`;

function lee(espacio: string): Notas {
  try {
    const crudo = window.localStorage.getItem(claveDe(espacio));
    const notas = crudo ? (JSON.parse(crudo) as Notas) : {};

    return notas && typeof notas === "object" ? notas : {};
  } catch {
    return {};
  }
}

function escribe(espacio: string, notas: Notas) {
  try {
    if (Object.keys(notas).length === 0) {
      window.localStorage.removeItem(claveDe(espacio));
    } else {
      window.localStorage.setItem(claveDe(espacio), JSON.stringify(notas));
    }
  } catch {
    /* Cuota llena o modo privado: se sigue sin la nota. */
  }
}

/** Apunta lo que acaba de llegar a la hoja, por `ID` de fila. */
export function anotaEscritas(espacio: string, cambios: Record<string, string>) {
  if (typeof window === "undefined") return;

  const notas = lee(espacio);
  const ahora = Date.now();

  for (const [id, valor] of Object.entries(cambios)) {
    notas[id] = { valor, en: ahora };
  }

  escribe(espacio, notas);
}

/**
 * Pone lo recién escrito encima de las filas del CSV. Lo caducado y lo que el
 * CSV ya trae al día se tira.
 */
export function aplicaEscritas<T extends { ID: unknown }>(
  espacio: string,
  filas: T[],
  campo: keyof T,
): T[] {
  if (typeof window === "undefined") return filas;

  const notas = lee(espacio);

  if (Object.keys(notas).length === 0) return filas;

  const ahora = Date.now();

  for (const [id, nota] of Object.entries(notas)) {
    if (ahora - nota.en > VIGENCIA) delete notas[id];
  }

  const resultado = filas.map((fila) => {
    const nota = notas[String(fila.ID)];

    if (!nota) return fila;

    if (String(fila[campo] ?? "") === nota.valor) {
      delete notas[String(fila.ID)];

      return fila;
    }

    return { ...fila, [campo]: nota.valor };
  });

  escribe(espacio, notas);

  return resultado;
}
