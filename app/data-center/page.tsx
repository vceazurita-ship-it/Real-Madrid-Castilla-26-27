"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import Papa from "papaparse";
import { useData } from "@/app/contexts/data-context";
import { useState, useEffect } from "react";

const blocks = [
  {
    title: "Jugadores Castilla",
    description: "Base de datos individual",
    type: "players",
  },
  {
    title: "Datos Colectivos",
    description: "Métricas de equipo",
    type: "team",
  },
  {
    title: "Scout Rival",
    description: "Informes rivales",
    type: "scout",
  },
  {
    title: "Área Condicional",
    description: "GPS · Wellness · Carga",
    type: "conditional",
  },
  {
    title: "Hudl",
    description: "Integración vídeo",
    type: "hudl",
  },
];

export default function DataCenter() {
const {
  playersData,
  teamData,
  scoutData,
  setPlayersData,
  setTeamData,
  setScoutData,
} = useData();
const [fileInfo, setFileInfo] = useState<
  Record<
    string,
    {
      fileName: string;
      records: number;
      updatedAt: string;
    }
  >
>({});

const handleFileUpload = (
  event: React.ChangeEvent<HTMLInputElement>,
  type: string
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

      const info = {
        fileName: file.name,
        records: results.data.length,
        updatedAt: new Date().toLocaleString("es-ES"),
      };

      setFileInfo((prev) => ({
        ...prev,
        [type]: info,
      }));

      localStorage.setItem(
        `fileInfo_${type}`,
        JSON.stringify(info)
      );

      alert(
        `Archivo cargado correctamente.\n\nRegistros: ${results.data.length}`
      );
    },
  });
};
useEffect(() => {
  const players = localStorage.getItem("fileInfo_players");
  const team = localStorage.getItem("fileInfo_team");
  const scout = localStorage.getItem("fileInfo_scout");

  const loaded: any = {};

  if (players) loaded.players = JSON.parse(players);
  if (team) loaded.team = JSON.parse(team);
  if (scout) loaded.scout = JSON.parse(scout);

  setFileInfo(loaded);
}, []);
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
  handleFileUpload(e, block.type);
}}
  />
</label>
{fileInfo[block.type] && (
  <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4">

    <div className="mb-2 flex items-center gap-2">
      <div className="h-2 w-2 rounded-full bg-green-400" />
      <span className="text-sm font-medium text-green-400">
        Cargado
      </span>
    </div>

    <p className="text-xs text-white/60">
      Archivo
    </p>

    <p className="mb-3 text-sm text-white">
      {fileInfo[block.type].fileName}
    </p>

    <p className="text-xs text-white/60">
      Registros
    </p>

    <p className="mb-3 text-sm text-white">
      {fileInfo[block.type].records}
    </p>

    <p className="text-xs text-white/60">
      Última actualización
    </p>

    <p className="text-sm text-white">
      {fileInfo[block.type].updatedAt}
    </p>

  </div>
)}
{block.title === "Jugadores Castilla" && (
  <div className="mt-4">
    <div className="h-px bg-white/10" />
    <p className="mt-3 text-sm text-green-400">
      {playersData.length} registros cargados
    </p>
  </div>
)}

{block.title === "Datos Colectivos" && (
  <div className="mt-4">
    <div className="h-px bg-white/10" />
    <p className="mt-3 text-sm text-green-400">
      {teamData.length} registros cargados
    </p>
  </div>
)}

{block.title === "Scout Rival" && (
  <div className="mt-4">
    <div className="h-px bg-white/10" />
    <p className="mt-3 text-sm text-green-400">
      {scoutData.length} registros cargados
    </p>
  </div>
)}
              </div>
            ))}

          </div>
        </div>
      </main>
    </div>
  );
}