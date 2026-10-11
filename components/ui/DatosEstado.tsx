"use client";

/**
 * DE CUÁNDO SON LOS DATOS QUE SE VEN.
 *
 * Desde que las hojas se enseñan desde la copia del aparato
 * (`lib/hojaCsv.ts`), una pantalla puede estar pintada con lo de hace una
 * hora mientras lo nuevo se baja por detrás. Eso hay que decirlo en algún
 * sitio que esté en todas las pantallas: aquí, en la cabecera. Dice de
 * cuándo es la copia más vieja que se está enseñando, si se está bajando
 * algo, y cuando ha llegado una hoja distinta ofrece «Recargar» —que es
 * instantáneo, porque todo está ya en el aparato—. Con todo bajado de la red
 * no dice nada: no hay nada que explicar.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";

import { estadoHojas, olvidaTodoElCsv, suscribeHojas } from "@/lib/hojaCsv";

const VACIO = { bajando: 0, deCopia: 0, masVieja: null, hayNuevas: false };

function haceCuanto(ms: number, ahora: number): string {
  const min = Math.max(0, Math.round((ahora - ms) / 60_000));

  if (min < 1) return "de ahora";
  if (min < 60) return `de hace ${min} min`;

  const h = Math.round(min / 60);

  if (h < 24) return `de hace ${h} h`;

  return `de hace ${Math.round(h / 24)} d`;
}

export function DatosEstado() {
  const estado = useSyncExternalStore(suscribeHojas, estadoHojas, () => VACIO);

  /* El reloj se apunta en un efecto, nunca en el render (regla de pureza). */
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    const tic = () => setAhora(Date.now());
    const t = window.setTimeout(tic, 0);
    const cada = window.setInterval(tic, 30_000);

    return () => {
      window.clearTimeout(t);
      window.clearInterval(cada);
    };
  }, []);

  if (estado.deCopia === 0 && estado.bajando === 0) return null;

  const recarga = () => {
    /* Las copias nuevas ya están guardadas: recargar es leerlas. Lo que se
       tira es sólo la memoria de la pestaña, para que ninguna pantalla se
       quede con la vieja. */
    window.location.reload();
  };

  const todoFresco = () => {
    olvidaTodoElCsv();
    window.location.reload();
  };

  if (estado.hayNuevas) {
    return (
      <button
        type="button"
        onClick={recarga}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2.5 py-1.5 text-[11px] text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
        title="Ha llegado una hoja con cambios: recargar la pantalla para verla (es instantáneo)"
      >
        <RefreshCw size={12} />
        <span className="hidden sm:inline">Hay datos nuevos ·</span> Recargar
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={todoFresco}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/45 transition hover:border-white/20 hover:text-white/80"
      title="Lo que se ve viene de la copia guardada en este aparato. Pulsa para tirarla y bajarlo todo de nuevo."
    >
      <RefreshCw size={12} className={estado.bajando > 0 ? "animate-spin" : ""} />
      <span className="hidden sm:inline">
        {estado.bajando > 0
          ? "Actualizando…"
          : estado.masVieja !== null && ahora > 0
            ? `Datos ${haceCuanto(estado.masVieja, ahora)}`
            : "Datos guardados"}
      </span>
    </button>
  );
}
