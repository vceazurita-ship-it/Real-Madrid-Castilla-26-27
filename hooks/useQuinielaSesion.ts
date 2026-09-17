"use client";

/**
 * QUIÉN HA ENTRADO EN LA QUINIELA.
 *
 * La cookie es `httpOnly` —el JavaScript no la puede leer— así que quién eres
 * se le pregunta al servidor. Es una petición al abrir la página y nada más:
 * mientras contesta, `cargando` deja la pantalla en blanco en vez de enseñar
 * el formulario de acceso medio segundo a quien ya había entrado.
 */

import { useCallback, useEffect, useState } from "react";

export type Yo = {
  slug: string;
  correo: string;
  nombre: string;
  /** Si todavía tiene la contraseña con la que se registró. */
  inicial: boolean;
};

type Respuesta = { ok?: boolean; yo?: Yo | null; error?: string };

export function useQuinielaSesion() {
  const [yo, setYo] = useState<Yo | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const control = new AbortController();

    fetch("/api/quiniela/cuenta", {
      cache: "no-store",
      signal: control.signal,
    })
      .then((r) => r.json() as Promise<Respuesta>)
      .then((datos) => {
        setYo(datos.yo ?? null);
        setCargando(false);
      })
      .catch((error) => {
        if (control.signal.aborted) return;

        console.error("[quiniela] no se ha podido saber quién eres", error);
        setCargando(false);
      });

    return () => control.abort();
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

    if (cuerpo.accion === "salir") setYo(null);
    else if (datos.yo) setYo(datos.yo);

    return datos;
  }, []);

  return { yo, cargando, manda };
}
