"use client"

import Link from "next/link"
import Image from "next/image"
import {
  Activity,
  Brain,
  CalendarDays,
  ChevronRight,
  HeartPulse,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Zap,
  PlayCircle,
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
    blue: "shadow-[0_0_30px_rgba(59,130,246,.25)]",
    violet: "shadow-[0_0_30px_rgba(139,92,246,.25)]",
    emerald: "shadow-[0_0_30px_rgba(16,185,129,.22)]",
    amber: "shadow-[0_0_30px_rgba(245,158,11,.22)]",
    cyan: "shadow-[0_0_30px_rgba(6,182,212,.22)]",
  }

  return map[color as keyof typeof map]
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050A12] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          <Topbar />

          <section className="p-8 xl:p-10">
            {/* HERO */}
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-[#08101D] via-[#08131F] to-[#050A12] p-10">
              {/* background glows */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,.18),transparent_35%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(251,191,36,.08),transparent_28%)]" />

              <div className="relative z-10 grid grid-cols-2 gap-8">
                {/* LEFT */}
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-4 py-2">
                    <span className="h-2 w-2 rounded-full bg-[#F5D58C]" />
                    <span className="text-xs font-medium uppercase tracking-[0.25em] text-[#E2C27C]">
                      Fase competitiva activa
                    </span>
                  </div>

                  <h1 className="mt-8 text-6xl font-semibold leading-[0.95] tracking-tight">
                    Plataforma integral
                    <br />
                    de{" "}
                    <span className="bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent">
                      inteligencia
                    </span>{" "}
                    futbolística
                  </h1>

                  <div className="mt-8 flex items-start gap-5">
                    <div className="h-14 w-[3px] rounded-full bg-blue-500" />

                    <p className="max-w-3xl text-lg leading-relaxed text-gray-300">
                      Inteligencia aplicada al alto rendimiento para tomar
                      mejores decisiones, anticipar escenarios y optimizar cada
                      fase competitiva.
                    </p>
                  </div>

                  <div className="mt-8 flex gap-4">
                    <button className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-7 py-4 font-medium shadow-[0_0_30px_rgba(37,99,235,.35)] transition hover:scale-[1.02]">
                      <Rocket className="h-5 w-5" />
                      Explorar ecosistema
                    </button>

                    <button className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-4 font-medium hover:bg-white/[0.05]">
                      <PlayCircle className="h-5 w-5" />
                      Ver métricas
                    </button>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="relative">
                  <div className="absolute right-0 top-0 w-[230px] rounded-3xl border border-white/10 bg-[#091321]/80 p-6 backdrop-blur-xl">
                    <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
                      Eficiencia
                    </p>

                    <p className="mt-3 text-5xl font-semibold">87%</p>

                    <p className="mt-2 text-sm text-blue-400">
                      +4% vs semana anterior
                    </p>
                  </div>

                  <div className="mt-20 rounded-[32px] border border-white/10 bg-[#07111D]/70 p-4">
                    <Image
                      src="/hero-field.png"
                      alt="Campo táctico"
                      width={900}
                      height={600}
                      className="rounded-[26px] object-cover"
                      priority
                    />
                  </div>

                  <div className="absolute bottom-6 right-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#091321]/80 px-5 py-4">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-300">
                      ÓPTIMO
                    </span>
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
                      className={`rounded-[28px] border border-white/10 bg-[#08111C]/80 p-6 backdrop-blur-xl ${glow(
                        item.color
                      )}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-xs tracking-[0.2em] text-gray-400">
                            {item.label}
                          </p>

                          <h3 className="mt-2 text-4xl font-semibold">
                            {item.value}
                          </h3>
                        </div>
                      </div>

                      <div className="mt-5 h-[4px] rounded-full bg-white/5">
                        <div className="h-full w-3/4 rounded-full bg-blue-500" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* MODULES */}
            <div className="mt-12">
              <div className="flex items-center gap-4">
                <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                  Módulos
                </p>

                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-6">
                {modules.map((item) => {
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.title}
                      href={item.href}
                      className={`group rounded-[30px] border border-white/10 bg-gradient-to-br from-[#08111C] to-[#050A12] p-7 transition duration-300 hover:-translate-y-1 ${glow(
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

                            <h3 className="mt-3 text-3xl font-semibold">
                              {item.title}
                            </h3>

                            <p className="mt-2 text-gray-400">
                              {item.desc}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-full border border-white/10 bg-white/[0.03] p-4 transition group-hover:bg-blue-500/10">
                          <ChevronRight className="h-6 w-6" />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}