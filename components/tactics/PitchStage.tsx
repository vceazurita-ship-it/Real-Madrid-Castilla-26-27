"use client";

/**
 * Escenario de la pizarra.
 *
 * Envuelve el campo (un SVG cualquiera) en el contenedor con perspectiva que
 * mueve `usePitchCamera`, y coloca alrededor las piezas fijas de la interfaz:
 * la barra de cámara arriba a la derecha, la paleta flotante a la izquierda,
 * el selector de estilo abajo a la izquierda y el reproductor bajo el campo.
 *
 * El SVG que se le pasa no sabe nada de la cámara: sigue dibujando en su
 * espacio de campo. Por eso el mismo escenario vale para cualquier tablero.
 */

import { ReactNode, Ref, useEffect, useRef } from "react";

import type { PitchCamera } from "@/hooks/usePitchCamera";
import { cn } from "@/lib/utils";

interface Props {
  camera: PitchCamera;
  /** Proporción del campo, tal cual la espera CSS: `"100 / 68"`. */
  aspect: string;
  /** Con la herramienta de cámara activa, el puntero mueve la escena. */
  navigable: boolean;
  /** Referencia al marco completo, para exportar la imagen. */
  frameRef?: Ref<HTMLDivElement>;
  /** El campo. */
  children: ReactNode;
  /** Barra de modos de cámara (arriba a la derecha). */
  cameraBar?: ReactNode;
  /** Paleta de herramientas (flotante a la izquierda). */
  toolbar?: ReactNode;
  /** Selector de color, grosor y trazo (abajo a la izquierda). */
  styleBar?: ReactNode;
  /** Reproductor y línea de tiempo (bajo el campo). */
  timeline?: ReactNode;
  className?: string;
}

export default function PitchStage({
  camera,
  aspect,
  navigable,
  frameRef,
  children,
  cameraBar,
  toolbar,
  styleBar,
  timeline,
  className,
}: Props) {
  const navRef = useRef<HTMLDivElement>(null);

  const {
    attachContainer,
    attachPlane,
    containerStyle,
    planeStyle,
    navigating,
    navigationHandlers,
    zoomBy,
  } = camera;

  /**
   * La rueda hace zoom, y para eso hay que cancelar el desplazamiento de la
   * página. React registra `wheel` como pasivo, así que se engancha a mano.
   */
  useEffect(() => {
    const element = navRef.current;
    if (!element || !navigable) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.09 : 1 / 1.09);
    };

    element.addEventListener("wheel", onWheel, { passive: false });

    return () => element.removeEventListener("wheel", onWheel);
  }, [navigable, zoomBy]);

  return (
    <div
      ref={frameRef}
      className={cn(
        "overflow-hidden rounded-[26px] border border-[#C8A96B]/20 bg-[#07120C] shadow-[0_25px_80px_rgba(0,0,0,.5)]",
        className
      )}
    >
      <div className="relative">
        {/* Fondo del estadio: al inclinar el campo queda hueco alrededor. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_120%,rgba(200,169,107,.10),transparent_62%),radial-gradient(100%_70%_at_50%_-12%,rgba(6,14,10,.95),transparent_58%)]"
        />

        {/* CONTENEDOR DE PERSPECTIVA */}

        <div
          ref={attachContainer}
          style={{ ...containerStyle, aspectRatio: aspect }}
          className="relative w-full"
        >
          {/* El plano del campo: aquí se escribe la matriz de la cámara. */}
          <div ref={attachPlane} style={planeStyle} className="absolute inset-0">
            {children}
          </div>
        </div>

        {/*
          Capa de navegación. Solo existe con la herramienta de cámara activa,
          así el dibujo y el arrastre de fichas siguen recibiendo el puntero.
        */}
        {navigable && (
          <div
            ref={navRef}
            data-export-hide
            {...navigationHandlers}
            className={cn(
              "absolute inset-0 z-20 touch-none",
              navigating ? "cursor-grabbing" : "cursor-grab"
            )}
          />
        )}

        {/* BARRA DE CÁMARA */}

        {cameraBar && (
          <div
            data-export-hide
            className="absolute right-2.5 top-2.5 z-30 sm:right-3 sm:top-3"
          >
            {cameraBar}
          </div>
        )}

        {/* PALETA DE HERRAMIENTAS */}

        {toolbar && (
          <div
            data-export-hide
            className="absolute left-2.5 top-2.5 z-30 sm:left-3 sm:top-3"
          >
            {toolbar}
          </div>
        )}

        {/* ESTILO DEL TRAZO */}

        {styleBar && (
          <div
            data-export-hide
            className="absolute bottom-2.5 left-2.5 z-30 sm:bottom-3 sm:left-3"
          >
            {styleBar}
          </div>
        )}
      </div>

      {/* REPRODUCTOR */}

      {timeline && (
        <div
          data-export-hide
          className="border-t border-white/10 bg-[#0B0F14]/85"
        >
          {timeline}
        </div>
      )}
    </div>
  );
}
