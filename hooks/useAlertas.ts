"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { Alerta, ContactoAgenda } from "@/lib/alertas/modelo";

/**
 * Las tareas con alerta y la agenda de correos aprendidos.
 *
 * A diferencia del resto de pantallas, aquí no hay caché en `localStorage` ni
 * autoguardado: el calendario vive en la hoja, que es quien envía. Una copia
 * local que se editase sin llegar a la hoja daría una alarma que en pantalla
 * existe y en la realidad no suena nunca, que es el peor fallo posible en algo
 * cuyo único trabajo es acordarse por ti.
 *
 * La carga va dentro del efecto y `recargar()` solo mueve un contador, igual
 * que en `useRemoteDoc`: llamar desde el efecto a una función que hace
 * `setState` encadena renders y lo rechaza `react-hooks/set-state-in-effect`.
 */

interface Estado {
  alertas: Alerta[];
  agenda: ContactoAgenda[];
  cargando: boolean;
  /** El motor de envío no responde (falta instalar el Apps Script, o falló). */
  motorCaido: string | null;
}

const VACIO: Estado = {
  alertas: [],
  agenda: [],
  cargando: true,
  motorCaido: null,
};

export function useAlertas() {
  const [estado, setEstado] = useState<Estado>(VACIO);
  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/alertas", { cache: "no-store" })
      .then((respuesta) => respuesta.json())
      .then((cuerpo) => {
        if (cancelado) return;

        if (!cuerpo?.ok) throw new Error(cuerpo?.error ?? "Respuesta no válida");

        setEstado({
          alertas: Array.isArray(cuerpo.alertas) ? cuerpo.alertas : [],
          agenda: Array.isArray(cuerpo.agenda) ? cuerpo.agenda : [],
          cargando: false,
          motorCaido: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelado) return;

        console.error("[alertas] carga", error);

        setEstado({
          alertas: [],
          agenda: [],
          cargando: false,
          motorCaido:
            error instanceof Error ? error.message : "No responde la hoja",
        });
      });

    return () => {
      cancelado = true;
    };
  }, [testigo]);

  /**
   * Vuelve a leer la hoja.
   *
   * Se recarga en vez de fiarse de lo que se acaba de mandar porque la hoja
   * devuelve la agenda ya actualizada, y porque así lo que se ve en pantalla
   * es exactamente lo que va a sonar.
   */
  const recargar = useCallback(() => setTestigo((n) => n + 1), []);

  const guardar = useCallback(
    async (alerta: Alerta) => {
      try {
        const respuesta = await fetch("/api/alertas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alerta }),
        });

        const cuerpo = await respuesta.json();

        if (!cuerpo?.ok) throw new Error(cuerpo?.error ?? "No se pudo guardar");

        recargar();

        return true;
      } catch (error) {
        console.error("[alertas] guardar", error);

        toast.error("No se ha podido guardar la alerta", {
          description:
            error instanceof Error ? error.message : "La hoja no responde",
        });

        return false;
      }
    },
    [recargar],
  );

  const borrar = useCallback(
    async (id: string) => {
      try {
        const respuesta = await fetch(
          `/api/alertas?id=${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );

        const cuerpo = await respuesta.json();

        if (!cuerpo?.ok) throw new Error(cuerpo?.error ?? "No se pudo borrar");

        recargar();

        return true;
      } catch (error) {
        console.error("[alertas] borrar", error);

        toast.error("No se ha podido borrar la alerta", {
          description:
            error instanceof Error ? error.message : "La hoja no responde",
        });

        return false;
      }
    },
    [recargar],
  );

  const enviarAhora = useCallback(
    async (id: string) => {
      try {
        const respuesta = await fetch("/api/alertas/enviar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });

        const cuerpo = await respuesta.json();

        if (!cuerpo?.ok) throw new Error(cuerpo?.error ?? "No se pudo enviar");

        const enviados = Number(cuerpo.enviados) || 0;

        toast.success(
          enviados === 1 ? "Correo enviado" : `Correo enviado a ${enviados}`,
        );

        recargar();

        return true;
      } catch (error) {
        console.error("[alertas] enviar", error);

        toast.error("No se ha podido enviar", {
          description:
            error instanceof Error ? error.message : "La hoja no responde",
        });

        return false;
      }
    },
    [recargar],
  );

  return { ...estado, recargar, guardar, borrar, enviarAhora };
}
