"use client";

/**
 * ANÁLISIS DE ENTRENAMIENTO (16/10/2026, en obras: sólo el administrador; el
 * candado está en app/obras/layout.tsx).
 *
 * Se elige el día, se definen objetivos —uno o varios jugadores, qué se
 * busca, cómo reconocerlos en el vídeo y qué es correcto o mejorable— y se
 * pide el análisis al ordenador del club (encargo `entreno`). Vuelve con las
 * acciones de cada objetivo, su veredicto y clips de ejemplo; el analista
 * valida o corrige cada una y los números salen de lo validado. El modelo,
 * en lib/entreno/modelo.ts; el análisis, en scripts/entreno/analiza-entreno.mjs.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, HardHat, Loader2, Play, Plus, RefreshCw, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AbpHeader, Button, EmptyState, Notice } from "@/components/abp/ui";
import { SeleccionJugadores } from "@/components/seguimiento/SeleccionJugadores";
import { Explicativo } from "@/components/ui/textos-analisis";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { usePlayers } from "@/hooks/usePlayers";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  KIND_ENTRENO,
  SESION_VACIA,
  claveAnalisis,
  claveSesion,
  cuentas,
  huellaObjetivo,
  mmss,
  normalizaSesion,
  nuevoId,
  veredictoFinal,
  type AnalisisEntreno,
  type ObjetivoEntreno,
  type SesionEntreno,
  type Validacion,
} from "@/lib/entreno/modelo";
import { estadoEncargo, type Encargo } from "@/lib/mantenimiento";

const hoy = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Los días de la semana de una fecha (lunes a domingo), para saltar rápido. */
function semanaDe(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  const lunes = new Date(d);

  lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(lunes);

    x.setDate(lunes.getDate() + i);

    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
}

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

const CAMPO = "w-full rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50";

function ObjetivoEditor({
  objetivo,
  jugadores,
  onCambia,
  onQuita,
}: {
  objetivo: ObjetivoEntreno;
  jugadores: { id: string; nombre: string; foto?: string; posicion?: string }[];
  onCambia: (o: ObjetivoEntreno) => void;
  onQuita: () => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const pon = (parte: Partial<ObjetivoEntreno>) => onCambia({ ...objetivo, ...parte });

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-2">
        <textarea
          value={objetivo.objetivo}
          onChange={(e) => pon({ objetivo: e.target.value })}
          rows={2}
          placeholder="Qué se busca: «perfilarse antes de recibir para jugar hacia delante»"
          aria-label="Objetivo"
          className={`${CAMPO} resize-y font-medium`}
        />
        <button type="button" onClick={onQuita} aria-label="Quitar objetivo" className="rounded-lg p-2 text-white/35 hover:text-red-300">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {objetivo.jugadores.map((j) => (
          <span key={j.id} className="rounded-md bg-[#C8A96B]/15 px-2 py-0.5 text-xs text-[#C8A96B]">
            {j.nombre}
          </span>
        ))}
        <Button onClick={() => setEligiendo((x) => !x)}>{objetivo.jugadores.length ? "Cambiar jugadores" : "Elegir jugadores"}</Button>
      </div>

      {eligiendo && (
        <SeleccionJugadores
          jugadores={jugadores}
          seleccion={objetivo.jugadores.map((j) => j.id)}
          onCambia={(ids) => pon({ jugadores: ids.map((id) => ({ id, nombre: jugadores.find((x) => x.id === id)?.nombre ?? id })) })}
        />
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <input value={objetivo.reconocer ?? ""} onChange={(e) => pon({ reconocer: e.target.value })} placeholder="Cómo reconocerlo en el vídeo: «peto naranja, dorsal 8»" aria-label="Cómo reconocerlo" className={CAMPO} />
        <input value={objetivo.donde ?? ""} onChange={(e) => pon({ donde: e.target.value })} placeholder="Dónde (opcional): «en el rondo 6v3», «del minuto 20 al 45»" aria-label="Dónde" className={CAMPO} />
        <input value={objetivo.correcto ?? ""} onChange={(e) => pon({ correcto: e.target.value })} placeholder="Es CORRECTA si…" aria-label="Correcta si" className={CAMPO} />
        <input value={objetivo.mejorable ?? ""} onChange={(e) => pon({ mejorable: e.target.value })} placeholder="Es MEJORABLE si…" aria-label="Mejorable si" className={CAMPO} />
      </div>
    </div>
  );
}

export default function AnalisisEntrenamientoPage() {
  const [fecha, setFecha] = useState(hoy);
  const { players } = usePlayers();
  const jugadores = useMemo(
    () =>
      players
        .filter((p) => p.esCastilla && p.activo !== false)
        .map((p) => ({ id: p.id, nombre: p.apodo || p.nombre, foto: p.foto, posicion: p.posicion }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [players],
  );

  const { value, setValue } = useRemoteDoc<SesionEntreno>({ key: claveSesion(fecha), kind: KIND_ENTRENO, fallback: SESION_VACIA });
  const sesion = normalizaSesion(value);
  const cambia = (f: (s: SesionEntreno) => SesionEntreno) => setValue((actual) => f(normalizaSesion(actual)));

  /* El análisis (lo escribe el ordenador del club) y el encargo, releídos mientras va. */
  const [analisis, setAnalisis] = useState<AnalisisEntreno | null>(null);
  const [encargo, setEncargo] = useState<Encargo | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [vista, setVista] = useState<"todas" | "correcta" | "mejorable" | "sin-validar">("todas");

  /* La lectura va dentro del efecto y se relee subiendo el testigo (la forma que pasa el linter de React). */
  const [testigo, setTestigo] = useState(0);
  const relee = useCallback(() => setTestigo((n) => n + 1), []);

  useEffect(() => {
    let cancelado = false;

    Promise.all([
      fetch(`/api/docs?key=${encodeURIComponent(claveAnalisis(fecha))}`, { cache: "no-store" })
        .then((r) => r.json() as Promise<{ data?: AnalisisEntreno | null }>)
        .then((d) => d?.data ?? null)
        .catch(() => null),
      fetch("/api/mantenimiento", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ estado?: { entreno?: Encargo } }>)
        .then((d) => d?.estado?.entreno ?? null)
        .catch(() => null),
    ]).then(([a, m]) => {
      if (cancelado) return;

      setAnalisis(a);
      setEncargo(m);
    });

    return () => {
      cancelado = true;
    };
  }, [fecha, testigo]);

  const estado = encargo ? estadoEncargo("entreno", encargo) : "libre";
  const deEsteDia = (encargo?.datos as { fecha?: string } | undefined)?.fecha === fecha;
  const enCurso = deEsteDia && (estado === "pedido" || estado === "en-marcha");

  useEffect(() => {
    if (!enCurso) return;

    const reloj = window.setInterval(relee, 10_000);

    return () => window.clearInterval(reloj);
  }, [enCurso, relee]);

  const pide = async () => {
    const validos = sesion.objetivos.filter((o) => o.objetivo.trim() && o.jugadores.length);

    if (!validos.length) {
      toast.error("Define al menos un objetivo con su jugador");

      return;
    }

    setPidiendo(true);

    try {
      const r = await fetch("/api/mantenimiento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tarea: "entreno", fecha }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);

      toast.success("Pedido: el ordenador del club lo empieza en unos segundos");
      relee();
    } catch (error) {
      toast.error("No se ha podido pedir", { description: error instanceof Error ? error.message : "" });
    } finally {
      setPidiendo(false);
    }
  };

  const valida = (id: string, v: Validacion | null) =>
    cambia((s) => {
      const validaciones = { ...(s.validaciones ?? {}) };

      if (v) validaciones[id] = v;
      else delete validaciones[id];

      return { ...s, validaciones };
    });

  const cambiados = analisis ? sesion.objetivos.filter((o) => !analisis.objetivosAnalizados?.includes(huellaObjetivo(o))).length : 0;
  const semana = semanaDe(fecha);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · En obras"
              title="Análisis de entrenamiento"
              lead="Objetivos por jugador o por grupo, medidos en el vídeo de la sesión, con clips de lo que se hizo bien y de lo que hay que mejorar."
              aside={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
                  <HardHat size={12} /> Sólo tú
                </span>
              }
            />

            {/* ---------------- el día ---------------- */}
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Día del entrenamiento" className="rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-sm text-white" />
              <div className="flex gap-1">
                {semana.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFecha(d)}
                    className={`w-9 rounded-lg py-1.5 text-xs ${d === fecha ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/60 hover:text-white"}`}
                    title={d}
                  >
                    {DIAS[i]} {Number(d.slice(8))}
                  </button>
                ))}
              </div>
            </div>

            <Explicativo>
              <p className="text-xs text-white/45">
                El vídeo sale de la cámara táctica si hay una grabación de ese día en la carpeta SESIONES del ordenador del club; si no, del entrenamiento subido a Hudl con la fecha en el título («16102026 RM CASTILLA…»). La IA propone cada acción y su veredicto; lo que valides aquí manda en los números.
              </p>
            </Explicativo>

            {/* ---------------- los objetivos ---------------- */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Objetivos de la sesión</h2>
                <Button icon={Plus} onClick={() => cambia((s) => ({ ...s, objetivos: [...s.objetivos, { id: nuevoId(), objetivo: "", jugadores: [] }] }))}>
                  Objetivo
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  {enCurso ? (
                    <span className="flex items-center gap-1.5 text-xs text-[#C8A96B]">
                      <Loader2 size={13} className="animate-spin" /> {estado === "pedido" ? "Esperando al ordenador del club…" : encargo?.paso || "Analizando…"}
                    </span>
                  ) : deEsteDia && encargo?.resultado ? (
                    <span className={`max-w-md truncate text-xs ${encargo.ok ? "text-emerald-300/80" : "text-red-300"}`} title={encargo.resultado}>
                      {encargo.resultado}
                    </span>
                  ) : null}
                  <Button tone="primary" icon={pidiendo ? Loader2 : ClipboardCheck} onClick={() => void pide()} disabled={pidiendo || enCurso || estado === "en-marcha"}>
                    {analisis ? "Volver a analizar" : "Analizar"}
                  </Button>
                  <Button icon={RefreshCw} onClick={relee} title="Releer">
                    {""}
                  </Button>
                </div>
              </div>

              {sesion.objetivos.length === 0 ? (
                <EmptyState title="Sin objetivos para este día" description="Añade uno: qué se busca, de quién, cómo reconocerlo en el vídeo y qué es correcto o mejorable." />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {sesion.objetivos.map((o) => (
                    <ObjetivoEditor
                      key={o.id}
                      objetivo={o}
                      jugadores={jugadores}
                      onCambia={(nuevo) => cambia((s) => ({ ...s, objetivos: s.objetivos.map((x) => (x.id === o.id ? nuevo : x)) }))}
                      onQuita={() => cambia((s) => ({ ...s, objetivos: s.objetivos.filter((x) => x.id !== o.id) }))}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ---------------- el análisis ---------------- */}
            {analisis && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-lg font-semibold">Lo que dice el vídeo</h2>
                  <Explicativo>
                    <span className="text-xs text-white/40">
                      {analisis.fuente.tipo === "camara" ? "Cámara táctica" : "Hudl"} · {analisis.fuente.nombre} · {Math.round(analisis.fuente.duracion / 60)} min · {new Date(analisis.hechoEn).toLocaleString("es-ES")}
                    </span>
                  </Explicativo>
                </div>

                {cambiados > 0 && <Notice tone="warn" title={`${cambiados} ${cambiados === 1 ? "objetivo ha cambiado" : "objetivos han cambiado"} desde el análisis`}>Vuelve a analizar para que cuenten.</Notice>}

                {analisis.avisos.length > 0 && (
                  <Explicativo>
                    <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-200/80">
                      {analisis.avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </Explicativo>
                )}

                <div className="flex flex-wrap gap-1.5 text-xs">
                  {(
                    [
                      ["todas", "Todas"],
                      ["correcta", "Correctas"],
                      ["mejorable", "Mejorables"],
                      ["sin-validar", "Sin validar"],
                    ] as const
                  ).map(([k, t]) => (
                    <button key={k} type="button" onClick={() => setVista(k)} className={`rounded-lg px-3 py-1 ${vista === k ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/60"}`}>
                      {t}
                    </button>
                  ))}
                </div>

                {sesion.objetivos.map((o) => {
                  const c = cuentas(o.id, analisis.acciones, sesion.validaciones);
                  const suyas = analisis.acciones
                    .filter((a) => a.objetivoId === o.id)
                    .filter((a) => {
                      const v = veredictoFinal(a, sesion.validaciones);

                      return vista === "todas" ? true : vista === "sin-validar" ? !sesion.validaciones?.[a.id] : v === vista;
                    });

                  return (
                    <section key={o.id} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <header className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white">{o.objetivo || "Objetivo sin texto"}</p>
                          <p className="text-xs text-white/45">{o.jugadores.map((j) => j.nombre).join(", ")}</p>
                        </div>
                        <div className="flex items-center gap-4 text-center">
                          <div>
                            <p className="text-2xl font-semibold tabular-nums text-emerald-300">{c.correctas}</p>
                            <p className="text-[10px] uppercase tracking-wider text-white/40">Correctas</p>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold tabular-nums text-amber-300">{c.mejorables}</p>
                            <p className="text-[10px] uppercase tracking-wider text-white/40">Mejorables</p>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold tabular-nums text-white">{c.pct === null ? "—" : `${c.pct} %`}</p>
                            <p className="text-[10px] uppercase tracking-wider text-white/40">Acierto</p>
                          </div>
                        </div>
                      </header>

                      {c.propuestas > 0 && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full bg-emerald-400" style={{ width: `${c.pct ?? 0}%` }} />
                        </div>
                      )}

                      <p className="text-[11px] text-white/40">
                        {c.validadas} de {c.propuestas} validadas
                      </p>

                      {suyas.length === 0 ? (
                        <p className="text-sm text-white/40">{c.propuestas ? "Nada con este filtro." : "El vídeo no ha dado acciones de este objetivo."}</p>
                      ) : (
                        <ul className="grid gap-3 lg:grid-cols-2">
                          {suyas.map((a) => {
                            const v = veredictoFinal(a, sesion.validaciones);
                            const val = sesion.validaciones?.[a.id];

                            return (
                              <li key={a.id} className={`space-y-2 rounded-xl border p-3 ${v === null ? "border-white/5 opacity-50" : v === "correcta" ? "border-emerald-400/30" : "border-amber-400/30"}`}>
                                {a.clip ? (
                                  <video src={a.clip} controls preload="none" className="aspect-video w-full rounded-lg bg-black" />
                                ) : analisis.fuente.url ? (
                                  <a href={analisis.fuente.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-[#C8A96B] hover:underline">
                                    <Play size={12} /> Ver en Hudl ({mmss(a.inicio)})
                                  </a>
                                ) : null}
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="tabular-nums text-white/50">{mmss(a.inicio)}</span>
                                  <span className={`rounded-md px-1.5 py-0.5 font-semibold ${v === "correcta" ? "bg-emerald-400/20 text-emerald-200" : v === "mejorable" ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-white/50"}`}>
                                    {v === null ? "Descartada" : v === "correcta" ? "Correcta" : "Mejorable"}
                                  </span>
                                  {val ? <Check size={12} className="text-white/50" aria-label="Validada" /> : null}
                                  {a.jugador ? <span className="truncate text-white/45">{a.jugador}</span> : null}
                                </div>
                                <p className="text-sm text-white/80">{a.explicacion}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  <Button icon={ThumbsUp} onClick={() => valida(a.id, val === "correcta" ? null : "correcta")} title="Es correcta">
                                    Correcta
                                  </Button>
                                  <Button icon={ThumbsDown} onClick={() => valida(a.id, val === "mejorable" ? null : "mejorable")} title="Es mejorable">
                                    Mejorable
                                  </Button>
                                  <Button icon={X} tone="danger" onClick={() => valida(a.id, val === "descartada" ? null : "descartada")} title="No es de este objetivo o no se ve">
                                    Descartar
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            <textarea
              value={sesion.notas ?? ""}
              onChange={(e) => cambia((s) => ({ ...s, notas: e.target.value }))}
              rows={3}
              placeholder="Notas de la sesión"
              aria-label="Notas de la sesión"
              className={`${CAMPO} resize-y`}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
