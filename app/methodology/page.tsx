import { Sidebar } from "@/components/ui/sidebar"

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">

        <Sidebar />

        <section className="min-w-0 flex-1 px-5 pb-10 pt-20 md:p-10">

          <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
            Methodology
          </p>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Training Methodology
          </h1>

          <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">
            Training principles, competitive methodologies and systemic
            development frameworks.
          </p>

        </section>

      </div>
    </main>
  )
}