"use client";

/**
 * LOS APUNTES DE ABP DE UN RIVAL (16/10/2026).
 *
 * Tres cuadernos para preparar la jornada contra un rival, cada uno con su
 * vídeo: lo del rival, nuestro partido anterior y nuestro partido contra él
 * (cuando ya se ha jugado). Lo del rival vive en `rival-apuntes:<equipo>`
 * por jornada; lo nuestro en `abp-propio:jNN`, así el post de una jornada es
 * el «partido anterior» de la siguiente sin escribirlo dos veces.
 */

import { useState } from "react";

import { CuadernoApuntes } from "@/components/abp/apuntes/CuadernoApuntes";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  APUNTES_KIND,
  APUNTES_RIVAL_VACIO,
  CUADERNO_VACIO,
  apuntesPropiosKey,
  apuntesRivalKey,
  normalizaCuaderno,
  type ApuntesRivalDoc,
  type Cuaderno,
} from "@/lib/abp/apuntes";

const numeroDe = (jornada: string) => Number(jornada.match(/\d+/)?.[0] ?? 0) || 0;

function CuadernoPropio({ jornada, titulo, subtitulo }: { jornada: number; titulo: string; subtitulo: string }) {
  const { value, setValue } = useRemoteDoc<Cuaderno>({ key: apuntesPropiosKey(jornada), kind: APUNTES_KIND, fallback: CUADERNO_VACIO });

  return (
    <CuadernoApuntes
      titulo={titulo}
      subtitulo={subtitulo}
      deQuien="propio"
      valor={normalizaCuaderno(value)}
      onCambia={(f) => setValue((actual) => f(normalizaCuaderno(actual)))}
      equipoCarpeta="real-madrid-castilla"
    />
  );
}

export function ApuntesAbp({ equipo, jornadaPartido }: { equipo: string; /** «J7»: la jornada en que jugamos contra él (del calendario). */ jornadaPartido: string | null }) {
  const [jornada, setJornada] = useState(jornadaPartido ?? "");
  const { value, setValue } = useRemoteDoc<ApuntesRivalDoc>({ key: apuntesRivalKey(equipo), kind: APUNTES_KIND, fallback: APUNTES_RIVAL_VACIO });

  const n = numeroDe(jornada);
  const clave = n ? `J${n}` : "";
  const cuadernoRival = normalizaCuaderno(value?.jornadas?.[clave]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
        <span>Jornada contra {equipo}:</span>
        <input
          value={jornada}
          onChange={(e) => setJornada(e.target.value)}
          placeholder="J7"
          aria-label="Jornada"
          className="w-16 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-sm text-white"
        />
        {jornadaPartido && jornada !== jornadaPartido ? (
          <button type="button" onClick={() => setJornada(jornadaPartido)} className="text-xs text-[#C8A96B] hover:underline">
            volver a la del calendario ({jornadaPartido})
          </button>
        ) : null}
        <span className="text-xs text-white/35">Se guardan solos y entran en el informe de ABP de esa semana.</span>
      </div>

      {!n ? (
        <p className="text-sm text-white/45">Escribe la jornada en que jugamos contra ellos.</p>
      ) : (
        <>
          <CuadernoApuntes
            titulo={`${equipo} · lo que hacen`}
            subtitulo={`Su balón parado, preparado para la ${clave}`}
            deQuien="rival"
            valor={cuadernoRival}
            onCambia={(f) =>
              setValue((doc) => {
                const jornadas = { ...(doc?.jornadas ?? {}) };

                jornadas[clave] = f(normalizaCuaderno(jornadas[clave]));

                return { jornadas };
              })
            }
            equipoCarpeta={equipo}
          />

          {n > 1 && <CuadernoPropio jornada={n - 1} titulo={`Nuestro partido anterior · J${n - 1}`} subtitulo="Cómo lo hicimos nosotros la jornada antes de jugar contra ellos" />}

          <CuadernoPropio jornada={n} titulo={`Nuestro partido contra ${equipo} · ${clave}`} subtitulo="Cómo lo hicimos nosotros contra ellos (después del partido)" />
        </>
      )}
    </div>
  );
}
