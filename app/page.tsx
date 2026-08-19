"use client"

import Link from "next/link"
import Image from "next/image"
import {
  Brain,
  CalendarDays,
  ChevronRight,
  Activity,
  BookOpen,
  BarChart3,
  User,
  ClipboardCheck,
  Clipboard,
  ClipboardPen,
  Scale,
  HeartHandshake,
  Network,
  Goal,
  Shield,
  Video,
  MonitorPlay,
  Swords,
  History,
  Search,
  Binoculars,
  Dumbbell,
  Users,
  Database,
  Handshake,
  Flag,
} from "lucide-react"

import { Sidebar } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"
import { useEffect, useState } from "react"
import Papa from "papaparse"
import ModulesCarousel from "@/components/ui/ModulesCarousel"

type Principio = {
  FASE: string
  BLOQUE: string
  APARTADO: string
}

type Seguimiento = {
  ID_JUGADOR?: string
  FECHA?: string
}

const ENDPOINT_JUGADORES =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=jugadores"

const ENDPOINT_SEGUIMIENTO =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec?action=seguimiento"

const CSV_CULTURA =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1367356753&single=true&output=csv"

const CSV_PRINCIPIOS =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1322156567&single=true&output=csv"

const modules = [
  // IDENTIDAD
  {
    href: "/team-values",
    section: "IDENTIDAD",
    title: "Dinámicas y Valores",
    desc: "Cultura, normas y comportamientos del entorno competitivo",
    icon: Handshake,
    glow: "amber",
  },
  {
    href: "/game-model",
    section: "IDENTIDAD",
    title: "Identidad de Juego",
    desc: "Principios ofensivos y defensivos del modelo de juego",
    icon: Brain,
    glow: "cyan",
  },

  // COMPETICIÓN
  {
    href: "/match-preparation",
    section: "COMPETICIÓN",
    title: "Preparación de Partido",
    desc: "Planificación estratégica previa a la competición",
    icon: ClipboardCheck,
    glow: "blue",
  },

  // METODOLOGÍA
  {
    href: "/training",
    section: "METODOLOGÍA",
    title: "Jugadores Próxima Sesión",
    desc: "Importación y disponibilidad para la sesión",
    icon: Users,
    glow: "emerald",
  },
  {
    href: "/micro_calendar",
    section: "METODOLOGÍA",
    title: "Contenidos Microciclo",
    desc: "Planificación de contenidos durante el microciclo",
    icon: BookOpen,
    glow: "amber",
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
    href: "/pizarra_sesion",
    section: "METODOLOGÍA",
    title: "Pizarra Sesión",
    desc: "Organización visual de tareas y jugadores",
    icon: Clipboard,
    glow: "cyan",
  },
  {
    href: "/pizarra_microcycle",
    section: "METODOLOGÍA",
    title: "Pizarra Microciclo",
    desc: "Organización visual del microciclo",
    icon: Clipboard,
    glow: "emerald",
  },
  {
    href: "/pizarra",
    section: "METODOLOGÍA",
    title: "Pizarra Competición",
    desc: "Diseño táctico para el partido",
    icon: Activity,
    glow: "violet",
  },
  {
    href: "/match-plans",
    section: "METODOLOGÍA",
    title: "Planes de Partido",
    desc: "Estructura táctica y operacional",
    icon: ClipboardPen,
    glow: "blue",
  },

  // INDIVIDUAL
  {
    href: "/individual",
    section: "INDIVIDUAL",
    title: "Plantilla",
    desc: "Gestión integral del jugador",
    icon: User,
    glow: "blue",
  },
  {
    href: "/dashboard-plantilla",
    section: "INDIVIDUAL",
    title: "Dashboard Individual",
    desc: "Dashboard comparativo de la plantilla",
    icon: BarChart3,
    glow: "blue",
  },
  {
    href: "/calendar",
    section: "INDIVIDUAL",
    title: "Calendario Seguimiento",
    desc: "Planificación y control de seguimientos",
    icon: CalendarDays,
    glow: "amber",
  },
  {
    href: "/individual_proc",
    section: "INDIVIDUAL",
    title: "Dashboard Seguimiento",
    desc: "Indicadores del desarrollo individual",
    icon: BarChart3,
    glow: "blue",
  },
  {
    href: "/video-individual",
    section: "INDIVIDUAL",
    title: "Videoteca Individual",
    desc: "Biblioteca de clips individuales",
    icon: Video,
    glow: "cyan",
  },
  {
    href: "/comparative_ind",
    section: "INDIVIDUAL",
    title: "Comparativo U-21",
    desc: "Comparación y proyección de talento",
    icon: Scale,
    glow: "amber",
  },

  // RELACIONAL
  {
    href: "/emotion",
    section: "RELACIONAL",
    title: "Emocional",
    desc: "Seguimiento del rendimiento emocional",
    icon: HeartHandshake,
    glow: "violet",
  },
  {
    href: "/sinergy",
    section: "RELACIONAL",
    title: "Sinergias",
    desc: "Relaciones funcionales entre jugadores",
    icon: Network,
    glow: "emerald",
  },

  // COLECTIVO
  {
    href: "/setpieces",
    section: "COLECTIVO",
    title: "ABP Ofensivo",
    desc: "Acciones ofensivas a balón parado",
    icon: Goal,
    glow: "cyan",
  },
  {
    href: "/setpieces_def",
    section: "COLECTIVO",
    title: "ABP Defensivo",
    desc: "Organización defensiva a balón parado",
    icon: Shield,
    glow: "violet",
  },
  {
    href: "/throw-ins",
    section: "COLECTIVO",
    title: "Saque de Banda Ofensivo",
    desc: "Análisis de saques de banda a favor",
    icon: Flag,
    glow: "cyan",
  },
  {
    href: "/throw-ins-def",
    section: "COLECTIVO",
    title: "Saque de Banda Defensivo",
    desc: "Análisis de saques de banda en contra",
    icon: Shield,
    glow: "violet",
  },
  {
    href: "/video-collective",
    section: "COLECTIVO",
    title: "Videoteca Colectiva",
    desc: "Biblioteca de clips colectivos",
    icon: MonitorPlay,
    glow: "blue",
  },
  {
    href: "/team",
    section: "COLECTIVO",
    title: "Rendimiento",
    desc: "Indicadores globales del equipo",
    icon: BarChart3,
    glow: "amber",
  },
  {
    href: "/collective",
    section: "COLECTIVO",
    title: "Competición",
    desc: "Análisis del rendimiento competitivo",
    icon: Swords,
    glow: "blue",
  },
  {
    href: "/collective_history",
    section: "COLECTIVO",
    title: "Histórico Competición",
    desc: "Evolución histórica del rendimiento",
    icon: History,
    glow: "emerald",
  },

  // RIVAL
  {
    href: "/scout-rival-individual",
    section: "RIVAL",
    title: "Scout Individual",
    desc: "Análisis individual del rival",
    icon: Search,
    glow: "amber",
  },
  {
    href: "/scout-rival-collective",
    section: "RIVAL",
    title: "Scout Colectivo",
    desc: "Análisis colectivo del rival",
    icon: Binoculars,
    glow: "violet",
  },

  // RENDIMIENTO
  {
    href: "/performance",
    section: "RENDIMIENTO",
    title: "Área Condicional",
    desc: "Control del rendimiento físico",
    icon: Dumbbell,
    glow: "cyan",
  },

  // DATA
  {
    href: "/data-center",
    section: "DATOS",
    title: "Repositorio",
    desc: "Centro documental y base de datos",
    icon: Database,
    glow: "blue",
  },
]

/* ---------------------------------------------------------------
   Piezas compartidas: un único sistema visual para la portada
   (etiquetas de sección, métricas con estado de carga y tarjetas).
--------------------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-4 w-[3px] rounded-full bg-gradient-to-b from-[#37A6FF] to-transparent" />

      <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-[#37A6FF]">
        {children}
      </p>
    </div>
  )
}

function Metric({
  value,
  loading,
}: {
  value: number
  loading: boolean
}) {
  if (loading) {
    return (
      <span
        aria-hidden
        className="inline-block h-[0.8em] w-[2.2ch] animate-pulse rounded-md bg-white/10 align-baseline"
      />
    )
  }

  return <span className="tabular-nums">{value.toLocaleString("es-ES")}</span>
}

const identityAccents = {
  cyan: {
    border: "border-cyan-500/20 hover:border-cyan-400/50",
    bg: "bg-cyan-500/[0.06]",
    text: "text-cyan-400",
    shadow: "hover:shadow-[0_0_40px_rgba(6,182,212,.14)]",
  },
  blue: {
    border: "border-blue-500/20 hover:border-blue-400/50",
    bg: "bg-blue-500/[0.06]",
    text: "text-blue-400",
    shadow: "hover:shadow-[0_0_40px_rgba(59,130,246,.14)]",
  },
  emerald: {
    border: "border-emerald-500/20 hover:border-emerald-400/50",
    bg: "bg-emerald-500/[0.06]",
    text: "text-emerald-400",
    shadow: "hover:shadow-[0_0_40px_rgba(16,185,129,.14)]",
  },
} as const

function IdentityCard({
  href,
  eyebrow,
  title,
  value,
  caption,
  loading,
  accent,
  icon: Icon,
}: {
  href: string
  eyebrow: string
  title: string
  value: number
  caption: string
  loading: boolean
  accent: keyof typeof identityAccents
  icon: React.ElementType
}) {
  const a = identityAccents[accent]

  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-[22px] border ${a.border} ${a.bg} ${a.shadow} p-5 transition-all duration-300 hover:-translate-y-1`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-[10px] font-medium uppercase leading-tight tracking-[0.18em] ${a.text}`}
        >
          {eyebrow}
        </p>

        <Icon
          className={`h-4 w-4 shrink-0 opacity-50 transition group-hover:opacity-100 ${a.text}`}
        />
      </div>

      <h3 className="mt-2 text-xl font-bold tracking-tight">{title}</h3>

      <div className="mt-4 h-px bg-white/10" />

      <p className={`mt-3 text-[32px] font-bold leading-none ${a.text}`}>
        <Metric value={value} loading={loading} />
      </p>

      <p className="mt-2 text-[13px] leading-tight text-white/55">{caption}</p>
    </Link>
  )
}

function StatCard({
  href,
  label,
  value,
  caption,
  loading,
  icon: Icon,
}: {
  href: string
  label: string
  value: number
  caption: string
  loading: boolean
  icon: React.ElementType
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[184px] flex-col justify-between overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#06111D] to-[#040C16] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#D8B45A]/40 hover:shadow-[0_0_40px_rgba(216,180,90,.12)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#D8B45A]/[0.07] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#D8B45A]">
          {label}
        </p>

        <Icon className="h-6 w-6 shrink-0 text-[#D8B45A]/70 transition group-hover:text-[#D8B45A]" />
      </div>

      <div className="relative">
        <h3 className="text-[44px] font-bold leading-none tracking-tight">
          <Metric value={value} loading={loading} />
        </h3>

        <p className="mt-3 text-sm text-white/60">{caption}</p>
      </div>
    </Link>
  )
}

export default function Home() {
  const [ataqueApartados, setAtaqueApartados] = useState(0)
  const [defensaApartados, setDefensaApartados] = useState(0)
  const [principiosCultura, setPrincipiosCultura] = useState(0)

  const [totalJugadores, setTotalJugadores] = useState(0)
  const [seguimientos, setSeguimientos] = useState(0)
  const [promedioSeguimientos, setPromedioSeguimientos] = useState(0)
  const [jugadoresSeguimiento, setJugadoresSeguimiento] = useState(0)
  const [ultimos30Dias, setUltimos30Dias] = useState(0)

  // Valor derivado: no necesita estado propio ni efecto.
  const cobertura =
    totalJugadores > 0
      ? Math.round((jugadoresSeguimiento / totalJugadores) * 100)
      : 0

  // Estados de carga: evitan el parpadeo de ceros mientras llegan los datos.
  const [loadingJugadores, setLoadingJugadores] = useState(true)
  const [loadingCultura, setLoadingCultura] = useState(true)
  const [loadingPrincipios, setLoadingPrincipios] = useState(true)
  const [loadingSeguimiento, setLoadingSeguimiento] = useState(true)

  useEffect(() => {
    fetch(ENDPOINT_JUGADORES)
      .then((r) => r.json())
      .then((rows) => {
        setTotalJugadores(Array.isArray(rows) ? rows.length : 0)
      })
      .catch(() => {})
      .finally(() => setLoadingJugadores(false))
  }, [])

  useEffect(() => {
    fetch(CSV_CULTURA)
      .then((r) => r.text())
      .then((csv) => {
        const parsed = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
        })

        setPrincipiosCultura(parsed.data.length)
      })
      .catch(() => {})
      .finally(() => setLoadingCultura(false))
  }, [])

  useEffect(() => {
    fetch(CSV_PRINCIPIOS)
      .then((r) => r.text())
      .then((csv) => {
        const parsed = Papa.parse<Principio>(csv, {
          header: true,
          skipEmptyLines: true,
        })

        const rows = parsed.data

        const ataque = [
          ...new Set(
            rows.filter((r) => r.FASE === "ATAQUE").map((r) => r.APARTADO)
          ),
        ]

        const defensa = [
          ...new Set(
            rows.filter((r) => r.FASE === "DEFENSA").map((r) => r.APARTADO)
          ),
        ]

        setAtaqueApartados(ataque.length)
        setDefensaApartados(defensa.length)
      })
      .catch(() => {})
      .finally(() => setLoadingPrincipios(false))
  }, [])

  useEffect(() => {
    fetch(ENDPOINT_SEGUIMIENTO)
      .then((r) => r.json())
      .then((data) => {
        const rows: Seguimiento[] = Array.isArray(data) ? data : []

        setSeguimientos(rows.length)

        const jugadores = new Set(rows.map((r) => r.ID_JUGADOR))

        setJugadoresSeguimiento(jugadores.size)

        const promedio = jugadores.size > 0 ? rows.length / jugadores.size : 0

        setPromedioSeguimientos(Number(promedio.toFixed(1)))

        const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

        const recientes = rows.filter((r) => {
          const fecha = new Date(r.FECHA ?? "")
          return !isNaN(fecha.getTime()) && fecha >= limite
        })

        setUltimos30Dias(recientes.length)
      })
      .catch(() => {})
      .finally(() => setLoadingSeguimiento(false))
  }, [])

  return (
    <main className="min-h-screen bg-[#02060D] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          <Topbar />

          <section className="p-4 sm:p-6 xl:p-10">
            <div className="relative overflow-hidden rounded-[28px] border border-[#173A61]/60 bg-[#030B15] p-5 shadow-[0_0_80px_rgba(0,80,255,.08)] sm:p-8 xl:rounded-[40px] xl:p-10">
              {/* Fondo ambiental: estadio + halos de color */}
              <Image
                src="/stadium-bg.png"
                alt=""
                fill
                sizes="100vw"
                fetchPriority="high"
                className="pointer-events-none object-cover opacity-[0.10]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#030B15]/60 to-[#030B15]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(59,130,246,.18),transparent_30%)]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(37,99,235,.18),transparent_30%)]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_72%,rgba(245,158,11,.10),transparent_28%)]"
              />

              <div className="relative z-10">
                <div className="grid items-stretch gap-8 xl:auto-rows-fr xl:grid-cols-[minmax(0,620px)_minmax(0,1fr)] xl:gap-10">
                  {/* ---------- COLUMNA IZQUIERDA ---------- */}
                  <div className="flex flex-col">
                    <div className="inline-flex w-fit items-center gap-3 rounded-full border border-[#D8B45A]/40 bg-[#D8B45A]/10 px-4 py-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F7D98B] opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F7D98B]" />
                      </span>

                      <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F7D98B]">
                        Fase competitiva activa
                      </span>
                    </div>

                    <h1 className="mt-6 max-w-[760px] text-[44px] font-bold leading-[0.94] tracking-[-0.04em] sm:text-[58px] xl:mt-8 xl:text-[76px] xl:leading-[0.88]">
                      Plataforma Integral
                      <br />
                      <span className="bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-white bg-clip-text text-transparent">
                        RMCF Castilla
                      </span>
                    </h1>

                    <div className="mt-6 flex gap-4 xl:mt-8 xl:gap-5">
                      <div className="w-[3px] shrink-0 rounded-full bg-gradient-to-b from-blue-400 via-blue-500 to-transparent" />

                      <p className="max-w-[620px] text-base leading-relaxed text-white/70 sm:text-lg xl:text-[19px]">
                        Ecosistema integral para la gestión de la identidad, la
                        competición, el desarrollo individual, el rendimiento
                        colectivo y el análisis estratégico del rival.
                      </p>
                    </div>

                    {/* CTAs */}
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <Link
                        href="/performance"
                        className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-6 py-3.5 text-[15px] font-medium shadow-[0_0_36px_rgba(37,99,235,.32)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_48px_rgba(37,99,235,.45)]"
                      >
                        <Dumbbell className="h-[18px] w-[18px]" />
                        Planificación condicional
                        <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </Link>

                      <Link
                        href="/training"
                        className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3.5 text-[15px] font-medium shadow-[0_0_36px_rgba(16,185,129,.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_48px_rgba(16,185,129,.42)]"
                      >
                        <Users className="h-[18px] w-[18px]" />
                        Jugadores Próxima Sesión
                        <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </Link>

                      <Link
                        href="/match-preparation"
                        className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-[15px] text-white/85 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
                      >
                        <ClipboardCheck className="h-[18px] w-[18px]" />
                        Preparación Partido
                      </Link>
                    </div>

                    {/* Tarjetas de identidad */}
                    <div className="mt-auto pt-10">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <IdentityCard
                          href="/game-model#ATAQUE"
                          eyebrow="Identidad de juego"
                          title="ATAQUE"
                          value={ataqueApartados}
                          caption="Apartados ofensivos"
                          loading={loadingPrincipios}
                          accent="cyan"
                          icon={Swords}
                        />

                        <IdentityCard
                          href="/game-model#DEFENSA"
                          eyebrow="Identidad de juego"
                          title="DEFENSA"
                          value={defensaApartados}
                          caption="Apartados defensivos"
                          loading={loadingPrincipios}
                          accent="blue"
                          icon={Shield}
                        />

                        <IdentityCard
                          href="/team-values"
                          eyebrow="Dinámicas y valores"
                          title="CULTURA"
                          value={principiosCultura}
                          caption="Elementos culturales"
                          loading={loadingCultura}
                          accent="emerald"
                          icon={Handshake}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ---------- COLUMNA DERECHA ---------- */}
                  <div>
                    <Link
                      href="/general"
                      className="light-sweep group relative block h-full min-h-[420px] overflow-hidden rounded-[32px] border border-white/10 xl:min-h-[500px]"
                    >
                      <div
                        aria-hidden
                        className="animate-pulse-glow absolute left-1/2 top-1/2 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl"
                      />

                      <div className="particles" aria-hidden />

                      <Image
                        src="/hero-field.png"
                        alt=""
                        fill
                        sizes="(max-width: 1279px) 100vw, 55vw"
                        className="animate-hero object-cover transition-transform duration-[4000ms] group-hover:scale-110"
                      />

                      <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-l from-transparent via-black/10 to-[#02060D]/70"
                      />

                      <div
                        aria-hidden
                        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,.18),transparent_60%)]"
                      />

                      <div className="absolute left-6 top-6">
                        <div className="rounded-full border border-cyan-500/30 bg-black/60 px-4 py-2 backdrop-blur-xl transition group-hover:border-cyan-400/60">
                          <p className="text-[11px] font-medium tracking-[0.3em] text-cyan-400">
                            VISIÓN GLOBAL
                          </p>
                        </div>
                      </div>

                      {/* Pie del panel: cobertura de seguimiento */}
                      <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 rounded-[22px] border border-white/10 bg-black/45 px-5 py-4 backdrop-blur-xl">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.28em] text-white/50">
                            Cobertura de seguimiento
                          </p>

                          <p className="mt-2 text-3xl font-bold leading-none text-white">
                            <Metric
                              value={cobertura}
                              loading={loadingSeguimiento || loadingJugadores}
                            />
                            <span className="ml-0.5 text-lg text-white/50">
                              %
                            </span>
                          </p>

                          <div className="mt-3 h-1 w-40 max-w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-1000 ease-out"
                              style={{ width: `${Math.min(cobertura, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-white/50">
                            Últimos 30 días
                          </p>

                          <p className="mt-2 text-3xl font-bold leading-none text-cyan-400">
                            <Metric
                              value={ultimos30Dias}
                              loading={loadingSeguimiento}
                            />
                          </p>

                          <p className="mt-1 text-[11px] text-white/45">
                            registros
                          </p>
                        </div>
                      </div>

                      <div className="scan-line" aria-hidden />
                    </Link>
                  </div>
                </div>

                {/* ---------- DESARROLLO INDIVIDUAL ---------- */}
                <div className="mt-14">
                  <SectionLabel>Desarrollo individual</SectionLabel>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <StatCard
                      href="/calendar"
                      label="Seguimientos"
                      value={seguimientos}
                      caption="Sesiones registradas"
                      loading={loadingSeguimiento}
                      icon={Activity}
                    />

                    <StatCard
                      href="/individual"
                      label="Jugadores"
                      value={totalJugadores}
                      caption="Jugadores en plantilla"
                      loading={loadingJugadores}
                      icon={Users}
                    />

                    <StatCard
                      href="/individual_proc"
                      label="Promedio"
                      value={promedioSeguimientos}
                      caption="Seguimientos por jugador"
                      loading={loadingSeguimiento}
                      icon={BarChart3}
                    />
                  </div>
                </div>

                {/* ---------- ÁREAS ESTRATÉGICAS ---------- */}
                <div className="mt-14 border-t border-white/10 pt-10">
                  <SectionLabel>Áreas estratégicas</SectionLabel>

                  <ModulesCarousel modules={modules} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
