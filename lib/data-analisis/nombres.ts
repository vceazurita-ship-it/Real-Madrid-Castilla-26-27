/**
 * Atar el mismo equipo escrito de tres maneras distintas.
 *
 * La hoja de microciclos escribe «CD TERUEL», el informe de Wyscout «Teruel» y
 * BeSoccer «C.D. Teruel». Son el mismo club y hay que cruzarlos sin una tabla
 * de equivalencias a mano, que se queda vieja en cuanto asciende alguien.
 *
 * La regla es comparar **palabra a palabra**, no por contenido de cadena. Con
 * un `includes` el «Real Madrid C» de la pretemporada se ataba a «Real Madrid
 * Castilla» —está contenido dentro— y la semana del filial se comparaba con
 * nuestro propio informe.
 */

const sinAcentos = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Fuera siglas, puntos y palabras de relleno: lo que queda distingue. */
const limpia = (texto: string) =>
  sinAcentos(texto)
    .replace(/[.]/g, " ")
    .replace(/\b(cf|cd|sd|fc|rcd|ud|ad|sad|club|de|del|la|el|los|las)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function mismoEquipo(uno: string, otro: string) {
  const a = limpia(uno);
  const b = limpia(otro);

  if (!a || !b) return false;

  if (a === b) return true;

  const palabrasA = a.split(" ").filter(Boolean);
  const palabrasB = b.split(" ").filter(Boolean);

  /*
  | La letra suelta **del final** distingue; la del principio es el club.
  |
  | «Real Madrid C» y «Real Madrid Castilla» son dos equipos distintos y lo
  | dice esa C final, así que hay que mirarla. Pero «C.D. Teruel» también deja
  | letras sueltas al limpiarlo, y ésas no distinguen nada: son las siglas.
  | Mirando sólo la última palabra no hay confusión —la C del filial va
  | detrás, la del club delante—.
  */
  const sufijo = (palabras: string[]) => {
    const ultima = palabras[palabras.length - 1] ?? "";

    return ultima.length <= 2 ? ultima : "";
  };

  if (sufijo(palabrasA) !== sufijo(palabrasB)) return false;

  /* Comparten al menos una palabra larga, que es la distintiva. */
  const largasA = palabrasA.filter((p) => p.length >= 5);
  const largasB = palabrasB.filter((p) => p.length >= 5);

  return largasA.some((p) => largasB.includes(p));
}

/**
 * Lo mismo para personas.
 *
 * Wyscout abrevia el nombre de pila —«M. Rezola»— y nuestras hojas lo escriben
 * entero. Manda el apellido: basta con que compartan una palabra de cinco
 * letras o más.
 */
export function mismaPersona(uno: string, otro: string) {
  const a = sinAcentos(uno).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  const b = sinAcentos(otro).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);

  if (a.length === 0 || b.length === 0) return false;

  const largasA = a.filter((p) => p.length >= 5);
  const largasB = b.filter((p) => p.length >= 5);

  return largasA.some((p) => largasB.includes(p));
}
