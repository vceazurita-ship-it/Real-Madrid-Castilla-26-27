"use client";

/**
 * EL LABORATORIO DE ABP, DESDE LA PANTALLA.
 *
 * Calcado de `useApuestasDoc`: no se guarda el documento entero, se mandan
 * acciones a `/api/abp-lab/guardar` y se pinta lo que devuelve el servidor.
 * Una lectura que salió antes de un guardado vuelve con lo viejo y se tira.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { LAB_VACIO, type DocumentoLab } from "@/lib/abp-lab/modelo";

type Estado = "cargando" | "listo" | "guardando" | "error";

export function useAbpLab() {
  const [doc, setDoc] = useState<DocumentoLab>(LAB_VACIO);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [testigo, setTestigo] = useState(0);

  const guardados = useRef(0);

  useEffect(() => {
    let cancelado = false;

    const alSalir = guardados.current;

    fetch("/api/abp-lab/leer", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; doc?: DocumentoLab | null }>)
      .then((datos) => {
        if (cancelado || guardados.current !== alSalir) return;

        if (!datos.ok) throw new Error("No se ha podido leer el laboratorio.");

        setDoc(datos.doc ?? LAB_VACIO);
        setEstado("listo");
      })
      .catch((error) => {
        if (cancelado) return;

        console.error("[abp-lab] leer", error);
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
      const respuesta = await fetch("/api/abp-lab/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });

      const datos = (await respuesta.json().catch(() => null)) as { ok?: boolean; doc?: DocumentoLab; error?: string } | null;

      if (!respuesta.ok || !datos?.ok || !datos.doc) throw new Error(datos?.error ?? `HTTP ${respuesta.status}`);

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

export type GuardaLab = ReturnType<typeof useAbpLab>["guarda"];
