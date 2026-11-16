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

/** Cuántas se ven antes de «Ver todas» (10/11/2026, jueces: plegada, las primeras 6 y el resto a un toque). */
const A_LA_VISTA = 6;
/** Hasta aquí (un partido) salen todas, sin botón (16/11/2026). */
const MUESTRA_PARTIDO = 15;

/** «Saca Aguado · remata Mario»: sólo lo que la hoja tiene. */
function quienes(f: FilaAbpCorte) {
  return [f.sacador && `Saca ${f.sacador}`, f.remate && f.rematador && `remata ${f.rematador}`].filter(Boolean).join(" · ");
}

/** El envío solo («Bombeado»), sin la zona: la zona va en su columna (16/11/2026). */
function soloEnvio(f: FilaAbpCorte) {
  const envio = f.envio && !/no aplica/i.test(f.envio) ? f.envio.trim() : "";

  return envio ? `${envio.charAt(0).toLocaleUpperCase("es-ES")}${envio.slice(1).toLocaleLowerCase("es-ES")}` : "";
}

/** Dónde cae, en llano: «segundo palo», «en corto 2v1». */
function caidaDe(f: FilaAbpCorte) {
  const crudo = f.zonaCaida && !/no aplica|^fuera$/i.test(f.zonaCaida) ? f.zonaCaida : "";
  const zona = zonaLegible(crudo);

  if (zona) return /^\d+v\d+$/.test(zona) ? `en corto ${zona}` : zona;

  return /^corto$/i.test(f.envio ?? "") ? "en corto" : "";
}

/** Acaba en gol o en remate: lo que se busca primero en la lista. */
const pesa = (final: string) => /^gol|marcamos$|penalti/.test(final) || /^remate|tiro directo/.test(final);

export function AccionesDelPartido({ acciones, enlaces }: { acciones: AccionDeLista[]; enlaces: Map<string, EnlaceAccionAbp> }) {
  const [todas, setTodas] = useState(false);

  if (!acciones.length) return null;

  /*
  | 16/11/2026 (jueces): el post de ABP lleva TODAS las acciones del partido:
  | con las 7 de una jornada, «Ver las 7» escondía justo el gol encajado del
  | 86′. Hasta MUESTRA_PARTIDO salen todas; con más (varias jornadas), se
  | pliega, pero lo que acaba en gol o remate va arriba y nunca queda oculto.
  */
  const plegable = acciones.length > MUESTRA_PARTIDO;
  const ordenadas = plegable ? [...acciones.filter((a) => pesa(desenlace(a.fila))), ...acciones.filter((a) => !pesa(desenlace(a.fila)))] : acciones;
  const vistas = todas || !plegable ? ordenadas : ordenadas.slice(0, Math.max(A_LA_VISTA, ordenadas.filter((a) => pesa(desenlace(a.fila))).length));
  const conVideo = acciones.filter((a) => a.clave && enlaces.has(a.clave)).length;
  const variosPartidos = new Set(acciones.map((a) => a.jornada)).size > 1;
  const finales = acciones.map((a) => desenlace(a.fila));
  /* El glosario, sólo de lo que sale en la lista (16/11/2026, jueces). */
  const glosario = [
    finales.some((f) => / forzado/.test(f)) ? "remate forzado: se remata con oposición encima o sin perfilarse" : "",
    finales.some((f) => / limpio/.test(f)) ? "remate limpio: remata sin oposición directa" : "",
    finales.some((f) => /rechace/.test(f)) ? "rechace nuestro o suyo: quién se queda el segundo balón tras el despeje" : "",
  ]
    .filter(Boolean)
    .map((t, i) => (i === 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t))
    .join(" · ");

  return (
    <div className="space-y-3">
      {conVideo > 0 && (
        <p className="text-xs leading-relaxed text-white/50">
          {conVideo === acciones.length ? "Cada acción" : `${conVideo} de ${acciones.length} acciones`} con su corte del vídeo de Hudl y el minuto del
          vídeo para abrir el partido en Hudl.
        </p>
      )}

      {/*
      | 16/11/2026 (jueces): zona de caída y desenlace en columnas fijas (antes
      | iban en el texto de la fila), para leer la lista de arriba abajo. En el
      | móvil cada acción se apila con su rótulo.
      */}
      <div className="rounded-xl border border-white/10">
        <div className="hidden grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,9rem)_minmax(0,11rem)] gap-4 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45 md:grid">
          <span>Minuto</span>
          <span>Acción</span>
          <span>Cae en</span>
          <span>Desenlace</span>
        </div>
        <ol className="divide-y divide-white/[0.06]">
          {vistas.map((a, i) => {
            const enlace = a.clave ? enlaces.get(a.clave) : undefined;
            const final = desenlace(a.fila);
            const tono = final === "gol en contra" ? "text-rose-400" : final === "gol" || /marcamos$/.test(final) ? "text-emerald-400" : "text-white/70";
            /* 10/11/2026 (jueces): el gol en contra, en una fila destacada y no sólo en rojo. */
            const destacada = final === "gol en contra";
            const detalle = [soloEnvio(a.fila), quienes(a.fila)].filter(Boolean).join(" · ");
            const caida = caidaDe(a.fila);

            return (
              <li
                key={a.clave ?? `${a.jornada}-${i}`}
                className={`grid min-w-0 grid-cols-1 gap-1.5 px-3 py-3 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,9rem)_minmax(0,11rem)] md:items-start md:gap-4 ${destacada ? "border-l-4 border-rose-500 bg-rose-500/10" : ""}`}
              >
                <div className="flex items-baseline gap-2">
                  {variosPartidos && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-white/60">{a.jornada}</span>}
                  <span className="tabular-nums text-sm font-semibold text-[#C8A96B]">{a.fila.minuto}&apos;</span>
                </div>

                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-white/90">
                    {nombreDeAccion(a.fila)}
                    {variosPartidos && a.rival ? <span className="font-normal text-white/45"> · {a.rival}</span> : null}
                  </p>
                  {detalle && <p className="text-[13px] text-white/60">{detalle}</p>}
                  {enlace && <VerAccion video={enlace.video} hudl={enlace.hudl} que="la acción" />}
                </div>

                {caida ? (
                  <p className="text-[13px] text-white/75">
                    <span className="text-white/45 md:hidden">Cae en </span>
                    {caida}
                  </p>
                ) : (
                  <span className="hidden md:block" aria-hidden />
                )}

                <p className={`text-[13px] font-medium ${tono}`}>
                  <span className="font-normal text-white/45 md:hidden">Desenlace: </span>
                  {final}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      {glosario ? <p className="text-[12px] leading-snug text-white/55">{glosario}.</p> : null}

      {plegable && (todas || vistas.length < acciones.length) ? (
        <button type="button" onClick={() => setTodas((x) => !x)} className="text-xs text-[#C8A96B] underline-offset-2 hover:underline">
          {todas ? "Ver menos" : `Ver las ${acciones.length}`}
        </button>
      ) : null}
    </div>
  );
}
