"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Check,
  CloudOff,
  FolderOpen,
  Loader2,
  Maximize2,
  Minimize2,
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
    if (!conOnces || onceAtendido.current || !listaCargada) return;

    onceAtendido.current = true;

    const suyo = boards.find((board) => board.nombre === TABLERO_DE_ONCES);

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

  const createBoard = () => {
    if (!listaCargada) return;

    const board: BoardRef = {
      id: tacticId("board"),
      nombre: `Pizarra ${boards.length + 1}`,
    };

    /* Sobre lo que haya en ese momento, no sobre lo que se leyó al pintar. */
    setIndex((actual) => ({
      boards: [...(actual?.boards ?? []), board],
    }));

    setActiveId(board.id);
    toast.success("Pizarra creada");
  };

  const renameBoard = (id: string, nombre: string) => {
    if (!listaCargada) return;

    setIndex((actual) => ({
      boards: (actual?.boards ?? []).map((board) =>
        board.id === id ? { ...board, nombre } : board
      ),
    }));
  };

  const deleteBoard = (id: string) => {
    if (!listaCargada) return;

    setIndex((actual) => ({
      boards: (actual?.boards ?? []).filter((board) => board.id !== id),
    }));

    if (id === activeId) setActiveId(null);

    toast.success("Pizarra eliminada");
  };

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        {!sinCromo && <Sidebar />}

        <section className="flex min-w-0 flex-1 flex-col">
          {!sinCromo && <Topbar />}

          <div
            className={cn(
              "space-y-5",
              sinCromo ? "p-2" : "px-3 py-5 sm:px-6 sm:py-6 lg:px-10",
            )}
          >
            {!sinCromo && (
            <header>
              <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF Castilla · Metodología
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
            )}

            {!sinCromo && indexLocalOnly && (
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
                  disabled={!listaCargada}
                  title={listaCargada ? undefined : "Esperando a que cargue la lista…"}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-2.5 text-xs font-semibold text-white/60 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/20 disabled:hover:text-white/60"
                >
                  <Plus size={14} />
                  Nueva pizarra
                </button>
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
                    aPantallaCompleta={
                      pantallaNuestra && active.nombre === TABLERO_DE_ONCES
                    }
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
  aPantallaCompleta = false,
}: {
  boardId: string;
  nombre: string;
  roster: ReturnType<typeof usePlayers>["players"];
  rivalSquads: RivalSquad[];
  /** Se ha llegado desde la portada: si el campo está vacío, se puebla. */
  conOnces?: boolean;
  /** El campo se abre ocupando la pantalla. Ver `PitchStage`. */
  aPantallaCompleta?: boolean;
}) {
  const fallback = useMemo(() => emptyDoc(nombre), [nombre]);

  const { value, setValue, status, localOnly } = useRemoteDoc<TacticsDoc>({
    key: `tactics:board:${boardId}`,
    kind: "tactics-board",
    fallback,
  });

  const doc = useMemo(() => normalizeDoc(value, nombre), [value, nombre]);

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

  useEffect(() => {
    if (!conOnces || yaSeIntento.current) return;

    /* Esperar a que llegue lo guardado: pintar sobre el respaldo vacío
       machacaría el tablero en cuanto el servidor contestara. */
    if (status === "loading") return;

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
  }, [conOnces, doc, nombre, setValue, status]);

  /*
  | A pantalla completa se lleva **el tablero con su título y su estado**, no
  | sólo el campo: quien dibuja delante del grupo quiere saber que lo que hace
  | se está guardando, y a media charla no hay ocasión de salir a comprobarlo.
  */
  const { marco, enPantallaCompleta, disponible, alterna } =
    usePantallaCompleta<HTMLDivElement>();

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
      </div>

      <TacticsBoard
        doc={doc}
        onChange={setValue}
        aPantallaCompleta={aPantallaCompleta}
        roster={roster}
        rivalSquads={rivalSquads}
        hint="Elige el equipo rival y pulsa sus dorsales para pintarlos. Dibuja con las herramientas de la barra, duplica la escena, mueve las fichas y pulsa Animar para ver la transición."
      />
    </div>
  );
}
