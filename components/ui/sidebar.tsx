"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function Sidebar() {
  const pathname = usePathname()

  const activeClass =
    "flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"

  const normalClass =
    "flex items-center rounded-2xl px-4 py-3 text-gray-300 transition-all duration-300 hover:bg-white/5 hover:text-white"

  return (
    <aside className="w-72 min-h-screen border-r border-white/10 bg-[#111827] px-6 py-8">

      <nav className="space-y-10">

        {/* HOME */}
        <div>

          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
            Home
          </p>

          <Link
            href="/"
            className={pathname === "/" ? activeClass : normalClass}
          >
            Overview
          </Link>

        </div>

        {/* INDIVIDUAL */}
        <div>

          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
            Individual
          </p>

          <div className="space-y-2 text-sm">

            <Link
              href="/individual"
              className={
                pathname === "/individual"
                  ? activeClass
                  : normalClass
              }
            >
              Performance
            </Link>

            <Link
              href="/emotion"
              className={
                pathname === "/emotion"
                  ? activeClass
                  : normalClass
              }
            >
              Emotional Dynamics
            </Link>
            <Link
              href="/sinergy"
              className={
                pathname === "/s"
                  ? activeClass
                  : normalClass
              }
            >
              Sinergy
            </Link>
            <Link
              href="/comparative_ind"
              className={
                pathname === "/comparative_ind"
                  ? activeClass
                  : normalClass
              }
            >
              Comparative Performance
            </Link>

          </div>

        </div>

        {/* COLLECTIVE */}
        <div>

          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
            Collective
          </p>

          <div className="space-y-2 text-sm">

            <Link
              href="/team"
              className={
                pathname === "/team"
                  ? activeClass
                  : normalClass
              }
            >
              Team Performance
            </Link>

            <Link
              href="/collective"
              className={
                pathname === "/collective"
                  ? activeClass
                  : normalClass
              }
            >
              Collective Behaviour
            </Link>

            <Link
              href="/setpieces"
              className={
                pathname === "/setpieces"
                  ? activeClass
                  : normalClass
              }
            >
              Set Pieces
            </Link>

          </div>

        </div>

        {/* METHODOLOGY */}
        <div>

          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gray-500">
            Methodology
          </p>

          <div className="space-y-2 text-sm">

            <Link
              href="/methodology"
              className={
                pathname === "/microcycles"
                  ? activeClass
                  : normalClass
              }
            >
              Training Model
            </Link>

            <Link
              href="/sessions"
              className={
                pathname === "/sessions"
                  ? activeClass
                  : normalClass
              }
            >
              Session Content
            </Link>

          </div>

        </div>

      </nav>

    </aside>
  )
}