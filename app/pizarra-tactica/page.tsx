"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Copy,
  FolderOpen,
  Loader2,
  Users,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  PresentationIcon,
  Trash2,
  TriangleAlert,
  Undo2,
  Check,
  FlaskConical,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import EstadoGuardado from "@/components/tactics/EstadoGuardado";
import TacticsBoard from "@/components/tactics/TacticsBoard";
import { usePantallaCompleta } from "@/hooks/usePantallaCompleta";
import { usePlayers } from "@/hooks/usePlayers";
import { useRivalSquads } from "@/hooks/useRivalSquads";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  dosOnces,
  numerosDelOnce,
  DIBUJO_DE_PARTIDA,
} from "@/lib/tactics/dosOnces";
import { emptyDoc, normalizeDoc, tacticId } from "@/lib/tactics/helpers";
import { escenasSinNumeroRepetido, onceIncompleto, oncesDeLaSemana, semanaActual } from "@/lib/tactics/oncesSemana";
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

/**
 * Cómo se llama el tablero al que lleva el enlace de la portada.
 *
 * Tiene el suyo propio a propósito. Poblar el tablero que estuviera abierto
 * —«Teruel CF», con el trabajo de la semana— sería meter veintidós fichas
 * encima de lo de alguien; y no poblar nada deja el enlace sin hacer lo que
 * promete. Con un tablero aparte las dos cosas se cumplen: la portada siempre
 * lleva a un campo con los dos onces puestos, y lo demás no se toca.
 */
const TABLERO_DE_ONCES = "Once 4-2-3-1";

/* El parámetro sólo existe en el navegador: en el servidor, no hay. */
function hayParametroOnce() {
  return new URLSearchParams(window.location.search).has("once");
}

function enBlanco() {
  return false;
}

function seSabraAlLlegar(avisa: () => void) {
  const aviso = setTimeout(avisa, 0);

  return () => clearTimeout(aviso);
}

export default function PizarraTacticaPage() {
  /*
  | Cuando la pantalla completa es la de toda la página —así se llega desde el
  | enlace de la portada, porque el navegador no deja cambiar de elemento sin
  | un gesto nuevo— el menú y la barra de arriba siguen ahí ocupando sitio, que
  | es justo lo que se venía a quitar. Mientras dure, se retiran ellos y el
  | encabezado, y el tablero se queda con la pantalla.
  |
  | Si la pantalla completa es la del propio tablero, todo esto queda fuera del
  | elemento y no se ve de todas formas: esconderlo no cambia nada y no hay que
  | distinguir los dos casos.
  */
  const { enPantallaCompleta: sinCromo } = usePantallaCompleta();

  /* El próximo partido, para el nombre con el que nace una pizarra nueva. */
  const [partido, setPartido] = useState<{ rival: string; fecha: string } | undefined>(undefined);

  useEffect(() => {
    let vivo = true;

    void semanaActual()
      .then((s) => {
        if (vivo && s) setPartido({ rival: s.rival, fecha: s.fecha });
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, []);

  /*
  | ¿Se llega desde la portada pidiendo los dos onces?
  |
  | Se lee de la barra de direcciones y no con `useSearchParams`: ése obliga a
  | envolver la página en un `Suspense` para poder prerenderizarla —el build
  | falla sin él— y aquí no hace falta tanto, porque esto no pinta nada: sólo
  | decide si un tablero vacío se puebla. Con la instantánea de servidor en
  | `false` no hay desajuste al hidratar, y el aviso de una vez hace que se
  | vuelva a mirar ya en el navegador.
  */
  const conOnces = useSyncExternalStore(seSabraAlLlegar, hayParametroOnce, enBlanco);

  /*
  |--------------------------------------------------------------------------
  | Y SI EL NAVEGADOR NO DA LA PANTALLA COMPLETA, SE LA DAMOS NOSOTROS
  |--------------------------------------------------------------------------
  |
  | El enlace de la portada la pide en el propio clic, que es la única forma de
  | que un navegador la conceda. En el ordenador y en Android la da; **el
  | Safari del iPhone no la da nunca** —sólo se la concede a los vídeos— y en
  | algunas tablets tampoco, así que se llegaba aquí con el menú, la barra de
  | arriba y el marco del navegador puestos y el campo del tamaño de una
  | postal: justo lo que el botón promete evitar.
  |
  | Si medio segundo después de llegar seguimos en ventana, el campo se abre
  | ocupando la pantalla entera por CSS (`PitchStage`, `fixed inset-0`), que no
  | necesita permiso de nadie. Se decide **una sola vez**: salir de la pantalla
  | completa de verdad más tarde no puede volver a abrir el campo encima.
  */
  const [pantallaNuestra, setPantallaNuestra] = useState(false);

  const decidido = useRef(false);

  useEffect(() => {
    if (!conOnces || decidido.current) return;

    if (sinCromo) {
      decidido.current = true;

      return;
    }

    const reloj = setTimeout(() => {
      decidido.current = true;

      setPantallaNuestra(true);
    }, 600);

    return () => clearTimeout(reloj);
  }, [conOnces, sinCromo]);

  const { players } = usePlayers();
  const { squads } = useRivalSquads();

  const {
    value: index,
    setValue: setIndex,
    status: estadoIndice,
    localOnly: indexLocalOnly,
  } = useRemoteDoc<BoardIndex>({
    key: "tactics:index",
    kind: "tactics-index",
    fallback: EMPTY_INDEX,
  });

  /*
  |--------------------------------------------------------------------------
  | NO SE TOCA LA LISTA HASTA QUE HA LLEGADO
  |--------------------------------------------------------------------------
  |
  | Mientras carga, `index` es el respaldo vacío. Crear una pizarra en ese
  | momento guardaba una lista con **sólo la nueva** y se llevaba por delante
  | las que había: pasó de verdad el 06/09/2026 y hubo que reconstruir la
  | lista a mano contra Supabase —los tableros no se pierden, porque cada uno
  | es su propio documento, pero desaparecen de la pantalla y nadie sabe por
  | qué—.
  |
  | Basta con no dejar escribir antes de tiempo. Es cuestión de un segundo, y
  | de un segundo depende no perder el trabajo de una temporada.
  |
  | Y tampoco se escribe cuando **no se ha podido preguntar al servidor y la
  | lista está vacía**: ahí el vacío no significa «no hay pizarras», significa
  | «no se sabe», y crear una encima borraría las que haya. Con la lista ya
  | cargada —aunque después se caiga la red— se sigue trabajando con
  | normalidad, que para eso está el modo local.
  */
  const listaCargada =
    estadoIndice !== "loading" && !(indexLocalOnly && (index?.boards ?? []).length === 0);

  const boards = useMemo(() => index?.boards ?? [], [index]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  /*
  | Con qué nace cada pizarra nueva (21/10/2026): en blanco, con los dos onces
  | ya puestos o como copia de otra. Cada tablero es su propio documento, así
  | que la copia no puede escribirse desde aquí: se le pasa al editor de la
  | pizarra nueva y él la guarda en cuanto sabe que su documento está vacío.
  */
  const [semillas, setSemillas] = useState<Record<string, TacticsDoc>>({});

  /** El documento de la pizarra abierta, para poder duplicarla. */
  const docAbierto = useRef<TacticsDoc | null>(null);

  // La primera pizarra se selecciona sola en cuanto llega el índice.
  useEffect(() => {
    if (activeId && boards.some((board) => board.id === activeId)) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId(boards[0]?.id ?? null);
  }, [boards, activeId]);

  const active = boards.find((board) => board.id === activeId) ?? null;

  /*
  | Llegando desde la portada se abre el tablero de los dos onces.
  |
  | Si no existe se crea —una sola vez, de ahí el cerrojo— y si ya está, se
  | selecciona y se deja como se dejó: quien pintó ahí el jueves se lo
  | encuentra el viernes. Los tableros con nombre propio no se rozan.
  */
  const onceAtendido = useRef(false);

  useEffect(() => {
    if (onceAtendido.current || !listaCargada) return;

    const suyo = boards.find((board) => board.nombre === TABLERO_DE_ONCES);

    /*
    | Desde el 13/10/2026 el tablero de los onces existe siempre (se rellena
    | solo cada semana): si no está, se crea aunque no se llegue desde la
    | portada. Lo que se selecciona sólo cambia si se llega desde la portada.
    */
    if (!conOnces) {
      if (suyo) return;

      onceAtendido.current = true;
      setIndex((actual) =>
        (actual?.boards ?? []).some((b) => b.nombre === TABLERO_DE_ONCES)
          ? actual
          : { boards: [{ id: tacticId("board"), nombre: TABLERO_DE_ONCES }, ...(actual?.boards ?? [])] },
      );

      return;
    }

    onceAtendido.current = true;

    /* Igual que la selección de la primera pizarra de más arriba: esto no es
       una cascada de renders, es una intención de navegación que se atiende
       una sola vez y se cierra con el cerrojo. */
    if (suyo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(suyo.id);

      return;
    }

    const board: BoardRef = { id: tacticId("board"), nombre: TABLERO_DE_ONCES };

    setIndex((actual) => ({ boards: [...(actual?.boards ?? []), board] }));

     
    setActiveId(board.id);
  }, [boards, conOnces, listaCargada, setIndex]);

  const createBoard = (como: "blanco" | "onces" | "copia" = "blanco") => {
    if (!listaCargada) return;

    const original = como === "copia" ? active : null;

    if (como === "copia" && (!original || !docAbierto.current)) return;

    /*
    | Nace con el nombre con el que saldrá su fichero (tercera vuelta,
    | 21/10/2026): «Pizarra 2» encabezaba la lista y la cabecera, y luego la
    | lámina salía con otro. El rival y el día del próximo partido, y si se
    | repite, con número.
    */
    const propuesto = original
      ? `${original.nombre} (copia)`
      : partido
        ? [partido.rival, como === "onces" ? "Los dos onces" : diaCorto(partido.fecha)].filter(Boolean).join(" · ")
        : `Pizarra ${boards.length + 1}`;

    const ocupados = new Set(boards.map((b) => b.nombre.trim().toLowerCase()));
    let nombre = propuesto;

    for (let n = 2; ocupados.has(nombre.trim().toLowerCase()); n += 1) nombre = `${propuesto} ${n}`;

    const board: BoardRef = { id: tacticId("board"), nombre };

    if (como === "onces") {
      const base = emptyDoc(board.nombre);

      const semilla: TacticsDoc = {
        ...base,
        scenes: [{ ...base.scenes[0], nombre: "Los dos onces", tokens: dosOnces(DIBUJO_DE_PARTIDA) }],
      };

      setSemillas((antes) => ({ ...antes, [board.id]: semilla }));
    }

    if (como === "copia" && docAbierto.current) {
      const copia = normalizeDoc(docAbierto.current, board.nombre);

      /* Las escenas con identificador nuevo; las fichas conservan el suyo, que es lo que anima. */
      const semilla: TacticsDoc = {
        ...copia,
        titulo: board.nombre,
        semanaOnces: undefined,
        scenes: copia.scenes.map((escena) => ({ ...escena, id: tacticId("scene") })),
      };

      setSemillas((antes) => ({ ...antes, [board.id]: semilla }));
    }

    /* Sobre lo que haya en ese momento, no sobre lo que se leyó al pintar. */
    setIndex((actual) => ({
      boards: [...(actual?.boards ?? []), board],
    }));

    setActiveId(board.id);
    toast.success(como === "copia" ? `Copia de «${original?.nombre}» creada` : "Pizarra creada");
  };

  const renameBoard = (id: string, nombre: string) => {
    if (!listaCargada) return;

    setIndex((actual) => ({
      boards: (actual?.boards ?? []).map((board) =>
        board.id === id ? { ...board, nombre } : board
      ),
    }));
  };

  /*
  | Eliminar se puede deshacer (19/10/2026). Era un clic en la papelera, sin
  | pregunta y sin vuelta atrás, justo al lado del lápiz de renombrar: la
  | pizarra desaparecía de la lista y, aunque su documento sigue guardado, no
  | había forma de volver a llegar a ella desde la pantalla. Ahora el aviso
  | trae «Deshacer», que la devuelve a su sitio de la lista.
  */
  const recuerdaDoc = useCallback((actual: TacticsDoc) => {
    docAbierto.current = actual;
  }, []);

  const deleteBoard = (id: string) => {
    if (!listaCargada) return;

    const posicion = boards.findIndex((board) => board.id === id);
    const quitada = boards[posicion];

    if (!quitada) return;

    setIndex((actual) => ({
      boards: (actual?.boards ?? []).filter((board) => board.id !== id),
    }));

    if (id === activeId) setActiveId(null);

    toast.success(`Pizarra «${quitada.nombre}» eliminada`, {
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: () => {
          setIndex((actual) => {
            const lista = actual?.boards ?? [];

            if (lista.some((board) => board.id === quitada.id)) return actual;

            const copia = [...lista];
            copia.splice(Math.min(posicion, copia.length), 0, quitada);

            return { boards: copia };
          });

          setActiveId(quitada.id);
        },
      },
    });
  };

  return (
    <main data-pizarra-tactica className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        {!sinCromo && <Sidebar />}

        <section className="flex min-w-0 flex-1 flex-col">
          {!sinCromo && <Topbar />}

          <div
            className={cn(
              "space-y-4",
              sinCromo ? "p-2" : "px-3 py-4 sm:px-6 sm:py-5 lg:px-10",
            )}
          >
            {!sinCromo && (
            <header>
              <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF Castilla · Metodología
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-4">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Pizarra Táctica
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/40 via-white/10 to-transparent" />
              </div>

              {/* Una línea (21/10/2026): eran tres y empujaban el campo fuera de la pantalla. */}
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/55">
                Fichas, flechas y escenas que se reproducen moviéndose: para la
                charla, el proyector y el grupo.
              </p>
            </header>
            )}

            {!sinCromo && indexLocalOnly && (
              <p className="flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200/90">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                {/* Sin jerga de base de datos (19/10/2026): quien lo lee es el
                    cuerpo técnico, y casi siempre es falta de conexión. */}
                <span>
                  No hay conexión con el servidor: lo que hagas se guarda en
                  este dispositivo y se subirá solo cuando vuelva. Mientras
                  tanto, el resto del staff no verá estos cambios.
                </span>
              </p>
            )}

            <div
              className={cn(
                "grid items-start gap-5",
                !sinCromo && "xl:grid-cols-[260px_1fr]",
              )}
            >
              {/* BIBLIOTECA */}

              {!sinCromo && (
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

                {/* En el móvil la biblioteca se desliza en una fila: en columna
                    empujaba el campo hasta bien pasado el final de la pantalla. */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 xl:block xl:space-y-1.5 xl:overflow-x-visible xl:pb-0">
                  {boards.length === 0 && (
                    <p className="w-full rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[11px] text-white/35">
                      Todavía no hay ninguna pizarra
                    </p>
                  )}

                  {boards.map((board) => (
                    <div
                      key={board.id}
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-xl border px-1 transition xl:shrink",
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
                          className="min-w-0 max-w-[9rem] flex-1 rounded-lg bg-black/40 px-2 py-2 text-xs text-white outline-none xl:max-w-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveId(board.id)}
                          className={cn(
                            "min-w-0 max-w-[9rem] flex-1 truncate px-2 py-2 text-left text-xs font-semibold xl:max-w-none",
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
                        aria-label={`Renombrar ${board.nombre}`}
                        className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/10 hover:text-white"
                      >
                        <Pencil size={12} />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteBoard(board.id)}
                        title="Eliminar (se puede deshacer)"
                        aria-label={`Eliminar ${board.nombre}`}
                        className="rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/15 hover:text-red-300"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5 xl:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => createBoard("blanco")}
                    disabled={!listaCargada}
                    title={listaCargada ? "Una pizarra nueva, con el campo vacío" : "Esperando a que cargue la lista…"}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 px-2 py-2.5 text-xs font-semibold text-white/60 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/20 disabled:hover:text-white/60"
                  >
                    <Plus size={14} />
                    <span>Nueva<span className="hidden sm:inline"> en blanco</span></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => createBoard("onces")}
                    disabled={!listaCargada}
                    title={listaCargada ? "Una pizarra nueva con los dos equipos ya puestos en 4-2-3-1" : "Esperando a que cargue la lista…"}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 px-2 py-2.5 text-xs font-semibold text-white/60 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/20 disabled:hover:text-white/60"
                  >
                    <Users size={14} />
                    <span>Con<span className="hidden sm:inline"> los</span> dos onces</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => createBoard("copia")}
                    disabled={!listaCargada || !active}
                    title={active ? `Una copia de «${active.nombre}», con todas sus escenas` : "Abre una pizarra para duplicarla"}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 px-2 py-2.5 text-xs font-semibold text-white/60 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/20 disabled:hover:text-white/60"
                  >
                    <Copy size={14} />
                    <span>Duplicar<span className="hidden sm:inline"> ésta</span></span>
                  </button>
                </div>
              </aside>
              )}

              {/* TABLERO */}

              <div className="min-w-0 rounded-[30px] border border-[#C8A96B]/20 bg-gradient-to-b from-[#151B23] to-[#0E131A] p-2 shadow-[0_35px_90px_rgba(0,0,0,.5)] sm:p-5">
                {active ? (
                  <BoardEditor
                    key={active.id}
                    boardId={active.id}
                    nombre={active.nombre}
                    roster={players}
                    rivalSquads={squads}
                    conOnces={conOnces && active.nombre === TABLERO_DE_ONCES}
                    deLaSemana={active.nombre === TABLERO_DE_ONCES}
                    aPantallaCompleta={
                      pantallaNuestra && active.nombre === TABLERO_DE_ONCES
                    }
                    semilla={semillas[active.id]}
                    onDoc={recuerdaDoc}
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
                      onClick={() => createBoard("blanco")}
                      disabled={!listaCargada}
                      title={listaCargada ? undefined : "Esperando a que cargue la lista…"}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-5 py-2.5 text-sm font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={16} />
                      {listaCargada ? "Nueva pizarra" : "Cargando…"}
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
  conOnces = false,
  deLaSemana = false,
  aPantallaCompleta = false,
  semilla,
  onDoc,
}: {
  boardId: string;
  nombre: string;
  roster: ReturnType<typeof usePlayers>["players"];
  rivalSquads: RivalSquad[];
  /** Se ha llegado desde la portada: si el campo está vacío, se puebla. */
  conOnces?: boolean;
  /** Es el tablero de los onces: se rellena solo cada semana con los dos onces de verdad. */
  deLaSemana?: boolean;
  /** El campo se abre ocupando la pantalla. Ver `PitchStage`. */
  aPantallaCompleta?: boolean;
  /** Con qué nace: si su documento llega vacío, se guarda esto. */
  semilla?: TacticsDoc;
  /** Cada vez que cambia el documento, para poder duplicarlo desde la lista. */
  onDoc?: (doc: TacticsDoc) => void;
}) {
  const fallback = useMemo(() => emptyDoc(nombre), [nombre]);

  const { value, setValue, status, localOnly, sinGuardar, guardaYa } = useRemoteDoc<TacticsDoc>({
    key: `tactics:board:${boardId}`,
    kind: "tactics-board",
    fallback,
  });

  const doc = useMemo(() => normalizeDoc(value, nombre), [value, nombre]);

  /*
  | EL ONCE ES DE TODA LA APP (30/10/2026)
  |
  | El tablero de los onces no es una pizarra más: de él salen el once de
  | Emotion y el de la pizarra de ABP. Cambiarlo aquí los cambia allí. Para
  | probar otra alineación sin tocar nada, «Probar sin guardar» trabaja sobre
  | una copia que sólo vive en esta pantalla; al terminar se guarda para toda
  | la app o se descarta.
  */
  const [prueba, setPrueba] = useState<TacticsDoc | null>(null);

  useEffect(() => {
    onDoc?.(doc);
  }, [doc, onDoc]);

  /*
  | La pizarra recién creada nace con su semilla en cuanto se sabe que su
  | documento está vacío (no antes: pintar sobre el respaldo mientras carga
  | machacaría lo que contestara el servidor).
  */
  const sembrada = useRef(false);

  useEffect(() => {
    if (!semilla || sembrada.current || status === "loading") return;

    sembrada.current = true;

    const vacia = doc.scenes.every((escena) => escena.tokens.length === 0 && escena.shapes.length === 0);

    if (vacia) setValue({ ...semilla, titulo: nombre });
  }, [doc.scenes, nombre, semilla, setValue, status]);

  /*
  |--------------------------------------------------------------------------
  | LOS DOS ONCES, YA PUESTOS
  |--------------------------------------------------------------------------
  |
  | Llegando desde la portada —`?once=1`— la pizarra se abre con los
  | veintidós colocados en 4-2-3-1 en vez de con el campo vacío: colocarlos a
  | mano delante del grupo son dos minutos de nada.
  |
  | **Sólo si la escena está vacía.** Un tablero con trabajo dentro no se toca
  | ni se le pregunta a nadie: quien entra por ese enlace y ya tenía algo
  | pintado se encuentra lo suyo, y para empezar de cero está «Nueva pizarra».
  | Y se hace una sola vez por visita, que si no, borrar una ficha la volvería
  | a poner en el siguiente render.
  */
  const yaSeIntento = useRef(false);

  /*
  |--------------------------------------------------------------------------
  | LOS ONCES DE LA SEMANA (13/10/2026)
  |--------------------------------------------------------------------------
  |
  | El tablero de los onces se rellena solo con nuestro último once
  | (Valoraciones) y el teórico del rival (Duelos → Plantillas → BeSoccer)
  | cada vez que cambia el próximo partido: el documento guarda para qué
  | semana se rellenó (`semanaOnces`). Dentro de la semana no se toca: lo
  | movido o dibujado se queda. «Rellenar otra vez» lo vuelve a poner a mano.
  |
  | Cada relleno, el automático y el de a mano, se puede deshacer (14/10/2026):
  | se guarda el tablero de antes y «Deshacer» lo devuelve. El deshacer de la
  | barra de herramientas no llega aquí, porque el relleno escribe el documento
  | por fuera de su historial.
  */
  const [fuentes, setFuentes] = useState<{ rival: string; nuestra: string; suya: string } | null>(null);
  const [rellenando, setRellenando] = useState(false);
  const [antesDelRelleno, setAntesDelRelleno] = useState<TacticsDoc | null>(null);
  const semanaMirada = useRef(false);
  const docVivo = useRef(doc);

  useEffect(() => {
    docVivo.current = doc;
  }, [doc]);

  /*
  | `siCompleta` (29/10/2026): el tablero de esta semana tiene menos de once
  | fichas con nombre en un equipo. Se rellena otra vez SÓLO si el relleno
  | nuevo trae más: si el motor tampoco llega a once (plantilla rival corta),
  | abrir la pizarra no puede borrar cada vez lo movido a mano.
  */
  const rellenaSemana = useCallback(
    async (forzar: boolean, siCompleta = false) => {
      setRellenando(true);

      try {
        const onces = await oncesDeLaSemana(roster);

        if (!onces) {
          if (forzar) toast.error("No encuentro el próximo partido en el calendario.");

          return;
        }

        setFuentes({ rival: onces.rival, nuestra: onces.fuenteNuestra, suya: onces.fuenteSuya });

        const previo = normalizeDoc(docVivo.current, nombre);
        const conNombre = (tokens: TacticsDoc["scenes"][number]["tokens"] | undefined) => (tokens ?? []).filter((t) => (t.nombre ?? "").trim()).length;
        const mejora = (base: TacticsDoc) => conNombre(onces.tokens) > conNombre(base.scenes[0]?.tokens);
        const toca = (base: TacticsDoc) => forzar || base.semanaOnces !== onces.semana || (siCompleta && mejora(base));

        if (toca(previo)) setAntesDelRelleno(previo);

        setValue((actual) => {
          const base = normalizeDoc(actual, nombre);

          if (!toca(base)) return base;

          return {
            ...base,
            semanaOnces: onces.semana,
            scenes: [{ id: tacticId("scene"), nombre: `Onces · ${onces.rival}`, tokens: onces.tokens, shapes: [] }],
          };
        });

        if (forzar) toast.success("Onces de la semana puestos", { description: `${onces.fuenteNuestra} · ${onces.fuenteSuya}` });
      } catch (error) {
        console.error("[pizarra] onces de la semana", error);

        if (forzar) toast.error("No se han podido poner los onces");
      } finally {
        setRellenando(false);
      }
    },
    [nombre, roster, setValue],
  );

  /* El próximo partido, para el pie de la lámina y la portada del vídeo de cualquier pizarra. */
  const [partido, setPartido] = useState<{ rival: string; fecha: string; lado: "casa" | "fuera" } | undefined>(undefined);

  useEffect(() => {
    let vivo = true;

    void semanaActual()
      .then((s) => {
        if (vivo && s) setPartido({ rival: s.rival, fecha: s.fecha, lado: s.lado });
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, []);

  /* El tablero de los onces guardado con dos «6»: se arregla una vez al abrirlo (21/10/2026). */
  const numerosMirados = useRef(false);

  useEffect(() => {
    if (!deLaSemana || numerosMirados.current || status === "loading") return;

    numerosMirados.current = true;

    const arregladas = escenasSinNumeroRepetido(doc.scenes);

    if (arregladas) setValue({ ...doc, scenes: arregladas });
  }, [deLaSemana, doc, setValue, status]);

  useEffect(() => {
    if (!deLaSemana || semanaMirada.current || status === "loading" || localOnly || roster.length === 0) return;

    semanaMirada.current = true;

    void semanaActual().then((s) => {
      if (!s) return;

      if (s.semana !== doc.semanaOnces) void rellenaSemana(false);
      /* Misma semana pero con menos de once en un equipo: no se da por bueno (29/10/2026). */
      else if (onceIncompleto(doc.scenes[0]?.tokens)) void rellenaSemana(false, true);
    });
  }, [deLaSemana, status, localOnly, roster.length, doc.semanaOnces, doc.scenes, rellenaSemana]);

  useEffect(() => {
    if (deLaSemana || !conOnces || yaSeIntento.current) return;

    /* Esperar a que llegue lo guardado: pintar sobre el respaldo vacío
       machacaría el tablero en cuanto el servidor contestara. Sin servidor
       (07/10/2026), tampoco: lo que hay delante puede ser el vacío de
       partida o una copia vieja, y los onces irían a la cola encima del
       tablero de verdad. Se intenta cuando vuelva. */
    if (status === "loading" || localOnly) return;

    yaSeIntento.current = true;

    const primera = doc.scenes[0];

    if (!primera) return;

    if (primera.tokens.length === 0 && primera.shapes.length === 0) {
      setValue((actual) => {
        const base = normalizeDoc(actual, nombre);

        const [escena, ...resto] = base.scenes;

        return {
          ...base,
          scenes: [{ ...escena, tokens: dosOnces(DIBUJO_DE_PARTIDA) }, ...resto],
        };
      });

      return;
    }

    /*
    | El tablero ya estaba pintado: se le ponen los números.
    |
    | Los primeros onces se colocaron con el puesto dentro de la ficha —«MCD»,
    | «DFC»—, que ni se lee de lejos ni distingue a los dos que lo comparten.
    | Aquí se cambia **sólo el rótulo** de las fichas que puso la propia
    | plataforma (`once-home-…`, `once-away-…`), en todas las escenas: lo que
    | alguien haya movido, dibujado o añadido se queda como está.
    */
    const numeros = numerosDelOnce(DIBUJO_DE_PARTIDA);

    const leToca = (token: { id: string; label: string; nombre?: string }) =>
      numeros[token.id] !== undefined &&
      (numeros[token.id] !== token.label || Boolean(token.nombre));

    if (!doc.scenes.some((escena) => escena.tokens.some(leToca))) return;

    setValue((actual) => {
      const base = normalizeDoc(actual, nombre);

      return {
        ...base,
        scenes: base.scenes.map((escena) => ({
          ...escena,
          tokens: escena.tokens.map((token) =>
            leToca(token)
              ? { ...token, label: numeros[token.id], nombre: undefined }
              : token,
          ),
        })),
      };
    });
  }, [conOnces, deLaSemana, doc, localOnly, nombre, setValue, status]);

  /*
  | A pantalla completa se lleva **el tablero con su título y su estado**, no
  | sólo el campo: quien dibuja delante del grupo quiere saber que lo que hace
  | se está guardando, y a media charla no hay ocasión de salir a comprobarlo.
  */
  const { marco, enPantallaCompleta, disponible, alterna } =
    usePantallaCompleta<HTMLDivElement>();

  /*
  | EL BOTÓN ⋮ NO SE PLANTA EN EL CAMPO (29/10/2026)
  |
  | En el móvil el menú de herramientas flotante (`MenuFlotante`, abajo a la
  | derecha) caía encima del campo, al lado del lateral: se tocaba sin querer
  | al mover una ficha y tapaba al jugador. Mientras el lienzo está a la vista
  | se esconde con una regla `:has` (como se hizo con `.modal-veil`); al bajar
  | o subir fuera del campo vuelve. Sólo en el móvil: en el portátil va en el
  | margen y no estorba. Exportar la pizarra tiene su botón propio.
  */
  const lienzo = useRef<HTMLDivElement | null>(null);
  const [lienzoALaVista, setLienzoALaVista] = useState(false);

  useEffect(() => {
    const nodo = lienzo.current;

    if (!nodo || typeof IntersectionObserver === "undefined") return;

    const vigia = new IntersectionObserver(([entrada]) => setLienzoALaVista(Boolean(entrada?.isIntersecting)), { threshold: 0.2 });

    vigia.observe(nodo);

    return () => vigia.disconnect();
  }, []);

  return (
    <div
      ref={marco}
      className={cn(
        "space-y-4",
        /* En grande el elemento es la pantalla entera: sin fondo propio se
           vería el negro del navegador por los lados. */
        enPantallaCompleta &&
          "h-full overflow-auto bg-[#0E131A] p-4 sm:p-8",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{nombre}</h2>

        <div className="flex flex-wrap items-center gap-2">
        {disponible && (
          <button
            type="button"
            onClick={() => alterna()}
            title={
              enPantallaCompleta
                ? "Volver al tamaño normal (o pulsa Escape)"
                : "Ver la pizarra a pantalla completa"
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1 text-[11px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
          >
            {enPantallaCompleta ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {enPantallaCompleta ? "Salir" : "Pantalla completa"}
          </button>
        )}

        {/* El estado del guardado: botón para guardar o reintentar cuando hay algo pendiente. */}
        <EstadoGuardado
          status={status}
          localOnly={localOnly}
          sinGuardar={sinGuardar}
          onGuardar={() => void guardaYa()}
          ocultoSiGuardado
        />
        </div>
      </div>

      {!deLaSemana && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60" aria-label="Leyenda de colores">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2" style={{ background: "#F8FAFC", borderColor: "#0B0F14" }} aria-hidden /> Ficha blanca: Castilla
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2" style={{ background: "#1E293B", borderColor: "#F87171" }} aria-hidden /> Ficha oscura con borde rojo: rival
          </span>
        </p>
      )}

      {deLaSemana && (
        <div className="flex flex-col gap-2 rounded-2xl border border-[#C8A96B]/20 bg-[#C8A96B]/[0.05] px-3 py-2 text-[11px] text-white/60 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
          <span className="font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">Onces de la semana</span>
          {/* En el móvil, en su propia fila: al lado de los botones se quedaba en una palabra por renglón. */}
          <span className="min-w-0 sm:flex-1">
            {fuentes
              ? `${fuentes.nuestra} (el Castilla ataca hacia la derecha) · vs ${fuentes.rival}, hacia la izquierda: ${fuentes.suya.charAt(0).toLowerCase()}${fuentes.suya.slice(1)}.`
              : doc.semanaOnces
                ? `Nuestro once y el suyo para el ${diaYLugar(doc.semanaOnces.split("|")[0], doc.semanaOnces.split("|")[1], partido)}.`
                : "Se rellenan solos cada semana con nuestro último once y el teórico del rival."}
            {doc.semanaOnces && (
              <b className="ml-1 font-semibold text-white/85">Toca dos veces una ficha para cambiar al jugador.</b>
            )}
          </span>
          <span className="flex items-center gap-3 text-white/70" aria-label="Leyenda de colores">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2" style={{ background: "#F8FAFC", borderColor: "#0B0F14" }} aria-hidden /> Ficha blanca: Castilla
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2" style={{ background: "#1E293B", borderColor: "#F87171" }} aria-hidden /> Ficha oscura con borde rojo: rival
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
          {antesDelRelleno && (
            <button
              type="button"
              onClick={() => {
                setValue(antesDelRelleno);
                setAntesDelRelleno(null);
                toast.success("Tablero como estaba antes del relleno");
              }}
              title="Vuelve a dejar el tablero como estaba antes de rellenarlo"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              <Undo2 size={12} />
              Deshacer
            </button>
          )}
          <button
            type="button"
            onClick={() => void rellenaSemana(true)}
            disabled={rellenando}
            title="Vuelve a poner solos nuestro último once y el del rival. Se puede deshacer."
            className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/40 px-3 py-1 font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/15 disabled:opacity-50"
          >
            {rellenando ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            Rellenar otra vez
          </button>
          </span>
        </div>
      )}

      {deLaSemana &&
        (prueba ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] px-3 py-2.5 text-[12px] sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1 text-white/80">
              <b className="mr-1 font-semibold text-amber-300">Modo prueba.</b>
              Lo que cambies no se guarda ni afecta al resto de la app.
            </span>
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setValue(prueba);
                  setPrueba(null);
                  toast.success("Once guardado: Emotion y la pizarra de ABP ya lo usan");
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#C8A96B] px-3.5 py-1.5 text-[11px] font-bold text-[#0B0F14] transition hover:brightness-110"
              >
                <Check size={13} />
                Guardar para toda la app
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrueba(null);
                  toast("Prueba descartada: el once vuelve a ser el guardado");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Undo2 size={13} />
                Descartar
              </button>
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1 text-white/65">
              <b className="mr-1 font-semibold text-white/90">Este once es el de toda la app.</b>
              Lo usan Emotion y la pizarra de ABP: lo que cambies aquí se guarda y les afecta.
            </span>
            <button
              type="button"
              onClick={() => setPrueba(doc)}
              title="Cambia el once sólo en esta pantalla; al terminar decides si se guarda"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/50 px-3.5 py-1.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-400/10"
            >
              <FlaskConical size={13} />
              Probar sin guardar
            </button>
          </div>
        ))}

      <div ref={lienzo} data-lienzo-pizarra={lienzoALaVista ? "a-la-vista" : undefined}>
        <TacticsBoard
          doc={prueba ?? doc}
          onChange={prueba ? setPrueba : setValue}
          aPantallaCompleta={aPantallaCompleta}
          roster={roster}
          rivalSquads={rivalSquads}
          partido={partido}
          hint="Para animar: duplica la escena, mueve las fichas en la copia y pulsa ▶. Para presentar: pantalla completa y → (o el mando) avanza la jugada escena a escena."
        />
      </div>

      <style>{`@media (max-width: 639px) { body:has([data-lienzo-pizarra="a-la-vista"]) [data-menu-flotante] { opacity: 0; pointer-events: none; transform: translateY(16px); transition: opacity .2s, transform .2s; } }`}</style>
    </div>
  );
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** «domingo 25 en Algeciras» o «domingo 25 contra el Algeciras CF», como lo diría el cuerpo técnico. */
/** «domingo 25»: como lo dice el cuerpo técnico. */
function diaCorto(fecha: string) {
  const dia = new Date(`${fecha}T12:00:00`);

  if (Number.isNaN(dia.getTime())) return "";

  return dia.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" }).replace(",", "");
}

function diaYLugar(fecha: string, rival: string, partido?: { rival: string; fecha: string; lado: "casa" | "fuera" }) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const nombre = anio && mes && dia ? `${DIAS_SEMANA[new Date(anio, mes - 1, dia, 12).getDay()]} ${dia}` : fecha;
  const lado = partido && partido.fecha === fecha ? partido.lado : undefined;

  if (lado === "casa") return `${nombre} en casa contra el ${rival}`;
  if (lado === "fuera") return `${nombre} en el campo del ${rival}`;

  return `${nombre} contra el ${rival}`;
}
