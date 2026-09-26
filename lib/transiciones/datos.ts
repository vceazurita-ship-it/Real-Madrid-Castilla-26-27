/**
 * Robos y transiciones etiquetados a mano sobre el vídeo.
 *
 * ESTE FICHERO SE GENERA. No lo edites: lo escribe
 * scripts/transiciones-datos.mjs a partir de los CSV de
 * Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES.
 *
 * Generado: 2026-09-26
 */

export type Accion = "ADELANTE" | "HORIZONTAL_ATRAS" | "DESPEJE" | "PERDIDA";
export type Confianza = "alta" | "media" | "baja";

export type Robo = {
  /** Segundo del vídeo en que el balón pasa a ser nuestro. */
  seg: number;
  zona: string;
  carril: string;
  accion: Accion;
  /** Cómo acaba la posesión que nace del robo. Vacío en los bloques viejos. */
  desenlace: string;
  duracion: number | null;
  pases: string;
  detalle: string;
  confianza: Confianza;
  bloque: string;
};

export type Gol = { seg: number; de: "castilla" | "rival"; texto: string };

export type PartidoTransiciones = {
  id: string;
  jornada: string;
  rival: string;
  local: boolean;
  fecha: string;
  resultado: string;
  /** Dónde está el vídeo, para poder volver a él y para el panel de actualizar. */
  video: string;
  segundosVideo: number;
  bloquesTotales: number;
  bloquesCerrados: number;
  /** Segundos de vídeo mirados de verdad, contando los bloques a medias. */
  segundosRevisados: number;
  notas: string[];
  goles: Gol[];
  robos: Robo[];
};

export const PARTIDOS: PartidoTransiciones[] = [
  {
    "id": "torremolinos",
    "jornada": "J2",
    "rival": "Juventud Torremolinos",
    "local": true,
    "fecha": "2026-09-05",
    "resultado": "",
    "video": "",
    "segundosVideo": 6060,
    "bloquesTotales": 20,
    "notas": [
      "El vídeo arranca en el saque inicial y su reloj va casi a la par del reloj del partido.",
      "El juego se detiene en el 28'31\" por una lesión y ya no se reanuda: enlaza con la pausa de hidratación, campo vacío y aspersores, hasta el 31'30\".",
      "El Castilla ataca hacia arriba de la imagen en las dos partes.",
      "La 1ª parte acaba en el minuto 50:31 del vídeo (45+6, con el marcador 1-0) y el descanso está cortado: el vídeo salta en el 50:38 y la 2ª parte arranca en el 50:41. A partir de ahí el minuto del vídeo va unos 5:40 por delante del reloj del partido."
    ],
    "goles": [
      {
        "seg": 1555,
        "de": "castilla",
        "texto": "Gol del Castilla, concedido tras una revisión de la jugada"
      },
      {
        "seg": 5343,
        "de": "castilla",
        "texto": "Gol del Castilla, nacido del robo del 88'53\""
      }
    ],
    "bloquesCerrados": 20,
    "segundosRevisados": 6060,
    "robos": [
      {
        "seg": 24,
        "zona": "campo propio",
        "carril": "",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "",
        "duracion": null,
        "pases": "",
        "detalle": "duelo en banda izquierda propia: le quita el balon al rival y conduce en diagonal hacia la banda",
        "confianza": "media",
        "bloque": "b00000"
      },
      {
        "seg": 83,
        "zona": "medio campo",
        "carril": "",
        "accion": "DESPEJE",
        "desenlace": "",
        "duracion": null,
        "pases": "",
        "detalle": "entrada a ras de suelo cerca del circulo central: saca el balon lejos y sale por la banda",
        "confianza": "baja",
        "bloque": "b00000"
      },
      {
        "seg": 114,
        "zona": "medio campo",
        "carril": "",
        "accion": "ADELANTE",
        "desenlace": "",
        "duracion": null,
        "pases": "",
        "detalle": "roba en el duelo junto a la linea de medio campo y conduce hacia arriba entrando en campo rival",
        "confianza": "alta",
        "bloque": "b00000"
      },
      {
        "seg": 211,
        "zona": "campo propio",
        "carril": "",
        "accion": "ADELANTE",
        "desenlace": "",
        "duracion": null,
        "pases": "",
        "detalle": "corta un pase corto del rival y dos segundos despues el balon avanza en diagonal",
        "confianza": "media",
        "bloque": "b00000"
      },
      {
        "seg": 263,
        "zona": "campo rival",
        "carril": "",
        "accion": "ADELANTE",
        "desenlace": "",
        "duracion": null,
        "pases": "",
        "detalle": "presion alta sobre el lateral rival en su ultimo tercio: le gana el balon y conduce hasta el vertice del area",
        "confianza": "media",
        "bloque": "b00000"
      },
      {
        "seg": 431,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "AREA",
        "duracion": 12,
        "pases": "4",
        "detalle": "presiona al conductor rival junto a la linea de medio campo por la izquierda, le gana el balon y conduce hacia arriba, la jugada progresa hasta meter el balon en el area rival donde se queda el portero",
        "confianza": "media",
        "bloque": "b00300"
      },
      {
        "seg": 480,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "PERDIDA",
        "duracion": 5,
        "pases": "1",
        "detalle": "balon suelto en la salida corta del rival con un jugador del Castilla encima, lo gana el Castilla en la banda izquierda del campo rival pero el balon va hacia la linea y el rival lo recupera enseguida",
        "confianza": "baja",
        "bloque": "b00300"
      },
      {
        "seg": 995,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "AREA",
        "duracion": 11,
        "pases": "4",
        "detalle": "duelo en la banda izquierda junto al circulo central, el rival pierde el control y un jugador del Castilla sale conduciendo, la jugada muere con el balon dentro del area rival y el portero achicando a los pies",
        "confianza": "media",
        "bloque": "b00900"
      },
      {
        "seg": 1386,
        "zona": "campo propio",
        "carril": "",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "",
        "duracion": null,
        "pases": "",
        "detalle": "banda derecha, cerca del area propia: un jugador del Torremolinos conduce por la linea y nuestro lateral le aguanta el duelo, el balon se escapa del jugador del Torremolinos y nuestro jugador llega antes — conduce hacia dentro y la cede al portero naranja, que la recoge en el area",
        "confianza": "media",
        "bloque": "b01200"
      },
      {
        "seg": 1645,
        "zona": "campo rival",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "REMATE",
        "duracion": 2,
        "pases": "0",
        "detalle": "presion encima del central en la frontal del area, le quita el balon y encara, el portero verde sale a los pies y bloca el remate dentro del area pequena",
        "confianza": "media",
        "bloque": "b01500"
      },
      {
        "seg": 1665,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "FUERA",
        "duracion": 6,
        "pases": "?",
        "detalle": "el Torremolinos saca el balon desde su area por su banda izquierda y nuestro jugador se lo roba en carrera junto a la linea, siguen duelos en la banda y el balon acaba saliendo por el lateral",
        "confianza": "media",
        "bloque": "b01500"
      },
      {
        "seg": 2092,
        "zona": "medio campo",
        "carril": "",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "",
        "duracion": null,
        "pases": "",
        "detalle": "disputa en la banda derecha junto a la linea de medio campo: el balon esta en un jugador del Torremolinos (2088), dos jugadores del Castilla le entran al suelo (2090-2091) y el balon queda para el Castilla, que lo saca hacia dentro y hacia atras",
        "confianza": "baja",
        "bloque": "b01800"
      },
      {
        "seg": 2232,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "AREA",
        "duracion": 7,
        "pases": "1",
        "detalle": "dos jugadores del Castilla aprietan al jugador del Torremolinos que conducia por su banda derecha pasado el medio campo y el balon queda para el Castilla, que conduce en diagonal hacia dentro y mete el balon en el area rival, donde lo saca un defensa",
        "confianza": "media",
        "bloque": "b02100"
      },
      {
        "seg": 2473,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "PERDIDA",
        "desenlace": "PERDIDA",
        "duracion": 2,
        "pases": "0",
        "detalle": "un jugador del Castilla entra encima del conductor del Torremolinos dentro del circulo central y le quita el balon, lo lleva dos segundos y el Torremolinos se lo vuelve a quitar antes de que salga un pase",
        "confianza": "media",
        "bloque": "b02400"
      },
      {
        "seg": 2502,
        "zona": "campo propio",
        "carril": "derecha",
        "accion": "DESPEJE",
        "desenlace": "FUERA",
        "duracion": 2,
        "pases": "0",
        "detalle": "nuestro central 5 gana la carrera al extremo del Torremolinos pegado a la banda derecha y le roba el balon, pero lo empuja hacia la linea y el balon se marcha fuera",
        "confianza": "baja",
        "bloque": "b02400"
      },
      {
        "seg": 2864,
        "zona": "medio campo",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 15,
        "pases": "3",
        "detalle": "duelo en la banda derecha junto al banquillo rival con el jugador del Torremolinos conduciendo y un jugador del Castilla encima: en 2863 el balon queda suelto y en 2865 ya lo controla el Castilla, que sale conduciendo hacia arriba por el centro-derecha, progresa hasta el borde del area rival y alli un defensa del Torremolinos se lo vuelve a quitar justo antes de que el juego se detenga",
        "confianza": "media",
        "bloque": "b02700"
      },
      {
        "seg": 3221,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "FALTA_CONTRA",
        "duracion": 7,
        "pases": "?",
        "detalle": "presion alta sobre la salida corta del rival tras su saque de puerta: en 3219 un jugador del Castilla entra al jugador del Torremolinos que conduce por nuestra derecha y en 3221-3222 el balon ya lo lleva un jugador del Castilla junto al area rival — lo saca hacia dentro, sigue el barullo en la frontal y en 3227-3228 el arbitro para con un jugador del Torremolinos en el suelo",
        "confianza": "media",
        "bloque": "b03000"
      },
      {
        "seg": 3272,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "FUERA",
        "duracion": 2,
        "pases": "?",
        "detalle": "disputa con entrada a ras de suelo en la banda izquierda dentro del campo rival: en 3270 el balon queda suelto, en 3271 caen juntos un jugador de cada equipo y en 3272 el balon esta a los pies de un jugador del Castilla, que lo saca hacia atras y el juego se detiene enseguida (saque de banda y cambio del rival)",
        "confianza": "baja",
        "bloque": "b03000"
      },
      {
        "seg": 3371,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 3,
        "pases": "1",
        "detalle": "presion sobre el rival que conducia por nuestra derecha pasada la linea de medio campo: se lo quita y lo juega en largo hacia el area, pero el central rival corta el envio junto a su area",
        "confianza": "alta",
        "bloque": "b03300"
      },
      {
        "seg": 3433,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "FALTA_FAVOR",
        "duracion": 5,
        "pases": "2",
        "detalle": "interceptacion junto a la banda derecha en campo rival: el rival saca el balon hacia la linea y un jugador del Castilla se lo quita y lo mete hacia dentro, acaba en barullo y el arbitro pita falta con un jugador nuestro en el suelo",
        "confianza": "media",
        "bloque": "b03300"
      },
      {
        "seg": 3603,
        "zona": "campo rival",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 2,
        "pases": "0",
        "detalle": "presion encima del conductor rival entre el circulo central y la frontal, le quita el balon y lo empuja en diagonal a la derecha pero un jugador del Torremolinos llega antes y lo recupera",
        "confianza": "media",
        "bloque": "b03600"
      },
      {
        "seg": 3607,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 2,
        "pases": "1",
        "detalle": "el jugador del Torremolinos conduce hacia la banda derecha del ataque y nuestro jugador que le persigue le roba el balon, lo mete hacia dentro y el rival vuelve a quedarselo",
        "confianza": "media",
        "bloque": "b03600"
      },
      {
        "seg": 3614,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "PERDIDA",
        "duracion": 5,
        "pases": "2",
        "detalle": "disputa junto al vertice izquierdo del area rival: se le va el balon al jugador del Torremolinos que conducia, un jugador del Castilla lo gana con un jugador del Torremolinos encima, se saca en diagonal a la derecha y el rival lo recupera en 3619",
        "confianza": "baja",
        "bloque": "b03600"
      },
      {
        "seg": 3743,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 3,
        "pases": "1",
        "detalle": "un jugador del Castilla va encima del jugador del Torremolinos que conduce junto al circulo central y le quita el balon, se saca hacia delante pero el rival lo recupera enseguida",
        "confianza": "baja",
        "bloque": "b03600"
      },
      {
        "seg": 3903,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "AREA",
        "duracion": 5,
        "pases": "0",
        "detalle": "presion alta sobre el defensa rival junto a su area: le quita el balon y conduce solo hacia porteria, mete el balon en el area pero el portero verde le sale y lo ataja",
        "confianza": "alta",
        "bloque": "b03900"
      },
      {
        "seg": 4029,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "PERDIDA",
        "desenlace": "PERDIDA",
        "duracion": 1,
        "pases": "0",
        "detalle": "entrada de un jugador del Castilla sobre el conductor rival junto al circulo central: el balon queda suelto y un jugador del Castilla llega primero, pero el rival lo recupera al segundo siguiente",
        "confianza": "baja",
        "bloque": "b03900"
      },
      {
        "seg": 4278,
        "zona": "medio campo",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "REMATE",
        "duracion": 11,
        "pases": "3",
        "detalle": "entrada de un jugador del Castilla sobre el rival que conducia justo en la linea de medio campo por la derecha, el Castilla sale con el balon y progresa por la banda derecha, envio raso al area en 4287 y remate que el portero verde ataja en el suelo en 4289",
        "confianza": "media",
        "bloque": "b04200"
      },
      {
        "seg": 4568,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "FALTA_CONTRA",
        "duracion": 11,
        "pases": "2",
        "detalle": "balon suelto y disputado junto a la linea de medio campo por la izquierda, en 4566-4567 un jugador del Castilla y un jugador del Torremolinos forcejean encima del balon y en 4568 nuestro jugador sale conduciendo hacia arriba con el jugador del Torremolinos a la espalda, envio largo y un jugador del Castilla recoge por la derecha hasta el ultimo tercio, donde en 4579 hay un choque, el arbitro para y la falta la acaba sacando el Torremolinos",
        "confianza": "media",
        "bloque": "b04500"
      },
      {
        "seg": 4623,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "PERDIDA",
        "duracion": 5,
        "pases": "1",
        "detalle": "presion alta sobre el defensa del Torremolinos junto a su propia area por la izquierda, en 4622 el jugador del Torremolinos lleva el balon con un jugador del Castilla encima y en 4623 nuestro jugador ya golpea el balon y lo saca hacia la banda, pero en el barullo de la linea de cal el Torremolinos lo vuelve a coger hacia 4628",
        "confianza": "baja",
        "bloque": "b04500"
      },
      {
        "seg": 4819,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "PERDIDA",
        "duracion": 3,
        "pases": "1",
        "detalle": "entrada de un companero sobre el rival justo pasada la linea de medio campo y el 21 recoge el rechace cerca del circulo central antes de tocarla en corto hacia la izquierda",
        "confianza": "media",
        "bloque": "b04800"
      },
      {
        "seg": 4826,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "ULTIMO_TERCIO",
        "duracion": 4,
        "pases": "0",
        "detalle": "duelo ganado en la banda izquierda junto al medio campo y conduccion hacia arriba hasta la frontal del area rival donde nos la quitan",
        "confianza": "media",
        "bloque": "b04800"
      },
      {
        "seg": 4837,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "REMATE",
        "duracion": 53,
        "pases": "?",
        "detalle": "cortamos la salida de balon del Torremolinos por su izquierda y arranca una posesion muy larga que termina con balones sueltos y remates dentro de su area",
        "confianza": "media",
        "bloque": "b04800"
      },
      {
        "seg": 5033,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "ULTIMO_TERCIO",
        "duracion": 13,
        "pases": "?",
        "detalle": "robo en el duelo sobre la linea de medio campo por el centro y progresion inmediata hasta la frontal del area rival donde muere la jugada",
        "confianza": "media",
        "bloque": "b04800"
      },
      {
        "seg": 5241,
        "zona": "medio campo",
        "carril": "derecha",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "PERDIDA",
        "duracion": 2,
        "pases": "0",
        "detalle": "en 5238-5240 el balon lo conduce un jugador del Torremolinos junto al circulo central, un jugador del Castilla le entra encima y en 5241 el balon ya es suyo, pero conduce hacia atras-derecha y en 5243 se lo vuelven a quitar en la banda derecha",
        "confianza": "media",
        "bloque": "b05100"
      },
      {
        "seg": 5300,
        "zona": "campo rival",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "AREA",
        "duracion": 6,
        "pases": "1",
        "detalle": "segunda jugada del saque de puerta: en 5299 el balon es de un jugador del Torremolinos con un jugador del Castilla pegado, en 5300 lo gana el Castilla, lo saca hacia delante por la izquierda y en 5305-5306 un jugador del Castilla llega a linea de fondo dentro del area, donde un central despeja a corner",
        "confianza": "media",
        "bloque": "b05100"
      },
      {
        "seg": 5333,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "REMATE",
        "duracion": 9,
        "pases": "?",
        "detalle": "presion de dos jugadores del Castilla sobre el lateral rival junto a la banda derecha (5331 el balon es del Torremolinos, 5332 lo aprietan, 5333 lo recupera el 21), el Castilla progresa por la derecha, cambia a la izquierda del area y en 5342 tira — el balon entra y es gol",
        "confianza": "alta",
        "bloque": "b05100"
      },
      {
        "seg": 5448,
        "zona": "campo propio",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "FUERA",
        "duracion": 5,
        "pases": "0",
        "detalle": "un jugador del Torremolinos conduce por la banda izquierda hacia el area del Castilla con un jugador del Castilla pegado a el, en 5443 nuestro jugador entra y el balon queda suelto, tras un barullo de varios segundos nuestro jugador sale con el balon pegado a la linea de cal en 5448 y lo protege bajo presion sin llegar a dar pase, en 5453 el balon sale por la banda y el asistente senala saque de banda para el Castilla",
        "confianza": "media",
        "bloque": "b05400"
      },
      {
        "seg": 5712,
        "zona": "campo propio",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "POSESION",
        "duracion": 16,
        "pases": "?",
        "detalle": "el 11 del Torremolinos conduce por nuestra banda izquierda y un jugador del Castilla le entra encima junto a la linea en 5710-5712: en 5713 el balon ya lo lleva el 10 del Castilla, que conduce hacia dentro mientras el rival protesta falta, y el equipo circula en campo propio y medio campo sin llegar al ultimo tercio",
        "confianza": "media",
        "bloque": "b05700"
      },
      {
        "seg": 5952,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "POSESION",
        "duracion": 16,
        "pases": "?",
        "detalle": "disputa sobre la linea de medio campo por la izquierda: en 5950 pelean el balon un jugador del Castilla y un jugador del Torremolinos, en 5951 lo lleva el jugador del Torremolinos con nuestro jugador encima y en 5952 queda suelto y llega antes el Castilla, que en 5954-5956 lo conduce hacia atras por la izquierda y lo hace circular por campo propio",
        "confianza": "media",
        "bloque": "b05700"
      }
    ]
  },
  {
    "id": "aguilas",
    "jornada": "J3",
    "rival": "Águilas FC",
    "local": false,
    "fecha": "2026-09-12",
    "resultado": "",
    "video": "",
    "segundosVideo": 6158,
    "bloquesTotales": 21,
    "notas": [
      "Revisado entero, pero con menos lupa que el J2. Los 40 robos son un suelo, no un total: el que empieza y acaba en un par de segundos no se ve.",
      "Y el sesgo no es sólo de cantidad: con menos lupa se ven sobre todo los robos que llevan a algo, y por eso aquí sale 90% hacia delante y en el J2 un 60%. NO compares ese porcentaje entre los dos partidos; para eso hace falta volver a mirar el J3 con el detalle del J2.",
      "Aquí la dirección SÍ cambia: el Castilla ataca hacia arriba de la imagen hasta el segundo 3016 y hacia abajo desde el 3017.",
      "El descanso no está grabado: hay un corte de montaje entre el 3016 y el 3017. No hay marcador en pantalla, así que los minutos son de vídeo.",
      "Pausa de hidratación del 83'09\" al 84'53\". El vídeo acaba en el 102'37\" con el partido todavía en juego.",
      "En el 74'10\" nuestro portero le para un penalti al Águilas."
    ],
    "goles": [
      {
        "seg": 687,
        "de": "rival",
        "texto": "Gol del Águilas, en una falta al borde del área"
      }
    ],
    "bloquesCerrados": 21,
    "segundosRevisados": 6158,
    "robos": [
      {
        "seg": 59,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 3,
        "pases": "1",
        "detalle": "entrada en banda izquierda sobre el rival que conducia y pase largo al espacio que no encuentra a nadie",
        "confianza": "media",
        "bloque": "b00000"
      },
      {
        "seg": 204,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "ULTIMO_TERCIO",
        "duracion": 8,
        "pases": "3",
        "detalle": "gana el segundo balon en el duelo aereo del centro tras el despeje del rival y el Castilla progresa por la banda derecha hasta el ultimo tercio",
        "confianza": "media",
        "bloque": "b00000"
      },
      {
        "seg": 343,
        "zona": "campo rival",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 20,
        "pases": "?",
        "detalle": "presion alta sobre la salida del Águilas junto al area y conduccion hacia la banda derecha antes de perderla cerca del medio campo",
        "confianza": "media",
        "bloque": "b00300"
      },
      {
        "seg": 430,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "POSESION",
        "duracion": 42,
        "pases": "?",
        "detalle": "roba en el centro y saca por la izquierda abriendo una fase larga de ataque en campo del Águilas",
        "confianza": "media",
        "bloque": "b00300"
      },
      {
        "seg": 466,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 10,
        "pases": "2",
        "detalle": "presion alta en campo del Águilas gana el balon en el duelo y sigue el ataque hasta perderlo",
        "confianza": "baja",
        "bloque": "b00300"
      },
      {
        "seg": 554,
        "zona": "campo propio",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "FALTA_FAVOR",
        "duracion": 15,
        "pases": "2",
        "detalle": "corta la subida del Águilas por esa banda conduce hacia el centro y acaba recibiendo falta",
        "confianza": "media",
        "bloque": "b00300"
      },
      {
        "seg": 997,
        "zona": "campo propio",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "FALTA_FAVOR",
        "duracion": 12,
        "pases": "2",
        "detalle": "el central 2 le quita el balon al extremo del Águilas en el borde del area propia y el 11 la saca en conduccion por la izquierda",
        "confianza": "media",
        "bloque": "b00900"
      },
      {
        "seg": 1091,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "AREA",
        "duracion": 9,
        "pases": "?",
        "detalle": "entrada por abajo de nuestro centrocampista al conductor del Águilas justo pasada la linea de medio campo y el balon queda suelto para el Castilla que sale por la izquierda",
        "confianza": "media",
        "bloque": "b00900"
      },
      {
        "seg": 1112,
        "zona": "medio campo",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "ATRAS_PORTERO",
        "duracion": 8,
        "pases": "3",
        "detalle": "el lateral 2 entra al extremo del Águilas pegado a la banda derecha el balon queda muerto y lo recoge el Castilla para salir hacia delante",
        "confianza": "media",
        "bloque": "b00900"
      },
      {
        "seg": 1201,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "POSESION",
        "duracion": 68,
        "pases": "?",
        "detalle": "disputa ganada en el medio campo y salimos jugando sin llegar al ultimo tercio",
        "confianza": "media",
        "bloque": "b01200"
      },
      {
        "seg": 1301,
        "zona": "campo propio",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "ATRAS_PORTERO",
        "duracion": 15,
        "pases": "3",
        "detalle": "entrada sobre el rival junto a nuestra frontal y sacamos por la izquierda",
        "confianza": "media",
        "bloque": "b01200"
      },
      {
        "seg": 1478,
        "zona": "campo propio",
        "carril": "derecha",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "POSESION",
        "duracion": 21,
        "pases": "?",
        "detalle": "balon ganado en duelo en nuestro carril derecho y lo conservamos",
        "confianza": "baja",
        "bloque": "b01200"
      },
      {
        "seg": 1503,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 9,
        "pases": "2",
        "detalle": "interceptacion en la salida del rival y salimos por el centro",
        "confianza": "media",
        "bloque": "b01500"
      },
      {
        "seg": 1550,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "PERDIDA",
        "duracion": 10,
        "pases": "2",
        "detalle": "balon ganado en presion alta por izquierda y cambiamos de carril",
        "confianza": "baja",
        "bloque": "b01500"
      },
      {
        "seg": 1565,
        "zona": "campo propio",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 11,
        "pases": "2",
        "detalle": "robo al borde de nuestra area tras el ataque rival por nuestra derecha",
        "confianza": "media",
        "bloque": "b01500"
      },
      {
        "seg": 1955,
        "zona": "campo propio",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 3,
        "pases": "1",
        "detalle": "nuestro central se anticipa en la banda izquierda cerca del medio campo el rival cae al suelo y el saca un envio largo hacia delante que el Águilas corta",
        "confianza": "media",
        "bloque": "b01800"
      },
      {
        "seg": 2232,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "FALTA_FAVOR",
        "duracion": 7,
        "pases": "1",
        "detalle": "entrada de un jugador del Castilla sobre el conductor del Águilas en banda derecha y el rival derriba al recuperador",
        "confianza": "media",
        "bloque": "b02100"
      },
      {
        "seg": 2364,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 10,
        "pases": "2",
        "detalle": "presion alta en banda izquierda cerca del area rival y el Castilla se queda el balon para conducir",
        "confianza": "baja",
        "bloque": "b02100"
      },
      {
        "seg": 2390,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "POSESION",
        "duracion": 12,
        "pases": "?",
        "detalle": "disputa ganada cerca del circulo central y conduccion por el carril izquierdo",
        "confianza": "baja",
        "bloque": "b02100"
      },
      {
        "seg": 2463,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 7,
        "pases": "1",
        "detalle": "entrada y presion junto al area del Águilas el balon queda ante el portero que sale y el rival lo recupera",
        "confianza": "media",
        "bloque": "b02400"
      },
      {
        "seg": 2474,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "FALTA_FAVOR",
        "duracion": 8,
        "pases": "3",
        "detalle": "robo en la salida del Águilas por la izquierda y el Castilla progresa hasta que le hacen falta junto al circulo central",
        "confianza": "media",
        "bloque": "b02400"
      },
      {
        "seg": 2512,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "AREA",
        "duracion": 7,
        "pases": "2",
        "detalle": "robo en la presion junto al circulo central y conduccion directa hasta meter el balon en el area del Águilas donde lo bloca el portero",
        "confianza": "media",
        "bloque": "b02400"
      },
      {
        "seg": 2748,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "REMATE",
        "duracion": 20,
        "pases": "?",
        "detalle": "disputa ganada en la banda izquierda y contraataque que acaba en remate atajado por el portero rival",
        "confianza": "media",
        "bloque": "b02700"
      },
      {
        "seg": 2936,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "FUERA",
        "duracion": 5,
        "pases": "1",
        "detalle": "presion alta sobre la salida de balon del Águilas y el balon acaba fuera por linea de fondo",
        "confianza": "baja",
        "bloque": "b02700"
      },
      {
        "seg": 3183,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "AREA",
        "duracion": 13,
        "pases": "?",
        "detalle": "presion alta sobre la salida del Águilas balon suelto ganado y conduccion hasta el area que acaba en corner",
        "confianza": "media",
        "bloque": "b03000"
      },
      {
        "seg": 3580,
        "zona": "campo propio",
        "carril": "derecha",
        "accion": "DESPEJE",
        "desenlace": "PERDIDA",
        "duracion": 6,
        "pases": "1",
        "detalle": "duelo ganado en la banda de nuestra derecha y balonazo largo que atrapa el portero del Águilas",
        "confianza": "media",
        "bloque": "b03300"
      },
      {
        "seg": 3660,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "AREA",
        "duracion": 10,
        "pases": "2",
        "detalle": "presion alta en banda y el balon acaba en el area del Águilas con el portero rojo despejando",
        "confianza": "media",
        "bloque": "b03600"
      },
      {
        "seg": 3814,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 18,
        "pases": "3",
        "detalle": "recuperacion en el circulo central tras el saque del portero rival y salida hacia la banda",
        "confianza": "baja",
        "bloque": "b03600"
      },
      {
        "seg": 3877,
        "zona": "campo rival",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "FUERA",
        "duracion": 15,
        "pases": "2",
        "detalle": "varios jugadores del Castilla encima de la salida del Águilas y el balon se gana cerca del area grande",
        "confianza": "media",
        "bloque": "b03600"
      },
      {
        "seg": 4042,
        "zona": "medio campo",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 13,
        "pases": "1",
        "detalle": "balon ganado en el amontonamiento del centro y conduccion por la banda",
        "confianza": "baja",
        "bloque": "b03900"
      },
      {
        "seg": 4072,
        "zona": "campo rival",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "FALTA_FAVOR",
        "duracion": 16,
        "pases": "2",
        "detalle": "duelo ganado cerca del area del Águilas que termina en falta a favor junto al area",
        "confianza": "media",
        "bloque": "b03900"
      },
      {
        "seg": 4172,
        "zona": "campo propio",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 12,
        "pases": "2",
        "detalle": "balon suelto ganado en nuestro campo y salida conduciendo desde el circulo central",
        "confianza": "media",
        "bloque": "b03900"
      },
      {
        "seg": 4707,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 12,
        "pases": "2",
        "detalle": "balon disputado cerca del circulo ganado por un jugador del Castilla y abierto al carril izquierdo antes de volver a perderlo",
        "confianza": "media",
        "bloque": "b04500"
      },
      {
        "seg": 4815,
        "zona": "campo propio",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "FALTA_CONTRA",
        "duracion": 15,
        "pases": "2",
        "detalle": "el Castilla gana el balon dentro de su area tras la presion del Águilas y sale conduciendo por su izquierda hasta que el arbitro corta la jugada",
        "confianza": "baja",
        "bloque": "b04800"
      },
      {
        "seg": 5222,
        "zona": "medio campo",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 14,
        "pases": "2",
        "detalle": "balon dividido ganado por un jugador del Castilla junto al circulo central y conduccion hacia campo rival",
        "confianza": "media",
        "bloque": "b05100"
      },
      {
        "seg": 5308,
        "zona": "medio campo",
        "carril": "izquierda",
        "accion": "ADELANTE",
        "desenlace": "FUERA",
        "duracion": 13,
        "pases": "?",
        "detalle": "recuperacion en el medio y ataque por la banda que acaba en la linea de fondo del Águilas",
        "confianza": "baja",
        "bloque": "b05100"
      },
      {
        "seg": 5666,
        "zona": "medio campo",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "REMATE",
        "duracion": 10,
        "pases": "?",
        "detalle": "balon dividido ganado por un jugador del Castilla cerca del medio campo y ataque que acaba en parada del portero del Águilas",
        "confianza": "media",
        "bloque": "b05400"
      },
      {
        "seg": 5714,
        "zona": "campo propio",
        "carril": "izquierda",
        "accion": "HORIZONTAL_ATRAS",
        "desenlace": "PERDIDA",
        "duracion": 6,
        "pases": "1",
        "detalle": "corta un pase del Águilas en la banda con un jugador del Castilla encima y el balon se vuelve a perder enseguida",
        "confianza": "baja",
        "bloque": "b05700"
      },
      {
        "seg": 5808,
        "zona": "campo propio",
        "carril": "derecha",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 13,
        "pases": "2",
        "detalle": "recupera cerca del medio campo y conduce por su banda derecha hasta campo rival donde la pierde en un multiple junto a la linea",
        "confianza": "media",
        "bloque": "b05700"
      },
      {
        "seg": 6024,
        "zona": "medio campo",
        "carril": "centro",
        "accion": "ADELANTE",
        "desenlace": "PERDIDA",
        "duracion": 9,
        "pases": "1",
        "detalle": "interceptacion en el borde del circulo central de un balon que el 3 del Águilas saca presionado y conduccion larga por la banda izquierda hasta que el 6 del Águilas se la quita",
        "confianza": "media",
        "bloque": "b06000"
      }
    ]
  },
  {
    "id": "sant-andreu",
    "jornada": "J4",
    "rival": "UE Sant Andreu",
    "local": false,
    "fecha": "2026-09-21",
    "resultado": "1-1",
    "video": "C:/Users/Usuario/Downloads/SANT ANDREU - RM CASTILLA.mov",
    "segundosVideo": 5914,
    "bloquesTotales": 20,
    "notas": [
      "Revisado con la misma lupa que el J3, no con la del J2: los robos que salen son un suelo, no un total, y el que empieza y acaba en un par de segundos no se ve.",
      "Por lo mismo, el reparto entre ADELANTE y HORIZONTAL_ATRAS de este partido NO se puede comparar con el del J2, que se miró imagen a imagen. Con el J3 sí: están mirados igual."
    ],
    "goles": [],
    "bloquesCerrados": 0,
    "segundosRevisados": 0,
    "robos": []
  }
];
