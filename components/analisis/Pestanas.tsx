"use client";

/*
|--------------------------------------------------------------------------
| PESTAÑAS DE UNA PANTALLA DE ANÁLISIS (14/10/2026)
|--------------------------------------------------------------------------
|
| Las pantallas de análisis eran un único scroll de diez paneles: lo que se
| buscaba (la lista, el campo) quedaba a tres pantallazos. Ahora cada una se
| parte en pocas vistas con nombre de pregunta, y la elegida va en la
| dirección (`?vista=`) para que un enlace o un «atrás» vuelva a ella.
|
| `usePestanaUrl` lee la vista UNA vez al montar (`useState` con función, el
| mismo patrón que `?area=` en Data análisis: nada de `setState` en efectos)
| y al cambiarla reescribe la dirección sin recargar ni añadir historial.
*/

import { useState, type ComponentType } from "react";

export type OpcionPestana<K extends string> = {
  clave: K;
  label: string;
  icono?: ComponentType<{ size?: number; className?: string }>;
  /** Un número pequeño al lado (cuántos goles, cuántas faltas). */
  cuenta?: number | string;
};

export function usePestanaUrl<K extends string>(parametro: string, claves: readonly K[], defecto: K): [K, (k: K) => void] {
  const [valor, setValor] = useState<K>(() => {
    if (typeof window === "undefined") return defecto;

    const pedida = new URLSearchParams(window.location.search).get(parametro);

    return claves.includes(pedida as K) ? (pedida as K) : defecto;
  });

  const cambia = (k: K) => {
    setValor(k);

    try {
      const url = new URL(window.location.href);

      if (k === defecto) url.searchParams.delete(parametro);
      else url.searchParams.set(parametro, k);

      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* Sin dirección que tocar (pruebas, vista previa): basta con el estado. */
    }
  };

  return [valor, cambia];
}

/**
 * La tira de pestañas. Pegada arriba al hacer scroll (`sticky`) para que se
 * pueda cambiar de vista desde el fondo de una lista larga.
 */
export function Pestanas<K extends string>({
  opciones,
  valor,
  onCambia,
  etiqueta,
  pegada = true,
}: {
  opciones: OpcionPestana<K>[];
  valor: K;
  onCambia: (k: K) => void;
  etiqueta: string;
  pegada?: boolean;
}) {
  return (
    <div style={pegada ? { top: "var(--alto-cabecera, 0px)" } : undefined} className={`${pegada ? "sticky z-20 -mx-4 bg-[#0B0F14] px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10" : ""}`}>
      <div role="tablist" aria-label={etiqueta} className="flex min-w-0 gap-1 overflow-x-auto border-b border-white/10 scrollbar-none">
        {opciones.map(({ clave, label, icono: Icono, cuenta }) => {
          const activa = clave === valor;

          return (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => onCambia(clave)}
              /* El subrayado va en `style`: la regla `* { border-color }` de
                 globals.css gana a las clases `border-*`, así que con
                 `border-[#C8A96B]` / `border-transparent` todas las pestañas
                 salían con la misma raya gris y la elegida no se distinguía
                 (19/10/2026). */
              style={{ borderBottomColor: activa ? "var(--rmcf-gold-ink, #C8A96B)" : "transparent" }}
              className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
                activa ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {Icono ? <Icono size={14} className={activa ? "text-[#C8A96B]" : ""} /> : null}
              {label}
              {cuenta !== undefined ? (
                <span className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${activa ? "bg-[#C8A96B]/20 text-[#C8A96B]" : "bg-white/[0.06] text-white/45"}`}>{cuenta}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
