/*
|--------------------------------------------------------------------------
| EL TRABAJADOR DE SEGUNDO PLANO
|--------------------------------------------------------------------------
|
| Antes aquí vivía el que generaba `next-pwa`, y era el peor de los mundos:
| se quedó con la variante de desarrollo —la que enruta todo a `NetworkOnly`—,
| que **no guarda nada** y a cambio hace pasar por el trabajador *todas* las
| peticiones de la página. Con Turbopack ya ni se regeneraba al construir, así
| que el fichero llevaba desde mayo sin cambiar mientras los navegadores que lo
| tenían instalado seguían pagando el peaje en cada visita.
|
| Este está escrito a mano y solo hace dos cosas, las dos seguras:
|
| 1. `/_next/static/…` y las fuentes se sirven **de la caché primero**. Son
|    ficheros con la huella en el nombre: si el contenido cambia, cambia la
|    URL, así que no existe la copia rancia. Es lo que hace que la segunda
|    visita a una pantalla ya no baje su medio mega de JavaScript.
|
| 2. Las imágenes de `public/` —los campos, los escudos, los fondos— se sirven
|    de la caché **y se refrescan por detrás**. Se ven al instante y, si se
|    cambia el fichero, la visita siguiente ya trae la nueva.
|
| Todo lo demás (las páginas, `/api/…`, la hoja, Supabase, los vídeos) no se
| toca: sale del trabajador sin `respondWith` y viaja como siempre. Nada de lo
| que se guarda aquí es un dato del club, solo el envoltorio de la app.
*/

const VERSION = "castilla-v1";

const CACHE_ESTATICOS = `${VERSION}-estaticos`;
const CACHE_IMAGENES = `${VERSION}-imagenes`;

const MIAS = [CACHE_ESTATICOS, CACHE_IMAGENES];

const ES_IMAGEN = /\.(png|jpe?g|webp|avif|gif|svg|ico)$/i;

self.addEventListener("install", () => {
  /* No hay precarga: se guarda lo que se vaya pidiendo. */
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      /* Al subir de versión se tiran las cachés de la anterior. */
      const nombres = await caches.keys();

      await Promise.all(
        nombres.filter((n) => !MIAS.includes(n)).map((n) => caches.delete(n)),
      );

      await self.clients.claim();
    })(),
  );
});

/** ¿Se puede guardar esta respuesta? Nada de errores ni de opacas. */
function guardable(respuesta) {
  return Boolean(respuesta) && respuesta.status === 200 && respuesta.type === "basic";
}

/** De la caché si está; si no, de la red, y se queda guardada. */
async function cacheAntes(peticion, cache) {
  const guardada = await caches.match(peticion);

  if (guardada) return guardada;

  const respuesta = await fetch(peticion);

  if (guardable(respuesta)) {
    const copia = respuesta.clone();

    void caches.open(cache).then((c) => c.put(peticion, copia));
  }

  return respuesta;
}

/** Se pinta lo guardado y se pide la versión nueva para la próxima vez. */
async function cacheYRefresco(peticion, cache) {
  const guardada = await caches.match(peticion);

  const red = fetch(peticion)
    .then((respuesta) => {
      if (guardable(respuesta)) {
        const copia = respuesta.clone();

        void caches.open(cache).then((c) => c.put(peticion, copia));
      }

      return respuesta;
    })
    .catch(() => guardada);

  return guardada ?? red;
}

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;

  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);

  /* Solo lo que sirve esta misma app. Supabase, Google y los vídeos, fuera. */
  if (url.origin !== self.location.origin) return;

  /* Las rutas de servidor siempre van a la red: escriben y leen la hoja. */
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fuentes/")) {
    evento.respondWith(cacheAntes(peticion, CACHE_ESTATICOS));

    return;
  }

  /*
  | `/_next/image` es la foto ya redimensionada por Next: lleva la ruta y el
  | ancho en la propia URL, así que se guarda como cualquier otra imagen.
  */
  if (ES_IMAGEN.test(url.pathname) || url.pathname === "/_next/image") {
    evento.respondWith(cacheYRefresco(peticion, CACHE_IMAGENES));
  }
});
