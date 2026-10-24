/**
 * Los nombres de jugador de un texto libre, escritos como en la plantilla.
 *
 * Las consignas del plan de partido se teclean a mano («Cestero y yañez
 * frontal») y llegan a la diapositiva tal cual. Aquí se busca cada apellido o
 * apodo de la plantilla, sin mirar mayúsculas ni tildes, y se sustituye por su
 * forma oficial. Lo que no es un nombre de la plantilla no se toca.
 */

type Jugador = { nombre?: string; apodo?: string };

const sinTildes = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const esLetra = (c: string | undefined) => !!c && /[a-zñ]/i.test(c);

export function ajustaNombres(texto: string, jugadores: Jugador[]): string {
  /* Forma oficial por clave sin tildes. Más larga primero: «De la Fuente»
     antes que «Fuente». */
  const formas = new Map<string, string>();

  for (const jugador of jugadores) {
    for (const campo of [jugador.apodo, jugador.nombre]) {
      const valor = (campo ?? "").trim();

      if (!valor) continue;

      const palabras = valor.split(/\s+/);

      if (palabras.length > 1) formas.set(sinTildes(valor), valor);

      for (const palabra of palabras) {
        /* Las palabras cortas («de», «Pol») dan falsos aciertos. */
        if (palabra.length >= 4 && !formas.has(sinTildes(palabra))) {
          formas.set(sinTildes(palabra), palabra);
        }
      }
    }
  }

  const claves = [...formas.keys()].sort((a, b) => b.length - a.length);
  const limpio = sinTildes(texto);

  /* Si quitar tildes cambia el largo (texto descompuesto), no se arriesga. */
  if (limpio.length !== texto.length) return texto;

  let salida = "";
  let i = 0;

  while (i < texto.length) {
    let puesto = false;

    if (!esLetra(texto[i - 1])) {
      for (const clave of claves) {
        if (limpio.startsWith(clave, i) && !esLetra(texto[i + clave.length])) {
          salida += formas.get(clave)!;
          i += clave.length;
          puesto = true;
          break;
        }
      }
    }

    if (!puesto) {
      salida += texto[i];
      i += 1;
    }
  }

  return salida;
}
