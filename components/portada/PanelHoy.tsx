"use client";

/**
 * LO DE HOY, EN LA PORTADA (02/11/2026).
 *
 * «La portada se me queda corta»: el partido estaba arriba, pero lo que el
 * analista tiene que hacer hoy vivía en otra pestaña y las herramientas de
 * todos los días (coding, pizarras, informes) a dos pantallas, entre las 46
 * áreas. Aquí, debajo del partido:
 *
 * - **Tu día** (sólo administrador): las tareas de hoy del microciclo
 *   (`semanaDelMicro`), que se marcan aquí mismo; lo que quedó de días
 *   anteriores y los envíos de la semana que faltan. Mismos documentos y
 *   misma lógica que «Mis tareas» (`useMisTareas`): marcar aquí es marcar allí.
 * - **Mesa de trabajo**: las herramientas fijas y lo último abierto en este
 *   aparato (`useRutasRecientes`), con cuándo.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  ListChecks,
  PenTool,
  Scissors,
  Send,
  ShieldAlert,
  SquareKanban,
  User,
  type LucideIcon,
} from "lucide-react";

import { useCalendario } from "@/hooks/useCalendario";
import { useMisTareas, useSesionesDelMicro } from "@/hooks/useMisTareas";
import { pantallaCompletaAlNavegar } from "@/hooks/usePantallaCompleta";
import { MODULES } from "@/lib/modules";
import { trackModuleVisit, useRutasRecientes } from "@/lib/module-usage";
import {
  EVENTO_ABRIR,
  alternaHechaAuto,
  alternaHechaPropia,
  hoyEnMadrid,
  pendientesAnteriores,
  rotuloDia,
  semanaDelMicro,
  type TareaDelDia,
} from "@/lib/portada/mis-tareas";

/** Los envíos de la semana: lo que el cuerpo técnico espera recibir. */
const ENVIOS = new Set(["informe-post", "informe-previa"]);

type Herramienta = { href: string; titulo: string; desc: string; icono: LucideIcon; soloAdmin?: boolean; completa?: boolean };

const MESA: Herramienta[] = [
  { href: "/coding", titulo: "Coding", desc: "Marcar el partido y cortar clips", icono: Scissors, soloAdmin: true },
  { href: "/abp-pizarra", titulo: "Pizarra ABP", desc: "Rutinas, PDF y vídeo por jugador", icono: PenTool },
  { href: "/pizarra-tactica", titulo: "Pizarra táctica", desc: "Los dos onces, a pantalla completa", icono: SquareKanban, completa: true },
  { href: "/microcycles", titulo: "Informes", desc: "Previa y post del partido", icono: FileText },
  { href: "/data-analisis", titulo: "Data análisis", desc: "Wyscout y Opta del grupo", icono: BarChart3 },
  { href: "/individual", titulo: "Individual", desc: "Fichas y seguimiento", icono: User },
];

const TITULOS = new Map(MODULES.map((m) => [m.href, { titulo: m.title, icono: m.icon }]));

/** «hace 5 min», «hace 3 h», «ayer», «hace 4 días». */
function haceCuanto(cuando: number, ahora: number) {
  const min = Math.max(0, Math.round((ahora - cuando) / 60_000));

  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;

  const horas = Math.round(min / 60);

  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.round(horas / 24);

  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

export function PanelHoy({ admin }: { admin: boolean }) {
  return (
    <div className={`grid min-w-0 gap-4 ${admin ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start" : ""}`}>
      {admin && <TuDia />}
      <MesaDeTrabajo admin={admin} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TU DÍA                                                             */
/* ------------------------------------------------------------------ */

function TuDia() {
  const { partidos } = useCalendario();
  const { sesiones } = useSesionesDelMicro();
  const { hechas, doc, cambiaHechas, cambiaDoc, cargando, guardando } = useMisTareas();

  const [hoy, setHoy] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setHoy(hoyEnMadrid()), 0);

    return () => clearTimeout(id);
  }, []);

  const semana = useMemo(
    () => (hoy && partidos.length ? semanaDelMicro({ partidos, hoy, hechas, doc, sesiones }) : null),
    [partidos, hoy, hechas, doc, sesiones],
  );

  const vencidas = useMemo(
    () => (hoy && partidos.length ? pendientesAnteriores({ partidos, hoy, hechas, doc, sesiones }) : []),
    [partidos, hoy, hechas, doc, sesiones],
  );

  const abreTareas = () => window.dispatchEvent(new CustomEvent(EVENTO_ABRIR));

  const marca = (t: TareaDelDia, hecha: boolean) => {
    if (t.tipo === "auto") cambiaHechas((h) => alternaHechaAuto(h, t.clave, hecha));
    else cambiaDoc((d) => alternaHechaPropia(d, t.id, hecha));
  };

  const marco = "portada-entra relative flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-5 sm:p-6";

  if (!semana || cargando) {
    return (
      <section className={marco} aria-busy="true" aria-label="Tu día">
        <span className="h-4 w-32 animate-pulse rounded bg-white/10" />
        <span className="mt-4 h-5 w-3/4 animate-pulse rounded bg-white/10" />
        <span className="mt-3 h-5 w-2/3 animate-pulse rounded bg-white/10" />
        <span className="mt-3 h-5 w-1/2 animate-pulse rounded bg-white/10" />
      </section>
    );
  }

  const deHoy = semana.dias.find((d) => d.fecha === hoy) ?? null;
  const tareasHoy = deHoy?.tareas ?? [];
  const hechasHoy = tareasHoy.filter((t) => t.hecha).length;
  const pendientesHoy = tareasHoy.length - hechasHoy;

  /* Los envíos que faltan, de hoy en adelante. */
  const envios = semana.dias.flatMap((d) => d.tareas).filter((t) => ENVIOS.has(t.id) && !t.hecha && t.fecha >= hoy);

  /* Con el día despejado se dice qué viene, no un hueco. */
  const siguiente = semana.dias
    .filter((d) => d.fecha > hoy)
    .flatMap((d) => d.tareas)
    .find((t) => !t.hecha);

  const rotulo = deHoy ? `${rotuloDia(hoy).split(" ")[0]} ${Number(hoy.slice(8, 10))} · ${deHoy.md}` : rotuloDia(hoy);
  const pct = tareasHoy.length ? Math.round((hechasHoy / tareasHoy.length) * 100) : 100;

  return (
    <section className={marco} aria-label="Tu día">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#D8B45A]/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--rmcf-gold-ink)" }}>
            Tu día
          </p>
          <h2 className="fuente-club mt-1 text-[28px] font-bold uppercase leading-none text-white">{rotulo}</h2>
        </div>

        {tareasHoy.length > 0 && (
          <div className="flex items-center gap-2.5" title={`${hechasHoy} de ${tareasHoy.length} hechas hoy`}>
            <Anillo pct={pct} />
            <span className="text-[12px] leading-tight text-white/65">
              <span className="fuente-club block text-[20px] font-bold leading-none text-white">
                {hechasHoy}/{tareasHoy.length}
              </span>
              hechas
            </span>
          </div>
        )}
      </div>

      {tareasHoy.length > 0 ? (
        <ul className="relative mt-4 space-y-2">
          {tareasHoy.slice(0, 5).map((t) => (
            <li key={t.clave} className="flex min-w-0 items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <button
                type="button"
                onClick={() => marca(t, !t.hecha)}
                aria-pressed={t.hecha}
                aria-label={t.hecha ? `Desmarcar ${t.texto}` : `Marcar ${t.texto} como hecha`}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${t.hecha ? "border-emerald-400 bg-emerald-500/80" : "border-white/30 hover:border-[#D8B45A]"}`}
              >
                {t.hecha && <Check className="h-3.5 w-3.5 text-white" />}
              </button>

              <div className="min-w-0 flex-1">
                {t.href ? (
                  <Link href={t.href} onClick={() => trackModuleVisit(t.href!)} className={`text-[14px] font-medium hover:underline ${t.hecha ? "text-white/45 line-through" : "text-white/90"}`}>
                    {t.texto}
                  </Link>
                ) : (
                  <span className={`text-[14px] font-medium ${t.hecha ? "text-white/45 line-through" : "text-white/90"}`}>{t.texto}</span>
                )}
                {!t.hecha && t.hecho && <p className="mt-0.5 text-[12px] leading-snug text-white/50">{t.hecho}</p>}
              </div>

              {t.prioridad === "alta" && !t.hecha && (
                <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-red-300">Alta</span>
              )}
            </li>
          ))}
          {tareasHoy.length > 5 && (
            <li className="text-[12px] text-white/55">Y {tareasHoy.length - 5} más en Mis tareas</li>
          )}
        </ul>
      ) : (
        <p className="relative mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-[14px] text-white/75">
          {deHoy?.tipo === "libre" ? "Día libre en el microciclo." : "Hoy está despejado."}
          {siguiente && (
            <>
              {" "}Lo siguiente: <span className="font-semibold text-white/90">{siguiente.texto}</span>
              <span className="text-white/55"> · {rotuloDia(siguiente.fecha)}</span>
            </>
          )}
        </p>
      )}

      {/* Lo que no puede esperar: lo de días anteriores y los envíos. */}
      {(vencidas.length > 0 || envios.length > 0) && (
        <div className="relative mt-3 flex flex-wrap gap-2">
          {vencidas.length > 0 && (
            <button
              type="button"
              onClick={abreTareas}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-[12.5px] font-semibold text-red-300 transition hover:bg-red-500/20"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {vencidas.length} {vencidas.length === 1 ? "pendiente" : "pendientes"} de días anteriores
            </button>
          )}
          {envios.map((t) => (
            <Link
              key={t.clave}
              href={t.href ?? "/microcycles"}
              onClick={() => trackModuleVisit(t.href ?? "/microcycles")}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[#D8B45A]/45 bg-[#D8B45A]/10 px-3 py-1.5 text-[12.5px] font-semibold text-[#F7D98B] transition hover:bg-[#D8B45A]/20"
              title={t.hecho}
            >
              <Send className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {t.id === "informe-post" ? "Informe post" : "Informe previa"} · {t.fecha === hoy ? "hoy" : rotuloDia(t.fecha).split(" ")[0].toLowerCase()}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="relative mt-auto flex items-center justify-between gap-3 pt-4">
        <span className="text-[12px] text-white/55">
          {pendientesHoy > 0 ? `${pendientesHoy} por hacer hoy` : tareasHoy.length ? "Todo lo de hoy, hecho" : `Hasta el partido ante ${semana.proximo.rival}`}
          {guardando ? " · guardando…" : ""}
        </span>
        <button
          type="button"
          onClick={abreTareas}
          className="group inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold"
          style={{ color: "var(--rmcf-gold-ink)" }}
        >
          <ListChecks className="h-4 w-4" />
          Toda la semana
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </section>
  );
}

/** Un anillo de avance, dorado, que se llena con lo hecho hoy. */
function Anillo({ pct }: { pct: number }) {
  const r = 16;
  const largo = 2 * Math.PI * r;

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden className="-rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" style={{ stroke: "rgb(var(--rmcf-ink-rgb) / .12)" }} />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={largo}
        strokeDashoffset={largo * (1 - pct / 100)}
        style={{ stroke: "var(--rmcf-gold-ink)", transition: "stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)" }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  MESA DE TRABAJO                                                    */
/* ------------------------------------------------------------------ */

function MesaDeTrabajo({ admin }: { admin: boolean }) {
  const herramientas = MESA.filter((h) => admin || !h.soloAdmin);

  const recientes = useRutasRecientes(4, ["/"]).filter((r) => TITULOS.has(r.href));

  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);

    return () => clearTimeout(id);
  }, []);

  return (
    <section
      className="portada-entra relative min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-5 sm:p-6"
      style={{ animationDelay: "80ms" }}
      aria-label="Mesa de trabajo"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--rmcf-gold-ink)" }}>
        Mesa de trabajo
      </p>

      {/* La que queda sola en el móvil ocupa la fila entera (02/11/2026). */}
      <div className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1 ${admin ? "" : "lg:grid-cols-5"}`}>
        {herramientas.map((h) => {
          const Icono = h.icono;

          return (
            <Link
              key={h.href}
              href={h.completa ? `${h.href}?once=1` : h.href}
              onClick={() => {
                trackModuleVisit(h.href);
                if (h.completa) pantallaCompletaAlNavegar();
              }}
              title={h.desc}
              className="group flex min-w-0 flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D8B45A]/50 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D8B45A]"
            >
              <span className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D8B45A]/30 bg-[#D8B45A]/[0.08]" style={{ color: "var(--rmcf-gold-ink)" }}>
                  <Icono className="h-[18px] w-[18px]" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-white/30 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#D8B45A]" />
              </span>
              <span className="min-w-0">
                <span className="fuente-club block break-words text-[17px] sm:text-[19px] font-bold uppercase leading-none tracking-[0.01em] text-white">{h.titulo}</span>
                <span className="mt-1 block text-[12px] leading-snug text-white/55">{h.desc}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {recientes.length > 0 && ahora > 0 && (
        <div className="mt-4 border-t border-white/[0.07] pt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
            <Clock3 className="h-3.5 w-3.5" />
            Lo último abierto
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {recientes.map((r) => {
              const modulo = TITULOS.get(r.href)!;
              const Icono = modulo.icono;

              return (
                <li key={r.href} className="min-w-0">
                  <Link
                    href={r.href}
                    onClick={() => trackModuleVisit(r.href)}
                    className="group flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.05]"
                  >
                    <Icono className="h-4 w-4 shrink-0 text-white/45 group-hover:text-[#D8B45A]" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">{modulo.titulo}</span>
                    <span className="shrink-0 text-[11px] text-white/50">{haceCuanto(r.cuando, ahora)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
