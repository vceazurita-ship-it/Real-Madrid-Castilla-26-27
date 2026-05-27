"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, X } from "lucide-react"

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const activeClass =
    "flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"

  const normalClass =
    "flex items-center rounded-2xl px-4 py-3 text-gray-300 transition-all duration-300 hover:bg-white/5 hover:text-white"

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className={pathname === href ? activeClass : normalClass}
    >
      {label}
    </Link>
  )

  return (
    <>
      {/* MOBILE FLOATING BUTTON */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-20 z-50 rounded-2xl border border-white/10 bg-[#111827]/90 p-3 text-white backdrop-blur-md shadow-lg md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* BACKDROP */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 transform
          border-r border-white/10 bg-[#111827] px-6 py-8
          transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0
        `}
      >
        {/* CLOSE BUTTON */}
        <div className="mb-6 flex justify-end md:hidden">
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl p-2 text-white hover:bg-white/5"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="space-y-10">
          {/* HOME */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
              Home
            </p>

            {navLink("/", "Overview")}
          </div>

          {/* INDIVIDUAL */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
              Individual
            </p>

            <div className="space-y-2 text-sm">
              {navLink("/individual", "Performance")}
              {navLink("/emotion", "Emotional Dynamics")}
              {navLink("/sinergy", "Synergy")}
              {navLink("/comparative_ind", "Comparative Performance")}
            </div>
          </div>

          {/* COLLECTIVE */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
              Collective
            </p>

            <div className="space-y-2 text-sm">
              {navLink("/team", "Team Performance")}
              {navLink("/collective", "Collective Behaviour")}
              {navLink("/setpieces", "Set Pieces")}
            </div>
          </div>

          {/* METHODOLOGY */}
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
              Methodology
            </p>

            <div className="space-y-2 text-sm">
              {navLink("/microcycles", "Training Model")}
              {navLink("/sessions", "Session Content")}
            </div>
          </div>
        </nav>
      </aside>
    </>
  )
}