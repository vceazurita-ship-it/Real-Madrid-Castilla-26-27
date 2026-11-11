"use client";

/**
 * Lo que ve quien llega al análisis de entrenamiento sin sesión (19/10/2026):
 * el mismo panel de entrada que la quiniela y las apuestas (las cuentas del
 * cuerpo técnico). Al entrar se vuelve a pedir la página al servidor, que es
 * quien decide.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AbpHeader, Notice } from "@/components/abp/ui";
import { Acceso } from "@/components/quiniela/Acceso";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

/** La ficha de objetivos tal como se ve dentro, con un ejemplo inventado. */
function MuestraFicha() {
  const filas = [
    { jugador: "Jugador A", correctas: 9, total: 14, cumple: true },
    { jugador: "Jugador B", correctas: 5, total: 11, cumple: false },
  ];

  return (
    <figure className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-label="Ejemplo de la ficha de objetivos">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Así se lee una tarea</span>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">Muestra del formato</span>
      </figcaption>
      <p className="text-sm font-semibold text-white">
        <span className="text-[#C8A96B]">MD-3 · T2</span> Rondo 7v3
      </p>
      <p className="mt-1 text-[12px] text-white/65">Objetivo: perfilarse antes de recibir · meta 60 %, la que fija el cuerpo técnico para la tarea</p>
      <ul className="mt-3 space-y-1.5">
        {filas.map((f) => (
          <li key={f.jugador} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-white/75">
            <span className="font-semibold text-white/85">{f.jugador}</span>
            <span>
              {f.correctas} de {f.total} acciones correctas ({Math.round((f.correctas / f.total) * 100)} %)
            </span>
            <span className={`font-semibold ${f.cumple ? "text-emerald-300" : "text-amber-300"}`}>{f.cumple ? "· cumple" : "· no llega"}</span>
          </li>
        ))}
      </ul>
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

          <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 px-4 py-6 sm:px-6">
            <AbpHeader area="RMCF Castilla · Entrenamiento" title="Análisis de entrenamiento" lead="Mira qué objetivo cumplió cada jugador en la sesión." />

            {/* Dos columnas en escritorio (10/11/2026): lo que hay dentro a la izquierda, la entrada a la derecha. */}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <div className="min-w-0 space-y-5">
            {/* Lo que hay dentro, antes de entrar (24/10/2026): quien llega desde el menú no sabía qué aporta la pantalla. */}
            <ul className="space-y-1.5 text-sm text-white/70">
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
            <div className="order-first min-w-0 space-y-4 lg:order-none">

            {/* Título corto: en el móvil «Entra para ver qué objetivo cumplió…» se cortaba y repetía la entrada. */}
            <Acceso sinPista yo={yo} cargando={sesion.cargando} manda={sesion.manda} titulo="Entra con tu cuenta del staff" botonEntrar="Ver el análisis" subtitulo="La misma cuenta que la quiniela y las apuestas del staff" />

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
