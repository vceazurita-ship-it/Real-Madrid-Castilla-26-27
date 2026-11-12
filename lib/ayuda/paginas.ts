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

import { MAGNITUDES, NOMBRE_FUENTE, type Fuente } from "@/lib/fuentes";

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
  /**
   * Cuándo se repasó esta ayuda contra la pantalla («2026-11-12»). La mira
   * `scripts/ayuda-al-dia.mjs`: si la pantalla cambió después, avisa.
   * Regla (12/11/2026, el analista): todo cambio de una pantalla actualiza su
   * ayuda y esta fecha en el mismo commit.
   */
  revisada?: string;
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

/*
| DE DÓNDE SALE CADA DATO (10/11/2026, fase 3 de Wyscout + Opta). Se escribe
| desde el diccionario de `lib/fuentes.ts`: si una magnitud cambia de fuente
| principal allí, la ayuda cambia sola.
*/
const nombresDe = (fuente: Fuente, ambito: "equipo" | "jugador") =>
  MAGNITUDES.filter((m) => m.principal === fuente && m.ambito === ambito)
    .map((m) => m.nombre.charAt(0).toLowerCase() + m.nombre.slice(1))
    .join(", ");

const DE_DONDE_SALE: BloqueAyuda = {
  titulo: "De dónde sale cada dato",
  filas: [
    { que: `Manda ${NOMBRE_FUENTE.opta}`, es: nombresDe("opta", "equipo"), cuenta: "Los 40 equipos de la categoría, evento a evento" },
    {
      que: `Manda ${NOMBRE_FUENTE.wyscout}`,
      es: `${nombresDe("wyscout", "equipo")}; el perfil del jugador, el once y el sistema`,
      cuenta: "78 métricas de jugador con percentil contra su puesto",
    },
    { que: "Segunda lectura", es: "La cifra de la otra fuente, en pequeño al lado. Nunca se promedian ni se mezclan en un percentil" },
    { que: "El sello", es: "Debajo de cada cifra: fuente, con quién se compara y hasta dónde llega", cuenta: "«Opta · grupo (20 equipos) · J11 · 11 partidos»" },
    {
      que: "Nota de método",
      es: "Sólo si las dos fuentes se separan más del umbral; por debajo es ruido de modelo y no se comenta",
      cuenta: "xG: más de un 15 % o de 0,3 por partido; posesión y porcentajes: más de 5 puntos",
    },
    {
      que: "Se llaman igual, no son lo mismo",
      es: MAGNITUDES.filter((m) => !m.mismaCosa && m.ambito === "equipo")
        .map((m) => `${m.nombre.toLowerCase()} (${m.porQueDifiere})`)
        .join("; "),
    },
  ],
};

export const AYUDAS: AyudaDePagina[] = [
  /* ==================== DATA ANÁLISIS ==================== */
  {
    ruta: "/data-analisis",
    titulo: "Análisis de datos",
    resumen:
      "Una sola área de datos, por pregunta y no por proveedor: el partido (post y directo), nuestro equipo, los jugadores, el rival y la categoría, el balón parado y el entrenamiento. Cada cifra sale de la fuente que mejor la mide y lo dice en un sello pequeño. Lo que antes era el «Área Opta» (/opta) está repartido aquí, cada pestaña en su bloque.",
    origen:
      "public/data — wys/ son los informes de Wyscout (un .xlsx por equipo) y opta/ sus descargas. El balón parado sale de nuestras cuatro hojas y los entrenamientos, de la hoja de microciclos.",
    bloques: [
      {
        titulo: "Siete bloques: el partido, resumen, nuestro equipo, jugadores, rival y categoría, balón parado, entreno e identidad",
        filas: [
          { que: "El partido", es: "«Post del partido» (lo que se abre) y «En directo»: las cifras del partido del día mientras se juega, que se ponen al día solas cada minuto" },
          { que: "Lecturas", es: "Cuando dos áreas contestaban lo mismo van en un botón con dos o tres lecturas; la primera es la que se abre" },
          { que: "Sello de fuente", es: "Debajo del título: de qué fuente sale, con quién se compara y hasta qué jornada llega. Opta manda en xG, remates, presión, balón parado y estilo; Wyscout en el perfil del jugador, el once y los duelos" },
          { que: "Resumen", es: "Lo primero que se abre: las claves de la jornada, cada una con el botón que lleva a donde se ve entera, y el mapa de toda la sección. Arriba a la derecha, el buscador de áreas" },
          { que: "Escala del percentil", es: "La misma en todas las áreas: verde P60 o más, oro en la media, naranja P40 o menos" },
          { que: "Partido en el campo", es: "Dos lecturas: por momentos (campograma) y pase a pase (red de pases, pases que hacen avanzar, recuperaciones y pérdidas por altura)" },
          { que: "Contra la liga", es: "Dos lecturas: lo esencial por fase (puesto y percentil en el grupo, y partido a partido contra su media) y métrica a métrica contra los 20 equipos" },
          { que: "Nuestra historia", es: "Dos lecturas: temporada a temporada y jornada a jornada contra nuestros rivales y la media" },
          { que: "Nuestros remates", es: "El mapa de remates del Castilla, a favor y en contra" },
          { que: "Jugador a jugador", es: "Dos lecturas: dentro de la plantilla y por 90′ contra los de su puesto en la categoría (al pinchar uno, su ficha)" },
          { que: "Buscador de la categoría", es: "Jugadores de la categoría por puesto, edad, minutos y una métrica por 90" },
          { que: "Talento y goles que valen", es: "Dispersión de percentiles con la zona élite, ranking por perfil, goles que dan puntos y goles desde el banquillo" },
          { que: "Un equipo de un vistazo", es: "Tres lecturas de cualquier equipo: de un vistazo, jornada a jornada y sus remates; abre con el próximo rival" },
          { que: "Todos contra todos", es: "Dos lecturas: la tabla de toda la liga con las columnas que se elijan (y el cruce de dos) y una métrica ordenada" },
          { que: "Estilos de juego", es: "Quién aprieta y cuándo en toda la liga, el Venn de dominio, peligro y solidez y la radiografía de 22 métricas de cualquier equipo" },
          { que: "Cualquier partido", es: "Cualquier partido de la categoría: el cara a cara, el momentum por tramos de 5′ y los remates de los dos" },
          { que: "Penaltis", es: "Cada penalti en la portería, con lanzadores y porteros, y los equipos a favor y en contra" },
          { que: "Datos del rival", es: "El enlace de «Rival y categoría» lleva al Scout colectivo, donde están los datos del rival de la semana juntos" },
          { que: "Los más destacados", es: "Quién se sale de la categoría y en qué, equipos y jugadores" },
          { que: "Goles a balón parado", es: "Córner, falta y penalti, a favor y en contra: toda la liga y nuestras seis temporadas" },
          { que: "ABP de la categoría", es: "Cada gol a balón parado de la Primera RFEF (grupo 2, grupo 1 o los dos), con su tipo, dónde cayó el balón, desde dónde se remató, el minuto, quién sacó y quién remató; el Castilla y el próximo rival, a un toque" },
          { que: "Acción por acción", es: "El log de Opta: quién, cuándo y tras cuánto tiempo" },
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
            que: "ABP de la categoría: qué cuenta",
            es: "Los balones parados que acabaron en remate según los eventos de Wyscout; el tipo de cada gol es dato, no estimación",
            cuenta: "Conversión = goles ÷ remates · gol − xG = goles − suma del xG de los remates · zona de caída: primer palo, centro, segundo palo, portero, frontal o en corto, mirando desde el lado del saque",
          },
          {
            que: "Al primer toque, prolongación, segunda jugada",
            es: "Cuántos toques hubo entre el saque y el remate (penalti y falta directa no entran)",
            cuenta: "0 toques = primer toque · 1 = prolongación o peinada · 2 o más = segunda jugada",
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
      {
        titulo: "Cómo se calcula: fases, liga, estilos y jugadores por 90",
        filas: [
          { que: "Grupo del Castilla", es: "Opta no dice el grupo: se saca de quién ha jugado contra quién", cuenta: "Equipos que se han enfrentado = mismo grupo (componentes del grafo de partidos)" },
          { que: "Por partido", es: "Los recuentos, entre los partidos jugados; los porcentajes y cocientes, tal cual", cuenta: "remates ÷ PJ; posesión, PPDA o xG por remate no se dividen" },
          { que: "Por 90", es: "Cifra del jugador llevada a un partido entero", cuenta: "valor ÷ minutos × 90" },
          { que: "Puesto del jugador", es: "Se compara con los de su familia: porteros, centrales, laterales, mediocentros, mediapuntas, bandas o delanteros" },
          { que: "Mínimo de minutos", es: "Para entrar en la muestra del percentil; 270′ por defecto y se cambia" },
          {
            que: "Temporada a temporada (ficha del jugador)",
            es: "Las temporadas pasadas de Opta no traen todos los partidos de cada equipo: la tarjeta dice «incompleta» y no da percentil",
            cuenta: "Partidos del equipo = los del que más jugó de ese equipo en la tabla; completa desde 30 de 38",
          },
          { que: "Goles evitados", es: "Lo que el portero salva por encima de lo esperado", cuenta: "xG en contra − goles encajados" },
          { que: "PPDA", es: "Pases que se deja dar al rival por cada acción defensiva: menos, más presión" },
          { que: "Diferenciales (La liga)", es: "Lo de cada equipo menos lo de su rival, de media por partido", cuenta: "Σ (propio − rival) ÷ partidos; en los porcentajes, puntos" },
          { que: "Dependencia", es: "Qué parte del total del equipo pone cada jugador", cuenta: "jugador ÷ total del equipo × 100 (el mayor entre el de Opta y la suma de sus jugadores)" },
          { que: "Perfil de remate", es: "Zona, parte del cuerpo y situación de los remates de un jugador del Castilla, con sus goles", cuenta: "Remates sin los bloqueados, como los parte Opta" },
          { que: "Un partido, cara a cara", es: "Los dos equipos de un partido del Castilla con las cifras de ese día" },
          { que: "Dominio (Estilos)", es: "Parte de los minutos en que el equipo es el que aprieta, con la curva de momentum de cada tramo de 5′", cuenta: "tramos con la curva a su favor por más de 0,05 ÷ tramos jugados; cada gol, con los 5′ anteriores sin el propio remate" },
          { que: "Índices de estilo", es: "Dominio (posesión, pases, toques en el último tercio, PPDA), peligro (xG, remates, toques en el área, ocasiones) y solidez (xG, remates, remates a puerta y goles en contra)", cuenta: "Media de los percentiles por partido entre los equipos que se ven" },
          { que: "Nota de juego", es: "La media de los percentiles de la radiografía de un equipo, contra su grupo o la categoría; posesión, pases y secuencias largas son estilo y no cuentan" },
        ],
      },
      DE_DONDE_SALE,
    ],
    ojo: [
      "Con pocos partidos jugados, un puesto en la tabla se mueve mucho por un solo resultado.",
      "Una cifra por 90 de alguien con pocos minutos es una tendencia, no un retrato: por eso el mínimo.",
      "El directo depende de que Opta publique durante el juego; si sólo publica al acabar, las cifras llegan al final.",
      "Con 2 o 3 jornadas todo son indicios, no tendencias.",
      "El balón parado propio lo registramos nosotros: no sale de Wyscout ni de Opta, y no hay liga con la que compararlo.",
      "En el percentil del jugador no entran los que no llegan a 90 minutos.",
      "Si una pantalla enseña la jornada pasada, lo que falta es publicar: bajar los datos no los sube.",
      "Si los datos se quedan atrás varias semanas, mira .cache/wyscout: casi siempre es que hay que volver a entrar en Wyscout una vez.",
    ],
    revisada: "2026-11-12",
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
  {
    ruta: "/abp-pizarra",
    titulo: "Pizarra de Balón Parado",
    resumen: "Las láminas de ABP del partido: quién va en cada puesto, sus carreras por fases y lo que se exporta a la sala y a cada jugador.",
    origen:
      "El documento «abp-pizarra» de la app (Supabase), el calendario (partidos jugados + hoja RIVALES) y el once de la pizarra táctica. Las fotos, de la plantilla.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Montar la jornada",
        filas: [
          { que: "Copiar de J.. y poner el once", es: "Trae jugadores, flechas y consignas de la jornada anterior y cambia a los que no están en el once" },
          { que: "Colocar", es: "Rellena los huecos con quien suele hacer ese puesto", cuenta: "La memoria es por puesto: se anota sola cada vez que se asigna a alguien" },
          { que: "0/10 colocados", es: "En la tira, lo que falta en cada diapositiva" },
          { que: "Soltar una cara sobre otra", es: "Las intercambia: cada sitio conserva su puesto y sus carreras" },
        ],
      },
      {
        titulo: "Flechas y fases",
        filas: [
          { que: "Carrera, balón, bloqueo", es: "Se dibujan arrastrando desde el jugador; el tirador del centro las curva" },
          {
            que: "Carreras atadas",
            es: "Una flecha va con quien está en su arranque, no con un jugador fijo",
            cuenta: "Al cambiar a alguien, el que entra nace en su sitio y corre sus flechas; arrastrarlo se las lleva",
          },
          { que: "Fase 1, 2, 3", es: "El orden de los movimientos: la punta de una fase es el arranque de la siguiente" },
          { que: "Difuminado", es: "En la hoja de la fase n, lo ya recorrido sale al 25 % y las caras están donde arranca esa fase" },
          { que: "Ctrl+Z", es: "Deshace un gesto entero (un arrastre es un paso); versiones y memoria no se deshacen" },
        ],
      },
      {
        titulo: "Enseñar y exportar",
        filas: [
          { que: "Proyector", es: "A pantalla completa: → o espacio dibuja la fase siguiente y luego pasa de lámina; A quita el panel" },
          { que: "Exportar", es: "PDF general, PowerPoint, vídeos y .zip; lo que no ha cambiado sale al momento (caché por contenido)" },
          { que: "PDF por jugador", es: "Uno vertical por jugador para WhatsApp: su cara en rosa, su cometido y a quién marca" },
          { que: "Rival implícito", es: "En las defensivas sin rivales dibujados se pinta un atacante por marca, con el dorsal de «Quién marca a quién»" },
          { que: "Al 8 Montalvo · 1,80", es: "En el panel exportado: a quién marca cada uno, con su altura si se sabe" },
          { que: "Portero", es: "En las defensivas, el del once de la pizarra táctica bajo palos (su cara y su nombre)" },
        ],
      },
    ],
    ojo: [
      "La lámina es azul noche en los dos temas a propósito: es lo que se proyecta y se imprime.",
      "Las consignas que nombran a alguien sin ficha en la lámina se avisan antes de exportar.",
      "En el móvil, el botón de ampliar abre la lámina en horizontal: en vertical es una miniatura.",
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
      {
        titulo: "Área de mejora y Tendencia",
        filas: [
          { que: "Mapa de su puesto", es: "Todos los de su puesto en Primera RFEF con 450′ o más, en dos ejes" },
          {
            que: "Filtro de edad del mapa",
            es: "Todas, sub-21, sub-23, su edad ±2 o un rango a mano",
            cuenta: "Se vuelve a ordenar sólo entre los de esa edad; él entra siempre. Hacen falta 5 además de él",
          },
          { que: "Cara a cara con la élite", es: "Hasta 3 jugadores de Primera o Premier sobre su radiografía" },
          { que: "Tendencia", es: "Nota partido a partido, Wyscout semana a semana y 26/27 frente a 25/26" },
        ],
      },
      {
        titulo: "Opta: temporada a temporada",
        filas: [
          {
            que: "Tarjeta de Opta",
            es: "Equipo, minutos, partidos y lo principal de cada temporada, con su percentil frente a los de su puesto con 270′ o más de esa tabla",
            cuenta: "Por 90 = total ÷ minutos × 90",
          },
          {
            que: "«Incompleta»",
            es: "Opta no tiene la temporada entera de su equipo (la 25/26 trae 2 o 3 partidos de casi todos; del Castilla, 3)",
            cuenta: "Partidos del equipo = los del que más jugó de ese equipo en la tabla; con menos de 30 de 38, la tarjeta lo dice, va sin percentil y sus jugadores no entran en el de los demás",
          },
          {
            que: "Tarjeta de Wyscout · temporada completa",
            es: "Completa la temporada pasada cuando Opta no la tiene entera o no le tiene: partidos, minutos, goles con su xG, asistencias con su xA y seis métricas de su puesto por 90",
            cuenta: "Percentil frente a los de su puesto de toda la categoría con 450′ o más (el portero, sólo con porteros); con menos de 450′ o un porcentaje de muy pocas acciones, sin percentil. Wyscout no da titularidades",
          },
          {
            que: "Quién es quién en Wyscout",
            es: "Por su nombre entre los del Castilla de esta temporada y la fila del año pasado con ese mismo nombre de Wyscout; si no, por nombre en toda la categoría",
            cuenta: "Sólo si la edad (la de Opta), la altura y la inicial no lo desmienten; con dos posibles, no sale",
          },
        ],
      },
    ],
    revisada: "2026-11-12",
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
    resumen: "Quién juega, cuánto y cómo rinde, semana a semana.",
    origen: "Wyscout (minutos, partidos, edad, contrato, amarillas y percentiles por puesto), Valoraciones (quién jugó cada jornada, titular o suplente, y la nota), hoja JUGADORES (puesto, licencia y ficha de competencias) y sesiones registradas en Jugadores sesión (desde el 21/10).",
    bloques: [
      {
        titulo: "Cómo se lee",
        filas: [
          { que: "Minutos", es: "Los de Wyscout sobre los posibles (partidos de liga × 90); si no tiene fila en Wyscout, los de Valoraciones, con asterisco" },
          { que: "Titular", es: "Marcado como titular en Valoraciones o con los 90 minutos jugados" },
          { que: "Avisos", es: "Juega poco (menos del 25 %), tres partidos sin jugar, carga alta (90 % o más), a una amarilla del ciclo y nota a la baja; sólo licencia del Castilla" },
          PERCENTIL,
          { que: "Filtros por puesto", es: "Comparar un central con un extremo no dice nada" },
        ],
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
    resumen: "El dossier del viaje y el horario de cada día, para el cuerpo técnico y para los jugadores.",
    origen: "Se escribe aquí y se guarda solo. Fecha y hora, del calendario de BeSoccer; estadio, medidas, foto y escudo, de BeSoccer y OpenStreetMap.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Lo primero de la pantalla",
        filas: [
          { que: "Al entrar", es: "Abre el próximo partido; los demás siguen en el selector (✓ = viaje ya guardado)" },
          { que: "Cómo va el viaje", es: "Salida, partido, hotel y horario de un vistazo, y una sola lista de lo que queda, ordenada por gravedad, con un botón por fila" },
          { que: "N de M datos listos", es: "Lo que ya tiene el documento; pinchándolo, lo hecho por bloque", cuenta: "La barra va en rojo si hay errores, ámbar si hay avisos y verde si está todo" },
          { que: "Partido · estadio · hotel", es: "Una sola fila con un «Editar» que abre los tres bloques" },
          { que: "Escritorio ancho", es: "El formulario a la izquierda y el documento a la derecha, siempre a la vista mientras se edita" },
        ],
      },
      {
        titulo: "El horario",
        filas: [
          { que: "Días", es: "Fuera abre con dos (víspera y partido) y en casa con uno; cada día es una hoja A4" },
          { que: "Horario elástico", es: "Al cambiar la hora del partido, el día del partido se mueve solo; los demás días van por reloj" },
          { que: "Horas", es: "Se escriben enteras («1830», «18.30») y se guardan al salir del campo; flechas ±5 min" },
          { que: "Añadir cita", es: "La paleta de eventos (🚌 salida, 🍝 comida, ⚽ partido…) va plegada; se arrastra al día o se toca y llega con su hora. El emoticono sale del mismo catálogo por palabra clave" },
          { que: "Trayectos", es: "Cada salida dice de dónde a dónde; en autobús la duración se calcula sola (OSRM sobre OpenStreetMap) y la llegada cae sola" },
          { que: "Duraciones recordadas", es: "Si corriges una duración, ese trayecto vale así en los viajes que vengan" },
          { que: "Encadenar", es: "Cambiar una hora o una duración corre las citas de detrás, hasta la primera fijada (📌) o el partido" },
          { que: "Avisos del horario", es: "Día de partido copiado, vuelta antes del partido, trayectos imposibles (un tren de 9 min)…: cada uno con su arreglo; nada se cambia solo" },
          { que: "Erratas", es: "Marcadas en su fila con la corrección propuesta («Llehagda» → «Llegada»); la aplica el analista con «Corregir»" },
          { que: "Copiar de otro viaje", es: "Cualquier viaje montado: el horario, los avisos, y el estadio y el hotel si es el mismo rival. Un día suelto también se copia y se pega" },
        ],
      },
      {
        titulo: "Estadio y hotel",
        filas: [
          { que: "BeSoccer y OpenStreetMap", es: "Estadio, dirección, aforo, foto y escudo vienen rellenos" },
          { que: "Medidas con fuente", es: "Se cotejan OSM, BeSoccer y la hoja RIVALES; si no coinciden se elige una con su botón y el dossier dice de dónde sale («102 × 67 · BeSoccer»)" },
          { que: "Fotos de los lugares de salida", es: "Valdebebas, estaciones…: se ponen una vez y valen para todos los viajes" },
        ],
      },
      {
        titulo: "Lo que sale",
        filas: [
          { que: "Dossier", es: "Como mucho tres diapositivas, sin portada: el estadio, el hotel (si lo hay) y el viaje (si hay trayectos). Lo vacío no sale y las fotos llenan la hoja" },
          { que: "Para el cuerpo técnico", es: "«Todo en un PDF» (dossier y horario), el dossier en PowerPoint o en PDF" },
          { que: "Para los jugadores", es: "«Horario en imagen»: un JPEG por día que se ve en el propio chat de WhatsApp; «Horario para imprimir», el A4 para el vestuario y el autobús" },
          { que: "Antes de sacarlo", es: "Si algo no cuadra, se pregunta con la lista de lo pendiente; el documento sale como esté" },
          { que: "Nota para el vestuario", es: "Agradecimiento (fuera) o bienvenida (en casa), plegada al final; no lleva rival ni fecha" },
        ],
      },
      {
        titulo: "Después del viaje",
        filas: [
          { que: "Valoración", es: "Nota del viaje, de cada ítem y de cada cita, e incidencias: no sale en ningún PDF" },
          { que: "Plan por rival", es: "Guarda el viaje como plan ante el rival y, al volver a jugar contra él (o en su campo), se propone con su valoración" },
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
        titulo: "La cabecera y los pasos",
        filas: [
          { que: "Siguiente paso", es: "El botón dorado dice qué toca: añadir objetivos, pedir el análisis, revisar las acciones o ver la evolución" },
          { que: "Cuatro pasos", es: "Objetivos · Análisis · Revisión · Evolución, con su cuenta; un toque lleva a cada uno" },
          { que: "Revisar con el teclado", es: "En el visor: 1 correcta, 2 mejorable, 3 descartar, 0 quitar, flechas para moverse y espacio para el vídeo; pasa sola a la siguiente sin validar" },
        ],
      },
      {
        titulo: "Objetivos",
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
          { que: "Liso / rayado", es: "En las barras y columnas: validado / propuesta automática sin validar" },
          { que: "Tramo sombreado", es: "Minutos que el análisis no pudo mirar: ahí no hay acciones porque no se vieron" },
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
      "Si se vuelve a analizar un día, lo validado sobre el análisis anterior deja de contar (las acciones ya no son las mismas) y se avisa en «Revisar».",
      "La misma jugada contada dos veces (sobre todo en el corte entre dos partes del vídeo) cuenta una sola vez.",
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
            es: "Goles esperados: lo que valían las ocasiones que generamos, por partido, y nuestro puesto en el grupo. Manda Opta; la cifra de Wyscout va al lado, en pequeño",
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
      DE_DONDE_SALE,
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
          { que: "Proponer equipos", es: "Reparte a todos los que hacen la tarea con el criterio elegido en «En un toque»", cuenta: "Porteros separados y los comodines rotan entre quienes menos lo han sido; debajo de los botones sale una línea por equipo que explica el reparto" },
          { que: "Titulares vs suplentes", es: "El once de la pizarra táctica (tablero «Once 4-2-3-1») en un equipo y los suplentes en el otro", cuenta: "Casado por nombre con la lista; si el once no llena el equipo, entran suplentes de la línea que falta" },
          { que: "Mezcla parcial / total", es: "Parcial: el porcentaje del deslizador cambia titulares de lado, cada uno por un suplente de su línea (100 % = mitad y mitad). Total: titulares a partes iguales y líneas parejas, al azar" },
          { que: "Por líneas", es: "Cada equipo con portero, defensas, medios y arriba; laterales y centrales repartidos" },
          { que: "Sinergias / Por perfiles", es: "Parten de «Por líneas» y sólo cambian jugadores de la misma línea", cuenta: "Sinergias: juntas las parejas que se potencian según Wyscout (Data análisis, once). Perfiles: el rasgo que más destaca de cada uno contra su puesto, repartido o junto" },
          { que: "Chip del puesto", es: "En los que suben del RMC o del Juvenil A, el puesto aprendido de cómo los colocáis (borde de puntos) o el fijado a mano (lleno). Tocarlo lo corrige para todas las sesiones" },
          { que: "Completar", es: "Coloca sólo a los que faltan, en el equipo más corto, sin mover a nadie", cuenta: "Sale cuando ya hay alguien colocado y alguien pendiente" },
          { que: "Más (junto a Proponer)", es: "Vaciar la tarea, Como la anterior (copia equipos, colores y comodines de la tarea de antes), Duplicar, mover la tarea antes o después y quitarla" },
          { que: "Soltar encima de otro", es: "«Cambiar»: los dos se intercambian el sitio. «Compartir puesto»: van juntos en el mismo hueco (dos, tres o los que hagan falta)", cuenta: "Debajo del campo, «También en…» comparte ese mismo puesto en el otro equipo: entra el que esté fuera del dibujo o queda un «+» donde soltarlo" },
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
          { que: "La imagen: Limpia", es: "Sólo el título de la tarea y los campos, con los nombres más grandes; vale para las imágenes y el PDF" },
          { que: "Texto", es: "Los equipos en texto para el grupo de WhatsApp, un equipo por línea" },
        ],
      },
    ],
    ojo: [
      "Los lesionados empiezan fuera de cada tarea; si alguno hace una, se le mete en un equipo y el validador lo señala.",
      "Volver a pegar la lista manda: quien no esté en ella sale de todas las tareas.",
      "El puesto de cada uno: lo puesto a mano en la sesión, luego lo fijado en su ficha; después, para los que suben, lo aprendido antes que la plantilla, y para los del Castilla, la plantilla antes que lo aprendido.",
      "El criterio elegido se recuerda en este aparato.",
    ],
  },

  /* ==================== AJUSTES (12/11/2026) ==================== */
  {
    ruta: "/ajustes",
    titulo: "Ajustes",
    resumen: "Lo que normalmente se pone al día solo, pedido a mano cuando no se quiere esperar, y la lista de cuándo se actualizó cada dato.",
    origen:
      "Sólo admin, con usuario y contraseña propios. Cada botón deja un encargo que recoge el vigía del ordenador del club en segundos; Opta corre en la nube (GitHub). Las fechas de «Actualizaciones» son las de los documentos de Supabase o las de los ficheros publicados con la web.",
    bloques: [
      {
        titulo: "Poner al día",
        filas: [
          { que: "El ordenador del club", es: "Si el vigía está encendido (y su último aviso) o apagado: lo que se pida espera a que se encienda" },
          { que: "Datos de Opta", es: "Primera RFEF entera de Opta ProVision; corre en GitHub cada lunes y al pulsar. «Seguir en directo» mira los partidos del día" },
          { que: "Resultados de la quiniela", es: "Pone el 1-X-2 de la jornada en curso y la anterior desde BeSoccer; no toca una jornada que no apostó nadie" },
          { que: "Jornada de BeSoccer", es: "Resultados, goleadores, alineaciones, clasificación, fichas, altas, bajas y dorsales: la pasada de cada noche, lanzada ahora" },
          { que: "Datos de Wyscout", es: "Baja sólo lo cambiado (equipos con un partido jugado que falta y jugadores de quien ha jugado) y lo publica. «Desde cero» lo baja todo" },
          { que: "Hasta qué jornada (Wyscout)", es: "Jornada completa, último partido del Castilla que hay, partidos que faltan y cómo fue la última pasada" },
          { que: "Análisis del partido", es: "El partido elegido (por defecto, el último jugado) en todas las secciones que lo leen, y su vídeo. «Sólo el vídeo» rehace sólo el vídeo" },
          { que: "Sesión de YouTube", es: "Si el ordenador del club tiene la cuenta abierta: sin ella no se saca el segundo exacto de cada acción a balón parado" },
        ],
      },
      {
        titulo: "Cada encargo",
        filas: [
          { que: "Pedido / en marcha / hecho", es: "En qué punto va el encargo y cuándo terminó la última vez («hace 12 min»)" },
          { que: "La barra de etapas", es: "Por qué paso va y cuánto queda", cuenta: "Con lo que suele tardar cada etapa; «estimado por el reloj» si aún no hay medida" },
          { que: "Pausar · Cancelar · Reiniciar", es: "Deja la orden; el vigía la ve en unos segundos y corta. En los de la nube no hay" },
          { que: "Repetir lo marcado", es: "Vuelve a lanzar sólo las etapas elegidas, con su duración frente a la del encargo entero" },
        ],
      },
      {
        titulo: "Más mandos",
        filas: [
          { que: "Reabrir la quiniela", es: "Para quien no apostó antes del cierre del viernes a las 12:00; volver a reabrir sustituye a la anterior. «Cerrar ya» la cierra" },
          { que: "Textos explicativos", es: "Apagados, en ABP, banda, faltas y transiciones sólo se ven las conclusiones; encendidos, también el método. Vale para todos" },
          { que: "Ordenador principal", es: "Marca este aparato como el del club; se guarda en este navegador" },
          { que: "Almacén", es: "Lo que ocupan los ficheros en Supabase frente al gigabyte gratis, las carpetas que más pesan y el botón para borrar adjuntos repetidos o caducados" },
          { que: "Lo que sigue haciéndose solo", es: "El recordatorio de lo que corre sin pedirlo" },
        ],
      },
      {
        titulo: "Actualizaciones",
        filas: [
          { que: "Los grupos", es: "Cada noche · la jornada, Cada mañana, Cada semana o cada mes, Durante el día y Cuando se pide" },
          { que: "Último dato", es: "La fecha del dato de verdad, no la de la última pasada" },
          { que: "Al día / Atrasada / Sin dato", es: "Si va a tiempo", cuenta: "Atrasada = más del doble de lo normal (y un margen) sin ponerse al día" },
          { que: "El botón de cada uno", es: "Los que se pueden pedir a mano lanzan el mismo encargo de «Poner al día»" },
        ],
      },
    ],
    ojo: [
      "Mientras trabaja Wyscout o el análisis del partido, en el ordenador del club se mueve solo un Chrome: que nadie lo toque.",
      "Con el ordenador del club apagado no se pierde nada: el encargo queda apuntado y empieza al encenderlo.",
      "La lista de «Actualizaciones» sale de un catálogo: un proceso nuevo que no se añada allí no aparece.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== TAREAS Y ALERTAS (12/11/2026) ==================== */
  {
    ruta: "/alertas",
    titulo: "Tareas y alertas",
    resumen: "Recordatorios que salen solos por correo, aunque nadie tenga la app abierta, hasta que se silencian.",
    origen:
      "La pestaña ALERTAS de la hoja de cálculo es el único origen: la lee y la envía el Apps Script con su disparador horario. Los adjuntos se suben a Supabase y al correo va el enlace. Las que van atadas al partido usan el calendario del Castilla.",
    bloques: [
      {
        titulo: "La lista",
        filas: [
          { que: "N alertas activas · próximo aviso", es: "Cuántas van a sonar y cuál es la siguiente, con su fecha" },
          { que: "La tarjeta", es: "Tarea, cuándo sale, cada cuánto se repite, a quién va, alarma, adjuntos y cuántas veces se ha enviado" },
          { que: "Silenciadas (N)", es: "No sale ningún correo hasta reactivarlas; agrupadas por partido" },
          { que: "Caducadas (N)", es: "Silenciadas cuya fecha ya pasó: necesitan fecha nueva para volver a salir" },
          { que: "Sin fecha", es: "No sonará hasta editarla; si va atada al partido, espera a que haya próximo partido en el calendario" },
          { que: "Más acciones", es: "Editar, Enviar ahora, Silenciar y Borrar" },
        ],
      },
      {
        titulo: "Nueva tarea",
        filas: [
          { que: "Tarea y Mensaje", es: "El asunto y lo que se lee en el correo" },
          { que: "Enviar a", es: "Los correos; propone primero los ya usados en otras tareas, por cuántas veces" },
          { que: "Adjuntos", es: "Foto, vídeo, audio o documento; se sube a Supabase y va como enlace (Gmail rechaza más de 25 MB)" },
          { que: "Primer aviso", es: "Fecha y hora del primer correo" },
          { que: "Se repite", es: "Una sola vez, cada día, cada semana, cada mes, cada N días o a X días del partido" },
          { que: "A X días del partido", es: "Sale tantos días antes del próximo partido, a la hora elegida", cuenta: "Fecha = día del partido − X; se recalcula al abrir la pantalla si la jornada se mueve" },
          { que: "Alarma en el móvil", es: "Con alguna marcada, el correo lleva la cita (.ics) y el calendario suena aunque no se abra el correo" },
        ],
      },
    ],
    ojo: [
      "«El motor de envío no responde»: no sale ningún correo hasta instalar el Apps Script de las alertas en la hoja.",
      "«Nadie está repasando el calendario»: «Enviar ahora» funciona, pero las programadas no suenan hasta poner el disparador horario.",
      "Es la misma herramienta que el botón flotante; esta pantalla sirve para repasarlo todo de una vez.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== CENTRO DE DATOS (12/11/2026) ==================== */
  {
    ruta: "/data-center",
    titulo: "Centro de Datos",
    resumen: "Subida de CSV sueltos de jugadores, colectivos y scout, que se quedan en este aparato.",
    origen: "Los CSV que se suben aquí, guardados sólo en este navegador. Los informes semanales de Wyscout y Opta no pasan por aquí: se ven en Data Análisis.",
    bloques: [
      {
        titulo: "Los bloques",
        filas: [
          { que: "Jugadores Castilla · Datos Colectivos · Scout Rival", es: "Cada uno con su «Subir archivo CSV» (con cabecera)" },
          { que: "Cargado", es: "El último archivo subido: nombre, filas y fecha de la subida" },
          { que: "N filas guardadas en este aparato", es: "Lo que hay de ese bloque en este navegador" },
          { que: "Área Condicional", es: "Todavía no se carga aquí: la carga de cada tarea se registra en Microciclos" },
          { que: "Hudl", es: "Todavía no se carga aquí: los timelines se leen solos cada noche y se ven en Análisis de goles" },
        ],
      },
    ],
    ojo: [
      "Lo subido no llega a otros aparatos ni a ninguna otra pantalla de análisis.",
      "Un CSV sin filas no se carga: se avisa en la propia tarjeta.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== REPOSITORIO SEMANAL (12/11/2026) ==================== */
  {
    ruta: "/general",
    titulo: "Repositorio semanal",
    resumen: "El material semanal del cuerpo técnico (planificaciones, imágenes y PDF), semana a semana de la temporada.",
    origen: "Lo que sube el cuerpo técnico. La lista de semanas se guarda en Supabase (temporada 2026-2027) y los archivos en su almacén de ficheros.",
    bloques: [
      {
        titulo: "La cabecera",
        filas: [
          { que: "Temporada: N semanas", es: "Las semanas que tiene la temporada" },
          { que: "N imágenes y N PDF en X de Y semanas", es: "Lo subido hasta hoy", cuenta: "Y = semanas ya empezadas; X = las que tienen algún archivo" },
          { que: "La tira de semanas", es: "Una casilla por semana hasta la actual: dorada con marca, con material; en blanco, sin él; «ahora», la actual" },
          { que: "N semanas sin subir material", es: "La racha de semanas vacías seguidas hasta la actual (sale con dos o más)" },
          { que: "Ver las imágenes / los PDF de la temporada", es: "Todo lo subido, de la semana más reciente a la más antigua" },
          { que: "Actualizar", es: "Vuelve a leer las semanas" },
        ],
      },
      {
        titulo: "La semana",
        filas: [
          { que: "Imágenes · PDFs · Subir", es: "Las tres pestañas de la semana abierta; abre la semana en curso aunque esté vacía" },
          { que: "Esta semana no hay material", es: "Con el botón de subir y el enlace a la última semana que sí tiene" },
          { que: "Otras semanas", es: "La lista por meses, plegada, para buscar una semana futura o por fecha" },
          { que: "Borrar", es: "Quita la imagen o el documento de esa semana; no se puede deshacer" },
        ],
      },
    ],
    ojo: [
      "Si una subida o un borrado falla, se deshace sólo ese cambio y se avisa.",
      "Dos personas subiendo a la vez no se pisan: viaja sólo el cambio, no la temporada entera.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== IDENTIDAD EN EL CAMPO (12/11/2026) ==================== */
  {
    ruta: "/identidad-campo",
    titulo: "Identidad en el campo",
    resumen: "Nuestra forma de jugar, el perfil de cada puesto y los valores del vestuario, frente a lo que sale en el partido y a lo que se entrena en la semana.",
    origen:
      "Los principios, de la hoja del modelo de juego; lo medido, de Wyscout (nuestros partidos contra la categoría) y de Opta; la semana, del registro de tareas de los microciclos; las jornadas, del calendario de BeSoccer.",
    bloques: [
      {
        titulo: "El índice",
        filas: [
          { que: "Índice de identidad", es: "Cuánto se nos reconoce, de 0 a 100", cuenta: "Media de los índices de las fases; cada fase, media de sus principios; cada principio, media del percentil de sus indicadores" },
          PERCENTIL,
          { que: "muy reconocible … no aparece", es: "El nivel del índice", cuenta: "≥75 muy reconocible · ≥60 reconocible · ≥40 a medias · ≥25 poco reconocible · menos, no aparece" },
          { que: "La curva", es: "El índice partido a partido, contra todos los partidos de la categoría; la raya es el 50" },
          { que: "Verde / naranja", es: "Más nuestro (60 o más) / menos (por debajo de 40)" },
          { que: "Estrella", es: "Principio marcado como CLAVE en la hoja del modelo" },
          { que: "Lo que nos dice", es: "Las conclusiones: lo que sube o cae en los tres últimos partidos y lo que se entrena y no sale" },
        ],
      },
      {
        titulo: "Con balón · Sin balón",
        filas: [
          { que: "Cada fase", es: "Sus principios con los indicadores de Wyscout, la cifra, la mediana de la categoría y el percentil" },
          { que: "Los mismos principios, evento a evento", es: "Los que Opta mide con una cifra de equipo, contra los equipos de Primera RFEF (los dos grupos)" },
          { que: "Dominio del partido", es: "Cuánto del partido vivimos más cerca de su portería que ellos de la nuestra (momentum de Opta, se carga al abrirlo)" },
        ],
      },
      {
        titulo: "La semana y la gente",
        filas: [
          { que: "% de la semana", es: "Lo que se entrena cada fase", cuenta: "Minutos de tareas de la fase ÷ minutos de entrenamiento, sin el día de partido, asignados al partido siguiente" },
          { que: "Se entrena y se ve", es: "Fase con cuota igual o mayor que la media y índice 60 o más" },
          { que: "Se entrena y no sale", es: "Cuota igual o mayor que la media e índice por debajo de 45" },
          { que: "Sale sin apenas entrenarlo / Ni se entrena ni sale", es: "Cuota por debajo del 60 % de la media, con índice 60 o más / por debajo de 40" },
          { que: "Partido a partido", es: "Cada fase en cada jornada, con el color del percentil" },
          { que: "Nuestros valores en el campo", es: "Exigencia y valentía, Compromiso y Respeto, medidos con duelos, presión, recuperaciones, tarjetas y faltas" },
          { que: "Cada jugador y su puesto", es: "Encaje con lo que pide la Identidad Posicional", cuenta: "Media de sus percentiles contra los de su puesto en la categoría; sólo con más de 270 minutos" },
        ],
      },
    ],
    ojo: [
      "Sólo sale un principio si tiene indicador con dato: lo que no se puede medir no se nombra.",
      "En pérdidas, remates en contra, juego largo y PPDA, menos es mejor: el percentil ya lo tiene en cuenta.",
      "Si un principio deja de estar en la hoja del modelo, desaparece de la pantalla.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== IDENTIDAD Y CULTURA (12/11/2026) ==================== */
  {
    ruta: "/identidad-cultura",
    titulo: "Identidad y cultura",
    resumen: "Los valores votados por la plantilla y la estantería de documentos de cultura, listos para proyectar o imprimir.",
    origen:
      "Los documentos publicados con la web y los que sube el administrador, guardados en Supabase. Es el mismo repositorio que se abre desde Dinámicas y Valores.",
    bloques: [
      {
        titulo: "Los valores",
        filas: [
          { que: "El titular", es: "Cuántos valores se votaron y cuál fue el más votado, con sus votos sobre el total", cuenta: "Sale del propio documento de valores: si cambia el recuento, cambia el titular" },
          { que: "N votos", es: "Los votos de cada valor en el recuento; la barra, frente al más votado" },
          { que: "+N a otro valor", es: "Votos a un valor afín que el recuento agrupó con el suyo; no entran en el total" },
          { que: "Antivalor", es: "Lo que no se admite, con sus votos, contados aparte" },
        ],
      },
      {
        titulo: "La estantería",
        filas: [
          { que: "Documentos", es: "Los publicados, por número; se elige uno para verlo" },
          { que: "Vista previa", es: "Cada diapositiva tal y como se descarga; se abre a pantalla completa y se pasa con las flechas" },
          { que: "PDF", es: "A4 apaisado, una diapositiva por hoja y con pie numerado" },
          { que: "PowerPoint", es: "Para abrirlo en la sala sin la app" },
        ],
      },
      {
        titulo: "Sólo admin",
        filas: [
          { que: "Subir el bruto", es: "El HTML de la presentación tal y como se redactó" },
          { que: "Revisar antes de publicar", es: "Valores y diapositivas leídos, con número, temporada, título, subtítulo, nombre del fichero, resumen y entradilla" },
          { que: "Hay diapositivas sin entender", es: "Partes del bruto que no se han podido leer" },
        ],
      },
    ],
    ojo: [
      "Los documentos publicados con la web no se borran desde aquí: se corrigen subiendo uno con el mismo identificador, y al borrar el subido vuelve el original.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== CALENDARIO DE SEGUIMIENTO (12/11/2026) ==================== */
  {
    ruta: "/calendar",
    titulo: "Calendario de Seguimiento",
    resumen: "Los seguimientos individuales, día a día, y a quién del Castilla toca seguir.",
    origen: "Hoja de seguimiento, una fila por registro (la misma de /individual). El jugador se ata por nombre con la plantilla, no por ID.",
    bloques: [
      {
        titulo: "Las cifras del mes",
        filas: [
          { que: "Seguimientos en (mes)", es: "Registros del mes que se mira; si es el mes en curso, hasta hoy", cuenta: "Debajo, el mes anterior al mismo día (o entero), lo programado después de hoy y el total de la temporada, con el Castilla y los de otros equipos aparte" },
          { que: "Jugadores con seguimiento", es: "Jugadores distintos con algún registro ese mes", cuenta: "Debajo, cuántos son del Castilla de los que tiene la plantilla" },
          { que: "Por tipo", es: "Registros del mes por estrategia: Campo, Vídeo, Charla, Vídeo y charla, Sin tipo escrito", cuenta: "Se lee de la columna ESTRATEGIA; «Sin tipo escrito» es lo que no trae ninguna de esas palabras" },
          { que: "Todos los jugadores", es: "Filtra todo a un jugador; el Castilla primero y los de otros equipos aparte" },
        ],
      },
      {
        titulo: "El calendario",
        filas: [
          { que: "A quién toca seguir", es: "Jugadores de campo del Castilla sin ningún seguimiento en 14 días, con los días desde el último", cuenta: "14 días que acaban hoy, hoy incluido; los porteros no cuentan. Sólo sale sin filtro de jugador" },
          { que: "Tarjeta del día", es: "El jugador y quién lo hizo; la franja de color es el tipo", cuenta: "Hasta 3 por casilla; «+N más» abre el día" },
          { que: "Programado", es: "Registro con fecha posterior a hoy: borde de puntos y fuera de las cifras «hasta hoy»" },
          { que: "El día abierto", es: "Cada registro con su estrategia, quién, objetivo ofensivo, defensivo, mental y feedback" },
          { que: "Pinchar un nombre", es: "Abre su ficha en /individual" },
        ],
      },
    ],
    ojo: [
      "La hoja también apunta seguimientos de jugadores de otros equipos: por eso las cifras separan el Castilla del resto.",
      "Aquí sólo se lee; los seguimientos se escriben desde la ficha individual.",
    ],
    revisada: "2026-11-12",
  },
  /* ==================== CALENDARIO DE OPERATIVA GENERAL (12/11/2026) ==================== */
  {
    ruta: "/calendar_general",
    titulo: "Calendario de Operativa General",
    resumen: "El mes del equipo en un sitio: partidos, viajes, sesiones, eventos del staff y documentos del Área General.",
    origen: "Partidos: calendario de BeSoccer. Viajes: lo guardado en /desplazamiento. Sesiones: hoja de microciclos. Eventos del staff: documento propio en Supabase. Imágenes y PDF: los subidos al Área General.",
    bloques: [
      {
        titulo: "Lo que sale solo",
        filas: [
          { que: "Próximo partido", es: "Jornada, rival, día y hora; si es fuera, desde qué día se viaja y lleva a su desplazamiento" },
          { que: "Partido", es: "Rival con escudos, hora y, si ya se jugó, el resultado (el nuestro primero)" },
          { que: "Viaje", es: "Los viajes guardados en Desplazamiento, con la hora de salida; los días tras el partido son la vuelta", cuenta: "Partido fuera sin viaje guardado: sale con la salida que propondría Desplazamiento" },
          { que: "Sesión (MD y minutos)", es: "El MD del día y los minutos de entreno de la hoja, con el contenido de más minutos", cuenta: "Sin la fila del partido; sin MD en la hoja, el MD se saca del próximo partido" },
          { que: "Libre", es: "Día sin sesión ni partido entre la primera y la última sesión apuntadas, y el día después de un partido más adelante" },
        ],
      },
      {
        titulo: "Lo que escribe el staff",
        filas: [
          { que: "Nuevo evento", es: "Reunión, Viaje, Logística, Médico o Institucional, con título, descripción, hora, lugar, responsable y participantes" },
          { que: "Editar / borrar", es: "Desde el día abierto; se guarda solo" },
          { que: "Imágenes y PDF", es: "Documentos del Área General, colgados del día en que se subieron" },
        ],
      },
      {
        titulo: "La cabecera del mes",
        filas: [
          { que: "Resumen del mes", es: "Cuántos partidos (y jugados), viajes, entrenos en la hoja, eventos del staff, imágenes y PDF hay en el mes" },
          { que: "Leyenda", es: "Sólo los tipos que tienen algo en el mes que se mira" },
        ],
      },
    ],
    ojo: [
      "Partidos, viajes y sesiones aquí sólo se leen: se cambian en su pantalla (BeSoccer, /desplazamiento, la hoja de microciclos).",
      "Si una fuente no llega en 15 s se ofrece reintentar; lo que sí llegó se pinta igual.",
      "Entrenos y partidos se cuentan igual que en /micro_calendar: la fila de competición no es sesión.",
    ],
    revisada: "2026-11-12",
  },
  /* ==================== CALENDARIO CONDICIONAL (12/11/2026) ==================== */
  {
    ruta: "/calendar_performance",
    titulo: "Calendario Condicional",
    resumen: "Los trabajos del área condicional por día, con sus imágenes y PDF.",
    origen: "Hoja de trabajos condicionales (lectura por /api/rivals, con copia en el servidor). Los archivos, del almacén del área Performance en Supabase.",
    bloques: [
      {
        titulo: "Las cifras del mes",
        filas: [
          { que: "Trabajos", es: "Trabajos apuntados en el mes" },
          { que: "Días programados", es: "Días del mes con al menos un trabajo" },
          { que: "Imágenes / PDFs", es: "Archivos del área subidos ese mes", cuenta: "Cada archivo cuelga del día en que se subió" },
        ],
      },
      {
        titulo: "Cada trabajo",
        filas: [
          { que: "Tipo", es: "Fuerza, Preventivo, Readaptación, Movilidad o Recuperación; es el color de la franja" },
          { que: "Ficha", es: "Título, descripción, jugadores, responsable, duración e intensidad, tal y como se escribieron" },
          { que: "Crear / editar / borrar", es: "Desde el día abierto; se escribe en la hoja y se comprueba que el texto ha llegado" },
        ],
      },
    ],
    ojo: [
      "La intensidad y la duración son texto libre: no se suman ni se promedian.",
    ],
    revisada: "2026-11-12",
  },
  /* ==================== CONTENIDOS MICROCICLO (12/11/2026) ==================== */
  {
    ruta: "/micro_calendar",
    titulo: "Contenidos Microciclo",
    resumen: "Cada día de entreno con su MD, sus minutos y sus contenidos, y la carga del mes contra el anterior.",
    origen: "Hoja de microciclos, una fila por tarea (la misma de /microcycles). Hora, lado y resultado del partido: calendario de BeSoccer.",
    bloques: [
      {
        titulo: "Las cifras del mes",
        filas: [
          { que: "Titular", es: "Mes, entrenos (hechos), volumen y cómo va la carga frente al mes anterior" },
          { que: "Entrenos", es: "Días con tarea de entreno; hechos = con minutos o carga apuntados, el resto planificados", cuenta: "Los partidos aparte: la fila de competición no es entreno" },
          { que: "Volumen", es: "Minutos de entreno del mes, sin los partidos" },
          { que: "Carga física media / entreno", es: "Puntos de carga por entreno hecho", cuenta: "UA = minutos × intensidad (1-10), de la columna «Carga Ponderada»; suma del mes ÷ entrenos hechos" },
          { que: "Carga cognitiva media / entreno", es: "Lo mismo con la demanda cognitiva", cuenta: "UA = minutos × demanda cognitiva (1-10); suma ÷ entrenos hechos" },
          { que: "Frente al mes anterior", es: "La media contra los mismos días del mes anterior", cuenta: "Del 1 al último día con entreno hecho; con menos de 3 entrenos hechos en un lado no se compara" },
          { que: "Lectura de la carga", es: "Qué MD se ha movido más contra el mes anterior y si hay otro número de partidos", cuenta: "Un MD sólo se nombra con 3 sesiones suyas o más en cada mes" },
        ],
      },
      {
        titulo: "El calendario",
        filas: [
          { que: "Fondo del día", es: "La fase con más minutos ese día, sin contar Global", cuenta: "Ofensiva, Defensiva, Transición ofensiva, Transición defensiva o ABP; sólo Global deja el fondo normal" },
          { que: "MD", es: "El de la hoja; sin él, el del próximo partido del calendario" },
          { que: "Contenidos", es: "Minutos por contenido principal, de más a menos; sin contenido, el tipo de tarea" },
          { que: "Partido", es: "Rival con escudo, hora, en casa o fuera y resultado, si BeSoccer lo tiene" },
          { que: "Libre", es: "Día sin nada entre la primera y la última sesión apuntadas" },
          { que: "Siglas", es: "Bajo el calendario, las siglas de los contenidos que salen ese mes, desarrolladas" },
        ],
      },
      {
        titulo: "El día abierto",
        filas: [
          { que: "Bloques", es: "Las tareas agrupadas por contenido principal, con sus minutos" },
          { que: "Tarea", es: "Descripción, grupo y nº de jugadores" },
          { que: "Carga física / cognitiva", es: "Barra de cada tarea", cuenta: "Llena = la tarea más cargada de ese día" },
        ],
      },
    ],
    ojo: [
      "Más carga no es mejor: un mes con más partidos baja la media a propósito.",
      "Entrenos y partidos se cuentan igual que en /calendar_general y /microcycles.",
    ],
    revisada: "2026-11-12",
  },
  /* ==================== JUGADORES SESIÓN · DISPONIBILIDAD (12/11/2026) ==================== */
  {
    ruta: "/training",
    titulo: "Jugadores Sesión · disponibilidad",
    resumen: "El estado de cada jugador en la sesión de un día, importado de una imagen o de WhatsApp y ajustado a mano.",
    origen: "Plantilla y estados de la hoja de jugadores (por Apps Script). La imagen o el texto los lee Gemini y los nombres se emparejan con la plantilla.",
    bloques: [
      {
        titulo: "Importar disponibilidad",
        filas: [
          { que: "Imagen / Texto de WhatsApp", es: "Se sube la foto del parte o se pega el mensaje y se detecta el estado de cada uno" },
          { que: "Nombres sin identificar", es: "Los que no casan con nadie de la plantilla" },
          { que: "Coincidencia ambigua", es: "Varios candidatos con su porcentaje de parecido: se elige uno y «Asociar» guarda el alias" },
          { que: "Jugador nuevo detectado", es: "Sin candidato: «Crear» lo da de alta con su licencia (RMC, Juvenil A, Juvenil B, Castilla u Otro)" },
        ],
      },
      {
        titulo: "Disponibilidad de la plantilla",
        filas: [
          { que: "Fecha", es: "El día de la sesión; lo pendiente se guarda en su día antes de cambiar" },
          { que: "Estado", es: "Óptimo, Control de carga, Tocado, Reincorporación, Sancionado, Lesionado, Primer equipo, Selección, Otros o No convocado" },
          { que: "Entrenan", es: "Los que pisan el campo", cuenta: "Óptimo + Control de carga + Tocado + Reincorporación + Sancionado" },
          { que: "Chips por estado", es: "Cuántos hay en cada estado ese día" },
          { que: "Todos / Entrenan / Fuera", es: "Filtra la lista; con el buscador por nombre" },
          { que: "Recargar", es: "Manda lo pendiente y vuelve a leer la hoja" },
        ],
      },
    ],
    ojo: [
      "Cada cambio se guarda solo al dejar de tocar, en la fecha elegida.",
      "Sin estado guardado, el jugador sale como No convocado.",
    ],
    revisada: "2026-11-12",
  },
  /* ==================== DINÁMICAS Y VALORES (12/11/2026) ==================== */
  {
    ruta: "/team-values",
    titulo: "Dinámicas y Valores",
    resumen: "La hoja de ruta de la cultura del vestuario, etapa a etapa, y el resultado de la votación de valores.",
    origen: "Hoja de contenidos culturales publicada (una fila por contenido con etapa, tipo, título y texto). Los votos, del documento de Identidad y Cultura.",
    bloques: [
      {
        titulo: "Las etapas",
        filas: [
          { que: "Marco, Planificación, Semana 1-4", es: "Las etapas de la hoja de ruta, con cuántos contenidos tiene cada una" },
          { que: "Titular de la etapa", es: "La idea de esa etapa; encima, su nombre y, si la hoja la trae, su semana real" },
          { que: "Filtro por tipo", es: "Sólo los tipos de contenido que hay en esa etapa" },
          { que: "Buscar valor o conducta", es: "Busca en título, texto y tipo de la etapa" },
          { que: "Ficha de la dinámica", es: "Duración, material y lo que entrega el vestuario, si la hoja lo trae" },
        ],
      },
      {
        titulo: "La votación",
        filas: [
          { que: "Resultado de la votación", es: "El valor más votado con su base; arriba en el Marco, al pie en las demás etapas" },
          { que: "Votos de cada valor", es: "Los cinco valores con sus votos del recuento y lo que lo destruye (antivalores)", cuenta: "Los votos a un valor afín se dicen aparte y no entran en el total; los antivalores se cuentan aparte" },
          { que: "Ver el documento", es: "Abre el documento en /identidad-cultura" },
        ],
      },
      {
        titulo: "Editar",
        filas: [
          { que: "Editar", es: "Cambia los textos de la etapa; cada contenido se escribe solo en la hoja al dejar de escribir" },
          { que: "Deshacer", es: "Vuelve a lo que había al entrar en edición, también en la hoja" },
        ],
      },
    ],
    ojo: [
      "La hoja publicada tarda minutos en refrescarse: lo recién escrito se enseña encima desde este aparato.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== LABORATORIO · DEL SCOUTING AL PLAN (12/11/2026) ==================== */
  {
    ruta: "/laboratorio",
    titulo: "Del scouting al plan de partido",
    resumen:
      "Prueba: un modelo lee el análisis del rival ya escrito y redacta un borrador del plan de partido imitando los planes del cuerpo técnico. No escribe nada: se lee, se corrige y se copia.",
    origen:
      "La hoja RIVALES (el scouting del rival elegido y, como ejemplo, los dos planes ya escritos más recientes de otros rivales). La redacta el motor elegido en el servidor.",
    bloques: [
      {
        titulo: "Qué se redacta",
        filas: [
          { que: "Partido", es: "Las jornadas de la hoja RIVALES; abre en el próximo partido (el primero con fecha de hoy en adelante)" },
          { que: "Motor", es: "«Motor gratuito» (el del dictado por voz, sin coste) o «Motor de pago» (se cobra por uso)" },
          { que: "Redactar el borrador", es: "Manda el scouting y los planes de ejemplo al motor; tarda unos veinte segundos" },
        ],
      },
      {
        titulo: "Con qué se ha escrito",
        filas: [
          { que: "Campos de scouting usados", es: "Cuántos campos del análisis del rival tenían texto y entraron" },
          { que: "Planes de ejemplo", es: "Los rivales cuyos planes se le dieron como modelo de cómo escribe la casa" },
          { que: "Motor y coste", es: "Qué motor lo ha escrito y lo que ha costado (o «sin coste»)" },
          { que: "Lo que el scouting no cuenta", es: "Los huecos que el propio motor dice que no ha podido rellenar con lo escrito" },
        ],
      },
      {
        titulo: "El borrador",
        filas: [
          { que: "Los campos", es: "Claves del partido y emocionales, ataque, defensa, ABP ofensivo y defensivo, duelos CB y SB a favor y en contra, fortalezas, debilidades y estructuras" },
          { que: "Se apoya en", es: "Debajo de cada campo, de qué partes del scouting ha salido" },
          { que: "Copiar / Copiar todo", es: "Al portapapeles, para pegarlo en el plan de partido; «Abrir el plan de partido» lleva allí" },
        ],
      },
    ],
    ojo: [
      "Ningún texto se escribe en la hoja: lo que no se copie y se pegue en el plan, se pierde al cambiar de partido.",
      "Un rival sin scouting escrito no da borrador.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== LABORATORIO ABP · EL BALÓN PARADO DE CADA LIGA (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/abp/datos",
    titulo: "El balón parado de cada liga",
    resumen:
      "Todos los equipos de los dos grupos de Primera RFEF y de la Premier con lo que Wyscout trae de balón parado, cada uno leído contra su liga. Sólo administrador.",
    origen:
      "Wyscout, en public/data/abp-ligas.json (lo arma scripts/abp-ligas.cjs; las ligas que no son la nuestra las baja scripts/actualizar-abp-ligas.cmd). El próximo rival, del calendario de BeSoccer.",
    bloques: [
      {
        titulo: "Mandos",
        filas: [
          { que: "Liga", es: "Sólo las ligas que están bajadas. La nuestra abre con el Castilla; la Premier, con el Arsenal" },
          { que: "Equipo", es: "El que se mira en toda la pantalla; también se elige pinchando una barra o un punto" },
          { que: "Métrica de la clasificación y la tendencia", es: "La que ordena la clasificación y dibuja la serie partido a partido" },
          { que: "En azul", es: "El próximo rival, sólo en su liga" },
        ],
      },
      {
        titulo: "Los paneles",
        filas: [
          { que: "De un vistazo", es: "Una barra por métrica: su valor, la mediana de la liga y su puesto, con el próximo rival al lado" },
          PERCENTIL,
          { que: "Clasificación", es: "Los equipos de la liga de mejor a peor en la métrica elegida" },
          { que: "Peligro a favor y en contra", es: "Cada equipo es un punto: ABP con remate a favor (derecha, más) frente a en contra (abajo, menos)" },
          { que: "Partido a partido", es: "La métrica elegida en cada partido del equipo; la raya, su valor en la temporada", cuenta: "Debajo, la base: partidos o acciones sobre las que se calcula" },
          { que: "Frente a la referencia", es: "El equipo contra un equipo de la Premier, cada uno con su percentil en su liga" },
          { que: "Su gemelo en la Premier", es: "El equipo de la Premier con el perfil de balón parado más parecido", cuenta: "Menor distancia media entre percentiles en las métricas que se juzgan (al menos 4 en común)" },
        ],
      },
      {
        titulo: "Las métricas",
        filas: [
          { que: "ABP con remate (a favor / en contra) por partido", es: "Jugadas a balón parado que acaban en remate, cada partido" },
          { que: "… que acaban en remate (por cada 100)", es: "Del total de balón parado, de córners o de faltas, cuántas terminan en remate", cuenta: "Jugadas con remate ÷ jugadas × 100, sumando la temporada" },
          { que: "Córners, faltas y penaltis por partido", es: "Volumen a favor y en contra" },
          { que: "Remates que nacen de ABP (por cada 100)", es: "De cada 100 remates propios, cuántos vienen de balón parado" },
          { que: "Las de estilo", es: "Córners y faltas a favor y la cuota de remates de ABP no se juzgan: sin percentil, el puesto va del más alto al más bajo" },
        ],
      },
    ],
    ojo: [
      "La Premier y Primera RFEF se comparan por percentiles, nunca cifra contra cifra.",
      "Un gemelo es parecido de perfil, no de nivel.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== ESCUDOS DE LA LIGA (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/escudos",
    titulo: "Escudos de la liga",
    resumen:
      "Los escudos de la categoría en un .pptx, por orden alfabético, cada uno como objeto suelto con su PNG transparente para copiar y pegar.",
    origen:
      "BeSoccer, a través de Supabase: el documento del informe del rival (rivals:informe, cada equipo y su clasificación) y el de los dos grupos de la categoría (escudos:categoria).",
    bloques: [
      {
        titulo: "Lo que hay",
        filas: [
          { que: "N escudos de BeSoccer", es: "Cuántos han llegado y de cuándo es el documento («actualizados el…»)" },
          { que: "Descargar .pptx", es: "Veinte escudos por diapositiva (5 × 4) sobre el azul noche del documento, recortado el aire de los márgenes", cuenta: "Espera a que lleguen todas las imágenes; la que no llega en 15 s sale sin ella" },
          { que: "Actualizar escudos", es: "Vuelve a pedir la lista" },
          { que: "Buscar", es: "Filtra la parrilla por nombre de equipo" },
          { que: "Cada tarjeta", es: "Copia ese escudo en PNG transparente; si el navegador no deja copiar imágenes, lo descarga" },
          { que: "Borde oro", es: "El nuestro" },
          { que: "Borde ámbar", es: "Trae fondo, no es transparente", cuenta: "Las cuatro esquinas del PNG son opacas" },
        ],
      },
    ],
    ojo: [
      "Si el documento del informe no está bajado al día, puede faltar algún equipo: la caja ámbar dice cuáles.",
      "Los nombres van como en la quiniela (lib/equipos/nombres.ts), no como los escribe BeSoccer.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== ANÁLISIS DE FALTAS (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/faltas",
    titulo: "Análisis de faltas",
    resumen:
      "Dónde se comete cada falta del partido, a favor y en contra, y cuánta gente defendía entre ella y la portería.",
    origen:
      "Etiquetado propio, viendo el partido falta a falta (scripts/abp-clips-preparar.mjs y scripts/faltas-datos.mjs escriben lib/faltas/datos.ts). El jugador, del timeline de Hudl por jugador. Al lado, Opta.",
    bloques: [
      {
        titulo: "Mandos",
        filas: [
          { que: "Partido", es: "Un botón por jornada etiquetada; abre en el último por fecha" },
          { que: "Todas / A favor / En contra", es: "A favor = nos la hacen a nosotros; en contra = la cometemos" },
          { que: "Filtrando", es: "Todo lo que se pincha (casilla del campo, distancia, número de defensores, celda de la tabla) filtra la pantalla entera" },
          { que: "Vistas", es: "Resumen, En el campo, Detalle, Por jugador y Falta a falta" },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "Comparativa", es: "El partido frente a la media de los anteriores: faltas a favor y en contra, frontales, en contra en nuestro campo y a favor en campo rival", cuenta: "Media por partido de los anteriores por fecha, con su mínimo y máximo; verde mejor, naranja peor, gris no se juzga" },
          { que: "Casos escasos", es: "Las filas con muy pocos casos, plegadas aparte" },
          { que: "Qué hacemos", es: "Las faltas en contra frente a la media, dónde se hicieron y la tarea con su criterio de éxito" },
          { que: "Opta · el Castilla en su grupo", es: "Faltas cometidas y recibidas por partido según Opta, con su puesto en el grupo; y el partido según Opta al lado del etiquetado" },
          PERCENTIL,
        ],
      },
      {
        titulo: "Campo y detalle",
        filas: [
          { que: "Dónde se cometen", es: "Cada punto, una falta en su tercio y carril; el Castilla ataca hacia la derecha", cuenta: "Se etiquetan zonas, no metros: dentro de una zona los puntos se reparten para no taparse" },
          { que: "Cuánta gente defendía", es: "Defensores entre la falta y su portería, portero incluido: la media y el reparto número a número", cuenta: "Las que no dejaban ver el campo entero no se cuentan" },
          { que: "Faltas que cortaron algo", es: "Las que frenaron una transición", cuenta: "3 defensores o menos por delante y fuera del último tercio" },
          { que: "A qué distancia", es: "Frontal, media o lejana, de la portería que ataca quien la saca" },
        ],
      },
      {
        titulo: "Por jugador y falta a falta",
        filas: [
          { que: "Comete / Recibe", es: "Faltas en contra que hace él y faltas que le hacen a él; este partido o la temporada", cuenta: "No se mira cuántos minutos jugó" },
          { que: "Cortan contra", es: "Las suyas con 3 defensores o menos del rival por delante, fuera del último tercio" },
          { que: "La tabla", es: "Lado, jugador, dónde, distancia, defendían, minuto y vídeo (nuestro corte o el partido en Hudl)" },
        ],
      },
    ],
    ojo: [
      "Los partidos mirados a ojo desde los clips, sin timeline de Hudl, no tienen jugador y no entran en «Por jugador».",
      "El etiquetado no apunta en qué acaba cada falta: el peligro se lee por el sitio.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== ROBOS Y TRANSICIONES (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/transiciones",
    titulo: "Robos y transiciones",
    resumen:
      "Cada balón que robamos de forma activa: dónde, qué es lo primero que hacemos con él y en qué acaba la jugada que nace de ahí.",
    origen:
      "El timeline de Hudl de cada partido (scripts/partido/robos.cjs, recogido en lib/transiciones/datos.ts por scripts/transiciones-datos.mjs). J2 y J3 se miraron imagen a imagen. Al lado, Opta.",
    bloques: [
      {
        titulo: "Mandos",
        filas: [
          { que: "Temporada / jornada", es: "Todos los partidos o uno; abre en el último por fecha" },
          { que: "Ver porcentajes / totales", es: "Cambia las cifras de los gráficos" },
          { que: "Quitar los dudosos", es: "Saca los robos con confianza baja" },
          { que: "Revisado entero", es: "Cuánto del partido está revisado; si falta, los totales son de esos minutos" },
          { que: "Filtrando", es: "Cualquier sector, barra, leyenda, cifra o celda que se pincha filtra la pantalla entera" },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "Comparativa", es: "El último partido frente a la media de los anteriores: robos, salen hacia delante, acaban en remate o área, la perdemos al momento, robos en campo rival y duración", cuenta: "Media por partido con los mismos filtros, con mínimo y máximo; «muestra pequeña» por debajo de 15" },
          { que: "Lo que pide trabajo esta semana", es: "La cifra peor que nuestra media, con la tarea y su criterio de éxito («Qué entrenamos para mantenerlo» si todo va bien)" },
          { que: "Salen hacia delante", es: "Lo primero tras el robo es un pase o conducción hacia delante", cuenta: "Sobre los robos que se juegan con pase o conducción" },
          { que: "Dura la transición", es: "Segundos de media de la jugada tras el robo" },
          { que: "Opta · el Castilla en su grupo", es: "Recuperaciones (total y por tercio), intercepciones y PPDA por partido, con su puesto en el grupo" },
          PERCENTIL,
        ],
      },
      {
        titulo: "Campo, detalle y jugadores",
        filas: [
          { que: "Dónde robamos", es: "Cada robo en su tercio y carril; el Castilla ataca hacia la derecha" },
          { que: "Qué hacemos con el balón robado", es: "Adelante, horizontal o atrás, despeje o pérdida inmediata" },
          { que: "Dónde robamos y cómo salimos", es: "Por tercio, cuántos salen hacia delante" },
          { que: "En qué acaba la transición", es: "Remate, balón al área, último tercio, falta, posesión larga, atrás al portero, fuera o la perdemos" },
          { que: "Cuándo robamos / Por qué carril", es: "Por tramos de 15 minutos y por carril" },
          { que: "Quién roba", es: "Por jugador: en campo rival, salen adelante, remate o área, remate y perdida al momento" },
          { que: "Robo a robo", es: "Minuto, zona, carril, salida, en qué acaba, fiabilidad y la jugada (corte de Hudl, 5 s antes y 8 después)" },
        ],
      },
    ],
    ojo: [
      "Robo es la recuperación activa: entrada, interceptación o balón ganado por presión, con el balón en juego. Rechaces sin disputa, paradas o balón parado no cuentan.",
      "La transición son los 15 s tras el robo: lo que llega después cuenta como posesión.",
      "La «recuperación» de Opta no es la misma cuenta que el robo de aquí: se enseñan aparte.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== PÉRDIDAS Y TRANSICIONES DEFENSIVAS (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/perdidas",
    titulo: "Pérdidas y transiciones defensivas",
    resumen:
      "El espejo de los robos: cada balón que perdemos en juego, qué es lo primero que hace el rival con él y en qué acaba su posesión.",
    origen:
      "El timeline de Hudl de cada partido (scripts/partido/perdidas.cjs, recogido en lib/transiciones/datos.ts). Salen solas con «Actualizar análisis del partido» de Ajustes. J2 y J3 no tienen pérdidas. Al lado, Opta.",
    bloques: [
      {
        titulo: "Mandos",
        filas: [
          { que: "Temporada / jornada", es: "Todos los partidos o uno; abre en el último por fecha" },
          { que: "Ver porcentajes / totales", es: "Cambia las cifras de los gráficos" },
          { que: "Quitar los dudosos", es: "Saca las pérdidas con confianza media (las que Wyscout no clasifica como pase, conducción o duelo)" },
          { que: "Revisado entero", es: "Cuánto del partido está revisado; si falta, los totales son de esos minutos" },
          { que: "Filtrando", es: "Cualquier sector, barra, leyenda, cifra o celda que se pincha filtra la pantalla entera" },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "Comparativa", es: "El último partido frente a la media de los anteriores: pérdidas, el rival sale hacia delante, acaban en remate o en nuestra área, la recuperamos al momento, pérdidas en campo propio y duración de su posesión", cuenta: "Media por partido con los mismos filtros, con mínimo y máximo; aquí, en casi todas, menos es mejor" },
          { que: "Lo que pide trabajo esta semana", es: "La cifra peor que nuestra media, con la tarea y su criterio de éxito («Qué entrenamos para mantenerlo» si todo va bien)" },
          { que: "El rival sale hacia delante", es: "Lo primero que hace con el balón es un pase o conducción hacia delante: lo malo", cuenta: "Sobre las pérdidas que el rival llega a jugar" },
          { que: "Dura su transición", es: "Segundos de media de la posesión del rival tras la pérdida" },
          { que: "Opta · el Castilla en su grupo", es: "Pérdidas (total y por tercio) y balones robados en conducción por partido, con su puesto en el grupo" },
          PERCENTIL,
        ],
      },
      {
        titulo: "Campo, detalle y jugadores",
        filas: [
          { que: "Dónde perdemos el balón", es: "Cada pérdida en su tercio y carril; el Castilla ataca hacia la derecha" },
          { que: "Qué hace el rival con el balón perdido", es: "Sale hacia delante, horizontal o atrás, despeja o la recuperamos al momento" },
          { que: "Dónde perdemos y cómo salen", es: "Por tercio, cuántas sale el rival hacia delante; la de campo propio es la que más peligro trae" },
          { que: "En qué acaba su transición", es: "La recuperamos, nos hacen falta, fuera, atrás a su portero, se quedan el balón, falta nuestra, último tercio, nuestra área o remate" },
          { que: "Cuándo perdemos / Por qué carril", es: "Por tramos de 15 minutos y por carril" },
          { que: "Quién pierde el balón", es: "Por jugador: en nuestro campo, caras (acaban en remate o en nuestra área), remate rival, salen adelante y recuperada" },
          { que: "Pérdida a pérdida", es: "Minuto, zona, carril, su salida, en qué acaba, fiabilidad y la jugada (corte de Hudl, 5 s antes y 8 después)" },
        ],
      },
    ],
    ojo: [
      "La salida y el desenlace son del rival: verde es lo bueno para nosotros, naranja lo malo.",
      "Pérdida es un balón nuestro que pasa al rival en juego: pase que no llega, conducción cortada, control o duelo perdido. Remates, despejes y faltas pitadas no cuentan.",
      "La «pérdida» de Opta no es la misma cuenta que la de aquí: se enseñan aparte.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== CREAR O EDITAR EL MICROCICLO (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/microciclo",
    titulo: "Crear o editar el microciclo",
    resumen: "Preparar la semana que viene, o retocar una ya escrita, y escribirla en la hoja de registro de tareas.",
    origen: "La hoja de registro de tareas (la misma que leen Microciclos, el microciclo de ABP y Data análisis) y el calendario del Castilla que baja de BeSoccer el ordenador del club. Los equipos del día salen de Jugadores sesión y del análisis de entrenamiento.",
    bloques: [
      {
        titulo: "1 · La semana",
        filas: [
          { que: "Días de la semana", es: "Del día siguiente al partido anterior hasta el del próximo, cada uno con su MD", cuenta: "El MD+1 viene marcado como libre; un día libre no escribe ninguna fila" },
          { que: "Partir de lo que ya está en la hoja", es: "El último microciclo con tareas, otro cualquiera o la semana en blanco", cuenta: "Las tareas entran atadas por MD: el MD-2 de aquella semana al MD-2 de ésta" },
          { que: "Copiar también el tiempo y la intensidad", es: "Si no se marca, se copian tareas y contenidos pero no los minutos ni la intensidad" },
          { que: "Semana tipo / Todos los días de entreno", es: "Atajos: libre sólo el MD+1, o sesión todos los días" },
          { que: "Editar o copiar un microciclo", es: "Abre uno de la hoja con todas sus columnas, o copia la semana de uno sobre otro", cuenta: "La evaluación y el análisis post de sus filas no se tocan" },
        ],
      },
      {
        titulo: "2 · La semana en el tablero",
        filas: [
          { que: "Cabecera", es: "Tareas, minutos de entreno, minutos de partido y minutos de balón parado de la semana", cuenta: "Las tareas sin minutos no suman a la carga" },
          { que: "Barra de carga del día", es: "La carga del día frente a la media de ese MD esta temporada (la marca encima)", cuenta: "Carga = tiempo × intensidad. Sin el microciclo que se edita; sin tres sesiones parecidas no se compara" },
          { que: "Minutos por fase", es: "En la leyenda, los minutos de la semana de cada familia de fase; el partido no cuenta" },
          { que: "Objetivo de la semana", es: "Una línea que sale en la lámina y abre el texto del grupo. No se escribe en la hoja" },
          { que: "Copiar texto · WhatsApp · Correo · Lámina PNG · PDF", es: "La semana en texto para el cuerpo técnico, o en una lámina (el PDF, A4 apaisado)" },
          { que: "Atajos", es: "Ctrl+Z deshacer, Ctrl+Y rehacer; con el foco en un día, Alt+N tarea nueva y Alt+C copiar un día de otro microciclo" },
        ],
      },
      {
        titulo: "Cada día y cada tarea",
        filas: [
          { que: "Rellenar rápido", es: "En un día vacío: la sesión tipo de ese MD, el último día con el mismo MD o elegir otro día" },
          { que: "Avisos del día", es: "Minutos frente a la media del MD y tareas sin tipo, fase, contenido o minutos", cuenta: "Se resalta si se separa un 25 % o más de la media. Sin intensidad sólo avisa en días ya pasados" },
          { que: "Poner los minutos habituales", es: "Rellena los minutos vacíos con lo que suele durar cada ejercicio en la hoja" },
          { que: "Corta / larga", es: "Junto a los minutos de la sesión", cuenta: "Corta por debajo de 35′, larga por encima de 75′; el día de partido nunca es larga" },
          { que: "Demanda cognitiva", es: "Los seis campos (jugadores, comodines, normativa, incertidumbre, familiaridad, motivación); en gris, lo que propone la hoja por tareas parecidas" },
          { que: "Evaluación y análisis post", es: "La nota y el análisis tras la sesión; sólo en los días que ya han llegado" },
          { que: "Lo que pasó en la sesión", es: "Los equipos de Jugadores sesión y lo del análisis de entrenamiento; lo cambiado llega como propuesta y se acepta con un clic" },
        ],
      },
      {
        titulo: "3 · Escribir en la hoja",
        filas: [
          { que: "Revisar", es: "La tabla de filas que se van a escribir: fecha, tarea, tipo, fase, contenido, tiempo, intensidad y cognitiva" },
          { que: "Antes de escribir", es: "Lo que impide escribir; «Antes de mandar la semana» son avisos que no bloquean" },
          { que: "Escribir en la hoja", es: "Nuevo: añade las filas al final de la pestaña. Editando o con «Borrar sus filas y escribirlas otra vez»: las sustituye en su sitio", cuenta: "Las tareas en blanco (sin tipo, contenido ni tiempo) no se escriben" },
        ],
      },
    ],
    ojo: [
      "Escribe en la hoja de verdad: se mira la tabla de «Revisar» antes de pulsar.",
      "Carga ponderada, carga cognitiva y demanda cognitiva son fórmulas de la hoja: no se mandan, las filas nuevas las heredan de la de arriba.",
      "El borrador se guarda en este navegador mientras se rellena; si ya está en la hoja o tiene más de tres semanas, se tira.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== VÍDEO ANÁLISIS PARTIDOS (12/11/2026) ==================== */
  {
    ruta: "/match-plans",
    titulo: "Vídeo Análisis Partidos",
    resumen: "El vídeo de análisis de cada partido ya jugado, microciclo a microciclo, con el balance de la liga arriba.",
    origen: "La hoja de vídeos de partido (microciclo, fecha, resultado, partido y enlace), completada con el calendario de BeSoccer para los partidos de liga que no están en ella. La media de la liga sale del análisis de goles de la categoría. Hudl, la grabación táctica y el resumen RFEF, de los enlaces de cada día.",
    bloques: [
      {
        titulo: "El balance",
        filas: [
          { que: "Ganamos · empatamos · perdimos", es: "El reparto de los partidos de liga con resultado; la pretemporada no cuenta" },
          { que: "Tendencia reciente", es: "Los puntos de los últimos cinco y cuáles son", cuenta: "Victoria 3, empate 1; sale con tres partidos o más" },
          { que: "Partido a partido", es: "La tira de resultados del más antiguo al más reciente, con la jornada debajo", cuenta: "Verde victoria, ámbar empate, rojo derrota; borde dorado, los cinco últimos" },
          { que: "Goles a favor / en contra", es: "La suma y la media por partido, frente a la media de la liga", cuenta: "Liga = goles por equipo y partido de todos los equipos; ▲ mejor, ▼ peor, «igual» si la diferencia es menor de 0,05" },
          { que: "Diferencia", es: "Goles a favor menos goles en contra" },
        ],
      },
      {
        titulo: "La lista",
        filas: [
          { que: "Buscar", es: "Por rival, partido, microciclo o fecha" },
          { que: "Microciclo", es: "Un microciclo o todos; «Todos» dice cuántos son de liga y cuántos de pretemporada" },
          { que: "Victorias · Empates · Derrotas", es: "Filtra por resultado" },
          { que: "Solo con vídeo", es: "Encendido al entrar: sólo los partidos con vídeo en la hoja o con cortes en Coding" },
          { que: "Ver vídeo análisis", es: "Abre el vídeo de la hoja en un pop-up, con anterior y siguiente" },
          { que: "Cortes en Coding", es: "Sale en los partidos de liga sin enlace en la hoja: lleva a su lista en Coding" },
          { que: "Hudl · Grabación táctica · Resumen RFEF", es: "Debajo de cada tarjeta, lo que exista; la grabación táctica sólo en el ordenador principal" },
        ],
      },
    ],
    ojo: [
      "Las cifras de arriba siguen a los filtros: con un microciclo o «Victorias» elegidos, cuentan sólo esos partidos.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== PIZARRA DE COMPETICIÓN (12/11/2026) ==================== */
  {
    ruta: "/pizarra",
    titulo: "Pizarra de Competición",
    resumen: "La alineación y el banquillo del partido, y un tablero para la fase defensiva y otro para la ofensiva.",
    origen: "Los jugadores, de la plantilla de la hoja. La disponibilidad se comparte con el staff (Supabase); las alineaciones guardadas van a la hoja por el Apps Script.",
    bloques: [
      {
        titulo: "Las cifras de arriba",
        filas: [
          { que: "Disponibles", es: "Jugadores de la plantilla sin baja marcada" },
          { que: "Bajas", es: "Los que tienen baja; debajo, el motivo más repetido" },
          { que: "En el once", es: "Puestos ocupados del dibujo" },
          { que: "Banquillo", es: "Suplentes convocados" },
          { que: "No Castilla", es: "Convocados (once y banquillo) con otra licencia", cuenta: "El tope es 4: por encima, la tarjeta se pone roja" },
        ],
      },
      {
        titulo: "Alineación y banquillo",
        filas: [
          { que: "Plantilla", es: "Buscador por nombre, apodo o dorsal, filtro por línea (POR, DEF, MED, ATA) y por disponibles o bajas" },
          { que: "Chip OK / TOC / LES…", es: "La disponibilidad de cada uno: tocado, lesionado, sancionado, primer equipo, selección o no disponible" },
          { que: "Colocar", es: "Arrastrar la foto al campo o pulsar + y luego un puesto; doble clic lo saca. Una baja no entra" },
          { que: "4-4-2 · 4-3-3 · 4-2-3-1 · 3-5-2 · 3-4-3", es: "El dibujo del campo" },
          { que: "Guardar / Actualizar", es: "Escribe la alineación en la hoja con nombre, rival, fecha y sistema", cuenta: "El nombre tiene que ser «Jornada» y su número" },
          { que: "Alineaciones guardadas", es: "Las jornadas guardadas; abrir una sustituye lo que hay en el campo" },
          { que: "Exportar · Compartir", es: "Imagen PNG de la alineación, o mandarla (en el móvil abre WhatsApp, correo…)" },
        ],
      },
      {
        titulo: "Fase defensiva · Fase ofensiva",
        filas: [
          { que: "Tablero", es: "Fichas, flechas, zonas y escenas para explicar cómo defenderemos o atacaremos" },
          { que: "Colocar alineación", es: "Pone en la primera escena a los once de «Alineación y banquillo»; se puede deshacer" },
          { que: "▶ de la barra de escenas", es: "Reproduce la secuencia de escenas" },
        ],
      },
    ],
    ojo: [
      "Una baja marcada desde otro aparato saca al jugador del once y del banquillo.",
      "Sólo salen en «Alineaciones guardadas» las que se llaman «Jornada N».",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== PIZARRA DE SESIÓN (12/11/2026) ==================== */
  {
    ruta: "/pizarra_sesion",
    titulo: "Pizarra de Sesión",
    resumen: "Quién puede entrenar hoy y un campograma por tarea para repartir los equipos con petos.",
    origen: "La hoja de disponibilidad por sesión: se toma la última fecha con más de cuatro jugadores. La pizarra de cada fecha se guarda en Supabase y la comparte el staff.",
    bloques: [
      {
        titulo: "Las cifras",
        filas: [
          { que: "Convocados", es: "Los de la última sesión que pueden entrenar", cuenta: "Estado óptimo, disponible, control de carga, tocado, reincorporación o sancionado" },
          { que: "En sesión", es: "Convocados menos los apartados" },
          { que: "Apartados", es: "Los que se han quitado de la sesión con un clic en el campograma" },
          { que: "Tareas", es: "Cuántas tareas tiene la pizarra de esta fecha" },
        ],
      },
      {
        titulo: "Campogramas",
        filas: [
          { que: "Fecha de la sesión", es: "Cada fecha tiene su pizarra; por defecto, hoy" },
          { que: "Campograma de sesión", es: "Todos los que pueden entrenar, con el color de su estado; un clic lo aparta y lo saca de todas las tareas" },
          { que: "Campogramas por tarea", es: "Una pestaña por tarea con nombre, formato, duración y objetivo; los jugadores se arrastran a cada equipo" },
          { que: "Repartir equipos", es: "Reparte a los que están en sesión", cuenta: "Un portero por equipo y el resto por líneas (defensas, medios, delanteros) en ida y vuelta" },
          { que: "Añadir equipo · Vaciar tarea", es: "Hasta cuatro equipos por tarea; vaciar los deja sin jugadores" },
          { que: "Petos", es: "Amarillo, naranja, verde o sin peto" },
          { que: "Guardado · Sin guardar · Solo en este dispositivo", es: "Estado del guardado; con fallo, el rótulo es un botón que reintenta" },
        ],
      },
    ],
    ojo: [
      "Si no hay nadie disponible, la disponibilidad se importa en Jugadores sesión.",
      "Quitar una tarea con jugadores repartidos pregunta antes: no hay deshacer.",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== SCOUT INDIVIDUAL (12/11/2026) ==================== */
  {
    ruta: "/scout-rival-individual",
    titulo: "Vídeos del rival",
    resumen: "Los cortes de cada rival que montamos en el coding, repartidos por jugador, y cuántas veces se ven.",
    origen: "El canal de YouTube del club, con una lista por rival. La plantilla, el puesto y las etiquetas (campo IMPACTO) salen de la hoja de plantillas rivales; partidos y minutos, de BeSoccer; el once probable, de Plantillas rivales (Supabase).",
    bloques: [
      {
        titulo: "Clips",
        filas: [
          { que: "Rival", es: "La tira de escudos, ordenada por calendario: primero el próximo, con la chapa «Próximo» y su jornada" },
          { que: "La lista", es: "Se empareja sola por el nombre del equipo; si no casa, se elige una vez y vale para todo el cuerpo técnico" },
          { que: "Chips de jugador", es: "Índice y filtro: por puesto y, dentro, primero el once probable y luego por minutos", cuenta: "El número es cuántos cortes tiene; «Todos los vídeos» cuenta cortes, no jugadores" },
          { que: "Por jugador · Todos", es: "Agrupado por jugador, o todos los cortes seguidos" },
          { que: "Ficha del corte", es: "Jugador, puesto, etiquetas y de qué va; abajo, la lista, el número de corte y las vistas en YouTube", cuenta: "Etiquetas: verde = lo que hace bien, naranja = lo que podemos explotar" },
          { que: "Titular en X de Y", es: "Titularidades y partidos de la temporada, con los minutos de BeSoccer" },
          { que: "Del equipo", es: "Los cortes cuyo título no dice con seguridad de quién son" },
          { que: "Buscar · Copiar enlaces", es: "Busca en los títulos (córner, pérdida, un nombre…) y copia los enlaces de lo que se ve" },
        ],
      },
      {
        titulo: "Visionados",
        filas: [
          { que: "Vistas en YouTube", es: "Vistas acumuladas de todos los clips del canal desde la jornada 1", cuenta: "«+» = vistas desde la foto anterior; se hace una al día" },
          { que: "Clips vistos · Sin ver", es: "Cuántos clips tienen alguna vista y cuántos ninguna" },
          { que: "Vistas por clip", es: "La mediana de vistas por clip del canal" },
          { que: "El más visto", es: "El clip con más vistas, con su jugador y rival" },
          { que: "Por rival y jornada · Por puesto · Por jugador", es: "Las vistas repartidas", cuenta: "Jugador y puesto salen del título del vídeo contra la plantilla del rival; lo que no se cruza no se nombra" },
          { que: "Aperturas desde la app", es: "Cada vez que alguien abre un clip en Clips, desde el 06/11/2026: quién, de qué puestos y de qué rivales", cuenta: "Aparte: no suman a las cifras de YouTube. Con menos de 15 aperturas, el reparto es sólo tendencia" },
          { que: "Viendo como", es: "El nombre de quien mira en este aparato, para apuntar quién abre cada clip" },
        ],
      },
    ],
    ojo: [
      "YouTube dice cuántas veces se ve un vídeo, nunca quién.",
      "Un dorsal repetido dentro del mismo rival en la hoja no se pinta en ninguno de los dos hasta corregirlo.",
      "/visionados lleva a esta pantalla, en la pestaña «Visionados».",
    ],
    revisada: "2026-11-12",
  },

  /* ==================== IDENTIDAD POSICIONAL (12/11/2026) ==================== */
  {
    ruta: "/identidad-posicional",
    titulo: "Identidad posicional",
    resumen: "Los contenidos individuales de cada puesto, con balón y sin balón, y cómo están nuestros jugadores en lo que se mide.",
    origen: "La hoja de identidad posicional (una fila por contenido); la escribe el cuerpo técnico, aquí o en la hoja. Los jugadores del puesto, de la plantilla; las cifras, de Wyscout (liga).",
    bloques: [
      {
        titulo: "La pantalla",
        filas: [
          { que: "Posiciones", es: "Los puestos de la hoja; el buscador filtra los contenidos" },
          { que: "Con balón / Sin balón", es: "Los contenidos del puesto en dos columnas, con cuántos hay en cada una", cuenta: "Fuera de edición, primero los que se miden" },
          { que: "Sus jugadores · su área de mejora", es: "Los de la plantilla en ese puesto; cada chip abre su área de mejora en Individual" },
          { que: "Ficha del contenido", es: "Si la hoja lo trae, se despliega con definición, qué se ve, criterio y clip" },
        ],
      },
      {
        titulo: "Lo que se mide",
        filas: [
          { que: "Se mide en el partido", es: "La métrica de Wyscout con que se sigue ese contenido; sin métrica no sale nada" },
          { que: "▲ / ▼ / =", es: "Cada jugador nuestro frente a la mediana del puesto en la categoría", cuenta: "▲ mejor, ▼ peor, = la misma cifra con los decimales que se enseñan. Con el sentido de la métrica puesto" },
          { que: "Mediana", es: "La de los jugadores del puesto en la categoría", cuenta: "Sólo con 450′ o más de liga, y con al menos seis para comparar" },
          { que: "Objetivo en la tarea", es: "Si alguno queda por debajo: llegar a la mediana (o bajar de ella si menos es mejor)" },
          { que: "Por dónde empezar a entrenar", es: "El contenido medido con más jugadores nuestros por debajo de la mediana", cuenta: "Por la proporción de los que quedan por debajo; empate, por el número" },
        ],
      },
      {
        titulo: "Editar",
        filas: [
          { que: "Editar", es: "Cada contenido se guarda solo en la hoja unos segundos después de dejar de escribir" },
          { que: "Nuevo contenido · Eliminar", es: "Añade un contenido al puesto y bloque, o lo borra (pregunta antes)" },
        ],
      },
    ],
    ojo: [
      "Un jugador con menos de 450′ de liga sale en los chips pero no en las cifras, y su chip lo dice.",
      "Si el guardado no llega a la hoja, se sigue en edición y se reintenta solo.",
    ],
    revisada: "2026-11-12",
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
