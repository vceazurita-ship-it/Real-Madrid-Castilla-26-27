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
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { descartaNuevas, estadoHojas, olvidaTodoElCsv, suscribeHojas } from "@/lib/hojaCsv";

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

  /*
  | «Actualizando…» no puede quedarse fijo: una hoja lenta (Apps Script en
  | frío tarda 30-70 s) o colgada lo dejaba así para siempre. Pasados 20 s se
  | vuelve a decir de cuándo son los datos; si la bajada acaba, se actualiza.
  */
  const hayBajada = estado.bajando > 0;
  const [cansado, setCansado] = useState(false);

  useEffect(() => {
    if (!hayBajada) return;

    const inicio = window.setTimeout(() => setCansado(false), 0);
    const tope = window.setTimeout(() => setCansado(true), 20_000);

    return () => {
      window.clearTimeout(inicio);
      window.clearTimeout(tope);
    };
  }, [hayBajada]);

  /*
  | En la portada lo nuevo se pone solo (29/10/2026, experto de fútbol): la
  | cabecera del próximo partido llegó a mezclar la clasificación de la
  | jornada 8 con el último resultado de la 9. Es de sólo lectura, así que si
  | la hoja nueva llega en los primeros segundos y aún no se ha tocado nada,
  | se recarga (es instantáneo: ya está en el aparato). Si ya se está usando,
  | queda el botón, para no llevarse una casilla a medio guardar.
  */
  const ruta = usePathname();

  useEffect(() => {
    if (ruta !== "/" || !estado.hayNuevas) return;

    try {
      if (performance.now() > 45_000 || sessionStorage.getItem("rmcf-tocado") === ruta) return;

      /* Una vez cada diez minutos como mucho: una hoja que cambiara en cada
         bajada no puede dejar la portada recargándose sin fin. */
      const ultima = Number(sessionStorage.getItem("rmcf-autorecarga") ?? 0);

      if (Date.now() - ultima < 600_000) return;

      sessionStorage.setItem("rmcf-autorecarga", String(Date.now()));
      descartaNuevas();
      window.location.reload();
    } catch {}
  }, [ruta, estado.hayNuevas]);

  useEffect(() => {
    const toca = () => {
      try {
        sessionStorage.setItem("rmcf-tocado", window.location.pathname);
      } catch {}
    };

    try {
      sessionStorage.removeItem("rmcf-tocado");
    } catch {}

    window.addEventListener("pointerdown", toca, { once: true });
    window.addEventListener("keydown", toca, { once: true });

    return () => {
      window.removeEventListener("pointerdown", toca);
      window.removeEventListener("keydown", toca);
    };
  }, [ruta]);

  if (estado.deCopia === 0 && estado.bajando === 0) return null;

  const recarga = () => {
    /* Las copias nuevas ya están guardadas: recargar es leerlas. Lo que se
       tira es sólo la memoria de la pestaña, para que ninguna pantalla se
       quede con la vieja. */
    descartaNuevas();
    window.location.reload();
  };

  /*
  | Sin red no se tira nada (19/10/2026). Tirar las copias y recargar sin
  | conexión dejaba TODAS las pantallas vacías justo cuando la copia es lo
  | único que hay (el autobús, el vestuario del campo rival). Sin red, el botón
  | sólo lo dice.
  */
  const todoFresco = () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.info("Sin conexión", { description: "Se siguen enseñando los datos guardados en este aparato. Pulsa otra vez cuando vuelva la red." });
      return;
    }

    olvidaTodoElCsv();
    descartaNuevas();
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
      <RefreshCw size={12} className={hayBajada && !cansado ? "animate-spin" : ""} />
      <span className="hidden sm:inline">
        {/* En cuanto hay copia se dice de cuándo es (el icono que gira ya
            avisa de que se renueva); «Actualizando…» solo si no hay fecha. */}
        {estado.masVieja !== null && ahora > 0
          ? `Datos ${haceCuanto(estado.masVieja, ahora)}`
          : hayBajada && !cansado
            ? "Actualizando…"
            : "Datos guardados"}
      </span>
    </button>
  );
}
