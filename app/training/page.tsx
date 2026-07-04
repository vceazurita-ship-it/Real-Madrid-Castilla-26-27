"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import ImportAvailability, {
  TrainingImport,
} from "@/components/session/ImportAvailability";

export default function ImportTrainingPage() {
  const [trainingImport, setTrainingImport] =
    useState<TrainingImport | null>(null);

  const [licencias, setLicencias] = useState<
    Record<string, string>
  >({});

  const [creating, setCreating] = useState<string | null>(
    null
  );
  const [availabilityStatus, setAvailabilityStatus] = useState<
  Record<string, string>
>({});
  const createPlayer = async (
    name: string,
    licencia: string
  ) => {
    setCreating(name);

    try {
      const response = await fetch("/api/create-player", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name,
    licencia,
    estado: "ÓPTIMO",
  }),
});

const result = await response.json();

console.log("CREATE PLAYER:", result);

if (!result.ok) {
toast.error("No se pudo crear el jugador");
  return;
}

toast.success(`${name} creado correctamente`);

setTrainingImport((prev) => {

  if (!prev) return prev;

  const actualizar = (lista: any[]) =>
    lista.map((p) =>
      p.detected === name
        ? {
            ...p,
            official: name,
            confidence: 100,
          }
        : p
    );

  return {

    ...prev,

    available: actualizar(prev.available),
    promotion: actualizar(prev.promotion),
    injury: actualizar(prev.injury),
    others: actualizar(prev.others),
    nationalTeam: actualizar(prev.nationalTeam),

    pendingPlayers: prev.pendingPlayers.filter(
      (p) => p.name !== name
    ),

  };

});
    } finally {
      setCreating(null);
    }
  };

  return (
  <main className="min-h-screen bg-[#0B0F14] text-white">
    <div className="flex">

      <Sidebar />

      <section className="w-full">

        <Topbar />

        <div className="px-6 lg:px-10 py-8 space-y-8">

          {/* Header */}

          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA · SESIÓN
            </p>

            <div className="mt-4 flex items-center gap-5">
              <h1 className="text-4xl font-semibold tracking-tight">
                Importador de entrenamiento
              </h1>

              <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
            </div>

            <p className="mt-4 max-w-3xl text-white/60">
              Sube una imagen del entrenamiento para detectar automáticamente
              la disponibilidad de todos los jugadores.
            </p>
          </div>

          {/* Importador */}

          <div
            className="
              rounded-[28px]
              border
              border-white/10
              bg-gradient-to-b
              from-white/[0.05]
              to-white/[0.02]
              p-8
              backdrop-blur-sm
              shadow-[0_12px_40px_rgba(0,0,0,0.35)]
            "
          >
            <ImportAvailability
  onImport={(data) => {

    setTrainingImport(data);

    const estados: Record<string, string> = {};

    data.available.forEach((p: any) => {
      if (p.official) {
        estados[p.official] = "ÓPTIMO";
      }
    });

    setAvailabilityStatus(estados);

  }}
/>
          </div>

          {trainingImport && (
        <>
          {/* Resumen */}

          <div className="grid grid-cols-2 xl:grid-cols-5 gap-5">

  {[
    ["Disponibles", trainingImport.available.length],
    ["Promoción", trainingImport.promotion.length],
    ["Lesión", trainingImport.injury.length],
    ["Otros", trainingImport.others.length],
    ["Selección", trainingImport.nationalTeam.length],
  ].map(([titulo, total]) => (
    <div
      key={titulo as string}
      className="
        rounded-[22px]
        border
        border-white/10
        bg-gradient-to-b
        from-white/[0.06]
        to-white/[0.03]
        p-6
        backdrop-blur-sm
        shadow-lg
        transition-all
        hover:border-[#C8A96B]/40
        hover:-translate-y-1
      "
    >
      <div className="text-4xl font-bold text-[#C8A96B]">
        {total}
      </div>

      <div className="mt-3 text-sm uppercase tracking-wider text-white/65">
        {titulo}
      </div>
    </div>
  ))}

</div>

          {/* Jugadores nuevos */}

          {trainingImport.pendingPlayers.length > 0 && (
  <div
    className="
      rounded-[28px]
      border
      border-[#C8A96B]/30
      bg-gradient-to-b
      from-[#161D26]
      to-[#11161D]
      p-8
      shadow-[0_12px_40px_rgba(0,0,0,0.35)]
    "
  >
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-semibold">
          Nuevos jugadores detectados
        </h2>

        <p className="mt-1 text-white/60">
          Estos jugadores no existen todavía en la base de datos.
        </p>
      </div>

      <div className="rounded-full bg-[#C8A96B]/15 px-4 py-2 text-sm text-[#C8A96B]">
        {trainingImport.pendingPlayers.length} pendientes
      </div>
    </div>

    <div className="space-y-4">
      {trainingImport.pendingPlayers.map((player: any) => (
        <div
          key={player.name}
          className="
            flex
            flex-col
            lg:flex-row
            lg:items-center
            gap-5
            rounded-2xl
            border
            border-white/10
            bg-white/[0.04]
            p-5
            transition
            hover:border-[#C8A96B]/40
          "
        >
          <div className="flex items-center gap-4 flex-1">
            <Image
              src={player.photo || "/players/default.png"}
              alt={player.name}
              width={60}
              height={60}
              className="rounded-full border border-white/10 object-cover"
            />

            <div>
              <div className="text-lg font-semibold">
                {player.name}
              </div>

              <div className="text-sm text-white/60">
                Jugador nuevo detectado
              </div>
            </div>
          </div>

          <select
            className="
              rounded-xl
              border
              border-white/10
              bg-[#1A212C]
              px-4
              py-3
              text-white
              outline-none
            "
            value={licencias[player.name] ?? "JUV A"}
            onChange={(e) =>
              setLicencias({
                ...licencias,
                [player.name]: e.target.value,
              })
            }
          >
            <option value="RMC">Real Madrid C</option>
            <option value="JUV A">Juvenil A</option>
            <option value="JUV B">Juvenil B</option>
          </select>

          <button
            className="
              rounded-xl
              bg-[#C8A96B]
              px-6
              py-3
              font-semibold
              text-[#0B0F14]
              transition
              hover:brightness-110
              disabled:opacity-50
            "
            disabled={creating === player.name}
            onClick={() =>
              createPlayer(
                player.name,
                licencias[player.name] ?? "JUV A"
              )
            }
          >
            {creating === player.name
              ? "Creando..."
              : "Crear jugador"}
          </button>
        </div>
      ))}
    </div>
  </div>
)}

          {/* Tablas */}

          <div className="space-y-8">

  {[
    ["Disponibles", trainingImport.available],
    ["Promoción", trainingImport.promotion],
    ["Lesión", trainingImport.injury],
    ["Otros", trainingImport.others],
    ["Selección", trainingImport.nationalTeam],
  ].map(([titulo, lista]) => (
    <div
      key={titulo as string}
      className="
        rounded-[28px]
        border
        border-white/10
        bg-gradient-to-b
        from-white/[0.04]
        to-white/[0.02]
        backdrop-blur-sm
        overflow-hidden
        shadow-[0_10px_35px_rgba(0,0,0,0.30)]
      "
    >

      {/* Cabecera */}

      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">

        <h2 className="text-xl font-semibold">
          {titulo as string}
        </h2>

        <span className="rounded-full bg-[#C8A96B]/15 px-3 py-1 text-sm text-[#C8A96B]">
          {(lista as any[]).length} jugadores
        </span>

      </div>

      <div className="overflow-x-auto">

        <table className="w-full min-w-[700px]">

          <thead>

            <tr className="border-b border-white/10 bg-white/[0.03]">

              <th className="px-6 py-4 text-left text-xs uppercase tracking-widest text-[#C8A96B]">
                Detectado
              </th>

              <th className="px-6 py-4 text-left text-xs uppercase tracking-widest text-[#C8A96B]">
                Jugador oficial
              </th>

              <th className="px-6 py-4 text-center text-xs uppercase tracking-widest text-[#C8A96B]">
                Confianza
              </th>

            </tr>

          </thead>

          <tbody>

            {(lista as any[]).map((p, i) => (

              <tr
                key={i}
                className="
                  border-b
                  border-white/5
                  transition
                  hover:bg-white/[0.03]
                "
              >

                <td className="px-6 py-4 font-medium">
                  {p.detected}
                </td>

                <td className="px-6 py-4">

                  {p.official ? (

                    <span className="text-white">
                      {p.official}
                    </span>

                  ) : (

                    <span className="text-red-400">
                      Sin identificar
                    </span>

                  )}

                </td>

                <td className="px-6 py-4 text-center">

                  <span
                    className={`
                      inline-flex
                      rounded-full
                      px-3
                      py-1
                      text-sm
                      font-semibold
                      ${
                        p.confidence >= 90
                          ? "bg-green-500/15 text-green-400"
                          : p.confidence >= 70
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-red-500/15 text-red-400"
                      }
                    `}
                  >
                    {p.confidence}%
                  </span>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  ))}

</div>

            </>
          )}

        </div>

      </section>

    </div>
  </main>
);
}