"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

export default function IndividualPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0B0F14] text-white">
      <div className="flex flex-col md:flex-row">
        <Sidebar />

        <section className="w-full min-w-0 overflow-x-hidden">
          <Topbar />

          <div className="mx-auto w-full max-w-screen-2xl px-4 pb-8 pt-6 md:px-8 md:pb-12 md:pt-10">
            {/* Header */}
            <div className="mb-6 md:mb-8">
              <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#C8A96B] sm:text-[10px] md:text-xs md:tracking-[0.35em]">
                Individual Intelligence
              </p>

              <div className="mt-3 flex flex-col gap-3 md:mt-4 md:flex-row md:items-center md:gap-5">
                <h1 className="max-w-full break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
                  Player Performance Ecosystem
                </h1>

                <div className="hidden h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />
              </div>
            </div>

            {/* Power BI */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm md:rounded-[32px] md:p-4">
              <div className="w-full overflow-x-auto rounded-2xl [-webkit-overflow-scrolling:touch]">
                <iframe
                  title="Power BI Report"
                  src="https://app.powerbi.com/reportEmbed?reportId=e2935faf-270f-4a9b-9d40-aaa401174f2f&autoAuth=true&ctid=d6f76c11-ffb9-4a15-9b49-e6ed429c95a2"
                  className="
                    block
                    w-full
                    min-w-[920px]
                    h-[560px]
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