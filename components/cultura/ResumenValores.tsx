"use client";

/**
 * EL RECUENTO DE LOS VALORES, EN TEXTO (10/11/2026).
 *
 * Lo comparten Dinámicas y Valores (/team-values) e Identidad y Cultura
 * (/identidad-cultura) para que las dos digan la misma cifra: se lee del
 * propio documento de valores, que es dato y no se toca aquí. Cada valor con
 * sus votos, los votos a un valor afín que el recuento le agrupó («+3 a
 * Amistad») dichos aparte, y su antivalor con sus votos.
 *
 * En el móvil es lo que se lee: la miniatura de la diapositiva, a 390 px, no.
 */

import { DOCUMENTO_VALORES } from "@/lib/cultura/documentos/valores";
import { conVotos } from "@/components/cultura/HojaCultura";
import type { Valor } from "@/lib/cultura/modelo";

const VALORES: Valor[] = DOCUMENTO_VALORES.diapositivas.flatMap((d) =>
  d.tipo === "valor" ? [d.valor] : [],
);

/** «Votado por 5 jugadores (+3 Amistad)» → 5. */
export const votosDe = (v: Pick<Valor, "votos">) => Number(conVotos(v.votos).match(/^\d+/)?.[0] ?? 0);

/** «(+3 Amistad)» → { n: 3, a: "Amistad" }, o null. */
const afinDe = (v: Pick<Valor, "votos">) => {
  const m = v.votos.match(/\(\+(\d+)\s+([^)]+)\)/);

  return m ? { n: Number(m[1]), a: m[2].trim() } : null;
};

export const TOTAL_VOTOS_VALORES = VALORES.reduce((t, v) => t + votosDe(v), 0);

const MAX = Math.max(0, ...VALORES.map(votosDe));

export function ResumenValores({ compacto = false }: { compacto?: boolean }) {
  if (!VALORES.length) return null;

  const afines = VALORES.flatMap((v) => {
    const a = afinDe(v);

    return a ? [`+${a.n} a ${a.a}`] : [];
  });

  return (
    <div className="min-w-0">
      <p className="text-xs leading-relaxed text-gray-400">
        Cada cifra son votos del recuento: {TOTAL_VOTOS_VALORES} a los cinco valores
        {afines.length > 0 &&
          `; ${afines.join(" y ")} son votos a un valor afín que el recuento agrupó con el suyo y no entran en los ${TOTAL_VOTOS_VALORES}`}
        . Los antivalores se cuentan aparte.
      </p>

      <ul className="mt-3 space-y-3">
        {VALORES.map((v) => {
          const n = votosDe(v);
          const afin = afinDe(v);

          return (
            <li key={v.numero} className="min-w-0">
              <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
                <span className="min-w-0 break-words font-semibold text-white">
                  {v.numero}. {v.titulo}
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <span
                    className="block h-full rounded-full bg-[#C8A96B]"
                    style={{ width: `${MAX > 0 ? (n / MAX) * 100 : 0}%` }}
                  />
                </span>
                <span className="text-right tabular-nums text-gray-200">
                  {n} {n === 1 ? "voto" : "votos"}
                </span>
              </div>
              {!compacto && (
                <p className="mt-0.5 break-words text-xs leading-relaxed text-gray-400">
                  {afin && (
                    <>
                      +{afin.n} {afin.n === 1 ? "voto" : "votos"} a {afin.a}, aparte ·{" "}
                    </>
                  )}
                  <span className="text-gray-300">Lo que lo destruye:</span> {conVotos(v.antivalores)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
