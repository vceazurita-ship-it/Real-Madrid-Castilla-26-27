/**
 * Faltas etiquetadas a mano sobre los clips del coding.
 *
 * ESTE FICHERO SE GENERA. No lo edites: lo escribe
 * scripts/faltas-datos.mjs a partir de los CSV de
 * Downloads/RMCF CASTILLA/ANALISIS FALTAS.
 *
 * Generado: 2026-09-25
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
      "Partido fuera: el Castilla juega de blanco y el Sant Andreu de amarillo. Nuestro portero, de azul; el suyo, de verde.",
      "Los clips no traen marcador ni reloj, así que las faltas no llevan minuto: van en el orden en que las cortó el coding."
    ],
    "faltas": [
      {
        "clip": "def-c01",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 8,
        "nota": "falta del Castilla al cortar la salida amarilla junto a la banda, sacan en corto y sigue el juego"
      },
      {
        "clip": "def-c02",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 6,
        "nota": "entrada del Castilla en el circulo central, el amarillo queda en el suelo y el saque en largo acaba con el balon en nuestra area"
      },
      {
        "clip": "def-c03",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "media",
        "entre": 2,
        "nota": "falta del Castilla que corta la salida rapida amarilla con la defensa muy abierta, el saque llega al area y se despeja"
      },
      {
        "clip": "def-c04",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 6,
        "nota": "falta del Castilla sobre el amarillo en el medio campo por su carril derecho, sacan en corto hacia la banda y sigue el juego"
      },
      {
        "clip": "def-c05",
        "lado": "defensivo",
        "zona": "campo propio",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 9,
        "nota": "falta de un blanco sobre un amarillo junto a la banda cerca del area del Sant Andreu saque en largo y sigue el juego sin peligro"
      },
      {
        "clip": "def-c06",
        "lado": "defensivo",
        "zona": "campo rival",
        "carril": "centro",
        "distancia": "frontal",
        "entre": 5,
        "nota": "derriban al amarillo en la frontal del area tras una contra y el clip acaba con la barrera colocandose"
      },
      {
        "clip": "def-c07",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 5,
        "nota": "falta sobre un amarillo pegado a la banda pasado el medio campo el jugador queda tendido y hay parada larga por asistencia"
      },
      {
        "clip": "def-c08",
        "lado": "defensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 5,
        "nota": "derriban al amarillo a unos 25 metros por su carril izquierdo saque muy retrasado que se cuelga al area y acaba en barullo delante del portero"
      },
      {
        "clip": "def-c09",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 8,
        "nota": "falta del Castilla sobre el que sacaba el balon junto a la banda, saque en largo al area y despeje"
      },
      {
        "clip": "def-c10",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 9,
        "nota": "falta junto al circulo central, parada muy larga con cambios y saque en largo al area del Castilla"
      },
      {
        "clip": "def-c11",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 4,
        "nota": "falta en el circulo central con el Castilla muy adelantado, parada larga por asistencia y saque en corto"
      },
      {
        "clip": "def-c12",
        "lado": "defensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 5,
        "nota": "falta en su banda derecha con el Castilla presionando arriba, parada larga y saque en corto"
      },
      {
        "clip": "of-c01",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 10,
        "nota": "falta del rival sobre el jugador blanco al borde del area propia y el saque va en largo por banda hasta el medio campo"
      },
      {
        "clip": "of-c02",
        "lado": "ofensivo",
        "zona": "campo propio",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 9,
        "nota": "dos rivales agarran al jugador blanco en la salida de balon y el saque se juega en corto para seguir jugando"
      },
      {
        "clip": "of-c03",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "centro",
        "distancia": "lejana",
        "entre": 10,
        "nota": "cortan al conductor blanco dentro del circulo central y el balon queda parado en la linea de medio campo"
      },
      {
        "clip": "of-c04",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "lejana",
        "entre": 10,
        "nota": "choque con el rival en la banda izquierda justo en la linea de medio campo y el saque se juega en corto hacia dentro"
      },
      {
        "clip": "of-c05",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 10,
        "nota": "falta sobre el jugador blanco en la linea de medio campo por la izquierda se saca en corto hacia atras y el Castilla reinicia la posesion sin peligro"
      },
      {
        "clip": "of-c06",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "media",
        "entre": 8,
        "nota": "falta pegada a la banda derecha ya en campo del Sant Andreu el blanco queda en el suelo se saca en corto y el Castilla sigue atacando por ese lado"
      },
      {
        "clip": "of-c07",
        "lado": "ofensivo",
        "zona": "medio campo",
        "carril": "derecha",
        "distancia": "lejana",
        "entre": 11,
        "nota": "entrada sobre el conductor justo por detras de la linea de medio campo en campo propio con todo el Sant Andreu por detras del balon y el clip acaba con el balon ya colocado"
      },
      {
        "clip": "of-c08",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "derecha",
        "distancia": "frontal",
        "entre": 2,
        "nota": "tras una parada larga el Castilla gana la espalda por la derecha y derriban al blanco junto al vertice del area con solo el portero y el defensa que entra por detras del balon"
      },
      {
        "clip": "of-c09",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "derecha",
        "distancia": "media",
        "entre": 6,
        "nota": "falta sobre el atacante junto a la linea de fondo y el centro posterior lo atrapa el portero en el area pequena"
      },
      {
        "clip": "of-c10",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "izquierda",
        "distancia": "media",
        "entre": 9,
        "nota": "entrada sobre el atacante en la esquina del area y el centro posterior lo despeja la defensa local con bloque muy replegado"
      },
      {
        "clip": "of-c11",
        "lado": "ofensivo",
        "zona": "campo rival",
        "carril": "centro",
        "distancia": "frontal",
        "entre": 2,
        "nota": "agarron lejos del balon dentro del area con el atacante dolorido y solo el portero y su par por delante, el clip acaba antes del lanzamiento"
      }
    ]
  }
];
