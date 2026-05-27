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

  const navLink = (
    href: string,
    label: string,
    exact = true
  ) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className={
        pathname === href || (!exact && pathname.startsWith(href))
          ? activeClass
          : normalClass
      }
    >
      {label}
    </Link>
  )

  return (
    <>
      {/* MOBILE HEADER */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#111827] px-4 py-4 md:hidden">
        <h1 className="text-white font-semibold">Dashboard</h1>

        <button
          onClick={() => setOpen(true)}
          className="rounded-xl p-2 text-white hover:bg-white/5"
        >
          <Menu size={22} />
        </button>
      </div>

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
        {/* CLOSE BUTTON MOBILE */}
        <div className="mb-6 flex justify-end md:hidden">
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl p-2 text-white hover:bg-white/5"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="space-y-10">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
              Home
            </p>

            {navLink("/", "Overview")}
          </div>

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