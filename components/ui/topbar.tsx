import Image from "next/image"

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0F14]/85 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-4 md:px-10 md:py-5">

        {/* LEFT */}
        <div className="ml-16 flex items-center gap-3 md:ml-0 md:gap-5">

          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_0_30px_rgba(200,169,107,0.08)] md:h-14 md:w-14">

            <Image
              src="/logo.png"
              alt="Real Madrid C"
              width={34}
              height={34}
              priority
            />

          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#C8A96B] md:text-[11px] md:tracking-[0.35em]">
              Real Madrid C
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white md:text-2xl">
              Performance Intelligence
            </h2>
          </div>

        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 md:px-4 md:py-3">

            <p className="text-[9px] uppercase tracking-[0.22em] text-gray-500 md:text-[10px]">
              Season
            </p>

            <p className="mt-1 text-sm font-medium text-white">
              2025 — 2026
            </p>

          </div>

          {/* SOLO DESKTOP */}
          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 md:block">

            <div className="flex items-center gap-2">

              <div className="h-2 w-2 rounded-full bg-[#C8A96B]" />

              <p className="text-sm font-medium text-white">
                Active
              </p>

            </div>

          </div>

        </div>

      </div>
    </header>
  )
}