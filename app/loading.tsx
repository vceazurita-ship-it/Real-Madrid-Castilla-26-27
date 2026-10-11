/**
 * LO QUE SE VE MIENTRAS LLEGA UNA PANTALLA.
 *
 * Hasta el 11/10/2026 no había nada: al pulsar en el menú la pantalla
 * anterior se quedaba quieta mientras bajaba el código de la nueva (la de
 * rivales son ocho mil líneas) y parecía que el clic no había entrado. Esto
 * sale al instante, con la silueta del menú, la cabecera y unos paneles, y
 * vale para todas las rutas que no tengan el suyo.
 *
 * Es un componente de servidor a propósito: no carga nada ni espera a nada.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>

      <div className="flex">
        {/* La silueta del menú lateral (sólo en escritorio). */}
        <div className="hidden w-[78px] shrink-0 border-r border-white/10 md:block">
          <div className="space-y-3 px-4 pt-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="mx-auto h-9 w-9 animate-pulse rounded-xl bg-white/[0.06]" />
            ))}
          </div>
        </div>

        <section className="flex min-w-0 flex-1 flex-col">
          {/* La cabecera, con su alto de verdad para que no salte al llegar. */}
          <div className="border-b border-white/10 px-4 py-4 md:px-10 md:py-5">
            <div className="ml-24 flex items-center gap-3 md:ml-0 md:gap-5">
              <div className="h-12 w-12 animate-pulse rounded-full bg-white/[0.06] md:h-14 md:w-14" />
              <div className="space-y-2">
                <div className="h-2.5 w-28 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-5 w-44 animate-pulse rounded bg-white/[0.06]" />
              </div>
            </div>
          </div>

          <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-10">
            <div className="h-3 w-40 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-9 w-72 animate-pulse rounded-xl bg-white/[0.06]" />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-72 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-72 animate-pulse rounded-2xl bg-white/[0.04]" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
