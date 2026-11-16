"use client";

/**
 * EL ÍNDICE DE LOS VALORES (16/11/2026).
 *
 * Los cinco valores como láminas pinchables: el número grande, el valor, sus
 * votos en una barra de oro con su base («9 de 32 votos») y lo que lo
 * destruye en una segunda barra granate con los suyos. Cada lámina abre su
 * diapositiva de «Conductas» en la vista previa (`#diapo-N`, que lee
 * `RepositorioCultura` con `enlazaUrl`).
 *
 * Es el único sitio con el recuento completo: /team-values enseña una línea
 * con enlace a cada valor (`EnlacesValores`) y no repite las barras.
 *
 * Lee el documento de valores, que es dato y no se toca aquí.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DOCUMENTO_VALORES } from "@/lib/cultura/documentos/valores";
import { COLORES_CULTURA } from "@/lib/cultura/modelo";
import type { Valor } from "@/lib/cultura/modelo";
import { TOTAL_VOTOS_VALORES, votosDe } from "@/components/cultura/ResumenValores";

type ValorIndice = Valor & { diapositiva: number };

/** Cada valor con el número (1…) de su diapositiva de conductas, o de la del valor si no la hay. */
export const VALORES_INDICE: ValorIndice[] = DOCUMENTO_VALORES.diapositivas.flatMap((d, i, todas) => {
  if (d.tipo !== "valor") return [];

  const conductas = todas.findIndex((x) => x.tipo === "conductas" && x.valor.numero === d.valor.numero);

  return [{ ...d.valor, diapositiva: (conductas >= 0 ? conductas : i) + 1 }];
});

/** «Egoísmo (22) y Arrogancia (3)» → [{ nombre: "Egoísmo", votos: 22 }, …]; sin cifra, votos null. */
export const antivaloresDe = (texto: string) =>
  texto
    .split(/\s*(?:,|\by\b|\be\b)\s*/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^(.*?)\s*\((\d+)\)$/);

      return m ? { nombre: m[1], votos: Number(m[2]) } : { nombre: t, votos: null as number | null };
    });

/** «(+3 Amistad)» → «+3 a Amistad». */
const afinDe = (v: Pick<Valor, "votos">) => {
  const m = v.votos.match(/\(\+(\d+)\s+([^)]+)\)/);

  return m ? `+${m[1]} a ${m[2].trim()}` : "";
};

export const hrefConductas = (v: ValorIndice) => `/identidad-cultura#diapo-${v.diapositiva}`;

const MAX_ANTI = Math.max(1, ...VALORES_INDICE.flatMap((v) => antivaloresDe(v.antivalores).map((a) => a.votos ?? 0)));
const MAX_VOTOS = Math.max(1, ...VALORES_INDICE.map(votosDe));

/** Salta a la diapositiva en la misma pantalla: cambia el ancla y baja a la vista previa. */
function irA(n: number) {
  window.history.replaceState(null, "", `#diapo-${n}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  document.getElementById("vista-previa-cultura")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ValoresIndice() {
  if (!VALORES_INDICE.length) return null;

  return (
    <section aria-labelledby="indice-valores" className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="indice-valores" className="text-lg font-semibold text-white sm:text-xl">
          Los cinco valores y lo que los destruye
        </h2>
        <p className="text-xs text-gray-400">
          {TOTAL_VOTOS_VALORES} votos a los cinco valores; los antivalores, aparte. Pulsa un valor para ver sus conductas.
        </p>
      </div>

      <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {VALORES_INDICE.map((v) => {
          const n = votosDe(v);
          const anti = antivaloresDe(v.antivalores);
          const afin = afinDe(v);

          return (
            <li key={v.numero} className="min-w-0">
              <button
                type="button"
                onClick={() => irA(v.diapositiva)}
                className="group flex h-full w-full min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#C8A96B]/60 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]"
              >
                <span className="text-4xl font-black leading-none tabular-nums text-red-400" aria-hidden>
                  {String(v.numero).padStart(2, "0")}
                </span>
                <span className="mt-2 break-words text-base font-bold uppercase tracking-wide text-white">
                  {v.titulo}
                </span>

                <span className="mt-3 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--rmcf-gold-ink,#C8A96B)]">
                  Lo votaron
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <span className="block h-full rounded-full bg-[#C8A96B]" style={{ width: `${(n / MAX_VOTOS) * 100}%` }} />
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                    {n} de {TOTAL_VOTOS_VALORES}
                  </span>
                </span>
                {afin && <span className="mt-1 text-[12px] text-gray-400">{afin} (aparte)</span>}

                <span className="mt-3 block text-[12px] font-semibold uppercase tracking-[0.12em] text-red-400">
                  Lo destruye
                </span>
                <span className="mt-1 space-y-1">
                  {anti.map((a) => (
                    <span key={a.nombre} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-gray-200">{a.nombre}</span>
                      {a.votos !== null && (
                        <>
                          <span className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-white/[0.08]">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${(a.votos / MAX_ANTI) * 100}%`, background: COLORES_CULTURA.granate }}
                            />
                          </span>
                          <span className="w-6 shrink-0 text-right tabular-nums text-gray-300">{a.votos}</span>
                        </>
                      )}
                    </span>
                  ))}
                </span>

                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)]">
                  Sus conductas
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * La línea de /team-values: el más votado con su base y un chip por valor que
 * abre sus conductas en /identidad-cultura. Sin barras: el recuento completo
 * vive en una sola pantalla.
 */
export function EnlacesValores() {
  if (!VALORES_INDICE.length) return null;

  const primero = [...VALORES_INDICE].sort((a, b) => votosDe(b) - votosDe(a))[0];

  return (
    <div className="min-w-0">
      <p className="text-sm text-gray-300">
        <span className="font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)]">Resultado de la votación:</span>{" "}
        {primero.titulo}, el más votado ({votosDe(primero)} de {TOTAL_VOTOS_VALORES} votos).{" "}
        <Link href="/identidad-cultura" className="font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)] hover:underline">
          Ver el recuento y el documento →
        </Link>
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {VALORES_INDICE.map((v) => (
          <li key={v.numero}>
            <Link
              href={hrefConductas(v)}
              title={`Conductas de ${v.titulo}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-sm text-gray-200 transition-colors hover:border-[#C8A96B]/60 hover:text-white"
            >
              <span className="font-bold tabular-nums text-red-400">
                {v.numero}
              </span>
              {v.titulo}
              <span aria-hidden className="text-[color:var(--rmcf-gold-ink,#C8A96B)]">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
