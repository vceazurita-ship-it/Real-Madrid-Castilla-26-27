"use client";

/**
 * ACCIÓN A ACCIÓN, CON SU VÍDEO (04/11/2026).
 *
 * La lista de las acciones a balón parado que dejan los filtros de /setpieces
 * y /setpieces_def, cada una contada como en el vídeo post de ABP
 * (`rotuloDeAccion`, la misma hoja) y con «Ver la acción» y «Abrir en Hudl ·
 * mm:ss» (`VerAccion`, común a todas las pantallas de análisis). El corte y
 * el segundo de Hudl salen de `abp:cortes` (`scripts/abp-cortes.mjs`); la
 * acción que aún no lo tiene sale igual, sin botones.
 */

import { useState } from "react";

import { VerAccion } from "@/components/video/VerAccion";
import { desenlace, nombreDeAccion, type EnlaceAccionAbp, type FilaAbpCorte } from "@/lib/abp/cortes-abp";
import { zonaLegible } from "@/lib/abp/accionFrase";

export type AccionDeLista = {
  clave: string | null;
  /** «J10», «PR03»: la chapa de la jornada. */
  jornada: string;
  rival: string;
  fila: FilaAbpCorte;
};

/** Cuántas se ven antes de «Ver todas»: un partido entero cabe (la J10 tuvo 23). */
const A_LA_VISTA = 25;

/**
 * «Bombeado · cae en punto de penalti», «Corto · 2v1»: lo que dice la hoja
 * del envío y dónde cae, escrito igual en todas las filas (07/11/2026:
 * «Bombeado, penalti» y «segundo Palo» no se entendían).
 */
function envioDe(f: FilaAbpCorte) {
  const envio = f.envio && !/no aplica/i.test(f.envio) ? f.envio.trim() : "";
  const crudo = f.zonaCaida && !/no aplica|^fuera$/i.test(f.zonaCaida) ? f.zonaCaida : "";
  const zona = zonaLegible(crudo);
  const enCorto = /^\d+v\d+$/.test(zona);
  const dicho = zona ? (enCorto ? `en corto ${zona}` : `cae en ${zona}`) : "";

  if (envio && dicho) return `${envio.charAt(0).toLocaleUpperCase("es-ES")}${envio.slice(1).toLocaleLowerCase("es-ES")} · ${dicho}`;

  return envio || (dicho ? dicho.charAt(0).toLocaleUpperCase("es-ES") + dicho.slice(1) : "");
}

/** «Saca Aguado · remata Mario»: sólo lo que la hoja tiene. */
function quienes(f: FilaAbpCorte) {
  return [f.sacador && `Saca ${f.sacador}`, f.remate && f.rematador && `remata ${f.rematador}`].filter(Boolean).join(" · ");
}

export function AccionesDelPartido({ acciones, enlaces }: { acciones: AccionDeLista[]; enlaces: Map<string, EnlaceAccionAbp> }) {
  const [todas, setTodas] = useState(false);

  if (!acciones.length) return null;

  const vistas = todas ? acciones : acciones.slice(0, A_LA_VISTA);
  const conVideo = acciones.filter((a) => a.clave && enlaces.has(a.clave)).length;
  const variosPartidos = new Set(acciones.map((a) => a.jornada)).size > 1;

  return (
    <div className="space-y-3">
      {conVideo > 0 && (
        <p className="text-xs leading-relaxed text-white/50">
          {conVideo === acciones.length ? "Cada acción" : `${conVideo} de ${acciones.length} acciones`} con su corte del vídeo de Hudl y el minuto del
          vídeo para abrir el partido en Hudl.
        </p>
      )}

      <ol className="divide-y divide-white/[0.06] rounded-xl border border-white/10">
        {vistas.map((a, i) => {
          const enlace = a.clave ? enlaces.get(a.clave) : undefined;
          const final = desenlace(a.fila);
          const tono = final === "gol en contra" ? "text-rose-400" : final === "gol" || /marcamos$/.test(final) ? "text-emerald-400" : "text-white/60";
          const detalle = [envioDe(a.fila), quienes(a.fila)].filter(Boolean).join(" · ");

          return (
            <li key={a.clave ?? `${a.jornada}-${i}`} className="flex min-w-0 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex shrink-0 items-baseline gap-2 sm:w-28">
                {variosPartidos && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-white/60">{a.jornada}</span>}
                <span className="tabular-nums text-sm font-semibold text-[#C8A96B]">{a.fila.minuto}&apos;</span>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-white/90">
                  {nombreDeAccion(a.fila)}
                  {variosPartidos && a.rival ? <span className="font-normal text-white/45"> · {a.rival}</span> : null}
                  <span className={`font-normal ${tono}`}> · {final}</span>
                </p>
                {detalle && <p className="text-xs text-white/50">{detalle}</p>}
                {enlace && <VerAccion video={enlace.video} hudl={enlace.hudl} que="la acción" />}
              </div>
            </li>
          );
        })}
      </ol>

      {acciones.length > A_LA_VISTA && (
        <button type="button" onClick={() => setTodas((x) => !x)} className="text-xs text-[#C8A96B] underline-offset-2 hover:underline">
          {todas ? "Ver menos" : `Ver las ${acciones.length}`}
        </button>
      )}
    </div>
  );
}
