"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CloudOff,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  PresentationIcon,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import TacticsBoard from "@/components/tactics/TacticsBoard";
import { usePlayers } from "@/hooks/usePlayers";
import { useRivalSquads } from "@/hooks/useRivalSquads";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { emptyDoc, normalizeDoc, tacticId } from "@/lib/tactics/helpers";
import type { RivalSquad } from "@/lib/tactics/rivals";
import type { TacticsDoc } from "@/lib/tactics/types";
import { cn } from "@/lib/utils";

interface BoardRef {
  id: string;
  nombre: string;
}

interface BoardIndex {
  boards: BoardRef[];
}

const EMPTY_INDEX: BoardIndex = { boards: [] };

export default function PizarraTacticaPage() {
  const { players } = usePlayers();
  const { squads } = useRivalSquads();

  const {
    value: index,
    setValue: setIndex,
    localOnly: indexLocalOnly,
  } = useRemoteDoc<BoardIndex>({
    key: "tactics:index",
    kind: "tactics-index",
    fallback: EMPTY_INDEX,
  });

  const boards = useMemo(() => index?.boards ?? [], [index]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  // La primera pizarra se selecciona sola en cuanto llega el índice.
  useEffect(() => {
    if (activeId && boards.some((board) => board.id === activeId)) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId(boards[0]?.id ?? null);
  }, [boards, activeId]);

  const active = boards.find((board) => board.id === activeId) ?? null;

  const createBoard = () => {
    const board: BoardRef = {
      id: tacticId("board"),
      nombre: `Pizarra ${boards.length + 1}`,
    };

    setIndex({ boards: [...boards, board] });
    setActiveId(board.id);
    toast.success("Pizarra creada");
  };

  const renameBoard = (id: string, nombre: string) =>
    setIndex({
      boards: boards.map((board) =>
        board.id === id ? { ...board, nombre } : board
      ),
    });

  const deleteBoard = (id: string) => {
    setIndex({ boards: boards.filter((board) => board.id !== id) });

    if (id === activeId) setActiveId(null);

    toast.success("Pizarra eliminada");
  };

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-10">
            <header>
              <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF Castilla · Táctica
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Pizarra Táctica
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/40 via-white/10 to-transparent" />
              </div>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/55">
                Coloca fichas propias y rivales, dibuja desplazamientos, pases y
                zonas, encadena escenas y reprodúcelas como una animación para
                explicar la idea al grupo.
              </p>
            </header>

            {indexLocalOnly && (
              <p className="flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200/90">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                <span>
                  Las pizarras se guardan solo en este dispositivo. Ejecuta{" "}
                  <code className="rounded bg-black/40 px-1">
                    supabase/app_documents.sql
                  </code>{" "}
                  en Supabase para sincronizarlas.
                </span>
              </p>
            )}

            <div className="grid items-start gap-5 xl:grid-cols-[260px_1fr]">
              {/* BIBLIOTECA */}

              <aside
                data-export-hide
                className="rounded-3xl border border-white/10 bg-[#11161D] p-3 xl:sticky xl:top-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
                    <FolderOpen size={13} className="text-[#C8A96B]" />
                    Pizarras
                  </p>

                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/55">
                    {boards.length}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {boards.length === 0 && (
                    <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[11px] text-white/35">
                      Todavía no hay ninguna pizarra
                    </p>
                  )}

                  {boards.map((board) => (
                    <div
                      key={board.id}
                      className={cn(
                        "flex items-center gap-1 rounded-xl border px-1 transition",
                        board.id === activeId
                          ? "border-[#C8A96B]/50 bg-[#C8A96B]/10"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                      )}
                    >
                      {renaming === board.id ? (
                        <input
                          autoFocus
                          defaultValue={board.nombre}
                          onBlur={(event) => {
                            renameBoard(board.id, event.target.value.trim() || board.nombre);
                            setRenaming(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") event.currentTarget.blur();
                            if (event.key === "Escape") setRenaming(null);
                          }}
                          className="min-w-0 flex-1 rounded-lg bg-black/40 px-2 py-2 text-xs text-white outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveId(board.id)}
                          className={cn(
                            "min-w-0 flex-1 truncate px-2 py-2 text-left text-xs font-semibold",
                            board.id === activeId
                              ? "text-[#C8A96B]"
                              : "text-white/65"
                          )}
                        >
                          {board.nombre}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setRenaming(board.id)}
                        title="Renombrar"
                        className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/10 hover:text-white"
                      >
                        <Pencil size={12} />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteBoard(board.id)}
                        title="Eliminar"
                        className="rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/15 hover:text-red-300"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={createBoard}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-2.5 text-xs font-semibold text-white/60 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B]"
                >
                  <Plus size={14} />
                  Nueva pizarra
                </button>
              </aside>

              {/* TABLERO */}

              <div className="min-w-0 rounded-[30px] border border-[#C8A96B]/20 bg-gradient-to-b from-[#151B23] to-[#0E131A] p-3 shadow-[0_35px_90px_rgba(0,0,0,.5)] sm:p-5">
                {active ? (
                  <BoardEditor
                    key={active.id}
                    boardId={active.id}
                    nombre={active.nombre}
                    roster={players}
                    rivalSquads={squads}
                  />
                ) : (
                  <div className="flex flex-col items-center px-6 py-24 text-center">
                    <PresentationIcon size={38} className="text-white/20" />

                    <h2 className="mt-5 text-lg font-semibold text-white/80">
                      Crea tu primera pizarra
                    </h2>

                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/45">
                      Cada pizarra guarda sus propias escenas, fichas y dibujos.
                    </p>

                    <button
                      type="button"
                      onClick={createBoard}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-5 py-2.5 text-sm font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                    >
                      <Plus size={16} />
                      Nueva pizarra
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function BoardEditor({
  boardId,
  nombre,
  roster,
  rivalSquads,
}: {
  boardId: string;
  nombre: string;
  roster: ReturnType<typeof usePlayers>["players"];
  rivalSquads: RivalSquad[];
}) {
  const fallback = useMemo(() => emptyDoc(nombre), [nombre]);

  const { value, setValue, status, localOnly } = useRemoteDoc<TacticsDoc>({
    key: `tactics:board:${boardId}`,
    kind: "tactics-board",
    fallback,
  });

  const doc = useMemo(() => normalizeDoc(value, nombre), [value, nombre]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{nombre}</h2>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium",
            localOnly
              ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
              : status === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : status === "saving" || status === "loading"
              ? "border-white/15 bg-white/5 text-white/60"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          )}
        >
          {localOnly ? (
            <>
              <CloudOff size={13} />
              Solo local
            </>
          ) : status === "error" ? (
            <>
              <TriangleAlert size={13} />
              Error
            </>
          ) : status === "saving" || status === "loading" ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              {status === "saving" ? "Guardando" : "Cargando"}
            </>
          ) : (
            <>
              <Check size={13} />
              Guardado
            </>
          )}
        </span>
      </div>

      <TacticsBoard
        doc={doc}
        onChange={setValue}
        roster={roster}
        rivalSquads={rivalSquads}
        hint="Elige el equipo rival y pulsa sus dorsales para pintarlos. Dibuja con las herramientas de la barra, duplica la escena, mueve las fichas y pulsa Animar para ver la transición."
      />
    </div>
  );
}
