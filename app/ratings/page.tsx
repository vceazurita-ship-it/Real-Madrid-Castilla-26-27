"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ClipboardCheck,
  GitCompareArrows,
  History,
  LayoutGrid,
  Loader2,
  RotateCcw,
  Star,
  Users,
  X,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";

import { ComparePanel } from "@/components/ratings/ComparePanel";
import { HistoryPanel } from "@/components/ratings/HistoryPanel";
import { PitchPanel } from "@/components/ratings/PitchPanel";
import { PlayerRatingsTab } from "@/components/ratings/PlayerRatingsTab";
import { RateMatchPanel } from "@/components/ratings/RateMatchPanel";
import { TeamPanel, type RankedPlayer } from "@/components/ratings/TeamPanel";
import { GhostButton } from "@/components/ratings/ui";

import { usePlayers } from "@/hooks/usePlayers";
import { useRatings } from "@/hooks/useRatings";
import { summarize, summarizeAll, summarizeMatches } from "@/lib/ratings/compute";
import { compareMatches } from "@/lib/ratings/matches";
import { MatchMeta, RATINGS_SEASON } from "@/lib/ratings/types";

type TabKey = "registrar" | "equipo" | "campo" | "comparar" | "historico";

const TABS: { key: TabKey; label: string; icon: typeof Star }[] = [
  { key: "registrar", label: "Registrar", icon: ClipboardCheck },
  { key: "equipo", label: "Equipo", icon: Users },
  { key: "campo", label: "Campograma", icon: LayoutGrid },
  { key: "comparar", label: "Comparar", icon: GitCompareArrows },
  { key: "historico", label: "Histórico", icon: History },
];

const TAB_KEYS = TABS.map((item) => item.key);

const DEFAULT_TAB: TabKey = "equipo";

/* La pestaña vive en el hash: refrescar o compartir el enlace te devuelve a ella. */

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);

  return () => window.removeEventListener("hashchange", onChange);
}

function tabOf(hash: string): TabKey {
  const key = hash.replace("#", "") as TabKey;

  return TAB_KEYS.includes(key) ? key : DEFAULT_TAB;
}

export default function RatingsPage() {
  const { players, loading: loadingPlayers } = usePlayers();

  const {
    season,
    matches,
    status,
    error,
    saving,
    reload,
    saveMatch,
    deleteMatch,
  } = useRatings();

  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => ""
  );

  const tab = tabOf(hash);

  const goToTab = useCallback((key: TabKey) => {
    window.location.hash = key;
  }, []);

  const [openPlayer, setOpenPlayer] = useState<string | null>(null);
  const [pendingMatch, setPendingMatch] = useState<MatchMeta | null>(null);
  const [editMatchId, setEditMatchId] = useState<string | null>(null);

  useBodyScrollLock(Boolean(openPlayer));

  /* Un partido creado a mano vive aquí hasta que se guarda con sus notas. */
  const allMatches = useMemo(() => {
    if (!pendingMatch || matches.some((m) => m.id === pendingMatch.id)) {
      return matches;
    }

    return [...matches, pendingMatch].sort(compareMatches);
  }, [matches, pendingMatch]);

  const summaries = useMemo(() => summarizeAll(season), [season]);

  const matchSummaries = useMemo(() => summarizeMatches(season), [season]);

  const ranked = useMemo<RankedPlayer[]>(
    () =>
      players.map((player) => ({
        player,
        summary: summaries.get(player.id) ?? summarize(player.id, []),
      })),
    [players, summaries]
  );

  const selectPlayer = useCallback((playerId: string) => {
    setOpenPlayer(playerId);
  }, []);

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === openPlayer) ?? null,
    [players, openPlayer]
  );

  useEffect(() => {
    if (!openPlayer) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPlayer(null);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [openPlayer]);

  const totals = useMemo(() => {
    const rated = matchSummaries.filter((item) => item.rated > 0);

    const notes = rated.reduce((total, item) => total + item.avg, 0);

    return {
      matches: rated.length,
      players: ranked.filter((entry) => entry.summary.played > 0).length,
      average: rated.length ? notes / rated.length : 0,
    };
  }, [matchSummaries, ranked]);

  const loading = status === "loading" || loadingPlayers;

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="mx-auto min-w-0 max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          {/* CABECERA */}

          <header className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#C8A96B]">
                Rendimiento · {RATINGS_SEASON.replace("-", " / ")}
              </p>

              <div className="hidden h-px min-w-0 flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />

              <GhostButton icon={RotateCcw} onClick={reload} disabled={loading}>
                Actualizar
              </GhostButton>
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Valoraciones de partido
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-white/40">
              La nota de cada jugador en cada partido, guardada para siempre.
              Alimenta la ficha individual, el ranking de la plantilla y el
              campograma de rendimiento.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
              <span className="rounded-full border border-white/10 px-2.5 py-1 tabular-nums">
                {totals.matches} partidos valorados
              </span>

              <span className="rounded-full border border-white/10 px-2.5 py-1 tabular-nums">
                {totals.players} jugadores con nota
              </span>

              <span className="rounded-full border border-white/10 px-2.5 py-1 tabular-nums">
                Media {totals.average ? totals.average.toFixed(1).replace(".", ",") : "—"}
              </span>
            </div>
          </header>

          {error && (
            <div className="mt-5 flex min-w-0 items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
              <AlertTriangle size={15} className="shrink-0" />
              <span className="min-w-0 flex-1">{error}</span>
            </div>
          )}

          {/* PESTAÑAS */}

          <nav className="mt-6 border-b border-white/10">
            <div className="flex min-w-0 gap-1 overflow-x-auto">
              {TABS.map((item) => {
                const active = tab === item.key;
                const Icon = item.icon;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => goToTab(item.key)}
                    className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                      active
                        ? "text-[#C8A96B]"
                        : "text-white/35 hover:text-white/70"
                    }`}
                  >
                    <Icon size={14} />
                    {item.label}

                    {active && (
                      <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#C8A96B]" />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* CONTENIDO */}

          <div className="mt-5 min-w-0">
            {loading ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#11161D] py-20 text-sm text-white/40">
                <Loader2 size={18} className="animate-spin text-[#C8A96B]" />
                Cargando valoraciones…
              </div>
            ) : (
              <>
                {tab === "registrar" && (
                  <RateMatchPanel
                    key={editMatchId ?? "registrar"}
                    players={players}
                    season={season}
                    matches={allMatches}
                    saving={saving}
                    onSave={saveMatch}
                    onDelete={deleteMatch}
                    onCreateMatch={setPendingMatch}
                    initialMatchId={editMatchId}
                  />
                )}

                {tab === "equipo" && (
                  <TeamPanel
                    ranked={ranked}
                    matchSummaries={matchSummaries}
                    onSelectPlayer={selectPlayer}
                  />
                )}

                {tab === "campo" && (
                  <PitchPanel ranked={ranked} onSelectPlayer={selectPlayer} />
                )}

                {tab === "comparar" && (
                  <ComparePanel season={season} ranked={ranked} />
                )}

                {tab === "historico" && (
                  <HistoryPanel
                    season={season}
                    matchSummaries={matchSummaries}
                    players={players}
                    onSelectPlayer={selectPlayer}
                    onEditMatch={(matchId) => {
                      setEditMatchId(matchId);
                      goToTab("registrar");
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* FICHA DEL JUGADOR */}

      {selectedPlayer &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
            onClick={() => setOpenPlayer(null)}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="flex h-[92dvh] w-full min-w-0 max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F14] shadow-2xl"
            >
              <header className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPlayer.foto}
                    alt={selectedPlayer.nombre}
                    className="h-11 w-11 shrink-0 rounded-xl border border-white/10 object-cover object-top"
                  />

                  <div className="min-w-0">
                    <p className="truncate text-[10px] uppercase tracking-[0.25em] text-[#C8A96B]">
                      {selectedPlayer.posicion}
                    </p>

                    <h2 className="truncate text-lg font-semibold sm:text-xl">
                      {selectedPlayer.nombre}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenPlayer(null)}
                  aria-label="Cerrar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={16} />
                </button>
              </header>

              <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <PlayerRatingsTab season={season} playerId={selectedPlayer.id} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
