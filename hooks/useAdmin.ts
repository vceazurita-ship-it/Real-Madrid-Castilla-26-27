"use client";

/**
 * ¿Hay sesión de administrador? (la puerta de Ajustes, `lib/admin/sesion.ts`).
 *
 * La cookie es `httpOnly`, así que el navegador no la puede leer: se pregunta
 * a `/api/admin`. Mientras pregunta, `admin` es `null` (ni sí ni no), para no
 * enseñar un formulario de entrada a quien ya está dentro.
 */

import { useCallback, useEffect, useState } from "react";

/** Avisa a los demás sitios de la página (el menú) de que ha cambiado. */
const EVENTO = "rmcf-admin";

export function useAdmin() {
  const [admin, setAdmin] = useState<boolean | null>(null);

  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/admin", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ admin?: boolean }>)
      .then((datos) => {
        if (!cancelado) setAdmin(Boolean(datos.admin));
      })
      .catch(() => {
        if (!cancelado) setAdmin(false);
      });

    return () => {
      cancelado = true;
    };
  }, [testigo]);

  useEffect(() => {
    const recarga = () => setTestigo((n) => n + 1);

    window.addEventListener(EVENTO, recarga);

    return () => window.removeEventListener(EVENTO, recarga);
  }, []);

  const entra = useCallback(async (email: string, contrasena: string) => {
    const respuesta = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, contrasena }),
    });

    const datos = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    if (!respuesta.ok || !datos.ok) throw new Error(datos.error ?? "No se ha podido entrar.");

    window.dispatchEvent(new Event(EVENTO));
  }, []);

  const sale = useCallback(async () => {
    await fetch("/api/admin", { method: "DELETE" }).catch(() => undefined);

    window.dispatchEvent(new Event(EVENTO));
  }, []);

  return { admin, entra, sale };
}
