import Image from "next/image"

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0F14]/85 backdrop-blur-xl">

      <div className="flex items-center justify-between px-10 py-5">

        {/* LEFT */}
        <div className="flex items-center gap-5">

          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_0_30px_rgba(200,169,107,0.08)]">

            <Image
              src="/logo.png"
              alt="Real Madrid C" 
              width={38}
              height={38}
              priority              
            />

          </div>

          <div>

            <p className="text-[11px] uppercase tracking-[0.35em] text-[#C8A96B]">
              Real Madrid C
            </p>

            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Performance Intelligence
            </h2>

          </div>

        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">

            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
              Season
            </p>

            <p className="mt-1 text-sm font-medium text-white">
              2025 — 2026
            </p>

          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">

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