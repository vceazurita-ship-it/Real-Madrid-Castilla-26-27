"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { Play } from "lucide-react";

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

  const src = `https://app.powerbi.com/reportEmbed
    ?reportId=54600d1d-a5f0-433f-a429-ec04159a31d2
    &autoAuth=true
    &ctid=d6f76c11-ffb9-4a15-9b49-e6ed429c95a2
    &filterPaneEnabled=${isDesktop ? "true" : "false"}
  `.replace(/\s/g, "");

  const videoUrl =
    "https://drive.google.com/file/d/1V-1mm_z7cM43ZXKaCHGRPlECx-IH1Nrt/view";

  const scrollToVideo = () => {
    if (window.innerWidth < 1024) {
      window.open(videoUrl, "_blank");
      return;
    }

    videoRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="w-full relative">
          <Topbar />

          {/* Botón desktop */}
          <button
            onClick={scrollToVideo}
            className="
              hidden lg:flex
              fixed right-6 top-1/2 -translate-y-1/2 z-50
              items-center gap-3
              rounded-full
              border border-[#C8A96B]/40
              bg-[#11161D]/90
              px-5 py-3
              text-sm font-medium
              text-white
              shadow-[0_12px_35px_rgba(0,0,0,0.35)]
              backdrop-blur-md
              hover:border-[#C8A96B]
              hover:bg-[#161D26]
              transition-all
            "
          >
            <Play size={16} className="text-[#C8A96B]" />
            Ver explicación
          </button>

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
              hover:opacity-90
              transition
            "
          >
            Ver vídeo
          </button>

          <div className="px-4 sm:px-8 pb-8 sm:pb-12 pt-6 sm:pt-10">
            {/* Header */}
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMC Intelligence
              </p>

              <div className="mt-4 flex items-center gap-3 sm:gap-5">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                  Competición
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
            </div>

            {/* Power BI */}
            <div className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm overflow-hidden">
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

            {/* Vídeo */}
            <div ref={videoRef} className="mt-14 sm:mt-20">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                  Explicación visual
                </p>

                <div className="mt-4 flex items-center gap-3 sm:gap-5">
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                    Uso del dashboard
                  </h2>

                  <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden lg:block rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm overflow-hidden">
                <iframe
                  title="Video explicativo"
                  src="https://drive.google.com/file/d/1V-1mm_z7cM43ZXKaCHGRPlECx-IH1Nrt/preview"
                  className="
                    w-full
                    border-0
                    rounded-[18px] sm:rounded-[24px]
                    bg-black
                    h-[640px]
                  "
                  allow="autoplay"
                  allowFullScreen
                />
              </div>

              {/* Móvil */}
              <div className="lg:hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 text-center">
                <p className="text-white/80 text-sm mb-4">
                  Ver explicación completa del dashboard
                </p>

                <button
                  onClick={() => window.open(videoUrl, "_blank")}
                  className="
                    rounded-full
                    bg-[#C8A96B]
                    text-black
                    px-5 py-3
                    text-sm
                    font-semibold
                    shadow-xl
                  "
                >
                  ▶ Abrir vídeo
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}