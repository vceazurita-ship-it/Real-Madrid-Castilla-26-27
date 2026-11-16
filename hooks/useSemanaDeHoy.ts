"use client";

/**
 * LA SEMANA DE HOY EN UN COMPONENTE (16/11/2026).
 *
 * La hoja de registro (la copia publicada, con lo planificado aunque no tenga
 * minutos), el calendario de BeSoccer y el día de hoy en Madrid, juntos y con
 * la regla de lib/microciclo/semana-de-hoy.ts. La usan /microcycles,
 * /micro_calendar, /calendar_general y /jugadores-sesion para abrir en la
 * misma semana, con los mismos MD y las mismas tareas.
 *
 * El registro se baja una vez por pestaña aunque lo pidan varias piezas.
 */

import { useEffect, useMemo, useState } from "react";

import { useCalendario } from "@/hooks/useCalendario";
import { loadRegistro, type RegistroTarea } from "@/lib/abp/registro";
import { fechaIsoDeHoja } from "@/lib/microciclo/cuenta";
import { fechasDePartido, semanaDeHoy, type SemanaDeHoy } from "@/lib/microciclo/semana-de-hoy";

let enCamino: Promise<RegistroTarea[]> | null = null;

/** El registro de tareas de la temporada en curso (la de la fecha más reciente). */
export function cargaRegistroDeLaTemporada(): Promise<RegistroTarea[]> {
  if (!enCamino) {
    enCamino = loadRegistro()
      .then(({ tareas }) => {
        const ultima = tareas.reduce<RegistroTarea | null>((m, t) => {
          const iso = fechaIsoDeHoja(t.fecha);

          return iso && (!m || iso > fechaIsoDeHoja(m.fecha)) ? t : m;
        }, null);

        return ultima?.temporada ? tareas.filter((t) => !t.temporada || t.temporada === ultima.temporada) : tareas;
      })
      .catch((e: unknown) => {
        enCamino = null;
        throw e;
      });
  }

  return enCamino;
}

/** Hoy en Madrid, «2026-11-16». Sólo en efectos o manejadores. */
function hoyEnMadrid() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}

export function useSemanaDeHoy() {
  const [registro, setRegistro] = useState<RegistroTarea[]>([]);
  const [hoy, setHoy] = useState("");
  const { partidos } = useCalendario();

  useEffect(() => {
    let vivo = true;
    const id = setTimeout(() => {
      if (vivo) setHoy(hoyEnMadrid());
    }, 0);

    cargaRegistroDeLaTemporada()
      .then((tareas) => {
        if (vivo) setRegistro(tareas);
      })
      .catch(() => {
        /* Sin hoja, cada pantalla sigue con lo suyo. */
      });

    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, []);

  const fechas = useMemo(() => fechasDePartido(partidos.map((p) => String(p?.cuando ?? ""))), [partidos]);

  const semana: SemanaDeHoy<RegistroTarea> | null = useMemo(
    () => (hoy && registro.length ? semanaDeHoy(registro, fechas, hoy) : null),
    [registro, fechas, hoy],
  );

  return { semana, registro, fechasDePartido: fechas, hoy };
}
