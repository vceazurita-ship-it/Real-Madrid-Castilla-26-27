"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

export default function IndividualPage() {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="w-full">
          <Topbar />

          <div className="px-8 pb-12 pt-10">
            {/* Header */}
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                Individual Intelligence
              </p>

              <div className="mt-4 flex items-center gap-5">
                <h1 className="text-4xl font-semibold tracking-tight">
Rendimiento colectivo               </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
            </div>
            </div>

            {/* Power BI */}
            <div className="rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <iframe
                title="Power BI Report"
                src="https://app.powerbi.com/reportEmbed?reportId=0eb5b0bc-f3ea-490f-8deb-434ddd15e878&autoAuth=true&ctid=d6f76c11-ffb9-4a15-9b49-e6ed429c95a2"
                style={{
                  width: "100%",
                  height: "840px",
                  border: "none",
                  borderRadius: "24px",
                  display: "block",
                  background: "#0B0F14",
                }}
                allowFullScreen
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}