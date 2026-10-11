"use client";

/**
 * QUIÉN HA ENTRADO EN LA QUINIELA.
 *
 * La cookie es `httpOnly` —el JavaScript no la puede leer— así que quién eres
 * se le pregunta al servidor. Mientras contesta, `cargando` deja la pantalla
 * en blanco en vez de enseñar el formulario de acceso medio segundo a quien
 * ya había entrado.
 *
 * LA RESPUESTA SE GUARDA FUERA DEL COMPONENTE (11/10/2026).
 *
 * No sólo la quiniela pregunta aquí: el menú lateral también, para saber si
 * enseña Ajustes, y el menú se monta de nuevo en cada pantalla. Antes eso era
 * una petición a `/api/quiniela/cuenta` por cada cambio de página. Ahora quién
 * eres vive en el módulo: un menú recién montado lo pinta en el acto y sólo
 * se vuelve a preguntar si la respuesta es de hace más de un minuto. Entrar,
 * registrarse o salir pasa por `manda`, que ya trae la respuesta nueva y la
 * reparte a todos los que estén escuchando.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Yo = {
  slug: string;
  correo: string;
  nombre: string;
  /** Si todavía tiene la contraseña con la que se registró. */
  inicial: boolean;
};

type Respuesta = { ok?: boolean; yo?: Yo | null; error?: string };

/** Cuánto vale la última respuesta antes de volver a preguntar. */
const FRESCURA_MS = 60_000;

/* ------------------------------------------------------------------ */
/*  EL ALMACÉN COMPARTIDO                                              */
/* ------------------------------------------------------------------ */

type Estado = { yo: Yo | null; cargando: boolean };

/* Un solo objeto que se sustituye entero: `useSyncExternalStore` compara por
   referencia, así que si no cambia nada no se vuelve a pintar nada. */
let estado: Estado = { yo: null, cargando: true };

/** `0` = todavía no se ha preguntado nunca. */
let leidoEn = 0;

let enVuelo: Promise<void> | null = null;

const oyentes = new Set<() => void>();

function suscribe(avisa: () => void) {
  oyentes.add(avisa);

  return () => {
    oyentes.delete(avisa);
  };
}

const lee = () => estado;

/* En el servidor no hay cookie: se está cargando. */
const EN_SERVIDOR: Estado = { yo: null, cargando: true };
const leeEnServidor = () => EN_SERVIDOR;

function pon(yo: Yo | null) {
  if (!estado.cargando && estado.yo === yo) return;

  estado = { yo, cargando: false };
  oyentes.forEach((avisa) => avisa());
}

/** Pregunta al servidor si hace falta; con `forzar`, siempre. */
function revalida(forzar = false) {
  if (!forzar) {
    if (enVuelo) return enVuelo;
    if (leidoEn && Date.now() - leidoEn < FRESCURA_MS) return Promise.resolve();
  }

  const esta = fetch("/api/quiniela/cuenta", { cache: "no-store" })
    .then((r) => r.json() as Promise<Respuesta>)
    .then((datos) => {
      if (enVuelo !== esta) return;

      leidoEn = Date.now();
      pon(datos.yo ?? null);
    })
    .catch((error) => {
      if (enVuelo !== esta) return;

      console.error("[quiniela] no se ha podido saber quién eres", error);

      /* Se deja de cargar con lo que hubiera: la pantalla no se queda en
         blanco por un fallo de red, y a la siguiente se vuelve a preguntar. */
      leidoEn = 0;
      pon(estado.yo);
    })
    .finally(() => {
      if (enVuelo === esta) enVuelo = null;
    });

  enVuelo = esta;

  return esta;
}

/* ------------------------------------------------------------------ */
/*  EL HOOK                                                            */
/* ------------------------------------------------------------------ */

export function useQuinielaSesion() {
  const { yo, cargando } = useSyncExternalStore(suscribe, lee, leeEnServidor);

  useEffect(() => {
    revalida();
  }, []);

  /** Manda una acción a la ruta de cuentas y actualiza quién eres. */
  const manda = useCallback(async (cuerpo: Record<string, unknown>) => {
    const respuesta = await fetch("/api/quiniela/cuenta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    const datos = (await respuesta.json().catch(() => null)) as Respuesta | null;

    if (!respuesta.ok || !datos?.ok) {
      throw new Error(datos?.error ?? `HTTP ${respuesta.status}`);
    }

    /* La respuesta del servidor es la verdad más fresca que hay: vale para
       todos los que escuchan, y se descarta cualquier petición en vuelo. */
    if (cuerpo.accion === "salir") {
      enVuelo = null;
      leidoEn = Date.now();
      pon(null);
    } else if (datos.yo) {
      enVuelo = null;
      leidoEn = Date.now();
      pon(datos.yo);
    }

    return datos;
  }, []);

  return { yo, cargando, manda };
}
