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

  return conApodosCortos(salida, jugadores);
}

/*
| 10/11/2026 (jueces): el apodo corto que se teclea («fortu» por Fortuny)
| no casaba con nada y salía en minúscula. Una palabra de cinco letras o más
| que sólo puede ser el arranque de UN jugador va con mayúscula; el resto del
| texto no se toca.
*/
/*
| 12/11/2026 (jueces): «Fortu» salía así en la lámina y en el PDF del
| jugador, y en su chapa pone «Pol» (Pol Fortuny): el lector no los casaba.
| El apodo corto pasa al nombre de la chapa —el apodo de la plantilla— si es
| de un solo jugador; si no hay apodo, sólo se le pone la mayúscula.
*/
function conApodosCortos(texto: string, jugadores: Jugador[]) {
  /* Palabra de su nombre (≥6 letras) → cómo se le llama en la chapa. */
  const nombres = new Map<string, string>();

  for (const jugador of jugadores) {
    const chapa = (jugador.apodo ?? "").trim();

    for (const campo of [jugador.apodo, jugador.nombre]) {
      for (const palabra of (campo ?? "").trim().split(/\s+/)) {
        if (palabra.length >= 6) nombres.set(sinTildes(palabra), chapa);
      }
    }
  }

  return texto.replace(/(?<![\p{L}])([a-zñáéíóúü]{5,})(?![\p{L}])/gu, (palabra) => {
    const clave = sinTildes(palabra);
    const casan = [...nombres.keys()].filter((nombre) => nombre.startsWith(clave) && nombre !== clave);

    if (casan.length !== 1) return palabra;

    const chapa = nombres.get(casan[0]) ?? "";

    return chapa ? chapa : palabra.charAt(0).toLocaleUpperCase("es-ES") + palabra.slice(1);
  });
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
    /* 30/10/2026: palabras de aviso que se escriben con mayúscula tras un
       guion o un paréntesis («— Atención al bloqueo») y salían como nombres. */
    "atencion", "ojo", "cuidado", "importante", "nota", "clave", "siempre", "nunca", "cuando", "despues", "antes",
    "luego", "primero", "balon", "rival", "rivales", "nosotros", "ellos", "todo", "nadie", "uno", "dos", "tres",
    "jugada", "jugadas", "variante", "opcion", "plan", "senal", "aviso", "consigna", "consignas", "movimiento",
    "ofensivo", "defensivo", "inicio", "final", "tras", "sin", "con", "para", "por", "desde", "hasta", "entre",
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
    /* Un guion, un paréntesis o unas comillas también abren frase (30/10/2026). */
    for (const frase of String(texto ?? "").split(/[.:;!?\n()«»"“”—–]+|\s-\s/)) {
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

/*
| 12/11/2026 (jueces): «JOAN-MARIO+ RACHAD-CESTERO», «ROBER SACA A CORTA»,
| «CUANDO FORTU VA A JUEGO EN CORTO». Las consignas llegan en mayúsculas
| sostenidas y `nombresSueltos` sólo ve nombres por la mayúscula, así que
| ninguno de los tres saltaba y el jugador recibía «Fortu» en su PDF. Aquí
| se mira la forma de la frase, no la mayúscula: una palabra que no es de la
| plantilla ni del oficio y que va pegada con guion, «+» o «/» al nombre de un
| jugador, o que hace de sujeto de un verbo de la jugada («X saca», «cuando
| X va»), es un nombre. Se propone el jugador más parecido si lo hay.
*/
const VERBOS_JUGADA = new Set([
  "va", "van", "saca", "sacan", "sale", "salen", "entra", "entran", "cae", "caen", "bloquea", "bloquean", "remata",
  "rematan", "fija", "fijan", "corta", "arrastra", "ataca", "atacan", "tira", "lanza", "busca", "espera", "queda",
  "marca", "amplia", "cierra", "ocupa", "viene", "llega", "pide", "juega", "pisa", "gira", "vigila", "acompana",
  "dobla", "aguanta", "cubre", "salta", "empuja", "protege", "libera", "recibe", "pasa", "centra", "mete", "se",
]);

const PALABRAS_COMUNES = new Set([
  "de", "la", "el", "los", "las", "a", "en", "y", "o", "u", "e", "que", "por", "para", "con", "del", "al", "se", "su",
  "sus", "un", "una", "unos", "unas", "lo", "le", "les", "si", "no", "mas", "muy", "ya", "pero", "como", "sobre",
  "otro", "otra", "cada", "mismo", "misma", "este", "esta", "ese", "esa", "hay", "es", "son", "sea", "esten",
  "juego", "acciones", "accion", "lado", "orden", "parejas", "pareja", "fijadores", "fijador", "cortas", "cortos",
  "directas", "zona", "porteria", "primero", "segundo", "tercero", "golpeo", "golpea", "bote", "bajo", "alto",
  "mientras", "rematadores", "bloqueadores", "lanzadores", "sacadores", "jugador", "jugadores", "companero",
]);

function distanciaEdicion(a: string, b: string) {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i += 1) {
    let previo = fila[0];

    fila[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const guardado = fila[j];

      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1));
      previo = guardado;
    }
  }

  return fila[b.length];
}

export type NombreDudoso = { palabra: string; sugerencia?: string };

export function nombresDudosos(textos: string[], jugadores: Jugador[]): NombreDudoso[] {
  /* Palabra → forma oficial, de todos los nombres y apodos de la plantilla. */
  const formas = new Map<string, string>();

  for (const jugador of jugadores) {
    for (const campo of [jugador.apodo, jugador.nombre]) {
      for (const palabra of (campo ?? "").trim().split(/\s+/)) {
        if (palabra.length >= 3) formas.set(sinTildes(palabra), palabra);
      }
    }
  }

  const deLaPlantilla = (w: string) =>
    formas.has(w) || (w.length >= 5 && [...formas.keys()].some((nombre) => nombre.length > w.length && nombre.startsWith(w)));

  const salida = new Map<string, NombreDudoso>();

  for (const texto of textos) {
    const crudo = String(texto ?? "");
    const limpio = sinTildes(crudo);

    if (limpio.length !== crudo.length) continue;

    /* Palabras con su separador de antes y de después. */
    const trozos = limpio.split(/([^a-zñ]+)/);
    const palabras: { w: string; antes: string; despues: string; inicio: number }[] = [];
    let posicion = 0;

    trozos.forEach((trozo, i) => {
      if (i % 2 === 0 && trozo) palabras.push({ w: trozo, antes: trozos[i - 1] ?? "", despues: trozos[i + 1] ?? "", inicio: posicion });
      posicion += trozo.length;
    });

    palabras.forEach(({ w, antes, despues, inicio }, i) => {
      if (w.length < 3 || DEL_OFICIO.has(w) || PALABRAS_COMUNES.has(w) || VERBOS_JUGADA.has(w) || deLaPlantilla(w)) return;

      const pegada = (sep: string) => /^\s*[-+/]\s*$/.test(sep);
      const vecinaJugador =
        (pegada(antes) && i > 0 && formas.has(palabras[i - 1].w)) ||
        (pegada(despues) && i + 1 < palabras.length && formas.has(palabras[i + 1].w));

      const siguiente = palabras[i + 1];
      const anterior = palabras[i - 1];
      const abreFrase = i === 0 || /[:+,;.(]/.test(antes);
      /* «superar corta», «sacar rápido»: un infinitivo no es un nombre. */
      const sujeto =
        !/(ar|er|ir)$/.test(w) &&
        Boolean(siguiente && /^\s+$/.test(despues) && VERBOS_JUGADA.has(siguiente.w)) &&
        (abreFrase || ["cuando", "si", "y", "que", "mientras"].includes(anterior?.w ?? ""));

      if (!vecinaJugador && !sujeto) return;

      const original = crudo.slice(inicio, inicio + w.length);
      const palabra = original.charAt(0).toLocaleUpperCase("es-ES") + original.slice(1).toLocaleLowerCase("es-ES");
      const parecida = [...formas.entries()]
        .map(([clave, forma]) => ({ forma, d: distanciaEdicion(w, clave) }))
        .filter(({ d, forma }) => d <= 2 && forma.length >= 4)
        .sort((a, b) => a.d - b.d)[0];

      if (!salida.has(w)) salida.set(w, { palabra, ...(parecida ? { sugerencia: parecida.forma } : {}) });
    });
  }

  return [...salida.values()];
}
