"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useState } from "react";
import Papa from "papaparse";

export default function VideoIndividual() {
  const [clips, setClips] = useState<any[]>([]);

  useEffect(() => {
    Papa.parse(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1662164849&single=true&output=csv",
      {
        download: true,
        header: true,
        skipEmptyLines: true,

        complete: (results) => {
          const individual = (results.data as any[]).filter(
            (row) =>
              row.Tipo === "Propio" &&
              row.Nivel === "Individual"
          );

          setClips(individual);
        },
      }
    );
  }, []);

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
              Videoteca Propia · Individual
            </h1>

            <p className="mt-3 text-white/60">
              Biblioteca de clips individuales conectada a Google Sheets.
            </p>
          </div>

          <div className="space-y-6">

            {clips.map((clip: any, index: number) => (
              <div
                key={index}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="grid gap-4 md:grid-cols-4">

                  <div>
                    <p className="text-xs text-white/40">
                      ID
                    </p>

                    <p>{clip.ID}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Jugador
                    </p>

                    <p>{clip.Jugador}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Posición
                    </p>

                    <p>{clip["Posición"]}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Minuto
                    </p>

                    <p>{clip.Minuto}'</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Categoría
                    </p>

                    <p>{clip["Categoría"]}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Subcategoría
                    </p>

                    <p>{clip["Subcategoría"]}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Competición
                    </p>

                    <p>{clip["Competición"]}</p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">
                      Fecha
                    </p>

                    <p>{clip.Fecha}</p>
                  </div>

                </div>

                <div className="mt-6 flex items-center justify-between">

                  <span className="rounded-xl border border-[#C8A96B]/20 bg-[#C8A96B]/10 px-3 py-1 text-sm text-[#C8A96B]">
                    {clip.Resultado}
                  </span>

                  <button
                    onClick={() =>
                      window.open(
                        clip["URL Hudl"],
                        "_blank"
                      )
                    }
                    className="
                      rounded-xl
                      bg-[#C8A96B]
                      px-5
                      py-2
                      font-medium
                      text-black
                      transition
                      hover:opacity-90
                    "
                  >
                    ▶ Ver clip en Hudl
                  </button>

                </div>
              </div>
            ))}

          </div>
        </div>
      </main>
    </div>
  );
}