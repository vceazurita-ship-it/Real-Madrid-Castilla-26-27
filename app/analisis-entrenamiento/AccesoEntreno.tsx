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

import { AbpHeader, Notice } from "@/components/abp/ui";
import { Acceso } from "@/components/quiniela/Acceso";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useQuinielaSesion } from "@/hooks/useQuinielaSesion";
import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

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

          <div className="mx-auto w-full min-w-0 max-w-2xl space-y-5 px-4 py-6 sm:px-6">
            <AbpHeader area="RMCF Castilla · Entrenamiento" title="Análisis de entrenamiento" lead="Mira qué objetivo cumplió cada jugador en la sesión." />

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
            <p className="text-xs text-white/50">Es para el cuerpo técnico: entra con tu cuenta.</p>

            <Acceso sinPista yo={yo} cargando={sesion.cargando} manda={sesion.manda} titulo="Entra con tu cuenta del cuerpo técnico" subtitulo="La misma cuenta que la quiniela y las apuestas del staff" />

            {yo && !delCuerpoTecnico ? (
              <Notice tone="warn" title="Esta cuenta no es del cuerpo técnico">
                Entra con la cuenta de alguien del staff para ver el análisis.
              </Notice>
            ) : null}

            {delCuerpoTecnico ? <p className="text-sm text-white/60">Abriendo el análisis…</p> : null}

            {/* Un botón secundario, no un enlace en letra pequeña (24/10/2026): pasaba desapercibido. */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="min-w-0 flex-1 text-sm text-white/70">¿Eres el administrador? Entra en Ajustes con tu usuario y vuelve aquí.</p>
              <Link
                href="/ajustes"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#C8A96B]/50 px-3 py-1.5 text-xs font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]"
              >
                Ir a Ajustes
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
