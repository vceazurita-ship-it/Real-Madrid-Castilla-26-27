"use client";

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  ChevronDown,
  Eraser,
  Save,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { formatRating, ratingColor } from "@/lib/ratings/compute";
import { formatMatchDate, matchId, matchLabel } from "@/lib/ratings/matches";
import {
  AREA_KEYS,
  AREA_LABELS,
  AreaKey,
  MatchMeta,
  PlayerRating,
  RatingsSeason,
  clampRating,
  emptyRating,
  hasContent,
} from "@/lib/ratings/types";
import { Player } from "@/types/player";

import { RatingSlider } from "./RatingSlider";
import {
  EmptyState,
  Field,
  GhostButton,
  GoldButton,
  Panel,
  RatingBadge,
  inputClass,
} from "./ui";

type Draft = Record<string, PlayerRating>;

const LINES: { key: string; label: string; positions: string[] }[] = [
  { key: "por", label: "Porteros", positions: ["PORTERO"] },
  {
    key: "def",
    label: "Defensas",
    positions: ["LATERAL D.", "LATERAL I.", "CENTRAL"],
  },
  { key: "med", label: "Centrocampistas", positions: ["6", "8", "10"] },
  { key: "del", label: "Ataque", positions: ["7", "11", "9"] },
];

function lineOf(position: string) {
  return (
    LINES.find((line) => line.positions.includes(position))?.key ?? "med"
  );
}

function normalize(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function draftFromSeason(season: RatingsSeason, id: string): Draft {
  const stored = season.matches[id];

  if (!stored) return {};

  /* Copia profunda: el borrador se edita sin tocar el histórico cargado. */
  return Object.fromEntries(
    Object.entries(stored.players).map(([playerId, entry]) => [
      playerId,
      { ...entry, areas: { ...entry.areas } },
    ])
  );
}

export function RateMatchPanel({
  players,
  season,
  matches,
  saving,
  onSave,
  onDelete,
  onCreateMatch,
  initialMatchId,
}: {
  players: Player[];
  season: RatingsSeason;
  matches: MatchMeta[];
  saving: boolean;
  onSave: (match: MatchMeta, draft: Draft) => Promise<boolean>;
  onDelete: (matchId: string) => Promise<boolean>;
  onCreateMatch: (match: MatchMeta) => void;
  initialMatchId?: string | null;
}) {
  /* Partido más reciente por defecto: es el que casi siempre se va a valorar. */
  const ordered = useMemo(() => [...matches].reverse(), [matches]);

  const [pickedId, setPickedId] = useState(initialMatchId ?? "");

  const [search, setSearch] = useState("");
  const [line, setLine] = useState("todas");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [showNewMatch, setShowNewMatch] = useState(false);

  /* Sin elección explícita se valora el último partido del calendario. */
  const selectedId = pickedId || ordered[0]?.id || "";

  const selected = useMemo(
    () => matches.find((match) => match.id === selectedId) ?? null,
    [matches, selectedId]
  );

  /*
  | El borrador se sincroniza durante el render, no en un efecto: se rehace
  | al cambiar de partido y cuando llega un histórico nuevo del servidor,
  | pero nunca pisa lo que se está escribiendo.
  */
  const [state, setState] = useState<{
    matchId: string;
    season: RatingsSeason;
    draft: Draft;
    dirty: boolean;
  }>({ matchId: selectedId, season, draft: draftFromSeason(season, selectedId), dirty: false });

  if (
    state.matchId !== selectedId ||
    (state.season !== season && !state.dirty)
  ) {
    setState({
      matchId: selectedId,
      season,
      draft: draftFromSeason(season, selectedId),
      dirty: false,
    });
  }

  const draft = state.draft;
  const dirty = state.dirty;

  const patchDraft = (mutate: (draft: Draft) => Draft) => {
    setState((previous) => ({
      ...previous,
      draft: mutate(previous.draft),
      dirty: true,
    }));
  };

  const update = (playerId: string, patch: Partial<PlayerRating>) => {
    patchDraft((previous) => {
      const base = previous[playerId] ?? emptyRating(playerId);

      return { ...previous, [playerId]: { ...base, ...patch } };
    });
  };

  const updateArea = (playerId: string, key: AreaKey, value: number) => {
    patchDraft((previous) => {
      const base = previous[playerId] ?? emptyRating(playerId);

      return {
        ...previous,
        [playerId]: {
          ...base,
          areas: { ...base.areas, [key]: clampRating(value) },
        },
      };
    });
  };

  const clearPlayer = (playerId: string) => {
    patchDraft((previous) => {
      const next = { ...previous };

      delete next[playerId];

      return next;
    });
  };

  const visible = useMemo(() => {
    const query = normalize(search);

    return players.filter((player) => {
      if (line !== "todas" && lineOf(player.posicion) !== line) return false;

      if (!query) return true;

      return (
        normalize(player.nombre).includes(query) ||
        normalize(player.apodo ?? "").includes(query) ||
        normalize(player.posicion).includes(query)
      );
    });
  }, [players, search, line]);

  const grouped = useMemo(() => {
    return LINES.map((group) => ({
      ...group,
      players: visible.filter((player) => lineOf(player.posicion) === group.key),
    })).filter((group) => group.players.length > 0);
  }, [visible]);

  const filled = useMemo(
    () => Object.values(draft).filter((entry) => entry.rating > 0),
    [draft]
  );

  const average = filled.length
    ? filled.reduce((total, entry) => total + entry.rating, 0) / filled.length
    : 0;

  const handleSave = async () => {
    if (!selected) return;

    try {
      await onSave(selected, draft);

      /* El histórico nuevo llega por props y vuelve a sembrar el borrador. */
      setState((previous) => ({ ...previous, dirty: false }));

      toast.success(
        `Valoraciones guardadas · ${matchLabel(selected)} (${filled.length} jugadores)`
      );
    } catch (error) {
      console.error(error);

      toast.error("No se han podido guardar las valoraciones");
    }
  };

  const handleDelete = async () => {
    if (!selected) return;

    try {
      await onDelete(selected.id);

      setState((previous) => ({ ...previous, draft: {}, dirty: false }));

      toast.success("Valoraciones del partido borradas");
    } catch (error) {
      console.error(error);

      toast.error("No se han podido borrar las valoraciones");
    }
  };

  return (
    <div className="min-w-0 space-y-4 pb-24">
      {/* SELECTOR DE PARTIDO */}

      <Panel
        title="Partido"
        subtitle="Elige la jornada que vas a valorar"
        icon={CalendarPlus}
        action={
          <GhostButton
            icon={CalendarPlus}
            onClick={() => setShowNewMatch((value) => !value)}
            active={showNewMatch}
          >
            Añadir partido
          </GhostButton>
        }
      >
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={selectedId}
            onChange={(event) => setPickedId(event.target.value)}
            className={inputClass}
          >
            {ordered.length === 0 && <option value="">Sin partidos</option>}

            {ordered.map((match) => {
              const stored = season.matches[match.id];

              const rated = stored
                ? Object.values(stored.players).filter((e) => e.rating > 0).length
                : 0;

              return (
                <option key={match.id} value={match.id}>
                  {formatMatchDate(match)} · {matchLabel(match)}
                  {match.result ? ` (${match.result})` : ""}
                  {rated ? ` · ${rated} valorados` : ""}
                </option>
              );
            })}
          </select>

          {selected && (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                Media
              </span>

              <RatingBadge value={average} />

              <span className="text-[11px] text-white/35">
                {filled.length} jug.
              </span>
            </div>
          )}
        </div>

        {showNewMatch && (
          <NewMatchForm
            onCreate={(match) => {
              onCreateMatch(match);

              setShowNewMatch(false);
              setPickedId(match.id);

              /* Se persiste al guardar: hasta entonces vive sólo en memoria. */
              toast.info("Partido creado. Se guardará con las valoraciones.");
            }}
          />
        )}
      </Panel>

      {!selected ? (
        <EmptyState
          icon={Users}
          title="No hay partidos en el calendario"
          description="Añade un partido a mano para empezar a valorar."
        />
      ) : (
        <>
          {/* FILTROS */}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar jugador…"
                className={`${inputClass} pl-9`}
              />
            </div>

            <GhostButton
              onClick={() => setLine("todas")}
              active={line === "todas"}
            >
              Todas
            </GhostButton>

            {LINES.map((group) => (
              <GhostButton
                key={group.key}
                onClick={() => setLine(group.key)}
                active={line === group.key}
              >
                {group.label}
              </GhostButton>
            ))}
          </div>

          {/* JUGADORES */}

          {grouped.map((group) => (
            <Panel
              key={group.key}
              title={group.label}
              subtitle={`${group.players.length} jugadores`}
              bodyClassName="divide-y divide-white/5"
            >
              {group.players.map((player) => {
                const entry = draft[player.id] ?? emptyRating(player.id);
                const open = expanded === player.id;

                return (
                  <div key={player.id} className="min-w-0 px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      {/* IDENTIDAD */}

                      <div className="flex min-w-[150px] flex-1 items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={player.foto}
                          alt={player.nombre}
                          className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover object-top"
                          style={{
                            borderColor:
                              entry.rating > 0
                                ? `${ratingColor(entry.rating)}88`
                                : undefined,
                          }}
                        />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {player.apodo || player.nombre}
                          </p>

                          <p className="truncate text-[10px] uppercase tracking-[0.16em] text-white/30">
                            {player.posicion}
                          </p>
                        </div>
                      </div>

                      {/* NOTA */}

                      <div className="w-full min-w-0 sm:w-[240px]">
                        <RatingSlider
                          value={entry.rating}
                          onChange={(value) =>
                            update(player.id, { rating: value })
                          }
                        />
                      </div>

                      {/* MINUTOS */}

                      <div className="flex shrink-0 items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={130}
                          value={entry.minutes || ""}
                          onChange={(event) =>
                            update(player.id, {
                              minutes: Math.max(
                                0,
                                Math.min(130, Number(event.target.value) || 0)
                              ),
                            })
                          }
                          placeholder="0"
                          aria-label="Minutos"
                          className="w-16 rounded-lg border border-white/10 bg-[#0B0F14] px-2 py-1.5 text-center text-sm tabular-nums text-white outline-none focus:border-[#C8A96B]/60"
                        />

                        <span className="text-[10px] text-white/30">min</span>
                      </div>

                      {/* TITULAR */}

                      <button
                        type="button"
                        onClick={() =>
                          update(player.id, { starter: !entry.starter })
                        }
                        className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                          entry.starter
                            ? "border-[#C8A96B]/50 bg-[#C8A96B]/15 text-[#C8A96B]"
                            : "border-white/10 text-white/30 hover:text-white/60"
                        }`}
                      >
                        Titular
                      </button>

                      {/* DETALLE */}

                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : player.id)}
                        aria-label="Más detalle"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:text-white ${
                          open ? "rotate-180 text-[#C8A96B]" : ""
                        }`}
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>

                    {open && (
                      <div className="mt-4 grid min-w-0 gap-4 rounded-xl border border-white/10 bg-[#0B0F14] p-4 lg:grid-cols-2">
                        {/* ÁREAS */}

                        <div className="min-w-0 space-y-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96B]">
                            Notas por área
                          </p>

                          {AREA_KEYS.map((key) => (
                            <RatingSlider
                              key={key}
                              compact
                              label={AREA_LABELS[key]}
                              value={entry.areas?.[key] ?? 0}
                              onChange={(value) =>
                                updateArea(player.id, key, value)
                              }
                            />
                          ))}
                        </div>

                        {/* NÚMEROS Y COMENTARIO */}

                        <div className="min-w-0 space-y-3">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <Field label="Goles">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                value={entry.goals || ""}
                                onChange={(event) =>
                                  update(player.id, {
                                    goals: Math.max(
                                      0,
                                      Number(event.target.value) || 0
                                    ),
                                  })
                                }
                                placeholder="0"
                                className={inputClass}
                              />
                            </Field>

                            <Field label="Asist.">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                value={entry.assists || ""}
                                onChange={(event) =>
                                  update(player.id, {
                                    assists: Math.max(
                                      0,
                                      Number(event.target.value) || 0
                                    ),
                                  })
                                }
                                placeholder="0"
                                className={inputClass}
                              />
                            </Field>

                            <Field label="Amarillas">
                              <select
                                value={entry.yellow}
                                onChange={(event) =>
                                  update(player.id, {
                                    yellow: Number(event.target.value),
                                  })
                                }
                                className={inputClass}
                              >
                                <option value={0}>0</option>
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                              </select>
                            </Field>

                            <Field label="Roja">
                              <button
                                type="button"
                                onClick={() =>
                                  update(player.id, { red: !entry.red })
                                }
                                className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                  entry.red
                                    ? "border-rose-400/40 bg-rose-400/15 text-rose-300"
                                    : "border-white/10 text-white/35 hover:text-white/70"
                                }`}
                              >
                                {entry.red ? "Sí" : "No"}
                              </button>
                            </Field>
                          </div>

                          <Field label="Comentario del partido">
                            <textarea
                              value={entry.note}
                              onChange={(event) =>
                                update(player.id, { note: event.target.value })
                              }
                              rows={4}
                              placeholder="Qué hizo bien, qué corregir…"
                              className={`${inputClass} resize-y`}
                            />
                          </Field>

                          {hasContent(entry) && (
                            <GhostButton
                              icon={Eraser}
                              onClick={() => clearPlayer(player.id)}
                            >
                              Vaciar este jugador
                            </GhostButton>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Panel>
          ))}

          {grouped.length === 0 && (
            <EmptyState
              icon={Search}
              title="Ningún jugador coincide con el filtro"
            />
          )}

          {/* BARRA DE GUARDADO */}

          <div
            data-export-hide
            className="fixed bottom-4 left-4 right-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#11161D]/95 px-4 py-3 shadow-2xl backdrop-blur md:left-auto md:right-8 md:w-auto"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-[11px] text-white/40">
                {matchLabel(selected)} · {formatMatchDate(selected)}
              </span>

              <span className="hidden text-[11px] text-white/30 sm:inline">
                Media {formatRating(average)} · {filled.length} valorados
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {season.matches[selected.id] && (
                <GhostButton icon={Trash2} onClick={handleDelete} disabled={saving}>
                  Borrar
                </GhostButton>
              )}

              <GoldButton icon={Save} onClick={handleSave} disabled={saving || !dirty}>
                {saving ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
              </GoldButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NewMatchForm({ onCreate }: { onCreate: (match: MatchMeta) => void }) {
  const [date, setDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [competition, setCompetition] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [result, setResult] = useState("");

  const submit = () => {
    if (!opponent.trim()) {
      toast.error("Escribe el rival");
      return;
    }

    const score = result.match(/(\d+)\s*[-–:]\s*(\d+)/);

    const gf = score ? Number(isHome ? score[1] : score[2]) : null;
    const ga = score ? Number(isHome ? score[2] : score[1]) : null;

    onCreate({
      id: matchId(date, opponent.trim(), "manual"),
      date,
      opponent: opponent.trim(),
      competition: competition.trim() || "Amistoso",
      isHome,
      result: result.trim(),
      gf,
      ga,
      source: "manual",
    });

    setDate("");
    setOpponent("");
    setCompetition("");
    setResult("");
  };

  return (
    <div className="mt-4 grid min-w-0 gap-3 rounded-xl border border-white/10 bg-[#0B0F14] p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Fecha">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Rival">
        <input
          value={opponent}
          onChange={(event) => setOpponent(event.target.value)}
          placeholder="Nombre del rival"
          className={inputClass}
        />
      </Field>

      <Field label="Competición">
        <input
          value={competition}
          onChange={(event) => setCompetition(event.target.value)}
          placeholder="Amistoso, Copa…"
          className={inputClass}
        />
      </Field>

      <Field label="Resultado" hint="Castilla primero si jugáis en casa">
        <input
          value={result}
          onChange={(event) => setResult(event.target.value)}
          placeholder="2-1"
          className={inputClass}
        />
      </Field>

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setIsHome((value) => !value)}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/60 transition hover:text-white"
        >
          {isHome ? "Local" : "Visitante"}
        </button>

        <GoldButton onClick={submit}>Crear</GoldButton>
      </div>
    </div>
  );
}
