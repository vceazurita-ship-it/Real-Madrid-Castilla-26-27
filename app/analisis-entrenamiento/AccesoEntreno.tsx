"use client";

/**
 * Lo que ve quien llega al análisis de entrenamiento sin sesión (19/10/2026):
 * el mismo panel de entrada que la quiniela y las apuestas (las cuentas del
 * cuerpo técnico). Al entrar se vuelve a pedir la página al servidor, que es
 * quien decide.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronDown, Play, Users } from "lucide-react";

import { AbpHeader, Notice } from "@/components/abp/ui";
import { Acceso } from "@/components/quiniela/Acceso";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";
import { MINIMO_PORCENTAJE } from "@/lib/entreno/modelo";
import type { UltimaSesionPublica } from "@/lib/entreno/ultima-publica";

/* Los mismos colores que la pantalla de dentro (`COLOR_BIEN` y `COLOR_MEJORABLE` de VisorClips). */
const BIEN = "#1B9E77";
const MEJORABLE = "#D95F02";
const LINEA = "rgba(255,255,255,.4)";
/* La tinta del tema, en los dos modos (globals.css). */
const TINTA = "rgb(var(--rmcf-ink-rgb) / .8)";

/**
 * La ficha de objetivos tal como se ve dentro, con un ejemplo inventado.
 *
 * 16/11/2026 (jueces): con una tarea entera —su gráfico de correctas y
 * mejorables por jugador y un clip—, para que se entienda qué da la
 * pantalla sin entrar. Segunda vuelta: el umbral de tendencia es el de la
 * pantalla (`MINIMO_PORCENTAJE`, 15) y un jugador queda por debajo para
 * enseñar cómo se lee; la tarjeta dice «Ejemplo» dentro.
 */
function MuestraFicha() {
  const meta = 60;
  const filas = [
    { jugador: "Jugador A", correctas: 12, total: 18 },
    { jugador: "Jugador B", correctas: 8, total: 16 },
    { jugador: "Jugador C", correctas: 13, total: 17 },
    { jugador: "Jugador D", correctas: 6, total: 9 },
  ].map((f) => ({ ...f, pct: Math.round((f.correctas / f.total) * 100), tendencia: f.total < MINIMO_PORCENTAJE }));

  return (
    <figure className="@container relative rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-4 sm:p-5" aria-label="Ejemplo inventado de la ficha de objetivos">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">Así se lee una tarea</span>
        <span className="rounded-full bg-[#C8A96B] px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#0B0F14]">Ejemplo</span>
      </figcaption>
      <p className="text-[15px] font-semibold text-white">
        <span className="text-[#C8A96B]">MD-3 · T2</span> Rondo 7v3
      </p>
      <p className="mt-1 text-[13px] text-white/65">Objetivo: perfilarse antes de recibir · meta {meta} %, la que fija el cuerpo técnico para la tarea</p>

      {/* Gráfico y clip lado a lado cuando la ficha es ancha (por su propio ancho, no el de la ventana). */}
      <div className="mt-4 grid gap-4 @xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* El gráfico de la tarea: correctas y mejorables de cada jugador, con la meta marcada. */}
        <div className="min-w-0">
          <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BIEN }} aria-hidden /> Correctas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MEJORABLE }} aria-hidden /> Mejorables
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-0.5" style={{ background: TINTA }} aria-hidden /> Meta {meta} %
            </span>
          </p>
          <ul className="space-y-2.5">
            {filas.map((f) => {
              const cumple = f.pct >= meta;

              return (
                <li key={f.jugador} className="min-w-0">
                  <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13px] text-white/75">
                    <span className="font-semibold text-white/85">{f.jugador}</span>
                    {f.tendencia ? (
                      <>
                        <span className="tabular-nums">{f.correctas} de {f.total}</span>
                        <span className="font-semibold text-white/60">· tendencia, sin porcentaje ni veredicto</span>
                      </>
                    ) : (
                      <>
                        <span className="tabular-nums">
                          {f.correctas} de {f.total} ({f.pct} %)
                        </span>
                        <span className={`font-semibold ${cumple ? "text-emerald-300" : "text-amber-300"}`}>{cumple ? "· cumple" : "· no llega"}</span>
                      </>
                    )}
                  </p>
                  {/* 17/11/2026 (jueces): por debajo de 15 acciones, puntos y sin meta: una barra se leía como porcentaje. */}
                  {f.tendencia ? (
                    <p className="mt-1 flex flex-wrap gap-1" aria-hidden>
                      {Array.from({ length: f.total }, (_, i) => (
                        <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: i < f.correctas ? BIEN : MEJORABLE }} />
                      ))}
                    </p>
                  ) : (
                    <div className="relative mt-1 flex h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                      <span style={{ width: `${(f.correctas / f.total) * 100}%`, background: BIEN }} />
                      <span style={{ width: `${((f.total - f.correctas) / f.total) * 100}%`, background: MEJORABLE }} />
                      <span className="absolute inset-y-0 w-0.5" style={{ left: `${meta}%`, background: TINTA }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] text-white/50">Acierto = correctas ÷ acciones revisadas. Con menos de {MINIMO_PORCENTAJE} acciones no se da porcentaje: se lee como tendencia.</p>
        </div>

        {/* Un clip, como sale al pulsar una barra: el fotograma, su veredicto y lo que se vio. */}
        <div className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 siempre-oscuro" style={{ background: "repeating-linear-gradient(90deg, #1d4d2c 0 12.5%, #225a33 12.5% 25%)" }} aria-hidden>
            {/* Las líneas del campo con color en `style`: la regla global de bordes y el modo día no las tocan. */}
            <span className="absolute inset-x-[8%] inset-y-[10%] rounded-sm border" style={{ borderColor: LINEA }} />
            <span className="absolute inset-y-[10%] left-1/2 w-px" style={{ background: LINEA }} />
            <span className="absolute left-1/2 top-1/2 h-[30%] w-[17%] -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ borderColor: LINEA }} />
            <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55">
              <Play size={18} className="ml-0.5 text-white" />
            </span>
            <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">00:42 · 8 s</span>
          </div>
          <p className="mt-2 text-[13px] text-white/75">
            <span className="font-semibold" style={{ color: BIEN }}>Correcta</span> · Jugador A se perfila de cara antes del pase y juega a un toque hacia fuera.
          </p>
          <p className="mt-1 text-[12px] text-white/50">Cada barra, punto o cifra abre los clips que la forman.</p>
        </div>
      </div>
      {/*
      | 10/11/2026: los expertos pedían el último análisis real, anonimizado.
      | No se hace: esta puerta la ve cualquiera (web y repositorio públicos) y
      | un análisis del vestuario, aun sin nombres, no debe salir de la cuenta
      | del staff. Se queda la muestra del formato y se dice qué es.
      */}
      <p className="mt-3 text-[12px] text-white/55">Cada acción lleva su clip, y el mensaje para el jugador sale de lo que se vio. Jugadores y cifras de la muestra son ilustrativos.</p>
    </figure>
  );
}

/** «lunes 16/11» sin depender del reloj del aparato. */
function fechaLegible(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-ES", { weekday: "long", timeZone: "UTC" });

  return `${dia} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/**
 * La última sesión analizada, de verdad y sólo agregada (16/11/2026, jueces):
 * fecha, objetivos medidos, acierto y su base. Sin jugadores ni textos: esta
 * puerta es pública.
 */
function UltimaSesion({ ultima }: { ultima: UltimaSesionPublica }) {
  return (
    <section aria-label="Última sesión analizada" className="rounded-2xl border border-[#C8A96B]/35 bg-[#C8A96B]/[0.06] p-4 sm:p-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">Última sesión analizada · {fechaLegible(ultima.fecha)}</p>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums text-white sm:text-3xl">
          {ultima.pct !== null ? `${ultima.pct} % de acierto` : `${ultima.correctas} de ${ultima.total} correctas`}
        </span>
        <span className="text-[14px] text-white/65">
          {ultima.pct !== null
            ? `${ultima.correctas} de ${ultima.total} acciones ${ultima.provisional ? "propuestas" : "revisadas"}`
            : `menos de ${MINIMO_PORCENTAJE} acciones: tendencia`}
          {` · ${ultima.objetivos} ${ultima.objetivos === 1 ? "objetivo medido" : "objetivos medidos"}`}
        </span>
        {ultima.provisional ? (
          <span
            className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300"
            title="Ninguna acción revisada todavía: es la propuesta automática del análisis"
          >
            provisional · sin revisar
          </span>
        ) : null}
      </p>
      {/* 16/11/2026, segunda vuelta: el cumplimiento por tarea, en barras (sólo lo agregado). */}
      {ultima.tareas?.length ? (
        <ul className="mt-4 space-y-2.5" aria-label="Acierto por tarea">
          {ultima.tareas.map((t) => (
            <li key={t.codigo} className="min-w-0">
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="font-semibold text-[#C8A96B]">{t.codigo}</span>
                {t.nombre ? <span className="min-w-0 truncate text-white/80">{t.nombre}</span> : null}
                <span className="flex-1" />
                <span className="tabular-nums text-white/70">
                  {t.pct !== null ? `${t.pct} %` : "tendencia"} · {t.correctas} de {t.total}
                </span>
              </p>
              {/* 17/11/2026 (jueces): con la meta marcada si la tiene; por debajo de 15 acciones, puntos y sin meta (no es un porcentaje). */}
              {t.pct === null ? (
                <p className="mt-1 flex flex-wrap gap-1" aria-hidden>
                  {Array.from({ length: t.total }, (_, i) => (
                    <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: i < t.correctas ? BIEN : MEJORABLE }} />
                  ))}
                </p>
              ) : (
                <div className="relative mt-1" aria-hidden>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
                    <span style={{ width: `${(t.correctas / t.total) * 100}%`, background: BIEN }} />
                    <span style={{ width: `${((t.total - t.correctas) / t.total) * 100}%`, background: MEJORABLE }} />
                  </div>
                  {t.meta ? <span className="absolute -top-1 h-[18px] w-0.5 rounded-full" style={{ left: `${Math.min(100, t.meta)}%`, background: TINTA }} title={`Meta ${t.meta} %`} /> : null}
                </div>
              )}
              {t.pct !== null && t.meta ? (
                <p className={`mt-0.5 text-[11px] font-semibold ${t.pct >= t.meta ? "text-emerald-300" : "text-amber-300"}`}>
                  {t.pct >= t.meta ? `cumple (meta ${t.meta} %)` : `no llega (meta ${t.meta} %)`}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {/* 17/11/2026 (jueces): las sesiones anteriores, con su cifra y si sube o baja. */}
      {ultima.anteriores?.length ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/55">Sesiones anteriores</p>
          <ul className="mt-1.5 space-y-1 text-[13px]">
            {ultima.anteriores.map((a, i) => {
              const siguiente = i === 0 ? ultima : ultima.anteriores[i - 1];
              const cambio = a.pct !== null && siguiente.pct !== null ? siguiente.pct - a.pct : null;

              return (
                <li key={a.fecha} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="capitalize text-white/75">{fechaLegible(a.fecha)}</span>
                  <span className="tabular-nums font-semibold text-white">{a.pct !== null ? `${a.pct} %` : `${a.correctas} de ${a.total}`}</span>
                  <span className="text-white/50">{a.total} acciones{a.provisional ? " · provisional" : ""}</span>
                  {cambio !== null && Math.abs(cambio) >= 5 ? (
                    <span className={`text-[12px] font-semibold ${cambio > 0 ? "text-emerald-300" : "text-amber-300"}`}>
                      {cambio > 0 ? `la siguiente subió ${cambio} puntos` : `la siguiente bajó ${Math.abs(cambio)} puntos`}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <p className="mt-3 text-[12px] text-white/55">El detalle por jugador, con sus clips, al entrar con la cuenta del staff.</p>
    </section>
  );
}

/** Lo que completa esta pantalla, a un toque y sin cuenta (16/11/2026, jueces). */
function Accesos({ fecha }: { fecha?: string }) {
  const q = fecha ? `?fecha=${fecha}` : "";
  const enlaces = [
    { href: `/jugadores-sesion${q}`, texto: "Equipos de la sesión", Icono: Users },
    { href: "/microcycles", texto: "Microciclo de la semana", Icono: CalendarDays },
  ];

  return (
    <nav aria-label="Lo que completa el análisis" className="flex flex-wrap gap-2">
      {enlaces.map(({ href, texto, Icono }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-[13px] font-semibold text-white/80 transition hover:border-[#C8A96B]/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]"
        >
          <Icono size={15} className="text-[#C8A96B]" aria-hidden />
          {texto}
          <ArrowRight size={13} className="text-white/45" aria-hidden />
        </Link>
      ))}
    </nav>
  );
}

export function AccesoEntreno({ ultima = null }: { ultima?: UltimaSesionPublica | null }) {
  const router = useRouter();
  const sesion = useQuinielaSesion();
  const yo = sesion.yo;
  const delCuerpoTecnico = Boolean(yo && PERSONA_POR_SLUG.has(yo.slug));

  /* Recién entrado: el servidor ya ve la cookie, así que se le vuelve a pedir la página. */
  useEffect(() => {
    if (delCuerpoTecnico) router.refresh();
  }, [delCuerpoTecnico, router]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 px-4 py-6 sm:px-6">
            {/* 16/11/2026 (jueces): un titular que dice qué da la pantalla; el nombre, en la miga. */}
            <AbpHeader
              area="RMCF Castilla · Entrenamiento · Análisis de entrenamiento"
              title="Qué cumplió cada jugador en la sesión"
              lead="Objetivos por jugador medidos en el vídeo del entrenamiento, con sus clips."
            />

            {/*
            | Dos columnas en escritorio (10/11/2026): lo que hay dentro a la
            | izquierda, la entrada a la derecha. 16/11/2026 (jueces): la muestra
            | es una tarea entera (gráfico y clip), así que la izquierda ya no se
            | queda corta; la entrada se queda a la vista al bajar.
            */}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
            <div className="min-w-0 space-y-5">
            {/* Lo primero, la última sesión de verdad, con el acceso al lado (16/11/2026). */}
            {ultima ? <UltimaSesion ultima={ultima} /> : null}

            {/*
            | 16/11/2026 (jueces, segunda vuelta): fuera las tres viñetas que
            | repetían el titular; en su sitio, lo que completa la pantalla a un
            | toque (los equipos de ese día y el microciclo).
            */}
            <Accesos fecha={ultima?.fecha} />

            {/*
            | Una muestra de lo que hay dentro (07/11/2026), sin datos de nadie:
            | una tarea, un objetivo y su base, como lo enseña la ficha. Está
            | escrita a mano y lo dice. 16/11/2026: plegada por defecto (los
            | jueces: el ejemplo no puede ser lo primero); abierta si no hay
            | ninguna sesión analizada que enseñar.
            */}
            <details open={!ultima} className="group rounded-2xl border border-white/10 bg-white/[0.02]">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[14px] font-semibold text-white/80 [&::-webkit-details-marker]:hidden">
                <ChevronDown size={16} className="shrink-0 text-[#C8A96B] transition group-open:rotate-180" aria-hidden />
                Cómo se lee una tarea (ejemplo)
              </summary>
              <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                <MuestraFicha />
              </div>
            </details>
            </div>

            {/* 11/11/2026: en el móvil la entrada va primero; la muestra, debajo. */}
            <div className="order-first min-w-0 space-y-4 lg:sticky lg:top-24 lg:order-none">

            {/*
            | Título corto: en el móvil «Entra para ver qué objetivo cumplió…» se
            | cortaba y repetía la entrada. 16/11/2026 (jueces): los campos, uno
            | debajo de otro y a todo el ancho (el correo se cortaba), y una frase
            | con quién puede registrarse y qué pasa después.
            */}
            <Acceso
              sinPista
              apilado
              yo={yo}
              cargando={sesion.cargando}
              manda={sesion.manda}
              titulo="Entra con tu cuenta del staff"
              botonEntrar="Entrar"
              subtitulo="La misma cuenta que la quiniela y las apuestas del staff"
              pie={<>Sólo el cuerpo técnico. Se abre el entrenamiento de hoy y no se vuelve a pedir la cuenta en un mes. ¿Sin contraseña? Pídela al administrador.</>}
            />

            {yo && !delCuerpoTecnico ? (
              <Notice tone="warn" title="Esta cuenta no es del cuerpo técnico">
                Entra con la cuenta de alguien del staff para ver el análisis.
              </Notice>
            ) : null}

            {delCuerpoTecnico ? (
              <p role="status" className="flex items-center gap-2 text-sm text-white/60">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C8A96B]" aria-hidden />
                Abriendo el análisis…
              </p>
            ) : null}

            {/* 11/11/2026: fuera el «Administrador: entra en Ajustes»; era ruido para el
                cuerpo técnico y el administrador llega a Ajustes desde el menú. */}
            </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
