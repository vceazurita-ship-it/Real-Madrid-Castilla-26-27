"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

const clips = [
  {
    player: "Jugador Ejemplo",
    action: "Desmarque",
    match: "Castilla vs Atleti B",
    minute: "34'",
    tag: "Ataque",
    video: "https://www.youtube.com/embed/_z7oXJK5woQ?si=34JD6fQxNltqlHMg",
  },
  {
    player: "Jugador Ejemplo",
    action: "Presión",
    match: "Castilla vs Murcia",
    minute: "71'",
    tag: "Defensa",
    video: "https://www.youtube.com/embed/_z7oXJK5woQ?si=34JD6fQxNltqlHMg",
  },
];

export default function VideoIndividual() {
  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="flex-1">
        <Topbar />

        <div className="p-6 md:p-10">

          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Videoteca
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Videoteca Individual
            </h1>

            <p className="mt-3 text-white/60">
              Biblioteca de clips individuales.
            </p>
          </div>

          <div className="space-y-6">
            {clips.map((clip, index) => (
              <div
                key={index}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="mb-4 flex flex-wrap gap-4">

                  <div>
                    <p className="text-xs text-white/40">
                      Jugador
                    </p>

                    <p>{clip.player}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Acción
                    </p>

                    <p>{clip.action}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Partido
                    </p>

                    <p>{clip.match}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Minuto
                    </p>

                    <p>{clip.minute}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Etiqueta
                    </p>

                    <p>{clip.tag}</p>
                  </div>

                </div>

                <div className="overflow-hidden rounded-2xl">
                  <iframe
                    width="100%"
                    height="400"
                    src={clip.video}
                    title={clip.player}
                    allowFullScreen
                  />
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}