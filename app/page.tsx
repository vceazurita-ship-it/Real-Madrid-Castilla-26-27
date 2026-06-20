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
  Zap,
} from "lucide-react"  

import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"

const metrics = [
  {
    href: "/team",
    icon: Zap,
    label: "EFICIENCIA COMPETITIVA",
    value: "87%",
    color: "blue",
    width: "w-[86%]",
  },
  {
    href: "/microcycles",
    icon: Brain,
    label: "CARGA DE ENTRENAMIENTO",
    value: "Alta",
    color: "violet",
    width: "w-[72%]",
  },
  {
    href: "/emotion",
    icon: HeartPulse,
    label: "ESTABILIDAD EMOCIONAL",
    value: "Estable",
    color: "emerald",
    width: "w-[78%]",
  },
  {
    href: "/collective",
    icon: TrendingUp,
    label: "EVOLUCIÓN COLECTIVA",
    value: "+12%",
    color: "amber",
    width: "w-[66%]",
  },
]

const modules = [
  // METODOLOGÍA
  {
    href: "/microcycles",
    section: "METODOLOGÍA",
    title: "Microciclos",
    desc: "Planificación, carga, control y evaluación del proceso semanal",
    icon: CalendarDays,
    glow: "cyan",
  },
  {
    href: "/match-plans",
    section: "METODOLOGÍA",
    title: "Planes de Partido",
    desc: "Diseño estratégico y operacional para la competición",
    icon: Rocket,
    glow: "blue",
  },

  // INDIVIDUAL
  {
    href: "/individual",
    section: "INDIVIDUAL",
    title: "Evaluación",
    desc: "Mentalidad, hábitos, condicional, interpretación y técnica",
    icon: Target,
    glow: "blue",
  },
  {
    href: "/emotion",
    section: "EMOCIONAL",
    title: "Rendimiento Emocional",
    desc: "Eficiencia individual y estabilidad emocional competitiva",
    icon: HeartPulse,
    glow: "violet",
  },
  {
    href: "/sinergy",
    section: "RELACIONAL",
    title: "Sinergias",
    desc: "Interacciones funcionales y conexiones entre jugadores",
    icon: Users,
    glow: "emerald",
  },
  {
    href: "/comparative_ind",
    section: "INDIVIDUAL",
    title: "Comparativo U-21",
    desc: "Análisis comparativo y proyección de talento emergente",
    icon: TrendingUp,
    glow: "amber",
  },

  // COLECTIVO
  {
    href: "/team",
    section: "COLECTIVO",
    title: "Rendimiento",
    desc: "Evaluación global del comportamiento competitivo del equipo",
    icon: Users,
    glow: "amber",
  },
  {
    href: "/collective",
    section: "COLECTIVO",
    title: "Competición",
    desc: "Transferencia al juego y evolución del rendimiento colectivo",
    icon: Zap,
    glow: "blue",
  },
  {
    href: "/setpieces",
    section: "ABP",
    title: "ABP Ofensivo",
    desc: "Análisis y optimización de acciones a balón parado ofensivas",
    icon: Rocket,
    glow: "cyan",
  },
  {
    href: "/setpieces_def",
    section: "ABP",
    title: "ABP Defensivo",
    desc: "Control y rendimiento en acciones a balón parado defensivas",
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

function bar(color: string) {
  const map = {
    blue: "bg-blue-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
  }

  return map[color as keyof typeof map]
}

export default function Home() {
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
              <div className="relative z-10 grid grid-cols-1 gap-10 xl:grid-cols-2">
                {/* LEFT */}
                <div>
                  <div className="inline-flex items-center gap-3 rounded-full border border-[#D8B45A]/40 bg-[#D8B45A]/10 px-5 py-2">
                    <span className="h-2 w-2 rounded-full bg-[#F7D98B]" />

                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#F7D98B]">
                      FASE COMPETITIVA ACTIVA
                    </span>
                  </div>

                  <h1 className="mt-6 text-[42px] leading-[0.95] tracking-[-0.04em] sm:text-[56px] xl:mt-8 xl:text-[84px] xl:leading-[0.88]">
                    Plataforma integral
                    <br />
                    {" "}
                    <span className="bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-white bg-clip-text text-transparent">
                      RMC
                    </span>{" "}
                    
                  </h1>

                  <div className="mt-6 flex gap-4 xl:mt-8 xl:gap-5">
                    <div className="h-20 w-[3px] rounded-full bg-blue-500" />

                    <p className="max-w-[620px] text-base leading-relaxed text-white/75 sm:text-lg xl:text-[24px]">
                      Análisis integral de la transferencia al juego conectando la metodología con el rendimiento individual, colectivo y relacional.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                    <Link
                      href="/individual"
                      className="rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-8 py-4 font-medium shadow-[0_0_40px_rgba(37,99,235,.35)] transition hover:scale-[1.02]"
                    >
                      <div className="flex items-center gap-2">
                        <Rocket className="h-5 w-5" />
                        Explorar ecosistema
                      </div>
                    </Link>

                    <Link
                      href="/team"
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 transition hover:bg-white/[0.06]"
                    >
                      <div className="flex items-center gap-2">
                        <PlayCircle className="h-5 w-5" />
                        Ver métricas
                      </div>
                    </Link>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="relative mt-4 xl:mt-0">
                  {/* radar */}
                  <Link
                    href="/comparative_ind"
                    className="relative z-20 mb-4 w-full max-w-[290px] xl:absolute xl:left-0 xl:top-0"
                  >
                    <Image
                      src="/radar-chart.png"
                      alt="Radar"
                      width={280}
                      height={280}
                      className="rounded-2xl"
                    />
                  </Link>

                  {/* efficiency */}
                  <Link
                    href="/emotion"
                    className="relative z-20 mb-4 w-full max-w-[250px] xl:absolute xl:right-0 xl:top-0"
                  >
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
                      EFICIENCIA
                    </p>

                    <p className="mt-3 text-5xl font-semibold">87%</p>

                    <p className="mt-3 text-sm text-emerald-400">
                      +4% vs semana anterior
                    </p>
                  </Link>

                  {/* field */}
                  <Link
                    href="/collective"
                    className="relative mt-4 xl:mt-12 block overflow-hidden rounded-[28px] xl:rounded-[34px] border border-white/10 bg-[#07111D]/40 transition hover:scale-[1.01]"
                  >
                    <Image
                      src="/hero-field.png"
                      alt="Campo táctico"
                      width={920}
                      height={620}
                      className="w-full rounded-[28px] object-cover brightness-[1.05]"
                      priority
                    />

                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,.4))]" />
                  </Link>
                </div>
              </div>

              {/* KPI */}
              <div className="relative z-10 mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((item) => {
  const Icon = item.icon

  return (
    <Link
      key={item.label}
      href={item.href}
      className={`relative z-20 block cursor-pointer rounded-[28px] border border-white/10 bg-[#07101B]/85 p-6 backdrop-blur-xl transition duration-300 hover:scale-[1.02] ${glow(
        item.color
      )}`}
    >
      <div className="flex gap-4">
        <div className="rounded-full border border-white/10 bg-white/[0.04] p-5">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <p className="text-xs tracking-[0.3em] text-gray-400">
            {item.label}
          </p>

          <h3 className="mt-3 text-4xl font-semibold">
            {item.value}
          </h3>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${bar(
            item.color
          )} ${item.width}`}
        />
      </div>
    </Link>
  )
})}
              </div>

              {/* MODULES */}
              <div className="mt-12 border-t border-white/10 pt-8">
                <p className="text-xs uppercase tracking-[0.35em] text-[#37A6FF]">
                  MÓDULOS
                </p>

<div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5 xl:gap-5">
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
transition duration-300 hover:scale-[1.02]
${glow(item.glow)}`}
>
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
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