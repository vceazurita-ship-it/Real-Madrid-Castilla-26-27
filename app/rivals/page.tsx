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
    Plus,
  Trash2,
} from "lucide-react";

const RIVALS_API_URL = "/api/rivals";

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

  if (
    value.includes("medio") ||
    value.includes("mediocentro") ||
    value.includes("interior") ||
    value.includes("pivote")
  ) {
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
  const [players, setPlayers] =
    useState<RivalPlayer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [selectedTeam, setSelectedTeam] =
    useState<string>("");

  const [search, setSearch] =
    useState("");

  const [positionSearch, setPositionSearch] =
  useState("");

  const [selectedPlayer, setSelectedPlayer] =
    useState<RivalPlayer | null>(null);

  const [editForm, setEditForm] =
    useState<RivalPlayer | null>(null);

const [isCreating, setIsCreating] =
  useState(false);

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
  `${RIVALS_API_URL}?action=rivalesPlantillas`
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

        setPlayers([]);
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
            String(
              player.NOMBRE_EQUIPO || ""
            )
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

  /*
  |--------------------------------------------------------------------------
  | FILTRADO
  |--------------------------------------------------------------------------
  */

 const filteredPlayers = useMemo(() => {
  const searchValue = normalize(search);

  const positionSearchValue =
    normalize(positionSearch);

  return players.filter((player) => {
    const sameTeam =
      player.NOMBRE_EQUIPO === selectedTeam;

    const matchesSearch =
      !searchValue ||
      normalize(player.JUGADOR).includes(
        searchValue
      ) ||
      normalize(
        player["NOMBRE DEPORTIVO"]
      ).includes(searchValue) ||
      normalize(
        player.NOMBRE_EQUIPO
      ).includes(searchValue) ||
      String(player.DORSAL).includes(
        searchValue
      ) ||
      normalize(
        player["POSICIÓN"]
      ).includes(searchValue) ||
      normalize(
        player["2º POSICIÓN"]
      ).includes(searchValue);

    const matchesPosition =
      !positionSearchValue ||
      normalize(
        player["POSICIÓN"]
      ).includes(positionSearchValue) ||
      normalize(
        player["2º POSICIÓN"]
      ).includes(positionSearchValue);

    /*
    |--------------------------------------------------------------------------
    | SIN BÚSQUEDA GENERAL
    |--------------------------------------------------------------------------
    | Se muestra únicamente el equipo seleccionado
    */

    if (!searchValue) {
      return (
        sameTeam &&
        matchesPosition
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CON BÚSQUEDA GENERAL
    |--------------------------------------------------------------------------
    | También puede encontrar jugadores
    | por nombre de equipo
    */

    return (
      matchesSearch &&
      matchesPosition
    );
  });
}, [
  players,
  selectedTeam,
  search,
  positionSearch,
]);

  /*
  |--------------------------------------------------------------------------
  | ABRIR / CERRAR JUGADOR
  |--------------------------------------------------------------------------
  */

const createEmptyPlayer = (): RivalPlayer => ({
  ID_JUGADOR: "",
  ID_EQUIPO: "",
  NOMBRE_EQUIPO: selectedTeam,
  DORSAL: "",
  JUGADOR: "",
  "NOMBRE DEPORTIVO": "",
  "LUGAR DE NACIMIENTO": "",
  EDAD: "",
  PESO: "",
  ALTURA: "",
  "POSICIÓN": "",
  "2º POSICIÓN": "",
  "PIE DOMINANTE": "",
  PROCEDENCIA: "",
  "FECHA INCORPORACIÓN": "",

  IMPACTO: "",
  ROL: "",
  CARACTERÍSTICAS: "",
  FORTALEZAS: "",
  DEBILIDADES: "",
  OBSERVACIONES: "",

  VIDEO: "",
  DOC: "",
  FOTO: "",
  ESTADO: "ACTIVO",
});

 const openPlayer = (
  player: RivalPlayer
) => {
  setIsCreating(false);

  setSelectedPlayer(player);

  setEditForm({
    ...player,
  });
};

const openCreatePlayer = () => {
  setIsCreating(true);

  setSelectedPlayer(null);

  setEditForm(
    createEmptyPlayer()
  );
};

const closePlayer = () => {
  setSelectedPlayer(null);
  setEditForm(null);
  setIsCreating(false);
};

  /*
  |--------------------------------------------------------------------------
  | NAVEGACIÓN
  |--------------------------------------------------------------------------
  */

  const selectedIndex =
    selectedPlayer
      ? filteredPlayers.findIndex(
          (player) =>
            player.ID_JUGADOR ===
            selectedPlayer.ID_JUGADOR
        )
      : -1;

  const navigatePlayer = (
    direction: number
  ) => {
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
      nextIndex >=
        filteredPlayers.length
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
      if (
        event.key === "ArrowLeft"
      ) {
        navigatePlayer(-1);
      }

      if (
        event.key === "ArrowRight"
      ) {
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

    const action = isCreating
      ? "crearRivalJugador"
      : "guardarRivalJugador";

    const playerToSave: RivalPlayer = {
      ID_JUGADOR:
        editForm.ID_JUGADOR ||
        `RIV-JUG-${Date.now()}`,

      ID_EQUIPO:
        editForm.ID_EQUIPO ||
        `RIV-${Date.now()}`,

      NOMBRE_EQUIPO:
        editForm.NOMBRE_EQUIPO ||
        selectedTeam,

      DORSAL: editForm.DORSAL || "",

      JUGADOR: editForm.JUGADOR || "",

      "NOMBRE DEPORTIVO":
        editForm["NOMBRE DEPORTIVO"] || "",

      "LUGAR DE NACIMIENTO":
        editForm["LUGAR DE NACIMIENTO"] || "",

      EDAD: editForm.EDAD || "",

      PESO: editForm.PESO || "",

      ALTURA: editForm.ALTURA || "",

      "POSICIÓN":
        editForm["POSICIÓN"] || "",

      "2º POSICIÓN":
        editForm["2º POSICIÓN"] || "",

      "PIE DOMINANTE":
        editForm["PIE DOMINANTE"] || "",

      PROCEDENCIA:
        editForm.PROCEDENCIA || "",

      "FECHA INCORPORACIÓN":
        editForm["FECHA INCORPORACIÓN"] || "",

      IMPACTO:
        editForm.IMPACTO || "",

      ROL:
        editForm.ROL || "",

      CARACTERÍSTICAS:
        editForm.CARACTERÍSTICAS || "",

      FORTALEZAS:
        editForm.FORTALEZAS || "",

      DEBILIDADES:
        editForm.DEBILIDADES || "",

      OBSERVACIONES:
        editForm.OBSERVACIONES || "",

      VIDEO:
        editForm.VIDEO || "",

      DOC:
        editForm.DOC || "",

      FOTO:
        editForm.FOTO || "",

      ESTADO:
        editForm.ESTADO || "ACTIVO",
    };

    const response = await fetch(
      RIVALS_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          player: playerToSave,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.error ||
          "No se pudo guardar"
      );
    }

    if (isCreating) {
      setPlayers((current) => [
        ...current,
        playerToSave,
      ]);

      setSelectedTeam(
        playerToSave.NOMBRE_EQUIPO
      );

      alert(
        "Jugador añadido correctamente"
      );
    } else {
      setPlayers((current) =>
        current.map((player) =>
          player.ID_JUGADOR ===
          playerToSave.ID_JUGADOR
            ? playerToSave
            : player
        )
      );

      alert(
        "Jugador guardado correctamente"
      );
    }

    closePlayer();

  } catch (error) {
    console.error(error);

    alert(
      isCreating
        ? "No se pudo añadir el jugador"
        : "No se pudo guardar el jugador"
    );

  } finally {
    setSaving(false);
  }
};
const deletePlayer = async () => {
  if (!editForm) return;

  const playerName =
    editForm["NOMBRE DEPORTIVO"] ||
    editForm.JUGADOR;

  const confirmed =
    window.confirm(
      `¿Seguro que quieres eliminar a ${playerName}?`
    );

  if (!confirmed) return;

  try {

    setSaving(true);

    const response = await fetch(
  RIVALS_API_URL,
  {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json",
    },
    body: JSON.stringify({
      action: "eliminarRivalJugador",
      ID_JUGADOR:
        editForm.ID_JUGADOR,
    }),
  }
);

    const result =
      await response.json();

    if (!result.success) {
      throw new Error(
        result.error ||
          "No se pudo eliminar"
      );
    }

    setPlayers((current) =>
      current.filter(
        (player) =>
          player.ID_JUGADOR !==
          editForm.ID_JUGADOR
      )
    );

    closePlayer();

    alert(
      "Jugador eliminado correctamente"
    );

  } catch (error) {

    console.error(error);

    alert(
      "No se pudo eliminar el jugador"
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
    if (
      touchStartX === null
    ) {
      return;
    }

    const endX =
      event.changedTouches[0]
        .clientX;

    const difference =
      touchStartX - endX;

    if (
      Math.abs(difference) > 60
    ) {
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
    <main className="min-h-screen overflow-x-hidden bg-[#0B0F14] text-white">

      <div className="flex min-h-screen w-full">

        {/* SIDEBAR */}

        <Sidebar />

        {/* CONTENIDO PRINCIPAL */}

        <section className="min-w-0 flex-1">

          <Topbar />

          <div className="w-full min-w-0 px-4 py-6 sm:px-6 md:px-8 md:py-8">

            {/* HEADER */}

            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA · RIVALES
            </p>

            <div className="mt-4 flex min-w-0 items-center gap-4">

              <h1 className="min-w-0 truncate text-2xl font-semibold md:text-4xl">
                Plantillas rivales
              </h1>

              <div className="hidden h-px min-w-0 flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />

            </div>

            {/* SELECTOR DE EQUIPO */}

            {/* SELECTOR DE EQUIPO */}

<div className="mt-8 flex max-w-full items-center gap-2">

  <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-2">

    {teams.map((team) => (

      <button
        key={team}
        onClick={() => {
  setSelectedTeam(team);
  setPositionSearch("");
  setSearch("");
}}
        className={`
          shrink-0
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

  <button
    onClick={openCreatePlayer}
    className="
      flex
      shrink-0
      items-center
      gap-2
      rounded-xl
      border
      border-[#C8A96B]/40
      bg-[#C8A96B]/10
      px-4
      py-3
      text-sm
      text-[#C8A96B]
      transition
      hover:bg-[#C8A96B]/20
    "
  >

    <Plus size={16} />

    <span className="hidden sm:inline">
      Añadir jugador
    </span>

  </button>

</div>

            {/* FILTROS */}

            <div className="mt-6 grid min-w-0 gap-3 md:grid-cols-2">

              <div className="relative min-w-0">

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
                  placeholder="Buscar jugador o equipo..."
                  className="
                    w-full
                    min-w-0
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
<div className="relative min-w-0">

  <Search
    size={18}
    className="
      absolute
      left-4
      top-1/2
      -translate-y-1/2
      text-white/40
    "
  />

  <input
    value={positionSearch}
    onChange={(event) =>
      setPositionSearch(
        event.target.value
      )
    }
    placeholder="Buscar posición..."
    className="
      w-full
      min-w-0
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

            </div>

            {/* CONTADOR */}

            <div className="mt-6 flex min-w-0 items-center justify-between gap-4">

              <p className="shrink-0 text-sm text-white/50">

                {filteredPlayers.length} jugadores

              </p>

              <p className="min-w-0 truncate text-right text-xs text-white/30">

                {selectedTeam}

              </p>

            </div>

            {/* PLANTILLA POR LÍNEAS */}

            {loading ? (

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/50">

                Cargando plantilla...

              </div>

            ) : (

              <div className="mt-6 min-w-0 space-y-5">

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
                      "lateral d",
                      "central",
                      "lateral izquierdo",
                      "lateral izq",
                      "lateral i",
                      "carrilero",
                      "lateral",
                      "defensa",
                    ],
                  },

                  {
                    title: "CENTROCAMPISTAS",

                    positions: [
                      "mediocentro",
                      "pivote",
                      "interior",
                      "medio",
                    ],
                  },

                  {
                    title: "ATACANTES",

                    positions: [
                      "extremo derecho",
                      "extremo d",
                      "extremo izquierdo",
                      "extremo izq",
                      "extremo i",
                      "extremo",
                      "delantero",
                    ],
                  },
                ].map((line) => {

                  const linePlayers =
                    filteredPlayers
                      .filter((player) => {

                        const position =
                          normalize(
                            player[
                              "POSICIÓN"
                            ]
                          );

                        return line.positions.some(
                          (item) =>
                            position.includes(
                              normalize(
                                item
                              )
                            )
                        );

                      })
                      .sort((a, b) => {

                        const positionA =
                          normalize(
                            a[
                              "POSICIÓN"
                            ]
                          );

                        const positionB =
                          normalize(
                            b[
                              "POSICIÓN"
                            ]
                          );

                        const orderA =
                          line.positions.findIndex(
                            (position) =>
                              positionA.includes(
                                normalize(
                                  position
                                )
                              )
                          );

                        const orderB =
                          line.positions.findIndex(
                            (position) =>
                              positionB.includes(
                                normalize(
                                  position
                                )
                              )
                          );

                        if (
                          orderA !==
                          orderB
                        ) {
                          return (
                            orderA -
                            orderB
                          );
                        }

                        const dorsalA =
                          Number(
                            a.DORSAL
                          ) || 999;

                        const dorsalB =
                          Number(
                            b.DORSAL
                          ) || 999;

                        return (
                          dorsalA -
                          dorsalB
                        );

                      });

                  if (
                    linePlayers.length ===
                    0
                  ) {
                    return null;
                  }

                  return (

                    <section
                      key={line.title}
                      className="
                        min-w-0
                        overflow-hidden
                        rounded-2xl
                        border
                        border-white/10
                        bg-white/[0.025]
                      "
                    >

                      {/* CABECERA */}

                      <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/10 bg-white/[0.025] px-4 py-3">

                        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">

                          {line.title}

                        </h2>

                        <span className="shrink-0 text-xs text-white/30">

                          {linePlayers.length} jugadores

                        </span>

                      </div>

                      {/* JUGADORES */}

                      {/* CONTENIDO DE LA LÍNEA */}

<div className="grid min-w-0 gap-px bg-white/5 lg:grid-cols-2">

  {/* LISTADO DE JUGADORES */}

  <div className="grid min-w-0 gap-px bg-white/5">

    {linePlayers.map(
      (player) => (

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
            min-w-0
            items-center
            gap-3
            bg-[#11161D]
            p-3
            text-left
            transition
            hover:bg-white/[0.07]
          "
        >

          {/* FOTO */}

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
                className="h-full w-full object-cover transition group-hover:scale-110"
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

          {/* DORSAL */}

          <div className="w-8 shrink-0 text-center">

            <span className="text-lg font-bold text-white/30">

              {
                player.DORSAL
              }

            </span>

          </div>

          {/* NOMBRE Y POSICIÓN */}

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

          {/* ROL */}

          {player.ROL && (

            <div className="hidden min-w-0 shrink-0 text-right xl:block">

              <p className="text-[9px] uppercase tracking-wider text-white/30">

                Rol

              </p>

              <p className="mt-0.5 max-w-[80px] truncate text-xs text-[#C8A96B]">

                {
                  player.ROL
                }

              </p>

            </div>

          )}

        </button>

      )
    )}

  </div>

  {/* CAMPOGRAMA */}

  <div className="min-w-0 bg-[#0B0F14] p-3">

    <TacticalPitch
      players={linePlayers}
    />

  </div>

</div>

                    </section>

                  );

                })}

                {filteredPlayers.length ===
                  0 && (

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

      {editForm && (

          <div
            className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              overflow-y-auto
              bg-black/80
              p-2
              sm:p-4
              md:p-8
            "
            onClick={closePlayer}
          >

            <div
              className="
                relative
                flex
                max-h-[96vh]
                w-full
                max-w-6xl
                min-w-0
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

              <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 p-3 sm:p-4 md:p-6">

                <div className="flex min-w-0 items-center gap-2 sm:gap-3">

                  {!isCreating && (
  <button
    onClick={() =>
      navigatePlayer(-1)
    }
    disabled={
      selectedIndex <= 0
    }
    className="
      shrink-0
      rounded-full
      border
      border-white/10
      p-2
      transition
      hover:border-[#C8A96B]
      disabled:opacity-20
    "
  >
    <ChevronLeft size={20} />
  </button>
)}

                  <div className="min-w-0">

                    <p className="truncate text-xs uppercase tracking-[0.2em] text-[#C8A96B]">

  {isCreating
    ? "NUEVO JUGADOR"
    : editForm.NOMBRE_EQUIPO}

</p>

<h2 className="truncate text-lg font-semibold sm:text-xl md:text-2xl">

  {isCreating
    ? "Añadir jugador"
    : editForm[
        "NOMBRE DEPORTIVO"
      ] ||
      editForm.JUGADOR}

</h2>

                  </div>

                  {!isCreating && (
  <button
    onClick={() =>
      navigatePlayer(1)
    }
    disabled={
      selectedIndex >=
      filteredPlayers.length - 1
    }
    className="
      shrink-0
      rounded-full
      border
      border-white/10
      p-2
      transition
      hover:border-[#C8A96B]
      disabled:opacity-20
    "
  >
    <ChevronRight size={20} />
  </button>
)}

                </div>

                <button
                  onClick={closePlayer}
                  className="
                    shrink-0
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

              <div className="min-w-0 overflow-y-auto">

                <div className="grid min-w-0 gap-6 p-3 sm:p-4 md:grid-cols-[280px_minmax(0,1fr)] md:p-6 lg:grid-cols-[320px_minmax(0,1fr)]">

                  {/* COLUMNA IZQUIERDA */}

                  <div className="min-w-0">

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
{/* IDENTIDAD */}

<div className="mt-4 space-y-4">

  <EditableField
    label="Nombre completo"
    value={editForm.JUGADOR}
    onChange={(value) =>
      setEditForm({
        ...editForm,
        JUGADOR: value,
      })
    }
  />

  <EditableField
    label="Nombre deportivo"
    value={editForm["NOMBRE DEPORTIVO"]}
    onChange={(value) =>
      setEditForm({
        ...editForm,
        "NOMBRE DEPORTIVO": value,
      })
    }
  />

</div>
                    <div className="mt-4 grid grid-cols-2 gap-2">

  <EditableField
    label="Dorsal"
    value={editForm.DORSAL}
    onChange={(value) =>
      setEditForm({
        ...editForm,
        DORSAL: value,
      })
    }
  />

  <EditableField
    label="Edad"
    value={editForm.EDAD}
    onChange={(value) =>
      setEditForm({
        ...editForm,
        EDAD: value,
      })
    }
  />

  <EditableField
    label="Peso"
    value={editForm.PESO}
    onChange={(value) =>
      setEditForm({
        ...editForm,
        PESO: value,
      })
    }
  />

  <EditableField
    label="Altura"
    value={editForm.ALTURA}
    onChange={(value) =>
      setEditForm({
        ...editForm,
        ALTURA: value,
      })
    }
  />

  <EditableField
    label="Pie"
    value={
      editForm["PIE DOMINANTE"]
    }
    onChange={(value) =>
      setEditForm({
        ...editForm,
        "PIE DOMINANTE": value,
      })
    }
  />

  <EditableField
    label="Posición"
    value={
      editForm["POSICIÓN"]
    }
    onChange={(value) =>
      setEditForm({
        ...editForm,
        "POSICIÓN": value,
      })
    }
  />

</div>

                    <div className="mt-4 space-y-2 text-sm">

                      <EditableField
  label="Procedencia"
  value={editForm.PROCEDENCIA}
  onChange={(value) =>
    setEditForm({
      ...editForm,
      PROCEDENCIA: value,
    })
  }
/>

<EditableField
  label="Lugar nacimiento"
  value={
    editForm[
      "LUGAR DE NACIMIENTO"
    ]
  }
  onChange={(value) =>
    setEditForm({
      ...editForm,
      "LUGAR DE NACIMIENTO":
        value,
    })
  }
/>

<EditableField
  label="2ª posición"
  value={
    editForm["2º POSICIÓN"]
  }
  onChange={(value) =>
    setEditForm({
      ...editForm,
      "2º POSICIÓN": value,
    })
  }
/>

<EditableDateField
  label="Fecha incorporación"
  value={editForm["FECHA INCORPORACIÓN"]}
  onChange={(value) =>
    setEditForm({
      ...editForm,
      "FECHA INCORPORACIÓN": value,
    })
  }
/>

                    </div>

                  </div>

                  {/* COLUMNA DERECHA */}

                  <div className="min-w-0 space-y-5">

                    <div className="grid gap-4 md:grid-cols-3">

                        <EditableField
      label="Estado"
      value={editForm.ESTADO}
      onChange={(value) =>
        setEditForm({
          ...editForm,
          ESTADO: value,
        })
      }
    />

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

              <div className="flex items-center justify-between gap-3 border-t border-white/10 p-3 sm:p-4 md:p-6">

  {!isCreating ? (

    <button
      onClick={deletePlayer}
      disabled={saving}
      className="
        flex
        items-center
        gap-2
        rounded-xl
        border
        border-red-500/30
        bg-red-500/10
        px-4
        py-3
        text-sm
        text-red-300
        transition
        hover:bg-red-500/20
        disabled:opacity-50
      "
    >

      <Trash2 size={16} />

      Eliminar

    </button>

  ) : (

    <div />

  )}

  <div className="flex items-center gap-3">

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
        : isCreating
          ? "Añadir jugador"
          : "Guardar"}

    </button>

  </div>

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
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">

      <p className="truncate text-[10px] uppercase tracking-wider text-white/40">

        {label}

      </p>

      <p className="mt-1 truncate text-sm font-medium">

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
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-white/5 pb-2">

      <span className="shrink-0 text-white/40">

        {label}

      </span>

      <span className="min-w-0 truncate text-right">

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
    <label className="block min-w-0">

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
          min-w-0
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
    <label className="block min-w-0">

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
          min-w-0
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
function formatDateForInput(value: unknown) {
  if (!value) return "";

  const date = new Date(
    String(value)
  );

  if (isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().split("T")[0];
}
function EditableDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">

      <span className="mb-2 block text-xs uppercase tracking-wider text-white/40">
        {label}
      </span>

      <input
        type="date"
        value={formatDateForInput(value)}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="
          w-full
          min-w-0
          rounded-xl
          border
          border-white/10
          bg-[#0B0F14]
          px-4
          py-3
          text-sm
          text-white
          outline-none
          transition
          focus:border-[#C8A96B]
        "
      />

    </label>
  );
}
function TacticalPitch({
  players,
}: {
  players: RivalPlayer[];
}) {
  return (
    <div className="relative min-h-[420px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#173b2a]">

      {/* Líneas del campo */}

      <div className="pointer-events-none absolute inset-3 rounded-lg border border-white/20" />

      <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-px bg-white/15" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20" />

      {/* Áreas */}

      <div className="pointer-events-none absolute left-1/2 top-3 h-16 w-32 -translate-x-1/2 border border-t-0 border-white/15" />

      <div className="pointer-events-none absolute bottom-3 left-1/2 h-16 w-32 -translate-x-1/2 border border-b-0 border-white/15" />

      {/* Jugadores */}

      {players.map((player, index) => {

        const position = normalize(
          player["POSICIÓN"]
        );

        let top = 50;
        let left = 50;

        /*
        |--------------------------------------------------------------------------
        | PORTERO
        |--------------------------------------------------------------------------
        */

        if (position.includes("portero")) {
          top = 90;
          left = 50;
        }

        /*
        |--------------------------------------------------------------------------
        | DEFENSAS
        |--------------------------------------------------------------------------
        */

        else if (
          position.includes("central")
        ) {
          top = 72;

          const centrals =
            players.filter((p) =>
              normalize(
                p["POSICIÓN"]
              ).includes("central")
            );

          const centralIndex =
            centrals.findIndex(
              (p) =>
                p.ID_JUGADOR ===
                player.ID_JUGADOR
            );

          left =
            centrals.length === 1
              ? 50
              : 30 +
                (centralIndex *
                  40) /
                  Math.max(
                    centrals.length - 1,
                    1
                  );
        }

        else if (
          position.includes("lateral")
        ) {
          top = 72;

          left = position.includes(
            "derecho"
          )
            ? 85
            : 15;
        }

        else if (
          position.includes(
            "carrilero"
          )
        ) {
          top = 60;

          left = position.includes(
            "derecho"
          )
            ? 85
            : 15;
        }

        /*
        |--------------------------------------------------------------------------
        | CENTROCAMPISTAS
        |--------------------------------------------------------------------------
        */

        else if (
          position.includes(
            "pivote"
          ) ||
          position.includes(
            "mediocentro"
          )
        ) {
          top = 50;

          const midfielders =
            players.filter((p) => {
              const pos = normalize(
                p["POSICIÓN"]
              );

              return (
                pos.includes(
                  "pivote"
                ) ||
                pos.includes(
                  "mediocentro"
                )
              );
            });

          const midfielderIndex =
            midfielders.findIndex(
              (p) =>
                p.ID_JUGADOR ===
                player.ID_JUGADOR
            );

          left =
            midfielders.length === 1
              ? 50
              : 35 +
                (midfielderIndex *
                  30) /
                  Math.max(
                    midfielders.length - 1,
                    1
                  );
        }

        else if (
          position.includes(
            "interior"
          )
        ) {
          top = 43;

          left = position.includes(
            "derecho"
          )
            ? 70
            : 30;
        }

        /*
        |--------------------------------------------------------------------------
        | ATACANTES
        |--------------------------------------------------------------------------
        */

        else if (
          position.includes(
            "extremo"
          )
        ) {
          top = 25;

          left = position.includes(
            "derecho"
          )
            ? 82
            : 18;
        }

        else if (
          position.includes(
            "delantero"
          )
        ) {
          top = 15;
          left = 50;
        }

        return (
          <div
            key={player.ID_JUGADOR}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{
              top: `${top}%`,
              left: `${left}%`,
            }}
          >

            {/* FOTO */}

            <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/60 bg-[#11161D] shadow-lg">

              {player.FOTO ? (

                <img
                  src={player.FOTO}
                  alt={
                    player[
                      "NOMBRE DEPORTIVO"
                    ] ||
                    player.JUGADOR
                  }
                  className="h-full w-full object-cover"
                />

              ) : (

                <UserRound
                  size={22}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/30"
                />

              )}

              {/* DORSAL */}

              <span className="absolute bottom-0 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C8A96B] px-1 text-[9px] font-bold text-black">

                {player.DORSAL}

              </span>

            </div>

            {/* NOMBRE */}

            <span className="mt-1 max-w-[90px] truncate rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white">

              {player[
                "NOMBRE DEPORTIVO"
              ] ||
                player.JUGADOR}

            </span>

            {/* ROL */}

            {player.ROL && (

              <span className="max-w-[90px] truncate text-[9px] text-white/60">

                {player.ROL}

              </span>

            )}

          </div>
        );
      })}

    </div>
  );
}