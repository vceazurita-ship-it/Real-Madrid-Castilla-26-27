"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

export default function MatchPreparation() {
  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="flex-1">
        <Topbar />

        <div className="p-6 md:p-10">

          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Match Preparation
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Preparación de Partido
            </h1>

            <p className="mt-3 text-white/60">
              Centro operativo para la preparación semanal del encuentro.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Rival
              </h2>

              <p className="mt-4 text-white/60">
                Nombre del rival
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Estado del Equipo
              </h2>

              <p className="mt-4 text-white/60">
                Información interna de la semana
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Claves del Partido
              </h2>

              <ul className="mt-4 space-y-2 text-white/70">
                <li>• Clave 1</li>
                <li>• Clave 2</li>
                <li>• Clave 3</li>
              </ul>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Sistema Rival
              </h2>

              <p className="mt-4 text-white/60">
                1-4-3-3
              </p>
            </section>

            <section className="rounded-3xl border border-green-500/20 bg-green-500/5 p-6">
              <h2 className="text-xl font-semibold text-green-400">
                Fortalezas Rival
              </h2>

              <ul className="mt-4 space-y-2 text-white/70">
                <li>• Fortaleza 1</li>
                <li>• Fortaleza 2</li>
                <li>• Fortaleza 3</li>
              </ul>
            </section>

            <section className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
              <h2 className="text-xl font-semibold text-red-400">
                Vulnerabilidades Rival
              </h2>

              <ul className="mt-4 space-y-2 text-white/70">
                <li>• Vulnerabilidad 1</li>
                <li>• Vulnerabilidad 2</li>
                <li>• Vulnerabilidad 3</li>
              </ul>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Scout Individual
              </h2>

              <p className="mt-4 text-white/60">
                Acceso rápido a jugadores clave.
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Scout Colectivo
              </h2>

              <p className="mt-4 text-white/60">
                Acceso rápido al análisis colectivo.
              </p>
            </section>

            <section className="rounded-3xl border border-[#C8A96B]/20 bg-[#C8A96B]/5 p-6 md:col-span-2">
              <h2 className="text-xl font-semibold text-[#C8A96B]">
                Hudl
              </h2>

              <div className="mt-4 flex flex-wrap gap-4">

                <button className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5">
                  Abrir Playlist
                </button>

                <button className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5">
                  Abrir Partido Completo
                </button>

                <button className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/5">
                  Abrir Análisis
                </button>

              </div>
            </section>

            <section className="rounded-3xl border border-[#C8A96B]/20 bg-[#C8A96B]/5 p-6 md:col-span-2">
              <h2 className="text-xl font-semibold text-[#C8A96B]">
                Plan de Partido
              </h2>

              <p className="mt-4 text-white/70">
                Resumen ejecutivo para cuerpo técnico y jugadores.
              </p>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}