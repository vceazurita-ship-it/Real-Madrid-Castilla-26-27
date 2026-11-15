"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useId, useSyncExternalStore, type ComponentType, type ReactNode } from "react";

/*
| LO QUE ESTÁ HECHO, PLEGADO (15/11/2026).
|
| Petición del analista: en Ajustes había tanto texto por proceso que lo que
| importaba —lo que está en marcha o ha fallado— quedaba a dos pantallas de
| scroll. Cada proceso es ahora una línea (punto de color, nombre, «hecho hace
| X» y su botón) que se despliega al pulsar. Lo que pide atención sale abierto.
|
| Lo que se abre o se cierra a mano se recuerda en este aparato, pero atado
| al estado: si un proceso que se dejó plegado falla, vuelve a salir abierto.
*/

export type Tono = "ok" | "marcha" | "aviso" | "neutro";

export const PUNTO: Record<Tono, { clase: string; texto: string }> = {
  ok: { clase: "bg-emerald-400", texto: "Al día" },
  marcha: { clase: "bg-[#C8A96B] animate-pulse", texto: "En marcha" },
  aviso: { clase: "bg-amber-400", texto: "Con aviso" },
  neutro: { clase: "bg-white/30", texto: "Sin dato" },
};

const CLAVE = "ajustes:plegados";
const oyentes = new Set<() => void>();
let cache: Record<string, boolean> | null = null;

function lee(): Record<string, boolean> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CLAVE) || "{}") as Record<string, boolean>;
  } catch {
    cache = {};
  }
  return cache;
}

function guarda(id: string, abierto: boolean) {
  cache = { ...lee(), [id]: abierto };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cache));
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
  for (const o of oyentes) o();
}

const suscribe = (o: () => void) => {
  oyentes.add(o);
  return () => oyentes.delete(o);
};

const VACIO: Record<string, boolean> = {};

export function usePlegado(id: string, tono: Tono) {
  const mapa = useSyncExternalStore(suscribe, lee, () => VACIO);
  const clave = `${id}:${tono}`;
  const porDefecto = tono === "marcha" || tono === "aviso";
  const abierto = mapa[clave] ?? porDefecto;
  const cambia = useCallback(() => guarda(clave, !abierto), [clave, abierto]);
  return { abierto, cambia };
}

export function Plegable({
  id,
  titulo,
  subtitulo,
  icono: Icono,
  tono,
  resumen,
  accion,
  children,
}: {
  id: string;
  titulo: string;
  subtitulo?: string;
  icono?: ComponentType<{ size?: number; className?: string }>;
  tono: Tono;
  /** La línea de estado: «hecho hace 2 h · 487 jugadores». */
  resumen?: ReactNode;
  /** El botón principal; se ve plegado y desplegado. */
  accion?: ReactNode;
  children: ReactNode;
}) {
  const { abierto, cambia } = usePlegado(id, tono);
  const cuerpo = useId();

  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border bg-white/[0.03] ${
        tono === "aviso" ? "border-amber-400/40" : tono === "marcha" ? "border-[#C8A96B]/40" : "border-white/10"
      }`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={cambia}
          aria-expanded={abierto}
          aria-controls={cuerpo}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO[tono].clase}`} title={PUNTO[tono].texto} aria-hidden />
          <span className="sr-only">{PUNTO[tono].texto}: </span>
          {Icono && <Icono size={15} className="hidden shrink-0 text-[#C8A96B] sm:block" />}
          <span className="min-w-0">
            <span className="block break-words text-sm font-semibold text-white">{titulo}</span>
            {(resumen || subtitulo) && (
              <span className="mt-0.5 block text-[12px] leading-snug text-white/55">{resumen ?? subtitulo}</span>
            )}
          </span>
          <ChevronDown
            size={16}
            aria-hidden
            className={`ml-auto shrink-0 text-white/45 transition-transform ${abierto ? "rotate-180" : ""}`}
          />
        </button>

        {accion && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:w-full">{accion}</div>}
      </header>

      {abierto && (
        <div id={cuerpo} className="border-t border-white/10 p-4 sm:p-5">
          {subtitulo && resumen && <p className="mb-3 text-[12px] text-white/50">{subtitulo}</p>}
          {children}
        </div>
      )}
    </section>
  );
}
