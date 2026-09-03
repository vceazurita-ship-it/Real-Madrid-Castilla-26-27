"use client";
import { traeCsv } from "@/lib/hojaCsv";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  SearchX,
  Shield,
  Swords,
  Target,
} from "lucide-react";

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

type Principio = {
  ID: number;
  FASE: string;
  BLOQUE: string;
  APARTADO: string;
  PRINCIPIO: string;
  ORDEN: number;
};

const API =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1322156567&single=true&output=csv";

/** Orden preferido de las fases; cualquier otra se añade detrás en el orden de la hoja. */
const ORDEN_FASES = ["ATAQUE", "DEFENSA"];

const ICONO_FASE: Record<string, typeof Swords> = {
  ATAQUE: Swords,
  DEFENSA: Shield,
};

type Ruta = { bloque: string; apartado: string };

const primerBloque = (rows: Principio[], fase: string) =>
  rows.find((r) => r?.FASE === fase)?.BLOQUE ?? "";

const primerApartado = (rows: Principio[], fase: string, bloque: string) =>
  rows.find((r) => r?.FASE === fase && r?.BLOQUE === bloque)?.APARTADO ?? "";

export default function GameModelPage() {
  const [data, setData] = useState<Principio[]>([]);
  const [originalData, setOriginalData] = useState<Principio[]>([]);

  const [fase, setFase] = useState("");
  const [bloque, setBloque] = useState("");
  const [apartado, setApartado] = useState("");

  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  /* Deja rescatar el texto de los principios que el servidor no acepte. */
  const { reportarRechazo, dialogo: avisoGuardado } = useSaveGuard();

  /* ------------------------------------------------------------ carga */

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const csv = await traeCsv(CSV_URL, { forzar: recarga > 0 });

        const parsed = Papa.parse<Principio>(csv, {
          header: true,
          skipEmptyLines: true,
        });

        const rows = parsed.data.filter((r) => r?.FASE && r?.BLOQUE);

        if (cancelado) return;

        setData(rows);
        setOriginalData(structuredClone(rows));

        // Enlace profundo: #FASE, o #FASE|BLOQUE|APARTADO
        const [hFase = "", hBloque = "", hApartado = ""] = decodeURIComponent(
          window.location.hash.replace("#", ""),
        ).split("|");

        const faseInicial =
          rows.find((r) => r.FASE === hFase.toUpperCase())?.FASE ??
          rows.find((r) => r.FASE === "ATAQUE")?.FASE ??
          rows[0]?.FASE ??
          "";

        const bloqueInicial =
          rows.find((r) => r.FASE === faseInicial && r.BLOQUE === hBloque)
            ?.BLOQUE ?? primerBloque(rows, faseInicial);

        const apartadoInicial =
          rows.find(
            (r) =>
              r.FASE === faseInicial &&
              r.BLOQUE === bloqueInicial &&
              r.APARTADO === hApartado,
          )?.APARTADO ?? primerApartado(rows, faseInicial, bloqueInicial);

        setFase(faseInicial);
        setBloque(bloqueInicial);
        setApartado(apartadoInicial);
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

  const fases = useMemo(() => {
    const encontradas = [...new Set(data.map((r) => r.FASE))];

    return encontradas.sort((a, b) => {
      const ia = ORDEN_FASES.indexOf(a);
      const ib = ORDEN_FASES.indexOf(b);

      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;

      return ia - ib;
    });
  }, [data]);

  /** Los filtros de texto se desactivan al editar para no ocultar lo que se escribe. */
  const visibles = useMemo(
    () => (editing ? data : data.filter((r) => matches(query, r.PRINCIPIO))),
    [data, editing, query],
  );

  const bloques = useMemo(
    () => [...new Set(data.filter((r) => r.FASE === fase).map((r) => r.BLOQUE))],
    [data, fase],
  );

  const apartados = useMemo(
    () => [
      ...new Set(
        data
          .filter((r) => r.FASE === fase && r.BLOQUE === bloque)
          .map((r) => r.APARTADO),
      ),
    ],
    [data, fase, bloque],
  );

  const principios = useMemo(
    () =>
      visibles
        .filter(
          (r) =>
            r.FASE === fase && r.BLOQUE === bloque && r.APARTADO === apartado,
        )
        .sort((a, b) => Number(a.ORDEN) - Number(b.ORDEN)),
    [visibles, fase, bloque, apartado],
  );

  const totalApartado = useMemo(
    () =>
      data.filter(
        (r) => r.FASE === fase && r.BLOQUE === bloque && r.APARTADO === apartado,
      ).length,
    [data, fase, bloque, apartado],
  );

  /** Recorrido plano bloque → apartado de la fase actual, para navegar con anterior/siguiente. */
  const ruta = useMemo(() => {
    const out: Ruta[] = [];
    const vistos = new Set<string>();

    data
      .filter((r) => r.FASE === fase)
      .forEach((r) => {
        const clave = `${r.BLOQUE}|${r.APARTADO}`;
        if (vistos.has(clave)) return;

        vistos.add(clave);
        out.push({ bloque: r.BLOQUE, apartado: r.APARTADO });
      });

    return out;
  }, [data, fase]);

  const rutaIndex = ruta.findIndex(
    (r) => r.bloque === bloque && r.apartado === apartado,
  );

  const filtrando = !editing && query.trim() !== "";

  /* ------------------------------------------------------------ navegación */

  const sincronizarHash = useCallback((f: string, b: string, a: string) => {
    window.history.replaceState(
      null,
      "",
      `#${encodeURIComponent([f, b, a].join("|"))}`,
    );
  }, []);

  const seleccionarFase = useCallback(
    (f: string) => {
      const b = primerBloque(data, f);
      const a = primerApartado(data, f, b);

      setFase(f);
      setBloque(b);
      setApartado(a);
      sincronizarHash(f, b, a);
    },
    [data, sincronizarHash],
  );

  const seleccionarBloque = useCallback(
    (b: string) => {
      const a = primerApartado(data, fase, b);

      setBloque(b);
      setApartado(a);
      sincronizarHash(fase, b, a);
    },
    [data, fase, sincronizarHash],
  );

  const seleccionarApartado = useCallback(
    (a: string) => {
      setApartado(a);
      sincronizarHash(fase, bloque, a);
    },
    [fase, bloque, sincronizarHash],
  );

  const saltar = (delta: number) => {
    const destino = ruta[rutaIndex + delta];
    if (!destino) return;

    setBloque(destino.bloque);
    setApartado(destino.apartado);
    sincronizarHash(fase, destino.bloque, destino.apartado);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ------------------------------------------------------------ edición */

  /*
  | Foto de los principios al entrar en edición. No es `originalData`, que el
  | autoguardado va adelantando conforme se escribe: ésta se queda quieta y es
  | a la que vuelve «Deshacer».
  */
  const [alEntrar, setAlEntrar] = useState<Principio[]>([]);

  const entrarEnEdicion = () => {
    setAlEntrar(structuredClone(data));

    setQuery("");
    setEditing(true);
  };

  const tocados = useMemo(
    () =>
      editing
        ? data.filter((item) => {
            const inicial = alEntrar.find((o) => o.ID === item.ID);
            return inicial && inicial.PRINCIPIO !== item.PRINCIPIO;
          }).length
        : 0,
    [data, editing, alEntrar],
  );

  /*
  |--------------------------------------------------------------------------
  | AUTOGUARDADO
  |--------------------------------------------------------------------------
  |
  | En edición no hay botón de guardar: cada principio sale hacia la hoja unos
  | segundos después de dejar de escribirlo. Sólo viajan los que han cambiado
  | respecto a la última versión confirmada, así que tocar uno no reenvía los
  | doscientos que hay en el modelo.
  */

  const baseRef = useRef(originalData);

  useEffect(() => {
    baseRef.current = originalData;
  });

  const escribirCambios = useCallback(
    async (actual: Principio[]) => {
      const pendientes = actual.filter((item) => {
        const original = baseRef.current.find((o) => o.ID === item.ID);

        return original && original.PRINCIPIO !== item.PRINCIPIO;
      });

      if (pendientes.length === 0) return true;

      const resultados = await Promise.allSettled(
        pendientes.map((p) =>
          fetch(
            `${API}?action=guardarPrincipio&ID=${p.ID}&PRINCIPIO=${encodeURIComponent(
              p.PRINCIPIO,
            )}`,
          ),
        ),
      );

      /* Una respuesta de error también es un principio perdido: darla por
         buena porque la petición se completó es lo que hace que el texto
         desaparezca sin avisar. */
      const fallidos = pendientes.filter((_, indice) => {
        const resultado = resultados[indice];

        return resultado.status === "rejected" || !resultado.value.ok;
      });

      if (fallidos.length > 0) {
        reportarRechazo({
          titulo: "Modelo de juego · principios sin guardar",
          campos: Object.fromEntries(
            fallidos.map((p) => [
              `${p.FASE} · ${p.BLOQUE} · ${p.APARTADO || p.ID}`,
              p.PRINCIPIO,
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

  const auto = useAutoSave<Principio[]>({
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
            aria-label="Estructura del modelo de juego"
            className="w-full border-white/10 p-4 lg:w-[300px] lg:shrink-0 lg:border-r lg:p-6 xl:w-[340px]"
          >
            {/* Fase */}
            <div
              role="tablist"
              aria-label="Fase del juego"
              className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1"
            >
              {fases.map((f) => {
                const Icono = ICONO_FASE[f] ?? Target;
                const activa = fase === f;

                return (
                  <button
                    key={f}
                    role="tab"
                    type="button"
                    aria-selected={activa}
                    onClick={() => seleccionarFase(f)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
                      focusRing,
                      activa
                        ? "bg-[#C8A96B] text-black shadow-[0_8px_24px_-12px_rgba(200,169,107,0.9)]"
                        : "text-gray-400 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    <Icono className="h-4 w-4" aria-hidden />
                    {f}
                  </button>
                );
              })}

              {fases.length === 0 && (
                <div className="h-10 flex-1 animate-pulse rounded-xl bg-white/[0.04]" />
              )}
            </div>

            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar principio…"
              label="Buscar en los principios del modelo"
              className={cn("mt-4", editing && "pointer-events-none opacity-40")}
            />

            {/* Bloques */}
            <SectionLabel className="mt-6 mb-3">Bloques</SectionLabel>

            <nav className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 scrollbar-none lg:block lg:space-y-2 lg:overflow-visible">
              {bloques.map((b) => {
                const total = visibles.filter(
                  (r) => r.FASE === fase && r.BLOQUE === b,
                ).length;

                return (
                  <NavButton
                    key={b}
                    active={bloque === b}
                    onClick={() => seleccionarBloque(b)}
                    label={b}
                    count={total}
                    dimmed={filtrando && total === 0}
                  />
                );
              })}

              {loading &&
                [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 w-full animate-pulse rounded-2xl bg-white/[0.04]"
                  />
                ))}
            </nav>

            {/* Apartados */}
            {apartados.length > 0 && (
              <>
                <SectionLabel className="mt-6 mb-3">Apartados</SectionLabel>

                <nav className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 scrollbar-none lg:block lg:space-y-2 lg:overflow-visible">
                  {apartados.map((a) => {
                    const total = visibles.filter(
                      (r) =>
                        r.FASE === fase &&
                        r.BLOQUE === bloque &&
                        r.APARTADO === a,
                    ).length;

                    const activo = apartado === a;

                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => seleccionarApartado(a)}
                        aria-current={activo ? "true" : undefined}
                        className={cn(
                          "flex w-full min-w-[150px] shrink-0 snap-start items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-all lg:min-w-0",
                          focusRing,
                          activo
                            ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                            : "border-white/10 text-gray-400 hover:border-white/25 hover:text-white",
                          filtrando && total === 0 && !activo && "opacity-40",
                        )}
                      >
                        <span className="truncate">{a}</span>

                        <span className="shrink-0 text-[11px] tabular-nums opacity-70">
                          {total}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </>
            )}
          </aside>

          {/* ---------------------------------------------- contenido */}

          <main
            className={cn("min-w-0 flex-1 p-4 lg:p-8", editing && "pb-32")}
          >
            {/* Cabecera */}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <nav
                  aria-label="Ubicación"
                  className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em]"
                >
                  <span className="text-[#C8A96B]">{fase || "—"}</span>

                  {bloque && (
                    <>
                      <span aria-hidden className="text-gray-600">
                        /
                      </span>
                      <span className="text-gray-400">{bloque}</span>
                    </>
                  )}
                </nav>

                <h1 className="mt-3 break-words text-2xl font-semibold text-white sm:text-3xl lg:text-4xl">
                  {apartado || "—"}
                </h1>

                {!loading && !error && (
                  <p className="mt-2 text-sm text-gray-500">
                    {filtrando
                      ? `${principios.length} de ${totalApartado} principios`
                      : `${totalApartado} principio${totalApartado === 1 ? "" : "s"}`}
                  </p>
                )}
              </div>

              {!editing && !loading && !error && toolbar}
            </div>

            {/* Lista */}
            <div className="mt-6">
              {loading ? (
                <LoadingState label="Cargando principios…" />
              ) : error ? (
                <ErrorState message={error} onRetry={recargar} />
              ) : principios.length === 0 ? (
                filtrando ? (
                  <EmptyState
                    icon={<SearchX className="h-6 w-6" aria-hidden />}
                    title="Sin principios que coincidan"
                    hint={`Este apartado tiene ${totalApartado} principios, pero ninguno contiene «${query.trim()}». Los contadores del rail izquierdo indican dónde sí hay coincidencias.`}
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
                  <EmptyState
                    title="Este apartado aún no tiene principios"
                    hint="Añádelos desde la hoja de cálculo del modelo de juego."
                  />
                )
              ) : (
                <ul className="space-y-3">
                  {principios.map((p) => (
                    <li
                      key={p.ID}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-[#C8A96B]/30 hover:bg-white/[0.05] lg:p-5"
                    >
                      <div className="flex min-w-0 items-start gap-3 lg:gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C8A96B] text-xs font-bold tabular-nums text-black lg:h-10 lg:w-10 lg:text-sm">
                          {p.ORDEN}
                        </div>

                        <div className="min-w-0 flex-1">
                          {editing ? (
                            <AutoTextarea
                              value={p.PRINCIPIO}
                              aria-label={`Principio ${p.ORDEN} de ${apartado}`}
                              onChange={(e) =>
                                setData((prev) =>
                                  prev.map((item) =>
                                    item.ID === p.ID
                                      ? { ...item, PRINCIPIO: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white lg:text-base">
                              <Highlight text={p.PRINCIPIO} query={query} />
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Apartado anterior / siguiente */}
            {!loading && !error && ruta.length > 1 && (
              <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={() => saltar(-1)}
                  disabled={rutaIndex <= 0}
                  className={cn(
                    "inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-left text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:invisible",
                    focusRing,
                  )}
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />

                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-widest text-gray-600">
                      {ruta[rutaIndex - 1]?.bloque}
                    </span>
                    <span className="block truncate">
                      {ruta[rutaIndex - 1]?.apartado}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => saltar(1)}
                  disabled={rutaIndex < 0 || rutaIndex >= ruta.length - 1}
                  className={cn(
                    "inline-flex min-w-0 items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-right text-sm text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:invisible",
                    focusRing,
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-widest text-gray-600">
                      {ruta[rutaIndex + 1]?.bloque}
                    </span>
                    <span className="block truncate">
                      {ruta[rutaIndex + 1]?.apartado}
                    </span>
                  </span>

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
