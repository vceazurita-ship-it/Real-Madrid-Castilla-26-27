"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Film,
  ListVideo,
  Loader2,
  MapPin,
  Pencil,
  Save,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

type Rival = Record<string, string>;

type FieldDef = {
  titulo: string;
  campo: string;
  ayuda?: string;
  ancho?: boolean;
  rows?: number;
};

type BlockDef = {
  titulo: string;
  campos: FieldDef[];
};

type SectionDef = {
  id: string;
  titulo: string;
  subtitulo: string;
  accent: string;
  bloques: BlockDef[];
};

/* Toda la estructura del informe vive aquí: añadir un campo es añadir una
   línea, y la maquetación (rejillas, cabeceras, ayudas de edición) se deriva
   automáticamente. */
const SECTIONS: SectionDef[] = [
  {
    id: "ofensivo",
    titulo: "Fase ofensiva",
    subtitulo: "Cómo construye y ataca el rival",
    accent: "#E2483D",
    bloques: [
      {
        titulo: "Reinicios ofensivos",
        campos: [
          {
            titulo: "Situaciones en rombo",
            campo: "OF_REINICIO_ROMBO",
            ayuda: "Situaciones en rombo",
          },
          {
            titulo: "Referencia partido ida",
            campo: "OF_REINICIO_REFERENCIA_PARTIDO",
            ayuda: "Referencia partido ida",
          },
          {
            titulo: "Referencias determinantes",
            campo: "OF_REINICIO_REFERENCIAS",
            ayuda: "Referencias determinantes",
          },
          {
            titulo: "Equipo presionante",
            campo: "OF_REINICIO_EQUIPO_PRESIONANTE",
            ayuda: "Equipo presionante",
          },
          {
            titulo: "Contextualización",
            campo: "OF_REINICIO_CONTEXTO",
            ayuda: "Contextualización",
          },
          {
            titulo: "Cerrado",
            campo: "OF_REINICIO_CERRADO",
            ayuda: "Cerrado",
          },
        ],
      },
      {
        titulo: "Inicios · Progresión",
        campos: [
          {
            titulo: "Estructura",
            campo: "OF_INICIO_ESTRUCTURA",
            ayuda: "Estructura",
          },
          {
            titulo: "Central con mayor y menor capacidad",
            campo: "OF_INICIO_CENTRAL_CAPACIDAD",
            ayuda: "Central con mayor y menor capacidad",
          },
          {
            titulo: "Capacidad para jugar al espacio",
            campo: "OF_INICIO_JUGAR_ESPACIO",
            ayuda: "Capacidad para jugar al espacio",
          },
          {
            titulo: "Jugador débil por dentro",
            campo: "OF_INICIO_JUGADOR_DEBIL_DENTRO",
            ayuda: "Jugador débil por dentro",
          },
          {
            titulo: "Capacidad para asociarse por dentro",
            campo: "OF_INICIO_ASOCIACIONES",
            ayuda: "Capacidad para asociarse por dentro",
            ancho: true,
          },
        ],
      },
      {
        titulo: "Campo contrario",
        campos: [
          {
            titulo: "Estructura general",
            campo: "OF_CAMPO_ESTRUCTURA",
            ayuda: "Estructura general",
          },
          {
            titulo: "Carril exterior",
            campo: "OF_CAMPO_CARRIL_EXTERIOR",
            ayuda: "Carril exterior",
          },
          {
            titulo: "Jugadores por dentro",
            campo: "OF_CAMPO_JUGADORES_DENTRO",
            ayuda: "Jugadores por dentro",
            ancho: true,
          },
        ],
      },
      {
        titulo: "Finalización · Área rival",
        campos: [
          {
            titulo: "Jugadores que atacan el área",
            campo: "OF_AREA_JUGADORES",
            ayuda: "Jugadores que atacan el área",
          },
          {
            titulo: "Tipos de centros",
            campo: "OF_AREA_CENTROS",
            ayuda: "Tipos de centros",
          },
        ],
      },
      {
        titulo: "Transición defensiva",
        campos: [
          {
            titulo: "Estructura compensadora",
            campo: "TRANSICION_DEF_ESTRUCTURA",
            ayuda: "Estructura compensadora",
          },
          {
            titulo: "Dificultades espalda",
            campo: "TRANSICION_DEF_DIFICULTADES_ESPALDA",
            ayuda: "Dificultades espalda",
          },
          {
            titulo: "Primera intención tras pérdida",
            campo: "TRANSICION_DEF_PRIMERA_INTENCION",
            ayuda: "Primera intención tras pérdida",
            ancho: true,
          },
        ],
      },
    ],
  },
  {
    id: "defensivo",
    titulo: "Fase defensiva",
    subtitulo: "Cómo presiona y defiende el rival",
    accent: "#3B7DE8",
    bloques: [
      {
        titulo: "Reinicios defensivos",
        campos: [
          {
            titulo: "Emparejamientos",
            campo: "DEF_REINICIO_EMPAREJAN",
            ayuda: "Emparejamientos",
          },
          {
            titulo: "Orientaciones",
            campo: "DEF_REINICIO_ORIENTAN",
            ayuda: "Orientaciones",
          },
          {
            titulo: "Activos en presión",
            campo: "DEF_REINICIO_ACTIVOS_PRESION",
            ayuda: "Activos en presión",
          },
          {
            titulo: "Jugadores débiles",
            campo: "DEF_REINICIO_JUGADORES_DEBILES",
            ayuda: "Jugadores débiles",
          },
        ],
      },
      {
        titulo: "Bloque alto",
        campos: [
          {
            titulo: "Estructura",
            campo: "DEF_BLOQUE_ALTO_ESTRUCTURA",
            ayuda: "Estructura",
          },
          {
            titulo: "Trayectoria de acoso",
            campo: "DEF_BLOQUE_ALTO_TRAYECTORIA_ACOSO",
            ayuda: "Trayectoria de acoso",
          },
          {
            titulo: "Saltos pares / impares",
            campo: "DEF_BLOQUE_ALTO_SALTOS_PARES_IMPARES",
            ayuda: "Saltos pares/impares",
          },
          {
            titulo: "Distancias",
            campo: "DEF_BLOQUE_ALTO_DISTANCIAS",
            ayuda: "Distancias",
          },
          {
            titulo: "Defensa espalda",
            campo: "DEF_BLOQUE_ALTO_ESPALDA",
            ayuda: "Defensa espalda",
            ancho: true,
          },
        ],
      },
      {
        titulo: "Bloque medio",
        campos: [
          {
            titulo: "Estructura",
            campo: "DEF_BLOQUE_MEDIO_ESTRUCTURA",
            ayuda: "Estructura",
          },
          {
            titulo: "Fusionan línea",
            campo: "DEF_BLOQUE_MEDIO_FUSIONAN_LINEA",
            ayuda: "Fusionan línea",
          },
          {
            titulo: "Quién defiende cortes",
            campo: "DEF_BLOQUE_MEDIO_CORTES",
            ayuda: "Quién defiende cortes",
          },
          {
            titulo: "Distancias",
            campo: "DEF_BLOQUE_MEDIO_DISTANCIAS",
            ayuda: "Distancias",
          },
          {
            titulo: "Centrales saltadores",
            campo: "DEF_BLOQUE_MEDIO_CENTRALES_SALTADORES",
            ayuda: "Centrales saltadores",
          },
          {
            titulo: "Defensa espalda",
            campo: "DEF_BLOQUE_MEDIO_ESPALDA",
            ayuda: "Defensa espalda",
          },
        ],
      },
      {
        titulo: "Defensa de área",
        campos: [
          {
            titulo: "Se hunde la línea",
            campo: "DEF_AREA_HUNDE_LINEA",
            ayuda: "Se hunde la línea",
          },
          {
            titulo: "Defensa punto penalti",
            campo: "DEF_AREA_PUNTO_PENALTI",
            ayuda: "Defensa punto penalti",
          },
          {
            titulo: "Jugador débil",
            campo: "DEF_AREA_JUGADOR_DEBIL",
            ayuda: "Jugador débil",
            ancho: true,
          },
        ],
      },
    ],
  },
];

/* Bloque final: texto largo, una columna por tarjeta. */
const CONCLUSIONES: FieldDef[] = [
  { titulo: "Jugadores clave", campo: "JUGADORES_CLAVE", rows: 8 },
  { titulo: "Fortalezas individuales", campo: "FORTALEZAS_INDIVIDUALES", rows: 8 },
  { titulo: "Debilidades individuales", campo: "DEBILIDADES_INDIVIDUALES", rows: 8 },
  { titulo: "Estado del equipo", campo: "ESTADO_EQUIPO", rows: 8 },
  { titulo: "Claves del partido", campo: "CLAVES_PARTIDO", rows: 8 },
  { titulo: "Plan de partido", campo: "PLAN_PARTIDO", rows: 8 },
  { titulo: "Claves emocionales", campo: "CLAVES_EMOCIONALES", rows: 8 },
  { titulo: "Observaciones", campo: "OBSERVACIONES", rows: 10, ancho: true },
];

const ALL_FIELDS = [
  ...SECTIONS.flatMap((s) => s.bloques.flatMap((b) => b.campos)),
  ...CONCLUSIONES,
];

const NAV = [
  { id: "datos", label: "Datos y recursos" },
  { id: "ofensivo", label: "Fase ofensiva" },
  { id: "defensivo", label: "Fase defensiva" },
  { id: "conclusiones", label: "Conclusiones" },
];

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export default function ScoutRivalCollective() {
  const [rivales, setRivales] = useState<Rival[]>([]);
  const [rivalActivo, setRivalActivo] = useState<Rival | null>(null);

  /* Copia previa a la edición: permite cancelar sin perder el informe. */
  const [snapshot, setSnapshot] = useState<Rival | null>(null);

  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${ENDPOINT}?action=rivales`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data: Rival[]) => {
        if (cancelled) return;

        setRivales(data);
        setRivalActivo(data.length ? data[0] : null);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setCargando(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const indice = useMemo(
    () =>
      rivalActivo
        ? rivales.findIndex((r) => String(r.ID) === String(rivalActivo.ID))
        : -1,
    [rivales, rivalActivo]
  );

  /* Cuántos campos del informe están rellenos: da sensación de progreso. */
  const completados = useMemo(() => {
    if (!rivalActivo) return 0;

    return ALL_FIELDS.filter((f) => String(rivalActivo[f.campo] ?? "").trim())
      .length;
  }, [rivalActivo]);

  const cambiarRival = useCallback(
    (rival: Rival | undefined) => {
      if (!rival) return;

      if (modoEdicion) {
        toast.error("Guarda o cancela los cambios antes de cambiar de rival");
        return;
      }

      setRivalActivo(rival);
    },
    [modoEdicion]
  );

  const setCampo = useCallback((campo: string, valor: string) => {
    setRivalActivo((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }, []);

  const empezarEdicion = () => {
    setSnapshot(rivalActivo ? { ...rivalActivo } : null);
    setModoEdicion(true);
  };

  const cancelarEdicion = () => {
    if (snapshot) setRivalActivo(snapshot);

    setSnapshot(null);
    setModoEdicion(false);
  };

  const guardarRival = async () => {
    if (!rivalActivo) return;

    setGuardando(true);

    const toastId = toast.loading("Guardando informe…");

    try {
      const body = new URLSearchParams();

      body.append("action", "guardarRival");

      Object.entries(rivalActivo).forEach(([key, value]) => {
        body.append(key, String(value ?? ""));
      });

      const res = await fetch(ENDPOINT, { method: "POST", body });
      const data = await res.json();

      if (data.success) {
        toast.success("Informe guardado correctamente", { id: toastId });

        setSnapshot(null);
        setModoEdicion(false);
      } else {
        toast.error(data.error || "El servidor rechazó el guardado", {
          id: toastId,
        });
      }
    } catch (e) {
      console.error("[scout] guardar", e);
      toast.error("No se pudo guardar el informe", { id: toastId });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="px-4 pb-16 pt-6 sm:px-6 lg:px-10">
          {/* ------------------------------------------------ Cabecera */}
          <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                Scouting colectivo
              </p>

              <h1 className="mt-2 truncate text-4xl font-black tracking-tight sm:text-5xl">
                {cargando ? "Cargando…" : rivalActivo?.EQUIPO || "Sin rival"}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/45">
                <span>Informe del rival</span>

                {rivalActivo && (
                  <span className="tabular-nums">
                    {completados}/{ALL_FIELDS.length} campos completados
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3" data-export-hide>
              <Link
                href="/match-plans"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                <ClipboardList size={16} />
                Plan de partido
              </Link>

              {modoEdicion ? (
                <>
                  <button
                    disabled={guardando}
                    onClick={guardarRival}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-70"
                  >
                    {guardando ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {guardando ? "Guardando…" : "Guardar"}
                  </button>

                  <button
                    disabled={guardando}
                    onClick={cancelarEdicion}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                  >
                    <Undo2 size={16} />
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  disabled={!rivalActivo}
                  onClick={empezarEdicion}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#C8A96B]/40 px-5 py-3 text-sm font-semibold text-[#E4C977] transition hover:border-[#C8A96B] hover:bg-[#C8A96B]/10 disabled:opacity-40"
                >
                  <Pencil size={16} />
                  Editar
                </button>
              )}
            </div>
          </header>

          {/* --------------------------------------- Navegación interna */}
          <nav
            data-export-hide
            className="mb-6 flex flex-wrap gap-2 border-y border-white/5 py-3"
          >
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-white/55 transition hover:border-[#C8A96B]/40 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-5 py-4 text-sm text-white/80">
              No se ha podido cargar la lista de rivales. Comprueba la conexión
              con la hoja de cálculo.
            </div>
          )}

          {modoEdicion && (
            <div
              data-export-hide
              className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-5 py-3 text-sm text-amber-200"
            >
              <Pencil size={15} className="shrink-0" />
              Modo edición activo. Los cambios no se guardan hasta pulsar
              «Guardar».
            </div>
          )}

          {/* ----------------------------------- Selector + datos clave */}
          <section id="datos" className="scroll-mt-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row" data-export-hide>
              <button
                aria-label="Rival anterior"
                disabled={indice <= 0}
                onClick={() => cambiarRival(rivales[indice - 1])}
                className="flex h-[56px] w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#111827] text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>

              <select
                aria-label="Seleccionar rival"
                value={rivalActivo?.ID ?? ""}
                onChange={(e) =>
                  cambiarRival(
                    rivales.find((r) => String(r.ID) === e.target.value)
                  )
                }
                className="h-[56px] w-full rounded-2xl border border-white/10 bg-[#111827] px-4 text-base font-semibold text-white shadow-lg outline-none transition focus:border-[#C8A96B]/60"
              >
                {rivales.length === 0 && (
                  <option value="">
                    {cargando ? "Cargando rivales…" : "Sin rivales"}
                  </option>
                )}

                {rivales.map((r) => (
                  <option key={r.ID} value={r.ID}>
                    J{r.JORNADA} · {r.EQUIPO}
                  </option>
                ))}
              </select>

              <button
                aria-label="Rival siguiente"
                disabled={indice < 0 || indice >= rivales.length - 1}
                onClick={() => cambiarRival(rivales[indice + 1])}
                className="flex h-[56px] w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#111827] text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DatoClave
                icon={CalendarDays}
                label="Jornada"
                valor={rivalActivo?.JORNADA}
                editando={modoEdicion}
                onChange={(v) => setCampo("JORNADA", v)}
              />

              <DatoClave
                icon={CalendarDays}
                label="Fecha"
                valor={rivalActivo?.FECHA}
                mostrar={formatDate(rivalActivo?.FECHA)}
                editando={modoEdicion}
                onChange={(v) => setCampo("FECHA", v)}
              />

              <DatoClave
                icon={MapPin}
                label="Local / Visitante"
                valor={rivalActivo?.LOCAL_VISITANTE}
                editando={modoEdicion}
                onChange={(v) => setCampo("LOCAL_VISITANTE", v)}
              />
            </div>

            {/* Recursos */}
            <div className="mt-4 rounded-3xl border border-[#C8A96B]/15 bg-[#111827] p-5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-[#C8A96B]">
                Recursos
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Recurso
                  icon={Film}
                  label="Vídeo"
                  cta="Ver vídeo"
                  url={rivalActivo?.VIDEO}
                  editando={modoEdicion}
                  onChange={(v) => setCampo("VIDEO", v)}
                />

                <Recurso
                  icon={FileText}
                  label="Documento"
                  cta="Abrir informe"
                  url={rivalActivo?.DOC}
                  editando={modoEdicion}
                  onChange={(v) => setCampo("DOC", v)}
                />

                <Recurso
                  icon={ListVideo}
                  label="HUDL Playlist"
                  cta="Abrir playlist"
                  url={rivalActivo?.HUDL_PLAYLIST}
                  editando={modoEdicion}
                  onChange={(v) => setCampo("HUDL_PLAYLIST", v)}
                />

                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
                    <ClipboardList size={13} />
                    Plan de partido
                  </p>

                  <Link
                    href="/match-plans"
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-5 py-2.5 text-sm font-semibold text-[#E4C977] transition hover:border-[#C8A96B] hover:bg-[#C8A96B]/20"
                  >
                    Abrir plan
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------------------ Bases de juego */}
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="mt-12 scroll-mt-6"
            >
              <div
                className="flex flex-col gap-1 rounded-2xl border-l-4 bg-white/[0.03] px-5 py-4"
                style={{
                  borderLeftColor: section.accent,
                  background: `linear-gradient(90deg, ${section.accent}22, transparent 60%)`,
                }}
              >
                <h2 className="text-2xl font-bold tracking-tight">
                  {section.titulo}
                </h2>

                <p className="text-sm text-white/50">{section.subtitulo}</p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                {section.bloques.map((bloque) => (
                  <div
                    key={bloque.titulo}
                    className="rounded-3xl border border-white/5 bg-[#0E141C] p-4 sm:p-5"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: section.accent }}
                      />

                      <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white/85">
                        {bloque.titulo}
                      </h3>

                      <span className="h-px flex-1 bg-white/10" />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {bloque.campos.map((field) => (
                        <Campo
                          key={field.campo}
                          field={field}
                          valor={rivalActivo?.[field.campo]}
                          editando={modoEdicion}
                          accent={section.accent}
                          onChange={(v) => setCampo(field.campo, v)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* ------------------------------------------- Conclusiones */}
          <section id="conclusiones" className="mt-12 scroll-mt-6">
            <div
              className="flex flex-col gap-1 rounded-2xl border-l-4 bg-white/[0.03] px-5 py-4"
              style={{
                borderLeftColor: "#C8A96B",
                background: "linear-gradient(90deg, #C8A96B22, transparent 60%)",
              }}
            >
              <h2 className="text-2xl font-bold tracking-tight">
                Conclusiones y plan
              </h2>

              <p className="text-sm text-white/50">
                Lectura individual, claves del partido y mensaje al grupo
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {CONCLUSIONES.map((field) => (
                <Campo
                  key={field.campo}
                  field={field}
                  valor={rivalActivo?.[field.campo]}
                  editando={modoEdicion}
                  accent="#C8A96B"
                  destacado
                  onChange={(v) => setCampo(field.campo, v)}
                />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DatoClave({
  icon: Icon,
  label,
  valor,
  mostrar,
  editando,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  valor?: string;
  mostrar?: string;
  editando: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/5 bg-[#111827] p-5 shadow-lg transition-colors hover:border-[#C8A96B]/30">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
        <Icon size={13} />
        {label}
      </p>

      {editando ? (
        <input
          aria-label={label}
          value={valor ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-xl border border-amber-400/30 bg-[#0B0F14] p-2 text-white outline-none focus:border-amber-400"
        />
      ) : (
        <p className="mt-2 text-xl font-bold">{mostrar ?? valor ?? "—"}</p>
      )}
    </div>
  );
}

function Recurso({
  icon: Icon,
  label,
  cta,
  url,
  editando,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  cta: string;
  url?: string;
  editando: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
        <Icon size={13} />
        {label}
      </p>

      {editando ? (
        <input
          aria-label={label}
          value={url ?? ""}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-amber-400/30 bg-[#0B0F14] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-400"
        />
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-5 py-2.5 text-sm font-semibold text-[#E4C977] transition hover:border-[#C8A96B] hover:bg-[#C8A96B]/20"
        >
          {cta}
        </a>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/10 px-5 py-2.5 text-sm text-white/25">
          Sin enlace
        </p>
      )}
    </div>
  );
}

function Campo({
  field,
  valor,
  editando,
  accent,
  destacado = false,
  onChange,
}: {
  field: FieldDef;
  valor?: string;
  editando: boolean;
  accent: string;
  destacado?: boolean;
  onChange: (value: string) => void;
}) {
  const contenido = String(valor ?? "").trim();
  const vacio = contenido.length === 0;

  return (
    <div
      className={`rounded-2xl border bg-[#111827] p-4 transition-colors ${
        field.ancho ? "sm:col-span-2" : ""
      } ${destacado ? "min-h-[190px]" : "min-h-[120px]"} ${
        editando
          ? "border-amber-400/60"
          : vacio
            ? "border-white/5"
            : "border-white/10"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: editando ? "#FBBF24" : accent }}
        >
          {field.titulo}
        </p>

        {!editando && vacio && (
          <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/25">
            Vacío
          </span>
        )}
      </div>

      {editando && (
        <div className="mb-2 flex flex-wrap items-center gap-2" data-export-hide>
          <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
            {field.campo}
          </span>

          {field.ayuda && (
            <span className="text-[11px] text-white/35">{field.ayuda}</span>
          )}
        </div>
      )}

      {editando ? (
        <textarea
          aria-label={field.titulo}
          rows={field.rows ?? 4}
          value={valor ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-xl border border-amber-400/30 bg-black/40 p-3 text-sm leading-6 text-white outline-none focus:border-amber-400"
        />
      ) : (
        <p
          className={`whitespace-pre-wrap text-sm leading-6 ${
            vacio ? "text-white/20" : "text-white/80"
          }`}
        >
          {vacio ? "Sin información" : contenido}
        </p>
      )}
    </div>
  );
}
