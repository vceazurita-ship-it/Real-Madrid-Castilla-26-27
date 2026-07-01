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
  Clipboard,
  ClipboardPen,
  CalendarDays,
  Flag,
  Scale,
  HeartHandshake,
  Network,
  Goal,
  Shield,
  Video,
  MonitorPlay,
  BarChart3,
  Swords,
  History,
  Search,
  Binoculars,
  Dumbbell,
  Database,
  Handshake,
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
      "/microcycles",
      "Microciclos",
      <CalendarDays size={18} />
    )}
    {navLink(
      "/pizarra_microcycle",
      "Pizarra Microciclo",
      <Clipboard  size={18} />
    )}
    {navLink(
      "/pizarra",
      "Pizarra Competición",
      <Activity size={18} />
    )}

    {navLink(
      "/match-plans",
      "Planes de Partido",
      <ClipboardPen  size={18} />
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

      {navLink(
        "/sinergy",
        "Sinergias",
        <Network  size={18} />
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
  "/video-collective",
  "Videoteca Colectiva",
  <MonitorPlay  size={18} />
)}
      {navLink(
        "/team",
        "Rendimiento",
        <BarChart3 size={18} />
      )}

      {navLink(
        "/collective",
        "Competición",
        <Swords  size={18} />
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
      "/scout-rival-individual",
      "Individual",
      <Search  size={18} />
    )}

    {navLink(
      "/scout-rival-collective",
      "Colectivo",
      <Binoculars  size={18} />
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
      <Dumbbell  size={18} />
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
      <Database  size={18} />
    )}

  </div>
</div>
</nav>
      </aside>
    </>
  )
}