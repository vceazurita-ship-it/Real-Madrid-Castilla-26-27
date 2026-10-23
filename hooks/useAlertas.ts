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
  /**
   * La lista no llegó: la hoja tardó más de la cuenta o no hay red. Distinto
   * de `motorCaido` (el servidor contestó, pero con un error): aquí lo que
   * toca es volver a pedirla, no instalar nada.
   */
  fallo: string | null;
  /**
   * ¿Hay disparador horario en la hoja?
   *
   * `false` es el estado traicionero del montaje: la hoja contesta, guarda y
   * lista sin una queja, y hasta manda un «enviar ahora» —eso lo dispara la
   * propia petición—, pero **nadie repasa el calendario**, así que ninguna
   * alarma programada suena nunca. Sin este dato la pantalla no tenía forma de
   * distinguirlo de todo en orden. `null` es «no se sabe» (una hoja con el
   * archivo antiguo, o sin permiso para mirar los disparadores).
   */
  disparador: boolean | null;
}

const VACIO: Estado = {
  alertas: [],
  agenda: [],
  cargando: true,
  motorCaido: null,
  fallo: null,
  disparador: null,
};

/* Apps Script en frío tarda 30-70 s: pasados 15 s se deja de esperar y se
   ofrece reintentar, en vez de un «Cargando…» sin final. */
const TOPE_DE_ESPERA_MS = 15_000;

export function useAlertas() {
  const [estado, setEstado] = useState<Estado>(VACIO);
  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    let cancelado = false;

    /*
    | La primera vez vale la copia del servidor —así la pantalla se abre al
    | instante en vez de esperar a que Apps Script despierte—; después de
    | guardar o borrar se pide fresco, que ahí lo que importa es ver lo que se
    | acaba de escribir.
    */
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TOPE_DE_ESPERA_MS);

    fetch(testigo > 0 ? "/api/alertas?fresco=1" : "/api/alertas", {
      cache: "no-store",
      signal: control.signal,
    })
      .then((respuesta) => respuesta.json())
      .then((cuerpo) => {
        if (cancelado) return;

        if (!cuerpo?.ok) throw new Error(cuerpo?.error ?? "Respuesta no válida");

        setEstado({
          alertas: Array.isArray(cuerpo.alertas) ? cuerpo.alertas : [],
          agenda: Array.isArray(cuerpo.agenda) ? cuerpo.agenda : [],
          cargando: false,
          motorCaido: null,
          fallo: null,
          disparador:
            typeof cuerpo.disparador === "boolean" ? cuerpo.disparador : null,
        });
      })
      .catch((error: unknown) => {
        if (cancelado) return;

        console.error("[alertas] carga", error);

        /* Sin respuesta a tiempo (o sin red): se puede reintentar. */
        const sinRespuesta =
          (error instanceof DOMException && error.name === "AbortError") ||
          error instanceof TypeError;

        setEstado({
          alertas: [],
          agenda: [],
          cargando: false,
          motorCaido: sinRespuesta
            ? null
            : error instanceof Error
              ? error.message
              : "No responde la hoja",
          fallo: sinRespuesta ? "La hoja tarda demasiado en contestar." : null,
          disparador: null,
        });
      })
      .finally(() => clearTimeout(reloj));

    return () => {
      cancelado = true;
      clearTimeout(reloj);
      control.abort();
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

  /** Tras un fallo de carga: vuelve a «cargando» y lo pide otra vez. */
  const reintentar = useCallback(() => {
    setEstado((e) => ({ ...e, cargando: true, fallo: null }));
    setTestigo((n) => n + 1);
  }, []);

  return { ...estado, recargar, reintentar, guardar, borrar, enviarAhora };
}
