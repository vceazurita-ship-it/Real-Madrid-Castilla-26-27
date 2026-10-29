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
      "Lo que dicen los informes de Wyscout y Opta, más nuestro balón parado y el cruce con los entrenamientos. «Un equipo de un vistazo» resume cualquier equipo de la categoría —resultados, forma, sistema, fases, estilo, once tipo y plantilla— y abre con el próximo rival.",
    origen:
      "public/data — wys/ son los informes de Wyscout (un .xlsx por equipo) y opta/ sus descargas. El balón parado sale de nuestras cuatro hojas y los entrenamientos, de la hoja de microciclos.",
    bloques: [
      {
        titulo: "Las diez áreas",
        filas: [
          { que: "Partido en el campo", es: "Cada cifra puesta donde ocurre, el partido contra nuestra media" },
          { que: "Nuestra historia", es: "El Castilla contra sus seis temporadas" },
          { que: "Contra la liga", es: "Percentiles contra los 20 equipos, por fase de juego" },
          { que: "Todos contra todos", es: "La liga ordenada y el cruce de dos métricas" },
          { que: "Los más destacados", es: "Quién se sale de la categoría y en qué, equipos y jugadores" },
          { que: "Goles a balón parado", es: "Córner, falta y penalti, a favor y en contra: toda la liga y nuestras seis temporadas" },
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
            que: "Goles de córner y de falta (≈)",
            es: "Estimación: nadie publica de qué jugada nace cada gol de toda la liga; el penalti sí es dato",
            cuenta: "Goles sin penalti repartidos según el origen de los remates, corregido por lo que convierte cada vía en Opta (córner ×0,49 · falta y otras ×1,35)",
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
            /* Como la tarjeta, que ya no dice «Ratio Cog/Fís» (19/10/2026). */
            que: "Cognitiva / física",
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
    origen: "Hoja JUGADORES (plantilla y estado), hoja de controles de entrenamiento (último control) y sesiones registradas en Jugadores sesión (desde el 21/10).",
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
    titulo: "Comparativa con la categoría",
    resumen: "Cada jugador frente a los de su puesto en la categoría: sub-21, sub-23 o todos. Ranking, gráficos por fase del juego (con preguntas o dos métricas a elegir), ficha y «Contra otros equipos»: uno de los nuestros frente a los de su puesto de los equipos que elijas. El filtro de puesto de arriba manda también sobre el jugador abierto.",
    origen: "Descarga de jugadores de Wyscout de toda la categoría, nuestras valoraciones de partido y los seguimientos.",
    bloques: [{ titulo: "Cómo se lee", filas: [PERCENTIL] }],
  },

  /* ==================== COMPETICIÓN ==================== */
  {
    ruta: "/duelos",
    titulo: "Duelos",
    resumen: "Nuestro once contra el once probable del rival, duelo a duelo: centrales contra su nueve, laterales contra extremos, extremos contra laterales, la medular y nuestro nueve contra sus centrales. Dice dónde les podemos hacer daño y dónde nos lo pueden hacer.",
    origen: "Su once: el marcado en Plantillas rivales (si no, su último once de BeSoccer). El nuestro: los minutos de Wyscout en 4-2-3-1. Las métricas: descarga de jugadores de Wyscout de toda la categoría. Los dos onces se cambian hueco a hueco y se guardan por rival.",
    bloques: [{ titulo: "Cómo se lee", filas: [PERCENTIL] }],
  },
  {
    ruta: "/analisis-goles",
    titulo: "Análisis de goles",
    resumen: "Los goles de un equipo y de toda la liga por franjas de minutos (cada 15 y los descuentos aparte, o a medida), como local y como visitante, con los remates y el xG al lado, quién marca primero y la tipología de los goles de nuestros partidos.",
    origen: "Goles y minutos: BeSoccer, todos los partidos de liga. Remates, a puerta y xG: Wyscout (sin minuto). Tipología y remates por minuto: el timeline de Hudl de nuestros partidos y las grabaciones tácticas. Se actualiza cada noche con la jornada nocturna del ordenador del club (scripts/goles-liga.mjs).",
    bloques: [
      {
        titulo: "Cómo se lee",
        filas: [
          { que: "Por partido", es: "Las franjas se comparan por partido, porque el equipo y la liga no han jugado los mismos" },
          { que: "La raya de la gráfica", es: "Lo que marca un equipo medio de la liga en esa franja, con la misma condición" },
          { que: "Verde y naranja", es: "Mejor o peor que la liga en más de un 5 %" },
          { que: "45+ y 90+", es: "Los descuentos; sin «Descuentos aparte», cuentan en la última franja de cada parte" },
        ],
      },
      {
        titulo: "La tipología",
        filas: [
          { que: "Propuesta de Hudl", es: "ABP, segunda acción, tras error, transición (robo y ataque de 12 s o menos) o ataque organizado según el pase de gol" },
          { que: "Corregir", es: "Cada gol se cambia en la lista de abajo y lo elegido manda sobre la propuesta" },
          { que: "Banda D e I", es: "Vistas desde el equipo que ataca" },
        ],
      },
    ],
    ojo: [
      "Nadie publica de dónde viene cada gol del resto de la liga: de ellos sólo se sabe si fue de penalti o en propia puerta.",
      "Los partidos sin timeline en Hudl (hoy, el J2) salen sin clasificar: se eligen a mano.",
    ],
  },
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
        titulo: "Arriba",
        filas: [
          { que: "Lo esencial", es: "Las claves del apartado «Claves del partido», arriba del todo" },
          { que: "Informe", es: "Abre el Scout Colectivo y la pizarra de ABP, o imprime el plan" },
          { que: "Boceto", es: "Copia el plan de la jornada anterior con «?» en lo que puede cambiar y «*» en lo que se propone incorporar" },
          { que: "Replicar", es: "Copia el plan de otra jornada que se elija" },
        ],
      },
      {
        titulo: "Siglas del plan de juego",
        filas: [
          { que: "CP", es: "Ataque posicional u organizado" },
          { que: "CR", es: "Contraataque o transición" },
          { que: "ABP", es: "Acciones a balón parado" },
          { que: "PTO", es: "Portero" },
          { que: "Z1, Z2…", es: "Zonas del campo" },
        ],
      },
      {
        titulo: "Cómo se guarda",
        filas: [
          { que: "Autoguardado", es: "Lo que se escribe se guarda solo, con copia local si falla la red" },
        ],
      },
    ],
  },
  {
    ruta: "/pizarra-tactica",
    titulo: "Pizarra Táctica",
    resumen: "Dibujar una idea con fichas, flechas y escenas, y presentarla moviéndose.",
    origen: "Las fichas propias salen de la plantilla y las rivales de Plantillas rivales. El tablero «Once 4-2-3-1» se rellena solo cada semana con nuestro último once (Valoraciones) y el teórico del rival.",
    bloques: [
      {
        titulo: "Montar la jugada",
        filas: [
          { que: "Escenas", es: "Cada escena es un momento de la jugada; al reproducir, las fichas van de una a la siguiente" },
          { que: "Duplicar escena", es: "Copia la escena justo detrás: se mueven las fichas en la copia y ese es el movimiento" },
          { que: "Dibujo", es: "Coloca a un equipo en 4-4-2, 4-3-3… recolocando a los que ya están, cada uno al puesto más cercano" },
          { que: "Qué se cuenta", es: "La nota de la escena: sale bajo el campo a pantalla completa y en todo lo que se exporta" },
          { que: "Elegir varias", es: "Arrastrar sobre el césped vacío o Mayús + clic; luego se mueven, alinean, reparten o duplican juntas" },
          { que: "Medidas del bloque", es: "Con varias elegidas, el largo y el ancho que ocupan en metros", cuenta: "El campo de la pizarra es 100 × 68; el largo se pasa a 105 m" },
          { que: "Carriles", es: "Tercios y cinco carriles; los carriles salen del ancho del área grande y de la pequeña" },
        ],
      },
      {
        titulo: "Presentar y sacar",
        filas: [
          { que: "→ o AvPág", es: "Avanza a la siguiente escena moviéndose y se para; ← vuelve. Es lo que manda un mando de presentación" },
          { que: "Exportar", es: "PNG o copia de la escena, PDF y PowerPoint (una hoja por escena) y vídeo MP4 de la jugada, todo en 1920 × 1080" },
          { que: "Atajos", es: "La tecla ? enseña todos los atajos de teclado" },
        ],
      },
    ],
    ojo: [
      "Las fichas se emparejan entre escenas por su identidad: una ficha duplicada con Ctrl+D es otra ficha y no se anima desde la original.",
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
          { que: "Varios vídeos", es: "Cada vídeo entra solo con su corte de inicio a fin, y la exportación junta los de todos; en «Vídeos» se aparta el que sobre" },
          { que: "Carátula", es: "Se elige entre los sujetos o toda la plantilla y se guarda con la sesión; con vídeos «01-15_…» se propone sola la del dorsal 15" },
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
    origen: "Hoja RIVALES, BeSoccer y Wyscout de toda la categoría; los recursos, en Supabase.",
    bloques: [
      {
        titulo: "Cómo se lee",
        filas: [
          {
            que: "«Cómo llega»",
            es: "Tabla, su balance en el campo del partido, los últimos cinco de liga, el dibujo que más repite y quién le hace los goles",
            cuenta: "BeSoccer; el dibujo, contando sus últimas alineaciones bajadas",
          },
          {
            que: "«Lo que le hace distinto»",
            es: "Aspectos del juego en los que el equipo se sale de la categoría, en verde por arriba y en rojo por detrás",
            cuenta: "Percentil medio del aspecto entre los equipos de la categoría; sólo si se separa ±20 puntos (Wyscout)",
          },
          {
            que: "«Cómo juega» (en la ficha)",
            es: "Lo que más le separa de los de su puesto en la categoría: hasta tres por arriba y tres por abajo",
            cuenta: "Percentil contra su puesto con 90′ o más, esta temporada; sólo por encima de 70 o por debajo de 30. Con menos de 90′ no se compara",
          },
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
      {
        titulo: "Análisis visual de la jornada",
        filas: [
          { que: "Recoger la carpeta", es: "Pega la ruta de la carpeta de la jornada: el ordenador del club sube los vídeos (comprimidos) y los PDF a su sección" },
          { que: "Láminas", es: "Medio campo para dibujar cruces, balones, rótulos, flechas y zonas, con las fichas de sus jugadores" },
          { que: "PDF y PPT", es: "Sacan todas las láminas de la jornada; las conclusiones van al informe del microciclo de ABP" },
        ],
      },
    ],
  },
  {
    ruta: "/scout-rival-area",
    titulo: "Área del Rival",
    resumen: "Sus centros laterales: cómo atacan y cómo defienden el área.",
    origen: "La carpeta de centros de cada jornada y las láminas que se dibujan en la propia página.",
    bloques: [
      {
        titulo: "Cómo se prepara",
        filas: [
          { que: "Recoger la carpeta", es: "Con «CENTRO» en el nombre va a cómo atacan; con «DEF», a cómo defienden. El partido sale de «VS …»" },
          { que: "Láminas", es: "Perfil izquierdo y derecho: balones donde centran, cruces donde caen (roja cerrada, amarilla abierta) y los centradores" },
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
            es: "Al cambiar la hora del partido, el día del partido se mueve solo; los demás días van por reloj",
          },
          { que: "Horas", es: "Se escriben enteras («1830», «18.30») y se guardan al salir del campo; flechas ±5 min" },
          { que: "Copiar de otro viaje", es: "Cualquier viaje montado: el horario, los avisos, y el estadio y el hotel si es el mismo rival" },
          { que: "Citas rápidas", es: "Desayuno, comida, charla… de un toque y ya a su hora respecto al partido" },
          { que: "Copiar un día", es: "Se copia en un viaje y se pega en otro" },
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

  {
    ruta: "/data-analisis/once",
    titulo: "El once por tres fuentes",
    resumen:
      "La misma alineación contada por Wyscout, por Opta y por el cuerpo técnico, sin mezclarlas, y qué parejas se potencian.",
    origen:
      "Wyscout y Opta salen de la carpeta de datos; la valoración, de las notas que pone el cuerpo técnico en /ratings. La plantilla y los puestos, de la hoja de jugadores.",
    bloques: [
      {
        titulo: "Las tres fuentes",
        filas: [
          {
            que: "Wyscout",
            es: "Las 78 métricas por jugador. La barra es el percentil contra los de su puesto; el número, su valor de verdad",
            cuenta: "p78 = mejor que el 78 % de los de su puesto en la categoría",
          },
          {
            que: "Opta",
            es: "Lo que su registro de eventos permite contar: robos, rechaces y paradas. Son recuentos, no promedios",
          },
          {
            que: "Nuestra valoración",
            es: "La nota del cuerpo técnico y la forma de los cinco últimos partidos, con cuántos lleva valorados. Es la única que juzga en vez de contar",
          },
          {
            que: "Sinergias",
            es: "Pareja a pareja: si lo que hace uno le hace falta al otro (se potencian) o es lo mismo que ya hace el otro (se pisan). Compara perfiles; no mide lo que pasa cuando juegan juntos",
          },
        ],
      },
      {
        titulo: "Cómo se lee la rejilla",
        filas: [
          {
            que: "Los partidos",
            es: "Se elige uno, varios, los últimos 3 o 5, o toda la temporada. Recorta Opta, nuestra valoración y el peso en el equipo; los percentiles de Wyscout no, que son por temporada",
          },
          {
            que: "Qué se cuenta (Wyscout)",
            es: "Todo lo jugado, o una jornada suelta. La descarga de Wyscout es acumulada, así que la jornada sale de restar la foto de esta semana menos la de la anterior; se guarda una cada semana desde el 18/09/2026",
          },
          {
            que: "Los huecos",
            es: "Son los del 4-2-3-1: portero, cuatro atrás, dos pivotes, banda, mediapunta y banda, y el delantero",
          },
          {
            que: "Por líneas o uno a uno",
            es: "Por líneas, cada casilla es la media de esa línea; uno a uno, hay una columna por futbolista y no se promedia con nadie",
          },
          {
            que: "El puesto y el lado",
            es: "Salen de Wyscout —«LB» es lateral izquierdo, «RCB» central derecho— y de la hoja cuando no hay fila suya. Por eso cada uno cae en su banda",
          },
          {
            que: "Peso en el equipo",
            es: "Cruza las dos descargas de Wyscout: lo que hace cada uno por 90 minutos frente a lo que hace el equipo por partido. Es un reparto, no una nota",
          },
          {
            que: "El color",
            es: "Sale del sentido de la métrica, no del valor: en pérdidas, mucho no es bueno. Lo que no tiene «bueno» va en dorado",
          },
          {
            que: "Un guion",
            es: "Esa métrica no le dice nada a esa línea, o no hay con quién comparar",
          },
        ],
      },
    ],
    ojo: [
      "Las tres fuentes NO se mezclan ni se promedian entre sí: miden cosas distintas con escalas distintas, y una media entre un percentil y un 7,5 no significa nada.",
      "La vista de Opta es una muestra corta —del orden de diez acciones por jugador— y además la mitad de las acciones de su log llegan sin nombre. Los duelos y los fueras de juego nunca traen jugador, así que no se enseñan en vez de dar ceros que no son ceros.",
      "Las sinergias comparan perfiles, no rendimiento juntos: para lo segundo hacen falta alineaciones de muchos partidos y lo único que sabe quién jugó cada uno son nuestras valoraciones. En cuanto una pareja llegue a cinco partidos valorados juntos, la tarjeta compara su nota juntos y por separado.",
      "Un porcentaje sacado de una o dos acciones no lleva percentil ni entra en fortalezas: se enseña la cifra diciendo de cuántas acciones sale.",
      "Las tres primeras jornadas no se pueden ver sueltas: cuando se empezó a guardar la foto semanal ya venían sumadas en una sola fila, y de una suma no se saca el reparto.",
    ],
  },
  {
    ruta: "/quiniela",
    titulo: "La Quiniela de la Semana",
    resumen:
      "Los nueve partidos de la jornada —la liga sin el Castilla—, el 1-X-2 de cada uno y el ranking de acierto del cuerpo técnico.",
    origen:
      "El calendario de Primera RFEF grupo 2 viaja con la aplicación —38 jornadas que no cambian—. Los pronósticos y los resultados los escribe el cuerpo técnico aquí mismo; no salen de ninguna hoja.",
    bloques: [
      {
        titulo: "Cómo se rellena",
        filas: [
          {
            que: "Entrar",
            es: "Con tu correo. La primera vez, «Registrarme»: la contraseña es lo que va antes de la @, y conviene cambiarla. Cada uno pone sólo lo suyo",
          },
          {
            que: "Guardar mi apuesta",
            es: "Marcar un signo no guarda nada: se guarda con el botón. Se puede cambiar las veces que haga falta hasta el cierre",
          },
          {
            que: "El cierre",
            es: "El viernes de la semana de la jornada a las 12:00, hora de Madrid. Después no se puede tocar, y lo que no esté guardado cuenta como fallo",
          },
          {
            que: "El aviso",
            es: "Ese mismo viernes a las 9:00 llega un correo a todos los registrados con los partidos y una frase de leyenda",
          },
          {
            que: "Resultados",
            es: "Los mete cualquiera que haya entrado, sólo de partidos ya jugados, y se guardan al marcarlos",
          },
          {
            que: "1 · X · 2",
            es: "Gana el local, empate, gana el visitante. Volver a pulsar el mismo signo lo quita",
          },
          {
            que: "Quién juega",
            es: "Se cambia con el botón de arriba a la derecha. Entra y sale quien haga falta sin perder lo ya jugado",
          },
        ],
      },
      {
        titulo: "Cómo se cuenta el acierto",
        filas: [
          {
            que: "Acierto",
            es: "Los aciertos entre los partidos que YA se han jugado, no entre los nueve",
            cuenta: "3 aciertos de 3 jugados = 100 %, aunque falten seis por jugar",
          },
          {
            que: "Un partido sin resultado",
            es: "No cuenta para nadie, ni a favor ni en contra, hasta que se meta el resultado",
          },
          {
            que: "No pronosticar",
            es: "Cuenta como fallo, pero sólo cuando el partido ya se ha jugado",
          },
          {
            que: "Jornadas",
            es: "Las que se han ganado: acertar más que todos los demás. Si empatan dos, la ganan los dos",
          },
        ],
      },
    ],
    ojo: [
      "El ranking ordena por porcentaje y no por aciertos, para que quien se incorpore tarde no arranque con una desventaja imposible de remontar.",
      "Cada diez jornadas, los dos primeros del bloque comen invitados por el resto. Si hay empate en el segundo puesto, no paga ninguno de los empatados, salvo que así no pagase nadie; con cero aciertos no se invita a nadie.",
      "La contraseña de registro no es secreta —quien sabe tu correo la sabe—. Es un pestillo entre compañeros: cámbiala desde «Cambiar contraseña».",
    ],
  },

  /* ==================== APUESTAS DEL STAFF ==================== */
  {
    ruta: "/laboratorio/apuestas",
    titulo: "Apuestas del staff",
    resumen:
      "Uno lanza una predicción y dice qué se juega; los demás se ponen a favor o en contra, y el día señalado se comprueba quién tenía razón.",
    origen:
      "Las escribe el cuerpo técnico aquí mismo, con la misma cuenta que la quiniela. Viven en un documento propio de Supabase; no salen de ninguna hoja.",
    bloques: [
      {
        titulo: "Cómo se juega",
        filas: [
          {
            que: "Entrar",
            es: "Con la cuenta de la quiniela. Ver las apuestas no necesita entrar; lanzar, mojarse o dar el veredicto, sí",
          },
          {
            que: "Lanzar una apuesta",
            es: "La predicción, qué te juegas y el día en que se comprueba, que es mañana como pronto. Quien la lanza va a favor de sí mismo",
          },
          {
            que: "A favor · En contra",
            es: "Hasta el día antes de la comprobación. Se puede cambiar de bando o quitarse las veces que haga falta",
          },
          {
            que: "Toca comprobarla",
            es: "Desde el día señalado se cierran las posturas y cualquiera que haya entrado dice si acertó o falló. Se puede deshacer",
          },
          {
            que: "Retirarla",
            es: "Sólo el autor, y sólo mientras nadie se haya puesto a favor ni en contra",
          },
        ],
      },
      {
        titulo: "El marcador",
        filas: [
          { que: "Lanzadas", es: "Apuestas que ha tirado, resueltas o no" },
          { que: "Seguidas", es: "Veces que se ha mojado en las de otros" },
          {
            que: "Aciertos y fallos",
            es: "Sólo de las resueltas. Quien lanza acierta si se cumple; quien va a favor, con él; quien va en contra, si falla",
          },
          { que: "Balance", es: "Aciertos menos fallos", cuenta: "Ordena el marcador; a igual balance, más aciertos" },
        ],
      },
    ],
    ojo: [
      "Lo que se juega es lo que diga el autor y lo pagan los que se equivocan: la pantalla sólo lleva la cuenta.",
      "La fecha de comprobación es un tope, no una promesa: si la predicción ya se ha cumplido antes, hay que esperar a ese día para darla por acertada.",
    ],
  },

  /* ==================== LABORATORIO DE ABP (20/10/2026) ==================== */
  {
    ruta: "/laboratorio/abp",
    titulo: "Laboratorio de ABP",
    resumen:
      "Lo que hacen los mejores en balón parado, nuestras rutinas de la idea al partido y una competición de retos para la plantilla.",
    origen:
      "Los referentes son artículos y análisis publicados, cada uno con su enlace. Las rutinas y los retos se escriben aquí y viven en un documento propio de Supabase que sólo ve el administrador.",
    bloques: [
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Referentes", es: "Principios, rutinas y formación de Jover (Arsenal), Cueva (Chelsea), Brentford, Georgson, Vio, Grønnemark y Coulston, con buscador, la biblioteca de rutinas dibujadas y una ruta de aprendizaje gratuita. «Al taller» la lleva al taller ya colocada" },
          { que: "Taller", es: "La biblioteca de rutinas (ordenada por recientes, nombre o xG; duplicar y crear variantes desde la tarjeta) y, arriba, las tres que mejor encajan contra la defensa del próximo rival. Cada rutina se abre en una pizarra viva con cámara, línea de tiempo, defensa simulada, lecturas de ventaja y exportación" },
          { que: "Retos", es: "Retos de precisión (se apunta la marca de cada uno) y de preguntas (se proyectan en el vestuario, con teclado, pantalla completa y sonido opcional, y se marca quién acierta)" },
          { que: "Datos", es: "El balón parado de los equipos de Primera RFEF (los dos grupos) y de la Premier, con el gemelo de cada equipo en la Premier" },
        ],
      },
      {
        titulo: "La pizarra del taller",
        filas: [
          { que: "Colocar", es: "Arrastra a cada uno a su sitio de salida (con teclado: flechas, medio metro; con Mayúsculas, dos)" },
          { que: "Carreras", es: "Arrastra desde un jugador hasta donde acaba su carrera; un toque sin moverse la borra. La fase dice cuándo arranca: antes del saque, con el golpeo o al rechace" },
          { que: "Balón", es: "Cada toque añade un punto al recorrido; el primero es el golpeo. Doble toque quita un punto. El envío (tenso, bombeado, raso) decide la altura del vuelo" },
          { que: "Cámara", es: "Cenital, televisión o a pie de campo. Se edita igual en las tres; el balón vuela a su altura con su sombra en el césped" },
          { que: "Línea de tiempo", es: "Reproducir, pausa, velocidad (0,25× a 2×), bucle y saltos a salida, golpeo, remate y final" },
          { que: "Defensa", es: "El rival tipo de la rutina, el próximo rival (cómo defiende según su scouting de ABP, con sus jugadores más altos) o ninguna. Se mueve: el portero sigue al balón, los marcadores a su hombre y un bloqueo los frena" },
          { que: "Espacio y duelos", es: "Quién llega antes a cada metro del área, los huecos sin nadie y, en el remate, cada duelo aéreo con la diferencia de altura (Wyscout para los nuestros, la hoja de plantillas para los suyos)" },
          { que: "xG estimado", es: "La probabilidad de gol del remate según el sitio (geometría corregida con los remates a balón parado de nuestras hojas por zona), la marca que tiene el rematador y el duelo aéreo. Sirve para comparar rutinas, no es una medición" },
          { que: "Encaje automático", es: "La misma rutina contra zona, mixta y al hombre, y la defensa del próximo rival cuando su scouting la dice" },
          { que: "Exportar y presentar", es: "PNG, PDF por momentos, vídeo MP4 y GIF con rótulos; «Presentar» la pone a pantalla completa como una retransmisión. «?» enseña los atajos de teclado y Ctrl + Z deshace" },
          { que: "Encaje con el rival", es: "Lo que Wyscout mide del rival en ese tipo de balón parado: lo que concede si atacamos, lo que genera si defendemos, contra el resto de la liga" },
        ],
      },
      {
        titulo: "La clasificación",
        filas: [
          { que: "Puntos", es: "Precisión: la marca por los puntos de cada acierto. Preguntas: las acertadas por los puntos de cada pregunta" },
          { que: "Acierto", es: "Puntos sobre lo que podía sacar en los retos que jugó" },
          { que: "Racha", es: "Retos seguidos puntuando, contando desde el último que jugó" },
          { que: "Insignias", es: "Francotirador, Lector de juego, En racha, MVP y Siempre está: se ganan solas" },
        ],
      },
    ],
    ojo: [
      "Un reto de preguntas cuenta como jugado para quien se marca al empezar, aunque no acierte ninguna.",
      "El interruptor «Marcar para abrir» sólo deja apuntado que se abrirá a la plantilla: hoy la pantalla sigue siendo del administrador.",
    ],
  },

  /* ==================== ANÁLISIS DE ENTRENAMIENTO (19/10/2026) ==================== */
  {
    ruta: "/analisis-entrenamiento",
    titulo: "Análisis de entrenamiento",
    resumen:
      "Objetivos por jugador medidos en el vídeo de la sesión: cuántas acciones salieron bien y cuántas hay que mejorar, con clips, su evolución día a día y el mensaje para cada jugador.",
    origen:
      "Los objetivos y las validaciones los escribe el cuerpo técnico aquí (se guardan solos). El vídeo del día lo mira el ordenador del club al pulsar «Analizar»: la cámara táctica de la carpeta SESIONES o, si no está, el entrenamiento subido a Hudl con la fecha en el título. Las tareas salen del registro de tareas.",
    bloques: [
      {
        titulo: "El día",
        filas: [
          { que: "Objetivo", es: "Qué se busca, de quién, cómo reconocerlo (peto, dorsal) y qué es correcto o mejorable" },
          { que: "Tarea del día", es: "En qué tarea del registro mirarlo (L-T1…). No cambia lo que mira el vídeo" },
          { que: "Meta", es: "El porcentaje de correctas que se pide", cuenta: "Cumplida si el acierto llega a la meta (sólo con 8 acciones o más)" },
          { que: "De dónde sale", es: "Seguimiento individual, «Qué toca» del post… para saber por qué se mide" },
          { que: "Analizar", es: "Lo pide al ordenador del club; tarda de media hora a una hora y se puede cerrar la pantalla" },
        ],
      },
      {
        titulo: "Las cuentas",
        filas: [
          { que: "9 de 14 correctas", es: "Correctas entre las acciones que cuentan (todas menos las descartadas)" },
          { que: "(11 validadas)", es: "Cuántas de esas ha mirado alguien. Las demás cuentan con lo que se propuso solo" },
          { que: "Acierto", es: "Porcentaje de correctas", cuenta: "correctas ÷ acciones que cuentan; sólo con 8 o más" },
          { que: "Tendencia", es: "Menos de 8 acciones: se da la cuenta, no el porcentaje" },
          { que: "Sesión anterior", es: "El mismo objetivo (mismo texto) el último día analizado", cuenta: "mejora o baja = 5 puntos o más de diferencia" },
          { que: "Borde continuo / discontinuo", es: "Acción validada / propuesta automática sin validar" },
        ],
      },
      {
        titulo: "Por jugador",
        filas: [
          { que: "Evolución", es: "Cada objetivo suyo sesión a sesión, con la anterior, el sentido y sus clips" },
          { que: "Tu sesión", es: "Dos frases, su cuenta frente a la meta y su clip correcto y su clip mejorable, para WhatsApp" },
          { que: "Abrir su chat", es: "Abre WhatsApp con el mensaje escrito; lo mandas tú. El móvil sólo se recuerda en ese aparato" },
        ],
      },
    ],
    ojo: [
      "Con varios jugadores en un objetivo, a cada uno sólo se le cuentan las acciones en las que se le nombra.",
      "Para ver la evolución, el objetivo tiene que llamarse igual cada día: «Copiar los del último día» lo deja igual.",
      "Valida antes de mandar «Tu sesión»: lo no validado es una propuesta.",
    ],
  },

  /* ==================== LA PORTADA ==================== */
  {
    ruta: "/",
    titulo: "Portada",
    /* Sin número de áreas: era «36» y ya no lo era (19/10/2026). */
    resumen: "El próximo partido, la semana de trabajo, el estado del equipo de un vistazo y la puerta a todas las áreas.",
    origen:
      "El calendario de la liga (se pone al día cada noche), la hoja de registro del microciclo, los informes de la categoría (Data Análisis) y las hojas de seguimiento, identidad y cultura. Ninguna cifra se escribe aquí.",
    bloques: [
      {
        titulo: "El próximo partido",
        filas: [
          {
            que: "La tira de días",
            es: "Del día después del partido anterior al del próximo; el de hoy va en dorado y el del partido, recuadrado",
            cuenta: "MD = día de partido; MD-3 = tres días antes del partido",
          },
          {
            que: "«libre»",
            es: "Día sin tareas en el microciclo escrito. Si aún no hay microciclo, es la propuesta habitual",
          },
          {
            que: "Pinchar un día",
            es: "Abre su sesión para poner minutos, intensidad y valoración, o un seguimiento individual o de grupo",
          },
          {
            que: "Los botones",
            es: "Abren la plantilla, el plan, el scout y la pizarra de ABP ya con el rival puesto",
          },
          {
            que: "Últimos",
            es: "Los cinco últimos resultados, del más antiguo al más reciente",
            cuenta: "V ganado · E empatado · D perdido",
          },
        ],
      },
      {
        titulo: "Las cifras",
        filas: [
          {
            que: "xG por partido",
            es: "Goles esperados: lo que valían las ocasiones que generamos, por partido, y nuestro puesto en la categoría",
          },
          {
            que: "Goles − xG",
            es: "Positivo: marcamos más de lo que valían las ocasiones. Negativo: fallamos de más",
          },
          {
            que: "Seguimientos y cobertura",
            es: "Sólo los jugadores de campo con licencia del Castilla, igual que el Dashboard Seguimiento",
            cuenta: "Cobertura = jugadores con algún seguimiento ÷ jugadores de la plantilla",
          },
          {
            que: "«—»",
            es: "La hoja no ha contestado; debajo sale «Reintentar». No es un cero",
          },
        ],
      },
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

  /* ==================== JUGADORES SESIÓN (21/10/2026) ==================== */
  {
    ruta: "/jugadores-sesion",
    titulo: "Jugadores sesión",
    resumen: "Los equipos de cada tarea del día, a partir de la lista del delegado, listos para proyectar o mandar.",
    origen: "La lista que se pega (título, listado y apartados de bajas). Los puestos salen de la plantilla y de dónde coloca el cuerpo técnico a cada uno.",
    bloques: [
      {
        titulo: "Hacer los equipos",
        filas: [
          { que: "Proponer equipos", es: "Reparte a todos los que hacen la tarea en equipos parejos", cuenta: "Porteros separados; laterales, centrales, medios y puntas repartidos; los comodines rotan entre quienes menos lo han sido" },
          { que: "Completar", es: "Coloca sólo a los que faltan, en el equipo más corto, sin mover a nadie" },
          { que: "Como la anterior", es: "Copia los equipos, colores y comodines de la tarea de antes" },
          { que: "Soltar encima de otro", es: "«Cambiar»: los dos se intercambian el sitio. «Compartir puesto»: van juntos en el mismo hueco" },
          { que: "Teclado", es: "Con un jugador elegido: 1-6 equipo, C comodín, F fuera, 0 sin colocar. Ctrl+Z deshace, Ctrl+Y rehace" },
        ],
      },
      {
        titulo: "El validador",
        filas: [
          { que: "Punto rojo", es: "Falta alguien por colocar, hay un equipo vacío o un nombre repetido en la lista" },
          { que: "Punto ámbar", es: "Equipos o líneas descompensados, porteros juntos, colores repetidos o comodines de más o de menos", cuenta: "Línea descompensada: dos o más de diferencia entre equipos en defensas, medios, extremos o delanteros" },
          { que: "Com. y Fuera", es: "En la plantilla del día, en cuántas tareas ha sido comodín o no ha participado cada uno" },
        ],
      },
      {
        titulo: "Mandarlo",
        filas: [
          { que: "Esta / Todas", es: "Imágenes .jpg a 1920×1080, una por tarea (dos si hay cambio a mitad)" },
          { que: "PDF", es: "Todas las diapositivas en un solo archivo, una por página" },
          { que: "Texto", es: "Los equipos en texto para el grupo de WhatsApp, un equipo por línea" },
        ],
      },
    ],
    ojo: [
      "Los lesionados empiezan fuera de cada tarea; si alguno hace una, se le mete en un equipo y el validador lo señala.",
      "Volver a pegar la lista manda: quien no esté en ella sale de todas las tareas.",
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
