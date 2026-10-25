/**
 * LOS REFERENTES DEL BALÓN PARADO (laboratorio de ABP, 20/10/2026).
 *
 * Es DATO, no interfaz: cada principio y cada rutina llevan la fuente de la
 * que salen, con su enlace y su fecha. Nada de aquí está escrito de memoria;
 * lo que una fuente no dice, no se dice. Para añadir un referente o una
 * rutina, se añade aquí con su `fuente` y la pantalla lo pinta sola.
 *
 * Lo que NO hay (y no se rellena): los vídeos de YouTube que no se han podido
 * comprobar, y el esquema defensivo propio de Chelsea con Cueva —ninguna
 * fuente seria lo detalla—.
 */

export type TipoAbp = "corner" | "falta" | "banda" | "penalti" | "saque";

export type Fuente = {
  titulo: string;
  medio: string;
  url: string;
  /** "2024-12-04", "2025-10" o "2024"; vacía si la fuente no la da. */
  fecha: string;
};

export type Principio = {
  titulo: string;
  detalle: string;
  fuente: Fuente;
};

export type RutinaReferente = {
  id: string;
  nombre: string;
  tipo: TipoAbp;
  /** Qué hace cada uno, en el orden en que pasa. */
  pasos: string[];
  /** Contra qué defensa se vio funcionar. */
  contra?: string;
  /** Contra qué tipo de defensa funciona, si la fuente lo deja claro. */
  defensa?: "zona" | "hombre" | "mixta";
  /** Cómo se entrena: la tarea, en una frase. */
  tarea: string;
  /** El criterio de éxito observable de esa tarea. */
  exito: string;
  fuente: Fuente;
};

export type Recurso = {
  titulo: string;
  /** El título original (casi siempre en inglés), si el de arriba es la traducción. */
  original?: string;
  tipo: "artículo" | "análisis" | "curso" | "datos" | "entrevista";
  url: string;
  gratis: boolean;
  medio: string;
  fecha: string;
};

export type Referente = {
  id: string;
  nombre: string;
  club: string;
  rol: string;
  /** Una frase: por qué está aquí. */
  lema: string;
  cifras: { valor: string; texto: string; fuente: Fuente }[];
  principios: Principio[];
  rutinas: RutinaReferente[];
  recursos: Recurso[];
};

/* ------------------------------------------------------------------ */
/*  FUENTES                                                            */
/* ------------------------------------------------------------------ */

const F = {
  plGabriel: {
    titulo: "Blocking, decoys and brute force: How Arsenal unleash Gabriel at corners",
    medio: "Premier League (Opta Analyst)",
    url: "https://www.premierleague.com/en/news/4183525",
    fecha: "2024-12-04",
  },
  plJover: {
    titulo: "How Nicolas Jover made Arsenal the kings of corners",
    medio: "Premier League",
    url: "https://premierleague.com/news/4187343",
    fecha: "2024-12-08",
  },
  skyJover: {
    titulo: "Nicolas Jover: Arsenal's set-piece 'genius'",
    medio: "Sky Sports",
    url: "https://www.skysports.com/football/news/11095/13125688/nicolas-jover-arsenals-set-piece-genius-has-transformed-premier-league-title-challengers-threat-from-free-kicks-and-corners",
    fecha: "2024-04-30",
  },
  tggBloqueos: {
    titulo: "Arsenal and the art of blocking at corners",
    medio: "Training Ground Guru (Billy Coulston)",
    url: "https://trainingground.guru/articles/arsenal-and-the-art-of-blocking-at-corners",
    fecha: "2024-04-30",
  },
  arteta: {
    titulo: "Mikel Arteta on Arsenal set piece joy, Nicolas Jover and 'tricking' opponents",
    medio: "TNT Sports",
    url: "https://www.tntsports.co.uk/football/premier-league/2023-2024/exclusive-mikel-arteta-on-arsenal-set-piece-joy-nicolas-jover-and-tricking-opponents-a-big-part-of-t_sto10000464/story.shtml",
    fecha: "2024-01-30",
  },
  tfaChelsea: {
    titulo: "Bernardo Cueva Corner Tactics At Chelsea 2024/2025",
    medio: "Total Football Analysis",
    url: "https://totalfootballanalysis.com/set-piece-analysis/chelsea-corner-tactics-2024-2025-set-piece-analysis-tactics",
    fecha: "2025-05-15",
  },
  fifaChelsea: {
    titulo: "Short corners: Chelsea's overloads and dynamic decision-making",
    medio: "FIFA Training Centre",
    url: "https://www.fifatrainingcentre.com/en/game/game-analysis/set-plays/set-play-routines/short-corners-structure-and-decision-making-in-chelseas-set-plays.php",
    fecha: "2026-01-06",
  },
  tggBrentford: {
    titulo: "Brentford bring their set piece prowess to the Premier League",
    medio: "Training Ground Guru",
    url: "https://archive.trainingground.guru/articles/brentford-bring-their-set-piece-prowess-to-the-premier-league",
    fecha: "2021-10-14",
  },
  georgson: {
    titulo: "Andreas Georgson Q&A: coach answers fans' questions on Reddit",
    medio: "Tottenham Hotspur",
    url: "https://www.tottenhamhotspur.com/news/2025/october/andreas-georgson-qa-coach-answers-fans-questions-on-reddit/",
    fecha: "2025-10",
  },
  vio: {
    titulo: "Fiorentina banking on Italy's set-piece guru",
    medio: "Eurosport",
    url: "https://www.tntsports.co.uk/football/fiorentina-banking-on-italys-set-piece-guru_sto4716397/story.shtml",
    fecha: "2015-05-07",
  },
  gronnemark: {
    titulo: "An Interview With Liverpool's Throw-In Coach",
    medio: "No Grass in the Clouds",
    url: "https://nograssintheclouds.substack.com/p/an-interview-with-liverpools-throw",
    fecha: "",
  },
  coulston: {
    titulo: "Incorporating set pieces into your game model",
    medio: "Training Ground Guru (Billy Coulston)",
    url: "https://archive.trainingground.guru/articles/billy-coulston-incorporating-set-pieces-into-your-game-model",
    fecha: "2024-04-16",
  },
  analystCorners: {
    titulo: "Premier League corner stats: inswingers vs outswingers, short vs crossed",
    medio: "The Analyst (Opta)",
    url: "https://theanalyst.com/articles/premier-league-corner-stats-inswingers-vs-outswingers-short-vs-crossed-kai-havertzs-defending",
    fecha: "2023-08-09",
  },
  plDefensa: {
    titulo: "Which clubs are best at defending corners and why",
    medio: "Premier League (Adrian Clarke)",
    url: "https://www.premierleague.com/news/2982222",
    fecha: "2022-12-12",
  },
  hudl360: {
    titulo: "StatsBomb 360: Analysing The Best Corner Teams In Europe",
    medio: "Hudl · StatsBomb",
    url: "https://www.hudl.com/blog/statsbomb-360-analysing-the-best-corner-teams-in-europe",
    fecha: "2022-07-27",
  },
} satisfies Record<string, Fuente>;

export const FUENTES = F;

/* ------------------------------------------------------------------ */
/*  LOS REFERENTES                                                     */
/* ------------------------------------------------------------------ */

export const REFERENTES: Referente[] = [
  {
    id: "jover",
    nombre: "Nicolas Jover",
    club: "Arsenal",
    rol: "Entrenador de balón parado (desde 2021; antes Brentford y Manchester City)",
    lema: "El córner como arma de campeón: cerrado, al área pequeña y con bloqueos que dejan solo a Gabriel.",
    cifras: [
      { valor: "96 %", texto: "de sus córners colgados son cerrados (Saka por la derecha, Rice por la izquierda)", fuente: F.plGabriel },
      { valor: "3,8", texto: "atacantes de media dentro del área pequeña rival, el máximo de la Premier", fuente: F.plGabriel },
      { valor: "1 de 16,4", texto: "córners acaba en gol con Jover; antes, 1 de cada 32", fuente: F.plJover },
      { valor: "6 → 22", texto: "goles de ABP sin penaltis: la temporada antes de llegar frente a la 23/24", fuente: F.skyJover },
    ],
    principios: [
      {
        titulo: "Un rematador, el resto trabaja para él",
        detalle: "Gabriel es el objetivo en casi todos los córners y el único con licencia para cambiar su posición de salida. Los demás entran para bloquear o arrastrar marcadores.",
        fuente: F.plGabriel,
      },
      {
        titulo: "Salir del segundo palo y venir al centro",
        detalle: "Arrancan amontonados en el segundo palo y se mueven hacia el centro cuando se saca: el defensor no sabe a quién le toca.",
        fuente: F.plGabriel,
      },
      {
        titulo: "El bloqueador sale por detrás de su defensor",
        detalle: "Trossard empieza detrás del jugador al que va a bloquear, así Andersen no le ve hasta el último momento ni puede quejarse antes del saque. Se bloquea bajo y echado hacia delante, para tener base.",
        fuente: F.tggBloqueos,
      },
      {
        titulo: "Atascar al portero",
        detalle: "Ben White y Saliba se colocan delante de Vicario: bloquean a dos defensores y el portero no puede salir. Gabriel queda libre a seis metros.",
        fuente: F.plGabriel,
      },
      {
        titulo: "Nada es casualidad",
        detalle: "Cada rutina se planifica con cómo respondería el rival; con su ayudante podían pasar más de una hora con un solo córner.",
        fuente: F.skyJover,
      },
      {
        titulo: "Engañar y cambiar",
        detalle: "«Se trata de engañar al rival y ser constante»: los rivales lo miran todo, así que las rutinas cambian de un partido a otro.",
        fuente: F.arteta,
      },
    ],
    rutinas: [
      {
        id: "arsenal-forest",
        nombre: "Cuatro bloqueos y Gabriel al segundo palo",
        tipo: "corner",
        pasos: [
          "Córner cerrado.",
          "Cuatro jugadores entran al área y bloquean cada uno a su marcador.",
          "Gabriel queda solo en el segundo palo.",
        ],
        contra: "Nottingham Forest, que marcaba en zona e ignoraba a los que entraban",
        defensa: "zona",
        tarea: "Seis contra seis en zona: cuatro atacantes entran a bloquear a su marcador y el quinto sale solo al segundo palo.",
        exito: "El rematador llega al segundo palo sin contacto en 3 de 5 saques.",
        fuente: F.plGabriel,
      },
      {
        id: "arsenal-spurs",
        nombre: "Pared delante del portero",
        tipo: "corner",
        pasos: [
          "White y Saliba se plantan delante de Vicario.",
          "Bloquean a Maddison y Van de Ven, y el portero no puede salir a por el balón.",
          "Gabriel pierde a su marcador y cabecea libre a seis metros.",
        ],
        contra: "Tottenham",
        defensa: "hombre",
        tarea: "Seis contra seis al hombre: dos atacantes se plantan delante del portero y bloquean a los dos marcadores más cercanos.",
        exito: "El portero no sale a por el balón y el rematador cabecea libre en 3 de 5 saques.",
        fuente: F.plGabriel,
      },
      {
        id: "arsenal-palace",
        nombre: "Señuelo por delante y bloqueo tardío",
        tipo: "corner",
        pasos: [
          "Saliba corre por delante del primer palo y se lleva a Guéhi fuera de la zona.",
          "Trossard, que salió por detrás de Andersen, le bloquea tarde y bajo.",
          "Ben White bloquea al portero.",
        ],
        contra: "Crystal Palace (enero de 2024)",
        defensa: "hombre",
        tarea: "Cinco contra cinco al hombre: un señuelo corre por delante del primer palo para sacar a su marcador y un segundo atacante bloquea tarde y bajo.",
        exito: "El señuelo arrastra a su par fuera de la zona y el rematador queda sin marca en 3 de 5 saques.",
        fuente: F.tggBloqueos,
      },
    ],
    recursos: [
      { titulo: "Bloqueos, señuelos y fuerza bruta", original: "Blocking, decoys and brute force", tipo: "análisis", url: F.plGabriel.url, gratis: true, medio: F.plGabriel.medio, fecha: F.plGabriel.fecha },
      { titulo: "Arsenal y el arte de bloquear en los córners", original: "Arsenal and the art of blocking at corners", tipo: "análisis", url: F.tggBloqueos.url, gratis: true, medio: F.tggBloqueos.medio, fecha: F.tggBloqueos.fecha },
      { titulo: "Cómo Nicolas Jover hizo del Arsenal el rey de los córners", original: "How Nicolas Jover made Arsenal the kings of corners", tipo: "artículo", url: F.plJover.url, gratis: true, medio: F.plJover.medio, fecha: F.plJover.fecha },
      { titulo: "Arteta: balón parado y «engañar al rival»", tipo: "entrevista", url: F.arteta.url, gratis: true, medio: F.arteta.medio, fecha: F.arteta.fecha },
    ],
  },
  {
    id: "cueva",
    nombre: "Bernardo Cueva",
    club: "Chelsea",
    rol: "Entrenador de balón parado (desde 2024; antes estadístico táctico en Brentford)",
    lema: "Rutinas de manual de Brentford y el córner en corto como forma de atacar, no de perder tiempo.",
    cifras: [
      { valor: "6.º", texto: "de la Premier en goles de ABP en la 24/25 (7.º en goles esperados)", fuente: F.tfaChelsea },
      { valor: "4 + 3 + 2", texto: "en el córner en corto: cuatro en el área, tres en la frontal y dos junto al lanzador", fuente: F.fifaChelsea },
    ],
    principios: [
      {
        titulo: "El córner en corto obliga a soltar marcadores",
        detalle: "Dos jugadores cerca del lanzador —uno pegado a la línea de fondo— obligan al rival a mandar defensores; si van muchos, el área y la frontal se quedan cortas.",
        fuente: F.fifaChelsea,
      },
      {
        titulo: "Decidir según cuántos vienen",
        detalle: "Si el rival manda pocos, se progresa hacia zonas peligrosas; si manda muchos, se busca al libre en la frontal o se centra a un área más vacía.",
        fuente: F.fifaChelsea,
      },
      {
        titulo: "Llegar tarde y desde el lado ciego",
        detalle: "Los bloqueadores salen de detrás de la línea zonal y entran por el lado ciego de los defensores más cercanos al objetivo.",
        fuente: F.tfaChelsea,
      },
      {
        titulo: "La ejecución manda",
        detalle: "Las rutinas eran buenas en la idea y fallaban en el centro: el cerrado con el interior y curva moderada, «no un latigazo», es lo que más se escapaba.",
        fuente: F.tfaChelsea,
      },
    ],
    rutinas: [
      {
        id: "chelsea-paquete",
        nombre: "El paquete de Brentford (cerrado al segundo palo)",
        tipo: "corner",
        pasos: [
          "Seis atacantes salen juntos en un paquete y se abren a sus sitios; el último llega tarde.",
          "Un séptimo cae a la frontal para el rechace.",
          "Uno amaga para llevarse al primer defensor y tres bloquean a los de al lado.",
          "Centro cerrado con curva moderada a la zona del segundo palo.",
        ],
        contra: "Tottenham, en zona",
        defensa: "zona",
        tarea: "Siete contra siete en zona: el paquete sale junto, se abre a sus sitios y el centro cae cerrado al segundo palo; uno espera en la frontal.",
        exito: "Tres de cada cinco centros llegan a un rematador sin marca y la frontal recoge el rechace.",
        fuente: F.tfaChelsea,
      },
      {
        id: "chelsea-peinada",
        nombre: "Peinada en el primer palo con centro abierto",
        tipo: "corner",
        pasos: [
          "Dos jugadores salen de detrás de la línea zonal y bloquean por el lado ciego a los dos zonales más cercanos al objetivo.",
          "Un atacante libre llega primero a la zona y peina.",
          "El rematador da un paso atrás para soltarse de su marcador y ataca la peinada en carrera.",
        ],
        contra: "Southampton (cinco zonales, tres al hombre)",
        defensa: "mixta",
        tarea: "Cinco contra cinco con tres zonales: dos bloqueos por el lado ciego abren el primer palo para la peinada.",
        exito: "El rematador conecta la peinada en carrera en 3 de 5 saques.",
        fuente: F.tfaChelsea,
      },
      {
        id: "chelsea-pared",
        nombre: "Córner en corto: pared y pase atrás",
        tipo: "corner",
        pasos: [
          "Uno de la frontal recibe una pared: dos contra uno con el único rival cercano.",
          "Dos por detrás de la línea zonal frenan su salida.",
          "Tres atacan el segundo palo en sentido contrario a la línea; el lanzador se mete en curva para no quedar en fuera de juego.",
          "Pase atrás al borde del área.",
        ],
        contra: "Fulham",
        defensa: "zona",
        tarea: "Córner en corto con superioridad: pared en la frontal, dos frenan su salida y tres atacan el segundo palo.",
        exito: "El pase atrás llega al borde del área con el rematador de cara en 3 de 5 saques.",
        fuente: F.tfaChelsea,
      },
    ],
    recursos: [
      { titulo: "Córners en corto: las superioridades del Chelsea (con vídeo)", original: "Short corners: Chelsea's overloads (con vídeo)", tipo: "análisis", url: F.fifaChelsea.url, gratis: true, medio: F.fifaChelsea.medio, fecha: F.fifaChelsea.fecha },
      { titulo: "Los córners de Bernardo Cueva en el Chelsea 2024/25", original: "Bernardo Cueva Corner Tactics At Chelsea 2024/2025", tipo: "análisis", url: F.tfaChelsea.url, gratis: true, medio: F.tfaChelsea.medio, fecha: F.tfaChelsea.fecha },
    ],
  },
  {
    id: "brentford",
    nombre: "Escuela Brentford",
    club: "El club",
    rol: "La escuela: Vio, Jover, Georgson y Cueva pasaron por su departamento",
    lema: "Diez a la frontal o dentro, segunda jugada y medir el córner por lo que genera.",
    cifras: [
      { valor: "0,07", texto: "goles esperados por córner, líderes de la liga con los que menos sacaron", fuente: F.tggBrentford },
      { valor: "60", texto: "situaciones de balón parado por partido, según el club", fuente: F.tggBrentford },
    ],
    principios: [
      {
        titulo: "Medir por goles esperados por córner",
        detalle: "«La métrica más precisa para medir los córners son los goles esperados por córner», no el número de córners.",
        fuente: F.tggBrentford,
      },
      {
        titulo: "Seis dentro y tres rodeando la frontal",
        detalle: "Los defensas «anillan» el área: protegen la contra y cazan la segunda jugada. El más alejado entra tarde.",
        fuente: F.tggBrentford,
      },
      {
        titulo: "Un analista que prepara variantes para cada rival",
        detalle: "Un analista a tiempo completo estudia al rival y diseña variaciones para cada partido.",
        fuente: F.tggBrentford,
      },
    ],
    rutinas: [],
    recursos: [{ titulo: "Brentford lleva su dominio del balón parado a la Premier League", original: "Brentford bring their set piece prowess to the Premier League", tipo: "artículo", url: F.tggBrentford.url, gratis: true, medio: F.tggBrentford.medio, fecha: F.tggBrentford.fecha }],
  },
  {
    id: "georgson",
    nombre: "Andreas Georgson",
    club: "Tottenham (antes Arsenal, Brentford, Southampton y Malmö)",
    rol: "Entrenador de balón parado",
    lema: "Principios que crecen poco a poco, no jugadas sorpresa sueltas; y aprovechar cada minuto.",
    cifras: [
      { valor: "40 + 60′", texto: "a la semana: 40 minutos con todo el equipo y unos 60 por unidades o individuales", fuente: F.georgson },
      { valor: "20-25 m", texto: "la distancia ideal para tirar una falta directa", fuente: F.georgson },
    ],
    principios: [
      { titulo: "Construir sobre principios", detalle: "Mejora gradual de un conjunto de principios y rutinas, más que jugadas sorpresa de una vez.", fuente: F.georgson },
      { titulo: "Ser eficaz con los minutos", detalle: "«Ser eficaz con los minutos en lugar de desear más»: el tiempo con el equipo es poco y hay que exprimirlo.", fuente: F.georgson },
      { titulo: "Barrera de cuatro o cinco de 16 a 25 metros", detalle: "Más lejos, la barrera tapa la visión del portero y retrasa su reacción.", fuente: F.georgson },
      { titulo: "El brazo arriba del lanzador", detalle: "Es muy importante para el tiempo del que remata.", fuente: F.georgson },
      { titulo: "El saque de centro también es balón parado", detalle: "Necesita una estrategia con algo de flexibilidad.", fuente: F.georgson },
      { titulo: "Mirar otros deportes", detalle: "Fútbol americano y baloncesto como fuente de ideas; los detalles listos de otros equipos se adaptan.", fuente: F.georgson },
    ],
    rutinas: [
      {
        id: "georgson-pinnock",
        nombre: "Segundo palo para Pinnock",
        tipo: "corner",
        pasos: ["La rutina al segundo palo para Ethan Pinnock en Brentford: su favorita de la carrera, «muy efectiva»."],
        tarea: "Repetir la rutina al segundo palo con el cabeceador de la plantilla, primero sin oposición y luego con una defensa en zona.",
        exito: "El cabeceador remata a puerta en 3 de 5 saques sin oposición y en 2 de 5 con ella.",
        fuente: F.georgson,
      },
    ],
    recursos: [{ titulo: "Andreas Georgson: preguntas y respuestas", original: "Andreas Georgson Q&A", tipo: "entrevista", url: F.georgson.url, gratis: true, medio: F.georgson.medio, fecha: F.georgson.fecha }],
  },
  {
    id: "vio",
    nombre: "Gianni Vio",
    club: "Italia, Fiorentina, Tottenham, Watford",
    rol: "Pionero del balón parado (de la banca al fútbol)",
    lema: "«Hay infinitas rutinas: 4.830 sólo de córner». Imprevisibles y, sobre todo, psicológicas.",
    cifras: [{ valor: "17 de 44", texto: "goles del Catania en una temporada llegaron a balón parado", fuente: F.vio }],
    principios: [
      { titulo: "Variar para ser imprevisible", detalle: "«Siempre intentamos variar las rutinas, buscando ser imprevisibles».", fuente: F.vio },
      { titulo: "El 90 % es psicológico", detalle: "Movimientos al pitido, señuelos y pantallas para crear dudas y emparejamientos.", fuente: F.vio },
      { titulo: "Los que deciden son los jugadores", detalle: "«Los que de verdad marcan la diferencia son los jugadores».", fuente: F.vio },
    ],
    rutinas: [
      {
        id: "vio-barrera-falsa",
        nombre: "La barrera falsa",
        tipo: "falta",
        pasos: [
          "Al pitido se mueven seis jugadores.",
          "Dos cruzan por delante del área.",
          "Cuatro se meten y forman una segunda barrera, «falsa», que tapa al portero.",
          "Golpeo directo: así marcó Mascara al Torino.",
        ],
        contra: "Torino (Catania 2-1)",
        tarea: "Falta frontal: al pitido se mueven seis, dos cruzan por delante y cuatro forman la segunda barrera.",
        exito: "El portero pierde de vista el golpeo y el tiro sale a puerta en 3 de 5 intentos.",
        fuente: F.vio,
      },
    ],
    recursos: [{ titulo: "La Fiorentina apuesta por el gurú italiano del balón parado", original: "Fiorentina banking on Italy's set-piece guru", tipo: "artículo", url: F.vio.url, gratis: true, medio: F.vio.medio, fecha: F.vio.fecha }],
  },
  {
    id: "gronnemark",
    nombre: "Thomas Grønnemark",
    club: "Liverpool, Ajax, Midtjylland",
    rol: "Entrenador de saque de banda",
    lema: "Entre 40 y 60 saques por partido: no es un detalle, es una parte grande del juego.",
    cifras: [
      { valor: "45 → 68 %", texto: "balones conservados tras saque de banda bajo presión en el Liverpool en un año (del 18.º al 1.º)", fuente: F.gronnemark },
      { valor: "40-60", texto: "saques de banda por partido, 15-20 minutos de juego afectados", fuente: F.gronnemark },
    ],
    principios: [
      { titulo: "Salir de la presión", detalle: "El objetivo del saque es conservar: «¿cómo salimos de la presión?». Un primer pase que se pierde es un saque perdido.", fuente: F.gronnemark },
      { titulo: "Nunca a la línea", detalle: "Sacar recto por la banda es «lo peor que puedes hacer». Plano y preciso, no bombeado.", fuente: F.gronnemark },
      { titulo: "El largo, plano y rápido", detalle: "Un arma «muy, muy peligrosa» sólo con quien la saca larga, plana y rápida y un equipo fuerte en el área.", fuente: F.gronnemark },
      { titulo: "Movimiento y estrategia", detalle: "Sin movimiento ni plan, el saque regala el balón: hay que planear también la acción siguiente.", fuente: F.gronnemark },
    ],
    rutinas: [],
    recursos: [{ titulo: "Entrevista con el entrenador de saques de banda del Liverpool", original: "An Interview With Liverpool's Throw-In Coach", tipo: "entrevista", url: F.gronnemark.url, gratis: true, medio: F.gronnemark.medio, fecha: F.gronnemark.fecha }],
  },
  {
    id: "coulston",
    nombre: "Billy Coulston",
    club: "Newcastle (analista), Hudl",
    rol: "Analista y formador de balón parado",
    lema: "El balón parado dentro del modelo de juego: cuatro preguntas antes de dibujar nada.",
    cifras: [{ valor: "77 %", texto: "de córners en corto del Notts County desde la 19/20, el más alto de la League Two", fuente: F.coulston }],
    principios: [
      { titulo: "Integrar, no aislar", detalle: "El ABP ofensivo es trabajo con balón y el defensivo, sin balón: parte del modelo de juego.", fuente: F.coulston },
      {
        titulo: "Cuatro preguntas",
        detalle: "¿Qué queremos conseguir? ¿Qué estructura lo da? ¿Qué papel tiene cada uno? ¿Cuánto vamos a flexibilizar la idea?",
        fuente: F.coulston,
      },
      { titulo: "Contra los bloqueos, línea recta", detalle: "Salir en línea recta de cuatro o cinco cuesta al bloqueador cruzarse; o un defensor libre para el bloqueador.", fuente: F.tggBloqueos },
      { titulo: "Definir qué es gol de ABP", detalle: "Antes de mirar datos: un córner en corto con veinte pases después no es lo mismo.", fuente: F.coulston },
    ],
    rutinas: [],
    recursos: [
      { titulo: "Meter el balón parado en tu modelo de juego", original: "Incorporating set pieces into your game model", tipo: "artículo", url: F.coulston.url, gratis: true, medio: F.coulston.medio, fecha: F.coulston.fecha },
      { titulo: "Set Piece Masterclass (14 tipos de ABP, plantilla de rutinas)", tipo: "curso", url: "https://trainingground.guru/event/set-piece-masterclass", gratis: false, medio: "Training Ground Guru", fecha: "2024" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  LO QUE DICEN LOS DATOS (para la pestaña y para el banco de retos)   */
/* ------------------------------------------------------------------ */

export type Dato = { valor: string; texto: string; fuente: Fuente };

export const DATOS_CLAVE: Dato[] = [
  { valor: "0,14 · 0,08", texto: "goles esperados por remate directo: córner cerrado frente a abierto (Premier 22/23)", fuente: F.analystCorners },
  { valor: "20,8 % · 2,8 %", texto: "córners que acaban en remate directo: colgado frente a en corto", fuente: F.analystCorners },
  { valor: "0,27", texto: "goles esperados por remate en el centro del área pequeña (0,12 en el primer palo, 0,17 en el segundo)", fuente: F.analystCorners },
  { valor: "13,9 %", texto: "de todos los goles de la Premier 22/23 llegaron de córner", fuente: F.analystCorners },
  { valor: "0 goles", texto: "encajados de córner por West Ham y Liverpool en la 22/23: zona, todos atrás y seis en el área pequeña", fuente: F.plDefensa },
  { valor: "× 3", texto: "goles esperados por córner del Toulouse entre sus diez primeros y diez últimos partidos tras cambiar la rutina", fuente: F.hudl360 },
];

/* Los principios defensivos que no son de un referente sino de la liga. */
export const DEFENSA: Principio[] = [
  { titulo: "La zona está de moda y funciona", detalle: "Los mejores registros defensivos fueron de equipos con mucha zona; el peor (Bournemouth) marcaba sobre todo al hombre.", fuente: F.plDefensa },
  { titulo: "Llenar el área pequeña", detalle: "Liverpool: seis zonales en el área pequeña y uno en la línea delante del portero. Arsenal: dos en el primer palo, uno en el centro y uno en el segundo.", fuente: F.plDefensa },
  { titulo: "Un arco que protege al portero", detalle: "Manchester City: cinco en arco alrededor del portero, cuatro duelos uno contra uno y un libre en la frontal.", fuente: F.plDefensa },
  { titulo: "El hombre sufre contra los bloqueos", detalle: "Los equipos que marcan al hombre son los que más sufren a los bloqueadores (Forest encajó cinco así).", fuente: F.plDefensa },
  { titulo: "Adelantar al primer zonal", detalle: "El City adelantó su primer zonal y sumó uno más en la zona amenazada: la peinada del primer palo dejó de funcionar.", fuente: F.tfaChelsea },
];
