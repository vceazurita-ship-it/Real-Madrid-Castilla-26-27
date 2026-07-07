"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type Module = {
  href: string
  section: string
  title: string
  desc: string
  icon: any
  glow: string
}

function glow(color: string) {
  const map = {
    blue: "shadow-[0_0_50px_rgba(59,130,246,.16)]",
    violet: "shadow-[0_0_50px_rgba(168,85,247,.16)]",
    emerald: "shadow-[0_0_50px_rgba(16,185,129,.14)]",
    amber: "shadow-[0_0_50px_rgba(245,158,11,.14)]",
    cyan: "shadow-[0_0_50px_rgba(6,182,212,.14)]",
  }

  return map[color as keyof typeof map]
}

const PAGE_SIZE = 8

export default function ModulesCarousel({
  modules,
}: {
  modules: Module[]
}) {

  const [page, setPage] = useState(0)
const priority: Record<string, number> = {
  // PRIORIDAD PRINCIPAL
  "/game-model": 100,
  "/team-values": 99,
  "/match-preparation": 98,
  "/scout-rival-collective": 97,
  "/training": 96,
  "/pizarra_sesion": 95,
  "/individual": 94,
  "/calendar": 93,

  // METODOLOGÍA
  "/individual_proc": 90,
  "/microcycles": 89,
  "/pizarra_microcycle": 88,
  "/pizarra": 87,
  "/match-plans": 86,

  // COLECTIVO
  "/team": 80,
  "/collective": 79,
  "/collective_history": 78,
  "/setpieces": 77,
  "/setpieces_def": 76,
  "/video-collective": 75,

  // INDIVIDUAL
  "/video-individual": 70,
  "/comparative_ind": 69,

  // RELACIONAL
  "/emotion": 68,
  "/sinergy": 67,

  // RENDIMIENTO
  "/performance": 60,

  // RIVAL
  "/scout-rival-individual": 55,

  // DATOS
  "/data-center": 50,
}
const usage =
  typeof window !== "undefined"
    ? JSON.parse(
        localStorage.getItem("rmcf-module-usage") ?? "{}"
      )
    : {}

const orderedModules = [...modules].sort((a, b) => {
  const scoreA =
    (priority[a.href] ?? 0) +
    (usage[a.href] ?? 0)

  const scoreB =
    (priority[b.href] ?? 0) +
    (usage[b.href] ?? 0)

  return scoreB - scoreA
})
  const totalPages = Math.ceil(
  orderedModules.length / PAGE_SIZE
)

  const current = orderedModules.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  )

  return (

    <div className="mt-6">

      <div className="flex items-center justify-end gap-3 mb-6">

        <button
          onClick={() =>
            setPage((p) => Math.max(0, p - 1))
          }
          disabled={page === 0}
          className="
          h-11
          w-11
          rounded-full
          border
          border-white/10
          bg-[#07111E]
          flex
          items-center
          justify-center
          transition
          hover:bg-blue-600
          disabled:opacity-30
          "
        >
          <ChevronLeft className="h-5 w-5"/>
        </button>

        <span className="text-sm text-white/60">
          {page + 1} / {totalPages}
        </span>

        <button
          onClick={() =>
            setPage((p) =>
              Math.min(totalPages - 1, p + 1)
            )
          }
          disabled={page === totalPages - 1}
          className="
          h-11
          w-11
          rounded-full
          border
          border-white/10
          bg-[#07111E]
          flex
          items-center
          justify-center
          transition
          hover:bg-blue-600
          disabled:opacity-30
          "
        >
          <ChevronRight className="h-5 w-5"/>
        </button>

      </div>

      <div
        key={page}
        className="
        animate-in
        fade-in
        duration-500
        grid
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-4
        gap-5
        "
      >

        {current.map((item) => {

          const Icon = item.icon

          return (

            <Link
              key={item.title}
              href={item.href}
              className={`
              relative
              group
              rounded-[28px]
              border
              border-white/10
              bg-gradient-to-br
              from-[#06111D]
              to-[#030914]
              p-5
              transition-all
              duration-500
              hover:scale-[1.02]
              hover:-translate-y-1
              hover:border-cyan-400/40
              ${glow(item.glow)}
              `}
            >

              <div
                className="
                absolute
                inset-0
                opacity-0
                group-hover:opacity-100
                transition
                duration-300
                bg-gradient-to-r
                from-blue-500/10
                to-transparent
                "
              />

              <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                <div className="flex items-center gap-5">

                  <div className="rounded-full border border-white/10 bg-white/[0.04] p-4">
                    <Icon className="h-5 w-5"/>
                  </div>

                  <div>

                    <p className="text-xs uppercase tracking-[0.3em] text-[#D8B45A]">
                      {item.section}
                    </p>

                    <h3 className="mt-2 text-xl font-semibold">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-sm text-white/60">
                      {item.desc}
                    </p>

                  </div>

                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.04] p-5 transition group-hover:bg-blue-500/15">

                  <ChevronRight className="h-6 w-6"/>

                </div>

              </div>

            </Link>

          )

        })}

      </div>

    </div>

  )

}