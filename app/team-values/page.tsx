"use client";
import { traeCsv } from "@/lib/hojaCsv";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SearchX,
} from "lucide-react";

import { RepositorioCultura } from "@/components/cultura/RepositorioCultura";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useSaveGuard } from "@/hooks/useSaveGuard";
import { useAutoSave } from "@/hooks/useAutoSave";
import {
  AutoTextarea,
  EditToolbar,
  EmptyState,
  ErrorState,
  Highlight,
  LoadingState,
  NavButton,
  SearchField,
  SectionLabel,
  focusRing,
  matches,
  useEditShortcuts,
} from "@/components/ui/knowledge-kit";
import { cn } from "@/lib/utils";

type CulturaItem = {
  ID: number;
  SECCION: string;
  TIPO: string;
  TITULO: string;
  CONTENIDO: string;
  ORDEN: number;
};

const API =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1367356753&single=true&output=csv";

/** Descripción de cada etapa del roadmap. Las secciones nuevas caen al texto por defecto. */
const DESCRIPCIONES: Record<string, string> = {
  MARCO: "Fundamentos conceptuales sobre identidad, propósito y cultura.",
  PLANIFICACION: "Diseño del proceso y estructura de implementación.",
  "SEMANA 1": "Construcción del significado de pertenecer al grupo.",
  "SEMANA 2": "Definición de valores y comportamientos observables.",
  "SEMANA 3": "Establecimiento de estándares e innegociables.",
  "SEMANA 4": "Consolidación de hábitos y herramientas culturales.",
};

const DESCRIPCION_POR_DEFECTO =
  "Contenidos culturales de esta etapa del roadmap.";

const TIPO_STYLES: Record<string, string> = {
  VALOR: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  ANTIVALOR: "bg-red-500/15 text-red-300 ring-red-500/25",
  INNEGOCIABLE: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  INTOLERABLE: "bg-orange-500/15 text-orange-300 ring-orange-500/25",
};

const TIPO_POR_DEFECTO = "bg-[#C8A96B]/15 text-[#C8A96B] ring-[#C8A96B]/25";

export default function TeamValuesPage() {
  const [data, setData] = useState<CulturaItem[]>([]);
  const [originalData, setOriginalData] = useState<CulturaItem[]>([]);

  const [seccion, setSeccion] = useState("");
  const [query, setQuery] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);

  /* La estantería de documentos, plegada: el roadmap es lo que se abre a
     diario y el documento se saca de vez en cuando. */
  const [documentos, setDocumentos] = useState(false);
  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  /* Deja rescatar el texto de los cambios que el servidor no acepte. */
  const { reportarRechazo, dialogo: avisoGuardado } = useSaveGuard();

  /* ------------------------------------------------------------ carga */

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const csv = await traeCsv(CSV_URL, { forzar: recarga > 0 });

        const parsed = Papa.parse<CulturaItem>(csv, {
          header: true,
          skipEmptyLines: true,
        });

        const rows = parsed.data.filter((r) => r?.SECCION);

        if (cancelado) return;

        setData(rows);
        setOriginalData(structuredClone(rows));

        const hash = decodeURIComponent(
          window.location.hash.replace("#", ""),
        ).toUpperCase();

        const inicial =
          rows.find((r) => r.SECCION.toUpperCase() === hash)?.SECCION ??
          rows[0]?.SECCION ??
          "";

        setSeccion((actual) => actual || inicial);
        setError(null);
      } catch (err) {
        if (cancelado) return;

        setError(
          err instanceof Error
            ? err.message
            : "Error desconocido al leer la hoja de cálculo.",
        );
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [recarga]);

  const recargar = useCallback(() => {
    setLoading(true);
    setError(null);
    setRecarga((n) => n + 1);
  }, []);

  /* ------------------------------------------------------------ derivados */

  const secciones = useMemo(
    () => [...new Set(data.map((r) => r.SECCION))],
    [data],
  );

  /** Solo los tipos presentes en la etapa actual: filtrar por uno vacío no aporta nada. */
  const tipos = useMemo(
    () =>
      [
        ...new Set(
          data
            .filter((r) => r.SECCION === seccion)
            .map((r) => r.TIPO)
            .filter(Boolean),
        ),
      ].sort(),
    [data, seccion],
  );

  // Al cambiar de etapa, un filtro de tipo que ya no existe dejaría la lista vacía sin motivo.
  const tipoActivo =
    tipoFiltro && tipos.includes(tipoFiltro) ? tipoFiltro : null;

  /** Filtros de búsqueda: se desactivan durante la edición para no ocultar lo que se escribe. */
  const visibles = useMemo(() => {
    if (editing) return data;

    return data.filter(
      (r) =>
        (!tipoActivo || r.TIPO === tipoActivo) &&
        matches(query, r.TITULO, r.CONTENIDO, r.TIPO),
    );
  }, [data, editing, query, tipoActivo]);

  const contenidos = useMemo(
    () =>
      visibles
        .filter((r) => r.SECCION === seccion)
        .sort((a, b) => Number(a.ORDEN) - Number(b.ORDEN)),
    [visibles, seccion],
  );

  const totalSeccion = useMemo(
    () => data.filter((r) => r.SECCION === seccion).length,
    [data, seccion],
  );

  const etapaIndex = secciones.indexOf(seccion);
  const filtrando = !editing && (query.trim() !== "" || tipoActivo !== null);

  /* ------------------------------------------------------------ navegación */

  const irASeccion = useCallback((valor: string) => {
    setSeccion(valor);
    window.history.replaceState(null, "", `#${encodeURIComponent(valor)}`);
  }, []);

  const saltarEtapa = (delta: number) => {
    const destino = secciones[etapaIndex + delta];
    if (destino) {
      irASeccion(destino);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* ------------------------------------------------------------ edición */

  /*
  | Foto del contenido al entrar en edición. No es `originalData`, que el
  | autoguardado va adelantando conforme se escribe: ésta se queda quieta y es
  | a la que vuelve «Deshacer».
  */
  const [alEntrar, setAlEntrar] = useState<CulturaItem[]>([]);

  const entrarEnEdicion = () => {
    setAlEntrar(structuredClone(data));

    setQuery("");
    setTipoFiltro(null);
    setEditing(true);
  };

  const tocados = useMemo(
    () =>
      editing
        ? data.filter((item) => {
            const inicial = alEntrar.find((o) => o.ID === item.ID);
            return inicial && inicial.CONTENIDO !== item.CONTENIDO;
          }).length
        : 0,
    [data, editing, alEntrar],
  );

  /*
  |--------------------------------------------------------------------------
  | AUTOGUARDADO
  |--------------------------------------------------------------------------
  |
  | En edición no hay botón de guardar: cada contenido sale hacia la hoja unos
  | segundos después de dejar de escribirlo. Sólo viajan los que han cambiado
  | respecto a la última versión confirmada.
  */

  const baseRef = useRef(originalData);

  useEffect(() => {
    baseRef.current = originalData;
  });

  const escribirCambios = useCallback(
    async (actual: CulturaItem[]) => {
      const pendientes = actual.filter((item) => {
        const original = baseRef.current.find((o) => o.ID === item.ID);

        return original && original.CONTENIDO !== item.CONTENIDO;
      });

      if (pendientes.length === 0) return true;

      const resultados = await Promise.allSettled(
        pendientes.map((p) =>
          fetch(
            `${API}?action=guardarCultura&ID=${p.ID}&CONTENIDO=${encodeURIComponent(
              p.CONTENIDO,
            )}`,
          ),
        ),
      );

      /* Una respuesta de error también es un cambio perdido: contarla como
         éxito solo porque la petición llegó a completarse es justo lo que
         hace que el texto desaparezca sin avisar. */
      const fallidos = pendientes.filter((_, indice) => {
        const resultado = resultados[indice];

        return resultado.status === "rejected" || !resultado.value.ok;
      });

      if (fallidos.length > 0) {
        reportarRechazo({
          titulo: "Valores de equipo · cambios sin guardar",
          campos: Object.fromEntries(
            fallidos.map((p) => [
              `${p.SECCION} · ${p.TITULO || p.ID}`,
              p.CONTENIDO,
            ]),
          ),
        });

        return false;
      }

      setOriginalData(structuredClone(actual));

      return true;
    },
    [reportarRechazo],
  );

  const auto = useAutoSave<CulturaItem[]>({
    value: data,
    enabled: editing,
    debounce: 1500,
    save: escribirCambios,
  });

  const salirDeEdicion = useCallback(() => {
    if (tocados === 0) {
      setEditing(false);
      return;
    }

    if (
      !window.confirm(
        "¿Deshacer todo lo escrito desde que entraste en edición? Ya está guardado, así que esto lo revierte en la hoja.",
      )
    ) {
      return;
    }

    setData(structuredClone(alEntrar));

    toast.info("Cambios deshechos");
  }, [tocados, alEntrar]);

  const terminarEdicion = useCallback(async () => {
    setSaving(true);

    try {
      await auto.flush();
    } finally {
      setSaving(false);
    }

    setEditing(false);
  }, [auto]);

  useEditShortcuts({
    editing,
    onSave: terminarEdicion,
    onCancel: salirDeEdicion,
  });

  /* ------------------------------------------------------------ render */

  const toolbar = (
    <EditToolbar
      editing={editing}
      dirtyCount={tocados}
      saving={saving}
      onEdit={entrarEnEdicion}
      onCancel={salirDeEdicion}
      onSave={terminarEdicion}
      autoSave={{
        estado: auto.status,
        guardadoEn: auto.lastSavedAt,
        onReintentar: () => void auto.flush(),
      }}
    />
  );

  return (
    <div className="flex min-h-screen bg-[#0B0F14]">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <Topbar />

        <div className="flex flex-col lg:flex-row">
          {/* ---------------------------------------------- rail izquierdo */}

          <aside
            aria-label="Etapas del roadmap cultural"
            className="w-full border-white/10 p-4 lg:w-[300px] lg:shrink-0 lg:border-r lg:p-6 xl:w-[340px]"
          >
            <SectionLabel className="text-[#C8A96B]">
              Roadmap cultural
            </SectionLabel>

            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar valor, hábito…"
              label="Buscar en los contenidos culturales"
              className={cn("mt-4", editing && "pointer-events-none opacity-40")}
            />

            <nav className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 scrollbar-none lg:mt-5 lg:block lg:space-y-2 lg:overflow-visible">
              {secciones.map((s, i) => {
                const total = visibles.filter((r) => r.SECCION === s).length;

                return (
                  <NavButton
                    key={s}
                    active={s === seccion}
                    onClick={() => irASeccion(s)}
                    label={s}
                    sublabel={`Etapa ${i + 1}`}
                    count={total}
                    dimmed={filtrando && total === 0}
                  />
                );
              })}
            </nav>

            {loading && (
              <div className="mt-2 space-y-2 lg:mt-5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-2xl bg-white/[0.04]"
                  />
                ))}
              </div>
            )}
          </aside>

          {/* ---------------------------------------------- contenido */}

          <main
            className={cn(
              "min-w-0 flex-1 p-4 lg:p-8",
              editing && "pb-32 lg:pb-32",
            )}
          >
            {/*
              Los documentos de cultura.

              El roadmap de esta pantalla es el trabajo del día a día; los
              documentos son lo que sale de él y se enseña en la sala, así que
              se abren desde aquí en vez de obligar a cambiar de pantalla. La
              estantería es la misma que la de Identidad y Cultura: lo que se
              sube aquí aparece allí.
            */}
            <section className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] lg:rounded-3xl">
              <button
                type="button"
                onClick={() => setDocumentos((abierto) => !abierto)}
                aria-expanded={documentos}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]",
                  focusRing,
                )}
              >
                <BookOpen className="h-4 w-4 shrink-0 text-[#C8A96B]" aria-hidden />

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">
                    Documentos de cultura
                  </span>

                  <span className="mt-0.5 block text-[11px] leading-snug text-white/40">
                    Sube el bruto de una presentación y sácala en PDF y en
                    PowerPoint con la plantilla del club
                  </span>
                </span>

                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-white/40 transition-transform",
                    documentos && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              {documentos && (
                <div className="border-t border-white/10 p-4 lg:p-5">
                  <RepositorioCultura />
                </div>
              )}
            </section>

            {/* Cabecera con stepper */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 lg:rounded-3xl lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionLabel className="text-[#C8A96B]">
                  Roadmap cultural
                </SectionLabel>

                {secciones.length > 0 && (
                  <p className="text-xs tabular-nums text-gray-500">
                    Etapa {etapaIndex + 1} de {secciones.length}
                  </p>
                )}
              </div>

              <ol className="mt-4 flex items-center overflow-x-auto pb-1 scrollbar-none">
                {secciones.map((s, i) => (
                  <li key={s} className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => irASeccion(s)}
                      title={s}
                      aria-label={`Etapa ${i + 1}: ${s}`}
                      aria-current={s === seccion ? "step" : undefined}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all lg:h-10 lg:w-10 lg:text-sm",
                        focusRing,
                        s === seccion
                          ? "bg-[#C8A96B] text-black shadow-[0_0_0_4px_rgba(200,169,107,0.18)]"
                          : i < etapaIndex
                            ? "bg-[#C8A96B]/25 text-[#C8A96B] hover:bg-[#C8A96B]/40"
                            : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white",
                      )}
                    >
                      {i + 1}
                    </button>

                    {i < secciones.length - 1 && (
                      <div
                        aria-hidden
                        className={cn(
                          "h-[2px] w-6 lg:w-10",
                          i < etapaIndex ? "bg-[#C8A96B]/40" : "bg-white/10",
                        )}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {/* Título + acciones */}
            <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                  {seccion || "—"}
                </h1>

                <p className="mt-3 max-w-2xl text-sm text-gray-400 lg:text-base">
                  {DESCRIPCIONES[seccion] ??
                    (seccion ? DESCRIPCION_POR_DEFECTO : "")}
                </p>
              </div>

              {!editing && !loading && !error && toolbar}
            </div>

            {/* Filtros por tipo */}
            {!editing && tipos.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTipoFiltro(null)}
                  aria-pressed={tipoActivo === null}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                    focusRing,
                    tipoActivo === null
                      ? "bg-white/[0.12] text-white ring-white/20"
                      : "text-gray-400 ring-white/10 hover:text-white",
                  )}
                >
                  Todos
                </button>

                {tipos.map((t) => {
                  const total = data.filter(
                    (r) => r.SECCION === seccion && r.TIPO === t,
                  ).length;

                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoFiltro(tipoActivo === t ? null : t)}
                      aria-pressed={tipoActivo === t}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                        focusRing,
                        TIPO_STYLES[t] ?? TIPO_POR_DEFECTO,
                        tipoActivo === t
                          ? "ring-2"
                          : "opacity-70 hover:opacity-100",
                      )}
                    >
                      {t}
                      {total > 0 && (
                        <span className="ml-1.5 tabular-nums opacity-70">
                          {total}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Lista */}
            <div className="mt-6">
              {loading ? (
                <LoadingState />
              ) : error ? (
                <ErrorState message={error} onRetry={recargar} />
              ) : contenidos.length === 0 ? (
                filtrando ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" aria-hidden />}
                    title="Sin resultados en esta etapa"
                    hint={
                      totalSeccion > 0
                        ? `«${seccion}» tiene ${totalSeccion} contenidos, pero ninguno coincide con el filtro. Prueba en otra etapa del rail izquierdo.`
                        : "Prueba con otra búsqueda o cambia de etapa."
                    }
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setTipoFiltro(null);
                        }}
                        className={cn(
                          "rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/10",
                          focusRing,
                        )}
                      >
                        Limpiar filtros
                      </button>
                    }
                  />
                ) : (
                  <EmptyState
                    title="Esta etapa aún no tiene contenidos"
                    hint="Añádelos desde la hoja de cálculo del roadmap cultural."
                  />
                )
              ) : (
                <>
                  {filtrando && (
                    <p className="mb-3 text-xs text-gray-500">
                      {contenidos.length} de {totalSeccion} contenidos
                    </p>
                  )}

                  <ul className="space-y-3">
                    {contenidos.map((p) => (
                      <li
                        key={p.ID}
                        className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4 transition-all hover:border-[#C8A96B]/40 hover:bg-white/[0.05] lg:rounded-3xl lg:p-6"
                      >
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#C8A96B] text-xs font-bold tabular-nums text-black lg:h-12 lg:w-12 lg:text-lg">
                            {p.ORDEN}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                              <h3 className="break-words text-base font-semibold text-white lg:text-lg">
                                <Highlight text={p.TITULO} query={query} />
                              </h3>

                              {p.TIPO && (
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1",
                                    TIPO_STYLES[p.TIPO] ?? TIPO_POR_DEFECTO,
                                  )}
                                >
                                  {p.TIPO}
                                </span>
                              )}
                            </div>

                            {editing ? (
                              <AutoTextarea
                                value={p.CONTENIDO}
                                aria-label={`Contenido de ${p.TITULO}`}
                                onChange={(e) =>
                                  setData((prev) =>
                                    prev.map((item) =>
                                      item.ID === p.ID
                                        ? { ...item, CONTENIDO: e.target.value }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            ) : (
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300 lg:text-base">
                                <Highlight text={p.CONTENIDO} query={query} />
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Etapa anterior / siguiente */}
            {!loading && !error && secciones.length > 1 && (
              <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={() => saltarEtapa(-1)}
                  disabled={etapaIndex <= 0}
                  className={cn(
                    "inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:invisible",
                    focusRing,
                  )}
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{secciones[etapaIndex - 1]}</span>
                </button>

                <button
                  type="button"
                  onClick={() => saltarEtapa(1)}
                  disabled={etapaIndex >= secciones.length - 1}
                  className={cn(
                    "inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:invisible",
                    focusRing,
                  )}
                >
                  <span className="truncate">{secciones[etapaIndex + 1]}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </div>
            )}
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

      {avisoGuardado}
    </div>
  );
}
