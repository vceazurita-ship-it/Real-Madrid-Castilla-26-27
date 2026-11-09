/**
 * EL ORIGEN PÚBLICO DE UNA PETICIÓN (09/11/2026).
 *
 * En Render, `request.url` NO es la dirección que ve el navegador: el
 * servidor escucha detrás del proxy en `localhost:10000` y Next arma la URL
 * con eso. Así, Google recibía `https://localhost:10000/api/youtube/callback`
 * como vuelta y contestaba `redirect_uri_mismatch` al reconectar YouTube.
 *
 * Aquí se toma el host y el protocolo que manda el proxy (`x-forwarded-*`,
 * y si no `host`), que es lo que el navegador tiene en la barra. En local,
 * sin proxy, sale lo mismo que `request.url`.
 *
 * Úsalo para cualquier URL absoluta que salga hacia fuera: redirecciones,
 * vueltas de OAuth, `og:url`.
 */
export function origenPublico(peticion: Request) {
  const interna = new URL(peticion.url);
  const h = peticion.headers;

  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? interna.host).split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? interna.protocol.replace(":", "")).split(",")[0].trim();

  return `${proto}://${host}`;
}

/** `new URL(ruta, request.url)`, pero con el origen público. */
export function urlPublica(ruta: string, peticion: Request) {
  return new URL(ruta, origenPublico(peticion));
}
