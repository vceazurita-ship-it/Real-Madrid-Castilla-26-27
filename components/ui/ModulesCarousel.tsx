"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRef } from "react"

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

export default function ModulesCarousel({
  modules,
}: {
  modules: Module[]
}) {
  const ref = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (!ref.current) return

    ref.current.scrollBy({
      left: direction === "right" ? 360 : -360,
      behavior: "smooth",
    })
  }

  return (
    <div className="relative mt-6">

      {/* Flecha izquierda */}
      <button
        onClick={() => scroll("left")}
        className="
          absolute
          left-0
          top-1/2
          -translate-y-1/2
          z-30
          hidden
          xl:flex
          h-11
          w-11
          items-center
          justify-center
          rounded-full
          border
          border-white/10
          bg-[#08111E]/90
          backdrop-blur
          hover:bg-blue-600
          transition
        "
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Flecha derecha */}
      <button
        onClick={() => scroll("right")}
        className="
          absolute
          right-0
          top-1/2
          -translate-y-1/2
          z-30
          hidden
          xl:flex
          h-11
          w-11
          items-center
          justify-center
          rounded-full
          border
          border-white/10
          bg-[#08111E]/90
          backdrop-blur
          hover:bg-blue-600
          transition
        "
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Carrusel */}
      <div
        ref={ref}
        className="
          flex
          gap-5
          overflow-x-auto
          scroll-smooth
          snap-x
          snap-mandatory
          pb-3
          hide-scrollbar
        "
      >
        {modules.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.title}
              href={item.href}
              className={`
                snap-start
                shrink-0
                w-[320px]
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
                    <Icon className="h-5 w-5" />
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
                  <ChevronRight className="h-6 w-6" />
                </div>

              </div>
            </Link>
          )
        })}
      </div>

    </div>
  )
}