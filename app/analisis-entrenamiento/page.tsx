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
 * Terminada el 19/10/2026 (Paquete D del plan de los expertos): la cuenta
 * siempre igual («9 de 14 correctas (11 validadas)»), porcentaje sólo con 8
 * acciones o más, tarea, meta y origen por objetivo, vista por jugador y
 * «Tu sesión», y el día, la vista y el jugador en la dirección.
 *
 * REVISIÓN DEL 30/10/2026 (el analista: «debe mejorar mucho, visual,
 * funcional —mucho más fiable— y usablemente»):
 *
 *   Fiabilidad
 *   - El análisis se lee saneado y sin acciones repetidas (`normalizaAnalisis`):
 *     un documento a medias ya no rompe la página y la misma jugada contada
 *     en el corte entre dos partes cuenta una vez.
 *   - Cada validación lleva el sello del análisis en el que se hizo: al volver
 *     a analizar, una acción nueva ya no hereda el veredicto de otra que caía
 *     en el mismo segundo.
 *   - Una sola regla de qué acciones cuentan (objetivos con texto y medidos)
 *     para la cabecera, el panel, la revisión y la tarea del día.
 *   - Lo que se escribe mientras se lee el documento del día ya no se pierde
 *     en silencio: no se deja escribir hasta que llega (useRemoteDoc no lo
 *     guarda en ese rato).
 *   - El estado del ordenador se lee ANTES que el análisis: si terminaba entre
 *     las dos lecturas, la pantalla dejaba de releer con el análisis viejo.
 *   - Lo validado en otro día de esta misma visita cuenta en la evolución
 *     (antes salía la foto del servidor del momento de entrar).
 *   - Elegir un día a mano mientras carga el registro ya no lo pisa el salto
 *     automático al último día con sesión.
 *
 *   Uso
 *   - Cabecera con la sesión, su estado, cuatro pasos y UN botón con el
 *     siguiente paso (./CabeceraSesion.tsx).
 *   - Pestañas por paso: Resumen · Revisar · Objetivos · Por jugador.
 *   - Revisar con el visor y el teclado (./VisorClips.tsx): 1 / 2 / 3, flechas
 *     y salto solo a la siguiente sin validar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ClipboardCheck, Copy, ListChecks, Loader2, Plus, RefreshCw, Target, TrendingUp, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { AbpHeader, Button, Notice, SaveState } from "@/components/abp/ui";
import { Explicativo } from "@/components/ui/textos-analisis";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { usePlayers } from "@/hooks/usePlayers";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { loadRegistro, type RegistroTarea } from "@/lib/abp/registro";
import { ultimoDiaConObjetivos, type DiaEntreno } from "@/lib/entreno/jugador";
import {
  KIND_ENTRENO,
  MINIMO_PORCENTAJE,
  SESION_VACIA,
  accionesQueCuentan,
  claveAnalisis,
  claveSesion,
  cuentasDe,
  huellaObjetivo,
  normalizaAnalisis,
  normalizaSesion,
  nuevoId,
  sesionVigente,
  sinMotores,
  validacionesAnteriores,
  validacionesVigentes,
  type AnalisisEntreno,
  type SesionEntreno,
  type Validacion,
} from "@/lib/entreno/modelo";
import { estadoEncargo, vigiaVivo, type EstadoEncargo, type Encargo, type Vigia } from "@/lib/mantenimiento";
import { duracion, vistaProgreso, type VistaProgreso } from "@/lib/progreso";
import { fechaIsoDeHoja } from "@/lib/registro/hoja";

import { useDiasConectados } from "@/hooks/useDiasConectados";
import { planDeRegistro, sesionDeFecha } from "@/lib/sesion-dia/conexion";

import { CabeceraSesion, SelectorDia, type Paso, type Siguiente } from "./CabeceraSesion";
import { CAMPO, ObjetivoEditor, type TareaDelDia } from "./ObjetivoEditor";
import { PanelVisual } from "./PanelVisual";
import { QueTocaDelPost } from "./QueTocaDelPost";
import { RevisarAcciones } from "./RevisarAcciones";
import { SesionDelDia } from "./SesionDelDia";
import { VisorClips, type PeticionVisor, type Pieza } from "./VisorClips";
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

const ddmm = (f: string) => f.split("-").reverse().slice(0, 2).join("/");

type Vista = "resumen" | "revisar" | "objetivos" | "jugador";

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

/** El análisis leído de un día. Se guarda por día: volver a uno ya visto lo enseña al momento mientras se relee. */
type Leido = { analisis: AnalisisEntreno | null; error: boolean };

/**
 * Qué hacer cuando el análisis ha fallado, según lo que contestó el script
 * (scripts/entreno/analiza-entreno.mjs, sus `fin(...)`). Lo que el cuerpo
 * técnico puede arreglar, dicho; lo demás, a quien lleva el ordenador.
 */
function queHacer(resultado: string) {
  if (/no hay v[ií]deo/i.test(resultado))
    return {
      titulo: "No se ha encontrado el vídeo de este día",
      texto: "Sube el entrenamiento a Hudl con la fecha en el título («DDMMAAAA RM CASTILLA…») o deja la grabación de la cámara táctica en la carpeta SESIONES del ordenador del club, y vuelve a pedir el análisis.",
    };

  if (/no tiene objetivos/i.test(resultado)) return { titulo: "El día no tenía objetivos guardados", texto: "Escribe al menos un objetivo con su jugador y vuelve a pedir el análisis." };

  if (/sesi[oó]n de hudl|login/i.test(resultado)) return { titulo: "La sesión de Hudl del ordenador del club ha caducado", texto: "Avisa al administrador para que vuelva a entrar en Hudl en ese ordenador; después, vuelve a pedir el análisis." };

  if (/cuota|quota|429|gemini|api.?key/i.test(resultado)) return { titulo: "El análisis automático no ha contestado", texto: "Suele ser la cuota del día. Vuelve a pedirlo dentro de un rato." };

  return { titulo: "El análisis no ha salido", texto: "Vuelve a pedirlo; si se repite, avisa al administrador con el detalle de abajo." };
}

export default function AnalisisEntrenamientoPage() {
  const [hoyDia] = useState(hoy);
  const [fecha, setFechaEstado] = useState(() => {
    const pedida = deLaDireccion("fecha");

    return pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : hoyDia;
  });
  const [pestana, setPestana] = usePestanaUrl<Vista>("vista", ["resumen", "revisar", "objetivos", "jugador"], "resumen");
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

  const { value, setValue, status, localOnly, lastSavedAt, sinGuardar, guardaYa, reload: recargaSesion } = useRemoteDoc<SesionEntreno>({ key: claveSesion(fecha), kind: KIND_ENTRENO, fallback: SESION_VACIA });
  const sesion = useMemo(() => normalizaSesion(value), [value]);
  /* Mientras llega el documento del día, useRemoteDoc no guarda lo que se escriba (la carga lo pisaría): se dice en vez de perderlo callando. */
  const bloqueado = status === "loading";
  const cambia = (f: (s: SesionEntreno) => SesionEntreno) => {
    if (bloqueado) {
      toast.info("Un momento: se están leyendo los objetivos del día", { id: "entreno-cargando" });

      return;
    }

    setValue((actual) => f(normalizaSesion(actual)));
  };

  /* ---------------- el análisis y el ordenador del club ---------------- */

  const [leidos, setLeidos] = useState<Record<string, Leido>>({});
  const [ordenador, setOrdenador] = useState<Ordenador | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const leido = leidos[fecha] ?? null;
  const analisis = leido?.analisis ?? null;
  const cargando = leido === null;

  /* La lectura va dentro del efecto y se relee subiendo el testigo (la forma que pasa el linter de React). */
  const [testigo, setTestigo] = useState(0);
  const relee = useCallback(() => setTestigo((n) => n + 1), []);
  /** El día que el ordenador tenía en marcha en la lectura anterior: para avisar al terminar. */
  const enMarchaAntes = useRef<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    const lee = async () => {
      /*
      | Primero el ordenador y DESPUÉS el análisis (30/10/2026). Leídos a la vez,
      | si el análisis se escribía justo entre las dos respuestas llegaba «ya no
      | está en marcha» con el análisis de antes, la pantalla dejaba de releer y
      | se quedaba con el viejo hasta pulsar «Releer».
      */
      const m = (await fetch("/api/mantenimiento", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as { estado?: { entreno?: Encargo }; vigia?: Vigia | null } | null;
      const a: Leido = await fetch(`/api/docs?key=${encodeURIComponent(claveAnalisis(fecha))}`, { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));

          return { analisis: normalizaAnalisis(((await r.json()) as { data?: unknown })?.data ?? null), error: false };
        })
        .catch(() => ({ analisis: null, error: true }));

      if (cancelado) return;

      const ahora = Date.now();
      const encargo = m?.estado?.entreno ?? null;
      const estado = encargo ? estadoEncargo("entreno", encargo, ahora) : "libre";
      const deQue = (encargo?.datos as { fecha?: string } | undefined)?.fecha ?? null;
      const enMarcha = estado === "pedido" || estado === "en-marcha" ? deQue : null;

      /* Aviso al terminar el análisis que se estaba siguiendo desde aquí. */
      if (enMarchaAntes.current && !enMarcha && m) {
        if (encargo?.ok === false) toast.error(`El análisis del ${ddmm(enMarchaAntes.current)} no ha salido`, { description: "Mira el aviso en la cabecera." });
        else toast.success(`Análisis del ${ddmm(enMarchaAntes.current)} listo`, { description: "Ya se puede revisar." });
      }

      enMarchaAntes.current = enMarcha;

      /* Si falla la lectura, se queda lo último que se leyó de ese día (con el error dicho). */
      setLeidos((l) => ({ ...l, [fecha]: a.error ? { analisis: l[fecha]?.analisis ?? null, error: true } : a }));
      setOrdenador({
        encargo,
        estado,
        vivo: vigiaVivo(m?.vigia, ahora),
        progreso: estado === "en-marcha" ? vistaProgreso("entreno", m?.vigia?.progreso?.entreno, encargo?.empezadoEn, ahora) : null,
      });
    };

    void lee();

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

  /* ---------------- el historial (sesión anterior, copiar, evolución, por jugador) ---------------- */

  const [historial, setHistorial] = useState<{ dias: DiaEntreno[]; error: boolean } | null>(null);
  const [testigoHistorial, setTestigoHistorial] = useState(0);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/entreno/historial", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as { ok?: boolean; sesiones?: { fecha: string; data: unknown }[]; analisis?: { fecha: string; data: unknown }[] };

        if (!r.ok || !j.ok) throw new Error(String(r.status));

        const fechas = new Set([...(j.sesiones ?? []).map((s) => s.fecha), ...(j.analisis ?? []).map((a) => a.fecha)]);

        return [...fechas].map((f) => ({
          fecha: f,
          sesion: normalizaSesion(j.sesiones?.find((s) => s.fecha === f)?.data ?? null),
          analisis: normalizaAnalisis(j.analisis?.find((a) => a.fecha === f)?.data ?? null),
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

  /*
  | Lo escrito en otros días durante esta visita (30/10/2026). El historial es
  | la foto del servidor al entrar: validar el martes y pasar al miércoles
  | dejaba la evolución con el martes de antes. Al cambiar de día se apunta
  | cómo quedó el que se deja.
  */
  const [editadas, setEditadas] = useState<Record<string, SesionEntreno>>({});

  /* Elegir un día a mano manda: el salto automático al último día con sesión ya no lo pisa. */
  const [saltoHecho, setSaltoHecho] = useState(() => deLaDireccion("fecha") !== null);
  const setFecha = (f: string) => {
    if (f === fecha) return;

    if (!bloqueado) setEditadas((e) => ({ ...e, [fecha]: sesion }));

    setSaltoHecho(true);
    setFechaEstado(f);
    ponEnDireccion("fecha", f === hoyDia ? null : f);
  };

  /* El día abierto, con sólo las validaciones de ESTE análisis (las de uno anterior no cuentan). */
  const servidorDelDia = historial?.dias.find((d) => d.fecha === fecha) ?? null;
  const analisisParaCuentas = cargando ? (servidorDelDia?.analisis ?? null) : analisis;
  const sesionV = useMemo(() => sesionVigente(sesion, analisisParaCuentas), [sesion, analisisParaCuentas]);

  const dias = useMemo<DiaEntreno[]>(() => {
    const otros = (historial?.dias ?? [])
      .filter((d) => d.fecha !== fecha)
      .map((d) => {
        const s = editadas[d.fecha] ?? d.sesion;
        const a = leidos[d.fecha]?.analisis ?? d.analisis;

        return { fecha: d.fecha, sesion: sesionVigente(s, a), analisis: a };
      });

    return [...otros, { fecha, sesion: sesionV, analisis: analisisParaCuentas }];
  }, [historial, fecha, sesionV, analisisParaCuentas, editadas, leidos]);

  /* ---------------- las tareas del registro ---------------- */

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
  | salta al último día con tareas, sin pasar de hoy. Una sola vez, y nunca
  | encima de un día elegido a mano (30/10/2026).
  */
  useEffect(() => {
    if (saltoHecho || !Array.isArray(registro)) return;

    const id = setTimeout(() => {
      setSaltoHecho(true);

      const conSesion = registro.map((t) => fechaIsoDeHoja(t.fecha)).filter((f): f is string => Boolean(f) && f <= hoyDia);

      if (conSesion.includes(hoyDia) || conSesion.length === 0) return;

      setFechaEstado(conSesion.reduce((a, b) => (b > a ? b : a)));
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

  /* El último día anterior con análisis: el resumen de un día vacío ofrece abrirlo (30/10/2026). */
  const ultimoAnalizado = dias
    .filter((d) => d.fecha < fecha && d.analisis)
    .reduce<string | null>((a, d) => (!a || d.fecha > a ? d.fecha : a), null);

  /* ---------------- acciones ---------------- */

  const nuevoObjetivo = () => cambia((s) => ({ ...s, objetivos: [...s.objetivos, { id: nuevoId(), objetivo: "", jugadores: [] }] }));

  const copiaObjetivos = () => {
    if (!anteriorConObjetivos || bloqueado) return;

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

  const conTexto = sesion.objetivos.filter((o) => o.objetivo.trim());
  const sinJugador = conTexto.filter((o) => !o.jugadores.length);

  const pide = async () => {
    if (!conTexto.length) {
      toast.error("Define al menos un objetivo con su jugador");
      setPestana("objetivos");

      return;
    }

    if (sinJugador.length) {
      toast.error(sinJugador.length === 1 ? "Un objetivo no tiene jugador" : `${sinJugador.length} objetivos no tienen jugador`, { description: "Elige a quién se mira en cada uno." });
      setPestana("objetivos");

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
      toast.error("No se ha podido pedir", { description: error instanceof Error ? sinMotores(error.message) : "" });
    } finally {
      setPidiendo(false);
    }
  };

  /* Cada validación con el sello del análisis que se está mirando (lib/entreno/modelo.ts, `validadoEn`). */
  const valida = (id: string, v: Validacion | null) =>
    cambia((s) => {
      const validaciones = { ...(s.validaciones ?? {}) };
      const validadoEn = { ...(s.validadoEn ?? {}) };

      if (v) {
        validaciones[id] = v;
        if (analisis?.hechoEn) validadoEn[id] = analisis.hechoEn;
        else delete validadoEn[id];
      } else {
        delete validaciones[id];
        delete validadoEn[id];
      }

      return { ...s, validaciones, validadoEn };
    });

  /* Dar por buenas, de una vez, las que quedan sin validar de un objetivo (con el veredicto propuesto). */
  const validaResto = (objetivoId: string) => {
    if (!analisis) return;

    cambia((s) => {
      const vigentes = validacionesVigentes(s, analisis);
      const validaciones = { ...(s.validaciones ?? {}) };
      const validadoEn = { ...(s.validadoEn ?? {}) };

      for (const a of analisis.acciones)
        if (a.objetivoId === objetivoId && !vigentes[a.id]) {
          validaciones[a.id] = a.veredicto;
          if (analisis.hechoEn) validadoEn[a.id] = analisis.hechoEn;
        }

      return { ...s, validaciones, validadoEn };
    });
  };

  /* ---------------- el visor (uno para toda la página) ---------------- */

  const [visor, setVisor] = useState<PeticionVisor | null>(null);
  const validacionesDe = (f: string) => dias.find((d) => d.fecha === f)?.sesion.validaciones;

  /* ---------------- las cuentas del día (una sola regla: lib/entreno/modelo.ts) ---------------- */

  const analizados = new Set(analisis?.objetivosAnalizados ?? []);
  const cambiados = analisis ? conTexto.filter((o) => !analizados.has(huellaObjetivo(o))).length : 0;
  const vivas = !cargando ? accionesQueCuentan(sesionV, analisis) : [];
  const cuentasDia = cuentasDe(vivas, sesionV.validaciones);
  const sinValidar = vivas.filter((a) => !sesionV.validaciones?.[a.id]);
  const anteriores = !cargando ? validacionesAnteriores(sesion, analisis) : 0;
  const numeroDe = new Map(sesion.objetivos.map((o, i) => [o.id, { numero: i + 1, texto: o.objetivo }]));
  const piezasDelDia: Pieza[] = vivas.map((a) => ({ accion: a, fecha, objetivo: `${numeroDe.get(a.objetivoId)?.numero ?? ""}. ${numeroDe.get(a.objetivoId)?.texto ?? ""}`, fuenteUrl: analisis?.fuente.url ?? null }));
  const abreRevision = () => {
    if (!piezasDelDia.length) return;

    setVisor({ titulo: "Revisar las acciones del día", piezas: piezasDelDia, filtro: sinValidar.length ? "sin-validar" : "todas", orden: "minuto" });
  };

  /* ---------------- la cabecera: estado, pasos y siguiente paso ---------------- */

  const plan = planDelDia[0];
  const textoSesion = plan ? [`Micro ${plan.micro}`, plan.md, plan.rival ? `Rival: ${plan.rival}` : "", planDelDia.length ? `${planDelDia.length} ${planDelDia.length === 1 ? "tarea" : "tareas"}` : ""].filter(Boolean).join(" · ") : undefined;
  const textoFuente = analisis
    ? [
        analisis.fuente.tipo === "camara" ? "Cámara táctica" : "Hudl",
        analisis.fuente.duracion ? `${Math.round(analisis.fuente.duracion / 60)} min de vídeo` : "",
        analisis.hechoEn ? `analizado el ${new Date(analisis.hechoEn).toLocaleString("es-ES", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const objetivosListos = conTexto.length > 0 && sinJugador.length === 0;
  const pasos: Paso[] = [
    {
      nombre: "Objetivos",
      estado: objetivosListos ? "hecho" : !analisis ? "ahora" : "pendiente",
      detalle: !conTexto.length ? "Sin objetivos" : sinJugador.length ? `${sinJugador.length} sin jugador` : `${conTexto.length} ${conTexto.length === 1 ? "objetivo" : "objetivos"}`,
      onClick: () => setPestana("objetivos"),
    },
    {
      nombre: "Análisis",
      estado: enCurso ? "ahora" : fallo || cortado ? "error" : analisis ? (cambiados ? "ahora" : "hecho") : objetivosListos ? "ahora" : "pendiente",
      detalle: enCurso
        ? estado === "pedido"
          ? "Pedido"
          : `Analizando${ordenador?.progreso ? ` · ${ordenador.progreso.porcentaje} %` : ""}`
        : fallo || cortado
          ? "No ha salido"
          : analisis
            ? cambiados
              ? `${cambiados} sin medir`
              : `${vivas.length} ${vivas.length === 1 ? "acción" : "acciones"}`
            : futuro
              ? "El día del entrenamiento"
              : "Sin pedir",
    },
    {
      nombre: "Revisión",
      estado: !analisis || !vivas.length ? "pendiente" : sinValidar.length ? "ahora" : "hecho",
      detalle: analisis && vivas.length ? `${vivas.length - sinValidar.length} de ${vivas.length} revisadas` : undefined,
      onClick: analisis && vivas.length ? () => setPestana("revisar") : undefined,
    },
    {
      nombre: "Evolución",
      estado: analisis && vivas.length && !sinValidar.length ? "ahora" : "pendiente",
      detalle: "Por jugador",
      onClick: () => setPestana("jugador"),
    },
  ];

  const estadoChip: { texto: string; tono: "neutro" | "oro" | "aviso" | "bien" } = enCurso
    ? { texto: estado === "pedido" ? "Análisis pedido" : "Analizando", tono: "oro" }
    : fallo || cortado
      ? { texto: "El análisis no ha salido", tono: "aviso" }
      : analisis && vivas.length
        ? sinValidar.length
          ? { texto: `${sinValidar.length} por revisar`, tono: "oro" }
          : { texto: "Revisado", tono: "bien" }
        : analisis
          ? { texto: "Analizado", tono: "neutro" }
          : bloqueado
            ? { texto: "Leyendo…", tono: "neutro" }
            : conTexto.length
              ? { texto: futuro ? "Preparado" : "Sin analizar", tono: "neutro" }
              : { texto: "Sin objetivos", tono: "neutro" };

  const pedir = (texto: string): Siguiente => ({
    texto,
    icono: ClipboardCheck,
    onClick: () => void pide(),
    ocupado: pidiendo,
    disabled: ocupadoConOtro || bloqueado,
    detalle: ocupadoConOtro ? `El ordenador del club está con el ${fechaEncargo ? ddmm(fechaEncargo) : "otro día"}: hace uno cada vez.` : "Lo hace el ordenador del club: suele tardar entre media hora y una hora y se puede cerrar la pantalla.",
  });

  const siguiente: Siguiente | null = bloqueado && !sesion.objetivos.length
    ? null
    : !conTexto.length
      ? {
          texto: futuro ? "Preparar los objetivos" : "Añadir los objetivos",
          icono: Plus,
          onClick: () => {
            setPestana("objetivos");
            if (!sesion.objetivos.length) nuevoObjetivo();
          },
          detalle: anteriorConObjetivos ? `O cópialos del ${ddmm(anteriorConObjetivos.fecha)} en «Objetivos» para seguir midiendo lo mismo.` : "Qué se busca, de quién y cómo reconocerlo en el vídeo.",
        }
      : sinJugador.length
        ? { texto: "Completar los objetivos", icono: Target, onClick: () => setPestana("objetivos"), detalle: `${sinJugador.length === 1 ? "Un objetivo no tiene" : `${sinJugador.length} objetivos no tienen`} jugador.` }
        : enCurso
          ? {
              texto: estado === "pedido" ? (ordenador?.vivo ? "Pedido: empieza en unos segundos" : "Pedido: empezará al encenderse el ordenador del club") : `Analizando${ordenador?.progreso ? ` · ${ordenador.progreso.porcentaje} %` : "…"}`,
              icono: Loader2,
              ocupado: true,
              detalle: "Puedes cerrar la pantalla: el análisis sigue y aparece aquí al terminar.",
            }
          : futuro && !analisis
            ? { texto: "Objetivos listos", icono: Target, detalle: "El día del entrenamiento, con el vídeo ya subido, pide el análisis." }
            : !analisis
              ? pedir(fallo || cortado ? "Volver a pedir el análisis" : "Pedir el análisis")
              : sinValidar.length
                ? { texto: `Revisar ${sinValidar.length} ${sinValidar.length === 1 ? "acción" : "acciones"}`, icono: ListChecks, onClick: abreRevision, detalle: "Con su clip y con el teclado: 1 correcta, 2 mejorable, 3 descartar." }
                : cambiados
                  ? { ...pedir("Volver a analizar"), detalle: `${cambiados === 1 ? "Un objetivo es nuevo o ha cambiado" : `${cambiados} objetivos son nuevos o han cambiado`} desde el análisis.` }
                  : vivas.length
                    ? { texto: "Ver la evolución por jugador", icono: TrendingUp, onClick: () => setPestana("jugador"), detalle: "Todo revisado: los números del día ya son los del cuerpo técnico." }
                    : { ...pedir("Volver a analizar"), detalle: "El vídeo no dio acciones: añade peto o dorsal en «Cómo reconocerlo» antes de repetirlo." };

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 space-y-5 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader area="RMCF Castilla · Entrenamiento" title="Análisis de entrenamiento" lead="Objetivos por jugador medidos en el vídeo de la sesión, con clips de lo que se hizo bien y de lo que hay que mejorar, y su evolución." />

            <SelectorDia
              fecha={fecha}
              hoy={hoyDia}
              semana={semanaDe(fecha)}
              onFecha={setFecha}
              mueve={mueve}
              derecha={<SaveState status={status} localOnly={localOnly} savedAt={lastSavedAt} sinGuardar={sinGuardar} onGuardar={() => void guardaYa()} />}
            />

            <CabeceraSesion
              fecha={fecha}
              sesion={textoSesion}
              fuente={textoFuente}
              estado={estadoChip}
              pasos={pasos}
              siguiente={siguiente}
              secundario={<Button icon={RefreshCw} onClick={relee} title="Releer el análisis y el estado del ordenador del club" aria-label="Releer el análisis" />}
            >
              {enCurso && ordenador?.progreso ? (
                <div className="space-y-1.5" aria-live="polite">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <div className="h-full transition-all" style={{ width: `${ordenador.progreso.porcentaje}%`, background: "var(--rmcf-gold-ink)" }} />
                  </div>
                  <p className="text-xs text-white/60">
                    {ordenador.progreso.etapas.find((e) => e.estado === "ahora")?.nombre ?? "Analizando"} · quedan unos {duracion(ordenador.progreso.quedan)}
                  </p>
                </div>
              ) : null}
              {!enCurso && ocupadoConOtro ? <Notice title={`El ordenador del club está analizando el ${fechaEncargo ? ddmm(fechaEncargo) : "otro día"}`}>Hace uno cada vez: cuando termine, podrás pedir este.</Notice> : null}
              {cortado ? (
                <Notice tone="warn" title="El análisis de este día se cortó a medias">
                  El ordenador del club se apagó o se quedó colgado. Vuelve a pedirlo.
                </Notice>
              ) : fallo ? (
                <Notice tone="warn" title={queHacer(fallo).titulo}>
                  <p>{queHacer(fallo).texto}</p>
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-white/50">Detalle para el administrador</summary>
                    <p className="mt-1 break-words font-mono text-[11px]">{sinMotores(fallo)}</p>
                  </details>
                </Notice>
              ) : null}
              {leido?.error ? (
                <Notice tone="warn" title={analisis ? "No se ha podido releer el análisis" : "No se ha podido leer el análisis de este día"}>
                  {analisis ? "Se ve la última lectura. " : ""}Comprueba la conexión y pulsa la flecha circular para releer.
                </Notice>
              ) : null}
            </CabeceraSesion>

            <Pestanas
              etiqueta="Pasos del análisis de entrenamiento"
              valor={pestana}
              onCambia={setPestana}
              opciones={[
                { clave: "resumen", label: "Resumen", icono: BarChart3 },
                { clave: "revisar", label: "Revisar", icono: ListChecks, cuenta: sinValidar.length || undefined },
                { clave: "objetivos", label: "Objetivos", icono: Target, cuenta: conTexto.length || undefined },
                { clave: "jugador", label: "Por jugador", corto: "Jugador", icono: UserRound },
              ]}
            />

            {pestana === "jugador" ? (
              historial === null ? (
                <Cargando key="historial" texto="Leyendo las sesiones guardadas" onReintentar={() => setTestigoHistorial((n) => n + 1)} />
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
                      setPestana("revisar");
                    }}
                  />
                </div>
              )
            ) : pestana === "revisar" ? (
              cargando ? (
                <Cargando key={`revisar-${fecha}-${testigo}`} texto="Leyendo el análisis del día" onReintentar={relee} />
              ) : analisis && vivas.length ? (
                <RevisarAcciones
                  fecha={fecha}
                  sesion={sesionV}
                  analisis={analisis}
                  dias={dias}
                  bloqueado={bloqueado}
                  anteriores={anteriores}
                  cambiados={cambiados}
                  onValida={valida}
                  onValidaResto={validaResto}
                  onAbre={setVisor}
                />
              ) : (
                <Vacio
                  titulo={analisis ? (cambiados ? "Los objetivos han cambiado desde el análisis" : "El vídeo no ha dado ninguna acción") : "Todavía no hay nada que revisar"}
                  texto={
                    analisis && cambiados
                      ? "Las acciones que hay son de otra versión de los objetivos: vuelve a analizar para medir lo que piden ahora."
                      : analisis
                      ? "Lo normal es que el análisis no reconozca a los jugadores: añade su peto o su dorsal en «Cómo reconocerlo» y vuelve a analizar."
                      : "Cuando el análisis del día esté hecho, aquí salen sus acciones con su clip para validarlas."
                  }
                />
              )
            ) : pestana === "objetivos" ? (
              <div className="space-y-5">
                <SesionDelDia
                  fecha={fecha}
                  plan={planDelDia}
                  equipos={equiposDelDia}
                  entreno={sesionV}
                  analisis={analisisParaCuentas}
                  plantilla={plantillaCastilla}
                  nombreDe={(id) => jugadores.find((j) => j.id === id)?.nombre ?? ""}
                  onObjetivo={(o) => {
                    if (bloqueado) return;
                    cambia((s) => ({ ...s, objetivos: [...s.objetivos, { ...o, id: nuevoId() }] }));
                    toast.success("Objetivo creado", { description: `${o.jugadores.length} jugadores · ${o.tarea}. Escribe qué se busca.` });
                  }}
                />

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">Objetivos de la sesión</h2>
                    {/* Mientras llega el documento no se ofrece crear ni copiar: se escribiría encima de lo que hay. */}
                    {!bloqueado ? (
                      <>
                        <Button icon={Plus} onClick={nuevoObjetivo}>
                          Objetivo
                        </Button>
                        <QueTocaDelPost
                          yaEstan={sesion.objetivos.map((o) => o.origen ?? "").filter(Boolean)}
                          jugadores={jugadores}
                          tareas={tareasDelDia}
                          onAnade={(objetivo) => cambia((s) => ({ ...s, objetivos: [...s.objetivos, { ...objetivo, id: nuevoId() }] }))}
                        />
                        {anteriorConObjetivos && sesion.objetivos.length ? (
                          <Button icon={Copy} onClick={copiaObjetivos} title="Añade los objetivos de ese día con el mismo texto, para seguir su evolución">
                            Copiar los del {ddmm(anteriorConObjetivos.fecha)}
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  {bloqueado && sesion.objetivos.length === 0 ? (
                    <Cargando key={`objetivos-${fecha}`} texto="Leyendo los objetivos del día" onReintentar={recargaSesion} />
                  ) : sesion.objetivos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/12 px-5 py-8 text-center">
                      <p className="text-sm font-medium text-white/75">Este día todavía no tiene objetivos</p>
                      <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-white/50">
                        Añade uno: qué se busca, de quién, cómo reconocerlo en el vídeo y qué es correcto o mejorable.
                        {anteriorConObjetivos ? " O copia los del último día para seguir midiendo lo mismo y ver la evolución." : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <Button icon={Plus} tone="primary" onClick={nuevoObjetivo}>
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

                <Explicativo>
                  <p className="text-xs text-white/50">
                    El vídeo sale de la cámara táctica si hay una grabación de ese día en la carpeta SESIONES del ordenador del club; si no, del entrenamiento subido a Hudl con la fecha en el título («16102026 RM CASTILLA…»). Cada acción y su veredicto se proponen solos; se corta un clip de ejemplo correcto y otro mejorable por objetivo. Lo que valides manda en los números.
                  </p>
                </Explicativo>

                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-white/75">Notas de la sesión</h2>
                  <textarea value={sesion.notas ?? ""} onChange={(e) => cambia((s) => ({ ...s, notas: e.target.value }))} rows={3} placeholder="Lo que quieras apuntar del entrenamiento" aria-label="Notas de la sesión" className={`${CAMPO} resize-y`} />
                </div>
              </div>
            ) : /* ---------------- resumen ---------------- */
            cargando ? (
              <Cargando key={`resumen-${fecha}-${testigo}`} texto="Leyendo el análisis del día" onReintentar={relee} />
            ) : analisis && vivas.length ? (
              <div className="space-y-4">
                {sinValidar.length ? (
                  <p className="text-xs text-white/60">
                    {cuentasDia.validadas} de {cuentasDia.total} acciones revisadas. Las {sinValidar.length} restantes cuentan con su veredicto propuesto (rayado) hasta que las valides.
                  </p>
                ) : null}
                <PanelVisual dias={dias} fecha={fecha} onAbre={setVisor} onIrAlDia={(f) => setFecha(f)} />
              </div>
            ) : (
              <ResumenSinAnalisis
                objetivos={conTexto.map((o) => ({ id: o.id, numero: numeroDe.get(o.id)?.numero ?? 0, texto: o.objetivo, jugadores: o.jugadores.map((j) => j.nombre).join(", "), tarea: o.tarea }))}
                analizado={Boolean(analisis) && !cambiados}
                sinMedir={analisis ? cambiados : 0}
                futuro={futuro}
                onObjetivos={() => setPestana("objetivos")}
                onAnadir={
                  bloqueado
                    ? undefined
                    : () => {
                        setPestana("objetivos");
                        if (!sesion.objetivos.length) nuevoObjetivo();
                      }
                }
                copiarDe={!bloqueado && anteriorConObjetivos ? { fecha: anteriorConObjetivos.fecha, onCopia: () => { copiaObjetivos(); setPestana("objetivos"); } } : null}
                ultimoAnalizado={ultimoAnalizado ? { fecha: ultimoAnalizado, onAbre: () => setFecha(ultimoAnalizado) } : null}
              />
            )}

            {/* La nota de método sólo cuando hay porcentajes que leer (30/10/2026): en un día vacío no explicaba nada. */}
            {analisis && vivas.length && (pestana === "resumen" || pestana === "revisar") ? (
              <p className="text-[11px] text-white/40">
                Porcentaje con {MINIMO_PORCENTAJE} acciones o más; por debajo se da la cuenta. Lo validado manda sobre lo propuesto.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {visor ? <VisorClips peticion={visor} onClose={() => setVisor(null)} validacionesDe={validacionesDe} fechaEditable={fecha} onValida={valida} bloqueado={bloqueado} /> : null}
    </main>
  );
}

/**
 * Mientras llega algo: la forma de lo que viene, no un texto suelto, y a los
 * 15 s un aviso con «Reintentar» (30/10/2026). Se monta con `key` por día e
 * intento, así el reloj vuelve a empezar en cada lectura.
 */
function Cargando({ texto, onReintentar }: { texto: string; onReintentar?: () => void }) {
  const [tarda, setTarda] = useState(false);

  useEffect(() => {
    const reloj = setTimeout(() => setTarda(true), 15_000);

    return () => clearTimeout(reloj);
  }, []);

  if (tarda) {
    return (
      <Notice tone="warn" title="Está tardando más de la cuenta">
        <span className="flex flex-wrap items-center gap-2">
          <span>{texto} no ha terminado en 15 segundos. Comprueba la conexión.</span>
          {onReintentar ? (
            <Button icon={RefreshCw} onClick={onReintentar}>
              Reintentar
            </Button>
          ) : null}
        </span>
      </Notice>
    );
  }

  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <span className="sr-only">{texto}</span>
      <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
        <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
      </div>
    </div>
  );
}

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/12 px-5 py-8 text-center">
      <p className="text-sm font-medium text-white/75">{titulo}</p>
      <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-white/50">{texto}</p>
    </div>
  );
}

/** El resumen de un día sin acciones todavía: lo que se va a medir y cómo seguir. */
function ResumenSinAnalisis({
  objetivos,
  analizado,
  sinMedir,
  futuro,
  onObjetivos,
  onAnadir,
  copiarDe,
  ultimoAnalizado,
}: {
  objetivos: { id: string; numero: number; texto: string; jugadores: string; tarea?: string }[];
  /** Crear el primer objetivo desde el cuerpo, no sólo desde la cabecera. */
  onAnadir?: () => void;
  copiarDe?: { fecha: string; onCopia: () => void } | null;
  ultimoAnalizado?: { fecha: string; onAbre: () => void } | null;
  analizado: boolean;
  /** Objetivos nuevos o cambiados después del análisis. */
  sinMedir: number;
  futuro: boolean;
  onObjetivos: () => void;
}) {
  /* Día sin objetivos (30/10/2026): la pantalla quedaba casi vacía y mandaba a la cabecera. Ahora la acción va aquí, y el último día analizado a un toque. */
  if (!objetivos.length)
    return (
      <div className="rounded-xl border border-dashed border-white/12 px-5 py-8 text-center">
        <p className="text-sm font-medium text-white/75">Este día todavía no tiene objetivos</p>
        <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-white/50">
          Qué se busca, de quién y cómo reconocerlo en el vídeo: con eso se mide la sesión.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {onAnadir ? (
            <Button icon={Plus} tone="primary" onClick={onAnadir}>
              {futuro ? "Preparar los objetivos" : "Añadir los objetivos"}
            </Button>
          ) : null}
          {copiarDe ? (
            <Button icon={Copy} onClick={copiarDe.onCopia}>
              Copiar los del {ddmm(copiarDe.fecha)}
            </Button>
          ) : null}
          {ultimoAnalizado ? (
            <Button icon={BarChart3} onClick={ultimoAnalizado.onAbre}>
              Ver el {ddmm(ultimoAnalizado.fecha)}, último día analizado
            </Button>
          ) : null}
        </div>
      </div>
    );

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-white">Lo que se va a medir</h2>
        <button type="button" onClick={onObjetivos} className="rounded text-xs font-semibold text-[#C8A96B] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]">
          Editar los objetivos
        </button>
      </div>
      <ol className="space-y-2">
        {objetivos.map((o) => (
          <li key={o.id} className="flex min-w-0 gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C8A96B]/15 text-[11px] font-semibold text-[#C8A96B]">{o.numero}</span>
            <span className="min-w-0">
              <span className="block text-sm text-white/90">{o.texto}</span>
              {o.jugadores || o.tarea ? <span className="block text-[11px] text-white/50">{[o.jugadores, o.tarea ? `Tarea ${o.tarea}` : ""].filter(Boolean).join(" · ")}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-white/55">
        {sinMedir
          ? `${sinMedir === 1 ? "Un objetivo es nuevo o ha cambiado" : `${sinMedir} objetivos son nuevos o han cambiado`} desde el análisis: vuelve a analizar para medirlos.`
          : analizado
          ? "El vídeo no ha dado acciones de estos objetivos: con peto o dorsal en «Cómo reconocerlo» se reconoce mejor a cada jugador."
          : futuro
            ? "El día del entrenamiento, con el vídeo ya subido, pide el análisis desde la cabecera."
            : "Cuando pidas el análisis, aquí sale el resumen del día con sus gráficos y sus clips."}
      </p>
    </div>
  );
}
