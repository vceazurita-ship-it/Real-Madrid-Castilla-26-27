/**
 * LAS TILDES QUE LA HOJA SE COME (21/10/2026).
 *
 * La hoja RIVALES escribe muchos nombres como llegan de BeSoccer o de un
 * teclado sin tildes: «IVAN MORENO», «ANGEL GOMEZ», «JAVIER AVILES», junto a
 * «JONY ÁLAMO», que sí la lleva. Es la ficha que se proyecta en la charla, y
 * el experto de guion lo marcó como descuido.
 *
 * Esto **sólo pinta**: el nombre que se guarda y por el que se cruza con
 * BeSoccer, Wyscout y las fotos sigue siendo el de la hoja. Por eso se aplica
 * en las pantallas (lista, campograma, ficha) y nunca al dato.
 *
 * Es una lista cerrada de nombres y apellidos españoles que sólo se escriben
 * con tilde. Una palabra que ya trae alguna tilde no se toca, y los nombres
 * que también existen sin ella en otras lenguas («Martin», «Simon», «Adrian»)
 * se dejan como vienen: mejor una tilde de menos que una de más.
 */

const CON_TILDE: Record<string, string> = {
  alvarez: "Álvarez",
  alamo: "Álamo",
  andres: "Andrés",
  angel: "Ángel",
  aviles: "Avilés",
  benitez: "Benítez",
  carrion: "Carrión",
  cesar: "César",
  diaz: "Díaz",
  dominguez: "Domínguez",
  fernandez: "Fernández",
  garcia: "García",
  gimenez: "Giménez",
  gomez: "Gómez",
  gonzalez: "González",
  gutierrez: "Gutiérrez",
  hernandez: "Hernández",
  ivan: "Iván",
  jesus: "Jesús",
  jimenez: "Jiménez",
  joaquin: "Joaquín",
  jose: "José",
  julian: "Julián",
  lopez: "López",
  marquez: "Márquez",
  martinez: "Martínez",
  mendez: "Méndez",
  munoz: "Muñoz",
  nicolas: "Nicolás",
  nunez: "Núñez",
  oscar: "Óscar",
  perez: "Pérez",
  ramirez: "Ramírez",
  ramon: "Ramón",
  raul: "Raúl",
  rodriguez: "Rodríguez",
  ruben: "Rubén",
  saez: "Sáez",
  sanchez: "Sánchez",
  suarez: "Suárez",
  tomas: "Tomás",
  vazquez: "Vázquez",
  velazquez: "Velázquez",
  victor: "Víctor",
};

const TIENE_TILDE = /[áéíóúÁÉÍÓÚñÑ]/;

/** Respeta cómo viene escrita: en mayúsculas sigue en mayúsculas. */
function comoVenia(original: string, buena: string) {
  if (original === original.toUpperCase()) return buena.toUpperCase();

  return buena;
}

export function conTildes(nombre: string | null | undefined): string {
  const texto = String(nombre ?? "");

  if (!texto) return texto;

  return texto.replace(/\p{L}+/gu, (palabra) => {
    if (TIENE_TILDE.test(palabra)) return palabra;

    const buena = CON_TILDE[palabra.toLowerCase()];

    return buena ? comoVenia(palabra, buena) : palabra;
  });
}
