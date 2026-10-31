"use client";

/*
|--------------------------------------------------------------------------
| DOS DEDOS EN EL MOUSEPAD, EN CUALQUIER VÍDEO DE LA APP (31/10/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que cualquier reproductor de vídeo de la app tenga la
| función de, con el ratón táctil del portátil, moverse más rápido o más lento
| con dos dedos, como los Mac». Es la lanzadera del coding (`useLanzadera`)
| llevada a todos los `<video>`:
|
|   · Con el vídeo en marcha, barrer a la derecha lo acelera (hasta ×8) y a la
|     izquierda lo frena (hasta ×0,1). Al soltar vuelve a su velocidad.
|   · Con el vídeo en pausa, el barrido lo mueve adelante y atrás, como el
|     arrastre de QuickTime.
|
| Se escucha una vez en `window` y se busca el vídeo que hay bajo el cursor
| (`elementsFromPoint`: casi todos llevan algo encima, una pizarra o unos
| mandos). Sólo el barrido horizontal: el vertical sigue siendo bajar la
| página. Si la pantalla ya tiene su propia lanzadera (el coding), ella hace
| `preventDefault` antes y aquí no se hace nada.
*/

import { useEffect, useRef, useState } from "react";

import { velocidadDeLanzadera } from "@/hooks/useLanzadera";

/** Sin eventos durante este rato, el gesto se da por soltado. */
const CALMA_MS = 320;
/** Con el vídeo en pausa: segundos por píxel de barrido. */
const SEGUNDOS_POR_PX = 0.04;

type Rotulo = { texto: string; x: number; y: number } | null;

const coma = (n: number) => String(n).replace(".", ",");

function videoBajo(x: number, y: number): HTMLVideoElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el instanceof HTMLVideoElement) return el;
  }

  return null;
}

export function LanzaderaGlobal() {
  const [rotulo, setRotulo] = useState<Rotulo>(null);
  const gesto = useRef<{ video: HTMLVideoElement; palanca: number; velocidad: number; reloj: ReturnType<typeof setTimeout> | null } | null>(null);

  useEffect(() => {
    const suelta = () => {
      const g = gesto.current;

      if (!g) return;

      if (!g.video.paused) g.video.playbackRate = g.velocidad;

      gesto.current = null;
      setRotulo(null);
    };

    const alRodar = (evento: WheelEvent) => {
      if (evento.defaultPrevented || evento.ctrlKey) return;
      if (Math.abs(evento.deltaX) <= Math.abs(evento.deltaY)) return;

      const video = gesto.current?.video ?? videoBajo(evento.clientX, evento.clientY);

      if (!video || !Number.isFinite(video.duration) || video.readyState < 1) return;

      evento.preventDefault();

      if (!gesto.current || gesto.current.video !== video) {
        gesto.current = { video, palanca: 0, velocidad: video.playbackRate || 1, reloj: null };
      }

      const g = gesto.current;
      const caja = video.getBoundingClientRect();
      const sitio = { x: caja.left + caja.width / 2, y: caja.top + Math.min(48, caja.height / 4) };

      if (video.paused) {
        const destino = Math.min(video.duration, Math.max(0, video.currentTime + evento.deltaX * SEGUNDOS_POR_PX));

        video.currentTime = destino;

        const m = Math.floor(destino / 60);
        const s = Math.floor(destino % 60);

        setRotulo({ texto: `${evento.deltaX > 0 ? "▶▶" : "◀◀"} ${m}:${String(s).padStart(2, "0")}`, ...sitio });
      } else {
        g.palanca += evento.deltaX;

        const v = velocidadDeLanzadera(g.palanca) * g.velocidad;
        const acotada = Math.min(16, Math.max(0.0625, v));

        video.playbackRate = acotada;
        setRotulo({ texto: `×${coma(Math.round(acotada * 100) / 100)}`, ...sitio });
      }

      if (g.reloj) clearTimeout(g.reloj);

      g.reloj = setTimeout(suelta, CALMA_MS);
    };

    window.addEventListener("wheel", alRodar, { passive: false });

    return () => {
      window.removeEventListener("wheel", alRodar);

      if (gesto.current?.reloj) clearTimeout(gesto.current.reloj);
    };
  }, []);

  if (!rotulo) return null;

  return (
    <div
      aria-live="polite"
      className="siempre-oscuro pointer-events-none fixed z-[100] -translate-x-1/2 rounded-full px-3 py-1 text-sm font-semibold tabular-nums text-white shadow-lg"
      style={{ left: rotulo.x, top: rotulo.y, background: "rgba(11,15,20,.82)" }}
    >
      {rotulo.texto}
    </div>
  );
}
