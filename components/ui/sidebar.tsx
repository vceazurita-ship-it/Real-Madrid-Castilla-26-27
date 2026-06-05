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
} from "lucide-react"
import type { ReactNode } from "react"
export function Sidebar() {
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const activeClass =
  "flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"

const normalClass =
  "flex items-center justify-center rounded-2xl px-4 py-3 text-gray-300 transition-all duration-300 hover:bg-white/5 hover:text-white"

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
      <div className="mx-auto">
        {icon}
      </div>
    ) : (
      <span className="w-full text-left">
        {label}
      </span>
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
        className={`
          fixed inset-y-0 left-0 z-50
          transform
          overflow-y-auto overscroll-contain
          border-r border-white/10 bg-[#111827]
          py-8
          transition-all duration-300
          ${collapsed ? "w-24 px-3" : "w-72 px-6"}
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
        <div className="mb-6 hidden md:flex justify-end">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-xl p-2 text-white hover:bg-white/5"
          >
            <Menu size={20} />
          </button>
        </div>

        <nav className="space-y-10">
          {/* INICIO */}
          <div>
            {!collapsed && (
              <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
                Inicio
              </p>
            )}

            {/* INICIO */}
{navLink(
  "/",
  "Real Madrid CF C",
  <Home size={18} />
)}

          {/* INDIVIDUAL */}
          <div>
            {!collapsed && (
              <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
                Individual
              </p>
            )}

            <div className="space-y-2 text-sm">
              {/* INDIVIDUAL */}
{navLink(
  "/individual",
  "Evaluación",
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
              {/* COLECTIVO */}
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
  "ABP",
  <Goal size={18} />
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
              {/* METODOLOGÍA */}
{navLink(
  "/microcycles",
  "Microciclos",
  <CalendarDays size={18} />
)}
            </div>
          </div>
        </nav>
      </aside>
    </>
  )
}