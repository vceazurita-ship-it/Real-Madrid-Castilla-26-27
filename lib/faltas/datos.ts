/**
 * Faltas etiquetadas a mano mirando el vídeo del partido.
 *
 * ESTE FICHERO SE GENERA. No lo edites: lo escribe
 * scripts/faltas-datos.mjs a partir de los CSV de
 * Downloads/RMCF CASTILLA/ANALISIS FALTAS.
 *
 * Generado: 2026-10-04
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
      "Sale del timeline de Sportscode subido a Hudl —minuto, quién la hace, sobre quién y la tarjeta— y cada falta se ha mirado después en la retransmisión y en la cámara táctica del club, que enseña el campo entero: zona, carril, distancia, defensores y la nota salen de la imagen.",
      "Los defensores entre la falta y la portería están contados en las 28, con la cámara táctica. En las faltas laterales junto al área y en el penalti se cuentan en profundidad —los que están más cerca de su línea de fondo que el balón— y los que están a la misma altura no cuentan; por eso ahí sale 1, el portero. Esas no entran en «Faltas que cortaron algo»: son balón parado, no una transición cortada.",
      "La cámara táctica no tiene el mismo tiempo que la retransmisión (lleva cortes): cada falta se buscó en ella a mano.",
      "El campo se cuenta siempre hacia la portería que ataca quien saca la falta."
    ],
    "faltas": [
      {
        "clip": "def-c01",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "frontal",
        "entre": 10,
        "nota": "T1, min 18. Tras el centro de Fortea Joan Martínez choca en el juego aéreo con Mayorga en el vértice del área pequeña del Alcorcón y Mayorga queda en el suelo. El árbitro deja seguir (remate de Leiva y el portero se queda el balón) y luego señala falta a favor del Alcorcón. En el choque los otros 9 jugadores de campo del Castilla y su portero quedan todos entre el punto y su portería. El Alcorcón saca desde su área con el Castilla lejos. Vídeo 18:03."
      },
      {
        "clip": "def-c02",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 4,
        "nota": "T1, min 40. Segunda pasada con táctica (falta en el segundo 2381-2382 de la táctica, desfase -23 s con Hudl 40:05). Pol Fortuny derriba a Ouhdadi justo sobre la línea de medio campo pegado a la banda de los banquillos (no la de la tribuna como decía la primera pasada) y la izquierda del Alcorcón atacando. Entre: tres jugadores de campo del Castilla más Mestre por detrás del balón (Fortuny queda a la altura del punto y no se cuenta) y el resto del equipo está por encima. En los 13 s siguientes el Alcorcón aún no la ha sacado y los jugadores se juntan junto a la banda mientras el Castilla se reordena. Vídeo 40:05."
      },
      {
        "clip": "def-c03",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 9,
        "nota": "T1, min 42. Segunda pasada con táctica (falta en el segundo 2538 de la táctica, desfase -24 s con Hudl 42:42). Leiva entra a Mayorga unos 15 m dentro del campo del Alcorcón en el carril de la tribuna (derecha del Alcorcón atacando) entre banda y centro. Entre: ocho de campo del Castilla más Mestre están más cerca de su portería que el balón (uno de ellos apenas 2-3 m por detrás) y sólo Leiva y otro compañero quedan a su altura o por delante. Tras la entrada el balón sigue un momento en juego por la banda de la tribuna (la ventaja que se ve en la TV) y el saque del Alcorcón no se distingue antes de acabar el corte. Vídeo 42:42."
      },
      {
        "clip": "def-c04",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 7,
        "nota": "T2, min 45. Joan Martínez choca con Esteban Aparicio unos 5-8 m dentro del campo del Castilla en el carril de la banda de los banquillos (izquierda de la imagen y derecha del Alcorcón) y el del Alcorcón cae (táctica 3131-3132). Más cerca de la portería del Castilla que el balón quedan cuatro jugadores claramente atrasados y dos casi a la altura pero algo por detrás más el portero (7). El Castilla se reordena en bloque medio y a 3146 la falta aún no se ha sacado. Segundo de táctica 3131. Vídeo 50:59."
      },
      {
        "clip": "def-c05",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 7,
        "nota": "T2, min 50. Pitarch derriba a Irurita a unos 25-30 m de la portería del Alcorcón algo a la izquierda del eje en la imagen justo cuando el Castilla estaba en ataque (táctica 3423-3424 y el del Alcorcón queda en el suelo a 3424). Por detrás del balón seis jugadores del Castilla más el portero (7) con Pitarch a la altura del balón. Amarilla y parón y a 3436 aún no se ha sacado. Segundo de táctica 3423. Vídeo 55:49."
      },
      {
        "clip": "def-c06",
        "lado": "defensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 1,
        "nota": "T2, min 52. T2, min 52. Mano de Naasei según Hudl en la carrera del Alcorcón hacia el banderín del Castilla por la banda de la derecha de la imagen (izquierda del Alcorcón) y el balón acaba fuera junto al córner (táctica 3520-3522 y los del Alcorcón reclaman con los brazos en alto a 3522). La mano no se distingue. El árbitro marca el punto fuera del área a la altura de su línea frontal o algo más adelantado pegado a la banda. Falta lateral: en profundidad sólo el portero está más cerca de su portería que el balón (el resto del Castilla a la altura del balón o por delante y un jugador a medio metro). A 3533 aún no se ha sacado y un jugador del Castilla va a por el balón. Segundo de táctica 3520. Vídeo 57:27. Entre: 1 — contado en la táctica segundo 3522,2 con zoom (el balón rebota en Naasei hacia 3522,1-3522,3 y sale hacia el córner): Naasei está fuera del área pegado a la banda a unos 10 m de su línea de fondo y sólo el portero del Castilla está más cerca de su línea de fondo. Dudoso no contado: otro del Castilla junto a Naasei a un metro por fuera. En la TV (52:23) se ve el rebote junto a esos dos del Castilla pero no enseña al portero. Ojo: si el punto de la falta fuera la altura de la línea frontal del área como decía la primera pasada entrarían más jugadores del Castilla que están dentro del área. Vídeo 57:27."
      },
      {
        "clip": "def-c07",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 8,
        "nota": "T2, min 57. Pitarch pelea por arriba con Mayorga unos 8-10 m dentro del campo del Alcorcón y el árbitro pita con el brazo en alto (táctica 3811-3812). En la táctica no está junto a la banda sino a unos 22-25 m de la banda de los banquillos así que va al carril central en el límite con el derecho del Alcorcón (Hudl también la pone en el centro). Más atrasados que el balón siete jugadores del Castilla más el portero (8) y dos más a la misma altura. El Alcorcón coloca el balón a 3816 junto al círculo central. Segundo de táctica 3811. Vídeo 62:16."
      },
      {
        "clip": "def-c08",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 7,
        "nota": "T2, min 71. Dani Meso derriba a Mayorga en la frontal del área del Alcorcón justo encima del semicírculo y algo a la derecha del eje en la imagen tras perder el Castilla el balón en una jugada que nace de un saque de puerta del Alcorcón (táctica 4673 y el del Alcorcón queda en el suelo a 4674). Se ven los diez de campo del Castilla: seis por detrás del balón y el portero fuera de plano pero necesariamente detrás (7). A 4687 aún no se ha sacado. Segundo de táctica 4673. Vídeo 76:39."
      },
      {
        "clip": "def-c09",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 4,
        "nota": "T2, min 78. Tras la falta botada por el Castilla desde la izquierda (táctica 5034-5035) el balón queda suelto en el borde del área del Alcorcón por el lado de la banda de los banquillos y Mario Rivas se enreda con Luis Vacas justo fuera de la línea del área (táctica 5039-5040 y el del Alcorcón en el suelo a 5041). El Castilla estaba volcado: más cerca de su portería que el balón sólo tres jugadores más el portero fuera de plano (4) y otro a la misma altura. Segundo de táctica 5039. Vídeo 83:22."
      },
      {
        "clip": "of-c01",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "centro",
        "distancia": "frontal",
        "entre": 1,
        "nota": "T1, min 7. T1, min 7. Es PENALTI. Tras el cabezazo y la parada de Bañuz el balón queda suelto junto al segundo palo y en el rechace el portero del Alcorcón choca con Yáñez sobre la línea de gol a la derecha de la portería (en la táctica ambos quedan en el suelo pegados a la línea). El choque es en la propia línea así que entre el punto y la portería sólo está Bañuz (el resto del Alcorcón está a la altura del balón o por delante) y en el lanzamiento también queda él solo. El Alcorcón rodea al árbitro protestando. Hudl lo codifica como falta normal. Vídeo 7:22. Entre: 1 — contado en la táctica segundo 452,8-453,2 (el choque es hacia 453,2): Bañuz se tira a los pies de Yáñez sobre la línea de gol unos 4-5 m a la derecha del palo derecho. Sólo cuenta él. Dudoso: un jugador del Alcorcón está de pie junto a ese palo pisando la línea de gol (entre el punto y la portería de lado pero a la misma profundidad que el balón) y no se cuenta. Si se contara serían 2. Otro del Alcorcón a 1-2 m de la línea queda por delante del balón. Vídeo 7:22."
      },
      {
        "clip": "of-c02",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 11,
        "nota": "T1, min 20. Cuesta derriba a Martínez pegado a la banda derecha del Castilla (la de los banquillos) a la altura del borde de nuestra área. En la táctica todo el Alcorcón (los 10 de campo más el portero) queda por delante del balón hacia su portería. Un jugador del Castilla coloca el balón sobre la línea de banda y al acabar las imágenes aún no ha sacado con el Alcorcón replegando sin presionar. Vídeo 20:55."
      },
      {
        "clip": "of-c03",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 10,
        "nota": "T1, min 34. Segunda pasada con táctica (falta encontrada en el segundo 2072-2073 de la táctica, desfase unos -22 s con Hudl 34:54). Davo entra a Joan Martínez en nuestro campo pegado a la banda de la tribuna, a unos 25-30 m de nuestra portería y lejos del área rival. Entre: los otros nueve de campo del Alcorcón y su portero están todos más cerca de su portería que el balón (Davo queda a la altura del punto y no se cuenta). El Castilla la saca rápido y en corto por la banda izquierda y sigue tocando en su campo. Vídeo 34:54."
      },
      {
        "clip": "of-c04",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 7,
        "nota": "T1, min 35. Segunda pasada con táctica (falta en el segundo 2100 de la táctica, desfase -22 s con Hudl 35:22). Ouhdadi derriba a Fortea unos 5-8 m dentro de nuestro campo pegado a la banda de los banquillos. Entre: seis de campo del Alcorcón más su portero por delante del balón hacia su portería (8 si se cuenta a Ouhdadi, que queda a la altura del punto) y dos más quedan por detrás del balón. Fortea tarda en levantarse y el Castilla la saca en corto hacia dentro unos 6-7 s después y circula hacia el centro y la izquierda en su campo. Vídeo 35:22."
      },
      {
        "clip": "of-c05",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 8,
        "nota": "T2, min 46. Lancho entra por detrás a Pitarch pegado a la banda de la derecha del Castilla en su propio campo a unos 12-15 m del medio campo (táctica 3183). Entre el balón y la portería del Alcorcón quedan 7 de campo y el portero con el equipo replegado en bloque medio alrededor del medio campo (un 8º casi a la altura del balón y otro por detrás). El Castilla la saca rápido y corto desde la banda (3188-3189) con un pase hacia dentro y conduce hacia el centro sin presión. Vídeo 51:49."
      },
      {
        "clip": "of-c06",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 10,
        "nota": "T2, min 48. Tras el saque de banda de Irurita Davo y Pitarch caen juntos pegados a la banda izquierda del Castilla a la altura del borde de su área (táctica 3319). Todo el Alcorcón salvo Davo queda por delante del balón hacia su portería: 8 de campo en plano más uno por encima del medio campo (se ve a los 10 a 3324) y el portero fuera de plano arriba. El Castilla la saca corto desde la banda (3324-3325) y conduce hacia dentro y hacia atrás mientras el Alcorcón repliega hacia el medio campo. Vídeo 54:06."
      },
      {
        "clip": "of-c07",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 9,
        "nota": "T2, min 49. Ouhdadi derriba por detrás a Yáñez cuando conduce tras el robo por el carril derecho del Castilla a unos 20 m del medio campo y unos 15 m del borde de su área (táctica 3368). Por delante del balón quedan 8 del Alcorcón y su portero (fuera de plano arriba) con Ouhdadi encima del balón y otro por detrás. Un jugador del Alcorcón aleja el balón hacia la portería del Castilla (3370) y Mestre lo recoge y reanuda él desde su área con un envío largo hacia la izquierda (3378-3379) con el Alcorcón ya adelantado hasta el medio campo. Vídeo 54:53."
      },
      {
        "clip": "of-c08",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 8,
        "nota": "T2, min 50. Davo derriba a Fortea cuando conduce por el carril derecho del Castilla a unos 18-20 m del medio campo con el 11 del Alcorcón también encima (táctica 3392). Por delante del balón quedan 7 de campo del Alcorcón y su portero y además Davo y el otro presionador pegados al balón (no contados) con uno solo por detrás. El balón rueda hacia atrás y se coloca un poco más abajo (3395) y el Castilla la saca corto hacia dentro (3396) para que el central conduzca ante un Alcorcón en bloque medio. Vídeo 55:17."
      },
      {
        "clip": "of-c09",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 5,
        "nota": "T2, min 53. Pablo Rivera derriba a Álvaro Leiva junto a la banda de los banquillos (izquierda del Castilla) a unos 12 m del medio campo en campo propio tras el saque de puerta (táctica 3590-3591). El Alcorcón estaba presionando arriba con 5 jugadores por detrás del balón así que entre el punto y su portería solo quedan 4 de campo y el portero. El Castilla la juega rápido y corto hacia atrás pegado a la banda (3593-3595) y sale conduciendo hacia dentro. Vídeo 58:35."
      },
      {
        "clip": "of-c10",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 9,
        "nota": "T2, min 54. Miguel Berlanga (Alcorcón) llega tarde al balón dividido y derriba a Joan Martínez (Castilla) a unos 12 m del medio campo en campo propio y cerca de la banda de los banquillos. Por delante del punto hacia la portería del Alcorcón quedan su portero y 8 de campo (uno más casi a la altura del balón). El Castilla recoge el balón y saca rápido a los 16 s con un pase horizontal hacia el centro. Táctica 3656 (falta) y 3672 (saque). Vídeo 59:41."
      },
      {
        "clip": "of-c11",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 5,
        "nota": "T2, min 55. Mano de Miguel Cuesta (Alcorcón) al controlar el centro de Berlanga justo fuera de la esquina derecha del área del Castilla. El árbitro deja seguir y la pita después con las protestas del Castilla. En el instante sólo el portero y 4 del Alcorcón están más cerca de su portería que el balón y otro queda a la misma altura. El Castilla la saca desde el pico del área con un pase corto. Táctica 3702 (mano) y ~3715 (saque). Vídeo 60:27."
      },
      {
        "clip": "of-c12",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 10,
        "nota": "T2, min 58. Davo (Alcorcón) derriba por detrás a Jesús Fortea (Castilla) pegado a la banda derecha a la altura del borde del área propia cuando salía conduciendo. Todo el Alcorcón salvo el propio Davo queda entre el punto y su portería (portero y 9 de campo). El Castilla saca en corto hacia atrás y dentro y abre luego hacia el centro. Táctica 3895 (falta) y ~3904 (saque). Vídeo 63:40."
      },
      {
        "clip": "of-c13",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 8,
        "nota": "T2, min 65. Ouhdadi (Alcorcón) choca y derriba a Martínez (Castilla) cuando conducía a unos 12 m del medio campo en campo propio algo a la derecha del círculo central. El Alcorcón se queda la pelota un segundo y el árbitro pita y saca la amarilla. Por delante del punto el portero y 7 de campo (uno más casi a la altura). El balón se coloca con Naasei al lado y a los 13 s aún no se ha sacado. Táctica 4324 (falta). Vídeo 70:49."
      },
      {
        "clip": "of-c14",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 4,
        "nota": "T2, min 68. Miguel Cuesta (Alcorcón) entra en plancha a Dani Meso (Castilla) pegado a la banda derecha unos 2 m dentro del campo del Alcorcón y acaba sentado en el suelo. Entre el punto y su portería sólo el portero y 3 de campo y otros 4 casi en línea con el balón. El Castilla saca rápido en corto hacia dentro y el receptor queda rodeado de rivales con el balón suelto hacia la izquierda. Táctica 4500 (falta) y ~4510 (saque). Vídeo 73:45."
      },
      {
        "clip": "of-c15",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 10,
        "nota": "T2, min 74. Irurita entra a Alexis Ciria cuando conduce pegado a la banda izquierda del Castilla unos 20 m pasado el medio campo y el balón queda suelto hacia atrás y hacia la banda (táctica 4871-4872 y a 4873 rueda suelto). Por delante del balón quedan los otros 9 de campo del Alcorcón y su portero (uno casi a la altura del balón) con el equipo replegado entre su área y la media luna. El Castilla la saca rápido y a 4879 ya hay juego dentro del área del Alcorcón pero el cambio de plano de la cámara no deja ver cómo se sacó. Desfase aquí +67/+68 (no +71). Vídeo 79:56."
      },
      {
        "clip": "of-c16",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 1,
        "nota": "T2, min 83. T2, min 83. Nicola derriba a Diego Aguado fuera del área por la banda izquierda del Castilla a la altura de la esquina del área y a unos 9-11 m de la línea de fondo (táctica 5361-5362 y a 5362 ya está en el suelo). Es una falta lateral para centrar: más cerca de la línea de fondo que el balón sólo hay dos de campo del Alcorcón y el portero y otro está casi en línea con el balón. El árbitro deja seguir un instante y la jugada se para con amarilla y a 5375 aún no se ha sacado. Vídeo 88:43. Entre: 1 — contado en la táctica segundo 5361,7 (el contacto) con zoom a 5361,5 y 5361,9: el contacto es fuera del área casi a la altura de la línea frontal del área (unos 15-16 m de la línea de fondo) y Aguado cae resbalando hasta unos 10-11 m. En ese instante sólo el portero está claramente más cerca de su línea de fondo. Dudosos no contados: un jugador del Alcorcón dentro del área apenas medio metro más adentro que el balón y que a 5361,9 ya está en línea con él y otro a la misma altura más al centro. Contado desde donde cae Aguado (5362) saldrían 3 como decía la primera pasada. Vídeo 88:43."
      },
      {
        "clip": "of-c17",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 10,
        "nota": "T2, min 87. Tras el saque de banda de Pol Domingo por la izquierda del Castilla (táctica 5606-5607) Davo carga a Mario Rivas en el salto dentro del área del Castilla unos 5-10 m a la izquierda del eje de la portería (táctica 5608-5609). Todo el Alcorcón salvo Davo queda más cerca de su portería que el punto de la falta (9 de campo y el portero). El balón de la falta se coloca dentro del área y el portero Mestre la saca en corto hacia el central de la izquierda (5617-5618) con el Alcorcón ya replegando. Vídeo 92:49."
      },
      {
        "clip": "of-c18",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "derecha",
        "distancia": "media",
        "entre": 1,
        "nota": "T2, min 91. T2, min 91. Rober Ibáñez derriba a Jesús Fortea justo fuera del lateral derecho del área del Alcorcón a unos 8-9 m de la línea de fondo (táctica 5815). Es una falta lateral para centrar: sólo el portero está claramente más cerca de su portería que el balón y dos del Alcorcón quedan más o menos a la misma altura del balón (no contados). Casi a la vez caen un jugador de cada equipo dentro del área y los del Alcorcón protestan con los brazos en alto alrededor del árbitro y a 5828 aún no se ha sacado. Vídeo 96:16. Entre: 1 — contado en la táctica segundo 5815,0-5815,2 con zoom: la entrada es fuera del área a unos 10-11 m de la línea de fondo y sólo el portero está más cerca de su línea de fondo que el balón. Dudosos no contados: dos del Alcorcón dentro del área a 1-1,5 m por fuera de la altura del balón. Vídeo 96:16."
      },
      {
        "clip": "of-c19",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 10,
        "nota": "T2, min 93. Tras despejar el Alcorcón el córner de Meso (con Mestre subido) Rober Ibáñez conduce la contra y Jesús Fortea le alcanza y caen juntos por la banda izquierda del Castilla unos 15 m pasado el medio campo en campo del Alcorcón (táctica 5973-5974). La jugada va a revisión de Video Support (acaba en no roja) y la falta no se saca hasta unos 85 s después: Pitarch la cuelga desde Z4 a la espalda de la línea y Rachad remata forzado ante el portero (táctica 6058-6059). Todo el Alcorcón salvo el que la comete queda por delante del balón en el instante de la falta. Vídeo 98:55."
      }
    ]
  },
  {
    "jornada": "LIGA 06",
    "rival": "Atlético Madrileño",
    "local": true,
    "fecha": "2026-10-02",
    "resultado": "3-2",
    "clips": "Hudl · Castilla · «2026-10-02 Real Madrid Castilla - Atlético Madrid B 3 - 2» (timeline de Sportscode) y la cámara táctica J 06 -CASTILLA - ATL. MADRILEÑO.mov",
    "notas": [
      "Sale del timeline de Sportscode subido a Hudl —minuto, quién la hace, sobre quién y la tarjeta— y cada falta se mira después en la retransmisión y en la cámara táctica del club: zona, carril, distancia, defensores y la nota salen de la imagen.",
      "El campo se cuenta siempre hacia la portería que ataca quien saca la falta."
    ],
    "id": "j06-atletico-madrileno",
    "faltas": [
      {
        "clip": "def-c01",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 11,
        "nota": "Tras el córner de Aguado (11:26), Martínez (16) comete falta en ataque sobre Miguel Cubo dentro del área pequeña del Atlético (11:29). La saca el portero del Atlético desde su área y el Castilla repliega (los 11 contados en la táctica al preparar el saque, s 745)."
      },
      {
        "clip": "def-c02",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 4,
        "nota": "Óscar (21) derriba a Miguel Cubo junto a la banda izquierda del Atlético, en su campo cerca de la línea media (13:39 TV). Cordero saca en corto y el Atlético la juega hacia atrás hasta su portero (abp-def-01)."
      },
      {
        "clip": "def-c03",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 4,
        "nota": "Fortea (2) hace falta sobre Miguel Cubo en la misma línea de medio campo pegado a la banda izquierda del Atlético y ve amarilla (14:14 TV). Cubo se queda en el suelo y el saque no aparece en las imágenes."
      },
      {
        "clip": "def-c04",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 8,
        "nota": "Yáñez (7) derriba a Edgar Alcañiz en campo del Atlético, por el carril izquierdo a unos 12 m de la línea media (30:59 TV). Alcañiz saca en corto y el Atlético circula en su campo (abp-def-03)."
      },
      {
        "clip": "def-c05",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 10,
        "nota": "Cestero (6) derriba por detrás a David Hidalgo unos 10 m por fuera del área del Atlético, algo escorado al lado lejano de la TV (37:00 TV). Hidalgo la saca rápido en corto (37:03) y el Atlético la juega atrás hacia su portero. Entre: los 10 de campo del Castilla menos Cestero, que queda a la altura del balón, más el portero (contado en TV y táctica, en la táctica se distinguen mal los colores)."
      },
      {
        "clip": "def-c06",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "Tras el disparo de Pitarch que para Astralaga (42:27), Pitarch (24) presiona y derriba a Miguel Cubo junto al banderín de córner del Atlético, en el lado lejano de la TV (42:31). El saque no sale en las imágenes (Hudl: lo saca Pan Pablo unos 20 s después). La táctica muestra otra jugada, así que no se puede contar entre (casi todo el Castilla queda por detrás del balón)."
      },
      {
        "clip": "def-c07",
        "lado": "defensivo",
        "zona": "campo rival",
        "carril": "derecha",
        "distancia": "media",
        "entre": null,
        "nota": "En el descuento de la 1a parte (49:21 TV), Helguera cae junto a la banda cercana a unos 30 m de la portería del Castilla en el duelo con Aguado (3) tras la pared con Kamate. Hudl apunta la falta a Cestero (6) por su entrada a Helguera en el círculo central (49:16), con ventaja. Miguel Cubo la saca en corto hacia atrás (abp-def-04) y el Atlético circula. En la táctica la banda queda fuera de plano, así que no se cuentan todos."
      },
      {
        "clip": "def-c08",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 6,
        "nota": "Óscar (21) derriba por detrás a Cordero (17) junto a la banda izquierda del Atlético, unos 15-20 m dentro de su campo (TV 50:35, min 51). Alcañiz (20) la saca en corto hacia atrás a Pan Pablo y el Atlético reinicia desde el portero. Entre contado en la táctica 3497 (la falta cae 1-2 s después del último fotograma, seg estimado): Óscar, 4 jugadores más y Mestre."
      },
      {
        "clip": "def-c09",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": null,
        "nota": "David Hidalgo (15) conduce junto al círculo central, ya en campo del Atlético, supera la entrada de un primer defensor (Martínez según Hudl) y cae en el choque con Pitarch (24) (TV 52:45, min 53). Hidalgo la saca rápido en corto y el Atlético sigue la posesión hacia su izquierda. La falta no sale en la ventana de la táctica (cae después), no se puede contar entre."
      },
      {
        "clip": "def-c10",
        "lado": "defensivo",
        "zona": "campo rival",
        "carril": "derecha",
        "distancia": "frontal",
        "entre": null,
        "nota": "PENALTI: Cordero filtra para Miguel Cubo (10), que entra en el área por el lado derecho del ataque del Atlético y cae ante Aguado (3) (TV 62:39, min 63), el árbitro señala el punto a las 62:43. La táctica arranca con la jugada ya parada (protestas en el área), no se ve el instante de la falta ni se puede contar entre. El penalti se lanza minutos después (abp-def-07)."
      },
      {
        "clip": "def-c11",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 7,
        "nota": "Cestero (6) derriba a Sergio Diez junto a la banda derecha del ataque del Atlético, unos metros dentro del campo del Castilla (67:31 TV). Jorge Castillo la saca en corto hacia Cordero, que lanza en largo (abp-def-08)."
      },
      {
        "clip": "def-c12",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 11,
        "nota": "Martínez (16) derriba a Jorge Castillo en el centro, junto al círculo central en campo del Castilla, y ve amarilla (la falta no sale en las imágenes: sólo la repetición y la preparación, 73:35-73:52 TV). Jorge Castillo la saca en corto hacia atrás a David Hidalgo (74:12 TV) y el Atlético circula (abp-def-09). Los 11 del Castilla contados en la táctica en el saque (s 4843)."
      },
      {
        "clip": "def-c13",
        "lado": "defensivo",
        "zona": "campo rival",
        "carril": "derecha",
        "distancia": "media",
        "entre": 11,
        "nota": "Pitarch (24) derriba a Romeo Hueso pegado a la banda derecha del ataque del Atlético, a unos 30 m de la portería del Castilla (74:27 TV). Arnau Solà la bota al área (75:09 TV) y Mestre la atrapa a la altura del penalti (abp-def-10). Los 11 del Castilla, contados en la táctica en el saque (s 4898), están por delante del balón."
      },
      {
        "clip": "def-c14",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 9,
        "nota": "Carvajal (19) comete falta sobre Pan Pablo en un balón dividido en campo del Atlético, por su carril izquierdo a unos 30 m de su portería, con el Castilla atacando tras un saque de puerta de Mestre (77:14 TV). Pan Pablo la saca en corto a David Hidalgo y el Atlético sale jugando (abp-def-11)."
      },
      {
        "clip": "def-c15",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 8,
        "nota": "Pitarch (24) derriba a Koke en el círculo central, a un par de metros dentro del campo del Castilla, y ve amarilla (84:47-84:48 TV). Jorge Castillo la saca en corto a David Hidalgo (85:35 TV) y el Atlético sigue jugando (abp-def-12). Táctica: alt (la principal muestra otra acción). Entre: 7 de campo más Mestre."
      },
      {
        "clip": "def-c16",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 9,
        "nota": "Ciria derriba a Yaakobishvili junto a la banda derecha del ataque del Atlético, unos 10-15 m dentro del campo del Atlético, y ve amarilla (86:05 TV). Yaakobishvili la saca hacia atrás a su portero Astralaga (86:47 TV) y el Atlético reinicia (abp-def-13). Táctica: alt (la principal muestra otra acción). Entre: 8 de campo más Mestre."
      },
      {
        "clip": "def-c17",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 9,
        "nota": "Cestero comete falta sobre Miguel Cubo en la banda derecha del ataque del Atlético, justo dentro del campo del Castilla junto a la línea media (92:43-92:46 TV, con ventaja breve). El Atlético la saca en corto a las 92:59: Romeo Hueso se la da a Jorge Castillo, que vuelve hacia su campo para seguir jugando. Táctica: alt (la principal muestra la falta de la c14). Entre contados en el saque (5969), donde se ve al portero: 8 de campo más el portero. En el instante de la falta (5955) eran 6 de campo y el portero fuera de cuadro."
      },
      {
        "clip": "of-c01",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 7,
        "nota": "Min 8 (07:08 TV): Kamate (21) derriba a Cestero junto a la banda lejana unos metros pasado el medio campo en campo del Atlético. Se saca en corto y rápido (Fortea-Cestero) y el Castilla sigue jugando por fuera hasta Yáñez."
      },
      {
        "clip": "of-c02",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 3,
        "nota": "Min 10 (09:50 TV): Arnau Solà (22) hace falta a Yáñez pegado a la banda derecha unos 10 m dentro del campo propio del Castilla. Fortea la saca rápida en corto hacia atrás (Óscar-Mestre) y el Castilla reinicia la salida. Entre aproximado: un rojiblanco casi a la altura del balón."
      },
      {
        "clip": "of-c03",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 5,
        "nota": "Min 13 (12:08 TV): Edgar Alcañiz (20) derriba a Leiva unos 8 m fuera del área, escorado a la izquierda (a la altura del lateral del área). Aguado la tira directa a los 12:56 y la barrera de 4 la bloquea, el rechace lo recoge Pitarch y no hay ocasión."
      },
      {
        "clip": "of-c04",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "Tras un córner del Atlético, Hidalgo (15) derriba a Pitarch (24) cuando el Castilla salía a la contra a unos 35-40 m de su portería, carril izquierdo (TV 19:50), y ve amarilla. En la táctica no se ve la mitad del Atlético (faltan su portero y algún zaguero), a ojo unos 5 entre balón y portería."
      },
      {
        "clip": "of-c05",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 10,
        "nota": "Sergio Diez (2) cae sobre Aguado (3) junto al banderín de córner del Castilla, lado izquierdo, al disputar un balón largo del Atlético (TV 22:50). La saca en largo el portero del Castilla desde junto a su línea de fondo, con todo el Atlético salvo Diez por delante del balón."
      },
      {
        "clip": "of-c06",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 10,
        "nota": "Helguera (16) derriba a Pitarch (24) junto al círculo central, en campo del Castilla (TV 27:04-27:05). Mario la saca en corto unos 20 s después (abp-of-04) y el Castilla sigue jugando. Entre contado en la táctica en el saque (seg 1691), con el Atlético entero por delante."
      },
      {
        "clip": "of-c07",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "Helguera (16) derriba a Cestero (6) hacia el 33:10 cuando este conducía reculando hacia su campo, unos 10 m dentro del campo del Castilla por el carril izquierdo. La saca Naasei en corto para seguir jugando mientras la TV emite repeticiones. La táctica no muestra la jugada (desincronizada), entre sin contar."
      },
      {
        "clip": "of-c08",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": null,
        "nota": "Sergio Diez (2), con Alcañiz (20) encima, frena a Pitarch (24) en conducción hacia el 33:42, unos 8-10 m dentro del campo del Atlético por el carril izquierdo, el árbitro da ventaja y luego vuelve a la falta. Aguado la saca en corto atrás a Pitarch (33:55) y el Castilla mantiene la posesión. La táctica no muestra la jugada."
      },
      {
        "clip": "of-c09",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": null,
        "nota": "Tras un saque de banda de Yáñez, Helguera (16) derriba a Fortea (2) pegado a la banda derecha frente a los banquillos, unos 10 m dentro del campo del Atlético (40:36). Fortea la saca en corto hacia Pitarch (41:08) y el Castilla circula atrás. La táctica no muestra la jugada."
      },
      {
        "clip": "of-c10",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 11,
        "nota": "Tras una llegada del Atlético al área del Castilla en el añadido de la 1ª parte, Kamate (21) derriba a Aguado (3) en la carrera por el balón junto al banderín de córner izquierdo del Castilla (48:40). Con el balón en su propia línea de fondo, los 11 del Atlético quedan entre el balón y su portería (deducido, la táctica no muestra la jugada)."
      },
      {
        "clip": "of-c11",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 7,
        "nota": "Alcañiz (20) derriba a Cestero (6) en el carril izquierdo, unos metros dentro del campo del Castilla junto a la línea de medio campo (TV 53:43), y ve amarilla. Cestero se queda en el suelo y el Castilla la saca en corto y sigue la jugada (seg 3679 de la táctica, no se ve quién la saca). Entre contado en el instante de la falta (seg 3660, Cestero ya en el suelo): 6 del Atlético más el portero por delante del balón, con Alcañiz a la altura de la falta (en el saque ya estaban los 11 por delante). Táctica: re-corte."
      },
      {
        "clip": "of-c12",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "frontal",
        "entre": null,
        "nota": "Kamate (21) derriba a Aguado (3) dentro del área, en su lado izquierdo, después de que Aguado recibiera el pase de Leiva (TV 54:44-54:45), y el árbitro pita penalti. Lo lanza el propio Aguado mucho después, a los 60:42 de la TV, y marca el 2-1 (abp-of-08). La táctica empieza ya con los jugadores protestando en el área, así que no se puede contar el entre. El re-corte empieza en el seg 3721 con Aguado ya en el suelo dentro del área y los del Castilla pidiendo penalti, un instante después de la falta. Táctica: tampoco se ve."
      },
      {
        "clip": "of-c13",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 9,
        "nota": "Jorge Castillo (8) derriba a Fortuny tras la recuperación de Mario, en el centro a unos 30 m de la portería del Castilla (82:18-82:19 TV). El Castilla la saca en corto y reinicia desde atrás (Mestre recibe en el área en la táctica). Entre contados en la táctica (principal, única) en el instante de la falta: 8 de campo más el portero."
      },
      {
        "clip": "of-c14",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 11,
        "nota": "Cuellar Pérez (38) derriba a Cestero junto al círculo central, recién pasada la línea media (91:01 TV). El árbitro da ventaja, para el juego a las 91:06 y le enseña amarilla. Cestero la saca en largo a las 91:34 hacia la banda izquierda y Romeo Hueso la despeja de cabeza a banda. Táctica: alt (la principal muestra otra jugada). La falta cae justo antes del primer fotograma (5852, Cestero ya en el suelo). Entre contados en el saque (5884): los 10 de campo y el portero, todos por delante del balón."
      },
      {
        "clip": "of-c15",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 7,
        "nota": "Arnau Solà (22) derriba a Fortuny cuando este sale conduciendo por la derecha, a unos 25-30 m de la portería del Castilla (98:26 TV), tras robar el balón al borde del área. Táctica: principal (la alt no muestra la falta). Entre contados en el instante de la falta: 6 de campo más el portero. Uno más está a la altura del balón y no lo cuento."
      }
    ]
  }
];
