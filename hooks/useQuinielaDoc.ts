"use client";

/**
 * EL DOCUMENTO DE LA QUINIELA, DESDE LA PANTALLA.
 *
 * No usa `useRemoteDoc` a propósito. Aquél guarda **el documento entero** cada
 * vez que algo cambia, y con cola de reintentos en `localStorage`: justo lo que
 * la quiniela no puede tener, porque una copia vieja reintentada pisaría las
 * apuestas de los demás y saltaría el cierre del viernes. Aquí se lee por
 * `/api/docs` y se escribe **por acciones** en `/api/quiniela/guardar`, que
 * devuelve el documento ya fundido y es el que se pinta.
 *
 * La forma del efecto —el `fetch` dentro, con `cancelado` y un testigo para
 * recargar— es la que acepta el linter de pureza de React.
 */

import { useCallback, useEffect, useState } from "react";

import { sinCastilla } from "@/lib/quiniela/migracion";
import { QUINIELA_VACIA, type DocumentoQuiniela } from "@/lib/quiniela/modelo";

type Estado = "cargando" | "listo" | "guardando" | "error";

export function useQuinielaDoc() {
  const [doc, setDoc] = useState<DocumentoQuiniela>(QUINIELA_VACIA);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    let cancelado = false;

    /*
    | Se lee por `/api/quiniela/leer` y no por `/api/docs`.
    |
    | Esa ruta sirve el documento entero, y con él la apuesta de los demás
    | **antes** de que se cierre la jornada. La de aquí sólo manda la de quien
    | pregunta hasta el viernes a las 12:00, y a partir de ahí, la de todos.
    */
    fetch("/api/quiniela/leer", { cache: "no-store" })
      .then((r) => r.json() as Promise<{
        ok?: boolean;
        doc?: DocumentoQuiniela | null;
        updatedAt?: string | null;
      }>)
      .then((datos) => {
        if (cancelado) return;

        if (!datos.ok) throw new Error("No se ha podido leer la quiniela.");

        /* Lo guardado con el calendario de diez, ya en el de nueve. */
        setDoc(
          sinCastilla({
            ...QUINIELA_VACIA,
            ...(datos.doc ?? {}),
            jornadas: datos.doc?.jornadas ?? {},
            jugadores: datos.doc?.jugadores ?? [],
          }),
        );
        setGuardadoEn(datos.updatedAt ?? null);
        setEstado("listo");
      })
      .catch((error) => {
        if (cancelado) return;

        console.error("[quiniela] leer", error);
        setEstado("error");
      });

    return () => {
      cancelado = true;
    };
  }, [testigo]);

  const recarga = useCallback(() => setTestigo((n) => n + 1), []);

  /**
   * Manda una acción y pinta lo que devuelve el servidor.
   *
   * Lanza el error con el mensaje del servidor para que quien llama decida qué
   * enseñar: «la jornada ya se cerró» no es lo mismo que «no hay red».
   */
  const guarda = useCallback(async (cuerpo: Record<string, unknown>) => {
    setEstado("guardando");

    try {
      const respuesta = await fetch("/api/quiniela/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });

      const datos = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        doc?: DocumentoQuiniela;
        error?: string;
      } | null;

      if (!respuesta.ok || !datos?.ok || !datos.doc) {
        throw new Error(datos?.error ?? `HTTP ${respuesta.status}`);
      }

      setDoc(datos.doc);
      setGuardadoEn(new Date().toISOString());
      setEstado("listo");

      return datos.doc;
    } catch (error) {
      setEstado("listo");

      throw error;
    }
  }, []);

  return { doc, estado, guardadoEn, guarda, recarga };
}

/**
 * La hora de ahora, refrescada cada medio minuto.
 *
 * Hace falta en estado y no en el render: el cierre del viernes tiene que
 * pasar solo con la página abierta, y `new Date()` en el cuerpo de un
 * componente lo tumba el linter de pureza.
 */
export function useAhora(cadaMs = 30_000) {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(new Date()), cadaMs);

    return () => window.clearInterval(reloj);
  }, [cadaMs]);

  return ahora;
}
