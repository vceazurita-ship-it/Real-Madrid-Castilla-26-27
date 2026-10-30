/**
 * LO QUE SE VE MIENTRAS LLEGA /microcycles (30/10/2026).
 *
 * La pantalla son más de cuatro mil líneas y su código tarda en bajar: con el
 * esqueleto genérico sólo se leía «Cargando…». Ahora sale ya la cabecera de
 * Entrenamiento con el título y la silueta de lo que viene (la tira de micros
 * y los seis indicadores), para que se sepa dónde se está.
 *
 * Componente de servidor: no carga ni espera nada.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando los microciclos…</span>

      <div className="flex">
        <div className="hidden w-[78px] shrink-0 border-r border-white/10 md:block">
          <div className="space-y-3 px-4 pt-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="mx-auto h-9 w-9 animate-pulse rounded-xl bg-white/[0.06]" />
            ))}
          </div>
        </div>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-white/10 px-4 py-4 md:px-10 md:py-5">
            <div className="ml-24 flex items-center gap-3 md:ml-0 md:gap-5">
              <div className="h-12 w-12 animate-pulse rounded-full bg-white/[0.06] md:h-14 md:w-14" />
              <div className="space-y-2">
                <div className="h-2.5 w-28 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-5 w-44 animate-pulse rounded bg-white/[0.06]" />
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-10">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">RMCF Castilla · Entrenamiento</p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Microciclos</h1>
              <p className="mt-2 text-sm text-white/50">Trayendo la semana de entrenamiento: días, MD, tareas y cargas.</p>
            </div>

            <div aria-hidden className="flex gap-3 overflow-hidden">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={`h-[144px] shrink-0 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] ${i ? "w-[190px]" : "w-[150px]"}`} />
              ))}
            </div>

            <div aria-hidden className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-[112px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
              ))}
            </div>

            <div aria-hidden className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
              <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
