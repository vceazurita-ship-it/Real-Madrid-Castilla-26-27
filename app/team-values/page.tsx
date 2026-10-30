"use client";
import { olvidaCsv, traeCsv } from "@/lib/hojaCsv";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useSaveGuard } from "@/hooks/useSaveGuard";
import { useAutoSave } from "@/hooks/useAutoSave";
import { anotaEscritas, aplicaEscritas } from "@/lib/escriturasRecientes";
import {
  AVISO_TEXTO_LARGO,
  guardaTextoEnLaHoja,
} from "@/lib/guardaTextoHoja";
import { AvisoLargo } from "@/components/conocimiento/AvisoLargo";
import {
  AutoTextarea,
  EditToolbar,
  EmptyState,
  ErrorState,
  Highlight,
  LoadingState,
  SearchField,
  SectionLabel,
  focusRing,
  matches,
  useEditShortcuts,
} from "@/components/ui/knowledge-kit";
import { cn } from "@/lib/utils";
import { DOCUMENTO_VALORES } from "@/lib/cultura/documentos/valores";

/*
| 30/10/2026: el resultado de todo el proceso —los cinco valores que votó la
| plantilla— sale arriba y lleva al documento de /identidad-cultura. Se lee
| del propio documento, así que no hay dos versiones de los votos.
*/
const VALORES_VOTADOS = (() => {
  const portada = DOCUMENTO_VALORES.diapositivas.find(
    (d) => d.tipo === "portada",
  );

  return portada && portada.tipo === "portada" ? portada.indice : [];
})();

type CulturaItem = {
  ID: number;
  SECCION: string;
  TIPO: string;
  TITULO: string;
  CONTENIDO: string;
  ORDEN: number;
  /*
  | 30/10/2026: columnas opcionales de la hoja para las dinámicas de las
  | semanas. Si alguien las añade, cada dinámica dice cuánto dura, qué
  | material lleva y qué entrega el vestuario; FECHA es la semana real de la
  | etapa. Lo que no tenga texto no se pinta.
  */
  DURACION?: string;
  MATERIAL?: string;
  ENTREGA?: string;
  FECHA?: string;
};

const limpio = (t?: unknown) => String(t ?? "").trim();

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1367356753&single=true&output=csv";

/** Nombre de las notas de lo recién escrito en `localStorage`. */
const ESPACIO_ESCRITAS = "team-values";

/** Descripción de cada etapa de la hoja de ruta: qué se hace con el vestuario. Las secciones nuevas caen al texto por defecto. */
const DESCRIPCIONES: Record<string, string> = {
  MARCO:
    "Lo que acordamos en el cuerpo técnico antes de hablar con el vestuario: identidad, propósito y cultura.",
  PLANIFICACION:
    "Cómo se organiza el proceso: quién hace qué y en qué semana.",
  "SEMANA 1": "Con el vestuario: qué significa pertenecer a este grupo.",
  "SEMANA 2":
    "Con el vestuario: los valores y los comportamientos que se pueden ver.",
  "SEMANA 3": "Con el vestuario: los estándares y lo que no se negocia.",
  "SEMANA 4":
    "Con el vestuario: consolidar los hábitos y las herramientas de la cultura.",
};

const DESCRIPCION_POR_DEFECTO =
  "Contenidos culturales de esta etapa de la hoja de ruta.";

/** Palabras que la hoja trae sin tilde. */
const TILDES: Record<string, string> = {
  planificacion: "planificación",
  elite: "élite",
  evaluacion: "evaluación",
  comunicacion: "comunicación",
  formacion: "formación",
  accion: "acción",
  organizacion: "organización",
  reflexion: "reflexión",
};

/** «PLANIFICACION» → «Planificación»; «ENFOQUE ELITE» → «Enfoque élite». Sólo para pintar. */
function rotuloSeccion(s: string): string {
  const palabras = s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => TILDES[w] ?? w);

  const frase = palabras.join(" ");

  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** Títulos de la hoja que van mejor dichos de otra forma. */
const TITULOS: Record<string, string> = {
  "rol del staff": "Papel del cuerpo técnico",
  "enfoque elite": "Enfoque de élite",
  "enfoque élite": "Enfoque de élite",
};

/** «Quién Queremos Ser» → «Quién queremos ser»; «Rol del Staff» → «Papel del cuerpo técnico». Sólo para pintar. */
function tituloElemento(t: string): string {
  const limpio = t.trim();
  const mapa = TITULOS[limpio.toLowerCase()];

  if (mapa) return mapa;

  const frase = limpio
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w === "staff" ? "cuerpo técnico" : (TILDES[w] ?? w)))
    .join(" ");

  return frase.charAt(0).toUpperCase() + frase.slice(1);
}


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

        /* Lo guardado hace poco va encima: el CSV publicado tarda minutos en
           enterarse (`lib/escriturasRecientes.ts`). */
        const rows = aplicaEscritas(
          ESPACIO_ESCRITAS,
          parsed.data.filter((r) => r?.SECCION),
          "CONTENIDO",
        );

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

  /* La semana real de la etapa, si la hoja la trae en FECHA. */
  const fechaEtapa = useMemo(
    () =>
      data
        .filter((r) => r.SECCION === seccion)
        .map((r) => limpio(r.FECHA))
        .find(Boolean) ?? "",
    [data, seccion],
  );
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

  /* Huella del último fallo que ya se enseñó; se borra con un guardado bueno. */
  const rechazoAvisado = useRef<string | null>(null);

  const escribirCambios = useCallback(
    async (actual: CulturaItem[]) => {
      const pendientes = actual.filter((item) => {
        const original = baseRef.current.find((o) => o.ID === item.ID);

        return original && original.CONTENIDO !== item.CONTENIDO;
      });

      if (pendientes.length === 0) return true;

      /* Un texto largo no cabe en la dirección del GET: ver
         `lib/guardaTextoHoja.ts` (19/10/2026). */
      const resultados = await Promise.allSettled(
        pendientes.map((p) =>
          guardaTextoEnLaHoja("guardarCultura", {
            ID: p.ID,
            CONTENIDO: p.CONTENIDO,
          }),
        ),
      );

      /* Una respuesta de error también es un cambio perdido: contarla como
         éxito solo porque la petición llegó a completarse es justo lo que
         hace que el texto desaparezca sin avisar. */
      const fallidos = pendientes.filter((_, indice) => {
        const resultado = resultados[indice];

        return resultado.status === "rejected" || !resultado.value.ok;
      });

      const porLargo = resultados.some(
        (r) => r.status === "fulfilled" && !r.value.ok && r.value.largo,
      );

      /* Lo que sí ha llegado se apunta, para que una recarga no enseñe el
         CSV de antes. */
      anotaEscritas(
        ESPACIO_ESCRITAS,
        Object.fromEntries(
          pendientes
            .filter((p) => !fallidos.includes(p))
            .map((p) => [String(p.ID), p.CONTENIDO]),
        ),
      );

      if (fallidos.length > 0) {
        const campos = Object.fromEntries(
          fallidos.map((p) => [
            `${p.SECCION} · ${p.TITULO || p.ID}`,
            p.CONTENIDO,
          ]),
        );

        /* El autoguardado reintenta solo: el aviso sale una vez por fallo
           distinto, no en cada reintento ni en cada tecla (07/10/2026). Se
           mira qué contenidos fallan, no lo que dicen. */
        const huella = JSON.stringify(Object.keys(campos).sort());

        if (rechazoAvisado.current !== huella) {
          rechazoAvisado.current = huella;

          reportarRechazo({
            titulo: "Valores de equipo · cambios sin guardar",
            campos,
          });

          if (porLargo) {
            toast.error(AVISO_TEXTO_LARGO.titulo, {
              description: AVISO_TEXTO_LARGO.descripcion,
              duration: 12000,
            });
          }
        }

        return false;
      }

      rechazoAvisado.current = null;

      /* La copia de la hoja en esta pestaña ya no vale: sin tirarla, al
         volver a la pantalla se leía el texto de antes, y la siguiente
         edición partía de él y machacaba lo guardado. */
      olvidaCsv(CSV_URL);

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
            aria-label="Etapas de la hoja de ruta de la cultura"
            className="w-full border-white/10 p-4 lg:w-[300px] lg:shrink-0 lg:border-r lg:p-6 xl:w-[340px]"
          >
            <SectionLabel className="text-[#C8A96B]">
              Hoja de ruta de la cultura
            </SectionLabel>

            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Buscar valor o conducta…"
              label="Buscar en los contenidos culturales"
              className={cn("mt-4", editing && "pointer-events-none opacity-40")}
            />

            {/*
            | 30/10/2026: una sola navegación. Se quitan los pasos 1-6 de
            | arriba y el «Etapa 1 de 6»; en el móvil la tira cortaba los
            | nombres («Se…») y ahora es una rejilla de dos columnas con el
            | nombre entero y cuántos contenidos tiene cada etapa.
            */}
            <nav className="mt-4 grid grid-cols-2 gap-2 lg:mt-5 lg:grid-cols-1">
              {secciones.map((s, i) => {
                const total = visibles.filter((r) => r.SECCION === s).length;
                const activa = s === seccion;

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => irASeccion(s)}
                    aria-current={activa ? "true" : undefined}
                    className={cn(
                      "flex min-w-0 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-all lg:rounded-2xl lg:px-4 lg:py-3",
                      focusRing,
                      activa
                        ? "bg-[#C8A96B] text-black shadow-[0_8px_24px_-12px_rgba(200,169,107,0.9)]"
                        : "border border-white/10 text-gray-200 hover:border-[#C8A96B]/40 hover:bg-white/[0.04] hover:text-white",
                      filtrando && total === 0 && !activa && "opacity-40",
                    )}
                  >
                    <span className="min-w-0 break-words text-sm font-medium leading-snug">
                      {rotuloSeccion(s)}
                    </span>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        activa ? "text-black/70" : "text-gray-400",
                      )}
                    >
                      Etapa {i + 1} · {total} contenido{total === 1 ? "" : "s"}
                    </span>
                  </button>
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

          {/* pr-12 por debajo de lg (29/10/2026, marketing): el ⋮ flotante del
              menú de herramientas tapaba el final de las líneas de las tarjetas.
              30/10/2026: y pb-24, para que tampoco tape la última. */}
          <main
            className={cn(
              "min-w-0 flex-1 p-4 pr-12 pb-24 lg:p-8 lg:pb-24",
              editing && "pb-32 lg:pb-32",
            )}
          >
            {/* Resultado del proceso: los valores votados (30/10/2026). */}
            {VALORES_VOTADOS.length > 0 && (
              <Link
                href="/identidad-cultura"
                className={cn(
                  "block rounded-2xl border border-[#C8A96B]/40 bg-[#C8A96B]/[0.07] p-4 transition-colors hover:border-[#C8A96B]/70 lg:rounded-3xl lg:p-5",
                  focusRing,
                )}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[#C8A96B]">
                    Lo que votó la plantilla: {VALORES_VOTADOS.length} valores
                  </span>
                  <span className="text-xs font-medium text-[#C8A96B]">
                    Ver el documento →
                  </span>
                </span>

                <span className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {VALORES_VOTADOS.map((v) => (
                    <span key={v.numero} className="flex min-w-0 items-baseline gap-2 text-sm">
                      <span className="font-semibold tabular-nums text-[#C8A96B]">
                        {v.numero}
                      </span>
                      <span className="min-w-0">
                        <span className="font-semibold text-white">{v.titulo}</span>{" "}
                        <span className="text-gray-400">· {v.votos.replace(/^Votado por /, "")}</span>
                      </span>
                    </span>
                  ))}
                </span>
              </Link>
            )}

            {/* Título + acciones */}
            <div className="mt-6 flex flex-row items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                  {seccion ? rotuloSeccion(seccion) : ""}
                </h1>

                {fechaEtapa && (
                  <p className="mt-2 text-sm font-medium text-[#C8A96B]">
                    {fechaEtapa}
                  </p>
                )}

                <p className="mt-3 max-w-2xl text-sm text-gray-400 lg:text-base">
                  {DESCRIPCIONES[seccion] ??
                    (seccion ? DESCRIPCION_POR_DEFECTO : "")}
                </p>
              </div>

              {!editing && !loading && !error && toolbar}
            </div>

            {/* Filtros por tipo */}
            {!editing && tipos.length > 1 && (
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
                        ? `«${rotuloSeccion(seccion)}» tiene ${totalSeccion} contenidos, pero ninguno coincide con el filtro. Prueba en otra etapa del rail izquierdo.`
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
                    hint="Añádelos desde la hoja de cálculo de la hoja de ruta de la cultura."
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
                                <Highlight text={tituloElemento(p.TITULO)} query={query} />
                              </h3>

                              {p.TIPO && tipos.length > 1 && (
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
                              <>
                                <AutoTextarea
                                  value={p.CONTENIDO}
                                  aria-label={`Contenido de ${tituloElemento(p.TITULO)}`}
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
                                <AvisoLargo texto={p.CONTENIDO} />
                              </>
                            ) : (
                              <>
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300 lg:text-base">
                                  <Highlight text={p.CONTENIDO} query={query} />
                                </p>

                                {/* Ficha de la dinámica: sólo lo que la hoja traiga. */}
                                {(limpio(p.DURACION) || limpio(p.MATERIAL) || limpio(p.ENTREGA)) && (
                                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                                    {([
                                      ["Duración", p.DURACION],
                                      ["Material", p.MATERIAL],
                                      ["Entrega el vestuario", p.ENTREGA],
                                    ] as const)
                                      .filter(([, v]) => limpio(v))
                                      .map(([k, v]) => (
                                        <div key={k} className="min-w-0">
                                          <dt className="text-xs text-gray-500">{k}</dt>
                                          <dd className="break-words text-gray-200">{limpio(v)}</dd>
                                        </div>
                                      ))}
                                  </dl>
                                )}
                              </>
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
                  <span className="truncate">
                    {rotuloSeccion(secciones[etapaIndex - 1] ?? "")}
                  </span>
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
                  <span className="truncate">
                    {rotuloSeccion(secciones[etapaIndex + 1] ?? "")}
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
