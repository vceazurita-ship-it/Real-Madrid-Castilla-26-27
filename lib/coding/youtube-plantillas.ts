/**
 * CÓMO SE LLAMA EL VÍDEO QUE SUBE AL CANAL.
 *
 * El título y la descripción de una subida se escriben **dos veces**: una en
 * el panel de YouTube, como plantilla que vale para todos los montajes, y otra
 * —si hace falta— en el aviso que sale justo antes de subir, para ese vídeo y
 * sólo para ése. Aquí vive lo que comparten los dos sitios: los huecos que se
 * pueden poner, cómo se rellenan y qué se escribe cuando nadie ha tocado nada.
 *
 * Este fichero no toca ni el disco ni la red a propósito: lo lee el servidor
 * —`lib/coding/youtube.ts`, que va con la clave de Supabase— y lo lee el
 * navegador —el panel y la pantalla del coding—, y tener las plantillas por
 * defecto en dos sitios distintos acaba siempre con un vídeo llamándose de una
 * forma en la vista previa y de otra en YouTube.
 */

/** Un hueco de la plantilla, con lo que hay que enseñar de él en la pantalla. */
export type HuecoPlantilla = {
  /** Cómo se escribe, llaves incluidas. */
  clave: string;
  /** Qué es, en una línea. */
  explica: string;
};

/**
 * Los huecos que se pueden usar, en el orden en que se enseñan.
 *
 * Son pocos y a propósito: un vídeo del coding se identifica por el partido y
 * por lo que se estaba mirando, y todo lo demás —la fecha, el fichero— es
 * contexto que casi siempre sobra en el título pero se agradece abajo.
 */
export const HUECOS: HuecoPlantilla[] = [
  { clave: "{partido}", explica: "el partido del coding" },
  { clave: "{filtro}", explica: "el jugador, el comportamiento o la categoría" },
  { clave: "{fecha}", explica: "el día en que se monta, 30/08/2026" },
  { clave: "{fichero}", explica: "el nombre del vídeo descargado" },
];

/** El título de siempre, que es el que se venía poniendo solo. */
export const PLANTILLA_TITULO = "{partido} · {filtro}";

/** La descripción de siempre. */
export const PLANTILLA_DESCRIPCION =
  "{partido}\n{filtro}\n\nMontado con el coding del RMCF Castilla · {fichero}";

/** Lo que se sabe del vídeo cuando toca ponerle nombre. */
export type DatosPlantilla = {
  partido: string;
  filtro: string;
  fichero: string;
  /** El día del montaje. Se pasa para no llamar a `Date` dentro de un render. */
  fecha: string;
};

/**
 * Cambia los huecos por sus valores.
 *
 * Un hueco de los de `HUECOS` que esta vez no vale nada —el vídeo de todo el
 * partido no tiene filtro— desaparece **con su separador**: dejarlo daba
 * títulos terminados en « · » y descripciones con un renglón en blanco de más.
 *
 * Un hueco que no existe se queda tal cual, con sus llaves. Es un error de
 * escritura, y verlo en el aviso de antes de subir es la única forma de
 * enterarse: borrarlo en silencio deja un título al que le falta media frase
 * sin que nadie sepa por qué.
 */
export function rellenaPlantilla(plantilla: string, datos: DatosPlantilla) {
  const valores: Record<string, string> = {
    partido: datos.partido,
    filtro: datos.filtro,
    fecha: datos.fecha,
    fichero: datos.fichero,
  };

  return plantilla
    .replace(/\{(\w+)\}/g, (entero, hueco: string) =>
      hueco in valores ? valores[hueco] : entero,
    )
    /* Un hueco vacío deja separadores colgando: « · » al final, o dos líneas en blanco. */
    .replace(/[ \t]*·[ \t]*(?=\n|$)/g, "")
    .replace(/^[ \t]*·[ \t]*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** El día de hoy tal y como se escribe en las plantillas. */
export function fechaDeHoy(cuando = new Date()) {
  return cuando.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
