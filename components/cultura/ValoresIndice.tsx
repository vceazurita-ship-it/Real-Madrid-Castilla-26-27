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

/*
| 20/11/2026 (fútbol, marketing y guionista): un solo gráfico enfrentado,
| valor contra lo que lo destruye, con la conclusión en el titular. Las cinco
| tarjetas en columnas partían las palabras a 1440 px («PROFESIONALID AD»,
| «Egoísm o») y repetían el aviso de los votos afines en dos sitios: ahora una
| fila por valor (lo que lo destruye a la izquierda, el valor en el centro y
| sus votos a la derecha; en el móvil, uno debajo de otro) y el aviso, una vez
| al pie. El valor sin votos en contra nombra su antivalor «(lo propone el
| documento)», sin anunciar la falta de votos.
*/
export function ValoresIndice() {
  if (!VALORES_INDICE.length) return null;

  return (
    <section aria-labelledby="indice-valores" className="min-w-0" lang="es">
      <h2 id="indice-valores" className="text-lg font-semibold leading-snug text-white sm:text-xl">
        {/* 27/11/2026 (guionista, ronda 9): la conclusión va en el titular de la
            pantalla; aquí, qué enseña el gráfico. */}
        Cada valor, frente a lo que lo destruye
      </h2>
      <p className="mt-1 text-xs text-gray-400">
        Votos de la plantilla: {TOTAL_VOTOS_VALORES} a los valores y {TOTAL_VOTOS_ANTIVALORES} a lo que los destruye, contados aparte.
        Cada barra se mide contra el más votado de su lado ({MAX_VOTOS} en los valores, {MAX_ANTI} en lo que los destruye).
        Pulsa un valor para ver sus conductas.
      </p>

      <div className="mt-3 hidden grid-cols-[minmax(0,1fr)_minmax(0,13rem)_minmax(0,1fr)] gap-4 text-[11px] font-semibold uppercase tracking-[0.12em] md:grid" aria-hidden>
        <span className="text-right text-red-400">Lo que lo destruye</span>
        <span className="text-center text-gray-400">Valor</span>
        <span className="text-[color:var(--rmcf-gold-ink,#C8A96B)]">Lo votaron</span>
      </div>

      <ol className="mt-2 divide-y divide-white/10 border-y border-white/10">
        {VALORES_INDICE.map((v) => {
          const n = votosDe(v);
          const anti = antivaloresDelValor(v);
          const afin = afinDe(v);

          return (
            <li
              key={v.numero}
              className="grid min-w-0 gap-x-4 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,13rem)_minmax(0,1fr)] md:items-center"
            >
              {/* El valor, en el centro (primero en el móvil) */}
              <div className="min-w-0 md:order-2 md:text-center">
                <button
                  type="button"
                  onClick={() => irA(v.diapositiva)}
                  title={`Conductas de ${v.titulo}`}
                  className="inline-flex min-w-0 items-baseline gap-2 rounded text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B] md:flex-col md:items-center md:gap-0.5 md:text-center"
                >
                  <span className="text-2xl font-black leading-none tabular-nums text-red-400" aria-hidden>
                    {String(v.numero).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 hyphens-auto text-sm font-bold uppercase tracking-wide text-white sm:text-base">{v.titulo}</span>
                </button>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold md:justify-center">
                  <button type="button" onClick={() => irA(v.diapositiva)} className="inline-flex items-center gap-1 text-[color:var(--rmcf-gold-ink,#C8A96B)] hover:underline">
                    Sus conductas
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  {/* 20/11/2026 (ronda 5): ya filtrado por el valor, y el rótulo lo dice. */}
                  <Link
                    href={hrefSeguimientoDe(v.titulo)}
                    title={`Seguimiento de los jugadores filtrado por ${v.titulo.toLowerCase()}`}
                    className="text-gray-300 hover:text-white hover:underline"
                  >
                    Seguimiento de {v.titulo.toLowerCase()} →
                  </Link>
                </span>
              </div>

              {/* Sus votos, a la derecha. 27/11/2026 (ronda 9): con margen a la
                  derecha para que el ⋮ flotante no tape la cifra en escritorio. */}
              <div className="min-w-0 md:order-3 lg:pr-14">
                <span className="flex items-center gap-2">
                  <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <span className="block h-full rounded-full bg-[#C8A96B]" style={{ width: `${(n / MAX_VOTOS) * 100}%` }} />
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-white">
                    {n} de {TOTAL_VOTOS_VALORES}
                  </span>
                </span>
                {/* 20/11/2026 (ronda 5): el «+3 Amistad» se cortaba en el borde y bajo el ⋮; va debajo de la barra. */}
                {afin ? <span className="mt-0.5 block text-xs text-gray-400">{afin.replace(/^\+(\d+) a (.+)$/, "+$1 votos a «$2» (no suman)")}</span> : null}
              </div>

              {/* Lo que lo destruye, a la izquierda y en espejo */}
              <div className="min-w-0 space-y-1 md:order-1">
                {anti.conVotos.map((a) => (
                  <span key={a.nombre} className="flex min-w-0 items-center gap-2 text-sm md:flex-row-reverse">
                    <span className="shrink-0 whitespace-nowrap text-gray-200">
                      {a.nombre} <span className="tabular-nums text-gray-400">{a.votos}</span>
                    </span>
                    <span className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08] md:justify-end">
                      <span className="block h-full rounded-full" style={{ width: `${(a.votos / MAX_ANTI) * 100}%`, background: COLORES_CULTURA.granate }} />
                    </span>
                  </span>
                ))}
                {/* 27/11/2026 (fútbol, ronda 9): el antivalor que añade el documento
                    va en su fila, con el rombo y sin barra de votos. */}
                {anti.tambien.map((nombre) => (
                  <span key={nombre} className="flex min-w-0 items-center gap-2 text-sm md:justify-end">
                    <span className="text-gray-200">
                      <span aria-hidden className="mr-1 text-red-400">◇</span>
                      {nombre} <span className="text-xs text-gray-400">· lo añade el documento</span>
                    </span>
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {/* 27/11/2026 (guionista y fútbol, ronda 9): los votos afines y el antivalor
          que añade el documento se rotulan en su propia fila; sin notas al pie. */}
    </section>
  );
}

/**
 * La línea de /team-values: el más votado con su base y un chip por valor que
 * abre sus conductas en /identidad-cultura. Sin barras: el recuento completo
 * vive en una sola pantalla.
 */
/*
| 20/11/2026 (fútbol y guionista, ronda 5): en /team-values la votación es
| UNA línea; el recuento con barras vive sólo en /identidad-cultura. La
| pantalla abre con la hoja de ruta.
*/
export function EnlacesValores() {
  if (!VALORES_INDICE.length) return null;

  const primero = [...VALORES_INDICE].sort((a, b) => votosDe(b) - votosDe(a))[0];

  return (
    <p className="min-w-0 text-sm text-gray-300">
      <span className="font-semibold text-white">{primero.titulo}</span> encabeza la votación de la plantilla (
      <span className="tabular-nums">{votosDe(primero)} de {TOTAL_VOTOS_VALORES}</span> votos).{" "}
      <Link
        href="/identidad-cultura#indice-valores"
        className="font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)] hover:underline"
      >
        Ver la votación →
      </Link>
    </p>
  );
}

/**
 * El valor del que habla un texto (el primero que nombre), o null. Sirve para
 * llevar al seguimiento ya filtrado por ese valor.
 */
export function valorNombradoEn(texto: string): ValorIndice | null {
  const t = texto.toLowerCase();

  return VALORES_INDICE.find((v) => t.includes(v.titulo.toLowerCase())) ?? null;
}

/** El seguimiento con la búsqueda puesta en el valor (`?buscar=`, lo lee /individual_proc). */
export const hrefSeguimientoDe = (titulo: string) => `${HREF_SEGUIMIENTO}?buscar=${encodeURIComponent(titulo.toLowerCase())}`;

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
              Ver la votación y lo que la destruye →
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
                  <span aria-hidden className="ml-1.5 text-base font-bold text-[color:var(--rmcf-gold-ink,#C8A96B)]">→</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      )}
      {/* 27/11/2026 (marketing, ronda 9): la base al pie del gráfico. */}
      <p className="mt-2 text-xs text-gray-400">
        Base: {TOTAL_VOTOS_VALORES} votos de la plantilla a los cinco valores; cada barra, contra el más votado ({MAX_VOTOS}).
      </p>

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
