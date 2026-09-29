/**
 * Faltas etiquetadas a mano mirando el vídeo del partido.
 *
 * ESTE FICHERO SE GENERA. No lo edites: lo escribe
 * scripts/faltas-datos.mjs a partir de los CSV de
 * Downloads/RMCF CASTILLA/ANALISIS FALTAS.
 *
 * Generado: 2026-09-29
 */

export type LadoFalta = "ofensivo" | "defensivo";

export type Falta = {
  /** "of-c03": de qué clip salió, para poder volver al vídeo. */
  clip: string;
  /** Ofensivo = a favor del Castilla. Defensivo = del rival. */
  lado: LadoFalta;
  /** Tercio del campo, contado hacia la portería que ataca quien saca. */
  zona: string;
  carril: string;
  /** "frontal" · "media" · "lejana". */
  distancia: string;
  /**
   * Cuántos defensores hay entre la falta y su propia portería, portero
   * incluido. `null` cuando no se veía el campo entero para contarlos.
   */
  entre: number | null;
  nota: string;
};

export type PartidoFaltas = {
  id: string;
  jornada: string;
  rival: string;
  local: boolean;
  fecha: string;
  resultado: string;
  /** De dónde salieron los clips, para poder volver al vídeo. */
  clips: string;
  notas: string[];
  faltas: Falta[];
};

export const PARTIDOS: PartidoFaltas[] = [
  {
    "id": "sant-andreu",
    "jornada": "LIGA 04",
    "rival": "UE Sant Andreu",
    "local": false,
    "fecha": "2026-09-21",
    "resultado": "1-1",
    "clips": "C:/Users/Usuario/Downloads/ABP vs SANT ANDREU",
    "notas": [
      "El campo se cuenta siempre hacia la portería que ataca quien saca la falta: «campo propio» es el del que la saca, no el nuestro.",
      "Las faltas van en el orden en que se dieron. El vídeo del partido no lleva reloj en pantalla, así que no se anota el minuto."
    ],
    "faltas": [
      {
        "clip": "def-c01",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 8,
        "nota": "Falta del Castilla al cortar la salida del Sant Andreu junto a la banda. Saque en corto y sigue el juego."
      },
      {
        "clip": "def-c02",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 6,
        "nota": "Entrada del Castilla en el círculo central. El jugador del Sant Andreu queda en el suelo y el saque en largo acaba con el balón en nuestra área."
      },
      {
        "clip": "def-c03",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "media",
        "entre": 2,
        "nota": "Falta del Castilla para cortar una salida rápida del Sant Andreu con la defensa muy abierta. El saque llega al área y se despeja."
      },
      {
        "clip": "def-c04",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 6,
        "nota": "Falta del Castilla sobre un jugador del Sant Andreu en el medio campo, por su carril derecho. Saque en corto hacia la banda y sigue el juego."
      },
      {
        "clip": "def-c05",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 9,
        "nota": "Falta del Castilla sobre un jugador del Sant Andreu junto a la banda, cerca de su propia área. Saque en largo y sigue el juego sin peligro."
      },
      {
        "clip": "def-c06",
        "lado": "defensivo",
        "zona": "campo rival",
        "carril": "centro",
        "distancia": "frontal",
        "entre": 5,
        "nota": "Derriban a un jugador del Sant Andreu en la frontal de nuestra área tras una contra. Falta directa, con barrera."
      },
      {
        "clip": "def-c07",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 5,
        "nota": "Falta sobre un jugador del Sant Andreu pegado a la banda, pasado el medio campo. Queda tendido y hay parada larga por asistencia."
      },
      {
        "clip": "def-c08",
        "lado": "defensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 5,
        "nota": "Derriban a un jugador del Sant Andreu a unos 25 metros, por su carril izquierdo. Saque muy retrasado que se cuelga al área y acaba en barullo delante del portero."
      },
      {
        "clip": "def-c09",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 8,
        "nota": "Falta del Castilla sobre el que sacaba el balón junto a la banda. Saque en largo al área y despeje."
      },
      {
        "clip": "def-c10",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 9,
        "nota": "Falta junto al círculo central. Parada muy larga con cambios y saque en largo al área del Castilla."
      },
      {
        "clip": "def-c11",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 4,
        "nota": "Falta en el círculo central con el Castilla muy adelantado. Parada larga por asistencia y saque en corto."
      },
      {
        "clip": "def-c12",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 5,
        "nota": "Falta en la banda derecha del Sant Andreu con el Castilla presionando arriba. Parada larga y saque en corto."
      },
      {
        "clip": "of-c01",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 10,
        "nota": "Falta del Sant Andreu sobre un jugador del Castilla al borde de nuestra área. El saque va en largo por banda hasta el medio campo."
      },
      {
        "clip": "of-c02",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 9,
        "nota": "Dos jugadores del Sant Andreu agarran a nuestro jugador en la salida de balón. El saque se juega en corto para seguir jugando."
      },
      {
        "clip": "of-c03",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 10,
        "nota": "Cortan a nuestro conductor dentro del círculo central. El balón queda parado en la línea de medio campo."
      },
      {
        "clip": "of-c04",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 10,
        "nota": "Choque con un jugador del Sant Andreu en la banda izquierda, justo en la línea de medio campo. El saque se juega en corto hacia dentro."
      },
      {
        "clip": "of-c05",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 10,
        "nota": "Falta sobre nuestro jugador en la línea de medio campo, por la izquierda. Se saca en corto hacia atrás y el Castilla reinicia la posesión sin peligro."
      },
      {
        "clip": "of-c06",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "media",
        "entre": 8,
        "nota": "Falta pegada a la banda derecha, ya en campo del Sant Andreu. Nuestro jugador queda en el suelo, se saca en corto y el Castilla sigue atacando por ese lado."
      },
      {
        "clip": "of-c07",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 11,
        "nota": "Entrada sobre nuestro conductor justo por detrás de la línea de medio campo, en campo propio, con todo el Sant Andreu por detrás del balón."
      },
      {
        "clip": "of-c08",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "derecha",
        "distancia": "frontal",
        "entre": 2,
        "nota": "Tras una parada larga el Castilla gana la espalda por la derecha y derriban a nuestro jugador junto al vértice del área, con sólo el portero y el defensa que entra por detrás del balón."
      },
      {
        "clip": "of-c09",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "derecha",
        "distancia": "media",
        "entre": 6,
        "nota": "Falta sobre nuestro atacante junto a la línea de fondo. El centro posterior lo atrapa el portero del Sant Andreu en el área pequeña."
      },
      {
        "clip": "of-c10",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 9,
        "nota": "Entrada sobre nuestro atacante en la esquina del área. El centro posterior lo despeja la defensa del Sant Andreu, con el bloque muy replegado."
      },
      {
        "clip": "of-c11",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "centro",
        "distancia": "frontal",
        "entre": 2,
        "nota": "Agarrón lejos del balón dentro del área, con nuestro atacante dolorido y sólo el portero y su par por delante."
      }
    ]
  },
  {
    "id": "alcorcon",
    "jornada": "LIGA 05",
    "rival": "AD Alcorcón",
    "local": true,
    "fecha": "2026-09-27",
    "resultado": "1-2",
    "clips": "Hudl · Castilla · «2026-09-27 Real Madrid Castilla - Alcorcón 1 - 2» (timeline de Sportscode)",
    "notas": [
      "Sale del timeline de Sportscode subido a Hudl —minuto, quién la hace, sobre quién y la tarjeta— y cada falta se ha revisado después con la retransmisión: zona, carril, distancia, defensores y la nota salen de la imagen.",
      "La cámara de TV es lateral y sigue al balón: los defensores entre la falta y la portería sólo se han podido contar en 1 de 28 (en las dos faltas laterales junto al área del minuto 83 y 91 la cuenta va en la nota: medida contra la línea de fondo no dice lo mismo). Donde la defensa o el portero quedan fuera de plano va «?», no una estimación.",
      "La falta del minuto 34 (Davo sobre Joan) no tiene vídeo: ese tramo no se pudo bajar de Hudl y va con lo que dice el timeline.",
      "El campo se cuenta siempre hacia la portería que ataca quien saca la falta."
    ],
    "faltas": [
      {
        "clip": "def-c01",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": null,
        "nota": "T1, min 18. Tras un centro de Fortea Joan Martínez choca en el juego aéreo con un jugador del Alcorcón dentro del área pequeña del Alcorcón (18:05). El árbitro deja seguir y Leiva remata pero luego señala la falta a favor del Alcorcón entre protestas del Castilla. No se ven los jugadores del Castilla de atrás ni su portero. Vídeo 18:03."
      },
      {
        "clip": "def-c02",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "T1, min 40. Pol Fortuny derriba a un jugador del Alcorcón justo sobre la línea de medio campo pegado a la banda de la tribuna (40:08). Luego Fortuny discute con Vacas y la falta aún no se ha sacado al acabar las imágenes. Por detrás del balón se ven cuatro jugadores del Castilla pero su defensa y el portero quedan fuera de plano. Vídeo 40:05."
      },
      {
        "clip": "def-c03",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T1, min 42. Leiva entra a un jugador del Alcorcón (Mayorga según Hudl) unos 10 m dentro del campo del Alcorcón y algo escorado hacia la banda de la cámara (42:45). El árbitro deja seguir un segundo y luego pita falta y Leiva protesta. La defensa y el portero del Castilla no salen en el plano. Vídeo 42:42."
      },
      {
        "clip": "def-c04",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 7,
        "nota": "T2, min 45. Joan Martínez tumba a Esteban Aparicio unos 10 m dentro del campo del Castilla y cerca de la banda de la tribuna nada más empezar la 2ª parte (45:53). Entre el balón y la portería quedan seis jugadores del Castilla más el portero (los otros cuatro están a la altura del balón o por delante). La realización pasa a primeros planos y no se ve el saque. Vídeo 50:59."
      },
      {
        "clip": "def-c05",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 50. Pitarch entra en plancha y derriba a un jugador del Alcorcón (Irurita según Hudl) a unos 30 m de la portería del Alcorcón (50:45). Hay amarilla (el árbitro la muestra a las 50:49). El Castilla estaba atacando y su defensa y su portero quedan fuera de plano. El reloj dice 50 y Hudl lo tenía a los 55:49 de vídeo (es el desfase del vídeo). Vídeo 55:49."
      },
      {
        "clip": "def-c06",
        "lado": "defensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": null,
        "nota": "T2, min 52. Mano de Naasei según Hudl en un balón que el Alcorcón llevaba hacia el banderín de córner del Castilla por la banda de la cámara (52:22-52:23). La mano en sí no se ve y el balón acaba fuera junto al banderín. Los del Alcorcón la reclaman y a las 52:25 hay un jugador del Alcorcón junto al balón con el Castilla metido en el área. Es una falta lateral junto a la línea de fondo más que media. Vídeo 57:27."
      },
      {
        "clip": "def-c07",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 57. Pitarch pelea por arriba con Mayorga unos 10 m dentro del campo del Alcorcón junto a la banda de la tribuna (57:12) y el árbitro pita falta con el brazo en alto. El balón se coloca ahí mismo y el Alcorcón aún no ha sacado a las 57:17. Hudl la pone por el centro pero en la imagen está en el carril de la banda lejana. No se ven la defensa ni el portero del Castilla. Vídeo 62:16."
      },
      {
        "clip": "def-c08",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 71. Dani Meso (dorsal 22) derriba a Mayorga en la frontal del área del Alcorcón junto al semicírculo después de perder el Castilla el balón (71:35). El árbitro señala hacia la portería del Castilla. El Castilla estaba atacando y su defensa y su portero quedan fuera de plano. Vídeo 76:39."
      },
      {
        "clip": "def-c09",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 78. Tras una falta botada por el Castilla el balón queda suelto y Mario Rivas derriba a Luis Vacas fuera del área del Alcorcón por la banda de la tribuna (78:16-78:17). El juego sigue unos segundos y el árbitro la pita a las 78:21. La defensa y el portero del Castilla no salen en el plano. Vídeo 83:22."
      },
      {
        "clip": "of-c01",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "centro",
        "distancia": "frontal",
        "entre": null,
        "nota": "T1, min 7. Es un PENALTI: tras el cabezazo (07:22) Bañuz para (07:23) y en el rechace choca con Yáñez que queda en el suelo junto a la portería (07:24-07:26) y el Alcorcón rodea al árbitro protestando. «Entre» no aplica a un penalti (se lanza con el portero solo) y en el choque el punto está pegado a la línea de gol. Hudl lo codifica como falta normal y pone la parada después de la falta cuando en la imagen va antes. Vídeo 7:22."
      },
      {
        "clip": "of-c02",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T1, min 20. Cuesta derriba a Martínez pegado a la banda lejana a la altura del borde de nuestra área (20:59) y el 7 del Alcorcón abre los brazos protestando. Por delante del balón quedan 9 - 7 y 20 del Alcorcón y el resto está fuera de plano a la izquierda así que no se puede contar. La TV pasa a primeros planos de Cuesta y el saque no se ve. Vídeo 20:55."
      },
      {
        "clip": "of-c03",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "T1, min 34. Sin imágenes (ese tramo no se pudo bajar). Davo sobre Joan Martínez y zona y carril salen de la ficha de Hudl dados la vuelta (Final third Right flank del Alcorcón = nuestro tercio y banda izquierda). Minuto estimado con el desfase vídeo-reloj de las jugadas vecinas (unos 34:57). Según Hudl la saca el propio Joan 3 s después del duelo. Vídeo 34:54."
      },
      {
        "clip": "of-c04",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T1, min 35. Ouhdadi derriba a Fortea en la banda lejana poco pasado el medio campo en nuestro campo (35:26) y Fortea queda sentado en el suelo. Por delante del balón quedan 20 - 7 y 9 del Alcorcón y el resto está fuera de plano a la izquierda. Luego primeros planos de Ouhdadi y el saque no se ve. Vídeo 35:22."
      },
      {
        "clip": "of-c05",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 46. Lancho entra por detrás a Pitarch en la banda cercana en nuestro campo a unos 17 m del medio campo (46:43-46:44) casi en la frontera con nuestro tercio. Pitarch la saca él mismo enseguida y corto (46:47-46:49) con el Alcorcón replegado y fuera de plano hacia su portería así que no se puede contar. Vídeo 51:49."
      },
      {
        "clip": "of-c06",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 48. Tras el saque de banda de Irurita (48:58) Davo y Pitarch caen juntos pegados a la banda lejana un poco pasado el pico de nuestra área (49:00) y el 17 del Alcorcón protesta con los brazos. Casi todo el Alcorcón está fuera de plano hacia la derecha así que no se puede contar y luego la TV enseña a Davo en primer plano sin el saque. Vídeo 54:06."
      },
      {
        "clip": "of-c07",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 49. El Castilla roba junto a nuestra área y Yáñez conduce hasta que Ouhdadi lo derriba por detrás en el lado de la banda cercana a unos metros del borde de nuestra área (49:48). Un jugador del Alcorcón aleja el balón (49:50) y el saque no se ve. La defensa y el portero del Alcorcón quedan fuera de plano así que no se puede contar. Vídeo 54:53."
      },
      {
        "clip": "of-c08",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 50. Davo (Alcorcón) derriba a Jesús Fortea (Castilla) a las 50:13 cuando este conduce fuera de su área por el costado derecho con Davo y el 11 del Alcorcón encima. Detrás del punto no hay ningún jugador del Alcorcón (serían todos) pero la cámara solo enseña a 5 y no a su portero. El balón queda parado a las 50:15 con Naasei al lado para sacar corto. Vídeo 55:17."
      },
      {
        "clip": "of-c09",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 53. Pablo Rivera (Alcorcón) derriba a Álvaro Leiva (Castilla) junto a la banda de los banquillos en campo propio a unos 15 m del medio campo a las 53:31. Entre 53:21 y 53:28 se ve una repetición del córner anterior del Alcorcón con el reloj corriendo y la cámara no enseña a la defensa ni al portero del Alcorcón. Vídeo 58:35."
      },
      {
        "clip": "of-c10",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 54. Miguel Berlanga (Alcorcón) llega tarde en un balón dividido y Joan Martínez (Castilla) cae junto a la banda de los banquillos en campo propio a las 54:36 y el árbitro la pita. Casi coincide con la línea entre tercio propio y central y la cámara no enseña la zona de la portería del Alcorcón. Vídeo 59:41."
      },
      {
        "clip": "of-c11",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 55. Mano de Miguel Cuesta (Alcorcón) al controlar en el borde del área del Castilla a las 55:22 tras un centro de Berlanga. El árbitro deja seguir y la señala a las 55:26 tras las protestas del Castilla y sólo se ve a la mitad de los jugadores del Alcorcón. Vídeo 60:27."
      },
      {
        "clip": "of-c12",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 58. Davo (Alcorcón) derriba por detrás a Jesús Fortea (Castilla) pegado a la banda y a la altura del área propia a las 58:35 cuando Fortea sacaba el balón conduciendo. Detrás del punto no queda ningún jugador del Alcorcón pero la cámara solo enseña a 2 y el Castilla recoge el balón junto a la banda para sacar. Vídeo 63:40."
      },
      {
        "clip": "of-c13",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 65. Ouhdadi (Alcorcón) derriba por detrás a Martínez (Castilla) a unos 14 m del medio campo en campo propio a las 65:44 y el árbitro le enseña la amarilla a las 65:47. Hudl la pone en la banda derecha pero la imagen la deja a la altura del círculo central y el balón queda parado con Naasei al lado. Vídeo 70:49."
      },
      {
        "clip": "of-c14",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 68. Choque en la banda cercana junto al medio campo (68:40-68:43) entre un jugador del Castilla y uno del Alcorcón que acaba sentado en el suelo y el juego se para a las 68:44 (Hudl: Miguel Cuesta sobre Dani Meso). Las imágenes no dejan ver con claridad quién derriba a quién ni el saque. La cámara no enseña el campo del Alcorcón ni a su portero. Vídeo 73:45."
      },
      {
        "clip": "of-c15",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": null,
        "nota": "T2, min 74. Irurita derriba a Alexis Ciria cuando conduce por la banda lejana (74:52-74:53) a unos 20 m del medio campo en campo del Alcorcón y el juego se para a las 74:54. Se ven al menos siete del Alcorcón por delante del balón pero el portero queda fuera de plano. Hudl la sitúa en el último tercio y en la imagen está en el límite entre el tercio central y el último. Vídeo 79:56."
      },
      {
        "clip": "of-c16",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": null,
        "nota": "T2, min 83. Nicola derriba a Diego Aguado junto al área del Alcorcón por la banda lejana (83:38) fuera del área a la altura de la esquina y a unos 9 m de la línea de fondo. El árbitro deja seguir un instante y a las 83:43 le enseña la amarilla. Es una falta lateral para centrar: en el instante de la falta sólo el 4 y el 5 (casi en línea) y el portero están más cerca de la línea de fondo que el balón. Vídeo 88:43."
      },
      {
        "clip": "of-c17",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 87. Tras el saque de banda de Pol Domingo junto a nuestra área (87:42) Davo carga a Mario Rivas en el salto dentro del área del Castilla hacia el lado lejano y el árbitro señala falta a favor del Castilla a las 87:46. El juego se reanuda muy rápido y no se distingue cómo se saca. La falta llega unos 6 s después de la marca de Hudl y no en la acción de +0 que pone la ficha. Vídeo 92:49."
      },
      {
        "clip": "of-c18",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "derecha",
        "distancia": "media",
        "entre": null,
        "nota": "T2, min 91. Rober Ibáñez derriba a Jesús Fortea (91:11) justo fuera del lateral del área del Alcorcón por la banda cercana a unos 9 m de la línea de fondo. Es una falta lateral para centrar: en el instante de la falta todos los del Alcorcón están a la altura del punto de penalti o más lejos y sólo el portero queda más cerca de su portería que el balón. Los del Alcorcón protestan con los brazos en alto. Vídeo 96:16."
      },
      {
        "clip": "of-c19",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "T2, min 93. Tras despejar el Alcorcón el córner de Meso (con Mestre subido) Rober Ibáñez conduce la contra y Jesús Fortea le alcanza y caen juntos en la banda lejana a unos 10 m del medio campo en campo del Alcorcón (93:50) y el árbitro pita falta del 23. El Castilla la saca rápido y en corto desde la banda (93:54-93:55). La cámara no enseña el campo del Alcorcón ni a su portero. Vídeo 98:55."
      }
    ]
  }
];
