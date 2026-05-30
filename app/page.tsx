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
    icon: Zap,
    label: "EFICIENCIA COMPETITIVA",
    value: "87%",
    color: "blue",
  },
  {
    icon: Brain,
    label: "CARGA DE ENTRENAMIENTO",
    value: "Alta",
    color: "violet",
  },
  {
    icon: HeartPulse,
    label: "ESTABILIDAD EMOCIONAL",
    value: "Estable",
    color: "emerald",
  },
  {
    icon: TrendingUp,
    label: "EVOLUCIÓN COLECTIVA",
    value: "+12%",
    color: "amber",
  },
]

const modules = [
  {
    href: "/individual",
    section: "INDIVIDUAL",
    title: "Evaluación específica",
    desc: "Análisis técnico, físico y cognitivo",
    icon: Target,
    glow: "blue",
  },
  {
    href: "/emotion",
    section: "EMOCIONAL",
    title: "Rendimiento emocional",
    desc: "Bienestar, estrés y confianza",
    icon: Brain,
    glow: "violet",
  },
  {
    href: "/team",
    section: "COLECTIVO",
    title: "Rendimiento del equipo",
    desc: "Dinámicas, cohesión y rendimiento colectivo",
    icon: Users,
    glow: "amber",
  },
  {
    href: "/microcycles",
    section: "METODOLOGÍA",
    title: "Microciclos",
    desc: "Planificación, carga y recuperación",
    icon: CalendarDays,
    glow: "cyan",
  },
]

function glow(color: string) {
  const map = {
    blue: "shadow-[0_0_40px_rgba(59,130,246,.22)]",
    violet: "shadow-[0_0_40px_rgba(139,92,246,.22)]",
    emerald: "shadow-[0_0_40px_rgba(16,185,129,.18)]",
    amber: "shadow-[0_0_40px_rgba(245,158,11,.18)]",
    cyan: "shadow-[0_0_40px_rgba(6,182,212,.18)]",
  }

  return map[color as keyof typeof map]
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#03070F] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          <Topbar />

          <section className="p-8 xl:p-10">
            <div className="relative overflow-hidden rounded-[38px] border border-[#17304F] bg-[#040B15] p-10">

              {/* glows */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(37,99,235,.16),transparent_30%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(59,130,246,.12),transparent_25%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(245,158,11,.08),transparent_25%)]" />

              <div className="relative z-10 grid grid-cols-2 gap-10">

                {/* LEFT */}
                <div>
                  <div className="inline-flex items-center gap-3 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-5 py-2">
                    <span className="h-2 w-2 rounded-full bg-[#F5D58C]" />

                    <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[#F4D58E]">
                      FASE COMPETITIVA ACTIVA
                    </span>
                  </div>

                  <h1 className="mt-8 text-[72px] font-semibold leading-[0.9] tracking-tight">
                    Plataforma integral
                    <br />
                    de{" "}
                    <span className="bg-gradient-to-r from-[#1D4ED8] to-[#60A5FA] bg-clip-text text-transparent">
                      inteligencia
                    </span>{" "}
                    futbolística
                  </h1>

                  <div className="mt-8 flex gap-5">
                    <div className="h-16 w-[3px] rounded-full bg-blue-500" />

                    <p className="max-w-2xl text-[20px] leading-relaxed text-gray-300">
                      Inteligencia aplicada al alto rendimiento para tomar
                      mejores decisiones, anticipar escenarios y optimizar cada
                      fase competitiva.
                    </p>
                  </div>

                  <div className="mt-10 flex gap-4">
                    <button className="rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-8 py-4 font-medium shadow-[0_0_40px_rgba(37,99,235,.35)]">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-5 w-5" />
                        Explorar ecosistema
                      </div>
                    </button>

                    <button className="rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-4">
                      <div className="flex items-center gap-2">
                        <PlayCircle className="h-5 w-5" />
                        Ver métricas
                      </div>
                    </button>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="relative">

                  {/* radar */}
                  <div className="absolute left-0 top-0 z-20 w-[260px] rounded-3xl border border-white/10 bg-[#07111D]/80 p-4 backdrop-blur-xl">
                    <Image
                      src="/radar-chart.png"
                      alt="Radar"
                      width={260}
                      height={260}
                      className="rounded-2xl"
                    />
                  </div>

                  {/* efficiency card */}
                  <div className="absolute right-0 top-0 z-20 w-[250px] rounded-3xl border border-blue-500/20 bg-[#08111D]/90 p-6">
                    <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
                      EFICIENCIA
                    </p>

                    <p className="mt-3 text-5xl font-semibold">87%</p>

                    <p className="mt-3 text-sm text-blue-400">
                      +4% vs semana anterior
                    </p>
                  </div>

                  {/* field */}
                  <div className="mt-20 rounded-[34px] border border-white/10 bg-[#07111D]/70 p-4">
                    <Image
                      src="/hero-field.png"
                      alt="Campo táctico"
                      width={900}
                      height={620}
                      className="rounded-[28px] object-cover"
                      priority
                    />
                  </div>
                </div>
              </div>

              {/* KPI */}
              <div className="relative z-10 mt-10 grid grid-cols-4 gap-5">
                {metrics.map((item) => {
                  const Icon = item.icon

                  return (
                    <div
                      key={item.label}
                      className={`rounded-[28px] border border-white/10 bg-[#08111C]/80 p-6 ${glow(
                        item.color
                      )}`}
                    >
                      <div className="flex gap-4">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-xs tracking-[0.25em] text-gray-400">
                            {item.label}
                          </p>

                          <h3 className="mt-3 text-4xl font-semibold">
                            {item.value}
                          </h3>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* modules */}
              <div className="mt-12 border-t border-white/10 pt-8">
                <p className="text-xs uppercase tracking-[0.35em] text-[#37A6FF]">
                  MÓDULOS
                </p>

                <div className="mt-6 grid grid-cols-2 gap-6">
                  {modules.map((item) => {
                    const Icon = item.icon

                    return (
                      <Link
                        key={item.title}
                        href={item.href}
                        className={`group rounded-[30px] border border-white/10 bg-gradient-to-br from-[#08111C] to-[#040A13] p-7 ${glow(
                          item.glow
                        )}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-5">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <Icon className="h-6 w-6" />
                            </div>

                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
                                {item.section}
                              </p>

                              <h3 className="mt-2 text-3xl font-semibold">
                                {item.title}
                              </h3>

                              <p className="mt-2 text-gray-400">
                                {item.desc}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-full border border-white/10 bg-white/[0.03] p-4">
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