"use client";

/**
 * MIS TAREAS, PARA CUALQUIER PIEZA DE LA APP (31/10/2026).
 *
 * Los dos documentos de la agenda (`lib/portada/mis-tareas.ts`) y los días con
 * sesión de la hoja de registro. Lo usan la pestaña «Mis tareas» de la portada
 * y el aviso de pendientes del layout; como pueden estar montados a la vez,
 * cada uno avisa al otro (`EVENTO_CAMBIO`) cuando lo suyo queda guardado, y
 * el otro relee: así no se pisan con una versión vieja.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { loadRegistro } from "@/lib/abp/registro";
import {
  CLAVE_HECHAS,
  CLAVE_PROPIAS,
  EVENTO_CAMBIO,
  HECHAS_VACIAS,
  KIND_AGENDA,
  PROPIAS_VACIAS,
  normalizaPropias,
  sesionesDeRegistro,
  type DocPropias,
  type Hechas,
} from "@/lib/portada/mis-tareas";

/* Una lectura de la hoja por pestaña: la portada y el aviso comparten esta. */
let sesionesEnCamino: Promise<Set<string> | null> | null = null;

function cargaSesiones() {
  sesionesEnCamino ??= loadRegistro()
    .then((r) => sesionesDeRegistro(r.tareas))
    .catch(() => {
      sesionesEnCamino = null;

      return null;
    });

  return sesionesEnCamino;
}

/**
 * Los días con sesión según la hoja de registro de tareas. `null` mientras
 * llega o si no llega (a los 12 s se deja de esperar): entonces la agenda
 * supone la semana de siempre.
 */
export function useSesionesDelMicro(activo = true) {
  const [sesiones, setSesiones] = useState<Set<string> | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!activo) return;

    let vivo = true;

    const reloj = setTimeout(() => vivo && setListo(true), 12_000);

    void cargaSesiones().then((s) => {
      clearTimeout(reloj);

      if (!vivo) return;

      setSesiones(s);
      setListo(true);
    });

    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [activo]);

  return { sesiones, listo };
}

export function useMisTareas() {
  const h = useRemoteDoc<Hechas>({ key: CLAVE_HECHAS, kind: KIND_AGENDA, fallback: HECHAS_VACIAS });
  const p = useRemoteDoc<DocPropias>({ key: CLAVE_PROPIAS, kind: KIND_AGENDA, fallback: PROPIAS_VACIAS });

  const doc = useMemo(() => normalizaPropias(p.value), [p.value]);

  const yo = useId();

  /* 0 nada; 1 cambiado por mí; 2 ya en la cola. Al quedar guardado, se avisa. */
  const avisar = useRef(0);

  const { reload: releeH } = h;
  const { reload: releeP } = p;

  useEffect(() => {
    const otro = (e: Event) => {
      if ((e as CustomEvent<string>).detail === yo) return;

      releeH();
      releeP();
    };

    window.addEventListener(EVENTO_CAMBIO, otro);

    return () => window.removeEventListener(EVENTO_CAMBIO, otro);
  }, [yo, releeH, releeP]);

  const pendiente = h.sinGuardar || p.sinGuardar;

  useEffect(() => {
    if (avisar.current === 1 && pendiente) avisar.current = 2;

    if (avisar.current === 2 && !pendiente) {
      avisar.current = 0;
      window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail: yo }));
    }
  }, [pendiente, yo]);

  const { setValue: ponHechas } = h;
  const { setValue: ponDoc } = p;

  const cambiaHechas = useCallback(
    (f: (actual: Hechas) => Hechas) => {
      avisar.current = 1;
      ponHechas((actual) => f(actual ?? HECHAS_VACIAS));
    },
    [ponHechas],
  );

  const cambiaDoc = useCallback(
    (f: (actual: DocPropias) => DocPropias) => {
      avisar.current = 1;
      ponDoc((actual) => f(normalizaPropias(actual)));
    },
    [ponDoc],
  );

  return {
    hechas: h.value ?? HECHAS_VACIAS,
    doc,
    cambiaHechas,
    cambiaDoc,
    cargando: h.status === "loading" || p.status === "loading",
    guardando: pendiente || h.status === "saving" || p.status === "saving",
    error: h.status === "error" || p.status === "error",
  };
}
