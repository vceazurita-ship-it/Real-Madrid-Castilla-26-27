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
            <AbpHeader area="RMCF Castilla · Entrenamiento" title="Análisis de entrenamiento" lead="Objetivos por jugador medidos en el vídeo de la sesión, con su evolución y sus clips. Es para el cuerpo técnico: entra con tu cuenta." />

            <Acceso sinPista yo={yo} cargando={sesion.cargando} manda={sesion.manda} titulo="Entra con tu cuenta del cuerpo técnico" subtitulo="La misma cuenta que la quiniela y las apuestas del staff" />

            {yo && !delCuerpoTecnico ? (
              <Notice tone="warn" title="Esta cuenta no es del cuerpo técnico">
                Entra con la cuenta de alguien del staff para ver el análisis.
              </Notice>
            ) : null}

            {delCuerpoTecnico ? <p className="text-sm text-white/60">Abriendo el análisis…</p> : null}

            <p className="text-xs text-white/45">
              ¿Eres el administrador?{" "}
              <Link href="/ajustes" className="text-[#C8A96B] underline-offset-2 hover:underline">
                Entra en Ajustes con tu usuario
              </Link>{" "}
              y vuelve aquí.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
