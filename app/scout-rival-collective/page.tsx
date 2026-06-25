"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useState } from "react"

export default function ScoutRivalCollective() {
  const [rivales, setRivales] = useState<any[]>([])
const [rivalActivo, setRivalActivo] = useState<any>(null)
useEffect(() => {

  fetch(
    "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=rivales"
  )
    .then(r => r.json())
    .then(data => {

      setRivales(data)

      if (data.length > 0) {
        setRivalActivo(data[0])
      }

    })

}, [])
  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="flex-1">
        <Topbar />

        <div className="p-6 md:p-10">

          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              RMCF CASTILLA SCOUT RIVAL
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Análisis Colectivo
            </h1>

            <p className="mt-3 text-white/60">
              Base de datos para la preparación estratégica del rival.
            </p>
          </div>
<div className="mt-6">

  <select
    value={rivalActivo?.ID || ""}
    onChange={(e) => {

      const rival =
        rivales.find(
          r =>
            String(r.ID) ===
            e.target.value
        )

      setRivalActivo(rival)

    }}
    className="
      w-full
      rounded-2xl
      border
      border-white/10
      bg-[#111827]
      p-4
    "
  >

    {rivales.map(r => (
      <option
        key={r.ID}
        value={r.ID}
      >
        {r.EQUIPO}
      </option>
    ))}

  </select>

</div>
          <div className="grid gap-6 md:grid-cols-2">

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Estructura Ofensiva
              </h2>

              <p className="mt-4 text-white/60">
{rivalActivo?.ESTRUCTURA_OF}              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Estructura Defensiva
              </h2>

              <p className="mt-4 text-white/60">
{rivalActivo?.ESTRUCTURA_DEF}              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Ataque
              </h2>

              <p className="mt-4 text-white/60">
{rivalActivo?.ATAQUE}              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Defensa
              </h2>

              <p className="mt-4 text-white/60">
{rivalActivo?.DEFENSA}              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Transición Ofensiva
              </h2>

              <p className="mt-4 text-white/60">
{rivalActivo?.TRANSICION_OF}              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">
                Transición Defensiva
              </h2>

              <p className="mt-4 text-white/60">
{rivalActivo?.TRANSICION_DEF}              </p>
            </section>

            <section className="rounded-3xl border border-green-500/20 bg-green-500/5 p-6">
              <h2 className="text-xl font-semibold text-green-400">
                Fortalezas
              </h2>

              <ul className="mt-4 space-y-2 text-white/70">
                {rivalActivo?.FORTALEZAS
  ?.split(";")
  ?.map((item: string) => (
    <li key={item}>
      • {item}
    </li>
))}
              </ul>
            </section>

            <section className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
              <h2 className="text-xl font-semibold text-red-400">
                Debilidades
              </h2>

              <ul className="mt-4 space-y-2 text-white/70">
                {rivalActivo?.DEBILIDADES
  ?.split(";")
  ?.map((item: string) => (
    <li key={item}>
      • {item}
    </li>
))}
              </ul>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}