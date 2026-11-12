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
    resumen: "Cada tarea de cada sesión, con su contenido, su carga y su valoración, micro a micro.",
    origen: "Hoja de microciclos, una fila por tarea (la escribe el cuerpo técnico). Los equipos del día, de Jugadores sesión; lo medido en la sesión, del análisis de entrenamiento.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "La tira de microciclos",
        filas: [
          { que: "Micro N · rival", es: "Una tarjeta por semana, la última primero; pulsarla filtra la pantalla entera. «Todos» = la temporada" },
          { que: "Val. 6,8", es: "Valoración media de sus tareas de entreno; en gris y con «· 5 de 13» si es provisional" },
          { que: "La barra", es: "Su carga física frente al micro que más carga tiene" },
          { que: "Editar este micro", es: "Lo abre en el editor de microciclos (mover tareas, copiar días, sacar la lámina)" },
          { que: "Informe del partido", es: "Previa o post del partido de ese micro: resumen en tres diapositivas e informe completo, por correo" },
        ],
      },
      {
        titulo: "Las cifras de cabecera",
        filas: [
          { que: "Tareas", es: "Las filas filtradas, con el desglose «de entreno · entrenos + partidos»", cuenta: "El partido es la fila de competición del día MD" },
          { que: "Tiempo total", es: "Suma de los minutos de las tareas filtradas, partido incluido", cuenta: "Debajo, el tiempo total ÷ nº de tareas" },
          {
            que: "Valoración media",
            es: "La nota del staff, de 1 a 10, sólo de las tareas de entreno valoradas",
            cuenta: "Con menos de la mitad valoradas pasa a «Valoración provisional», en gris y comparada como tendencia",
          },
          { que: "Carga física", es: "Suma de la columna de carga de la hoja (minutos × intensidad)", cuenta: "Debajo, la carga ÷ nº de tareas" },
          { que: "Carga cognitiva", es: "Lo mismo con la columna cognitiva (minutos × demanda cognitiva)" },
          { que: "Cognitiva / física", es: "Si la semana pide más cabeza o más piernas", cuenta: "Carga cognitiva ÷ carga física. Más de 1, pesa lo cognitivo" },
          {
            que: "Frente al M anterior",
            es: "Con un micro elegido, cada tarjeta dice cuánto cambia frente al micro anterior, con el antes → después",
            cuenta: "Si hay días sin medir, compara sólo los días MD medidos contra esos mismos días del anterior",
          },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Resumen", es: "La semana en sesión, Lecturas del periodo, carga por día MD, perfil del micro, tendencia de la valoración y reparto por fase" },
          { que: "La semana en sesión", es: "Cada día del micro elegido con sus tareas, los equipos de Jugadores sesión y lo que midió el análisis de entrenamiento" },
          { que: "Cargas", es: "Mapa de calor micro × día (pulsar filtra), carga acumulada por micro, física frente a cognitiva por tarea, tiempo por día e intensidad" },
          { que: "Contenidos", es: "Contenido principal y secundario (los 15 primeros), tabla comparativa, valoración por tipo de tarea y los 12 formatos más usados" },
          { que: "Cognitivo", es: "Normativa, incertidumbre, dificultad y motivación llevadas a 0-10; su evolución por día, demanda frente a valoración y análisis post-tarea" },
          { que: "Tareas", es: "Las 5 mejor valoradas, las 5 a revisar y la tabla entera, que se ordena por columna y sale en «Exportar CSV»" },
        ],
      },
      {
        titulo: "Cómo se ordena",
        filas: [
          { que: "MD-5 … MD", es: "Días contando hacia atrás desde el partido. MD es el día de partido" },
          { que: "Filtros", es: "Microciclo, día (MD), tipo de tarea, contenido principal, fase, valoración mínima y buscador" },
          { que: "Formato", es: "8v8+3 = ocho contra ocho más tres comodines" },
        ],
      },
    ],
    ojo: [
      "«Competición excluida» (por defecto) quita el partido de los gráficos de método: un partido de 90 minutos tapa el reparto de la semana. Las tarjetas de cabecera sí lo cuentan.",
      "Un micro sin minutos ni intensidad no enseña tiempo ni carga: sólo tareas y valoración.",
    ],
  },

  /* ==================== BALÓN PARADO ==================== */
  {
    ruta: "/setpieces",
    titulo: "ABP Ofensivo",
    resumen: "Córners y faltas a favor, acción por acción: qué se lanza, dónde cae, quién remata y cuánto peligro deja.",
    origen: "Nuestra hoja de ABP ofensivo, una fila por acción, registrada a mano. El corte de cada acción, de Hudl (doc «abp:cortes»); la categoría, de Opta.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Las tarjetas",
        filas: [
          { que: "Acciones lanzadas", es: "Córners y faltas a favor con los filtros puestos", cuenta: "Debajo, la temporada: total, jornadas y por partido" },
          { ...XG, que: "Goles esperados", es: "Lo que valían las acciones, entraran o no" },
          { que: "Remates", es: "Acciones con remate (todo menos «No Remate» y «No aplica»)" },
          { que: "Goles", es: "Sólo los nuestros; pulsar filtra las acciones de gol" },
          { que: "Conversión", es: "Goles ÷ remates", cuenta: "Sólo sale con 5 remates o más" },
          { que: "Goles esperados por ABP", es: "Peligro medio de cada lanzamiento", cuenta: "Goles esperados ÷ acciones. Sólo con 15 acciones o más" },
          { que: "Gol u ocasión", es: "Acciones cuyo resultado final es Gol u Ocasión", cuenta: "Gol u ocasión ÷ acciones" },
          {
            que: "Sacador con más goles esperados",
            es: "El que más suma, con su media por envío frente a la del equipo",
            cuenta: "Sólo sale si supera esa media en 0,02 o más; con menos de 5 envíos, «indicio»",
          },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Resumen", es: "Conclusiones, lectura rápida, este partido frente a la media de las jornadas anteriores, lectura por envío y «Acción a acción»" },
          { que: "Acción a acción", es: "Cada acción del partido con «Ver la acción» (nuestro corte) y «Abrir en Hudl» en su segundo" },
          { que: "Dónde cae", es: "Zona de caída, zona de remate, segundo balón, superioridad en corto y goles esperados por zona" },
          { que: "Cómo lo sacamos", es: "Tipo de acción, tipo de envío, carrera, rutinas, calidad del envío (1 a 4) y atacantes en el área" },
          { que: "Quién", es: "Impacto de sacadores y rematadores, defensa rival y goles esperados contra cada rival" },
          { que: "Cuándo", es: "Tramo de 15′, según el marcador y resultado final" },
          { que: "Clips de la jornada", es: "Nuestros cortes de la jornada anterior (en la carpeta del rival, «… CASTILLA»): criba, etiquetas y texto" },
          { que: "Categoría · Opta", es: "El Castilla frente a su grupo y la categoría, y cada córner y falta de la temporada (se carga al abrirlo)" },
        ],
      },
      {
        titulo: "Qué mide cada cosa",
        filas: [
          { que: "Segundo balón", es: "Quién gana el rechace tras el primer contacto", cuenta: "Ganado / perdido / no hubo, siempre desde nuestro lado" },
          { que: "Rutina", es: "La jugada ensayada que se buscaba. Es lo que no tiene ningún informe comprado" },
          { que: "Rival", es: "Las pastillas bajo los filtros: pulsar una deja sólo ese rival" },
          { que: "PDF", es: "El botón redondo de arriba: todos los gráficos con los filtros aplicados, en segundo plano" },
        ],
      },
    ],
    ojo: [
      "Por defecto va sin pretemporada: los amistosos de julio son contra equipos de otra categoría; se incluyen a propósito desde el filtro de competición.",
      "Con «Todas» las jornadas, la comparativa del partido usa la última; el resto de la página suma todos los partidos.",
    ],
  },
  {
    ruta: "/setpieces_def",
    titulo: "ABP Defensivo",
    resumen: "Córners y faltas en contra, acción por acción: dónde nos atacan, quién nos hace daño y cuánto conceden.",
    origen: "Nuestra hoja de ABP defensivo, una fila por acción del rival. El corte de cada acción, de Hudl (doc «abp:cortes»); la categoría, de Opta.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Las tarjetas",
        filas: [
          { que: "Remates concedidos", es: "ABP del rival que acaban en remate · menos es mejor", cuenta: "Acciones con remate ÷ acciones" },
          { que: "Gol u ocasión", es: "ABP del rival que acaban en «Gol Rival» u «Ocasión»", cuenta: "Ojo: en esta hoja el sujeto de «Ocasión» es el rival, no nosotros" },
          { ...XG, que: "Goles esperados concedidos", es: "Lo que valían los remates del rival en su ABP" },
          { que: "Goles encajados de ABP", es: "Los «Gol Rival»; pulsar filtra esas acciones" },
          { que: "Media de las N jornadas anteriores", es: "Con una jornada elegida, debajo de cada tarjeta: la misma cifra en los partidos de antes" },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Resumen", es: "Conclusiones, lectura rápida, este partido frente a los anteriores y «Acción a acción» con su corte y su segundo de Hudl" },
          { que: "Dónde cae", es: "Zona de caída, zona de remate, segundo balón, superioridad en corto y goles esperados concedidos por zona" },
          { que: "Cómo nos atacan", es: "Tipo de acción, tipo de envío, carrera, calidad del envío rival y estructura de la jugada (atacantes en el área)" },
          { que: "Quién nos hace daño", es: "Goles esperados concedidos por perfil de golpeo, por tipo de remate y a cada rival" },
          { que: "Cuándo", es: "Tramo de 15′, según el marcador y resultado final" },
          { que: "Categoría · Opta", es: "Lo que le hacen al Castilla frente a la categoría y cada córner y falta que nos han sacado" },
        ],
      },
      {
        titulo: "Qué mide cada cosa",
        filas: [
          { que: "Segundo balón", es: "Ganarlo aquí es cortar la jugada antes de la segunda ola" },
          { que: "Rival", es: "Las pastillas bajo los filtros: pulsar una deja sólo ese rival" },
          { que: "PDF", es: "El botón redondo de arriba: todos los gráficos con los filtros aplicados" },
        ],
      },
    ],
    ojo: [
      "«Gol RMCF» y «Transición Ofensiva» son nuestros: se marcan a mano porque el sujeto por defecto es el rival.",
      "Por defecto va sin pretemporada, como el ofensivo.",
    ],
  },
  {
    ruta: "/throw-ins",
    titulo: "Saque de Banda Ofensivo",
    resumen: "Cada saque de banda a favor: dónde se saca, adónde va y en qué acaba.",
    origen: "Nuestra hoja de saque de banda ofensivo, una fila por saque. El corte y el segundo de Hudl, del doc «banda:cortes»; la categoría, de Opta.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Las cifras",
        filas: [
          { que: "Saques registrados", es: "Los saques con los filtros puestos" },
          { que: "% Progresión", es: "Envíos hacia delante o al área", cuenta: "Dirección del envío «Progresión…» o al área ÷ saques" },
          {
            que: "% Retención",
            es: "El saque acaba con el balón para el RMCF",
            cuenta: "Resultados nuestros (posicional, ABP, último tercio, ocasión, gol) ÷ saques. Por debajo de la mitad, el saque es una pérdida con otro nombre",
          },
          { que: "Producción", es: "Saques que llegan a último tercio, ocasión o gol nuestro", cuenta: "Nº y % sobre los saques" },
          { que: "Calidad media de envío", es: "Nota de 1 (malo) a 4 (perfecto) de los saques valorados, con la media de la temporada" },
          { que: "Este partido frente a los anteriores", es: "Con jornada, la tabla del partido contra la media de las anteriores; entonces las cifras de arriba no se repiten" },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Resumen", es: "Lectura rápida, comparativa del partido, conclusiones, leyenda y lectura por resultado" },
          { que: "Dónde", es: "Mapa por zonas (con el nº de saques) y campo con cada saque; pulsar filtra" },
          { que: "Cómo acaban", es: "Flujo del saque al resultado y reparto por banda, envío, receptor, intención, rutina, sacador…" },
          { que: "Saque a saque", es: "La tabla entera, con el vídeo de cada saque y «Hudl» en su segundo cuando están cortados" },
          { que: "Categoría · Opta", es: "El Castilla frente a la categoría y cada saque de la temporada (se carga al abrirlo)" },
        ],
      },
      {
        titulo: "Cómo se lee",
        filas: [
          { que: "Zona de saque", es: "Zona 1 tercio propio, 2 central, 3 último tercio (junto al área rival)" },
          { que: "Dirección del envío", es: "Progresión o retroceso, por carril, o al área" },
          { que: "Descargar PNG", es: "La pantalla entera con los filtros, en imagen" },
        ],
      },
    ],
    ojo: [
      "Por defecto va sin pretemporada; se puede incluir desde el filtro de competición.",
      "Un partido da 10-20 saques: con poca muestra, la comparación es tendencia.",
    ],
  },
  {
    ruta: "/throw-ins-def",
    titulo: "Saque de Banda Defensivo",
    resumen: "Cada saque de banda del rival: dónde saca, adónde va y en qué acaba.",
    origen: "Nuestra hoja de saque de banda defensivo, una fila por saque del rival. El corte y el segundo de Hudl, del doc «banda:cortes»; la categoría, de Opta.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Las cifras",
        filas: [
          { que: "Saques del rival", es: "Sus saques con los filtros puestos" },
          { que: "% Progresión concedida", es: "Envíos del rival hacia delante o al área · menos es mejor" },
          { que: "% Recuperación", es: "El saque acaba con el balón para el RMCF", cuenta: "Resultados nuestros ÷ saques del rival" },
          { que: "Peligro concedido", es: "Saques suyos que le llegan a último tercio, ocasión o gol · menos es mejor", cuenta: "Nº y % sobre sus saques" },
          { que: "Transiciones tras robo", es: "Le robamos el saque y llegamos a último tercio, ocasión o gol nuestro", cuenta: "Nº y % sobre sus saques" },
          { que: "Calidad media del envío rival", es: "Nota de 1 a 4 de sus saques valorados · menos es mejor" },
          { que: "Este partido frente a los anteriores", es: "Con jornada, la tabla del partido contra la media de las anteriores" },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Resumen", es: "Lectura rápida, comparativa del partido, conclusiones, leyenda y lectura por resultado" },
          { que: "Dónde", es: "Mapa por zonas y campo con cada saque; el rival ataca hacia la izquierda" },
          { que: "Cómo acaban", es: "Flujo del saque al resultado y reparto por banda, envío, receptor, nuestra defensa y debilidad defensiva" },
          { que: "Saque a saque", es: "La tabla entera, con el vídeo de cada saque y «Hudl» en su segundo cuando están cortados" },
          { que: "Categoría · Opta", es: "Lo que le hacen al Castilla frente a la categoría y cada saque del rival (se carga al abrirlo)" },
        ],
      },
      {
        titulo: "Cómo se lee",
        filas: [
          { que: "Zona de saque", es: "Del rival: Zona 1 cerca de su portería, 3 junto a nuestra área (ahí un error cuesta caro)" },
          { que: "Receptor", es: "A quién se la ponen: primera línea, medios, 9, extremo" },
          { que: "Descargar PNG", es: "La pantalla entera con los filtros, en imagen" },
        ],
      },
    ],
    ojo: ["Por defecto va sin pretemporada; se puede incluir desde el filtro de competición."],
  },
  {
    ruta: "/abp-microciclo",
    titulo: "Microciclo ABP",
    resumen: "Qué se trabaja de balón parado cada día de la semana, con cuánto desgaste, y si se nota en el partido.",
    origen:
      "El plan se guarda en la app (doc «abp-microciclo», Supabase). La lista de micros y las cargas medidas, de la hoja de registro de tareas; lo que pasa en los partidos, de las cuatro hojas de ABP y banda; el partido, de nuestro calendario de BeSoccer.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Microciclo", es: "El del próximo partido al entrar; la lista trae el actual y sus vecinos, «Ver todos» el resto. ✓ = semana jugada con plan" },
          { que: "Días entrenados", es: "Con ellos se prorratea el objetivo; en blanco se deducen del plan" },
          {
            que: "Balón parado de la semana",
            es: "Minutos planificados frente al objetivo del cuerpo técnico, y el reparto atacando/defendiendo",
            cuenta: "90-100′ por cada 6 días de sesión, prorrateado hacia abajo (tope 6). Las tareas de los dos lados cuentan mitad y mitad",
          },
          { que: "Pizarra ABP · ABP del rival · Plan de partido", es: "Atajos del partido de la semana; «Informe post» si ya se jugó y «Vídeo de ABP» si la pieza está subida" },
          { que: "Proponer boceto", es: "Propone la semana entera (días, aspectos y minutos) con el próximo partido, nuestro rendimiento y el del rival" },
          { que: "Informe de la semana", es: "El informe de balón parado de la semana, para verlo y mandarlo" },
          { que: "Más", es: "Exportar planificación (imagen, WhatsApp o correo), Importar del registro, Copiar de otro micro (atado por MD) y Nuevo microciclo" },
        ],
      },
      {
        titulo: "La semana",
        filas: [
          { que: "Lo que dejó el partido", es: "Ya jugado: cada aspecto trabajado con sus acciones, peligro y goles en ese partido, y su veredicto", cuenta: "Con menos de 5 acciones va en gris: «pocos casos»" },
          { que: "Revisión de la semana", es: "Lo que hay que corregir, lo que conviene mirar y lo que ya está bien; cada punto abre su tarea o la planifica" },
          { que: "Carga: … en N días con balón parado", es: "Plegado: Minutos de ABP, Carga condicional, Carga cognitiva y Campo / Vídeo", cuenta: "Condicional = tiempo × intensidad; cognitiva = tiempo × exigencia; al lado, la media de los otros micros" },
          { que: "El tablero", es: "Un bloque por trabajo; se pulsa para editar y se arrastra de día. Según el día, Ficha completa o Compacta" },
          { que: "PRE · POST · INTRA · VÍDEO · CAMPO · HOJA", es: "Vídeo antes o después del campo, durante la tarea, sesión de vídeo, en el campo, o traído del registro" },
        ],
      },
      {
        titulo: "Reparto y competición",
        filas: [
          { que: "Reparto", es: "Minutos por lado, por momento de la sesión y por rol (un trabajo puede sumar en varios)" },
          { que: "Lo más urgente ahora mismo", es: "Los aspectos que más piden trabajo, con acciones, remates, goles y minutos de la temporada; pulsar lo planifica" },
          {
            que: "Urgencia",
            es: "Daño × 50 % + rinde peor que su familia × 30 % + poco trabajado × 20 %",
            cuenta: "Un aspecto con goles en contra nunca baja de alta ni del tercer puesto",
          },
          { que: "% peligro · familia", es: "Acciones que acaban en peligro (suavizado), junto a la media de su familia: córners con córners, bandas con bandas" },
          { que: "Transfer.", es: "Partidos precedidos de trabajo de ese aspecto frente a los que no lo tuvieron", cuenta: "Cada micro se ata con su partido por el rival; sólo cuentan las semanas planificadas aquí" },
        ],
      },
    ],
    ojo: [
      "Lo importado del registro trae sus cargas medidas; lo planificado a futuro es una estimación con la misma cuenta.",
      "Las hojas no separan el córner directo del jugado en corto: se lee del tipo de envío (corto = indirecto).",
      "Si una de las hojas de ABP no se puede leer, un aviso arriba lo dice y el cruce se calcula sin ella.",
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
    resumen: "Cuánto se sigue a cada jugador de campo del Castilla, quién lo hace y de qué se le habla, desde el 21/10.",
    origen: "Hoja de seguimiento (una fila por registro, por el Apps Script) cruzada con la plantilla de la hoja JUGADORES. Cuenta desde el 21/10/2026 y nada fechado después de hoy.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "A quién cuenta",
        filas: [
          { que: "Jugadores de campo del Castilla", es: "Sólo licencia del Castilla y sin porteros: los del RMC y del juvenil llevan su seguimiento en su equipo", cuenta: "El filtro va antes de todo: cifras, gráficos, listas y CSV" },
          { que: "El nombre manda sobre el ID", es: "Cada registro se ata a su jugador por nombre: los JUG-XX se han renumerado" },
          { que: "Filtros", es: "Jugador, posición, entrenador y búsqueda; estrategia, modalidad, momento, mes y semana van en «Más filtros»", cuenta: "Semana de temporada: de lunes a domingo, desde la del 8 de julio" },
        ],
      },
      {
        titulo: "Las cifras de arriba",
        filas: [
          { que: "Seguimientos", es: "Registros desde el 21/10 y cuántos llevan feedback", cuenta: "Con menos de 15, tendencia" },
          { que: "Con seguimiento", es: "Jugadores con algún registro y registros por jugador", cuenta: "Registros de la plantilla ÷ jugadores con registro" },
          { que: "Cobertura · de campo del Castilla", es: "Qué parte del grupo tiene algún seguimiento", cuenta: "Con registro ÷ jugadores de campo del Castilla (de la posición filtrada) × 100; verde desde el 80 %, oro desde el 50 %" },
          { que: "Media semanal", es: "Registros por semana completa", cuenta: "Sólo semanas cerradas de lunes a domingo; la primera (desde el miércoles 21/10) y la actual van aparte. Con una sola semana, «Esta semana»" },
          { que: "Individualización", es: "Registros de modalidad individual ÷ total × 100; el resto, grupales" },
          { que: "Último registro", es: "Hace cuánto fue el más reciente y de quién" },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Resumen", es: "Lecturas del periodo, evolución semanal, foco de los objetivos (ofensivo, defensivo, mental), estrategias, momento de la intervención y quién no tiene ningún registro" },
          { que: "Sin seguimiento en 14 días", es: "La primera lectura: quién no tiene registro en los 14 días que acaban hoy, con los días desde su último; si no hay nadie, los tres con menos", cuenta: "La misma ventana que Calendario y la ficha individual" },
          { que: "Jugadores", es: "Ranking por registros (semanas cubiertas y días desde el último), mapa jugador × semana, reparto por posición, contactos más antiguos y el más y el menos seguido", cuenta: "Pinchar a uno del ranking filtra por él" },
          { que: "Metodología", es: "Modalidad individual o grupal, carga por entrenador, matriz entrenador × estrategia, distribución mensual y jugadores alcanzados por semana" },
          { que: "Registros", es: "Una tarjeta por registro con sus objetivos y el feedback, de 20 en 20", cuenta: "«Exportar CSV» baja lo filtrado en segundo plano" },
        ],
      },
    ],
    ojo: ["Un registro puede llevar varios objetivos: el foco de los objetivos no suma 100 %."],
  },
  {
    ruta: "/dashboard-plantilla",
    titulo: "Dashboard de plantilla",
    resumen: "Quién juega, cuánto y cómo rinde: minutos por puesto, avisos de la semana, jornada a jornada, la ficha de cada uno y quién rinde más.",
    origen: "Wyscout (minutos, edad, contrato, amarillas, goles, asistencias y percentiles por puesto), Valoraciones (quién jugó cada jornada, titular o suplente, minutos y nota), hoja JUGADORES (plantilla, licencia y ficha de competencias) y Jugadores sesión (documento «jugadores-sesion», desde el 21/10).",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Jugadores del Castilla", es: "Los de licencia del Castilla y, aparte, los de fuera con minutos, con su etiqueta (RMC, JUV A…)", cuenta: "«Grupo» deja sólo la licencia del Castilla" },
          { que: "Partidos de liga", es: "Los jugados y los minutos posibles por jugador", cuenta: "Partidos × 90" },
          { que: "Han jugado", es: "Cuántos tienen al menos un minuto" },
          { que: "Minutos sub-21", es: "Parte de los minutos de Wyscout que juegan los de 21 años o menos", cuenta: "Minutos de los sub-21 ÷ minutos de los que tienen edad × 100; el mismo corte que la Comparativa" },
          { que: "Avisos", es: "Cuántos avisos y de cuántos jugadores; pinchando, lleva a su tarjeta" },
        ],
      },
      {
        titulo: "¿Cómo está la plantilla?",
        filas: [
          { que: "Minutos", es: "Los de Wyscout sobre los posibles, puesto a puesto; sin fila en Wyscout, los de Valoraciones con asterisco", cuenta: "En naranja, menos del 25 %. Wyscout cuenta el añadido: puede pasar de los posibles" },
          { que: "Titular", es: "Marcado como titular en Valoraciones o con los 90′; con uno o ninguno, «tendencia»" },
          { que: "¿De quién hay que hablar esta semana?", es: "Juega poco (menos del 25 %), tres partidos sin jugar, carga alta (90 % o más), a una amarilla del ciclo (4, 9, 14…) y nota a la baja", cuenta: "Sólo licencia del Castilla; los porteros no entran en los de minutos. Nota a la baja: media de las 3 últimas un punto o más por debajo de la de las 3 anteriores" },
          { que: "¿Qué edad tiene quien juega?", es: "Tramos de edad de Wyscout con su parte de los minutos jugados", cuenta: "Edad media ponderada por minutos" },
          { que: "¿Cuándo acaban los contratos?", es: "Fin de contrato que publica Wyscout" },
          { que: "¿Quién entrena con el grupo?", es: "Sesiones de cada uno en Jugadores sesión, de menos a más, y quién del Castilla no sale en ninguna", cuenta: "En naranja, por debajo del 70 % de las sesiones" },
        ],
      },
      {
        titulo: "Jornadas, jugador y rendimiento",
        filas: [
          { que: "¿Quién juega cada jornada?", es: "Tabla jugador × partido de Valoraciones con sus minutos", cuenta: "Oro fuerte, titular; oro suave, desde el banquillo; punto, jugó sin minutos anotados" },
          { que: "¿Cómo está cada uno?", es: "Minutos, partidos, goles y asistencias, nota, amarillas, minutos por jornada y enlaces a su ficha individual, a DATA y a Hudl" },
          { que: "¿Qué hace mejor y peor que los de su puesto?", es: "Sus métricas más altas y más bajas en percentil contra los de su puesto de la liga con 90′ o más (Wyscout)" },
          { que: "¿Cómo le ve el cuerpo técnico?", es: "Mentalidad, hábitos, interpretación, física y técnica de la ficha de competencias, de 0 a 10", cuenta: "Diferencia frente a la media de los que tienen ficha; en gris si es menor de 1 punto" },
          { que: "¿Quién tiene mejor nota de partido?", es: "Nota media de Valoraciones con 3 partidos valorados o más; entre paréntesis, la de los cinco últimos" },
          { que: "¿Quién rinde más para su puesto según Wyscout?", es: "Media de sus percentiles en las métricas de su puesto", cuenta: "50 = la media de la liga; verde desde 60, naranja por debajo de 45" },
          PERCENTIL,
        ],
      },
    ],
    ojo: ["Los minutos de Wyscout y los de Valoraciones no coinciden: Wyscout cuenta el añadido y Valoraciones anota 90′ por partido completo."],
  },
  {
    ruta: "/ratings",
    titulo: "Valoraciones de partido",
    resumen: "La nota que el cuerpo técnico pone a cada jugador en cada partido y lo que sale de ella: ranking, campograma, comparativa e histórico.",
    origen: "Supabase (tabla match_ratings, temporada 2026-2027); los partidos, de la hoja del calendario (la misma que Planes de partido). Minutos, titularidad, goles, asistencias y tarjetas los rellena cada noche BeSoccer (scripts/valoraciones-besoccer.mjs); la nota, las áreas y el comentario, sólo el cuerpo técnico.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Registrar",
        filas: [
          { que: "Partido", es: "Se elige la jornada del calendario; «Añadir partido» crea uno a mano (amistoso, copa…)" },
          { que: "Nota", es: "De 0 a 10 por jugador; «Sin valorar» es una decisión tomada y no entra en ninguna media" },
          { que: "Titular", es: "Pone 90′ si aún no hay minutos" },
          { que: "Más detalle", es: "Goles, asistencias, amarillas, roja, las cuatro áreas (técnica, táctica, física, mental) y el comentario del partido" },
          { que: "Sin guardar", es: "Si quedan notas sin guardar, se pregunta antes de cambiar de pestaña" },
        ],
      },
      {
        titulo: "Equipo",
        filas: [
          { que: "Media del equipo", es: "Media de la nota media de cada partido valorado" },
          { que: "Mejor media", es: "La nota media más alta entre los de 4 partidos o más" },
          { que: "Mayor progresión", es: "Quien más sube", cuenta: "Media de sus 3 últimas notas − media de las 3 anteriores; es tendencia" },
          { que: "Más decisivo", es: "Más goles + asistencias; sale con 3 o más" },
          { que: "Evolución del equipo", es: "La media de cada partido: lleno en casa, hueco fuera; la línea de puntos, la media de la temporada" },
          { que: "Ranking de la plantilla", es: "PJ, Tit., media, Pond., Forma, Tend., Máx, Mín y G+A; filtro Todos, 3+ PJ o 5+ PJ", cuenta: "Pond. = media pesada por minutos; Forma = media de los 5 últimos; con menos de 4 partidos, fila atenuada" },
          { que: "Nota y minutos · Media por línea · Podio", es: "Los de 4 partidos o más en dos ejes, la media de porteros, defensas, medios y ataque, y el podio de la temporada" },
        ],
      },
      {
        titulo: "Campograma, comparar e histórico",
        filas: [
          { que: "Campograma", es: "La plantilla en el campo con el color de su nota: media, ponderada, forma o último partido", cuenta: "Rojo por debajo de 5, ámbar hasta 6,5, verde hasta 8 y cian por encima" },
          { que: "Comparar", es: "Varios jugadores a la vez: evolución partido a partido, perfil por áreas y cara a cara" },
          { que: "Histórico", es: "Cada partido con sus notas y comentarios; «Editar valoraciones» lo reabre en Registrar" },
          { que: "Ficha del jugador", es: "Al pinchar a uno: media, últimos 5, mejor partido, minutos, evolución, perfil por áreas, aportación y partido a partido" },
        ],
      },
    ],
    ojo: ["Es la valoración del cuerpo técnico, no una métrica: se lee junto a los datos, no en su lugar."],
  },
  {
    ruta: "/comparative_ind",
    titulo: "Comparativa con la categoría",
    resumen: "Cada jugador del Castilla frente a los de su puesto en la categoría (sub-21, sub-23 o todos), con Wyscout o con Opta: ranking, gráficos por fase, ficha y, según la fuente, contra otros equipos o su evolución por temporadas.",
    origen: "Wyscout: la descarga de jugadores de toda la categoría (esta temporada y la pasada). Opta: sus tablas de jugadores de Primera RFEF, todas las temporadas que hay. Al lado, nuestras Valoraciones (nota) y la hoja de seguimiento (nº de registros).",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Fuente", es: "Wyscout u Opta, cada una con sus pestañas; nunca se mezclan" },
          { que: "Contra", es: "Sub-21 (21 años o menos, edad de Wyscout), sub-23 o toda la categoría" },
          { que: "Puesto", es: "Filtra la tabla y los gráficos, y manda también sobre el jugador abierto" },
        ],
      },
      {
        titulo: "Con Wyscout",
        filas: [
          { que: "Índice", es: "Media de sus percentiles en las métricas de su puesto contra los de su puesto del grupo elegido", cuenta: "De 0 a 100; 50 = la media. Con 90′ o más; el portero, sólo contra porteros" },
          { que: "Ranking", es: "Su puesto entre los de su posición del grupo; «2º-3º de 34» = empatado en índice" },
          { que: "Evolución (pts)", es: "Puntos de índice frente a 25/26, cada año contra su categoría", cuenta: "Entre −3 y +3, estable; «nuevo» = sin minutos el año pasado. «Mejoran respecto a 25/26» pide 450′ el año pasado" },
          { que: "Nota · Nº seguim.", es: "Su nota media en Valoraciones y sus registros de seguimiento" },
          { que: "Gráficos por fase", es: "Una pregunta por fase del juego o dos métricas a elegir; las líneas son las medianas del grupo elegido", cuenta: "Se ve como dispersión, mapa de élite o ranking; con porteros arriba, sólo lo de portero" },
          { que: "Ficha del jugador", es: "Radiografía de percentiles, los mejores del puesto en la categoría y la proyección edad-nivel" },
          { que: "Contra otros equipos", es: "Uno de los nuestros frente a los de su puesto de los equipos que elijas, con 90′ o más", cuenta: "Percentil contra todos los de su puesto de la categoría con 90′ o más" },
        ],
      },
      {
        titulo: "Con Opta",
        filas: [
          { que: "Temporadas", es: "La actual (los dos grupos) y las pasadas (un grupo cada una); si una no tiene al Castilla, los nuestros de ahora contra la categoría de aquel año" },
          { que: "Índice", es: "Media de los percentiles en las métricas de su puesto", cuenta: "Por 90′ salvo las tasas; 270′ para entrar; un porcentaje de menos de 15 intentos no cuenta" },
          { que: "Evolución por temporadas", es: "Un jugador que está en varias temporadas, métrica a métrica" },
        ],
      },
      { titulo: "Cómo se lee", filas: [PERCENTIL] },
    ],
    ojo: ["Los minutos son los de la liga según la fuente: pueden no coincidir con los minutos con nota de Valoraciones."],
  },

  /* ==================== COMPETICIÓN ==================== */
  {
    ruta: "/duelos",
    titulo: "Duelos",
    resumen: "Nuestro once contra el once probable del rival, duelo a duelo y en los dos sentidos: dónde les podemos hacer daño con nuestro balón y dónde nos lo pueden hacer con el suyo.",
    origen: "Nuestro once: el de la pizarra táctica (tablero «Once 4-2-3-1», si es de este rival y tiene siete casados); si no, nuestro último once de Valoraciones; si no, el propuesto con los minutos de Wyscout. Su once: el marcado en Plantillas rivales; si no, su último once de BeSoccer; si no, los de más minutos, siempre sin sus bajas. Métricas: descarga de jugadores de Wyscout de toda la categoría. Lo cambiado a mano se guarda por rival (documento «duelos:<rival>»).",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Rival", es: "Abre con el próximo partido; el desplegable va con la jornada delante" },
          { que: "Balón: Castilla · Balón: rival · Los dos", es: "Qué momento pintan el campo, las cajas y las tarjetas" },
          { que: "El recuento", es: "Duelos medidos, cuántos para buscar, cuántos para vigilar y cuántos de doble cara; los de pocos minutos, aparte" },
        ],
      },
      {
        titulo: "Cómo se mide",
        filas: [
          { que: "P73", es: "Percentil de cada uno contra los de su puesto en la categoría con 90′ o más (Wyscout)", cuenta: "Hacen falta 5 comparables; un porcentaje de muy pocas acciones no cuenta" },
          { que: "Faceta", es: "Lo que hace con balón el que ataca contra lo que hace sin balón el que defiende (regate contra duelo defensivo…)", cuenta: "Percentil nuestro − suyo (media si son dos); ventaja desde 15 puntos" },
          { que: "Duelo", es: "Media de sus facetas en los dos sentidos y, donde toca, por arriba", cuenta: "Ventaja o desventaja desde 10 puntos. La altura pesa sólo donde se juega por arriba: 3 puntos por cm, tope ±20" },
          { que: "Se anulan", es: "Gana con un balón y pierde con el otro por 10 o más: manda la suma, y si queda por debajo de 10, se anulan" },
          { que: "Con pocos minutos", es: "Con menos de 450′ de Wyscout en un lado el duelo no se destaca: va plegado al final y es tendencia" },
        ],
      },
      {
        titulo: "Lo que se ve",
        filas: [
          { que: "El campo", es: "Los dos onces enfrentados con la línea de cada duelo en su color; pinchando uno, baja a su tarjeta" },
          { que: "Dónde les podemos hacer daño · Dónde nos pueden hacer daño", es: "Los duelos que ganamos con nuestro balón y los que perdemos con el suyo, de mayor a menor" },
          { que: "Alineaciones", es: "Los dos onces hueco a hueco, cada uno con su fuente; se cambian aquí sin tocar el once de Plantillas", cuenta: "«Volver a la propuesta» deshace lo cambiado" },
          { que: "Cuando nos atacan · En el centro del campo · Cuando atacamos", es: "Las tarjetas por zona: cada faceta con el valor de verdad debajo y el uno contra uno de cada pareja" },
          { que: "Sin pareja en nuestro 4-2-3-1", es: "Quien en su dibujo cae fuera de sitio: ese duelo no se mide" },
        ],
      },
    ],
  },
  {
    ruta: "/analisis-goles",
    titulo: "Análisis de goles",
    resumen: "Los goles de un equipo y de toda la liga por tramos de minutos, en casa y fuera, con remates y xG al lado, quién marca primero, cómo llega cada gol y la ficha técnica de los nuestros.",
    origen: "Goles, minutos y marcadores: BeSoccer, todos los partidos de liga. Remates, a puerta y xG por partido: Wyscout (sin minuto). Remates por minuto, tipología, corte de vídeo y enlace de cada gol: el timeline de Hudl de nuestros partidos. Lo cambiado a mano se guarda en Supabase («goles:tipologia-manual» y «goles:tecnico-manual»). Se rehace cada noche en el ordenador del club (scripts/goles-liga.mjs).",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Mandos",
        filas: [
          { que: "Equipo y Condición", es: "Cualquier equipo de la liga; Todos, Casa o Fuera (también desde la dirección, ?lugar=casa)" },
          { que: "Más opciones", es: "Desde y hasta qué jornada, franjas de 5, 10, 15, 30 o 45′, tramos a medida («20, 45, 70») y «Descuentos aparte»" },
          { que: "45+ y 90+", es: "Los descuentos; sin «Descuentos aparte», cuentan en la última franja de cada parte" },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "Partidos", es: "Los del equipo en el tramo; si al Castilla le falta alguno del calendario, «N de M» y qué jornada falta" },
          { que: "Goles a favor y en contra", es: "Del marcador de cada partido, con la media de los equipos de la liga", cuenta: "Goles ÷ partidos; liga = goles ÷ (partidos × 2), o ÷ partidos con casa o fuera" },
          { que: "Nuestro mejor tramo / tramo más débil", es: "El que más se separa de la liga marcando (o encajando); si ninguno, el tramo con más goles", cuenta: "Goles del tramo ÷ partidos − lo de un equipo medio de la liga en ese tramo" },
          { que: "Qué hacemos y qué concedemos", es: "Las frases que salen de las cifras, siempre frente a la media de la liga" },
          { que: "¿Qué pasa cuando marcamos primero?", es: "Cómo acaban los partidos según quién abre el marcador, frente a la liga en la misma situación", cuenta: "Pts/PJ = (3 × G + E) ÷ PJ; con menos de 5 partidos, «tendencia»" },
        ],
      },
      {
        titulo: "Minutos y casa y fuera",
        filas: [
          { que: "La gráfica de tramos", es: "Arriba a favor, abajo en contra; la altura es por partido y el número, los goles. La raya vertical es el descanso" },
          { que: "La raya de puntos", es: "Lo que marca (o encaja) un equipo medio de la liga en ese tramo, con la misma condición" },
          { que: "▲ y ▼", es: "Mejor o peor que la liga en más de un 10 %; con menos de 5 partidos no se juzga" },
          { que: "¿Cuándo rematamos y cuándo nos rematan?", es: "Sólo el Castilla: remates, a puerta y gol por tramo, nuestros y del rival (Hudl)" },
          { que: "¿Rendimos igual en casa que fuera?", es: "Por partido: puntos, goles, remates, a puerta, xG, goles − xG, ABP que acaba en remate y lo concedido, frente a la liga en esa condición" },
          XG,
        ],
      },
      {
        titulo: "Cómo llegan y gol a gol",
        filas: [
          { que: "Los anillos", es: "A favor y en contra por tipo; cada bolita es un gol y abre su vídeo, Hudl y su fila de la lista" },
          { que: "Propuesta de Hudl", es: "Ataque organizado (por dentro, banda, espalda, 2ª acción, tras error), transición (campo propio o contrario) o ABP", cuenta: "Tras error: pérdida en su tercio y gol en ≤ 10 s; transición: contraataque o robo y gol en ≤ 15 s; organizado: por el último pase" },
          { que: "Cómo llega", es: "El desplegable de cada gol: lo elegido manda sobre lo de Hudl" },
          { que: "Banda D e I", es: "Vistas desde el equipo que ataca" },
          { que: "Ficha técnica", es: "Sólo nuestros goles: fase, campo, acción, dónde nace, los nuestros implicados, lectura y «Para repetir» o «Para corregir». Se guarda sola" },
          { que: "✓ Revisado en vídeo", es: "La marca de los goles que el cuerpo técnico ya ha visto" },
        ],
      },
    ],
    ojo: [
      "Nadie publica de dónde viene cada gol del resto de la liga: de ellos sólo se sabe si fue de penalti o en propia puerta.",
      "Los partidos sin timeline en Hudl no se clasifican solos: sus goles se eligen a mano en «Gol a gol».",
      "Si a un partido le falta el minuto de algún gol, cuenta en los totales y no en los tramos.",
    ],
  },
  {
    ruta: "/collective_history",
    titulo: "Histórico Competición",
    resumen: "Cómo va el Castilla en la liga: puesto, puntos, balance y goles, la curva de puntos frente a la media de la liga y la tabla jornada a jornada.",
    origen: "Nuestros resultados: el calendario de BeSoccer («castilla:calendario»). Puesto y totales: la tabla más reciente del informe de rivales (BeSoccer). La media de la liga y el puesto de cada jornada: todos los partidos de liga de BeSoccer («goles:analisis»). El informe completo sigue en Power BI.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "El titular", es: "Puesto (y si subimos o bajamos en la última), puntos y puntos por partido frente a la media de la liga" },
          { que: "Puesto", es: "De la clasificación, con el movimiento de la última jornada" },
          { que: "Puntos", es: "Con los partidos y los puntos por partido", cuenta: "Puntos ÷ partidos" },
          { que: "Balance", es: "Ganados · empatados · perdidos" },
          { que: "Goles", es: "A favor-en contra, la diferencia y los goles a favor por partido" },
          { que: "Referencia", es: "La media de los equipos de la liga tras las mismas jornadas", cuenta: "Puntos repartidos (3 con ganador, 2 si empatan) ÷ (partidos × 2); goles de la liga ÷ (partidos × 2)" },
        ],
      },
      {
        titulo: "Puntos acumulados",
        filas: [
          { que: "La línea dorada", es: "Nuestros puntos acumulados, jornada a jornada" },
          { que: "La raya de puntos", es: "Lo que lleva de media un equipo de la liga tras cada jornada", cuenta: "Puntos por equipo y partido de la liga hasta esa jornada × partidos que llevamos" },
        ],
      },
      {
        titulo: "Jornada a jornada",
        filas: [
          { que: "Resultado", es: "Verde si ganamos, ámbar si empatamos, rojo si perdemos" },
          { que: "Acumulados y Media liga", es: "Los dos puntos de la curva en cada jornada; en el móvil no salen" },
          { que: "Puesto", es: "La clasificación tras esa jornada con todos los partidos de la liga hasta ella; la columna sólo sale si están todas", cuenta: "Por puntos, luego diferencia de goles, luego goles a favor" },
          { que: "Total", es: "La suma de la tabla: goles y puntos de los partidos jugados" },
        ],
      },
      {
        titulo: "Power BI",
        filas: [
          { que: "Abrir Power BI", es: "El informe completo de la competición, en otra pestaña; puede pedir la cuenta de Microsoft" },
          { que: "Vídeo / Ver explicación", es: "Cómo se lee el informe de Power BI; en escritorio, el botón flotante lleva al enlace" },
        ],
      },
    ],
  },
  {
    ruta: "/match-preparation",
    titulo: "Plan de Partido",
    resumen: "La preparación de cada jornada: contexto, proyección del juego, plan con y sin balón, duelos, análisis del rival y recursos de vídeo.",
    origen: "El plan lo escribe el cuerpo técnico en la hoja RIVALES (un partido por fila) y se guarda solo. Duelos: Wyscout de toda la categoría, con nuestro once de la pizarra táctica (o el último de Valoraciones) y el suyo de Duelos o Plantillas. Proyección: Opta y Wyscout del grupo. Dibujo de referencia: alineaciones de BeSoccer. Vídeos y documentos: Supabase.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Selector y flechas", es: "Abre el próximo partido (o el de ?rival=ID); los demás, en el orden del calendario" },
          { que: "Faltan N días", es: "La cuenta atrás al partido («Mañana», «Hoy es el partido», «Hace N días»); en rojo a tres días o menos" },
          { que: "Informe", es: "Scout Colectivo, Pizarra ABP e «Imprimir o PDF»" },
          { que: "Más", es: "Proponer boceto, Replicar de otra jornada y Editar informe (Ctrl+E)" },
          { que: "Proponer boceto", es: "Copia el plan de la jornada anterior con «?» en lo que puede cambiar y «*» en lo que se propone incorporar" },
          { que: "Replicar", es: "Copia el plan de otra jornada que se elija, sin vídeos ni documentos" },
          { que: "Lo esencial", es: "Las tres primeras claves del partido; las demás, en «Más claves del partido»" },
        ],
      },
      {
        titulo: "Proyección de la jornada",
        filas: [
          { que: "Juego", es: "Posesión, xG, remates, toques en el área rival, centros, PPDA, recuperaciones en el último tercio y contraataques: nosotros, el rival y la media del grupo", cuenta: "Lo que hace el que ataca × lo que concede el que defiende ÷ media del grupo × efecto del campo; pesan más los últimos partidos" },
          { que: "Entre paréntesis", es: "El intervalo del 80 %" },
          { que: "Tipo de partido y Por qué", es: "Posesión esperada, si será abierto o cerrado, la presión y el estilo del rival, y de dónde sale cada cifra" },
          { que: "Puntos y consignas", es: "Su punto fuerte, su punto débil, el nuestro, y dónde más ventaja y más riesgo con su consigna" },
          { que: "Ver el último partido: proyectado y real", es: "Lo que se proyectó y lo que pasó: verde si cayó dentro del intervalo, ámbar si no" },
        ],
      },
      {
        titulo: "Plan de juego y duelos",
        filas: [
          { que: "Con balón, Sin balón, ABP ofensivo y defensivo", es: "Lo que escribe el cuerpo técnico; las líneas en mayúsculas son apartados" },
          { que: "Siglas", es: "CP ataque organizado · CR contraataque · ABP balón parado · PTO portero · Z1, Z2… zonas; plegadas bajo el plan" },
          { que: "El número del duelo", es: "La diferencia de percentil con su par, frente a los de su puesto con 90′ o más", cuenta: "Positivo, ventaja nuestra; se habla de ventaja desde 10 puntos" },
          { que: "Para buscar · Doble cara · Para vigilar", es: "Ventaja con nuestro balón, ventaja con balón y riesgo sin él, ventaja suya con su balón; los parejos, plegados" },
          { que: "Tendencias", es: "Duelos con menos de 450′ en un lado: no cuentan como ventaja ni como riesgo" },
          { que: "El analista · Duelos del analista", es: "Lo escrito a mano va en la tarjeta del duelo con el que casa; lo que no casa, en tarjetas propias" },
        ],
      },
      {
        titulo: "Análisis del rival y recursos",
        filas: [
          { que: "Fortalezas, Debilidades, Estructuras", es: "Lo que escribe el analista; «Informe completo» abre el Scout Colectivo" },
          { que: "Dibujo de referencia", es: "El que más repite en sus alineaciones de BeSoccer, sin contar al portero, y sus transformaciones según Scout Colectivo" },
          { que: "Su balón parado (Wyscout)", es: "Qué parte de sus remates nace de ABP, frente a los equipos de la liga" },
          { que: "Recursos", es: "Vídeos y documentos del rival para la charla" },
          { que: "Autoguardado", es: "Lo que se escribe se guarda solo, con copia local si falla la red" },
        ],
      },
    ],
  },
  {
    ruta: "/pizarra-tactica",
    titulo: "Pizarra Táctica",
    resumen: "Dibujar una idea con fichas, flechas y escenas, presentarla moviéndose y montar el once de la semana, que usa toda la app.",
    origen: "Las fichas propias salen de la plantilla y las rivales de Plantillas rivales. El tablero «Once 4-2-3-1» se rellena solo cada semana con nuestro último once (Valoraciones) y el teórico del rival (Duelos → Plantillas → BeSoccer). Pizarras, bajas y once se guardan en Supabase.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "El once de la semana",
        filas: [
          { que: "Onces de la semana", es: "El tablero «Once 4-2-3-1»: el Castilla ataca hacia la derecha y el rival hacia la izquierda; dentro de la semana no se toca solo" },
          { que: "Rellenar otra vez · Deshacer", es: "Vuelve a poner los dos onces; «Deshacer» deja el tablero como estaba antes del relleno" },
          { que: "Lo leen Emocional, Duelos, Plan de partido, Data análisis y el ABP", es: "Lo que se cambia aquí les llega; «Probar sin guardar» cambia el once sólo en esta pantalla" },
          { que: "Nuestro once", es: "Tocar un puesto abre la lista con los de ese puesto primero; arrastrar de «Para entrar» lo mete, de un puesto a otro los cambia" },
          { que: "Bajas", es: "Quién no está (lesión, sanción, selección, primer equipo…) y hasta qué día; se va sola al pasar la fecha" },
          { que: "Propuesta para el partido", es: "Un once para ese rival con el porqué de cada uno; nunca se aplica sola", cuenta: "Encaje, minutos, continuidad, duelos, lo que pide su juego, emocional y último partido: pesos editables que suman 100 %" },
          { que: "El once del rival ha cambiado", es: "Aviso si se tocó en Plantillas o en Duelos después de rellenar; «Actualizar» lo trae" },
        ],
      },
      {
        titulo: "Montar la jugada",
        filas: [
          { que: "Nueva en blanco · Con los dos onces · Duplicar ésta", es: "Una pizarra vacía, con los 22 en 4-2-3-1 o la copia de la abierta con sus escenas" },
          { que: "Escenas", es: "Cada escena es un momento de la jugada; al reproducir, las fichas van de una a la siguiente" },
          { que: "Duplicar escena", es: "Copia la escena justo detrás: se mueven las fichas en la copia y ese es el movimiento" },
          { que: "Dibujo", es: "Coloca a un equipo en 4-4-2, 4-3-3… con fase (con o sin balón) y altura (alto, medio, bajo), cada uno al puesto más cercano" },
          { que: "Qué se cuenta", es: "La nota de la escena: sale bajo el campo a pantalla completa y en todo lo que se exporta" },
          { que: "Dictar", es: "Explicar la jugada por voz y que se monten las escenas; se deshace como cualquier cambio" },
          { que: "Elegir varias", es: "Arrastrar sobre el césped vacío o Mayús + clic; luego se mueven, alinean, reparten o duplican juntas" },
          { que: "Medidas del bloque", es: "Con varias elegidas, el largo y el ancho que ocupan en metros; con dos, la distancia", cuenta: "El campo de la pizarra es 100 × 68; el largo se pasa a 105 m" },
          { que: "Carriles", es: "Tercios y cinco carriles; los carriles salen del ancho del área grande y de la pequeña" },
        ],
      },
      {
        titulo: "Presentar y sacar",
        filas: [
          { que: "→ o AvPág", es: "Avanza a la siguiente escena moviéndose y se para; ← vuelve. Es lo que manda un mando de presentación" },
          { que: "Cámaras", es: "Inclinación, ver desde el otro lado y más cámaras: TV, portería, seguir y jugador" },
          { que: "Exportar", es: "PNG o copia de la escena y PDF y PowerPoint (una hoja por escena), en 1920 × 1080; portada JPG para el correo" },
          { que: "Vídeo", es: "Para la sala (1920 × 1080), para WhatsApp (1280 × 720, menos de 16 MB) o para el móvil (vertical)" },
          { que: "Atajos", es: "La tecla ? enseña todos los atajos de teclado" },
        ],
      },
    ],
    ojo: [
      "Las fichas se emparejan entre escenas por su identidad: una ficha duplicada con Ctrl+D es otra ficha y no se anima desde la original.",
      "Una pizarra sin título exporta con el nombre propuesto: conviene ponérselo antes.",
    ],
  },
  {
    ruta: "/coding",
    titulo: "Coding de Partido",
    resumen: "Marcar las acciones de nuestro partido o de un rival y sacar los cortes en vídeo.",
    origen: "El vídeo lo pone el usuario (carpeta de partidos, enlace o su ordenador); los cortes, las listas y la configuración se guardan solos en Supabase («coding:…»). Partidos, del calendario de BeSoccer; rivales y plantillas, de la hoja RIVALES.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Qué se codifica",
        filas: [
          { que: "Nuestro partido · Un rival", es: "El conmutador de arriba; cada partido y cada rival tiene su propia sesión de cortes" },
          { que: "Partido", es: "Del calendario; «Otro» añade un rival que no está (amistoso, vídeo propio)" },
          { que: "Rival", es: "Viene puesto el del último partido; si un vídeo lleva el nombre de otro equipo, avisa con un botón para cada uno" },
          { que: "Marcador", es: "Escudos, resultado, competición y fecha, con los cortes que lleva cada categoría y cada comportamiento", cuenta: "Cuenta los cortes de todo el partido, no sólo los del vídeo abierto" },
          { que: "El vídeo", es: "Carpeta de partidos (la del ordenador donde corre la app), «Desde un enlace» o «Abrir ficheros» del propio ordenador; se pueden abrir varios a la vez" },
          { que: "Este rival no tiene plantilla", es: "Se codifica igual por dorsales o sólo con los comportamientos colectivos" },
          { que: "Retoma tu sesión", es: "Aviso de sesión abierta; darla por terminada no borra ningún corte" },
        ],
      },
      {
        titulo: "Marcar",
        filas: [
          { que: "Los cuatro tiempos", es: "Inicio y fin marcados más el aire de antes y de después: lo que se exporta es el corte con márgenes", cuenta: "Margen antes y después, en «Configuración» (ms)" },
          { que: "Marcar inicio (I y O)", es: "Abre y cierra el corte; mientras está abierto va en rojo con piloto" },
          { que: "Un toque (Intro)", es: "Coge los segundos de antes y de después del instante que se fijan en «Configuración»" },
          { que: "Jugadores · Comportamientos colectivos · Categorías", es: "Quién (cada uno con su tecla), lo del equipo (con ⇧) y, si se quiere, la categoría con su fase" },
          { que: "Pantalla completa", es: "El vídeo a todo el alto, con la columna de cortes para pasarlos y ordenarlos y el selector de jugador y categoría dentro" },
          { que: "Pizarras", es: "Pintar sobre el fotograma (focos, flechas, zonas, mover a un jugador); vuelve a salir al pasar por ahí y se reparte a otros cortes" },
          { que: "Importar XML", es: "Trae un timeline de SportsCode, Hudl o Nacsport sobre el vídeo que está delante" },
        ],
      },
      {
        titulo: "Leer los cortes",
        filas: [
          { que: "Matriz", es: "Quién por qué, agrupado por fase; un cruce deja la lista, la línea de tiempo y la exportación con esos cortes" },
          { que: "Cortes", es: "La lista, en el orden del partido o a mano; «Buscar» mira jugador, dorsal, nota, etiqueta y vídeo, y «Filtrar» va por descriptor" },
          { que: "Listas", es: "«Guardar lo que se ve» guarda esos cortes, en ese orden, como un montaje con nombre que se exporta igual" },
          { que: "Por jugador · Por comportamiento · Por categoría", es: "Los cortes de cada uno; pulsar una fila filtra" },
          { que: "Vaciar y empezar otro bloque", es: "Quita cortes y pizarras y deja los vídeos puestos" },
          { que: "XML SportsCode · CSV", es: "Los cortes de la lista como timeline (SportsCode, Nacsport, Metrica Play) o como tabla para Excel" },
        ],
      },
      {
        titulo: "Sacar los vídeos y subir a YouTube",
        filas: [
          { que: "Vídeo unificado", es: "Todos los cortes pegados, con la carátula delante si se elige una" },
          { que: "Vídeo individual", es: "Con los cortes de un solo jugador: abre y cierra con lo bien hecho y deja en medio lo que hay que corregir; el objetivo de la semana va en la carátula" },
          { que: "Cortes sueltos (ZIP)", es: "Un fichero por corte, en carpetas por jugador" },
          { que: "Para", es: "WhatsApp (720p, 16 MB), Correo o grupo (1080p, 50 MB), Sala o YouTube (la imagen del partido, sin tope) y Móvil vertical (1080 × 1920, 16 MB)" },
          { que: "Ajustes de la exportación", es: "Peso, medida, pizarras dentro o fuera, rótulo de 3,5 s (dorsal y nombre, categoría, descriptores y minuto) y fundido de 0,3 s o corte seco" },
          { que: "Carátula", es: "Se elige entre los sujetos, «Una por jugador» o toda la plantilla; con vídeos «01-15_…» se propone sola la del dorsal 15" },
          { que: "Varios vídeos", es: "Cada vídeo entra solo con su corte de inicio a fin, y la exportación junta los de todos; en «Vídeos» se aparta el que sobre" },
          { que: "Dónde se monta", es: "Con el fichero del ordenador, en el navegador (MP4; si no se deja leer, se graba a tiempo real en WebM); con carpeta o enlace, en el servidor con ffmpeg, «Preciso» o «Rápido»" },
          { que: "YouTube", es: "Con la cuenta conectada se sube al terminar y entra en su lista; sin cuota del día se guarda en Backblaze y se sube solo cuando vuelve" },
          { que: "Mandar", es: "WhatsApp o correo con el mensaje escrito; el fichero se adjunta desde Descargas" },
        ],
      },
    ],
    ojo: [
      "En un rival, si el vídeo está filtrado por un jugador, el enlace de YouTube va solo a su ficha de Plantillas rivales, y sus cortes salen allí en «Cortes del coding».",
    ],
  },

  /* ==================== RIVAL ==================== */
  {
    ruta: "/rivals",
    titulo: "Plantillas Rivales",
    resumen: "Cómo llega cada rival, su plantilla en el campo y la ficha de cada jugador.",
    origen: "Hoja RIVALES (plantillas, fichas y análisis); BeSoccer (tabla, resultados, alineaciones, minutos y tarjetas, en Supabase); Wyscout de toda la categoría; resúmenes del canal de la RFEF. El once probable y los recursos, en Supabase.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba, antes de mirar a nadie",
        filas: [
          { que: "Selector de equipo", es: "Ordenado por calendario: el próximo, fijo a la izquierda con «Próximo», y cada uno con su jornada" },
          { que: "Plantilla · Pizarra", es: "La lista con el campograma, o la pizarra táctica del rival" },
          {
            que: "«Cómo llega»",
            es: "Clasificación (con la mediana de goles del grupo), su balance en el campo del partido, los últimos cinco, el dibujo que más repite y quién le hace los goles",
            cuenta: "BeSoccer; «tendencia» con menos de 6 partidos en ese campo o menos de 15 alineaciones",
          },
          {
            que: "Bajas y apercibidos",
            es: "Lo que la hoja dice en ESTADO o las etiquetas de lesionado y tocado de su ficha, y quién está a una amarilla del ciclo",
            cuenta: "Amarillas de BeSoccer esta temporada: 4, 9, 14… (el ciclo es de cinco)",
          },
          {
            que: "«Lo que le hace distinto»",
            es: "Hasta cuatro aspectos, fuerte en verde y flojo en rojo; cada cifra con su mediana y su puesto entre los equipos de la categoría",
            cuenta: "Percentil medio del aspecto entre los equipos; sólo si se separa ±20 puntos. Medias por partido en sus partidos de Wyscout",
          },
          {
            que: "«Dónde hacerles daño»",
            es: "Hasta tres jugadores, cada uno con su «Qué hacemos»; primero el central que el analista da por el de menor capacidad en Scout Colectivo",
            cuenta: "Etiqueta de debilidad en la ficha y rasgo flojo en Wyscout a la vez, con 450′ o más; no sale el central que el analista da por solvente",
          },
          { que: "Enlaces", es: "Su balón parado, Cómo juega como equipo, Duelos contra nuestro once y Vídeos de sus jugadores, con el mismo rival" },
          { que: "Para la semana", es: "Sólo del próximo rival: informe, PDF del once probable, PDF para el portero y PowerPoint de día de partido" },
          { que: "Resúmenes de sus partidos", es: "El resumen oficial de cada partido suyo de liga en el canal de la RFEF; abre YouTube" },
        ],
      },
      {
        titulo: "La plantilla y el campograma",
        filas: [
          { que: "Lista por líneas", es: "Foto con dorsal, puesto (y 2.ª), y los minutos con «titular en X de Y» de esta temporada", cuenta: "BeSoccer" },
          { que: "Ya no están", es: "Los que salieron del club («NO EN PLANTILLA»): no cuentan" },
          { que: "Etiquetas", es: "Las pone el analista; no salen de ningún dato. Sirven de filtro" },
          { que: "Campograma", es: "El once probable en el dibujo elegido o en el que más repite en sus alineaciones de la temporada; elegido a mano, se queda fijo" },
          { que: "Once probable", es: "Titular, duda (línea discontinua) o fuera en cada ficha" },
          { que: "Informe", es: "Clasificación, resultados, entrenador, estadio y los partidos que se elijan de toda la temporada; se retoca antes de exportar" },
          { que: "Más", es: "Sugerir el once (con sus últimos onces), PDF del once (salta a cada ficha), PDF para el portero y PowerPoint de día de partido" },
        ],
      },
      {
        titulo: "La ficha del jugador",
        filas: [
          { que: "Cabecera", es: "Edad, altura, peso, pie, estado, procedencia, nacimiento e incorporación, de la hoja RIVALES; las altas que trae BeSoccer llegan a la hoja con edad, peso y altura" },
          { que: "Ver vídeo · Documento · BeSoccer", es: "Su vídeo, su documento y su ficha de BeSoccer" },
          { que: "Rendimiento", es: "Partidos, minutos, goles y tarjetas por temporada, y la zona estimada por su puesto", cuenta: "BeSoccer" },
          {
            que: "«Cómo juega»",
            es: "Lo que más le separa de los de su puesto en la categoría: hasta tres por arriba y tres por abajo",
            cuenta: "Percentil contra su puesto con 90′ o más, esta temporada (Wyscout); sólo ≥ 70 o ≤ 30. Con menos de 270′ o menos de 8 iguales no se saca perfil",
          },
          { que: "Fortalezas · Debilidades · Características · Observaciones", es: "Lo escribe (o lo dicta) el analista; se guarda solo" },
          { que: "Editar datos", es: "Los campos de la hoja; el vídeo se puede elegir de la lista del canal" },
          { que: "Cortes del coding", es: "Lo marcado de él en /coding, con «Abrir el coding»" },
        ],
      },
      {
        titulo: "Las dos hojas del informe que no salen de BeSoccer",
        filas: [
          {
            que: "«Lo que le hace distinto»",
            es: "Hasta cuatro aspectos —dos o tres métricas cada uno— en los que se sale de la categoría",
            cuenta: "Percentil medio del aspecto entre los equipos de la categoría; sólo si se separa ±20 puntos",
          },
          {
            que: "«Sus jugadores: fortalezas y debilidades»",
            es: "Los suyos con minutos que se salen de los de su puesto en la categoría",
            cuenta: "≥ 60 % de los minutos posibles y algún percentil ≥ 80 (lo flojo, ≤ 20); hasta seis",
          },
          { que: "Si no salen", es: "No hay descarga de Wyscout bastante de ese rival" },
        ],
      },
    ],
    ojo: ["La altura de la ficha es la de la hoja; en ABP del rival manda la estatura de BeSoccer cuando las dos no coinciden."],
  },
  {
    ruta: "/scout-rival-collective",
    titulo: "Scout Colectivo",
    resumen: "Cómo juega el rival como equipo, según el analista y los datos de la categoría.",
    origen: "El informe lo escribe el analista en la hoja RIVALES (la transición ofensiva, en Supabase «scout-rival-colectivo-extra»). Fecha, jornadas y dibujo, de BeSoccer; «Datos del rival», de Wyscout y Opta.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "«Nuestra J10 · sáb 31 oct · en casa»", es: "El partido en una línea; es el desplegable de la jornada del Castilla (el rival que nos tocó)", cuenta: "La fecha, la del calendario de BeSoccer; la columna FECHA de la hoja no se toca" },
          { que: "Tira de jornadas", es: "Sus J1…Jn con el resultado de cada una: su jornada, no la nuestra (BeSoccer)" },
          { que: "Plan de partido · Pizarra ABP", es: "El mismo partido en esas pantallas" },
          { que: "Editar · Hecho", es: "En edición salen todos los campos y cuántos están completados; se guarda solo" },
        ],
      },
      {
        titulo: "Lo que se lee primero",
        filas: [
          { que: "Lo esencial", es: "Hasta tres ideas: la primera línea de «Jugadores clave» y de «Debilidades individuales» y, si faltan, las siguientes" },
          { que: "Wyscout, frente a la liga", es: "Sus cifras de estilo con la mediana de la liga; el PPDA, dicho como presión (menos pases, más presión)" },
          {
            que: "Dónde hacerles daño",
            es: "Hasta tres puntos de campos distintos, cada uno con su «Qué hacemos»: su salida de balón, quién presiona peor, el débil por dentro, su espalda, el débil en su área, tras pérdida",
            cuenta: "Primera línea de cada campo; «se deduce del campo» cuando el «Qué hacemos» no lo ha escrito el analista",
          },
          { que: "Cómo nos hacen daño", es: "Hasta tres de su ataque (atacan el área, sus centros, por fuera, al espacio, sus referencias), con lo que hacemos, deducido del campo" },
          { que: "Dibujo de referencia", es: "El que más repite en sus alineaciones de la temporada (BeSoccer, la misma cuenta que Plantillas rivales) frente a los que escribe el analista por fase" },
          { que: "Sólo lo ves tú, como analista", es: "Con sesión: lo que choca con su ficha de Plantillas rivales o con Duelos" },
        ],
      },
      {
        titulo: "El informe",
        filas: [
          { que: "Fase ofensiva · Fase defensiva", es: "Reinicios, inicio, campo contrario, área, transiciones, bloque alto y medio y defensa de área: lectura del analista tras ver sus partidos" },
          { que: "Conclusiones y plan", es: "Jugadores clave, fortalezas y debilidades individuales, plan y observaciones; lo que ya sale arriba no se repite y las claves del partido van al Plan de partido" },
          { que: "En lectura", es: "Sólo sale lo escrito; las frases a medias, las repetidas y las referencias de baja no se enseñan al cuerpo técnico" },
          { que: "Recursos", es: "Vídeo, lista de Hudl y documento de la hoja, y los vídeos y documentos subidos aquí (Supabase)" },
          { que: "Siglas", es: "Cada sigla del analista se explica al pasar el ratón, y al pie salen las que aparecen" },
        ],
      },
      {
        titulo: "Datos del rival",
        filas: [
          { que: "De un vistazo", es: "«Un equipo de un vistazo» de Wyscout, con el rival fijado" },
          { que: "Cifras de cabecera", es: "xG a favor y en contra, remates y PPDA por partido: manda Opta y Wyscout va en pequeño como «2.ª lectura»" },
          { que: "Estilo y momentos · Jornada a jornada · Remates", es: "De Opta: quién aprieta por franjas de 15′, su radiografía, su evolución en seis métricas y dónde remata y le rematan" },
          { que: "Si no sale", es: "El rival no cruza con Wyscout, o en Opta no es de nuestro grupo" },
          PERCENTIL,
        ],
      },
    ],
  },
  {
    ruta: "/scout-rival-abp",
    titulo: "ABP del Rival",
    resumen:
      "Su balón parado: cuánto peligro tiene, quién lo lanza y lo remata, qué repite, la proyección del próximo partido y el material de la jornada (clips, apuntes y láminas).",
    origen:
      "Scouting propio registrado aquí (documento «abp-rival-scout» de Supabase) o, si no lo hay, lo deducido de nuestras cuatro hojas de ABP. Sin acciones registradas, Wyscout y las etiquetas de Plantillas rivales. La proyección, de Opta. Las estaturas, de BeSoccer por encima de la hoja.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Liga · Pretemporada", es: "Sus partidos de Primera Federación o sus amistosos; láminas y proyección, sólo en Liga" },
          { que: "El rival", es: "Abre con el del próximo partido; «Cambiar equipo» despliega los demás, por calendario" },
          { que: "Su ataque · Su defensa", es: "Lo que genera el rival / lo que le generan a él" },
          { que: "Scouting propio · Deducido", es: "Propio: sus partidos, con sacador y rematador. Deducido: sólo contra nosotros y sin nombres. La etiqueta de arriba dice cuál se ve" },
          { que: "Filtros", es: "Competición, jornada y tipo de acción" },
        ],
      },
      {
        titulo: "¿Cuánto peligro tiene?",
        filas: [
          { que: "Acciones · Remates · xG · Goles", es: "Ejecutadas (su ataque) o defendidas (su defensa) en la selección; el xG, acumulado" },
          { que: "Peligro", es: "Las que acaban en gol u ocasión", cuenta: "acciones con gol u ocasión ÷ acciones" },
          { que: "Amenaza por tipo de balón parado", es: "Lo mismo por córner, falta lateral, falta directa, penalti, banda, saque de centro y de meta" },
          { que: "Lectura al pie", es: "El análisis de cada panel leído para el Castilla: en su ataque, más peligro es rojo; en su defensa, verde" },
          { que: "Su balón parado según Wyscout", es: "Si no hay acciones: córners, remates y lo que concede frente a la liga, con «Qué hacemos» y la barra contra la liga (raya = mediana)" },
          { que: "Quién lo lanza y quién remata", es: "Etiquetas de Plantillas (o Wyscout, ≈ lanzamientos por 90 × minutos), cruzadas con su once probable, y a quién marca cada uno de los nuestros" },
          { que: "Goles a balón parado", es: "Los que marca y los que encaja: el total y los penaltis son dato; córner y falta, estimado calibrado con Opta" },
        ],
      },
      {
        titulo: "Quién, qué repite y bandas",
        filas: [
          { que: "Lanzadores · Rematadores", es: "Quién ejecuta y quién ataca el balón, con cuántas de sus acciones acaban en gol u ocasión" },
          { que: "Amenaza aérea", es: "Los doce más altos de su plantilla; la barra compara dentro de la plantilla", cuenta: "Manda la estatura de BeSoccer; si la hoja dice otra, salen las dos («hoja 185»)" },
          { que: "¿Qué repite?", es: "Las acciones agrupadas por el patrón escrito al registrarlas, el más visto arriba; no sale en lo deducido" },
          { que: "Saques de banda", es: "Por zona: 1 tercio propio · 2 medio · 3 último tercio" },
        ],
      },
      {
        titulo: "Proyección de la jornada",
        filas: [
          {
            que: "A favor · En contra · Media del grupo",
            es: "Córners, faltas, bandas en campo rival y penaltis esperados en el partido; entre paréntesis, el intervalo del 80 %",
            cuenta: "lo que saca el que ataca × lo que concede el que defiende ÷ media del grupo × efecto del campo; pesan más los últimos partidos",
          },
          { que: "xG de balón parado", es: "Acciones esperadas por el xG por acción del que ataca y lo que concede el que defiende" },
          { que: "Gol a balón parado (al menos uno)", es: "La probabilidad de marcar alguno", cuenta: "1 − e^(−xG)" },
          { que: "Por qué · puntos fuertes", es: "El tipo de partido (posesión esperada), su punto fuerte, su débil, el nuestro y los rematadores de cada uno" },
          { que: "Dónde más ventaja · riesgo", es: "Nuestro xG esperado de cada tipo frente a la media del grupo; el riesgo, el del rival", cuenta: "«tendencia» con menos de 15 acciones detrás" },
          { que: "Ver el último partido: proyectado y real", es: "Lo proyectado antes del partido junto a lo que pasó: verde si cayó dentro del intervalo" },
        ],
      },
      {
        titulo: "El trabajo de la jornada",
        filas: [
          { que: "Apuntes y vídeo", es: "Tres cuadernos con su vídeo: lo del rival, nuestro partido anterior y el nuestro contra él; van al informe de ABP de esa semana" },
          { que: "Coding de clips", es: "Abre la carpeta de la jornada en Chrome o Edge (nada se sube): K se queda, D descarta, S pendiente, Z deshace; se guarda en cada decisión" },
          { que: "Lo que repite · Texto para el cuerpo técnico", es: "Lo más repetido de lo etiquetado y el texto para copiar o mandar por WhatsApp; las caídas van solas a la pizarra de ABP («Dónde caen»)" },
          { que: "Mover descartados · Copiar elegidos", es: "Los descartados a «_descartados» (se confirma, no se borra nada); los elegidos a «CLIPS SELECCIONADOS», una subcarpeta por tipo" },
          { que: "Recoger y láminas", es: "Láminas de medio campo (cruces, balones, flechas, zonas y sus fichas), vídeos, PDF y la conclusión de cada sección, que va al informe" },
          { que: "Registrar", es: "Cada acción vista en vídeo (partido, acción, envío, patrón); se guarda sola, sale en CSV y la pantalla pasa a leer de ahí" },
        ],
      },
    ],
    ojo: [
      "Coding, láminas y registrar se ven sin sesión desde el 12/11/2026; dibujar láminas, sacar el PPT y recoger la carpeta siguen pidiendo «Editar» con la sesión de administrador.",
      "La proyección es de Opta (los 20 equipos del grupo) y, en el número de córners o bandas de un partido, los equipos aún apenas se distinguen: lo que más separa es el xG por acción. «Cómo se cuenta», plegado al pie del panel.",
    ],
  },
  {
    ruta: "/scout-rival-area",
    titulo: "Área del Rival",
    resumen:
      "Sus centros laterales: cuánto centran y con qué acierto, cuántos reciben, qué hacemos en cada caso y las láminas de la jornada.",
    origen:
      "Wyscout (sus centros frente a los equipos de la liga), el texto del Scout Colectivo para contrastar y la carpeta de centros de cada jornada, con las láminas que se dibujan aquí (Supabase).",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Sus centros según Wyscout",
        filas: [
          { que: "El rival", es: "Abre con el del próximo partido; «Cambiar equipo» despliega los demás, por calendario" },
          { que: "Sus centros · Los que recibe", es: "Por partido o en porcentaje frente a los equipos de la liga; «x de y» es la base real" },
          { que: "Barra", es: "El rival en oro entre cero y el máximo de la liga: la raya es la mediana y el rombo verde, el mejor" },
          {
            que: "▲ ▼ y puesto",
            es: "Mejor o peor según le convenga a ese equipo; el puesto va del 1.º (el mejor) al último",
            cuenta: "puesto = 1 + (100 − percentil) × (equipos − 1) ÷ 100, redondeado",
          },
          { que: "Tendencia", es: "Un porcentaje con menos de 15 casos arriba o 25 abajo, o menos de 10 partidos: sin flecha ni color" },
          { que: "Qué hacemos · Qué entrenamos", es: "Criterio de juego a partir de la cifra, encima de la tabla: la cifra lo sostiene, no lo dicta" },
          { que: "Contraste con el Scout Colectivo", es: "Si su texto dice que centran mucho o poco, se dice si Wyscout lo respalda, con enlace al análisis" },
        ],
      },
      {
        titulo: "Las láminas de la jornada",
        filas: [
          { que: "Recoger la carpeta", es: "Con «CENTRO» en el nombre va a cómo atacan; con «DEF», a cómo defienden. El partido sale de «VS …». Con «Editar» (sesión de administrador)" },
          { que: "Láminas", es: "Perfil izquierdo y derecho: balones donde centran, cruces donde caen (roja cerrada, amarilla abierta) y los centradores" },
          { que: "Consignas · Conclusión", es: "Lo que se dice de cada lámina y lo que se concluye de cada sección, que va al informe" },
          { que: "PDF · PPT", es: "Esta lámina o toda la jornada; el PPT, sólo en edición" },
        ],
      },
    ],
    ojo: [
      "La descarga de Wyscout puede ir una jornada por detrás del calendario: sus partidos pueden ser uno menos que los de BeSoccer.",
      "Sin láminas ni material recogido, la sección de láminas no sale para quien no es administrador.",
    ],
  },

  /* ==================== RENDIMIENTO Y OPERATIVA ==================== */
  {
    ruta: "/performance",
    titulo: "Área Condicional",
    resumen: "El seguimiento semanal del área de rendimiento: las imágenes y los PDF de cada semana de la temporada.",
    origen: "Lo sube el área condicional desde la propia pantalla; los archivos se guardan en Supabase (carpeta 2026/performance), semana a semana.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "La línea de resumen", es: "Semanas de la temporada, cuántas imágenes y PDF hay y en cuántas semanas, y si la de ahora ya tiene material" },
          { que: "Las casillas", es: "Una por semana ya pasada: dorada con ✓ si tiene material, en blanco si no; «ahora» es la semana en curso" },
          { que: "Todas las imágenes · Todos los PDFs", es: "Lo de toda la temporada junto, con salto a su semana" },
        ],
      },
      {
        titulo: "La semana",
        filas: [
          { que: "Buscar semana o fecha…", es: "Busca en la lista por meses; se abren el mes actual, el anterior si trae material y el de la semana elegida" },
          { que: "Imágenes · PDFs", es: "Lo de la semana: se abre, se descarga o se elimina (pide confirmación)" },
          { que: "Subir", es: "Imágenes y PDF a la semana elegida, con el botón o arrastrándolos" },
          { que: "Semana vacía", es: "Dice cuál fue la última semana con material, con su enlace" },
        ],
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
    resumen: "El estado emocional del once de la pizarra táctica, línea a línea, en cuatro dimensiones de 0 a 10.",
    origen: "La hoja emocional (una fila por jugador, que se sobrescribe) y, encima, lo editado aquí en «Editar valoraciones» (documento «emotion:valoraciones» de Supabase), que manda jugador a jugador. El once, del tablero de la pizarra táctica. La flecha compara con la foto anterior guardada en este aparato.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Las cuatro dimensiones",
        filas: [
          { que: "Observar · Externo · Amplio", es: "Observación y lectura de lo que ocurre; antes de intervenir" },
          { que: "Controlar · Interno · Estrecho", es: "Control emocional; en la adversidad" },
          { que: "Analizar · Interno · Amplio", es: "Análisis y reflexión de qué hacer; con el juego parado" },
          { que: "Ejecutar · Externo · Estrecho", es: "Ejecución de la acción, el 1v1; en la participación" },
          { que: "Escala", es: "Élite desde 8,5, alta desde 7,5, media desde 6,5 y mejorable por debajo", cuenta: "La media de un jugador = suma de las cuatro ÷ 4" },
        ],
      },
      {
        titulo: "El campo",
        filas: [
          { que: "Radares por línea", es: "Seis radares con los del once: portero y defensa, defensa, perfil izquierdo, perfil derecho, medios y puntas", cuenta: "Un jugador puede estar en dos líneas: las medias se leen por separado y no se suman" },
          { que: "Fichas del once", es: "Cada titular en su sitio: el aro es su media y la flecha, el cambio desde la evaluación anterior; al pulsarlo, su perfil y debajo el banquillo", cuenta: "Flecha desde 0,25; punto rojo si baja 0,5 o más o un eje cae 1 punto" },
          { que: "Titular sin valorar", es: "Entra con la media de la plantilla y no cuenta en las medias" },
          { que: "Cambiar el once en la pizarra", es: "Lleva a la pizarra táctica; más abajo se cambia quién entra en cada radar y «Restablecer líneas» (en «Más») lo deshace" },
        ],
      },
      {
        titulo: "Las cifras",
        filas: [
          { que: "Jugadores analizados", es: "Registros en la base emocional", cuenta: "Con menos de 12, tendencia" },
          { que: "Media de plantilla", es: "Media de las medias de cada jugador evaluado, con su banda de la escala" },
          { que: "Dimensión más fuerte · Dimensión a desarrollar", es: "La de media más alta y la más baja del grupo" },
          { que: "Editar valoraciones", es: "Cambia las cuatro notas de un jugador; «N valoraciones hechas en la app» dice cuántas no salen de la hoja" },
          { que: "Ver explicación", es: "El vídeo de cómo se leen las cuatro dimensiones" },
        ],
      },
    ],
    ojo: [
      "Es una apreciación del cuerpo técnico, no una medida: sirve para ver el cambio, no el nivel.",
      "Las seis líneas se solapan a propósito, a petición del analista.",
    ],
  },
  {
    ruta: "/game-model",
    titulo: "Identidad de Juego",
    resumen: "Los principios ofensivos y defensivos del modelo, por fase, bloque y apartado, y cómo se cumplen en el último partido los que se pueden medir.",
    origen: "Los principios: la hoja del modelo de juego del cuerpo técnico (se edita aquí y se escribe en la hoja). Las cifras de cada principio: Wyscout de nuestros partidos y de la categoría, el mismo cálculo que /identidad-campo; la jornada, del calendario de BeSoccer.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Cómo se organiza",
        filas: [
          { que: "Fase", es: "Ataque o defensa" },
          { que: "Bloques y Apartados", es: "Del principio general al detalle; el número de cada bloque es cuántos principios tiene" },
          { que: "Buscar principio…", es: "Busca en toda la fase; los contadores del rail dicen dónde hay coincidencias" },
          { que: "Balón parado", es: "Lleva a la pizarra de ABP" },
          { que: "Anterior / Siguiente", es: "Pasa de un apartado al siguiente" },
        ],
      },
      {
        titulo: "Cada principio",
        filas: [
          { que: "Innegociable", es: "Los que la hoja marca «CLAVE»: borde dorado y candado" },
          { que: "Lo que no se negocia", es: "Arriba del apartado, los innegociables; cada nombre salta a su tarjeta" },
          { que: "En el último partido, N de M", es: "Cuántos innegociables medidos quedaron del lado bueno de la mediana del grupo" },
          { que: "El desplegable", es: "Definición, qué se ve, criterio y clip, sólo si la hoja los trae" },
        ],
      },
      {
        titulo: "Se mide cada jornada",
        filas: [
          { que: "▲ / ▼", es: "El último partido, mejor o peor que la mediana de los equipos del grupo, con el sentido de la medida («más es mejor»)" },
          { que: "La línea", es: "El dato ante el rival y la jornada, la mediana del grupo y nuestra temporada en N partidos" },
          { que: "Se comprueba en el vídeo", es: "Innegociable sin medida en Wyscout" },
          { que: "Ver partido a partido →", es: "Su fila en /identidad-campo" },
        ],
      },
      {
        titulo: "Editar",
        filas: [
          { que: "Editar", es: "Cambia el texto de los principios; se guarda solo en la hoja y avisa si un texto es demasiado largo" },
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
      "El calendario de Primera RFEF grupo 2 viaja con la aplicación —38 jornadas que no cambian—. Los pronósticos los escribe cada uno aquí y viven en el documento «quiniela» de Supabase. Los resultados los baja de BeSoccer el trabajo nocturno o los pone alguien a mano; no salen de ninguna hoja.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Cómo se rellena",
        filas: [
          { que: "Entrar", es: "Con tu correo. La primera vez, «Registrarme»: la contraseña es lo que va antes de la @, y conviene cambiarla. Cada uno pone sólo lo suyo" },
          { que: "Guardar mi apuesta", es: "Marcar un signo no guarda nada: se guarda con el botón, y se cambia las veces que haga falta hasta el cierre" },
          { que: "El cierre", es: "El viernes de la semana de la jornada a las 12:00, hora de Madrid; lo no guardado cuenta como fallo" },
          { que: "Prórroga", es: "El administrador, desde Ajustes, puede dejar apostar después del cierre a quien no lo hizo, hasta una hora" },
          { que: "El aviso", es: "Ese mismo viernes a las 9:00, un correo a todos los registrados con los partidos y una frase de leyenda" },
          { que: "Resultados", es: "Llegan solos de BeSoccer por la noche o los mete cualquiera que haya entrado; la franja dice de dónde y de cuándo son" },
          { que: "1 · X · 2", es: "Gana el local, empate, gana el visitante. Volver a pulsar el mismo signo lo quita" },
          { que: "Enviar mi quiniela", es: "Con la apuesta guardada, te la pasas en imagen por WhatsApp o por correo" },
        ],
      },
      {
        titulo: "Lo que se ve",
        filas: [
          { que: "Quién manda", es: "El primero del ranking, arriba del todo, con su porcentaje y sus aciertos" },
          { que: "La franja", es: "Lo que falta para el cierre, «N de M con la apuesta completa» con una barra por persona, quién falta y «Ver las caritas»" },
          { que: "Quién juega", es: "Se cambia con su botón; entra y sale quien haga falta sin perder lo ya jugado" },
          { que: "Lo que ha puesto cada uno", es: "Sólo con la jornada cerrada: una columna por persona, verde acertado, rojo fallado, el reparto de 1-X-2 y «el único» o «todos igual»" },
          { que: "Lo vio todo el mundo · No lo vio nadie", es: "Los partidos que acertaron todos los que apostaron, o ninguno" },
          { que: "Jornadas anteriores", es: "Una fila por persona y una columna por jornada: verde si acertó más de la mitad, rojo si menos de un tercio, copa a quien la ganó" },
          { que: "La cosecha", es: "La canción, la frase y la foto de broma de cada uno; se pone cuando se quiere" },
        ],
      },
      {
        titulo: "Cómo se cuenta el acierto",
        filas: [
          { que: "Acierto", es: "Partidos acertados entre los ya jugados desde tu primera apuesta", cuenta: "acertados ÷ jugados desde la primera apuesta; desde ahí, el que no pones es fallo" },
          { que: "Un partido sin resultado", es: "No cuenta para nadie, ni a favor ni en contra" },
          { que: "=8", es: "Puesto compartido: mismo porcentaje y mismos aciertos. A igual porcentaje, manda quien más acierta" },
          { que: "Con pocas apuestas", es: "Abajo y fuera del orden", cuenta: "quien lleva menos de la mitad de partidos que el que más, o apostó menos de la mitad de los suyos" },
          { que: "Esta jornada", es: "Aciertos de la semana entre sus partidos ya jugados" },
          { que: "Jornadas ganadas", es: "Las que cerró con más aciertos que nadie; si empatan dos, la ganan los dos" },
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
      "Las escribe el cuerpo técnico aquí mismo, con la misma cuenta que la quiniela. Viven en un documento propio de Supabase («apuestas-staff»); no salen de ninguna hoja.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Cómo se juega",
        filas: [
          { que: "Entrar", es: "Con la cuenta de la quiniela, un solo acceso arriba. Ver no necesita entrar; lanzar, mojarse o dar el veredicto, sí" },
          { que: "Lanzar apuesta", es: "La predicción (hasta 280 letras), qué te juegas (hasta 120) y el día en que se comprueba, mañana como pronto. Quien la lanza va a favor" },
          { que: "A favor · En contra", es: "Hasta el día antes de la comprobación; se cambia de bando o se quita las veces que haga falta. El autor no se moja: ya va a favor" },
          { que: "Toca comprobarla", es: "Desde el día señalado se cierran las posturas y cualquiera que haya entrado dice si acertó o falló. Se puede deshacer" },
          { que: "Retirarla", es: "Sólo el autor, mientras nadie se haya puesto a favor ni en contra; se pregunta antes, porque se borra" },
          { que: "Ver cómo se verá", es: "Sin ninguna apuesta, un ejemplo plegado y marcado como inventado" },
        ],
      },
      {
        titulo: "Las tarjetas",
        filas: [
          { que: "En juego", es: "Las abiertas, primero la que se comprueba antes" },
          { que: "Veredicto el … · faltan N días", es: "La cuenta atrás hasta la comprobación; el último día, «Veredicto mañana»" },
          { que: "Se juega", es: "Lo que pone el autor, en su propio bloque" },
          { que: "Faltan N de M por mojarse", es: "Quién de la quiniela aún no ha tomado postura, con su cara", cuenta: "M = los que tienen cuenta en la quiniela; el autor cuenta a favor" },
          { que: "Quién tenía razón", es: "Las ya comprobadas, de la última a la primera" },
        ],
      },
      {
        titulo: "El marcador",
        filas: [
          { que: "Lanzadas", es: "Apuestas que ha tirado, resueltas o no" },
          { que: "Seguidas", es: "Veces que se ha mojado en las de otros" },
          { que: "Aciertos y fallos", es: "Sólo de las resueltas. Quien lanza acierta si se cumple; quien va a favor, con él; quien va en contra, si falla" },
          { que: "Balance", es: "Aciertos menos fallos", cuenta: "Ordena el marcador; a igual balance, más aciertos y luego más apuestas jugadas" },
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
      "Lo que hacen los mejores en balón parado, las mejores acciones de cada jornada, nuestras rutinas de la idea al partido, el Castilla frente a la categoría en Opta y una competición de retos para la plantilla.",
    origen:
      "Los referentes son artículos y análisis publicados, cada uno con su enlace. Las acciones de cada jornada salen de Wyscout cada mañana, con el resumen oficial de YouTube; la categoría, de Opta. Las rutinas y los retos se escriben aquí y viven en un documento propio de Supabase que sólo ve el administrador.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Referentes", es: "Principios, rutinas y formación de Jover, Cueva, Brentford, Georgson, Vio, Grønnemark y Coulston, con buscador y ruta de aprendizaje gratuita. «Al taller» la lleva ya dibujada si hay esquema" },
          { que: "Lo mejor de cada jornada", es: "Las cinco mejores acciones a balón parado de cada jornada de Primera RFEF (los dos grupos), LaLiga, Segunda, Premier y Champions: goles primero, luego por xG; vídeo del resumen oficial si lo hay" },
          {
            que: "Patrones que más rinden",
            es: "Dentro de la anterior: las acciones con remate agrupadas por tipo, lado del saque y zona de caída",
            cuenta: "Por goles por acción, xG por acción o % a puerta, sólo con la muestra mínima",
          },
          { que: "En la pizarra", es: "Las jugadas de la pizarra de ABP traídas con «Abrir en el laboratorio», con su estado (igual, cambiada allí, ya no está); vuelven con «Enviar a la pizarra»" },
          { que: "Taller", es: "La biblioteca de rutinas (recientes, nombre o xG; duplicar, variantes, comparar dos) y, arriba, las que mejor encajan contra la defensa del próximo rival" },
          { que: "Retos", es: "De precisión (la marca de cada uno) y de preguntas (se proyectan en el vestuario y se marca quién acierta)" },
          { que: "Opta · balón parado de la categoría", es: "El Castilla en córners, faltas, bandas y penaltis frente a su grupo y a Primera RFEF, y cada saque: dónde cae, quién lo saca y si acaba en remate" },
          { que: "Datos", es: "Enlace a su propia pantalla: el balón parado de Primera RFEF y la Premier en Wyscout" },
        ],
      },
      {
        titulo: "La pizarra del taller",
        filas: [
          { que: "Colocar · Carreras · Balón", es: "Arrastrar a cada uno a su salida y hasta donde acaba su carrera; cada toque añade un punto al vuelo del balón. La fase dice cuándo arranca" },
          { que: "Cámara", es: "Cenital, televisión o a pie de campo; se edita igual en las tres" },
          { que: "Línea de tiempo", es: "Reproducir, velocidad (0,25× a 2×), bucle y saltos a salida, golpeo, remate y final" },
          { que: "Defensa", es: "El rival tipo, el próximo rival (su scouting de ABP y sus más altos) o ninguna; se mueve con el balón y con los bloqueos" },
          { que: "Espacio y duelos", es: "Quién llega antes a cada metro, los huecos y cada duelo aéreo con la diferencia de altura (Wyscout los nuestros, Plantillas los suyos)" },
          { que: "xG estimado", es: "La probabilidad de gol del remate por sitio, marca y duelo aéreo. Sirve para comparar rutinas, no es una medición" },
          { que: "Encaje automático", es: "La misma rutina contra zona, mixta y al hombre, y la defensa del próximo rival cuando su scouting la dice" },
          { que: "Encaje con el rival", es: "Lo que Wyscout mide del próximo rival en ese tipo de balón parado, contra el resto de la liga" },
          { que: "Exportar y presentar", es: "PNG, PDF por momentos, MP4 y GIF; «Presentar» a pantalla completa. «?» enseña los atajos y Ctrl + Z deshace" },
        ],
      },
      {
        titulo: "Las cifras",
        filas: [
          PERCENTIL,
          { que: "Puesto en el grupo · en la categoría", es: "Cuántos equipos lo hacen mejor, más uno; en las de estilo, del que más al que menos" },
          { que: "Color", es: "Verde desde el p60, oro entre p40 y p60, rojo por debajo" },
          { que: "Tendencia", es: "Un porcentaje con menos de 10 intentos: sin color ni percentil" },
          { que: "Remate de un saque", es: "El saque se ata con el remate de su misma jugada en Opta; la segunda jugada va aparte" },
        ],
      },
      {
        titulo: "La clasificación de los retos",
        filas: [
          { que: "Puntos", es: "Precisión: la marca por los puntos de cada acierto. Preguntas: las acertadas por los puntos de cada pregunta" },
          { que: "Acierto", es: "Puntos sobre lo que podía sacar en los retos que jugó" },
          { que: "Racha", es: "Retos seguidos puntuando, contando desde el último que jugó" },
          { que: "Insignias", es: "Francotirador, Lector de juego, En racha, MVP y Siempre está: se ganan solas" },
        ],
      },
    ],
    ojo: [
      "Sólo con la sesión de administrador: sin ella, la dirección enseña la puerta del laboratorio y el contenido no llega al navegador. Vale también para «Datos».",
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
      "Los objetivos y las validaciones los escribe el cuerpo técnico aquí (documento «entreno:AAAA-MM-DD» de Supabase, se guarda solo). El análisis lo hace el ordenador del club al pedirlo y lo deja en «entreno-analisis:AAAA-MM-DD»: el vídeo es la cámara táctica de la carpeta SESIONES o, si no está, el entrenamiento subido a Hudl con la fecha en el título. Las tareas salen del registro de tareas (hoja) y los equipos, de Jugadores sesión. Se entra con la cuenta del staff (la de la quiniela).",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "La cabecera y los pasos",
        filas: [
          { que: "El día", es: "Flechas de semana anterior y siguiente; se marcan los días con objetivos. Si hoy no tiene, abre el último día con trabajo («Ir a hoy»)" },
          { que: "Micro · MD · Rival · tareas", es: "La sesión de ese día en el microciclo; debajo, de dónde salió el vídeo (Cámara táctica o Hudl), sus minutos y cuándo se analizó" },
          { que: "Estado", es: "Sin objetivos, Preparado, Sin analizar, Análisis pedido, Analizando (con %), N por revisar o Revisado" },
          { que: "Siguiente paso", es: "El botón dorado dice qué toca: añadir objetivos, pedir el análisis, revisar las acciones o ver la evolución" },
          { que: "Cuatro pasos", es: "Objetivos · Análisis · Revisión · Evolución, con su cuenta; un toque lleva a cada uno" },
          { que: "Flecha circular", es: "Vuelve a leer el análisis y el estado del ordenador del club" },
        ],
      },
      {
        titulo: "Objetivos",
        filas: [
          { que: "La sesión del día", es: "Las tareas del microciclo con los equipos de Jugadores sesión y lo que midió el análisis en cada una", cuenta: "Pulsar un equipo crea el objetivo con sus jugadores, su peto y su tarea ya puestos" },
          { que: "Objetivo", es: "Qué se busca, de quién, cómo reconocerlo (peto, dorsal) y qué es correcto o mejorable" },
          { que: "Mirar sólo en", es: "Opcional: acota la tarea o el tramo del vídeo («rondo 6v3», «del minuto 20 al 45»)" },
          { que: "Tarea del día", es: "En qué tarea del registro mirarlo (L-T1…). No cambia lo que mira el vídeo" },
          { que: "Meta (%)", es: "El porcentaje de correctas que se pide", cuenta: "Cumplida si el acierto llega a la meta (sólo con 8 acciones o más)" },
          { que: "De dónde sale", es: "Seguimiento individual, «Qué toca» del post, Plan de partido o Cuerpo técnico: por qué se mide" },
          { que: "Lo que toca según el post", es: "Lee el último informe post y prepara el objetivo entero (a quién, tarea, correcto, mejorable y meta); no entra en la sesión hasta añadirlo" },
          { que: "Copiar los del dd/mm", es: "Trae los objetivos del último día con el mismo texto, para seguir su evolución" },
          { que: "Pedir el análisis", es: "Lo hace el ordenador del club, uno cada vez; tarda de media hora a una hora y se puede cerrar la pantalla" },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "64 % de acierto", es: "El titular del día; con menos de 8 acciones, «5 de 7 correctas» y tendencia", cuenta: "±N puntos frente al día anterior, si los dos tienen porcentaje y se separan 5 o más" },
          { que: "Objetivos en meta · lo mejor · lo que más cuesta", es: "La lectura del día; lo mejor y lo peor, sólo entre objetivos con porcentaje" },
          { que: "Correctas · Mejorables · Revisadas · Con clip", es: "Cada cifra con su base; un toque abre los clips que la forman" },
          { que: "Cumplimiento por objetivo", es: "Barra de correctas y mejorables; la raya dorada es la meta" },
          { que: "Cuándo pasa en la sesión", es: "Acciones por tramo y una calle por objetivo con cada acción en su minuto", cuenta: "Tramos de 2 min hasta media hora de vídeo; de 5 min si es más largo" },
          { que: "Tramo sombreado", es: "Minutos que el análisis no pudo mirar: ahí no hay acciones porque no se vieron" },
          { que: "Por tarea / Por jugador", es: "Sólo si hay dos o más; las acciones de grupo sin jugador reconocido van aparte" },
          { que: "Evolución entre sesiones", es: "Acierto de cada entrenamiento analizado; columna rayada = menos de 8 acciones" },
        ],
      },
      {
        titulo: "Las cuentas",
        filas: [
          { que: "9 de 14 correctas · 3 por revisar", es: "Sólo cuentan las acciones revisadas (correctas y mejorables); las descartadas y las propuestas sin revisar, no" },
          { que: "Acierto", es: "Porcentaje de correctas", cuenta: "correctas ÷ acciones revisadas que cuentan; sólo con 8 o más" },
          { que: "Tendencia", es: "Menos de 8 acciones: se da la cuenta, no el porcentaje" },
          { que: "Sesión anterior", es: "El mismo objetivo (mismo texto) el último día analizado", cuenta: "mejora o baja = 5 puntos o más de diferencia" },
          { que: "Liso / rayado", es: "Validado / propuesta automática sin revisar, que no entra en las cifras" },
          { que: "Dar por buenas las N propuestas", es: "Valida de golpe las que quedan con el veredicto propuesto" },
        ],
      },
      {
        titulo: "Revisar",
        filas: [
          { que: "El visor", es: "El clip de cada acción con su veredicto; con el teclado: 1 correcta, 2 mejorable, 3 descartar, 0 quitar, flechas y espacio" },
          { que: "Pasar sola a la siguiente sin validar", es: "Tras validar, salta a la próxima pendiente (se puede apagar)" },
          { que: "F · pantalla completa", es: "Vídeo, lista de acciones y pizarra para pintar encima; lo pintado no se guarda" },
          { que: "sin clip · ver el minuto", es: "Se corta un ejemplo de cada veredicto por objetivo; las demás se miran en su minuto del vídeo" },
          { que: "jugador sin confirmar", es: "Sin dorsal ni peto sólo suyo, el nombre es una suposición: no cuenta para el jugador hasta revisarla" },
        ],
      },
      {
        titulo: "Por jugador",
        filas: [
          { que: "Evolución", es: "Cada objetivo suyo sesión a sesión, con la anterior, el sentido y sus clips" },
          { que: "Tu sesión", es: "Dos frases, su cuenta frente a la meta y su clip correcto y su clip mejorable, para WhatsApp; el texto se puede retocar" },
          { que: "Abrir su chat", es: "Abre WhatsApp con el mensaje escrito; lo mandas tú. El móvil sólo se recuerda en ese aparato" },
        ],
      },
    ],
    ojo: [
      "Con varios jugadores en un objetivo, a cada uno sólo se le cuentan las acciones en las que se le nombra.",
      "Para ver la evolución, el objetivo tiene que llamarse igual cada día: «Copiar los del dd/mm» lo deja igual.",
      "Si se vuelve a analizar un día, lo validado sobre el análisis anterior deja de contar (las acciones ya no son las mismas) y se avisa en «Revisar».",
      "La misma jugada contada dos veces (sobre todo en el corte entre dos partes del vídeo) cuenta una sola vez.",
      "Si el vídeo no da acciones, casi siempre es que no reconoce al jugador: peto o dorsal en «Cómo reconocerlo».",
    ],
  },

  /* ==================== LA PORTADA ==================== */
  {
    ruta: "/",
    titulo: "Portada",
    /* Sin número de áreas: era «36» y ya no lo era (19/10/2026). */
    resumen: "El próximo partido, lo que toca hoy, el rival y el equipo en cifras de un vistazo, y la puerta a todas las áreas.",
    origen:
      "El calendario y la clasificación de BeSoccer (se ponen al día cada noche), la hoja RIVALES (para abrir cada pantalla con el rival puesto), la hoja de registro del microciclo, Opta (xG, PPDA, balón parado y momentum), los informes de Wyscout (Data Análisis) y la hoja de seguimiento. Ninguna cifra se escribe aquí.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "El próximo partido",
        filas: [
          { que: "Temporada · Jornada · Hoy MD-n", es: "En qué jornada y en qué día de la semana de trabajo estamos; «· libre» si hoy no hay sesión" },
          { que: "El rival, el día y el campo", es: "Del calendario de BeSoccer; fuera de casa, con su estadio y su ciudad" },
          { que: "Cuenta atrás", es: "Días, horas y minutos hasta la hora de Madrid del partido; sin hora fijada, sólo los días" },
          { que: "La tira de días", es: "Del día después del partido anterior al del próximo; hoy en dorado, el partido recuadrado", cuenta: "MD = día de partido; MD-3 = tres días antes" },
          { que: "«libre»", es: "Día sin tareas en el microciclo escrito. Si aún no hay microciclo, es la propuesta habitual" },
          { que: "Pinchar un día", es: "Abre su sesión para poner tiempo, intensidad, evaluación y análisis post, o un seguimiento individual o de grupo" },
          { que: "El botón de hoy", es: "Los contenidos de la sesión de hoy escritos en la hoja de registro; sin sesión escrita no sale" },
          { que: "Microciclo · día 3 de 7", es: "Cuánto se ha recorrido de la semana, cuántas sesiones quedan y qué días son libres" },
          { que: "Los botones", es: "Plantilla del rival, Plan de partido, Microciclo ABP, Desplazamiento (sólo fuera) y Pizarra táctica a pantalla completa con los dos onces" },
          { que: "Lo que toca hoy", es: "MD y MD-1: En directo (el día de partido), PDF y vídeo ABP por jugador, Duelos. MD+1 y MD+2: Informe post, Análisis de datos, Histórico. MD-2 a MD-4: scout y ABP del rival" },
          { que: "Del rival", es: "Scout colectivo, ABP rival, Pizarra ABP, Duelos e Individual con el rival puesto; sin repetir lo de arriba" },
          { que: "Últimos 5", es: "Nuestros cinco últimos con el marcador debajo; el más reciente, a la derecha", cuenta: "V ganado · E empatado · D perdido" },
          { que: "Liga", es: "Puesto, puntos, V-E-D y goles a favor y en contra, de BeSoccer", cuenta: "Tras los partidos ya jugados, sin contar el que viene" },
        ],
      },
      {
        titulo: "El panel del rival",
        filas: [
          { que: "El rival · BeSoccer", es: "Su puesto, sus puntos con los partidos jugados y sus cinco últimos con marcador" },
          { que: "Cómo juega · MD-n", es: "De MD-4 a MD-1: sus goles esperados por partido, lo que concede y su posesión, cada uno con su puesto en el grupo", cuenta: "Opta si casa el nombre; si no, Wyscout. El sello dice cuál" },
          { que: "Puesto en color", es: "Verde, el tercio de arriba del grupo; naranja, el de abajo. La posesión va sin color: es estilo" },
          { que: "Goles del Castilla frente a lo esperado", es: "El resto de días: si marcamos más o menos de lo que valían las ocasiones", cuenta: "(goles − xG, redondeado a un decimal) ÷ partidos; con menos de 15 partidos, «léase como tendencia»" },
          { que: "Goles esperados (xG) por partido", es: "Sólo si no hay Opta: el de Wyscout, con su puesto, la mediana del grupo y la barra contra el mejor" },
        ],
      },
      {
        titulo: "Tu día y mesa de trabajo",
        filas: [
          { que: "Tu día", es: "Sólo el administrador: las tareas de hoy del microciclo, que se marcan aquí y en «Mis tareas»", cuenta: "Hechas ÷ tareas de hoy, en el anillo" },
          { que: "Pendientes de días anteriores", es: "Lo que quedó sin hacer; abre «Mis tareas»" },
          { que: "Informe post / Informe previa", es: "Los envíos de la semana que faltan, de hoy en adelante" },
          { que: "Mesa de trabajo", es: "Coding (admin), Jugadores sesión, Informes, Análisis de datos e Individual" },
          { que: "Lo último abierto", es: "Las cuatro últimas pantallas abiertas en este aparato, con cuándo" },
          { que: "Mis tareas", es: "Pestaña del administrador: la semana entera del microciclo, editable" },
        ],
      },
      {
        titulo: "Datos destacados",
        filas: [
          { que: "Qué sale", es: "Sólo lo que se separa de lo normal, a favor y a vigilar; si no hay nada, no se pinta", cuenta: "Doce como mucho: una por jugador y tres por familia" },
          { que: "Ver N a favor / Ver N a vigilar", es: "Abren las dos columnas con todas, su detalle y qué mirar al abrir" },
          { que: "Un aspecto de equipo", es: "Dos o tres métricas de Wyscout que dicen lo mismo, contra los equipos de la categoría", cuenta: "A partir de ±20 puntos de percentil; «por delante de N de los otros…»" },
          { que: "Una métrica suelta", es: "El Castilla entre los mejores o los peores de la liga en algo con un sentido claro", cuenta: "Percentil ≥ 85 o ≤ 15; las de estilo no se juzgan" },
          { que: "Un jugador", es: "Con al menos el 60 % de los minutos, contra los de su puesto en toda la categoría", cuenta: "Percentil ≥ 95 para bien; tres métricas en el percentil 10 o menos para mal" },
          { que: "Seguimiento", es: "Jugadores de campo del Castilla sin registro reciente y la cobertura", cuenta: "Más de 45 días sin seguimiento; cobertura ≤ 70 % avisa, ≥ 90 % es a favor" },
          { que: "Fichajes rivales", es: "Altas y bajas que BeSoccer ya tiene y la hoja de plantillas todavía no", cuenta: "Tras una noche; si el cotejo lleva 4 días sin pasar, avisa de eso" },
        ],
      },
      {
        titulo: "Opta de un vistazo",
        filas: [
          { que: "Frente a frente · por partido", es: "El Castilla y el próximo rival (si es del grupo) en xG a favor, xG en contra, PPDA y xG a balón parado", cuenta: "«5º de 20» = puesto en el grupo, del mejor al peor" },
          { que: "xG a balón parado", es: "Córner y falta, sin penaltis; debajo, sus ocasiones y sus córners de la temporada. Pocos remates: tendencia" },
          { que: "PPDA", es: "Pases que deja dar al rival por cada acción defensiva: cuanto más bajo, más presiona" },
          { que: "El último partido", es: "Marcador, xG de los dos, remates, xG a balón parado, córners y PPDA de ese partido, no la media" },
          { que: "Momentum", es: "Tramos de 5′ en que aprieta cada uno: arriba el Castilla, abajo el rival; la raya es el descanso" },
        ],
      },
      {
        titulo: "El equipo en cifras",
        filas: [
          { que: "Con seguimiento", es: "Jugadores de campo con licencia del Castilla con algún seguimiento desde el 21/10, como el Dashboard Seguimiento", cuenta: "% = jugadores con seguimiento ÷ jugadores de campo" },
          { que: "Seguimientos", es: "Registros desde el 21 oct y cuántos en los últimos 30 días (o esta semana, si son todos)" },
          { que: "Reintentar", es: "Si la hoja de seguimiento no contesta, sólo sale la plantilla y el botón para volver a pedirla" },
          { que: "Áreas de trabajo", es: "Seis de las más usadas en este aparato (sin repetir la mesa), el buscador y «Ver todas las áreas»" },
        ],
      },
      DE_DONDE_SALE,
    ],
    ojo: [
      "Con dos o tres jornadas, una alerta es un indicio: dice dónde mirar, no qué hacer.",
      "El orden de las alertas es por cuánto se sale de lo normal, no por importancia: eso lo pone el cuerpo técnico.",
      "El panel del rival es siempre oscuro, también en modo día: es a propósito.",
    ],
  },

  /* ==================== JUGADORES SESIÓN (21/10/2026) ==================== */
  {
    ruta: "/jugadores-sesion",
    titulo: "Jugadores sesión",
    resumen: "Los equipos de cada tarea del día, a partir de la lista del delegado, listos para proyectar o mandar.",
    origen:
      "La lista que se pega (título, listado y apartados de bajas) y las tareas del microciclo de ese día (hoja de registro). Los puestos salen de la plantilla y de dónde coloca el cuerpo técnico a cada uno; el once, de la pizarra táctica; sinergias y perfiles, de Wyscout. Se guarda en el documento «jugadores-sesion» de Supabase.",
    revisada: "2026-11-12",
    bloques: [
      {
        titulo: "La sesión",
        filas: [
          { que: "18 disponibles · 3 equipos en la tarea 2", es: "El titular: quién está y cómo va la tarea abierta («tarea 1 sin equipos» mientras no hay nadie colocado)" },
          { que: "disponibles · bajas · tareas listas", es: "Las cifras del día; las bajas, con su motivo al pasar por encima", cuenta: "Tareas listas = tareas sin nada que corregir ÷ tareas" },
          { que: "Las tareas del microciclo", es: "Al crear la sesión las tareas salen del plan de ese día, con equipos y comodines de su formato; casan con la hoja por nombre antes que por código" },
          { que: "Traer", es: "Si el plan cambió (tareas que faltan, nombres u orden), las añade y las ata sin mover a nadie; se puede deshacer" },
          { que: "Punto de cada tarea", es: "Verde, lista; ámbar, con avisos; rojo, falta algo" },
        ],
      },
      {
        titulo: "Hacer los equipos",
        filas: [
          { que: "En un toque", es: "2 equipos, 2 + 1 comodín, 2 + 2 comodines, 3 grupos, 3 + 2 comodines o 4 rondos: pone la forma y propone el reparto" },
          { que: "Más · criterio · repetir reparto", es: "El criterio del reparto y «Como el 28 oct» o copiar de otra tarea, de hoy o de otro día, casado por nombre" },
          { que: "Proponer equipos / Otra propuesta", es: "Reparte a todos los que hacen la tarea con el criterio elegido (P)", cuenta: "Porteros separados y los comodines rotan entre quienes menos lo han sido; debajo sale una línea por equipo que explica el reparto" },
          { que: "Titulares vs suplentes", es: "El once de la pizarra táctica (tablero «Once 4-2-3-1») en un equipo y los suplentes en el otro", cuenta: "Casado por nombre con la lista; si el once no llena el equipo, entran suplentes de la línea que falta" },
          { que: "Mezcla parcial / total", es: "Parcial: el porcentaje del deslizador cambia titulares de lado, cada uno por un suplente de su línea (100 % = mitad y mitad). Total: titulares a partes iguales y líneas parejas, al azar" },
          { que: "Por líneas", es: "Cada equipo con portero, defensas, medios y arriba; laterales y centrales repartidos" },
          { que: "Sinergias / Por perfiles", es: "Parten de «Por líneas» y sólo cambian jugadores de la misma línea", cuenta: "Sinergias: juntas las parejas que se potencian según Wyscout (Data análisis, once). Perfiles: el rasgo que más destaca de cada uno contra su puesto, repartido o junto" },
          { que: "Completar", es: "Coloca sólo a los que faltan, en el equipo más corto, sin mover a nadie", cuenta: "Sale cuando ya hay alguien colocado y alguien pendiente" },
          { que: "Más (junto a Proponer)", es: "Vaciar la tarea, Como la anterior (equipos, colores y comodines de la tarea de antes), Duplicar, Mover antes o después y Quitar esta tarea" },
          { que: "Chip del puesto", es: "En los que suben del RMC o del Juvenil A, el puesto aprendido de cómo los colocáis (borde de puntos) o el fijado a mano (lleno). Tocarlo lo corrige para todas las sesiones" },
          { que: "Soltar encima de otro", es: "«Cambiar»: los dos se intercambian el sitio. «Compartir puesto»: van juntos en el mismo hueco (dos, tres o los que hagan falta)", cuenta: "Debajo del campo, «También en…» comparte ese mismo puesto en el otro equipo: entra el que esté fuera del dibujo o queda un «+» donde soltarlo" },
          { que: "Cambio a mitad", es: "Un segundo momento de la tarea con otros equipos; sale como otra diapositiva" },
        ],
      },
      {
        titulo: "El validador",
        filas: [
          { que: "Rojo", es: "Falta alguien por colocar, hay un equipo vacío o un nombre repetido en la lista" },
          { que: "Ámbar", es: "Equipos o líneas descompensados, porteros juntos, colores repetidos o comodines que no cuadran", cuenta: "Línea descompensada: dos o más de diferencia entre equipos en defensas, medios, extremos o delanteros" },
          { que: "La tarea pide 14 (6v6+2) y hay 11 colocados", es: "El formato escrito en la hoja contra los colocados; no se compara si la tarea se renombró o tiene otros equipos" },
          { que: "La tarea lleva 2 · hay 3", es: "Comodines de más o de menos, con el botón que dice a quién mueve" },
          { que: "Com. y Fuera", es: "En la plantilla del día, en cuántas tareas ha sido comodín o no ha participado cada uno" },
        ],
      },
      {
        titulo: "Mandarlo",
        filas: [
          { que: "Presentar", es: "La diapositiva a pantalla completa; en el móvil, tocarla la abre en grande" },
          { que: "Descargar esta / Descargar las N", es: "Imágenes .jpg a 1920×1080, una por tarea (dos si hay cambio a mitad)" },
          { que: "PDF de la sesión", es: "Todas las diapositivas en un solo archivo, una por página" },
          { que: "Con cabecera / Sólo equipos / Limpia", es: "Limpia: sólo el título de la tarea y los campos, con los nombres más grandes; vale para las imágenes y el PDF" },
          { que: "Copiar texto / Copiar todo", es: "Los equipos de esta tarea o de todas en texto, para el grupo de WhatsApp" },
          { que: "Mandar al grupo", es: "Abre WhatsApp con los equipos en texto y descarga la sesión en una imagen vertical; no se manda nada solo" },
        ],
      },
      {
        titulo: "Teclado",
        filas: [
          { que: "P · ← → · N", es: "Proponer (otra vez: otra propuesta), tarea anterior o siguiente, tarea nueva con los mismos petos" },
          { que: "1-6 · C · F · 0", es: "Con un jugador elegido: a ese equipo, comodín, no hace la tarea, sin colocar" },
          { que: "Ctrl+Z · Ctrl+Y · ?", es: "Deshacer, rehacer y la chuleta de atajos" },
        ],
      },
    ],
    ojo: [
      "Los lesionados empiezan fuera de cada tarea; si alguno hace una, se le mete en un equipo y el validador lo señala.",
      "Volver a pegar la lista manda: quien no esté en ella sale de todas las tareas.",
      "El puesto de cada uno: lo puesto a mano en la sesión, luego lo fijado en su ficha; después, para los que suben, lo aprendido antes que la plantilla, y para los del Castilla, la plantilla antes que lo aprendido.",
      "En una analítica o un trabajo específico los grupos desiguales no se avisan: son buscados.",
      "El criterio elegido se recuerda en este aparato.",
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
