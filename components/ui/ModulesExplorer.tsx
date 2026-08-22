"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";

import { trackModuleVisit, useModuleUsage } from "@/lib/module-usage";
import {
  AREAS,
  AREA_BY_KEY,
  MODULES,
  matchesQuery,
  type AreaKey,
  type AppModule,
} from "@/lib/modules";
import { cn } from "@/lib/utils";

/**
 * Buscador de áreas de trabajo.
 *
 * Con más de treinta módulos, paginarlos de ocho en ocho obligaba a recordar
 * en qué página estaba cada cosa. Aquí se escribe lo que se busca, se filtra
 * por área y lo que más se usa sube solo.
 */

function ModuleCard({ module }: { module: AppModule }) {
  const area = AREA_BY_KEY.get(module.area)!;
  const Icon = module.icon;

  return (
    <Link
      href={module.href}
      onClick={() => trackModuleVisit(module.href)}
      style={{ ["--accent" as string]: area.color }}
      className="group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--accent)]/50 hover:bg-white/[0.05]"
    >
      {/* Filo de color: el área se reconoce antes de leer el texto. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-[color:var(--accent)] opacity-40 transition-opacity duration-300 group-hover:opacity-100"
      />

      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[color:var(--accent)] transition-colors duration-300 group-hover:border-[color:var(--accent)]/40 group-hover:bg-[color:var(--accent)]/10">
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]/80">
          {area.label}
        </span>

        <span className="mt-1 block truncate text-[15px] font-semibold text-white">
          {module.title}
        </span>

        <span className="mt-1 block text-[12px] leading-snug text-white/45">
          {module.desc}
        </span>
      </span>

      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/20 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[color:var(--accent)]" />
    </Link>
  );
}

export default function ModulesExplorer() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<AreaKey | null>(null);

  const input = useRef<HTMLInputElement>(null);

  const usage = useModuleUsage();

  /* Con muchas tarjetas, teclear rápido no debe bloquear el repintado. */
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    return MODULES.filter(
      (module) =>
        (!area || module.area === area) && matchesQuery(module, deferredQuery)
    ).sort(
      (a, b) => b.rank + (usage[b.href] ?? 0) * 3 - (a.rank + (usage[a.href] ?? 0) * 3)
    );
  }, [area, deferredQuery, usage]);

  /* Recuento por área, para no ofrecer filtros que dejarían la rejilla vacía. */
  const countByArea = useMemo(() => {
    const counts = new Map<AreaKey, number>();

    MODULES.filter((module) => matchesQuery(module, deferredQuery)).forEach(
      (module) => counts.set(module.area, (counts.get(module.area) ?? 0) + 1)
    );

    return counts;
  }, [deferredQuery]);

  /* Atajo de teclado: "/" enfoca la búsqueda desde cualquier punto de la portada. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (typing) return;

      if (event.key === "/") {
        event.preventDefault();
        input.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="mt-6">
      {/* BUSCADOR */}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-[340px] lg:shrink-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />

          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setQuery("")}
            placeholder="Buscar un área…"
            aria-label="Buscar entre las áreas de trabajo"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-16 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#D8B45A]/50 focus:bg-white/[0.06]"
          />

          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/35 lg:block">
              /
            </kbd>
          )}
        </div>

        {/* FILTROS POR ÁREA */}

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          <button
            type="button"
            onClick={() => setArea(null)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition",
              area === null
                ? "border-[#D8B45A]/50 bg-[#D8B45A]/12 text-[#F7D98B]"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
            )}
          >
            Todas
          </button>

          {AREAS.map((item) => {
            const count = countByArea.get(item.key) ?? 0;
            const active = area === item.key;

            return (
              <button
                key={item.key}
                type="button"
                disabled={count === 0}
                onClick={() => setArea(active ? null : item.key)}
                style={{ ["--accent" as string]: item.color }}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-25",
                  active
                    ? "border-[color:var(--accent)]/60 bg-[color:var(--accent)]/12 text-[color:var(--accent)]"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:border-[color:var(--accent)]/40 hover:text-white"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* RESULTADOS */}

      {results.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-white/35">
          Nada coincide con «{query}».
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {results.map((module) => (
            <ModuleCard key={module.href} module={module} />
          ))}
        </div>
      )}

      <p className="mt-5 text-[11px] text-white/25">
        {results.length} de {MODULES.length} áreas
        {area || query ? " · filtrando" : " · lo que más usas aparece primero"}
      </p>
    </div>
  );
}
