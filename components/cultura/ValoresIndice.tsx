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

/*
| 17/11/2026 (fútbol, marketing y guionista): los antivalores llevan su base
| («55 votos aparte») y en cada valor sólo salen los que tienen recuento. Un
| antivalor sin cifra que ya cuenta en otro valor (Conformismo, en el 5 y en
| el 2) no se repite; el que no tiene cifra en ninguno va como «también».
*/
export const TOTAL_VOTOS_ANTIVALORES = VALORES_INDICE.reduce(
  (t, v) => t + antivaloresDe(v.antivalores).reduce((s, a) => s + (a.votos ?? 0), 0),
  0,
);

const CON_RECUENTO = new Map(
  VALORES_INDICE.flatMap((v) =>
    antivaloresDe(v.antivalores).flatMap((a) => (a.votos !== null ? [[a.nombre.toLowerCase(), v] as const] : [])),
  ),
);

export function antivaloresDelValor(v: ValorIndice) {
  const todos = antivaloresDe(v.antivalores);

  return {
    conVotos: todos.filter((a) => a.votos !== null) as { nombre: string; votos: number }[],
    tambien: todos.filter((a) => a.votos === null && !CON_RECUENTO.has(a.nombre.toLowerCase())).map((a) => a.nombre),
  };
}

/** El seguimiento de los jugadores: es donde se apuntan las conductas del día a día. */
export const HREF_SEGUIMIENTO = "/individual_proc";

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
          {TOTAL_VOTOS_VALORES} votos a los cinco valores y {TOTAL_VOTOS_ANTIVALORES} a los antivalores, contados aparte. Pulsa un
          valor para ver sus conductas.
        </p>
      </div>

      <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {VALORES_INDICE.map((v) => {
          const n = votosDe(v);
          const anti = antivaloresDelValor(v);
          const afin = afinDe(v);

          return (
            <li
              key={v.numero}
              className="group flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[#C8A96B]/60 hover:bg-white/[0.05]"
            >
              <button
                type="button"
                onClick={() => irA(v.diapositiva)}
                className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]"
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
                {/* «Aparte» dicho entero: no suma al valor (17/11/2026, marketing). */}
                {/* 17/11/2026 (marketing): por qué va aparte. */}
                {afin && (
                  <span className="mt-1 text-[12px] leading-snug text-gray-400">
                    {afin}: votos con otra palabra parecida; se enseñan aparte y no suman a los {n}
                  </span>
                )}

                {(anti.conVotos.length > 0 || anti.tambien.length > 0) && (
                  <span className="mt-3 block text-[12px] font-semibold uppercase tracking-[0.12em] text-red-400">
                    {/* 17/11/2026 (marketing): con su base en el título de la tarjeta. */}
                    {anti.conVotos.length > 0
                      ? `Lo destruye · ${anti.conVotos.reduce((t, a) => t + a.votos, 0)} de ${TOTAL_VOTOS_ANTIVALORES} votos`
                      : "Lo destruye · sin votos: lo propone el documento"}
                  </span>
                )}
                <span className="mt-1 space-y-1.5">
                  {anti.conVotos.map((a) => (
                    /* El nombre entero, a dos líneas si hace falta (17/11/2026: «Irresponsabilida…»). */
                    <span key={a.nombre} className="grid grid-cols-[minmax(0,1fr)_3rem_auto] items-center gap-2 text-sm">
                      <span className="min-w-0 break-words leading-tight text-gray-200">{a.nombre}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${(a.votos / MAX_ANTI) * 100}%`, background: COLORES_CULTURA.granate }}
                        />
                      </span>
                      <span className="w-6 text-right tabular-nums text-gray-300">{a.votos}</span>
                    </span>
                  ))}
                  {anti.tambien.length > 0 && (
                    <span className="block text-sm leading-snug text-gray-200">{anti.tambien.join(", ")}</span>
                  )}
                </span>
              </button>

              <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => irA(v.diapositiva)}
                  className="inline-flex items-center gap-1 text-[color:var(--rmcf-gold-ink,#C8A96B)] hover:underline"
                >
                  Sus conductas
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
                <Link
                  href={HREF_SEGUIMIENTO}
                  title={`Seguimiento de los jugadores: dónde se apunta ${v.titulo.toLowerCase()} en el día a día`}
                  className="text-[13px] text-gray-300 hover:text-white hover:underline"
                >
                  Seguimiento →
                </Link>
              </span>
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
              {/* 17/11/2026 (fútbol): los votos de los cinco, no sólo del primero. */}
              <span className="tabular-nums text-gray-400">
                · {votosDe(v)} de {TOTAL_VOTOS_VALORES}
              </span>
              <span aria-hidden className="text-[color:var(--rmcf-gold-ink,#C8A96B)]">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * EL GRÁFICO DE LA VOTACIÓN (17/11/2026, marketing y fútbol).
 *
 * Lo primero del Marco en /team-values: un titular con el dato y una barra
 * por valor con su base («9 de 32»), cada una a un toque de sus conductas, y
 * debajo la fila de acciones (seguimiento, conductas, documento) que antes
 * vivía escondida dentro de una tarjeta del método.
 */
export function VotosValores({ compacto = false }: { compacto?: boolean } = {}) {
  if (!VALORES_INDICE.length) return null;

  const orden = [...VALORES_INDICE].sort((a, b) => votosDe(b) - votosDe(a));
  const primero = orden[0];

  return (
    <section aria-labelledby="votos-valores" className="min-w-0">
      <h2 id="votos-valores" className="text-lg font-semibold leading-snug text-white sm:text-xl">
        {primero.titulo} encabeza la votación: {votosDe(primero)} de {TOTAL_VOTOS_VALORES} votos
      </h2>
      <p className="mt-1 text-[13px] text-gray-400">
        {compacto ? (
          <>
            Votos de la plantilla; pulsa un valor para ver sus conductas.{" "}
            <Link href="/identidad-cultura#indice-valores" className="font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)] hover:underline">
              Recuento con los antivalores →
            </Link>
          </>
        ) : (
          <>Votos de la plantilla a cada valor; pulsa uno para ver sus conductas. Los antivalores ({TOTAL_VOTOS_ANTIVALORES} votos) se cuentan aparte.</>
        )}
      </p>

      {/* 19/11/2026 (tres expertos): también en /team-values, barras con su base;
          lo primero que se ve es un gráfico, no pastillas de texto. */}
      {(
      <ol className="mt-3 space-y-2">
        {orden.map((v) => {
          const n = votosDe(v);

          return (
            <li key={v.numero}>
              <Link
                href={hrefConductas(v)}
                title={`Conductas de ${v.titulo}`}
                className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg py-0.5 text-sm transition-colors hover:bg-white/[0.04] sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
              >
                <span className="min-w-0 break-words font-semibold leading-tight text-white">
                  <span className="mr-1.5 tabular-nums text-red-400">{v.numero}</span>
                  {v.titulo}
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
                  <span
                    className={`block h-full rounded-full ${v === primero ? "bg-[#C8A96B]" : "bg-[#C8A96B]/60"}`}
                    style={{ width: `${(n / MAX_VOTOS) * 100}%` }}
                  />
                </span>
                <span className="whitespace-nowrap text-right tabular-nums text-gray-200">
                  {n} de {TOTAL_VOTOS_VALORES}
                  <span aria-hidden className="ml-1.5 text-[color:var(--rmcf-gold-ink,#C8A96B)]">→</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={HREF_SEGUIMIENTO}
          className="inline-flex min-h-10 items-center rounded-xl bg-[#C8A96B] px-3.5 text-sm font-semibold text-[#0B0F14] transition hover:brightness-110"
        >
          Seguimiento de los jugadores →
        </Link>
        <Link
          href="/identidad-cultura#indice-valores"
          className="inline-flex min-h-10 items-center rounded-xl border border-white/15 px-3.5 text-sm font-semibold text-gray-200 transition-colors hover:border-[#C8A96B]/60 hover:text-white"
        >
          Conductas de cada valor →
        </Link>
        <Link
          href="/identidad-cultura"
          className="inline-flex min-h-10 items-center rounded-xl border border-white/15 px-3.5 text-sm font-semibold text-gray-200 transition-colors hover:border-[#C8A96B]/60 hover:text-white"
        >
          Documento para la charla (PDF / PPT) →
        </Link>
      </div>
    </section>
  );
}
