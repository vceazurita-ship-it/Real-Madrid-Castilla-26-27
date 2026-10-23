"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { Play, Maximize2, ExternalLink } from "lucide-react";
import { traeJson } from "@/lib/hojaCsv";
import type { ClasificacionPortada } from "@/lib/portada/proximo-partido";

export default function CollectiveHistoryPage() {
  /*
  | 19/10/2026: el iPhone no deja poner un elemento a pantalla completa
  | (`requestFullscreen` no existe ahí) y el botón no hacía nada. Si el
  | navegador no puede, se abre el informe en una pestaña nueva, que en el
  | móvil ya ocupa la pantalla entera.
  */
  const toggleDashboardFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    const panel = dashboardRef.current;

    if (panel && typeof panel.requestFullscreen === "function") {
      await panel.requestFullscreen();
      return;
    }

    window.open(src, "_blank", "noopener");
  } catch (error) {
    console.error(error);
  }
};
const [isFullscreen, setIsFullscreen] = useState(false);

/*
| 23/10/2026: Power BI a veces no carga (red del club, sesión de Microsoft) y
| el hueco quedaba en blanco. Si el informe no avisa de que ha cargado en 8 s,
| se ofrece abrirlo en pestaña nueva; y la clasificación del Castilla sale
| del propio informe de rivales, para que la pantalla sirva aunque falle.
*/
const [informeCargado, setInformeCargado] = useState(false);
const [informeTarda, setInformeTarda] = useState(false);
const [tabla, setTabla] = useState<ClasificacionPortada | null>(null);

useEffect(() => {
  const t = window.setTimeout(() => setInformeTarda(true), 8000);
  return () => window.clearTimeout(t);
}, []);

useEffect(() => {
  let vivo = true;
  traeJson<{ clasificacion?: ClasificacionPortada | null }>("/api/data-analisis?portada=1")
    .then((r) => {
      if (vivo) setTabla(r?.clasificacion ?? null);
    })
    .catch(() => {});
  return () => {
    vivo = false;
  };
}, []);

const videoRef = useRef<HTMLDivElement | null>(null);
const dashboardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
  const handleFullscreen = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  document.addEventListener(
    "fullscreenchange",
    handleFullscreen
  );

  return () => {
    document.removeEventListener(
      "fullscreenchange",
      handleFullscreen
    );
  };
}, []);
useEffect(() => {
  const handleKey = (
    e: KeyboardEvent
  ) => {
    if (
      e.key === "Escape" &&
      document.fullscreenElement
    ) {
      /* El navegador suele salir solo con Escape; si ya lo ha hecho, esta
         segunda salida falla y no debe dejar un error en la consola. */
      document.exitFullscreen().catch(() => {});
    }
  };

  window.addEventListener(
    "keydown",
    handleKey
  );

  return () =>
    window.removeEventListener(
      "keydown",
      handleKey
    );
}, []);

  const src = "https://app.powerbi.com/view?r=eyJrIjoiNzY4NjNmZjktZWU3Zi00NjkyLTg5NTMtNzQwYjQwMGVjZmQxIiwidCI6ImQ2Zjc2YzExLWZmYjktNGExNS05YjQ5LWU2ZWQ0MjljOTVhMiIsImMiOjl9";

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
                RMCF CASTILLA COLECTIVO
              </p>

              <div className="mt-4 flex items-center gap-3 sm:gap-5">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                  Histórico de la Competición
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
            </div>

            {tabla ? (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Puesto", `${tabla.puesto}º de ${tabla.deCuantos}`],
                  ["Puntos", `${tabla.puntos} en ${tabla.jugados} partidos`],
                  ["Balance", `${tabla.ganados} G · ${tabla.empatados} E · ${tabla.perdidos} P`],
                  ["Goles", `${tabla.favor} a favor · ${tabla.contra} en contra`],
                ].map(([etiqueta, valor]) => (
                  <div
                    key={etiqueta}
                    className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-[0.25em] text-[#C8A96B]">
                      {etiqueta}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">{valor}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {!informeCargado && informeTarda ? (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#C8A96B]/40 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                <span className="min-w-0 flex-1">
                  El informe tarda en cargar. Puedes abrirlo en una pestaña nueva.
                </span>
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#C8A96B] px-4 py-2 font-semibold text-black"
                >
                  <ExternalLink size={14} />
                  Abrir el informe
                </a>
              </div>
            ) : null}

            <div
  ref={dashboardRef}
  className="relative rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm overflow-hidden"
>
  <button
  onClick={toggleDashboardFullscreen}
  className="
    absolute
    top-4
    right-4
    z-30
    flex
    items-center
    gap-2
    rounded-full
    border border-[#C8A96B]/40
    bg-[#11161D]/90
    px-4
    py-2
    text-sm
    font-medium
    text-white
    backdrop-blur-md
    hover:border-[#C8A96B]
    hover:bg-[#161D26]
    transition-all
  "
>
  <Maximize2
    size={16}
    className="text-[#C8A96B]"
  />

  {isFullscreen
    ? "Salir pantalla completa"
    : "Pantalla completa"}
</button>

  <iframe
    title="Histórico de la competición (Power BI)"
    src={src}
    className={`
      block
      w-full
      border-0
      rounded-[18px] sm:rounded-[24px]
      bg-[#0B0F14]
      ${
        isFullscreen
          ? "h-screen"
          : "h-[72vh] sm:h-[78vh] lg:h-[840px]"
      }
    `}
    allowFullScreen
    onLoad={() => setInformeCargado(true)}
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
                    Cómo se usa el informe
                  </h2>

                  <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden lg:block rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm overflow-hidden">
                <iframe
                  title="Vídeo explicativo"
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
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 px-2 text-sm text-[#C8A96B]"
                >
                  <ExternalLink size={14} />
                  Si el vídeo no se ve, ábrelo en una pestaña nueva
                </a>
              </div>

              {/* Móvil */}
              <div className="lg:hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 text-center">
                <p className="text-white/80 text-sm mb-4">
                  Ver la explicación completa del informe
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