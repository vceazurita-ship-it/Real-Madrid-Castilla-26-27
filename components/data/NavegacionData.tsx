"use client";

/**
 * La navegación y el resumen de entrada de Data análisis (02/11/2026).
 *
 * Revisión de producto: catorce áreas repartidas en cuatro bloques, el de
 * «Equipo» con siete que mezclaban «nosotros» con «cualquier equipo de la
 * categoría», y se entraba directamente a una tabla de percentiles sin saber
 * qué había que mirar. Ahora:
 *
 * - `PanelResumen`: la puerta. Tres a cinco conclusiones de la jornada, cada
 *   una con su cifra y un botón que lleva al área donde se ve entera, y el
 *   mapa de la sección (bloques y áreas con su pregunta).
 * - `BuscadorAreas`: se escribe «córner», «once» o «rival» y se salta al área.
 * - `SelectorArea`: el desplegable que va en la barra fija del índice, para
 *   cambiar de área sin volver arriba.
 *
 * Las claves de área no cambian: `?area=` de la portada y de otras pantallas
 * sigue abriendo donde prometía.
 */

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { MEJOR, ORO, PEOR } from "@/components/data/graficas";

type Icono = ComponentType<{ size?: number; className?: string }>;

export type AreaNav = { key: string; label: string; icono: Icono; pregunta: string };
export type BloqueNav = { clave: string; label: string; icono: Icono; areas: string[]; enlace?: { href: string; label: string } };

export type ConclusionResumen = {
  id: string;
  /** «Último partido», «Lo más fuerte de la temporada»… */
  rotulo: string;
  /** La frase que se lee primero. */
  titular: string;
  /** La cifra o el porqué, en una línea. */
  detalle?: string;
  tono: "bien" | "mal" | "neutro";
  /** Área a la que lleva el botón. */
  area: string;
  /** Texto del botón. */
  ir: string;
  /** La fase de «Contra la liga» que hay que dejar abierta al llegar. */
  fase?: string;
};

const sinTildes = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const COLOR_TONO = { bien: MEJOR, mal: PEOR, neutro: ORO } as const;

/* ------------------------------------------------------------------ */
/*  RESUMEN                                                            */
/* ------------------------------------------------------------------ */

export function PanelResumen({
  conclusiones,
  areas,
  bloques,
  onIr,
}: {
  conclusiones: ConclusionResumen[];
  areas: AreaNav[];
  bloques: BloqueNav[];
  onIr: (area: string, conclusion?: ConclusionResumen) => void;
}) {
  const porClave = useMemo(() => new Map(areas.map((a) => [a.key, a])), [areas]);

  return (
    <div className="mt-5 space-y-6">
      {conclusiones.length > 0 && (
        <section aria-labelledby="resumen-claves">
          <header className="mb-3">
            <h2 id="resumen-claves" className="text-base font-semibold text-white">
              Las claves de la jornada
            </h2>
          </header>

          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {conclusiones.map((c) => (
              <li
                key={c.id}
                className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                style={{ borderTopWidth: 3, borderTopColor: COLOR_TONO[c.tono] }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{c.rotulo}</p>
                <p className="mt-1.5 text-[15px] font-semibold leading-snug text-white">{c.titular}</p>
                {c.detalle && <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{c.detalle}</p>}
                <button
                  type="button"
                  onClick={() => onIr(c.area, c)}
                  className="mt-auto inline-flex min-h-[44px] items-center gap-1.5 self-start pt-3 text-[13px] font-medium text-[#C8A96B] hover:underline"
                >
                  {c.ir}
                  <ArrowRight size={14} />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="resumen-mapa">
        <header className="mb-3">
          <h2 id="resumen-mapa" className="text-base font-semibold text-white">
            Toda la sección
          </h2>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {bloques
            .filter((b) => b.areas.some((k) => k !== "resumen"))
            .map((b) => (
              <div key={b.clave} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <b.icono size={15} className="text-[#C8A96B]" />
                  {b.label}
                </p>

                <ul className="mt-2 space-y-0.5">
                  {b.areas.map((k) => {
                    const a = porClave.get(k);
                    if (!a) return null;

                    return (
                      <li key={k}>
                        <button
                          type="button"
                          onClick={() => onIr(k)}
                          className="group flex min-h-[44px] w-full min-w-0 flex-col items-start rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.05]"
                        >
                          <span className="text-[13px] font-medium text-white/85 group-hover:text-white">{a.label}</span>
                          <span className="text-[12px] leading-snug text-white/50">{a.pregunta}</span>
                        </button>
                      </li>
                    );
                  })}

                  {b.enlace && (
                    <li>
                      <Link
                        href={b.enlace.href}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[#C8A96B] hover:bg-white/[0.05]"
                      >
                        {b.enlace.label}
                        <ArrowRight size={13} />
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BUSCADOR                                                           */
/* ------------------------------------------------------------------ */

export function BuscadorAreas({
  areas,
  bloques,
  onIr,
}: {
  areas: AreaNav[];
  bloques: BloqueNav[];
  onIr: (area: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caja = useRef<HTMLInputElement>(null);

  const bloqueDe = useMemo(() => {
    const m = new Map<string, string>();
    bloques.forEach((b) => b.areas.forEach((a) => m.set(a, b.label)));
    return m;
  }, [bloques]);

  const encontradas = useMemo(() => {
    const q = sinTildes(texto.trim());
    if (!q) return areas;
    const palabras = q.split(/\s+/);
    return areas.filter((a) => {
      const pajar = sinTildes(`${a.label} ${a.pregunta} ${bloqueDe.get(a.key) ?? ""}`);
      return palabras.every((p) => pajar.includes(p));
    });
  }, [areas, bloqueDe, texto]);

  const elige = (key: string) => {
    onIr(key);
    setTexto("");
    setAbierto(false);
    caja.current?.blur();
  };

  return (
    <div className="relative w-full sm:w-72">
      <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 focus-within:border-[#C8A96B]/50">
        <Search size={15} className="shrink-0 text-white/45" />
        <span className="sr-only">Buscar un área de Análisis de datos</span>
        <input
          ref={caja}
          type="search"
          value={texto}
          placeholder="Buscar: rival, once, córner…"
          onChange={(e) => {
            setTexto(e.target.value);
            setMarcado(0);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMarcado((m) => Math.min(m + 1, encontradas.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setMarcado((m) => Math.max(m - 1, 0));
            } else if (e.key === "Enter" && encontradas[marcado]) {
              e.preventDefault();
              elige(encontradas[marcado].key);
            } else if (e.key === "Escape") {
              setAbierto(false);
            }
          }}
          role="combobox"
          aria-expanded={abierto}
          aria-controls="data-buscador-lista"
          aria-autocomplete="list"
          className="w-full min-w-0 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/35"
        />
      </label>

      {abierto && encontradas.length > 0 && (
        <ul
          id="data-buscador-lista"
          role="listbox"
          className="absolute right-0 z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#11161C] p-1 shadow-2xl sm:w-96"
        >
          {encontradas.map((a, i) => (
            <li key={a.key} role="option" aria-selected={i === marcado}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elige(a.key)}
                className={`flex w-full min-w-0 items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                  i === marcado ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                }`}
              >
                <a.icono size={14} className="mt-0.5 shrink-0 text-[#C8A96B]" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-white/90">
                    {a.label}
                    <span className="ml-1.5 text-[11px] font-normal text-white/40">{bloqueDe.get(a.key)}</span>
                  </span>
                  <span className="block text-[12px] leading-snug text-white/50">{a.pregunta}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DESPLEGABLE DE LA BARRA FIJA                                       */
/* ------------------------------------------------------------------ */

export function SelectorArea({
  valor,
  areas,
  bloques,
  onIr,
}: {
  valor: string;
  areas: AreaNav[];
  bloques: BloqueNav[];
  onIr: (area: string) => void;
}) {
  const porClave = new Map(areas.map((a) => [a.key, a]));

  /* 07/11/2026 (jueces, dos rondas): con las pastillas a la vista repetía lo
     mismo justo debajo; ahora sólo sale cuando ya no se ven. */
  const [pastillasVisibles, setPastillasVisibles] = useState(true);
  useEffect(() => {
    const el = document.querySelector("[data-pastillas-areas]");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPastillasVisibles(e.isIntersecting), { rootMargin: "-120px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    /* En el móvil sobraba: repetía las pastillas y se cortaba (05/11/2026). */
    <label className={`hidden shrink-0 items-center ${pastillasVisibles ? "" : "md:flex"}`}>
      <span className="sr-only">Cambiar de área</span>
      <select
        value={valor}
        onChange={(e) => onIr(e.target.value)}
        className="max-w-[46vw] rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 py-1.5 pl-3 pr-7 text-xs font-semibold text-[#C8A96B] outline-none sm:max-w-none"
      >
        {bloques.map((b) => (
          <optgroup key={b.clave} label={b.label} className="bg-[#11161C] text-white">
            {b.areas.map((k) => (
              <option key={k} value={k} className="bg-[#11161C] text-white">
                {porClave.get(k)?.label ?? k}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
