"use client";

/**
 * El modo proyector: la charla de balón parado, a pantalla completa.
 *
 * Es lo que se hacía con el PowerPoint en la sala, con una diferencia: cada
 * diapositiva se cuenta **fase a fase**. Se entra en la diapositiva con las
 * caras en su sitio de salida y sin flechas; cada pulsación dibuja la fase
 * siguiente —los que bloquean, después los que atacan el hueco, el balón— y,
 * cuando ya no quedan fases, pasa a la siguiente diapositiva. Es la misma
 * tecla para todo, que es lo que manda un mando de presentaciones (→, AvPág,
 * espacio o Intro); ← y RePág van hacia atrás.
 *
 * Esc sale de la pantalla completa y, una segunda vez, del proyector. La barra
 * de mandos se apaga sola a los pocos segundos sin mover el ratón: en la sala
 * sólo tiene que verse la diapositiva.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  RotateCcw,
  X,
} from "lucide-react";

import type { Player } from "@/types/player";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { TABLERO_H, TABLERO_W, type SlidePizarra } from "@/lib/abp/pizarra";
import { fasesDe } from "@/lib/abp/trazos";
import { useReproduccionAbp } from "@/hooks/useReproduccionAbp";

const NADA = () => undefined;

export function ProyectaPizarra({
  slides,
  inicial,
  players,
  temporada,
  rival,
  onCerrar,
}: {
  slides: SlidePizarra[];
  inicial: number;
  players: Map<string, Player>;
  temporada: string;
  rival: string;
  /** Devuelve en qué diapositiva se ha quedado, para seguir ahí al volver. */
  onCerrar: (indice: number) => void;
}) {
  const raizRef = useRef<HTMLDivElement>(null);

  const [indice, setIndice] = useState(() =>
    Math.max(0, Math.min(inicial, slides.length - 1)),
  );

  const slide = slides[indice];
  const fases = fasesDe(slide?.trazos);

  /* La primera diapositiva también arranca en su salida. */
  const reloj = useReproduccionAbp(fases, fases > 0 ? 0 : null);

  const [completa, setCompleta] = useState(false);

  /*
  | Al llegar a una diapositiva con fases se parte de la salida (tiempo 0:
  | caras en su sitio, flechas sin dibujar). Sin fases es la foto fija.
  | `entrar` se llama desde los manejadores, no en un efecto.
  */
  const entrar = useCallback(
    (nuevo: number, alFinal = false) => {
      const destino = slides[nuevo];

      if (!destino) return;

      const n = fasesDe(destino.trazos);

      setIndice(nuevo);
      reloj.ponEn(n > 0 ? (alFinal ? n : 0) : null);
    },
    [slides, reloj],
  );

  const avanza = useCallback(() => {
    if (fases > 0 && reloj.siguiente()) return;

    if (indice < slides.length - 1) entrar(indice + 1);
  }, [fases, reloj, indice, slides.length, entrar]);

  const retrocede = useCallback(() => {
    if (fases > 0 && reloj.anterior()) return;

    if (indice > 0) entrar(indice - 1, true);
  }, [fases, reloj, indice, entrar]);

  /* ------------------------ PANTALLA COMPLETA ------------------------ */

  const alternaCompleta = useCallback(() => {
    const raiz = raizRef.current;

    if (!raiz) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    } else {
      void raiz.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const cambia = () => setCompleta(Boolean(document.fullscreenElement));

    document.addEventListener("fullscreenchange", cambia);

    /* Se abre ya a pantalla completa: se ha pulsado un botón hace un instante,
       así que el navegador lo permite. Si no, se queda en la ventana. */
    void raizRef.current?.requestFullscreen?.().catch(() => undefined);

    const previo = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("fullscreenchange", cambia);
      document.body.style.overflow = previo;

      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => undefined);
      }
    };
  }, []);

  /* ----------------------------- TECLAS ------------------------------ */

  useEffect(() => {
    const tecla = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (["ArrowRight", "PageDown", " ", "Enter", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        avanza();
      } else if (["ArrowLeft", "PageUp", "ArrowUp", "Backspace"].includes(event.key)) {
        event.preventDefault();
        retrocede();
      } else if (event.key === "Home") {
        event.preventDefault();
        entrar(0);
      } else if (event.key === "End") {
        event.preventDefault();
        entrar(slides.length - 1, true);
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        alternaCompleta();
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        if (fases > 0) reloj.reproduce();
      } else if (event.key === "Escape") {
        /* En pantalla completa el navegador se queda el primer Esc. */
        if (!document.fullscreenElement) onCerrar(indice);
      }
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [avanza, retrocede, entrar, alternaCompleta, slides.length, fases, reloj, onCerrar, indice]);

  /* ----------------------- MANDOS QUE SE APAGAN ---------------------- */

  const [mandos, setMandos] = useState(true);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const despierta = useCallback(() => {
    setMandos(true);

    if (temporizador.current) clearTimeout(temporizador.current);

    temporizador.current = setTimeout(() => setMandos(false), 2600);
  }, []);

  useEffect(() => {
    temporizador.current = setTimeout(() => setMandos(false), 3200);

    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  if (!slide) return null;

  const faseActual =
    fases > 0 && reloj.tiempo != null ? Math.min(fases, Math.ceil(reloj.tiempo - 1e-6)) : 0;

  return (
    <div
      ref={raizRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Proyector · ${slide.titulo}`}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: "#04070C", cursor: mandos ? "default" : "none" }}
      onPointerMove={despierta}
      onPointerDown={(event) => {
        /* Un toque en la diapositiva avanza, como en una tableta. */
        despierta();

        if ((event.target as Element).closest("[data-mandos]")) return;

        const caja = raizRef.current?.getBoundingClientRect();

        if (!caja) return;

        if (event.clientX < caja.left + caja.width * 0.25) retrocede();
        else avanza();
      }}
    >
      <div
        style={{
          width: `min(100vw, calc(100vh * ${TABLERO_W} / ${TABLERO_H}))`,
        }}
      >
        <TableroSlide
          slide={slide}
          players={players}
          temporada={temporada}
          rival={rival}
          seleccion={null}
          onMover={NADA}
          onQuitar={NADA}
          onPulsarPuesto={NADA}
          onSeleccionar={NADA}
          tiempo={reloj.tiempo}
          soloVer
        />
      </div>

      {/* Los mandos, abajo y por encima: se apagan solos. */}
      <div
        data-mandos
        className="absolute inset-x-0 bottom-0 flex justify-center p-3 transition-opacity duration-300"
        style={{ opacity: mandos ? 1 : 0, pointerEvents: mandos ? "auto" : "none" }}
      >
        <div
          className="flex max-w-full flex-wrap items-center gap-1.5 rounded-2xl px-2 py-1.5 text-white"
          style={{
            backgroundColor: "rgba(15,32,54,.92)",
            border: "1px solid rgba(200,169,107,.35)",
            boxShadow: "0 12px 30px rgba(0,0,0,.5)",
          }}
        >
          <MandoBoton etiqueta="Anterior (←)" onClick={retrocede} disabled={indice === 0 && !(reloj.tiempo && reloj.tiempo > 0)}>
            <ChevronLeft size={18} />
          </MandoBoton>

          <div className="min-w-0 px-2 text-center">
            <p className="max-w-[46vw] truncate text-[13px] font-semibold uppercase tracking-wide" style={{ color: "#fff" }}>
              {indice + 1}/{slides.length} · {slide.titulo}
            </p>

            {fases > 0 && (
              <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(228,206,155,.85)" }}>
                Fase
                {Array.from({ length: fases }, (_, i) => (
                  <span
                    key={i}
                    className="inline-block h-1.5 w-4 rounded-full"
                    style={{ backgroundColor: i < faseActual ? "#E4CE9B" : "rgba(255,255,255,.2)" }}
                  />
                ))}
              </p>
            )}
          </div>

          <MandoBoton etiqueta="Siguiente (→ o espacio)" onClick={avanza} disabled={indice === slides.length - 1 && (fases === 0 || (reloj.tiempo ?? 0) >= fases)}>
            <ChevronRight size={18} />
          </MandoBoton>

          {fases > 0 && (
            <MandoBoton etiqueta="Repetir la jugada entera (R)" onClick={reloj.reproduce}>
              <RotateCcw size={16} />
            </MandoBoton>
          )}

          <MandoBoton etiqueta={completa ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"} onClick={alternaCompleta}>
            {completa ? <Minimize size={16} /> : <Maximize size={16} />}
          </MandoBoton>

          <MandoBoton etiqueta="Cerrar el proyector (Esc)" onClick={() => onCerrar(indice)}>
            <X size={17} />
          </MandoBoton>
        </div>
      </div>
    </div>
  );
}

function MandoBoton({
  etiqueta,
  onClick,
  disabled,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white/10 disabled:opacity-30"
      style={{ color: "#fff" }}
    >
      {children}
    </button>
  );
}
