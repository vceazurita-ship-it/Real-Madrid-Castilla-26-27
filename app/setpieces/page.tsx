import { Sidebar } from "@/components/ui/sidebar"
import OpenDashboardButton from "@/components/open-dashboard-button"

export default function SetPiecesPage() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">

        <Sidebar />

        <section className="flex-1 p-10">

          <div className="mb-10">

            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              Set Pieces
            </p>

            <h1 className="mt-4 text-5xl font-semibold tracking-tight">
              Set Piece Intelligence
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-400">
              Advanced offensive and defensive set piece analysis platform.
            </p>

          </div>

          <div className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] p-6">

            <div className="relative flex h-[680px] items-center justify-center rounded-[30px] border border-white/10 bg-[#111827]">

              <div className="text-center">

                <h2 className="text-5xl font-semibold">
                  Set Piece Dashboard
                </h2>

                <p className="mx-auto mt-8 max-w-3xl text-lg text-gray-400">
                  Analyse corners, free kicks, throw-ins and strategic
                  restart structures.
                </p>

                <div className="mt-12 flex justify-center">
                  <OpenDashboardButton />
                </div>

              </div>

            </div>

          </div>

        </section>

      </div>
    </main>
  )
}