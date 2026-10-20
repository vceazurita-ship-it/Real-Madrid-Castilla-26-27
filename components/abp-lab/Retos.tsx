"use client";

/**
 * Pestaña «Retos»: la competición de balón parado de la plantilla.
 *
 * Dos clases de reto:
 * - **Precisión**: lo que se hace en el campo («centros al punto de
 *   penalti, de 10»). El cuerpo técnico apunta la marca de cada uno.
 * - **Preguntas**: lectura de jugada y cultura de ABP, en modo proyector
 *   para el vestuario. Se marca quién acertó cada pregunta.
 *
 * La clasificación, las rachas y las insignias salen solas de
 * `lib/abp-lab/modelo.ts` (`clasificacion`). Hoy lo maneja sólo el
 * administrador; el interruptor deja preparada la apertura a los jugadores.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Eye,
  Flame,
  Lock,
  LockOpen,
  Plus,
  Presentation,
  Save,
  Sparkles,
  Target,
  Timer,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Dialog, EmptyState, Field, Panel, TextArea, sePuedeDescartar } from "@/components/abp/ui";
import { iniciales, type JugadorLab } from "@/components/abp-lab/comun";
import type { GuardaLab } from "@/hooks/useAbpLab";
import {
  BANCO,
  INSIGNIAS,
  clasificacion,
  puntosEn,
  puntosMaximos,
  type DocumentoLab,
  type Fila,
  type Pregunta,
  type Reto,
  type TipoReto,
} from "@/lib/abp-lab/modelo";

const avisa = (error: unknown) => toast.error(error instanceof Error ? error.message : "No se ha podido guardar");

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/* ------------------------------------------------------------------ */
/*  LA CARA DE UN JUGADOR                                              */
/* ------------------------------------------------------------------ */

function Cara({ jugador, tam = 40, anillo = false }: { jugador?: JugadorLab; tam?: number; anillo?: boolean }) {
  const [rota, setRota] = useState(false);

  const nombre = jugador?.nombre ?? "?";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 font-bold text-white/70 ${anillo ? "ring-2 ring-[#C8A96B]" : ""}`}
      style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.34) }}
    >
      {jugador?.foto && !rota ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={jugador.foto} alt="" className="h-full w-full object-cover object-top" onError={() => setRota(true)} />
      ) : (
        iniciales(nombre)
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  EL PODIO                                                           */
/* ------------------------------------------------------------------ */

const ALTO_PODIO = [150, 112, 84];

function Podio({ filas, porId }: { filas: Fila[]; porId: Map<string, JugadorLab> }) {
  const tres = filas.slice(0, 3);

  /* Orden de podio: 2.º, 1.º, 3.º. */
  const orden = [tres[1], tres[0], tres[2]].map((f, i) => ({ f, puesto: [2, 1, 3][i] })).filter((x) => x.f);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-4 pb-0 pt-6 sm:px-8">
      <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-[28rem] max-w-full -translate-x-1/2 rounded-full bg-[#C8A96B]/15 blur-3xl" />
      <p className="relative text-center text-[10px] uppercase tracking-[0.32em] text-[#C8A96B]">Clasificación de balón parado</p>

      <div className="relative mt-5 flex items-end justify-center gap-2 sm:gap-5">
        {orden.map(({ f, puesto }, i) => {
          const jugador = porId.get(f.jugador);

          const oro = puesto === 1;

          return (
            <div key={f.jugador} className="flex w-[30%] max-w-[170px] min-w-0 flex-col items-center">
              <div className="lab-aparece flex flex-col items-center" style={{ animationDelay: `${300 + i * 150}ms` }}>
                {oro && <Trophy size={22} className="mb-1 text-[#C8A96B]" />}
                <Cara jugador={jugador} tam={oro ? 72 : 56} anillo={oro} />
                <p className="mt-2 max-w-full truncate text-center text-[13px] font-semibold text-white">{jugador?.nombre ?? f.jugador}</p>
                <p className="tabular-nums text-xl font-bold text-[#C8A96B]">{f.puntos}</p>
                {f.racha >= 2 && (
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                    <Flame size={12} />
                    {f.racha} seguidos
                  </p>
                )}
              </div>
              <div
                className="lab-sube mt-2 flex w-full items-start justify-center rounded-t-2xl border border-b-0 border-white/10 pt-2"
                style={{
                  height: ALTO_PODIO[puesto - 1],
                  animationDelay: `${i * 120}ms`,
                  background: oro
                    ? "linear-gradient(180deg, color-mix(in srgb, var(--rmcf-gold-ink) 38%, transparent), color-mix(in srgb, var(--rmcf-gold-ink) 8%, transparent))"
                    : "linear-gradient(180deg, rgb(var(--rmcf-ink-rgb) / .12), rgb(var(--rmcf-ink-rgb) / .03))",
                }}
              >
                <span className="tabular-nums text-3xl font-black text-white/80">{puesto}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LA PESTAÑA                                                         */
/* ------------------------------------------------------------------ */

export function Retos({
  doc,
  jugadores,
  porId,
  guarda,
  ocupado,
}: {
  doc: DocumentoLab;
  jugadores: JugadorLab[];
  porId: Map<string, JugadorLab>;
  guarda: GuardaLab;
  ocupado: boolean;
}) {
  const filas = useMemo(() => clasificacion(doc), [doc]);

  const [editando, setEditando] = useState<Partial<Reto> | null>(null);

  const [marcando, setMarcando] = useState<string | null>(null);

  const [proyectando, setProyectando] = useState<string | null>(null);

  const retos = useMemo(() => [...doc.retos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn)), [doc.retos]);

  const nuevo = (tipo: TipoReto) => {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

    setEditando({ tipo, titulo: "", descripcion: "", fecha: hoy, maximo: 10, puntos: tipo === "quiz" ? 3 : 1, preguntas: [] });
  };

  const retoMarcando = doc.retos.find((r) => r.id === marcando) ?? null;

  const retoProyectando = doc.retos.find((r) => r.id === proyectando) ?? null;

  return (
    <div className="space-y-5">
      {/* ------------------------ INTERRUPTOR ----------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {doc.abiertoJugadores ? <LockOpen size={16} className="shrink-0 text-emerald-300" /> : <Lock size={16} className="shrink-0 text-white/50" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/90">{doc.abiertoJugadores ? "Preparado para abrir a la plantilla" : "Sólo tú lo ves"}</p>
            <p className="text-[11.5px] text-white/45">
              {doc.abiertoJugadores
                ? "Marcado para abrirlo: los jugadores verán la clasificación y los retos abiertos cuando se publique su acceso."
                : "Los retos y la clasificación son privados mientras este interruptor esté apagado."}
            </p>
          </div>
        </div>
        <Button
          aria-pressed={doc.abiertoJugadores}
          disabled={ocupado}
          onClick={() => guarda({ accion: "abierto", valor: !doc.abiertoJugadores }).catch(avisa)}
        >
          {doc.abiertoJugadores ? "Cerrarlo" : "Marcar para abrir"}
        </Button>
      </div>

      {/* ------------------------ PODIO Y TABLA ---------------------------- */}
      {filas.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
          <Podio filas={filas} porId={porId} />

          <Panel title="La tabla" subtitle={`${doc.retos.length} ${doc.retos.length === 1 ? "reto" : "retos"} · ${filas.length} jugadores`} icon={Trophy} bodyClassName="p-0">
            <ol className="divide-y divide-white/5">
              {filas.map((f, i) => {
                const j = porId.get(f.jugador);

                return (
                  <li key={f.jugador} className="lab-aparece flex items-center gap-3 px-4 py-2.5" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                    <span className={`w-6 shrink-0 text-center text-sm font-bold tabular-nums ${i < 3 ? "text-[#C8A96B]" : "text-white/40"}`}>{i + 1}</span>
                    <Cara jugador={j} tam={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-white/90">{j?.nombre ?? f.jugador}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {f.insignias.map((ins) => (
                          <span key={ins.key} title={ins.texto} className="rounded-full bg-[#C8A96B]/15 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-[#C8A96B]">
                            {ins.nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                    {f.racha >= 2 && (
                      <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-amber-300" title={`Mejor racha: ${f.mejorRacha}`}>
                        <Flame size={13} />
                        {f.racha}
                      </span>
                    )}
                    <span className="hidden w-12 shrink-0 text-right text-[11px] tabular-nums text-white/45 sm:block">{Math.round(f.acierto * 100)} %</span>
                    <span className="w-12 shrink-0 text-right text-base font-bold tabular-nums text-white">{f.puntos}</span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-96 max-w-full -translate-x-1/2 rounded-full bg-[#C8A96B]/15 blur-3xl" />
          <Trophy size={34} className="relative mx-auto text-[#C8A96B]" />
          <p className="relative mt-3 text-lg font-semibold text-white">Que empiece la competición</p>
          <p className="relative mx-auto mt-1 max-w-md text-[13px] text-white/55">
            Lanza un reto de precisión en el entrenamiento o unas preguntas de lectura de jugada para el vestuario. El podio, las rachas y las insignias se montan solos.
          </p>
        </div>
      )}

      {/* ------------------------ LOS RETOS -------------------------------- */}
      <Panel
        title="Retos"
        subtitle="Lo que se juega esta semana y lo ya jugado"
        icon={Target}
        action={
          <div className="flex flex-wrap gap-2">
            <Button icon={Crosshair} onClick={() => nuevo("precision")}>
              Reto de precisión
            </Button>
            <Button tone="primary" icon={Sparkles} onClick={() => nuevo("quiz")}>
              Reto de preguntas
            </Button>
          </div>
        }
      >
        {retos.length === 0 ? (
          <EmptyState title="Todavía no hay retos" description="Un reto de precisión se apunta en el campo; uno de preguntas se juega proyectado en el vestuario." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {retos.map((r) => {
              const jugaron = jugadores.filter((j) => puntosEn(r, j.id) !== null).length;

              const mejor = filas.length ? Math.max(0, ...jugadores.map((j) => puntosEn(r, j.id) ?? 0)) : 0;

              return (
                <article key={r.id} className="lab-aparece flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96B]">
                        {r.tipo === "quiz" ? "Preguntas" : "Precisión"} · {fechaCorta(r.fecha)}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">{r.titulo}</p>
                    </div>
                    {r.cerrado ? <Lock size={14} className="shrink-0 text-white/40" /> : <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">En juego</span>}
                  </div>
                  {r.descripcion && <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-white/55">{r.descripcion}</p>}
                  <p className="mt-2 text-[11.5px] text-white/45">
                    {r.tipo === "quiz" ? `${r.preguntas.length} ${r.preguntas.length === 1 ? "pregunta" : "preguntas"}` : `Marca de ${r.maximo}`} · {puntosMaximos(r)} puntos en juego
                    {jugaron ? ` · ${jugaron} ${jugaron === 1 ? "ha jugado" : "han jugado"}` : ""}
                    {mejor ? ` · mejor ${mejor}` : ""}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    {r.tipo === "quiz" ? (
                      <Button tone="primary" icon={Presentation} onClick={() => setProyectando(r.id)}>
                        Proyectar
                      </Button>
                    ) : (
                      <Button tone="primary" icon={Crosshair} onClick={() => setMarcando(r.id)}>
                        Marcas
                      </Button>
                    )}
                    <Button onClick={() => setEditando(r)}>Editar</Button>
                    <Button
                      icon={r.cerrado ? LockOpen : Lock}
                      disabled={ocupado}
                      onClick={() => guarda({ accion: "reto-cierra", id: r.id, cerrado: !r.cerrado }).catch(avisa)}
                    >
                      {r.cerrado ? "Reabrir" : "Cerrar"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ------------------------ INSIGNIAS -------------------------------- */}
      <Panel title="Insignias" subtitle="Se ganan solas con lo que se apunta" icon={Award}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {Object.entries(INSIGNIAS).map(([key, ins]) => {
            const quien = filas.filter((f) => f.insignias.some((x) => x.key === key)).length;

            return (
              <div key={key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#C8A96B]">{ins.nombre}</p>
                <p className="mt-1 text-[12px] leading-snug text-white/60">{ins.texto}</p>
                {quien > 0 && <p className="mt-1.5 text-[11px] text-white/40">{quien === 1 ? "La tiene 1" : `La tienen ${quien}`}</p>}
              </div>
            );
          })}
        </div>
      </Panel>

      {editando && (
        <EditorReto
          key={editando.id ?? `nuevo-${editando.tipo}`}
          inicial={editando}
          ocupado={ocupado}
          onCerrar={() => setEditando(null)}
          onGuardar={async (reto) => {
            try {
              await guarda({ accion: "reto-guarda", reto });
              toast.success("Reto guardado");
              setEditando(null);
            } catch (error) {
              avisa(error);
            }
          }}
          onBorrar={
            editando.id
              ? async () => {
                  if (!window.confirm("¿Borrar el reto con sus marcas? Sus puntos salen de la clasificación.")) return;

                  try {
                    await guarda({ accion: "reto-borra", id: editando.id });
                    setEditando(null);
                  } catch (error) {
                    avisa(error);
                  }
                }
              : undefined
          }
        />
      )}

      {retoMarcando && <Marcas reto={retoMarcando} jugadores={jugadores} guarda={guarda} onCerrar={() => setMarcando(null)} />}

      {retoProyectando && <Proyector reto={retoProyectando} jugadores={jugadores} guarda={guarda} onCerrar={() => setProyectando(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CREAR O EDITAR UN RETO                                             */
/* ------------------------------------------------------------------ */

function EditorReto({
  inicial,
  ocupado,
  onCerrar,
  onGuardar,
  onBorrar,
}: {
  inicial: Partial<Reto>;
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: (r: Partial<Reto>) => void;
  onBorrar?: () => void;
}) {
  const [r, setR] = useState<Partial<Reto>>(inicial);

  const sucio = JSON.stringify(r) !== JSON.stringify(inicial);

  const quiz = r.tipo === "quiz";

  const preguntas = r.preguntas ?? [];

  const ponPregunta = (i: number, cambio: Partial<Pregunta>) => setR((x) => ({ ...x, preguntas: (x.preguntas ?? []).map((p, j) => (j === i ? { ...p, ...cambio } : p)) }));

  const delBanco = BANCO.filter((b) => !preguntas.some((p) => p.id === b.id));

  return (
    <Dialog
      title={inicial.id ? "Editar reto" : quiz ? "Nuevo reto de preguntas" : "Nuevo reto de precisión"}
      subtitle={quiz ? "Lectura de jugada y cultura de balón parado, para proyectar" : "Lo que se mide en el campo: cada acierto suma"}
      onClose={onCerrar}
      sinGuardar={sucio}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {onBorrar && (
              <Button tone="danger" icon={Trash2} onClick={onBorrar} disabled={ocupado}>
                Borrar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button icon={X} onClick={() => sePuedeDescartar(sucio) && onCerrar()}>
              Cancelar
            </Button>
            <Button tone="primary" icon={Save} disabled={!r.titulo?.trim() || !r.fecha || (quiz && !preguntas.length) || ocupado} onClick={() => onGuardar(r)}>
              {ocupado ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field
            label="Título"
            value={r.titulo ?? ""}
            onChange={(v) => setR((x) => ({ ...x, titulo: v }))}
            placeholder={quiz ? "¿Quién lee mejor el córner?" : "Centros al punto de penalti"}
            autoFocus={!inicial.id}
          />
          <Field label="Día" type="date" value={r.fecha ?? ""} onChange={(v) => setR((x) => ({ ...x, fecha: v }))} />
        </div>

        <TextArea
          label="Cómo se juega"
          value={r.descripcion ?? ""}
          onChange={(v) => setR((x) => ({ ...x, descripcion: v }))}
          rows={2}
          placeholder={quiz ? "Cinco preguntas, veinte segundos cada una" : "Diez centros desde la esquina: cuenta el que cae en la zona marcada"}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {!quiz && <Field label="Marca máxima" type="number" min="1" max="100" value={String(r.maximo ?? 10)} onChange={(v) => setR((x) => ({ ...x, maximo: Number(v) }))} />}
          <Field
            label={quiz ? "Puntos por pregunta acertada" : "Puntos por acierto"}
            type="number"
            min="1"
            max="50"
            value={String(r.puntos ?? 1)}
            onChange={(v) => setR((x) => ({ ...x, puntos: Number(v) }))}
          />
        </div>

        {quiz && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">Preguntas</span>
              <Button
                icon={Plus}
                disabled={preguntas.length >= 20}
                onClick={() => setR((x) => ({ ...x, preguntas: [...(x.preguntas ?? []), { id: `p${Date.now().toString(36)}`, enunciado: "", opciones: ["", "", "", ""], correcta: 0 }] }))}
              >
                Pregunta propia
              </Button>
            </div>

            {delBanco.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[11px] text-white/50">Del banco (con su fuente): pulsa para añadir</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {delBanco.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      disabled={preguntas.length >= 20}
                      onClick={() => setR((x) => ({ ...x, preguntas: [...(x.preguntas ?? []), { ...b }] }))}
                      className="max-w-full truncate rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-left text-[11.5px] text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
                    >
                      + {b.enunciado}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {preguntas.map((p, i) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-6 shrink-0 text-center text-sm font-bold text-[#C8A96B]">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <TextArea label="Pregunta" value={p.enunciado} onChange={(v) => ponPregunta(i, { enunciado: v })} rows={2} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {p.opciones.map((o, k) => (
                        <label key={k} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${p.correcta === k ? "border-emerald-400/50 bg-emerald-400/10" : "border-white/10"}`}>
                          <input
                            type="radio"
                            name={`correcta-${p.id}`}
                            checked={p.correcta === k}
                            onChange={() => ponPregunta(i, { correcta: k })}
                            aria-label={`La ${String.fromCharCode(65 + k)} es la buena`}
                          />
                          <span className="text-[11px] font-bold text-white/50">{String.fromCharCode(65 + k)}</span>
                          <input
                            value={o}
                            onChange={(e) => ponPregunta(i, { opciones: p.opciones.map((x, m) => (m === k ? e.target.value : x)) })}
                            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/25"
                            placeholder="Respuesta"
                          />
                        </label>
                      ))}
                    </div>
                    {p.fuente && (
                      <a href={p.fuente.url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-white/40 hover:text-[#C8A96B]">
                        Fuente: {p.fuente.titulo}
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Quitar pregunta"
                    onClick={() => setR((x) => ({ ...x, preguntas: (x.preguntas ?? []).filter((_, j) => j !== i) }))}
                    className="rounded-lg p-1.5 text-white/40 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  LAS MARCAS DE UN RETO DE PRECISIÓN                                 */
/* ------------------------------------------------------------------ */

function Marcas({ reto, jugadores, guarda, onCerrar }: { reto: Reto; jugadores: JugadorLab[]; guarda: GuardaLab; onCerrar: () => void }) {
  const [tecleado, setTecleado] = useState<Record<string, string>>({});

  const manda = (jugador: string) => {
    const v = tecleado[jugador];

    if (v === undefined) return;

    const valor = v.trim() === "" ? null : Number(v);

    if (valor !== null && !Number.isFinite(valor)) return;

    guarda({ accion: "reto-marca", id: reto.id, jugador, valor })
      .then(() => setTecleado((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== jugador))))
      .catch(avisa);
  };

  const orden = [...jugadores].sort((a, b) => (reto.marcas[b.id] ?? -1) - (reto.marcas[a.id] ?? -1));

  return (
    <Dialog
      title={reto.titulo}
      subtitle={`Marca de 0 a ${reto.maximo}. Se guarda al salir de cada casilla; vacía, no jugó.`}
      onClose={onCerrar}
      footer={
        <div className="flex justify-end">
          <Button tone="primary" onClick={onCerrar}>
            Hecho
          </Button>
        </div>
      }
    >
      {reto.cerrado && (
        <p className="mb-3 flex items-center gap-2 text-[12px] text-amber-300">
          <Lock size={13} />
          Está cerrado: reábrelo para cambiar marcas.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {orden.map((j) => {
          const guardada = reto.marcas[j.id];

          const valor = tecleado[j.id] ?? (guardada === undefined ? "" : String(guardada));

          const pct = guardada === undefined ? 0 : guardada / reto.maximo;

          return (
            <label key={j.id} className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
              <span className="absolute inset-y-0 left-0 bg-[#C8A96B]/10 transition-all" style={{ width: `${pct * 100}%` }} />
              <Cara jugador={j} tam={30} />
              <span className="relative min-w-0 flex-1 truncate text-[13px] text-white/85">{j.nombre}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={reto.maximo}
                disabled={reto.cerrado}
                value={valor}
                onChange={(e) => setTecleado((x) => ({ ...x, [j.id]: e.target.value }))}
                onBlur={() => manda(j.id)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="relative w-16 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-right text-sm font-bold tabular-nums text-white outline-none focus:border-[#C8A96B]/60"
                aria-label={`Marca de ${j.nombre}`}
              />
            </label>
          );
        })}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  EL PROYECTOR: PREGUNTAS PARA EL VESTUARIO                          */
/* ------------------------------------------------------------------ */

const SEGUNDOS = 20;

function Cuenta() {
  const [s, setS] = useState(SEGUNDOS);

  /* La clave del componente la reinicia en cada pregunta; el intervalo sólo baja hasta cero. */
  useEffect(() => {
    const t = setInterval(() => setS((x) => Math.max(0, x - 1)), 1000);

    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Timer size={18} className={s <= 5 ? "text-rose-300" : "text-[#C8A96B]"} />
      <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10 sm:w-48">
        <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${(s / SEGUNDOS) * 100}%`, background: s <= 5 ? "#f43f5e" : "var(--rmcf-gold-ink)" }} />
      </div>
      <span className={`w-8 text-right text-lg font-bold tabular-nums ${s <= 5 ? "text-rose-300" : "text-white"}`}>{s}</span>
    </div>
  );
}

function Proyector({ reto, jugadores, guarda, onCerrar }: { reto: Reto; jugadores: JugadorLab[]; guarda: GuardaLab; onCerrar: () => void }) {
  /* -1 = quién juega; 0..n-1 = preguntas; n = final. */
  const [i, setI] = useState(reto.participantes.length ? 0 : -1);

  const [vista, setVista] = useState<"pregunta" | "respuesta">("pregunta");

  const [elegidos, setElegidos] = useState<string[]>(reto.participantes.length ? reto.participantes : jugadores.map((j) => j.id));

  const n = reto.preguntas.length;

  const p = i >= 0 && i < n ? reto.preguntas[i] : null;

  const juegan = jugadores.filter((j) => (reto.participantes.length ? reto.participantes : elegidos).includes(j.id));

  const ir = (k: number) => {
    setI(k);
    setVista("pregunta");
  };

  const empezar = () => {
    guarda({ accion: "reto-participa", id: reto.id, jugadores: elegidos })
      .then(() => ir(0))
      .catch(avisa);
  };

  const marca = (jugador: string, acierta: boolean) => {
    if (!p) return;

    guarda({ accion: "reto-acierto", id: reto.id, pregunta: p.id, jugador, acierta }).catch(avisa);
  };

  /* La clasificación del propio reto, para el final. */
  const tabla = juegan.map((j) => ({ j, pts: puntosEn(reto, j.id) ?? 0 })).sort((a, b) => b.pts - a.pts);

  return (
    <div role="dialog" aria-modal="true" aria-label={reto.titulo} className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-[#0B0F14] text-white">
      <div className="pointer-events-none fixed left-1/2 top-0 h-72 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-[#C8A96B]/10 blur-3xl" />

      <header className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-10">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.32em] text-[#C8A96B]">Reto de balón parado</p>
          <p className="truncate text-lg font-semibold">{reto.titulo}</p>
        </div>
        <div className="flex items-center gap-3">
          {p && vista === "pregunta" && <Cuenta key={`${p.id}-${i}`} />}
          {p && (
            <span className="text-sm tabular-nums text-white/50">
              {i + 1} / {n}
            </span>
          )}
          <Button icon={X} onClick={onCerrar} aria-label="Salir del proyector">
            Salir
          </Button>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-10 sm:px-10">
        {i === -1 && (
          <div className="lab-aparece">
            <p className="flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
              <Users size={26} className="text-[#C8A96B]" />
              ¿Quién juega?
            </p>
            <p className="mt-1 text-white/55">Fallarlo todo también cuenta como jugado.</p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {jugadores.map((j) => {
                const dentro = elegidos.includes(j.id);

                return (
                  <button
                    key={j.id}
                    type="button"
                    aria-pressed={dentro}
                    onClick={() => setElegidos((x) => (dentro ? x.filter((y) => y !== j.id) : [...x, j.id]))}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${dentro ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/10 opacity-50"}`}
                  >
                    <Cara jugador={j} tam={28} />
                    <span className="min-w-0 truncate text-[13px]">{j.nombre}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <Button tone="primary" icon={ChevronRight} disabled={!elegidos.length} onClick={empezar}>
                Empezar ({elegidos.length})
              </Button>
            </div>
          </div>
        )}

        {p && (
          <div key={`${p.id}-${vista}`} className="lab-aparece">
            <p className="text-3xl font-bold leading-tight sm:text-5xl">{p.enunciado}</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {p.opciones.map((o, k) => {
                const buena = vista === "respuesta" && k === p.correcta;

                const mala = vista === "respuesta" && k !== p.correcta;

                return (
                  <div
                    key={k}
                    className={`flex items-center gap-4 rounded-2xl border px-5 py-4 text-lg font-semibold transition-all duration-500 sm:text-2xl ${
                      buena ? "scale-[1.02] border-emerald-400/70 bg-emerald-400/15" : mala ? "border-white/5 opacity-35" : "border-white/15 bg-white/[0.04]"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black ${buena ? "bg-emerald-400/30" : "bg-white/10"}`}>
                      {String.fromCharCode(65 + k)}
                    </span>
                    <span className="min-w-0">{o}</span>
                    {buena && <CheckCircle2 size={26} className="ml-auto shrink-0 text-emerald-300" />}
                  </div>
                );
              })}
            </div>

            {vista === "respuesta" && (
              <>
                {p.explicacion && <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/75">{p.explicacion}</p>}
                {p.fuente && (
                  <a href={p.fuente.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12px] text-white/40 hover:text-[#C8A96B]">
                    {p.fuente.titulo}
                  </a>
                )}

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">¿Quién la acertó? Toca para marcar</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {juegan.map((j) => {
                      const acerto = (reto.aciertos[p.id] ?? []).includes(j.id);

                      return (
                        <button
                          key={j.id}
                          type="button"
                          aria-pressed={acerto}
                          disabled={reto.cerrado}
                          onClick={() => marca(j.id, !acerto)}
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${acerto ? "border-emerald-400/60 bg-emerald-400/15" : "border-white/10 bg-white/[0.02]"}`}
                        >
                          <Cara jugador={j} tam={26} />
                          <span className="min-w-0 truncate text-[13px]">{j.nombre}</span>
                          {acerto && <CheckCircle2 size={15} className="ml-auto shrink-0 text-emerald-300" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
              <Button icon={ChevronLeft} disabled={i === 0} onClick={() => ir(i - 1)}>
                Anterior
              </Button>
              {vista === "pregunta" ? (
                <Button tone="primary" icon={Eye} onClick={() => setVista("respuesta")}>
                  Ver la respuesta
                </Button>
              ) : (
                <Button tone="primary" icon={ChevronRight} onClick={() => ir(i + 1)}>
                  {i + 1 < n ? "Siguiente" : "Ver el podio"}
                </Button>
              )}
            </div>
          </div>
        )}

        {i >= n && n > 0 && (
          <div className="lab-aparece text-center">
            <Trophy size={44} className="mx-auto text-[#C8A96B]" />
            <p className="mt-3 text-4xl font-bold">Así queda</p>
            <ol className="mx-auto mt-6 max-w-xl space-y-2 text-left">
              {tabla.map(({ j, pts }, k) => (
                <li
                  key={j.id}
                  className={`lab-aparece flex items-center gap-3 rounded-2xl border px-4 py-3 ${k === 0 ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/10 bg-white/[0.03]"}`}
                  style={{ animationDelay: `${k * 90}ms` }}
                >
                  <span className={`w-7 text-center text-lg font-black ${k < 3 ? "text-[#C8A96B]" : "text-white/40"}`}>{k + 1}</span>
                  <Cara jugador={j} tam={36} anillo={k === 0} />
                  <span className="min-w-0 flex-1 truncate text-lg font-semibold">{j.nombre}</span>
                  <span className="text-2xl font-black tabular-nums">{pts}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex justify-center gap-2">
              <Button icon={ChevronLeft} onClick={() => ir(n - 1)}>
                Volver
              </Button>
              <Button tone="primary" icon={Lock} onClick={() => guarda({ accion: "reto-cierra", id: reto.id, cerrado: true }).then(onCerrar).catch(avisa)}>
                Cerrar el reto
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
