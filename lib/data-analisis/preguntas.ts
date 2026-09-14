import { METRICA_POR_KEY } from "./metricas";

/**
 * La batería de preguntas.
 *
 * Un selector de métricas es una herramienta para quien ya sabe qué buscar.
 * «Cuota de pases progresivos contra xG» sólo se le ocurre a quien conoce las
 * cincuenta y siete métricas de memoria; el resto de la caseta abre la pantalla
 * con una pregunta en la cabeza —«¿llegamos al área o nos quedamos fuera?»— y
 * no con dos nombres de columna.
 *
 * Esto es esa lista de preguntas, ordenada por **momento del juego**: con
 * balón, sin balón, las dos transiciones y el balón parado por sus dos lados.
 * Cada pregunta no es un texto: es **el par de métricas que la contesta**. Al
 * elegirla se rellenan los dos ejes, y a partir de ahí se pueden cambiar a mano
 * —la pregunta es un atajo, no una jaula—.
 *
 * **Algunas preguntas piden el dato del rival.** «¿Cuántos córners
 * concedemos?» no está en ninguna columna: está en la fila del rival de cada
 * partido. Como el informe de Wyscout trae **también la fila del contrario**,
 * se saca invirtiendo el lado —`contraX` / `contraY`—, sin pedir nada más.
 */

export type Momento = "con" | "sin" | "trOf" | "trDef" | "abpOf" | "abpDef";

export const MOMENTOS: {
  key: Momento;
  label: string;
  corto: string;
  pregunta: string;
}[] = [
  {
    key: "con",
    label: "Con balón",
    corto: "Con balón",
    pregunta: "¿Qué hacemos cuando el balón es nuestro?",
  },
  {
    key: "sin",
    label: "Sin balón",
    corto: "Sin balón",
    pregunta: "¿Cómo defendemos cuando el rival tiene el balón?",
  },
  {
    key: "trOf",
    label: "Transición ofensiva",
    corto: "Tr. ofensiva",
    pregunta: "¿Qué pasa en los segundos siguientes a robar?",
  },
  {
    key: "trDef",
    label: "Transición defensiva",
    corto: "Tr. defensiva",
    pregunta: "¿Qué pasa en los segundos siguientes a perderlo?",
  },
  {
    key: "abpOf",
    label: "Balón parado a favor",
    corto: "ABP a favor",
    pregunta: "¿Rentabilizamos lo que se ensaya?",
  },
  {
    key: "abpDef",
    label: "Balón parado en contra",
    corto: "ABP en contra",
    pregunta: "¿Cuánto nos cuesta defender el balón parado?",
  },
];

export type Pregunta = {
  key: string;
  momento: Momento;
  /** La pregunta, tal y como se hace en la caseta. */
  texto: string;
  x: string;
  y: string;
  /** Para las que se contestan con el dato del rival. */
  contraX?: boolean;
  contraY?: boolean;
  /** Qué significa cada esquina del dibujo. */
  comoSeLee: string;
};

export const PREGUNTAS: Pregunta[] = [
  /* =========================== CON BALÓN ========================== */
  {
    key: "posesion-llega",
    momento: "con",
    texto: "¿La posesión llega al último tercio o se queda en el medio?",
    x: "posesion",
    y: "cuotaUltimoTercio",
    comoSeLee:
      "Arriba a la derecha se tiene el balón y se lleva arriba. Abajo a la derecha es la posesión estéril: mucho balón en zonas donde no pasa nada.",
  },
  {
    key: "cuesta-ocasion",
    momento: "con",
    texto: "¿Cuánto nos cuesta fabricar una ocasión?",
    x: "pasesPorOcasion",
    y: "xgPorAtaque",
    comoSeLee:
      "Arriba a la izquierda es lo bueno: pocos pases y mucho peligro por ataque. A la derecha se necesita mucha circulación para llegar una vez.",
  },
  {
    key: "progresar-o-mantener",
    momento: "con",
    texto: "¿Circulamos para progresar o para conservar?",
    x: "cuotaProgresivos",
    y: "cuotaLaterales",
    comoSeLee:
      "Ninguna esquina es mala de por sí: es el estilo. Abajo a la derecha se busca el pase que avanza; arriba a la izquierda se mueve de lado esperando el hueco.",
  },
  {
    key: "entrar-al-area",
    momento: "con",
    texto: "¿Entramos al área o nos quedamos en la frontal?",
    x: "entradasArea",
    y: "distanciaTiro",
    comoSeLee:
      "Abajo a la derecha es llegar dentro y rematar cerca. Arriba a la izquierda es el equipo que no entra y prueba desde lejos.",
  },
  {
    key: "ocupar-el-area",
    momento: "con",
    texto: "¿Hay gente dentro del área cuando llega el balón?",
    x: "toquesArea",
    y: "xgPorTiro",
    comoSeLee:
      "Los toques en el área son la señal de cuánta gente la ocupa. Con muchos toques y poco xG por tiro se llega pero se remata mal colocado.",
  },
  {
    key: "centrar-mucho-o-bien",
    momento: "con",
    texto: "¿Centramos mucho o centramos bien?",
    x: "centros",
    y: "centrosPrecisos",
    comoSeLee:
      "Abajo a la derecha es centrar por centrar. Arriba a la izquierda son pocos centros pero encontrando a alguien: normalmente es que se elige mejor el momento.",
  },
  {
    key: "tirar-mucho-o-bien",
    momento: "con",
    texto: "¿Tiramos mucho o tiramos bien?",
    x: "tiros",
    y: "xgPorTiro",
    comoSeLee:
      "El volumen y la calidad no van juntos. Abajo a la derecha es disparar desde donde no se marca.",
  },

  /* =========================== SIN BALÓN ========================== */
  {
    key: "presionar-o-esperar",
    momento: "sin",
    texto: "¿Presionamos arriba o esperamos atrás?",
    x: "ppda",
    y: "recuperacionesAltas",
    comoSeLee:
      "PPDA baja es presionar mucho. Arriba a la izquierda es la presión alta de verdad: se deja hacer pocos pases y se roba lejos de la propia portería.",
  },
  {
    key: "conceder-poco-o-malo",
    momento: "sin",
    texto: "¿Concedemos pocos remates o remates malos?",
    x: "tirosContra",
    y: "tirosContraPuerta",
    comoSeLee:
      "Abajo a la izquierda es la buena: pocos remates y encima desviados. Arriba a la izquierda, pocos pero limpios, señala que se concede poco pero muy claro.",
  },
  {
    key: "leer-o-entrar",
    momento: "sin",
    texto: "¿Se defiende leyendo o entrando?",
    x: "interceptaciones",
    y: "entradas",
    comoSeLee:
      "Arriba a la izquierda se llega tarde y hay que ir al suelo. Abajo a la derecha se corta antes, que es defender sin riesgo.",
  },
  {
    key: "duelos-defensivos",
    momento: "sin",
    texto: "¿Ganamos el duelo cuando toca defender?",
    x: "duelosDefensivos",
    y: "duelosAereos",
    comoSeLee:
      "Arriba a la derecha se gana en el suelo y en el aire. Un equipo fuerte abajo y flojo arriba defiende bien todo menos el centro al área.",
  },
  {
    key: "defender-cuesta-faltas",
    momento: "sin",
    texto: "¿Defender nos cuesta faltas y tarjetas?",
    x: "faltas",
    y: "amarillas",
    comoSeLee:
      "Abajo a la izquierda se defiende sin infringir. Arriba a la derecha se corta con falta, y eso son ocasiones de estrategia para el rival.",
  },
  {
    key: "cuesta-cada-amarilla",
    momento: "sin",
    texto: "¿Cuántas faltas cuesta cada amarilla?",
    x: "faltasPorAmarilla",
    y: "faltas",
    comoSeLee:
      "Arriba a la derecha se hacen muchas faltas y aun así salen baratas: se infringe donde el árbitro no saca. Abajo a la izquierda cada falta se paga, que es de donde salen las sanciones.",
  },
  {
    key: "tarjetas-de-llegar-tarde",
    momento: "sin",
    texto: "¿Las tarjetas vienen de llegar tarde a la entrada?",
    x: "entradas",
    y: "amarillas",
    comoSeLee:
      "Arriba a la izquierda es lo caro: se falla la entrada y encima se ve la tarjeta. Abajo a la derecha se entra bien y no hace falta infringir.",
  },

  /* ===================== LA FALTA, TAMBIÉN A FAVOR ================ */
  {
    key: "nos-frenan-con-falta",
    momento: "con",
    texto: "¿Nos frenan con falta cuando llegamos?",
    x: "faltas",
    contraX: true,
    y: "entradasArea",
    comoSeLee:
      "Arriba a la derecha se entra al área y el rival sólo puede pararlo infringiendo: son faltas en zona de estrategia. Abajo a la izquierda ni se llega ni hace falta que nos frenen.",
  },

  /* ===================== TRANSICIÓN OFENSIVA ====================== */
  {
    key: "rapido-o-elaborado",
    momento: "trOf",
    texto: "Al robar, ¿salimos rápido o paramos el juego?",
    x: "contras",
    y: "ataquesPos",
    comoSeLee:
      "Es la identidad del ataque. A la derecha se corre al robar; arriba se recompone y se empieza de nuevo. Los equipos completos están altos en los dos.",
  },
  {
    key: "contras-rematadas",
    momento: "trOf",
    texto: "¿Las contras terminan en remate?",
    x: "contras",
    y: "contrasRemate",
    comoSeLee:
      "Correr mucho sin rematar es correr para nada. Arriba a la izquierda hay pocas contras pero se aprovechan todas.",
  },
  {
    key: "cuanto-se-tarda",
    momento: "trOf",
    texto: "¿Cuánto tiempo necesitamos para hacer una ocasión?",
    x: "minutosPorOcasion",
    y: "pasesPorOcasion",
    comoSeLee:
      "Abajo a la izquierda es el equipo vertical: poco tiempo y pocos pases hasta la ocasión. Arriba a la derecha hay que trabajarla mucho.",
  },
  {
    key: "robo-alto-a-remate",
    momento: "trOf",
    texto: "¿El robo en campo rival acaba en peligro?",
    x: "recuperacionesAltas",
    y: "xgPorAtaque",
    comoSeLee:
      "Robar arriba sólo vale si detrás hay ataque. Abajo a la derecha se roba mucho arriba pero no se convierte en nada.",
  },
  {
    key: "correr-hacia-adelante",
    momento: "trOf",
    texto: "¿Hay gente atacando el espacio al robar?",
    x: "pasesProfundidad",
    y: "desmarques",
    comoSeLee:
      "Los dos van de la mano: sin desmarque no hay pase en profundidad. Si hay desmarques y no hay pases, el problema es de decisión, no de movimiento.",
  },

  /* ==================== TRANSICIÓN DEFENSIVA ====================== */
  {
    key: "donde-se-pierde",
    momento: "trDef",
    texto: "¿Dónde perdemos el balón?",
    x: "perdidas",
    y: "perdidasBajas",
    comoSeLee:
      "Abajo a la derecha se pierde mucho pero lejos: son pérdidas baratas. Arriba, cada pérdida es una transición del rival cerca de nuestra área.",
  },
  {
    key: "perdida-a-remate",
    momento: "trDef",
    texto: "¿La pérdida nos cuesta remates en contra?",
    x: "perdidasBajas",
    y: "tirosContra",
    comoSeLee:
      "Es la factura directa de la transición. Abajo a la derecha se pierde atrás y aun así no se concede: el repliegue funciona.",
  },
  {
    key: "presion-tras-perdida",
    momento: "trDef",
    texto: "Al perderlo, ¿apretamos o nos replegamos?",
    x: "recuperacionesAltas",
    y: "ppda",
    comoSeLee:
      "Muchas recuperaciones altas con PPDA baja es presión tras pérdida. Pocas y PPDA alta es replegarse y esperar en bloque medio.",
  },
  {
    key: "falta-tactica",
    momento: "trDef",
    texto: "¿Se corta la contra del rival con falta?",
    x: "perdidas",
    y: "faltas",
    comoSeLee:
      "Arriba a la derecha se pierde y se frena con falta táctica. Frena la contra, pero le regala al rival la jugada ensayada.",
  },
  {
    key: "nos-cortan-la-contra",
    momento: "trOf",
    texto: "Al robar, ¿nos cortan la contra con falta?",
    x: "faltas",
    contraX: true,
    y: "contras",
    comoSeLee:
      "Arriba a la derecha se sale corriendo al robar y al rival no le queda otra que hacer falta. Abajo a la derecha nos hacen faltas sin que salgamos: son de otra cosa, no de la transición.",
  },

  /* ===================== BALÓN PARADO A FAVOR ===================== */
  {
    key: "abp-rentabilidad",
    momento: "abpOf",
    texto: "¿Rentabilizamos las jugadas de estrategia?",
    x: "abp",
    y: "abpRemate",
    comoSeLee:
      "Arriba a la izquierda es lo eficiente: pocas jugadas pero casi todas acaban en remate. Abajo a la derecha se tiran muchas para nada.",
  },
  {
    key: "corners-generan",
    momento: "abpOf",
    texto: "¿Los córners generan remate?",
    x: "corners",
    y: "cornersRemate",
    comoSeLee:
      "El volumen de córners depende de cuánto se ataca; lo que se entrena es la segunda columna. Muchos córners sin remate es un problema de ensayo.",
  },
  {
    key: "cuanto-viene-parado",
    momento: "abpOf",
    texto: "¿Qué parte de nuestro peligro nace de balón parado?",
    x: "cuotaRematesAbp",
    y: "xg",
    comoSeLee:
      "A la derecha se depende de la estrategia. Con poco xG y mucha cuota de ABP, el juego no está creando y la estrategia lo está tapando.",
  },
  {
    key: "faltas-cerca",
    momento: "abpOf",
    texto: "¿Se aprovechan las faltas cerca del área?",
    x: "faltasTiro",
    y: "faltasRemate",
    comoSeLee:
      "La primera es cuántas se tienen; la segunda, cuántas acaban en remate. La diferencia entre las dos es lo que se entrena.",
  },
  {
    key: "aereo-y-corner",
    momento: "abpOf",
    texto: "¿El juego aéreo se traduce en peligro de córner?",
    x: "duelosAereos",
    y: "cornersRemate",
    comoSeLee:
      "Ganar en el aire y no rematar los córners señala colocación o trayectoria, no altura.",
  },

  /* ==================== BALÓN PARADO EN CONTRA ==================== */
  {
    key: "corners-concedidos",
    momento: "abpDef",
    texto: "¿Cuántos córners concedemos y cuántos acaban en remate?",
    x: "corners",
    y: "cornersRemate",
    contraX: true,
    contraY: true,
    comoSeLee:
      "Las dos son del rival contra nosotros. Abajo a la derecha se conceden muchos córners pero se defienden bien; arriba a la izquierda, pocos y muy peligrosos.",
  },
  {
    key: "estrategia-en-contra",
    momento: "abpDef",
    texto: "¿Nos hacen daño con la estrategia?",
    x: "abp",
    y: "abpRemate",
    contraX: true,
    contraY: true,
    comoSeLee:
      "Cuántas jugadas paradas tiene el rival contra nosotros y cuántas rematan. Abajo a la izquierda es el equipo que ni concede ni sufre.",
  },
  {
    key: "area-en-los-corners",
    momento: "abpDef",
    texto: "¿Se defiende el área cuando llega el centro?",
    x: "duelosAereos",
    y: "cornersRemate",
    contraY: true,
    comoSeLee:
      "El eje X son nuestros duelos aéreos ganados; el Y, los córners que el rival consigue rematar. Abajo a la derecha es defender el área de verdad.",
  },
  {
    key: "regalar-faltas",
    momento: "abpDef",
    texto: "¿Regalamos faltas peligrosas cerca de nuestra área?",
    x: "faltas",
    y: "faltasRemate",
    contraY: true,
    comoSeLee:
      "Las faltas son nuestras; los remates de falta, del rival. Arriba a la derecha se corta con falta y el rival cobra.",
  },
  {
    key: "peligro-parado-recibido",
    momento: "abpDef",
    texto: "¿Qué parte del peligro que recibimos viene de balón parado?",
    x: "cuotaRematesAbp",
    y: "tirosContra",
    contraX: true,
    comoSeLee:
      "A la izquierda y abajo es el equipo sólido en los dos frentes. A la derecha con pocos remates en contra, casi todo lo que se sufre es estrategia: se arregla entrenando, no replegándose más.",
  },
];

export const PREGUNTA_POR_KEY = new Map(PREGUNTAS.map((p) => [p.key, p]));

/** Sólo se ofrecen las preguntas cuyas dos métricas existen de verdad. */
export const PREGUNTAS_VALIDAS = PREGUNTAS.filter(
  (p) => METRICA_POR_KEY.has(p.x) && METRICA_POR_KEY.has(p.y),
);

/** Cómo se rotula un eje cuando el valor es el del rival. */
export const rotuloDeEje = (nombre: string, contra?: boolean) =>
  contra ? `${nombre} (del rival)` : nombre;
