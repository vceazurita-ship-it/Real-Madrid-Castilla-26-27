"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

export default function IndividualPage() {
  const [isDesktop, setIsDesktop] = useState(false);
  const videoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    onResize();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  const scrollToVideo = () => {
    videoRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const src = `https://app.powerbi.com/reportEmbed
    ?reportId=8b8163f2-01c5-4cbf-b0f6-84d7282fc4a7
    &autoAuth=true
    &ctid=d6f76c11-ffb9-4a15-9b49-e6ed429c95a2
    &filterPaneEnabled=${isDesktop ? "true" : "false"}
  `.replace(/\s/g, "");

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="w-full">
          <Topbar />

          <div className="px-4 sm:px-8 pb-8 sm:pb-12 pt-6 sm:pt-10">
            {/* Header */}
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMC Intelligence
              </p>

              <div className="mt-4 flex items-center gap-3 sm:gap-5">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                  Rendimiento Comparativo U21
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
            </div>

            {/* Power BI */}
            <div
              ref={videoRef}
              className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm overflow-hidden"
            >
              <iframe
                title="Power BI Report"
                src={src}
                className="
                  block
                  w-full
                  border-0
                  rounded-[18px] sm:rounded-[24px]
                  bg-[#0B0F14]

                  h-[72vh]
                  sm:h-[78vh]
                  lg:h-[840px]
                "
                allowFullScreen
              />
            </div>
          </div>
        </section>
      </div>

      {/* Botón móvil */}
      <button
        onClick={scrollToVideo}
        className="
          lg:hidden
          fixed bottom-5 right-5 z-50
          rounded-full
          bg-[#C8A96B]
          text-black
          px-4 py-3
          text-sm font-semibold
          shadow-xl
        "
      >
        Ver vídeo
      </button>
    </main>
  );
}   