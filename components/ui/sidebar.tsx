"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Menu,
  X,
  Home,
  User,
  Brain,
  Users,
  Scale,
  BarChart3,
  Trophy,
  Goal,
  CalendarDays,
  Shield,
  PlayCircle,
  Video,
  ClipboardCheck,
  Activity,
} from "lucide-react"
import type { ReactNode } from "react"
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
    onClick={() => setOpen(false)}
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

  return (
    <>
      {/* BOTÓN MÓVIL */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-1 top-1 z-50 rounded-2xl border border-white/10 bg-[#111827]/90 p-3 text-white backdrop-blur-md shadow-lg md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* OVERLAY MÓVIL */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}
  
      {/* SIDEBAR */}
      <aside
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
          transform
          overflow-y-auto overscroll-contain
          border-r border-white/10 bg-[#111827]
          py-8
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[78px] px-2" : "w-[280px] px-6"}
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0 md:overflow-visible
        `}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* CERRAR MÓVIL */}
        <div className="mb-6 flex justify-end md:hidden">
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl p-2 text-white hover:bg-white/5"
          >
            <X size={22} />
          </button>
        </div>

        {/* COLAPSAR DESKTOP */}
        

        <nav className="space-y-10">

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
      "/game-model",
      "Identidad de Juego",
      <Brain size={18} />
    )}

    {navLink(
      "/team-values",
      "Dinámicas y Valores",
      <Users size={18} />
    )}

    {navLink(
      "/microcycles",
      "Microciclos",
      <CalendarDays size={18} />
    )}

    {navLink(
      "/match-plans",
      "Planes de Partido",
      <PlayCircle size={18} />
    )}

  </div>
</div>
  {/* ANALISIS PROPIO */}
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
        "/emotion",
        "Emocional",
        <Brain size={18} />
      )}

      {navLink(
        "/sinergy",
        "Sinergias",
        <Users size={18} />
      )}
      {navLink(
  "/video-individual",
  "Videoteca Individual",
  <Video size={18} />
)}
      {navLink(
        "/comparative_ind",
        "Comparativo U-21",
        <Scale size={18} />
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
  "/video-collective",
  "Videoteca Colectiva",
  <Video size={18} />
)}
      
      {navLink(
        "/team",
        "Rendimiento",
        <BarChart3 size={18} />
      )}

      {navLink(
        "/collective",
        "Competición",
        <Trophy size={18} />
      )}

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
    </div>
  </div>

{/* SCOUT RIVAL */}
  <div>
  {!collapsed && (
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
      Scout Rival
    </p>
  )}

  <div className="space-y-2 text-sm">

    {navLink(
      "/scout-rival-individual",
      "Individual",
      <User size={18} />
    )}

    {navLink(
      "/scout-rival-collective",
      "Colectivo",
      <Users size={18} />
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
      "/performance",
      "Área Condicional",
      <Activity size={18} />
    )}

  </div>
</div>

{/* DATA */}
<div>
  {!collapsed && (
    <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
      Repositorio Datos
    </p>
  )}

  <div className="space-y-2 text-sm">

    {navLink(
      "/data-center",
      "Repositorio",
      <Activity size={18} />
    )}

  </div>
</div>
</nav>
      </aside>
    </>
  )
}