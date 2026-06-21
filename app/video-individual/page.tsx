"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useState } from "react";
import Papa from "papaparse";

export default function VideoIndividual() {
  const [clips, setClips] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [rivalFilter, setRivalFilter] = useState("");

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

  const filteredClips = [...clips]
  .filter((clip) => {
    const playerMatch = clip.Jugador
      ?.toLowerCase()
      .includes(search.toLowerCase());

    const positionMatch =
      !positionFilter ||
      clip["Posición"] === positionFilter;

    const categoryMatch =
      !categoryFilter ||
      clip["Categoría"] === categoryFilter;

    const subCategoryMatch =
      !subCategoryFilter ||
      clip["Subcategoría"] === subCategoryFilter;

    const rivalMatch =
      !rivalFilter ||
      clip.Rival === rivalFilter;

    return (
      playerMatch &&
      positionMatch &&
      categoryMatch &&
      subCategoryMatch &&
      rivalMatch
    );
  })
  .sort((a, b) => {
    if (!a.Fecha || !b.Fecha) return 0;

    const [da, ma, ya] = a.Fecha.split("/");
    const [db, mb, yb] = b.Fecha.split("/");

    const dateA = new Date(`${ya}-${ma}-${da}`);
    const dateB = new Date(`${yb}-${mb}-${db}`);

    return dateB.getTime() - dateA.getTime();
  });

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
              Propia · Individual
            </h1>

            <p className="mt-3 text-white/60">
              Texto explicativo
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">

              <input
                type="text"
                placeholder="Buscar jugador..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                className="
                  rounded-xl
                  border border-white/10
                  bg-white/[0.03]
                  px-4 py-3
                  text-white
                  outline-none
                "
              />

              <select
                value={positionFilter}
                onChange={(e) =>
                  setPositionFilter(e.target.value)
                }
                className="
                  rounded-xl
                  border border-white/10
                  bg-[#111827]
                  px-4 py-3
                "
              >
                <option value="">
                  Todas las posiciones
                </option>

                {[
                  ...new Set(
                    clips.map(
                      (c) => c["Posición"]
                    )
                  ),
                ].map((p: any) => (
                  <option key={p}>
                    {p}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value)
                }
                className="
                  rounded-xl
                  border border-white/10
                  bg-[#111827]
                  px-4 py-3
                "
              >
                <option value="">
                  Todas las categorías
                </option>

                {[
                  ...new Set(
                    clips.map(
                      (c) => c["Categoría"]
                    )
                  ),
                ].map((c: any) => (
                  <option key={c}>
                    {c}
                  </option>
                ))}
              </select>
                <select
  value={subCategoryFilter}
  onChange={(e) =>
    setSubCategoryFilter(e.target.value)
  }
  className="
    rounded-xl
    border border-white/10
    bg-[#111827]
    px-4 py-3
  "
>
  <option value="">
    Todas las subcategorías
  </option>

  {[
    ...new Set(
      clips.map(
        (c) => c["Subcategoría"]
      )
    ),
  ]
    .filter(Boolean)
    .map((s: any) => (
      <option key={s}>
        {s}
      </option>
    ))}
</select>

<select
  value={rivalFilter}
  onChange={(e) =>
    setRivalFilter(e.target.value)
  }
  className="
    rounded-xl
    border border-white/10
    bg-[#111827]
    px-4 py-3
  "
>
  <option value="">
    Todos los rivales
  </option>

  {[
    ...new Set(
      clips.map((c) => c.Rival)
    ),
  ]
    .filter(Boolean)
    .map((r: any) => (
      <option key={r}>
        {r}
      </option>
    ))}
</select>
              <div
                className="
                  flex
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.03]
                  font-medium
                "
              >
                {filteredClips.length} clips
              </div>

            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

            {filteredClips.map(
              (clip: any, index: number) => (
                <div
                  key={index}
                  className="
                    rounded-2xl
                    border border-white/10
                    bg-white/[0.03]
                    p-4
                    transition
                    hover:bg-white/[0.05]
                  "
                >
                  <div className="flex items-start justify-between">

                    <div>
                      <h3 className="text-lg font-semibold">
                        {clip.Jugador}
                      </h3>

                      <p className="text-sm text-white/50">
                        {clip["Posición"]}
                      </p>
                    </div>

                    <div className="text-sm text-[#C8A96B]">
                      {clip.Minuto}'
                    </div>

                  </div>

                  <div className="mt-4 space-y-2">

                    <p className="text-sm">
                      <span className="text-white/40">
                        Categoría:
                      </span>{" "}
                      {clip["Categoría"]}
                    </p>

                    <p className="text-sm">
                      <span className="text-white/40">
                        Subcategoría:
                      </span>{" "}
                      {clip["Subcategoría"]}
                    </p>

                    <p className="text-sm">
                      <span className="text-white/40">
                        Competición:
                      </span>{" "}
                      {clip["Competición"]}
                    </p>

                    <p className="text-sm">
                      <span className="text-white/40">
                        Fecha:
                      </span>{" "}
                      {clip.Fecha}
                    </p>
                    <p className="text-sm">
  <span className="text-white/40">
    Rival:
  </span>{" "}
  {clip.Rival || "-"}
</p>

                  </div>

                  <div className="mt-5 flex items-center justify-between">

                    <span
                      className="
                        rounded-lg
                        border border-[#C8A96B]/20
                        bg-[#C8A96B]/10
                        px-2 py-1
                        text-xs
                        text-[#C8A96B]
                      "
                    >
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
                        px-4
                        py-2
                        text-sm
                        font-medium
                        text-black
                        transition
                        hover:opacity-90
                      "
                    >
                      ▶ Ver clip
                    </button>

                  </div>
                </div>
              )
            )}

          </div>
        </div>
      </main>
    </div>
  );
}