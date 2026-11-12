"use client";

/**
 * ACTUALIZACIONES AUTOMÁTICAS DESDE X (12/11/2026).
 *
 * Cada mañana el ordenador del club lee las publicaciones nuevas de
 * @fernandosb9 en X y saca de ellas ideas concretas para esta app. Aquí se ven
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
 * Datos: `/api/x-ideas` (documentos `x:fernandosb9` y `x:ideas`); reglas en
 * `lib/x-ideas.ts`.
 */

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, Loader2, Plus, RefreshCw, RotateCcw, Undo2, X as Cruz } from "lucide-react";
import { toast } from "sonner";

import { ProgresoEncargo } from "@/components/ajustes/ProgresoEncargo";
import { confirmar } from "@/lib/avisos";
import { estadoEncargo, type Mantenimiento, type Tarea, type Vigia } from "@/lib/mantenimiento";
import { CUENTA_X, accionesDe, type AccionIdea, type EstadoIdea, type Idea, type LecturaX } from "@/lib/x-ideas";

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

type Respuesta = { ok?: boolean; error?: string; lectura?: LecturaX | null; ideas?: Idea[] };

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
  const [lectura, setLectura] = useState<LecturaX | null>(null);
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

        setLectura(d.lectura ?? null);
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

      toast.success(
        accion === "añadir" ? "Pedida" : accion === "deshacer" ? "Deshacer pedido" : accion === "descartar" ? "Descartada" : "Recuperada",
        accion === "añadir" || accion === "deshacer" ? { description: "El ordenador del club la coge en unos segundos; te aviso al terminar." } : undefined,
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

  /* Primero lo que sirve para el próximo partido (revisión de expertos, 12/11/2026). */
  const vivas = (ideas ?? []).filter((i) => i.estado !== "descartada").sort((a, b) => (a.prioridad ?? 2) - (b.prioridad ?? 2));
  const descartadas = (ideas ?? []).filter((i) => i.estado === "descartada");

  return (
    <section className="min-w-0" aria-labelledby="ideas-x">
      <h2 id="ideas-x" className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B]">
        Actualizaciones automáticas desde X
      </h2>
      <p className="mt-1 max-w-3xl text-[12px] text-white/45">
        Cada mañana a las 7:45 se leen las publicaciones nuevas de @{CUENTA_X} y se saca de cada una lo que sirva para mejorar esta app.
        «Añadir» la programa y la publica el ordenador del club; si algo no compila, no se publica nada.
      </p>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px]">
        {lectura ? (
          lectura.estado === "ok" ? (
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
          )
        ) : (
          <span className="text-white/50">{ideas === null && !error ? "Mirando…" : "Todavía no se ha leído X ninguna vez."}</span>
        )}

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

      {(ideaEncargo === "en-marcha" || ideaEncargo === "pedido") && (
        <ProgresoEncargo
          tarea="x-idea"
          vivo={vigia?.progreso?.["x-idea"]}
          empezadoEn={estado["x-idea"]?.empezadoEn}
          enCola={ideaEncargo === "pedido"}
        />
      )}

      {error && (
        <p className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] text-amber-200">
          No se han podido leer las ideas. Vuelve a intentarlo en un momento.
        </p>
      )}

      {ideas && !vivas.length && (
        <p className="mt-3 text-[12px] text-white/50">No hay ideas pendientes. Las nuevas salen aquí cada mañana.</p>
      )}

      <ul className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
        {vivas.map((idea) => (
          <TarjetaIdea key={idea.id} idea={idea} pulsado={pulsado} onBoton={boton} />
        ))}
      </ul>

      {descartadas.length > 0 && (
        <details className="mt-3 min-w-0">
          <summary className="cursor-pointer text-[12px] text-white/55 hover:text-white">Descartadas ({descartadas.length})</summary>
          <ul className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
            {descartadas.map((idea) => (
              <TarjetaIdea key={idea.id} idea={idea} pulsado={pulsado} onBoton={boton} />
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

function TarjetaIdea({
  idea,
  pulsado,
  onBoton,
}: {
  idea: Idea;
  pulsado: string | null;
  onBoton: (idea: Idea, accion: AccionIdea) => void;
}) {
  const chip = CHIP[idea.estado];
  const acciones = accionesDe(idea);
  const ultimo = idea.log[idea.log.length - 1];

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 text-[15px] font-semibold text-white">{idea.titulo}</p>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${chip.clase}`}>
          {(idea.estado === "añadiendo" || idea.estado === "deshaciendo") && <Loader2 size={11} className="animate-spin" aria-hidden />}
          {chip.texto}
        </span>
      </div>

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
            Ver en X{fecha(idea.fecha) ? ` · ${fecha(idea.fecha)}` : ""} <ArrowUpRight size={12} />
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
    </li>
  );
}
