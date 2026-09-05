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
| Éste está escrito a mano y hace cuatro cosas, en dos grupos.
|
| ## Lo que hace rápida la app (estaba desde el 03/09/2026)
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
| ## Lo que hace que funcione sin red (05/09/2026)
|
| 3. **Las pantallas.** Cada navegación se guarda al vuelo. Sin red se sirve
|    la última que se vio de esa dirección y, si de esa no hay ninguna, la
|    portada. Antes, sin cobertura, la app instalada no abría siquiera.
|
| 4. **Los datos.** Las lecturas de `/api/…`, las hojas publicadas de Google y
|    las fotos de Supabase se guardan según van llegando. La regla es siempre
|    **red primero**: mientras haya cobertura no se enseña nada viejo, y la
|    copia sólo entra en juego cuando la red falla.
|
| Es una caché de LECTURA. Guardar sigue necesitando red: lo que se escribe va
| a la hoja y a Supabase como siempre, y una petición que no sea `GET` no pasa
| por aquí. Escribir sin cobertura es otra tarea y no está hecha.
|
| ## Las dos reglas que no se pueden romper
|
| - **`fresco=1` nunca sale de la caché.** Es lo que pide una relectura que
|   comprueba un guardado (`lib/save-guard`): servir una copia diría que no se
|   ha escrito algo que sí está en la hoja. Va a la red o no va.
|
| - **Al cambiar lo que se guarda, sube `VERSION`.** Es lo único que tira las
|   cachés de la versión anterior en los navegadores que ya lo tienen puesto.
|
| Lo que sigue sin tocarse: los vídeos, YouTube, Power BI y cualquier `POST`.
*/

const VERSION = "castilla-v2";

const CACHE_ESTATICOS = `${VERSION}-estaticos`;
const CACHE_IMAGENES = `${VERSION}-imagenes`;
const CACHE_PAGINAS = `${VERSION}-paginas`;
const CACHE_DATOS = `${VERSION}-datos`;

const MIAS = [CACHE_ESTATICOS, CACHE_IMAGENES, CACHE_PAGINAS, CACHE_DATOS];

const ES_IMAGEN = /\.(png|jpe?g|webp|avif|gif|svg|ico)$/i;

/**
 * Dónde se anota cuándo se guardó el último dato bueno.
 *
 * No es una dirección de verdad: es una entrada inventada dentro de la caché
 * para que el aviso de «sin conexión» pueda decir de cuándo son los datos que
 * se están viendo. Sin fecha, el aviso sería inútil —lo peligroso no es estar
 * sin cobertura, es no saber si el once que miras es el de esta semana—.
 */
const SELLO = "/__castilla/ultimo-dato";

/**
 * Rutas de servidor que se pueden guardar: sólo las que leen.
 *
 * Es una lista blanca a propósito. Por aquí pasan también el vídeo del coding,
 * las subidas y los avisos, y ésas no tienen nada que hacer en una caché.
 */
const API_GUARDABLE = [
  "/api/rivals",
  "/api/docs",
  "/api/general-files",
  "/api/performance-files",
  "/api/general/load",
  "/api/performance/load",
  "/api/ratings/load",
  "/api/training-session",
  "/api/training-import/latest",
];

/** Las hojas publicadas de Google. Es de donde sale media plantilla. */
const HOJAS = "docs.google.com";

/** El almacén de fotos y documentos. */
const ES_SUPABASE = /\.supabase\.co$/;

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

/**
 * ¿Se puede guardar esta respuesta?
 *
 * Nada de errores. Y nada de respuestas **opacas**: las que vuelven de una
 * petición sin CORS traen `status` 0 y el cuerpo cerrado, así que guardarlas
 * sería guardar una caja vacía que luego se sirve como si fuera buena.
 */
function guardable(respuesta) {
  return (
    Boolean(respuesta) &&
    respuesta.status === 200 &&
    (respuesta.type === "basic" || respuesta.type === "cors")
  );
}

/** Anota la hora del último dato bueno, para el aviso de sin conexión. */
async function sella(cache) {
  const c = await caches.open(cache);

  await c.put(SELLO, new Response(new Date().toISOString()));
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

/**
 * Primero la red; la copia sólo si la red falla.
 *
 * Es la regla de todo lo que es un dato del club. Con cobertura nunca se
 * enseña nada viejo: se espera a la respuesta buena, y de paso se guarda. Sin
 * cobertura se sirve lo último que se llegó a ver, que es la diferencia entre
 * abrir la app en el campo o no abrirla.
 */
async function redAntes(peticion, cache, opciones = {}) {
  try {
    const respuesta = await fetch(peticion);

    if (guardable(respuesta)) {
      const copia = respuesta.clone();

      void caches.open(cache).then((c) => c.put(peticion, copia));

      if (opciones.sellar) void sella(cache);
    }

    return respuesta;
  } catch (error) {
    const guardada = await caches.match(peticion);

    if (guardada) return guardada;

    /* Una pantalla que no se ha visitado nunca: se abre la portada, que casi
       seguro sí está, y desde ahí se navega a lo que haya guardado. */
    if (opciones.respaldo) {
      const portada = await caches.match(opciones.respaldo);

      if (portada) return portada;
    }

    throw error;
  }
}

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;

  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);

  /* ---------------------------- LO DE FUERA ---------------------------- */

  if (url.origin !== self.location.origin) {
    /* Las hojas publicadas: el dato manda, así que red primero. */
    if (url.hostname === HOJAS) {
      evento.respondWith(redAntes(peticion, CACHE_DATOS, { sellar: true }));

      return;
    }

    /* Supabase: las fotos y los documentos que ya se han mirado. */
    if (ES_SUPABASE.test(url.hostname)) {
      evento.respondWith(
        ES_IMAGEN.test(url.pathname)
          ? cacheYRefresco(peticion, CACHE_IMAGENES)
          : redAntes(peticion, CACHE_DATOS, { sellar: true }),
      );
    }

    /* Todo lo demás de fuera —vídeos, YouTube, Power BI— sale sin tocar. */
    return;
  }

  /* ---------------------------- LO DE CASA ----------------------------- */

  /*
  | Una relectura que comprueba un guardado no puede ver una copia. Va a la
  | red o no va: ver `lib/save-guard`.
  */
  if (url.searchParams.get("fresco") === "1") return;

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fuentes/")
  ) {
    evento.respondWith(cacheAntes(peticion, CACHE_ESTATICOS));

    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (API_GUARDABLE.some((ruta) => url.pathname.startsWith(ruta))) {
      evento.respondWith(redAntes(peticion, CACHE_DATOS, { sellar: true }));
    }

    /* El resto de rutas de servidor —vídeo, subidas, avisos— sin tocar. */
    return;
  }

  /*
  | `/_next/image` es la foto ya redimensionada por Next: lleva la ruta y el
  | ancho en la propia URL, así que se guarda como cualquier otra imagen.
  */
  if (ES_IMAGEN.test(url.pathname) || url.pathname === "/_next/image") {
    evento.respondWith(cacheYRefresco(peticion, CACHE_IMAGENES));

    return;
  }

  /*
  | Las pantallas.
  |
  | Sólo las navegaciones de verdad, no las peticiones que el router hace por
  | detrás para pintar una pantalla sin recargar: si a ésas se les contesta
  | con el HTML de una página, el router se rompe. Cuando fallan, Next hace
  | una navegación entera, y ésa sí la servimos de la caché.
  */
  if (peticion.mode === "navigate") {
    evento.respondWith(
      redAntes(peticion, CACHE_PAGINAS, { respaldo: "/" }),
    );
  }
});
