"use client";

/**
 * CIFRA QUE RUEDA HASTA SU VALOR (22/11/2026).
 *
 * Al entrar en pantalla sube desde cero y, si el valor cambia (otro filtro,
 * otro rival), rueda del anterior al nuevo. El lector de pantalla oye siempre
 * el valor final (span sr-only); lo que se mueve va aria-hidden. Con
 * prefers-reduced-motion se ve el final sin más.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const formatoPorDefecto = (n: number, decimales: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

export function CifraRueda({
  valor,
  decimales = 0,
  formato,
  duracion = 750,
  className,
  style,
}: {
  valor: number;
  decimales?: number;
  formato?: (n: number) => string;
  duracion?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const escribe = (n: number) => (formato ? formato(n) : formatoPorDefecto(n, decimales));
  const [mostrado, setMostrado] = useState(valor);
  const caja = useRef<HTMLSpanElement>(null);
  const desde = useRef<number | null>(null);
  const visto = useRef(false);
  const movil = useRef<HTMLSpanElement>(null);

  /* Si va a rodar desde cero nada más montarse, la cifra no se enseña antes
     entera: se esconde (sólo la parte que se mueve) hasta el primer paso. */
  useLayoutEffect(() => {
    const el = caja.current;
    const m = movil.current;
    if (!el || !m || visto.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) m.style.opacity = "0";
  }, []);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cuadro = 0;
    let observador: IntersectionObserver | null = null;

    const rueda = (inicio: number) => {
      const t0 = performance.now();
      const paso = (t: number) => {
        const k = Math.min(1, (t - t0) / duracion);
        const suave = 1 - Math.pow(1 - k, 3);
        if (movil.current) movil.current.style.opacity = "";
        setMostrado(k >= 1 ? valor : inicio + (valor - inicio) * suave);
        if (k < 1) cuadro = requestAnimationFrame(paso);
      };
      cuadro = requestAnimationFrame(paso);
    };

    if (quieto || typeof IntersectionObserver === "undefined") {
      cuadro = requestAnimationFrame(() => setMostrado(valor));
    } else if (!visto.current) {
      observador = new IntersectionObserver(
        (entradas) => {
          if (!entradas.some((e) => e.isIntersecting)) return;
          visto.current = true;
          observador?.disconnect();
          rueda(0);
        },
        { threshold: 0 },
      );
      observador.observe(el);
    } else {
      rueda(desde.current ?? valor);
    }

    return () => {
      cancelAnimationFrame(cuadro);
      observador?.disconnect();
      desde.current = valor;
    };
  }, [valor, duracion]);

  return (
    <span ref={caja} className={className} style={style}>
      <span className="sr-only">{escribe(valor)}</span>
      <span ref={movil} aria-hidden>{escribe(mostrado)}</span>
    </span>
  );
}
