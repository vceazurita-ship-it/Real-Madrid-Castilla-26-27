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
      "public/data — wys/ son los informes de Wyscout (un .xlsx por equipo) y opta/ sus descargas («Clasificación justa» y «Nuestra salida contra la presión», de opta:partidos; el próximo rival, del calendario de BeSoccer). El balón parado sale de nuestras cuatro hojas y los entrenamientos, de la hoja de microciclos.",
    bloques: [
      {
        titulo: "Lo nuevo (19/11/2026): ocasiones que concede el rival",
        filas: [
          { que: "Próximo rival (abre con él)", es: "El del próximo partido según la regla de la portada (fecha y hora de Madrid de BeSoccer, 2,5 h de gracia), en «Un equipo de un vistazo», el ABP de la categoría y la clasificación justa." },
          { que: "Vídeo del partido", es: "Los botones (Coding, Hudl, Grabación táctica, Resumen) llevan el rótulo entero; si no caben en una línea, la fila pasa a la siguiente." },
          { que: "Selector de partido", es: "Cada partido se lee corto: «J12 · Nàstic 0-1» (jornada, rival en su nombre corto y marcador con el local primero, como la cabecera)." },
          { que: "Pestañas del partido (móvil)", es: "En el móvil, «El partido / En directo / Partidos ya jugados» van en su propia fila, encima de la cinta fija, y pasan de línea si no caben; desde tableta siguen dentro de la cinta." },
          { que: "Los goles del partido en vídeo", es: "Mientras llegan los vídeos sale «Cargando el vídeo…». Si a los 12 s no ha llegado nada, cambia a «El vídeo de los goles no ha llegado» con un botón «Reintentar», que vuelve a pedirlo de cero. Si ningún gol tiene vídeo, el bloque no sale." },
          { que: "Pisamos campo rival", es: "La frase del 3D («Pisamos campo rival el 62 % del partido…») se cuenta por ACCIONES, no por tiempo: del evento a evento de Opta, de las acciones con balón de los dos equipos en campo rival (sin faltas ni córners), qué parte son nuestras. Debajo va su base: cuántas acciones hay entre los dos y cuántas son de cada uno. El porcentaje lleva un suavizado de unos 4 m sobre el campo (el del 3D) y la base es el recuento tal cual, así que pueden diferir en un punto." },
          { que: "Franja del partido compacta", es: "En «Post del partido» el marcador y el desplegable del partido van en una franja baja; las tres claves salen justo debajo." },
          { que: "Robos y pérdidas: base de la media", es: "La media va con su base pegada: «Robos en campo rival: 4 · media 5,7 (11 partidos anteriores, tendencia)». Si el vídeo etiquetado no cubre todas las jornadas anteriores (según la jornada del calendario), dice «X de los Y partidos anteriores, los etiquetados» y se marca tendencia." },
          { que: "Vídeo del partido", es: "Bajo las tres claves: Coding (cortes del partido), Hudl, la grabación táctica (sólo en el ordenador principal) y el resumen de la RFEF en YouTube. Lo que no existe no sale (lib/video-partido/enlaces.ts)." },
          { que: "Los goles del partido en vídeo", es: "Mientras llegan los vídeos sale «Cargando el vídeo…»; si ningún gol tiene vídeo, el bloque no sale (antes quedaba un hueco en blanco)." },
          { que: "Partido en el campo, plegado", es: "El campo de Wyscout del partido se abre con «Ver el partido en el campo»; a la vista quedan las claves y el cara a cara. Dentro, «Las cifras del momento» (la misma tabla en columna) va también plegada en «Detalle», igual que en el área Partido en el campo." },
          { que: "Bloques en el móvil", es: "A menos de 640 px los siete bloques van en un desplegable con «Más de Análisis» al lado; la tira de pestañas sólo desde 640 px, para que no se corte («Resum…»)." },
          { que: "Nombre del jugador en las claves", es: "El nombre y «su ficha» abren /individual?nombre= con el jugador ya elegido; «su seguimiento» abre su pestaña de seguimiento. El nombre se resuelve contra la plantilla con la misma regla de nombres que el resto de la app." },
          { que: "El partido, cara a cara", es: "A la vista las claves, el cara a cara y los goles en vídeo; «Ver más» despliega quién mandó en cada tramo y todos los remates" },
          { que: "Quién manda en cada tramo", es: "El título lleva la conclusión: quién mandó en más tramos de 5′ y, si cambia, quién en la 2.ª parte" },
          { que: "Clave Ocasiones", es: "Una línea con la calidad de nuestros goles según su xG de Opta (baja por debajo de 0,1, clara desde 0,3)" },
          { que: "Jugador de la clave", es: "El nombre, subrayado, abre su ficha completa; al lado «su ficha · su seguimiento»" },
          { que: "Lectura del campograma", es: "La frase conserva las siglas («xG a favor», no «xg a favor»)" },
          { que: "Ocasiones que concede · cuántas y de qué calidad", es: "En Rival y categoría → Un equipo de un vistazo, debajo de la clasificación justa. Un punto por equipo de nuestro grupo: a la derecha, más remates concedidos por partido; arriba, más xG vale de media cada remate que le hacen. Las rayas son la media de la liga y dejan cuatro cuadrantes: «concede mucho y peligroso», «concede mucho pero lejos» (no basta con llegar: hay que pisar el área), «concede poco pero claro» (paciencia, esperar la ocasión buena) y «sólido». En azul el próximo rival (o el que se elija en «Equipo» o pinchando su punto) y en oro el Castilla; el titular dice en qué cuadrante cae y qué hacer contra él. Debajo, el mapa de los remates que concede ese equipo (rojo dentro del área, azul fuera; tamaño = xG; aro blanco = gol) con el % de cada zona y su xG por remate frente a la liga", cuenta: "Opta, opta:remates (cada remate con sus x/y y su xG, de lib/opta-eventos.ts), sólo partidos entre dos equipos del grupo del Castilla y sin penaltis. Remates concedidos por partido = remates que le hacen / partidos en que aparece; xG por remate = xG concedido / remates concedidos. Las líneas = media de los equipos del grupo; un equipo en la línea o por encima cuenta como «mucho» o «peligroso». Dentro del área = x ≥ 83 e y entre 21,1 y 78,9; el % de la liga es el de todos sus remates concedidos juntos. Con menos de 5 partidos, tendencia. Las cuentas, en lib/data-analisis/ocasiones-concedidas.ts; el próximo rival, del calendario de BeSoccer" },
        ],
      },
      {
        titulo: "Lo nuevo (18/11/2026): las visuales de las ideas de X",
        filas: [
          { que: "En todas", es: "Misma idea visual que la publicación de X de la que salió, con la letra del club (Barlow Condensed) en el titular y las cifras, la tarjeta de la app (canto y sombra, día y noche) y una entrada suave. Los datos y las cuentas no cambian" },
          { que: "Nuestra historia · nuestra salida contra la presión", es: "Al pie de «Nuestra historia»: un punto por partido del Castilla, con el PPDA del rival en ese partido (eje X; a la izquierda, más nos aprietan) y nuestras pérdidas en campo propio (eje Y), la recta y su r. Sobre la recta, en azul, el próximo rival según su PPDA medio y las pérdidas que cabe esperar de nosotros; la raya discontinua es la media de la liga en ese mismo tramo de PPDA, y en oro nuestros partidos ante quien presionó así. Si esperamos 1 pérdida o más que la liga, avisa: «semana para preparar la salida contra presión»", cuenta: "Opta (opta:partidos): el PPDA, de la fila del rival; las pérdidas (PsLostD3, nuestro primer tercio), de la nuestra. Recta de mínimos cuadrados y r de Pearson, con las mismas lecturas que en el Scout colectivo (≤ −0,5 «cuanto más nos aprietan, más perdemos»; entre −0,3 y 0,3 «aguanta»); con menos de 5 partidos no hay tendencia. Próximo rival: el siguiente partido del calendario de BeSoccer, cruzado con Opta por nombre; su PPDA medio es la media de sus partidos de la temporada. Pérdidas esperadas = a + b·PPDA del rival. Tramo = PPDA del rival ± 1,5; la media de la liga es la de las pérdidas en campo propio de los demás equipos de nuestro grupo en los partidos en que su oponente presionó en ese tramo" },
          { que: "Clasificación justa", es: "Titular con lo nuestro (los puntos del Castilla y los que merecería por xPts) encima de las dos tablas enfrentadas" },
          { que: "Huella táctica", es: "Titular con la lectura del partido y, como el original de X, todos los partidos en miniatura con la misma escala; pinchar uno lo abre en grande" },
          { que: "¿A qué altura tocan el balón los centrales?", es: "Titular con la diferencia entre fuera y casa; cada partido con el rival en la letra del club, «vs» en casa y «en» fuera, y la altura en cifra grande" },
        ],
      },
      {
        titulo: "Siete bloques: el partido, resumen, nuestro equipo, jugadores, rival y categoría, balón parado, entreno e identidad",
        filas: [
          { que: "Qué miro el lunes (directo, partido acabado)", es: "Tres pasos, con el último partido abierto en En directo. 1) El veredicto bajo el marcador y «Logramos X de Y objetivos que deciden». 2) Cada «No logrado» trae su línea para el vídeo y de qué minutos sacar los clips. 3) Colectivo → Balón parado: la línea «Entrenar» de cada equipo va a la tarea de ABP del micro." },
          { que: "El partido", es: "«Post del partido» (lo que se abre) y «En directo»: las cifras del partido del día mientras se juega, que se ponen al día solas cada minuto. Si no hay directo, el administrador tiene aquí «Empezar directo»; recién lanzado sale «Arrancando el directo…» y la pantalla mira cada 15 s hasta la primera lectura (si en 6 minutos no llega, lo dice, enlaza la pasada de GitHub y ofrece «Reintentar»; un segundo toque en los 3 minutos siguientes no lo lanza dos veces)" },
          { que: "Cómo se está dando el partido (directo)", es: "Qué es: si juega el Castilla, cada tema del plan de partido de ese rival (/match-preparation) es una tarjeta con una cifra de Opta; siempre van nuestras ocasiones, el peligro que nos crean y las amarillas desde la segunda\nColores: ALERTA (rojo) = fuera de lo raro por el lado malo, con la consigna para el banquillo; CERTEZA (verde) = lo mismo por el lado bueno; EN EL FILO (ámbar) = entre lo habitual y lo raro; LO HABITUAL (gris); PRONTO hasta el 20′; SIN DATO si Opta no la da\nLo habitual: el rango entre los cuartiles 25 y 75 de los partidos de esta temporada de ese equipo, llevado al minuto con la curva real de la liga; lo raro, fuera de los cuartiles 10-90. Si la cifra se sale de lo habitual por menos de un 15 % del ancho del rango, va a EN EL FILO, no a alerta ni a certeza. Una alerta nueva sale primero como «posible» y se confirma en la lectura siguiente; ganando, ceder balón no es alerta\nEn el banquillo: cuatro tarjetas grandes y el resto plegado; «Pantalla completa» agranda cifras, marcador y minuto; del 44′ al 52′, «Descanso» con las tres alertas que más pesan; al confirmarse una alerta, pitido y vibración; si las cifras tienen más de 3 minutos, una línea ámbar lo dice\nPartido acabado: «Final del partido», veredicto en una línea bajo el marcador (ganamos/perdimos con más o menos ocasiones, con el xG) y el balance frente al plan: «Logramos X de Y objetivos que deciden» y cada tema con Logrado, Como siempre, En el filo o No logrado; los no logrados llevan la línea para el vídeo del lunes y el tramo de minutos en que mandó el rival (de ahí, los clips). Si no jugamos, cada equipo contra su propia media" },
          { que: "El partido en el campo (directo)", es: "Debajo del plan, con el evento a evento de Opta y un selector de tramo (partido, cada parte, últimos 15′): cuatro marcadores (toques, xG, robos, pases progresivos); territorio y mapa de calor de cada equipo (los dos atacando a la derecha); la red de pases del once inicial de cada uno con el dorsal y la pareja que más se asocia; los remates de los dos en un campo (tamaño = xG) y la curva de xG acumulado con los goles; robos y pérdidas por tercios; y el rendimiento individual (los tres de más impacto y la tabla ordenable). Al pinchar un jugador, en la red o en la tabla, su ficha: sus cifras, su mapa de calor y sus pases y robos. También vale para repasar un partido ya jugado", cuenta: "Lo deja scripts/opta-directo.mjs en opta:directo:<partido> (eventos y jugadores): Opta da cada evento dos veces (una por equipo) y se deja una, con el equipo de quien la hace. Impacto = suma del xPV añadido de Opta. Progresivo = pase completado que acerca el balón a la portería al menos un 25 %. Robo = recuperación, intercepción o entrada ganada; pérdida = pase fallado, regate perdido o robado en conducción (las reglas de lib/opta-eventos.ts). Territorio = de los toques en el último tercio, el % de cada uno. Calor = toques suavizados unos 6 m. Los cálculos, en lib/opta-directo-mapas.ts" },
          { que: "Balón parado (directo)", es: "Un córner «con remate» acaba en tiro antes de 10 s; la «contra encajada» es un tiro rival antes de 15 s. En Colectivo → «Balón parado»: de cada equipo, los córners, los saques de banda en el último tercio, cuántos acaban en remate, su xG y goles, las contras que encaja después, «Entrenar» (la zona que más se repite, quién remata y, si nada acaba en remate, cuántos córners gana o despeja el rival al primer contacto; el del rival, leído como nuestra defensa: quién gana esa zona y quién marca a su rematador), quién saca los córners, dónde caen (primer palo, centro, segundo palo o en corto) y quién remata; la frase de arriba da el veredicto por remates y xG y avisa de las contras encajadas. Arriba, una frase con quién saca más del balón parado. Las faltas no salen: Opta no las marca en el directo", cuenta: "lib/opta-directo-mapas.ts (balonParado, zonaCorner: corto si cae antes de x 83; dentro, por los postes en y 45,2 y 54,8 medidos desde el lado del saque): córner = pase desde la esquina (x ≥ 99 e y ≤ 1 o ≥ 99; cuadra con los córners de Opta); banda arriba = saque de banda desde x ≥ 66,7; remate = del mismo equipo en los 10 s siguientes; contra = remate rival en los 15 s siguientes" },
          { que: "Fotos de los jugadores (Opta)", es: "Opta no da fotos: en la ficha del directo y en la radiografía sale la foto de nuestra plantilla para el Castilla y, para los rivales, la de su ficha en Plantillas rivales (BeSoccer). Si no se puede saber con seguridad quién es, salen las iniciales en vez de la cara de otro", cuenta: "hooks/useFotosOpta.ts: mismo club (mismoClub) y mismo apellido; con dos del mismo apellido, hace falta el nombre completo. Fotos rivales por /api/rivals/foto" },
          { que: "Pestañas del directo", es: "El marcador va con el local a la izquierda; con el partido acabado, el título dice «Final del partido», arriba sale el balance frente al plan: cada tema una vez, con su cifra y su referencia, y el veredicto Logrado / Como siempre / En el filo / No logrado (primero lo que decide; «como siempre», plegado; el texto del plan, al pasar el ratón); ya no sale «quién manda en los últimos 15′», las cifras son las finales y las tarjetas con consigna no repiten el «Plan:». Debajo del marcador, tres pestañas fijas arriba al bajar: Colectivo (alertas, certezas y en el filo del plan de partido, los cuatro marcadores y una botonera para ver de uno en uno el relieve, dónde se juega, la red de pases, remates y xG, robos y pérdidas o balón parado, o «Todo seguido»), Individual (por equipo: Alertas —cada una con su línea para el vídeo y la tarea; la del portero, de juego de pies—, Certezas y Lo habitual de cada jugador frente a lo suyo de la temporada, con los de menos de 20′ al final; luego los destacados, la tabla y la ficha) y Todas las cifras", cuenta: "Individual, con las cifras de Opta del partido entero frente a opta:jugadores por 90′ (20′ jugados y 270′ en la temporada): alerta si pierde 1,5 veces lo suyo (y 3 más), acierta 12 puntos menos en el pase, toca un 40 % menos o gana 20 puntos menos de duelos; certeza si acierta 8 puntos más en el pase, toca un 40 % más, recupera 1,6 veces lo suyo (4 o más) o suma 0,3 xG o 2 ocasiones" },
          { que: "El partido en 3D", es: "Arriba de los mapas del directo, en «Todos a la vez» y arriba de «Post del partido»: el campo entero como superficie que se mueve, en bucle, con el local a la izquierda, sobre un suelo ancho de baldosas que se apaga a lo lejos y refleja en su borde el color del equipo que domina esa zona. Cada zona toma el color del equipo que la domina en los últimos minutos y sube con la actividad; los remates levantan un bulto y el gol, un destello blanco y su nombre. Marcador con los colores, minuto y parte, y abajo la curva de quién manda. Mandos: pausa, desde el principio, velocidad y minuto; el administrador fija los colores de cada partido en «Colores». Botón de pantalla completa (las dos flechas, junto a pausa): el campo ocupa toda la pantalla con los mandos flotando abajo; Esc o el mismo botón para salir, y en el móvil intenta girarse en horizontal. Al girar el móvil el campo se ajusta al alto que hay, sin cortarse", cuenta: "lib/opta-retrato.ts: acciones del evento a evento repartidas unos 4 m en una malla de 52 × 34; ventana de 12 minutos con peso que se apaga en ~4; altura = raíz de la actividad; remates, bulto por su xG durante 3 minutos. Colores: los fijados a mano (opta:colores); si no, el Castilla de blanco en casa y de verde fuera, y el rival con el teamColor de Opta. Idea: Football Dataportraits y Alexander Bogachev" },
          { que: "Partidos ya jugados", es: "En el bloque «El partido», junto a En directo: todos los partidos de la temporada que pasaron por el directo, con un buscador por equipo, y al pulsar uno se abre con todo lo que tenía en directo (marcador, balance, tarjetas, mapas, 3D, individual y todas las cifras). No mira si hay directo ni se refresca. Desde el desplegable del directo hay un enlace aquí", cuenta: "La misma pantalla del directo leyendo opta:directo:archivo y opta:directo:<partido>; nada nuevo se guarda" },
          { que: "Partidos sin el Castilla (directo)", es: "Cada tarjeta dice de qué equipo es la cifra: «Ocasiones de Sabadell», «Gimnàstic deja dar demasiados pases a Sabadell», «Amarillas de…» (las de los dos). Rojo y verde se leen desde el equipo de la izquierda (el próximo rival si juega), y la línea de arriba lo dice. Lo mismo en «Últimos 15′» («aprieta Sabadell»), en el balance del final («Gimnàstic: 1 de 3 cifras que deciden, a su favor», con A favor / En contra) y en el balón parado («Lo que repite X a balón parado»)" },
          { que: "Ver otro partido (directo)", es: "Para todos: un desplegable con los partidos de la temporada que ya tienen todos sus datos (plan, mapas, 3D, jugadores) y se abren al momento, también el de ayer; sólo salen los que tienen datos. Con varios partidos en el directo, la tira de arriba y el selector cambian de uno a otro; en la tira, el archivo y la galería, el local va primero", cuenta: "opta:directo:archivo, que actualiza scripts/opta-directo.mjs con cada partido que guarda; la temporada se cargó entera el 14/11/2026 (SIN_INDICE=1 PARTIDO=<id> --chrome, uno a uno)" },
          {
            que: "Post del partido (17/11/2026)",
            es: "Arriba el partido con el local primero («Gimnàstic Tarragona 0-1 Real Madrid Castilla»), y victoria, empate o derrota; el desplegable usa la misma convención. Sale aunque la carpeta de Wyscout aún se esté leyendo (lo de Wyscout entra al llegar), también en el móvil. Debajo, «Las tres claves del partido» en dibujo, cada una con el botón que lleva a donde se ve entera: ocasiones (goles esperados de los dos en dos barras → Nuestros remates), robos en campo rival y pérdidas en campo propio (reparto por zonas en una barra, con la media de los partidos anteriores y el que más roba o pierde, con su ficha y su seguimiento → Robos y transiciones y Pérdidas y transiciones, ya en ese partido); si falta una, el duelo aéreo. «De este partido» a un toque, con los nombres del menú: Robos y transiciones, Pérdidas y transiciones, Análisis de faltas (sólo si el partido está en cada laboratorio, etiquetado o con el respaldo de Opta), Los goles del partido en vídeo (18/11/2026: abre el pop-up de la portada con los goles de ese partido, de los dos equipos: «Los dos», los del rival o los nuestros), «Cómo son nuestros goles» (aparte, a Análisis de goles), ABP del Rival, Vídeo Análisis Partidos y Plan de Partido. Una sola fila de navegación (18/11/2026): los bloques de Análisis de datos y, a su derecha, «Más de Análisis», que despliega las otras pantallas de la sección (Coding, Vídeo análisis, Robos…); en esta pantalla no sale la tira de la sección encima. En las demás pantallas esa tira se ve entera en escritorio (pasa a otra línea si no cabe) y en el móvil desliza con flechas en el borde que tiene más. Debajo, la cinta fija: las áreas del bloque (Post del partido, En directo, Partidos ya jugados) y los bloques de la pantalla (El partido, cara a cara; Acción a acción…); se queda arriba al bajar. Lo primero, el cara a cara: 5 cifras clave (xG, remates, a puerta, toques en el área y PPDA), cada barra con una raya fina en la media de la temporada de ese equipo y la cifra debajo («media 1,2»), y el resto bajo «Ver todas las cifras» (también con su media: el duelo aéreo del partido, 39,3 %, junto a nuestra media). «Quién manda en cada tramo» lleva rotulado sobre el gráfico «▲ Arriba, Real Madrid Castilla» y «▼ Abajo, el rival», cada uno en el extremo más alejado de los goles de su lado, para que «11′ Fortuny» no lo pise; el goleador del gráfico lleva a su ficha. Los remates, en una sola tarjeta con pestaña Castilla / rival: tres cifras (remates con los que fueron a puerta; goles; goles esperados con su base, «0,5 en 13 remates · temporada: 1,2 en 11 por partido»), la tarjeta «Remates mejor o peor colocados de lo que valían» con una frase que sigue las tres barras de debajo y cuenta con las cifras ya redondeadas («Nuestros 0,5 de goles esperados bajaron a 0,3 tras el golpeo (−0,2…)»); con un partido, tendencia. Al lado, cada remate con su minuto, su tirador (el nuestro, a su ficha de Individual; el del rival, a Scout rival individual), cómo acabó, su xG y «▶ Vídeo en Opta»: los goles a la vista y el resto plegado. Encima, los goles del partido en vídeo, de los dos equipos, con el reproductor de Análisis de goles («Ver el gol» si hay uno; «Ver de seguido los N goles» si hay más). Después el 3D: encima, su titular con los goles esperados del mismo dato de Opta que el cara a cara, un decimal y el Castilla primero, como en toda la pestaña («Goles esperados, Castilla 0,5 – 0,7 Gimnàstic: creó más el Gimnàstic») y el subtítulo que dice quién es local y va a la izquierda en el dibujo; dentro, el panel dice la misma cifra con un decimal («Goles esperados 0,7 – 0,5»), «Campo rival pisado por el Gimnàstic: 89 % en el tramo final · 39 % en todo el partido» y la leyenda con los mismos lados que el dibujo (el local a la izquierda). En el móvil el 3D va plegado («Ver el 3D»). Sale parado en el final con el partido entero (se reproduce al pulsar) y sus cifras siguen al minuto que se ve. «Acción a acción»: los pases progresivos (porcentaje con un decimal, como todos los de la pestaña) y el detalle plegado; los robos en campo rival y las pérdidas en campo propio ya no se repiten aquí porque están en las tres claves (sólo salen aquí si las claves no los tienen). En las claves, el que más roba o pierde lleva sus minutos de ese partido («7 de 40, en 90′»). Lo que una fuente aún no tiene no sale. Al pie, «¿Qué toca en el microciclo?» con una o dos tareas atadas a una cifra del cara a cara cuando la diferencia es clara; cada una con una barra de la cifra del partido y una raya en la media de la temporada, el botón «Llevar al microciclo» (copia la tarea y abre el editor del microciclo para pegarla en la sesión) y, si Opta los tiene, los centros del rival o los duelos aéreos de ese partido en vídeo, uno a uno; la de centros lleva su criterio de éxito, que el rival no pase de nuestra media de centros recibidos (Opta, en los otros partidos). Desde otra pantalla (Plan de partido, histórico, laboratorios) se abre ya en el partido que se pinchó. Desde 1400 px de ancho, el buscador de áreas va en la misma fila que los bloques",
            cuenta: "Órdenes: duelos aéreos ganados por debajo del 45 % (objetivo: volver a nuestra media de la temporada en Opta sin ese partido, con 3 partidos o más); el rival centra 15 veces o más y al menos 1,5 veces lo nuestro; o nos crean 0,5 de xG más de lo que creamos. Como mucho dos. Robos y pérdidas: la cuenta de los laboratorios (lib/transiciones/partidos-laboratorio.ts, compartida): el vídeo etiquetado en Hudl y, si el partido aún no lo está, el evento a evento de Opta en juego; campo rival / campo propio por la zona de cada acción; la media, de los partidos anteriores sin pretemporada (menos de 15, tendencia). Ya no se usan las recuperaciones y pérdidas agregadas de Opta (Recovery, PossLost), que cuentan otra cosa. Remates: cambio = lo que valían a puerta tras el golpeo (xGOT) − los goles esperados de todos los remates (xG); goles evitados = xGOT − goles encajados. El 3D, en el pitido final, toma el xG de la fila de Opta del cara a cara. Media de la temporada del cara a cara: la de los otros partidos de Opta de cada equipo (3 o más; menos de 15, tendencia). Goles esperados de la temporada por partido: suma de xG de sus remates en los otros partidos entre esos partidos. Centros del rival en vídeo: pases del rival desde la banda (y < 21,1 o > 78,9) en nuestro último tercio que caen en el área; duelos aéreos: los eventos «Aerial» nuestros del evento a evento",
          },
          {
            que: "El mismo partido que la portada (18/11/2026)",
            es: "La portada y el post del partido dicen lo mismo con las mismas frases. Titular de «Ocasiones»: «Ganamos 1-0 con menos goles esperados (0,5 – 0,7)», y debajo los remates y a puerta de los dos. Robos y pérdidas: «Diego Aguado: 7 de los 40 robos del equipo, en 90′». En «De este partido» ya no se repiten Robos y Pérdidas cuando su tarjeta de arriba está (cada tarjeta lleva a su pantalla). El cara a cara lleva arriba la leyenda de la raya fina, y cada media dice de quién es y de cuántos partidos sale: «nuestra media 1,6 en los otros 11 · su media 1,1 en sus otros 11» (la portada da la media de los 12, con el partido dentro). «El partido en 3D» va plegado: se ve su conclusión, «Pisamos campo rival el 62 % del partido; en el tramo final (desde el 75′), el Gimnàstic, el X %», y el 3D se abre con «Ver en 3D», con el Castilla a la izquierda y primero en el marcador, como el cara a cara. «Más de Análisis» va al final de la fila de bloques, entera; el buscador de áreas, en la misma fila desde 1600 px. A la derecha queda un margen para el botón ⋮.",
            cuenta: "Frases en lib/partido-frases.ts: titularPartido (diferencia de xG menor de 0,15 = «parejos»), fraseCampoPisado (de las acciones en campo rival de los dos, cuánto son nuestras: el partido entero y del 75′ al final; si en el tramo final manda el rival, su porcentaje) y nombreCorto. El mismo cálculo en la portada y dentro del 3D al pitido final.",
          },
          { que: "Lecturas", es: "Cuando dos áreas contestaban lo mismo van en un botón con dos o tres lecturas; la primera es la que se abre" },
          { que: "Sello de fuente", es: "Debajo del título: de qué fuente sale, con quién se compara y hasta qué jornada llega. Opta manda en xG, remates, presión, balón parado y estilo; Wyscout en el perfil del jugador, el once y los duelos" },
          { que: "Resumen", es: "Lo primero que se abre: las claves de la jornada, cada una con el botón que lleva a donde se ve entera, y el mapa de toda la sección. Arriba a la derecha, el buscador de áreas" },
          { que: "Escala del percentil", es: "La misma en todas las áreas: verde P60 o más, oro en la media, naranja P40 o menos" },
          { que: "Partido en el campo", es: "Dos lecturas: por momentos (campograma) y pase a pase (red de pases, pases que hacen avanzar, recuperaciones y pérdidas por altura)" },
          {
            que: "Huella táctica",
            es: "Debajo de la red de pases: dónde tocamos el balón en un partido (selector) frente a lo normal nuestro, como mapa de calor continuo sobre el campo de 105 × 68 y siempre atacando a la derecha. Rojo = ahí tocamos más que nuestra media, azul = menos, sin color = como siempre, con la misma escala en todos los partidos. Al pasar el ratón, la zona (12 × 8) con su % y el de la media. Debajo, el % de toques en campo rival del partido, la media y la diferencia. Sale de opta:castilla-eventos (EventX, EventY), sólo las acciones del Castilla",
            cuenta: "Cada toque se reparte con un suavizado gaussiano de unos 6 m en una malla de 50 × 34; la densidad del partido suma 1 (reparto, no volumen) y se le resta la media de las densidades de la temporada (cada partido pesa igual; sólo partidos con 50 toques o más). La escala es el mayor desvío de la temporada. La frase y el texto al pasar el ratón van por zonas de 12 × 8. Campo rival = x ≥ 50",
          },
          {
            que: "Altura de los centrales",
            es: "Debajo de la huella táctica: «¿A qué altura tocan el balón los centrales?». Una tarjeta por partido con un campo vertical (atacamos hacia arriba) y el punto medio de los toques de cada central del Castilla (con su dorsal), la línea discontinua a la altura media y, debajo, la altura en metros desde nuestra portería y la anchura entre ellos. Borde verde en casa, naranja fuera; la marca «Filial» en los partidos contra filiales. Arriba, dos tarjetas: la media en casa y la media fuera (y cuánto cambia), y una frase si contra filiales se toca más arriba o más abajo. Sale de opta:castilla-eventos (sólo las acciones del Castilla); el puesto, de la plantilla (pestaña JUGADORES con las correcciones de lib/posiciones.ts); casa o fuera, del calendario de BeSoccer por la fecha",
            cuenta: "Toque = acción del Castilla con jugador y coordenadas, sin faltas, tarjetas ni errores. Central = el puesto de la plantilla es «Central»; el nombre de Opta se cruza por apellido. Sólo cuenta el central con 10 toques o más en el partido. Altura = media de las x medias de los centrales × 1,05 (campo de 105 m); anchura = diferencia de la y media entre el más abierto a cada lado × 0,68 (68 m). Las medias de casa y fuera pesan cada partido igual; el partido que no está en el calendario no entra. Filial = rival que acaba en B, C o II, o Atlético Madrileño, Bilbao Athletic, Barcelona Atlètic, Promesas, Sanse",
          },
          { que: "Contra la liga · Visual o Detalle (16/11/2026)", es: "Se abre en «Visual»: las conclusiones, los gráficos de la fase, el cara a cara si hay otro equipo elegido y «Lo mejor y lo peor del Castilla»: las 4 métricas de la fase con percentil más alto y las 4 más bajas en barras (a la derecha, mejor), con la conclusión en el título. «Detalle» añade la lista entera métrica a métrica, como siempre; se recuerda en este aparato", cuenta: "Sólo métricas de rendimiento (las de estilo no tienen mejor ni peor) y con 10 casos o más. «Por encima» = P60 o más; «por debajo» = P40 o menos" },
          { que: "Contra la liga", es: "Dos lecturas: lo esencial por fase (puesto y percentil en el grupo, y partido a partido contra su media) y métrica a métrica contra los 20 equipos" },
          { que: "Nuestra historia", es: "Dos lecturas: temporada a temporada y jornada a jornada contra nuestros rivales y la media" },
          { que: "Nuestros remates", es: "El mapa de remates del Castilla, a favor y en contra; en cada mapa, «Sólo goles», el partido y, al pinchar, «Ver el resumen (YouTube)» —el resumen oficial de la RFEF de ese partido, donde sale el gol; sin segundo exacto, que esos resúmenes no traen— «Ver en Opta» —abre ese remate exacto en el Event Log de ProVision con su vídeo (8 s antes y después), con la sesión de Opta abierta— y «Ver en Wyscout» (abre la plataforma y copia partido y minuto: Wyscout no deja enlazar el clip)" },
          { que: "Jugador a jugador", es: "Dos lecturas: dentro de la plantilla y por 90′ contra los de su puesto en la categoría (al pinchar uno, su ficha)" },
          { que: "Ficha de un jugador de Opta: radiografía (18/11/2026)", es: "Sus métricas del puesto se ven como radiografía de percentiles (la de Área de mejora, en oro): con balón a la derecha, sin balón a la izquierda; en el móvil, la versión compacta con leyenda. El selector del gráfico vuelve a las barras con su puesto (3º/40)", cuenta: "Percentil contra los de su familia de puesto en el ámbito elegido (categoría, su grupo, el otro) con el mínimo de minutos; las de menos es mejor llevan ↓ y van dadas la vuelta. Las de estilo (más no es mejor) no entran en la radiografía, sólo en las barras. Sin balón: intercepciones, despejes, recuperaciones, robos arriba, duelos, aéreos, entradas, faltas y, en porteros, paradas y goles encajados" },
          { que: "Buscador de la categoría", es: "Jugadores de la categoría por puesto, edad, minutos y una métrica por 90" },
          { que: "Talento y goles que valen", es: "Dispersión de percentiles con la zona élite, ranking por perfil, goles que dan puntos y goles desde el banquillo" },
          { que: "Radiografía y comparativa (Talento)", es: "Bajo el nombre, su lectura en una línea (dónde destaca y dónde flojea) y al abrir «Comparar con otro jugador», «Contra» propone al próximo rival y, de él, el de la misma familia de puesto con más minutos (su par directo); al comparar dos, la mayor distancia entre ellos («clips de X para la charla de Y»); «Para la tarea»: su percentil más bajo (P35 o menos) traducido a un comportamiento del campo con criterio de éxito (p. ej. «cambio de orientación largo al lado débil; éxito: 3 de 5 que llegan») y el segundo más bajo al lado. Segunda lectura de Talento: la «pizza» de 18 métricas por 90′ del puesto de un jugador, con el valor grande y su percentil (P##) en cada una, y la nota de perfil arriba. Se elige equipo y jugador y el mínimo de minutos del universo (270, 450 o 900). «Comparar con otro jugador» pone el segundo en azul encima de la pizza, sus cifras al lado de cada métrica y cuántas gana cada uno. Abajo, el universo de comparación: misma familia de puesto, los dos grupos, con cuántos comparables", cuenta: "lib/opta-radiografia-jugador.ts sobre opta:jugadores: valor por 90′ (los porcentajes, tal cual); percentil = comparables por debajo + la mitad de los empates, al revés en «menos es mejor»; sólo con 5 valores o más y, en porcentajes, con intentos suficientes (BASE_TASA); nota = media de percentiles. El segundo jugador se mide con las métricas y el universo del primero. Sin foto (Opta no la da): iniciales y escudo. Idea: F. Sosa (The Eye Intelligence Unit)" },
          { que: "Un equipo de un vistazo", es: "Tres lecturas de cualquier equipo: de un vistazo, jornada a jornada y sus remates; abre con el próximo rival" },
          {
            que: "Clasificación justa",
            es: "Al pie de «De un vistazo»: la clasificación real del grupo del Castilla (puntos) a la izquierda y la de puntos esperados (xPts) a la derecha, unidas por una curva por equipo como el gráfico original de X (16/11/2026): naranja si va más arriba de lo que merece, verde si merece estar más arriba y gris si se mueve un puesto o nada. En la real, en el ordenador, la flecha dice cuánto merece de más (▲) o tiene de más (▼). El Castilla en oro y el próximo rival (calendario de BeSoccer) en azul. Selector «hasta la jornada N»",
            cuenta:
              "Opta, opta:partidos (equipo × partido), sólo partidos entre equipos del grupo con xG de los dos. En cada partido, los goles de cada equipo son un Poisson independiente con media su ExpG (el del rival, ExpGAg o su ExpG): xPts = 3 × P(ganar) + P(empatar), sumados por equipo. Los puntos reales, del marcador de esa misma fila. «Jornada N» = los N primeros partidos de cada equipo por fecha. Desempates: real por puntos, diferencia de goles y goles; justa por xPts y diferencia de xG. Diferencias de menos de 1,5 puntos no llevan flecha",
          },
          { que: "Todos contra todos", es: "Dos lecturas: la tabla de toda la liga con las columnas que se elijan (y el cruce de dos) y una métrica ordenada" },
          { que: "Estilos de juego", es: "Quién aprieta y cuándo en toda la liga, el Venn de dominio, peligro y solidez y la radiografía de 22 métricas de cualquier equipo" },
          { que: "Huella táctica (Estilos)", es: "El titular dice dónde está el Castilla; el próximo rival (calendario de BeSoccer) va con recuadro blanco y con su línea en el subtítulo: dónde toca más que la media (la celda con más diferencia), quién toca ahí en su equipo y qué hacemos con eso. Rojo = toca más ahí que la media, no «mejor». Segunda lectura de Estilos: un mini-campo por equipo del grupo (ataca hacia arriba) con dónde toca más (rojo) y menos (azul) balón que el equipo medio del grupo, todos con la misma escala, ordenados por % de toques en campo rival con su diferencia y nº de toques; en el centro, la media de la liga con su mapa de calor normal. El Castilla, con borde oro. Pinchar un equipo lo agranda al lado de la media con una frase de dónde toca más y menos. Botón para el otro grupo", cuenta: "scripts/opta-huella.mjs (cada lunes tras la descarga de Opta, y a mano) lee el evento a evento de todos los partidos acabados guardados en opta:directo:<partido> y deja opta:huella: toques por celda (30 × 20) de cada equipo, con la x de Opta atacando hacia 100. Toque = la regla del directo (sin faltas, córners concedidos, regateado ni entrada fallida). En pantalla: suavizado ≈ 5 m, reparto (suma 1) y resta de la media del grupo; grupos = quién juega con quién. Idea: F. Sosa (The Eye Intelligence Unit)" },
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
      "En «Entrenamiento y partido», «El trabajo individual» cruza los seguimientos con los minutos de los jugadores de campo: los porteros no entran, llevan un registro independiente (16/11/2026).",
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
      "Con pocos partidos jugados, un puesto en la tabla se mueve mucho por un solo resultado.",
      "Una cifra por 90 de alguien con pocos minutos es una tendencia, no un retrato: por eso el mínimo.",
      "El directo depende de que Opta publique durante el juego; si sólo publica al acabar, las cifras llegan al final.",
      "Con 2 o 3 jornadas todo son indicios, no tendencias.",
      "El balón parado propio lo registramos nosotros: no sale de Wyscout ni de Opta, y no hay liga con la que compararlo.",
      "En el percentil del jugador no entran los que no llegan a 90 minutos.",
      "Si una pantalla enseña la jornada pasada, lo que falta es publicar: bajar los datos no los sube.",
      "Si los datos se quedan atrás varias semanas, mira .cache/wyscout: casi siempre es que hay que volver a entrar en Wyscout una vez.",
    ],
    revisada: "2026-11-21",
  },

  /* ==================== MICROCICLOS ==================== */
  {
    ruta: "/microcycles",
    titulo: "Microciclos",
    resumen: "Cada tarea de cada sesión, con su contenido, su carga y su valoración, micro a micro.",
    origen: "Hoja de microciclos, una fila por tarea (la escribe el cuerpo técnico). Los equipos del día, de Jugadores sesión; lo medido en la sesión, del análisis de entrenamiento. El micro de hoy y el MD de cada día, de la regla común de las cuatro pantallas de planificación (lib/microciclo/semana-de-hoy.ts).",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "La tira de microciclos",
        filas: [
          { que: "Colores de las fases", es: "Los mismos que el Calendario de microciclo: Ofensiva verde, Defensiva roja, transiciones azul y naranja, ABP morado, Global amarillo; «Otras» se parte por fase con su leyenda" },
          { que: "Fase que falta", es: "El titular añade cuántas tareas de esa fase tiene de media un micro de la temporada y sobre cuántos micros" },
          { que: "Notas", es: "Las notas de las tareas, siempre con un decimal (7,0), también Mejor, Peor y Último" },
          { que: "Micro N · rival", es: "Una tarjeta por semana, la última primero; pulsarla filtra la pantalla entera. «Todos» = la temporada. El degradado de la derecha avisa de que hay más tarjetas" },
          {
            que: "Abre en el micro de hoy",
            es: "El mismo que abren los dos calendarios y Jugadores sesión",
            cuenta: "El que tiene hoy entre su primera y su última fecha; entre dos (el libre tras el partido), el siguiente si ya está planificado y empieza en 7 días o menos",
          },
          { que: "Val. 6,8", es: "Valoración media de sus tareas de entreno; en gris y con «· 5 de 13» si es provisional" },
          { que: "La barra", es: "Su carga física frente al micro que más carga tiene" },
          { que: "Editar este micro", es: "Lo abre en el editor de microciclos (mover tareas, copiar días, sacar la lámina)" },
          { que: "Informe del partido", es: "Previa o post del partido de ese micro: resumen en tres diapositivas e informe completo, por correo" },
          { que: "Post del M21 · rival", es: "Junto a «Informe del partido»: elige el micro anterior y abre su informe post, que es lo que corrige la semana" },
        ],
      },
      {
        titulo: "Las cifras de cabecera",
        filas: [
          { que: "Tareas de entreno", es: "Una sola cifra, la de entreno (la misma de la cabecera); debajo, «13 de entreno + 1 partido · 4 entrenos»", cuenta: "El partido es la fila de competición del día MD y no cuenta como tarea. La diferencia con el micro anterior también es sólo de entreno" },
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
          { que: "Resumen", es: "Primero la carga por día MD (la orden de la semana, con la media de la temporada de cada MD); debajo, dos tarjetas con la lectura que más pesa (el verbo en el titular: «Lunes: no hicimos el Juego de Posesión previsto») y el resto de lecturas plegado; luego el perfil del micro, la tendencia de la valoración, el reparto por fase y la semana en sesión tarea a tarea" },
          { que: "Lecturas del periodo", es: "Dos tarjetas con titular y su detalle, las de más peso; las demás, plegadas en «N lecturas más». Una por día con tareas del plan que no se hicieron («Lunes: no hicimos el Juego de Posesión previsto»); la del mejor y el peor tipo de tarea sólo sale con 5 tareas valoradas o más de ese tipo", cuenta: "Con menos base no es una lectura y no se enseña" },
          {
            que: "La semana en sesión",
            es: "Cada día del micro elegido con TODAS sus tareas (nombre, formato, minutos y contenido), también las sólo planificadas; «Equipos hechos» y «Analizado» si ya los hay, y una sola acción: la que toca (hacer los equipos, analizar o ver el análisis)",
          },
          { que: "Perfil del microciclo", es: "Los ejes con dato de 0 a 10; en barras (una fila de tres), cada una con la marca y el valor de la media de la temporada («media 7,4 en 21 micros»). Con menos de 5 micros con dato en ese eje, «tendencia · 3 micros», sin marca y con la barra atenuada y rayada (no se lee como fortaleza). Con carga medida, la carga física por entreno frente a la media de la temporada", cuenta: "Media por eje de los demás micros con ese dato (3 o más; firme con 5 o más). Carga: UA de los días hechos ÷ esos días (como /micro_calendar)" },
          { que: "Tendencia de evaluación", es: "Valoración media de cada micro, eje de 5 a 10; el micro en curso sin valorar no entra. Debajo, el mejor, el peor y el último micro valorados, con su rival. Mide lo mismo que el anillo de al lado", cuenta: "La línea se corta en los micros ya pasados sin tareas valoradas, y el subtítulo dice cuáles" },
          { que: "Titular del micro en curso", es: "Con el partido por jugar: «Micro 22 · MD-4 · J13 vs Murcia · vie 20/11, 21:15» y, debajo, las tareas", cuenta: "El partido es el primero del calendario de BeSoccer desde el último día con tareas; el MD, el de hoy con la regla común. Mientras no se juega, no sale «tareas sin evaluación»" },
          { que: "Nombre del rival", es: "El mismo en tarjetas, chapa y desplegable: nombre corto con mayúscula inicial («Hércules», «R.Ferrol»)" },
          { que: "Accesos del rival", es: "En azul, bajo el titular: Plan de partido, Su ABP, Sus goles en vídeo (en el pop-up de la portada, 18/11/2026; al lado, «Cómo son sus goles ›» lleva a Análisis de goles) y Su plantilla, con el rival del micro ya elegido", cuenta: "El Plan abre por el ID de la hoja RIVALES, buscado por la fecha del último día del micro; los demás, por el nombre del equipo" },
          { que: "Reparto por fase de juego", es: "El título dice la conclusión («Sin organización defensiva esta semana: 0 de 15»); el subtítulo, la base real: «Fuera de Global (11 de 15), 4 tareas: ABP 2, Ofensiva 1…». Con 6 tareas con fase o más, anillo; con menos, barras horizontales con su cifra. Pulsar un tramo o una fila filtra", cuenta: "«Global» va aparte: está en casi todas y tapaba lo demás. Una tarea con dos fases cuenta media en cada una. «ABP» y «ABP Defensivo» cuentan como ABP, con su lado debajo. Las fases con una tarea o menos sólo se juntan en «Otras» si hay alguna fase mayor al lado" },
          { que: "Perfil: barra rayada", es: "Con menos de 5 micros con dato para comparar, la barra va rayada y dice «tendencia · 3 de 21 micros con dato»; la leyenda del rayado va debajo" },
          { que: "Diapositivas del día", es: "En «La semana en sesión», el día con equipos hechos lleva «Diapositivas del día»: abre Jugadores sesión en ese día y en su pestaña de diapositivas" },
          { que: "Carga por día frente a su media", es: "Con carga medida, va primero: barras de carga física y cognitiva por día, intensidad y, en discontinuo, la media de la temporada de cada MD. El título es la orden: «MD-1 va un 22 % por encima de su media: bajar volumen si no se busca»", cuenta: "Media de un MD = carga de ese día en los demás micros con carga (3 o más). Se nombra el MD que más se aparta, si es un 15 % o más" },
          { que: "Cargas", es: "Mapa de calor micro × día (pulsar filtra), carga acumulada por micro, física frente a cognitiva por tarea, tiempo por día e intensidad" },
          { que: "Contenidos", es: "Contenido principal y secundario (los 15 primeros), tabla comparativa, valoración por tipo de tarea y los 12 formatos más usados" },
          { que: "Cognitivo", es: "Normativa, incertidumbre, dificultad y motivación llevadas a 0-10; su evolución por día, demanda frente a valoración y análisis post-tarea" },
          { que: "Tareas", es: "Las 5 mejor valoradas, las 5 a revisar y la tabla entera, que se ordena por columna y sale en «Exportar CSV»" },
        ],
      },
      {
        titulo: "Cómo se ordena",
        filas: [
          { que: "MD-5 … MD", es: "Días contando hacia atrás desde el partido. MD es el día de partido", cuenta: "En «La semana en sesión», con el calendario de BeSoccer: días que faltan para el próximo partido, hasta 14 (igual que el creador de micros y los calendarios)" },
          { que: "Filtros", es: "A la vista sólo el microciclo y el botón «Filtros (n)»; dentro, día (MD), tipo de tarea, contenido principal, fase, valoración mínima, buscador y «Cifras sin el partido / con el partido». Lo filtrado sale en píldoras aunque estén plegados. El micro y el día quedan en la dirección (?micro=22&md=MD-3)" },
          { que: "No se hizo", es: "Tarea del plan que no se hizo en la sesión de Jugadores sesión de ese día: sale en su sitio, tachada" },
          { que: "Ver sus clips", es: "En cada tarea que midió el análisis de entrenamiento: abre ese día del análisis, con sus clips" },
          { que: "Formato", es: "8v8+3 = ocho contra ocho más tres comodines" },
        ],
      },
    ],
    ojo: [
      "«Cifras sin el partido» (por defecto) quita el partido de los gráficos de método: un partido de 90 minutos tapa el reparto de la semana. Las tarjetas de cabecera sí lo cuentan.",
      "Un micro sin minutos ni intensidad no enseña tiempo ni carga: sólo tareas y valoración.",
    ],
  },

  /* ==================== BALÓN PARADO ==================== */
  {
    ruta: "/setpieces",
    titulo: "ABP Ofensivo",
    resumen: "Córners y faltas a favor, acción por acción: qué se lanza, dónde cae, quién remata y cuánto peligro deja.",
    origen: "Nuestra hoja de ABP ofensivo, una fila por acción, registrada a mano. El corte de cada acción, de Hudl (doc «abp:cortes»); la categoría, de Opta. Respaldo de Opta (17/11/2026): la jornada que la hoja aún no tiene sale de Opta (opta:abp-eventos + opta:remates + el evento a evento opta:directo, por /api/opta/respaldo) con el sello «Desde Opta · aún sin etiquetar en Hudl»; en cuanto la hoja tiene una fila de esa jornada, manda la hoja. De Opta salen sacador, tipo, dónde cae (primer palo, penalti, segundo palo, 6 m, fuera), remate, rematador, xG y desenlace (gol, ocasión, ABP, transición); no salen altura del envío, calidad, defensa, rutina ni segundo balón. «▶ Vídeo»: el corte de Opta (opta:acciones-video) o, si aún no está bajado, «Vídeo en Opta» abre ProVision en ese segundo; las acciones de la hoja sin corte propio lo ganan si casan por minuto (±1) con un saque de Opta del mismo partido, parte y tipo.",
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Las tarjetas",
        filas: [
          { que: "Próximo rival", es: "La tarjeta azul «Próximo rival · J13 · vie 20/11» sale del calendario de BeSoccer por la FECHA, no por si el partido tiene marcador: es el primer partido nuestro cuya hora (de Madrid, la que da BeSoccer) no ha pasado, con dos horas y media de gracia para el que se está jugando. Es la misma regla que la portada (alrededorDe, lib/castilla/calendario.ts). Antes, con una copia del calendario guardada en el aparato antes de que BeSoccer apuntara el resultado, el ya jugado seguía saliendo como próximo. Vale igual en ABP defensivo y en los dos saques de banda." },
          { que: "Nombre del rival", es: "El rival se escribe siempre con su nombre corto (Hércules, Murcia, Nàstic, Sant Andreu): en las dos tarjetas de arriba, en los chips de rivales, en la lista «Acción a acción», en el enlace «Los goles que encaja…» y en la comparativa del partido. Sale de nombreCorto (lib/abp/informe-graficos.ts), la misma tabla que el informe." },
          { que: "¿Dónde cae?", es: "El rótulo «6M / PENALTI» va debajo del punto de penalti, para que el punto no lo tape, y todos los rótulos de zona llevan un halo del color de su zona." },
          { que: "Gol u ocasión, partido a partido", es: "Cada columna es el % de las acciones de ese partido que acaban en gol u ocasión; encima lleva su «a/b» (las que acaban en gol u ocasión de las del partido). La raya discontinua va en la misma unidad: la media de todas las acciones juntas, p. ej. «27 % (25 de 94 acciones)». Con la temporada a la vista y sin rival elegido, los partidos de la hoja que con los filtros puestos (sacador, tipo…) se quedan sin acciones salen rotulados «sin acc.» en vez de desaparecer." },
          { que: "¿Va a mejor?", es: "La raya discontinua de este gráfico es la media de acciones por partido (la altura de cada columna es su número de acciones), no un porcentaje." },
          { que: "¿Qué hace más daño?", es: "Los tipos con menos de 10 acciones salen atenuados, con una línea que lo dice: con tan poca muestra, su «a/b» no se lee solo." },
          { que: "¿Cómo acaban? con su base", es: "El título de la barra lleva el número de acciones que cuenta (p. ej. «la temporada · 94 acciones»). Un tramo demasiado estrecho para verse (el gol, 1 de 94) lleva su rótulo encima de la barra. Sale de la hoja de ABP ofensivo con los filtros de arriba." },
          { que: "Conclusión plegada", es: "A la vista quedan el titular (la decisión, con su base) y «Qué entrenamos». Todas las demás lecturas (el recuento, la rutina que más rinde, el sacador, el segundo balón…) van tras un solo botón «N lecturas más»." },
          { que: "Qué entrenamos", es: "Dice la tarea, no lo que falla: p. ej. «tarea de rutina para el envío directo, partiendo de la que mejor rinde (bloqueo en corta…: 2 de 4, tendencia)». Qué se cuenta: en cada serie, los envíos que acaban en gol u ocasión. Objetivo: la media de las jornadas anteriores o, si no la hay, lo que da el resto de nuestro balón parado con su base (34 %, 21 de 62)." },
          { que: "Gol u ocasión, partido a partido", es: "Bajo la conclusión, una columna por partido con el % de acciones que acaban en gol u ocasión; la raya discontinua es la media (todas las acciones juntas, con su «a de b») y el último partido va en oro. Sale con 3 partidos o más y se lee como tendencia: cada columna es un partido corto. El detalle sigue en «¿Va a mejor?»." },
          { que: "Tarjeta Goles", es: "En Visual lleva la misma base que la barra (de las acciones) y la marca de tendencia; ya no añade una segunda base de remates." },
          { que: "¿Dónde cae? abre en Envíos recibidos", es: "El mapa abre en la capa «Envíos recibidos», la misma de la que habla el titular («Primer palo concentra 18 de las 53…»); las demás capas siguen en sus botones. En modo día el césped es claro y el campo va recortado al área, sin la franja oscura." },
          { que: "Acción a acción: enlaces", es: "El sacador y el rematador van en oro y abren su ficha en Individual. Debajo, «Los goles que encaja …» abre Análisis de goles con los goles en contra del rival de ese partido." },
          { que: "Atajos del rival", es: "En la tarjeta del próximo rival su balón parado se llama «Su ABP» (como en la del partido) y va primero; «Nuestro ABP defensivo» ya no se repite si está en la tarjeta del partido. «Su ABP» abre con ?equipo= y el plan con ?rival=ID cuando la hoja RIVALES lo tiene." },
          { que: "Córners en Opta", es: "En «¿Y frente a la categoría?» una línea explica por qué «Remates de córner» (todos los remates de la jugada, rechaces y segunda jugada incluidos, unos 19 en 12 partidos) es mayor que «Córners que acaban en remate» (córners con al menos un remate en la primera jugada, 5 de 58)." },
          { que: "Conclusión con la decisión", es: "Si la tarea sale de lo que falla, el titular abre con la decisión y su base («Balón directo sin rutina: 4 de 31 en gol u ocasión (13 %) frente a 21 de 62 (34 %) en el resto → montar una rutina») y «Qué entrenamos» sólo da el objetivo. Con menos de 15 acciones, una rutina sale como «Tendencia (pocas acciones)». «En la temporada» o «En esta jornada» según el filtro" },
          { que: "Goles esperados", es: "Sin «xG»: «Goles esperados» y «… por envío»; totales a un decimal, lo que es por acción o por envío con dos" },
          { que: "Conclusión", es: "Una zona con menos de 10 casos se dice «Tendencia» y va detrás de lo que tiene muestra. Sin rutina, la tarea es montar una rutina para el balón directo" },
          { que: "Botón de PDF y jugadores (18/11/2026)", es: "En el móvil, el botón redondo de PDF va abajo, encima del ⋮ (arriba tapaba las pestañas). Los jugadores no ven los atajos a la pizarra, el microciclo ni el plan de partido" },
          { que: "Acciones lanzadas", es: "Córners y faltas a favor con los filtros puestos", cuenta: "Debajo, la temporada: total, jornadas y por partido" },
          { que: "Sin remate", es: "Si ninguna acción acaba en remate ni en ocasión, una sola tarjeta «5 de 5» sustituye a goles esperados, remates y gol u ocasión", cuenta: "Debajo, la temporada con su población: remates y gol u ocasión sobre todas sus acciones" },
          { ...XG, que: "Goles esperados", es: "Lo que valían las acciones, entraran o no" },
          { que: "Remates", es: "Acciones con remate (todo menos «No Remate» y «No aplica»)" },
          { que: "Goles", es: "Sólo los nuestros, con su base («0 de 5 acciones»); pulsar filtra las acciones de gol", cuenta: "Debajo, los de la temporada y en cuántas acciones" },
          { que: "Conversión", es: "Goles ÷ remates", cuenta: "Sólo sale con 5 remates o más" },
          { que: "Goles esperados por ABP", es: "Peligro medio de cada lanzamiento", cuenta: "Goles esperados ÷ acciones. Sólo con 15 acciones o más" },
          { que: "Gol u ocasión", es: "Acciones cuyo resultado final es Gol u Ocasión", cuenta: "Gol u ocasión ÷ acciones" },
          { que: "En Visual (17/11/2026)", es: "Remates, conversión, gol u ocasión y goles esperados por ABP no se repiten en tarjetas: van con la barra de la conclusión («Gol u ocasión: 30 de 96 (31,3 %) · con remate, 24») y la conversión en la tarjeta de goles. En «Detalle» siguen todas" },
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
          { que: "Se abre en la temporada (17/11/2026)", es: "La página abre con toda la temporada (sin pretemporada) y el último partido de la hoja va marcado: su columna en oro en «¿Va a mejor?», su «Acción a acción» con su vídeo, «¿Es lo de siempre?» y la ficha «El último partido» de arriba. «Ver toda la página sólo con …» deja sólo esa jornada", cuenta: "Con 5-7 acciones de un partido el campo salía casi vacío; la jornada sigue en el filtro" },
          { que: "Conclusión (Visual)", es: "Primero la barra de cómo acaban, después el titular con el dato y «Qué entrenamos»; el resto de lecturas, plegadas tras un botón. Con menos de 15 acciones lleva la marca «tendencia»" },
          { que: "Ronda 20 (17/11/2026)", es: "«¿Dónde cae?» cuenta con la regla del mapa: «de las 53 que caen en el área (43 fuera de las cuatro zonas)», la misma base que la barra bajo el campo. «¿Va a mejor?» pone siempre «a/b» encima de cada columna, una raya discontinua con la media por partido y dice si la diferencia de los 3 últimos pasa lo que varía de un partido a otro (si no, «tendencia … dentro de lo que varía»). «¿Qué hace más daño?» sólo elige un tipo con 15 acciones o más (si no, «tendencia») y junta en «otras» los tipos de 1 o 2. «Qué entrenamos» va en %: «Hoy 15 de 58 acaban en gol u ocasión (26 %); el resto, 15 de 38 (39 %) → objetivo 39 %», o la media de las jornadas anteriores. A la vista, dos lecturas; el resto plegado. «Acción a acción» dice si el vídeo es de Hudl o de Opta, pone «directa a puerta» en faltas directas y penaltis y no enseña «Cae en» si ninguna acción la tiene. Las pastillas de rivales van por calendario y con el nombre bien escrito", cuenta: "Con menos de 5 goles, la tarjeta de goles (y la conversión) llevan «tendencia» aunque la base sea larga" },
          { que: "Fuera de las cuatro zonas del área", es: "En corto, directa a barrera y sin zona apuntada van en una barra aparte, bajo el campo, con su número y su % sobre todas las acciones; «Ocupación vs. peligro» se calcula sólo con las cuatro zonas y dice su base", cuenta: "Cifras con coma decimal" },
          { que: "Goles: hoja frente a Opta", es: "Si los goles a balón parado de la hoja (liga, jornadas etiquetadas) no coinciden con los de Opta, una línea en «¿Y frente a la categoría?» dice cuántos cuenta cada una y por qué no cuadran: la hoja es el etiquetado del cuerpo técnico (con la segunda jugada) y Opta aplica su regla de jugada a balón parado y no cuenta penaltis. En la charla, la de la hoja" },
          { que: "Opta: orden y tendencia", es: "Las cifras de Opta van de mejor a peor puesto; un total de temporada de 0 a 3 (goles) lleva «tendencia, pocos casos» y no entra en «Lo mejor» ni «Lo peor». «Detalle en el Laboratorio» sólo sale al administrador" },
          { que: "Lo relacionado (arriba)", es: "Dos fichas a un toque: el rival del partido que se mira (oro) —sus goles en vídeo (en el pop-up de la portada, 18/11/2026), su ABP, el plan de aquel partido y la pantalla hermana— y el próximo rival (azul) —su ABP, sus goles en vídeo, la pizarra de ABP, el microciclo y el plan—, con el rival ya elegido. Si el último partido jugado aún no está en la hoja, lo dice", cuenta: "Próximo y último partido, del calendario de BeSoccer; la llave del plan y la pizarra, de la hoja RIVALES; el ABP del rival y los goles, por nombre" },
          { que: "¿Es lo de siempre? (Visual)", es: "Este partido frente a la media, en barras: el punto es el partido (verde mejor, naranja peor; hueco si es tendencia), la raya la media y la franja del partido más bajo al más alto de los anteriores; el título dice en qué va mejor y en qué peor", cuenta: "El mismo juicio que la tabla de «Detalle»: «igual» a menos de 2 puntos o del 5 %; con menos de 15 acciones, tendencia" },
          { que: "Visual · Detalle (16/11/2026)", es: "La pantalla se abre en «Visual»: las conclusiones y, cada una con su conclusión en el título, primero dónde cae (el mapa de zonas del área; si alguna acción no tiene zona, se dice cuántas), debajo «Acción a acción» con su vídeo y el sacador y el rematador enlazados a su ficha, «¿Es lo de siempre?», cómo acaban (barra apilada: gol, ocasión, remate sin ocasión, sin remate), jornada a jornada (una columna apilada por partido, en orden de calendario, y si los 3 últimos van a mejor que los anteriores), qué tipo de acción rinde más (en el defensivo, cuál nos hace más daño; con 3 acciones o más) y la categoría (Opta). «Detalle» son las pestañas de siempre; el PDF las saca todas. Se recuerda en este aparato", cuenta: "Mismos filtros que arriba; «gol u ocasión» = Resultado_Final Gol u Ocasión. Con 4 partidos o más, los 3 últimos contra los anteriores (a menos de 5 puntos, «se mantiene»)" },
          { que: "Resumen", es: "Conclusiones (cierran con «Qué entrenamos»: el envío más repetido, qué se cuenta y el objetivo de remate de la media de las jornadas anteriores), lectura rápida, este partido frente a la media de las jornadas anteriores, cómo se reparte el envío y «Acción a acción»" },
          { que: "Este partido frente a los anteriores", es: "Cada cifra del partido contra la media por partido de las jornadas anteriores y su rango", cuenta: "Con menos de 15 acciones la fila es «indicio»: gris, sin «mejor» ni «peor». El número de acciones no se juzga. Un rango de 0 % a 100 % no se pinta" },
          { que: "Acción a acción", es: "Todas las acciones del partido (hasta 15 sin plegar; también en «Visual», bajo el campo), el sacador y el rematador enlazados a su ficha individual, con columnas fijas de minuto, acción, zona de caída y desenlace, «Ver la acción» (nuestro corte) y «Abrir en Hudl» en su segundo", cuenta: "Con más de 15 se pliega, pero lo que acaba en gol o remate va arriba. Debajo, qué es un remate forzado o limpio y el rechace" },
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
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
      "Por defecto va sin pretemporada: los amistosos de julio son contra equipos de otra categoría; se incluyen a propósito desde el filtro de competición.",
      "Por defecto se ven todas las jornadas de liga: la comparativa del partido, la acción a acción y la columna en oro son de la última; el resto de la página suma todos los partidos.",
    ],
  },
  {
    ruta: "/setpieces_def",
    titulo: "ABP Defensivo",
    resumen: "Córners y faltas en contra, acción por acción: dónde nos atacan, quién nos hace daño y cuánto conceden.",
    origen: "Nuestra hoja de ABP defensivo, una fila por acción del rival. El corte de cada acción, de Hudl (doc «abp:cortes»); la categoría, de Opta. Respaldo de Opta (17/11/2026): la jornada que la hoja aún no tiene sale de Opta (opta:abp-eventos + opta:remates + el evento a evento opta:directo, por /api/opta/respaldo) con el sello «Desde Opta · aún sin etiquetar en Hudl»; en cuanto la hoja tiene una fila de esa jornada, manda la hoja. De Opta salen sacador, tipo, dónde cae (primer palo, penalti, segundo palo, 6 m, fuera), remate, rematador, xG y desenlace (gol, ocasión, ABP, transición); no salen altura del envío, calidad, defensa, rutina ni segundo balón. «▶ Vídeo»: el corte de Opta (opta:acciones-video) o, si aún no está bajado, «Vídeo en Opta» abre ProVision en ese segundo; las acciones de la hoja sin corte propio lo ganan si casan por minuto (±1) con un saque de Opta del mismo partido, parte y tipo.",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Las tarjetas",
        filas: [
          { que: "Objetivo con sus dos cifras", es: "El objetivo da la temporada y el último partido con su base («en la temporada 30,1 % (28 de 93); en la J12, 45,5 % (5 de 11)»)" },
          { que: "Segundo balón", es: "Si el último partido queda más de 10 puntos por debajo de la media de los anteriores, la lectura lo cita primero, con su base y «tendencia» si son menos de 15" },
          { que: "Goles esperados", es: "«Goles esperados concedidos», a un decimal" },
          { que: "Qué entrenamos", es: "Con la temporada entera, el objetivo de remates es el de los buenos partidos: «como mucho X % (lo logramos en a de N partidos)»" },
          { que: "Ocupación frente a peligro", es: "Cuenta remates, no acciones: una acción puede tener dos (el rechace), por eso no coincide con las acciones con remate" },
          { que: "Botón de PDF y jugadores (18/11/2026)", es: "En el móvil, el botón redondo de PDF va abajo, encima del ⋮ (arriba tapaba las pestañas). Los jugadores no ven los atajos a la pizarra, el microciclo ni el plan de partido" },
          { que: "Acciones rivales con remate", es: "ABP del rival que acaban en remate, en % · menos es mejor", cuenta: "Acciones con remate ÷ acciones. En la tabla, «Remates concedidos» es el número" },
          { que: "Gol u ocasión", es: "ABP del rival que acaban en «Gol Rival» u «Ocasión»", cuenta: "Ojo: en esta hoja el sujeto de «Ocasión» es el rival, no nosotros" },
          { ...XG, que: "Goles esperados concedidos", es: "Lo que valían los remates del rival en su ABP (la calidad de sus remates, sumada), con su base · menos es mejor" },
          { que: "Goles encajados de ABP", es: "Los «Gol Rival», con su base («1 de 7 acciones») · menos es mejor; pulsar filtra esas acciones" },
          { que: "Media de las N jornadas anteriores", es: "Con una jornada elegida, debajo de cada tarjeta: la misma cifra en los partidos de antes" },
          { que: "Qué entrenamos con gol encajado (17/11/2026)", es: "Dice la jornada, el rival y el minuto del gol («J07 · Rival · 11′») y, con más de un gol, «3 goles en 92 acciones, 3,3 %»" },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Se abre en la temporada (17/11/2026)", es: "La página abre con toda la temporada (sin pretemporada) y el último partido de la hoja va marcado: su columna en oro en «¿Va a mejor?», su «Acción a acción» con su vídeo, «¿Es lo de siempre?» y la ficha «El último partido» de arriba. «Ver toda la página sólo con …» deja sólo esa jornada", cuenta: "Con 5-7 acciones de un partido el campo salía casi vacío; la jornada sigue en el filtro" },
          { que: "Conclusión (Visual)", es: "Primero la barra de cómo acaban, después el titular con el dato y «Qué entrenamos»; el resto de lecturas, plegadas tras un botón. Con menos de 15 acciones lleva la marca «tendencia»" },
          { que: "Ronda 20 (17/11/2026)", es: "«¿Dónde cae?» cuenta con la regla del mapa: «de las 53 que caen en el área (43 fuera de las cuatro zonas)», la misma base que la barra bajo el campo. «¿Va a mejor?» pone siempre «a/b» encima de cada columna, una raya discontinua con la media por partido y dice si la diferencia de los 3 últimos pasa lo que varía de un partido a otro (si no, «tendencia … dentro de lo que varía»). «¿Qué hace más daño?» sólo elige un tipo con 15 acciones o más (si no, «tendencia») y junta en «otras» los tipos de 1 o 2. «Qué entrenamos» va en %: «Hoy 15 de 58 acaban en gol u ocasión (26 %); el resto, 15 de 38 (39 %) → objetivo 39 %», o la media de las jornadas anteriores. A la vista, dos lecturas; el resto plegado. «Acción a acción» dice si el vídeo es de Hudl o de Opta, pone «directa a puerta» en faltas directas y penaltis y no enseña «Cae en» si ninguna acción la tiene. Las pastillas de rivales van por calendario y con el nombre bien escrito", cuenta: "Con menos de 5 goles, la tarjeta de goles (y la conversión) llevan «tendencia» aunque la base sea larga" },
          { que: "Fuera de las cuatro zonas del área", es: "En corto, directa a barrera y sin zona apuntada van en una barra aparte, bajo el campo, con su número y su % sobre todas las acciones; «Ocupación vs. peligro» se calcula sólo con las cuatro zonas y dice su base", cuenta: "Cifras con coma decimal" },
          { que: "Goles: hoja frente a Opta", es: "Si los goles a balón parado de la hoja (liga, jornadas etiquetadas) no coinciden con los de Opta, una línea en «¿Y frente a la categoría?» dice cuántos cuenta cada una y por qué no cuadran: la hoja es el etiquetado del cuerpo técnico (con la segunda jugada) y Opta aplica su regla de jugada a balón parado y no cuenta penaltis. En la charla, la de la hoja" },
          { que: "Opta: orden y tendencia", es: "Las cifras de Opta van de mejor a peor puesto; un total de temporada de 0 a 3 (goles) lleva «tendencia, pocos casos» y no entra en «Lo mejor» ni «Lo peor». «Detalle en el Laboratorio» sólo sale al administrador" },
          { que: "Lo relacionado (arriba)", es: "Dos fichas a un toque: el rival del partido que se mira (oro) —sus goles en vídeo (en el pop-up de la portada, 18/11/2026), su ABP, el plan de aquel partido y la pantalla hermana— y el próximo rival (azul) —su ABP, sus goles en vídeo, la pizarra de ABP, el microciclo y el plan—, con el rival ya elegido. Si el último partido jugado aún no está en la hoja, lo dice", cuenta: "Próximo y último partido, del calendario de BeSoccer; la llave del plan y la pizarra, de la hoja RIVALES; el ABP del rival y los goles, por nombre" },
          { que: "¿Es lo de siempre? (Visual)", es: "Este partido frente a la media, en barras: el punto es el partido (verde mejor, naranja peor; hueco si es tendencia), la raya la media y la franja del partido más bajo al más alto de los anteriores; el título dice en qué va mejor y en qué peor", cuenta: "El mismo juicio que la tabla de «Detalle»: «igual» a menos de 2 puntos o del 5 %; con menos de 15 acciones, tendencia" },
          { que: "Visual · Detalle (16/11/2026)", es: "La pantalla se abre en «Visual»: las conclusiones y, cada una con su conclusión en el título, primero dónde nos cae (mapa de zonas de nuestra área; las que no tienen zona se cuentan aparte), debajo «Acción a acción» con el vídeo de cada una (el gol encajado en rojo) y el sacador rival enlazado a la plantilla de su equipo, «¿Es lo de siempre?», cómo acaban sus córners y faltas (gol del rival, ocasión del rival, remate sin ocasión, sin remate y las que acaban en contra o gol nuestro), jornada a jornada (columna apilada por partido y si los 3 últimos van a mejor; aquí mejor es menos peligro), qué tipo de acción rinde más (en el defensivo, cuál nos hace más daño; con 3 acciones o más) y la categoría (Opta). «Detalle» son las pestañas de siempre; el PDF las saca todas. Se recuerda en este aparato", cuenta: "Mismos filtros que arriba; peligro = «Gol Rival» u «Ocasión» (sujeto: el rival)" },
          { que: "Resumen", es: "Conclusiones (dos hallazgos, el vídeo y «Qué entrenamos»; las faltas se dicen en palabras: «falta frontal escorada a un lado, al borde del área», sin el número de zona), lectura rápida, este partido frente a los anteriores, cómo se reparte la zona de caída y «Acción a acción»" },
          { que: "Este partido frente a los anteriores", es: "Cada cifra contra la media por partido de las jornadas anteriores", cuenta: "Con menos de 15 acciones la fila es «indicio», en gris y sin «mejor» ni «peor»" },
          { que: "Cómo se reparten · zona de caída", es: "Las acciones por dónde cae el balón", cuenta: "Si alguna no tiene zona (un córner en corto), se dice cuántas quedan fuera y por qué" },
          { que: "Acción a acción", es: "Todas las acciones del partido, sin «Ver las 7»: minuto, acción, zona de caída y desenlace en columnas, con su corte y su segundo de Hudl", cuenta: "El gol encajado va en fila roja. Debajo, qué es un remate forzado y un rechace nuestro" },
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
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
      "«Gol RMCF» y «Transición Ofensiva» son nuestros: se marcan a mano porque el sujeto por defecto es el rival.",
      "Por defecto va sin pretemporada, como el ofensivo.",
    ],
  },
  {
    ruta: "/throw-ins",
    titulo: "Saque de Banda Ofensivo",
    resumen: "Cada saque de banda a favor: dónde se saca, adónde va y en qué acaba.",
    origen: "Nuestra hoja de saque de banda ofensivo, una fila por saque. El corte y el segundo de Hudl, del doc «banda:cortes»; la categoría, de Opta. Respaldo de Opta (17/11/2026): la jornada que la hoja aún no tiene sale de Opta (opta:abp-eventos + el evento a evento opta:directo, por /api/opta/respaldo) con el sello «Desde Opta · aún sin etiquetar en Hudl»; en cuanto la hoja tiene una fila de esa jornada, manda la hoja. De Opta salen sacador, banda, zona de saque (tercio del sacador), envío (corto < 15 m, largo), dónde cae (progresión o retroceso, carril exterior o interior, área) y el resultado de los 15 s siguientes (remate, balón parado ganado, conquista del último tercio o posesional, con «Rival» si el balón acaba suyo). «▶ Vídeo»: el corte de Opta (opta:acciones-video) o «Vídeo en Opta» (ProVision en ese segundo); los saques de la hoja sin corte propio lo ganan si casan por minuto (±1).",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Las cifras",
        filas: [
          { que: "Temporada o jornada", es: "«En la temporada» o «En esta jornada» según el filtro, nunca «hoy»" },
          { que: "¿Cómo acaban?", es: "El tramo ámbar es «Lo conservamos sin llegar a último tercio»" },
          { que: "Tamaño del mapa", es: "Campo de 900 px como mucho; la cabecera, en una línea («← Atacan hacia aquí … Su portería»)" },
          { que: "Conclusión", es: "El titular lleva una sola cifra, la que sostiene la tarea: dónde menos conservamos frente a lo que conservamos en todos los saques. El recuento (saques, conservados, último tercio, ocasiones) va de primera lectura" },
          { que: "Objetivo de «Qué entrenamos»", es: "La media de las jornadas anteriores en ese mismo sitio, si mejora al menos 3 puntos lo de hoy; si no, el nivel de los buenos partidos (la tasa que se alcanza en uno de cada tres, «lo logramos en X de N partidos»); si tampoco, la mitad del camino hasta lo que conservamos en todos los saques. Nunca es igual al dato de hoy" },
          { que: "¿Es lo de siempre?", es: "Siempre a la vista: la cifra clave, los conservados y las ocasiones; el resto, a un toque" },
          { que: "Mapa de saques", es: "Cada disco dice su tercio, su carril, los saques, el % conservado y el % que llega a último tercio (al pasar el ratón y para el lector de pantalla). La escala de color va del 0 % al 100 %" },
          { que: "Opta en la categoría", es: "Los porcentajes llevan su base de Opta («de 223 (Opta)»), y una frase corta dice que el resto de la página usa los saques etiquetados en la hoja" },
          { que: "Próximo rival", es: "«Su saque de banda» abre su pestaña de saques de banda en ABP del rival" },
          { que: "Saques registrados", es: "Los saques con los filtros puestos" },
          { que: "% Progresión", es: "Envíos hacia delante o al área", cuenta: "Dirección del envío «Progresión…» o al área ÷ saques" },
          {
            que: "% Conservados",
            es: "El saque acaba con el balón para el RMCF",
            cuenta: "Resultados nuestros (posicional, ABP, último tercio, ocasión, gol) ÷ saques. Por debajo de la mitad, el saque es una pérdida con otro nombre",
          },
          { que: "Producción", es: "Saques que llegan a último tercio, ocasión o gol nuestro", cuenta: "Nº y % sobre los saques" },
          { que: "Calidad media de envío", es: "Nota de 1 (malo) a 4 (perfecto) de los saques valorados, con la media de la temporada", cuenta: "Con menos de 15 saques valorados, en pequeño y con «tendencia»" },
          { que: "Este partido frente a los anteriores", es: "Con jornada, la tabla del partido contra la media por partido de las anteriores; entonces las cifras de arriba no se repiten", cuenta: "Con menos de 25 saques la fila es «indicio» (gris, sin «mejor» ni «peor»): un partido da 10-20; 0 contra 0 va sin barras" },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Se abre en la temporada (17/11/2026)", es: "Arriba, el rival y la conclusión (la barra de cómo acaban, el titular con su base —«3 de 17 en ocasión»— y la orden; lo demás plegado); debajo, los filtros y Visual/Detalle. La página abre con toda la temporada y el último partido marcado en oro en «¿Va a mejor?»; «Ver sólo el último partido» pone esa jornada", cuenta: "Con menos de 25 saques, la marca «tendencia»" },
          { que: "El campo", es: "Junto a cada disco, «saques · % con el balón para nosotros» (conservados en ataque, recuperados en defensa). Las leyendas y la escala de color van debajo del campo, no encima" },
          { que: "Ronda 20 (17/11/2026)", es: "Encima del campo, «Atacamos →» (o hacia dónde ataca el rival); la cifra de cada zona va sobre una píldora oscura y, en el móvil, debajo del campo hay una lista de las zonas con saques y % (cada una filtra como su disco). «¿Es lo de siempre?» pone primero y destacada «saques que llegan a último tercio» y pliega lo que no se juzga mejor ni peor; la base de cada fila lleva su unidad («0 de 3 llegadas a último tercio»). En «¿Y frente a la categoría?», si Opta cuenta otros saques que la hoja, una línea dice cuántos cada una y por qué (Opta registra todos; la hoja, los etiquetados)" },
          { que: "Lo relacionado (arriba)", es: "Dos fichas a un toque: el rival del partido que se mira (oro) —sus goles en vídeo (en el pop-up de la portada, 18/11/2026), su ABP, el plan de aquel partido y la pantalla hermana— y el próximo rival (azul) —su ABP, sus goles en vídeo, la pizarra de ABP, el microciclo y el plan—, con el rival ya elegido. Si el último partido jugado aún no está en la hoja, lo dice", cuenta: "Próximo y último partido, del calendario de BeSoccer; la llave del plan y la pizarra, de la hoja RIVALES; el ABP del rival y los goles, por nombre" },
          { que: "¿Es lo de siempre? (Visual)", es: "Este partido frente a la media, en barras: el punto es el partido (verde mejor, naranja peor; hueco si es tendencia), la raya la media y la franja del partido más bajo al más alto de los anteriores; el título dice en qué va mejor y en qué peor", cuenta: "El mismo juicio que la tabla de «Detalle»: «igual» a menos de 2 puntos o del 5 %; con menos de 25 saques, tendencia" },
          { que: "Visual · Detalle (16/11/2026)", es: "La pantalla se abre en «Visual»: lo relacionado, las conclusiones y las láminas con su conclusión en el título: primero dónde sacamos (el campo con cada saque y el tercio que concentra más), «¿Es lo de siempre?», cómo acaban (último tercio, ocasión o gol; lo conservamos; se lo queda el rival; nada), jornada a jornada (columna apilada por partido y si los 3 últimos conservan más que los anteriores) y la categoría (Opta). «Detalle» son las pestañas de siempre; el PNG lo saca todo. Se recuerda en este aparato", cuenta: "Mismos filtros que arriba; «con el balón para nosotros» = la % Retención de las cifras" },
          { que: "Resumen", es: "El rival del partido, conclusiones (titular con el dato, lo firme antes que la tendencia y «Qué entrenamos» con el objetivo de conservación de la media de las jornadas anteriores), lectura rápida, comparativa del partido, leyenda y cómo se reparte el resultado" },
          { que: "Objetivo de «Qué entrenamos» (17/11/2026)", es: "Con la misma población que el dato: si se entrena el saque en nuestro tercio, el objetivo es lo que conservábamos en nuestro tercio en las jornadas anteriores («x de y»), no la media de todo el campo" },
          { que: "Cómo se reparten · resultado", es: "Cada desenlace dicho como en el vestuario («El rival se queda el balón», «Acaba en balón parado del rival») y agrupado por de quién es el balón" },
          { que: "Dónde", es: "Mapa por zonas (con el nº de saques) y campo con cada saque; pulsar filtra" },
          { que: "Cómo acaban", es: "Flujo del saque al resultado y reparto por banda, envío, receptor, intención, rutina, sacador…" },
          { que: "Saque a saque", es: "La tabla entera, con el vídeo de cada saque y «Hudl» en su segundo cuando están cortados" },
          { que: "Categoría · Opta", es: "El Castilla frente a la categoría y cada saque de la temporada (se carga al abrirlo)" },
        ],
      },
      {
        titulo: "Cómo se lee",
        filas: [
          { que: "Zona de saque", es: "Siempre desde nuestra portería y en palabras en las conclusiones: nuestro tercio (zona 1 de la hoja), el medio (zona 2), su tercio (zona 3, junto al área rival). El número de zona sólo sale en «Qué significan las zonas»" },
          { que: "Tendencia", es: "Con menos de 25 saques, en la tabla, en las barras y en las conclusiones: sin «mejor», «peor» ni «punto débil» (sale «donde menos conservamos»)" },
          { que: "Dirección del envío", es: "Progresión o retroceso, por carril, o al área" },
          { que: "Descargar PNG", es: "El botón redondo de arriba a la derecha, como en ABP: la pantalla entera con los filtros, en imagen" },
        ],
      },
    ],
    ojo: [
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
      "Por defecto va sin pretemporada; se puede incluir desde el filtro de competición.",
      "Un partido da 10-20 saques: con poca muestra, la comparación es tendencia.",
    ],
  },
  {
    ruta: "/throw-ins-def",
    titulo: "Saque de Banda Defensivo",
    resumen: "Cada saque de banda del rival: dónde saca, adónde va y en qué acaba.",
    origen: "Nuestra hoja de saque de banda defensivo, una fila por saque del rival. El corte y el segundo de Hudl, del doc «banda:cortes»; la categoría, de Opta. Respaldo de Opta (17/11/2026): la jornada que la hoja aún no tiene sale de Opta (opta:abp-eventos + el evento a evento opta:directo, por /api/opta/respaldo) con el sello «Desde Opta · aún sin etiquetar en Hudl»; en cuanto la hoja tiene una fila de esa jornada, manda la hoja. De Opta salen sacador, banda, zona de saque (tercio del sacador), envío (corto < 15 m, largo), dónde cae (progresión o retroceso, carril exterior o interior, área) y el resultado de los 15 s siguientes (remate, balón parado ganado, conquista del último tercio o posesional, con «Rival» si el balón acaba suyo). «▶ Vídeo»: el corte de Opta (opta:acciones-video) o «Vídeo en Opta» (ProVision en ese segundo); los saques de la hoja sin corte propio lo ganan si casan por minuto (±1).",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Las cifras",
        filas: [
          { que: "Temporada o jornada", es: "«En la temporada» o «En esta jornada» según el filtro, nunca «hoy»" },
          { que: "Tamaño del mapa", es: "Campo de 900 px como mucho; la cabecera, en una línea" },
          { que: "Conclusión", es: "Si en los 3 últimos partidos le llegan a último tercio, ocasión o gol al menos 10 puntos más que antes, el titular es «Va a peor»; si no, cuántos le llegan sobre el total. La ocasión no se cita aparte: la barra la cuenta junto al último tercio y al gol" },
          { que: "Objetivo de «Qué entrenamos» y orden del próximo partido", es: "Como en el ataque, pero «como mucho»: la media anterior si es al menos 3 puntos mejor, o la tasa de los buenos partidos (uno de cada tres). Nunca es igual al dato de hoy" },
          { que: "Mapa, Opta y próximo rival", es: "Igual que en saques de banda a favor: cada disco con su detalle, porcentajes de Opta con su base y «Su saque de banda» del próximo rival" },
          { que: "Saques del rival", es: "Sus saques con los filtros puestos" },
          { que: "% Progresión concedida", es: "Envíos del rival hacia delante o al área · menos es mejor" },
          { que: "% Recuperación", es: "El saque acaba con el balón para el RMCF", cuenta: "Resultados nuestros ÷ saques del rival" },
          { que: "Peligro concedido", es: "Saques suyos que le llegan a último tercio, ocasión o gol · menos es mejor", cuenta: "Nº y % sobre sus saques" },
          { que: "Transiciones tras robo", es: "Le robamos el saque y llegamos a último tercio, ocasión o gol nuestro", cuenta: "Nº y % sobre sus saques" },
          { que: "Calidad media del envío rival", es: "Nota de 1 a 4 de sus saques valorados · menos es mejor", cuenta: "Con menos de 15 saques valorados, en pequeño y con «tendencia»" },
          { que: "Este partido frente a los anteriores", es: "Con jornada, la tabla del partido contra la media por partido de las anteriores", cuenta: "Con menos de 25 saques la fila es «indicio»: sin verde ni naranja aunque sea de «menos es mejor»" },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Se abre en la temporada (17/11/2026)", es: "Arriba, el rival y la conclusión (la barra de cómo acaban, el titular con su base —«3 de 17 en ocasión»— y la orden; lo demás plegado); debajo, los filtros y Visual/Detalle. La página abre con toda la temporada y el último partido marcado en oro en «¿Va a mejor?»; «Ver sólo el último partido» pone esa jornada", cuenta: "Con menos de 25 saques, la marca «tendencia»" },
          { que: "El campo", es: "Junto a cada disco, «saques · % con el balón para nosotros» (conservados en ataque, recuperados en defensa). Las leyendas y la escala de color van debajo del campo, no encima" },
          { que: "Ronda 20 (17/11/2026)", es: "Encima del campo, «Atacamos →» (o hacia dónde ataca el rival); la cifra de cada zona va sobre una píldora oscura y, en el móvil, debajo del campo hay una lista de las zonas con saques y % (cada una filtra como su disco). «¿Es lo de siempre?» pone primero y destacada «saques que llegan a último tercio» y pliega lo que no se juzga mejor ni peor; la base de cada fila lleva su unidad («0 de 3 llegadas a último tercio»). En «¿Y frente a la categoría?», si Opta cuenta otros saques que la hoja, una línea dice cuántos cada una y por qué (Opta registra todos; la hoja, los etiquetados)" },
          { que: "Lo relacionado (arriba)", es: "Dos fichas a un toque: el rival del partido que se mira (oro) —sus goles en vídeo (en el pop-up de la portada, 18/11/2026), su ABP, el plan de aquel partido y la pantalla hermana— y el próximo rival (azul) —su ABP, sus goles en vídeo, la pizarra de ABP, el microciclo y el plan—, con el rival ya elegido. Si el último partido jugado aún no está en la hoja, lo dice", cuenta: "Próximo y último partido, del calendario de BeSoccer; la llave del plan y la pizarra, de la hoja RIVALES; el ABP del rival y los goles, por nombre" },
          { que: "¿Es lo de siempre? (Visual)", es: "Este partido frente a la media, en barras: el punto es el partido (verde mejor, naranja peor; hueco si es tendencia), la raya la media y la franja del partido más bajo al más alto de los anteriores; el título dice en qué va mejor y en qué peor", cuenta: "El mismo juicio que la tabla de «Detalle»: «igual» a menos de 2 puntos o del 5 %; con menos de 25 saques, tendencia" },
          { que: "Visual · Detalle (16/11/2026)", es: "La pantalla se abre en «Visual»: lo relacionado, las conclusiones y las láminas con su conclusión en el título: primero dónde saca el rival (el campo con cada saque), «¿Es lo de siempre?», cómo acaban sus saques (le llega a último tercio, ocasión o gol; lo conserva; lo recuperamos; nada), jornada a jornada (y si los 3 últimos le dejan llegar menos que los anteriores: aquí mejor es menos) y la categoría (Opta). «Detalle» son las pestañas de siempre; el PNG lo saca todo. Se recuerda en este aparato", cuenta: "Mismos filtros que arriba; el peligro es el de «Peligro concedido»" },
          { que: "Resumen", es: "El rival del partido, conclusiones (titular con el dato, «vía peligrosa» sólo con 15 saques o más y dos llegadas, y la «Orden para el próximo partido» con su métrica y el objetivo de recuperación de la media de las jornadas anteriores), lectura rápida, comparativa, leyenda y cómo se reparte el resultado" },
          { que: "Qué entrenamos (17/11/2026)", es: "También en defensa: salto al receptor y vigilancia a la espalda del lateral; se cuentan los saques del rival que llegan a último tercio y el objetivo es como mucho la media de las jornadas anteriores" },
          { que: "Cómo se reparten · resultado", es: "Cada desenlace dicho como en el vestuario y agrupado por de quién es el balón, con la misma base que el desglose: «6 acaban con el balón para nosotros (5 recuperados y 1 en balón parado nuestro), 7 para el rival (…) y 1 en nada»" },
          { que: "Dónde", es: "Mapa por zonas y campo con cada saque; el rival ataca hacia la izquierda" },
          { que: "Cómo acaban", es: "Flujo del saque al resultado y reparto por banda, envío, receptor, nuestra defensa y debilidad defensiva" },
          { que: "Saque a saque", es: "La tabla entera, con el vídeo de cada saque y «Hudl» en su segundo cuando están cortados" },
          { que: "Categoría · Opta", es: "Lo que le hacen al Castilla frente a la categoría y cada saque del rival (se carga al abrirlo)" },
        ],
      },
      {
        titulo: "Cómo se lee",
        filas: [
          { que: "Zona de saque", es: "Siempre desde nuestra portería: su tercio (zona 1 de la hoja), el medio (zona 2), nuestro tercio (zona 3, junto a nuestra área: ahí un error cuesta caro). La hoja numera desde la portería del que saca" },
          { que: "Receptor", es: "A quién se la ponen: primera línea (en las conclusiones, «el que recibe de cara junto a la línea»), medios, 9, extremo («cuando recibe el extremo»). La orden dice «con vigilancia al que recibe…»" },
          { que: "Recuperamos", es: "Con una jornada elegida, el titular da la base y el rango de antes: «recuperamos 6 de 14 (43 %; antes, de 12,5 % a 53,8 % por partido)»" },
          { que: "Descargar PNG", es: "El botón redondo de arriba a la derecha, como en ABP: la pantalla entera con los filtros, en imagen" },
        ],
      },
    ],
    ojo: ["Por defecto va sin pretemporada; se puede incluir desde el filtro de competición.", "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura)."],
  },
  {
    ruta: "/abp-microciclo",
    titulo: "Microciclo ABP",
    resumen: "Qué se trabaja de balón parado cada día de la semana, con cuánto desgaste, y si se nota en el partido.",
    origen:
      "El plan se guarda en la app (doc «abp-microciclo», Supabase). La lista de micros y las cargas medidas, de la hoja de registro de tareas; lo que pasa en los partidos, de las cuatro hojas de ABP y banda; el partido, de nuestro calendario de BeSoccer.",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Ataca / Mantiene", es: "La tarjeta dice «Ataca» si el dato es una carencia (a favor, peligro por debajo de la media de su lado; en contra, por encima) y «Mantiene» si es una fortaleza, con la media del lado" },
          { que: "Para vigilar", es: "Lo urgente sin tarea con menos de 5 acciones no es carencia: sale como «Para vigilar, con poca muestra» y no cuenta entre las cosas que mirar" },
          { que: "MD-1 y pico", es: "Con su base: cuántos aspectos del MD-1 son nuevos, y la carga del pico frente a la media del resto de días con sesión" },
          { que: "Ficha de tarea", es: "Los contenidos van apilados, como mucho tres renglones. «Ataca ·» dice la carencia de la temporada que trabaja, con su dato (peligro en a de b acciones; tendencia con menos de 15). PRE/INTRA/POST sólo salen si la tarea lleva vídeo. Con el borde ámbar le falta intensidad o criterio de éxito; el botón «Añadir…» la abre" },
          { que: "Hoy", es: "El día de hoy va resaltado y, en el móvil, «Ir a hoy» salta a él. La leyenda va plegada en el móvil" },
          { que: "Revisión de la semana", es: "Ordenada por impacto. El aviso principal va entero y cada uno de los demás en una fila con su botón. «Dos carencias sin tarea» lleva su cifra en el título y un «Crear tarea» por carencia" },
          { que: "Balón parado de la semana", es: "Junto al objetivo, la media de minutos de los micros anteriores con rival y cuántos son. «Nuestro último partido» es el del Castilla, con enlace a nuestro ABP de aquel partido" },
          { que: "Microciclo", es: "El del próximo partido al entrar; la lista trae el actual y sus vecinos, «Ver todos» el resto. ✓ = semana jugada con plan" },
          { que: "Días entrenados", es: "Con ellos se prorratea el objetivo; en blanco se deducen del plan" },
          { que: "Rival de la semana", es: "Se escribe a mano sólo si la tarjeta del partido no lo trae; si lo trae, el campo está en «Más»" },
          {
            que: "Balón parado de la semana",
            es: "Minutos planificados frente al objetivo del cuerpo técnico, y el reparto atacando/defendiendo",
            cuenta: "90-100′ por cada 6 días de sesión, prorrateado hacia abajo (tope 6). Las tareas de los dos lados cuentan mitad y mitad. El reparto va también en una barra (oro atacando, azul defendiendo); una hora justa se escribe «1 h»",
          },
          { que: "Pizarra ABP · ABP del rival · Sus goles en vídeo · Cómo le marcan · Plan de partido", es: "Atajos del partido de la semana, con el rival ya elegido; los dos vídeos se ven en el pop-up de la portada y, aparte, «Cómo son sus goles ›» abre Análisis de goles (18/11/2026); «Informe post» si ya se jugó y «Vídeo de ABP» si la pieza está subida" },
          { que: "Proponer boceto", es: "Propone la semana entera (días, aspectos y minutos) con el próximo partido, nuestro rendimiento y el del rival" },
          { que: "Informe de la semana", es: "El informe de balón parado de la semana, para verlo y mandarlo" },
          { que: "Más", es: "Exportar planificación (imagen, WhatsApp o correo), Importar del registro, Copiar de otro micro (atado por MD) y Nuevo microciclo" },
          { que: "Ronda 20 (17/11/2026)", es: "Los minutos de la semana van en minutos como el objetivo («61′ · objetivo 60-67′», «Carga: 61′»), la nota del objetivo en una línea y, junto a «Viene de …», «Ver su ABP» abre ABP ofensivo en ese partido. La semana va antes que la revisión y la carga" },
        ],
      },
      {
        titulo: "La semana",
        filas: [
          { que: "Lo que dejó el partido", es: "Ya jugado: cada aspecto trabajado con sus acciones, peligro y goles en ese partido, y su veredicto", cuenta: "Con menos de 5 acciones va en gris: «pocos casos»" },
          {
            que: "Revisión de la semana",
            es: "El aviso más grave entero, con su acción; debajo, «También:» con los títulos de los demás, que se despliegan junto con lo que ya está bien. Con varias tareas sin criterio, un solo botón «Elegir el criterio en las N tareas» que empieza por la primera, y «Ver las N tareas» con el día y el nombre entero de cada una («Córner directo y 4 acciones más»); cada carencia lleva a la pantalla donde se ven sus acciones (ABP o saque de banda, ofensivo o defensivo)",
            cuenta:
              "Con menos de 15 acciones una carencia se escribe como tendencia, no como urgencia. Si todo lo que falta es de un lado y ese lado tiene menos del 40 % de los minutos, sale «El reparto va contra lo que falta». Mira minutos, tareas sin tiempo, sin intensidad o sin criterio de éxito, tareas en día libre o de partido (en el día del partido el vídeo o la charla del plan valen: es la activación previa, ni se avisa ni cuenta como «vídeo después del campo»), el MD-1, el pico de carga, los lados y lo más urgente de la competición que no entra (dos a la vez se juntan en «Dos carencias sin tarea»)",
          },
          { que: "Carga: … en N días con balón parado", es: "Plegado: Minutos de ABP, Carga condicional, Carga cognitiva y Campo / Vídeo", cuenta: "Condicional = tiempo × intensidad; cognitiva = tiempo × exigencia; al lado, la media de los otros micros" },
          {
            que: "El tablero",
            es: "Un bloque por trabajo; se pulsa para editar y se arrastra de día. Según el día, Ficha completa o Compacta. En la ficha completa el título lleva todas las acciones que trabaja; si viene de la hoja, debajo va «En la tarea de la sesión ·» con el nombre de la tarea de la sesión donde entra",
          },
          { que: "Al pie de cada día", es: "Minutos, carga y mental", cuenta: "Carga = minutos × intensidad (1-10); mental = minutos × exigencia cognitiva (1-10). Se explica una vez, en la leyenda" },
          { que: "La barrita de cada día", es: "Oro atacando, azul defendiendo (las tareas de los dos lados, mitad y mitad). En la ficha, «Plan: intensidad 4/10 y exigencia mental 7/10»: es lo planificado, no lo medido" },
          { que: "PRE · POST · INTRA · VÍDEO · CAMPO · HOJA", es: "Vídeo antes o después del campo, durante la tarea, sesión de vídeo, en el campo, o traído del registro" },
        ],
      },
      {
        titulo: "Reparto y competición",
        filas: [
          { que: "Reparto", es: "Minutos por lado, por momento de la sesión y por rol (un trabajo puede sumar en varios)" },
          { que: "Saque de banda: los tercios", es: "Como en las pantallas de banda, desde nuestra portería: atacando, «en nuestro tercio» (zona 1 de la hoja) y «en su tercio» (zona 3); defendiendo, al revés; «en el medio» es la zona 2. Sin lado, «en el tercio de quien saca» o «de quien defiende»" },
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
      "El saque de banda se nombra por el campo del que saca: primer tercio, medio y último tercio. Atacando, el último tercio es el del rival; defendiendo, el nuestro.",
      "Si una de las hojas de ABP no se puede leer, un aviso arriba lo dice y el cruce se calcula sin ella.",
    ],
  },
  {
    ruta: "/abp-pizarra",
    titulo: "Pizarra de Balón Parado",
    resumen: "Las láminas de ABP del partido: quién va en cada puesto, sus carreras por fases y lo que se exporta a la sala y a cada jugador.",
    origen:
      "El documento «abp-pizarra» de la app (Supabase), el calendario (partidos jugados + hoja RIVALES) y el once de la pizarra táctica. Las fotos, de la plantilla.",
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Montar la jornada",
        filas: [
          { que: "Jornada que se abre y «· próximo»", es: "La próxima según BeSoccer con la regla de la portada (fecha y hora de Madrid y 2,5 h de gracia). Si no hay calendario, la primera fila con fecha de hoy en adelante." },
          { que: "Jugadas y por jugar", es: "Con BeSoccer, cuenta como jugada cualquier jornada hasta la última que se ha jugado, aunque la hoja RIVALES la tenga con una fecha posterior." },
          { que: "Control de la convocatoria", es: "Avisa de quién falta en una diapositiva donde cabe (la de falta directa ofensiva, de lanzadores, nunca cuenta), de nombres de las consignas sin ficha y de consignas que dan a alguien otro papel: «Rematadores: … Sergio» con Sergio en «Saque y corta» en el panel" },
          { que: "Avisos de convocatoria", es: "Botón ámbar junto a Exportar con el número de avisos; lleva a «Control de la convocatoria» y lo abre" },
          { que: "Asignaciones", es: "La lámina es azul noche en los dos temas; el rótulo «Asignaciones» se queda en oro claro también en modo día" },
          { que: "Control de la convocatoria", es: "Con avisos se abre solo, con todos a la vista y su «Ir a arreglarla»" },
          { que: "Poner fichas sueltas", es: "Sirve para dibujar a alguien sin puesto en la jugada (un rechace, un hombre libre)" },
          { que: "Tal cual: PDF · PPT", es: "Saca exactamente las pizarras como las has pintado: pasa por cada una, la fotografía de la pantalla y pone una por hoja en el PDF y una por diapositiva en el PowerPoint. No recoloca, no rellena ni cambia nada; sólo deja fuera el botón «ampliar» del móvil y quita la selección. Al acabar vuelve a la pizarra en la que estabas", cuenta: "PDF: cada hoja mide lo que la foto, sin recortar ni estirar. PPT: diapositiva 16:9 con la foto entera centrada (si la pizarra no es 16:9 quedan márgenes azul marino, nunca se deforma). Es una imagen: para mover fichas en PowerPoint, el «Exportar» de siempre" },
          { que: "Copiar de J.. y poner el once", es: "Trae jugadores, flechas y consignas de la jornada anterior y cambia a los que no están en el once. El aviso de «Pizarra sin empezar» dice antes cuántas diapositivas y jugadores trae y de qué partido" },
          { que: "Quitar diapositiva", es: "Al otro extremo de la barra; si la diapositiva tiene fichas o consignas, pide confirmación. Se puede deshacer justo después" },
          { que: "Su ABP · Sus goles en vídeo · Cómo le marcan · Plan de partido", es: "Bajo el partido, con el rival de la pizarra ya elegido: su balón parado (ABP del rival), sus goles y los que encaja en vídeo (en el pop-up de la portada, 18/11/2026; aparte, «Cómo son sus goles ›» a Análisis de goles) y su plan de partido" },
          { que: "Dos puestos comparten la sigla…", es: "Aviso cuando dos puestos de la misma diapositiva se leen igual en la chapa; «Renombrarlos» les pone siglas distintas. Una diapositiva nueva ya nace con ellas separadas (p. ej. rechace largo RE y zaguero ZA); en una ya montada, lo escrito a mano no se cambia solo" },
          { que: "Consignas de una pizarra sin empezar", es: "Son las guardadas «para las siguientes» y pueden nombrar a jugadores de otra jornada; al copiar llegan las de la jornada anterior con el once cambiado" },
          { que: "Nombre subrayado en punteado", es: "En las consignas, un jugador que no está en esa lámina. Con la lámina vacía no se marca nada" },
          { que: "Colocar", es: "Rellena los huecos con quien suele hacer ese puesto", cuenta: "La memoria es por puesto: se anota sola cada vez que se asigna a alguien" },
          { que: "0/10 colocados", es: "En la tira, lo que falta en cada diapositiva, cuando la pizarra ya está empezada. Sin empezar no sale: la acción es «Copiar de J.. y poner el once» del aviso, que va antes del once; los botones de exportar salen cuando ya hay pizarra" },
          { que: "7 versiones guardadas", es: "En la lista de partidos, cuántas versiones de esa pizarra se han congelado" },
          { que: "Soltar una cara sobre otra", es: "Las intercambia: cada sitio conserva su puesto y sus carreras" },
          { que: "Ronda 20 (17/11/2026)", es: "Al editar, las fichas del campo van un 20 % más grandes (lo exportado y el proyector no cambian). En «Asignaciones», el puesto con jugador va en verde y el que falta en ámbar discontinuo, con «4/10 · faltan 6». Sin empezar, la lámina dice encima de las consignas que son de la plantilla guardada y cuáles llegan al copiar; el aviso dice que la copia queda en «Histórico de la jornada» y se puede deshacer; fichas sueltas y textos van juntos en «Más»" },
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
          {
            que: "PDF por jugador",
            es: "Uno vertical por jugador para WhatsApp: portada con rival · jornada · día y hora y la lista de sus acciones (ofensiva con flecha, defensiva con escudo); en cada hoja «Acción n de N», su cara con «TÚ» pegado al aro y «Volver al resumen». El del portero acaba con una hoja de penaltis: cada lanzador del rival, su lado más repetido, si cambió en el último y la portería en seis zonas (Opta; la misma tarjeta que en ABP del Rival · Quién)",
            cuenta:
              "Las láminas se fotografían con el once del rival ya cargado (dorsal y apellido, como en el PDF general; si tarda, se espera hasta 25 s) y con la letra de la pizarra. El «TÚ» va donde no tapa ninguna letra, chapa ni rival (si pegado al aro no cabe, un paso más lejos con un trazo rosa); el recorte deja entera toda flecha, rival o chapa que asome. En la portada, lo que hace en cada acción va a la letra de los demás subtítulos, en dos renglones si hace falta",
          },
          { que: "Rival implícito", es: "En las defensivas sin rivales dibujados se pinta un atacante por marca, con el dorsal de «Quién marca a quién»" },
          {
            que: "Rivales con dorsal y apellido",
            es: "Al exportar, el rival dibujado sin dorsal toma uno de su once probable (el de «Quién marca a quién»), del más fuerte por arriba al menos y sin repetir; todos llevan el apellido debajo",
            cuenta: "Sin once del rival se queda como estaba; el sacador del saque de banda no se adivina",
          },
          { que: "M3 →9", es: "El dorsal decidido va dentro de la chapa de quien marca, no en una casilla suelta encima de la cabeza" },
          {
            que: "Al 8 Montalvo · 1,80",
            es: "En el panel exportado: a quién marca cada uno, con su altura si se sabe; si no cabe al lado del nombre, pasa a dos renglones (el nombre no se corta)",
          },
          {
            que: "Portero",
            es: "En las defensivas, el del once de la pizarra táctica bajo palos: con su foto entera, del tamaño de las demás, y su chapa «POR» con el nombre (sin foto, el disco «POR»)",
          },
          {
            que: "Todas las caras del mismo tamaño",
            es: "En la pizarra, el proyector, el PDF, el PowerPoint y el PDF de cada jugador, todas las fotos —las nuestras y la del portero— miden lo mismo, en todas las láminas",
            cuenta:
              "Al enseñar, cada lámina acerca el campo a su jugada; lo que crece es el campo, no las caras: caras, chapas, rivales y letras se pintan siempre al 78 % del lienzo de 1920 (lo que mide el campo entero al editar). Ninguna cara se encoge para caber ni crece por sí sola (tampoco la del jugador resaltado en su PDF, que se distingue por el rosa)",
          },
          {
            que: "Ningún nombre tapado",
            es: "Al enseñar y exportar, ninguna chapa, apellido de rival, nombre del portero ni letra queda debajo de otra cosa",
            cuenta:
              "Nuestras caras se abren hacia los lados, todas a su tamaño: hasta 64 px y, las que siguen pisando un nombre, hasta 110, 160 y 220 px. Cada rival busca el sitio libre más cercano (hasta 260 px, primero a los lados y por delante) con su apellido debajo o, si no cabe, encima: la chapa de su marca ya dice su dorsal («M2 →5»). Motor común en lib/abp/coloca-lamina.ts",
          },
          {
            que: "Letras A, B, C… en el campo",
            es: "Junto a quien nombra cada consigna; si no nombra a nadie, junto a su papel («Centrales…», «Cortas…») o a su grupo («Marcas: …», «En barreras…»), con una sola letra para un grupo o para dos o tres que están juntos",
            cuenta:
              "La consigna que no habla de nadie de la lámina sale con un punto en vez de letra, para no prometer una letra que el campo no tiene. En las directas no se ponen",
          },
          {
            que: "Línea DATO",
            es: "Al pie de cada lámina y de cada acción del PDF por jugador: la cifra del rival que la sostiene, con su base y su puesto entre los 20",
            cuenta:
              "Sale de la misma comparativa de Wyscout que el informe de ABP (córners o faltas que saca o concede y su % de remate; en faltas directas, los penaltis). Lo que concede se cuenta desde el que menos («8.º de 20 (menos es mejor para ellos)»); un % con menos de 25 acciones detrás lleva «tendencia». El saque de banda no lo mide Wyscout: sin línea",
          },
          { que: "J12 · vie 13 nov · 21:15", es: "Bajo el rival de la cabecera y en el pie del PDF: la jornada y el día y hora del calendario de BeSoccer, con «lámina n de N»" },
          { que: "Leyenda de flechas", es: "Dos filas fijas (flechas arriba; rival y fases abajo), del ancho justo de lo que la lámina dibuja" },
        ],
      },
      {
        titulo: "Nombres en las consignas",
        filas: [
          {
            que: "Subrayado en oro",
            es: "Al editar, el nombre de alguien que está en la lámina va atado a su ficha: si pones a otro jugador en ella (el selector, soltar una cara sobre otra, «Quién marca a quién», el grupo entero), la consigna pasa a decir el nombre del que entra",
            cuenta:
              "Se reconoce por el apodo, el nombre completo o el apellido, sin tildes ni mayúsculas (en mayúsculas sostenidas, el nuevo también). Va en el mismo paso que el cambio: Ctrl+Z lo deshace todo. Debajo de «Consignas» se lista quién va atado",
          },
          {
            que: "Ondas rojas",
            es: "Un jugador de la plantilla que la consigna nombra y ya no está en la lámina: el texto se queda tal cual, para que lo cambies o lo pongas en el campo",
          },
          {
            que: "Sin atar",
            es: "Si dos de la lámina comparten la palabra (dos con el mismo apellido) o el que sale sigue en otro sitio de la misma lámina, no se sabe de quién habla: no se cambia",
          },
          {
            que: "Lo guardado",
            es: "Las pizarras de antes abren igual: las consignas siguen siendo texto y lo atado se calcula al verlas. Sólo cambian cuando tú cambias a alguien de ficha",
            cuenta: "Cambiar a uno en todas las diapositivas (cambiar jugador, «Poner el once») ya cambiaba los nombres en todos los textos",
          },
        ],
      },
      {
        titulo: "Consignas en lo exportado",
        filas: [
          {
            que: "Variantes copiadas",
            es: "Si una variante lleva las mismas consignas que otra anterior, al exportar sale con las de su lámina: quién hace qué y dónde",
            cuenta: "Con flechas, la tarea de cada uno («Joan: sales del 2.º palo y atacas el punto de penalti»); sin flechas, por grupos del panel y con el dorsal de su marca",
          },
          {
            que: "Consignas genéricas",
            es: "«Orden de lanzamiento cerrado antes del partido» y «Despeje expeditivo con la pierna corta» no salen: en su lugar, el orden de lanzadores de cada zona o los papeles de la lámina",
          },
          {
            que: "Consignas que contradicen la lámina",
            es: "La que da a alguien un papel que no tiene en la lámina («parejas de bloqueo Joan-Mario» con Joan de rematador, «Cestero saca a corta» con Cestero de rechace largo) sale cambiada, en su sitio, por las de la lámina",
            cuenta: "El verbo del papel (saca, bloqueo, rechace) se ata al nombre que tiene más cerca en la frase",
          },
          { que: "Lo guardado", es: "No se toca: lo que escribes sigue en la pizarra; sólo cambia lo que sale en el PDF, el PowerPoint y el PDF de cada jugador" },
        ],
      },
    ],
    ojo: [
      "La lámina es azul noche en los dos temas a propósito: es lo que se proyecta y se imprime.",
      "Antes de exportar se avisa de las consignas que nombran a alguien sin ficha en la lámina, de las que le dan otro papel («Cestero saca a corta» con Cestero de rechace largo) y de las variantes copiadas.",
      "En el PDF de cada jugador la línea «ORDEN» sólo sale si dice algo que el titular no dice.",
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
          { que: "Vista de entrada: lista", es: "Sin elección guardada en el aparato, la plantilla abre en lista en todos los anchos; «Fichas» enseña las tarjetas con foto. La elección se recuerda en el aparato." },
          { que: "A quién atender (gráfico)", es: "Junto a la lista de «A quién toca seguir», un gráfico de puntos: cada jugador de campo del Castilla con ficha de scout, por días desde su último seguimiento (horizontal) y su nota del scout (vertical). La franja de la derecha, pasados los 14 días, es «a atender»; el titular dice cuántos caen ahí y el mejor valorado de ellos. Quien no tiene ficha de scout no sale en el gráfico, sí en la lista. Un toque en un punto abre su ficha." },
          { que: "Un solo umbral de 14 días", es: "Cuenta quien lleva más de 14 días sin seguimiento (15 o más), la misma regla de lib/seguimiento.ts que Calendario y Dashboard Seguimiento. La lista enseña de entrada sólo a esos, los mismos que la cifra del titular; «Ver los N» enseña a todos." },
          { que: "Las dos notas de cada ficha", es: "Dos renglones fijos, en el mismo orden en todas: «scout», la media de las competencias de su ficha de scout (0-10), y «partidos (últ. 3)», la media de sus 3 últimas notas en Valoraciones (con menos, «tend.»). En la lista, la del scout va a la derecha, rotulada «scout»." },
          { que: "Minutos con su fuente", es: "«810′ de 1080′ · Valoraciones»: sus minutos de los posibles en Valoraciones (BeSoccer, 90′ por partido). El Dashboard de plantilla cuenta los de Wyscout, por eso las cifras pueden no coincidir. Sin minutos, la línea no sale (la misma regla para todos)." },
          { que: "Accesos con nombre", es: "Cada ficha y cada fila de la lista llevan sus accesos rotulados, con el jugador ya elegido: Notas (Valoraciones), Comparativa, Vídeos, Data (Data análisis), Seguimiento (Dashboard Seguimiento) y Calendario. Los porteros no llevan los dos de seguimiento: lo hacen con su entrenador, en un registro aparte." },
          { que: "Datos al día", es: "Si la pantalla se abre con la copia guardada en el aparato, se repinta sola en cuanto llega lo nuevo: jugadores, seguimiento, vídeos e informes. Así el aviso de 14 días y las cifras dicen lo mismo que Calendario y Dashboard Seguimiento" },
          { que: "«A quién toca seguir», plegado", es: "Enseña los seis que más días llevan sin registro; «Ver los N» abre a todos los jugadores de campo del Castilla" },
          { que: "Cifra «Seguimientos»", es: "Registros con fecha hasta hoy de los jugadores de campo del filtro; lo programado no cuenta. Es la misma cuenta que el Dashboard Seguimiento" },
          { que: "«Cómo se lee cada ficha»", es: "Plegado bajo las cifras: qué es «últ. 3», los minutos, «scout», «Sin seguir · N días» y qué abre cada icono de la ficha (Notas, Comparativa, Vídeos, Data análisis, Dashboard Seguimiento y Calendario, con el jugador ya elegido)" },
          { que: "Nota del scout en la ficha", es: "Va junto al nombre, bajo la foto: punto de color y «scout 7,6»; «tend.» si tiene menos de 3 competencias valoradas; el detalle, al pasar el ratón" },
          { que: "Minutos de la ficha", es: "«702′ de 1080′»: sus minutos en Valoraciones (BeSoccer, 90′ por partido) sobre los posibles; el Dashboard de plantilla cuenta los de Wyscout. «tend.» junto a «últ. N» si tiene menos de 3 notas" },
          { que: "Iconos de la ficha", es: "Vídeos, Data análisis, Seguimiento y Calendario con el jugador ya elegido (los porteros, sin seguimiento)" },
          { que: "Notas al día", es: "Si la ficha se abre con la copia del aparato, las notas se vuelven a pedir al servidor y se pintan las nuevas" },
          {
            que: "El nombre manda sobre el ID",
            es: "Los JUG-XX se han renumerado alguna vez",
            cuenta: "Todo lo que cruza jugadores lo hace por nombre",
          },
          { que: "Dorsal", es: "Sale de su columna, no del orden de la fila" },
          { que: "Puesto", es: "Se corrige con lib/posiciones.ts: la hoja guarda números de rol" },
          { que: "Porteros", es: "Su ficha sigue aquí, pero no cuentan en las cifras de seguimiento ni salen en «Replicar en más jugadores»: llevan un registro independiente, con su entrenador. Lo dice una vez la cabecera PORTEROS; sus fichas no llevan días sin seguir", cuenta: "Portero = puesto PORTERO, 1 o 13 (o POR, GK). «Con algún seguimiento», el total de registros y la mediana son de los jugadores de campo" },
        ],
      },
      {
        titulo: "Lo primero que se ve",
        filas: [
          {
            que: "A quién toca seguir (gráfico)",
            es: "Una barra por jugador de campo del Castilla con los días desde su último seguimiento, la raya de los 14 días del aviso y la mediana en el título; quien pasa de 14 lleva «Registrar», que abre su ficha con el formulario de nuevo seguimiento",
            cuenta: "Días de calendario desde el último registro con fecha hasta hoy. Oro: más de 14; rojo: 28 o más o ninguno. En el móvil sólo salen los que pasan de 14",
          },
          { que: "Nota del scout", es: "Media de las fichas del scout (cinco competencias, escala 0-10) y su tramo; el pie dice su base frente a la cifra «Jugadores» («los 19 de 22 con ficha de scout»)" },
          {
            que: "Línea de rendimiento de cada ficha",
            es: "La nota media de sus 3 últimos partidos con nota («últ. 3») y el % de minutos, de Valoraciones; la cifra va en tinta y su color en el punto de al lado. La base sale una vez bajo las cifras («de los N′ posibles»). Debajo, en cada ficha del Castilla, «Notas» abre Valoraciones con él abierto y «Comparativa», su fila en Comparativa categoría; al lado, tres iconos: sus vídeos, su Data análisis y su seguimiento (los porteros, sin seguimiento: llevan el suyo). La foto va encuadrada a cara y hombros (4:5)",
            cuenta: "% de minutos = sus minutos ÷ (partidos de Valoraciones × 90′); quien no ha jugado, 0 %. Sin partidos, no sale",
          },
          {
            que: "Jugadores",
            es: "«N de campo + M porteros» y cuántos de los de campo tienen seguimiento: la misma base que el aviso de arriba",
            cuenta: "La mediana de seguimientos por jugador es la misma función que en el Dashboard Seguimiento (con los de 0 dentro, a un decimal)",
          },
          {
            que: "Fichas o lista",
            es: "Mientras no se elige, lista en el móvil y fichas en el resto, y el selector marca la que se ve; la elección se recuerda en el aparato",
          },
          {
            que: "Tamaño de la ficha (18/11/2026)",
            es: "La ficha que se abre al pinchar a un jugador ocupa la pantalla entera en el móvil y llega hasta 1560 px de ancho en pantallas grandes (antes 1150 px), para que la radiografía y los gráficos salgan en grande",
          },
          {
            que: "Seguir con él",
            es: "Bajo las pestañas de la ficha: Registrar seguimiento, su Data análisis, su Comparativa con la categoría y su Calendario de seguimiento, con el jugador ya elegido",
            cuenta: "Desde otras pantallas se llega con /individual?player=ID (o ?nombre=), &pestana=seguimiento|valoraciones|videos y &nuevo=seguimiento para abrir el formulario",
          },
        ],
      },
      {
        titulo: "Área de mejora y Tendencia",
        filas: [
          { que: "Radiografía de percentiles (también en móvil y tablet, 18/11/2026)", es: "Una cuña por métrica, tan larga como su percentil: con balón a la derecha, sin balón a la izquierda. En el ordenador, cada cuña lleva su valor por 90 y su P al lado. Con poco hueco (móvil, tablet en vertical) se dibuja la versión compacta: la pizza más grande, el percentil fuera de cada cuña, un número dentro y debajo la leyenda con el nombre, el valor y el P de cada número. «Barras» sigue en el selector del gráfico", cuenta: "Mismo cálculo en las dos: percentil frente a los de su puesto en la categoría (Wyscout), dado la vuelta en las de menos es mejor (↓). La compacta sale cuando el gráfico tiene menos de 620 px de ancho; la leyenda va a dos columnas desde 560 px" },
          { que: "Mapa de su puesto", es: "Todos los de su puesto en Primera RFEF con 450′ o más, en dos ejes" },
          {
            que: "Filtro de edad del mapa",
            es: "Todas, sub-21, sub-23, su edad ±2 o un rango a mano",
            cuenta: "Se vuelve a ordenar sólo entre los de esa edad; él entra siempre. Hacen falta 5 además de él",
          },
          { que: "Cara a cara con la élite", es: "Hasta 3 jugadores de Primera o Premier sobre su radiografía. Dos buscadores: «Añadir: nombre o equipo», entre los de su puesto y edad (la vara), y al lado «Cualquier jugador de Primera o Premier», por nombre, de cualquier puesto y edad. En la lista, el nombre va entero y en grande; debajo, equipo, liga, puesto, edad y minutos (18/11/2026)", cuenta: "El del buscador libre se mide igual que los demás: con las métricas del puesto de nuestro jugador y contra la misma vara; si es de otro puesto lo dice su chapa («otro puesto»). Entran los que llevan 180′ o más en la descarga de Wyscout de esa liga" },
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
    ojo: ["Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura)."],
    revisada: "2026-11-21",
  },
  {
    ruta: "/individual_proc",
    titulo: "Dashboard Seguimiento",
    resumen: "Cuánto se sigue a cada jugador de campo del Castilla, quién lo hace y de qué se le habla, en toda la temporada.",
    origen: "Hoja de seguimiento (una fila por registro, por el Apps Script) cruzada con la plantilla de la hoja JUGADORES. Cuenta toda la temporada (el corte del 21/10 es sólo de las sesiones de entrenamiento) y nada fechado después de hoy. Los filtros de estrategia leen cada parte: «VÍDEO» trae también los de «VÍDEO Y CHARLA». El de entrenador ofrece a cada autor suelto y casa por «incluye a»: «JULIÁN» trae los de «JULIÁN Y MIGUEL» y los de «TODOS» (todo el cuerpo técnico).",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "A quién cuenta",
        filas: [
          { que: "Con un jugador ya elegido", es: "?jugador=NOMBRE (o ?player=ID) abre el Dashboard filtrado por ese jugador; se casa por nombre. Llega así desde las fichas de Plantilla, Emocional y Calendario" },
          { que: "Datos al día", es: "Si se abre con la copia del aparato, se repinta en cuanto llega el seguimiento nuevo" },
          { que: "Búsqueda ya puesta", es: "?buscar= rellena el buscador al abrir (así llegan los enlaces «Seguimiento de humildad»)" },
          { que: "Tarjetas de cifras", es: "Una línea con la base; la explicación entera, al pasar el ratón. «Sin feedback» lista a todos los autores (un registro compartido cuenta a cada uno)" },
          { que: "Evolución semanal", es: "El mes en el primer lunes de cada mes; la semana pico marcada en su barra con si fue grupal o individual" },
          { que: "Lecturas del periodo", es: "La de objetivos no repite a los del aviso «sin seguimiento»; con más de 6 jugadores, el resto plegado tras «Ver los N»" },
          { que: "Cifras", es: "Los porcentajes, siempre a un decimal; el pico semanal dice la semana con su mes («semana del 21 – 27 sep»)" },
          { que: "Jugadores de campo del Castilla", es: "Sólo licencia del Castilla y sin porteros (puesto PORTERO, 1 o 13), que llevan un registro independiente; los del RMC y del juvenil llevan su seguimiento en su equipo. La misma población y la misma cuenta que Plantilla y Calendario de Seguimiento", cuenta: "El filtro va antes de todo: cifras, gráficos, listas y CSV" },
          { que: "El nombre manda sobre el ID", es: "Cada registro se ata a su jugador por nombre: los JUG-XX se han renumerado" },
          { que: "Filtros", es: "Jugador, posición y entrenador, siempre a la vista; estrategia, modalidad, momento, mes y semana van en «Más filtros» (se abre solo si hay alguno puesto)", cuenta: "Semana de temporada: de lunes a domingo, desde la del 8 de julio" },
          { que: "Aviso de arriba", es: "Quién no tiene registro en 14 días (o, si nadie, los tres con menos), antes de las cifras; cada nombre abre su ficha y lleva a su calendario y a «Registrar seguimiento» con el jugador ya elegido" },
        ],
      },
      {
        titulo: "Las cifras de arriba",
        filas: [
          { que: "Seguimientos", es: "Registros de la temporada de los jugadores de campo del Castilla y, de ellos, «N de M con feedback escrito (%)» y quién deja más registros sin feedback (los tres primeros autores)", cuenta: "Un registro compartido cuenta a cada autor; con menos de 15, tendencia" },
          { que: "Con seguimiento", es: "«N de M» jugadores de campo con algún registro en la temporada, registros por jugador con seguimiento y la mediana por jugador (con los que tienen 0)", cuenta: "Registros de la plantilla ÷ jugadores con registro. La mediana sale de la misma función que en Plantilla (lib/seguimiento, a un decimal), así las dos pantallas dan la misma cifra" },
          { que: "Cobertura · últimos 14 días", es: "Cuántos tienen algún registro en la misma ventana que el aviso (14 días que acaban hoy); debajo, la cobertura de la temporada", cuenta: "Con registro en 14 días ÷ jugadores de campo del Castilla (de la posición filtrada) × 100; verde desde el 80 %, oro desde el 50 %" },
          { que: "Media semanal", es: "Registros por semana completa; el título dice cuántas semanas entran. El Calendario de Seguimiento da otra cifra porque mira sólo las últimas 8", cuenta: "Sólo semanas cerradas de lunes a domingo; la primera (si empezó a media semana) y la actual van aparte. Con una sola semana, «Esta semana»" },
          { que: "Individualización", es: "Registros de modalidad individual ÷ total × 100; el resto, grupales" },
          { que: "Último registro", es: "Hace cuánto fue el más reciente y de quién" },
        ],
      },
      {
        titulo: "Las pestañas",
        filas: [
          { que: "Resumen", es: "Lecturas del periodo (la del foco menos usado nombra, con su enlace, a quién le falta ese objetivo en sus últimos registros, hasta 3; la etiqueta dice su base: «0 de 3» o «0 de 1 · su único registro»), evolución semanal (cada barra partida en individuales, oro, y grupales, gris, la semana en curso rayada, la media en raya y una nota si el pico es de registros grupales; pulsar una barra filtra esa semana y volver a pulsarla lo quita), foco de los objetivos (ofensivo, defensivo, mental), estrategias, el cruce estrategia × momento (con lo más repetido en el título y el total de cada momento en su cabecera) y quién no tiene ningún registro" },
          { que: "Sin seguimiento en 14 días", es: "Va arriba, sobre las cifras: quién no tiene registro en los 14 días que acaban hoy, con los días desde su último; si no hay nadie, los tres con menos", cuenta: "La misma ventana que Calendario y la ficha individual" },
          { que: "Jugadores", es: "Ranking por registros (de cuántos, con la mediana del grupo en raya, semanas cubiertas y días desde el último) con Ficha, Comparativa, Calendario y Registrar en cada fila; mapa jugador × semana, reparto por posición, contactos más antiguos (con sus accesos) y el más y el menos seguido", cuenta: "Pinchar la fila filtra por él" },
          { que: "Metodología", es: "Modalidad individual o grupal, carga por entrenador (un registro compartido suma a cada autor; «TODOS» va en su fila, «Todo el cuerpo técnico»), matriz entrenador × estrategia, distribución mensual y jugadores alcanzados por semana" },
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
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Quién entrena con el grupo", es: "Los ocho con menos sesiones; «Ver los N» abre la lista entera. Quien no tiene ninguna sesión lleva su ficha y «Registrar seguimiento»" },
          { que: "Avisos", es: "Cada aviso lleva Ficha, su acción y Comparativa, con el jugador ya elegido" },
          { que: "Asterisco y tendencia", es: "Junto al título del gráfico: * = minutos de Valoraciones; «N partidos · tendencia» con menos de 3 partidos" },
          { que: "Jugadores del Castilla", es: "La cifra grande es la de licencia del Castilla; los de fuera con minutos se dicen aparte, debajo, y van con su etiqueta (RMC, JUV A…)", cuenta: "«Grupo» deja sólo la licencia del Castilla" },
          { que: "Partidos de liga", es: "Los jugados y los minutos posibles por jugador; si Valoraciones y Wyscout tienen distintos partidos, dice los dos", cuenta: "Partidos × 90, de cada fuente" },
          { que: "Han jugado", es: "Cuántos tienen al menos un minuto" },
          { que: "Minutos sub-21", es: "Parte de los minutos de Wyscout que juegan los de 21 años o menos; pinchando, lleva a «¿Qué edad tiene quien juega?»", cuenta: "Minutos de los sub-21 ÷ minutos de los que tienen edad × 100; el mismo corte que la Comparativa" },
          { que: "Avisos", es: "Cuántas filas de aviso se ven abajo y de cuántos jugadores; pinchando, lleva a su tarjeta", cuenta: "Quien juega poco y además lleva tres partidos sin jugar es una sola fila y cuenta una vez (16/11/2026)" },
          { que: "Quién cuenta", es: "Una línea bajo las cifras explica las poblaciones: el total (licencia del Castilla + los de fuera que han jugado), los que han jugado y de cuántos publica Wyscout la edad" },
        ],
      },
      {
        titulo: "¿Cómo está la plantilla?",
        filas: [
          { que: "Minutos", es: "El título es la conclusión («N de M con la mitad de los minutos o más, K por debajo del 25 %»); debajo, el grupo y la fuente en una línea, y el método en «Cómo se lee». Cada barra dice «804′ de 990′ (81 %)», el mismo cálculo para todos (quien pasa de los posibles por el añadido se queda en el 100 %); con menos de 3 partidos, tendencia. Los de Wyscout sobre los minutos de los partidos que tiene la descarga de Wyscout (lo dice el título, p. ej. 990′ de 11 partidos); sin fila en Wyscout, los de Valoraciones con asterisco, sobre los partidos de Valoraciones. Cada nombre abre su ficha en Plantilla; la barra, su resumen en «¿Cómo está cada uno?»", cuenta: "En naranja, menos del 25 %. Wyscout cuenta el añadido: puede pasar de los posibles. Quien no tiene ni un minuto sale aparte, en «Sin minutos esta temporada», y no en el gráfico" },
          { que: "Cómo se lee", es: "El método largo de cada bloque va plegado bajo su título" },
          { que: "Titular", es: "Marcado como titular en Valoraciones o con los 90′; con uno o ninguno, «tendencia»" },
          { que: "¿De quién hay que hablar esta semana?", es: "Arriba, un semáforo con cada jugador avisado (oro, un aviso; naranja, dos o más). Debajo, juega poco (menos del 25 %), tres partidos sin jugar, carga alta (90 % o más), a una amarilla del ciclo (4, 9, 14…) y nota a la baja; cada fila lleva el nombre a su ficha y el «qué hacer» a un toque: registrar seguimiento, sus valoraciones o sus vídeos, y la carga alta, a Microciclos", cuenta: "Sólo licencia del Castilla; los porteros no entran en los de minutos. Nota a la baja: media de las 3 últimas un punto o más por debajo de la de las 3 anteriores" },
          { que: "¿Qué edad tiene quien juega?", es: "Tramos de edad de Wyscout con su parte de los minutos jugados", cuenta: "Edad media ponderada por minutos" },
          { que: "¿Cuándo acaban los contratos?", es: "Fin de contrato que publica Wyscout" },
          { que: "¿Quién entrena con el grupo desde el 21/10?", es: "Sesiones de cada jugador de campo en Jugadores sesión, de menos a más, y quién del Castilla no sale en ninguna. El periodo va en el título: la lista del día existe desde el 21/10, el resto de la pantalla es la temporada", cuenta: "En naranja, por debajo del 70 % de las sesiones. Los porteros no cuentan (llevan registro aparte), tampoco en las sesiones guardadas antes con ellos dentro" },
        ],
      },
      {
        titulo: "Jornadas, jugador y rendimiento",
        filas: [
          { que: "¿Quién juega cada jornada?", es: "Tabla jugador × partido de Valoraciones con sus minutos", cuenta: "Oro fuerte, titular; oro suave, desde el banquillo; punto, jugó sin minutos anotados" },
          { que: "¿Cómo está cada uno?", es: "Minutos, partidos, goles y asistencias, nota, amarillas, minutos por jornada y accesos a su ficha, su seguimiento (y registrar uno nuevo), sus valoraciones, la Comparativa, sus vídeos, DATA y Hudl, con el jugador ya elegido" },
          { que: "¿Qué hace mejor y peor que los de su puesto?", es: "Sus métricas más altas y más bajas en percentil contra los de su puesto de la liga con 90′ o más (Wyscout)" },
          { que: "¿Cómo le ve el cuerpo técnico?", es: "Mentalidad, hábitos, interpretación, física y técnica de la ficha de competencias, de 0 a 10", cuenta: "Diferencia frente a la media de los que tienen ficha; en gris si es menor de 1 punto" },
          { que: "¿Quién tiene mejor nota de partido?", es: "Nota media de Valoraciones con 3 partidos valorados o más; entre paréntesis, la de los cinco últimos" },
          { que: "¿Quién rinde más para su puesto según Wyscout?", es: "Media de sus percentiles en las métricas de su puesto", cuenta: "50 = la media de la liga; verde desde 60, naranja por debajo de 45" },
          PERCENTIL,
        ],
      },
    ],
    ojo: [
      "Los minutos de Wyscout y los de Valoraciones no coinciden: Wyscout cuenta el añadido y Valoraciones anota 90′ por partido completo.",
      "Cada fuente se mide sobre sus propios partidos (16/11/2026): un partido que Wyscout aún no ha publicado no hunde el porcentaje de nadie.",
    ],
  },
  {
    ruta: "/ratings",
    titulo: "Valoraciones de partido",
    resumen: "La nota que el cuerpo técnico pone a cada jugador en cada partido y lo que sale de ella: ranking, campograma, comparativa e histórico.",
    origen: "Supabase (tabla match_ratings, temporada 2026-2027); los partidos, de la hoja del calendario (la misma que Planes de partido). Minutos, titularidad, goles, asistencias y tarjetas los rellena cada noche BeSoccer (scripts/valoraciones-besoccer.mjs); la nota, las áreas y el comentario, sólo el cuerpo técnico.",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Registrar",
        filas: [
          { que: "Progresión y Goles + asist.", es: "Además del primero, el 2.º y el 3.º (progresión: 3 últimas notas frente a 3 anteriores, sólo si suben)" },
          { que: "Media por línea", es: "La raya discontinua es la media del equipo, rotulada en el borde derecho" },
          { que: "Lectura de «Media por línea»", es: "La línea más baja y la más alta, cada una con su propia base (jugadores y notas de su fila)" },
          { que: "Lectura de «Nota y minutos»", es: "Abre con el mejor de campo; si un portero va por encima, se dice aparte" },
          { que: "Accesos del ranking", es: "Seguimiento, Comparativa y Vídeos como iconos; su nombre, al pasar el ratón. Forma, Tend. y G+A explican su regla al pasar el ratón" },
          { que: "Carga", es: "Las notas se enseñan en cuanto llegan (copia del aparato); los partidos del calendario se suman después. Los contadores de arriba salen sólo cuando hay partidos valorados" },
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
          { que: "Mejor media · de campo", es: "La nota media más alta entre los jugadores de campo con 4 partidos o más (el portero va en «Media por línea»); el pie dice de cuántos" },
          { que: "Progresión y goles + asistencias", es: "Bajo las tarjetas, en una línea secundaria (no en titular): quien más sube (3 últimas notas frente a 3 anteriores, tendencia) y quien más goles + asistencias suma (con 3 o más), cada uno con sus PJ" },
                    { que: "Nombres", es: "Cada nombre (tarjetas, podio, ranking, mejores actuaciones) abre su ficha en Plantilla; el resto de la fila, sus notas" },
          { que: "Evolución del equipo", es: "La media de cada partido: lleno en casa, hueco fuera; la línea de puntos, la media de la temporada; el resultado, con el Castilla primero" },
          { que: "Ranking de la plantilla", es: "Por defecto PJ, Media, Forma, Tend. y G+A en todos los anchos; Tit., Min, Pond., Máx y Mín en «Ver más columnas». Cada fila lleva sus accesos a Seguimiento, Comparativa y Vídeos (con su rótulo en pantalla ancha; en el móvil, el icono); quien tiene menos de 4 PJ lleva la chapa «N PJ · tendencia» junto a su media; filtro Todos, 3+ PJ o 5+ PJ", cuenta: "Pond. = media pesada por minutos; Forma = media de los 5 últimos; Min = minutos de Valoraciones (90′ por partido completo, BeSoccer), por eso no cuadra al minuto con el Dashboard de plantilla (Wyscout); con menos de 4 partidos, fila atenuada" },
          { que: "Nota y minutos · Media por línea · Podio", es: "El título de «Nota y minutos» dice «N de M con 4+ PJ»; cada punto lleva su nombre donde cabe (arriba o debajo) y el que no cabe, al tocarlo. En «Media por línea», la línea con menos de 3 jugadores va con trama (rayas) y «tend.» dentro de la barra. Las marcas de minutos van sin repetirse y con techo redondo. Los de 4 partidos o más en dos ejes, la media de porteros, defensas, medios y ataque, y el podio de la forma (media de los 5 últimos, entre los de 4+ PJ; ya no repite los tres primeros del ranking); la lectura acaba en el último de la lista con «Vídeos», «Registrar seguimiento» y «Ficha»" },
          { que: "Partido a partido · Mejores actuaciones", es: "Marcador con el Castilla primero y V/E/D; el último partido lleva «Análisis post» (Data análisis) y cada uno, «Rival →» con el rival ya elegido" },
        ],
      },
      {
        titulo: "Campograma, comparar e histórico",
        filas: [
          { que: "Campograma", es: "La plantilla en el campo con el color de su nota: media, ponderada, forma o último partido", cuenta: "Rojo por debajo de 5, ámbar hasta 6,5, verde hasta 8 y cian por encima" },
          { que: "Comparar", es: "Varios jugadores a la vez: evolución partido a partido, perfil por áreas y cara a cara" },
          { que: "Histórico", es: "Cada partido con sus notas y comentarios; «Editar valoraciones» lo reabre en Registrar" },
          { que: "Ficha del jugador", es: "Al pinchar a uno: media, últimos 5, mejor partido, minutos, evolución, perfil por áreas, aportación y partido a partido; arriba, accesos a su ficha, seguimiento, registrar seguimiento, Data análisis, vídeos y comparativa", cuenta: "Se abre directa con ?player=JUG-XX o ?jugador=Nombre" },
        ],
      },
    ],
    ojo: [
      "Es la valoración del cuerpo técnico, no una métrica: se lee junto a los datos, no en su lugar.",
      "Lo escrito y sin guardar se copia en el navegador: si el guardado falla o se recarga la página, al volver al partido sale «Recuperarlas» (16/11/2026). Al guardar bien, la copia se borra.",
    ],
  },
  {
    ruta: "/comparative_ind",
    titulo: "Comparativa con la categoría",
    resumen: "Cada jugador del Castilla frente a los de su puesto en la categoría (sub-21, sub-23 o todos), con Wyscout o con Opta: ranking, gráficos por fase, ficha y, según la fuente, contra otros equipos o su evolución por temporadas.",
    origen: "Wyscout: la descarga de jugadores de toda la categoría (esta temporada y la pasada) y, para el ajuste a la posesión, la posesión media de cada equipo en sus partidos de liga de Wyscout. Opta: sus tablas de jugadores de Primera RFEF, todas las temporadas que hay. Al lado, nuestras Valoraciones (nota) y la hoja de seguimiento (nº de registros).",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Qué hacemos", es: "El objetivo va en negrita y la primera tarjeta trae «Por qué» abierto; cada fila del ranking abre también sus vídeos" },
          { que: "Fuente", es: "Wyscout u Opta, cada una con sus pestañas; nunca se mezclan" },
          { que: "Contra", es: "Sub-21 (21 años o menos, edad de Wyscout), sub-23 o toda la categoría" },
          { que: "Puesto", es: "Filtra la tabla y los gráficos, y manda también sobre el jugador abierto; «Contra» y «Puesto» van cada uno en su fila" },
          { que: "?jugador=", es: "Desde la ficha, Valoraciones o el Dashboard se llega con el jugador ya elegido: se abre su ficha" },
          { que: "Población", es: "Bajo los filtros, contra quién y cuántos por puesto; los puestos con menos de 25 comparables se avisan como tendencia (p. ej. Porteros, 8)" },
        ],
      },
      {
        titulo: "Con Wyscout",
        filas: [
          { que: "Ranking · Visual o Detalle (16/11/2026)", es: "El ranking se abre en «Visual»: cada jugador del Castilla en una escala de 0 a 100 con la raya del 50 (la media de su puesto en el grupo elegido), ordenados de más a menos, el punto del color de su índice (bajo el nombre, su puesto en el ranking con los empates como tramo, «2º-3º de 34», y la chapa «tendencia» si su puesto tiene menos de 25 comparables) y, si jugó en la categoría en 25/26, un punto hueco con su índice de entonces unido por una línea. El título dice cuántos de los de 300′ o más están por encima de la media (y cuántos son tendencia), quién es el más alto y cuántos mejoran. Pinchar un jugador abre su ficha; al lado, su ficha de Plantilla, su seguimiento y sus valoraciones. Es lo primero que se ve, antes de las tarjetas de lectura. «Detalle» es la tabla de siempre; se recuerda en este aparato", cuenta: "Mismo índice, filtros y posesión que la tabla. Con punto hueco discontinuo, menos de 300′ (tendencia), que no cuentan en el título. «Mejoran» = más de 3 puntos sobre 25/26 con 450′ o más el año pasado: el mismo criterio que la cifra de arriba" },
          { que: "Índice", es: "Media de sus percentiles en las métricas de su puesto contra los de su puesto del grupo elegido", cuenta: "De 0 a 100; 50 = la media. Con 90′ o más; el portero, sólo contra porteros" },
          { que: "Ranking", es: "Su puesto entre los de su posición del grupo; «2º-3º de 34» = empatado en índice" },
          { que: "Evolución (pts)", es: "Puntos de índice frente a 25/26, cada año contra su categoría", cuenta: "Entre −3 y +3, estable; «nuevo» = sin minutos el año pasado. «Mejoran respecto a 25/26» pide 450′ el año pasado" },
          { que: "Mejoran respecto a 25/26", es: "Bajo las cifras, quiénes son: una barra por jugador con su cambio en puntos, la marca del umbral (+3) y sus minutos del año pasado", cuenta: "Sólo quien tiene índice esta temporada; la tarjeta y la frase del gráfico salen de la misma regla" },
          { que: "Por qué no coinciden las cifras", es: "Bajo el gráfico del ranking, una línea: cuántos tienen índice, cuántos con 300′ o más y cuántos son tendencia" },
          { que: "«Mayor de 21» (o de 23)", es: "Pasa de la edad del grupo y se le coloca entre ellos contando como uno más; por eso su «de N» lleva uno más que el de un compañero del mismo puesto que sí entra" },
          { que: "Tarjetas de lectura", es: "A la vista, el titular y «Qué hacemos» (con la métrica de Wyscout y una tarea con lo que se cuenta); las cifras y el porqué, en «Por qué»" },
          { que: "Móvil", es: "Las filas del ranking visual no llevan iconos: pulsar la fila abre su ficha aquí" },
          { que: "Tarjetas de lectura", es: "Titular, el dato y qué hacemos (una tarea de campo con algo que contar y su objetivo); el porqué, plegado. «Lo que más cae» deja fuera métricas ajenas al puesto (los remates de un central). Cada una lleva a su ficha aquí y a su ficha, vídeos y registrar seguimiento" },
          { que: "Ir a (Detalle)", es: "En la tabla, cada fila lleva a su ficha, sus valoraciones y su seguimiento" },
          { que: "Nota · Nº seguim.", es: "Su nota media en Valoraciones y sus registros de seguimiento", cuenta: "Los porteros no cuentan registros de seguimiento: llevan uno independiente" },
          { que: "Gráficos por fase", es: "Una pregunta por fase del juego o dos métricas a elegir; las líneas son las medianas del grupo elegido", cuenta: "Se ve como dispersión, mapa de élite o ranking; con porteros arriba, sólo lo de portero" },
          { que: "Extremos · ¿conector o regateador? (18/11/2026)", es: "En los gráficos, fase «Con balón», con Bandas o todos los puestos arriba: un plano con cada extremo del grupo elegido. A la derecha, cuánto encara (regates intentados por 90); arriba, cuánto conecta (pases al último tercio + pases progresivos, por 90). Las líneas del 50 lo parten en «conecta por dentro», «encara», «hace las dos cosas» y «poco de ambas». Los nuestros, en dorado y siempre a la vista; el título dice en qué cuadrante cae el elegido (con varios, se cambia con sus botones) y debajo va cada uno en texto", cuenta: "Extremo = primera sigla de Wyscout de banda (LW, RW, LWF, RWF, LAMF, RAMF); el mediapunta centrado no entra. Cada eje es el percentil contra los extremos de esta temporada con 90′ o más y la edad del grupo (sub-21, sub-23 o todos); el nuestro que pasa de la edad se coloca contra ellos. Hacen falta al menos 5 en el grupo" },
          { que: "Ficha del jugador", es: "Radiografía de percentiles, los mejores del puesto en la categoría y la proyección edad-nivel; la cifra grande del índice sólo sale si lo tiene; arriba, sus accesos (ficha, seguimiento, registrar, valoraciones, Data análisis, vídeos)" },
          { que: "Contra otros equipos", es: "Uno de los nuestros frente a los de su puesto de los equipos que elijas, con 90′ o más. La fila «Índice del puesto» sólo sale si alguno lo tiene; la celda sin índice va vacía", cuenta: "Percentil contra todos los de su puesto de la categoría con 90′ o más. Debajo de los equipos elegidos, «Plantilla de …» abre ese rival en Plantillas rivales" },
          { que: "Ajustar a la posesión", es: "Interruptor en el ranking, en la fase «sin balón» de los gráficos y en la ficha: acciones defensivas, duelos defensivos, entradas, interceptaciones y remates bloqueados por 90 de cada jugador, nuestro o de la categoría, se llevan a un reparto del balón a medias. Percentiles, índice, ranking y gráficos se recalculan con la cifra ajustada; la ficha enseña la de Wyscout y la ajustada con sus dos percentiles", cuenta: "Ajustada = por 90 × 50 / (100 − posesión media de su equipo en la liga esa temporada, sin amistosos). Con un 60 % de balón, ×1,25. Los porcentajes no se tocan; un equipo sin partidos en la descarga (el otro grupo) se queda sin ajustar" },
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
    origen: "Nuestro once: el de la pizarra táctica (tablero «Once 4-2-3-1», si es de este rival y tiene siete casados); si no, nuestro último once de Valoraciones; si no, el propuesto con los minutos de Wyscout. Su once: el marcado en Plantillas rivales; si no, su último once de BeSoccer; si no, los de más minutos, siempre sin sus bajas. Métricas: descarga de jugadores de Wyscout de toda la categoría. Posesión de cada equipo: media de sus partidos de liga de esta temporada en Wyscout. Zona de robo: «opta:jugadores» (Opta). Carril de su extremo: evento a evento de Opta de sus últimos partidos («opta:directo:<partido>»). Nombres: los nuestros con el nombre corto de la plantilla (el mismo de la pizarra); los suyos, con nombre y apellido si dos comparten apellido. Lo cambiado a mano se guarda por rival (documento «duelos:<rival>»). Segunda jugada: evento a evento de Opta de los últimos partidos del rival y del Castilla («opta:directo:<partido>»).",
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Lo nuevo (19/11/2026): la segunda jugada tras el balón largo",
        filas: [
          { que: "Su once (21/11/2026)", es: "Sin once marcado en Plantillas rivales, el mismo once probable que enseña /rivals: el que propone el motor con sus últimos onces (y lo jugado esta temporada), en el dibujo elegido en Plantillas, si no el más usado en Wyscout, si no el que más repite en BeSoccer. Cada uno va al bloque que le da el campograma de /rivals y de ahí a nuestro 4-2-3-1; la doble punta, el central del medio de una línea de tres o un segundo jugador en el mismo bloque van al hueco libre más cercano. Con once marcado, el marcado. Lo cambiado aquí manda sobre todo. La fuente se dice bajo «Once de …» («Su once probable de Plantillas rivales en 4-2-3-1, propuesto con sus últimos 5 onces: nadie lo ha marcado»)." },
          { que: "Ajustado a la posesión", es: "Interceptaciones por 90′ × 50 / (100 − posesión media de su equipo en sus partidos de liga, Wyscout): las lleva a un partido con el balón a medias. Con más del 50 % de balón el equipo defiende menos rato y el ajuste SUBE la cifra (56 %: defiende el 44 %, 8,4 × 50 / 44 = 9,5); con menos del 50 % defiende más rato y el ajuste la BAJA (39 %: 3,2 × 50 / 61 = 2,6). La frase de la tarjeta dice hacia dónde va en cada equipo." },
          { que: "Robador oculto", es: "P80 o más ajustado y por debajo de P80 en bruto: el que corta mucho en el poco rato que su equipo defiende (equipo de mucha posesión)." },
          { que: "Objetivo de la consigna", es: "En la misma unidad que la tarea. Si el duelo se gana y nuestro jugador ya está en P95 o más: «que mantenga su acierto de pase (su cifra de hoy, en %)». Por debajo de P95: «que no baje de su cifra de hoy» (con su percentil). Si se pierde: que el suyo no pase de la mediana de su puesto (P50), con su percentil y su cifra de hoy. «(percentil contra su puesto, Wyscout)» sólo sale cuando el objetivo lleva percentil." },
          { que: "Qué hacemos · el que decide", es: "El duelo de más peso con consigna va el primero, rotulado «el que decide, como en el Plan»" },
          { que: "Quién nos roba el balón · enlaces", es: "Cada fila con «Su ficha y vídeo» en Scout individual" },
          { que: "Segunda jugada · nombres", es: "Los de Opta se escriben con el nombre corto del once; sin cruce o con sólo la inicial, con el de nuestra plantilla" },
          { que: "Nombres en el campo", es: "Cada nombre se aparta de los demás y de las fichas, y lleva un halo del color del césped para leerse sobre las rayas" },
          { que: "Segunda jugada · nombres y escala", es: "Los nombres de Opta se escriben como en la plantilla (Flakus, Óscar); bajo cada mapa, la escala de color de 1 al máximo de primeros toques por casilla" },
          { que: "Fichas de cada duelo", es: "Bajo cada duelo, la ficha de nuestro jugador (Individual) y la del suyo con sus vídeos" },
          { que: "Modo día (19/11/2026)", es: "Las cifras en oro de la segunda jugada se escriben en el oro oscuro, legible sobre blanco" },
          {
            que: "Segunda jugada · tras el balón largo, ¿quién se queda el balón?",
            es: "Debajo de los onces, dos tarjetas. La del rival: qué parte de las segundas jugadas de sus balones largos se queda él, el mapa de calor de dónde cae el primer toque (visto desde quien lanza: a la derecha, nuestra portería), la zona del mediocentro en discontinua y sus tres jugadores que más las recogen. La del Castilla cuando defiende balones largos: qué parte ganamos, dónde caen, qué parte ganamos en la zona del mediocentro (por debajo de la mitad: «necesita ayuda en la caída») y nuestros tres que más las recogen. Arriba, el chip dice si el rival es de juego directo",
            cuenta: "Opta, evento a evento (opta:directo:archivo y opta:directo:<partido>) de los últimos 8 partidos de cada equipo. Balón largo: pase en juego o saque de puerta (no de banda) de 32 m o más y al menos 10 de x de Opta hacia delante (x 0-100 = 105 m, y 0-100 = 68 m). Segunda jugada: el primer toque de cualquiera de los dos en los 5 s siguientes, en la misma parte; el duelo aéreo no cuenta (es la disputa), sí lo que viene detrás; con falta antes o sin toque en 5 s, no entra. Zona del mediocentro: pasillo central (y 37-63) entre el medio campo y el borde del área de quien defiende (x 50-83, en el marco de quien lanza). Juego directo: su parte de pases largos sobre sus pases en juego, al menos 1,15 veces la de sus rivales en esos mismos partidos. Con menos de 15 segundas jugadas no se pinta. Cuentas en lib/duelos-segunda-jugada.ts",
          },
        ],
      },
      {
        titulo: "Lo nuevo (18/11/2026): las visuales de las ideas de X",
        filas: [
          { que: "En todas", es: "Misma idea visual que la publicación de X de la que salió, con la letra del club (Barlow Condensed) en el titular y las cifras, la tarjeta de la app (canto y sombra, día y noche) y una entrada suave. Los datos y las cuentas no cambian" },
          { que: "¿Extremo de banda o falso extremo? · por dónde toca en campo rival", es: "En los dos duelos de nuestro lateral contra su extremo, debajo de «Su extremo en el regate»: una franja con la parte de sus toques en campo rival por el pasillo exterior (azul), el carril intermedio y el pasillo central (naranja), con la raya de la mitad. Si más de la mitad cae dentro, la tarjeta lleva bajo el título «Falso extremo: se va hacia dentro · se lo encuentra <nuestro pivote de ese lado>» y la franja lo explica (el lateral no sale a perseguirlo y guarda su espalda); si no, «Extremo de banda · 1c1 con el lateral». Con «Balón: Castilla» no se enseña", cuenta: "Opta, evento a evento de sus últimos 8 partidos guardados (opta:directo:archivo y opta:directo:<partido>), sólo los partidos en los que su extremo fue titular. Toque = la regla del directo (sin faltas, córners ni entradas fallidas); campo rival = x > 50. Carriles en el ancho de Opta: exterior y < 21 o y > 79; central de 37 a 63; intermedio, entre medias. Falso extremo = intermedio + central > 50 %. El jugador se casa por nombre (el de la hoja y el de Wyscout) entre los de su equipo en Opta; con menos de 30 toques no se pinta. El pivote del lado: el de nuestro hueco «pivote derecho» si el duelo es de nuestro lateral derecho, «pivote izquierdo» si es del izquierdo. Cuentas en lib/duelos-carril.ts" },
          { que: "Su extremo en el regate", es: "Como el original de X: la zona buena del regate (más intentos que la media y por encima del acierto medio) sombreada en oro, su extremo con un aro grande y su nombre en la letra del club, y el cuadrante y el % de duelos de nuestro lateral en cifra grande" },
          { que: "Quién nos roba el balón", es: "Como las fichas «Moneyball» de X: cada jugador en su tarjeta con su percentil ajustado grande arriba a la derecha (P en bruto debajo del nombre) y el titular con la conclusión" },
        ],
      },
      {
        titulo: "Lo nuevo (17/11/2026, ronda 21)",
        filas: [
          { que: "Su once, un titular por hueco", es: "Sus titulares se reparten entre los once puestos de su dibujo de uno en uno, con la misma cuenta que el campograma de Plantillas rivales: ya no salen dos en el mismo puesto con otro vacío (dos laterales derechos y nadie en el extremo izquierdo)", cuenta: "asignaTitulares en colocacionDelOnce (lib/rivals/colocacion-once.ts); el dibujo, el guardado con el once (al sugerirlo en Plantillas, el sistema más usado según Wyscout)" },
        ],
      },
      {
        titulo: "Lo nuevo (17/11/2026, ronda 20)",
        filas: [
          { que: "Tira de accesos del rival (17/11/2026)", es: "A la vista, el vídeo del rival (sus goles, cómo le marcan, su último partido), ⬇ Clips de Hudl si los hay, Plan de partido, Duelos y ABP; el resto de pantallas del rival, en «Más», con el rival ya puesto" },
          { que: "Dónde les podemos hacer daño / Dónde nos pueden hacer daño", es: "Cada duelo abre con los jugadores («Leiva vs Jorge Mier»), sus minutos de Wyscout y la cifra en la misma línea; el puesto («nuestro extremo izquierdo vs su lateral derecho») va debajo. Bajo cada uno, «su ficha y vídeo» de cada rival en Scout individual" },
          { que: "Qué hacemos", es: "Los tres duelos con nombre delante y el puesto y los minutos debajo, con el mismo rótulo que las cajas" },
          { que: "Titular", es: "«8 duelos medidos, cada uno con nuestro balón y con el suyo»: cada duelo cuenta en los dos momentos; desde ±10 de diferencia de percentil, como en el Plan de partido" },
          { que: "En el móvil", es: "La lista de duelos va antes que el campo; los nombres del campo, más grandes en escritorio" },
        ],
      },
      {
        titulo: "Arriba",
        filas: [
          { que: "Rival", es: "Abre con el próximo partido; el desplegable va con la jornada delante" },
          { que: "Tira de accesos del rival", es: "Bajo el título, con el rival puesto: ▶ Sus goles en vídeo, ▶ Cómo le marcan y ▶ Su último partido (en una ventana, sin salir; aparte, «Cómo son sus goles ›» abre Análisis de goles), ⬇ Clips de Hudl si sus jugadores los tienen (17/11/2026), Plan de partido, Plantilla, Colectivo, Individual, ABP, Área, Pizarra táctica y Pizarra ABP. En el móvil, una fila que se desliza" },
          { que: "Nombres de los jugadores", es: "En el campo, en las tarjetas y en «quién nos roba» abren su ficha: los nuestros en Individual y los suyos en Scout individual con sus cortes filtrados" },
          { que: "Balón: Castilla · Balón: rival · Los dos", es: "Qué momento pintan el campo, las cajas y las tarjetas" },
          { que: "El recuento", es: "Duelos medidos y, aparte, los de pocos minutos (menos de 450′ en un lado: tendencia), con la misma frase que el Plan de partido (17/11/2026). Dice el umbral: cuenta desde ±10 de percentil, y «Dónde les podemos hacer daño» lleva todos los de +10 o más con nuestro balón, también los de doble cara (por eso puede tener más de los que dice «para buscar»)" },
          { que: "Qué hacemos", es: "El duelo que buscamos (el de más ventaja con nuestro balón) y los dos que vigilamos (los de más riesgo con el suyo), con una orden de una línea, «Qué entrenamos» (la tarea, qué se cuenta en ella y el objetivo de la mediana de su puesto, en la misma unidad: «1 contra 1 defensivo en banda, contando regates ganados %; objetivo: que Jorge Mier no pase de P50…») y los minutos; pinchando uno se abre su tarjeta, donde va la consigna entera" },
        ],
      },
      {
        titulo: "Cómo se mide",
        filas: [
          { que: "P73", es: "Percentil de cada uno contra los de su puesto en la categoría con 90′ o más (Wyscout)", cuenta: "Hacen falta 5 comparables; un porcentaje de muy pocas acciones no cuenta" },
          { que: "Faceta", es: "Lo que hace con balón el que ataca contra lo que hace sin balón el que defiende (regate contra duelo defensivo…)", cuenta: "Percentil nuestro − suyo (media si son dos); ventaja desde 15 puntos" },
          { que: "Duelo", es: "Media de sus facetas en los dos sentidos y, donde toca, por arriba", cuenta: "Ventaja o desventaja desde 10 puntos. La altura pesa sólo donde se juega por arriba: 3 puntos por cm, tope ±20" },
          { que: "Se anulan", es: "Gana con un balón y pierde con el otro por 10 o más: manda la suma, y si queda por debajo de 10, se anulan" },
          { que: "Con pocos minutos", es: "Con menos de 450′ de Wyscout en un lado el duelo no se destaca: va plegado al final y es tendencia. En «quién nos roba», quien tiene menos de 450′ va plegado con el resto, nunca en la lista" },
          { que: "Uno sin minutos en el hueco", es: "Si en un hueco de dos (el doble pivote) uno no tiene minutos en Wyscout, la tarjeta lo dice: «Sergio también está en este hueco, sin minutos en Wyscout: la cifra es sólo de Cestero»" },
        ],
      },
      {
        titulo: "Lo que se ve",
        filas: [
          { que: "El campo", es: "Los dos onces enfrentados (nosotros atacamos hacia la derecha) con la línea de cada duelo en su color; pinchando uno, baja a su tarjeta. En el móvil, sólo el dorsal: tocando una ficha sale su nombre y su puesto" },
          { que: "Medular +N / −N", es: "Nuestro doble pivote contra el suyo, en diferencia de percentil: + gana el Castilla, − gana el rival; entre −10 y +10, parejo" },
          { que: "Puesto de cada jugador", es: "El del hueco en que le pone el once (lib/posiciones.ts); si no es su puesto de origen, los dos: «extremo izquierdo en el once (lateral derecho de origen)»" },
          { que: "999′ / 885′", es: "Minutos en Wyscout del que menos ha jugado de cada lado, nuestro / suyo; con menos de 450′ en un lado, «tendencia»" },
          { que: "Qué le decimos · Qué entrenamos · Objetivo", es: "Sólo en la tarjeta del duelo, en tres renglones; «Qué entrenamos» es la tarea de 1 contra 1 que mide esa acción. La consigna para el jugador, sacada del enfrentamiento de más diferencia de ese momento (el mismo de las barras; con su balón, el que más pierde), con sus dos percentiles, la tarea y un objetivo medible", cuenta: "Objetivo: que el suyo no pase de la mediana de su puesto (P50) en esa métrica, o que el nuestro siga por encima de su percentil" },
          { que: "Dónde les podemos hacer daño · Dónde nos pueden hacer daño", es: "Los duelos que ganamos con nuestro balón y los que perdemos con el suyo, de mayor a menor" },
          { que: "Alineaciones", es: "Los dos onces hueco a hueco, cada uno con su fuente; se cambian aquí sin tocar el once de Plantillas", cuenta: "«Volver a la propuesta» deshace lo cambiado" },
          { que: "Cuando nos atacan · En el centro del campo · Cuando atacamos", es: "Plegadas: las tarjetas por zona, cada faceta con el valor de verdad debajo y el uno contra uno de cada pareja" },
          { que: "Su once", es: "Cada uno en el bloque del campograma de Plantillas rivales (colocacionDelOnce de lib/rivals: su dibujo, lo jugado esta temporada y lo puesto a mano), pasado a nuestro 4-2-3-1; lo cambiado aquí, por encima de todo. Su puesto, con puestoDelRival: el mismo texto de /rivals y del Scout colectivo" },
          { que: "Rótulo de la ficha", es: "El del hueco del tablero (LD, DFC, MC, MP, ED, EI, DC); el nombre de los nuestros debajo y el de los suyos encima, y si chocan dos rótulos, uno se aparta. En el móvil, sólo el dorsal y, encima del campo (es lo primero que se lee), la lista de parejas con las dos cifras de cada duelo (con balón y sin él), las mismas de «Qué hacemos», o «tendencia» con pocos minutos. El centro del campo va en la leyenda" },
          { que: "Nombres repetidos", es: "Si el nombre corto de uno de los nuestros es también el de alguien de su once («Joan» y Joan Rojas), sale con nombre y apellido" },
          { que: "Sin pareja en nuestro 4-2-3-1", es: "Quien en su dibujo cae fuera de sitio: ese duelo no se mide" },
          { que: "Su extremo en el regate", es: "En la tarjeta de los dos duelos lateral contra extremo (con su balón o con los dos): los extremos de la categoría (LW, RW, LWF, RWF, LAMF, RAMF de Wyscout, esta temporada, 90′ o más) en un plano de regates intentados/90 (eje X) contra completados/90 (eje Y), con su extremo resaltado y su nombre; al pasar por un punto sale quién es. Al lado, el % de duelos defensivos ganados de nuestro lateral frente a la media de los laterales de la categoría", cuenta: "Completados/90 = Regates/90 × «Regates realizados, %». La vertical es la media de intentos de los extremos; la diagonal, el acierto medio de la liga (completados totales / intentados totales). Cuadrantes: más intentos y por encima de la diagonal, desequilibrante; más intentos y por debajo, insistente poco eficaz; menos y por encima, selectivo eficaz; menos y por debajo, no regatea. Si es desequilibrante y nuestro lateral está por debajo de la media de su puesto, el duelo va en rojo (borde de la tarjeta y línea del campo): doblar la vigilancia de esa banda. Un % de muy pocas acciones no cuenta" },
        ],
      },
      {
        titulo: "Quién nos roba el balón",
        filas: [
          { que: "La lista", es: "A la vista sólo quien roba: los robadores y los de 450′ o más de la mitad alta de su puesto (P50 o más), ordenados por su percentil ajustado, cada uno con una barra de percentil y la raya del robador (P80). El resto de su once (roba poco o tiene pocos minutos), plegado debajo. Acaba en una orden (no conducir hacia el que más corta)", cuenta: "Interceptaciones/90 de Wyscout × 50 / (100 − posesión media de su equipo). Sin posesión de su equipo en Wyscout, se enseña en bruto y no se marca" },
          { que: "P85 (P60 en bruto)", es: "Percentil contra los de su puesto en la categoría con 90′ o más, todos ajustados con la posesión de su equipo; entre paréntesis, el de la cifra sin ajustar", cuenta: "Hacen falta 5 comparables; los de equipos sin posesión en Wyscout no entran" },
          { que: "Robador · Robador oculto", es: "Robador: P80 o más ajustado. Oculto: además, en bruto queda por debajo del P80; es el que corta mucho en un equipo que casi no tiene el balón. Los que no tienen cifra ajustada van al final de la lista" },
          { que: "tendencia · 234′", es: "Con menos de 450′ en Wyscout no se marca a nadie como robador: el percentil sale de muy pocos partidos" },
          { que: "Roba sobre todo… · tendencia", es: "El reparto por zonas con menos de 15 recuperaciones va marcado como tendencia" },
          { que: "P84 ajustado a la posesión (P79 en bruto)", es: "El robador oculto, con sus dos percentiles" },
          { que: "Roba sobre todo…", es: "En qué tercio gana más balones en la temporada (en nuestra salida, en el centro del campo o en su tercio propio) y qué parte de sus recuperaciones es", cuenta: "PosWonA3rd, PosWonM3rd y PosWonD3rd de Opta; con menos de 5 o sin cruce de nombre, no se pone" },
          { que: "Si se lo roban (en cada tarjeta)", es: "En el bloque «Balón: rival» de cada duelo, la misma cifra, percentil, marca y zona de los suyos de ese duelo" },
        ],
      },
    ],
  },
  {
    ruta: "/analisis-goles",
    titulo: "Análisis de goles",
    resumen: "Lo primero, los goles del equipo elegido (el próximo rival por defecto) en el campo y en vídeo; debajo, sus goles y los de toda la liga por tramos de minutos, en casa y fuera, con remates y xG al lado, quién marca primero, cómo llega cada gol y la ficha técnica de los nuestros.",
    origen: "Goles, minutos y marcadores: BeSoccer, todos los partidos de liga. Remates, a puerta y xG por partido: Wyscout (sin minuto). Remates por minuto, tipología, corte de vídeo y enlace de cada gol: el timeline de Hudl de nuestros partidos. «En el campo»: los remates uno a uno de Opta (doc opta:remates). Lo cambiado a mano se guarda en Supabase («goles:tipologia-manual» y «goles:tecnico-manual»). Se rehace cada noche en el ordenador del club (scripts/goles-liga.mjs).",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Lo primero: sus goles en el campo y en vídeo (18/11/2026)",
        filas: [
          { que: "¿Cuándo marca y cuándo encaja?", es: "El número va fuera de cada barra, en el color del texto; «*» = tendencia, menos de 5 goles" },
          { que: "Accesos", es: "Arriba, antes del campo: su ABP, su plan de partido, su plantilla; con el Castilla, también el plan del próximo partido" },
          { que: "¿Dónde está en la liga? · titular", es: "Titular de una frase; el equipo más parecido, debajo del gráfico" },
          { que: "Cabecera", es: "Sello fijo: «BeSoccer hasta la Jn · Opta hasta el día del último partido de Opta»" },
          { que: "Sólo goles", es: "Filtra el campo y la lista; las tarjetas siguen siendo de todos los remates y una línea lo dice" },
          { que: "Franjas", es: "Letra mínima de 11 px. El tramo que más pesa con menos de 5 goles va con borde discontinuo y «*» (tendencia); la leyenda explica 45+′ y 90+′ (el añadido de cada parte)" },
          { que: "¿Dónde está en la liga?", es: "Bajo la nube, plegada, la lista de los equipos con sus goles a favor y en contra por partido; tocar uno lo elige" },
          { que: "Tarjetas de remates", es: "Salen siempre de todos los remates (del partido elegido, si lo hay); «Sólo goles» filtra el mapa y la lista, no las cifras. «Por partido» divide entre los partidos de la selección" },
          {
            que: "Qué es",
            es: "Arriba del todo, con el equipo elegido (el próximo rival si no se elige otro o no llega ?equipo= en el enlace): sus goles en el campograma de remates de Opta y, pegado (a la derecha; en el móvil, debajo del campo), el reproductor «Ver de seguido los N goles» con la lista para ver uno suelto. Pinchar un gol en el campo lo reproduce; si ese gol aún no tiene vídeo, se dice. Antes eran la pestaña «En el campo» del Detalle y «Sus goles en vídeo» al final de Visual: ahora es un solo bloque y lo de abajo (Visual o Detalle) es el detalle",
            cuenta: "Mismos datos que antes: remates de Opta (opta:remates) y, para el vídeo, el corte de Opta (opta:goles-video) o el resumen de la RFEF con el segundo marcado por Gemini. Los goles en propia puerta no son remates y no salen",
          },
          {
            que: "Filtros del bloque",
            es: "Sus goles / Los que encaja (con ?lado=contra abre en los que encaja), En jugada / A balón parado (la situación del remate en Opta), Temporada / Últimos 3 / Últimos 5; y, del campograma, «Todos los remates / Sólo goles» y el partido. Pinchar un gol también da el remate y «Ver en Opta» / «Ver en Wyscout»",
          },
          {
            que: "El titular",
            es: "Cuántos goles marca (o encaja), cuántos desde dentro del área y cuántos en jugada, con la base al pie (partidos de Opta y «tendencia» por debajo de 15)",
            cuenta: "Dentro del área: remate con x ≥ 83 y y entre 21,1 y 78,9 en las coordenadas de Opta (0-100, atacando hacia la portería rival). En jugada: situación «Open play» o «Fastbreak/Counter»; el resto, balón parado",
          },
          { que: "?vista=campo", es: "Los enlaces de otras pantallas que lo traen siguen valiendo: abren con el equipo y el lado pedidos arriba (y el Detalle, en Resumen)" },
        ],
      },
      {
        titulo: "Mandos",
        filas: [
          { que: "Equipo y Condición", es: "Cualquier equipo de la liga, con el Castilla y el próximo rival arriba del desplegable; sin elegir, el próximo rival (18/11/2026). Todos, Casa o Fuera (también desde la dirección, ?lugar=casa)" },
          { que: "Cambiar jornadas y franjas", es: "Desde y hasta qué jornada, franjas de 5, 10, 15, 30 o 45′, tramos a medida («20, 45, 70») y «Descuentos aparte»" },
          { que: "45+ y 90+", es: "Los descuentos; sin «Descuentos aparte», cuentan en la última franja de cada parte" },
          {
            que: "Visual · Detalle (16/11/2026)",
            es: "La pantalla se abre en «Visual» (17/11/2026, ronda 20: primero «A un toque» y las dos láminas; la frase del balance va debajo, con «La liga: media por partido de los 20 equipos, J1–J12»; el titular de los anillos lleva su base, «28 de 29 goles con su tipo, tendencia (12 partidos)»; en el móvil la nube sólo rotula al equipo elegido, sacado del grupo con una línea guía, y el próximo rival va al pie con sus dos cifras; para el Castilla, «A un toque» suma cómo marca el próximo rival, cómo le marcan y su ABP): cada una con su conclusión en el título, las franjas en espejo (a favor arriba, en contra abajo, con la raya de la liga), la nube de la liga (17/11/2026: su propio titular, dónde está y el equipo que más se le parece en las dos cifras; el lienzo mide lo que su caja, letra de 11 px como mínimo, las rayas son las MEDIAS de la liga como en la frase, nombre sólo del elegido en oro, del próximo rival en azul y de los dos extremos, y las esquinas dicen «Marca más, encaja menos» y «Marca menos, encaja más»; pinchar un escudo cambia de equipo) y, para el Castilla, cómo llegan los goles: los anillos cuentan los goles del marcador, con los que no tienen su jugada en Hudl en gris y su número («10 de 15 con su tipo · 5 en gris») y los partidos al lado (tendencia por debajo de 20); cada gol de la línea de minutos abre su vídeo, Hudl y el análisis de ese partido. Debajo de la frase, «A un toque»: para un rival, su ABP, su plan de partido con el rival puesto, su plantilla y, si es el próximo, «De un vistazo»; para el Castilla, el post del último partido, nuestro ABP y el histórico. Los goles en vídeo ya no van al final: están arriba del todo, con el campo (18/11/2026). «Detalle» es la pantalla de siempre con sus pestañas (Resumen, Minutos, Casa y fuera, Cómo llegan y Gol a gol; «En el campo» subió arriba). La elección se recuerda en este aparato (16/11/2026)",
            cuenta: "Mismos filtros de arriba. Nube: goles a favor y en contra entre partidos de cada equipo en las jornadas y la condición elegidas; el título compara con la media de los equipos (la misma de la frase de arriba): a menos de 0,1 por partido, «como la media». Título de las franjas: el tramo con más goles (si empatan tres o más, no se nombra) y, con menos de 20 partidos, «tendencia»",
          },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "Partidos", es: "Los del equipo en el tramo; si al Castilla le falta alguno del calendario, «N de M» y qué jornada falta" },
          { que: "Goles a favor y en contra", es: "Del marcador de cada partido, con la media de los equipos de la liga", cuenta: "Goles ÷ partidos; liga = goles ÷ (partidos × 2), o ÷ partidos con casa o fuera" },
          { que: "La frase de arriba", es: "Cuántos goles en cuántos partidos (y de qué jornadas), a favor y en contra, y si marca y encaja más o menos que la media; con su fuente (BeSoccer y Hudl). Sólo sale con todos los partidos dentro" },
          { que: "Nuestro mejor tramo / tramo más débil", es: "El que más se separa de la liga marcando (o encajando), en verde o naranja sólo desde 6 goles en ese tramo; con menos, «Más goles a favor / en contra» en neutro, con su base y «tendencia»", cuenta: "Goles del tramo ÷ partidos − lo de un equipo medio de la liga en ese tramo" },
          { que: "Nuestros goles, tramo a tramo", es: "El título dice de quién son los partidos (equipo, casa o fuera, cuántos y qué jornadas); el pie, las franjas y cuántos goles hay arriba y abajo" },
          { que: "Qué hacemos y qué concedemos", es: "Las frases que salen de las cifras: goles, tramos y resultados frente a la media de la liga; cómo llegan los goles en contra, de nuestros partidos (Hudl) y sin orden de la semana. En la banda se dice de quién es («su banda derecha, nuestro lado izquierdo»)", cuenta: "Un tramo con 3 goles o menos sale como «tendencia», sin afirmar que marca o encaja más que la liga, y se vigila; desde 4, tarea" },
          { que: "¿Qué pasa cuando marcamos primero?", es: "Cómo acaban los partidos según quién abre el marcador, frente a la liga en la misma situación", cuenta: "Pts/PJ = (3 × G + E) ÷ PJ; con menos de 5 partidos, «tendencia» junto al nombre de la fila (en el móvil, con G, E y P debajo). La frase sólo dice «remontamos más que la media» o «sabemos cerrar» desde 10 partidos en esa situación; con menos, la cifra y «tendencia»" },
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
          {
            que: "En el campo (arriba del todo desde el 18/11/2026)",
            es: "Los goles del equipo elegido (cualquiera de la categoría), a favor o en contra, en el campograma de remates: de un partido o de todos. Pinchar un gol (en el campo o en la lista) da el remate, «Ver el resumen (YouTube)» y «Ver en Opta» / «Ver en Wyscout». Encima, «Ver de seguido los N goles»: los goles uno tras otro con el vídeo de la retransmisión de Opta (10 s antes y 6 después), con «Anterior» y «Siguiente»; el gol que aún no lo tiene va sobre el resumen de la RFEF y los que no tienen ninguno de los dos se cuentan aparte. Se abre ya con un equipo desde la dirección (?vista=campo&equipo=NOMBRE, y &lado=contra para los que encaja): así llegan la portada, Plantillas rivales, Scout colectivo y el Plan de partido",
            cuenta: "Punto = sitio del remate; tamaño = xG. El resumen es el del canal de la RFEF de ese partido (/api/rivals/resumenes), cruzado por los dos equipos y la fecha (lib/rivals/resumen-de-partido.ts; «Real Madrid II» de Opta = Castilla): abre el partido resumido, no el segundo del gol, que la RFEF no trae. Para «Ver de seguido», el ordenador del club baja de Opta ProVision el corte de cada gol a 720p y lo guarda en B2 (scripts/opta-goles-video.mjs, documento opta:goles-video; primero el Castilla, el Murcia, los próximos rivales y el resto del grupo). De respaldo, Gemini marca cada noche el segundo de cada gol en los resúmenes (scripts/rfef-goles-resumenes.mjs, documento rfef:goles-resumenes; con el mismo orden) y sólo vale un resumen si salen tantos goles como su marcador; el gol de Opta se ata al del resumen por equipo y orden. «Ver en Opta» abre el Event Log del partido filtrado a ese segundo y esa parte, con el vídeo de la fila abierto (lib/opta-video.ts); si Opta no tiene el vídeo de ese partido, ProVision lo dice. Wyscout no deja enlazar un clip: su botón abre la plataforma y copia el partido y el minuto. Los goles en propia puerta no son remates y no salen",
          },
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
    origen: "Nuestros resultados: el calendario de BeSoccer («castilla:calendario»). Puesto y totales: la tabla más reciente del informe de rivales (BeSoccer). La media de la liga y el puesto de cada jornada: todos los partidos de liga de BeSoccer («goles:analisis»). El informe de Power BI sólo está en esta ayuda (abajo): la pantalla no depende de él.",
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "Siguiente partido y próximo rival", es: "El próximo según la regla de la portada (fecha y hora de Madrid de BeSoccer, 2,5 h de gracia), ya no el primero sin marcador. También sale de aquí la distancia en puntos con el próximo rival en el título de la tabla." },
          { que: "Una sola fuente para el titular y las tarjetas", es: "El titular («6º de 20 con 19 puntos tras 12 jornadas»), las cuatro tarjetas de «Clasificación y marcadores» y la frase «Siguiente: J13…» salen ahora del mismo sitio que las láminas: el calendario de BeSoccer y la liga entera (goles:analisis), que se ponen al día cada noche. El puesto es el de la tabla calculada con todos los partidos de la liga hasta nuestra última jornada (desempate: diferencia de goles y goles a favor)." },
          { que: "Si una fuente va atrasada", es: "La clasificación guardada en los informes de rival sólo se renueva cuando se regenera un informe y podía quedarse jornadas atrás. Manda la más nueva: si los informes llevan más partidos que el calendario, se usan ellos (y la línea de encima de las tarjetas dice «tras N partidos»); si no, el calendario. Si la tabla de nuestra última jornada no está completa, no se da puesto y la tarjeta «Puesto» no sale." },
          { que: "Datos hasta la J·", es: "Debajo del título, el sello «Datos hasta la J12 · rival · fecha · 12 partidos»: el último partido nuestro con marcador en el calendario de BeSoccer, como en el resto de pantallas del área." },
          { que: "Cada jornada de la racha", es: "Cada casilla de «¿Cómo va la racha?» (y la jornada en la tabla de «Detalle») abre el post de ese partido en Análisis de datos (/data-analisis?area=post con su fecha y su rival)." },
          { que: "Puntos acumulados", es: "La comparación con la media se dice una vez, en el titular" },
          { que: "¿A cuánto de arriba y de abajo?", es: "Leyenda de colores a la vista (oro Castilla, azul próximo rival, gris el resto), la tabla de los cinco de alrededor con la diferencia de puntos, y en el titular la distancia con el próximo rival" },
          { que: "Racha", es: "Cada jornada va subrayada: abre su post" },
          { que: "Último partido", es: "Bajo el titular, su post, sus robos y sus pérdidas, ya en ese partido" },
          { que: "El titular", es: "Puesto (y si subimos o bajamos en la última), puntos, la jornada y el día de corte, y los puntos por partido frente a la media de la liga" },
          { que: "Siguiente", es: "El próximo partido del calendario y lo que hay en juego: los puntos al equipo de arriba y sobre el de abajo (si coinciden los dos, «con los mismos puntos que el 5º y el 7º»)", cuenta: "De la tabla completa de nuestra última jornada; si esa tabla aún no está, no sale" },
          { que: "Para la J· (16/11/2026)", es: "Debajo, a un toque y con el rival ya elegido: Plan de partido (con el rival puesto), sus goles en vídeo y cómo le marcan (en el pop-up de la portada, 18/11/2026), «Cómo son sus goles» (Análisis de goles), su ABP, su plantilla y su coding" },
          { que: "Puesto", es: "De la clasificación, con el movimiento de la última jornada y, si los hay, con quién estamos empatados a puntos («empatados a 19 con el 5º y el 7º»)" },
          { que: "Puntos", es: "Con los partidos, los puntos por partido y la media de la liga al lado", cuenta: "Puntos ÷ partidos; liga = puntos repartidos (3 con ganador, 2 si empatan) ÷ (partidos × 2)" },
          { que: "Balance", es: "Tres cifras: ganados, empatados y perdidos, con su rótulo debajo" },
          { que: "Goles", es: "A favor-en contra, la diferencia y los goles a favor por partido con la media de la liga al lado", cuenta: "Liga = goles de la liga ÷ (partidos × 2)" },
          { que: "Fuente", es: "Una sola línea encima de las cuatro tarjetas: BeSoccer y la jornada y el día de corte. Desde el 17/11/2026 las cuatro tarjetas van debajo de «Jornada a jornada»: primero se ven las láminas con su conclusión" },
        ],
      },
      {
        titulo: "Puntos acumulados",
        filas: [
          { que: "Visual · Detalle (16/11/2026)", es: "«Jornada a jornada» se abre en «Visual»: la curva de puntos con su conclusión en el título (cuántos llevamos tras la última jornada y cuántos más o menos que la media de la liga) y la racha partido a partido (G, E o P con el marcador y, si está en todas, nuestro puesto debajo), titulada con los 5 últimos. «Detalle» es la curva y la tabla de siempre. Se recuerda en este aparato", cuenta: "Mismos datos que la tabla; a menos de medio punto de la media se dice «en la media»" },
          { que: "¿Dónde estamos en la tabla? (Visual)", es: "Entre la curva y la racha, el puesto tras cada jornada con el 1º arriba: cada punto lleva su puesto escrito, una raya tenue por puesto y marcas en el 1º, 5º, 10º, 15º y 20º. Cada punto abre el post de esa jornada. El título dice el puesto de ahora, si es el mejor y dónde empezamos («6º tras la J12, nuestro mejor puesto; empezamos 13º en la J1»)", cuenta: "Sólo sale si está el puesto de todas las jornadas; con pocas jornadas, tendencia" },
          { que: "¿A cuánto de arriba y de abajo? (Visual, 17/11/2026)", es: "Los 20 equipos en barras con sus puntos tras nuestra última jornada: el Castilla en oro, el próximo rival en azul. El título dice a cuántos puntos estamos del líder y por encima del 16º", cuenta: "La misma tabla que «Nuestro puesto»: todos los partidos de la liga hasta esa jornada; puntos, luego diferencia de goles, luego goles a favor. Sólo sale si esa tabla es la de nuestra última jornada" },
          { que: "¿Cómo va la racha? (Visual)", es: "Cada jornada (G, E o P, marcador y puesto) abre su post en Análisis de datos" },
          { que: "La línea dorada", es: "Nuestros puntos acumulados, jornada a jornada. En escritorio la curva llena la tarjeta; en el móvil va en un lienzo más alto con la letra mayor" },
          { que: "La raya de puntos", es: "Lo que lleva de media un equipo de la liga tras cada jornada", cuenta: "Puntos por equipo y partido de la liga hasta esa jornada × partidos que llevamos" },
          { que: "Eje de puntos", es: "Una marca cada 3 puntos; pasados los 12, cada 6, para que se lea en el móvil" },
        ],
      },
      {
        titulo: "Jornada a jornada",
        filas: [
          { que: "Jornada y rival, pinchables", es: "La jornada abre el post de ese partido en Análisis de datos; el rival, su plantilla en Plantillas rivales" },
          { que: "Resultado", es: "Verde si ganamos, ámbar si empatamos, rojo si perdemos" },
          { que: "Acumulados y Media liga", es: "Los dos puntos de la curva en cada jornada; en el móvil no salen" },
          { que: "Rival y su puesto", es: "El rival y, a su lado, su puesto en la misma tabla tras esa jornada; sólo sale si se encuentra en todas" },
          { que: "Nuestro puesto", es: "Destacada en dorado: la clasificación tras esa jornada con todos los partidos de la liga hasta ella; la columna sólo sale si están todas", cuenta: "Por puntos, luego diferencia de goles, luego goles a favor" },
          { que: "Total", es: "La suma de la tabla: goles y puntos de los partidos jugados" },
        ],
      },
      {
        titulo: "Power BI",
        filas: [
          { que: "Sólo aquí, en la ayuda (17/11/2026, ronda 20)", es: "El informe antiguo de la competición en Power BI ya no sale en la pantalla: pide cuenta de Microsoft y la pantalla no depende de él. Si hace falta: app.powerbi.com/view?r=eyJrIjoiNzY4NjNmZjktZWU3Zi00NjkyLTg5NTMtNzQwYjQwMGVjZmQxIiwidCI6ImQ2Zjc2YzExLWZmYjktNGExNS05YjQ5LWU2ZWQ0MjljOTVhMiIsImMiOjl9 (y el vídeo de cómo se lee, en drive.google.com/file/d/1V-1mm_z7cM43ZXKaCHGRPlECx-IH1Nrt/view)" },
        ],
      },
    ],
  },
  {
    ruta: "/match-preparation",
    titulo: "Plan de Partido",
    resumen: "La preparación de cada jornada: contexto, proyección del juego, plan con y sin balón, duelos, análisis del rival y recursos de vídeo.",
    origen: "El plan lo escribe el cuerpo técnico en la hoja RIVALES (un partido por fila) y se guarda solo. Fecha y hora del partido: calendario de BeSoccer. Duelos: Wyscout de toda la categoría, con nuestro once de la pizarra táctica (o el último de Valoraciones) y el suyo de Duelos o Plantillas. Proyección: Opta y Wyscout del grupo. Dibujo de referencia: alineaciones de BeSoccer. Vídeos y documentos: Supabase. Partido modelo (robo alto): evento a evento de Opta de todos los partidos del rival (opta:directo:<partido>) y opta:partidos.",
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Lo nuevo (19/11/2026): partido modelo robándole alto",
        filas: [
          { que: "Partido que se abre", es: "El próximo según el calendario de BeSoccer, con la misma regla que la portada: el primero cuya fecha y hora de Madrid no ha pasado, con 2,5 h de gracia para el que se está jugando. Si no hay calendario, la primera fila de la hoja con fecha de hoy en adelante. El ?rival= del enlace manda sobre esto." },
          { que: "Fecha, hora y cuenta atrás", es: "Salen de BeSoccer para la jornada del plan, también si ya se jugó (la hoja tiene la fecha del calendario de principio de temporada). «Mañana», «Ayer» o «Faltan n días» se cuentan desde esa fecha." },
          { que: "Proyección de la jornada", es: "Es la del partido del plan que tienes abierto (su jornada y su rival), no la del próximo partido contra ese rival." },
          { que: "Enlaces a Duelos, ABP y vídeos", es: "Llevan el rival del plan elegido, con ?equipo= y ?rival=." },
          { que: "Duelos · el que decide", es: "El resumen abre con el duelo que decide (el de «Cómo le ganamos»), rotulado, y luego los dos que más pesan" },
          { que: "Balón parado (plegado)", es: "A la vista, su córner en contra con su puesto y la orden, y el enlace a su ABP con el rival puesto" },
          { que: "Cómo le ganamos", es: "Cada tarjeta entera, sin cortar: la orden, el dato y su fuente en línea aparte" },
          { que: "Si le dejamos tocar, ¿se nos va?", es: "Con menos de 15 partidos se marca «tendencia»; si la altura del bloque le cambia menos de 0,3 pases por posesión, se dice y las cifras van plegadas en «Ver más»" },
          { que: "El duelo que decide · enlaces", es: "Además del duelo, la ficha de nuestro jugador en Individual y la del suyo con sus vídeos" },
          { que: "Modo día (19/11/2026)", es: "El rótulo «Partido modelo» y las demás cifras en oro se escriben en el oro oscuro, legible sobre blanco" },
          { que: "Análisis rival · Partido modelo: quién ya le hizo daño robándole alto", es: "Debajo de la proyección, una tabla con todos los partidos del rival de la temporada. En cada fila, lo que hizo el equipo de enfrente: robos en su último tercio, remates en los 10 s siguientes a esos robos (con barra y goles así) y el resultado (G, E, P de ese equipo). Ordenada por remates tras robo alto; arriba, en oro, el partido modelo, con «Ver el partido» si está en los vídeos del rival o, si no, «Sus goles en vídeo» de ese partido. Debajo, la lectura frente a la media de la liga y el sello (Opta, cuántos partidos y hasta qué fecha)", cuenta: "Opta, evento a evento (opta:directo:archivo y opta:directo:<partido>) de todos los partidos del rival. Robo alto: recuperación (BallRecovery) o intercepción en x ≥ 66,7 (último tercio, la raya de PosWonA3rd). Remate tras robo: remate (gol, fuera, parado o al palo) del mismo equipo en la misma parte y en los 10 s siguientes a un robo alto; cada remate cuenta una vez. Partido modelo: más remates tras robo alto; a igualdad, más goles así y más robos; con 0 no hay. Resultado: goles del archivo. Media de la liga: PosWonA3rd de opta:partidos por equipo y partido en todos los partidos del archivo, frente a la de los oponentes del rival; ±10 % es «como la media», más de un 10 % por encima «se le puede apretar arriba». Vídeo: el primero de los vídeos del rival (rival-media:<id>, sólo se lee) cuyo nombre lleva una palabra propia del oponente. Cuentas en lib/match-preparation/robo-alto.ts" },
        ],
      },
      {
        titulo: "Lo nuevo (18/11/2026): las visuales de las ideas de X",
        filas: [
          { que: "Proyección · Si le dejamos tocar, ¿se nos va? (18/11/2026)", es: "Un punto por partido del rival (Opta): en X el PPDA de su oponente, en Y sus pases por posesión (pases intentados entre secuencias). Recta de mínimos cuadrados y su r. Sobre la recta, dos escenarios nuestros: como venimos (nuestro PPDA medio de los últimos 5 partidos) y en bloque bajo (nuestro PPDA medio en el tercio de partidos de la temporada en que menos apretamos, mínimo 2); de cada uno, los pases por posesión que cabe esperarle. Si r ≥ 0,6: «su juego depende de que le dejen; presionar le acorta las posesiones»; si |r| < 0,3: mantiene su forma de jugar aprieten o no. Con menos de 5 partidos no hay recta" },
          { que: "En todas", es: "Misma idea visual que la publicación de X de la que salió, con la letra del club (Barlow Condensed) en el titular y las cifras, la tarjeta de la app (canto y sombra, día y noche) y una entrada suave. Los datos y las cuentas no cambian" },
          { que: "Cómo saca el córner", es: "Las líneas de cada córner se dibujan desde el banderín al llegar; la zona que más repite va de titular" },
        ],
      },
      {
        titulo: "Lo nuevo (17/11/2026, ronda 20)",
        filas: [
          { que: "Tira de accesos del rival (17/11/2026)", es: "A la vista, el vídeo del rival (sus goles, cómo le marcan, su último partido), ⬇ Clips de Hudl si los hay, Plan de partido, Duelos y ABP; el resto de pantallas del rival, en «Más», con el rival ya puesto" },
          { que: "Cómo le ganamos", es: "La orden es lectura nuestra; debajo, «Dato:» con la cifra de la que sale (tres líneas y «Ver más») y el enlace a su pantalla" },
          { que: "Balón parado", es: "Abierto al entrar: el mismo panel de ABP del rival y el enlace a la pizarra de balón parado" },
          { que: "Proyección · Por qué", es: "En la fila de posesión, la del rival es su posesión media (54 %), no la que le tienen sus rivales" },
          { que: "Duelos", es: "Cada jugador enlaza a su ficha: los nuestros a Individual; los suyos a Scout individual, con sus vídeos. El recuento dice que cada duelo cuenta con nuestro balón y con el suyo, como en Duelos" },
        ],
      },
      {
        titulo: "Arriba",
        filas: [
          { que: "Selector y flechas", es: "Abre el próximo partido (o el de ?rival=ID); los demás, en el orden del calendario" },
          {
            que: "Tira del rival (bajo el título, 16/11/2026)",
            es: "«▶ Sus goles en vídeo», «▶ Cómo le marcan» y «▶ Su último partido» en una ventana sin salir del plan, «⬇ Clips de Hudl» de sus jugadores si los hay (17/11/2026), y Plantilla, Colectivo, Individual, ABP, Área, Duelos, Pizarra táctica y Pizarra ABP con este partido puesto. La misma tira que en el resto de pantallas del rival",
            cuenta: "Los enlaces llevan ?rival=ID de esta fila y ?equipo=NOMBRE (components/rivals/AccesosDelRival.tsx)",
          },
          { que: "Lo suyo que hay que parar (17/11/2026)", es: "Quinta idea de «Cómo le ganamos»: quién le hace el xG («Flakus suma el 27 % de su xG: 4,29 en 840′») y por dónde centra (la banda con la mitad o más de sus centros y quién los pone), con la orden (marcarle en el área; cerrar el carril) y enlaces a su ficha en Scout individual y a Área del rival. El mismo bloque «Cómo nos hacen daño» del Scout colectivo (components/rivals/AmenazaDelRival.tsx)" },
          { que: "El córner, con nuestra base", es: "En «Su punto débil», junto a lo que le rematan, lo nuestro en la misma unidad: «nosotros rematamos el 23,6 % (13 de 55); objetivo, subir a la mediana de la liga, 30,7 %», la misma cuenta que ABP del rival (Wyscout)" },
          { que: "Cómo le ganamos", es: "Arriba del todo, una idea por fase con su métrica: su salida ante nuestra presión, lo nuestro con balón, su punto débil (el córner con su base: cuántos de cada 10 acaban en remate, su puesto y los partidos de Wyscout) y el duelo que decide (la orden, el momento, la cifra explicada y los minutos de los dos). Su punto fuerte, débil y el nuestro ya no se repiten debajo. Cada tarjeta lleva el enlace al dato que la sostiene con el rival puesto: su salida en Scout colectivo, «Su ABP» y «La rutina en la Pizarra ABP», «Ver el duelo». El duelo que decide es la misma orden que sale para ese jugador en Plantillas rivales" },
          { que: "Siglas", es: "La primera vez que sale una sigla en cada línea lleva al lado lo que quiere decir en gris (CP, ataque posicional; CR, contraataque; ABP, balón parado; PTO, portero; Z1, zona 1); al pasar el ratón, la explicación entera" },
          { que: "«media» en la proyección", es: "Es la media de los equipos del grupo en Opta (lo dice cada frase: «media de los 20 equipos del grupo en Opta»), la misma población que la tabla de la proyección" },
          { que: "Qué entrenamos · objetivo", es: "Nunca por debajo de lo que ya hacemos: el mayor entre lo esperado, nuestra media y la mediana del grupo" },
          { que: "Informe (botón principal) · Más", es: "Informe: Scout Colectivo, Pizarra ABP e imprimir. Más: proponer boceto, replicar y editar" },
          { que: "Fecha · hora · campo de 105×68 m", es: "Día y hora oficial de BeSoccer; la medida del campo, la que escribe el cuerpo técnico" },
          { que: "Faltan N días", es: "La cuenta atrás al partido («Mañana», «Hoy es el partido», «Hace N días»); en rojo a tres días o menos" },
          { que: "Informe", es: "Scout Colectivo, Sus goles en vídeo, Pizarra ABP e «Imprimir o PDF»" },
          { que: "Sus goles en vídeo (18/11/2026)", es: "En el menú «Informe»: abre el pop-up de la portada con sus goles, de seguido o uno a uno, sin salir del plan. Debajo, «Cómo son sus goles ›» abre Análisis de goles → «En el campo» con este rival puesto" },
          { que: "Más", es: "Proponer boceto, Replicar de otra jornada y Editar informe (Ctrl+E)" },
          { que: "Proponer boceto", es: "Copia el plan de la jornada anterior con «?» en lo que puede cambiar y «*» en lo que se propone incorporar" },
          { que: "Replicar", es: "Copia el plan de otra jornada que se elija, sin vídeos ni documentos" },
          { que: "Lo esencial", es: "Las tres primeras claves del partido; las demás, en «Más claves del partido»" },
        ],
      },
      {
        titulo: "Proyección de la jornada",
        filas: [
          { que: "Ver las N cifras del partido", es: "Plegada: posesión, xG, remates, toques en el área rival, centros, PPDA, recuperaciones en el último tercio y contraataques, con su fuente (Opta o Wyscout) en cada fila; xG, toques y PPDA se explican en la propia fila", cuenta: "Lo que hace el que ataca × lo que concede el que defiende ÷ media del grupo × efecto del campo; pesan más los últimos partidos" },
          { que: "Entre paréntesis", es: "El intervalo del 80 %" },
          { que: "Su presión en la temporada", es: "PPDA de Opta de la temporada y su puesto entre los que más aprietan de su grupo: la cifra principal del área, la misma de Plantillas rivales y del Scout colectivo. Wyscout sólo se nombra si le da otro puesto, con el motivo", cuenta: "Sus pases ÷ sus acciones defensivas de la temporada (opta:equipos); 1.º el que menos PPDA" },
          { que: "Orden (17/11/2026)", es: "Primero la tabla «Por qué» (nosotros, el rival, la media y lo esperado); la lectura y «cómo se calcula», plegadas en «Leer el porqué»; después «Tipo de partido»" },
          { que: "Tipo de partido", es: "Tres frases: posesión esperada, si será abierto o cerrado y el PPDA esperado contra nosotros (Opta); el estilo pasa a «Por qué»" },
          { que: "Contraste con los datos", es: "Una frase: el PPDA esperado en este partido y si al Castilla le presionan más o menos que a la media del grupo" },
          { que: "Por qué", es: "En el móvil, una tarjeta por cifra. Tabla de posesión, xG y remates a favor y en contra: nosotros, el rival (lo que concede o lo que hace), la media del grupo y lo esperado, con su sentido (más, mejor · menos, mejor · estilo) y una línea de cómo sale lo esperado" },
          { que: "Dónde más ventaja · riesgo", es: "Con su consigna, su fuente y sus partidos, y «Qué entrenamos»: la tarea y el objetivo con la mediana del grupo", cuenta: "Sólo entra si su cifra de la temporada y lo esperado van por encima de la media y él está entre los 6 de 20 que más lo conceden (o que más lo hacen)" },
          { que: "Fases del juego", es: "Sólo las fases que acaban en una orden sostenida por su cifra (un 10 % o más sobre la media): su salida ante nuestra presión, la nuestra ante la suya y las transiciones" },
          { que: "Tendencia (en Por qué)", es: "Los últimos 5 partidos frente a los anteriores, con cuántos partidos tiene cada tramo; es una pista, no una conclusión" },
          { que: "Jerga", es: "xG (goles esperados) y PPDA (pases que nos deja dar antes de presionar; menos es más presión) se explican la primera vez que salen" },
          { que: "Balón parado", es: "Plegado (su cifra del córner va arriba, en «Cómo le ganamos»). Dentro: el panel de /scout-rival-abp (ventajas y riesgos con su consigna, cómo saca el córner, rematadores) y el enlace a marcas y lanzadores en la pizarra de ABP; sólo se pide al abrirlo" },
          { que: "Ver el último partido: proyectado y real", es: "Lo que se proyectó y lo que pasó: verde si cayó dentro del intervalo, ámbar si no" },
        ],
      },
      {
        titulo: "Plan de juego y duelos",
        filas: [
          { que: "Con balón, Sin balón, ABP ofensivo y defensivo", es: "Lo que escribe el cuerpo técnico; las líneas en mayúsculas son apartados" },
          { que: "Siglas", es: "CP ataque organizado · CR contraataque · ABP balón parado · PTO portero · Z1, Z2… zonas; plegadas bajo el plan" },
          { que: "El número del duelo", es: "La diferencia de percentil con su par, frente a los de su puesto con 90′ o más", cuenta: "Positivo, ventaja nuestra; se habla de ventaja desde 10 puntos" },
          { que: "Para buscar · Doble cara · Para vigilar", es: "Los duelos decisivos (sin repetir el que ya está en «Cómo le ganamos»), cada uno con una orden de una línea; la consigna entera, los parejos y los de pocos minutos, en Duelos" },
          { que: "Tendencias", es: "Duelos con menos de 450′ en un lado: no cuentan como ventaja ni como riesgo" },
          { que: "Qué le decimos", es: "La consigna de cada duelo para el jugador, sacada del enfrentamiento que más pierde, con sus dos percentiles" },
          { que: "Qué entrenamos (en cada duelo, 17/11/2026)", es: "La tarea, qué se cuenta en ella y el objetivo sacado de la mediana de su puesto, la misma de Duelos" },
          { que: "El recuento de duelos", es: "La misma frase que Duelos: «8 duelos medidos y 1 con pocos minutos: …», contando desde ±10 de percentil" },
          { que: "Sin minutos en Wyscout", es: "Se dice una vez arriba; el duelo que sólo repetiría a los mismos nuestros va en una línea, sin tarjeta" },
          { que: "Nombres", es: "Los nuestros, con el nombre corto de la plantilla (el mismo de la pizarra y de Duelos)" },
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
    origen: "Las fichas propias salen de la plantilla (con su nombre corto, el mismo de Duelos y del Plan) y las rivales de Plantillas rivales, con sus tildes. El tablero «Once 4-2-3-1» se rellena solo cada semana con nuestro último once (Valoraciones) y el teórico del rival (Duelos → Plantillas → BeSoccer). Pizarras, bajas y once se guardan en Supabase.",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Lo nuevo (17/11/2026, ronda 20)",
        filas: [
          { que: "Nombre de cada jugador", es: "La lista de «Más fichas» y el once dicen el mismo nombre que la ficha del campo (el de Duelos y el Plan); se casa por foto, por dorsal con una palabra del nombre o por el nombre si sólo lo tiene uno" },
          { que: "Tocar una ficha", es: "Además de cambiar al jugador, «Ficha y vídeo de X» (rival, en Scout individual con el rival y el jugador puestos) o «Ficha de X» (nuestro, en Individual)" },
          { que: "Más fichas", es: "Cono y añadir un jugador concreto de la plantilla, plegados; a la vista quedan Propio, Rival y Balón" },
          { que: "Nombres en el móvil", es: "Encendidos por defecto, a unos 11 px; si el nombre pasa de 9 letras, sólo el apellido. Los atajos de teclado no salen en táctil" },
          { que: "Accesos del rival", es: "Bajo la cabecera del tablero de la semana, la misma tira que el resto de pantallas del rival: sus goles en vídeo, cómo le marcan, Plan, Plantilla, ABP… con el rival puesto" },
          { que: "Onces de la semana", es: "A la vista, cómo se cambia un jugador y «Rellenar otra vez»; de dónde sale cada once, plegado en «De dónde sale cada once»" },
          { que: "Lista «Añadir jugador…»", es: "El que está en el campo sale con el mismo nombre que su ficha (el que ven Duelos y el Plan)" },
          { que: "Su ficha y vídeo", es: "Con una ficha rival elegida, abre su ficha y sus cortes en Scout individual" },
          { que: "Tira de accesos del rival (17/11/2026)", es: "A la vista, Plan de partido, Duelos y Plantilla; el vídeo del rival y el resto, tras «Ir a…»: en el móvil el campo sube" },
          { que: "Ver duelos de este once", es: "Junto al título: los duelos de estos dos onces, con el rival puesto" },
          { que: "Su once no es el de Plantillas y Duelos", es: "Aviso bajo el campo cuando una sola ficha del rival difiere del once probable guardado (el mismo motor de Duelos y Plantillas); si nadie ha tocado el tablero, se actualiza solo" },
          { que: "Añadir jugador…", es: "Dorsal, el mismo nombre corto que la ficha del campo y el puesto en palabras («7 · Yáñez · Extremo derecho»)" },
          { que: "Leyenda en el móvil", es: "Bajo el campo, «dorsal → nombre» de los dos onces" },
        ],
      },
      {
        titulo: "El once de la semana",
        filas: [
          { que: "Onces de la semana", es: "Tres renglones: nuestro once y su fuente, el suyo con su etiqueta (probable, su último once o por minutos) y cómo se cambia un jugador. El tablero «Once 4-2-3-1»: el Castilla ataca hacia la derecha y el rival hacia la izquierda; dentro de la semana no se toca solo" },
          { que: "Rellenar otra vez · Deshacer", es: "El botón principal: vuelve a poner los dos onces, con un aviso antes si el tablero se ha tocado; «Deshacer», en «Más», lo deja como estaba. Desde el 17/11/2026 precarga los puntos de «Cómo le ganamos» del Plan de partido: la escena 1 lleva en «Qué se cuenta» el duelo que decide (con su cifra de Duelos) y cada punto más (lo suyo que hay que parar, el segundo duelo) es otra escena con los mismos onces, lista para dibujar. Esas escenas sin dibujar no cuentan como tablero tocado" },
          { que: "Su ficha (al elegir una ficha)", es: "En la barra de la ficha elegida: la del rival abre su ficha y sus cortes en Scout individual con el equipo y el jugador puestos; la nuestra, Individual" },
          { que: "? (ayuda)", es: "Qué es cada ficha, quién lee este once y por qué algunos no llevan dorsal (no lo tienen publicado en la plantilla del Castilla)" },
          { que: "Más · Deshacer el relleno · Probar sin guardar", es: "Deshacer deja el tablero como antes del relleno; probar cambia el once sólo en esta pantalla y al terminar se guarda o se descarta" },
          { que: "Accesos del rival", es: "Bajo los onces, la misma tira que en todas las pantallas del rival: ▶ sus goles en vídeo, cómo le marcan y su último partido (en una ventana; aparte, «Cómo son sus goles ›» abre Análisis de goles), Plan de partido, Plantilla, Colectivo, Individual, ABP, Área, Duelos y Pizarra ABP, todos con este rival puesto. El nombre del rival abre su plantilla" },
          { que: "Herramientas (móvil)", es: "Bajo el campo, un solo botón «Herramientas · la que está en uso» despliega la paleta y la cámara; plegadas, el campo ocupa la pantalla" },
          { que: "Añadir jugador…", es: "Cada jugador con dorsal, nombre y puesto de la plantilla" },
          { que: "CASTILLA ATACA →", es: "Sobre el césped del tablero de los onces, la misma dirección que en Duelos; no sale al exportar" },
          { que: "Su once", es: "El mismo de Duelos: lo colocado a mano en el campograma de Plantillas rivales manda sobre su sitio" },
          { que: "Atajos (columna de pizarras)", es: "→ y AvPág siguiente escena, ← y RePág la anterior, Espacio reproduce, Ctrl+Z deshace, ? todos" },
          { que: "Nuestro once, para entrar y no disponibles", es: "Plegado: se abre a mano (y solo en «Probar sin guardar»). Tocar un puesto abre la lista con los de ese puesto primero; arrastrar de «Para entrar» lo mete, de un puesto a otro los cambia. En el móvil, el dorsal en vez de la foto y el nombre entero" },
          { que: "Bajas", es: "Quién no está (lesión, sanción, selección, primer equipo…) y hasta qué día; se va sola al pasar la fecha" },
          { que: "Propuesta para el partido", es: "Un once para ese rival con el porqué de cada uno; nunca se aplica sola. Cada puesto parte del once de la pizarra y cambia si otro le supera frente al once probable del rival (el de Duelos)", cuenta: "Encaje, minutos, continuidad, duelos, lo que pide su juego, emocional y último partido: pesos editables que suman 100 %" },
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
          { que: "Por voz", es: "Explicar la jugada hablando y que se propongan las escenas; se revisan y se añaden o no; se deshace como cualquier cambio" },
          { que: "Nombres bajo las fichas", es: "El nombre corto de la plantilla (el de Duelos y el Plan; en la lista del once también, con la misma regla: el apodo si nadie más lo lleva, si no el apellido, lib/tactics/nombreCorto.ts), aunque la ficha se rellenara con otro (se casa por dorsal o, sin él, por el nombre), y con apellido si choca con uno del rival. En el móvil, sólo el dorsal y el nombre de la ficha que se toca, para que no se pisen; «Nombres en el móvil», en Vista, los pone todos. Al exportar, siempre" },
          { que: "Escena", es: "Un solo mando para duplicar la escena o añadir una en blanco detrás" },
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
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Qué se codifica",
        filas: [
          { que: "Miniaturas", es: "Sin fotograma, la categoría del corte y su minuto (si no es el arranque); sin ninguno, el icono de reproducir" },
          { que: "Recuento", es: "«N cortes sobre el vídeo del partido · M vídeos enteros de un jugador»; en el reproductor vacío sólo el último corte, con quién, la categoría y el día" },
          { que: "A un toque (rival)", es: "Además, robos, pérdidas y faltas de nuestro partido contra él (si están etiquetados) y la ficha del jugador del último corte" },
          { que: "Columna derecha", es: "Sin vídeo abierto, jugadores, categorías, teclado y pizarras van plegados aunque haya cortes" },
          { que: "Nuestro partido · Un rival", es: "El conmutador de arriba; cada partido y cada rival tiene su propia sesión de cortes" },
          { que: "Partido", es: "Del calendario; «Otro» añade un rival que no está (amistoso, vídeo propio)" },
          { que: "Rival", es: "Viene puesto el de la jornada, arriba y aparte («El de esta semana»); los demás, debajo por calendario. Si un vídeo lleva el nombre de otro equipo, avisa con un botón para cada uno" },
          { que: "Guardado", es: "Cuántos cortes lleva la sesión y la hora del último guardado; «Sin guardar» mientras quede algo por mandar" },
          { que: "Marcador", es: "Escudos, resultado, competición y fecha, con los cortes que lleva cada categoría y cada comportamiento; el rival de la jornada dice «el de esta semana». Encima, «Análisis · Coding» (el equipo no se repite)", cuenta: "Cuenta los cortes de todo el partido, no sólo los del vídeo abierto. Desde el 17/11/2026 la cifra grande es la misma que «N cortes guardados» y, si hay clips de jugador (vídeo completo de uno), debajo «2 del partido · 4 clips de jugador»" },
          { que: "A un toque (16/11/2026)", es: "Bajo el marcador, con el equipo ya elegido. De un rival: sus goles en vídeo y cómo le marcan (en el pop-up de la portada, 18/11/2026), «Cómo son sus goles» (Análisis de goles), su Plan de partido (siempre, con el rival puesto), su ABP, su plantilla, sus jugadores uno a uno (Scout individual) y, si ya jugamos contra él, el post de ese partido. De nuestro partido: su post en Análisis de datos y robos, pérdidas y faltas si ese partido ya está etiquetado. Es el único sitio de la pantalla con sus goles y cómo le marcan (17/11/2026)" },
          { que: "Sin vídeo abierto", es: "En el hueco del vídeo, «Elegir vídeo» y, si la sesión ya tiene cortes, cuántos lleva y el último (jugador, categoría y día). Sin vídeos suyos en la carpeta, sólo el botón de la carpeta de partidos. «Sacar los vídeos y subir a YouTube» no sale hasta que hay cortes" },
          { que: "El vídeo", es: "Carpeta de partidos (la del ordenador donde corre la app), «Desde un enlace» o «Abrir ficheros» del propio ordenador; se pueden abrir varios a la vez. En el móvil, sin vídeo abierto, va lo primero" },
          { que: "Carpeta de partidos", es: "Sólo los vídeos del rival elegido; los de otros equipos, plegados tras «Ver también». Si no hay ninguno suyo, en su sitio salen sus goles y cómo le marcan en vídeo, y la carpeta entera queda a un toque («Carpeta de partidos (N)»)", cuenta: "Un vídeo es del rival si su nombre lleva alguna palabra del rival sin siglas (Real Murcia → «murcia»)" },
          { que: "Para empezar", es: "Sin un solo corte, en vez del panel de marcar y la lista vacía: tres pasos (abrir el vídeo, elegir jugador, marcar con I y O), con lo hecho tachado y lo siguiente en oro" },
          { que: "Este rival no tiene plantilla", es: "Se codifica igual por dorsales o sólo con los comportamientos colectivos" },
          { que: "Retoma tu sesión", es: "Aviso de sesión abierta; darla por terminada no borra ningún corte" },
        ],
      },
      {
        titulo: "Marcar",
        filas: [
          { que: "Los cuatro tiempos", es: "Inicio y fin marcados más el aire de antes y de después: lo que se exporta es el corte con márgenes", cuenta: "Margen antes y después, en «Configuración» (ms)" },
          { que: "Mandos", es: "Reproducir, Fotograma ‹ y › (teclas ← y →; con ⇧, diez), velocidad: 0,5× · 1× · 2× · 4× · 8× a la vista y el resto (0,25× a 20×) en el menú; en el móvil, sólo el menú. Sin vídeo abierto, los mandos no salen" },
          { que: "Marcar inicio (I y O)", es: "Abre y cierra el corte; mientras está abierto va en rojo con piloto. Con el vídeo abierto, bajo él y siempre a la vista: I inicio, O cierre, Intro un toque, Espacio reproducir o parar, J / L velocidad" },
          { que: "Un toque (Intro)", es: "Coge los segundos de antes y de después del instante que se fijan en «Configuración»" },
          { que: "Jugadores · Comportamientos colectivos · Categorías", es: "Quién (cada uno con su tecla), lo del equipo (con ⇧) y, si se quiere, la categoría con su fase. En el móvil la plantilla va en una caja de unas seis filas con su propio desplazamiento, para que no empuje la lista de cortes (17/11/2026)" },
          { que: "Pantalla completa", es: "El vídeo a todo el alto, con la columna de cortes para pasarlos y ordenarlos y el selector de jugador y categoría dentro" },
          { que: "Pizarras", es: "Pintar sobre el fotograma (focos, flechas, zonas, mover a un jugador); vuelve a salir al pasar por ahí y se reparte a otros cortes" },
          { que: "Importar XML", es: "Trae un timeline de SportsCode, Hudl o Nacsport sobre el vídeo que está delante" },
        ],
      },
      {
        titulo: "Leer los cortes",
        filas: [
          { que: "Matriz", es: "Quién por qué, agrupado por fase; un cruce deja la lista, la línea de tiempo y la exportación con esos cortes" },
          { que: "Cortes", es: "La lista, en el orden del partido o a mano; «Buscar» mira jugador, dorsal, nota, etiqueta y vídeo, y «Filtrar» va por descriptor. Desde el 17/11/2026 el nombre del jugador de cada corte abre su ficha (la nuestra en Individual; la del rival en Scout individual, con su equipo) y la miniatura sin fotograma (vídeo aún sin abrir) dice el minuto en que empieza el corte" },
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
    resumen: "El rival en una frase, su once probable en el campo (con el sistema que más usa según Wyscout), la plantilla por puesto y la ficha de cada jugador.",
    origen: "Hoja RIVALES (plantillas, fichas y análisis); BeSoccer (tabla, resultados, alineaciones, minutos y tarjetas, en Supabase); Wyscout de toda la categoría; Opta (revulsivos y goles en vídeo, con los cortes de opta:goles-video); resúmenes del canal de la RFEF. El once probable y los recursos, en Supabase.",
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Lo nuevo (19/11/2026): cómo define el delantero rival",
        filas: [
          { que: "Fecha de cada rival (J y título)", es: "La de BeSoccer para esa jornada, también si ya se jugó. Antes los partidos jugados se quedaban con la fecha de la hoja." },
          { que: "«Plan de partido Jnn» en la tira de accesos", es: "La jornada que toca contra ese equipo la marca la última que se ha jugado según BeSoccer, no la fecha de la hoja." },
          { que: "Once probable sin nadie marcado", es: "Si nadie ha marcado el once a mano, se enseña el que propone el motor con sus últimos onces de liga de BeSoccer (lib/rivals/once-sugerido.ts, sugiereOnce). No se guarda: el contador dice «11 titulares probables», cada línea plegada da sus nombres y el campograma los pinta como titulares. Al tocar a un jugador, el once sugerido se queda puesto y ese jugador cambia, como con «Sugerir el once»." },
          { que: "Mientras llega el once", es: "Hasta que llegan el once guardado y el informe del rival, el contador, las líneas y «El once de un vistazo» enseñan un esqueleto en vez de «0 titulares» o «Sin titulares marcados»." },
          { que: "La base del dibujo", es: "Al lado del dibujo va de dónde sale: «Once probable en 4-2-3-1 · sus últimos 5 onces · su sistema en 7 de 12 · Wyscout». Si el dibujo del campo no es el que más repite, se dice «su sistema más usado: 4-3-3 (7 de 12 · Wyscout)», la misma cuenta que Scout Colectivo. Con el once marcado a mano dice «marcado a mano»." },
          { que: "El once de un vistazo en el escritorio", es: "En el ordenador va encima del campograma, con el minicampo y la lista de peligro y explotable uno al lado del otro. En el móvil sigue encima de la lista por puesto. Con el once sugerido también sale." },
          { que: "Fila de rivales", es: "En el ordenador salen el próximo rival y los tres siguientes del calendario, enteros (ya no hay fila que se desliza con el último escudo cortado). Cualquier otro se elige en «Ir a rival… (N)», a la vista y en dorado. En el móvil, «Cambiar equipo» abre la lista entera en renglones." },
          { que: "«+N» del campograma", es: "Los jugadores de más de un puesto amontonado se abren con el «+N ▾» pegado a la chapa del puesto (DC 3, EI 4…), por encima de la caja: ya no se monta sobre las fichas. La chapa reserva su ancho al repartirse." },
          { que: "Fichas dentro del campo", es: "Si la caja de un puesto (con su chapa y sus fichas) se sale por un borde del campo, se mete entera con un margen. Sólo en pantalla: el .pptx usa el motor de colocación tal cual." },
          { que: "«muestra corta» en el campograma", es: "La chapa es oscura en los dos modos y el ámbar claro se mantiene también en modo día (antes se volvía marrón sobre negro y no se leía). En el móvil va en dos renglones dentro del ancho de la ficha. Sale en los del once probable con menos de 450′ en Wyscout." },
          { que: "Nombres de «El once de un vistazo»", es: "A 11 px y sin «…». El rótulo sigue la regla de siempre (apellido; con la inicial o con tres letras si el apellido se repite en el once), y si no cabe se parte por el espacio («Jor.» / «Mier»)." },
          { que: "Su Scout individual desde el once", es: "Al pinchar una ficha de «El once de un vistazo», junto a «Su ficha ›» sale «Su Scout individual ›», que abre Scout individual con el rival y el jugador ya elegidos." },
          { que: "El duelo que decide en «Dónde nos hacen daño»", es: "Va el primero y lleva «el que decide, como en el Plan». Es el duelo con la cifra más despegada (dueloQueDecide de lib/duelos.ts), el mismo que abre el Plan de partido y Duelos. Si su jugador ya tiene tarjeta de amenaza (por ejemplo, el carril de Jorge Mier), el duelo va dentro de esa tarjeta, con «Su duelo»." },
          { que: "Explicaciones en dos renglones", es: "En «Dónde hacerles daño» y «Dónde nos hacen daño», la explicación del duelo y el dato de cada amenaza se cortan a dos renglones, y el resto se abre con «Ver más»." },
          { que: "Dónde nos hacen daño · el primero", es: "Si el duelo que decide (la cifra más despegada con consigna, lib/duelos.ts, la misma regla que el Plan y Duelos) se pierde, su jugador va el primero con la orden de ese duelo" },
          { que: "Muestra corta", es: "Titulares con menos de 450′ en Wyscout: * en El once de un vistazo y «muestra corta» en su ficha del campograma" },
          { que: "El once de un vistazo · lista", es: "Cada peligro/explotable en una línea: métrica · valor · percentil; el porqué entero al tocarlo" },
          { que: "Nombres del campograma", es: "Siempre en un renglón: la letra baja hasta 8 px y si no cabe, «…»; nunca se parte la palabra" },
          { que: "Su duelo (ficha)", es: "Abre Duelos con el rival y el jugador ya elegidos" },
          { que: "Ir a rival…", es: "Desplegable junto a la fila de escudos para ir a cualquier rival de un toque, con su jornada" },
          { que: "El once de un vistazo · peligro y explotable", es: "Una fila por jugador: chip ▲ peligro o ▼ explotable, dorsal, nombre y la métrica con su cifra; al tocarla, el porqué y su ficha" },
          { que: "Reparto del xG", es: "«Hace el N % de los goles esperados (xG) del equipo»: la parte del xG del equipo que lleva ese jugador (Opta)" },
          {
            que: "«Cómo define», en la ficha",
            es: "Para delanteros y mediapuntas, debajo de «Cómo juega»: su punto (en color) en la nube de goles/90 frente a xG/90 de los delanteros de la categoría (en gris), con la diagonal goles = xG: por encima marca más de lo que dicen sus ocasiones. Al lado, goles/90 y xG/90, su xG medio por remate y su % de remates desde fuera del área, cada uno con la mediana de los delanteros. Una etiqueta lo resume con su orden: «Tira de lejos» (salirle al borde), «Define por encima de lo esperado» (ni medio metro en el área), «Necesita ocasiones claras» (sin espacio dentro del área, desde fuera apenas hace daño) o, si no es nada de eso, «Marca lo que dicen sus ocasiones». Si no es delantero ni mediapunta en Opta, o no se le encuentra, no sale",
            cuenta: "Opta: opta:remates (cada remate con x/y y xG) por tirador y opta:jugadores (minutos y puesto más repetido). SIN PENALTIS en goles y xG. Fuera del área = fuera del rectángulo de Opta (x < 83 o fuera de 21,1-78,9 de ancho, enArea). Nube: delanteros con 450′ o más; medianas y cuartil, de los que tienen 10 remates o más. Etiqueta (por este orden): tira de lejos si el 40 % o más de sus remates son de fuera y está en el cuartil alto de los delanteros; define por encima si lleva 3 goles o más, al menos 1 más que su xG y un 30 % por encima; necesita ocasiones claras si su xG por remate llega a la mediana y no tira de fuera más que la mediana. Con menos de 270′ o de 8 remates no se etiqueta. Su fila de Opta: su equipo (casaEquipo) y su nombre cruzado con la plantilla entera uno a uno (asignaPerfiles). lib/rivals/definicion-delantero.ts y components/rivals/DefinicionDelantero.tsx",
          },
        ],
      },
      {
        titulo: "Lo nuevo (18/11/2026): las visuales de las ideas de X",
        filas: [
          { que: "En todas", es: "Misma idea visual que la publicación de X de la que salió, con la letra del club (Barlow Condensed) en el titular y las cifras, la tarjeta de la app (canto y sombra, día y noche) y una entrada suave. Los datos y las cuentas no cambian" },
          { que: "Revulsivos", es: "Como la ficha de X de un suplente decisivo: una tarjeta por revulsivo con sus cifras en fila (veces que entra, G · A entrando, minuto medio, banda de sus remates) y dos barras, G+A/90 entrando frente a de titular («tendencia» si sale de menos de 90′). La tabla de todos los suplentes, al pedirla" },
        ],
      },
      {
        titulo: "Lo nuevo (18/11/2026, ronda 22): un solo once, once en once",
        filas: [
          { que: "El once guardado se respeta entero", es: "Los once titulares y el dibujo que se guardaron no se tocan. Si un titular no tiene hueco natural en el dibujo (dos laterales derechos en un 4-2-3-1), va al hueco libre más cercano a su zona y se dice «Fuera de su sitio: V. Olmedo en EI». Siempre hay 11 titulares en 11 huecos", cuenta: "asignaTitulares con rellena (lib/rivals/campograma-motor.ts): primero cada uno a su puesto (método húngaro); quien no se parece a ningún hueco libre, al libre más cercano por distancia entre anclas; «fuera de su sitio» = fueraDeSuHueco. La misma cuenta en colocacionDelOnce / colocaElOnce (lib/rivals/colocacion-once.ts), que leen Scout individual, Duelos, Plan y pizarra. Lo puesto a mano manda; dos a mano en el mismo bloque, el segundo se coloca solo" },
          { que: "Su sistema más usado", es: "Un dato al lado del dibujo: «Once probable en 4-2-3-1 · su sistema más usado: 4-3-3 (7 de 12 · Wyscout, tendencia)»" },
          { que: "Aviso técnico del once", es: "«Sin titular en…», «no tiene hueco» y «Rehacer el once» sólo los ve el administrador; el cuerpo técnico ve el once ya cuadrado" },
          { que: "El once de un vistazo: minicampo", es: "Los once en un campo pequeño con las MISMAS líneas que el campograma (en un 4-2-3-1: 4, 2, 3 y 1). Peligro (borde rojo) y explotable (verde) con jerarquía: como mucho 3 de cada, los más extremos frente a su puesto, y la leyenda dice el criterio; a rayas, fuera de su sitio. Bajo cada ficha, el apellido; si se repite en el once, con la inicial («J. Mier») o, si también coincide, con tres letras («Jav. Mier», «Jor. Mier»). Debajo, los nombres con su cifra («Flakus (xG 0,6 por 90′, mejor que 9 de cada 10 delanteros)»); al pinchar una ficha, su puesto en el once, el porqué y la base (sus minutos en Wyscout, «tendencia» con menos de 450′), y «Su ficha ›». Las órdenes están sólo en «Dónde hacerles daño» y «Dónde nos hacen daño»", cuenta: "Líneas: lineasDelDibujo (los huecos de atrás adelante, cortados con los números del dibujo). Veredicto (18/11/2026): sólo con las métricas clave de su puesto (lib/rivals/metricas-del-puesto.ts, la misma lista que Scout individual: portero, paradas, goles evitados, salidas y pie; central, duelos aéreos y defensivos, interceptaciones y pase progresivo; lateral, centros, acciones de ataque, duelos defensivos y progresión; medio, recuperaciones, interceptaciones, pase progresivo y duelos; banda y mediapunta, regate, pase clave, último tercio, xA y remate; delantero, xG, remates, toques en el área y juego aéreo). Peligro: su mejor métrica clave por encima de P80 («mejor que 8 de cada 10»); explotable: su peor por debajo de P20. Un jugador, un veredicto (el lado más lejos de la mediana) y como mucho 3 por lado, los más extremos. Ni goles sueltos ni etiquetas: ésas van en su ficha" },
          { que: "Puesto en su once", es: "Las tarjetas de «Dónde nos hacen daño» y la radiografía de Scout individual dicen el puesto del once («Palmberg · pivote»); el MC de un 4-2-3-1 es «pivote» en todas las pantallas" },
          { que: "Cada orden, de su jugador", es: "La tarjeta de un jugador ya no lleva la consigna de otro del mismo duelo («Palmberg» con «no ir al choque con Javi Mier»): un duelo sólo da la orden de quien nombra o de quien es el único de su zona", cuenta: "ordenDelDuelo (lib/rivals/dano.ts)" },
          { que: "Huecos amontonados en el campograma", es: "Un hueco con cuatro o más (en el móvil, con tres o más) enseña al titular (o a los dos primeros si no tiene; en el móvil, al primero) y un botón «+N ▾» que, al tocarlo, abre la lista de los demás; cada nombre abre su ficha. La chapa sigue contando a todos" },
          { que: "Nombres en el móvil", es: "Bajo cada ficha del campograma el nombre no se corta («ORTUÑ…»): se prueba el nombre, la inicial con el apellido o el apellido y, si aun así no cabe, va en dos renglones con la letra a 8 px como mínimo" },
          { que: "«Fuerte en / Flojo en» con barras", es: "Cada aspecto, una barra de percentil: el punto es el rival y la raya del centro, la mediana de los 20 (a la derecha, mejor); el texto con la cifra va de pie" },
          { que: "Un solo buscador", es: "«Buscar jugador, dorsal o puesto (LD, MP…)». Un código de puesto a secas filtra ese puesto en el equipo elegido; lo demás busca en todos los equipos" },
          { que: "Sin frases repetidas", es: "La conclusión del rival va sólo en la cabecera; «Cómo llega» abre con sus cifras" },
          { que: "Revulsivos", es: "G+A/90 con un decimal (0,0 · 0,9 · 1,1)" },
          { que: "En el móvil", es: "Primero «El once de un vistazo», el buscador y la lista por línea; el campograma, debajo" },
        ],
      },
      {
        titulo: "Lo nuevo (17/11/2026, ronda 21): el campo y el once, primero",
        filas: [
          { que: "Orden de la pantalla", es: "Arriba, el rival en una frase y una sola fila de accesos; justo debajo, el campograma con su once y, a su lado (debajo en el móvil), «El once de un vistazo», los buscadores y la lista por puesto. «Cómo llega», el vídeo de sus partidos y los revulsivos van después. La tarjeta «Para la semana» ya no está: sus botones (Informe, PDF del once, PDF para el portero, PowerPoint y Enviar por WhatsApp o correo) son los de la barra del campograma («Informe» y «Más»)" },
          { que: "El rival en una frase", es: "Lo más fuerte y lo más flojo contra la categoría, con una cifra («destaca en progresión, pero flojea en balón parado en contra (córners rematados 44,6 %, 20.º de 20)»); sin Wyscout, su puesto y su racha. Al lado, «Cómo juega ›» (Scout colectivo) y «Área del rival ›», con el rival ya puesto", cuenta: "La misma frase que «Cómo llega» (fuerteYFlojoDelRival, Wyscout de su competición esta temporada); sin ella, fraseDelVistazo con BeSoccer" },
          { que: "Dibujo del once: su sistema más usado según Wyscout", es: "El campograma se dibuja por defecto con el sistema con el que más partidos ha salido según Wyscout, y lo dice: «Once probable en 4-3-3 · su sistema en 7 de 12 · Wyscout, tendencia». Si se elige otro a mano, la misma línea lo cuenta («elegido a mano · su sistema más usado: 4-3-3 ×7 de 12») y «Volver al 4-3-3» lo devuelve. Sin Wyscout, el que más repite en sus alineaciones de BeSoccer", cuenta: "Wyscout trae el sistema de cada partido con el % de tiempo («4-3-3 (70.4%)»); de cada partido de su liga esta temporada cuenta el de más tiempo (/api/data-analisis?perfiles=, sistemas). «Tendencia» con menos de 15 partidos. Se traduce al dibujo más parecido de los siete del campograma. «Cómo llega» enseña el mismo, rotulado Wyscout" },
          { que: "Un titular por hueco", es: "El once probable llena los once puestos del dibujo, uno por puesto: el que más ha jugado de cada uno entra y el que sobra se queda en el banquillo. Nunca dos titulares en el mismo puesto con otro vacío. Si el once marcado no cuadra con el dibujo (dos laterales derechos y nadie en el extremo izquierdo), la barra lo dice («Sin titular en EI · Jorge Mier no tiene hueco en el 4-3-3») con «Rehacer el once en 4-3-3»", cuenta: "asignaTitulares (lib/rivals/campograma-motor.ts): reparto de mínimo coste (método húngaro) entre titulares y huecos; cuesta 0 su puesto, poco el pariente cercano (un interior de pivote), más el otro lado, y lo que no se parece (un lateral de extremo) no se fuerza. Al sugerir, toda la plantilla es candidata y pesa lo que ha jugado en sus últimas cinco alineaciones de liga (BeSoccer, la más reciente vale más). La misma cuenta usan Duelos, el Plan, la pizarra y las marcas de ABP (colocacionDelOnce), y el dibujo se guarda con el once: todos ven el mismo" },
          { que: "El once de un vistazo", es: "Encima de la lista: los titulares por línea (portería, defensa, medio, ataque) en el orden del campo y, por línea, ▲ el que más daño hace y ▼ por dónde se le gana, con su cifra y su base. Cada nombre abre su ficha", cuenta: "Desde el 18/11/2026, ▲ peligro y ▼ explotable salen sólo de las métricas clave de su puesto en Wyscout (lib/rivals/metricas-del-puesto.ts): ▲ por encima de P80, ▼ por debajo de P20, como mucho 3 por lado y un veredicto por jugador, con la cifra en su unidad («1,0 por 90′», «27,8 %»). Con 270′ o más; menos de 450′, «tendencia». Lo que no tiene dato no sale" },
          { que: "Lista por puesto, plegada", es: "Porteros, defensas, centrocampistas y atacantes, cerrados: la cabecera dice quién es titular y se abre sólo el puesto que se pulsa. Con una búsqueda, un puesto escrito o etiquetas activas se abren todos. En el móvil ya no hay «Ver listado»: el campo y la lista van seguidos" },
          { que: "Etiquetas con su base", es: "Una sola línea por jugador: dos etiquetas, «+N» con el resto y sobre cuántos partidos suyos se han puesto («8 PJ»; con menos de 3, «tendencia · 2 PJ»). Así la fila no es más alta que la foto a 390 px", cuenta: "Partidos de esta temporada en BeSoccer. Las etiquetas las pone el analista en la ficha (columna IMPACTO)" },
          { que: "Fichas sin foto", es: "Con sus iniciales (o el dorsal) en vez de un círculo vacío, en el campo y en la lista; la silueta genérica de BeSoccer cuenta como sin foto" },
          { que: "Ficha del jugador: su vídeo y su duelo", es: "«Sus cortes (Scout individual)» abre Scout individual con él ya elegido y «Su duelo», Duelos con su rival puesto; debajo, sus clips de Hudl" },
          { que: "Fila de equipos", es: "En el móvil se parte en renglones (no se corta ningún escudo); en el ordenador, un degradado sobre el borde y el botón dorado «N ›» que desliza la fila" },
        ],
      },
      {
        titulo: "Lo nuevo (17/11/2026, ronda 20)",
        filas: [
          { que: "Tira de accesos del rival (17/11/2026)", es: "A la vista, el vídeo del rival (sus goles, cómo le marcan, su último partido), ⬇ Clips de Hudl si los hay, Plan de partido, Duelos y ABP; el resto de pantallas del rival, en «Más», con el rival ya puesto" },
          { que: "Dónde nos hacen daño", es: "Primero su amenaza con balón, la misma de «Cómo nos hacen daño» del Scout colectivo y del Plan: quién suma su xG (Opta) y por dónde centra (Wyscout), con su orden y su ficha. Después los duelos que perdemos con su balón, sin sus defectos (ésos van en «Dónde hacerles daño»)" },
          { que: "Chip del duelo", es: "En palabras: «con nuestro balón: ventaja Castilla (+20) · con el suyo: ventaja del rival (−33)», y debajo, en el propio rótulo, qué es la cifra: puntos de percentil de los nuestros del duelo frente a los suyos, cada uno contra su puesto en la categoría (Wyscout); + es ventaja nuestra. La consigna dice el percentil con palabras: «el nuestro, peor que 8 de cada 10 de su puesto; el suyo, mejor que 7 de cada 10» (antes «P17 frente a P71»), y el objetivo igual. «Su duelo» abre Duelos con el rival puesto, en las dos cajas", cuenta: "lib/rivals/dano.ts, percentilesEnPalabras sobre la consigna de Duelos; en Duelos y el Plan sigue el P##" },
          { que: "Le hacen los goles", es: "Una línea: cuántos de sus goles y en cuántos partidos (BeSoccer); la salvedad de Opta, al pasar el ratón" },
          { que: "Revulsivos", es: "Si la frase nombra al que más sale del banquillo, va el primero de la tabla" },
        ],
      },
      {
        titulo: "Arriba, antes de mirar a nadie",
        filas: [
          { que: "El campo del campograma", es: "Dibujado, no una foto: césped verde con franjas de corte en día y verde muy oscuro en noche, líneas en blanco roto y cada puesto en una caja casi opaca con el borde de su color, para que las fichas se lean. De pie (móvil) se dibuja de pie, sin estirar", cuenta: "components/rivals/CampoVectorial.tsx; colores en app/globals.css (--campo-*). Propuesta del experto de diseño del 15/11/2026" },
          { que: "Selector de equipo", es: "Ordenado por calendario: el próximo, fijo a la izquierda con «Próximo», y cada uno con su jornada. J = nuestra jornada contra ese rival" },
          { que: "Plantilla · Pizarra", es: "La lista con el campograma, o la pizarra táctica del rival" },
          {
            que: "«Cómo llega»",
            es: "Clasificación (con la mediana de goles del grupo), su balance en el campo del partido, los últimos cinco, el dibujo que más repite y quién le hace los goles",
            cuenta: "BeSoccer, sólo su liga (sin copa ni torneos). Los últimos cinco, el más reciente a la derecha, y siempre como tendencia. La mediana de goles es por equipo, a favor y en contra (en contra, menos es mejor). El dibujo, «N de M partidos de liga (Wyscout)», el mismo del campograma (sin Wyscout, el de BeSoccer, rotulado). «Tendencia» con menos de 8 partidos en ese campo, menos de 15 partidos de liga o menos de 15 goles",
          },
          {
            que: "Bajas y apercibidos",
            es: "Lo que la hoja dice en ESTADO o las etiquetas de lesionado y tocado de su ficha, y quién está a una amarilla del ciclo",
            cuenta: "Amarillas de BeSoccer esta temporada: 4, 9, 14… (el ciclo es de cinco)",
          },
          {
            que: "«Lo que le hace distinto»",
            es: "Titulado «frente a su grupo de 20 equipos», la misma fórmula de población que la portada, con una sola línea de lectura (la raya, la mediana del grupo; a la derecha, mejor) y la metodología en «Ver base»: las medias por partido y por qué el PPDA es el de Opta (con el de Wyscout, que lo cuenta de otra forma). En la fila basta «PPDA de Opta». Arriba, una frase con verbo y una sola cifra, la de lo flojo («destaca en presión alta, pero flojea en balón parado en contra (córners rematados 44,6 %, 20.º de 20)»); en cada grupo va primero el aspecto de esa cifra. Cada cifra lleva su base («25 de 56 en 12 partidos») y el PPDA es el de Opta cuando Opta lo tiene, como en el Scout colectivo. Debajo, hasta cuatro aspectos, fuerte en verde y flojo en rojo, cada uno sólo con las cifras que lo sostienen, con su mediana y su puesto; se ven tres y el resto se despliega con «N más»",
            cuenta: "Wyscout, equipos de su competición esta temporada (sin copa). Aspecto: percentil medio de sus cifras, si se separa ±20 puntos. Una cifra sólo entra en «Fuerte en» si está entre los 6 primeros de 20 y en «Flojo en» si está entre los 6 últimos; lo que vale la mediana, nunca. Puesto y mediana salen de puestoEnLiga (lib/rivals/puesto-liga.ts): con el sentido de la métrica (en PPDA, 1.º el que más aprieta), empates con el mismo puesto y mediana de verdad (media de los dos del medio con 20). Es la misma cuenta que el Scout colectivo y Área del rival",
          },
          {
            que: "«Dónde hacerles daño» y «Dónde nos hacen daño» (17/11/2026)",
            es: "Dos bloques según el signo del duelo de Duelos: con nuestro balón (verde) y con el suyo (rojo, la orden es defensiva). Hasta tres jugadores, cada uno en una tarjeta que abre con su orden y el chip del duelo («nuestro balón +20 · el suyo −33»); debajo, sólo las debilidades con cifra detrás, la cifra de Wyscout con sus intentos si es un porcentaje («duelos aéreos ganados 50 % · 10 de 20, tendencia») y la base en el mismo formato en todas («Base: 1180′ en Wyscout · 12 partidos»). «Ver el duelo» despliega la tarea, el objetivo y los minutos de los dos lados, con un enlace a Duelos. Sin cifra detrás no hay «Qué hacemos»; primero el central que el analista da por el de menor capacidad en Scout Colectivo",
            cuenta: "Etiqueta de debilidad en la ficha y rasgo flojo en Wyscout a la vez, con 450′ o más; no sale el central que el analista da por solvente. «Perfil único» dice la pierna de «PIE DOMINANTE» (zurdo: «cerrarle el perfil de dentro y obligarle a centrar con la derecha»); sin pierna escrita, esa etiqueta no da «Qué hacemos». Una sola orden por jugador (16/11/2026): si está en un duelo de Duelos que se despega (±10, sin muestra corta), el «Qué hacemos» es la orden de ese duelo, con su cifra con nuestro balón y con el suyo, la misma que en Duelos y en el Plan de partido (lib/rivals/dano.ts, ordenDelDuelo). El nombre abre su ficha",
          },
          { que: "Los nombres de «Le hacen los goles»", es: "Abren la ficha del jugador en esta misma pantalla, si está en la plantilla" },
          { que: "Otros puntos fuertes o flojos (plegados)", es: "«Ver otro punto flojo: cuidado del balón»; dentro, con el formato de las tarjetas: cifra por partido, en cuántos partidos, «(menos es mejor)» cuando lo es, mediana y puesto. Cada aspecto lleva una barra con su puesto (llena, el 1.º)" },
          {
            que: "Tira del rival (bajo los equipos, 16/11/2026)",
            es: "La misma en las ocho pantallas del rival y del partido: «▶ Sus goles en vídeo», «▶ Cómo le marcan» y «▶ Su último partido» (en una ventana, sin salir; aparte, «Cómo son sus goles ›» abre Análisis de goles), «⬇ Clips de Hudl (N)» si sus jugadores tienen listas en Hudl (en una ventana: jugador a jugador, .zip o uno a uno; 17/11/2026) y Plan de partido (con su jornada), Colectivo, Individual, ABP, Área, Duelos, Pizarra táctica y Pizarra ABP con este rival puesto. En el móvil va en varias filas, a la vista (17/11/2026)",
            cuenta: "Los enlaces llevan ?equipo=NOMBRE y ?rival=ID (la fila de la hoja RIVALES del próximo partido contra él o, si ya se jugaron, del último); el rival queda apuntado durante la visita y las pestañas de la sección lo llevan también (components/rivals/AccesosDelRival.tsx, lib/rivals/rival-en-curso.ts). Sustituye a «Más de este rival»",
          },
          { que: "Vídeo de sus partidos (plegado, 17/11/2026)", es: "Los resúmenes y sus goles en vídeo van en un desplegable bajo «Cómo llega», debajo del campograma: ya están a un toque en la tira de arriba" },
          { que: "Resúmenes de sus partidos", es: "El resumen oficial de sus tres últimos partidos de liga en el canal de la RFEF (abre YouTube); «Ver los N» despliega el resto" },
          { que: "Sus goles en vídeo (16/11/2026)", es: "Debajo de los resúmenes. Los que marca y los que encaja (= por dónde hacerle daño), de seguido («▶ Ver de seguido») o uno a uno en la lista de debajo; filtros: en jugada o a balón parado (córner, faltas, banda y penalti) y temporada, últimos 3 o últimos 5 partidos. El minuto, como en el campo («90+10′»), y «Falta» para la falta jugada. Cada gol, con el corte de Opta del partido (10 s antes y 6 después) o, si aún no está, sobre el resumen de la RFEF. «Verlos en el campo» abre Análisis de goles con el equipo puesto. No va en el PDF", cuenta: "Goles de Opta (opta:remates; los de propia puerta no son remates y no salen). Balón parado = situación del remate distinta de «juego» y «contragolpe». Vídeo: opta:goles-video y, si no, rfef:goles-resumenes. Opta puede dar algún gol a otro jugador que BeSoccer (un rebote, un remate desviado): por eso «Le hacen los goles» y esta lista pueden no cuadrar en uno" },
          {
            que: "Revulsivos",
            es: "La conclusión y, a la vista, sólo quien ha hecho algo entrando (goles o asistencias, o «revulsivo»), hasta tres; «Ver la tabla de los N suplentes» despliega a todos: veces que entra, minutos de suplente, goles y asistencias entrando, G+A por 90 como suplente frente a como titular, el minuto medio de su cambio y la banda de sus remates tras entrar. Un G+A/90 sacado de menos de 90′ de suplente lleva «tendencia»",
            cuenta: "Opta: opta:jugadores-partidos (GS = 1 titular; si no, suplente) y opta:remates de los partidos en que entra (y < 37 derecha, > 63 izquierda, con dos remates o más). Sólo con este equipo. Revulsivo: 90′ o más entrando, 0,3 G+A/90 o más y 1,5 veces su cifra de titular. Entrada ≈ 90 − minutos jugados. Lógica en lib/rivals/revulsivos.ts",
          },
        ],
      },
      {
        titulo: "La plantilla y el campograma",
        filas: [
          { que: "Lista por líneas", es: "Foto con dorsal, puesto (y 2.ª), y los minutos con «titular en X de Y» de esta temporada. Los nombres salen con su tilde (HÉCTOR, ÁLVARO, NÚÑEZ) aunque la hoja no la lleve", cuenta: "BeSoccer; las tildes, de lib/rivals/tildes.ts, sólo al pintar: el cruce con fotos, BeSoccer y Wyscout sigue con el nombre de la hoja" },
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
          {
            que: "Descargar sus clips (N) (17/11/2026)",
            es: "Si tiene lista en Hudl («UD IBIZA - YOLDI»): un .zip al portátil con sus clips nombrados «RIVAL - JUGADOR - 01 - <título>.mp4», o «▶ Ver uno a uno» con ▶ y ⬇ en cada clip. Si a la lista le faltan clips por bajar, «Pedir a Hudl» (avisa al terminar). Sin lista en Hudl no sale",
            cuenta: "Las listas de Hudl tituladas «RIVAL - Nº», «RIVAL - NOMBRE» o «RIVAL - Nº NOMBRE» (biblioteca del Castilla). El ordenador del club baja cada clip a 720p (unos 2-4 MB por 11 s) y lo guarda en el almacén de vídeo (scripts/hudl-clips-rival.mjs cada noche con la jornada y con «Pedir a Hudl»; documento hudl:clips-rival; primero el próximo rival). La lista se ata al rival por el nombre del equipo («UD IBIZA» = UD Ibiza, «MURCIA» = Real Murcia) y al jugador por su nombre o apellido; si sólo trae el número, por dorsal, y si el nombre casa a dos, decide el dorsal (lib/hudl-clips.ts)",
          },
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
    ojo: [
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
      "Una cifra por métrica (lib/rivals/cifra-principal.ts): en PPDA, xG y remates manda Opta, la temporada como cociente de las sumas (pases que deja dar entre acciones defensivas, sumados), con puesto y mediana entre los equipos de su grupo; Wyscout queda como 2.ª lectura en el detalle. La proyección del Plan cuenta partido a partido (media de los PPDA de cada partido) y por eso no repite esa cifra como «de la temporada». Nombres de equipo con lib/rivals/nombre-equipo.ts («Atlético Madrileño», nunca «Atlético Madrid B») y de jugador con el de su plantilla (lib/rivals/nombre-jugador.ts: «Flakus»). El puesto, el de la plantilla; si su once le pone en otro sitio, «extremo izquierdo en su once (delantero de origen)» (lib/rivals/colocacion-once.ts). Las muestras cortas llevan el chip «tendencia» junto al título de su tarjeta.","La altura de la ficha es la de la hoja; en ABP del rival manda la estatura de BeSoccer cuando las dos no coinciden."],
  },
  {
    ruta: "/scout-rival-collective",
    titulo: "Scout Colectivo",
    resumen: "Cómo juega el rival como equipo, según el analista y los datos de la categoría.",
    origen: "El informe lo escribe el analista en la hoja RIVALES (la transición ofensiva, en Supabase «scout-rival-colectivo-extra»). Fecha, jornadas y dibujo, de BeSoccer; «Datos del rival» y «Por dónde ataca», de Wyscout y Opta; «Evolución comparada», «¿Ha cambiado su modelo?», «¿Se le rompe la salida si le presionamos?» y «Embudo del ataque», de Opta (opta:partidos); «Reparto del xG», de Opta (opta:jugadores-partidos); «Según el marcador», de Opta (opta:remates, opta:momento y opta:partidos); «Amplitud por banda», del evento a evento de Opta (opta:directo:<partido>). «Cómo progresa»: evento a evento de Opta (opta:directo:<partido>) de los últimos 8 partidos de cada equipo de su liga. «Balón a la espalda»: el mismo evento a evento de Opta (opta:directo:<partido>), los pases que le hacen al rival y a cada equipo de su liga. «Línea de 5 o línea de 4»: Wyscout (/api/data-analisis), sus partidos de liga de esta temporada con el sistema de cada uno.",
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Lo nuevo (21/11/2026): con línea de 5 y con línea de 4",
        filas: [
          {
            que: "Línea de 5 o línea de 4 · qué cambia",
            es: "Debajo de «Balón a la espalda», sólo si esta temporada ha jugado de las dos maneras: una tabla de dos columnas, «Con 3 centrales» (línea de 5) y «Con 4 defensas» (línea de 4), con cuántos partidos lleva de cada y, por partido, xG en contra, remates en contra, PPDA, centros que le hacen y puntos por partido; ▲ verde la columna en la que le va mejor y ▼ naranja la peor. Debajo, los sistemas de cada columna («3-5-2 ×4») y una fila con sus partidos en orden y su sistema. Si ha cambiado de sistema, el titular lo dice («Desde su 8.º partido juega con línea de 5») y ese partido lleva el aro y «cambio», con fecha, rival y marcador. Por defecto se resalta la columna del sistema de sus últimos 3 partidos; pinchar la otra la resalta y la frase compara con ella. Con menos de 3 partidos en una columna, «tendencia»",
            cuenta: "Wyscout «Team Stats» (/api/data-analisis), temporada en curso, su competición principal. Sistema del partido: el de más tiempo de «Seleccionar esquema» («3-5-2 (70.4%)»); empieza por 3 o 5 = 3 centrales, por 4 = 4 defensas. Medias por partido: xG en contra (el xG del otro equipo en esa fila de partido), «Tiros en contra», «PPDA», centros que le hacen (los «Centros» del otro equipo en ese partido) y puntos (3/1/0 por el marcador). El n.º de partido es su orden por fecha en la liga. Por defecto: el sistema de más partidos de sus últimos 3 (empate, el del último). Cambio: el primer partido de su racha actual con ese sistema, si antes jugó con el otro. La frase cita las dos cifras que más cambian (10 % o más). Cuentas en lib/rivals/linea-defensa.ts",
          },
        ],
      },
      {
        titulo: "Lo nuevo (21/11/2026): ¿se le gana la espalda?",
        filas: [
          {
            que: "Balón a la espalda · ¿se le gana en largo?",
            es: "Debajo de «Cómo progresa»: un campo entero (atacamos hacia la derecha) con una flecha por cada pase largo o en profundidad que le han hecho al rival y ha acabado en sus últimos 25 m por dentro (la zona sombreada). Cada flecha va del origen al destino y su color dice en qué acabó la jugada: remate (verde), falta a favor (oro), despeje (azul), pérdida (naranja) o «sigue sin rematar» (gris); discontinua si el pase no llegó. Pinchar un desenlace de la leyenda deja sólo esas flechas; al pasar por una sale el minuto y, si hubo remate, su xG. Al lado, tres cifras con la media de su liga: % que acaba en remate (con su puesto), xG por balón y de qué carril salen más (nuestra izquierda es su banda derecha). El titular dice si compensa atacarle la espalda, si es perder balones o si está en la media, y debajo por qué carril rinde más. Con menos de 25 balones lleva el chip «tendencia»",
            cuenta: "Opta, evento a evento (opta:directo:archivo y opta:directo:<partido>) de los últimos 8 partidos de cada equipo; su liga, los equipos que se cruzan con él en el archivo. Balón a la espalda: pase en juego (sin saques de banda ni de puerta) del oponente que sale con x < 76,2 (fuera de los últimos 25 m; x 0-100 = 105 m), avanza al menos 20 m y acaba con x ≥ 76,2 e y entre 20,4 y 79,6 (el ancho del área), llegue o no. Desenlace: lo primero que pasa en los 10 s siguientes y en la misma parte; remate de quien lo envía (su xG es el «xG por balón», sumado y dividido por los balones), falta a su favor, despeje del rival (Clearance, Punch, BlockedPass) o pérdida (el rival da un pase, recupera, intercepta, gana la entrada o bloca el portero; o falta en contra); si no pasa nada, «sigue» si el pase llegó y pérdida si no. Carril de salida desde quien ataca: izquierda y > 66,7, derecha y < 33,3. Media de la liga: la media de los equipos de su liga con 12 balones o más, sin él. «Compensa» si el % de remate o el xG por balón pasa un 15 % la media sin quedar el otro por debajo; «es perder balones» si queda un 15 % por debajo sin pasar el otro. Cuentas en lib/rivals/balon-espalda.ts",
          },
        ],
      },
      {
        titulo: "Lo nuevo (19/11/2026): cómo progresa el rival",
        filas: [
          { que: "Erratas del analista", es: "Al pintar: «e» suelta delante de algo que no es i/hi pasa a «en», y «CT's» a «centrales»; la hoja no se toca" },
          { que: "Cómo nos hacen daño", es: "Un solo bloque: primero lo que dicen los datos (quién hace su xG y por dónde centra, Opta y Wyscout) y luego lo que ve el analista en vídeo; cada frase lleva su fuente y los jugadores citados enlazan a su ficha y vídeo en Scout individual" },
          { que: "Dibujo de referencia", es: "Su sistema más usado según Wyscout, la misma cuenta que Plantillas rivales; sin Wyscout, las alineaciones de BeSoccer. El sello dice de cuál sale" },
          { que: "Lo esencial · Wyscout frente a la liga", es: "Cada cifra con su barra y la raya de la mediana de la liga (la barra llega a la mitad si es igual que la mediana); el titular dice en qué se separa más de la liga" },
          { que: "Siglas de cada fase", es: "Bajo el título de Fase ofensiva y Fase defensiva, las siglas que usa el analista en esa fase (CT, INT, 3ª altura…) con su significado" },
          { que: "Nombres del analista", es: "Un nombre de pila suelto («Alberto») se escribe como en la plantilla («A. González») si en la plantilla es de uno solo; lo ambiguo se deja como está" },
          { que: "¿Ha cambiado su modelo? · Cómo se cuenta", es: "La tabla de bloques (últimos 5 y resto: PPDA, pases, puntos) va plegada; arriba quedan las fichas y las dos curvas" },
          {
            que: "Cómo progresa · por dentro en corto o en largo directo",
            es: "Debajo de «Amplitud por banda»: un plano con un punto por equipo de la liga del rival. A la derecha, los que más juegan en largo; arriba, los que más progresan por el carril central. Las dos líneas discontinuas (la mediana de la liga en cada eje) parten cuatro cuadrantes: combinativo por dentro, combinativo por fuera, directo y mixto. El rival va en oro, su punto de los últimos 5 partidos en azul unido al suyo, y el Castilla con su nombre. Arriba, la frase que lo clasifica (con su puesto en cada eje) y qué hacer con el bloque: cerrar el pasillo interior o preparar el balón largo y la segunda jugada. Si en los últimos 5 ha cambiado de cuadrante, lo avisa y el consejo es el de ahora. Al pasar por un punto sale el equipo y sus cifras",
            cuenta: "Opta, evento a evento (opta:directo:archivo y opta:directo:<partido>) de los últimos 8 partidos de cada equipo. Su liga: los equipos que se cruzan con él en el archivo. Eje X: pases en juego (sin saques de banda ni de puerta) de 32 m o más sobre todos sus pases en juego (x 0-100 = 105 m, y 0-100 = 68 m). Eje Y: de sus pases progresivos completados (acercan el balón a la portería al menos un 25 % y no se quedan en campo propio), los que acaban con y entre 30 y 70. Cuadrante: por encima o por debajo de la mediana de los equipos del plano en cada eje (largo y por fuera = directo; largo y por dentro = mixto). Equipos con menos de 40 progresivos (20 en los últimos 5 del rival), fuera. Cuentas en lib/rivals/progresion-rival.ts",
          },
        ],
      },
      {
        titulo: "Lo nuevo (18/11/2026): las visuales de las ideas de X",
        filas: [
          { que: "Amplitud por banda · ¿quién le da el ancho?", es: "Debajo de «¿Se le rompe la salida…?»: una tarjeta por banda del rival (su izquierda = nuestra derecha y al revés) con dos barras, la parte de sus toques por fuera en el último tercio que es del extremo y la que es del lateral de esa banda, con quién ha hecho de cada uno. Si el lateral se lleva más de la mitad, la banda lleva «El lateral da la amplitud: <jugador>» y el titular lo dice (nuestro extremo le sigue hasta abajo y nuestro lateral cierra por dentro; si no, nuestro extremo puede quedarse arriba para la contra). Pinchar una barra abre el plano de esos toques (medio campo, atacando hacia arriba; cada punto, un toque con su jugador y minuto)", cuenta: "Opta, evento a evento de sus últimos 8 partidos guardados (opta:directo:archivo y opta:directo:<partido>). Toque = la regla del directo (sin faltas, córners ni entradas fallidas). Carril exterior del último tercio: x > 66 e y < 20 (su derecha) o y > 80 (su izquierda). Extremo y lateral, del once de cada partido: entre los titulares con 10 toques o más, el lateral es el defensa de Opta que más abierto juega por ese lado (su y media, dentro del tercio de esa banda) y el extremo, el centrocampista o delantero que más abierto juega por ahí; si se va antes del 85′, quien entra con su puesto y por su lado hereda el papel. El resto de toques del carril, «otros». Cuentas en lib/rivals/amplitud-banda.ts" },
          { que: "Cómo sale · ¿se le rompe la salida si le presionamos?", es: "Debajo de «¿Ha cambiado su modelo?»: un punto por partido del rival, con el PPDA de su oponente en ese partido (eje X; a la izquierda, más le aprietan) y sus pérdidas en campo propio (eje Y). Encima, la pendiente, la r y la frase: «cuanto más le aprietan, más pierde atrás» o «aguanta la presión». En oro, los partidos ante equipos que presionan como nosotros, con su media de pérdidas aparte de la del resto", cuenta: "Opta (opta:partidos): el PPDA, de la fila del oponente; las pérdidas (PsLostD3, su primer tercio), de la del rival. Recta de mínimos cuadrados; la pendiente se da como pérdidas de más por cada punto MENOS de PPDA. r de Pearson: ≤ −0,5 «cuanto más le aprietan, más pierde atrás»; entre −0,3 y 0,3 «aguanta la presión»; entre −0,5 y −0,3 «algo, sin ser regla»; ≥ 0,3 «pierde más cuando le dejan jugar». Con menos de 5 partidos no hay tendencia. «Como nosotros» = PPDA del oponente dentro de la media del Castilla en la temporada ± 1,5" },
          { que: "En todas", es: "Misma idea visual que la publicación de X de la que salió, con la letra del club (Barlow Condensed) en el titular y las cifras, la tarjeta de la app (canto y sombra, día y noche) y una entrada suave. Los datos y las cuentas no cambian" },
          { que: "Reparto del xG", es: "Como el original de X: puesto grande a la izquierda, el jugador con sus minutos, xG/90 y «×N la media», la barra con la raya de la media del equipo y el % grande a la derecha con su xG debajo. El titular dice cuánto hace el primero" },
          { que: "Evolución comparada", es: "Líneas que se dibujan al llegar y la última cifra de cada línea a su derecha, como en el original. El titular dice si en los últimos partidos genera o concede más o menos" },
          { que: "¿Ha cambiado su modelo?", es: "Como «Tendencias del equipo» de X: el equipo, su etiqueta en una píldora y fichas «▲ PPDA 8,7 → 13,8» (el resto de la temporada → los últimos 5), en color sólo si el cambio pasa el umbral; en las curvas, la cifra de cada uno de los últimos 5 partidos. La tabla de bloques sigue debajo" },
          { que: "Embudo del ataque", es: "Ahora es un embudo de verdad: cada escalón centrado y más estrecho, con la cifra por partido grande a la izquierda y el paso frente al grupo a la derecha (verde mejor, naranja peor). La frase de lectura es el titular" },
          { que: "Según el marcador", es: "La lectura como titular; cada métrica en su tarjeta con las tres barras (ganando, empatando, perdiendo) y la raya de su media" },
          { que: "Por dónde ataca", es: "Tarjeta de la app y titular: la banda que carga o, si no hay una, el jugador que más concentra un tipo de acción" },
        ],
      },
      {
        titulo: "Lo nuevo (17/11/2026, ronda 20)",
        filas: [
          { que: "Tira de accesos del rival (17/11/2026)", es: "A la vista, el vídeo del rival (sus goles, cómo le marcan, su último partido), ⬇ Clips de Hudl si los hay, Plan de partido, Duelos y ABP; el resto de pantallas del rival, en «Más», con el rival ya puesto" },
          { que: "Titular de «Partido a partido»", es: "Cuando marca y encaja poco: «sus partidos dan pocos goles» (de sus partidos, no del nuestro; el tipo de nuestro partido lo proyecta el Plan con Opta)" },
          { que: "Cómo nos hacen daño · centros", es: "«54 % de los 207 centros de sus jugadores»: la suma jugador a jugador de Wyscout; el total del equipo (208) sale en Área del rival" },
          { que: "Embudo del ataque y según el marcador", es: "Plegados tras su resumen, debajo de las gráficas de xG y PPDA" },
        ],
      },
      {
        titulo: "Arriba",
        filas: [
          { que: "«Nuestra J10 · sáb 31 oct · en casa»", es: "El partido en una línea; es el desplegable de la jornada del Castilla (el rival que nos tocó)", cuenta: "La fecha, la del calendario de BeSoccer; la columna FECHA de la hoja no se toca" },
          { que: "Conclusión", es: "Un titular con verbo, dato y su mediana («Real Murcia encaja 0,92 por partido (mediana 1,25), menos que la mayoría: paciencia con balón…») y debajo tres cifras grandes, cada una con su mediana: puntos, goles a favor y goles en contra por partido. Luego «Dónde atacarle», el mismo par fuerte/flojo de Plantillas rivales", cuenta: "BeSoccer, sólo su liga; la mediana sale de la clasificación (los equipos de su grupo). «Marca poco» sólo si marca menos que la mediana (con 0,15 por partido de margen); lo mismo para «encaja»" },
          { que: "Partido a partido", es: "Sus partidos de liga con fecha, casa o fuera, rival y V/E/D con el marcador, del más antiguo al más reciente, en una rejilla que no se corta. Los que llevan ▶ abren el resumen en vídeo de la RFEF. La única jornada que se nombra es la nuestra, la de la cabecera", cuenta: "BeSoccer; sólo la competición oficial en la que más ha jugado: la copa y los torneos de verano no entran. El resumen se casa por los dos equipos y la temporada (ida o vuelta por la fecha)" },
          { que: "Plan de partido · Pizarra ABP", es: "El mismo partido en esas pantallas; en el móvil van los primeros, con Editar, en una sola fila" },
          { que: "Accesos del rival", es: "Bajo la cabecera, la misma tira que en todas las pantallas del rival: ▶ sus goles en vídeo, cómo le marcan y su último partido (en una ventana, sin salir; aparte, «Cómo son sus goles ›» abre Análisis de goles), Plantilla, Individual, ABP, Área, Duelos y las pizarras, con este rival puesto" },
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
          {
            que: "Cómo nos hacen daño, en datos (17/11/2026)",
            es: "Debajo de lo del analista y antes del embudo: quién le hace el gol («Flakus suma el 27 % de su xG: 4,29 en 840′») y por dónde centra («sobre todo por la derecha: 54 % de sus 208 centros; Jorge Mier, el 17 %»), cada uno con su «Qué hacemos» (marcarle en el área; cerrar el carril del que centra) y los enlaces a su ficha en Scout individual y a Área del rival. Es el mismo punto 4 del Plan de partido",
            cuenta: "xG de Opta (opta:jugadores-partidos, el mismo «Reparto del xG» de abajo); sólo si el primero suma el 18 % o más con 270′ o más. Centros de Wyscout (los de «Por dónde ataca»): la banda que da la mitad o más de sus centros, con 20 o más. components/rivals/AmenazaDelRival.tsx",
          },
          { que: "Sus goles en vídeo", es: "Ya no va en esta pantalla (17/11/2026): está a un toque en la tira de arriba («▶ Sus goles en vídeo»), en una ventana, sin salir" },
          {
            que: "Por dónde ataca",
            es: "Aquí, en una línea (17/11/2026): el reparto por carril, el mismo del campo de Área («izquierda 28 · centro 39 · derecha 33»), y sólo por fuera (centros, regates y pases al área) la banda que carga, dichas como dos cuentas distintas; el jugador del que más depende, y el enlace «Banda a banda… en Área del rival». El bloque entero vive en Área del rival. En Área: primero, como el original de X («¿Por qué carril ataca?»), medio campo atacando hacia arriba con sus tres carriles sombreados según su parte de todas esas acciones (el porcentaje grande dentro, el más cargado más grande) y al lado quién carga cada carril (el que más pone sumando los tipos en los que es el primero). Debajo, el detalle: sus centros, regates, pases al área y acciones progresivas (pases progresivos + carreras en progresión) de la temporada, repartidos entre banda izquierda, centro y banda derecha, y en cada banda el jugador que más pone; su nombre abre su ficha en Plantillas rivales y «▶ Su vídeo», sus cortes en Scout individual con él ya elegido; el puesto, en castellano («lateral izquierdo», no «LB»)",
            cuenta:
              "Wyscout por jugador: cifra por 90 × minutos / 90, jugadores de campo con minutos. El lado, del puesto principal (laterales, carrileros y extremos con L/R a su banda; centrales, medios, mediapuntas y delanteros al centro); los centros, de «Centros desde la banda izquierda/derecha». El % es sobre el total del equipo; el titular dice qué banda carga (≥ 58 % de lo de fuera) y el jugador del que más depende",
          },
          {
            que: "Evolución comparada",
            es: "Dos gráficos de líneas jornada a jornada: xG (goles esperados) a favor por partido y xG en contra por partido del Castilla (oro) y del rival (azul), con la media de nuestro grupo en gris discontinuo. La etiqueta dice en cuántos partidos suyos de Opta. Al pie, el último valor de cada línea; arriba, si el rival genera y concede más o menos que hace tres partidos",
            cuenta:
              "Opta, opta:partidos (equipo × partido, por fecha). «Jornada k» es el k-ésimo partido de cada equipo. Cada punto es la media acumulada hasta esa jornada: ExpG para el a favor y ExpGAg (o el ExpG del rival en ese partido) para el en contra. La media del grupo es la de las medias acumuladas de los equipos del grupo del Castilla en esa jornada. «Más» o «menos» que hace tres partidos, si la media acumulada se mueve al menos 0,1 xG. Si el rival no cruza con Opta, no sale",
          },
          {
            que: "¿Ha cambiado su modelo?",
            es: "Dos curvas jornada a jornada del rival: PPDA por partido (menos, más presión) y pases por partido, cada partido como punto gris y su media móvil de los últimos 5 en azul, con el bloque de los últimos 5 sombreado. Debajo, una tabla: últimos 5 contra el resto de la temporada, con PPDA, pases, puntos sacados en cada bloque (y por partido) y la diferencia. Arriba, la etiqueta «más reactivo» o «más protagonista» si ha cambiado y una frase que lo dice",
            cuenta:
              "Opta, opta:partidos (sus partidos por fecha; «Jornada k» es su k-ésimo partido). PPDA, el que Opta da hecho en cada partido; pases, PsAtt (intentados); puntos, del marcador (3, 1 o 0). La media móvil es la de los 5 últimos partidos con dato hasta cada jornada (sale desde el quinto). Cada bloque, media de sus partidos; el resto necesita al menos 3 partidos. «Más reactivo» si el PPDA sube más de 2 y los pases bajan más de un 10 %; «más protagonista», si el PPDA baja más de 2 y los pases suben más de un 10 %. Si el rival no cruza con Opta, no sale",
          },
          {
            que: "Embudo del ataque",
            es: "Cuatro barras por partido: secuencias, las que llegan al último tercio, toques en el área y remates; en cada escalón su paso y, en gris, la media de nuestro grupo (verde, mejor que la media; naranja, peor). «Su ataque» es lo que hace él con el balón; «Cómo le atacan», lo que le hacen sus rivales, para ver si su defensa cae antes del área o dentro. Arriba, una frase dice en qué escalón se aparta de la media",
            cuenta:
              "Opta, opta:partidos, sumando todos sus partidos con las cuatro columnas: Sequences, SeqEndInA3 (secuencias que llegan al último tercio, x > 66,7), TouchOpBox y ShtIncBl (remates con los bloqueados); «Cómo le atacan», las mismas columnas de la fila del contrario en cada partido. Último tercio = SeqEndInA3 / Sequences en %; toques y remates, por cada llegada (un toque no es una secuencia y una secuencia puede tener dos remates, así que no hay % de paso). La media del grupo es la media de esos cocientes de cada equipo del grupo del Castilla. La frase sale si un paso se aparta al menos un 8 % de la media. Opta no trae partido a partido las secuencias con tres pases en el último tercio ni las que tocan el área, y no se ponen. Si el rival no cruza con Opta, no sale",
          },
          {
            que: "Según el marcador",
            es: "Arriba, una frase dice si cuando se adelanta se repliega o sigue apretando, y «Qué hacemos»: la orden que sale del dato («si nos adelantamos, sube a 16,7 remates por 90′… defender el área y la segunda jugada»; si se adelanta, «no precipitarnos; amplitud, paciencia y llegada al área»), con su base en minutos. En Visual (por defecto), barras por métrica con los tres estados (verde ganando, gris empatando, naranja perdiendo) y la raya de su media; en Detalle, la tabla: por cada 90 minutos en ese estado, remates, xG a favor, xG en contra, posesión, toques en el último tercio y balones ganados en el último tercio, con su media al lado y en rojo lo que se aparta más de un 25 %. Un estado con menos de 270′ lleva «tendencia» y con menos de 90′ «pocos minutos». Debajo, una línea por partido coloreada por el marcador (verde ganando, gris empatando, naranja perdiendo) con el minuto y el marcador de cada gol (▲ suyo, ▼ en contra); salen los 8 últimos y un botón enseña todos",
            cuenta:
              "Opta. Los goles de opta:remates (sin la fila repetida de cada evento) dan la línea del marcador de cada partido; el descuento de la primera parte se cuenta en el 45′ y el partido acaba en el 90′ o en lo último que se ve. Remates (con los bloqueados) y xG van al estado del MatchState de cada remate (el «ganando» del contrario es su «perdiendo»). Posesión (media pesada por el tiempo), toques en el último tercio (TchsA3) y balones ganados en el último tercio (PosWonA3rd), de opta:momento: cada tramo de 5′ se reparte entre los estados por los segundos que pasa en cada uno. Por 90 = suma / segundos en el estado × 5.400; la media, lo mismo con todos los minutos. Sólo se marca en rojo con 90′ o más en ese estado. Qué hacemos: perdiendo (= si nos adelantamos), remates o toques arriba más de un 25 % sobre su media; ganando, posesión más de un 12,5 % por debajo o xG en contra más de un 25 % por encima; con al menos 90′ en ese estado. La frase: ganando, posesión, toques arriba y balones ganados arriba frente a su media (dos que bajen un 15 % = se repliega). Opta no trae para todos los equipos el pase a pase ni los centros: el % de pases en campo contrario se lee con la posesión y los toques en el último tercio, la altura defensiva con los balones ganados arriba, y los centros no salen. Un partido cuyos goles no cuadran con el resultado de opta:partidos (gol en propia puerta) sale en la lista pero no entra en las cuentas. Si el rival no cruza con Opta, no sale",
          },
          {
            que: "Reparto del xG",
            es: "Barras con los 10 jugadores que más xG suman en la temporada, con su % del xG del equipo, minutos y xG por 90; una raya marca lo que aportaría con la media por minuto de los que rematan en su equipo y al lado «×N media» (×3,2 = remata 3,2 veces lo que le tocaría por sus minutos). Los del rival, con el nombre de su plantilla («Flakus») cuando casa con uno solo. Arriba, el % que concentra el primero, lo que suman los tres primeros y si el gol está muy concentrado, en tres o repartido. Un selector cambia del rival al Castilla",
            cuenta:
              "Opta, opta:jugadores-partidos sumado por jugador y equipo (si cambió de club, sólo lo de este equipo): Min y xG sin penaltis si el documento trae esa columna (si no, ExpG total, y la etiqueta lo dice). El % es sobre la suma del xG de todos sus jugadores. La raya = xG del equipo / minutos de los jugadores con xG > 0 × minutos del jugador (sin porteros ni defensas que no rematan, que inflaban el «×N»); «×N» = su xG entre esa raya. xG/90 sólo con 90 minutos o más. «Muy concentrado» si el primero hace el 30 % o más; «en tres» si los tres primeros llegan al 55 %. Si el rival no cruza con Opta, no sale",
          },
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
          {
            que: "De un vistazo",
            es: "«Un equipo de un vistazo» de Wyscout, con el rival fijado: V-E-D, los últimos cinco (V/E/D, el más reciente a la derecha), el mapa de progresar y pisar área, «En pocas palabras», las fases (con cuántas de sus cifras están entre los 6 primeros y los 6 últimos; si salen parejas, se dice), «Donde destaca», «Donde sufre» y «Su estilo». La lectura del mapa, en tres frases: qué hace, qué hacemos y qué entrenamos. Los sistemas llevan su fuente (Wyscout) y su base. Mientras carga, cada bloque dice qué viene; Evolución comparada, Reparto del xG y estos datos se cargan al asomar o a los 2-3 s, y si no hay dato no se pintan",
            cuenta: "Puesto y mediana con puestoEnLiga (lib/rivals/puesto-liga.ts), la misma cuenta que Plantillas y Área: «Donde destaca» sólo entre los 6 primeros de 20 y «Donde sufre» entre los 6 últimos. En «Su estilo», las cifras con sentido van del mejor al peor (PPDA, del que más aprieta al que menos) y las de estilo puro, de más a menos. Si las fases salen empatadas, la frase de «lo mejor y lo menos destacado» no sale",
          },
          { que: "Cifras de cabecera", es: "xG a favor y en contra, remates y PPDA por partido: manda Opta y Wyscout va en pequeño como «2.ª lectura»; en PPDA, con su puesto en Wyscout y, si no coincide, por qué (cada proveedor cuenta a su manera las acciones defensivas)" },
          { que: "Estilo y momentos · Jornada a jornada · Remates", es: "De Opta: quién aprieta por franjas de 15′, su radiografía, su evolución en seis métricas y dónde remata y le rematan" },
          { que: "Si no sale", es: "El rival no cruza con Wyscout, o en Opta no es de nuestro grupo" },
          PERCENTIL,
        ],
      },
    ],
    ojo: ["Una cifra por métrica (lib/rivals/cifra-principal.ts): en PPDA, xG y remates manda Opta, la temporada como cociente de las sumas (pases que deja dar entre acciones defensivas, sumados), con puesto y mediana entre los equipos de su grupo; Wyscout queda como 2.ª lectura en el detalle. La proyección del Plan cuenta partido a partido (media de los PPDA de cada partido) y por eso no repite esa cifra como «de la temporada». Nombres de equipo con lib/rivals/nombre-equipo.ts («Atlético Madrileño», nunca «Atlético Madrid B») y de jugador con el de su plantilla (lib/rivals/nombre-jugador.ts: «Flakus»). El puesto, el de la plantilla; si su once le pone en otro sitio, «extremo izquierdo en su once (delantero de origen)» (lib/rivals/colocacion-once.ts). Evolución comparada compara los últimos 5 partidos con los anteriores, la misma ventana y el mismo umbral que el Plan de partido (lib/proyeccion/base.ts, resume)."],
  },
  {
    ruta: "/scout-rival-abp",
    titulo: "ABP del Rival",
    resumen:
      "Su balón parado: cuánto peligro tiene, quién lo lanza y lo remata, qué repite, la proyección del próximo partido y el material de la jornada (clips, apuntes y láminas).",
    origen:
      "Scouting propio registrado aquí (documento «abp-rival-scout» de Supabase) o, si no lo hay, lo deducido de nuestras cuatro hojas de ABP. Sin acciones registradas, Wyscout y las etiquetas de Plantillas rivales. La proyección, de Opta. Las estaturas, de BeSoccer por encima de la hoja.",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Lo nuevo (18/11/2026): las visuales de las ideas de X",
        filas: [
          { que: "Nuestro balón parado · qué hacemos", es: "Tres líneas: «El dato · Wyscout», «Qué hacemos» (la decisión) y «Qué entrenamos»" },
          { que: "Quién lo lanza y quién remata · qué hacemos", es: "Numerado: 1, las marcas en el córner como parejas (nuestro → suyo, con su motivo); después, los que entran desde el banquillo y a quién vigilar" },
          { que: "Goles a balón parado · enlaces", es: "Debajo, «Sus goles en vídeo», «Cómo le marcan» y «Plan de ABP de la semana»" },
          { que: "Barras de la liga", es: "El color es para nosotros: verde si la cifra nos conviene, rojo si no, oro si es de estilo o con poca muestra. La flecha ▲▼ sigue diciendo si le conviene a él" },
          { que: "Quién lo lanza y quién remata", es: "Las cabeceras de Lanzan dicen de cuántos córners y faltas del equipo sale el ≈. Cada nombre abre su ficha de scout con sus vídeos, con el rival ya elegido" },
          { que: "Su balón parado", es: "Las tarjetas de Wyscout dicen «Su balón parado a favor / en contra»: son las del rival, no las nuestras" },
          { que: "Carga", es: "El balón parado se pinta en cuanto llega; mientras llegan las plantillas (Apps Script), los equipos salen de las hojas de ABP" },
          { que: "En todas", es: "Misma idea visual que la publicación de X de la que salió, con la letra del club (Barlow Condensed) en el titular y las cifras, la tarjeta de la app (canto y sombra, día y noche) y una entrada suave. Los datos y las cuentas no cambian" },
          { que: "Sus lanzadores de penalti", es: "Cada lanzador en su tarjeta con el nombre grande y «goles/penaltis marcados» arriba a la derecha (todos sus penaltis en Opta, esta temporada y las anteriores); la portería lleva red y los tiros aparecen uno a uno" },
          { que: "Cómo saca el córner", es: "Las líneas de cada córner se dibujan desde el banderín al llegar; la zona que más repite va de titular (la zona, el lado y su %)" },
        ],
      },
      {
        titulo: "Arriba",
        filas: [
          { que: "Liga · Pretemporada", es: "Dos poblaciones que no se mezclan: en Liga, sus partidos de Primera Federación (Wyscout, frente a los 20 del grupo); en Pretemporada, los amistosos de nuestras hojas. Wyscout, láminas y proyección, sólo en Liga" },
          { que: "Pestañas · Más", es: "Las de lectura (¿Cuánto peligro tiene?, Proyección, Quién, Qué repite, Saques de banda) a la vista; las de trabajo (Apuntes y vídeo, Coding de clips, Recoger y láminas, Registrar) en el menú «Trabajo del analista». El atajo «Recoger la carpeta de la jornada» sólo sale con la sesión de administrador" },
          { que: "El rival", es: "Abre con el del próximo partido; «Cambiar equipo» despliega los demás, por calendario" },
          {
            que: "Tira del rival (bajo el título, 16/11/2026)",
            es: "«▶ Sus goles a balón parado» y «▶ Cómo le marcan a balón parado» (en una ventana, con el filtro de balón parado ya puesto), «▶ Su último partido», «⬇ Clips de Hudl» de sus jugadores si los hay (17/11/2026) y Plan de partido, Plantilla, Colectivo, Individual, Área, Duelos, Pizarra táctica y Pizarra ABP con este rival puesto: la misma tira que en el resto de pantallas del rival",
            cuenta: "Goles de Opta (opta:remates): balón parado = situación del remate distinta de «juego» y «contragolpe»; si no tiene ninguno, se ven todos. Enlaces con ?equipo= y ?rival= (components/rivals/AccesosDelRival.tsx)",
          },
          { que: "Su ataque · Su defensa", es: "Lo que genera el rival / lo que le generan a él" },
          { que: "Scouting propio · Deducido", es: "Propio: sus partidos, con sacador y rematador. Deducido: sólo contra nosotros y sin nombres. La etiqueta de arriba dice cuál se ve" },
          { que: "Filtros", es: "Competición, jornada y tipo de acción" },
          { que: "Visual · Detalle (16/11/2026)", es: "«¿Cuánto peligro tiene?» se abre en «Visual»: láminas con su conclusión en el título: cómo acaban sus acciones (gol, ocasión, remate sin ocasión, sin remate), jornada a jornada (y si los 3 últimos partidos van a más o a menos), qué tipo de balón parado hace más daño (con 3 acciones o más) y, en Liga, lo de Wyscout. «Detalle» son las tarjetas, la tabla de amenaza por tipo y Wyscout como siempre. Se recuerda en este aparato", cuenta: "Mismos filtros y mismo lado (su ataque o su defensa); peligro = gol u ocasión" },
        ],
      },
      {
        titulo: "¿Cuánto peligro tiene?",
        filas: [
          { que: "Acciones · Remates · xG · Goles", es: "Ejecutadas (su ataque) o defendidas (su defensa) en la selección; el xG, acumulado" },
          { que: "Peligro", es: "Las que acaban en gol u ocasión; con menos de 15 acciones detrás se rotula «tendencia» y no se pinta de rojo", cuenta: "acciones con gol u ocasión ÷ acciones" },
          { que: "Amenaza por tipo de balón parado", es: "Lo mismo por córner, falta lateral, falta directa, penalti, banda, saque de centro y de meta" },
          { que: "Lectura al pie", es: "El análisis de cada panel leído para el Castilla: en su ataque, más peligro es rojo; en su defensa, verde" },
          { que: "Su balón parado según Wyscout", es: "En Liga (con o sin acciones registradas, en su propio bloque): «Qué hacemos» y «Qué entrenamos» arriba, con enlace a la pizarra y al microciclo de ABP; luego la barra contra la liga (raya = mediana, rombo = el mejor)" },
          { que: "Cuánto balón parado hay · por partido", es: "Córners, faltas lanzadas y penaltis, los suyos y los que le sacan, con la mediana de los 20 y el puesto. ▲ le conviene, ▼ no: más a favor es mejor para él, más en contra es peor; el puesto va en el mismo sentido (en las faltas que le sacan, 1.º es el que menos encaja). Con menos de 15 casos en la temporada (p. ej. 2 penaltis en 12 partidos) no hay flecha ni puesto: se rotula «tendencia» con los casos. Una cifra sin juicio entre los 6 primeros o los 6 últimos se dice «de los que más / de los que menos (5.º de 20)»; la leyenda ▲/▼ sólo sale si alguna celda lleva flecha", cuenta: "Wyscout, media por partido de la temporada; casos = media × partidos. El subtítulo dice hasta qué partido llega la descarga («hasta el del 9 nov.»)" },
          { que: "Córners con remate", es: "El córner que acaba en un tiro de cualquiera, vaya o no a puerta; «x de y» = córners con remate de sus córners", cuenta: "Tendencia, sin flecha, con menos de 15 córners con remate o 25 córners detrás" },
          { que: "Objetivo de «Qué entrenamos»", es: "Sale del dato, no de una cifra redonda: si le rematan muchos córners, el objetivo es subir nuestro % de córners con remate (Wyscout, con su base) a la mediana de la liga en córners a favor, con lo que le rematan sus rivales como techo de referencia (si ya estamos por encima de la mediana, sostenerlo); si concede muchos, sacarle esos córners" },
          { que: "Quién lo lanza y quién remata", es: "Etiquetas de Plantillas (o Wyscout, ≈ lanzamientos por 90 × minutos), cruzadas con su once probable. «Vigilar» dice quién saca los córners y quién las faltas, con sus lanzamientos estimados («Javi Moreno (≈23) y Joel Jorquera (≈18); las faltas, Chema Núñez (≈8)»). «Qué hacemos» empareja a los nuestros con dorsal, inicial y apellido («5 J. Martínez con 6 A. González») para no confundir nombres de pila. La tabla «Rematan» lista a todos los emparejados y a los etiquetados, con altura y % de duelos aéreos ganados (de cuántos)" },
          { que: "Goles a balón parado", es: "Los que marca y los que encaja: el total y los penaltis son dato; córner y falta, estimado calibrado con Opta" },
        ],
      },
      {
        titulo: "Quién, qué repite y bandas",
        filas: [
          { que: "Lanzadores · Rematadores", es: "Quién ejecuta y quién ataca el balón, con cuántas de sus acciones acaban en gol u ocasión" },
          { que: "Amenaza aérea", es: "Los doce más altos de su plantilla; la barra compara dentro de la plantilla", cuenta: "Manda la estatura de BeSoccer; si la hoja dice otra, salen las dos («hoja 185»)" },
          {
            que: "Sus lanzadores de penalti",
            es: "En «Su ataque», una tarjeta por cada jugador del rival que ha tirado algún penalti (Opta, evento a evento: «opta:penaltis»): su pie, una línea con su lado más repetido y si en el último lo cambió (en dorado si lo cambió), y la portería en seis zonas con cada penalti (gol en dorado, parado en azul, fuera o al palo hueco). Esta temporada (desde el 1 de julio) y las anteriores, por separado. Si no tiene penaltis en Opta, no sale. La misma hoja va al final del PDF de nuestro portero en la pizarra de ABP («PDF por jugador»)",
            cuenta:
              "Zona por dónde cruzó la línea de gol, vista desde el punto: izquierda, centro o derecha del lanzador (tercios entre palos) × raso o arriba (mitad de la altura del larguero); los de fuera, en la zona a la que iban. Lado más repetido: al menos dos y más que los otros; el portero lo lee al revés (su izquierda es tu derecha)",
          },
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
          {
            que: "Cómo saca el córner",
            es: "Cada córner del rival en la temporada (Opta, evento a evento), por su lado de saque (derecha o izquierda). Arriba de cada lado, como el original de X («¿Cómo saca cada equipo sus córners?»), el área atacando hacia arriba con una línea por córner desde su banderín hasta donde cae el balón: punto oro si el siguiente toque es un remate, verde si llega a un compañero, rojo si no llega y bola blanca si la jugada acabó en gol, con sus porcentajes debajo. Después, por dónde cae: en corto, primer palo, punto de penalti, segundo palo o frontal. Al lado, la parte del resto del grupo desde ese lado (la raya de la barra), los que acaban en remate y los remates y el xG de la acción (con la segunda jugada)",
            cuenta:
              "Zona por el destino del pase: en corto si Opta lo marca así; frontal si cae antes del área (x < 83); dentro, por la anchura vista desde el banderín: primer palo hasta el primer poste, punto de penalti entre los postes y segundo palo más allá. Se resalta la zona que se separa 10 puntos o más del grupo, con 8 córners de ese lado como mínimo; la que más se separa pasa a la consigna del córner en «Dónde más riesgo»",
          },
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
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
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
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Lo nuevo (17/11/2026, ronda 20)",
        filas: [
          { que: "Qué hacemos con los centros", es: "Encima del mapa de dos ejes, cada uno abre con «Cuando ellos centran:» o «Cuando les centramos:»" },
          { que: "Barras donde menos es mejor", es: "«Centros que recibe» y «Acierto de los centros que recibe»: el rombo dice «el mejor (menos es mejor)» y la lectura va girada" },
          { que: "Por dónde ataca · total de centros", es: "Sus centros aquí son la suma jugador a jugador (por 90 × minutos); el redondeo puede separarlos en uno o dos del total del equipo de Wyscout de las barras" },
          { que: "Láminas del área", es: "Sin láminas de la jornada no se pinta nada; el analista ve sólo «Añadir láminas del área»" },
          { que: "Análisis visual sin láminas", es: "Al cuerpo técnico no le sale; al analista, una sola línea con «Editar láminas», que no va al PDF ni al PNG" },
          { que: "Por dónde ataca · columnas de carriles", es: "Un botón ▶ por jugador al pie de cada carril, con sus cortes en Scout individual" },
          { que: "Objetivo de centros", es: "Si la meta queda a menos de un centro por partido de lo que ya hacemos, no hay objetivo de volumen: se mantiene y manda el acierto. Con el mismo acierto que le hacen sus rivales, se dice que coincide" },
          { que: "Tira de accesos del rival (17/11/2026)", es: "A la vista, el vídeo del rival (sus goles, cómo le marcan, su último partido), ⬇ Clips de Hudl si los hay, Plan de partido, Duelos y ABP; el resto de pantallas del rival, en «Más», con el rival ya puesto" },
          { que: "Por dónde ataca · el centro", es: "Quién carga el carril central sale de centros, regates y pases al área; las acciones progresivas (que suman los centrales) sólo si no hay nada más" },
        ],
      },
      {
        titulo: "Sus centros según Wyscout",
        filas: [
          { que: "El rival", es: "Abre con el del próximo partido, o con el que trae la dirección (?equipo=, desde las demás pantallas del rival); «Cambiar equipo» despliega los demás, por calendario" },
          { que: "Accesos del rival", es: "Bajo el título, la misma tira que en todas las pantallas del rival: ▶ sus goles en vídeo, cómo le marcan y su último partido (en una ventana; aparte, «Cómo son sus goles ›» abre Análisis de goles), Plan de partido, Plantilla, Colectivo, Individual, ABP, Duelos y las pizarras, con este rival puesto" },
          { que: "Un solo titular (17/11/2026)", es: "El del mapa, con su base: «centra mucho y mal: 3.º de 20 en volumen y 19.º en acierto (60 precisos de 208 en 12 partidos)». Debajo del mapa, lo nuestro en percentil: «P89 en centros por partido · P5 en centros precisos»" },
          { que: "Mapa de dos ejes (arriba)", es: "Lo primero tras el titular. Los equipos de la liga en centros por partido frente a centros precisos %, en percentil dentro de la liga, con el rival en azul y el Castilla en oro; el título dice la conclusión («Real Murcia centra mucho y mal: 3.º de 20 en volumen y 19.º en acierto»)", cuenta: "Wyscout, esta temporada, su competición; percentil de cada equipo entre los de la liga en cada eje; el puesto, 1 + los equipos con más (de más a menos)" },
          { que: "Cuando nos centran · Cuando les centramos", es: "Los dos bloques, rotulados por quién centra: sus centros laterales (cuando nos centran) y los centros que recibe (cuando les centramos)" },
          { que: "Sus centros · Los que recibe", es: "Por partido o en porcentaje frente a los equipos de la liga; «x de y» es la base real" },
          { que: "Barra", es: "El rival en oro entre cero y el máximo de la liga: la raya es la mediana de los 20 equipos y el rombo verde, el mejor (la leyenda va una vez, encima de las tarjetas). Cada cifra lleva su base: «17,3 por partido · 208 en 12 partidos» o «60 de 208»" },
          { que: "Por dónde ataca · quién centra", es: "Debajo: sus centros, regates y pases al área por banda y quién carga cada una, el bloque entero vive aquí (en el Scout colectivo va en una línea con enlace a éste); el titular da el reparto por carril (el mismo número que el campo) y, aparte, sólo por fuera; cada nombre abre su ficha y «▶ Su vídeo», sus cortes en Scout individual" },
          {
            que: "▲ ▼ y puesto",
            es: "Mejor o peor según le convenga a ese equipo; el puesto va del 1.º (el mejor) al último y es el mismo que en el Scout colectivo y Plantillas. La flecha sólo sale entre los 6 primeros (▲) o los 6 últimos (▼) de 20; en medio, «en la zona media de la liga»",
            cuenta: "puestoEnLiga (lib/rivals/puesto-liga.ts) con los equipos de su competición esta temporada en Wyscout (sin copa): 1 + los que están estrictamente mejor; mediana de verdad (media de los dos del medio)",
          },
          { que: "Tendencia", es: "Un porcentaje con menos de 15 casos arriba o 25 abajo, o menos de 10 partidos: sin flecha ni color" },
          {
            que: "Qué hacemos · Qué entrenamos",
            es: "Criterio de juego a partir de la cifra, encima de la tabla: la cifra lo sostiene, no lo dicta. El titular lleva su base («60 precisos de 208 en 12 partidos»). En nuestro ataque, el objetivo de acierto es «mantener o subir» lo nuestro frente a lo que le hacen sus rivales, en la misma unidad. Cada «Qué hacemos / Qué entrenamos» va bajo su bloque (su ataque junto a sus centros; el nuestro junto a los que recibe). Los objetivos salen en la MISMA columna que el dato y nunca por debajo de lo que ya hacemos: en su ataque, la mediana de centros precisos de la liga (con el mejor centrador como referencia); en el nuestro, mantener o subir frente a lo que le hacen sus rivales: los centros por partido (los suyos o los nuestros, si son más) y que llegue a un rematador nuestro al menos el acierto que consiguen sus rivales contra él (o el nuestro, si es más), diciendo si es mantenerlo o subirlo. «Meter en el microciclo» abre el editor de microciclos",
            cuenta: "«Cuando les centramos» mira cuántos centros recibe y también su acierto: si el acierto de los centros que recibe está entre los 6 peores de 20 (y no es tendencia), «el X % de los centros que le hacen llega a un rematador contrario (n de m)… defienden mal el centro: atacar el área con centro y tres rematadores»; si está entre los 6 mejores, «probar primero por dentro» lleva ese porqué",
          },
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
      "Nombres de equipo con lib/rivals/nombre-equipo.ts («Atlético Madrileño», nunca «Atlético Madrid B») y de jugador con el de su plantilla (lib/rivals/nombre-jugador.ts: «Flakus»). El puesto, el de la plantilla; si su once le pone en otro sitio, «extremo izquierdo en su once (delantero de origen)» (lib/rivals/colocacion-once.ts).",
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
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Arriba",
        filas: [
          { que: "AHORA · Jnn", es: "La jornada del próximo partido en cuanto el de la semana del calendario ya se ha jugado (la misma regla que la portada)." },
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
    origen: "Se escribe aquí y se guarda solo. Fecha y hora, del calendario de BeSoccer; estadio, medidas, foto y escudo, de BeSoccer y OpenStreetMap; la distancia y el tiempo de Valdebebas al estadio, de la ruta de OSRM (o de la memoria de trayectos del analista).",
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Lo primero de la pantalla",
        filas: [
          { que: "Partido que se abre", es: "El próximo partido fuera, con la fecha de BeSoccer de cada partido y la regla de la portada (fecha y hora de Madrid y 2,5 h de gracia). Si no hay calendario, la fecha de la hoja." },
          { que: "Datos por poner", es: "Sin errores ni avisos, lo que falta es una pastilla «N datos por poner»; al abrirla, una fila con un botón por dato que lleva a su campo" },
          { que: "Enlaces del rival", es: "Plan de partido, Informe del rival, Su ABP y Análisis de sus goles a la vista, con el rival ya elegido; el resto en «Más del rival»" },
          { que: "Horario tipo", es: "Sin guardar, la cabecera dice «Horario tipo por la hora del partido»" },
          { que: "Cómo va el viaje y No olvidar", es: "El administrador lo ve abierto con lo que falta; el resto del cuerpo técnico sólo si hay errores o avisos, y «No olvidar» sólo si tiene algo escrito" },
          { que: "Más del rival", es: "Plan de partido e Informe del rival a la vista; sus goles, cómo son, su ABP y su plantilla, en el menú «Más del rival»" },
          { que: "El día del partido", es: "En el móvil las citas van en dos columnas" },
          { que: "Carga", es: "El calendario y la hoja RIVALES salen de la copia del aparato y se renuevan por detrás: abre al momento aunque la hoja esté dormida" },
          { que: "Accesos de arriba (18/11/2026)", es: "«Cómo son sus goles» es un botón como los de al lado (en el móvil era texto suelto). Los jugadores no ven «Plan de partido»" },
          { que: "Al entrar", es: "Abre el próximo partido; los demás siguen en el selector (✓ = viaje ya guardado). Copiar de otro viaje, Plan de partido, Informe del rival, Sus goles en vídeo (en el pop-up de la portada, 18/11/2026, con «Cómo son sus goles ›» al lado, a Análisis de goles), Su ABP y Su plantilla van en una sola fila, siempre con el rival de ese viaje ya elegido (por su fila de la hoja RIVALES o, sin ella, por su nombre); en el móvil, en una rejilla de dos columnas. El único botón de la cabecera es «Sacar los documentos»; con el horario aún propuesto, al lado, en texto, «Propuesta · aún sin guardar»" },
          { que: "Titular y chapa", es: "El titular dice sólo el viaje («Viaje a Gimnàstic de Tarragona · viernes 13, 21:15»); debajo, una chapa de color con cómo va («El horario no cuadra · 2 errores · 1 aviso»). Pinchándola se abre «Cómo va el viaje». Si lo único que queda son datos por completar, la chapa no sale: eso lo cuenta sólo «Cómo va el viaje»", cuenta: "Rojo si hay errores, ámbar si sólo avisos y verde si está todo; los mismos recuentos que «Cómo va el viaje»" },
          { que: "Horas por fijar", es: "Una cita cuya hora no se ha podido calcular (por ejemplo, una ruta que llega sin minutos) sale «por fijar», al final de su día y en ámbar; nunca con una hora inventada. Es la primera tarea de «Cómo va el viaje», con «Poner la hora», y el botón de sacar dice «Faltan N horas» y lleva a la primera en vez de exportar", cuenta: "El dossier no nombra los trayectos sin hora ni ningún dato roto; la hoja A4 sólo coloca las citas con hora. Hoja, resumen y editor van en el mismo orden (por hora)" },
          { que: "Sacar igualmente", es: "Con errores en el horario el botón dice «Sacar igualmente»: se puede sacar, y el motivo va en el propio botón y en el diálogo («El horario tiene 2 errores; se puede sacar igual, pero saldrá así»)" },
          { que: "Partido · estadio · hotel", es: "Lo primero tras la cabecera, en el móvil y en el escritorio: salida, partido, hotel y horario, con la jornada, la competición, el césped y las medidas con su fuente; «Editar» abre los tres bloques. La salida es la primera cita de salida del primer día; si no hay ninguna, no se nombra" },
          { que: "Línea del día", es: "Debajo de los datos del viaje, el día del partido en una línea horizontal: cada cita con hora, de la primera a la última (comida, salida, llegada, calentamiento, partido…), el partido en oro. En el móvil se desliza de lado" },
          { que: "Cómo va el viaje", es: "Plegado de entrada (abierto sólo si hay un error), bajo un titular con el contador y lo que falta nombrado («2 avisos · 4 por completar: distancia al estadio, foto del estadio, plano del estadio y 1 más»), y la barra de lo hecho. Un clic lo abre. Dentro, los cuatro avisos más graves (rojos primero), el resto en «N avisos más», lo «por completar» y, al final, «Hecho: N de M datos»", cuenta: "La barra va en rojo si hay errores, ámbar si hay avisos, dorado si queda algo por completar y verde si está todo" },
          { que: "La primera cita no nombra Valdebebas", es: "Si la primera salida del viaje no nombra el sitio de «Sale de», es una tarea más de «por completar», con el cambio propuesto («Salida bus» → «Salida bus desde Valdebebas») y el botón «Corregir», que lo escribe en la cita" },
          { que: "Cada aviso", es: "Un titular con verbo y su botón («Mueve «Llegada aproximada Valdebebas»: va antes del partido» · Ver). Plegado en «¿por qué?»: de dónde sale cada dato (hoja del horario, hora del partido de la ficha, BeSoccer para el nombre del rival), la cuenta con sus cifras y la regla", cuenta: "Ejemplos: «llegada 13:15, partido 21:15 = 8 h antes»; «salida 12:30, llegada 12:39 = 9 min» (ningún tren dura menos de 20 min: una de las dos horas de la hoja está mal tecleada); con la ruta calculada, el trayecto se compara con lo que dura y se avisa por debajo del margen" },
          { que: "Aplicar los N arreglos seguros", es: "Con dos o más, un botón aplica de una vez los arreglos que no piden decidir nada (quitar las citas de partido de un día copiado, corregir erratas), con un solo «Deshacer»; cada uno sigue también en su aviso", cuenta: "Se aplican en orden: la errata de una cita que otro arreglo ya quita no se cuenta. «Convertirlo en víspera» no entra: es una decisión" },
          { que: "Por completar", es: "Una lista con marca por punto, campo a campo, con el dato exacto que falta («foto del hotel», «teléfono del hotel», «lista «No olvidar»»); el propio dato y su botón «Poner» abren el bloque y llevan a ese campo", cuenta: "Cuenta cada dato vacío que el documento llevaría (estadio: nombre, dirección, distancia, tiempo, foto, plano y ruta; hotel: nombre, teléfono, entrada, foto y ruta; hora; «No olvidar») más las medidas por elegir. Un bloque con su nombre escrito no sale si no le falta nada. El horario ya montado no cuenta: lo que tenga mal lo dicen sus avisos" },
          { que: "No olvidar", es: "Plegado también en el ordenador (el horario y la vista previa van primero). La línea del pie de la hoja del horario, una cosa por línea. El ejemplo («traje de paseo, DNI, botas de recambio») va fuera del cuadro, para que no parezca escrito" },
          { que: "Orden", es: "El mismo en el móvil y en el escritorio: «Partido · estadio · hotel», «Cómo va el viaje» plegado, el documento («Cómo va a quedar») y el formulario: el horario, «No olvidar» y, plegado, «Más datos». En escritorio ancho, el formulario a la izquierda y el documento a la derecha, en la columna ancha y siempre a la vista" },
          { que: "Más datos", es: "Lo que no es el horario, junto y plegado: cómo se llega al estadio y el hotel (si les falta algo), las fotos de los lugares de salida y «Cómo salió el viaje». Las tareas de «Cómo va el viaje» lo abren solas; después del partido sale abierto" },
          { que: "Vista previa", es: "En escritorio, pulsar la miniatura la abre a pantalla completa con zoom. En el móvil la miniatura a escala no se lee, así que no se pinta: la acción principal es «Ver el dossier (o el horario) a pantalla completa»" },
        ],
      },
      {
        titulo: "El horario",
        filas: [
          { que: "Viaje propuesto según la distancia", es: "Mientras no se toca, el viaje se propone con lo que se tarda de Valdebebas al estadio. Cerca, en el día y sin hotel: comida en Valdebebas, charla, salida, llegada al estadio, calentamiento, partido y vuelta. Lejos, la víspera con hotel. Sin ruta ni distancia en la hoja, se usa el tiempo de un viaje anterior guardado al mismo rival (el «Tiempo» de su estadio); si no lo hay, la media de los viajes fuera de la temporada con tiempo escrito (basta uno), que sólo coloca la salida: no se escribe en el estadio y nunca propone hotel. Sin ninguna base: comida prepartido (unas 4 h antes del partido), llegada al estadio, calentamiento y partido. Todas son citas que se editan. La distancia y el tiempo quedan escritos en el estadio", cuenta: "Se duerme fuera desde 150 km (o 2 h de autobús si sólo se sabe el tiempo). Cerca: salida = llegada al estadio (90 min antes del partido) − lo que tarda el autobús; vuelta = partido + 1 h 45 + el trayecto. Lejos: la víspera sale a las 16:00 salvo que no dé para llegar a las 20:00; llegada al hotel = salida + trayecto; vuelta a Valdebebas = partido + 1 h 45 + trayecto. El autobús es la ruta en coche de OSRM × 1,15 redondeada a 5 min" },
          { que: "Días", es: "En casa abre con uno; fuera, según la distancia (arriba). Cada día es una hoja A4" },
          { que: "Horario elástico", es: "Al cambiar la hora del partido, el día del partido se mueve solo; los demás días van por reloj" },
          { que: "Horas", es: "Se escriben enteras («1830», «18.30») y se guardan al salir del campo; flechas ±5 min. Lo dice la ayuda emergente de cada hora, no un texto fijo. En el editor, la letra no baja de 14 px" },
          { que: "Editar · Opciones del día", es: "Un solo mando por día: plegado, sólo «Editar» (y «Pegar» si hay un día copiado); al abrirlo aparece «Opciones del día» (plantilla, mover, copiar, replicar, vaciar o quitar el día)" },
          { que: "Añadir cita", es: "La paleta de eventos (🚌 salida, 🍝 comida, ⚽ partido…) va plegada; se arrastra al día o se toca y llega con su hora. El emoticono sale del mismo catálogo por palabra clave" },
          { que: "Trayectos", es: "Cada salida dice de dónde a dónde; en autobús la duración se calcula sola (OSRM sobre OpenStreetMap) y la llegada cae sola" },
          { que: "Duraciones recordadas", es: "Si corriges una duración, ese trayecto vale así en los viajes que vengan" },
          { que: "Encadenar", es: "Cambiar una hora o una duración corre las citas de detrás, hasta la primera fijada (📌) o el partido" },
          { que: "Avisos del horario", es: "Día de partido copiado, vuelta antes del partido, trayectos imposibles (un tren de 9 min)…: cada uno con su arreglo; nada se cambia solo" },
          { que: "Erratas", es: "Marcadas en su fila, en una línea aparte bajo el nombre, con la corrección propuesta («Llehagda» → «Llegada»); la aplica el analista con «Corregir»" },
          { que: "Día plegado", es: "Las citas en columnas que se leen de arriba abajo, como la hoja A4: primero la columna de la izquierda, luego la siguiente; el nombre de la cita va entero" },
          { que: "Copiar de otro viaje", es: "Cualquier viaje montado: el horario, los avisos, y el estadio y el hotel si es el mismo rival. Un día suelto también se copia y se pega" },
        ],
      },
      {
        titulo: "Estadio y hotel",
        filas: [
          { que: "BeSoccer y OpenStreetMap", es: "Estadio, dirección, aforo, foto y escudo vienen rellenos" },
          { que: "Medidas con fuente", es: "Se cotejan OSM, BeSoccer y la hoja RIVALES. Si ya hay medidas, el aviso dice cuál se usa y cuáles hay («se usa 102 × 67 (BeSoccer) · también 105 × 68 (hoja RIVALES)») con «Cambiar»; sólo sin medidas pide «Elegir»", cuenta: "Una sola regla en el aviso, el resumen y la diapositiva: la medida escrita y su fuente («102 × 67 · BeSoccer»)" },
          { que: "Fotos de los lugares de salida", es: "Valdebebas, estaciones…: se ponen una vez y valen para todos los viajes" },
        ],
      },
      {
        titulo: "Lo que sale",
        filas: [
          { que: "Dossier", es: "Como mucho tres diapositivas, sin portada: el estadio, el hotel (si lo hay) y el viaje (si hay trayectos). Lo vacío no sale y las fotos llenan la hoja" },
          { que: "Sacar los documentos", es: "Un solo botón, el de la cabecera (en el móvil, también fijo abajo al bajar): abre el panel con todos los formatos" },
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
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Las cuatro dimensiones",
        filas: [
          { que: "Fecha de las notas", es: "Encima del campo, «Notas de la valoración del dd/mm · hace N días»; pasados 14 días va en ámbar: el estado puede haber cambiado" },
          { que: "Jugadores foco", es: "Nombre y eje más bajo con su nota en dos renglones; debajo, Ficha, Dashboard Seguimiento y Valorar" },
          { que: "Media de la línea", es: "Bajo cada radar, la nota de la línea en cada eje y, al lado, su diferencia con la media de la plantilla" },
          { que: "Escala", es: "Élite ≥ 8,5 · Alta ≥ 7,5 · Correcta ≥ 6,5 · Mejorable < 6,5 (antes «Media»)" },
          { que: "Lectura del once", es: "Media de los titulares valorados, con una valoración por jugador; la media de plantilla dice de cuántos evaluados sale" },
          { que: "Jugadores foco", es: "Su eje más bajo, con Ficha, Seguimiento y Valorar a un toque" },
          { que: "Cabecera", es: "Una acción principal, «Editar valoraciones»; «Ver explicación», la media del equipo y restablecer líneas, en «Más»" },
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
          { que: "Radares por línea", es: "Seis radares con los del once: portero y defensa, defensa, perfil izquierdo, perfil derecho, medios y puntas. En modo día el campo es claro (de noche, el azul de siempre); los colores de la escala no cambian", cuenta: "Un jugador puede estar en dos líneas: las medias se leen por separado y no se suman" },
          { que: "Fichas del once", es: "Cada titular en su sitio: el aro es su media y la flecha, el cambio desde la evaluación anterior; al pulsarlo, su perfil y debajo el banquillo", cuenta: "Flecha desde 0,25; punto rojo si baja 0,5 o más o un eje cae 1 punto" },
          { que: "Titular sin valorar", es: "Entra con la media de la plantilla y no cuenta en las medias" },
          { que: "Cambiar el once en la pizarra", es: "El único botón para cambiar el once: lleva a la pizarra táctica. Quién entra en cada radar se cambia más abajo, en «Perfiles por línea» (los seis en dos columnas), y «Restablecer líneas» (en «Más») lo deshace" },
          { que: "Lectura del once", es: "«Media de N de M titulares valorados»: sólo cuentan los titulares con valoración propia (quien lleva la media de la plantilla sigue en el campo y en los radares, pero no aquí). Qué entrenamos y un solo bloque «Jugadores foco · su eje más bajo» (los tres más bajos en el eje a trabajar y quien tenga algún eje bajo 6,5); cada nombre lleva, con texto, a «Ficha» y a «Valorar» (abre «Editar valoraciones» con él ya elegido); al pulsar un jugador, su perfil con Ficha, Seguimiento, Registrar seguimiento, Valoraciones y «Valorar de nuevo»", cuenta: "El rótulo dice «tendencia (una valoración, dd/mm)»; con menos de 3 valorados, tendencia" },
          { que: "Frase de arriba", es: "Los tres titulares valorados más bajos, con su media, y el eje a trabajar del once valorado. No ordena líneas: cada una tiene de 2 a 5 jugadores" },
          { que: "Radar con menos de 3 jugadores", es: "La cifra grande lleva «tend.» y el radar va atenuado" },
        ],
      },
      {
        titulo: "Las cifras",
        filas: [
          { que: "Jugadores analizados", es: "Los N con valoración emocional, once y banquillo (no sólo el once); la lectura del once cuenta sólo a los titulares", cuenta: "Con menos de 12, tendencia" },
          { que: "Perfiles por línea", es: "El rótulo dice la población: cada radar, los jugadores de su línea; la raya, la media de los N evaluados" },
          { que: "Fecha de la valoración", es: "Arriba, «Estado del once según la valoración del dd/mm»; pasados 14 días, «a revisar» con el botón «Valorar de nuevo antes del partido», que abre el editor" },
          { que: "Base", es: "Una valoración por jugador; una línea suma de 2 a 5", cuenta: "Por debajo de 25 valoraciones la media de una línea es tendencia, y se marca así en cada radar" },
          { que: "Media de la línea", es: "Bajo cada radar, las cuatro cifras de los jugadores de esa línea; el trazo discontinuo es la media de la plantilla" },
          { que: "Media de plantilla", es: "Media de las medias de cada jugador evaluado, con su banda de la escala" },
          { que: "Dimensión más fuerte · Dimensión a desarrollar", es: "La de media más alta y la más baja del grupo" },
          { que: "Editar valoraciones", es: "Cambia las cuatro notas de un jugador; «Ver las valoraciones» abre las hechas aquí" },
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
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Cómo se organiza",
        filas: [
          { que: "Innegociables", es: "Los tres principios marcados CLAVE en la hoja salen una vez, como tarjetas iguales con candado en la lista del bloque; sin caja de chips aparte" },
          { que: "Cifra de cada innegociable", es: "Una barra por partido, el último con su base (n de total) frente a la mediana de los equipos del grupo y la temporada (lib/identidad/campo.ts, medidaDelPrincipio); mientras carga, un esqueleto de la misma altura; sin cifra, la tarjeta va compacta con el título" },
          { que: "Otros principios del bloque", es: "Los que sólo son un título y no son innegociables, plegados en una línea que dice cuántos son" },
          { que: "Colores de las barras", es: "Oro: partido del lado bueno de la mediana de los 20 equipos; ámbar claro: del lado malo. La etiqueta de la mediana va al lado contrario de la barra elegida" },
          { que: "Tendencia y temporada", es: "Junto al veredicto, cuántos de los 3 últimos partidos quedaron del lado bueno; en los chips, la cifra del partido y la media de la temporada" },
          { que: "Refuerzo", es: "Lo que se sostiene también lleva su listón (la mediana) y el enlace al microciclo de la semana" },
          { que: "Gráfico por jornada", es: "Eje desde 0, mediana rotulada sobre la raya azul y la cifra encima de la barra elegida; en el móvil, número de jornada de dos en dos (la última siempre)" },
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
          { que: "Innegociable", es: "Los que la hoja marca «CLAVE»: borde dorado y candado. Fuera de edición las tarjetas no llevan el número de la hoja (saltaba: 2, 5, 6); en edición, sí" },
          { que: "Lo que no se negocia", es: "Arriba del apartado, un chip por innegociable con cifra: verde con ▲ si el último partido quedó del lado bueno de la mediana del grupo, ámbar con ▼ si no; cada chip salta a su tarjeta. El innegociable sin cifra no sale aquí, sino en «Otros principios»" },
          { que: "La frase de debajo", es: "Nombra en qué cumplimos y qué nos falta en el último partido, cada uno con su cifra frente a la mediana del grupo y a cuántos puntos queda", cuenta: "La distancia se resta con las cifras ya redondeadas que se leen (15,4 y 16,1 dan 0,7); en una métrica en % son puntos, no un porcentaje" },
          { que: "Otros principios del bloque", es: "Los que sólo son un título (sin texto en la hoja ni cifra): el innegociable sin cifra (Amenazar la profundidad) a la vista con su candado; el resto, plegado en «Otros N principios del bloque»" },
          { que: "El desplegable", es: "Definición, qué se ve, criterio y clip, sólo si la hoja los trae" },
        ],
      },
      {
        titulo: "Se mide cada jornada",
        filas: [
          { que: "El gráfico", es: "Una barra por partido de la temporada (J1…), la raya azul es la mediana de los equipos del grupo; en oro los partidos del lado bueno, en ámbar los de debajo. El título dice cuántos partidos quedaron del lado bueno y si «se sostiene» (la mitad o más) o «toca entrenarlo»" },
          { que: "La línea de las bases", es: "Bajo el título, las dos poblaciones: la mediana de la temporada de los equipos del grupo (raya azul) y la del Castilla en sus N partidos" },
          { que: "Tocar una barra", es: "La elige (recuadro azul): la línea de debajo pasa a ese partido, con su cifra, rival, jornada y a cuántos puntos queda de la mediana (o por encima). Sin tocar, el último" },
          { que: "▲ / ▼", es: "El partido elegido, mejor o peor que la mediana del grupo; el último lleva su base (28 de 53)" },
          { que: "Análisis del partido · Goles en vídeo · Ficha", es: "Del partido elegido: su post en Data análisis (/data-analisis?area=post con fecha y rival), los goles del rival en vídeo (en el pop-up de la portada, 18/11/2026) y su ficha en /rivals" },
          { que: "Qué entrenamos", es: "Si «toca entrenarlo»: tarea del principio, qué contar (con la base del último partido) y el objetivo de partido, la mediana del grupo; enlace al microciclo de la semana y «Jugadores que lo ejecutan mejor →», que abre /identidad-posicional en «¿Quién lo ejecuta mejor?» con el puesto de esa métrica (pases y progresión: centrocampistas; duelos aéreos e interceptaciones: centrales; regates y duelos ofensivos: extremos; remates y profundidad: delanteros)" },
          { que: "Partido a partido →", es: "Su fila en /identidad-campo" },
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
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Cómo se rellena",
        filas: [
          { que: "Ranking sin entrar", es: "El ranking de acierto de la temporada y «La comida» se ven sin entrar en la quiniela: sólo los pronósticos de la jornada que sigue abierta son privados. Salen de las jornadas cerradas con resultado (de la J4 en adelante)." },
          { que: "Documento recompuesto", es: "El 20/11 la quiniela quedó guardada con el historial troceado letra a letra (el rescate de Supabase la dejó como texto y una apuesta de la J13 la esparció). Al leer y al guardar, la app junta esas letras, recupera las jornadas 4 a 12 y las funde con lo de ahora (lo nuevo manda); el primer guardado deja el documento limpio." },
          { que: "La comida", es: "Cuenta sólo el bloque de diez jornadas en curso. Dice «Arranca el bloque» únicamente si ninguna jornada del bloque tiene resultados; en cuanto hay alguna, enseña quién come gratis por ahora, su acierto y a cuántos aciertos está el primero que paga." },
          { que: "Reglas", es: "«Reglas completas» sale una vez, en la cabecera de «La comida», y abre el detalle de las reglas al pie de «Cómo se cuenta» («Ver el detalle»)." },
          { que: "Ranking de acierto sin entrar", es: "El ranking de la temporada se ve sin entrar, con la jornada abierta o cerrada, y ahora también en «Jornadas anteriores» cuando la jornada está cerrada. Sale en cuanto hay algún resultado en la temporada; mientras se lee el documento, su hueco aparece en gris." },
          { que: "Acertados / jugados", es: "Cada persona lleva sus acertados y sus jugados: en escritorio, en la columna «Acertados / jugados» (43/80); en el móvil, bajo el nombre («43 de 80 acertados»). Jugados son los partidos con resultado desde su primera apuesta; el que no se pone cuenta como fallo." },
          { que: "Un solo «Entrar»", es: "Con la jornada cerrada y sin haber entrado, el acceso está sólo al final de la pantalla («Entra para ver lo tuyo»); ya no hay otro botón «Entrar» arriba." },
          { que: "Letra de la parrilla", es: "En «Lo que ha puesto cada uno», los signos, el reparto (1 · 7  X · 1), «sin apostar», los rótulos y la fila de aciertos van a 12 px como mínimo." },
          { que: "Los partidos, equipo a equipo", es: "Cada partido de la jornada lleva una ficha por equipo: escudo, nombre (a su ficha de /rivals), su puesto en la liga y su balance de la temporada como mini barra verde-gris-roja (ganados, empatados, perdidos). Puesto y balance salen de la clasificación más reciente de BeSoccer; si no han llegado, sale el nombre solo." },
          { que: "Accesos de cada equipo", es: "Debajo de cada equipo, una fila de botones: Sus goles (pop-up de vídeo), ABP, Análisis (colectivo del rival) y Plan JNN. Van con el rival ya elegido: el ID de su fila en la hoja RIVALES (su próximo partido contra el Castilla) y, si no hay fila, por el nombre. «Plan» sólo sale si esa fila existe." },
          { que: "Última jugada", es: "La columna «Última jugada · JNN» del ranking da los aciertos de cada uno en la última jornada con resultados anterior a la que se mira. Pulsar el título abre esa jornada con sus resultados y lo que puso cada uno." },
          { que: "Tendencia del líder", es: "Bajo el nombre del líder, cinco barras: su acierto en cada una de sus últimas cinco jornadas con resultado (hasta la que se mira) y los aciertos de cada una. Las jornadas que no le cuentan (antes de su primera apuesta) no entran." },
          { que: "Sus apuestas del staff", es: "El nombre del ranking ya no es un enlace (son del staff, no hay ficha de jugador). El icono del megáfono junto al nombre abre las Apuestas del staff filtradas a esa persona." },
          { que: "Ver las caras", es: "En la franja del plazo, «Ver las caras» es un enlace secundario: despliega quién juega, si la tiene completa y su canción, frase y foto. El botón principal es el de apostar (o entrar)." },
          { que: "Entrar para apostar", es: "En las últimas horas, el único «Entrar»: abre el formulario ya desplegado; fuera de ellas, la franja «Entra con tu correo»" },
          { que: "«=» delante del puesto", es: "Puesto compartido: mismo porcentaje y mismos aciertos; la nota sale junto a la tabla sólo si hay alguno" },
          { que: "Plan (en los partidos)", es: "El plan de partido contra ese equipo, con ?rival=ID" },
          { que: "Cierre (menos de 24 h)", es: "En las últimas horas, el plazo sube a lo primero de la pantalla, más grande y con el botón de apostar (o de entrar)" },
          { que: "Líder · Al segundo · Comen gratis", es: "Tres cifras sobre el ranking: quién manda y con qué %, a cuántos aciertos está el segundo y quién come gratis en el bloque" },
          { que: "Barra de acierto", es: "Empieza en 0; la escala se dice en la cabecera de la columna" },
          { que: "La comida", es: "A la vista los que comen y los dos siguientes; el resto, plegado en «Ver los otros N»" },
          { que: "goles · ABP (en cada partido)", es: "Junto a cada equipo: sus goles en vídeo y su balón parado, con el equipo ya elegido" },
          { que: "Carga", es: "Se pinta en el aparato, porque depende de la hora de Madrid (cuenta atrás, jornada de hoy); el servidor deja el marco con la carga" },
          { que: "Registrarme (18/11/2026)", es: "Darse de alta pide también el código del cuerpo técnico, que pone Víctor en Ajustes → Acceso: con la cuenta se entra en toda la plataforma" },
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
          { que: "Quién manda", es: "El primero del ranking, arriba del todo, con su porcentaje y sus aciertos; si el segundo puesto está compartido, se nombra a todos" },
          { que: "La barra del ranking", es: "El porcentaje encima, la distancia al líder en aciertos («−1 acierto», «líder»; en el móvil va debajo y corta, «−1») y la barra: oro si va por encima de la media, gris si no; la raya azul es la media del grupo", cuenta: "La barra va del suelo al techo del grupo en decenas (p. ej. de 30 a 60 %), no de 0 a 100, para que 54 y 50 % se distingan; el subtítulo dice la escala. Media = la de los que entran en el orden (sin los de pocas apuestas)" },
          { que: "Jornada 12 (la última con resultados)", es: "Aciertos de cada uno en la última jornada ya jugada, «x de 9»" },
          { que: "Los nombres", es: "Llevan a sus apuestas del staff" },
          { que: "Los equipos", es: "Con su escudo de BeSoccer (los mismos de /laboratorio/escudos), su puesto y su balance en la liga («3.º · 7V 3E 2D») y un icono de película que abre sus goles en vídeo en el pop-up de la portada (18/11/2026); el nombre abre su ficha en /rivals", cuenta: "Puesto y balance: la clasificación más reciente del grupo en el informe de rivales de BeSoccer (la de más partidos jugados)" },
          { que: "1-X-2 de cada uno", es: "Sin sesión y con la jornada abierta, la tabla de partidos lo dice en su columna: «se verá al cerrar»" },
          { que: "La comida", es: "«Los dos primeros comen invitados»: una línea dice de dónde sale el bloque (la temporada va en bloques de diez jornadas y cada uno acaba en una comida), frase titular con quién come gratis por ahora y su acierto, y barras ordenadas del bloque (oro los invitados, raya discontinua bajo el segundo). «Reglas completas» en su cabecera abre las reglas. El pie explica por qué el líder del ranking puede ir más abajo aquí", cuenta: "Porcentaje sobre los partidos jugados de esas diez jornadas, no sobre la temporada" },
          { que: "La franja", es: "Una línea con el cierre y la cuenta atrás («Cierra el vie 20, 12:00 · faltan 3 días»), «N de M con la apuesta completa» con una barra por persona, quién falta y «Ver las caritas». En «Los partidos» el plazo sólo se repite si hay algo nuevo: cerrada, reabierta o últimas horas" },
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
          { que: "Acierto", es: "Partidos acertados entre los ya jugados desde tu primera apuesta", cuenta: "acertados ÷ jugados desde la primera apuesta; desde ahí, el que no pones es fallo. Excepción (16/11/2026): a Miguel Barrio no le cuentan las jornadas enteras en blanco (no estuvo de la J5 a la J10); un partido suelto sin poner, sí" },
          { que: "Un partido sin resultado", es: "No cuenta para nadie, ni a favor ni en contra" },
          { que: "=8", es: "Puesto compartido: mismo porcentaje y mismos aciertos. A igual porcentaje, manda quien más acierta" },
          { que: "Con pocas apuestas", es: "Abajo y fuera del orden", cuenta: "quien lleva menos de la mitad de partidos que el que más, o apostó menos de la mitad de los suyos" },
          { que: "Esta jornada", es: "Aciertos de la semana entre sus partidos ya jugados" },
          { que: "Ganadas", es: "Las que cerró con más aciertos que nadie; si empatan dos, la ganan los dos" },
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
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Cómo se juega",
        filas: [
          { que: "Cuándo se decide cada una", es: "Una barra por parada (próximos 60 días, cada mes, mayo = fin de liga, junio = final de temporada) con cuántas apuestas abiertas se deciden ahí. Pulsar una barra deja abajo sólo las de esa parada (en «Lo que se decide ya» y en «El resto») y abre su bloque; pulsarla otra vez o «Ver todas» quita el filtro." },
          { que: "El resto, abierto", es: "Los bloques por fecha de cierre salen con el primero ya abierto, con sus apuestas a la vista; el resto se abre al pulsarlo." },
          { que: "Balance por persona", es: "Mientras no haya ningún veredicto es una sola línea con cuántas personas tienen apuestas en juego. Con el primer veredicto pasa a una barra por persona: ganadas (verde), perdidas (rojo) y pendientes (gris). Ganadas y perdidas siguen la regla del marcador: quien lanza y quien va a favor aciertan si se cumple; quien va en contra, si no." },
          { que: "Enlaces de cada apuesta", es: "Si la apuesta nombra a un equipo de nuestra liga, lleva Ficha, Sus goles, ABP y Plan; si nombra a un jugador de la plantilla (por nombre, apellido o apodo del vestuario), su ficha y su seguimiento en Individual con él ya elegido. Si no nombra nada de la plataforma (otro equipo, una persona ajena), no sale ninguna fila de botones." },
          { que: "Filtro por persona", es: "Desde el ranking de la quiniela se llega con las apuestas de una persona; «Ver todas» quita el filtro sin salir de la pantalla." },
          { que: "Balance por persona", es: "Una barra por persona con ganadas (verde, las del marcador), perdidas (rojo) y pendientes (gris, sin veredicto en que lanzó o se puso a un lado), y una frase con quién va por delante" },
          { que: "Enlaces en el bloque plegado", es: "La primera apuesta de cada bloque lleva ya sus enlaces: el jugador a su ficha y seguimiento, el equipo a ficha, goles, ABP y plan" },
          { que: "Faltan N por apostar", es: "Abierto en las de «Se decide pronto»" },
          { que: "Si se cumple, aciertan…; si no, …", es: "En cada apuesta abierta, por nombre: quién acierta si ocurre (quien la lanzó y los de a favor) y quién si no (los de en contra)" },
          { que: "Cuándo se decide cada una", es: "Barras más anchas; cada una lleva a su bloque de la lista" },
          { que: "Registrarme (18/11/2026)", es: "Darse de alta pide también el código del cuerpo técnico, que pone Víctor en Ajustes → Acceso: con la cuenta se entra en toda la plataforma" },
          { que: "Entrar para apostar", es: "Un botón pequeño en la cabecera, el único sitio donde está (con sesión, tu nombre); al pulsarlo sale el acceso con la cuenta de la quiniela. Ver no necesita entrar; lanzar, apostar o dar el veredicto, sí. Cambiar contraseña y Salir, al pie" },
          { que: "Quiniela de la semana", es: "Enlace en la cabecera, junto al acceso: la misma cuenta sirve para las dos" },
          { que: "Lanzar apuesta", es: "La predicción (hasta 280 letras), qué te juegas (hasta 120) y el día en que se comprueba, mañana como pronto. Quien la lanza va a favor" },
          { que: "Apostar a favor · Apostar en contra", es: "Hasta el día antes de la comprobación; se cambia de bando o se quita las veces que haga falta. El autor ya va a favor. Sin sesión, las tarjetas no llevan botón: se entra desde la cabecera" },
          { que: "Toca comprobarla", es: "Desde el día señalado se cierran las posturas y cualquiera que haya entrado dice si acertó o falló (sin sesión, la tarjeta sólo dice «Espera veredicto»). Se puede deshacer" },
          { que: "Retirarla", es: "Sólo el autor, mientras nadie se haya puesto a favor ni en contra; se pregunta antes, porque se borra" },
          { que: "Ver cómo se verá", es: "Sin ninguna apuesta, un ejemplo plegado y marcado como inventado" },
        ],
      },
      {
        titulo: "Cómo está ordenada",
        filas: [
          { que: "Cuándo se decide cada una", es: "Lo primero de la pantalla: una línea de tiempo con una parada por bloque (60 días, Navidad, marzo, mayo, junio…), con una barra según cuántas se deciden ahí y la cifra siempre escrita encima; la más cargada va en oro lleno y las que esperan veredicto, en azul. El título es la conclusión («13 de las 19 se deciden a fin de liga (mayo de 2027)»). Un toque en una parada abre su bloque y baja a él", cuenta: "Cuenta todas las abiertas, sin el filtro (con ?quien=, las de esa persona). «60 días» es el mismo corte que «Lo que se decide ya». El alto de la barra va con la raíz de la cifra y un mínimo visible, para que 1 y 3 se vean al lado de 13" },
          { que: "Lo que se decide ya", es: "Debajo, sólo lo vivo y en tarjeta abierta: las que se deciden en los próximos 60 días (o ya esperan veredicto) y la más disputada, cada una con su sello («Se decide pronto», «La más disputada»)", cuenta: "Más disputada: la de menos diferencia entre los dos bandos (el autor cuenta a favor); a igual diferencia, la de más gente y luego la que antes se decide. Sólo entran las que tienen a alguien en contra" },
          { que: "Filtros", es: "Encima de «El resto, por fecha de cierre» y sólo para él: Todas · Las mías (con sesión: las que lanzaste o en las que apostaste) · Nadie se ha opuesto (las que no tienen a nadie en contra). Las cifras cuentan las del resto" },
          { que: "Leyenda", es: "Una vez, encima de las tarjetas: verde, a favor; rojo, en contra; quien la lanza cuenta a favor y la base son los de la quiniela" },
          { que: "El resto, por fecha de cierre", es: "Plegado en bloques por mes (diciembre = Navidad; mayo = Fin de liga; junio = Final de temporada), cada uno con cuántas son, en cuántos días se decide la primera y su predicción, sin abrirlo. Al pulsarlo salen sus filas; las de un mismo equipo (dos o más) van bajo su nombre con sus enlaces una sola vez" },
          { que: "Aciertos por persona", es: "Sólo si ya hay apuestas decididas: aciertos, fallos, porcentaje de acierto y balance de cada uno; sin ninguna decidida, no sale", cuenta: "Acierto = aciertos ÷ (aciertos + fallos), redondeado. Quien lanza acierta si se cumple; quien va a favor, con él; quien va en contra, si falla. Ordena el balance (aciertos menos fallos); a igualdad, más aciertos" },
          { que: "Ya decididas", es: "Las ya comprobadas, de la última a la primera, con el mismo formato de fila; sin ninguna, no sale" },
          { que: "?quien=", es: "Desde el ranking de la quiniela: sólo las apuestas en las que está esa persona; «Ver todas» quita el filtro" },
        ],
      },
      {
        titulo: "Cada apuesta (el mismo formato para todas)",
        filas: [
          { que: "La cabecera", es: "La predicción y, a la derecha, los días que faltan con la fecha (o «Toca comprobarla», «Acertada», «Fallada»). Un toque la abre o la pliega" },
          { que: "La barra", es: "Un solo recuento. Con menos de 6 votos, la cuenta y nada de porcentajes: «1 a favor · 2 en contra · faltan 8». Desde 6, el porcentaje a favor (verde) y en contra (rojo) encima de la barra, y debajo la cuenta y la base, «7 de 11 han apostado»", cuenta: "Votos = el autor (a favor) más los que se han puesto a un lado. Porcentajes sólo desde 6 votos, redondeados a la unidad y sumando 100. Faltan = los de la quiniela que aún no han apostado" },
          { que: "Los enlaces", es: "Si nombra a un equipo de nuestra liga: Ficha (su plantilla en /rivals), ▶ Sus goles (en el pop-up de la portada, 18/11/2026), ABP y Plan J… (el plan de ese partido), con el rival y la jornada ya elegidos. Si nombra a un jugador nuestro: su Ficha y, si lo lleva, Su seguimiento. Si no hay rival de la liga (un equipo juvenil, un amistoso), no se pone ningún enlace", cuenta: "El equipo se reconoce por la palabra que lo distingue en el calendario (Alcorcón, Jaén…). «Plan» sólo sale si el equipo tiene fila en la hoja RIVALES: la del próximo partido contra él o, si ya se jugaron, la del último. El jugador, por apodo, nombre o apellido suelto («Rachi» = Rachad); el seguimiento no sale para porteros ni otras licencias" },
          { que: "Al abrirla", es: "Quién la lanzó y cuándo, qué se juega (si escribió algo de verdad), las caras y nombres de cada lado y «Faltan N por apostar», que se despliega para ver los nombres" },
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
    revisada: "2026-11-18",
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
          { que: "La muestra (sin sesión, 17/11/2026)", es: "La ventana de acceso sigue (con su correo); al cerrarla, una banda fija dice que es la muestra pública. La lámina del modelo dice «Estimación del modelo · 1 remate de ejemplo» y el encaje enseña lo que concede el próximo rival a balón parado según Opta (goles y ocasiones concedidas, su puesto en el grupo y en cuántos partidos), con «Prepararlo en la pizarra», «Nuestro ABP defensivo» y «Su ABP»" },
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
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
      "Sólo con la sesión de administrador: sin ella, la dirección enseña la puerta del laboratorio y el contenido no llega al navegador. Vale también para «Datos».",
      "La puerta (17/11/2026): con la ventana abierta la página no pasa del alto de la pantalla, así el velo lo cubre todo; «Volver» lleva a la pantalla de la que se vino (si se entró directo, a ABP Ofensivo); «Ver la muestra» la abre a lo ancho, sin el formulario, con «Volver» y «Soy yo» arriba. El título dice qué es (la rutina de córner, de la pizarra al proyector, con un ejemplo público) y la lámina del encaje lleva su conclusión («contra hombre vale casi el doble que contra mixta») y su base: un remate de la rutina estimado por el modelo, no una media.",
      "La puerta (sin sesión): la ventana «No tienes acceso» con «Volver» y «Soy yo: poner la contraseña», que lleva al único formulario de entrada. Detrás, una muestra de cada herramienta rotulada «Ejemplo» con su fuente: la rutina «Pared delante del portero» del Arsenal (web de la Premier League, datos de Opta) en la pizarra viva, con la leyenda de sus letras (L lanzador, P pared delante del portero, R rematador, S señuelo, 2ª segunda jugada, V vigilancia); esa misma rutina contra zona, mixta y hombre con el modelo de xG del laboratorio sin calibrar (estimación, no medición); y una pregunta del banco de retos (The Analyst, córners de la Premier 2022/23, toda la temporada). El «Próximo rival: … · su ABP» lleva el nombre del próximo rival, del calendario de BeSoccer, y abren su ABP. Nada de la plantilla ni de nuestras rutinas (16/11/2026).",
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
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "Antes de entrar",
        filas: [
          { que: "Entrenamientos sin analizar", es: "Cuántos días con sesión en la hoja no tienen análisis desde el último analizado; la lista se abre al tocar" },
          { que: "Entrenamientos sin analizar", es: "Franja arriba con los días del registro con tareas, hasta hoy y posteriores al último análisis, que no tienen análisis («16, 18 y 19/11») y el botón «Analizar el …» del más reciente; en la tira llevan un aro" },
          { que: "Resumen sin nada revisado", es: "Sale igual el panel: «N acciones propuestas · X parecen correctas y Y mejorables», barras rayadas por objetivo y por jugador con su base («n acciones»); lo propuesto no cuenta en las cifras hasta validarlo" },
          { que: "Enlaces de la sesión", es: "«Ver micro N» abre /microcycles?micro=N y «Jugadores sesión» abre los equipos de ese día" },
          { que: "Pasos", es: "El paso que toca va resaltado y los hechos, apagados; en táctil se revisa tocando Correcta, Mejorable o Descartar" },
          { que: "Día que abre", es: "?fecha= o ?dia= abren ese día; sin él, el último día analizado, dicho arriba («Último día analizado: 04/11») con «Ir a hoy»" },
          { que: "Registrarme (18/11/2026)", es: "Darse de alta pide también el código del cuerpo técnico, que pone Víctor en Ajustes → Acceso" },
          { que: "Entra con tu cuenta del staff", es: "El correo, la contraseña y un solo botón «Entrar». Sólo puede registrarse el cuerpo técnico. Si el aparato ya tiene la cuenta del staff, el formulario no sale: se abre el análisis directamente" },
          { que: "Titular", es: "«Qué cumplió cada jugador en la sesión»; el nombre de la pantalla va en la línea de arriba" },
          { que: "Última sesión analizada", es: "Lo primero, con el acceso al lado: la fecha, el acierto del día, su base de acciones revisadas, cuántos objetivos se midieron y una barra por tarea (código, nombre de la tarea, acierto, correctas y, si la tiene, la raya de la meta con «cumple» o «no llega»; con menos de 15 acciones, puntos en vez de barra y sin meta). Debajo, las dos sesiones analizadas anteriores con su cifra y si la siguiente subió o bajó. Si aún no hay nada revisado, se cuenta la propuesta del análisis y se marca «provisional · sin revisar». Sólo lo agregado: sin jugadores, textos de objetivo ni clips, porque esta puerta es pública", cuenta: "La más reciente con acciones: lo revisado; si no hay nada revisado, la propuesta automática sin lo descartado, marcada provisional. Acierto = correctas ÷ revisadas; con menos de 15, la cuenta y «tendencia» (barra atenuada). Por tarea se suman los objetivos atados a esa tarea" },
          { que: "Acierto por sesión", es: "Barras de la más antigua a la última, cada una con su base («42 % · 52 de 125»). Una sesión sin revisar o con menos de 30 acciones va rayada, da «29 de 29» en vez del porcentaje y dice «tendencia»; no se compara en puntos con otra", cuenta: "Acierto = correctas ÷ acciones (las revisadas; sin ninguna revisada, la propuesta del análisis)" },
          { que: "Equipos de la sesión · Microciclo de la semana", es: "Lo que completa la pantalla, a un toque y con el día de esa última sesión ya elegido: Jugadores sesión, la sesión en Contenidos Microciclo y «Ver clips (staff)». Cada tarea de la última sesión lleva también «ver la sesión» en Contenidos Microciclo" },
          { que: "Cómo se lee una tarea (ejemplo)", es: "Plegado: un ejemplo inventado, marcado «Ejemplo», con la tarea, su objetivo y su meta, el gráfico de correctas y mejorables de cada jugador (el que tiene menos de 15 acciones, en puntos y sin meta) y un clip con su veredicto. Sale abierto sólo si no hay ninguna sesión analizada que enseñar", cuenta: "El mismo umbral que dentro: con menos de 15 acciones no hay porcentaje ni «cumple»" },
        ],
      },
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
          { que: "Meta (%)", es: "El porcentaje de correctas que se pide", cuenta: "Cumplida si el acierto llega a la meta (sólo con 15 acciones o más)" },
          { que: "De dónde sale", es: "Seguimiento individual, «Qué toca» del post, Plan de partido o Cuerpo técnico: por qué se mide" },
          { que: "Lo que toca según el post", es: "Lee el último informe post y prepara el objetivo entero (a quién, tarea, correcto, mejorable y meta); no entra en la sesión hasta añadirlo" },
          { que: "Copiar los del dd/mm", es: "Trae los objetivos del último día con el mismo texto, para seguir su evolución" },
          { que: "Pedir el análisis", es: "Lo hace el ordenador del club, uno cada vez; tarda de media hora a una hora y se puede cerrar la pantalla" },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "64 % de acierto", es: "El titular del día; con menos de 15 acciones, «9 de 12 correctas» y tendencia", cuenta: "±N puntos frente al día anterior, si los dos tienen porcentaje y se separan 5 o más" },
          { que: "Objetivos en meta · lo mejor · lo que más cuesta", es: "La lectura del día; lo mejor y lo peor, sólo entre objetivos con porcentaje" },
          { que: "Correctas · Mejorables · Revisadas · Con clip", es: "Cada cifra con su base; un toque abre los clips que la forman" },
          { que: "Cumplimiento por objetivo", es: "Barra de correctas y mejorables; la raya dorada es la meta" },
          { que: "Cuándo pasa en la sesión", es: "Acciones por tramo y una calle por objetivo con cada acción en su minuto", cuenta: "Tramos de 2 min hasta media hora de vídeo; de 5 min si es más largo" },
          { que: "Tramo sombreado", es: "Minutos que el análisis no pudo mirar: ahí no hay acciones porque no se vieron" },
          { que: "Por tarea / Por jugador", es: "Desde una tarea o un jugador: pulsar su nombre o su barra abre sus clips; cada jugador lleva «Ficha», que abre su ficha individual. Las acciones de grupo sin jugador reconocido van aparte" },
          { que: "Evolución entre sesiones", es: "Acierto de cada entrenamiento analizado; columna rayada = menos de 15 acciones" },
        ],
      },
      {
        titulo: "Las cuentas",
        filas: [
          { que: "9 de 14 correctas · 3 por revisar", es: "Sólo cuentan las acciones revisadas (correctas y mejorables); las descartadas y las propuestas sin revisar, no" },
          { que: "Acierto", es: "Porcentaje de correctas", cuenta: "correctas ÷ acciones revisadas que cuentan; sólo con 8 o más" },
          { que: "Tendencia", es: "Menos de 15 acciones (la regla de toda la plataforma desde el 16/11/2026; antes, 8): se da la cuenta, no el porcentaje ni si cumple la meta" },
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
          { que: "Ficha de … · Su seguimiento", es: "Encima del jugador elegido: abren su ficha en Individual, en el perfil o en la pestaña de seguimiento" },
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
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "El próximo partido",
        filas: [
          { que: "Castilla · goles frente a lo esperado", es: "Tarjeta clara propia junto a «Castilla · últimos 5» y «Liga · BeSoccer» (ya no va en el panel oscuro del rival). Goles − xG por partido de Opta (Wyscout si Opta no está), con el total y los partidos de base. El gráfico es una barra por partido (goles − xG de ese partido) con el eje rotulado: +máximo, 0 y −máximo en goles." },
          { que: "Panel oscuro del rival", es: "Toda la semana muestra al próximo rival arriba (puesto, puntos y sus últimos 5 de BeSoccer) y debajo sus vídeos: sus goles, cómo le marcan, su último partido y su ABP. Bajo las fichas, cada sigla con el nombre entero del equipo. La ficha que Opta tenga abre el análisis de ese partido del rival (se busca entre sus partidos de Opta por el nombre del contrario)." },
          { que: "Plantilla del rival", es: "El botón principal del partido, ahora en oro (la paleta del club). Abre la plantilla del rival ya elegido." },
          { que: "Chip de la sesión de hoy", es: "Lo que la hoja de registro tiene para hoy. El día de partido, si sólo pone «Competición», no sale (ya lo dicen la chapa «Hoy MD» y la casilla MD)." },
          { que: "Atrasadas (Tu día)", es: "Un botón «N atrasadas · Verlas», en la tinta del tema (se lee en día y en noche). En tableta y escritorio lleva la cuenta por día. Al abrirlo salen todas agrupadas por día: cada tarea abre su pantalla y tiene «Hecha»; «Pasarlas a hoy» abre la ventana de siempre." },
          { que: "Tu día y Atajos", es: "Van uno debajo del otro, a todo el ancho." },
          { que: "Los que menos seguimientos llevan", es: "Ordenados de menos a más, con su puesto (1.º, 2.º, 3.º) y la base: cuántos de los jugadores de campo están por debajo de la mediana de seguimientos de la plantilla (los que no tienen ninguno cuentan como cero)." },
          { que: "El último partido · Balón parado", es: "Córners de cada equipo y, si Opta los trae, las ocasiones a balón parado de cada uno (ChncSetPl) y el xG a balón parado." },
          { que: "Datos destacados", es: "La población de cada dato (contra cuántos se compara) va arriba de cada tarjeta, a 12 px." },
          { que: "Tabla de liga al momento", es: "Si la copia del aparato va por detrás del calendario, se pinta ya y se repinta en cuanto el servidor trae la tabla nueva" },
          { que: "Goles menos xG, partido a partido", es: "Bajo la cifra media del panel oscuro, una barra por partido de Opta (goles − xG del Castilla): hacia arriba marcamos más de lo esperado, hacia abajo menos; 0 = lo esperado" },
          { que: "Liga · BeSoccer, al día", es: "Si la copia del aparato tiene menos partidos jugados que el calendario, se vuelve a pedir antes de pintar: escritorio y móvil enseñan la misma tabla; si BeSoccer va por detrás, se dice cuántos de nuestros partidos cuenta" },
          { que: "Atrasadas", es: "Plegadas bajo lo de hoy, con su cuenta por día («lun 16 · 2»); al desplegar, las tres primeras con su día y «Hecha», y «Ver las N o pasarlas a hoy»" },
          { que: "Territorio del último partido", es: "«…desde el 75′ fue el <rival> quien lo pisó el N % → cerrar partidos: altura del bloque en los últimos 15′», con la base (Opta, minutos jugados y del tramo final)" },
          { que: "Su ficha (ocasiones en vídeo)", es: "Nuestro jugador de cada ocasión abre su ficha de Individual ya elegido" },
          { que: "Contra quién (Datos destacados)", es: "Arriba de cada tarjeta, la población con la que se compara: jugadores de su puesto, equipos del grupo o la plantilla" },
          { que: "N atrasadas (en «Tu día»)", es: "Las tareas de días anteriores sin hacer, con nombre y día (la misma tarea del mismo día, una vez, igual que el correo de las 7:00); al tocarla se abre la ventana para marcarlas o pasarlas a hoy. Ya no sale sola al entrar; fuera de la portada es una franja al pie de la pantalla 8 s" },
          { que: "Los que menos seguimientos llevan", es: "Cada nombre con «N seguimientos» abre su ficha; «Programar» abre «Nuevo seguimiento» con él ya elegido" },
          { que: "Rival frente a nosotros · lecturas", es: "La población y los partidos, una vez en la cabecera; cada lectura con su enlace: balón parado → ABP del rival; presión y ocasiones → el rival en Análisis de datos" },
          { que: "El último partido · tres claves", es: "Ocasiones, presión y balón parado en fichas: el dato en negrita, su base y lo que se entrena; abren el post de ese partido (el balón parado, el partido con sus mapas)" },
          { que: "Las ocasiones con más goles esperados, en vídeo", es: "Las tres de más xG del partido (de los dos equipos), con la base de remates de cada uno" },
          { que: "Preparar el partido", es: "Seis accesos como mucho: lo de hoy primero y después en el orden de la semana (MD-4 → MD)" },
          { que: "Su ABP en vídeo", es: "En el bloque del rival en vídeo: abre ABP del rival con él ya elegido" },
          { que: "Orden en la semana del partido", es: "De MD-4 a MD-1, «el rival frente a nosotros» va justo detrás del próximo partido; las tareas atrasadas se cuentan igual en la ventana, en «Tu día» y en «Mis tareas» (la misma tarea del mismo día, una vez)" },
          { que: "Aviso de tareas atrasadas", es: "La ventana sale sólo en la portada y una vez al día; en las demás pantallas es una franja pequeña abajo, con «Ver», que no tapa nada. La misma tarea del mismo día sale una sola vez (marcarla marca sus copias)" },
          { que: "En el móvil y la tableta (19/11/2026)", es: "Las tareas pendientes ponen sus botones debajo del texto (antes el título se partía en una palabra por línea), la casilla de «hecha» se acierta con el dedo y los rótulos pequeños suben a 11 px" },
          { que: "Hoy MD-n · Jornada · Temporada", es: "La chapa dorada dice en qué día de la semana de trabajo estamos («· libre» si hoy no hay sesión); al lado, en una línea, la jornada y la temporada" },
          { que: "Cómo se ve (16/11/2026)", es: "Todos los bloques son tarjetas con el mismo canto, el mismo radio y la misma sombra, en día y en noche; lo que se pulsa sube un poco y se le dora el borde. Títulos y cifras grandes con la letra del club (Barlow Condensed), cada cifra con su base debajo, e iconos de la misma familia. Orden: el partido y el rival; el directo, tu día y los atajos; los datos destacados; el último partido en 3D y Opta (de MD-4 a MD-1, Opta va antes que el 3D: esos días manda el rival); y el equipo en cifras" },
          { que: "El rival, el día y el campo", es: "Del calendario de BeSoccer; fuera de casa, con su estadio y su ciudad" },
          { que: "Sus últimos 5, en cifras (tarjeta oscura del rival)", es: "Una sola línea bajo sus cinco fichas (18/11/2026: antes eran tres filas que repetían la forma): puntos sacados de los posibles, goles a favor y en contra y, si viene a nuestra casa, cuántos puntos sacó fuera (si jugamos allí, en casa). Ej.: «5 de 15 pts · 3 goles a favor, 4 en contra · fuera: 3 de 6 pts en sus 2 últimos fuera» (18/11/2026: dice puntos y partidos, para no chocar con la temporada de /rivals). Todo el contenido de la tarjeta va al pie, sobre el velo oscuro del panel, y arriba queda a la vista la foto del Di Stéfano (18/11/2026: la caja opaca centrada dejaba un hueco negro y tapaba el estadio)", cuenta: "Sale de sus cinco últimos de BeSoccer (el marcador lleva sus goles primero). Los goles sólo se dan si todos los partidos traen marcador" },
          { que: "Cuenta atrás", es: "Días, horas y minutos hasta la hora de Madrid del partido; sin hora fijada, sólo los días" },
          { que: "La tira de días", es: "Del día después del partido anterior al del próximo; hoy en dorado, el partido recuadrado. Siete días caben enteros también en el móvil (el MD siempre a la vista); con ocho o más se desliza", cuenta: "MD = día de partido; MD-3 = tres días antes" },
          { que: "«libre»", es: "Debajo del día de la semana («SÁB» / «libre», 18/11/2026: antes sólo «LIBRE»); letra de 12 px como mínimo en toda la tira. Día sin tareas en el microciclo escrito. Si aún no hay microciclo, es la propuesta habitual" },
          { que: "Pinchar un día", es: "Abre su sesión para poner tiempo, intensidad, evaluación y análisis post, o un seguimiento individual o de grupo", cuenta: "En el seguimiento sólo se eligen jugadores de campo del Castilla: los porteros llevan su registro aparte" },
          { que: "El botón de hoy", es: "Los contenidos de la sesión de hoy escritos en la hoja de registro; sin sesión escrita no sale" },
          { que: "Microciclo · día 3 de 7", es: "Cuánto se ha recorrido de la semana, cuántas sesiones quedan y qué días son libres" },
          { que: "Tarjeta del rival (foto del estadio)", es: "En escritorio la tarjeta oscura del rival es alta: la foto del Di Stéfano se agranda por arriba para que se vea la grada y no media tarjeta de cielo negro (18/11/2026). En tableta y móvil, igual que antes" },
          { que: "Plantilla del rival", es: "El botón azul, a lo ancho; el resto de accesos del partido van en la botonera «Preparar el partido» de debajo" },
          { que: "Opta en directo", es: "Arriba de todo, un botón rojo. Si hay directo en marcha, «Ver el directo» lleva a Análisis de datos → En directo (lo ve cualquiera mientras dura). Si no, el administrador tiene «Empezar directo»: lo lanza en GitHub sin preguntar y lleva a la pantalla, que espera sola la primera lectura. Corre en la nube de GitHub: no hace falta el ordenador del club encendido. Sigue todos los partidos de Opta del día, el nuestro y los demás (se elige en la pantalla), hasta 5 horas, y se para solo cuando han acabado todos. Además se mira solo cada 30 minutos de 10:00 a 22:30: si hay partidos jugándose, salen en la tira sin que nadie pulse nada. En un partido sin el Castilla no salen consignas de banquillo: cada equipo se compara con su propia media. Arriba, una tira con todos los partidos del día (marcador y xG, del índice opta:directo): se pulsa y se abre. En nuestro partido, del 44' al 52' sale «Descanso»: las tres alertas que más pesan con su consigna (se quita en cuanto Opta da tramos de la segunda parte). Si no jugamos, se abre el partido del próximo rival (calendario de BeSoccer) y la tira lo marca «Próximo rival»; ese equipo va a la izquierda y las tarjetas se leen desde él. En partidos ajenos se dice de cuántos partidos sale la media de cada equipo; con menos de 5, las alertas se quedan en duda", cuenta: "En marcha = la pasada de GitHub sigue corriendo o el índice opta:directo se escribió hace menos de 3 minutos y no ha llegado a su hora de acabar. Sin la variable GITHUB_TOKEN_DIRECTO en Render no se ofrece" },
          { que: "Aviso de plataformas y pendientes", es: "Sólo para el administrador (la sesión de Ajustes, v.ceazurita@gmail.com), la primera vez que entra cada día: cuánto llevan gastado este mes las tres plataformas con límite gratis (Render: minutos de compilación, de 500; la base de datos, de 1 GB; Backblaze, vídeos, fotos y copias, de 10 GB) en barras verde, ámbar desde el 70 % y rojo desde el 85 %; los días que le quedan a la base gratis de Render (caduca el 14/12/2026); la última copia de la base; y lo pendiente de cerrar a mano (hoy, el alta en la API de BeSoccer). «Entendido, hoy no más» lo cierra hasta mañana. Si algo pasa del 70 % llega además un correo", cuenta: "Lo deja cada día el ordenador del club en el documento salud:plataformas (scripts/salud-datos.mjs, lanzado por el vigía), junto con la copia de la base en .cache/copias y en Backblaze. Los minutos de Render se cuentan por las publicaciones del proceso «Publicar en Render» de GitHub (unos 8 por publicación)" },
          { que: "El último partido", es: "Debajo de los datos destacados: el último partido del Castilla con su evento a evento; en la cabecera, el marcador con el local primero y la fecha («Gimnàstic Tarragona 0-1 Real Madrid Castilla · vie 13 nov»). Un titular, el mismo que en Análisis de datos («Ganamos 1-0 con menos goles esperados (0,5 – 0,7)», 18/11/2026) y tres cifras con el Castilla siempre primero («0,5 – 0,7 · Castilla · Gimnàstic»): xG (un decimal), a puerta (con los remates totales, bloqueados incluidos, en la base) y posesión. Al final, una frase con lo que dice el 3D, la misma que en Análisis de datos («Pisamos campo rival el 62 % del partido; en el tramo final (desde el 75′), el Gimnàstic, el X %») y el botón «Ver en 3D» (dentro, el Castilla a la izquierda y primero en el marcador): el campo 3D va plegado (18/11/2026, para acortar la portada) y al pulsarlo se abre parado en el resumen del partido entero (el cuadro dice «El partido entero»; se reproduce al pulsar). Debajo, tres claves para el micro, cada una con su base y acabada en lo que se entrena («→ …»): ocasiones (goles esperados y en cuántos remates de cada uno), presión (el PPDA nuestro frente al suyo; menos es más presión) y balón parado (córners de cada uno y, si está, su xG a balón parado). La línea del resumen y cada clave abren el post de ESE partido en Análisis de datos. «Las ocasiones más claras, en vídeo»: los tres remates con más xG del partido (de los dos equipos), cada uno con su minuto, de qué equipo es («Castilla · Pol Fortuny», «Gimnàstic · Pere»), quién y su xG con un decimal, abren su vídeo en Opta (hace falta la sesión de Opta abierta). El cuadro de datos del 3D tiene fondo opaco; la línea «Máximo hasta el …» sólo sale si no repite la cifra de encima. En el 3D nuestro equipo se llama «Castilla» («manda Castilla»). «Análisis del partido» abre el post de ese partido; «Con los mapas», ese mismo partido en el directo (allí, el botón de las dos flechas lo pone a pantalla completa); «Informe post», Microciclos, donde se arma y se manda el informe de esa jornada", cuenta: "La lectura compara el resultado con la diferencia de xG (±0,15). Lo que se entrena: según quién generó más (±0,15 de xG), quién presionó más (PPDA más bajo) y quién sacó más córners. Titular y campo pisado: lib/partido-frases.ts, compartido con Análisis de datos (de las acciones en campo rival de los dos, cuántas son nuestras, en el partido y del 75′ al final). Cifras del doc opta:directo:<partido> (equipos y evento a evento)" },
          { que: "Moverse por la app (todas las pantallas)", es: "Arriba, la cabecera pegada con la tira de las pantallas de la misma sección; la lupa (o Ctrl+K en el ordenador) busca cualquier pantalla tecleando. Al bajar más de pantalla y media sale abajo a la izquierda el botón redondo de volver arriba. En el móvil la cabecera y el título de cada pantalla ocupan menos y las pestañas de sección tienen 40 px de alto para el dedo; en el móvil y la tableta las casillas para marcar miden 20 px. Cada pestaña del navegador lleva el nombre de la pantalla («Microciclos · RMCF Castilla»), y así se distinguen en el historial, los marcadores y el selector de apps del móvil", cuenta: "El nombre es la etiqueta del menú (components/ui/TituloPestana.tsx); /general y /performance conservan el suyo" },
          { que: "«Datos de las HH:MM» en la cabecera (17/11/2026)", es: "En cuanto llega lo primero de la pantalla, la cabecera dice la hora de lo que se ve; el icono gira mientras llega lo demás. Si una parte tarda más de 20 s (el seguimiento, con la hoja de Google en frío), sigue diciendo la hora y al pulsar se baja todo de nuevo. Antes se quedaba girando sin hora en la portada", cuenta: "La hora es la de la última bajada terminada en esta pestaña" },
          { que: "En el móvil", es: "Las tarjetas dejan libre a la derecha el carril del botón ⋮ de herramientas, para que no tape su canto" },
          { que: "Descargar un gráfico o una zona en HD (todas las pantallas)", es: "Herramientas → Exportar → «Elegir una zona · PNG HD»: al pasar el ratón se resalta la tarjeta o el gráfico de debajo y al pinchar se fija (en el móvil, tocándola). «Más grande» y «Más pequeña» (o ↑ ↓) pasan de la gráfica a su tarjeta o a la sección entera; «Descargar PNG HD» la baja y «Copiar» la deja para pegarla en PowerPoint, el correo o WhatsApp. Intro descarga, Esc sale. Mientras se elige, pinchar no abre nada de la página", cuenta: "La foto sale con el lado largo de unos 3.000 px (de ×3 a ×6 según el tamaño, recortado a lo que pinta el aparato), con un margen del color del fondo; la etiqueta dorada dice el tamaño final. Si la zona tiene scroll propio, sale entera. Lo de las herramientas no sale nunca" },
          { que: "PNG HD con el gráfico entero (18/11/2026)", es: "Algunos gráficos salían vacíos o a medias en el PNG HD (la radiografía, barras y puntos que aparecen con animación): ahora la foto sale siempre con el gráfico ya dibujado del todo, en el PNG HD, en «Elegir una zona», en el vídeo por jornadas y en los PDF", cuenta: "La foto copiaba el primer instante de cada animación, cuando aún no se ve nada. Mientras se hace la foto, cada animación se da por terminada y se quitan las transiciones (lib/export/captura.ts → sinAnimar y la regla [data-capturando] de globals.css)" },
          { que: "Botones de cada gráfico (todas las pantallas)", es: "Al pasar el ratón por una tarjeta con un gráfico sale arriba a la derecha «PNG HD» (la tarjeta en alta resolución), «Pantalla completa» (la tarjeta sola, con el gráfico a todo el alto; Esc o «Salir» vuelve) y, si la tarjeta tiene un selector de jornada, «Vídeo por jornadas»: un MP4 que pasa el selector de la primera jornada a la última y enseña cómo cambia el gráfico, con la jornada rotulada. En el móvil salen al tocar la tarjeta", cuenta: "El vídeo es el mismo gráfico de la pantalla: mientras se monta, el selector se mueve solo y al acabar vuelve a donde estaba (los enlaces esperan a que termine). 0,75 s por jornada con un fundido corto y la última, 2,5 s. No salen en las pizarras ni en los editores" },
          { que: "Gráficos que caben en la pantalla (18/11/2026)", es: "Los gráficos que crecían con el ancho (en 1440 px, alguno pasaba de 550 px de alto y con su título no se veía sin bajar) tienen un tope de alto y se centran: «Si le dejamos tocar», «¿Se le rompe la salida?», nuestra salida contra la presión, cambio de modelo, evolución comparada, por dónde ataca, los mapas de dos ejes, la red de parecidos, el campo de saques de banda, la radiografía de percentiles y la tendencia de la ficha, entre otros" },
          { que: "Preparar el partido · lo de hoy (MD-n), primero", es: "UNA sola botonera bajo el botón azul (18/11/2026: antes los botones del partido y «Del rival» iban aparte y repetían destinos). Primero, con una raya dorada a la izquierda, lo que toca hoy: MD y MD-1, En directo (el día de partido), PDF y vídeo ABP por jugador, Plan de partido, Duelos; MD+1 y MD+2, Informe post, Análisis de datos, Histórico; MD-2 a MD-4, Scout colectivo, ABP rival y Microciclo ABP. Después, lo demás con el rival puesto: Plan de partido, Microciclo ABP, Pizarra táctica (a pantalla completa con los dos onces), Desplazamiento (sólo fuera), Scout colectivo, ABP rival, Pizarra ABP, Duelos, Sus jugadores (los vídeos de sus jugadores) y Coding (admin). Cada destino sale una sola vez", cuenta: "Duelos y Sus jugadores llevan las dos llaves del rival: ?rival=ID de la hoja RIVALES y ?equipo=nombre" },
          {
            que: "<Rival> en vídeo: Sus goles · Cómo le marcan · Su último partido (16/11/2026)",
            es: "El pop-up lleva en su cabecera «Cómo son sus goles ›», la ida aparte a Análisis de goles (18/11/2026), y es el mismo que abre «Sus goles en vídeo» en toda la app. Lo primero de los accesos del rival (de MD-4 a MD-1, dentro del panel oscuro del rival, junto a sus cifras: así sale una sola vez), en tres botones dorados con el icono de reproducir, uno por fila y con lo que enseña cada uno al lado (el último partido, con su jornada y marcador); los mismos tres en el móvil y en el escritorio: mientras llega la lista de resúmenes, el sitio de «Su último partido» se guarda. Los dos primeros abren encima de la portada sus goles en vídeo: los que marca o los que encaja. Los que marca y los que encaja (= por dónde hacerle daño), de seguido («▶ Ver de seguido») o uno a uno en la lista de debajo; filtros: en jugada o a balón parado (córner, faltas, banda y penalti) y temporada, últimos 3 o últimos 5 partidos. Cada gol, con el corte de Opta del partido (10 s antes y 6 después) o, si aún no está, sobre el resumen de la RFEF. «Verlos en el campo» abre Análisis de goles con el equipo puesto. «Su último partido» abre en YouTube el resumen oficial de la RFEF de su último partido de liga. Si Opta no tiene sus goles, o no hay resumen, el botón no sale",
            cuenta: "Goles de Opta (opta:remates; los de propia puerta no son remates y no salen). Balón parado = situación del remate distinta de «juego» y «contragolpe». Vídeo: opta:goles-video y, si no, rfef:goles-resumenes",
          },
          { que: "Castilla · últimos 5", es: "En su tarjeta: nuestros cinco últimos con el marcador debajo (el más reciente, a la derecha) y, como base, el último con jornada y fecha. Cada ficha abre el análisis de ESE partido (Análisis de datos → El partido, con el partido de Opta ya elegido por la fecha); el icono de la esquina abre el histórico", cuenta: "V ganado · E empatado · D perdido. Si Opta no tiene el partido, su ficha no es enlace" },
          { que: "Liga", es: "En su tarjeta: el puesto en grande con los puntos, y debajo partidos, V-E-D y goles a favor y en contra, de BeSoccer. Abre el Castilla de un vistazo (ya elegido) en Análisis de datos", cuenta: "Tras los partidos ya jugados, sin contar el que viene; si la tabla aún no tiene la última jornada, lo dice" },
        ],
      },
      {
        titulo: "El panel del rival",
        filas: [
          { que: "El rival · BeSoccer", es: "Su puesto, sus puntos con los partidos jugados y sus cinco últimos con marcador y, debajo de cada uno, contra quién y dónde («GIM·F» = en Gimnàstic, fuera; C, en casa)", cuenta: "La sigla son las tres primeras letras del nombre que distingue al equipo (sin «Real», «CD», «Club»…); el nombre entero, al pasar por encima" },
          { que: "Sin cifras de Opta (17/11/2026)", es: "Las cifras del rival (xG a favor y en contra, posesión, su balón parado) ya no salen en el panel: estaban repetidas en «Opta de un vistazo». El panel se queda con lo de BeSoccer y su vídeo, y entero abre «Cómo juega» en Análisis de datos. El escudo del rival va nítido a la derecha de su nombre (18/11/2026: de marca de agua se montaba sobre los botones de vídeo)" },
          { que: "Su vídeo, en el panel", es: "Sus goles, Cómo le marcan y Su último partido, justo debajo de sus últimos 5, uno por fila (no se cortan en el móvil); al pie, «Cómo juega, en Análisis de datos». El resto del panel abre Análisis de datos → Un equipo de un vistazo con ese rival ya elegido" },
          { que: "Castilla · goles frente a lo esperado", es: "El resto de días: la diferencia por partido en grande y, pegada debajo, la cuenta («16 goles − 17,9 esperados = −1,9 en 12 partidos»), con la leyenda del color (verde, marca más de lo esperado; naranja, menos) y «más es mejor» una vez", cuenta: "(goles − xG, redondeado a un decimal) ÷ partidos; con menos de 15 partidos, «léase como tendencia»" },
          { que: "Goles esperados (xG) por partido", es: "Sólo si no hay Opta: el de Wyscout, con su puesto, la mediana del grupo y la barra contra el mejor" },
        ],
      },
      {
        titulo: "Tu día y atajos",
        filas: [
          { que: "Tu día", es: "Sólo el administrador: las tareas de hoy del microciclo, que se marcan aquí y en «Mis tareas»", cuenta: "Hechas ÷ tareas de hoy, en el anillo" },
          { que: "Pendientes de días anteriores", es: "Lo que quedó sin hacer; abre «Mis tareas»" },
          { que: "Informe post / Informe previa", es: "Los envíos de la semana que faltan, de hoy en adelante" },
          { que: "Atajos", es: "Una fila de botones compactos (18/11/2026: antes tarjetas altas con su explicación, que queda al pasar por encima): Coding (admin), Jugadores sesión, Informes, Análisis de datos, Individual y, en la misma fila, «Todas las áreas (N)», que despliega aquí mismo el buscador y las áreas por sección" },
          { que: "Lo último", es: "En una línea bajo los atajos: las cuatro últimas pantallas abiertas en este aparato, con cuándo" },
          { que: "Mis tareas", es: "Pestaña del administrador: la semana entera del microciclo, editable" },
        ],
      },
      {
        titulo: "Datos destacados",
        filas: [
          { que: "Qué sale", es: "Sólo lo que se separa de lo normal, a favor y a vigilar; si no hay nada, no se pinta", cuenta: "Doce como mucho: una por jugador y tres por familia" },
          { que: "Ver N a favor / Ver N a vigilar", es: "Abren las dos columnas con todas, su detalle y qué mirar al abrir" },
          { que: "De dónde y contra quién", es: "Todo de Wyscout: el equipo contra los de su grupo y cada jugador contra los de su puesto en la categoría; por eso las bases no son las de Opta (lo dice la cabecera del bloque)" },
          { que: "Un aspecto de equipo", es: "Dos o tres métricas de Wyscout que dicen lo mismo, contra los equipos del grupo. En grande, la métrica que más lo empuja, por partido; debajo, su puesto (con el sentido: más o menos es mejor), la mediana del grupo, los partidos del Castilla y la fuente", cuenta: "A partir de ±20 puntos de percentil. Sin una métrica con valor, no sale" },
          { que: "Una métrica suelta", es: "El Castilla entre los mejores o los peores de la liga en algo con un sentido claro", cuenta: "Percentil ≥ 85 o ≤ 15; las de estilo no se juzgan" },
          { que: "Un jugador", es: "Con al menos el 60 % de los minutos, contra los de su puesto en toda la categoría. Dos enlaces: sus datos en Data análisis (con el jugador elegido) y su ficha y seguimiento en Individual", cuenta: "Percentil ≥ 95 para bien; tres métricas en el percentil 10 o menos para mal. Un porcentaje de menos de 15 acciones dice «tendencia, muestra corta» y pesa la mitad al ordenar" },
          { que: "Seguimiento", es: "Jugadores de campo del Castilla sin registro reciente y la cobertura", cuenta: "Más de 45 días sin seguimiento; cobertura ≤ 70 % avisa, ≥ 90 % es a favor" },
          { que: "Fichajes rivales", es: "Altas y bajas que BeSoccer ya tiene y la hoja de plantillas todavía no", cuenta: "Tras una noche; si el cotejo lleva 4 días sin pasar, avisa de eso" },
        ],
      },
      {
        titulo: "Opta de un vistazo",
        filas: [
          { que: "<Rival> frente a nosotros (17/11/2026)", es: "El único sitio de la portada con las cifras de Opta del rival. Bajo la leyenda, de dónde sale cada cifra: media por partido de la temporada con todos sus partidos («Castilla, 12 partidos · Real Murcia, 12»); las lecturas lo repiten («nuestra media, 11,9 en 12 partidos»). En el post del partido de Análisis de datos la media es la de los otros 11 (sin ese partido) y lo dice. 18/11/2026. Abre con la conclusión más sólida como titular (p. ej. «Presiona de los que más: 5.º del grupo de 20 equipos»; la de balón parado, que es tendencia, nunca abre), su cifra y la nuestra debajo y, en vez de un botón, la orden del dato («→ salida en corto con apoyos por dentro o balón al espacio a la espalda de su presión»). xG y PPDA con un decimal en todo el bloque. La fuente, la base (media por partido en N) y hasta cuándo llega, una vez, en la cabecera. La población se dice siempre igual, «grupo de 20 equipos», en el subtítulo, la leyenda, el sello y las lecturas" },
          { que: "El gráfico", es: "Una pista por métrica (xG a favor, xG en contra, PPDA, xG a balón parado): del peor del grupo a la izquierda al mejor a la derecha, con el tercio de abajo en naranja tenue, el de arriba en verde tenue y la mediana en el centro. Punto oro, el Castilla; azul, el rival. Bajo cada pista, su sentido («más es mejor», «menos es mejor», «menos es más presión») junto a «mejor →». A la derecha, la cifra de cada uno con su puesto. Cada fila abre Análisis de datos → Un equipo de un vistazo con el rival ya elegido", cuenta: "Posición = (equipos − puesto) ÷ (equipos − 1); «5º de 20» = puesto en el grupo, del mejor al peor. El color del puesto, por su percentil" },
          { que: "xG a balón parado", es: "Córner y falta, sin penaltis. Lleva el rótulo «Tendencia» y los puntos huecos en el propio gráfico, y debajo su base: «Castilla, 19 remates a balón parado y 58 córners en 12 partidos · Real Murcia, 29 … en 12 partidos». La lectura del titular la repite", cuenta: "Tendencia porque sale de uno o dos remates por partido: unas décimas de xG lo mueven varios puestos" },
          { que: "PPDA", es: "Pases que deja dar al rival por cada acción defensiva: cuanto más bajo, más presiona" },
          { que: "Las otras lecturas", es: "Debajo del gráfico, a lo ancho (sin hueco), las siguientes conclusiones que más pesan del rival, cada una con su cifra, su puesto, la nuestra y la orden del dato («→ qué hacemos»): contra su presión, cómo salir; contra un rival que concede poco, paciencia con balón; contra su balón parado, defensa a balón parado… (18/11/2026: antes acababan en un enlace que ya estaba en la botonera del rival). Raya naranja, lo que es una amenaza; verde, por donde se le puede hacer daño. Si nada se sale de la media, no sale", cuenta: "Entran las métricas en las que está en el tercio de arriba o en el de abajo de su grupo; primero las más extremas, y las que son tendencia (balón parado) detrás" },
        ],
      },
      {
        titulo: "Seguimiento de la plantilla",
        filas: [
          { que: "Con seguimiento", es: "Jugadores de campo con licencia del Castilla con algún seguimiento en la temporada, como el Dashboard Seguimiento. Al pie: «Menos seguimientos: Hugo de Llanos y Thiago Pitarch (1 cada uno; mediana 20,5)»; al pulsarla abre la ficha del primero ya en su pestaña de seguimiento. Debajo, «Los 3 que menos seguimientos llevan»: cada uno con su número, su ficha (el nombre) y «Seguimiento» (su pestaña de seguimiento en Individual)", cuenta: "% = jugadores con seguimiento ÷ jugadores de campo. Mediana = seguimientos por jugador de campo del Castilla en la temporada, sin porteros y con los que no tienen ninguno como cero. Empate en el mínimo: abre el primero por nombre y dice con quién empata" },
          { que: "Seguimientos", es: "Registros de la temporada y cuántos en los últimos 30 días (o esta semana, si son todos)" },
          { que: "Reintentar", es: "Si la hoja de seguimiento no contesta, sólo sale la plantilla y el botón para volver a pedirla" },
        ],
      },
      DE_DONDE_SALE,
    ],
    ojo: [
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
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
      "La lista que se pega (título, listado y apartados de bajas) y las tareas del microciclo de ese día (hoja de registro, por la fuente común de las pantallas de planificación). Los puestos salen de la plantilla y de dónde coloca el cuerpo técnico a cada uno; el once, de la pizarra táctica; sinergias y perfiles, de Wyscout. Se guarda en el documento «jugadores-sesion» de Supabase.",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "La sesión",
        filas: [
          { que: "Lo que falta", es: "Una sola línea arriba: la tarea, qué le falta («sin equipos») y cuántas más; pulsarla abre esa tarea" },
          {
            que: "Abre en el día de hoy",
            es: "Sin «?fecha», el día de trabajo de hoy del micro en curso (hoy si se entrena; si no, el próximo con tareas), el mismo que abren /microcycles y los calendarios",
            cuenta: "Si aún no hay sesión de ese día, arriba sale «Lun 16/11 · MD-4 · Micro 22: aún sin sesión» con sus tareas planificadas y «Crear la sesión»; debajo sigue la última guardada",
          },
          { que: "Lun 16/11 · MD-4 · L-T2, Oleadas: 15 disponibles · 2 equipos", es: "El titular: fecha, MD y la tarea abierta con el código del microciclo (el mismo que en Microciclos y en el análisis; sin plan, «Tarea N») y su nombre, quién está y cuántos equipos («sin equipos» mientras no hay nadie colocado)" },
          { que: "Diapositivas y exportar", es: "La única acción en oro de la barra de la sesión: lleva a la pestaña de diapositivas (ver, presentar, exportar). Al lado, deshacer y rehacer (sólo icono) y el menú «Sesión»: copiar todo, atajos de teclado, cambiar la lista, nueva sesión y borrar" },
          { que: "disponibles · bajas · tareas listas", es: "Las cifras del día; las bajas, con su motivo al pasar por encima. Debajo de «tareas listas», la primera que falta con su código («Falta M-T3 · Oleadas →»): un toque la abre" },
          { que: "Porteros aparte: X, Y", es: "Los porteros no entran en los equipos, ni en el reparto, ni en las cifras de la sesión: llevan un registro independiente, con su entrenador", cuenta: "Se apartan si la lista los marca (apartado «PORTEROS:» o «(POR)» junto al nombre) o si su puesto es de portero (a mano, su ficha o la plantilla). Lo guardado antes con un portero en un equipo se lee sin él" },
          { que: "Las tareas del microciclo", es: "Al crear la sesión las tareas salen del plan de ese día, con equipos y comodines de su formato; casan con la hoja por nombre antes que por código" },
          { que: "No se hizo · Traer", es: "Una tarea del plan que no está en la sesión sale con la chapa «no se hizo», igual que en Microciclos (no es un aviso), y «Análisis del día →». Los cambios de nombre u orden del plan, en ámbar. «Traer» añade lo del plan y lo ata sin mover a nadie; se puede deshacer", cuenta: "La misma regla que Microciclos: tarea del plan sin su tarea en la sesión de ese día = no se hizo" },
          { que: "Sesión (menú)", es: "Arriba a la derecha: lo secundario de la sesión (el resto de acciones)" },
          { que: "Punto de cada tarea", es: "Verde, lista; ámbar, con avisos; rojo, falta algo" },
          { que: "Pestañas de las tareas", es: "Con el mismo código del microciclo que el titular (M-T1, M-T2…); sin código en la hoja, su número" },
        ],
      },
      {
        titulo: "Hacer los equipos",
        filas: [
          { que: "En un toque", es: "2 equipos, 2 + 1 comodín, 2 + 2 comodines, 3 grupos, 3 + 2 comodines o 4 rondos: pone la forma y propone el reparto" },
          { que: "Criterio: … · repetir reparto", es:"El criterio del reparto y «Como el 28 oct» o copiar de otra tarea, de hoy o de otro día, casado por nombre" },
          { que: "Proponer equipos / Otra propuesta", es: "Reparte a todos los que hacen la tarea con el criterio elegido (P)", cuenta: "Sin porteros (van aparte) y los comodines rotan entre quienes menos lo han sido; debajo sale una línea por equipo que explica el reparto" },
          { que: "Titulares vs suplentes", es: "El once de la pizarra táctica (tablero «Once 4-2-3-1») en un equipo y los suplentes en el otro", cuenta: "Casado por nombre con la lista; si el once no llena el equipo, entran suplentes de la línea que falta" },
          { que: "Mezcla parcial / total", es: "Parcial: el porcentaje del deslizador cambia titulares de lado, cada uno por un suplente de su línea (100 % = mitad y mitad). Total: titulares a partes iguales y líneas parejas, al azar" },
          { que: "Por líneas", es: "Cada equipo con defensas, medios y arriba; laterales y centrales repartidos" },
          { que: "Reparto propuesto / Criterio elegido", es: "Encima de los equipos: el criterio con que salieron (o el elegido, si se hicieron a mano) y cuántos hay en cada equipo" },
          { que: "11/10 en rojo", es: "Contador de cada campo: jugadores de campo del equipo / huecos del dibujo, contando a los que comparten puesto", cuenta: "Verde si cuadra; ámbar si falta alguien o las líneas no van parejas; rojo si hay más que huecos (al pasar, quiénes comparten): amplía el dibujo o pasa a uno" },
          { que: "X pasa a Naranja y Y a Amarillo", es: "El arreglo de un toque de las líneas descompensadas, con el sentido del cambio" },
          { que: "La hoja dice 10v10…", es: "Aviso si el formato de la hoja no cuadra con lo colocado, en total o equipo a equipo (11 y 10 en un 10v10); si la tarea se renombró, dice de qué tarea de la hoja sale", cuenta: "Un aviso solo es una frase («La tarea pide 16 (8v8) y hay 14 colocados») con su acción en oro; con varios, el primero y «Ver el detalle». Si falta gente, botón «Meter a X en Naranja»: el primero sin colocar o, si no hay, el primero que no hace la tarea, al equipo al que más le falta" },
          { que: "Más opciones", es: "Plegados: formato con estructura, cambio a mitad, tamaño del campo, comodines y qué pasa al soltar encima de otro. Cada uno sale solo si ya se está usando" },
          { que: "Sinergias / Por perfiles", es: "Parten de «Por líneas» y sólo cambian jugadores de la misma línea", cuenta: "Sinergias: juntas las parejas que se potencian según Wyscout (Data análisis, once). Perfiles: el rasgo que más destaca de cada uno contra su puesto, repartido o junto" },
          { que: "Completar", es: "Coloca sólo a los que faltan, en el equipo más corto, sin mover a nadie", cuenta: "Sale cuando ya hay alguien colocado y alguien pendiente" },
          { que: "Ficha del jugador", es: "La chapa «Ficha» en cada jugador de un equipo (sólo los de la plantilla) abre su ficha y su seguimiento en /individual, en otra pestaña, sin romper el arrastre. El nombre del jugador salta de línea en vez de cortarse; las chapas pasan debajo si no caben" },
          { que: "No hacen esta tarea", es: "Los que no están en la tarea; debajo, los disponibles sin baja que no se han colocado, dicho así («está disponible y no se le ha colocado»). Si la tarea pide más de los que hay, el aviso lo dice: «faltan 1 aunque entren los 15 disponibles»" },
          { que: "Revisión del cuerpo técnico tras la tarea", es: "Lo que se apuntó en la hoja después de la tarea (columna «Análisis post»): «conceptual» = sobre la idea de juego; «sensación jugador» = cómo la vivieron" },
          { que: "Tarea (junto a Proponer)", es:"Vaciar la tarea, Como la anterior (equipos, colores y comodines de la tarea de antes), Duplicar, Mover antes o después y Quitar esta tarea" },
          { que: "Chip del puesto", es: "En los que suben del RMC o del Juvenil A, el puesto aprendido de cómo los colocáis (borde de puntos) o el fijado a mano (lleno). Tocarlo lo corrige para todas las sesiones" },
          { que: "Soltar encima de otro", es: "«Cambiar»: los dos se intercambian el sitio. «Compartir puesto»: van juntos en el mismo hueco (dos, tres o los que hagan falta)", cuenta: "Debajo del campo, «También en…» comparte ese mismo puesto en el otro equipo: entra el que esté fuera del dibujo o queda un «+» donde soltarlo" },
          { que: "Cambio a mitad", es: "Un segundo momento de la tarea con otros equipos; sale como otra diapositiva" },
        ],
      },
      {
        titulo: "El validador",
        filas: [
          { que: "Rojo", es: "Falta alguien por colocar, hay un equipo vacío o un nombre repetido en la lista" },
          { que: "Ámbar", es: "Equipos o líneas descompensados, colores repetidos o comodines que no cuadran", cuenta: "Línea descompensada: dos o más de diferencia entre equipos en defensas, medios, extremos o delanteros" },
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

  /* ==================== AJUSTES (12/11/2026) ==================== */
  {
    ruta: "/entrar",
    titulo: "Entrar en la plataforma",
    resumen: "La puerta: desde el 18/11/2026 hay que entrar. El cuerpo técnico con su cuenta (la de la quiniela) y cada jugador con su usuario y su contraseña.",
    origen: "Las cuentas del staff son las de la quiniela (Supabase, secreto:quiniela-cuentas); las de los jugadores, lib/acceso/jugadores.ts; el código del staff y si el acceso de jugadores está abierto, Ajustes → Acceso (secreto:acceso). Las sesiones son cookies firmadas: 30 días.",
    revisada: "2026-11-19",
    bloques: [
      {
        titulo: "Dos maneras de entrar",
        filas: [
          { que: "Cuerpo técnico", es: "Correo y contraseña. «Registrarme» pide además el código del cuerpo técnico (lo da Víctor). Lo ve todo" },
          { que: "Cuerpo técnico sin correo", es: "Algunas cuentas son de usuario, sin correo (p. ej. «davidmartin»): se escribe el usuario donde va el correo. No reciben los avisos de la quiniela" },
          { que: "Jugadores", es: "Usuario: nombre y primer apellido (p. ej. «Pol Fortuny»); contraseña: su nombre y 123 («pol123»). Da igual mayúsculas y tildes. Van a su inicio (/jugadores) y ven sólo sus pantallas", cuenta: "Cinco fallos seguidos con el mismo usuario lo cierran 15 minutos, sólo a él" },
          { que: "Volver a donde iba", es: "Quien abre un enlace sin haber entrado, al entrar llega a esa pantalla" },
        ],
      },
      {
        titulo: "Lo que no pide entrar",
        filas: [
          { que: "Enlaces que salen por WhatsApp o correo", es: "Los vídeos (/api/video) y los PDF de los informes (/pdf) se abren sin entrar, como hasta ahora" },
        ],
      },
    ],
  },
  {
    ruta: "/jugadores",
    titulo: "Acceso de jugadores",
    resumen: "El inicio de los jugadores: sus pantallas en tarjetas y el botón de salir.",
    origen: "La lista de pantallas es lib/acceso/rutas.ts (PANTALLAS_JUGADOR), la misma que filtra su menú y la que hace cumplir el proxy.",
    revisada: "2026-11-19",
    bloques: [
      {
        titulo: "Qué hay",
        filas: [
          { que: "Sus pantallas", es: "Plantillas y scout de rivales, ABP y saques de banda, análisis de goles e histórico de la competición. Desde el 19/11/2026 ya no: calendario operativo, desplazamiento ni identidad y modelo de juego" },
          { que: "Lo que no", es: "Nada de lo que rellena el staff sobre ellos ni lo interno: seguimientos, valoraciones, pizarras, emocional, carga, planes, informes, coding, visionados, tareas, alertas, Data análisis, quiniela, apuestas, laboratorio y Ajustes" },
          { que: "Salir", es: "Cierra la sesión en este aparato y vuelve a la puerta" },
        ],
      },
    ],
  },
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
          { que: "Límites gratis de hoy (18/11/2026)", es: "Antes de «Otros ajustes»: cuánto llevan Render (minutos de compilación), la base de datos y Backblaze (vídeos y copias) frente a su tope gratis, y lo pendiente de cerrar. Lo mismo que el aviso diario del administrador, pero siempre a la vista", cuenta: "Documento salud:plataformas, que deja cada día el ordenador del club (scripts/salud-datos.mjs)" },
          { que: "Plegado", es: "Cada proceso es una línea con un punto de color (verde al día, dorado en marcha, ámbar con aviso, gris sin dato), «Hecho hace X» con lo que dejó y su botón. Lo que está al día va plegado: se pulsa la línea para verlo entero. Lo que está en marcha, falló, se cortó o está en pausa sale abierto y arriba. Arriba, el recuento: cuántos al día, en marcha y con aviso. En «Actualizaciones» igual: lo atrasado o sin fecha primero y abierto, lo que está al día en una línea con «Último dato hace X»", cuenta: "Lo que se abre o cierra a mano se recuerda en este aparato, atado al estado: si algo plegado falla, vuelve a abrirse. components/ajustes/Plegable.tsx" },
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
          { que: "Almacén", es: "Lo que ocupan los ficheros frente a su tope gratis (1 GB en Supabase; mientras la web va con la base de reserva, los ficheros van a Backblaze B2 y el tope es de 10 GB), las carpetas que más pesan y el botón para borrar adjuntos repetidos o caducados" },
          { que: "Lo que sigue haciéndose solo", es: "El recordatorio de lo que corre sin pedirlo" },
        ],
      },
      {
        titulo: "Acceso (18/11/2026)",
        filas: [
          { que: "Acceso de jugadores (19/11/2026)", es: "Abrir o cerrar. Cada jugador entra por /entrar → «Jugadores» con su usuario (nombre y primer apellido) y su contraseña (nombre123); la lista desplegable enseña los de todos para pasárselos. Sólo ven rivales y scout, ABP y banda, análisis de goles e histórico. Cerrarlo, o «Sacar a todos los jugadores», cierra sus sesiones en 5 minutos", cuenta: "Las cuentas están en lib/acceso/jugadores.ts (nombres de BeSoccer, sin los que esconde la plantilla); cinco fallos con el mismo usuario lo cierran 15 minutos. La lista de pantallas y lo vetado, en lib/acceso/rutas.ts" },
          { que: "Código del cuerpo técnico", es: "Lo pide «Registrarme» para crear una cuenta del staff. Quien ya tiene cuenta entra igual. Sin código puesto, nadie nuevo puede darse de alta" },
          { que: "Qué NO ven los jugadores", es: "Seguimientos e Individual, valoraciones, emocional, carga física, pizarras (táctica, de sesión y de ABP), planes e informes, coding, visionados, tareas, alertas, quiniela, apuestas, laboratorio, Data análisis y Ajustes: ni en el menú, ni abriendo la dirección, ni pidiendo los datos a mano (la API dice 403)" },
        ],
      },
      {
        titulo: "Actualizaciones",
        filas: [
          { que: "Los grupos", es: "Cada noche · la jornada, Cada mañana, Cada semana o cada mes, Durante el día y Cuando se pide" },
          { que: "Último dato", es: "La fecha del dato de verdad, no la de la última pasada" },
          { que: "Al día / Atrasada / Sin dato", es: "Si va a tiempo", cuenta: "Atrasada = más del doble de lo normal (y un margen) sin ponerse al día" },
          { que: "El botón de cada uno", es: "Los que se pueden pedir a mano lanzan el mismo encargo de «Poner al día»" },
          { que: "Clips de Hudl de los jugadores rivales (17/11/2026)", es: "Cada noche con la jornada y al pedirlo (aquí o con «Pedir a Hudl» en Scout individual y Plantillas rivales): baja a 720p los clips nuevos de las listas «RIVAL - JUGADOR» de Hudl para descargarlos desde la app", cuenta: "scripts/hudl-clips-rival.mjs, encargo hudl-clips, documento hudl:clips-rival; usa el Chrome del Wyscout por turnos" },
        ],
      },
      {
        titulo: "Actualizaciones automáticas desde X",
        filas: [
          { que: "Leído / Falta iniciar sesión en X", es: "Cuándo se leyó @fernandosb9 por última vez (cada mañana a las 7:45 o con «Leer ahora»), cuántas publicaciones nuevas y cuántas ideas salieron; si falta la sesión o X pide comprobación, lo dice y no se insiste" },
          { que: "Plegadas", es: "Cada idea es una línea (título, pantalla y estado) que se despliega al pulsarla; las que están añadiéndose, deshaciéndose o no salieron, abiertas. Las ya añadidas o deshechas van juntas y plegadas en «Ya añadidas o deshechas», como las descartadas. Lo que se abre a mano se recuerda en el aparato" },
          { que: "Cada idea", es: "Qué cambiar, en qué pantalla y por qué; para qué fase y momento de la semana, qué decisión ayuda a tomar, de qué dato real sale (Opta, Wyscout, nuestras hojas o BeSoccer) con su muestra mínima y un ejemplo de lectura; con un trozo de la publicación y su enlace a X. Primero las que sirven para el próximo partido, luego las de la semana y al final las de fondo", cuenta: "Las saca Claude de las publicaciones nuevas con la lista de pantallas de esta ayuda; pensando como el cuerpo técnico y sin repetir las ya propuestas (añadidas o descartadas); se tiran las que no encajan en ninguna pantalla, las que no dicen de qué dato real salen y las repetidas" },
          { que: "Añadir", es: "El ordenador del club la programa en una copia aparte, pasa tsc, eslint, la ayuda de la pantalla y el build y, sólo si todo sale, la publica (la web se redespliega). Si algo falla: «No salió», con el motivo, y no se publica nada" },
          { que: "En cola", es: "Las ideas se programan de una en una, por orden de pedido (cada una ~30 min: programarla ~20 y comprobarla ~8). La que está en marcha dice «Programando ahora» y el panel enseña su progreso; las demás, «En cola · 2.ª», «3.ª»…, con la hora a la que acabaría cada una. Si no ha empezado, el panel dice por qué: el ordenador del club no contesta o está con el análisis del partido (las dos cosas a la vez no caben en su memoria)", cuenta: "La hora es lo que le queda a la que está en marcha más ~30 min por cada una que va delante" },
          { que: "Deshacer", es: "En una idea añadida: revierte exactamente sus cambios, con las mismas comprobaciones, y la publica. Si algo posterior depende de ella, lo dice y no fuerza nada: la idea sigue añadida" },
          { que: "Descartar · Recuperar", es: "La aparta (queda en «Descartadas») o la devuelve a la lista" },
          { que: "Historial", es: "Quién pidió qué y cuándo, cómo acabó y los commits de la idea" },
        ],
      },
    ],
    ojo: [
      "Las ideas de X vienen de internet: a quien las programa sólo le llega la idea resumida, como dato, y no puede tocar secretos, credenciales, workflows, dependencias ni borrar datos.",
      "Mientras trabaja Wyscout o el análisis del partido, en el ordenador del club se mueve solo un Chrome: que nadie lo toque.",
      "Con el ordenador del club apagado no se pierde nada: el encargo queda apuntado y empieza al encenderlo.",
      "La lista de «Actualizaciones» sale de un catálogo: un proceso nuevo que no se añada allí no aparece.",
    ],
    revisada: "2026-11-21",
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
          { que: "Línea de hoy", es: "Arriba del todo: la fecha de hoy, el partido si se juega hoy (jornada y rival, del calendario de BeSoccer) y cuántas alertas activas salen hoy. Enlaza a «Tu día», en la portada." },
          { que: "Semana del siguiente partido", es: "La rejilla de MD-6 a MD de la semana del partido al que van las alertas, con la fecha de hoy en el rótulo. Los días con avisos son más anchos. Cada aviso pone la hora en negrita y en su renglón, el título debajo y las iniciales de a quién llega." },
          { que: "Revisar y reactivar", es: "El botón principal cuando todo está silenciado dice cuántas son y, debajo, cuántos correos saldrían y a cuántas personas. Abre una lista para marcar cuáles reactivar, cada una con cuándo saldría y a quién. Las desmarcadas siguen silenciadas." },
          { que: "Grupo del partido", es: "Encima de las tarjetas silenciadas: «Ver el plan del partido vs …» (abre el plan con el rival ya elegido, por el ID de la hoja RIVALES) y «Su plantilla»." },
          { que: "Tarjetas", es: "La fecha de salida es el dato principal. La regla («2 días antes del partido vs …») va en el renglón de debajo. Se ven hasta cuatro destinatarios por su nombre. El enlace a la pantalla donde se hace la tarea va en su propio renglón, a todo el ancho." },
          { que: "Caducadas", es: "Abiertas, con «Darle nueva fecha» y «Borrar» (este pide confirmación) en la tarjeta." },
          { que: "No sale ningún correo", es: "Con todo silenciado, el estado arriba, cuándo saldría la primera y un solo botón «Reactivar todas · N correos a M personas» (pregunta antes); «Nueva tarea con alerta», al pie de la lista" },
          { que: "Próxima semana de partido · JN vs <rival>", es: "Los siete días de MD-6 al partido con su fecha, cada aviso en su día y el MD con el rival; en el móvil, sólo los días con aviso y el partido" },
          { que: "Ver mis tareas de hoy", es: "Vuelve a la portada («Tu día»)" },
          { que: "N silenciadas · próxima, fecha", es: "Estado único y neutro: cuántas silenciadas, cuándo saldría la primera, cuántos correos saldrían y a cuántas personas distintas si se reactivan; «Reactivar todas» pide confirmación con cada tarea y sus destinatarios" },
          { que: "La semana del partido", es: "Sólo los días MD con alguna tarea atada al partido, con su fecha; cada pastilla dice la hora a la que sale y lleva a su tarjeta. Silenciada: borde discontinuo y campana tachada. También en el móvil" },
          { que: "Cuándo sale (en la tarjeta)", es: "Una sola línea: fecha y hora de salida y su regla («2 días antes del partido vs Rival»), con el rival abriendo su plantilla" },
          { que: "Ver en el microciclo · MD-n", es: "La tarea atada al partido lleva al microciclo y dice en qué día MD cae" },
          { que: "Caducadas", es: "Plegadas al pie; el resumen y cada tarjeta dicen por qué («era de una sola vez y ya salió» / «su fecha ya pasó») y cuándo salió por última vez" },
          { que: "N alertas activas · próximo aviso", es: "Cuántas van a sonar y cuál es la siguiente, con su fecha" },
          { que: "La semana del partido (17/11/2026)", es: "Encima de las tarjetas, en pantalla ancha, siete casillas de MD-6 al partido con cada tarea atada al partido en su día: en oro la que va a salir, con borde la silenciada. Para ver qué sale cuándo sin leer las tarjetas", cuenta: "Día = días antes del partido de la tarea; las que no van atadas al partido no salen aquí" },
          { que: "Ahora no sale ningún correo", es: "Si todas están silenciadas o caducadas, arriba un aviso en ámbar con borde e icono: cuántas hay, cuál saldría primero al reactivarlas y «Reactivar todas» (pide confirmación con las tareas y a quién avisan). Si además hay caducadas, lo dice al final («Y 1 caducada que necesita fecha nueva»)." },
          { que: "La tarjeta", es: "Tarea, cuándo sale, cada cuánto se repite, a quién va, alarma, adjuntos y cuántas veces se ha enviado. Dos destinatarios a la vista y «y N más», que despliega el resto (al pasar por encima ya dice quiénes)" },
          { que: "Abrir … (dónde se hace)", es: "Junto a la acción principal, el enlace a la pantalla en la que se hace lo que pide la tarea: PDF individual → Individual; once o «director 11» → pizarra táctica; balón parado → pizarra ABP; informe → Microciclos; rival o plantilla → su plantilla con el rival del partido ya elegido; viaje → Desplazamiento. Si el texto no dice nada reconocible, no sale", cuenta: "Se lee del título y del mensaje de la tarea. Si la tarea no casa con ninguna y va atada al partido, «Ver en el microciclo»: ninguna tarjeta se queda sin salida" },
          { que: "Silenciadas (N)", es: "No sale ningún correo hasta reactivarlas; agrupadas por partido. Junto al rótulo de cada partido, «Abrir a <rival>» lleva a su plantilla con el rival ya elegido. Si todas las del partido salen los mismos días antes, la regla va una vez en ese rótulo («· salen 2 días antes del partido») y no en cada tarjeta. «Reactivar» pregunta antes con el nombre de la tarea y a quién avisa" },
          { que: "Caducadas (N)", es: "Silenciadas cuya fecha ya pasó: siempre abiertas, y en su rótulo el nombre de cada una y por qué («ya no saldría aunque la reactives: necesita fecha nueva»). Su botón es «Ponerle fecha nueva»; si ya no hacen falta, «⋯ › Borrar» (pide confirmación)" },
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
    revisada: "2026-11-21",
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
          { que: "Partido de esta semana", es: "La semana es la del calendario (de lunes a domingo). Si el partido de esta semana ya se jugó, la cabecera nombra el próximo, con la misma regla que la portada (fecha y hora de Madrid de BeSoccer y 2,5 h de gracia)." },
          { que: "AHORA · Jnn", es: "La jornada de ese partido: el próximo en cuanto el de la semana se ha jugado." },
          { que: "Plan de partido y enlaces al rival", es: "Son los del próximo partido, con su rival ya elegido." },
          { que: "Lista de la semana con subida directa", es: "Convocatoria, horario y (si hay partido) plan de partido, cada uno con su casilla. Se marca leyendo el nombre de los archivos de la semana en curso (convoca, horario, plan). Cada cosa que falta tiene su botón «Subir…», que abre el selector de archivos y sube a la semana en curso; si el nombre del archivo no dice qué es, se le antepone («Convocatoria-…») para que la casilla quede marcada. «Otro material» sube cualquier otro archivo (JPG, PNG, WEBP o PDF, hasta 20)." },
          { que: "Plan de partido del rival", es: "En la casilla Plan de partido, «Abrir el de la J..» lleva al Plan de partido con el rival de la semana ya elegido (?rival=ID de la hoja RIVALES, buscado por la fecha del calendario de BeSoccer)." },
          { que: "Accesos de la semana, en un solo sitio", es: "Contenidos del microciclo, la plantilla del rival y su ABP van en la tarjeta de la semana en curso, arriba. Si la semana en curso está vacía, no se repite abajo otra tarjeta de la misma semana; con material, abajo sale su contenido sin repetir los accesos." },
          { que: "Semanas con convocatoria, horario y plan", es: "Barra de cumplimiento: cuántas semanas transcurridas tienen las tres cosas (el plan sólo cuenta si esa semana hubo partido en el calendario de BeSoccer), sobre el total de semanas hasta la actual, y cuál fue la última completa. Se reconoce por el nombre de los archivos." },
          { que: "Línea de estado", es: "Semana en curso · imágenes y PDF de la temporada en cuántas semanas · último: la última semana con material (abre esa semana)." },
          { que: "Casillas de las semanas", es: "Una por semana transcurrida, de 48 px: el número arriba y, dentro, cuántos archivos tiene («3 arch.») o «vacía». Dorada con material; la semana en curso, rellena con borde dorado y «ahora · J..» debajo." },
          { que: "Archivo", es: "Debajo, en segundo plano, las tres últimas semanas con material, cada una con la miniatura de su último archivo (la primera página del PDF o la propia imagen) y enlace directo. «Ver todo el archivo» abre la lista de todas las semanas por meses." },
          { que: "Lo que falta esta semana", es: "Titular con verbo («Esta semana no hay material: sube la convocatoria, el horario y el plan de partido») y tres casillas —Convocatoria, Horario y, si hay partido, Plan de partido— marcadas si ya hay un archivo con ese nombre («convoca», «horario», «plan»); botón «Subir a la semana N», «Plan de partido» (?rival=ID) y «ABP de <rival>»; en pequeño, el último material" },
          { que: "Aquí se guarda lo que se reparte…", es: "En qué se diferencia de la portada («Tu día» y «Mis tareas»), con enlace" },
          { que: "Últimas semanas con material", es: "Las 3 semanas más recientes con algo subido, cada una con su último archivo (enlace directo, icono de tipo) y, si su partido ya se jugó, «JN … · su análisis» al post; «Ver las otras N con material» despliega el resto; la lista por meses, plegada, sirve para buscar una semana futura o por fecha" },
          { que: "El número de cada casilla", es: "Cuántos archivos tiene la semana (imágenes + PDF); la actual dice «ahora · JN»" },
          { que: "Semana N · I imágenes y P PDF en M de T semanas", es: "Una sola línea con su base; las cifras de imágenes y PDF abren todo lo subido en la temporada (sustituye a «De la temporada»)" },
          { que: "La tira de semanas (al pasar por encima)", es: "Fechas, partido y lo que hay dentro («2 imágenes y 1 PDF»)" },
          { que: "Plan de partido / Análisis del partido JN", es: "El plan abre con el rival ya elegido (?rival=ID de la hoja RIVALES, por la fecha); en las semanas ya jugadas, el post de ese partido en Análisis de datos con la fecha y el rival puestos" },
          { que: "Subir", es: "Un único botón en la semana vacía, sin titular de ausencia; debajo, los formatos admitidos" },
          { que: "Semana N · M de T semanas con material · última subida, la semana X", es: "Una sola línea neutra bajo el título (17/11/2026, en vez del aviso ámbar): la semana en curso, cuántas de las transcurridas tienen material y, si la de ahora está vacía y llevamos dos o más sin subir, la última con algo (con sus fechas), que abre esa semana. La acción de subir está en la semana de abajo, una sola vez", cuenta: "M = semanas con al menos una imagen o un PDF, de la 1 a la actual" },
          { que: "La tira de semanas", es: "Una casilla por semana hasta la actual (44 px en el móvil, 36 en el ordenador): dorada con marca, con material; en blanco, sin él; «ahora», la actual. Al pasar por encima, sus fechas y el partido de esa semana («J13 vs Real Murcia (en casa)», «J12 en Gimnàstic Tarragona · 1-0»). En el móvil abre en la actual y dice «← N más a la izquierda» (pulsarlo vuelve a la 1)", cuenta: "El partido sale del calendario de BeSoccer: el del Castilla cuya fecha cae dentro de la semana" },
          { que: "De la temporada: N imágenes · N PDF", es: "Un solo control con las dos opciones: abre todo lo subido, de la semana más reciente a la más antigua (cuántas semanas tienen material lo dice ya la línea de arriba)" },
        ],
      },
      {
        titulo: "La semana",
        filas: [
          { que: "Imágenes · PDFs · Subir", es: "Las tres pestañas de la semana abierta; abre la semana en curso aunque esté vacía" },
          { que: "El partido y lo que completa la semana", es: "Junto a las fechas, el partido de esa semana. Debajo, «Contenidos del microciclo» y, si el partido no se ha jugado, «Plan de partido», «Plantilla de <rival>» y «ABP rival» con el rival ya elegido; si ya se jugó, «Histórico de partidos»" },
          { que: "Esta semana no hay material", es: "Con el botón de subir; en otra semana vacía, también el enlace a la última que sí tiene (en la de ahora lo dice la línea de arriba)" },
          { que: "Borrar", es: "Quita la imagen o el documento de esa semana; no se puede deshacer" },
        ],
      },
    ],
    ojo: [
      "Si una subida o un borrado falla, se deshace sólo ese cambio y se avisa.",
      "Dos personas subiendo a la vez no se pisan: viaja sólo el cambio, no la temporada entera.",
      "La lectura se renueva sola: ya no hay botón «Actualizar». En el buscador (Ctrl+K) sale con «repositorio» o «general».",
    ],
    revisada: "2026-11-21",
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
    revisada: "2026-11-18",
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
          { que: "Escala de las barras", es: "Cada barra se mide contra el más votado de su lado: 9 en los valores y 22 en lo que los destruye" },
          { que: "Sin votación", es: "Lo que el documento añade sin haberse votado (Apatía) va en una nota aparte con ◇, no en la columna de votos" },
          { que: "Valor contra antivalor", es: "Una fila por valor: a la izquierda lo que lo destruye con sus votos (granate), en el centro el valor y a la derecha sus votos (oro) con su base; el titular dice el más votado y lo más rechazado. Los votos afines («+3 Amistad») se explican una vez al pie" },
          { que: "Ver el documento", es: "La vista previa va plegada; se abre con «Ver el documento» o al pulsar «Sus conductas». «Proyectar» abre la diapositiva a pantalla completa" },
          { que: "Añadir o corregir un documento", es: "Sólo el administrador, plegado al final: subir el bruto y cómo crece la estantería" },
          { que: "Lo destruye", es: "Si ningún antivalor de ese valor tiene votos, lo dice: «sin votos: lo propone el documento»" },
          { que: "El titular", es: "Cuántos valores se votaron y cuál fue el más votado, con sus votos sobre el total", cuenta: "Sale del propio documento de valores: si cambia el recuento, cambia el titular" },
          { que: "La barra de acciones", es: "Una sola fila bajo el titular: Descargar en PDF, Descargar en PowerPoint, «Proyéctalo en la charla», la hoja de ruta de la cultura (/team-values) y el seguimiento de los jugadores; sin tarjeta aparte del documento, para que la vista previa empiece antes" },
          { que: "Las cinco láminas", es: "Un valor por lámina: su número, «Lo votaron» (barra de oro con N de 32 votos) y «Lo destruye · N de 55 votos» (con su base en el título; barra granate por antivalor con sus votos; el nombre entero, a dos líneas si no cabe). Pulsar una lámina abre su diapositiva de conductas en la vista previa; «Seguimiento →» lleva al seguimiento de los jugadores", cuenta: "Es el único recuento completo de la app; /team-values enlaza aquí. La cabecera da las dos bases: votos a los valores y votos a los antivalores, contados aparte" },
          { que: "Antivalores sin cifra", es: "Si un antivalor sin votos ya cuenta en otro valor (Conformismo, con 10 en Compromiso), no se repite en la lámina; el que no tiene cifra en ninguno sale con su nombre, sin barra. Las diapositivas los mantienen tal y como los escribió la plantilla" },
          { que: "+N a otro valor (aparte)", es: "Votos que la plantilla escribió con otra palabra parecida (Amistad junto a Compañerismo; Valentía / Pasión junto a Exigencia): la lámina lo explica, se enseñan aparte y no suman al valor ni entran en el total" },
          { que: "La unidad", es: "Siempre votos: «9 de 32 votos», igual en la lámina, en la portada y en la diapositiva de cada valor" },
        ],
      },
      {
        titulo: "La estantería",
        filas: [
          { que: "Documentos", es: "Los publicados, por número; se elige uno para verlo" },
          { que: "Vista previa", es: "Cada diapositiva tal y como se descarga; se abre a pantalla completa de un toque y se pasa con las flechas o con la tira de pestañas (en el móvil, en horizontal y compacta). La diapositiva va en la dirección (#diapo-N), así que se puede enlazar" },
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
    revisada: "2026-11-20",
  },

  /* ==================== CALENDARIO DE SEGUIMIENTO (12/11/2026) ==================== */
  {
    ruta: "/calendar",
    titulo: "Calendario de Seguimiento",
    resumen: "Los seguimientos individuales, día a día, y a quién del Castilla toca seguir.",
    origen: "Hoja de seguimiento, una fila por registro (la misma de /individual). El jugador se ata por nombre con la plantilla, no por ID. Los días de partido salen del calendario de BeSoccer (el mismo de la portada).",
    bloques: [
      {
        titulo: "Las cifras del mes",
        filas: [
          { que: "Semana en curso", es: "Va aparte y rayada, con su cifra hasta hoy; la media (raya) es la de las 7 semanas cerradas" },
          { que: "Pendientes", es: "Cada jugador sin seguimiento en 14 días lleva sus seguimientos, su Dashboard Seguimiento y «Registrar»" },
          { que: "Tarjeta de seguimiento", es: "Nombre del jugador con la franja de su tipo; quién lo hizo, al pasar el ratón o al abrir el día; «×2» si el mismo jugador, tipo y autor salen dos veces ese día (posible duplicado)" },
          { que: "Seguimientos del mes", es: "La cifra y su comparación con el mes anterior al mismo día; la temporada y los de otros equipos, al pasar el ratón" },
          { que: "Registros repetidos", es: "Un registro copiado en la hoja (mismo jugador, día, autor y contenido; sólo cambia el ID) se pinta una vez. «MD-n» y el recuento del día van en una sola línea" },
          { que: "Seguimientos en (mes)", es: "Registros del mes de los jugadores de campo del Castilla; si es el mes en curso, hasta hoy", cuenta: "Debajo, cuántos más o menos que el mes anterior al mismo día (o entero), lo programado después de hoy y la temporada hasta hoy (la misma cuenta que el Dashboard Seguimiento). Lo de otros equipos (RMC, juvenil y demás licencias que entrenan con nosotros) va aparte, este mes y en la temporada. Los porteros no cuentan: llevan un registro independiente y sus registros no se pintan" },
          { que: "Jugadores con seguimiento", es: "«N de M»: jugadores de campo del Castilla con algún registro ese mes, sobre todos ellos; el pie dice la base («de los 18 jugadores de campo del Castilla, sin porteros»)", cuenta: "Debajo, cuántos de otros equipos además" },
          { que: "Por tipo", es: "Registros del mes de los de campo del Castilla (la base va al pie) por estrategia, en una columna en pantallas estrechas: Campo, Vídeo, Charla, Vídeo y charla, Sin tipo escrito", cuenta: "Se lee de la columna ESTRATEGIA; «Sin tipo escrito» es lo que no trae ninguna de esas palabras" },
          { que: "Por semana · últimas 8", es: "Con la base («de los N de campo») al pie, como las otras tres. Barras de los registros de los de campo del Castilla en las 8 últimas semanas (lunes a domingo) con la media de las cerradas en raya", cuenta: "La semana en curso va rayada (trama), con el día en que va (día N de 7), y fuera de la media" },
          { que: "Selector de jugador", es: "«Todos (sin porteros)» o uno: Castilla de campo y otros equipos, cada grupo por orden alfabético; con uno elegido, «Ficha» y «Registrar seguimiento» al lado", cuenta: "Se entra ya filtrado con /calendar?player=ID (desde la ficha o el Dashboard Seguimiento)" },
        ],
      },
      {
        titulo: "El calendario",
        filas: [
          { que: "A quién toca seguir", es: "Jugadores de campo del Castilla sin ningún seguimiento en 14 días, con los días desde el último; el nombre abre su ficha y «Registrar seguimiento» abre el formulario con el jugador ya elegido. Es el mismo aviso que Plantilla y el Dashboard Seguimiento: aquí sin repetir la explicación y con «Ver a todos en el Dashboard Seguimiento →»", cuenta: "14 días que acaban hoy, hoy incluido; los porteros no cuentan. Sólo sale sin filtro de jugador" },
          { que: "Día de partido", es: "En azul, con el marcador del Castilla primero (V/E/D), «vs» en casa y «@» fuera. Es un enlace: jugado, a su análisis post; por jugar, al rival ya elegido (goles, ABP y su once)", cuenta: "Al abrir el día, «Análisis del partido» lleva al post de Análisis de datos" },
          { que: "Tarjeta del día", es: "El jugador y quién lo hizo (sin autor escrito, sólo el nombre); la franja de color es el tipo", cuenta: "Hasta 3 por casilla; con más, una barra de colores con el reparto por tipo de todo el día y «+N más», que abre el día" },
          { que: "MD", es: "Los días de la semana del próximo partido llevan «MD-n» (días que faltan) y «MD» el del partido, para programar el seguimiento dentro del microciclo" },
          { que: "Programado", es: "Registro con fecha posterior a hoy: borde de puntos y fuera de las cifras «hasta hoy»" },
          { que: "El día abierto", es: "Cada registro con su estrategia, quién, objetivo ofensivo, defensivo, mental y feedback, y sus accesos: ficha, seguimiento y registrar" },
          { que: "Pinchar un nombre", es: "Abre su ficha en /individual" },
        ],
      },
    ],
    ojo: [
      "La hoja también apunta seguimientos de jugadores de otros equipos: por eso las cifras separan el Castilla del resto.",
      "Aquí sólo se lee; los seguimientos se escriben desde la ficha individual.",
      "La leyenda de los tipos va encima del mes, no al pie (16/11/2026).",
    ],
    revisada: "2026-11-20",
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
          { que: "Próximo partido (franja de arriba)", es: "El próximo según la regla de la portada: deja de serlo 2,5 h después de su hora de Madrid, no a medianoche." },
          { que: "Titular de la sesión", es: "El contenido con más minutos de lo que se hizo: las tareas del plan que no se hicieron (según los equipos) no cuentan; sin minutos, «Sesión hecha · N tareas»" },
          { que: "Sesión hecha", es: "Con equipos en Jugadores sesión, «Sesión hecha» (no «Planificada») y su carga; lo que no se hizo, tachado («… · no se hizo»)" },
          { que: "Viajes", es: "Chip con la hora delante («Salida 13:00 · Traslado al estadio») en dos líneas como mucho, que abre el desplazamiento" },
          { que: "Partido", es: "Además de Plan o Informe, «Su ABP», «Sus goles» y «Su plantilla»" },
          { que: "Próximo partido", es: "Jornada, rival, día y hora; si es fuera, desde qué día se viaja y lleva a su desplazamiento" },
          { que: "Partido", es: "Jornada, rival con escudos, en casa o fuera y la hora; si ya se jugó, el resultado con su sentido («ganado 1-0», el Castilla primero)" },
          {
            que: "Viaje",
            es: "Un renglón ligero con punto morado (el partido manda en la casilla): «Viaje a…» los días antes, «Traslado al estadio» y «Vuelta de…» el día del partido, «Vuelta de…» los días de después, cada uno con su primera cita y su nombre: «salida 08:40» sólo si la cita es una salida; si no, la cita como se llama en Desplazamiento («llegada estadio 14:30»). En el día abierto, «Abrir el desplazamiento» lleva a ese viaje",
            cuenta: "El día del partido, las citas de viaje antes de la hora del partido son el traslado y las de después, la vuelta. Partido fuera sin viaje guardado: la misma propuesta que abre Desplazamiento sin distancia (viajeVacio); si esa propuesta no trae hora de salida, no se pinta nada. Una cita sin hora nunca sale",
          },
          {
            que: "Sesión (MD y minutos)",
            es: "El MD del día, los minutos de entreno y el contenido de más minutos, con un punto del color de la fase que manda (como /micro_calendar); en discontinuo y «planificada» si la hoja aún no tiene sus minutos",
            cuenta: "Sin la fila del partido. MD = días que faltan para el próximo partido, hasta 14, con la regla común del creador de micros; lo planificado sale de la hoja publicada aunque la copia de lo hecho no lo traiga. En los días aún sin sesión, el MD previsto (discontinuo) sale en todos los días hasta el próximo partido (el micro en curso) y, más allá, sólo de MD-5 a MD-1; el segundo día tras un partido, «MD+2»",
          },
          { que: "Libre", es: "Día sin sesión ni partido entre la primera y la última sesión apuntadas que no lleva MD. El día después de un partido ya no es «Libre»: es «MD+1 · recup.»" },
          { que: "MD", es: "La misma regla que Contenidos Microciclo (mdDelCalendario): MD el día del partido, MD+1 el siguiente, MD+2 el segundo (salvo partido a dos días o menos) y si no MD-n hasta el próximo. En días sin sesión, trazo discontinuo; MD-6 en adelante sólo en la semana en curso" },
          { que: "Enlaces en la casilla", es: "Sin abrir el día: la sesión lleva «Ver la sesión →» (Microciclos en su micro y MD); el partido, «Informe →» o «Plan de partido →» y, con el rival ya elegido, «Su ABP» y «▶ Sus goles» (en el pop-up de la portada, 18/11/2026); cada línea de viaje (con «→») abre su desplazamiento. La vuelta del día del partido lleva su salida y su llegada" },
          { que: "UA del entreno", es: "Bajo «Sesión · 43'», la carga del entreno hecho en UA; al pasar por encima, su base («UA = minutos × intensidad · 5 de 6 tareas con tiempo e intensidad»)" },
          { que: "El día abierto: accesos", es:"Una sesión abre su micro y su MD en Microciclos, sus equipos en Jugadores sesión y su análisis de entrenamiento. Un partido jugado, «Informe del partido» (Microciclos en su micro); uno por jugar, el Plan de partido, el ABP y los goles en vídeo del rival (en el pop-up de la portada, con «Cómo son sus goles ›» al lado), ya elegido", cuenta: "El micro de cada fecha sale de la hoja de registro; el Plan, por el ID de la hoja RIVALES buscado por la fecha" },
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
          { que: "Resumen del mes", es: "Cuántos partidos (y jugados), viajes, entrenos en la hoja, eventos del staff, imágenes y PDF; los jugados, nombrados con su resultado y un toque a su informe («J10 vs Cartagena ganado 2-0 →»)" },
          { que: "Leyenda", es: "Encima del mes, corta y con las mismas palabras que Contenidos Microciclo: sólo los tipos que tienen algo en el mes, «Fase con más minutos (sin Global)» con sus colores y «MD-n = días hasta el partido · discontinuo = aún sin sesión»" },
        ],
      },
    ],
    ojo: [
      "Partidos, viajes y sesiones aquí sólo se leen: se cambian en su pantalla (BeSoccer, /desplazamiento, la hoja de microciclos).",
      "Si una fuente no llega en 15 s se ofrece reintentar; lo que sí llegó se pinta igual.",
      "Entrenos y partidos se cuentan igual que en /micro_calendar: la fila de competición no es sesión.",
    ],
    revisada: "2026-11-21",
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
      "La leyenda de los tipos va encima del mes, no al pie (16/11/2026).",
    ],
    revisada: "2026-11-16",
  },
  /* ==================== CONTENIDOS MICROCICLO (12/11/2026) ==================== */
  {
    ruta: "/micro_calendar",
    titulo: "Contenidos Microciclo",
    resumen: "Cada día de entreno con su MD, sus minutos y sus contenidos, y la carga del mes contra el anterior.",
    origen: "Hoja de microciclos, una fila por tarea (la misma de /microcycles): lo hecho, de la copia del Apps Script; lo planificado que aún no está en ella, de la hoja publicada (la fuente común de las pantallas de planificación). Hora, lado y resultado del partido: calendario de BeSoccer.",
    revisada: "2026-11-21",
    bloques: [
      {
        titulo: "Las cifras del mes",
        filas: [
          { que: "Sólo suma lo hecho", es: "Los minutos de cada día, el VOLUMEN del mes y la carga física y la cognitiva (UA) salen sólo de las tareas hechas. La tarea del plan que no casa con los equipos de Jugadores sesión cuenta como «no se hizo» y no suma; es la misma regla de lib/sesion-dia/estado-dia.ts que usa el calendario operativo. Por ejemplo, el 27/10 da 29′ y no 43′." },
          { que: "«no se hizo · no suma» en el día abierto", es: "En el día abierto, la tarea que no se hizo lleva esa marca, y sus minutos no entran en el total del día ni en el de su bloque." },
          { que: "Titular", es: "Sólo la conclusión: «Noviembre: más carga física (+19 %) y menos cognitiva (−25 %) que octubre». Se compara la carga media por entreno con minutos en los mismos días de los dos meses, con 3 entrenos como mínimo en cada uno." },
          { que: "Subtítulo", es: "Entrenos (hechos y planificados), volumen y la base de la comparación: «8 entrenos con minutos frente a 6, días 1-12 de noviembre y octubre». Con menos de 25 entrenos por lado se añade «tendencia»." },
          { que: "Aviso de arriba", es: "Una frase de orden, sólo con días que vienen. Cada día lleva la media de su MD: «el sábado, 21/11 (MD+1) sin pasar de X UA, la media de N MD+1 de la temporada». Si un MD tiene menos de 3 sesiones en la temporada, ese día no se cita. El porqué con sus cifras va al pie del gráfico." },
          { que: "Barras de carga", es: "Encima de cada barra, sus UA; debajo, el día y su MD entero («3» y «MD-5»: cinco días antes del partido; MD+2: dos días después). La raya es la media de ese MD en la temporada. En el móvil hay una fila por entreno con la cifra escrita (no hace falta pinchar), y al tocar la fila se abre su día." },
          { que: "Enlaces de cada día", es: "Cada casilla de entreno, hasta hoy, lleva «Jugadores sesión →» y «Análisis del entreno →» con la fecha ya elegida, además de «Ver la sesión →»." },
          { que: "Hecho o planificado", es: "Un día está hecho si tiene equipos en Jugadores sesión, minutos o ya está en la copia de lo hecho de la hoja (lib/sesion-dia/estado-dia.ts), igual que en el Calendario operativo" },
          { que: "Equipos y análisis del día", es: "Cada día de entreno pasado enlaza a Jugadores sesión y a Análisis de entrenamiento con su fecha" },
          { que: "Día hecho o planificado", es: "Con equipos en Jugadores sesión el día sale «hecha» aunque la hoja no traiga minutos; la tarea del plan que no se hizo va tachada aparte (misma regla que Microciclos, lib/sesion-dia/estado-dia.ts)" },
          { que: "Carga por entreno", es: "El MD de cada barra es el del calendario (como la casilla), con color propio para MD-6 a MD+2; bajo cada barra el día y su MD, y en la comparación cuántos entrenos tiene cada mes" },
          { que: "Aviso de carga", es: "Arriba sólo la frase de orden; el porqué con sus cifras, al pie del gráfico" },
          { que: "Rival en la casilla", es: "Nombre corto en una línea; el nombre entero, al pasar el ratón" },
          { que: "Aviso de la semana", es: "Bajo el titular, en una tarjeta ámbar: la lectura de la carga (qué MD se ha movido, los días a vigilar del micro de hoy y la carga cognitiva). Antes iba en letra de nota al pie" },
          { que: "Carga física por entreno del mes", es: "Antes del calendario: una barra por entreno hecho, coloreada por su MD, con la raya de la media de ese MD en la temporada; al lado, la media del mes frente a la del anterior en los mismos días. El título dice la conclusión («Más carga por entreno que en octubre: 230 UA frente a 194»)", cuenta: "UA de un día = suma de la «Carga Ponderada» de sus tareas de entreno. Media de un MD = media de sus días con carga en la temporada (3 o más)" },
          { que: "Titular", es: "Corto, con su base: «Noviembre: carga física +19 %, cognitiva −25 % · 6 entrenos · tendencia» («tendencia» con menos de 25 entrenos por lado). Debajo, el resto de la base: entrenos, volumen y contra qué días se compara" },
          { que: "Entrenos", es: "Días con tarea de entreno; hechos = con minutos o carga apuntados, el resto planificados", cuenta: "Los partidos aparte: la fila de competición no es entreno" },
          { que: "Volumen", es: "Minutos de entreno del mes, sin los partidos" },
          { que: "Carga física media / entreno", es: "Puntos de carga por entreno hecho", cuenta: "UA = minutos × intensidad (1-10), de la columna «Carga Ponderada»; suma del mes ÷ entrenos hechos" },
          { que: "Carga cognitiva media / entreno", es: "Lo mismo con la demanda cognitiva", cuenta: "UA = minutos × demanda cognitiva (1-10); suma ÷ entrenos hechos" },
          { que: "Frente al mes anterior", es: "La media contra los mismos días del mes anterior", cuenta: "Del 1 al último día con entreno hecho; con menos de 3 entrenos hechos en un lado no se compara" },
          { que: "Lectura de la carga", es: "Qué MD se ha movido más contra el mes anterior, si hay otro número de partidos, y la carga cognitiva; los días a vigilar son los reales del micro de hoy (su MD-1 y el día después del partido), con la carga media de los MD-1 ya hechos de la temporada", cuenta: "Un MD sólo se nombra con 3 sesiones suyas o más en cada mes; la orden de vigilar, sólo con 3 MD-1 hechos o más" },
          { que: "Partido", es: "Hora, en casa o fuera y, si ya se jugó, el resultado con su sentido («ganado 1-0», el Castilla primero)" },
          { que: "Leyenda", es: "Encima del mes: colores de fase, qué es la barra y qué es el borde discontinuo" },
        ],
      },
      {
        titulo: "El calendario",
        filas: [
          { que: "Fondo del día y su fase escrita", es: "La fase con más minutos ese día, sin contar Global, como fondo y escrita en una etiqueta del mismo color (para quien no distingue el color y en el móvil)", cuenta: "Ofensiva, Defensiva, Transición ofensiva, Transición defensiva o ABP; sólo Global deja el fondo normal y sin etiqueta" },
          { que: "MD", es: "Días que faltan para el próximo partido del calendario, hasta 14: la misma numeración que el creador de micros y /calendar_general. El día de partido es «MD» y no lleva duración. Los días aún sin tareas de la semana del partido llevan su MD en gris (sólo MD-5 a MD-1)" },
          { que: "Enlaces en la casilla", es: "Sin abrir el día: un entreno lleva «Ver la sesión →» (su micro y su MD en Microciclos); un partido, «Informe →» o «Plan de partido →» y, con el rival ya elegido, «Su ABP» y «▶ Sus goles» (en el pop-up de la portada, 18/11/2026). El nombre del rival salta de línea, sin «…». Con «?fecha=AAAA-MM-DD» se abre ese día" },
          { que: "Partido sin filas en la hoja", es:"El partido del calendario de BeSoccer sale aunque la hoja aún no tenga ese día (como en /calendar_general)" },
          { que: "Planificado", es: "Entreno de la hoja sin minutos todavía: borde discontinuo y la etiqueta «planificado»" },
          { que: "Contenidos", es: "Minutos por contenido principal, de más a menos; sin contenido, el tipo de tarea. Los nombres que la hoja escribe de varias formas van juntos («Inicio y construcción de juego» también recoge «Inicio-progresión del juego»), aquí y en el Calendario operativo" },
          { que: "MD+1 · recuperación", es: "El día después de un partido, sin tareas, se rotula así; el segundo, MD+2. La misma regla que el Calendario operativo (mdDelCalendario), así que los dos calendarios ponen el mismo MD el mismo día" },
          { que: "Partido", es: "Rival con escudo y el mismo nombre corto que el Calendario operativo, hora, en casa o fuera y resultado, si BeSoccer lo tiene, en dos líneas (no se corta)" },
          { que: "Libre", es: "Día sin nada entre la primera y la última sesión apuntadas" },
          { que: "Siglas", es: "Bajo el calendario, las siglas de los contenidos que salen ese mes, desarrolladas (CP, CR, ABP, Ind., TAD = transición ataque-defensa, TDA = defensa-ataque)" },
        ],
      },
      {
        titulo: "El día abierto",
        filas: [
          { que: "Accesos del día", es: "Arriba, a un toque y ya elegido: un entreno abre su micro y su MD en Microciclos, sus equipos en Jugadores sesión y su análisis de entrenamiento. Un partido jugado abre Microciclos en su micro (botón «Informe del partido»); uno por jugar, el Plan de partido, el ABP y los goles en vídeo del rival (en el pop-up de la portada, con «Cómo son sus goles ›» al lado)" },
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
          { que: "Votación de la plantilla", es: "Lo primero bajo el titular, en todas las etapas: barras de votos por valor (versión reducida del gráfico de Identidad y cultura), con el más votado y su base (9 de 32); cada barra abre las conductas del valor" },
          { que: "Esta semana con la plantilla", es: "Línea bajo la hoja de ruta con lo que se hace con la plantilla en la etapa elegida; sale de la columna opcional CON LA PLANTILLA de la hoja y, si la hoja no la trae, no aparece" },
          { que: "Votación", es: "Una línea con el valor más votado y su base (9 de 32); el recuento con los antivalores está en Identidad y cultura («Ver la votación»)" },
          { que: "Seguimiento por valor", es: "En las conductas, «Seguimiento de <valor>» abre el Dashboard Seguimiento con la búsqueda puesta en ese valor (?buscar=)" },
          { que: "Línea de etapas", es: "Una sola navegación: cada etapa con sus contenidos y, si la hoja trae FECHA, su estado (Hecha, En curso, Por hacer); en el móvil, dos filas" },
          { que: "La votación, arriba", es: "En el Marco, bajo el titular, las barras de votos de los cinco valores (mismo componente que Identidad y cultura)" },
          { que: "Votación", es: "Barras horizontales con «n de 32» por valor (las mismas de Identidad y Cultura), cada una lleva a sus conductas; el recuento con los antivalores está en Identidad y Cultura" },
          { que: "Marco, Planificación, Semana 1-4", es: "Las etapas de la hoja de ruta, con cuántos contenidos tiene cada una (rail en escritorio)" },
          { que: "Línea de proceso", es: "Las seis etapas en orden bajo el titular, con su fecha si la hoja la trae: la que se ve en oro, las ya hechas teñidas; pulsar una la abre" },
          { que: "Hoy", es: "Si la hoja trae FECHA, la etapa en la que está la plantilla lleva «Hoy» y la pantalla abre en ella (salvo que la dirección traiga #etapa)", cuenta: "La última etapa cuya fecha ya ha llegado; FECHA como «17/11/2026», «17/11» o «2026-11-17»" },
          { que: "Lo que trae cada etapa (Marco)", es: "Lo primero del Marco: una tarjeta por etapa (Planificación, Semana 1-4) con su idea, su fecha si la hoja la trae, «hoy» en la etapa en curso y cuántos contenidos tiene; pulsarla la abre. El titular dice en qué etapa está la plantilla, si la hoja trae fechas" },
          { que: "Láminas", es: "Los contenidos de la etapa en tarjetas numeradas, a dos columnas en escritorio. En el Marco van plegadas bajo «El método», con las seis ideas a la vista en chips sin abrir" },
          { que: "Títulos", es: "Sin rótulos de analista: «Enfoque élite» sale como «Cómo trabaja un profesional», «Mecánica inversa» como «Empezar por lo que no queremos» y «Autogestión» como «El vestuario se organiza solo»" },
          { que: "Contenidos de conductas", es: "Llevan al seguimiento de los jugadores y a las conductas de cada valor en /identidad-cultura" },
          { que: "Titular de la etapa", es: "La idea de esa etapa; encima, su nombre y, si la hoja la trae, su semana real" },
          { que: "Filtro por tipo", es: "Sólo los tipos de contenido que hay en esa etapa" },
          { que: "Buscar valor o conducta", es: "Busca en título, texto y tipo de la etapa" },
          { que: "Ficha de la dinámica", es: "Duración, material y lo que entrega el vestuario, si la hoja lo trae" },
        ],
      },
      {
        titulo: "La votación",
        filas: [
          { que: "La votación (Marco)", es: "Titular con el más votado y un chip por valor con «N de 32», de más a menos; cada chip abre las conductas de ese valor en /identidad-cultura. «Recuento con los antivalores →» lleva al recuento completo, que sólo vive allí. Debajo, la fila de acciones: seguimiento de los jugadores, conductas de cada valor y el documento para la charla", cuenta: "Votos del documento de valores; los antivalores se cuentan aparte" },
          { que: "Chips de los valores (otras etapas)", es: "Al pie, un chip por valor con sus votos («Compromiso · 8 de 32») que abre su diapositiva de conductas" },
          { que: "Ver el recuento y el documento", es: "Abre /identidad-cultura" },
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
    revisada: "2026-11-20",
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
          { que: "Rival que se abre", es: "La primera jornada de la hoja RIVALES después de la última que se ha jugado según BeSoccer. Si no hay calendario, la primera con fecha de hoy en adelante." },
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
    revisada: "2026-11-21",
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
          { que: "Escudo que no llega", es: "Si BeSoccer no sirve la imagen, la tarjeta muestra las iniciales del club sobre su fondo (con borde ámbar) y no entra en el .pptx" },
          { que: "Aviso ámbar", es: "«Faltan N escudos: el .pptx saldrá sin ellos», con la lista plegada tras «Ver cuáles»; aparte, los escudos que traen fondo" },
          { que: "Sus goles · ABP · Plan en todo el grupo", es: "En todo equipo de nuestro grupo (también el próximo rival); el Plan con ?rival=ID de la hoja RIVALES. Los del otro grupo, sólo su ficha" },
          { que: "Buscar y filtrar", es: "Una barra que se queda arriba al bajar por las diapositivas" },
          { que: "Todos · Jornada N · Próximo rival", es: "Filtros junto al buscador: todos, los que juegan la jornada de la quiniela o nuestro próximo rival" },
          { que: "Sus goles · ABP · Plan", es: "En las baldosas con partido: sus goles en vídeo, su ABP (?equipo=) y, en la de nuestro próximo rival, el plan de partido (?rival=ID)" },
          { que: "Actualizar escudos · al día del dd/mm/aaaa", es: "La fecha de la última bajada de BeSoccer, pegada al botón que la pone al día" },
          { que: "N escudos de BeSoccer", es: "Cuántos han llegado y de cuándo es el documento («actualizados el…»)" },
          { que: "Descargar .pptx", es: "Veinte escudos por diapositiva (5 × 4) sobre el azul noche del documento, recortado el aire de los márgenes", cuenta: "Espera a que lleguen todas las imágenes; la que no llega en 15 s sale sin ella" },
          { que: "Actualizar escudos", es: "Vuelve a pedir la lista y dice qué ha hecho: «Comprobado a las hh:mm: N escudos · ninguno ha cambiado» o cuáles son nuevos o han cambiado", cuenta: "Compara equipo a equipo la dirección del escudo con la de la lista anterior" },
          { que: "Buscar equipo", es: "Filtra la parrilla por nombre de equipo" },
          { que: "El nombre del equipo", es: "Abre su ficha en /rivals (?equipo=)" },
          { que: "Píldora azul «J12 · dom 22 · vs X»", es: "El equipo juega la jornada de la quiniela de esta semana: día y rival; lleva a /quiniela. Debajo, «▶ Sus goles en vídeo» los abre en el pop-up de la portada (18/11/2026)", cuenta: "La jornada es la primera del calendario de la quiniela cuyo último partido no se ha jugado (sin los partidos del Castilla)" },
          { que: "Mientras carga · si falla", es: "Un esqueleto de una diapositiva entera (20 casillas); si la lista no llega, un aviso con «Reintentar»" },
          { que: "Cada tarjeta", es: "Copia ese escudo en PNG transparente (dice «Copiado» dos segundos); si el navegador no deja copiar imágenes, lo descarga" },
          { que: "Borde oro", es: "El nuestro" },
          { que: "Borde ámbar", es: "Trae fondo, no es transparente", cuenta: "Las cuatro esquinas del PNG son opacas" },
        ],
      },
    ],
    ojo: [
      "Si el documento del informe no está bajado al día, puede faltar algún equipo: la caja ámbar dice cuáles.",
      "Los nombres van como en la quiniela (lib/equipos/nombres.ts), no como los escribe BeSoccer.",
    ],
    revisada: "2026-11-20",
  },

  /* ==================== ANÁLISIS DE FALTAS (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/faltas",
    titulo: "Análisis de faltas",
    resumen:
      "Dónde se comete cada falta del partido, a favor y en contra, y cuánta gente defendía entre ella y la portería.",
    origen:
      "Etiquetado propio, viendo el partido falta a falta (scripts/abp-clips-preparar.mjs y scripts/faltas-datos.mjs escriben lib/faltas/datos.ts). El jugador, del timeline de Hudl por jugador. Al lado, Opta. Respaldo de Opta (17/11/2026): el partido que aún no está etiquetado en Hudl sale de las faltas del evento a evento de Opta (opta:directo, por /api/opta/respaldo; el que la recibe y el que la hace), con el sello «Desde Opta · aún sin etiquetar en Hudl»; en cuanto se etiqueta, manda Hudl. Zona y carril, del punto de la falta hacia la portería que ataca quien la saca; distancia: frontal ≤ 25 m y centrada, media ≤ 40 m, lejana; los defensores entre la falta y la portería no salen de Opta. «▶ Vídeo»: el corte de Opta (opta:acciones-video) o «Vídeo en Opta» (ProVision en ese segundo).",
    bloques: [
      {
        titulo: "Mandos",
        filas: [
          { que: "Próximo rival", es: "El del próximo partido según la regla de la portada (fecha y hora de Madrid de BeSoccer, 2,5 h de gracia)." },
          { que: "Defensores por delante", es: "Con su franja «Lo normal» (de los partidos anteriores) y el número de faltas en el pie" },
          { que: "Lo que pide trabajo esta semana", es: "Se elige la cifra que se sale de la franja mínimo–máximo de los anteriores hacia su lado malo, con su tarea, qué contar y el criterio de volver dentro de lo normal. Si ninguna se sale: «Sin alarma esta semana» con la más justa y sin tarea. «Tendencia» en el titular. «Ver las N faltas en vídeo» abre la lista ya filtrada" },
          { que: "A un toque", es: "Robos, pérdidas, post, el que más comete y su seguimiento, ABP y Plan contra el próximo rival, y ABP ofensivo" },
          { que: "A balón parado", es: "Frontales y laterales no se solapan: una frontal no cuenta además como lateral, así que la suma da las faltas a favor en campo rival" },
          { que: "Datos hasta la J·", es: "Una línea: la última jornada con faltas, su rival y fecha, y cuántos partidos hay. Desde el 17/11/2026 cuenta también los partidos del respaldo de Opta («Etiquetado propio y Opta»), con el mismo número que el selector. Lo que aún no tiene dato no se nombra" },
          { que: "Partido", es: "Un desplegable con las jornadas (las etiquetadas y las de Opta, un nombre por equipo), la última arriba (abre en ella), y «de N partidos». Un partido de Opta con la misma jornada y el mismo club que uno etiquetado no entra dos veces" },
          { que: "N faltas en la J·", es: "El chip junto a los mandos cuenta las faltas del partido elegido con el lado y lo pinchado, no las de la temporada" },
          { que: "Si el partido sale de Opta (17/11/2026)", es: "El título del campo dice «Opta · N faltas en la J·», la comparativa lleva «(Opta)» y «tendencia» en cada palabra (fuentes distintas), y la conclusión «Ninguna falta cortó una transición» no sale: Opta no da los defensores por delante" },
          { que: "Todas / A favor / En contra", es: "A favor = nos la hacen a nosotros; en contra = la cometemos" },
          { que: "Filtrando", es: "Todo lo que se pincha (casilla del campo, distancia, número de defensores, celda de la tabla) filtra la pantalla entera" },
          { que: "Vistas", es: "Resumen, En el campo, Detalle, Por jugador y Falta a falta" },
          { que: "A un toque", es: "Bajo la línea de datos: robos y pérdidas de este mismo partido, su post en Análisis de datos (abierto en ese partido), el que más faltas comete en el partido («7 de 17») con su ficha y su seguimiento, ABP ofensivo y el balón parado del próximo rival (17/11/2026)" },
          { que: "Este partido frente a los anteriores (Visual, 17/11/2026)", es: "En Visual, una barra por cifra (este partido) con la raya blanca de la media de los anteriores y una franja gris del mínimo al máximo; al lado la cifra, la media y la palabra en todas las filas («mejor», «peor», «normal, algo mejor/peor», «igual»). El sentido (▲ más es mejor / ▼ menos es mejor) va junto al nombre; las faltas a favor llevan «estilo, sin veredicto» y dicen si caen por encima, dentro o por debajo de lo habitual. «Mejor» y «peor» dicen debajo el rango con que se miden; con menos de 15 acciones, o con el partido de Opta, «tendencia». Al pie, el método, de qué fuente son los anteriores y las cifras de 2 casos o menos (fuera del gráfico). La tabla de siempre, en Detalle", cuenta: "La base de cada fila sale de su pie («7 de 27»): por debajo de 15, tendencia" },
          { que: "Tocar una falta (17/11/2026)", es: "Bajo el campo se dice: su vídeo, Hudl y, si es nuestra, la ficha y el seguimiento de quien la comete" },
          { que: "Visual · Detalle (16/11/2026)", es: "La pantalla se abre en «Visual»: el partido y, justo debajo, el campo con cada falta y su conclusión en el título (de las que cometemos, cuántas en nuestro tercio; de las que nos hacen, cuántas en su tercio; con menos de 15 en esa zona, «tendencia»); después, el partido frente a los anteriores. Lo de Opta (la temporada entera, no el partido) va sólo en «Detalle», que deja las cinco vistas de siempre; abrir la tabla desde el campo pasa solo a Detalle. Se recuerda en este aparato", cuenta: "Mismos filtros que arriba; tercios del campo de verdad (sitioEnCampo), el Castilla atacando hacia la derecha" },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "Lo que pide trabajo / Qué entrenamos", es: "Arriba, como en Robos y Pérdidas: el objetivo en faltas en contra, lo del partido elegido (jornada y rival), la tarea y el criterio de éxito, en tres líneas. Con menos de 10 partidos detrás, el rótulo dice «tendencia, media de N partidos»", cuenta: "Media de los partidos anteriores con su mínimo y máximo; con menos de 10, tendencia. La zona sólo se nombra si reúne la mitad de las faltas o más y no empata" },
          { que: "Comparativa", es: "El partido frente a la media de los anteriores: faltas a favor y en contra, frontales, en contra en nuestro campo y a favor en campo rival", cuenta: "Recuentos del partido sin decimales; medias con uno. Media por partido de los anteriores por fecha, con su mínimo y máximo; verde mejor, naranja peor, gris no se juzga. Una fila de «tendencia, pocos casos» (menos de 5) no lleva veredicto. Las faltas a favor dicen, en neutro, si caen por debajo, dentro o por encima de lo habitual. Los defensores por delante son una media por falta (la fila lo dice: «por falta»)" },
          { que: "Con 2 casos o menos", es: "Una frase con las filas de muy pocos casos y su media: sólo tendencia" },
          { que: "A balón parado", es: "Las faltas a favor en campo rival del partido (laterales y frontales), con el enlace a ABP Ofensivo" },
          { que: "Opta · el Castilla en su grupo", es: "Faltas cometidas y recibidas por partido según Opta, temporada hasta la jornada de nuestro último partido en Opta (no sólo el elegido), con su puesto en el grupo; y el partido según Opta al lado del etiquetado, con una línea de por qué no cuadran si no cuadran" },
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
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
      "Los partidos mirados a ojo desde los clips, sin timeline de Hudl, no tienen jugador y no entran en «Por jugador».",
      "El etiquetado no apunta en qué acaba cada falta: el peligro se lee por el sitio.",
    ],
    revisada: "2026-11-21",
  },

  /* ==================== ROBOS Y TRANSICIONES (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/transiciones",
    titulo: "Robos y transiciones",
    resumen:
      "Cada balón que robamos de forma activa: dónde, qué es lo primero que hacemos con él y en qué acaba la jugada que nace de ahí.",
    origen:
      "El timeline de Hudl de cada partido (scripts/partido/robos.cjs, recogido en lib/transiciones/datos.ts por scripts/transiciones-datos.mjs). J2 y J3 se miraron imagen a imagen. Al lado, Opta. Respaldo de Opta (17/11/2026): el partido que aún no está etiquetado en Hudl (no hay ninguno con esa fecha ±1 día y filas de este modo) sale del evento a evento de Opta (opta:directo, por /api/opta/respaldo) con el sello «Desde Opta · aún sin etiquetar en Hudl»; en cuanto se etiqueta, manda Hudl. Robo = recuperación, intercepción o entrada ganada; pérdida = pase fallado, regate perdido o robado en conducción, sin los saques de balón parado; dos a menos de 4 s son una; transición = 15 s; tercio y carril desde el Castilla; el minuto, del reloj de Opta. «▶ Vídeo»: el corte de Opta (opta:acciones-video) o «Vídeo en Opta» (ProVision en ese segundo).",
    bloques: [
      {
        titulo: "Mandos",
        filas: [
          { que: "Próximo rival", es: "El del próximo partido según la regla de la portada (fecha y hora de Madrid de BeSoccer, 2,5 h de gracia)." },
          { que: "Sin alarma esta semana", es: "Cuando nada sale de lo normal, una sola línea con la cifra más justa, sin bloque ni tarea" },
          { que: "Frente a los anteriores", es: "Cada cifra en barra con la raya de la media; la palabra (mejor, peor, normal) en su columna y, debajo, la regla: «Lo normal: de X a Y en los N anteriores» o «Fuera de lo normal». El título dice cuántos anteriores son de Opta, que cuenta distinto; con pocos casos, «tendencia»" },
          { que: "¿Por qué no coincide con Opta?", es: "Nota plegada bajo el mapa: en una línea los robos de aquí y las recuperaciones e intercepciones del agregado de Opta; dentro, qué cuenta cada uno" },
          { que: "A un toque", es: "Además, el ABP y el Plan de partido del próximo rival, en el mismo orden que en Pérdidas y Faltas" },
          { que: "Datos hasta la J·", es: "Una línea: la última jornada con robos, su rival y fecha, y cuántos partidos hay (el mismo número que el selector). Con partidos del respaldo de Opta dice «Vídeo etiquetado y Opta» (17/11/2026). Lo que aún no tiene dato no se nombra" },
          { que: "Partido", es: "Un desplegable con las jornadas (la última arriba, abre en ella) y «Temporada entera». Un partido de Opta con la misma jornada y el mismo club que uno etiquetado no entra (la J4 salía dos veces: «Sant Andreu» de Opta y «UE Sant Andreu» de Hudl, con dos días de diferencia en la fecha)" },
          { que: "De dónde sale (17/11/2026)", es: "La cabecera, el título del campo («Opta · 40 robos» o «Vídeo etiquetado · …») y la comparativa dicen la fuente del partido elegido. Bajo el título del campo, las dos cifras: los robos de aquí (los mismos que da Análisis de datos desde el 17/11/2026) y las recuperaciones agregadas de Opta, y qué cuenta cada una. Un partido de Opta frente a medias del vídeo se lee como tendencia" },
          { que: "A un toque", es: "Bajo la línea de datos: pérdidas y faltas de este mismo partido, su post en Análisis de datos (abierto en ese partido), la ficha del que más roba en lo que se ve («7 de 40»), su seguimiento y sus percentiles, y (17/11/2026) cómo le marcan al próximo rival, en vídeo (en el pop-up de la portada, 18/11/2026)" },
          { que: "Visual · Detalle (16/11/2026)", es: "La pantalla se abre en «Visual»: primero el campo con cada robo en su sitio y su conclusión en el título (en qué tercio se concentran, con su base y, con un partido, el % de esa zona en los otros partidos etiquetados); después lo que pide trabajo y las conclusiones. «Detalle» es la pantalla de siempre con sus cinco pestañas (Resumen, En el campo, Detalle, Por jugador y la lista); «Ver uno a uno» y la tabla desde el campo pasan solos a Detalle. Se recuerda en este aparato", cuenta: "Mismos filtros que arriba; el % de cada tercio es sobre todos los que se ven" },
          { que: "Ver en % / en número", es: "Cambia las cifras de los gráficos entre porcentaje y número" },
          { que: "Quitar los dudosos", es: "Saca los robos con confianza baja" },
          { que: "Revisado entero", es: "Cuánto del partido está revisado; si falta, los totales son de esos minutos" },
          { que: "Filtrando", es: "Cualquier sector, barra, leyenda, cifra o celda que se pincha filtra la pantalla entera" },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "Comparativa", es: "El último partido frente a la media de los anteriores: robos, salen hacia delante, acaban en remate o área, la perdemos al momento y robos en campo rival (la duración, que es estilo, va en las conclusiones)", cuenta: "Media por partido con los mismos filtros, con mínimo y máximo; «muestra pequeña» por debajo de 15" },
          { que: "Lo que pide trabajo esta semana / Sin alarma", es: "Sólo hay tarea si una cifra queda peor que nuestra media y FUERA del rango de los partidos anteriores (17/11/2026). Entonces sale en ámbar con el objetivo, la jornada y el rival, la base de la media en el titular («media de 8 partidos etiquetados, tendencia») y debajo dónde estamos, la tarea y el criterio. Si todo cae dentro de lo normal, el bloque va en gris, «Sin alarma esta semana», con la cifra más justa y su rango, sin tarea ni «Llevarla al microciclo»", cuenta: "El rango es el de los partidos anteriores etiquetados; con menos de 10, tendencia" },
          { que: "Frente a los anteriores (Visual, 17/11/2026)", es: "Antes de ese bloque, una barra por cifra (este partido) con la raya de la media y la franja gris del rango, y «mejor», «peor» o «normal» en cada fila" },
          { que: "Salen hacia delante", es: "Lo primero tras el robo es un pase o conducción hacia delante", cuenta: "Sobre los robos que se juegan con pase o conducción (la conclusión lo dice: «de los N que llegamos a jugar»)" },
          { que: "Conclusiones", es: "Cada porcentaje con su recuento («13,5 % · 5 de 37»)" },
          { que: "Dura la transición", es: "Segundos de media de la jugada tras el robo; con un partido, al lado la media de los otros partidos etiquetados (es estilo: ni mejor ni peor)", cuenta: "Cada partido pesa igual; hacen falta 2 partidos más" },
          { que: "En el campo", es: "Cada casilla dice «3↑ · 5»: 3 que salen hacia delante (↑) y 5 que no; la leyenda lo explica y dice cuántos de los del partido están en el campo y cuántos no tienen carril anotado. Cifras de zona a unos 11 px en el móvil" },
          { que: "Opta · el Castilla en su grupo", es: "Recuperaciones (total y por tercio), intercepciones y PPDA por partido, con su puesto en el grupo: temporada hasta la jornada de nuestro último partido en Opta, no sólo el partido elegido" },
          { que: "Para nuestra salida", es: "Las recuperaciones en el último tercio y el PPDA del próximo rival, con su percentil, y lo que dicen de nuestra salida", cuenta: "PPDA en P60 o más = aprieta pronto; P40 o menos = espera en su campo. Recuperaciones arriba en P60 o más = recupera arriba" },
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
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
      "Robo es la recuperación activa: entrada, interceptación o balón ganado por presión, con el balón en juego. Rechaces sin disputa, paradas o balón parado no cuentan.",
      "La transición son los 15 s tras el robo: lo que llega después cuenta como posesión.",
      "La «recuperación» de Opta no es la misma cuenta que el robo de aquí: se enseñan aparte.",
    ],
    revisada: "2026-11-21",
  },

  /* ==================== PÉRDIDAS Y TRANSICIONES DEFENSIVAS (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/perdidas",
    titulo: "Pérdidas y transiciones defensivas",
    resumen:
      "El espejo de los robos: cada balón que perdemos en juego, qué es lo primero que hace el rival con él y en qué acaba su posesión.",
    origen:
      "El timeline de Hudl de cada partido (scripts/partido/perdidas.cjs, recogido en lib/transiciones/datos.ts). Salen solas con «Actualizar análisis del partido» de Ajustes. J2 y J3 no tienen pérdidas. Al lado, Opta. Respaldo de Opta (17/11/2026): el partido que aún no está etiquetado en Hudl (no hay ninguno con esa fecha ±1 día y filas de este modo) sale del evento a evento de Opta (opta:directo, por /api/opta/respaldo) con el sello «Desde Opta · aún sin etiquetar en Hudl»; en cuanto se etiqueta, manda Hudl. Robo = recuperación, intercepción o entrada ganada; pérdida = pase fallado, regate perdido o robado en conducción, sin los saques de balón parado; dos a menos de 4 s son una; transición = 15 s; tercio y carril desde el Castilla; el minuto, del reloj de Opta. «▶ Vídeo»: el corte de Opta (opta:acciones-video) o «Vídeo en Opta» (ProVision en ese segundo).",
    bloques: [
      {
        titulo: "Mandos",
        filas: [
          { que: "Próximo rival", es: "El del próximo partido según la regla de la portada (fecha y hora de Madrid de BeSoccer, 2,5 h de gracia)." },
          { que: "Sin alarma esta semana", es: "Cuando nada sale de lo normal, una sola línea con la cifra más justa, sin bloque ni tarea" },
          { que: "Frente a los anteriores", es: "Cada cifra en barra con la raya de la media; la palabra (mejor, peor, normal) en su columna y, debajo, la regla con la franja de los anteriores; con pocos casos, «tendencia»" },
          { que: "¿Por qué no coincide con Opta?", es: "Nota plegada bajo el mapa: las pérdidas de aquí y el total «PossLost» de Opta; dentro, qué cuenta cada uno" },
          { que: "Salida del rival tras pérdida", es: "La lectura dice la tarea (contrapresión en los 5 segundos siguientes, contando si el rival sale hacia delante) y el criterio con la franja de los anteriores; si fue mejor que la media, sin tarea nueva" },
          { que: "A un toque", es: "Además, el ABP y el Plan de partido del próximo rival" },
          { que: "Datos hasta la J·", es: "Una línea: la última jornada con pérdidas, su rival y fecha, y cuántos partidos hay (el mismo número que el selector). Con partidos del respaldo de Opta dice «Vídeo etiquetado y Opta» (17/11/2026). Lo que aún no tiene dato no se nombra" },
          { que: "Partido", es: "Un desplegable con las jornadas (la última arriba, abre en ella) y «Temporada entera». Un partido de Opta con la misma jornada y el mismo club que uno etiquetado no entra (la J4 salía dos veces)" },
          { que: "De dónde sale (17/11/2026)", es: "La cabecera, el título del campo («Opta · 65 pérdidas» o «Vídeo etiquetado · …») y la comparativa dicen la fuente del partido elegido. Si el título dice «sobre todo» es porque la zona saca 5 puntos o más a la segunda; si no, «Reparto parejo» con las tres" },
          { que: "A un toque", es: "Bajo la línea de datos: robos y faltas de este mismo partido, su post en Análisis de datos (abierto en ese partido), la ficha del que más pierde en lo que se ve («12 de 65»), su seguimiento y sus percentiles, y (17/11/2026) cómo marca el próximo rival, en vídeo (en el pop-up de la portada, 18/11/2026)" },
          { que: "Visual · Detalle (16/11/2026)", es: "La pantalla se abre en «Visual»: primero el campo con cada pérdida en su sitio y su conclusión en el título (en qué tercio se concentran, con su base y, con un partido, el % de esa zona en los otros partidos etiquetados); después lo que pide trabajo y las conclusiones. «Detalle» es la pantalla de siempre con sus cinco pestañas (Resumen, En el campo, Detalle, Por jugador y la lista); «Ver uno a uno» y la tabla desde el campo pasan solos a Detalle. Se recuerda en este aparato", cuenta: "Mismos filtros que arriba; el % de cada tercio es sobre todos los que se ven" },
          { que: "Ver en % / en número", es: "Cambia las cifras de los gráficos entre porcentaje y número" },
          { que: "Quitar los dudosos", es: "Saca las pérdidas con confianza media (las que Wyscout no clasifica como pase, conducción o duelo)" },
          { que: "Revisado entero", es: "Cuánto del partido está revisado; si falta, los totales son de esos minutos" },
          { que: "Filtrando", es: "Cualquier sector, barra, leyenda, cifra o celda que se pincha filtra la pantalla entera" },
        ],
      },
      {
        titulo: "Resumen",
        filas: [
          { que: "Comparativa", es: "El último partido frente a la media de los anteriores: pérdidas, el rival sale hacia delante, acaban en remate o en nuestra área, la recuperamos al momento, pérdidas en campo propio y duración de su posesión", cuenta: "Media por partido con los mismos filtros, con mínimo y máximo; aquí, en casi todas, menos es mejor" },
          { que: "Lo que pide trabajo esta semana / Sin alarma", es: "Sólo hay tarea si una cifra queda peor que nuestra media y FUERA del rango de los partidos anteriores (17/11/2026). Entonces sale en ámbar con el objetivo, la jornada y el rival, la base de la media en el titular («media de 8 partidos etiquetados, tendencia») y debajo dónde estamos, la tarea y el criterio. Si todo cae dentro de lo normal, el bloque va en gris, «Sin alarma esta semana», con la cifra más justa y su rango, sin tarea ni «Llevarla al microciclo»", cuenta: "El rango es el de los partidos anteriores etiquetados; con menos de 10, tendencia" },
          { que: "Frente a los anteriores (Visual, 17/11/2026)", es: "Antes de ese bloque, una barra por cifra (este partido) con la raya de la media y la franja gris del rango, y «mejor», «peor» o «normal» en cada fila" },
          { que: "Aquí frente a Opta (17/11/2026)", es: "Bajo el título del campo, como pie y con las dos cifras: las pérdidas de aquí (sólo las que cambian la posesión en juego; si el partido sale de Opta, ese mismo filtro sobre su dato) (las mismas que da Análisis de datos desde el 17/11/2026) y el total agregado de Opta (todo pase fallado, regate perdido o balón robado), con las de nuestro tercio. Las conclusiones ya no repiten la tarea de contrapresión: va en «Qué entrenamos»", cuenta: "Las de Opta salen de la fila del partido en Opta (PossLost y PsLostD3)" },
          { que: "Conclusiones", es: "Cuántas, dónde (campo rival = atacando, en su mitad), cuántas en nuestro campo y, si donde más perdemos es campo rival, la tarea de contrapresión con la referencia del partido (cuántas jugó el rival)" },
          { que: "El rival sale hacia delante", es: "Lo primero que hace con el balón es un pase o conducción hacia delante: lo malo", cuenta: "Sobre las pérdidas que el rival llega a jugar" },
          { que: "Dura su transición", es: "Segundos de media de la posesión del rival tras la pérdida; con un partido, al lado la media de los otros partidos etiquetados (cuanto más corta, antes la cortamos)" },
          { que: "Cifras con su base", es: "Cada porcentaje lleva su recuento («60 % · 30 de 50»). «El rival juega N» son las que juega con pase o conducción; «la recuperamos al momento» (el mismo nombre en la comparativa y en la conclusión) son las que volvemos a ganar en esa misma transición: no se pisan" },
          { que: "Opta · el Castilla en su grupo", es: "Pérdidas (total y por tercio) y balones robados en conducción por partido, con su puesto en el grupo: temporada hasta la jornada de nuestro último partido en Opta, no sólo el elegido. Las del último tercio son estilo (en gris) y llevan una frase de qué significan", cuenta: "El «por qué no coinciden» con las pérdidas de aquí se dice una vez, bajo la tabla del resumen" },
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
      "Cada evento de Opta (saque, remate, penalti, acción, gol) lleva su vídeo (18/11/2026): si el ordenador del club ya bajó su corte a B2 (opta:goles-video, los goles; opta:acciones-video, las acciones del Castilla; 10 s antes y 6 s después), se ve aquí mismo, en un pop-up y sin sesión de Opta; si no, abre el Event Log de ProVision filtrado a esa parte y ese segundo, con el vídeo abierto (8 s antes y después), y hace falta la sesión de Opta (lib/opta-cortes.ts, lib/opta-video.ts). Sin reloj no hay enlace: el segundo no se inventa. Se comprueba con node scripts/opta-clips-comprueba.mjs (sólo lectura).",
      "La salida y el desenlace son del rival: verde es lo bueno para nosotros, naranja lo malo.",
      "Pérdida es un balón nuestro que pasa al rival en juego: pase que no llega, conducción cortada, control o duelo perdido. Remates, despejes y faltas pitadas no cuentan.",
      "La «pérdida» de Opta no es la misma cuenta que la de aquí: se enseñan aparte.",
    ],
    revisada: "2026-11-21",
  },

  /* ==================== CREAR O EDITAR EL MICROCICLO (12/11/2026) ==================== */
  {
    ruta: "/laboratorio/microciclo",
    titulo: "Crear o editar el microciclo",
    resumen: "Preparar la semana que viene, o retocar una ya escrita, y escribirla en la hoja de registro de tareas.",
    origen: "La hoja de registro de tareas (la misma que leen Microciclos, el microciclo de ABP y Data análisis) y el calendario del Castilla que baja de BeSoccer el ordenador del club. Los equipos del día salen de Jugadores sesión y del análisis de entrenamiento.",
    revisada: "2026-11-20",
    bloques: [
      {
        titulo: "1 · La semana",
        filas: [
          { que: "Días libres", es: "Un MD que se entrena en menos de la mitad de las semanas de liga se propone libre; un día libre no escribe fila en la hoja. Si un MD tiene menos de 3 semanas para comparar, no entra en la cuenta" },
          { que: "Lo que se copia", es: "Tareas, días y tiempo del micro elegido frente a la media de los micros con dato (se dice cuántos)" },
          { que: "Del que se parte", es: "Por defecto, el último micro cerrado que entrena los mismos MD que la semana nueva («el último con estos días»); el aviso sólo si no hay ninguno, con «Ver el micro N»" },
          { que: "Días", es: "Una columna en el móvil; de 2 a 4 por fila en pantallas mayores" },
          { que: "Partir de lo que ya está", es: "Propone el micro más reciente con días ya en la hoja hasta hoy incluido (en MD-1, el de la semana)" },
          { que: "Días de la semana", es: "Del día siguiente al partido anterior hasta el del próximo, cada uno con su MD. Junto a los días, de dónde sale la propuesta en una línea. Las casillas miden 150 px como mínimo y pasan a dos filas si no caben; en el móvil, los botones Entreno/Libre miden 44 px de alto. Bajo cada MD, en cuántas semanas de liga se entrenó («· 18 de 21») y una barra con su carga media de la temporada («≈ 320 UA»; atenuada si el día va libre). Encima, la carga física que tendría la semana con los días marcados", cuenta: "Propuesta: libre el MD+1 y, con 5 semanas de liga o más, también los MD que se entrenan en menos de la mitad de ellas; se cuenta sólo con las semanas de la misma duración (entre partido y partido) si hay 3 o más, y la frase lo dice («de las 4 semanas de liga de 9 días»); si no, con todas. Carga de un MD = media de la «Carga Ponderada» (minutos × intensidad) de sus días con carga apuntada, con 3 días o más; la de la semana, la suma de los MD de entreno marcados; el resto, entreno, y la frase lo dice con su base. Con menos base, libre sólo el MD+1. Un día libre no escribe ninguna fila. Semanas de liga = micros con partido y tareas de entreno, sin pretemporada ni amistosos; mismo recuento que Microciclos (lib/microciclo/cuenta.ts)" },
          { que: "Carga de la semana propuesta", es: "Encima de los interruptores Entreno/Libre: una barra por día con la carga media de su MD en la temporada (el libre, vacío; el partido, en oro). El titular dice el día de más carga; cada tarjeta lleva su base («≈ 244 UA · media de 11 MD-4»)", cuenta: "UA = minutos × intensidad; la media es la de los días de ese MD ya hechos esta temporada" },
          { que: "Accesos del rival", es: "En azul, bajo el titular: Plan de partido, «Su ABP · rival», «Sus goles en vídeo · rival» (en el pop-up de la portada, 18/11/2026; al lado, «Cómo son sus goles ›» a Análisis de goles) y «Su plantilla · rival», con el rival del micro ya elegido. Debajo, «Informe del micro N · rival» (el post de la semana anterior, en Microciclos) y el Calendario operativo", cuenta: "El Plan abre por el ID de la hoja RIVALES, buscado por la fecha del partido; los demás, por el nombre del equipo" },
          { que: "Partir de lo que ya está en la hoja", es: "Por defecto, el último microciclo CERRADO con tareas (el que está en curso tiene la valoración a medias y queda como opción); también otro cualquiera o la semana en blanco. El rival, con el mismo nombre corto que Microciclos y los calendarios («Nàstic»)" },
          { que: "Lo que se copia", es: "Tres cifras grandes —tareas, días de entreno y tiempo (o, si sus tareas no llevan minutos, tareas por día)— del micro de origen, con la media de la temporada debajo; «Ver el micro N» abre su ficha en Microciclos en otra pestaña para revisar sus tareas antes de copiarlas. En «Detalle», plegado, la tabla y la base de cada cifra («13 tareas, 9 con tiempo»); si ninguna tarea lleva minutos, dice dónde se ponen y a cuánto va la temporada. La lista «Partir de…» enseña los 5 últimos; «Ver todos los microciclos…» despliega el resto", cuenta: "Tiempo planificado = suma de los minutos de sus tareas, sin el partido. Media = media por semana de los micros con tiempo apuntado (si hay 3 o más; si no, de los micros con tareas)" },
          { que: "Días que entran en blanco", es: "Si el micro de origen no tiene algún MD de la semana nueva, el aviso lo dice y ofrece, en el mismo sitio, «Partir del micro N» (la última semana de liga que sí los tiene) y «Rellenar con la semana tipo»", cuenta: "La semana tipo de un MD es lo más repetido en sus sesiones de la hoja (hacen falta 2 o más); se pone al crear el microciclo y se cambia como cualquier tarea" },
          { que: "Así empieza el paso 2", es: "Vista previa, día a día, de con qué tareas nacerá la semana: el MD, el día, cuántas tareas y minutos, y sus tareas (hasta 4; con más, las 3 primeras y «+N»). Los pasos 2 y 3 se ven en gris con lo que llevan", cuenta: "Sale de las tareas del micro de origen con ese MD o, con «Rellenar con la semana tipo», de la sesión tipo; si no hay ninguna, «Se rellena en el paso 2»" },
          { que: "Copiar también el tiempo y la intensidad", es: "Si no se marca, se copian tareas y contenidos pero no los minutos ni la intensidad" },
          { que: "Volver a la propuesta / Todos los días de entreno", es: "Botones con borde junto al único botón principal, «Crear el microciclo N»: vuelven a la propuesta de días o ponen todos de entreno. «Calendario operativo →» también va con borde" },
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
          { que: "Jugadores (paso 3)", es: "Antes de «Escribir en la hoja»: Jugadores sesión del primer día de entreno que viene y el Dashboard Seguimiento" },
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
          { que: "Plan del próximo partido", es: "El próximo según la regla de la portada (fecha y hora de Madrid de BeSoccer, 2,5 h de gracia), ya no el primero sin marcador." },
          { que: "¿Cómo va la temporada?", es: "Con menos de 20 partidos, la comparación con el equipo medio lleva «· N partidos, tendencia»" },
          { que: "Botones de cada tarjeta", es: "Siempre «Post del partido» (Análisis de datos con el partido elegido) y «▶ Goles»; robos, pérdidas y faltas etiquetados, plegados en «Análisis (n)»" },
          { que: "Curva de puntos", es: "Misma escala que Histórico de la Competición: hasta el máximo real, en pasos de 3 o 6" },
          { que: "El titular (17/11/2026)", es: "Los puntos sumados de los posibles y los de los últimos cinco («19 de 36 puntos, 10 de 15 en los últimos 5»); debajo, en pequeño, el reparto (ganamos, empatamos, perdimos) de los partidos de liga con resultado. La pretemporada no cuenta; los resultados son del calendario de BeSoccer. El bloque «Tendencia reciente» con sus cinco marcadores se quitó: repetía la curva", cuenta: "Victoria 3, empate 1; los últimos cinco salen con tres partidos o más" },
          { que: "Visual · Detalle (16/11/2026)", es: "Se abre en «Visual»: el título dice nuestros puntos frente a un equipo medio de la liga («19 puntos, 2,9 por encima de un equipo medio de la liga (16,1, media de los 20 equipos, J1–J12)»); debajo, la curva de puntos acumulados (cada punto del color del resultado; tocarlo lleva a la tarjeta de ese partido) con la raya de lo que suma de media un equipo de la liga y, pegada al gráfico, la leyenda de las dos líneas con su base (17/11/2026). En el móvil el subtítulo se esconde para que la curva se vea sin bajar. «Detalle» añade la tira partido a partido y las tarjetas de goles. Se recuerda en este aparato", cuenta: "Raya de la liga = puntos repartidos en la liga (3 con ganador, 2 si empatan) ÷ (partidos × 2), por cada partido jugado" },
          { que: "Plan del próximo partido (17/11/2026)", es: "Bajo el subtítulo, el botón al Plan de partido de la próxima jornada con el rival ya puesto" },
          { que: "Partido a partido (Detalle)", es: "La tira de resultados del más antiguo al más reciente: encima el escudo del rival; debajo la jornada, casa (C) o fuera (F) y la fecha; cada uno lleva a su tarjeta. En el móvil, una sola fila que se desliza", cuenta: "El marcador, el nuestro primero (como en Histórico); verde victoria, ámbar empate, rojo derrota; borde dorado, los cinco últimos" },
          { que: "Goles a favor / en contra (Detalle)", es: "La suma grande y, debajo, una sola unidad: por partido («1,3 por partido (16 en 12) · liga 1,3 por partido, media de los 20 equipos»), con el juicio frente a la liga", cuenta: "Diferencia = nuestros goles por partido − media de la liga por partido; ▲ mejor, ▼ peor, «Como la liga» si es menor de 0,05" },
          { que: "Diferencia", es: "Goles a favor menos goles en contra" },
        ],
      },
      {
        titulo: "La lista",
        filas: [
          { que: "Buscar", es: "Por rival, partido, microciclo o fecha" },
          { que: "Microciclo", es: "Todos los partidos («Todos (12 de liga + 1 de pretemporada)»), uno de liga o uno de pretemporada: la pretemporada va en su propio grupo del selector y no cuenta en las cifras. El recuento va una sola vez, al lado de los filtros («13 partidos (12 de liga y 1 sin contar en las cifras) · 12 con vídeo»)" },
          { que: "Victorias · Empates · Derrotas", es: "Filtra por resultado" },
          { que: "Solo con vídeo", es: "Encendido al entrar: sólo los partidos con vídeo en la hoja o en Coding. Si todos tienen vídeo no sale, porque no filtraría nada" },
          { que: "Ver vídeo análisis", es: "Abre el vídeo de la hoja en un pop-up, con anterior y siguiente" },
          { que: "Coding · Hudl · Grabación táctica · Resumen", es: "Debajo de cada tarjeta, con el mismo peso y lo que exista: Coding en los partidos de liga sin enlace en la hoja; Hudl abre el partido o, si aún no tiene enlace propio, la biblioteca del club (lo dice el título del botón); la grabación táctica sólo en el ordenador principal; el resumen, el de la RFEF en YouTube. Van abajo del todo, así las tarjetas de una fila quedan alineadas aunque falte alguno" },
          { que: "Estadísticas · Goles · Robos · Pérdidas · Faltas", es: "Debajo de los vídeos de cada partido jugado, como botones (44 px en el móvil): «Estadísticas» abre el post de ese partido en Análisis de datos; «▶ Goles», los goles de ese partido, de los dos equipos, en el pop-up de la portada (18/11/2026: el partido de Opta del rival más cercano a esa fecha, a 4 días como mucho); robos, pérdidas y faltas abren su laboratorio en ese partido y sólo salen si ya está etiquetado o, desde el 17/11/2026 (ronda 20), si tiene el respaldo de Opta (el partido aún sin etiquetar que esas pantallas ya enseñan desde Opta)" },
        ],
      },
    ],
    ojo: [
      "Las cifras de arriba siguen a los filtros: con un microciclo o «Victorias» elegidos, cuentan sólo esos partidos.",
    ],
    revisada: "2026-11-21",
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
    origen: "El canal de YouTube del club, con una lista por rival, y los clips de Hudl de cada jugador (hudl:clips-rival). La plantilla, el puesto y las etiquetas (campo IMPACTO) salen de la hoja de plantillas rivales; partidos y minutos, de BeSoccer; las cifras contra su puesto, de Wyscout; el once probable, de Plantillas rivales (Supabase) o, sin marcar, su último once de BeSoccer.",
    bloques: [
      {
        titulo: "Lo nuevo (18/11/2026, ronda 22)",
        filas: [
          { que: "Preguntar al canal con tope", es: "Las listas del canal y los vídeos de cada lista se piden con un tope de 12 s. Si no contesta, sale el aviso con «Reintentar», que vuelve a preguntar sin usar la copia guardada." },
          { que: "Copia en el aparato", es: "Lo último que contestó el canal se guarda en el aparato (traeJson de lib/hojaCsv.ts). Se enseña al momento y se pone al día por detrás; si cambia algo, se vuelve a pintar." },
          { que: "Sin cortes de esa jornada", es: "Si el rival no tiene lista en el canal, si su lista está vacía o si no hay lista de la jornada elegida, se dice así («No hay cortes de la J12 en el canal: se ven los de…»). Debajo van «Abrir la lista del canal» y los botones de sus goles en vídeo. Si el canal no contesta, esos botones de goles salen también bajo el aviso." },
          { que: "Pestaña Lista del canal", es: "Nunca sale en blanco: mientras pregunta, el aviso de espera; si falla, el aviso con «Reintentar»; si el canal no tiene listas, se explica que se crean al subir los cortes desde Coding y hay un botón «Ir a Coding»." },
          { que: "Pestaña Visionados", es: "Las vistas de YouTube y las aperturas de la app se piden con un tope de 12 s. Si no llegan, dice «No se han podido leer los visionados» con «Reintentar» e «Ir a los clips». Ya no dice «Aún no hay visionados» cuando lo que ha pasado es que no han contestado." },
          { que: "Se carga de amarillas", es: "Sólo sale si sus amarillas por partido (BeSoccer) pasan de la mediana de los de su puesto en su plantilla, con 3 partidos o más; si no, la etiqueta no se pinta" },
          { que: "Peligros y explotables", es: "Cada uno con sus minutos de Wyscout y «tendencia» por debajo de 450′" },
          { que: "Le marca", es: "En cada tarjeta, nuestro jugador del duelo (la misma cuenta que Duelos y el Plan), con enlace a su ficha en Individual. «Plan de partido» ya no se repite en cada tarjeta: está en la tira de arriba" },
          { que: "Nunca la tarjeta en blanco", es: "Cada corte enseña su fotograma de YouTube; mientras llega, o si YouTube no tiene, una ficha compacta con las iniciales, el dorsal y el nombre del jugador", cuenta: "Los fotogramas se piden al abrir la pantalla (antes, sólo al acercarse a ellos: en el PDF, en una captura o bajando deprisa, los de abajo —«Fuera del once probable»— salían en blanco). Primero el póster del canal; si falla o es el gris de 120 px, i.ytimg.com/vi/ID/hqdefault.jpg" },
          { que: "La lectura, una vez", es: "La mejor y la peor cifra de Wyscout de cada titular están en la radiografía de arriba y ya no se repiten en su tarjeta. La tarjeta lleva el vídeo, las etiquetas del analista (▲ verde, ▼ naranja), un único «Ver base» y los enlaces; con varios cortes de un jugador, la lectura y los enlaces van una vez encima de sus vídeos. Los de fuera del once, que no salen arriba, y los del once sin lectura del analista sí llevan su ▲/▼ en la tarjeta, en una línea" },
          { que: "El percentil, con palabras", es: "Como en Plantillas rivales: «mejor que 9 de cada 10» o «peor que 7 de cada 10» de su puesto, en la radiografía y en las tarjetas; ya no «P91»", cuenta: "Siempre en el sentido «más es mejor»: en las de menos es mejor (faltas cometidas, pérdidas) el percentil va dado la vuelta y «Ver base» lo dice. Contra cuántos y con cuántos minutos se lee bajo el nombre en la radiografía y en «Ver base»: «se le compara con 117 laterales · 1.017′ en Wyscout»" },
          { que: "Cifras con un decimal", es: "Por partido y por 90′, un decimal («Remates 1,0», «xG 0,6»); dos sólo si con uno saldría 0,0 o es un xG por remate menor de 0,3. Porcentajes con un decimal y sin el «%» repetido del nombre. Los intentos van en «Ver base» («10 de 20 intentos»)" },
          { que: "Etiquetas de un solo clip", es: "Atenuadas y en cursiva, con «1 clip, tendencia»: no son un hecho firme. Con más clips, en firme y con «3 clips»" },
          { que: "Plan de partido", es: "Junto a «Su ficha» y «Su duelo», en cada jugador, con el rival ya elegido (los rivales no tienen seguimiento en la app)" },
          { que: "Ver base", es: "Con quién se le compara, sus minutos y cada cifra con su barrita rotulada: el peor a la izquierda, la mediana en medio y el mejor a la derecha" },
        ],
      },
      {
        titulo: "Lo nuevo (17/11/2026, ronda 21)",
        filas: [
          { que: "El once de la radiografía (18/11/2026)", es: "El mismo de Plantillas rivales, uno por hueco: once titulares en once puestos, por las líneas del dibujo (en un 4-2-3-1: defensa 4, medio 2, mediapunta y bandas 3, delantero 1), cada uno con el hueco y el puesto de su once (Palmberg, pivote; Olmedo, extremo izquierdo en su once, lateral derecho de origen)", cuenta: "colocacionDelCampograma con los titulares (asignaTitulares con rellena) y lineasDelDibujo, lib/rivals/colocacion-once.ts" },
          { que: "Rival y jornada", es: "Arriba, un desplegable de rival con su escudo y otro de jornada (nuestros partidos contra ese rival: «J13 · 22/11», con el resultado si ya se jugó). La jornada abre la lista del canal de ese partido («J13 · …») si existe; si no, la que se empareja sola. Ya no hay que elegir el rival tres veces. En el móvil, el rival va en su propia línea a todo el ancho; la jornada y «Próximo», debajo" },
          {
            que: "Radiografía del once probable",
            es: "Lo primero de la pantalla: el titular («6 clips de 6 titulares probables», y cuántos más hay de otros jugadores o con clips de Hudl), debajo los peligros y los explotables con su cifra («▼ Explotables: Palmberg por alto (duelos aéreos ganados 27,8 %, peor que 9 de cada 10)…»; como mucho 3 de cada), y una fila por titular con su mejor (● verde) y su peor cifra (● naranja) entre las métricas clave de su puesto, en una pista de percentil (la raya, la mediana; a la derecha, mejor), cuántos cortes suyos hay en el canal (▶) y en Hudl (⬇). Bajo el nombre, una sola frase con su puesto y contra quién se le compara («Pivote en su once (mediapunta de origen); se le compara con 123 medios · 683′ en Wyscout»), con «tendencia» si tiene menos de 450′, y la marca ▲ Peligro / ▼ Explotable si es uno de esos. Pinchar el nombre baja a su tarjeta",
            cuenta: "El once es el de Plantillas rivales y Duelos: el marcado en Plantillas si tiene 7 o más; si no, su último once de BeSoccer (rivals:informe). Fuera los lesionados y sancionados de su ficha, y se dice. Las cifras, las de su puesto en la categoría (Wyscout, esta temporada, desde 270′), sólo de las métricas clave de su puesto (lib/rivals/metricas-del-puesto.ts, la misma lista que «El once de un vistazo» de /rivals). Peligro: su mejor por encima de P80; explotable: su peor por debajo de P20; como mucho 3 de cada lado, los más extremos, y un veredicto por jugador",
          },
          { que: "Lista del canal", es: "Pasa a su propia pestaña («Lista del canal»): qué lista se ve para este rival, cambiarla por otra (vale para todo el cuerpo técnico) y abrirla en YouTube. En Clips sólo queda el aviso si la puesta a mano no parece de este rival" },
          { que: "Tarjeta de cada jugador", es: "Las etiquetas del analista con su color y un único «Ver base». El ▲/▼ de Wyscout, en una línea de 12 px, en los de fuera del once y en los del once que no tienen lectura del analista (ninguna tarjeta sin conclusión); donde hay lectura del analista, no se repite. Su ficha, Su duelo y Plan de partido, botones del mismo peso (el portero, sin «Su duelo»); Su ABP si su ficha le marca de balón parado" },
          { que: "Etiquetas con sus clips", es: "Cada etiqueta del analista dice en cuántos clips suyos se apoya: los de la lista del canal o, si no tiene, los de Hudl. Con uno solo, «tendencia»; sin clips, no se pone cifra" },
          { que: "Contra quién se le compara", es: "Una sola población por puesto: la de Wyscout (donde más juega). El puesto se dice una vez: «Pivote en su once; se le compara con 123 medios · 683′ en Wyscout». Si Wyscout le mide en otra familia, se dice por qué: «se le compara con 117 laterales (en Wyscout juega sobre todo de lateral derecho)»", cuenta: "El puesto «en su once» sale de la misma cuenta del campograma de /rivals que usa Duelos" },
          { que: "El resto de su once probable", es: "Los titulares sin corte en el canal, con la misma tarjeta que los de arriba y sus clips de Hudl para ver uno a uno o bajar (.zip). Sale aunque el rival no tenga lista en el canal; el resto de la plantilla va debajo" },
          { que: "Móvil", es: "A 390 px los chips de jugador son un desplegable por puesto («2 Jorge Mier · 1 corte · once probable»); desde 640 px, los chips" },
          { que: "Clips de Hudl de todo el rival", es: "El panel con todas sus listas va al final de Clips (cada titular sin corte ya lleva los suyos en su tarjeta)" },
        ],
      },
      {
        titulo: "Lo nuevo (17/11/2026, ronda 20)",
        filas: [
          { que: "Tira de accesos del rival (17/11/2026)", es: "A la vista, el vídeo del rival (sus goles, cómo le marcan, su último partido), ⬇ Clips de Hudl si los hay, Plan de partido, Duelos y ABP; el resto de pantallas del rival, en «Más», con el rival ya puesto" },
          { que: "Pie de cada vídeo", es: "Contra quién es el corte si el título lo dice («vs Alcorcón»), «lista J13» (la lista de nuestro partido, no la jornada del corte), el minuto y lo que dura" },
          { que: "Su ficha · Su duelo · Su ABP", es: "Botones a la vista bajo cada vídeo" },
        ],
      },
      {
        titulo: "Clips",
        filas: [
          { que: "Rival", es: "Un solo desplegable, ordenado por calendario y con la jornada; abre con el próximo (chapa «Próximo»). Con ?equipo= abre en ese rival y con &jugador= en los cortes de ese jugador (así llega desde Duelos)" },
          { que: "Tira de accesos del rival", es: "Bajo el título, con el rival puesto: ▶ Sus goles en vídeo, ▶ Cómo le marcan y ▶ Su último partido (en una ventana; aparte, «Cómo son sus goles ›» abre Análisis de goles), ⬇ Clips de Hudl si los hay, Plan de partido, Plantilla, Colectivo, ABP, Área, Duelos y las pizarras" },
          {
            que: "Clips de Hudl (17/11/2026)",
            es: "Al final de Clips, si el rival tiene listas en Hudl: cada jugador con su dorsal y cuántos clips; «⬇» baja al portátil un .zip con los suyos, nombrados «RIVAL - JUGADOR - 01 - <título>.mp4», «▶ Ver» los abre uno a uno (▶ para verlo aquí, ⬇ para bajar ése) y «Descargar todos» baja los de todo el rival. Si a una lista le faltan clips por bajar, «Pedir a Hudl» se lo encarga al ordenador del club y avisa al terminar. En «Por jugador», la cabecera de cada jugador con vídeo lleva también «Descargar sus clips (N)». Las descargas van en segundo plano (píldora abajo a la izquierda)",
            cuenta: "Las listas de Hudl tituladas «RIVAL - Nº», «RIVAL - NOMBRE» o «RIVAL - Nº NOMBRE» (biblioteca del Castilla). El ordenador del club baja cada clip a 720p (unos 2-4 MB por 11 s) y lo guarda en el almacén de vídeo (scripts/hudl-clips-rival.mjs cada noche con la jornada y con «Pedir a Hudl»; documento hudl:clips-rival; primero el próximo rival). La lista se ata al rival por el nombre del equipo («UD IBIZA» = UD Ibiza, «MURCIA» = Real Murcia) y al jugador por su nombre o apellido; si sólo trae el número, por dorsal, y si el nombre casa a dos, decide el dorsal (lib/hudl-clips.ts)",
          },
          { que: "Titular de la pantalla", es: "Encima de la radiografía: cuántos clips hay de cuántos titulares probables («6 clips de 6 titulares probables»), los de otros jugadores, los titulares que sólo tienen Hudl y, debajo, sólo los peligros y explotables de la jerarquía (como mucho 3 de cada), cada uno con dónde y su cifra" },
          { que: "La lista", es: "En la pestaña «Lista del canal». Se empareja sola por el nombre del equipo; si no casa, se elige una vez y vale para todo el cuerpo técnico. «J» = nuestra jornada contra ese rival" },
          { que: "El resto de su once probable", es: "Los titulares sin corte, con lo que sí hay: su ▲ y ▼ de Wyscout contra su puesto y la lectura del analista, con Su ficha, Su duelo y Su ABP. Quien no tiene ni cifra ni etiqueta no sale" },
          { que: "Chips de jugador", es: "Índice y filtro (en el móvil, un desplegable): por puesto y, dentro, primero el once probable, luego quien más tiene que explotar (naranja) y luego por minutos", cuenta: "El número es cuántos cortes tiene; «Todos los vídeos» cuenta cortes, no jugadores" },
          { que: "Once probable · N con vídeo de M", es: "Los titulares del once probable con algún corte, de los que tiene marcados en Plantillas rivales; por línea, del portero a la delantera" },
          { que: "Por jugador · Todos", es: "Agrupado por jugador, o todos los cortes seguidos" },
          { que: "Ficha del corte", es: "Jugador, puesto, etiquetas y de qué va (la acción, del título del vídeo); abajo, la jornada, el minuto si el título o la descripción lo dicen («63′») y lo que dura el corte", cuenta: "Etiquetas en verde (▲, lo que hace bien) y en naranja (▼, lo que podemos explotar), con la leyenda encima de las fichas. La duración la da YouTube; si no está escrito el minuto, no se pone" },
          { que: "Sólo para el analista", es: "Con la sesión de administrador: las vistas en YouTube de cada corte y, en «Por jugador», qué titulares del once probable no tienen clip y de qué líneas no hay cortes" },
          { que: "Titular en X de Y", es: "Titularidades y partidos de la temporada, con los minutos de BeSoccer; con menos de 10 partidos, «(muestra corta)»" },
          { que: "Etiquetas en lenguaje de caseta", es: "Cada etiqueta de la ficha se dice como comportamiento («El duro» → va fuerte al duelo) y, si BeSoccer tiene la cifra, con su base («se carga de amarillas: 4 en 12 partidos»)" },
          { que: "Cifras de su puesto", es: "Su mejor (▲) y su peor (▼) cifra de Wyscout entre las métricas clave de su puesto, contra los de su puesto en la categoría, con su unidad («Remates 1,0 por 90′», «Duelos aéreos ganados 27,8 %») y «mejor/peor que N de cada 10»; contra cuántos, sus minutos y la barrita de su percentil con la mediana y los extremos rotulados, en «Ver base». Ya no salen «Faltas cometidas», «Remates bloqueados» ni nada sin lectura táctica para su puesto. Fuera los penaltis y los porcentajes de menos de 15 intentos; los demás porcentajes llevan sus intentos en «Ver base» («10 de 20 intentos»). El ▲ sólo si está por encima de la mediana y el ▼ sólo si está por debajo; con menos de 270′ no sale", cuenta: "Métricas clave (lib/rivals/metricas-del-puesto.ts): portero, paradas, goles evitados, salidas y juego con el pie; central, duelos aéreos y defensivos, interceptaciones y pase progresivo; lateral, centros, acciones de ataque, duelos defensivos y progresión; medio, recuperaciones (acciones defensivas), interceptaciones, pase progresivo y duelos; banda y mediapunta, regate, pase clave, último tercio, xA y remate; delantero, xG, remates, toques en el área y juego aéreo. El puesto es el de la comparación de Wyscout. «Mejor que 9 de cada 10» = su percentil redondeado a decenas (p85-p94 → 9). El servidor manda todas sus cifras de esa lista (perfiles de /api/data-analisis, delPuesto)" },
          { que: "Pestaña Lista del canal", es: "La de este rival arriba; las de otros rivales, en «Otras jornadas»" },
          { que: "Su ficha · Su duelo · Su ABP", es: "En cada corte, enlaces a su ficha de Plantillas rivales y a Duelos de ese rival; si su ficha le marca de balón parado (rematador, lanzador, córner…), también a ABP del rival. «Explotable» va con la frase entera" },
          { que: "Fuera del once probable", es: "Con once marcado, los demás van por línea rotulados «Fuera del once probable · defensas»…; con menos de 10 cortes en la lista, «muestra corta»" },
          { que: "Del equipo", es: "Los cortes cuyo título no dice con seguridad de quién son" },
          { que: "Buscar · Copiar enlaces", es: "Busca en los títulos (córner, pérdida, un nombre…) y copia los enlaces de lo que se ve" },
        ],
      },
      {
        titulo: "Visionados",
        filas: [
          { que: "Vistas en YouTube", es: "Pestaña «Visionados en YouTube» (sin cifra en la pestaña): vistas acumuladas de todos los clips del canal desde la jornada 1", cuenta: "«+» = vistas desde la foto anterior; se hace una al día" },
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
    revisada: "2026-11-20",
  },

  /* ==================== IDENTIDAD POSICIONAL (12/11/2026) ==================== */
  {
    ruta: "/identidad-posicional",
    titulo: "Identidad posicional",
    resumen: "Los contenidos individuales de cada puesto, con balón y sin balón, cómo están nuestros jugadores en lo que se mide y quién de toda la plantilla lo ejecuta mejor.",
    origen: "La hoja de identidad posicional (una fila por contenido); la escribe el cuerpo técnico, aquí o en la hoja. Los jugadores del puesto, de la plantilla; las cifras, de Wyscout (liga).",
    bloques: [
      {
        titulo: "Lo nuevo (18/11/2026): las visuales de las ideas de X",
        filas: [
          { que: "Base de la radiografía", es: "Cuántos contenidos del puesto se miden en liga frente al total, y cuántos son sólo tendencia" },
          { que: "De la tarea al plan", es: "«Por dónde empezar» y cada «Qué entrenamos» llevan al microciclo de la semana y al seguimiento del jugador ya elegido" },
          { que: "Seguimiento", es: "Junto a cada jugador, el botón «Seguimiento» abre su seguimiento; el nombre abre su área de mejora" },
          { que: "En el móvil y la tableta (19/11/2026)", es: "Los accesos al seguimiento de cada jugador se aciertan con el dedo y los rótulos pequeños suben a 11 px" },
          { que: "En todas", es: "Misma idea visual que la publicación de X de la que salió, con la letra del club (Barlow Condensed) en el titular y las cifras, la tarjeta de la app (canto y sombra, día y noche) y una entrada suave. Los datos y las cuentas no cambian" },
          { que: "¿Quién lo ejecuta mejor?", es: "La conclusión como titular, cada jugador en su tarjeta con el puesto y el encaje en cifra grande y la barra que se llena al llegar" },
        ],
      },
      {
        titulo: "La pantalla",
        filas: [
          { que: "Posiciones", es: "Los puestos de la hoja; el buscador filtra los contenidos" },
          { que: "Con balón / Sin balón", es: "Los contenidos del puesto en dos columnas, con cuántos hay en cada una", cuenta: "Fuera de edición, primero los que se miden" },
          { que: "Sus jugadores · su área de mejora", es: "Los de la plantilla en ese puesto; el nombre abre su área de mejora en Individual y el icono de la carpeta, su seguimiento. Quien no sale en ninguna cifra lleva «menos de 450′» en su chip" },
          { que: "Radiografía del puesto", es: "La primera imagen: una fila por contenido medido (borde oro con balón, azul sin balón) y una columna por jugador con ▲, ▼, = o ○ (tendencia). El título es la conclusión: quién queda por debajo en más contenidos" },
          { que: "Los demás contenidos", es: "A la vista, como mucho 3 contenidos medidos por columna; el resto (medidos y sin medir) queda plegado tras «Ver los otros N contenidos» (se abren al editar o buscar)" },
          { que: "En el móvil", es: "Editar va en su propia línea encima: la tarjeta de prioridad y los chips ocupan todo el ancho" },
          { que: "?puesto= · ?vista=quien", es: "Abren la pantalla en ese puesto (central, lateral, medio, extremo, delantero) y en «¿Quién lo ejecuta mejor?»; es el enlace «Jugadores que lo ejecutan mejor» de Identidad de Juego" },
          { que: "Ficha del contenido", es: "Si la hoja lo trae, se despliega con definición, qué se ve, criterio y clip" },
        ],
      },
      {
        titulo: "Lo que se mide",
        filas: [
          { que: "Se mide en el partido", es: "La métrica de Wyscout con que se sigue ese contenido, con una línea que la explica en las menos obvias (pases progresivos, conducciones en progresión, ataque en profundidad, acciones defensivas); sin métrica no sale nada" },
          { que: "El gráfico", es: "Una fila por jugador: su punto sobre una escala común, la raya azul es la mediana del puesto y la franja verde el lado bueno. El título dice quién queda por debajo, quién por encima y quién en la mediana (=); el nombre abre su ficha" },
          { que: "▲ / ▼ / =", es: "Cada jugador nuestro frente a la mediana del puesto en la categoría", cuenta: "▲ mejor, ▼ peor, = la misma cifra con los decimales que se enseñan. Con el sentido de la métrica puesto" },
          { que: "11 de 29 · ≈ 26 en 883′", es: "La base de cada cifra: en los %, aciertos de intentos; en las cifras por 90′, cuántas acciones lleva en sus minutos. Un decimal como mucho (6,7, no 6,73)", cuenta: "Estimado con el volumen por 90′ de Wyscout y sus minutos de liga" },
          { que: "tendencia", es: "Una cifra que sale de menos de 15 intentos (en los %) o de menos de 15 acciones (en las cifras por 90′): punto hueco, sin ▲/▼, sin «Qué entrenamos» y fuera de «Por dónde empezar a entrenar»; la tarjeta que la tiene lleva su leyenda junto al punto hueco" },
          { que: "Mediana", es: "La de los jugadores del puesto en la categoría", cuenta: "Sólo con 450′ o más de liga, y con al menos seis para comparar" },
          { que: "Qué entrenamos", es: "Si alguno queda por debajo: a quién, la tarea del contenido, qué contar en ella y el objetivo de partido (llegar a la mediana, o bajar de ella si menos es mejor). El área de mejora y el seguimiento de cada jugador van una vez, en sus chips de arriba. En el contenido de «Por dónde empezar» no se repite: remite a la tarjeta de arriba" },
          { que: "Por dónde empezar a entrenar", es: "Tarjeta destacada en tres líneas: quién queda por debajo, una fila por jugador con su cifra y base (el nombre abre su área de mejora) y el objetivo", cuenta: "Por la proporción de los que quedan por debajo (sin contar los de «tendencia»); empate, por el número" },
        ],
      },
      {
        titulo: "¿Quién lo ejecuta mejor?",
        filas: [
          { que: "La vista", es: "Botón junto a «Contenidos del puesto»: todos los jugadores de campo del Castilla ordenados por cómo cumplen los contenidos medibles del puesto elegido, también los que no lo tienen como puesto" },
          { que: "La cifra (0-100)", es: "Media de sus percentiles en esos contenidos contra los jugadores DE ESE PUESTO en la categoría (Wyscout, liga)", cuenta: "Cada percentil con el sentido de la métrica; 50 = la mediana del puesto. Sólo 450′ o más, con cifra en todos los contenidos medidos y al menos seis del puesto para comparar" },
          { que: "natural / otro puesto", es: "Natural si su primera demarcación en Wyscout es ese puesto; si no, dice cuál es la suya" },
          { que: "vs el mejor especialista", es: "Su cifra menos la del natural mejor colocado; en verde si le supera" },
          { que: "Resumen de arriba", es: "Quién de otro puesto queda por encima del mejor especialista, o que nadie lo hace" },
          { que: "Bajo cada fila", es: "El percentil de cada contenido, con el texto de la hoja" },
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
      "Un jugador con menos de 450′ de liga sale en los chips pero no en las cifras; el umbral se dice una vez en la leyenda.",
      "Si el guardado no llega a la hoja, se sigue en edición y se reintenta solo.",
      "«¿Quién lo ejecuta mejor?» compara perfiles estadísticos con los del puesto, no cómo rindió jugando allí; los porteros no entran y hacen falta al menos dos contenidos medidos.",
    ],
    revisada: "2026-11-20",
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
