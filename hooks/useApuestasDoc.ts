"use client";

/**
 * LAS APUESTAS DEL STAFF, DESDE LA PANTALLA.
 *
 * Calcado de `useQuinielaDoc` y por las mismas razones: no se guarda el
 * documento entero, se mandan **acciones** a `/api/apuestas/guardar` y se
 * pinta lo que devuelve el servidor, que es el documento ya fundido con lo
 * que hayan hecho los demás. `useRemoteDoc` no vale aquí: su cola de
 * reintentos escribiría una copia vieja encima de las posturas de otros.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { APUESTAS_VACIAS, type DocumentoApuestas } from "@/lib/apuestas/modelo";

type Estado = "cargando" | "listo" | "guardando" | "error";

export function useApuestasDoc() {
  const [doc, setDoc] = useState<DocumentoApuestas>(APUESTAS_VACIAS);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [testigo, setTestigo] = useState(0);

  /* Una lectura que salió antes de un guardado vuelve con lo viejo: se tira. */
  const guardados = useRef(0);

  useEffect(() => {
    let cancelado = false;

    const alSalir = guardados.current;

    fetch("/api/apuestas/leer", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; doc?: DocumentoApuestas | null }>)
      .then((datos) => {
        if (cancelado || guardados.current !== alSalir) return;

        if (!datos.ok) throw new Error("No se han podido leer las apuestas.");

        setDoc(datos.doc ?? APUESTAS_VACIAS);
        setEstado("listo");
      })
      .catch((error) => {
        if (cancelado) return;

        console.error("[apuestas] leer", error);
        setEstado("error");
      });

    return () => {
      cancelado = true;
    };
  }, [testigo]);

  const recarga = useCallback(() => setTestigo((n) => n + 1), []);

  /** Manda una acción; lanza con el mensaje del servidor si no se puede. */
  const guarda = useCallback(async (cuerpo: Record<string, unknown>) => {
    guardados.current += 1;

    setEstado("guardando");

    try {
      const respuesta = await fetch("/api/apuestas/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });

      const datos = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        doc?: DocumentoApuestas;
        error?: string;
      } | null;

      if (!respuesta.ok || !datos?.ok || !datos.doc) {
        throw new Error(datos?.error ?? `HTTP ${respuesta.status}`);
      }

      setDoc(datos.doc);
      setEstado("listo");

      return datos.doc;
    } catch (error) {
      setEstado("listo");

      throw error;
    } finally {
      guardados.current += 1;
    }
  }, []);

  return { doc, estado, guarda, recarga };
}
