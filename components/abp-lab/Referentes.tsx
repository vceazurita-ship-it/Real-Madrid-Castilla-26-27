"use client";

/**
 * Pestaña «Referentes»: quién es quién en el balón parado y qué se le puede
 * copiar. Todo sale de `lib/abp-lab/referentes.ts`, con su fuente debajo de
 * cada cosa; una rutina se lleva al taller con un botón.
 */

import { useState } from "react";
import { ArrowUpRight, BookOpen, FlaskConical, GraduationCap, Shield, Sparkles } from "lucide-react";

import { Button, Panel } from "@/components/abp/ui";
import { fechaFuente } from "@/components/abp-lab/comun";
import { DATOS_CLAVE, DEFENSA, REFERENTES, type Fuente, type RutinaReferente } from "@/lib/abp-lab/referentes";
import { TIPOS, etiqueta } from "@/lib/abp-lab/modelo";

function Cita({ fuente }: { fuente: Fuente }) {
  return (
    <a
      href={fuente.url}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[10.5px] text-white/40 underline-offset-2 hover:text-[#C8A96B] hover:underline"
    >
      <ArrowUpRight size={11} className="shrink-0" />
      <span className="truncate">
        {fuente.medio}
        {fuente.fecha ? ` · ${fechaFuente(fuente.fecha)}` : ""}
      </span>
    </a>
  );
}

export function Referentes({ onAlTaller }: { onAlTaller: (rutina: RutinaReferente, referente: string) => void }) {
  const [elegido, setElegido] = useState(REFERENTES[0].id);

  const ref = REFERENTES.find((r) => r.id === elegido) ?? REFERENTES[0];

  return (
    <div className="space-y-5">
      {/* ------------------------ LOS DATOS QUE MANDAN --------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DATOS_CLAVE.map((d) => (
          <div key={d.texto} className="lab-aparece min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="tabular-nums text-3xl font-bold tracking-tight text-[#C8A96B]">{d.valor}</p>
            <p className="mt-1 text-[12.5px] leading-snug text-white/70">{d.texto}</p>
            <Cita fuente={d.fuente} />
          </div>
        ))}
      </div>

      {/* ------------------------ ELEGIR REFERENTE ------------------------ */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Referentes">
        {REFERENTES.map((r) => {
          const activo = r.id === elegido;

          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setElegido(r.id)}
              className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition ${
                activo ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <span className={`block text-sm font-semibold ${activo ? "text-[#C8A96B]" : "text-white/85"}`}>{r.nombre}</span>
              <span className="block text-[11px] text-white/45">{r.club}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------ LA FICHA -------------------------------- */}
      <section key={ref.id} className="lab-aparece overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="relative px-5 py-6 sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#C8A96B]/10 blur-3xl" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#C8A96B]">{ref.rol}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{ref.nombre}</h2>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-white/70">{ref.lema}</p>

          {ref.cifras.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ref.cifras.map((c) => (
                <div key={c.texto} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <p className="tabular-nums text-2xl font-bold text-white">{c.valor}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/55">{c.texto}</p>
                  <Cita fuente={c.fuente} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 border-t border-white/10 px-5 py-6 sm:px-8 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              <Sparkles size={13} className="text-[#C8A96B]" />
              Principios
            </h3>
            <ol className="mt-3 space-y-3">
              {ref.principios.map((p, i) => (
                <li key={p.titulo} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C8A96B]/15 text-[11px] font-bold text-[#C8A96B]">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/90">{p.titulo}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-white/60">{p.detalle}</p>
                    <Cita fuente={p.fuente} />
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="min-w-0 space-y-4">
            {ref.rutinas.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  <FlaskConical size={13} className="text-[#C8A96B]" />
                  Rutinas para copiar
                </h3>
                <div className="mt-3 space-y-3">
                  {ref.rutinas.map((r) => (
                    <article key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{r.nombre}</p>
                          <p className="text-[11px] text-white/45">
                            {etiqueta(TIPOS, r.tipo)}
                            {r.contra ? ` · contra ${r.contra}` : ""}
                          </p>
                        </div>
                        <Button icon={FlaskConical} onClick={() => onAlTaller(r, ref.id)}>
                          Al taller
                        </Button>
                      </div>
                      <ol className="mt-3 space-y-1.5 border-l border-[#C8A96B]/30 pl-3">
                        {r.pasos.map((paso) => (
                          <li key={paso} className="text-[13px] leading-snug text-white/70">
                            {paso}
                          </li>
                        ))}
                      </ol>
                      <Cita fuente={r.fuente} />
                    </article>
                  ))}
                </div>
              </div>
            )}

            {ref.recursos.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  <GraduationCap size={13} className="text-[#C8A96B]" />
                  Para formarse
                </h3>
                <ul className="mt-3 space-y-2">
                  {ref.recursos.map((r) => (
                    <li key={r.url}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-[#C8A96B]/40"
                      >
                        <BookOpen size={15} className="shrink-0 text-[#C8A96B]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-white/85">{r.titulo}</span>
                          <span className="block truncate text-[11px] text-white/45">
                            {r.medio} · {r.tipo}
                            {r.fecha ? ` · ${fechaFuente(r.fecha)}` : ""}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            r.gratis ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"
                          }`}
                        >
                          {r.gratis ? "Gratis" : "De pago"}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------ DEFENDER -------------------------------- */}
      <Panel title="Cómo se defiende en la élite" subtitle="Lo que hacen los equipos que menos encajan de córner" icon={Shield}>
        <div className="grid gap-3 md:grid-cols-2">
          {DEFENSA.map((p) => (
            <div key={p.titulo} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <p className="text-sm font-semibold text-white/90">{p.titulo}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-white/60">{p.detalle}</p>
              <Cita fuente={p.fuente} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
