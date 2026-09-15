/**
 * LA AYUDA DE CADA PANTALLA.
 *
 * Una plataforma con cuarenta pantallas y doscientas métricas tiene un
 * problema que no se arregla con más gráficos: **nadie se acuerda de cómo se
 * calcula lo que está mirando**. Y una métrica que no se sabe leer no se usa,
 * o peor, se usa mal.
 *
 * Esto es la chuleta. No es documentación: es lo que hace falta saber para
 * leer la pantalla que se tiene delante, en filas de una línea. La regla al
 * escribirla es que **quepa de un vistazo**: si una explicación necesita un
 * párrafo, es que el gráfico está mal hecho y lo que hay que arreglar es el
 * gráfico.
 *
 * Cada entrada dice tres cosas y ninguna más:
 *
 *   - **De dónde sale** el dato (qué hoja, qué informe, quién lo escribe).
 *   - **Qué significa** cada cifra de la pantalla.
 *   - **Cómo se calcula**, cuando hay cuenta de por medio.
 */

export type FilaAyuda = {
  /** El nombre tal y como aparece en pantalla. */
  que: string;
  /** Qué es, en una línea. */
  es: string;
  /** La cuenta, cuando la hay. */
  cuenta?: string;
};

export type BloqueAyuda = {
  titulo: string;
  filas: FilaAyuda[];
};

export type AyudaDePagina = {
  /** La ruta, sin barra final. */
  ruta: string;
  titulo: string;
  /** Una línea: qué es esta pantalla. */
  resumen: string;
  /** De dónde salen los datos. */
  origen: string;
  bloques: BloqueAyuda[];
  /** Lo que conviene no olvidar al leerla. */
  ojo?: string[];
};

/* Lo que se repite en varias pantallas, escrito una vez. */
const PERCENTIL: FilaAyuda = {
  que: "Percentil (p00–p100)",
  es: "Cuántos quedan por debajo, con el sentido de la métrica ya puesto",
  cuenta: "p70 = mejor que el 70 % de los comparables. En PPDA o pérdidas, «mejor» es menos",
};

const XG: FilaAyuda = {
  que: "xG",
  es: "Lo que valían las ocasiones, entraran o no",
  cuenta: "Suma de la probabilidad de gol de cada remate",
};

export const AYUDAS: AyudaDePagina[] = [
  /* ==================== DATA ANÁLISIS ==================== */
  {
    ruta: "/data-analisis",
    titulo: "Data Análisis",
    resumen:
      "Lo que dicen los informes de Wyscout y Opta, más nuestro balón parado y el cruce con los entrenamientos.",
    origen:
      "public/data — wys/ son los informes de Wyscout (un .xlsx por equipo) y opta/ sus descargas. El balón parado sale de nuestras cuatro hojas y los entrenamientos, de la hoja de microciclos.",
    bloques: [
      {
        titulo: "Las nueve áreas",
        filas: [
          { que: "Partido en el campo", es: "Cada cifra puesta donde ocurre, el partido contra nuestra media" },
          { que: "Nuestra historia", es: "El Castilla contra sus seis temporadas" },
          { que: "Contra la liga", es: "Percentiles contra los 20 equipos, por fase de juego" },
          { que: "Todos contra todos", es: "La liga ordenada y el cruce de dos métricas" },
          { que: "Los más destacados", es: "Quién se sale de la categoría y en qué, equipos y jugadores" },
          { que: "Acción por acción", es: "El log de Opta: quién, cuándo y tras cuánto tiempo" },
          { que: "Jugador a jugador", es: "Cada uno contra la categoría, y su evolución de un año a otro" },
          { que: "Nuestro balón parado", es: "Las 500 acciones que registramos a mano" },
          { que: "Entrenamiento y partido", es: "Los microciclos cruzados con los informes" },
        ],
      },
      {
        titulo: "Cómo se calcula",
        filas: [
          PERCENTIL,
          XG,
          {
            que: "Un cociente (acierto %, cuota %)",
            es: "Se recalcula sumando los dos lados de todos los partidos",
            cuenta: "Σ aciertos ÷ Σ intentos — nunca la media de los porcentajes de cada partido",
          },
          {
            que: "PPDA",
            es: "Pases que se le dejan dar al rival antes de una acción defensiva",
            cuenta: "Menos es presionar más",
          },
          {
            que: "Cambio contra la referencia (campogramas)",
            es: "Cuánto se separó una cifra, tal cual; el sentido lo lleva el color, no el signo",
            cuenta: "(valor − referencia) ÷ referencia × 100 · verde = mejor, naranja = peor",
          },
          {
            que: "La referencia del segundo campo",
            es: "Se elige: nuestra media de la temporada o la de un equipo medio de la liga",
            cuenta: "La de la liga son todas las filas de todos los equipos juntas",
          },
          {
            que: "«Del rival»",
            es: "Lo que concedemos no es una columna: es la fila del contrario",
            cuenta: "El informe trae los dos equipos de cada partido",
          },
          {
            que: "Nivel de una fase",
            es: "Qué tal va un momento del juego contra la categoría",
            cuenta: "Media de las diferencias de sus métricas contra la mediana de la liga",
          },
          {
            que: "Evolución de un jugador",
            es: "Si ha mejorado respecto a sus iguales, no respecto a sí mismo",
            cuenta: "Percentil de este año − percentil del año pasado, cada uno contra su categoría",
          },
          {
            que: "Aspecto (Los más destacados)",
            es: "Dos o tres métricas que dicen lo mismo; una sola se dispara con el rival de turno",
            cuenta: "Media de los percentiles de sus métricas · desviación = percentil − 50",
          },
          {
            que: "Se sale de la categoría",
            es: "Cuándo un aspecto deja de ser vaivén y es una manera de jugar",
            cuenta: "±20 puntos de percentil: por delante del 70 % o por detrás del 70 %",
          },
          {
            que: "Faltas por amarilla",
            es: "Lo que cuesta cada amonestación: la medida del «uso» de la falta",
            cuenta: "Σ faltas ÷ Σ tarjetas amarillas · alto es infringir barato",
          },
          {
            que: "Faltas recibidas / en contra",
            es: "No son columna del informe: salen de la fila del rival de cada partido",
          },
          {
            que: "Jugador destacado",
            es: "Con minutos bastantes y algo muy por encima de los de su puesto",
            cuenta: "≥ 60 % de los minutos posibles y percentil ≥ 80 entre los de su puesto de la liga",
          },
        ],
      },
      {
        titulo: "Cómo se actualiza (una vez por semana)",
        filas: [
          {
            que: "Sola, todas las semanas",
            es: "Una tarea de Windows lo hace los martes por la mañana y lo publica sin que nadie mire",
            cuenta: "Se instala una vez con scripts/instalar-tarea-wyscout.ps1; el registro queda en .cache/wyscout",
          },
          {
            que: "scripts/actualizar-wys.cmd",
            es: "Lo mismo a mano: doble clic, y pregunta antes de publicar. Para un partido entre semana",
            cuenta: "Tarda entre cinco y diez minutos; abre un Chrome aparte que se mueve solo",
          },
          {
            que: "La contraseña de Wyscout",
            es: "La escribes tú en esa ventana la primera vez; el proceso no la pide ni la guarda",
            cuenta: "La sesión se queda en un perfil aparte y a la semana siguiente arranca ya dentro",
          },
          {
            que: "Los informes de equipo",
            es: "Un .xlsx por equipo del grupo, con MOSTRAR = ALL",
            cuenta: "Se guardan como «Team Stats <equipo>.xlsx»",
          },
          {
            que: "Los jugadores de la categoría",
            es: "Salen de «Advanced Search», no de la ficha del equipo, y bajan por lotes",
            cuenta: "Wyscout corta cada exportación en 500 filas: por eso siete equipos por fichero",
          },
          {
            que: "Publicar",
            es: "Es lo que hace que la plataforma lo vea: sin eso se queda en este ordenador",
            cuenta: "El .cmd lo pregunta al final; Vercel tarda un par de minutos",
          },
        ],
      },
      {
        titulo: "Opta, que no es lo mismo",
        filas: [
          {
            que: "El acumulado de 100 partidos",
            es: "Es la categoría entera, no el Castilla",
            cuenta: "Se reconoce porque los duelos dan 50,0 % y los goles a favor igualan a los de contra",
          },
          { que: "El de 3 partidos", es: "Ése sí es el Castilla, con las mismas columnas" },
          { que: "El log de eventos", es: "Sólo acciones sin balón: no hay ni un pase ni un remate" },
        ],
      },
    ],
    ojo: [
      "Con 2 o 3 jornadas todo son indicios, no tendencias.",
      "El balón parado propio lo registramos nosotros: no sale de Wyscout ni de Opta, y no hay liga con la que compararlo.",
      "En el percentil del jugador no entran los que no llegan a 90 minutos.",
      "Si una pantalla enseña la jornada pasada, lo que falta es publicar: bajar los datos no los sube.",
      "Si los datos se quedan atrás varias semanas, mira .cache/wyscout: casi siempre es que hay que volver a entrar en Wyscout una vez.",
    ],
  },

  /* ==================== MICROCICLOS ==================== */
  {
    ruta: "/microcycles",
    titulo: "Microciclos",
    resumen: "Cada tarea de cada sesión, con su contenido, su carga y su nota.",
    origen: "Hoja de microciclos, una fila por tarea. La escribe el cuerpo técnico.",
    bloques: [
      {
        titulo: "Las cifras de cabecera",
        filas: [
          { que: "Tiempo total", es: "Suma de los minutos de todas las tareas filtradas" },
          {
            que: "Carga física",
            es: "La suma de la carga anotada en cada tarea",
            cuenta: "El «/tarea» de debajo es esa suma ÷ nº de tareas",
          },
          { que: "Carga cognitiva", es: "Lo mismo con la columna cognitiva" },
          {
            que: "Ratio cog/fís",
            es: "Si la semana pide más cabeza o más piernas",
            cuenta: "Carga cognitiva ÷ carga física. Por encima de 1, sesgo cognitivo",
          },
          {
            que: "Evaluación media",
            es: "La nota que el staff pone a cada tarea, de 1 a 10",
            cuenta: "Sólo cuentan las tareas evaluadas",
          },
        ],
      },
      {
        titulo: "Cómo se ordena",
        filas: [
          { que: "MD-5 … MD", es: "Días contando hacia atrás desde el partido. MD es el día de partido" },
          { que: "Fase", es: "Ofensiva, defensiva, transiciones, ABP, competición" },
          { que: "Formato", es: "8v8+3 = ocho contra ocho más tres comodines" },
        ],
      },
    ],
    ojo: [
      "«Competición excluida» quita los partidos del cómputo: un amistoso de 90 minutos tapa el reparto de la semana.",
    ],
  },

  /* ==================== BALÓN PARADO ==================== */
  {
    ruta: "/setpieces",
    titulo: "ABP Ofensivo",
    resumen: "Córners y faltas a favor, acción por acción.",
    origen: "Nuestra hoja de ABP ofensivo. Una fila por acción, registrada a mano.",
    bloques: [
      {
        titulo: "Qué mide cada cosa",
        filas: [
          {
            que: "Peligro",
            es: "La acción acabó en gol u ocasión clara",
            cuenta: "Resultado final de rango 4 o 5: Ocasión o Gol",
          },
          { que: "Con remate", es: "Qué parte de las jugadas termina en disparo" },
          XG,
          {
            que: "Segundo balón",
            es: "Quién gana el rechace tras el primer contacto",
            cuenta: "Ganado / perdido / no hubo, siempre desde nuestro lado",
          },
          { que: "Calidad del envío", es: "Nota de 1 a 4 que pone quien registra" },
          { que: "Zona de caída", es: "Dónde cae el balón: primer palo, central, segundo, penalti…" },
          { que: "Rutina", es: "La jugada ensayada que se buscaba. Es lo que no tiene ningún informe comprado" },
        ],
      },
    ],
    ojo: [
      "La mayoría de lo registrado es pretemporada, contra equipos de otra categoría: sepáralo antes de sacar conclusiones.",
    ],
  },
  {
    ruta: "/setpieces_def",
    titulo: "ABP Defensivo",
    resumen: "Córners y faltas en contra, acción por acción.",
    origen: "Nuestra hoja de ABP defensivo.",
    bloques: [
      {
        titulo: "Qué mide cada cosa",
        filas: [
          {
            que: "Peligro concedido",
            es: "La acción del rival acabó en gol u ocasión suya",
            cuenta: "Ojo: en esta hoja el sujeto de «Ocasión» es el rival, no nosotros",
          },
          { que: "Con remate", es: "Qué parte de lo que conceden acaba en disparo" },
          { que: "Segundo balón", es: "Ganarlo aquí es cortar la jugada antes de la segunda ola" },
          { que: "Nº de atacantes", es: "Cuántos mete el rival al área" },
        ],
      },
    ],
    ojo: [
      "«Gol RMCF» y «Transición Ofensiva» son nuestros: se marcan a mano porque el sujeto por defecto es el rival.",
    ],
  },
  {
    ruta: "/throw-ins",
    titulo: "Saque de Banda Ofensivo",
    resumen: "Cada saque de banda a favor y en qué acabó.",
    origen: "Nuestra hoja de saque de banda ofensivo.",
    bloques: [
      {
        titulo: "Qué mide cada cosa",
        filas: [
          { que: "Zona de saque", es: "Zona 1 (nuestro campo), 2 (medio), 3 (campo rival)" },
          {
            que: "Retención",
            es: "El balón sigue siendo nuestro después del saque",
            cuenta: "Por debajo de la mitad, el saque es una pérdida con otro nombre",
          },
          { que: "Progresión", es: "El envío gana metros en vez de retroceder" },
          { que: "Conquista de último tercio", es: "El saque acaba con el balón en zona de ataque" },
        ],
      },
    ],
  },
  {
    ruta: "/throw-ins-def",
    titulo: "Saque de Banda Defensivo",
    resumen: "Cada saque de banda del rival y en qué acabó.",
    origen: "Nuestra hoja de saque de banda defensivo.",
    bloques: [
      {
        titulo: "Qué mide cada cosa",
        filas: [
          { que: "Retención del rival", es: "Cuántos saques conserva él. Cuanto menos, mejor defendemos la banda" },
          { que: "Peligro concedido", es: "Saques suyos que acaban en ocasión o gol" },
          { que: "Receptor", es: "A quién se la ponen: primera línea, medios, 9, extremo" },
        ],
      },
    ],
  },
  {
    ruta: "/abp-microciclo",
    titulo: "Microciclo ABP",
    resumen: "Qué se trabaja de balón parado cada día de la semana y cómo se nota.",
    origen: "Hoja del microciclo de ABP, cruzada con el partido de esa jornada.",
    bloques: [
      {
        titulo: "Cómo se lee",
        filas: [
          { que: "MD-4 … MD", es: "El día de la semana respecto al partido" },
          { que: "Minutos por contenido", es: "Cuánto tiempo se le da a cada tipo de jugada" },
          { que: "Cruce con el partido", es: "Lo ensayado esa semana contra lo que pasó el domingo" },
        ],
      },
    ],
  },

  /* ==================== INDIVIDUAL ==================== */
  {
    ruta: "/individual",
    titulo: "Plantilla",
    resumen: "La ficha de cada jugador: datos, fotos, situación y seguimiento.",
    origen: "Hoja JUGADORES, y las fotos desde Supabase.",
    bloques: [
      {
        titulo: "Cosas que conviene saber",
        filas: [
          {
            que: "El nombre manda sobre el ID",
            es: "Los JUG-XX se han renumerado alguna vez",
            cuenta: "Todo lo que cruza jugadores lo hace por nombre",
          },
          { que: "Dorsal", es: "Sale de su columna, no del orden de la fila" },
          { que: "Puesto", es: "Se corrige con lib/posiciones.ts: la hoja guarda números de rol" },
        ],
      },
    ],
  },
  {
    ruta: "/individual_proc",
    titulo: "Dashboard Seguimiento",
    resumen: "Cuánto se sigue a cada jugador y de qué se le habla.",
    origen: "Hoja de seguimiento, una fila por registro.",
    bloques: [
      {
        titulo: "Cómo se calcula",
        filas: [
          {
            que: "Cobertura",
            es: "Qué parte de la plantilla tiene algún seguimiento",
            cuenta: "Jugadores con registro ÷ jugadores en plantilla × 100",
          },
          {
            que: "Promedio",
            es: "Seguimientos por jugador",
            cuenta: "Sólo con los que siguen en plantilla: las sesiones de quien se fue no se reparten",
          },
        ],
      },
    ],
  },
  {
    ruta: "/dashboard-plantilla",
    titulo: "Dashboard Individual",
    resumen: "La plantilla comparada de un vistazo.",
    origen: "Hoja JUGADORES y hoja de seguimiento.",
    bloques: [
      {
        titulo: "Cómo se lee",
        filas: [PERCENTIL, { que: "Filtros por puesto", es: "Comparar un central con un extremo no dice nada" }],
      },
    ],
  },
  {
    ruta: "/ratings",
    titulo: "Valoraciones de Partido",
    resumen: "La nota que el staff pone a cada jugador en cada partido.",
    origen: "Hoja de valoraciones. La escribe el cuerpo técnico tras cada jornada.",
    bloques: [
      {
        titulo: "Cómo se calcula",
        filas: [
          { que: "Nota media", es: "Media de las notas de los partidos que ha jugado" },
          { que: "Tendencia", es: "Las últimas jornadas contra su propia media" },
        ],
      },
    ],
    ojo: ["Es una valoración subjetiva del staff, no una métrica: se lee junto a los datos, no en su lugar."],
  },
  {
    ruta: "/comparative_ind",
    titulo: "Comparativo U-21",
    resumen: "Nuestros jugadores contra los de su edad.",
    origen: "Hoja de comparativa y datos de plantilla.",
    bloques: [{ titulo: "Cómo se lee", filas: [PERCENTIL] }],
  },

  /* ==================== COMPETICIÓN ==================== */
  {
    ruta: "/collective_history",
    titulo: "Histórico Competición",
    resumen: "Cómo ha ido el rendimiento a lo largo del curso.",
    origen: "Hoja de histórico colectivo.",
    bloques: [
      {
        titulo: "Cómo se lee",
        filas: [
          { que: "La línea", es: "Jornada a jornada, en el orden en que se jugaron" },
          { que: "La raya de puntos", es: "La media de la temporada" },
        ],
      },
    ],
  },
  {
    ruta: "/match-preparation",
    titulo: "Plan de Partido",
    resumen: "La preparación de la próxima jornada.",
    origen: "Documentos propios y lo que se trae del análisis del rival.",
    bloques: [
      {
        titulo: "Cómo se guarda",
        filas: [
          { que: "Autoguardado", es: "Lo que se escribe se guarda solo, con copia local si falla la red" },
        ],
      },
    ],
  },
  {
    ruta: "/coding",
    titulo: "Coding de Partido",
    resumen: "Marcar las acciones del partido y sacar los clips.",
    origen: "El vídeo lo pone el usuario; los cortes se guardan en la plataforma.",
    bloques: [
      {
        titulo: "Los cuatro tiempos de un clip",
        filas: [
          { que: "Inicio y fin", es: "Lo que se exporta" },
          { que: "Antes y después", es: "El aire que se añade al corte" },
          { que: "Sin conexión", es: "El vídeo no se sube: se trabaja en local" },
        ],
      },
    ],
  },

  /* ==================== RIVAL ==================== */
  {
    ruta: "/rivals",
    titulo: "Plantillas Rivales",
    resumen: "Fichas e informes de los jugadores del rival.",
    origen: "Hoja RIVALES y datos de BeSoccer; los recursos, en Supabase.",
    bloques: [
      {
        titulo: "Cómo se lee",
        filas: [
          { que: "Once probable", es: "Se propone con los últimos onces del rival" },
          { que: "Etiquetas", es: "Las pone el analista; no salen de ningún dato" },
        ],
      },
      {
        titulo: "Las dos hojas del informe que no salen de BeSoccer",
        filas: [
          {
            que: "«Lo que le hace distinto»",
            es: "Hasta cuatro aspectos —dos o tres métricas cada uno— en los que se sale de la categoría",
            cuenta: "Percentil medio del aspecto entre los 20 equipos; sólo si se separa ±20 puntos",
          },
          {
            que: "«Sus jugadores destacados»",
            es: "Los suyos con minutos que se salen de los de su puesto en toda la liga",
            cuenta: "≥ 60 % de los minutos posibles y percentil ≥ 80; hasta seis",
          },
          {
            que: "Si no salen",
            es: "No hay informes bastantes de ese rival en public/data/wys",
          },
        ],
      },
    ],
  },
  {
    ruta: "/scout-rival-collective",
    titulo: "Scout Colectivo",
    resumen: "Cómo juega el rival como equipo.",
    origen: "Análisis propio más los datos de la categoría.",
    bloques: [{ titulo: "Cómo se lee", filas: [PERCENTIL] }],
  },
  {
    ruta: "/scout-rival-abp",
    titulo: "ABP del Rival",
    resumen: "Su balón parado: córners, faltas, bandas y amenaza aérea.",
    origen:
      "Scouting propio (se registra en la propia página) o, si no lo hay, lo que se deduce de nuestras cuatro hojas de ABP.",
    bloques: [
      {
        titulo: "Ojo con el origen",
        filas: [
          { que: "Scouting propio", es: "Sus partidos, con sacador y rematador. Es la vía buena" },
          { que: "Deducido", es: "Sólo los partidos contra nosotros. La página dice cuál está enseñando" },
        ],
      },
    ],
  },

  /* ==================== RENDIMIENTO Y OPERATIVA ==================== */
  {
    ruta: "/performance",
    titulo: "Área Condicional",
    resumen: "El trabajo físico y su control.",
    origen: "Documentos y hojas del área condicional.",
    bloques: [
      {
        titulo: "Cómo se lee",
        filas: [{ que: "Semana", es: "La carga se organiza por semanas del curso" }],
      },
    ],
  },
  {
    ruta: "/desplazamiento",
    titulo: "Desplazamiento de Partido",
    resumen: "El dossier del viaje y el horario del día.",
    origen: "Se escribe aquí; se guarda solo.",
    bloques: [
      {
        titulo: "Cómo funciona",
        filas: [
          { que: "Días", es: "Un viaje puede tener uno o varios: cada día es una hoja A4" },
          {
            que: "Horario elástico",
            es: "Las citas relativas se recolocan si se mueve la hora del partido",
          },
        ],
      },
    ],
  },
  {
    ruta: "/emotion",
    titulo: "Emocional",
    resumen: "El estado del grupo y de cada jugador.",
    origen: "Registro propio del cuerpo técnico.",
    bloques: [
      {
        titulo: "Cómo se lee",
        filas: [{ que: "La escala", es: "Es una apreciación, no una medida: sirve para ver el cambio, no el nivel" }],
      },
    ],
  },
  {
    ruta: "/game-model",
    titulo: "Identidad de Juego",
    resumen: "Los principios ofensivos y defensivos del modelo.",
    origen: "Hoja de principios.",
    bloques: [
      {
        titulo: "Cómo se organiza",
        filas: [
          { que: "Fase", es: "Ataque o defensa" },
          { que: "Bloque y apartado", es: "Del principio general al detalle" },
        ],
      },
    ],
  },

  /* ==================== LA PORTADA ==================== */
  {
    ruta: "/",
    titulo: "Portada",
    resumen: "El estado del equipo de un vistazo y la puerta a las 36 áreas.",
    origen:
      "Los informes de la categoría (Data Análisis) y las hojas de seguimiento, identidad y cultura. Ninguna cifra se escribe aquí.",
    bloques: [
      {
        titulo: "Las alertas",
        filas: [
          {
            que: "Qué sale",
            es: "Sólo lo que se separa de lo normal, a favor y en contra. Si un día no hay nada, no se pinta la tira",
          },
          {
            que: "A favor / a vigilar",
            es: "Las dos caras cuentan: lo que el equipo hace mejor que nadie también se trabaja",
          },
          {
            que: "Un aspecto de equipo",
            es: "Dos o tres métricas que dicen lo mismo, contra los 20 de la categoría",
            cuenta: "Aparece a partir de ±20 puntos de percentil",
          },
          {
            que: "Una métrica suelta",
            es: "El Castilla entre los mejores o los peores de la liga en algo con un sentido claro",
            cuenta: "Percentil ≥ 85 o ≤ 15; las de estilo no se juzgan",
          },
          {
            que: "Un jugador",
            es: "Con al menos el 60 % de los minutos, contra los de su puesto en toda la categoría",
            cuenta: "Percentil ≥ 95 para bien; tres métricas en el percentil 10 o menos para mal",
          },
          {
            que: "Seguimiento",
            es: "Jugadores sin registro reciente y cobertura de la plantilla",
            cuenta: "Avisa a partir de 45 días sin seguimiento",
          },
          {
            que: "«Al abrir»",
            es: "Qué mirar en la pantalla a la que lleva cada alerta",
          },
        ],
      },
    ],
    ojo: [
      "Con dos o tres jornadas, una alerta es un indicio: dice dónde mirar, no qué hacer.",
      "El orden es por cuánto se sale de lo normal, no por importancia: eso lo pone el cuerpo técnico.",
    ],
  },
];

const limpia = (ruta: string) => ruta.replace(/\/+$/, "") || "/";

/** La ayuda de una ruta, si la hay. */
export function ayudaDe(ruta: string): AyudaDePagina | null {
  const buscada = limpia(ruta);

  return (
    AYUDAS.find((a) => limpia(a.ruta) === buscada) ??
    /* Una subruta hereda la de su sección: /rivals/algo usa la de /rivals. */
    AYUDAS.find((a) => buscada.startsWith(limpia(a.ruta) + "/")) ??
    null
  );
}
