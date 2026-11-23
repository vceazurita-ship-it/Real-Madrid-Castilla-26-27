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
  LayoutGrid,
  ListChecks,
  Scissors,
  Send,
  ShieldAlert,
  SquareKanban,
  Target,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { CabeceraBloque } from "@/components/portada/CabeceraBloque";
import { AnilloVivo } from "@/components/ui/GraficosVivos";
import { ModoFoco, colaDelFoco, useAccionesFoco } from "@/components/portada/ModoFoco";
import { EVENTO_VER_ATRASADAS } from "@/components/portada/AvisoTareasPendientes";
import ModulesExplorer from "@/components/ui/ModulesExplorer";
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
  /* Pizarra ABP y Pizarra táctica ya están en el bloque del partido (05/11/2026). */
  { href: "/jugadores-sesion", titulo: "Jugadores sesión", desc: "Equipos de cada tarea del día", icono: SquareKanban },
  { href: "/microcycles", titulo: "Informes", desc: "Previa y post del partido", icono: FileText },
  { href: "/data-analisis", titulo: "Análisis de datos", desc: "El partido, el equipo, los jugadores y la categoría", icono: BarChart3 },
  { href: "/individual", titulo: "Individual", desc: "Fichas y seguimiento", icono: User },
];

/** Los accesos fijos de la mesa: la portada no los repite en «Áreas de trabajo». */
export const HREFS_MESA = MESA.map((h) => h.href);

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
    /* 20/11/2026 (ronda 7, marketing): «Tu día» y «Atajos» a todo el ancho, uno bajo otro: en dos columnas quedaba un hueco a la derecha de «Atajos». */
    <div className="grid min-w-0 gap-4">
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
  const abreAtrasadas = () => window.dispatchEvent(new CustomEvent(EVENTO_VER_ATRASADAS));

  /* La misma tarea del mismo día, una vez (como la ventana de atrasadas). */
  const atrasadas = useMemo(() => {
    const vistas = new Set<string>();

    return vencidas.filter((t) => {
      const clave = `${t.texto.trim().toLowerCase()}|${t.fecha}`;

      if (vistas.has(clave)) return false;
      vistas.add(clave);

      return true;
    });
  }, [vencidas]);

  /* 20/11/2026 (ronda 5): las atrasadas, plegadas bajo lo de hoy; se despliegan las tres primeras con «Hecha». */
  const [verAtrasadas, setVerAtrasadas] = useState(false);

  /* Modo foco (22/11/2026): lo pendiente de hoy, una a una. */
  const [foco, setFoco] = useState(false);
  const { onHecha, onPospone } = useAccionesFoco({ cambiaHechas, cambiaDoc, dias: semana?.dias ?? [], hoy });

  /* El saludo, por la hora de Madrid (se mira en un efecto, no en el render). */
  const [saludo, setSaludo] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      const h = Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }));
      setSaludo(h < 6 ? "Buenas noches" : h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches");
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const marca = (t: TareaDelDia, hecha: boolean) => {
    if (t.tipo === "auto") cambiaHechas((h) => alternaHechaAuto(h, t.clave, hecha));
    else cambiaDoc((d) => alternaHechaPropia(d, t.id, hecha));
  };

  const marco = "portada-entra portada-tarjeta relative flex min-w-0 flex-col overflow-hidden p-4 sm:p-6";

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

  const colaFoco = colaDelFoco(tareasHoy, atrasadas);

  /* «Buenas tardes · te quedan 2 de hoy y 1 atrasada · envíos pendientes: 1». */
  const resumen = [
    pendientesHoy ? `te ${pendientesHoy === 1 ? "queda 1" : `quedan ${pendientesHoy}`} de hoy` : tareasHoy.length ? "lo de hoy está hecho" : "",
    atrasadas.length ? `${atrasadas.length} ${atrasadas.length === 1 ? "atrasada" : "atrasadas"}` : "",
    envios.length ? `${envios.length} ${envios.length === 1 ? "envío" : "envíos"} por mandar` : "",
  ].filter(Boolean);

  return (
    <section className={marco} aria-label="Tu día">
      {foco && <ModoFoco tareas={colaFoco} hoy={hoy} onHecha={onHecha} onPospone={onPospone} onCierra={() => setFoco(false)} />}

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="portada-rotulo">Tu día</p>
          <h2 className="fuente-club mt-1 text-[28px] font-bold uppercase leading-none text-white">{rotulo}</h2>
          {saludo && (
            <p className="mt-1.5 text-[13px] text-white/65">
              {saludo}
              {resumen.length ? ` · ${resumen.join(" · ")}` : ""}
            </p>
          )}
        </div>


        <div className="flex flex-wrap items-center gap-4">
          {colaFoco.length > 0 && (
            <button
              type="button"
              onClick={() => setFoco(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#D8B45A] px-4 text-sm font-semibold text-[#0B0F14] shadow-sm transition-transform hover:-translate-y-px"
              title="Las pendientes, una a una: H hecha · S saltar · P mañana"
            >
              <Target className="h-4 w-4" aria-hidden /> Modo foco · {colaFoco.length}
            </button>
          )}
          {tareasHoy.length > 0 && (
            <div className="flex items-center gap-2.5" title={`${hechasHoy} de ${tareasHoy.length} hechas hoy`}>
              <AnilloVivo pct={pct} />
              <span className="text-[12px] leading-tight text-white/65">
                <span className="fuente-club block text-[20px] font-bold leading-none text-white">
                  {hechasHoy}/{tareasHoy.length}
                </span>
                hechas
              </span>
            </div>
          )}
        </div>
      </div>

      {tareasHoy.length > 0 ? (
        <ul className="relative mt-4 space-y-2">
          {tareasHoy.slice(0, 5).map((t) => (
            <li key={t.clave} className="portada-celda flex min-w-0 items-start gap-2.5 px-3 py-2.5" style={{ borderRadius: 12 }}>
              <button
                type="button"
                onClick={() => marca(t, !t.hecha)}
                aria-pressed={t.hecha}
                aria-label={t.hecha ? `Desmarcar ${t.texto}` : `Marcar ${t.texto} como hecha`}
                className={`zona-dedo mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${t.hecha ? "border-emerald-400 bg-emerald-500/80" : "border-white/30 hover:border-[#D8B45A]"}`}
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
                <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide text-red-300">Alta</span>
              )}
            </li>
          ))}
          {tareasHoy.length > 5 && (
            <li className="text-[12px] text-white/55">Y {tareasHoy.length - 5} más en Mis tareas</li>
          )}
        </ul>
      ) : (
        <p className="portada-celda relative mt-4 px-3 py-3 text-[14px] text-white/75">
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
      {/*
        20/11/2026 (ronda 4, los tres jueces): las atrasadas, por su nombre y su
        día, en una franja que abre la ventana para marcarlas o pasarlas a hoy.
        Ya no sale sola al entrar (tapaba la cabecera del partido).
      */}
      {/*
        20/11/2026 (ronda 5, análisis y marketing): lo de hoy primero; las
        atrasadas, plegadas en una línea con su cuenta por día («lun 16 · 2»).
        Al desplegar, las tres primeras con su día y «Hecha» aquí mismo, y la
        ventana para pasarlas a hoy o ver el resto.
      */}
      {atrasadas.length > 0 && (() => {
        const dia = (f: string) => `${rotuloDia(f).split(" ")[0].slice(0, 3).toLowerCase()} ${Number(f.slice(8, 10))}`;
        const porDia = new Map<string, TareaDelDia[]>();
        for (const t of atrasadas) porDia.set(t.fecha, [...(porDia.get(t.fecha) ?? []), t]);
        const dias = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b));
        const cuenta = dias.map(([f, l]) => `${dia(f)} · ${l.length}`).join(", ");

        /*
        | 20/11/2026 (ronda 7, los tres jueces): el desglose salía en rosa
        | pálido sobre rosa (`text-red-200/90` no tiene equivalencia en modo
        | día) y no se leía. Ahora un botón claro, «7 atrasadas · verlas ›», en
        | la tinta del tema; el desglose por día sólo desde la tableta (en el
        | móvil se queda en «7 atrasadas · verlas»). Al abrirlo, las de cada
        | día bajo su día, cada una a su pantalla y con «Hecha».
        */
        return (
          <div className="portada-celda relative mt-3 min-w-0 text-[13px] leading-snug" style={{ borderRadius: 12, boxShadow: "inset 3px 0 0 var(--rmcf-dif-peor, #D95F02)" }}>
            <button
              type="button"
              onClick={() => setVerAtrasadas((v) => !v)}
              aria-expanded={verAtrasadas}
              className="flex min-h-11 w-full min-w-0 items-center gap-2 px-3 py-2 text-left"
            >
              <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: "var(--rmcf-dif-peor, #D95F02)" }} aria-hidden />
              <span className="min-w-0 flex-1 text-white/85">
                <b className="font-bold text-white">
                  {atrasadas.length === 1 ? "1 atrasada" : `${atrasadas.length} atrasadas`}
                </b>
                <span className="hidden sm:inline"> · {cuenta}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold" style={{ color: "var(--rmcf-gold-ink)" }}>
                {verAtrasadas ? "Plegar" : "Verlas"}
                <ChevronRight className={`h-4 w-4 transition-transform ${verAtrasadas ? "rotate-90" : ""}`} aria-hidden />
              </span>
            </button>

            {verAtrasadas ? (
              <div className="border-t border-white/[0.08] px-3 pb-2.5 pt-1.5">
                {dias.map(([f, lista]) => (
                  <div key={f} className="mt-1.5 first:mt-0">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/65">
                      {dia(f)} · {lista.length}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {lista.map((t) => (
                        <li key={t.clave} className="flex min-w-0 items-center gap-2">
                          {t.href ? (
                            <Link
                              href={t.href}
                              onClick={() => trackModuleVisit(t.href!)}
                              className="min-w-0 flex-1 font-medium text-white/90 underline decoration-white/25 underline-offset-2 hover:decoration-current"
                            >
                              {t.texto}
                            </Link>
                          ) : (
                            <span className="min-w-0 flex-1 font-medium text-white/90">{t.texto}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => marca(t, true)}
                            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-white/20 px-2.5 text-[12px] font-semibold text-white/85 transition hover:bg-white/[0.08]"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Hecha
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={abreAtrasadas}
                  className="mt-2 min-h-9 text-[12.5px] font-semibold underline underline-offset-2"
                  style={{ color: "var(--rmcf-gold-ink)" }}
                >
                  Pasarlas a hoy
                </button>
              </div>
            ) : null}
          </div>
        );
      })()}

      {envios.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-2">
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
          {/* 20/11/2026 (análisis): sin repetir «N por hacer hoy»; ya lo dice el anillo de arriba. */}
          {pendientesHoy > 0 ? "" : tareasHoy.length ? "Todo lo de hoy, hecho" : `Hasta el partido ante ${semana.proximo.rival}`}
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
/* ------------------------------------------------------------------ */
/*  MESA DE TRABAJO                                                    */
/* ------------------------------------------------------------------ */

function MesaDeTrabajo({ admin }: { admin: boolean }) {
  const herramientas = MESA.filter((h) => admin || !h.soloAdmin);

  const recientes = useRutasRecientes(4, ["/"]).filter((r) => TITULOS.has(r.href));

  /* Las áreas, plegadas: se abren aquí mismo con su buscador y sus filtros. */
  const [verAreas, setVerAreas] = useState(false);

  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);

    return () => clearTimeout(id);
  }, []);

  return (
    <section
      className="portada-entra portada-tarjeta relative min-w-0 overflow-hidden p-4 sm:p-6"
      style={{ animationDelay: "80ms" }}
      aria-label="Mesa de trabajo"
    >
      {/* 17/11/2026 (fútbol): «Mesa de trabajo» y «Áreas de trabajo» eran dos rejillas de enlaces; ahora un solo bloque, con las áreas detrás de un botón. */}
      <CabeceraBloque icono={Wrench} titulo="Atajos" sub="Las herramientas de todos los días y lo último que abriste" />

      {/* La que queda sola ocupa la fila (02/11/2026): a lo ancho en el móvil y, en la tableta, las de la última fila se reparten el hueco. */}
      {/*
        18/11/2026 (ronda 22, marketing): la portada se acorta. Los atajos pasan
        de tarjetas altas con su explicación a una fila de botones (la
        explicación queda en el `title`), y «Todas las áreas» va en la misma
        fila en vez de en un renglón aparte.
      */}
      <div className="mt-4 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
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
              className="portada-celda portada-viva group inline-flex min-h-[44px] min-w-0 items-center gap-2 px-3 py-2 text-[13.5px] font-semibold leading-tight text-white/90"
              style={{ borderRadius: 12 }}
            >
              <Icono className="h-4 w-4 shrink-0" style={{ color: "var(--rmcf-gold-ink)" }} aria-hidden />
              <span className="min-w-0 break-words">{h.titulo}</span>
              <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/30 transition-all group-hover:text-[#D8B45A]" aria-hidden />
            </Link>
          );
        })}
        {!verAreas && (
          <button
            type="button"
            onClick={() => setVerAreas(true)}
            className="portada-celda portada-viva inline-flex min-h-[44px] min-w-0 items-center gap-2 px-3 py-2 text-[13.5px] font-semibold leading-tight text-white/85"
            style={{ borderRadius: 12 }}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" style={{ color: "var(--rmcf-gold-ink)" }} aria-hidden />
            Todas las áreas ({MODULES.length})
            <ChevronRight className="ml-auto h-4 w-4 shrink-0" aria-hidden />
          </button>
        )}
      </div>

      {recientes.length > 0 && ahora > 0 && (
        /* 18/11/2026 (ronda 22): en una línea que baja si no cabe, no en dos columnas. */
        <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-white/[0.07] pt-2.5">
          <p className="mr-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">
            <Clock3 className="h-3.5 w-3.5" />
            Lo último
          </p>
          <ul className="contents">
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
                    <span className="min-w-0 truncate text-[13px] font-medium text-white/85">{modulo.titulo}</span>
                    <span className="shrink-0 text-[12px] text-white/55">{haceCuanto(r.cuando, ahora)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {verAreas ? (
        <div className="mt-4 border-t border-white/[0.07] pt-3">
          <ModulesExplorer excluir={HREFS_MESA} />
        </div>
      ) : null}
    </section>
  );
}
