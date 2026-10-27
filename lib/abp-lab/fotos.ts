/**
 * Las fotos de los jugadores leídas como `data:` (24/10/2026). Un SVG que se
 * pinta como imagen no carga nada de fuera: sin esto, al exportar la pizarra
 * (o el vídeo de un jugador) las caras salen vacías. Las de otro dominio pasan
 * por el proxy de fotos. Se leen una vez por sesión.
 */

const leidas = new Map<string, Promise<string | null>>();

export function leeFoto(url: string) {
  let p = leidas.get(url);

  if (!p) {
    const ruta = url.startsWith("/") || url.startsWith("data:") ? url : `/api/rivals/foto?url=${encodeURIComponent(url)}`;

    p = fetch(ruta)
      .then((r) => (r.ok ? r.blob() : null))
      .then(
        (blob) =>
          blob &&
          new Promise<string | null>((listo) => {
            const lector = new FileReader();

            lector.onload = () => listo(typeof lector.result === "string" ? lector.result : null);
            lector.onerror = () => listo(null);
            lector.readAsDataURL(blob);
          }),
      )
      .catch(() => null);

    leidas.set(url, p);
  }

  return p;
}
