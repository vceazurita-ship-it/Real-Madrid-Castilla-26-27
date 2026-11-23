"use client";

/**
 * ACTUALIZACIONES AUTOMÁTICAS DESDE X (12/11/2026).
 *
 * Cada mañana el ordenador del club lee las publicaciones nuevas de las
 * cuentas de X que se siguen (@fernandosb9 y, desde el 23/11/2026,
 * @Q84_DANI, que pinta datos: de él se miran también las imágenes) y saca de
 * ellas ideas concretas para esta app. Una fila de lectura por cuenta y un
 * filtro por cuenta encima de las ideas. Aquí se ven
 * con su publicación, la pantalla a la que van y el porqué, y se deciden:
 *
 * - «Añadir»: el ordenador del club la programa en una copia aparte, pasa tsc,
 *   eslint y `next build` y, sólo si todo sale, la publica (la web se
 *   redespliega sola). Si algo falla, no se publica nada.
 * - «Deshacer» (una idea ya añadida): revierte exactamente sus commits, con las
 *   mismas comprobaciones. Si algo posterior depende de ella, lo dice y no
 *   fuerza nada.
 * - «Descartar» / «Recuperar».
 *
 * Datos: `/api/x-ideas` (documentos `x:<cuenta>` y `x:ideas`); reglas en
 * `lib/x-ideas.ts`.
 */

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ArrowUpRight, Check, ChevronDown, Loader2, Plus, RefreshCw, RotateCcw, Undo2, X as Cruz } from "lucide-react";
import { toast } from "sonner";

import { usePlegado, type Tono } from "@/components/ajustes/Plegable";
import { ProgresoEncargo } from "@/components/ajustes/ProgresoEncargo";
import { confirmar } from "@/lib/avisos";
import { corriendo, estadoEncargo, vigiaVivo, type Mantenimiento, type Tarea, type Vigia } from "@/lib/mantenimiento";
import { CUENTAS_X, accionesDe, cuentaDeIdea, enlaceSeguro, yaEnLaWeb, type AccionIdea, type EstadoIdea, type Idea, type LecturaX } from "@/lib/x-ideas";

const fecha = (iso: string) =>
  Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })
    : "";

const CHIP: Record<EstadoIdea, { texto: string; clase: string }> = {
  nueva: { texto: "Nueva", clase: "border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B]" },
  añadiendo: { texto: "Añadiendo", clase: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  añadida: { texto: "Añadida", clase: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  descartada: { texto: "Descartada", clase: "border-white/15 bg-white/[0.04] text-white/50" },
  fallida: { texto: "No salió", clase: "border-rose-400/30 bg-rose-400/10 text-rose-300" },
  deshaciendo: { texto: "Deshaciendo", clase: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  deshecha: { texto: "Deshecha", clase: "border-white/15 bg-white/[0.04] text-white/60" },
};

const LECTURA: Record<Exclude<LecturaX["estado"], "ok">, string> = {
  "falta-sesion": "Falta iniciar sesión en X en el ordenador del club: doble clic en scripts\\x-sesion.cmd, entra con tu cuenta y cierra la ventana.",
  comprobacion: "X ha pedido comprobar que no es un robot: abre scripts\\x-sesion.cmd en el ordenador del club, haz la comprobación y ciérralo. Mientras tanto no se insiste.",
  "sin-chrome": "No se ha podido abrir el Chrome de X en el ordenador del club.",
  error: "La última lectura de X no ha salido.",
};

type LecturaCuenta = { cuenta: string; lectura: LecturaX | null };

type Respuesta = { ok?: boolean; error?: string; lectura?: LecturaX | null; lecturas?: LecturaCuenta[]; ideas?: Idea[] };

export function IdeasDeX({
  estado,
  vigia,
  ahora,
  pide,
}: {
  estado: Mantenimiento;
  vigia: Vigia | null;
  ahora: number;
  pide: (tarea: Tarea) => void;
}) {
  const [lecturas, setLecturas] = useState<LecturaCuenta[]>([]);
  /* Filtro por cuenta (23/11/2026): null = todas. */
  const [deCuenta, setDeCuenta] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [error, setError] = useState(false);
  const [testigo, setTestigo] = useState(0);
  const [pulsado, setPulsado] = useState<string | null>(null);

  const activas = (ideas ?? []).some((i) => i.estado === "añadiendo" || i.estado === "deshaciendo");

  useEffect(() => {
    let cancelado = false;

    fetch("/api/x-ideas", { cache: "no-store" })
      .then((r) => r.json() as Promise<Respuesta>)
      .then((d) => {
        if (cancelado) return;

        if (!d.ok) {
          setError(true);
          return;
        }

        setLecturas(d.lecturas ?? (d.lectura ? [{ cuenta: CUENTAS_X[0].cuenta, lectura: d.lectura }] : []));
        setIdeas(d.ideas ?? []);
        setError(false);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });

    /* Mientras hay algo en marcha, cada 20 s; si no, cada minuto. */
    const reloj = setTimeout(() => setTestigo((n) => n + 1), activas ? 20_000 : 60_000);

    return () => {
      cancelado = true;
      clearTimeout(reloj);
    };
  }, [testigo, activas]);

  const boton = useCallback(async (idea: Idea, accion: AccionIdea) => {
    if (accion === "añadir") {
      const si = await confirmar({
        titulo: `¿Añadir «${idea.titulo}»?`,
        texto: `El ordenador del club la programa en ${idea.pantalla}, comprueba que la web compila y, sólo si todo sale, la publica. Si algo falla, no se publica nada. Luego se puede deshacer.`,
        aceptar: "Añadir",
      });

      if (!si) return;
    }

    if (accion === "deshacer") {
      const si = await confirmar({
        titulo: `¿Deshacer «${idea.titulo}»?`,
        texto: "El ordenador del club revierte exactamente los cambios de esta idea, comprueba que la web compila y lo publica. No toca ninguna otra idea ni otro trabajo: si algo posterior depende de ella, lo dice y no fuerza nada.",
        aceptar: "Deshacer",
        peligro: true,
      });

      if (!si) return;
    }

    setPulsado(`${idea.id}:${accion}`);

    try {
      const r = await fetch("/api/x-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idea.id, accion }),
      });
      const d = (await r.json()) as Respuesta;

      if (!r.ok || !d.ok) throw new Error(d.error ?? `HTTP ${r.status}`);

      setIdeas(d.ideas ?? null);

      /* Si va detrás de otras, que lo diga (16/11/2026): se atienden de una en una. */
      const delante = (d.ideas ?? []).filter(
        (i) => i.id !== idea.id && (i.estado === "añadiendo" || i.estado === "deshaciendo") && i.pedido,
      ).length;

      toast.success(
        accion === "añadir" ? "Pedida" : accion === "deshacer" ? "Deshacer pedido" : accion === "descartar" ? "Descartada" : "Recuperada",
        accion === "añadir" || accion === "deshacer"
          ? {
              description: delante
                ? `Va la ${delante + 1}.ª en cola: se programan de una en una (~30 min cada una). Te aviso al terminar.`
                : "El ordenador del club la coge en unos segundos; te aviso al terminar.",
            }
          : undefined,
      );
    } catch (e) {
      toast.error("No se ha podido", { description: e instanceof Error ? e.message : "Inténtalo otra vez" });
    } finally {
      setPulsado(null);
      setTestigo((n) => n + 1);
    }
  }, []);

  const lecturaEncargo = estadoEncargo("x", estado.x, ahora);
  const leyendo = lecturaEncargo === "pedido" || lecturaEncargo === "en-marcha";
  const ideaEncargo = estadoEncargo("x-idea", estado["x-idea"], ahora);

  /*
  | La cola de verdad (16/11/2026): se atienden de una en una por orden de
  | pedido (siguienteEnCola). Si hay una pasada corriendo, la primera es la que
  | se programa y las demás esperan; antes todas decían «Añadiendo» y el panel
  | escondía la que estaba en marcha tras un «En cola».
  */
  const cola = (ideas ?? [])
    .filter((i) => (i.estado === "añadiendo" || i.estado === "deshaciendo") && i.pedido)
    .sort((a, b) => Date.parse(a.pedido!.en) - Date.parse(b.pedido!.en));
  const ideaCorre = corriendo("x-idea", estado["x-idea"], ahora);
  const enEspera = (ideaEncargo === "pedido" || cola.length > 0) && !ideaCorre;
  const motivoCola = !vigiaVivo(vigia, ahora)
    ? "En cola: el ordenador del club no contesta; empieza en cuanto se encienda"
    : estadoEncargo("partido", estado.partido, ahora) === "en-marcha"
      ? "En cola: espera a que acabe el análisis del partido (las dos cosas a la vez no caben en la memoria del ordenador)"
      : "En cola: el ordenador del club la coge en unos segundos";
  const puestoEnCola = (idea: Idea) => {
    const i = cola.findIndex((c) => c.id === idea.id);

    return i < 0 ? null : { puesto: i + 1, corre: ideaCorre && i === 0 };
  };

  /* Primero lo que sirve para el próximo partido (revisión de expertos, 12/11/2026). */
  /* Lo ya decidido (añadida o deshecha) va aparte y plegado (15/11/2026: la pestaña se hacía larguísima). */
  const hecha = (i: Idea) => i.estado === "añadida" || i.estado === "deshecha";
  const porCuenta = new Map(CUENTAS_X.map((c) => [c.cuenta, (ideas ?? []).filter((i) => cuentaDeIdea(i) === c.cuenta && i.estado !== "descartada" && !hecha(i)).length]));
  const delFiltro = (ideas ?? []).filter((i) => !deCuenta || cuentaDeIdea(i) === deCuenta);
  const vivas = delFiltro.filter((i) => i.estado !== "descartada" && !hecha(i)).sort((a, b) => (a.prioridad ?? 2) - (b.prioridad ?? 2));
  const hechas = delFiltro.filter(hecha);
  const descartadas = delFiltro.filter((i) => i.estado === "descartada");

  return (
    <section className="min-w-0" aria-labelledby="ideas-x">
      <h2 id="ideas-x" className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B]">
        Actualizaciones automáticas desde X
      </h2>
      <p className="mt-1 max-w-3xl text-[12px] text-white/45">
        Cada mañana a las 7:45 se leen las publicaciones nuevas de {CUENTAS_X.map((c) => `@${c.cuenta}`).join(" y ")} y se saca de cada una lo que sirva para mejorar esta app
        (de @Q84_DANI, que pinta datos, sobre todo cómo lo dibuja: se miran también sus imágenes).
        «Añadir» la programa y la publica el ordenador del club; si algo no compila, no se publica nada.
      </p>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px]">
        <ul className="min-w-0 space-y-1">
          {lecturas.length === 0 && (
            <li className="text-white/50">{ideas === null && !error ? "Mirando…" : "Todavía no se ha leído X ninguna vez."}</li>
          )}
          {lecturas.map(({ cuenta, lectura }) => (
            <li key={cuenta} className="min-w-0">
              <span className="font-semibold text-white/85">@{cuenta}</span>{" "}
              {!lectura ? (
                <span className="text-white/50">· todavía sin leer</span>
              ) : lectura.estado === "ok" ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 text-white/75">
                  <Check size={13} className="shrink-0 text-emerald-300" aria-hidden />
                  Leído {fecha(lectura.leidoEn)}
                  {typeof lectura.nuevos === "number" ? ` · ${lectura.nuevos} publicaciones nuevas` : ""}
                  {typeof lectura.ideasNuevas === "number" ? ` · ${lectura.ideasNuevas} ideas` : ""}
                </span>
              ) : (
                <span className="inline-flex min-w-0 items-start gap-1.5 text-amber-200">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    {LECTURA[lectura.estado]}
                    {lectura.detalle && lectura.estado !== "falta-sesion" ? ` (${lectura.detalle})` : ""}
                    {` Mirado ${fecha(lectura.leidoEn)}.`}
                    {lectura.bienEn ? ` Última lectura buena: ${fecha(lectura.bienEn)}.` : ""}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>

        <span className="ml-auto flex items-center gap-2">
          {leyendo ? (
            <span className="inline-flex items-center gap-1.5 text-[#C8A96B]">
              <Loader2 size={13} className="animate-spin" /> {lecturaEncargo === "pedido" ? "Pedida, esperando al ordenador del club" : "Leyendo X"}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => pide("x")}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
            >
              <RefreshCw size={13} /> Leer ahora
            </button>
          )}
        </span>
      </div>

      {(ideaCorre || ideaEncargo === "en-marcha" || enEspera) && (
        <ProgresoEncargo
          tarea="x-idea"
          vivo={vigia?.progreso?.["x-idea"]}
          empezadoEn={estado["x-idea"]?.empezadoEn}
          enCola={enEspera}
          motivoCola={cola.length > 1 ? `${motivoCola} · ${cola.length} en cola, de una en una (~30 min cada una)` : motivoCola}
          detras={ideaCorre ? cola.slice(1).map((i) => i.titulo) : undefined}
        />
      )}

      {error && (
        <p className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] text-amber-200">
          No se han podido leer las ideas. Vuelve a intentarlo en un momento.
        </p>
      )}

      {CUENTAS_X.length > 1 && (ideas?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Ideas de qué cuenta">
          {[null, ...CUENTAS_X.map((c) => c.cuenta)].map((c) => (
            <button
              key={c ?? "todas"}
              type="button"
              aria-pressed={deCuenta === c}
              onClick={() => setDeCuenta(c)}
              className={`dedo-44 min-h-[32px] rounded-full border px-3 text-[12px] font-semibold transition ${deCuenta === c ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]" : "border-white/12 text-white/65 hover:text-white"}`}
            >
              {c ? `@${c} · ${porCuenta.get(c) ?? 0}` : "Todas"}
            </button>
          ))}
        </div>
      )}

      {ideas && !vivas.length && (
        <p className="mt-3 text-[12px] text-white/50">No hay ideas pendientes. Las nuevas salen aquí cada mañana.</p>
      )}

      <ul className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
        {vivas.map((idea) => (
          <TarjetaIdea key={idea.id} idea={idea} cola={puestoEnCola(idea)} pulsado={pulsado} onBoton={boton} />
        ))}
      </ul>

      {hechas.length > 0 && (
        <details className="mt-3 min-w-0">
          <summary className="cursor-pointer text-[12px] text-white/55 hover:text-white">Ya añadidas o deshechas ({hechas.length})</summary>
          <ul className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
            {hechas.map((idea) => (
              <TarjetaIdea key={idea.id} idea={idea} cola={puestoEnCola(idea)} pulsado={pulsado} onBoton={boton} />
            ))}
          </ul>
        </details>
      )}

      {descartadas.length > 0 && (
        <details className="mt-3 min-w-0">
          <summary className="cursor-pointer text-[12px] text-white/55 hover:text-white">Descartadas ({descartadas.length})</summary>
          <ul className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
            {descartadas.map((idea) => (
              <TarjetaIdea key={idea.id} idea={idea} cola={puestoEnCola(idea)} pulsado={pulsado} onBoton={boton} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const ROTULO: Record<AccionIdea, { texto: string; Icono: typeof Plus }> = {
  añadir: { texto: "Añadir", Icono: Plus },
  descartar: { texto: "Descartar", Icono: Cruz },
  deshacer: { texto: "Deshacer", Icono: Undo2 },
  recuperar: { texto: "Recuperar", Icono: RotateCcw },
};

/* 22/11/2026: cuándo se publicó la web por última vez (public/publicado.txt), para decir si una idea ya se ve en ella. */
let publicadoPromesa: Promise<string | null> | null = null;

function usePublicado() {
  const [publicado, setPublicado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    publicadoPromesa ??= fetch("/publicado.txt", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    void publicadoPromesa.then((p) => {
      if (vivo) setPublicado(p);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return publicado;
}

const sinSuscripcion = () => () => undefined;

/** «Ver lo nuevo»: lleva a la pantalla, su pestaña y el elemento resaltado (components/ui/ResaltaAncla.tsx). */
function VerLoNuevo({ idea }: { idea: Idea }) {
  const publicado = usePublicado();
  const enWeb = yaEnLaWeb(idea, publicado);
  const enlace = enlaceSeguro(idea.enlace) ?? idea.pantalla;
  const directo = enlace.includes("#x-idea-");
  const [copiado, setCopiado] = useState(false);
  /* 23/11/2026: el enlace entero a la vista (y para copiar) y dónde está dentro de la página. */
  const origen = useSyncExternalStore(
    sinSuscripcion,
    () => window.location.origin,
    () => "",
  );
  const completo = `${origen}${enlace}`;

  return (
    <div className="grid min-w-0 gap-1.5 text-[12px]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={enlace} className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-[#C8A96B]/15 px-3 font-semibold text-[#C8A96B] hover:bg-[#C8A96B]/25">
          {directo ? "Ir directo a lo nuevo" : "Ver lo nuevo"} <ArrowUpRight size={12} aria-hidden />
        </Link>
        {enWeb === true && <span className="text-emerald-200/80">Ya está en la web.</span>}
        {enWeb === false && <span className="text-amber-200/85">Subida a GitHub: se verá en la web en la próxima publicación en Render.</span>}
      </div>
      {idea.ubicacion && (
        <p className="min-w-0 text-white/75">
          <span className="text-white/40">Dónde: </span>
          {idea.ubicacion}
        </p>
      )}
      <div className="flex min-w-0 items-center gap-2">
        <Link href={enlace} className="min-w-0 truncate font-mono text-[11px] text-white/50 hover:text-[#C8A96B] hover:underline" title={completo}>
          {completo}
        </Link>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(completo).then(
              () => {
                setCopiado(true);
                window.setTimeout(() => setCopiado(false), 1500);
              },
              () => undefined,
            );
          }}
          className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/65 hover:bg-white/[0.06]"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      {!directo && <span className="text-white/45">(sin ancla: abre la pantalla, sin bajar a lo nuevo)</span>}
    </div>
  );
}

function TarjetaIdea({
  idea,
  cola,
  pulsado,
  onBoton,
}: {
  idea: Idea;
  /** Su puesto en la cola y si es la que se está programando ahora. */
  cola: { puesto: number; corre: boolean } | null;
  pulsado: string | null;
  onBoton: (idea: Idea, accion: AccionIdea) => void;
}) {
  const esperando = cola !== null && !cola.corre;
  const chip = esperando
    ? { texto: `En cola · ${cola.puesto}.ª`, clase: "border-white/15 bg-white/[0.04] text-white/65" }
    : cola?.corre
      ? { ...CHIP[idea.estado], texto: idea.estado === "deshaciendo" ? "Deshaciendo ahora" : "Programando ahora" }
      : CHIP[idea.estado];
  const acciones = accionesDe(idea);
  const ultimo = idea.log[idea.log.length - 1];
  /* Plegada en una línea (15/11/2026); en marcha o fallida, abierta. Lo que se abre a mano se recuerda en el aparato. */
  const tono: Tono = idea.estado === "añadiendo" || idea.estado === "deshaciendo" ? "marcha" : idea.estado === "fallida" ? "aviso" : "ok";
  const { abierto, cambia } = usePlegado(`x-idea:${idea.id}`, tono);

  return (
    <li className={`flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] ${abierto ? "gap-3 p-4" : "px-4 py-2.5"}`}>
      <button type="button" onClick={cambia} aria-expanded={abierto} className="flex min-w-0 items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-white">{idea.titulo}</span>
          {!abierto && (
            <span className="mt-0.5 block truncate text-[12px] text-white/50">
              {idea.pantalla}
              {idea.prioridad === 1 ? " · próximo partido" : ""}
              {CUENTAS_X.length > 1 ? ` · @${cuentaDeIdea(idea)}` : ""}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${chip.clase}`}>
            {(idea.estado === "añadiendo" || idea.estado === "deshaciendo") && !esperando && <Loader2 size={11} className="animate-spin" aria-hidden />}
            {chip.texto}
          </span>
          <ChevronDown size={16} aria-hidden className={`text-white/45 transition-transform ${abierto ? "rotate-180" : ""}`} />
        </span>
      </button>

      {idea.estado === "añadida" && <VerLoNuevo idea={idea} />}

      {abierto && (
        <>

      <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/80">{idea.idea}</p>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px] sm:gap-x-4">
        <dt className="text-white/40">Pantalla</dt>
        <dd className="min-w-0">
          <Link href={idea.pantalla} className="inline-flex items-center gap-1 text-[#C8A96B] hover:underline">
            {idea.pantalla} <ArrowUpRight size={12} />
          </Link>
        </dd>
        {idea.porque && (
          <>
            <dt className="text-white/40">Por qué</dt>
            <dd className="min-w-0 text-white/75">{idea.porque}</dd>
          </>
        )}
        {[
          ["Para", [idea.fase, idea.momento].filter(Boolean).join(" · ") + (idea.prioridad === 1 ? " · próximo partido" : idea.prioridad === 3 ? " · de fondo" : "")],
          ["Decide", idea.decision],
          ["Dato", [idea.fuente, idea.muestra].filter(Boolean).join(" · ")],
          ["Se leería", idea.ejemplo],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-white/40">{k}</dt>
              <dd className="min-w-0 text-white/75">{v}</dd>
            </Fragment>
          ))}
        <dt className="text-white/40">Publicación</dt>
        <dd className="min-w-0 text-white/60">
          <span className="italic">«{idea.extracto}»</span>{" "}
          <a href={idea.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 whitespace-nowrap text-[#C8A96B] hover:underline">
            Ver en X · @{cuentaDeIdea(idea)}{fecha(idea.fecha) ? ` · ${fecha(idea.fecha)}` : ""} <ArrowUpRight size={12} />
          </a>
        </dd>
      </dl>

      {idea.resumen && idea.estado === "añadida" && <p className="text-[12px] text-emerald-200/90">{idea.resumen}</p>}

      {idea.fallo && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/[0.07] px-3 py-2 text-[12px] leading-relaxed text-rose-200">
          {idea.estado === "añadida" ? "No se ha podido deshacer: " : "No se ha publicado nada: "}
          {idea.fallo}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {acciones.map((accion) => {
          const { texto, Icono } = ROTULO[accion];
          const principal = accion === "añadir";
          const enCurso = pulsado === `${idea.id}:${accion}`;

          return (
            <button
              key={accion}
              type="button"
              disabled={pulsado !== null}
              onClick={() => onBoton(idea, accion)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold transition disabled:opacity-50 ${
                principal
                  ? "border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B] hover:bg-[#C8A96B]/20"
                  : accion === "deshacer"
                    ? "border-rose-400/40 text-rose-300 hover:bg-rose-400/10"
                    : "border-white/10 text-white/70 hover:border-white/25 hover:text-white"
              }`}
            >
              {enCurso ? <Loader2 size={13} className="animate-spin" /> : <Icono size={13} />} {texto}
            </button>
          );
        })}

        {idea.log.length > 0 && (
          <details className="ml-auto min-w-0 text-[11px] text-white/45">
            <summary className="cursor-pointer hover:text-white/70">{ultimo ? `${fecha(ultimo.en)} · ${ultimo.texto}` : "Historial"}</summary>
            <ol className="mt-2 space-y-1">
              {idea.log.map((a, i) => (
                <li key={i}>
                  {fecha(a.en)} · {a.texto}
                </li>
              ))}
              {idea.commits?.length ? <li>Commits: {idea.commits.map((c) => c.slice(0, 7)).join(", ")}</li> : null}
              {idea.revert ? <li>Deshecha en {idea.revert.slice(0, 7)}</li> : null}
            </ol>
          </details>
        )}
      </div>
        </>
      )}
    </li>
  );
}
