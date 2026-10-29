"use client";

/**
 * ANÁLISIS DE ENTRENAMIENTO (16/10/2026 en obras; terminado el 19/10/2026).
 *
 * Se elige el día, se definen objetivos —uno o varios jugadores, qué se
 * busca, cómo reconocerlos en el vídeo, qué es correcto o mejorable, en qué
 * tarea mirarlo y qué porcentaje se pide— y se pide el análisis al ordenador
 * del club (encargo `entreno`). Vuelve con las acciones de cada objetivo, su
 * veredicto y clips de ejemplo; el cuerpo técnico valida o corrige cada una y
 * los números salen de lo validado. El modelo, en lib/entreno/modelo.ts; la
 * vista por jugador y «Tu sesión», en lib/entreno/jugador.ts; el análisis, en
 * scripts/entreno/analiza-entreno.mjs. El candado, en ./layout.tsx.
 *
 * Revisión del 17/10/2026: antes de pedir el análisis se guarda lo escrito
 * (el ordenador del club lee el documento, no la pantalla), el análisis de
 * otro día ya no asoma al cambiar de fecha, validar en bloque, resumen del
 * día y semanas anterior/siguiente.
 *
 * Terminada el 19/10/2026 (Paquete D del plan de los expertos):
 *   - La cuenta siempre igual: «9 de 14 correctas (11 validadas)», y el
 *     porcentaje sólo con 8 acciones o más (si no, «tendencia»). Lo validado
 *     y lo que sólo propuso la IA se distinguen a la vista.
 *   - Cada objetivo puede llevar su tarea del registro del día, su meta y de
 *     dónde sale, y enseña la sesión anterior del mismo objetivo.
 *   - Pestaña «Por jugador»: su evolución y «Tu sesión» para WhatsApp.
 *   - Sale de obras: el cuerpo técnico entra con su cuenta y puede pedir el
 *     análisis; cada estado (sin objetivos, esperando al ordenador,
 *     analizando, error, sin vídeo, sin clips) dice qué pasa y qué hacer.
 *   - El día, la pestaña y el jugador van en la dirección: recargar o mandar
 *     el enlace abre lo mismo.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, ChevronLeft, ChevronRight, ClipboardCheck, Copy, Film, Loader2, Play, Plus, RefreshCw, ThumbsDown, ThumbsUp, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { AbpHeader, Button, Notice, SaveState } from "@/components/abp/ui";
import { Explicativo } from "@/components/ui/textos-analisis";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { usePlayers } from "@/hooks/usePlayers";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { loadRegistro, type RegistroTarea } from "@/lib/abp/registro";
import { anteriorDelObjetivo, ultimoDiaConObjetivos, type DiaEntreno } from "@/lib/entreno/jugador";
import {
  KIND_ENTRENO,
  MINIMO_PORCENTAJE,
  SESION_VACIA,
  claveAnalisis,
  claveSesion,
  cuentas,
  cumpleMeta,
  huellaObjetivo,
  lecturaCuentas,
  mmss,
  normalizaSesion,
  nuevoId,
  porcentajeOTendencia,
  veredictoFinal,
  type AnalisisEntreno,
  type SesionEntreno,
  type Validacion,
} from "@/lib/entreno/modelo";
import { estadoEncargo, vigiaVivo, type EstadoEncargo, type Encargo, type Vigia } from "@/lib/mantenimiento";
import { duracion, vistaProgreso, type VistaProgreso } from "@/lib/progreso";
import { fechaIsoDeHoja } from "@/lib/registro/hoja";

import { useDiasConectados } from "@/hooks/useDiasConectados";
import { planDeRegistro, sesionDeFecha } from "@/lib/sesion-dia/conexion";

import { CAMPO, ObjetivoEditor, type TareaDelDia } from "./ObjetivoEditor";
import { SesionDelDia } from "./SesionDelDia";
import { PanelVisual } from "./PanelVisual";
import { QueTocaDelPost } from "./QueTocaDelPost";
import { VistaJugador } from "./VistaJugador";

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

const ddmm = (f: string) => f.split("-").reverse().slice(0, 2).join("/");

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#C8A96B]";

type Vista = "todas" | "correcta" | "mejorable" | "sin-validar" | "con-clip";

/** Un parámetro de la dirección al montar (el mismo patrón que `usePestanaUrl`: una vez, sin efectos). */
function deLaDireccion(nombre: string) {
  if (typeof window === "undefined") return null;

  return new URLSearchParams(window.location.search).get(nombre);
}

/** Reescribe un parámetro de la dirección sin recargar ni añadir historial. */
function ponEnDireccion(nombre: string, valor: string | null) {
  try {
    const url = new URL(window.location.href);

    if (valor) url.searchParams.set(nombre, valor);
    else url.searchParams.delete(nombre);

    window.history.replaceState(window.history.state, "", url);
  } catch {
    /* Sin dirección que tocar: basta con el estado. */
  }
}

/** Lo que dice el ordenador del club, leído junto con el análisis (con la hora de la lectura: nada de relojes en el render). */
type Ordenador = { encargo: Encargo | null; estado: EstadoEncargo; vivo: boolean; progreso: VistaProgreso | null };

/**
 * Qué hacer cuando el análisis ha fallado, según lo que contestó el script
 * (scripts/entreno/analiza-entreno.mjs, sus `fin(...)`). Lo que el cuerpo
 * técnico puede arreglar, dicho; lo demás, a quien lleva el ordenador.
 */
function queHacer(resultado: string) {
  if (/no hay v[ií]deo/i.test(resultado))
    return {
      titulo: "No se ha encontrado el vídeo de este día",
      texto: "Sube el entrenamiento a Hudl con la fecha en el título («DDMMAAAA RM CASTILLA…») o deja la grabación de la cámara táctica en la carpeta SESIONES del ordenador del club, y vuelve a pulsar «Analizar».",
    };

  if (/no tiene objetivos/i.test(resultado)) return { titulo: "El día no tenía objetivos guardados", texto: "Escribe al menos un objetivo con su jugador y vuelve a pulsar «Analizar»." };

  if (/sesi[oó]n de hudl|login/i.test(resultado)) return { titulo: "La sesión de Hudl del ordenador del club ha caducado", texto: "Avisa al administrador para que vuelva a entrar en Hudl en ese ordenador; después, vuelve a pedir el análisis." };

  if (/cuota|quota|429|gemini/i.test(resultado)) return { titulo: "La IA no ha contestado", texto: "Suele ser la cuota del día. Vuelve a pedirlo dentro de un rato." };

  return { titulo: "El análisis no ha salido", texto: "Vuelve a pedirlo; si se repite, avisa al administrador con el detalle de abajo." };
}

export default function AnalisisEntrenamientoPage() {
  const [hoyDia] = useState(hoy);
  const [fecha, setFechaEstado] = useState(() => {
    const pedida = deLaDireccion("fecha");

    return pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : hoyDia;
  });
  const setFecha = (f: string) => {
    setFechaEstado(f);
    ponEnDireccion("fecha", f === hoyDia ? null : f);
  };
  const [pestana, setPestana] = usePestanaUrl<"dia" | "jugador">("vista", ["dia", "jugador"], "dia");
  const [jugador, setJugadorEstado] = useState<string | null>(() => deLaDireccion("jugador"));
  const setJugador = (clave: string) => {
    setJugadorEstado(clave);
    ponEnDireccion("jugador", clave);
  };

  const { players } = usePlayers();
  const jugadores = useMemo(
    () =>
      players
        .filter((p) => p.esCastilla && p.activo !== false)
        .map((p) => ({ id: p.id, nombre: p.apodo || p.nombre, foto: p.foto, posicion: p.posicion }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [players],
  );

  const { value, setValue, status, localOnly, lastSavedAt, sinGuardar, guardaYa } = useRemoteDoc<SesionEntreno>({ key: claveSesion(fecha), kind: KIND_ENTRENO, fallback: SESION_VACIA });
  const sesion = useMemo(() => normalizaSesion(value), [value]);
  const cambia = (f: (s: SesionEntreno) => SesionEntreno) => setValue((actual) => f(normalizaSesion(actual)));

  /* El análisis (lo escribe el ordenador del club) y el encargo, releídos mientras va. Se guarda con su día: al cambiar de fecha no asoma el del anterior. */
  const [leido, setLeido] = useState<{ fecha: string; analisis: AnalisisEntreno | null; error: boolean } | null>(null);
  const [ordenador, setOrdenador] = useState<Ordenador | null>(null);
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
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));

          return { analisis: ((await r.json()) as { data?: AnalisisEntreno | null })?.data ?? null, error: false };
        })
        .catch(() => ({ analisis: null, error: true })),
      fetch("/api/mantenimiento", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ estado?: { entreno?: Encargo }; vigia?: Vigia | null }>)
        .catch(() => null),
    ]).then(([a, m]) => {
      if (cancelado) return;

      const ahora = Date.now();
      const encargo = m?.estado?.entreno ?? null;
      const estado = encargo ? estadoEncargo("entreno", encargo, ahora) : "libre";

      setLeido({ fecha, ...a });
      setOrdenador({
        encargo,
        estado,
        vivo: vigiaVivo(m?.vigia, ahora),
        progreso: estado === "en-marcha" ? vistaProgreso("entreno", m?.vigia?.progreso?.entreno, encargo?.empezadoEn, ahora) : null,
      });
    });

    return () => {
      cancelado = true;
    };
  }, [fecha, testigo]);

  const encargo = ordenador?.encargo ?? null;
  const estado = ordenador?.estado ?? "libre";
  const fechaEncargo = (encargo?.datos as { fecha?: string } | undefined)?.fecha;
  const deEsteDia = fechaEncargo === fecha;
  const enCurso = deEsteDia && (estado === "pedido" || estado === "en-marcha");
  /* El ordenador del club hace un análisis cada vez: si está con otro día, se avisa en vez de dejar el botón muerto sin explicación. */
  const ocupadoConOtro = !deEsteDia && (estado === "pedido" || estado === "en-marcha");
  const fallo = deEsteDia && estado === "libre" && encargo?.ok === false && encargo.resultado ? encargo.resultado : null;
  const cortado = deEsteDia && estado === "cortado";
  const futuro = fecha > hoyDia;

  useEffect(() => {
    if (!enCurso && !ocupadoConOtro) return;

    const reloj = window.setInterval(relee, 10_000);

    return () => window.clearInterval(reloj);
  }, [enCurso, ocupadoConOtro, relee]);

  /* Todos los días guardados, para la sesión anterior, copiar objetivos y la vista por jugador. */
  const [historial, setHistorial] = useState<{ dias: DiaEntreno[]; error: boolean } | null>(null);
  const [testigoHistorial, setTestigoHistorial] = useState(0);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/entreno/historial", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as { ok?: boolean; sesiones?: { fecha: string; data: unknown }[]; analisis?: { fecha: string; data: AnalisisEntreno }[] };

        if (!r.ok || !j.ok) throw new Error(String(r.status));

        const fechas = new Set([...(j.sesiones ?? []).map((s) => s.fecha), ...(j.analisis ?? []).map((a) => a.fecha)]);

        return [...fechas].map((f) => ({
          fecha: f,
          sesion: normalizaSesion(j.sesiones?.find((s) => s.fecha === f)?.data ?? null),
          analisis: j.analisis?.find((a) => a.fecha === f)?.data ?? null,
        }));
      })
      .then((dias) => {
        if (!cancelado) setHistorial({ dias, error: false });
      })
      .catch(() => {
        if (!cancelado) setHistorial((h) => ({ dias: h?.dias ?? [], error: true }));
      });

    return () => {
      cancelado = true;
    };
  }, [testigoHistorial]);

  /* El historial con el día abierto tal y como está ahora (lo que se acaba de escribir o validar aún puede no estar en el servidor). */
  const dias = useMemo<DiaEntreno[]>(() => {
    const otros = (historial?.dias ?? []).filter((d) => d.fecha !== fecha);
    const servidor = historial?.dias.find((d) => d.fecha === fecha);

    return [...otros, { fecha, sesion, analisis: cargando ? (servidor?.analisis ?? null) : analisis }];
  }, [historial, fecha, sesion, analisis, cargando]);

  /* Las tareas del registro de ese día, para atar cada objetivo a la suya. */
  const [registro, setRegistro] = useState<RegistroTarea[] | "error" | null>(null);

  useEffect(() => {
    let cancelado = false;

    loadRegistro()
      .then((r) => {
        if (!cancelado) setRegistro(r.tareas);
      })
      .catch(() => {
        if (!cancelado) setRegistro("error");
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const tareasDelDia = useMemo<TareaDelDia[]>(() => {
    if (!Array.isArray(registro)) return [];

    const vistas = new Map<string, TareaDelDia>();

    for (const t of registro)
      if (fechaIsoDeHoja(t.fecha) === fecha && !vistas.has(t.tarea))
        vistas.set(t.tarea, { codigo: t.tarea, texto: [t.tipoTarea, t.formato].filter(Boolean).join(" ") || t.contenidoPrincipal });

    return [...vistas.values()];
  }, [registro, fecha]);

  /*
  | ABRE EN EL ÚLTIMO DÍA CON SESIÓN (26/10/2026). Si no se pidió un día en la
  | dirección y hoy no hay sesión en el registro, se abría un día vacío: ahora
  | salta al último día con tareas, sin pasar de hoy. Una sola vez, para no
  | pelearse con quien elija otro día a mano.
  */
  const [saltoHecho, setSaltoHecho] = useState(() => deLaDireccion("fecha") !== null);

  useEffect(() => {
    if (saltoHecho || !Array.isArray(registro)) return;

    const id = setTimeout(() => {
      setSaltoHecho(true);

      const dias = registro.map((t) => fechaIsoDeHoja(t.fecha)).filter((f): f is string => Boolean(f) && f <= hoyDia);

      if (dias.includes(hoyDia) || dias.length === 0) return;

      setFechaEstado(dias.reduce((a, b) => (b > a ? b : a)));
    }, 0);

    return () => clearTimeout(id);
  }, [registro, saltoHecho, hoyDia]);

  /* El plan del día y los equipos de Jugadores sesión (24/10/2026): ver ./SesionDelDia.tsx y lib/sesion-dia/conexion.ts. */
  const planDelDia = useMemo(() => (Array.isArray(registro) ? planDeRegistro(registro, fecha) : []), [registro, fecha]);
  const fechasDelDia = useMemo(() => [fecha], [fecha]);
  const { almacen: almacenEquipos } = useDiasConectados(fechasDelDia, { entreno: false });
  const equiposDelDia = sesionDeFecha(almacenEquipos?.sesiones, fecha);
  const plantillaCastilla = useMemo(() => players.filter((p) => p.esCastilla && p.activo !== false).map((p) => ({ id: p.id, nombre: p.nombre, apodo: p.apodo })), [players]);

  const anteriorConObjetivos = ultimoDiaConObjetivos(dias, fecha);

  const copiaObjetivos = () => {
    if (!anteriorConObjetivos) return;

    /* Con el mismo texto, para que la vista por jugador los empareje; la tarea no se copia (cada día tiene las suyas). */
    cambia((s) => ({
      ...s,
      objetivos: [
        ...s.objetivos,
        ...anteriorConObjetivos.sesion.objetivos.filter((o) => o.objetivo.trim()).map((o) => ({ ...o, id: nuevoId(), tarea: undefined, tareaTexto: undefined })),
      ],
    }));
    toast.success(`Copiados los objetivos del ${ddmm(anteriorConObjetivos.fecha)}`);
  };

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

  const analizados = new Set(analisis?.objetivosAnalizados ?? []);
  const cambiados = analisis ? sesion.objetivos.filter((o) => o.objetivo.trim() && !analizados.has(huellaObjetivo(o))).length : 0;
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
  const cuentanDia = cuantas.correcta + cuantas.mejorable;
  const validadasDia = vivas.filter((a) => sesion.validaciones?.[a.id] && sesion.validaciones[a.id] !== "descartada").length;
  const pctDia = cuentanDia >= MINIMO_PORCENTAJE ? Math.round((100 * cuantas.correcta) / cuentanDia) : null;
  const conTexto = sesion.objetivos.filter((o) => o.objetivo.trim()).length;
  const fuenteUrl = analisis?.fuente.url ?? null;

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Entrenamiento"
              title="Análisis de entrenamiento"
              lead="Objetivos por jugador medidos en el vídeo de la sesión, con clips de lo que se hizo bien y de lo que hay que mejorar, su evolución y el mensaje para cada jugador."
            />

            {/* ---------------- el día ---------------- */}
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Día del entrenamiento" className={`rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-sm text-white ${FOCO}`} />
              <div className="flex max-w-full items-center gap-1 overflow-x-auto scrollbar-none">
                <button type="button" onClick={() => setFecha(mueve(fecha, -7))} aria-label="Semana anterior" title="Semana anterior" className={`shrink-0 rounded-lg border border-white/12 p-1.5 text-white/60 hover:text-white ${FOCO}`}>
                  <ChevronLeft size={14} />
                </button>
                {semana.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFecha(d)}
                    aria-pressed={d === fecha}
                    aria-label={new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                    className={`w-9 shrink-0 rounded-lg py-1.5 text-xs ${FOCO} ${d === fecha ? "bg-[#C8A96B] font-semibold text-black" : d === hoyDia ? "border border-[#C8A96B]/40 text-white/80" : "border border-white/12 text-white/60 hover:text-white"}`}
                    title={new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                  >
                    {DIAS[i]} {Number(d.slice(8))}
                  </button>
                ))}
                <button type="button" onClick={() => setFecha(mueve(fecha, 7))} aria-label="Semana siguiente" title="Semana siguiente" className={`shrink-0 rounded-lg border border-white/12 p-1.5 text-white/60 hover:text-white ${FOCO}`}>
                  <ChevronRight size={14} />
                </button>
              </div>
              {fecha !== hoyDia && (
                <button type="button" onClick={() => setFecha(hoyDia)} className={`rounded-lg px-2 py-1 text-xs text-white/60 hover:text-white hover:underline ${FOCO}`}>
                  Hoy
                </button>
              )}
              <div className="ml-auto">
                <SaveState status={status} localOnly={localOnly} savedAt={lastSavedAt} sinGuardar={sinGuardar} onGuardar={() => void guardaYa()} />
              </div>
            </div>

            <Pestanas
              etiqueta="Vistas del análisis de entrenamiento"
              valor={pestana}
              onCambia={setPestana}
              opciones={[
                { clave: "dia", label: "El día", icono: ClipboardCheck, cuenta: conTexto || undefined },
                { clave: "jugador", label: "Por jugador", icono: UserRound },
              ]}
            />

            {pestana === "jugador" ? (
              historial === null ? (
                <p className="flex items-center gap-1.5 text-sm text-white/60" aria-live="polite">
                  <Loader2 size={13} className="animate-spin" /> Leyendo las sesiones guardadas…
                </p>
              ) : (
                <div className="space-y-4">
                  {historial.error ? (
                    <Notice tone="warn" title="No se han podido leer las sesiones anteriores">
                      Sólo se ve el día abierto.{" "}
                      <button type="button" onClick={() => setTestigoHistorial((n) => n + 1)} className="font-semibold text-[#C8A96B] underline-offset-2 hover:underline">
                        Volver a intentarlo
                      </button>
                    </Notice>
                  ) : null}
                  <VistaJugador
                    dias={dias}
                    fecha={fecha}
                    jugador={jugador}
                    onJugador={setJugador}
                    onIrAlDia={(f) => {
                      setFecha(f);
                      setPestana("dia");
                    }}
                  />
                </div>
              )
            ) : (
              <>
                {/* El día de un vistazo, arriba (29/10/2026): titular, gráficos y cada marca abre sus clips. El detalle por objetivo sigue más abajo. */}
                {analisis && !cargando && vivas.length > 0 ? (
                  <PanelVisual
                    dias={dias}
                    fecha={fecha}
                    onValida={valida}
                    onIrAlDia={(f) => {
                      setFecha(f);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                ) : null}

                <Explicativo>
                  <p className="text-xs text-white/50">
                    El vídeo sale de la cámara táctica si hay una grabación de ese día en la carpeta SESIONES del ordenador del club; si no, del entrenamiento subido a Hudl con la fecha en el título («16102026 RM CASTILLA…»). La IA propone cada acción y su veredicto; se corta un clip de ejemplo correcto y otro mejorable por objetivo. Lo que valides aquí manda en los números.
                  </p>
                </Explicativo>

                {/* ---------------- la sesión del día ---------------- */}
                <SesionDelDia
                  fecha={fecha}
                  plan={planDelDia}
                  equipos={equiposDelDia}
                  entreno={sesion}
                  analisis={analisis}
                  plantilla={plantillaCastilla}
                  nombreDe={(id) => jugadores.find((j) => j.id === id)?.nombre ?? ""}
                  onObjetivo={(o) => {
                    if (status === "loading") return;
                    cambia((s) => ({ ...s, objetivos: [...s.objetivos, { ...o, id: nuevoId() }] }));
                    toast.success("Objetivo creado", { description: `${o.jugadores.length} jugadores · ${o.tarea}. Escribe qué se busca.` });
                  }}
                />

                {/* ---------------- los objetivos ---------------- */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">Objetivos de la sesión</h2>
                    <Button icon={Plus} onClick={() => cambia((s) => ({ ...s, objetivos: [...s.objetivos, { id: nuevoId(), objetivo: "", jugadores: [] }] }))}>
                      Objetivo
                    </Button>
                    {/* Mientras llega el documento no se ofrece: se escribiría encima de lo que hay. */}
                    {status !== "loading" ? (
                      <QueTocaDelPost
                        yaEstan={sesion.objetivos.map((o) => o.origen ?? "").filter(Boolean)}
                        jugadores={jugadores}
                        tareas={tareasDelDia}
                        onAnade={(objetivo) => cambia((s) => ({ ...s, objetivos: [...s.objetivos, { ...objetivo, id: nuevoId() }] }))}
                      />
                    ) : null}
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                      <Button
                        tone="primary"
                        icon={pidiendo ? Loader2 : ClipboardCheck}
                        onClick={() => void pide()}
                        disabled={pidiendo || enCurso || ocupadoConOtro || !conTexto || futuro}
                        title={futuro ? "Este entrenamiento todavía no se ha hecho" : !conTexto ? "Escribe antes algún objetivo" : undefined}
                      >
                        {analisis ? "Volver a analizar" : "Analizar"}
                      </Button>
                      <Button icon={RefreshCw} onClick={relee} title="Releer el análisis" aria-label="Releer el análisis" />
                    </div>
                  </div>

                  {/* Lo que está haciendo el ordenador del club con este día (o con otro). */}
                  {enCurso ? (
                    <div className="space-y-2 rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06] px-4 py-3" aria-live="polite">
                      <p className="flex items-center gap-2 text-sm font-medium text-white">
                        <Loader2 size={14} className="animate-spin text-[#C8A96B]" />
                        {estado === "pedido"
                          ? ordenador?.vivo
                            ? "Pedido: el ordenador del club lo empieza en unos segundos…"
                            : "Pedido, pero el ordenador del club está apagado o sin conexión: empezará en cuanto se encienda."
                          : `Analizando${ordenador?.progreso ? ` · ${ordenador.progreso.porcentaje} %` : "…"}`}
                      </p>
                      {ordenador?.progreso ? (
                        <>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                            <div className="h-full bg-[#C8A96B]" style={{ width: `${ordenador.progreso.porcentaje}%` }} />
                          </div>
                          <p className="text-xs text-white/60">
                            {ordenador.progreso.etapas.find((e) => e.estado === "ahora")?.nombre ?? ""}
                            {` · quedan unos ${duracion(ordenador.progreso.quedan)}`}
                          </p>
                        </>
                      ) : null}
                      <p className="text-xs text-white/50">Puedes cerrar la pantalla: el análisis sigue en el ordenador del club y aparece aquí al terminar.</p>
                    </div>
                  ) : ocupadoConOtro ? (
                    <Notice title={`El ordenador del club está analizando el ${fechaEncargo ? ddmm(fechaEncargo) : "otro día"}`}>Hace uno cada vez: cuando termine, podrás pedir este.</Notice>
                  ) : cortado ? (
                    <Notice tone="warn" title="El análisis de este día se cortó a medias">
                      El ordenador del club se apagó o se quedó colgado. Vuelve a pulsar «Analizar».
                    </Notice>
                  ) : fallo ? (
                    <Notice tone="warn" title={queHacer(fallo).titulo}>
                      <p>{queHacer(fallo).texto}</p>
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-white/50">Detalle para el administrador</summary>
                        <p className="mt-1 break-words font-mono text-[11px]">{fallo}</p>
                      </details>
                    </Notice>
                  ) : null}

                  {status === "loading" && sesion.objetivos.length === 0 ? (
                    /* Mientras llega el documento no se ofrece crear ni copiar: se escribiría encima de lo que hay. */
                    <p className="flex items-center gap-1.5 text-sm text-white/60" aria-live="polite">
                      <Loader2 size={13} className="animate-spin" /> Leyendo los objetivos del día…
                    </p>
                  ) : sesion.objetivos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/12 px-5 py-8 text-center">
                      <p className="text-sm font-medium text-white/75">Sin objetivos para este día</p>
                      <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-white/50">
                        Añade uno: qué se busca, de quién, cómo reconocerlo en el vídeo y qué es correcto o mejorable.
                        {anteriorConObjetivos ? " O copia los del último día para seguir midiendo lo mismo y ver la evolución." : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <Button icon={Plus} tone="primary" onClick={() => cambia((s) => ({ ...s, objetivos: [...s.objetivos, { id: nuevoId(), objetivo: "", jugadores: [] }] }))}>
                          Añadir objetivo
                        </Button>
                        {anteriorConObjetivos ? (
                          <Button icon={Copy} onClick={copiaObjetivos}>
                            Copiar los del {ddmm(anteriorConObjetivos.fecha)} ({anteriorConObjetivos.sesion.objetivos.filter((o) => o.objetivo.trim()).length})
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 xl:grid-cols-2">
                        {sesion.objetivos.map((o, i) => (
                          <ObjetivoEditor
                            key={o.id}
                            objetivo={o}
                            numero={i + 1}
                            jugadores={jugadores}
                            tareas={tareasDelDia}
                            onCambia={(nuevo) => cambia((s) => ({ ...s, objetivos: s.objetivos.map((x) => (x.id === o.id ? nuevo : x)) }))}
                            onQuita={() => cambia((s) => ({ ...s, objetivos: s.objetivos.filter((x) => x.id !== o.id) }))}
                          />
                        ))}
                      </div>
                      {registro === "error" ? (
                        <p className="text-[11px] text-white/45">No se ha podido leer el registro de tareas: escribe la tarea a mano (L-T1, L-T2…).</p>
                      ) : Array.isArray(registro) && !tareasDelDia.length ? (
                        <p className="text-[11px] text-white/45">El registro de tareas todavía no tiene este día: la tarea se puede escribir a mano (L-T1, L-T2…).</p>
                      ) : null}
                    </>
                  )}
                </div>

                {/* ---------------- el análisis ---------------- */}
                {cargando ? (
                  <p className="flex items-center gap-1.5 text-sm text-white/60" aria-live="polite">
                    <Loader2 size={13} className="animate-spin" /> Leyendo el análisis del día…
                  </p>
                ) : leido?.error && !analisis ? (
                  <Notice tone="warn" title="No se ha podido leer el análisis de este día">
                    Comprueba la conexión y pulsa el botón de releer (la flecha circular, junto a «Analizar»).
                  </Notice>
                ) : analisis ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="text-lg font-semibold">Lo que dice el vídeo</h2>
                      <Explicativo>
                        <span className="text-xs text-white/50">
                          {analisis.fuente.tipo === "camara" ? "Cámara táctica" : "Hudl"} · {analisis.fuente.nombre} · {Math.round(analisis.fuente.duracion / 60)} min · {new Date(analisis.hechoEn).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </Explicativo>
                    </div>

                    {/* Las cifras del día viven arriba, en el panel visual (29/10/2026); aquí queda la cuenta de lo validado. */}
                    <p className="text-xs text-white/60">
                      {pctDia !== null ? `Acierto del día ${pctDia} % · ` : ""}
                      {cuentanDia ? `${cuantas.correcta} de ${cuentanDia} correctas · ${validadasDia === cuentanDia ? "todas validadas" : `${validadasDia} validadas`}` : "Ninguna acción cuenta"}
                      {cuantas["sin-validar"] ? ` · ${cuantas["sin-validar"]} propuestas por la IA sin validar: cuentan con su veredicto hasta que las valides` : ""}
                      {cuentanDia && cuentanDia < MINIMO_PORCENTAJE ? ` · con menos de ${MINIMO_PORCENTAJE} acciones no se da porcentaje` : ""}
                    </p>

                    {cambiados > 0 && <Notice tone="warn" title={`${cambiados} ${cambiados === 1 ? "objetivo es nuevo o ha cambiado" : "objetivos son nuevos o han cambiado"} desde el análisis`}>Vuelve a analizar para que cuenten.</Notice>}

                    {vivas.length === 0 ? (
                      <Notice tone="warn" title="El vídeo no ha dado ninguna acción">
                        Lo normal es que la IA no reconozca a los jugadores: añade su peto o su dorsal en «Cómo reconocerlo» y vuelve a analizar.
                      </Notice>
                    ) : cuantas["con-clip"] === 0 ? (
                      <Notice title="Este análisis no trae clips">
                        {fuenteUrl ? "Cada acción tiene un enlace para verla en Hudl en su minuto." : "Cada acción dice su minuto en el vídeo de la cámara táctica."} Si quieres los clips, vuelve a analizar.
                      </Notice>
                    ) : null}

                    {analisis.avisos.length > 0 && (
                      <Explicativo>
                        <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-200/80">
                          {analisis.avisos.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      </Explicativo>
                    )}

                    {vivas.length > 0 ? (
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
                          <button key={k} type="button" aria-pressed={vista === k} onClick={() => setVista(k)} className={`rounded-lg px-3 py-1.5 ${FOCO} ${vista === k ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/65 hover:text-white"}`}>
                            {t} <span className="tabular-nums opacity-70">{cuantas[k]}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {sesion.objetivos.map((o, n) => {
                      const c = cuentas(o.id, analisis.acciones, sesion.validaciones);
                      const medido = analisis.objetivosAnalizados?.some((h) => h.startsWith(`${o.id}|`));
                      const anterior = anteriorDelObjetivo(dias, fecha, o);
                      const cumple = cumpleMeta(c, o.meta);
                      const pendientes = analisis.acciones.filter((a) => a.objetivoId === o.id && !sesion.validaciones?.[a.id]).length;
                      const suyas = analisis.acciones
                        .filter((a) => a.objetivoId === o.id)
                        .filter((a) => {
                          const v = veredictoFinal(a, sesion.validaciones);

                          return vista === "todas" ? true : vista === "sin-validar" ? !sesion.validaciones?.[a.id] : vista === "con-clip" ? Boolean(a.clip) : v === vista;
                        })
                        /* Los ejemplos con clip, primero; después, por minuto. */
                        .sort((a, b) => Number(Boolean(b.clip)) - Number(Boolean(a.clip)) || a.inicio - b.inicio);

                      if (!o.objetivo.trim()) return null;

                      return (
                        <section key={o.id} aria-labelledby={`obj-${o.id}`} className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <header className="flex flex-wrap items-start gap-3">
                            <div className="min-w-0 flex-1 basis-56">
                              <h3 id={`obj-${o.id}`} className="font-semibold text-white">
                                <span className="mr-1.5 text-[#C8A96B]">{n + 1}.</span>
                                {o.objetivo}
                              </h3>
                              <p className="mt-0.5 text-xs text-white/55">
                                {[o.jugadores.map((j) => j.nombre).join(", ") || "Sin jugador", o.tarea ? `Tarea ${o.tarea}${o.tareaTexto ? ` (${o.tareaTexto})` : ""}` : "", o.origen ? `Sale de: ${o.origen}` : ""].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            {medido && c.total ? (
                              <div className="flex items-center gap-4 text-center">
                                <div>
                                  <p className="text-2xl font-semibold tabular-nums text-emerald-300">{c.correctas}</p>
                                  <p className="text-[10px] uppercase tracking-wider text-white/50">Correctas</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-semibold tabular-nums text-amber-300">{c.mejorables}</p>
                                  <p className="text-[10px] uppercase tracking-wider text-white/50">Mejorables</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-semibold tabular-nums text-white">{porcentajeOTendencia(c)}</p>
                                  <p className="text-[10px] uppercase tracking-wider text-white/50">{c.pct !== null ? "Acierto" : `< ${MINIMO_PORCENTAJE} acciones`}</p>
                                </div>
                              </div>
                            ) : null}
                          </header>

                          {!medido ? (
                            <p className="text-sm text-white/60">Este objetivo se añadió o cambió después del análisis: vuelve a analizar para medirlo.</p>
                          ) : (
                            <>
                              {c.total > 0 && (
                                <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                                  <div className="h-full bg-emerald-400" style={{ width: `${c.pctBruto ?? 0}%` }} />
                                  <div className="h-full bg-amber-400" style={{ width: `${100 - (c.pctBruto ?? 0)}%` }} />
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                                <span className="text-white/75">{lecturaCuentas(c)}</span>
                                {o.meta ? (
                                  <span className={`rounded-md px-1.5 py-0.5 font-semibold ${cumple === true ? "bg-emerald-400/15 text-emerald-300" : cumple === false ? "bg-amber-400/15 text-amber-300" : "bg-white/[0.06] text-white/60"}`}>
                                    Meta {o.meta} %{cumple === true ? ": cumplida" : cumple === false ? ": por debajo" : c.total ? ": falta muestra" : ""}
                                  </span>
                                ) : null}
                                {anterior ? (
                                  <span className="text-white/55">
                                    Sesión anterior ({ddmm(anterior.fecha)}): {anterior.cuentas.correctas} de {anterior.cuentas.total}
                                    {anterior.cuentas.pct !== null ? ` (${anterior.cuentas.pct} %)` : ""}
                                    {c.pctBruto !== null && anterior.cuentas.pctBruto !== null
                                      ? c.pctBruto - anterior.cuentas.pctBruto >= 5
                                        ? " → mejora"
                                        : c.pctBruto - anterior.cuentas.pctBruto <= -5
                                          ? " → baja"
                                          : " → igual"
                                      : ""}
                                  </span>
                                ) : null}
                                {pendientes > 0 && (
                                  <Button icon={CheckCheck} onClick={() => validaResto(o.id)} title="Las que quedan sin validar se dan por buenas con el veredicto de la IA">
                                    Validar las {pendientes} que quedan como dice la IA
                                  </Button>
                                )}
                              </div>

                              {suyas.length === 0 ? (
                                <p className="text-sm text-white/60">
                                  {c.propuestas ? "Nada con este filtro." : "El vídeo no ha dado acciones de este objetivo. Lo normal es que la IA no reconozca al jugador: añade su peto o dorsal en «Cómo reconocerlo» y vuelve a analizar."}
                                </p>
                              ) : (
                                <ul className="grid gap-3 lg:grid-cols-2">
                                  {suyas.map((a) => {
                                    const v = veredictoFinal(a, sesion.validaciones);
                                    const val = sesion.validaciones?.[a.id];

                                    return (
                                      <li
                                        key={a.id}
                                        /* Lo validado, con borde continuo; lo que sólo propuso la IA, discontinuo. */
                                        className={`min-w-0 space-y-2 rounded-xl border p-3 ${val ? "border-solid" : "border-dashed"} ${v === null ? "border-white/5 opacity-60" : v === "correcta" ? "border-emerald-400/30" : "border-amber-400/30"}`}
                                      >
                                        {a.clip ? (
                                          <div className="space-y-1">
                                            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/50">
                                              <Film size={11} aria-hidden /> Clip · {mmss(a.inicio)}
                                              {o.tarea ? ` · ${o.tarea}` : ""}
                                            </p>
                                            <video src={a.clip} controls preload="metadata" playsInline className="aspect-video w-full rounded-lg bg-black" />
                                          </div>
                                        ) : fuenteUrl ? (
                                          <a href={fuenteUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded text-xs text-[#C8A96B] hover:underline ${FOCO}`} title="Sin clip: sólo se corta un ejemplo de cada veredicto por objetivo">
                                            <Play size={12} aria-hidden /> Verla en Hudl: minuto {mmss(a.inicio)}
                                          </a>
                                        ) : (
                                          <p className="text-[11px] text-white/50">Sin clip · minuto {mmss(a.inicio)} del vídeo de la sesión</p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          <span className="tabular-nums text-white/55">
                                            {mmss(a.inicio)}–{mmss(a.fin)}
                                          </span>
                                          <span className={`rounded-md px-1.5 py-0.5 font-semibold ${v === "correcta" ? "bg-emerald-400/20 text-emerald-300" : v === "mejorable" ? "bg-amber-400/20 text-amber-300" : "bg-white/10 text-white/60"}`}>
                                            {v === null ? "Descartada" : v === "correcta" ? "Correcta" : "Mejorable"}
                                          </span>
                                          {val ? (
                                            <span className="inline-flex items-center gap-0.5 font-medium text-white/75">
                                              <Check size={12} aria-hidden /> Validada{val !== "descartada" && val !== a.veredicto ? " (cambiada)" : ""}
                                            </span>
                                          ) : (
                                            <span className="rounded-md border border-dashed border-white/20 px-1.5 py-0.5 text-white/55">Propuesta de la IA</span>
                                          )}
                                          {a.jugador ? <span className="min-w-0 truncate text-white/50">{a.jugador}</span> : null}
                                        </div>
                                        <p className="text-sm text-white/80">{a.explicacion}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          <Button icon={ThumbsUp} tone={val === "correcta" ? "primary" : "ghost"} aria-pressed={val === "correcta"} onClick={() => valida(a.id, val === "correcta" ? null : "correcta")} title={val === "correcta" ? "Quitar la validación" : "Es correcta"}>
                                            Correcta
                                          </Button>
                                          <Button icon={ThumbsDown} tone={val === "mejorable" ? "primary" : "ghost"} aria-pressed={val === "mejorable"} onClick={() => valida(a.id, val === "mejorable" ? null : "mejorable")} title={val === "mejorable" ? "Quitar la validación" : "Es mejorable"}>
                                            Mejorable
                                          </Button>
                                          <Button icon={X} tone="danger" aria-pressed={val === "descartada"} onClick={() => valida(a.id, val === "descartada" ? null : "descartada")} title={val === "descartada" ? "Recuperarla" : "No es de este objetivo o no se ve"}>
                                            {val === "descartada" ? "Recuperar" : "Descartar"}
                                          </Button>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </>
                          )}
                        </section>
                      );
                    })}
                  </div>
                ) : conTexto && !enCurso ? (
                  <div className="rounded-xl border border-dashed border-white/12 px-5 py-6 text-center">
                    <p className="text-sm font-medium text-white/75">{futuro ? "Este entrenamiento todavía no se ha hecho" : "Este día todavía no tiene análisis"}</p>
                    <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-white/50">
                      {futuro
                        ? "Deja preparados los objetivos; el día del entrenamiento, con el vídeo ya subido, pulsa «Analizar»."
                        : "Cuando los objetivos estén completos y el vídeo subido, pulsa «Analizar». El ordenador del club lo hace solo y suele tardar entre media hora y una hora; puedes cerrar la pantalla mientras."}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-white/75">Notas de la sesión</h2>
                  <textarea value={sesion.notas ?? ""} onChange={(e) => cambia((s) => ({ ...s, notas: e.target.value }))} rows={3} placeholder="Lo que quieras apuntar del entrenamiento" aria-label="Notas de la sesión" className={`${CAMPO} resize-y`} />
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
