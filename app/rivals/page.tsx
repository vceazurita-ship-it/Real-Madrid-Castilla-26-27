"use client";

import { useEffect, useMemo, useState } from "react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Save,
  ExternalLink,
  FileText,
  Video,
  UserRound,
} from "lucide-react";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

type RivalPlayer = {
  ID_JUGADOR: string;
  ID_EQUIPO: string;
  NOMBRE_EQUIPO: string;
  DORSAL: string | number;
  JUGADOR: string;
  "NOMBRE DEPORTIVO": string;
  "LUGAR DE NACIMIENTO": string;
  EDAD: string | number;
  PESO: string | number;
  ALTURA: string;
  "POSICIÓN": string;
  "2º POSICIÓN": string;
  "PIE DOMINANTE": string;
  PROCEDENCIA: string;
  "FECHA INCORPORACIÓN": string;

  IMPACTO: string;
  ROL: string;
  CARACTERÍSTICAS: string;
  FORTALEZAS: string;
  DEBILIDADES: string;
  OBSERVACIONES: string;

  VIDEO: string;
  DOC: string;
  FOTO: string;
  ESTADO: string;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getPositionStyle(position: string) {
  const value = normalize(position);

  if (value.includes("portero")) {
    return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  }

  if (
    value.includes("central") ||
    value.includes("lateral") ||
    value.includes("carrilero")
  ) {
    return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  }

  if (value.includes("medio")) {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  }

  if (
    value.includes("extremo") ||
    value.includes("delantero")
  ) {
    return "bg-red-500/15 text-red-300 border-red-500/30";
  }

  return "bg-white/10 text-white/70 border-white/10";
}

export default function RivalPlayersPage() {
  const [players, setPlayers] = useState<RivalPlayer[]>([]);

  const [loading, setLoading] = useState(true);

  const [selectedTeam, setSelectedTeam] =
    useState<string>("");

  const [search, setSearch] =
    useState("");

  const [positionFilter, setPositionFilter] =
    useState("TODAS");

  const [selectedPlayer, setSelectedPlayer] =
    useState<RivalPlayer | null>(null);

  const [editForm, setEditForm] =
    useState<RivalPlayer | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [touchStartX, setTouchStartX] =
    useState<number | null>(null);

  /*
  |--------------------------------------------------------------------------
  | CARGA DE PLANTILLAS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    async function loadPlayers() {
      try {
        setLoading(true);

        const response = await fetch(
          `${APPS_SCRIPT_URL}?action=rivalesPlantillas`
        );

        const data = await response.json();

        if (Array.isArray(data)) {
          setPlayers(data);

          if (data.length > 0) {
            setSelectedTeam(
              data[0].NOMBRE_EQUIPO
            );
          }
        } else {
          console.error(data);
          setPlayers([]);
        }
      } catch (error) {
        console.error(
          "Error cargando jugadores rivales:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadPlayers();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | EQUIPOS
  |--------------------------------------------------------------------------
  */

  const teams = useMemo(() => {
    return [
      ...new Set(
        players
          .map((player) =>
            String(player.NOMBRE_EQUIPO || "")
          )
          .filter(Boolean)
      ),
    ];
  }, [players]);

  /*
  |--------------------------------------------------------------------------
  | POSICIONES
  |--------------------------------------------------------------------------
  */

  const positions = useMemo(() => {
    return [
      "TODAS",
      ...new Set(
        players
          .filter(
            (player) =>
              player.NOMBRE_EQUIPO === selectedTeam
          )
          .map((player) =>
            String(player["POSICIÓN"] || "")
          )
          .filter(Boolean)
      ),
    ];
  }, [players, selectedTeam]);

  /*
  |--------------------------------------------------------------------------
  | FILTRADO
  |--------------------------------------------------------------------------
  */

  const filteredPlayers = useMemo(() => {
    const searchValue = normalize(search);

    return players.filter((player) => {
      const sameTeam =
        player.NOMBRE_EQUIPO === selectedTeam;

      const samePosition =
        positionFilter === "TODAS" ||
        player["POSICIÓN"] === positionFilter;

      const matchesSearch =
        !searchValue ||
        normalize(player.JUGADOR).includes(
          searchValue
        ) ||
        normalize(
          player["NOMBRE DEPORTIVO"]
        ).includes(searchValue) ||
        String(player.DORSAL).includes(
          searchValue
        ) ||
        normalize(player["POSICIÓN"]).includes(
          searchValue
        );

      return (
        sameTeam &&
        samePosition &&
        matchesSearch
      );
    });
  }, [
    players,
    selectedTeam,
    positionFilter,
    search,
  ]);

  /*
  |--------------------------------------------------------------------------
  | ABRIR JUGADOR
  |--------------------------------------------------------------------------
  */

  const openPlayer = (player: RivalPlayer) => {
    setSelectedPlayer(player);
    setEditForm({ ...player });
  };

  const closePlayer = () => {
    setSelectedPlayer(null);
    setEditForm(null);
  };

  /*
  |--------------------------------------------------------------------------
  | NAVEGACIÓN
  |--------------------------------------------------------------------------
  */

  const selectedIndex = selectedPlayer
    ? filteredPlayers.findIndex(
        (player) =>
          player.ID_JUGADOR ===
          selectedPlayer.ID_JUGADOR
      )
    : -1;

  const navigatePlayer = (direction: number) => {
    if (
      selectedIndex === -1 ||
      filteredPlayers.length === 0
    ) {
      return;
    }

    const nextIndex =
      selectedIndex + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= filteredPlayers.length
    ) {
      return;
    }

    openPlayer(
      filteredPlayers[nextIndex]
    );
  };

  /*
  |--------------------------------------------------------------------------
  | TECLADO
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!selectedPlayer) return;

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "ArrowLeft") {
        navigatePlayer(-1);
      }

      if (event.key === "ArrowRight") {
        navigatePlayer(1);
      }

      if (event.key === "Escape") {
        closePlayer();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    selectedPlayer,
    selectedIndex,
    filteredPlayers,
  ]);

  /*
  |--------------------------------------------------------------------------
  | GUARDAR
  |--------------------------------------------------------------------------
  */

  const savePlayer = async () => {
    if (!editForm) return;

    try {
      setSaving(true);

      const response = await fetch(
        APPS_SCRIPT_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action:
              "guardarRivalJugador",

            ...editForm,
          }),
        }
      );

      const result =
        await response.json();

      if (!result.success) {
        throw new Error(
          result.error ||
            "No se pudo guardar"
        );
      }

      setPlayers((current) =>
        current.map((player) =>
          player.ID_JUGADOR ===
          editForm.ID_JUGADOR
            ? editForm
            : player
        )
      );

      setSelectedPlayer(editForm);

      alert("Jugador guardado correctamente");
    } catch (error) {
      console.error(error);

      alert(
        "No se pudo guardar el jugador"
      );
    } finally {
      setSaving(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | TOUCH / SWIPE
  |--------------------------------------------------------------------------
  */

  const handleTouchStart = (
    event: React.TouchEvent
  ) => {
    setTouchStartX(
      event.touches[0].clientX
    );
  };

  const handleTouchEnd = (
    event: React.TouchEvent
  ) => {
    if (touchStartX === null) return;

    const endX =
      event.changedTouches[0].clientX;

    const difference =
      touchStartX - endX;

    if (Math.abs(difference) > 60) {
      if (difference > 0) {
        navigatePlayer(1);
      } else {
        navigatePlayer(-1);
      }
    }

    setTouchStartX(null);
  };

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">

        <Sidebar />

        <section className="w-full">

          <Topbar />

          <div className="px-4 py-6 md:px-8 md:py-8">

            {/* HEADER */}

            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA · RIVALES
            </p>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">

              <h1 className="text-2xl font-semibold md:text-4xl">
                Plantillas rivales
              </h1>

              <div className="hidden h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />

            </div>

            {/* SELECTOR DE EQUIPO */}

            <div className="mt-8 flex gap-2 overflow-x-auto pb-2">

              {teams.map((team) => (

                <button
                  key={team}
                  onClick={() => {
                    setSelectedTeam(team);
                    setPositionFilter("TODAS");
                    setSearch("");
                  }}
                  className={`
                    whitespace-nowrap
                    rounded-xl
                    border
                    px-4
                    py-3
                    text-sm
                    transition
                    ${
                      selectedTeam === team
                        ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                        : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30"
                    }
                  `}
                >
                  {team}
                </button>

              ))}

            </div>

            {/* FILTROS */}

            <div className="mt-6 grid gap-3 md:grid-cols-[1fr_220px]">

              <div className="relative">

                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Buscar jugador..."
                  className="
                    w-full
                    rounded-xl
                    border
                    border-white/10
                    bg-[#11161D]
                    py-3
                    pl-11
                    pr-4
                    outline-none
                    transition
                    focus:border-[#C8A96B]
                  "
                />

              </div>

              <select
                value={positionFilter}
                onChange={(event) =>
                  setPositionFilter(
                    event.target.value
                  )
                }
                className="
                  rounded-xl
                  border
                  border-white/10
                  bg-[#11161D]
                  px-4
                  py-3
                  text-white
                  outline-none
                  focus:border-[#C8A96B]
                "
              >

                {positions.map(
                  (position) => (

                    <option
                      key={position}
                      value={position}
                    >
                      {position}
                    </option>

                  )
                )}

              </select>

            </div>

            {/* CONTADOR */}

            <div className="mt-6 flex items-center justify-between">

              <p className="text-sm text-white/50">

                {filteredPlayers.length} jugadores

              </p>

              <p className="text-xs text-white/30">

                {selectedTeam}

              </p>

            </div>

            {/* PLANTILLA POR POSICIONES */}

            {loading ? (

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/50">

                Cargando plantilla...

              </div>

            ) : (

              <div className="mt-6 space-y-6">

                {[
                  {
                    title: "PORTEROS",
                    positions: [
                      "portero",
                    ],
                  },
                  {
                    title: "DEFENSAS",
                    positions: [
                      "lateral derecho",
                      "central",
                      "lateral izquierdo",
                    ],
                  },
                  {
                    title: "CENTROCAMPISTAS",
                    positions: [
                      "mediocentro",
                      "interior",
                      "pivote",
                      "medio",
                    ],
                  },
                  {
                    title: "ATACANTES",
                    positions: [
                      "extremo derecho",
                      "extremo izquierdo",
                      "delantero",
                    ],
                  },
                ].map((line) => {

                  const linePlayers =
                    filteredPlayers.filter((player) => {

                      const position =
                        normalize(
                          player["POSICIÓN"]
                        );

                      return line.positions.some(
                        (item) =>
                          position.includes(
                            normalize(item)
                          )
                      );

                    });

                  if (linePlayers.length === 0) {
                    return null;
                  }

                  return (

                    <section
                      key={line.title}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
                    >

                      {/* CABECERA DE LÍNEA */}

                      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-4 py-3">

                        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">

                          {line.title}

                        </h2>

                        <span className="text-xs text-white/30">

                          {linePlayers.length} jugadores

                        </span>

                      </div>

                      {/* JUGADORES */}

                      <div className="grid gap-px bg-white/5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                        {linePlayers.map((player) => (

                          <button
                            key={
                              player.ID_JUGADOR
                            }
                            onClick={() =>
                              openPlayer(
                                player
                              )
                            }
                            className="
                              group
                              flex
                              items-center
                              gap-3
                              bg-[#11161D]
                              p-3
                              text-left
                              transition
                              hover:bg-white/[0.07]
                            "
                          >

                            {/* FOTO PEQUEÑA */}

                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#0B0F14]">

                              {player.FOTO ? (

                                <img
                                  src={
                                    player.FOTO
                                  }
                                  alt={
                                    player[
                                      "NOMBRE DEPORTIVO"
                                    ] ||
                                    player.JUGADOR
                                  }
                                  className="
                                    h-full
                                    w-full
                                    object-cover
                                    transition
                                    group-hover:scale-110
                                  "
                                />

                              ) : (

                                <div className="flex h-full items-center justify-center">

                                  <UserRound
                                    size={20}
                                    className="text-white/20"
                                  />

                                </div>

                              )}

                            </div>

                            {/* INFORMACIÓN */}

                            <div className="min-w-0 flex-1">

                              <p className="truncate font-semibold">

                                {
                                  player[
                                    "NOMBRE DEPORTIVO"
                                  ] ||
                                  player.JUGADOR
                                }

                              </p>

                              <p className="mt-0.5 truncate text-xs text-white/40">

                                {
                                  player[
                                    "POSICIÓN"
                                  ]
                                }

                              </p>

                            </div>

                            {/* DORSAL */}

                            <div className="shrink-0 text-right">

                              <span className="text-lg font-bold text-white/30">

                                {player.DORSAL}

                              </span>

                            </div>

                          </button>

                        ))}

                      </div>

                    </section>

                  );

                })}

                {filteredPlayers.length === 0 && (

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">

                    No se han encontrado jugadores.

                  </div>

                )}

              </div>

            )}



          </div>

        </section>

      </div>

      {/* MODAL */}

      {selectedPlayer &&
        editForm && (

          <div
            className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              bg-black/80
              p-3
              md:p-8
            "
            onClick={closePlayer}
          >

            <div
              className="
                relative
                flex
                max-h-[95vh]
                w-full
                max-w-6xl
                flex-col
                overflow-hidden
                rounded-2xl
                border
                border-white/10
                bg-[#11161D]
                shadow-2xl
              "
              onClick={(event) =>
                event.stopPropagation()
              }
              onTouchStart={
                handleTouchStart
              }
              onTouchEnd={
                handleTouchEnd
              }
            >

              {/* HEADER MODAL */}

              <div className="flex items-center justify-between border-b border-white/10 p-4 md:p-6">

                <div className="flex items-center gap-3">

                  <button
                    onClick={() =>
                      navigatePlayer(-1)
                    }
                    disabled={
                      selectedIndex <= 0
                    }
                    className="
                      rounded-full
                      border
                      border-white/10
                      p-2
                      transition
                      hover:border-[#C8A96B]
                      disabled:opacity-20
                    "
                  >

                    <ChevronLeft
                      size={20}
                    />

                  </button>

                  <div>

                    <p className="text-xs uppercase tracking-[0.2em] text-[#C8A96B]">

                      {selectedPlayer.NOMBRE_EQUIPO}

                    </p>

                    <h2 className="text-xl font-semibold md:text-2xl">

                      {
                        selectedPlayer[
                          "NOMBRE DEPORTIVO"
                        ] ||
                        selectedPlayer.JUGADOR
                      }

                    </h2>

                  </div>

                  <button
                    onClick={() =>
                      navigatePlayer(1)
                    }
                    disabled={
                      selectedIndex >=
                      filteredPlayers.length - 1
                    }
                    className="
                      rounded-full
                      border
                      border-white/10
                      p-2
                      transition
                      hover:border-[#C8A96B]
                      disabled:opacity-20
                    "
                  >

                    <ChevronRight
                      size={20}
                    />

                  </button>

                </div>

                <button
                  onClick={closePlayer}
                  className="
                    rounded-full
                    p-2
                    text-white/50
                    transition
                    hover:bg-white/10
                    hover:text-white
                  "
                >

                  <X size={22} />

                </button>

              </div>

              {/* BODY */}

              <div className="overflow-y-auto">

                <div className="grid gap-6 p-4 md:grid-cols-[320px_1fr] md:p-6">

                  {/* COLUMNA IZQUIERDA */}

                  <div>

                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F14]">

                      {editForm.FOTO ? (

                        <img
                          src={
                            editForm.FOTO
                          }
                          alt={
                            editForm[
                              "NOMBRE DEPORTIVO"
                            ]
                          }
                          className="aspect-[3/4] w-full object-cover"
                        />

                      ) : (

                        <div className="flex aspect-[3/4] items-center justify-center">

                          <UserRound
                            size={80}
                            className="text-white/20"
                          />

                        </div>

                      )}

                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">

                      <Info
                        label="Dorsal"
                        value={
                          editForm.DORSAL
                        }
                      />

                      <Info
                        label="Edad"
                        value={
                          editForm.EDAD
                        }
                      />

                      <Info
                        label="Peso"
                        value={
                          editForm.PESO
                        }
                      />

                      <Info
                        label="Altura"
                        value={
                          editForm.ALTURA
                        }
                      />

                      <Info
                        label="Pie"
                        value={
                          editForm[
                            "PIE DOMINANTE"
                          ]
                        }
                      />

                      <Info
                        label="Posición"
                        value={
                          editForm[
                            "POSICIÓN"
                          ]
                        }
                      />

                    </div>

                    <div className="mt-4 space-y-2 text-sm">

                      <InfoLine
                        label="Procedencia"
                        value={
                          editForm.PROCEDENCIA
                        }
                      />

                      <InfoLine
                        label="Lugar nacimiento"
                        value={
                          editForm[
                            "LUGAR DE NACIMIENTO"
                          ]
                        }
                      />

                      <InfoLine
                        label="2ª posición"
                        value={
                          editForm[
                            "2º POSICIÓN"
                          ]
                        }
                      />

                    </div>

                  </div>

                  {/* COLUMNA DERECHA */}

                  <div className="space-y-5">

                    <div className="grid gap-4 md:grid-cols-2">

                      <EditableField
                        label="Impacto"
                        value={
                          editForm.IMPACTO
                        }
                        onChange={(
                          value
                        ) =>
                          setEditForm({
                            ...editForm,
                            IMPACTO:
                              value,
                          })
                        }
                      />

                      <EditableField
                        label="Rol"
                        value={
                          editForm.ROL
                        }
                        onChange={(
                          value
                        ) =>
                          setEditForm({
                            ...editForm,
                            ROL: value,
                          })
                        }
                      />

                    </div>

                    <EditableTextarea
                      label="Características"
                      value={
                        editForm.CARACTERÍSTICAS
                      }
                      onChange={(
                        value
                      ) =>
                        setEditForm({
                          ...editForm,
                          CARACTERÍSTICAS:
                            value,
                        })
                      }
                    />

                    <EditableTextarea
                      label="Fortalezas"
                      value={
                        editForm.FORTALEZAS
                      }
                      onChange={(
                        value
                      ) =>
                        setEditForm({
                          ...editForm,
                          FORTALEZAS:
                            value,
                        })
                      }
                    />

                    <EditableTextarea
                      label="Debilidades"
                      value={
                        editForm.DEBILIDADES
                      }
                      onChange={(
                        value
                      ) =>
                        setEditForm({
                          ...editForm,
                          DEBILIDADES:
                            value,
                        })
                      }
                    />

                    <EditableTextarea
                      label="Observaciones"
                      value={
                        editForm.OBSERVACIONES
                      }
                      onChange={(
                        value
                      ) =>
                        setEditForm({
                          ...editForm,
                          OBSERVACIONES:
                            value,
                        })
                      }
                    />

                    <div className="grid gap-4 md:grid-cols-2">

                      <EditableField
                        label="Foto URL"
                        value={
                          editForm.FOTO
                        }
                        onChange={(
                          value
                        ) =>
                          setEditForm({
                            ...editForm,
                            FOTO: value,
                          })
                        }
                      />

                      <EditableField
                        label="Vídeo URL"
                        value={
                          editForm.VIDEO
                        }
                        onChange={(
                          value
                        ) =>
                          setEditForm({
                            ...editForm,
                            VIDEO: value,
                          })
                        }
                      />

                    </div>

                    <EditableField
                      label="Documento URL"
                      value={
                        editForm.DOC
                      }
                      onChange={(
                        value
                      ) =>
                        setEditForm({
                          ...editForm,
                          DOC: value,
                        })
                      }
                    />

                    {/* LINKS */}

                    <div className="flex flex-wrap gap-3">

                      {editForm.VIDEO && (

                        <a
                          href={
                            editForm.VIDEO
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="
                            flex
                            items-center
                            gap-2
                            rounded-xl
                            border
                            border-white/10
                            bg-white/[0.04]
                            px-4
                            py-3
                            text-sm
                            transition
                            hover:border-[#C8A96B]
                          "
                        >

                          <Video
                            size={16}
                            className="text-[#C8A96B]"
                          />

                          Ver vídeo

                          <ExternalLink
                            size={14}
                          />

                        </a>

                      )}

                      {editForm.DOC && (

                        <a
                          href={
                            editForm.DOC
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="
                            flex
                            items-center
                            gap-2
                            rounded-xl
                            border
                            border-white/10
                            bg-white/[0.04]
                            px-4
                            py-3
                            text-sm
                            transition
                            hover:border-[#C8A96B]
                          "
                        >

                          <FileText
                            size={16}
                            className="text-[#C8A96B]"
                          />

                          Ver documento

                          <ExternalLink
                            size={14}
                          />

                        </a>

                      )}

                    </div>

                  </div>

                </div>

              </div>

              {/* FOOTER */}

              <div className="flex items-center justify-end gap-3 border-t border-white/10 p-4 md:p-6">

                <button
                  onClick={closePlayer}
                  className="
                    rounded-xl
                    border
                    border-white/10
                    px-4
                    py-3
                    text-sm
                    text-white/60
                    transition
                    hover:border-white/30
                    hover:text-white
                  "
                >

                  Cancelar

                </button>

                <button
                  onClick={savePlayer}
                  disabled={saving}
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-xl
                    bg-[#C8A96B]
                    px-5
                    py-3
                    text-sm
                    font-semibold
                    text-black
                    transition
                    hover:bg-[#d8ba7c]
                    disabled:opacity-50
                  "
                >

                  <Save size={16} />

                  {saving
                    ? "Guardando..."
                    : "Guardar"}

                </button>

              </div>

            </div>

          </div>

        )}

    </main>
  );
}

/*
|--------------------------------------------------------------------------
| COMPONENTES AUXILIARES
|--------------------------------------------------------------------------
*/

function Info({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">

      <p className="text-[10px] uppercase tracking-wider text-white/40">

        {label}

      </p>

      <p className="mt-1 text-sm font-medium">

        {String(value || "—")}

      </p>

    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2">

      <span className="text-white/40">

        {label}

      </span>

      <span className="text-right">

        {String(value || "—")}

      </span>

    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-xs uppercase tracking-wider text-white/40">

        {label}

      </span>

      <input
        value={String(value || "")}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="
          w-full
          rounded-xl
          border
          border-white/10
          bg-[#0B0F14]
          px-4
          py-3
          text-sm
          outline-none
          transition
          focus:border-[#C8A96B]
        "
      />

    </label>
  );
}

function EditableTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-xs uppercase tracking-wider text-white/40">

        {label}

      </span>

      <textarea
        value={String(value || "")}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        rows={4}
        className="
          w-full
          resize-none
          rounded-xl
          border
          border-white/10
          bg-[#0B0F14]
          px-4
          py-3
          text-sm
          outline-none
          transition
          focus:border-[#C8A96B]
        "
      />

    </label>
  );
}