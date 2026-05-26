import { Sidebar } from "@/components/ui/sidebar"

export default function SessionsPage() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">

        <Sidebar />

        <section className="flex-1 p-10">

          <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
            Session Content
          </p>

          <h1 className="mt-4 text-5xl font-semibold tracking-tight">
            Training Session Library
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-400">
            Training tasks, methodological structures and session content
            management across the season.
          </p>

        </section>

      </div>
    </main>
  )
}