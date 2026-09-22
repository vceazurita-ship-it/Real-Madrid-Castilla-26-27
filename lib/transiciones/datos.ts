/**
 * Robos y transiciones etiquetados a mano sobre el vídeo.
 *
 * ESTE FICHERO SE GENERA. No lo edites: lo escribe
 * scripts/transiciones-datos.mjs a partir de los CSV de
 * Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES.
 *
 * Generado: 2026-09-22
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
  segundosVideo: number;
  bloquesTotales: number;
  bloquesCerrados: number;
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
        "detalle": "balon suelto en la salida corta del rival con un blanco encima, lo gana el Castilla en la banda izquierda del campo rival pero el balon va hacia la linea y el rival lo recupera enseguida",
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
        "detalle": "duelo en la banda izquierda junto al circulo central, el rival pierde el control y un blanco sale conduciendo, la jugada muere con el balon dentro del area rival y el portero achicando a los pies",
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
        "detalle": "banda derecha, cerca del area propia: un negro conduce por la linea y el lateral blanco le aguanta el duelo, el balon se escapa del negro y el blanco llega antes — conduce hacia dentro y la cede al portero naranja, que la recoge en el area",
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
        "detalle": "el Torremolinos saca el balon desde su area por su banda izquierda y el blanco se lo roba en carrera junto a la linea, siguen duelos en la banda y el balon acaba saliendo por el lateral",
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
        "detalle": "disputa en la banda derecha junto a la linea de medio campo: el balon esta en un jugador de negro (2088), dos jugadores de blanco le entran al suelo (2090-2091) y el balon queda para el Castilla, que lo saca hacia dentro y hacia atras",
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
        "detalle": "dos blancos aprietan al negro que conducia por su banda derecha pasado el medio campo y el balon queda para el Castilla, que conduce en diagonal hacia dentro y mete el balon en el area rival, donde lo saca un defensa",
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
        "detalle": "un blanco entra encima del conductor negro dentro del circulo central y le quita el balon, lo lleva dos segundos y el Torremolinos se lo vuelve a quitar antes de que salga un pase",
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
        "detalle": "el central blanco numero 5 gana la carrera al extremo negro pegado a la banda derecha y le roba el balon, pero lo empuja hacia la linea y el balon se marcha fuera",
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
        "detalle": "duelo en la banda derecha junto al banquillo rival con el negro conduciendo y un blanco encima: en 2863 el balon queda suelto y en 2865 ya lo controla el Castilla, que sale conduciendo hacia arriba por el centro-derecha, progresa hasta el borde del area rival y alli un defensa negro se lo vuelve a quitar justo antes de que el juego se detenga",
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
        "detalle": "presion alta sobre la salida corta del rival tras su saque de puerta: en 3219 un blanco entra al negro que conduce por nuestra derecha y en 3221-3222 el balon ya lo lleva un blanco junto al area rival — lo saca hacia dentro, sigue el barullo en la frontal y en 3227-3228 el arbitro para con un jugador de negro en el suelo",
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
        "detalle": "disputa con entrada a ras de suelo en la banda izquierda dentro del campo rival: en 3270 el balon queda suelto, en 3271 blanco y negro caen juntos y en 3272 el balon esta a los pies de un blanco, que lo saca hacia atras y el juego se detiene enseguida (saque de banda y cambio del rival)",
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
        "detalle": "interceptacion junto a la banda derecha en campo rival: el rival saca el balon hacia la linea y un blanco se lo quita y lo mete hacia dentro, acaba en barullo y el arbitro pita falta con un jugador nuestro en el suelo",
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
        "detalle": "presion encima del conductor rival entre el circulo central y la frontal, le quita el balon y lo empuja en diagonal a la derecha pero un negro llega antes y lo recupera",
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
        "detalle": "el negro conduce hacia la banda derecha del ataque y el blanco que le persigue le roba el balon, lo mete hacia dentro y el rival vuelve a quedarselo",
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
        "detalle": "disputa junto al vertice izquierdo del area rival: se le va el balon al negro que conducia, un blanco lo gana con un negro encima, se saca en diagonal a la derecha y el rival lo recupera en 3619",
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
        "detalle": "un blanco va encima del negro que conduce junto al circulo central y le quita el balon, se saca hacia delante pero el rival lo recupera enseguida",
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
        "detalle": "entrada de un blanco sobre el conductor rival junto al circulo central: el balon queda suelto y un blanco llega primero, pero el rival lo recupera al segundo siguiente",
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
        "detalle": "entrada de un blanco sobre el rival que conducia justo en la linea de medio campo por la derecha, el Castilla sale con el balon y progresa por la banda derecha, envio raso al area en 4287 y remate que el portero verde ataja en el suelo en 4289",
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
        "detalle": "balon suelto y disputado junto a la linea de medio campo por la izquierda, en 4566-4567 un blanco y un negro forcejean encima del balon y en 4568 el blanco sale conduciendo hacia arriba con el negro a la espalda, envio largo y un blanco recoge por la derecha hasta el ultimo tercio, donde en 4579 hay un choque, el arbitro para y la falta la acaba sacando el Torremolinos",
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
        "detalle": "presion alta sobre el defensa del Torremolinos junto a su propia area por la izquierda, en 4622 el negro lleva el balon con un blanco encima y en 4623 el blanco ya golpea el balon y lo saca hacia la banda, pero en el barullo de la linea de cal el Torremolinos lo vuelve a coger hacia 4628",
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
        "detalle": "en 5238-5240 el balon lo conduce un jugador de negro junto al circulo central, un blanco le entra encima y en 5241 el balon ya es suyo, pero conduce hacia atras-derecha y en 5243 se lo vuelven a quitar en la banda derecha",
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
        "detalle": "segunda jugada del saque de puerta: en 5299 el balon es de un negro con un blanco pegado, en 5300 lo gana el Castilla, lo saca hacia delante por la izquierda y en 5305-5306 un blanco llega a linea de fondo dentro del area, donde un central despeja a corner",
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
        "detalle": "presion de dos blancos sobre el lateral rival junto a la banda derecha (5331 el balon es de negro, 5332 lo aprietan, 5333 lo recupera el 21), el Castilla progresa por la derecha, cambia a la izquierda del area y en 5342 tira — el balon entra y es gol",
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
        "detalle": "un negro conduce por la banda izquierda hacia el area del Castilla con un blanco pegado a el, en 5443 el blanco entra y el balon queda suelto, tras un barullo de varios segundos el blanco sale con el balon pegado a la linea de cal en 5448 y lo protege bajo presion sin llegar a dar pase, en 5453 el balon sale por la banda y el asistente senala saque de banda para el Castilla",
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
        "detalle": "el 11 del Torremolinos conduce por nuestra banda izquierda y un blanco le entra encima junto a la linea en 5710-5712: en 5713 el balon ya lo lleva el 10 del Castilla, que conduce hacia dentro mientras el rival protesta falta, y el equipo circula en campo propio y medio campo sin llegar al ultimo tercio",
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
        "detalle": "disputa sobre la linea de medio campo por la izquierda: en 5950 pelean el balon un blanco y un negro, en 5951 lo lleva el negro con el blanco encima y en 5952 queda suelto y llega antes el Castilla, que en 5954-5956 lo conduce hacia atras por la izquierda y lo hace circular por campo propio",
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
    "segundosVideo": 6158,
    "bloquesTotales": 21,
    "notas": [],
    "goles": [],
    "bloquesCerrados": 0,
    "robos": []
  }
];
