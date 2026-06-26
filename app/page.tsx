"use client"

import Link from "next/link"
import Image from "next/image"
import {
  Brain,
  CalendarDays,
  ChevronRight,
  HeartPulse,
  PlayCircle,
  Rocket,
  Target,
  TrendingUp,
  Users,
  Activity,
  BarChart3, 
  Zap,
} from "lucide-react"  

import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { useEffect, useState } from "react"
import Papa from "papaparse"


export default function Home() {

  type Principio = {
  FASE: string
  BLOQUE: string
  APARTADO: string
}
const modules = [
  {
    href: "/game-model",
    section: "IDENTIDAD",
    title: "Identidad de Juego",
    desc: "Principios ofensivos y defensivos que definen el comportamiento colectivo",
    icon: Brain,
    glow: "cyan",
  },

  {
    href: "/team-values",
    section: "IDENTIDAD",
    title: "Dinámicas y Valores",
    desc: "Normas culturales, comportamientos y principios del entorno",
    icon: Users,
    glow: "amber",
  },

  {
    href: "/match-preparation",
    section: "COMPETICIÓN",
    title: "Preparación Partido",
    desc: "Planificación estratégica y operativa para la competición",
    icon: Rocket,
    glow: "blue",
  },

  {
    href: "/microcycles",
    section: "METODOLOGÍA",
    title: "Microciclos",
    desc: "Diseño y control del proceso semanal",
    icon: CalendarDays,
    glow: "cyan",
  },

  {
    href: "/match-plans",
    section: "METODOLOGÍA",
    title: "Planes de Partido",
    desc: "Estructura táctica y operacional",
    icon: PlayCircle,
    glow: "violet",
  },

  {
    href: "/individual",
    section: "INDIVIDUAL",
    title: "Plantilla",
    desc: "Evaluación integral del jugador",
    icon: Target,
    glow: "blue",
  },

  {
    href: "/comparative_ind",
    section: "INDIVIDUAL",
    title: "Comparativo U-21",
    desc: "Proyección y detección de talento",
    icon: TrendingUp,
    glow: "amber",
  },

  {
    href: "/emotion",
    section: "RELACIONAL",
    title: "Emocional",
    desc: "Estabilidad y eficiencia emocional competitiva",
    icon: HeartPulse,
    glow: "violet",
  },

  {
    href: "/sinergy",
    section: "RELACIONAL",
    title: "Sinergias",
    desc: "Conexiones funcionales entre jugadores",
    icon: Users,
    glow: "emerald",
  },

  {
    href: "/team",
    section: "COLECTIVO",
    title: "Rendimiento",
    desc: "Indicadores globales de rendimiento",
    icon: BarChart3,
    glow: "amber",
  },

  {
    href: "/collective",
    section: "COLECTIVO",
    title: "Competición",
    desc: "Transferencia al juego y evolución colectiva",
    icon: Zap,
    glow: "blue",
  },

  {
    href: "/setpieces",
    section: "ABP",
    title: "ABP Ofensivo",
    desc: "Optimización ofensiva a balón parado",
    icon: Rocket,
    glow: "cyan",
  },

  {
    href: "/setpieces_def",
    section: "ABP",
    title: "ABP Defensivo",
    desc: "Control defensivo a balón parado",
    icon: Brain,
    glow: "violet",
  },
]

function glow(color: string) {
  const map = {
    blue: "shadow-[0_0_50px_rgba(59,130,246,.16)]",
    violet: "shadow-[0_0_50px_rgba(168,85,247,.16)]",
    emerald: "shadow-[0_0_50px_rgba(16,185,129,.14)]",
    amber: "shadow-[0_0_50px_rgba(245,158,11,.14)]",
    cyan: "shadow-[0_0_50px_rgba(6,182,212,.14)]",
  }

  return map[color as keyof typeof map]
}
  const [ataqueApartados, setAtaqueApartados] =
  useState(0)
  const [promedioSeguimientos, setPromedioSeguimientos] =
  useState(0)
  
  const [seguimientos, setSeguimientos] =
  useState(0)
const [totalJugadores, setTotalJugadores] =
  useState(0)
const [jugadoresSeguimiento, setJugadoresSeguimiento] =
  useState(0)
  const [principiosCultura, setPrincipiosCultura] =
  useState(0)
const [cobertura, setCobertura] =
  useState(0)
const [ultimos30Dias, setUltimos30Dias] =
  useState(0)
const [defensaApartados, setDefensaApartados] =
  useState(0)
  useEffect(() => {
  if (totalJugadores > 0) {
  setCobertura(
    Math.round(
      (jugadoresSeguimiento /
        totalJugadores) *
        100
    )
  )
}{
    setCobertura(
      Math.round(
        (jugadoresSeguimiento /
          totalJugadores) *
          100
      )
    )
  }
}, [
  totalJugadores,
  jugadoresSeguimiento,
])
  useEffect(() => {
  fetch(
    "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=jugadores"
  )
    .then((r) => r.json())
    .then((rows) => {
  setTotalJugadores(
    Array.isArray(rows)
      ? rows.length
      : 0
  )
    })
}, [])
useEffect(() => {
  fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1367356753&single=true&output=csv"
  )
    .then((r) => r.text())
    .then((csv) => {
      const parsed =
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
        })

      setPrincipiosCultura(
        parsed.data.length
      )
    })
}, [])
  useEffect(() => {
  fetch(
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1322156567&single=true&output=csv"
  )
    .then((r) => r.text())
    .then((csv) => {
      const parsed =
        Papa.parse<Principio>(csv, {
          header: true,
          skipEmptyLines: true,
        })

      const rows = parsed.data

      const ataque = [
        ...new Set(
          rows
            .filter(
              (r) => r.FASE === "ATAQUE"
            )
            .map(
              (r) => r.APARTADO
            )
        ),
      ]

      const defensa = [
        ...new Set(
          rows
            .filter(
              (r) => r.FASE === "DEFENSA"
            )
            .map(
              (r) => r.APARTADO
            )
        ),
      ]

      setAtaqueApartados(
        ataque.length
      )

      setDefensaApartados(
        defensa.length
      )
      
    })
}, [])
 useEffect(() => {
  fetch(
    "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=seguimiento"
  )
    .then((r) => r.json())
    .then((rows) => {

      setSeguimientos(rows.length)

      const jugadores = new Set(
        rows.map(
          (r: any) => r.ID_JUGADOR
        )
      )

      setJugadoresSeguimiento(
        jugadores.size
      )
      const promedio =
  jugadores.size > 0
    ? rows.length / jugadores.size
    : 0

setPromedioSeguimientos(
  Number(promedio.toFixed(1))
)
      const limite =
        new Date(
          Date.now() -
          30 * 24 * 60 * 60 * 1000
        )

      const recientes = rows.filter((r: any) => {
  const fecha = new Date(r.FECHA)
  return !isNaN(fecha.getTime()) &&
         fecha >= limite
})

      setUltimos30Dias(
        recientes.length
      )
    })
}, []) 
  return (
    
    <main className="min-h-screen bg-[#02060D] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          <Topbar />

          <section className="p-4 sm:p-6 xl:p-10">
            <div className="relative overflow-hidden rounded-[28px] xl:rounded-[40px] border border-[#173A61]/60 bg-[#030B15] p-5 sm:p-8 xl:p-10 shadow-[0_0_80px_rgba(0,80,255,.08)]">
              {/* fondo */}
             <Image
  src="/stadium-bg.jpg"
  alt=""
  fill
  priority
  className="pointer-events-none object-cover opacity-[0.12]"
/>

              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(59,130,246,.18),transparent_30%)]" />

<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(37,99,235,.18),transparent_30%)]" />

<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_72%,rgba(245,158,11,.10),transparent_28%)]" />
              <div className="relative z-10 grid grid-cols-1 gap-10 xl:grid-cols-[1fr_1fr]">
                {/* LEFT */}
                <div>
                  <div className="inline-flex items-center gap-3 rounded-full border border-[#D8B45A]/40 bg-[#D8B45A]/10 px-5 py-2">
                    <span className="h-2 w-2 rounded-full bg-[#F7D98B]" />

                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#F7D98B]">
                      FASE COMPETITIVA ACTIVA
                    </span>
                  </div>

                  <h1 className="mt-6 text-[42px] max-w-[760px] leading-[0.95] tracking-[-0.04em] sm:text-[56px] xl:mt-8 xl:text-[72px] xl:leading-[0.88]">
  Plataforma Integral
  <br />
  <span className="bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-white bg-clip-text text-transparent">
    RMCF Castilla
  </span>
</h1>


                  <div className="mt-6 flex gap-4 xl:mt-8 xl:gap-5">
                    <div className="h-20 w-[3px] rounded-full bg-blue-500" />

                    <p className="max-w-[620px] text-base leading-relaxed text-white/75 sm:text-lg xl:text-[20px]">
                      Ecosistema integral para la gestión de la identidad,
la competición, el desarrollo individual,
el rendimiento colectivo y el análisis estratégico del rival.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                    <Link
                      href="/game-model"
                      className="rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-8 py-4 font-medium shadow-[0_0_40px_rgba(37,99,235,.35)] transition hover:scale-[1.02]"
                    >
                      <div className="flex items-center gap-2">
                        <Rocket className="h-5 w-5" />
                        Identidad de Juego
                      </div>
                    </Link>

                    <Link
                      href="/match-preparation"
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 transition hover:bg-white/[0.06]"
                    >
                      <div className="flex items-center gap-2">
                        <PlayCircle className="h-5 w-5" />
                        Preparación Partido
                      </div>
                    </Link>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="relative mt-4 xl:mt-0">
                  <div className="grid md:grid-cols-3 gap-4">
  <Link
    href="/game-model"
    className="
rounded-[24px]
border
border-cyan-500/20
bg-cyan-500/5
p-6
transition
hover:scale-[1.02]
"
  >
    <p className="text-xs tracking-[0.3em] text-cyan-400">
      IDENTIDAD DE JUEGO
    </p>

    <h3 className="mt-2 text-4xl font-bold">
  ATAQUE
</h3>

<div className="mt-4 h-px bg-white/10" />

<p className="mt-4 text-5xl font-bold text-cyan-400">
  {ataqueApartados}
</p>

<p className="mt-2 text-white/60">
  Apartados ofensivos
</p>
    
  </Link>

  <Link
    href="/game-model"
    className="
rounded-[24px]
border
border-blue-500/20
bg-blue-500/5
p-6
transition
hover:scale-[1.02]
"
  >
    <p className="text-xs tracking-[0.3em] text-blue-400">
      IDENTIDAD DE JUEGO
    </p>

    <h3 className="mt-2 text-4xl font-bold">
  DEFENSA
</h3>

<div className="mt-4 h-px bg-white/10" />

<p className="mt-4 text-5xl font-bold text-blue-400">
  {defensaApartados}
</p>

<p className="mt-2 text-white/60">
  Apartados defensivos
</p>
  </Link>

  <Link
  href="/team-values"
  className="
rounded-[24px]
border
border-emerald-500/20
bg-emerald-500/5
p-6
transition
hover:scale-[1.02]
"
>
  <p className="text-xs tracking-[0.3em] text-emerald-400">
    DINÁMICAS Y VALORES
  </p>

  <h3 className="mt-2 text-4xl font-bold">
    CULTURA
  </h3>

  <div className="mt-4 h-px bg-white/10" />

  <p className="mt-4 text-5xl font-bold text-emerald-400">
    {principiosCultura}
  </p>

  <p className="mt-2 text-white/60">
    Elementos culturales
  </p>
</Link>
</div>

                  {/* field */}
                  <Link
                    href="/collective"
                    className="relative mt-4 xl:mt-12 block overflow-hidden rounded-[28px] xl:rounded-[34px] border border-white/10 bg-[#07111D]/40 transition hover:scale-[1.01]"
                  >
                    
               <Image
  src="/hero-field.webp"
  alt="Campo táctico"
  fill
  priority
  className="
absolute
inset-0
object-cover
animate-hero
scale-105
"
/><div
className="
absolute
inset-0
opacity-[0.07]
bg-[url('/tactical-grid.svg')]
bg-cover
pointer-events-none
"
/>  
<div className="light-sweep" />
<div
className="
absolute
inset-0
bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,.55))]
"
/>
<div
className="
absolute
left-1/2
top-1/2
h-[500px]
w-[500px]
-translate-x-1/2
-translate-y-1/2
rounded-full
bg-cyan-500/10
blur-[170px]
"
/>
 <div className="absolute top-6 left-6 z-20">

  <div className="
  rounded-full
  border
  border-cyan-500/30
  bg-[#02060D]/65
backdrop-blur-xl
border
border-white/10
  px-4
  py-2
  ">

    <p className="text-xs tracking-[0.3em] text-cyan-400">
      VISIÓN GLOBAL
    </p>

  </div>

</div> 

                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,.4))]" />
                  <div className="
absolute
bottom-6
left-6
right-6
grid
grid-cols-1 md:grid-cols-4
gap-4
"><div className="
rounded-xl
bg-black/50
backdrop-blur
p-4
">
  <p className="text-xs text-white/60">
    Ataque
  </p>

  <p className="text-3xl font-bold text-cyan-400">
    {ataqueApartados}
  </p>
</div><div className="
rounded-xl
bg-black/50
backdrop-blur
p-4
">
  <p className="text-xs text-white/60">
    Defensa
  </p>

  <p className="text-3xl font-bold text-blue-400">
    {defensaApartados}
  </p>
</div><div className="
rounded-xl
bg-[#02060D]/65
backdrop-blur-xl
border
border-white/10
p-4
">
  <p className="text-xs text-white/60">
    Cultura
  </p>

  <p className="text-3xl font-bold text-emerald-400">
    {principiosCultura}
  </p>
</div></div></Link>
                </div>
              </div>

              
  <div className="mt-12">
  <p className="text-xs uppercase tracking-[0.35em] text-[#37A6FF]">
    DESARROLLO INDIVIDUAL
  </p>

  <div className="mt-6 grid gap-4 md:grid-cols-3">

    <div className="rounded-[24px] min-h-[180px] border border-white/10 bg-[#06111D] p-6">
    <div className="flex justify-end">
  <Activity className="h-8 w-8 text-[#D8B45A]" />
</div>
      <p className="text-xs uppercase tracking-[0.3em] text-[#D8B45A]">
        Seguimientos
      </p>

      <h3 className="mt-3 text-5xl font-semibold">
        {seguimientos}
      </h3>

      <p className="mt-3 text-white/60">
        Sesiones registradas
      </p>
    </div>

    <div className="rounded-[24px] min-h-[180px] border border-white/10 bg-[#06111D] p-6">
    <div className="flex justify-end">
  <Users className="h-8 w-8 text-[#D8B45A]" />
</div>
      <p className="text-xs uppercase tracking-[0.3em] text-[#D8B45A]">
        Jugadores
      </p>

      <h3 className="mt-3 text-5xl font-semibold">
  {totalJugadores}
</h3>

<p className="mt-3 text-white/60">
  Jugadores en plantilla
</p>
    </div>

    <div className="rounded-[24px] min-h-[180px] border border-white/10 bg-[#06111D] p-6">
    <div className="flex justify-end">
  <BarChart3 className="h-8 w-8 text-[#D8B45A]" />
</div>
      <p className="text-xs uppercase tracking-[0.3em] text-[#D8B45A]">
  Promedio
</p>

<h3 className="mt-3 text-5xl font-semibold">
  {promedioSeguimientos}
</h3>

<p className="mt-3 text-white/60">
  Seguimientos por jugador
</p>
    </div>

  </div>
</div>

              {/* MODULES */}
              <div className="mt-12 border-t border-white/10 pt-8">
                <p className="text-xs uppercase tracking-[0.35em] text-[#37A6FF]">
                  ÁREAS ESTRATÉGICAS
                </p>

<div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
                    {modules.map((item) => {
                    const Icon = item.icon

                    return (
                     <Link  
  key={item.title}
  href={item.href}
  className={`relative z-20 block cursor-pointer group rounded-[28px]
border border-white/10
bg-gradient-to-br from-[#06111D] to-[#030914]
p-5
transition-all
duration-500
hover:scale-[1.02]
hover:-translate-y-1
hover:border-cyan-400/40
${glow(item.glow)}`}
><div
  className="
absolute
inset-0
opacity-0
group-hover:opacity-100
transition
duration-300
bg-gradient-to-r
from-blue-500/10
to-transparent
"
/>
                        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex items-center gap-5">
                            <div className="rounded-full border border-white/10 bg-white/[0.04] p-4">
  <Icon className="h-5 w-5" />
</div>

                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-[#D8B45A]">
                                {item.section}
                              </p>

                              <h3 className="mt-2 text-xl font-semibold">
  {item.title}
</h3>

                              <p className="mt-2 text-sm text-white/60">
  {item.desc}
</p>
                            </div>
                          </div>

                          <div className="rounded-full border border-white/10 bg-white/[0.04] p-5 transition group-hover:bg-blue-500/15">
                            <ChevronRight className="h-6 w-6" />
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}    