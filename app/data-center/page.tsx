"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import Papa from "papaparse";
import { useData } from "@/app/contexts/data-context";

const blocks = [
  {
    title: "Jugadores Castilla",
    description: "Base de datos individual",
  },
  {
    title: "Datos Colectivos",
    description: "Métricas de equipo",
  },
  {
    title: "Scout Rival",
    description: "Informes rivales",
  },
  {
    title: "Área Condicional",
    description: "GPS · Wellness · Carga",
  },
  {
    title: "Hudl",
    description: "Integración vídeo",
  },
];

export default function DataCenter() {
  const {
  setPlayersData,
  setTeamData,
  setScoutData,
} = useData();
const handleFileUpload = (
  event: React.ChangeEvent<HTMLInputElement>,
  type: "players" | "team" | "scout"
) => {
  const file = event.target.files?.[0];

  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,

    complete: (results) => {
      if (type === "players") {
        setPlayersData(results.data);
      }

      if (type === "team") {
        setTeamData(results.data);
      }

      if (type === "scout") {
        setScoutData(results.data);
      }

      console.log("CSV cargado:", results.data);
    },
  });
};
  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="flex-1">
        <Topbar />

        <div className="p-6 md:p-10">

          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Data Center
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Centro de Datos
            </h1>

            <p className="mt-3 text-white/60">
              Gestión centralizada de información y fuentes de datos.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

            {blocks.map((block) => (
              <div
                key={block.title}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <h2 className="text-xl font-semibold">
                  {block.title}
                </h2>

                <p className="mt-3 text-white/60">
                  {block.description}
                </p>

                <label
  className="
    mt-6
    inline-block
    cursor-pointer
    rounded-xl
    border
    border-white/10
    px-4
    py-2
    hover:bg-white/5
  "
>
  Subir Archivo

  <input
    type="file"
    accept=".csv"
    className="hidden"
    onChange={(e) => {
      if (block.title === "Jugadores Castilla") {
        handleFileUpload(e, "players");
      }

      if (block.title === "Datos Colectivos") {
        handleFileUpload(e, "team");
      }

      if (block.title === "Scout Rival") {
        handleFileUpload(e, "scout");
      }
    }}
  />
</label>
              </div>
            ))}

          </div>
        </div>
      </main>
    </div>
  );
}