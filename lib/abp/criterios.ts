/**
 * CRITERIOS DE ÉXITO DE UNA TAREA DE BALÓN PARADO (21/10/2026).
 *
 * Lo que el entrenador mira en el campo para dar una tarea por buena, por
 * aspecto y por lado. Es el punto de partida que propone el boceto y que el
 * diálogo de la tarea ofrece de un toque; se reescribe a mano para la rutina
 * concreta («el 5 bloquea al central que marca al 9»).
 *
 * Son comportamientos observables, no resultados: que se marque gol no dice si
 * la rutina salió.
 */

import type { AbpLado, AspectoKey, AbpMedio } from "@/lib/abp/microciclo";

const CRITERIOS: Partial<Record<AspectoKey, Record<AbpLado, string>>> = {
  "corner-directo": {
    ofensivo: "Cada rematador ataca su zona (primer palo, punto de penalti, segundo palo) y llega al balón en carrera, no esperándolo.",
    defensivo: "Ganamos el primer contacto en la zona y nadie del rival remata sin oposición.",
  },
  "corner-indirecto": {
    ofensivo: "La jugada corta llega al centro o al remate en tres pases como mucho, sin perder la ventaja del primer pase.",
    defensivo: "Salimos a la jugada corta con dos jugadores y el área no se queda en inferioridad.",
  },
  "falta-lateral-directa": {
    ofensivo: "El balón cae entre el portero y la línea defensiva y llegamos a rematar antes que su defensa.",
    defensivo: "La línea sale a tiempo, deja al rival en fuera de juego o lo saca del área, y nadie remata solo.",
  },
  "falta-lateral-indirecta": {
    ofensivo: "La segunda acción engaña a la línea: el rematador llega libre o el centro sale sin presión.",
    defensivo: "Seguimos al jugador que recibe el pase corto sin romper la línea.",
  },
  "falta-directa-porteria": {
    ofensivo: "El lanzador elige y ejecuta con la barrera y el portero leídos; hay alguien atento al rechace.",
    defensivo: "La barrera está bien colocada y a tiempo, y el rechace es nuestro.",
  },
  penalti: {
    ofensivo: "El lanzador tiene decidido el lado antes de coger el balón y los demás entran al rechace.",
    defensivo: "El portero tiene su lectura del lanzador y entramos al rechace antes que ellos.",
  },
  "banda-z1": {
    ofensivo: "Salimos jugando de nuestro campo sin perderla y con un apoyo libre en corto.",
    defensivo: "Presionamos el saque sin dejar un apoyo libre a la espalda.",
  },
  "banda-z2": {
    ofensivo: "El saque encuentra a un compañero de cara o de espaldas con apoyo y la jugada sigue hacia delante.",
    defensivo: "Cerramos el apoyo corto y recuperamos o los obligamos a jugar hacia atrás.",
  },
  "banda-z3": {
    ofensivo: "El saque llega al área o a la frontal con gente para el segundo balón.",
    defensivo: "Defendemos el saque largo como un córner: primer contacto y segundo balón nuestros.",
  },
  "saque-medio": {
    ofensivo: "Llegamos al campo rival con el balón o lo dejamos donde se puede presionar.",
    defensivo: "Presionamos su saque de medio ordenados y sin que lleguen a nuestra área.",
  },
  "reinicio-porteria": {
    ofensivo: "El primer pase del portero encuentra a un compañero libre o el balón largo cae donde tenemos el segundo balón.",
    defensivo: "Su saque de puerta no supera nuestra primera línea sin presión.",
  },
  "libre-indirecto-area": {
    ofensivo: "El toque previo y el disparo salen a la primera, antes de que la barrera salga.",
    defensivo: "La barrera sale a la vez al primer toque y el portero ve el balón.",
  },
};

/** El criterio de partida para una tarea, si hay uno. */
export function criterioDe(aspectos: AspectoKey[], lados: AbpLado[], medio: AbpMedio = "campo"): string {
  if (medio === "video") {
    return "Cada jugador sabe su sitio, su marca y qué hace el rival en la jugada, y lo dice sin mirar el vídeo.";
  }

  const lado = lados[0] ?? "ofensivo";

  for (const aspecto of aspectos) {
    const suyo = CRITERIOS[aspecto]?.[lado];

    if (suyo) return suyo;
  }

  return "";
}

/** El del ensayo del día antes: repasar, no enseñar. */
export const CRITERIO_ENSAYO = "Cada uno va a su sitio a la primera y sin preguntar; nada nuevo.";
