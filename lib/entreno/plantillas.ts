/*
|--------------------------------------------------------------------------
| DE CONSIGNA DE EQUIPO A OBJETIVO MEDIBLE (21/10/2026)
|--------------------------------------------------------------------------
|
| El post dice «Cerramos los partidos con ventaja» o «Defendemos la falta
| lateral directa»: una consigna de equipo. Copiada tal cual como objetivo,
| la IA no sabe qué mirar ni a quién, y el jugador no sabe qué se le pide
| (crítica del experto en fútbol). Aquí cada consigna se reconoce por sus
| palabras y se propone el objetivo entero: a qué línea se le pide, en qué
| tarea del día se mira, qué es CORRECTO y qué es MEJORABLE, y la meta. Es
| una propuesta: el cuerpo técnico la corrige antes de añadirla.
*/

import type { ObjetivoEntreno } from "./modelo";

export type Linea = "porteros" | "defensa" | "medios" | "delanteros";

export const LINEAS: { clave: Linea; nombre: string }[] = [
  { clave: "porteros", nombre: "Porteros" },
  { clave: "defensa", nombre: "Defensa" },
  { clave: "medios", nombre: "Medios" },
  { clave: "delanteros", nombre: "Delanteros" },
];

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * La línea de un jugador por su puesto. La hoja lo escribe con el número de
 * rol (1 portero, 2-5 defensas, 6/8/10 medios, 7/9/11 delanteros; ver
 * lib/posiciones.ts), pero también vale el puesto escrito.
 */
export function lineaDe(posicion: string | undefined): Linea | null {
  const p = sinTildes(String(posicion ?? "").trim());

  if (!p) return null;

  const n = Number(p.match(/^\d+/)?.[0]);

  if (Number.isFinite(n) && n > 0) {
    if (n === 1 || n === 13) return "porteros";
    if (n >= 2 && n <= 5) return "defensa";
    if (n === 6 || n === 8 || n === 10) return "medios";
    if (n === 7 || n === 9 || n === 11) return "delanteros";
  }

  if (/port|^por\b|^gk/.test(p)) return "porteros";
  if (/def|central|lateral|carrilero|^df|^ld\b|^li\b|^lat/.test(p)) return "defensa";
  if (/medi|pivot|interior|mc|mco|mcd|volante/.test(p)) return "medios";
  if (/dela|punta|extrem|ariete|^dc\b|^ed\b|^ei\b|^ext/.test(p)) return "delanteros";

  return null;
}

type Plantilla = {
  /** Las palabras de la consigna que la delatan. */
  encaja: RegExp;
  /** El objetivo, dicho para el jugador. */
  objetivo: string;
  lineas: Linea[];
  /** Cómo se llama ese grupo en el campo: «línea de marca». */
  grupo: string;
  correcto: string;
  mejorable: string;
  meta: number;
  /** Las tareas del día que suelen servir para mirarlo. */
  tarea: RegExp;
};

/* Del más concreto al más general: gana el primero que encaja. */
const PLANTILLAS: Plantilla[] = [
  {
    encaja: /falta.*(defens|en contra)|defendemos la falta|falta lateral/,
    objetivo: "Defender la falta lateral: línea a la altura pactada y ataque del balón",
    lineas: ["defensa", "medios"],
    grupo: "línea de marca",
    correcto: "Al golpeo la línea está a la altura pactada, perfilados viendo balón y par, y atacan el balón en la zona de caída",
    mejorable: "La línea se hunde antes del golpeo, se pierde al par en el bloqueo o el rival remata sin oposición",
    meta: 75,
    tarea: /abp|balon parado|falta|estrategia/,
  },
  {
    encaja: /corner.*(defens|en contra)|defendemos el corner|segundo palo/,
    objetivo: "Defender el córner: cada uno con su par y el primer contacto nuestro",
    lineas: ["defensa", "medios"],
    grupo: "los que defienden el área",
    correcto: "Antes del saque cada uno tiene a su par o su zona; en la caída, el primer contacto es nuestro y se despeja fuera",
    mejorable: "Se pierde al par en el bloqueo, nadie ataca la caída o el despeje queda dentro del área",
    meta: 75,
    tarea: /abp|balon parado|corner|estrategia/,
  },
  {
    encaja: /segunda jugada|rechace|segundo balon|por alto|juego aereo|en largo/,
    objetivo: "Ganar la segunda jugada: uno disputa y dos cerca de la caída",
    lineas: ["defensa", "medios"],
    grupo: "centrales y medios",
    correcto: "En el balón largo uno disputa y dos se colocan a menos de 5 m de la caída; el rechace es nuestro",
    mejorable: "No hay nadie cerca de la caída o el rechace lo gana el rival",
    meta: 70,
    tarea: /segund|aere|directo|largo|juego real|partido/,
  },
  {
    encaja: /cerra(mos|r).*(ventaja|partido)|con ventaja|gestion del (marcador|partido)|uno mas|90\+/,
    objetivo: "Cerrar el partido con ventaja: posesiones largas y repliegue inmediato",
    lineas: ["defensa", "medios", "delanteros"],
    grupo: "todo el equipo",
    correcto: "Con ventaja, la posesión dura más de 15 s o acaba en falta, córner o saque a favor; tras pérdida, repliegue por dentro inmediato",
    mejorable: "Pérdida rápida en campo propio, balón largo sin apoyo o se concede un remate",
    meta: 70,
    tarea: /posesi|conserva|superioridad|juego real|partido/,
  },
  {
    encaja: /contraata|transicion|al robar|salimos (mas )?rapido/,
    objetivo: "Salir rápido al robar: primer pase adelante y tres atacando el espacio",
    lineas: ["medios", "delanteros"],
    grupo: "medios y delanteros",
    correcto: "Tras el robo, el primer pase va hacia delante en 3 s o menos y al menos tres jugadores atacan el espacio",
    mejorable: "Tras el robo, pase atrás o conducción lateral que deja reorganizarse al rival",
    meta: 70,
    tarea: /transici|contraata|ataque.?defensa|juego real/,
  },
  {
    encaja: /tras perdida|robamos arriba|presion(amos)? (alta|tras)|presionamos/,
    objetivo: "Presionar tras pérdida: el más cercano en 3 s y cerrar pases cerca",
    lineas: ["medios", "delanteros"],
    grupo: "los más cercanos al balón",
    correcto: "Tras la pérdida, el más cercano presiona al poseedor en 3 s o menos y los de alrededor cierran los pases cercanos",
    mejorable: "Nadie presiona en 3 s, o se presiona solo y el rival sale con un pase",
    meta: 70,
    tarea: /presi|perdida|rondo|posesi|juego real/,
  },
  {
    encaja: /espalda|al espacio|profundidad|ruptura/,
    objetivo: "Atacar la espalda: desmarque de ruptura en el momento del pase",
    lineas: ["medios", "delanteros"],
    grupo: "delanteros y llegadores",
    correcto: "Desmarque de ruptura a la espalda en el momento del pase, en línea y sin caer en fuera de juego",
    mejorable: "El desmarque llega tarde, cae en fuera de juego o se pide al pie con espacio a la espalda",
    meta: 70,
    tarea: /finaliza|ataque|profundidad|juego real/,
  },
  {
    encaja: /acabar en corner|corner(es)? a favor|entradas? al area|llegar al area|centros/,
    objetivo: "Acabar las jugadas en el área: remate, centro o córner a favor",
    lineas: ["medios", "delanteros"],
    grupo: "medios y delanteros",
    correcto: "La jugada acaba en remate, centro al área o córner a favor",
    mejorable: "La jugada muere antes del área con pérdida o pase atrás sin continuidad",
    meta: 65,
    tarea: /finaliza|centro|ataque|juego real/,
  },
];

export type Propuesta = Omit<ObjetivoEntreno, "id"> & {
  /** Las líneas propuestas (para enseñar «Defensa · Medios»). */
  lineas: Linea[];
  /** Cómo se llama ese grupo: «línea de marca». */
  grupo: string;
  /** Si salió de una plantilla del catálogo o se dejó para rellenar. */
  conPlantilla: boolean;
};

/**
 * El objetivo propuesto para una línea de «Qué toca». `texto` es la línea
 * entera («Cerramos los partidos con ventaja · nos marcaron en el 90+1′»):
 * la consigna va delante del « · », el dato detrás.
 */
export function propuestaDe(
  texto: string,
  origen: string,
  jugadores: { id: string; nombre: string; posicion?: string }[],
  tareas: { codigo: string; texto: string }[],
): Propuesta {
  const [consigna, ...dato] = texto.split(" · ");
  const t = sinTildes(texto);
  const p = PLANTILLAS.find((x) => x.encaja.test(t));
  const lineas = p?.lineas ?? [];
  const tarea = p ? tareas.find((x) => p.tarea.test(sinTildes(`${x.codigo} ${x.texto}`))) : undefined;

  return {
    objetivo: p?.objetivo ?? consigna.trim(),
    jugadores: jugadores.filter((j) => lineas.includes(lineaDe(j.posicion) as Linea)).map((j) => ({ id: j.id, nombre: j.nombre })),
    correcto: p?.correcto ?? "",
    mejorable: p?.mejorable ?? "",
    meta: p?.meta ?? 70,
    tarea: tarea?.codigo,
    tareaTexto: tarea?.texto,
    /* El dato del post viaja con el origen: es el porqué del objetivo. */
    origen: dato.length ? `${origen} · ${consigna.trim()} (${dato.join(" · ").trim()})` : `${origen} · ${consigna.trim()}`,
    lineas,
    grupo: p?.grupo ?? "",
    conPlantilla: Boolean(p),
  };
}
