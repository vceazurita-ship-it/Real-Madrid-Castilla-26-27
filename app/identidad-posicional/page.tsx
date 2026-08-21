"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, SearchX, Trash2 } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  AutoTextarea,
  ConfirmDialog,
  EditToolbar,
  EmptyState,
  ErrorState,
  Highlight,
  LoadingState,
  Modal,
  NavButton,
  SearchField,
  SectionLabel,
  Spinner,
  focusRing,
  matches,
  useEditShortcuts,
  useUnsavedGuard,
} from "@/components/ui/knowledge-kit";
import { cn } from "@/lib/utils";

type PosicionItem = {
  ID: number;
  POSICION: string;
  BLOQUE: string;
  TITULO: string;
  CONTENIDO: string;
  ORDEN: number;
  ACTIVO?: string;
};

const API =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

/** Columnas fijas: se muestran siempre, aunque la posición todavía no tenga contenidos. */
const BLOQUES_BASE = ["CON BALÓN", "SIN BALÓN"];

export default function IdentidadPosicionalPage() {
  const [data, setData] = useState<PosicionItem[]>([]);
  const [originalData, setOriginalData] = useState<PosicionItem[]>([]);

  const [posicion, setPosicion] = useState("");
  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [porBorrar, setPorBorrar] = useState<PosicionItem | null>(null);
  const [borrando, setBorrando] = useState(false);

  const [nuevoBloque, setNuevoBloque] = useState<string | null>(null);
  const [nuevoContenido, setNuevoContenido] = useState("");
  const [nuevoOrden, setNuevoOrden] = useState("");
  const [creando, setCreando] = useState(false);

  /* ------------------------------------------------------------ carga */

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const res = await fetch(
          `${API}?action=getIdentidadPosicional&t=${Date.now()}`,
          { cache: "no-store" },
        );

        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);

        const rows: PosicionItem[] = await res.json();

        const activos = rows.filter(
          (r) => String(r.ACTIVO).toUpperCase() !== "FALSE",
        );

        if (cancelado) return;

        setData(activos);
        setOriginalData(structuredClone(activos));
        setPosicion((actual) => actual || activos[0]?.POSICION || "");
        setError(null);
      } catch (err) {
        if (cancelado) return;

        setError(
          err instanceof Error
            ? err.message
            : "Error desconocido al cargar la identidad posicional.",
        );
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [recarga]);

  /** `conEsqueleto` distingue el reintento manual del refresco tras guardar o crear. */
  const recargar = useCallback((conEsqueleto = true) => {
    if (conEsqueleto) setLoading(true);
    setError(null);
    setRecarga((n) => n + 1);
  }, []);

  /* ------------------------------------------------------------ derivados */

  const posiciones = useMemo(
    () => [...new Set(data.map((r) => r.POSICION).filter(Boolean))],
    [data],
  );

  /** Los bloques base siempre presentes + cualquier otro que aparezca en la hoja. */
  const bloques = useMemo(() => {
    const extra = [...new Set(data.map((r) => r.BLOQUE).filter(Boolean))].filter(
      (b) => !BLOQUES_BASE.includes(b),
    );

    return [...BLOQUES_BASE, ...extra];
  }, [data]);

  /** Los filtros de texto se desactivan al editar para no ocultar lo que se escribe. */
  const visibles = useMemo(
    () => (editing ? data : data.filter((r) => matches(query, r.CONTENIDO))),
    [data, editing, query],
  );

  const contenidos = useMemo(
    () =>
      visibles
        .filter((r) => r.POSICION === posicion)
        .sort((a, b) => Number(a.ORDEN) - Number(b.ORDEN)),
    [visibles, posicion],
  );

  const totalPosicion = useMemo(
    () => data.filter((r) => r.POSICION === posicion).length,
    [data, posicion],
  );

  const filtrando = !editing && query.trim() !== "";

  const cambios = useMemo(
    () =>
      data.filter((item) => {
        const original = originalData.find((o) => o.ID === item.ID);
        return original && original.CONTENIDO !== item.CONTENIDO;
      }),
    [data, originalData],
  );

  useUnsavedGuard(editing && cambios.length > 0);

  /* ------------------------------------------------------------ edición */

  const entrarEnEdicion = () => {
    setQuery("");
    setEditing(true);
  };

  const salirDeEdicion = useCallback(() => {
    setData(structuredClone(originalData));
    setEditing(false);
  }, [originalData]);

  const guardarCambios = useCallback(async () => {
    if (cambios.length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);

    try {
      const resultados = await Promise.allSettled(
        cambios.map((p) =>
          fetch(
            `${API}?action=guardarIdentidadPosicional&ID=${p.ID}&CONTENIDO=${encodeURIComponent(
              p.CONTENIDO,
            )}`,
          ),
        ),
      );

      const fallidos = resultados.filter((r) => r.status === "rejected").length;

      if (fallidos > 0) {
        toast.error(
          `${fallidos} de ${cambios.length} cambios no se han podido guardar. Revisa la conexión y vuelve a intentarlo.`,
        );
        return;
      }

      toast.success(
        `${cambios.length} cambio${cambios.length === 1 ? "" : "s"} guardado${
          cambios.length === 1 ? "" : "s"
        }`,
      );

      setEditing(false);
      recargar(false);
    } catch (err) {
      console.error(err);
      toast.error("No se han podido guardar los cambios");
    } finally {
      setSaving(false);
    }
  }, [cambios, recargar]);

  useEditShortcuts({
    editing,
    onSave: guardarCambios,
    onCancel: salirDeEdicion,
  });

  /* ------------------------------------------------------------ borrar */

  const confirmarBorrado = async () => {
    if (!porBorrar) return;

    setBorrando(true);

    try {
      const res = await fetch(
        `${API}?action=borrarIdentidadPosicional&ID=${porBorrar.ID}`,
      );

      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);

      setData((prev) => prev.filter((x) => x.ID !== porBorrar.ID));
      setOriginalData((prev) => prev.filter((x) => x.ID !== porBorrar.ID));

      toast.success("Contenido eliminado");
      setPorBorrar(null);
    } catch (err) {
      console.error(err);
      toast.error("No se ha podido eliminar el contenido");
    } finally {
      setBorrando(false);
    }
  };

  /* ------------------------------------------------------------ crear */

  /** Siguiente ORDEN libre dentro de la posición y el bloque indicados. */
  const siguienteOrden = useCallback(
    (bloque: string) =>
      data
        .filter((r) => r.POSICION === posicion && r.BLOQUE === bloque)
        .reduce((max, r) => Math.max(max, Number(r.ORDEN) || 0), 0) + 1,
    [data, posicion],
  );

  const abrirNuevo = (bloque: string) => {
    if (cambios.length > 0) {
      toast.warning("Guarda los cambios pendientes antes de añadir contenido");
      return;
    }

    setNuevoBloque(bloque);
    setNuevoContenido("");
    setNuevoOrden(String(siguienteOrden(bloque)));
  };

  const crearItem = async () => {
    if (!nuevoBloque) return;

    if (!nuevoContenido.trim()) {
      toast.error("Introduce un contenido");
      return;
    }

    setCreando(true);

    try {
      const res = await fetch(
        `${API}?action=crearIdentidadPosicional` +
          `&POSICION=${encodeURIComponent(posicion)}` +
          `&BLOQUE=${encodeURIComponent(nuevoBloque)}` +
          `&CONTENIDO=${encodeURIComponent(nuevoContenido.trim())}` +
          `&ORDEN=${encodeURIComponent(nuevoOrden)}`,
      );

      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);

      toast.success("Contenido añadido");

      setNuevoBloque(null);
      setNuevoContenido("");
      setNuevoOrden("");

      recargar(false);
    } catch (err) {
      console.error(err);
      toast.error("No se ha podido crear el contenido");
    } finally {
      setCreando(false);
    }
  };

  /* ------------------------------------------------------------ render */

  const toolbar = (
    <EditToolbar
      editing={editing}
      dirtyCount={cambios.length}
      saving={saving}
      onEdit={entrarEnEdicion}
      onCancel={salirDeEdicion}
      onSave={guardarCambios}
    />
  );

  const renderBloque = (bloque: string) => {
    const items = contenidos.filter((c) => c.BLOQUE === bloque);
    const total = data.filter(
      (c) => c.POSICION === posicion && c.BLOQUE === bloque,
    ).length;

    return (
      <section key={bloque} className="min-w-0">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h2 className="text-lg font-bold tracking-wide text-[#C8A96B] lg:text-xl">
            {bloque}
          </h2>

          <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-400">
            {filtrando ? `${items.length}/${total}` : total}
          </span>
        </div>

        {items.length === 0 && !editing ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-600">
            {filtrando
              ? "Ningún contenido coincide"
              : "Todavía sin contenidos"}
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li
                key={item.ID}
                className="border-b border-white/[0.07] pb-4 last:border-0"
              >
                {editing ? (
                  <div className="space-y-2">
                    <AutoTextarea
                      value={item.CONTENIDO}
                      minRows={2}
                      aria-label={`Contenido ${item.ORDEN} de ${bloque}`}
                      onChange={(e) =>
                        setData((prev) =>
                          prev.map((x) =>
                            x.ID === item.ID
                              ? { ...x, CONTENIDO: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setPorBorrar(item)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300",
                          focusRing,
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8A96B]"
                    />

                    <p className="min-w-0 whitespace-pre-wrap break-words leading-relaxed text-gray-200">
                      <Highlight text={item.CONTENIDO} query={query} />
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <button
            type="button"
            onClick={() => abrirNuevo(bloque)}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm text-gray-400 transition-colors hover:border-[#C8A96B]/50 hover:bg-[#C8A96B]/[0.06] hover:text-[#C8A96B]",
              focusRing,
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Añadir en {bloque}
          </button>
        )}
      </section>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F14]">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <Topbar />

        <div className="flex flex-col lg:flex-row">
          {/* ---------------------------------------------- rail izquierdo */}

          <aside
            aria-label="Posiciones"
            className="w-full border-white/10 p-4 lg:w-[280px] lg:shrink-0 lg:border-r lg:p-6 xl:w-[320px]"
          >
            <SectionLabel className="text-[#C8A96B]">Posiciones</SectionLabel>

            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar contenido…"
              label="Buscar en los contenidos individuales"
              className={cn("mt-4", editing && "pointer-events-none opacity-40")}
            />

            <nav className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 scrollbar-none lg:mt-5 lg:block lg:space-y-2 lg:overflow-visible">
              {posiciones.map((p) => {
                const total = visibles.filter((x) => x.POSICION === p).length;

                return (
                  <NavButton
                    key={p}
                    active={posicion === p}
                    onClick={() => setPosicion(p)}
                    label={p}
                    count={total}
                    dimmed={filtrando && total === 0}
                  />
                );
              })}

              {loading &&
                [0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 w-full animate-pulse rounded-2xl bg-white/[0.04]"
                  />
                ))}
            </nav>
          </aside>

          {/* ---------------------------------------------- contenido */}

          <main className={cn("min-w-0 flex-1 p-4 lg:p-8", editing && "pb-32")}>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 sm:p-8 lg:rounded-3xl lg:p-10">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <SectionLabel className="text-[#C8A96B]">
                    Contenidos individuales
                  </SectionLabel>

                  <h1 className="mt-3 break-words text-3xl font-bold text-white sm:text-4xl lg:text-6xl">
                    {posicion || "—"}
                  </h1>

                  <p className="mt-3 text-sm text-gray-400">
                    Foco individual por posición
                    {!loading && !error && totalPosicion > 0 && (
                      <span className="text-gray-600">
                        {" · "}
                        {filtrando
                          ? `${contenidos.length} de ${totalPosicion} contenidos`
                          : `${totalPosicion} contenidos`}
                      </span>
                    )}
                  </p>
                </div>

                {!editing && !loading && !error && toolbar}
              </div>

              <div className="mt-10">
                {loading ? (
                  <LoadingState rows={3} />
                ) : error ? (
                  <ErrorState message={error} onRetry={() => recargar()} />
                ) : totalPosicion === 0 && !editing ? (
                  <EmptyState
                    title="Esta posición aún no tiene contenidos"
                    hint="Entra en modo edición para añadir el primero."
                  />
                ) : filtrando && contenidos.length === 0 ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" aria-hidden />}
                    title="Sin resultados en esta posición"
                    hint={`«${posicion}» tiene ${totalPosicion} contenidos, pero ninguno contiene «${query.trim()}». Los contadores del rail izquierdo indican dónde sí hay coincidencias.`}
                    action={
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className={cn(
                          "rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/10",
                          focusRing,
                        )}
                      >
                        Limpiar búsqueda
                      </button>
                    }
                  />
                ) : (
                  <div className="grid gap-10 lg:grid-cols-2">
                    {bloques.map(renderBloque)}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Barra de guardado siempre accesible durante la edición */}
      {editing && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0B0F14]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-end">
            {toolbar}
          </div>
        </div>
      )}

      {/* Nuevo contenido */}
      <Modal
        open={nuevoBloque !== null}
        onClose={() => !creando && setNuevoBloque(null)}
        title="Nuevo contenido"
        description={`Se añadirá a ${posicion} · ${nuevoBloque ?? ""}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setNuevoBloque(null)}
              disabled={creando}
              className={cn(
                "rounded-xl border border-white/15 px-5 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50",
                focusRing,
              )}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={crearItem}
              disabled={creando || !nuevoContenido.trim()}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl bg-[#C8A96B] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#d8bd85] disabled:cursor-not-allowed disabled:opacity-40",
                focusRing,
              )}
            >
              {creando && <Spinner />}
              {creando ? "Creando…" : "Crear"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="nuevo-bloque"
              className="mb-2 block text-sm text-gray-400"
            >
              Bloque
            </label>

            <select
              id="nuevo-bloque"
              value={nuevoBloque ?? ""}
              onChange={(e) => {
                setNuevoBloque(e.target.value);
                setNuevoOrden(String(siguienteOrden(e.target.value)));
              }}
              className={cn(
                "w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white",
                focusRing,
              )}
            >
              {bloques.map((b) => (
                <option key={b} value={b} className="bg-[#11161D]">
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="nuevo-contenido"
              className="mb-2 block text-sm text-gray-400"
            >
              Contenido
            </label>

            <AutoTextarea
              id="nuevo-contenido"
              value={nuevoContenido}
              onChange={(e) => setNuevoContenido(e.target.value)}
              placeholder="Describe el foco individual…"
            />
          </div>

          <div>
            <label
              htmlFor="nuevo-orden"
              className="mb-2 block text-sm text-gray-400"
            >
              Orden
            </label>

            <input
              id="nuevo-orden"
              type="number"
              min={1}
              value={nuevoOrden}
              onChange={(e) => setNuevoOrden(e.target.value)}
              className={cn(
                "w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white",
                focusRing,
              )}
            />

            <p className="mt-2 text-xs text-gray-600">
              Define la posición del contenido dentro del bloque.
            </p>
          </div>
        </div>
      </Modal>

      {/* Confirmación de borrado */}
      <ConfirmDialog
        open={porBorrar !== null}
        title="¿Eliminar este contenido?"
        message={
          porBorrar
            ? `«${porBorrar.CONTENIDO.slice(0, 120)}${
                porBorrar.CONTENIDO.length > 120 ? "…" : ""
              }» se eliminará de ${porBorrar.POSICION}. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        destructive
        busy={borrando}
        onConfirm={confirmarBorrado}
        onCancel={() => !borrando && setPorBorrar(null)}
      />
    </div>
  );
}
