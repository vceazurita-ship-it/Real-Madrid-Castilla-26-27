"use client";

import { useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

export default function IndividualPage() {
  const [page, setPage] = useState("ReportSection");

  const base =
    "https://app.powerbi.com/reportEmbed?reportId=e2935faf-270f-4a9b-9d40-aaa401174f2f&autoAuth=true&ctid=d6f76c11-ffb9-4a15-9b49-e6ed429c95a2&filterPaneEnabled=false&navContentPaneEnabled=false&pageNavigationPosition=none";

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="w-full">
          <Topbar />

          <div className="px-4 sm:px-8 pb-10 sm:pb-12 pt-6 sm:pt-10">
            {/* Header */}
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMC Intelligence
              </p>

              <div className="mt-4 flex items-center gap-3 sm:gap-5">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                  Sinergias
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
            </div>

            {/* Power BI */}
            <div className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm overflow-hidden">
             <iframe
  title="Power BI Report"
  src="https://app.powerbi.com/reportEmbed?reportId=e2935faf-270f-4a9b-9d40-aaa401174f2f&autoAuth=true&ctid=d6f76c11-ffb9-4a15-9b49-e6ed429c95a2&filterPaneEnabled=false"
  className="
    block
    w-full
    border-0
    rounded-[18px] sm:rounded-[24px]
    bg-[#0B0F14]
    h-[560px]
    sm:h-[780px]
    lg:h-[840px]
  "
  allowFullScreen
/>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}