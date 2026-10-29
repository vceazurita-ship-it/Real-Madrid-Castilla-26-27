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

/**
 * Los jugadores de la plantilla que una consigna nombra y que no tienen ficha
 * en la diapositiva («Cestero frontal» sin Cestero en el campo). Un apellido
 * que comparten dos jugadores no cuenta: no se sabe de quién se habla.
 */
export function nombresSinFicha(
  textos: string[],
  jugadores: (Jugador & { id: string })[],
  enDiapositiva: Set<string>,
): string[] {
  const duenos = new Map<string, Set<string>>();

  for (const jugador of jugadores) {
    for (const campo of [jugador.apodo, jugador.nombre]) {
      const valor = sinTildes((campo ?? "").trim());

      if (!valor) continue;

      for (const clave of [valor, ...valor.split(/\s+/).filter((p) => p.length >= 4)]) {
        duenos.set(clave, (duenos.get(clave) ?? new Set()).add(jugador.id));
      }
    }
  }

  const limpio = ` ${sinTildes(textos.join(" ")).replace(/[^a-zñ]+/g, " ")} `;
  const fuera = new Set<string>();

  for (const [clave, ids] of duenos) {
    if (ids.size !== 1 || !limpio.includes(` ${clave} `)) continue;

    const [id] = ids;

    if (!enDiapositiva.has(id)) fuera.add(id);
  }

  return jugadores
    .filter((jugador) => fuera.has(jugador.id))
    .map((jugador) => jugador.apodo || jugador.nombre || "");
}

/*
| 29/10/2026: «Cestero y Yáñez frontal» nombraba a Yáñez, que no estaba en la
| plantilla cargada ni en ningún puesto, y no saltaba ningún aviso: la función
| de arriba sólo mira a los de la plantilla. Ésta busca además los nombres
| propios sueltos de las consignas (palabra con mayúscula que no abre la frase,
| o la que abre una pareja «X y Y») que no son de ninguna ficha de la
| diapositiva ni una palabra del oficio.
*/
const DEL_OFICIO = new Set(
  [
    "primer", "segundo", "palo", "palos", "frontal", "corner", "corners", "falta", "faltas", "saque", "saques",
    "bloqueo", "bloqueos", "zona", "zonas", "rechace", "rechaces", "equilibrio", "corta", "corto", "portero",
    "barrera", "marca", "marcas", "directa", "directo", "lateral", "laterales", "area", "punto", "penalti",
    "defensa", "ataque", "izquierda", "derecha", "izquierdo", "derecho", "centro", "central", "todos", "resto",
    "remate", "rematador", "rematadores", "lanzador", "sacador", "banda", "linea", "pequena", "grande",
    "salida", "vigilancia", "arrastre", "pantalla", "carrera", "espalda", "fuera", "dentro", "atras", "delante",
  ],
);

export function nombresSueltos(textos: string[], enDiapositiva: Jugador[]): string[] {
  const conocidas = new Set<string>();

  for (const jugador of enDiapositiva) {
    for (const campo of [jugador.apodo, jugador.nombre]) {
      for (const palabra of sinTildes((campo ?? "").trim()).split(/\s+/)) {
        if (palabra) conocidas.add(palabra);
      }
    }
  }

  const sueltos = new Map<string, string>();

  for (const texto of textos) {
    for (const frase of String(texto ?? "").split(/[.:;!?\n]+/)) {
      const palabras = frase.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) ?? [];

      palabras.forEach((palabra, i) => {
        const mayuscula = /^[A-ZÁÉÍÓÚÜÑ]/.test(palabra) && palabra !== palabra.toUpperCase();
        const abrePareja = i === 0 && sinTildes(palabras[1] ?? "") === "y" && /^[A-ZÁÉÍÓÚÜÑ]/.test(palabras[2] ?? "");

        if (!mayuscula || (i === 0 && !abrePareja) || palabra.length < 3) return;

        const clave = sinTildes(palabra);

        if (DEL_OFICIO.has(clave) || conocidas.has(clave)) return;
        sueltos.set(clave, palabra);
      });
    }
  }

  return [...sueltos.values()];
}
