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
  > <div className="grid md:grid-cols-6 gap-4 mt-6 mb-6">

<div className="rounded-2xl bg-[#111827] p-4">
<p className="text-xs text-white/50">Jornada</p>
<p>{rivalActivo?.JORNADA}</p>
</div>

<div className="rounded-2xl bg-[#111827] p-4">
<p className="text-xs text-white/50">Resultado</p>
<p>{rivalActivo?.RESULTADO}</p>
</div>

<div className="rounded-2xl bg-[#111827] p-4">
<p className="text-xs text-white/50">Estado</p>
<p>{rivalActivo?.ESTADO}</p>
</div>

<div className="rounded-2xl bg-[#111827] p-4">
<p className="text-xs text-white/50">Fecha</p>
<p>{rivalActivo?.FECHA}</p>
</div>

<div className="rounded-2xl bg-[#111827] p-4">
<p className="text-xs text-white/50">Local/Visitante</p>
<p>{rivalActivo?.LOCAL_VISITANTE}</p>
</div>

</div>

    {Array.isArray(rivales) &&
  rivales.map(r => (
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

  <section className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
    <h2 className="text-xl font-semibold text-cyan-400">
      Estructura Ofensiva
    </h2>

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ESTRUCTURA_OF}
    </p>
  </section>

  <section className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6">
    <h2 className="text-xl font-semibold text-blue-400">
      Estructura Defensiva
    </h2>

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ESTRUCTURA_DEF}
    </p>
  </section>

  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
    <h2 className="text-xl font-semibold">
      Ataque
    </h2>

    <p className="mt-4 text-white/60 whitespace-pre-wrap">
      {rivalActivo?.ATAQUE}
    </p>
  </section>

  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
    <h2 className="text-xl font-semibold">
      Defensa
    </h2>

    <p className="mt-4 text-white/60 whitespace-pre-wrap">
      {rivalActivo?.DEFENSA}
    </p>
  </section>

  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
    <h2 className="text-xl font-semibold">
      Transición Ofensiva
    </h2>

    <p className="mt-4 text-white/60 whitespace-pre-wrap">
      {rivalActivo?.TRANSICION_OF}
    </p>
  </section>

  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
    <h2 className="text-xl font-semibold">
      Transición Defensiva
    </h2>

    <p className="mt-4 text-white/60 whitespace-pre-wrap">
      {rivalActivo?.TRANSICION_DEF}
    </p>
  </section>

  <section className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
    <h2 className="text-xl font-semibold text-cyan-400">
      Estructura Transición Ofensiva
    </h2>

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ESTRUCTURA_TR_OF}
    </p>
  </section>

  <section className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6">
    <h2 className="text-xl font-semibold text-blue-400">
      Estructura Transición Defensiva
    </h2>

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ESTRUCTURA_TR_DEF}
    </p>
  </section>

  <section className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6">
    <h2 className="text-xl font-semibold text-violet-400">
      ABP Ofensivo
    </h2>

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ABP_OF}
    </p>
  </section>

  <section className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6">
    <h2 className="text-xl font-semibold text-violet-400">
      ABP Defensivo
    </h2>

    <p className="mt-4 text-white/70 whitespace-pre-wrap">
      {rivalActivo?.ABP_DEF}
    </p>
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

<section className="mt-6 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
  <h2 className="text-xl font-semibold text-amber-400">
    Jugadores Clave
  </h2>

  <p className="mt-4 text-white/70 whitespace-pre-wrap">
    {rivalActivo?.JUGADORES_CLAVE}
  </p>
</section>

<section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
  <h2 className="text-xl font-semibold">
    Observaciones
  </h2>

  <p className="mt-4 text-white/70 whitespace-pre-wrap">
    {rivalActivo?.OBSERVACIONES}
  </p>
</section>

<div className="mt-6 flex flex-wrap gap-4">

  {rivalActivo?.VIDEO && (
    <a
      href={rivalActivo.VIDEO}
      target="_blank"
      rel="noreferrer"
      className="rounded-xl bg-blue-600 px-6 py-3 font-medium hover:bg-blue-700"
    >
      Ver Vídeo
    </a>
  )}

  {rivalActivo?.DOC && (
    <a
      href={rivalActivo.DOC}
      target="_blank"
      rel="noreferrer"
      className="rounded-xl bg-emerald-600 px-6 py-3 font-medium hover:bg-emerald-700"
    >
      Abrir Informe
    </a>
  )}

</div>
          <section className="mt-6 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">

<h2 className="text-xl font-semibold text-amber-400">
Jugadores Clave
</h2>

<p className="mt-4 text-white/70 whitespace-pre-wrap">
{rivalActivo?.JUGADORES_CLAVE}
</p>

</section>
<section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">

<h2 className="text-xl font-semibold">
Observaciones
</h2>

<p className="mt-4 text-white/70 whitespace-pre-wrap">
{rivalActivo?.OBSERVACIONES}
</p>

</section>
<div className="mt-6 flex gap-4">

<a
href={rivalActivo?.VIDEO}
target="_blank"
className="px-6 py-3 rounded-xl bg-blue-600"
>
Ver vídeo
</a>

<a
href={rivalActivo?.DOC}
target="_blank"
className="px-6 py-3 rounded-xl bg-emerald-600"
>
Abrir informe
</a>

</div>
        </div>
      </main>
    </div>
  );
}