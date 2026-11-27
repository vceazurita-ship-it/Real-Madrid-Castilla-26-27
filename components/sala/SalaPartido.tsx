"use client";

/*
|--------------------------------------------------------------------------
| SALA DE PARTIDO (24/11/2026) — /directo
|--------------------------------------------------------------------------
|
| El directo de Opta como una sala de control: marcador con la probabilidad
| en vivo, el pulso del partido, la carrera de xG, el campo con los remates,
| el territorio o la red de pases, lo que está pasando contra lo que suele
| hacer cada equipo (la previa), el cara a cara y quién está marcando el
| partido. Con REPETICIÓN: cualquier partido ya jugado se puede ver minuto a
| minuto (×30, ×60, ×120, ×300) o saltar al minuto que se quiera.
|
| Dos fuentes: el Castilla (opta:directo, el directo de la categoría) y el
| primer equipo (opta:rm, scripts/opta-directo-rm.cmd). Juvenil A y RM C no
| están en Opta ProVision. Mientras el partido no ha acabado, se relee cada
| 30 s. Cuentas en lib/sala/modelo.ts; piezas en components/sala/piezas.tsx.
*/

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Maximize2, Minimize2, Pause, Play, Radio, SkipForward } from "lucide-react";

import { useAdmin } from "@/hooks/useAdmin";
import { alDia, alertas, calibracion, cifrasHasta, esAcabado, fichasDeGol, queTocar, hitos as hitosDe, inicioSegunda, parteEn, partidoDe, probabilidad, reloj, resultadoJusto, titular, tramoDe, type DocPartido, type Partido, type TramoClave } from "@/lib/sala/modelo";
import { traeJson } from "@/lib/hojaCsv";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { filaDelPlan, planEnElCampo, rumbo, type FilaPlan } from "@/lib/sala/rumbo";
import { AbpTransiciones, Alertas, Campo, Duelo, HaciaDonde, PlanEnCampo, Jugadores, Lectura, Linea, Marcador, Probabilidad, Pulso, S, SelectorTramo, Tramos, type Capa } from "./piezas";

type Fuente = "castilla" | "rm";
type EntradaArchivo = { partido: string; fecha?: string; equipos?: string[]; goles?: (number | null)[]; estado?: string };
type Indice = { actualizado?: string; partidos?: (EntradaArchivo & { conDatos?: boolean })[] };

const FUENTES: Record<Fuente, { nombre: string; indice: string; archivo: string; prefijo: string }> = {
  castilla: { nombre: "Castilla", indice: "opta:directo", archivo: "opta:directo:archivo", prefijo: "opta:directo:" },
  rm: { nombre: "Primer equipo", indice: "opta:rm", archivo: "opta:rm:archivo", prefijo: "opta:rm:" },
};

const VELOCIDADES = [30, 60, 120, 300];
const RELEE_MS = 30_000;

async function doc<T>(clave: string): Promise<T | null> {
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(clave)}`, { cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json())?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

const nombreLista = (n: string) => (n === "Real Madrid II" ? "Castilla" : n);
const fechaCorta = (f?: string) => (f ? new Date(`${String(f).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "");
const leeUrl = () => {
  if (typeof window === "undefined") return { fuente: null as Fuente | null, partido: "", tv: false };
  const q = new URLSearchParams(window.location.search);
  const f = q.get("fuente");
  return { fuente: f === "rm" || f === "castilla" ? (f as Fuente) : null, partido: q.get("partido") ?? "", tv: q.get("tv") === "1" };
};

export function SalaPartido() {
  const [fuente, setFuente] = useState<Fuente>("castilla");
  const [lista, setLista] = useState<EntradaArchivo[]>([]);
  const [vivos, setVivos] = useState<Set<string>>(new Set());
  const [elegido, setElegido] = useState("");
  const [partido, setPartido] = useState<Partido | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [t, setT] = useState(0);
  const [siguiendo, setSiguiendo] = useState(true);
  const [reproduce, setReproduce] = useState(false);
  const [velocidad, setVelocidad] = useState(60);
  const [capa, setCapa] = useState<Capa>("remates");
  const [pantalla, setPantalla] = useState(false);
  const [tramo, setTramo] = useState<TramoClave>("todo");
  /* Modo TV (26/11/2026): pantalla completa o ?tv=1. La barra se esconde tras 3 s sin mover el ratón. */
  const [quieta, setQuieta] = useState(false);
  const [tvUrl, setTvUrl] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  /* El primer equipo, de momento sólo para el administrador (27/11/2026; la API tampoco lo sirve a nadie más). */
  const { admin } = useAdmin();
  const fuentes = (Object.keys(FUENTES) as Fuente[]).filter((f) => f !== "rm" || admin);
  const inicial = useRef(leeUrl());

  /* La fuente pedida en el enlace, una vez. */
  useEffect(() => {
    const f = inicial.current.fuente;
    if (f === "castilla") void Promise.resolve().then(() => setFuente(f));
    if (inicial.current.tv) void Promise.resolve().then(() => setTvUrl(true));
  }, []);
  /* «?fuente=rm» sólo vale con la sesión de administrador (se sabe un poco después). */
  useEffect(() => {
    if (admin && inicial.current.fuente === "rm") {
      inicial.current.fuente = null;
      void Promise.resolve().then(() => setFuente("rm"));
    }
  }, [admin]);

  /* La lista: los de hoy (índice) y el archivo. En el Castilla, sólo sus partidos. */
  useEffect(() => {
    let vivo = true;
    const F = FUENTES[fuente];
    void (async () => {
      const [indice, archivo] = await Promise.all([doc<Indice>(F.indice), doc<{ partidos?: EntradaArchivo[] }>(F.archivo)]);
      if (!vivo) return;
      const delDia = (indice?.partidos ?? []).filter((x) => x.conDatos);
      const todos = new Map<string, EntradaArchivo>();
      for (const x of [...delDia, ...(archivo?.partidos ?? [])]) if (!todos.has(x.partido)) todos.set(x.partido, x);
      let entradas = [...todos.values()];
      if (fuente === "castilla") entradas = entradas.filter((x) => (x.equipos ?? []).includes("Real Madrid II"));
      entradas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      setLista(entradas);
      /* La misma regla de «acabado» que la sala (antes «Finished» salía como en directo). */
      const enJuego = new Set(delDia.filter((x) => !esAcabado(String(x.estado ?? ""))).map((x) => x.partido));
      setVivos(enJuego);
      const pedido = inicial.current.partido;
      inicial.current.partido = "";
      setElegido((antes) => (pedido && todos.has(pedido) ? pedido : antes && entradas.some((x) => x.partido === antes) ? antes : (entradas.find((x) => enJuego.has(x.partido)) ?? entradas[0])?.partido ?? ""));
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [fuente]);

  /* El partido: se lee y, si no ha acabado, se relee cada 30 s. */
  useEffect(() => {
    if (!elegido) return;
    let vivo = true;
    let reloj: number | undefined;
    const lee = async (primera: boolean) => {
      const d = await doc<DocPartido>(`${FUENTES[fuente].prefijo}${elegido}`);
      if (!vivo) return;
      const p = d ? partidoDe(d) : null;
      /* Revisión 24/11/2026: una lectura fallida en pleno directo no borra la pantalla ni para el sondeo. */
      if (p || primera) setPartido(p);
      if (primera && !p) setError("No se ha podido leer el partido. Se vuelve a intentar en 30 s.");
      if (p) setError("");
      if (primera && p) {
        /* Acabado: se abre en el final (y se puede repetir). En juego: siguiendo el directo. */
        setT(p.ultimo);
        setSiguiendo(true);
        setReproduce(false);
      }
      if (!p || !p.acabado) reloj = window.setTimeout(() => void lee(!p && primera), RELEE_MS);
    };
    void lee(true);
    return () => {
      vivo = false;
      window.clearTimeout(reloj);
    };
  }, [elegido, fuente]);

  /* Siguiendo el directo: el minuto va con lo último que ha llegado. */
  useEffect(() => {
    if (siguiendo && partido && !reproduce) void Promise.resolve().then(() => setT(partido.ultimo));
  }, [partido, siguiendo, reproduce]);

  /* La repetición: un minuto de partido cada 60/velocidad segundos. */
  useEffect(() => {
    if (!reproduce || !partido) return;
    let antes = performance.now();
    let id = 0;
    const paso = (ahora: number) => {
      const dt = (ahora - antes) / 1000;
      antes = ahora;
      setT((x) => {
        const n = x + (dt * velocidad) / 60;
        if (n >= partido.ultimo) {
          setReproduce(false);
          return partido.ultimo;
        }
        return n;
      });
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [reproduce, velocidad, partido]);

  const alterna = useCallback(() => {
    if (!partido) return;
    setSiguiendo(false);
    setReproduce((r) => {
      if (!r && t >= partido.ultimo - 0.5) setT(0);
      return !r;
    });
  }, [partido, t]);

  const completa = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await raiz.current?.requestFullscreen();
    } catch {
      /* el navegador no deja */
    }
  }, []);

  /* Teclado: espacio repite o para, flechas ±1′, F pantalla completa. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      /* Ctrl/Cmd+F sigue siendo «buscar» del navegador; y en un botón, el espacio es del botón. */
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!partido || (e.target as HTMLElement)?.closest("input, select, textarea, button, a")) return;
      if (e.code === "Space") {
        e.preventDefault();
        alterna();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        setSiguiendo(false);
        setReproduce(false);
        setT((x) => Math.max(0, Math.min(partido.ultimo, x + (e.key === "ArrowRight" ? 1 : -1))));
      } else if (e.key.toLowerCase() === "f") void completa();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [partido, alterna, completa]);

  useEffect(() => {
    const cambia = () => setPantalla(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", cambia);
    return () => document.removeEventListener("fullscreenchange", cambia);
  }, []);

  const k = useMemo(() => (partido ? calibracion(partido) : null), [partido]);
  /* El plan de partido (hoja de rivales, la copia del aparato): sólo en partidos del Castilla. */
  const [filasPlan, setFilasPlan] = useState<FilaPlan[]>([]);
  const conPlan = fuente === "castilla" && !!partido?.nuestro;
  useEffect(() => {
    if (!conPlan) return;
    let vivo = true;
    traeJson<unknown>("/api/rivals?action=rivales&rancia=1", { alRenovar: (d) => vivo && Array.isArray(d) && setFilasPlan(d as FilaPlan[]) })
      .then((d) => vivo && Array.isArray(d) && setFilasPlan(d as FilaPlan[]))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [conPlan]);
  /*
   * El minuto de los paneles (26/11/2026, «hay bugs en la sala»): en la
   * repetición se recalculaba todo en cada fotograma y en el móvil iba a 6
   * imágenes por segundo (tareas de 400 ms). Ahora los paneles van por minuto
   * entero mientras se repite (el reloj ya se pinta por minuto) y en segundo
   * plano (useDeferredValue): la barra y el reloj siguen fluidos.
   */
  const tVista = useDeferredValue(reproduce ? Math.floor(t) : t);

  const enDirecto = !!partido && !partido.acabado && vivos.has(partido.id);
  const modo: "vivo" | "repeticion" | "final" = enDirecto && siguiendo ? "vivo" : partido?.acabado && t >= partido.ultimo - 0.01 && !reproduce ? "final" : "repeticion";

  const calculo = useMemo(() => {
    if (!partido || !k) return null;
    const bruto = cifrasHasta(partido, tVista);
    /* El xG del marcador, el oficial de Opta con lo último leído (Opta junta los remates de una misma jugada: el penalti parado y su rechace no suman 1,0). */
    const xL = partido.local.opta.ExpG, xV = partido.visitante.opta.ExpG;
    const c = alDia(partido, tVista) && xL != null && xV != null ? { ...bruto, L: { ...bruto.L, xg: xL }, V: { ...bruto.V, xg: xV } } : bruto;
    return {
      c,
      prob: probabilidad(partido, tVista, c.L.goles, c.V.goles, c.L.xg, c.V.xg),
      justo: resultadoJusto(c.tiros),
      titular: titular(partido, tVista, c, modo === "final"),
      alertas: alertas(partido, tVista, k),
      hitos: hitosDe(partido, tVista),
      hitosTodos: hitosDe(partido, partido.ultimo),
      parte: parteEn(partido, tVista),
      fichas: fichasDeGol(partido, tVista),
    };
  }, [partido, tVista, k, modo]);
  const haciaDonde = useMemo(() => (partido ? rumbo(partido, tVista) : null), [partido, tVista]);
  const plan = useMemo(() => {
    if (!partido || !conPlan || !filasPlan.length) return null;
    const fila = filaDelPlan(filasPlan, partido, mismoClub);
    return fila ? { cruces: planEnElCampo(partido, fila, tVista), jornada: fila.JORNADA ? `jornada ${String(fila.JORNADA)}` : "" } : null;
  }, [partido, conPlan, filasPlan, tVista]);
  /* Lo que ya dicen los avisos no se repite en la lectura (experto de análisis). */
  const omitirBase = useMemo(() => (calculo?.alertas ?? []).map((a) => a.clave), [calculo]);
  const tocar = useMemo(() => {
    if (!partido || !k || !calculo) return [];
    const p1 = tramoDe(partido, "p1", tVista);
    const enDescanso = parteEn(partido, tVista) === 1 && tVista >= 44;
    const v = tramo !== "todo" ? tramoDe(partido, tramo, tVista) : enDescanso ? p1 : null;
    const w = v ?? tramoDe(partido, "todo", tVista);
    return w && tVista >= 15 ? queTocar(partido, w.desde, w.hasta, w.parte, k) : [];
  }, [partido, k, calculo, tramo, tVista]);
  const clavesTocar = useMemo(() => new Set(tocar.map((x) => x.clave)), [tocar]);
  const omitir = useMemo(() => new Set([...omitirBase, ...clavesTocar]), [omitirBase, clavesTocar]);
  /* Los avisos que «Qué tocar» ya convierte en consigna no se repiten arriba (experto de análisis). */
  const avisos = useMemo(() => (calculo?.alertas ?? []).filter((a) => !clavesTocar.has(a.clave)), [calculo, clavesTocar]);

  /* El tramo que se mira: si el elegido aún no existe (2.ª parte en el minuto 20), todo el partido. */
  const disponibles = useMemo(() => {
    const d: Record<TramoClave, boolean> = { todo: true, p1: true, p2: false, u15: false, cambio: false };
    if (!partido) return d;
    d.p2 = !!tramoDe(partido, "p2", tVista);
    d.u15 = tVista >= 16;
    d.cambio = !!tramoDe(partido, "cambio", tVista);
    return d;
  }, [partido, tVista]);
  const ventana = useMemo(() => (partido ? ((disponibles[tramo] ? tramoDe(partido, tramo, tVista) : null) ?? tramoDe(partido, "todo", tVista)) : null), [partido, tramo, tVista, disponibles]);
  /* La lectura: en el descanso, de la 1.ª parte; al final, del partido; si se elige un tramo, de ese tramo. */
  const lectura = useMemo(() => {
    if (!partido || !ventana) return null;
    const enDescanso = parteEn(partido, tVista) === 1 && tVista >= 44;
    if (tramo !== "todo" && disponibles[tramo]) return { v: ventana, titulo: `Lectura · ${ventana.nombre}` };
    if (modo === "final") return { v: ventana, titulo: "Lectura del partido" };
    const p1 = tramoDe(partido, "p1", tVista);
    if (enDescanso && p1) return { v: p1, titulo: "Para el descanso" };
    if (tVista >= inicioSegunda(partido) + 1 && tVista < inicioSegunda(partido) + 15 && p1) return { v: p1, titulo: "Lo que dejó la 1.ª parte" };
    return tVista >= 15 ? { v: ventana, titulo: `Lectura hasta el ${reloj(tVista)}` } : null;
  }, [partido, ventana, tramo, modo, tVista, disponibles]);

  /*
   * Los paneles, memorizados: en la repetición el minuto cambia en cada
   * fotograma y, sin esto, se volvían a pintar todos los SVG aunque sus datos
   * (tVista) fueran los mismos. Sólo la barra se repinta a cada fotograma.
   */
  const paneles = useMemo(
    () =>
      partido && calculo && k && ventana ? (
          <div className="mt-4 grid gap-4">
            <Marcador p={partido} t={tVista} c={calculo.c} modo={modo} parte={calculo.parte} prob={calculo.prob} justo={calculo.justo} titular={calculo.titular} hitos={calculo.hitos} fichas={calculo.fichas} k={k} />

            {/* En el móvil, los avisos van justo después del marcador (el experto de fútbol: es lo primero que se lee en el banquillo). */}
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="grid min-w-0 content-start gap-4 xl:col-start-2 xl:row-start-1">
                <Alertas lista={avisos} p={partido} final={modo === "final"} />
                {haciaDonde && <HaciaDonde p={partido} r={haciaDonde} final={modo === "final"} />}
                {lectura && <Lectura p={partido} v={lectura.v} titulo={lectura.titulo} omitir={omitir} tocar={tocar.map((x) => x.texto)} final={modo === "final"} />}
              </div>
              <div className="grid min-w-0 content-start gap-3 xl:col-start-1 xl:row-start-1">
                <SelectorTramo valor={disponibles[tramo] ? tramo : "todo"} onCambia={setTramo} disponibles={disponibles} />
                <Campo p={partido} t={tVista} v={ventana} capa={capa} setCapa={setCapa} />
              </div>
            </div>

            {plan && plan.cruces.length > 0 && <PlanEnCampo cruces={plan.cruces} jornada={plan.jornada} />}

            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <Duelo p={partido} v={ventana} k={k} />
              <div className="grid min-w-0 content-start gap-4">
                <AbpTransiciones p={partido} v={ventana} />
                <Tramos p={partido} t={tVista} />
              </div>
            </div>

            <Jugadores p={partido} v={ventana} />

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Pulso p={partido} t={tVista} hitos={calculo.hitos} />
              <Probabilidad p={partido} t={tVista} hitos={calculo.hitos} />
            </div>

            <p className="text-center text-[12px]" style={{ color: S.tenue }}>
              Opta ProVision · {partido.liga || (fuente === "castilla" ? "Primera RFEF" : "")} · todo se cuenta desde el evento a evento hasta el minuto que se ve
              {partido.actualizado ? ` · leído ${new Date(partido.actualizado).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""} · Juvenil A y RM C no están en Opta.
            </p>
          </div>
      ) : null,
    [partido, calculo, k, ventana, tVista, modo, avisos, lectura, omitir, tocar, disponibles, tramo, capa, fuente, haciaDonde, plan],
  );

  const tv = pantalla || tvUrl;
  useEffect(() => {
    if (!tv) return;
    let espera = window.setTimeout(() => setQuieta(true), 3000);
    const mueve = () => {
      setQuieta(false);
      window.clearTimeout(espera);
      espera = window.setTimeout(() => setQuieta(true), 3000);
    };
    window.addEventListener("pointermove", mueve);
    window.addEventListener("keydown", mueve);
    return () => {
      window.clearTimeout(espera);
      window.removeEventListener("pointermove", mueve);
      window.removeEventListener("keydown", mueve);
    };
  }, [tv]);

  return (
    <div ref={raiz} className={`sala-raiz siempre-oscuro min-h-screen overflow-y-auto ${tv ? "sala-tv" : ""} ${tv && quieta ? "sala-quieta" : ""}`} style={{ background: `radial-gradient(1200px 600px at 50% -10%, rgba(30,70,150,0.35), transparent), radial-gradient(900px 500px at 100% 100%, rgba(20,120,110,0.12), transparent), ${S.fondo}`, color: S.texto }}>
      {/* Rejilla tenue de fondo: la sala. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(140,190,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(140,190,255,1) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className={`sala-contenido relative mx-auto px-3 pb-36 pt-3 sm:pb-28 sm:px-6 ${tv ? "max-w-[1920px]" : "max-w-[1600px]"}`}>
        <header className="flex min-w-0 flex-wrap items-center gap-3">
          {!pantalla && (
            <Link href="/data-analisis?area=directo" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ border: `1px solid ${S.borde}`, color: S.suave }}>
              <ChevronLeft size={14} aria-hidden /> Volver
            </Link>
          )}
          <p className="flex items-center gap-2 fuente-club text-[20px] uppercase tracking-[0.24em]">
            <Radio size={18} style={{ color: enDirecto ? "#FF4D6D" : S.info }} className={enDirecto ? "sala-latido" : ""} aria-hidden />
            Sala de partido
          </p>
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
            {fuentes.length > 1 && <div className="flex rounded-full p-0.5" style={{ border: `1px solid ${S.borde}`, background: "rgba(255,255,255,0.03)" }}>
              {fuentes.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    /* La fuente que ya está: nada (antes se quedaba en «Abriendo la sala…»). */
                    if (f === fuente) return;
                    setError("");
                    setCargando(true);
                    setPartido(null);
                    setElegido("");
                    setFuente(f);
                  }}
                  aria-pressed={fuente === f}
                  className="rounded-full px-3 py-1 text-[12px] font-semibold"
                  style={{ background: fuente === f ? "rgba(120,190,255,0.22)" : "transparent", color: fuente === f ? S.texto : S.suave }}
                >
                  {FUENTES[f].nombre}
                </button>
              ))}
            </div>}
            <label className="sr-only" htmlFor="sala-partido">
              Partido
            </label>
            <select
              id="sala-partido"
              value={elegido}
              onChange={(e) => {
                setPartido(null);
                setElegido(e.target.value);
              }}
              className="max-w-[min(26rem,80vw)] rounded-full px-3 py-1.5 text-[12px] font-semibold"
              style={{ background: "#0A1730", color: S.texto, border: `1px solid ${S.borde}` }}
            >
              {lista.map((x) => (
                <option key={x.partido} value={x.partido}>
                  {vivos.has(x.partido) ? "● EN DIRECTO · " : ""}
                  {fechaCorta(x.fecha)} · {(x.equipos ?? []).map(nombreLista).join(" – ")}
                  {x.goles?.length === 2 && x.goles.every((g) => g != null) ? `  ${x.goles.join("-")}` : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void completa()} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ border: `1px solid ${S.borde}`, color: S.suave }} title="Pantalla completa (F)">
              {pantalla ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
              {pantalla ? "Salir" : "Pantalla completa"}
            </button>
          </div>
        </header>

        {cargando && <p className="py-24 text-center text-[14px]" style={{ color: S.tenue }}>Abriendo la sala…</p>}
        {!cargando && !lista.length && (
          <p className="py-24 text-center text-[14px]" style={{ color: S.tenue }}>
            Todavía no hay partidos guardados de {FUENTES[fuente].nombre.toLowerCase()}.
          </p>
        )}
        {!cargando && lista.length > 0 && !partido && <p className="py-24 text-center text-[14px]" style={{ color: S.tenue }}>{error || "Cargando el partido…"}</p>}

        {paneles}
      </div>

      {/* La barra de la repetición, siempre a mano. */}
      {partido && calculo && (
        <div className="sala-barra fixed inset-x-0 bottom-0 z-30" style={{ background: "linear-gradient(180deg, rgba(3,8,18,0.55), #030812 22%)", borderTop: "1px solid rgba(120,170,255,0.14)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          {/* En el móvil, dos filas: la línea del tiempo a todo el ancho arriba (antes se quedaba en 100 px) y los mandos debajo, con hueco para el «⋮». */}
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-0.5 px-3 pb-3 pt-1 sm:flex-nowrap sm:gap-y-0 sm:pl-6 sm:pr-20 sm:pt-3">
            <button type="button" onClick={alterna} className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: "linear-gradient(135deg, #3D8BFF, #2BE3A0)", color: "#031020", boxShadow: "0 0 24px rgba(80,170,255,0.6)" }} aria-label={reproduce ? "Pausa" : "Repetir"} title="Espacio">
              {reproduce ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <select value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} aria-label="Velocidad de la repetición" className="rounded-full px-2 py-1 font-mono text-[12px]" style={{ background: "#0A1730", color: S.texto, border: `1px solid ${S.borde}` }}>
              {VELOCIDADES.map((v) => (
                <option key={v} value={v}>
                  ×{v}
                </option>
              ))}
            </select>
            <div className="order-first w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
              <Linea
                p={partido}
                t={t}
                max={Math.max(partido.ultimo, 1)}
                hitos={calculo.hitosTodos}
                final={modo === "final"}
                onCambia={(m) => {
                  setSiguiendo(false);
                  setReproduce(false);
                  setT(m);
                }}
              />
            </div>
            {/* El mismo reloj que el marcador («45+2′», «90+3′»). */}
            <span className="ml-auto w-16 text-right font-mono text-[14px] font-bold tabular-nums sm:ml-0">{reloj(Math.min(t, partido.ultimo - 0.01), calculo.parte)}</span>
            {enDirecto && !siguiendo && (
              <button
                type="button"
                onClick={() => {
                  setReproduce(false);
                  setSiguiendo(true);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold"
                style={{ background: "rgba(255,60,90,0.18)", color: "#FF6B86", border: "1px solid rgba(255,80,110,0.5)" }}
              >
                <SkipForward size={13} aria-hidden /> Al directo
              </button>
            )}
            <span aria-hidden className="w-11 shrink-0 sm:hidden" />
          </div>
        </div>
      )}
    </div>
  );
}
