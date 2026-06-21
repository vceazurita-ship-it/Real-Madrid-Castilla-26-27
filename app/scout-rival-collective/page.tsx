"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";

export default function ScoutRivalCollective() {
  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="flex-1">
        <Topbar />

        <div className="p-6 md:p-10">

          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Scout Rival
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Análisis Colectivo
            </h1>

            <p className="mt-3 text-white/60">
              Base de datos para la preparación estratégica del rival.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Sistema Base
              </h2>

              <p className="mt-4 text-white/60">
                1-4-3-3
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Sistema Alternativo
              </h2>

              <p className="mt-4 text-white/60">
                1-4-2-3-1
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Salida de Balón
              </h2>

              <p className="mt-4 text-white/60">
                Descripción táctica...
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Presión
              </h2>

              <p className="mt-4 text-white/60">
                Descripción táctica...
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Transición Ofensiva
              </h2>

              <p className="mt-4 text-white/60">
                Descripción táctica...
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Transición Defensiva
              </h2>

              <p className="mt-4 text-white/60">
                Descripción táctica...
              </p>
            </section>

            <section className="rounded-3xl border border-green-500/20 bg-green-500/5 p-6">
              <h2 className="text-xl font-semibold text-green-400">
                Fortalezas
              </h2>

              <ul className="mt-4 space-y-2 text-white/70">
                <li>• Fortaleza 1</li>
                <li>• Fortaleza 2</li>
                <li>• Fortaleza 3</li>
              </ul>
            </section>

            <section className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
              <h2 className="text-xl font-semibold text-red-400">
                Vulnerabilidades
              </h2>

              <ul className="mt-4 space-y-2 text-white/70">
                <li>• Vulnerabilidad 1</li>
                <li>• Vulnerabilidad 2</li>
                <li>• Vulnerabilidad 3</li>
              </ul>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}