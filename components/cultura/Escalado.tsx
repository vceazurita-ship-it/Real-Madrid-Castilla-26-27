"use client";

/**
 * Encoge un lienzo de medida fija para que quepa en la columna.
 *
 * El documento se dibuja **siempre** a tamaño real —1920×1080, la diapositiva
 * de PowerPoint— y aquí sólo se escala. Así lo que se ve en pantalla y lo que
 * sale al exportar no pueden separarse: es el mismo dibujo, no dos versiones
 * del mismo documento.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Escalado({
  ancho,
  alto,
  children,
}: {
  ancho: number;
  alto: number;
  children: ReactNode;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);

  const [escala, setEscala] = useState(0.4);

  useEffect(() => {
    const marco = marcoRef.current;

    if (!marco) return;

    const mide = () => setEscala(marco.clientWidth / ancho);

    mide();

    const observador = new ResizeObserver(mide);

    observador.observe(marco);

    return () => observador.disconnect();
  }, [ancho]);

  return (
    <div ref={marcoRef} className="w-full" style={{ height: alto * escala }}>
      <div
        style={{
          width: ancho,
          transform: `scale(${escala})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
