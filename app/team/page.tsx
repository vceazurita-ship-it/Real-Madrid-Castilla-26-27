"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

export default function IndividualPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0B0F14] text-white">
      <div className="flex flex-col md:flex-row">
        <Sidebar />

        <section className="w-full min-w-0">
          <Topbar />

          <div className="px-4 pb-8 pt-6 md:px-8 md:pb-12 md:pt-10">
            {/* Header */}
            <div className="mb-6 md:mb-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96B] md:text-xs md:tracking-[0.35em]">
                Individual Intelligence
              </p>

              <div className="mt-3 flex flex-col gap-3 md:mt-4 md:flex-row md:items-center md:gap-5">
                <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
                  Player Performance Ecosystem
                </h1>

                <div className="hidden h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />
              </div>
            </div>

            {/* Power BI */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm md:rounded-[32px] md:p-4">
              <div className="w-full overflow-x-auto rounded-2xl">
                <iframe
                  title="Power BI Report"
                  src="https://app.powerbi.com/reportEmbed?reportId=0eb5b0bc-f3ea-490f-8deb-434ddd15e878&autoAuth=true&ctid=d6f76c11-ffb9-4a15-9b49-e6ed429c95a2"
                  className="
                    block
                    min-w-[900px]
                    w-full
                    h-[620px]
                    rounded-2xl
                    border-0
                    bg-[#0B0F14]
                    md:min-w-0
                    md:h-[840px]
                  "
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}