"use client";

/**
 * TEXTOS DE LOS ANÁLISIS: LO QUE EXPLICA Y LO QUE CONCLUYE.
 *
 * En ABP, saques de banda, faltas y transiciones (02/10/2026):
 *
 * - `<Explicativo>` envuelve lo que cuenta **cómo** se ha hecho el análisis
 *   —de dónde salen los datos, qué cuenta como qué, cómo se lee un panel—. Va
 *   escondido salvo que el administrador lo encienda en Ajustes («Textos
 *   explicativos»).
 * - `<Conclusiones>` es lo contrario: tres o cuatro frases cortas con **qué
 *   dice** lo que se está viendo. Se ve siempre y se calcula con los mismos
 *   datos (y el mismo filtro) que los gráficos.
 *
 * El interruptor se lee una vez por carga de página (`/api/textos`) y se
 * comparte entre todos los `<Explicativo>`; mientras no llega, escondidos.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Lightbulb } from "lucide-react";

let enVuelo: Promise<boolean> | null = null;

const EVENTO = "rmcf-textos";

/** Para que Ajustes, al cambiarlo, lo vuelva a leer sin recargar. */
export function avisaCambioTextos() {
  enVuelo = null;

  window.dispatchEvent(new Event(EVENTO));
}

function leeInterruptor() {
  enVuelo ??= fetch("/api/textos", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ explicativos?: boolean }>)
    .then((d) => Boolean(d.explicativos))
    .catch(() => false);

  return enVuelo;
}

export function useTextosExplicativos() {
  const [encendidos, setEncendidos] = useState(false);

  const [testigo, setTestigo] = useState(0);

  useEffect(() => {
    let cancelado = false;

    leeInterruptor().then((valor) => {
      if (!cancelado) setEncendidos(valor);
    });

    return () => {
      cancelado = true;
    };
  }, [testigo]);

  useEffect(() => {
    const recarga = () => setTestigo((n) => n + 1);

    window.addEventListener(EVENTO, recarga);

    return () => window.removeEventListener(EVENTO, recarga);
  }, []);

  return encendidos;
}

/** Lo que explica el método: sólo si el administrador lo ha encendido. */
export function Explicativo({ children }: { children: ReactNode }) {
  const encendidos = useTextosExplicativos();

  return encendidos ? <>{children}</> : null;
}

/** Las conclusiones de lo que se ve, en pocas palabras. Sin frases, no pinta nada. */
export function Conclusiones({
  items,
  titulo = "Conclusiones",
  className = "",
}: {
  items: (string | null | undefined | false)[];
  titulo?: string;
  className?: string;
}) {
  const frases = items.filter((x): x is string => Boolean(x && x.trim()));

  if (!frases.length) return null;

  return (
    <section
      aria-label={titulo}
      className={`min-w-0 rounded-2xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.05] px-4 py-3 sm:px-5 ${className}`}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B]">
        <Lightbulb size={12} aria-hidden />
        {titulo}
      </p>
      <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[13px] leading-snug text-white/80 md:grid-cols-2">
        {frases.map((frase) => (
          <li key={frase} className="flex min-w-0 gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#C8A96B]" aria-hidden />
            <span className="min-w-0">{frase}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
