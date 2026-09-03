"use client";

import { useEffect } from "react";

/**
 * Da de alta `public/sw.js`, que es quien guarda el envoltorio de la app.
 *
 * Lo hacía `next-pwa` metiendo su propio arranque en el bundle; con Turbopack
 * dejó de hacerlo —el trabajador seguía en `public/`, pero ya no lo registraba
 * nadie— y el que quedó instalado en los navegadores de mayo era la variante
 * de desarrollo, que no guarda nada. Registrarlo son cuatro líneas, así que se
 * hace aquí y se ve.
 *
 * **En desarrollo se hace lo contrario**: se desregistra y se vacían las
 * cachés. Los ficheros de `/_next/static/` en `next dev` repiten URL cuando
 * cambia el código, así que guardarlos serviría la pantalla de antes de la
 * última edición.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registros) => registros.forEach((r) => void r.unregister()))
        .catch(() => {});

      return;
    }

    /* Tras la carga: registrar compite con las peticiones de la pantalla. */
    const alta = () => {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[sw] no se ha podido registrar", error);
      });
    };

    if (document.readyState === "complete") {
      alta();

      return;
    }

    window.addEventListener("load", alta);

    return () => window.removeEventListener("load", alta);
  }, []);

  return null;
}
