/*
|--------------------------------------------------------------------------
| LO QUE SE HA VISTO EN EL VÍDEO DE HUDL Y EL TIMELINE NO DICE (03/11/2026)
|--------------------------------------------------------------------------
|
| Hudl sólo da tercios: cuando una jugada nace en el tercio del medio no se
| sabe desde qué mitad arranca. En las transiciones eso decide la tipología
| (campo propio o contrario), así que se ha mirado en el vídeo de Hudl del
| partido, con la línea de medio campo a la vista. Lo lee
| `scripts/goles-liga.mjs` y, en la ficha, sale como «visto en el vídeo».
|
| La clave es la del gol (`<idPartido de BeSoccer>:<n.º de gol>`) y el campo,
| desde el Castilla: «propio» es nuestra mitad. Los segundos, del vídeo de Hudl.
*/

export type VistoEnVideo = { campo: "propio" | "contrario"; nota: string };

export const VISTO_EN_VIDEO: Record<string, VistoEnVideo> = {
  /* J06 9', Carvajal: tras el saque de puerta del Atlético, el balón dividido lo gana Mario Rivas pasado el medio campo. */
  "202724203:0": { campo: "contrario", nota: "Mario Rivas gana el balón pasado el medio campo, en la mitad del Atlético (8:05-8:09 del vídeo)." },
  /* J08 40', propia de Cestero: nuestro saque de banda, Carvajal la pierde y el Antequera roba en nuestra mitad. */
  "202724305:0": { campo: "propio", nota: "Tras nuestro saque de banda, el Antequera roba en nuestra mitad (38:47-38:52 del vídeo)." },
  /* J09 20', Juanma García: el pase atrás de Fati Joao lo roba el Algeciras en nuestra mitad. */
  "202724365:0": { campo: "propio", nota: "El pase atrás de Fati Joao se lo queda el Algeciras en nuestra mitad (19:51-19:53 del vídeo)." },
  /* J10 12', Fortuny: la falta que saca rápido Fortea es pasado el medio campo. */
  "202724389:0": { campo: "contrario", nota: "La falta que saca rápido Fortea es pasado el medio campo, en la mitad del Cartagena (11:18 del vídeo)." },
};
