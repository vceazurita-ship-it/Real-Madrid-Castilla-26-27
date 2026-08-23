"use client";

/**
 * Escenario de la pizarra.
 *
 * Envuelve el campo (un SVG cualquiera) en el contenedor con perspectiva que
 * mueve `usePitchCamera`, y coloca alrededor las piezas fijas de la interfaz.
 *
 * Hay dos repartos, y los dos reciben las mismas piezas:
 *
 * - En pantalla grande flotan sobre el césped: la barra de cámara arriba a la
 *   derecha, la paleta a la izquierda y el estilo del trazo abajo.
 * - En móvil bajan a un muelle bajo el campo. Flotando tapaban casi todo el
 *   césped —la paleta sola es más alta que el campo de un teléfono— y no se
 *   veía ni la jugada ni lo que se estaba dibujando.
 *
 * El campo, además, nunca es más alto que la pantalla: se estrecha antes que
 * salirse, así que en apaisado o con un recorte vertical se sigue viendo
 * entero sin desplazarse.
 *
 * El SVG que se le pasa no sabe nada de la cámara: sigue dibujando en su
 * espacio de campo. Por eso el mismo escenario vale para cualquier tablero.
 *
 * Aquí viven además los atajos de cámara que funcionan sin soltar la
 * herramienta que se esté usando: rueda central o botón derecho para
 * desplazar, Alt para orbitar, Ctrl/⌘ + rueda para el zoom y dos dedos para
 * pellizcar. Sin ellos había que ir a la paleta y volver cada vez que se
 * quería mirar la jugada desde otro sitio.
 */

import {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Maximize2, Minimize2 } from "lucide-react";

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
  /**
   * Aviso de que un atajo se ha quedado con el gesto.
   *
   * El tablero lo usa para tirar el trazo a medias o soltar la ficha que
   * estuviera arrastrando, y que mover la cámara no deje un garabato.
   */
  onGestureStart?: () => void;
  /** El campo. */
  children: ReactNode;
  /** Barra de modos de cámara flotante (arriba a la derecha). */
  cameraBar?: ReactNode;
  /** Paleta de herramientas flotante (a la izquierda). */
  toolbar?: ReactNode;
  /** Selector de color, grosor y trazo flotante (abajo a la izquierda). */
  styleBar?: ReactNode;
  /** Paleta de herramientas del muelle del móvil, en horizontal. */
  dockToolbar?: ReactNode;
  /**
   * Panel contextual del muelle del móvil.
   *
   * Es el estilo del trazo mientras se dibuja y los mandos de cámara el resto
   * del tiempo, así que bajo la paleta solo hay una fila más.
   */
  dockPanel?: ReactNode;
  /** Reproductor y línea de tiempo (bajo el campo). */
  timeline?: ReactNode;
  className?: string;
}

/** Paso del teclado, en grados y en píxeles. */
const KEY_ORBIT = 4;
const KEY_PAN = 24;

export default function PitchStage({
  camera,
  aspect,
  navigable,
  frameRef,
  onGestureStart,
  children,
  cameraBar,
  toolbar,
  styleBar,
  dockToolbar,
  dockPanel,
  timeline,
  className,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);

  /** Pizarra a pantalla completa: en el móvil es lo que la hace grande. */
  const [expanded, setExpanded] = useState(false);

  const {
    attachContainer,
    attachPlane,
    containerStyle,
    planeStyle,
    navigating,
    navigationHandlers,
    beginNavigation,
    orbitBy,
    panBy,
    zoomBy,
    reset,
    render,
  } = camera;

  /**
   * Proporción del encuadre como número, para poder limitar la altura.
   *
   * El recorte del último tercio es más alto que ancho: sin ese tope ocupaba
   * más de una pantalla de teléfono y había que desplazarse para verlo.
   */
  const ratio = useMemo(() => {
    const [width, height] = aspect.split("/").map(Number);

    return height > 0 ? width / height : 100 / 68;
  }, [aspect]);

  /** Con la pizarra ampliada la página no se mueve detrás, y Esc la cierra. */
  useEffect(() => {
    if (!expanded) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  /**
   * La rueda hace zoom sobre el punto que hay bajo el cursor.
   *
   * Con la herramienta de cámara basta girarla; con cualquier otra hace
   * falta Ctrl o ⌘, que es además lo que envía el pellizco del trackpad.
   * En ambos casos hay que cancelar el desplazamiento de la página, y React
   * registra `wheel` en modo pasivo, así que se engancha a mano.
   */
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      const zooming = navigable || event.ctrlKey || event.metaKey;
      if (!zooming) return;

      event.preventDefault();

      // El pellizco del trackpad manda saltos grandes; se suaviza el paso.
      const step = Math.min(0.2, Math.abs(event.deltaY) / 400 + 0.04);

      zoomBy(event.deltaY < 0 ? 1 + step : 1 / (1 + step), {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    element.addEventListener("wheel", onWheel, { passive: false });

    return () => element.removeEventListener("wheel", onWheel);
  }, [navigable, zoomBy]);

  /**
   * Atajos de cámara mientras se dibuja o se mueven fichas.
   *
   * Se escuchan en captura para adelantarse al SVG: si el gesto es de
   * cámara, el dibujo ni se entera.
   */
  useEffect(() => {
    const element = stageRef.current;
    if (!element || navigable) return;

    /** Dedos apoyados ahora mismo sobre el campo. */
    const touches = new Map<number, { x: number; y: number }>();

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });

        // Un dedo dibuja; el segundo convierte el gesto en pellizco.
        if (touches.size !== 2) return;

        event.preventDefault();
        event.stopPropagation();
        onGestureStart?.();

        for (const [pointerId, point] of touches) {
          beginNavigation(
            { pointerId, clientX: point.x, clientY: point.y },
            "pan"
          );
        }

        return;
      }

      // Rueda central o botón derecho: desplazar. Alt: orbitar.
      const kind =
        event.button === 1 || event.button === 2
          ? ("pan" as const)
          : event.altKey
          ? event.shiftKey
            ? ("pan" as const)
            : ("orbit" as const)
          : null;

      if (!kind) return;

      event.preventDefault();
      event.stopPropagation();
      onGestureStart?.();
      beginNavigation(event, kind);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      if (!touches.has(event.pointerId)) return;

      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };

    const onPointerUp = (event: PointerEvent) => {
      touches.delete(event.pointerId);
    };

    // El menú contextual estorba al usar el botón derecho para desplazar.
    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    element.addEventListener("pointerdown", onPointerDown, { capture: true });
    element.addEventListener("pointermove", onPointerMove, { capture: true });
    element.addEventListener("pointerup", onPointerUp, { capture: true });
    element.addEventListener("pointercancel", onPointerUp, { capture: true });
    element.addEventListener("contextmenu", onContextMenu);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
      element.removeEventListener("pointermove", onPointerMove, {
        capture: true,
      });
      element.removeEventListener("pointerup", onPointerUp, { capture: true });
      element.removeEventListener("pointercancel", onPointerUp, {
        capture: true,
      });
      element.removeEventListener("contextmenu", onContextMenu);
    };
  }, [beginNavigation, navigable, onGestureStart]);

  /** Flechas para orbitar, con Mayús para desplazar; +/- zoom y 0 reinicia. */
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const pan = event.shiftKey;

    const moves: Record<string, () => void> = {
      ArrowLeft: () => (pan ? panBy(KEY_PAN, 0) : orbitBy(-KEY_ORBIT, 0)),
      ArrowRight: () => (pan ? panBy(-KEY_PAN, 0) : orbitBy(KEY_ORBIT, 0)),
      ArrowUp: () => (pan ? panBy(0, KEY_PAN) : orbitBy(0, KEY_ORBIT)),
      ArrowDown: () => (pan ? panBy(0, -KEY_PAN) : orbitBy(0, -KEY_ORBIT)),
      "+": () => zoomBy(1.12),
      "=": () => zoomBy(1.12),
      "-": () => zoomBy(1 / 1.12),
      "0": () => reset(),
    };

    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    move();
  };

  return (
    <div
      ref={frameRef}
      className={cn(
        "flex flex-col overflow-hidden bg-[#07120C]",
        expanded
          ? "fixed inset-0 z-[70] rounded-none"
          : "rounded-[26px] border border-[#C8A96B]/20 shadow-[0_25px_80px_rgba(0,0,0,.5)]",
        className
      )}
    >
      <div
        ref={stageRef}
        className={cn(
          "relative",
          expanded && "flex min-h-0 flex-1 items-center justify-center"
        )}
      >
        {/* Fondo del estadio: al inclinar el campo queda hueco alrededor. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_120%,rgba(200,169,107,.10),transparent_62%),radial-gradient(100%_70%_at_50%_-12%,rgba(6,14,10,.95),transparent_58%)]"
        />

        {/* CONTENEDOR DE PERSPECTIVA */}

        <div
          data-expanded={expanded ? "true" : undefined}
          style={{ "--pitch-ratio": ratio } as CSSProperties}
          className="pitch-stage-fit mx-auto w-full"
        >
          <div
            ref={attachContainer}
            style={{ ...containerStyle, aspectRatio: aspect }}
            className="relative w-full"
          >
            {/* El plano del campo: aquí se escribe la matriz de la cámara. */}
            <div
              ref={attachPlane}
              style={planeStyle}
              className="absolute inset-0"
            >
              {children}
            </div>
          </div>
        </div>

        {/*
          Capa de navegación. Solo existe con la herramienta de cámara activa,
          así el dibujo y el arrastre de fichas siguen recibiendo el puntero.
        */}
        {navigable && (
          <div
            data-export-hide
            tabIndex={0}
            role="application"
            aria-label="Navegación de la cámara. Flechas para orbitar, Mayús y flechas para desplazar, más y menos para el zoom, cero para reiniciar."
            {...navigationHandlers}
            onKeyDown={handleKeyDown}
            className={cn(
              "absolute inset-0 z-20 touch-none outline-none ring-inset focus-visible:ring-2 focus-visible:ring-[#C8A96B]/60",
              navigating ? "cursor-grabbing" : "cursor-grab"
            )}
          />
        )}

        {/* AYUDA DE NAVEGACIÓN */}

        {(navigable || render === "3d") && (
          <p
            data-export-hide
            className="pointer-events-none absolute bottom-3 right-14 z-30 hidden max-w-[52%] rounded-lg bg-[#0B0F14]/75 px-2 py-1 text-right text-[10px] leading-tight text-white/45 backdrop-blur-sm sm:block"
          >
            {navigable
              ? "Arrastra para orbitar · Mayús o botón derecho para desplazar · rueda para el zoom"
              : "Alt + arrastrar orbita · botón central o derecho desplaza · Ctrl + rueda hace zoom"}
          </p>
        )}

        {/* PANTALLA COMPLETA */}

        <button
          type="button"
          data-export-hide
          onClick={() => setExpanded((value) => !value)}
          title={
            expanded ? "Salir de pantalla completa" : "Ver a pantalla completa"
          }
          aria-pressed={expanded}
          className="absolute bottom-2.5 right-2.5 z-30 rounded-xl border border-white/12 bg-[#0B0F14]/85 p-2 text-white/60 backdrop-blur-md transition hover:text-white sm:bottom-3 sm:right-3"
        >
          {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* BARRA DE CÁMARA */}

        {cameraBar && (
          <div
            data-export-hide
            className="absolute right-2.5 top-2.5 z-30 hidden pitch-float:block lg:right-3 lg:top-3"
          >
            {cameraBar}
          </div>
        )}

        {/* PALETA DE HERRAMIENTAS */}

        {toolbar && (
          <div
            data-export-hide
            className="absolute left-2.5 top-2.5 z-30 hidden pitch-float:block lg:left-3 lg:top-3"
          >
            {toolbar}
          </div>
        )}

        {/* ESTILO DEL TRAZO */}

        {styleBar && (
          <div
            data-export-hide
            className="absolute bottom-2.5 left-2.5 z-30 hidden pitch-float:block lg:bottom-3 lg:left-3"
          >
            {styleBar}
          </div>
        )}
      </div>

      {/* MUELLE DEL MÓVIL */}

      {(dockToolbar || dockPanel) && (
        <div
          data-export-hide
          className={cn(
            "shrink-0 overflow-y-auto border-t border-white/10 bg-[#0B0F14]/85 pitch-float:hidden",
            // A pantalla completa nada puede empujar al reproductor fuera.
            expanded && "max-h-[30svh]"
          )}
        >
          {dockToolbar && <div className="p-2">{dockToolbar}</div>}

          {dockPanel && (
            <div className="border-t border-white/[0.06] p-2">{dockPanel}</div>
          )}
        </div>
      )}

      {/* REPRODUCTOR */}

      {timeline && (
        <div
          data-export-hide
          className={cn(
            "shrink-0 overflow-y-auto border-t border-white/10 bg-[#0B0F14]/85",
            expanded && "max-h-[24svh]"
          )}
        >
          {timeline}
        </div>
      )}
    </div>
  );
}
