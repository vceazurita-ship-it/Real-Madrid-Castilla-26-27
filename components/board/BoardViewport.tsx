"use client";

/**
 * Visor de las pizarras de análisis.
 *
 * Los mapas de ABP, los de saques de banda y los diagramas de flujo se dibujan
 * en un SVG de tamaño fijo. Con muchas acciones encima se convierten en una
 * maraña de discos y flechas que no hay forma de leer, y no había manera de
 * acercarse a una zona ni de mover el campo.
 *
 * Este componente envuelve ese SVG y le pone encima una cámara plana —zoom y
 * desplazamiento— sin tocar ni una línea del dibujo. Es la hermana sencilla de
 * `usePitchCamera`: aquí no hace falta perspectiva, así que basta con
 * `translate` y `scale` de CSS y el visor sirve para cualquier tablero.
 *
 * Los gestos son los mismos que en la pizarra táctica, para no tener que
 * aprenderse dos:
 *
 * - Rueda para el zoom sobre el punto que hay bajo el cursor. Ctrl o ⌘ siempre
 *   funcionan; la rueda sola, en cuanto se ha tocado el tablero. Si no, la
 *   página se quedaría enganchada al pasar por encima, así que aparece un
 *   aviso en lugar de robarle el desplazamiento.
 * - Pinchar y arrastrar desplaza. El botón central y el derecho también.
 * - Dos dedos pellizcan; con zoom, un dedo desplaza.
 * - Doble clic vuelve al encuadre completo, y también la tecla 0.
 * - Con el foco puesto: flechas para desplazar, + y − para el zoom.
 *
 * Un clic que no ha movido el puntero sigue llegando al dibujo, así que
 * seleccionar una zona funciona igual que antes; en cuanto el gesto se
 * convierte en arrastre, el clic se descarta y no se abre ningún panel.
 *
 * El encuadre está siempre sujeto: el contenido no se puede sacar del marco y,
 * mientras quepa entero, se queda centrado. Por eso el visor también sustituye
 * al `overflow-x-auto` de los diagramas de flujo, que en el móvil obligaba a
 * pelearse con una barra de desplazamiento.
 */

import {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Minus, Plus, Scan } from "lucide-react";

import { cn } from "@/lib/utils";

/** Encuadre: cuánto se ha acercado la cámara y cuánto se ha desplazado. */
type View = { scale: number; x: number; y: number };

/** Arrastre en curso. */
type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  /** Falso hasta que el puntero se mueve lo justo para no ser un clic. */
  active: boolean;
};

/** Pellizco en curso: separación y punto medio de los dos dedos. */
type Pinch = { dist: number; mx: number; my: number };

interface Props {
  /** El tablero. Normalmente un único SVG. */
  children: ReactNode;
  /** Clases del marco recortado. */
  className?: string;
  /** Clases de la capa que se mueve. Útil si el dibujo es más ancho que el marco. */
  contentClassName?: string;
  minZoom?: number;
  maxZoom?: number;
  /** Nombre del tablero para los lectores de pantalla. */
  label?: string;
}

const IDENTITY: View = { scale: 1, x: 0, y: 0 };

/** Píxeles que hay que recorrer para que un clic pase a ser un arrastre. */
const DRAG_SLOP = 4;

/** Paso del teclado, en píxeles y en factor de zoom. */
const KEY_PAN = 48;
const KEY_ZOOM = 1.2;

export default function BoardViewport({
  children,
  className,
  contentClassName,
  minZoom = 1,
  maxZoom = 6,
  label = "Tablero",
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<View>(IDENTITY);

  /** Último encuadre ya confirmado, para consultarlo desde los gestos. */
  const viewRef = useRef<View>(IDENTITY);

  const drag = useRef<Drag | null>(null);
  const pinch = useRef<Pinch | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  /** El gesto ha sido un arrastre: hay que tragarse el clic que viene detrás. */
  const dragged = useRef(false);

  const [panning, setPanning] = useState(false);

  /** El tablero ya ha recibido un clic: a partir de ahí la rueda es suya. */
  const [engaged, setEngaged] = useState(false);

  /** Aviso de que la rueda sola todavía no hace zoom. */
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Sobra dibujo por los bordes, así que arrastrar sirve de algo. */
  const [pannable, setPannable] = useState(false);

  const zoomed = view.scale > minZoom + 0.001;

  /**
   * Deja el encuadre dentro de lo razonable.
   *
   * El zoom se queda entre los topes y el contenido no puede salirse del
   * marco: mientras quepa entero se centra, y en cuanto no cabe sólo se puede
   * desplazar hasta que su borde toca el del marco.
   */
  const clampView = useCallback(
    (next: View): View => {
      const scale = Math.min(maxZoom, Math.max(minZoom, next.scale));

      const frame = frameRef.current;
      const content = contentRef.current;

      if (!frame || !content) return { scale, x: next.x, y: next.y };

      const frameW = frame.clientWidth;
      const frameH = frame.clientHeight;
      const contentW = content.offsetWidth * scale;
      const contentH = content.offsetHeight * scale;

      const x =
        contentW <= frameW
          ? (frameW - contentW) / 2
          : Math.min(0, Math.max(frameW - contentW, next.x));

      const y =
        contentH <= frameH
          ? (frameH - contentH) / 2
          : Math.min(0, Math.max(frameH - contentH, next.y));

      return { scale, x, y };
    },
    [maxZoom, minZoom]
  );

  const applyView = useCallback(
    (update: (previous: View) => View) => {
      setView((previous) => clampView(update(previous)));
    },
    [clampView]
  );

  /** Acerca o aleja dejando quieto el punto de la pantalla que se indique. */
  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const frame = frameRef.current;
      if (!frame) return;

      const rect = frame.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;

      applyView((previous) => {
        const scale = Math.min(
          maxZoom,
          Math.max(minZoom, previous.scale * factor)
        );

        const ratio = scale / previous.scale;

        return {
          scale,
          x: px - (px - previous.x) * ratio,
          y: py - (py - previous.y) * ratio,
        };
      });
    },
    [applyView, maxZoom, minZoom]
  );

  /** Zoom desde los botones y el teclado: el centro del marco se queda quieto. */
  const zoomCentered = useCallback(
    (factor: number) => {
      const frame = frameRef.current;
      if (!frame) return;

      const rect = frame.getBoundingClientRect();

      zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomAt]
  );

  const reset = useCallback(() => {
    setView(clampView(IDENTITY));
  }, [clampView]);

  /** Mira si sobra dibujo por los bordes, que es lo que habilita el arrastre. */
  const measure = useCallback(() => {
    const frame = frameRef.current;
    const content = contentRef.current;

    if (!frame || !content) return;

    const { scale } = viewRef.current;

    setPannable(
      content.offsetWidth * scale > frame.clientWidth + 1 ||
        content.offsetHeight * scale > frame.clientHeight + 1
    );
  }, []);

  useEffect(() => {
    viewRef.current = view;
    measure();
  }, [measure, view]);

  /** Al cambiar el tamaño del marco hay que volver a sujetar el encuadre. */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new ResizeObserver(() => {
      measure();
      applyView((previous) => previous);
    });

    observer.observe(frame);

    const content = contentRef.current;
    if (content) observer.observe(content);

    return () => observer.disconnect();
  }, [applyView, measure]);

  /**
   * La rueda hace zoom sobre el cursor.
   *
   * React registra `wheel` en modo pasivo y aquí hay que cancelar el
   * desplazamiento de la página, así que se engancha a mano.
   */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const onWheel = (event: WheelEvent) => {
      const forced = event.ctrlKey || event.metaKey;

      // Sin haber tocado el tablero, la página manda: la rueda la desplaza.
      if (!forced && !engaged) {
        setHint(true);

        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(false), 2200);

        return;
      }

      event.preventDefault();
      setHint(false);

      // Hay ratones que miden en líneas o en páginas; se pasa todo a píxeles.
      const delta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
          ? event.deltaY * 400
          : event.deltaY;

      // El pellizco del trackpad manda saltos grandes; se suaviza el paso.
      const step = Math.min(0.25, Math.abs(delta) / 400 + 0.05);

      zoomAt(
        delta < 0 ? 1 + step : 1 / (1 + step),
        event.clientX,
        event.clientY
      );
    };

    frame.addEventListener("wheel", onWheel, { passive: false });

    return () => frame.removeEventListener("wheel", onWheel);
  }, [engaged, zoomAt]);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    []
  );

  /**
   * Seguimiento del gesto.
   *
   * Vive en `window` y no en el marco: así el arrastre no se corta al salirse
   * del tablero, que es justo lo que pasa al acercarse a un borde.
   */
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (pointers.current.has(event.pointerId)) {
        pointers.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      }

      // Dos dedos: pellizco. Manda sobre el arrastre de un dedo.
      if (pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());

        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;

        const previousPinch = pinch.current;
        pinch.current = { dist, mx, my };

        if (!previousPinch) return;

        const frame = frameRef.current;
        if (!frame) return;

        const rect = frame.getBoundingClientRect();
        const px = mx - rect.left;
        const py = my - rect.top;

        const factor = previousPinch.dist > 0 ? dist / previousPinch.dist : 1;

        dragged.current = true;

        applyView((previous) => {
          const scale = Math.min(
            maxZoom,
            Math.max(minZoom, previous.scale * factor)
          );

          const ratio = scale / previous.scale;

          return {
            scale,
            // Acercar sobre el punto medio y, además, seguirlo si se mueve.
            x: px - (px - previous.x) * ratio + (mx - previousPinch.mx),
            y: py - (py - previous.y) * ratio + (my - previousPinch.my),
          };
        });

        return;
      }

      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;

      if (!current.active) {
        if (Math.hypot(dx, dy) < DRAG_SLOP) return;

        current.active = true;
        dragged.current = true;
        setPanning(true);
      }

      applyView((previous) => ({
        scale: previous.scale,
        x: current.originX + dx,
        y: current.originY + dy,
      }));
    };

    const onPointerUp = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);

      if (pointers.current.size < 2) pinch.current = null;

      if (drag.current?.pointerId === event.pointerId) {
        drag.current = null;
        setPanning(false);
      }
    };

    /** Pinchar fuera devuelve la rueda a la página. */
    const onWindowPointerDown = (event: PointerEvent) => {
      const frame = frameRef.current;
      if (!frame) return;

      if (!frame.contains(event.target as Node)) setEngaged(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("pointerdown", onWindowPointerDown, true);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("pointerdown", onWindowPointerDown, true);
    };
  }, [applyView, maxZoom, minZoom]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { x, y } = viewRef.current;

    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: x,
      originY: y,
      active: false,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragged.current = false;
    setEngaged(true);
    setHint(false);

    if (event.pointerType === "touch") {
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (pointers.current.size === 2) {
        // El segundo dedo convierte el gesto en pellizco.
        drag.current = null;
        setPanning(false);
        pinch.current = null;

        return;
      }

      // Un dedo sólo desplaza si hay zoom; si no, la página sigue subiendo.
      if (pointers.current.size === 1 && viewRef.current.scale > minZoom) {
        startDrag(event);
      }

      return;
    }

    // Botón central y derecho desplazan siempre; el izquierdo, sólo cuando
    // sobra dibujo por los bordes. Así un clic normal llega al tablero.
    const wantsPan =
      event.button === 1 ||
      event.button === 2 ||
      (event.button === 0 && pannable);

    if (!wantsPan) return;

    if (event.button !== 0) event.preventDefault();

    startDrag(event);
  };

  /** Si el gesto ha sido un arrastre, el clic no debe abrir ningún panel. */
  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragged.current) return;

    dragged.current = false;

    event.stopPropagation();
    event.preventDefault();
  };

  const handleDoubleClick = () => {
    if (zoomed) reset();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => applyView((v) => ({ ...v, x: v.x + KEY_PAN })),
      ArrowRight: () => applyView((v) => ({ ...v, x: v.x - KEY_PAN })),
      ArrowUp: () => applyView((v) => ({ ...v, y: v.y + KEY_PAN })),
      ArrowDown: () => applyView((v) => ({ ...v, y: v.y - KEY_PAN })),
      "+": () => zoomCentered(KEY_ZOOM),
      "=": () => zoomCentered(KEY_ZOOM),
      "-": () => zoomCentered(1 / KEY_ZOOM),
      "0": () => reset(),
    };

    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    move();
  };

  /**
   * En táctil se respeta el desplazamiento vertical de la página mientras el
   * tablero esté en su sitio; con zoom, el dedo se queda con el gesto.
   */
  const touchAction = view.scale > minZoom ? "none" : "pan-y";

  const frameStyle: CSSProperties = {
    touchAction,
    cursor: panning ? "grabbing" : pannable ? "grab" : undefined,
    userSelect: panning ? "none" : undefined,
  };

  return (
    <div
      ref={frameRef}
      role="application"
      tabIndex={0}
      aria-label={`${label}. Rueda para el zoom, arrastrar para desplazar, doble clic para volver al encuadre completo.`}
      style={frameStyle}
      onPointerDown={handlePointerDown}
      onClickCapture={handleClickCapture}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onFocus={() => setEngaged(true)}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => {
        if (pannable) event.preventDefault();
      }}
      className={cn(
        // `isolate` encierra los mandos: sin él se colaban por encima de los
        // paneles de detalle que el tablero abre a su lado.
        "relative isolate overflow-hidden outline-none",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8A96B]/50",
        className
      )}
    >
      <div
        ref={contentRef}
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          transformOrigin: "0 0",
          willChange: panning ? "transform" : undefined,
        }}
        className={cn("relative h-full w-full", contentClassName)}
      >
        {children}
      </div>

      {/* MANDOS */}

      <div
        data-export-hide
        className="absolute bottom-2 right-2 z-20 flex flex-col items-center gap-1 opacity-60 transition-opacity focus-within:opacity-100 hover:opacity-100"
      >
        {/* El nivel de zoom va con los mandos: suelto por las esquinas se
            chocaba con las leyendas que algunos tableros llevan encima. */}
        {zoomed && (
          <div className="pointer-events-none mb-0.5 rounded-lg bg-[#07111F]/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 backdrop-blur">
            {Math.round(view.scale * 100)}%
          </div>
        )}

        <button
          type="button"
          onClick={() => zoomCentered(KEY_ZOOM)}
          title="Acercar"
          aria-label="Acercar"
          className="rounded-lg border border-white/10 bg-[#07111F]/85 p-1.5 text-slate-200 backdrop-blur transition hover:border-[#C8A96B]/40 hover:text-white"
        >
          <Plus size={14} />
        </button>

        <button
          type="button"
          onClick={() => zoomCentered(1 / KEY_ZOOM)}
          title="Alejar"
          aria-label="Alejar"
          className="rounded-lg border border-white/10 bg-[#07111F]/85 p-1.5 text-slate-200 backdrop-blur transition hover:border-[#C8A96B]/40 hover:text-white"
        >
          <Minus size={14} />
        </button>

        <button
          type="button"
          onClick={reset}
          disabled={!zoomed}
          title="Encuadre completo"
          aria-label="Volver al encuadre completo"
          className="rounded-lg border border-white/10 bg-[#07111F]/85 p-1.5 text-slate-200 backdrop-blur transition hover:border-[#C8A96B]/40 hover:text-white disabled:opacity-35 disabled:hover:border-white/10 disabled:hover:text-slate-200"
        >
          <Scan size={14} />
        </button>
      </div>

      {/* AVISO DE LA RUEDA */}

      {hint && (
        <div
          data-export-hide
          className="pointer-events-none absolute inset-x-0 top-2 z-20 mx-auto w-fit max-w-[90%] rounded-lg bg-[#07111F]/90 px-3 py-1.5 text-center text-[11px] text-slate-200 backdrop-blur"
        >
          Ctrl + rueda para el zoom, o pincha el tablero primero
        </div>
      )}
    </div>
  );
}
