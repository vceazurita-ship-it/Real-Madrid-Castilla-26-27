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
 *
 * Revisión del 17/10/2026: antes de pedir el análisis se guarda lo escrito
 * (el ordenador del club lee el documento, no la pantalla), el análisis de
 * otro día ya no asoma al cambiar de fecha, validar en bloque, resumen del
 * día y semanas anterior/siguiente.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, ChevronLeft, ChevronRight, ClipboardCheck, Film, HardHat, Loader2, Play, Plus, RefreshCw, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
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

const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => isoDe(new Date());

/** Mueve una fecha `dias` días (con mediodía para no tropezar con el cambio de hora). */
const mueve = (fecha: string, dias: number) => {
  const d = new Date(`${fecha}T12:00:00`);

  d.setDate(d.getDate() + dias);

  return isoDe(d);
};

/** Los días de la semana de una fecha (lunes a domingo), para saltar rápido. */
function semanaDe(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  const lunes = mueve(fecha, -((d.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => mueve(lunes, i));
}

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

const CAMPO = "w-full rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50";

type Vista = "todas" | "correcta" | "mejorable" | "sin-validar" | "con-clip";

const tieneContenido = (o: ObjetivoEntreno) => Boolean(o.objetivo.trim() || o.jugadores.length || o.reconocer?.trim() || o.correcto?.trim() || o.mejorable?.trim() || o.donde?.trim());

function ObjetivoEditor({
  objetivo,
  numero,
  jugadores,
  onCambia,
  onQuita,
}: {
  objetivo: ObjetivoEntreno;
  numero: number;
  jugadores: { id: string; nombre: string; foto?: string; posicion?: string }[];
  onCambia: (o: ObjetivoEntreno) => void;
  onQuita: () => void;
}) {
  const [eligiendo, setEligiendo] = useState(!objetivo.jugadores.length && !objetivo.objetivo);
  const pon = (parte: Partial<ObjetivoEntreno>) => onCambia({ ...objetivo, ...parte });
  const falta = !objetivo.objetivo.trim() ? "Falta qué se busca" : !objetivo.jugadores.length ? "Falta el jugador" : null;

  return (
    <div className={`space-y-3 rounded-2xl border bg-white/[0.03] p-4 ${falta ? "border-amber-400/25" : "border-white/10"}`}>
      <div className="flex items-start gap-2">
        <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C8A96B]/15 text-xs font-semibold text-[#C8A96B]">{numero}</span>
        <textarea
          value={objetivo.objetivo}
          onChange={(e) => pon({ objetivo: e.target.value })}
          rows={2}
          placeholder="Qué se busca: «perfilarse antes de recibir para jugar hacia delante»"
          aria-label="Objetivo"
          className={`${CAMPO} resize-y font-medium`}
        />
        <button
          type="button"
          onClick={() => {
            if (!tieneContenido(objetivo) || window.confirm("¿Quitar este objetivo? Sus acciones dejarán de contar.")) onQuita();
          }}
          aria-label="Quitar objetivo"
          title="Quitar objetivo"
          className="rounded-lg p-2 text-white/35 hover:text-red-300"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {objetivo.jugadores.map((j) => (
          <span key={j.id} className="inline-flex items-center gap-1 rounded-md bg-[#C8A96B]/15 py-0.5 pl-2 pr-1 text-xs text-[#C8A96B]">
            {j.nombre}
            <button type="button" onClick={() => pon({ jugadores: objetivo.jugadores.filter((x) => x.id !== j.id) })} aria-label={`Quitar a ${j.nombre}`} className="rounded p-0.5 hover:bg-[#C8A96B]/20">
              <X size={11} />
            </button>
          </span>
        ))}
        <Button onClick={() => setEligiendo((x) => !x)}>{eligiendo ? "Listo" : objetivo.jugadores.length ? "Cambiar jugadores" : "Elegir jugadores"}</Button>
        {falta ? <span className="text-[11px] text-amber-300/80">{falta}</span> : null}
      </div>

      {eligiendo && (
        <SeleccionJugadores
          jugadores={jugadores}
          seleccion={objetivo.jugadores.map((j) => j.id)}
          onCambia={(ids) => pon({ jugadores: ids.map((id) => ({ id, nombre: jugadores.find((x) => x.id === id)?.nombre ?? objetivo.jugadores.find((x) => x.id === id)?.nombre ?? id })) })}
        />
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <input value={objetivo.reconocer ?? ""} onChange={(e) => pon({ reconocer: e.target.value })} placeholder="Cómo reconocerlo en el vídeo: «peto naranja, dorsal 8»" aria-label="Cómo reconocerlo" className={CAMPO} />
        <input value={objetivo.donde ?? ""} onChange={(e) => pon({ donde: e.target.value })} placeholder="Dónde (opcional): «en el rondo 6v3», «del minuto 20 al 45»" aria-label="Dónde" className={CAMPO} />
        <input value={objetivo.correcto ?? ""} onChange={(e) => pon({ correcto: e.target.value })} placeholder="Es CORRECTA si…" aria-label="Correcta si" className={CAMPO} />
        <input value={objetivo.mejorable ?? ""} onChange={(e) => pon({ mejorable: e.target.value })} placeholder="Es MEJORABLE si…" aria-label="Mejorable si" className={CAMPO} />
      </div>
      {!objetivo.reconocer?.trim() && objetivo.objetivo.trim() ? (
        <p className="text-[11px] text-white/40">Consejo: con peto o dorsal la IA reconoce al jugador; sin eso, en cámara lejana, descarta muchas acciones.</p>
      ) : null}
    </div>
  );
}

export default function AnalisisEntrenamientoPage() {
  const [hoyDia] = useState(hoy);
  const [fecha, setFecha] = useState(hoyDia);
  const { players } = usePlayers();
  const jugadores = useMemo(
    () =>
      players
        .filter((p) => p.esCastilla && p.activo !== false)
        .map((p) => ({ id: p.id, nombre: p.apodo || p.nombre, foto: p.foto, posicion: p.posicion }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [players],
  );

  const { value, setValue, status, guardaYa } = useRemoteDoc<SesionEntreno>({ key: claveSesion(fecha), kind: KIND_ENTRENO, fallback: SESION_VACIA });
  const sesion = normalizaSesion(value);
  const cambia = (f: (s: SesionEntreno) => SesionEntreno) => setValue((actual) => f(normalizaSesion(actual)));

  /* El análisis (lo escribe el ordenador del club) y el encargo, releídos mientras va. Se guarda con su día: al cambiar de fecha no asoma el del anterior. */
  const [leido, setLeido] = useState<{ fecha: string; analisis: AnalisisEntreno | null } | null>(null);
  const [encargo, setEncargo] = useState<Encargo | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [vista, setVista] = useState<Vista>("todas");
  const analisis = leido?.fecha === fecha ? leido.analisis : null;
  const cargando = leido?.fecha !== fecha;

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

      setLeido({ fecha, analisis: a });
      setEncargo(m);
    });

    return () => {
      cancelado = true;
    };
  }, [fecha, testigo]);

  const estado = encargo ? estadoEncargo("entreno", encargo) : "libre";
  const fechaEncargo = (encargo?.datos as { fecha?: string } | undefined)?.fecha;
  const deEsteDia = fechaEncargo === fecha;
  const enCurso = deEsteDia && (estado === "pedido" || estado === "en-marcha");
  /* El ordenador del club hace un análisis cada vez: si está con otro día, se avisa en vez de dejar el botón muerto sin explicación. */
  const ocupadoConOtro = !deEsteDia && (estado === "pedido" || estado === "en-marcha");

  useEffect(() => {
    if (!enCurso && !ocupadoConOtro) return;

    const reloj = window.setInterval(relee, 10_000);

    return () => window.clearInterval(reloj);
  }, [enCurso, ocupadoConOtro, relee]);

  const pide = async () => {
    const conTexto = sesion.objetivos.filter((o) => o.objetivo.trim());
    const sinJugador = conTexto.filter((o) => !o.jugadores.length);

    if (!conTexto.length) {
      toast.error("Define al menos un objetivo con su jugador");

      return;
    }

    if (sinJugador.length) {
      toast.error(sinJugador.length === 1 ? "Un objetivo no tiene jugador" : `${sinJugador.length} objetivos no tienen jugador`, { description: "Elige a quién mira la IA en cada uno." });

      return;
    }

    setPidiendo(true);

    try {
      /* El ordenador del club lee el documento guardado: lo último escrito tiene que estar ya en el servidor. */
      if (!(await guardaYa())) throw new Error("los objetivos no se han podido guardar; revisa la conexión y vuelve a intentarlo");

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

  /* Dar por buenas, de una vez, las que quedan sin validar de un objetivo (con el veredicto de la IA). */
  const validaResto = (objetivoId: string) => {
    if (!analisis) return;

    cambia((s) => {
      const validaciones = { ...(s.validaciones ?? {}) };

      for (const a of analisis.acciones) if (a.objetivoId === objetivoId && !validaciones[a.id]) validaciones[a.id] = a.veredicto;

      return { ...s, validaciones };
    });
  };

  const cambiados = analisis ? sesion.objetivos.filter((o) => o.objetivo.trim() && !analisis.objetivosAnalizados?.includes(huellaObjetivo(o))).length : 0;
  const semana = semanaDe(fecha);
  const idsVivos = new Set(sesion.objetivos.map((o) => o.id));
  const vivas = analisis ? analisis.acciones.filter((a) => idsVivos.has(a.objetivoId)) : [];
  const cuantas: Record<Vista, number> = {
    todas: vivas.length,
    correcta: vivas.filter((a) => veredictoFinal(a, sesion.validaciones) === "correcta").length,
    mejorable: vivas.filter((a) => veredictoFinal(a, sesion.validaciones) === "mejorable").length,
    "sin-validar": vivas.filter((a) => !sesion.validaciones?.[a.id]).length,
    "con-clip": vivas.filter((a) => a.clip).length,
  };
  const validadasTodas = vivas.length - cuantas["sin-validar"];
  const pctDia = cuantas.correcta + cuantas.mejorable ? Math.round((100 * cuantas.correcta) / (cuantas.correcta + cuantas.mejorable)) : null;
  const textoGuardado = status === "saving" ? "Guardando…" : status === "saved" ? "Guardado" : status === "offline" ? "Sin conexión: se guardará al volver" : status === "error" ? "No se ha guardado" : "Cargando…";

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
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setFecha(mueve(fecha, -7))} aria-label="Semana anterior" title="Semana anterior" className="rounded-lg border border-white/12 p-1.5 text-white/60 hover:text-white">
                  <ChevronLeft size={14} />
                </button>
                {semana.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFecha(d)}
                    aria-pressed={d === fecha}
                    className={`w-9 rounded-lg py-1.5 text-xs ${d === fecha ? "bg-[#C8A96B] font-semibold text-black" : d === hoyDia ? "border border-[#C8A96B]/40 text-white/80" : "border border-white/12 text-white/60 hover:text-white"}`}
                    title={new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                  >
                    {DIAS[i]} {Number(d.slice(8))}
                  </button>
                ))}
                <button type="button" onClick={() => setFecha(mueve(fecha, 7))} aria-label="Semana siguiente" title="Semana siguiente" className="rounded-lg border border-white/12 p-1.5 text-white/60 hover:text-white">
                  <ChevronRight size={14} />
                </button>
              </div>
              {fecha !== hoyDia && (
                <button type="button" onClick={() => setFecha(hoyDia)} className="text-xs text-white/50 hover:text-white hover:underline">
                  Hoy
                </button>
              )}
              <span className={`ml-auto text-[11px] ${status === "error" ? "text-red-300" : status === "offline" ? "text-amber-300/80" : "text-white/35"}`}>{textoGuardado}</span>
            </div>

            <Explicativo>
              <p className="text-xs text-white/45">
                El vídeo sale de la cámara táctica si hay una grabación de ese día en la carpeta SESIONES del ordenador del club; si no, del entrenamiento subido a Hudl con la fecha en el título («16102026 RM CASTILLA…»). La IA propone cada acción y su veredicto; se corta un clip de ejemplo correcto y otro mejorable por objetivo. Lo que valides aquí manda en los números.
              </p>
            </Explicativo>

            {/* ---------------- los objetivos ---------------- */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Objetivos de la sesión</h2>
                <Button icon={Plus} onClick={() => cambia((s) => ({ ...s, objetivos: [...s.objetivos, { id: nuevoId(), objetivo: "", jugadores: [] }] }))}>
                  Objetivo
                </Button>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  {enCurso ? (
                    <span className="flex items-center gap-1.5 text-xs text-[#C8A96B]" aria-live="polite">
                      <Loader2 size={13} className="animate-spin" /> {estado === "pedido" ? "Esperando al ordenador del club…" : encargo?.paso || "Analizando…"}
                    </span>
                  ) : ocupadoConOtro ? (
                    <span className="flex items-center gap-1.5 text-xs text-amber-300/80">
                      <Loader2 size={13} className="animate-spin" /> Analizando el {fechaEncargo?.split("-").reverse().join("/")}: espera a que termine
                    </span>
                  ) : deEsteDia && encargo?.resultado ? (
                    <span className={`max-w-md truncate text-xs ${encargo.ok ? "text-emerald-300/80" : "text-red-300"}`} title={encargo.resultado}>
                      {encargo.resultado}
                    </span>
                  ) : null}
                  <Button tone="primary" icon={pidiendo ? Loader2 : ClipboardCheck} onClick={() => void pide()} disabled={pidiendo || enCurso || ocupadoConOtro || !sesion.objetivos.length}>
                    {analisis ? "Volver a analizar" : "Analizar"}
                  </Button>
                  <Button icon={RefreshCw} onClick={relee} title="Releer el análisis">
                    {""}
                  </Button>
                </div>
              </div>

              {sesion.objetivos.length === 0 ? (
                <EmptyState title="Sin objetivos para este día" description="Añade uno: qué se busca, de quién, cómo reconocerlo en el vídeo y qué es correcto o mejorable." />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {sesion.objetivos.map((o, i) => (
                    <ObjetivoEditor
                      key={o.id}
                      objetivo={o}
                      numero={i + 1}
                      jugadores={jugadores}
                      onCambia={(nuevo) => cambia((s) => ({ ...s, objetivos: s.objetivos.map((x) => (x.id === o.id ? nuevo : x)) }))}
                      onQuita={() => cambia((s) => ({ ...s, objetivos: s.objetivos.filter((x) => x.id !== o.id) }))}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ---------------- el análisis ---------------- */}
            {cargando ? (
              <p className="flex items-center gap-1.5 text-sm text-white/40">
                <Loader2 size={13} className="animate-spin" /> Leyendo el análisis del día…
              </p>
            ) : analisis ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-lg font-semibold">Lo que dice el vídeo</h2>
                  <Explicativo>
                    <span className="text-xs text-white/40">
                      {analisis.fuente.tipo === "camara" ? "Cámara táctica" : "Hudl"} · {analisis.fuente.nombre} · {Math.round(analisis.fuente.duracion / 60)} min · {new Date(analisis.hechoEn).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </Explicativo>
                </div>

                {/* El día de un vistazo. */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Acciones", String(vivas.length), "text-white"],
                    ["Correctas", String(cuantas.correcta), "text-emerald-300"],
                    ["Mejorables", String(cuantas.mejorable), "text-amber-300"],
                    ["Acierto del día", pctDia === null ? "—" : `${pctDia} %`, "text-white"],
                  ].map(([t, v, c]) => (
                    <div key={t} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className={`text-xl font-semibold tabular-nums ${c}`}>{v}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40">{t}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-white/40">
                  {validadasTodas} de {vivas.length} validadas por ti{cuantas["sin-validar"] ? " · las que quedan cuentan con el veredicto de la IA" : ""}
                </p>

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

                <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filtrar acciones">
                  {(
                    [
                      ["todas", "Todas"],
                      ["correcta", "Correctas"],
                      ["mejorable", "Mejorables"],
                      ["sin-validar", "Sin validar"],
                      ["con-clip", "Con clip"],
                    ] as const
                  ).map(([k, t]) => (
                    <button key={k} type="button" aria-pressed={vista === k} onClick={() => setVista(k)} className={`rounded-lg px-3 py-1 ${vista === k ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/60 hover:text-white"}`}>
                      {t} <span className="tabular-nums opacity-70">{cuantas[k]}</span>
                    </button>
                  ))}
                </div>

                {sesion.objetivos.map((o, n) => {
                  const c = cuentas(o.id, analisis.acciones, sesion.validaciones);
                  const pendientes = analisis.acciones.filter((a) => a.objetivoId === o.id && !sesion.validaciones?.[a.id]).length;
                  const suyas = analisis.acciones
                    .filter((a) => a.objetivoId === o.id)
                    .filter((a) => {
                      const v = veredictoFinal(a, sesion.validaciones);

                      return vista === "todas" ? true : vista === "sin-validar" ? !sesion.validaciones?.[a.id] : vista === "con-clip" ? Boolean(a.clip) : v === vista;
                    })
                    /* Los ejemplos con clip, primero; después, por minuto. */
                    .sort((a, b) => Number(Boolean(b.clip)) - Number(Boolean(a.clip)) || a.inicio - b.inicio);

                  return (
                    <section key={o.id} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <header className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white">
                            <span className="mr-1.5 text-[#C8A96B]">{n + 1}.</span>
                            {o.objetivo || "Objetivo sin texto"}
                          </p>
                          <p className="text-xs text-white/45">{o.jugadores.map((j) => j.nombre).join(", ") || "Sin jugador"}</p>
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

                      {c.total > 0 && (
                        <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                          <div className="h-full bg-emerald-400" style={{ width: `${c.pct ?? 0}%` }} />
                          <div className="h-full bg-amber-400" style={{ width: `${100 - (c.pct ?? 0)}%` }} />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] text-white/40">
                          {c.validadas} de {c.propuestas} validadas
                        </p>
                        {pendientes > 0 && (
                          <Button icon={CheckCheck} onClick={() => validaResto(o.id)} title="Las que quedan sin validar se dan por buenas con el veredicto de la IA">
                            Validar las {pendientes} que quedan como dice la IA
                          </Button>
                        )}
                      </div>

                      {suyas.length === 0 ? (
                        <p className="text-sm text-white/40">{c.propuestas ? "Nada con este filtro." : "El vídeo no ha dado acciones de este objetivo (¿se reconoce bien al jugador?)."}</p>
                      ) : (
                        <ul className="grid gap-3 lg:grid-cols-2">
                          {suyas.map((a) => {
                            const v = veredictoFinal(a, sesion.validaciones);
                            const val = sesion.validaciones?.[a.id];

                            return (
                              <li key={a.id} className={`space-y-2 rounded-xl border p-3 ${v === null ? "border-white/5 opacity-60" : v === "correcta" ? "border-emerald-400/30" : "border-amber-400/30"}`}>
                                {a.clip ? (
                                  <div className="space-y-1">
                                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/45">
                                      <Film size={11} /> Clip de ejemplo · {a.veredicto === "correcta" ? "correcto" : "mejorable"} según la IA
                                    </p>
                                    <video src={a.clip} controls preload="metadata" playsInline className="aspect-video w-full rounded-lg bg-black" />
                                  </div>
                                ) : analisis.fuente.url ? (
                                  <a href={analisis.fuente.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-[#C8A96B] hover:underline" title="Sin clip: sólo se corta un ejemplo de cada veredicto por objetivo">
                                    <Play size={12} /> Abrir en Hudl y buscar el {mmss(a.inicio)}
                                  </a>
                                ) : (
                                  <p className="text-[11px] text-white/35">Sin clip (sólo se corta un ejemplo de cada) · minuto {mmss(a.inicio)} del vídeo</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="tabular-nums text-white/50">
                                    {mmss(a.inicio)}–{mmss(a.fin)}
                                  </span>
                                  <span className={`rounded-md px-1.5 py-0.5 font-semibold ${v === "correcta" ? "bg-emerald-400/20 text-emerald-200" : v === "mejorable" ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-white/50"}`}>
                                    {v === null ? "Descartada" : v === "correcta" ? "Correcta" : "Mejorable"}
                                  </span>
                                  {val ? (
                                    <span className="inline-flex items-center gap-0.5 text-white/50">
                                      <Check size={12} aria-hidden /> validada{val !== "descartada" && val !== a.veredicto ? " (cambiada)" : ""}
                                    </span>
                                  ) : (
                                    <span className="text-white/35">la IA</span>
                                  )}
                                  {a.jugador ? <span className="truncate text-white/45">{a.jugador}</span> : null}
                                </div>
                                <p className="text-sm text-white/80">{a.explicacion}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  <Button icon={ThumbsUp} tone={val === "correcta" ? "primary" : "ghost"} onClick={() => valida(a.id, val === "correcta" ? null : "correcta")} title={val === "correcta" ? "Quitar la validación" : "Es correcta"}>
                                    Correcta
                                  </Button>
                                  <Button icon={ThumbsDown} tone={val === "mejorable" ? "primary" : "ghost"} onClick={() => valida(a.id, val === "mejorable" ? null : "mejorable")} title={val === "mejorable" ? "Quitar la validación" : "Es mejorable"}>
                                    Mejorable
                                  </Button>
                                  <Button icon={X} tone="danger" onClick={() => valida(a.id, val === "descartada" ? null : "descartada")} title={val === "descartada" ? "Recuperarla" : "No es de este objetivo o no se ve"}>
                                    {val === "descartada" ? "Recuperar" : "Descartar"}
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
            ) : sesion.objetivos.some((o) => o.objetivo.trim()) && !enCurso ? (
              <p className="text-sm text-white/40">Este día todavía no tiene análisis: cuando estén los objetivos, pulsa «Analizar».</p>
            ) : null}

            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white/70">Notas de la sesión</h2>
              <textarea
                value={sesion.notas ?? ""}
                onChange={(e) => cambia((s) => ({ ...s, notas: e.target.value }))}
                rows={3}
                placeholder="Lo que quieras apuntar del entrenamiento"
                aria-label="Notas de la sesión"
                className={`${CAMPO} resize-y`}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
