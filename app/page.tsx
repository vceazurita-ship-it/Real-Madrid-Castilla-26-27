import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">

      <div className="flex">

        <Sidebar />

        <div className="flex-1">

          <Topbar />

          <section className="p-10">

            {/* HERO */}
            <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent p-12">

              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,169,107,0.08),transparent_35%)]" />

              <div className="relative z-10 max-w-5xl">

                <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                  Competitive Phase
                </p>

                <h1 className="mt-5 text-6xl font-semibold leading-[0.95] tracking-tight">
                  Unified Football
                  <br />
                  Intelligence Platform
                </h1>

                <p className="mt-8 max-w-3xl text-lg leading-relaxed text-gray-400">
                  Centralised elite football intelligence ecosystem integrating
                  player performance, collective behaviour, emotional dynamics
                  and training methodology.
                </p>

              </div>

              {/* KPI */}
              <div className="relative z-10 mt-14 grid grid-cols-4 gap-5">

                {[
                  ["87%", "Competitive Efficiency"],
                  ["High", "Training Load"],
                  ["Stable", "Emotional Stability"],
                  ["+12%", "Collective Evolution"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6"
                  >
                    <p className="text-sm text-gray-400">{label}</p>

                    <h3 className="mt-4 text-4xl font-semibold">
                      {value}
                    </h3>
                  </div>
                ))}

              </div>

            </div>

            {/* MODULES */}
            <div className="mt-12">

              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                Modules
              </p>

              <div className="mt-6 grid grid-cols-2 gap-6">

                {[
                  [
                    "/individual",
                    "Individual",
                    "Performance Intelligence",
                  ],
                  [
                    "/emotion",
                    "Emotional",
                    "Emotional Dynamics",
                  ],
                  [
                    "/team",
                    "Collective",
                    "Team Performance",
                  ],
                  [
                    "/microcycles",
                    "Methodology",
                    "Training Intelligence",
                  ],
                ].map(([href, section, title]) => (
                  <Link
                    key={title}
                    href={href}
                    className="group rounded-[34px] border border-white/10 bg-white/[0.03] p-9 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
                  >

                    <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                      {section}
                    </p>

                    <h3 className="mt-5 text-4xl font-semibold tracking-tight">
                      {title}
                    </h3>

                  </Link>
                ))}

              </div>

            </div>

          </section>

        </div>

      </div>

    </main>
  )
}