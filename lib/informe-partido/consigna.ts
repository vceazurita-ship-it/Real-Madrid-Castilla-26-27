/*
| La consigna principal del post (26/10/2026, ronda 8, guionista y fútbol):
| UNA, la misma en la diapositiva 3, el WhatsApp, el asunto y el cierre de los
| dos vídeos. Es lo primero de «Qué toca en el microciclo» (`queTocaEnElMicro`
| la pone delante: la que contesta al giro del titular), partida en la
| consigna y su dato. Sin dependencias: la usan el modelo y el guion del vídeo.
*/

export type ConsignaPrincipal = { consigna: string; dato: string };

/** «Cerramos los partidos con ventaja · nos marcaron en el 90+1′…» → { consigna, dato }. */
export function consignaPrincipal(microciclo: readonly string[] | undefined | null): ConsignaPrincipal | null {
  const [consigna, ...resto] = (microciclo?.[0] ?? "").split(" · ");

  const limpia = consigna?.trim() ?? "";

  return limpia ? { consigna: limpia, dato: resto.join(" · ").trim() } : null;
}
