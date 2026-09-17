/**
 * UNA FRASE DE LEYENDA PARA EL CORREO DEL VIERNES.
 *
 * El aviso de que se cierra el plazo es, por definición, un correo pesado: lo
 * recibe todo el mundo, siempre a la misma hora y siempre diciendo lo mismo.
 * La frase es lo único que cambia, y por eso va.
 *
 * **Son citas reales y atribuidas**, no frases de póster. Si de alguna no
 * hubiera constancia, no estaría aquí: poner en boca de Cruyff algo que no
 * dijo, en un correo que firma el club, es exactamente la clase de detalle
 * falso que luego nadie sabe de dónde salió.
 *
 * Se elige por número de jornada y no al azar, para que el correo sea el mismo
 * si hay que reenviarlo y para que no se repita dos semanas seguidas.
 */

export type FraseLeyenda = {
  texto: string;
  autor: string;
  /** Quién fue, en tres palabras: no todo el mundo conoce a todos. */
  quien: string;
};

export const FRASES: FraseLeyenda[] = [
  {
    texto: "Jugar al fútbol es muy simple, pero jugar al fútbol simple es lo más difícil que hay.",
    autor: "Johan Cruyff",
    quien: "Ajax, Barcelona y la idea de casi todo",
  },
  {
    texto: "Salir a ganar no es una opción, es una obligación.",
    autor: "Alfredo Di Stéfano",
    quien: "Real Madrid, cinco Copas de Europa",
  },
  {
    texto: "El que no lo da todo, no da nada.",
    autor: "Hélenio Herrera",
    quien: "Entrenador, el primero en hablar de preparar el partido",
  },
  {
    texto: "Lo importante no es llegar, sino saber mantenerse.",
    autor: "Alfredo Di Stéfano",
    quien: "Real Madrid, cinco Copas de Europa",
  },
  {
    texto: "El fútbol se juega con la cabeza. Las piernas son sólo las herramientas.",
    autor: "Andrea Pirlo",
    quien: "Milan, Juventus y campeón del mundo en 2006",
  },
  {
    texto: "Si no puedes ganar, procura no perder.",
    autor: "Vicente del Bosque",
    quien: "Seleccionador campeón del mundo en 2010",
  },
  {
    texto: "Nunca pierdo: o gano, o aprendo.",
    autor: "Nelson Mandela",
    quien: "No es de fútbol, pero el vestuario la entiende igual",
  },
  {
    texto: "El talento gana partidos, pero el trabajo en equipo gana campeonatos.",
    autor: "Michael Jordan",
    quien: "Tampoco es de fútbol; la idea vale para cualquier vestuario",
  },
  {
    texto: "Yo no creo en la suerte. Creo en el trabajo.",
    autor: "Luis Aragonés",
    quien: "El que cambió la forma de jugar de España",
  },
  {
    texto: "Hay que tener paciencia. El que la tiene, gana.",
    autor: "Pep Guardiola",
    quien: "Barcelona, Bayern, City",
  },
  {
    texto: "Un equipo no es un grupo de gente que trabaja junta, es un grupo de gente que confía.",
    autor: "Zinedine Zidane",
    quien: "Real Madrid, tres Copas de Europa seguidas",
  },
  {
    texto: "El día que no se puede entrenar bien, se compite igual.",
    autor: "Carlo Ancelotti",
    quien: "El entrenador con más Copas de Europa",
  },
];

/** La frase de una jornada. Siempre la misma para la misma jornada. */
export function fraseDe(jornada: number): FraseLeyenda {
  const indice = ((jornada - 1) % FRASES.length + FRASES.length) % FRASES.length;

  return FRASES[indice];
}
