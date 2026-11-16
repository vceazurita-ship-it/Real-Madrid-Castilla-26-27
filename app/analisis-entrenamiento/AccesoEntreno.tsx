"use client";

/**
 * Lo que ve quien llega al análisis de entrenamiento sin sesión (19/10/2026):
 * el mismo panel de entrada que la quiniela y las apuestas (las cuentas del
 * cuerpo técnico). Al entrar se vuelve a pedir la página al servidor, que es
 * quien decide.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

import { AbpHeader, Notice } from "@/components/abp/ui";
import { Acceso } from "@/components/quiniela/Acceso";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

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
 * pantalla sin entrar. Las bases pasan de 15 acciones: con «9 de 14»
 * el juez de fútbol pedía leerlo como tendencia.
 */
function MuestraFicha() {
  const meta = 60;
  const filas = [
    { jugador: "Jugador A", correctas: 12, total: 18 },
    { jugador: "Jugador B", correctas: 8, total: 16 },
    { jugador: "Jugador C", correctas: 13, total: 17 },
  ].map((f) => ({ ...f, pct: Math.round((f.correctas / f.total) * 100) }));

  return (
    <figure className="@container rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5" aria-label="Ejemplo de la ficha de objetivos">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/55">Así se lee una tarea</span>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[12px] font-semibold text-white/60">Muestra del formato</span>
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
                    <span className="tabular-nums">
                      {f.correctas} de {f.total} ({f.pct} %)
                    </span>
                    <span className={`font-semibold ${cumple ? "text-emerald-300" : "text-amber-300"}`}>{cumple ? "· cumple" : "· no llega"}</span>
                  </p>
                  <div className="relative mt-1 flex h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <span style={{ width: `${(f.correctas / f.total) * 100}%`, background: BIEN }} />
                    <span style={{ width: `${((f.total - f.correctas) / f.total) * 100}%`, background: MEJORABLE }} />
                    <span className="absolute inset-y-0 w-0.5" style={{ left: `${meta}%`, background: TINTA }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] text-white/50">Acierto = correctas ÷ acciones revisadas. Con menos de 8 acciones no se da porcentaje: se lee como tendencia.</p>
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

export function AccesoEntreno() {
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
            <AbpHeader area="RMCF Castilla · Entrenamiento" title="Análisis de entrenamiento" lead="Mira qué objetivo cumplió cada jugador en la sesión." />

            {/*
            | Dos columnas en escritorio (10/11/2026): lo que hay dentro a la
            | izquierda, la entrada a la derecha. 16/11/2026 (jueces): la muestra
            | es una tarea entera (gráfico y clip), así que la izquierda ya no se
            | queda corta; la entrada se queda a la vista al bajar.
            */}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
            <div className="min-w-0 space-y-5">
            {/* Lo que hay dentro, antes de entrar (24/10/2026): quien llega desde el menú no sabía qué aporta la pantalla. */}
            <ul className="space-y-1.5 text-[15px] text-white/70">
              {[
                "Objetivos por jugador y por tarea, medidos en el vídeo del entrenamiento.",
                "Su evolución sesión a sesión, con lo que se pidió y lo que salió.",
                "Clips de lo correcto y de lo mejorable, y el mensaje para cada jugador.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8A96B]" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            {/*
            | Una muestra de lo que hay dentro (07/11/2026), sin datos de nadie:
            | una tarea, un objetivo y su base, como lo enseña la ficha. Está
            | escrita a mano y lo dice, para que no se lea como un dato.
            */}
            <MuestraFicha />
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
              botonEntrar="Ver el análisis"
              subtitulo="La misma cuenta que la quiniela y las apuestas del staff"
              pie={
                <>
                  Sólo el cuerpo técnico: en «Registrarme» eliges tu nombre de la lista del staff. Al entrar se abre el
                  entrenamiento de hoy (o el último con trabajo) y no se vuelve a pedir la cuenta en un mes en este
                  navegador. Si no recuerdas la contraseña,
                  pídela al administrador.
                </>
              }
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
