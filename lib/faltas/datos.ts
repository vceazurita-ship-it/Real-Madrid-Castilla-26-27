/**
 * Faltas etiquetadas a mano mirando el vídeo del partido.
 *
 * ESTE FICHERO SE GENERA. No lo edites: lo escribe
 * scripts/faltas-datos.mjs a partir de los CSV de
 * Downloads/RMCF CASTILLA/ANALISIS FALTAS.
 *
 * Generado: 2026-09-26
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
  }
];
