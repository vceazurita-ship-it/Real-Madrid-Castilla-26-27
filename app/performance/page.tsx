"use client";

import { useState } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { X } from "lucide-react";

const weeks = [
  {
    title: "Planificación Pretemporada",
    image: "/IMG-20260709-WA0010.jpg",
  },
  {
    title: "Semana 0",
    image: "/IMG-20260708-WA0001.jpg",
  },
  {
    title: "Semana 1",
    image: "/IMG-20260709-WA0011.jpg",
  },
  { title: "Semana 2" },
  { title: "Semana 3" },
  { title: "Semana 4" },
  { title: "Semana 5" },
  { title: "Semana 6" },
  { title: "Semana 7" },
  { title: "Semana 8" },
];

export default function PerformancePage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="w-full">
          <Topbar />

          <div className="px-6 lg:px-10 py-8">

            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA · PERFORMANCE
            </p>

            <h1 className="mt-4 text-4xl font-semibold">
              Área Condicional
            </h1>

            <p className="mt-4 text-white/60 max-w-3xl">
              Planificación semanal del área de rendimiento.
              Pulsa sobre cualquier semana para verla a tamaño completo.
            </p>

            <div className="grid gap-6 mt-10 sm:grid-cols-2 xl:grid-cols-3">

              {weeks.map((week) => (

                <div
                  key={week.title}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-[#11161D]"
                >

                  {week.image ? (

                    <button
                      onClick={() => setSelected(week.image!)}
                      className="block w-full"
                    >

                      <div className="relative h-64">

                        <Image
                          src={week.image}
                          alt={week.title}
                          fill
                          className="object-cover hover:scale-105 transition"
                        />

                      </div>

                    </button>

                  ) : (

                    <div className="h-64 flex items-center justify-center text-white/30">
                      Próximamente
                    </div>

                  )}

                  <div className="p-5">

                    <h2 className="font-semibold text-xl">
                      {week.title}
                    </h2>

                  </div>

                </div>

              ))}

            </div>

                        {selected && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
                onClick={() => setSelected(null)}
              >
                <div
                  className="relative w-full max-w-6xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setSelected(null)}
                    className="absolute right-4 top-4 z-10 rounded-full bg-black/70 p-2 hover:bg-black"
                  >
                    <X size={22} />
                  </button>

                  <div className="relative h-[85vh] w-full">
                    <Image
                      src={selected}
                      alt="Planificación"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>
      </div>
    </main>
  );
}
