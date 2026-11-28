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
import { ArrowUpRight, ChevronLeft, Maximize2, Minimize2, Pause, Play, Radio, SkipForward } from "lucide-react";

import { useAdmin } from "@/hooks/useAdmin";
import { alDia, alertas, calibracion, cifrasHasta, esAcabado, fichasDeGol, queTocar, hitos as hitosDe, inicioSegunda, nombreEquipoCorto, parteEn, partidoDe, probabilidad, reloj, resultadoJusto, titular, tramoDe, type DocPartido, type Partido, type TramoClave } from "@/lib/sala/modelo";
import { traeJson } from "@/lib/hojaCsv";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { urlPostDelPartido } from "@/lib/post-partido";
import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";
import { filaDelPlan, planEnElCampo, rumbo, type FilaPlan } from "@/lib/sala/rumbo";
import { AvisoDominio, useTemporadaDescanso } from "./AvisoDominio";
import { dominioSinPremio } from "@/lib/sala/dominio";
import { CASTILLA_EN_OPTA, estructuraLiga, nombreLista, type EntradaLiga, type Liga } from "@/lib/sala/liga";
import { AbpTransiciones, Alertas, Campo, Duelo, HaciaDonde, PlanEnCampo, Jugadores, Lectura, Linea, Marcador, Probabilidad, Pulso, QueTocamos, S, SelectorTramo, Tramos, type Capa, type EnlaceJugador } from "./piezas";

type Fuente = "castilla" | "rm";
type EntradaArchivo = EntradaLiga;
type Indice = { actualizado?: string; partidos?: (EntradaArchivo & { conDatos?: boolean })[] };
/* 28/11/2026 (el analista: «cualquier partido de Primera RFEF»): qué partidos se ofrecen. */
type ModoLista = "castilla" | "jornada" | "equipo";

const FUENTES: Record<Fuente, { nombre: string; indice: string; archivo: string; prefijo: string }> = {
  castilla: { nombre: "Castilla", indice: "opta:directo", archivo: "opta:directo:archivo", prefijo: "opta:directo:" },
  rm: { nombre: "Primer equipo", indice: "opta:rm", archivo: "opta:rm:archivo", prefijo: "opta:rm:" },
};

const VELOCIDADES = [30, 60, 120, 300];
const RELEE_MS = 30_000;

/*
| 28/11/2026: cada documento espera como mucho 12 s y, si no llega, se pide una
| vez más. La primera petición tras despertar el servidor tardaba y la sala se
| quedaba en «Abriendo la sala…».
*/
async function doc<T>(clave: string, intentos = 2): Promise<T | null> {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(`/api/docs?key=${encodeURIComponent(clave)}`, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
      if (!r.ok) return null;
      return ((await r.json())?.data ?? null) as T | null;
    } catch {
      /* Plazo agotado o sin red: otra vez (y, a la segunda, nada). */
    }
  }
  return null;
}

const fechaCorta = (f?: string) => (f ? new Date(`${String(f).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "");
const leeUrl = () => {
  if (typeof window === "undefined") return { fuente: null as Fuente | null, partido: "", tv: false, equipo: "", jornada: 0 };
  const q = new URLSearchParams(window.location.search);
  const f = q.get("fuente");
  return { fuente: f === "rm" || f === "castilla" ? (f as Fuente) : null, partido: q.get("partido") ?? "", tv: q.get("tv") === "1", equipo: q.get("equipo") ?? "", jornada: Number(q.get("jornada")) || 0 };
};
const porFecha = (a: EntradaArchivo, b: EntradaArchivo) => String(b.fecha).localeCompare(String(a.fecha));
/** Los partidos que se ofrecen en el desplegable, según el modo. */
function filtraLista(todas: EntradaArchivo[], fuente: Fuente, modo: ModoLista, liga: Liga, jornada: number, equipo: string): EntradaArchivo[] {
  if (fuente === "rm") return [...todas].sort(porFecha);
  if (modo === "castilla") return todas.filter((x) => (x.equipos ?? []).includes(CASTILLA_EN_OPTA)).sort(porFecha);
  if (modo === "equipo") return todas.filter((x) => (x.equipos ?? []).includes(equipo)).sort(porFecha);
  /* Por jornada: primero el grupo del Castilla. */
  const g = (x: EntradaArchivo) => liga.grupoDe.get(x.equipos?.[0] ?? "") ?? 0;
  return todas.filter((x) => liga.jornadaDe.get(x.partido) === jornada).sort((a, b) => g(a) - g(b) || String(a.fecha).localeCompare(String(b.fecha)));
}

export function SalaPartido() {
  const [fuente, setFuente] = useState<Fuente>("castilla");
  /* Todo el archivo de la fuente (los dos grupos de Primera RFEF) y lo que se ofrece de él. */
  const [todas, setTodas] = useState<EntradaArchivo[]>([]);
  const [modoLista, setModoLista] = useState<ModoLista>("castilla");
  const [jornadaSel, setJornadaSel] = useState(0);
  const [equipoSel, setEquipoSel] = useState("");
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
  const liga = useMemo(() => estructuraLiga(todas), [todas]);
  const lista = useMemo(() => filtraLista(todas, fuente, modoLista, liga, jornadaSel, equipoSel), [todas, fuente, modoLista, liga, jornadaSel, equipoSel]);
  /* Cambiar de modo, jornada o equipo: si el partido abierto sigue en la lista, se queda; si no, el primero. */
  const cambiaLista = (modo: ModoLista, jornada: number, equipo: string) => {
    setModoLista(modo);
    setJornadaSel(jornada);
    setEquipoSel(equipo);
    const nueva = filtraLista(todas, fuente, modo, liga, jornada, equipo);
    if (!nueva.some((x) => x.partido === elegido)) {
      setPartido(null);
      setElegido(nueva[0]?.partido ?? "");
    }
  };
  /* ¿Es del grupo del Castilla? (su plantilla está en /rivals). Con el nombre de Opta. */
  const delGrupo = (nombre: string) => {
    const n = nombre === "Real Madrid Castilla" ? CASTILLA_EN_OPTA : nombre;
    return fuente === "castilla" && (liga.grupoDe.get(n) ?? -1) === 0;
  };

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
      const lasTodas = [...todos.values()];
      setTodas(lasTodas);
      /* La misma regla de «acabado» que la sala (antes «Finished» salía como en directo). */
      const enJuego = new Set(delDia.filter((x) => !esAcabado(String(x.estado ?? ""))).map((x) => x.partido));
      setVivos(enJuego);
      /*
       * Lo que se abre (28/11/2026): el Castilla por defecto; con ?partido= de
       * otro equipo, su jornada; con ?equipo=, sus partidos; con ?jornada=, esa.
       */
      const L = estructuraLiga(lasTodas);
      const pedido = inicial.current.partido;
      const pedidoEquipo = inicial.current.equipo;
      const pedidaJornada = inicial.current.jornada;
      inicial.current.partido = "";
      inicial.current.equipo = "";
      inicial.current.jornada = 0;
      const entradaPedida = pedido ? todos.get(pedido) : undefined;
      const equipoPedido = pedidoEquipo ? L.equipos.find((e) => e === pedidoEquipo || mismoClub(e, pedidoEquipo)) ?? "" : "";
      let modo: ModoLista = "castilla";
      let jornada = L.jornadas[0] ?? 0;
      let equipo = "";
      if (fuente === "castilla") {
        if (entradaPedida && !(entradaPedida.equipos ?? []).includes(CASTILLA_EN_OPTA)) {
          modo = "jornada";
          jornada = L.jornadaDe.get(entradaPedida.partido) ?? jornada;
        } else if (equipoPedido && equipoPedido !== CASTILLA_EN_OPTA) {
          modo = "equipo";
          equipo = equipoPedido;
        } else if (pedidaJornada && L.jornadas.includes(pedidaJornada)) {
          modo = "jornada";
          jornada = pedidaJornada;
        }
      }
      setModoLista(modo);
      setJornadaSel(jornada);
      setEquipoSel(equipo);
      const entradas = filtraLista(lasTodas, fuente, modo, L, jornada, equipo);
      setElegido((antes) => (entradaPedida ? entradaPedida.partido : antes && entradas.some((x) => x.partido === antes) ? antes : (entradas.find((x) => enJuego.has(x.partido)) ?? entradas[0])?.partido ?? ""));
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
  /* Dominamos en xG y el marcador no lo refleja (27/11/2026): el aviso y, al lado, la temporada en esa situación al descanso. */
  const dominio = useMemo(() => (partido && calculo ? dominioSinPremio(partido, tVista, calculo.c) : null), [partido, calculo, tVista]);
  const idsTemporada = useMemo(
    () => (partido ? lista.filter((x) => x.partido !== partido.id && x.goles?.length === 2 && x.goles.every((g) => g != null) && (!partido.fecha || String(x.fecha ?? "").slice(0, 10) < String(partido.fecha).slice(0, 10))).map((x) => x.partido) : []),
    [lista, partido],
  );
  const temporada = useTemporadaDescanso(FUENTES[fuente].prefijo, idsTemporada, !!dominio);
  const avisoDominio = useMemo(
    () => (dominio && partido?.nuestro ? <AvisoDominio dxg={dominio.dxg} dg={dominio.dg} nuestro={nombreEquipoCorto((partido.nuestro === "L" ? partido.local : partido.visitante).nombre)} lista={temporada.lista} sinPartidos={temporada.sinPartidos} /> : null),
    [dominio, partido, temporada.lista, temporada.sinPartidos],
  );
  const haciaDonde = useMemo(() => (partido ? rumbo(partido, tVista) : null), [partido, tVista]);
  const plan = useMemo(() => {
    if (!partido || !conPlan || !filasPlan.length) return null;
    const fila = filaDelPlan(filasPlan, partido, mismoClub);
    return fila ? { cruces: planEnElCampo(partido, fila, tVista), jornada: fila.JORNADA ? `jornada ${String(fila.JORNADA)}` : "", id: fila.ID ? String(fila.ID) : "" } : null;
  }, [partido, conPlan, filasPlan, tVista]);
  /*
   * A un toque desde cada nombre (28/11/2026, los tres jueces): los del Castilla
   * a su ficha en /individual (por nombre, no por JUG-XX) y a su seguimiento;
   * los de un equipo del grupo, a su ficha en /rivals. Del otro grupo o del
   * primer equipo, nada (no hay ficha que abrir).
   */
  const enlaceJugador = useMemo<EnlaceJugador | undefined>(() => {
    if (fuente !== "castilla" || !partido) return undefined;
    const grupo0 = (n: string) => (liga.grupoDe.get(n === "Real Madrid Castilla" ? CASTILLA_EN_OPTA : n) ?? -1) === 0;
    return (l, nombre) => {
      const equipo = (l === "L" ? partido.local : partido.visitante).nombre;
      if (!nombre) return null;
      if (equipo === "Real Madrid Castilla") return { ficha: `/individual?nombre=${encodeURIComponent(nombre)}`, seguimiento: `/individual?nombre=${encodeURIComponent(nombre)}&pestana=seguimiento` };
      if (grupo0(equipo)) return { ficha: `/rivals?equipo=${encodeURIComponent(equipo)}&jugador=${encodeURIComponent(nombre)}` };
      return null;
    };
  }, [fuente, partido, liga]);
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
    if (modo === "final") return { v: ventana, titulo: "Lo que dejó el partido" };
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
      partido && calculo && k && ventana ? {
        /* 28/11/2026 (marketing): en el móvil el marcador iba tras cinco filas de mandos; ahora va antes que la barra de repetición. */
        cabeza: <Marcador p={partido} t={tVista} c={calculo.c} modo={modo} parte={calculo.parte} prob={calculo.prob} justo={calculo.justo} titular={calculo.titular} hitos={calculo.hitos} fichas={calculo.fichas} k={k} aviso={avisoDominio} enlace={enlaceJugador} conVideo={fuente === "castilla"} />,
        cuerpo: (
          <div className="mt-4 grid gap-4">
            {/* 28/11/2026 (fútbol): lo que se entrena el martes, a todo el ancho bajo el marcador y el resultado justo. */}
            {tocar.length > 0 && <QueTocamos lista={tocar} final={modo === "final"} planHref={plan?.id ? `/match-preparation?rival=${encodeURIComponent(plan.id)}` : ""} />}

            {/* 28/11/2026 (jueces de estilo): «Mirar» sube bajo el marcador, a todo el ancho: manda en
                todo lo de debajo (campo, cara a cara, lectura) y en el móvil quedaba tras la lectura. */}
            <SelectorTramo valor={disponibles[tramo] ? tramo : "todo"} onCambia={setTramo} disponibles={disponibles} />

            {/* En el móvil, los avisos van justo después del marcador (el experto de fútbol: es lo primero que se lee en el banquillo).
                28/11/2026 (jueces de estilo): y el campo, justo después de los avisos; «Hacia dónde va» y la lectura, detrás
                (la columna derecha se deshace en el móvil con `contents` y cada pieza lleva su orden). */}
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="contents min-w-0 content-start gap-4 xl:col-start-2 xl:row-start-1 xl:grid">
                <div className="order-1 min-w-0 xl:order-none">
                  <Alertas lista={avisos} p={partido} final={modo === "final"} />
                </div>
                {haciaDonde && (
                  <div className="order-3 min-w-0 xl:order-none">
                    <HaciaDonde p={partido} r={haciaDonde} final={modo === "final"} />
                  </div>
                )}
                {lectura && (
                  <div className="order-3 min-w-0 xl:order-none">
                    <Lectura p={partido} v={lectura.v} titulo={lectura.titulo} omitir={omitir} />
                  </div>
                )}
              </div>
              <div className="order-2 grid min-w-0 content-start gap-3 xl:order-none xl:col-start-1 xl:row-start-1">
                <Campo p={partido} t={tVista} v={ventana} capa={capa} setCapa={setCapa} />
              </div>
            </div>

            {plan && plan.cruces.length > 0 && <PlanEnCampo cruces={plan.cruces} jornada={plan.jornada} />}

            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <Duelo p={partido} v={ventana} k={k} />
              <div className="grid min-w-0 content-start gap-4">
                <AbpTransiciones p={partido} v={ventana} enlace={enlaceJugador} />
                <Tramos p={partido} t={tVista} />
              </div>
            </div>

            <Jugadores p={partido} v={ventana} enlace={enlaceJugador} />

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Pulso p={partido} t={tVista} hitos={calculo.hitos} />
              <Probabilidad p={partido} t={tVista} hitos={calculo.hitos} />
            </div>

            <p className="text-center text-[12px]" style={{ color: S.tenue }}>
              Opta ProVision · {partido.liga || (fuente === "castilla" ? "Primera RFEF" : "")} · todo se cuenta desde el evento a evento hasta el minuto que se ve
              {partido.actualizado ? ` · leído ${new Date(partido.actualizado).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
            </p>
          </div>
        ),
      } : null,
    [partido, calculo, k, ventana, tVista, modo, avisoDominio, avisos, lectura, omitir, tocar, disponibles, tramo, capa, fuente, haciaDonde, plan, enlaceJugador],
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
    <div ref={raiz} className={`sala-raiz siempre-oscuro min-h-screen ${pantalla ? "overflow-y-auto" : ""} ${tv ? "sala-tv" : ""} ${tv && quieta ? "sala-quieta" : ""}`} style={{ background: `radial-gradient(1200px 600px at 50% -10%, rgba(30,70,150,0.35), transparent), radial-gradient(900px 500px at 100% 100%, rgba(20,120,110,0.12), transparent), ${S.fondo}`, color: S.texto }}>
      {/* Rejilla tenue de fondo: la sala. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(140,190,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(140,190,255,1) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className={`sala-contenido relative mx-auto px-3 pb-16 pt-3 sm:px-6 ${tv ? "max-w-[1920px]" : "max-w-[1600px]"}`}>
        <header className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          {!pantalla && (
            <Link href="/data-analisis?area=directo" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ border: `1px solid ${S.borde}`, color: S.suave }}>
              <ChevronLeft size={14} aria-hidden /> Volver
            </Link>
          )}
          <p className="flex items-center gap-2 fuente-club text-[18px] uppercase tracking-[0.2em] sm:text-[20px] sm:tracking-[0.24em]">
            <Radio size={18} style={{ color: enDirecto ? "#FF4D6D" : S.info }} className={enDirecto ? "sala-latido" : ""} aria-hidden />
            Sala de partido
          </p>
          {/* 28/11/2026 (fútbol): la sala es oscura a propósito (sala de control, se ve en la tele); en modo día lo dice. */}
          <span className="sala-aviso-dia items-center rounded-full px-2 py-0.5 text-[11px]" style={{ border: `1px solid ${S.borde}`, color: S.tenue }} title="La sala de partido se ve siempre en oscuro, también con el modo día: está pensada para la pantalla grande.">
            en oscuro a propósito
          </span>
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
            {/* En el móvil, sólo el icono (los jueces: cinco filas de mandos antes del marcador). */}
            <button type="button" onClick={() => void completa()} className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ border: `1px solid ${S.borde}`, color: S.suave }} title="Pantalla completa (F)" aria-label={pantalla ? "Salir de pantalla completa" : "Pantalla completa"}>
              {pantalla ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
              <span className="hidden sm:inline">{pantalla ? "Salir" : "Pantalla completa"}</span>
            </button>
          </div>
        </header>

        {/*
          QUÉ PARTIDO (28/11/2026, el analista: «cualquier partido de Primera RFEF»): los del Castilla (lo que abre),
          los de una jornada (los dos grupos, el del Castilla primero) o los de un equipo. Sale del mismo archivo de
          siempre: nada que bajar de más.
        */}
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
          {fuente === "castilla" && (
            <div className="flex shrink-0 rounded-full p-0.5" role="group" aria-label="Qué partidos" style={{ border: `1px solid ${S.borde}`, background: "rgba(255,255,255,0.03)" }}>
              {(
                [
                  ["castilla", "Castilla"],
                  ["jornada", "Jornada"],
                  ["equipo", "Equipo"],
                ] as [ModoLista, string][]
              ).map(([m, t]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={modoLista === m}
                  onClick={() => {
                    if (m === modoLista) return;
                    const jorn = m === "jornada" ? (liga.jornadaDe.get(elegido) ?? (jornadaSel || liga.jornadas[0] || 0)) : jornadaSel;
                    const delPartido = (todas.find((x) => x.partido === elegido)?.equipos ?? []).find((e) => e !== CASTILLA_EN_OPTA) ?? "";
                    const eq = m === "equipo" ? equipoSel || delPartido || liga.equipos.find((e) => e !== CASTILLA_EN_OPTA) || "" : equipoSel;
                    cambiaLista(m, jorn, eq);
                  }}
                  className="min-h-[30px] rounded-full px-3 py-1 text-[12px] font-semibold"
                  style={{ background: modoLista === m ? "rgba(120,190,255,0.22)" : "transparent", color: modoLista === m ? S.texto : S.suave }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {fuente === "castilla" && modoLista === "jornada" && liga.jornadas.length > 0 && (
            <>
              <label className="sr-only" htmlFor="sala-jornada">
                Jornada
              </label>
              <select id="sala-jornada" value={jornadaSel} onChange={(e) => cambiaLista("jornada", Number(e.target.value), equipoSel)} className="rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: "#0A1730", color: S.texto, border: `1px solid ${S.borde}` }}>
                {liga.jornadas.map((j) => (
                  <option key={j} value={j}>
                    Jornada {j}
                  </option>
                ))}
              </select>
            </>
          )}
          {fuente === "castilla" && modoLista === "equipo" && liga.equipos.length > 0 && (
            <>
              <label className="sr-only" htmlFor="sala-equipo">
                Equipo
              </label>
              <select id="sala-equipo" value={equipoSel} onChange={(e) => cambiaLista("equipo", jornadaSel, e.target.value)} className="max-w-[min(16rem,60vw)] rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: "#0A1730", color: S.texto, border: `1px solid ${S.borde}` }}>
                {(liga.dosGrupos ? [0, 1] : [0]).map((g) => {
                  const suyos = liga.equipos.filter((e) => (liga.grupoDe.get(e) ?? 0) === g);
                  const opciones = suyos.map((e) => (
                    <option key={e} value={e}>
                      {nombreLista(e)}
                    </option>
                  ));
                  return liga.dosGrupos ? (
                    <optgroup key={g} label={g === 0 ? "Grupo del Castilla" : "El otro grupo"}>
                      {opciones}
                    </optgroup>
                  ) : (
                    opciones
                  );
                })}
              </select>
            </>
          )}
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
            className="min-w-0 max-w-full flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold sm:max-w-[26rem] sm:flex-none"
            style={{ background: "#0A1730", color: S.texto, border: `1px solid ${S.borde}` }}
          >
            {(() => {
              const opcion = (x: EntradaArchivo) => (
                <option key={x.partido} value={x.partido}>
                  {vivos.has(x.partido) ? "● EN DIRECTO · " : ""}
                  {fechaCorta(x.fecha)} · {(x.equipos ?? []).map(nombreLista).join(" – ")}
                  {x.goles?.length === 2 && x.goles.every((g) => g != null) ? `  ${x.goles.join("-")}` : ""}
                </option>
              );
              if (fuente !== "castilla" || modoLista !== "jornada" || !liga.dosGrupos) return lista.map(opcion);
              return [0, 1].map((g) => {
                const suyos = lista.filter((x) => (liga.grupoDe.get(x.equipos?.[0] ?? "") ?? 0) === g);
                return suyos.length ? (
                  <optgroup key={g} label={g === 0 ? "Grupo del Castilla" : "El otro grupo"}>
                    {suyos.map(opcion)}
                  </optgroup>
                ) : null;
              });
            })()}
          </select>
        </div>

        {/*
          A UN TOQUE, con el partido ya elegido (28/11/2026, jueces de estilo). En el móvil, una sola fila que se
          desplaza (antes, tres filas que empujaban el marcador). Del Castilla: análisis, plan, informe, coding,
          goles y ABP del rival. De otros dos equipos del grupo: la plantilla y los goles de cada uno. Del otro
          grupo o del primer equipo, nada: no hay pantalla nuestra que abrir.
        */}
        {partido && fuente === "castilla" && !pantalla && (() => {
          type Enlace = { href: string; texto: string };
          let enlaces: Enlace[] = [];
          if (partido.nuestro) {
            const rivalNombre = partido.nuestro === "L" ? partido.visitante.nombre : partido.local.nombre;
            const corto = nombreLista(rivalNombre);
            enlaces = [
              partido.fecha ? { href: urlPostDelPartido(partido.fecha, rivalNombre), texto: "Análisis del partido" } : null,
              plan?.id ? { href: `/match-preparation?rival=${encodeURIComponent(plan.id)}`, texto: "Plan de partido" } : null,
              { href: "/microcycles", texto: "Informe en Microciclos" },
              { href: `/coding?equipo=${encodeURIComponent(rivalNombre)}`, texto: "Coding" },
              { href: urlGolesDelEquipo(rivalNombre), texto: `Goles de ${corto} en vídeo` },
              { href: `/scout-rival-abp?equipo=${encodeURIComponent(rivalNombre)}`, texto: `ABP de ${corto}` },
            ].filter((x): x is Enlace => x !== null);
          } else {
            for (const e of [partido.local.nombre, partido.visitante.nombre]) {
              if (!delGrupo(e)) continue;
              enlaces.push({ href: `/rivals?equipo=${encodeURIComponent(e)}`, texto: `Plantilla de ${nombreLista(e)}` }, { href: urlGolesDelEquipo(e), texto: `Goles de ${nombreLista(e)} en vídeo` });
            }
          }
          if (!enlaces.length) return null;
          return (
            <nav aria-label="A un toque" className="-mx-3 mt-2 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {enlaces.map((x) => (
                <Link key={x.href} href={x.href} className="inline-flex min-h-[32px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold" style={{ border: `1px solid ${S.borde}`, color: S.suave, background: "rgba(255,255,255,0.03)" }}>
                  <ArrowUpRight size={13} aria-hidden style={{ color: S.oro }} /> {x.texto}
                </Link>
              ))}
            </nav>
          );
        })()}

        {/* El marcador, antes que la barra de la repetición (28/11/2026, marketing: en el móvil se veía tras cinco filas de mandos). */}
        {paneles?.cabeza && <div className="mt-3">{paneles.cabeza}</div>}

        {/* LA BARRA DE LA REPETICIÓN (28/11/2026, jueces de estilo): antes iba fija al pie de la ventana y tapaba
            la parte alta del campo (escritorio) y el rótulo del resultado justo (móvil). Ahora tiene su hueco en el
            flujo, bajo el marcador, y se queda pegada arriba al bajar: no se monta sobre nada. */}
        {partido && calculo && (
          <div className="sala-barra sticky top-0 z-30 -mx-3 mt-3 sm:-mx-6" style={{ background: "linear-gradient(180deg, #030812 78%, rgba(3,8,18,0.92))", borderBottom: "1px solid rgba(120,170,255,0.14)" }}>
            {/* En el móvil, dos filas: la línea del tiempo a todo el ancho arriba y los mandos debajo. */}
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-0.5 px-3 pb-2 pt-1 sm:flex-nowrap sm:gap-y-0 sm:px-6 sm:py-2">
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
              {/* 28/11/2026 (análisis): qué es cada marca de la línea del tiempo (arriba el local, abajo el visitante). */}
              <span className="flex min-w-0 shrink items-center gap-x-2 text-[11px] leading-tight sm:order-last" style={{ color: S.tenue }} aria-label="Leyenda de la línea del tiempo">
                <span className="whitespace-nowrap">⚽ gol</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="inline-block h-2.5 w-1.5 rounded-[1px]" style={{ background: "#F5D547" }} />tarjeta</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="inline-block h-2.5 w-1.5 rounded-[1px]" style={{ background: "rgba(255,255,255,0.7)" }} />cambio</span>
                <span className="hidden whitespace-nowrap lg:inline">· arriba {nombreEquipoCorto(partido.local.nombre)}</span>
              </span>
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
            </div>
          </div>
        )}

        {cargando && <p className="py-24 text-center text-[14px]" style={{ color: S.tenue }}>Abriendo la sala…</p>}
        {!cargando && !lista.length && (
          <p className="py-24 text-center text-[14px]" style={{ color: S.tenue }}>
            {modoLista === "castilla" || fuente === "rm" ? `Todavía no hay partidos guardados de ${FUENTES[fuente].nombre.toLowerCase()}.` : "En el archivo de Opta no hay partidos con esta elección: prueba otra jornada u otro equipo."}
          </p>
        )}
        {!cargando && lista.length > 0 && !partido && <p className="py-24 text-center text-[14px]" style={{ color: S.tenue }}>{error || "Cargando el partido…"}</p>}

        {paneles?.cuerpo}
      </div>

    </div>
  );
}
