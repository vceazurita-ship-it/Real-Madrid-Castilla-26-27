"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Home,
  Users,
  User,
  Menu,
  X,
  Activity,
  ClipboardCheck,
  ClipboardPen,
  CalendarDays,
  Flag,
  BookOpen,
  Scale,
  HeartHandshake,
  Network,
  Goal,
  Shield,
  BarChart3,
  History,
  Search,
  Binoculars,
  Dumbbell,
  Database,
  Handshake,
  ShieldHalf,
  ClipboardList,
  LayoutDashboard,
  Star,
  PenTool,
} from "lucide-react"
import type { ReactNode } from "react"

import { trackModuleVisit } from "@/lib/module-usage"

export function Sidebar() {
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  const activeClass =
  "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"

const normalClass =
  "flex items-center gap-3 rounded-2xl px-4 py-3 text-gray-300 transition-all duration-300 hover:bg-white/5 hover:text-white"

const navLink = (
  href: string,
  label: string,
  icon: ReactNode
) => (
  <Link
    href={href}
    onClick={() => {
      trackModuleVisit(href)
      setOpen(false)
    }}
    className={pathname === href ? activeClass : normalClass}
  >
    {collapsed ? (
      <div className="w-full flex justify-center">
        {icon}
      </div>
    ) : (
      <>
        {icon}
        <span>{label}</span>
      </>
    )}
  </Link>
)

/**
 * Entrada apagada: el módulo sigue existiendo pero todavía está en obras.
 *
 * Se deja a la vista para que no parezca que ha desaparecido, pero no es un
 * enlace: ni se puede pinchar ni se tabula hasta él. Con el menú desplegado
 * lleva la etiqueta «En obras» y, plegado, sólo el icono en gris; el `title`
 * cuenta el motivo en los dos casos.
 */
const disabledClass =
  "flex cursor-not-allowed select-none items-center gap-3 rounded-2xl px-4 py-3 text-gray-500 opacity-60"

const disabledLink = (
  label: string,
  icon: ReactNode,
  reason = "Todavía estamos haciendo cambios"
) => (
  <div
    aria-disabled="true"
    title={`${label} — ${reason}`}
    className={disabledClass}
  >
    {collapsed ? (
      <div className="w-full flex justify-center">
        {icon}
      </div>
    ) : (
      <>
        {icon}

        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate line-through decoration-gray-600">
            {label}
          </span>

          <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-500">
            En obras
          </span>
        </span>
      </>
    )}
  </div>
)

  return (
    <>
      {/* BOTÓN MÓVIL */}
      <button
        data-export-hide
        onClick={() => setOpen(true)}
        className="fixed left-1 top-1 z-50 rounded-2xl border border-white/10 bg-[#111827]/90 p-3 text-white backdrop-blur-md shadow-lg md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* OVERLAY MÓVIL */}
      {open && (
        <div
          data-export-hide
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}
  
      {/* SIDEBAR */}
      <aside
  data-export-hide
  onMouseEnter={() =>
    window.innerWidth >= 768 &&
    setCollapsed(false)
  }
  onMouseLeave={() =>
    window.innerWidth >= 768 &&
    setCollapsed(true)
  }
  className={`

          fixed inset-y-0 left-0 z-50
          flex flex-col
          transform
          border-r border-white/10 bg-[#111827]
          py-8
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[78px] px-2" : "w-[280px] px-6"}
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:sticky md:inset-y-auto md:top-0 md:h-[100dvh] md:max-h-[100dvh]
          md:shrink-0 md:translate-x-0 md:self-start
        `}
      >
        {/* CERRAR MÓVIL */}
        <div className="mb-6 flex shrink-0 justify-end md:hidden">
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl p-2 text-white hover:bg-white/5"
          >
            <X size={22} />
          </button>
        </div>

        {/*
          El menú es más alto que la pantalla: scrollea aquí dentro, no en la
          página. Así el listado completo se alcanza siempre, aunque el
          contenedor de la página cree su propio contexto de scroll.
        */}
        <nav
          className="min-h-0 flex-1 space-y-10 overflow-y-auto overflow-x-hidden overscroll-contain pb-8"
          style={{ WebkitOverflowScrolling: "touch" }}
        >

  {/* INICIO */}
  <div>
    {!collapsed && (
      <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
        Inicio
      </p>
    )}

    {navLink(
      "/",
      "Real Madrid Castilla",
      <Home size={18} />
    )}
  </div>
{/* IDENTIDAD */}
<div>
  {!collapsed && (
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
      Identidad
    </p>
  )}

  <div className="space-y-2 text-sm">

    {navLink(
      "/team-values",
      "Dinámicas y Valores",
      <Handshake  size={18} />
    )}

    {navLink(
      "/game-model",
      "Identidad de Juego",
      <Network  size={18} />
    )}

    {navLink(
  "/identidad-posicional",
  "Identidad Posicional",
  <ShieldHalf size={18} />
)}
  </div>
</div>

  {/* COMPETICIÓN */}
<div>
  {!collapsed && (
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
      Competición
    </p>
  )}

  <div className="space-y-2 text-sm">

    {navLink(
      "/match-preparation",
      "Preparación de Partido",
      <ClipboardCheck  size={18} />
    )}

  </div>
</div>
{/* METODOLOGÍA */}
<div>
  {!collapsed && (
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
      Metodología
    </p>
  )}

  <div className="space-y-2 text-sm">
    {navLink(
  "/micro_calendar",
  "Contenidos Microciclo",
  <BookOpen size={18} />
)}
   
    {navLink(
      "/microcycles",
      "Microciclos",
      <CalendarDays size={18} />
    )}

    {navLink(
  "/calendar",
  "Calendario Seguimiento",
  <ClipboardList size={18} />
)}
{navLink(
  "/individual_proc",
  "Dashboard Seguimiento",
  <BarChart3 size={18} />
)}

    {navLink(
      "/pizarra_sesion",
      "Pizarra Sesión",
      <LayoutDashboard size={18} />
    )}

    {navLink(
      "/pizarra",
      "Pizarra Competición",
      <Activity size={18} />
    )}

    {navLink(
      "/pizarra-tactica",
      "Pizarra Táctica",
      <PenTool size={18} />
    )}

    {navLink(
      "/match-plans",
      "Vídeo Análisis Partidos",
      <ClipboardPen  size={18} />
    )}

    {/* En obras: baja al final de Metodología hasta que se retome. */}
    {disabledLink(
      "Jugadores Sesión",
      <Users size={18} />
    )}

  </div>
</div>
  {/* INDIVIDUAL */}
  <div>
    {!collapsed && (
      <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
        Individual
      </p>
    )}

    <div className="space-y-2 text-sm">
      {navLink(
        "/individual",
        "Plantilla",
        <User size={18} />
      )}
      {navLink(
  "/ratings",
  "Valoraciones",
  <Star size={18} />
)}

      {navLink(
        "/comparative_ind",
        "Comparativo U-21",
        <Scale size={18} />
      )}

      {/* En obras: baja al final de Individual hasta que se retome. */}
      {disabledLink(
        "Dashboard",
        <BarChart3 size={18} />
      )}
    </div>
  </div>

  {/* RELACIONAL */}
  <div>
    {!collapsed && (
      <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
        Relacional
      </p>
    )}

    <div className="space-y-2 text-sm">
      {navLink(
        "/emotion",
        "Emocional",
        <HeartHandshake  size={18} />
      )} 
    </div>
  </div>


  {/* COLECTIVO */}
  <div>
    {!collapsed && (
      <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
        Colectivo
      </p>
    )}

    <div className="space-y-2 text-sm">
      
      {navLink(
        "/setpieces",
        "ABP Ofensivo",
        <Goal size={18} />
      )}
      {navLink(
        "/setpieces_def",
        "ABP Defensivo",
        <Shield size={18} />
      )}
      {navLink(
        "/throw-ins",
        "Saque de Banda Ofensivo",
        <Flag size={18} />
      )}
      {navLink(
        "/throw-ins-def",
        "Saque de Banda Defensivo",
        <Shield size={18} />
      )}
      
      {navLink(
        "/collective_history",
        "Histórico Competición",
        <History  size={18} />
      )}
      
    </div>
  </div>

{/* RIVAL */}
  <div>
  {!collapsed && (
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
      Rival
    </p>
  )}

  <div className="space-y-2 text-sm">

    {navLink(
  "/rivals",
  "Plantillas",
  <Users size={18} />
)}
    
    {navLink(
      "/scout-rival-individual",
      "Individual",
      <Search  size={18} />
    )}

    {navLink(
      "/scout-rival-collective",
      "Colectivo",
      <Binoculars  size={18} />
    )}

    {navLink(
      "/scout-rival-abp",
      "ABP del Rival",
      <Flag size={18} />
    )}

  </div>
</div>

  {/* ÁREA CONDICIONAL */}
<div>
  {!collapsed && (
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
      Rendimiento
    </p>
  )}

  <div className="space-y-2 text-sm">

    {navLink(
  "/calendar_performance",
  "Calendario Condicional",
  <CalendarDays size={18} />
)}
    {navLink(
      "/performance",
      "Área Condicional",
      <Dumbbell  size={18} />
    )}

  </div>
</div>
{/* DATA */}
<div>
  {!collapsed && (
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
      Operativa General
    </p>
  )}

  <div className="space-y-2 text-sm">

    {navLink(
      "/calendar_general",
      "Calendario Operativa",
      <CalendarDays size={18} />
    )}

    {navLink(
      "/general",
      "Repositorio",
      <Database  size={18} />
    )}

  </div>
</div>


</nav>
      </aside>
    </>
  )
}
